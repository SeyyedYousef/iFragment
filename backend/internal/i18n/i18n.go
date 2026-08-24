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
		"thanks":                "🎉 <b>Thank you for your trust!</b>\n\nFrom this moment, the digital guardian of <b>{arg0}</b> is at your service. I will proudly protect your community from spam, ads, and chaos.\n\n🌟 <i>Powered by AI & ❤️ by @iFragmentBot</i>",
		"admin_req":             "⚠️ <b>One step left to full activation!</b>\n\nTo allow me to delete malicious messages and restrict offenders, please promote me to <b>Administrator</b> with these permissions:\n\n✅ Delete Messages\n✅ Restrict Members\n✅ Ban Users\n✅ Pin Messages",
		"features":              "🛡 <b>Privacy & Security Settings</b>\n\n✅ <b>These features are now active:</b>\n\n🚫 Auto-delete links & domains\n🤖 Block nuisance bots\n🔥 Smart Anti-Spam (5 msgs / 10s)\n\n🎛 To customize, open your dashboard:\n👉 <a href=\"{arg0}\">Open Dashboard</a>",
		"combined":              "🎉 <b>Thank you for your trust!</b>\n\nFrom this moment, the smart guardian of <b>{group}</b> is at your service.\n\n⚙️ <b>To enable full protection, promote me to Admin with:</b>\n✅ Delete Messages  ✅ Restrict Members  ✅ Ban Users  ✅ Pin Messages\n\n🎛 <b>Customize settings via dashboard:</b>\n👉 <a href=\"{url}\">Open Dashboard</a>\n\n🌟 <i>Powered by @iFragmentBot</i>",
		"welcome_owner":         "🔥 <b>iFragment Admin Portal</b>\n\nWelcome back, Commander {arg0}. Manage your system settings, view real-time logs, and monitor live status.\n\n👇 <b>Launch control panel:</b>",
		"welcome_public":        "💎 <b>Welcome to @iFragmentBot</b>\n\nMonitor the true value of your Telegram collectibles; <b>search, value, and analyze</b> usernames, anonymous numbers, and gifts in real time.\n\nTransform your <b>group security</b> and <b>professional channel management</b> using our intelligent system.\n\n👇 <b>Open the iFragment Mini App now:</b>",
		"welcome_hosted_public": "🛡 <b>Hello!</b>\nI am an advanced group management bot here to help you keep your group secure, organized, and professional.\n\n✨ <b>This bot is proudly hosted and powered by @iFragmentBot!</b>\n\nIf you are a group admin and would like to have your very own powerful bot with a <b>custom name, profile picture, and bio</b>, visit our main bot now and create your brand bot in seconds:\n\n👉 <b>@iFragmentBot</b>",
		"open_app":              "🚀 Launch iFragment 💎",
	},
	"moderation": map[string]interface{}{
		"no_ban_perm":    "❌ <b>Permission Denied</b>\nI do not have the required permissions to ban users. Please grant me 'Ban Users' access.",
		"user_banned":    "🚫 <b>User Banned</b>\n\nTarget: <a href=\"tg://user?id={id}\">{name}</a>",
		"no_unban_perm":  "❌ <b>Permission Denied</b>\nI do not have the required permissions to unban users.",
		"user_unbanned":  "✅ <b>User Unbanned</b>\n\nTarget: <a href=\"tg://user?id={id}\">{name}</a>",
		"no_mute_perm":   "❌ <b>Permission Denied</b>\nI do not have the required permissions to mute users. Please grant me 'Restrict Members' access.",
		"user_muted":     "🔇 <b>User Muted (24h)</b>\n\nTarget: <a href=\"tg://user?id={id}\">{name}</a>",
		"no_unmute_perm": "❌ <b>Permission Denied</b>\nI do not have the required permissions to unmute users.",
		"user_unmuted":   "🔊 <b>User Unmuted</b>\n\nTarget: <a href=\"tg://user?id={id}\">{name}</a>",
		"no_rules":       "⚠️ <b>No Rules Set</b>\nThere are no rules configured for this group. You can set them up in the dashboard.",
		"rules_title":    "📜 <b>Group Rules</b>\n\n{rules}",
	},
	"penalty": map[string]interface{}{
		"mute": "🔇 <b>User restricted for {duration}</b>\n\nReason: {reason}",
		"kick": "👢 <b>User kicked</b>\n\nReason: {reason}",
		"ban":  "🚫 <b>User banned</b>\n\nReason: {reason}",
		"warn": "⚠️ <b>Warning {count}/{threshold}</b>\n\n{reason}",
	},
	"verification": map[string]interface{}{
		"pv_prompt": "🛡 To join <b>{group}</b>, please click the button below to verify yourself:",
	},
	"payments": map[string]interface{}{
		"success":                "✅ <b>Payment Successful!</b>\n\nCredited <b>{amount}</b> Coins (FRG) to your balance.",
		"report_unlocked":        "💎 <b>Payment Received</b>\n\nYour <b>@{username}</b> report is unlocked:\n<a href=\"{url}\">View Report</a>",
		"number_report_unlocked": "💎 <b>Payment Received</b>\n\nYour <b>{number}</b> valuation report is unlocked:\n<a href=\"{url}\">View Report</a>",
		"credit_deduct_failed":   "⚠️ Your payment was received, but coin deduction encountered an issue. Our team is reviewing this.",
	},
	"funnel": map[string]interface{}{
		"failed":         "❌ <b>Failed to publish:</b> {err}",
		"switched_style": "🤖 <b>Switched style to variant {index}</b>\n\nCaption preview:\n{text}",
		"regenerated":    "🔄 <b>AI variations regenerated</b>\n\nCaption preview:\n{text}",
		"send_new":       "✍️ <b>Send the new text below.</b>\n<i>It will overwrite the current caption draft.</i>",
		"select_delay":   "📅 <b>Select a delay time to schedule this post:</b>",
		"updated":        "✍️ <b>Caption updated!</b>\n\nNew caption preview:\n{text}",
		"published":      "🚀 <b>Post successfully published to the channel!</b>\n\n🔑 <b>Unique Post ID:</b> <code>{id}</code>\n<i>Use this key to edit or update the live post caption in the future.</i>",
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
		"expiry_3d":           "⚠️ <b>Subscription Expiring Soon</b>\n\nYour subscription for <b>{group}</b> will expire in <b>3 days</b>.\n\nPlease renew to avoid any interruption in protection services.",
		"expiry_24h":          "🚨 <b>Critical Warning</b>\n\nOnly <b>24 hours</b> left until service for <b>{group}</b> is suspended!\n\nRenew immediately to keep your group secure.",
		"service_ended":       "🔒 <b>Service Suspended</b>\n\nThe subscription for <b>{group}</b> has ended. All protection services have been disabled until you renew.",
		"mass_spam":           "🚨 <b>SPAM ATTACK DETECTED</b>\n\n<b>{group}</b> is currently under a mass spam attack. The system has successfully mitigated the threat.",
		"bot_removed":         "😢 <b>Bot Removed</b>\n\nI was removed from group <b>{group}</b>. If this was a mistake, please add me back.",
		"bot_removed_channel": "❌ <b>Bot Removed from Channel</b>\n\nI was removed from your channel <b>{channel}</b>. My services have been stopped.",
		"admin_revoked":       "⚠️ <b>Permissions Revoked</b>\n\nMy administrator rights were revoked in <b>{group}</b>.",
		"admin_revoked_group": "⚠️ <b>Missing Permissions</b>\n\nI no longer have administrator rights. Please grant me admin access so I can protect the group.",
		"payment_success":     "✅ <b>Payment Successful!</b>\n\nThank you for your trust. Your subscription has been extended until <b>{date}</b>.",
		"milestone":           "🎉 <b>Milestone Reached!</b>\n\nCongratulations, the group has reached <b>{n}</b> messages!",
		"channel_auto_left":   "🚪 <b>Auto Leave Executed</b>\n\nBecause the subscription for <b>{channel}</b> was not renewed for 7 days, I have automatically left the channel.",
		"group_auto_left":     "🚪 <b>Auto Leave Executed</b>\n\nBecause the subscription for <b>{group}</b> was not renewed for 7 days, I have automatically left the group.",
		"pro_pass_activated":  "👑 <b>iFragment Pro Pass Activated!</b>\n\nYou now have 30 days of:\n• 3 Deep Daily Valuations\n• 70%+ Fragment Arbitrage Alerts\n• Official Digital Valuation Certificate\n\nEnjoy trading on Fragment!",
	},
	"generalSettings": map[string]interface{}{
		"welcomeMessage": "Welcome Message",
		"warningMessage": "Warning Message",
	},
	"customTextsSettings": map[string]interface{}{
		"welcomePlaceholder": "Welcome {user} to {group}!",
	},
	"channel": map[string]interface{}{
		"start_bot_error":                 "Please start the bot in your private chat first (cannot send private message to you): {err}",
		"approve_btn":                     "✅ Approve & Send",
		"reject_btn":                      "❌ Reject",
		"edit_text_btn":                   "✏️ Edit Text",
		"edit_btn_btn":                    "🔗 Edit Buttons",
		"cancel_btn":                      "↩️ Cancel & Back",
		"draft_status_pending":            "📢 <b>New post draft for channel \"{channel}\"</b>\n\n{text}\n\n---\n⏳ <b>Status:</b> Pending Approval",
		"draft_autoforward_pending":       "📢 <b>New post draft via AutoForward for channel \"{channel}\"</b>\n\n{text}\n\n---\n⏳ <b>Status:</b> Pending Approval",
		"draft_status_edited_pending":     "📢 <b>New edited post draft</b>\n\n{text}\n\n---\n⏳ <b>Status:</b> Pending Approval",
		"draft_status_edited_btn_pending": "📢 <b>New edited post draft (with new buttons)</b>\n\n{text}\n\n---\n⏳ <b>Status:</b> Pending Approval",
		"draft_status_approved":           "📢 <b>New post draft for channel \"{channel}\"</b>\n\n{text}\n\n---\n✅ <b>Status:</b> Successfully published to the channel!",
		"draft_status_rejected":           "📢 <b>New post draft for channel \"{channel}\"</b>\n\n{text}\n\n---\n❌ <b>Status:</b> This post was rejected and deleted by you.",
		"edit_text_instruction":           "📝 <b>Please send or write the new text for the post (you can reply to the original draft message if desired):</b>",
		"edit_btn_instruction":            "🔗 <b>Please send the new inline buttons in the following format (one button per line):</b>\n\n`Button Title - Button Link`\n\n*Example:*\n`Google - https://google.com`\n`Support - https://t.me/support`",
		"owner_only_error":                "Unauthorized: This action is restricted to the bot owner.",
		"click_registered":                "Click registered!",
		"draft_expired":                   "Post draft expired or not found!",
		"failed_publish":                  "Failed to publish: {err}",
		"success_publish":                 "Post successfully published!",
		"send_text_prompt":                "Please send the new text",
		"send_btn_prompt":                 "Please send button configuration",
		"edit_cancelled":                  "Editing cancelled.",
		"post_rejected":                   "Post rejected and deleted.",
	},
	"tooltip_portfolio":   "Your complete asset overview and performance metrics.",
	"tooltip_buyer_radar": "Identify potential buyers based on their interest and wallet activity.",
	"tooltip_synergy":     "Analyze how different assets perform together to maximize value.",
	"tooltip_roi":         "Calculate your Return on Investment across your entire collection.",
	"tooltip_empire":      "Track your total net worth, influence, and overall market presence.",
}

