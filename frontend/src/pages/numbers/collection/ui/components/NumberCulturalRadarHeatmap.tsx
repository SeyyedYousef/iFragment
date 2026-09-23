import { type Component, createSignal, For, Show } from 'solid-js';
import { isRtl } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export interface RegionalCulturalIntel {
	id: string;
	regionFa: string;
	regionEn: string;
	affinityFa: string;
	affinityEn: string;
	score: number;
	favoriteDigits: string[];
	avoidDigits: string[];
	marketDemandFa: string;
	marketDemandEn: string;
	icon: string;
	color: string;
	samplePattern: string;
}

const REGIONAL_DATA: RegionalCulturalIntel[] = [
	{
		id: 'china_east_asia',
		regionFa: 'چین و آسیای شرقی (China & East Asia)',
		regionEn: 'China & East Asia',
		affinityFa: 'شیفتگی به عدد ۸ (نماد ثروت Fa) و عدد ۶ (جریان روان)؛ اجتناب شدید از عدد ۴ (تترافوبیا).',
		affinityEn: 'High affinity for 8 (Wealth) & 6 (Smooth Flow); strict avoidance of 4 (Tetraphobia).',
		score: 96,
		favoriteDigits: ['8', '6', '9'],
		avoidDigits: ['4'],
		marketDemandFa: 'بسیار بالا برای الگوهای بدون ۴ دارای تکرار ۸۸۸۸.',
		marketDemandEn: 'Extreme bidding on 4-free patterns with repeating 8s.',
		icon: 'temple_buddhist',
		color: '#ef4444',
		samplePattern: '+888 8888 8888 / +888 6688 8866',
	},
	{
		id: 'mena_arab',
		regionFa: 'خاورمیانه و خلیج فارس (MENA & Arab Gulf)',
		regionEn: 'Middle East & Arab Gulf',
		affinityFa: 'تقاضای شماره‌های رند VIP، کدهای طلایی جفت، تقارن آینه‌ای و توالی‌های تمیز تلفن همراه.',
		affinityEn: 'Prestige VIP mobile codes, clean mirror symmetry, and golden repeat pairs.',
		score: 91,
		favoriteDigits: ['7', '0', '1', '5'],
		avoidDigits: [],
		marketDemandFa: 'بالاترین میانگین پرداخت دلاری برای شماره‌های متقارن و رند.',
		marketDemandEn: 'Highest per-item cash price clearance for symmetric vanity.',
		icon: 'mosque',
		color: '#0098EA',
		samplePattern: '+888 0707 0707 / +888 1000 0001',
	},
	{
		id: 'russia_cis',
		regionFa: 'روسیه و اروپای شرقی (Russia & CIS)',
		regionEn: 'Russia & Eastern Europe',
		affinityFa: 'کدهای اپراتورهای نام‌آشنا، تقارن پلاک خودروهای اشرافی (Car-Plate Vanity) و تکرار سه‌تایی.',
		affinityEn: 'Nostalgic telecom dial codes, luxury vehicle plate mirrors, and triple clusters.',
		score: 84,
		favoriteDigits: ['7', '9', '0', '3'],
		avoidDigits: [],
		marketDemandFa: 'نقدینگی دائمی با سرعت گردش معامله بالا در فرگمنت.',
		marketDemandEn: 'Continuous high-frequency secondary trade volume.',
		icon: 'fort',
		color: '#10b981',
		samplePattern: '+888 7999 9997 / +888 0950 0095',
	},
	{
		id: 'west_crypto',
		regionFa: 'غرب و جامعه کریپتو (Western & Crypto Natives)',
		regionEn: 'Western & Crypto Natives',
		affinityFa: 'الگوهای باینری (۰ و ۱)، اعداد پیوسته فیبوناچی، شماره‌های ۳ رقم اول گنسیس و ارگونومی سایبری.',
		affinityEn: 'Binary dual-digits (0 & 1), Fibonacci sequences, and sub-1000 Genesis codes.',
		score: 88,
		favoriteDigits: ['0', '1', '4', '2'],
		avoidDigits: [],
		marketDemandFa: 'تمرکز روی کمیابی ریاضی محض و شناسه‌های ۴ رقمی گنسیس.',
		marketDemandEn: 'Appetite for mathematical brevity & 4-digit Genesis clubs.',
		icon: 'terminal',
		color: '#f59e0b',
		samplePattern: '+888 0101 0101 / +888 0042',
	},
];

