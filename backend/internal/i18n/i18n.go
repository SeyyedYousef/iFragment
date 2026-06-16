package i18n

import (
	"fmt"
	"strings"
)

// T retrieves a translated string by key and replaces placeholders.
func T(lang, key string, vars ...interface{}) string {
	dict := getDict(lang)
	
	parts := strings.Split(key, ".")
	var val interface{} = dict
	
	for _, part := range parts {
		if m, ok := val.(map[string]interface{}); ok {
			val = m[part]
		} else {
			val = nil
			break
		}
	}
	
	str, ok := val.(string)
	if !ok {
		if lang != "en" {
			return T("en", key, vars...)
		}
		return key
	}
	
	// Support Named Placeholders (map[string]interface{})
	if len(vars) > 0 {
		if vm, ok := vars[0].(map[string]interface{}); ok {
			for k, v := range vm {
				placeholder := "{" + k + "}"
				str = strings.ReplaceAll(str, placeholder, fmt.Sprintf("%v", v))
			}
		}
	}

	// Fallback to Positional Placeholders {arg0}, {arg1}, etc.
	for i, arg := range vars {
		placeholder := fmt.Sprintf("{arg%d}", i)
		str = strings.ReplaceAll(str, placeholder, fmt.Sprintf("%v", arg))
	}
	
	return str
}

// DetectLanguage identifies the user's language code.
func DetectLanguage(code string) string {
	code = strings.ToLower(code)
	if strings.HasPrefix(code, "fa") || strings.HasPrefix(code, "ir") {
		return "fa"
	}
	if strings.HasPrefix(code, "ru") {
		return "ru"
	}
	if strings.HasPrefix(code, "zh") {
		return "zh"
	}
	if strings.HasPrefix(code, "ar") {
		return "ar"
	}
	return "en"
}

func getDict(lang string) map[string]interface{} {
	switch lang {
	case "fa":
		return faDict
	case "ru":
		return ruDict
	case "zh":
		return zhDict
	case "ar":
		return arDict
	default:
		return enDict
	}
}

// ─── TRANSLATION DICTIONARIES (Extracted & Rebuilt) ──────────────────

