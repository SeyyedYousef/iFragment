import { Component, createSignal, Show, onMount, onCleanup } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { NumberInputField, StringListField, ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { groupApi } from '@/shared/api/bot-management.js';

export const MandatoryPage: Component = () => {
  const navigate = useNavigate();
  const params = useParams();
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);

  const [cfg, setCfg] = createSignal({
    forcedAddEnabled: false,
    forcedAddCount: 0,
    forceJoinEnabled: false,
    requiredChannels: [] as string[],
    verificationEnabled: false,
    excludedUsers: [] as string[]
  });

  const [isDirty, setIsDirty] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);

  const [sd] = createSignal(groupApi.getSettings(params.id));

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => window.history.back());
    onCleanup(() => off());

    sd().then(res => {
      setCfg({
        forcedAddEnabled: res.mandatory_settings?.forced_add_enabled ?? false,
        forcedAddCount: res.mandatory_settings?.forced_add_count ?? 0,
        forceJoinEnabled: res.mandatory_settings?.force_join_enabled ?? false,
        requiredChannels: res.mandatory_settings?.required_channels ?? [],
        verificationEnabled: res.mandatory_settings?.verification_enabled ?? false,
        excludedUsers: res.mandatory_settings?.exemptions ?? []
      });
      setIsDirty(false);
    }).catch(() => {});
  });

  const updateCfg = (key: keyof ReturnType<typeof cfg>, value: any) => {
    setCfg(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!isDirty()) return;
    hapticFeedback.notificationOccurred('success');
    setIsSaving(true);
    try {
      const current = await sd();
      await groupApi.updateSettings(params.id, 'mandatory_membership', {
        forced_add_enabled: cfg().forcedAddEnabled,
        forced_add_count: cfg().forcedAddCount,
        force_join_enabled: cfg().forceJoinEnabled,
        required_channels: cfg().requiredChannels,
        verification_enabled: cfg().verificationEnabled,
        exemptions: cfg().excludedUsers,
      }, current.version);
      setIsDirty(false);
      navigate(`/group/${params.id}`);
    } catch (e) {
      hapticFeedback.notificationOccurred('error');
    } finally {
      setIsSaving(false);
    }
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
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[#3390ec]">person_add</span>
              <h2 class="text-[16px] font-bold text-white">{t('mandatorySettings.forcedAdd')}</h2>
            </div>
            <ToggleSwitch checked={cfg().forcedAddEnabled} onChange={(v) => updateCfg('forcedAddEnabled', v)} />
          </div>

          <Show when={cfg().forcedAddEnabled}>
            <div class="h-[1px] bg-[#2a2a2a] w-full my-1"></div>
            <NumberInputField 
              label={t('mandatorySettings.forcedAddCount')}
              description={t('mandatorySettings.forcedAddCountDesc')}
              value={cfg().forcedAddCount}
              onChange={(v) => updateCfg('forcedAddCount', v)}
              placeholder="0"
            />
          </Show>
        </Motion.div>

        {/* Force Join Channels */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4"
        >
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[#ffcc00]">campaign</span>
              <h2 class="text-[16px] font-bold text-white">{t('mandatorySettings.forceJoin')}</h2>
            </div>
            <ToggleSwitch checked={cfg().forceJoinEnabled} onChange={(v) => updateCfg('forceJoinEnabled', v)} />
          </div>

          <Show when={cfg().forceJoinEnabled}>
            <div class="h-[1px] bg-[#2a2a2a] w-full my-1"></div>
            <StringListField 
              label={t('mandatorySettings.reqChannels')}
              description={t('mandatorySettings.reqChannelsDesc')}
              placeholder="@username or channel URL"
              items={cfg().requiredChannels}
              onAdd={(item) => updateCfg('requiredChannels', [...cfg().requiredChannels, item])}
              onRemove={(item) => updateCfg('requiredChannels', cfg().requiredChannels.filter(c => c !== item))}
            />
          </Show>
        </Motion.div>

        {/* Info Banner for Verification */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          class="bg-[#34c759]/10 border border-[#34c759]/30 rounded-2xl p-4 flex items-start gap-3 relative"
        >
          <div class="absolute right-4 top-4">
            <ToggleSwitch checked={cfg().verificationEnabled} onChange={(v) => updateCfg('verificationEnabled', v)} />
          </div>
          <span class="material-symbols-outlined text-[#34c759] text-[24px] shrink-0 mt-0.5">verified_user</span>
          <div class="flex flex-col pr-12">
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
            items={cfg().excludedUsers}
            onAdd={(item) => updateCfg('excludedUsers', [...cfg().excludedUsers, item])}
            onRemove={(item) => updateCfg('excludedUsers', cfg().excludedUsers.filter(e => e !== item))}
          />
        </Motion.div>
      </div>

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
