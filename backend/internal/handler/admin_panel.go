package handler

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/crypto"
	"ifragment-backend/internal/repository"
)

// Supported languages for bot texts & buttons
var supportedLanguages = []struct {
	Code string
	Name string
	Flag string
}{
	{"fa", "فارسی", "🇮🇷"},
	{"en", "English", "🇺🇸"},
	{"ar", "العربية", "🇸🇦"},
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
	{Key: "btn_back", Title: "دکمه بازگشت", Description: "دکمه بازگشت به منوی قبل"},
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
		token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)
		if tg != nil {
			_ = tg.SendMessage(ctx, m.Chat.ID, "⛔ شما به این بخش دسترسی ندارید.", &m.MessageID, m.MessageThreadID)
		}
		return
	}

	h.sendAdminPanelMenu(ctx, bot, m.Chat.ID, m.From.ID, nil, m.MessageThreadID)
}

// sendAdminPanelMenu renders the main /panel dashboard for the owner
func (h *WebhookHandler) sendAdminPanelMenu(ctx context.Context, bot *repository.ManagedBot, chatID int64, _ int64, messageID *int, threadID *int) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
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

	text := fmt.Sprintf(`⚙️ <b>تنظیمات %s</b>
زبان: <b>%s</b> | وضعیت: <b>%s</b>
توضیح: <i>%s</i>

مقدار فعلی:
━━━━━━━━━━━━━━━━━━━
%s
━━━━━━━━━━━━━━━━━━━`, title, strings.ToUpper(lang), stateLabel, desc, currentContent)

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
	h.sendOrEditMessage(ctx, tg, chatID, messageID, text, markup, threadID)
}

// handleAdminPanelCallback handles callbacks starting with panel:
func (h *WebhookHandler) handleAdminPanelCallback(ctx context.Context, bot *repository.ManagedBot, cq *CallbackQuery) {
	if !h.isBotOwner(ctx, bot, cq.From.ID) {
		token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
		tg := telegram.NewBotAPIClient(token)
		if tg != nil {
			_ = tg.AnswerCallbackQuery(ctx, cq.ID, "⛔ عدم دسترسی", true)
		}
		return
	}

	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
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
• 🪙 سکه ایردراپ: <code>5406830500155238210</code>

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
		if h.ownerRepo != nil {
			cnt, err := h.ownerRepo.GetAudienceCount(ctx, "all")
			if err == nil {
				userCount = cnt
			}
		}

		text := fmt.Sprintf(`📊 <b>آمار زنده ربات و کاربران</b>

👥 <b>تعداد کل کاربران ثبت‌شده:</b> <code>%d</code>
💎 <b>وضعیت ربات:</b> آنلاین و فعال (Operational)
⚡ <b>موتور نرخ و هوش مصنوعی:</b> متصل به شبکه اصلی TON و وب‌سرویس Fragment

تمام دکمه‌های اینلاین و شیشه‌ای دارای مکانیزم ایمن Fallback بوده و بدون توقف پاسخ می‌دهند.`, userCount)

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
		text := `⚡ <b>سیستم اعتبارات تحلیلی (Intel Credits) و تبدیل سکه</b>

⚙️ <b>پارامترهای اقتصادی فعال:</b>
• هزینه تبدیل هر ۱ کردیت تحلیلی: <b>150,000 سکه ایردراپ</b>
• هزینه گزارش تحلیلی عمیق: <b>۱ کردیت</b>
• بازه زمانی Idempotency گزارش: <b>۲۴ ساعت برای هر دارایی</b>
• اتصال فروشگاه ستاره‌های تلگرام (Stars): فعال با قابلیت استرداد خودکار در صورت بروز خطا.`

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

	// Consume state
	_ = h.cache.Client.Del(ctx, stateKey).Err()

	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)
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

	newContent := strings.TrimSpace(m.Text)
	if newContent == "" {
		newContent = strings.TrimSpace(m.Caption)
	}

	if newContent == "" {
		_ = tg.SendMessage(ctx, m.Chat.ID, "⚠️ متن ارسالی خالی است. ویرایش لغو شد.", &m.MessageID, m.MessageThreadID)
		return true
	}

	saveErr := h.templateRepo.SetTemplate(ctx, key, lang, itemType, newContent)
	if saveErr != nil {
		_ = tg.SendMessage(ctx, m.Chat.ID, fmt.Sprintf("❌ خطا در ذخیره: %v", saveErr), &m.MessageID, m.MessageThreadID)
		return true
	}

	succMsg := fmt.Sprintf("✅ <b>مقدار جدید با موفقیت ذخیره و اعمال شد!</b>\n\nکلید: <code>%s</code>\nزبان: <code>%s</code>", key, strings.ToUpper(lang))
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

