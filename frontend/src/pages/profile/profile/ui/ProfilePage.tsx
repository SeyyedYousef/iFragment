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
import { ExperienceCard } from '@/widgets/profile/ExperienceCard.js';
import { BoostsCard, LeaderboardCard, QuestCard } from '@/widgets/profile/GamificationHub.js';
import { IdentityHero } from '@/widgets/profile/IdentityHero.js';
import { StatsDashboard } from '@/widgets/profile/StatsDashboard.js';

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
		<div class="theme-asset min-h-screen bg-[#08090D] pb-32 text-white font-sans select-none">
			{loading() ? (
				<div class="px-5 pt-6 min-h-[80vh]">
					<SkeletonProfile />
				</div>
			) : (
				<ErrorBoundary fallback={(err, reset) => <ErrorFallback err={err} reset={reset} />}>
					<div class="px-5 pt-4 flex flex-col gap-3 relative">
						{/* Header: Identity Hero */}
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

						<ExperienceCard stats={stats()} />
						<StatsDashboard stats={stats()} />

						{/* Bento Grid: Gamification */}
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
									<div class="col-span-2 bg-[#151822] rounded-[24px] p-5 border border-white/10 animate-pulse h-36 flex flex-col justify-between">
										<div class="h-4 w-1/3 bg-white/5 rounded-lg" />
										<div class="flex gap-2 overflow-hidden">
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

						{/* Accessible Footer Action Controls */}
						<Motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
							class="bg-[#151822] border border-white/10 rounded-[24px] p-2 flex items-center justify-between gap-1.5 mt-2 shadow-sm"
						>
							<button
								onClick={() => handleNavigate('/profile/settings')}
								aria-label={t('profile.settings')}
								class="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 py-3 bg-[#08090D] rounded-xl hover:bg-white/5 active:scale-95 transition-all text-xs font-bold text-white"
							>
								<span class="material-symbols-outlined text-[#3390ec] text-[18px]">settings</span>
								<span>{t('profile.settings')}</span>
							</button>

							<button
								onClick={() => setShowLangMenu(true)}
								aria-label={t('profile.language')}
								class="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 py-3 bg-[#08090D] rounded-xl hover:bg-white/5 active:scale-95 transition-all text-xs font-bold text-white"
							>
								<span class="material-symbols-outlined text-[#f59e0b] text-[18px]">language</span>
								<span>{t('profile.language')}</span>
							</button>

							<button
								onClick={() => handleNavigate('/profile/security')}
								aria-label={t('profile.security')}
								class="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 py-3 bg-[#08090D] rounded-xl hover:bg-white/5 active:scale-95 transition-all text-xs font-bold text-white"
							>
								<span class="material-symbols-outlined text-[#10b981] text-[18px]">security</span>
								<span>{t('profile.security')}</span>
							</button>
						</Motion.div>

						<div class="mt-6 mb-2 text-center flex flex-col items-center gap-1 opacity-40">
							<span class="text-[10px] font-black text-white uppercase tracking-widest">
								iFragment Unified Protocol
							</span>
							<span
								onClick={secretTrigger.onVersionTap}
								class="text-[10px] text-white/50 font-bold cursor-pointer select-none"
							>
								{t('profile.versionInfo')}
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
					<div class="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" />

					<Motion.div
						initial={{ y: 200, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.3, easing: [0.16, 1, 0.3, 1] }}
						class="relative bg-[#151822] border-t border-white/10 rounded-t-[28px] p-6 pb-12 w-full max-w-lg mx-auto flex flex-col gap-3 shadow-2xl"
						onClick={(e: Event) => e.stopPropagation()}
					>
						<div class="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2" />
						<h3 class="text-white text-base font-black text-center mb-2">
							{t('profile.selectLanguageTitle')}
						</h3>

						<For
							each={
								[
									{ code: 'fa', label: 'فارسی (Persian)', icon: '🇮🇷' },
									{ code: 'en', label: 'English (US)', icon: '🇬🇧' },
									{ code: 'ru', label: 'Русский', icon: '🇷🇺' },
									{ code: 'zh', label: '中文', icon: '🇨🇳' },
								] as const
							}
						>
							{(lang) => (
								<button
									onClick={() => {
										setLocale(lang.code);
										try {
											hapticFeedback.selectionChanged();
										} catch {}
										setShowLangMenu(false);
									}}
									class="flex items-center justify-between p-4 rounded-2xl bg-black/40 hover:bg-black/60 active:scale-95 border border-transparent transition-all min-h-[44px]"
									classList={{
										'!border-[#3390ec] !bg-[#3390ec]/15': locale() === lang.code,
									}}
								>
									<div class="flex items-center gap-3">
										<span class="text-2xl">{lang.icon}</span>
										<span class="text-white font-bold text-xs">{lang.label}</span>
									</div>
									<Show when={locale() === lang.code}>
										<div class="w-6 h-6 rounded-full bg-[#3390ec] text-white flex items-center justify-center">
											<span class="material-symbols-outlined text-[14px]">check</span>
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
