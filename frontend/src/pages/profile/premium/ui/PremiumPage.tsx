import { Component, createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createQuery, useQueryClient } from '@tanstack/solid-query';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { initData } from '@tma.js/sdk-solid';
import { t, isRtl, formatNumber } from '@/shared/i18n/index.js';
import { 
  getProfileStats, 
  getCosmetics, 
  purchaseCosmetic, 
  equipCosmetic, 
  setEmojiStatus, 
  createPremiumCheckout 
} from '@/shared/api/profile.js';
import { openInvoice, showAlert } from '@/shared/lib/telegram-native.js';

export const PremiumPage: Component = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = initData.user();
  
  const [activeTab, setActiveTab] = createSignal<'cosmetics' | 'emojis'>('cosmetics');
  const [cosmeticsTab, setCosmeticsTab] = createSignal<'border' | 'skin'>('border');
  const [isPurchasing, setIsPurchasing] = createSignal<string | null>(null);
  const [isEquipping, setIsEquipping] = createSignal<string | null>(null);
  const [isUpgrading, setIsUpgrading] = createSignal(false);

  // Queries
  const statsQuery = createQuery(() => ({
    queryKey: ['profile', 'stats'],
    queryFn: getProfileStats,
    staleTime: 15000,
  }));

  const cosmeticsQuery = createQuery(() => ({
    queryKey: ['profile', 'cosmetics'],
    queryFn: getCosmetics,
    staleTime: 15000,
  }));

  const stats = () => statsQuery.data || null;
  const cosmetics = () => cosmeticsQuery.data || [];
  const frgBalance = () => stats()?.frgBalance ?? 0;
  const isPremium = () => stats()?.isPremium ?? false;

  const emojiList = ['🌟', '👑', '🚀', '⚡', '💎', '🛡️', '📡', '🎯', '🔥', '👾', '🍀', '✨'];

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

  const handleUpgradePremium = async () => {
    if (isUpgrading()) return;
    try {
      hapticFeedback.impactOccurred('medium');
    } catch {}
    
    setIsUpgrading(true);
    try {
      const res = await createPremiumCheckout();
      if (res && res.invoice_link) {
        const status = await openInvoice(res.invoice_link);
        if (status === 'paid') {
          await showAlert(t('premium.success') || 'Congratulations! You are now a Premium user! 🌟');
          queryClient.invalidateQueries({ queryKey: ['profile', 'stats'] });
        } else if (status === 'cancelled') {
          console.log('Payment cancelled by user');
        } else {
          await showAlert(t('premium.failed') || 'Payment failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('Failed to initiate premium checkout:', err);
      await showAlert(t('premium.error') || 'Error setting up payment. Please try again later.');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handlePurchaseCosmetic = async (id: string, cost: number) => {
    if (frgBalance() < cost) {
      await showAlert(t('premium.insufficient_frg') || 'Insufficient FRG balance.');
      return;
    }
    try {
      hapticFeedback.impactOccurred('medium');
    } catch {}
    setIsPurchasing(id);
    try {
      await purchaseCosmetic(id);
      await queryClient.invalidateQueries({ queryKey: ['profile', 'cosmetics'] });
      await queryClient.invalidateQueries({ queryKey: ['profile', 'stats'] });
    } catch (err) {
      console.error('Failed to purchase cosmetic:', err);
    } finally {
      setIsPurchasing(null);
    }
  };

  const handleEquipCosmetic = async (id: string, type: 'border' | 'skin') => {
    try {
      hapticFeedback.impactOccurred('light');
    } catch {}
    setIsEquipping(id);
    try {
      await equipCosmetic(id, type);
      await queryClient.invalidateQueries({ queryKey: ['profile', 'stats'] });
    } catch (err) {
      console.error('Failed to equip cosmetic:', err);
    } finally {
      setIsEquipping(null);
    }
  };

  const handleSetEmoji = async (emoji: string) => {
    if (!isPremium()) return;
    try {
      hapticFeedback.impactOccurred('light');
    } catch {}
    try {
      await setEmojiStatus(emoji);
      await queryClient.invalidateQueries({ queryKey: ['profile', 'stats'] });
    } catch (err) {
      console.error('Failed to set emoji status:', err);
    }
  };

  const activeBorderClass = () => {
    switch (stats()?.equippedBorder) {
      case 'gold_shimmer': return 'border-gold-shimmer';
      case 'cyber_glow': return 'border-cyber-glow';
      case 'rainbow_wave': return 'border-rainbow-wave';
      default: return '';
    }
  };

  const activeSkinClass = () => {
    switch (stats()?.equippedSkin) {
      case 'cosmic_void': return 'bg-cosmic-void';
      case 'neon_matrix': return 'bg-neon-matrix';
      default: return '';
    }
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-32 text-white">
      {/* Premium Hub Header */}
      <div class="relative pt-6 px-6 pb-4 border-b border-[#2a2a2a] bg-[#1c1c1c] flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button 
            onClick={() => {
              try { hapticFeedback.impactOccurred('light'); } catch {}
              navigate('/profile');
            }}
            class="w-8 h-8 rounded-full bg-[#0f1014]/60 border border-[#2a2a2a] flex items-center justify-center"
          >
            <span class={`material-symbols-outlined text-[16px] text-white ${isRtl() ? 'rotate-0' : 'rotate-180'}`}>chevron_right</span>
          </button>
          <span class="text-sm font-black text-white">{t('premium.page_title') || 'Premium & Cosmetics'}</span>
        </div>
        <div class="flex items-center gap-1.5 bg-[#0f1014] px-3 py-1 rounded-full border border-[#2a2a2a]">
          <span class="text-yellow-400 font-bold text-xs">💎 {formatNumber(frgBalance())}</span>
          <span class="text-[9px] text-[#a0a4ad] font-black uppercase">FRG</span>
        </div>
      </div>

      {/* Hero Interactive Previews */}
      <div class={`mx-6 mt-6 p-6 rounded-3xl border border-[#2a2a2a] relative overflow-hidden transition-all duration-300 ${activeSkinClass() || 'bg-[#1c1c1c]'}`}>
        <div class="absolute top-4 start-4 z-10 bg-black/40 px-2 py-0.5 rounded-md text-[8px] font-black uppercase border border-white/10 tracking-widest">
          Live Preview
        </div>
        
        <div class="flex flex-col items-center justify-center text-center relative z-10 pt-4">
          {/* Custom border check */}
          <div class={`w-20 h-20 rounded-full p-[3px] mb-3 relative ${activeBorderClass()}`} style={!activeBorderClass() ? {
            background: isPremium()
              ? 'linear-gradient(135deg, #ffd700, #ff8c00, #ffd700)'
              : 'linear-gradient(135deg, #3390ec, #34c759, #3390ec)',
            animation: 'spin 4s linear infinite',
          } : undefined}>
            <div class="w-full h-full rounded-full bg-[#0f1014] p-[2px]">
              <Show when={user?.photo_url} fallback={
                <div class="w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-[#3390ec] to-[#34c759] text-white font-black text-2xl">
                  {user?.first_name ? user.first_name[0].toUpperCase() : 'U'}
                </div>
              }>
                <img src={user!.photo_url!} alt="Avatar" class="w-full h-full rounded-full object-cover" />
              </Show>
            </div>
            <Show when={isPremium()}>
              <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#ffd700]">
                <span class="material-symbols-outlined text-[10px] text-amber-300" style={{ 'font-variation-settings': '"FILL" 1' }}>star</span>
              </div>
            </Show>
          </div>

          <h2 class="text-white text-base font-black flex items-center gap-1.5 justify-center">
            {user?.first_name} {user?.last_name}
            <Show when={stats()?.emojiStatus}>
              <span class="text-lg animate-bounce">{stats()!.emojiStatus}</span>
            </Show>
            <Show when={isPremium()}>
              <span class="material-symbols-outlined text-[14px] text-amber-300" style={{ 'font-variation-settings': '"FILL" 1' }}>verified</span>
            </Show>
          </h2>
          <span class="text-[10px] text-[#a0a4ad] font-bold mt-0.5">@{user?.username || 'Guest'}</span>
        </div>
      </div>

      {/* Upgrade Call to Action */}
      <Show when={!isPremium()} fallback={
        <div class="mx-6 mt-4 p-4 rounded-3xl bg-gradient-to-r from-amber-400/10 to-orange-500/10 border border-amber-400/20 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-2xl animate-pulse">👑</span>
            <div class="flex flex-col">
              <span class="text-xs font-black text-white">{t('premium.active_title') || 'iFragment Premium Active'}</span>
              <span class="text-[9px] text-[#a0a4ad] font-bold">
                {t('premium.active_until') || 'Enjoy exclusive cosmetics & perks'}
              </span>
            </div>
          </div>
          <span class="px-2 py-0.5 text-[8px] bg-amber-400 text-black font-black rounded uppercase tracking-wider">Premium</span>
        </div>
      }>
        <div class="mx-6 mt-4 p-5 rounded-3xl bg-gradient-to-br from-[#ffd700]/10 via-[#ff8c00]/5 to-transparent border border-[#ffd700]/20 flex flex-col gap-4">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#ffd700]/20 to-[#ff8c00]/20 flex items-center justify-center border border-[#ffd700]/30 shrink-0">
              <span class="material-symbols-outlined text-[22px] text-amber-400" style={{ 'font-variation-settings': '"FILL" 1' }}>verified</span>
            </div>
            <div class="flex flex-col">
              <span class="text-xs font-black text-white">{t('premium.upgrade_title') || 'Unlock iFragment Premium'}</span>
              <span class="text-[10px] text-[#a0a4ad] font-bold mt-1">
                {t('premium.upgrade_desc') || 'Double daily mining rewards, verified badge status, premium avatar borders, and custom animated status icons.'}
              </span>
            </div>
          </div>

          <button
            onClick={handleUpgradePremium}
            disabled={isUpgrading()}
            class="w-full py-3 rounded-2xl bg-gradient-to-r from-[#ffd700] to-[#ff8c00] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-[16px] text-black" style={{ 'font-variation-settings': '"FILL" 1' }}>star</span>
            <span>{isUpgrading() ? (t('premium.upgrading') || 'Upgrading...') : (t('premium.upgrade_btn') || 'Upgrade for 50 Stars / Month')}</span>
          </button>
        </div>
      </Show>

      {/* Main Tabs */}
      <div class="mx-6 mt-6 p-1 bg-[#1c1c1c] rounded-2xl border border-[#2a2a2a] flex">
        <button
          onClick={() => setActiveTab('cosmetics')}
          class={`flex-1 py-2 text-center text-xs font-black rounded-xl transition-all ${activeTab() === 'cosmetics' ? 'bg-[#0f1014] text-white border border-[#2a2a2a]' : 'text-[#a0a4ad] hover:text-white'}`}
        >
          {t('premium.tab_cosmetics') || 'Cosmetics Shop'}
        </button>
        <button
          onClick={() => setActiveTab('emojis')}
          class={`flex-1 py-2 text-center text-xs font-black rounded-xl transition-all ${activeTab() === 'emojis' ? 'bg-[#0f1014] text-white border border-[#2a2a2a]' : 'text-[#a0a4ad] hover:text-white'}`}
        >
          {t('premium.tab_emojis') || 'Emoji Status'}
        </button>
      </div>

      {/* Tab: Cosmetics */}
      <Show when={activeTab() === 'cosmetics'}>
        <div class="flex flex-col gap-4">
          {/* Subtabs for Cosmetics */}
          <div class="mx-6 mt-4 flex gap-2">
            <button
              onClick={() => setCosmeticsTab('border')}
              class={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${cosmeticsTab() === 'border' ? 'bg-[#3390ec]/20 text-[#3390ec] border-[#3390ec]/30' : 'bg-transparent text-[#a0a4ad] border-[#2a2a2a] hover:text-white'}`}
            >
              {t('premium.subtab_borders') || 'Avatar Borders'}
            </button>
            <button
              onClick={() => setCosmeticsTab('skin')}
              class={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${cosmeticsTab() === 'skin' ? 'bg-[#3390ec]/20 text-[#3390ec] border-[#3390ec]/30' : 'bg-transparent text-[#a0a4ad] border-[#2a2a2a] hover:text-white'}`}
            >
              {t('premium.subtab_skins') || 'Profile Skins'}
            </button>
          </div>

          {/* Cosmetics Grid */}
          <div class="mx-6 mt-2 grid grid-cols-1 gap-4">
            <For each={cosmetics().filter(c => c.type === cosmeticsTab())}>
              {(item) => (
                <div class="p-4 rounded-3xl bg-[#1c1c1c] border border-[#2a2a2a] flex items-center justify-between gap-4">
                  <div class="flex items-center gap-3">
                    {/* Visual Preview */}
                    <Show when={item.type === 'border'}>
                      <div class={`w-12 h-12 rounded-full p-[2px] relative flex items-center justify-center shrink-0 ${item.borderClass || ''}`}>
                        <div class="w-full h-full rounded-full bg-[#0f1014] flex items-center justify-center">
                          <span class="text-lg">👤</span>
                        </div>
                      </div>
                    </Show>
                    <Show when={item.type === 'skin'}>
                      <div class={`w-12 h-12 rounded-xl shrink-0 border border-white/10 ${item.skinClass || ''} flex items-center justify-center`}>
                        <span class="text-lg">🎨</span>
                      </div>
                    </Show>

                    <div class="flex flex-col">
                      <span class="text-xs font-black text-white">{item.name}</span>
                      <span class="text-[9px] text-[#a0a4ad] font-bold">
                        {item.type === 'border' ? 'Animated Avatar Border' : 'Premium Profile Skin'}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    {/* Action buttons */}
                    <Show when={item.purchased} fallback={
                      <button
                        onClick={() => handlePurchaseCosmetic(item.id, item.cost)}
                        disabled={isPurchasing() !== null}
                        class="px-3.5 py-2 bg-[#3390ec] hover:bg-[#2b7ec9] text-[10px] font-black text-white rounded-xl uppercase tracking-wider flex items-center gap-1 transition-all disabled:opacity-50"
                      >
                        <span class="font-bold">💎 {formatNumber(item.cost)}</span>
                      </button>
                    }>
                      <Show when={
                        (item.type === 'border' && stats()?.equippedBorder === item.id) ||
                        (item.type === 'skin' && stats()?.equippedSkin === item.id)
                      } fallback={
                        <button
                          onClick={() => handleEquipCosmetic(item.id, item.type)}
                          disabled={isEquipping() !== null}
                          class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-[#2a2a2a] text-[10px] font-black text-white rounded-xl uppercase tracking-wider transition-all"
                        >
                          {isEquipping() === item.id ? 'Equipping...' : 'Equip'}
                        </button>
                      }>
                        <span class="px-4 py-2 bg-[#34c759]/10 border border-[#34c759]/20 text-[10px] font-black text-[#34c759] rounded-xl uppercase tracking-wider">
                          Equipped
                        </span>
                      </Show>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Tab: Emoji Status */}
      <Show when={activeTab() === 'emojis'}>
        <div class="mx-6 mt-6 flex flex-col gap-4 relative">
          {/* Lock Overlay for non-premium */}
          <Show when={!isPremium()}>
            <div class="absolute inset-0 bg-[#0f1014]/80 backdrop-blur-sm z-20 rounded-3xl flex flex-col items-center justify-center text-center p-6 border border-[#2a2a2a]">
              <span class="text-4xl mb-3 animate-pulse">🔒</span>
              <span class="text-sm font-black text-white">{t('premium.locked_emojis_title') || 'Premium Status Required'}</span>
              <span class="text-[10px] text-[#a0a4ad] font-bold mt-1 max-w-[200px]">
                {t('premium.locked_emojis_desc') || 'Unlock custom emoji badge next to your name with iFragment Premium.'}
              </span>
              <button 
                onClick={handleUpgradePremium}
                class="mt-4 px-4 py-2 bg-gradient-to-r from-[#ffd700] to-[#ff8c00] text-black font-black text-[10px] rounded-xl uppercase tracking-wider transition-all"
              >
                {t('premium.unlock_now') || 'Unlock Now'}
              </button>
            </div>
          </Show>

          <div class="p-5 rounded-3xl bg-[#1c1c1c] border border-[#2a2a2a] flex flex-col gap-4">
            <span class="text-xs font-black text-white">{t('premium.choose_emoji') || 'Choose Emoji Badge'}</span>
            
            <div class="grid grid-cols-4 gap-3">
              <For each={emojiList}>
                {(emoji) => (
                  <button
                    onClick={() => handleSetEmoji(emoji)}
                    class={`aspect-square rounded-2xl flex items-center justify-center text-2xl hover:scale-105 active:scale-95 transition-all border ${stats()?.emojiStatus === emoji ? 'bg-amber-400/20 border-amber-400' : 'bg-[#0f1014] border-[#2a2a2a] hover:border-white/20'}`}
                  >
                    {emoji}
                  </button>
                )}
              </For>
            </div>

            <Show when={stats()?.emojiStatus}>
              <button
                onClick={() => handleSetEmoji('')}
                class="w-full py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-[#2a2a2a]"
              >
                Clear Emoji Status
              </button>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};
