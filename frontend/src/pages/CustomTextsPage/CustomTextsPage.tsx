import { Component, createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { createStore } from 'solid-js/store';
import { t, locale } from '@/shared/i18n/index.js';
import { InlineButtonField } from '@/shared/ui/settings-controls.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';

const isRtl = () => locale() === 'fa';

export const CustomTextsPage: Component = () => {
  const navigate = useNavigate();
  const params = useParams();

  // Menu State
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);

  // Handle Telegram Back Button
  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      hapticFeedback.impactOccurred('light');
      window.history.back();
    });
    onCleanup(() => off());
  });

  const [isSaving, setIsSaving] = createSignal(false);

  // Settings State
  const [welcomeText, setWelcomeText] = createSignal('');
  const [warningText, setWarningText] = createSignal('');
  const [silenceStartText, setSilenceStartText] = createSignal('');
  const [silenceEndText, setSilenceEndText] = createSignal('');
  const [rulesText, setRulesText] = createSignal('');

  const [inlineButtons, setInlineButtons] = createStore<{ id: string; title: string; url: string }[]>([]);

  const handleSave = () => {
    hapticFeedback.notificationOccurred('success');
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      navigate(`/group/${params.id}`);
      backButton.hide();
    }, 800);
  };

  return (
    <div class="min-h-screen bg-[#0f1014] text-white pb-24" dir={isRtl() ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div class="pt-6 pb-4 px-5 sticky top-0 bg-[#0f1014]/90 backdrop-blur-md z-20 border-b border-[#2a2a2a] flex items-center justify-between">
        <Motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          class="flex flex-col gap-1"
        >
          <h1 class="text-2xl font-black text-white">{t('customTextsSettings.title')}</h1>
          <p class="text-[13px] text-[#8e8e93] font-medium leading-snug">
            {t('customTextsSettings.subtitle')}
          </p>
        </Motion.div>

        <button 
          onClick={() => setIsMenuOpen(true)}
          class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors shrink-0"
        >
          <span class="material-symbols-outlined text-white text-[20px]">menu</span>
        </button>
      </div>

      <HamburgerMenu 
        isOpen={isMenuOpen()} 
        onClose={() => setIsMenuOpen(false)} 
        groupId={params.id} 
        activeTab="custom" 
      />

      <div class="p-5 flex flex-col gap-5">

        {/* Info Banner for Placeholders */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          class="bg-[#3390ec]/10 border border-[#3390ec]/30 rounded-2xl p-4 flex flex-col gap-3"
        >
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[#3390ec] text-[22px]">data_object</span>
            <span class="text-[14px] font-bold text-white">{t('customTextsSettings.placeholders')}</span>
          </div>
          
          <div class="grid grid-cols-2 gap-x-4 gap-y-2">
            <For each={[
              { tag: '{user}', label: t('customTextsSettings.phUser') },
              { tag: '{id}', label: t('customTextsSettings.phId') },
              { tag: '{group}', label: t('customTextsSettings.phGroup') },
              { tag: '{time}', label: t('customTextsSettings.phTime') },
              { tag: '{reason}', label: t('customTextsSettings.phReason') },
              { tag: '{rule}', label: t('customTextsSettings.phRule') },
              { tag: '{count}', label: t('customTextsSettings.phCount') },
              { tag: '{threshold}', label: t('customTextsSettings.phThreshold') },
              { tag: '{number}', label: t('customTextsSettings.phNumber') },
              { tag: '{added}', label: t('customTextsSettings.phAdded') },
              { tag: '{remainadd}', label: t('customTextsSettings.phRemainAdd') },
              { tag: '{channel_names}', label: t('customTextsSettings.phChannelNames') },
            ]}>
              {(ph) => (
                <div class="flex flex-col gap-0.5">
                  <code class="text-[#3390ec] font-mono text-[11px] font-bold">{ph.tag}</code>
                  <span class="text-[10px] text-[#8e8e93] leading-tight">{ph.label}</span>
                </div>
              )}
            </For>
          </div>
        </Motion.div>

        {/* Welcome Message */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          class="flex flex-col gap-2"
        >
          <label class="text-[15px] font-bold text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-[#34c759] text-[18px]">waving_hand</span>
            {t('customTextsSettings.welcomeText')}
          </label>
          <span class="text-[12px] text-[#8e8e93] leading-snug px-1 mb-1">{t('customTextsSettings.welcomeTextDesc')}</span>
          <textarea 
            value={welcomeText()}
            onInput={(e) => setWelcomeText(e.currentTarget.value)}
            placeholder={t('customTextsSettings.welcomePlaceholder')}
            dir="auto"
            class="w-full h-28 bg-[#1c1c1c] text-white text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] transition-all resize-none placeholder-[#8e8e93]"
          />
        </Motion.div>

        {/* Warning Message */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          class="flex flex-col gap-2 mt-2"
        >
          <label class="text-[15px] font-bold text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-[#ffcc00] text-[18px]">warning</span>
            {t('customTextsSettings.warningText')}
          </label>
          <span class="text-[12px] text-[#8e8e93] leading-snug px-1 mb-1">{t('customTextsSettings.warningTextDesc')}</span>
          <textarea 
            value={warningText()}
            onInput={(e) => setWarningText(e.currentTarget.value)}
            dir="auto"
            class="w-full h-24 bg-[#1c1c1c] text-white text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] transition-all resize-none placeholder-[#8e8e93]"
          />
        </Motion.div>

        {/* Silence Messaging */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          class="flex flex-col gap-4 mt-2"
        >
          <div class="flex flex-col gap-2">
            <label class="text-[15px] font-bold text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-[#ff3b30] text-[18px]">notifications_paused</span>
              {t('customTextsSettings.silenceStartText')}
            </label>
            <span class="text-[12px] text-[#8e8e93] leading-snug px-1 mb-1">{t('customTextsSettings.silenceStartTextDesc')}</span>
            <textarea 
              value={silenceStartText()}
              onInput={(e) => setSilenceStartText(e.currentTarget.value)}
              dir="auto"
              class="w-full h-20 bg-[#1c1c1c] text-white text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] transition-all resize-none placeholder-[#8e8e93]"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-[15px] font-bold text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-[#34c759] text-[18px]">notifications_active</span>
              {t('customTextsSettings.silenceEndText')}
            </label>
            <span class="text-[12px] text-[#8e8e93] leading-snug px-1 mb-1">{t('customTextsSettings.silenceEndTextDesc')}</span>
            <textarea 
              value={silenceEndText()}
              onInput={(e) => setSilenceEndText(e.currentTarget.value)}
              dir="auto"
              class="w-full h-20 bg-[#1c1c1c] text-white text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] transition-all resize-none placeholder-[#8e8e93]"
            />
          </div>
        </Motion.div>

        {/* Rules Text */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          class="flex flex-col gap-2 mt-2"
        >
          <label class="text-[15px] font-bold text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-[#ffcc00] text-[18px]">gavel</span>
            {t('customTextsSettings.rulesText')}
          </label>
          <span class="text-[12px] text-[#8e8e93] leading-snug px-1 mb-1">{t('customTextsSettings.rulesTextDesc')}</span>
          <textarea 
            value={rulesText()}
            onInput={(e) => setRulesText(e.currentTarget.value)}
            dir="auto"
            class="w-full h-32 bg-[#1c1c1c] text-white text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] transition-all resize-none placeholder-[#8e8e93]"
          />
        </Motion.div>

        {/* Inline Buttons */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col mt-2"
        >
          <InlineButtonField 
            label={t('customTextsSettings.inlineButtons')}
            description={t('customTextsSettings.inlineButtonsDesc')}
            buttons={inlineButtons}
            onAdd={(btn) => setInlineButtons([...inlineButtons, btn])}
            onRemove={(id) => setInlineButtons(inlineButtons.filter(b => b.id !== id))}
          />
        </Motion.div>

      </div>

      {/* Floating Save Button */}
      <div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/90 to-transparent z-30">
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
