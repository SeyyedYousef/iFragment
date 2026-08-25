import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/entities/group/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { SettingsSection } from '@/shared/ui/settings-controls.js';
import { SettingsGuard } from '@/shared/ui/SettingsGuard.js';
import { showToast } from '@/shared/ui/toast.js';
import { haptic } from '@/shared/lib/haptic.js';

type RestrictionSetting = { enabled: boolean; window: string; start: string; end: string; penalty: string; };

const defaultSetting = (): RestrictionSetting => ({ enabled: false, window: 'Always', start: '08:00', end: '22:00', penalty: 'default' });

const settingKeys = {
	links: ['removeLinks', 'blockBots', 'removeBotInviters', 'blockDomains', 'blockUsernames'],
	text: ['blockHashtags', 'blockTextPatterns', 'blockEmojis', 'blockEmojiOnly', 'blockPhoneNumbers'],
	media: ['blockPhotos', 'blockStickers', 'blockLocations', 'blockAudio', 'blockVoiceMessages', 'blockFiles', 'blockGifs', 'blockCaptionless'],
	interactions: ['blockForwards', 'restrictChannelForwards', 'blockAppMessages', 'blockPolls', 'blockInlineKeyboards', 'blockGames', 'blockSlashCommands', 'blockUserReplies', 'blockCrossChatReplies'],
	languages: ['blockLatinLetters', 'blockPersianArabicLetters', 'blockCyrillicLetters', 'blockChineseCharacters'],
};

const NATIVE_KEYS = ['blockPhotos', 'blockAudio', 'blockFiles', 'blockStickers', 'blockPolls', 'removeLinks'];

const allKeys = Object.values(settingKeys).flat();

