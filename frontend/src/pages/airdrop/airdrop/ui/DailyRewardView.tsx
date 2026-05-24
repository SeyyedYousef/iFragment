import { Component, For } from 'solid-js';
import { t, locale } from '@/shared/i18n/index.js';

const isRtl = () => locale() === 'fa';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { streakDay, checkedInToday, claimDailyReward, DAILY_REWARDS } from '@/shared/store/airdrop.js';
import { SectionHeader } from '@/shared/ui/section-header.js';

export const DailyRewardView: Component = () => {
  const handleClaim = async () => {
    const reward = await claimDailyReward();
    if (reward) {
      try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
    }
  };

  return (
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-8 animate-fade-in no-scrollbar">
      <SectionHeader icon="calendar_month" title={t('airdrop.daily.title')} subtitle={t('airdrop.daily.subtitle')} gradient="#f59e0b, #f97316" shadowColor="rgba(245,158,11,0.3)">
        <div class="mt-3 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined text-amber-400 text-sm" style={{ 'font-variation-settings': '"FILL" 1' }}>local_fire_department</span>
          <span class="text-amber-400 font-black text-sm">{streakDay()} {t('airdrop.daily.streak')}</span>
        </div>
      </SectionHeader>

      {/* Calendar Grid */}
      <div class="grid grid-cols-4 gap-2.5 mb-6">
        <For each={DAILY_REWARDS}>
          {(reward, i) => {
            const isPast = () => i() < streakDay();
            const isCurrent = () => i() === streakDay();
            const isLocked = () => i() > streakDay();
            const isClaimable = () => isCurrent() && !checkedInToday();

            return (
              <div class={`relative rounded-2xl p-3 flex flex-col items-center justify-center text-center border transition-all ${
                isPast() ? 'bg-[#34c759]/10 border-[#34c759]/20' :
                isClaimable() ? 'bg-[#3390ec]/15 border-[#3390ec]/30 animate-pulse shadow-[0_0_20px_rgba(51,144,236,0.15)]' :
                isCurrent() && checkedInToday() ? 'bg-[#34c759]/10 border-[#34c759]/20' :
                'bg-[#1c1c1e]/80 border-white/[0.04]'
              }`}>
                <span class={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                  isPast() || (isCurrent() && checkedInToday()) ? 'text-[#34c759]' :
                  isClaimable() ? 'text-[#3390ec]' : 'text-[#8e8e93]'
                }`}>{t('airdrop.daily.day')} {i() + 1}</span>

                {isPast() || (isCurrent() && checkedInToday()) ? (
                  <span class="material-symbols-outlined text-[#34c759] text-xl" style={{ 'font-variation-settings': '"FILL" 1' }}>check_circle</span>
                ) : (
                  <span class="material-symbols-outlined text-amber-400 text-xl" style={{ 'font-variation-settings': '"FILL" 1' }}>monetization_on</span>
                )}

                <span class={`text-xs font-black mt-1 ${
                  isPast() || (isCurrent() && checkedInToday()) ? 'text-[#34c759]' :
                  isClaimable() ? 'text-white' : 'text-[#8e8e93]'
                }`}>
                  {isPast() || (isCurrent() && checkedInToday()) ? t('airdrop.daily.claimed') : `+${reward.toLocaleString()}`}
                </span>

                {isLocked() && (
                  <span class={`material-symbols-outlined text-[#8e8e93]/30 text-base absolute top-2 ${isRtl() ? 'left-2' : 'right-2'}`}>lock</span>
                )}
              </div>
            );
          }}
        </For>
      </div>

      {/* Claim Button */}
      {!checkedInToday() ? (
        <button onClick={handleClaim} class="w-full bg-[#3390ec] text-white font-bold py-4 rounded-2xl active:scale-[0.97] transition-transform shadow-[0_4px_20px_rgba(51,144,236,0.4)] text-sm">
          <span class="flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-lg" style={{ 'font-variation-settings': '"FILL" 1' }}>card_giftcard</span>
            {t('airdrop.daily.claimBtn')}
            <span class="text-amber-300 font-black">+{DAILY_REWARDS[streakDay()].toLocaleString()}</span>
          </span>
        </button>
      ) : (
        <div class="w-full bg-[#1c1c1e] text-[#8e8e93] font-bold py-4 rounded-2xl text-sm text-center border border-white/[0.04]">
          <span class="flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-lg">schedule</span>
            {t('airdrop.daily.comeBack')}
          </span>
        </div>
      )}
    </div>
  );
};
