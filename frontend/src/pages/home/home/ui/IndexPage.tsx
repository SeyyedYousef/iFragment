import { Motion } from '@motionone/solid';
import { useQueryClient } from '@tanstack/solid-query';
import { backButton, viewport } from '@tma.js/sdk-solid';
import { type Component, createEffect, createSignal, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { PullToRefresh } from '@/shared/ui/PullToRefresh.js';
import { ActionArea } from '@/widgets/action-area/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { HeroTabs } from '@/widgets/hero-tabs/index.js';
import { CreditStoreSheet } from '@/widgets/paywall/CreditStoreSheet.js';

export const IndexPage: Component = () => {
	const getInitialTab = (): 'username' | 'collectibles' | 'gifts' | null => {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);
			const tabParam = params.get('tab');
			if (tabParam === 'collectibles' || tabParam === 'numbers' || params.has('num')) {
				return 'collectibles';
			}
			if (tabParam === 'gifts' || params.has('gift')) {
				return 'gifts';
			}
			if (params.has('u') || tabParam === 'username') {
				return 'username';
			}
		}
		return 'username';
	};

	const [activeTab, setActiveTab] = createSignal<'username' | 'collectibles' | 'gifts' | null>(
		getInitialTab(),
	);
	const [storeOpen, setStoreOpen] = createSignal(false);

	createEffect(() => {
		backButton.hide();
		if (viewport.expand.isAvailable() && !viewport.isExpanded()) {
			viewport.expand();
		}
	});

	const handleTabChange = (tab: 'username' | 'collectibles' | 'gifts') => {
		setActiveTab(tab);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const queryClient = useQueryClient();
	const handleRefresh = async () => {
		await queryClient.invalidateQueries();
	};

	return (
		<>
			<PullToRefresh onRefresh={handleRefresh}>
				<div
					class="pb-40 bg-[#06070B] text-white min-h-full relative flex flex-col"
					style={{ 'min-height': 'var(--tg-viewport-stable-height, 100vh)' }}
					role="application"
					aria-label={t('home.title')}
				>
					{/* Premium Ambient Obsidian & Cyan/Emerald Glow */}
					<div class="absolute top-0 left-0 right-0 h-[380px] bg-gradient-to-b from-[#3390ec]/20 via-emerald-500/8 to-transparent blur-[90px] pointer-events-none z-0" />

					<div class="relative z-10 flex-1 flex flex-col">
						<HeroTabs
							activeTab={activeTab()}
							onTabChange={handleTabChange}
							onOpenCreditStore={() => setStoreOpen(true)}
						/>

						<Show when={activeTab()} keyed>
							{(tab) => (
								<Motion.div
									initial={{ opacity: 0, y: 40 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4, easing: [0.32, 0.72, 0, 1] }}
									class="w-full bg-[#10131C]/95 backdrop-blur-2xl border-t border-white/12 rounded-t-[36px] relative z-20 shadow-[0_-24px_70px_rgba(0,0,0,0.85)] pt-4 pb-32 min-h-[72vh] -mt-6 flex flex-col flex-1"
									role="tabpanel"
								>
									{/* Inner Top Highlight & Grab Handle */}
									<div class="absolute top-0 left-1/2 -translate-x-1/2 w-[45%] h-[1px] bg-gradient-to-r from-transparent via-[#3390ec]/50 to-transparent" />
									<div class="w-11 h-1.5 bg-white/15 rounded-full mx-auto mb-5" />

									{/* Dynamic Content Area */}
									<div class="flex-1 w-full relative z-10">
										<ActionArea activeTab={tab} onTabChange={handleTabChange} />
									</div>
								</Motion.div>
							)}
						</Show>
					</div>
				</div>
			</PullToRefresh>

			<CreditStoreSheet open={storeOpen()} onClose={() => setStoreOpen(false)} />
			<BottomNav />
		</>
	);
};
