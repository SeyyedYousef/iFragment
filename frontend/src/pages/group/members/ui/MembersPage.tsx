import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	type Component,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { type AuditLog, groupApi, type MemberWarning } from '@/entities/group/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { showToast } from '@/shared/ui/toast.js';

export const MembersPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [activeTab, setActiveTab] = createSignal<'warnings' | 'audit' | 'actions'>('warnings');
	const [showRestrictModal, setShowRestrictModal] = createSignal(false);

	// Manual Restrict Form state
	const [targetUserId, setTargetUserId] = createSignal('');
	const [durationHours, setDurationHours] = createSignal(24);
	const [isSubmitting, setIsSubmitting] = createSignal(false);

	// Data resources
	const [warnings, { refetch: refetchWarnings }] = createResource(
		() => params.id,
		(id) => groupApi.listGroupWarnings(id),
	);

	const [auditLogs, { refetch: refetchAudit }] = createResource(
		() => params.id,
		(id) => groupApi.getAuditLogs(id, 50, 0),
	);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			haptic.impact('light');
			if (showRestrictModal()) {
				setShowRestrictModal(false);
			} else {
				navigate(`/group/${params.id}`);
			}
		});
		onCleanup(() => off());
	});

	const handleResetWarning = async (userId: number, username: string) => {
		haptic.impact('medium');
		try {
			await groupApi.resetGroupWarnings(params.id, userId);
			haptic.notify('success');
			showToast(t('membersPage.warningsReset', { user: `@${username || userId}` }), 'success');
			refetchWarnings();
		} catch (_e) {
			haptic.notify('error');
			showToast(t('common.errorUpdateFailed'), 'error');
		}
	};

	const handleManualRestrict = async () => {
		const uid = parseInt(targetUserId(), 10);
		if (!uid || Number.isNaN(uid)) {
			showToast(t('membersPage.invalidUserId'), 'error');
			return;
		}

		haptic.impact('medium');
		setIsSubmitting(true);
		try {
			const untilDate = Math.floor(Date.now() / 1000) + durationHours() * 3600;
			await groupApi.restrictMember(params.id, {
				target_user_id: uid,
				until_date: untilDate,
				permissions: {
					can_send_messages: false,
					can_send_media_messages: false,
					can_send_polls: false,
					can_send_other_messages: false,
					can_add_web_page_previews: false,
				},
			});

			haptic.notify('success');
			showToast(t('membersPage.restrictApplied'), 'success');
			setShowRestrictModal(false);
			setTargetUserId('');
			refetchWarnings();
			refetchAudit();
		} catch (e: any) {
			haptic.notify('error');
			showToast(e?.response?.data?.error || t('common.errorUpdateFailed'), 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleUnban = async (uid: number) => {
		haptic.impact('medium');
		try {
			await groupApi.unbanMember(params.id, uid);
			haptic.notify('success');
			showToast(t('membersPage.userUnbanned', { uid }), 'success');
			refetchWarnings();
			refetchAudit();
		} catch (_e) {
			haptic.notify('error');
			showToast(t('common.errorUpdateFailed'), 'error');
		}
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/group/${params.id}`);
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
							{t('membersPage.title')}
						</h1>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('groupDashboard.recentActivity')}
						</span>
					</div>
				</div>

				<button
					type="button"
					onClick={() => setIsMenuOpen(true)}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 shadow-sm text-white/80"
					aria-label={t('common.toggle')}
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<HamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				groupId={params.id}
				activeTab="members"
			/>

			{/* ═══════ TABS ═══════ */}
			<div class="px-5 pt-4 pb-2 max-w-md mx-auto relative z-10 w-full">
				<div class="grid grid-cols-3 gap-2 bg-[#12141C]/80 p-1.5 rounded-[18px] border border-white/5">
					<button
						type="button"
						onClick={() => {
							haptic.selection();
							setActiveTab('warnings');
						}}
						class={`h-11 rounded-[14px] text-[12px] font-black flex items-center justify-center gap-1.5 transition-all ${
							activeTab() === 'warnings'
								? 'bg-[#3390ec] text-white shadow-[0_4px_15px_rgba(51,144,236,0.35)]'
								: 'text-white/60 hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-[18px]">warning</span>
						{t('membersPage.tabWarnings')}
					</button>
					<button
						type="button"
						onClick={() => {
							haptic.selection();
							setActiveTab('actions');
						}}
						class={`h-11 rounded-[14px] text-[12px] font-black flex items-center justify-center gap-1.5 transition-all ${
							activeTab() === 'actions'
								? 'bg-[#3390ec] text-white shadow-[0_4px_15px_rgba(51,144,236,0.35)]'
								: 'text-white/60 hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-[18px]">gavel</span>
						{t('membersPage.tabManual')}
					</button>
					<button
						type="button"
						onClick={() => {
							haptic.selection();
							setActiveTab('audit');
						}}
						class={`h-11 rounded-[14px] text-[12px] font-black flex items-center justify-center gap-1.5 transition-all ${
							activeTab() === 'audit'
								? 'bg-[#3390ec] text-white shadow-[0_4px_15px_rgba(51,144,236,0.35)]'
								: 'text-white/60 hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-[18px]">history</span>
						{t('membersPage.tabAuditLog')}
					</button>
				</div>
			</div>

			<div class="p-5 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
				{/* ═══════ TAB: ACTIVE WARNINGS ═══════ */}
				<Show when={activeTab() === 'warnings'}>
					<div class="flex items-center justify-between px-1 mb-1">
						<span class="text-[12px] font-bold text-white/50 uppercase tracking-wider">
							{t('membersPage.warningsListTitle')}
						</span>
						<button
							type="button"
							onClick={() => {
								haptic.impact('light');
								setShowRestrictModal(true);
							}}
							class="text-[12px] font-bold text-[#3390ec] hover:underline flex items-center gap-1"
						>
							<span class="material-symbols-outlined text-[16px]">add_circle</span>
							{t('membersPage.newPenaltyBtn')}
						</button>
					</div>

					<Show
						when={!warnings.loading}
						fallback={
							<div class="p-12 flex justify-center">
								<div class="w-8 h-8 border-2 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
							</div>
						}
					>
						<Show
							when={warnings() && warnings()!.length > 0}
							fallback={
								<div class="bg-[#12141C]/80 border border-white/5 rounded-[24px] p-8 text-center flex flex-col items-center gap-3">
									<div class="w-14 h-14 rounded-full bg-[#10b981]/10 text-[#10b981] flex items-center justify-center">
										<span class="material-symbols-outlined text-[30px]">verified_user</span>
									</div>
									<h3 class="text-[15px] font-black text-white">
										{t('membersPage.noWarningsTitle')}
									</h3>
									<p class="text-[12px] text-white/40 max-w-xs">
										{t('membersPage.noWarningsDesc')}
									</p>
								</div>
							}
						>
							<div class="flex flex-col gap-3">
								<For each={warnings()}>
									{(w: MemberWarning) => (
										<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[20px] p-4 flex items-center justify-between gap-3 shadow-sm">
											<div class="flex items-center gap-3 overflow-hidden flex-1">
												<div class="w-11 h-11 rounded-[14px] bg-gradient-to-br from-amber-500/20 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
													<span class="material-symbols-outlined text-[20px]">warning</span>
												</div>
												<div class="flex flex-col overflow-hidden">
													<div class="flex items-center gap-1.5 truncate">
														<span class="text-[14px] font-black text-white truncate">
															{w.first_name ||
																`@${w.username}` ||
																t('membersPage.fallbackUser', { uid: w.user_id })}
														</span>
														<Show when={w.username}>
															<span class="text-[11px] text-white/40 font-mono">@{w.username}</span>
														</Show>
													</div>
													<span class="text-[11px] text-white/50 truncate mt-0.5">
														{t('membersPage.reason')}{' '}
														{w.last_reason || t('membersPage.defaultReason')}
													</span>
												</div>
											</div>

											<div class="flex items-center gap-2.5 shrink-0">
												<div class="flex flex-col items-end">
													<span class="text-[12px] font-mono font-black text-amber-400">
														{w.warning_count} / {w.threshold}
													</span>
													<span class="text-[9px] text-white/40 uppercase font-bold">
														{t('membersPage.warningBadge')}
													</span>
												</div>
												<button
													type="button"
													onClick={() => handleResetWarning(w.user_id, w.username)}
													class="w-9 h-9 rounded-[12px] bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center active:scale-95 transition-all"
													title={t('membersPage.clearWarnings')}
												>
													<span class="material-symbols-outlined text-[18px]">restart_alt</span>
												</button>
											</div>
										</div>
									)}
								</For>
							</div>
						</Show>
					</Show>
				</Show>

				{/* ═══════ TAB: MANUAL ACTIONS ═══════ */}
				<Show when={activeTab() === 'actions'}>
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm flex flex-col gap-4">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#3390ec] text-[20px]">gavel</span>
							<h3 class="text-[14px] font-black text-white uppercase tracking-wider">
								{t('membersPage.manualActionTitle')}
							</h3>
						</div>

						<p class="text-[12px] text-white/50 leading-relaxed font-medium">
							{t('membersPage.manualActionDesc')}
						</p>

						<div class="flex flex-col gap-1.5">
							<div class="text-[11px] font-bold text-white/60 uppercase tracking-wider">
								{t('membersPage.targetIdLabel')}
							</div>
							<input
								type="text"
								placeholder={t('membersPage.userIdPlaceholder')}
								value={targetUserId()}
								onInput={(e) => setTargetUserId(e.currentTarget.value)}
								class="w-full h-12 bg-[#08090D] border border-white/10 text-white text-[13px] font-mono font-bold rounded-[14px] px-4 focus:outline-none focus:border-[#3390ec]/50"
								dir="ltr"
							/>
						</div>

						<div class="flex flex-col gap-1.5">
							<div class="text-[11px] font-bold text-white/60 uppercase tracking-wider">
								{t('membersPage.durationLabel')}
							</div>
							<select
								value={durationHours()}
								onChange={(e) => setDurationHours(parseInt(e.currentTarget.value, 10))}
								class="w-full h-12 bg-[#08090D] border border-white/10 text-white text-[13px] font-bold rounded-[14px] px-3 focus:outline-none focus:border-[#3390ec]/50"
							>
								<option value={1}>{t('membersPage.duration1h')}</option>
								<option value={24}>{t('membersPage.duration24h')}</option>
								<option value={168}>{t('membersPage.duration7d')}</option>
								<option value={720}>{t('membersPage.duration30d')}</option>
								<option value={8760}>{t('membersPage.duration365d')}</option>
							</select>
						</div>

						<div class="flex gap-2.5 pt-2">
							<button
								type="button"
								onClick={handleManualRestrict}
								disabled={isSubmitting()}
								class="flex-1 h-12 bg-[#3390ec] hover:bg-[#2b7ec9] text-white rounded-[14px] font-black text-[13px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_4px_15px_rgba(51,144,236,0.3)] disabled:opacity-50"
							>
								<span class="material-symbols-outlined text-[18px]">volume_off</span>
								{t('membersPage.muteAction')}
							</button>
							<button
								type="button"
								onClick={() => {
									const uid = parseInt(targetUserId(), 10);
									if (uid) handleUnban(uid);
									else showToast(t('membersPage.invalidUserId'), 'error');
								}}
								class="h-12 px-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-[14px] font-bold text-[12px] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
							>
								<span class="material-symbols-outlined text-[18px]">lock_open</span>
								{t('membersPage.unbanBtn')}
							</button>
						</div>
					</div>
				</Show>

				{/* ═══════ TAB: AUDIT LOGS ═══════ */}
				<Show when={activeTab() === 'audit'}>
					<div class="flex items-center justify-between px-1 mb-1">
						<span class="text-[12px] font-bold text-white/50 uppercase tracking-wider">
							{t('membersPage.auditSectionTitle')}
						</span>
						<button
							type="button"
							onClick={() => refetchAudit()}
							class="text-[12px] font-bold text-[#3390ec] hover:underline flex items-center gap-1"
						>
							<span class="material-symbols-outlined text-[16px]">refresh</span>
							{t('membersPage.refresh')}
						</button>
					</div>

					<Show
						when={!auditLogs.loading}
						fallback={
							<div class="p-12 flex justify-center">
								<div class="w-8 h-8 border-2 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
							</div>
						}
					>
						<Show
							when={auditLogs() && auditLogs()!.length > 0}
							fallback={
								<div class="bg-[#12141C]/80 border border-white/5 rounded-[24px] p-8 text-center flex flex-col items-center gap-3">
									<span class="material-symbols-outlined text-[32px] text-white/30">
										history_toggle_off
									</span>
									<h3 class="text-[15px] font-black text-white">
										{t('membersPage.auditEmptyTitle')}
									</h3>
									<p class="text-[12px] text-white/40">{t('membersPage.auditEmptyDesc')}</p>
								</div>
							}
						>
							<div class="flex flex-col gap-2.5">
								<For each={auditLogs()}>
									{(log: AuditLog) => (
										<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[18px] p-3.5 flex items-start gap-3 shadow-sm">
											<div class="w-9 h-9 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-white/70 mt-0.5">
												<span class="material-symbols-outlined text-[18px]">
													{log.action.includes('ban')
														? 'block'
														: log.action.includes('mute')
															? 'volume_off'
															: 'info'}
												</span>
											</div>
											<div class="flex flex-col flex-1 overflow-hidden">
												<div class="flex items-center justify-between gap-2">
													<span class="text-[13px] font-bold text-white truncate">
														{log.action}
													</span>
													<span class="text-[10px] text-white/40 font-mono">
														{new Date(log.created_at).toLocaleTimeString([], {
															hour: '2-digit',
															minute: '2-digit',
														})}
													</span>
												</div>
												<span class="text-[11px] text-white/50 font-mono mt-0.5 truncate">
													{t('membersPage.actorUser', { id: log.actor_id })}
												</span>
											</div>
										</div>
									)}
								</For>
							</div>
						</Show>
					</Show>
				</Show>
			</div>

			{/* ═══════ RESTRICT MODAL ═══════ */}
			<Show when={showRestrictModal()}>
				<div
					class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5"
					onClick={(e) => {
						if (e.target === e.currentTarget) setShowRestrictModal(false);
					}}
				>
					<div class="w-full max-w-md bg-[#12141C] border border-white/10 rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl flex flex-col gap-4">
						<div class="flex items-center justify-between">
							<h3 class="text-[16px] font-black text-white">{t('membersPage.modalTitle')}</h3>
							<button
								type="button"
								onClick={() => setShowRestrictModal(false)}
								class="text-white/40 hover:text-white"
							>
								<span class="material-symbols-outlined text-[20px]">close</span>
							</button>
						</div>

						<div class="flex flex-col gap-1.5">
							<div class="text-[11px] font-bold text-white/60">
								{t('membersPage.modalUserIdLabel')}
							</div>
							<input
								type="text"
								placeholder={t('membersPage.userIdPlaceholder')}
								value={targetUserId()}
								onInput={(e) => setTargetUserId(e.currentTarget.value)}
								class="w-full h-12 bg-[#08090D] border border-white/10 text-white text-[13px] font-mono font-bold rounded-[14px] px-4 focus:outline-none focus:border-[#3390ec]/50"
								dir="ltr"
							/>
						</div>

						<div class="flex flex-col gap-1.5">
							<div class="text-[11px] font-bold text-white/60">
								{t('membersPage.modalDurationLabel')}
							</div>
							<select
								value={durationHours()}
								onChange={(e) => setDurationHours(parseInt(e.currentTarget.value, 10))}
								class="w-full h-12 bg-[#08090D] border border-white/10 text-white text-[13px] font-bold rounded-[14px] px-3 focus:outline-none focus:border-[#3390ec]/50"
							>
								<option value={1}>{t('membersPage.duration1h')}</option>
								<option value={24}>{t('membersPage.duration24h')}</option>
								<option value={168}>{t('membersPage.duration7d')}</option>
								<option value={720}>{t('membersPage.duration30d')}</option>
								<option value={8760}>{t('membersPage.duration365d')}</option>
							</select>
						</div>

						<div class="flex gap-3 pt-2">
							<button
								type="button"
								onClick={() => setShowRestrictModal(false)}
								class="flex-1 h-12 rounded-[14px] bg-white/5 hover:bg-white/10 text-white/70 font-bold text-[13px]"
							>
								{t('common.cancel')}
							</button>
							<button
								type="button"
								onClick={handleManualRestrict}
								disabled={isSubmitting()}
								class="flex-1 h-12 rounded-[14px] bg-[#ff4a4a] hover:bg-[#e03838] text-white font-black text-[13px] shadow-[0_4px_15px_rgba(255,74,74,0.3)] disabled:opacity-50"
							>
								{t('membersPage.applyRestrictBtn')}
							</button>
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
};