var enDict = map[string]interface{}{
	"onboarding": map[string]interface{}{
		"thanks":   "🎉 *Thank you for your trust!*\n\nFrom this moment, the digital guardian of \"{arg0}\" is at your service. I will proudly protect your community from spam, ads, and chaos.\n\n🌟 Powered by AI & ❤️ by @iFragmentBot",
		"admin_req": "⚠️ *One step left to full activation!*\n\nTo allow me to delete malicious messages and restrict offenders, please promote me to \"Administrator\" with these permissions:\n\n✓ Delete Messages\n✓ Restrict Members\n✓ Ban Users\n✓ Pin Messages",
		"features":  "隐私设置 (Privacy Settings)\n\n✅ *These features are now active:*\n\n🚫 Auto-delete links & domains\n🤖 Block nuisance bots\n🔥 Smart Anti-Spam (5 msgs / 10s)\n\n🎛 To customize, open the dashboard:\n👉 [Open Dashboard]({arg0})",
		"welcome_owner": "🔥 **iFragment Admin Portal**\n\nWelcome back, Commander {arg0}. Manage your system settings, view real-time logs, and monitor live status.\n\n👇 **Launch control panel:**",
		"welcome_public": "💎 **Welcome to @iFragmentBot, the all-in-one platform.**\n\nMonitor the true value of your Telegram collectibles with iFragment; **search, value, and analyze** usernames, anonymous numbers, and gifts in real time.\n\nFurthermore, transform your **group security (advanced anti-spam)** and **professional channel management (smart posting and publishing)** using our intelligent system. We provide powerful tools for auto-moderation, smart replies, and content interaction.\n\n👇 **Open the iFragment Mini App now:**",
		"open_app": "🚀 Launch iFragment 💎",
	},
	"notice": map[string]interface{}{
		"payment_success": "✅ *Payment Successful!*\n\nYour subscription has been updated. Thank you for supporting iFragment!",
		"bot_removed":     "❌ *Bot Removed*\n\nI was removed from the group \"{arg0}\". If this was a mistake, please add me back.",
		"not_admin":       "⚠️ *Admin Permissions Missing*\n\nI am no longer an administrator in this group. Please restore my permissions to continue protection.",
		"admin_revoked":   "⚠️ *Permissions Revoked*\n\nMy administrator rights in \"{arg0}\" have been revoked. I can no longer protect the group.",
		"spam_attack":     "🚨 *SPAM ATTACK DETECTED*\n\nMassive spam wave detected! I have automatically switched to High-Security mode for 5 minutes.",
		"warning":         "⚠️ *Warning:* {arg0} (Warning {arg1}/{arg2})",
	},
	"notifications": map[string]interface{}{
		"expiry_3d":           "⏰ Subscription for group \"{group}\" ends in 3 days. Renew now to avoid service interruption.",
		"expiry_24h":          "⏳ Only 24 hours left until service for \"{group}\" is suspended!",
		"service_ended":       "🔒 Service for group \"{group}\" has been temporarily disabled.",
		"mass_spam":           "🚨 Group \"{group}\" is currently under a mass spam attack!",
		"bot_removed":         "😢 The bot was removed from group \"{group}\". If this was a mistake, please add it back.",
		"admin_revoked":       "⚠️ The bot was demoted from admin in group \"{group}\".",
		"admin_revoked_group": "⚠️ I am no longer an admin; I cannot protect the group.",
		"payment_success":     "✅ Payment received. Subscription extended until {date}. Thank you!",
		"milestone":           "🎉 Group has reached the milestone of {n} messages!",
	},
	"generalSettings": map[string]interface{}{
		"welcomeMessage": "Welcome Message",
		"warningMessage": "Warning Message",
	},
	"customTextsSettings": map[string]interface{}{
		"welcomePlaceholder": "Welcome {user} to {group}!",
	},
	"channel": map[string]interface{}{
		"start_bot_error": "Please start the bot in your private chat first (cannot send private message to you): {err}",
		"approve_btn": "✅ Approve & Send",
		"reject_btn": "❌ Reject",
		"edit_text_btn": "✏️ Edit Text",
		"edit_btn_btn": "🔗 Edit Buttons",
		"cancel_btn": "↩️ Cancel & Back",
		"draft_status_pending": "📢 **New post draft for channel \"{channel}\"**\n\n{text}\n\n---\n⏳ **Status:** Pending Approval",
		"draft_autoforward_pending": "📢 **New post draft via AutoForward for channel \"{channel}\"**\n\n{text}\n\n---\n⏳ **Status:** Pending Approval",
		"draft_status_edited_pending": "📢 **New edited post draft**\n\n{text}\n\n---\n⏳ **Status:** Pending Approval",
		"draft_status_edited_btn_pending": "📢 **New edited post draft (with new buttons)**\n\n{text}\n\n---\n⏳ **Status:** Pending Approval",
		"draft_status_approved": "📢 **New post draft for channel \"{channel}\"**\n\n{text}\n\n---\n✅ **Status:** Successfully published to the channel!",
		"draft_status_rejected": "📢 **New post draft for channel \"{channel}\"**\n\n{text}\n\n---\n❌ **Status:** This post was rejected and deleted by you.",
		"edit_text_instruction": "📝 **Please send or write the new text for the post (you can reply to the original draft message if desired):**",
		"edit_btn_instruction": "🔗 **Please send the new inline buttons in the following format (one button per line):**\n\n`Button Title - Button Link`\n\n*Example:*\n`Google - https://google.com`\n`Support - https://t.me/support`",
		"owner_only_error": "Unauthorized: This action is restricted to the bot owner.",
		"click_registered": "Click registered!",
		"draft_expired": "Post draft expired or not found!",
		"failed_publish": "Failed to publish: {err}",
		"success_publish": "Post successfully published!",
		"send_text_prompt": "Please send the new text",
		"send_btn_prompt": "Please send button configuration",
		"edit_cancelled": "Editing cancelled.",
		"post_rejected": "Post rejected and deleted.",
	},
	"tooltip_portfolio":   "Your complete asset overview and performance metrics.",
	"tooltip_buyer_radar": "Identify potential buyers based on their interest and wallet activity.",
	"tooltip_synergy":     "Analyze how different assets perform together to maximize value.",
	"tooltip_roi":         "Calculate your Return on Investment across your entire collection.",
	"tooltip_empire":      "Track your total net worth, influence, and overall market presence.",
}

