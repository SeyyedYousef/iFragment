import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/entities/group/index.js';
import { t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { SettingsSection } from '@/shared/ui/settings-controls.js';
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

const allKeys = Object.values(settingKeys).flat();

export const ContentRestrictionsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [activeTab, setActiveTab] = createSignal('links');
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const defaultStore: Record<string, RestrictionSetting> = {};
	allKeys.forEach((k) => { defaultStore[k] = defaultSetting(); });

	const [settings, setSettings] = createStore(defaultStore);
	const [bannedKeywords, setBannedKeywords] = createSignal<string[]>([]);
	const [requiredKeywords, setRequiredKeywords] = createSignal<string[]>([]);
	const [newBannedKeyword, setNewBannedKeyword] = createSignal('');
	const [newRequiredKeyword, setNewRequiredKeyword] = createSignal('');

	createResource(() => params.id, async (groupId) => {
		const data = await groupApi.getSettings(groupId);
		setSettingsVersion(data.version);
		const cr = (data.content_restrictions || {}) as any;
		allKeys.forEach((k) => { if (cr[k]) setSettings(k, reconcile({ ...defaultSetting(), ...cr[k] })); });
		if (cr.bannedKeywords) setBannedKeywords(cr.bannedKeywords);
		if (cr.requiredKeywords) setRequiredKeywords(cr.requiredKeywords);
		return data;
	});

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => { haptic.impact('light'); window.history.back(); });
		onCleanup(() => off());
	});

	const handleSave = async () => {
		if (!isDirty()) return;
		haptic.notify('success');
		setIsSaving(true);
		try {
			const payload: any = { ...settings, bannedKeywords: bannedKeywords(), requiredKeywords: requiredKeywords() };
			const result = await groupApi.updateSettings(params.id, 'content_restrictions', payload, settingsVersion());
			setSettingsVersion(result.version);
			setIsDirty(false);
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

	const updateSetting = (key: string, field: string, value: any) => {
		setSettings(key, field as any, value);
		setIsDirty(true);
	};

	const renderSetting = (key: string, titleKey: string, descKey: string) => (
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
	);

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
		<div class="min-h-screen bg-[#030303] text-white pb-28 relative font-sans selection:bg-[#3390ec]/30" dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-3 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex flex-col gap-4 shadow-sm">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3.5 overflow-hidden flex-1">
						<button
							onClick={() => { haptic.impact('light'); window.history.back(); }}
							class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm"
							aria-label="Back"
						>
							<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">arrow_back</span>
						</button>
						<Motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} class="flex flex-col gap-0.5 min-w-0">
							<div class="flex items-center gap-2.5">
								<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
									{t('contentRestrictions.title')}
								</h1>
								<Show when={isDirty()}>
									<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
								</Show>
							</div>
							<p class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate">
								{t('contentRestrictions.subtitle')}
							</p>
						</Motion.div>
					</div>
					<button
						onClick={() => setIsMenuOpen(true)}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 ml-2 shadow-sm text-white/80"
					>
						<span class="material-symbols-outlined text-[22px]">menu</span>
					</button>
				</div>

				{/* ═══════ HORIZONTAL SCROLLABLE TABS ═══════ */}
				<div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-0.5">
					<For each={tabs}>
						{(tab) => (
							<button
								onClick={() => { haptic.impact('light'); setActiveTab(tab.id); }}
								class={`flex items-center gap-1.5 px-4 py-2.5 rounded-[14px] whitespace-nowrap transition-all duration-300 ${
									activeTab() === tab.id
										? 'bg-[#3390ec] text-white font-black shadow-[0_4px_16px_rgba(51,144,236,0.3)] border border-transparent'
										: 'bg-[#12141C]/80 text-white/50 font-bold border border-white/5 hover:bg-white/10 hover:text-white/90'
								}`}
							>
								<span class="material-symbols-outlined text-[18px]">{tab.icon}</span>
								<span class="text-[11px] uppercase tracking-wider">{tab.label}</span>
							</button>
						)}
					</For>
				</div>
			</div>

			<HamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} groupId={params.id} activeTab="content" />

			<div class="p-5 flex flex-col gap-3 max-w-md mx-auto relative z-10 w-full">
				
				{/* ── LINKS ── */}
				<Show when={activeTab() === 'links'}>
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col gap-3.5 w-full">
						<div class="flex items-center justify-between px-2 mb-1">
							<span class="text-[11px] text-white/40 font-black uppercase tracking-widest">{t('contentRestrictions.tabLinks')}</span>
							<button
								onClick={() => {
									settingKeys.links.forEach((k) => setSettings(k, 'enabled', true));
									setIsDirty(true);
									haptic.impact('medium');
									showToast('All link blockers enabled', 'success');
								}}
								class="text-[11px] text-[#3390ec] font-bold hover:underline bg-[#3390ec]/10 px-2.5 py-1 rounded-[8px] border border-[#3390ec]/20 transition-all active:scale-95"
							>
								Enable All
							</button>
						</div>
						{renderSetting('removeLinks', 'removeLinks', 'removeLinksDesc')}
						{renderSetting('blockBots', 'blockBots', 'blockBotsDesc')}
						{renderSetting('removeBotInviters', 'removeBotInviters', 'removeBotInvitersDesc')}
						{renderSetting('blockDomains', 'blockDomains', 'blockDomainsDesc')}
						{renderSetting('blockUsernames', 'blockUsernames', 'blockUsernamesDesc')}
					</Motion.div>
				</Show>

				{/* ── TEXT ── */}
				<Show when={activeTab() === 'text'}>
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col gap-3.5 w-full">
						{renderSetting('blockHashtags', 'blockHashtags', 'blockHashtagsDesc')}
						{renderSetting('blockTextPatterns', 'blockTextPatterns', 'blockTextPatternsDesc')}
						{renderSetting('blockEmojis', 'blockEmojis', 'blockEmojisDesc')}
						{renderSetting('blockEmojiOnly', 'blockEmojiOnly', 'blockEmojiOnlyDesc')}
						{renderSetting('blockPhoneNumbers', 'blockPhoneNumbers', 'blockPhoneNumbersDesc')}
					</Motion.div>
				</Show>

				{/* ── MEDIA ── */}
				<Show when={activeTab() === 'media'}>
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col gap-3.5 w-full">
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

				{/* ── INTERACTIONS ── */}
				<Show when={activeTab() === 'interactions'}>
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col gap-3.5 w-full">
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

				{/* ── LANGUAGES ── */}
				<Show when={activeTab() === 'languages'}>
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col gap-3.5 w-full">
						{renderSetting('blockLatinLetters', 'blockLatinLetters', 'blockLatinLettersDesc')}
						{renderSetting('blockPersianArabicLetters', 'blockPersianArabicLetters', 'blockPersianArabicLettersDesc')}
						{renderSetting('blockCyrillicLetters', 'blockCyrillicLetters', 'blockCyrillicLettersDesc')}
						{renderSetting('blockChineseCharacters', 'blockChineseCharacters', 'blockChineseCharactersDesc')}
					</Motion.div>
				</Show>

				{/* ── KEYWORDS (Premium UI Revamp) ── */}
				<Show when={activeTab() === 'keywords'}>
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} class="flex flex-col gap-5 w-full">
						
						{/* Banned Keywords */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-4 shadow-sm">
							<div class="flex items-center gap-3.5">
								<div class="w-12 h-12 rounded-[16px] bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 flex items-center justify-center shrink-0 shadow-inner">
									<span class="material-symbols-outlined text-[#ff4a4a] text-[24px]">block</span>
								</div>
								<div class="flex flex-col">
									<span class="text-[15px] font-black text-white tracking-tight">{t('contentRestrictions.bannedKeywords')}</span>
									<span class="text-[11px] font-medium text-white/50 leading-relaxed mt-0.5">{t('contentRestrictions.bannedKeywordsDesc')}</span>
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
								<button onClick={addBannedKeyword} class="w-12 h-12 rounded-[14px] bg-[#ff4a4a] hover:bg-[#ff3b30] text-white flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-[0_4px_15px_rgba(255,74,74,0.3)]">
									<span class="material-symbols-outlined text-[24px]">add</span>
								</button>
							</div>
						</div>

						{/* Required Keywords */}
						<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-5 flex flex-col gap-4 shadow-sm">
							<div class="flex items-center gap-3.5">
								<div class="w-12 h-12 rounded-[16px] bg-[#10b981]/10 border border-[#10b981]/20 flex items-center justify-center shrink-0 shadow-inner">
									<span class="material-symbols-outlined text-[#10b981] text-[24px]">fact_check</span>
								</div>
								<div class="flex flex-col">
									<span class="text-[15px] font-black text-white tracking-tight">{t('contentRestrictions.requiredKeywords')}</span>
									<span class="text-[11px] font-medium text-white/50 leading-relaxed mt-0.5">{t('contentRestrictions.requiredKeywordsDesc')}</span>
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

			{/* ═══════ FLOATING SAVE BUTTON ═══════ */}
			<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#030303] via-[#030303]/90 to-transparent z-30 pointer-events-none">
				<div class="max-w-md mx-auto pointer-events-auto">
					<button
						onClick={handleSave}
						disabled={isSaving() || !isDirty()}
						class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest shadow-[0_10px_30px_rgba(51,144,236,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:scale-100 disabled:shadow-none active:scale-95 border border-white/10"
					>
						<Show when={!isSaving()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
							{t('generalSettings.saveSettings')}
							<span class="material-symbols-outlined text-[22px]">save</span>
						</Show>
					</button>
				</div>
			</div>
		</div>
	);
};
