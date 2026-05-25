import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { t } from '@/shared/i18n/index.js';
import { profileSettings, updateSetting } from '@/shared/store/profile.js';
import { 
  biometric, 
  showAlert, 
  showConfirm, 
  disableClosingConfirmation 
} from '@/shared/lib/telegram-native.js';

export const SecurityPage: Component = () => {
  const [biometricsAvailable, setBiometricsAvailable] = createSignal(false);

  onMount(async () => {
    backButton.show();
    const off = backButton.onClick(() => window.history.back());
    onCleanup(() => {
      off();
      try { backButton.hide(); } catch {}
      try { disableClosingConfirmation(); } catch {}
    });

    // Check biometric availability
    try {
      const initResult = await biometric.init();
      if (initResult) {
        setBiometricsAvailable(biometric.isAvailable());
      }
    } catch (e) {
      console.warn('Failed to check biometric availability', e);
    }
  });

  const handleToggleBiometrics = async () => {
    try { hapticFeedback.impactOccurred('light'); } catch {}
    
    if (!biometricsAvailable()) {
      await showAlert(t('security.biometricNotSupported') || 'Biometrics not supported on this device');
      return;
    }

    const currentVal = profileSettings().biometricEnabled;
    if (!currentVal) {
      // Request access
      const accessGranted = await biometric.requestAccess('Enable FaceID lock for iFragment account settings');
      if (accessGranted) {
        updateSetting('biometricEnabled', true);
        try { hapticFeedback.notificationOccurred('success'); } catch {}
      } else {
        updateSetting('biometricEnabled', false);
      }
    } else {
      updateSetting('biometricEnabled', false);
    }
  };

  const handleDeleteAccount = async () => {
    try { hapticFeedback.notificationOccurred('warning'); } catch {}
    const confirmed = await showConfirm(
      t('security.deleteConfirm') || 'Are you sure you want to delete your account? This will erase all local settings and cannot be undone.'
    );
    if (confirmed) {
      try { hapticFeedback.notificationOccurred('success'); } catch {}
      const profileKeys = ['profile-settings', 'kyc_verified', 'profile-cache'];
      profileKeys.forEach(k => localStorage.removeItem(k));
      window.location.reload();
    }
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-24 text-white">
      {/* Header */}
      <div class="px-6 pt-8 pb-6 bg-[#1c1c1c] border-b border-[#2a2a2a] rounded-b-[32px]">
        <h1 class="text-2xl font-black">{t('security.title') || 'Account & Security'}</h1>
        <p class="text-[#a0a4ad] text-xs mt-1">{t('security.subtitle') || 'Manage biometric lock and security preferences'}</p>
      </div>

      <div class="px-6 pt-6 flex flex-col gap-6">
        {/* Biometrics */}
        <div class="flex flex-col gap-3">
          <h2 class="text-xs font-black text-[#a0a4ad] uppercase tracking-wider px-1">{t('security.biometricTitle') || 'Lock Options'}</h2>
          
          <div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-3xl p-5 flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <div class="flex flex-col gap-0.5 max-w-[75%]">
                <span class="text-xs font-black text-white">{t('security.biometricLock') || 'Biometric Access'}</span>
                <span class="text-[10px] text-[#a0a4ad] leading-normal">{t('security.biometricDesc') || 'Unlock iFragment with FaceID / TouchID'}</span>
              </div>
              <button
                onClick={handleToggleBiometrics}
                class={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                  profileSettings().biometricEnabled ? 'bg-[#3390ec]' : 'bg-white/10'
                } ${!biometricsAvailable() ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div class={`w-5 h-5 rounded-full bg-white absolute top-[2px] transition-all duration-200 ${
                  profileSettings().biometricEnabled ? 'left-[22px]' : 'left-[2px]'
                }`} />
              </button>
            </div>
            
            <Show when={!biometricsAvailable()}>
              <div class="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
                <span class="material-symbols-outlined text-amber-500 text-[16px]">warning</span>
                <span class="text-[9px] font-bold text-amber-500">{t('security.biometricNotSupported') || 'Biometrics not supported on this device'}</span>
              </div>
            </Show>
          </div>
        </div>

        {/* Data Purge */}
        <div class="flex flex-col gap-3">
          <h2 class="text-xs font-black text-[#a0a4ad] uppercase tracking-wider px-1">{t('security.dangerZone') || 'Danger Zone'}</h2>
          
          <div class="bg-[#1c1c1c] border border-red-500/20 rounded-3xl p-5 flex flex-col gap-4">
            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-black text-red-500">{t('security.deleteAccount') || 'Delete Account Data'}</span>
              <span class="text-[10px] text-[#a0a4ad] leading-normal">{t('security.deleteDesc') || 'Permanently remove all local data (irreversible)'}</span>
            </div>
            
            <button
              onClick={handleDeleteAccount}
              class="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 font-black text-xs rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-red-500/20"
            >
              <span class="material-symbols-outlined text-[16px]">delete_forever</span>
              {t('security.deleteAccount') || 'Delete Local Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
