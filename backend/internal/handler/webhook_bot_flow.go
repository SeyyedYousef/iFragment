package handler

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/config"
	"ifragment-backend/internal/crypto"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/intelcredit"
	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/numbers/nvengine"
	"ifragment-backend/internal/service/username/avm"
)

// Telegram Custom Emoji IDs (Bot API 9.4+ / Fragment ecosystem)
const (
	CustomEmojiDiamond = "5368324170671202286" // 💎 Diamond / iFragment primary
	CustomEmojiTag     = "5404870433939922908" // 🏷️ Username
	CustomEmojiPhone   = "5406830500155238210" // 📱 Anonymous Number (+888)
	CustomEmojiGift    = "5429184518776953457" // 🎁 Telegram Gifts
	CustomEmojiUser    = "5373141891321699086" // 👤 User Profile
	CustomEmojiGlobe   = "5413725458078370902" // 🌐 Language
	CustomEmojiBook    = "5406981880572557161" // 📖 Guide / Methodology
	CustomEmojiCheck   = "5206607081334906820" // ✅ Confirmation
	CustomEmojiCross   = "5210952531676504517" // ❌ Cancel / Close
	CustomEmojiStar    = "5469741319704284898" // ⭐ Telegram Stars
	CustomEmojiBolt    = "5445284980978654454" // ⚡ Intel Credits
	CustomEmojiCoin    = "5406830500155238210" // 🪙 Airdrop Coins
	CustomEmojiRefresh = "5445284980978654454" // 🔄 Convert / Exchange
)

// SmartSniffResult holds the recognized asset type and normalized query.
type SmartSniffResult struct {
	Type   string // "username", "number", "gift"
	Entity string // normalized entity value (e.g. "durov", "+88888888888", "plush_pepe-42")
	Raw    string
}

var (
	giftSlugRegex    = regexp.MustCompile(`(?i)^[a-zA-Z0-9_]+-\d+$`)
	usernameRe       = regexp.MustCompile(`^[a-zA-Z](?:[a-zA-Z0-9_]{2,30})[a-zA-Z0-9]$`)
	premiumEmojiIDRe = regexp.MustCompile(`\[emoji:(\d{10,21})\]|\[(\d{10,21})\]`)
)

// FormatPremiumEmojiText replaces bracketed emoji IDs like [5368324170671202286] or [emoji:5368324170671202286]
// with standard Telegram Bot API custom emoji markup: <tg-emoji emoji-id="ID">✨</tg-emoji>
func FormatPremiumEmojiText(input string) string {
	if input == "" {
		return input
	}
	return premiumEmojiIDRe.ReplaceAllStringFunc(input, func(m string) string {
		sub := premiumEmojiIDRe.FindStringSubmatch(m)
		id := sub[1]
		if id == "" {
			id = sub[2]
		}
		if id != "" {
			return fmt.Sprintf(`<tg-emoji emoji-id="%s">✨</tg-emoji>`, id)
		}
		return m
	})
}

// resolveText retrieves a custom text if defined by owner, or falls back to default.
func (h *WebhookHandler) resolveText(ctx context.Context, key, lang, defaultText string) string {
	if h.templateRepo != nil {
		custom, err := h.templateRepo.GetTemplate(ctx, key, lang)
		if err == nil && custom != "" {
			return custom
		}
	}
	return defaultText
}

// resolveButton retrieves a custom button label if defined by owner, or falls back to default.
func (h *WebhookHandler) resolveButton(ctx context.Context, key, lang, defaultLabel string) string {
	if h.templateRepo != nil {
		custom, err := h.templateRepo.GetTemplate(ctx, key, lang)
		if err == nil && custom != "" {
			return custom
		}
	}
	return defaultLabel
}

// SniffAsset recognizes user input as either a username, +888 number, or gift.
func SniffAsset(raw string) *SmartSniffResult {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}

	var forcedType string
	if strings.HasPrefix(trimmed, "/") {
		parts := strings.SplitN(trimmed, " ", 2)
		if len(parts) == 2 {
			cmd := strings.ToLower(parts[0])
			if atIdx := strings.Index(cmd, "@"); atIdx != -1 {
				cmd = cmd[:atIdx]
			}
			switch cmd {
			case "/val", "/valuate", "/check":
				forcedType = "username"
				trimmed = strings.TrimSpace(parts[1])
			case "/num", "/number":
				forcedType = "number"
				trimmed = strings.TrimSpace(parts[1])
			case "/gift", "/nft":
				forcedType = "gift"
				trimmed = strings.TrimSpace(parts[1])
			}
		}
	}

	if forcedType == "gift" {
		if giftLinkRegex.MatchString(trimmed) {
			m := giftLinkRegex.FindStringSubmatch(trimmed)
			if len(m) > 1 {
				return &SmartSniffResult{Type: "gift", Entity: m[1], Raw: raw}
			}
		}
		spaceParts := strings.Fields(trimmed)
		if len(spaceParts) == 2 {
			trimmed = fmt.Sprintf("%s-%s", spaceParts[0], spaceParts[1])
		}
		return &SmartSniffResult{Type: "gift", Entity: trimmed, Raw: raw}
	}

	// 1. Check if it's a gift link or gift slug format
	if giftLinkRegex.MatchString(trimmed) {
		m := giftLinkRegex.FindStringSubmatch(trimmed)
		if len(m) > 1 {
			return &SmartSniffResult{Type: "gift", Entity: m[1], Raw: raw}
		}
	}
	if giftSlugRegex.MatchString(trimmed) {
		return &SmartSniffResult{Type: "gift", Entity: trimmed, Raw: raw}
	}

	// 2. Check if it's a +888 Anonymous Number
	// Digits with optional +, spaces, dashes, or 888 prefix
	normNum, err := features.NormalizeNumber(trimmed)
	if err == nil && normNum != "" {
		return &SmartSniffResult{Type: "number", Entity: normNum, Raw: raw}
	}

	// 3. Extract potential username from URL or @mention
	cleanUser := strings.TrimPrefix(trimmed, "@")
	if strings.Contains(cleanUser, "://") || strings.HasPrefix(strings.ToLower(cleanUser), "t.me/") || strings.HasPrefix(strings.ToLower(cleanUser), "fragment.com/") || strings.HasPrefix(strings.ToLower(cleanUser), "www.fragment.com/") {
		urlStr := cleanUser
		if !strings.Contains(urlStr, "://") {
			urlStr = "https://" + urlStr
		}
		if u, parseErr := url.Parse(urlStr); parseErr == nil {
			host := strings.ToLower(u.Hostname())
			path := strings.Trim(u.Path, "/")
			if host == "t.me" || strings.HasSuffix(host, ".t.me") {
				pathParts := strings.Split(path, "/")
				if len(pathParts) > 0 && pathParts[0] != "" {
					cleanUser = pathParts[0]
				}
			} else if host == "fragment.com" || host == "www.fragment.com" {
				pathParts := strings.Split(path, "/")
				if len(pathParts) >= 2 && strings.EqualFold(pathParts[0], "username") {
					cleanUser = pathParts[1]
				} else if len(pathParts) > 0 && pathParts[0] != "" {
					cleanUser = pathParts[0]
				}
			}
		}
	} else {
		cleanUser = strings.TrimRight(cleanUser, "/")
	}

	// Telegram usernames: start with a letter, end with alphanumeric, 4 to 32 chars (4 chars for Fragment collectibles)
	if usernameRe.MatchString(cleanUser) && !strings.HasPrefix(cleanUser, "888") {
		return &SmartSniffResult{Type: "username", Entity: strings.ToLower(cleanUser), Raw: raw}
	}

	if forcedType == "number" && normNum != "" {
		return &SmartSniffResult{Type: "number", Entity: normNum, Raw: raw}
	}
	if forcedType == "username" && usernameRe.MatchString(cleanUser) {
		return &SmartSniffResult{Type: "username", Entity: strings.ToLower(cleanUser), Raw: raw}
	}

	return nil
}

// sendMainMenu renders the interactive Glass-style dashboard with default mini app URL
func (h *WebhookHandler) sendMainMenu(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, firstName string, messageID *int, threadID *int) {
	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		if bot != nil && bot.BotUsername != "" {
			miniAppURL = fmt.Sprintf("https://t.me/%s/iFragment", bot.BotUsername)
		} else {
			miniAppURL = "https://t.me/iFragmentBot/iFragment"
		}
	}
	h.sendMainMenuWithURL(ctx, bot, chatID, userID, firstName, miniAppURL, messageID, threadID)
}

// sendMainMenuWithURL renders the interactive Glass-style dashboard with custom target URL
func (h *WebhookHandler) sendMainMenuWithURL(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, firstName string, targetURL string, messageID *int, threadID *int) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	var defaultMenuText string
	switch lang {
	case "fa":
		defaultMenuText = `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>ترمینال تحلیل دارایی‌های تلگرام | iFragment</b>

سلام <b>{name}</b> عزیز؛ به دستیار هوشمند کارشناسی و ارزیابی دارایی‌های دیجیتال تلگرام خوش آمدید.

یکی از بخش‌های زیر را انتخاب کنید، یا مستقیماً <b>نام کاربری</b>، <b>شماره ناشناس (+888)</b> یا <b>لینک گیفت</b> را در چت ارسال فرمایید:`
	case "ar":
		defaultMenuText = `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>منصة تحليل أصول تيليجرام الذكية | iFragment</b>

أهلاً بك <b>{name}</b>! مرحباً بك في المساعد الذكي لتقييم وفحص أصول تيليجرام الرقمية.

اختر إحدى الفئات أدناه، أو أرسل <b>اسم المستخدم</b> أو <b>الرقم المميز (+888)</b> أو <b>رابط الهدية</b> مباشرة في الدردشة:`
	case "ru":
		defaultMenuText = `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>Терминал аналитики активов Telegram | iFragment</b>

Здравствуйте, <b>{name}</b>! Добро пожаловать в интеллектуальный ассистент оценки активов Telegram.

Выберите категорию یا отправьте <b>юзернейм</b>, <b>номер (+888)</b> или <b>ссылку на подарок</b> прямо в чат:`
	case "zh":
		defaultMenuText = `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>Telegram 资产智能分析终端 | iFragment</b>

您好 <b>{name}</b>！欢迎使用 Telegram 数字资产专业估值与市场洞察终端。

请选择下方的资产类别，或直接在聊天中发送<b>用户名</b>、<b>+888 匿名靓号</b>或<b>礼物链接</b>：`
	default:
		defaultMenuText = `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>Telegram Asset Intelligence Terminal | iFragment</b>

Welcome <b>{name}</b>! I am your institutional analytics engine for Telegram Digital Assets.

Select an asset class below or simply send any <b>username</b>, <b>anonymous number (+888)</b>, or <b>gift link</b> in chat:`
	}

	rawMenu := h.resolveText(ctx, "start_menu", lang, defaultMenuText)
	menuText := strings.ReplaceAll(rawMenu, "{name}", telegram.EscapeHTML(firstName))
	menuText = strings.ReplaceAll(menuText, "{diamond}", fmt.Sprintf(`<tg-emoji emoji-id="%s">💎</tg-emoji>`, CustomEmojiDiamond))

	markup := h.buildMainMenuMarkup(lang, targetURL)

	h.sendOrEditMessage(ctx, tg, chatID, messageID, menuText, markup, threadID)
}

