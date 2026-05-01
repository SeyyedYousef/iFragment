import { Component, createSignal } from 'solid-js';
import { t, locale } from '@/shared/i18n/index.js';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { balance, setBalance, frgBalance, setFrgBalance } from '@/shared/store/airdrop.js';
import { SectionHeader } from '@/shared/ui/section-header.js';

const isRtl = () => locale() === 'fa';

export const MarketView: Component = () => {
  const [amount, setAmount] = createSignal('');
  const RATE = 100000;

  const frgAmount = () => {
    const num = parseInt(amount());
    return isNaN(num) ? 0 : num / RATE;
  };

  const handleConvert = () => {
    const num = parseInt(amount());
    if (isNaN(num) || num <= 0 || num > balance()) return;
    try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
    setBalance(b => b - num);
    setFrgBalance(f => f + frgAmount());
    setAmount('');
  };

  return (
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-8 animate-fade-in no-scrollbar">
      <SectionHeader icon="currency_exchange" title={t('airdrop.market.title')} subtitle={t('airdrop.market.subtitle')} gradient="#3390ec, #14b8a6" shadowColor="rgba(51,144,236,0.3)" />

      {/* Exchange card */}
      <div class="bg-[#1c1c1e]/80 backdrop-blur-lg rounded-2xl p-5 border border-white/[0.06] mb-5">
        <h3 class="text-white font-bold text-sm mb-4">{t('airdrop.market.convertTitle')}</h3>

        <div class="flex items-center justify-between bg-[#2c2c2e]/50 rounded-xl p-3 mb-3">
          <span class="text-[#8e8e93] text-xs font-medium">{t('airdrop.market.balance')}</span>
          <span class="text-amber-400 font-black text-sm flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]" style={{ 'font-variation-settings': '"FILL" 1' }}>monetization_on</span>
            {balance().toLocaleString()}
          </span>
        </div>

        <div class="flex items-center justify-between bg-[#2c2c2e]/50 rounded-xl p-3 mb-4">
          <span class="text-[#8e8e93] text-xs font-medium">{t('airdrop.market.rate')}</span>
          <span class="text-[#3390ec] font-bold text-xs">{RATE.toLocaleString()} = 1 FRG</span>
        </div>

        <div class="flex items-center justify-between bg-[#2c2c2e]/50 rounded-xl p-3 mb-4">
          <span class="text-[#8e8e93] text-xs font-medium">FRG Balance</span>
          <span class="text-white font-bold text-xs">{frgBalance().toFixed(4)} FRG</span>
        </div>

        <div class="relative mb-3">
          <input
            type="number"
            min="0"
            max={balance()}
            step="1000"
            value={amount()}
            onInput={(e) => setAmount(e.target.value)}
            placeholder="0"
            class="w-full bg-[#2c2c2e] text-white font-bold text-lg py-3.5 px-4 rounded-xl border border-white/[0.04] focus:border-[#3390ec]/40 focus:outline-none transition-colors placeholder:text-[#555]"
          />
          <button
            onClick={() => setAmount(balance().toString())}
            class={`absolute ${isRtl() ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-[#3390ec] text-xs font-bold`}
          >MAX</button>
        </div>

        <div class="flex items-center justify-center gap-2 py-3 mb-4">
          <span class="material-symbols-outlined text-[#8e8e93] text-lg">arrow_downward</span>
          <span class="text-white font-black text-lg">{frgAmount().toFixed(4)} FRG</span>
        </div>

        <button
          onClick={handleConvert}
          disabled={frgAmount() <= 0 || parseInt(amount()) > balance()}
          class={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all ${
            frgAmount() > 0 && parseInt(amount()) <= balance()
              ? 'bg-[#3390ec] text-white active:scale-[0.97] shadow-[0_4px_20px_rgba(51,144,236,0.4)]'
              : 'bg-[#2c2c2e] text-[#555]'
          }`}
        >
          {t('airdrop.market.convertBtn')}
        </button>
      </div>

      {/* Utilities List */}
      <div class="bg-[#1c1c1e]/80 backdrop-blur-lg rounded-2xl p-5 border border-white/[0.04]">
        <h3 class="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-[#3390ec]" style={{ 'font-variation-settings': '"FILL" 1' }}>info</span>
          {t('airdrop.market.frgUtility')}
        </h3>
        <div class="space-y-3">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-[#14b8a6] mt-0.5" style={{ 'font-variation-settings': '"FILL" 1' }}>verified</span>
            <div>
              <div class="text-white font-semibold text-xs">{t('airdrop.market.utilUsernames')}</div>
              <div class="text-[#8e8e93] text-[10px] leading-tight mt-0.5">{t('airdrop.market.utilUsernamesDesc')}</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-[#f59e0b] mt-0.5" style={{ 'font-variation-settings': '"FILL" 1' }}>card_giftcard</span>
            <div>
              <div class="text-white font-semibold text-xs">{t('airdrop.market.utilGifts')}</div>
              <div class="text-[#8e8e93] text-[10px] leading-tight mt-0.5">{t('airdrop.market.utilGiftsDesc')}</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-[#8b5cf6] mt-0.5" style={{ 'font-variation-settings': '"FILL" 1' }}>admin_panel_settings</span>
            <div>
              <div class="text-white font-semibold text-xs">{t('airdrop.market.utilAdmin')}</div>
              <div class="text-[#8e8e93] text-[10px] leading-tight mt-0.5">{t('airdrop.market.utilAdminDesc')}</div>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-[#ef4444] mt-0.5" style={{ 'font-variation-settings': '"FILL" 1' }}>rocket_launch</span>
            <div>
              <div class="text-white font-semibold text-xs">{t('airdrop.market.utilServices')}</div>
              <div class="text-[#8e8e93] text-[10px] leading-tight mt-0.5">{t('airdrop.market.utilServicesDesc')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
