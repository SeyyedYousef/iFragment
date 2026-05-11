import { Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { Motion } from '@motionone/solid';
import { useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { t, isRtl } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';


const MOCK_GROUP = {
  id: 'g1',
  name: 'Crypto Alpha Signals',
  avatar: 'C',
  status: 'trial',
  stats: {
    totalMembers: 4500,
    membersChange: '+12',
    messagesToday: 1250,
    messagesStatus: 'Active',
    newMembersToday: 45,
    growthStatus: 'Growing'
  },
  health: {
    score: 98,
    label: 'Very Safe',
    blockedSpam: 124
  },
  topUsers: [
    { id: 1, name: 'Crypto King', msgs: 342, avatar: '≡ƒææ' },
    { id: 2, name: 'Alpha Hunter', msgs: 215, avatar: 'A' },
    { id: 3, name: 'Moon Boy', msgs: 184, avatar: 'M' }
  ],
  recentActivity: [
    { id: 1, user: 'John Doe', action: 'Spam deleted', time: '2 mins ago', type: 'delete' },
    { id: 2, user: 'Crypto King', action: 'Warned (Bad words)', time: '15 mins ago', type: 'warn' },
    { id: 3, user: 'Alice', action: 'Muted for 1h', time: '1 hour ago', type: 'mute' }
  ]
};

export const GroupDashboardPage: Component = () => {

  const params = useParams(); 
  
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [showTooltip, setShowTooltip] = createSignal(true);
  const [isGroupLocked, setIsGroupLocked] = createSignal(false);


  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      window.history.back();
    });
    
    const timer = setTimeout(() => setShowTooltip(false), 10000);

    onCleanup(() => {
      off();
      clearTimeout(timer);
    });
  });

  const handleMenuOpen = () => {
    setIsMenuOpen(true);
    setShowTooltip(false);
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-24 relative overflow-x-hidden text-white">
      {/* Header */}
      <div class="px-5 pt-6 pb-4 flex items-center justify-between relative z-30 bg-[#0f1014] sticky top-0 border-b border-[#1c1c1c]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a]">
            <span class="text-sm font-bold text-[#3390ec]">{MOCK_GROUP.avatar}</span>
          </div>
          <div class="flex flex-col">
            <h1 class="text-[16px] font-bold text-white leading-tight truncate max-w-[150px]">{MOCK_GROUP.name}</h1>
            <span class={`text-[10px] font-bold uppercase tracking-wider ${
              MOCK_GROUP.status === 'paid' ? 'text-[#34c759]' : 'text-[#ffcc00]'
            }`}>
              {MOCK_GROUP.status}
            </span>
          </div>
        </div>
        
        <div class="relative">
          {/* Tooltip */}
          <Show when={showTooltip()}>
            <Motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              class={`absolute top-[120%] w-[180px] bg-[#3390ec] text-white text-[12px] font-bold p-3 rounded-2xl shadow-[0_10px_25px_rgba(51,144,236,0.4)] z-50 flex flex-col gap-2 ${isRtl() ? 'left-0 origin-top-left' : 'right-0 origin-top-right'}`}
             
            >
              <div class={`absolute -top-2 w-4 h-4 bg-[#3390ec] rotate-45 rounded-sm ${isRtl() ? 'left-4' : 'right-4'}`}></div>
              <div class="relative z-10 flex items-start justify-between gap-2">
                <span>{t('groupDashboard.tooltip')}</span>
                <button onClick={(e) => { e.stopPropagation(); setShowTooltip(false); }} class="mt-0.5 opacity-80 hover:opacity-100 p-0.5 shrink-0">
                  <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            </Motion.div>
          </Show>

          {/* Hamburger Button */}
          <button 
            onClick={handleMenuOpen}
            class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors relative"
          >
            <Show when={showTooltip()}>
              <span class={`absolute top-0 flex h-3 w-3 ${isRtl() ? 'left-0' : 'right-0'}`}>
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff3b30] opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-[#ff3b30] border-2 border-[#0f1014]"></span>
              </span>
            </Show>
            <span class="material-symbols-outlined text-white">menu</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div class="px-5 pt-6 flex flex-col gap-6">
        
        {/* Health Score & Quick Toggles */}
        <Motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          class="flex gap-3"
        >
          {/* Health Card */}
          <div class="flex-1 bg-gradient-to-br from-[#1c1c1c] to-[#0f1014] p-4 rounded-3xl border border-[#2a2a2a] flex items-center gap-4 relative overflow-hidden">
            <div class="absolute right-0 top-0 w-24 h-24 bg-[#34c759]/10 rounded-full blur-2xl"></div>
            <div class="w-14 h-14 shrink-0 rounded-full border-[4px] border-[#34c759]/30 flex items-center justify-center relative">
               <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                 <path class="text-[#34c759]" stroke-dasharray={`${MOCK_GROUP.health.score}, 100`} stroke-width="3.5" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke="currentColor"/>
               </svg>
               <span class="font-black text-white text-[14px]">{MOCK_GROUP.health.score}%</span>
            </div>
            <div class="flex flex-col z-10">
              <span class="text-[12px] text-[#8e8e93] font-bold uppercase tracking-wider">{t('groupDashboard.health')}</span>
              <span class="text-[15px] font-black text-[#34c759]">{MOCK_GROUP.health.label}</span>
              <span class="text-[10px] text-[#8e8e93] font-medium mt-0.5">{MOCK_GROUP.health.blockedSpam} {t('groupDashboard.spamBlocked')}</span>
            </div>
          </div>

          {/* Quick Toggle (Lock) */}
          <button 
            onClick={() => setIsGroupLocked(!isGroupLocked())}
            class={`w-20 shrink-0 rounded-3xl border transition-all duration-300 flex flex-col items-center justify-center gap-2 ${
              isGroupLocked() 
                ? 'bg-[#ff3b30]/10 border-[#ff3b30]/30 text-[#ff3b30]' 
                : 'bg-[#1c1c1c] border-[#2a2a2a] text-[#8e8e93] hover:text-white'
            }`}
          >
            <span class="material-symbols-outlined text-[24px]">
              {isGroupLocked() ? 'lock' : 'lock_open_right'}
            </span>
            <span class="text-[11px] font-bold leading-tight text-center px-1">
              {isGroupLocked() ? t('groupDashboard.groupLocked') : t('groupDashboard.lockGroup')}
            </span>
          </button>
        </Motion.div>

        {/* Stats Grid */}
        <div class="grid grid-cols-2 gap-3">
          {/* Total Members */}
          <Motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-1 relative overflow-hidden"
          >
            <svg class="absolute bottom-0 right-0 w-full h-1/2 opacity-20" viewBox="0 0 100 40" preserveAspectRatio="none">
              <path d="M0 40 Q 20 30, 40 35 T 80 15 T 100 20 L 100 40 Z" fill="#3390ec" />
              <path d="M0 40 Q 20 30, 40 35 T 80 15 T 100 20" fill="none" stroke="#3390ec" stroke-width="2"/>
            </svg>
            <span class="material-symbols-outlined text-[#8e8e93] text-[20px] mb-1 relative z-10">group</span>
            <h3 class="text-2xl font-black text-white relative z-10">{MOCK_GROUP.stats.totalMembers}</h3>
            <p class="text-[11px] text-[#8e8e93] font-medium flex items-center gap-1 relative z-10">
              {t('groupDashboard.totalMembers')} <span class="text-[#34c759]">{MOCK_GROUP.stats.membersChange}</span>
            </p>
          </Motion.div>

          {/* Messages Today */}
          <Motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-1 relative overflow-hidden"
          >
            <svg class="absolute bottom-0 right-0 w-full h-1/2 opacity-20" viewBox="0 0 100 40" preserveAspectRatio="none">
              <path d="M0 40 Q 20 20, 40 25 T 80 10 T 100 5 L 100 40 Z" fill="#ffcc00" />
              <path d="M0 40 Q 20 20, 40 25 T 80 10 T 100 5" fill="none" stroke="#ffcc00" stroke-width="2"/>
            </svg>
            <span class="material-symbols-outlined text-[#8e8e93] text-[20px] mb-1 relative z-10">forum</span>
            <h3 class="text-2xl font-black text-white relative z-10">{MOCK_GROUP.stats.messagesToday}</h3>
            <p class="text-[11px] text-[#8e8e93] font-medium flex items-center gap-1 relative z-10">
              {t('groupDashboard.msgsToday')} <span class="text-[#ffcc00]">{MOCK_GROUP.stats.messagesStatus}</span>
            </p>
          </Motion.div>
        </div>

        {/* Top Active Users */}
        <Motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          class="flex flex-col gap-3"
        >
          <h2 class="text-[15px] font-bold text-white px-1 flex items-center justify-between">
            <span class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[#8e8e93] text-[18px]">leaderboard</span>
              {t('groupDashboard.topUsers')}
            </span>
            <span class="text-[11px] text-[#3390ec] bg-[#3390ec]/10 px-2 py-0.5 rounded-full font-bold">{t('groupDashboard.today')}</span>
          </h2>
          
          <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-3 flex items-center justify-around gap-2">
            <For each={MOCK_GROUP.topUsers}>
              {(user, i) => (
                <div class="flex flex-col items-center gap-1.5 w-1/3">
                  <div class="relative">
                    <div class={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${
                      i() === 0 ? 'bg-[#ffcc00]/10 border-[#ffcc00] text-[#ffcc00]' : 
                      i() === 1 ? 'bg-[#e0e0e0]/10 border-[#e0e0e0] text-[#e0e0e0]' : 
                      'bg-[#cd7f32]/10 border-[#cd7f32] text-[#cd7f32]'
                    }`}>
                      {user.avatar}
                    </div>
                    <div class={`absolute -bottom-1 ${isRtl() ? '-left-1' : '-right-1'} w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-[#0f1014] ${
                      i() === 0 ? 'bg-[#ffcc00] text-black' : 
                      i() === 1 ? 'bg-[#e0e0e0] text-black' : 
                      'bg-[#cd7f32] text-black'
                    }`}>
                      {i() + 1}
                    </div>
                  </div>
                  <span class="text-[12px] font-bold text-white truncate w-full text-center mt-1">{user.name}</span>
                  <span class="text-[10px] text-[#8e8e93] font-medium leading-none">{user.msgs} {t('groupDashboard.msgs')}</span>
                </div>
              )}
            </For>
          </div>
        </Motion.div>

        {/* Recent Activity Log */}
        <Motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          class="flex flex-col gap-3"
        >
          <h2 class="text-[15px] font-bold text-white px-1 flex items-center gap-2">
            <span class="material-symbols-outlined text-[#8e8e93] text-[18px]">history</span>
            {t('groupDashboard.recentActivity')}
          </h2>
          
          <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-2 flex flex-col">
            <For each={MOCK_GROUP.recentActivity}>
              {(log, index) => (
                <div class={`flex items-start gap-3 p-3 ${index() !== MOCK_GROUP.recentActivity.length - 1 ? 'border-b border-[#2a2a2a]' : ''}`}>
                  <div class={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                    log.type === 'delete' ? 'bg-[#ff3b30]/10 text-[#ff3b30]' : 
                    log.type === 'warn' ? 'bg-[#ffcc00]/10 text-[#ffcc00]' : 
                    'bg-[#8e8e93]/10 text-[#8e8e93]'
                  }`}>
                    <span class="material-symbols-outlined text-[16px]">
                      {log.type === 'delete' ? 'delete' : log.type === 'warn' ? 'warning' : 'volume_off'}
                    </span>
                  </div>
                  <div class="flex flex-col flex-1">
                    <div class="flex items-center justify-between mb-0.5">
                      <span class="text-[13px] font-bold text-white">{log.user}</span>
                      <span class="text-[10px] text-[#8e8e93] font-medium">{log.time}</span>
                    </div>
                    <span class="text-[12px] text-[#8e8e93]">{log.action}</span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Motion.div>

        {/* Big Settings Button */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          class="pt-2"
        >
           <button 
             onClick={handleMenuOpen}
             class="w-full bg-[#1c1c1c] border border-[#2a2a2a] hover:bg-[#2a2a2a] hover:border-[#3390ec]/50 transition-all duration-300 rounded-3xl py-4 flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
           >
              <span class="material-symbols-outlined text-[#3390ec]">settings</span>
              <span class="text-[15px] font-bold text-white">{t('groupDashboard.openSettings')}</span>
           </button>
        </Motion.div>

      </div>

      {/* Hamburger Menu Drawer */}
      <HamburgerMenu 
        isOpen={isMenuOpen()} 
        onClose={() => setIsMenuOpen(false)} 
        groupId={params.id} 
        activeTab="dashboard" 
      />

    </div>
  );
};