// buildMainMenuMarkup creates the clean, elegant inline keyboard with standard Telegram buttons
// structured as a balanced 1 + 2 + 2 + 2 layout.
func (h *WebhookHandler) buildMainMenuMarkup(lang string, miniAppURL string) map[string]interface{} {
	var btnUsername, btnNumber, btnGifts, btnProfile, btnLang, btnHelp, btnMiniApp string

	switch lang {
	case "fa":
		btnUsername = "🏷️ نام‌های کاربری"
		btnNumber = "📱 شماره‌های رند (+888)"
		btnGifts = "🎁 گیفت‌های تلگرام"
		btnProfile = "👤 پروفایل و دارایی‌ها"
		btnLang = "🌐 تغییر زبان"
		btnHelp = "📖 راهنمای ربات"
		btnMiniApp = "💎 ورود به مینی‌اپ iFragment"
	case "ar":
		btnUsername = "🏷️ أسماء المستخدمين"
		btnNumber = "📱 الأرقام المميزة (+888)"
		btnGifts = "🎁 هدايا تيليجرام"
		btnProfile = "👤 الملف الشخصي والأرصدة"
		btnLang = "🌐 تغيير اللغة"
		btnHelp = "📖 دليل الاستخدام"
		btnMiniApp = "💎 فتح تطبيق iFragment"
	case "ru":
		btnUsername = "🏷️ Юзернеймы"
		btnNumber = "📱 Номера (+888)"
		btnGifts = "🎁 Подарки (NFT)"
		btnProfile = "👤 Мой профиль"
		btnLang = "🌐 Сменить язык"
		btnHelp = "📖 Инструкция"
		btnMiniApp = "💎 Открыть iFragment Mini App"
	case "zh":
		btnUsername = "🏷️ 用户名"
		btnNumber = "📱 匿名靓号 (+888)"
		btnGifts = "🎁 电报礼物 (NFT)"
		btnProfile = "👤 个人中心与资产"
		btnLang = "🌐 切换语言"
		btnHelp = "📖 使用指南"
		btnMiniApp = "💎 进入 iFragment 小程序"
	default:
		btnUsername = "🏷️ Usernames"
		btnNumber = "📱 Numbers (+888)"
		btnGifts = "🎁 Telegram Gifts"
		btnProfile = "👤 Profile & Balances"
		btnLang = "🌐 Language"
		btnHelp = "📖 Help & Guide"
		btnMiniApp = "💎 Launch iFragment Mini App"
	}

	btnMiniApp = h.resolveButton(context.Background(), "btn_mini_app", lang, btnMiniApp)
	btnUsername = h.resolveButton(context.Background(), "btn_usernames", lang, btnUsername)
	btnNumber = h.resolveButton(context.Background(), "btn_numbers", lang, btnNumber)
	btnGifts = h.resolveButton(context.Background(), "btn_gifts", lang, btnGifts)
	btnProfile = h.resolveButton(context.Background(), "btn_profile", lang, btnProfile)
	btnLang = h.resolveButton(context.Background(), "btn_language", lang, btnLang)
	btnHelp = h.resolveButton(context.Background(), "btn_help", lang, btnHelp)

	return map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			// Row 1: Hero Primary CTA (Full Width)
			{
				{
					"text": btnMiniApp,
					"url":  miniAppURL,
				},
			},
			// Row 2: Asset Analytics (2 balanced buttons)
			{
				{
					"text":          btnUsername,
					"callback_data": "nav:asset_username",
				},
				{
					"text":          btnNumber,
					"callback_data": "nav:asset_number",
				},
			},
			// Row 3: Ecosystem & Investor Profile (2 balanced buttons)
			{
				{
					"text":          btnGifts,
					"callback_data": "nav:asset_gifts",
				},
				{
					"text":          btnProfile,
					"callback_data": "nav:profile",
				},
			},
			// Row 4: Preferences & Methodology (2 balanced buttons)
			{
				{
					"text":          btnLang,
					"callback_data": "nav:language",
				},
				{
					"text":          btnHelp,
					"callback_data": "nav:help",
				},
			},
		},
	}
}

// sendProfileView renders the user profile with airdrop coins, credits, rank, and referral
func (h *WebhookHandler) sendProfileView(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, messageID *int, threadID *int) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	var airdropCoins float64 = 0
	var intelCredits int = 0
	var globalRank int = 1
	var level int = 1
	var firstName string = "کاربر"

	if h.profileService != nil {
		stats, err := h.profileService.GetStats(ctx, userID)
		if err == nil && stats != nil {
			airdropCoins = stats.AirdropCoins
			intelCredits = stats.IntelCredits
			globalRank = stats.GlobalRank
			level = stats.Level
			if stats.FirstName != "" {
				firstName = stats.FirstName
			}
		}
	}

	refLink := fmt.Sprintf("https://t.me/iFragmentBot?start=ref_%d", userID)

	formattedAirdropCoins := formatNumberWithCommas(int(airdropCoins))

	var defaultProfileText string
	switch lang {
	case "fa":
		defaultProfileText = `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>پروفایل سرمایه‌گذار | iFragment</b>

کاربر: <b>{name}</b> (شناسه: <code>{id}</code>)
سطح کاربری: <b>سطح {level}</b>
رتبه جهانی در شبکه: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>موجودی سکه ایردراپ:</b> <code>{coins}</code> سکه
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>اعتبار تحلیلی (Intel Credits):</b> <code>{credits}</code> کریدت
━━━━━━━━━━━━━━━━━━━

🔗 <b>لینک دعوت اختصاصی شما:</b>
<code>{reflink}</code>
<i>با دعوت از هر دوست، سکه ایردراپ و اعتبار تحلیل هدیه بگیرید!</i>`
	case "ar":
		defaultProfileText = `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>الملف الشخصي للمستثمر | iFragment</b>

المستخدم: <b>{name}</b> (المعرف: <code>{id}</code>)
المستوى: <b>المستوى {level}</b>
الترتيب العالمي: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>رصيد عملات الإنزال:</b> <code>{coins}</code> عملة
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>رصيد التحليل (Intel Credits):</b> <code>{credits}</code> رصيد
━━━━━━━━━━━━━━━━━━━

🔗 <b>رابط الدعوة الخاص بك:</b>
<code>{reflink}</code>
<i>اربح عملات وأرصدة تحليلية مجانية عند دعوة أصدقائك!</i>`
	case "ru":
		defaultProfileText = `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>Профиль пользователя | iFragment</b>

Пользователь: <b>{name}</b> (ID: <code>{id}</code>)
Уровень: <b>Level {level}</b>
Глобальный ранг: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>Airdrop монеты:</b> <code>{coins}</code>
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>Intel Credits (кредиты отчетов):</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔗 <b>Ваша реферальная ссылка:</b>
<code>{reflink}</code>`
	case "zh":
		defaultProfileText = `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>个人中心与资产 | iFragment</b>

用户: <b>{name}</b> (ID: <code>{id}</code>)
等级: <b>Level {level}</b>
全网排名: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>空投代币余额:</b> <code>{coins}</code>
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>分析信用点 (Intel Credits):</b> <code>{credits}</code> 点
━━━━━━━━━━━━━━━━━━━

🔗 <b>您的专属邀请链接:</b>
<code>{reflink}</code>
<i>邀请好友加入，双方均可获得代币与分析信用点奖励！</i>`
	default:
		defaultProfileText = `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>Investor Profile | iFragment</b>

Account: <b>{name}</b> (ID: <code>{id}</code>)
Tier Level: <b>Level {level}</b>
Global Rank: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>Airdrop Coins Balance:</b> <code>{coins}</code>
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>Intel Credits Available:</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔗 <b>Your Exclusive Referral Link:</b>
<code>{reflink}</code>`
	}

	rawProfile := h.resolveText(ctx, "profile_view", lang, defaultProfileText)
	text := strings.ReplaceAll(rawProfile, "{name}", telegram.EscapeHTML(firstName))
	text = strings.ReplaceAll(text, "{id}", strconv.FormatInt(userID, 10))
	text = strings.ReplaceAll(text, "{level}", strconv.Itoa(level))
	text = strings.ReplaceAll(text, "{rank}", strconv.Itoa(globalRank))
	text = strings.ReplaceAll(text, "{coins}", formattedAirdropCoins)
	text = strings.ReplaceAll(text, "{credits}", strconv.Itoa(intelCredits))
	text = strings.ReplaceAll(text, "{reflink}", refLink)

	var btnExchange, btnStars, btnLang, btnBack string
	costCoins := config.Economics.CreditsCoinsPerCredit
	formattedCost := formatNumberWithCommas(costCoins)

	switch lang {
	case "fa":
		btnExchange = fmt.Sprintf("🔄 تبدیل %s سکه به ۱ کردیت", formattedCost)
		btnStars = "⭐ خرید کردیت با Stars"
		btnLang = "🌐 تغییر زبان"
		btnBack = "🔙 بازگشت به منو"
	case "ar":
		btnExchange = fmt.Sprintf("🔄 تحويل %s عملة إلى 1 رصيد", formattedCost)
		btnStars = "⭐ شراء أرصدة عبر Stars"
		btnLang = "🌐 تغيير اللغة"
		btnBack = "🔙 العودة للقائمة"
	case "ru":
		btnExchange = fmt.Sprintf("🔄 Обменять %s монет", formattedCost)
		btnStars = "⭐ Купить кредиты за Stars"
		btnLang = "🌐 Языک"
		btnBack = "🔙 В меню"
	case "zh":
		btnExchange = fmt.Sprintf("🔄 兑换 %s 代币为信用点", formattedCost)
		btnStars = "⭐ 使用 Stars 购买信用点"
		btnLang = "🌐 切换语言"
		btnBack = "🔙 返回主菜单"
	default:
		btnExchange = fmt.Sprintf("🔄 Exchange %s Coins", formattedCost)
		btnStars = "⭐ Buy Credits with Stars"
		btnLang = "🌐 Language"
		btnBack = "🔙 Back to Menu"
	}

	btnExchange = h.resolveButton(ctx, "btn_exchange", lang, btnExchange)
	btnStars = h.resolveButton(ctx, "btn_stars", lang, btnStars)
	btnLang = h.resolveButton(ctx, "btn_language", lang, btnLang)
	btnBack = h.resolveButton(ctx, "btn_back", lang, btnBack)

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{
					"text":          btnExchange,
					"callback_data": "exchange_coins:profile",
				},
			},
			{
				{
					"text":          btnStars,
					"callback_data": "buy_credits:profile",
				},
			},
			{
				{
					"text":          btnLang,
					"callback_data": "nav:language",
				},
				{
					"text":          btnBack,
					"callback_data": "nav:menu",
				},
			},
		},
	}

	h.sendOrEditMessage(ctx, tg, chatID, messageID, text, markup, threadID)
}

