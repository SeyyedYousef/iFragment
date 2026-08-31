import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { giftsApi } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { GiftsArbitrageRadar } from './components/GiftsArbitrageRadar.js';
import { GiftsChartView } from './components/GiftsChartView.js';
import { GiftsCollectionsExplorer } from './components/GiftsCollectionsExplorer.js';
import { GiftsGlobalHeatmap } from './components/GiftsGlobalHeatmap.js';
import { GiftsMacroStats } from './components/GiftsMacroStats.js';

export const GiftsIntelPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [activeTab, setActiveTab] = createSignal<'chart' | 'collections' | 'heatmap' | 'arbitrage'>('chart');

	const intelQuery = createQuery(() => ({
		queryKey: ['giftsIntel'],
		queryFn: () => giftsApi.getIntel(),
		staleTime: 45 * 1000,
	}));

	const intel = () => intelQuery.data;

	return (
		<div class="pb-36 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Gradient Glows */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/20 via-[#AF52DE]/10 to-transparent blur-[100px] pointer-events-none z-0" />
			<div class="fixed bottom-20 right-0 w-80 h-80 bg-[#0098EA]/10 blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[520px] mx-auto px-4 pt-3 space-y-4">
				{/* Top Header Bar */}
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2.5">
						<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#AF52DE] to-[#0098EA] p-[1px] shadow-lg shadow-[#0098EA]/20 flex items-center justify-center">
							<div class="w-full h-full bg-[#0d111a] rounded-2xl flex items-center justify-center">
								<span class="material-symbols-outlined text-[#0098EA] text-[22px]">
									featured_seasonal_and_gifts
								</span>
							</div>
						</div>
						<div>
							<h1 class="text-base font-black tracking-tight text-white flex items-center gap-1.5">
								<span>Telegram Gifts</span>
								<span class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									TON NFT
								</span>
							</h1>
							<p class="text-[10px] font-semibold text-white/40">Telegram Gifts & NFT Marketplace</p>
						</div>
					</div>

					{/* Live Ecosystem Market Cap Readout */}
					<div class="text-right">
						<div class="text-xs font-black text-white font-mono flex items-center justify-end gap-1">
							<span class="text-[#0098EA] text-[10px]">💎</span>
							<span>~$128M Cap</span>
						</div>
						<div class="text-[10px] text-emerald-400 font-mono font-bold">
							149 Gifts · 120 NFTs
						</div>
					</div>
				</div>

				{/* ═══════ 1. MACRO ECOSYSTEM STATISTICS ═══════ */}
				<GiftsMacroStats data={intel()} />

				{/* ═══════ 2. TAB CONTROLS (4 TABS) ═══════ */}
				<div class="grid grid-cols-4 gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl">
					<For each={[
						{ id: 'chart', label: t('gifts.tabChart'), icon: 'show_chart' },
						{ id: 'collections', label: t('gifts.tabCollections'), icon: 'category' },
						{ id: 'heatmap', label: t('gifts.tabHeatmap'), icon: 'grid_view' },
						{ id: 'arbitrage', label: t('gifts.tabArbitrage'), icon: 'swap_horiz' },
					] as const}>
						{(tab) => (
							<button
								type="button"
								onClick={() => {
									setActiveTab(tab.id as any);
									try { haptic.selection(); } catch {}
								}}
								class={`py-2 text-[11px] font-black rounded-xl transition-all flex flex-col items-center gap-0.5 ${
									activeTab() === tab.id
										? 'bg-[#0098EA] text-white shadow-lg shadow-[#0098EA]/30'
										: 'text-white/50 hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-sm">{tab.icon}</span>
								<span class="truncate max-w-full px-1">{tab.label}</span>
							</button>
						)}
					</For>
				</div>

				{/* ═══════ 3. TAB VIEWS ═══════ */}
				<Show when={activeTab() === 'chart'}>
					<GiftsChartView />
				</Show>

				<Show when={activeTab() === 'collections'}>
					<GiftsCollectionsExplorer />
				</Show>

				<Show when={activeTab() === 'heatmap'}>
					<GiftsGlobalHeatmap />
				</Show>

				<Show when={activeTab() === 'arbitrage'}>
					<GiftsArbitrageRadar intel={intel()} />
				</Show>

				{/* Attribution Badge */}
				<div class="text-center pt-6 pb-2">
					<a
						href="https://t.me/GiftChanges"
						target="_blank"
						rel="noreferrer"
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-[10px] font-medium text-white/40 hover:text-white/80 transition-all"
					>
						<span class="material-symbols-outlined text-[13px] text-[#0098EA]">verified</span>
						<span>Powered by Telegram On-Chain & api.changes.tg · Thanks to @GiftChanges</span>
					</a>
				</div>
			</div>
		</div>
	);
};
