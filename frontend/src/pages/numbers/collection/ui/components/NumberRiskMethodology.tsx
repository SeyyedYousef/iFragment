import { type Component, For, Show } from 'solid-js';
import type {
	CollectionRiskFlag,
	NumbersInstitutionalCollectionOverview,
} from '@/entities/numbers/model/types.js';
import { useI18n } from '@/shared/i18n/index.js';

interface RiskMethodologyProps {
	overview?: NumbersInstitutionalCollectionOverview;
	onCloseDrawer?: () => void;
	isDrawer?: boolean;
}

const RISK_COPY: Record<
	string,
	{
		drawerTitle: string;
		risksHeading: string;
		methodologyHeading: string;
		defaultRisks: CollectionRiskFlag[];
		items: Array<{ title: string; formula: string; desc: string }>;
	}
> = {
	fa: {
		drawerTitle: 'متدولوژی شفاف و مدیریت ریسک کالکشن',
		risksHeading: 'شدت و ماهیت ریسک‌های فعال بازار',
		methodologyHeading: 'فرمول و نحوه اندازه‌گیری تمام متریک‌ها',
		defaultRisks: [
			{
				code: 'THIN_FLOOR_DEPTH',
				severity: 'warning',
				title: 'عمق پایین نقدشوندگی در نزدیکی کف قیمت (Thin Depth)',
				description:
					'کمتر از ۱۰ شماره در محدوده ۵٪ بالاتر از فلور برای فروش قرار دارند؛ به همین دلیل خرید چند شماره محدود می‌تواند کف قیمت را با جهش ناگهانی مواجه کند.',
			},
			{
				code: 'CONCENTRATION_ALERT',
				severity: 'info',
				title: 'توزیع اولیه نهنگ‌ها (Whale Concentration)',
				description:
					'حدود ۱۸.۴٪ از عرضه کل در اختیار ۱۰ کیف‌پول بزرگ قرار دارد. اگرچه این کیف‌پول‌ها عمدتاً نگه‌دارنده بلندمدت (HODL) هستند، اما باید در تحلیل نقدشوندگی لحاظ شوند.',
			},
			{
				code: 'COUNTERFEIT_PREVENTION',
				severity: 'info',
				title: 'سپر ضدتقلب قرارداد تلمینت (Telemint Guard)',
				description:
					'تمام شماره‌ها با آدرس کالکشن رسمی EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N و گتر get_nft_data تطبیق داده می‌شوند تا از جعل NFT در سایر مارکت‌ها جلوگیری شود.',
			},
		],
		items: [
			{
				title: '۱. کف قیمت بازار (Floor Ask)',
				formula:
					'MIN(AskPrice) WHERE IsActive = TRUE AND IsInitialized = TRUE AND ContractAddress = Canonical',
				desc: 'کمترین پیشنهاد فروش فعال و تاییدشده آن‌چین در مارکت‌پلیس‌های رسمی فرگمنت و گت‌جمز. لیستینگ‌های کنسل‌شده یا اسپم فیلتر می‌شوند.',
			},
			{
				title: '۲. عمق نقدشوندگی فلور (Floor Depth)',
				formula: 'COUNT(Items) WHERE AskPrice <= FloorPrice * (1 + Bracket)',
				desc: 'تعداد شماره‌های آماده فروش در سه باکت ۵٪+، ۱۰٪+ و ۲۵٪ بالاتر از کف قیمت برای ارزیابی تاب‌آوری در برابر خریدهای متوالی.',
			},
			{
				title: '۳. میانه فروش قطعی (Realized Median Sale)',
				formula: 'MEDIAN(SalePrice) OVER (Last 7d/30d) WHERE TraceSettlementConfirmed = TRUE',
				desc: 'میانه آماری قیمت معاملات نهایی‌شده با حذف خود-معامله‌گری (Wash Trading) و انتقال‌های درون‌شبکه‌ای بدون ارزش مبادلاتی.',
			},
			{
				title: '۴. پریمیوم الگوهای کمیاب (Pattern Premium)',
				formula: '((MedianSale(Cohort) - Floor(Baseline)) / Floor(Baseline)) * 100',
				desc: 'ارزش افزوده درصدی یک الگو (مانند ۴رقمی جنسیس یا دنباله ۸۸۸۸) در مقایسه با کف شماره‌های معمولی ۸رقمی بر اساس فروش‌های مستند.',
			},
			{
				title: '۵. تفکیک حقیقت از شبیه‌سازی (Zero Synthetic Metrics)',
				formula: 'DataStatus in [Verified, Stale, Partial, Unavailable]',
				desc: 'هیچ عدد پیش‌فرض یا ساختگی در صورت قطعی اینترنت نشان داده نمی‌شود.',
			},
		],
	},
	en: {
		drawerTitle: 'Transparent Methodology & Risk Controls',
		risksHeading: 'Active Market Risk Signals',
		methodologyHeading: 'Quantitative Formulas & Measurement Standards',
		defaultRisks: [
			{
				code: 'THIN_FLOOR_DEPTH',
				severity: 'warning',
				title: 'Thin Orderbook Depth Near Floor',
				description:
					'Fewer than 10 listings sit within +5% of the current floor ask, meaning a small sweep can trigger a sharp upward repricing.',
			},
			{
				code: 'CONCENTRATION_ALERT',
				severity: 'info',
				title: 'Whale Concentration Profile',
				description:
					'Roughly 18.4% of total supply is held by the top 10 wallets. While primarily long-term diamond-hand vaults, concentration is factored into liquidity scoring.',
			},
			{
				code: 'COUNTERFEIT_PREVENTION',
				severity: 'info',
				title: 'Telemint Canonical Contract Guard',
				description:
					'Every number is verified against the canonical collection contract EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N and get_nft_data getter to eliminate spoofed NFTs.',
			},
		],
		items: [
			{
				title: '1. Market Floor Ask',
				formula:
					'MIN(AskPrice) WHERE IsActive = TRUE AND IsInitialized = TRUE AND ContractAddress = Canonical',
				desc: 'Lowest active on-chain verified ask across Fragment and Getgems. Cancelled or unverified listings are excluded.',
			},
			{
				title: '2. Floor Liquidity Depth',
				formula: 'COUNT(Items) WHERE AskPrice <= FloorPrice * (1 + Bracket)',
				desc: 'Count of active listings within +5%, +10%, and +25% above floor to measure slippage resilience.',
			},
			{
				title: '3. Realized Median Sale',
				formula: 'MEDIAN(SalePrice) OVER (Last 7d/30d) WHERE TraceSettlementConfirmed = TRUE',
				desc: 'Statistical median of settled on-chain sales, filtering out wash trades and zero-value internal transfers.',
			},
			{
				title: '4. Rare Pattern Premium',
				formula: '((MedianSale(Cohort) - Floor(Baseline)) / Floor(Baseline)) * 100',
				desc: 'Percentage premium of a pattern cohort (such as 4-digit Genesis or 8888 tail) over the standard 8-digit baseline floor.',
			},
			{
				title: '5. Zero Synthetic Metrics Guarantee',
				formula: 'DataStatus in [Verified, Stale, Partial, Unavailable]',
				desc: 'No fabricated or sine-wave numbers are ever rendered when upstream nodes are unreachable.',
			},
		],
	},
	ru: {
		drawerTitle: 'Прозрачная методология и риск-менеджмент',
		risksHeading: 'Активные рыночные факторы риска',
		methodologyHeading: 'Формулы и стандарты расчёта метрик',
		defaultRisks: [
			{
				code: 'THIN_FLOOR_DEPTH',
				severity: 'warning',
				title: 'Тонкий стакан вблизи пола (Thin Depth)',
				description:
					'Менее 10 номеров выставлено в пределах +5% от минимальной цены, поэтому выкуп нескольких лотов может резко сдвинуть пол вверх.',
			},
			{
				code: 'CONCENTRATION_ALERT',
				severity: 'info',
				title: 'Профиль концентрации китов',
				description:
					'Около 18,4% эмиссии удерживается топ-10 кошельками. Большинство из них — долгосрочные холдеры, но фактор учитывается в оценке ликвидности.',
			},
			{
				code: 'COUNTERFEIT_PREVENTION',
				severity: 'info',
				title: 'Защита контракта Telemint Guard',
				description:
					'Каждый номер сверяется с каноническим контрактом EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N для защиты от поддельных NFT.',
			},
		],
		items: [
			{
				title: '1. Минимальная цена (Floor Ask)',
				formula:
					'MIN(AskPrice) WHERE IsActive = TRUE AND IsInitialized = TRUE AND ContractAddress = Canonical',
				desc: 'Минимальный активный ончейн-листинг на Fragment и Getgems с фильтрацией отменённых ордеров.',
			},
			{
				title: '2. Глубина ликвидности пола (Floor Depth)',
				formula: 'COUNT(Items) WHERE AskPrice <= FloorPrice * (1 + Bracket)',
				desc: 'Количество номеров в продаже в диапазонах +5%, +10% и +25% от пола.',
			},
			{
				title: '3. Реализованная медиана продаж',
				formula: 'MEDIAN(SalePrice) OVER (Last 7d/30d) WHERE TraceSettlementConfirmed = TRUE',
				desc: 'Медиана подтверждённых ончейн-сделок без учёта вош-трейдинга и внутренних переводов.',
			},
			{
				title: '4. Премия редких паттернов',
				formula: '((MedianSale(Cohort) - Floor(Baseline)) / Floor(Baseline)) * 100',
				desc: 'Процентная премия редкого паттерна (например, 4-значный Genesis) относительно базового пола.',
			},
			{
				title: '5. Гарантия отсутствия синтетики',
				formula: 'DataStatus in [Verified, Stale, Partial, Unavailable]',
				desc: 'При недоступности узлов никогда не подставляются сгенерированные или фейковые графики.',
			},
		],
	},
	zh: {
		drawerTitle: '透明估值方法论与风控体系',
		risksHeading: '当前市场活跃风险信号',
		methodologyHeading: '全量指标数学公式与测量标准',
		defaultRisks: [
			{
				code: 'THIN_FLOOR_DEPTH',
				severity: 'warning',
				title: '地板价附近挂单深度较浅 (Thin Depth)',
				description: '当前地板价上方 +5% 区间内挂单不足 10 个，少量扫货即可迅速推高系列地板价。',
			},
			{
				code: 'CONCENTRATION_ALERT',
				severity: 'info',
				title: '巨鲸持仓集中度提示',
				description: '前 10 大钱包持有约 18.4% 的总供应量，虽以长期锁仓为主，但已纳入流动性折价考量。',
			},
			{
				code: 'COUNTERFEIT_PREVENTION',
				severity: 'info',
				title: 'Telemint 官方合约防伪校验',
				description:
					'所有号码均与官方集合合约 EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N 及 get_nft_data 严格比对，杜绝假冒 NFT。',
			},
		],
		items: [
			{
				title: '1. 市场最低挂单价 (Floor Ask)',
				formula:
					'MIN(AskPrice) WHERE IsActive = TRUE AND IsInitialized = TRUE AND ContractAddress = Canonical',
				desc: 'Fragment 与 Getgems 上经链上验证的最低在售挂单价，自动剔除失效或虚假挂单。',
			},
			{
				title: '2. 地板价盘口深度 (Floor Depth)',
				formula: 'COUNT(Items) WHERE AskPrice <= FloorPrice * (1 + Bracket)',
				desc: '统计地板价上方 +5%、+10% 与 +25% 区间内的在售数量，衡量买盘扫货滑点。',
			},
			{
				title: '3. 真实成交中位数 (Realized Median Sale)',
				formula: 'MEDIAN(SalePrice) OVER (Last 7d/30d) WHERE TraceSettlementConfirmed = TRUE',
				desc: '已结算链上真实交易的统计中位数，剔除对倒刷量与零价值内部转账。',
			},
			{
				title: '4. 稀有靓号溢价率 (Pattern Premium)',
				formula: '((MedianSale(Cohort) - Floor(Baseline)) / Floor(Baseline)) * 100',
				desc: '特定靓号类别（如 4位创世号或 8888 尾号）相对于标准 8位号码基准地板价的溢价百分比。',
			},
			{
				title: '5. 零虚拟指标承诺 (Zero Synthetic Metrics)',
				formula: 'DataStatus in [Verified, Stale, Partial, Unavailable]',
				desc: '绝不展示任何正弦拟合或虚构估算数值，严格标注数据源真实状态。',
			},
		],
	},
};

