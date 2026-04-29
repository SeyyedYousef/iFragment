import { Component, For } from 'solid-js';
import { initData } from '@tma.js/sdk-solid';
import { locale, setLocale, Locale, t } from '@/shared/i18n/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { Motion } from '@motionone/solid';

export const ProfilePage: Component = () => {
  const user = initData.user();
  
  const languages: { code: Locale; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'zh', label: '中文', flag: '🇨🇳' }
  ];

  return (
    <div class="min-h-screen bg-[#0f1014] pb-32 text-white">
      {/* Header / Profile Info */}
      <div class="pt-12 pb-20 rounded-b-[40px] px-margin-main relative overflow-hidden bg-[#1c1c1c] border-b border-[#2a2a2a]">
        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          class="flex flex-col items-center text-center relative z-10"
        >
          <div class="w-24 h-24 rounded-full border-4 border-[#2a2a2a] p-1 mb-4 shadow-inner bg-[#0f1014]">
            <img 
              src={user?.photo_url || "https://lh3.googleusercontent.com/aida-public/AB6AXuDlhnjNsGlfInmLIIN02ChdkgyPOzqZiC4r5EnIK77oCAHQaSx1lSef170FRxmyGJnzKdQfcCKVZy9KGhf-K14L8g8E7UV4KaaNNGY124GeKTtwHprnqgu3ucI5s0kZ4ImQve0G6TCQSwjHqTuaVwPsAvTM2asZbtbl56RdRq3A0pr-wcs2LwaSvW92dFCiUiKATzoUFP9mOOTwoEZk794yzHFP8Zb_45GoNOfvXcKG792JDOepm2LsmoYBcDOhkpVvPeEwZ_Up5bs"} 
              alt="Profile" 
              class="w-full h-full rounded-full object-cover"
            />
          </div>
          <h1 class="text-white text-2xl font-black tracking-tight">{user?.first_name} {user?.last_name}</h1>
          <p class="text-[#8e8e93] font-medium text-sm mt-1">@{user?.username || 'Guest'}</p>
          
          <div class="mt-6 flex gap-3">
            <div class="bg-[#0f1014] px-4 py-2 rounded-2xl border border-[#2a2a2a]">
              <span class="text-[10px] text-[#8e8e93] block uppercase font-bold tracking-widest leading-none mb-1 text-center">{t('profile.id')}</span>
              <span class="text-white font-mono font-bold text-xs">{user?.id || '---'}</span>
            </div>
            <div class="bg-[#0f1014] px-4 py-2 rounded-2xl border border-[#2a2a2a]">
              <span class="text-[10px] text-[#8e8e93] block uppercase font-bold tracking-widest leading-none mb-1 text-center">{t('profile.premium')}</span>
              <span class="text-white font-bold text-xs flex items-center gap-1 justify-center">
                {user?.is_premium ? (
                  <><span class="material-symbols-outlined text-[14px] text-amber-300" style={{ 'font-variation-settings': '"FILL" 1' }}>star</span> {t('profile.yes')}</>
                ) : t('profile.no')}
              </span>
            </div>
          </div>
        </Motion.div>
      </div>

      {/* Settings Sections */}
      <div class="px-margin-main -mt-10 relative z-20 space-y-4">
        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          class="bg-[#1c1c1c] rounded-3xl p-6 shadow-lg border border-[#2a2a2a]"
        >
          <div class="flex items-center gap-3 mb-5">
            <div class="w-10 h-10 rounded-2xl bg-[#0f1014] flex items-center justify-center text-[#3390ec] border border-[#2a2a2a]">
              <span class="material-symbols-outlined text-[24px]">language</span>
            </div>
            <h2 class="text-white font-black text-lg">{t('profile.languageSettings')}</h2>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <For each={languages}>
              {(lang) => (
                <button
                  onClick={() => setLocale(lang.code)}
                  class={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                    locale() === lang.code
                      ? 'bg-white/5 border-white/20 shadow-sm'
                      : 'bg-[#0f1014] border-[#2a2a2a] hover:border-[#3a3a3a]'
                  }`}
                >
                  <div class="flex items-center gap-3">
                    <span class="text-xl">{lang.flag}</span>
                    <span class="text-sm font-bold text-white">
                      {lang.label}
                    </span>
                  </div>
                  {locale() === lang.code && (
                    <span class="material-symbols-outlined text-white text-[20px]" style={{ 'font-variation-settings': '"FILL" 1' }}>check_circle</span>
                  )}
                </button>
              )}
            </For>
          </div>
        </Motion.div>

        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          class="bg-[#1c1c1c] rounded-3xl p-6 shadow-lg border border-[#2a2a2a]"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-[#0f1014] flex items-center justify-center text-[#8e8e93] border border-[#2a2a2a]">
                <span class="material-symbols-outlined text-[24px]">security</span>
              </div>
              <div>
                <h2 class="text-white font-black text-sm">{t('profile.privacyPolicy')}</h2>
                <p class="text-[#8e8e93] text-[11px] font-medium leading-none">{t('profile.termsDescription')}</p>
              </div>
            </div>
            <span class="material-symbols-outlined text-[#8e8e93]">chevron_right</span>
          </div>
        </Motion.div>
      </div>

      <BottomNav />
    </div>
  );
};
