import { Component, For } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { SectionHeader } from '@/shared/ui/section-header.js';

const TOP_CLANS = [
  { name: 'TON Empire', members: 12400, pool: '2.4M', avatar: '👑' },
  { name: 'Crypto Wolves', members: 8700, pool: '1.8M', avatar: '🐺' },
  { name: 'Diamond Squad', members: 5300, pool: '980K', avatar: '💎' },
  { name: 'FRG Miners', members: 3100, pool: '520K', avatar: '⛏️' },
  { name: 'Moon Alliance', members: 1800, pool: '310K', avatar: '🌙' },
];

export const ClanView: Component = () => {
  return (
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-8 animate-fade-in no-scrollbar">
      <SectionHeader icon="shield" title={t('airdrop.clan.title')} subtitle={t('airdrop.clan.subtitle')} gradient="#ef4444, #f97316" shadowColor="rgba(239,68,68,0.3)" />

      {/* Actions */}
      <div class="grid grid-cols-2 gap-3 mb-5">
        <button class="bg-[#3390ec] text-white font-bold py-3.5 rounded-2xl active:scale-[0.97] transition-transform text-xs shadow-[0_4px_20px_rgba(51,144,236,0.3)]">
          <span class="flex flex-col items-center gap-1.5">
            <span class="material-symbols-outlined text-xl" style={{ 'font-variation-settings': '"FILL" 1' }}>add_circle</span>
            {t('airdrop.clan.createClanBtn')}
          </span>
        </button>
        <button class="bg-[#2c2c2e] text-white font-bold py-3.5 rounded-2xl active:scale-[0.97] transition-transform text-xs border border-white/[0.06]">
          <span class="flex flex-col items-center gap-1.5">
            <span class="material-symbols-outlined text-xl">search</span>
            {t('airdrop.clan.joinClanBtn')}
          </span>
        </button>
      </div>

      {/* Weekly Battle Banner */}
      <div class="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-2xl p-4 mb-5 flex items-center gap-3">
        <span class="material-symbols-outlined text-red-400 text-3xl" style={{ 'font-variation-settings': '"FILL" 1' }}>swords</span>
        <div>
          <div class="text-white font-bold text-sm">{t('airdrop.clan.weeklyBattle')}</div>
          <div class="text-[#8e8e93] text-[11px] mt-0.5">{t('airdrop.tasks.timeLeft')}</div>
        </div>
      </div>

      {/* Top Clans */}
      <h2 class="text-white font-bold text-sm mb-3 flex items-center gap-2 px-1">
        <span class="material-symbols-outlined text-amber-400 text-lg" style={{ 'font-variation-settings': '"FILL" 1' }}>emoji_events</span>
        {t('airdrop.clan.topClans')}
      </h2>
      <div class="bg-[#1c1c1e]/80 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/[0.04]">
        <For each={TOP_CLANS}>
          {(clan, i) => (
            <div class={`flex items-center justify-between px-4 py-3.5 ${i() < TOP_CLANS.length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
              <div class="flex items-center gap-3">
                <div class={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  i() === 0 ? 'bg-amber-400 text-black' : i() === 1 ? 'bg-gray-300 text-black' : i() === 2 ? 'bg-[#cd7f32] text-white' : 'bg-[#2c2c2e] text-[#8e8e93]'
                }`}>{i() + 1}</div>
                <div class="text-2xl">{clan.avatar}</div>
                <div>
                  <div class="text-white font-bold text-[13px]">{clan.name}</div>
                  <div class="text-[11px] text-[#8e8e93]">{clan.members.toLocaleString()} {t('airdrop.clan.members')}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-amber-400 font-black text-sm">{clan.pool}</div>
                <div class="text-[10px] text-[#8e8e93]">{t('airdrop.clan.pool')}</div>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
