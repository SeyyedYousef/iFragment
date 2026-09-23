import { type Component, createSignal, For } from 'solid-js';
import { isRtl } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export interface ClubTierItem {
	id: string;
	titleFa: string;
	titleEn: string;
	floorTon: number;
	floorUsd: number;
	totalSupply: number;
	topSaleTon: number;
	icon: string;
	color: string;
	descriptionFa: string;
	descriptionEn: string;
	sampleNumber: string;
}

const CLUB_TIERS: ClubTierItem[] = [
	{
		id: 'genesis_4digit',
		titleFa: 'کلاب ۴ رقمی گنسیس (Genesis 4-Digit)',
		titleEn: 'Genesis 4-Digit Club',
		floorTon: 240,
		floorUsd: 1320,
		totalSupply: 10000,
		topSaleTon: 15500,
		icon: 'stars',
		color: '#ffaa00',
		descriptionFa: 'اولین شماره‌های ضرب‌شده در دسامبر ۲۰۲۲ با طول ۴ رقم (+888 0000 تا +888 9999).',
		descriptionEn: 'The original 4-digit Genesis tier minted in Dec 2022 (+888 0000 to +888 9999).',
		sampleNumber: '+888 0888',
	},
	{
		id: 'octa_club',
		titleFa: 'کلاب اکتا تک‌رقمی (Octa Repdigit)',
		titleEn: 'Octa Monodigit Club',
		floorTon: 2800,
		floorUsd: 15400,
		totalSupply: 10,
		topSaleTon: 45000,
		icon: 'military_tech',
		color: '#ef4444',
		descriptionFa: 'شماره‌های دارای ۸ رقم کاملاً یکسان؛ فوق‌نایاب‌ترین و گران‌ترین کلکسیون تلگرام.',
		descriptionEn: 'Extremely scarce numbers with 8 identical repeating digits (Holy Grail).',
		sampleNumber: '+888 8888 8888',
	},
	{
		id: 'vanity_doubles',
		titleFa: 'کلاب جفت‌های متقارن (Vanity Doubles)',
		titleEn: 'Vanity Doubles & Mirrors',
		floorTon: 75,
		floorUsd: 412,
		totalSupply: 4500,
		topSaleTon: 3200,
		icon: 'swap_horiz',
		color: '#0098EA',
		descriptionFa: 'الگوهای جفت‌جفت متقارن (مانند AABBCCDD یا ABABCDCD) با روانی تایپ بسیار بالا.',
		descriptionEn: 'Symmetric paired patterns with high visual rhythm and cadence.',
		sampleNumber: '+888 0011 2233',
	},
	{
		id: 'sequential_steppers',
		titleFa: 'کلاب پله‌ای صعودی/نزولی (Steppers)',
		titleEn: 'Sequential Steppers Club',
		floorTon: 120,
		floorUsd: 660,
		totalSupply: 1200,
		topSaleTon: 4800,
		icon: 'stairs',
		color: '#10b981',
		descriptionFa: 'توالی‌های ترتیبی ریاضی صعودی یا نزولی که به راحتی در حافظه ثبت می‌شوند.',
		descriptionEn: 'Pure ascending or descending sequences with high recall velocity.',
		sampleNumber: '+888 1234 5678',
	},
	{
		id: 'sub_1000',
		titleFa: 'کلاب زیر ۱۰۰۰ (Sub-1000 Low IDs)',
		titleEn: 'Sub-1000 Low Numbers',
		floorTon: 550,
		floorUsd: 3025,
		totalSupply: 999,
		topSaleTon: 18000,
		icon: 'workspace_premium',
		color: '#a855f7',
		descriptionFa: 'شماره‌های ۳ رقمی با پیشوند صفر (+888 0001 تا +888 0999)؛ دارایی تاریخی تلگرام.',
		descriptionEn: 'Ultra-low prefix numbers (+888 0001 to +888 0999) held by early adopters.',
		sampleNumber: '+888 0042',
	},
];

interface Props {
	onSelectNumber?: (num: string) => void;
}

export const NumberClubFloorsTracker: Component<Props> = (props) => {
	const [activeClub, setActiveClub] = createSignal<string>('genesis_4digit');

	const current = () => CLUB_TIERS.find((c) => c.id === activeClub()) || CLUB_TIERS[0];

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
							{isRtl() ? 'ردیاب کف قیمت کلاب‌ها (Club Tier Floors)' : 'COLLECTIBLE CLUB TIER FLOORS'}
						</h4>
						<span class="text-[9px] font-mono text-white/40">
							{isRtl() ? 'پایش لحظه‌ای عرضه، کف قیمت و رکورد فروش' : 'Dynamic supply, floor prices & historical ATH'}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-md">
					5 CORE TIERS
				</span>
			</div>

			{/* Horizontal Club Tabs */}
			<div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
				<For each={CLUB_TIERS}>
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
										{isRtl() ? club.titleFa.split('(')[0] : club.titleEn}
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
							{isRtl() ? current().titleFa : current().titleEn}
						</span>
					</div>
					<span class="text-[10px] font-mono font-bold text-white/50 bg-white/5 px-2.5 py-0.5 rounded-[8px]">
						{current().totalSupply.toLocaleString()} {isRtl() ? 'عدد در جهان' : 'total supply'}
					</span>
				</div>

				<p class="text-[11px] text-white/70 leading-relaxed font-medium">
					{isRtl() ? current().descriptionFa : current().descriptionEn}
				</p>

				{/* 3 Metric Pills: Floor, Top Sale, Sample */}
				<div class="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
					<div class="bg-white/[0.02] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
						<span class="text-white/40 uppercase">{isRtl() ? 'کف قیمت فعلی' : 'Floor Ask'}</span>
						<span class="text-[13px] font-black text-amber-400">{current().floorTon} TON</span>
						<span class="text-[9px] text-white/40">≈ ${current().floorUsd}</span>
					</div>

					<div class="bg-white/[0.02] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
						<span class="text-white/40 uppercase">{isRtl() ? 'رکورد معامله (ATH)' : 'Top Sale ATH'}</span>
						<span class="text-[13px] font-black text-emerald-400">
							{current().topSaleTon.toLocaleString()} TON
						</span>
						<span class="text-[9px] text-white/40">Verified On-Chain</span>
					</div>

					<div class="bg-white/[0.02] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
						<span class="text-white/40 uppercase">{isRtl() ? 'نمونه شاخص' : 'Sample Number'}</span>
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
						<span class="text-[9px] text-[#0098EA]/60">{isRtl() ? 'کلیک برای ارزیابی' : 'Tap to valuate'}</span>
					</div>
				</div>
			</div>
		</div>
	);
};
