import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { giftsApi } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { GiftsChartView } from './components/GiftsChartView.js';
import { GiftsCollectionsExplorer } from './components/GiftsCollectionsExplorer.js';
import { GiftsGlobalHeatmap } from './components/GiftsGlobalHeatmap.js';

export const GiftsIntelPage: Component = () => {
	useTelegramBackButton(-1);

	const [activeTab, setActiveTab] = createSignal<'chart' | 'collections' | 'heatmap'>('chart');

	const intelQuery = createQuery(() => ({
		queryKey: ['giftsIntel'],
		queryFn: () => giftsApi.getIntel(),
		staleTime: 45 * 1000,
	}));

	const intel = () => intelQuery.data;

	const effectiveRate = createMemo(() => {
		const board = intel()?.unified_floor_board;
		if (board && board.length > 0) {
			for (const item of board) {
				if (item.best_floor_usd > 0 && item.best_floor_gram > 0) {
					return item.best_floor_usd / item.best_floor_gram;
				}
			}
		}
		return 5.5;
	});

	const tabsList = () => [
		{ id: 'chart', label: t('gifts.tabChart') || 'نمودار و بولینگر', icon: 'show_chart' },
		{ id: 'collections', label: t('gifts.tabCollections') || 'کالکشن‌ها', icon: 'category' },
		{ id: 'heatmap', label: t('gifts.tabHeatmap') || 'نقشه حرارتی', icon: 'grid_view' },
	] as const;

	return (
		<div class="pb-36 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient background glows matching iFragment palette */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/15 via-transparent to-transparent blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[520px] mx-auto px-4 pt-3 space-y-4">
				{/* Top Header Bar */}
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2.5">
						<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0098EA] to-[#0060aa] p-[1px] shadow-lg shadow-[#0098EA]/20 flex items-center justify-center">
							<div class="w-full h-full bg-[#0a0e17] rounded-xl flex items-center justify-center text-base">
								🎁
							</div>
						</div>
						<div>
							<h1 class="text-base font-black tracking-tight text-white flex items-center gap-1.5">
								<span>Telegram Gifts</span>
								<span class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									NFT
								</span>
							</h1>
							<p class="text-[10px] font-semibold text-white/40">Telegram Gifts & NFT Marketplace</p>
						</div>
					</div>

					{/* Live Ecosystem Market Cap Readout */}
					<div class="text-right">
						<div class="text-xs font-black text-white font-mono flex items-center justify-end gap-1">
							<span class="text-[#0098EA] text-[10px]">💎</span>
							<span>{intel()?.total_market_cap_usd ? `~$${(intel()!.total_market_cap_usd / 1e6).toFixed(1)}M Cap` : '~$128M Cap'}</span>
						</div>
						<div class="text-[10px] text-emerald-400 font-mono font-bold">
							149 Gifts · 120 NFTs
						</div>
					</div>
				</div>

				{/* ═══════ TOP PRIMARY 3 TABS (AT THE HIGHEST POINT) ═══════ */}
				<div class="grid grid-cols-3 bg-[#0d121c] p-1 rounded-2xl border border-white/[0.08] shadow-lg">
					<For each={tabsList()}>
						{(tab) => (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									setActiveTab(tab.id);
								}}
								class={`py-2 px-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
									activeTab() === tab.id
										? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25 scale-[1.02]'
										: 'text-white/50 hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-sm">{tab.icon}</span>
								<span class="truncate max-w-full">{tab.label}</span>
							</button>
						)}
					</For>
				</div>

				{/* ═══════ TAB VIEWS ═══════ */}
				<Show when={activeTab() === 'chart'}>
					<GiftsChartView intel={intel()} />
				</Show>

				<Show when={activeTab() === 'collections'}>
					<GiftsCollectionsExplorer rate={effectiveRate()} />
				</Show>

				<Show when={activeTab() === 'heatmap'}>
					<GiftsGlobalHeatmap />
				</Show>

				{/* Attribution Badge */}
				<div class="text-center pt-4 pb-2">
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
