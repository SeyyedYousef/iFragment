import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { groupApi } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { showToast } from '@/shared/ui/toast.js';
import { AntiSpamLessonCard } from './group-lessons/AntiSpamLessonCard.js';
import { CustomTextsLessonCard } from './group-lessons/CustomTextsLessonCard.js';
import { EphemeralLessonCard } from './group-lessons/EphemeralLessonCard.js';
import { GroupDynamicBioLessonCard } from './group-lessons/GroupDynamicBioLessonCard.js';
import { LimitsLessonCard } from './group-lessons/LimitsLessonCard.js';
import { MandatoryLessonCard } from './group-lessons/MandatoryLessonCard.js';
import { QuietHoursLessonCard } from './group-lessons/QuietHoursLessonCard.js';

export const GroupDashboardPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [showTooltip, setShowTooltip] = createSignal(true);
	const [isLocking, setIsLocking] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);
	const [showLockConfirm, setShowLockConfirm] = createSignal(false);
	const [searchQuery, setSearchQuery] = createSignal('');

	const groupFeatures = () => [
		{ name: t('search.features.groupSettings'), icon: 'settings', path: `/group/${params.id}/settings` },
		{ name: t('search.features.contentRestrictions'), icon: 'block', path: `/group/${params.id}/content` },
		{ name: t('search.features.limits'), icon: 'speed', path: `/group/${params.id}/limits` },
		{ name: t('search.features.quietHours'), icon: 'bedtime', path: `/group/${params.id}/quiet` },
		{ name: t('search.features.mandatoryChannels'), icon: 'how_to_reg', path: `/group/${params.id}/mandatory` },
		{ name: t('search.features.customTexts'), icon: 'edit_note', path: `/group/${params.id}/settings/custom-texts` },
		{ name: t('search.features.groupAnalytics'), icon: 'analytics', path: `/group/${params.id}/analytics` },
		{ name: t('search.features.groupDynamicBio'), icon: 'badge', path: `/group/${params.id}/dynamic-bio` },
	];

	const filteredFeatures = () => {
		const q = searchQuery().trim().toLowerCase();
		if (!q) return [];
		return groupFeatures().filter((f) => f.name.toLowerCase().includes(q));
	};

	const [group] = createResource(() => params.id, (id) => groupApi.getGroup(id));
	const [settings, { mutate }] = createResource(() => params.id, async (id) => {
		const s = await groupApi.getSettings(id);
		setSettingsVersion(s.version);
		return s;
	});

	const isGroupLocked = () => (settings()?.quiet_hours as any)?.emergencyLock || false;

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			try { hapticFeedback.impactOccurred('light'); } catch (_) {}
			window.history.back();
		});
		const timer = setTimeout(() => setShowTooltip(false), 10000);
		onCleanup(() => {
			off();
			clearTimeout(timer);
			backButton.hide();
		});
	});

	const confirmToggleGroupLock = async () => {
		if (isLocking() || !settings()) return;
		const current = isGroupLocked();
		try { hapticFeedback.impactOccurred('medium'); } catch (_) {}
		setIsLocking(true);
		setShowLockConfirm(false);
		try {
			const qh = { ...((settings()?.quiet_hours as any) || {}), emergencyLock: !current };
			const res = await groupApi.updateSettings(params.id, 'quiet_hours', qh, settingsVersion());
			if (res?.version) setSettingsVersion(res.version);
			mutate((prev: any) => (prev ? { ...prev, quiet_hours: qh } : { quiet_hours: qh }));
			try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
			showToast(current ? t('groupDashboard.unlockSuccess') : t('groupDashboard.lockSuccess'), 'success');
		} catch (_e) {
			try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
			showToast(t('groupDashboard.lockError'), 'error');
		} finally {
			setIsLocking(false);
		}
	};

	const handleMenuOpen = () => {
		setIsMenuOpen(true);
		setShowTooltip(false);
		try { hapticFeedback.impactOccurred('light'); } catch (_) {}
	};

	const learnedFeatures = () => {
		const s = settings();
		if (!s) return [];
		const g = (s.general || {}) as any;
		return [
			{ key: 'ephemeral', done: !!(g.ephemeralAll || g.ephemeralWelcome || g.ephemeralWarnings || g.ephemeralCaptcha || g.ephemeralAdminCmd) },
			{ key: 'antiSpam', done: !!((s as any)?.content_restrictions?.link_filter || (s as any)?.cas_enabled) },
			{ key: 'quietHours', done: !!(s.quiet_hours as any)?.enabled },
			{ key: 'limits', done: !!(s as any)?.limits?.slow_mode },
			{ key: 'mandatory', done: !!(s as any)?.mandatory_channels?.length },
			{ key: 'customTexts', done: !!(s as any)?.custom_texts?.welcome },
			{ key: 'dynamicBio', done: !!(s as any)?.dynamic_bio?.enabled },
		];
	};

	const progress = () => {
		const list = learnedFeatures();
		if (!list.length) return 0;
		const completed = list.filter((item) => item.done).length;
		return Math.round((completed / list.length) * 100);
	};

	const isFeatureDone = (key: string) => {
		return learnedFeatures().find((item) => item.key === key)?.done || false;
	};

	const navigateWithFeedback = (path: string) => {
		try { hapticFeedback.impactOccurred('light'); } catch (_) {}
		navigate(path);
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white select-none font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#3390ec]/15 via-[#3390ec]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3 overflow-hidden flex-1">
					<button
						onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} window.history.back(); }}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/30 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
						<Show
							when={group()?.photo_url}
							fallback={
								<span class="text-[16px] font-black text-[#3390ec] drop-shadow-md">
									{group()?.chat_title?.charAt(0) || 'G'}
								</span>
							}
						>
							<img
								src={group()?.photo_url}
								alt={group()?.chat_title || 'Group photo'}
								class="w-full h-full object-cover"
								onError={(e) => {
									(e.currentTarget as HTMLElement).style.display = 'none';
								}}
							/>
						</Show>
					</div>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[16px] font-black text-white leading-tight truncate tracking-tight">
							{group.loading ? '...' : group()?.chat_title || t('groupDashboard.title')}
						</h1>
						<div class="flex items-center gap-1.5 text-[10px] text-white/50 font-bold mt-0.5 tracking-wider uppercase">
							<span>{group()?.chat_type || t('groupDashboard.groupType')}</span>
							<span class="w-1 h-1 rounded-full bg-white/20" />
							<span class={group()?.subscription_status === 'paid' ? 'text-[#10b981]' : 'text-amber-400'}>
								{group()?.subscription_status === 'paid' ? t('groupDashboard.proBadge') : t('groupDashboard.freeBadge')}
							</span>
							<span class="w-1 h-1 rounded-full bg-white/20" />
							<span class="font-mono">{t('groupDashboard.membersCount', { count: group()?.members_count || 0 })}</span>
						</div>
					</div>
				</div>

				<div class="relative flex items-center gap-2">
					<Show when={showTooltip()}>
						<Motion.div
							initial={{ opacity: 0, scale: 0.9, y: 10 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9 }}
							class={`absolute top-[125%] w-[190px] bg-[#3390ec] text-white text-[12px] font-bold p-3.5 rounded-[16px] shadow-[0_10px_30px_rgba(51,144,236,0.3)] z-50 flex flex-col gap-2 ${isRtl() ? 'left-0 origin-top-left' : 'right-0 origin-top-right'}`}
						>
							<div class={`absolute -top-2 w-4 h-4 bg-[#3390ec] rotate-45 rounded-sm ${isRtl() ? 'left-4' : 'right-4'}`} />
							<div class="relative z-10 flex items-start justify-between gap-2">
								<span class="leading-relaxed">{t('groupDashboard.tooltip')}</span>
								<button onClick={(e) => { e.stopPropagation(); setShowTooltip(false); }} class="mt-0.5 opacity-80 hover:opacity-100 shrink-0 active:scale-95 transition-transform bg-white/10 rounded-full w-5 h-5 flex items-center justify-center">
									<span class="material-symbols-outlined text-[14px]">close</span>
								</button>
							</div>
						</Motion.div>
					</Show>

					<button
						onClick={handleMenuOpen}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all relative shadow-sm text-white/80"
						aria-label={t('groupDashboard.menu')}
					>
						<Show when={showTooltip()}>
							<span class={`absolute -top-1 -right-1 flex h-3.5 w-3.5`}>
								<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff4a4a] opacity-75" />
								<span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#ff4a4a] border-2 border-[#030303]" />
							</span>
						</Show>
						<span class="material-symbols-outlined text-[22px]">menu</span>
					</button>
				</div>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-5 max-w-md mx-auto relative z-10">
				
				{/* ═══════ QUICK SPOTLIGHT SEARCH ═══════ */}
				<div class="relative w-full z-30">
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/10 rounded-[18px] px-4 h-14 flex items-center gap-3 focus-within:border-[#3390ec]/50 focus-within:bg-[#08090D] transition-all shadow-inner">
						<span class="material-symbols-outlined text-white/40 text-[22px]">search</span>
						<input
							type="text"
							placeholder={t('search.groupPlaceholder')}
							value={searchQuery()}
							onInput={(e) => setSearchQuery(e.currentTarget.value)}
							class="w-full bg-transparent text-[13px] font-bold text-white placeholder-white/30 outline-none"
						/>
						<Show when={searchQuery()}>
							<button onClick={() => setSearchQuery('')} class="text-white/40 hover:text-white p-1 transition-colors">
								<span class="material-symbols-outlined text-[18px]">close</span>
							</button>
						</Show>
					</div>

					<Show when={searchQuery().trim() !== ''}>
						<Motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} class="absolute top-16 left-0 right-0 bg-[#12141C]/95 backdrop-blur-2xl border border-white/10 rounded-[20px] p-2 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-1 max-h-[300px] overflow-y-auto">
							<For each={filteredFeatures()} fallback={<div class="p-4 text-[12px] text-white/40 text-center font-bold">{t('search.notFoundGroup')}</div>}>
								{(feat) => (
									<button
										onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setSearchQuery(''); navigate(feat.path); }}
										class="w-full p-3 rounded-[14px] bg-transparent hover:bg-white/10 flex items-center gap-3.5 text-right transition-all active:scale-95"
									>
										<div class="w-9 h-9 rounded-[10px] bg-[#3390ec]/10 flex items-center justify-center border border-[#3390ec]/20 shrink-0">
											<span class="material-symbols-outlined text-[#3390ec] text-[20px]">{feat.icon}</span>
										</div>
										<span class="text-[13px] font-bold text-white">{feat.name}</span>
									</button>
								)}
							</For>
						</Motion.div>
					</Show>
				</div>

				{/* ═══════ HERO: ACADEMY PROGRESS & EMERGENCY LOCK ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
					<div class="absolute -right-8 -top-8 w-28 h-28 bg-[#3390ec]/10 blur-2xl rounded-full pointer-events-none" />
					
					<div class="flex items-center gap-4">
						<div class="relative w-16 h-16 shrink-0 flex items-center justify-center">
							<svg viewBox="0 0 64 64" class="w-full h-full -rotate-90">
								<circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6" />
								<circle
									cx="32" cy="32" r="26" fill="none" stroke="#3390ec" stroke-width="6" stroke-linecap="round"
									stroke-dasharray={`${(progress() / 100) * 163} 163`}
									class="transition-all duration-1000 ease-out"
								/>
							</svg>
							<span class="absolute inset-0 flex items-center justify-center text-[13px] font-black font-mono text-white">
								{progress()}%
							</span>
						</div>

						<div class="flex flex-col">
							<h2 class="text-[15px] font-black text-white tracking-tight">{t('groupLessons.heroTitle')}</h2>
							<p class="text-[11px] text-white/50 font-bold mt-1 leading-relaxed">{t('groupLessons.heroDesc')}</p>
						</div>
					</div>

					{/* Emergency Lock Button */}
					<button
						onClick={() => setShowLockConfirm(true)}
						disabled={isLocking() || settings.loading}
						class={`w-full h-13 rounded-[16px] font-black text-[12px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm border ${
							isGroupLocked()
								? 'bg-[#ff4a4a]/15 border-[#ff4a4a]/40 text-[#ff4a4a] hover:bg-[#ff4a4a]/25 shadow-[0_0_15px_rgba(255,74,74,0.2)]'
								: 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10'
						}`}
					>
						<span class="material-symbols-outlined text-[18px]">{isGroupLocked() ? 'lock' : 'lock_open_right'}</span>
						<span>{isGroupLocked() ? t('groupDashboard.emergencyLockActive') : t('groupDashboard.quickLockGroup')}</span>
					</button>
				</div>

				{/* ═══════ 0 TO 100 INTERACTIVE GROUP LESSON CARDS ═══════ */}
				<div class="flex flex-col gap-4">
					<EphemeralLessonCard
						isDone={isFeatureDone('ephemeral')}
						onNavigate={() => navigateWithFeedback(`/group/${params.id}/settings`)}
					/>

					<AntiSpamLessonCard
						isDone={isFeatureDone('antiSpam')}
						onNavigate={() => navigateWithFeedback(`/group/${params.id}/content`)}
					/>

					<QuietHoursLessonCard
						isDone={isFeatureDone('quietHours')}
						onNavigate={() => navigateWithFeedback(`/group/${params.id}/quiet`)}
					/>

					<LimitsLessonCard
						isDone={isFeatureDone('limits')}
						onNavigate={() => navigateWithFeedback(`/group/${params.id}/limits`)}
					/>

					<MandatoryLessonCard
						isDone={isFeatureDone('mandatory')}
						onNavigate={() => navigateWithFeedback(`/group/${params.id}/mandatory`)}
					/>

					<CustomTextsLessonCard
						isDone={isFeatureDone('customTexts')}
						onNavigate={() => navigateWithFeedback(`/group/${params.id}/settings/custom-texts`)}
					/>

					<GroupDynamicBioLessonCard
						isDone={isFeatureDone('dynamicBio')}
						onNavigate={() => navigateWithFeedback(`/group/${params.id}/dynamic-bio`)}
					/>
				</div>

			</div>

			{/* ═══════ EMERGENCY LOCK MODAL ═══════ */}
			<Show when={showLockConfirm()}>
				<div class="fixed inset-0 z-[9990] bg-[#030303]/90 backdrop-blur-2xl flex items-center justify-center p-5" onClick={(e) => { if (e.target === e.currentTarget) setShowLockConfirm(false); }}>
					<Motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }} class="w-full max-w-sm max-h-[85vh] overflow-y-auto no-scrollbar bg-[#12141C] border border-white/10 rounded-[32px] p-7 flex flex-col gap-5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative">
						<div class="absolute -top-10 -left-10 w-32 h-32 bg-[#ff4a4a]/20 blur-3xl rounded-full pointer-events-none" />
						
						<div class="w-16 h-16 rounded-[20px] bg-[#ff4a4a]/10 border border-[#ff4a4a]/30 flex items-center justify-center shadow-inner relative z-10 mx-auto mb-2">
							<span class="material-symbols-outlined text-[#ff4a4a] text-[32px] drop-shadow-md">lock</span>
						</div>

						<div class="flex flex-col items-center text-center gap-1.5 relative z-10">
							<h3 class="text-[18px] font-black text-white tracking-tight">{t('groupDashboard.toggleLockModalTitle')}</h3>
							<p class="text-[12px] text-white/50 leading-relaxed font-medium px-2">
								{t('groupDashboard.toggleLockModalDesc')}
							</p>
						</div>

						<div class="flex flex-col gap-3 pt-2 relative z-10 w-full">
							<button onClick={confirmToggleGroupLock} disabled={isLocking()} class="w-full h-14 bg-[#ff4a4a] hover:bg-[#ff3b30] rounded-[16px] text-[13px] font-black uppercase tracking-widest text-white shadow-[0_8px_24px_rgba(255,74,74,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/10">
								<Show when={!isLocking()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
									<span class="material-symbols-outlined text-[20px]">{isGroupLocked() ? 'lock_open' : 'lock'}</span>
									{isGroupLocked() ? t('groupDashboard.unlockGroupBtn') : t('groupDashboard.confirmLockGroupBtn')}
								</Show>
							</button>
							<button onClick={() => setShowLockConfirm(false)} class="w-full h-14 bg-transparent hover:bg-white/5 rounded-[16px] text-[13px] font-bold uppercase tracking-widest text-white/60 hover:text-white transition-all active:scale-95 border border-transparent hover:border-white/5">
								{t('common.cancel')}
							</button>
						</div>
					</Motion.div>
				</div>
			</Show>

			<HamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} groupId={params.id} activeTab="dashboard" />
		</div>
	);
};
