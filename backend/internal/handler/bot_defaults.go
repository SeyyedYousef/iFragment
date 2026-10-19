package handler

// defaultTexts stores the centralized fallback texts for bot messages across all 4 supported languages.
var defaultTexts = map[string]map[string]string{
	"start_menu": {
		"fa": `╔═══ <tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>iFragment Terminal v2.0</b> ═══╗

سلام <b>{name}</b> عزیز؛ به ترمینال هوش بازار و کارشناسی آن‌چین دارایی‌های تلگرام خوش آمدید.
👤 وضعیت: <b>سطح کارشناسی</b> | 🏆 رتبه جهانی: <b>#{rank}</b> | ⚡ اعتبار: <b>{credits} کریدت</b>

📊 <b>موتورهای ارزش‌گذاری زنده (۱۰۰٪ متصل به بلاکچین TON):</b>
├ 🏷️ <b>یوزرنیم‌ها (@username):</b> مدل هدانیک AVM، کمیابی و ریسک برند
├ 📱 <b>شماره‌های ناشناس (+888):</b> تشخیص الگو، کلوپ کلکسیونی و اردربوک
└ 🎁 <b>گیفت‌های تلگرام (Web3 NFT):</b> ژنتیک ۴ رنگ، سریال و آربیتراژ ۶ مارکت

<blockquote>💡 <b>اسکن فوری در چت:</b> یکی از دکمه‌های شیشه‌ای زیر را لمس کنید یا مستقیماً هر <b>@username</b>، <b>شماره +888</b> یا <b>لینک گیفت (t.me/nft/...)</b> را در همین چت ارسال نمایید.</blockquote>`,
		"ru": `╔═══ <tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>iFragment Terminal v2.0</b> ═══╗

Здравствуйте, <b>{name}</b>! Добро пожаловать в терминал рыночной аналитики и он-чейн оценки активов Telegram.
👤 Статус: <b>Инвестор</b> | 🏆 Мировой ранг: <b>#{rank}</b> | ⚡ Баланс: <b>{credits} кредитов</b>

📊 <b>Активные модули оценки (TON Blockchain Live):</b>
├ 🏷️ <b>Юзернеймы (@username):</b> AVM-модель, редкость и риск бренда
├ 📱 <b>Номера (+888):</b> Паттерны, клуб редкости и глубина стакана
└ 🎁 <b>Подарки Telegram (Web3 NFT):</b> Генетика 4-Hex, серии и 6 маркетов

<blockquote>💡 <b>Мгновенный скан:</b> нажмите кнопку ниже или отправьте любой <b>@username</b>, <b>номер +888</b> или <b>ссылку на подарок (t.me/nft/...)</b> прямо в этот чат.</blockquote>`,
		"zh": `╔═══ <tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>iFragment Terminal v2.0</b> ═══╗

您好 <b>{name}</b>！欢迎进入 Telegram 机构级链上资产估值与稀缺度分析终端。
👤 身份: <b>认证藏家</b> | 🏆 全网排名: <b>#{rank}</b> | ⚡ 信用点: <b>{credits} 点</b>

📊 <b>三大实时链上估值引擎 (TON Live)：</b>
├ 🏷️ <b>用户名 (@username)：</b> AVM 公允估值、稀缺度与商标风险
├ 📱 <b>匿名靓号 (+888)：</b> 号码排列模式、俱乐部层级与盘口深度
└ 🎁 <b>电报礼物 (Web3 NFT)：</b> 四色背景基因、编号溢价与 6 大市场比价

<blockquote>💡 <b>秒级鉴定：</b> 点击下方玻璃按钮，或直接在聊天中发送任意 <b>@用户名</b>、<b>+888 号码</b>或 <b>礼物链接 (t.me/nft/...)</b>。</blockquote>`,
		"en": `╔═══ <tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>iFragment Terminal v2.0</b> ═══╗

Welcome <b>{name}</b>! You are connected to the institutional valuation and on-chain rarity terminal for Telegram Digital Assets.
👤 Tier: <b>Analyst</b> | 🏆 Global Rank: <b>#{rank}</b> | ⚡ Balance: <b>{credits} Credits</b>

📊 <b>Live On-Chain Valuation Engines (TON Mainnet):</b>
├ 🏷️ <b>Usernames (@username):</b> AVM fair value, trait rarity & brand risk
├ 📱 <b>Anonymous Numbers (+888):</b> Pattern detection, club tier & orderbook
└ 🎁 <b>Telegram Gifts (Web3 NFT):</b> 4-Hex backdrop DNA, serial tier & 6 venues

<blockquote>💡 <b>Instant Scan:</b> Tap a glass button below or drop any <b>@username</b>, <b>+888 number</b>, or <b>gift link (t.me/nft/...)</b> directly into this chat.</blockquote>`,
	},
	"profile_view": {
		"fa": `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>پروفایل سرمایه‌گذار | iFragment</b>

حساب کاربری: <b>{name}</b> (شناسه: <code>{id}</code>)
سطح کاربری: <b>سطح {level}</b>
رتبه در شبکه جهانی: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>اعتبار تحلیلی (Intel Credits):</b> <code>{credits}</code> کریدت
━━━━━━━━━━━━━━━━━━━

🔗 <b>لینک اختصاصی دعوت شما:</b>
<code>{reflink}</code>
<i>با دعوت از دوستان یا فعالیت در گروه @FragmentInvestors اعتبار تحلیلی رایگان دریافت کنید!</i>`,
		"ru": `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>Профиль инвестора | iFragment</b>

Аккаунт: <b>{name}</b> (ID: <code>{id}</code>)
Уровень: <b>Уровень {level}</b>
Рейтинг в системе: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>Доступно кредитов (Intel Credits):</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔗 <b>Ваша реферальная ссылка:</b>
<code>{reflink}</code>`,
		"zh": `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>投资者档案 | iFragment</b>

账户: <b>{name}</b> (ID: <code>{id}</code>)
等级: <b>等级 {level}</b>
全网综合排名: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>分析信用点 (Intel Credits):</b> <code>{credits}</code> 点
━━━━━━━━━━━━━━━━━━━

🔗 <b>您的专属邀请链接:</b>
<code>{reflink}</code>
<i>邀请好友加入或在 @FragmentInvestors 互动，即可免费获取分析信用点！</i>`,
		"en": `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>Investor Profile | iFragment</b>

Account: <b>{name}</b> (ID: <code>{id}</code>)
Tier Level: <b>Level {level}</b>
Global Rank: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>Intel Credits Available:</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔗 <b>Your Exclusive Referral Link:</b>
<code>{reflink}</code>`,
	},
	"prompt_username": {
		"fa": "🏷️ <b>تحلیل و کارشناسی نام کاربری (Username)</b>\n\nلطفاً نام کاربری مد نظر خود را به صورت متن، با @ یا لینک فرگمنت ارسال کنید:\n\n📌 نمونه: <code>@crypto</code> ، <code>wallet</code> ، <code>ton_holder</code>",
		"ru": "🏷️ <b>Оценка и анализ юзернейма Telegram</b>\n\nПожалуйста, отправьте тег, имя пользователя или ссылку Fragment:\n\n📌 Пример: <code>@crypto</code>, <code>wallet</code>",
		"zh": "🏷️ <b>Telegram 用户名专业估值分析</b>\n\n请输入您想要评估的 Telegram 用户名或 Fragment 链接：\n\n📌 示例: <code>@crypto</code>, <code>wallet</code>",
		"en": "🏷️ <b>Telegram Username Valuation</b>\n\nPlease enter the username handle or Fragment URL you wish to valuate:\n\n📌 Example: <code>@crypto</code>, <code>wallet</code>",
	},
	"prompt_number": {
		"fa": "📱 <b>تحلیل شماره کلکسیونی ناشناس (+888)</b>\n\nلطفاً شماره کلکسیونی ۸ رقمی یا رند ۴ رقمی مد نظر را وارد نمایید:\n\n📌 نمونه: <code>+888 8888 8888</code> یا <code>+88801234567</code> یا <code>8888</code>",
		"ru": "📱 <b>Анализ анонимного номера (+888)</b>\n\nВведите анонимный 8-значный или генезис 4-значный номер:\n\n📌 Пример: <code>+888 8888 8888</code> или <code>8888</code>",
		"zh": "📱 <b>Telegram +888 匿名靓号价值分析</b>\n\n请输入您想要分析的 8 位或 4 位 +888 靓号：\n\n📌 示例: <code>+888 8888 8888</code> 或 <code>8888</code>",
		"en": "📱 <b>Telegram Anonymous Numbers (+888)</b>\n\nPlease enter the anonymous +888 number to analyze:\n\n📌 Example: <code>+888 8888 8888</code> or <code>8888</code>",
	},
	"prompt_gift": {
		"fa": "🎁 <b>کارشناسی گیفت و کالکشن‌های تلگرام</b>\n\nلطفاً لینک گیفت در تلگرام یا فرگمنت، یا نام و شماره سریال آن را ارسال کنید:\n\n📌 نمونه: <code>https://t.me/nft/PlushPepe-42</code> یا <code>PlushPepe-42</code>",
		"ru": "🎁 <b>Оценка и анализ подарков Telegram</b>\n\nОтправьте ссылку на NFT-подарок или название и серийный номер:\n\n📌 Пример: <code>https://t.me/nft/PlushPepe-42</code> или <code>PlushPepe-42</code>",
		"zh": "🎁 <b>Telegram 礼物 NFT 稀缺度与估值鉴定</b>\n\n请发送礼物 NFT 链接或模型名称及编号：\n\n📌 示例: <code>https://t.me/nft/PlushPepe-42</code> 或 <code>PlushPepe-42</code>",
		"en": "🎁 <b>Telegram Gifts Appraisal</b>\n\nPlease send the Telegram Gift link or model-serial:\n\n📌 Example: <code>https://t.me/nft/PlushPepe-42</code> or <code>PlushPepe-42</code>",
	},
	"precheck_gate": {
		"fa": `🔍 <b>تحلیل اولیه دارایی شناسایی شد</b>

دارایی: <b>{type}</b>
شناسه / مقدار: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
⚡ <b>اعتبار تحلیلی (Intel Credits):</b> <code>{credits}</code>
💬 <i>کریدت رایگان با ارسال پیام در گروه @FragmentInvestors</i>
━━━━━━━━━━━━━━━━━━━

🔐 <b>در گزارش تحلیلی عمیق این دارایی چه مواردی می‌بینید؟</b>
• برآورد ارزش منصفانه دلاری و TON (Fair Value)
• سنجش کمیابی صفات و ویژگی‌های ساختاری
• تاریخچه آخرین معاملات ثبت‌شده مشابه در شبکه
• شاخص نقدشوندگی، زمان فروش و سرتیفیکیت اصالت

هزینه باز کردن گزارش کامل: <b>۱ کریدت تحلیلی</b>`,
		"ru": `🔍 <b>Актив успешно распознан для анализа</b>

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
• Метрики ликвидности и сертификат подлинности

Стоимость открытия полного отчета: <b>1 Intel Credit</b>`,
		"zh": `🔍 <b>已成功识别资产并准备评估</b>

资产类别: <b>{type}</b>
目标标识: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
⚡ <b>分析信用点 (Intel Credits):</b> <code>{credits}</code> 点
💬 <i>在 @FragmentInvestors 群组发消息即可获取免费信用点</i>
━━━━━━━━━━━━━━━━━━━

🔐 <b>深度专业分析报告包含内容:</b>
• 基于 TON 与美元的公允价值科学估算
• 基因特征稀缺度与等级百分比
• 全网最新真实撮合交易参照对比
• 市场流动性评级与防伪认证证书

解锁完整深度报告仅需: <b>1 个分析信用点</b>`,
		"en": `🔍 <b>Asset Identified for Deep Intelligence</b>

Asset Class: <b>{type}</b>
Identifier: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
⚡ <b>Intel Credits Available:</b> <code>{credits}</code>
💬 <i>Earn free credits by sending messages in @FragmentInvestors</i>
━━━━━━━━━━━━━━━━━━━

🔐 <b>What's inside the deep intelligence report?</b>
• Fair value valuation in TON & USD
• Trait rarity metrics & structural attributes
• On-chain comps of recent executed trades
• Liquidity score & cryptographic certificate

Cost to unlock full institutional report: <b>1 Intel Credit</b>`,
	},
	"exchange_confirm": {
		"fa": "⚡ <b>دریافت کریدت تحلیلی (Intel Credits)</b>\n\nموجودی فعلی شما: <b>{credits} کریدت</b>\n\n💬 با فعالیت در گروه رسمی <b>@FragmentInvestors</b> به ازای هر پیام ۱ کریدت رایگان دریافت کنید یا بسته‌های اعتباری را با Telegram Stars تهیه نمایید.",
		"ru": "⚡ <b>Получение Intel Credits</b>\n\nВаш баланс: <b>{credits} кредитов</b>\n\n💬 Общайтесь в <b>@FragmentInvestors</b> (1 сообщение = 1 бесплатный кредит) или приобретите пакет за Telegram Stars.",
		"zh": "⚡ <b>获取分析信用点 (Intel Credits)</b>\n\n当前余额: <b>{credits} 信用点</b>\n\n💬 在官方社群 <b>@FragmentInvestors</b> 中每发送 1 条消息即可获得 1 个免费信用点，或使用 Telegram Stars 购买。",
		"en": "⚡ <b>Get Intel Credits</b>\n\nCurrent Balance: <b>{credits} Credits</b>\n\n💬 Chat in <b>@FragmentInvestors</b> (1 message = 1 Free Intel Credit) or purchase credit packs via Telegram Stars.",
	},
	"exchange_success": {
		"fa": "✅ <b>اعتبار تحلیلی شما با موفقیت شارژ شد!</b>\n\nموجودی جدید: <b>{credits} کریدت</b>",
		"ru": "✅ <b>Баланс кредитов успешно пополнен!</b>\n\nНовый баланс: <b>{credits} кредитов</b>",
		"zh": "✅ <b>分析信用点充值成功！</b>\n\n当前余额: <b>{credits} 信用点</b>",
		"en": "✅ <b>Intel Credits credited successfully!</b>\n\nNew Balance: <b>{credits} Credits</b>",
	},
	"exchange_fail": {
		"fa": "⚠️ <b>اعتبار تحلیلی کافی نیست!</b>\n\nبرای دریافت کریدت رایگان در گروه @FragmentInvestors پیام ارسال کنید یا با Stars خرید نمایید.",
		"ru": "⚠️ <b>Недостаточно кредитов!</b>\n\nОтправьте сообщение в @FragmentInvestors для бесплатного кредита или купите за Stars.",
		"zh": "⚠️ <b>分析信用点不足！</b>\n\n请在 @FragmentInvestors 群组发言免费领取，或使用 Stars 购买。",
		"en": "⚠️ <b>Insufficient Intel Credits!</b>\n\nSend a message in @FragmentInvestors for a free credit or purchase via Stars.",
	},
	"help_view": {
		"fa": `📖 <b>راهنمای ترمینال هوشمند iFragment</b>

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

💡 <i>هر گزارش عمیق به ۱ کریدت تحلیلی نیاز دارد که می‌توانید با ارسال پیام یا بوست در سوپرگروه @FragmentInvestors به صورت کاملاً رایگان کریدت نامحدود دریافت کنید، یا آن را با Stars تهیه فرمایید.</i>`,
		"ru": `📖 <b>Инструкция терминала iFragment</b>

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

💡 <i>Каждый детальный отчет требует 1 Intel Credit. Вы можете бесплатно получать кредиты за сообщения и бусты в @FragmentInvestors или приобрести их за Stars.</i>`,
		"zh": `📖 <b>iFragment 智能终端使用指南</b>

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

💡 <i>每份深度报告消耗 1 个分析信用点。您可以在 @FragmentInvestors 群组中发言或助力群组免费获取无限信用点，也可使用 Telegram Stars 购买。</i>`,
		"en": `📖 <b>iFragment Terminal Guide</b>

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

💡 <i>Each detailed report costs 1 Intel Credit. You can earn unlimited free credits by chatting or boosting @FragmentInvestors, or buy with Stars.</i>`,
	},
}

