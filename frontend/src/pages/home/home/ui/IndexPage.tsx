import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { useQueryClient } from '@tanstack/solid-query';
import { backButton, viewport } from '@tma.js/sdk-solid';
import { type Component, createEffect, createSignal, Show } from 'solid-js';
import { PullToRefresh } from '@/shared/ui/PullToRefresh.js';
import { ActionArea } from '@/widgets/action-area/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { HeroTabs } from '@/widgets/hero-tabs/index.js';

export const IndexPage: Component = () => {
	const getInitialTab = (): 'username' | 'collectibles' | 'gifts' | null => {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);
			if (params.has('u')) {
				return 'username';
			}
		}
		return null;
	};

	const [activeTab, setActiveTab] = createSignal<'username' | 'collectibles' | 'gifts' | null>(
		getInitialTab(),
	);

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
					class="pb-40 bg-[#030303] text-white min-h-full relative flex flex-col"
					style={{ 'min-height': 'var(--tg-viewport-stable-height, 100vh)' }}
					role="application"
					aria-label={t('home.title')}
				>
					{/* Premium Ambient Background Glow */}
					<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-[#3390ec]/5 to-transparent blur-[80px] pointer-events-none z-0" />

					<div class="relative z-10 flex-1 flex flex-col">
						<HeroTabs activeTab={activeTab()} onTabChange={handleTabChange} />

						<Show when={activeTab()} keyed>
							{(tab) => (
								<Motion.div
									initial={{ opacity: 0, y: 120 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.5, easing: [0.32, 0.72, 0, 1] }}
									class="w-full bg-[#12141C]/90 backdrop-blur-2xl border-t border-white/10 rounded-t-[40px] relative z-20 shadow-[0_-30px_80px_rgba(0,0,0,0.8)] pt-5 pb-32 min-h-[75vh] -mt-8 flex flex-col flex-1"
									role="tabpanel"
								>
									{/* Inner Top Glow & iOS Style Grab Handle */}
									<div class="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
									<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

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

			<BottomNav />
		</>
	);
};
