import { Component, createSignal, Match, Switch } from 'solid-js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { BoostersView } from './BoostersView.js';
import { ClanView } from './ClanView.js';
import { LeaderboardView } from './LeaderboardView.js';
import { ShopView } from './ShopView.js';
import { TapView } from './TapView.js';
import { TasksView } from './TasksView.js';
import { t } from '@/shared/i18n/index.js';

type AirdropTab = 'mine' | 'earn' | 'clan' | 'boost' | 'shop';

const getTabs = () => [
	{ id: 'mine' as AirdropTab, icon: 'touch_app', label: t('airdropTabs.mine') },
	{ id: 'earn' as AirdropTab, icon: 'assignment', label: t('airdropTabs.earn') },
	{ id: 'clan' as AirdropTab, icon: 'shield', label: t('airdropTabs.clan') },
	{ id: 'boost' as AirdropTab, icon: 'rocket_launch', label: t('airdropTabs.boost') },
	{ id: 'shop' as AirdropTab, icon: 'storefront', label: t('airdropTabs.shop') },
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
			<div class="flex-1 overflow-hidden relative flex flex-col pt-16">
				{/* Internal Airdrop Tab Bar at TOP */}
				<div class="absolute top-0 left-0 right-0 z-[60] bg-black/60 backdrop-blur-xl border-b border-white/5" dir="ltr">
					<div class="flex items-center justify-around px-2 py-2 max-w-md mx-auto">
						{getTabs().map((tab) => (
							<button
								onClick={() => handleTabChange(tab.id)}
								class={`flex items-center gap-1.5 py-2 px-3 rounded-xl transition-all ${
									activeTab() === tab.id
										? 'bg-white/10 text-white'
										: 'text-[#8e8e93] active:scale-95'
								}`}
							>
								<span
									class="material-symbols-outlined text-[18px]"
									style={{
										'font-variation-settings': activeTab() === tab.id ? '"FILL" 1' : '"FILL" 0',
									}}
								>
									{tab.icon}
								</span>
								<span class={`text-[12px] font-bold tracking-tight ${
									activeTab() === tab.id ? 'text-white' : 'text-[#8e8e93]'
								}`}>
									{tab.label}
								</span>
							</button>
						))}
					</div>
				</div>

				<Switch>
					<Match when={activeTab() === 'mine'}>
						<TapView 
							onLeagueClick={() => setShowLeaderboard(true)} 
							onClanClick={() => handleTabChange('clan')}
						/>
					</Match>
					<Match when={activeTab() === 'earn'}>
						<TasksView />
					</Match>
					<Match when={activeTab() === 'clan'}>
						<ClanView />
					</Match>
					<Match when={activeTab() === 'boost'}>
						<BoostersView />
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
