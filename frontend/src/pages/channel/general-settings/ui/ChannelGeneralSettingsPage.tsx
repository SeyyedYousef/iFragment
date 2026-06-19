import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, locale, t } from '@/shared/i18n/index.js';
import { showConfirm } from '@/shared/lib/telegram-native.js';
import { ChannelContextBar } from '@/shared/ui/ChannelContextBar.js';
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

	// Input Channel
	inputChannelId: string;
	inputChannelName: string;
	inputChannelBio: string;
	inputChannelPhotoUrl: string;
	inputChannelUsername: string;
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
	
	inputChannelId: '',
	inputChannelName: '',
	inputChannelBio: '',
	inputChannelPhotoUrl: '',
	inputChannelUsername: '',
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

				let inputGeneral: any = {};
				let inputChannelId = '';
				try {
					const funnel = await channelApi.getFunnel(channelId);
					if (funnel && funnel.input_channel_id) {
						inputChannelId = funnel.input_channel_id;
						const inputSettings = await channelApi.getSettings(funnel.input_channel_id);
						inputGeneral = inputSettings.general || {};
					}
				} catch (err) {
					console.warn('Failed to fetch funnel/input channel settings', err);
				}

				const merged: ChannelConfig = {
					...defaultConfig,
					language: apiGeneral.language || defaultConfig.language,
					timezone: apiGeneral.timezone || defaultConfig.timezone,
					signMessages: apiGeneral.signMessages ?? defaultConfig.signMessages,
					customSignature: apiGeneral.customSignature || defaultConfig.customSignature,
					autoForward: apiGeneral.autoForward ?? defaultConfig.autoForward,
					forwardDestination: apiGeneral.forwardDestination || defaultConfig.forwardDestination,
					disableReactions: apiGeneral.disableReactions ?? defaultConfig.disableReactions,
					channelName: apiGeneral.name || (apiGeneral as any).channelName || defaultConfig.channelName,
					channelBio: apiGeneral.description || (apiGeneral as any).channelBio || defaultConfig.channelBio,
					channelPhotoUrl:
						apiGeneral.photo || (apiGeneral as any).channelPhotoUrl || defaultConfig.channelPhotoUrl,
					channelUsername:
						apiGeneral.username || (apiGeneral as any).channelUsername || defaultConfig.channelUsername,
					adminProfileDisplay:
						apiGeneral.showAdminProfile ??
						(apiGeneral as any).adminProfileDisplay ??
						defaultConfig.adminProfileDisplay,
					hideHistory: apiGeneral.hideChatHistory ?? (apiGeneral as any).hideHistory ?? defaultConfig.hideHistory,
					hideMemberList: apiGeneral.hideMemberList ?? defaultConfig.hideMemberList,
					telegramAntiSpam:
						apiGeneral.antiSpam ?? (apiGeneral as any).telegramAntiSpam ?? defaultConfig.telegramAntiSpam,
					slowMode: String(apiGeneral.slowMode ?? 0),
					autoDeleteTimer: String(apiGeneral.autoDelete ?? (apiGeneral as any).autoDeleteTimer ?? 0),
					discussionGroup: apiGeneral.discussionGroupId || (apiGeneral as any).discussionGroup || '',
					approveAccountAge:
						(apiGeneral.joinReqAge ?? 0) > 0 ||
						(apiGeneral as any).approveAccountAge ||
						defaultConfig.approveAccountAge,
					approveProfilePhoto:
						apiGeneral.joinReqPhoto ??
						(apiGeneral as any).approveProfilePhoto ??
						defaultConfig.approveProfilePhoto,
					joinRequestsEnabled:
						(apiGeneral as any).joinRequestsEnabled ?? defaultConfig.joinRequestsEnabled,
					approvePremium: (apiGeneral as any).approvePremium ?? defaultConfig.approvePremium,
					approveGifts: (apiGeneral as any).approveGifts ?? defaultConfig.approveGifts,
					approveCollectibles:
						(apiGeneral as any).approveCollectibles ?? defaultConfig.approveCollectibles,
						
					inputChannelId,
					inputChannelName: inputGeneral.name || inputGeneral.channelName || '',
					inputChannelBio: inputGeneral.description || inputGeneral.channelBio || '',
					inputChannelPhotoUrl: inputGeneral.photo || inputGeneral.channelPhotoUrl || '',
					inputChannelUsername: inputGeneral.username || inputGeneral.channelUsername || '',
				};

				setConfig(reconcile(merged));
				return settings;
			} catch (error) {
				showToast(
					locale() === 'fa' ? 'خطا در بارگیری تنظیمات' : 'Failed to load settings',
					'error',
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

	const buildGeneralPayload = () => {
		const username = config.channelUsername.replace(/^@/, '').trim();
		const slowMode = Number(config.slowMode) || 0;
		const autoDelete = Number(config.autoDeleteTimer) || 0;

		return {
			language: config.language,
			timezone: config.timezone,
			signMessages: config.signMessages,
			customSignature: config.customSignature,
			autoForward: config.autoForward,
			forwardDestination: config.forwardDestination.trim(),
			disableReactions: config.disableReactions,
			name: config.channelName.trim(),
			description: config.channelBio.trim(),
			photo: config.channelPhotoUrl.trim(),
			username,
			showAdminProfile: config.adminProfileDisplay,
			hideChatHistory: config.hideHistory,
			hideMemberList: config.hideMemberList,
			antiSpam: config.telegramAntiSpam,
			slowMode,
			autoDelete,
			discussionGroupId: config.discussionGroup.trim() || null,
			joinReqAge: config.approveAccountAge ? 1 : 0,
			joinReqPhoto: config.approveProfilePhoto,
			joinRequestsEnabled: config.joinRequestsEnabled,
			approvePremium: config.approvePremium,
			approveGifts: config.approveGifts,
			approveCollectibles: config.approveCollectibles,
			channelName: config.channelName.trim(),
			channelBio: config.channelBio.trim(),
			channelPhotoUrl: config.channelPhotoUrl.trim(),
			channelUsername: username,
			adminProfileDisplay: config.adminProfileDisplay,
			hideHistory: config.hideHistory,
			telegramAntiSpam: config.telegramAntiSpam,
			autoDeleteTimer: String(autoDelete),
			discussionGroup: config.discussionGroup.trim(),
			approveAccountAge: config.approveAccountAge,
			approveProfilePhoto: config.approveProfilePhoto,
		};
	};

	const handleSave = async () => {
		if (!isDirty()) return;
		setIsSaving(true);
		try {
			await channelApi.updateSettings(
				params.id,
				'general',
				buildGeneralPayload(),
				settingsVersion(),
			);

			if (config.inputChannelId) {
				const inputUsername = config.inputChannelUsername.replace(/^@/, '').trim();
				const inputPayload = {
					name: config.inputChannelName.trim(),
					description: config.inputChannelBio.trim(),
					photo: config.inputChannelPhotoUrl.trim(),
					username: inputUsername,
					channelName: config.inputChannelName.trim(),
					channelBio: config.inputChannelBio.trim(),
					channelPhotoUrl: config.inputChannelPhotoUrl.trim(),
					channelUsername: inputUsername,
				};
				await channelApi.updateSettings(
					config.inputChannelId,
					'general',
					inputPayload,
					1, // We might not have the correct version for the input channel, but it's usually fine
				);
			}

			// We need to fetch the new version
			const freshSettings = await channelApi.getSettings(params.id);
			setSettingsVersion(freshSettings.version || 1);
			
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
				<ChannelContextBar channelId={params.id} />

				<Show
					when={!settingsData.loading}
					fallback={
						<div class="flex justify-center items-center py-10">
							<span class="w-8 h-8 border-4 border-[#32ade6]/30 border-t-[#32ade6] rounded-full animate-spin"></span>
						</div>
					}
				>
					<Show when={config.inputChannelId}>
						<Motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.01 }}
							class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4 mb-2"
						>
							<h2 class="text-[16px] font-bold text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-[#32ade6] text-[20px]">input</span>{' '}
								{isRtl() ? 'هویت کانال ورودی' : 'Input Channel Identity'}
							</h2>

							<div class="flex items-start gap-4">
								<div class="relative group shrink-0">
									<div class="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#32ade6]/20 to-[#2b96c8]/20 flex items-center justify-center border-2 border-[#2a2a2a] cursor-pointer">
										<Show
											when={config.inputChannelPhotoUrl}
											fallback={
												<span class="text-[20px] font-black text-[#32ade6]">
													{config.inputChannelName.charAt(0) || '?'}
												</span>
											}
										>
											<img src={config.inputChannelPhotoUrl} class="w-full h-full object-cover" alt="Avatar" />
										</Show>
										<div class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
											<span class="material-symbols-outlined text-white text-[20px]">photo_camera</span>
										</div>
										<input
											type="file"
											accept="image/png, image/jpeg, image/jpg"
											class="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-[0px] font-[0px]"
											onChange={(e) => {
												const file = e.currentTarget.files?.[0];
												if (file) {
													const reader = new FileReader();
													reader.onload = (event) => {
														if (event.target?.result) {
															updateField('inputChannelPhotoUrl', event.target.result as string);
															hapticFeedback.notificationOccurred('success');
														}
													};
													reader.readAsDataURL(file);
												}
											}}
										/>
									</div>
									<Show when={config.inputChannelPhotoUrl}>
										<button
											onClick={() => {
												updateField('inputChannelPhotoUrl', '');
												hapticFeedback.notificationOccurred('warning');
											}}
											class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#ff3b30] text-white flex items-center justify-center hover:bg-[#d63025] active:scale-90 transition-all border-2 border-[#1c1c1c]"
											title={t('common.delete' as any) || 'Delete'}
										>
											<span class="material-symbols-outlined text-[14px]">close</span>
										</button>
									</Show>
								</div>
								<div class="flex flex-col gap-2 flex-1 min-w-0">
									<div class="flex flex-col gap-1">
										<label class="text-[11px] text-on-surface-variant ml-1 font-semibold">
											{t('channelSettings.channelName')}
										</label>
										<input
											type="text"
											value={config.inputChannelName}
											onInput={(e) => updateField('inputChannelName', e.currentTarget.value)}
											placeholder={t('channelSettings.channelNamePlaceholder')}
											class="bg-[#2c2c2e] text-white text-[14px] rounded-xl px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6] placeholder-[#a0a4ad]"
										/>
									</div>
									<div class="flex flex-col gap-1">
										<label class="text-[11px] text-on-surface-variant ml-1 font-semibold">
											{t('channelSettings.channelUsername') || 'Username'}
										</label>
										<input
											type="text"
											value={config.inputChannelUsername}
											onInput={(e) => updateField('inputChannelUsername', e.currentTarget.value)}
											placeholder="@channel"
											class="bg-[#2c2c2e] text-white text-[14px] rounded-xl px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6] placeholder-[#a0a4ad]"
											dir="ltr"
										/>
									</div>
								</div>
							</div>
						</Motion.div>
					</Show>

					{/* Identity Section - RESTRICTED TO NAME AND PHOTO ONLY */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.02 }}
						class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4"
					>
						<h2 class="text-[16px] font-bold text-white flex items-center gap-2">
							<span class="material-symbols-outlined text-[#32ade6] text-[20px]">output</span>{' '}
							{isRtl() ? 'هویت کانال خروجی' : 'Output Channel Identity'}
						</h2>

						<div class="flex items-start gap-4">
							<div class="relative group shrink-0">
								<div class="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#32ade6]/20 to-[#2b96c8]/20 flex items-center justify-center border-2 border-[#2a2a2a] cursor-pointer">
									<Show
										when={config.channelPhotoUrl}
										fallback={
											<span class="text-[20px] font-black text-[#32ade6]">
												{config.channelName.charAt(0) || '?'}
											</span>
										}
									>
										<img src={config.channelPhotoUrl} class="w-full h-full object-cover" alt="Avatar" />
									</Show>
									<div class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
										<span class="material-symbols-outlined text-white text-[20px]">photo_camera</span>
									</div>
									<input
										type="file"
										accept="image/png, image/jpeg, image/jpg"
										class="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-[0px] font-[0px]"
										onChange={(e) => {
											const file = e.currentTarget.files?.[0];
											if (file) {
												const reader = new FileReader();
												reader.onload = (event) => {
													if (event.target?.result) {
														updateField('channelPhotoUrl', event.target.result as string);
														hapticFeedback.notificationOccurred('success');
													}
												};
												reader.readAsDataURL(file);
											}
										}}
									/>
								</div>
								<Show when={config.channelPhotoUrl}>
									<button
										onClick={() => {
											updateField('channelPhotoUrl', '');
											hapticFeedback.notificationOccurred('warning');
										}}
										class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#ff3b30] text-white flex items-center justify-center hover:bg-[#d63025] active:scale-90 transition-all border-2 border-[#1c1c1c]"
										title={t('common.delete' as any) || 'Delete'}
									>
										<span class="material-symbols-outlined text-[14px]">close</span>
									</button>
								</Show>
							</div>
							<div class="flex flex-col gap-2 flex-1 min-w-0">
								<div class="flex flex-col gap-1">
									<label class="text-[11px] text-on-surface-variant ml-1 font-semibold">
										{t('channelSettings.channelName')}
									</label>
									<input
										type="text"
										value={config.channelName}
										onInput={(e) => updateField('channelName', e.currentTarget.value)}
										placeholder={t('channelSettings.channelNamePlaceholder')}
										class="bg-[#2c2c2e] text-white text-[14px] rounded-xl px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6] placeholder-[#a0a4ad]"
									/>
								</div>
								<div class="flex flex-col gap-1">
									<label class="text-[11px] text-on-surface-variant ml-1 font-semibold">
										{t('channelSettings.channelUsername') || 'Username'}
									</label>
									<input
										type="text"
										value={config.channelUsername}
										onInput={(e) => updateField('channelUsername', e.currentTarget.value)}
										placeholder="@channel"
										class="bg-[#2c2c2e] text-white text-[14px] rounded-xl px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6] placeholder-[#a0a4ad]"
										dir="ltr"
									/>
								</div>
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
								{ value: 'ar', label: 'العربية (Arabic)' },
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
									<span class="material-symbols-outlined text-[#ff9f0a] text-[20px]">
										person_add
									</span>{' '}
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
