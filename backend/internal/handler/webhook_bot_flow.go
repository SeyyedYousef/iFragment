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
	"sync"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/config"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/cardgen"
	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/telegramnft"
	"ifragment-backend/internal/service/gifts/traits"
	"ifragment-backend/internal/service/intelcredit"
	"ifragment-backend/internal/service/numbers/features"
	"ifragment-backend/internal/service/numbers/nvengine"
	"ifragment-backend/internal/service/username/avm"

	"github.com/shopspring/decimal"
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
	CustomEmojiCoin    = "5407005610518534015" // 🪙 Airdrop Coins (distinct from Phone)
	CustomEmojiRefresh = "5445124018330758412" // 🔄 Convert / Exchange (distinct from Bolt)
)

// AllCustomEmojiIDs lists all custom emoji constants used across iFragment bot.
var AllCustomEmojiIDs = []string{
	CustomEmojiDiamond,
	CustomEmojiTag,
	CustomEmojiPhone,
	CustomEmojiGift,
	CustomEmojiUser,
	CustomEmojiGlobe,
	CustomEmojiBook,
	CustomEmojiCheck,
	CustomEmojiCross,
	CustomEmojiStar,
	CustomEmojiBolt,
	CustomEmojiCoin,
	CustomEmojiRefresh,
}

// customEmojiDenylist tracks invalid/unauthorized custom emoji IDs so they are stripped/fallback to normal character.
var customEmojiDenylist sync.Map

// IsCustomEmojiDenylisted checks if a custom emoji ID is denylisted.
func IsCustomEmojiDenylisted(id string) bool {
	_, denylisted := customEmojiDenylist.Load(id)
	return denylisted
}

// DenylistCustomEmoji adds an emoji ID to the denylist.
func DenylistCustomEmoji(id string) {
	customEmojiDenylist.Store(id, true)
}

// ValidateCustomEmojis calls getCustomEmojiStickers with all IDs, logs invalid ones, and denylists them.
func ValidateCustomEmojis(ctx context.Context, tg *telegram.BotAPIClient) {
	if tg == nil {
		return
	}
	stickers, err := tg.GetCustomEmojiStickers(ctx, AllCustomEmojiIDs)
	if err != nil {
		slog.Warn("ValidateCustomEmojis: failed to fetch custom emoji stickers from Telegram", "error", err)
		return
	}

	validMap := make(map[string]bool)
	for _, s := range stickers {
		validMap[s.CustomEmojiID] = true
	}

	for _, id := range AllCustomEmojiIDs {
		if !validMap[id] {
			slog.Error("Custom Emoji ID is invalid or unauthorized on Telegram, adding to denylist", "custom_emoji_id", id)
			DenylistCustomEmoji(id)
		}
	}
}

// SmartSniffResult holds the recognized asset type and normalized query.
type SmartSniffResult struct {
	Type   string // "username", "number", "gift"
	Entity string // normalized entity value (e.g. "durov", "+88888888888", "plush_pepe-42")
	Raw    string
}

var (
	giftSlugRegex        = regexp.MustCompile(`(?i)^[a-zA-Z0-9_]+-\d+$`)
	usernameRe           = regexp.MustCompile(`^[a-zA-Z](?:[a-zA-Z0-9_]{2,30})[a-zA-Z0-9]$`)
	premiumEmojiIDRe     = regexp.MustCompile(`\[emoji:(\d{10,21})\]|\[(\d{10,21})\]`)
	tgEmojiTagRe         = regexp.MustCompile(`(?is)<tg-emoji[^>]*>(.*?)</tg-emoji>|<tg-emoji[^>]*/>`)
	tgEmojiWithIDRe      = regexp.MustCompile(`(?is)<tg-emoji[^>]*emoji-id="([^"]+)"[^>]*>(.*?)</tg-emoji>`)
)

// isPremiumEmojiEnabled checks if custom emojis are supported/enabled in this deployment.
// Defaults to false to ensure 100% compatibility with Telegram Bot API (preventing DOCUMENT_INVALID).
func isPremiumEmojiEnabled() bool {
	val := strings.TrimSpace(os.Getenv("PREMIUM_EMOJI_ENABLED"))
	if val == "" {
		return false
	}
	b, err := strconv.ParseBool(val)
	if err != nil {
		return false
	}
	return b
}

// stripCustomEmoji strips <tg-emoji ...>X</tg-emoji> tags, leaving only inner character X.
func stripCustomEmoji(html string) string {
	if html == "" {
		return html
	}
	return tgEmojiTagRe.ReplaceAllString(html, "$1")
}

// filterDenylistedCustomEmojis replaces only denylisted <tg-emoji emoji-id="id">X</tg-emoji> tags with X.
func filterDenylistedCustomEmojis(html string) string {
	if html == "" {
		return html
	}
	return tgEmojiWithIDRe.ReplaceAllStringFunc(html, func(m string) string {
		sub := tgEmojiWithIDRe.FindStringSubmatch(m)
		if len(sub) == 3 {
			id := sub[1]
			fallbackChar := sub[2]
			if IsCustomEmojiDenylisted(id) {
				return fallbackChar
			}
		}
		return m
	})
}

// FormatPremiumEmojiText replaces bracketed emoji IDs like [5368324170671202286] or [emoji:5368324170671202286]
// with standard Telegram Bot API custom emoji markup: <tg-emoji emoji-id="ID">✨</tg-emoji>
// If PREMIUM_EMOJI_ENABLED=false, it preserves only regular text/emoji.
func FormatPremiumEmojiText(input string) string {
	if input == "" {
		return input
	}
	out := premiumEmojiIDRe.ReplaceAllStringFunc(input, func(m string) string {
		sub := premiumEmojiIDRe.FindStringSubmatch(m)
		id := sub[1]
		if id == "" {
			id = sub[2]
		}
		if id != "" {
			if IsCustomEmojiDenylisted(id) {
				return "✨"
			}
			return fmt.Sprintf(`<tg-emoji emoji-id="%s">✨</tg-emoji>`, id)
		}
		return m
	})
	if !isPremiumEmojiEnabled() {
		out = stripCustomEmoji(out)
	} else {
		out = filterDenylistedCustomEmojis(out)
	}
	return out
}