export const ContentRestrictionsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [showUnsavedSheet, setShowUnsavedSheet] = createSignal(false);
	const [activeTab, setActiveTab] = createSignal('links');
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const defaultStore: Record<string, RestrictionSetting> = {};
	allKeys.forEach((k) => { defaultStore[k] = defaultSetting(); });

	const [settings, setSettings] = createStore(defaultStore);
	const [initialSettings, setInitialSettings] = createSignal<Record<string, RestrictionSetting>>({});
	const [bannedKeywords, setBannedKeywords] = createSignal<string[]>([]);
	const [requiredKeywords, setRequiredKeywords] = createSignal<string[]>([]);
	const [newBannedKeyword, setNewBannedKeyword] = createSignal('');
	const [newRequiredKeyword, setNewRequiredKeyword] = createSignal('');

	createResource(() => params.id, async (groupId) => {
		const data = await groupApi.getSettings(groupId);
		setSettingsVersion(data.version);
		const cr = (data.content_restrictions || {}) as any;
		const snapshot: Record<string, RestrictionSetting> = {};
		allKeys.forEach((k) => {
			if (cr[k]) {
				const val = { ...defaultSetting(), ...cr[k] };
				snapshot[k] = val;
				setSettings(k, reconcile(val));
			} else {
				snapshot[k] = defaultSetting();
			}
		});
		setInitialSettings(snapshot);
		if (cr.bannedKeywords) setBannedKeywords(cr.bannedKeywords);
		if (cr.requiredKeywords) setRequiredKeywords(cr.requiredKeywords);
		setIsDirty(false);
		return data;
	});

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

	const handleSave = async () => {
		if (!isDirty() || isSaving()) return;
		setIsSaving(true);
		try {
			const payload: any = { ...settings, bannedKeywords: bannedKeywords(), requiredKeywords: requiredKeywords() };
			const result = await groupApi.updateSettings(params.id, 'content_restrictions', payload, settingsVersion());
			setSettingsVersion(result.version);
			setIsDirty(false);
			setShowUnsavedSheet(false);
			haptic.notify('success');
			showToast(t('common.settingsSaved') || 'Settings saved successfully', 'success');
			navigate(`/group/${params.id}`);
			backButton.hide();
		} catch (err: any) {
			haptic.notify('error');
			const errorMsg = err.response?.data?.error || err.message;
			if (errorMsg === 'version_mismatch') showToast(t('common.errorVersionMismatch'), 'error');
			else showToast(t('common.errorUpdateFailed'), 'error');
		} finally {
			setIsSaving(false);
		}
	};

	const handleDiscard = () => {
		const init = initialSettings();
		allKeys.forEach((k) => {
			if (init[k]) setSettings(k, reconcile(init[k]));
		});
		setIsDirty(false);
		setShowUnsavedSheet(false);
		window.history.back();
	};

	const updateSetting = (key: string, field: string, value: any) => {
		setSettings(key, field as any, value);
		setIsDirty(true);
	};

	const renderSetting = (key: string, titleKey: string, descKey: string) => {
		const isNative = NATIVE_KEYS.includes(key);
		const isAlwaysActive = settings[key].enabled && settings[key].window === 'Always';

		return (
			<div class="relative">
				<SettingsSection
					title={t(`contentRestrictions.${titleKey}` as import('@/shared/i18n/index.js').DictPaths)}
					description={t(`contentRestrictions.${descKey}` as import('@/shared/i18n/index.js').DictPaths)}
					enabled={settings[key].enabled}
					onToggle={(v) => updateSetting(key, 'enabled', v)}
					hasWindow={true}
					windowVal={settings[key].window}
					onWindowChange={(v) => updateSetting(key, 'window', v)}
					customStart={settings[key].start}
					onCustomStart={(v) => updateSetting(key, 'start', v)}
					customEnd={settings[key].end}
					onCustomEnd={(v) => updateSetting(key, 'end', v)}
					hasPenalty={true}
					penaltyVal={settings[key].penalty}
					onPenaltyChange={(v) => updateSetting(key, 'penalty', v)}
				/>
				<Show when={isNative && isAlwaysActive}>
					<div class="absolute top-4 left-4 pointer-events-none">
						<span class="text-[9px] font-black bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/30 px-2 py-0.5 rounded-[6px] uppercase tracking-widest shadow-sm">
							NATIVE
						</span>
					</div>
				</Show>
			</div>
		);
	};

	const tabs = [
		{ id: 'links', icon: 'link', label: t('contentRestrictions.tabLinks') },
		{ id: 'text', icon: 'text_fields', label: t('contentRestrictions.tabText') },
		{ id: 'media', icon: 'perm_media', label: t('contentRestrictions.tabMedia') },
		{ id: 'interactions', icon: 'forum', label: t('contentRestrictions.tabInteractions') },
		{ id: 'languages', icon: 'language', label: t('contentRestrictions.tabLanguages') },
		{ id: 'keywords', icon: 'key', label: t('contentRestrictions.tabKeywords') },
	];

	const addBannedKeyword = () => {
		if (newBannedKeyword().trim()) {
			setBannedKeywords([...bannedKeywords(), newBannedKeyword().trim()]);
			setNewBannedKeyword('');
			setIsDirty(true);
		}
	};

	const addRequiredKeyword = () => {
		if (newRequiredKeyword().trim()) {
			setRequiredKeywords([...requiredKeywords(), newRequiredKeyword().trim()]);
			setNewRequiredKeyword('');
			setIsDirty(true);
		}
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => { haptic.impact('light'); handleBack(); }}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2.5">
							<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
								{t('contentRestrictions.title')}
							</h1>
							<Show when={isDirty()}>
								<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
							</Show>
						</div>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('contentRestrictions.description')}
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

			<HamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} groupId={params.id} activeTab="content" />

			{/* ═══════ CATEGORY TABS ═══════ */}
			<div class="px-5 pt-4 pb-2 max-w-md mx-auto relative z-10 w-full">
				<div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
					<For each={tabs}>
						{(tab) => (
							<button
								onClick={() => { haptic.selection(); setActiveTab(tab.id); }}
								class={`px-4 py-2.5 rounded-[16px] text-[12px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-2 border active:scale-95 shadow-sm ${activeTab() === tab.id ? 'bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white border-transparent shadow-[0_4px_15px_rgba(51,144,236,0.3)]' : 'bg-[#12141C]/80 text-white/50 border-white/5 hover:border-white/15'}`}
							>
								<span class="material-symbols-outlined text-[18px]">{tab.icon}</span>
								{tab.label}
							</button>
						)}
					</For>
				</div>
			</div>

			<div class="p-5 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
				
				{/* ═══════ TAB: LINKS & SPAM ═══════ */}
				<Show when={activeTab() === 'links'}>
					<Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col gap-4">
						{renderSetting('removeLinks', 'removeLinks', 'removeLinksDesc')}
						{renderSetting('blockBots', 'blockBots', 'blockBotsDesc')}
						{renderSetting('removeBotInviters', 'removeBotInviters', 'removeBotInvitersDesc')}
						{renderSetting('blockDomains', 'blockDomains', 'blockDomainsDesc')}
						{renderSetting('blockUsernames', 'blockUsernames', 'blockUsernamesDesc')}
					</Motion.div>
				</Show>

				{/* ═══════ TAB: TEXT PATTERNS ═══════ */}
				<Show when={activeTab() === 'text'}>
					<Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col gap-4">
						{renderSetting('blockHashtags', 'blockHashtags', 'blockHashtagsDesc')}
						{renderSetting('blockTextPatterns', 'blockTextPatterns', 'blockTextPatternsDesc')}
						{renderSetting('blockEmojis', 'blockEmojis', 'blockEmojisDesc')}
						{renderSetting('blockEmojiOnly', 'blockEmojiOnly', 'blockEmojiOnlyDesc')}
						{renderSetting('blockPhoneNumbers', 'blockPhoneNumbers', 'blockPhoneNumbersDesc')}
					</Motion.div>
				</Show>

				{/* ═══════ TAB: MEDIA CONTROLS ═══════ */}
				<Show when={activeTab() === 'media'}>
					<Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col gap-4">
						{renderSetting('blockPhotos', 'blockPhotos', 'blockPhotosDesc')}
						{renderSetting('blockStickers', 'blockStickers', 'blockStickersDesc')}
						{renderSetting('blockLocations', 'blockLocations', 'blockLocationsDesc')}
						{renderSetting('blockAudio', 'blockAudio', 'blockAudioDesc')}
						{renderSetting('blockVoiceMessages', 'blockVoiceMessages', 'blockVoiceMessagesDesc')}
						{renderSetting('blockFiles', 'blockFiles', 'blockFilesDesc')}
						{renderSetting('blockGifs', 'blockGifs', 'blockGifsDesc')}
						{renderSetting('blockCaptionless', 'blockCaptionless', 'blockCaptionlessDesc')}
					</Motion.div>
				</Show>

				{/* ═══════ TAB: INTERACTIONS ═══════ */}
				<Show when={activeTab() === 'interactions'}>
					<Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col gap-4">
						{renderSetting('blockForwards', 'blockForwards', 'blockForwardsDesc')}
						{renderSetting('restrictChannelForwards', 'restrictChannelForwards', 'restrictChannelForwardsDesc')}
						{renderSetting('blockAppMessages', 'blockAppMessages', 'blockAppMessagesDesc')}
						{renderSetting('blockPolls', 'blockPolls', 'blockPollsDesc')}
						{renderSetting('blockInlineKeyboards', 'blockInlineKeyboards', 'blockInlineKeyboardsDesc')}
						{renderSetting('blockGames', 'blockGames', 'blockGamesDesc')}
						{renderSetting('blockSlashCommands', 'blockSlashCommands', 'blockSlashCommandsDesc')}
						{renderSetting('blockUserReplies', 'blockUserReplies', 'blockUserRepliesDesc')}
						{renderSetting('blockCrossChatReplies', 'blockCrossChatReplies', 'blockCrossChatRepliesDesc')}
					</Motion.div>
				</Show>

				{/* ═══════ TAB: LANGUAGES ═══════ */}
				<Show when={activeTab() === 'languages'}>
					<Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col gap-4">
						{renderSetting('blockLatinLetters', 'blockLatinLetters', 'blockLatinLettersDesc')}
						{renderSetting('blockPersianArabicLetters', 'blockPersianArabicLetters', 'blockPersianArabicLettersDesc')}
						{renderSetting('blockCyrillicLetters', 'blockCyrillicLetters', 'blockCyrillicLettersDesc')}
						{renderSetting('blockChineseCharacters', 'blockChineseCharacters', 'blockChineseCharactersDesc')}
					</Motion.div>
				</Show>

				{/* ═══════ TAB: KEYWORDS ═══════ */}
				<Show when={activeTab() === 'keywords'}>
					<Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col gap-6">
						
						{/* Banned Keywords */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm flex flex-col gap-4">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-[#ff4a4a] text-[20px]">block</span>
								<div class="flex flex-col">
									<h2 class="text-[13px] font-black text-[#ff4a4a] uppercase tracking-widest">{t('contentRestrictions.bannedKeywords')}</h2>
									<span class="text-[11px] text-white/40">{t('contentRestrictions.bannedKeywordsDesc')}</span>
								</div>
							</div>

							<div class="flex flex-wrap gap-2 pt-1">
								<For each={bannedKeywords()}>
									{(kw) => (
										<span class="bg-[#ff4a4a]/10 text-[#ff4a4a] border border-[#ff4a4a]/20 px-3.5 py-1.5 rounded-[12px] text-[12px] font-bold flex items-center gap-1.5 shadow-sm">
											{kw}
											<button onClick={() => { setBannedKeywords(bannedKeywords().filter((k) => k !== kw)); setIsDirty(true); }} class="hover:text-white transition-colors">
												<span class="material-symbols-outlined text-[16px] mt-0.5">close</span>
											</button>
										</span>
									)}
								</For>
							</div>

							<div class="flex items-center gap-2 mt-1">
								<input
									type="text" value={newBannedKeyword()} onInput={(e) => setNewBannedKeyword(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && addBannedKeyword()} placeholder={t('contentRestrictions.addKeyword')}
									class="flex-1 h-12 bg-[#08090D] border border-white/10 text-white text-[13px] font-bold rounded-[14px] px-4 focus:outline-none focus:border-[#ff4a4a]/50 transition-colors placeholder-white/20 shadow-inner"
								/>
								<button onClick={addBannedKeyword} class="w-12 h-12 rounded-[14px] bg-[#ff4a4a] hover:bg-[#e03838] text-white flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-[0_4px_15px_rgba(255,74,74,0.3)]">
									<span class="material-symbols-outlined text-[24px]">add</span>
								</button>
							</div>
						</div>

						{/* Required Keywords */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm flex flex-col gap-4">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-[#10b981] text-[20px]">check_circle</span>
								<div class="flex flex-col">
									<h2 class="text-[13px] font-black text-[#10b981] uppercase tracking-widest">{t('contentRestrictions.requiredKeywords')}</h2>
									<span class="text-[11px] text-white/40">{t('contentRestrictions.requiredKeywordsDesc')}</span>
								</div>
							</div>

							<div class="flex flex-wrap gap-2 pt-1">
								<For each={requiredKeywords()}>
									{(kw) => (
										<span class="bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 px-3.5 py-1.5 rounded-[12px] text-[12px] font-bold flex items-center gap-1.5 shadow-sm">
											{kw}
											<button onClick={() => { setRequiredKeywords(requiredKeywords().filter((k) => k !== kw)); setIsDirty(true); }} class="hover:text-white transition-colors">
												<span class="material-symbols-outlined text-[16px] mt-0.5">close</span>
											</button>
										</span>
									)}
								</For>
							</div>

							<div class="flex items-center gap-2 mt-1">
								<input
									type="text" value={newRequiredKeyword()} onInput={(e) => setNewRequiredKeyword(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && addRequiredKeyword()} placeholder={t('contentRestrictions.addKeyword')}
									class="flex-1 h-12 bg-[#08090D] border border-white/10 text-white text-[13px] font-bold rounded-[14px] px-4 focus:outline-none focus:border-[#10b981]/50 transition-colors placeholder-white/20 shadow-inner"
								/>
								<button onClick={addRequiredKeyword} class="w-12 h-12 rounded-[14px] bg-[#10b981] hover:bg-[#059669] text-white flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)]">
									<span class="material-symbols-outlined text-[24px]">add</span>
								</button>
							</div>
						</div>

					</Motion.div>
				</Show>
			</div>

			<SettingsGuard
				isDirty={isDirty()}
				isSaving={isSaving()}
				showSheet={showUnsavedSheet()}
				onSave={handleSave}
				onDiscard={handleDiscard}
				onCloseSheet={() => setShowUnsavedSheet(false)}
			/>
		</div>
	);
};
