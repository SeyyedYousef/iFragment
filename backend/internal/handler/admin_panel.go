package handler

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/config"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/intelcredit"
)

// Supported languages for bot texts & buttons
var supportedLanguages = []struct {
	Code string
	Name string
	Flag string
}{
	{"fa", "فارسی", "🇮🇷"},
	{"en", "English", "🇺🇸"},
	{"ru", "Русский", "🇷🇺"},
	{"zh", "中文", "🇨🇳"},
}

// Editable bot texts definition
type BotTextDef struct {
	Key         string
	Title       string
	Description string
	Variables   string
}

var botTextDefs = []BotTextDef{
	{
		Key:         "start_menu",
		Title:       "پیام شروع و خوش‌آمدگویی",
		Description: "متن اصلی داشبورد ربات هنگام ارسال /start",
		Variables:   "{name} (نام کاربر), {diamond} (ایموجی برند)",
	},
	{
		Key:         "profile_view",
		Title:       "پروفایل و دارایی‌های کاربر",
		Description: "متن صفحه دارایی‌ها شامل سکه‌ها، کردیت‌ها و رفرال",
		Variables:   "{name}, {id}, {level}, {rank}, {coins}, {credits}, {reflink}",
	},
	{
		Key:         "prompt_username",
		Title:       "راهنمای استعلام نام کاربری",
		Description: "پیامی که پس از کلیک روی دکمه نام کاربری ارسال می‌شود",
		Variables:   "بدون متغیر خاص",
	},
	{
		Key:         "prompt_number",
		Title:       "راهنمای استعلام شماره ناشناس (+888)",
		Description: "پیامی که پس از کلیک روی دکمه شماره‌های رند ارسال می‌شود",
		Variables:   "بدون متغیر خاص",
	},
	{
		Key:         "prompt_gift",
		Title:       "راهنمای استعلام گیفت‌های تلگرام",
		Description: "پیامی که پس از کلیک روی دکمه گیفت‌ها ارسال می‌شود",
		Variables:   "بدون متغیر خاص",
	},
	{
		Key:         "precheck_gate",
		Title:       "دروازه پیش‌بررسی (Pre-Check Gate)",
		Description: "صفحه تأیید قبل از کسر ۱ کردیت و بازگشایی گزارش",
		Variables:   "{type}, {entity}, {coins}, {credits}, {cost_coins}",
	},
	{
		Key:         "exchange_confirm",
		Title:       "تأییدیه تبدیل سکه به کردیت",
		Description: "متن سؤال از کاربر قبل از تبدیل ۱۵۰,۰۰۰ سکه به ۱ کردیت",
		Variables:   "{coins}, {credits}, {cost_coins}",
	},
	{
		Key:         "exchange_success",
		Title:       "نتیجه موفق تبدیل سکه",
		Description: "پیام موفقیت‌آمیز بودن کسر سکه و شارژ کردیت",
		Variables:   "{cost_coins}, {credits}",
	},
	{
		Key:         "exchange_fail",
		Title:       "نتیجه ناموفق (موجودی ناکافی سکه)",
		Description: "پیام اخطار در صورت کمتر بودن سکه از حد نصاب",
		Variables:   "{cost_coins}",
	},
	{
		Key:         "help_view",
		Title:       "راهنما و متدولوژی ربات",
		Description: "متن دستورالعمل‌ها و نحوه کار با هوش مصنوعی iFragment",
		Variables:   "بدون متغیر خاص",
	},
}

// Editable bot inline buttons definition
type BotButtonDef struct {
	Key         string
	Title       string
	Description string
}

var botButtonDefs = []BotButtonDef{
	{Key: "btn_mini_app", Title: "دکمه ورود به مینی‌اپ", Description: "دکمه عریض اصلی داشبورد"},
	{Key: "btn_usernames", Title: "دکمه نام‌های کاربری", Description: "دکمه استعلام یوزرنیم"},
	{Key: "btn_numbers", Title: "دکمه شماره‌های رند (+888)", Description: "دکمه استعلام شماره ناشناس"},
	{Key: "btn_gifts", Title: "دکمه گیفت‌های تلگرام", Description: "دکمه استعلام NFT گیفت‌ها"},
	{Key: "btn_profile", Title: "دکمه پروفایل و دارایی‌ها", Description: "دکمه ورود به بخش دارایی‌ها"},
	{Key: "btn_language", Title: "دکمه تغییر زبان", Description: "دکمه انتخاب زبان"},
	{Key: "btn_help", Title: "دکمه راهنما", Description: "دکمه مشاهده دستورالعمل‌ها"},
	{Key: "btn_exchange", Title: "دکمه تبدیل سکه به کردیت", Description: "دکمه اکشن تبدیل سکه در پروفایل"},
	{Key: "btn_stars", Title: "دکمه خرید با Stars", Description: "دکمه بسته‌های تلگرام استارز"},
	{Key: "btn_unlock", Title: "دکمه بازکردن گزارش (Unlock)", Description: "دکمه مصرف ۱ کردیت برای گزارش"},
	{Key: "btn_back", Title: "دکمه بازگشت (عمومی)", Description: "دکمه بازگشت پیش‌فرض"},
	{Key: "btn_back_menu", Title: "دکمه بازگشت به منو", Description: "دکمه بازگشت به منوی اصلی"},
	{Key: "btn_back_gate", Title: "دکمه بازگشت به گیت", Description: "دکمه بازگشت به تأییدیه ارزیابی"},
	{Key: "btn_cancel", Title: "دکمه انصراف", Description: "دکمه لغو عملیات"},
}