// sendHelpView displays instructions and examples for analyzing assets
func (h *WebhookHandler) sendHelpView(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, messageID *int, threadID *int) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	var text string
	switch lang {
	case "fa":
		text = `📖 <b>راهنمای ترمینال هوشمند iFragment</b>

شما می‌توانید بدون نیاز به هیچ دستوری، عبارات مورد نظرتان را مستقیماً برای ربات بفرستید:

🏷️ <b>۱. ارزیابی نام کاربری (Username):</b>
کافیست آیدی تلگرام را بفرستید:
• <code>@crypto</code> یا <code>wallet</code>
• <code>https://fragment.com/username/telecom</code>

📱 <b>۲. تحلیل شماره کلکسیونی (+888):</b>
شماره ناشناس مورد نظر را با فرمت کامل یا خلاصه بنویسید:
• <code>+888 8888 8888</code>
• <code>+88801234567</code> یا <code>8888</code>

🎁 <b>۳. کارشناسی گیفت تلگرام (Telegram Gifts):</b>
لینک یا نام گیفت را بفرستید:
• <code>https://t.me/nft/PlushPepe-42</code>
• <code>/gift CelestialStar-1</code>

💡 <i>هر گزارش عمیق به ۱ کریدت تحلیلی نیاز دارد که می‌توانید با سکه‌های ایردراپ خود یا استارز تلگرام آن را فعال کنید.</i>`
	case "ar":
		text = `📖 <b>دليل استخدام منصة iFragment الذكية</b>

يمكنك إرسال معلومات الأصول مباشرة إلى الدردشة دون الحاجة لأوامر معقدة:

🏷️ <b>1. تقييم أسماء المستخدمين (Username):</b>
أرسل المعرف أو الرابط:
• <code>@crypto</code> أو <code>wallet</code>
• <code>https://fragment.com/username/telecom</code>

📱 <b>2. تحليل الأرقام المميزة (+888):</b>
أرسل أي رقم مجهول:
• <code>+888 8888 8888</code>
• <code>+88801234567</code> أو <code>8888</code>

🎁 <b>3. تقييم وفحص هدايا تيليجرام (Telegram Gifts):</b>
أرسل رابط هدية NFT أو معرفها:
• <code>https://t.me/nft/PlushPepe-42</code>
• <code>/gift CelestialStar-1</code>

💡 <i>يتطلب كل تقرير تحليلي متقدم رصيد تحليل واحد (1 Intel Credit)، ويمكن الحصول عليه عبر تحويل عملات الإنزال الجوي أو شرائه عبر نجوم تيليجرام (Stars).</i>`
	case "ru":
		text = `📖 <b>Инструкция терминала iFragment</b>

Вы можете отправлять активы прямо в чат без дополнительных команд:

🏷️ <b>1. Оценка юзернеймов (Username):</b>
Отправьте тег или ссылку:
• <code>@crypto</code> или <code>wallet</code>
• <code>https://fragment.com/username/telecom</code>

📱 <b>2. Анализ номеров (+888):</b>
Отправьте анонимный номер:
• <code>+888 8888 8888</code>
• <code>+88801234567</code> или <code>8888</code>

🎁 <b>3. Оценка подарков (Telegram Gifts):</b>
Отправьте ссылку на NFT-подарок или идентификатор:
• <code>https://t.me/nft/PlushPepe-42</code>
• <code>/gift CelestialStar-1</code>

💡 <i>Каждый детальный отчет требует 1 Intel Credit. Кредиты можно получить за Airdrop-монеты или Stars.</i>`
	case "zh":
		text = `📖 <b>iFragment 智能终端使用指南</b>

您可以直接向机器人发送资产信息，无需输入复杂指令：

🏷️ <b>1. 用户名估值 (Username):</b>
直接发送用户名或链接：
• <code>@crypto</code> 或 <code>wallet</code>
• <code>https://fragment.com/username/telecom</code>

📱 <b>2. 匿名靓号分析 (+888):</b>
发送任意 888 匿名号码：
• <code>+888 8888 8888</code>
• <code>+88801234567</code> 或 <code>8888</code>

🎁 <b>3. 电报礼物鉴定 (Telegram Gifts):</b>
发送礼物 NFT 链接或编号：
• <code>https://t.me/nft/PlushPepe-42</code>
• <code>/gift CelestialStar-1</code>

💡 <i>每份深度报告消耗 1 个分析信用点，支持使用空投代币兑换或 Telegram Stars 购买。</i>`
	default:
		text = `📖 <b>iFragment Terminal Guide</b>

You can send assets directly into the chat:

🏷️ <b>1. Username Valuation:</b>
Send any username handle or Fragment URL:
• <code>@crypto</code> or <code>wallet</code>
• <code>https://fragment.com/username/telecom</code>

📱 <b>2. Anonymous Numbers (+888):</b>
Send any +888 number:
• <code>+888 8888 8888</code>
• <code>+88801234567</code> or <code>8888</code>

🎁 <b>3. Telegram Gifts Appraisal:</b>
Send any NFT gift link or slug:
• <code>https://t.me/nft/PlushPepe-42</code>
• <code>/gift CelestialStar-1</code>`
	}

	btnBack := "🔙 بازگشت به منوی اصلی"
	switch lang {
	case "ar":
		btnBack = "🔙 العودة للقائمة الرئيسية"
	case "ru":
		btnBack = "🔙 В главное меню"
	case "zh":
		btnBack = "🔙 返回主菜单"
	case "en":
		btnBack = "🔙 Back to Main Menu"
	}
	btnBack = h.resolveButton(ctx, "btn_back", lang, btnBack)
	text = h.resolveText(ctx, "help_view", lang, text)

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": btnBack, "callback_data": "nav:menu"},
			},
		},
	}

	h.sendOrEditMessage(ctx, tg, chatID, messageID, text, markup, threadID)
}

// sendAssetPrompt asks the user to input the specific asset
func (h *WebhookHandler) sendAssetPrompt(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, assetType string, messageID *int, threadID *int) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	var title, desc, example string
	switch assetType {
	case "username":
		switch lang {
		case "fa":
			title = "🏷️ <b>تحلیل و کارشناسی نام کاربری (Username)</b>"
			desc = "لطفاً نام کاربری مد نظر خود را به صورت متن یا با @ ارسال کنید:"
			example = "نمونه: <code>@crypto</code> ، <code>wallet</code> ، <code>ton_holder</code>"
		case "ar":
			title = "🏷️ <b>تحليل وتقييم اسم المستخدم (Username)</b>"
			desc = "يرجى إرسال اسم المستخدم المطلوب كنص أو مسبوقاً بـ @:"
			example = "مثال: <code>@crypto</code> أو <code>wallet</code> أو <code>ton_holder</code>"
		case "ru":
			title = "🏷️ <b>Оценка и анализ юзернейма Telegram</b>"
			desc = "Пожалуйста, отправьте тег или имя пользователя:"
			example = "Пример: <code>@crypto</code>, <code>wallet</code>"
		case "zh":
			title = "🏷️ <b>Telegram 用户名专业估值分析</b>"
			desc = "请输入您想要评估的 Telegram 用户名或链接："
			example = "示例: <code>@crypto</code>, <code>wallet</code>"
		default:
			title = "🏷️ <b>Telegram Username Valuation</b>"
			desc = "Please enter the username handle you wish to valuate:"
			example = "Example: <code>@crypto</code>, <code>wallet</code>"
		}
	case "number":
		switch lang {
		case "fa":
			title = "📱 <b>تحلیل شماره کلکسیونی ناشناس (+888)</b>"
			desc = "لطفاً شماره کلکسیونی ۸ رقمی یا رند ۴ رقمی مد نظر را وارد نمایید:"
			example = "نمونه: <code>+888 8888 8888</code> یا <code>+88801234567</code> یا <code>8888</code>"
		case "ar":
			title = "📱 <b>تحليل الرقم المميز المجهول (+888)</b>"
			desc = "يرجى إدخال الرقم المميز المكون من 8 أرقام أو 4 أرقام:"
			example = "مثال: <code>+888 8888 8888</code> أو <code>+88801234567</code> یا <code>8888</code>"
		case "ru":
			title = "📱 <b>Анализ анонимного номера (+888)</b>"
			desc = "Введите анонимный 8-значный или генезис 4-значный номер:"
			example = "Пример: <code>+888 8888 8888</code> или <code>8888</code>"
		case "zh":
			title = "📱 <b>Telegram +888 匿名靓号价值分析</b>"
			desc = "请输入您想要分析的 8 位或 4 位 +888 靓号："
			example = "示例: <code>+888 8888 8888</code> 或 <code>8888</code>"
		default:
			title = "📱 <b>Telegram Anonymous Numbers (+888)</b>"
			desc = "Please enter the anonymous +888 number to analyze:"
			example = "Example: <code>+888 8888 8888</code> or <code>8888</code>"
		}
	case "gifts":
		switch lang {
		case "fa":
			title = "🎁 <b>کارشناسی گیفت و کالکشن‌های تلگرام</b>"
			desc = "لطفاً لینک گیفت در تلگرام یا فرگمنت، یا نام و شماره آن را ارسال کنید:"
			example = "نمونه: <code>https://t.me/nft/PlushPepe-42</code> یا <code>PlushPepe-42</code>"
		case "ar":
			title = "🎁 <b>تقييم وفحص هدايا ومجموعات تيليجرام</b>"
			desc = "يرجى إرسال رابط الهدية في تيليجرام أو Fragment، أو اسمها ورقمها:"
			example = "مثال: <code>https://t.me/nft/PlushPepe-42</code> أو <code>PlushPepe-42</code>"
		case "ru":
			title = "🎁 <b>Оценка и анализ подарков Telegram</b>"
			desc = "Отправьте ссылку на NFT-подарок или название и номер:"
			example = "Пример: <code>https://t.me/nft/PlushPepe-42</code> или <code>PlushPepe-42</code>"
		case "zh":
			title = "🎁 <b>Telegram 礼物 NFT 稀缺度与估值鉴定</b>"
			desc = "请发送礼物 NFT 链接或模型名称及编号："
			example = "示例: <code>https://t.me/nft/PlushPepe-42</code> 或 <code>PlushPepe-42</code>"
		default:
			title = "🎁 <b>Telegram Gifts Appraisal</b>"
			desc = "Please send the Telegram Gift link or model-serial:"
			example = "Example: <code>https://t.me/nft/PlushPepe-42</code>"
		}
	}

	var templateKey string
	switch assetType {
	case "username":
		templateKey = "prompt_username"
	case "number":
		templateKey = "prompt_number"
	case "gifts":
		templateKey = "prompt_gift"
	}

	defaultText := fmt.Sprintf("%s\n\n%s\n\n📌 %s", title, desc, example)
	text := h.resolveText(ctx, templateKey, lang, defaultText)

	btnBack := "🔙 بازگشت به منوی اصلی"
	switch lang {
	case "ar":
		btnBack = "🔙 العودة للقائمة"
	case "ru":
		btnBack = "🔙 Назад в меню"
	case "zh":
		btnBack = "🔙 返回主菜单"
	case "en":
		btnBack = "🔙 Back to Menu"
	}
	btnBack = h.resolveButton(ctx, "btn_back", lang, btnBack)

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": btnBack, "callback_data": "nav:menu"},
			},
		},
	}

	h.sendOrEditMessage(ctx, tg, chatID, messageID, text, markup, threadID)
}

