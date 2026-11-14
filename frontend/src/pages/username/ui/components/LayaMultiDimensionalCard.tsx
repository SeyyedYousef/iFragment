import type { Component } from 'solid-js';
import { layaT, USERNAME_I18N } from '@/shared/i18n/laya-i18n.js';
import { FragSectionHeader } from '@/shared/ui/fragment/FragmentPrimitives.js';

export interface LayaUsernameDecision {
	total_score?: number;
	phonetic_score?: number;
	cultural_resonance?: string;
	target_entity_fit?: string;
	commercial_intent?: number;
	trademark_risk_level?: string;
	seizure_risk?: number;
	liquidity_speed?: string;
	buyer_archetype?: string;
	bidding_war_potential?: number;
	auction_tactics?: string;
	confidence?: number;
}

interface Props {
	decision?: LayaUsernameDecision | null;
	username: string;
}

export const LayaMultiDimensionalCard: Component<Props> = (props) => {
	const phoneticScore = () => {
		if (props.decision?.phonetic_score && props.decision.phonetic_score > 0) {
			return props.decision.phonetic_score;
		}
		const u = (props.username || '').toLowerCase();
		if (u.length <= 4) return 9;
		if (u.length <= 6) return 8;
		return 6;
	};

	const commercialIntent = () => {
		if (
			props.decision?.commercial_intent !== undefined &&
			props.decision.commercial_intent !== null
		) {
			return Math.round(props.decision.commercial_intent * 100);
		}
		const u = (props.username || '').toLowerCase();
		if (
			['bank', 'pay', 'crypto', 'ton', 'market', 'trade', 'shop', 'vip'].some((k) => u.includes(k))
		) {
			return 94;
		}
		return u.length <= 5 ? 78 : 55;
	};

	const biddingWarPotential = () => {
		if (
			props.decision?.bidding_war_potential !== undefined &&
			props.decision.bidding_war_potential !== null
		) {
			return Math.round(props.decision.bidding_war_potential * 100);
		}
		const u = (props.username || '').toLowerCase();
		if (u.length <= 4) return 92;
		if (u.length <= 6) return 74;
		return 45;
	};

	const auctionTactics = () => {
		if (props.decision?.auction_tactics) return props.decision.auction_tactics;
		const b = biddingWarPotential();
		if (b >= 80) return layaT(USERNAME_I18N.auctionTacticsAggressive);
		if (b >= 60) return layaT(USERNAME_I18N.auctionTacticsBuyNow);
		return layaT(USERNAME_I18N.auctionTacticsStandard);
	};

	const culturalResonance = () => {
		if (props.decision?.cultural_resonance) return props.decision.cultural_resonance;
		return layaT(USERNAME_I18N.universalWeb3);
	};

	return (
		<div class="frag-card w-full p-4 flex flex-col gap-3.5 text-start">
			<FragSectionHeader
				icon="cognition"
				title={layaT(USERNAME_I18N.cardTitle)}
				subtitle={layaT(USERNAME_I18N.cardSubtitle)}
				right={
					<span class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-mono text-[#4cd964] bg-[#4cd964]/10 border border-[#4cd964]/25">
						{layaT(USERNAME_I18N.liveAuditBadge)}
					</span>
				}
			/>

			<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
				{/* 1. Phonetic Memorability */}
				<div class="frag-inset p-3 flex flex-col justify-between gap-2">
					<span class="text-[11px] text-[#8c9ba5]">{layaT(USERNAME_I18N.phoneticTitle)}</span>
					<div class="flex items-baseline gap-1 font-mono" dir="ltr">
						<span class="text-[22px] font-semibold text-white tabular-nums leading-none">
							{phoneticScore()}
						</span>
						<span class="text-[11px] text-[#60707c]">/ 10</span>
					</div>
					<div class="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
						<div
							class="h-full rounded-full bg-[#2990FF]"
							style={{ width: `${Math.min(100, phoneticScore() * 10)}%` }}
						/>
					</div>
					<span class="text-[11px] text-[#8c9ba5] leading-snug">
						{phoneticScore() >= 8
							? layaT(USERNAME_I18N.phoneticTopTier)
							: phoneticScore() >= 6
								? layaT(USERNAME_I18N.phoneticFluent)
								: layaT(USERNAME_I18N.phoneticStandard)}
					</span>
				</div>

				{/* 2. Commercial Intent */}
				<div class="frag-inset p-3 flex flex-col justify-between gap-2">
					<span class="text-[11px] text-[#8c9ba5]">
						{layaT(USERNAME_I18N.commercialIntentTitle)}
					</span>
					<div class="flex items-baseline gap-1.5 font-mono" dir="ltr">
						<span class="text-[22px] font-semibold text-[#4cd964] tabular-nums leading-none">
							{commercialIntent()}%
						</span>
						<span class="text-[11px] text-[#60707c]">
							({(commercialIntent() / 100).toFixed(2)})
						</span>
					</div>
					<div class="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
						<div
							class="h-full rounded-full bg-[#4cd964]"
							style={{ width: `${Math.min(100, commercialIntent())}%` }}
						/>
					</div>
					<span class="text-[11px] text-[#8c9ba5] leading-snug">
						{commercialIntent() >= 75
							? layaT(USERNAME_I18N.commercialIntentHigh)
							: commercialIntent() >= 50
								? layaT(USERNAME_I18N.commercialIntentMedium)
								: layaT(USERNAME_I18N.commercialIntentPersonal)}
					</span>
				</div>

				{/* 3. Bidding War Potential */}
				<div class="frag-inset p-3 flex flex-col justify-between gap-2">
					<span class="text-[11px] text-[#8c9ba5]">{layaT(USERNAME_I18N.biddingWarTitle)}</span>
					<div class="flex items-baseline gap-1.5 font-mono" dir="ltr">
						<span class="text-[22px] font-semibold text-[#ffb340] tabular-nums leading-none">
							{biddingWarPotential()}%
						</span>
						<span class="text-[11px] text-[#60707c]">
							({(biddingWarPotential() / 100).toFixed(2)})
						</span>
					</div>
					<div class="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
						<div
							class="h-full rounded-full bg-[#ffb340]"
							style={{ width: `${Math.min(100, biddingWarPotential())}%` }}
						/>
					</div>
					<span class="text-[11px] text-[#8c9ba5] leading-snug">
						{biddingWarPotential() >= 75
							? layaT(USERNAME_I18N.biddingWarExtreme)
							: biddingWarPotential() >= 50
								? layaT(USERNAME_I18N.biddingWarModerate)
								: layaT(USERNAME_I18N.biddingWarOrderly)}
					</span>
				</div>
			</div>

			{/* Tactical Auction Playbook Strategy */}
			<div class="frag-inset p-3.5 flex flex-col gap-1.5">
				<div class="flex items-center justify-between gap-2">
					<span class="text-[12px] font-semibold text-[#2990FF] flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[15px]">strategy</span>
						{layaT(USERNAME_I18N.auctionTacticsTitle)}
					</span>
					<span class="text-[11px] font-mono text-[#a9b6bf] bg-white/[0.04] border border-white/[0.07] px-2 py-0.5 rounded-[6px]">
						{culturalResonance()}
					</span>
				</div>
				<p class="text-[12px] text-[#d0d7dd] leading-relaxed">{auctionTactics()}</p>
			</div>
		</div>
	);
};