func (h *WebhookHandler) resolveText(ctx context.Context, key, lang, defaultText string) string {
	res := defaultText
	if h.templateRepo != nil {
		custom, err := h.templateRepo.GetTemplate(ctx, key, lang)
		if err == nil && custom != "" {
			if err := ValidateTelegramHTML(custom); err != nil {
				slog.Warn("DB template contains invalid Telegram HTML tags or unclosed tags, falling back to default",
					"key", key, "lang", lang, "error", err)
				res = defaultText
			} else {
				res = custom
			}
		}
	}
	return FormatPremiumEmojiText(res)
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
			case "/val", "/valuate", "/valuation", "/check", "/analyze", "/appraise", "/price":
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
	tg := h.getBotClient(bot)
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

Выберите категорию или отправьте <b>юзернейм</b>, <b>номер (+888)</b> или <b>ссылку на подарок</b> прямо в чат:`
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

	markup := h.buildMainMenuMarkup(ctx, lang, targetURL)

	h.sendOrEditMessage(ctx, tg, chatID, messageID, menuText, markup, threadID)
}

// buildMainMenuMarkup creates the clean, elegant inline keyboard with standard Telegram buttons
// structured as a balanced 1 + 2 + 2 + 2 layout.
func (h *WebhookHandler) buildMainMenuMarkup(ctx context.Context, lang string, miniAppURL string) map[string]interface{} {
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

	if ctx == nil {
		ctx = context.Background()
	}
	btnMiniApp = h.resolveButton(ctx, "btn_mini_app", lang, btnMiniApp)
	btnUsername = h.resolveButton(ctx, "btn_usernames", lang, btnUsername)
	btnNumber = h.resolveButton(ctx, "btn_numbers", lang, btnNumber)
	btnGifts = h.resolveButton(ctx, "btn_gifts", lang, btnGifts)
	btnProfile = h.resolveButton(ctx, "btn_profile", lang, btnProfile)
	btnLang = h.resolveButton(ctx, "btn_language", lang, btnLang)
	btnHelp = h.resolveButton(ctx, "btn_help", lang, btnHelp)

	return map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			// Row 1: Hero Primary CTA (Full Width)
			{
				func() map[string]interface{} {
					btn := map[string]interface{}{
						"text": btnMiniApp,
					}
					if strings.HasPrefix(miniAppURL, "https://") && !strings.Contains(miniAppURL, "t.me/") {
						btn["web_app"] = map[string]interface{}{"url": miniAppURL}
					} else {
						btn["url"] = miniAppURL
					}
					return btn
				}(),
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

// sendProfileView renders the user profile with credits, rank, and referral
func (h *WebhookHandler) sendProfileView(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, messageID *int, threadID *int) {
	tg := h.getBotClient(bot)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	var intelCredits int = 0
	var globalRank int = 1
	var level int = 1
	var firstName string = "کاربر"

	if h.profileService != nil {
		stats, err := h.profileService.GetStats(ctx, userID)
		if err == nil && stats != nil {
			intelCredits = stats.IntelCredits
			globalRank = stats.GlobalRank
			level = stats.Level
			if stats.FirstName != "" {
				firstName = stats.FirstName
			}
		}
	}

	if h.intelCreditService == nil && h.db != nil {
		h.intelCreditService = intelcredit.NewIntelCreditService(h.db)
	}
	if h.intelCreditService != nil {
		if bal, err := h.intelCreditService.GetBalance(ctx, userID); err == nil && bal != nil {
			intelCredits = bal.Balance
		}
	}

	botUsername := "iFragmentBot"
	if bot != nil && bot.BotUsername != "" {
		botUsername = bot.BotUsername
	}
	refLink := fmt.Sprintf("https://t.me/%s?start=ref_%d", botUsername, userID)

	text := h.renderProfileText(ctx, lang, firstName, userID, level, globalRank, intelCredits, refLink)

	var btnFreeCredits, btnLeaderboard, btnStars, btnLang, btnBack string
	switch lang {
	case "fa":
		btnFreeCredits = "💬 دریافت کردیت رایگان (@FragmentInvestors)"
		btnLeaderboard = "🏆 جدول برترین‌ها (مینی‌اپ)"
		btnStars = "⭐ خرید کردیت با Stars"
		btnLang = "🌐 تغییر زبان"
		btnBack = "🔙 بازگشت به منو"
	case "ar":
		btnFreeCredits = "💬 احصل على أرصدة مجانية (@FragmentInvestors)"
		btnLeaderboard = "🏆 قائمة المتصدرين (التطبيق)"
		btnStars = "⭐ شراء أرصدة عبر Stars"
		btnLang = "🌐 تغيير اللغة"
		btnBack = "🔙 العودة للقائمة"
	case "ru":
		btnFreeCredits = "💬 Бесплатные кредиты (@FragmentInvestors)"
		btnLeaderboard = "🏆 Таблица лидеров (Mini App)"
		btnStars = "⭐ Купить кредиты за Stars"
		btnLang = "🌐 Язык"
		btnBack = "🔙 В меню"
	case "zh":
		btnFreeCredits = "💬 免费领取信用点 (@FragmentInvestors)"
		btnLeaderboard = "🏆 综合排行榜 (小程序)"
		btnStars = "⭐ 使用 Stars 购买信用点"
		btnLang = "🌐 切换语言"
		btnBack = "🔙 返回主菜单"
	default:
		btnFreeCredits = "💬 Free Credits (@FragmentInvestors)"
		btnLeaderboard = "🏆 Top Leaderboard (Mini App)"
		btnStars = "⭐ Buy Credits with Stars"
		btnLang = "🌐 Language"
		btnBack = "🔙 Back to Menu"
	}

	btnFreeCredits = h.resolveButton(ctx, "btn_free_credits", lang, btnFreeCredits)
	btnLeaderboard = h.resolveButton(ctx, "btn_leaderboard", lang, btnLeaderboard)
	btnStars = h.resolveButton(ctx, "btn_stars", lang, btnStars)
	btnLang = h.resolveButton(ctx, "btn_language", lang, btnLang)
	btnBack = h.resolveButton(ctx, "btn_back", lang, btnBack)

	miniAppLeaderboardURL := appendStartParam(h.getMiniAppURL(bot), "leaderboard")

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{
					"text": btnFreeCredits,
					"url":  "https://t.me/FragmentInvestors",
				},
			},
			{
				{
					"text": btnLeaderboard,
					"url":  miniAppLeaderboardURL,
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

// renderProfileText renders the profile view HTML text with placeholders substituted.
func (h *WebhookHandler) renderProfileText(ctx context.Context, lang string, firstName string, userID int64, level int, globalRank int, intelCredits int, refLink string) string {
	var defaultProfileText string
	switch lang {
	case "fa":
		defaultProfileText = fmt.Sprintf(`<tg-emoji emoji-id="%s">👤</tg-emoji> <b>پروفایل سرمایه‌گذار | iFragment</b>

کاربر: <b>{name}</b> (شناسه: <code>{id}</code>)
سطح کاربری: <b>سطح {level}</b>
رتبه جهانی در شبکه: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>اعتبار تحلیلی (Intel Credits):</b> <code>{credits}</code> کریدت
━━━━━━━━━━━━━━━━━━━

🔗 <b>لینک دعوت اختصاصی شما:</b>
<code>{reflink}</code>
<i>با دعوت از هر دوست، اعتبار تحلیل هدیه بگیرید!</i>`, CustomEmojiUser, CustomEmojiBolt)
	case "ar":
		defaultProfileText = fmt.Sprintf(`<tg-emoji emoji-id="%s">👤</tg-emoji> <b>الملف الشخصي للمستثمر | iFragment</b>

المستخدم: <b>{name}</b> (المعرف: <code>{id}</code>)
المستوى: <b>المستوى {level}</b>
الترتيب العالمي: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>رصيد التحليل (Intel Credits):</b> <code>{credits}</code> رصيد
━━━━━━━━━━━━━━━━━━━

🔗 <b>رابط الدعوة الخاص بك:</b>
<code>{reflink}</code>
<i>اربح أرصدة تحليلية مجانية عند دعوة أصدقائك!</i>`, CustomEmojiUser, CustomEmojiBolt)
	case "ru":
		defaultProfileText = fmt.Sprintf(`<tg-emoji emoji-id="%s">👤</tg-emoji> <b>Профиль пользователя | iFragment</b>

Пользователь: <b>{name}</b> (ID: <code>{id}</code>)
Уровень: <b>Level {level}</b>
Глобальный ранг: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>Intel Credits (кредиты отчетов):</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔗 <b>Ваша реферальная ссылка:</b>
<code>{reflink}</code>`, CustomEmojiUser, CustomEmojiBolt)
	case "zh":
		defaultProfileText = fmt.Sprintf(`<tg-emoji emoji-id="%s">👤</tg-emoji> <b>个人中心与资产 | iFragment</b>

用户: <b>{name}</b> (ID: <code>{id}</code>)
等级: <b>Level {level}</b>
全网排名: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>分析信用点 (Intel Credits):</b> <code>{credits}</code> 点
━━━━━━━━━━━━━━━━━━━

🔗 <b>您的专属邀请链接:</b>
<code>{reflink}</code>
<i>邀请好友加入，双方均可获得分析信用点奖励！</i>`, CustomEmojiUser, CustomEmojiBolt)
	default:
		defaultProfileText = fmt.Sprintf(`<tg-emoji emoji-id="%s">👤</tg-emoji> <b>Investor Profile | iFragment</b>

Account: <b>{name}</b> (ID: <code>{id}</code>)
Tier Level: <b>Level {level}</b>
Global Rank: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>Intel Credits Available:</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔗 <b>Your Exclusive Referral Link:</b>
<code>{reflink}</code>`, CustomEmojiUser, CustomEmojiBolt)
	}

	rawProfile := h.resolveText(ctx, "profile_view", lang, defaultProfileText)
	text := strings.ReplaceAll(rawProfile, "{name}", telegram.EscapeHTML(firstName))
	text = strings.ReplaceAll(text, "{id}", strconv.FormatInt(userID, 10))
	text = strings.ReplaceAll(text, "{level}", strconv.Itoa(level))
	text = strings.ReplaceAll(text, "{rank}", strconv.Itoa(globalRank))
	text = strings.ReplaceAll(text, "{credits}", strconv.Itoa(intelCredits))
	text = strings.ReplaceAll(text, "{reflink}", refLink)
	return text
}

// sendHelpView displays instructions and examples for analyzing assets
func (h *WebhookHandler) sendHelpView(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, messageID *int, threadID *int) {
	tg := h.getBotClient(bot)
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

💡 <i>هر گزارش عمیق به ۱ کریدت تحلیلی نیاز دارد که می‌توانید با ارسال پیام یا بوست در سوپرگروه @FragmentInvestors به صورت کاملاً رایگان دریافت کنید، یا آن را با Stars فعال فرمایید.</i>`
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

💡 <i>يتطلب كل تقرير تحليلي متقدم 1 Intel Credit. يمكنك الحصول على أرصدة غير محدودة مجاناً عبر المشاركة في مجموعة @FragmentInvestors أو شراؤها عبر Stars.</i>`
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

💡 <i>Каждый детальный отчет требует 1 Intel Credit. Вы можете бесплатно получать кредиты за сообщения и бусты в @FragmentInvestors или приобрести их за Stars.</i>`
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

💡 <i>每份深度报告消耗 1 个分析信用点。您可以在 @FragmentInvestors 群组中发言或助力群组免费获取无限信用点，也可使用 Telegram Stars 购买。</i>`
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
• <code>/gift CelestialStar-1</code>

💡 <i>Each detailed report costs 1 Intel Credit. You can earn unlimited free credits by chatting or boosting @FragmentInvestors, or buy with Stars.</i>`
	}

	var btnBack string
	switch lang {
	case "fa":
		btnBack = "🔙 بازگشت به منوی اصلی"
	case "ar":
		btnBack = "🔙 العودة للقائمة الرئيسية"
	case "ru":
		btnBack = "🔙 В главное меню"
	case "zh":
		btnBack = "🔙 返回主菜单"
	default:
		btnBack = "🔙 Back to Main Menu"
	}
	btnBack = h.resolveButton(ctx, "btn_back_menu", lang, btnBack)
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
	tg := h.getBotClient(bot)
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

	var btnBack string
	switch lang {
	case "fa":
		btnBack = "🔙 بازگشت به منوی اصلی"
	case "ar":
		btnBack = "🔙 العودة للقائمة"
	case "ru":
		btnBack = "🔙 Назад в меню"
	case "zh":
		btnBack = "🔙 返回主菜单"
	default:
		btnBack = "🔙 Back to Menu"
	}
	btnBack = h.resolveButton(ctx, "btn_back_menu", lang, btnBack)

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
	tg := h.getBotClient(bot)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	// Pre-validation to avoid confusing user or deducting credits for invalid queries
	switch assetType {
	case "gift":
		ref, err := gvengine.NormalizeGiftIdentifier(entity)
		if err != nil {
			var errMsg string
			switch normalizeLang(lang) {
			case "fa":
				errMsg = "🎁 <b>این گیفت پیدا نشد، لینک را چک کنید</b>"
			case "ru":
				errMsg = "🎁 <b>Этот подарок не найден, проверьте ссылку</b>"
			case "zh":
				errMsg = "🎁 <b>未找到该礼物，请检查链接</b>"
			default:
				errMsg = "🎁 <b>Gift not found, please check the link</b>"
			}
			markup := map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{{"text": "🔙", "callback_data": "nav:menu"}},
				},
			}
			h.sendOrEditMessage(ctx, tg, chatID, messageID, errMsg, markup, threadID)
			return
		}
		if _, ok := traits.ResolveCollection(ref.ModelID); !ok {
			var errMsg string
			switch normalizeLang(lang) {
			case "fa":
				errMsg = "🎁 <b>این گیفت پیدا نشد، لینک را چک کنید</b>"
			case "ru":
				errMsg = "🎁 <b>Этот подарок не найден, проверьте ссылку</b>"
			case "zh":
				errMsg = "🎁 <b>未找到该礼物，请检查链接</b>"
			default:
				errMsg = "🎁 <b>Gift not found, please check the link</b>"
			}
			markup := map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{{"text": "🔙", "callback_data": "nav:menu"}},
				},
			}
			h.sendOrEditMessage(ctx, tg, chatID, messageID, errMsg, markup, threadID)
			return
		}
		entity = ref.GiftID
	case "username":
		cleanUser := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(entity), "@"))
		if !usernameRe.MatchString(cleanUser) {
			var errMsg string
			switch normalizeLang(lang) {
			case "fa":
				errMsg = "🏷️ <b>فرمت نام کاربری نامعتبر است.</b>\nنمونه معتبر: <code>durov</code>"
			case "ru":
				errMsg = "🏷️ <b>Неверный формат юзернейма.</b>\nПример: <code>durov</code>"
			case "zh":
				errMsg = "🏷️ <b>用户名格式无效。</b>\n有效示例: <code>durov</code>"
			default:
				errMsg = "🏷️ <b>Invalid username format.</b>\nExample: <code>durov</code>"
			}
			markup := map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{{"text": "🔙", "callback_data": "nav:menu"}},
				},
			}
			h.sendOrEditMessage(ctx, tg, chatID, messageID, errMsg, markup, threadID)
			return
		}
		entity = cleanUser
	case "number":
		normNum, err := features.NormalizeNumber(entity)
		if err != nil || !strings.HasPrefix(normNum, "+888") {
			var errMsg string
			switch normalizeLang(lang) {
			case "fa":
				errMsg = "📱 <b>شماره وارد شده معتبر نیست.</b>\nشماره‌های معتبر فرگمنت با <code>+888</code> آغاز می‌شوند."
			case "ru":
				errMsg = "📱 <b>Номер недействителен.</b>\nДействительные номера начинаются с <code>+888</code>."
			case "zh":
				errMsg = "📱 <b>无效的匿名号码。</b>\n有效的号码以 <code>+888</code> 开头。"
			default:
				errMsg = "📱 <b>Invalid anonymous number.</b>\nValid numbers begin with <code>+888</code>."
			}
			markup := map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{{"text": "🔙", "callback_data": "nav:menu"}},
				},
			}
			h.sendOrEditMessage(ctx, tg, chatID, messageID, errMsg, markup, threadID)
			return
		}
		entity = normNum
	}

	// Clear cached stats to show authoritative real-time numbers
	if h.cache != nil && h.cache.Client != nil {
		_ = h.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID)).Err()
	}

	var intelCredits int = 0
	if h.profileService != nil {
		stats, err := h.profileService.GetStats(ctx, userID)
		if err == nil && stats != nil {
			intelCredits = stats.IntelCredits
		}
	}

	if h.intelCreditService == nil && h.db != nil {
		h.intelCreditService = intelcredit.NewIntelCreditService(h.db)
	}
	if h.intelCreditService != nil {
		if bal, err := h.intelCreditService.GetBalance(ctx, userID); err == nil && bal != nil {
			intelCredits = bal.Balance
		}
	}

	var assetName, entityDisplay string
	switch assetType {
	case "username":
		entityDisplay = "@" + strings.TrimPrefix(entity, "@")
		switch lang {
		case "fa":
			assetName = "نام کاربری"
		case "ar":
			assetName = "اسم المستخدم"
		case "ru":
			assetName = "Юзернейм"
		case "zh":
			assetName = "用户名"
		default:
			assetName = "Username"
		}
	case "number":
		entityDisplay = entity
		switch lang {
		case "fa":
			assetName = "شماره کلکسیونی ناشناس"
		case "ar":
			assetName = "الرقم المميز المجهول"
		case "ru":
			assetName = "Анонимный номер (+888)"
		case "zh":
			assetName = "+888 匿名靓号"
		default:
			assetName = "Anonymous Number (+888)"
		}
	case "gift":
		entityDisplay = entity
		switch lang {
		case "fa":
			assetName = "گیفت تلگرام"
		case "ar":
			assetName = "هدية تيليجرام"
		case "ru":
			assetName = "Подарок Telegram"
		case "zh":
			assetName = "Telegram 礼物"
		default:
			assetName = "Telegram Gift"
		}
	default:
		entityDisplay = entity
		switch lang {
		case "fa":
			assetName = "دارایی دیجیتال"
		case "ar":
			assetName = "الأصل الرقمي"
		case "ru":
			assetName = "Цифровой актив"
		case "zh":
			assetName = "数字资产"
		default:
			assetName = "Digital Asset"
		}
	}

	var gateText string
	var btnUnlock, btnFreeCredits, btnStars, btnBack string

	var giftGate *gvengine.CuriosityGateResponse
	if assetType == "gift" && h.giftsService != nil {
		if gRes, err := h.giftsService.GetCuriosityGate(ctx, entity); err == nil && gRes != nil {
			giftGate = gRes
			entityDisplay = fmt.Sprintf("%s #%d", gRes.ModelName, gRes.SerialNumber)
		}
	}

	var defaultGateText string
	if giftGate != nil {
		switch normalizeLang(lang) {
		case "fa":
			defaultGateText = fmt.Sprintf(`🎁 <b>تحلیل اولیه گیفت: %s #%d</b>

💎 مدل کلکسیونی: <b>%s</b>
🌊 کف مشاهده‌شده بازار (Floor): <b>~%.1f TON ($%.0f)</b>
📊 سیگنال‌های پایش‌شده: <b>%d سیگنال بازار و بلاکچین</b>

━━━━━━━━━━━━━━━━━━━
⚡ <b>موجودی کریدت تحلیلی شما:</b> <code>{credits}</code>
💬 <i>کریدت رایگان با ارسال پیام در گروه @FragmentInvestors</i>
━━━━━━━━━━━━━━━━━━━

🔐 <b>در گزارش تحلیلی عمیق این گیفت چه مواردی می‌بینید؟</b>
• ارزش‌گذاری منصفانه با مدل هدانیک کوانتومی (Fair Value)
• تفکیک ژنتیکی صفات (Model, Backdrop 4-Hex, Symbol) و درصد نایابی
• ارزش نقدشوندگی فوری (Liquidation) و پیشنهاد بهینه فروش (Ask)
• مقایسه معاملات قطعی اخیر در فرگمنت و تلگرام
• سرتیفیکیت رمزنگاری‌شده و تحلیل برابری Stars

هزینه باز کردن گزارش کامل: <b>۱ کریدت تحلیلی</b>`,
				telegram.EscapeHTML(giftGate.ModelName), giftGate.SerialNumber,
				telegram.EscapeHTML(giftGate.SelectedModel),
				giftGate.FloorPriceGRAM, giftGate.FloorPriceUSD,
				giftGate.SignalsAnalyzed,
			)
		case "ru":
			defaultGateText = fmt.Sprintf(`🎁 <b>Предварительный анализ подарка: %s #%d</b>

💎 Модель: <b>%s</b>
🌊 Floor-цена на рынке: <b>~%.1f TON ($%.0f)</b>
📊 Отслеживаемых сигналов: <b>%d он-чейн и рыночных сигналов</b>

━━━━━━━━━━━━━━━━━━━
⚡ <b>Доступно кредитов (Intel Credits):</b> <code>{credits}</code>
💬 <i>Бесплатные кредиты за сообщения в группе @FragmentInvestors</i>
━━━━━━━━━━━━━━━━━━━

🔐 <b>Что входит в детальный отчет?</b>
• Справедливая оценка по квантово-гедонической модели (Fair Value)
• Генетический расклад атрибутов (Model, Backdrop, Symbol) и их редкость
• Ликвидационная стоимость и оптимальный Ask
• Сравнение с реальными сделками на Fragment и в Telegram
• Криптографический сертификат подлинности

Стоимость открытия полного отчета: <b>1 Intel Credit</b>`,
				telegram.EscapeHTML(giftGate.ModelName), giftGate.SerialNumber,
				telegram.EscapeHTML(giftGate.SelectedModel),
				giftGate.FloorPriceGRAM, giftGate.FloorPriceUSD,
				giftGate.SignalsAnalyzed,
			)
		case "zh":
			defaultGateText = fmt.Sprintf(`🎁 <b>Telegram 礼物初探分析: %s #%d</b>

💎 藏品模型: <b>%s</b>
🌊 当前市场底价 (Floor): <b>~%.1f TON ($%.0f)</b>
📊 监控数据维度: <b>%d 项链上与市场信号</b>

━━━━━━━━━━━━━━━━━━━
⚡ <b>可用分析信用点 (Intel Credits):</b> <code>{credits}</code> 点
💬 <i>在 @FragmentInvestors 群组发消息即可获取免费信用点</i>
━━━━━━━━━━━━━━━━━━━

🔐 <b>深度专业分析报告包含内容:</b>
• 基于量子特征定价模型的公允估值 (Fair Value)
• 基因特征稀缺度详测 (Model, Backdrop 4-Hex, Symbol)
• 即时清算底价与最佳挂单建议 (Ask)
• Fragment 与 Telegram 链上撮合成交对比
• 防伪加密认证证书

解锁完整深度报告仅需: <b>1 个分析信用点</b>`,
				telegram.EscapeHTML(giftGate.ModelName), giftGate.SerialNumber,
				telegram.EscapeHTML(giftGate.SelectedModel),
				giftGate.FloorPriceGRAM, giftGate.FloorPriceUSD,
				giftGate.SignalsAnalyzed,
			)
		default:
			defaultGateText = fmt.Sprintf(`🎁 <b>Telegram Gift Preliminary Intel: %s #%d</b>

💎 Collectible Model: <b>%s</b>
🌊 Observed Market Floor: <b>~%.1f TON ($%.0f)</b>
📊 Analyzed Signals: <b>%d on-chain & market signals</b>

━━━━━━━━━━━━━━━━━━━
⚡ <b>Intel Credits Available:</b> <code>{credits}</code>
💬 <i>Earn free credits by sending messages in @FragmentInvestors</i>
━━━━━━━━━━━━━━━━━━━

🔐 <b>What's inside the deep intelligence report?</b>
• Fair value appraisal via Quantum-Hedonic model
• Trait DNA breakdown (Model, Backdrop 4-Hex, Symbol) & rarity
• Instant liquidation value & optimal ask recommendation
• Recent verified comparable on-chain sales
• Cryptographic verification certificate

Unlock full report cost: <b>1 Intel Credit</b>`,
				telegram.EscapeHTML(giftGate.ModelName), giftGate.SerialNumber,
				telegram.EscapeHTML(giftGate.SelectedModel),
				giftGate.FloorPriceGRAM, giftGate.FloorPriceUSD,
				giftGate.SignalsAnalyzed,
			)
		}
		switch normalizeLang(lang) {
		case "ru":
			btnUnlock = "🔓 Открыть отчет (1 кредит)"
			btnFreeCredits = "💬 Получить кредиты (@FragmentInvestors)"
			btnStars = "⭐ Купить кредиты за Stars"
			btnBack = "🔙 Назад"
		case "zh":
			btnUnlock = "🔓 解锁专业分析报告 (1 信用点)"
			btnFreeCredits = "💬 获取免费信用点 (@FragmentInvestors)"
			btnStars = "⭐ 使用 Stars 购买信用点"
			btnBack = "🔙 返回"
		case "en":
			btnUnlock = "🔓 Unlock Full Report (1 Credit)"
			btnFreeCredits = "💬 Earn Free Credits (@FragmentInvestors)"
			btnStars = "⭐ Buy Credits with Stars"
			btnBack = "🔙 Back"
		default: // "fa"
			btnUnlock = "🔓 مشاهده گزارش تحلیلی (۱ کریدت)"
			btnFreeCredits = "💬 دریافت کردیت رایگان (@FragmentInvestors)"
			btnStars = "⭐ خرید کریدت با Stars"
			btnBack = "🔙 بازگشت"
		}
	} else {
		switch lang {
		case "fa":
			defaultGateText = `🔍 <b>تحلیل اولیه دارایی شناسایی شد</b>

دارایی: <b>{type}</b>
شناسه / مقدار: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
⚡ <b>موجودی کریدت تحلیلی شما:</b> <code>{credits}</code>
💬 <i>کریدت رایگان با ارسال پیام در گروه @FragmentInvestors</i>
━━━━━━━━━━━━━━━━━━━

🔐 <b>در گزارش تحلیلی عمیق این دارایی چه مواردی می‌بینید؟</b>
• برآورد ارزش منصفانه ریالی، دلاری و TON
• سنجش کمیابی صفات و ویژگی‌های ساختاری
• تاریخچه آخرین معاملات ثبت‌شده مشابه در شبکه
• شاخص نقدشوندگی و کشش تقاضا در بازار

هزینه باز کردن گزارش کامل: <b>۱ کریدت تحلیلی</b>`
			btnUnlock = "🔓 مشاهده گزارش تحلیلی (۱ کریدت)"
			btnFreeCredits = "💬 دریافت کردیت رایگان (@FragmentInvestors)"
			btnStars = "⭐ خرید کریدت با Stars"
			btnBack = "🔙 بازگشت"

		case "ar":
			defaultGateText = `🔍 <b>تم التعرف على الأصل وجاهز للتقييم</b>

فئة الأصل: <b>{type}</b>
المعرف: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
⚡ <b>رصيد التحليل (Intel Credits):</b> <code>{credits}</code>
💬 <i>احصل على أرصدة مجانية بمجرد إرسال الرسائل في @FragmentInvestors</i>
━━━━━━━━━━━━━━━━━━━

🔐 <b>ماذا يتضمن تقرير التحليل المتقدم؟</b>
• التقييم العادل المعتمد بعملتي TON والدولار
• فحص ندرة الصفات والخصائص الجينية
• سجل أحدث الصفقات المشابهة المنفذة على الشبكة
• مؤشرات السيولة وسرعة التداول المتوقعة

تكلفة فتح التقرير الكامل: <b>رصيد تحليل واحد (1 Credit)</b>`
			btnUnlock = "🔓 فتح التقرير الكامل (1 رصيد)"
			btnFreeCredits = "💬 أرصدة مجانية (@FragmentInvestors)"
			btnStars = "⭐ شراء أرصدة عبر Stars"
			btnBack = "🔙 رجوع"

		case "ru":
			defaultGateText = `🔍 <b>Актив успешно распознан для анализа</b>

Категория: <b>{type}</b>
Идентификатор: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
⚡ <b>Доступно кредитов (Intel Credits):</b> <code>{credits}</code>
💬 <i>Бесплатные кредиты за сообщения в группе @FragmentInvestors</i>
━━━━━━━━━━━━━━━━━━━

🔐 <b>Что входит в детальный отчет?</b>
• Справедливая оценка в TON и USD
• Анализ редкости характеристик и атрибутов
• История реальных сопоставимых сделок на рынке
• Метрики ликвидности и расчетное время продажи

Стоимость открытия полного отчета: <b>1 Intel Credit</b>`
			btnUnlock = "🔓 Открыть отчет (1 кредит)"
			btnFreeCredits = "💬 Получить кредиты (@FragmentInvestors)"
			btnStars = "⭐ Купить кредиты за Stars"
			btnBack = "🔙 Назад"

		case "zh":
			defaultGateText = `🔍 <b>已成功识别资产并准备评估</b>

资产类别: <b>{type}</b>
目标标识: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
⚡ <b>可用分析信用点 (Intel Credits):</b> <code>{credits}</code> 点
💬 <i>在 @FragmentInvestors 群组发消息即可获取免费信用点</i>
━━━━━━━━━━━━━━━━━━━

🔐 <b>深度专业分析报告包含内容:</b>
• 基于 TON 与美元的公允价值科学估算
• 基因特征稀缺度与等级百分比
• 全网最新真实撮合交易参照对比
• 市场流动性评级与预估出售周期

解锁完整深度报告仅需: <b>1 个分析信用点</b>`
			btnUnlock = "🔓 解锁专业分析报告 (1 信用点)"
			btnFreeCredits = "💬 获取免费信用点 (@FragmentInvestors)"
			btnStars = "⭐ 使用 Stars 购买信用点"
			btnBack = "🔙 返回"

		default:
			defaultGateText = `🔍 <b>Asset Identified for Deep Intelligence</b>

Asset Class: <b>{type}</b>
Identifier: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
⚡ <b>Intel Credits Available:</b> <code>{credits}</code>
💬 <i>Earn free credits by sending messages in @FragmentInvestors</i>
━━━━━━━━━━━━━━━━━━━

🔐 <b>What's inside the deep intelligence report?</b>
• Fair value valuation in TON & USD
• Structural trait rarity breakdown & genetics
• Recent verified comparable on-chain sales
• Liquidity velocity & expected turnaround time

Unlock full report cost: <b>1 Intel Credit</b>`
			btnUnlock = "🔓 Unlock Full Report (1 Credit)"
			btnFreeCredits = "💬 Earn Free Credits (@FragmentInvestors)"
			btnStars = "⭐ Buy Credits with Stars"
			btnBack = "🔙 Back"
		}
	}

	rawGate := defaultGateText
	if giftGate == nil {
		rawGate = h.resolveText(ctx, "precheck_gate", lang, defaultGateText)
	}
	gateText = strings.ReplaceAll(rawGate, "{type}", assetName)
	gateText = strings.ReplaceAll(gateText, "{entity}", telegram.EscapeHTML(entityDisplay))
	gateText = strings.ReplaceAll(gateText, "{credits}", strconv.Itoa(intelCredits))

	btnUnlock = h.resolveButton(ctx, "btn_unlock", lang, btnUnlock)
	btnFreeCredits = h.resolveButton(ctx, "btn_free_credits", lang, btnFreeCredits)
	btnStars = h.resolveButton(ctx, "btn_stars", lang, btnStars)
	btnBack = h.resolveButton(ctx, "btn_back_gate", lang, btnBack)

	unlockCallback := fmt.Sprintf("unlock:%s:%s", assetType, entity)
	starsCallback := fmt.Sprintf("stars_pack:%s:%s", assetType, entity)

	keyboard := [][]map[string]interface{}{
		{
			{
				"text":          btnUnlock,
				"callback_data": unlockCallback,
			},
		},
	}

	if giftGate != nil {
		miniAppURL := h.getMiniAppURL(bot)
		giftAppURL := appendStartParam(miniAppURL, fmt.Sprintf("gift_%s", giftGate.GiftID))
		pascalName := telegramnft.FormatPascalName(giftGate.ModelID)
		giftTelegramURL := fmt.Sprintf("https://t.me/nft/%s-%d", pascalName, giftGate.SerialNumber)

		var btnMiniApp, btnTelegram string
		switch normalizeLang(lang) {
		case "fa":
			btnMiniApp = "📊 مشاهده نقشه ژنتیکی در مینی‌اپ"
			btnTelegram = "🔗 پیوند رسمی در تلگرام"
		case "ru":
			btnMiniApp = "📊 Открыть в Mini App"
			btnTelegram = "🔗 Официальная ссылка"
		case "zh":
			btnMiniApp = "📊 在小程序中探索"
			btnTelegram = "🔗 Telegram 官方链接"
		default:
			btnMiniApp = "📊 Explore in Mini App"
			btnTelegram = "🔗 Official Link on Telegram"
		}

		keyboard = append(keyboard, []map[string]interface{}{
			{"text": btnMiniApp, "url": giftAppURL},
			{"text": btnTelegram, "url": giftTelegramURL},
		})
	}

	keyboard = append(keyboard,
		[]map[string]interface{}{{"text": btnFreeCredits, "url": "https://t.me/FragmentInvestors"}},
		[]map[string]interface{}{{"text": btnStars, "callback_data": starsCallback}},
		[]map[string]interface{}{{"text": btnBack, "callback_data": "nav:menu"}},
	)

	markup := map[string]interface{}{
		"inline_keyboard": keyboard,
	}

	if messageID == nil && giftGate != nil && giftGate.ImageURL != "" {
		if _, err := tg.SendPhotoWithMarkup(ctx, chatID, giftGate.ImageURL, gateText, markup, threadID, "HTML"); err == nil {
			return
		}
	}

	h.sendOrEditMessage(ctx, tg, chatID, messageID, gateText, markup, threadID)
}

