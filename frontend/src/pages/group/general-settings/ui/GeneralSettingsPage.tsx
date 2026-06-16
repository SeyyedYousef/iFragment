import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/shared/api/bot-management.js';
import { t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
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
}

const defaultConfig: GeneralConfig = {
	language: 'en',
	timezone: 'UTC',
	welcomeMessage: true,
	warningMessage: true,
	autoDeleteBot: false,
	autoDeleteDelay: 30,
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
};

export const GeneralSettingsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const [config, setConfig] = createStore<GeneralConfig>({ ...defaultConfig });

	createResource(
		() => params.id,
		async (groupId) => {
			const settings = await groupApi.getSettings(groupId);
			setSettingsVersion(settings.version);
			const general = (settings.general || {}) as Partial<GeneralConfig>;
			const merged = { ...defaultConfig, ...general };
			setConfig(reconcile(merged));
			return settings;
		},
	);

	const handleBack = () => {
		if (isDirty()) {
			const confirmDiscard = window.confirm(
				t('common.unsavedChangesConfirm') ||
					'You have unsaved changes. Are you sure you want to discard them?',
			);
			if (!confirmDiscard) return;
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
		if (!isDirty()) return;
		setIsSaving(true);
		try {
			const result = await groupApi.updateSettings(
				params.id,
				'general',
				config as any,
				settingsVersion(),
			);
			setSettingsVersion(result.version);
			setIsDirty(false);
			hapticFeedback.notificationOccurred('success');
			showToast(t('common.settingsSaved') || 'Settings saved successfully', 'success');
			navigate(`/group/${params.id}`);
		} catch (_e: any) {
			hapticFeedback.notificationOccurred('error');
			showToast(t('common.errorUpdateFailed') || 'Failed to update settings', 'error');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white">
			{/* Header */}
			<div class="px-5 pt-6 pb-4 bg-[#0f1014] sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center justify-between gap-3">
				<div class="flex items-center gap-2 overflow-hidden flex-1">
					<button
						onClick={() => {
							hapticFeedback.impactOccurred('light');
							handleBack();
						}}
						class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
						aria-label="Back"
					>
						<span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2">
							<h1 class="text-[18px] font-black text-white leading-tight truncate">
								{t('generalSettings.title')}
							</h1>
							<Show when={isDirty()}>
								<span
									class="w-2.5 h-2.5 rounded-full bg-[#ff9f0a] animate-pulse shrink-0"
									title="Unsaved changes"
								/>
							</Show>
						</div>
						<span class="text-[12px] text-on-surface-variant truncate">
							{t('generalSettings.description')}
						</span>
					</div>
				</div>

				<button
					onClick={() => setIsMenuOpen(true)}
					class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-95 transition-all shrink-0"
					aria-label="Open menu"
				>
					<span class="material-symbols-outlined text-white text-[20px]">menu</span>
				</button>
			</div>

			<HamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				groupId={params.id}
				activeTab="general"
			/>

			<div class="px-5 pt-6 flex flex-col gap-6">
				{/* Bot Language */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.02 }}
				>
					<SelectField
						label="Bot Language"
						value={config.language}
						onChange={(v) => updateField('language', v)}
						options={[
							{ value: 'en', label: 'English' },
							{ value: 'fa', label: 'فارسی (Persian)' },
							{ value: 'ru', label: 'Русский (Russian)' },
							{ value: 'ar', label: 'العربية (Arabic)' },
						]}
					/>
					<p class="mt-2 text-[11px] text-on-surface-variant px-1">
						Select the language the bot will use for all group notifications and responses.
					</p>
				</Motion.div>

				{/* Bot Enabled */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.03 }}
				>
					<SettingsSection
						title={t('generalSettings.botEnabled') || 'Bot Enabled'}
						description={
							t('generalSettings.botEnabledDesc') ||
							'Turn off to completely disable the bot in this group without kicking it.'
						}
						enabled={config.botEnabled}
						onToggle={(v) => updateField('botEnabled', v)}
					/>
				</Motion.div>

				{/* Time Zone */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.05 }}
				>
					<SelectField
						label={t('generalSettings.timeZone')}
						value={config.timezone}
						onChange={(v) => updateField('timezone', v)}
						options={[
							{ value: 'UTC', label: 'UTC (GMT+0)' },
							{ value: 'Europe/Moscow', label: 'Europe/Moscow (GMT+3)' },
							{ value: 'Asia/Tehran', label: 'Asia/Tehran (GMT+3:30)' },
							{ value: 'Asia/Dubai', label: 'Asia/Dubai (GMT+4)' },
							{ value: 'Asia/Shanghai', label: 'Asia/Shanghai (GMT+8)' },
							{ value: 'Europe/London', label: 'Europe/London (GMT+1)' },
							{ value: 'America/New_York', label: 'America/New York (GMT-4)' },
						]}
						description={t('generalSettings.timeZoneDesc')}
					/>
				</Motion.div>

				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
				>
					<SettingsSection
						title={t('generalSettings.welcomeMessage')}
						description={t('generalSettings.welcomeMessageDesc')}
						enabled={config.welcomeMessage}
						onToggle={(v) => updateField('welcomeMessage', v)}
						hasEditText={true}
						onEditText={() => navigate(`/group/${params.id}/settings/custom-texts`)}
					/>
				</Motion.div>

				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.15 }}
				>
					<SettingsSection
						title={t('generalSettings.warningMessage')}
						description={t('generalSettings.warningMessageDesc')}
						enabled={config.warningMessage}
						onToggle={(v) => updateField('warningMessage', v)}
						hasEditText={true}
						onEditText={() => navigate(`/group/${params.id}/settings/custom-texts`)}
					/>
				</Motion.div>

				{/* Auto-delete bot messages */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
					class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3"
				>
					<div class="flex items-center justify-between gap-3">
						<div class="flex flex-col flex-1 min-w-0">
							<span class="text-[15px] font-bold text-white">
								{t('generalSettings.autoDeleteBot')}
							</span>
							<span class="text-[12px] text-on-surface-variant leading-snug">
								{t('generalSettings.autoDeleteBotDesc')}
							</span>
						</div>
						<ToggleSwitch
							checked={config.autoDeleteBot}
							onChange={(v) => updateField('autoDeleteBot', v)}
						/>
					</div>
					<Show when={config.autoDeleteBot}>
						<div class="flex items-center gap-3 mt-2">
							<input
								type="number"
								inputMode="numeric"
								min="0"
								value={config.autoDeleteDelay}
								onInput={(e) =>
									updateField('autoDeleteDelay', parseInt(e.currentTarget.value, 10) || 0)
								}
								class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-2 w-24 text-center focus:outline-none focus:ring-2 focus:ring-[#3390ec] placeholder-[#a0a4ad]"
							/>
							<span class="text-[14px] font-bold text-[#a0a4ad]">
								{t('generalSettings.seconds')}
							</span>
						</div>
					</Show>
				</Motion.div>

				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.25 }}
					class="flex flex-col gap-2"
				>
					<SettingsSection
						title={t('generalSettings.trackAdmin')}
						description={t('generalSettings.trackAdminDesc')}
						enabled={config.trackAdmin}
						onToggle={(v) => updateField('trackAdmin', v)}
					/>
				</Motion.div>

				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
				>
					<SettingsSection
						title={t('generalSettings.verifyMembers')}
						description={t('generalSettings.verifyMembersDesc')}
						enabled={config.verifyMembers}
						onToggle={(v) => updateField('verifyMembers', v)}
					/>
				</Motion.div>

				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
				>
					<SettingsSection
						title={t('generalSettings.publicCommands')}
						description={t('generalSettings.publicCommandsDesc')}
						enabled={config.publicCommands}
						onToggle={(v) => updateField('publicCommands', v)}
					/>
				</Motion.div>

				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
				>
					<SettingsSection
						title={t('generalSettings.hideJoinLeave')}
						description={t('generalSettings.hideJoinLeaveDesc')}
						enabled={config.hideJoinLeave}
						onToggle={(v) => updateField('hideJoinLeave', v)}
					/>
				</Motion.div>

				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.35 }}
				>
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
				</Motion.div>

				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.4 }}
					class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3"
				>
					<div class="flex items-center justify-between gap-3">
						<div class="flex flex-col flex-1 min-w-0">
							<span class="text-[15px] font-bold text-white">
								{t('generalSettings.autoWarning')}
							</span>
							<span class="text-[12px] text-[#a0a4ad] leading-snug">
								{t('generalSettings.autoWarningDesc')}
							</span>
						</div>
						<ToggleSwitch
							checked={config.autoWarning}
							onChange={(v) => updateField('autoWarning', v)}
						/>
					</div>

					<Show when={config.autoWarning}>
						<div class="h-[1px] bg-[#2a2a2a] w-full my-2"></div>
						<div class="grid grid-cols-2 gap-4">
							<div class="flex flex-col gap-1.5">
								<label class="text-[13px] font-bold text-white">
									{t('generalSettings.threshold')}
								</label>
								<div class="relative">
									<input
										type="number"
										inputMode="numeric"
										min="1"
										value={config.warningThreshold}
										onInput={(e) =>
											updateField('warningThreshold', parseInt(e.currentTarget.value, 10) || 3)
										}
										class="w-full bg-[#2c2c2e] text-white text-[15px] rounded-xl py-2 px-4 focus:outline-none focus:ring-2 focus:ring-[#3390ec]"
									/>
								</div>
							</div>
							<div class="flex flex-col gap-1.5">
								<label class="text-[13px] font-bold text-white">
									{t('generalSettings.retention')}
								</label>
								<div class="relative">
									<input
										type="number"
										inputMode="numeric"
										min="1"
										value={config.warningRetention}
										onInput={(e) =>
											updateField('warningRetention', parseInt(e.currentTarget.value, 10) || 7)
										}
										class="w-full bg-[#2c2c2e] text-white text-[15px] rounded-xl py-2 px-4 focus:outline-none focus:ring-2 focus:ring-[#3390ec]"
									/>
								</div>
							</div>
						</div>

						<div class="mt-2">
							<SelectField
								label={t('generalSettings.finalPenalty')}
								value={config.warningFinalPenalty}
								onChange={(v) => updateField('warningFinalPenalty', v)}
								options={[
									{ value: 'mute_24h', label: t('generalSettings.optMute24h') },
									{ value: 'kick', label: t('generalSettings.optKick') },
									{ value: 'ban', label: t('generalSettings.optBan') },
								]}
							/>
						</div>
					</Show>
				</Motion.div>

				<div class="h-[1px] bg-[#2a2a2a] w-full my-1"></div>

				{/* CAS Protection */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.45 }}
				>
					<SettingsSection
						title={t('generalSettings.casProtection')}
						description={t('generalSettings.casProtectionDesc')}
						enabled={config.casEnabled}
						onToggle={(v) => updateField('casEnabled', v)}
					/>
				</Motion.div>

				{/* Anti-Raid Section */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.5 }}
					class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3"
				>
					<div class="flex items-center justify-between gap-3">
						<div class="flex flex-col flex-1 min-w-0">
							<span class="text-[15px] font-bold text-white">{t('generalSettings.antiRaid')}</span>
							<span class="text-[12px] text-[#a0a4ad] leading-snug">
								{t('generalSettings.antiRaidDesc')}
							</span>
						</div>
					</div>

					<div class="h-[1px] bg-[#2a2a2a] w-full my-1"></div>

					<div class="grid grid-cols-2 gap-4">
						<div class="flex flex-col gap-1.5">
							<label class="text-[13px] font-bold text-white">
								{t('generalSettings.antiRaidThreshold')}
							</label>
							<input
								type="number"
								inputMode="numeric"
								min="0"
								value={config.antiRaidThreshold}
								onInput={(e) =>
									updateField('antiRaidThreshold', parseInt(e.currentTarget.value, 10) || 0)
								}
								placeholder="Joins / min"
								class="w-full bg-[#2c2c2e] text-white text-[15px] rounded-xl py-2 px-4 focus:outline-none focus:ring-2 focus:ring-[#3390ec]"
							/>
						</div>
						<div class="flex flex-col gap-1.5">
							<label class="text-[13px] font-bold text-white">
								{t('generalSettings.antiRaidAction')}
							</label>
							<select
								value={config.antiRaidAction}
								onChange={(e) => updateField('antiRaidAction', e.currentTarget.value)}
								class="w-full bg-[#2c2c2e] text-white text-[15px] rounded-xl py-2 px-4 focus:outline-none focus:ring-2 focus:ring-[#3390ec] appearance-none"
							>
								<option value="none">{t('generalSettings.antiRaidOff')}</option>
								<option value="lockdown">{t('generalSettings.antiRaidLockdown')}</option>
								<option value="alert">{t('generalSettings.antiRaidAlert')}</option>
							</select>
						</div>
					</div>
					<span class="text-[11px] text-[#a0a4ad]">{t('generalSettings.antiRaidNote')}</span>
				</Motion.div>
			</div>

			{/* Save Button */}
			<Show when={isDirty()}>
				<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/90 to-transparent z-40 flex gap-3">
					<button
						onClick={() => handleBack()}
						disabled={isSaving()}
						class="flex-1 h-14 bg-[#1c1c1c] text-[#ff3b30] border border-[#ff3b30]/20 rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 hover:bg-[#ff3b30]/10"
					>
						{t('common.cancel')}
						<span class="material-symbols-outlined text-[18px]">close</span>
					</button>
					<button
						onClick={handleSave}
						disabled={isSaving()}
						class="flex-[2] h-14 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-2xl font-bold text-[16px] shadow-[0_10px_25px_rgba(51,144,236,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
					>
						<Show
							when={!isSaving()}
							fallback={
								<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
							}
						>
							{t('generalSettings.saveSettings')}
							<span class="material-symbols-outlined text-[20px]">save</span>
						</Show>
					</button>
				</div>
			</Show>
		</div>
	);
};
