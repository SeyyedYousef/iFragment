import { Component, createSignal, createResource, onMount, onCleanup, For, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { SettingsSection } from '@/shared/ui/settings-controls.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { groupApi } from '@/shared/api/bot-management.js';

type RestrictionSetting = {
  enabled: boolean;
  window: string;
  start: string;
  end: string;
  penalty: string;
};

const defaultSetting = (): RestrictionSetting => ({
  enabled: false, window: 'Always', start: '08:00', end: '22:00', penalty: 'default'
});

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

  // Menu State
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isDirty, setIsDirty] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal('links');
  const [settingsVersion, setSettingsVersion] = createSignal(1);

  const defaultStore: Record<string, RestrictionSetting> = {};
  allKeys.forEach(k => { defaultStore[k] = defaultSetting(); });

  const [settings, setSettings] = createStore(defaultStore);
  const [bannedKeywords, setBannedKeywords] = createSignal<string[]>([]);
  const [requiredKeywords, setRequiredKeywords] = createSignal<string[]>([]);
  const [newBannedKeyword, setNewBannedKeyword] = createSignal('');
  const [newRequiredKeyword, setNewRequiredKeyword] = createSignal('');

  const [settingsData] = createResource(
    () => params.id,
    async (groupId) => {
      const data = await groupApi.getSettings(groupId);
      setSettingsVersion(data.version);
      const cr = (data.content_restrictions || {}) as any;
      allKeys.forEach(k => {
        if (cr[k]) setSettings(k, reconcile({ ...defaultSetting(), ...cr[k] }));
      });
      if (cr.bannedKeywords) setBannedKeywords(cr.bannedKeywords);
      if (cr.requiredKeywords) setRequiredKeywords(cr.requiredKeywords);
      return data;
    }
  );

  // Handle Telegram Back Button
  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      hapticFeedback.impactOccurred('light');
      window.history.back();
    });
    onCleanup(() => off());
  });

  const handleSave = async () => {
    if (!isDirty()) return;
    hapticFeedback.notificationOccurred('success');
    setIsSaving(true);
    try {
      const payload: any = { ...settings, bannedKeywords: bannedKeywords(), requiredKeywords: requiredKeywords() };
      const result = await groupApi.updateSettings(params.id, 'content_restrictions', payload, settingsVersion());
      setSettingsVersion(result.version);
      setIsDirty(false);
      navigate(`/group/${params.id}`);
      backButton.hide();
    } catch {
      hapticFeedback.notificationOccurred('error');
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
      title={t(`contentRestrictions.${titleKey}` as any)}
      description={t(`contentRestrictions.${descKey}` as any)}
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
    <div class="min-h-screen bg-[#0f1014] text-white pb-24">
      {/* Header */}
      <div class="pt-6 pb-2 px-5 sticky top-0 bg-[#0f1014]/90 backdrop-blur-md z-20 border-b border-[#2a2a2a] flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <Motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            class="flex flex-col gap-1"
          >
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-black text-white">{t('contentRestrictions.title')}</h1>
              <Show when={isDirty()}>
                <span class="w-2.5 h-2.5 rounded-full bg-[#ff9f0a] animate-pulse" />
              </Show>
            </div>
            <p class="text-[13px] text-[#8e8e93] font-medium leading-snug">
              {t('contentRestrictions.subtitle')}
            </p>
          </Motion.div>

          <button 
            onClick={() => setIsMenuOpen(true)}
            class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors shrink-0"
          >
            <span class="material-symbols-outlined text-white text-[20px]">menu</span>
          </button>
        </div>

        {/* Horizontal Scrollable Tabs */}
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          <For each={tabs}>
            {(tab) => (
              <button
                onClick={() => {
                  hapticFeedback.impactOccurred('light');
                  setActiveTab(tab.id);
                }}
                class={`flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap transition-all duration-300 ${
                  activeTab() === tab.id 
                    ? 'bg-[#3390ec] text-white font-bold shadow-[0_4px_12px_rgba(51,144,236,0.3)]' 
                    : 'bg-[#1c1c1c] text-[#8e8e93] font-medium border border-[#2a2a2a] hover:bg-[#2a2a2a]'
                }`}
              >
                <span class="material-symbols-outlined text-[18px]">{tab.icon}</span>
                <span class="text-[13px]">{tab.label}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      <HamburgerMenu 
        isOpen={isMenuOpen()} 
        onClose={() => setIsMenuOpen(false)} 
        groupId={params.id} 
        activeTab="content" 
      />

      <Show when={settingsData.loading}>
        <div class="flex items-center justify-center py-20">
          <span class="w-6 h-6 border-2 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin" />
        </div>
      </Show>

      <Show when={!settingsData.loading}>
        <div class="p-5 flex flex-col gap-4">
          
          <Show when={activeTab() === 'links'}>
            <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} class="flex flex-col gap-4">
              {renderSetting('removeLinks', 'removeLinks', 'removeLinksDesc')}
              {renderSetting('blockBots', 'blockBots', 'blockBotsDesc')}
              {renderSetting('removeBotInviters', 'removeBotInviters', 'removeBotInvitersDesc')}
              {renderSetting('blockDomains', 'blockDomains', 'blockDomainsDesc')}
              {renderSetting('blockUsernames', 'blockUsernames', 'blockUsernamesDesc')}
            </Motion.div>
          </Show>

          <Show when={activeTab() === 'text'}>
            <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} class="flex flex-col gap-4">
              {renderSetting('blockHashtags', 'blockHashtags', 'blockHashtagsDesc')}
              {renderSetting('blockTextPatterns', 'blockTextPatterns', 'blockTextPatternsDesc')}
              {renderSetting('blockEmojis', 'blockEmojis', 'blockEmojisDesc')}
              {renderSetting('blockEmojiOnly', 'blockEmojiOnly', 'blockEmojiOnlyDesc')}
              {renderSetting('blockPhoneNumbers', 'blockPhoneNumbers', 'blockPhoneNumbersDesc')}
            </Motion.div>
          </Show>

          <Show when={activeTab() === 'media'}>
            <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} class="flex flex-col gap-4">
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

          <Show when={activeTab() === 'interactions'}>
            <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} class="flex flex-col gap-4">
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

          <Show when={activeTab() === 'languages'}>
            <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} class="flex flex-col gap-4">
              {renderSetting('blockLatinLetters', 'blockLatinLetters', 'blockLatinLettersDesc')}
              {renderSetting('blockPersianArabicLetters', 'blockPersianArabicLetters', 'blockPersianArabicLettersDesc')}
              {renderSetting('blockCyrillicLetters', 'blockCyrillicLetters', 'blockCyrillicLettersDesc')}
              {renderSetting('blockChineseCharacters', 'blockChineseCharacters', 'blockChineseCharactersDesc')}
            </Motion.div>
          </Show>

          <Show when={activeTab() === 'keywords'}>
            <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} class="flex flex-col gap-6">
              
              {/* Banned Keywords */}
              <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[#ff3b30]">block</span>
                  <div class="flex flex-col">
                    <span class="text-[15px] font-bold text-white">{t('contentRestrictions.bannedKeywords')}</span>
                    <span class="text-[12px] text-[#8e8e93] leading-snug">{t('contentRestrictions.bannedKeywordsDesc')}</span>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  <For each={bannedKeywords()}>
                    {(kw) => (
                      <span class="bg-[#ff3b30]/10 text-[#ff3b30] px-3 py-1.5 rounded-xl text-[13px] font-bold flex items-center gap-1.5">
                        {kw}
                        <button onClick={() => { setBannedKeywords(bannedKeywords().filter(k => k !== kw)); setIsDirty(true); }} class="hover:opacity-70">
                          <span class="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </span>
                    )}
                  </For>
                </div>

                <div class="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={newBannedKeyword()}
                    onInput={(e) => setNewBannedKeyword(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addBannedKeyword()}
                    placeholder={t('contentRestrictions.addKeyword')}
                    class="flex-1 bg-[#2c2c2e] text-white text-[14px] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3390ec]"
                  />
                  <button onClick={addBannedKeyword} class="w-10 h-10 rounded-xl bg-[#3390ec] text-white flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined">add</span>
                  </button>
                </div>
              </div>

              {/* Required Keywords */}
              <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[#34c759]">fact_check</span>
                  <div class="flex flex-col">
                    <span class="text-[15px] font-bold text-white">{t('contentRestrictions.requiredKeywords')}</span>
                    <span class="text-[12px] text-[#8e8e93] leading-snug">{t('contentRestrictions.requiredKeywordsDesc')}</span>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2">
                  <For each={requiredKeywords()}>
                    {(kw) => (
                      <span class="bg-[#34c759]/10 text-[#34c759] px-3 py-1.5 rounded-xl text-[13px] font-bold flex items-center gap-1.5">
                        {kw}
                        <button onClick={() => { setRequiredKeywords(requiredKeywords().filter(k => k !== kw)); setIsDirty(true); }} class="hover:opacity-70">
                          <span class="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </span>
                    )}
                  </For>
                </div>

                <div class="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={newRequiredKeyword()}
                    onInput={(e) => setNewRequiredKeyword(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addRequiredKeyword()}
                    placeholder={t('contentRestrictions.addKeyword')}
                    class="flex-1 bg-[#2c2c2e] text-white text-[14px] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3390ec]"
                  />
                  <button onClick={addRequiredKeyword} class="w-10 h-10 rounded-xl bg-[#3390ec] text-white flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined">add</span>
                  </button>
                </div>
              </div>

            </Motion.div>
          </Show>

        </div>
      </Show>

      {/* Floating Save Button */}
      <div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/90 to-transparent z-30">
        <button 
          onClick={handleSave}
          disabled={isSaving() || !isDirty()}
          class="w-full h-14 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-2xl font-bold text-[16px] shadow-[0_10px_25px_rgba(51,144,236,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Show when={!isSaving()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}>
            {t('generalSettings.saveSettings')}
            <span class="material-symbols-outlined text-[20px]">save</span>
          </Show>
        </button>
      </div>
    </div>
  );
};
