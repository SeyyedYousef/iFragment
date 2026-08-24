import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { groupApi } from '@/entities/group/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { showToast } from '@/shared/ui/toast.js';
import { calculateAcademyProgress } from './academyProgress.js';
import { AntiSpamLessonCard } from './group-lessons/AntiSpamLessonCard.js';
import { CustomTextsLessonCard } from './group-lessons/CustomTextsLessonCard.js';
import { EphemeralLessonCard } from './group-lessons/EphemeralLessonCard.js';
import { GroupDynamicBioLessonCard } from './group-lessons/GroupDynamicBioLessonCard.js';
import { LimitsLessonCard } from './group-lessons/LimitsLessonCard.js';
import { MandatoryLessonCard } from './group-lessons/MandatoryLessonCard.js';
import { QuietHoursLessonCard } from './group-lessons/QuietHoursLessonCard.js';
import { haptic } from '@/shared/lib/haptic.js';

export const GroupDashboardPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [showTooltip, setShowTooltip] = createSignal(true);
	const [isLocking, setIsLocking] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);
	const [showLockConfirm, setShowLockConfirm] = createSignal(false);
	const [searchQuery, setSearchQuery] = createSignal('');
	const [undoLockTimer, setUndoLockTimer] = createSignal<number | null>(null);
	const [showUndoSnackbar, setShowUndoSnackbar] = createSignal(false);

	const groupFeatures = () => [
		{ name: t('search.features.groupSettings'), icon: 'settings', path: `/group/${params.id}/settings` },
		{ name: t('search.features.contentRestrictions'), icon: 'block', path: `/group/${params.id}/content` },
		{ name: t('search.features.limits'), icon: 'speed', path: `/group/${params.id}/limits` },
		{ name: t('search.features.quietHours'), icon: 'bedtime', path: `/group/${params.id}/quiet` },
		{ name: t('search.features.mandatoryChannels'), icon: 'how_to_reg', path: `/group/${params.id}/mandatory` },
		{ name: t('search.features.customTexts'), icon: 'edit_note', path: `/group/${params.id}/settings/custom-texts` },
		{ name: 'مدیریت اعضا و اخطارها', icon: 'group', path: `/group/${params.id}/members` },
		{ name: t('search.features.groupAnalytics'), icon: 'analytics', path: `/group/${params.id}/analytics` },
		{ name: t('search.features.groupDynamicBio'), icon: 'badge', path: `/group/${params.id}/dynamic-bio` },
	];

	const filteredFeatures = () => {
		const q = searchQuery().trim().toLowerCase();
		if (!q) return [];
		return groupFeatures().filter((f) => f.name.toLowerCase().includes(q));
	};

	const [group] = createResource(() => params.id, (id) => groupApi.getGroup(id));
	const [tgInfo] = createResource(() => params.id, (id) => groupApi.getGroupTelegramInfo(id));
	const [settings, { mutate }] = createResource(() => params.id, async (id) => {
		const s = await groupApi.getSettings(id);
		setSettingsVersion(s.version);
		return s;
	});

	const isGroupLocked = () => (settings()?.quiet_hours as any)?.emergencyLock || false;

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			haptic.impact('light');
			navigate('/managed-bots');
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
		haptic.impact('medium');
		setIsLocking(true);
		setShowLockConfirm(false);
		try {
			const qh = { ...((settings()?.quiet_hours as any) || {}), emergencyLock: !current };
			const res = await groupApi.updateSettings(params.id, 'quiet_hours', qh, settingsVersion());
			if (res?.version) setSettingsVersion(res.version);
			mutate((prev: any) => (prev ? { ...prev, quiet_hours: qh } : { quiet_hours: qh }));
			haptic.notify('success');
			showToast(current ? t('groupDashboard.unlockSuccess') : t('groupDashboard.lockSuccess'), 'success');

			if (!current) {
				// Locked -> show 10s undo snackbar
				setShowUndoSnackbar(true);
				const timer = window.setTimeout(() => {
					setShowUndoSnackbar(false);
				}, 10000);
				setUndoLockTimer(timer);
			} else {
				setShowUndoSnackbar(false);
			}
		} catch (_e) {
			haptic.notify('error');
			showToast(t('groupDashboard.lockError'), 'error');
		} finally {
			setIsLocking(false);
		}
	};

	const handleUndoLock = async () => {
		if (undoLockTimer()) {
			clearTimeout(undoLockTimer()!);
		}
		setShowUndoSnackbar(false);
		await confirmToggleGroupLock();
	};

	const handleMenuOpen = () => {
		setIsMenuOpen(true);
		setShowTooltip(false);
		haptic.impact('light');
	};

	const academyProgressData = () => calculateAcademyProgress(settings());

	const isFeatureDone = (key: string) => {
		return academyProgressData().lessons.find((l) => l.key === key)?.done || false;
	};

	const navigateWithFeedback = (path: string) => {
		haptic.impact('light');
		navigate(path);
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white select-none font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#3390ec]/15 via-[#3390ec]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3 overflow-hidden flex-1">
					<button
						onClick={() => { haptic.impact('light'); navigate('/managed-bots'); }}
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
							<img loading="lazy" 								src={group()?.photo_url}
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
										onClick={() => { haptic.impact('light'); setSearchQuery(''); navigate(feat.path); }}
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

				{/* ═══════ TELEGRAM NATIVE SECURITY STATUS CARD ═══════ */}
				<Show when={tgInfo()}>
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[28px] p-5 flex flex-col gap-3.5 shadow-sm">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2 text-[#3390ec]">
								<span class="material-symbols-outlined text-[20px]">security</span>
								<h3 class="text-[13px] font-black uppercase tracking-widest">وضعیت امنیت تلگرام (Telegram Security)</h3>
							</div>
							<span class="text-[9px] font-black bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/30 px-2 py-0.5 rounded-[6px] uppercase tracking-widest">
								NATIVE
							</span>
						</div>

						<div class="grid grid-cols-2 gap-2 text-[11px]">
							<div class={`p-2.5 rounded-[14px] border flex items-center gap-2 ${tgInfo()?.has_protected_content ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-white/5 border-white/5 text-white/40'}`}>
								<span class="material-symbols-outlined text-[16px]">lock</span>
								<span class="font-bold">محتوای محافظت‌شده</span>
							</div>
							<div class={`p-2.5 rounded-[14px] border flex items-center gap-2 ${tgInfo()?.has_hidden_members ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-white/5 border-white/5 text-white/40'}`}>
								<span class="material-symbols-outlined text-[16px]">visibility_off</span>
								<span class="font-bold">مخفی‌سازی اعضا</span>
							</div>
							<div class={`p-2.5 rounded-[14px] border flex items-center gap-2 ${tgInfo()?.has_aggressive_anti_spam_enabled ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-white/5 border-white/5 text-white/40'}`}>
								<span class="material-symbols-outlined text-[16px]">shield</span>
								<span class="font-bold">ضداسپم نیتیو تلگرام</span>
							</div>
							<div class={`p-2.5 rounded-[14px] border flex items-center gap-2 ${tgInfo()?.join_by_request ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-white/5 border-white/5 text-white/40'}`}>
								<span class="material-symbols-outlined text-[16px]">verified_user</span>
								<span class="font-bold">ورود با درخواست</span>
							</div>
						</div>
					</div>
				</Show>

				{/* ═══════ HERO: ACADEMY PROGRESS & EMERGENCY LOCK ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
					<div class="absolute -right-8 -top-8 w-28 h-28 bg-[#3390ec]/10 blur-2xl rounded-full pointer-events-none" />
					
					<div class="flex items-center gap-4">
						<div class="relative w-16 h-16 shrink-0 flex items-center justify-center">
							<svg viewBox="0 0 64 64" class="w-full h-full -rotate-90">
								<circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6" />
								<circle
									cx="32" cy="32" r="26" fill="none" stroke="#3390ec" stroke-width="6" stroke-linecap="round"
									stroke-dasharray={`${(academyProgressData().percentage / 100) * 163} 163`}
									class="transition-all duration-1000 ease-out"
								/>
							</svg>
							<span class="absolute inset-0 flex items-center justify-center text-[13px] font-black font-mono text-white">
								{academyProgressData().percentage}%
							</span>
						</div>

						<div class="flex flex-col">
							<h2 class="text-[15px] font-black text-white tracking-tight">{t('groupLessons.heroTitle')}</h2>
							<p class="text-[11px] text-white/50 font-bold mt-1 leading-relaxed">
								{academyProgressData().completedCount} از {academyProgressData().totalCount} سپر امنیتی فعال است
							</p>
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

				{/* ═══════ ZERO-ADS GUARANTEE ═══════ */}
				<div class="bg-gradient-to-r from-[#10b981]/15 to-[#3390ec]/10 border border-[#10b981]/30 rounded-[24px] p-4 flex flex-col gap-2 shadow-sm relative overflow-hidden">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-[12px] bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center shrink-0">
							<span class="material-symbols-outlined text-[#10b981] text-[22px]">verified_user</span>
						</div>
						<div class="flex flex-col">
							<div class="flex items-center gap-2">
								<span class="text-[13px] font-black text-white">Zero-Ads Guarantee</span>
								<span class="bg-[#10b981]/20 text-[#10b981] text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-[#10b981]/40">Active</span>
							</div>
							<p class="text-[10px] text-white/60 font-medium mt-0.5">{t('groupCommands.adFreeNotice' as any) || '100% Ad-Free & Privacy First. No promotional ads or airdrop spam will ever be sent to your group.'}</p>
						</div>
					</div>
				</div>

				{/* ═══════ FAST ADMIN COMMANDS ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-4 flex flex-col gap-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#3390ec] text-[20px]">terminal</span>
							<span class="text-[13px] font-black text-white">{t('groupCommands.title' as any) || 'Fast Admin Chat Commands'}</span>
						</div>
						<span class="text-[10px] font-mono text-white/40 uppercase font-bold">{t('groupCommands.inChatCli' as any) || 'In-Chat CLI'}</span>
					</div>
					<div class="grid grid-cols-2 gap-2 text-[11px] font-mono">
						<div class="bg-black/30 rounded-[12px] p-2 border border-white/5 flex flex-col">
							<span class="text-[#3390ec] font-bold">/settings</span>
							<span class="text-[10px] text-white/40 font-sans">{t('groupCommands.settingsDesc' as any) || 'Interactive Inline GUI'}</span>
						</div>
						<div class="bg-black/30 rounded-[12px] p-2 border border-white/5 flex flex-col">
							<span class="text-[#3390ec] font-bold">{t('groupCommands.lockUnlock' as any) || '/lock & /unlock'}</span>
							<span class="text-[10px] text-white/40 font-sans">{t('groupCommands.lockDesc' as any) || 'Lock/Open chat'}</span>
						</div>
						<div class="bg-black/30 rounded-[12px] p-2 border border-white/5 flex flex-col">
							<span class="text-[#3390ec] font-bold">{t('groupCommands.muteDur' as any) || '/mute [10m|1h]'}</span>
							<span class="text-[10px] text-white/40 font-sans">{t('groupCommands.muteDesc' as any) || 'Mute with duration'}</span>
						</div>
						<div class="bg-black/30 rounded-[12px] p-2 border border-white/5 flex flex-col">
							<span class="text-[#3390ec] font-bold">{t('groupCommands.ephemeralSec' as any) || '/ephemeral [15s]'}</span>
							<span class="text-[10px] text-white/40 font-sans">{t('groupCommands.ephemeralDesc' as any) || 'Auto-delete bot msgs'}</span>
						</div>
						<div class="bg-black/30 rounded-[12px] p-2 border border-white/5 flex flex-col">
							<span class="text-[#3390ec] font-bold">{t('groupCommands.slowmodeSec' as any) || '/slowmode [sec]'}</span>
							<span class="text-[10px] text-white/40 font-sans">{t('groupCommands.slowmodeDesc' as any) || 'Rate limit delay'}</span>
						</div>
						<div class="bg-black/30 rounded-[12px] p-2 border border-white/5 flex flex-col">
							<span class="text-[#3390ec] font-bold">{t('groupCommands.purgeNum' as any) || '/purge [n]'}</span>
							<span class="text-[10px] text-white/40 font-sans">{t('groupCommands.purgeDesc' as any) || 'Bulk delete messages'}</span>
						</div>
					</div>
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

			{/* ═══════ 10-SECOND UNDO SNACKBAR ═══════ */}
			<Show when={showUndoSnackbar()}>
				<div class="fixed bottom-6 left-5 right-5 z-50 flex justify-center animate-slide-up pointer-events-auto">
					<div class="max-w-md w-full bg-[#181926] border border-[#ff4a4a]/40 rounded-[20px] p-4 shadow-2xl flex items-center justify-between gap-3">
						<div class="flex items-center gap-3">
							<span class="w-3 h-3 rounded-full bg-[#ff4a4a] animate-pulse shrink-0" />
							<span class="text-[13px] font-bold text-white">گروه قفل شد (ارسال پیام مسدود شد)</span>
						</div>
						<button
							onClick={handleUndoLock}
							class="px-3.5 py-1.5 rounded-[12px] bg-[#ff4a4a]/20 hover:bg-[#ff4a4a]/30 text-[#ff4a4a] border border-[#ff4a4a]/30 text-[12px] font-black active:scale-95 transition-all shrink-0"
						>
							لغو (Undo)
						</button>
					</div>
				</div>
			</Show>

			{/* ═══════ EMERGENCY LOCK CONFIRM MODAL ═══════ */}
			<Show when={showLockConfirm()}>
				<div
					class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5 animate-fade-in"
					onClick={(e) => {
						if (e.target === e.currentTarget) setShowLockConfirm(false);
					}}
				>
					<div
						class="w-full max-w-md bg-[#12141C] border border-white/10 rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl flex flex-col gap-4 animate-slide-up"
					>
						<div class="flex items-center gap-3">
							<div
								class={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 border ${
									isGroupLocked()
										? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
										: 'bg-[#ff4a4a]/15 text-[#ff4a4a] border-[#ff4a4a]/30'
								}`}
							>
								<span class="material-symbols-outlined text-[24px]">
									{isGroupLocked() ? 'lock_open' : 'lock'}
								</span>
							</div>
							<div class="flex flex-col">
								<h3 class="text-[16px] font-black text-white leading-tight">
									{isGroupLocked()
										? t('groupDashboard.unlockGroupBtn')
										: t('groupDashboard.toggleLockModalTitle')}
								</h3>
								<span class="text-[11px] text-white/50 font-bold mt-0.5">
									{t('groupDashboard.attentionTitle')}
								</span>
							</div>
						</div>

						<p class="text-[13px] text-white/70 leading-relaxed font-medium">
							{t('groupDashboard.toggleLockModalDesc')}
						</p>

						<div class="flex gap-3 pt-2">
							<button
								onClick={() => setShowLockConfirm(false)}
								class="flex-1 h-12 rounded-[14px] bg-white/5 hover:bg-white/10 text-white/70 font-bold text-[13px] transition-colors active:scale-95"
							>
								{t('common.cancel')}
							</button>
							<button
								onClick={confirmToggleGroupLock}
								class={`flex-1 h-12 rounded-[14px] font-black text-[13px] shadow-lg transition-all active:scale-95 ${
									isGroupLocked()
										? 'bg-[#10b981] hover:bg-[#059669] text-white shadow-[#10b981]/20'
										: 'bg-[#ff4a4a] hover:bg-[#e03838] text-white shadow-[#ff4a4a]/20'
								}`}
							>
								{isGroupLocked()
									? t('groupDashboard.unlockGroupBtn')
									: t('groupDashboard.confirmLockGroupBtn')}
							</button>
						</div>
					</div>
				</div>
			</Show>

			<HamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				groupId={params.id}
				activeTab="dashboard"
			/>
		</div>
	);
};