// getDefaultText returns system standard text for a key and language
func (h *WebhookHandler) getDefaultText(key, lang string) string {
	switch key {
	case "start_menu":
		switch lang {
		case "fa":
			return `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>ترمینال تحلیل دارایی‌های تلگرام | iFragment</b>

سلام <b>{name}</b> عزیز؛ به دستیار هوشمند کارشناسی و ارزیابی دارایی‌های دیجیتال تلگرام خوش آمدید.

یکی از بخش‌های زیر را انتخاب کنید، یا مستقیماً <b>نام کاربری</b>، <b>شماره ناشناس (+888)</b> یا <b>لینک گیفت</b> را در چت ارسال فرمایید:`
		case "ru":
			return `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>Терминал аналитики активов Telegram | iFragment</b>

Здравствуйте, <b>{name}</b>! Добро пожаловать в интеллектуальный ассистент оценки активов Telegram.

Выберите категорию или отправьте <b>юзернейм</b>, <b>номер (+888)</b> или <b>ссылку на подарок</b> прямо в чат:`
		case "zh":
			return `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>Telegram 资产智能分析终端 | iFragment</b>

您好 <b>{name}</b>！欢迎使用 Telegram 数字资产专业估值与市场洞察终端。

请选择下方的资产类别，或直接在聊天中发送<b>用户名</b>、<b>+888 匿名靓号</b>或<b>礼物链接</b>：`
		default:
			return `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>Telegram Asset Intelligence Terminal | iFragment</b>

Welcome <b>{name}</b>! I am your institutional analytics engine for Telegram Digital Assets.

Select an asset class below or simply send any <b>username</b>, <b>anonymous number (+888)</b>, or <b>gift link</b> in chat:`
		}

	case "prompt_username":
		switch lang {
		case "fa":
			return "🏷️ <b>تحلیل و کارشناسی نام کاربری (Username)</b>\n\nلطفاً نام کاربری مد نظر خود را به صورت متن یا با @ ارسال کنید:\n\nنمونه: <code>@crypto</code> ، <code>wallet</code> ، <code>ton_holder</code>"
		case "ru":
			return "🏷️ <b>Оценка и анализ юзернейма Telegram</b>\n\nПожалуйста, отправьте тег или имя пользователя:\n\nПример: <code>@crypto</code>, <code>wallet</code>"
		case "zh":
			return "🏷️ <b>Telegram 用户名专业估值分析</b>\n\n请输入您想要评估的 Telegram 用户名或链接：\n\n示例: <code>@crypto</code>, <code>wallet</code>"
		default:
			return "🏷️ <b>Telegram Username Valuation</b>\n\nPlease enter the username handle you wish to valuate:\n\nExample: <code>@crypto</code>, <code>wallet</code>"
		}

	case "prompt_number":
		switch lang {
		case "fa":
			return "📱 <b>تحلیل شماره کلکسیونی ناشناس (+888)</b>\n\nلطفاً شماره کلکسیونی ۸ رقمی یا رند ۴ رقمی مد نظر را وارد نمایید:\n\nنمونه: <code>+888 8888 8888</code> یا <code>+88801234567</code> یا <code>8888</code>"
		case "ru":
			return "📱 <b>Анализ анонимного номера (+888)</b>\n\nВведите анонимный 8-значный или генезис 4-значный номер:\n\nПример: <code>+888 8888 8888</code> или <code>8888</code>"
		case "zh":
			return "📱 <b>Telegram +888 匿名靓号价值分析</b>\n\n请输入您想要分析的 8 位或 4 位 +888 靓号：\n\n示例: <code>+888 8888 8888</code> 或 <code>8888</code>"
		default:
			return "📱 <b>Telegram Anonymous Numbers (+888)</b>\n\nPlease enter the anonymous +888 number to analyze:\n\nExample: <code>+888 8888 8888</code> or <code>8888</code>"
		}

	case "prompt_gift":
		switch lang {
		case "fa":
			return "🎁 <b>کارشناسی گیفت و کالکشن‌های تلگرام</b>\n\nلطفاً لینک گیفت در تلگرام یا فرگمنت، یا نام و شماره آن را ارسال کنید:\n\nنمونه: <code>https://t.me/nft/PlushPepe-42</code> یا <code>PlushPepe-42</code>"
		case "ru":
			return "🎁 <b>Оценка и анализ подарков Telegram</b>\n\nОтправьте ссылку на NFT-подарок یا название и номер:\n\nПример: <code>https://t.me/nft/PlushPepe-42</code> или <code>PlushPepe-42</code>"
		case "zh":
			return "🎁 <b>Telegram 礼物 NFT 稀缺度与估值鉴定</b>\n\n请发送礼物 NFT 链接或模型名称及编号：\n\n示例: <code>https://t.me/nft/PlushPepe-42</code> 或 <code>PlushPepe-42</code>"
		default:
			return "🎁 <b>Telegram Gifts Appraisal</b>\n\nPlease send the Telegram Gift link or model-serial:\n\nExample: <code>https://t.me/nft/PlushPepe-42</code>"
		}
	}
	return "Standard Content"
}

