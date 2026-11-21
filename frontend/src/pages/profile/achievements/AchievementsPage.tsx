import { createQuery } from '@tanstack/solid-query';
import { backButton } from '@tma.js/sdk-solid';
import { type Component, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
	ACHIEVEMENT_DEFS,
	getAchievementDefs,
	getProfileAchievements,
} from '@/entities/user/index.js';
import { formatNumber, locale, t } from '@/shared/i18n/index.js';
import { haptic, shareToStory, switchInlineQuery } from '@/shared/lib/telegram-native.js';
import { TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';

export const AchievementsPage: Component = () => {
	const [activeCategory, setActiveCategory] = createSignal<string>('all');
	const [selectedAch, setSelectedAch] = createSignal<any | null>(null);

	const achievementsQuery = createQuery(() => ({
		queryKey: ['profile', 'achievements'],
		queryFn: getProfileAchievements,
		staleTime: 30000,
	}));

	const defsQuery = createQuery(() => ({
		queryKey: ['profile', 'achievements', 'defs'],
		queryFn: getAchievementDefs,
		staleTime: 300000,
	}));

	const categories = [
		{ id: 'all', label: () => t('achievements.categories.all') },
		{ id: 'onboarding', label: () => t('achievements.categories.onboarding') },
		{ id: 'mining', label: () => t('achievements.categories.mining') },
		{ id: 'analysis', label: () => t('achievements.categories.analysis') },
		{ id: 'social', label: () => t('achievements.categories.social') },
		{ id: 'management', label: () => t('achievements.categories.management') },
		{ id: 'streaks', label: () => t('achievements.categories.streaks') },
		{ id: 'special', label: () => t('achievements.categories.special') },
	];

	onMount(() => {
		try {
			backButton.show();
			const off = backButton.onClick(() => window.history.back());
			onCleanup(() => {
				off();
				try {
					backButton.hide();
				} catch {}
			});
		} catch {}
	});

	const mergedAchievements = createMemo(() => {
		const serverDefs = defsQuery.data || [];
		const serverAchs = achievementsQuery.data || [];

		return ACHIEVEMENT_DEFS.map((localDef) => {
			const serverDef = serverDefs.find((d) => d.id === localDef.id);
			const serverData = serverAchs.find((a) => a.id === localDef.id);

			const target = serverDef ? serverDef.target : (localDef as any).target || 1;
			const title = t(`achievements.${localDef.id}_title` as any);
			const desc = t(`achievements.${localDef.id}_desc` as any);

			return {
				...localDef,
				target,
				unlocked: serverData?.unlocked ?? false,
				progress: serverData?.progress ?? 0,
				unlockedAt: serverData?.unlockedAt,
				title,
				desc,
			};
		});
	});

	const filteredAchievements = createMemo(() => {
		const cat = activeCategory();
		if (cat === 'all') return mergedAchievements();
		return mergedAchievements().filter((a) => a.category === cat);
	});

	const unlockedCount = createMemo(() => mergedAchievements().filter((a) => a.unlocked).length);

	const handleCardClick = (ach: any) => {
		try {
			haptic.impact('light');
		} catch {}
		setSelectedAch(ach);
	};

	const handleShareToStory = () => {
		const ach = selectedAch();
		if (!ach) return;
		try {
			haptic.impact('medium');
		} catch {}
		const storyText = `Unlocked "${ach.title}" on iFragment`;
		const promoBannerUrl = new URL('promo_banner.png', document.baseURI).href;
		shareToStory(promoBannerUrl, {
			text: storyText,
			widget_link: {
				url: `https://t.me/iFragmentBot/iFragment?startapp=ach_${ach.id}`,
				name: 'iFragment',
			},
		});
	};

	const handleShareToChat = () => {
		const ach = selectedAch();
		if (!ach) return;
		try {
			haptic.impact('medium');
		} catch {}
		const query = `${ach.icon} ${ach.title} - ${ach.desc}`;
		switchInlineQuery(query, ['users', 'groups']);
	};

	return (
		<div
			class="frag-canvas min-h-screen pb-28 text-white font-frag-sans relative overflow-x-hidden"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Authentic Fragment.com Sticky Top Header (.tm-header) */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => window.history.back()}
					class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
				>
					<TonIcon size={20} color="#4db2ff" />
					<span class="text-[15px] font-bold tracking-[0.04em]" dir="ltr">
						FRAGMENT
					</span>
				</button>

				<span class="px-2.5 py-1 rounded-[4px] bg-[#5aec8c]/10 text-[#5aec8c] text-[12px] font-mono font-semibold tabular-nums">
					{unlockedCount()} / {mergedAchievements().length}
				</span>
			</header>

			<div class="max-w-[480px] mx-auto px-4 pt-5 w-full relative z-10 flex flex-col gap-4">
				<div>
					<h1 class="text-[20px] sm:text-[22px] font-bold text-white tracking-[-0.015em]">
						{t('achievements.title')}
					</h1>
					<p class="text-[12.5px] text-[#8794a1] mt-0.5">{t('achievements.subtitle')}</p>
				</div>

				{/* Category Filter Pills */}
				<div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
					<For each={categories}>
						{(cat) => (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									setActiveCategory(cat.id);
								}}
								class={`px-3 py-1.5 rounded-[6px] font-semibold text-[12px] shrink-0 transition-colors cursor-pointer ${
									activeCategory() === cat.id
										? 'bg-[#248bda] text-white'
										: 'bg-[#212a33] hover:bg-[#293440] text-[#8c9aa9] hover:text-white'
								}`}
							>
								{cat.label()}
							</button>
						)}
					</For>
				</div>

				{/* Clean Fragment Table List of Achievements (.frag-table-container) */}
				<div class="frag-table-container">
					<div class="frag-table-header px-3.5 py-2 flex items-center justify-between">
						<span>{t('achievements.title')}</span>
						<span>{t('achievements.progress')}</span>
					</div>

					<For each={filteredAchievements()}>
						{(ach) => (
							<button
								type="button"
								onClick={() => handleCardClick(ach)}
								class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
							>
								<div class="flex items-center gap-3 min-w-0">
									<div
										class={`w-10 h-10 rounded-[8px] bg-[#242e38] flex items-center justify-center text-[20px] shrink-0 ${
											ach.unlocked ? '' : 'grayscale opacity-50'
										}`}
									>
										<span>{ach.icon}</span>
									</div>
									<div class="flex flex-col min-w-0">
										<span
											class={`text-[13.5px] font-semibold truncate ${
												ach.unlocked ? 'text-white' : 'text-[#8c9aa9]'
											}`}
										>
											{ach.title}
										</span>
										<span class="text-[11.5px] text-[#8794a1] truncate mt-0.5">{ach.desc}</span>
									</div>
								</div>

								<div class="shrink-0">
									<Show
										when={ach.unlocked}
										fallback={
											<span class="px-2 py-0.5 rounded-[4px] bg-[#242e38] text-[#8c9aa9] text-[11px] font-mono font-semibold tabular-nums">
												{formatNumber(ach.progress)}/{formatNumber(ach.target)}
											</span>
										}
									>
										<span class="px-2 py-0.5 rounded-[4px] bg-[#5aec8c]/10 text-[#5aec8c] text-[11px] font-semibold">
											{t('achievements.unlocked')}
										</span>
									</Show>
								</div>
							</button>
						)}
					</For>
				</div>
			</div>

			{/* Clean Detail Sheet */}
			<Show when={selectedAch()}>
				{(ach) => (
					<div
						class="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm"
						onClick={(e) => {
							if (e.target === e.currentTarget) setSelectedAch(null);
						}}
					>
						<div class="w-full max-w-[480px] frag-sheet rounded-t-[16px] p-5 pb-8 flex flex-col items-center text-center relative">
							<div class="w-9 h-1 bg-white/15 rounded-full mx-auto mb-4" />
							<button
								type="button"
								onClick={() => setSelectedAch(null)}
								class="absolute top-4 right-4 w-8 h-8 rounded-[6px] bg-[#242e38] flex items-center justify-center text-[#8c9aa9] hover:text-white cursor-pointer"
							>
								<span class="material-symbols-outlined text-[18px]">close</span>
							</button>

							<div class="w-16 h-16 rounded-[12px] bg-[#242e38] flex items-center justify-center text-[36px] mb-3">
								<span>{ach().icon}</span>
							</div>

							<h2 class="text-[18px] font-bold text-white mb-1">{ach().title}</h2>
							<p class="text-[#8794a1] text-[13px] max-w-xs mb-4">{ach().desc}</p>

							<div class="w-full p-3 bg-[#242e38] rounded-[8px] mb-4">
								<Show
									when={ach().unlocked}
									fallback={
										<div class="flex items-center justify-between text-[12.5px]">
											<span class="text-[#8c9aa9]">{t('achievements.progress')}</span>
											<span class="font-mono font-semibold text-[#4db2ff]">
												{formatNumber(ach().progress)} / {formatNumber(ach().target)}
											</span>
										</div>
									}
								>
									<div class="flex items-center justify-between text-[12.5px]">
										<span class="text-[#8c9aa9]">{t('achievements.unlockedAtLabel')}</span>
										<span class="font-mono font-semibold text-[#5aec8c]">
											{ach().unlockedAt
												? new Date(ach().unlockedAt!).toLocaleDateString(
														locale() === 'fa' ? 'fa-IR-u-nu-latn' : 'en-US',
														{ dateStyle: 'medium' },
													)
												: t('achievements.unlocked')}
										</span>
									</div>
								</Show>
							</div>

							<Show when={ach().unlocked}>
								<div class="grid grid-cols-2 gap-2 w-full">
									<button
										type="button"
										onClick={handleShareToStory}
										class="frag-btn-primary h-10 rounded-[8px] font-semibold text-[13px] flex items-center justify-center gap-1.5 cursor-pointer"
									>
										<span>{t('achievements.shareStory')}</span>
									</button>
									<button
										type="button"
										onClick={handleShareToChat}
										class="frag-btn-secondary h-10 rounded-[8px] font-semibold text-[13px] flex items-center justify-center gap-1.5 cursor-pointer"
									>
										<span>{t('achievements.shareChat')}</span>
									</button>
								</div>
							</Show>
						</div>
					</div>
				)}
			</Show>
		</div>
	);
};
