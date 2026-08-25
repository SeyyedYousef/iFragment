import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { ChannelContextBar, ChannelHamburgerMenu, channelApi } from '@/entities/channel/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { showConfirm } from '@/shared/lib/telegram-native.js';
import { SelectField, SettingsSection, ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface ChannelConfig {
	language: string; timezone: string; signMessages: boolean; customSignature: string; autoForward: boolean; forwardDestination: string; disableReactions: boolean; joinRequestsEnabled: boolean; approvePremium: boolean; approveGifts: boolean; approveCollectibles: boolean;
	channelName: string; channelBio: string; channelPhotoUrl: string; channelUsername: string; adminProfileDisplay: boolean; hideHistory: boolean; hideMemberList: boolean; telegramAntiSpam: boolean; slowMode: string; autoDeleteTimer: string; discussionGroup: string; approveAccountAge: boolean; approveProfilePhoto: boolean;
	inputChannelId: string; inputChannelName: string; inputChannelBio: string; inputChannelPhotoUrl: string; inputChannelUsername: string;
}

const defaultConfig: ChannelConfig = {
	language: 'en', timezone: 'UTC', signMessages: true, customSignature: '— Admin', autoForward: false, forwardDestination: '', disableReactions: false, joinRequestsEnabled: false, approvePremium: false, approveGifts: false, approveCollectibles: false,
	channelName: '', channelBio: '', channelPhotoUrl: '', channelUsername: '', adminProfileDisplay: false, hideHistory: true, hideMemberList: true, telegramAntiSpam: true, slowMode: '0', autoDeleteTimer: '0', discussionGroup: '', approveAccountAge: false, approveProfilePhoto: false,
	inputChannelId: '', inputChannelName: '', inputChannelBio: '', inputChannelPhotoUrl: '', inputChannelUsername: '',
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
					if (funnel?.input_channel_id) {
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
					channelName: (apiGeneral as any).name || (apiGeneral as any).channelName || defaultConfig.channelName,
					channelBio: (apiGeneral as any).description || (apiGeneral as any).channelBio || defaultConfig.channelBio,
					channelPhotoUrl: (apiGeneral as any).photo || (apiGeneral as any).channelPhotoUrl || defaultConfig.channelPhotoUrl,
					channelUsername: (apiGeneral as any).username || (apiGeneral as any).channelUsername || defaultConfig.channelUsername,
					adminProfileDisplay: apiGeneral.showAdminProfile ?? (apiGeneral as any).adminProfileDisplay ?? defaultConfig.adminProfileDisplay,
					hideHistory: (apiGeneral as any).hideChatHistory ?? (apiGeneral as any).hideHistory ?? defaultConfig.hideHistory,
					hideMemberList: apiGeneral.hideMemberList ?? defaultConfig.hideMemberList,
					telegramAntiSpam: apiGeneral.antiSpam ?? (apiGeneral as any).telegramAntiSpam ?? defaultConfig.telegramAntiSpam,
					slowMode: String(apiGeneral.slowMode ?? 0),
					autoDeleteTimer: String(apiGeneral.autoDelete ?? (apiGeneral as any).autoDeleteTimer ?? 0),
					discussionGroup: apiGeneral.discussionGroupId || (apiGeneral as any).discussionGroup || '',
					approveAccountAge: ((apiGeneral as any).joinReqAge ?? 0) > 0 || (apiGeneral as any).approveAccountAge || defaultConfig.approveAccountAge,
					approveProfilePhoto: (apiGeneral as any).joinReqPhoto ?? (apiGeneral as any).approveProfilePhoto ?? defaultConfig.approveProfilePhoto,
					joinRequestsEnabled: (apiGeneral as any).joinRequestsEnabled ?? defaultConfig.joinRequestsEnabled,
					approvePremium: (apiGeneral as any).approvePremium ?? defaultConfig.approvePremium,
					approveGifts: (apiGeneral as any).approveGifts ?? defaultConfig.approveGifts,
					approveCollectibles: (apiGeneral as any).approveCollectibles ?? defaultConfig.approveCollectibles,

					inputChannelId,
					inputChannelName: (inputGeneral as any).name || (inputGeneral as any).channelName || '',
					inputChannelBio: (inputGeneral as any).description || (inputGeneral as any).channelBio || '',
					inputChannelPhotoUrl: (inputGeneral as any).photo || (inputGeneral as any).channelPhotoUrl || '',
					inputChannelUsername: (inputGeneral as any).username || (inputGeneral as any).channelUsername || '',
				};

				setConfig(reconcile(merged));
				return settings;
			} catch (error) {
				showToast(t('channelSettings.loadError'), 'error');
				throw error;
			}
		},
	);

	const handleBack = async () => {
		haptic.impact('light');
		if (isDirty()) {
			haptic.notify('warning');
			const confirmDiscard = await showConfirm(
				t('channelSettings.unsavedChangesConfirm'),
			);
			if (confirmDiscard) {
				setIsDirty(false);
				navigate(-1);
			}
		} else {
			navigate(-1);
		}
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(handleBack);
		onCleanup(() => { off(); backButton.hide(); });
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
			language: config.language, timezone: config.timezone, signMessages: config.signMessages, customSignature: config.customSignature, autoForward: config.autoForward, forwardDestination: config.forwardDestination.trim(), disableReactions: config.disableReactions, name: config.channelName.trim(), description: config.channelBio.trim(), photo: config.channelPhotoUrl.trim(), username, showAdminProfile: config.adminProfileDisplay, hideChatHistory: config.hideHistory, hideMemberList: config.hideMemberList, antiSpam: config.telegramAntiSpam, slowMode, autoDelete, discussionGroupId: config.discussionGroup.trim() || null, joinReqAge: config.approveAccountAge ? 1 : 0, joinReqPhoto: config.approveProfilePhoto, joinRequestsEnabled: config.joinRequestsEnabled, approvePremium: config.approvePremium, approveGifts: config.approveGifts, approveCollectibles: config.approveCollectibles, channelName: config.channelName.trim(), channelBio: config.channelBio.trim(), channelPhotoUrl: config.channelPhotoUrl.trim(), channelUsername: username, adminProfileDisplay: config.adminProfileDisplay, hideHistory: config.hideHistory, telegramAntiSpam: config.telegramAntiSpam, autoDeleteTimer: String(autoDelete), discussionGroup: config.discussionGroup.trim(), approveAccountAge: config.approveAccountAge, approveProfilePhoto: config.approveProfilePhoto,
		};
	};

	const handleSave = async () => {
		if (!isDirty()) return;
		setIsSaving(true);
		try {
			await channelApi.updateSettings(params.id, 'general', buildGeneralPayload(), settingsVersion());

			if (config.inputChannelId) {
				const inputUsername = config.inputChannelUsername.replace(/^@/, '').trim();
				const inputPayload = {
					name: config.inputChannelName.trim(), description: config.inputChannelBio.trim(), photo: config.inputChannelPhotoUrl.trim(), username: inputUsername, channelName: config.inputChannelName.trim(), channelBio: config.inputChannelBio.trim(), channelPhotoUrl: config.inputChannelPhotoUrl.trim(), channelUsername: inputUsername,
				};
				await channelApi.updateSettings(config.inputChannelId, 'general', inputPayload, 1);
			}

			const freshSettings = await channelApi.getSettings(params.id);
			setSettingsVersion(freshSettings.version || 1);

			setIsDirty(false);
			haptic.notify('success');
			showToast(t('common.settingsSaved'), 'success');
			navigate(`/channel/${params.id}`);
		} catch (e: any) {
			haptic.notify('error');
			if (e.status === 409 || (e.response && e.response.status === 409)) {
				showToast(t('channelSettings.concurrencyError'), 'error');
			} else {
				showToast(t('channelSettings.saveError'), 'error');
			}
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-32 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={handleBack}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2.5">
							<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
								{t('channelSettings.generalSettings')}
							</h1>
							<Show when={isDirty()}>
								<span class="w-2 h-2 rounded-full bg-[#3390ec] animate-pulse shrink-0 shadow-[0_0_8px_rgba(51,144,236,0.8)]" title={t('channelSettings.unsavedChangesTooltip')} />
							</Show>
						</div>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider truncate mt-0.5">
							{t('channelSettings.manageCoreConfig')}
						</span>
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

			<ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="general" />

			<div class="px-5 pt-6 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
				
				<ChannelContextBar channelId={params.id} />

				<Show
					when={!settingsData.loading}
					fallback={
						<div class="flex flex-col gap-4 animate-pulse mt-2">
							<div class="h-48 bg-[#12141C]/50 rounded-[24px] border border-white/5"></div>
							<div class="h-48 bg-[#12141C]/50 rounded-[24px] border border-white/5"></div>
						</div>
					}
				>
					{/* ═══════ INPUT CHANNEL IDENTITY ═══════ */}
					<Show when={config.inputChannelId}>
						<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 p-5 flex flex-col gap-5 shadow-sm relative overflow-hidden">
							<div class="absolute -right-6 -top-6 w-24 h-24 bg-[#3390ec]/10 blur-2xl rounded-full pointer-events-none" />
							
							<div class="flex items-center gap-3 relative z-10 border-b border-white/5 pb-3">
								<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/15 flex items-center justify-center border border-[#3390ec]/30 shadow-inner shrink-0">
									<span class="material-symbols-outlined text-[#3390ec] text-[20px] rtl:-scale-x-100">input</span>
								</div>
								<h2 class="text-[14px] font-black text-white tracking-tight uppercase tracking-widest">{t('channelSettings.inputChannelIdentity')}</h2>
							</div>

							<div class="flex flex-col items-center sm:flex-row gap-5 relative z-10">
								<div class="relative group shrink-0">
									<div class="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#3390ec]/20 to-[#2b96c8]/5 flex items-center justify-center border-2 border-white/10 cursor-pointer shadow-inner relative z-10">
										<Show
											when={config.inputChannelPhotoUrl}
											fallback={<span class="text-[28px] font-black text-[#3390ec] drop-shadow-md">{config.inputChannelName.charAt(0) || '?'}</span>}
										>
											<img loading="lazy" src={config.inputChannelPhotoUrl} class="w-full h-full object-cover" alt="Avatar" />
										</Show>
										<div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
											<span class="material-symbols-outlined text-white text-[24px]">photo_camera</span>
										</div>
										<input
											type="file" accept="image/png, image/jpeg, image/jpg" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-[0px] font-[0px] z-20"
											onChange={(e) => {
												const file = e.currentTarget.files?.[0];
												if (file) {
													const reader = new FileReader();
													reader.onload = (event) => {
														if (event.target?.result) {
															updateField('inputChannelPhotoUrl', event.target.result as string);
															haptic.notify('success');
														}
													};
													reader.readAsDataURL(file);
												}
											}}
										/>
									</div>
									<Show when={config.inputChannelPhotoUrl}>
										<button
											onClick={() => { updateField('inputChannelPhotoUrl', ''); haptic.notify('warning'); }}
											class="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#ff4a4a] text-white flex items-center justify-center hover:bg-[#ff3b30] active:scale-95 transition-all border-2 border-[#12141C] z-30 shadow-md"
											title={t('common.delete')}
										>
											<span class="material-symbols-outlined text-[14px]">close</span>
										</button>
									</Show>
								</div>
								
								<div class="flex flex-col gap-3 flex-1 w-full min-w-0">
									<div class="flex flex-col gap-1.5">
										<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">{t('channelSettings.channelName')}</label>
										<input
											type="text" value={config.inputChannelName} readOnly placeholder={t('channelSettings.channelNamePlaceholder')}
											class="bg-[#08090D] border border-white/5 text-white/60 font-bold text-[13px] rounded-[16px] px-4 py-3.5 w-full focus:outline-none cursor-not-allowed shadow-inner"
										/>
									</div>
									<div class="flex flex-col gap-1.5">
										<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">{t('channelSettings.channelUsername')}</label>
										<input
											type="text" value={config.inputChannelUsername} readOnly placeholder="@channel"
											class="bg-[#08090D] border border-white/5 text-white/60 font-mono text-[13px] rounded-[16px] px-4 py-3.5 w-full focus:outline-none cursor-not-allowed shadow-inner" dir="ltr"
										/>
									</div>
								</div>
							</div>
						</Motion.div>
					</Show>

					{/* ═══════ OUTPUT CHANNEL IDENTITY ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 p-5 flex flex-col gap-5 shadow-sm relative overflow-hidden">
						<div class="absolute -left-6 -bottom-6 w-24 h-24 bg-[#10b981]/10 blur-2xl rounded-full pointer-events-none" />
						
						<div class="flex items-center gap-3 relative z-10 border-b border-white/5 pb-3">
							<div class="w-10 h-10 rounded-[12px] bg-[#10b981]/15 text-[#10b981] font-black flex items-center justify-center border border-[#10b981]/30 shadow-inner shrink-0">
								<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">output</span>
							</div>
							<h2 class="text-[14px] font-black text-white tracking-tight uppercase tracking-widest">{t('channelSettings.outputChannelIdentity')}</h2>
						</div>

						<div class="flex flex-col items-center sm:flex-row gap-5 relative z-10">
							<div class="relative group shrink-0">
								<div class="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#10b981]/20 to-[#059669]/5 flex items-center justify-center border-2 border-white/10 cursor-pointer shadow-inner relative z-10">
									<Show
										when={config.channelPhotoUrl}
										fallback={<span class="text-[28px] font-black text-[#10b981] drop-shadow-md">{config.channelName.charAt(0) || '?'}</span>}
									>
										<img loading="lazy" src={config.channelPhotoUrl} class="w-full h-full object-cover" alt="Avatar" />
									</Show>
									<div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
										<span class="material-symbols-outlined text-white text-[24px]">photo_camera</span>
									</div>
									<input
										type="file" accept="image/png, image/jpeg, image/jpg" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-[0px] font-[0px] z-20"
										onChange={(e) => {
											const file = e.currentTarget.files?.[0];
											if (file) {
												const reader = new FileReader();
												reader.onload = (event) => {
													if (event.target?.result) {
														updateField('channelPhotoUrl', event.target.result as string);
														haptic.notify('success');
													}
												};
												reader.readAsDataURL(file);
											}
										}}
									/>
								</div>
								<Show when={config.channelPhotoUrl}>
									<button
										onClick={() => { updateField('channelPhotoUrl', ''); haptic.notify('warning'); }}
										class="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#ff4a4a] text-white flex items-center justify-center hover:bg-[#ff3b30] active:scale-95 transition-all border-2 border-[#12141C] z-30 shadow-md"
										title={t('common.delete')}
									>
										<span class="material-symbols-outlined text-[14px]">close</span>
									</button>
								</Show>
							</div>
							
							<div class="flex flex-col gap-3 flex-1 w-full min-w-0">
								<div class="flex flex-col gap-1.5">
									<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">{t('channelSettings.channelName')}</label>
									<input
										type="text" value={config.channelName} readOnly placeholder={t('channelSettings.channelNamePlaceholder')}
										class="bg-[#08090D] border border-white/5 text-white/60 font-bold text-[13px] rounded-[16px] px-4 py-3.5 w-full focus:outline-none cursor-not-allowed shadow-inner"
									/>
								</div>
								<div class="flex flex-col gap-1.5">
									<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">{t('channelSettings.channelUsername')}</label>
									<input
										type="text" value={config.channelUsername} readOnly placeholder="@channel"
										class="bg-[#08090D] border border-white/5 text-white/60 font-mono text-[13px] rounded-[16px] px-4 py-3.5 w-full focus:outline-none cursor-not-allowed shadow-inner" dir="ltr"
									/>
								</div>
							</div>
						</div>
					</Motion.div>

					{/* ═══════ LOCALIZATION ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-2 shadow-sm flex flex-col gap-2">
						<SelectField
							label={t('channelSettings.timeZone')} value={config.timezone} onChange={(v) => updateField('timezone', v)}
							options={[
								{ value: 'UTC', label: 'UTC (GMT+0)' },
								{ value: 'Europe/Moscow', label: 'Europe/Moscow (GMT+3)' },
								{ value: 'Asia/Tehran', label: 'Asia/Tehran (GMT+3:30)' },
							]}
							description={t('channelSettings.timeZoneDesc')}
						/>
						<div class="h-[1px] bg-white/5 mx-4" />
						<SelectField
							label={t('channelSettings.botLanguage')} value={config.language} onChange={(v) => updateField('language', v)}
							options={[
								{ value: 'en', label: 'English' },
								{ value: 'fa', label: 'فارسی (Persian)' },
								{ value: 'ru', label: 'Русский (Russian)' },
								{ value: 'ar', label: 'العربية (Arabic)' },
							]}
							description={t('channelSettings.botLanguageDesc')}
						/>
					</Motion.div>

					{/* ═══════ SIGNATURES ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden mt-1">
						<SettingsSection
							title={t('channelSettings.signMessages')}
							description={t('channelSettings.signMessagesDesc')}
							enabled={config.signMessages}
							onToggle={(v) => updateField('signMessages', v)}
						/>
						<Show when={config.signMessages}>
							<div class="flex flex-col gap-1.5 pt-3 border-t border-white/5 mt-1 relative z-10">
								<label class="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">{t('channelSettings.customSignature')}</label>
								<div class="relative">
									<span class="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-white/30 text-[20px] pointer-events-none">draw</span>
									<input
										type="text" value={config.customSignature || ''} onInput={(e) => updateField('customSignature', e.currentTarget.value)}
										placeholder={t('channelSettings.customSignaturePlaceholder')}
										class="bg-[#08090D] border border-[#3390ec]/30 text-white font-bold text-[14px] rounded-[16px] pr-12 pl-4 py-4 w-full focus:outline-none focus:border-[#3390ec] shadow-inner transition-colors placeholder-white/20"
									/>
								</div>
							</div>
						</Show>
					</Motion.div>

					{/* ═══════ JOIN REQUESTS (Security) ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 p-5 flex flex-col shadow-sm relative overflow-hidden mt-1">
						<div class="absolute -left-6 -bottom-6 w-32 h-32 bg-amber-400/10 blur-3xl rounded-full pointer-events-none" />
						
						<div class="flex items-center justify-between gap-3 relative z-10">
							<div class="flex flex-col flex-1 min-w-0">
								<span class="text-[15px] font-black text-white flex items-center gap-2 tracking-tight">
									<span class="material-symbols-outlined text-amber-400 text-[20px]">how_to_reg</span>
									{t('channelSettings.joinRequests')}
								</span>
								<span class="text-[11px] font-medium text-white/50 leading-relaxed mt-1">
									{t('channelSettings.joinRequestsDesc')}
								</span>
							</div>
							<ToggleSwitch checked={config.joinRequestsEnabled} onChange={(v) => updateField('joinRequestsEnabled', v)} />
						</div>

						<Show when={config.joinRequestsEnabled}>
							<div class="flex flex-col gap-2 pt-4 border-t border-white/5 mt-4 relative z-10">
								<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-4 flex items-center justify-between shadow-inner">
									<span class="text-[13px] font-bold text-white/90 flex items-center gap-2">
										<span class="material-symbols-outlined text-[#3390ec] text-[20px]">verified</span>
										{t('channelSettings.filterByPremium')}
									</span>
									<ToggleSwitch checked={config.approvePremium} onChange={(v) => updateField('approvePremium', v)} />
								</div>
								<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-4 flex items-center justify-between shadow-inner">
									<span class="text-[13px] font-bold text-white/90 flex items-center gap-2">
										<span class="material-symbols-outlined text-[#ff4a4a] text-[20px]">redeem</span>
										{t('channelSettings.filterByGifts')}
									</span>
									<ToggleSwitch checked={config.approveGifts} onChange={(v) => updateField('approveGifts', v)} />
								</div>
								<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-4 flex items-center justify-between shadow-inner">
									<span class="text-[13px] font-bold text-white/90 flex items-center gap-2">
										<span class="material-symbols-outlined text-[#10b981] text-[20px]">account_circle</span>
										{t('channelSettings.filterByProfilePhoto')}
									</span>
									<ToggleSwitch checked={config.approveProfilePhoto} onChange={(v) => updateField('approveProfilePhoto', v)} />
								</div>
							</div>
						</Show>
					</Motion.div>
				</Show>
			</div>

			{/* ═══════ FLOATING ACTION BAR ═══════ */}
			<Show when={isDirty()}>
				<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#030303] via-[#030303]/90 to-transparent z-40 pointer-events-none">
					<div class="max-w-md mx-auto flex gap-3 pointer-events-auto">
						<button
							onClick={() => { setIsDirty(false); navigate(`/channel/${params.id}`); }} disabled={isSaving()}
							class="w-16 h-14 bg-[#12141C]/80 backdrop-blur-md text-[#ff4a4a] border border-[#ff4a4a]/20 rounded-[16px] transition-all flex items-center justify-center hover:bg-[#ff4a4a]/10 active:scale-95 shadow-sm"
						>
							<span class="material-symbols-outlined text-[24px]">close</span>
						</button>
						<button
							onClick={handleSave} disabled={isSaving()}
							class="flex-1 h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest shadow-[0_10px_30px_rgba(51,144,236,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:scale-100 active:scale-95 border border-white/10"
						>
							<Show when={!isSaving()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
								{t('channelSettings.saveSettings')} <span class="material-symbols-outlined text-[22px]">save</span>
							</Show>
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};
