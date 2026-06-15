import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { createStore, reconcile, unwrap } from 'solid-js/store';
import { channelApi } from '@/shared/api/channel-management.js';
import { locale, t } from '@/shared/i18n/index.js';
import { showConfirm } from '@/shared/lib/telegram-native.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { SelectField, SettingsSection, ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

interface ChannelConfig {
	// Original
	language: string;
	timezone: string;
	signMessages: boolean;
	customSignature: string;
	autoForward: boolean;
	forwardDestination: string;
	disableReactions: boolean;
	joinRequestsEnabled: boolean;
	approvePremium: boolean;
	approveGifts: boolean;
	approveCollectibles: boolean;

	// Added for Phase 1
	channelName: string;
	channelBio: string;
	channelPhotoUrl: string;
	channelUsername: string;
	adminProfileDisplay: boolean;
	hideHistory: boolean;
	hideMemberList: boolean;
	telegramAntiSpam: boolean;
	slowMode: string;
	autoDeleteTimer: string;
	discussionGroup: string;
	approveAccountAge: boolean;
	approveProfilePhoto: boolean;
}

const defaultConfig: ChannelConfig = {
	language: 'en',
	timezone: 'UTC',
	signMessages: true,
	customSignature: '— Admin',
	autoForward: false,
	forwardDestination: '',
	disableReactions: false,
	joinRequestsEnabled: false,
	approvePremium: false,
	approveGifts: false,
	approveCollectibles: false,

	channelName: '',
	channelBio: '',
	channelPhotoUrl: '',
	channelUsername: '',
	adminProfileDisplay: false,
	hideHistory: true,
	hideMemberList: true,
	telegramAntiSpam: true,
	slowMode: '0',
	autoDeleteTimer: '0',
	discussionGroup: '',
	approveAccountAge: false,
	approveProfilePhoto: false,
};

