import { type Component, createSignal, Show } from 'solid-js';
import type { NumbersInstitutionalCollectionOverview } from '@/entities/numbers/model/types.js';
import { t } from '@/shared/i18n/index.js';
import { layaT, NUMBERS_COLLECTION_I18N } from '@/shared/i18n/laya-i18n.js';
import { haptic } from '@/shared/lib/haptic.js';
import { FragStatusPill } from '@/shared/ui/fragment/FragmentPrimitives.js';

interface HeaderProps {
	overview?: NumbersInstitutionalCollectionOverview;
	onOpenExport: () => void;
	onOpenMethodology: () => void;
	onOpenAlerts: () => void;
	onBack: () => void;
	onNavigateMask: () => void;
}

export const NumberCollectionHeader: Component<HeaderProps> = (props) => {
	const [copied, setCopied] = createSignal(false);

	const copyContract = () => {
		const addr =
			props.overview?.collection_address || 'EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N';
		try {
			navigator.clipboard.writeText(addr);
			setCopied(true);
			haptic.notify('success');
			setTimeout(() => setCopied(false), 2200);
		} catch {}
	};

	const formatTimeAgo = (isoStr?: string) => {
		if (!isoStr) return layaT(NUMBERS_COLLECTION_I18N.justNow);
		const diffMs = Date.now() - new Date(isoStr).getTime();
		const diffMin = Math.floor(diffMs / 60000);
		if (diffMin <= 1) return layaT(NUMBERS_COLLECTION_I18N.justNow);
		if (diffMin < 60)
			return layaT(NUMBERS_COLLECTION_I18N.minAgo).replace('{min}', String(diffMin));
		const diffHr = Math.floor(diffMin / 60);
		if (diffHr < 24) return layaT(NUMBERS_COLLECTION_I18N.hrAgo).replace('{hr}', String(diffHr));
		return layaT(NUMBERS_COLLECTION_I18N.dayAgo).replace('{day}', String(Math.floor(diffHr / 24)));
	};

	return (
		<div class="mb-4">
			{/* Top Bar with Navigation & Quick Actions */}
			<div class="flex items-center justify-between gap-2 mb-3">
				<button
					type="button"
					onClick={props.onBack}
					class="w-9 h-9 rounded-[10px] frag-btn-secondary flex items-center justify-center text-[#8c9ba5] hover:text-white active:scale-95 shrink-0"
					aria-label={layaT(NUMBERS_COLLECTION_I18N.backLabel)}
				>
					<span class="material-symbols-outlined text-[19px] rtl:rotate-180">arrow_back</span>
				</button>

				<div class="flex-1 min-w-0 px-1.5 text-start">
					<div class="flex items-center gap-1.5 flex-wrap">
						<h1 class="text-[15px] font-semibold tracking-[-0.015em] text-white truncate">
							{layaT(NUMBERS_COLLECTION_I18N.headerTitle)}
						</h1>
						<span class="text-[10.5px] font-mono font-semibold px-1.5 py-0.5 rounded-[5px] bg-[#2990ff]/12 text-[#2990ff] border border-[#2990ff]/25 tabular-nums">
							+888
						</span>
					</div>
					<p class="text-[11px] text-[#8c9ba5] truncate font-mono mt-0.5">
						{t('numCollectionHeader.subtitle')}
					</p>
				</div>

				<div class="flex items-center gap-1.5 shrink-0">
					<button
						type="button"
						onClick={props.onOpenAlerts}
						class="w-9 h-9 rounded-[10px] frag-btn-secondary hover:text-[#ffb340] flex items-center justify-center text-[#8c9ba5] active:scale-95"
						title={layaT(NUMBERS_COLLECTION_I18N.alertsTooltip)}
					>
						<span class="material-symbols-outlined text-[18px]">notifications_active</span>
					</button>

					<button
						type="button"
						onClick={props.onOpenExport}
						class="w-9 h-9 rounded-[10px] frag-btn-secondary hover:text-[#4cd964] flex items-center justify-center text-[#8c9ba5] active:scale-95"
						title={layaT(NUMBERS_COLLECTION_I18N.exportTooltip)}
					>
						<span class="material-symbols-outlined text-[18px]">ios_share</span>
					</button>

					<button
						type="button"
						onClick={props.onOpenMethodology}
						class="w-9 h-9 rounded-[10px] frag-btn-secondary hover:text-[#2990ff] flex items-center justify-center text-[#8c9ba5] active:scale-95"
						title={layaT(NUMBERS_COLLECTION_I18N.methodologyTooltip)}
					>
						<span class="material-symbols-outlined text-[18px]">verified_user</span>
					</button>
				</div>
			</div>

			{/* Official Collection Identity Card */}
			<div class="frag-card-elevated rounded-[16px] p-4 relative overflow-hidden">
				<div class="flex items-start justify-between gap-3">
					<div class="space-y-1.5 min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<span
								class="text-[15px] font-semibold text-white font-mono tracking-[-0.015em]"
								dir="ltr"
							>
								{t('numCollectionHeader.collectionName')}
							</span>
							<FragStatusPill
								status="sold"
								label={layaT(NUMBERS_COLLECTION_I18N.telemintVerified)}
							/>
						</div>

						<div class="flex items-center gap-2 pt-0.5 flex-wrap">
							<span class="text-[11px] text-[#8c9ba5] font-mono">
								{layaT(NUMBERS_COLLECTION_I18N.contractLabel)}
							</span>
							<button
								type="button"
								onClick={copyContract}
								class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[7px] frag-inset text-[11px] font-mono text-[#2990ff] hover:text-white transition-all active:scale-95 tabular-nums"
								dir="ltr"
							>
								<span class="truncate max-w-[130px] sm:max-w-[180px]">
									{props.overview?.collection_address
										? `${props.overview.collection_address.slice(0, 4)}...${props.overview.collection_address.slice(-4)}`
										: 'EQAO...si5N'}
								</span>
								<span class="material-symbols-outlined text-[13px]">
									{copied() ? 'done' : 'content_copy'}
								</span>
								<Show when={copied()}>
									<span class="text-[#4cd964] text-[10px] font-semibold">
										{layaT(NUMBERS_COLLECTION_I18N.copiedSuccess)}
									</span>
								</Show>
							</button>
						</div>
					</div>

					<div class="text-end shrink-0">
						<span class="text-[11px] text-[#8c9ba5] block">
							{layaT(NUMBERS_COLLECTION_I18N.totalSupplyFrozen)}
						</span>
						<span class="text-[13px] font-semibold text-white font-mono block mt-0.5 tabular-nums">
							136,566{' '}
							<span class="text-[11px] font-normal text-[#8c9ba5]">
								{layaT(NUMBERS_COLLECTION_I18N.items)}
							</span>
						</span>
						<span class="text-[10.5px] text-[#2990ff] font-mono block mt-0.5">
							{layaT(NUMBERS_COLLECTION_I18N.genesis4d)}
						</span>
					</div>
				</div>

				{/* Provenance & Freshness Strip */}
				<div class="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-[#8c9ba5] flex-wrap gap-2">
					<div class="flex items-center gap-2">
						<FragStatusPill
							status={props.overview?.is_live ? 'available' : 'on_auction'}
							pulse={Boolean(props.overview?.is_live)}
							label={
								props.overview?.is_live
									? layaT(NUMBERS_COLLECTION_I18N.liveOnChainData)
									: layaT(NUMBERS_COLLECTION_I18N.latestSnapshot)
							}
						/>
						<span class="font-mono text-[10.5px]">
							{formatTimeAgo(props.overview?.observed_at)}
						</span>
					</div>

					<div class="flex items-center gap-1.5 font-mono text-[10.5px] text-[#60707c]">
						<span>{layaT(NUMBERS_COLLECTION_I18N.sourcesFragmentTon)}</span>
						<Show when={props.overview?.snapshot_id}>
							<span>· ID: {props.overview!.snapshot_id.slice(-6)}</span>
						</Show>
					</div>
				</div>
			</div>
		</div>
	);
};
