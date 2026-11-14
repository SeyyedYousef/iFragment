import { type Component, createMemo } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { GIFTS_I18N, type LocalizedText, layaT } from '@/shared/i18n/laya-i18n.js';

interface Props {
	expectedTon: number;
	expectedUsd?: number;
	serialNumber?: number;
	modelName?: string;
	isUpgraded?: boolean;
	isCraftable?: boolean;
	confidenceScore?: number;
	verdict?: string;
	summaryFa?: string;
	summaryEn?: string;
}

export type LayaActionType = 'HOLD' | 'SELL_NOW' | 'CRAFT_FORGE' | 'UPGRADE';

export const GiftLayaActionCard: Component<Props> = (props) => {
	const expected = () => props.expectedTon || 0;
	const confidence = () => props.confidenceScore || 88;
	const serial = () => props.serialNumber || 1000;

	// Determine optimal action through LAYA decision matrix
	const action = createMemo<{
		type: LayaActionType;
		badge: LocalizedText;
		color: string;
		bgGradient: string;
		borderColor: string;
		icon: string;
		timeframeKey: string;
		rationaleKey: string;
		expectedNetTon: number;
	}>(() => {
		// Priority 1: If not upgraded and low serial / high model rarity -> UPGRADE
		if (props.isUpgraded === false) {
			return {
				type: 'UPGRADE',
				badge: GIFTS_I18N.actionUpgrade,
				color: '#2990ff',
				bgGradient: 'from-sky-950/40 via-[#0A121A] to-[#08090D]',
				borderColor: 'border-sky-500/30',
				icon: 'rocket_launch',
				timeframeKey: 'giftsAction.upgrade_timeframe',
				rationaleKey: 'giftsAction.upgrade_rationale',
				expectedNetTon: Math.round(expected() * 1.35 * 10) / 10,
			};
		}

		// Priority 2: Very high serial & common model & craftable -> CRAFT_FORGE
		if (props.isCraftable && serial() > 5000 && expected() < 30) {
			return {
				type: 'CRAFT_FORGE',
				badge: GIFTS_I18N.actionCraftForge,
				color: '#f59e0b',
				bgGradient: 'from-amber-950/40 via-[#140F08] to-[#08090D]',
				borderColor: 'border-amber-500/30',
				icon: 'local_fire_department',
				timeframeKey: 'giftsAction.craftForge_timeframe',
				rationaleKey: 'giftsAction.craftForge_rationale',
				expectedNetTon: Math.round(expected() * 1.25 * 10) / 10,
			};
		}

		// Priority 3: Low serial (< 100) or high expected value -> HOLD
		if (serial() < 100 || expected() > 80) {
			return {
				type: 'HOLD',
				badge: GIFTS_I18N.actionHold,
				color: '#10b981',
				bgGradient: 'from-emerald-950/40 via-[#09150E] to-[#08090D]',
				borderColor: 'border-emerald-500/30',
				icon: 'shield',
				timeframeKey: 'giftsAction.hold_timeframe',
				rationaleKey: 'giftsAction.hold_rationale',
				expectedNetTon: Math.round(expected() * 1.45 * 10) / 10,
			};
		}

		// Default: SELL_NOW if market liquidity peak
		return {
			type: 'SELL_NOW',
			badge: GIFTS_I18N.actionSellNow,
			color: '#ef4444',
			bgGradient: 'from-rose-950/40 via-[#180A0F] to-[#08090D]',
			borderColor: 'border-rose-500/30',
			icon: 'point_of_sale',
			timeframeKey: 'giftsAction.sellNow_timeframe',
			rationaleKey: 'giftsAction.sellNow_rationale',
			expectedNetTon: Math.round(expected() * 0.95 * 10) / 10,
		};
	});

	const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

	return (
		<div class="bg-[#1b232d]/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5 shadow-xl text-start flex flex-col gap-4 relative overflow-hidden">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div
						class="w-9 h-9 rounded-[14px] flex items-center justify-center border"
						style={{
							'background-color': `${action().color}20`,
							'border-color': `${action().color}40`,
							color: action().color,
						}}
					>
						<span class="material-symbols-outlined text-[20px]">{action().icon}</span>
					</div>
					<div class="flex flex-col">
						<h3 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{layaT(GIFTS_I18N.actionCardTitle)}
						</h3>
						<span class="text-[9px] font-mono text-white/40">
							{layaT(GIFTS_I18N.actionCardSubtitle)}
						</span>
					</div>
				</div>
				<span
					class="text-[9px] font-mono font-black px-2.5 py-0.5 rounded-md border"
					style={{
						'background-color': `${action().color}15`,
						'border-color': `${action().color}30`,
						color: action().color,
					}}
				>
					{confidence()}
					{layaT(GIFTS_I18N.actionCertaintySuffix)}
				</span>
			</div>

			{/* Main Action Callout */}
			<div
				class={`bg-gradient-to-r ${action().bgGradient} border ${action().borderColor} rounded-[22px] p-4 flex flex-col gap-3`}
			>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span
							class="text-xs font-mono font-black uppercase px-2 py-0.5 rounded-md text-black"
							style={{ 'background-color': action().color }}
						>
							{action().type}
						</span>
						<span class="text-sm font-black text-white">{layaT(action().badge)}</span>
					</div>
				</div>

				<p class="text-xs text-white/80 leading-relaxed font-sans">{t(action().rationaleKey)}</p>

				{/* Two Metrics in Callout */}
				<div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 font-mono text-[10px]">
					<div class="flex flex-col">
						<span class="text-white/40 uppercase">{layaT(GIFTS_I18N.executionHorizon)}</span>
						<span class="text-white font-bold mt-0.5">{t(action().timeframeKey)}</span>
					</div>

					<div class="flex flex-col items-end">
						<span class="text-white/40 uppercase">{layaT(GIFTS_I18N.targetNetRealization)}</span>
						<div class="flex items-baseline gap-1 mt-0.5">
							<span class="text-sm font-black" style={{ color: action().color }}>
								{fmt(action().expectedNetTon)}
							</span>
							<span class="text-[9px] font-bold text-white/60">{t('common.ton')}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