// executeUnlockAndReport consumes 1 credit and produces the full rich appraisal
func (h *WebhookHandler) executeUnlockAndReport(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, assetType string, entity string, messageID *int, threadID *int) {
	tg := h.getBotClient(bot)
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

	// Step 1: Pre-check balance before performing valuation or charging
	bal, balErr := h.intelCreditService.GetBalance(ctx, userID)
	if balErr != nil {
		slog.Error("Failed to fetch user credit balance for unlock gate", "error", balErr, "user_id", userID)
	}
	if bal == nil || bal.Balance < 1 {
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

	// Step 2: Perform valuation upfront and validate result BEFORE charging credit
	var usernameVal *avm.ValuationResult
	var numberVal *nvengine.NumberValuation
	var giftVal *gvengine.GiftValuation
	var valuationValid bool

	switch assetType {
	case "username":
		normUser := strings.TrimPrefix(strings.ToLower(entity), "@")
		if h.avmService != nil {
			if vRes, err := h.avmService.Valuate(ctx, normUser, 0); err == nil && vRes != nil && vRes.ExpectedTON.GreaterThan(decimal.Zero) {
				usernameVal = vRes
				valuationValid = true
			}
		}
	case "number":
		if h.numbersService != nil {
			if vRes, err := h.numbersService.ValuateNumber(ctx, userID, entity); err == nil && vRes != nil && vRes.ExpectedTON.GreaterThan(decimal.Zero) {
				numberVal = vRes
				valuationValid = true
			}
		}
	case "gift":
		if h.giftsService != nil {
			if vRes, err := h.giftsService.GetBotGiftAppraisal(ctx, entity); err == nil && vRes != nil && vRes.Pillars.FairValueGRAM > 0 {
				giftVal = vRes
				valuationValid = true
			}
		}
	default:
		h.sendMainMenu(ctx, bot, chatID, userID, "", messageID, threadID)
		return
	}

	// If valuation failed, return an error message to the user without charging any credit
	if !valuationValid {
		var notFoundMsg, btnRetry, btnBack string
		switch normalizeLang(lang) {
		case "fa":
			notFoundMsg = "⚠️ <b>ارزش‌گذاری دارایی با خطا مواجه شد</b>\n\nاطلاعات کافی برای ارزش‌گذاری منصفانه یافت نشد یا دارایی نامعتبر است. هیچ کریدتی کسر نگردید."
			btnRetry = "🔄 تلاش مجدد"
			btnBack = "🔙 بازگشت به منو"
		case "ru":
			notFoundMsg = "⚠️ <b>Ошибка оценки актива</b>\n\nНедостаточно данных для оценки или неверный актив. Кредиты списаны не были."
			btnRetry = "🔄 Повторить"
			btnBack = "🔙 Назад в меню"
		case "zh":
			notFoundMsg = "⚠️ <b>资产估值失败</b>\n\n未找到足够的数据进行公允估值，或资产无效。未扣除任何信用点。"
			btnRetry = "🔄 重试"
			btnBack = "🔙 返回菜单"
		default:
			notFoundMsg = "⚠️ <b>Asset Valuation Failed</b>\n\nInsufficient market data found or asset is invalid. No credits were deducted."
			btnRetry = "🔄 Retry"
			btnBack = "🔙 Back to Menu"
		}
		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": btnRetry, "callback_data": fmt.Sprintf("unlock:%s:%s", assetType, entity)},
				},
				{
					{"text": btnBack, "callback_data": "nav:menu"},
				},
			},
		}
		h.sendOrEditMessage(ctx, tg, chatID, messageID, notFoundMsg, markup, threadID)
		return
	}

	// Step 3: Consume credit with daily idempotency key
	idemKey := fmt.Sprintf("tg_report:%d:%s:%s:%s", userID, assetType, entity, time.Now().UTC().Format("2006-01-02"))
	remainingBalance, isDuplicate, consumeErr := h.intelCreditService.ConsumeCredit(ctx, userID, "asset_valuation", fmt.Sprintf("%s:%s", assetType, entity), idemKey)
	if consumeErr != nil {
		if errors.Is(consumeErr, repository.ErrInsufficientIntelCredits) {
			var errMsg string
			var btnExchange, btnStars, btnBack string
			costCoins := config.Economics.CreditsCoinsPerCredit
			formattedCost := formatNumberWithCommas(costCoins)
			switch lang {
			case "fa":
				errMsg = "⚠️ <b>اعتبار تحلیلی کافی ندارید!</b>\n\nشما به حداقل <b>۱ کریدت تحلیلی</b> برای مشاهده این گزارش نیاز دارید."
				btnExchange = fmt.Sprintf("🔄 تبدیل %s سکه به کریدت", formattedCost)
				btnStars = "⭐ خرید با Stars"
				btnBack = "🔙 بازگشت"
			case "ru":
				errMsg = "⚠️ <b>Недостаточно кредитов (Intel Credits)!</b>\n\nДля просмотра этого отчета необходим минимум <b>1 кредит</b>."
				btnExchange = fmt.Sprintf("🔄 Обменять %s монет", formattedCost)
				btnStars = "⭐ Купить за Stars"
				btnBack = "🔙 Назад"
			case "zh":
				errMsg = "⚠️ <b>分析信用点不足！</b>\n\n查看此深度报告需要至少 <b>1 个分析信用点</b>。"
				btnExchange = fmt.Sprintf("🔄 兑换 %s 代币", formattedCost)
				btnStars = "⭐ 使用 Stars 购买"
				btnBack = "🔙 返回"
			default:
				errMsg = "⚠️ <b>Insufficient Intel Credits!</b>\n\nYou need at least <b>1 Intel Credit</b> to view this report."
				btnExchange = fmt.Sprintf("🔄 Exchange %s Coins", formattedCost)
				btnStars = "⭐ Buy with Stars"
				btnBack = "🔙 Back"
			}
			markup := map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{
						{"text": btnExchange, "callback_data": fmt.Sprintf("exchange:%s:%s", assetType, entity)},
					},
					{
						{"text": btnStars, "callback_data": fmt.Sprintf("stars_pack:%s:%s", assetType, entity)},
					},
					{
						{"text": btnBack, "callback_data": fmt.Sprintf("precheck:%s:%s", assetType, entity)},
					},
				},
			}
			h.sendOrEditMessage(ctx, tg, chatID, messageID, errMsg, markup, threadID)
			return
		}

		slog.Error("Failed to consume intel credit for report unlock", "error", consumeErr, "user_id", userID, "asset_type", assetType, "entity", entity)
		var retryMsg, btnRetry string
		switch lang {
		case "fa":
			retryMsg = "⚠️ خطا در برقراری ارتباط با پایگاه داده اعتبارات. لطفاً چند لحظه دیگر دوباره تلاش فرمایید."
			btnRetry = "🔄 تلاش مجدد"
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
					{"text": btnRetry, "callback_data": fmt.Sprintf("unlock:%s:%s", assetType, entity)},
				},
				{
					{"text": "🔙", "callback_data": fmt.Sprintf("precheck:%s:%s", assetType, entity)},
				},
			},
		}
		h.sendOrEditMessage(ctx, tg, chatID, messageID, retryMsg, retryMarkup, threadID)
		return
	}

	// Invalidate user profile stats cache in Redis after credit deduction
	if h.cache != nil && h.cache.Client != nil {
		h.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
	}

	// Prepare localized payment status footer
	var creditFooter string
	normL := normalizeLang(lang)
	if isDuplicate {
		switch normL {
		case "fa":
			creditFooter = "\n\n<i>💎 این گزارش امروز قبلاً پرداخت شده و به رایگان نمایش داده شد.</i>"
		case "ru":
			creditFooter = "\n\n<i>💎 Этот отчет уже был оплачен сегодня и показан бесплатно.</i>"
		case "zh":
			creditFooter = "\n\n<i>💎 该报告今日已解锁，本次免费查看。</i>"
		default:
			creditFooter = "\n\n<i>💎 This report was already unlocked today, viewing is free.</i>"
		}
	} else {
		switch normL {
		case "fa":
			creditFooter = fmt.Sprintf("\n\n<i>⚡ ۱ کریدت کسر شد | موجودی: %d</i>", remainingBalance)
		case "ru":
			creditFooter = fmt.Sprintf("\n\n<i>⚡ 1 кредит списан | Баланс: %d</i>", remainingBalance)
		case "zh":
			creditFooter = fmt.Sprintf("\n\n<i>⚡ 已扣除 1 个信用点 | 剩余额度: %d</i>", remainingBalance)
		default:
			creditFooter = fmt.Sprintf("\n\n<i>⚡ 1 credit deducted | Balance: %d</i>", remainingBalance)
		}
	}

	// Step 4: Route delivery and track transmission status
	var deliverErr error
	switch assetType {
	case "username":
		deliverErr = h.renderUsernameReportWithResult(ctx, tg, chatID, userID, entity, miniAppURL, lang, messageID, threadID, usernameVal, creditFooter)
	case "number":
		deliverErr = h.renderNumberReportWithResult(ctx, tg, chatID, userID, entity, miniAppURL, lang, messageID, threadID, numberVal, creditFooter)
	case "gift":
		deliverErr = h.renderGiftReportWithResult(ctx, tg, chatID, userID, entity, miniAppURL, lang, messageID, threadID, giftVal, creditFooter)
	}

	// Step 5: If all delivery channels completely failed and a credit was deducted, refund the credit
	if deliverErr != nil {
		slog.Error("Telegram delivery completely failed for report; initiating refund", "user_id", userID, "asset_type", assetType, "entity", entity, "error", deliverErr)
		if !isDuplicate && h.intelCreditService != nil {
			if rErr := h.intelCreditService.RefundCredit(ctx, userID, "delivery_failure", fmt.Sprintf("%s:%s", assetType, entity)); rErr != nil {
				slog.Error("Failed to refund credit after delivery failure", "user_id", userID, "error", rErr)
			} else if h.cache != nil && h.cache.Client != nil {
				h.cache.Client.Del(ctx, fmt.Sprintf("profile:stats:%d", userID))
			}
		}
	}
}