// defaultButtons stores the centralized fallback button labels across all 4 supported languages.
var defaultButtons = map[string]map[string]string{
	"btn_mini_app": {
		"fa": "🚀 ورود به ترمینال مینی‌اپ iFragment 💎",
		"ru": "🚀 Открыть терминал iFragment 💎",
		"zh": "🚀 启动 iFragment 智能终端 💎",
		"en": "🚀 Launch iFragment Terminal 💎",
	},
	"btn_usernames": {
		"fa": "🏷️ کارشناسی یوزرنیم",
		"ru": "🏷️ Оценка юзернеймов",
		"zh": "🏷️ 用户名估值",
		"en": "🏷️ Username Appraisal",
	},
	"btn_numbers": {
		"fa": "📱 شماره‌های رند (+888)",
		"ru": "📱 Номера (+888)",
		"zh": "📱 匿名靓号 (+888)",
		"en": "📱 +888 Numbers",
	},
	"btn_gifts": {
		"fa": "🎁 کارشناسی گیفت (NFT)",
		"ru": "🎁 Подарки (Web3 NFT)",
		"zh": "🎁 电报礼物 (NFT)",
		"en": "🎁 Web3 Gifts (NFT)",
	},
	"btn_profile": {
		"fa": "👤 پروفایل و اعتبار من",
		"ru": "👤 Профиль и баланс",
		"zh": "👤 个人中心与额度",
		"en": "👤 Profile & Credits",
	},
	"btn_language": {
		"fa": "🌐 تغییر زبان (۴ زبان)",
		"ru": "🌐 Язык (4 языка)",
		"zh": "🌐 切换语言 (4语)",
		"en": "🌐 Language (4 Langs)",
	},
	"btn_help": {
		"fa": "📖 راهنما و متدولوژی",
		"ru": "📖 Гид и методология",
		"zh": "📖 指南与方法论",
		"en": "📖 Guide & Methodology",
	},
	"btn_free_credits": {
		"fa": "💬 دریافت کریدت رایگان (گروه)",
		"ru": "💬 Бесплатные кредиты",
		"zh": "💬 免费获取信用点",
		"en": "💬 Earn Free Credits",
	},
	"btn_exchange": {
		"fa": "💬 دریافت کریدت رایگان (گروه)",
		"ru": "💬 Бесплатные кредиты",
		"zh": "💬 免费获取信用点",
		"en": "💬 Earn Free Credits",
	},
	"btn_leaderboard": {
		"fa": "🏆 جدول برترین‌ها (مینی‌اپ)",
		"ru": "🏆 Таблица лидеров (Mini App)",
		"zh": "🏆 综合排行榜 (小程序)",
		"en": "🏆 Top Leaderboard (Mini App)",
	},
	"btn_stars": {
		"fa": "⭐ فروشگاه کریدت (Stars)",
		"ru": "⭐ Магазин кредитов (Stars)",
		"zh": "⭐ 信用点商店 (Stars)",
		"en": "⭐ Credit Store (Stars)",
	},
	"btn_unlock": {
		"fa": "🔓 مشاهده گزارش تحلیلی (۱ کریدت)",
		"ru": "🔓 Открыть отчет (1 кредит)",
		"zh": "🔓 解锁专业分析报告 (1 信用点)",
		"en": "🔓 Unlock Full Report (1 Credit)",
	},
	"btn_back": {
		"fa": "🔙 بازگشت به منو",
		"ru": "🔙 В меню",
		"zh": "🔙 返回主菜单",
		"en": "🔙 Back to Menu",
	},
	"btn_back_menu": {
		"fa": "🔙 بازگشت به منوی اصلی",
		"ru": "🔙 В главное меню",
		"zh": "🔙 返回主菜单",
		"en": "🔙 Back to Main Menu",
	},
	"btn_back_gate": {
		"fa": "🔙 بازگشت",
		"ru": "🔙 Назад",
		"zh": "🔙 返回",
		"en": "🔙 Back",
	},
	"btn_cancel": {
		"fa": "❌ انصراف",
		"ru": "❌ Отмена",
		"zh": "❌ 取消",
		"en": "❌ Cancel",
	},
}

// GetDefaultText returns centralized system standard text for a key and language.
func GetDefaultText(key, lang string) string {
	if texts, ok := defaultTexts[key]; ok {
		if text, ok := texts[lang]; ok && text != "" {
			return text
		}
		if text, ok := texts["en"]; ok && text != "" {
			return text
		}
	}
	return "Standard Content"
}

// GetDefaultButton returns centralized system standard button label for a key and language.
func GetDefaultButton(key, lang string) string {
	if btns, ok := defaultButtons[key]; ok {
		if btn, ok := btns[lang]; ok && btn != "" {
			return btn
		}
		if btn, ok := btns["en"]; ok && btn != "" {
			return btn
		}
	}
	return "Button"
}
