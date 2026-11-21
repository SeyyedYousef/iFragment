package handler

// defaultTexts stores the centralized fallback texts for bot messages across all 4 supported languages,
// crafted with Fibonacci visual rhythm (1-line crown -> 2-line personal status -> 3-pillar golden showcase -> warm invitation)
// and human-centric collector psychology rather than robotic templates.
var defaultTexts = map[string]map[string]string{
	"start_menu": {
		"fa": `✦ <tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>iFragment  ·  وب‌اپلیکیشن هوشمند ارزیابی دارایی‌های تلگرام</b> ✦

سلام <b>{name}</b> عزیز؛ خوش آمدی ✨
<blockquote>👤 جایگاه کلکسیونی: <b>کارشناس ارشد</b>  ·  🏆 رتبه جهانی: <b>#{rank}</b>  ·  ⚡ تراز تحلیلی: <b>{credits} کریدت</b></blockquote>

<b>تمام ابزارهای حرفه‌ای ارزیابی، نمودارهای زنده و کف قیمت بازار در وب‌اپلیکیشن iFragment آماده است:</b>
• <b>یوزرنیم‌های کلکسیونی (@username)</b> — ارزش منصفانه AVM، رده سرمایه‌گذاری و نبض بازار
• <b>شماره‌های ناشناس (+888)</b> — نمودار زنده، هندسه الگو، رتبه کمیابی و ظرفیت دیفای
• <b>گیفت‌های کلکسیونی (NFT)</b> — 122 کالکشن زنده، ژنتیک 4 رنگ و آربیتراژ 6 مارکت

<blockquote>🚀 <b>برای شروع، همین الان روی دکمه ورود به وب‌اپلیکیشن زیر بزنید</b> — یا هر دارایی را به‌صورت اینلاین با <code>@iFragmentBot</code> در هر چتی جستجو و به اشتراک بگذارید.</blockquote>`,
		"ru": `✦ <tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>iFragment  ·  Веб-терминал оценки активов Telegram</b> ✦

Рады видеть вас, <b>{name}</b> ✨
<blockquote>👤 Статус: <b>Старший аналитик</b>  ·  🏆 Мировой ранг: <b>#{rank}</b>  ·  ⚡ Баланс: <b>{credits} кредитов</b></blockquote>

<b>Все профессиональные графики, аналитика редкости и живые цены доступны прямо в Mini App:</b>
• <b>Коллекционные юзернеймы (@username)</b> — справедливая оценка AVM, бренд и ликвидность
• <b>Анонимные номера (+888)</b> — живые графики, геометрия паттерна, ранг и DeFi-залог
• <b>Подарки Telegram (NFT)</b> — 122 коллекции, генетика 4-Hex и арбитраж 6 маркетов

<blockquote>🚀 <b>Нажмите кнопку ниже, чтобы открыть веб-приложение iFragment</b> — или введите <code>@iFragmentBot</code> в любом чате для мгновенного инлайн-поиска.</blockquote>`,
		"zh": `✦ <tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>iFragment  ·  Telegram 链上资产智能评估小程序</b> ✦

很高兴见到您，<b>{name}</b> ✨
<blockquote>👤 藏家身份: <b>首席分析师</b>  ·  🏆 全网排名: <b>#{rank}</b>  ·  ⚡ 信用额度: <b>{credits} 点</b></blockquote>

<b>所有专业估值引擎、实时走势图表与地板价监控均已集成在 iFragment Web App 中：</b>
• <b>典藏用户名 (@username)</b> — AVM 公允估值、品牌力评分与大盘脉搏
• <b>匿名靓号 (+888)</b> — 实时行情图表、数字美学排名与 DeFi 抵押评估
• <b>电报典藏礼物 (NFT)</b> — 122 个官方系列、四色基因解码与 6 大市场套利

<blockquote>🚀 <b>点击下方按钮立即打开 iFragment 小程序</b> — 或在任意聊天中输入 <code>@iFragmentBot</code> 一键分享链上估值。</blockquote>`,
		"en": `✦ <tg-emoji emoji-id="5368324170671202286">💎</tg-emoji> <b>iFragment  ·  On-Chain Telegram Asset Terminal</b> ✦

Welcome back, <b>{name}</b> ✨
<blockquote>👤 Collector Tier: <b>Senior Analyst</b>  ·  🏆 Global Rank: <b>#{rank}</b>  ·  ⚡ Balance: <b>{credits} Credits</b></blockquote>

<b>Every institutional valuation engine, live chart, and real-time floor board lives inside the iFragment Mini App:</b>
• <b>Collectible Usernames (@username)</b> — AVM fair value, brand equity & market pulse
• <b>Anonymous Numbers (+888)</b> — Live price charts, pattern symmetry, rank & DeFi collateral
• <b>Telegram Gifts (NFT)</b> — 122 live collections, 4-Hex trait DNA & 6-venue arbitrage

<blockquote>🚀 <b>Tap the button below to launch the iFragment Mini App</b> — or type <code>@iFragmentBot</code> in any chat for instant inline valuations.</blockquote>`,
	},
	"profile_view": {
		"fa": `✦ <tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>پاسپورت کلکسیونر و تراز تحلیلی  ·  iFragment</b> ✦

<blockquote>👤 دارنده حساب: <b>{name}</b> (<code>{id}</code>)
🏅 جایگاه و سطح: <b>سطح {level}</b>  ·  🏆 رتبه جهانی: <b>#{rank}</b></blockquote>

<blockquote><tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>موجودی اعتبار تحلیلی (Intel Credits):</b> <code>{credits} کریدت</code>
<i>با هر گفتگو یا بوست در تالار سرمایه‌گذاران @FragmentInvestors اعتبار رایگان هدیه می‌گیرید.</i></blockquote>

🔗 <b>لینک دعوت اختصاصی شما:</b>
<code>{reflink}</code>
<i>با پیوستن هر یک از دوستانتان، اعتبار تحلیلی هدیه به حساب شما افزوده می‌شود.</i>`,
		"ru": `✦ <tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>Паспорт коллекционера и баланс  ·  iFragment</b> ✦

<blockquote>👤 Владелец: <b>{name}</b> (<code>{id}</code>)
🏅 Уровень: <b>Level {level}</b>  ·  🏆 Мировой рейтинг: <b>#{rank}</b></blockquote>

<blockquote><tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>Доступный баланс (Intel Credits):</b> <code>{credits}</code>
<i>Общайтесь в сообществе @FragmentInvestors и получайте бесплатные кредиты за активность.</i></blockquote>

🔗 <b>Ваша персональная ссылка для приглашений:</b>
<code>{reflink}</code>`,
		"zh": `✦ <tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>藏家通行证与信用账户  ·  iFragment</b> ✦

<blockquote>👤 认证账户: <b>{name}</b> (<code>{id}</code>)
🏅 藏家等级: <b>Level {level}</b>  ·  🏆 全网综合排名: <b>#{rank}</b></blockquote>

<blockquote><tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>可用分析信用点 (Intel Credits):</b> <code>{credits} 点</code>
<i>在 @FragmentInvestors 官方社群发言互动，即可源源不断获取免费信用点。</i></blockquote>

🔗 <b>您的专属邀请链接:</b>
<code>{reflink}</code>
<i>邀请好友同行，双方均可获赠分析信用点奖励。</i>`,
		"en": `✦ <tg-emoji emoji-id="5373141891321699086">👤</tg-emoji> <b>Collector Passport & Credit Vault  ·  iFragment</b> ✦

<blockquote>👤 Account Holder: <b>{name}</b> (<code>{id}</code>)
🏅 Collector Tier: <b>Level {level}</b>  ·  🏆 Global Standing: <b>#{rank}</b></blockquote>

<blockquote><tg-emoji emoji-id="5445284980978654454">⚡</tg-emoji> <b>Available Intel Credits:</b> <code>{credits}</code>
<i>Earn free credits organically by participating in the @FragmentInvestors community.</i></blockquote>

🔗 <b>Your Personal Invitation Link:</b>
<code>{reflink}</code>`,
	},
	"prompt_username": {
		"fa": "✦ 🏷️ <b>تالار ارزیابی نام کاربری (Username)</b>\n\nنام کاربری که می‌خواهی ارزش واقعی و قدرت برندش را بسنجیم برایم بنویس (با @، بدون @ یا لینک فرگمنت):\n\n<blockquote>📌 نمونه: <code>@crypto</code>  ·  <code>wallet</code>  ·  <code>ton_holder</code></blockquote>",
		"ru": "✦ 🏷️ <b>Оценка коллекционного юзернейма</b>\n\nОтправьте имя пользователя или ссылку Fragment, чтобы рассчитать его рыночную стоимость и силу бренда:\n\n<blockquote>📌 Пример: <code>@crypto</code>  ·  <code>wallet</code></blockquote>",
		"zh": "✦ 🏷️ <b>Telegram 用户名深度估值</b>\n\n请发送您想鉴定的 Telegram 用户名或 Fragment 链接，我们将为您解析其公允价值与品牌潜力：\n\n<blockquote>📌 示例: <code>@crypto</code>  ·  <code>wallet</code></blockquote>",
		"en": "✦ 🏷️ <b>Username Valuation Salon</b>\n\nSend the username handle or Fragment link you'd like to appraise for fair market value and brand equity:\n\n<blockquote>📌 Example: <code>@crypto</code>  ·  <code>wallet</code></blockquote>",
	},
	"prompt_number": {
		"fa": "✦ 📱 <b>تالار کارشناسی شماره‌های کلکسیونی (+888)</b>\n\nشماره ناشناس 8 رقمی یا جنسیس 4 رقمی مد نظرت را بنویس تا الگوی تقارن، رتبه کمیابی و ارزش آن را بررسی کنیم:\n\n<blockquote>📌 نمونه: <code>+888 8888 8888</code>  ·  <code>+88801234567</code>  ·  <code>8888</code></blockquote>",
		"ru": "✦ 📱 <b>Анализ анонимных номеров (+888)</b>\n\nОтправьте 8-значный или редкий 4-значный номер +888 для анализа паттерна, ранга и рыночной цены:\n\n<blockquote>📌 Пример: <code>+888 8888 8888</code>  ·  <code>8888</code></blockquote>",
		"zh": "✦ 📱 <b>Telegram +888 匿名靓号价值鉴定</b>\n\n请输入 8 位或 4 位创世 +888 匿名号码，即刻解析其号码排列美学与全网稀缺排名：\n\n<blockquote>📌 示例: <code>+888 8888 8888</code>  ·  <code>8888</code></blockquote>",
		"en": "✦ 📱 <b>Anonymous Number (+888) Appraisal</b>\n\nSend any 8-digit or 4-digit Genesis +888 number to decode its pattern rarity, global rank, and fair value:\n\n<blockquote>📌 Example: <code>+888 8888 8888</code>  ·  <code>8888</code></blockquote>",
	},
	"prompt_gift": {
		"fa": "✦ 🎁 <b>تالار کارشناسی گیفت‌های کلکسیونی (Web3 NFT)</b>\n\nلینک رسمی گیفت یا نام و شماره سریال آن را بفرست تا ژنتیک پس‌زمینه، نماد و ارزش 4 ستونی آن صادر شود:\n\n<blockquote>📌 نمونه: <code>https://t.me/nft/PlushPepe-42</code>  ·  <code>PlushPepe-42</code></blockquote>",
		"ru": "✦ 🎁 <b>Экспертиза коллекционных подарков Telegram</b>\n\nОтправьте ссылку на NFT-подарок или его название с номером для расчёта генетики атрибутов и цены:\n\n<blockquote>📌 Пример: <code>https://t.me/nft/PlushPepe-42</code>  ·  <code>PlushPepe-42</code></blockquote>",
		"zh": "✦ 🎁 <b>Telegram 典藏礼物 NFT 稀缺度与估值鉴定</b>\n\n请发送礼物 NFT 链接或名称编号，我们将为您解码四色背景基因与多市场公允价值：\n\n<blockquote>📌 示例: <code>https://t.me/nft/PlushPepe-42</code>  ·  <code>PlushPepe-42</code></blockquote>",
		"en": "✦ 🎁 <b>Telegram Collectible Gift Appraisal</b>\n\nSend any Telegram NFT gift link or model-serial to inspect its trait genetics, serial multiplier, and fair value:\n\n<blockquote>📌 Example: <code>https://t.me/nft/PlushPepe-42</code>  ·  <code>PlushPepe-42</code></blockquote>",
	},
	"precheck_gate": {
		"fa": `✦ 🔍 <b>تحلیل اولیه دارایی با موفقیت انجام شد</b> ✦

<blockquote>🏷️ طبقه دارایی: <b>{type}</b>
💎 شناسه کلکسیونی: <code>{entity}</code>
⚡ تراز اعتبار شما: <code>{credits} کریدت</code></blockquote>

<b>پرونده کارشناسی و گواهی تصویری آماده صدور است:</b>
• کارت گواهی تصویری اختصاصی با طیف کف، ارزش منصفانه و سقف قیمت
• کالبدشکافی دقیق کمیابی، قدرت برند و ویژگی‌های ساختاری
• جدول معاملات واقعی همتراز ثبت‌شده روی بلاکچین TON
• استراتژی قیمت‌گذاری، زمان تخمینی نقدشوندگی و گواهی اصالت

<blockquote>💬 <i>نکته دوستانه: با هر پیام در گروه @FragmentInvestors می‌توانید کریدت رایگان دریافت کنید.</i>
🔓 <b>صدور گواهی تصویری و گزارش کامل: 1 کریدت تحلیلی</b></blockquote>`,
		"ru": `✦ 🔍 <b>Предварительная идентификация актива завершена</b> ✦

<blockquote>🏷️ Категория: <b>{type}</b>
💎 Идентификатор: <code>{entity}</code>
⚡ Ваш баланс: <code>{credits} кредитов</code></blockquote>

<b>Что подготовлено в полном досье и сертификате:</b>
• Визуальный сертификат с диапазоном Floor, Fair Value и Ceiling
• Глубокий разбор редкости атрибутов и структурной ценности
• Подтверждённые он-чейн сделки с аналогичными активами
• Оценка ликвидности, стратегия торгов и крипто-сертификат

<blockquote>💬 <i>Подсказка: бесплатные кредиты начисляются за общение в @FragmentInvestors.</i>
🔓 <b>Выпуск сертификата и полного отчёта: 1 Intel Credit</b></blockquote>`,
		"zh": `✦ 🔍 <b>藏品初探识别已完成，深度档案就绪</b> ✦

<blockquote>🏷️ 资产类别: <b>{type}</b>
💎 目标标识: <code>{entity}</code>
⚡ 可用额度: <code>{credits} 信用点</code></blockquote>

<b>即将为您生成的视觉证书与深度报告包含：</b>
• 黄金比例高清估值证书（含底价、公允价值与溢价上限光谱）
• 基因稀缺度、结构特征与品牌价值的量化拆解
• TON 链上近期真实撮合的对标历史成交记录
• 流动性周期评级、拍卖挂单策略与防伪认证编号

<blockquote>💬 <i>温馨提示：在 @FragmentInvestors 群组发言即可免费获赠信用点。</i>
🔓 <b>生成专属证书与完整深度报告：1 个分析信用点</b></blockquote>`,
		"en": `✦ 🔍 <b>Preliminary Asset Scan Complete</b> ✦

<blockquote>🏷️ Asset Class: <b>{type}</b>
💎 Identifier: <code>{entity}</code>
⚡ Available Balance: <code>{credits} Credits</code></blockquote>

<b>Your Visual Certificate & Full Appraisal Dossier includes:</b>
• Custom Golden-Ratio valuation card with Floor, Fair Value & Ceiling spectrum
• Granular rarity genetics, structural traits & brand equity scoring
• Verified on-chain comparable sales executed on TON
• Liquidity velocity, optimal pricing strategy & cryptographic certificate

<blockquote>💬 <i>Tip: Earn free credits anytime by chatting in @FragmentInvestors.</i>
🔓 <b>Mint visual certificate & unlock full report: 1 Intel Credit</b></blockquote>`,
	},
	"exchange_confirm": {
		"fa": "✦ ⚡ <b>شارژ تراز تحلیلی (Intel Credits)</b>\n\n<blockquote>موجودی فعلی شما: <b>{credits} کریدت</b></blockquote>\n\n💬 با گفتگو در تالار رسمی <b>@FragmentInvestors</b> به ازای هر پیام 1 کریدت رایگان هدیه بگیرید، یا بسته اعتباری دلخواهتان را با Telegram Stars فعال کنید.",
		"ru": "✦ ⚡ <b>Пополнение баланса Intel Credits</b>\n\n<blockquote>Текущий баланс: <b>{credits} кредитов</b></blockquote>\n\n💬 Общайтесь в официальном чате <b>@FragmentInvestors</b> (1 сообщение = 1 бесплатный кредит) или выберите пакет за Telegram Stars.",
		"zh": "✦ ⚡ <b>补充分析信用点 (Intel Credits)</b>\n\n<blockquote>当前可用余额: <b>{credits} 信用点</b></blockquote>\n\n💬 在官方社群 <b>@FragmentInvestors</b> 每发送 1 条消息即可获赠 1 个免费信用点，或使用 Telegram Stars 即刻充值。",
		"en": "✦ ⚡ <b>Top Up Intel Credits</b>\n\n<blockquote>Current Balance: <b>{credits} Credits</b></blockquote>\n\n💬 Chat in <b>@FragmentInvestors</b> (1 message = 1 Free Intel Credit) or activate an instant credit pack via Telegram Stars.",
	},
	"exchange_success": {
		"fa": "✦ ✅ <b>تراز تحلیلی شما با موفقیت شارژ شد!</b>\n\n<blockquote>⚡ موجودی جدید: <b>{credits} کریدت</b></blockquote>",
		"ru": "✦ ✅ <b>Баланс кредитов успешно пополнен!</b>\n\n<blockquote>⚡ Новый баланс: <b>{credits} кредитов</b></blockquote>",
		"zh": "✦ ✅ <b>分析信用点已成功到账！</b>\n\n<blockquote>⚡ 当前最新余额: <b>{credits} 信用点</b></blockquote>",
		"en": "✦ ✅ <b>Intel Credits Added Successfully!</b>\n\n<blockquote>⚡ Updated Balance: <b>{credits} Credits</b></blockquote>",
	},
	"exchange_fail": {
		"fa": "⚠️ <b>موجودی اعتبار تحلیلی برای صدور گزارش کافی نیست</b>\n\n<blockquote>💬 با ارسال پیام در گروه @FragmentInvestors کریدت رایگان دریافت کنید یا از طریق Stars حساب خود را شارژ نمایید.</blockquote>",
		"ru": "⚠️ <b>Недостаточно кредитов для выпуска отчёта</b>\n\n<blockquote>💬 Отправьте сообщение в @FragmentInvestors для получения бесплатного кредита или пополните баланс за Stars.</blockquote>",
		"zh": "⚠️ <b>分析信用点余额不足</b>\n\n<blockquote>💬 请在 @FragmentInvestors 群组发言免费领取信用点，或使用 Stars 充值。</blockquote>",
		"en": "⚠️ <b>Insufficient Intel Credits to Mint Report</b>\n\n<blockquote>💬 Send a message in @FragmentInvestors for a free credit or top up via Telegram Stars.</blockquote>",
	},
	"help_view": {
		"fa": `✦ 📖 <b>راهنمای جامع و متدولوژی ارزیابی iFragment</b> ✦

طراحی iFragment بر پایه سادگی و هوشمندی است؛ بدون نیاز به هیچ دستوری، دارایی مورد نظرتان را مستقیماً در چت بنویسید:

<blockquote>🏷️ <b>1. نام‌های کاربری (Usernames)</b>
کافیست آیدی یا لینک فرگمنت را ارسال کنید:
• <code>@crypto</code>  ·  <code>wallet</code>  ·  <code>https://fragment.com/username/telecom</code></blockquote>

<blockquote>📱 <b>2. شماره‌های کلکسیونی ناشناس (+888)</b>
شماره کامل 8 رقمی یا جنسیس 4 رقمی را بفرستید:
• <code>+888 8888 8888</code>  ·  <code>+88801234567</code>  ·  <code>8888</code></blockquote>

<blockquote>🎁 <b>3. گیفت‌های کلکسیونی تلگرام (Web3 NFT)</b>
لینک رسمی گیفت یا نام و شماره سریال آن را وارد کنید:
• <code>https://t.me/nft/PlushPepe-42</code>  ·  <code>/gift CelestialStar-1</code></blockquote>

💡 <i>برای دریافت کریدت رایگان نامحدود، کافیست در گفتگوهای گروه @FragmentInvestors مشارکت کنید یا گروه را بوست نمایید.</i>`,
		"ru": `✦ 📖 <b>Руководство и методология оценки iFragment</b> ✦

Терминал распознаёт любой актив автоматически — просто отправьте его в чат без команд:

<blockquote>🏷️ <b>1. Юзернеймы (Usernames)</b>
Отправьте тег или ссылку Fragment:
• <code>@crypto</code>  ·  <code>wallet</code>  ·  <code>https://fragment.com/username/telecom</code></blockquote>

<blockquote>📱 <b>2. Анонимные номера (+888)</b>
Отправьте полный номер или 4-значный генезис:
• <code>+888 8888 8888</code>  ·  <code>+88801234567</code>  ·  <code>8888</code></blockquote>

<blockquote>🎁 <b>3. Коллекционные подарки (Telegram Gifts)</b>
Отправьте ссылку на NFT-подарок или его название и номер:
• <code>https://t.me/nft/PlushPepe-42</code>  ·  <code>/gift CelestialStar-1</code></blockquote>

💡 <i>Получайте безлимитные бесплатные кредиты за общение и бусты в сообществе @FragmentInvestors или приобретайте их за Stars.</i>`,
		"zh": `✦ 📖 <b>iFragment 鉴赏指南与估值方法论</b> ✦

无需记忆复杂指令，直接将您想评估的藏品发送至对话中即可自动识别：

<blockquote>🏷️ <b>1. 用户名估值 (Usernames)</b>
直接发送用户名或 Fragment 链接：
• <code>@crypto</code>  ·  <code>wallet</code>  ·  <code>https://fragment.com/username/telecom</code></blockquote>

<blockquote>📱 <b>2. 匿名靓号分析 (+888)</b>
发送 8 位完整号码或 4 位创世靓号：
• <code>+888 8888 8888</code>  ·  <code>+88801234567</code>  ·  <code>8888</code></blockquote>

<blockquote>🎁 <b>3. 电报礼物鉴定 (Telegram Gifts)</b>
发送礼物 NFT 链接或模型编号：
• <code>https://t.me/nft/PlushPepe-42</code>  ·  <code>/gift CelestialStar-1</code></blockquote>

💡 <i>在 @FragmentInvestors 社群发言或助力群组即可免费获赠无限分析信用点，也可通过 Telegram Stars 便捷充值。</i>`,
		"en": `✦ 📖 <b>iFragment Appraisal Guide & Methodology</b> ✦

Designed for effortless clarity — simply send any asset directly into the chat without commands:

<blockquote>🏷️ <b>1. Collectible Usernames</b>
Send any handle or Fragment link:
• <code>@crypto</code>  ·  <code>wallet</code>  ·  <code>https://fragment.com/username/telecom</code></blockquote>

<blockquote>📱 <b>2. Anonymous Numbers (+888)</b>
Send any full +888 number or 4-digit Genesis number:
• <code>+888 8888 8888</code>  ·  <code>+88801234567</code>  ·  <code>8888</code></blockquote>

<blockquote>🎁 <b>3. Telegram Collectible Gifts (NFT)</b>
Send any NFT gift link or model-serial:
• <code>https://t.me/nft/PlushPepe-42</code>  ·  <code>/gift CelestialStar-1</code></blockquote>

💡 <i>Earn unlimited free Intel Credits by chatting or boosting @FragmentInvestors, or top up anytime with Telegram Stars.</i>`,
	},
}