// sendPreCheckGate renders the pre-check gate showing current balances and unlocking options
func (h *WebhookHandler) sendPreCheckGate(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, assetType string, entity string, messageID *int, threadID *int) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	var airdropCoins float64 = 0
	var intelCredits int = 0
	if h.profileService != nil {
		stats, err := h.profileService.GetStats(ctx, userID)
		if err == nil && stats != nil {
			airdropCoins = stats.AirdropCoins
			intelCredits = stats.IntelCredits
		}
	}

	var assetNameFa, entityDisplay string
	switch assetType {
	case "username":
		assetNameFa = "نام کاربری"
		entityDisplay = "@" + strings.TrimPrefix(entity, "@")
	case "number":
		assetNameFa = "شماره کلکسیونی ناشناس"
		entityDisplay = entity
	case "gift":
		assetNameFa = "گیفت تلگرام"
		entityDisplay = entity
	default:
		assetNameFa = "دارایی دیجیتال"
		entityDisplay = entity
	}

	var gateText string
	var btnUnlock, btnExchange, btnStars, btnBack string

	costCoins := config.Economics.CreditsCoinsPerCredit
	formattedCost := formatNumberWithCommas(costCoins)

	var defaultGateText string
	switch lang {
	case "fa":
		defaultGateText = `🔍 <b>تحلیل اولیه دارایی شناسایی شد</b>

دارایی: <b>{type}</b>
شناسه / مقدار: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
🪙 <b>موجودی سکه ایردراپ:</b> <code>{coins}</code>
⚡ <b>اعتبار تحلیلی (Intel Credits):</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔐 <b>در گزارش تحلیلی عمیق این دارایی چه مواردی می‌بینید؟</b>
• برآورد ارزش منصفانه ریالی، دلاری و TON
• سنجش کمیابی صفات و ویژگی‌های ساختاری
• تاریخچه آخرین معاملات ثبت‌شده مشابه در شبکه
• شاخص نقدشوندگی و کشش تقاضا در بازار

هزینه باز کردن گزارش کامل: <b>۱ کریدت تحلیلی</b>`
		btnUnlock = "🔓 مشاهده گزارش تحلیلی (۱ کریدت)"
		btnExchange = fmt.Sprintf("🔄 تبدیل %s سکه به ۱ کریدت", formattedCost)
		btnStars = "⭐ خرید کریدت با Stars"
		btnBack = "🔙 بازگشت"

	case "ar":
		defaultGateText = `🔍 <b>تم التعرف على الأصل وجاهز للتقييم</b>

فئة الأصل: <b>{type}</b>
المعرف: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
🪙 <b>رصيد عملات الإنزال:</b> <code>{coins}</code>
⚡ <b>رصيد التحليل (Intel Credits):</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔐 <b>ماذا يتضمن تقرير التحليل المتقدم؟</b>
• التقييم العادل المعتمد بعملتي TON والدولار
• فحص ندرة الصفات والخصائص الجينية
• سجل أحدث الصفقات المشابهة المنفذة على الشبكة
• مؤشرات السيولة وسرعة التداول المتوقعة

تكلفة فتح التقرير الكامل: <b>رصيد تحليل واحد (1 Credit)</b>`
		btnUnlock = "🔓 فتح التقرير الكامل (1 رصيد)"
		btnExchange = fmt.Sprintf("🔄 تحويل %s عملة إلى 1 رصيد", formattedCost)
		btnStars = "⭐ شراء أرصدة عبر Stars"
		btnBack = "🔙 رجوع"

	case "ru":
		defaultGateText = `🔍 <b>Актив успешно распознан для анализа</b>

Категория: <b>{type}</b>
Идентификатор: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
🪙 <b>Баланс Airdrop монет:</b> <code>{coins}</code>
⚡ <b>Доступно кредитов (Intel Credits):</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔐 <b>Что входит в детальный отчет?</b>
• Справедливая оценка в TON и USD
• Анализ редкости характеристик и атрибутов
• История реальных сопоставимых сделок на рынке
• Метрики ликвидности и расчетное время продажи

Стоимость открытия полного отчета: <b>1 Intel Credit</b>`
		btnUnlock = "🔓 Открыть отчет (1 кредит)"
		btnExchange = fmt.Sprintf("🔄 Обменять %s монет на 1 кредит", formattedCost)
		btnStars = "⭐ Купить кредиты за Stars"
		btnBack = "🔙 Назад"

	case "zh":
		defaultGateText = `🔍 <b>已成功识别资产并准备评估</b>

资产类别: <b>{type}</b>
目标标识: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
🪙 <b>空投代币余额:</b> <code>{coins}</code>
⚡ <b>分析信用点 (Intel Credits):</b> <code>{credits}</code> 点
━━━━━━━━━━━━━━━━━━━

🔐 <b>深度专业分析报告包含内容:</b>
• 基于 TON 与美元的公允价值科学估算
• 基因特征稀缺度与等级百分比
• 全网最新真实撮合交易参照对比
• 市场流动性评级与预估出售周期

解锁完整深度报告仅需: <b>1 个分析信用点</b>`
		btnUnlock = "🔓 解锁专业分析报告 (1 信用点)"
		btnExchange = fmt.Sprintf("🔄 兑换 %s 代币为 1 信用点", formattedCost)
		btnStars = "⭐ 使用 Stars 购买信用点"
		btnBack = "🔙 返回"

	default:
		defaultGateText = `🔍 <b>Asset Identified for Deep Intelligence</b>

Asset Class: <b>{type}</b>
Identifier: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
🪙 <b>Airdrop Coins Balance:</b> <code>{coins}</code>
⚡ <b>Intel Credits Available:</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔐 <b>What's inside the deep intelligence report?</b>
• Fair value valuation in TON & USD
• Structural trait rarity breakdown & genetics
• Recent verified comparable on-chain sales
• Liquidity velocity & expected turnaround time

Unlock full report cost: <b>1 Intel Credit</b>`
		btnUnlock = "🔓 Unlock Full Report (1 Credit)"
		btnExchange = fmt.Sprintf("🔄 Exchange %s Coins for 1 Credit", formattedCost)
		btnStars = "⭐ Buy Credits with Stars"
		btnBack = "🔙 Back"
	}

	rawGate := h.resolveText(ctx, "precheck_gate", lang, defaultGateText)
	gateText = strings.ReplaceAll(rawGate, "{type}", assetNameFa)
	gateText = strings.ReplaceAll(gateText, "{entity}", telegram.EscapeHTML(entityDisplay))
	gateText = strings.ReplaceAll(gateText, "{coins}", fmt.Sprintf("%.1f", airdropCoins))
	gateText = strings.ReplaceAll(gateText, "{credits}", strconv.Itoa(intelCredits))
	gateText = strings.ReplaceAll(gateText, "{cost_coins}", formattedCost)

	btnUnlock = h.resolveButton(ctx, "btn_unlock", lang, btnUnlock)
	btnExchange = h.resolveButton(ctx, "btn_exchange", lang, btnExchange)
	btnStars = h.resolveButton(ctx, "btn_stars", lang, btnStars)
	btnBack = h.resolveButton(ctx, "btn_back", lang, btnBack)

	unlockCallback := fmt.Sprintf("unlock:%s:%s", assetType, entity)
	exchangeCallback := fmt.Sprintf("exchange:%s:%s", assetType, entity)
	starsCallback := fmt.Sprintf("stars_pack:%s:%s", assetType, entity)

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{
					"text":          btnUnlock,
					"callback_data": unlockCallback,
				},
			},
			{
				{
					"text":          btnExchange,
					"callback_data": exchangeCallback,
				},
			},
			{
				{
					"text":          btnStars,
					"callback_data": starsCallback,
				},
			},
			{
				{
					"text":          btnBack,
					"callback_data": "nav:menu",
				},
			},
		},
	}

	h.sendOrEditMessage(ctx, tg, chatID, messageID, gateText, markup, threadID)
}

