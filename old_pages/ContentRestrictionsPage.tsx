import { Component, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { SettingsSection } from '@/shared/ui/settings-controls.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';


// Type definitions for restriction settings
type RestrictionSetting = {
  enabled: boolean;
  window: string;
  start: string;
  end: string;
  penalty: string;
};

const defaultSetting = (): RestrictionSetting => ({
  enabled: false,
  window: 'Always',
  start: '08:00',
  end: '22:00',
  penalty: 'default'
});

export const ContentRestrictionsPage: Component = () => {
  const navigate = useNavigate();
  const params = useParams();
  
  // Menu State
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);

  const [isSaving, setIsSaving] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal('links'); // 'links', 'text', 'media', 'interactions', 'languages', 'keywords'

  // Using a store to manage 31+ settings efficiently
  const [settings, setSettings] = createStore<Record<string, RestrictionSetting>>({
    // Links & IDs
    removeLinks: defaultSetting(),
    blockBots: defaultSetting(),
    removeBotInviters: defaultSetting(),
    blockDomains: defaultSetting(),
    blockUsernames: defaultSetting(),
    // Text & Symbols
    blockHashtags: defaultSetting(),
    blockTextPatterns: defaultSetting(),
    blockEmojis: defaultSetting(),
    blockEmojiOnly: defaultSetting(),
    blockPhoneNumbers: defaultSetting(),
    // Media & Files
    blockPhotos: defaultSetting(),
    blockStickers: defaultSetting(),
    blockLocations: defaultSetting(),
    blockAudio: defaultSetting(),
    blockVoiceMessages: defaultSetting(),
    blockFiles: defaultSetting(),
    blockGifs: defaultSetting(),
    blockCaptionless: defaultSetting(),
    // Interactions
    blockForwards: defaultSetting(),
    restrictChannelForwards: defaultSetting(),
    blockAppMessages: defaultSetting(),
    blockPolls: defaultSetting(),
    blockInlineKeyboards: defaultSetting(),
    blockGames: defaultSetting(),
    blockSlashCommands: defaultSetting(),
    blockUserReplies: defaultSetting(),
    blockCrossChatReplies: defaultSetting(),
    // Languages
    blockLatinLetters: defaultSetting(),
    blockPersianArabicLetters: defaultSetting(),
    blockCyrillicLetters: defaultSetting(),
    blockChineseCharacters: defaultSetting(),
  });

  // Keywords special state
  const [bannedKeywords, setBannedKeywords] = createSignal<string[]>([]);
  const [requiredKeywords, setRequiredKeywords] = createSignal<string[]>([]);
  const [newBannedKeyword, setNewBannedKeyword] = createSignal('');
  const [newRequiredKeyword, setNewRequiredKeyword] = createSignal('');

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      window.history.back();
    });
    onCleanup(() => {
      off();
    });
  });

  const handleSave = () => {
    hapticFeedback.notificationOccurred('success');
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      navigate(`/group/${params.id}`);
    }, 800);
  };

  const addBannedKeyword = () => {
    if (newBannedKeyword().trim()) {
      setBannedKeywords([...bannedKeywords(), newBannedKeyword().trim()]);
      setNewBannedKeyword('');
    }
  };

  const addRequiredKeyword = () => {
    if (newRequiredKeyword().trim()) {
      setRequiredKeywords([...requiredKeywords(), newRequiredKeyword().trim()]);
      setNewRequiredKeyword('');
    }
  };

  // Helper to render a section
  const renderSetting = (key: string, titleKey: string, descKey: string) => (
    <SettingsSection
      title={t(`contentRestrictions.${titleKey}` as any)}
      description={t(`contentRestrictions.${descKey}` as any)}
      enabled={settings[key].enabled}
      onToggle={(v) => setSettings(key, 'enabled', v)}
      hasWindow={true}
      windowVal={settings[key].window}
      onWindowChange={(v) => setSettings(key, 'window', v)}
      customStart={settings[key].start}
      onCustomStart={(v) => setSettings(key, 'start', v)}
      customEnd={settings[key].end}
      onCustomEnd={(v) => setSettings(key, 'end', v)}
      hasPenalty={true}
      penaltyVal={settings[key].penalty}
      onPenaltyChange={(v) => setSettings(key, 'penalty', v)}
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

  return (
    <div class="min-h-screen bg-[#0f1014] pb-24 relative text-white">
      {/* Header */}
      <div class="px-5 pt-6 pb-4 flex flex-col gap-1 sticky top-0 bg-[#0f1014]/90 backdrop-blur-md z-30 border-b border-[#1c1c1c]">
        <div class="flex items-center justify-between">
          <div class="flex flex-col gap-1">
            <h1 class="text-2xl font-black text-white">{t('contentRestrictions.title')}</h1>
            <p class="text-[13px] font-medium text-[#8e8e93] leading-snug">{t('contentRestrictions.subtitle')}</p>
          </div>
          <button 
            onClick={() => setIsMenuOpen(true)}
            class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors shrink-0 mt-1"
          >
            <span class="material-symbols-outlined text-white text-[20px]">menu</span>
          </button>
        </div>
        
        {/* Horizontal Tabs */}
        <div class="flex overflow-x-auto no-scrollbar gap-2 mt-4 pb-2">
          <For each={tabs}>
            {(tab) => (
              <button
                onClick={() => {
                  hapticFeedback.selectionChanged();
                  setActiveTab(tab.id);
                }}
                class={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl whitespace-nowrap transition-colors border ${
                  activeTab() === tab.id 
                    ? 'bg-[#3390ec]/10 border-[#3390ec]/30 text-[#3390ec]' 
                    : 'bg-[#1c1c1c] border-[#2a2a2a] text-[#8e8e93] hover:bg-[#2a2a2a]'
                }`}
              >
                <span class="material-symbols-outlined text-[18px]">{tab.icon}</span>
                <span class="text-[13px] font-bold">{tab.label}</span>
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

      <div class="px-5 mt-4 space-y-4">
        {/* Links & IDs Tab */}
        <Show when={activeTab() === 'links'}>
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} class="space-y-4">
            {renderSetting('removeLinks', 'removeLinks', 'removeLinksDesc')}
            {renderSetting('blockBots', 'blockBots', 'blockBotsDesc')}
            {renderSetting('removeBotInviters', 'removeBotInviters', 'removeBotInvitersDesc')}
            {renderSetting('blockDomains', 'blockDomains', 'blockDomainsDesc')}
            {renderSetting('blockUsernames', 'blockUsernames', 'blockUsernamesDesc')}
          </Motion.div>
        </Show>

        {/* Text & Symbols Tab */}
        <Show when={activeTab() === 'text'}>
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} class="space-y-4">
            {renderSetting('blockHashtags', 'blockHashtags', 'blockHashtagsDesc')}
            {renderSetting('blockTextPatterns', 'blockTextPatterns', 'blockTextPatternsDesc')}
            {renderSetting('blockEmojis', 'blockEmojis', 'blockEmojisDesc')}
            {renderSetting('blockEmojiOnly', 'blockEmojiOnly', 'blockEmojiOnlyDesc')}
            {renderSetting('blockPhoneNumbers', 'blockPhoneNumbers', 'blockPhoneNumbersDesc')}
          </Motion.div>
        </Show>

        {/* Media & Files Tab */}
        <Show when={activeTab() === 'media'}>
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} class="space-y-4">
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

        {/* Interactions Tab */}
        <Show when={activeTab() === 'interactions'}>
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} class="space-y-4">
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

        {/* Languages Tab */}
        <Show when={activeTab() === 'languages'}>
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} class="space-y-4">
            {renderSetting('blockLatinLetters', 'blockLatinLetters', 'blockLatinLettersDesc')}
            {renderSetting('blockPersianArabicLetters', 'blockPersianArabicLetters', 'blockPersianArabicLettersDesc')}
            {renderSetting('blockCyrillicLetters', 'blockCyrillicLetters', 'blockCyrillicLettersDesc')}
            {renderSetting('blockChineseCharacters', 'blockChineseCharacters', 'blockChineseCharactersDesc')}
          </Motion.div>
        </Show>

        {/* Keywords Tab */}
        <Show when={activeTab() === 'keywords'}>
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} class="space-y-4">
            
            {/* Banned Keywords */}
            <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3">
              <div class="flex flex-col flex-1 min-w-0">
                <span class="text-[15px] font-bold text-[#ff3b30]">{t('contentRestrictions.bannedKeywords')}</span>
                <span class="text-[12px] text-[#8e8e93] leading-snug">{t('contentRestrictions.bannedKeywordsDesc')}</span>
              </div>
              
              <div class="flex flex-wrap gap-2 mt-2">
                <For each={bannedKeywords()}>
                  {(kw, i) => (
                    <div class="flex items-center gap-1 bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-[#ff3b30] px-3 py-1.5 rounded-full text-[13px] font-bold">
                      <span>{kw}</span>
                      <button onClick={() => setBannedKeywords(prev => prev.filter((_, idx) => idx !== i()))} class="opacity-70 hover:opacity-100 material-symbols-outlined text-[16px] ml-1">close</button>
                    </div>
                  )}
                </For>
              </div>

              <div class="flex items-center gap-2 mt-2">
                <input 
                  type="text" 
                  value={newBannedKeyword()} 
                  onInput={(e) => setNewBannedKeyword(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBannedKeyword()}
                  placeholder={t('contentRestrictions.addKeywordPlaceholder')}
                  class="flex-1 bg-[#2c2c2e] text-white text-[14px] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff3b30]"
                />
                <button onClick={addBannedKeyword} class="w-12 h-12 shrink-0 rounded-xl bg-[#ff3b30] flex items-center justify-center text-white hover:bg-[#ff3b30]/80 transition-colors">
                  <span class="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>

            {/* Required Keywords */}
            <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3">
              <div class="flex flex-col flex-1 min-w-0">
                <span class="text-[15px] font-bold text-[#34c759]">{t('contentRestrictions.requiredKeywords')}</span>
                <span class="text-[12px] text-[#8e8e93] leading-snug">{t('contentRestrictions.requiredKeywordsDesc')}</span>
              </div>
              
              <div class="flex flex-wrap gap-2 mt-2">
                <For each={requiredKeywords()}>
                  {(kw, i) => (
                    <div class="flex items-center gap-1 bg-[#34c759]/10 border border-[#34c759]/30 text-[#34c759] px-3 py-1.5 rounded-full text-[13px] font-bold">
                      <span>{kw}</span>
                      <button onClick={() => setRequiredKeywords(prev => prev.filter((_, idx) => idx !== i()))} class="opacity-70 hover:opacity-100 material-symbols-outlined text-[16px] ml-1">close</button>
                    </div>
                  )}
                </For>
              </div>

              <div class="flex items-center gap-2 mt-2">
                <input 
                  type="text" 
                  value={newRequiredKeyword()} 
                  onInput={(e) => setNewRequiredKeyword(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addRequiredKeyword()}
                  placeholder={t('contentRestrictions.addKeywordPlaceholder')}
                  class="flex-1 bg-[#2c2c2e] text-white text-[14px] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#34c759]"
                />
                <button onClick={addRequiredKeyword} class="w-12 h-12 shrink-0 rounded-xl bg-[#34c759] flex items-center justify-center text-white hover:bg-[#34c759]/80 transition-colors">
                  <span class="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>

          </Motion.div>
        </Show>
      </div>

      {/* Floating Save Bar */}
      <div class="fixed bottom-6 left-0 right-0 px-5 z-40">
        <button 
          onClick={handleSave}
          disabled={isSaving()}
          class="w-full h-14 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-2xl font-bold text-[16px] shadow-[0_10px_25px_rgba(51,144,236,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
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
