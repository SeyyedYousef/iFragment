# -*- coding: utf-8 -*-
import sys

with open("backend/internal/i18n/i18n.go", "r", encoding="utf-8") as f:
    content = f.read()

# Verify initial compile
print("Original length:", len(content))

# Data to inject per language
extra_verification = {
    "en": '\t\t"btn_verify":          "✅ Verify & Join",\n',
    "fa": '\t\t"btn_verify":          "✅ تأیید و ورود",\n',
    "ru": '\t\t"btn_verify":          "✅ Подтвердить и войти",\n',
    "zh": '\t\t"btn_verify":          "✅ 验证并加入",\n',
    "ar": '\t\t"btn_verify":          "✅ تأكيد ودخول",\n',
}

extra_funnel = {
    "en": '''\t\t"btn_approve_send":        "🚀 Approve & Send to Target Channel",
\t\t"btn_reject":              "❌ Reject & Cancel",
\t\t"btn_regenerate":          "🤖 Regenerate Caption",
\t\t"btn_style_variation":     "🔄 AI Style Variation ({current}/{total})",
\t\t"preview_header":          "🎛️ <b>Processed Post Preview (iFragment Funnel)</b>\\n📤 Target Channel: <b>{target}</b>\\n━━━━━━━━━━━━━━━━\\n{content}",
\t\t"album_media_count":       "\\n\\n<i>📷 [Album contains {count} media items]</i>",
\t\t"unauthorized_action":     "⚠️ Only channel administrators or the project owner can perform this action.",
\t\t"publishing_progress":     "🚀 Publishing to target channel...",
\t\t"publishing_status":       "⏳ <b>Publishing post to target channel...</b>",
\t\t"published_success":       "✅ <b>This post has been approved and successfully published to the target channel.</b>\\n\\n🎯 Target: <b>{target}</b>",
\t\t"published_failed":        "❌ <b>Error publishing post:</b> {error}",
\t\t"rejected_confirm":        "❌ Draft rejected and cancelled.",
\t\t"rejected_status":         "❌ <b>This draft was rejected by an administrator and will not be published.</b>",
\t\t"variation_not_available": "AI variation is not available for this post.",
\t\t"variation_activated":     "Style variant #{number} activated",
\t\t"cooldown_wait":           "Please wait 20 seconds before regenerating again.",
\t\t"regenerating_progress":   "🤖 Regenerating caption with AI...",
\t\t"ai_error":                "Error communicating with the AI model.",
\t\t"default_output_channel":  "Target Channel",
''',
    "fa": '''\t\t"btn_approve_send":        "🚀 تایید و ارسال به کانال خروجی",
\t\t"btn_reject":              "❌ رد و لغو",
\t\t"btn_regenerate":          "🤖 بازتولید متن",
\t\t"btn_style_variation":     "🔄 تغییر استایل هوش مصنوعی ({current}/{total})",
\t\t"preview_header":          "🎛️ <b>پیش‌نمایش پست پردازش‌شده (iFragment Funnel)</b>\\n📤 کانال مقصد: <b>{target}</b>\\n━━━━━━━━━━━━━━━━\\n{content}",
\t\t"album_media_count":       "\\n\\n<i>📷 [آلبوم شامل {count} رسانه است]</i>",
\t\t"unauthorized_action":     "⚠️ فقط مدیران کانال ورودی/خروجی یا مالک پروژه مجاز به اقدام هستند.",
\t\t"publishing_progress":     "🚀 در حال انتشار در کانال خروجی...",
\t\t"publishing_status":       "⏳ <b>در حال انتشار پست در کانال مقصد...</b>",
\t\t"published_success":       "✅ <b>این پست تایید شد و با موفقیت در کانال خروجی منتشر گردید.</b>\\n\\n🎯 کانال مقصد: <b>{target}</b>",
\t\t"published_failed":        "❌ <b>خطا در انتشار پست:</b> {error}",
\t\t"rejected_confirm":        "❌ پیش‌نویس رد و لغو شد.",
\t\t"rejected_status":         "❌ <b>این پیش‌نویس توسط مدیر رد شد و ارسال نخواهد شد.</b>",
\t\t"variation_not_available": "تنوع هوش مصنوعی برای این پست موجود نیست.",
\t\t"variation_activated":     "استایل شماره {number} فعال شد",
\t\t"cooldown_wait":           "لطفاً 20 ثانیه قبل از بازتولید مجدد صبر کنید.",
\t\t"regenerating_progress":   "🤖 در حال بازتولید متن با هوش مصنوعی...",
\t\t"ai_error":                "خطا در برقراری ارتباط با مدل هوش مصنوعی",
\t\t"default_output_channel":  "کانال مقصد",
''',
    "ru": '''\t\t"btn_approve_send":        "🚀 Одобрить и отправить в канал",
\t\t"btn_reject":              "❌ Отклонить и отменить",
\t\t"btn_regenerate":          "🤖 Перегенерировать текст",
\t\t"btn_style_variation":     "🔄 Вариант стиля ИИ ({current}/{total})",
\t\t"preview_header":          "🎛️ <b>Предпросмотр поста (iFragment Funnel)</b>\\n📤 Канал назначения: <b>{target}</b>\\n━━━━━━━━━━━━━━━━\\n{content}",
\t\t"album_media_count":       "\\n\\n<i>📷 [Альбом содержит {count} медиа]</i>",
\t\t"unauthorized_action":     "⚠️ Только администраторы каналов или владелец проекта могут выполнить это действие.",
\t\t"publishing_progress":     "🚀 Публикация в целевой канал...",
\t\t"publishing_status":       "⏳ <b>Публикация поста в канал назначения...</b>",
\t\t"published_success":       "✅ <b>Пост одобрен и успешно опубликован в целевой канал.</b>\\n\\n🎯 Канал: <b>{target}</b>",
\t\t"published_failed":        "❌ <b>Ошибка публикации поста:</b> {error}",
\t\t"rejected_confirm":        "❌ Черновик отклонён и отменён.",
\t\t"rejected_status":         "❌ <b>Этот черновик отклонён администратором и не будет опубликован.</b>",
\t\t"variation_not_available": "Варианты ИИ недоступны для этого поста.",
\t\t"variation_activated":     "Активирован вариант #{number}",
\t\t"cooldown_wait":           "Пожалуйста, подождите 20 секунд перед повторной генерацией.",
\t\t"regenerating_progress":   "🤖 Перегенерация текста с помощью ИИ...",
\t\t"ai_error":                "Ошибка связи с моделью ИИ.",
\t\t"default_output_channel":  "Канал назначения",
''',
    "zh": '''\t\t"btn_approve_send":        "🚀 批准并发布到目标频道",
\t\t"btn_reject":              "❌ 拒绝并取消",
\t\t"btn_regenerate":          "🤖 重新生成文案",
\t\t"btn_style_variation":     "🔄 切换 AI 风格版本 ({current}/{total})",
\t\t"preview_header":          "🎛️ <b>帖子处理预览 (iFragment Funnel)</b>\\n📤 目标频道：<b>{target}</b>\\n━━━━━━━━━━━━━━━━\\n{content}",
\t\t"album_media_count":       "\\n\\n<i>📷 [相册包含 {count} 个媒体项]</i>",
\t\t"unauthorized_action":     "⚠️ 仅源/目标频道管理员或项目所有者可执行此操作。",
\t\t"publishing_progress":     "🚀 正在发布到目标频道...",
\t\t"publishing_status":       "⏳ <b>正在将帖子发布至目标频道...</b>",
\t\t"published_success":       "✅ <b>此帖子已获批准并成功发布至目标频道。</b>\\n\\n🎯 目标：<b>{target}</b>",
\t\t"published_failed":        "❌ <b>发布帖子失败：</b> {error}",
\t\t"rejected_confirm":        "❌ 草稿已拒绝并取消。",
\t\t"rejected_status":         "❌ <b>此草稿已被管理员拒绝，不会被发布。</b>",
\t\t"variation_not_available": "此帖子无可用 AI 变体。",
\t\t"variation_activated":     "已启用第 {number} 种风格",
\t\t"cooldown_wait":           "请等待 20 秒后再重新生成。",
\t\t"regenerating_progress":   "🤖 正在使用 AI 重新生成文案...",
\t\t"ai_error":                "与 AI 模型通信出错。",
\t\t"default_output_channel":  "目标频道",
''',
    "ar": '''\t\t"btn_approve_send":        "🚀 موافقة وإرسال إلى القناة",
\t\t"btn_reject":              "❌ رفض وإلغاء",
\t\t"btn_regenerate":          "🤖 إعادة إنشاء النص",
\t\t"btn_style_variation":     "🔄 تغيير نمط الذكاء الاصطناعي ({current}/{total})",
\t\t"preview_header":          "🎛️ <b>معاينة المنشور (iFragment Funnel)</b>\\n📤 القناة المستهدفة: <b>{target}</b>\\n━━━━━━━━━━━━━━━━\\n{content}",
\t\t"album_media_count":       "\\n\\n<i>📷 [الألبوم يحتوي على {count} وسائط]</i>",
\t\t"unauthorized_action":     "⚠️ فقط مسؤولو القناة أو مالك المشروع مصرح لهم بهذا الإجراء.",
\t\t"publishing_progress":     "🚀 جارٍ النشر في القناة المستهدفة...",
\t\t"publishing_status":       "⏳ <b>جارٍ نشر المنشور في القناة...</b>",
\t\t"published_success":       "✅ <b>تمت الموافقة على هذا المنشور ونشره بنجاح في القناة المستهدفة.</b>\\n\\n🎯 الوجهة: <b>{target}</b>",
\t\t"published_failed":        "❌ <b>خطأ في نشر المنشور:</b> {error}",
\t\t"rejected_confirm":        "❌ تم رفض المسودة وإلغاؤها.",
\t\t"rejected_status":         "❌ <b>تم رفض هذه المسودة من قبل المسؤول ولن يتم نشرها.</b>",
\t\t"variation_not_available": "تنويع الذكاء الاصطناعي غير متوفر لهذا المنشور.",
\t\t"variation_activated":     "تم تفعيل النمط رقم {number}",
\t\t"cooldown_wait":           "يرجى الانتظار 20 ثانية قبل إعادة الإنشاء.",
\t\t"regenerating_progress":   "🤖 جارٍ إعادة إنشاء النص بالذكاء الاصطناعي...",
\t\t"ai_error":                "خطأ في الاتصال بنموذج الذكاء الاصطناعي.",
\t\t"default_output_channel":  "القناة المستهدفة",
''',
}

