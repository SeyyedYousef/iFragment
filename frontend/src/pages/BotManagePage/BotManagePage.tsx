import { Component, createSignal, createResource, onCleanup, onMount, For, Show } from 'solid-js';
import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, openTelegramLink, hapticFeedback } from '@tma.js/sdk-solid';
import { t, isRtl } from '@/shared/i18n/index.js';
import { botApi, subscriptionApi, frgApi } from '@/shared/api/bot-management.js';
import type { ManagedGroup, SubscriptionPackage } from '@/shared/api/bot-management.js';

export const BotManagePage: Component = () => {
  const navigate = useNavigate();
  const params = useParams();
  const botId = params.botId;

  const [showSubscription, setShowSubscription] = createSignal(false);
  const [selectedGroup, setSelectedGroup] = createSignal<string>('');
  const [selectedPkg, setSelectedPkg] = createSignal<string>('');
  const [isProcessing, setIsProcessing] = createSignal(false);
  const [successMsg, setSuccessMsg] = createSignal('');
  const [errorMsg, setErrorMsg] = createSignal('');

  const [bot] = createResource(
    () => botId,
    (id) => botApi.getBot(id)
  );

  const [groups, { refetch: refetchGroups }] = createResource(
    () => botId,
    (id) => botApi.listGroups(id)
  );

  const [packages] = createResource(subscriptionApi.getPackages);
  const [balance, { refetch: refetchBalance }] = createResource(frgApi.getBalance);

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      if (showSubscription()) {
        setShowSubscription(false);
      } else {
        navigate('/managed-bots');
      }
    });
    onCleanup(() => off());
  });

  const handleInvite = () => {
    if (!bot()) return;
    const url = `https://t.me/${bot()!.bot_username.replace('@', '')}?startgroup=start&admin=restrict_members+delete_messages+ban_users`;
    try {
      openTelegramLink(url);
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  const openSubscription = (groupId: string) => {
    setSelectedGroup(groupId);
    setShowSubscription(true);
    hapticFeedback.impactOccurred('light');
  };

  const handleSubscribe = async () => {
    if (!selectedPkg() || !selectedGroup()) return;
    setIsProcessing(true);
    setErrorMsg('');
    try {
      await subscriptionApi.subscribe(selectedGroup(), selectedPkg());
      hapticFeedback.notificationOccurred('success');
      setSuccessMsg(t('botManage.subscriptionSuccess' as any) || 'Subscription activated successfully!');
      setShowSubscription(false);
      refetchGroups();
      refetchBalance();
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Payment failed';
      setErrorMsg(msg);
      hapticFeedback.notificationOccurred('error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
    }
  };

  const formatTimeRemaining = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff <= 0) return t('botManage.expired' as any);
    
    const days = Math.floor(diff / (1000 * 3600 * 24));
    const hours = Math.floor((diff % (1000 * 3600 * 24)) / (1000 * 3600));
    
    if (days > 0) return `${days}${t('botManage.daysLeft' as any)} ${hours}${t('botManage.hoursLeft' as any)}`;
    return `${hours}${t('botManage.hoursLeft' as any)}`;
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-20 relative overflow-y-auto no-scrollbar text-white">
      {/* Header */}
      <div class="pt-8 pb-12 px-6 text-center relative z-10">
        <Show when={!bot.loading && bot()}>
          <Motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            class="flex flex-col items-center justify-center mb-2"
          >
            <div class="w-20 h-20 rounded-[20px] bg-[#1c1c1c] flex items-center justify-center mb-4 border border-[#2a2a2a] shadow-inner relative overflow-hidden">
               <div class="absolute inset-0 bg-gradient-to-br from-[#3390ec]/20 to-transparent opacity-50"></div>
               <span class="text-3xl font-bold text-[#3390ec] relative z-10">{bot()!.bot_name.charAt(0)}</span>
            </div>
            <h1 class="text-2xl font-black tracking-tight">{bot()!.bot_name}</h1>
            <p class="text-[#3390ec] mt-1 font-medium text-sm flex items-center justify-center gap-1">
              {bot()!.bot_username}
            </p>
          </Motion.div>
        </Show>
      </div>

      {/* Main Content Area */}
      <Motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, easing: [0.4, 0, 0.2, 1] }}
        class="w-full bg-[#1c1c1c] border-t border-[#2a2a2a] rounded-t-[40px] relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] pt-8 pb-12 px-5 min-h-[60vh] -mt-6"
      >
        <div class="flex flex-col gap-8 max-w-md mx-auto">
          
          {/* Status Messages */}
          <Show when={successMsg()}>
            <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              class="bg-[#34c759]/10 border border-[#34c759]/30 text-[#34c759] rounded-2xl px-4 py-3 flex items-center gap-2 text-[13px] font-bold">
              <span class="material-symbols-outlined text-[18px]">check_circle</span>
              {successMsg()}
            </Motion.div>
          </Show>
          <Show when={errorMsg()}>
            <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              class="bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-[#ff3b30] rounded-2xl px-4 py-3 flex items-center gap-2 text-[13px] font-bold">
              <span class="material-symbols-outlined text-[18px]">error</span>
              {errorMsg()}
            </Motion.div>
          </Show>

          {/* Add to Group Action */}
          <Motion.button 
            onClick={handleInvite}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            class="w-full bg-gradient-to-r from-[#3390ec] to-[#2b7bc9] rounded-3xl p-[1.5px] relative group overflow-hidden shadow-[0_10px_30px_rgba(51,144,236,0.2)] transition-transform active:scale-95"
          >
            <div class="absolute inset-0 bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div class="bg-[#1c1c1c] backdrop-blur-sm rounded-[22px] p-5 flex items-center justify-between relative z-10">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-[#3390ec]/10 flex items-center justify-center border border-[#3390ec]/20">
                  <span class="material-symbols-outlined text-[#3390ec]">group_add</span>
                </div>
                <div>
                  <h3 class="text-lg font-bold text-white">{t('botManage.addToGroup')}</h3>
                  <p class="text-[11px] text-[#8e8e93] font-medium mt-0.5 leading-tight max-w-[200px]">{t('botManage.addToGroupDesc')}</p>
                </div>
              </div>
              <span class={`material-symbols-outlined text-[#8e8e93] ${isRtl() ? '-scale-x-100' : ''}`}>chevron_right</span>
            </div>
          </Motion.button>

          {/* Info Banner for Trial */}
          <div class="bg-[#3390ec]/10 border border-[#3390ec]/20 rounded-2xl p-4 flex items-start gap-3">
            <span class="material-symbols-outlined text-[#3390ec] text-xl shrink-0">info</span>
            <p class="text-xs text-[#8e8e93] leading-relaxed">
              {t('botManage.trialInfo')} <span class="text-white font-bold">{t('botManage.trialFree')}</span>
              {t('botManage.trialSuffix' as any) || '. After the trial, subscribe to keep your bot active.'}
            </p>
          </div>

          {/* Connected Groups */}
          <div class="flex flex-col gap-4">
            <h2 class="text-xl font-bold text-white px-2 flex items-center gap-2">
              <span class="w-1.5 h-5 bg-[#3390ec] rounded-full"></span>
              {t('botManage.connectedGroups')}
            </h2>
            
            <div class="flex flex-col gap-3">
              <Show when={groups.loading}>
                <div class="flex items-center justify-center py-12">
                  <span class="w-6 h-6 border-2 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin" />
                </div>
              </Show>

              <Show when={!groups.loading && (!groups() || groups()!.length === 0)}>
                <div class="bg-[#0f1014] rounded-3xl p-8 border border-[#2a2a2a] flex flex-col items-center justify-center text-center">
                  <span class="material-symbols-outlined text-[#8e8e93] text-4xl mb-3 opacity-50">forum</span>
                  <p class="text-[#8e8e93] text-sm font-medium">{t('botManage.noGroups')}</p>
                </div>
              </Show>

              <For each={groups() || []}>
                {(group: ManagedGroup, i) => {
                   const endDateStr = group.subscription_status === 'trial' ? group.trial_ends_at : group.paid_until;
                   return (
                    <Motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + (i() * 0.1), duration: 0.5 }}
                      class="bg-[#0f1014] rounded-3xl p-4 shadow-inner border border-[#2a2a2a] flex flex-col gap-3 group hover:border-[#3390ec]/50 transition-colors"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3 overflow-hidden">
                          <div class="w-10 h-10 shrink-0 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a]">
                            <span class="text-sm font-bold text-[#3390ec]">{group.chat_title.charAt(0)}</span>
                          </div>
                          <div class="flex flex-col overflow-hidden">
                            <h3 class="text-[14px] font-bold text-white leading-tight mb-0.5 truncate">{group.chat_title}</h3>
                            <span class="text-[11px] text-[#8e8e93] font-medium">{group.members_count} {t('botManage.members')}</span>
                          </div>
                        </div>
                        
                        <div class="flex flex-col items-end shrink-0">
                          <span class={`text-[11px] font-bold uppercase tracking-wider ${
                            group.subscription_status === 'paid' ? 'text-[#34c759]' : 
                            group.subscription_status === 'trial' ? 'text-[#ffcc00]' : 'text-[#ff3b30]'
                          }`}>
                            {group.subscription_status === 'paid' ? 'Active' : group.subscription_status === 'trial' ? 'Trial' : t('botManage.expired' as any) || 'Expired'}
                          </span>
                          <Show when={endDateStr && group.subscription_status !== 'expired'}>
                            <span class="text-[10px] text-[#8e8e93] font-medium mt-0.5 whitespace-nowrap">{formatTimeRemaining(endDateStr!)}</span>
                          </Show>
                        </div>
                      </div>
                      
                      <div class="flex gap-2 w-full mt-1">
                        <Show when={group.subscription_status !== 'expired'}>
                          <button 
                            onClick={() => navigate(`/group/${group.id}`)}
                            class="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-colors border bg-[#1c1c1c] text-white border-[#2a2a2a] hover:bg-[#2a2a2a]"
                          >
                            {t('botManage.manage')}
                          </button>
                        </Show>
                        <button 
                          onClick={() => openSubscription(group.id)}
                          class={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-colors border ${
                            group.subscription_status === 'paid' 
                              ? 'bg-[#1c1c1c] text-white border-[#2a2a2a] hover:bg-[#2a2a2a]' 
                              : 'bg-[#3390ec] text-white border-[#3390ec] shadow-[0_4px_14px_rgba(51,144,236,0.3)] hover:bg-[#2b7bc9]'
                          }`}
                        >
                          {group.subscription_status === 'paid' ? (t('botManage.extendSub' as any) || 'Extend') : (t('botManage.buySubscription' as any) || 'Buy Subscription')}
                        </button>
                      </div>
                    </Motion.div>
                   )
                }}
              </For>
            </div>
          </div>
          
        </div>
      </Motion.div>

      {/* Subscription Bottom Sheet */}
      <Show when={showSubscription()}>
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSubscription(false); }}
        >
          <Motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }}
            class="w-full max-h-[85vh] bg-[#1c1c1c] rounded-t-[2rem] border-t border-[#2a2a2a] p-5 overflow-y-auto"
          >
            {/* Handle */}
            <div class="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />

            {/* FRG Balance */}
            <div class="bg-[#2c2c2e] rounded-2xl p-4 flex items-center justify-between mb-4">
              <div class="flex flex-col">
                <span class="text-[11px] font-bold text-[#8e8e93] uppercase">Your Balance</span>
                <span class="text-[22px] font-black text-white">
                  {balance.loading ? '...' : (balance()?.balance ?? 0).toFixed(2)} <span class="text-[14px] text-[#3390ec]">FRG</span>
                </span>
              </div>
              <button
                onClick={() => navigate('/marketplace')}
                class="bg-[#3390ec] text-white text-[13px] font-bold px-4 py-2.5 rounded-xl hover:bg-[#2b7bc9] transition-colors flex items-center gap-1.5"
              >
                <span class="material-symbols-outlined text-[16px]">add</span>
                Buy FRG
              </button>
            </div>

            <h3 class="text-[18px] font-black text-white mb-1">
              {t('botManage.choosePackage' as any) || 'Choose a Package'}
            </h3>
            <p class="text-[13px] text-[#8e8e93] mb-4">Select subscription for 30 days</p>

            {/* Package Cards */}
            <div class="space-y-3">
              <For each={packages() || []}>
                {(pkg: SubscriptionPackage) => (
                  <button
                    onClick={() => { setSelectedPkg(pkg.id); hapticFeedback.selectionChanged(); }}
                    class={`w-full rounded-2xl p-4 flex items-center justify-between border-2 transition-all ${
                      selectedPkg() === pkg.id
                        ? 'border-[#3390ec] bg-[#3390ec]/5'
                        : 'border-[#2a2a2a] bg-[#2c2c2e] hover:border-[#3a3a3a]'
                    }`}
                  >
                    <div class="flex flex-col items-start gap-0.5">
                      <div class="flex items-center gap-2">
                        <span class="text-[15px] font-bold text-white">{pkg.name}</span>
                        <Show when={pkg.discount}>
                          <span class="text-[10px] font-bold text-[#34c759] bg-[#34c759]/10 px-2 py-0.5 rounded-full">
                            {pkg.discount}
                          </span>
                        </Show>
                      </div>
                      <span class="text-[12px] text-[#8e8e93]">
                        Up to {pkg.groups_limit} group{pkg.groups_limit > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div class="flex items-baseline gap-1">
                      <span class="text-[20px] font-black text-white">{pkg.price_frg}</span>
                      <span class="text-[13px] font-bold text-[#3390ec]">FRG</span>
                      <span class="text-[11px] text-[#8e8e93]">/mo</span>
                    </div>
                  </button>
                )}
              </For>

              {/* Enterprise - Contact Support */}
              <div class="w-full rounded-2xl p-4 border-2 border-dashed border-[#2a2a2a] bg-[#2c2c2e]/50 flex items-center justify-between">
                <div class="flex flex-col gap-0.5">
                  <span class="text-[15px] font-bold text-[#8e8e93]">Enterprise (10+ groups)</span>
                  <span class="text-[12px] text-[#555]">Need more? Let's talk.</span>
                </div>
                <button
                  onClick={() => { (window as any).Telegram?.WebApp?.openTelegramLink?.('https://t.me/iFragmentSupport'); }}
                  class="bg-[#2c2c2e] border border-[#3a3a3a] text-[#8e8e93] text-[12px] font-bold px-3 py-2 rounded-xl hover:bg-[#3a3a3a] transition-colors"
                >
                  Contact Support
                </button>
              </div>
            </div>

            {/* Subscribe Button */}
            <button
              onClick={handleSubscribe}
              disabled={!selectedPkg() || isProcessing()}
              class="w-full h-14 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-2xl font-bold text-[16px] mt-5 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(51,144,236,0.3)]"
            >
              <Show when={!isProcessing()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
                <span class="material-symbols-outlined text-[20px]">shopping_cart</span>
                {t('botManage.buySubscription' as any) || 'Buy Subscription'}
              </Show>
            </button>
          </Motion.div>
        </Motion.div>
      </Show>
    </div>
  );
};
