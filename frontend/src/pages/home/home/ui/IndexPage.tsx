import { useQueryClient } from '@tanstack/solid-query';
import { backButton, viewport } from '@tma.js/sdk-solid';
import { type Component, createEffect, createSignal, Show } from 'solid-js';
import { isRtl, t } from '@/shared/i18n/index.js';
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
		return null;
	};

	const [activeTab, setActiveTab] = createSignal<'username' | 'collectibles' | 'gifts' | null>(
		getInitialTab(),
	);
	const [storeOpen, setStoreOpen] = createSignal(false);

	createEffect(() => {
		if (activeTab() !== null) {
			if (backButton.show.isAvailable()) {
				backButton.show();
			}
			const off = backButton.onClick(() => {
				setActiveTab(null);
			});
			return () => off();
		}
		if (backButton.hide.isAvailable()) {
			backButton.hide();
		}
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
					class="pb-28 frag-canvas text-white min-h-full relative flex flex-col font-frag-sans"
					style={{ 'min-height': 'var(--tg-viewport-stable-height, 100vh)' }}
					dir={isRtl() ? 'rtl' : 'ltr'}
					role="application"
					aria-label={t('home.title')}
				>
					<div class="relative z-10 flex-1 flex flex-col">
						<HeroTabs
							activeTab={activeTab()}
							onTabChange={handleTabChange}
							onResetTab={() => setActiveTab(null)}
							onOpenCreditStore={() => setStoreOpen(true)}
						/>

						<Show when={activeTab()} keyed>
							{(tab) => (
								<div class="w-full relative z-20 flex-1" role="tabpanel">
									<ActionArea activeTab={tab} onTabChange={handleTabChange} />
								</div>
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
