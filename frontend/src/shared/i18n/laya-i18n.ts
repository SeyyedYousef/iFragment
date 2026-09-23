import { locale, type Locale } from './index.js';

export interface LocalizedText {
	en: string;
	fa: string;
	ru: string;
	zh: string;
}

/**
 * Returns localized string reactively based on active locale (en, fa, ru, zh).
 */
export const layaT = (item: LocalizedText): string => {
	const loc: Locale = locale() || 'en';
	return item[loc] || item.en;
};

// ══════════════════════════════════════════════════════════════════════
// USERNAME VALUATION & DISCOVERY I18N
// ══════════════════════════════════════════════════════════════════════

export const USERNAME_I18N = {
	cardTitle: {
		en: 'LAYA Multi-Dimensional Valuation Card',
		fa: 'کارت ارزیابی چندبعدی لایا',
		ru: 'Многомерная оценочная карта LAYA',
		zh: 'LAYA 多维智能估值卡',
	},
	cardSubtitle: {
		en: 'ModernBERT Real-time Decision Matrix',
		fa: 'مدل تصمیم‌گیری عصبی مدرن‌برت',
		ru: 'Нейросетевая матрица решений ModernBERT',
		zh: 'ModernBERT 实时神经决策矩阵',
	},
	liveAuditBadge: {
		en: 'LIVE AUDIT',
		fa: 'ارزیابی زنده',
		ru: 'ЖИВОЙ АУДИТ',
		zh: '实时审计',
	},
	phoneticTitle: {
		en: 'Phonetic & Typing Flow',
		fa: 'روانی تلفظ و ریتم تایپ',
		ru: 'Фонетика и ритм набора',
		zh: '发音流利度与键入节奏',
	},
	phoneticScoreLabel: {
		en: 'Score 1 to 10',
		fa: 'نمره ۱ تا ۱۰',
		ru: 'Оценка 1 из 10',
		zh: '评分 1 至 10',
	},
	phoneticTopTier: {
		en: 'Apex Cognitive Cadence',
		fa: 'ریتم شناختی فوق‌العاده',
		ru: 'Превосходная когнитивная плавность',
		zh: '极致认知节奏',
	},
	phoneticFluent: {
		en: 'Fluent Vocalization',
		fa: 'تلفظ روان و خوش‌آهنگ',
		ru: 'Плавное произношение',
		zh: '发音朗朗上口',
	},
	phoneticStandard: {
		en: 'Standard Keystrokes',
		fa: 'ریتم استاندارد تایپ',
		ru: 'Стандартный набор символов',
		zh: '标准输入按键',
	},
	commercialIntentTitle: {
		en: 'Commercial Intent Index',
		fa: 'شاخص تمایل سرمایه‌گذاری تجاری',
		ru: 'Индекс коммерческого интереса',
		zh: '商业投资意向指数',
	},
	commercialIntentHigh: {
		en: 'Enterprise Acquisition Magnet',
		fa: 'جذابیت بالا برای خرید شرکتی',
		ru: 'Высокая ценность для компаний',
		zh: '企业级收购极佳标的',
	},
	commercialIntentMedium: {
		en: 'Moderate Commercial Appeal',
		fa: 'کشش تجاری متوسط',
		ru: 'Умеренный коммерческий спрос',
		zh: '中等商业号召力',
	},
	commercialIntentPersonal: {
		en: 'Individual / Creator Fit',
		fa: 'مناسب مقاصد شخصی و محتوایی',
		ru: 'Для личного использования',
		zh: '适合个人与创作者使用',
	},
	biddingWarTitle: {
		en: 'Bidding War Potential',
		fa: 'پتانسیل شعله‌ور شدن رقابت بیدها',
		ru: 'Потенциал войны ставок',
		zh: '竞价大战白热化潜力',
	},
	biddingWarExtreme: {
		en: 'HIGH VOLATILITY / OVERBID',
		fa: 'احتمال رقابت فشرده و افزایش بیدها',
		ru: 'ВЫСОКАЯ КОНКУРЕНЦИЯ СТАВОК',
		zh: '极高溢价竞拍潜能',
	},
	biddingWarModerate: {
		en: 'MODERATE COMPETITION',
		fa: 'رقابت متوسط خریداران',
		ru: 'УМЕРЕННАЯ КОНКУРЕНЦИЯ',
		zh: '中等竞拍竞争度',
	},
	biddingWarOrderly: {
		en: 'ORDERLY AUCTION',
		fa: 'حراج منظم و باثبات',
		ru: 'СПОКОЙНЫЙ АУКЦИОН',
		zh: '稳健常规拍卖',
	},
	auctionTacticsTitle: {
		en: 'Recommended Fragment Auction Tactics',
		fa: 'تاکتیک پیشنهادی حراج در فرگمنت',
		ru: 'Рекомендуемая тактика аукциона Fragment',
		zh: '建议的 Fragment 拍卖策略',
	},
	auctionTacticsAggressive: {
		en: 'Competitive reserve auction to trigger aggressive bidding wars',
		fa: 'حراج با قیمت پایه رقابتی جهت شعله‌ور کردن رقابت خریداران',
		ru: 'Аукцион с конкурентной стартовой ценой для разжигания войны ставок',
		zh: '设置具吸引力的竞拍底价以引发买家竞拍大战',
	},
	auctionTacticsBuyNow: {
		en: 'Fixed Buy-Now listing at rational upper-bound price target',
		fa: 'فروش مستقیم فوری با قیمت سقف منطقی',
		ru: 'Прямая продажа по фиксированной целевой цене',
		zh: '以合理上限目标价格进行即时一口价挂单出售',
	},
	auctionTacticsStandard: {
		en: 'Standard auction with measured reserve price',
		fa: 'مزایده استاندارد با رزرو معقول',
		ru: 'Стандартный аукцион с умеренным резервом',
		zh: '设定稳妥保留价的标准拍卖模式',
	},
	culturalResonanceTitle: {
		en: 'Cultural & Linguistic Resonance',
		fa: 'طنین فرهنگی و زبانی LAYA',
		ru: 'Культурный и языковой резонанс LAYA',
		zh: 'LAYA 跨文化与语言共鸣度',
	},
	universalWeb3: {
		en: 'Universal Global & Web3 High Alignment',
		fa: 'انطباق سراسری و جایگاه برتر در وب۳',
		ru: 'Универсальное глобальное признание в Web3',
		zh: '全球通用与 Web3 极高契合度',
	},
	legalMatrixTitle: {
		en: 'Telegram TOS & Trademark Liability',
		fa: 'ماتریس ریسک حقوقی تلگرام و توقیف',
		ru: 'Аудит рисков правил Telegram (TOS §4)',
		zh: 'Telegram 服务条款与商标侵权风险矩阵',
	},
	legalMatrixSubtitle: {
		en: 'Section 4 ToS Trademark & Seizure Risk Audit',
		fa: 'انطباق با علائم تجاری جهانی و بررسی ریسک سلب مالکیت',
		ru: 'Проверка торговых марок и риска изъятия по разделу 4',
		zh: '商标合规与第4条收回条款法律审计',
	},
	riskHigh: {
		en: 'HIGH RISK OF SEIZURE',
		fa: 'ریسک بالا / احتمال مصادره',
		ru: 'ВЫСОКИЙ РИСК ИЗЪЯТИЯ',
		zh: '高风险 / 存在被收回可能',
	},
	riskMedium: {
		en: 'MODERATE / CAUTION',
		fa: 'ریسک متوسط / احتیاط تجاری',
		ru: 'СРЕДНИЙ РИСК / ВНИМАНИЕ',
		zh: '中度风险 / 建议谨慎使用',
	},
	riskClean: {
		en: 'CLEAN / LOW RISK',
		fa: 'بدون ریسک / ایمن',
		ru: 'БЕЗОПАСНО / НИЗКИЙ РИСК',
		zh: '安全无虞 / 极低风险',
	},
	legalIndexTitle: {
		en: 'LEGAL LIABILITY INDEX',
		fa: 'شاخص ریسک حقوقی و مصادره',
		ru: 'ИНДЕКС ЮРИДИЧЕСКОГО РИСКА',
		zh: '法律责任与被收回指数',
	},
	directTrademarkMatch: {
		en: 'Direct Trademark Match',
		fa: 'تطابق مستقیم با علامت تجاری ثبت‌شده',
		ru: 'Прямое совпадение с зарегистрированным брендом',
		zh: '与已注册全球商标直接重合',
	},
	noInfringementDetected: {
		en: 'No Global Trademark Infringements Detected',
		fa: 'هیچ تخلف از علائم تجاری بین‌المللی یافت نشد',
		ru: 'Нарушений международных торговых марок не обнаружено',
		zh: '未检测到国际注册商标侵权冲突',
	},
	advisoryHigh: {
		en: 'This username directly overlaps with an internationally registered trademark. Under Section 4 of the official Telegram Terms of Service, Telegram reserves the unilateral right to reclaim names infringing upon protected corporate marks.',
		fa: 'این نام کاربری با یکی از علائم تجاری ثبت‌شده بین‌المللی هم‌پوشانی کامل دارد. طبق بند ۴ قوانین رسمی تلگرام، شرکت تلگرام حق استرداد نام را در صورت ادعای مالک برند برای خود محفوظ می‌دارد.',
		ru: 'Это имя пользователя полностью совпадает с международной зарегистрированной торговой маркой. Согласно разделу 4 официальных правил Telegram, администрация оставляет за собой право отозвать юзернейм в случае жалобы правообладателя.',
		zh: '该用户名与国际注册商标直接重合。根据 Telegram 官方服务条款第 4 条，Telegram 保留在商标权人主张权利时单方面收回域名的权利。',
	},
	advisoryMedium: {
		en: 'Partial resemblance to commercial entities detected. Recommended primarily for personal or independent use rather than conflicting enterprise branding.',
		fa: 'تشابه نسبی با اسامی و هویت‌های تجاری مشاهده شده است. توصیه می‌شود از این نام صرفاً برای مقاصد شخصی و مستقل استفاده گردد.',
		ru: 'Обнаружено частичное сходство с коммерческими брендами. Рекомендуется преимущественно для личного или независимого использования.',
		zh: '检测到与已知商业实体存在一定相似度。建议主要用于个人独立用途，避免用于同类商业竞争。',
	},
	advisoryClean: {
		en: 'No registered trademark conflicts detected. The asset is legally unencumbered and fully transferable across Telemint smart contracts.',
		fa: 'هیچ علامت تجاری انحصاری بین‌المللی با این نام تلاقی ندارد. انتقال و نگهداری این دارایی در بستر قراردادهای هوشمند بدون مانع حقوقی است.',
		ru: 'Конфликтов с зарегистрированными торговыми марками не обнаружено. Актив юридически чист и безопасно передается через смарт-контракты.',
		zh: '未发现任何国际注册商标冲突。资产法律风险极低，可在 Telemint 智能合约上安全持有与流转。',
	},
	section4BoxTitle: {
		en: 'TELEGRAM TERMS OF SERVICE — SECTION 4',
		fa: 'متن رسمی بند ۴ قوانین تلگرام',
		ru: 'ОФИЦИАЛЬНЫЕ ПРАВИЛА TELEGRAM — РАЗДЕЛ 4',
		zh: 'TELEGRAM 服务条款官方原文 — 第 4 条',
	},
	readOfficialTos: {
		en: 'Read on Telegram.org',
		fa: 'مطالعه در سایت رسمی تلگرام',
		ru: 'Читать на Telegram.org',
		zh: '在 Telegram 官网查看原文',
	},
	section4QuoteTitle: {
		en: 'Section 4 — Telegram Collectibles:',
		fa: 'بند ۴ — اقلام کلکسیونی تلگرام:',
		ru: 'Раздел 4 — Коллекционные активы Telegram:',
		zh: '第 4 条 — Telegram 收藏品：',
	},
	section4Quote: {
		en: '"Telegram reserves the right to reclaim any username, channel link, or collectible in the event of trademark infringement, fraud, copyright violations, or malicious squatting on globally recognized marks."',
		fa: '«تلگرام این حق را برای خود محفوظ می‌دارد که هرگونه نام کاربری، لینک کانال یا دارایی کلکسیونی را در صورت نقض علائم تجاری، کلاهبرداری، نقض کپی‌رایت یا تصاحب مغرضانه نشان‌های شناخته‌شده جهانی، سلب و مسترد نماید.»',
		ru: '«Telegram оставляет за собой право отозвать любое имя пользователя, ссылку на канал или коллекционный объект в случае нарушения прав на товарный знак, мошенничества, нарушения авторских прав или сквоттинга всемирно известных брендов».',
		zh: '“若发生商标侵权、欺诈、侵犯版权或对全球知名品牌的恶意抢注，Telegram 保留收回任何用户名、频道链接或收藏品的权利。”',
	},
	legalAnalysisTitle: {
		en: 'Legal Analysis & Implication:',
		fa: 'ترجمه و تحلیل حقوقی:',
		ru: 'Юридический анализ:',
		zh: '法律分析与释义：',
	},
	legalAnalysisText: {
		en: 'Even when collectibles are transferred on-chain via smart contracts, Telegram retains platform-level authority over the application client resolver. Handles infringing upon globally recognized corporate trademarks risk detachment from the messenger network.',
		fa: 'تلگرام صراحتاً در قوانین تصریح کرده است که حتی با انتقال نام کاربری بر روی بستر بلاکچین و ان‌اف‌تی‌های تلگرام، چنانچه نام کاربری ناقض نشان‌های تجاری معتبر بین‌المللی باشد، مسنجر تلگرام می‌تواند اتصال آن به پیام‌رسان را قطع نماید.',
		ru: 'Даже при переводе активов в блокчейн через смарт-контракты, Telegram сохраняет за собой контроль на уровне клиента мессенджера. Юзернеймы, нарушающие права известных брендов, могут быть отключены от сети Telegram.',
		zh: '即使收藏品已通过智能合约上链，Telegram 在客户端解析层面仍拥有最终控制权。侵犯全球知名品牌商标的用户名可能面临与通讯录服务断开连接的风险。',
	},
	buyerPersonasTitle: {
		en: 'Target Buyer Personas',
		fa: 'پرسونای خریداران هدف LAYA',
		ru: 'Целевые портреты покупателей LAYA',
		zh: 'LAYA 目标买家人群画像',
	},
	buyerPersonasSubtitle: {
		en: 'Algorithmically mapped archetypes and capital allocation patterns',
		fa: 'تفکیک هوشمند الگوهای جذب سرمایه و مشخصات مخاطبان بالقوه',
		ru: 'Алгоритмический анализ покупательских архетипов и капитала',
		zh: '基于资本规模与行业画像的算法匹配分类',
	},
	budgetPrefix: {
		en: 'Budget:',
		fa: 'بودجه:',
		ru: 'Бюджет:',
		zh: '预算：',
	},
	holdStylePrefix: {
		en: 'Holding Strategy:',
		fa: 'شیوه هولد:',
		ru: 'Стратегия удержания:',
		zh: '持有策略：',
	},
	urgencyPrefix: {
		en: 'Acquisition Urgency:',
		fa: 'فوریت خرید:',
		ru: 'Срочность покупки:',
		zh: '购买紧迫度：',
	},
	layaMatch: {
		en: 'LAYA Affinity Match',
		fa: 'تطابق پیشنهادی لایا',
		ru: 'Совпадение по LAYA',
		zh: 'LAYA 匹配推荐',
	},
	categoriesTitle: {
		en: 'LAYA Cognitive Semantic Categories',
		fa: 'دسته‌بندی‌های معنایی-شناختی LAYA',
		ru: 'Семантические категории LAYA',
		zh: 'LAYA 认知语义分类矩阵',
	},
	categoriesSubtitle: {
		en: 'Dynamic domain taxonomy with liquidity velocity and capital flows',
		fa: 'تحلیل حوزه‌های تخصصی به همراه سرعت نقدشوندگی و جریان سرمایه',
		ru: 'Классификация доменов со скоростью ликвидности и потоками капитала',
		zh: '基于流动性周转率与资本流向的动态域名分类体系',
	},
	speedInstant: {
		en: 'Instant',
		fa: 'فوری',
		ru: 'Мгновенно',
		zh: '极速秒出',
	},
	speedVeryFast: {
		en: 'Very Fast',
		fa: 'بسیار سریع',
		ru: 'Очень быстро',
		zh: '极其迅速',
	},
	speedFast: {
		en: 'Fast',
		fa: 'سریع',
		ru: 'Быстро',
		zh: '快速流转',
	},
	speedActive: {
		en: 'Active',
		fa: 'فعال',
		ru: 'Активно',
		zh: '正常流动',
	},
	speedRecord: {
		en: 'All-Time Record',
		fa: 'رکورد تاریخی',
		ru: 'Исторический рекорд',
		zh: '历史最高纪录',
	},
	targetBuyerPersona: {
		en: 'Target Buyer Persona:',
		fa: 'پرسونای اصلی خریدار:',
		ru: 'Основной портрет покупателя:',
		zh: '主要目标买家画像：',
	},
	valuateCta: {
		en: 'Valuate ↗',
		fa: 'ارزیابی ↗',
		ru: 'Оценить ↗',
		zh: '估值分析 ↗',
	},
};

