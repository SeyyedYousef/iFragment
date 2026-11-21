import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { giftsApi } from '@/entities/gifts/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { GiftsChartView, type GiftsMainTab } from './components/GiftsChartView.js';

export const GiftsIntelPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [activeTab, setActiveTab] = createSignal<GiftsMainTab>('overview');
	const intelQuery = createQuery(() => ({
		queryKey: ['giftsIntel'],
		queryFn: () => giftsApi.getIntel(),
		staleTime: 45 * 1000,
	}));

	const intel = () => intelQuery.data;

	return (
		<div
			class="frag-canvas text-white min-h-screen font-frag-sans pb-32 relative overflow-x-clip"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Authentic Fragment.com Sticky Top Header (.tm-header) */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => navigate('/')}
					class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
				>
					<TonIcon size={20} color="#4db2ff" />
					<span class="text-[15px] font-bold tracking-[0.04em]" dir="ltr">
						FRAGMENT
					</span>
				</button>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onClick={() => navigate('/gifts/crafting')}
						class="h-8 px-2.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-white text-[12px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
					>
						<span class="material-symbols-outlined text-[15px] text-[#ff9953]">
							local_fire_department
						</span>
						<span class="hidden xs:inline">{t('gifts.craftingBadge')}</span>
					</button>
					<button
						type="button"
						onClick={() => navigate('/gifts/portfolio')}
						class="h-8 px-2.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-white text-[12px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
					>
						<span class="material-symbols-outlined text-[15px] text-[#5aec8c]">
							account_balance_wallet
						</span>
						<span class="hidden xs:inline">Portfolio</span>
					</button>
				</div>
			</header>

			<div class="max-w-[540px] mx-auto px-4 pt-5 relative z-10 space-y-4">
				{/* Title Row */}
				<div class="flex items-center justify-between gap-3">
					<div>
						<div class="flex items-center gap-2">
							<h1 class="text-[20px] sm:text-[22px] font-bold tracking-[-0.015em] text-white">
								{t('giftsIntelPage.title')}
							</h1>
							<span class="px-2 py-0.5 rounded-[4px] bg-[#5aec8c]/10 text-[#5aec8c] text-[11px] font-semibold">
								{t('giftsIntelPage.liveOnChainBadge')}
							</span>
						</div>
						<p class="text-[12.5px] text-[#8794a1] mt-0.5 leading-snug">
							{t('giftsIntelPage.subtitle')}
						</p>
					</div>
				</div>

				{/* 4-Tab Fragment Horizontal Bar (Overview first by default) */}
				<div class="flex items-center border-b border-[#293440] gap-5 px-1 overflow-x-auto no-scrollbar">
					<For
						each={
							[
								{ id: 'overview', label: t('giftsIntelPage.tabOverview') },
								{ id: 'collections', label: t('giftsIntelPage.tabCollections') },
								{ id: 'inspector', label: t('giftsIntelPage.tabInspector') },
								{ id: 'tape', label: t('giftsIntelPage.tabTape') },
							] as const
						}
					>
						{(tab) => {
							const active = () => activeTab() === tab.id;
							return (
								<button
									type="button"
									onClick={() => {
										try {
											haptic.impact('light');
										} catch {}
										setActiveTab(tab.id);
									}}
									class={`relative pb-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
										active() ? 'text-white' : 'text-[#8c9aa9] hover:text-white'
									}`}
								>
									<span>{tab.label}</span>
									<Show when={active()}>
										<span class="absolute inset-x-0 bottom-0 h-[3px] bg-[#248bda] rounded-t-[3px]" />
									</Show>
								</button>
							);
						}}
					</For>
				</div>

				{/* Loading / Content State */}
				<Show
					when={!intelQuery.isLoading && intel()}
					fallback={
						<div class="flex flex-col items-center justify-center py-16 gap-3 frag-card">
							<div class="w-8 h-8 rounded-full border-2 border-[#4db2ff]/25 border-t-[#4db2ff] animate-spin" />
							<span class="text-[12.5px] font-medium text-[#8c9aa9]">
								{t('giftsIntelPage.syncingLabel')}
							</span>
						</div>
					}
				>
					<div>
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
