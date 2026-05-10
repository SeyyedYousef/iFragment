import { Component, createEffect, onCleanup, Show, For } from 'solid-js';
import { Motion } from '@motionone/solid';
import { backButton, openTelegramLink, openLink } from '@tma.js/sdk-solid';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { usePremiumReport } from '@/entities/username/api/index.js';
import { useI18n } from '@/shared/i18n/index.js';

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
  
  const report = usePremiumReport(username);

  createEffect(() => {
    backButton.show();
    const unsubscribe = backButton.onClick(() => navigate(-1));
    onCleanup(() => {
      unsubscribe();
      backButton.hide();
    });
  });

  const handleShare = () => {
    const text = t('pages.premiumReport.shareText' as any)
      .replace('{u}', username())
      .replace('{score}', String(report.data?.rarity_score || 0));
    
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/iFragmentBot/app')}&text=${encodeURIComponent(text)}`;
    openTelegramLink(shareUrl);
  };

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
            <span class="material-symbols-outlined text-[48px] text-red-500 mb-4">error</span>
            <p class="text-white/80 font-bold text-center mb-4">{report.error?.message || 'Error loading report'}</p>
            <button 
              class="px-6 py-3 bg-[#3390ec] hover:bg-[#4da3f5] transition-colors rounded-xl font-black uppercase tracking-wider"
              onClick={() => report.refetch()}
            >
              Retry Connection
            </button>
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
                  <span class="flex items-center gap-1 px-2.5 py-1 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-md text-[10px] font-bold uppercase">
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
                  <span class="text-[10px] font-bold text-[#34c759] mt-1 flex items-center gap-1 bg-[#34c759]/10 px-2 py-0.5 rounded">
                    <span class="material-symbols-outlined text-[12px]">trending_up</span> Strong Asset
                  </span>
                </div>
              </div>
            </div>

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
                  <span class="text-sm font-black text-white">{report.data?.highest_bid || 0} TON</span>
                </div>
                <div class="flex items-center justify-between py-2 border-b border-[#2a2a2a]">
                  <span class="text-sm font-bold text-[#8e8e93]">Buy Now</span>
                  <span class="text-sm font-black text-white">{report.data?.buy_now_price || 'N/A'} TON</span>
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
                      <div class="text-[10px] font-bold text-[#8e8e93] mt-0.5">{report.data?.owner_other_assets} other NFTs</div>
                    </div>
                  </div>
                </Show>
              </Show>

              {/* Past Sales (If any) */}
              <Show when={report.data?.past_sales && report.data.past_sales.length > 0}>
                <div class="pt-2">
                  <span class="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-2 block">Price History</span>
                  <div class="space-y-2">
                    <For each={report.data?.past_sales}>
                      {(sale: any) => (
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
                 onClick={() => openLink(report.data!.fragment_url)}
                 class="w-full bg-[#3390ec] hover:bg-[#4da3f5] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(51,144,236,0.3)]"
               >
                 <span class="material-symbols-outlined text-[20px]">shopping_cart</span>
                 Open in Fragment
               </button>
               <button 
                  onClick={handleShare}
                  class="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white font-black py-4 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 hover:bg-[#2a2a2a]"
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