export interface SemanticCategoryItem {
	id: string;
	title: LocalizedText;
	icon: string;
	color: string;
	badge: string;
	resonance: LocalizedText;
	targetPersona: LocalizedText;
	handles: {
		name: string;
		estTon: string;
		speedKey: keyof typeof USERNAME_I18N;
		tag: string;
	}[];
}

export const SEMANTIC_CATEGORIES: SemanticCategoryItem[] = [
	{
		id: 'crypto_web3',
		title: {
			en: 'Crypto & Web3 Native',
			fa: 'کریپتو و وب۳',
			ru: 'Криптовалюты и Web3',
			zh: '加密与 Web3 原生',
		},
		icon: 'currency_bitcoin',
		color: '#0098EA',
		badge: 'DEFI / TON NATIVE',
		resonance: {
			en: 'High-velocity liquidity anchored in TON ecosystem protocols & cross-chain DAOs.',
			fa: 'نقدینگی بالا، تقاضای ممتد از سمت فاندیشن‌ها و پروتکل‌های دیفای تون.',
			ru: 'Высокая ликвидность от протоколов экосистемы TON и кросс-чейн DAO.',
			zh: '深度依托 TON 生态协议与跨链 DAO 机构的超高流动性。',
		},
		targetPersona: {
			en: 'TON Whales & Protocol Founders',
			fa: 'نهنگ‌های اکوسیستم تون و بنیان‌گذاران استارتاپ وب۳',
			ru: 'Киты TON и основатели Web3-протоколов',
			zh: 'TON 巨鲸与协议创始人',
		},
		handles: [
			{ name: 'crypto', estTon: '350,000', speedKey: 'speedInstant', tag: 'Ultra Grail' },
			{ name: 'ton', estTon: '500,000', speedKey: 'speedInstant', tag: 'Ecosystem Core' },
			{ name: 'defi', estTon: '95,000', speedKey: 'speedVeryFast', tag: 'Protocol' },
			{ name: 'wallet', estTon: '280,000', speedKey: 'speedInstant', tag: 'Utility Tier 1' },
			{ name: 'dao', estTon: '68,000', speedKey: 'speedFast', tag: 'Governance' },
			{ name: 'swap', estTon: '75,000', speedKey: 'speedVeryFast', tag: 'DEX Grail' },
			{ name: 'vault', estTon: '42,000', speedKey: 'speedActive', tag: 'Treasury' },
			{ name: 'btc', estTon: '210,000', speedKey: 'speedInstant', tag: '3-Letter Apex' },
		],
	},
	{
		id: 'fintech_commerce',
		title: {
			en: 'FinTech & Global Commerce',
			fa: 'فین‌تک و تجارت بین‌الملل',
			ru: 'Финтех и мировая коммерция',
			zh: '金融科技与全球贸易',
		},
		icon: 'account_balance',
		color: '#10b981',
		badge: 'ENTERPRISE ASSET',
		resonance: {
			en: 'High commercial intent with enterprise-tier backing for Telegram payment gateways.',
			fa: 'تمایل تجاری سازمانی بسیار بالا جهت ساخت گیت‌وی‌های مالی و کارت‌های بانکی تلگرام.',
			ru: 'Высокий коммерческий интерес для создания платежных шлюзов в Telegram.',
			zh: '企业级顶级背书，适用于电报支付网关与清算服务。',
		},
		targetPersona: {
			en: 'FinTech Conglomerates & Payment Gateways',
			fa: 'موسسات مالی، نئوبانک‌ها و درگاه‌های پرداخت',
			ru: 'Финтех-корпорации и платежные шлюзы',
			zh: '金融财团与大型支付网关',
		},
		handles: [
			{ name: 'bank', estTon: '450,000', speedKey: 'speedInstant', tag: 'Banking Grail' },
			{ name: 'pay', estTon: '380,000', speedKey: 'speedInstant', tag: 'Payments' },
			{ name: 'cash', estTon: '120,000', speedKey: 'speedVeryFast', tag: 'Currency' },
			{ name: 'fund', estTon: '85,000', speedKey: 'speedFast', tag: 'Capital' },
			{ name: 'card', estTon: '92,000', speedKey: 'speedVeryFast', tag: 'Cards / Pay' },
			{ name: 'loan', estTon: '48,000', speedKey: 'speedActive', tag: 'Lending' },
			{ name: 'trade', estTon: '110,000', speedKey: 'speedFast', tag: 'Trading Desk' },
			{ name: 'market', estTon: '160,000', speedKey: 'speedVeryFast', tag: 'Marketplace' },
		],
	},
	{
		id: 'luxury_status',
		title: {
			en: 'Luxury & VIP Monikers',
			fa: 'لاکچری و پرستیژ اشرافی',
			ru: 'Люкс и VIP-статус',
			zh: '奢华与顶级 VIP 身份',
		},
		icon: 'diamond',
		color: '#f59e0b',
		badge: 'STATUS SYMBOL',
		resonance: {
			en: 'Peak social capital flex and status signaling for HNWIs and luxury collectors.',
			fa: 'سیگنال‌دهی اعتبار و ثروت، ماندگاری ذهنی در پروفایل‌های VIP و کلاب‌های اختصاصی.',
			ru: 'Максимальный статусный сигнал для состоятельных лиц и VIP-коллекционеров.',
			zh: '高净值人群与极品收藏家的顶层社交资本与威望象征。',
		},
		targetPersona: {
			en: 'High-Net-Worth Individuals & Prestige Brands',
			fa: 'سرمایه‌گذاران رده‌بالا و برندهای لوکس',
			ru: 'Крупные инвесторы и люксовые бренды',
			zh: '高净值个人与顶级奢侈品牌',
		},
		handles: [
			{ name: 'vip', estTon: '190,000', speedKey: 'speedInstant', tag: 'Prestige Grail' },
			{ name: 'rich', estTon: '98,000', speedKey: 'speedFast', tag: 'Status' },
			{ name: 'king', estTon: '140,000', speedKey: 'speedVeryFast', tag: 'Royalty' },
			{ name: 'gold', estTon: '175,000', speedKey: 'speedInstant', tag: 'Hard Asset' },
			{ name: 'club', estTon: '115,000', speedKey: 'speedFast', tag: 'Exclusive' },
			{ name: 'boss', estTon: '88,000', speedKey: 'speedActive', tag: 'Alpha Moniker' },
			{ name: 'elite', estTon: '72,000', speedKey: 'speedActive', tag: 'Tier 1 Status' },
			{ name: 'prime', estTon: '105,000', speedKey: 'speedVeryFast', tag: 'Supreme' },
		],
	},
	{
		id: 'pure_lexicon',
		title: {
			en: 'Pure Lexicon',
			fa: 'کلمات اصیل فرهنگ لغت',
			ru: 'Словарные слова',
			zh: '纯粹原生词典词',
		},
		icon: 'spellcheck',
		color: '#06b6d4',
		badge: 'DICTIONARY GRAIL',
		resonance: {
			en: 'Unmodified dictionary nouns and verbs with 10/10 phonetic clarity.',
			fa: 'واژه‌های اصیل تک‌سیلابی بدون تغییر با روانی تلفظ ۱۰ از ۱۰ و ماندگاری ابدی.',
			ru: 'Оригинальные словарные существительные с безупречной фонетикой 10/10.',
			zh: '未经修改的标准原意词汇，具备 10/10 的纯净发音与永恒留存度。',
		},
		targetPersona: {
			en: 'Domain Speculators & Brand Architects',
			fa: 'کلکسیونرهای حرفه‌ای دامین و نام‌های تجاری',
			ru: 'Доменные инвесторы и брендинговые агентства',
			zh: '极品域名投资人与品牌战略专家',
		},
		handles: [
			{ name: 'rare', estTon: '185,000', speedKey: 'speedVeryFast', tag: 'Dictionary' },
			{ name: 'dark', estTon: '95,000', speedKey: 'speedFast', tag: 'Dictionary' },
			{ name: 'fast', estTon: '110,000', speedKey: 'speedFast', tag: 'Dictionary' },
			{ name: 'blue', estTon: '85,000', speedKey: 'speedActive', tag: 'Color Word' },
			{ name: 'time', estTon: '220,000', speedKey: 'speedInstant', tag: 'Universal' },
			{ name: 'game', estTon: '310,000', speedKey: 'speedInstant', tag: 'Gaming Hub' },
			{ name: 'cool', estTon: '78,000', speedKey: 'speedActive', tag: 'Dictionary' },
			{ name: 'fire', estTon: '135,000', speedKey: 'speedVeryFast', tag: 'Viral Word' },
		],
	},
	{
		id: 'ai_tech',
		title: {
			en: 'Artificial Intelligence & Systems',
			fa: 'هوش مصنوعی و سیستم‌ها',
			ru: 'Искусственный интеллект и системы',
			zh: '人工智能与系统架构',
		},
		icon: 'smart_toy',
		color: '#8b5cf6',
		badge: 'EMERGING TECH',
		resonance: {
			en: 'High trending momentum for autonomous AI agents, copilot bots, and compute networks.',
			fa: 'روند صعودی و تقاضای سنگین سال‌های ۲۰۲۵ تا ۲۰۲۶ برای عوامل هوش مصنوعی و ربات‌های خودکار تلگرام.',
			ru: 'Взрывной тренд на автономных ИИ-агентов, умных ботов и вычислительные сети.',
			zh: '面向自主 AI 代理、自动化机器人与去中心化算力网络的爆发式增长红利。',
		},
		targetPersona: {
			en: 'AI Founders & MiniApp Autonomous Developers',
			fa: 'توسعه‌دهندگان مینی‌اپ‌ها و بات‌های هوشمند',
			ru: 'Создатели ИИ-проектов и автономных MiniApp',
			zh: 'AI 创业先锋与电报小程序开发者',
		},
		handles: [
			{ name: 'ai', estTon: '650,000', speedKey: 'speedInstant', tag: '2-Letter Tech' },
			{ name: 'bot', estTon: '290,000', speedKey: 'speedInstant', tag: 'Telegram Native' },
			{ name: 'gpt', estTon: '160,000', speedKey: 'speedVeryFast', tag: 'LLM Brand' },
			{ name: 'neural', estTon: '55,000', speedKey: 'speedActive', tag: 'Deep Learning' },
			{ name: 'agent', estTon: '125,000', speedKey: 'speedVeryFast', tag: 'AI Agent' },
			{ name: 'cyber', estTon: '82,000', speedKey: 'speedFast', tag: 'Security' },
			{ name: 'cloud', estTon: '140,000', speedKey: 'speedFast', tag: 'Infra' },
			{ name: 'data', estTon: '190,000', speedKey: 'speedVeryFast', tag: 'Data Core' },
		],
	},
	{
		id: 'media_channels',
		title: {
			en: 'Media & Viral Broadcast',
			fa: 'رسانه، خبر و کانال‌ها',
			ru: 'Медиа и вирусные каналы',
			zh: '大型媒体与病毒式频道',
		},
		icon: 'campaign',
		color: '#ec4899',
		badge: 'BROADCAST POWER',
		resonance: {
			en: 'Broadcast authority for telegram news networks, content aggregators, and viral channels.',
			fa: 'اقتدار سازمانی برای شبکه‌های توزیع خبر، کانال‌های سیگنال کریپتو و رسانه‌های جریان‌ساز.',
			ru: 'Медийный авторитет для новостных сетей Telegram, агрегаторов и крупных каналов.',
			zh: '电报新闻网络、顶级聚合矩阵与数百万级频道的权威信息分发资产。',
		},
		targetPersona: {
			en: 'Media Conglomerates & Telegram Channel Networks',
			fa: 'شبکه‌های رسانه‌ای و کانال‌های پرمخاطب تلگرام',
			ru: 'Медиахолдинги и сети Telegram-каналов',
			zh: '传媒集团与电报矩阵号主',
		},
		handles: [
			{ name: 'news', estTon: '994,000', speedKey: 'speedRecord', tag: 'All-Time Record' },
			{ name: 'media', estTon: '180,000', speedKey: 'speedVeryFast', tag: 'Broadcasting' },
			{ name: 'tv', estTon: '420,000', speedKey: 'speedInstant', tag: '2-Letter Global' },
			{ name: 'chat', estTon: '260,000', speedKey: 'speedInstant', tag: 'Messaging' },
			{ name: 'press', estTon: '95,000', speedKey: 'speedFast', tag: 'Publishing' },
			{ name: 'daily', estTon: '78,000', speedKey: 'speedActive', tag: 'Journal' },
			{ name: 'hub', estTon: '130,000', speedKey: 'speedVeryFast', tag: 'Community' },
			{ name: 'cast', estTon: '62,000', speedKey: 'speedActive', tag: 'Podcast' },
		],
	},
	{
		id: 'liquid_grails',
		title: {
			en: '4-Letter Geometric Grails',
			fa: '۴ حرفی‌های هندسی و نقدشونده',
			ru: '4-буквенные геометрические раритеты',
			zh: '4字母极品几何高流动性域名',
		},
		icon: 'grid_view',
		color: '#eab308',
		badge: 'ULTRA-LIQUID',
		resonance: {
			en: 'Universal floor price support, maximum typing fluidity, and global language neutrality.',
			fa: 'کف تاریخی قطعی در بازار فرگمنت، ارگونومی تایپ برق‌آسا و محبوبیت بین‌المللی فارغ از زبان.',
			ru: 'Стабильная поддержка цены, идеальная плавность набора и глобальная нейтральность.',
			zh: 'Fragment 二级市场坚实底价支撑，极致指法输入节奏，全语言中立。',
		},
		targetPersona: {
			en: 'Grail Flippers & Quantitative Collectors',
			fa: 'کلکسیونرهای حرفه‌ای و معامله‌گران نوسان‌گیر',
			ru: 'Флипперы раритетов и системные инвесторы',
			zh: '短线套利高手与量化数字收藏家',
		},
		handles: [
			{ name: 'apex', estTon: '115,000', speedKey: 'speedInstant', tag: 'Peak 4-Letter' },
			{ name: 'flow', estTon: '88,000', speedKey: 'speedVeryFast', tag: 'Fluidity' },
			{ name: 'meta', estTon: '240,000', speedKey: 'speedInstant', tag: 'Global Tech' },
			{ name: 'warp', estTon: '65,000', speedKey: 'speedFast', tag: 'Web3 / Speed' },
			{ name: 'byte', estTon: '105,000', speedKey: 'speedVeryFast', tag: 'Computing' },
			{ name: 'wave', estTon: '78,000', speedKey: 'speedFast', tag: 'Geometric' },
			{ name: 'drop', estTon: '92,000', speedKey: 'speedVeryFast', tag: 'Airdrop / Hype' },
			{ name: 'echo', estTon: '70,000', speedKey: 'speedActive', tag: 'Phonetic 10/10' },
		],
	},
];

