import { Component, createSignal, Show, For, onCleanup, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { getDailyStatus, claimDailyReward } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
import { PROFILE_CONFIG } from '@/shared/config/profile.js';

export const GamificationHub: Component = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = createSignal(false);
  const [claimSuccess, setClaimSuccess] = createSignal(false);
  const [timeLeft, setTimeLeft] = createSignal<number>(0);
  let timerInterval: any;

  const dailyQuery = createQuery(() => ({
    queryKey: ['profile', 'daily'],
    queryFn: getDailyStatus,
  }));

  const claimDailyMutation = createMutation(() => ({
    mutationFn: claimDailyReward,
    onSuccess: (_) => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'daily'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'stats'] });
      setClaimSuccess(true);
      try { hapticFeedback.notificationOccurred('success'); } catch {}
      setTimeout(() => {
        setClaimSuccess(false);
        setShowModal(false);
      }, 2000);
    },
    onError: (err) => {
      console.error(err);
      try { hapticFeedback.notificationOccurred('error'); } catch {}
    }
  }));

  const daily = () => dailyQuery.data || null;
  const claiming = () => claimDailyMutation.isPending;

  // Sync and tick next claim countdown using server-returned time_left_seconds
  createEffect(() => {
    const data = daily();
    if (data && !data.can_claim && data.time_left_seconds) {
      setTimeLeft(Math.floor(data.time_left_seconds));
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerInterval);
            queryClient.invalidateQueries({ queryKey: ['profile', 'daily'] });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTimeLeft(0);
      if (timerInterval) clearInterval(timerInterval);
    }
  });

  onCleanup(() => {
    if (timerInterval) clearInterval(timerInterval);
  });

  const formatTimeLeft = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleClaim = async () => {
    try {
      try { hapticFeedback.impactOccurred('heavy'); } catch {}
      claimDailyMutation.mutate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleNavigate = (path: string) => {
    try { hapticFeedback.impactOccurred('light'); } catch {}
    navigate(path);
  };

  // Helper for 7-day grid rendering
  const daysArray = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div class="mx-6 mt-4 flex flex-col gap-4 font-sans text-white">
      {/* Grid of actions: Daily, Quests, Boosts, Leaderboard */}
      <div class="grid grid-cols-2 gap-3">
        {/* Daily Claim card */}
        <button
          onClick={() => {
            try { hapticFeedback.impactOccurred('light'); } catch {}
            setShowModal(true);
          }}
          class="relative overflow-hidden bg-gradient-to-br from-[#1c1c24] to-[#15161d] border border-[#2a2a2a] rounded-3xl p-4 flex flex-col text-left group active:scale-[0.98] transition-all"
        >
          <div class="flex items-center justify-between w-full mb-3">
            <div class="w-8 h-8 rounded-xl bg-[#ffd700]/10 border border-[#ffd700]/20 flex items-center justify-center text-[#ffd700]">
              <span class="material-symbols-outlined text-[18px]">calendar_today</span>
            </div>
            <Show when={daily()?.can_claim}>
              <span class="w-2.5 h-2.5 rounded-full bg-[#34c759] animate-ping" />
            </Show>
          </div>
          <span class="text-[10px] text-[#a0a4ad] font-bold uppercase tracking-wider">{t('gamification.dailyLogin') || 'Daily Login'}</span>
          <span class="text-xs font-black text-white mt-1">
            {daily()?.can_claim 
              ? (t('gamification.claimAvailable') || 'Claim Available') 
              : (t('gamification.dayClaimed')?.replace('{day}', (daily()?.streak || 0).toString()) || `Day ${daily()?.streak || 0} Claimed`)}
          </span>
        </button>

        {/* Quest/Tasks Hub */}
        <button
          onClick={() => handleNavigate('/profile/tasks')}
          class="bg-gradient-to-br from-[#1c1c24] to-[#15161d] border border-[#2a2a2a] rounded-3xl p-4 flex flex-col text-left active:scale-[0.98] transition-all"
        >
          <div class="w-8 h-8 rounded-xl bg-[#3390ec]/10 border border-[#3390ec]/20 flex items-center justify-center text-[#3390ec] mb-3">
            <span class="material-symbols-outlined text-[18px]">assignment_turned_in</span>
          </div>
          <span class="text-[10px] text-[#a0a4ad] font-bold uppercase tracking-wider">{t('gamification.questHub') || 'Quest Hub'}</span>
          <span class="text-xs font-black text-white mt-1">{t('gamification.earnFrgXp') || 'Earn FRG & XP'}</span>
        </button>

        {/* Boosts / Upgrades */}
        <button
          onClick={() => handleNavigate('/profile/boosts')}
          class="bg-gradient-to-br from-[#1c1c24] to-[#15161d] border border-[#2a2a2a] rounded-3xl p-4 flex flex-col text-left active:scale-[0.98] transition-all"
        >
          <div class="w-8 h-8 rounded-xl bg-[#ff9500]/10 border border-[#ff9500]/20 flex items-center justify-center text-[#ff9500] mb-3">
            <span class="material-symbols-outlined text-[18px]">rocket_launch</span>
          </div>
          <span class="text-[10px] text-[#a0a4ad] font-bold uppercase tracking-wider">{t('gamification.boosts') || 'Boosts'}</span>
          <span class="text-xs font-black text-white mt-1">{t('gamification.multipliersBots') || 'Multipliers & Bots'}</span>
        </button>

        {/* Leaderboard */}
        <button
          onClick={() => handleNavigate('/profile/leaderboard')}
          class="bg-gradient-to-br from-[#1c1c24] to-[#15161d] border border-[#2a2a2a] rounded-3xl p-4 flex flex-col text-left active:scale-[0.98] transition-all"
        >
          <div class="w-8 h-8 rounded-xl bg-[#34c759]/10 border border-[#34c759]/20 flex items-center justify-center text-[#34c759] mb-3">
            <span class="material-symbols-outlined text-[18px]">emoji_events</span>
          </div>
          <span class="text-[10px] text-[#a0a4ad] font-bold uppercase tracking-wider">{t('gamification.leaderboard') || 'Leaderboard'}</span>
          <span class="text-xs font-black text-white mt-1">{t('gamification.top100Elite') || 'Top 100 Elite'}</span>
        </button>
      </div>

      {/* Daily Claim Modal */}
      <Show when={showModal()}>
        <div class="fixed inset-0 bg-[#090a0d]/90 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fade-in">
          <div class="bg-[#15161d] border border-[#2a2a2a] w-full max-w-sm rounded-[32px] p-6 flex flex-col items-center shadow-2xl relative">
            <button
              onClick={() => {
                try { hapticFeedback.impactOccurred('light'); } catch {}
                setShowModal(false);
              }}
              class="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-center"
            >
              <span class="material-symbols-outlined text-[16px] text-white">close</span>
            </button>

            <span class="text-[32px] mb-2">🎁</span>
            <h3 class="text-lg font-black text-white text-center">{t('gamification.dailyCalendarTitle') || 'Daily Login Calendar'}</h3>
            <p class="text-[11px] text-[#a0a4ad] text-center mb-6">{t('gamification.dailyCalendarDesc') || 'Log in daily to claim bigger rewards. Missing a day resets the streak.'}</p>

            {/* 7-Day Grid */}
            <div class="grid grid-cols-4 gap-2 w-full mb-6">
              <For each={daysArray}>
                {(day) => {
                  const isCurrent = daily() ? (daily()!.streak % 7) + 1 === day && daily()!.can_claim : false;
                  const isClaimed = daily() ? day <= daily()!.streak : false;
                  
                  return (
                    <div 
                      class={`flex flex-col items-center justify-center p-2 rounded-2xl border text-center transition-all ${
                        isCurrent 
                          ? 'bg-[#3390ec]/15 border-[#3390ec]/50 text-[#3390ec] shadow-[0_0_8px_rgba(51,144,236,0.2)]'
                          : isClaimed
                            ? 'bg-[#34c759]/10 border-[#34c759]/30 text-[#34c759]'
                            : 'bg-[#1c1c24] border-[#222] text-[#a0a4ad]'
                      }`}
                    >
                      <span class="text-[9px] font-black uppercase tracking-wider">
                        {t('gamification.dayLabel')?.replace('{day}', day.toString()) || `Day ${day}`}
                      </span>
                      <span class="text-[10px] font-black mt-1 text-white">{PROFILE_CONFIG.DAILY_REWARDS[day-1].toLocaleString()}</span>
                      <span class="text-[8px] text-[#a0a4ad] font-bold">FRG</span>
                    </div>
                  );
                }}
              </For>
            </div>

            {/* Action Claim button */}
            <Show 
              when={claimSuccess()}
              fallback={
                <button
                  onClick={handleClaim}
                  disabled={claiming() || !daily()?.can_claim}
                  class="w-full py-4 rounded-2xl bg-[#3390ec] hover:bg-[#2b7ec9] disabled:bg-[#1c1c24] disabled:text-[#a0a4ad] disabled:border disabled:border-[#2a2a2a] disabled:hover:bg-[#1c1c24] text-xs font-black tracking-wider uppercase text-white shadow-lg active:scale-95 transition-all"
                >
                  {claiming() 
                    ? (t('gamification.claiming') || 'Claiming...') 
                    : daily()?.can_claim 
                      ? (t('gamification.claimReward') || 'Claim Reward') 
                      : `${t('gamification.comeBackTomorrow') || 'Come back tomorrow'} (${formatTimeLeft(timeLeft())})`}
                </button>
              }
            >
              <div class="w-full py-4 rounded-2xl bg-[#34c759]/10 border border-[#34c759]/20 flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-[#34c759] animate-bounce">check_circle</span>
                <span class="text-xs font-black text-[#34c759] uppercase tracking-wider">{t('gamification.claimedSuccess') || 'Claimed successfully!'}</span>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};
