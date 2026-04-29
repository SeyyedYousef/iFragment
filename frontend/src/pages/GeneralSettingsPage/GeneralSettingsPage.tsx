import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t, locale } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';

const isRtl = () => locale() === 'fa';

import { ToggleSwitch, SelectField, SettingsSection } from '@/shared/ui/settings-controls.js';

export const GeneralSettingsPage: Component = () => {
  const navigate = useNavigate();
  const params = useParams();

  // Menu State
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);

  // State
  const [timeZone, setTimeZone] = createSignal('Asia/Tehran');
  
  // Welcome Message
  const [welcomeEnabled, setWelcomeEnabled] = createSignal(true);
  const [welcomeWindow, setWelcomeWindow] = createSignal('Always');
  const [welcomeStart, setWelcomeStart] = createSignal('08:00');
  const [welcomeEnd, setWelcomeEnd] = createSignal('22:00');
  
  // Warning Message
  const [warningEnabled, setWarningEnabled] = createSignal(true);
  const [warningWindow, setWarningWindow] = createSignal('Always');
  const [warningStart, setWarningStart] = createSignal('08:00');
  const [warningEnd, setWarningEnd] = createSignal('22:00');
  
  // Auto-delete
  const [autoDeleteBot, setAutoDeleteBot] = createSignal(true);
  const [autoDeleteTime, setAutoDeleteTime] = createSignal('30'); // seconds

  // Admin violations
  const [adminViolations, setAdminViolations] = createSignal('log');
  
  // Verify Members
  const [verifyEnabled, setVerifyEnabled] = createSignal(false);
  const [verifyWindow, setVerifyWindow] = createSignal('Always');
  const [verifyStart, setVerifyStart] = createSignal('08:00');
  const [verifyEnd, setVerifyEnd] = createSignal('22:00');
  const [verifyPenalty, setVerifyPenalty] = createSignal('default');

  // Public Commands
  const [publicCmdEnabled, setPublicCmdEnabled] = createSignal(false);
  const [publicCmdWindow, setPublicCmdWindow] = createSignal('Always');
  const [publicCmdStart, setPublicCmdStart] = createSignal('08:00');
  const [publicCmdEnd, setPublicCmdEnd] = createSignal('22:00');
  const [publicCmdPenalty, setPublicCmdPenalty] = createSignal('delete');

  // Hide Join Leave
  const [hideJoinLeaveEnabled, setHideJoinLeaveEnabled] = createSignal(true);
  const [hideJoinLeaveWindow, setHideJoinLeaveWindow] = createSignal('Always');
  const [hideJoinLeaveStart, setHideJoinLeaveStart] = createSignal('08:00');
  const [hideJoinLeaveEnd, setHideJoinLeaveEnd] = createSignal('22:00');
  
  // Penalties
  const [defaultPenalty, setDefaultPenalty] = createSignal('delete');
  
  // Warning Counter
  const [warningCounterEnabled, setWarningCounterEnabled] = createSignal(true);
  const [warningThreshold, setWarningThreshold] = createSignal('3');
  const [warningRetention, setWarningRetention] = createSignal('7');
  const [warningPenalty, setWarningPenalty] = createSignal('ban_24h');

  const [isSaving, setIsSaving] = createSignal(false);

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

  const handleNumberInput = (setter: (v: string) => void) => (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.value === '') {
      setter('');
      return;
    }
    let val = parseInt(target.value);
    if (isNaN(val) || val < 0) {
      setter('0');
      target.value = '0';
    } else {
      setter(val.toString());
    }
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white" dir={isRtl() ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div class="px-5 pt-6 pb-4 bg-[#0f1014] sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center justify-between">
        <div class="flex flex-col">
          <h1 class="text-[20px] font-black text-white leading-tight">{t('generalSettings.title')}</h1>
          <span class="text-[12px] text-[#8e8e93]">{t('generalSettings.description')}</span>
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
        activeTab="general" 
      />

      <div class="px-5 pt-6 flex flex-col gap-6">
        
        {/* 1. Time Zone */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <SelectField 
            label={t('generalSettings.timeZone')}
            value={timeZone()}
            onChange={setTimeZone}
            options={[
              { value: 'UTC', label: 'UTC (GMT+0)' },
              { value: 'Europe/Moscow', label: 'Europe/Moscow (GMT+3)' },
              { value: 'Asia/Tehran', label: 'Asia/Tehran (GMT+3:30)' },
              { value: 'Asia/Dubai', label: 'Asia/Dubai (GMT+4)' },
              { value: 'Asia/Shanghai', label: 'Asia/Shanghai (GMT+8)' },
              { value: 'Europe/London', label: 'Europe/London (GMT+1)' },
              { value: 'America/New_York', label: 'America/New York (GMT-4)' }
            ]}
            description={t('generalSettings.timeZoneDesc')}
          />
        </Motion.div>

        {/* 2. Welcome Message */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SettingsSection
            title={t('generalSettings.welcomeMessage')}
            description={t('generalSettings.welcomeMessageDesc')}
            enabled={welcomeEnabled()}
            onToggle={setWelcomeEnabled}
            hasWindow={true}
            windowVal={welcomeWindow()}
            onWindowChange={setWelcomeWindow}
            customStart={welcomeStart()}
            onCustomStart={setWelcomeStart}
            customEnd={welcomeEnd()}
            onCustomEnd={setWelcomeEnd}
            hasEditText={true}
            onEditText={() => navigate(`/group/${params.id}/settings/custom-texts`)}
          />
        </Motion.div>

        {/* 3. Warning Message */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <SettingsSection
            title={t('generalSettings.warningMessage')}
            description={t('generalSettings.warningMessageDesc')}
            enabled={warningEnabled()}
            onToggle={setWarningEnabled}
            hasWindow={true}
            windowVal={warningWindow()}
            onWindowChange={setWarningWindow}
            customStart={warningStart()}
            onCustomStart={setWarningStart}
            customEnd={warningEnd()}
            onCustomEnd={setWarningEnd}
            hasEditText={true}
            onEditText={() => navigate(`/group/${params.id}/settings/custom-texts`)}
          />
        </Motion.div>

        {/* 4. Auto-delete bot messages */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex flex-col flex-1 min-w-0">
              <span class="text-[15px] font-bold text-white">{t('generalSettings.autoDeleteBot')}</span>
              <span class="text-[12px] text-[#8e8e93] leading-snug">{t('generalSettings.autoDeleteBotDesc')}</span>
            </div>
            <ToggleSwitch checked={autoDeleteBot()} onChange={setAutoDeleteBot} />
          </div>
          <Show when={autoDeleteBot()}>
            <div class="flex items-center gap-3 mt-2">
              <input 
                type="number" 
                min="0"
                dir="ltr"
                value={autoDeleteTime()} 
                onInput={handleNumberInput(setAutoDeleteTime)}
                class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-2 w-24 text-center focus:outline-none focus:ring-2 focus:ring-[#3390ec]"
              />
              <span class="text-[14px] font-bold text-[#8e8e93]">{t('generalSettings.seconds')}</span>
            </div>
          </Show>
        </Motion.div>

        {/* 5. Track admin violations */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} class="flex flex-col gap-2">
          <SelectField 
            label={t('generalSettings.trackAdmin')}
            value={adminViolations()}
            onChange={setAdminViolations}
            options={[
              { value: 'ignore', label: t('generalSettings.optIgnore') },
              { value: 'log', label: t('generalSettings.optLog') },
              { value: 'delete', label: t('generalSettings.optDelete') }
            ]}
            description={t('generalSettings.trackAdminDesc')}
          />
        </Motion.div>

        {/* 6. Verify new members */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SettingsSection
            title={t('generalSettings.verifyMembers')}
            description={t('generalSettings.verifyMembersDesc')}
            enabled={verifyEnabled()}
            onToggle={setVerifyEnabled}
            hasWindow={true}
            windowVal={verifyWindow()}
            onWindowChange={setVerifyWindow}
            customStart={verifyStart()}
            onCustomStart={setVerifyStart}
            customEnd={verifyEnd()}
            onCustomEnd={setVerifyEnd}
            hasPenalty={true}
            penaltyVal={verifyPenalty()}
            onPenaltyChange={setVerifyPenalty}
          />
        </Motion.div>

        {/* 7. Public commands */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SettingsSection
            title={t('generalSettings.publicCommands')}
            description={t('generalSettings.publicCommandsDesc')}
            enabled={publicCmdEnabled()}
            onToggle={setPublicCmdEnabled}
            hasWindow={true}
            windowVal={publicCmdWindow()}
            onWindowChange={setPublicCmdWindow}
            customStart={publicCmdStart()}
            onCustomStart={setPublicCmdStart}
            customEnd={publicCmdEnd()}
            onCustomEnd={setPublicCmdEnd}
            hasPenalty={true}
            penaltyVal={publicCmdPenalty()}
            onPenaltyChange={setPublicCmdPenalty}
          />
        </Motion.div>

        {/* 8. Hide join and leave */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SettingsSection
            title={t('generalSettings.hideJoinLeave')}
            description={t('generalSettings.hideJoinLeaveDesc')}
            enabled={hideJoinLeaveEnabled()}
            onToggle={setHideJoinLeaveEnabled}
            hasWindow={true}
            windowVal={hideJoinLeaveWindow()}
            onWindowChange={setHideJoinLeaveWindow}
            customStart={hideJoinLeaveStart()}
            onCustomStart={setHideJoinLeaveStart}
            customEnd={hideJoinLeaveEnd()}
            onCustomEnd={setHideJoinLeaveEnd}
          />
        </Motion.div>

        {/* 9. Default system penalty */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <SelectField 
            label={t('generalSettings.defaultPenalty')}
            value={defaultPenalty()}
            onChange={setDefaultPenalty}
            options={[
              { value: 'delete', label: t('generalSettings.optDelete') },
              { value: 'mute_1h', label: t('generalSettings.optMute1h') },
              { value: 'mute_24h', label: t('generalSettings.optMute24h') },
              { value: 'kick', label: t('generalSettings.optKick') },
              { value: 'ban', label: t('generalSettings.optBan') }
            ]}
            description={t('generalSettings.defaultPenaltyDesc')}
          />
        </Motion.div>

        {/* 10. Auto warning counter */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex flex-col flex-1 min-w-0">
              <span class="text-[15px] font-bold text-white">{t('generalSettings.autoWarning')}</span>
              <span class="text-[12px] text-[#8e8e93] leading-snug">{t('generalSettings.autoWarningDesc')}</span>
            </div>
            <ToggleSwitch checked={warningCounterEnabled()} onChange={setWarningCounterEnabled} />
          </div>
          
          <Show when={warningCounterEnabled()}>
            <div class="h-[1px] bg-[#2a2a2a] w-full my-2"></div>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-[13px] font-bold text-white">{t('generalSettings.threshold')}</label>
                <div class="relative">
                  <input 
                    type="number" min="1" dir="ltr" value={warningThreshold()} onInput={handleNumberInput(setWarningThreshold)}
                    class={`w-full bg-[#2c2c2e] text-white text-[15px] rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-[#3390ec] ${
                      isRtl() ? 'pr-4 pl-16 text-right' : 'pl-4 pr-16 text-left'
                    }`}
                  />
                  <span class={`absolute top-1/2 -translate-y-1/2 text-[12px] text-[#8e8e93] ${
                    isRtl() ? 'left-3' : 'right-3'
                  }`}>{t('generalSettings.strikes')}</span>
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[13px] font-bold text-white">{t('generalSettings.retention')}</label>
                <div class="relative">
                  <input 
                    type="number" min="1" dir="ltr" value={warningRetention()} onInput={handleNumberInput(setWarningRetention)}
                    class={`w-full bg-[#2c2c2e] text-white text-[15px] rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-[#3390ec] ${
                      isRtl() ? 'pr-4 pl-12 text-right' : 'pl-4 pr-12 text-left'
                    }`}
                  />
                  <span class={`absolute top-1/2 -translate-y-1/2 text-[12px] text-[#8e8e93] ${
                    isRtl() ? 'left-3' : 'right-3'
                  }`}>{t('generalSettings.days')}</span>
                </div>
              </div>
            </div>

            <div class="mt-2">
              <SelectField 
                label={t('generalSettings.finalPenalty')}
                value={warningPenalty()}
                onChange={setWarningPenalty}
                options={[
                  { value: 'mute_24h', label: t('generalSettings.optMute24h') },
                  { value: 'kick', label: t('generalSettings.optKick') },
                  { value: 'ban', label: t('generalSettings.optBan') }
                ]}
              />
            </div>
          </Show>
        </Motion.div>

      </div>

      {/* Floating Save Bar */}
      <div class="fixed bottom-0 left-0 right-0 p-5 bg-[#0f1014]/90 backdrop-blur-xl border-t border-[#1c1c1c] z-40">
        <button 
          onClick={handleSave}
          disabled={isSaving()}
          class={`w-full bg-[#3390ec] text-white font-bold text-[16px] py-4 rounded-2xl flex items-center justify-center gap-2 transition-all duration-300 ${
            isSaving() ? 'opacity-80 scale-[0.98]' : 'active:scale-[0.98] hover:bg-[#2e82d6]'
          }`}
        >
          <Show when={isSaving()} fallback={
            <>
              <span class="material-symbols-outlined text-[20px]">save</span>
              {t('generalSettings.saveSettings')}
            </>
          }>
            <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            {t('generalSettings.saving')}
          </Show>
        </button>
      </div>
    </div>
  );
};
