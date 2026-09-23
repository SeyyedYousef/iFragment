import { type Component, Show } from 'solid-js';
import { layaT, USERNAME_I18N } from '@/shared/i18n/laya-i18n.js';

export interface TrademarkRiskData {
	risk_level?: string; // "low" | "medium" | "high"
	matched_entity?: string;
	brand?: string;
	advisory_warning?: string;
	risk_score?: number;
}

interface Props {
	trademarkRisk?: TrademarkRiskData | null;
	username: string;
}

export const TelegramTOSLegalMatrix: Component<Props> = (props) => {
	const riskLevel = () => (props.trademarkRisk?.risk_level || 'low').toLowerCase();

	const riskScore = () => {
		if (props.trademarkRisk?.risk_score !== undefined && props.trademarkRisk.risk_score !== null) {
			return props.trademarkRisk.risk_score;
		}
		if (riskLevel() === 'high') return 92;
		if (riskLevel() === 'medium') return 65;
		return 10;
	};

	const isHighRisk = () => riskLevel() === 'high' || riskScore() >= 80;
	const isMediumRisk = () => riskLevel() === 'medium' || (riskScore() >= 50 && riskScore() < 80);

	const riskBadgeText = () => {
		if (isHighRisk()) return layaT(USERNAME_I18N.riskHigh);
		if (isMediumRisk()) return layaT(USERNAME_I18N.riskMedium);
		return layaT(USERNAME_I18N.riskClean);
	};

	const advisoryText = () => {
		if (props.trademarkRisk?.advisory_warning) return props.trademarkRisk.advisory_warning;
		if (isHighRisk()) return layaT(USERNAME_I18N.advisoryHigh);
		if (isMediumRisk()) return layaT(USERNAME_I18N.advisoryMedium);
		return layaT(USERNAME_I18N.advisoryClean);
	};

	return (
		<div
			class={`w-full backdrop-blur-2xl border rounded-[28px] p-5 flex flex-col gap-4 text-start shadow-xl relative overflow-hidden transition-all ${
				isHighRisk()
					? 'bg-gradient-to-br from-rose-950/40 via-[#12141C] to-rose-900/20 border-rose-500/50 shadow-rose-950/30'
					: isMediumRisk()
						? 'bg-gradient-to-br from-amber-950/30 via-[#12141C] to-[#08090D] border-amber-500/40 shadow-amber-950/20'
						: 'bg-gradient-to-br from-emerald-950/20 via-[#12141C] to-[#08090D] border-white/10'
			}`}
		>
			{/* Ambient Tint Glow */}
			<div
				class="absolute -right-12 -top-12 w-36 h-36 blur-3xl rounded-full pointer-events-none opacity-20"
				style={{
					'background-color': isHighRisk() ? '#f43f5e' : isMediumRisk() ? '#f59e0b' : '#10b981',
				}}
			/>

			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3 relative z-10">
				<div class="flex items-center gap-2.5">
					<div
						class={`w-9 h-9 rounded-[14px] flex items-center justify-center border shadow-inner ${
							isHighRisk()
								? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
								: isMediumRisk()
									? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
									: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
						}`}
					>
						<span class="material-symbols-outlined text-[20px]">gavel</span>
					</div>
					<div class="flex flex-col">
						<h4 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{layaT(USERNAME_I18N.legalMatrixTitle)}
						</h4>
						<span class="text-[9px] font-mono text-white/40">
							{layaT(USERNAME_I18N.legalMatrixSubtitle)}
						</span>
					</div>
				</div>

				<div class="flex items-center gap-1.5">
					<span
						class={`text-[9px] font-mono font-black uppercase px-2.5 py-1 rounded-[8px] border shadow-sm ${
							isHighRisk()
								? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
								: isMediumRisk()
									? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
									: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
						}`}
					>
						{riskBadgeText()}
					</span>
				</div>
			</div>

			{/* Risk Meter & Score */}
			<div class="flex items-center justify-between bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 relative z-10">
				<div class="flex flex-col">
					<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
						{layaT(USERNAME_I18N.legalIndexTitle)}
					</span>
					<div class="flex items-baseline gap-2 mt-0.5">
						<span
							class="text-[26px] font-mono font-black leading-none"
							style={{
								color: isHighRisk() ? '#f43f5e' : isMediumRisk() ? '#f59e0b' : '#10b981',
							}}
						>
							{riskScore()}
						</span>
						<span class="text-[11px] font-mono font-bold text-white/30">/ 100</span>
					</div>
				</div>

				<Show when={props.trademarkRisk?.matched_entity || props.trademarkRisk?.brand}>
					<div class="flex flex-col items-end">
						<span class="text-[9px] font-mono text-white/40 uppercase">
							{layaT(USERNAME_I18N.directTrademarkMatch)}
						</span>
						<span class="text-xs font-mono font-black text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 rounded-md mt-0.5">
							{props.trademarkRisk?.matched_entity || props.trademarkRisk?.brand}
						</span>
					</div>
				</Show>
				<Show when={!props.trademarkRisk?.matched_entity && !props.trademarkRisk?.brand}>
					<div class="flex items-center gap-1.5 text-emerald-400 text-[10px] font-mono">
						<span class="material-symbols-outlined text-[16px]">verified</span>
						<span>{layaT(USERNAME_I18N.noInfringementDetected)}</span>
					</div>
				</Show>
			</div>

			{/* Advisory Message */}
			<p class="text-[11px] text-white/80 leading-relaxed relative z-10 font-sans">
				{advisoryText()}
			</p>

			{/* Official Telegram Terms of Service Section 4 Box */}
			<div class="w-full bg-[#08090D]/90 border border-white/10 rounded-[20px] p-4 flex flex-col gap-2.5 relative z-10 shadow-inner">
				<div class="flex items-center justify-between border-b border-white/5 pb-2">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-[16px] text-cyan-400">policy</span>
						<span class="text-[11px] font-mono font-black text-white uppercase tracking-wider">
							{layaT(USERNAME_I18N.section4BoxTitle)}
						</span>
					</div>
					<a
						href="https://telegram.org/tos"
						target="_blank"
						rel="noopener noreferrer"
						class="text-[10px] font-mono font-bold text-[#0098EA] hover:underline flex items-center gap-1"
					>
						<span>{layaT(USERNAME_I18N.readOfficialTos)}</span>
						<span class="material-symbols-outlined text-[12px]">open_in_new</span>
					</a>
				</div>

				<div class="flex flex-col gap-2 text-[11px] leading-relaxed">
					{/* Official Excerpt in User Language */}
					<div class="p-2.5 rounded-[12px] bg-white/[0.03] border border-white/5 font-mono text-[10px] text-white/80">
						<strong class="text-white block mb-0.5">{layaT(USERNAME_I18N.section4QuoteTitle)}</strong>
						<p class="italic">
							{layaT(USERNAME_I18N.section4Quote)}
						</p>
					</div>

					{/* Legal Analysis */}
					<p class="text-[11px] text-white/80 font-medium font-sans">
						<strong class="text-white">{layaT(USERNAME_I18N.legalAnalysisTitle)}</strong>{' '}
						{layaT(USERNAME_I18N.legalAnalysisText)}
					</p>
				</div>
			</div>
		</div>
	);
};