var faDict = map[string]interface{}{
	"onboarding": map[string]interface{}{
		"thanks":                "🎉 <b>از اعتماد شما سپاسگزاریم!</b>\n\nاز این لحظه، نگهبان دیجیتال <b>{arg0}</b> در خدمت شماست. با افتخار از جامعه‌ی شما در برابر اسپم، تبلیغات مزاحم و بی‌نظمی محافظت خواهم کرد.\n\n🌟 <i>طراحی شده با هوش مصنوعی و ❤️ توسط تیم @iFragmentBot</i>",
		"admin_req":             "⚠️ <b>تنها یک قدم تا فعال‌سازی کامل باقیست!</b>\n\nبرای اینکه بتوانم پیام‌های مخرب را حذف و با متخلفان برخورد کنم، لطفاً مرا به عنوان <b>مدیر (Administrator)</b> با دسترسی‌های زیر ارتقا دهید:\n\n✅ حذف پیام‌ها (Delete Messages)\n✅ محدود کردن کاربران (Restrict Members)\n✅ مسدود کردن کاربران (Ban Users)\n✅ سنجاق کردن پیام (Pin Messages)",
		"features":              "🛡 <b>تنظیمات حریم خصوصی و امنیت</b>\n\n✅ <b>قابلیت‌های زیر هم‌اکنون فعال هستند:</b>\n\n🚫 حذف خودکار لینک‌ها و دامنه‌ها\n🤖 مسدودسازی ربات‌های مزاحم\n🔥 ضد اسپم هوشمند (۵ پیام در ۱۰ ثانیه)\n\n🎛 برای شخصی‌سازی، داشبورد مدیریت خود را باز کنید:\n👉 <a href=\"{arg0}\">ورود به داشبورد</a>",
		"combined":              "🎉 <b>از اعتماد شما سپاسگزاریم!</b>\n\nاز این لحظه، محافظ هوشمند <b>{group}</b> در خدمت شماست.\n\n⚙️ <b>برای فعال‌سازی کامل، مرا ادمین کنید با دسترسی‌های:</b>\n✅ حذف پیام‌ها  ✅ محدودسازی اعضا  ✅ بن کاربران  ✅ سنجاق پیام\n\n🎛 <b>مدیریت و شخصی‌سازی از داشبورد:</b>\n👉 <a href=\"{url}\">ورود به داشبورد</a>\n\n🌟 <i>قدرت‌گرفته از @iFragmentBot</i>",
		"welcome_owner":         "🔥 <b>پنل مدیریت آی‌فرگمنت</b>\n\nخوش آمدید فرمانده {arg0}. تنظیمات سیستم خود را مدیریت کنید، لاگ‌ها را لحظه‌ای بررسی کنید و وضعیت را کنترل نمایید.\n\n👇 <b>ورود به کنترل پنل:</b>",
		"welcome_public":        "💎 <b>به پلتفرم همه‌کاره @iFragmentBot خوش آمدید.</b>\n\nبا آی‌فرگمنت ارزش واقعی دارایی‌های تلگرامی خود را ارزیابی کنید؛ نام‌های کاربری، شماره‌های ناشناس و هدایا را <b>جستجو، ارزش‌گذاری و تحلیل</b> کنید.\n\nهمچنین <b>امنیت گروه‌ها</b> و <b>مدیریت حرفه‌ای کانال‌های خود</b> را با سیستم هوشمند ما متحول سازید.\n\n👇 <b>همین حالا مینی‌اپ آی‌فرگمنت را باز کنید:</b>",
		"welcome_hosted_public": "سلام! 🛡\nمن یک ربات پیشرفته مدیریت گروه هستم و اینجا حضور دارم تا به شما کمک کنم گروهی امن، منظم و حرفه‌ای داشته باشید.\n\n✨ <b>این ربات با افتخار توسط @iFragmentBot میزبانی و قدرت‌دهی می‌شود!</b>\n\nاگر شما هم مدیر یک گروه هستید و دوست دارید یک ربات کاملاً اختصاصی و قدرتمند با <b>نام، پروفایل و بیوگرافی دلخواه خودتان</b> داشته باشید، همین حالا به بات اصلی ما سر بزنید و در کمتر از چند ثانیه بات برند خودتان را بسازید:\n\n👉 <b>@iFragmentBot</b>",
		"open_app":              "🚀 ورود به آی‌فرگمنت 💎",
	},
	"moderation": map[string]interface{}{
		"no_ban_perm":    "❌ <b>عدم دسترسی</b>\nمن دسترسی لازم برای مسدود (Ban) کردن کاربران را ندارم. لطفاً دسترسی 'Ban Users' را به من بدهید.",
		"user_banned":    "🚫 <b>کاربر مسدود شد</b>\n\nکاربر: <a href=\"tg://user?id={id}\">{name}</a>",
		"no_unban_perm":  "❌ <b>عدم دسترسی</b>\nمن دسترسی لازم برای رفع مسدودی (Unban) کاربران را ندارم.",
		"user_unbanned":  "✅ <b>کاربر رفع مسدودی شد</b>\n\nکاربر: <a href=\"tg://user?id={id}\">{name}</a>",
		"no_mute_perm":   "❌ <b>عدم دسترسی</b>\nمن دسترسی لازم برای بی‌صدا (Mute) کردن کاربران را ندارم. لطفاً دسترسی 'Restrict Members' را بدهید.",
		"user_muted":     "🔇 <b>کاربر بی‌صدا شد (۲۴ ساعت)</b>\n\nکاربر: <a href=\"tg://user?id={id}\">{name}</a>",
		"no_unmute_perm": "❌ <b>عدم دسترسی</b>\nمن دسترسی لازم برای رفع بی‌صدایی کاربران را ندارم.",
		"user_unmuted":   "🔊 <b>کاربر صدادار شد</b>\n\nکاربر: <a href=\"tg://user?id={id}\">{name}</a>",
		"no_rules":       "⚠️ <b>بدون قانون</b>\nهیچ قانونی برای این گروه تنظیم نشده است. می‌توانید از طریق داشبورد قوانین را اضافه کنید.",
		"rules_title":    "📜 <b>قوانین گروه</b>\n\n{rules}",
	},
	"penalty": map[string]interface{}{
		"mute": "🔇 <b>کاربر به مدت {duration} بی‌صدا شد</b>\n\nعلت: {reason}",
		"kick": "👢 <b>کاربر از گروه اخراج شد</b>\n\nعلت: {reason}",
		"ban":  "🚫 <b>کاربر مسدود (Ban) شد</b>\n\nعلت: {reason}",
		"warn": "⚠️ <b>اخطار {count} از {threshold}</b>\n\nعلت: {reason}",
	},
	"verification": map[string]interface{}{
		"pv_prompt": "🛡 برای ورود به گروه <b>{group}</b>، لطفاً روی دکمه زیر کلیک کنید تا هویت شما تأیید شود:",
	},
	"payments": map[string]interface{}{
		"success":                "✅ <b>پرداخت موفقیت‌آمیز!</b>\n\nمبلغ <b>{amount}</b> سکه (FRG) به حساب شما واریز شد.",
		"report_unlocked":        "💎 <b>تایید پرداخت</b>\n\nگزارش تحلیل یوزرنیم <b>@{username}</b> برای شما باز شد:\n<a href=\"{url}\">مشاهده گزارش</a>",
		"number_report_unlocked": "💎 <b>تایید پرداخت</b>\n\nگزارش ارزش‌گذاری شماره <b>{number}</b> برای شما باز شد:\n<a href=\"{url}\">مشاهده گزارش</a>",
	},
	"funnel": map[string]interface{}{
		"failed":         "❌ <b>خطا در انتشار:</b> {err}",
		"switched_style": "🤖 <b>تغییر استایل به نسخه {index}</b>\n\nپیش‌نمایش کپشن:\n{text}",
		"regenerated":    "🔄 <b>نسخه‌های هوش مصنوعی بازتولید شدند</b>\n\nپیش‌نمایش کپشن:\n{text}",
		"send_new":       "✍️ <b>متن جدید را در زیر ارسال کنید.</b>\n<i>این متن جایگزین پیش‌نویس فعلی خواهد شد.</i>",
		"select_delay":   "📅 <b>زمان تاخیر برای ارسال این پست را انتخاب کنید:</b>",
		"updated":        "✍️ <b>کپشن به‌روزرسانی شد!</b>\n\nپیش‌نمایش جدید کپشن:\n{text}",
		"published":      "🚀 <b>پست با موفقیت در کانال منتشر شد!</b>\n\n🔑 <b>شناسه یکتای پست:</b> <code>{id}</code>\n<i>از این شناسه برای ویرایش پست‌های منتشر شده در آینده استفاده کنید.</i>",
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
		"expiry_3d":           "⚠️ <b>هشدار پایان اشتراک</b>\n\nاعتبار سرویس شما برای <b>{group}</b> تا <b>۳ روز دیگر</b> به پایان می‌رسد.\n\nجهت جلوگیری از توقف خدمات امنیتی، لطفاً نسبت به تمدید اقدام نمایید.",
		"expiry_24h":          "🚨 <b>اخطار مهم</b>\n\nتنها <b>۲۴ ساعت</b> تا قطع کامل خدمات در <b>{group}</b> باقی مانده است!\n\nبرای حفظ امنیت سیستم، فوراً اشتراک خود را تمدید کنید.",
		"service_ended":       "🔒 <b>خدمات متوقف شد</b>\n\nاشتراک <b>{group}</b> به پایان رسید و تمامی سرویس‌های سیستم تا زمان تمدید غیرفعال شدند.",
		"mass_spam":           "🚨 <b>حمله اسپم شناسایی شد</b>\n\nگروه <b>{group}</b> هم‌اکنون تحت حمله شدید اسپم قرار دارد. سیستم با موفقیت در حال دفع حملات است.",
		"bot_removed":         "😢 <b>حذف ربات</b>\n\nمن از گروه <b>{group}</b> حذف شدم. در صورتی که این یک اشتباه بوده، مجدداً مرا اضافه کنید.",
		"bot_removed_channel": "❌ <b>حذف از کانال</b>\n\nمن از کانال <b>{channel}</b> حذف شدم و تمامی خدمات متوقف گردید.",
		"admin_revoked":       "⚠️ <b>سلب دسترسی</b>\n\nدسترسی ادمینی من در <b>{group}</b> لغو شد.",
		"admin_revoked_group": "⚠️ <b>نقص در دسترسی‌ها</b>\n\nمن دیگر دسترسی ادمین ندارم و نمی‌توانم از گروه محافظت کنم. لطفاً دسترسی‌ها را بررسی کنید.",
		"payment_success":     "✅ <b>پرداخت موفق!</b>\n\nاز اعتماد شما سپاسگزاریم. اشتراک شما با موفقیت تا تاریخ <b>{date}</b> تمدید شد.",
		"milestone":           "🎉 <b>موفقیت جدید!</b>\n\nتبریک! گروه به رکورد <b>{n}</b> پیام دست یافت.",
		"channel_auto_left":   "🚪 <b>خروج خودکار سیستم</b>\n\nبا توجه به گذشت ۷ روز از پایان اعتبار <b>{channel}</b> و عدم تمدید، ربات به صورت خودکار از کانال خارج شد.",
		"group_auto_left":     "🚪 <b>خروج خودکار سیستم</b>\n\nبا توجه به گذشت ۷ روز از پایان اعتبار <b>{group}</b> و عدم تمدید، ربات به صورت خودکار از گروه خارج شد.",
		"pro_pass_activated":  "👑 <b>اشتراک پرو iFragment فعال شد!</b>\n\nشما اکنون به مدت ۳۰ روز دسترسی دارید به:\n• ۳ قیمت‌گذاری عمیق روزانه\n• هشدارهای آربیتراژ فرگمنت بالای ۷۰٪\n• گواهی رسمی ارزیابی دیجیتال\n\nاز معاملات هوشمند در فرگمنت لذت ببرید!",
	},
	"generalSettings": map[string]interface{}{
		"welcomeMessage": "پیام خوش‌آمدگویی",
		"warningMessage": "پیام اخطار",
	},
	"customTextsSettings": map[string]interface{}{
		"welcomePlaceholder": "خوش آمدی {user} عزیز به گروه {group}!",
	},
	"channel": map[string]interface{}{
		"start_bot_error":                 "لطفاً ابتدا ربات را در پی‌وی خود استارت کنید (امکان ارسال پیام خصوصی به شما وجود ندارد): {err}",
		"approve_btn":                     "✅ تایید و ارسال",
		"reject_btn":                      "❌ رد کردن",
		"edit_text_btn":                   "✏️ ویرایش متن",
		"edit_btn_btn":                    "🔗 ویرایش دکمه‌ها",
		"cancel_btn":                      "↩️ انصراف و بازگشت",
		"draft_status_pending":            "📢 <b>پیش‌نویس پست جدید برای کانال «{channel}»</b>\n\n{text}\n\n---\n⏳ <b>وضعیت:</b> در انتظار تایید",
		"draft_autoforward_pending":       "📢 <b>پیش‌نویس پست جدید حاصل از AutoForward برای کانال «{channel}»</b>\n\n{text}\n\n---\n⏳ <b>وضعیت:</b> در انتظار تایید",
		"draft_status_edited_pending":     "📢 <b>پیش‌نویس پست ویرایش‌شده جدید</b>\n\n{text}\n\n---\n⏳ <b>وضعیت:</b> در انتظار تایید",
		"draft_status_edited_btn_pending": "📢 <b>پیش‌نویس پست ویرایش‌شده جدید (همراه دکمه‌های جدید)</b>\n\n{text}\n\n---\n⏳ <b>وضعیت:</b> در انتظار تایید",
		"draft_status_approved":           "📢 <b>پیش‌نویس پست جدید برای کانال «{channel}»</b>\n\n{text}\n\n---\n✅ <b>وضعیت:</b> با موفقیت در کانال منتشر شد!",
		"draft_status_rejected":           "📢 <b>پیش‌نویس پست جدید برای کانال «{channel}»</b>\n\n{text}\n\n---\n❌ <b>وضعیت:</b> این پست توسط شما رد و حذف گردید.",
		"edit_text_instruction":           "📝 <b>لطفاً متن جدید پست را ارسال کنید یا بنویسید (در صورت تمایل می‌توانید پیام پیش‌نویس اصلی را ریپلای کنید):</b>",
		"edit_btn_instruction":            "🔗 <b>لطفاً دکمه‌های شیشه‌ای جدید را با فرمت زیر ارسال کنید (هر دکمه در یک خط):</b>\n\n`عنوان دکمه - لینک دکمه`\n\n*مثال:*\n`گوگل - https://google.com`\n`پشتیبانی - https://t.me/support`",
		"owner_only_error":                "دسترسی غیرمجاز: این اکشن مختص به مالک ربات است.",
		"click_registered":                "کلیک ثبت شد!",
		"draft_expired":                   "پیشنویس پست منقضی شده یا یافت نشد!",
		"failed_publish":                  "خطا در انتشار: {err}",
		"success_publish":                 "پست با موفقیت منتشر شد!",
		"send_text_prompt":                "لطفاً متن جدید را ارسال کنید",
		"send_btn_prompt":                 "لطفاً پیکربندی دکمه‌ها را ارسال کنید",
		"edit_cancelled":                  "ویرایش لغو شد.",
		"post_rejected":                   "پست رد و حذف شد.",
	},
	"tooltip_portfolio":   "نمای کلی دارایی‌ها و معیارهای عملکرد شما.",
	"tooltip_buyer_radar": "شناسایی خریداران بالقوه بر اساس علاقه و فعالیت کیف پول آن‌ها.",
	"tooltip_synergy":     "تحلیل نحوه عملکرد مشترک دارایی‌های مختلف برای به حداکثر رساندن ارزش.",
	"tooltip_roi":         "محاسبه بازگشت سرمایه (ROI) در کل مجموعه شما.",
	"tooltip_empire":      "پیگیری کل دارایی خالص، نفوذ و حضور کلی شما در بازار.",
}

