import { Component, onMount, onCleanup } from 'solid-js';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { t, locale, setLocale } from '@/shared/i18n/index.js';
import { profileSettings, updateSetting, updateNotification } from '@/shared/store/profile.js';

export const SettingsPage: Component = () => {
  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => window.history.back());
    onCleanup(() => {
      off();
      try { backButton.hide(); } catch {}
    });
  });

  const handleToggleHaptic = () => {
    const newVal = !profileSettings().hapticEnabled;
    updateSetting('hapticEnabled', newVal);
    if (newVal) {
      try { hapticFeedback.impactOccurred('medium'); } catch {}
    }
  };

  const handleToggleSound = () => {
    try { hapticFeedback.impactOccurred('light'); } catch {}
    updateSetting('soundEnabled', !profileSettings().soundEnabled);
  };

  const handleToggleAnimations = () => {
    try { hapticFeedback.impactOccurred('light'); } catch {}
    updateSetting('autoPlayAnimations', !profileSettings().autoPlayAnimations);
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-24 text-white">
      {/* Header */}
      <div class="px-6 pt-8 pb-6 bg-[#1c1c1c] border-b border-[#2a2a2a] rounded-b-[32px]">
        <h1 class="text-2xl font-black">{t('settings.title') || 'Settings'}</h1>
        <p class="text-[#a0a4ad] text-xs mt-1">{t('settings.subtitle') || 'Customize your mini-app experience'}</p>
      </div>

      <div class="px-6 pt-6 flex flex-col gap-6">
        {/* Haptic & Sound Controls */}
        <div class="flex flex-col gap-3">
          <h2 class="text-xs font-black text-[#a0a4ad] uppercase tracking-wider px-1">{t('settings.general') || 'Preferences'}</h2>
          
          <div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-3xl p-5 flex flex-col gap-4">
            {/* Haptics Switch */}
            <div class="flex items-center justify-between">
              <div class="flex flex-col gap-0.5 max-w-[75%]">
                <span class="text-xs font-black text-white">{t('settings.hapticFeedback') || 'Haptic Feedback'}</span>
                <span class="text-[10px] text-[#a0a4ad] leading-normal">{t('settings.hapticDesc') || 'Vibration feedback on tap and actions'}</span>
              </div>
              <button
                onClick={handleToggleHaptic}
                class={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                  profileSettings().hapticEnabled ? 'bg-[#3390ec]' : 'bg-white/10'
                }`}
              >
                <div class={`w-5 h-5 rounded-full bg-white absolute top-[2px] transition-all duration-200 ${
                  profileSettings().hapticEnabled ? 'left-[22px]' : 'left-[2px]'
                }`} />
              </button>
            </div>

            <div class="h-[1px] bg-[#2a2a2a] w-full"></div>

            {/* Sound Switch */}
            <div class="flex items-center justify-between">
              <div class="flex flex-col gap-0.5 max-w-[75%]">
                <span class="text-xs font-black text-white">{t('settings.soundEffects') || 'Sound Effects'}</span>
                <span class="text-[10px] text-[#a0a4ad] leading-normal">{t('settings.soundDesc') || 'Sound feedback on game elements'}</span>
              </div>
              <button
                onClick={handleToggleSound}
                class={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                  profileSettings().soundEnabled ? 'bg-[#3390ec]' : 'bg-white/10'
                }`}
              >
                <div class={`w-5 h-5 rounded-full bg-white absolute top-[2px] transition-all duration-200 ${
                  profileSettings().soundEnabled ? 'left-[22px]' : 'left-[2px]'
                }`} />
              </button>
            </div>

            <div class="h-[1px] bg-[#2a2a2a] w-full"></div>

            {/* Animations Switch */}
            <div class="flex items-center justify-between">
              <div class="flex flex-col gap-0.5 max-w-[75%]">
                <span class="text-xs font-black text-white">{t('settings.animations') || 'Autoplay Animations'}</span>
                <span class="text-[10px] text-[#a0a4ad] leading-normal">{t('settings.animationsDesc') || 'Animate items automatically'}</span>
              </div>
              <button
                onClick={handleToggleAnimations}
                class={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                  profileSettings().autoPlayAnimations ? 'bg-[#3390ec]' : 'bg-white/10'
                }`}
              >
                <div class={`w-5 h-5 rounded-full bg-white absolute top-[2px] transition-all duration-200 ${
                  profileSettings().autoPlayAnimations ? 'left-[22px]' : 'left-[2px]'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Notifications Controls */}
        <div class="flex flex-col gap-3">
          <h2 class="text-xs font-black text-[#a0a4ad] uppercase tracking-wider px-1">{t('settings.notifications') || 'Notifications'}</h2>
          
          <div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-3xl p-5 flex flex-col gap-4">
            {/* Mining updates */}
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-white">{t('settings.pushMining') || 'Mining Updates'}</span>
              <button
                onClick={() => {
                  try { hapticFeedback.impactOccurred('light'); } catch {}
                  updateNotification('mining', !profileSettings().notifications.mining);
                }}
                class={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                  profileSettings().notifications.mining ? 'bg-[#3390ec]' : 'bg-white/10'
                }`}
              >
                <div class={`w-5 h-5 rounded-full bg-white absolute top-[2px] transition-all duration-200 ${
                  profileSettings().notifications.mining ? 'left-[22px]' : 'left-[2px]'
                }`} />
              </button>
            </div>

            <div class="h-[1px] bg-[#2a2a2a] w-full"></div>

            {/* Referral updates */}
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-white">{t('settings.pushReferrals') || 'New Referrals'}</span>
              <button
                onClick={() => {
                  try { hapticFeedback.impactOccurred('light'); } catch {}
                  updateNotification('referral', !profileSettings().notifications.referral);
                }}
                class={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                  profileSettings().notifications.referral ? 'bg-[#3390ec]' : 'bg-white/10'
                }`}
              >
                <div class={`w-5 h-5 rounded-full bg-white absolute top-[2px] transition-all duration-200 ${
                  profileSettings().notifications.referral ? 'left-[22px]' : 'left-[2px]'
                }`} />
              </button>
            </div>

            <div class="h-[1px] bg-[#2a2a2a] w-full"></div>

            {/* Community updates */}
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-white">{t('settings.pushCommunity') || 'Community Alerts'}</span>
              <button
                onClick={() => {
                  try { hapticFeedback.impactOccurred('light'); } catch {}
                  updateNotification('community', !profileSettings().notifications.community);
                }}
                class={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                  profileSettings().notifications.community ? 'bg-[#3390ec]' : 'bg-white/10'
                }`}
              >
                <div class={`w-5 h-5 rounded-full bg-white absolute top-[2px] transition-all duration-200 ${
                  profileSettings().notifications.community ? 'left-[22px]' : 'left-[2px]'
                }`} />
              </button>
            </div>

            <div class="h-[1px] bg-[#2a2a2a] w-full"></div>

            {/* Promotions updates */}
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-white">{t('settings.pushPromotions') || 'Special Deals'}</span>
              <button
                onClick={() => {
                  try { hapticFeedback.impactOccurred('light'); } catch {}
                  updateNotification('promotions', !profileSettings().notifications.promotions);
                }}
                class={`w-11 h-6 rounded-full relative transition-colors duration-200 ${
                  profileSettings().notifications.promotions ? 'bg-[#3390ec]' : 'bg-white/10'
                }`}
              >
                <div class={`w-5 h-5 rounded-full bg-white absolute top-[2px] transition-all duration-200 ${
                  profileSettings().notifications.promotions ? 'left-[22px]' : 'left-[2px]'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Language Selection */}
        <div class="flex flex-col gap-3">
          <h2 class="text-xs font-black text-[#a0a4ad] uppercase tracking-wider px-1">{t('profile.languageSettings') || 'Language Settings'}</h2>
          
          <div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-3xl p-5 flex flex-col gap-4">
            <div class="flex flex-col gap-2">
              <span class="text-xs font-black text-white">{t('profile.languageSettings') || 'App Language'}</span>
              <div class="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => {
                    try { hapticFeedback.impactOccurred('light'); } catch {}
                    setLocale('en');
                  }}
                  class={`py-3 rounded-2xl text-xs font-black border transition-all ${
                    locale() === 'en'
                      ? 'bg-[#3390ec]/10 border-[#3390ec] text-[#3390ec]'
                      : 'bg-[#0f1014] border-[#2a2a2a] text-[#a0a4ad] hover:border-white/20'
                  }`}
                >
                  🇺🇸 English
                </button>
                <button
                  onClick={() => {
                    try { hapticFeedback.impactOccurred('light'); } catch {}
                    setLocale('fa');
                  }}
                  class={`py-3 rounded-2xl text-xs font-black border transition-all ${
                    locale() === 'fa'
                      ? 'bg-[#3390ec]/10 border-[#3390ec] text-[#3390ec]'
                      : 'bg-[#0f1014] border-[#2a2a2a] text-[#a0a4ad] hover:border-white/20'
                  }`}
                >
                  🇮🇷 فارسی
                </button>
                <button
                  onClick={() => {
                    try { hapticFeedback.impactOccurred('light'); } catch {}
                    setLocale('ru');
                  }}
                  class={`py-3 rounded-2xl text-xs font-black border transition-all ${
                    locale() === 'ru'
                      ? 'bg-[#3390ec]/10 border-[#3390ec] text-[#3390ec]'
                      : 'bg-[#0f1014] border-[#2a2a2a] text-[#a0a4ad] hover:border-white/20'
                  }`}
                >
                  🇷🇺 Русский
                </button>
                <button
                  onClick={() => {
                    try { hapticFeedback.impactOccurred('light'); } catch {}
                    setLocale('zh');
                  }}
                  class={`py-3 rounded-2xl text-xs font-black border transition-all ${
                    locale() === 'zh'
                      ? 'bg-[#3390ec]/10 border-[#3390ec] text-[#3390ec]'
                      : 'bg-[#0f1014] border-[#2a2a2a] text-[#a0a4ad] hover:border-white/20'
                  }`}
                >
                  🇨🇳 简体中文
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