// executeUnlockAndReport consumes 1 credit and produces the full rich appraisal
func (h *WebhookHandler) executeUnlockAndReport(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, assetType string, entity string, messageID *int, threadID *int) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	// Ensure intelCreditService is initialized
	if h.intelCreditService == nil && h.db != nil {
		h.intelCreditService = intelcredit.NewIntelCreditService(h.db)
	}

	if h.intelCreditService == nil {
		var serviceErrMsg string
		switch lang {
		case "fa":
			serviceErrMsg = "⚠️ سیستم اعتبارات در حال حاضر در دسترس نیست. لطفاً بعداً دوباره تلاش کنید."
		case "ru":
			serviceErrMsg = "⚠️ Сервис кредитов временно недоступен. Пожалуйста, попробуйте позже."
		case "zh":
			serviceErrMsg = "⚠️ 信用服务暂时不可用，请稍后重试。"
		default:
			serviceErrMsg = "⚠️ Credit service is temporarily unavailable. Please try again later."
		}
		if messageID != nil {
			_ = tg.EditMessageTextWithMarkup(ctx, chatID, *messageID, serviceErrMsg, nil)
		} else {
			_ = tg.SendMessage(ctx, chatID, serviceErrMsg, nil, threadID)
		}
		return
	}

	// 24-hour idempotent window key (re-checking the same asset within the same calendar day doesn't double-charge)
	idemKey := fmt.Sprintf("tg_report:%d:%s:%s:%s", userID, assetType, entity, time.Now().UTC().Format("2006-01-02"))
	_, err := h.intelCreditService.ConsumeCredit(ctx, userID, "asset_valuation", fmt.Sprintf("%s:%s", assetType, entity), idemKey)
	if err != nil {
		if !errors.Is(err, repository.ErrInsufficientIntelCredits) {
			slog.Error("Failed to consume intel credit for report unlock", "error", err, "user_id", userID, "asset_type", assetType, "entity", entity)
			var retryMsg, btnRetry string
			switch lang {
			case "fa":
				retryMsg = "⚠️ خطا در برقراری ارتباط با پایگاه داده اعتبارات. لطفاً چند لحظه دیگر دوباره تلاش فرمایید."
				btnRetry = "🔄 تلاش مجدد"
			case "ar":
				retryMsg = "⚠️ خطأ في الاتصال بقاعدة بيانات الأرصدة. يُرجى إعادة المحاولة بعد لحظات."
				btnRetry = "🔄 إعادة المحاولة"
			case "ru":
				retryMsg = "⚠️ Ошибка связи с базой данных кредитов. Пожалуйста, попробуйте еще раз."
				btnRetry = "🔄 Повторить"
			case "zh":
				retryMsg = "⚠️ 信用数据库连接错误，请稍后重试。"
				btnRetry = "🔄 重试"
			default:
				retryMsg = "⚠️ Database error processing credits. Please try again in a few moments."
				btnRetry = "🔄 Retry"
			}
			retryMarkup := map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{
						{
							"text":          btnRetry,
							"callback_data": fmt.Sprintf("unlock:%s:%s", assetType, entity),
						},
					},
					{
						{
							"text":          "🔙",
							"callback_data": fmt.Sprintf("precheck:%s:%s", assetType, entity),
						},
					},
				},
			}
			h.sendOrEditMessage(ctx, tg, chatID, messageID, retryMsg, retryMarkup, threadID)
			return
		}

		var errMsg string
		var btnExchange, btnStars, btnBack string
		costCoins := config.Economics.CreditsCoinsPerCredit
		formattedCost := formatNumberWithCommas(costCoins)

		switch lang {
		case "fa":
			errMsg = "⚠️ <b>اعتبار تحلیلی کافی ندارید!</b>\n\nشما به حداقل <b>۱ کریدت تحلیلی</b> برای مشاهده این گزارش نیاز دارید. می‌توانید سکه‌های ایردراپ خود را تبدیل کنید یا با تلگرام استارز کریدت تهیه نمایید."
			btnExchange = fmt.Sprintf("🔄 تبدیل %s سکه به کریدت", formattedCost)
			btnStars = "⭐ خرید با Stars"
			btnBack = "🔙 بازگشت"
		case "ar":
			errMsg = "⚠️ <b>رصيد التحليل غير كافٍ!</b>\n\nتحتاج إلى <b>رصيد تحليل واحد (1 Intel Credit)</b> على الأقل لعرض هذا التقرير. يمكنك تحويل عملات الإنزال الجوي أو شراء أرصدة عبر Telegram Stars."
			btnExchange = fmt.Sprintf("🔄 تحويل %s عملة إلى رصيد", formattedCost)
			btnStars = "⭐ شراء عبر Stars"
			btnBack = "🔙 رجوع"
		case "ru":
			errMsg = "⚠️ <b>Недостаточно кредитов (Intel Credits)!</b>\n\nДля просмотра этого отчета необходим минимум <b>1 кредит</b>. Вы можете обменять Airdrop монеты или приобрести кредиты через Telegram Stars."
			btnExchange = fmt.Sprintf("🔄 Обменять %s монет", formattedCost)
			btnStars = "⭐ Купить за Stars"
			btnBack = "🔙 Назад"
		case "zh":
			errMsg = "⚠️ <b>分析信用点不足！</b>\n\n查看此深度报告需要至少 <b>1 个分析信用点</b>。您可以使用空投代币兑换，或通过 Telegram Stars 购买点数包。"
			btnExchange = fmt.Sprintf("🔄 兑换 %s 代币", formattedCost)
			btnStars = "⭐ 使用 Stars 购买"
			btnBack = "🔙 返回"
		default:
			errMsg = "⚠️ <b>Insufficient Intel Credits!</b>\n\nYou need at least <b>1 Intel Credit</b> to view this report. Exchange coins or purchase credits via Stars."
			btnExchange = fmt.Sprintf("🔄 Exchange %s Coins", formattedCost)
			btnStars = "⭐ Buy with Stars"
			btnBack = "🔙 Back"
		}

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text":          btnExchange,
						"callback_data": fmt.Sprintf("exchange:%s:%s", assetType, entity),
					},
				},
				{
					{
						"text":          btnStars,
						"callback_data": fmt.Sprintf("stars_pack:%s:%s", assetType, entity),
					},
				},
				{
					{
						"text":          btnBack,
						"callback_data": fmt.Sprintf("precheck:%s:%s", assetType, entity),
					},
				},
			},
		}
		h.sendOrEditMessage(ctx, tg, chatID, messageID, errMsg, markup, threadID)
		return
	}

	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		if bot != nil && bot.BotUsername != "" {
			miniAppURL = fmt.Sprintf("https://t.me/%s/iFragment", bot.BotUsername)
		} else {
			miniAppURL = "https://t.me/iFragmentBot/iFragment"
		}
	}

	// Route valuation based on asset type
	switch assetType {
	case "username":
		h.renderUsernameReport(ctx, tg, chatID, userID, entity, miniAppURL, lang, messageID, threadID)
	case "number":
		h.renderNumberReport(ctx, tg, chatID, userID, entity, miniAppURL, lang, messageID, threadID)
	case "gift":
		h.renderGiftReport(ctx, tg, chatID, userID, entity, miniAppURL, lang, messageID, threadID)
	default:
		h.sendMainMenu(ctx, bot, chatID, userID, "", messageID, threadID)
	}
}

// renderUsernameReport produces rich analytical valuation of a username
func (h *WebhookHandler) renderUsernameReport(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, _ int64, username string, miniAppURL string, lang string, messageID *int, threadID *int) {
	normUser := strings.TrimPrefix(strings.ToLower(username), "@")
	appURL := fmt.Sprintf("%s?startapp=val_%s", miniAppURL, normUser)

	var res *avm.ValuationResult
	var tier string = "STANDARD"
	var expectedTONStr string = "0.0"
	var expectedUSDStr string = "0"
	var brandability int = 50

	if h.avmService != nil {
		if valRes, err := h.avmService.Valuate(ctx, normUser, 0); err == nil && valRes != nil {
			res = valRes
			tier = res.InvestmentGrade
			expectedTONStr = res.ExpectedTON.StringFixed(1)
			expectedUSDStr = res.ExpectedUSD.StringFixed(0)
			brandability = res.Brandability
		}
	}

	richHTML := buildUsernameRichHTML(normUser, res, lang)
	standardHTML := buildUsernameStandardHTML(normUser, res, lang)

	var extraInfo string
	switch normalizeLang(lang) {
	case "fa":
		extraInfo = fmt.Sprintf("درجه: %s | برندپذیری: %d/100", tier, brandability)
	case "ru":
		extraInfo = fmt.Sprintf("Грейд: %s | Бренд: %d/100", tier, brandability)
	case "zh":
		extraInfo = fmt.Sprintf("评级: %s | 品牌指数: %d/100", tier, brandability)
	default:
		extraInfo = fmt.Sprintf("Grade: %s | Brandability: %d/100", tier, brandability)
	}

	copySummary := buildCopySummary("🏷️", "@"+normUser, expectedTONStr, expectedUSDStr, extraInfo, lang)
	markup := buildUsernameMarkup(normUser, appURL, copySummary, lang)

	// Hybrid Visual Card + Rich Message Delivery
	if h.cardGen != nil && tg != nil {
		if pngBytes, err := h.cardGen.GenerateUsernameCardLang(normUser, tier, expectedTONStr, expectedUSDStr, lang); err == nil {
			if fileID, err := h.cardGen.SaveCard(pngBytes); err == nil {
				publicURL := h.cardGen.GetPublicCardURL(fileID, nil)
				var photoCaption string
				switch normalizeLang(lang) {
				case "fa":
					photoCaption = fmt.Sprintf("🏷️ <b>کارت تحلیلی: @%s</b>\n💰 برآورد منصفانه: <b>~%s TON ($%s)</b>\n💎 درجه سرمایه‌گذاری: <b>%s</b>", normUser, expectedTONStr, expectedUSDStr, tier)
				case "ru":
					photoCaption = fmt.Sprintf("🏷️ <b>Карта оценки: @%s</b>\n💰 Справедливая цена: <b>~%s TON ($%s)</b>\n💎 Инвест-грейд: <b>%s</b>", normUser, expectedTONStr, expectedUSDStr, tier)
				case "zh":
					photoCaption = fmt.Sprintf("🏷️ <b>估值分析卡: @%s</b>\n💰 预估公允价值: <b>~%s TON ($%s)</b>\n💎 投资评级: <b>%s</b>", normUser, expectedTONStr, expectedUSDStr, tier)
				default:
					photoCaption = fmt.Sprintf("🏷️ <b>Valuation Card: @%s</b>\n💰 Fair Value: <b>~%s TON ($%s)</b>\n💎 Investment Grade: <b>%s</b>", normUser, expectedTONStr, expectedUSDStr, tier)
				}
				if messageID != nil {
					_ = tg.DeleteMessage(ctx, chatID, *messageID)
				}
				_, _ = tg.SendPhoto(ctx, chatID, publicURL, photoCaption)
				if _, err := tg.SendRichMessageWithMarkup(ctx, chatID, map[string]interface{}{"html": richHTML}, markup, threadID); err != nil {
					_, _ = tg.SendMessageWithMarkup(ctx, chatID, standardHTML, markup, threadID)
				}
				return
			}
		}
	}

	if messageID != nil {
		if err := tg.EditRichMessageWithMarkup(ctx, chatID, *messageID, map[string]interface{}{"html": richHTML}, markup); err != nil {
			_ = tg.EditMessageTextWithMarkup(ctx, chatID, *messageID, standardHTML, markup)
		}
	} else {
		if _, err := tg.SendRichMessageWithMarkup(ctx, chatID, map[string]interface{}{"html": richHTML}, markup, threadID); err != nil {
			_, _ = tg.SendMessageWithMarkup(ctx, chatID, standardHTML, markup, threadID)
		}
	}
}

// renderNumberReport produces rich analytical valuation of a +888 number
func (h *WebhookHandler) renderNumberReport(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, userID int64, number string, miniAppURL string, lang string, messageID *int, threadID *int) {
	cleanNum := features.CleanNumber(number)
	displayNum := number
	appURL := fmt.Sprintf("%s?startapp=num_%s", miniAppURL, cleanNum)

	var club string = "کلکسیونی"
	var globalRank int = 0
	var tonStr string = "0.0"
	var usdStr string = "0"
	var val *nvengine.NumberValuation

	if h.numbersService != nil {
		if v, err := h.numbersService.ValuateNumber(ctx, userID, number); err == nil && v != nil {
			val = v
			displayNum = val.DisplayNumber
			cleanNum = features.CleanNumber(val.DisplayNumber)
			club = val.CategoryClubFa
			if club == "" {
				club = val.CategoryClub
			}
			globalRank = val.GlobalRank
			tonStr = val.ExpectedTON.StringFixed(1)
			usdStr = fmt.Sprintf("%.0f", val.ExpectedUSD)
		}
	}

	richHTML := buildNumberRichHTML(val, lang)
	standardHTML := buildNumberStandardHTML(val, displayNum, lang)

	var extraInfo string
	switch normalizeLang(lang) {
	case "fa":
		extraInfo = fmt.Sprintf("کلوپ: %s | رتبه: #%d", club, globalRank)
	case "ru":
		extraInfo = fmt.Sprintf("Клуб: %s | Ранг: #%d", club, globalRank)
	case "zh":
		extraInfo = fmt.Sprintf("俱乐部: %s | 排名: #%d", club, globalRank)
	default:
		extraInfo = fmt.Sprintf("Club: %s | Rank: #%d", club, globalRank)
	}

	copySummary := buildCopySummary("📱", displayNum, tonStr, usdStr, extraInfo, lang)
	markup := buildNumberMarkup(cleanNum, displayNum, appURL, copySummary, lang)

	// Hybrid Visual Card + Rich Message Delivery
	if h.cardGen != nil && tg != nil {
		if pngBytes, err := h.cardGen.GenerateNumberCardLang(displayNum, club, globalRank, tonStr, usdStr, lang); err == nil {
			if fileID, err := h.cardGen.SaveCard(pngBytes); err == nil {
				publicURL := h.cardGen.GetPublicCardURL(fileID, nil)
				var photoCaption string
				switch normalizeLang(lang) {
				case "fa":
					photoCaption = fmt.Sprintf("📱 <b>کارت تحلیلی شماره: %s</b>\n👑 کلوپ: <b>%s</b> (#%d)\n💰 ارزش منصفانه: <b>~%s TON ($%s)</b>", displayNum, club, globalRank, tonStr, usdStr)
				case "ru":
					photoCaption = fmt.Sprintf("📱 <b>Карта оценки номера: %s</b>\n👑 Клуб: <b>%s</b> (#%d)\n💰 Справедливая цена: <b>~%s TON ($%s)</b>", displayNum, club, globalRank, tonStr, usdStr)
				case "zh":
					photoCaption = fmt.Sprintf("📱 <b>号码估值卡: %s</b>\n👑 俱乐部: <b>%s</b> (#%d)\n💰 公允价值: <b>~%s TON ($%s)</b>", displayNum, club, globalRank, tonStr, usdStr)
				default:
					photoCaption = fmt.Sprintf("📱 <b>Number Valuation Card: %s</b>\n👑 Club: <b>%s</b> (#%d)\n💰 Fair Value: <b>~%s TON ($%s)</b>", displayNum, club, globalRank, tonStr, usdStr)
				}
				if messageID != nil {
					_ = tg.DeleteMessage(ctx, chatID, *messageID)
				}
				_, _ = tg.SendPhoto(ctx, chatID, publicURL, photoCaption)
				if _, err := tg.SendRichMessageWithMarkup(ctx, chatID, map[string]interface{}{"html": richHTML}, markup, threadID); err != nil {
					_, _ = tg.SendMessageWithMarkup(ctx, chatID, standardHTML, markup, threadID)
				}
				return
			}
		}
	}

	if messageID != nil {
		if err := tg.EditRichMessageWithMarkup(ctx, chatID, *messageID, map[string]interface{}{"html": richHTML}, markup); err != nil {
			_ = tg.EditMessageTextWithMarkup(ctx, chatID, *messageID, standardHTML, markup)
		}
	} else {
		if _, err := tg.SendRichMessageWithMarkup(ctx, chatID, map[string]interface{}{"html": richHTML}, markup, threadID); err != nil {
			_, _ = tg.SendMessageWithMarkup(ctx, chatID, standardHTML, markup, threadID)
		}
	}
}