var ruDict = map[string]interface{}{
	"onboarding": map[string]interface{}{
		"thanks":                "🎉 <b>Спасибо за ваше доверие!</b>\n\nС этого момента цифровой страж <b>{arg0}</b> к вашим услугам. Я буду с гордостью защищать ваше сообщество от спама, рекламы и хаоса.\n\n🌟 <i>Создано с помощью ИИ и ❤️ командой @iFragmentBot</i>",
		"admin_req":             "⚠️ <b>Остался один шаг до полной активации!</b>\n\nЧтобы я мог удалять вредоносные сообщения и ограничивать нарушителей, пожалуйста, назначьте меня <b>Администратором</b> со следующими правами:\n\n✅ Удаление сообщений\n✅ Ограничение участников\n✅ Бан пользователей\n✅ Закрепление сообщений",
		"features":              "🛡 <b>Настройки конфиденциальности и безопасности</b>\n\n✅ <b>Эти функции уже активны:</b>\n\n🚫 Автоудаление ссылок и доменов\n🤖 Блокировка назойливых ботов\n🔥 Умный антиспам (5 сообщ. / 10 сек)\n\n🎛 Для настройки откройте панель управления:\n👉 <a href=\"{arg0}\">Открыть дашборд</a>",
		"welcome_owner":         "🔥 <b>Панель администратора iFragment</b>\n\nДобро пожаловать, Командир {arg0}. Управляйте настройками системы и просматривайте логи в реальном времени.\n\n👇 <b>Открыть панель управления:</b>",
		"welcome_public":        "💎 <b>Добро пожаловать в @iFragmentBot</b>\n\nОтслеживайте реальную стоимость коллекционных объектов Telegram; <b>ищите, оценивайте и анализируйте</b> юзернеймы, анонимные номера и подарки в реальном времени.\n\nКроме того, преобразите <b>безопасность групп</b> и <b>профессиональное управление каналами</b> с помощью нашей системы.\n\n👇 <b>Запустите приложение iFragment прямо сейчас:</b>",
		"welcome_hosted_public": "Привет! 🛡\nЯ продвинутый бот для управления группами, созданный для того, чтобы ваша группа была безопасной, организованной и профессиональной.\n\n✨ <b>Этот бот с гордостью поддерживается и предоставляется @iFragmentBot!</b>\n\nЕсли вы администратор группы и хотите иметь собственного мощного бота с <b>персональным именем, фото и описанием</b>, зайдите в нашего главного бота и создайте свой бренд-бот за пару секунд:\n\n👉 <b>@iFragmentBot</b>\n👉 <b>@iFragmentBot</b>",
		"open_app":              "🚀 Открыть iFragment 💎",
	},
	"moderation": map[string]interface{}{
		"no_ban_perm":    "❌ <b>Отказ в доступе</b>\nУ меня нет прав для бана пользователей. Пожалуйста, предоставьте доступ 'Бан пользователей'.",
		"user_banned":    "🚫 <b>Пользователь забанен</b>\n\nЦель: <a href=\"tg://user?id={id}\">{name}</a>",
		"no_unban_perm":  "❌ <b>Отказ в доступе</b>\nУ меня нет прав для разбана пользователей.",
		"user_unbanned":  "✅ <b>Пользователь разбанен</b>\n\nЦель: <a href=\"tg://user?id={id}\">{name}</a>",
		"no_mute_perm":   "❌ <b>Отказ в доступе</b>\nУ меня нет прав для мута пользователей. Пожалуйста, предоставьте доступ 'Ограничение участников'.",
		"user_muted":     "🔇 <b>Пользователь в муте (24ч)</b>\n\nЦель: <a href=\"tg://user?id={id}\">{name}</a>",
		"no_unmute_perm": "❌ <b>Отказ в доступе</b>\nУ меня нет прав для размута пользователей.",
		"user_unmuted":   "🔊 <b>Звук включен</b>\n\nЦель: <a href=\"tg://user?id={id}\">{name}</a>",
		"no_rules":       "⚠️ <b>Правила не установлены</b>\nВ этой группе нет правил. Вы можете настроить их в дашборде.",
		"rules_title":    "📜 <b>Правила группы</b>\n\n{rules}",
	},
	"penalty": map[string]interface{}{
		"mute": "🔇 <b>Пользователь ограничен на {duration}</b>\n\nПричина: {reason}",
		"kick": "👢 <b>Пользователь исключен</b>\n\nПричина: {reason}",
		"ban":  "🚫 <b>Пользователь заблокирован</b>\n\nПричина: {reason}",
		"warn": "⚠️ <b>Предупреждение {count}/{threshold}</b>\n\nПричина: {reason}",
	},
	"verification": map[string]interface{}{
		"pv_prompt": "🛡 Чтобы вступить в <b>{group}</b>, нажмите кнопку ниже для подтверждения:",
	},
	"payments": map[string]interface{}{
		"success":                "✅ <b>Оплата прошла успешно!</b>\n\nЗачислено <b>{amount}</b> монет (FRG) на ваш баланс.",
		"report_unlocked":        "💎 <b>Оплата получена</b>\n\nВаш отчет <b>@{username}</b> разблокирован:\n<a href=\"{url}\">Посмотреть отчет</a>",
		"number_report_unlocked": "💎 <b>Оплата получена</b>\n\nВаш отчет по номеру <b>{number}</b> разблокирован:\n<a href=\"{url}\">Посмотреть отчет</a>",
	},
	"funnel": map[string]interface{}{
		"failed":         "❌ <b>Не удалось опубликовать:</b> {err}",
		"switched_style": "🤖 <b>Стиль изменен на вариант {index}</b>\n\nПредпросмотр:\n{text}",
		"regenerated":    "🔄 <b>Вариации ИИ пересозданы</b>\n\nПредпросмотр:\n{text}",
		"send_new":       "✍️ <b>Отправьте новый текст ниже.</b>\n<i>Он заменит текущий черновик.</i>",
		"select_delay":   "📅 <b>Выберите время задержки для публикации:</b>",
		"updated":        "✍️ <b>Подпись обновлена!</b>\n\nНовый предпросмотр:\n{text}",
		"published":      "🚀 <b>Пост успешно опубликован в канале!</b>\n\n🔑 <b>Уникальный ID поста:</b> <code>{id}</code>\n<i>Используйте этот ключ для редактирования в будущем.</i>",
	},
	"notice": map[string]interface{}{
		"payment_success": "✅ *Оплата прошла успешно!*\n\nВаша подписка обновлена. Спасибо за поддержку iFragment!",
		"bot_removed":     "❌ *Бот удален*\n\nЯ был удален из группы «{arg0}». Если это ошибка, пожалуйста, добавьте меня снова.",
		"not_admin":       "⚠️ *Отсутствуют права администратора*\n\nЯ больше не являюсь администратором в этой группе. Пожалуйста, восстановите мои права для продолжения защиты.",
		"admin_revoked":   "⚠️ *Права отозваны*\n\nМои права администратора в «{arg0}» были отозваны. Я больше не могу защищать группу.",
		"spam_attack":     "🚨 *ОБНАРУЖЕНА СПАМ-АТАКА*\n\nОбнаружена массированная волна спама! Я автоматически перешел в режим повышенной безопасности на 5 минут.",
	},
	"notifications": map[string]interface{}{
		"expiry_3d":           "⚠️ <b>Подписка скоро истечет</b>\n\nВаша подписка для <b>{group}</b> истекает через <b>3 дня</b>.\n\nПожалуйста, продлите ее, чтобы избежать перебоев в работе.",
		"expiry_24h":          "🚨 <b>Критическое предупреждение</b>\n\nОсталось всего <b>24 часа</b> до приостановки обслуживания <b>{group}</b>!\n\nПродлите немедленно, чтобы ваша группа оставалась в безопасности.",
		"service_ended":       "🔒 <b>Обслуживание приостановлено</b>\n\nПодписка для <b>{group}</b> истекла. Все защитные сервисы отключены до продления.",
		"mass_spam":           "🚨 <b>ОБНАРУЖЕНА СПАМ-АТАКА</b>\n\n<b>{group}</b> в настоящее время подвергается массированной спам-атаке. Угроза успешно предотвращена.",
		"bot_removed":         "😢 <b>Бот удален</b>\n\nЯ был удален из группы <b>{group}</b>. Если это ошибка, пожалуйста, добавьте меня снова.",
		"bot_removed_channel": "❌ <b>Бот удален из канала</b>\n\nЯ был удален из вашего канала <b>{channel}</b>. Мои услуги остановлены.",
		"admin_revoked":       "⚠️ <b>Права отозваны</b>\n\nМои права администратора в <b>{group}</b> были отозваны.",
		"admin_revoked_group": "⚠️ <b>Отсутствуют права</b>\n\nУ меня больше нет прав администратора. Пожалуйста, предоставьте доступ, чтобы я мог защищать группу.",
		"payment_success":     "✅ <b>Оплата прошла успешно!</b>\n\nСпасибо за доверие. Ваша подписка продлена до <b>{date}</b>.",
		"milestone":           "🎉 <b>Достигнут рубеж!</b>\n\nПоздравляем, группа достигла <b>{n}</b> сообщений!",
		"channel_auto_left":   "🚪 <b>Автоматический выход</b>\n\nПоскольку подписка для <b>{channel}</b> не продлевалась 7 дней, я автоматически покинул канал.",
		"group_auto_left":     "🚪 <b>Автоматический выход</b>\n\nПоскольку подписка для <b>{group}</b> не продлевалась 7 дней, я автоматически покинул группу.",
	},
	"generalSettings": map[string]interface{}{
		"welcomeMessage": "Приветствие",
		"warningMessage": "Сообщение с предупреждением",
	},
	"customTextsSettings": map[string]interface{}{
		"welcomePlaceholder": "Добро пожаловать, {user}, в {group}!",
	},
	"channel": map[string]interface{}{
		"start_bot_error":                 "Пожалуйста, сначала запустите бота в ЛС (невозможно отправить вам ЛС): {err}",
		"approve_btn":                     "✅ Утвердить и отправить",
		"reject_btn":                      "❌ Отклонить",
		"edit_text_btn":                   "✏️ Редактировать текст",
		"edit_btn_btn":                    "🔗 Редактировать кнопки",
		"cancel_btn":                      "↩️ Отмена и назад",
		"draft_status_pending":            "📢 <b>Черновик нового поста для канала «{channel}»</b>\n\n{text}\n\n---\n⏳ <b>Статус:</b> Ожидает утверждения",
		"draft_autoforward_pending":       "📢 <b>Черновик нового автопоста для канала «{channel}»</b>\n\n{text}\n\n---\n⏳ <b>Статус:</b> Ожидает утверждения",
		"draft_status_edited_pending":     "📢 <b>Черновик нового отредактированного поста</b>\n\n{text}\n\n---\n⏳ <b>Статус:</b> Ожидает утверждения",
		"draft_status_edited_btn_pending": "📢 <b>Черновик нового отредактированного поста (с новыми кнопками)</b>\n\n{text}\n\n---\n⏳ <b>Статус:</b> Ожидает утверждения",
		"draft_status_approved":           "📢 <b>Черновик нового поста для канала «{channel}»</b>\n\n{text}\n\n---\n✅ <b>Статус:</b> Успешно опубликован в канале!",
		"draft_status_rejected":           "📢 <b>Черновик нового поста для канала «{channel}»</b>\n\n{text}\n\n---\n❌ <b>Статус:</b> Этот пост был отклонен и удален вами.",
		"edit_text_instruction":           "📝 <b>Пожалуйста, отправьте или напишите новый текст для поста (при желании можете ответить на исходное сообщение черновика):</b>",
		"edit_btn_instruction":            "🔗 <b>Пожалуйста, отправьте новые встроенные кнопки в следующем формате (одна кнопка на строку):</b>\n\n`Название кнопки - Ссылка кнопки`\n\n*Пример:*\n`Google - https://google.com`\n`Поддержка - https://t.me/support`",
		"owner_only_error":                "Несанкционированный доступ: это действие разрешено только владельцу бота.",
		"click_registered":                "Клик зарегистрирован!",
		"draft_expired":                   "Черновик поста истек или не найден!",
		"failed_publish":                  "Не удалось опубликовать: {err}",
		"success_publish":                 "Пост успешно опубликован!",
		"send_text_prompt":                "Пожалуйста, отправьте новый текст",
		"send_btn_prompt":                 "Пожалуйста, отправьте конфигурацию кнопок",
		"edit_cancelled":                  "Редактирование отменено.",
		"post_rejected":                   "Пост отклонен и удален.",
	},
	"tooltip_portfolio":   "Полный обзор ваших активов и показателей эффективности.",
	"tooltip_buyer_radar": "Определение потенциальных покупателей на основе их интересов и активности кошельков.",
	"tooltip_synergy":     "Анализ совместной работы различных активов для максимизации стоимости.",
	"tooltip_roi":         "Расчет окупаемости инвестиций (ROI) по всей вашей коллекции.",
	"tooltip_empire":      "Отслеживание вашего общего состояния, влияния и присутствия на рынке.",
}

