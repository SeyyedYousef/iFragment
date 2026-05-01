import { Component, createSignal, Show, onMount, onCleanup } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { createStore } from 'solid-js/store';
import { t } from '@/shared/i18n/index.js';
import { NumberInputField, StringListField } from '@/shared/ui/settings-controls.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';


export const MandatoryPage: Component = () => {
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
  const [forcedAddCount, setForcedAddCount] = createSignal(0);
  
  const [channels, setChannels] = createStore<string[]>([]);
  const [exemptions, setExemptions] = createStore<string[]>([]);

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
    <div class="min-h-screen bg-[#0f1014] text-white pb-24">
      {/* Header */}
      <div class="pt-6 pb-4 px-5 sticky top-0 bg-[#0f1014]/90 backdrop-blur-md z-20 border-b border-[#2a2a2a] flex items-center justify-between">
        <Motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          class="flex flex-col gap-1"
        >
          <h1 class="text-2xl font-black text-white">{t('mandatorySettings.title')}</h1>
          <p class="text-[13px] text-[#8e8e93] font-medium leading-snug">
            {t('mandatorySettings.subtitle')}
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
        activeTab="mandatory" 
      />

      <div class="p-5 flex flex-col gap-5">

        {/* Forced Add */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="material-symbols-outlined text-[#3390ec]">person_add</span>
            <h2 class="text-[16px] font-bold text-white">{t('mandatorySettings.forcedAdd')}</h2>
          </div>

          <NumberInputField 
            label={t('mandatorySettings.forcedAddCount')}
            description={t('mandatorySettings.forcedAddCountDesc')}
            value={forcedAddCount()}
            onChange={setForcedAddCount}
            placeholder="0"
          />
        </Motion.div>

        {/* Force Join Channels */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="material-symbols-outlined text-[#ffcc00]">campaign</span>
            <h2 class="text-[16px] font-bold text-white">{t('mandatorySettings.forceJoin')}</h2>
          </div>

          <StringListField 
            label={t('mandatorySettings.reqChannels')}
            description={t('mandatorySettings.reqChannelsDesc')}
            placeholder="@username or channel URL"
            items={channels}
            onAdd={(item) => setChannels([...channels, item])}
            onRemove={(item) => setChannels(channels.filter(c => c !== item))}
          />
        </Motion.div>

        {/* Info Banner for Verification */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          class="bg-[#34c759]/10 border border-[#34c759]/30 rounded-2xl p-4 flex items-start gap-3"
        >
          <span class="material-symbols-outlined text-[#34c759] text-[24px] shrink-0 mt-0.5">verified_user</span>
          <div class="flex flex-col">
            <span class="text-[14px] font-bold text-white mb-1">{t('mandatorySettings.verification')}</span>
            <span class="text-[12px] text-[#8e8e93] leading-relaxed">{t('mandatorySettings.verificationDesc')}</span>
          </div>
        </Motion.div>

        {/* Exemptions */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="material-symbols-outlined text-[#ff3b30]">do_not_disturb_off</span>
            <h2 class="text-[16px] font-bold text-white">{t('mandatorySettings.exemptions')}</h2>
          </div>

          <StringListField 
            label={t('mandatorySettings.excludedUsers')}
            description={t('mandatorySettings.excludedUsersDesc')}
            placeholder="@username or User ID"
            items={exemptions}
            onAdd={(item) => setExemptions([...exemptions, item])}
            onRemove={(item) => setExemptions(exemptions.filter(e => e !== item))}
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