// renderGiftReport produces rich appraisal for gifts
func (h *WebhookHandler) renderGiftReport(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, _ int64, giftSlug string, miniAppURL string, lang string, messageID *int, threadID *int) {
	if h.giftsService != nil {
		appraisal, err := h.giftsService.GetBotGiftAppraisal(ctx, giftSlug)
		if err == nil && appraisal != nil {
			richHTML := buildGiftRichHTML(appraisal, lang)
			standardText, _ := h.formatGiftAppraisalMessage(appraisal, miniAppURL, lang)

			tonStr := fmt.Sprintf("%.1f", appraisal.Pillars.FairValueGRAM)
			usdStr := fmt.Sprintf("%.0f", appraisal.ExpectedUSD)
			rarityTier := appraisal.JointRarity.RarityClass
			if normalizeLang(lang) == "fa" && appraisal.JointRarity.DescriptionFa != "" {
				rarityTier = appraisal.JointRarity.DescriptionFa
			}
			if rarityTier == "" {
				rarityTier = "Collectible"
			}

			var extraInfo string
			switch normalizeLang(lang) {
			case "fa":
				extraInfo = fmt.Sprintf("رده: %s | سریال: #%d", rarityTier, appraisal.SerialNumber)
			case "ru":
				extraInfo = fmt.Sprintf("Класс: %s | Серия: #%d", rarityTier, appraisal.SerialNumber)
			case "zh":
				extraInfo = fmt.Sprintf("评级: %s | 编号: #%d", rarityTier, appraisal.SerialNumber)
			default:
				extraInfo = fmt.Sprintf("Tier: %s | Serial: #%d", rarityTier, appraisal.SerialNumber)
			}

			copySummary := buildCopySummary("🎁", appraisal.DisplayTitle, tonStr, usdStr, extraInfo, lang)
			markup := buildGiftMarkup(appraisal, miniAppURL, copySummary, lang)

			// Hybrid Visual Card + Rich Message Delivery
			if h.cardGen != nil && tg != nil {
				if pngBytes, err := h.cardGen.GenerateGiftCardLang(appraisal.DisplayTitle, appraisal.GiftID, appraisal.SerialNumber, rarityTier, tonStr, usdStr, lang); err == nil {
					if fileID, err := h.cardGen.SaveCard(pngBytes); err == nil {
						publicURL := h.cardGen.GetPublicCardURL(fileID, nil)
						var photoCaption string
						switch normalizeLang(lang) {
						case "fa":
							photoCaption = fmt.Sprintf("🎁 <b>کارت تحلیلی: %s</b>\n💎 رده: <b>%s</b>\n💰 برآورد منصفانه: <b>~%s TON ($%s)</b>", appraisal.DisplayTitle, rarityTier, tonStr, usdStr)
						case "ru":
							photoCaption = fmt.Sprintf("🎁 <b>Карта оценки подарка: %s</b>\n💎 Класс: <b>%s</b>\n💰 Справедливая цена: <b>~%s TON ($%s)</b>", appraisal.DisplayTitle, rarityTier, tonStr, usdStr)
						case "zh":
							photoCaption = fmt.Sprintf("🎁 <b>礼物估值卡: %s</b>\n💎 评级: <b>%s</b>\n💰 公允价值: <b>~%s TON ($%s)</b>", appraisal.DisplayTitle, rarityTier, tonStr, usdStr)
						default:
							photoCaption = fmt.Sprintf("🎁 <b>Gift Valuation Card: %s</b>\n💎 Tier: <b>%s</b>\n💰 Fair Value: <b>~%s TON ($%s)</b>", appraisal.DisplayTitle, rarityTier, tonStr, usdStr)
						}
						if messageID != nil {
							_ = tg.DeleteMessage(ctx, chatID, *messageID)
						}
						_, _ = tg.SendPhoto(ctx, chatID, publicURL, photoCaption)
						if _, err := tg.SendRichMessageWithMarkup(ctx, chatID, map[string]interface{}{"html": richHTML}, markup, threadID); err != nil {
							_, _ = tg.SendMessageWithMarkup(ctx, chatID, standardText, markup, threadID)
						}
						return
					}
				}
			}

			if messageID != nil {
				if err := tg.EditRichMessageWithMarkup(ctx, chatID, *messageID, map[string]interface{}{"html": richHTML}, markup); err != nil {
					_ = tg.EditMessageTextWithMarkup(ctx, chatID, *messageID, standardText, markup)
				}
			} else {
				if _, err := tg.SendRichMessageWithMarkup(ctx, chatID, map[string]interface{}{"html": richHTML}, markup, threadID); err != nil {
					_, _ = tg.SendMessageWithMarkup(ctx, chatID, standardText, markup, threadID)
				}
			}
			return
		}
	}

	var notFoundText string
	switch normalizeLang(lang) {
	case "fa":
		notFoundText = fmt.Sprintf("🎁 <b>کارشناسی گیفت تلگرام: %s</b>\n\nبرای مشاهده تحلیل زنده بازار و کمیابی صفات به مینی‌اپ مراجعه کنید.", telegram.EscapeHTML(giftSlug))
	case "ru":
		notFoundText = fmt.Sprintf("🎁 <b>Оценка подарка: %s</b>\n\nДля полного анализа рынка и атрибутов перейдите в Mini App.", telegram.EscapeHTML(giftSlug))
	case "zh":
		notFoundText = fmt.Sprintf("🎁 <b>Telegram 礼物估值: %s</b>\n\n请在小程序中查看实时市场与稀缺度深度分析。", telegram.EscapeHTML(giftSlug))
	default:
		notFoundText = fmt.Sprintf("🎁 <b>Telegram Gift Valuation: %s</b>\n\nOpen the Mini App to view live market intelligence and trait rarities.", telegram.EscapeHTML(giftSlug))
	}

	var btnMiniApp, btnBack string
	switch normalizeLang(lang) {
	case "fa":
		btnMiniApp = "📊 مشاهده در مینی‌اپ"
		btnBack = "🔙 بازگشت به منو"
	case "ru":
		btnMiniApp = "📊 Открыть в Mini App"
		btnBack = "🔙 Назад в меню"
	case "zh":
		btnMiniApp = "📊 在小程序中查看"
		btnBack = "🔙 返回菜单"
	default:
		btnMiniApp = "📊 View in Mini App"
		btnBack = "🔙 Back to Menu"
	}

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": btnMiniApp, "url": miniAppURL},
			},
			{
				{"text": btnBack, "callback_data": "nav:menu"},
			},
		},
	}
	if messageID != nil {
		_ = tg.EditMessageTextWithMarkup(ctx, chatID, *messageID, notFoundText, markup)
	} else {
		_, _ = tg.SendMessageWithMarkup(ctx, chatID, notFoundText, markup, threadID)
	}
}


