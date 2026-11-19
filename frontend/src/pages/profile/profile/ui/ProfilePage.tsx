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
import { TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { ErrorFallback, SkeletonProfile } from '@/shared/ui/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { OwnerGateModal } from '@/widgets/owner/index.js';
import { IdentityHero, MyAssetsGallery } from '@/widgets/profile/index.js';

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
			const raw = localStorage.getItem(`cached_profile_stats_${uid}`);
			if (!raw) return undefined;
			const parsed = JSON.parse(raw);
			if (parsed?.telegramId && String(parsed.telegramId) !== uid) return undefined;
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
					if (res.photoUrl) setProfilePhotoUrl(res.photoUrl);
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
		queryFn: getProfileAchievements,
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
			class="frag-canvas min-h-screen pb-32 text-white font-frag-sans flex flex-col relative overflow-x-clip"
			dir={t('common.dir') === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Authentic Fragment.com Sticky Top Header (.tm-header) */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => navigate('/')}
					class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
				>
					<TonIcon size={20} color="#4db2ff" />
					<span class="text-[15px] font-bold tracking-[0.04em]" dir="ltr">
						FRAGMENT
					</span>
				</button>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setShowLangMenu(true)}
						aria-label={t('profile.language')}
						class="h-8 px-2.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-white text-[12px] font-semibold flex items-center gap-1 cursor-pointer"
					>
						<span class="material-symbols-outlined text-[15px] text-[#4db2ff]">language</span>
						<span>{locale().toUpperCase()}</span>
					</button>
					<button
						type="button"
						onClick={() => handleNavigate('/profile/settings')}
						aria-label={t('profile.settings')}
						class="h-8 w-8 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-white flex items-center justify-center cursor-pointer"
					>
						<span class="material-symbols-outlined text-[17px]">settings</span>
					</button>
				</div>
			</header>

			{loading() ? (
				<div class="px-4 pt-5 min-h-[80vh] relative z-10 max-w-[480px] mx-auto w-full">
					<SkeletonProfile />
				</div>
			) : (
				<ErrorBoundary fallback={(err, reset) => <ErrorFallback err={err} reset={reset} />}>
					<div class="px-4 pt-5 flex flex-col gap-4 relative z-10 max-w-[480px] mx-auto w-full">
						{/* 1. Compact Fragment Identity Header (with secret owner trigger) */}
						<div
							onTouchStart={secretTrigger.onLogoPressStart}
							onTouchEnd={secretTrigger.onLogoPressEnd}
							onTouchCancel={secretTrigger.onLogoPressEnd}
							onMouseDown={secretTrigger.onLogoPressStart}
							onMouseUp={secretTrigger.onLogoPressEnd}
							onMouseLeave={secretTrigger.onLogoPressEnd}
						>
							<IdentityHero stats={stats()} onStatusUpdated={() => statsQuery.refetch()} />
						</div>

						{/* 2. My Assets Gallery (.frag-table-container) */}
						<MyAssetsGallery />

						{/* 3. Account & Activity Menu (.frag-table-container — Fragment .tm-list style) */}
						<div class="frag-table-container">
							{/* Leaderboard & Streak Row */}
							<button
								type="button"
								onClick={() => handleNavigate('/leaderboard')}
								class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
							>
								<div class="flex items-center gap-3 min-w-0">
									<span class="material-symbols-outlined text-[19px] text-[#ff9953]">
										leaderboard
									</span>
									<div class="flex flex-col min-w-0">
										<span class="text-[13.5px] font-semibold text-white truncate">
											{t('navigation.leaderboard')}
										</span>
										<span class="text-[11.5px] text-[#8c9aa9] truncate">
											{t('progress.streak', { days: stats()?.currentStreak ?? 0 })}
										</span>
									</div>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<Show when={stats()?.globalRank}>
										<span class="px-2 py-0.5 rounded-[4px] bg-[#ff9953]/10 text-[#ff9953] text-[11px] font-mono font-semibold">
											#{stats()?.globalRank}
										</span>
									</Show>
									<span class="material-symbols-outlined text-[17px] text-[#8c9aa9] rtl:rotate-180">
										chevron_right
									</span>
								</div>
							</button>

							{/* Achievements Row */}
							<button
								type="button"
								onClick={() => handleNavigate('/profile/achievements')}
								class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
							>
								<div class="flex items-center gap-3 min-w-0">
									<span class="material-symbols-outlined text-[19px] text-[#4db2ff]">
										emoji_events
									</span>
									<div class="flex flex-col min-w-0">
										<span class="text-[13.5px] font-semibold text-white truncate">
											{t('achievements.title')}
										</span>
										<span class="text-[11.5px] text-[#8c9aa9] truncate">
											{t('achievements.completed')}
										</span>
									</div>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<span class="px-2 py-0.5 rounded-[4px] bg-[#4db2ff]/10 text-[#4db2ff] text-[11px] font-mono font-semibold">
										{achievements().filter((a) => a.unlocked).length}
									</span>
									<span class="material-symbols-outlined text-[17px] text-[#8c9aa9] rtl:rotate-180">
										chevron_right
									</span>
								</div>
							</button>

							{/* Referral Program Row */}
							<div class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3">
								<div class="flex items-center gap-3 min-w-0">
									<span class="material-symbols-outlined text-[19px] text-[#5aec8c]">group</span>
									<div class="flex flex-col min-w-0">
										<span class="text-[13.5px] font-semibold text-white truncate">
											{t('referral.title')}
										</span>
										<span class="text-[11.5px] text-[#8c9aa9] truncate tabular-nums">
											{referrals()?.totalInvited || 0} {t('referral.friends')} ·{' '}
											{formatNumber(referrals()?.totalEarned || 0)} {t('referral.credits')}
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
											try {
												haptic.notify('success');
											} catch {}
										}
									}}
									class="px-2.5 py-1 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-[#4db2ff] text-[12px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
								>
									<span>{t('referral.invite')}</span>
									<span class="material-symbols-outlined text-[14px]">content_copy</span>
								</button>
							</div>
						</div>

						{/* 4. Settings & Security Table (.frag-table-container) */}
						<div class="frag-table-container">
							<button
								type="button"
								onClick={() => handleNavigate('/profile/settings')}
								class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
							>
								<div class="flex items-center gap-3">
									<span class="material-symbols-outlined text-[19px] text-[#8c9aa9]">settings</span>
									<span class="text-[13.5px] font-semibold text-white">
										{t('profile.settings')}
									</span>
								</div>
								<span class="material-symbols-outlined text-[17px] text-[#8c9aa9] rtl:rotate-180">
									chevron_right
								</span>
							</button>

							<button
								type="button"
								onClick={() => setShowLangMenu(true)}
								class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
							>
								<div class="flex items-center gap-3">
									<span class="material-symbols-outlined text-[19px] text-[#8c9aa9]">language</span>
									<span class="text-[13.5px] font-semibold text-white">
										{t('profile.language')}
									</span>
								</div>
								<span class="text-[12px] font-mono text-[#4db2ff] uppercase">{locale()}</span>
							</button>

							<button
								type="button"
								onClick={() => handleNavigate('/profile/security')}
								class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
							>
								<div class="flex items-center gap-3">
									<span class="material-symbols-outlined text-[19px] text-[#8c9aa9]">security</span>
									<span class="text-[13.5px] font-semibold text-white">
										{t('profile.security')}
									</span>
								</div>
								<span class="material-symbols-outlined text-[17px] text-[#8c9aa9] rtl:rotate-180">
									chevron_right
								</span>
							</button>
						</div>

						{/* Version Footer */}
						<div class="mt-2 text-center flex flex-col items-center gap-1">
							<button
								type="button"
								onClick={secretTrigger.onVersionTap}
								class="text-[11px] text-[#6d8394] font-mono cursor-pointer select-none hover:text-white transition-colors"
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

			{/* Language Selection Sheet */}
			<Show when={showLangMenu()}>
				<div
					class="fixed inset-0 z-[100] flex flex-col justify-end bg-black/70 backdrop-blur-sm"
					onClick={() => setShowLangMenu(false)}
				>
					<div
						class="frag-sheet rounded-t-[16px] p-4 pb-7 w-full max-w-[480px] mx-auto flex flex-col gap-2"
						onClick={(e: Event) => e.stopPropagation()}
					>
						<div class="w-9 h-1 bg-white/15 rounded-full mx-auto mb-2" />
						<h3 class="text-white text-[15px] font-semibold mb-1 px-1">
							{t('profile.selectLanguageTitle')}
						</h3>

						<div class="frag-table-container">
							<For
								each={
									[
										{ code: 'fa', label: t('profilePg.langFaFull' as any) },
										{ code: 'en', label: t('profilePg.langEnFull' as any) },
										{ code: 'ru', label: t('profilePg.langRuFull' as any) },
										{ code: 'zh', label: t('profilePg.langZhFull' as any) },
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
										class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between text-start cursor-pointer"
									>
										<span
											class={`text-[13.5px] font-semibold ${
												locale() === lang.code ? 'text-[#4db2ff]' : 'text-white'
											}`}
										>
											{lang.label}
										</span>
										<Show when={locale() === lang.code}>
											<span class="material-symbols-outlined text-[#4db2ff] text-[18px]">
												check
											</span>
										</Show>
									</button>
								)}
							</For>
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
};