export const NumberCulturalRadarHeatmap: Component = () => {
	const [activeRegion, setActiveRegion] = createSignal<string>('china_east_asia');

	const current = () => REGIONAL_DATA.find((r) => r.id === activeRegion()) || REGIONAL_DATA[0];

	return (
		<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start flex flex-col gap-4 relative overflow-hidden mb-4">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center text-[#0098EA]">
						<span class="material-symbols-outlined text-[20px]">public</span>
					</div>
					<div class="flex flex-col">
						<h4 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{isRtl()
								? 'رادار تقاضای فرهنگی چندمنطقه‌ای LAYA'
								: 'LAYA MULTI-CULTURAL DEMAND RADAR'}
						</h4>
						<span class="text-[9px] font-mono text-white/40">
							{isRtl() ? 'کشش فرهنگی بازارهای هدف تلگرام' : 'Cross-regional cultural liquidity pull'}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-[#0098EA] bg-[#0098EA]/10 border border-[#0098EA]/30 px-2 py-0.5 rounded-md">
					GLOBAL NUMEROLOGY
				</span>
			</div>

			{/* 4 Region Selector Pills */}
			<div class="grid grid-cols-2 gap-2">
				<For each={REGIONAL_DATA}>
					{(reg) => {
						const isSelected = () => reg.id === activeRegion();
						return (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									setActiveRegion(reg.id);
								}}
								class={`p-3 rounded-[18px] border text-start flex flex-col gap-1.5 transition-all active:scale-[0.98] ${
									isSelected()
										? 'bg-[#0098EA]/20 border-[#0098EA]/60 shadow-[0_0_20px_rgba(0,152,234,0.25)]'
										: 'bg-[#08090D] border-white/5 hover:bg-white/5'
								}`}
							>
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[16px]" style={{ color: reg.color }}>
											{reg.icon}
										</span>
										<span class="text-[11px] font-black text-white font-mono truncate">
											{isRtl() ? reg.regionFa.split('(')[0] : reg.regionEn}
										</span>
									</div>
									<span class="text-[11px] font-mono font-black text-emerald-400">
										{reg.score}%
									</span>
								</div>
								{/* Mini Heat Bar */}
								<div class="w-full h-1 bg-white/5 rounded-full overflow-hidden">
									<div
										class="h-full rounded-full transition-all duration-500"
										style={{ width: `${reg.score}%`, 'background-color': reg.color }}
									/>
								</div>
							</button>
						);
					}}
				</For>
			</div>

			{/* Selected Region Deep-Dive Box */}
			<div class="w-full bg-[#08090D] border border-white/5 rounded-[20px] p-4 flex flex-col gap-3 relative shadow-inner">
				<div class="flex items-center justify-between border-b border-white/5 pb-2">
					<div class="flex items-center gap-2">
						<span class="w-2.5 h-2.5 rounded-full animate-ping" style={{ 'background-color': current().color }} />
						<span class="text-[12px] font-mono font-black text-white">
							{isRtl() ? current().regionFa : current().regionEn}
						</span>
					</div>
					<span class="text-[10px] font-mono font-bold text-white/50 bg-white/5 px-2 py-0.5 rounded">
						{isRtl() ? 'کشش تقاضا:' : 'Demand Affinity:'} {current().score}/100
					</span>
				</div>

				<p class="text-[11px] text-white/80 leading-relaxed font-medium">
					{isRtl() ? current().affinityFa : current().affinityEn}
				</p>

				{/* Fav / Avoid Digits & Sample Pattern */}
				<div class="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
					<div class="bg-white/[0.02] border border-white/5 rounded-[12px] p-2 flex flex-col gap-1">
						<span class="text-white/40 uppercase">
							{isRtl() ? 'ارقام خوش‌یمن و محبوب:' : 'Auspicious Digits:'}
						</span>
						<div class="flex items-center gap-1">
							<For each={current().favoriteDigits}>
								{(d) => (
									<span class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-black">
										{d}
									</span>
								)}
							</For>
						</div>
					</div>

					<div class="bg-white/[0.02] border border-white/5 rounded-[12px] p-2 flex flex-col gap-1">
						<span class="text-white/40 uppercase">
							{isRtl() ? 'ارقام نامطلوب / اجتنابی:' : 'Avoided Digits:'}
						</span>
						<div class="flex items-center gap-1">
							<Show
								when={current().avoidDigits.length > 0}
								fallback={<span class="text-white/30">{isRtl() ? 'بدون منع' : 'None'}</span>}
							>
								<For each={current().avoidDigits}>
									{(d) => (
										<span class="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center justify-center font-black">
											{d}
										</span>
									)}
								</For>
							</Show>
						</div>
					</div>
				</div>

				{/* Sample High-Demand Pattern */}
				<div class="bg-white/[0.03] border border-white/5 rounded-[12px] p-2.5 flex items-center justify-between text-[11px] font-mono">
					<span class="text-white/40">{isRtl() ? 'نمونه الگوی شاخص:' : 'Iconic Pattern:'}</span>
					<span class="text-amber-400 font-bold" dir="ltr">
						{current().samplePattern}
					</span>
				</div>
			</div>
		</div>
	);
};