extra_channel = {
    "en": '''\t\t"already_voted":                      "You have already voted!",
\t\t"click_failed":                       "Failed to register click",
\t\t"join_request_rejected_premium":      "⚠️ Your request to join {channel} was not approved because your account does not have Telegram Premium status.",
\t\t"join_request_rejected_photo":        "⚠️ Your request to join {channel} was not approved because you do not have a profile photo.",
\t\t"join_request_rejected_account_age":  "⚠️ Your request to join {channel} was not approved because your Telegram account is too new.",
\t\t"join_request_rejected_collectibles": "⚠️ Your request to join {channel} was not approved because your account does not have a collectible username.",
\t\t"join_request_rejected_gifts":        "⚠️ Your request to join {channel} was not approved due to Telegram gift & asset requirements.",
''',
    "fa": '''\t\t"already_voted":                      "شما قبلاً رأی داده‌اید!",
\t\t"click_failed":                       "خطا در ثبت رأی",
\t\t"join_request_rejected_premium":      "⚠️ درخواست عضویت شما در {channel} به دلیل عدم داشتن اکانت Premium تلگرام پذیرفته نشد.",
\t\t"join_request_rejected_photo":        "⚠️ درخواست عضویت شما در {channel} پذیرفته نشد زیرا شما تصویر پروفایل ندارید.",
\t\t"join_request_rejected_account_age":  "⚠️ درخواست عضویت شما در {channel} به دلیل عدم احراز حداقل سن اکانت تلگرام پذیرفته نشد.",
\t\t"join_request_rejected_collectibles": "⚠️ درخواست عضویت شما در {channel} پذیرفته نشد زیرا اکانت شما دارای نام کاربری کلکسیونی نیست.",
\t\t"join_request_rejected_gifts":        "⚠️ درخواست عضویت شما در {channel} پذیرفته نشد زیرا شرایط گیفت و دارایی‌های اکانت تأیید نشد.",
''',
    "ru": '''\t\t"already_voted":                      "Вы уже проголосовали!",
\t\t"click_failed":                       "Не удалось учесть голос",
\t\t"join_request_rejected_premium":      "⚠️ Ваша заявка на вступление в {channel} отклонена из-за отсутствия статуса Telegram Premium.",
\t\t"join_request_rejected_photo":        "⚠️ Ваша заявка в {channel} отклонена, так как у вас нет фото профиля.",
\t\t"join_request_rejected_account_age":  "⚠️ Ваша заявка в {channel} отклонена, так как ваш аккаунт Telegram слишком новый.",
\t\t"join_request_rejected_collectibles": "⚠️ Ваша заявка в {channel} отклонена, так как у вас нет коллекционного юзернейма.",
\t\t"join_request_rejected_gifts":        "⚠️ Ваша заявка в {channel} отклонена из-за несоответствия требованиям по подаркам и активам.",
''',
    "zh": '''\t\t"already_voted":                      "您已经投过票了！",
\t\t"click_failed":                       "记录点击失败",
\t\t"join_request_rejected_premium":      "⚠️ 您加入 {channel} 的申请未被批准，因为您的账号没有 Telegram Premium 会员。",
\t\t"join_request_rejected_photo":        "⚠️ 您加入 {channel} 的申请未被批准，因为您的账号未设置头像。",
\t\t"join_request_rejected_account_age":  "⚠️ 您加入 {channel} 的申请未被批准，因为您的 Telegram 账号注册时间过短。",
\t\t"join_request_rejected_collectibles": "⚠️ 您加入 {channel} 的申请未被批准，因为您的账号未持有可收藏用户名。",
\t\t"join_request_rejected_gifts":        "⚠️ 您加入 {channel} 的申请未被批准，因未满足礼物与资产准入要求。",
''',
    "ar": '''\t\t"already_voted":                      "لقد قمت بالتصويت بالفعل!",
\t\t"click_failed":                       "فشل تسجيل النقرة",
\t\t"join_request_rejected_premium":      "⚠️ لم يتم قبول طلب انضمامك إلى {channel} لعدم توفر حساب Telegram Premium.",
\t\t"join_request_rejected_photo":        "⚠️ تم رفض طلب انضمامك إلى {channel} لأنك لا تملك صورة للملف الشخصي.",
\t\t"join_request_rejected_account_age":  "⚠️ تم رفض طلب انضمامك إلى {channel} لأن حسابك على تيليجرام جديد جداً.",
\t\t"join_request_rejected_collectibles": "⚠️ تم رفض طلب انضمامك إلى {channel} لأن حسابك لا يملك اسم مستخدم قابل للجمع.",
\t\t"join_request_rejected_gifts":        "⚠️ تم رفض طلب انضمامك إلى {channel} لعدم استيفاء شروط الهدايا والأصول.",
''',
}

