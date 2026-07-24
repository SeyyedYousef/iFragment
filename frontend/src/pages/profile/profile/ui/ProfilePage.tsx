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
		<div
			class="min-h-screen bg-[#030303] pb-32 text-white font-sans flex flex-col relative overflow-x-hidden selection:bg-[#3390ec]/30"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow (Cosmic Theme) */}
			<div class="absolute top-0 left-0 right-0 h-[450px] bg-gradient-to-b from-[#3390ec]/15 via-[#06b6d4]/5 to-transparent blur-[90px] pointer-events-none z-0" />

			{loading() ? (
				<div class="px-5 pt-6 min-h-[80vh] relative z-10 max-w-md mx-auto w-full">
					<SkeletonProfile />
				</div>
			) : (
				<ErrorBoundary fallback={(err, reset) => <ErrorFallback err={err} reset={reset} />}>
					<div class="px-5 pt-6 flex flex-col gap-4 relative z-10 max-w-md mx-auto w-full">
						{/* ═══════ HEADER: IDENTITY HERO ═══════ */}
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
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

						{/* ═══════ BENTO GRID: GAMIFICATION ═══════ */}
						<Motion.div
							initial={{ opacity: 0, scale: 0.95 }}
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
									<div class="col-span-2 bg-[#12141C]/80 rounded-[28px] p-5 border border-white/5 shadow-inner animate-pulse h-36 flex flex-col justify-between">
										<div class="h-4 w-1/3 bg-white/5 rounded-lg" />
										<div class="flex gap-2 overflow-hidden">
											<div class="w-16 h-16 bg-white/5 rounded-[16px]" />
											<div class="w-16 h-16 bg-white/5 rounded-[16px]" />
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

						{/* ═══════ ACCESSIBLE FOOTER ACTION CONTROLS ═══════ */}
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
							class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-2 flex items-center justify-between gap-2 mt-2 shadow-sm"
						>
							<button
								onClick={() => handleNavigate('/profile/settings')}
								aria-label={t('profile.settings')}
								class="flex-1 min-h-[48px] flex items-center justify-center gap-2 py-3 bg-[#08090D] border border-white/5 rounded-[18px] hover:bg-white/5 hover:border-white/10 active:scale-95 transition-all shadow-inner group"
							>
								<div class="w-8 h-8 rounded-[10px] bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
									<span class="material-symbols-outlined text-[#3390ec] text-[18px]">
										settings
									</span>
								</div>
								<span class="text-[11px] font-black uppercase tracking-widest text-white/80">
									{t('profile.settings')}
								</span>
							</button>

							<button
								onClick={() => setShowLangMenu(true)}
								aria-label={t('profile.language')}
								class="flex-1 min-h-[48px] flex items-center justify-center gap-2 py-3 bg-[#08090D] border border-white/5 rounded-[18px] hover:bg-white/5 hover:border-white/10 active:scale-95 transition-all shadow-inner group"
							>
								<div class="w-8 h-8 rounded-[10px] bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
									<span class="material-symbols-outlined text-amber-400 text-[18px]">
										language
									</span>
								</div>
								<span class="text-[11px] font-black uppercase tracking-widest text-white/80">
									{t('profile.language')}
								</span>
							</button>

							<button
								onClick={() => handleNavigate('/profile/security')}
								aria-label={t('profile.security')}
								class="flex-1 min-h-[48px] flex items-center justify-center gap-2 py-3 bg-[#08090D] border border-white/5 rounded-[18px] hover:bg-white/5 hover:border-white/10 active:scale-95 transition-all shadow-inner group"
							>
								<div class="w-8 h-8 rounded-[10px] bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
									<span class="material-symbols-outlined text-[#10b981] text-[18px]">
										security
									</span>
								</div>
								<span class="text-[11px] font-black uppercase tracking-widest text-white/80">
									{t('profile.security')}
								</span>
							</button>
						</Motion.div>

						<div class="mt-6 mb-4 text-center flex flex-col items-center gap-1 opacity-50 relative z-10">
							<span class="text-[9px] font-black text-white uppercase tracking-widest">
								iFragment Unified Protocol
							</span>
							<span
								onClick={secretTrigger.onVersionTap}
								class="text-[9px] text-white/50 font-bold cursor-pointer select-none border-b border-white/20 pb-0.5"
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

			{/* ═══════ LANGUAGE SELECTION BOTTOM SHEET ═══════ */}
			<Show when={showLangMenu()}>
				<div
					class="fixed inset-0 z-[100] flex flex-col justify-end px-2 pb-2"
					onClick={() => setShowLangMenu(false)}
				>
					<div class="absolute inset-0 bg-[#030303]/90 backdrop-blur-2xl transition-opacity" />

					<Motion.div
						initial={{ y: '100%', opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }}
						class="relative bg-[#12141C] border border-white/10 rounded-[32px] p-6 pb-8 w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar mx-auto flex flex-col gap-3 shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
						onClick={(e: Event) => e.stopPropagation()}
					>
						<div class="absolute -top-10 -right-10 w-32 h-32 bg-amber-400/10 blur-3xl rounded-full pointer-events-none" />

						<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-4 relative z-10" />
						<div class="flex items-center gap-3 mb-4 relative z-10">
							<div class="w-10 h-10 rounded-[12px] bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
								<span class="material-symbols-outlined text-amber-400 text-[20px]">
									language
								</span>
							</div>
							<h3 class="text-white text-[18px] font-black tracking-tight">
								{t('profile.selectLanguageTitle')}
							</h3>
						</div>

						<div class="flex flex-col gap-2 relative z-10">
							<For
								each={
									[
										{ code: 'fa', label: 'فارسی (Persian)', icon: '🇮🇷' },
										{ code: 'ps', label: 'پښتو (Pashto)', icon: '🇦🇫' },
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
										class={`flex items-center justify-between p-4 rounded-[20px] transition-all min-h-[56px] border shadow-sm active:scale-[0.98] ${
											locale() === lang.code
												? 'bg-amber-400/15 border-amber-400/40 shadow-[0_0_15px_rgba(251,191,36,0.15)]'
												: 'bg-[#08090D] hover:bg-white/5 border-white/5 hover:border-white/15'
										}`}
									>
										<div class="flex items-center gap-4">
											<span class="text-[24px] drop-shadow-md">{lang.icon}</span>
											<span
												class={`font-black tracking-wide ${locale() === lang.code ? 'text-amber-400 text-[14px]' : 'text-white/80 text-[13px]'}`}
											>
												{lang.label}
											</span>
										</div>
										<Show when={locale() === lang.code}>
											<div class="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center shadow-md">
												<span class="material-symbols-outlined text-black text-[16px] font-black">
													done
												</span>
											</div>
										</Show>
									</button>
								)}
							</For>
						</div>
					</Motion.div>
				</div>
			</Show>
		</div>
	);
};
