import { type Component, For, Show } from 'solid-js';
import type {
	CollectionRiskFlag,
	NumbersInstitutionalCollectionOverview,
} from '@/entities/numbers/model/types.js';
import { t, useI18n } from '@/shared/i18n/index.js';

interface RiskMethodologyProps {
	overview?: NumbersInstitutionalCollectionOverview;
	onCloseDrawer?: () => void;
	isDrawer?: boolean;
}

export const NumberRiskMethodology: Component<RiskMethodologyProps> = (props) => {
	const { locale } = useI18n();

	const defaultRisks = (): CollectionRiskFlag[] => [
		{
			code: 'THIN_FLOOR_DEPTH',
			severity: 'warning',
			title: t('numRisk.risk1Title'),
			description: t('numRisk.risk1Desc'),
		},
		{
			code: 'CONCENTRATION_ALERT',
			severity: 'info',
			title: t('numRisk.risk2Title'),
			description: t('numRisk.risk2Desc'),
		},
		{
			code: 'COUNTERFEIT_PREVENTION',
			severity: 'info',
			title: t('numRisk.risk3Title'),
			description: t('numRisk.risk3Desc'),
		},
	];

	const methodologyItems = () => [
		{
			title: t('numRisk.item1Title'),
			formula:
				'MIN(AskPrice) WHERE IsActive = TRUE AND IsInitialized = TRUE AND ContractAddress = Canonical',
			desc: t('numRisk.item1Desc'),
		},
		{
			title: t('numRisk.item2Title'),
			formula: 'COUNT(Items) WHERE AskPrice <= FloorPrice * (1 + Bracket)',
			desc: t('numRisk.item2Desc'),
		},
		{
			title: t('numRisk.item3Title'),
			formula: 'MEDIAN(SalePrice) OVER (Last 7d/30d) WHERE TraceSettlementConfirmed = TRUE',
			desc: t('numRisk.item3Desc'),
		},
		{
			title: t('numRisk.item4Title'),
			formula: '((MedianSale(Cohort) - Floor(Baseline)) / Floor(Baseline)) * 100',
			desc: t('numRisk.item4Desc'),
		},
		{
			title: t('numRisk.item5Title'),
			formula: 'DataStatus in [Verified, Stale, Partial, Unavailable]',
			desc: t('numRisk.item5Desc'),
		},
	];

	const activeRisks = () => {
		if (locale() === 'fa' && props.overview?.risk_flags && props.overview.risk_flags.length > 0) {
			return props.overview.risk_flags;
		}
		return defaultRisks();
	};

	return (
		<div class="space-y-4">
			{/* Drawer Close Button if Rendered as Drawer */}
			<Show when={props.isDrawer}>
				<div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
					<h3 class="text-sm font-black text-white flex items-center gap-2">
						<span class="material-symbols-outlined text-[#2990ff]">verified_user</span>
						{t('numRisk.drawerTitle')}
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
					{t('numRisk.risksHeading')}
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
											: 'bg-[#2990ff]/10 border-[#2990ff]/30'
								}`}
							>
								<div class="flex items-center gap-2 mb-1">
									<span
										class={`text-xs font-bold ${
											r.severity === 'warning'
												? 'text-amber-300'
												: r.severity === 'alert'
													? 'text-rose-300'
													: 'text-[#2990ff]'
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
					{t('numRisk.methodologyHeading')}
				</h4>

				<div class="space-y-2">
					<For each={methodologyItems()}>
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