// isBotOwner checks if the given Telegram user ID has owner permissions.
func (h *WebhookHandler) isBotOwner(ctx context.Context, bot *repository.ManagedBot, userID int64) bool {
	if bot != nil && bot.OwnerUserID > 0 && bot.OwnerUserID == userID {
		return true
	}

	if envOwner := os.Getenv("OWNER_TELEGRAM_ID"); envOwner != "" {
		if id, err := strconv.ParseInt(envOwner, 10, 64); err == nil && id == userID {
			return true
		}
	}

	if h.ownerRepo != nil {
		role, err := h.ownerRepo.GetOwnerRole(ctx, userID)
		if err == nil && role != nil {
			return role.Role == "superadmin" || role.Role == "owner" || role.Role == "admin"
		}
	}

	return false
}

// handleAdminPanelCommand processes the /panel or /admin command for the bot owner
func (h *WebhookHandler) handleAdminPanelCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	if !h.isBotOwner(ctx, bot, m.From.ID) {
		tg := h.getBotClient(bot)
		if tg != nil {
			_ = tg.SendMessage(ctx, m.Chat.ID, "⛔ شما به این بخش دسترسی ندارید.", &m.MessageID, m.MessageThreadID)
		}
		return
	}

	h.sendAdminPanelMenu(ctx, bot, m.Chat.ID, m.From.ID, nil, m.MessageThreadID)
}

// sendAdminPanelMenu renders the main /panel dashboard for the owner
func (h *WebhookHandler) sendAdminPanelMenu(ctx context.Context, bot *repository.ManagedBot, chatID int64, _ int64, messageID *int, threadID *int) {
	tg := h.getBotClient(bot)
	if tg == nil {
		return
	}

	panelText := `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>پنل مدیریت اختصاصی iFragment | Owner Dashboard</b>

درود مالک گرامی! به ترمینال مدیریت و سفارشی‌سازی ربات خوش آمدید.
شما می‌توانید تمامی متون و نام دکمه‌های شیشه‌ای را به تفکیک ۴ زبان اصلی تغییر دهید و از ایموجی‌های پرمیوم استفاده کنید.

لطفاً بخش مورد نظر را انتخاب فرمایید:`

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{
					"text":          "📝 تغییر متن‌های ربات",
					"callback_data": "panel:choose_lang:texts",
				},
				{
					"text":          "🔘 تغییر نام دکمه‌های شیشه‌ای",
					"callback_data": "panel:choose_lang:buttons",
				},
			},
			{
				{
					"text":          "🎨 راهنمای ایموجی‌های پرمیوم",
					"callback_data": "panel:emojis",
				},
				{
					"text":          "📊 آمار زنده سیستم",
					"callback_data": "panel:stats",
				},
			},
			{
				{
					"text":          "⚡ پارامترهای اقتصادی و کردیت",
					"callback_data": "panel:credits",
				},
			},
			{
				{
					"text":          "🔙 خروج و بازگشت به منوی ربات",
					"callback_data": "nav:menu",
				},
			},
		},
	}

	h.sendOrEditMessage(ctx, tg, chatID, messageID, panelText, markup, threadID)
}

