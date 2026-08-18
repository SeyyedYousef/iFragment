import { Motion } from '@motionone/solid';
import { createQuery } from '@tanstack/solid-query';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
	ACHIEVEMENT_DEFS,
	getAchievementDefs,
	getProfileAchievements,
} from '@/entities/user/index.js';
import { formatNumber, locale, t } from '@/shared/i18n/index.js';
import { haptic, shareToStory, switchInlineQuery } from '@/shared/lib/telegram-native.js';

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
		backButton.show();
		const off = backButton.onClick(() => window.history.back());
		onCleanup(() => {
			off();
			try {
				backButton.hide();
			} catch {}
		});
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

	const unlockedCount = createMemo(() => {
		return mergedAchievements().filter((a) => a.unlocked).length;
	});

	const handleCardClick = (ach: any) => {
		haptic.impact('light');
		setSelectedAch(ach);
	};

	const handleShareToStory = () => {
		const ach = selectedAch();
		if (!ach) return;
		haptic.impact('medium');
		const storyText = `I unlocked the "${ach.title}" achievement on iFragment! 🏆`;
		shareToStory(`${window.location.origin}/promo_banner.png`, {
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
		haptic.impact('medium');
		const query = `Check out my unlocked achievement: ${ach.icon} ${ach.title} - ${ach.desc}`;
		switchInlineQuery(query, ['users', 'groups']);
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-24 text-white font-sans selection:bg-amber-400/30 relative overflow-x-hidden"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[450px] bg-gradient-to-b from-amber-400/15 via-[#3390ec]/5 to-transparent blur-[90px] pointer-events-none z-0" />

			<div class="max-w-md mx-auto w-full relative z-10 flex flex-col">
				{/* ═══════ HERO HEADER ═══════ */}
				<div class="px-5 pt-8 pb-4 flex flex-col gap-5">
					<div class="flex flex-col gap-0.5">
						<h1 class="text-[26px] font-black text-white tracking-tight drop-shadow-sm">
							{t('achievements.title')}
						</h1>
						<p class="text-[13px] text-white/50 font-bold uppercase tracking-widest">
							{t('achievements.subtitle')}
						</p>
					</div>

					{/* Progress Summary Card */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex items-center justify-between shadow-sm relative overflow-hidden"
					>
						<div class="absolute -right-6 -bottom-6 w-28 h-28 bg-amber-400/10 blur-2xl rounded-full pointer-events-none" />

						<div class="flex items-center gap-4 relative z-10">
							<div class="w-14 h-14 rounded-[16px] bg-gradient-to-br from-amber-400/20 to-orange-500/5 flex items-center justify-center text-[28px] border border-amber-400/20 shadow-inner shrink-0">
								<span class="drop-shadow-md">🏆</span>
							</div>
							<div class="flex flex-col gap-0.5">
								<span class="text-[10px] text-white/40 font-black uppercase tracking-widest">
									{t('achievements.title')}
								</span>
								<span class="text-[18px] font-black text-white tracking-tight">
									<span class="text-amber-400">{unlockedCount()}</span> /{' '}
									<span class="text-white/70">{mergedAchievements().length}</span>
								</span>
								<span class="text-[11px] font-bold text-white/50">
									{t('achievements.completed')}
								</span>
							</div>
						</div>

						<div class="relative w-16 h-16 flex items-center justify-center shrink-0 z-10">
							<svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
								<path
									class="text-white/5"
									stroke-dasharray="100"
									stroke-width="3"
									stroke="currentColor"
									fill="none"
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
								/>
								<path
									class="text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)] transition-all duration-1000 ease-out"
									stroke-dasharray={`${mergedAchievements().length ? (unlockedCount() / mergedAchievements().length) * 100 : 0}, 100`}
									stroke-width="3"
									stroke-linecap="round"
									stroke="currentColor"
									fill="none"
									d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
								/>
							</svg>
							<span class="absolute text-[12px] font-black text-amber-400 font-mono">
								{mergedAchievements().length
									? Math.round((unlockedCount() / mergedAchievements().length) * 100)
									: 0}
								%
							</span>
						</div>
					</Motion.div>
				</div>

				{/* ═══════ CATEGORY PILLS ═══════ */}
				<div class="flex gap-2.5 overflow-x-auto px-5 py-2 no-scrollbar scroll-smooth">
					<For each={categories}>
						{(cat) => (
							<button
								onClick={() => {
									haptic.selection();
									setActiveCategory(cat.id);
								}}
								class={`px-4 py-2.5 rounded-[14px] font-black text-[11px] uppercase tracking-widest shrink-0 transition-all active:scale-95 ${
									activeCategory() === cat.id
										? 'bg-[#3390ec] text-white shadow-[0_4px_15px_rgba(51,144,236,0.3)] border border-transparent'
										: 'bg-[#12141C]/80 backdrop-blur-md border border-white/5 text-white/50 hover:bg-white/5 hover:text-white/80'
								}`}
							>
								{cat.label()}
							</button>
						)}
					</For>
				</div>

				{/* ═══════ ACHIEVEMENTS GRID ═══════ */}
				<div class="px-5 pt-3 pb-6 grid grid-cols-2 gap-3.5">
					<For each={filteredAchievements()}>
						{(ach, i) => (
							<Motion.button
								onClick={() => handleCardClick(ach)}
								initial={{ opacity: 0, y: 15 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: i() * 0.05 }}
								class={`rounded-[24px] p-4 flex flex-col items-center text-center gap-2.5 relative transition-all active:scale-[0.98] group overflow-hidden ${
									ach.unlocked
										? 'bg-gradient-to-br from-[#1a1500]/90 to-[#12141C]/90 backdrop-blur-xl border border-amber-400/30 shadow-[0_4px_20px_rgba(251,191,36,0.08)] hover:border-amber-400/50'
										: 'bg-[#08090D] border border-white/5 opacity-80 hover:opacity-100 hover:border-white/10 shadow-inner'
								}`}
							>
								{/* Badge Icon */}
								<div
									class={`w-14 h-14 rounded-[16px] flex items-center justify-center text-[28px] relative shadow-inner mt-1 transition-transform duration-300 group-hover:scale-105 ${
										ach.unlocked
											? 'bg-gradient-to-br from-amber-400/20 to-orange-500/10 border border-amber-400/20'
											: 'bg-white/5 border border-white/5'
									}`}
								>
									<span
										class={
											ach.unlocked
												? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
												: 'grayscale opacity-50'
										}
									>
										{ach.icon}
									</span>
									<Show when={!ach.unlocked}>
										<div class="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-[8px] bg-[#12141C] flex items-center justify-center border border-white/10 shadow-sm">
											<span class="material-symbols-outlined text-[12px] text-white/40">
												lock
											</span>
										</div>
									</Show>
								</div>

								<div class="flex flex-col gap-1 w-full flex-1">
									<span
										class={`text-[13px] font-black leading-tight line-clamp-1 mt-1 ${ach.unlocked ? 'text-amber-400' : 'text-white'}`}
									>
										{ach.title}
									</span>
									<span class="text-[10px] font-medium text-white/40 leading-relaxed line-clamp-2">
										{ach.desc}
									</span>
								</div>

								{/* Progress or Status */}
								<div class="w-full mt-2 pt-2 border-t border-white/5 flex flex-col justify-center min-h-[24px]">
									<Show
										when={ach.unlocked}
										fallback={
											<Show
												when={ach.target > 1}
												fallback={
													<span class="text-[9px] font-black text-white/30 uppercase tracking-widest">
														{t('achievements.locked')}
													</span>
												}
											>
												<div class="w-full flex items-center gap-2">
													<div class="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
														<div
															class="h-full bg-[#3390ec] rounded-full shadow-[0_0_5px_#3390ec]"
															style={{
																width: `${Math.max(5, Math.min(100, (ach.progress / ach.target) * 100))}%`,
															}}
														/>
													</div>
													<span class="text-[9px] text-[#3390ec] font-black font-mono tracking-tighter shrink-0">
														{formatNumber(ach.progress)}/{formatNumber(ach.target)}
													</span>
												</div>
											</Show>
										}
									>
										<span class="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center justify-center gap-1">
											<span class="material-symbols-outlined text-[14px]">verified</span>
											{t('achievements.unlocked')}
										</span>
									</Show>
								</div>
							</Motion.button>
						)}
					</For>
				</div>
			</div>

			{/* ═══════ 3D DETAIL BOTTOM SHEET ═══════ */}
			<Show when={selectedAch()}>
				{(ach) => (
					<div
						class="fixed inset-0 z-[100] flex items-end justify-center bg-[#030303]/90 backdrop-blur-2xl px-2 pb-2"
						onClick={(e) => {
							if (e.target === e.currentTarget) setSelectedAch(null);
						}}
					>
						<Motion.div
							initial={{ y: '100%' }}
							animate={{ y: 0 }}
							transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }}
							class="w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar bg-[#12141C] border border-white/10 rounded-[32px] p-6 pb-8 flex flex-col items-center text-center relative shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
						>
							<Show when={ach().unlocked}>
								<div class="absolute -top-20 -left-20 w-56 h-56 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
								<div class="absolute -bottom-20 -right-20 w-56 h-56 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
							</Show>

							{/* Handle & Close */}
							<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-4 relative z-10" />
							<button
								onClick={() => setSelectedAch(null)}
								class="absolute top-5 right-5 w-9 h-9 rounded-[12px] bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition-all active:scale-95 z-20"
							>
								<span class="material-symbols-outlined text-[20px]">close</span>
							</button>

							{/* Large Icon */}
							<div
								class={`w-28 h-28 rounded-[32px] flex items-center justify-center text-[64px] mb-5 mt-2 relative z-10 shadow-inner ${
									ach().unlocked
										? 'bg-gradient-to-br from-amber-400/20 to-orange-500/10 border-2 border-amber-400/40 shadow-[0_10px_30px_rgba(251,191,36,0.2)]'
										: 'bg-[#08090D] border border-white/5 grayscale opacity-60'
								}`}
							>
								<span class={ach().unlocked ? 'drop-shadow-[0_10px_20px_rgba(251,191,36,0.6)]' : ''}>
									{ach().icon}
								</span>
							</div>

							<span class="px-3 py-1.5 rounded-[8px] bg-white/5 border border-white/10 text-[10px] font-black text-[#3390ec] uppercase tracking-widest mb-3 relative z-10 shadow-sm">
								{ach().category
									? t(`achievements.categories.${ach().category}` as any) || ach().category
									: ''}
							</span>

							<h2
								class={`text-[24px] font-black tracking-tight mb-2 relative z-10 ${ach().unlocked ? 'text-amber-400' : 'text-white'}`}
							>
								{ach().title}
							</h2>
							<p class="text-white/60 text-[13px] font-medium leading-relaxed max-w-[280px] relative z-10 mb-6">
								{ach().desc}
							</p>

							{/* Progress / Status Block */}
							<div class="w-full p-4 bg-[#08090D] border border-white/5 rounded-[20px] mb-6 relative z-10 shadow-inner">
								<Show
									when={ach().unlocked}
									fallback={
										<div class="flex flex-col items-center gap-2">
											<div class="flex justify-between w-full px-1">
												<span class="text-[11px] text-white/40 font-black uppercase tracking-widest">
													{t('achievements.progress')}
												</span>
												<span class="text-[13px] font-black text-[#3390ec] font-mono tracking-tight">
													{formatNumber(ach().progress)} / {formatNumber(ach().target)}
												</span>
											</div>
											<div class="w-full h-2.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
												<div
													class="h-full bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] rounded-full shadow-[0_0_10px_#3390ec]"
													style={{
														width: `${Math.max(5, Math.min(100, (ach().progress / ach().target) * 100))}%`,
													}}
												/>
											</div>
										</div>
									}
								>
									<div class="flex flex-col items-center gap-1.5">
										<span class="text-[10px] text-white/40 font-black uppercase tracking-widest flex items-center gap-1">
											<span class="material-symbols-outlined text-[14px] text-amber-400">
												workspace_premium
											</span>
											{t('achievements.unlockedAtLabel')}
										</span>
										<span class="text-[16px] font-black text-white font-mono tracking-tight mt-0.5">
											{ach().unlockedAt
												? new Date(ach().unlockedAt!).toLocaleDateString(
														locale() === 'fa' ? 'fa-IR' : 'en-US',
														{ dateStyle: 'medium' },
													)
												: '---'}
										</span>
									</div>
								</Show>
							</div>

							{/* Actions */}
							<Show when={ach().unlocked}>
								<div class="flex flex-col gap-3 w-full relative z-10">
									<button
										onClick={handleShareToStory}
										class="w-full h-14 rounded-[16px] bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black uppercase tracking-widest text-[13px] flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(251,191,36,0.3)] active:scale-95 transition-all"
									>
										<span
											class="material-symbols-outlined text-[22px]"
											style={{ 'font-variation-settings': '"FILL" 1' }}
										>
											auto_stories
										</span>
										{t('achievements.shareStory')}
									</button>
									<button
										onClick={handleShareToChat}
										class="w-full h-14 bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white font-black uppercase tracking-widest text-[13px] flex items-center justify-center gap-2 rounded-[16px] active:scale-95 transition-all shadow-sm"
									>
										<span class="material-symbols-outlined text-[20px]">share</span>
										{t('achievements.shareChat')}
									</button>
								</div>
							</Show>
						</Motion.div>
					</div>
				)}
			</Show>
		</div>
	);
};
