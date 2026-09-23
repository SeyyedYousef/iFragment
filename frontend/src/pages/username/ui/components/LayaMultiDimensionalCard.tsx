import { type Component } from 'solid-js';
import { layaT, USERNAME_I18N } from '@/shared/i18n/laya-i18n.js';

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
	// Fallback-safe metrics calculation derived deterministically from handle features if empty
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
		if (props.decision?.commercial_intent !== undefined && props.decision.commercial_intent !== null) {
			return Math.round(props.decision.commercial_intent * 100);
		}
		const u = (props.username || '').toLowerCase();
		if (['bank', 'pay', 'crypto', 'ton', 'market', 'trade', 'shop', 'vip'].some((k) => u.includes(k))) {
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
		<div class="w-full bg-gradient-to-br from-[#0c1322] via-[#12141C] to-[#08090D] border border-[#0098EA]/30 rounded-[28px] p-5 flex flex-col gap-4 shadow-[0_12px_36px_rgba(0,152,234,0.18)] text-start relative overflow-hidden">
			{/* Ambient Cyan/Blue Glow */}
			<div class="absolute -left-12 -top-12 w-36 h-36 bg-[#0098EA]/15 blur-3xl rounded-full pointer-events-none" />

			{/* Card Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3 relative z-10">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-[#0098EA]/15 border border-[#0098EA]/40 flex items-center justify-center text-[#0098EA] shadow-inner">
						<span class="material-symbols-outlined text-[20px]">cognition</span>
					</div>
					<div class="flex flex-col">
						<h4 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{layaT(USERNAME_I18N.cardTitle)}
						</h4>
						<span class="text-[9px] font-mono text-[#0098EA] font-semibold">
							{layaT(USERNAME_I18N.cardSubtitle)}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-[8px] shadow-sm">
					{layaT(USERNAME_I18N.liveAuditBadge)}
				</span>
			</div>

			{/* 3 Core Multi-Dimensional Gauges */}
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 relative z-10">
				{/* 1. Phonetic Memorability */}
				<div class="bg-[#08090D] border border-white/5 rounded-[20px] p-3.5 flex flex-col justify-between gap-2 shadow-inner">
					<div class="flex items-center justify-between">
						<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
							{layaT(USERNAME_I18N.phoneticTitle)}
						</span>
						<span class="material-symbols-outlined text-[15px] text-[#0098EA]">record_voice_over</span>
					</div>
					<div class="flex items-baseline gap-1.5">
						<span class="text-[24px] font-mono font-black text-white leading-none">
							{phoneticScore()}
						</span>
						<span class="text-[11px] font-mono font-bold text-white/40">/ 10</span>
					</div>
					{/* Progress Bar */}
					<div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
						<div
							class="h-full rounded-full bg-gradient-to-r from-[#0098EA] to-cyan-400"
							style={{ width: `${phoneticScore() * 10}%` }}
						/>
					</div>
					<span class="text-[9px] text-white/40 font-mono">
						{phoneticScore() >= 8
							? layaT(USERNAME_I18N.phoneticTopTier)
							: phoneticScore() >= 6
								? layaT(USERNAME_I18N.phoneticFluent)
								: layaT(USERNAME_I18N.phoneticStandard)}
					</span>
				</div>

				{/* 2. Commercial Intent */}
				<div class="bg-[#08090D] border border-white/5 rounded-[20px] p-3.5 flex flex-col justify-between gap-2 shadow-inner">
					<div class="flex items-center justify-between">
						<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
							{layaT(USERNAME_I18N.commercialIntentTitle)}
						</span>
						<span class="material-symbols-outlined text-[15px] text-emerald-400">trending_up</span>
					</div>
					<div class="flex items-baseline gap-1.5">
						<span class="text-[24px] font-mono font-black text-emerald-400 leading-none">
							{commercialIntent()}%
						</span>
						<span class="text-[10px] font-mono font-bold text-white/40">
							({(commercialIntent() / 100).toFixed(2)})
						</span>
					</div>
					{/* Progress Bar */}
					<div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
						<div
							class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
							style={{ width: `${commercialIntent()}%` }}
						/>
					</div>
					<span class="text-[9px] text-white/40 font-mono">
						{commercialIntent() >= 75
							? layaT(USERNAME_I18N.commercialIntentHigh)
							: commercialIntent() >= 50
								? layaT(USERNAME_I18N.commercialIntentMedium)
								: layaT(USERNAME_I18N.commercialIntentPersonal)}
					</span>
				</div>

				{/* 3. Bidding War Potential */}
				<div class="bg-[#08090D] border border-white/5 rounded-[20px] p-3.5 flex flex-col justify-between gap-2 shadow-inner">
					<div class="flex items-center justify-between">
						<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
							{layaT(USERNAME_I18N.biddingWarTitle)}
						</span>
						<span class="material-symbols-outlined text-[15px] text-amber-400">
							local_fire_department
						</span>
					</div>
					<div class="flex items-baseline gap-1.5">
						<span class="text-[24px] font-mono font-black text-amber-400 leading-none">
							{biddingWarPotential()}%
						</span>
						<span class="text-[10px] font-mono font-bold text-white/40">
							({(biddingWarPotential() / 100).toFixed(2)})
						</span>
					</div>
					{/* Progress Bar */}
					<div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
						<div
							class="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
							style={{ width: `${biddingWarPotential()}%` }}
						/>
					</div>
					<span class="text-[9px] text-white/40 font-mono">
						{biddingWarPotential() >= 75
							? layaT(USERNAME_I18N.biddingWarExtreme)
							: biddingWarPotential() >= 50
								? layaT(USERNAME_I18N.biddingWarModerate)
								: layaT(USERNAME_I18N.biddingWarOrderly)}
					</span>
				</div>
			</div>

			{/* Tactical Auction Playbook Strategy */}
			<div class="bg-gradient-to-r from-[#0098EA]/10 via-[#08090D] to-[#08090D] border border-[#0098EA]/20 rounded-[18px] p-3.5 flex flex-col gap-1.5 relative z-10">
				<div class="flex items-center justify-between">
					<span class="text-[10px] font-mono font-black text-[#0098EA] uppercase tracking-wider flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[15px]">strategy</span>
						{layaT(USERNAME_I18N.auctionTacticsTitle)}:
					</span>
					<span class="text-[9px] font-mono text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 rounded">
						{culturalResonance()}
					</span>
				</div>
				<p class="text-[11px] text-white/80 font-medium leading-relaxed">
					{auctionTactics()}
				</p>
			</div>
		</div>
	);
};