// ══════════════════════════════════════════════════════════════════════
// 8 TARGET BUYER PERSONAS IN 4 LANGUAGES
// ══════════════════════════════════════════════════════════════════════

export interface PersonaData {
	id: string;
	title: LocalizedText;
	budgetRange: string;
	icon: string;
	color: string;
	rationale: LocalizedText;
	typicalHold: LocalizedText;
	urgency: LocalizedText;
}

export const BUYER_PERSONAS: PersonaData[] = [
	{
		id: 'ton_whale',
		title: {
			en: 'TON Ecosystem Whale',
			fa: 'نهنگ اکوسیستم تون',
			ru: 'Кит экосистемы TON',
			zh: 'TON 生态巨鲸',
		},
		budgetRange: '50,000+ TON',
		icon: 'water_drop',
		color: '#0098EA',
		rationale: {
			en: 'Early TON allocators and high-net-worth liquidity providers acquiring generational vanity grails regardless of short-term market swings.',
			fa: 'سرمایه‌گذاران اولیه بلاکچین تون با نقدینگی نامحدود؛ به دنبال دارایی‌های نمادین، کوتاه‌ترین نام‌ها و نگهداری بلندمدت بدون وابستگی به نوسانات مقطعی.',
			ru: 'Ранние инвесторы TON с крупным капиталом, приобретающие статусные активы на долгий срок независимо от рыночных колебаний.',
			zh: '拥有丰沛流动性的早期 TON 生态大户与巨鲸，专注收购顶级标志性短名，长期持有抗通胀。',
		},
		typicalHold: {
			en: 'Permanent HODL or DeFi Collateral',
			fa: 'نگهداری دائمی یا وثیقه در پلتفرم‌های وام‌دهی',
			ru: 'Бессрочное удержание или залог в DeFi',
			zh: '永久收藏或作为 DeFi 借贷抵押品',
		},
		urgency: {
			en: 'Decisive acquisition if identity matches status',
			fa: 'خرید قطعی در صورت تطابق با پرستیژ شخصی',
			ru: 'Быстрая покупка при соответствии статусу',
			zh: '若契合身份地位则极速高价竞得',
		},
	},
	{
		id: 'web3_founder',
		title: {
			en: 'Web3 & DeFi Protocol Founder',
			fa: 'بنیان‌گذار پروتکل و استارتاپ وب۳',
			ru: 'Основатель Web3 и DeFi стартапа',
			zh: 'Web3 与 DeFi 协议创始人',
		},
		budgetRange: '5,000 – 50,000 TON',
		icon: 'rocket_launch',
		color: '#10b981',
		rationale: {
			en: 'Creators of decentralized exchanges, bridges, and infrastructure requiring authoritative identity on Telegram for community credibility.',
			fa: 'سازندگان صرافی‌های غیرمتمرکز، کیف‌پول‌ها و پروتکل‌های زیرساختی وب۳؛ نیازمند نامی معتبر جهت جلب اعتماد کامیونیتی.',
			ru: 'Создатели DEX, мостов и инфраструктуры Web3, нуждающиеся в авторитетном имени для доверия аудитории.',
			zh: '去中心化交易所、跨链桥与钱包开发团队，急需具有官方权威感的顶级名称树立品牌公信力。',
		},
		typicalHold: {
			en: 'Permanent deployment as official handle',
			fa: 'استقرار دائمی به عنوان آدرس رسمی پروژه',
			ru: 'Постоянное использование как официальный адрес',
			zh: '作为项目官方主频道或合约永久使用',
		},
		urgency: {
			en: 'High, prioritized ahead of token launch',
			fa: 'بالا، پیش از راه‌اندازی رسمی توکن و کمپین‌ها',
			ru: 'Высокая, до публичного запуска токена',
			zh: '极高，通常在代币发售与宣发前完成收购',
		},
	},
	{
		id: 'media_network',
		title: {
			en: 'Media Network & Broadcast Hub',
			fa: 'شبکه رسانه‌ای و کانال تلگرام',
			ru: 'Медиасеть и крупные Telegram-каналы',
			zh: '媒体网络与高流量电报频道',
		},
		budgetRange: '2,500 – 25,000 TON',
		icon: 'campaign',
		color: '#ec4899',
		rationale: {
			en: 'Major news hubs and crypto signal channels where ultra-short memorable handles maximize search ranking conversion.',
			fa: 'کانال‌های خبری، رسانه‌های کریپتو و شبکه‌های سرگرمی با چند میلیون عضو؛ نام کوتاه و ماندگار نرخ ورودی سرچ تلگرام را به حداکثر می‌رساند.',
			ru: 'Крупные новостные и тематические каналы, где короткое имя напрямую повышает приток подписчиков из глобального поиска.',
			zh: '拥有数百万订阅的新闻平台与加密资讯网络，简短好记的标签能极大提升全局搜索转化率。',
		},
		typicalHold: {
			en: 'Core operational asset for organic reach',
			fa: 'استفاده عملیاتی دائمی جهت جذب مخاطب ارگانیک',
			ru: 'Операционный актив для органического охвата',
			zh: '用于持续获取自然搜索流量的核心运营资产',
		},
		urgency: {
			en: 'Driven by search ranking competition',
			fa: 'وابسته به رقابت در صدر نتایج جستجوی تلگرام',
			ru: 'Обусловлена конкуренцией в топе поиска',
			zh: '受全球搜索排名优先权竞争驱动',
		},
	},
	{
		id: 'domain_speculator',
		title: {
			en: 'Domain Speculator & Collector',
			fa: 'کلکسیونر دامین و سرمایه‌گذار نقدینگی',
			ru: 'Коллекционер доменов и инвестор',
			zh: '域名投机者与极品收藏家',
		},
		budgetRange: '1,000 – 15,000 TON',
		icon: 'sell',
		color: '#f59e0b',
		rationale: {
			en: 'Arbitrageurs and domain veterans targeting undervalued assets on Fragment for secondary resale or leasing yield.',
			fa: 'معامله‌گران باتجربه دامین و بازار فرگمنت؛ خرید نام‌هایی که زیر ارزش واقعی قیمت‌گذاری شده‌اند با هدف فروش با حاشیه سود یا اجاره.',
			ru: 'Инвесторы в домены, выкупающие недооцененные активы на Fragment для последующей перепродажи или сдачи в аренду.',
			zh: '资深域名投资者与套利买家，专门在二级市场上寻找被低估的资产以期翻倍转售或出租获益。',
		},
		typicalHold: {
			en: 'Medium-term hold (3–12 months)',
			fa: 'میان‌مدت (۳ تا ۱۲ ماه) تا تحقق هدف سودآوری',
			ru: 'Среднесрочно (3–12 месяцев) до целевой цены',
			zh: '中短期持有（3至12个月）直至达成利润目标',
		},
		urgency: {
			en: 'Opportunistic on discounts below fair value',
			fa: 'خرید سریع در صورت مشاهده قیمت پایین‌تر از ارزش واقعی',
			ru: 'Высокая при появлении хорошего дисконта',
			zh: '遇到低于公允估值的绝佳折扣时果断抄底',
		},
	},
	{
		id: 'miniapp_operator',
		title: {
			en: 'Telegram MiniApp & Bot Creator',
			fa: 'توسعه‌دهنده مینی‌اپ و بات تلگرام',
			ru: 'Разработчик MiniApp и ботов',
			zh: '电报小程序与机器人开发者',
		},
		budgetRange: '500 – 10,000 TON',
		icon: 'smart_toy',
		color: '#8b5cf6',
		rationale: {
			en: 'Gaming and automation developers optimizing viral invite links, inline bot queries, and seamless onboarding.',
			fa: 'توسعه‌دهندگان بازی‌های تلگرامی و مینی‌اپ‌ها؛ نیاز به نام هماهنگ برای لینک‌های دعوت ویروسی و بات‌های درون‌برنامه‌ای.',
			ru: 'Создатели игровых MiniApp и ботов, оптимизирующие вирусные ссылки-приглашения и инлайн-запросы.',
			zh: '轻量游戏与自动化工具开发者，优化病毒式邀请链接与内联机器人交互体验。',
		},
		typicalHold: {
			en: 'Full lifecycle of the application',
			fa: 'بلندمدت در طول چرخه حیات محصول',
			ru: 'На весь жизненный цикл проекта',
			zh: '贯穿产品整个运营生命周期',
		},
		urgency: {
			en: 'Immediate before user acquisition surges',
			fa: 'فوری پیش از کمپین‌های جذب کاربر گسترده',
			ru: 'Срочная покупка перед запуском трафика',
			zh: '在流量导入与大规模裂变推广前立即获取',
		},
	},
	{
		id: 'fintech_neobank',
		title: {
			en: 'FinTech & Payment Operator',
			fa: 'اپراتور فین‌تک و خدمات پرداخت',
			ru: 'Финтех-оператор и платежные сервисы',
			zh: '金融科技与支付运营商',
		},
		budgetRange: '10,000 – 100,000 TON',
		icon: 'account_balance',
		color: '#06b6d4',
		rationale: {
			en: 'Payment processors and virtual card providers deploying financial gateway handles for Telegram commerce.',
			fa: 'درگاه‌های پرداخت، کارت‌های اعتباری مجازی و پلتفرم‌های رمزارزی فعال در تجارت تلگرام.',
			ru: 'Платежные системы и провайдеры карт, запускающие шлюзы для электронной коммерции в Telegram.',
			zh: '为电报电商生态提供法币出入金、虚拟卡与加密网关结算的大型金融机构。',
		},
		typicalHold: {
			en: 'Permanent institutional asset',
			fa: 'دارایی نهادی دائمی بدون فروش مجدد',
			ru: 'Бессрочный корпоративный актив',
			zh: '作为机构级品牌资产永久持有',
		},
		urgency: {
			en: 'Strategic acquisition in quarterly budget',
			fa: 'برنامه‌ریزی استراتژیک در بودجه‌های سازمانی',
			ru: 'Стратегическая покупка по корпоративному бюджету',
			zh: '由季度战略预算驱动的确定性收购',
		},
	},
	{
		id: 'crypto_hedgefund',
		title: {
			en: 'Crypto Venture Fund',
			fa: 'صندوق پوشش ریسک کریپتو',
			ru: 'Крипто-венчурный фонд',
			zh: '加密对冲基金与风投机构',
		},
		budgetRange: '20,000 – 150,000 TON',
		icon: 'query_stats',
		color: '#6366f1',
		rationale: {
			en: 'Institutional funds accumulating premium digital real estate portfolios to hedge against sovereign currency depreciation.',
			fa: 'صندوق‌های سرمایه‌گذاری نهادی که سبدی از نام‌های کاربری ارزشمند را به عنوان املاک دیجیتال و دارایی ضدتورمی ذخیره می‌کنند.',
			ru: 'Институциональные фонды, накапливающие портфель цифровой недвижимости Telegram для защиты от инфляции.',
			zh: '将稀缺电报极品用户名视为“数字核心地产”纳入另类抗通胀资产组合的机构级基金。',
		},
		typicalHold: {
			en: 'Long-term portfolio reserve (3–5 years)',
			fa: 'ذخیره بلندمدت در سبد دارایی‌ها (۳ تا ۵ سال)',
			ru: 'Долгосрочный резерв (3–5 лет)',
			zh: '长线资产配置储备（3至5年）',
		},
		urgency: {
			en: 'Market dips and floor sweeps',
			fa: 'جمع‌آوری پیوسته در کف‌های قیمتی بازار',
			ru: 'Выкуп на просадках рынка',
			zh: '在市场出现回调与低迷期批量扫货',
		},
	},
	{
		id: 'cyber_security',
		title: {
			en: 'Cyber Security & Privacy Firm',
			fa: 'شرکت امنیت سایبری و حریم خصوصی',
			ru: 'Компания кибербезопасности',
			zh: '网络安全与隐私保护机构',
		},
		budgetRange: '3,000 – 30,000 TON',
		icon: 'security',
		color: '#14b8a6',
		rationale: {
			en: 'Auditing companies, VPN services, and white-hat teams prioritizing clean authoritative naming for threat advisories.',
			fa: 'تیم‌های امنیتی، سرویس‌های حفظ حریم خصوصی و کانال‌های هشدارهای امنیتی؛ نیاز به نامی مقتدر جهت اعلام گزارش‌های رسمی.',
			ru: 'Аудиторы безопасности, VPN-сервисы и аналитики угроз, ценящие авторитетность для публикации отчетов.',
			zh: '智能合约审计团队、白帽黑客平台及隐私保护服务商，依赖高辨识度名称发布权威预警。',
		},
		typicalHold: {
			en: 'Core security bulletin identity',
			fa: 'هویت پایدار کانال رسمی اطلاع‌رسانی',
			ru: 'Основной канал оповещений по безопасности',
			zh: '作为不可侵犯的官方安全快报发布源',
		},
		urgency: {
			en: 'High to prevent brand impersonation',
			fa: 'بالا جهت جلوگیری از فیشینگ و جعل هویت',
			ru: 'Высокая для защиты от фишинга и подделок',
			zh: '极高，旨在彻底杜绝网络钓鱼与身份冒充',
		},
	},
];