var faDict = map[string]interface{}{
	"onboarding": map[string]interface{}{
		"thanks":   "🎉 *کمک و همراهی شما مورد تقدیر است!*\n\nاز این لحظه، نگهبان دیجیتال گروه «{arg0}» در خدمت شماست. با افتخار از جامعه‌ی شما در برابر اسپم، تبلیغ و آشوب محافظت خواهم کرد.\n\n🌟 ساخته‌شده با هوش مصنوعی و ❤️ توسط تیم @iFragmentBot",
		"admin_req": "⚠️ *یک قدم تا فعالسازی کامل باقی مانده!*\n\nبرای آنکه بتوانم پیامهای مخرب را حذف کنم و کاربران متخلف را محدود کنم، لطفاً مرا به عنوان «ادمین» منصوب کنید با دسترسی‌های:\n\n✓ حذف پیام‌ها (Delete Messages)\n✓ محدود کردن کاربران (Restrict Members)\n✓ بن کردن کاربران (Ban Users)\n✓ پین کردن پیام (Pin Messages)",
		"features":  "✅ *این قابلیتها هم‌اکنون فعال هستند:*\n\n🚫 حذف خودکار لینک‌ها و دامنهها\n🤖 جلوگیری از ربات‌های مزاحم\n🔥 ضد اسپم هوشمند (۵ پیام در ۱۰ ثانیه)\n\n🎛 برای شخصی‌سازی، داشبورد را باز کنید:\n👉 [Open Dashboard]({arg0})",
		"welcome_owner": "🔥 **پنل مدیریت آی‌فرگمنت**\n\nخوش‌آمدید فرمانده {arg0}. تنظیمات سیستم را مدیریت کنید، آمارها را ببینید و لاگ‌های ممیزی را پایش کنید.\n\n👇 **ورود به پنل مدیریت:**",
		"welcome_public": "💎 **به پلتفرم همه‌کاره @iFragmentBot خوش آمدید.**\n\nبا آی‌فرگمنت، ارزش واقعی دارایی‌های کلکسیونی تلگرام خود را پایش کنید؛ یوزرنیم‌ها، شماره‌های ناشناس و گیفت‌ها را **جستجو، ارزش‌گذاری هوشمند و تحلیل کنید**.\n\nدر ادامه، با استفاده از سیستم هوشمند ما، **امنیت گروه‌های خود (ضداسپم پیشرفته)** و **مدیریت حرفه‌ای کانال‌هایتان (پست‌گذاری و انتشار هوشمند)** را متحول کنید. ما ابزارهای قدرتمندی برای تعدیل خودکار، پاسخ‌دهی هوشمند و تعاملی‌سازی محتوا در اختیار شما می‌گذاریم.\n\n👇 **همین حالا مینی‌اپ آی‌فرگمنت را باز کنید:**",
		"open_app": "🚀 ورود به آی‌فرگمنت 💎",
	},
	"notice": map[string]interface{}{
		"payment_success": "✅ *پرداخت موفقیت‌آمیز بود!*\n\nاشتراک شما با موفقیت تمدید شد. از حمایت شما از iFragment سپاسگزاریم!",
		"bot_removed":     "❌ *ربات حذف شد*\n\nمن از گروه «{arg0}» حذف شدم. اگر این یک اشتباه بوده، لطفاً دوباره مرا اضافه کنید.",
		"not_admin":       "⚠️ *دسترسی ادمین موجود نیست*\n\nمن دیگر در این گروه ادمین نیستم. لطفاً دسترسی‌های مرا برای ادامه محافظت بازیابی کنید.",
		"admin_revoked":   "⚠️ *سلب دسترسی ادمین*\n\nدسترسی‌های مدیریت من در گروه «{arg0}» سلب شده است. دیگر نمی‌توانم از گروه محافظت کنم.",
		"spam_attack":     "🚨 *حمله اسپم شناسایی شد*\n\nموج شدیدی از اسپم شناسایی شد! من به مدت ۵ دقیقه به حالت امنیتی بالا (High-Security) تغییر وضعیت دادم.",
		"warning":         "⚠️ *اخطار:* {arg0} (شما {arg1}/{arg2} اخطار دارید)",
	},
	"notifications": map[string]interface{}{
		"expiry_3d":           "⏰ اعتبار گروه «{group}» تا ۳ روز دیگر تمام می‌شود. برای تمدید اقدام کنید.",
		"expiry_24h":          "⏳ تنها ۲۴ ساعت تا قطع خدمات گروه «{group}» باقی است!",
		"service_ended":       "🔒 سرویس گروه «{group}» موقتأ غیرفعال شد.",
		"mass_spam":           "🚨 گروه «{group}» در حال هدف حمله اسپم است!",
		"bot_removed":         "😢 ربات از گروه «{group}» حذف شد. اگر اشتباه بود، دوباره اضافه‌اش کنید.",
		"admin_revoked":       "⚠️ ربات از مقام ادمینی در گروه «{group}» برکنار شد.",
		"admin_revoked_group": "⚠️ من ادمین نیستم؛ نمی‌توانم دفاع کنم.",
		"payment_success":     "✅ پرداخت دریافت شد. اعتبار تا {date} تمدید شد. سپاسگزاریم!",
		"milestone":           "🎉 گروه به نقطه عطف {n} پیام رسید!",
	},
	"generalSettings": map[string]interface{}{
		"welcomeMessage": "پیام خوش‌آمدگویی",
		"warningMessage": "پیام اخطار",
	},
	"customTextsSettings": map[string]interface{}{
		"welcomePlaceholder": "خوش آمدی {user} عزیز به گروه {group}!",
	},
	"channel": map[string]interface{}{
		"start_bot_error": "لطفاً ابتدا ربات را در پی‌وی خود استارت کنید (امکان ارسال پیام خصوصی به شما وجود ندارد): {err}",
		"approve_btn": "✅ تایید و ارسال",
		"reject_btn": "❌ رد کردن",
		"edit_text_btn": "✏️ ویرایش متن",
		"edit_btn_btn": "🔗 ویرایش دکمه‌ها",
		"cancel_btn": "↩️ انصراف و بازگشت",
		"draft_status_pending": "📢 **پیش‌نویس پست جدید برای کانال «{channel}»**\n\n{text}\n\n---\n⏳ **وضعیت:** در انتظار تایید",
		"draft_autoforward_pending": "📢 **پیش‌نویس پست جدید حاصل از AutoForward برای کانال «{channel}»**\n\n{text}\n\n---\n⏳ **وضعیت:** در انتظار تایید",
		"draft_status_edited_pending": "📢 **پیش‌نویس پست ویرایش‌شده جدید**\n\n{text}\n\n---\n⏳ **وضعیت:** در انتظار تایید",
		"draft_status_edited_btn_pending": "📢 **پیش‌نویس پست ویرایش‌شده جدید (همراه دکمه‌های جدید)**\n\n{text}\n\n---\n⏳ **وضعیت:** در انتظار تایید",
		"draft_status_approved": "📢 **پیش‌نویس پست جدید برای کانال «{channel}»**\n\n{text}\n\n---\n✅ **وضعیت:** با موفقیت در کانال منتشر شد!",
		"draft_status_rejected": "📢 **پیش‌نویس پست جدید برای کانال «{channel}»**\n\n{text}\n\n---\n❌ **وضعیت:** این پست توسط شما رد و حذف گردید.",
		"edit_text_instruction": "📝 **لطفاً متن جدید پست را ارسال کنید یا بنویسید (در صورت تمایل می‌توانید پیام پیش‌نویس اصلی را ریپلای کنید):**",
		"edit_btn_instruction": "🔗 **لطفاً دکمه‌های شیشه‌ای جدید را با فرمت زیر ارسال کنید (هر دکمه در یک خط):**\n\n`عنوان دکمه - لینک دکمه`\n\n*مثال:*\n`گوگل - https://google.com`\n`پشتیبانی - https://t.me/support`",
		"owner_only_error": "دسترسی غیرمجاز: این اکشن مختص به مالک ربات است.",
		"click_registered": "کلیک ثبت شد!",
		"draft_expired": "پیشنویس پست منقضی شده یا یافت نشد!",
		"failed_publish": "خطا در انتشار: {err}",
		"success_publish": "پست با موفقیت منتشر شد!",
		"send_text_prompt": "لطفاً متن جدید را ارسال کنید",
		"send_btn_prompt": "لطفاً پیکربندی دکمه‌ها را ارسال کنید",
		"edit_cancelled": "ویرایش لغو شد.",
		"post_rejected": "پست رد و حذف شد.",
	},
	"tooltip_portfolio":   "نمای کلی دارایی‌ها و معیارهای عملکرد شما.",
	"tooltip_buyer_radar": "شناسایی خریداران بالقوه بر اساس علاقه و فعالیت کیف پول آن‌ها.",
	"tooltip_synergy":     "تحلیل نحوه عملکرد مشترک دارایی‌های مختلف برای به حداکثر رساندن ارزش.",
	"tooltip_roi":         "محاسبه بازگشت سرمایه (ROI) در کل مجموعه شما.",
	"tooltip_empire":      "پیگیری کل دارایی خالص، نفوذ و حضور کلی شما در بازار.",
}

