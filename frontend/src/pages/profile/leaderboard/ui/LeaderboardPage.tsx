import { Component, onMount, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { getLeaderboard, getProfileStats } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';

export const LeaderboardPage: Component = () => {
  const navigate = useNavigate();

  const leaderboardQuery = createQuery(() => ({
    queryKey: ['profile', 'leaderboard'],
    queryFn: getLeaderboard,
    staleTime: 60000,
  }));

  const statsQuery = createQuery(() => ({
    queryKey: ['profile', 'stats'],
    queryFn: getProfileStats,
    staleTime: 15000,
  }));

  const leaderboard = () => leaderboardQuery.data || [];
  const myStats = () => statsQuery.data || null;
  const loading = () => leaderboardQuery.isLoading || statsQuery.isLoading;

  onMount(() => {
    try {
      backButton.show();
      const off = backButton.onClick(() => {
        try { hapticFeedback.impactOccurred('light'); } catch {}
        navigate('/profile');
      });
      onCleanup(() => {
        off();
        try { backButton.hide(); } catch {}
      });
    } catch {}
  });

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-[#FFD700] bg-[#FFD700]/10 border-[#FFD700]/20';
    if (rank === 2) return 'text-[#C0C0C0] bg-[#C0C0C0]/10 border-[#C0C0C0]/20';
    if (rank === 3) return 'text-[#CD7F32] bg-[#CD7F32]/10 border-[#CD7F32]/20';
    return 'text-[#a0a4ad] bg-[#1c1c1c] border-[#2a2a2a]';
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-32 text-white font-sans">
      {/* Top Banner Header */}
      <div class="relative bg-gradient-to-b from-[#1a1b23] to-[#0f1014] pt-12 pb-8 px-6 text-center border-b border-[#222]">
        <div class="absolute top-4 left-6 flex items-center gap-2">
          <button 
            onClick={() => {
              try { hapticFeedback.impactOccurred('light'); } catch {}
              navigate('/profile');
            }} 
            class="flex items-center justify-center w-8 h-8 rounded-full bg-[#1c1c1c] border border-[#2a2a2a]"
          >
            <span class="material-symbols-outlined text-[16px] text-white">arrow_back</span>
          </button>
        </div>

        <h1 class="text-2xl font-black tracking-tight text-white mb-1">{t('gamification.globalLeaderboard') || 'Global Leaderboard'}</h1>
        <p class="text-xs text-[#a0a4ad]">{t('gamification.leaderboardSubtitle') || 'Top 100 elite iFragment miners worldwide'}</p>

        {/* Top 3 Podiums Visual representation */}
        <div class="flex justify-center items-end gap-4 mt-8">
          {/* Rank 2 */}
          <Show when={leaderboard().length >= 2}>
            <div class="flex flex-col items-center">
              <div class="w-12 h-12 rounded-full bg-[#c0c0c0]/10 border-2 border-[#c0c0c0] flex items-center justify-center text-lg font-black shadow-lg">🥈</div>
              <span class="text-[10px] font-bold mt-2 max-w-[70px] truncate">{leaderboard()[1].first_name}</span>
              <span class="text-[9px] text-[#c0c0c0]">{leaderboard()[1].xp.toLocaleString()} XP</span>
            </div>
          </Show>

          {/* Rank 1 */}
          <Show when={leaderboard().length >= 1}>
            <div class="flex flex-col items-center -translate-y-2">
              <div class="w-16 h-16 rounded-full bg-[#ffd700]/10 border-2 border-[#ffd700] flex items-center justify-center text-2xl font-black shadow-[0_0_15px_rgba(255,215,0,0.2)]">🥇</div>
              <span class="text-xs font-black mt-2 max-w-[85px] truncate text-[#ffd700]">{leaderboard()[0].first_name}</span>
              <span class="text-[10px] text-[#ffd700] font-black">{leaderboard()[0].xp.toLocaleString()} XP</span>
            </div>
          </Show>

          {/* Rank 3 */}
          <Show when={leaderboard().length >= 3}>
            <div class="flex flex-col items-center">
              <div class="w-12 h-12 rounded-full bg-[#cd7f32]/10 border-2 border-[#cd7f32] flex items-center justify-center text-lg font-black shadow-lg">🥉</div>
              <span class="text-[10px] font-bold mt-2 max-w-[70px] truncate">{leaderboard()[2].first_name}</span>
              <span class="text-[9px] text-[#cd7f32]">{leaderboard()[2].xp.toLocaleString()} XP</span>
            </div>
          </Show>
        </div>
      </div>

      {loading() ? (
        <div class="flex flex-col items-center justify-center py-20 gap-4">
          <div class="w-10 h-10 rounded-full border-4 border-[#3390ec]/20 border-t-[#3390ec] animate-spin" />
          <span class="text-[10px] text-[#a0a4ad] font-bold uppercase tracking-wider">{t('gamification.loadingLeaderboard') || 'Loading Leaderboard...'}</span>
        </div>
      ) : (
        <div class="px-6 py-4 flex flex-col gap-3">
          <For each={leaderboard()}>
            {(member) => (
              <div class="flex items-center justify-between bg-[#15161d]/60 border border-[#222]/80 rounded-2xl p-4 transition-all hover:bg-[#1c1d26]">
                <div class="flex items-center gap-3">
                  {/* Rank Badge */}
                  <div class={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-black ${getRankColor(member.rank)}`}>
                    {getRankBadge(member.rank)}
                  </div>
                  {/* Name and Level */}
                  <div class="flex flex-col">
                    <span class="text-xs font-black text-white">{member.first_name}</span>
                    <span class="text-[10px] text-[#a0a4ad] font-semibold">
                      {t('gamification.levelLabel')?.replace('{level}', member.level.toString()) || `Level ${member.level}`}
                    </span>
                  </div>
                </div>
                {/* Score */}
                <div class="flex flex-col items-end">
                  <span class="text-xs font-black text-[#3390ec]">{member.xp.toLocaleString()}</span>
                  <span class="text-[9px] text-[#a0a4ad] font-bold uppercase tracking-widest">XP</span>
                </div>
              </div>
            )}
          </For>
        </div>
      )}

      {/* Sticky Bottom Current User Stat bar */}
      <Show when={myStats() && !loading()}>
        <div class="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#090a0d] to-[#121319] border-t border-[#2a2a2a] px-6 py-4 flex items-center justify-between z-40 shadow-2xl">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center text-sm font-black text-[#3390ec]">
              #{myStats()?.globalRank || '-'}
            </div>
            <div class="flex flex-col">
              <span class="text-xs font-black text-white">{t('gamification.yourGlobalRank') || 'Your Global Rank'}</span>
              <span class="text-[10px] text-[#a0a4ad] font-semibold">
                {t('gamification.levelXpLabel')
                  ?.replace('{level}', (myStats()?.level || 0).toString())
                  ?.replace('{xp}', (myStats()?.xp || 0).toLocaleString()) 
                  || `Level ${myStats()?.level} • ${myStats()?.xp.toLocaleString()} XP`}
              </span>
            </div>
          </div>
          <button 
            onClick={() => {
              try { hapticFeedback.impactOccurred('medium'); } catch {}
              navigate('/profile');
            }}
            class="px-4 py-2 bg-[#3390ec] hover:bg-[#2b7ec9] text-[10px] font-black text-white rounded-xl uppercase tracking-wider transition-all"
          >
            {t('gamification.myHub') || 'My Hub'}
          </button>
        </div>
      </Show>
    </div>
  );
};
