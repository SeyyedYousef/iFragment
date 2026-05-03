import { Component, createEffect, onCleanup, Show } from 'solid-js';
import { Motion } from '@motionone/solid';
import { backButton, shareToStory } from '@tma.js/sdk-solid';
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
    if (shareToStory.isAvailable()) {
      shareToStory.share('https://t.me/iFragmentBot/app', {
        text: t('pages.premiumReport.shareText' as any)
          .replace('{u}', username())
          .replace('{score}', String(report.data?.rarity_score || 0))
      });
    }
  };

  return (
    <div class="min-h-screen bg-[#0a0b0e] text-white p-6 pb-32 safe-area-bottom">
      <Show when={!report.isLoading} fallback={<Skeleton />}>
        <Motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div class="text-center mb-10">
            <div class="inline-block px-4 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest mb-4">
              {t('pages.premiumReport.title' as any)}
            </div>
            <h1 class="text-4xl font-black tracking-tight text-white">@{username()}</h1>
            <div class="flex items-center justify-center gap-2 mt-4">
               <span class={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                 report.data?.status === 'available' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
               }`}>
                 {t(`pages.premiumReport.status.${report.data?.status || 'available'}` as any)}
               </span>
            </div>
          </div>

          {/* Rarity Gauge */}
          <div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-[40px] p-8 mb-6 relative overflow-hidden shadow-2xl">
            <div class="absolute top-0 right-0 p-4 opacity-10">
               <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            
            <div class="flex flex-col items-center">
              <div class="relative w-40 h-40 flex items-center justify-center">
                 <svg class="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                   <circle cx="80" cy="80" r="70" stroke="currentColor" stroke-width="12" fill="transparent" class="text-white/5" />
                   <circle cx="80" cy="80" r="70" stroke="currentColor" stroke-width="12" fill="transparent" 
                     class="text-blue-500"
                     stroke-dasharray="440"
                     stroke-dashoffset={440 - (440 * (report.data?.rarity_score || 0)) / 1000}
                     stroke-linecap="round"
                     style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
                   />
                 </svg>
                 <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-4xl font-black text-white">{report.data?.rarity_score}</span>
                    <span class="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">{t('pages.premiumReport.scarcityIndex' as any)}</span>
                 </div>
              </div>
              <p class="text-on-surface-variant text-sm mt-6 text-center max-w-[240px] font-medium">
                {t('pages.premiumReport.rankingDesc' as any).replace('{percent}', String(Math.max(1, 100 - (report.data?.rarity_score || 0) / 30)))}
              </p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div class="grid grid-cols-2 gap-4">
             <div class="bg-[#1c1c1c] border border-[#2a2a2a] p-5 rounded-3xl">
                <span class="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">{t('pages.premiumReport.metrics.length' as any)}</span>
                <div class="text-xl font-bold mt-1 text-white">{username().length}</div>
             </div>
             <div class="bg-[#1c1c1c] border border-[#2a2a2a] p-5 rounded-3xl">
                <span class="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">{t('pages.premiumReport.metrics.format' as any)}</span>
                <div class="text-xl font-bold mt-1 text-white">{report.data?.rarity_score && report.data.rarity_score > 1500 ? 'Ultra Rare' : 'Standard'}</div>
             </div>
             <div class="bg-[#1c1c1c] border border-[#2a2a2a] p-5 rounded-3xl col-span-2">
                <span class="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">{t('pages.premiumReport.metrics.onChain' as any)}</span>
                <div class="flex items-center justify-between mt-2">
                   <span class="text-sm font-medium text-on-surface-variant">{t('pages.premiumReport.metrics.lastAuction' as any)}</span>
                   <span class="text-sm font-black text-white">{report.data?.on_chain.last_price || 'N/A'}</span>
                </div>
                <div class="flex items-center justify-between mt-1">
                   <span class="text-sm font-medium text-on-surface-variant">{t('pages.premiumReport.metrics.holder' as any)}</span>
                   <span class="text-xs font-mono text-blue-400 font-bold">{report.data?.on_chain.owner || 'Fragment'}</span>
                </div>
             </div>
          </div>

          {/* Action Buttons */}
          <div class="mt-10 space-y-4">
             <button class="w-full bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl shadow-white/5 hover:bg-gray-100">
               <span class="material-symbols-outlined text-[20px]">download</span>
               {t('pages.premiumReport.actions.exportPdf' as any)}
             </button>
             <button 
                onClick={handleShare}
                class="w-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-black py-4 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 hover:bg-blue-500/15"
             >
               <span class="material-symbols-outlined text-[20px]">share</span>
               {t('pages.premiumReport.actions.shareStory' as any)}
             </button>
          </div>
        </Motion.div>
      </Show>
    </div>
  );
};

