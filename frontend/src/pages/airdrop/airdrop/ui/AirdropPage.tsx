import { Component, createSignal, Match, Switch, onMount, onCleanup } from 'solid-js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { useNavigate } from '@solidjs/router';
import { BoostersView } from './BoostersView.js';
import { ClanView } from './ClanView.js';
import { FrensView } from './FrensView.js';
import { LeaderboardView } from './LeaderboardView.js';
import { ShopView } from './ShopView.js';
import { TapView } from './TapView.js';
import { TasksView } from './TasksView.js';
import { t } from '@/shared/i18n/index.js';
import { collectOfflineMining } from '@/shared/api/profile.js';
import { syncProfileStats } from '@/shared/store/airdrop.js';

type AirdropTab = 'mine' | 'earn' | 'clan' | 'frens' | 'boost' | 'shop';

const getTabs = () => [
	{ id: 'earn' as AirdropTab, icon: 'assignment', label: t('airdropTabs.earn') },
	{ id: 'frens' as AirdropTab, icon: 'group', label: t('airdropTabs.frens' as any) || 'Frens' },
	{ id: 'boost' as AirdropTab, icon: 'rocket_launch', label: t('airdropTabs.boost') },
];

export const AirdropPage: Component = () => {
	const [activeTab, setActiveTab] = createSignal<AirdropTab>('mine');
	const [showLeaderboard, setShowLeaderboard] = createSignal(false);
	const [offlineEarnings, setOfflineEarnings] = createSignal(0);
	const navigate = useNavigate();

	const handleVisibilityChange = async () => {
		if (document.visibilityState === 'visible') {
			try {
				const res = await collectOfflineMining();
				if (res.earned && res.earned > 0) {
					setOfflineEarnings(res.earned);
					await syncProfileStats();
				}
			} catch (e) {
				console.error('Failed to collect offline earnings', e);
			}
		}
	};

	onMount(async () => {
		document.addEventListener('visibilitychange', handleVisibilityChange);
		
		try {
			const res = await collectOfflineMining();
			if (res.earned && res.earned > 0) {
				setOfflineEarnings(res.earned);
				await syncProfileStats();
			}
		} catch (e) {
			console.error('Failed to collect offline earnings', e);
		}
	});

	onCleanup(() => {
		document.removeEventListener('visibilitychange', handleVisibilityChange);
	});

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
							onClanClick={() => navigate('/airdrop/clans')}
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
						<h2 class="text-white font-bold text-lg">{t('gamification.leaderboard' as any) || 'Leaderboard'}</h2>
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

			{/* Offline Earnings Modal */}
			{offlineEarnings() > 0 && (
				<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-6">
					<div class="bg-[#1c1c1e] w-full max-w-sm rounded-3xl p-6 flex flex-col items-center shadow-2xl border border-white/10 relative overflow-hidden">
						{/* Glowing background */}
						<div class="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
						<div class="absolute -bottom-10 -right-10 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
						
						<div class="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center mb-4 border border-white/10 z-10 relative">
							<span class="text-4xl">🤖</span>
							{/* Sparkles */}
							<span class="absolute -top-2 -right-2 text-xl animate-pulse delay-75">✨</span>
							<span class="absolute -bottom-1 -left-2 text-lg animate-pulse delay-150">✨</span>
						</div>
						
						<h3 class="text-2xl font-black text-white mb-2 z-10 tracking-tight">{t('airdropFinal.bot.collected' as any) || 'Bot Collected'}</h3>
						<p class="text-white/60 text-center text-sm mb-6 z-10">
							{t('airdropFinal.bot.description' as any) || 'Your Tap-Bot has been mining while you were away!'}
						</p>

						<div class="bg-black/40 rounded-2xl p-4 w-full flex items-center justify-center gap-3 mb-6 z-10 border border-white/5">
							<div class="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
								<span class="material-symbols-outlined text-amber-400 text-2xl" style={{ 'font-variation-settings': '"FILL" 1' }}>monetization_on</span>
							</div>
							<div class="flex flex-col">
								<span class="text-white/50 text-xs font-medium uppercase tracking-wider">{t('airdropFinal.bot.earned' as any) || 'Earned Coins'}</span>
								<span class="text-white font-black text-2xl tabular-nums tracking-tight">+{offlineEarnings().toLocaleString('en-US')}</span>
							</div>
						</div>

						<button
							onClick={() => setOfflineEarnings(0)}
							class="w-full h-14 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl text-white font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-amber-500/20 z-10"
						>
							{t('airdropFinal.bot.claim' as any) || 'Awesome!'}
						</button>
					</div>
				</div>
			)}
		</div>
	);
};