// defaultButtons stores the centralized fallback button labels across all 4 supported languages.
var defaultButtons = map[string]map[string]string{
	"btn_mini_app": {
		"fa": "💎 ورود به وب‌اپلیکیشن iFragment ✦",
		"ru": "💎 Открыть веб-приложение iFragment ✦",
		"zh": "💎 启动 iFragment 小程序终端 ✦",
		"en": "💎 Launch iFragment Mini App ✦",
	},
	"btn_inline_search": {
		"fa": "🔍 جستجوی اینلاین در چت‌ها",
		"ru": "🔍 Инлайн-поиск в чатах",
		"zh": "🔍 内联快捷搜索与分享",
		"en": "🔍 Quick Inline Search",
	},
	"btn_usernames": {
		"fa": "🏷️ ارزیابی یوزرنیم",
		"ru": "🏷️ Юзернеймы",
		"zh": "🏷️ 用户名估值",
		"en": "🏷️ Usernames",
	},
	"btn_numbers": {
		"fa": "📱 شماره‌های +888",
		"ru": "📱 Номера +888",
		"zh": "📱 +888 匿名靓号",
		"en": "📱 +888 Numbers",
	},
	"btn_gifts": {
		"fa": "🎁 گیفت‌های کلکسیونی",
		"ru": "🎁 Подарки NFT",
		"zh": "🎁 典藏礼物 NFT",
		"en": "🎁 Collectible Gifts",
	},
	"btn_profile": {
		"fa": "👤 پاسپورت و اعتبار من",
		"ru": "👤 Паспорт и баланс",
		"zh": "👤 藏家通行证",
		"en": "👤 Collector Passport",
	},
	"btn_language": {
		"fa": "🌐 زبان (4 زبان)",
		"ru": "🌐 Язык (4 языка)",
		"zh": "🌐 语言切换 (4语)",
		"en": "🌐 Language (4 Langs)",
	},
	"btn_help": {
		"fa": "📖 راهنما و متدولوژی",
		"ru": "📖 Гид и методология",
		"zh": "📖 指南与方法论",
		"en": "📖 Guide & Method",
	},
	"btn_free_credits": {
		"fa": "💬 کریدت رایگان (تالار)",
		"ru": "💬 Бесплатные кредиты",
		"zh": "💬 免费领信用点",
		"en": "💬 Earn Free Credits",
	},
	"btn_exchange": {
		"fa": "💬 کریدت رایگان (تالار)",
		"ru": "💬 Бесплатные кредиты",
		"zh": "💬 免费领信用点",
		"en": "💬 Earn Free Credits",
	},
	"btn_leaderboard": {
		"fa": "🏆 برترین کلکسیونرها",
		"ru": "🏆 Лидеры рейтинга",
		"zh": "🏆 藏家排行榜",
		"en": "🏆 Top Collectors",
	},
	"btn_stars": {
		"fa": "⭐ شارژ فوری با Stars",
		"ru": "⭐ Пополнить за Stars",
		"zh": "⭐ Stars 快捷充值",
		"en": "⭐ Top Up via Stars",
	},
	"btn_unlock": {
		"fa": "🔓 صدور گواهی و گزارش کامل (1 کریدت)",
		"ru": "🔓 Выпустить сертификат и отчёт (1 кредит)",
		"zh": "🔓 生成证书与完整报告 (1 信用点)",
		"en": "🔓 Mint Certificate & Full Report (1 Credit)",
	},
	"btn_back": {
		"fa": "🔙 بازگشت به تالار",
		"ru": "🔙 В главное меню",
		"zh": "🔙 返回主菜单",
		"en": "🔙 Back to Menu",
	},
	"btn_back_menu": {
		"fa": "🔙 بازگشت به تالار اصلی",
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