// sendLanguageSelection shows language picker for texts or buttons
func (h *WebhookHandler) sendLanguageSelection(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, targetType string, messageID *int, threadID *int) {
	var typeName string
	if targetType == "texts" {
		typeName = "متن‌های ربات"
	} else {
		typeName = "دکمه‌های شیشه‌ای"
	}

	text := fmt.Sprintf(`🌐 <b>انتخاب زبان برای ویرایش %s</b>

لطفاً زبانی که مایل به سفارشی‌سازی %s در آن هستید را انتخاب نمایید:`, typeName, typeName)

	var rows [][]map[string]interface{}
	for _, l := range supportedLanguages {
		rows = append(rows, []map[string]interface{}{
			{
				"text":          fmt.Sprintf("%s %s (%s)", l.Flag, l.Name, strings.ToUpper(l.Code)),
				"callback_data": fmt.Sprintf("panel:list:%s:%s", targetType, l.Code),
			},
		})
	}
	rows = append(rows, []map[string]interface{}{
		{
			"text":          "🔙 بازگشت به پنل اصلی",
			"callback_data": "panel:main",
		},
	})

	markup := map[string]interface{}{
		"inline_keyboard": rows,
	}
	h.sendOrEditMessage(ctx, tg, chatID, messageID, text, markup, threadID)
}

// sendItemsList shows the list of all editable texts or buttons in the chosen language
func (h *WebhookHandler) sendItemsList(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, targetType, lang string, messageID *int, threadID *int) {
	var langName string
	for _, l := range supportedLanguages {
		if l.Code == lang {
			langName = fmt.Sprintf("%s %s", l.Flag, l.Name)
			break
		}
	}

	var rows [][]map[string]interface{}

	if targetType == "texts" {
		text := fmt.Sprintf(`📝 <b>لیست پیام‌های ربات برای زبان: %s</b>

روی هر پیام کلیک کنید تا متن فعلی را مشاهده نموده، آن را تغییر دهید یا به حالت پیش‌فرض بازنشانی کنید:`, langName)

		for _, item := range botTextDefs {
			custom, _ := h.templateRepo.GetTemplate(ctx, item.Key, lang)
			tag := ""
			if custom != "" {
				tag = " (✏️ سفارشی)"
			}
			rows = append(rows, []map[string]interface{}{
				{
					"text":          item.Title + tag,
					"callback_data": fmt.Sprintf("panel:view:text:%s:%s", lang, item.Key),
				},
			})
		}
		rows = append(rows, []map[string]interface{}{
			{
				"text":          "🔙 انتخاب زبان دیگر",
				"callback_data": "panel:choose_lang:texts",
			},
		})

		markup := map[string]interface{}{
			"inline_keyboard": rows,
		}
		h.sendOrEditMessage(ctx, tg, chatID, messageID, text, markup, threadID)
	} else {
		text := fmt.Sprintf(`🔘 <b>لیست دکمه‌های شیشه‌ای برای زبان: %s</b>

روی هر دکمه کلیک کنید تا عنوان فعلی را دیده، آن را ویرایش کرده یا ایموجی پرمیوم به آن اضافه نمایید:`, langName)

		for _, item := range botButtonDefs {
			custom, _ := h.templateRepo.GetTemplate(ctx, item.Key, lang)
			tag := ""
			if custom != "" {
				tag = " (✏️ سفارشی)"
			}
			rows = append(rows, []map[string]interface{}{
				{
					"text":          item.Title + tag,
					"callback_data": fmt.Sprintf("panel:view:button:%s:%s", lang, item.Key),
				},
			})
		}
		rows = append(rows, []map[string]interface{}{
			{
				"text":          "🔙 انتخاب زبان دیگر",
				"callback_data": "panel:choose_lang:buttons",
			},
		})

		markup := map[string]interface{}{
			"inline_keyboard": rows,
		}
		h.sendOrEditMessage(ctx, tg, chatID, messageID, text, markup, threadID)
	}
}

