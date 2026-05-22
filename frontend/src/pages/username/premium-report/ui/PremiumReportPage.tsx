import { Component, createEffect, createSignal, onCleanup, Show, For } from 'solid-js';
import { Motion } from '@motionone/solid';
import { backButton, openTelegramLink, openLink } from '@tma.js/sdk-solid';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { requestPremiumReport, usePremiumReport } from '@/entities/username/api/index.js';
import type { SaleRecord } from '@/entities/username/api/index.js';
import { useI18n } from '@/shared/i18n/index.js';
import { openInvoice } from '@/shared/lib/telegram-native.js';

type ApiError = Error & { response?: { status?: number; data?: { message?: string } } };

const Skeleton: Component = () => (
  <div class="animate-pulse space-y-8">
    <div class="flex flex-col items-center gap-4">
      <div class="w-32 h-6 bg-[#1c1c1c] rounded-full border border-[#2a2a2a]" />
      <div class="w-56 h-12 bg-[#1c1c1c] rounded-2xl border border-[#2a2a2a]" />
      <div class="w-24 h-8 bg-[#1c1c1c] rounded-xl border border-[#2a2a2a]" />
    </div>
    <div class="w-full h-64 bg-[#1c1c1c] rounded-[40px] border border-[#2a2a2a]" />
    <div class="grid grid-cols-2 gap-4">
      <div class="h-24 bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a]" />
      <div class="h-24 bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a]" />
      <div class="h-32 bg-[#1c1c1c] rounded-3xl col-span-2 border border-[#2a2a2a]" />
    </div>
  </div>
);