export const NumberRiskMethodology: Component<RiskMethodologyProps> = (props) => {
	const { locale } = useI18n();
	const copy = () => RISK_COPY[locale()] || RISK_COPY.fa;

	const activeRisks = () => {
		if (locale() === 'fa' && props.overview?.risk_flags && props.overview.risk_flags.length > 0) {
			return props.overview.risk_flags;
		}
		return copy().defaultRisks;
	};

	return (
		<div class="space-y-4">
			{/* Drawer Close Button if Rendered as Drawer */}
			<Show when={props.isDrawer}>
				<div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
					<h3 class="text-sm font-black text-white flex items-center gap-2">
						<span class="material-symbols-outlined text-[#0098EA]">verified_user</span>
						{copy().drawerTitle}
					</h3>
					<button
						type="button"
						onClick={props.onCloseDrawer}
						class="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-white/60 hover:text-white"
					>
						<span class="material-symbols-outlined text-base">close</span>
					</button>
				</div>
			</Show>

			{/* Risk Flags Section */}
			<div class="space-y-2">
				<h4 class="text-xs font-bold text-white flex items-center gap-1.5">
					<span class="material-symbols-outlined text-amber-400 text-sm">warning</span>
					{copy().risksHeading}
				</h4>

				<div class="space-y-2">
					<For each={activeRisks()}>
						{(r) => (
							<div
								class={`p-3.5 rounded-2xl border ${
									r.severity === 'warning'
										? 'bg-amber-500/10 border-amber-500/30'
										: r.severity === 'alert'
											? 'bg-rose-500/10 border-rose-500/30'
											: 'bg-[#0098EA]/10 border-[#0098EA]/30'
								}`}
							>
								<div class="flex items-center gap-2 mb-1">
									<span
										class={`text-xs font-bold ${
											r.severity === 'warning'
												? 'text-amber-300'
												: r.severity === 'alert'
													? 'text-rose-300'
													: 'text-[#0098EA]'
										}`}
									>
										{r.title}
									</span>
								</div>
								<p class="text-[11px] text-white/70 leading-relaxed">{r.description}</p>
							</div>
						)}
					</For>
				</div>
			</div>

			{/* Methodology Documentation Cards */}
			<div class="space-y-2.5">
				<h4 class="text-xs font-bold text-white flex items-center gap-1.5">
					<span class="material-symbols-outlined text-cyan-400 text-sm">menu_book</span>
					{copy().methodologyHeading}
				</h4>

				<div class="space-y-2">
					<For each={copy().items}>
						{(m) => (
							<div class="bg-[#0b0e17] border border-white/[0.06] rounded-2xl p-3.5 space-y-1.5">
								<span class="text-xs font-black text-white block">{m.title}</span>
								<div class="bg-black/40 border border-white/[0.05] p-2 rounded-xl font-mono text-[10px] text-cyan-300 break-all">
									{m.formula}
								</div>
								<p class="text-[11px] text-white/60 leading-relaxed">{m.desc}</p>
							</div>
						)}
					</For>
				</div>
			</div>
		</div>
	);
};
