package handler

// defaultTexts stores the centralized fallback texts for bot messages across all 4 supported languages.
var defaultTexts = map[string]map[string]string{
	"start_menu": {
		"fa": `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>ترمینال تحلیل دارایی‌های تلگرام | iFragment</b>

سلام <b>{name}</b> عزیز؛ به دستیار هوشمند کارشناسی و ارزیابی دارایی‌های دیجیتال تلگرام خوش آمدید.

یکی از بخش‌های زیر را انتخاب کنید، یا مستقیماً <b>نام کاربری</b>، <b>شماره ناشناس (+888)</b> یا <b>لینک گیفت</b> را در چت ارسال فرمایید:`,
		"ru": `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>Терминал аналитики активов Telegram | iFragment</b>

Здравствуйте, <b>{name}</b>! Добро пожаловать в интеллектуальный ассистент оценки активов Telegram.

Выберите категорию или отправьте <b>юзернейм</b>, <b>номер (+888)</b> или <b>ссылку на подарок</b> прямо в чат:`,
		"zh": `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>Telegram 资产智能分析终端 | iFragment</b>

您好 <b>{name}</b>！欢迎使用 Telegram 数字资产专业估值与市场洞察终端。

请选择下方的资产类别，或直接在聊天中发送<b>用户名</b>、<b>+888 匿名靓号</b>或<b>礼物链接</b>：`,
		"en": `<tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>Telegram Asset Intelligence Terminal | iFragment</b>

Welcome <b>{name}</b>! I am your institutional analytics engine for Telegram Digital Assets.

Select an asset class below or simply send any <b>username</b>, <b>anonymous number (+888)</b>, or <b>gift link</b> in chat:`,
	},
	"profile_view": {
		"fa": `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>پروفایل سرمایه‌گذار | iFragment</b>

حساب کاربری: <b>{name}</b> (شناسه: <code>{id}</code>)
سطح کاربری: <b>سطح {level}</b>
رتبه در شبکه جهانی: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>موجودی سکه ایردراپ:</b> <code>{coins}</code>
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>اعتبار تحلیلی (Intel Credits):</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔗 <b>لینک اختصاصی دعوت شما:</b>
<code>{reflink}</code>
<i>با دعوت از دوستان، سکه ایردراپ و اعتبار تحلیلی رایگان دریافت کنید!</i>`,
		"ru": `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>Профиль инвестора | iFragment</b>

Аккаунт: <b>{name}</b> (ID: <code>{id}</code>)
Уровень: <b>Уровень {level}</b>
Рейтинг в системе: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>Баланс монет Airdrop:</b> <code>{coins}</code>
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>Доступно кредитов (Intel Credits):</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔗 <b>Ваша реферальная ссылка:</b>
<code>{reflink}</code>`,
		"zh": `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>投资者档案 | iFragment</b>

账户: <b>{name}</b> (ID: <code>{id}</code>)
等级: <b>等级 {level}</b>
全网综合排名: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>空投代币余额:</b> <code>{coins}</code>
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>分析信用点 (Intel Credits):</b> <code>{credits}</code> 点
━━━━━━━━━━━━━━━━━━━

🔗 <b>您的专属邀请链接:</b>
<code>{reflink}</code>
<i>邀请好友加入，双方均可获得代币与分析信用点奖励！</i>`,
		"en": `<tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>Investor Profile | iFragment</b>

Account: <b>{name}</b> (ID: <code>{id}</code>)
Tier Level: <b>Level {level}</b>
Global Rank: <b>#{rank}</b>

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>Airdrop Coins Balance:</b> <code>{coins}</code>
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>Intel Credits Available:</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔗 <b>Your Exclusive Referral Link:</b>
<code>{reflink}</code>`,
	},
	"prompt_username": {
		"fa": "🏷️ <b>تحلیل و کارشناسی نام کاربری (Username)</b>\n\nلطفاً نام کاربری مد نظر خود را به صورت متن یا با @ ارسال کنید:\n\nنمونه: <code>@crypto</code> ، <code>wallet</code> ، <code>ton_holder</code>",
		"ru": "🏷️ <b>Оценка и анализ юзернейма Telegram</b>\n\nПожалуйста, отправьте тег или имя пользователя:\n\nПример: <code>@crypto</code>, <code>wallet</code>",
		"zh": "🏷️ <b>Telegram 用户名专业估值分析</b>\n\n请输入您想要评估的 Telegram 用户名或链接：\n\n示例: <code>@crypto</code>, <code>wallet</code>",
		"en": "🏷️ <b>Telegram Username Valuation</b>\n\nPlease enter the username handle you wish to valuate:\n\nExample: <code>@crypto</code>, <code>wallet</code>",
	},
	"prompt_number": {
		"fa": "📱 <b>تحلیل شماره کلکسیونی ناشناس (+888)</b>\n\nلطفاً شماره کلکسیونی ۸ رقمی یا رند ۴ رقمی مد نظر را وارد نمایید:\n\nنمونه: <code>+888 8888 8888</code> یا <code>+88801234567</code> یا <code>8888</code>",
		"ru": "📱 <b>Анализ анонимного номера (+888)</b>\n\nВведите анонимный 8-значный или генезис 4-значный номер:\n\nПример: <code>+888 8888 8888</code> или <code>8888</code>",
		"zh": "📱 <b>Telegram +888 匿名靓号价值分析</b>\n\n请输入您想要分析的 8 位或 4 位 +888 靓号：\n\n示例: <code>+888 8888 8888</code> 或 <code>8888</code>",
		"en": "📱 <b>Telegram Anonymous Numbers (+888)</b>\n\nPlease enter the anonymous +888 number to analyze:\n\nExample: <code>+888 8888 8888</code> or <code>8888</code>",
	},
	"prompt_gift": {
		"fa": "🎁 <b>کارشناسی گیفت و کالکشن‌های تلگرام</b>\n\nلطفاً لینک گیفت در تلگرام یا فرگمنت، یا نام و شماره آن را ارسال کنید:\n\nنمونه: <code>https://t.me/nft/PlushPepe-42</code> یا <code>PlushPepe-42</code>",
		"ru": "🎁 <b>Оценка и анализ подарков Telegram</b>\n\nОтправьте ссылку на NFT-подарок или название и номер:\n\nПример: <code>https://t.me/nft/PlushPepe-42</code> или <code>PlushPepe-42</code>",
		"zh": "🎁 <b>Telegram 礼物 NFT 稀缺度与估值鉴定</b>\n\n请发送礼物 NFT 链接或模型名称及编号：\n\n示例: <code>https://t.me/nft/PlushPepe-42</code> 或 <code>PlushPepe-42</code>",
		"en": "🎁 <b>Telegram Gifts Appraisal</b>\n\nPlease send the Telegram Gift link or model-serial:\n\nExample: <code>https://t.me/nft/PlushPepe-42</code>",
	},
	"precheck_gate": {
		"fa": `🔍 <b>تحلیل اولیه دارایی شناسایی شد</b>

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

هزینه باز کردن گزارش کامل: <b>۱ کریدت تحلیلی</b>`,
		"ru": `🔍 <b>Актив успешно распознан для анализа</b>

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

Стоимость открытия полного отчета: <b>1 Intel Credit</b>`,
		"zh": `🔍 <b>已成功识别资产并准备评估</b>

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

解锁完整深度报告仅需: <b>1 个分析信用点</b>`,
		"en": `🔍 <b>Asset Identified for Deep Intelligence</b>

Asset Class: <b>{type}</b>
Identifier: <code>{entity}</code>

━━━━━━━━━━━━━━━━━━━
🪙 <b>Airdrop Coins Balance:</b> <code>{coins}</code>
⚡ <b>Intel Credits Available:</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━

🔐 <b>What's inside the deep intelligence report?</b>
• Fair value valuation in TON & USD
• Trait rarity metrics & structural attributes
• On-chain comps of recent executed trades
• Liquidity score & market clearance velocity

Cost to unlock full institutional report: <b>1 Intel Credit</b>`,
	},
	"exchange_confirm": {
		"fa": `<tg-emoji emoji-id="5445284980978654454">🔄</tg-emoji> <b>تأییدیه تبدیل سکه ایردراپ به کردیت تحلیلی</b>

آیا مایل به تبدیل <b>{cost_coins} سکه ایردراپ</b> به <b>۱ اعتبار تحلیلی (Intel Credit)</b> هستید؟

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>هزینه تبدیل:</b> <code>{cost_coins}</code> سکه
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>اعتبار دریافتی:</b> <code>+1</code> کردیت تحلیلی
💰 <b>موجودی فعلی سکه شما:</b> <code>{coins}</code>
📊 <b>موجودی کردیت شما:</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━
<i>ℹ️ اعتبارات تحلیلی قابلیت بازگشایی پرونده‌های ارزش‌گذاری عمیق را به شما می‌دهند.</i>`,
		"ru": `<tg-emoji emoji-id="5445284980978654454">🔄</tg-emoji> <b>Подтверждение обмена монет</b>

Вы уверены, что хотите обменять <b>{cost_coins} Airdrop монет</b> на <b>1 аналитический кредит</b>?

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>Стоимость обмена:</b> <code>{cost_coins}</code> монет
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>Начисление:</b> <code>+1</code> Intel Credit
💰 <b>Текущий баланс монет:</b> <code>{coins}</code>
📊 <b>Текущий баланс кредитов:</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━
<i>ℹ️ Кредиты открывают институциональные отчеты и редкие метрики активов.</i>`,
		"zh": `<tg-emoji emoji-id="5445284980978654454">🔄</tg-emoji> <b>代币兑换确认</b>

您确定要将 <b>{cost_coins} 枚空投代币</b> 兑换为 <b>1 个分析信用点</b> 吗？

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>兑换消耗:</b> <code>{cost_coins}</code> 代币
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>到账信用点:</b> <code>+1</code> 点
💰 <b>当前代币余额:</b> <code>{coins}</code>
📊 <b>当前信用点数:</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━
<i>ℹ️ 分析信用点用于解锁 Telegram 数字资产深度公允估值与稀缺度报告。</i>`,
		"en": `<tg-emoji emoji-id="5445284980978654454">🔄</tg-emoji> <b>Exchange Confirmation</b>

Are you sure you want to exchange <b>{cost_coins} Airdrop Coins</b> for <b>1 Intel Credit</b>?

━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="5406830500155238210">🪙</tg-emoji> <b>Exchange Cost:</b> <code>{cost_coins}</code> Coins
<tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>Credits Received:</b> <code>+1</code> Intel Credit
💰 <b>Current Coin Balance:</b> <code>{coins}</code>
📊 <b>Current Credits:</b> <code>{credits}</code>
━━━━━━━━━━━━━━━━━━━
<i>ℹ️ Intel Credits unlock institutional valuations and rarity metrics for Telegram digital assets.</i>`,
	},
	"exchange_success": {
		"fa": `<tg-emoji emoji-id="5206607081334906820">✅</tg-emoji> <b>تبدیل سکه با موفقیت انجام شد!</b>

تعداد <b>{cost_coins} سکه ایردراپ</b> با موفقیت کسر شد و ۱ کریدت تحلیلی به حسابتان اضافه گردید.
⚡ موجودی فعلی شما: <b>{credits} کریدت تحلیلی</b>`,
		"ru": `<tg-emoji emoji-id="5206607081334906820">✅</tg-emoji> <b>Обмен успешно выполнен!</b>

Списано <b>{cost_coins} монет</b> и начислен 1 кредит.
⚡ Текущий баланс: <b>{credits} кредитов</b>.`,
		"zh": `<tg-emoji emoji-id="5206607081334906820">✅</tg-emoji> <b>代币兑换成功！</b>

已扣除 <b>{cost_coins} 枚代币</b> 并到账 1 个分析信用点。
⚡ 当前可用信用点: <b>{credits} 点</b>。`,
		"en": `<tg-emoji emoji-id="5206607081334906820">✅</tg-emoji> <b>Exchange Successful!</b>

Deducted <b>{cost_coins} coins</b>. 1 Intel Credit added.
⚡ Current balance: <b>{credits} Credits</b>.`,
	},
	"exchange_fail": {
		"fa": `<tg-emoji emoji-id="5210952531676504517">❌</tg-emoji> <b>موجودی سکه کافی نیست!</b>

برای تبدیل به ۱ اعتبار تحلیلی، حداقل <b>{cost_coins} سکه ایردراپ</b> مورد نیاز است. شما می‌توانید با تسک‌ها و فعالیت در مینی‌اپ سکه کسب کنید یا از بسته‌های تلگرام استارز استفاده نمایید.`,
		"ru": `<tg-emoji emoji-id="5210952531676504517">❌</tg-emoji> <b>Недостаточно монет!</b>

Для обмена на 1 аналитический кредит требуется минимум <b>{cost_coins} Airdrop монет</b>. Вы можете заработать монеты в приложении или купить кредиты за Stars.`,
		"zh": `<tg-emoji emoji-id="5210952531676504517">❌</tg-emoji> <b>代币余额不足！</b>

兑换 1 个分析信用点需要至少 <b>{cost_coins} 枚空投代币</b>。您可以通过在小程序完成任务获取代币，或直接使用 Telegram Stars 购买点数。`,
		"en": `<tg-emoji emoji-id="5210952531676504517">❌</tg-emoji> <b>Insufficient Coins!</b>

You need at least <b>{cost_coins} Airdrop Coins</b> to exchange for 1 Intel Credit.`,
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

💡 <i>هر گزارش عمیق به ۱ کریدت تحلیلی نیاز دارد که می‌توانید با سکه‌های ایردراپ خود یا استارز تلگرام آن را فعال کنید.</i>`,
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

💡 <i>Каждый детальный отчет требует 1 Intel Credit. Кредиты можно получить за Airdrop-монеты или Stars.</i>`,
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

💡 <i>每份深度报告消耗 1 个分析信用点，支持使用空投代币兑换或 Telegram Stars 购买。</i>`,
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
• <code>/gift CelestialStar-1</code>`,
	},
}