// sendExchangeConfirmView displays an explicit institutional confirmation screen before converting 150,000 Airdrop Coins into 1 Intel Credit.
func (h *WebhookHandler) sendExchangeConfirmView(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, returnAssetType string, returnEntity string, messageID *int, threadID *int) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	var airdropCoins float64 = 0
	var intelCredits int = 0
	if h.profileService != nil {
		stats, err := h.profileService.GetStats(ctx, userID)
		if err == nil && stats != nil {
			airdropCoins = stats.AirdropCoins
			intelCredits = stats.IntelCredits
		}
	}

	costCoins := config.Economics.CreditsCoinsPerCredit
	formattedCost := formatNumberWithCommas(costCoins)
	formattedBalance := formatNumberWithCommas(int(airdropCoins))

	remainingCoins := airdropCoins - float64(costCoins)
	var formattedRemaining string
	if remainingCoins >= 0 {
		formattedRemaining = formatNumberWithCommas(int(remainingCoins)) + " سکه"
	} else {
		formattedRemaining = fmt.Sprintf("⚠️ کسری %s سکه", formatNumberWithCommas(int(-remainingCoins)))
	}

	var text, btnConfirm, btnCancel string
	switch lang {
	case "fa":
		text = fmt.Sprintf(`<tg-emoji emoji-id="%s">🔄</tg-emoji> <b>تأیید تبدیل سکه به کریدت تحلیلی | Confirmation</b>

آیا مطمئن هستید که می‌خواهید <b>%s سکه ایردراپ</b> را به <b>۱ کریدت تحلیلی (Intel Credit)</b> تبدیل کنید؟

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="%s">🪙</tg-emoji> <b>هزینه تبدیل:</b> <code>%s</code> سکه
<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>دریافتی شما:</b> <code>+1</code> کریدت تحلیلی
💰 <b>موجودی فعلی سکه شما:</b> <code>%s</code> سکه
📊 <b>موجودی فعلی کریدت:</b> <code>%d</code> کریدت
📉 <b>موجودی پس از کسر:</b> <code>%s</code>
━━━━━━━━━━━━━━━━━━━
<i>ℹ️ نکته: با هر کریدت تحلیلی می‌توانید یک گزارش کامل و موشکافانه از ارزش‌گذاری، ریسک برند و کمیابی صفات دارایی‌های تلگرام را در ربات بازگشایی نمایید.</i>`,
			CustomEmojiRefresh, formattedCost,
			CustomEmojiCoin, formattedCost,
			CustomEmojiBolt,
			formattedBalance,
			intelCredits,
			formattedRemaining)

		btnConfirm = fmt.Sprintf("✅ بله، تبدیل کن (%s سکه)", formattedCost)
		btnCancel = "❌ انصراف / بازگشت"

	case "ar":
		text = fmt.Sprintf(`<tg-emoji emoji-id="%s">🔄</tg-emoji> <b>تأكيد تحويل العملات إلى رصيد تحليلي | Confirmation</b>

هل أنت متأكد من رغبتك في تحويل <b>%s عملة إنزال</b> إلى <b>رصيد تحليل واحد (1 Intel Credit)</b>؟

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="%s">🪙</tg-emoji> <b>تكلفة التحويل:</b> <code>%s</code> عملة
<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>ما ستحصل عليه:</b> <code>+1</code> رصيد تحليلي
💰 <b>رصيدك الحالي من العملات:</b> <code>%s</code> عملة
📊 <b>رصيدك الحالي من الأرصدة:</b> <code>%d</code> رصيد
📉 <b>الرصيد بعد الخصم:</b> <code>%s</code>
━━━━━━━━━━━━━━━━━━━
<i>ℹ️ ملاحظة: يتيح لك كل رصيد تحليلي فتح تقرير شامل ومفصل لتقييم الأصول ونسبة ندرتها في تيليجرام.</i>`,
			CustomEmojiRefresh, formattedCost,
			CustomEmojiCoin, formattedCost,
			CustomEmojiBolt,
			formattedBalance,
			intelCredits,
			formattedRemaining)

		btnConfirm = fmt.Sprintf("✅ نعم، قم بالتحويل (%s عملة)", formattedCost)
		btnCancel = "❌ إلغاء / رجوع"

	case "ru":
		text = fmt.Sprintf(`<tg-emoji emoji-id="%s">🔄</tg-emoji> <b>Подтверждение обмена монет | Confirmation</b>

Вы уверены, что хотите обменять <b>%s Airdrop монет</b> на <b>1 аналитический кредит (Intel Credit)</b>?

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="%s">🪙</tg-emoji> <b>Стоимость обмена:</b> <code>%s</code> монет
<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>Вы получите:</b> <code>+1</code> Intel Credit
💰 <b>Текущий баланс монет:</b> <code>%s</code>
📊 <b>Текущие кредиты:</b> <code>%d</code>
📉 <b>Баланс после списания:</b> <code>%s</code>
━━━━━━━━━━━━━━━━━━━
<i>ℹ️ Кредиты позволяют открывать полные отчеты по оценке стоимости и редкости активов Telegram.</i>`,
			CustomEmojiRefresh, formattedCost,
			CustomEmojiCoin, formattedCost,
			CustomEmojiBolt,
			formattedBalance,
			intelCredits,
			formattedRemaining)

		btnConfirm = fmt.Sprintf("✅ Да, обменять (%s)", formattedCost)
		btnCancel = "❌ Отмена"

	case "zh":
		text = fmt.Sprintf(`<tg-emoji emoji-id="%s">🔄</tg-emoji> <b>代币兑换确认 | Confirmation</b>

您确定要将 <b>%s 枚空投代币</b> 兑换为 <b>1 个分析信用点 (Intel Credit)</b> 吗？

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="%s">🪙</tg-emoji> <b>兑换扣除:</b> <code>%s</code> 代币
<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>获得信用点:</b> <code>+1</code> 点
💰 <b>当前代币余额:</b> <code>%s</code>
📊 <b>当前信用点:</b> <code>%d</code>
📉 <b>兑换后代币余额:</b> <code>%s</code>
━━━━━━━━━━━━━━━━━━━
<i>ℹ️ 每个分析信用点可解锁一份关于 Telegram 资产稀缺度与市场估值的专业报告。</i>`,
			CustomEmojiRefresh, formattedCost,
			CustomEmojiCoin, formattedCost,
			CustomEmojiBolt,
			formattedBalance,
			intelCredits,
			formattedRemaining)

		btnConfirm = fmt.Sprintf("✅ 确认兑换 (%s 代币)", formattedCost)
		btnCancel = "❌ 取消返回"

	default:
		text = fmt.Sprintf(`<tg-emoji emoji-id="%s">🔄</tg-emoji> <b>Exchange Confirmation</b>

Are you sure you want to exchange <b>%s Airdrop Coins</b> for <b>1 Intel Credit</b>?

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="%s">🪙</tg-emoji> <b>Exchange Cost:</b> <code>%s</code> Coins
<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>Credits Received:</b> <code>+1</code> Intel Credit
💰 <b>Current Coin Balance:</b> <code>%s</code>
📊 <b>Current Credits:</b> <code>%d</code>
📉 <b>Balance After Deduction:</b> <code>%s</code>
━━━━━━━━━━━━━━━━━━━
<i>ℹ️ Intel Credits unlock institutional valuations and rarity metrics for Telegram digital assets.</i>`,
			CustomEmojiRefresh, formattedCost,
			CustomEmojiCoin, formattedCost,
			CustomEmojiBolt,
			formattedBalance,
			intelCredits,
			formattedRemaining)

		btnConfirm = fmt.Sprintf("✅ Yes, Exchange (%s Coins)", formattedCost)
		btnCancel = "❌ Cancel / Back"
	}

	btnCancel = h.resolveButton(ctx, "btn_back", lang, btnCancel)

	text = h.resolveText(ctx, "exchange_confirm", lang, text)
	text = strings.ReplaceAll(text, "{coins}", formattedBalance)
	text = strings.ReplaceAll(text, "{credits}", fmt.Sprintf("%d", intelCredits))
	text = strings.ReplaceAll(text, "{cost_coins}", formattedCost)

	confirmCallback := fmt.Sprintf("confirm_exchange:%s:%s", returnAssetType, returnEntity)
	if returnAssetType == "" && returnEntity == "" {
		confirmCallback = "confirm_exchange:profile"
	}

	backCallback := "nav:profile"
	if returnAssetType != "" && returnEntity != "" {
		backCallback = fmt.Sprintf("precheck:%s:%s", returnAssetType, returnEntity)
	}

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{
					"text":          btnConfirm,
					"callback_data": confirmCallback,
				},
			},
			{
				{
					"text":          btnCancel,
					"callback_data": backCallback,
				},
			},
		},
	}

	h.sendOrEditMessage(ctx, tg, chatID, messageID, text, markup, threadID)
}

// handleCreditExchange converts user's airdrop coins into 1 Intel Credit and updates view
func (h *WebhookHandler) handleCreditExchange(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, returnAssetType string, returnEntity string, messageID *int, threadID *int) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	costCoins := config.Economics.CreditsCoinsPerCredit
	formattedCost := formatNumberWithCommas(costCoins)

	storeSvc := h.intelStoreService
	if storeSvc == nil {
		storeSvc = intelcredit.NewStoreService(h.db)
	}

	newBalance, err := storeSvc.ExchangeCoins(ctx, userID)
	var failMsg string
	var succMsg string
	var btnStars, btnBack, btnUnlock, btnProfile string

	switch lang {
	case "fa":
		failMsg = fmt.Sprintf(`<tg-emoji emoji-id="%s">❌</tg-emoji> <b>موجودی سکه کافی نیست!</b>

برای تبدیل به ۱ اعتبار تحلیلی، حداقل <b>%s سکه ایردراپ</b> مورد نیاز است. شما می‌توانید با تسک‌ها و فعالیت در مینی‌اپ سکه کسب کنید یا از بسته‌های تلگرام استارز استفاده نمایید.`,
			CustomEmojiCross, formattedCost)
		succMsg = fmt.Sprintf(`<tg-emoji emoji-id="%s">✅</tg-emoji> <b>تبدیل سکه با موفقیت انجام شد!</b>

تعداد <b>%s سکه ایردراپ</b> با موفقیت کسر شد و ۱ کریدت تحلیلی به حسابتان اضافه گردید.
⚡ موجودی فعلی شما: <b>%d کریدت تحلیلی</b>`,
			CustomEmojiCheck, formattedCost, newBalance)
		btnStars = "⭐ خرید کریدت با Telegram Stars"
		btnBack = "🔙 بازگشت به منو"
		btnUnlock = "🔓 باز کردن گزارش هم‌اکنون"
		btnProfile = "👤 مشاهده پروفایل"
	case "ar":
		failMsg = fmt.Sprintf(`<tg-emoji emoji-id="%s">❌</tg-emoji> <b>رصيد العملات غير كافٍ!</b>

لتحويل 1 رصيد تحليل، تحتاج إلى <b>%s عملة إنزال جوي</b> على الأقل. يمكنك كسب العملات عبر إنجاز المهام في التطبيق المصغر أو شراء الأرصدة عبر Stars.`,
			CustomEmojiCross, formattedCost)
		succMsg = fmt.Sprintf(`<tg-emoji emoji-id="%s">✅</tg-emoji> <b>تم تحويل العملات بنجاح!</b>

تم خصم <b>%s عملة</b> وإضافة 1 رصيد تحليل إلى حسابك.
⚡ رصيدك الحالي: <b>%d رصيد تحليلي</b>.`,
			CustomEmojiCheck, formattedCost, newBalance)
		btnStars = "⭐ شراء أرصدة عبر Telegram Stars"
		btnBack = "🔙 العودة للقائمة"
		btnUnlock = "🔓 فتح التقرير الآن"
		btnProfile = "👤 الملف الشخصي"
	case "ru":
		failMsg = fmt.Sprintf(`<tg-emoji emoji-id="%s">❌</tg-emoji> <b>Недостаточно монет!</b>

Для обмена на 1 аналитический кредит требуется минимум <b>%s Airdrop монет</b>. Вы можете заработать монеты в приложении или купить кредиты за Stars.`,
			CustomEmojiCross, formattedCost)
		succMsg = fmt.Sprintf(`<tg-emoji emoji-id="%s">✅</tg-emoji> <b>Обмен успешно выполнен!</b>

Списано <b>%s монет</b> и начислен 1 кредит.
⚡ Текущий баланс: <b>%d кредитов</b>.`,
			CustomEmojiCheck, formattedCost, newBalance)
		btnStars = "⭐ Купить за Telegram Stars"
		btnBack = "🔙 Назад"
		btnUnlock = "🔓 Открыть отчет сейчас"
		btnProfile = "👤 Мой профиль"
	case "zh":
		failMsg = fmt.Sprintf(`<tg-emoji emoji-id="%s">❌</tg-emoji> <b>代币余额不足！</b>

兑换 1 个分析信用点需要至少 <b>%s 枚空投代币</b>。您可以通过在小程序完成任务获取代币，或直接使用 Telegram Stars 购买点数。`,
			CustomEmojiCross, formattedCost)
		succMsg = fmt.Sprintf(`<tg-emoji emoji-id="%s">✅</tg-emoji> <b>代币兑换成功！</b>

已扣除 <b>%s 枚代币</b> 并到账 1 个分析信用点。
⚡ 当前可用信用点: <b>%d 点</b>。`,
			CustomEmojiCheck, formattedCost, newBalance)
		btnStars = "⭐ 使用 Telegram Stars 购买"
		btnBack = "🔙 返回"
		btnUnlock = "🔓 立即查看分析报告"
		btnProfile = "👤 个人中心"
	default:
		failMsg = fmt.Sprintf(`<tg-emoji emoji-id="%s">❌</tg-emoji> <b>Insufficient Coins!</b>

You need at least <b>%s Airdrop Coins</b> to exchange for 1 Intel Credit.`,
			CustomEmojiCross, formattedCost)
		succMsg = fmt.Sprintf(`<tg-emoji emoji-id="%s">✅</tg-emoji> <b>Exchange Successful!</b>

Deducted <b>%s coins</b>. 1 Intel Credit added.
⚡ Current balance: <b>%d Credits</b>.`,
			CustomEmojiCheck, formattedCost, newBalance)
		btnStars = "⭐ Buy with Telegram Stars"
		btnBack = "🔙 Back"
		btnUnlock = "🔓 Unlock Report Now"
		btnProfile = "👤 Profile"
	}

	btnStars = h.resolveButton(ctx, "btn_stars", lang, btnStars)
	btnBack = h.resolveButton(ctx, "btn_back", lang, btnBack)
	btnUnlock = h.resolveButton(ctx, "btn_unlock", lang, btnUnlock)
	btnProfile = h.resolveButton(ctx, "btn_profile", lang, btnProfile)

	failMsg = h.resolveText(ctx, "exchange_fail", lang, failMsg)
	failMsg = strings.ReplaceAll(failMsg, "{cost_coins}", formattedCost)

	succMsg = h.resolveText(ctx, "exchange_success", lang, succMsg)
	succMsg = strings.ReplaceAll(succMsg, "{cost_coins}", formattedCost)
	succMsg = strings.ReplaceAll(succMsg, "{credits}", fmt.Sprintf("%d", newBalance))

	if err != nil {
		backCallback := "nav:menu"
		if returnAssetType != "" && returnEntity != "" {
			backCallback = fmt.Sprintf("precheck:%s:%s", returnAssetType, returnEntity)
		} else {
			backCallback = "nav:profile"
		}

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text":          btnStars,
						"callback_data": fmt.Sprintf("stars_pack:%s:%s", returnAssetType, returnEntity),
					},
				},
				{
					{
						"text":          btnBack,
						"callback_data": backCallback,
					},
				},
			},
		}
		h.sendOrEditMessage(ctx, tg, chatID, messageID, failMsg, markup, threadID)
		return
	}

	var markup map[string]interface{}
	if returnAssetType != "" && returnEntity != "" {
		markup = map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text":          btnUnlock,
						"callback_data": fmt.Sprintf("unlock:%s:%s", returnAssetType, returnEntity),
					},
				},
				{
					{
						"text":          btnBack,
						"callback_data": "nav:menu",
					},
				},
			},
		}
	} else {
		markup = map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text":          btnProfile,
						"callback_data": "nav:profile",
					},
				},
				{
					{
						"text":          btnBack,
						"callback_data": "nav:menu",
					},
				},
			},
		}
	}

	h.sendOrEditMessage(ctx, tg, chatID, messageID, succMsg, markup, threadID)
}

