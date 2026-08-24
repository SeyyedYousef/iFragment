import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createMemo, createSignal, ErrorBoundary, For, onMount, Show } from 'solid-js';
import { useSecretTrigger } from '@/features/owner-gate/index.js';
import { getProfileAchievements, getProfileStats, getReferralInfo, setProfilePhotoUrl } from '@/entities/user/index.js';
import { formatNumber, locale, setLocale, t } from '@/shared/i18n/index.js';
import { ErrorFallback, SkeletonProfile } from '@/shared/ui/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { OwnerGateModal } from '@/widgets/owner/index.js';
import {
	AchievementPreview,
	IdentityHero,
	MyAssetsGallery,
	WalletCard,
} from '@/widgets/profile/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export const ProfilePage: Component = () => {
	const secretTrigger = useSecretTrigger();
	const navigate = useNavigate();
	const [showLangMenu, setShowLangMenu] = createSignal(false);

	const getCachedStats = () => {
		try {
			const storedUserId = localStorage.getItem('tg_user_id');
			const key = storedUserId ? `cached_profile_stats_${storedUserId}` : 'cached_profile_stats';
			const raw = localStorage.getItem(key) || localStorage.getItem('cached_profile_stats');
			if (!raw) return undefined;
			const parsed = JSON.parse(raw);
			if (storedUserId && parsed?.telegramId && String(parsed.telegramId) !== storedUserId) {
				return undefined;
			}
			return parsed;
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
					const userId = res.telegramId || localStorage.getItem('tg_user_id');
					if (userId) {
						localStorage.setItem(`cached_profile_stats_${userId}`, JSON.stringify(res));
						localStorage.setItem('tg_user_id', String(userId));
					}
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
					const storedUserId = localStorage.getItem('tg_user_id');
					if (storedUserId) {
						localStorage.setItem(`cached_profile_achievements_${storedUserId}`, JSON.stringify(res));
					}
					localStorage.setItem('cached_profile_achievements', JSON.stringify(res));
				} catch {}
			}
			return res;
		},
		staleTime: 30000,
		refetchOnWindowFocus: false,
	}));

	const referralQuery = createQuery(() => ({
		queryKey: ['profile', 'referral'],
		queryFn: getReferralInfo,
		staleTime: 30000,
	}));

	const loading = () => statsQuery.isLoading;
	const stats = () => statsQuery.data || null;
	const achievements = () => achievementsQuery.data || [];
	const referrals = () => referralQuery.data;

	onMount(() => {
		try {
			backButton.hide();
		} catch {}
	});

	const handleNavigate = (path: string) => {
		try {
			haptic.impact('light');
		} catch {}
		navigate(path);
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-32 text-white font-sans flex flex-col relative overflow-x-hidden selection:bg-[#0098EA]/30"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[450px] bg-gradient-to-b from-[#0098EA]/15 via-[#06b6d4]/5 to-transparent blur-[90px] pointer-events-none z-0" />

			{loading() ? (
				<div class="px-5 pt-6 min-h-[80vh] relative z-10 max-w-md mx-auto w-full">
					<SkeletonProfile />
				</div>
			) : (
				<ErrorBoundary fallback={(err, reset) => <ErrorFallback err={err} reset={reset} />}>
					<div class="px-4 pt-4 flex flex-col gap-4 relative z-10 max-w-md mx-auto w-full">
						{/* ═══════ 1. IDENTITY HERO ═══════ */}
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.04 }}
							onTouchStart={secretTrigger.onLogoPressStart}
							onTouchEnd={secretTrigger.onLogoPressEnd}
							onTouchCancel={secretTrigger.onLogoPressEnd}
							onMouseDown={secretTrigger.onLogoPressStart}
							onMouseUp={secretTrigger.onLogoPressEnd}
							onMouseLeave={secretTrigger.onLogoPressEnd}
						>
							<IdentityHero
								stats={stats()}
								onStatusUpdated={() => statsQuery.refetch()}
							/>
						</Motion.div>

						{/* ═══════ 2. WALLET & UNIFIED LEDGER SUMMARY ═══════ */}
						<WalletCard
							stats={stats()}
							onBuyStars={() => handleNavigate('/marketplace')}
						/>

						{/* ═══════ 3. MY ASSETS GALLERY (4 TABS) ═══════ */}
						<MyAssetsGallery />

						{/* ═══════ 4. TODAY'S PROGRESS & GAMIFICATION ═══════ */}
						<Motion.div
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.12 }}
							class="bg-[#0D1017]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col gap-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
						>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<div class="w-8 h-8 rounded-[10px] bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
										<span class="material-symbols-outlined text-[18px]">local_fire_department</span>
									</div>
									<div class="flex flex-col">
										<span class="text-[13px] font-black text-white tracking-tight">
											{t('progress.title' as any) || "Today's Progress"}
										</span>
										<span class="text-[9px] text-white/40 font-bold uppercase tracking-wider">
											{t('progress.streak' as any, { days: stats()?.currentStreak || 1 }) || `${stats()?.currentStreak || 1} Day Streak`}
										</span>
									</div>
								</div>

								{/* Direct deep-links to Airdrop tabs */}
								<button
									onClick={() => handleNavigate('/airdrop?tab=earn')}
									class="flex items-center gap-1 px-3 py-1.5 rounded-[12px] bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase tracking-wide active:scale-95 transition-all"
								>
									<span>{t('progress.earnTasks' as any) || 'Earn Tasks'}</span>
									<span class="material-symbols-outlined text-[14px]">arrow_forward</span>
								</button>
							</div>

							{/* Streak and Boost Quick Pill */}
							<div class="grid grid-cols-2 gap-2 pt-1">
								<div
									onClick={() => handleNavigate('/airdrop?tab=boost')}
									class="p-3 bg-[#07090E] border border-white/5 hover:border-white/15 rounded-[18px] flex items-center justify-between cursor-pointer active:scale-95 transition-all"
								>
									<div class="flex items-center gap-2">
										<span class="text-[20px]">🚀</span>
										<div class="flex flex-col">
											<span class="text-[11px] font-black text-white">Boosters</span>
											<span class="text-[9px] text-cyan-400 font-bold">Speed up mining</span>
										</div>
									</div>
									<span class="material-symbols-outlined text-[16px] text-white/40">chevron_right</span>
								</div>

								<div
									onClick={() => handleNavigate('/profile/leaderboard')}
									class="p-3 bg-[#07090E] border border-white/5 hover:border-white/15 rounded-[18px] flex items-center justify-between cursor-pointer active:scale-95 transition-all"
								>
									<div class="flex items-center gap-2">
										<span class="text-[20px]">🏆</span>
										<div class="flex flex-col">
											<span class="text-[11px] font-black text-white">Rank #{stats()?.globalRank || 1}</span>
											<span class="text-[9px] text-amber-400 font-bold">Global Board</span>
										</div>
									</div>
									<span class="material-symbols-outlined text-[16px] text-white/40">chevron_right</span>
								</div>
							</div>
						</Motion.div>

						{/* ═══════ 5. REFERRAL REVENUE-SHARE SUMMARY ═══════ */}
						<Motion.div
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.14 }}
							class="bg-[#0D1017]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col gap-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
						>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2.5">
									<div class="w-8 h-8 rounded-[10px] bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
										<span class="material-symbols-outlined text-[18px]">group</span>
									</div>
									<div class="flex flex-col">
										<span class="text-[13px] font-black text-white tracking-tight">
											{t('referral.title' as any) || 'Frens Network'}
										</span>
										<span class="text-[9px] text-white/40 font-bold uppercase tracking-wider">
											{referrals()?.totalInvited || 0} {t('referral.friends' as any) || 'Friends'} · {formatNumber(referrals()?.totalEarned || 0)}🪙 {t('referral.earned' as any) || 'Earned'}
										</span>
									</div>
								</div>

								<button
									onClick={() => handleNavigate('/airdrop?tab=frens')}
									class="flex items-center gap-1 px-3 py-1.5 rounded-[12px] bg-cyan-400/15 hover:bg-cyan-400/25 border border-cyan-400/30 text-cyan-300 text-[10px] font-black uppercase tracking-wide active:scale-95 transition-all"
								>
									<span>{t('referral.invite' as any) || 'Invite Frens'}</span>
									<span class="material-symbols-outlined text-[14px]">arrow_forward</span>
								</button>
							</div>
						</Motion.div>

						{/* ═══════ 6. THREE-VERTICAL ECOSYSTEM SWITCHER ═══════ */}
						<Motion.div
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.16 }}
							class="bg-[#0D1017]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col gap-3 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
						>
							<div class="flex items-center gap-2">
								<div class="w-8 h-8 rounded-[10px] bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center text-[#0098EA]">
									<span class="material-symbols-outlined text-[18px]">hub</span>
								</div>
								<div class="flex flex-col">
									<span class="text-[13px] font-black text-white tracking-tight">
										{t('verticals.title' as any) || 'Ecosystem Verticals'}
									</span>
									<span class="text-[9px] text-white/40 font-bold uppercase tracking-wider">
										{t('verticals.subtitle' as any) || 'Cross-vertical navigation'}
									</span>
								</div>
							</div>

							<div class="grid grid-cols-3 gap-2 pt-1">
								{/* 1. Usernames Vertical (Active) */}
								<button
									onClick={() => handleNavigate('/')}
									class="p-3 bg-[#07090E] border border-[#0098EA]/40 rounded-[18px] flex flex-col items-center gap-1.5 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,152,234,0.15)]"
								>
									<span class="text-[22px]">🏷️</span>
									<span class="text-[11px] font-black text-white">Usernames</span>
									<span class="text-[8px] px-1.5 py-0.5 rounded-[6px] bg-[#0098EA]/20 text-[#0098EA] font-black uppercase">
										Active ✓
									</span>
								</button>

								{/* 2. Numbers Vertical (Coming Soon) */}
								<button
									onClick={() => handleNavigate('/numbers')}
									class="p-3 bg-[#07090E] border border-white/5 hover:border-white/15 rounded-[18px] flex flex-col items-center gap-1.5 active:scale-95 transition-all group"
								>
									<span class="text-[22px]">📱</span>
									<span class="text-[11px] font-black text-white/80">Numbers</span>
									<span class="text-[8px] px-1.5 py-0.5 rounded-[6px] bg-amber-400/20 text-amber-400 font-black uppercase">
										🔜 Soon
									</span>
								</button>

								{/* 3. Gifts Vertical (Coming Soon) */}
								<button
									onClick={() => handleNavigate('/gifts')}
									class="p-3 bg-[#07090E] border border-white/5 hover:border-white/15 rounded-[18px] flex flex-col items-center gap-1.5 active:scale-95 transition-all group"
								>
									<span class="text-[22px]">🎁</span>
									<span class="text-[11px] font-black text-white/80">Gifts</span>
									<span class="text-[8px] px-1.5 py-0.5 rounded-[6px] bg-purple-400/20 text-purple-300 font-black uppercase">
										🔜 Soon
									</span>
								</button>
							</div>
						</Motion.div>

						{/* ═══════ ACHIEVEMENTS PREVIEW (5-min sync) ═══════ */}
						<Show when={!achievementsQuery.isLoading}>
							<div
								onClick={() => handleNavigate('/profile/achievements')}
								class="cursor-pointer active:scale-[0.99] transition-transform"
							>
								<AchievementPreview achievements={achievements()} />
							</div>
						</Show>

						{/* ═══════ 7. ACCESSIBLE ACTION CONTROLS ═══════ */}
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
							class="bg-[#0D1017]/90 backdrop-blur-2xl border border-white/10 rounded-[24px] p-2 flex items-center justify-between gap-2 mt-1 shadow-sm"
						>
							<button
								onClick={() => handleNavigate('/profile/settings')}
								aria-label={t('profile.settings')}
								class="flex-1 min-h-[48px] flex items-center justify-center gap-2 py-3 bg-[#07090E] border border-white/5 rounded-[18px] hover:bg-white/5 hover:border-white/10 active:scale-95 transition-all shadow-inner group"
							>
								<div class="w-8 h-8 rounded-[10px] bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
									<span class="material-symbols-outlined text-[#0098EA] text-[18px]">
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
								class="flex-1 min-h-[48px] flex items-center justify-center gap-2 py-3 bg-[#07090E] border border-white/5 rounded-[18px] hover:bg-white/5 hover:border-white/10 active:scale-95 transition-all shadow-inner group"
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
								class="flex-1 min-h-[48px] flex items-center justify-center gap-2 py-3 bg-[#07090E] border border-white/5 rounded-[18px] hover:bg-white/5 hover:border-white/10 active:scale-95 transition-all shadow-inner group"
							>
								<div class="w-8 h-8 rounded-[10px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
									<span class="material-symbols-outlined text-emerald-400 text-[18px]">
										security
									</span>
								</div>
								<span class="text-[11px] font-black uppercase tracking-widest text-white/80">
									{t('profile.security')}
								</span>
							</button>
						</Motion.div>

						{/* Version & Build */}
						<div class="mt-4 mb-2 text-center flex flex-col items-center gap-1 opacity-50 relative z-10">
							<span class="text-[9px] font-black text-white uppercase tracking-widest">
								iFragment Command Center · 3-Pillar Economy
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
						transition={{ duration: 0.32, easing: [0.32, 0.72, 0, 1] }}
						class="relative bg-[#0D1017] border border-white/10 rounded-[32px] p-6 pb-8 w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar mx-auto flex flex-col gap-3 shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
						onClick={(e: Event) => e.stopPropagation()}
					>
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
												haptic.selection();
											} catch {}
											setShowLangMenu(false);
										}}
										class={`flex items-center justify-between p-4 rounded-[20px] transition-all min-h-[56px] border shadow-sm active:scale-[0.98] ${
											locale() === lang.code
												? 'bg-amber-400/15 border-amber-400/40 shadow-[0_0_15px_rgba(251,191,36,0.15)]'
												: 'bg-[#07090E] hover:bg-white/5 border-white/5 hover:border-white/15'
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