extra_settings = {
    "en": '\t\t"err_save":             "⚠️ Error saving settings",\n\t\t"err_save_val":         "⚠️ Error saving value",\n',
    "fa": '\t\t"err_save":             "⚠️ خطا در ذخیره تنظیمات",\n\t\t"err_save_val":         "⚠️ خطا در ذخیره مقدار",\n',
    "ru": '\t\t"err_save":             "⚠️ Ошибка сохранения настроек",\n\t\t"err_save_val":         "⚠️ Ошибка сохранения значения",\n',
    "zh": '\t\t"err_save":             "⚠️ 保存设置失败",\n\t\t"err_save_val":         "⚠️ 保存数值失败",\n',
    "ar": '\t\t"err_save":             "⚠️ خطأ في حفظ الإعدادات",\n\t\t"err_save_val":         "⚠️ خطأ في حفظ القيمة",\n',
}

extra_root_blocks = {
    "en": '''\t"bot": map[string]interface{}{
\t\t"pong":           "🏓 <b>Pong!</b>\\n⚡ Latency: <code>{latency}ms</code>\\n🛡️ Engine: <b>iFragment v2.0 (Active)</b>",
\t\t"id_info":        "🆔 <b>Chat & User ID Info:</b>\\n\\n• <b>Chat ID:</b> <code>{chat_id}</code>\\n• <b>Chat Title:</b> {chat_title}\\n• <b>Sender ID:</b> <code>{sender_id}</code>",
\t\t"id_target_user": "\\n• <b>Target User:</b> {name} (<code>{id}</code>)",
\t\t"id_reply_id":    "\\n• <b>Replied Message ID:</b> <code>{id}</code>",
\t\t"id_topic_id":    "\\n• <b>Topic/Thread ID:</b> <code>{id}</code>",
\t},
\t"templates": map[string]interface{}{
\t\t"warning":         "⚠️ {user} | Warning {count}/{threshold} ▫️ {reason}",
\t\t"force_join":      "📢 {user}, join required channels to chat:\\n{channel_names}",
\t\t"force_add":       "👥 {user}, invite {remainadd} member(s) to chat ({added}/{number})",
\t\t"silence_start":   "🌙 Quiet mode activated. Regular messages restricted.",
\t\t"silence_end":     "☀️ Quiet mode ended. Chat is now open.",
\t\t"rules_default":   "📜 Group Rules: Mutual respect • No spam or unauthorized links • Keep chat clean",
\t\t"welcome_default": "👋 Welcome {user} to {group}! 🌹",
\t},
\t"receipts": map[string]interface{}{
\t\t"pro_pass_title":        "╔════ 💳 <b>Successful Payment: Pro Pass Subscription</b> ════╗",
\t\t"pro_pass_package":      "👑 <b>Package:</b> iFragment Pro Pass (30 Days)",
\t\t"user_label":            "👤 <b>User:</b> <code>{id}</code>",
\t\t"stars_amount":          "⭐️ <b>Stars Amount:</b> <code>{amount} Stars</code>",
\t\t"payment_id":            "🔖 <b>Payment ID:</b> <code>{id}</code>",
\t\t"activation_time":       "⏰ <b>Activation Time:</b> <code>{time}</code>",
\t\t"btn_user_profile":      "👤 User Profile",
\t\t"btn_miniapp":           "📱 Mini App",
\t\t"username_report_title": "╔════ 💳 <b>Successful Payment: Username Report Unlocked</b> ════╗",
\t\t"username_label":        "🆔 <b>Username:</b> @{username}",
\t\t"btn_view_report":       "🔎 View Report",
\t\t"number_report_title":   "╔════ 💳 <b>Successful Payment: Number Report Unlocked</b> ════╗",
\t\t"number_label":          "📞 <b>Number:</b> <code>{number}</code>",
\t\t"gift_report_title":     "╔════ 💳 <b>Successful Payment: Gift Report Unlocked</b> ════╗",
\t\t"gift_label":            "🎁 <b>Gift ID:</b> <code>{id}</code>",
\t\t"avm_access_title":      "╔════ 💳 <b>Successful Payment: 24h AVM Access</b> ════╗",
\t\t"credit_pack_title":     "╔════ 💳 <b>Successful Payment: Intel Credit Pack</b> ════╗",
\t\t"credits_count":         "🔑 <b>Credits:</b> <code>{count} Intel Credit</code>",
\t\t"credit_pack_named":     "🔑 <b>Package:</b> <code>{name}</code> (<code>{count} Credit</code>)",
\t\t"user_report_unlocked":  "💎 Payment received. Your @{username} report is unlocked:\\n{url}",
\t\t"number_unlocked":       "💎 Payment received. Your {number} report is unlocked:\\n{url}",
\t\t"gift_unlocked":         "💎 Payment received. Your gift report is unlocked:\\n{url}",
\t\t"avm_unlocked":          "💎 Payment received. 24-hour AVM access unlocked for @{username}",
\t\t"credits_credited":      "💎 Payment received. {count} Intel Credit credited to your account.",
\t},
''',
    "fa": '''\t"bot": map[string]interface{}{
\t\t"pong":           "🏓 <b>پونگ!</b>\\n⚡ تاخیر پاسخ: <code>{latency}ms</code>\\n🛡️ وضعیت موتور: <b>iFragment v2.0 (فعال)</b>",
\t\t"id_info":        "🆔 <b>اطلاعات شناسه چت و کاربر:</b>\\n\\n• <b>شناسه چت:</b> <code>{chat_id}</code>\\n• <b>عنوان چت:</b> {chat_title}\\n• <b>شناسه فرستنده:</b> <code>{sender_id}</code>",
\t\t"id_target_user": "\\n• <b>کاربر هدف:</b> {name} (<code>{id}</code>)",
\t\t"id_reply_id":    "\\n• <b>شناسه پیام ریپلای‌شده:</b> <code>{id}</code>",
\t\t"id_topic_id":    "\\n• <b>شناسه تاپیک/موضوع:</b> <code>{id}</code>",
\t},
\t"templates": map[string]interface{}{
\t\t"warning":         "⚠️ {user}\\n▫️ اخطار {count}/{threshold} — {reason}",
\t\t"force_join":      "📢 {user}، برای گفتگو ابتدا در کانال‌های زیر عضو شو:\\n{channel_names}",
\t\t"force_add":       "👥 {user}، برای فعال شدن چت، {remainadd} نفر دعوت کن ({added}/{number})",
\t\t"silence_start":   "🌙 ساعات سکوت گروه آغاز شد.",
\t\t"silence_end":     "☀️ ساعات سکوت پایان یافت. گفتگو آزاد است.",
\t\t"rules_default":   "📜 قوانین گروه: احترام متقابل • بدون تبلیغات و لینک • رعایت ادب",
\t\t"welcome_default": "👋 {user} عزیز، به گروه {group} خوش آمدی 🌹",
\t},
\t"receipts": map[string]interface{}{
\t\t"pro_pass_title":        "╔════ 💳 <b>پرداخت موفق: اشتراک ویژه (Pro Pass)</b> ════╗",
\t\t"pro_pass_package":      "👑 <b>پکیج:</b> iFragment Pro Pass (30 روزه)",
\t\t"user_label":            "👤 <b>کاربر:</b> <code>{id}</code>",
\t\t"stars_amount":          "⭐️ <b>مبلغ استارز:</b> <code>{amount} Stars</code>",
\t\t"payment_id":            "🔖 <b>شناسه پرداخت تلگرام:</b> <code>{id}</code>",
\t\t"activation_time":       "⏰ <b>زمان فعال‌سازی:</b> <code>{time}</code>",
\t\t"btn_user_profile":      "👤 پروفایل کاربر",
\t\t"btn_miniapp":           "📱 مینی‌اپ",
\t\t"username_report_title": "╔════ 💳 <b>پرداخت موفق: آنلاک گزارش یوزرنیم</b> ════╗",
\t\t"username_label":        "🆔 <b>یوزرنیم:</b> @{username}",
\t\t"btn_view_report":       "🔎 مشاهده گزارش",
\t\t"number_report_title":   "╔════ 💳 <b>پرداخت موفق: آنلاک گزارش شماره کلکسیونی</b> ════╗",
\t\t"number_label":          "📞 <b>شماره:</b> <code>{number}</code>",
\t\t"gift_report_title":     "╔════ 💳 <b>پرداخت موفق: آنلاک گزارش گیفت تلگرام</b> ════╗",
\t\t"gift_label":            "🎁 <b>شناسه گیفت:</b> <code>{id}</code>",
\t\t"avm_access_title":      "╔════ 💳 <b>پرداخت موفق: دسترسی 24 ساعته AVM</b> ════╗",
\t\t"credit_pack_title":     "╔════ 💳 <b>پرداخت موفق: خرید بسته کردیت تحلیلی</b> ════╗",
\t\t"credits_count":         "🔑 <b>تعداد اعتبار:</b> <code>{count} Intel Credit</code>",
\t\t"credit_pack_named":     "🔑 <b>بسته:</b> <code>{name}</code> (<code>{count} Credit</code>)",
\t\t"user_report_unlocked":  "💎 پرداخت دریافت شد. گزارش یوزرنیم @{username} آنلاک شد:\\n{url}",
\t\t"number_unlocked":       "💎 پرداخت دریافت شد. گزارش شماره {number} آنلاک شد:\\n{url}",
\t\t"gift_unlocked":         "💎 پرداخت دریافت شد. گزارش گیفت تلگرام آنلاک شد:\\n{url}",
\t\t"avm_unlocked":          "💎 پرداخت دریافت شد. دسترسی ۲۴ ساعته ارزش‌گذاری هوشمند برای @{username} فعال شد.",
\t\t"credits_credited":      "💎 پرداخت دریافت شد. تعداد {count} کردیت تحلیلی به حساب شما افزوده شد.",
\t},
''',
    "ru": '''\t"bot": map[string]interface{}{
\t\t"pong":           "🏓 <b>Понг!</b>\\n⚡ Задержка: <code>{latency}мс</code>\\n🛡️ Движок: <b>iFragment v2.0 (Активен)</b>",
\t\t"id_info":        "🆔 <b>Информация об ID чата и пользователя:</b>\\n\\n• <b>ID чата:</b> <code>{chat_id}</code>\\n• <b>Название чата:</b> {chat_title}\\n• <b>ID отправителя:</b> <code>{sender_id}</code>",
\t\t"id_target_user": "\\n• <b>Целевой пользователь:</b> {name} (<code>{id}</code>)",
\t\t"id_reply_id":    "\\n• <b>ID сообщения ответа:</b> <code>{id}</code>",
\t\t"id_topic_id":    "\\n• <b>ID темы/топика:</b> <code>{id}</code>",
\t},
\t"templates": map[string]interface{}{
\t\t"warning":         "⚠️ {user} | Предупреждение {count}/{threshold} ▫️ {reason}",
\t\t"force_join":      "📢 {user}, подпишитесь на каналы для общения:\\n{channel_names}",
\t\t"force_add":       "👥 {user}, пригласите {remainadd} участников для общения ({added}/{number})",
\t\t"silence_start":   "🌙 Режим тишины активирован. Сообщения ограничены.",
\t\t"silence_end":     "☀️ Режим тишины окончен. Чат открыт.",
\t\t"rules_default":   "📜 Правила группы: Взаимное уважение • Без спама и ссылок • Соблюдайте порядок",
\t\t"welcome_default": "👋 Добро пожаловать, {user}, в группу {group}! 🌹",
\t},
\t"receipts": map[string]interface{}{
\t\t"pro_pass_title":        "╔════ 💳 <b>Успешная оплата: Pro Pass подписка</b> ════╗",
\t\t"pro_pass_package":      "👑 <b>Пакет:</b> iFragment Pro Pass (30 дней)",
\t\t"user_label":            "👤 <b>Пользователь:</b> <code>{id}</code>",
\t\t"stars_amount":          "⭐️ <b>Сумма Stars:</b> <code>{amount} Stars</code>",
\t\t"payment_id":            "🔖 <b>ID платежа:</b> <code>{id}</code>",
\t\t"activation_time":       "⏰ <b>Время активации:</b> <code>{time}</code>",
\t\t"btn_user_profile":      "👤 Профиль",
\t\t"btn_miniapp":           "📱 Мини-апп",
\t\t"username_report_title": "╔════ 💳 <b>Успешная оплата: Отчёт по юзернейму</b> ════╗",
\t\t"username_label":        "🆔 <b>Юзернейм:</b> @{username}",
\t\t"btn_view_report":       "🔎 Открыть отчёт",
\t\t"number_report_title":   "╔════ 💳 <b>Успешная оплата: Отчёт по номеру</b> ════╗",
\t\t"number_label":          "📞 <b>Номер:</b> <code>{number}</code>",
\t\t"gift_report_title":     "╔════ 💳 <b>Успешная оплата: Отчёт по подарку</b> ════╗",
\t\t"gift_label":            "🎁 <b>ID подарка:</b> <code>{id}</code>",
\t\t"avm_access_title":      "╔════ 💳 <b>Успешная оплата: Доступ к AVM на 24ч</b> ════╗",
\t\t"credit_pack_title":     "╔════ 💳 <b>Успешная оплата: Пакет кредитов Intel</b> ════╗",
\t\t"credits_count":         "🔑 <b>Кредиты:</b> <code>{count} Intel Credit</code>",
\t\t"credit_pack_named":     "🔑 <b>Пакет:</b> <code>{name}</code> (<code>{count} Credit</code>)",
\t\t"user_report_unlocked":  "💎 Оплата получена. Отчёт по @{username} разблокирован:\\n{url}",
\t\t"number_unlocked":       "💎 Оплата получена. Отчёт по номеру {number} разблокирован:\\n{url}",
\t\t"gift_unlocked":         "💎 Оплата получена. Отчёт по подарку разблокирован:\\n{url}",
\t\t"avm_unlocked":          "💎 Оплата получена. Доступ к AVM на 24 часа для @{username} активирован.",
\t\t"credits_credited":      "💎 Оплата получена. Начислено {count} Intel Credit на ваш баланс.",
\t},
''',
    "zh": '''\t"bot": map[string]interface{}{
\t\t"pong":           "🏓 <b>Pong!</b>\\n⚡ 延迟: <code>{latency}ms</code>\\n🛡️ 引擎: <b>iFragment v2.0 (运行中)</b>",
\t\t"id_info":        "🆔 <b>群聊与用户 ID 信息：</b>\\n\\n• <b>群聊 ID:</b> <code>{chat_id}</code>\\n• <b>群聊名称:</b> {chat_title}\\n• <b>发送者 ID:</b> <code>{sender_id}</code>",
\t\t"id_target_user": "\\n• <b>目标用户：</b> {name} (<code>{id}</code>)",
\t\t"id_reply_id":    "\\n• <b>回复消息 ID:</b> <code>{id}</code>",
\t\t"id_topic_id":    "\\n• <b>主题/话题 ID:</b> <code>{id}</code>",
\t},
\t"templates": map[string]interface{}{
\t\t"warning":         "⚠️ {user} | 警告 {count}/{threshold} ▫️ {reason}",
\t\t"force_join":      "📢 {user}，请先加入以下频道后方可在群内发言：\\n{channel_names}",
\t\t"force_add":       "👥 {user}，请再邀请 {remainadd} 位成员以开启发言权限 ({added}/{number})",
\t\t"silence_start":   "🌙 群组静音时段已开启，普通消息已被限制。",
\t\t"silence_end":     "☀️ 群组静音时段已结束，欢迎畅所欲言。",
\t\t"rules_default":   "📜 群组规则：互相尊重 • 禁止垃圾广告与非授权链接 • 文明交流",
\t\t"welcome_default": "👋 欢迎 {user} 加入 {group}！🌹",
\t},
\t"receipts": map[string]interface{}{
\t\t"pro_pass_title":        "╔════ 💳 <b>支付成功：Pro Pass 尊享订阅</b> ════╗",
\t\t"pro_pass_package":      "👑 <b>套餐：</b> iFragment Pro Pass (30天)",
\t\t"user_label":            "👤 <b>用户：</b> <code>{id}</code>",
\t\t"stars_amount":          "⭐️ <b>Stars 数量：</b> <code>{amount} Stars</code>",
\t\t"payment_id":            "🔖 <b>支付凭单 ID：</b> <code>{id}</code>",
\t\t"activation_time":       "⏰ <b>生效时间：</b> <code>{time}</code>",
\t\t"btn_user_profile":      "👤 用户资料",
\t\t"btn_miniapp":           "📱 小程序",
\t\t"username_report_title": "╔════ 💳 <b>支付成功：解锁用户名估值分析报告</b> ════╗",
\t\t"username_label":        "🆔 <b>用户名：</b> @{username}",
\t\t"btn_view_report":       "🔎 查看报告",
\t\t"number_report_title":   "╔════ 💳 <b>支付成功：解锁匿名号码估值报告</b> ════╗",
\t\t"number_label":          "📞 <b>号码：</b> <code>{number}</code>",
\t\t"gift_report_title":     "╔════ 💳 <b>支付成功：解锁 Telegram 礼物报告</b> ════╗",
\t\t"gift_label":            "🎁 <b>礼物 ID：</b> <code>{id}</code>",
\t\t"avm_access_title":      "╔════ 💳 <b>支付成功：24小时 AVM 深度估值权限</b> ════╗",
\t\t"credit_pack_title":     "╔════ 💳 <b>支付成功：购买情报分析点数包</b> ════╗",
\t\t"credits_count":         "🔑 <b>点数：</b> <code>{count} Intel Credit</code>",
\t\t"credit_pack_named":     "🔑 <b>套餐：</b> <code>{name}</code> (<code>{count} Credit</code>)",
\t\t"user_report_unlocked":  "💎 支付已确认。您的 @{username} 深度估值报告已解锁：\\n{url}",
\t\t"number_unlocked":       "💎 支付已确认。您的 {number} 深度分析报告已解锁：\\n{url}",
\t\t"gift_unlocked":         "💎 支付已确认。您的礼物专属估值报告已解锁：\\n{url}",
\t\t"avm_unlocked":          "💎 支付已确认。已为 @{username} 开通 24 小时 AVM 深度估值权限。",
\t\t"credits_credited":      "💎 支付已确认。已成功充值 {count} 点 Intel Credit 到您的账户。",
\t},
''',
    "ar": '''\t"bot": map[string]interface{}{
\t\t"pong":           "🏓 <b>بونغ!</b>\\n⚡ زمن الاستجابة: <code>{latency}ms</code>\\n🛡️ المحرك: <b>iFragment v2.0 (نشط)</b>",
\t\t"id_info":        "🆔 <b>معلومات معرف الدردشة والمستخدم:</b>\\n\\n• <b>معرف الدردشة:</b> <code>{chat_id}</code>\\n• <b>عنوان الدردشة:</b> {chat_title}\\n• <b>معرف المرسل:</b> <code>{sender_id}</code>",
\t\t"id_target_user": "\\n• <b>المستخدم المستهدف:</b> {name} (<code>{id}</code>)",
\t\t"id_reply_id":    "\\n• <b>معرف الرسالة الرد عليها:</b> <code>{id}</code>",
\t\t"id_topic_id":    "\\n• <b>معرف الموضوع/الفرع:</b> <code>{id}</code>",
\t},
\t"templates": map[string]interface{}{
\t\t"warning":         "⚠️ {user} | تحذير {count}/{threshold} ▫️ {reason}",
\t\t"force_join":      "📢 {user}، يرجى الانضمام إلى القنوات التالية للمحادثة:\\n{channel_names}",
\t\t"force_add":       "👥 {user}، ادعُ {remainadd} عضو للدردشة ({added}/{number})",
\t\t"silence_start":   "🌙 بدأت ساعات الهدوء في المجموعة.",
\t\t"silence_end":     "☀️ انتهت ساعات الهدوء. الدردشة مفتوحة الآن.",
\t\t"rules_default":   "📜 قواعد المجموعة: الاحترام المتبادل • ممنوع الإعلانات والروابط • الحفاظ على الأدب",
\t\t"welcome_default": "👋 مرحبًا {user} في مجموعة {group}! 🌹",
\t},
\t"receipts": map[string]interface{}{
\t\t"pro_pass_title":        "╔════ 💳 <b>دفع ناجح: اشتراك Pro Pass</b> ════╗",
\t\t"pro_pass_package":      "👑 <b>الباقة:</b> iFragment Pro Pass (30 يومًا)",
\t\t"user_label":            "👤 <b>المستخدم:</b> <code>{id}</code>",
\t\t"stars_amount":          "⭐️ <b>مبلغ Stars:</b> <code>{amount} Stars</code>",
\t\t"payment_id":            "🔖 <b>معرف الدفع:</b> <code>{id}</code>",
\t\t"activation_time":       "⏰ <b>وقت التفعيل:</b> <code>{time}</code>",
\t\t"btn_user_profile":      "👤 الملف الشخصي",
\t\t"btn_miniapp":           "📱 التطبيق المصغر",
\t\t"username_report_title": "╔════ 💳 <b>دفع ناجح: فتح تقرير اسم المستخدم</b> ════╗",
\t\t"username_label":        "🆔 <b>اسم المستخدم:</b> @{username}",
\t\t"btn_view_report":       "🔎 عرض التقرير",
\t\t"number_report_title":   "╔════ 💳 <b>دفع ناجح: فتح تقرير الرقم</b> ════╗",
\t\t"number_label":          "📞 <b>الرقم:</b> <code>{number}</code>",
\t\t"gift_report_title":     "╔════ 💳 <b>دفع ناجح: فتح تقرير الهدية</b> ════╗",
\t\t"gift_label":            "🎁 <b>معرف الهدية:</b> <code>{id}</code>",
\t\t"avm_access_title":      "╔════ 💳 <b>دفع ناجح: وصول AVM لمدة 24 ساعة</b> ════╗",
\t\t"credit_pack_title":     "╔════ 💳 <b>دفع ناجح: باقة رصيد التحليل</b> ════╗",
\t\t"credits_count":         "🔑 <b>الرصيد:</b> <code>{count} Intel Credit</code>",
\t\t"credit_pack_named":     "🔑 <b>الباقة:</b> <code>{name}</code> (<code>{count} Credit</code>)",
\t\t"user_report_unlocked":  "💎 تم استلام الدفع. تم فتح تقرير @{username}:\\n{url}",
\t\t"number_unlocked":       "💎 تم استلام الدفع. تم فتح تقرير الرقم {number}:\\n{url}",
\t\t"gift_unlocked":         "💎 تم استلام الدفع. تم فتح تقرير الهدية:\\n{url}",
\t\t"avm_unlocked":          "💎 تم استلام الدفع. تم تفعيل وصول تقييم AVM لمدة 24 ساعة لـ @{username}.",
\t\t"credits_credited":      "💎 تم استلام الدفع. تمت إضافة {count} رصيد Intel إلى حسابك.",
\t},
''',
}