// ══════════════════════════════════════════════════════════════════════
// NUMBERS & GIFTS I18N
// ══════════════════════════════════════════════════════════════════════

export const NUMBERS_I18N = {
	culturalHeatmapTitle: {
		en: 'LAYA 4-Region Cultural Radar Heatmap',
		fa: 'رادار حرارتی فرهنگی ۴ منطقه‌ای لایا',
		ru: 'Тепловая карта 4-х культурных зон LAYA',
		zh: 'LAYA 四大文化区域雷达热力图',
	},
	culturalHeatmapSubtitle: {
		en: 'Cross-cultural numerology affinity and regional market clearing rates',
		fa: 'سنجش تقاضا، اعداد شانس و ارزش‌گذاری منطقه‌ای شماره‌های ناشناس',
		ru: 'Кросс-культурная нумерология и региональный рыночный спрос',
		zh: '跨文化数字命理共鸣与区域市场结算溢价率',
	},
	affinityTitle: {
		en: 'Cultural Numerology Dynamics:',
		fa: 'ویژگی‌های فرهنگی و عددی:',
		ru: 'Нумерологическая специфика:',
		zh: '文化数字心理特征：',
	},
	marketDemandTitle: {
		en: 'Regional Liquidity Demand:',
		fa: 'سطح تقاضای منطقه‌ای:',
		ru: 'Региональный спрос:',
		zh: '区域流动性需求：',
	},
	favoriteDigits: {
		en: 'Lucky Digits:',
		fa: 'اعداد محبوب:',
		ru: 'Счастливые цифры:',
		zh: '吉利偏好数字：',
	},
	avoidDigits: {
		en: 'Avoided Digits:',
		fa: 'اعداد نامطلوب:',
		ru: 'Нежелательные цифры:',
		zh: '避讳回避数字：',
	},
	samplePatterns: {
		en: 'Prime Pattern Examples:',
		fa: 'نمونه الگوهای برتر:',
		ru: 'Примеры лучших паттернов:',
		zh: '典型极品模式示例：',
	},
	financialEngineeringTitle: {
		en: 'Transaction Financial Engineering',
		fa: 'مهندسی مالی معامله در فرگمنت',
		ru: 'Финансовый инжиниринг сделки Fragment',
		zh: 'Fragment 交易金融工程精算',
	},
	financialEngineeringSubtitle: {
		en: 'Net seller proceeds after protocol commission & rational bid thresholds',
		fa: 'محاسبه خالص دریافتی فروشنده پس از کسر کارمزد و سقف بید عقلایی',
		ru: 'Чистая выручка продавца за вычетом комиссии и порог рациональной ставки',
		zh: '扣除协议佣金后的卖家净所得与理性最高出价阈值',
	},
	grossFairValue: {
		en: 'GROSS FAIR VALUE',
		fa: 'ارزش ناخالص منصفانه',
		ru: 'СПРАВЕДЛИВАЯ СТОИМОСТЬ',
		zh: '公允毛估值',
	},
	protocolFee: {
		en: 'FRAGMENT FEE (5%)',
		fa: 'کارمزد فرگمنت (۵٪)',
		ru: 'КОМИССИЯ FRAGMENT (5%)',
		zh: 'FRAGMENT 协议费 (5%)',
	},
	minFeeNotice: {
		en: 'Min 5 TON per transaction',
		fa: 'حداقل کارمزد: ۵ TON',
		ru: 'Мин. 5 TON за сделку',
		zh: '每笔交易最低 5 TON',
	},
	netSellerProceeds: {
		en: 'NET SELLER PROCEEDS',
		fa: 'خالص دریافتی نهایی فروشنده',
		ru: 'ЧИСТАЯ ВЫРУЧКА ПРОДАВЦА',
		zh: '卖家最终实际净收益',
	},
	maxRationalBid: {
		en: 'MAX RATIONAL BID (85%)',
		fa: 'سقف بید عقلایی (۸۵٪)',
		ru: 'МАКС. РАЦИОНАЛЬНАЯ СТАВКА',
		zh: '理性最高出价上限 (85%)',
	},
	recStartBid: {
		en: 'Recommended Fragment Auction Reserve:',
		fa: 'قیمت پیشنهادی شروع در حراج فرگمنت:',
		ru: 'Рекомендуемый старт на аукционе Fragment:',
		zh: '建议的 Fragment 拍卖起拍底价：',
	},
	digitalCertTitle: {
		en: 'DIGITAL VALUATION CERTIFICATE',
		fa: 'گواهی دیجیتال ارزش‌گذاری',
		ru: 'ЦИФРОВОЙ СЕРТИФИКАТ ОЦЕНКИ',
		zh: '数字加密估值证书',
	},
	digitalCertSubtitle: {
		en: 'HMAC-SHA256 Cryptographic proof of valuation integrity',
		fa: 'امضای یکتای ضدجعل بر پایه هش HMAC-SHA256',
		ru: 'Криптографическое доказательство подлинности HMAC-SHA256',
		zh: '基于 HMAC-SHA256 防伪哈希的防篡改证明',
	},
	certVerified: {
		en: 'AUTHENTICATED PROOF',
		fa: 'اصالت تاییدشده',
		ru: 'ПОДЛИННОСТЬ ПОДТВЕРЖДЕНА',
		zh: '已通过加密鉴真',
	},
	copyCertId: {
		en: 'Copy ID',
		fa: 'کپی شناسه',
		ru: 'Копировать ID',
		zh: '复制序列号',
	},
	copied: {
		en: 'Copied!',
		fa: 'کپی شد!',
		ru: 'Скопировано!',
		zh: '已复制！',
	},
	demandAffinity: {
		en: 'Demand Affinity:',
		fa: 'کشش تقاضا:',
		ru: 'Спрос региона:',
		zh: '区域需求热度：',
	},
	auspiciousDigits: {
		en: 'Auspicious Digits:',
		fa: 'ارقام خوش‌یمن و محبوب:',
		ru: 'Счастливые цифры:',
		zh: '吉利偏好数字：',
	},
	avoidedDigits: {
		en: 'Avoided Digits:',
		fa: 'ارقام نامطلوب / اجتنابی:',
		ru: 'Нежелательные цифры:',
		zh: '避讳回避数字：',
	},
	noAvoided: {
		en: 'None',
		fa: 'بدون منع',
		ru: 'Нет',
		zh: '无避讳',
	},
	iconicPattern: {
		en: 'Iconic Pattern:',
		fa: 'نمونه الگوی شاخص:',
		ru: 'Эталонный паттерн:',
		zh: '典型极品范例：',
	},
	clubFloorsTitle: {
		en: 'Collectible Club Tier Floors',
		fa: 'ردیاب کف قیمت کلاب‌های شماره',
		ru: 'Минимальные цены клубов номеров',
		zh: '收藏家数字俱乐部底价雷达',
	},
	clubFloorsSubtitle: {
		en: 'Dynamic supply, floor prices & historical ATH records',
		fa: 'پایش لحظه‌ای عرضه، کف قیمت و رکورد فروش',
		ru: 'Мониторинг предложения, цен и исторических рекордов',
		zh: '实时监控稀缺存量、底价与历史最高成交纪录',
	},
	totalInWorld: {
		en: 'total supply',
		fa: 'عدد در جهان',
		ru: 'всего выпущено',
		zh: '全球总发行量',
	},
	floorAsk: {
		en: 'Floor Ask',
		fa: 'کف قیمت فعلی',
		ru: 'Мин. цена (Floor)',
		zh: '当前地板价',
	},
	topSaleAth: {
		en: 'Top Sale ATH',
		fa: 'رکورد معامله (ATH)',
		ru: 'Рекордная сделка (ATH)',
		zh: '历史最高成交',
	},
	sampleNumber: {
		en: 'Sample Number',
		fa: 'نمونه شاخص',
		ru: 'Пример номера',
		zh: '典型示例号码',
	},
	tapToValuate: {
		en: 'Tap to valuate',
		fa: 'کلیک برای ارزیابی',
		ru: 'Нажмите для оценки',
		zh: '点击立即估值',
	},
	ergonomicsTitle: {
		en: 'LAYA Dialpad Ergonomics Score',
		fa: 'شاخص ارگونومی پد شماره‌گیر لایا',
		ru: 'Индекс эргономики набора LAYA',
		zh: 'LAYA 拨号键盘工效学评分',
	},
	ergonomicsSubtitle: {
		en: 'Single-thumb travel distance & keypad symmetry',
		fa: 'فاصله حرکت شست، تقارن و ریتم کیپد',
		ru: 'Траектория движения пальца и симметрия клавиатуры',
		zh: '单手拇指滑动距离与键盘对称几何节奏',
	},
	cadenceTitle: {
		en: 'ERGONOMICS & CADENCE',
		fa: 'امتیاز ارگونومی و سرعت تایپ',
		ru: 'ЭРГОНОМИКА И ТЕМП',
		zh: '输入工效学与敲击节奏',
	},
	activeKeys: {
		en: 'Active Keys:',
		fa: 'تعداد کلیدهای فعال:',
		ru: 'Задействовано клавиш:',
		zh: '已激活按键数量：',
	},
	muscleMemory: {
		en: 'Muscle Memory:',
		fa: 'حفظ در حافظه عضلانی:',
		ru: 'Мышечная память:',
		zh: '肌肉记忆易记度：',
	},
	muscleMemoryElite: {
		en: 'Ultra Elite',
		fa: 'بسیار بالا و روان',
		ru: 'Превосходная',
		zh: '极致极简',
	},
	muscleMemoryStandard: {
		en: 'Standard',
		fa: 'متوسط و استاندارد',
		ru: 'Стандартная',
		zh: '常规普通',
	},
	thumbZeroTravel: {
		en: 'Near-Zero Thumb Travel',
		fa: 'حرکت شست صفر / تایپ صاعقه‌ای',
		ru: 'Минимальное смещение пальца',
		zh: '单指极速定点敲击',
	},
	thumbFluidTravel: {
		en: 'Fluid Minimalist Strokes',
		fa: 'مسیر کوتاه و روان',
		ru: 'Плавный компактный набор',
		zh: '极佳流线型输入路径',
	},
	thumbStandardTravel: {
		en: 'Standard Dialpad Traversal',
		fa: 'حرکت استاندارد روی پد',
		ru: 'Стандартное движение по клавиатуре',
		zh: '常规全键盘移动输入',
	},
	defiCollateralTitle: {
		en: 'DeFi Collateral & Rental Yield',
		fa: 'تراز مالی دیفای و استخر اجاره شماره‌ها',
		ru: 'DeFi обеспечение и доход от аренды',
		zh: 'DeFi 质押借贷与号码租赁收益池',
	},
	defiCollateralSubtitle: {
		en: 'On-chain borrowing capacity & passive rental yield',
		fa: 'وام‌گیری آن‌چین و درآمد غیرفعال ماهانه',
		ru: 'Ончейн-кредитование и пассивный доход от сдачи в аренду',
		zh: '链上超额抵押借贷授信与每月被动租金收益',
	},
	monthlyRental: {
		en: 'MONTHLY RENTAL',
		fa: 'بازده اجاره ماهانه',
		ru: 'МЕСЯЧНАЯ АРЕНДА',
		zh: '每月租金收益',
	},
	rentalYieldDesc: {
		en: 'Passive cashflow via Telegram official desk rentals',
		fa: 'قابلیت اجاره جهت خطوط رسمی پشتیبانی تلگرام و ربات‌ها',
		ru: 'Пассивный доход от аренды для поддержки и ботов Telegram',
		zh: '为 Telegram 官方客服号与企业机器人提供稳定被动现金流',
	},
	collateralLtv: {
		en: 'COLLATERAL LTV',
		fa: 'سقف وثیقه وام',
		ru: 'КРЕДИТНОЕ ПЛЕЧО (LTV)',
		zh: '最大质押借贷率 (LTV)',
	},
	collateralDesc: {
		en: 'Non-custodial borrowing without parting with NFT ownership',
		fa: 'امکان دریافت وام بدون فروش شماره با توکن‌های TON / USDT',
		ru: 'Кредитование без потери права собственности на NFT-номер',
		zh: '无需卖掉 NFT 号码即可获得即时流动性借贷资金',
	},
	perMonth: {
		en: '/ month',
		fa: '/ ماه',
		ru: '/ мес.',
		zh: '/ 月',
	},
	instantBorrowing: {
		en: 'instant borrowing credit',
		fa: 'اعتبار نقدی فوری',
		ru: 'быстрый кредитный лимит',
		zh: '即时授信额度',
	},
	singleCulturalTitle: {
		en: 'LAYA 4-Region Cultural Radar',
		fa: 'رادار فرهنگی چندمنطقه‌ای LAYA',
		ru: 'Культурный радар 4 регионов LAYA',
		zh: 'LAYA 四大文化区域综合雷达',
	},
	singleCulturalSubtitle: {
		en: 'Regional numerology & buyer prestige index',
		fa: 'کشش تقاضا در بازارهای کلیدی چین، خاورمیانه و CIS',
		ru: 'Нумерология и престиж в ключевых регионах мира',
		zh: '大中华区、中东与独联体核心市场买家命理溢价指数',
	},
	layaCulturalVerdict: {
		en: 'Laya Cultural Verdict:',
		fa: 'جمع‌بندی هوش فرهنگی لایا:',
		ru: 'Культурный вердикт Laya:',
		zh: 'Laya 跨文化智能判词：',
	},
	layaCulturalDefaultSummary: {
		en: 'High regional affinity with strong appeal across secondary market buyers on Fragment.',
		fa: 'توالی ارقام دارای کشش منطقه‌ای بالا بوده و هماهنگی قابل توجهی با ترجیحات خریداران وب۳ و سرمایه‌گذاران بین‌المللی نشان می‌دهد.',
		ru: 'Высокий региональный спрос и отличная привлекательность среди покупателей вторичного рынка Fragment.',
		zh: '该号码在多个核心市场具备极高的文化亲和力与收藏级买家追捧热度。',
	},
	uniqueCertificateId: {
		en: 'Unique Certificate ID:',
		fa: 'شناسه یکتای گواهینامه:',
		ru: 'Уникальный ID сертификата:',
		zh: '证书唯一识别序列号：',
	},
	engineLabel: {
		en: 'Engine',
		fa: 'مدل ارزش‌گذار',
		ru: 'Движок оценки',
		zh: '估值算法引擎',
	},
	confidenceLabel: {
		en: 'Confidence',
		fa: 'ضریب اطمینان',
		ru: 'Уверенность',
		zh: '置信度',
	},
	timestampLabel: {
		en: 'Timestamp',
		fa: 'تاریخ صدور',
		ru: 'Дата выдачи',
		zh: '核发日期',
	},
};

