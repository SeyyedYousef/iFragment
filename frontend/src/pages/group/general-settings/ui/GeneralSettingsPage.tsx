import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { type Component, createResource, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/entities/group/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { SettingsGuard } from '@/shared/ui/SettingsGuard.js';
import { SelectField, SettingsSection, ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

interface GeneralConfig {
	language: string;
	timezone: string;
	welcomeMessage: boolean;
	warningMessage: boolean;
	autoDeleteBot: boolean;
	autoDeleteDelay: number;
	trackAdmin: boolean;
	verifyMembers: boolean;
	publicCommands: boolean;
	hideJoinLeave: boolean;
	defaultPenalty: string;
	autoWarning: boolean;
	warningThreshold: number;
	warningRetention: number;
	warningFinalPenalty: string;
	casEnabled: boolean;
	antiRaidThreshold: number;
	antiRaidAction: string;
	botEnabled: boolean;
	ephemeralAll: boolean;
	ephemeralWelcome: boolean;
	ephemeralWarnings: boolean;
	ephemeralCaptcha: boolean;
	ephemeralAdminCmd: boolean;
	memberTagsEnabled: boolean;
}

const defaultConfig: GeneralConfig = {
	language: 'en',
	timezone: 'UTC',
	welcomeMessage: true,
	warningMessage: true,
	autoDeleteBot: true,
	autoDeleteDelay: 60,
	trackAdmin: false,
	verifyMembers: false,
	publicCommands: false,
	hideJoinLeave: false,
	defaultPenalty: 'delete',
	autoWarning: true,
	warningThreshold: 3,
	warningRetention: 7,
	warningFinalPenalty: 'mute_24h',
	casEnabled: false,
	antiRaidThreshold: 0,
	antiRaidAction: 'none',
	botEnabled: true,
	ephemeralAll: false,
	ephemeralWelcome: false,
	ephemeralWarnings: false,
	ephemeralCaptcha: false,
	ephemeralAdminCmd: false,
	memberTagsEnabled: true,
};

export const GeneralSettingsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [showUnsavedSheet, setShowUnsavedSheet] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const [config, setConfig] = createStore<GeneralConfig>({ ...defaultConfig });
	const [initialConfig, setInitialConfig] = createSignal<GeneralConfig>({ ...defaultConfig });

	createResource(
		() => params.id,
		async (groupId) => {
			const settings = await groupApi.getSettings(groupId);
			setSettingsVersion(settings.version);
			const general = (settings.general || {}) as Partial<GeneralConfig>;
			const merged = { ...defaultConfig, ...general };
			setInitialConfig({ ...merged });
			setConfig(reconcile(merged));
			setIsDirty(false);
			return settings;
		},
	);

	const handleBack = () => {
		if (isDirty()) {
			setShowUnsavedSheet(true);
			return;
		}
		window.history.back();
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(handleBack);
		onCleanup(() => off());
	});

	const updateField = <K extends keyof GeneralConfig>(key: K, value: GeneralConfig[K]) => {
		setConfig(key, value);
		setIsDirty(true);
	};

	const handleSave = async () => {
		if (!isDirty() || isSaving()) return;
		setIsSaving(true);
		try {
			const result = await groupApi.updateSettings(
				params.id,
				'general',
				config as any,
				settingsVersion(),
			);
			setSettingsVersion(result.version);
			setInitialConfig({ ...config });
			setIsDirty(false);
			setShowUnsavedSheet(false);
			haptic.notify('success');
			showToast(t('common.settingsSaved'), 'success');
			navigate(`/group/${params.id}`);
		} catch (_e: any) {
			haptic.notify('error');
			showToast(t('common.errorUpdateFailed'), 'error');
		} finally {
			setIsSaving(false);
		}
	};

	const handleDiscard = () => {
		setConfig(reconcile({ ...initialConfig() }));
		setIsDirty(false);
		setShowUnsavedSheet(false);
		window.history.back();
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							handleBack();
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2.5">
							<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
								{t('generalSettings.title')}
							</h1>
							<Show when={isDirty()}>
								<span
									class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
									title={t('common.unsavedChangesConfirm')}
								/>
							</Show>
						</div>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('generalSettings.description')}
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
				activeTab="general"
			/>

			<div class="p-5 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
				{/* ═══════ BOT CORE SETTINGS ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4">
					<div class="absolute -right-6 -top-6 w-24 h-24 bg-[#3390ec]/10 blur-2xl rounded-full pointer-events-none" />
					<div class="flex items-center gap-2 mb-1 relative z-10">
						<span class="material-symbols-outlined text-[20px] text-[#3390ec]">
							settings_b_roll
						</span>
						<h3 class="text-[13px] font-black text-[#3390ec] uppercase tracking-widest">
							{t('generalSettings.botCoreSection')}
						</h3>
					</div>

					<div class="relative z-10 flex flex-col gap-5">
						<SelectField
							label={t('generalSettings.botLanguage')}
							value={config.language}
							onChange={(v) => updateField('language', v)}
							options={[
								{ value: 'fa', label: 'Persian' },
								{ value: 'en', label: 'English' },
								{ value: 'ru', label: 'Russian' },
								{ value: 'zh', label: 'Chinese' },
							]}
						/>

						<SettingsSection
							title={t('generalSettings.botEnabled')}
							description={t('generalSettings.botEnabledDesc')}
							enabled={config.botEnabled}
							onToggle={(v) => updateField('botEnabled', v)}
						/>

						<SelectField
							label={t('generalSettings.timeZone')}
							value={config.timezone}
							onChange={(v) => updateField('timezone', v)}
							options={[
								{ value: 'Asia/Tehran', label: 'Tehran (GMT+3:30)' },
								{ value: 'UTC', label: 'UTC (GMT+0)' },
								{ value: 'Europe/Moscow', label: 'Moscow (GMT+3)' },
								{ value: 'Asia/Shanghai', label: 'Shanghai (GMT+8)' },
								{ value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
								{ value: 'Europe/London', label: 'London (GMT+0/1)' },
							]}
							description={t('generalSettings.timeZoneDesc')}
						/>

						{/* Control: Track Admin */}
						<SettingsSection
							title={t('generalSettings.trackAdmin')}
							description={t('generalSettings.trackAdminDesc')}
							enabled={config.trackAdmin}
							onToggle={(v) => updateField('trackAdmin', v)}
						/>

						{/* Control: Public Commands */}
						<SettingsSection
							title={t('generalSettings.publicCommands')}
							description={t('generalSettings.publicCommandsDesc')}
							enabled={config.publicCommands}
							onToggle={(v) => updateField('publicCommands', v)}
						/>

						{/* Control: Member Tags (/tag command — Bot API 9.5) */}
						<SettingsSection
							title={t('generalSettings.memberTags')}
							description={t('generalSettings.memberTagsDesc')}
							enabled={config.memberTagsEnabled}
							onToggle={(v) => updateField('memberTagsEnabled', v)}
						/>
					</div>
				</div>

				{/* ═══════ MESSAGING & BEHAVIOR ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4 mt-2">
					<div class="absolute -left-6 -top-6 w-24 h-24 bg-amber-400/10 blur-2xl rounded-full pointer-events-none" />
					<div class="flex items-center gap-2 mb-1 relative z-10">
						<span class="material-symbols-outlined text-[20px] text-amber-400">forum</span>
						<h3 class="text-[13px] font-black text-amber-400 uppercase tracking-widest">
							{t('generalSettings.messagingSection')}
						</h3>
					</div>

					<div class="relative z-10 flex flex-col gap-5">
						<SettingsSection
							title={t('generalSettings.welcomeMessage')}
							description={t('generalSettings.welcomeMessageDesc')}
							enabled={config.welcomeMessage}
							onToggle={(v) => updateField('welcomeMessage', v)}
							hasEditText={true}
							onEditText={() => navigate(`/group/${params.id}/settings/custom-texts`)}
						/>

						<SettingsSection
							title={t('generalSettings.warningMessage')}
							description={t('generalSettings.warningMessageDesc')}
							enabled={config.warningMessage}
							onToggle={(v) => updateField('warningMessage', v)}
							hasEditText={true}
							onEditText={() => navigate(`/group/${params.id}/settings/custom-texts`)}
						/>

						{/* Control: Hide Join Leave Service Messages */}
						<SettingsSection
							title={t('generalSettings.hideJoinLeave')}
							description={t('generalSettings.hideJoinLeaveDesc')}
							enabled={config.hideJoinLeave}
							onToggle={(v) => updateField('hideJoinLeave', v)}
						/>

						{/* Control: Verify Members Toggle */}
						<SettingsSection
							title={t('generalSettings.verifyMembers')}
							description={t('generalSettings.verifyMembersDesc')}
							enabled={config.verifyMembers}
							onToggle={(v) => updateField('verifyMembers', v)}
						/>

						{/* Auto Delete Bot Messages */}
						<div class="bg-[#08090D] rounded-[16px] border border-white/5 p-4 flex flex-col gap-3.5 shadow-inner">
							<div class="flex items-center justify-between gap-3">
								<div class="flex flex-col">
									<span class="text-[13px] font-bold text-white tracking-tight">
										{t('generalSettings.autoDeleteBot')}
									</span>
									<span class="text-[11px] text-white/50 font-medium mt-0.5">
										{t('generalSettings.autoDeleteBotDesc')}
									</span>
								</div>
								<ToggleSwitch
									checked={config.autoDeleteBot}
									onChange={(v) => updateField('autoDeleteBot', v)}
								/>
							</div>

							<Show when={config.autoDeleteBot}>
								<div class="flex items-center gap-2.5 pt-2 border-t border-white/5">
									<input
										type="number"
										min="5"
										max="86400"
										value={config.autoDeleteDelay}
										onInput={(e) =>
											updateField('autoDeleteDelay', parseInt(e.currentTarget.value, 10) || 60)
										}
										class="bg-[#12141C] border border-white/10 text-white text-[13px] font-mono font-bold rounded-[12px] px-4 py-2 w-24 text-center focus:outline-none focus:border-[#3390ec]/50 transition-colors shadow-inner"
										dir="ltr"
									/>
									<span class="text-[12px] text-white/50 font-bold uppercase tracking-wider">
										{t('generalSettings.seconds')}
									</span>
								</div>
							</Show>
						</div>
					</div>
				</div>

				{/* ═══════ EPHEMERAL MODE (AUTO-DELETE BOT MESSAGES) ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4 mt-2">
					<div class="absolute -right-6 -top-6 w-24 h-24 bg-sky-500/10 blur-2xl rounded-full pointer-events-none" />
					<div class="flex items-center gap-2 mb-1 relative z-10">
						<span class="material-symbols-outlined text-[20px] text-sky-400">visibility_off</span>
						<h3 class="text-[13px] font-black text-sky-400 uppercase tracking-widest">
							{t('generalSettings.ephemeralAll')}
						</h3>
					</div>

					<div class="relative z-10 flex flex-col gap-5">
						<SettingsSection
							title={t('generalSettings.ephemeralAll')}
							description={t('generalSettings.ephemeralAllDesc')}
							enabled={config.ephemeralAll}
							onToggle={(v) => {
								updateField('ephemeralAll', v);
								updateField('autoDeleteBot', v);
							}}
						/>

						<Show when={config.ephemeralAll}>
							<div class="flex flex-col gap-2 pt-2 border-t border-white/5">
								<div class="flex justify-between items-center text-[13px]">
									<span class="text-white/70">{t('generalSettings.autoDeleteDelay')}</span>
									<span class="text-sky-400 font-mono font-bold">{config.autoDeleteDelay}s</span>
								</div>
								<div class="grid grid-cols-4 gap-2 mt-1">
									<For each={[10, 15, 30, 60]}>
										{(sec) => (
											<button
												type="button"
												onClick={() => updateField('autoDeleteDelay', sec)}
												class={`py-2 text-xs font-semibold rounded-xl border transition-all ${
													config.autoDeleteDelay === sec
														? 'bg-sky-500/20 border-sky-500/50 text-sky-300 shadow-sm'
														: 'bg-white/5 border-white/5 text-white/60 hover:text-white'
												}`}
											>
												{sec}s
											</button>
										)}
									</For>
								</div>
							</div>
						</Show>
					</div>
				</div>

				{/* ═══════ WARNING SYSTEM & MODERATION ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4 mt-2">
					<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-[#10b981]/10 blur-2xl rounded-full pointer-events-none" />
					<div class="flex items-center gap-2 mb-1 relative z-10">
						<span class="material-symbols-outlined text-[20px] text-[#10b981]">gavel</span>
						<h3 class="text-[13px] font-black text-[#10b981] uppercase tracking-widest">
							{t('generalSettings.warningSystemTitle')}
						</h3>
					</div>

					<div class="relative z-10 flex flex-col gap-5">
						<SelectField
							label={t('generalSettings.defaultPenalty')}
							value={config.defaultPenalty}
							onChange={(v) => updateField('defaultPenalty', v)}
							options={[
								{ value: 'delete', label: t('generalSettings.optDelete') },
								{ value: 'mute_1h', label: t('generalSettings.optMute1h') },
								{ value: 'mute_24h', label: t('generalSettings.optMute24h') },
								{ value: 'kick', label: t('generalSettings.optKick') },
								{ value: 'ban', label: t('generalSettings.optBan') },
							]}
							description={t('generalSettings.defaultPenaltyDesc')}
						/>

						<SettingsSection
							title={t('generalSettings.autoWarning')}
							description={t('generalSettings.autoWarningDesc')}
							enabled={config.autoWarning}
							onToggle={(v) => updateField('autoWarning', v)}
						/>

						<Show when={config.autoWarning}>
							{/* Warning Threshold & Retention Controls */}
							<div class="bg-[#08090D] rounded-[18px] border border-white/5 p-4 flex flex-col gap-4">
								<div class="grid grid-cols-2 gap-3">
									<div class="flex flex-col gap-1.5">
										<div class="text-[11px] font-bold text-white/60 uppercase tracking-wider">
											{t('generalSettings.warningThresholdLabel')}
										</div>
										<div class="relative flex items-center">
											<input
												type="number"
												min="1"
												max="50"
												value={config.warningThreshold}
												onInput={(e) =>
													updateField('warningThreshold', parseInt(e.currentTarget.value, 10) || 3)
												}
												class="w-full h-11 bg-[#12141C] border border-white/10 text-white font-mono font-bold text-[14px] rounded-[12px] px-3 focus:outline-none focus:border-[#10b981]/50 text-center"
												dir="ltr"
											/>
											<span class="absolute right-3 text-[11px] text-white/40 pointer-events-none font-bold">
												{t('generalSettings.strikes')}
											</span>
										</div>
									</div>
									<div class="flex flex-col gap-1.5">
										<div class="text-[11px] font-bold text-white/60 uppercase tracking-wider">
											{t('generalSettings.warningRetentionLabel')}
										</div>
										<div class="relative flex items-center">
											<input
												type="number"
												min="1"
												max="365"
												value={config.warningRetention}
												onInput={(e) =>
													updateField('warningRetention', parseInt(e.currentTarget.value, 10) || 7)
												}
												class="w-full h-11 bg-[#12141C] border border-white/10 text-white font-mono font-bold text-[14px] rounded-[12px] px-3 focus:outline-none focus:border-[#10b981]/50 text-center"
												dir="ltr"
											/>
											<span class="absolute right-3 text-[11px] text-white/40 pointer-events-none font-bold">
												{t('generalSettings.days')}
											</span>
										</div>
									</div>
								</div>

								<div class="flex flex-col gap-1.5">
									<div class="text-[11px] font-bold text-white/60 uppercase tracking-wider">
										{t('generalSettings.warningFinalPenaltyLabel')}
									</div>
									<select
										value={config.warningFinalPenalty}
										onChange={(e) => updateField('warningFinalPenalty', e.currentTarget.value)}
										class="w-full h-11 bg-[#12141C] border border-white/10 text-white text-[13px] font-bold rounded-[12px] px-3 focus:outline-none focus:border-[#10b981]/50"
									>
										<option value="mute_1h">{t('generalSettings.optMute1h')}</option>
										<option value="mute_24h">{t('generalSettings.optMute24h')}</option>
										<option value="kick">{t('generalSettings.optKick')}</option>
										<option value="ban">{t('generalSettings.optBan')}</option>
									</select>
								</div>
							</div>
						</Show>
					</div>
				</div>

				{/* ═══════ SECURITY & ANTI-RAID ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4 mt-2">
					<div class="absolute -left-6 -bottom-6 w-24 h-24 bg-[#ff4a4a]/10 blur-2xl rounded-full pointer-events-none" />
					<div class="flex items-center gap-2 mb-1 relative z-10">
						<span class="material-symbols-outlined text-[20px] text-[#ff4a4a]">shield</span>
						<h3 class="text-[13px] font-black text-[#ff4a4a] uppercase tracking-widest">
							{t('generalSettings.securitySection')}
						</h3>
					</div>

					<div class="relative z-10 flex flex-col gap-5">
						<SettingsSection
							title={t('generalSettings.casProtection')}
							description={t('generalSettings.casProtectionDesc')}
							enabled={config.casEnabled}
							onToggle={(v) => updateField('casEnabled', v)}
						/>

						<div class="grid grid-cols-2 gap-3.5">
							<div class="flex flex-col gap-1.5">
								<div class="text-[11px] font-bold text-white/50 px-1 uppercase tracking-wider">
									{t('generalSettings.antiRaidThreshold')}
								</div>
								<input
									type="number"
									value={config.antiRaidThreshold}
									onInput={(e) =>
										updateField('antiRaidThreshold', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-12 bg-[#08090D] border border-white/5 text-white text-[13px] font-mono font-bold rounded-[14px] px-4 focus:outline-none focus:border-[#ff4a4a]/50 transition-colors shadow-inner text-center"
									dir="ltr"
								/>
							</div>
							<div class="flex flex-col gap-1.5">
								<div class="text-[11px] font-bold text-white/50 px-1 uppercase tracking-wider">
									{t('generalSettings.antiRaidAction')}
								</div>
								<select
									value={config.antiRaidAction}
									onChange={(e) => updateField('antiRaidAction', e.currentTarget.value)}
									class="w-full h-12 bg-[#08090D] border border-white/5 text-white text-[13px] font-bold rounded-[14px] px-3 focus:outline-none focus:border-[#ff4a4a]/50 transition-colors shadow-inner"
								>
									<option value="none">{t('generalSettings.antiRaidOff')}</option>
									<option value="lockdown">{t('generalSettings.antiRaidLockdown')}</option>
									<option value="alert">{t('generalSettings.antiRaidAlert')}</option>
								</select>
							</div>
						</div>
					</div>
				</div>
			</div>

			<SettingsGuard
				isDirty={isDirty()}
				isSaving={isSaving()}
				showSheet={showUnsavedSheet()}
				onSave={handleSave}
				onDiscard={handleDiscard}
				onCloseSheet={() => setShowUnsavedSheet(false)}
				saveLabel={t('generalSettings.saveSettings')}
			/>
		</div>
	);
};
