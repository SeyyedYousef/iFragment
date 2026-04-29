import { Component, For } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { leaderboard, balance, LEAGUES } from '@/shared/store/airdrop.js';
import { SectionHeader } from '@/shared/ui/section-header.js';

export const LeaderboardView: Component = () => {
  const getLeagueColor = (name: string) => LEAGUES.find(l => l.name === name)?.color || '#8e8e93';

  return (
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-8 animate-fade-in no-scrollbar">
      <SectionHeader icon="emoji_events" title={t('airdrop.leaderboard.title')} subtitle={t('airdrop.leaderboard.subtitle')} gradient="#f59e0b, #d97706" shadowColor="rgba(245,158,11,0.3)" />

      {/* Your Position */}
      <div class="bg-[#3390ec]/10 border border-[#3390ec]/20 rounded-2xl p-4 mb-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-[#3390ec]/20 flex items-center justify-center text-[#3390ec] font-black text-sm">#?</div>
          <div>
            <div class="text-[11px] text-[#3390ec] font-semibold uppercase">{t('airdrop.leaderboard.yourPosition')}</div>
            <div class="text-white font-black text-sm">{balance().toLocaleString()}</div>
          </div>
        </div>
        <span class="text-[#8e8e93] text-[11px] font-semibold">{t('airdrop.leaderboard.totalMiners')}</span>
      </div>

      {/* List */}
      <div class="bg-[#1c1c1e]/80 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/[0.04]">
        <For each={leaderboard}>
          {(entry, i) => (
            <div class={`flex items-center justify-between px-4 py-3.5 ${i() < leaderboard.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
              <div class="flex items-center gap-3">
                <div class={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                  entry.rank === 1 ? 'bg-amber-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.4)]' :
                  entry.rank === 2 ? 'bg-gray-300 text-black' :
                  entry.rank === 3 ? 'bg-[#cd7f32] text-white' :
                  'bg-[#2c2c2e] text-[#8e8e93]'
                }`}>
                  {entry.rank <= 3 ? (
                    <span class="material-symbols-outlined text-sm" style={{ 'font-variation-settings': '"FILL" 1' }}>emoji_events</span>
                  ) : entry.rank}
                </div>
                <div>
                  <div class="text-white font-bold text-[13px]">{entry.name}</div>
                  <div class="text-[11px] font-semibold" style={{ color: getLeagueColor(entry.league) }}>{entry.league}</div>
                </div>
              </div>
              <div class="text-amber-400 font-black text-sm tabular-nums">{entry.score.toLocaleString()}</div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
