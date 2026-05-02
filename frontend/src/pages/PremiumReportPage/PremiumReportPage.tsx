import { Component, createEffect, onCleanup, Show } from 'solid-js';
import { Motion } from '@motionone/solid';
import { backButton, invoice, shareToStory } from '@tma.js/sdk-solid';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { usePremiumReport } from '@/entities/username/api/index.js';
import { useI18n } from '@/shared/i18n/index.js';

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
        text: `Intelligence Report for @${username()}\nRarity Score: ${report.data?.rarity_score}/1000`
      });
    }
  };

  return (
    <div class="min-h-screen bg-[#0a0b0e] text-white p-6 pb-32">
      <Show when={!report.isLoading} fallback={<div class="flex items-center justify-center h-[60vh]">{t('common.loading')}</div>}>
        <Motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div class="text-center mb-10">
            <div class="inline-block px-4 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-widest mb-4">
              Premium Intelligence Report
            </div>
            <h1 class="text-4xl font-black tracking-tight">@{username()}</h1>
            <div class="flex items-center justify-center gap-2 mt-4">
               <span class={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                 report.data?.status === 'available' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
               }`}>
                 {report.data?.status}
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
                 <svg class="w-full h-full transform -rotate-90">
                   <circle cx="80" cy="80" r="70" stroke="currentColor" stroke-width="8" fill="transparent" class="text-white/5" />
                   <circle cx="80" cy="80" r="70" stroke="currentColor" stroke-width="8" fill="transparent" 
                     class="text-blue-500"
                     stroke-dasharray={String(440)}
                     stroke-dashoffset={440 - (440 * (report.data?.rarity_score || 0)) / 1000}
                     style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                   />
                 </svg>
                 <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-4xl font-black">{report.data?.rarity_score}</span>
                    <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Scarcity Index</span>
                 </div>
              </div>
              <p class="text-gray-400 text-sm mt-6 text-center max-w-[240px]">
                This handle ranks in the top <span class="text-white font-bold">5%</span> of most desirable Telegram usernames.
              </p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div class="grid grid-cols-2 gap-4">
             <div class="bg-[#1c1c1c] border border-[#2a2a2a] p-5 rounded-3xl">
                <span class="text-[10px] text-gray-500 font-black uppercase tracking-widest">Length</span>
                <div class="text-xl font-bold mt-1">{username().length} Characters</div>
             </div>
             <div class="bg-[#1c1c1c] border border-[#2a2a2a] p-5 rounded-3xl">
                <span class="text-[10px] text-gray-500 font-black uppercase tracking-widest">Format</span>
                <div class="text-xl font-bold mt-1">Alpha-Numeric</div>
             </div>
             <div class="bg-[#1c1c1c] border border-[#2a2a2a] p-5 rounded-3xl col-span-2">
                <span class="text-[10px] text-gray-500 font-black uppercase tracking-widest">On-Chain Evidence</span>
                <div class="flex items-center justify-between mt-2">
                   <span class="text-sm font-medium text-gray-300">Last Auction Value</span>
                   <span class="text-sm font-black text-white">450 TON</span>
                </div>
                <div class="flex items-center justify-between mt-1">
                   <span class="text-sm font-medium text-gray-300">Holder Address</span>
                   <span class="text-xs font-mono text-blue-400">UQAs...X7k2</span>
                </div>
             </div>
          </div>

          {/* Action Buttons */}
          <div class="mt-8 space-y-4">
             <button class="w-full bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
               Export Intelligence PDF
             </button>
             <button 
               onClick={handleShare}
               class="w-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-black py-4 rounded-2xl active:scale-95 transition-transform flex items-center justify-center gap-2"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
               Share to Telegram Story
             </button>
          </div>
        </Motion.div>
      </Show>
    </div>
  );
};
