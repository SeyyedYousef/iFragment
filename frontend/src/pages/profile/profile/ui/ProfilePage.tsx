import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { backButton, initData } from '@tma.js/sdk-solid';
import { type Component, createSignal, ErrorBoundary, For, onMount, Show } from 'solid-js';
import {
	getProfileAchievements,
	getProfileStats,
	getReferralInfo,
	setProfilePhotoUrl,
} from '@/entities/user/index.js';
import { useSecretTrigger } from '@/features/owner-gate/index.js';
import { formatNumber, locale, setLocale, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { ErrorFallback, SkeletonProfile } from '@/shared/ui/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { OwnerGateModal } from '@/widgets/owner/index.js';
import { AchievementPreview, IdentityHero, MyAssetsGallery } from '@/widgets/profile/index.js';

export const ProfilePage: Component = () => {
	const secretTrigger = useSecretTrigger();
	const navigate = useNavigate();
	const [showLangMenu, setShowLangMenu] = createSignal(false);

	const currentUserId = () => {
		const tgId = initData.user()?.id;
		return tgId ? String(tgId) : localStorage.getItem('tg_user_id') || '';
	};

	const getCachedStats = () => {
		try {
			const uid = currentUserId();
			if (!uid) return undefined;
			const key = `cached_profile_stats_${uid}`;
			const raw = localStorage.getItem(key);
			if (!raw) return undefined;
			const parsed = JSON.parse(raw);
			if (parsed?.telegramId && String(parsed.telegramId) !== uid) {
				return undefined;
			}
			return parsed;
		} catch {
			return undefined;
		}
	};

	const statsQuery = createQuery(() => ({
		queryKey: ['profile', 'stats', currentUserId()],
		queryFn: async () => {
			const res = await getProfileStats();
			if (res) {
				try {
					const userId = res.telegramId || currentUserId();
					if (userId) {
						localStorage.setItem(`cached_profile_stats_${userId}`, JSON.stringify(res));
						localStorage.setItem('tg_user_id', String(userId));
					}
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
		queryKey: ['profile', 'achievements', currentUserId()],
		queryFn: async () => {
			const res = await getProfileAchievements();
			if (res) {
				try {
					const uid = currentUserId();
					if (uid) {
						localStorage.setItem(`cached_profile_achievements_${uid}`, JSON.stringify(res));
					}
				} catch {}
			}
			return res;
		},
		staleTime: 30000,
		refetchOnWindowFocus: false,
	}));

	const referralQuery = createQuery(() => ({
		queryKey: ['profile', 'referral', currentUserId()],
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
			class="frag-canvas min-h-screen pb-32 text-[#f3f5f8] font-sans flex flex-col relative overflow-x-clip selection:bg-[#2990ff]/30"
			dir={t('common.dir') === 'rtl' ? 'rtl' : 'ltr'}
		>
			{loading() ? (
				<div class="px-4 pt-5 min-h-[80vh] relative z-10 max-w-md mx-auto w-full">
					<SkeletonProfile />
				</div>
			) : (
				<ErrorBoundary fallback={(err, reset) => <ErrorFallback err={err} reset={reset} />}>
					<div class="px-4 pt-4 flex flex-col gap-3.5 relative z-10 max-w-md mx-auto w-full">
						{/* 1. Identity Hero */}
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
							<IdentityHero stats={stats()} onStatusUpdated={() => statsQuery.refetch()} />
						</Motion.div>

						{/* 2. My Assets Gallery */}
						<MyAssetsGallery />

						{/* 3. Today's Progress & Gamification */}
						<Motion.div
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.12 }}
							class="frag-card-elevated rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
						>
							<div class="flex items-center justify-between gap-2">
								<div class="flex items-center gap-2.5 min-w-0">
									<div class="w-8 h-8 rounded-xl bg-[#141a22] border border-[#ffb340]/25 flex items-center justify-center text-[#ffb340] shrink-0">
										<span class="material-symbols-outlined text-[18px]">local_fire_department</span>
									</div>
									<div class="flex flex-col min-w-0">
										<span class="text-[13px] font-semibold text-white tracking-tight truncate">
											{t('progress.title')}
										</span>
										<span class="text-[11px] text-[#8ca0b5] font-medium truncate">
											{t('progress.streak', { days: stats()?.currentStreak ?? 0 })}
										</span>
									</div>
								</div>

								<button
									type="button"
									onClick={() => handleNavigate('/leaderboard')}
									class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#ffb340]/12 hover:bg-[#ffb340]/20 border border-[#ffb340]/28 text-[#ffb340] text-[11px] font-semibold active:scale-95 transition-all shrink-0"
								>
									<span>{t('navigation.leaderboard')}</span>
									<span class="material-symbols-outlined text-[14px] rtl:-scale-x-100">
										arrow_forward
									</span>
								</button>
							</div>

							<div class="grid grid-cols-2 gap-2 pt-0.5">
								<button
									type="button"
									onClick={() => handleNavigate('/leaderboard')}
									class="frag-inset hover:border-white/[0.14] rounded-xl p-3 flex items-center justify-between cursor-pointer active:scale-95 transition-all text-start w-full"
								>
									<div class="flex items-center gap-2 min-w-0">
										<div class="w-7 h-7 rounded-lg bg-[#2990ff]/12 border border-[#2990ff]/25 flex items-center justify-center text-[#5aaeff] shrink-0">
											<span class="material-symbols-outlined text-[16px]">rocket_launch</span>
										</div>
										<div class="flex flex-col min-w-0">
											<span class="text-[11px] font-semibold text-white truncate">
												{t('leaderboard.boostRank')}
											</span>
											<span class="text-[10px] text-[#5aaeff] font-medium truncate">
												{t('leaderboard.boostRewardHint')}
											</span>
										</div>
									</div>
									<span class="material-symbols-outlined text-[16px] text-[#738598] rtl:-scale-x-100 shrink-0">
										chevron_right
									</span>
								</button>

								<button
									type="button"
									onClick={() => handleNavigate('/leaderboard')}
									class="frag-inset hover:border-white/[0.14] rounded-xl p-3 flex items-center justify-between cursor-pointer active:scale-95 transition-all text-start w-full"
								>
									<div class="flex items-center gap-2 min-w-0">
										<div class="w-7 h-7 rounded-lg bg-[#ffb340]/12 border border-[#ffb340]/25 flex items-center justify-center text-[#ffb340] shrink-0">
											<span class="material-symbols-outlined text-[16px]">emoji_events</span>
										</div>
										<div class="flex flex-col min-w-0">
											<span class="text-[11px] font-semibold text-white truncate tabular-nums">
												{stats()?.globalRank
													? t('profilePg.rankLabel' as any, { rank: stats()?.globalRank })
													: t('profilePg.unranked' as any) || '—'}
											</span>
											<span class="text-[10px] text-[#ffb340] font-medium truncate">
												{t('profilePg.globalBoard' as any)}
											</span>
										</div>
									</div>
									<span class="material-symbols-outlined text-[16px] text-[#738598] rtl:-scale-x-100 shrink-0">
										chevron_right
									</span>
								</button>
							</div>
						</Motion.div>

						{/* 4. Referral Revenue-Share Summary */}
						<Motion.div
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.14 }}
							class="frag-card-elevated rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
						>
							<div class="flex items-center justify-between gap-2">
								<div class="flex items-center gap-2.5 min-w-0">
									<div class="w-8 h-8 rounded-xl bg-[#141a22] border border-[#2990ff]/25 flex items-center justify-center text-[#5aaeff] shrink-0">
										<span class="material-symbols-outlined text-[18px]">group</span>
									</div>
									<div class="flex flex-col min-w-0">
										<span class="text-[13px] font-semibold text-white tracking-tight truncate">
											{t('referral.title')}
										</span>
										<span class="text-[11px] text-[#8ca0b5] font-medium flex items-center gap-1 tabular-nums truncate">
											<span>
												{referrals()?.totalInvited || 0} {t('referral.friends')}
											</span>
											<span>·</span>
											<span class="inline-flex items-center gap-0.5 text-[#ffb340]">
												{formatNumber(referrals()?.totalEarned || 0)}
												<span class="material-symbols-outlined text-[12px]">bolt</span>
											</span>
											<span>{t('referral.credits')}</span>
										</span>
									</div>
								</div>

								<button
									type="button"
									onClick={() => {
										const code = referrals()?.referralCode;
										if (code) {
											const link = `https://t.me/iFragmentBot?start=${encodeURIComponent(code)}`;
											navigator.clipboard?.writeText(link);
											haptic.notify('success');
										}
									}}
									class="frag-btn-secondary flex items-center gap-1 px-3 py-1.5 rounded-xl text-[#5aaeff] text-[11px] font-semibold active:scale-95 transition-all shrink-0"
								>
									<span>{t('referral.invite')}</span>
									<span class="material-symbols-outlined text-[14px]">content_copy</span>
								</button>
							</div>
						</Motion.div>

						{/* 5. Three-Vertical Ecosystem Switcher */}
						<Motion.div
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.16 }}
							class="frag-card-elevated rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
						>
							<div class="flex items-center gap-2.5">
								<div class="w-8 h-8 rounded-xl bg-[#141a22] border border-[#2990ff]/25 flex items-center justify-center text-[#5aaeff]">
									<span class="material-symbols-outlined text-[18px]">hub</span>
								</div>
								<div class="flex flex-col">
									<span class="text-[13px] font-semibold text-white tracking-tight">
										{t('verticals.title')}
									</span>
									<span class="text-[11px] text-[#8ca0b5] font-medium">
										{t('verticals.subtitle')}
									</span>
								</div>
							</div>

							<div class="grid grid-cols-3 gap-2 pt-0.5">
								{/* Usernames */}
								<button
									type="button"
									onClick={() => handleNavigate('/')}
									class="frag-inset border-[#2990ff]/35 hover:border-[#2990ff]/60 rounded-xl p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-all"
								>
									<div class="w-8 h-8 rounded-lg bg-[#2990ff]/12 border border-[#2990ff]/25 flex items-center justify-center text-[#5aaeff]">
										<span class="material-symbols-outlined text-[18px]">alternate_email</span>
									</div>
									<span class="text-[11px] font-semibold text-white">
										{t('profilePg.verticalUsernames' as any)}
									</span>
									<span class="text-[9px] px-1.5 py-0.5 rounded bg-[#2990ff]/15 text-[#5aaeff] font-semibold">
										{t('profilePg.badgeActive' as any)}
									</span>
								</button>

								{/* Numbers +888 */}
								<button
									type="button"
									onClick={() => handleNavigate('/numbers')}
									class="frag-inset border-[#ffb340]/30 hover:border-[#ffb340]/55 rounded-xl p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-all"
								>
									<div class="w-8 h-8 rounded-lg bg-[#ffb340]/12 border border-[#ffb340]/25 flex items-center justify-center text-[#ffb340]">
										<span class="material-symbols-outlined text-[18px]">dialpad</span>
									</div>
									<span class="text-[11px] font-semibold text-white">
										{t('profilePg.verticalNumbers' as any)}
									</span>
									<span class="text-[9px] px-1.5 py-0.5 rounded bg-[#ffb340]/15 text-[#ffb340] font-semibold">
										{t('profilePg.badgeActive' as any)}
									</span>
								</button>

								{/* Telegram Gifts */}
								<button
									type="button"
									onClick={() => handleNavigate('/gifts')}
									class="frag-inset border-[#4cd964]/30 hover:border-[#4cd964]/55 rounded-xl p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-all"
								>
									<div class="w-8 h-8 rounded-lg bg-[#4cd964]/12 border border-[#4cd964]/25 flex items-center justify-center text-[#4cd964]">
										<span class="material-symbols-outlined text-[18px]">redeem</span>
									</div>
									<span class="text-[11px] font-semibold text-white">
										{t('profilePg.verticalGifts' as any)}
									</span>
									<span class="text-[9px] px-1.5 py-0.5 rounded bg-[#4cd964]/15 text-[#4cd964] font-semibold">
										{t('profilePg.badgeActive' as any)}
									</span>
								</button>
							</div>
						</Motion.div>

						{/* Achievements Preview */}
						<Show when={!achievementsQuery.isLoading}>
							<button
								type="button"
								onClick={() => handleNavigate('/profile/achievements')}
								class="w-full text-start cursor-pointer active:scale-[0.99] transition-transform"
							>
								<AchievementPreview achievements={achievements()} />
							</button>
						</Show>

						{/* 6. Accessible Action Controls */}
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
							class="frag-card-elevated rounded-2xl p-2 flex items-center justify-between gap-2 mt-0.5"
						>
							<button
								type="button"
								onClick={() => handleNavigate('/profile/settings')}
								aria-label={t('profile.settings')}
								class="flex-1 min-h-[46px] flex items-center justify-center gap-2 py-2.5 frag-inset rounded-xl hover:bg-white/[0.04] hover:border-white/[0.14] active:scale-95 transition-all group"
							>
								<div class="w-7 h-7 rounded-lg bg-[#2990ff]/12 border border-[#2990ff]/25 flex items-center justify-center shrink-0">
									<span class="material-symbols-outlined text-[#5aaeff] text-[17px]">settings</span>
								</div>
								<span class="text-[11px] font-semibold text-[#d2dce7]">
									{t('profile.settings')}
								</span>
							</button>

							<button
								type="button"
								onClick={() => setShowLangMenu(true)}
								aria-label={t('profile.language')}
								class="flex-1 min-h-[46px] flex items-center justify-center gap-2 py-2.5 frag-inset rounded-xl hover:bg-white/[0.04] hover:border-white/[0.14] active:scale-95 transition-all group"
							>
								<div class="w-7 h-7 rounded-lg bg-[#ffb340]/12 border border-[#ffb340]/25 flex items-center justify-center shrink-0">
									<span class="material-symbols-outlined text-[#ffb340] text-[17px]">language</span>
								</div>
								<span class="text-[11px] font-semibold text-[#d2dce7]">
									{t('profile.language')}
								</span>
							</button>

							<button
								type="button"
								onClick={() => handleNavigate('/profile/security')}
								aria-label={t('profile.security')}
								class="flex-1 min-h-[46px] flex items-center justify-center gap-2 py-2.5 frag-inset rounded-xl hover:bg-white/[0.04] hover:border-white/[0.14] active:scale-95 transition-all group"
							>
								<div class="w-7 h-7 rounded-lg bg-[#4cd964]/12 border border-[#4cd964]/25 flex items-center justify-center shrink-0">
									<span class="material-symbols-outlined text-[#4cd964] text-[17px]">security</span>
								</div>
								<span class="text-[11px] font-semibold text-[#d2dce7]">
									{t('profile.security')}
								</span>
							</button>
						</Motion.div>

						{/* Version & Build */}
						<div class="mt-3 mb-2 text-center flex flex-col items-center gap-1 opacity-55 relative z-10">
							<span class="text-[10px] font-semibold text-[#8ca0b5]">
								{t('profilePg.versionTagline' as any)}
							</span>
							<button
								type="button"
								onClick={secretTrigger.onVersionTap}
								class="text-[10px] text-[#738598] font-mono cursor-pointer select-none border-b border-white/15 pb-0.5 hover:text-white transition-colors"
							>
								{t('profile.versionInfo')}
							</button>
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
					class="fixed inset-0 z-[100] flex flex-col justify-end px-2 pb-2"
					onClick={() => setShowLangMenu(false)}
				>
					<div class="absolute inset-0 bg-[#0b0e14]/85 backdrop-blur-xl transition-opacity" />

					<Motion.div
						initial={{ y: '100%', opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.32, easing: [0.32, 0.72, 0, 1] }}
						class="frag-sheet relative rounded-[26px] p-5 pb-7 w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar mx-auto flex flex-col gap-3"
						onClick={(e: Event) => e.stopPropagation()}
					>
						<div class="w-10 h-1 bg-white/15 rounded-full mx-auto mb-2" />
						<div class="flex items-center gap-3 mb-2">
							<div class="w-9 h-9 rounded-xl bg-[#141a22] border border-[#ffb340]/25 flex items-center justify-center shrink-0">
								<span class="material-symbols-outlined text-[#ffb340] text-[19px]">language</span>
							</div>
							<h3 class="text-white text-[17px] font-bold tracking-tight">
								{t('profile.selectLanguageTitle')}
							</h3>
						</div>

						<div class="flex flex-col gap-2">
							<For
								each={
									[
										{ code: 'fa', label: t('profilePg.langFaFull' as any), icon: '🇮🇷' },
										{ code: 'en', label: t('profilePg.langEnFull' as any), icon: '🇬🇧' },
										{ code: 'ru', label: t('profilePg.langRuFull' as any), icon: '🇷🇺' },
										{ code: 'zh', label: t('profilePg.langZhFull' as any), icon: '🇨🇳' },
									] as const
								}
							>
								{(lang) => (
									<button
										type="button"
										onClick={() => {
											setLocale(lang.code);
											try {
												haptic.selection();
											} catch {}
											setShowLangMenu(false);
										}}
										class={`flex items-center justify-between p-3.5 rounded-xl transition-all min-h-[54px] border active:scale-[0.98] ${
											locale() === lang.code
												? 'bg-[#2990ff]/12 border-[#2990ff]/40'
												: 'frag-inset hover:bg-white/[0.04] hover:border-white/15'
										}`}
									>
										<div class="flex items-center gap-3.5">
											<span class="text-[22px]">{lang.icon}</span>
											<span
												class={`font-semibold ${
													locale() === lang.code
														? 'text-[#5aaeff] text-[14px]'
														: 'text-[#d2dce7] text-[13px]'
												}`}
											>
												{lang.label}
											</span>
										</div>
										<Show when={locale() === lang.code}>
											<div class="w-6 h-6 rounded-full bg-[#2990ff] flex items-center justify-center shadow-sm">
												<span class="material-symbols-outlined text-white text-[15px] font-bold">
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
