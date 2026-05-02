import { Component, createEffect, onCleanup } from 'solid-js';
import { Motion } from '@motionone/solid';
import { backButton, viewport } from '@tma.js/sdk-solid';
import { useNavigate } from '@solidjs/router';
import { useCollectionStats } from '@/entities/username/api';
import { useI18n } from '@/shared/i18n/I18nContext';

export const CollectionStatsPage: Component = () => {
  const navigate = useNavigate();
  const stats = useCollectionStats();
  const { t } = useI18n();

  createEffect(() => {
    backButton.show();
    const unsubscribe = backButton.onClick(() => navigate(-1));
    onCleanup(() => {
      unsubscribe();
      backButton.hide();
    });
  });

  return (
    <div class="min-h-screen bg-[#0f1014] text-white p-6 pb-24">
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <header class="mb-8">
          <h1 class="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            {t('action.username.collection_stats_title') || 'Collection Insights'}
          </h1>
          <p class="text-gray-400 mt-2">
            {t('action.username.collection_stats_subtitle') || 'Real-time data from Fragment and TON blockchain.'}
          </p>
        </header>

        <div class="grid grid-cols-2 gap-4">
          {/* Total Supply */}
          <div class="bg-[#1c1c1c] border border-[#2a2a2a] p-5 rounded-3xl shadow-xl">
            <span class="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Supply</span>
            <div class="text-2xl font-bold mt-1">
              {stats.isLoading ? '...' : (stats.data?.total_supply?.toLocaleString() || 'N/A')}
            </div>
          </div>

          {/* Holders */}
          <div class="bg-[#1c1c1c] border border-[#2a2a2a] p-5 rounded-3xl shadow-xl">
            <span class="text-xs text-gray-500 uppercase tracking-wider font-semibold">Holders</span>
            <div class="text-2xl font-bold mt-1">
              {stats.isLoading ? '...' : (stats.data?.holders?.toLocaleString() || 'N/A')}
            </div>
          </div>

          {/* Floor Price */}
          <div class="bg-[#1c1c1c] border border-[#2a2a2a] p-5 rounded-3xl shadow-xl col-span-2">
            <div class="flex justify-between items-center">
              <div>
                <span class="text-xs text-gray-500 uppercase tracking-wider font-semibold">Floor Price</span>
                <div class="text-3xl font-black mt-1 text-cyan-400">
                  {stats.isLoading ? '...' : (stats.data?.floor_price ? `${(parseInt(stats.data.floor_price) / 1e9).toFixed(2)} TON` : 'N/A')}
                </div>
              </div>
              <div class="w-12 h-12 bg-cyan-400/10 rounded-full flex items-center justify-center text-cyan-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
            </div>
          </div>

          {/* Volume */}
          <div class="bg-[#1c1c1c] border border-[#2a2a2a] p-5 rounded-3xl shadow-xl col-span-2">
            <span class="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Volume</span>
            <div class="text-xl font-bold mt-1">
               {stats.isLoading ? '...' : (stats.data?.total_volume ? `${(parseInt(stats.data.total_volume) / 1e9).toFixed(0)} TON` : 'N/A')}
            </div>
          </div>
        </div>

        <div class="mt-8 p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl">
           <h3 class="font-bold text-blue-400 flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
             Market Analysis
           </h3>
           <p class="text-sm text-gray-400 mt-2 leading-relaxed">
             The Telegram Usernames collection is one of the most active NFT collections on TON. 
             Prices fluctuate based on demand for short, meaningful, and premium handles.
           </p>
        </div>
      </Motion.div>
    </div>
  );
};
