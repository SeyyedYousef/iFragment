import { type Component, For } from 'solid-js';
import { layaT, NUMBERS_I18N } from '@/shared/i18n/laya-i18n.js';
import type { CulturalScore } from '@/entities/numbers/model/types.js';

interface Props {
	radar?: CulturalScore[];
	number: string;
	layaReasoning?: any;
}

export const NumberSingleCulturalRadarCard: Component<Props> = (props) => {
	// Deterministic fallback scores based on digits if radar empty
	const clean = () => (props.number || '').replace(/\D/g, '').replace(/^888/, '');

	const defaultScores = () => {
		const d = clean();
		const count8 = (d.match(/8/g) || []).length;
		const count4 = (d.match(/4/g) || []).length;
		const count7 = (d.match(/7/g) || []).length;
		const count0 = (d.match(/0/g) || []).length;

		let cn = 50 + count8 * 12 - count4 * 20;
		if (cn > 98) cn = 98;
		if (cn < 10) cn = 10;

		let mena = 60 + count0 * 8 + count7 * 10;
		if (mena > 96) mena = 96;

		let ru = 55 + (d.length <= 4 ? 30 : 15);
		if (ru > 95) ru = 95;

		let west = 50 + (d.includes('01') || d.includes('42') || d.length <= 4 ? 35 : 15);
		if (west > 95) west = 95;

		return [
			{ region: 'China / East Asia', score: cn, badge: 'Wealth & 8-Affinity', color: '#ef4444' },
			{ region: 'Middle East / Arab', score: mena, badge: 'Symmetric VIP Code', color: '#0098EA' },
			{ region: 'Russia / Eastern Europe', score: ru, badge: 'Telecom Mirror', color: '#10b981' },
			{ region: 'Western & Web3 Natives', score: west, badge: 'Binary / Minimalist', color: '#f59e0b' },
		];
	};

	const radarList = () => {
		if (props.radar && props.radar.length > 0) {
			return props.radar.map((item) => ({
				region: item.market_name || item.region_key,
				score: item.score,
				badge: item.verdict_en || item.verdict_fa || 'Active',
				color: item.score >= 80 ? '#10b981' : item.score >= 60 ? '#0098EA' : '#f59e0b',
			}));
		}
		return defaultScores();
	};

	return (
		<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start flex flex-col gap-4 relative overflow-hidden">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center text-[#0098EA]">
						<span class="material-symbols-outlined text-[20px]">radar</span>
					</div>
					<div class="flex flex-col">
						<h4 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{layaT(NUMBERS_I18N.singleCulturalTitle)}
						</h4>
						<span class="text-[9px] font-mono text-white/40">
							{layaT(NUMBERS_I18N.singleCulturalSubtitle)}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-cyan-400 bg-cyan-400/10 border border-cyan-400/30 px-2 py-0.5 rounded-md">
					SYSTEM 1 RADAR
				</span>
			</div>

			{/* 4 Regions Grid */}
			<div class="grid grid-cols-2 gap-2.5">
				<For each={radarList()}>
					{(r) => (
						<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3 flex flex-col justify-between gap-1.5 shadow-inner">
							<div class="flex items-center justify-between">
								<span class="text-[10px] font-mono font-bold text-white/80 truncate">
									{r.region}
								</span>
								<span class="text-[12px] font-mono font-black" style={{ color: r.color }}>
									{r.score}%
								</span>
							</div>

							<div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
								<div
									class="h-full rounded-full transition-all duration-700"
									style={{ width: `${r.score}%`, 'background-color': r.color }}
								/>
							</div>

							<span class="text-[8px] font-mono text-white/40 truncate">
								{r.badge}
							</span>
						</div>
					)}
				</For>
			</div>

			{/* Cultural Intelligence Summary */}
			<div class="bg-gradient-to-r from-[#0098EA]/10 via-[#08090D] to-[#08090D] border border-[#0098EA]/20 rounded-[18px] p-3 flex flex-col gap-1">
				<div class="flex items-center gap-1.5 text-[#0098EA] text-[10px] font-mono font-bold">
					<span class="material-symbols-outlined text-[14px]">psychology</span>
					<span>{layaT(NUMBERS_I18N.layaCulturalVerdict)}</span>
				</div>
				<p class="text-[10px] text-white/70 leading-relaxed font-mono">
					{props.layaReasoning?.cultural_resonance ||
						layaT(NUMBERS_I18N.layaCulturalDefaultSummary)}
				</p>
			</div>
		</div>
	);
};