// sendStarsPacksList shows available credit packs to purchase with Telegram Stars
func (h *WebhookHandler) sendStarsPacksList(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, returnAssetType string, returnEntity string, messageID *int, threadID *int) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	packs := intelcredit.Packs()

	var text string
	var bonusText, backText string
	switch lang {
	case "fa":
		text = `⭐ <b>خرید اعتبار تحلیلی (Intel Credits) با تلگرام استارز</b>

با اعتبار تحلیلی می‌توانید در هر زمان گزارش موشکافانه قیمت، کمیابی صفات و سیگنال‌های بازار را برای هر دارایی تلگرام باز کنید.

لطفاً بسته مورد نظرتان را انتخاب کنید:`
		bonusText = "+%d هدیه"
		backText = "🔙 بازگشت"
	case "ru":
		text = `⭐ <b>Покупка аналитических кредитов (Intel Credits) за Stars</b>

Кредиты позволяют открывать детальные институциональные отчеты по оценке стоимости и редкости активов Telegram.

Выберите подходящий пакет кредитов:`
		bonusText = "+%d бонус"
		backText = "🔙 Назад"
	case "zh":
		text = `⭐ <b>使用 Telegram Stars 购买分析信用点</b>

分析信用点可随时解锁关于用户名、+888 号码与礼物 NFT 的专业估值与深度市场洞察。

请选择您需要购买的点数包：`
		bonusText = "+%d 赠送"
		backText = "🔙 返回"
	default:
		text = `⭐ <b>Purchase Intel Credits with Telegram Stars</b>

Intel Credits allow you to unlock institutional appraisals and market signals for Telegram digital assets.

Please select a credit pack:`
		bonusText = "+%d bonus"
		backText = "🔙 Back"
	}

	var inlineRows [][]map[string]interface{}
	for _, p := range packs {
		var btnLabel string
		switch lang {
		case "fa":
			btnLabel = fmt.Sprintf("⭐ %d کریدت — %d Stars", p.TotalCredits(), p.StarsPrice)
		case "ru":
			btnLabel = fmt.Sprintf("⭐ %d кредитов — %d Stars", p.TotalCredits(), p.StarsPrice)
		case "zh":
			btnLabel = fmt.Sprintf("⭐ %d 信用点 — %d Stars", p.TotalCredits(), p.StarsPrice)
		default:
			btnLabel = fmt.Sprintf("⭐ %d Credits — %d Stars", p.TotalCredits(), p.StarsPrice)
		}

		if p.BonusCredits > 0 {
			btnLabel += fmt.Sprintf(" ("+bonusText+")", p.BonusCredits)
		}
		inlineRows = append(inlineRows, []map[string]interface{}{
			{
				"text":          btnLabel,
				"callback_data": fmt.Sprintf("buy_pack:%s:%s:%s", p.ID, returnAssetType, returnEntity),
			},
		})
	}

	backCallback := "nav:menu"
	if returnAssetType != "" && returnEntity != "" {
		backCallback = fmt.Sprintf("precheck:%s:%s", returnAssetType, returnEntity)
	}
	inlineRows = append(inlineRows, []map[string]interface{}{
		{
			"text":          backText,
			"callback_data": backCallback,
		},
	})

	markup := map[string]interface{}{
		"inline_keyboard": inlineRows,
	}

	h.sendOrEditMessage(ctx, tg, chatID, messageID, text, markup, threadID)
}

// createAndSendStarsInvoice generates invoice link and provides it to the user
func (h *WebhookHandler) createAndSendStarsInvoice(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, packID string, returnAssetType string, returnEntity string, messageID *int, threadID *int) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	storeSvc := h.intelStoreService
	if storeSvc == nil {
		storeSvc = intelcredit.NewStoreService(h.db)
	}

	link, err := storeSvc.CreateStarsInvoice(ctx, userID, packID)
	if err != nil {
		slog.Error("Failed to create Stars invoice link", "error", err, "pack_id", packID)
		var errDesc string
		switch lang {
		case "fa":
			errDesc = "⚠️ خطا در ایجاد لینک پرداخت تلگرام استارز. لطفاً مجدداً تلاش فرمایید."
		case "ru":
			errDesc = "⚠️ Ошибка создания счета Telegram Stars. Пожалуйста, попробуйте позже."
		case "zh":
			errDesc = "⚠️ 创建 Telegram Stars 支付链接失败，请稍后重试。"
		default:
			errDesc = "⚠️ Error creating Telegram Stars invoice. Please try again later."
		}
		_ = tg.SendMessage(ctx, chatID, errDesc, nil, threadID)
		return
	}

	pack, _ := intelcredit.FindPack(packID)

	var text, btnPay, btnBack string
	switch lang {
	case "fa":
		text = fmt.Sprintf(`⭐ <b>فاکتور پرداخت تلگرام استارز آماده شد</b>

بسته انتخابی: <b>%d اعتبار تحلیلی</b>
مبلغ: <b>%d Stars</b>

برای تکمیل خرید روی دکمه پرداخت زیر کلیک فرمایید. پس از واریز، اعتبار فوراً به حسابتان منظور می‌گردد.`, pack.TotalCredits(), pack.StarsPrice)
		btnPay = fmt.Sprintf("⭐ پرداخت %d Stars", pack.StarsPrice)
		btnBack = "🔙 بازگشت"
	case "ru":
		text = fmt.Sprintf(`⭐ <b>Счет Telegram Stars сформирован</b>

Выбранный пакет: <b>%d аналитических кредитов</b>
Сумма к оплате: <b>%d Stars</b>

Нажмите кнопку ниже для перехода к оплате. Кредиты будут мгновенно зачислены на баланс после подтверждения.`, pack.TotalCredits(), pack.StarsPrice)
		btnPay = fmt.Sprintf("⭐ Оплатить %d Stars", pack.StarsPrice)
		btnBack = "🔙 Назад"
	case "zh":
		text = fmt.Sprintf(`⭐ <b>Telegram Stars 支付账单已生成</b>

选择套餐: <b>%d 个分析信用点</b>
应付金额: <b>%d Stars</b>

点击下方按钮直接完成安全支付。交易完成后点数将秒级自动充值入账。`, pack.TotalCredits(), pack.StarsPrice)
		btnPay = fmt.Sprintf("⭐ 立即支付 %d Stars", pack.StarsPrice)
		btnBack = "🔙 返回"
	default:
		text = fmt.Sprintf(`⭐ <b>Telegram Stars Invoice Created</b>

Selected Pack: <b>%d Intel Credits</b>
Amount: <b>%d Stars</b>

Click the payment button below to complete checkout. Credits will be deposited instantly upon fulfillment.`, pack.TotalCredits(), pack.StarsPrice)
		btnPay = fmt.Sprintf("⭐ Pay %d Stars", pack.StarsPrice)
		btnBack = "🔙 Back"
	}

	backCallback := "nav:menu"
	if returnAssetType != "" && returnEntity != "" {
		backCallback = fmt.Sprintf("precheck:%s:%s", returnAssetType, returnEntity)
	}

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{
					"text": btnPay,
					"url":  link,
				},
			},
			{
				{
					"text":          btnBack,
					"callback_data": backCallback,
				},
			},
		},
	}

	h.sendOrEditMessage(ctx, tg, chatID, messageID, text, markup, threadID)
}

// sendOrEditMessage attempts to edit an existing message with markup. If the edit fails
// (e.g. original message has photo/media, content unchanged, or markdown entity error),
// it seamlessly falls back to sending a new message with markup so glass buttons never freeze.
func (h *WebhookHandler) sendOrEditMessage(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, messageID *int, text string, markup interface{}, threadID *int) {
	if tg == nil {
		return
	}
	formattedText := FormatPremiumEmojiText(text)
	if messageID != nil {
		err := tg.EditMessageTextWithMarkup(ctx, chatID, *messageID, formattedText, markup)
		if err == nil {
			return
		}
		slog.Debug("EditMessageTextWithMarkup returned non-nil error, falling back to SendMessageWithMarkup", "error", err, "chat_id", chatID, "message_id", *messageID)
	}
	_, _ = tg.SendMessageWithMarkup(ctx, chatID, formattedText, markup, threadID)
}
