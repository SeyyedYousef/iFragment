import { useSearchParams } from '@solidjs/router';
import {
	type Component,
	createEffect,
	createSignal,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
} from 'solid-js';
import { syncProfileStats } from '@/entities/airdrop/index.js';
import { collectOfflineMining, startOfflineMining } from '@/entities/user/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { BoostersView } from '@/widgets/airdrop-boosters/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { ClanView } from './ClanView.js';
import { FrensView } from './FrensView.js';
import { LeaderboardView } from './LeaderboardView.js';
import { ShopView } from './ShopView.js';
import { TapView } from './TapView.js';
import { TasksView } from './TasksView.js';

type AirdropTab = 'mine' | 'earn' | 'clan' | 'frens' | 'boost' | 'shop';

export const AirdropPage: Component = () => {
	const [searchParams] = useSearchParams();
	const [activeTab, setActiveTab] = createSignal<AirdropTab>('mine');
	const [showLeaderboard, setShowLeaderboard] = createSignal(false);
	const [leaderboardInitialTab, setLeaderboardInitialTab] = createSignal<'miners' | 'squads'>(
		'miners',
	);
	const [offlineEarnings, setOfflineEarnings] = createSignal(0);

	createEffect(() => {
		let tab = searchParams?.tab;
		if (!tab) {
			try {
				const hashParts = window.location.hash.split('?');
				if (hashParts.length > 1) {
					const hashParams = new URLSearchParams(hashParts[1]);
					tab = hashParams.get('tab') || undefined;
				}
				if (!tab) {
					const urlParams = new URLSearchParams(window.location.search);
					tab = urlParams.get('tab') || undefined;
				}
			} catch (_) {}
		}

		if (tab) {
			const normalized = String(tab).toLowerCase();
			if (normalized === 'leaderboard') {
				setShowLeaderboard(true);
			} else if (normalized === 'shop' || normalized === 'store' || normalized === 'credits') {
				setActiveTab('shop');
			} else if (normalized === 'earn' || normalized === 'tasks' || normalized === 'quests') {
				setActiveTab('earn');
			} else if (normalized === 'boost' || normalized === 'boosts' || normalized === 'boosters') {
				setActiveTab('boost');
			} else if (normalized === 'clan' || normalized === 'squad' || normalized === 'clans') {
				setActiveTab('clan');
			} else if (normalized === 'frens' || normalized === 'friends' || normalized === 'referrals') {
				setActiveTab('frens');
			} else if (normalized === 'mine' || normalized === 'tap') {
				setActiveTab('mine');
			}
		}
	});

	const handleVisibilityChange = async () => {
		if (document.visibilityState === 'hidden') {
			startOfflineMining().catch(() => {});
		} else if (document.visibilityState === 'visible') {
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
			const tg = (window as any).Telegram?.WebApp;
			const searchParamsUrl = new URLSearchParams(window.location.search);
			const startParam =
				tg?.initDataUnsafe?.start_param || searchParamsUrl.get('tgWebAppStartParam');
			if (startParam?.startsWith('clan_')) {
				const clanUsername = startParam.replace(/^clan_/, '');
				sessionStorage.setItem('pending_clan_join', clanUsername);
				setActiveTab('clan');
			}
		} catch (_) {}

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
			haptic.selection();
		} catch (_) {}
		setActiveTab(tab);
	};

	return (
		<div
			class="h-[100dvh] max-h-[100dvh] w-full max-w-full overflow-hidden flex flex-col justify-between bg-[#030303] relative select-none font-sans text-white"
			style={{ height: 'var(--tg-viewport-stable-height, 100dvh)' }}
		>
			{/* Main Content Area */}
			<main
				class="min-h-0 w-full max-w-full flex-1 relative flex flex-col pt-0 overflow-y-auto overflow-x-hidden overscroll-y-contain no-scrollbar pb-[calc(env(safe-area-inset-bottom)+5.5rem)]"
				style={{ '-webkit-overflow-scrolling': 'touch', 'touch-action': 'pan-y' }}
			>
				{/* Premium Glassmorphic Header for sub-pages */}
				<Show when={activeTab() !== 'mine'}>
					<div
						class="sticky top-0 left-0 right-0 z-[60] h-0 overflow-visible pointer-events-none"
						dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
					>
						<div class="flex items-center px-4 pt-3 max-w-md mx-auto pointer-events-auto">
							<button
								type="button"
								onClick={() => handleTabChange('mine')}
								class="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white bg-[#12141C]/80 border border-white/10 rounded-[14px] active:scale-95 transition-all shadow-[0_8px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl group"
								aria-label={t('common.close') || 'Close'}
							>
								<span class="material-symbols-outlined text-[22px] group-active:scale-90 transition-transform">
									close
								</span>
							</button>
						</div>
					</div>
				</Show>

				{/* Views Routing */}
				<Switch>
					<Match when={activeTab() === 'mine'}>
						<TapView
							onLeagueClick={() => {
								setLeaderboardInitialTab('miners');
								setShowLeaderboard(true);
							}}
							onClanClick={() => handleTabChange('clan')}
							onShopClick={() => handleTabChange('shop')}
							onActionClick={(tabId) => handleTabChange(tabId as any)}
						/>
					</Match>
					<Match when={activeTab() === 'earn'}>
						<TasksView />
					</Match>
					<Match when={activeTab() === 'clan'}>
						<ClanView
							onOpenLeaderboard={() => {
								setLeaderboardInitialTab('squads');
								setShowLeaderboard(true);
							}}
						/>
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
			</main>

			{/* Main Bottom Nav */}
			<div class="z-50 shrink-0 relative">
				<BottomNav />
			</div>

			{/* ═══════ LEADERBOARD OVERLAY ═══════ */}
			<Show when={showLeaderboard()}>
				<div
					class="fixed inset-0 z-[70] bg-[#030303]/95 backdrop-blur-2xl flex flex-col animate-slide-up"
					dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
				>
					<div class="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#12141C]/50 shadow-sm">
						<div class="flex items-center gap-2.5">
							<div class="w-8 h-8 rounded-[10px] bg-[#3390ec]/15 flex items-center justify-center border border-[#3390ec]/30">
								<span class="material-symbols-outlined text-[#3390ec] text-[20px]">
									leaderboard
								</span>
							</div>
							<h2 class="text-white font-black text-[18px] tracking-tight">
								{t('gamification.leaderboard' as any) || 'Leaderboard'}
							</h2>
						</div>
						<button
							type="button"
							onClick={() => setShowLeaderboard(false)}
							class="w-10 h-10 rounded-[12px] bg-white/5 hover:bg-white/10 flex items-center justify-center active:scale-95 transition-all border border-white/5"
						>
							<span class="material-symbols-outlined text-white/70 text-[22px]">close</span>
						</button>
					</div>
					<div class="flex-1 flex flex-col overflow-hidden relative">
						<LeaderboardView initialTab={leaderboardInitialTab()} />
					</div>
				</div>
			</Show>

			{/* ═══════ OFFLINE EARNINGS MODAL (Premium Reward Screen) ═══════ */}
			<Show when={offlineEarnings() > 0}>
				<div
					class="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/80 backdrop-blur-md animate-fade-in"
					dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
				>
					<div class="bg-[#12141C] w-full max-w-sm rounded-[32px] p-7 flex flex-col items-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/10 relative overflow-hidden animate-slide-up">
						{/* Ambient Glows */}
						<div class="absolute -top-10 -left-10 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
						<div class="absolute -bottom-10 -right-10 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />

						{/* Robot Avatar */}
						<div class="w-24 h-24 bg-gradient-to-br from-[#1c1608] to-[#08090D] rounded-[24px] border-[1.5px] border-amber-500/30 flex items-center justify-center mb-5 shadow-[inset_0_2px_12px_rgba(255,255,255,0.05),0_10px_30px_rgba(245,158,11,0.2)] z-10 relative">
							<span class="text-[46px] drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]">🤖</span>
							<span class="absolute -top-3 -right-3 text-[24px] animate-pulse delay-75">✨</span>
							<span class="absolute -bottom-2 -left-3 text-[20px] animate-pulse delay-150">✨</span>
						</div>

						<h3 class="text-[24px] font-black text-white mb-2 z-10 tracking-tight drop-shadow-md">
							{t('airdropFinal.bot.collected' as any) || 'Bot Collected'}
						</h3>
						<p class="text-white/60 text-center text-[13px] mb-6 z-10 font-medium px-2 leading-relaxed">
							{t('airdropFinal.bot.description' as any) ||
								'Your Tap-Bot has been mining while you were away!'}
						</p>

						{/* Earnings Badge */}
						<div class="bg-[#08090D] rounded-[24px] p-4 w-full flex items-center justify-center gap-4 mb-6 z-10 border border-amber-500/20 shadow-inner relative overflow-hidden">
							<div class="absolute inset-0 bg-amber-500/5 pointer-events-none" />
							<div class="w-14 h-14 rounded-[16px] bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
								<span
									class="material-symbols-outlined text-amber-400 text-[32px] drop-shadow-sm"
									style={{ 'font-variation-settings': '"FILL" 1' }}
								>
									monetization_on
								</span>
							</div>
							<div class="flex flex-col relative z-10 text-start pr-2">
								<span class="text-white/50 text-[11px] font-black uppercase tracking-widest mb-0.5">
									{t('airdropFinal.bot.earned' as any) || 'Earned Coins'}
								</span>
								<span class="text-amber-400 font-black text-[28px] tabular-nums tracking-tight leading-none drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">
									+{offlineEarnings().toLocaleString('en-US')}
								</span>
							</div>
						</div>

						{/* Claim Button */}
						<button
							type="button"
							onClick={() => setOfflineEarnings(0)}
							class="w-full h-14 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-[18px] text-black font-black text-[14px] uppercase tracking-widest active:scale-95 transition-all shadow-[0_8px_24px_rgba(245,158,11,0.3)] z-10 border border-white/10"
						>
							{t('airdropFinal.bot.claim' as any) || 'AWESOME!'}
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};