// sendItemDetail shows current content and edit/reset actions for a specific template
func (h *WebhookHandler) sendItemDetail(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, itemType, lang, key string, messageID *int, threadID *int) {
	currentContent, _ := h.templateRepo.GetTemplate(ctx, key, lang)
	isCustom := currentContent != ""

	var title, desc, vars string
	if itemType == "text" {
		for _, t := range botTextDefs {
			if t.Key == key {
				title = t.Title
				desc = t.Description
				vars = t.Variables
				break
			}
		}
		if currentContent == "" {
			currentContent = h.getDefaultText(key, lang)
		}
	} else {
		for _, b := range botButtonDefs {
			if b.Key == key {
				title = b.Title
				desc = b.Description
				break
			}
		}
		if currentContent == "" {
			currentContent = h.getDefaultButton(key, lang)
		}
	}

	stateLabel := "🟢 پیش‌فرض سیستم"
	if isCustom {
		stateLabel = "✏️ سفارشی‌سازی شده توسط شما"
	}

	escapedContent := telegram.EscapeHTML(currentContent)
	text := fmt.Sprintf(`⚙️ <b>تنظیمات %s</b>
زبان: <b>%s</b> | وضعیت: <b>%s</b>
توضیح: <i>%s</i>

مقدار فعلی:
━━━━━━━━━━━━━━━━━━━
<pre>%s</pre>
━━━━━━━━━━━━━━━━━━━`, title, strings.ToUpper(lang), stateLabel, desc, escapedContent)

	if vars != "" {
		text += fmt.Sprintf("\n💡 <b>متغیرهای قابل استفاده در متن:</b>\n<code>%s</code>", vars)
	}

	text += "\n\nبرای ثبت مقدار جدید روی دکمه «✍️ ارسال مقدار جدید» بزنید و متن را در چت بفرستید."

	backTarget := fmt.Sprintf("panel:list:texts:%s", lang)
	if itemType == "button" {
		backTarget = fmt.Sprintf("panel:list:buttons:%s", lang)
	}

	rows := [][]map[string]interface{}{
		{
			{
				"text":          "✍️ ارسال مقدار جدید",
				"callback_data": fmt.Sprintf("panel:edit:%s:%s:%s", itemType, lang, key),
			},
			{
				"text":          "👁 پیش‌نمایش",
				"callback_data": fmt.Sprintf("panel:preview:%s:%s:%s", itemType, lang, key),
			},
		},
	}

	if isCustom {
		rows = append(rows, []map[string]interface{}{
			{
				"text":          "🔄 بازنشانی به پیش‌فرض (Reset)",
				"callback_data": fmt.Sprintf("panel:reset:%s:%s:%s", itemType, lang, key),
			},
		})
	}

	rows = append(rows, []map[string]interface{}{
		{
			"text":          "🔙 بازگشت به لیست",
			"callback_data": backTarget,
		},
	})

	markup := map[string]interface{}{
		"inline_keyboard": rows,
	}

	if len(escapedContent) > 3500 && tg != nil {
		docBytes := []byte(currentContent)
		fileName := fmt.Sprintf("%s_%s.txt", key, lang)
		caption := fmt.Sprintf("📄 متن کامل قالب <code>%s</code> (%s) به پیوست ارسال شد.", key, strings.ToUpper(lang))
		_ = tg.SendDocumentBytes(ctx, chatID, fileName, docBytes, caption, messageID, threadID)
	}

	h.sendOrEditMessage(ctx, tg, chatID, messageID, text, markup, threadID)
}

