import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, Show } from 'solid-js';
import { giftsApi } from '@/entities/gifts/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { GiftsChartView, type GiftsMainTab } from './components/GiftsChartView.js';

export const GiftsIntelPage: Component = () => {
	useTelegramBackButton(-1);

	const [activeTab, setActiveTab] = createSignal<GiftsMainTab>('overview');
	const intelQuery = createQuery(() => ({
		queryKey: ['giftsIntel'],
		queryFn: () => giftsApi.getIntel(),
		staleTime: 45 * 1000,
	}));

	const intel = () => intelQuery.data;

	return (
		<div
			class="frag-canvas text-[#f3f5f8] min-h-screen font-sans pb-36 relative overflow-x-clip"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			<div class="max-w-3xl mx-auto px-4 pt-3.5 relative z-10">
				{/* Institutional Header */}
				<div class="frag-card-elevated rounded-2xl p-4 mb-3">
					<div class="flex items-center justify-between gap-2 flex-wrap mb-2">
						<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2990ff]/10 border border-[#2990ff]/25">
							<span class="w-1.5 h-1.5 rounded-full bg-[#4cd964]" />
							<span class="text-[11px] font-semibold text-[#5aaeff]">
								{t('giftsIntelPage.terminalBadge')}
							</span>
						</div>

						<span class="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#141a22] border border-white/[0.08] text-[#4cd964] inline-flex items-center gap-1.5">
							<span class="w-1.5 h-1.5 rounded-full bg-[#4cd964]" />
							{t('giftsIntelPage.liveOnChainBadge')}
						</span>
					</div>

					<h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white">
						{t('giftsIntelPage.title')}
					</h1>
					<p class="text-[12px] text-[#8ca0b5] mt-1 leading-relaxed">
						{t('giftsIntelPage.subtitle')}
					</p>
				</div>

				{/* Primary 4-Tab Segmented Navigation */}
				<div class="bg-[#141a22]/95 border border-white/[0.08] p-1 rounded-2xl grid grid-cols-4 gap-1 sticky top-2 z-30 backdrop-blur-2xl shadow-[0_12px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] mb-3">
					<button
						type="button"
						onClick={() => {
							try {
								haptic.impact('light');
							} catch {}
							setActiveTab('overview');
						}}
						class={`py-2 px-1 rounded-xl text-[11px] font-semibold transition-all truncate text-center ${
							activeTab() === 'overview'
								? 'bg-[#2990ff] text-white shadow-[0_6px_16px_rgba(41,144,255,0.28)]'
								: 'text-[#8ca0b5] hover:text-white hover:bg-white/[0.04]'
						}`}
					>
						{t('giftsIntelPage.tabOverview')}
					</button>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.impact('light');
							} catch {}
							setActiveTab('collections');
						}}
						class={`py-2 px-1 rounded-xl text-[11px] font-semibold transition-all truncate text-center ${
							activeTab() === 'collections'
								? 'bg-[#2990ff] text-white shadow-[0_6px_16px_rgba(41,144,255,0.28)]'
								: 'text-[#8ca0b5] hover:text-white hover:bg-white/[0.04]'
						}`}
					>
						{t('giftsIntelPage.tabCollections')}
					</button>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.impact('light');
							} catch {}
							setActiveTab('inspector');
						}}
						class={`py-2 px-1 rounded-xl text-[11px] font-semibold transition-all truncate text-center ${
							activeTab() === 'inspector'
								? 'bg-[#2990ff] text-white shadow-[0_6px_16px_rgba(41,144,255,0.28)]'
								: 'text-[#8ca0b5] hover:text-white hover:bg-white/[0.04]'
						}`}
					>
						{t('giftsIntelPage.tabInspector')}
					</button>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.impact('light');
							} catch {}
							setActiveTab('tape');
						}}
						class={`py-2 px-1 rounded-xl text-[11px] font-semibold transition-all truncate text-center ${
							activeTab() === 'tape'
								? 'bg-[#2990ff] text-white shadow-[0_6px_16px_rgba(41,144,255,0.28)]'
								: 'text-[#8ca0b5] hover:text-white hover:bg-white/[0.04]'
						}`}
					>
						{t('giftsIntelPage.tabTape')}
					</button>
				</div>

				{/* Loading / Ready State */}
				<Show
					when={!intelQuery.isLoading && intel()}
					fallback={
						<div class="flex flex-col items-center justify-center py-20 gap-3 frag-card-elevated rounded-2xl">
							<div class="w-9 h-9 rounded-full border-2 border-[#2990ff]/25 border-t-[#2990ff] animate-spin" />
							<span class="text-xs font-medium text-[#8ca0b5]">
								{t('giftsIntelPage.syncingLabel')}
							</span>
						</div>
					}
				>
					<div class="mt-2">
						<GiftsChartView
							intel={intel()}
							activeTab={activeTab()}
							onTabChange={(tab) => setActiveTab(tab)}
						/>
					</div>
				</Show>
			</div>
		</div>
	);
};
