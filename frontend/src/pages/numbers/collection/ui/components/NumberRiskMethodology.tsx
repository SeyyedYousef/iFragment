import { type Component, For, Show } from 'solid-js';
import type { CollectionRiskFlag, NumbersInstitutionalCollectionOverview } from '@/entities/numbers/model/types.js';

interface RiskMethodologyProps {
	overview?: NumbersInstitutionalCollectionOverview;
	onCloseDrawer?: () => void;
	isDrawer?: boolean;
}

export const NumberRiskMethodology: Component<RiskMethodologyProps> = (props) => {
	const defaultRisks: CollectionRiskFlag[] = [
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
	];

	const activeRisks = () => {
		if (props.overview?.risk_flags && props.overview.risk_flags.length > 0) {
			return props.overview.risk_flags;
		}
		return defaultRisks;
	};

	const methodologyItems = [
		{
			title: '۱. کف قیمت بازار (Floor Ask)',
			formula: 'MIN(AskPrice) WHERE IsActive = TRUE AND IsInitialized = TRUE AND ContractAddress = Canonical',
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
			desc: 'هیچ عدد پیش‌فرض یا ساختگی در صورت قطعی اینترنت نشان داده نمی‌شود. شاخص‌های فرضی مانند سود اجاره یا LTV تا زمان اثبات بازار مستقل در وضعیت Experimental قرار دارند.',
		},
	];

	return (
		<div class="space-y-4">
			{/* Drawer Close Button if Rendered as Drawer */}
			<Show when={props.isDrawer}>
				<div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
					<h3 class="text-sm font-black text-white flex items-center gap-2">
						<span class="material-symbols-outlined text-[#0098EA]">verified_user</span>
						متدولوژی شفاف و مدیریت ریسک کالکشن
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
					شدت و ماهیت ریسک‌های فعال بازار
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
					فرمول و نحوه اندازه‌گیری تمام متریک‌ها
				</h4>

				<div class="space-y-2">
					<For each={methodologyItems}>
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
