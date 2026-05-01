import { Component, createSignal, For, onCleanup, onMount } from 'solid-js';
import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { backButton, openTelegramLink } from '@tma.js/sdk-solid';
import { t, isRtl } from '@/shared/i18n/index.js';


// Mock data for existing bots
const MOCK_BOTS = [
  { id: '1', name: 'iFragment Community Bot', username: '@ifragment_group_bot', status: 'active', users: 1250 },
  { id: '2', name: 'Alpha Traders VIP', username: '@alpha_vip_bot', status: 'inactive', users: 0 }
];

export const ManagedBotsPage: Component = () => {
  const navigate = useNavigate();
  const [bots] = createSignal(MOCK_BOTS);

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      navigate('/dashboard');
    });

    onCleanup(() => {
      off();
      backButton.hide();
    });
  });

  const handleCreateBot = () => {
    // Official TMA feature for creating managed bots
    try {
      openTelegramLink('https://t.me/BotFather?start=manage');
    } catch (e) {
      console.error('Failed to open Telegram link', e);
      // Fallback
      window.open('https://t.me/BotFather?start=manage', '_blank');
    }
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-20 relative overflow-y-auto no-scrollbar text-white">
      {/* Header */}
      <div class="pt-8 pb-12 px-6 text-center relative z-10">
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          class="flex flex-col items-center justify-center mb-2"
        >
          <div class="w-20 h-20 rounded-[20px] bg-[#1c1c1c] flex items-center justify-center mb-4 border border-[#2a2a2a] shadow-inner relative overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-[#3390ec]/20 to-transparent opacity-50"></div>
            <span class="material-symbols-outlined text-[#3390ec] text-4xl relative z-10" style={{ 'font-variation-settings': '"FILL" 1' }}>smart_toy</span>
          </div>
          <h1 class="text-3xl font-black tracking-tight">{t('managedBots.title')}</h1>
          <p class="text-[#8e8e93] mt-3 font-medium max-w-sm mx-auto text-sm leading-relaxed">
            {t('managedBots.description')}
          </p>
        </Motion.div>
      </div>

      {/* Main Content Area */}
      <Motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, easing: [0.4, 0, 0.2, 1] }}
        class="w-full bg-[#1c1c1c] border-t border-[#2a2a2a] rounded-t-[40px] relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] pt-8 pb-12 px-5 min-h-[60vh] -mt-6"
      >
        <div class="flex flex-col gap-8 max-w-md mx-auto">
          
          {/* Create Action */}
          <Motion.button 
            onClick={handleCreateBot}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            class="w-full bg-gradient-to-r from-[#3390ec] to-[#2b7bc9] rounded-3xl p-[1.5px] relative group overflow-hidden shadow-[0_10px_30px_rgba(51,144,236,0.2)] transition-transform active:scale-95"
          >
            <div class="absolute inset-0 bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div class="bg-[#1c1c1c] backdrop-blur-sm rounded-[22px] p-5 flex items-center justify-between relative z-10">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-[#3390ec]/10 flex items-center justify-center border border-[#3390ec]/20">
                  <span class="material-symbols-outlined text-[#3390ec]">add</span>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-white">{t('managedBots.createBtn')}</h3>
                  <p class="text-[11px] text-[#8e8e93] font-medium mt-0.5 leading-tight max-w-[200px]">{t('managedBots.botFatherPrompt')}</p>
                </div>
              </div>
              <span class={`material-symbols-outlined text-[#8e8e93] ${isRtl() ? '-scale-x-100' : ''}`}>chevron_right</span>
            </div>
          </Motion.button>

          {/* List of Bots */}
          <div class="flex flex-col gap-4">
            <h2 class="text-xl font-bold text-white px-2 flex items-center gap-2">
              <span class="w-1.5 h-5 bg-[#3390ec] rounded-full"></span>
              {t('managedBots.yourBots')}
            </h2>
            
            <div class="flex flex-col gap-3">
              <For each={bots()} fallback={
                <div class="bg-[#0f1014] rounded-3xl p-8 border border-[#2a2a2a] flex flex-col items-center justify-center text-center">
                  <span class="material-symbols-outlined text-[#8e8e93] text-4xl mb-3 opacity-50">robot_2</span>
                  <p class="text-[#8e8e93] text-sm font-medium">{t('managedBots.noBots')}</p>
                </div>
              }>
                {(bot, i) => (
                  <Motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + (i() * 0.1), duration: 0.5 }}
                    class="bg-[#0f1014] rounded-3xl p-4 shadow-inner border border-[#2a2a2a] flex items-center justify-between group hover:border-[#3390ec]/50 transition-colors cursor-pointer"
                  >
                    <div class="flex items-center gap-4">
                      <div class="relative">
                        <div class="w-12 h-12 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] overflow-hidden">
                          <span class="text-xl font-bold text-[#3390ec]">{bot.name.charAt(0)}</span>
                        </div>
                        <div class={`absolute bottom-0 ${isRtl() ? 'left-0' : 'right-0'} w-3.5 h-3.5 rounded-full border-2 border-[#0f1014] ${bot.status === 'active' ? 'bg-[#34c759]' : 'bg-[#ff3b30]'}`}></div>
                      </div>
                      
                      <div class="flex flex-col">
                        <h3 class="text-[15px] font-bold text-white leading-tight mb-0.5">{bot.name}</h3>
                        <span class="text-xs text-[#3390ec] font-medium">{bot.username}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => navigate(`/managed-bots/${bot.id}`)}
                      class="px-3.5 py-1.5 rounded-full bg-[#1c1c1c] text-[13px] font-bold text-white border border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors"
                    >
                      {t('managedBots.manage')}
                    </button>
                  </Motion.div>
                )}
              </For>
            </div>
          </div>
          
        </div>
      </Motion.div>
    </div>
  );
};