var ruDict = map[string]interface{}{
	"onboarding": map[string]interface{}{
		"thanks":   "🎉 *Спасибо за доверие!*\n\nС этого момента цифровой страж группы «{arg0}» к вашим услугам. Я буду с гордостью защищать ваше сообщество от спама, рекламы и хаоса.\n\n🌟 Создано с помощью ИИ и ❤️ командой @iFragmentBot",
		"admin_req": "⚠️ *Остался один шаг до полной активации!*\n\nЧтобы я мог удалять вредоносные сообщения и ограничивать нарушителей, пожалуйста, назначьте меня «Администратором» со следующими правами:\n\n✓ Ограничение участников (Restrict Members)\n✓ Бан пользователей (Ban Users)\n✓ Закрепление сообщений (Pin Messages)",
		"features":  "✅ *Эти функции уже активны:*\n\n🚫 Автоудаление ссылок и доменов\n🤖 Блокировка назойливых ботов\n🔥 Умный антиспам (5 сообщ. / 10 сек)\n\n🎛 Для настройки откройте панель управления:\n👉 [Открыть дашборд]({arg0})",
		"welcome_owner": "🔥 **Панель администратора iFragment**\n\nWelcome back, Commander {arg0}. Управляйте настройками системы и просматривайте логи в реальном времени.\n\n👇 **Открыть панель управления:**",
		"welcome_public": "💎 **Добро пожаловать в универсальную платформу @iFragmentBot.**\n\nОтслеживайте реальную стоимость коллекционных объектов Telegram с помощью iFragment: **ищите, оценивайте и анализируйте** юзернеймы, анонимные номера и подарки.\n\nКроме того, преобразите **безопасность групп (продвинутый антиспам)** и **профессиональное управление каналами (умный постинг и публикации)** с помощью нашей интеллектуальной системы. Мы предоставляем мощные инструменты для автодорожной модерации, автоответов и интерактивного контента.\n\n👇 **Запустите приложение iFragment прямо сейчас:**",
		"open_app": "🚀 Открыть iFragment 💎",
	},
	"notice": map[string]interface{}{
		"payment_success": "✅ *Оплата прошла успешно!*\n\nВаша подписка обновлена. Спасибо за поддержку iFragment!",
		"bot_removed":     "❌ *Бот удален*\n\nЯ был удален из группы «{arg0}». Если это ошибка, пожалуйста, добавьте меня снова.",
		"not_admin":       "⚠️ *Отсутствуют права администратора*\n\nЯ больше не являюсь администратором в этой группе. Пожалуйста, восстановите мои права для продолжения защиты.",
		"admin_revoked":   "⚠️ *Права отозваны*\n\nМои права администратора в «{arg0}» были отозваны. Я больше не могу защищать группу.",
		"spam_attack":     "🚨 *ОБНАРУЖЕНА СПАМ-АТАКА*\n\nОбнаружена массированная волна спама! Я автоматически перешел в режим повышенной безопасности на 5 минут.",
	},
	"notifications": map[string]interface{}{
		"expiry_3d":           "⏰ Подписка группы «{group}» истекает через 3 дня. Продлите сейчас, чтобы избежать перебоев.",
		"expiry_24h":          "⏳ Осталось всего 24 часа до приостановки обслуживания группы «{group}»!",
		"service_ended":       "🔒 Обслуживание группы «{group}» временно отключено.",
		"mass_spam":           "🚨 Группа «{group}» подвергается массовой спам-атаке!",
		"bot_removed":         "😢 Бот был удален из группы «{group}». Если это ошибка, добавьте его снова.",
		"admin_revoked":       "⚠️ Бот был снят с должности администратора в группе «{group}».",
		"admin_revoked_group": "⚠️ Я больше не админ; я не могу защищать группу.",
		"payment_success":     "✅ Оплата получена. Подписка продлена до {date}. Спасибо!",
		"milestone":           "🎉 Группа достигла отметки в {n} сообщений!",
	},
	"generalSettings": map[string]interface{}{
		"welcomeMessage": "Приветствие",
		"warningMessage": "Сообщение с предупреждением",
	},
	"customTextsSettings": map[string]interface{}{
		"welcomePlaceholder": "Добро пожаловать, {user}, в {group}!",
	},
	"channel": map[string]interface{}{
		"start_bot_error": "Пожалуйста, сначала запустите бота в ЛС (невозможно отправить вам ЛС): {err}",
		"approve_btn": "✅ Утвердить и отправить",
		"reject_btn": "❌ Отклонить",
		"edit_text_btn": "✏️ Редактировать текст",
		"edit_btn_btn": "🔗 Редактировать кнопки",
		"cancel_btn": "↩️ Отмена и назад",
		"draft_status_pending": "📢 **Черновик нового поста для канала «{channel}»**\n\n{text}\n\n---\n⏳ **Статус:** Ожидает утверждения",
		"draft_autoforward_pending": "📢 **Черновик нового автопоста для канала «{channel}»**\n\n{text}\n\n---\n⏳ **Статус:** Ожидает утверждения",
		"draft_status_edited_pending": "📢 **Черновик нового отредактированного поста**\n\n{text}\n\n---\n⏳ **Статус:** Ожидает утверждения",
		"draft_status_edited_btn_pending": "📢 **Черновик нового отредактированного поста (с новыми кнопками)**\n\n{text}\n\n---\n⏳ **Статус:** Ожидает утверждения",
		"draft_status_approved": "📢 **Черновик нового поста для канала «{channel}»**\n\n{text}\n\n---\n✅ **Статус:** Успешно опубликован в канале!",
		"draft_status_rejected": "📢 **Черновик нового поста для канала «{channel}»**\n\n{text}\n\n---\n❌ **Статус:** Этот пост был отклонен и удален вами.",
		"edit_text_instruction": "📝 **Пожалуйста, отправьте или напишите новый текст для поста (при желании можете ответить на исходное сообщение черновика):**",
		"edit_btn_instruction": "🔗 **Пожалуйста, отправьте новые встроенные кнопки в следующем формате (одна кнопка на строку):**\n\n`Название кнопки - Ссылка кнопки`\n\n*Пример:*\n`Google - https://google.com`\n`Поддержка - https://t.me/support`",
		"owner_only_error": "Несанкционированный доступ: это действие разрешено только владельцу бота.",
		"click_registered": "Клик зарегистрирован!",
		"draft_expired": "Черновик поста истек или не найден!",
		"failed_publish": "Не удалось опубликовать: {err}",
		"success_publish": "Пост успешно опубликован!",
		"send_text_prompt": "Пожалуйста, отправьте новый текст",
		"send_btn_prompt": "Пожалуйста, отправьте конфигурацию кнопок",
		"edit_cancelled": "Редактирование отменено.",
		"post_rejected": "Пост отклонен и удален.",
	},
	"tooltip_portfolio":   "Полный обзор ваших активов и показателей эффективности.",
	"tooltip_buyer_radar": "Определение потенциальных покупателей на основе их интересов и активности кошельков.",
	"tooltip_synergy":     "Анализ совместной работы различных активов для максимизации стоимости.",
	"tooltip_roi":         "Расчет окупаемости инвестиций (ROI) по всей вашей коллекции.",
	"tooltip_empire":      "Отслеживание вашего общего состояния, влияния и присутствия на рынке.",
}

