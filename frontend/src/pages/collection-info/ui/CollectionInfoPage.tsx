import { Component, For, Show } from 'solid-js';
import { backButton } from '@tma.js/sdk-solid';
import { useNavigate } from '@solidjs/router';
import { t } from '@/shared/i18n/index.js';
import { createQuery } from '@tanstack/solid-query';
import { apiClient as api } from '@/shared/api/axios.js';

interface CollectionStats {
    stat_date: string;
    items_count: string;
    owners_count: string;
    floor_price: string;
    total_volume: string;
}

interface CollectionCategory {
    category_name: string;
    volume: string;
}

interface CollectionAuction {
    item_name: string;
    price: string;
    status: string;
}

interface CollectionData {
    stats: CollectionStats | null;
    categories: CollectionCategory[];
    auctions: CollectionAuction[];
    status?: string;
}

export const CollectionInfoPage: Component = () => {
    const navigate = useNavigate();

    // Setup TMA back button
    backButton.show();
    backButton.onClick(() => {
        navigate(-1);
    });

    const query = createQuery(() => ({
        queryKey: ['collectionStats'],
        queryFn: async () => {
            const { data } = await api.get<CollectionData>('/collection/stats');
            return data;
        },
        staleTime: 5 * 60 * 1000,
    }));

    // Helpers to calculate relative width for categories volume distribution bar
    const parseVolume = (volStr: string): number => {
        const cleaned = volStr.replace(/[^\d.]/g, '');
        const val = parseFloat(cleaned);
        return isNaN(val) ? 0 : val;
    };

    const getMaxVolume = (categories: CollectionCategory[]): number => {
        let max = 0;
        for (const cat of categories) {
            const val = parseVolume(cat.volume);
            if (val > max) max = val;
        }
        return max || 1;
    };

    return (
        <div class="min-h-screen bg-[#0d0e10] flex flex-col p-6 text-white font-sans pb-28 relative overflow-hidden">
            {/* Ambient Background Glow Bulbs */}
            <div class="w-72 h-72 rounded-full bg-[#0098EA]/8 absolute -top-24 -left-24 blur-[100px] pointer-events-none" />
            <div class="w-80 h-80 rounded-full bg-green-500/4 absolute top-1/3 -right-28 blur-[120px] pointer-events-none" />
            <div class="w-96 h-96 rounded-full bg-blue-600/3 absolute -bottom-20 -left-20 blur-[130px] pointer-events-none" />

            <Show when={query.isLoading}>
                <div class="flex flex-col items-center justify-center h-96 relative z-10">
                    <div class="relative w-12 h-12 mb-4">
                        <div class="absolute inset-0 border-4 border-[#0098EA]/20 rounded-full" />
                        <div class="absolute inset-0 border-4 border-t-[#0098EA] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                    </div>
                    <p class="text-white/40 text-sm font-medium tracking-wide animate-pulse">
                        {t('action.loading' as any, { defaultValue: 'Fetching market stats...' })}
                    </p>
                </div>
            </Show>

            <Show when={query.isError}>
                <div class="flex flex-col items-center justify-center h-64 bg-red-500/5 rounded-3xl border border-red-500/10 backdrop-blur-xl p-6 text-center relative z-10 animate-fade-in">
                    <div class="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                        <span class="material-symbols-outlined text-red-400 text-2xl">error</span>
                    </div>
                    <p class="text-red-400 font-semibold mb-1">Failed to load market data</p>
                    <p class="text-xs text-white/40">Please check your connection and try again</p>
                </div>
            </Show>

            <Show when={query.isSuccess && query.data?.status === 'pending'}>
                <div class="flex flex-col items-center justify-center h-64 bg-white/[0.02] rounded-3xl border border-white/[0.08] backdrop-blur-xl p-6 text-center relative z-10">
                    <div class="w-12 h-12 rounded-full bg-[#0098EA]/10 flex items-center justify-center mb-4 animate-pulse">
                        <span class="material-symbols-outlined text-[#0098EA] text-2xl">hourglass_empty</span>
                    </div>
                    <p class="text-white/80 font-medium text-sm mb-1">{t('action.username.collectionPending')}</p>
                </div>
            </Show>

            <Show when={query.isSuccess && query.data?.stats}>
                {/* Header */}
                <div class="flex items-center space-x-4 mb-8 relative z-10">
                    <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0098EA] to-[#00c6ff] flex items-center justify-center shadow-lg shadow-[#0098EA]/15 relative overflow-hidden group">
                        <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <span class="material-symbols-outlined text-2xl text-white">grid_view</span>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold tracking-tight text-white">{t('action.username.label')}</h2>
                        <p class="text-xs text-white/50">{t('action.username.collection_stats_subtitle')}</p>
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div class="grid grid-cols-2 gap-3.5 mb-8 relative z-10">
                    {/* Items */}
                    <div class="backdrop-blur-xl bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] hover:border-white/[0.15] transition-all duration-300 group">
                        <div>
                            <span class="text-[10px] text-white/40 uppercase tracking-widest font-semibold block mb-1">{t('action.username.totalSupply')}</span>
                            <span class="text-lg font-bold group-hover:text-[#0098EA] transition-colors duration-300">{query.data?.stats?.items_count}</span>
                        </div>
                        <div class="w-8 h-1 bg-white/5 rounded-full overflow-hidden mt-3">
                            <div class="bg-[#0098EA] h-full w-2/3" />
                        </div>
                    </div>

                    {/* Owners */}
                    <div class="backdrop-blur-xl bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] hover:border-white/[0.15] transition-all duration-300 group">
                        <div>
                            <span class="text-[10px] text-white/40 uppercase tracking-widest font-semibold block mb-1">{t('action.username.holders')}</span>
                            <span class="text-lg font-bold group-hover:text-[#0098EA] transition-colors duration-300">{query.data?.stats?.owners_count}</span>
                        </div>
                        <div class="w-8 h-1 bg-white/5 rounded-full overflow-hidden mt-3">
                            <div class="bg-green-500 h-full w-1/2" />
                        </div>
                    </div>

                    {/* Floor Price */}
                    <div class="backdrop-blur-xl bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] hover:border-white/[0.15] transition-all duration-300 group relative overflow-hidden">
                        <div class="absolute -right-6 -bottom-6 text-white/[0.01] text-7xl font-bold pointer-events-none group-hover:text-[#0098EA]/5 transition-colors duration-300">TON</div>
                        <div>
                            <span class="text-[10px] text-[#0098EA] uppercase tracking-widest font-bold block mb-1">{t('action.username.floorPrice')}</span>
                            <div class="flex items-baseline space-x-1.5">
                                <span class="text-lg font-bold text-white">{query.data?.stats?.floor_price}</span>
                            </div>
                        </div>
                        <span class="text-[9px] font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md self-start mt-3.5 flex items-center space-x-0.5">
                            <span class="material-symbols-outlined text-[10px] font-bold">arrow_drop_up</span>
                            <span>+3.2%</span>
                        </span>
                    </div>

                    {/* Total Volume */}
                    <div class="backdrop-blur-xl bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between hover:scale-[1.02] hover:border-white/[0.15] transition-all duration-300 group">
                        <div>
                            <span class="text-[10px] text-green-400 uppercase tracking-widest font-bold block mb-1">{t('action.username.totalVolume')}</span>
                            <span class="text-lg font-bold text-white">{query.data?.stats?.total_volume}</span>
                        </div>
                        <span class="text-[9px] font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md self-start mt-3.5 flex items-center space-x-0.5">
                            <span class="material-symbols-outlined text-[10px] font-bold">arrow_drop_up</span>
                            <span>+4.8%</span>
                        </span>
                    </div>
                </div>

                {/* Categories */}
                <Show when={(query.data?.categories?.length ?? 0) > 0}>
                    <div class="mb-8 relative z-10">
                        <h3 class="text-sm font-semibold tracking-wider text-white/50 uppercase mb-4 flex items-center">
                            <span class="material-symbols-outlined text-lg mr-2 text-[#0098EA]">category</span>
                            {t('action.username.topCategories')}
                        </h3>
                        <div class="space-y-3">
                            {(() => {
                                const maxVol = getMaxVolume(query.data?.categories || []);
                                return (
                                    <For each={query.data?.categories}>
                                        {(cat) => {
                                            const pct = `${(parseVolume(cat.volume) / maxVol) * 100}%`;
                                            return (
                                                <div class="backdrop-blur-xl bg-white/[0.015] rounded-2xl p-3.5 border border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.08] transition-all duration-300">
                                                    <div class="flex items-center justify-between mb-2">
                                                        <span class="text-sm font-medium text-white/90">{cat.category_name}</span>
                                                        <span class="text-sm font-bold text-white/70">{cat.volume}</span>
                                                    </div>
                                                    {/* Visual distribution chart progress bar */}
                                                    <div class="w-full bg-white/[0.04] h-1.5 rounded-full overflow-hidden">
                                                        <div 
                                                            class="bg-gradient-to-r from-[#0098EA] to-[#00c6ff] h-full rounded-full transition-all duration-500 ease-out" 
                                                            style={{ width: pct }} 
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </For>
                                );
                            })()}
                        </div>
                    </div>
                </Show>

                {/* Recent Auctions */}
                <Show when={(query.data?.auctions?.length ?? 0) > 0}>
                    <div class="relative z-10">
                        <h3 class="text-sm font-semibold tracking-wider text-white/50 uppercase mb-4 flex items-center">
                            <span class="material-symbols-outlined text-lg mr-2 text-green-400">gavel</span>
                            {t('action.username.topAuctions')}
                        </h3>
                        <div class="space-y-3.5">
                            <For each={query.data?.auctions}>
                                {(auc) => (
                                    <div class="flex items-center justify-between bg-gradient-to-r from-white/[0.01] to-transparent rounded-2xl p-4 border border-white/[0.04] hover:border-white/[0.1] hover:from-white/[0.03] transition-all duration-300 relative overflow-hidden group">
                                        <div class="flex items-center space-x-3.5">
                                            {/* Beautiful Avatar Placeholder with initials */}
                                            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0098EA]/20 to-[#005F9E]/20 flex items-center justify-center font-mono font-bold text-[#0098EA] text-sm group-hover:scale-105 transition-transform duration-300">
                                                {auc.item_name.substring(1, 3).toUpperCase()}
                                            </div>
                                            <div class="flex flex-col">
                                                <span class="font-mono text-sm tracking-wide font-bold text-white/95 group-hover:text-[#0098EA] transition-colors duration-300">{auc.item_name}</span>
                                                <span class="text-[10px] text-white/40 flex items-center mt-0.5">
                                                    <span class="material-symbols-outlined text-[10px] mr-1">history</span>
                                                    <span>Active auction on Fragment</span>
                                                </span>
                                            </div>
                                        </div>
                                        <div class="flex flex-col items-end">
                                            <span class="text-sm font-black text-white">{auc.price}</span>
                                            <span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#0098EA]/10 text-[#0098EA] mt-1.5">
                                                {auc.status === 'Active' ? t('action.username.active') : auc.status}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
};