# Apply to each dictionary in content
dicts = ["en", "fa", "ru", "zh", "ar"]

for d in dicts:
    dict_decl = f"var {d}Dict = map[string]interface{{"
    pos = content.find(dict_decl)
    if pos == -1:
        print(f"Error: {dict_decl} not found!")
        sys.exit(1)
    
    # Find the end of this dictionary
    next_dict_decl = None
    next_idx = dicts.index(d) + 1
    if next_idx < len(dicts):
        next_dict_decl = f"var {dicts[next_idx]}Dict = map[string]interface{{"
        end_pos = content.find(next_dict_decl, pos)
    else:
        end_pos = len(content)

    dict_slice = content[pos:end_pos]

    # 1. Insert into verification
    v_marker = '\t"verification": map[string]interface{}{\n'
    v_pos = dict_slice.find(v_marker)
    if v_pos != -1:
        insert_at = v_pos + len(v_marker)
        dict_slice = dict_slice[:insert_at] + extra_verification[d] + dict_slice[insert_at:]
    else:
        print(f"Warning: verification not found in {d}")

    # 2. Insert into funnel
    f_marker = '\t"funnel": map[string]interface{}{\n'
    f_pos = dict_slice.find(f_marker)
    if f_pos != -1:
        insert_at = f_pos + len(f_marker)
        dict_slice = dict_slice[:insert_at] + extra_funnel[d] + dict_slice[insert_at:]
    else:
        print(f"Warning: funnel not found in {d}")

    # 3. Insert into channel
    c_marker = '\t"channel": map[string]interface{}{\n'
    c_pos = dict_slice.find(c_marker)
    if c_pos != -1:
        insert_at = c_pos + len(c_marker)
        dict_slice = dict_slice[:insert_at] + extra_channel[d] + dict_slice[insert_at:]
    else:
        print(f"Warning: channel not found in {d}")

    # 4. Insert into settings
    s_marker = '\t"settings": map[string]interface{}{\n'
    s_pos = dict_slice.find(s_marker)
    if s_pos != -1:
        insert_at = s_pos + len(s_marker)
        dict_slice = dict_slice[:insert_at] + extra_settings[d] + dict_slice[insert_at:]
    else:
        print(f"Warning: settings not found in {d}")

    # 5. Insert root blocks right before the closing brace of the dict
    # Closing brace is '\n}\n'
    last_brace = dict_slice.rfind('\n}')
    if last_brace != -1:
        dict_slice = dict_slice[:last_brace+1] + extra_root_blocks[d] + dict_slice[last_brace+1:]
    else:
        print(f"Warning: closing brace not found in {d}")

    content = content[:pos] + dict_slice + content[end_pos:]

with open("backend/internal/i18n/i18n.go", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated i18n.go successfully. New length:", len(content))
