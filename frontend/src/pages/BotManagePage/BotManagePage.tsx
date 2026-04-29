import { Component, createSignal, For, onCleanup, onMount } from 'solid-js';
import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { backButton, openTelegramLink } from '@tma.js/sdk-solid';
import { t, locale } from '@/shared/i18n/index.js';

const isRtl = () => locale() === 'fa';

// Mock Data for a single bot and its groups
const MOCK_BOT = { id: '1', name: 'iFragment Community Bot', username: '@ifragment_group_bot' };
const MOCK_GROUPS = [
  { id: 'g1', name: 'Crypto Alpha Signals', members: 4500, status: 'trial', expiresAt: new Date(Date.now() + 12 * 3600 * 1000) },
  { id: 'g2', name: 'Defi Degens Chat', members: 1200, status: 'paid', expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
  { id: 'g3', name: 'Test Group', members: 10, status: 'expired', expiresAt: new Date(Date.now() - 2 * 3600 * 1000) },
];

export const BotManagePage: Component = () => {
  const navigate = useNavigate();
  
  const [bot] = createSignal(MOCK_BOT);
  const [groups] = createSignal(MOCK_GROUPS);

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      navigate('/managed-bots');
    });

    onCleanup(() => {
      off();
    });
  });

  const handleInvite = () => {
    const url = `https://t.me/${bot().username.replace('@', '')}?startgroup=start&admin=restrict_members+delete_messages+ban_users`;
    try {
      openTelegramLink(url);
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  const handlePay = (groupId: string) => {
    alert(`Initiating payment of $1 (or equivalent in Stars) for group ${groupId}...`);
  };

  const formatTimeRemaining = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff <= 0) return t('botManage.expired');
    
    const days = Math.floor(diff / (1000 * 3600 * 24));
    const hours = Math.floor((diff % (1000 * 3600 * 24)) / (1000 * 3600));
    
    if (days > 0) return `${days}${t('botManage.daysLeft')} ${hours}${t('botManage.hoursLeft')}`;
    return `${hours}${t('botManage.hoursLeft')}`;
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-20 relative overflow-y-auto no-scrollbar text-white" dir={isRtl() ? 'rtl' : 'ltr'}>
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
             <span class="text-3xl font-bold text-[#3390ec] relative z-10">{bot().name.charAt(0)}</span>
          </div>
          <h1 class="text-2xl font-black tracking-tight">{bot().name}</h1>
          <p class="text-[#3390ec] mt-1 font-medium text-sm flex items-center justify-center gap-1">
            {bot().username}
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
          
          {/* Add to Group Action */}
          <Motion.button 
            onClick={handleInvite}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            class="w-full bg-gradient-to-r from-[#3390ec] to-[#2b7bc9] rounded-3xl p-[1.5px] relative group overflow-hidden shadow-[0_10px_30px_rgba(51,144,236,0.2)] transition-transform active:scale-95"
          >
            <div class="absolute inset-0 bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div class="bg-[#1c1c1c] backdrop-blur-sm rounded-[22px] p-5 flex items-center justify-between relative z-10">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-[#3390ec]/10 flex items-center justify-center border border-[#3390ec]/20">
                  <span class="material-symbols-outlined text-[#3390ec]">group_add</span>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-white">{t('botManage.addToGroup')}</h3>
                  <p class="text-[11px] text-[#8e8e93] font-medium mt-0.5 leading-tight max-w-[200px]">{t('botManage.addToGroupDesc')}</p>
                </div>
              </div>
              <span class={`material-symbols-outlined text-[#8e8e93] ${isRtl() ? '-scale-x-100' : ''}`}>chevron_right</span>
            </div>
          </Motion.button>

          {/* Info Banner for Trial */}
          <div class="bg-[#3390ec]/10 border border-[#3390ec]/20 rounded-2xl p-4 flex items-start gap-3">
            <span class="material-symbols-outlined text-[#3390ec] text-xl shrink-0">info</span>
            <p class="text-xs text-[#8e8e93] leading-relaxed">
              {t('botManage.trialInfo')} <span class="text-white font-bold">{t('botManage.trialFree')}</span>{t('botManage.trialSuffix')} <span class="text-white font-bold">{t('botManage.trialPrice')}</span> {t('botManage.trialEnd')}
            </p>
          </div>

          {/* Connected Groups */}
          <div class="flex flex-col gap-4">
            <h2 class="text-xl font-bold text-white px-2 flex items-center gap-2">
              <span class="w-1.5 h-5 bg-[#3390ec] rounded-full"></span>
              {t('botManage.connectedGroups')}
            </h2>
            
            <div class="flex flex-col gap-3">
              <For each={groups()} fallback={
                <div class="bg-[#0f1014] rounded-3xl p-8 border border-[#2a2a2a] flex flex-col items-center justify-center text-center">
                  <span class="material-symbols-outlined text-[#8e8e93] text-4xl mb-3 opacity-50">forum</span>
                  <p class="text-[#8e8e93] text-sm font-medium">{t('botManage.noGroups')}</p>
                </div>
              }>
                {(group, i) => (
                  <Motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + (i() * 0.1), duration: 0.5 }}
                    class="bg-[#0f1014] rounded-3xl p-4 shadow-inner border border-[#2a2a2a] flex flex-col gap-3 group hover:border-[#3390ec]/50 transition-colors"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3 overflow-hidden">
                        <div class="w-10 h-10 shrink-0 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a]">
                          <span class="text-sm font-bold text-[#3390ec]">{group.name.charAt(0)}</span>
                        </div>
                        <div class="flex flex-col overflow-hidden">
                          <h3 class="text-[14px] font-bold text-white leading-tight mb-0.5 truncate">{group.name}</h3>
                          <span class="text-[11px] text-[#8e8e93] font-medium">{group.members} {t('botManage.members')}</span>
                        </div>
                      </div>
                      
                      <div class="flex flex-col items-end shrink-0">
                        <span class={`text-[11px] font-bold uppercase tracking-wider ${
                          group.status === 'paid' ? 'text-[#34c759]' : 
                          group.status === 'trial' ? 'text-[#ffcc00]' : 'text-[#ff3b30]'
                        }`}>
                          {group.status === 'paid' ? t('managedBots.statusActive') : group.status === 'trial' ? 'Trial' : t('botManage.expired')}
                        </span>
                        <span class="text-[10px] text-[#8e8e93] font-medium mt-0.5 whitespace-nowrap">{formatTimeRemaining(group.expiresAt)}</span>
                      </div>
                    </div>
                    
                    <div class="flex gap-2 w-full mt-1">
                      <button 
                        onClick={() => navigate(`/group/${group.id}`)}
                        class="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-colors border bg-[#1c1c1c] text-white border-[#2a2a2a] hover:bg-[#2a2a2a]"
                      >
                        {t('botManage.manage')}
                      </button>
                      <button 
                        onClick={() => handlePay(group.id)}
                        class={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-colors border ${
                          group.status === 'paid' 
                            ? 'bg-[#1c1c1c] text-white border-[#2a2a2a] hover:bg-[#2a2a2a]' 
                            : 'bg-[#3390ec] text-white border-[#3390ec] shadow-[0_4px_14px_rgba(51,144,236,0.3)] hover:bg-[#2b7bc9]'
                        }`}
                      >
                        {group.status === 'paid' ? t('botManage.extendSub') : t('botManage.payMonthly')}
                      </button>
                    </div>
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