export interface RegionalCulturalIntelItem {
	id: string;
	region: LocalizedText;
	affinity: LocalizedText;
	score: number;
	favoriteDigits: string[];
	avoidDigits: string[];
	marketDemand: LocalizedText;
	icon: string;
	color: string;
	samplePattern: string;
}

export const REGIONAL_CULTURAL_DATA: RegionalCulturalIntelItem[] = [
	{
		id: 'china_east_asia',
		region: {
			en: 'China & East Asia',
			fa: 'چین و آسیای شرقی',
			ru: 'Китай и Восточная Азия',
			zh: '中国与东亚市场',
		},
		affinity: {
			en: 'High affinity for 8 (Wealth) & 6 (Smooth Flow); strict avoidance of 4 (Tetraphobia).',
			fa: 'شیفتگی به عدد ۸ (نماد ثروت) و عدد ۶ (جریان روان)؛ اجتناب شدید از عدد ۴ (تترافوبیا).',
			ru: 'Культ цифры 8 (богатство) и 6 (гладкий путь); строгое избегание цифры 4 (тетрафобия).',
			zh: '极其推崇数字 8（发财致富）与 6（六六大顺）；严厉避讳数字 4（谐音不吉）。',
		},
		score: 96,
		favoriteDigits: ['8', '6', '9'],
		avoidDigits: ['4'],
		marketDemand: {
			en: 'Extreme bidding on 4-free patterns with repeating 8s.',
			fa: 'بسیار بالا برای الگوهای بدون ۴ دارای تکرار ۸۸۸۸.',
			ru: 'Максимальный интерес к номерам без 4 с повторяющимися восьмерками.',
			zh: '对纯 8 豹子号及绝无数字 4 的靓号具备极高竞价买盘。',
		},
		icon: 'temple_buddhist',
		color: '#ef4444',
		samplePattern: '+888 8888 8888 / +888 6688 8866',
	},
	{
		id: 'mena_arab',
		region: {
			en: 'Middle East & Arab Gulf',
			fa: 'خاورمیانه و خلیج فارس',
			ru: 'Ближний Восток и Персидский залив',
			zh: '中东与海湾地区',
		},
		affinity: {
			en: 'Prestige VIP mobile codes, clean mirror symmetry, and golden repeat pairs.',
			fa: 'تقاضای شماره‌های رند VIP، کدهای طلایی جفت، تقارن آینه‌ای و توالی‌های تمیز تلفن همراه.',
			ru: 'Престижные VIP-коды, зеркальная симметрия и золотые повторяющиеся пары.',
			zh: '追捧尊贵 VIP 手机靓号、严格对称镜像与顶级重叠双数对。',
		},
		score: 91,
		favoriteDigits: ['7', '0', '1', '5'],
		avoidDigits: [],
		marketDemand: {
			en: 'Highest per-item cash price clearance for symmetric vanity.',
			fa: 'بالاترین میانگین پرداخت دلاری برای شماره‌های متقارن و رند.',
			ru: 'Самые высокие долларовые чеки за симметричные и статусные номера.',
			zh: '对极度对称与极品连号拥有全球最高单件美金结账承接力。',
		},
		icon: 'mosque',
		color: '#0098EA',
		samplePattern: '+888 0707 0707 / +888 1000 0001',
	},
	{
		id: 'russia_cis',
		region: {
			en: 'Russia & Eastern Europe',
			fa: 'روسیه و اروپای شرقی',
			ru: 'Россия и Восточная Европа',
			zh: '俄罗斯与东欧独联体',
		},
		affinity: {
			en: 'Nostalgic telecom dial codes, luxury vehicle plate mirrors, and triple clusters.',
			fa: 'کدهای اپراتورهای نام‌آشنا، تقارن پلاک خودروهای اشرافی و تکرار سه‌تایی.',
			ru: 'Узнаваемые коды операторов, автомобильные "красивые" номера и тройные кластеры.',
			zh: '钟情熟悉的高端运营商前缀、豪车车牌镜像及三连重叠数字。',
		},
		score: 84,
		favoriteDigits: ['7', '9', '0', '3'],
		avoidDigits: [],
		marketDemand: {
			en: 'Continuous high-frequency secondary trade volume.',
			fa: 'نقدینگی دائمی با سرعت گردش معامله بالا در فرگمنت.',
			ru: 'Постоянная высокая ликвидность и частый оборот на вторичном рынке.',
			zh: '二级市场上拥有持续高频次换手与稳健流动性。',
		},
		icon: 'fort',
		color: '#10b981',
		samplePattern: '+888 7999 9997 / +888 0950 0095',
	},
	{
		id: 'west_crypto',
		region: {
			en: 'Western & Crypto Natives',
			fa: 'غرب و جامعه کریپتو',
			ru: 'Западные рынки и крипто-сообщество',
			zh: '西方市场与 Web3 原生群体',
		},
		affinity: {
			en: 'Binary dual-digits (0 & 1), Fibonacci sequences, and sub-1000 Genesis codes.',
			fa: 'الگوهای باینری (۰ و ۱)، اعداد پیوسته فیبوناچی و شناسه‌های گنسیس.',
			ru: 'Двоичные коды (0 и 1), последовательности Фибоначчи и номера Genesis до 1000.',
			zh: '偏好二进制（0 与 1）、斐波那契数列及 1000 以内的创世 Genesis 极简号。',
		},
		score: 88,
		favoriteDigits: ['0', '1', '4', '2'],
		avoidDigits: [],
		marketDemand: {
			en: 'Appetite for mathematical brevity & 4-digit Genesis clubs.',
			fa: 'تمرکز روی کمیابی ریاضی محض و شناسه‌های ۴ رقمی گنسیس.',
			ru: 'Спрос на математическую краткость и 4-значные номера Genesis.',
			zh: '专注纯粹的数学稀缺度与 4 位数创世俱乐部资产。',
		},
		icon: 'terminal',
		color: '#f59e0b',
		samplePattern: '+888 0101 0101 / +888 0042',
	},
];

