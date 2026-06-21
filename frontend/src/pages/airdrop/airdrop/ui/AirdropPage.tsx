import { Component, createSignal, Match, Switch } from 'solid-js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { BoostersView } from './BoostersView.js';
import { ClanView } from './ClanView.js';
import { FrensView } from './FrensView.js';
import { LeaderboardView } from './LeaderboardView.js';
import { ShopView } from './ShopView.js';
import { TapView } from './TapView.js';
import { TasksView } from './TasksView.js';
import { t } from '@/shared/i18n/index.js';

type AirdropTab = 'mine' | 'earn' | 'clan' | 'frens' | 'boost' | 'shop';

const getTabs = () => [
	{ id: 'earn' as AirdropTab, icon: 'assignment', label: t('airdropTabs.earn') },
	{ id: 'frens' as AirdropTab, icon: 'group', label: 'Frens' },
	{ id: 'boost' as AirdropTab, icon: 'rocket_launch', label: t('airdropTabs.boost') },
];

export const AirdropPage: Component = () => {
	const [activeTab, setActiveTab] = createSignal<AirdropTab>('mine');
	const [showLeaderboard, setShowLeaderboard] = createSignal(false);

	const handleTabChange = (tab: AirdropTab) => {
		try {
			const tgHaptic =
				typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback;
			if (tgHaptic) tgHaptic.selectionChanged();
		} catch (_) {}
		setActiveTab(tab);
	};

	return (
		<div
			class="flex flex-col bg-black relative overflow-hidden"
			style={{ 'min-height': 'var(--tg-viewport-stable-height, 100vh)' }}
		>
			{/* Main Content */}
			<div class="flex-1 overflow-hidden relative flex flex-col pt-0">
				{/* Header for sub-pages */}
				<Show when={activeTab() !== 'mine' && activeTab() !== 'shop'}>
					<div class="absolute top-0 left-0 right-0 z-[60] bg-transparent pb-2 pt-2" dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}>
						<div class="flex items-center px-4 max-w-md mx-auto">
							<button 
								onClick={() => handleTabChange('mine')} 
								class="w-10 h-10 flex items-center justify-center text-white/70 active:text-white shrink-0 bg-white/10 rounded-full active:bg-white/20 transition-all shadow-lg backdrop-blur-md"
							>
								<span class="material-symbols-outlined text-[20px]">close</span>
							</button>
						</div>
					</div>
				</Show>

				<Switch>
					<Match when={activeTab() === 'mine'}>
						<TapView 
							onLeagueClick={() => setShowLeaderboard(true)} 
							onClanClick={() => handleTabChange('clan')}
							onShopClick={() => handleTabChange('shop')}
							onActionClick={(tabId) => handleTabChange(tabId as any)}
						/>
					</Match>
					<Match when={activeTab() === 'earn'}>
						<TasksView />
					</Match>
					<Match when={activeTab() === 'clan'}>
						<ClanView />
					</Match>
					<Match when={activeTab() === 'frens'}>
						<FrensView />
					</Match>
					<Match when={activeTab() === 'boost'}>
						<BoostersView onTurboClick={() => handleTabChange('mine')} />
					</Match>
					<Match when={activeTab() === 'shop'}>
						<ShopView />
					</Match>
				</Switch>
			</div>

			{/* Main app bottom nav */}
			<div class="z-50 relative">
				<BottomNav />
			</div>

			{/* Leaderboard Overlay */}
			{showLeaderboard() && (
				<div class="fixed inset-0 z-[70] bg-black/95 flex flex-col animate-slide-up">
					<div class="flex items-center justify-between p-4 border-b border-white/10">
						<h2 class="text-white font-bold text-lg">Leaderboard</h2>
						<button
							onClick={() => setShowLeaderboard(false)}
							class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
						>
							<span class="material-symbols-outlined text-white text-xl">close</span>
						</button>
					</div>
					<div class="flex-1 overflow-hidden">
						<LeaderboardView />
					</div>
				</div>
			)}
		</div>
	);
};