// renderUsernameReport produces rich analytical valuation of a username
func (h *WebhookHandler) renderUsernameReport(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, _ int64, username string, miniAppURL string, lang string, messageID *int, threadID *int) {
	normUser := strings.TrimPrefix(strings.ToLower(username), "@")
	var res *avm.ValuationResult
	if h.avmService != nil {
		res, _ = h.avmService.Valuate(ctx, normUser, 0)
	}
	_ = h.renderUsernameReportWithResult(ctx, tg, chatID, 0, username, miniAppURL, lang, messageID, threadID, res, "")
}

func (h *WebhookHandler) renderUsernameReportWithResult(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, _ int64, username string, miniAppURL string, lang string, messageID *int, threadID *int, res *avm.ValuationResult, creditFooter string) error {
	normUser := strings.TrimPrefix(strings.ToLower(username), "@")
	appURL := appendStartParam(miniAppURL, fmt.Sprintf("val_%s", normUser))

	var tier string = "STANDARD"
	var expectedTONStr string = "0.0"
	var expectedUSDStr string = "0"
	var brandability int = 50

	if res != nil {
		tier = res.InvestmentGrade
		expectedTONStr = res.ExpectedTON.StringFixed(1)
		expectedUSDStr = res.ExpectedUSD.StringFixed(0)
		brandability = res.Brandability
	}

	richHTML := buildUsernameRichHTML(normUser, res, lang) + creditFooter
	standardHTML := buildUsernameStandardHTML(normUser, res, lang) + creditFooter

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

	var photoSent bool
	// Hybrid Visual Card + Rich Message Delivery
	if h.cardGen != nil && tg != nil {
		cardP := cardgen.UsernameCardParams{
			Username:     normUser,
			Grade:        tier,
			FairTON:      expectedTONStr,
			USDT:         expectedUSDStr,
			Brandability: brandability,
			Lang:         lang,
		}
		if res != nil {
			cardP.LowTON = res.LowTON.StringFixed(1)
			cardP.HighTON = res.HighTON.StringFixed(1)
			cardP.Length = res.Length
			cardP.MarketStatus = res.Status
			cardP.CompsCount = res.ComparableSales
			cardP.Confidence = int(res.ConfidenceScore)
		}

		if pngBytes, err := h.cardGen.GenerateRichUsernameCard(cardP); err == nil {
			_, _ = h.cardGen.SaveCard(pngBytes)
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
			if _, photoErr := tg.SendPhotoBytesWithMarkup(ctx, chatID, pngBytes, photoCaption, nil, threadID); photoErr == nil {
				photoSent = true
			} else {
				slog.Error("failed to send username valuation photo bytes", "username", normUser, "error", photoErr)
			}
			if _, err := tg.SendRichMessageWithMarkup(ctx, chatID, map[string]interface{}{"html": richHTML}, markup, threadID); err == nil {
				return nil
			}
			if _, err := tg.SendMessageWithMarkup(ctx, chatID, standardHTML, markup, threadID); err == nil {
				return nil
			}
			if photoSent {
				return nil
			}
			return errors.New("failed to deliver username report")
		}
	}

	if messageID != nil {
		if err := tg.EditRichMessageWithMarkup(ctx, chatID, *messageID, map[string]interface{}{"html": richHTML}, markup); err == nil {
			return nil
		}
		if err := tg.EditMessageTextWithMarkup(ctx, chatID, *messageID, standardHTML, markup); err == nil {
			return nil
		}
	} else {
		if _, err := tg.SendRichMessageWithMarkup(ctx, chatID, map[string]interface{}{"html": richHTML}, markup, threadID); err == nil {
			return nil
		}
		if _, err := tg.SendMessageWithMarkup(ctx, chatID, standardHTML, markup, threadID); err == nil {
			return nil
		}
	}
	return errors.New("failed to deliver username report to telegram")
}

