import { Component, For, Show } from 'solid-js';
import { Motion } from '@motionone/solid';
import { t, locale, type DictPaths } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

const isRtl = () => locale() === 'fa';

type TabType = 'username' | 'collectibles' | 'gifts';

interface HeroTabsProps {
  activeTab: TabType | null;
  onTabChange: (tab: TabType) => void;
}

export const HeroTabs: Component<HeroTabsProps> = (props) => {
  const TABS: { id: TabType; icon: string; labelKey: DictPaths }[] = [
    { id: 'username', icon: 'person_search', labelKey: 'action.username.label' },
    { id: 'collectibles', icon: 'tag', labelKey: 'action.collectibles.label' },
    { id: 'gifts', icon: 'featured_seasonal_and_gifts', labelKey: 'action.gifts.label' }
  ];

  const handleTabClick = (tab: typeof TABS[number]) => {
    haptic.light();
    props.onTabChange(tab.id);
  };

  return (
    <div
      class={`relative bg-[#0f1014] overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col items-center px-margin-main z-10 ${
        props.activeTab ? 'pt-4 pb-24' : 'pt-8 pb-20 min-h-[85vh]'
      }`}
    >
      {/* Floating Light Orbs (Dark Mode adapted) */}
      <div class={`orb w-48 h-48 top-10 ${isRtl() ? '-right-20' : '-left-20'} opacity-30`} style={{ background: 'radial-gradient(circle, rgba(51,144,236,0.3) 0%, transparent 70%)', animation: 'orb-float-1 12s ease-in-out infinite' }}></div>
      <div class={`orb w-32 h-32 top-40 ${isRtl() ? 'left-[-10%]' : 'right-[-10%]'} opacity-20`} style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)', animation: 'orb-float-2 15s ease-in-out infinite' }}></div>
      <div class={`orb w-24 h-24 bottom-20 ${isRtl() ? 'right-[30%]' : 'left-[30%]'} opacity-30`} style={{ background: 'radial-gradient(circle, rgba(51,144,236,0.2) 0%, transparent 70%)', animation: 'orb-float-1 18s ease-in-out infinite reverse' }}></div>

      {/* Promo Banner + Slogan — hidden when tab is active */}
      <Show when={!props.activeTab}>
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, easing: [0.4, 0, 0.2, 1] }}
          class="w-full flex flex-col items-center overflow-hidden relative z-10"
        >
          {/* Promo Card with Shimmer (Dark style) */}
          <div class="w-full max-w-sm bg-[#1c1c1c]/80 backdrop-blur-xl border border-[#2a2a2a] rounded-[32px] p-4 mb-12 shadow-lg flex flex-col items-center relative overflow-hidden">
            <div class="shimmer-overlay opacity-30"></div>
            <div class="bg-[#B03060] text-white px-8 py-2 rounded-xl rotate-[-2deg] shadow-lg mb-2 relative z-10">
              <p class="text-[12px] font-black tracking-[0.2em] opacity-80 leading-none">{t('home.promotion')}</p>
              <p class="text-[20px] font-black leading-none mt-1">{t('hero.promoBadge')}</p>
            </div>
            <p class="text-[#8e8e93] text-[10px] font-bold tracking-widest uppercase relative z-10">{t('home.scatterFloorLimit')}</p>
          </div>

          {/* Main Slogan */}
          <div class="text-center space-y-6 mb-16">
            <h1 class="text-[42px] font-black text-white leading-[1.15] tracking-tight drop-shadow-lg">
              {t('hero.title')}
            </h1>
            <p class="text-[#8e8e93] text-[15px] font-medium leading-[1.7] px-4 max-w-xs mx-auto">
              {t('hero.description')}
            </p>
          </div>
        </Motion.div>
      </Show>

      {/* Navigation Tabs — always visible */}
      <Motion.nav
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: props.activeTab ? 0 : 0.2 }}
        class={`w-full flex items-center justify-between gap-3 transition-all duration-500 relative z-20 ${
          props.activeTab ? '' : 'mb-12'
        }`}
        role="tablist"
        aria-label="Analysis categories"
      >
        <For each={TABS}>
          {(tab) => (
            <button
              onClick={() => handleTabClick(tab)}
              role="tab"
              aria-selected={props.activeTab === tab.id}
              aria-label={t(tab.labelKey)}
              class={`flex-1 flex items-center justify-center gap-2 transition-all duration-400 rounded-2xl text-center border relative overflow-hidden ${
                props.activeTab === tab.id
                  ? 'bg-[#1c1c1c] border-[#2a2a2a] text-white shadow-lg py-2.5'
                  : `border-transparent text-[#8e8e93] hover:bg-[#1c1c1c] hover:text-white ${
                      props.activeTab ? 'bg-transparent py-2' : 'bg-[#1c1c1c]/50 py-3.5'
                    }`
              }`}
            >
              <span
                class={`material-symbols-outlined transition-all duration-300 ${
                  props.activeTab === tab.id ? 'text-[20px] text-white' : 'text-[18px]'
                }`}
                style={{ 'font-variation-settings': props.activeTab === tab.id ? '"FILL" 1' : '"FILL" 0' }}
                aria-hidden="true"
              >
                {tab.icon}
              </span>
              <span class={`font-black tracking-tight transition-all duration-300 ${
                props.activeTab ? 'text-[13px]' : 'text-[14px]'
              }`}>
                {t(tab.labelKey)}
              </span>

              {/* Active underline */}
              <Show when={props.activeTab === tab.id}>
                <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#3390ec] rounded-t-full"></div>
              </Show>
            </button>
          )}
        </For>
      </Motion.nav>

      {/* Premium Image Showcase Stage — appears ONLY when a tab is active */}
      <Show when={props.activeTab}>
        <Motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, easing: [0.4, 0, 0.2, 1] }}
          class="w-full mt-6 mb-4 flex justify-center relative z-10"
        >
          {/* Mockup Placeholder (Dark Mode 3D feel) */}
          <div class="w-44 h-44 bg-[#1c1c1c] border border-[#2a2a2a] rounded-[32px] shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
            {/* Glossy reflection effect */}
            <div class="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/5 to-transparent"></div>
            
            <span class="material-symbols-outlined text-[56px] text-[#3390ec] drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] mb-2 relative z-10" style={{ 'font-variation-settings': '"FILL" 1' }}>
              {props.activeTab === 'username' ? 'person_search' : props.activeTab === 'collectibles' ? 'numbers' : 'redeem'}
            </span>
            <p class="text-white font-black text-[11px] tracking-widest uppercase relative z-10 drop-shadow-md">
              {t('home.asset3d')}
            </p>
            
            {/* Fake ambient light behind the asset */}
            <div class={`absolute -top-10 ${isRtl() ? '-right-10' : '-left-10'} w-24 h-24 bg-[#3390ec]/20 rounded-full blur-2xl`}></div>
            <div class={`absolute -bottom-10 ${isRtl() ? '-left-10' : '-right-10'} w-24 h-24 bg-[#3390ec]/20 rounded-full blur-2xl`}></div>
          </div>
        </Motion.div>
      </Show>

      {/* Guide Hint */}
      <Show when={!props.activeTab}>
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          class="absolute bottom-12 flex flex-col items-center gap-3 text-[#8e8e93] z-10"
        >
          <p class="text-[13px] font-bold tracking-tight">{t('hero.selectToStart')}</p>
          <Motion.span
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            class="material-symbols-outlined text-[24px]"
          >
            expand_less
          </Motion.span>
        </Motion.div>
      </Show>
    </div>
  );
};