var zhDict = map[string]interface{}{
	"onboarding": map[string]interface{}{
		"thanks":   "🎉 *感谢您的信任!*\n\n从这一刻起，“{arg0}”的数字守护者将为您服务。我将自豪地保护您的社区免受垃圾信息、广告和混乱的侵害。\n\n🌟 由 AI 提供支持，❤️ 由 @iFragmentBot 打造",
		"admin_req": "⚠️ *距离完全激活仅剩一步!*\n\n为了让我能够删除恶意消息并限制违规者，请将我提升为“管理员”，并授予以下权限：\n\n✓ 删除消息 (Delete Messages)\n✓ 限制成员 (Restrict Members)\n✓ 封禁用户 (Ban Users)\n✓ 置顶消息 (Pin Messages)",
		"features":  "✅ *这些功能现已激活：*\n\n🚫 自动删除链接和域名\n🤖 封锁骚扰机器人\n🔥 智能防洪（10秒内5条消息）\n\n🎛 如需自定义，请打开仪表板：\n👉 [打开仪表板]({arg0})",
		"welcome_owner": "🔥 **iFragment 管理员门户**\n\n欢迎回来，指挥官 {arg0}。管理系统设置、查看实时日志并监控实时状态。\n\n👇 **启动控制面板:**",
		"welcome_public": "💎 **欢迎使用多合一平台 @iFragmentBot。**\n\n使用 iFragment 监控您的 Telegram 收藏品真实价值；实时**搜索、估值和分析**用户名、匿名号码及礼物。\n\n此外，通过我们的智能系统彻底改变您的**群组安全（高级防洪垃圾）**和**专业频道管理（智能发布和排版）**。我们为您提供自动审核、智能自动回复和内容互动的强大工具。\n\n👇 **立即打开 iFragment 小程序：**",
		"open_app": "🚀 打开 iFragment 💎",
	},
	"notice": map[string]interface{}{
		"payment_success": "✅ *支付成功!*\n\n您的订阅已更新。感谢您支持 iFragment!",
		"bot_removed":     "❌ *机器人被移除*\n\n我已从群组“{arg0}”中移除。如果这是一个错误，请将我加回来。",
		"not_admin":       "⚠️ *缺少管理员权限*\n\n我不再是该群组 of 管理员。请恢复我的权限以继续保护。",
		"admin_revoked":   "⚠️ *权限被撤销*\n\n我在“{arg0}”中的管理员权限已被撤销。我无法再保护该群组。",
		"spam_attack":     "🚨 *检测到垃圾邮件攻击*\n\n检测到大规模垃圾邮件浪潮！我已自动切换到高安全模式，持续 5 分钟。",
	},
	"notifications": map[string]interface{}{
		"expiry_3d":           "⏰ 群组“{group}”的订阅将在 3 天内结束。请立即续订以避免服务中断。",
		"expiry_24h":          "⏳ 距离群组“{group}”的服务暂停仅剩 24 小时！",
		"service_ended":       "🔒 群组“{group}”的服务已暂时禁用。",
		"mass_spam":           "🚨 群组“{group}”正遭受大规模垃圾邮件攻击！",
		"bot_removed":         "😢 机器人已从群组“{group}”中移除。如果这是个错误，请重新添加。",
		"admin_revoked":       "⚠️ 机器人已在群组“{group}”中被取消管理员身份。",
		"admin_revoked_group": "⚠️ 我不再是管理员；无法保护群组。",
		"payment_success":     "✅ 已收到付款。订阅已延长至 {date}. 谢谢！",
		"milestone":           "🎉 群组已达到 {n} 条消息 the 里程碑！",
	},
	"generalSettings": map[string]interface{}{
		"welcomeMessage": "欢迎消息",
		"warningMessage": "警告消息",
	},
	"customTextsSettings": map[string]interface{}{
		"welcomePlaceholder": "欢迎 {user} 加入 {group}!",
	},
	"channel": map[string]interface{}{
		"start_bot_error": "请先在私聊中启动机器人（无法向您发送私信）: {err}",
		"approve_btn": "✅ 批准并发送",
		"reject_btn": "❌ 拒绝",
		"edit_text_btn": "✏️ 编辑文本",
		"edit_btn_btn": "🔗 编辑按钮",
		"cancel_btn": "↩️ 取消并返回",
		"draft_status_pending": "📢 **关于频道「{channel}」的新帖子草稿**\n\n{text}\n\n---\n⏳ **状态：** 等待批准",
		"draft_autoforward_pending": "📢 **通过自动转发（AutoForward）生成的频道「{channel}」新帖子草稿**\n\n{text}\n\n---\n⏳ **状态：** 等待批准",
		"draft_status_edited_pending": "📢 **新修改的帖子草稿**\n\n{text}\n\n---\n⏳ **状态：** 等待批准",
		"draft_status_edited_btn_pending": "📢 **新修改的帖子草稿（附带新按钮）**\n\n{text}\n\n---\n⏳ **状态：** 等待批准",
		"draft_status_approved": "📢 **关于频道「{channel}」的新帖子草稿**\n\n{text}\n\n---\n✅ **状态：** 已成功发布到频道！",
		"draft_status_rejected": "📢 **关于频道「{channel}」的新帖子草稿**\n\n{text}\n\n---\n❌ **状态：** 此帖子已被您拒绝并删除。",
		"edit_text_instruction": "📝 **请发送或写入帖子的新文本（如果需要，您可以回复原始草稿消息）：**",
		"edit_btn_instruction": "🔗 **请按以下格式发送新的内联按钮（每行一个按钮）：**\n\n`按钮标题 - 按钮链接`\n\n*示例：*\n`谷歌 - https://google.com`\n`支持 - https://t.me/support`",
		"owner_only_error": "未授权：此操作仅限机器人所有者使用。",
		"click_registered": "点击已注册！",
		"draft_expired": "帖子草稿已过期或未找到！",
		"failed_publish": "发布失败: {err}",
		"success_publish": "帖子已成功发布！",
		"send_text_prompt": "请发送新文本",
		"send_btn_prompt": "请发送按钮配置",
		"edit_cancelled": "编辑已取消。",
		"post_rejected": "帖子已被拒绝并删除。",
	},
}

var arDict = map[string]interface{}{
	"tooltip_portfolio":   "نظرة عامة كاملة على أصولك ومقاييس الأداء.",
	"tooltip_buyer_radar": "تحديد المشترين المحتملين بناءً على اهتماماتهم ونشاط محافظهم.",
	"tooltip_synergy":     "تحليل كيفية أداء الأصول المختلفة معًا لزيادة القيمة إلى أقصى حد.",
	"tooltip_roi":         "حساب العائد على الاستثمار (ROI) عبر مجموعتك بأكملها.",
	"tooltip_empire":      "تتبع إجمالي ثروتك وتأثيرك ووجودك العام في السوق.",
}
