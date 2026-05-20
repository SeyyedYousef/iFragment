import { Component, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { getBoostsStatus, upgradeBoost, getProfileStats } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';

export const BoostsPage: Component = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = createSignal<{ text: string; error: boolean } | null>(null);

  const boostsQuery = createQuery(() => ({
    queryKey: ['profile', 'boosts'],
    queryFn: getBoostsStatus,
  }));

  const statsQuery = createQuery(() => ({
    queryKey: ['profile', 'stats'],
    queryFn: getProfileStats,
  }));

  const boosts = () => boostsQuery.data || [];
  const myStats = () => statsQuery.data || null;
  const loading = () => boostsQuery.isLoading || statsQuery.isLoading;

  const upgradeMutation = createMutation(() => ({
    mutationFn: ({ type }: { type: string }) => upgradeBoost(type),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'boosts'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'stats'] });
      try { hapticFeedback.notificationOccurred('success'); } catch {}
      const boost = boostsQuery.data?.find(b => b.type === variables.type);
      setMessage({ text: `Congratulations! Upgraded ${boost?.title || variables.type} successfully.`, error: false });
    },
    onError: (err: any) => {
      try { hapticFeedback.notificationOccurred('error'); } catch {}
      setMessage({ text: err.message || 'Upgrade failed. Please try again.', error: true });
    }
  }));

  onMount(() => {
    try {
      backButton.show();
      const off = backButton.onClick(() => {
        try { hapticFeedback.impactOccurred('light'); } catch {}
        navigate('/profile');
      });
      onCleanup(() => {
        off();
        try { backButton.hide(); } catch {}
      });
    } catch {}
  });

  const handleUpgrade = async (type: string, price: number) => {
    const statsVal = myStats();
    if (statsVal && statsVal.frgBalance < price) {
      try { hapticFeedback.notificationOccurred('error'); } catch {}
      setMessage({ text: `Insufficient FRG balance! You need ${price.toLocaleString()} FRG to buy this upgrade.`, error: true });
      return;
    }

    setMessage(null);
    try {
      try { hapticFeedback.impactOccurred('heavy'); } catch {}
      upgradeMutation.mutate({ type });
    } catch (e: any) {
      console.error(e);
    }
  };

  const getBoostIcon = (type: string) => {
    if (type === 'multitap') return 'ads_click';
    if (type === 'energy_limit') return 'battery_charging_full';
    return 'smart_toy'; // tap_bot
  };

  const getBoostDescription = (type: string) => {
    if (type === 'multitap') return 'Increase tap power (+1 tap per level)';
    if (type === 'energy_limit') return 'Increase max tap energy limit (+500 energy)';
    return 'Claims coins while offline for up to 12 hours';
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-32 text-white font-sans">
      {/* Header */}
      <div class="relative bg-gradient-to-b from-[#1a1b23] to-[#0f1014] pt-12 pb-8 px-6 text-center border-b border-[#222]">
        <div class="absolute top-4 left-6 flex items-center gap-2">
          <button 
            onClick={() => {
              try { hapticFeedback.impactOccurred('light'); } catch {}
              navigate('/profile');
            }} 
            class="flex items-center justify-center w-8 h-8 rounded-full bg-[#1c1c1c] border border-[#2a2a2a]"
          >
            <span class="material-symbols-outlined text-[16px] text-white">arrow_back</span>
          </button>
        </div>

        <h1 class="text-2xl font-black tracking-tight text-white mb-1">Boost & Upgrades</h1>
        <p class="text-xs text-[#a0a4ad]">Purchase boosters using your earned FRG tokens</p>
      </div>

      <div class="px-6 py-6 flex flex-col gap-5">
        {/* Balance card */}
        <div class="bg-gradient-to-r from-[#1c1c24] to-[#15161d] border border-[#2a2a2a] rounded-3xl p-5 flex items-center justify-between">
          <div class="flex flex-col gap-1">
            <span class="text-[10px] text-[#a0a4ad] font-black uppercase tracking-wider">Your FRG Balance</span>
            <span class="text-xl font-black text-[#3390ec]">{myStats()?.frgBalance.toLocaleString() || '0'} <span class="text-[10px] text-white font-bold tracking-widest uppercase">FRG</span></span>
          </div>
          <div class="w-10 h-10 rounded-2xl bg-[#3390ec]/10 border border-[#3390ec]/20 flex items-center justify-center text-[#3390ec]">
            <span class="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          </div>
        </div>

        {/* Status Toast */}
        <Show when={message()}>
          <div 
            class={`border rounded-2xl p-4 text-xs font-bold ${
              message()?.error ? 'bg-[#ff3b30]/10 border-[#ff3b30]/30 text-[#ff3b30]' : 'bg-[#34c759]/10 border-[#34c759]/30 text-[#34c759]'
            }`}
          >
            {message()?.text}
          </div>
        </Show>

        {loading() ? (
          <div class="flex flex-col items-center justify-center py-20 gap-4">
            <div class="w-10 h-10 rounded-full border-4 border-[#3390ec]/20 border-t-[#3390ec] animate-spin" />
            <span class="text-[10px] text-[#a0a4ad] font-bold uppercase tracking-wider">Loading Upgrades...</span>
          </div>
        ) : (
          <div class="flex flex-col gap-4">
            <For each={boosts()}>
              {(boost) => (
                <div class="flex flex-col border rounded-3xl p-5 bg-[#15161d]/60 border-[#222]/80 gap-3">
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-2xl bg-[#3390ec]/10 border border-[#3390ec]/20 flex items-center justify-center text-[#3390ec]">
                        <span class="material-symbols-outlined text-[20px]">{getBoostIcon(boost.type)}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-xs font-black text-white">{boost.title}</span>
                        <span class="text-[10px] text-[#a0a4ad] font-semibold">Level {boost.current_level}</span>
                      </div>
                    </div>

                    <Show when={!boost.max_level}>
                      <button
                        onClick={() => handleUpgrade(boost.type, boost.price_frg)}
                        disabled={upgradeMutation.isPending && upgradeMutation.variables?.type === boost.type}
                        class="px-4 py-2 bg-[#3390ec] active:scale-95 disabled:opacity-50 text-[10px] font-black text-white rounded-xl uppercase tracking-wider transition-all"
                      >
                        {upgradeMutation.isPending && upgradeMutation.variables?.type === boost.type ? 'Upgrading...' : 'Upgrade'}
                      </button>
                    </Show>
                  </div>

                  <p class="text-[11px] text-[#a0a4ad]">{getBoostDescription(boost.type)}</p>

                  <div class="h-[1px] bg-[#222] w-full my-1" />

                  <div class="flex items-center justify-between">
                    <span class="text-[9px] text-[#a0a4ad] font-bold uppercase tracking-wider">Upgrade Cost</span>
                    <Show 
                      when={boost.max_level}
                      fallback={
                        <span class="text-xs font-black text-white">{boost.price_frg.toLocaleString()} FRG</span>
                      }
                    >
                      <span class="text-[10px] font-black text-[#34c759] uppercase tracking-wider">MAX LEVEL</span>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        )}
      </div>
    </div>
  );
};
