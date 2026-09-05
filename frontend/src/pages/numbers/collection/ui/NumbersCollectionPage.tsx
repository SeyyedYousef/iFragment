import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

export const NumbersCollectionPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();
	const [selectedTab, setSelectedTab] = createSignal<'overview' | 'clubs' | 'genesis' | 'colors'>(
		'overview',
	);

	const intelQuery = createQuery(() => ({
		queryKey: ['numbersIntelCollection'],
		queryFn: () => numbersApi.getIntel(),
		staleTime: 60 * 1000,
	}));

	const intel = () => intelQuery.data;

	const formatTon = (val?: number | string) => {
		if (!val) return '0';
		const num = typeof val === 'string' ? parseFloat(val) : val;
		return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const CLUBS = [
		{
			name: 'Grail & Mono-digit',
			mask: '+888 8888 8888',
			floor: 185000,
			count: 12,
			bg: 'from-amber-500/20 to-orange-500/20',
			border: 'border-amber-500/30',
			color: 'text-amber-300',
		},
		{
			name: '4-Digit Genesis (1 of 1000)',
			mask: '+888 8XXX',
			floor: 42000,
			count: 1000,
			bg: 'from-cyan-500/20 to-teal-500/20',
			border: 'border-cyan-500/30',
			color: 'text-cyan-300',
		},
		{
			name: 'Quad Repdigit Tail',
			mask: '+888 XXXX 8888',
			floor: 12500,
			count: 850,
			bg: 'from-[#0098EA]/20 to-cyan-500/20',
			border: 'border-[#0098EA]/30',
			color: 'text-[#0098EA]',
		},
		{
			name: 'Triple 777 Tail',
			mask: '+888 XXXX X777',
			floor: 4800,
			count: 2400,
			bg: 'from-emerald-500/20 to-teal-500/20',
			border: 'border-emerald-500/30',
			color: 'text-emerald-300',
		},
		{
			name: 'Standard 8-Digit Floor',
			mask: '+888 XXXX XXXX',
			floor: 2450,
			count: 135566,
			bg: 'from-slate-500/20 to-zinc-500/20',
			border: 'border-white/10',
			color: 'text-white/80',
		},
	];

	const NFT_COLORS = [
		{ name: 'Ocean Blue', hex: '#0098EA', count: 48200, multiplier: 1.0 },
		{ name: 'Emerald Green', hex: '#10b981', count: 32100, multiplier: 1.05 },
		{ name: 'Deep Indigo', hex: '#6366f1', count: 24300, multiplier: 1.12 },
		{ name: 'Sunset Amber', hex: '#f59e0b', count: 18400, multiplier: 1.2 },
		{ name: 'Cyber Neon', hex: '#06b6d4', count: 10200, multiplier: 1.25 },
		{ name: 'Obsidian Black', hex: '#1e293b', count: 3366, multiplier: 1.45 },
	];

	return (
		<div class="pb-36 bg-[#030303] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Background Glows */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[380px] bg-gradient-to-b from-[#0098EA]/15 via-transparent to-transparent blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				{/* Top Navigation */}
				<div class="flex items-center justify-between mb-4">
					<button
						type="button"
						onClick={() => navigate(-1)}
						class="w-10 h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95"
					>
						<span class="material-symbols-outlined text-xl rtl:rotate-180">arrow_back</span>
					</button>

					<div class="text-center flex-1 px-2">
						<h1 class="text-base font-black text-white flex items-center justify-center gap-1.5">
							<span>Telegram Anonymous Numbers</span>
							<span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
								+888
							</span>
						</h1>
						<p class="text-[11px] font-medium text-white/50">Collection Intel & Analytics</p>
					</div>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.impact('light');
							} catch {}
							navigate('/numbers/mask');
						}}
						class="w-10 h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-[#0098EA] transition-all active:scale-95"
						title="Mask Builder"
					>
						<span class="material-symbols-outlined text-xl">tune</span>
					</button>
				</div>

				{/* Hero Card */}
				<div class="bg-gradient-to-br from-[#0e131d] to-[#08090D] border border-white/[0.08] rounded-3xl p-5 mb-4 shadow-2xl relative overflow-hidden">
					<div class="flex items-start justify-between mb-4">
						<div>
							<div class="flex items-center gap-2">
								<span class="text-xl font-black text-white font-mono">+888 Series</span>
								<span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold uppercase">
									Closed Collection
								</span>
							</div>
							<p class="text-xs text-white/50 mt-1">136,566 Total Supply · Supply Frozen Forever</p>
						</div>
					</div>

					{/* Metrics Grid */}
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
						<div class="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-3">
							<span class="text-[10px] font-bold text-white/40 block">Floor Price</span>
							<span class="text-sm font-black text-white font-mono block mt-0.5">
								{formatTon(intel()?.floor_price_ton || 2450)}{' '}
								<span class="text-[10px] text-[#0098EA]">TON</span>
							</span>
						</div>
						<div class="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-3">
							<span class="text-[10px] font-bold text-white/40 block">24h Volume</span>
							<span class="text-sm font-black text-emerald-400 font-mono block mt-0.5">
								{formatTon(intel()?.volume_24h_ton || 14850)}{' '}
								<span class="text-[10px] text-white/40">TON</span>
							</span>
						</div>
						<div class="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-3">
							<span class="text-[10px] font-bold text-white/40 block">Total Volume</span>
							<span class="text-sm font-black text-[#0098EA] font-mono block mt-0.5">
								{formatTon(intel()?.total_volume_ton || 48920000)}{' '}
								<span class="text-[10px] text-white/40">TON</span>
							</span>
						</div>
						<div class="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-3">
							<span class="text-[10px] font-bold text-white/40 block">Highest Sale (ATH)</span>
							<span class="text-sm font-black text-amber-400 font-mono block mt-0.5">
								{formatTon(intel()?.historical_ath_ton || 666666)}{' '}
								<span class="text-[10px] text-white/40">TON</span>
							</span>
						</div>
					</div>
				</div>

				{/* Segmented Tab Navigation */}
				<div class="grid grid-cols-4 bg-[#12141C]/90 p-1 rounded-2xl border border-white/10 mb-4 shadow-lg">
					<button
						type="button"
						onClick={() => setSelectedTab('overview')}
						class={`py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
							selectedTab() === 'overview'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25'
								: 'text-white/50 hover:text-white'
						}`}
					>
						Overview
					</button>
					<button
						type="button"
						onClick={() => setSelectedTab('clubs')}
						class={`py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
							selectedTab() === 'clubs'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25'
								: 'text-white/50 hover:text-white'
						}`}
					>
						Clubs
					</button>
					<button
						type="button"
						onClick={() => setSelectedTab('genesis')}
						class={`py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
							selectedTab() === 'genesis'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25'
								: 'text-white/50 hover:text-white'
						}`}
					>
						Genesis
					</button>
					<button
						type="button"
						onClick={() => setSelectedTab('colors')}
						class={`py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
							selectedTab() === 'colors'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25'
								: 'text-white/50 hover:text-white'
						}`}
					>
						Colors
					</button>
				</div>

				{/* Tab 1: Overview */}
				<Show when={selectedTab() === 'overview'}>
					<div class="space-y-4">
						<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-3xl p-5 backdrop-blur-xl">
							<h3 class="text-xs font-black text-white uppercase tracking-wider mb-3">
								About +888 Anonymous Numbers
							</h3>
							<p class="text-xs text-white/70 leading-relaxed">
								Telegram Anonymous Numbers are decentralized NFT identifiers minted via the Fragment
								platform and secured by the TON blockchain (Telemint standard). They enable Telegram
								account authentication without physical SIM cards.
							</p>
						</div>

						{/* Quick Action Navigation */}
						<div class="grid grid-cols-2 gap-2.5">
							<button
								type="button"
								onClick={() => navigate('/numbers/intel')}
								class="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-start transition-all group"
							>
								<span class="material-symbols-outlined text-[#0098EA] text-2xl mb-1 block">
									monitoring
								</span>
								<span class="text-xs font-black text-white block group-hover:text-[#0098EA]">
									Live Market Table
								</span>
								<span class="text-[10px] text-white/40 block mt-0.5">
									Explore 50+ listings with filters
								</span>
							</button>

							<button
								type="button"
								onClick={() => navigate('/numbers/mask')}
								class="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-start transition-all group"
							>
								<span class="material-symbols-outlined text-cyan-400 text-2xl mb-1 block">
									tune
								</span>
								<span class="text-xs font-black text-white block group-hover:text-cyan-400">
									Mask Builder
								</span>
								<span class="text-[10px] text-white/40 block mt-0.5">
									Filter by custom digit masks
								</span>
							</button>
						</div>
					</div>
				</Show>

				{/* Tab 2: Clubs */}
				<Show when={selectedTab() === 'clubs'}>
					<div class="space-y-3">
						<For each={CLUBS}>
							{(club) => (
								<div
									class={`p-4 rounded-2xl bg-gradient-to-r ${club.bg} border ${club.border} flex items-center justify-between`}
								>
									<div>
										<span class={`text-xs font-black ${club.color} block`}>{club.name}</span>
										<span class="text-[10px] font-mono text-white/50 block mt-0.5">
											{club.mask}
										</span>
									</div>
									<div class="text-end">
										<span class="text-xs font-black text-white font-mono block">
											{formatTon(club.floor)} TON
										</span>
										<span class="text-[10px] text-white/40 block">{club.count} numbers</span>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>

				{/* Tab 3: Genesis */}
				<Show when={selectedTab() === 'genesis'}>
					<div class="bg-[#0e131d]/90 border border-cyan-500/30 rounded-3xl p-5 backdrop-blur-xl">
						<div class="flex items-center gap-2 mb-3">
							<span class="px-2.5 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-black">
								4-Digit Genesis (1 of 1000)
							</span>
						</div>
						<p class="text-xs text-white/70 leading-relaxed mb-4">
							Genesis numbers span from +888 8000 to +888 8999. Representing under 0.73% of total
							collection supply, they hold highest historical liquidity and whale prestige.
						</p>
						<button
							type="button"
							onClick={() => navigate('/numbers/mask')}
							class="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-[#0098EA] text-white font-black text-xs shadow-lg shadow-cyan-500/25 active:scale-95 transition-all"
						>
							Explore Genesis Numbers in Mask Builder
						</button>
					</div>
				</Show>

				{/* Tab 4: Colors */}
				<Show when={selectedTab() === 'colors'}>
					<div class="space-y-2.5">
						<For each={NFT_COLORS}>
							{(c) => (
								<div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
									<div class="flex items-center gap-3">
										<span
											class="w-4 h-4 rounded-full border border-white/30"
											style={{ background: c.hex }}
										/>
										<span class="text-xs font-black text-white">{c.name}</span>
									</div>
									<div class="text-end">
										<span class="text-xs font-mono font-bold text-amber-400 block">
											x{c.multiplier} Multiplier
										</span>
										<span class="text-[10px] text-white/40 block">{formatTon(c.count)} items</span>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>
			</div>
		</div>
	);
};