export const ChannelGeneralSettingsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const [config, setConfig] = createStore<ChannelConfig>({ ...defaultConfig });

	const [settingsData] = createResource(
		() => params.id,
		async (channelId) => {
			try {
				const settings = await channelApi.getSettings(channelId);
				setSettingsVersion(settings.version || 1);
				const apiGeneral = settings.general || {};

				const merged: ChannelConfig = {
					...defaultConfig,
					language: apiGeneral.language || defaultConfig.language,
					timezone: apiGeneral.timezone || defaultConfig.timezone,
					signMessages: apiGeneral.signMessages ?? defaultConfig.signMessages,
					customSignature: apiGeneral.customSignature || defaultConfig.customSignature,
					autoForward: apiGeneral.autoForward ?? defaultConfig.autoForward,
					forwardDestination: apiGeneral.forwardDestination || defaultConfig.forwardDestination,
					disableReactions: apiGeneral.disableReactions ?? defaultConfig.disableReactions,
					channelName: apiGeneral.name || defaultConfig.channelName,
					channelBio: apiGeneral.description || defaultConfig.channelBio,
					channelPhotoUrl: apiGeneral.photo || defaultConfig.channelPhotoUrl,
					channelUsername: apiGeneral.username || defaultConfig.channelUsername,
					adminProfileDisplay: apiGeneral.showAdminProfile ?? defaultConfig.adminProfileDisplay,
					hideHistory: apiGeneral.hideChatHistory ?? defaultConfig.hideHistory,
					hideMemberList: apiGeneral.hideMemberList ?? defaultConfig.hideMemberList,
					telegramAntiSpam: apiGeneral.antiSpam ?? defaultConfig.telegramAntiSpam,
					slowMode: String(apiGeneral.slowMode || 0),
					autoDeleteTimer: String(apiGeneral.autoDelete || 0),
					discussionGroup: apiGeneral.discussionGroupId || '',
					approveAccountAge: apiGeneral.joinReqAge > 0,
					approveProfilePhoto: apiGeneral.joinReqPhoto ?? defaultConfig.approveProfilePhoto,
					joinRequestsEnabled:
						(apiGeneral as any).joinRequestsEnabled ?? defaultConfig.joinRequestsEnabled,
					approvePremium: (apiGeneral as any).approvePremium ?? defaultConfig.approvePremium,
					approveGifts: (apiGeneral as any).approveGifts ?? defaultConfig.approveGifts,
					approveCollectibles:
						(apiGeneral as any).approveCollectibles ?? defaultConfig.approveCollectibles,
				};

				setConfig(reconcile(merged));
				return settings;
			} catch (error) {
				showToast(
					locale() === 'fa' ? 'خطا در بارگیری تنظیمات' : 'Failed to load settings',
					'error'
				);
				throw error;
			}
		},
	);

	const handleBack = async () => {
		hapticFeedback.impactOccurred('light');
		if (isDirty()) {
			hapticFeedback.notificationOccurred('warning');
			const confirmDiscard = await showConfirm(
				locale() === 'fa'
					? 'تغییرات ذخیره نشده‌ای دارید. آیا مطمئن هستید که می‌خواهید خارج شوید؟'
					: 'You have unsaved changes. Are you sure you want to exit?',
			);
			if (confirmDiscard) {
				setIsDirty(false); // Reset state to allow clean navigation
				navigate(-1);
			}
		} else {
			navigate(-1);
		}
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(handleBack);
		onCleanup(() => off());
	});

	const updateField = <K extends keyof ChannelConfig>(key: K, value: ChannelConfig[K]) => {
		setConfig(key, value);
		setIsDirty(true);
	};

	const handleSave = async () => {
		if (!isDirty()) return;
		setIsSaving(true);
		try {
			const result = await channelApi.updateSettings(
				params.id,
				'general',
				unwrap(config),
				settingsVersion(),
			);
			setSettingsVersion(result.version);
			setIsDirty(false);
			hapticFeedback.notificationOccurred('success');
			showToast(t('common.settingsSaved') || 'Settings saved successfully', 'success');
			navigate(`/channel/${params.id}`);
		} catch (e: any) {
			hapticFeedback.notificationOccurred('error');
			if (e.status === 409 || (e.response && e.response.status === 409)) {
				showToast(
					locale() === 'fa'
						? 'خطای تداخل همزمانی: این تنظیمات قبلاً توسط یکی دیگر از مدیران به‌روز شده است. لطفاً صفحه را مجدداً لود کنید.'
						: 'Conflict: These settings have been updated by another admin. Please refresh the page.',
					'error',
				);
			} else {
				showToast(
					locale() === 'fa' ? 'خطا در ذخیره‌سازی تنظیمات.' : 'Failed to save settings.',
					'error',
				);
			}
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
						onClick={handleBack}
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
								{t('channelSettings.generalSettings')}
							</h1>
							<Show when={isDirty()}>
								<span
									class="w-2.5 h-2.5 rounded-full bg-[#32ade6] animate-pulse shrink-0"
									title={t('channelSettings.unsavedChangesTooltip')}
								/>
							</Show>
						</div>
						<span class="text-[12px] text-on-surface-variant truncate">
							{t('channelSettings.manageCoreConfig')}
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

			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="general"
			/>

			<div class="px-5 pt-6 flex flex-col gap-6">
				<Show
					when={!settingsData.loading}
					fallback={
						<div class="flex justify-center items-center py-10">
							<span class="w-8 h-8 border-4 border-[#32ade6]/30 border-t-[#32ade6] rounded-full animate-spin"></span>
						</div>
					}
				>
					{/* Identity Section - RESTRICTED TO NAME AND PHOTO ONLY */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.02 }}
					class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4"
				>
					<h2 class="text-[16px] font-bold text-white flex items-center gap-2">
						<span class="material-symbols-outlined text-[#32ade6] text-[20px]">badge</span>{' '}
						{t('channelSettings.channelIdentity')}
					</h2>

					<div class="flex items-center gap-4">
						<div class="w-16 h-16 rounded-full bg-[#2c2c2e] flex items-center justify-center relative overflow-hidden group cursor-pointer shrink-0">
							<Show
								when={config.channelPhotoUrl}
								fallback={
									<span class="material-symbols-outlined text-[#a0a4ad] text-[24px]">
										add_photo_alternate
									</span>
								}
							>
								<img
									src={config.channelPhotoUrl}
									alt="Channel"
									class="w-full h-full object-cover"
								/>
							</Show>
							<div class="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
								<span class="material-symbols-outlined text-white text-[20px]">upload</span>
							</div>
						</div>
						<div class="flex flex-col gap-1 flex-1 min-w-0">
							<label class="text-[12px] text-on-surface-variant ml-1">
								{t('channelSettings.channelName')}
							</label>
							<input
								type="text"
								value={config.channelName}
								onInput={(e) => updateField('channelName', e.currentTarget.value)}
								placeholder={t('channelSettings.channelNamePlaceholder')}
								class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6] placeholder-[#a0a4ad]"
							/>
						</div>
					</div>
				</Motion.div>

				{/* Time Zone Section */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.05 }}
				>
					<SelectField
						label={t('channelSettings.timeZone')}
						value={config.timezone}
						onChange={(v) => updateField('timezone', v)}
						options={[
							{ value: 'UTC', label: 'UTC (GMT+0)' },
							{ value: 'Europe/Moscow', label: 'Europe/Moscow (GMT+3)' },
							{ value: 'Asia/Tehran', label: 'Asia/Tehran (GMT+3:30)' },
						]}
						description={t('channelSettings.timeZoneDesc')}
					/>
				</Motion.div>

				{/* Bot Language Section - RELOCATED LOWER WITH IMPROVED LAYOUT */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.08 }}
				>
					<SelectField
						label={t('channelSettings.botLanguage')}
						value={config.language}
						onChange={(v) => updateField('language', v)}
						options={[
							{ value: 'en', label: 'English' },
							{ value: 'fa', label: 'فارسی (Persian)' },
							{ value: 'ru', label: 'Русский (Russian)' },
							{ value: 'zh', label: '简体中文 (Chinese)' },
						]}
					/>
					<p class="mt-2 text-[11px] text-on-surface-variant px-1 leading-normal">
						{t('channelSettings.botLanguageDesc')}
					</p>
				</Motion.div>

				{/* Sign Messages & Custom Signature (With signature input length not restricted) */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4"
				>
					<SettingsSection
						title={t('channelSettings.signMessages')}
						description={t('channelSettings.signMessagesDesc')}
						enabled={config.signMessages}
						onToggle={(v) => updateField('signMessages', v)}
					/>
					<Show when={config.signMessages}>
						<div class="mt-1 flex flex-col gap-1.5 pl-3 border-l-2 border-[#32ade6]/30">
							<label class="text-[12px] text-on-surface-variant ml-1 font-semibold">
								{t('channelSettings.customSignature')}
							</label>
							<input
								type="text"
								value={config.customSignature || ''}
								onInput={(e) => updateField('customSignature', e.currentTarget.value)}
								placeholder={t('channelSettings.customSignaturePlaceholder')}
								class="bg-[#2c2c2e] text-white text-[14px] rounded-xl px-4 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6] placeholder-[#a0a4ad] transition-all border border-[#3a3a3c] focus:border-[#32ade6]"
							/>
						</div>
					</Show>
				</Motion.div>

				{/* Auto Forward Section */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.16 }}
					class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3"
				>
					<div class="flex items-center justify-between gap-3">
						<div class="flex flex-col flex-1 min-w-0">
							<span class="text-[15px] font-bold text-white">
								{t('channelSettings.autoForwarding')}
							</span>
							<span class="text-[12px] text-on-surface-variant leading-snug">
								{t('channelSettings.autoForwardingDesc')}
							</span>
						</div>
						<ToggleSwitch
							checked={config.autoForward}
							onChange={(v) => updateField('autoForward', v)}
						/>
					</div>
					<Show when={config.autoForward}>
						<div class="flex flex-col gap-2 mt-2">
							<label class="text-[13px] font-bold text-white">
								{t('channelSettings.destinationChatId')}
							</label>
							<input
								type="text"
								value={config.forwardDestination}
								onInput={(e) => updateField('forwardDestination', e.currentTarget.value)}
								placeholder={t('channelSettings.targetChannelPlaceholder')}
								class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6] placeholder-[#a0a4ad]"
							/>
						</div>
					</Show>
				</Motion.div>

				{/* Invite Links */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.18 }}
					class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3"
				>
					<div class="flex items-center justify-between gap-3">
						<div class="flex flex-col flex-1 min-w-0">
							<span class="text-[15px] font-bold text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-[#bf5af2] text-[20px]">link</span>{' '}
								{t('channelSettings.inviteLinks')}
							</span>
						</div>
						<button
							onClick={() => showToast(t('channelSettings.comingSoon'), 'info')}
							class="bg-[#bf5af2]/20 text-[#bf5af2] rounded-xl px-3 py-1.5 font-bold text-[13px] hover:bg-[#bf5af2]/30 transition-all flex items-center gap-1"
						>
							<span class="material-symbols-outlined text-[16px]">add</span>{' '}
							{t('channelSettings.createInviteLink')}
						</button>
					</div>

					<div class="flex flex-col gap-2 mt-2">
						<div class="bg-[#2c2c2e] rounded-xl p-6 flex flex-col items-center justify-center gap-2 border border-[#3a3a3c]">
							<span class="material-symbols-outlined text-[#a0a4ad] text-[32px]">construction</span>
							<span class="text-[14px] font-medium text-white">
								{t('channelSettings.featureComingSoon')}
							</span>
							<span class="text-[12px] text-on-surface-variant text-center max-w-[200px]">
								{t('channelSettings.inviteLinksComingSoonDesc')}
							</span>
						</div>
					</div>
				</Motion.div>

				{/* Join Requests Section */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
					class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3"
				>
					<div class="flex items-center justify-between gap-3">
						<div class="flex flex-col flex-1 min-w-0">
							<span class="text-[15px] font-bold text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-[#ff9f0a] text-[20px]">person_add</span>{' '}
								{t('channelSettings.joinRequests')}
							</span>
							<span class="text-[12px] text-on-surface-variant leading-snug mt-1">
								{t('channelSettings.joinRequestsDesc')}
							</span>
						</div>
						<ToggleSwitch
							checked={config.joinRequestsEnabled}
							onChange={(v) => updateField('joinRequestsEnabled', v)}
						/>
					</div>

					<Show when={config.joinRequestsEnabled}>
						<div class="h-[1px] bg-[#2a2a2a] w-full my-1"></div>

						<div class="flex items-center justify-between gap-3 mt-1">
							<span class="text-[14px] text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-[#32ade6] text-[18px]">verified</span>{' '}
								{t('channelSettings.filterByPremium')}
							</span>
							<ToggleSwitch
								checked={config.approvePremium}
								onChange={(v) => updateField('approvePremium', v)}
							/>
						</div>
						<div class="flex items-center justify-between gap-3 mt-1">
							<span class="text-[14px] text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-[#ff9f0a] text-[18px]">
									featured_seasonal_and_gifts
								</span>{' '}
								{t('channelSettings.filterByGifts')}
							</span>
							<ToggleSwitch
								checked={config.approveGifts}
								onChange={(v) => updateField('approveGifts', v)}
							/>
						</div>
						<div class="flex items-center justify-between gap-3 mt-1">
							<span class="text-[14px] text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-[#34c759] text-[18px]">
									account_circle
								</span>{' '}
								{t('channelSettings.filterByProfilePhoto')}
							</span>
							<ToggleSwitch
								checked={config.approveProfilePhoto}
								onChange={(v) => updateField('approveProfilePhoto', v)}
							/>
						</div>
					</Show>
				</Motion.div>
				</Show>
			</div>

			{/* Save Button */}
			<Show when={isDirty()}>
				<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/90 to-transparent z-40 flex gap-3">
					<button
						onClick={() => {
							setIsDirty(false);
							navigate(`/channel/${params.id}`);
						}}
						disabled={isSaving()}
						class="flex-1 h-14 bg-[#1c1c1c] text-[#ff3b30] border border-[#ff3b30]/20 rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 hover:bg-[#ff3b30]/10"
					>
						{t('channelSettings.cancel')}
						<span class="material-symbols-outlined text-[18px]">close</span>
					</button>
					<button
						onClick={handleSave}
						disabled={isSaving()}
						class="flex-[2] h-14 bg-[#32ade6] hover:bg-[#2b96c8] text-black rounded-2xl font-bold text-[16px] shadow-[0_10px_25px_rgba(255,159,10,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
					>
						<Show
							when={!isSaving()}
							fallback={
								<span class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
							}
						>
							{t('channelSettings.saveSettings')}
							<span class="material-symbols-outlined text-[20px]">save</span>
						</Show>
					</button>
				</div>
			</Show>
		</div>
	);
};