// handleAdminPanelCallback handles callbacks starting with panel:
func (h *WebhookHandler) handleAdminPanelCallback(ctx context.Context, bot *repository.ManagedBot, cq *CallbackQuery) {
	if !h.isBotOwner(ctx, bot, cq.From.ID) {
		tg := h.getBotClient(bot)
		if tg != nil {
			_ = tg.AnswerCallbackQuery(ctx, cq.ID, "⛔ عدم دسترسی", true)
		}
		return
	}

	tg := h.getBotClient(bot)
	if tg == nil {
		return
	}

	var msgID *int
	var chatID int64
	var threadID *int
	if cq.Message != nil {
		msgID = &cq.Message.MessageID
		chatID = cq.Message.Chat.ID
		threadID = cq.Message.MessageThreadID
	} else {
		chatID = cq.From.ID
	}

	data := cq.Data

	if data == "panel:main" {
		h.sendAdminPanelMenu(ctx, bot, chatID, cq.From.ID, msgID, threadID)
		return
	}

	// Preview template: panel:preview:<type>:<lang>:<key>
	if strings.HasPrefix(data, "panel:preview:") {
		parts := strings.Split(data, ":")
		if len(parts) >= 5 {
			h.handleAdminPanelPreview(ctx, tg, chatID, cq.ID, parts[2], parts[3], parts[4], threadID)
		}
		return
	}

	// 1. Choose language: panel:choose_lang:<type>
	if strings.HasPrefix(data, "panel:choose_lang:") {
		targetType := strings.TrimPrefix(data, "panel:choose_lang:")
		h.sendLanguageSelection(ctx, tg, chatID, targetType, msgID, threadID)
		return
	}

	// 2. List items: panel:list:<type>:<lang>
	if strings.HasPrefix(data, "panel:list:") {
		parts := strings.Split(data, ":")
		if len(parts) >= 4 {
			h.sendItemsList(ctx, tg, chatID, parts[2], parts[3], msgID, threadID)
		}
		return
	}

	// 3. View detail: panel:view:<type>:<lang>:<key>
	if strings.HasPrefix(data, "panel:view:") {
		parts := strings.Split(data, ":")
		if len(parts) >= 5 {
			h.sendItemDetail(ctx, tg, chatID, parts[2], parts[3], parts[4], msgID, threadID)
		}
		return
	}

	// 4. Request edit: panel:edit:<type>:<lang>:<key>
	if strings.HasPrefix(data, "panel:edit:") {
		parts := strings.Split(data, ":")
		if len(parts) >= 5 {
			itemType, lang, key := parts[2], parts[3], parts[4]
			// Set owner waiting state in cache
			stateKey := fmt.Sprintf("owner_wait_input:%d", cq.From.ID)
			payload := fmt.Sprintf("%s:%s:%s", itemType, lang, key)
			if h.cache != nil && h.cache.Client != nil {
				_ = h.cache.Client.Set(ctx, stateKey, payload, 10*time.Minute).Err()
			}

			prompt := fmt.Sprintf(`✍️ <b>ارسال مقدار جدید</b>

در حال ویرایش: <b>%s</b> (زبان: <b>%s</b>)

لطفاً متن جدید را مستقیماً در همین چت ارسال نمایید.
• می‌توانید از ایموجی‌های پرمیوم با قالب <code>[5368324170671202286]</code> یا <code>[emoji:ID]</code> استفاده کنید.
• برای لغو ویرایش دستور /cancel را بفرستید.`, key, strings.ToUpper(lang))

			cancelMarkup := map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{
						{
							"text":          "❌ انصراف",
							"callback_data": fmt.Sprintf("panel:view:%s:%s:%s", itemType, lang, key),
						},
					},
				},
			}
			h.sendOrEditMessage(ctx, tg, chatID, msgID, prompt, cancelMarkup, threadID)
		}
		return
	}

	// 5. Reset template: panel:reset:<type>:<lang>:<key>
	if strings.HasPrefix(data, "panel:reset:") {
		parts := strings.Split(data, ":")
		if len(parts) >= 5 {
			itemType, lang, key := parts[2], parts[3], parts[4]
			_ = h.templateRepo.DeleteTemplate(ctx, key, lang)
			_ = tg.AnswerCallbackQuery(ctx, cq.ID, "✅ با موفقیت به پیش‌فرض بازنشانی شد", true)
			h.sendItemDetail(ctx, tg, chatID, itemType, lang, key, msgID, threadID)
		}
		return
	}

	// Other info tabs
	switch data {
	case "panel:emojis":
		text := `🎨 <b>راهنمای ایموجی‌های پرمیوم (Premium Emojis)</b>

شناسه‌های فعال ایموجی‌های پرمیوم در بات:
• 💎 الماس (برند): <code>5368324170671202286</code>
• 🏷️ نام‌های کاربری: <code>5404870433939922908</code>
• 📱 شماره‌های رند: <code>5406830500155238210</code>
• 🎁 گیفت‌ها: <code>5429184518776953457</code>
• 👤 پروفایل: <code>5373141891321699086</code>
• ⚡ کردیت تحلیلی: <code>5445284980978654454</code>
• 🪙 سکه ایردراپ: <code>5407005610518534015</code>

<i>نکته:</i> در تمامی متون و دکمه‌های ربات می‌توانید شناسه‌ها را به صورت <code>[5368324170671202286]</code> درج کنید تا ربات آنها را به ایموجی پرمیوم زنده تبدیل نماید.`

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text":          "🔙 بازگشت به پنل",
						"callback_data": "panel:main",
					},
				},
			},
		}
		h.sendOrEditMessage(ctx, tg, chatID, msgID, text, markup, threadID)
		return

	case "panel:stats":
		var userCount int64 = 0
		var active24h int64 = 0
		var active7d int64 = 0
		if h.ownerRepo != nil {
			cnt, err := h.ownerRepo.GetAudienceCount(ctx, "all")
			if err == nil {
				userCount = cnt
			}
			cnt24, err24 := h.ownerRepo.GetAudienceCount(ctx, "active_24h")
			if err24 == nil {
				active24h = cnt24
			}
			cnt7d, err7d := h.ownerRepo.GetAudienceCount(ctx, "active_7d")
			if err7d == nil {
				active7d = cnt7d
			}
		}

		// Webhook shard queue metrics
		shardQueues := GetShardQueueLengths()
		totalQueue := GetTotalShardQueueLength()
		shardDetails := ""
		if len(shardQueues) > 0 {
			var qParts []string
			for idx, qLen := range shardQueues {
				qParts = append(qParts, fmt.Sprintf("شارد %d: <code>%d</code>", idx+1, qLen))
			}
			shardDetails = fmt.Sprintf("\n⚡ <b>صف پردازش ورودی:</b> مجموع <code>%d</code> پیام\n%s", totalQueue, strings.Join(qParts, " | "))
		}

		// TON live rate
		var tonRateStr string = "—"
		if h.cryptoPrice != nil {
			rate, src, _, _, ok := h.cryptoPrice.GetTONUSDT(ctx)
			if ok && rate > 0 {
				tonRateStr = fmt.Sprintf("$%.2f (%s)", rate, src)
			}
		}

		text := fmt.Sprintf(`📊 <b>آمار زنده، عملکرد و مانیتورینگ ربات</b>

👥 <b>کاربران کل:</b> <code>%d</code>
🔥 <b>فعال ۲۴ ساعت:</b> <code>%d</code> | <b>فعال ۷ روز:</b> <code>%d</code>
💵 <b>نرخ زنده TON/USDT:</b> <code>%s</code>
%s

💎 <b>وضعیت ربات:</b> آنلاین و فعال (Operational)
⚡ <b>موتور نرخ و هوش مصنوعی:</b> متصل به شبکه اصلی TON و وب‌سرویس Fragment
🛡️ <b>سیستم Fallback:</b> پایدار و پاسخگو`, userCount, active24h, active7d, tonRateStr, shardDetails)

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text":          "🔙 بازگشت به پنل",
						"callback_data": "panel:main",
					},
				},
			},
		}
		h.sendOrEditMessage(ctx, tg, chatID, msgID, text, markup, threadID)
		return

	case "panel:credits":
		costCoins := config.Economics.CreditsCoinsPerCredit
		formattedCost := formatNumberWithCommas(costCoins)

		// Catalog packs
		packs := intelcredit.Packs()
		var packLines []string
		for _, p := range packs {
			packLines = append(packLines, fmt.Sprintf("• بسته <b>%d کریدتی</b>: <code>%d Stars</code>", p.TotalCredits(), p.StarsPrice))
		}
		packCatalog := strings.Join(packLines, "\n")

		text := fmt.Sprintf(`⚡ <b>سیستم اعتبارات تحلیلی (Intel Credits) و اقتصاد داخلی</b>

⚙️ <b>پارامترهای اقتصادی فعال:</b>
• هزینه تبدیل هر ۱ کردیت تحلیلی: <b>%s سکه ایردراپ</b>
• هزینه استعلام عمیق هر دارایی: <b>۱ کردیت</b>
• بازه Idempotency استعلام: <b>۲۴ ساعت برای هر دارایی</b>

⭐ <b>بسته‌های فعال تلگرام استارز (Stars):</b>
%s

<i>نکته:</i> تمامی کسرها و تبدیل‌ها بر اساس معماری چندلایه و بدون بن‌بست پردازش می‌شوند.`, formattedCost, packCatalog)

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{
						"text":          "🔙 بازگشت به پنل",
						"callback_data": "panel:main",
					},
				},
			},
		}
		h.sendOrEditMessage(ctx, tg, chatID, msgID, text, markup, threadID)
		return
	}
}