var zhDict = map[string]interface{}{
	"onboarding": map[string]interface{}{
		"thanks":                "🎉 <b>感谢您的信任！</b>\n\n从这一刻起，<b>{arg0}</b> 的数字守护者将为您服务。我将自豪地保护您的社区免受垃圾信息、广告和混乱的侵害。\n\n🌟 <i>由 AI 提供支持，❤️ 由 @iFragmentBot 打造</i>",
		"admin_req":             "⚠️ <b>距离完全激活仅剩一步！</b>\n\n为了让我能够删除恶意消息并限制违规者，请将我提升为<b>管理员</b>，并授予以下权限：\n\n✅ 删除消息\n✅ 限制成员\n✅ 封禁用户\n✅ 置顶消息",
		"features":              "🛡 <b>隐私与安全设置</b>\n\n✅ <b>这些功能现已激活：</b>\n\n🚫 自动删除链接和域名\n🤖 封锁骚扰机器人\n🔥 智能防洪（10秒内5条消息）\n\n🎛 如需自定义，请打开您的仪表板：\n👉 <a href=\"{arg0}\">打开仪表板</a>",
		"welcome_owner":         "🔥 <b>iFragment 管理员门户</b>\n\n欢迎回来，指挥官 {arg0}。管理您的系统设置、查看实时日志并监控实时状态。\n\n👇 <b>启动控制面板：</b>",
		"welcome_public":        "💎 <b>欢迎使用 @iFragmentBot</b>\n\n实时监控您 Telegram 收藏品的真实价值；<b>搜索、估值和分析</b>用户名、匿名号码及礼物。\n\n使用我们的智能系统彻底改变您的<b>群组安全</b>和<b>专业频道管理</b>。\n\n👇 <b>立即打开 iFragment 小程序：</b>",
		"welcome_hosted_public": "你好！🛡\n我是一个高级群组管理机器人，旨在帮助您的群组保持安全、有序和专业。\n\n✨ <b>本机器人由 @iFragmentBot 自豪地托管和提供支持！</b>\n\n如果您是群组管理员，并希望拥有一个完全定制化的强大机器人（包括<b>自定义名称、头像和简介</b>），请立即访问我们的主机器人，在几秒钟内创建您的品牌机器人：\n\n👉 <b>@iFragmentBot</b>\n👉 <b>@iFragmentBot</b>",
		"open_app":              "🚀 打开 iFragment 💎",
	},
	"moderation": map[string]interface{}{
		"no_ban_perm":    "❌ <b>权限被拒绝</b>\n我没有封禁用户的权限。请授予我“封禁用户”权限。",
		"user_banned":    "🚫 <b>用户已封禁</b>\n\n目标：<a href=\"tg://user?id={id}\">{name}</a>",
		"no_unban_perm":  "❌ <b>权限被拒绝</b>\n我没有解封用户的权限。",
		"user_unbanned":  "✅ <b>用户已解封</b>\n\n目标：<a href=\"tg://user?id={id}\">{name}</a>",
		"no_mute_perm":   "❌ <b>权限被拒绝</b>\n我没有禁言用户的权限。请授予我“限制成员”权限。",
		"user_muted":     "🔇 <b>用户已被禁言（24小时）</b>\n\n目标：<a href=\"tg://user?id={id}\">{name}</a>",
		"no_unmute_perm": "❌ <b>权限被拒绝</b>\n我没有解除禁言的权限。",
		"user_unmuted":   "🔊 <b>用户已解除禁言</b>\n\n目标：<a href=\"tg://user?id={id}\">{name}</a>",
		"no_rules":       "⚠️ <b>未设置规则</b>\n此群组尚未配置规则。您可以在仪表板中进行设置。",
		"rules_title":    "📜 <b>群组规则</b>\n\n{rules}",
	},
	"penalty": map[string]interface{}{
		"mute": "🔇 <b>用户已被禁言 {duration}</b>\n\n原因: {reason}",
		"kick": "👢 <b>用户已被移出群组</b>\n\n原因: {reason}",
		"ban":  "🚫 <b>用户已被封禁</b>\n\n原因: {reason}",
		"warn": "⚠️ <b>警告 {count}/{threshold}</b>\n\n原因: {reason}",
	},
	"verification": map[string]interface{}{
		"pv_prompt": "🛡 要加入 <b>{group}</b>，请点击下方按钮完成验证：",
	},
	"payments": map[string]interface{}{
		"success":                "✅ <b>支付成功！</b>\n\n已将 <b>{amount}</b> 金币（FRG）充值到您的账户。",
		"report_unlocked":        "💎 <b>已收到付款</b>\n\n您的 <b>@{username}</b> 报告已解锁：\n<a href=\"{url}\">查看报告</a>",
		"number_report_unlocked": "💎 <b>已收到付款</b>\n\n您的 <b>{number}</b> 号码估值报告已解锁：\n<a href=\"{url}\">查看报告</a>",
	},
	"funnel": map[string]interface{}{
		"failed":         "❌ <b>发布失败：</b> {err}",
		"switched_style": "🤖 <b>已将样式切换至版本 {index}</b>\n\n标题预览：\n{text}",
		"regenerated":    "🔄 <b>AI 变体已重新生成</b>\n\n标题预览：\n{text}",
		"send_new":       "✍️ <b>请在下方发送新文本。</b>\n<i>它将覆盖当前的标题草稿。</i>",
		"select_delay":   "📅 <b>请选择发布此帖子的延迟时间：</b>",
		"updated":        "✍️ <b>标题已更新！</b>\n\n新标题预览：\n{text}",
		"published":      "🚀 <b>帖子已成功发布到频道！</b>\n\n🔑 <b>唯一帖子 ID：</b> <code>{id}</code>\n<i>将来请使用此密钥编辑或更新实时帖子标题。</i>",
	},
	"notice": map[string]interface{}{
		"payment_success": "✅ *支付成功!*\n\n您的订阅已更新。感谢您支持 iFragment!",
		"bot_removed":     "❌ *机器人被移除*\n\n我已从群组“{arg0}”中移除。如果这是一个错误，请将我加回来。",
		"not_admin":       "⚠️ *缺少管理员权限*\n\n我不再是该群组 of 管理员。请恢复我的权限以继续保护。",
		"admin_revoked":   "⚠️ *权限被撤销*\n\n我在“{arg0}”中的管理员权限已被撤销。我无法再保护该群组。",
		"spam_attack":     "🚨 *检测到垃圾邮件攻击*\n\n检测到大规模垃圾邮件浪潮！我已自动切换到高安全模式，持续 5 分钟。",
	},
	"notifications": map[string]interface{}{
		"expiry_3d":           "⚠️ <b>订阅即将到期</b>\n\n您的 <b>{group}</b> 订阅将在 <b>3 天</b> 后到期。\n\n请续订以避免保护服务中断。",
		"expiry_24h":          "🚨 <b>严重警告</b>\n\n距离 <b>{group}</b> 服务暂停仅剩 <b>24 小时</b>！\n\n请立即续订以确保群组安全。",
		"service_ended":       "🔒 <b>服务已暂停</b>\n\n<b>{group}</b> 的订阅已结束。所有保护服务均已禁用，直到您续订为止。",
		"mass_spam":           "🚨 <b>检测到垃圾邮件攻击</b>\n\n<b>{group}</b> 目前正受到大规模垃圾邮件攻击。系统已成功拦截威胁。",
		"bot_removed":         "😢 <b>机器人已被移除</b>\n\n我已从 <b>{group}</b> 中被移除。如果这是一个错误，请将我加回来。",
		"bot_removed_channel": "❌ <b>机器人已从频道移除</b>\n\n我已从您的频道 <b>{channel}</b> 中移除。我的服务已停止。",
		"admin_revoked":       "⚠️ <b>权限被撤销</b>\n\n我在 <b>{group}</b> 的管理员权限已被撤销。",
		"admin_revoked_group": "⚠️ <b>权限不足</b>\n\n我不再拥有管理员权限。请授予管理员权限，以便我能保护群组。",
		"payment_success":     "✅ <b>支付成功！</b>\n\n感谢您的信任。您的订阅已延长至 <b>{date}</b>。",
		"milestone":           "🎉 <b>达成里程碑！</b>\n\n恭喜，群组消息数已达到 <b>{n}</b> 条！",
		"channel_auto_left":   "🚪 <b>系统自动退出</b>\n\n由于 <b>{channel}</b> 的订阅已 7 天未续费，我已自动退出频道。",
		"group_auto_left":     "🚪 <b>系统自动退出</b>\n\n由于 <b>{group}</b> 的订阅已 7 天未续费，我已自动退出群组。",
	},
	"generalSettings": map[string]interface{}{
		"welcomeMessage": "欢迎消息",
		"warningMessage": "警告消息",
	},
	"customTextsSettings": map[string]interface{}{
		"welcomePlaceholder": "欢迎 {user} 加入 {group}!",
	},
	"channel": map[string]interface{}{
		"start_bot_error":                 "请先在私聊中启动机器人（无法向您发送私信）: {err}",
		"approve_btn":                     "✅ 批准并发送",
		"reject_btn":                      "❌ 拒绝",
		"edit_text_btn":                   "✏️ 编辑文本",
		"edit_btn_btn":                    "🔗 编辑按钮",
		"cancel_btn":                      "↩️ 取消并返回",
		"draft_status_pending":            "📢 <b>关于频道「{channel}」的新帖子草稿</b>\n\n{text}\n\n---\n⏳ <b>状态：</b> 等待批准",
		"draft_autoforward_pending":       "📢 <b>通过自动转发（AutoForward）生成的频道「{channel}」新帖子草稿</b>\n\n{text}\n\n---\n⏳ <b>状态：</b> 等待批准",
		"draft_status_edited_pending":     "📢 <b>新修改的帖子草稿</b>\n\n{text}\n\n---\n⏳ <b>状态：</b> 等待批准",
		"draft_status_edited_btn_pending": "📢 <b>新修改的帖子草稿（附带新按钮）</b>\n\n{text}\n\n---\n⏳ <b>状态：</b> 等待批准",
		"draft_status_approved":           "📢 <b>关于频道「{channel}」的新帖子草稿</b>\n\n{text}\n\n---\n✅ <b>状态：</b> 已成功发布到频道！",
		"draft_status_rejected":           "📢 <b>关于频道「{channel}」的新帖子草稿</b>\n\n{text}\n\n---\n❌ <b>状态：</b> 此帖子已被您拒绝并删除。",
		"edit_text_instruction":           "📝 <b>请发送或写入帖子的新文本（如果需要，您可以回复原始草稿消息）：</b>",
		"edit_btn_instruction":            "🔗 <b>请按以下格式发送新的内联按钮（每行一个按钮）：</b>\n\n`按钮标题 - 按钮链接`\n\n*示例：*\n`谷歌 - https://google.com`\n`支持 - https://t.me/support`",
		"owner_only_error":                "未授权：此操作仅限机器人所有者使用。",
		"click_registered":                "点击已注册！",
		"draft_expired":                   "帖子草稿已过期或未找到！",
		"failed_publish":                  "发布失败: {err}",
		"success_publish":                 "帖子已成功发布！",
		"send_text_prompt":                "请发送新文本",
		"send_btn_prompt":                 "请发送按钮配置",
		"edit_cancelled":                  "编辑已取消。",
		"post_rejected":                   "帖子已被拒绝并删除。",
	},
}

var arDict = map[string]interface{}{
	"tooltip_portfolio":   "نظرة عامة كاملة على أصولك ومقاييس الأداء.",
	"tooltip_buyer_radar": "تحديد المشترين المحتملين بناءً على اهتماماتهم ونشاط محافظهم.",
	"tooltip_synergy":     "تحليل كيفية أداء الأصول المختلفة معًا لزيادة القيمة إلى أقصى حد.",
	"tooltip_roi":         "حساب العائد على الاستثمار (ROI) عبر مجموعتك بأكملها.",
	"tooltip_empire":      "تتبع إجمالي ثروتك وتأثيرك ووجودك العام في السوق.",
}