export interface NumberClubTierItem {
	id: string;
	title: LocalizedText;
	floorTon: number;
	floorUsd: number;
	totalSupply: number;
	topSaleTon: number;
	icon: string;
	color: string;
	description: LocalizedText;
	sampleNumber: string;
}

export const NUMBER_CLUB_TIERS: NumberClubTierItem[] = [
	{
		id: 'genesis_4digit',
		title: {
			en: 'Genesis 4-Digit Club',
			fa: 'کلاب ۴ رقمی گنسیس',
			ru: 'Клуб 4-значных номеров Genesis',
			zh: '创世 4 位数俱乐部',
		},
		floorTon: 240,
		floorUsd: 1320,
		totalSupply: 10000,
		topSaleTon: 15500,
		icon: 'stars',
		color: '#ffaa00',
		description: {
			en: 'The original 4-digit Genesis tier minted in Dec 2022 (+888 0000 to +888 9999).',
			fa: 'اولین شماره‌های ضرب‌شده در دسامبر ۲۰۲۲ با طول ۴ رقم (+888 0000 تا +888 9999).',
			ru: 'Оригинальные 4-значные номера Genesis, выпущенные в декабре 2022 (+888 0000 — +888 9999).',
			zh: '2022 年 12 月发行的首批 4 位数创世号码（+888 0000 至 +888 9999）。',
		},
		sampleNumber: '+888 0888',
	},
	{
		id: 'octa_club',
		title: {
			en: 'Octa Monodigit Club',
			fa: 'کلاب اکتا تک‌رقمی',
			ru: 'Клуб 8 одинаковых цифр (Octa)',
			zh: '八连同号至尊俱乐部',
		},
		floorTon: 2800,
		floorUsd: 15400,
		totalSupply: 10,
		topSaleTon: 45000,
		icon: 'military_tech',
		color: '#ef4444',
		description: {
			en: 'Extremely scarce numbers with 8 identical repeating digits (Holy Grail).',
			fa: 'شماره‌های دارای ۸ رقم کاملاً یکسان؛ فوق‌نایاب‌ترین و گران‌ترین کلکسیون تلگرام.',
			ru: 'Редчайшие номера из 8 одинаковых цифр подряд — главный Грааль экосистемы.',
			zh: '拥有 8 位连续完全相同数字的极品孤品神作（仅 10 席存在）。',
		},
		sampleNumber: '+888 8888 8888',
	},
	{
		id: 'vanity_doubles',
		title: {
			en: 'Vanity Doubles & Mirrors',
			fa: 'کلاب جفت‌های متقارن',
			ru: 'Клуб парных и зеркальных номеров',
			zh: '连双与对称镜像俱乐部',
		},
		floorTon: 75,
		floorUsd: 412,
		totalSupply: 4500,
		topSaleTon: 3200,
		icon: 'swap_horiz',
		color: '#0098EA',
		description: {
			en: 'Symmetric paired patterns with high visual rhythm and cadence.',
			fa: 'الگوهای جفت‌جفت متقارن (مانند AABBCCDD یا ABABCDCD) با روانی تایپ بسیار بالا.',
			ru: 'Симметричные парные паттерны (AABBCCDD, ABABCDCD) с идеальной ритмикой.',
			zh: '成双成对或镜像对称（如 AABBCCDD、ABABCDCD），敲击节奏极佳。',
		},
		sampleNumber: '+888 0011 2233',
	},
	{
		id: 'sequential_steppers',
		title: {
			en: 'Sequential Steppers Club',
			fa: 'کلاب پله‌ای صعودی و نزولی',
			ru: 'Клуб лесенка (Steppers)',
			zh: '顺子顺增递减俱乐部',
		},
		floorTon: 120,
		floorUsd: 660,
		totalSupply: 1200,
		topSaleTon: 4800,
		icon: 'stairs',
		color: '#10b981',
		description: {
			en: 'Pure ascending or descending sequences with high recall velocity.',
			fa: 'توالی‌های ترتیبی ریاضی صعودی یا نزولی که به راحتی در حافظه ثبت می‌شوند.',
			ru: 'Чистые возрастающие или убывающие числовые ряды с мгновенной запоминаемостью.',
			zh: '标准递增或递减数字顺子，过目难忘，极具辨识度。',
		},
		sampleNumber: '+888 1234 5678',
	},
	{
		id: 'sub_1000',
		title: {
			en: 'Sub-1000 Low Numbers',
			fa: 'کلاب شماره‌های زیر ۱۰۰۰',
			ru: 'Клуб номеров до 1000',
			zh: '千号以内至臻俱乐部',
		},
		floorTon: 550,
		floorUsd: 3025,
		totalSupply: 999,
		topSaleTon: 18000,
		icon: 'workspace_premium',
		color: '#a855f7',
		description: {
			en: 'Ultra-low prefix numbers (+888 0001 to +888 0999) held by early adopters.',
			fa: 'شماره‌های ۳ رقمی با پیشوند صفر (+888 0001 تا +888 0999)؛ دارایی تاریخی تلگرام.',
			ru: 'Ультра-короткие номера (+888 0001 — +888 0999), сохраненные первыми пользователями.',
			zh: '超短历史龙头号码（+888 0001 至 +888 0999），具备历史文物级价值。',
		},
		sampleNumber: '+888 0042',
	},
];