// processOwnerInput handles text sent by owner when editing a template
func (h *WebhookHandler) processOwnerInput(ctx context.Context, bot *repository.ManagedBot, m *Message) bool {
	if m.From == nil || !h.isBotOwner(ctx, bot, m.From.ID) {
		return false
	}

	stateKey := fmt.Sprintf("owner_wait_input:%d", m.From.ID)
	if h.cache == nil || h.cache.Client == nil {
		return false
	}

	target, err := h.cache.Client.Get(ctx, stateKey).Result()
	if err != nil || target == "" {
		return false
	}

	// Consume state immediately
	_ = h.cache.Client.Del(ctx, stateKey).Err()

	tg := h.getBotClient(bot)
	if tg == nil {
		return false
	}

	if m.Text == "/cancel" {
		_ = tg.SendMessage(ctx, m.Chat.ID, "❌ ویرایش لغو شد.", &m.MessageID, m.MessageThreadID)
		h.sendAdminPanelMenu(ctx, bot, m.Chat.ID, m.From.ID, nil, m.MessageThreadID)
		return true
	}

	parts := strings.Split(target, ":")
	if len(parts) < 3 {
		return false
	}
	itemType, lang, key := parts[0], parts[1], parts[2]

	var newContent string

	if itemType == "button" || itemType == "btn" {
		rawBtn := strings.TrimSpace(m.Text)
		if rawBtn == "" {
			rawBtn = strings.TrimSpace(m.Caption)
		}
		runeCount := utf8.RuneCountInString(rawBtn)
		if runeCount < 1 || runeCount > 64 {
			errMsg := fmt.Sprintf("⚠️ <b>طول متن دکمه نامعتبر است!</b>\n\nمتن دکمه‌های تلگرام باید بین ۱ تا ۶۴ کاراکتر باشد (طول وارد شده: %d کاراکتر). ویرایش لغو شد.", runeCount)
			_ = tg.SendMessage(ctx, m.Chat.ID, errMsg, &m.MessageID, m.MessageThreadID)
			return true
		}
		newContent = rawBtn

		// Test-render button with Bot API markup
		testBtn := telegram.InlineButton{Text: newContent, CallbackData: "panel:noop"}
		if customEmojiID := extractCustomEmojiID(newContent); customEmojiID != "" {
			testBtn.IconCustomEmojiID = customEmojiID
		}
		testMarkup := telegram.BuildInlineKeyboard([][]telegram.InlineButton{{testBtn}})
		testResp, testErr := tg.SendMessageWithMarkup(ctx, m.Chat.ID, "🧪 <i>در حال بررسی ساختار دکمه در تلگرام...</i>", testMarkup, m.MessageThreadID)
		if testErr != nil {
			errText := fmt.Sprintf("❌ <b>خطا در اعتبارسنجی دکمه تلگرام:</b>\n<code>%s</code>\n\nویرایش ذخیره نشد. لطفاً قالب را اصلاح و مجدداً ارسال نمایید.", telegram.EscapeHTML(testErr.Error()))
			_ = tg.SendMessage(ctx, m.Chat.ID, errText, &m.MessageID, m.MessageThreadID)
			return true
		}
		if testResp != nil && testResp.MessageID > 0 {
			_ = tg.DeleteMessage(ctx, m.Chat.ID, testResp.MessageID)
		}
	} else {
		// Text template: format message entities into clean Telegram HTML
		rawText := m.Text
		entities := m.Entities
		if rawText == "" && m.Caption != "" {
			rawText = m.Caption
			entities = m.CaptionEntities
		}
		rawText = strings.TrimSpace(rawText)
		if rawText == "" {
			_ = tg.SendMessage(ctx, m.Chat.ID, "⚠️ متن ارسالی خالی است. ویرایش لغو شد.", &m.MessageID, m.MessageThreadID)
			return true
		}

		if len(entities) > 0 {
			newContent = entitiesToHTML(rawText, entities)
		} else {
			newContent = telegram.EscapeHTML(rawText)
		}

		// Convert bracketed custom emoji IDs to <tg-emoji> tags
		newContent = FormatPremiumEmojiText(newContent)

		// Test-render template with sample variables to detect entity parsing errors
		sampleContent := newContent
		sampleContent = strings.ReplaceAll(sampleContent, "{name}", "کاربر نمونه")
		sampleContent = strings.ReplaceAll(sampleContent, "{diamond}", fmt.Sprintf(`<tg-emoji emoji-id="%s">💎</tg-emoji>`, CustomEmojiDiamond))
		sampleContent = strings.ReplaceAll(sampleContent, "{id}", "12345678")
		sampleContent = strings.ReplaceAll(sampleContent, "{level}", "1")
		sampleContent = strings.ReplaceAll(sampleContent, "{rank}", "1")
		sampleContent = strings.ReplaceAll(sampleContent, "{coins}", "150,000")
		sampleContent = strings.ReplaceAll(sampleContent, "{credits}", "5")
		sampleContent = strings.ReplaceAll(sampleContent, "{cost_coins}", "150,000")
		sampleContent = strings.ReplaceAll(sampleContent, "{reflink}", "https://t.me/iFragmentBot?start=ref123")
		sampleContent = strings.ReplaceAll(sampleContent, "{type}", "نام کاربری")
		sampleContent = strings.ReplaceAll(sampleContent, "{entity}", "durov")

		testResp, testErr := tg.SendMessageWithResult(ctx, m.Chat.ID, "🧪 <i>در حال اعتبارسنجی قالب HTML...</i>\n\n"+sampleContent, &m.MessageID, m.MessageThreadID)
		if testErr != nil {
			errText := fmt.Sprintf("❌ <b>خطای گرامری HTML در قالب (Telegram Entity Error):</b>\n<code>%s</code>\n\nمقدار ذخیره نشد. لطفاً ساختار تگ‌ها را بررسی فرمایید.", telegram.EscapeHTML(testErr.Error()))
			_ = tg.SendMessage(ctx, m.Chat.ID, errText, &m.MessageID, m.MessageThreadID)
			return true
		}
		if testResp != nil && testResp.MessageID > 0 {
			_ = tg.DeleteMessage(ctx, m.Chat.ID, testResp.MessageID)
		}
	}

	saveErr := h.templateRepo.SetTemplate(ctx, key, lang, itemType, newContent)
	if saveErr != nil {
		_ = tg.SendMessage(ctx, m.Chat.ID, fmt.Sprintf("❌ خطا در ذخیره در پایگاه داده: %v", saveErr), &m.MessageID, m.MessageThreadID)
		return true
	}

	succMsg := fmt.Sprintf("✅ <b>مقدار جدید با موفقیت اعتبارسنجی و ذخیره شد!</b>\n\nکلید: <code>%s</code>\nزبان: <code>%s</code>", key, strings.ToUpper(lang))
	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{
					"text":          "⚙️ مشاهده و بررسی",
					"callback_data": fmt.Sprintf("panel:view:%s:%s:%s", itemType, lang, key),
				},
				{
					"text":          "📋 بازگشت به منوی پنل",
					"callback_data": "panel:main",
				},
			},
		},
	}
	_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, succMsg, markup, m.MessageThreadID)
	return true
}

