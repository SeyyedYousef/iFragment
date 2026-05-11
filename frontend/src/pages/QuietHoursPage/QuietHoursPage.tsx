import { Component, createSignal, createResource, For, Show, onMount, onCleanup } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { SettingsSection } from '@/shared/ui/settings-controls.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { groupApi } from '@/shared/api/bot-management.js';

interface QuietPeriod {
  id: string;
  start: string;
  end: string;
}

interface QuietHoursConfig {
  emergencyLock: boolean;
  adminOverride: boolean;
  sendNotifications: boolean;
  periods: QuietPeriod[];
}

const defaultConfig: QuietHoursConfig = {
  emergencyLock: false,
  adminOverride: true,
  sendNotifications: true,
  periods: [],
};

export const QuietHoursPage: Component = () => {
  const navigate = useNavigate();
  const params = useParams();

  // Menu State
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isDirty, setIsDirty] = createSignal(false);
  const [settingsVersion, setSettingsVersion] = createSignal(1);
  const [overlapWarning, setOverlapWarning] = createSignal('');

  const [config, setConfig] = createStore<QuietHoursConfig>({ ...defaultConfig });

  const [settingsData] = createResource(
    () => params.id,
    async (groupId) => {
      const data = await groupApi.getSettings(groupId);
      setSettingsVersion(data.version);
      const qh = (data.quiet_hours || {}) as Partial<QuietHoursConfig>;
      setConfig(reconcile({ ...defaultConfig, ...qh }));
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

  const checkOverlaps = (periods: QuietPeriod[]) => {
    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        const a = periods[i], b = periods[j];
        if (a.start < b.end && b.start < a.end) {
          setOverlapWarning(`Period overlaps!`);
          return;
        }
      }
    }
    setOverlapWarning('');
  };

  const addPeriod = () => {
    hapticFeedback.impactOccurred('medium');
    const newPeriod: QuietPeriod = { id: crypto.randomUUID(), start: '22:00', end: '08:00' };
    setConfig('periods', [...config.periods, newPeriod]);
    setIsDirty(true);
    checkOverlaps([...config.periods, newPeriod]);
  };

  const removePeriod = (id: string) => {
    hapticFeedback.impactOccurred('light');
    const updated = config.periods.filter(p => p.id !== id);
    setConfig('periods', updated);
    setIsDirty(true);
    checkOverlaps(updated);
  };

  const updatePeriod = (id: string, field: 'start' | 'end', value: string) => {
    const updated = config.periods.map(p => p.id === id ? { ...p, [field]: value } : p);
    setConfig('periods', updated);
    setIsDirty(true);
    checkOverlaps(updated);
  };

  const handleSave = async () => {
    if (overlapWarning()) {
      hapticFeedback.notificationOccurred('error');
      return;
    }
    if (!isDirty()) return;
    
    hapticFeedback.notificationOccurred('success');
    setIsSaving(true);
    try {
      const result = await groupApi.updateSettings(params.id, 'quiet_hours', config as any, settingsVersion());
      setSettingsVersion(result.version);
      setIsDirty(false);
      navigate(`/group/${params.id}`);
      backButton.hide();
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
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-black text-white">{t('quietHoursSettings.title')}</h1>
            <Show when={isDirty()}>
              <span class="w-2.5 h-2.5 rounded-full bg-[#ff9f0a] animate-pulse" />
            </Show>
          </div>
          <p class="text-[13px] text-[#8e8e93] font-medium leading-snug">
            {t('quietHoursSettings.subtitle')}
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
        activeTab="quiet" 
      />

      <Show when={settingsData.loading}>
        <div class="flex items-center justify-center py-20">
          <span class="w-6 h-6 border-2 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin" />
        </div>
      </Show>

      <Show when={!settingsData.loading}>
        <div class="p-5 flex flex-col gap-5">

          {/* Emergency Lock */}
          <Motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div class={`rounded-3xl border p-1 transition-colors duration-300 ${
              config.emergencyLock ? 'bg-[#ff3b30]/10 border-[#ff3b30]/30' : 'bg-[#1c1c1c] border-[#2a2a2a]'
            }`}>
              <SettingsSection
                title={t('quietHoursSettings.emergencyLock')}
                description={t('quietHoursSettings.emergencyLockDesc')}
                enabled={config.emergencyLock}
                onToggle={(val) => { setConfig('emergencyLock', val); setIsDirty(true); }}
              />
            </div>
          </Motion.div>

          {/* Info Banner for Admins */}
          <Motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            class="bg-[#ffcc00]/10 border border-[#ffcc00]/30 rounded-2xl p-4 flex items-start gap-3"
          >
            <span class="material-symbols-outlined text-[#ffcc00] text-[24px] shrink-0 mt-0.5">admin_panel_settings</span>
            <div class="flex flex-col">
              <span class="text-[14px] font-bold text-white mb-1">{t('quietHoursSettings.adminOverride')}</span>
              <span class="text-[12px] text-[#8e8e93] leading-relaxed">{t('quietHoursSettings.adminOverrideDesc')}</span>
            </div>
          </Motion.div>

          {/* Quiet Periods */}
          <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            class="flex flex-col gap-3"
          >
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[#3390ec]">schedule</span>
                <h2 class="text-[16px] font-bold text-white">{t('quietHoursSettings.quietPeriods')}</h2>
              </div>
              <button 
                onClick={addPeriod}
                class="flex items-center gap-1 text-[#3390ec] text-[13px] font-bold bg-[#3390ec]/10 px-3 py-1.5 rounded-full hover:bg-[#3390ec]/20 transition-colors"
              >
                <span class="material-symbols-outlined text-[16px]">add</span>
                {t('quietHoursSettings.addPeriod')}
              </button>
            </div>

            <Show when={overlapWarning()}>
              <div class="bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-[#ff3b30] text-[12px] font-bold rounded-xl p-3 flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px]">error</span>
                {overlapWarning()}
              </div>
            </Show>

            <div class="flex flex-col gap-3">
              <For each={config.periods}>
                {(period) => (
                  <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3 relative overflow-hidden group">
                    <div class="flex items-center justify-between">
                      <span class="text-[14px] font-bold text-white">{t('quietHoursSettings.periodLabel')}</span>
                      <button 
                        onClick={() => removePeriod(period.id)}
                        class="w-8 h-8 rounded-full bg-[#ff3b30]/10 text-[#ff3b30] flex items-center justify-center hover:bg-[#ff3b30]/20 transition-colors"
                      >
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3">
                      <div class="flex flex-col gap-1.5">
                        <label class="text-[12px] font-bold text-[#8e8e93]">{t('quietHoursSettings.startTime')}</label>
                        <input 
                          type="time" 
                          value={period.start} 
                          onInput={(e) => updatePeriod(period.id, 'start', e.currentTarget.value)} 
                          class="w-full bg-[#2c2c2e] text-white text-[15px] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3390ec]" 
                        />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label class="text-[12px] font-bold text-[#8e8e93]">{t('quietHoursSettings.endTime')}</label>
                        <input 
                          type="time" 
                          value={period.end} 
                          onInput={(e) => updatePeriod(period.id, 'end', e.currentTarget.value)} 
                          class="w-full bg-[#2c2c2e] text-white text-[15px] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#3390ec]" 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </For>
              
              <Show when={config.periods.length === 0}>
                <div class="bg-[#1c1c1c] border border-dashed border-[#2a2a2a] rounded-3xl p-6 flex flex-col items-center justify-center gap-2">
                  <span class="material-symbols-outlined text-[#8e8e93] text-[32px]">event_busy</span>
                  <span class="text-[13px] text-[#8e8e93] font-medium text-center">{t('quietHoursSettings.noPeriods')}</span>
                </div>
              </Show>
            </div>
          </Motion.div>

          {/* Messaging */}
          <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <SettingsSection
              title={t('quietHoursSettings.sendMessages')}
              description={t('quietHoursSettings.sendMessagesDesc')}
              enabled={config.sendNotifications}
              onToggle={(val) => { setConfig('sendNotifications', val); setIsDirty(true); }}
              hasEditText={true}
              onEditText={() => navigate(`/group/${params.id}/settings/custom-texts`)}
            />
          </Motion.div>

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