// getDefaultButton returns system standard button label for a key and language
func (h *WebhookHandler) getDefaultButton(key, lang string) string {
	switch key {
	case "btn_mini_app":
		switch lang {
		case "fa":
			return "💎 ورود به مینی‌اپ iFragment"
		case "ru":
			return "💎 Открыть iFragment Mini App"
		case "zh":
			return "💎 进入 iFragment 小程序"
		default:
			return "💎 Launch iFragment Mini App"
		}
	case "btn_usernames":
		switch lang {
		case "fa":
			return "🏷️ نام‌های کاربری"
		case "ru":
			return "🏷️ Юзернеймы"
		case "zh":
			return "🏷️ 用户名"
		default:
			return "🏷️ Usernames"
		}
	case "btn_numbers":
		switch lang {
		case "fa":
			return "📱 شماره‌های رند (+888)"
		case "ru":
			return "📱 Номера (+888)"
		case "zh":
			return "📱 匿名靓号 (+888)"
		default:
			return "📱 Numbers (+888)"
		}
	case "btn_gifts":
		switch lang {
		case "fa":
			return "🎁 گیفت‌های تلگرام"
		case "ru":
			return "🎁 Подарки (NFT)"
		case "zh":
			return "🎁 电报礼物 (NFT)"
		default:
			return "🎁 Telegram Gifts"
		}
	case "btn_profile":
		switch lang {
		case "fa":
			return "👤 پروفایل و دارایی‌ها"
		case "ru":
			return "👤 Мой профиль"
		case "zh":
			return "👤 个人中心与资产"
		default:
			return "👤 Profile & Balances"
		}
	case "btn_language":
		switch lang {
		case "fa":
			return "🌐 تغییر زبان"
		case "ru":
			return "🌐 Сменить язык"
		case "zh":
			return "🌐 切换语言"
		default:
			return "🌐 Language"
		}
	case "btn_help":
		switch lang {
		case "fa":
			return "📖 راهنمای ربات"
		case "ru":
			return "📖 Инструкция"
		case "zh":
			return "📖 使用指南"
		default:
			return "📖 Help & Guide"
		}
	case "btn_exchange":
		switch lang {
		case "fa":
			return "🔄 تبدیل سکه به ۱ کردیت"
		case "ru":
			return "🔄 Обменять монеты"
		case "zh":
			return "🔄 兑换代币为信用点"
		default:
			return "🔄 Exchange Coins"
		}
	case "btn_stars":
		switch lang {
		case "fa":
			return "⭐ خرید کردیت با Stars"
		case "ru":
			return "⭐ Купить за Stars"
		case "zh":
			return "⭐ 使用 Stars 购买"
		default:
			return "⭐ Buy with Stars"
		}
	case "btn_unlock":
		switch lang {
		case "fa":
			return "🔓 باز کردن گزارش کامل (۱ کریدت)"
		case "ru":
			return "🔓 Открыть полный отчет (1 кредит)"
		case "zh":
			return "🔓 解锁完整分析报告 (1 信用点)"
		default:
			return "🔓 Unlock Full Report (1 Credit)"
		}
	case "btn_back":
		switch lang {
		case "fa":
			return "🔙 بازگشت به منو"
		case "ru":
			return "🔙 В меню"
		case "zh":
			return "🔙 返回主菜单"
		default:
			return "🔙 Back to Menu"
		}
	}
	return "Button"
}
