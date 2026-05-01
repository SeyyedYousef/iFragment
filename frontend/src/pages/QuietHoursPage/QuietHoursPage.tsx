import { Component, createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { createStore } from 'solid-js/store';
import { t } from '@/shared/i18n/index.js';
import { SettingsSection } from '@/shared/ui/settings-controls.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';


export const QuietHoursPage: Component = () => {
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
  const [emergencyLock, setEmergencyLock] = createSignal(false);
  const [sendMessages, setSendMessages] = createSignal(true);

  type Period = { id: string; start: string; end: string };
  const [periods, setPeriods] = createStore<Period[]>([
    { id: 'p1', start: '00:00', end: '08:00' } // default one period
  ]);

  const handleSave = () => {
    hapticFeedback.notificationOccurred('success');
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      navigate(`/group/${params.id}`);
      backButton.hide();
    }, 800);
  };

  const addPeriod = () => {
    hapticFeedback.impactOccurred('medium');
    setPeriods([...periods, { id: `p${Date.now()}`, start: '23:00', end: '07:00' }]);
  };

  const removePeriod = (id: string) => {
    hapticFeedback.impactOccurred('light');
    setPeriods(periods.filter(p => p.id !== id));
  };

  const updatePeriod = (id: string, field: 'start' | 'end', value: string) => {
    setPeriods(p => p.id === id, field, value);
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
          <h1 class="text-2xl font-black text-white">{t('quietHoursSettings.title')}</h1>
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

      <div class="p-5 flex flex-col gap-5">

        {/* Emergency Lock */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div class={`rounded-3xl border p-1 transition-colors duration-300 ${
            emergencyLock() ? 'bg-[#ff3b30]/10 border-[#ff3b30]/30' : 'bg-[#1c1c1c] border-[#2a2a2a]'
          }`}>
            <SettingsSection
              title={t('quietHoursSettings.emergencyLock')}
              description={t('quietHoursSettings.emergencyLockDesc')}
              enabled={emergencyLock()}
              onToggle={setEmergencyLock}
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

          <div class="flex flex-col gap-3">
            <For each={periods}>
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
            
            <Show when={periods.length === 0}>
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
            enabled={sendMessages()}
            onToggle={setSendMessages}
            hasEditText={true}
            onEditText={() => navigate(`/group/${params.id}/settings/custom-texts`)}
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
