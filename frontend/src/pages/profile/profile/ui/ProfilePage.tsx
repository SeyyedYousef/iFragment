import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, ErrorBoundary, For, onMount, Show } from 'solid-js';
import { useSecretTrigger } from '@/features/owner-gate/lib/useSecretTrigger.js';
import { getProfileAchievements, getProfileStats } from '@/shared/api/profile.js';
import { locale, setLocale, t } from '@/shared/i18n/index.js';
import { setProfilePhotoUrl } from '@/shared/store/profile.js';
import { ErrorFallback } from '@/shared/ui/ErrorFallback.js';
import { SkeletonProfile } from '@/shared/ui/Skeleton.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { OwnerGateModal } from '@/widgets/owner/OwnerGateModal.js';
import { AchievementPreview } from '@/widgets/profile/AchievementPreview.js';
import { QuestCard, BoostsCard, LeaderboardCard } from '@/widgets/profile/GamificationHub.js';
import { IdentityHero } from '@/widgets/profile/IdentityHero.js';
import { StatsDashboard } from '@/widgets/profile/StatsDashboard.js';
import { ExperienceCard } from '@/widgets/profile/ExperienceCard.js';

export const ProfilePage: Component = () => {
	const secretTrigger = useSecretTrigger();
	const navigate = useNavigate();
	const [showLangMenu, setShowLangMenu] = createSignal(false);

	const getCachedStats = () => {
		try {
			const raw = localStorage.getItem('cached_profile_stats');
			return raw ? JSON.parse(raw) : undefined;
		} catch {
			return undefined;
		}
	};

	const getCachedAchievements = () => {
		try {
			const raw = localStorage.getItem('cached_profile_achievements');
			return raw ? JSON.parse(raw) : undefined;
		} catch {
			return undefined;
		}
	};

	const statsQuery = createQuery(() => ({
		queryKey: ['profile', 'stats'],
		queryFn: async () => {
			const res = await getProfileStats();
			if (res) {
				try {
					localStorage.setItem('cached_profile_stats', JSON.stringify(res));
					if (res.photoUrl) {
						setProfilePhotoUrl(res.photoUrl);
					}
				} catch {}
			}
			return res;
		},
		initialData: getCachedStats(),
		staleTime: 15000,
		refetchOnWindowFocus: false,
	}));

	const achievementsQuery = createQuery(() => ({
		queryKey: ['profile', 'achievements'],
		queryFn: async () => {
			const res = await getProfileAchievements();
			if (res) {
				try {
					localStorage.setItem('cached_profile_achievements', JSON.stringify(res));
				} catch {}
			}
			return res;
		},
		initialData: getCachedAchievements(),
		staleTime: 30000,
		refetchOnWindowFocus: false,
	}));

	// Parallelize loading: only above-the-fold stats block the initial screen (bypassed if cache exists)
	const loading = () => statsQuery.isLoading;
	const stats = () => statsQuery.data || null;
	const achievements = () => achievementsQuery.data || [];

	onMount(async () => {
		try {
			backButton.hide();
		} catch {}
	});

	const handleNavigate = (path: string) => {
		try {
			hapticFeedback.impactOccurred('light');
		} catch {}
		navigate(path);
	};

	return (
		<div class="min-h-screen bg-[#090a0d] pb-32 text-white font-sans">
			{loading() ? (
				<div class="px-5 pt-6 min-h-[80vh]">
					<SkeletonProfile />
				</div>
			) : (
				<ErrorBoundary fallback={(err, reset) => <ErrorFallback err={err} reset={reset} />}>
					<div class="px-5 pt-4 flex flex-col gap-3 relative">
						
						{/* Header: Identity Hero (Compact) */}
						<Motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.05 }}
							onTouchStart={secretTrigger.onLogoPressStart}
							onTouchEnd={secretTrigger.onLogoPressEnd}
							onTouchCancel={secretTrigger.onLogoPressEnd}
							onMouseDown={secretTrigger.onLogoPressStart}
							onMouseUp={secretTrigger.onLogoPressEnd}
							onMouseLeave={secretTrigger.onLogoPressEnd}
						>
							<IdentityHero stats={stats()} />
						</Motion.div>

						{/* New Premium Experience Card */}
						<ExperienceCard stats={stats()} />

						{/* Middle: Scrolling Stats Chips */}
						<StatsDashboard stats={stats()} />

						{/* Core Bento Grid: Gamification & Achievements */}
						<Motion.div 
							initial={{ opacity: 0, scale: 0.98 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ delay: 0.15 }}
							class="grid grid-cols-2 gap-3 w-full"
						>
							<QuestCard />
							<BoostsCard />
							<LeaderboardCard />
							
							<Show
								when={!achievementsQuery.isLoading}
								fallback={
									<div class="col-span-2 bg-[#1c1c1c] rounded-3xl p-5 border border-[#2a2a2a] animate-pulse h-36 flex flex-col justify-between">
										<div class="h-4 w-1/3 bg-white/5 rounded-lg" />
										<div class="flex gap-2 overflow-hidden">
											<div class="w-16 h-16 bg-white/5 rounded-2xl" />
											<div class="w-16 h-16 bg-white/5 rounded-2xl" />
											<div class="w-16 h-16 bg-white/5 rounded-2xl" />
										</div>
									</div>
								}
							>
								<div 
									onClick={() => handleNavigate('/profile/achievements')}
									class="col-span-2 cursor-pointer active:scale-[0.98] transition-transform"
								>
									<AchievementPreview achievements={achievements()} />
								</div>
							</Show>
						</Motion.div>

						{/* Footer: Compact Settings Pill */}
						<Motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
							class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-[24px] p-2 flex items-center justify-between gap-1.5 mt-2 shadow-sm"
						>
							<button
								onClick={() => handleNavigate('/profile/settings')}
								class="flex-1 flex items-center justify-center gap-1.5 py-3.5 bg-[#0f1014] rounded-[18px] hover:bg-[#15161d] active:scale-[0.98] transition-all"
							>
								<span class="material-symbols-outlined text-[#3390ec] text-[16px]">settings</span>
								<span class="text-[10px] text-white font-black uppercase tracking-widest hidden sm:inline">{t('settings.title') || 'Settings'}</span>
							</button>
							<button
								onClick={() => setShowLangMenu(true)}
								class="flex-1 flex items-center justify-center gap-1.5 py-3.5 bg-[#0f1014] rounded-[18px] hover:bg-[#15161d] active:scale-[0.98] transition-all"
							>
								<span class="material-symbols-outlined text-[#ff9500] text-[16px]">language</span>
								<span class="text-[10px] text-white font-black uppercase tracking-widest hidden sm:inline">{(t as any)('settings.language') || 'Language'}</span>
							</button>
							<button
								onClick={() => handleNavigate('/profile/security')}
								class="flex-1 flex items-center justify-center gap-1.5 py-3.5 bg-[#0f1014] rounded-[18px] hover:bg-[#15161d] active:scale-[0.98] transition-all"
							>
								<span class="material-symbols-outlined text-[#34c759] text-[16px]">security</span>
								<span class="text-[10px] text-white font-black uppercase tracking-widest hidden sm:inline">{(t as any)('security.title') || 'Security'}</span>
							</button>
						</Motion.div>

						{/* Profile Footer Version */}
						<div class="mt-6 mb-2 text-center flex flex-col items-center gap-1 opacity-30">
							<span class="text-[9px] font-black text-white uppercase tracking-widest">
								{t('profile.walletHub') || 'iFragment Wallet Hub'}
							</span>
							<span
								onClick={secretTrigger.onVersionTap}
								class="text-[9px] text-[#a0a4ad] font-bold cursor-pointer select-none"
							>
								{t('profile.version') || 'Version'} 1.0.4
							</span>
						</div>
					</div>
				</ErrorBoundary>
			)}

			<BottomNav />

			<OwnerGateModal
				isOpen={secretTrigger.showGate()}
				onClose={() => secretTrigger.setShowGate(false)}
			/>

			{/* Language Selection Bottom Sheet */}
			<Show when={showLangMenu()}>
				<div 
					class="fixed inset-0 z-[100] flex flex-col justify-end"
					onClick={() => setShowLangMenu(false)}
				>
					{/* Backdrop */}
					<div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
					
					{/* Bottom Sheet */}
					<Motion.div
						initial={{ y: 200, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.3, easing: [0.16, 1, 0.3, 1] }}
						class="relative bg-[#1c1c1c] border-t border-[#2a2a2a] rounded-t-[32px] p-6 pb-12 w-full max-w-[600px] mx-auto flex flex-col gap-3 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
						onClick={(e: Event) => e.stopPropagation()}
					>
						<div class="w-12 h-1.5 bg-[#2a2a2a] rounded-full mx-auto mb-2" />
						<h3 class="text-white text-[22px] font-black tracking-tight mb-4 text-center">
							{(t as any)('settings.language') || 'Language'}
						</h3>
						
						<For each={[
							{ code: 'en', label: 'English', icon: '🇬🇧' },
							{ code: 'fa', label: 'فارسی', icon: '🇮🇷' },
							{ code: 'ru', label: 'Русский', icon: '🇷🇺' },
							{ code: 'zh', label: '中文', icon: '🇨🇳' },
						] as const}>
							{(lang) => (
								<button
									onClick={() => {
										setLocale(lang.code);
										try { hapticFeedback.selectionChanged(); } catch {}
										setShowLangMenu(false);
									}}
									class="flex items-center justify-between p-4 rounded-[20px] bg-[#0f1014] hover:bg-[#15161d] active:scale-[0.98] border border-transparent transition-all"
									classList={{
										'!border-[#3390ec] !bg-[#3390ec]/10': locale() === lang.code
									}}
								>
									<div class="flex items-center gap-4">
										<span class="text-3xl filter drop-shadow-md">{lang.icon}</span>
										<span class="text-white font-bold text-[15px]">{lang.label}</span>
									</div>
									<Show when={locale() === lang.code}>
										<div class="w-6 h-6 rounded-full bg-[#3390ec] text-white flex items-center justify-center shadow-[0_0_10px_rgba(51,144,236,0.5)]">
											<span class="material-symbols-outlined text-[14px] font-bold">check</span>
										</div>
									</Show>
								</button>
							)}
						</For>
					</Motion.div>
				</div>
			</Show>
		</div>
	);
};
