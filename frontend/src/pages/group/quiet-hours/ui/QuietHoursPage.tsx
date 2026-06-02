import { Component, createSignal, createResource, For, Show, onMount, onCleanup, Suspense } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { showToast } from '@/shared/ui/toast.js';
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

  const [_, { refetch }] = createResource(
    () => params.id,
    async (groupId) => {
      const data = await groupApi.getSettings(groupId);
      setSettingsVersion(data.version);
      const qh = (data.quiet_hours || {}) as Partial<QuietHoursConfig>;
      setConfig(reconcile({ ...defaultConfig, ...qh }));
      setIsDirty(false);
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

  const isTimeInPeriod = (time: string, start: string, end: string) => {
    if (start < end) {
      return time >= start && time <= end;
    }
    // Midnight wrap-around (e.g., 22:00 -> 08:00)
    return time >= start || time <= end;
  };

  const checkOverlaps = (periods: QuietPeriod[]) => {
    const getMinutes = (timeStr: string): number => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const getIntervals = (startStr: string, endStr: string): { start: number; end: number }[] => {
      const start = getMinutes(startStr);
      const end = getMinutes(endStr);
      if (start < end) {
        return [{ start, end }];
      } else if (start > end) {
        return [
          { start, end: 1440 },
          { start: 0, end }
        ];
      } else {
        // start === end is a 24-hour quiet period
        return [{ start: 0, end: 1440 }];
      }
    };

    const isOverlap = (
      i1: { start: number; end: number },
      i2: { start: number; end: number }
    ): boolean => {
      return i1.start < i2.end && i2.start < i1.end;
    };

    for (let i = 0; i < periods.length; i++) {
      const intervalsA = getIntervals(periods[i].start, periods[i].end);
      for (let j = i + 1; j < periods.length; j++) {
        const intervalsB = getIntervals(periods[j].start, periods[j].end);
        for (const intA of intervalsA) {
          for (const intB of intervalsB) {
            if (isOverlap(intA, intB)) {
              setOverlapWarning(`Period overlaps!`);
              return;
            }
          }
        }
      }
    }
    setOverlapWarning('');
  };

  const isCurrentlyQuiet = () => {
    if (config.emergencyLock) return true;
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return config.periods.some(p => isTimeInPeriod(currentTime, p.start, p.end));
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
      showToast(t('botManage.subscriptionSuccess'), 'success');
      navigate(`/group/${params.id}`);
      backButton.hide();
    } catch (e) {
      showToast(t('error.title'), 'error');
      hapticFeedback.notificationOccurred('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div class="min-h-screen bg-[#0f1014] text-white pb-24">
      <div class="pt-6 pb-4 px-5 sticky top-0 bg-[#0f1014]/90 backdrop-blur-md z-20 border-b border-[#2a2a2a] flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 overflow-hidden flex-1">
          <button 
            onClick={() => { hapticFeedback.impactOccurred('light'); window.history.back(); }}
            class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
            aria-label="Back"
          >
            <span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">arrow_back</span>
          </button>
          <div class="flex flex-col overflow-hidden">
            <div class="flex items-center gap-2">
              <h1 class="text-[18px] font-black text-white leading-tight truncate">{t('quietHoursSettings.title')}</h1>
              <Show when={isDirty()}>
                <span class="w-2.5 h-2.5 rounded-full bg-[#ff9f0a] animate-pulse shrink-0" />
              </Show>
            </div>
            <p class="text-[12px] text-[#8e8e93] font-medium leading-snug truncate">
              {t('quietHoursSettings.subtitle')}
            </p>
          </div>
        </div>

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

      <Suspense fallback={<div class="flex items-center justify-center py-20"><span class="w-6 h-6 border-2 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin" /></div>}>
        <div class="p-5 flex flex-col gap-5">
          
          {/* Current Status Preview */}
          <Motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            class={`p-4 rounded-3xl border flex items-center justify-between ${
              isCurrentlyQuiet() 
                ? 'bg-[#ff3b30]/10 border-[#ff3b30]/30 text-[#ff3b30]' 
                : 'bg-[#34c759]/10 border-[#34c759]/30 text-[#34c759]'
            }`}
          >
            <div class="flex items-center gap-3">
              <div class={`w-2.5 h-2.5 rounded-full animate-pulse ${isCurrentlyQuiet() ? 'bg-[#ff3b30]' : 'bg-[#34c759]'}`} />
              <div class="flex flex-col">
                <span class="text-[14px] font-black uppercase tracking-tight">
                  {isCurrentlyQuiet() ? 'Group Locked' : 'Group Active'}
                </span>
                <span class="text-[11px] opacity-70 font-medium">Based on current server time ({new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})</span>
              </div>
            </div>
            <span class="material-symbols-outlined text-[20px]">
              {isCurrentlyQuiet() ? 'lock' : 'lock_open'}
            </span>
          </Motion.div>

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
            <For each={config.periods}>
              {(period) => (
                <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <label>
                      <input 
                        type="time" 
                        value={period.start} 
                        onChange={(e) => updatePeriod(period.id, 'start', e.currentTarget.value)}
                        class="bg-[#0f1014] border border-[#2a2a2a] rounded-xl px-3 py-2 text-[14px] text-white focus:border-[#3390ec] outline-none"
                      />
                    </label>
                    <span class="text-[#8e8e93]">→</span>
                    <label>
                      <input 
                        type="time" 
                        value={period.end} 
                        onChange={(e) => updatePeriod(period.id, 'end', e.currentTarget.value)}
                        class="bg-[#0f1014] border border-[#2a2a2a] rounded-xl px-3 py-2 text-[14px] text-white focus:border-[#3390ec] outline-none"
                      />
                    </label>
                  </div>
                  <button onClick={() => removePeriod(period.id)} class="text-[#ff3b30] p-2">
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                </div>
              )}
            </For>
            <button onClick={addPeriod} class="w-full py-4 border-2 border-dashed border-[#2a2a2a] rounded-3xl text-[#8e8e93] font-bold flex items-center justify-center gap-2 hover:border-[#3390ec] hover:text-[#3390ec] transition-all">
              <span class="material-symbols-outlined">add</span>
              {t('quietHoursSettings.addPeriod')}
            </button>
            <Show when={overlapWarning()}>
              <p class="text-[#ff3b30] text-[12px] font-bold text-center">{overlapWarning()}</p>
            </Show>
          </Motion.div>

          {/* Notifications */}
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
      </Suspense>

      {/* Floating Action Bar */}
      <Show when={isDirty()}>
        <div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/90 to-transparent z-40 flex gap-3">
          <button 
            onClick={() => refetch()}
            disabled={isSaving()}
            class="flex-1 h-14 bg-[#1c1c1c] text-[#ff3b30] border border-[#ff3b30]/20 rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 hover:bg-[#ff3b30]/10"
          >
            {t('common.cancel')}
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving()}
            class="flex-[2] h-14 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-2xl font-bold text-[16px] shadow-[0_10px_25_rgba(51,144,236,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Show when={!isSaving()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}>
              {t('generalSettings.saveSettings')}
              <span class="material-symbols-outlined text-[20px]">save</span>
            </Show>
          </button>
        </div>
      </Show>
    </div>
  );
};
