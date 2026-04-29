import { type Component, createEffect, createSignal, Show } from 'solid-js';
import { Motion } from '@motionone/solid';
import { backButton, viewport, miniApp } from '@tma.js/sdk-solid';

import { HeroTabs } from '@/widgets/hero-tabs/index.js';
import { ActionArea } from '@/widgets/action-area/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';

export const IndexPage: Component = () => {
  const [activeTab, setActiveTab] = createSignal<'username' | 'collectibles' | 'gifts' | null>(null);

  createEffect(() => {
    backButton.hide();
    if (viewport.expand.isAvailable() && !viewport.isExpanded()) {
      viewport.expand();
    }
    // Fragment Dark Theme Header
    try {
      if (miniApp && typeof miniApp.setHeaderColor === 'function') {
        miniApp.setHeaderColor('#0f1014');
      }
      if (miniApp && typeof (miniApp as any).setBackgroundColor === 'function') {
        (miniApp as any).setBackgroundColor('#0f1014');
      }
    } catch (e) {
      console.warn('Telegram header color API not fully supported in this environment', e);
    }
  });

  const handleTabChange = (tab: 'username' | 'collectibles' | 'gifts') => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      class="pb-40 overflow-y-auto no-scrollbar bg-[#0f1014] text-white min-h-screen relative"
      style={{ "min-height": "var(--tg-viewport-stable-height, 100vh)" }}
      role="application"
      aria-label="iFragment Home"
    >
      <div class="relative z-10">
        <HeroTabs activeTab={activeTab()} onTabChange={handleTabChange} />

        <Show when={activeTab()} keyed>
          {(tab) => (
            <Motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, easing: [0.4, 0, 0.2, 1] }}
              class="w-full bg-[#1c1c1c] border-t border-[#2a2a2a] rounded-t-[40px] relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] pt-12 pb-32 min-h-[70vh] -mt-12"
              role="tabpanel"
            >
              <ActionArea activeTab={tab} />
            </Motion.div>
          )}
        </Show>
      </div>

      <BottomNav />
    </div>
  );
};
