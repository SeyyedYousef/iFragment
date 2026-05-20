import { Component } from 'solid-js';
import { Motion } from '@motionone/solid';
import { t, locale } from '@/shared/i18n/index.js';
import type { ProfileStats } from '@/shared/store/profile.js';
import { useNavigate } from '@solidjs/router';

interface Props { stats: ProfileStats | null }

export const FrgWalletCard: Component<Props> = (props) => {
  const navigate = useNavigate();

  const formatNum = (n: number) => {
    const isFa = locale() === 'fa';
    if (n >= 1_000_000) {
      const val = (n / 1_000_000).toFixed(1);
      return (isFa ? parseFloat(val).toLocaleString('fa-IR') : val) + (isFa ? ' میلیون' : 'M');
    }
    if (n >= 1_000) {
      const val = (n / 1_000).toFixed(1);
      return (isFa ? parseFloat(val).toLocaleString('fa-IR') : val) + (isFa ? ' هزار' : 'K');
    }
    return n.toLocaleString(isFa ? 'fa-IR' : 'en-US');
  };

  return (
    <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      class="mx-6 -mt-10 relative z-20 rounded-3xl p-5 border border-[#2a2a2a] overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(51,144,236,0.08), rgba(52,199,89,0.08))', 'backdrop-filter': 'blur(20px)' }}>
      {/* Glow accent */}
      <div class="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-2xl" style={{ background: 'radial-gradient(circle, #3390ec, transparent)' }} />

      <div class="flex items-center gap-2 mb-3">
        <span class="material-symbols-outlined text-[20px] text-[#3390ec]" style={{ 'font-variation-settings': '"FILL" 1' }}>account_balance_wallet</span>
        <span class="text-white font-black text-sm">FRG {t('profile.wallet') || 'Wallet'}</span>
      </div>

      <div class="flex items-baseline gap-2 mb-4">
        <span class="text-white font-black text-3xl tracking-tight">{props.stats ? formatNum(props.stats.frgBalance) : '---'}</span>
        <span class="text-[#3390ec] font-bold text-sm">FRG</span>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-[#0f1014]/60 rounded-2xl p-3 border border-[#2a2a2a]">
          <span class="text-[10px] text-[#a0a4ad] uppercase font-bold tracking-widest block mb-1">{t('profile.totalEarned') || 'Total Earned'}</span>
          <span class="text-[#34c759] font-bold text-sm">+{props.stats ? formatNum(props.stats.totalFrgEarned) : '0'}</span>
        </div>
        <div class="bg-[#0f1014]/60 rounded-2xl p-3 border border-[#2a2a2a]">
          <span class="text-[10px] text-[#a0a4ad] uppercase font-bold tracking-widest block mb-1">{t('profile.totalSpent') || 'Total Spent'}</span>
          <span class="text-[#ff6b6b] font-bold text-sm">-{props.stats ? formatNum(props.stats.totalFrgSpent) : '0'}</span>
        </div>
      </div>

      <div class="flex gap-2">
        <button onClick={() => navigate('/marketplace')} class="flex-1 py-2.5 rounded-2xl bg-[#3390ec]/15 border border-[#3390ec]/30 text-[#3390ec] font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#3390ec]/25 transition-colors">
          <span class="material-symbols-outlined text-[16px]">storefront</span>
          {t('profile.goToMarket') || 'Marketplace'}
        </button>
        <button onClick={() => navigate('/airdrop')} class="flex-1 py-2.5 rounded-2xl bg-[#34c759]/15 border border-[#34c759]/30 text-[#34c759] font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#34c759]/25 transition-colors">
          <span class="material-symbols-outlined text-[16px]">swap_horiz</span>
          {t('profile.convertCoins') || 'Convert'}
        </button>
      </div>
    </Motion.div>
  );
};