// getDefaultText returns system standard text for a key and language from centralized repository
func (h *WebhookHandler) getDefaultText(key, lang string) string {
	return GetDefaultText(key, lang)
}

// getDefaultButton returns system standard button label for a key and language from centralized repository
func (h *WebhookHandler) getDefaultButton(key, lang string) string {
	return GetDefaultButton(key, lang)
}

// handleAdminPanelPreview sends a live rendered preview of a text or button template
func (h *WebhookHandler) handleAdminPanelPreview(ctx context.Context, tg *telegram.BotAPIClient, chatID int64, callbackID string, itemType, lang, key string, threadID *int) {
	if tg == nil {
		return
	}
	_ = tg.AnswerCallbackQuery(ctx, callbackID, "👀 در حال بارگذاری پیش‌نمایش...", false)

	if itemType == "button" || itemType == "btn" {
		content := h.resolveButton(ctx, key, lang, h.getDefaultButton(key, lang))
		previewMsg := fmt.Sprintf("👀 <b>پیش‌نمایش دکمه:</b>\n\nکلید: <code>%s</code> (%s)\nمتن: <code>%s</code>", key, strings.ToUpper(lang), telegram.EscapeHTML(content))

		btn := telegram.InlineButton{Text: content, CallbackData: "panel:noop"}
		if emojiID := extractCustomEmojiID(content); emojiID != "" {
			btn.IconCustomEmojiID = emojiID
		}
		backBtn := telegram.InlineButton{Text: "🔙 بازگشت به جزئیات", CallbackData: fmt.Sprintf("panel:view:%s:%s:%s", itemType, lang, key)}

		markup := telegram.BuildInlineKeyboard([][]telegram.InlineButton{
			{btn},
			{backBtn},
		})
		_, _ = tg.SendMessageWithMarkup(ctx, chatID, previewMsg, markup, threadID)
		return
	}

	content := h.resolveText(ctx, key, lang, h.getDefaultText(key, lang))
	content = FormatPremiumEmojiText(content)
	content = strings.ReplaceAll(content, "{name}", "سید یوسف")
	content = strings.ReplaceAll(content, "{diamond}", fmt.Sprintf(`<tg-emoji emoji-id="%s">💎</tg-emoji>`, CustomEmojiDiamond))
	content = strings.ReplaceAll(content, "{id}", "12345678")
	content = strings.ReplaceAll(content, "{level}", "1")
	content = strings.ReplaceAll(content, "{rank}", "1")
	content = strings.ReplaceAll(content, "{coins}", "150,000")
	content = strings.ReplaceAll(content, "{credits}", "5")
	content = strings.ReplaceAll(content, "{cost_coins}", "150,000")
	content = strings.ReplaceAll(content, "{reflink}", "https://t.me/iFragmentBot?start=ref123")
	content = strings.ReplaceAll(content, "{type}", "نام کاربری")
	content = strings.ReplaceAll(content, "{entity}", "durov")

	previewHeader := fmt.Sprintf("👀 <b>پیش‌نمایش زنده قالب <code>%s</code> (%s):</b>\n— — — — — — — — — — — — — — —\n", key, strings.ToUpper(lang))
	fullMsg := previewHeader + content

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": "🔙 بازگشت به جزئیات", "callback_data": fmt.Sprintf("panel:view:%s:%s:%s", itemType, lang, key)},
			},
		},
	}
	_, _ = tg.SendMessageWithMarkup(ctx, chatID, fullMsg, markup, threadID)
}

// extractCustomEmojiID parses custom emoji IDs like [5368324170671202286] or [emoji:5368324170671202286]
// from button text for Bot API 9.3+ icon_custom_emoji_id.
func extractCustomEmojiID(text string) string {
	m := premiumEmojiIDRe.FindStringSubmatch(text)
	if len(m) > 1 && m[1] != "" {
		return m[1]
	}
	if len(m) > 2 && m[2] != "" {
		return m[2]
	}
	return ""
}