export const GIFTS_I18N = {
	arbitrageRadarTitle: {
		en: 'Cross-Market Arbitrage & Wash-Trade Radar',
		fa: 'رادار آربیتراژ بین‌مارکت و فیلتر معاملات صوری',
		ru: 'Кросс-маркет арбитраж и радар фиктивных сделок',
		zh: '跨市场套利与虚假洗盘交易雷达',
	},
	arbitrageRadarSubtitle: {
		en: 'Real-time multi-venue price spreads with wash-trading anomaly filter',
		fa: 'کشف اختلاف قیمت زنده میان مارکت‌ها با حذف حجم‌های ساختگی',
		ru: 'Мониторинг цен между площадками с фильтрацией фиктивного объема',
		zh: '多交易平台实时价差比对与异常虚增交易过滤',
	},
	spreadDetected: {
		en: 'ACTIVE ARBITRAGE SPREAD DETECTED',
		fa: 'فرصت سود بدون ریسک آربیتراژ کشف شد',
		ru: 'ОБНАРУЖЕНА АРБИТРАЖНАЯ ВОЗМОЖНОСТЬ',
		zh: '检测到活跃无风险跨市场套利窗口',
	},
	buyOn: {
		en: 'Buy on',
		fa: 'خرید از',
		ru: 'Купить на',
		zh: '买入平台',
	},
	sellOn: {
		en: 'Sell on',
		fa: 'فروش در',
		ru: 'Продать на',
		zh: '卖出平台',
	},
	netRoi: {
		en: 'NET ROI AFTER FEES',
		fa: 'سود خالص نهایی',
		ru: 'ЧИСТАЯ ПРИБЫЛЬ С УЧЕТОМ КОМИССИЙ',
		zh: '扣除全部税费后的纯利润率',
	},
	organicFloor: {
		en: 'LAYA VERIFIED ORGANIC FLOOR',
		fa: 'کف قیمت ارگانیک تاییدشده LAYA',
		ru: 'ОРГАНИЧЕСКИЙ FLOOR ПО ДАННЫМ LAYA',
		zh: 'LAYA 算法鉴定的真实有机底价',
	},
	organicFloorSubtitle: {
		en: 'Excludes simulated wash-trading volume',
		fa: 'حذف سفارشات ساختگی و معاملات صوری',
		ru: 'Исключает искусственно накрученный объем',
		zh: '已彻底过滤自买自卖虚假刷量',
	},
	healthIndexTitle: {
		en: 'ORGANIC HEALTH INDEX',
		fa: 'شاخص سلامت معاملاتی کالکشن',
		ru: 'ИНДЕКС ЗДОРОВЬЯ КОЛЛЕКЦИИ',
		zh: '藏品交易健康指数',
	},
	healthIndexSubtitle: {
		en: 'Low circular transfer anomalies',
		fa: 'کمتر از ۱۲٪ حجم مشکوک به چرخش والت',
		ru: 'Низкая доля цикличных подозрительных транзакций',
		zh: '循环倒手异常流水低于 12%',
	},
	chromaticHeatmapTitle: {
		en: 'LAYA Delta-E Chromatic Harmony Heatmap',
		fa: 'نقشه هارمونی رنگی دلتا-E لایا (CIEDE2000)',
		ru: 'Тепловая карта цветовой гармонии Delta-E LAYA',
		zh: 'LAYA Delta-E 色彩和谐热力图 (CIEDE2000)',
	},
	chromaticHeatmapSubtitle: {
		en: 'Visual chromatic resonance between model hue and backdrop hex codes',
		fa: 'محاسبه هم‌افزایی بصری مدل و پس‌زمینه بر اساس تئوری رنگ',
		ru: 'Визуальная гармония между оттенком модели и фоном',
		zh: '基于人类色彩感知差异公式精算模型与底色协同度',
	},
	aestheticMultiplierTitle: {
		en: 'AESTHETIC MULTIPLIER EFFECT',
		fa: 'تاثیر پرمیوم زیبایی‌شناختی',
		ru: 'ЭФФЕКТ ЭСТЕТИЧЕСКОГО МНОЖИТЕЛЯ',
		zh: '视觉美学溢价倍数效应',
	},
	aestheticMultiplierText: {
		en: 'Gifts with high chromatic harmony (balanced Delta-E) trade at 15–35% premium over uncoordinated random combinations.',
		fa: 'خریداران گیفت در تلگرام تا ۳۵٪ بیشتر برای جفت‌های رنگی متقارن و چشم‌نواز پرداخت می‌کنند، زیرا در پروفایل جلوه بصری دوچندان دارد.',
		ru: 'Подарки с высокой цветовой гармонией продаются с премией 15–35% по сравнению со случайными несогласованными сочетаниями.',
		zh: '在 Telegram 个人主页展示中，色彩高度和谐（Delta-E 平衡）的礼物相比随机杂乱配色拥有 15% 至 35% 的显著成交溢价。',
	},
	whaleTrackerTitle: {
		en: 'LAYA Smart Money & Whale Accumulation',
		fa: 'ردیاب انباشت نهنگ‌ها و پول هوشمند LAYA',
		ru: 'Трекер накопления китов и умных денег LAYA',
		zh: 'LAYA 聪明钱与主力巨鲸建仓雷达',
	},
	whaleTrackerSubtitle: {
		en: 'On-chain tracking of top holders, supply concentration, and 24h net absorption',
		fa: 'پایش حرکت کیف‌پول‌های سنگین، تمرکز هولدرها و جریان خالص ۲۴ ساعته',
		ru: 'Ончейн-мониторинг крупнейших холдеров, концентрации и 24ч чистого притока',
		zh: '链上主力持仓地址监控、筹码集中度与 24 小时净吸收量跟踪',
	},
	top5Concentration: {
		en: 'TOP 5 CONCENTRATION',
		fa: 'تمرکز ۵ نهنگ برتر',
		ru: 'КОНЦЕНТРАЦИЯ ТОП-5',
		zh: '前 5 大巨鲸筹码集中度',
	},
	netInflow24h: {
		en: '24H NET INFLOW',
		fa: 'جریان خالص ورود ۲۴س',
		ru: 'ЧИСТЫЙ ПРИТОК ЗА 24Ч',
		zh: '24小时净流入量',
	},
	activeInflow: {
		en: 'Active Inflow Phase',
		fa: 'فاز انباشت فعال',
		ru: 'Фаза активного накопления',
		zh: '活跃建仓吸筹阶段',
	},
	smartMoneyBias: {
		en: 'SMART MONEY BIAS',
		fa: 'سیگنال پول هوشمند',
		ru: 'СИГНАЛ УМНЫХ ДЕНЕГ',
		zh: '聪明钱动向偏好',
	},
	actionCardTitle: {
		en: 'LAYA System 1 Strategic Action Card',
		fa: 'کارت تصمیم‌گیری استراتژیک سیستم ۱ لایا',
		ru: 'Стратегическая карта решений LAYA System 1',
		zh: 'LAYA 系统1 战略决策行动卡',
	},
	actionCardSubtitle: {
		en: 'Dynamic algorithmic action verdict & execution horizon',
		fa: 'سیگنال قطعی اقدام و افق زمانی بهینه‌سازی دارایی',
		ru: 'Алгоритмический вердикт и рекомендуемый горизонт исполнения',
		zh: '动态算法推荐行动方案与最佳执行窗口',
	},
	actionUpgrade: {
		en: 'UPGRADE TO ON-CHAIN NFT',
		fa: 'ارتقای فوری به ان‌اف‌تی در تلگرام',
		ru: 'ОБНОВИТЬ ДО ON-CHAIN NFT',
		zh: '立即升级为链上 NFT',
	},
	actionHold: {
		en: 'STRATEGIC ACCUMULATION (HOLD)',
		fa: 'هولد استراتژیک و عدم فروش در کف',
		ru: 'СТРАТЕГИЧЕСКОЕ УДЕРЖАНИЕ (HOLD)',
		zh: '战略长线持有（严禁低价抛售）',
	},
	actionSellNow: {
		en: 'TAKE PROFIT / LIQUIDATE NOW',
		fa: 'شناسایی سود و نقد کردن در اوج تقاضا',
		ru: 'ФИКСИРОВАТЬ ПРИБЫЛЬ / ПРОДАТЬ СЕЙЧАС',
		zh: '高流动性溢价期止盈套现',
	},
	actionCraftForge: {
		en: 'MERGE & CRAFT FOR HIGH-TIER',
		fa: 'ورود به کوره ذوب و ساخت (Crafting Forge)',
		ru: 'ПЛАВИТЬ В КУЗНИЦЕ КРАФТИНГА',
		zh: '送入炼金炉熔炼升级高阶藏品',
	},
	synergyCardTitle: {
		en: 'LAYA Trait Synergy Multiplier',
		fa: 'ضریب هم‌افزایی تریت‌های LAYA',
		ru: 'Множитель синергии черт LAYA',
		zh: 'LAYA 特征协同增效乘数',
	},
	synergyCardSubtitle: {
		en: 'Holistic visual trait harmony & aesthetic co-occurrence multiplier',
		fa: 'ارزیابی یکپارچه هماهنگی مدل، پالت پس‌زمینه و سمبل (۰.۹۰x تا ۱.۳۵x)',
		ru: 'Оценка гармонии модели, фона и символа (0.90x – 1.35x)',
		zh: '模型、底色与符号全维视觉共振加权（0.90x 至 1.35x）',
	},
	independentFloor: {
		en: 'INDEPENDENT TRAIT FLOOR',
		fa: 'ارزش پایه تریت‌های منفرد',
		ru: 'БАЗОВАЯ СТОИМОСТЬ ОТДЕЛЬНЫХ ЧЕРТ',
		zh: '孤立单项特征基础底价',
	},
	synergyAdjusted: {
		en: 'SYNERGY ADJUSTED VALUE',
		fa: 'ارزش نهایی با هم‌افزایی LAYA',
		ru: 'ОЦЕНКА С УЧЕТОМ СИНЕРГИИ',
		zh: '经 LAYA 协同增效后的总价值',
	},
	starsParityTitle: {
		en: 'Stars to TON Real-Time Parity Arbitrage',
		fa: 'برابری آربیتراژ آنی استارز به تون',
		ru: 'Арбитраж паритета Stars и TON в реальном времени',
		zh: 'Telegram Stars 与 TON 实时平价套利',
	},
	starsParitySubtitle: {
		en: 'In-app Telegram Stars cost vs Fragment secondary market floor',
		fa: 'مقایسه هزینه استارز درون‌برنامه‌ای با قیمت مارکت ثانویه فرگمنت',
		ru: 'Стоимость Stars в приложении против цен на вторичном рынке Fragment',
		zh: '电报应用内 Stars 成本与 Fragment 二级市场底价横向比对',
	},
	telegramStarsCost: {
		en: 'TELEGRAM STARS COST',
		fa: 'هزینه استارز درون‌برنامه',
		ru: 'СТОИМОСТЬ В TELEGRAM STARS',
		zh: '应用内 STARS 消耗成本',
	},
	secondaryMarketFloor: {
		en: 'SECONDARY MARKET FLOOR',
		fa: 'کف بازار ثانویه فرگمنت',
		ru: 'ВТОРИЧНЫЙ РЫНОК FRAGMENT',
		zh: 'FRAGMENT 二级市场底价',
	},
	starsDiscountNotice: {
		en: 'In-app Stars upgrade provides significant savings over purchasing directly from secondary markets.',
		fa: 'خرید یا ارتقا با استارز مستقیم درون تلگرام ارزان‌تر از خرید از بازار ثانویه است.',
		ru: 'Оплата через Stars в приложении выгоднее покупки на вторичном рынке.',
		zh: '在 Telegram 应用内使用 Stars 支付较二级市场直接购买更具成本优势。',
	},
	secondaryDiscountNotice: {
		en: 'Secondary market purchase in TON provides a discount over in-app Stars minting fees.',
		fa: 'خرید مستقیم با پرداخت TON در فرگمنت نسبت به هزینه استارز به‌صرفه‌تر است.',
		ru: 'Покупка за TON на вторичном рынке выгоднее выпуска через Stars в приложении.',
		zh: '直接在 Fragment 以 TON 购买比应用内 Stars 铸造或升级更加合算。',
	},
	exitPlannerTitle: {
		en: 'Exit Planner & Fee Optimizer',
		fa: 'برنامه‌ریز خروج و بهینه‌ساز کارمزد معامله',
		ru: 'Оптимизатор комиссий и планировщик выхода',
		zh: '变现退出规划与手续费极优化工具',
	},
	exitPlannerSubtitle: {
		en: 'Net seller proceeds after protocol commission & TON network gas fees',
		fa: 'مقایسه دقیق خالص دریافتی فروشنده در ۴ مارکت‌پلیس مختلف',
		ru: 'Сравнение чистой выручки продавца на 4 различных площадках',
		zh: '精算扣除各平台抽成与 TON 网络 Gas 后的卖家最终净得',
	},
	optimalVenue: {
		en: 'OPTIMAL LIQUIDATION VENUE',
		fa: 'بهترین مسیر نقد کردن با بالاترین دریافتی',
		ru: 'ОПТИМАЛЬНАЯ ПЛОЩАДКА ДЛЯ ПРОДАЖИ',
		zh: '净收益最高推荐清算市场',
	},
	netProceeds: {
		en: 'NET PROCEEDS',
		fa: 'خالص دریافتی',
		ru: 'ЧИСТАЯ ВЫРУЧКА',
		zh: '实际净收益',
	},
	marketplaceBreakdown: {
		en: 'MARKETPLACE LIQUIDITY & FEE BREAKDOWN',
		fa: 'جدول مقایسه نقدینگی و کارمزد مارکت‌پلیس‌ها',
		ru: 'ЛИКВИДНОСТЬ И КОМИССИИ МАРКЕТПЛЕЙСОВ',
		zh: '各交易市场流动性与手续费细目',
	},
	topChromaticPairs: {
		en: 'TOP 5 CHROMATIC HARMONY COMBINATIONS',
		fa: 'رتبه‌بندی ۵ جفت رنگی برتر کالکشن بر اساس LAYA ΔE',
		ru: 'ТОП-5 ЦВЕТОВЫХ ГАРМОНИЙ ПО LAYA ΔE',
		zh: '基于 LAYA ΔE 的前 5 大最佳色彩搭配排行',
	},
	onChainProvenance: {
		en: 'ON-CHAIN PROVENANCE',
		fa: 'اثبات زنجیره‌ای اصالت',
		ru: 'ОНЧЕЙН-ПРОИСХОЖДЕНИЕ',
		zh: '链上流转溯源验证',
	},
	smartMoneySignal: {
		en: 'ACCUMULATE',
		fa: 'انباشت فعال',
		ru: 'НАКОПЛЕНИЕ',
		zh: '积极吸筹',
	},
	lowSellChurn: {
		en: 'Low Sell Churn',
		fa: 'عدم تمایل به فروش در کف',
		ru: 'Низкое давление продавцов',
		zh: '低卖盘抛压',
	},
	itemsUnit: {
		en: 'items',
		fa: 'آیتم',
		ru: 'шт.',
		zh: '件',
	},
	actionCertaintySuffix: {
		en: '% CERTAINTY',
		fa: '٪ ضریب اطمینان',
		ru: '% УВЕРЕННОСТЬ',
		zh: '% 确定性置信度',
	},
	executionHorizon: {
		en: 'Execution Horizon:',
		fa: 'افق زمانی اجرا:',
		ru: 'Горизонт исполнения:',
		zh: '最佳执行窗口：',
	},
	targetNetRealization: {
		en: 'Target Net Realization:',
		fa: 'خالص انتظاری بازدهی:',
		ru: 'Целевая чистая выручка:',
		zh: '预期目标净收益：',
	},
	synergyMultiplierSuffix: {
		en: 'x MULTIPLIER',
		fa: 'x ضریب هم‌افزایی',
		ru: 'x МНОЖИТЕЛЬ',
		zh: 'x 增效倍数',
	},
	independentFloorSubtitle: {
		en: 'Linear component pricing',
		fa: 'محاسبه خطی قیمت اجزا',
		ru: 'Линейная оценка компонентов',
		zh: '孤立单项组件线性估值',
	},
	modelBackdropResonance: {
		en: 'Model-Backdrop Chromatic Resonance',
		fa: 'تطابق رنگی مدل و پس‌زمینه (ΔE)',
		ru: 'Цветовой баланс модели и фона (ΔE)',
		zh: '模型与背景色共振协同 (ΔE)',
	},
	symbolPatternCohesion: {
		en: 'Symbol Pattern Cohesion',
		fa: 'هماهنگی سمبل و پترن',
		ru: 'Связность символа и узора',
		zh: '符号与纹理契合凝聚度',
	},
	traitHarmonyFootnote: {
		en: 'Empirical Fragment auction clearing prices confirm coherent trait harmonies consistently clear above the sum of isolated trait floor prices.',
		fa: 'کلکسیونرهای گیفت تلگرام برای هارمونی رنگی و تقارن بصری تریت‌ها نسبت به اجزای جداگانه، پرمیوم قابل توجهی در حراج‌های فرگمنت ثبت می‌کنند.',
		ru: 'Данные аукционов Fragment подтверждают, что гармоничные сочетания черт стабильно продаются выше суммы их изолированных базовых цен.',
		zh: 'Fragment 拍卖历史真实成交数据证实，视觉高度和谐的特征组合始终大幅溢价于孤立单个特征底价之和。',
	},
	starsArbitrageDiscount: {
		en: 'STARS ARBITRAGE DISCOUNT',
		fa: 'تخفیف خرید با استارز تلگرام',
		ru: 'СКИДКА ПРИ ПОКУПКЕ ЗА STARS',
		zh: 'STARS 支付套利折扣',
	},
	secondaryMarketAdvantage: {
		en: 'SECONDARY MARKET ADVANTAGE',
		fa: 'صرفه‌جویی خرید از مارکت ثانویه',
		ru: 'ВЫГОДА ВТОРИЧНОГО РЫНКА',
		zh: '二级市场直接买入优势',
	},
	feeMinimizerBadge: {
		en: 'FEE MINIMIZER',
		fa: 'کمترین کارمزد',
		ru: 'МИНИМУМ КОМИССИЙ',
		zh: '手续费最优',
	},
	maxNetBadge: {
		en: 'MAX NET',
		fa: 'بیشترین دریافتی',
		ru: 'МАКС. ВЫРУЧКА',
		zh: '净得最高',
	},
	deductionLabel: {
		en: 'Deduction:',
		fa: 'کسورات:',
		ru: 'Удержания:',
		zh: '总扣除项：',
	},
};