// defaultButtons stores the centralized fallback button labels across all 4 supported languages.
var defaultButtons = map[string]map[string]string{
	"btn_mini_app": {
		"fa": "💎 ورود به مینی‌اپ iFragment",
		"ru": "💎 Открыть iFragment Mini App",
		"zh": "💎 进入 iFragment 小程序",
		"en": "💎 Launch iFragment Mini App",
	},
	"btn_usernames": {
		"fa": "🏷️ نام‌های کاربری",
		"ru": "🏷️ Юзернеймы",
		"zh": "🏷️ 用户名",
		"en": "🏷️ Usernames",
	},
	"btn_numbers": {
		"fa": "📱 شماره‌های رند (+888)",
		"ru": "📱 Номера (+888)",
		"zh": "📱 匿名靓号 (+888)",
		"en": "📱 Numbers (+888)",
	},
	"btn_gifts": {
		"fa": "🎁 گیفت‌های تلگرام",
		"ru": "🎁 Подарки (NFT)",
		"zh": "🎁 电报礼物 (NFT)",
		"en": "🎁 Telegram Gifts",
	},
	"btn_profile": {
		"fa": "👤 پروفایل و دارایی‌ها",
		"ru": "👤 Мой профиль",
		"zh": "👤 个人中心与资产",
		"en": "👤 Profile & Balances",
	},
	"btn_language": {
		"fa": "🌐 تغییر زبان",
		"ru": "🌐 Сменить язык",
		"zh": "🌐 切换语言",
		"en": "🌐 Language",
	},
	"btn_help": {
		"fa": "📖 راهنمای ربات",
		"ru": "📖 Инструкция",
		"zh": "📖 使用指南",
		"en": "📖 Help & Guide",
	},
	"btn_exchange": {
		"fa": "🔄 تبدیل سکه به ۱ کردیت",
		"ru": "🔄 Обменять монеты",
		"zh": "🔄 兑换代币为信用点",
		"en": "🔄 Exchange Coins",
	},
	"btn_stars": {
		"fa": "⭐ خرید کردیت با Stars",
		"ru": "⭐ Купить за Stars",
		"zh": "⭐ 使用 Stars 购买",
		"en": "⭐ Buy with Stars",
	},
	"btn_unlock": {
		"fa": "🔓 باز کردن گزارش کامل (۱ کریدت)",
		"ru": "🔓 Открыть полный отчет (1 кредит)",
		"zh": "🔓 解锁完整分析报告 (1 信用点)",
		"en": "🔓 Unlock Full Report (1 Credit)",
	},
	"btn_back": {
		"fa": "🔙 بازگشت به منو",
		"ru": "🔙 В меню",
		"zh": "🔙 返回主菜单",
		"en": "🔙 Back to Menu",
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
