import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import {
	Component,
	createResource,
	createSignal,
	onCleanup,
	onMount,
	Show,
	Suspense,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { NumberInputField, StringListField, ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

export const MandatoryPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	const [cfg, setCfg] = createStore({
		forcedAddEnabled: false,
		forcedAddCount: 0,
		forceJoinEnabled: false,
		requiredChannels: [] as string[],
		verificationEnabled: false,
		excludedUsers: [] as string[],
	});

	const [isDirty, setIsDirty] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);

	const [settingsData, { refetch }] = createResource(
		() => params.id,
		async (groupId) => {
			const res = await groupApi.getSettings(groupId);
			const mm = (res.mandatory_membership || {}) as any;
			setCfg(
				reconcile({
					forcedAddEnabled: mm.forced_add_enabled ?? false,
					forcedAddCount: mm.forced_add_count ?? 0,
					forceJoinEnabled: mm.force_join_enabled ?? false,
					requiredChannels: mm.required_channels ?? [],
					verificationEnabled: mm.verification_enabled ?? false,
					excludedUsers: mm.exemptions ?? [],
				}),
			);
			setIsDirty(false);
			return res;
		},
	);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			try { hapticFeedback.impactOccurred('light'); } catch (_) {}
			window.history.back();
		});
		onCleanup(() => off());
	});

	const updateCfg = (key: keyof typeof cfg, value: any) => {
		setCfg(key, value);
		setIsDirty(true);
	};

	const handleSave = async () => {
		if (!isDirty() || !settingsData()) return;
		try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
		setIsSaving(true);
		try {
			await groupApi.updateSettings(
				params.id,
				'mandatory_membership',
				{
					forced_add_enabled: cfg.forcedAddEnabled,
					forced_add_count: cfg.forcedAddCount,
					force_join_enabled: cfg.forceJoinEnabled,
					required_channels: cfg.requiredChannels,
					verification_enabled: cfg.verificationEnabled,
					exemptions: cfg.excludedUsers,
				},
				settingsData()!.version,
			);
			setIsDirty(false);
			refetch();
			showToast(t('common.settingsSaved'), 'success');
			navigate(`/group/${params.id}`);
		} catch (_e) {
			showToast(t('common.errorUpdateFailed'), 'error');
			try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} window.history.back(); }}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2.5">
							<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
								{t('mandatorySettings.title')}
							</h1>
							<Show when={isDirty()}>
								<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
							</Show>
						</div>
						<p class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('mandatorySettings.subtitle')}
						</p>
					</div>
				</div>

				<button
					onClick={() => setIsMenuOpen(true)}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 shadow-sm text-white/80"
					aria-label={t('common.toggle')}
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<HamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} groupId={params.id} activeTab="mandatory" />

			<Suspense fallback={null}>
				<div class="p-5 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
					
					{/* ═══════ FORCED ADD ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 shadow-sm relative overflow-hidden flex flex-col gap-4">
						<div class="absolute -left-6 -top-6 w-24 h-24 bg-[#3390ec]/10 blur-2xl rounded-full pointer-events-none" />
						
						<div class="flex items-center justify-between gap-3 relative z-10">
							<div class="flex items-center gap-3.5">
								<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center shadow-inner shrink-0">
									<span class="material-symbols-outlined text-[#3390ec] text-[20px]">person_add</span>
								</div>
								<h2 class="text-[15px] font-black text-white tracking-tight">{t('mandatorySettings.forcedAdd')}</h2>
							</div>
							<ToggleSwitch checked={cfg.forcedAddEnabled} onChange={(v) => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} updateCfg('forcedAddEnabled', v); }} />
						</div>

						<Show when={cfg.forcedAddEnabled}>
							<div class="h-[1px] bg-white/5 w-full rounded-full relative z-10" />
							<div class="relative z-10 mt-1">
								<NumberInputField
									label={t('mandatorySettings.forcedAddCount')}
									description={t('mandatorySettings.forcedAddCountDesc')}
									value={cfg.forcedAddCount}
									onChange={(v) => updateCfg('forcedAddCount', v)}
									min={0}
									max={50}
								/>
							</div>
						</Show>
					</Motion.div>

					{/* ═══════ FORCE JOIN CHANNELS ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 shadow-sm relative overflow-hidden flex flex-col gap-4">
						<div class="absolute -right-6 -top-6 w-24 h-24 bg-amber-400/10 blur-2xl rounded-full pointer-events-none" />
						
						<div class="flex items-center justify-between gap-3 relative z-10">
							<div class="flex items-center gap-3.5">
								<div class="w-10 h-10 rounded-[12px] bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shadow-inner shrink-0">
									<span class="material-symbols-outlined text-amber-400 text-[20px]">campaign</span>
								</div>
								<h2 class="text-[15px] font-black text-white tracking-tight">{t('mandatorySettings.forceJoin')}</h2>
							</div>
							<ToggleSwitch checked={cfg.forceJoinEnabled} onChange={(v) => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} updateCfg('forceJoinEnabled', v); }} />
						</div>

						<Show when={cfg.forceJoinEnabled}>
							<div class="h-[1px] bg-white/5 w-full rounded-full relative z-10" />
							<div class="relative z-10 mt-1">
								<StringListField
									label={t('mandatorySettings.reqChannels')}
									description={t('mandatorySettings.reqChannelsDesc')}
									placeholder="@username or channel URL"
									items={cfg.requiredChannels}
									onAdd={(item) => updateCfg('requiredChannels', [...cfg.requiredChannels, item])}
									onRemove={(item) => updateCfg('requiredChannels', cfg.requiredChannels.filter((c) => c !== item))}
								/>
							</div>
						</Show>
					</Motion.div>

					{/* ═══════ VERIFICATION (Security Banner) ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} class="bg-[#10b981]/10 border border-[#10b981]/20 rounded-[24px] p-5 flex items-start gap-4 shadow-sm relative overflow-hidden">
						<div class="absolute -right-6 -bottom-6 w-28 h-28 bg-[#10b981]/20 blur-3xl rounded-full pointer-events-none" />
						
						<div class="w-10 h-10 rounded-[12px] bg-[#10b981]/20 flex items-center justify-center border border-[#10b981]/30 shadow-inner shrink-0 relative z-10">
							<span class="material-symbols-outlined text-[#10b981] text-[20px]">verified_user</span>
						</div>
						
						<div class="flex flex-col flex-1 relative z-10 min-w-0 pr-12">
							<span class="text-[15px] font-black text-white mb-1 tracking-tight">{t('mandatorySettings.verification')}</span>
							<span class="text-[11px] text-white/60 leading-relaxed font-medium">{t('mandatorySettings.verificationDesc')}</span>
						</div>
						
						<div class="absolute right-5 top-5 z-10">
							<ToggleSwitch checked={cfg.verificationEnabled} onChange={(v) => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} updateCfg('verificationEnabled', v); }} />
						</div>
					</Motion.div>

					{/* ═══════ EXEMPTIONS ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 shadow-sm relative overflow-hidden flex flex-col gap-4">
						<div class="absolute -left-6 -bottom-6 w-24 h-24 bg-[#ff4a4a]/10 blur-2xl rounded-full pointer-events-none" />
						
						<div class="flex items-center gap-3.5 relative z-10 mb-2">
							<div class="w-10 h-10 rounded-[12px] bg-[#ff4a4a]/15 border border-[#ff4a4a]/30 flex items-center justify-center shadow-inner shrink-0">
								<span class="material-symbols-outlined text-[#ff4a4a] text-[20px]">do_not_disturb_off</span>
							</div>
							<h2 class="text-[15px] font-black text-white tracking-tight">{t('mandatorySettings.exemptions')}</h2>
						</div>

						<div class="relative z-10">
							<StringListField
								label={t('mandatorySettings.excludedUsers')}
								description={t('mandatorySettings.excludedUsersDesc')}
								placeholder="@username or User ID"
								items={cfg.excludedUsers}
								onAdd={(item) => updateCfg('excludedUsers', [...cfg.excludedUsers, item])}
								onRemove={(item) => updateCfg('excludedUsers', cfg.excludedUsers.filter((e) => e !== item))}
							/>
						</div>
					</Motion.div>
				</div>
			</Suspense>

			{/* ═══════ FLOATING ACTION BAR ═══════ */}
			<Show when={isDirty()}>
				<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#030303] via-[#030303]/90 to-transparent z-40 pointer-events-none">
					<div class="max-w-md mx-auto flex gap-3 pointer-events-auto">
						<button
							onClick={() => refetch()} disabled={isSaving()}
							class="w-16 h-14 bg-[#12141C]/80 backdrop-blur-md text-[#ff4a4a] border border-[#ff4a4a]/20 rounded-[16px] transition-all flex items-center justify-center hover:bg-[#ff4a4a]/10 active:scale-95 shadow-sm"
						>
							<span class="material-symbols-outlined text-[24px]">close</span>
						</button>
						<button
							onClick={handleSave} disabled={isSaving()}
							class="flex-1 h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest shadow-[0_10px_30px_rgba(51,144,236,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:scale-100 active:scale-95 border border-white/10"
						>
							<Show when={!isSaving()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
								{t('generalSettings.saveSettings')} <span class="material-symbols-outlined text-[22px]">save</span>
							</Show>
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};