// renderNumberReport produces rich analytical valuation of a +888 number
func (h *WebhookHandler) renderNumberReport(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, userID int64, number string, miniAppURL string, lang string, messageID *int, threadID *int) {
	var val *nvengine.NumberValuation
	if h.numbersService != nil {
		val, _ = h.numbersService.ValuateNumber(ctx, userID, number)
	}
	_ = h.renderNumberReportWithResult(ctx, tg, chatID, userID, number, miniAppURL, lang, messageID, threadID, val, "")
}

func (h *WebhookHandler) renderNumberReportWithResult(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, _ int64, number string, miniAppURL string, lang string, messageID *int, threadID *int, val *nvengine.NumberValuation, creditFooter string) error {
	cleanNum := features.CleanNumber(number)
	displayNum := number
	appURL := appendStartParam(miniAppURL, fmt.Sprintf("num_%s", cleanNum))

	var club string = "کلکسیونی"
	var globalRank int = 0
	var tonStr string = "0.0"
	var usdStr string = "0"

	if val != nil {
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

	richHTML := buildNumberRichHTML(val, lang) + creditFooter
	standardHTML := buildNumberStandardHTML(val, displayNum, lang) + creditFooter

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
	var directFragURL string
	if val != nil && val.FragmentDirectURL != "" {
		directFragURL = val.FragmentDirectURL
	}
	markup := buildNumberMarkup(cleanNum, displayNum, appURL, copySummary, lang, directFragURL)

	var photoSent bool
	// Hybrid Visual Card + Rich Message Delivery
	if h.cardGen != nil && tg != nil {
		cardClub := club
		if val != nil && val.CategoryClub != "" {
			cardClub = val.CategoryClub
		}
		cardP := cardgen.NumberCardParams{
			Number:  displayNum,
			Club:    cardClub,
			Rank:    globalRank,
			FairTON: tonStr,
			USDT:    usdStr,
			Lang:    lang,
		}
		if val != nil {
			cardP.LowTON = val.LowTON.StringFixed(1)
			cardP.HighTON = val.HighTON.StringFixed(1)
			cardP.ColorPattern = val.Color.Name
		}

		if pngBytes, err := h.cardGen.GenerateRichNumberCard(cardP); err == nil {
			_, _ = h.cardGen.SaveCard(pngBytes)
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
			if _, photoErr := tg.SendPhotoBytesWithMarkup(ctx, chatID, pngBytes, photoCaption, nil, threadID); photoErr == nil {
				photoSent = true
			} else {
				slog.Error("failed to send number valuation photo bytes", "number", displayNum, "error", photoErr)
			}

			if _, err := tg.SendRichMessageWithMarkup(ctx, chatID, map[string]interface{}{"html": richHTML}, markup, threadID); err == nil {
				return nil
			}
			if _, err := tg.SendMessageWithMarkup(ctx, chatID, standardHTML, markup, threadID); err == nil {
				return nil
			}
			if photoSent {
				return nil
			}
			return errors.New("failed to deliver number report")
		}
	}

	if messageID != nil {
		if err := tg.EditRichMessageWithMarkup(ctx, chatID, *messageID, map[string]interface{}{"html": richHTML}, markup); err == nil {
			return nil
		}
		if err := tg.EditMessageTextWithMarkup(ctx, chatID, *messageID, standardHTML, markup); err == nil {
			return nil
		}
	} else {
		if _, err := tg.SendRichMessageWithMarkup(ctx, chatID, map[string]interface{}{"html": richHTML}, markup, threadID); err == nil {
			return nil
		}
		if _, err := tg.SendMessageWithMarkup(ctx, chatID, standardHTML, markup, threadID); err == nil {
			return nil
		}
	}
	return errors.New("failed to deliver number report to telegram")
}

// renderGiftReport produces rich appraisal for gifts
func (h *WebhookHandler) renderGiftReport(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, _ int64, giftSlug string, miniAppURL string, lang string, messageID *int, threadID *int) {
	var appraisal *gvengine.GiftValuation
	if h.giftsService != nil {
		appraisal, _ = h.giftsService.GetBotGiftAppraisal(ctx, giftSlug)
	}
	_ = h.renderGiftReportWithResult(ctx, tg, chatID, 0, giftSlug, miniAppURL, lang, messageID, threadID, appraisal, "")
}

func (h *WebhookHandler) renderGiftReportWithResult(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, _ int64, giftSlug string, miniAppURL string, lang string, messageID *int, threadID *int, appraisal *gvengine.GiftValuation, creditFooter string) error {
	if appraisal != nil {
		richHTML := buildGiftRichHTML(appraisal, lang) + creditFooter
		standardText, _ := h.formatGiftAppraisalMessage(appraisal, miniAppURL, lang)
		standardText += creditFooter

		var tonRate float64
		var rateSource string
		var rateFetchedAt time.Time
		var rateStale bool
		var rateOk bool
		if h.cryptoPrice != nil {
			tonRate, rateSource, rateFetchedAt, rateStale, rateOk = h.cryptoPrice.GetTONUSDT(ctx)
		}
		expectedUSDFormatted := formatUSDT(appraisal.ExpectedUSD, rateOk && tonRate > 0, lang)
		rateRefLine := buildRateReferenceLine(tonRate, rateSource, rateFetchedAt, rateStale, rateOk && tonRate > 0, lang)

		tonStr := fmt.Sprintf("%.1f", appraisal.Pillars.FairValueGRAM)
		usdStr := expectedUSDFormatted
		rarityTier := formatLocalizedRarityTier(appraisal.JointRarity.RarityClass, lang)

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

		var photoSent bool
		// Hybrid Visual Card + Rich Message Delivery
		if h.cardGen != nil && tg != nil {
			giftParams := buildGiftCardParams(appraisal, lang)
			if pngBytes, err := h.cardGen.GenerateRichGiftCard(giftParams); err == nil {
				_, _ = h.cardGen.SaveCard(pngBytes)
				var photoCaption string
				switch normalizeLang(lang) {
				case "fa":
					photoCaption = fmt.Sprintf("🎁 <b>کارت تحلیلی: %s</b>\n💎 رده: <b>%s</b>\n💰 برآورد منصفانه: <b>~%s TON (%s)</b>\n%s", appraisal.DisplayTitle, rarityTier, tonStr, usdStr, rateRefLine)
				case "ru":
					photoCaption = fmt.Sprintf("🎁 <b>Карта оценки подарка: %s</b>\n💎 Класс: <b>%s</b>\n💰 Справедливая цена: <b>~%s TON (%s)</b>\n%s", appraisal.DisplayTitle, rarityTier, tonStr, usdStr, rateRefLine)
				case "zh":
					photoCaption = fmt.Sprintf("🎁 <b>礼物估值卡: %s</b>\n💎 评级: <b>%s</b>\n💰 公允价值: <b>~%s TON (%s)</b>\n%s", appraisal.DisplayTitle, rarityTier, tonStr, usdStr, rateRefLine)
				default:
					photoCaption = fmt.Sprintf("🎁 <b>Gift Valuation Card: %s</b>\n💎 Tier: <b>%s</b>\n💰 Fair Value: <b>~%s TON (%s)</b>\n%s", appraisal.DisplayTitle, rarityTier, tonStr, usdStr, rateRefLine)
				}
				if messageID != nil {
					_ = tg.DeleteMessage(ctx, chatID, *messageID)
				}
				if _, photoErr := tg.SendPhotoBytesWithMarkup(ctx, chatID, pngBytes, photoCaption, nil, threadID); photoErr == nil {
					photoSent = true
				} else {
					slog.Error("failed to send gift valuation photo bytes", "gift", appraisal.DisplayTitle, "error", photoErr)
				}

				if _, err := tg.SendRichMessageWithMarkup(ctx, chatID, map[string]interface{}{"html": richHTML}, markup, threadID); err == nil {
					return nil
				}
				if _, err := tg.SendMessageWithMarkup(ctx, chatID, standardText, markup, threadID); err == nil {
					return nil
				}
				if photoSent {
					return nil
				}
				return errors.New("failed to deliver gift report")
			}
		}

		if !photoSent && appraisal.ImageURL != "" && tg != nil {
			var photoCaption string
			switch normalizeLang(lang) {
			case "fa":
				photoCaption = fmt.Sprintf("🎁 <b>کارت تحلیلی: %s</b>\n💎 رده: <b>%s</b>\n💰 برآورد منصفانه: <b>~%s TON (%s)</b>\n%s", appraisal.DisplayTitle, rarityTier, tonStr, usdStr, rateRefLine)
			case "ru":
				photoCaption = fmt.Sprintf("🎁 <b>Карта оценки подарка: %s</b>\n💎 Класс: <b>%s</b>\n💰 Справедливая цена: <b>~%s TON (%s)</b>\n%s", appraisal.DisplayTitle, rarityTier, tonStr, usdStr, rateRefLine)
			case "zh":
				photoCaption = fmt.Sprintf("🎁 <b>礼物估值卡: %s</b>\n💎 评级: <b>%s</b>\n💰 公允价值: <b>~%s TON (%s)</b>\n%s", appraisal.DisplayTitle, rarityTier, tonStr, usdStr, rateRefLine)
			default:
				photoCaption = fmt.Sprintf("🎁 <b>Gift Valuation Card: %s</b>\n💎 Tier: <b>%s</b>\n💰 Fair Value: <b>~%s TON (%s)</b>\n%s", appraisal.DisplayTitle, rarityTier, tonStr, usdStr, rateRefLine)
			}
			if messageID != nil {
				_ = tg.DeleteMessage(ctx, chatID, *messageID)
			}
			if _, photoErr := tg.SendPhotoWithMarkup(ctx, chatID, appraisal.ImageURL, photoCaption, nil, threadID); photoErr == nil {
				photoSent = true
			}
		}

		if messageID != nil {
			if err := tg.EditRichMessageWithMarkup(ctx, chatID, *messageID, map[string]interface{}{"html": richHTML}, markup); err == nil {
				return nil
			}
			if err := tg.EditMessageTextWithMarkup(ctx, chatID, *messageID, standardText, markup); err == nil {
				return nil
			}
		} else {
			if _, err := tg.SendRichMessageWithMarkup(ctx, chatID, map[string]interface{}{"html": richHTML}, markup, threadID); err == nil {
				return nil
			}
			if _, err := tg.SendMessageWithMarkup(ctx, chatID, standardText, markup, threadID); err == nil {
				return nil
			}
		}
		return errors.New("failed to deliver gift report to telegram")
	}

	var notFoundText string
	switch normalizeLang(lang) {
	case "fa":
		notFoundText = "🎁 <b>این گیفت پیدا نشد، لینک را چک کنید</b>"
	case "ru":
		notFoundText = "🎁 <b>Этот подарок не найден, проверьте ссылку</b>"
	case "zh":
		notFoundText = "🎁 <b>未找到该礼物，请检查链接</b>"
	default:
		notFoundText = "🎁 <b>Gift not found, please check the link</b>"
	}

	var btnBack string
	switch normalizeLang(lang) {
	case "fa":
		btnBack = "🔙 بازگشت به منو"
	case "ru":
		btnBack = "🔙 Назад в меню"
	case "zh":
		btnBack = "🔙 返回菜单"
	default:
		btnBack = "🔙 Back to Menu"
	}

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
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
	return nil
}


// sendExchangeConfirmView informs user that free credits can be earned via @FragmentInvestors or purchased with Stars.
func (h *WebhookHandler) sendExchangeConfirmView(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, returnAssetType string, returnEntity string, messageID *int, threadID *int) {
	tg := h.getBotClient(bot)
	if tg == nil {
		return
	}

	userLang, _ := h.db.GetUserLanguage(ctx, userID)
	lang := i18n.DetectLanguage(userLang)

	var intelCredits int = 0
	if h.intelCreditService == nil && h.db != nil {
		h.intelCreditService = intelcredit.NewIntelCreditService(h.db)
	}
	if h.intelCreditService != nil {
		if bal, err := h.intelCreditService.GetBalance(ctx, userID); err == nil && bal != nil {
			intelCredits = bal.Balance
		}
	}

	var text, btnFreeCredits, btnBuyStars, btnBack string
	switch lang {
	case "fa":
		text = fmt.Sprintf(`<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>دریافت کریدت تحلیلی | Intel Credits</b>

موجودی فعلی شما: <b>%d کریدت</b>

💬 <b>دریافت کریدت کاملاً رایگان:</b>
با فعالیت در گروه رسمی <b>@FragmentInvestors</b> می‌توانید کریدت نامحدود دریافت کنید:
• <b>هر ۱ پیام در گروه = ۱ کریدت تحلیلی رایگان!</b>
• <b>به ازای هر ۲ بوست گروه = روزانه ۱ کریدت رایگان!</b>

⭐ همچنین می‌توانید بسته‌های اعتباری را مستقیماً با <b>Telegram Stars</b> خریداری نمایید.`,
			CustomEmojiBolt, intelCredits)
		btnFreeCredits = "💬 ورود و چت در گروه (@FragmentInvestors)"
		btnBuyStars = "⭐ خرید کریدت با Telegram Stars"
		btnBack = "🔙 بازگشت"

	case "ru":
		text = fmt.Sprintf(`<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>Получение Intel Credits</b>

Ваш текущий баланс: <b>%d кредитов</b>

💬 <b>Бесплатные кредиты:</b>
Проявляйте активность в нашей группе <b>@FragmentInvestors</b>:
• <b>1 сообщение в группе = 1 бесплатный Intel Credit!</b>
• <b>Каждые 2 буста группы = 1 кредит ежедневно!</b>

⭐ Также вы можете приобрести кредиты за <b>Telegram Stars</b>.`,
			CustomEmojiBolt, intelCredits)
		btnFreeCredits = "💬 Чат в группе (@FragmentInvestors)"
		btnBuyStars = "⭐ Купить за Telegram Stars"
		btnBack = "🔙 Назад"

	case "zh":
		text = fmt.Sprintf(`<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>获取分析信用点 (Intel Credits)</b>

当前余额: <b>%d 信用点</b>

💬 <b>免费获取信用点:</b>
在官方社群 <b>@FragmentInvestors</b> 中活跃交流:
• <b>群内每发送 1 条消息 = 获得 1 个免费分析信用点！</b>
• <b>群组每提供 2 次 Boost 助力 = 每日获赠 1 个信用点！</b>

⭐ 您也可以直接使用 <b>Telegram Stars</b> 购买信用点礼包。`,
			CustomEmojiBolt, intelCredits)
		btnFreeCredits = "💬 进入群组交流 (@FragmentInvestors)"
		btnBuyStars = "⭐ 使用 Telegram Stars 购买"
		btnBack = "🔙 返回"

	default:
		text = fmt.Sprintf(`<tg-emoji emoji-id="%s">⚡</tg-emoji> <b>Get Intel Credits</b>

Current Balance: <b>%d Credits</b>

💬 <b>Earn Free Credits:</b>
Engage actively in our official group <b>@FragmentInvestors</b>:
• <b>Every 1 message in the group = 1 Free Intel Credit!</b>
• <b>Every 2 group boosts = 1 Free Credit daily!</b>

⭐ You can also purchase credit packs directly using <b>Telegram Stars</b>.`,
			CustomEmojiBolt, intelCredits)
		btnFreeCredits = "💬 Chat in Group (@FragmentInvestors)"
		btnBuyStars = "⭐ Buy with Telegram Stars"
		btnBack = "🔙 Back"
	}

	backCallback := "nav:profile"
	if returnAssetType != "" && returnEntity != "" {
		backCallback = fmt.Sprintf("precheck:%s:%s", returnAssetType, returnEntity)
	}

	starsCallback := "buy_credits:profile"
	if returnAssetType != "" && returnEntity != "" {
		starsCallback = fmt.Sprintf("stars_pack:%s:%s", returnAssetType, returnEntity)
	}

	keyboard := [][]map[string]interface{}{
		{
			{
				"text": btnFreeCredits,
				"url":  "https://t.me/FragmentInvestors",
			},
		},
		{
			{
				"text":          btnBuyStars,
				"callback_data": starsCallback,
			},
		},
		{
			{
				"text":          btnBack,
				"callback_data": backCallback,
			},
		},
	}

	markup := map[string]interface{}{
		"inline_keyboard": keyboard,
	}

	h.sendOrEditMessage(ctx, tg, chatID, messageID, text, markup, threadID)
}

// handleCreditExchange informs user about free group credits and routes to stars/group
func (h *WebhookHandler) handleCreditExchange(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, returnAssetType string, returnEntity string, messageID *int, threadID *int, callbackQueryID string, count int) {
	tg := h.getBotClient(bot)
	if tg == nil {
		return
	}
	if callbackQueryID != "" {
		_ = tg.AnswerCallbackQuery(ctx, callbackQueryID, "💬 برای دریافت کریدت رایگان در گروه @FragmentInvestors پیام بفرستید!", true)
	}
	h.sendExchangeConfirmView(ctx, bot, chatID, userID, returnAssetType, returnEntity, messageID, threadID)
}

// sendStarsPacksList shows available credit packs to purchase with Telegram Stars
func (h *WebhookHandler) sendStarsPacksList(ctx context.Context, bot *repository.ManagedBot, chatID int64, userID int64, returnAssetType string, returnEntity string, messageID *int, threadID *int) {
	tg := h.getBotClient(bot)
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
	tg := h.getBotClient(bot)
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
// If telegram rejects due to custom emojis or entity formatting, it retries with stripped custom emoji,
// and finally with plain text (stripped HTML) to ensure delivery.
func (h *WebhookHandler) sendOrEditMessage(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, messageID *int, text string, markup interface{}, threadID *int) {
	if tg == nil {
		return
	}
	formattedText := text
	if !isPremiumEmojiEnabled() {
		formattedText = stripCustomEmoji(formattedText)
	} else {
		formattedText = filterDenylistedCustomEmojis(formattedText)
	}

	isEntityOrEmojiError := func(err error) bool {
		if err == nil {
			return false
		}
		errMsg := strings.ToLower(err.Error())
		return strings.Contains(errMsg, "entity") ||
			strings.Contains(errMsg, "entities") ||
			strings.Contains(errMsg, "emoji") ||
			strings.Contains(errMsg, "document_invalid") ||
			strings.Contains(errMsg, "can't parse") ||
			strings.Contains(errMsg, "cant parse")
	}

	isNotModifiedError := func(err error) bool {
		if err == nil {
			return false
		}
		return strings.Contains(strings.ToLower(err.Error()), "message is not modified")
	}

	// 1. Attempt Edit if messageID is provided
	if messageID != nil {
		err := tg.EditMessageTextWithMarkup(ctx, chatID, *messageID, formattedText, markup)
		if err == nil {
			return
		}

		if isNotModifiedError(err) {
			// Message content hasn't changed; return silently as requested
			return
		}

		slog.Error("Telegram EditMessageTextWithMarkup failed", "error", err, "chat_id", chatID, "message_id", *messageID)

		// Always attempt fallback with stripped custom emojis first if formattedText had any
		stripped := stripCustomEmoji(formattedText)
		if stripped != formattedText {
			if retryErr := tg.EditMessageTextWithMarkup(ctx, chatID, *messageID, stripped, markup); retryErr == nil {
				return
			} else if isNotModifiedError(retryErr) {
				return
			} else {
				slog.Error("Telegram EditMessageTextWithMarkup retry without custom emoji failed", "error", retryErr, "chat_id", chatID, "message_id", *messageID)
			}
		}

		if isEntityOrEmojiError(err) {
			// Retry 2: Plain text (all HTML stripped)
			plainText := StripHTML(stripped)
			if plainErr := tg.EditMessageTextWithMarkup(ctx, chatID, *messageID, plainText, markup, ""); plainErr == nil {
				return
			} else if isNotModifiedError(plainErr) {
				return
			} else {
				slog.Error("Telegram EditMessageTextWithMarkup retry with plain text failed", "error", plainErr, "chat_id", chatID, "message_id", *messageID)
			}
		}
	}

	// 2. Fallback to SendMessageWithMarkup
	res, sendErr := tg.SendMessageWithMarkup(ctx, chatID, formattedText, markup, threadID)
	if sendErr == nil && res != nil {
		return
	}

	if sendErr != nil {
		slog.Error("Telegram SendMessageWithMarkup failed", "error", sendErr, "chat_id", chatID)
		stripped := stripCustomEmoji(formattedText)
		if stripped != formattedText {
			resRetry, errRetry := tg.SendMessageWithMarkup(ctx, chatID, stripped, markup, threadID)
			if errRetry == nil && resRetry != nil {
				return
			}
			slog.Error("Telegram SendMessageWithMarkup retry without custom emoji failed", "error", errRetry, "chat_id", chatID)
		}

		if isEntityOrEmojiError(sendErr) {
			// Retry 2: Plain text fallback (all HTML stripped, parse_mode disabled)
			plainText := StripHTML(stripped)
			_, errPlain := tg.SendMessageWithMarkup(ctx, chatID, plainText, markup, threadID, "")
			if errPlain != nil {
				slog.Error("Telegram SendMessageWithMarkup plain text fallback failed", "error", errPlain, "chat_id", chatID)
			}
		}
	}
}

func formatLocalizedRarityTier(rc, lang string) string {
	norm := strings.ToLower(strings.TrimSpace(rc))
	switch normalizeLang(lang) {
	case "fa":
		switch {
		case strings.Contains(norm, "legendary"), strings.Contains(norm, "exclusive"), strings.Contains(norm, "genesis"):
			return "افسانه‌ای (Exclusive)"
		case strings.Contains(norm, "epic"), strings.Contains(norm, "flame"):
			return "حماسی (Epic)"
		case strings.Contains(norm, "unique"), strings.Contains(norm, "minted"):
			return "منحصربه‌فرد (Unique)"
		case strings.Contains(norm, "rare"), strings.Contains(norm, "apex"):
			return "کمیاب (Rare)"
		default:
			return "کلکسیونی (Collectible)"
		}
	case "ru":
		switch {
		case strings.Contains(norm, "legendary"), strings.Contains(norm, "exclusive"), strings.Contains(norm, "genesis"):
			return "Легендарный (Exclusive)"
		case strings.Contains(norm, "epic"), strings.Contains(norm, "flame"):
			return "Эпический (Epic)"
		case strings.Contains(norm, "unique"), strings.Contains(norm, "minted"):
			return "Уникальный (Unique)"
		case strings.Contains(norm, "rare"), strings.Contains(norm, "apex"):
			return "Редкий (Rare)"
		default:
			return "Коллекционный (Collectible)"
		}
	case "zh":
		switch {
		case strings.Contains(norm, "legendary"), strings.Contains(norm, "exclusive"), strings.Contains(norm, "genesis"):
			return "传奇 (Exclusive)"
		case strings.Contains(norm, "epic"), strings.Contains(norm, "flame"):
			return "史诗 (Epic)"
		case strings.Contains(norm, "unique"), strings.Contains(norm, "minted"):
			return "独特 (Unique)"
		case strings.Contains(norm, "rare"), strings.Contains(norm, "apex"):
			return "稀有 (Rare)"
		default:
			return "收藏级 (Collectible)"
		}
	default:
		if rc != "" {
			return rc
		}
		return "Collectible"
	}
}


