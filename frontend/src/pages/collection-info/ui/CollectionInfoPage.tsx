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



    return (
        <div class="min-h-screen bg-[#111214] flex flex-col p-6 text-white font-sans pb-24">
            <Show when={query.isLoading}>
                <div class="flex flex-col items-center justify-center h-64">
                    <div class="w-8 h-8 border-2 border-[#0098EA] border-t-transparent rounded-full animate-spin mb-4" />
                    <p class="text-white/50">{t('action.loading' as any, { defaultValue: 'Loading stats...' })}</p>
                </div>
            </Show>

            <Show when={query.isError}>
                <div class="flex flex-col items-center justify-center h-64 bg-red-500/10 rounded-2xl border border-red-500/20">
                    <span class="material-symbols-outlined text-red-400 text-3xl mb-2">error</span>
                    <p class="text-red-400">Failed to load collection data</p>
                </div>
            </Show>

            <Show when={query.isSuccess && query.data?.status === 'pending'}>
                <div class="flex flex-col items-center justify-center h-64 bg-white/5 rounded-2xl border border-white/10">
                    <span class="material-symbols-outlined text-white/50 text-3xl mb-2">hourglass_empty</span>
                    <p class="text-white/50">Data collection is pending. Check back later.</p>
                </div>
            </Show>

            <Show when={query.isSuccess && query.data?.stats}>
                {/* Header */}
                <div class="flex items-center space-x-4 mb-8">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0098EA] to-[#005F9E] flex items-center justify-center shadow-lg shadow-[#0098EA]/20">
                        <span class="material-symbols-outlined text-[32px] text-white">grid_view</span>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-white">Anonymous Numbers</h2>
                        <p class="text-sm text-[#0098EA]">GetGems Collection</p>
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div class="grid grid-cols-2 gap-3 mb-8">
                    <div class="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                        <span class="text-xs text-white/50 uppercase tracking-wider mb-2">Items</span>
                        <span class="text-xl font-semibold">{query.data?.stats?.items_count}</span>
                    </div>
                    <div class="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                        <span class="text-xs text-white/50 uppercase tracking-wider mb-2">Owners</span>
                        <span class="text-xl font-semibold">{query.data?.stats?.owners_count}</span>
                    </div>
                    <div class="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                        <span class="text-xs text-[#0098EA] uppercase tracking-wider mb-2">Floor Price</span>
                        <span class="text-xl font-semibold">{query.data?.stats?.floor_price}</span>
                    </div>
                    <div class="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                        <span class="text-xs text-green-400 uppercase tracking-wider mb-2">Total Volume</span>
                        <span class="text-xl font-semibold">{query.data?.stats?.total_volume}</span>
                    </div>
                </div>

                {/* Categories */}
                <Show when={(query.data?.categories?.length ?? 0) > 0}>
                    <div class="mb-8">
                        <h3 class="text-lg font-semibold mb-4 flex items-center">
                            <span class="material-symbols-outlined mr-2 text-white/70">category</span>
                            Top Categories
                        </h3>
                        <div class="space-y-2">
                            <For each={query.data?.categories}>
                                {(cat) => (
                                    <div class="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/5">
                                        <span class="text-sm text-white/90">{cat.category_name}</span>
                                        <span class="text-sm font-medium text-white/70">{cat.volume}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>

                {/* Recent Auctions */}
                <Show when={(query.data?.auctions?.length ?? 0) > 0}>
                    <div>
                        <h3 class="text-lg font-semibold mb-4 flex items-center">
                            <span class="material-symbols-outlined mr-2 text-white/70">gavel</span>
                            Top Auctions
                        </h3>
                        <div class="space-y-3">
                            <For each={query.data?.auctions}>
                                {(auc) => (
                                    <div class="flex flex-col bg-white/5 rounded-xl p-4 border border-white/5 relative overflow-hidden">
                                        <div class="flex justify-between items-start mb-2">
                                            <span class="font-mono text-sm tracking-widest text-[#0098EA]">{auc.item_name}</span>
                                            <span class="text-xs px-2 py-1 rounded-md bg-white/10 text-white/70">{auc.status}</span>
                                        </div>
                                        <span class="text-lg font-bold">{auc.price}</span>
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
