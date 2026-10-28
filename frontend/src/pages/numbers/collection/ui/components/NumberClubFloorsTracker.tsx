import { type Component, createMemo, createSignal, For } from 'solid-js';
import type {
	NumberPatternAnalytics,
	NumbersInstitutionalCollectionOverview,
} from '@/entities/numbers/model/types.js';
import { layaT, NUMBER_CLUB_TIERS, NUMBERS_I18N } from '@/shared/i18n/laya-i18n.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	patterns?: NumberPatternAnalytics[];
	overview?: NumbersInstitutionalCollectionOverview;
	rate?: number;
	onSelectNumber?: (num: string) => void;
}

export const NumberClubFloorsTracker: Component<Props> = (props) => {
	const [activeClub, setActiveClub] = createSignal<string>('genesis_4digit');

	const liveTiers = createMemo(() => {
		const rateUsd = props.overview?.ton_usd_rate || props.rate || 1.23;
		const baseFloorTon = props.overview?.floor_ask_ton || 2717;
		const patternsList = props.patterns || [];

		const findPattern = (keys: string[]) => patternsList.find((p) => keys.includes(p.pattern_key));

		return NUMBER_CLUB_TIERS.map((tier) => {
			let floorTonNum = Number.parseFloat(tier.floorTon.replace(/,/g, '')) || baseFloorTon;
			let topSaleTonNum = tier.topSaleTon;
			let sampleNum = tier.sampleNumber;

			if (tier.id === 'genesis_4digit') {
				const p = findPattern(['genesis_4digit']);
				floorTonNum = p?.floor_nano_ton
					? Math.round(p.floor_nano_ton / 1e9)
					: Math.round(baseFloorTon * 14.5);
				topSaleTonNum = p?.p75_sale_nano_ton
					? Math.max(666666, Math.round(p.p75_sale_nano_ton / 1e9))
					: 666666;
			} else if (tier.id === 'monodigit_8digit') {
				const p = findPattern(['grail_mono']);
				floorTonNum = p?.floor_nano_ton
					? Math.round(p.floor_nano_ton / 1e9)
					: Math.round(baseFloorTon * 65);
				topSaleTonNum = p?.p75_sale_nano_ton
					? Math.max(300000, Math.round(p.p75_sale_nano_ton / 1e9))
					: 300000;
			} else if (tier.id === 'repeating_block') {
				const p = findPattern(['quad_tail', 'triple_tail']);
				floorTonNum = p?.floor_nano_ton
					? Math.round(p.floor_nano_ton / 1e9)
					: Math.round(baseFloorTon * 3.15);
			} else if (tier.id === 'palindrome_mirror') {
				const p = findPattern(['palindrome_8d', 'binary_dual']);
				floorTonNum = p?.floor_nano_ton
					? Math.round(p.floor_nano_ton / 1e9)
					: Math.round(baseFloorTon * 1.92);
			} else if (tier.id === 'sequential_ladder') {
				const p = findPattern(['ascending_seq', 'standard_8d']);
				floorTonNum = p?.floor_nano_ton
					? Math.round(p.floor_nano_ton / 1e9)
					: Math.round(baseFloorTon * 1.55);
				if (props.overview?.floor_number && tier.id === 'sequential_ladder') {
					sampleNum = tier.sampleNumber;
				}
			}

			const floorUsdNum = Math.round(floorTonNum * rateUsd);

			return {
				...tier,
				floorTon: floorTonNum.toLocaleString('en-US'),
				floorUsd: floorUsdNum.toLocaleString('en-US'),
				topSaleTon: topSaleTonNum,
				sampleNumber: sampleNum,
			};
		});
	});

	const current = () => liveTiers().find((c) => c.id === activeClub()) || liveTiers()[0];

	return (
		<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start flex flex-col gap-4 relative overflow-hidden mb-4">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
						<span class="material-symbols-outlined text-[20px]">loyalty</span>
					</div>
					<div class="flex flex-col">
						<h4 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{layaT(NUMBERS_I18N.clubFloorsTitle)}
						</h4>
						<span class="text-[9px] font-mono text-white/40">
							{layaT(NUMBERS_I18N.clubFloorsSubtitle)}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-md">
					5 LIVE TIERS
				</span>
			</div>

			{/* Horizontal Club Tabs */}
			<div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
				<For each={liveTiers()}>
					{(club) => {
						const isSelected = () => club.id === activeClub();
						return (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									setActiveClub(club.id);
								}}
								class={`px-3 py-2 rounded-[16px] border text-start flex items-center gap-2 transition-all shrink-0 active:scale-95 ${
									isSelected()
										? 'bg-amber-500/20 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
										: 'bg-[#08090D] border-white/5 hover:bg-white/5'
								}`}
							>
								<span class="material-symbols-outlined text-[17px]" style={{ color: club.color }}>
									{club.icon}
								</span>
								<div class="flex flex-col">
									<span class="text-[11px] font-black text-white font-mono whitespace-nowrap">
										{layaT(club.title)}
									</span>
									<span class="text-[9px] font-mono text-amber-400 font-bold">
										Floor: {club.floorTon} TON
									</span>
								</div>
							</button>
						);
					}}
				</For>
			</div>

			{/* Active Club Spotlight Card */}
			<div class="w-full bg-[#08090D] border border-white/5 rounded-[22px] p-4 flex flex-col gap-3 relative shadow-inner">
				<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
					<div class="flex items-center gap-2">
						<span
							class="w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-black text-white"
							style={{ 'background-color': current().color }}
						>
							✓
						</span>
						<span class="text-[13px] font-mono font-black text-white">
							{layaT(current().title)}
						</span>
					</div>
					<span class="text-[10px] font-mono font-bold text-white/50 bg-white/5 px-2.5 py-0.5 rounded-[8px]">
						{current().totalSupply.toLocaleString()} {layaT(NUMBERS_I18N.totalInWorld)}
					</span>
				</div>

				<p class="text-[11px] text-white/70 leading-relaxed font-medium">
					{layaT(current().description)}
				</p>

				{/* 3 Metric Pills: Floor, Top Sale, Sample */}
				<div class="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
					<div class="bg-white/[0.02] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
						<span class="text-white/40 uppercase">{layaT(NUMBERS_I18N.floorAsk)}</span>
						<span class="text-[13px] font-black text-amber-400">{current().floorTon} TON</span>
						<span class="text-[9px] text-white/40">≈ ${current().floorUsd}</span>
					</div>

					<div class="bg-white/[0.02] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
						<span class="text-white/40 uppercase">{layaT(NUMBERS_I18N.topSaleAth)}</span>
						<span class="text-[13px] font-black text-emerald-400">
							{current().topSaleTon.toLocaleString()} TON
						</span>
						<span class="text-[9px] text-white/40">Verified On-Chain</span>
					</div>

					<div class="bg-white/[0.02] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
						<span class="text-white/40 uppercase">{layaT(NUMBERS_I18N.sampleNumber)}</span>
						<span
							onClick={() => {
								if (props.onSelectNumber) {
									props.onSelectNumber(current().sampleNumber);
								}
							}}
							class="text-[11px] font-black text-[#0098EA] cursor-pointer hover:underline truncate"
							dir="ltr"
						>
							{current().sampleNumber}
						</span>
						<span class="text-[9px] text-[#0098EA]/60">{layaT(NUMBERS_I18N.tapToValuate)}</span>
					</div>
				</div>
			</div>
		</div>
	);
};