export const PremiumReportPage: Component = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const username = () => searchParams.u || '';
  const [isPaying, setIsPaying] = createSignal(false);
  const [paymentError, setPaymentError] = createSignal('');
  
  const report = usePremiumReport(username);
  const isPaymentRequired = () => (report.error as ApiError | null)?.response?.status === 402;

  createEffect(() => {
    backButton.show();
    const unsubscribe = backButton.onClick(() => {
      if (window.history.length > 1) navigate(-1);
      else navigate('/');
    });
    onCleanup(() => {
      unsubscribe();
      backButton.hide();
    });
  });

  const handleShare = () => {
    const text = t('pages.premiumReport.shareText')
      .replace('{u}', username())
      .replace('{score}', String(report.data?.rarity_score || 0));
    
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/iFragmentBot/app')}&text=${encodeURIComponent(text)}`;
    openTelegramLink(shareUrl);
  };

  const handlePayment = async () => {
    if (!username() || isPaying()) return;
    setPaymentError('');
    setIsPaying(true);
    try {
      const { invoice_link } = await requestPremiumReport(username());
      const status = await openInvoice(invoice_link);
      if (status === 'paid') {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const result = await report.refetch();
          if (result.data) return;
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
        setPaymentError(t('pages.premiumReport.unlockPending'));
      } else {
        setPaymentError(t('pages.premiumReport.paymentNotCompleted'));
      }
    } catch (err: any) {
      setPaymentError(err?.response?.data?.message || err?.message || t('pages.premiumReport.paymentStartFailed'));
    } finally {
      setIsPaying(false);
    }
  };

  const openFragment = () => {
    const fragmentUrl = report.data?.fragment_url;
    if (!fragmentUrl) return;
    try {
      const url = new URL(fragmentUrl);
      if (url.protocol === 'https:' && url.hostname === 'fragment.com') {
        openLink(url.toString());
      }
    } catch {
      // Ignore malformed external URLs from upstream data.
    }
  };

  const usdValue = (ton?: number) => {
    const rate = report.data?.exchange_rate;
    if (!ton || !rate) return '';
    return (ton * rate).toFixed(2);
  };

  const paidSales = () => {
    const sales = report.data?.past_sales || [];
    return sales
      .filter((sale): sale is SaleRecord => Number(sale.price) > 0 && !!sale.date)
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const chartPoints = () => {
    const sales = paidSales();
    if (sales.length === 0) return '';
    const prices = sales.map((sale) => sale.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;
    return sales
      .map((sale, index) => {
        const x = sales.length === 1 ? 160 : 16 + (index / (sales.length - 1)) * 288;
        const y = 112 - ((sale.price - min) / span) * 88;
        return `${x},${y}`;
      })
      .join(' ');
  };

  const confidencePercent = () => Math.round((report.data?.value_estimate?.confidence || 0) * 100);

  const getFormatType = (score: number) => {
    if (score > 5000) return 'Legendary';
    if (score > 2000) return 'Ultra Rare';
    if (score > 1000) return 'Rare';
    if (score > 500) return 'Uncommon';
    return 'Standard';
  };

  return (
    <div class="min-h-screen bg-[#0a0b0e] text-white p-4 pb-32 safe-area-bottom">
      <Show when={!report.isLoading} fallback={<Skeleton />}>
        <Show when={report.error}>
          <div class="flex flex-col items-center justify-center pt-20">
            <Show when={isPaymentRequired()} fallback={
              <>
                <span class="material-symbols-outlined text-[48px] text-red-500 mb-4">error</span>
                <p class="text-white/80 font-bold text-center mb-4">
                  {report.error?.message || 'Error loading report'}
                </p>
                <button
                  class="px-6 py-3 bg-[#3390ec] active:scale-95 transition-all rounded-xl font-black uppercase tracking-wider"
                  onClick={() => report.refetch()}
                  aria-label="Retry connection"
                >
                  Retry Connection
                </button>
              </>
            }>
              <span class="material-symbols-outlined text-[48px] text-[#3390ec] mb-4">lock</span>
              <h1 class="text-2xl font-black text-center mb-2">@{username()}</h1>
              <p class="text-[#a6a6ad] font-bold text-center mb-6 max-w-[320px]">
                {t('pages.premiumReport.paymentRequired')}
              </p>
              <button
                class="px-6 py-3 bg-[#3390ec] active:scale-95 transition-all rounded-xl font-black uppercase tracking-wider disabled:opacity-50"
                onClick={handlePayment}
                disabled={isPaying()}
                aria-busy={isPaying()}
              >
                {isPaying() ? t('pages.premiumReport.openingInvoice') : t('pages.premiumReport.unlock')}
              </button>
              <Show when={paymentError()}>
                <p class="text-red-400 text-xs font-bold text-center mt-4" aria-live="polite">{paymentError()}</p>
              </Show>
            </Show>
          </div>
        </Show>

        <Show when={report.data}>
          <Motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, easing: [0.23, 1, 0.32, 1] }}
          >
            {/* ── HEADER ── */}
            <div class="text-center mb-8">
              <div class="inline-block px-4 py-1.5 rounded-full bg-[#3390ec]/10 border border-[#3390ec]/20 text-[#3390ec] text-[10px] font-black uppercase tracking-widest mb-4">
                Global Intelligence
              </div>
              <h1 class="text-4xl font-black tracking-tight text-white mb-4">@{username()}</h1>
              
              <div class="flex flex-wrap items-center justify-center gap-2">
                 <span class={`px-3 py-1.5 rounded-lg text-xs font-black uppercase border shadow-sm ${
                   report.data?.status === 'available' ? 'bg-[#34c759]/10 text-[#34c759] border-[#34c759]/20' : 
                   report.data?.status === 'on_auction' || report.data?.status === 'on_sale' ? 'bg-[#ff9500]/10 text-[#ff9500] border-[#ff9500]/20' : 
                   'bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/20'
                 }`}>
                   {report.data?.status === 'purchase_available' ? 'Purchase Available' : report.data?.status.replace('_', ' ')}
                 </span>
                 <Show when={report.data?.peer_type && report.data.peer_type !== 'unknown'}>
                    <span class="px-3 py-1.5 rounded-lg text-xs font-black uppercase border bg-[#1c1c1c] text-[#8e8e93] border-[#2a2a2a]">
                      {report.data?.peer_type}
                    </span>
                 </Show>
              </div>

              {/* Badges / Warnings */}
              <div class="flex flex-wrap items-center justify-center gap-2 mt-3">
                <Show when={report.data?.is_verified}>
                  <span class="flex items-center gap-1 px-2.5 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-md text-[10px] font-bold uppercase">
                    <span class="material-symbols-outlined text-[12px]">verified</span> Verified
                  </span>
                </Show>
                <Show when={report.data?.is_premium}>
                  <span class="flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 border border-blue-600/30 text-blue-400 rounded-md text-[10px] font-bold uppercase">
                    <span class="material-symbols-outlined text-[12px]">star</span> Premium
                  </span>
                </Show>
                <Show when={report.data?.is_scam}>
                  <span class="flex items-center gap-1 px-2.5 py-1 bg-red-500/20 border border-red-500/30 text-red-400 rounded-md text-[10px] font-bold uppercase">
                    <span class="material-symbols-outlined text-[12px]">warning</span> Scam
                  </span>
                </Show>
                <Show when={report.data?.is_fake}>
                  <span class="flex items-center gap-1 px-2.5 py-1 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-md text-[10px] font-bold uppercase">
                    <span class="material-symbols-outlined text-[12px]">report</span> Fake
                  </span>
                </Show>
              </div>
            </div>

            {/* ── MAIN METRICS (Rarity & Value) ── */}
            <div class="bg-[#141518] border border-[#2a2a2a] rounded-[32px] p-6 mb-4 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              <div class="absolute -right-10 -top-10 opacity-5 pointer-events-none">
                <span class="material-symbols-outlined" style={{ "font-size": "200px" }}>diamond</span>
              </div>
              
              <div class="grid grid-cols-2 gap-4 items-center">
                <div class="flex flex-col items-center border-r border-[#2a2a2a] pr-4">
                  <span class="text-[10px] text-[#8e8e93] font-black uppercase tracking-widest mb-2 flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">stars</span> Rarity
                  </span>
                  <div class="flex items-baseline gap-1">
                    <span class="text-4xl font-black text-[#3390ec]">{report.data?.rarity_score}</span>
                    <span class="text-sm text-white/40 font-bold">/10k</span>
                  </div>
                  <span class="text-[11px] font-bold text-white/60 mt-1">{getFormatType(report.data?.rarity_score || 0)}</span>
                </div>
                
                <div class="flex flex-col items-center pl-4">
                  <span class="text-[10px] text-[#8e8e93] font-black uppercase tracking-widest mb-2 flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">query_stats</span> Est. Value
                  </span>
                  <div class="flex items-baseline gap-1">
                    <span class="text-3xl font-black text-white">{report.data?.estimated_value?.toFixed(1) || 'N/A'}</span>
                    <span class="text-sm text-[#3390ec] font-bold">TON</span>
                  </div>
                  <Show when={report.data?.estimated_value && report.data?.exchange_rate}>
                    <span class="text-[11px] font-bold text-[#8e8e93] mt-0.5">
                      ~${(report.data!.estimated_value! * report.data!.exchange_rate!).toFixed(2)}
                    </span>
                  </Show>
                  <Show when={report.data?.value_estimate}>
                    <span class="text-[10px] font-bold text-[#8e8e93] mt-1">
                      {report.data!.value_estimate!.p10_ton.toFixed(1)}-{report.data!.value_estimate!.p90_ton.toFixed(1)} TON
                    </span>
                  </Show>
                  <span class="text-[10px] font-bold text-[#34c759] mt-1.5 flex items-center gap-1 bg-[#34c759]/10 px-2 py-0.5 rounded">
                    <span class="material-symbols-outlined text-[12px]">trending_up</span> Strong Asset
                  </span>
                </div>
              </div>
            </div>

            <Show when={report.data?.value_estimate}>
              <div class="bg-[#141518] border border-[#2a2a2a] p-5 rounded-[24px] mb-4">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-[#8e8e93] text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px]">analytics</span> Price Model
                  </h3>
                  <span class="text-[10px] font-black text-[#34c759] bg-[#34c759]/10 border border-[#34c759]/20 px-2.5 py-1 rounded-lg">
                    {confidencePercent()}% confidence
                  </span>
                </div>
                <div class="grid grid-cols-3 gap-2">
                  <div class="bg-[#1c1c1c] rounded-xl border border-[#2a2a2a] p-3">
                    <span class="text-[9px] text-[#8e8e93] font-black uppercase">P10</span>
                    <div class="text-sm font-black text-white mt-1">{report.data!.value_estimate!.p10_ton.toFixed(1)}</div>
                  </div>
                  <div class="bg-[#1c1c1c] rounded-xl border border-[#3390ec]/30 p-3">
                    <span class="text-[9px] text-[#3390ec] font-black uppercase">Median</span>
                    <div class="text-sm font-black text-white mt-1">{report.data!.value_estimate!.p50_ton.toFixed(1)}</div>
                  </div>
                  <div class="bg-[#1c1c1c] rounded-xl border border-[#2a2a2a] p-3">
                    <span class="text-[9px] text-[#8e8e93] font-black uppercase">P90</span>
                    <div class="text-sm font-black text-white mt-1">{report.data!.value_estimate!.p90_ton.toFixed(1)}</div>
                  </div>
                </div>
                <Show when={report.data?.value_estimate?.signals?.length}>
                  <div class="flex flex-wrap gap-1.5 mt-4">
                    <For each={report.data?.value_estimate?.signals?.slice(0, 6)}>
                      {(signal) => (
                        <span class="text-[9px] font-bold uppercase text-[#8e8e93] bg-[#1c1c1c] border border-[#2a2a2a] px-2 py-1 rounded-md">
                          {signal.split('_').join(' ')}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </Show>

            {/* ── LINGUISTIC & SEARCH DATA ── */}
            <div class="grid grid-cols-2 gap-3 mb-4">
               <div class="bg-[#141518] border border-[#2a2a2a] p-4 rounded-[24px]">
                  <span class="text-[10px] text-[#8e8e93] font-black uppercase tracking-widest flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">spellcheck</span> Linguistic
                  </span>
                  <div class="flex items-end justify-between mt-3">
                    <span class="text-2xl font-black text-white">{report.data?.linguistic_score?.toFixed(0)}<span class="text-xs text-white/30 ml-1">/100</span></span>
                  </div>
                  <div class="flex flex-wrap gap-1 mt-3">
                    <span class="bg-[#1c1c1c] text-[#8e8e93] text-[9px] font-bold px-2 py-1 rounded-md uppercase border border-[#2a2a2a]">{report.data?.length} chars</span>
                    <Show when={report.data?.is_dictionary_word}>
                      <span class="bg-blue-500/10 text-blue-400 text-[9px] font-bold px-2 py-1 rounded-md uppercase border border-blue-500/20">Dict Word</span>
                    </Show>
                    <Show when={report.data?.contains_numbers}>
                      <span class="bg-orange-500/10 text-orange-400 text-[9px] font-bold px-2 py-1 rounded-md uppercase border border-orange-500/20">Numbers</span>
                    </Show>
                  </div>
               </div>
               
               <div class="bg-[#141518] border border-[#2a2a2a] p-4 rounded-[24px]">
                  <span class="text-[10px] text-[#8e8e93] font-black uppercase tracking-widest flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">public</span> Search Vol
                  </span>
                  <div class="flex items-end justify-between mt-3">
                    <span class="text-2xl font-black text-white">{report.data?.search_popularity}</span>
                  </div>
                  <div class="mt-3">
                    <span class="text-[10px] text-[#8e8e93] font-medium block mb-1">Participants</span>
                    <span class="text-sm font-black text-white">{report.data?.participants_count ? report.data.participants_count.toLocaleString() : 'N/A'}</span>
                  </div>
               </div>
            </div>

            {/* ── MARKET & OWNERSHIP ── */}
            <div class="bg-[#141518] border border-[#2a2a2a] p-5 rounded-[24px] mb-4 space-y-4">
              <h3 class="text-[#8e8e93] text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px]">account_balance_wallet</span> Blockchain & Market
              </h3>
              
              <div class="grid grid-cols-2 gap-4 border-b border-[#2a2a2a] pb-4">
                <div class="flex flex-col gap-1">
                  <span class="text-[10px] text-[#8e8e93] font-bold uppercase">Market Status</span>
                  <span class="text-sm font-black text-[#ff9500] uppercase">{report.data?.sale_status.replace('_', ' ')}</span>
                </div>
                <Show when={report.data?.mint_date}>
                  <div class="flex flex-col gap-1">
                    <span class="text-[10px] text-[#8e8e93] font-bold uppercase">Mint Date</span>
                    <span class="text-sm font-bold text-white">{new Date(report.data!.mint_date!).toLocaleDateString()}</span>
                  </div>
                </Show>
              </div>
                
              <Show when={report.data?.sale_status !== 'not_for_sale'}>
                <div class="flex items-center justify-between py-2 border-b border-[#2a2a2a]">
                  <span class="text-sm font-bold text-[#8e8e93]">Highest Bid</span>
                  <div class="text-right">
                    <span class="text-sm font-black text-white">{report.data?.highest_bid || 0} TON</span>
                    <Show when={usdValue(report.data?.highest_bid)}>
                      <span class="text-[10px] text-[#8e8e93] font-bold block">~${usdValue(report.data?.highest_bid)}</span>
                    </Show>
                  </div>
                </div>
                <div class="flex items-center justify-between py-2 border-b border-[#2a2a2a]">
                  <span class="text-sm font-bold text-[#8e8e93]">Buy Now</span>
                  <div class="text-right">
                    <span class="text-sm font-black text-white">{report.data?.buy_now_price || 'N/A'} TON</span>
                    <Show when={usdValue(report.data?.buy_now_price)}>
                      <span class="text-[10px] text-[#8e8e93] font-bold block">~${usdValue(report.data?.buy_now_price)}</span>
                    </Show>
                  </div>
                </div>
                <Show when={report.data?.end_time}>
                  <div class="flex items-center justify-between py-2 border-b border-[#2a2a2a]">
                    <span class="text-sm font-bold text-[#8e8e93]">Auction Ends</span>
                    <span class="text-sm font-bold text-[#ff3b30]">{new Date(report.data!.end_time!).toLocaleString()}</span>
                  </div>
                </Show>
              </Show>

              <Show when={report.data?.owner_address}>
                <div class="py-2">
                  <span class="text-[11px] font-bold text-[#8e8e93] mb-1.5 block uppercase tracking-wider">Owner Address</span>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-mono font-medium text-[#3390ec] break-all bg-[#3390ec]/10 px-3 py-2 rounded-xl border border-[#3390ec]/20">
                      {report.data?.owner_address}
                    </span>
                  </div>
                </div>
                
                <Show when={report.data?.owner_wallet_balance !== undefined}>
                  <div class="flex items-center justify-between py-3 mt-2 bg-[#1c1c1c] rounded-xl px-4 border border-[#2a2a2a]">
                    <span class="text-[11px] font-black text-[#8e8e93] uppercase tracking-wider flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-[14px]">water</span> Whale Status
                    </span>
                    <div class="text-right">
                      <div class="text-sm font-black text-white">{report.data?.owner_wallet_balance?.toFixed(2)} TON</div>
                      <Show when={usdValue(report.data?.owner_wallet_balance)}>
                        <div class="text-[10px] text-[#8e8e93] font-bold">~${usdValue(report.data?.owner_wallet_balance)}</div>
                      </Show>
                      <div class="text-[10px] font-bold text-[#8e8e93] mt-0.5">{report.data?.owner_other_assets} other NFTs</div>
                    </div>
                  </div>
                </Show>
              </Show>

              {/* Past Sales (If any) */}
              <Show when={paidSales().length > 0}>
                <div class="pt-2">
                  <span class="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-2 block">Price History</span>
                  <div class="bg-[#1c1c1c] rounded-2xl border border-[#2a2a2a] p-3 mb-3">
                    <svg viewBox="0 0 320 128" class="w-full h-32" role="img" aria-label="Username price history chart">
                      <line x1="16" y1="112" x2="304" y2="112" stroke="#2a2a2a" stroke-width="2" />
                      <line x1="16" y1="24" x2="16" y2="112" stroke="#2a2a2a" stroke-width="2" />
                      <polyline points={chartPoints()} fill="none" stroke="#3390ec" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
                      <For each={paidSales()}>
                        {(sale, index) => {
                          const sales = paidSales();
                          const prices = sales.map((item) => item.price);
                          const min = Math.min(...prices);
                          const max = Math.max(...prices);
                          const span = max - min || 1;
                          const x = sales.length === 1 ? 160 : 16 + (index() / (sales.length - 1)) * 288;
                          const y = 112 - ((sale.price - min) / span) * 88;
                          return <circle cx={x} cy={y} r="4" fill="#34c759" stroke="#0a0b0e" stroke-width="2" />;
                        }}
                      </For>
                    </svg>
                    <div class="flex justify-between text-[10px] text-[#8e8e93] font-bold px-1">
                      <span>{new Date(paidSales()[0].date).toLocaleDateString()}</span>
                      <span>{paidSales()[paidSales().length - 1].price} TON</span>
                    </div>
                  </div>
                  <div class="space-y-2">
                    <For each={paidSales()}>
                      {(sale) => (
                        <div class="flex items-center justify-between bg-[#1c1c1c] p-2.5 rounded-lg border border-[#2a2a2a]">
                          <span class="text-xs text-white/60">{new Date(sale.date).toLocaleDateString()}</span>
                          <span class="text-xs font-black text-white">{sale.price} TON</span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </div>

            {/* ── ACTION BUTTONS ── */}
            <div class="mt-8 space-y-3">
               <button 
                 onClick={openFragment}
                 class="w-full bg-[#3390ec] active:scale-95 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-[0_4px_20px_rgba(51,144,236,0.3)]"
                 aria-label="Open username in Fragment market"
               >
                 <span class="material-symbols-outlined text-[20px]">shopping_cart</span>
                 Open in Fragment
               </button>
               <button 
                  onClick={handleShare}
                  class="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white font-black py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-[#2a2a2a]"
                  aria-label="Share this report"
               >
                 <span class="material-symbols-outlined text-[20px]">ios_share</span>
                 Share Intelligence Report
               </button>
            </div>
            
            <p class="text-center text-[#8e8e93] text-[10px] mt-6 font-medium tracking-wide">
              Data generated at {new Date(report.data!.generated_at).toLocaleString()}
            </p>
          </Motion.div>
        </Show>
      </Show>
    </div>
  );
};
