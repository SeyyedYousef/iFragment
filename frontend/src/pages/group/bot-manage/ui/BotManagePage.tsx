import { Component, createSignal, createResource, onCleanup, onMount, For, Show } from 'solid-js';
import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, openTelegramLink, hapticFeedback } from '@tma.js/sdk-solid';
import { t, isRtl } from '@/shared/i18n/index.js';
import { botApi, subscriptionApi, frgApi } from '@/shared/api/bot-management.js';
import type { ManagedGroup, SubscriptionPackage } from '@/shared/api/bot-management.js';
import { channelApi } from '@/shared/api/channel-management.js';

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

  const [channels] = createResource(
    () => botId,
    (id) => channelApi.getUserChannels(id)
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
    <div class={`min-h-screen bg-[#0f1014] pb-32 relative text-white overflow-x-hidden ${isRtl() ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div class="pt-8 pb-6 px-6 sticky top-0 bg-[#0f1014]/90 backdrop-blur-xl z-30 border-b border-[#1c1c1c] flex items-center justify-between">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
             <h1 class="text-2xl font-black text-white tracking-tight">{t('botManage.title')}</h1>
             <div class="w-2 h-2 rounded-full bg-[#34c759] shadow-[0_0_8px_rgba(52,199,89,0.4)]" />
          </div>
          <Show when={bot()}>
            <div class="flex items-center gap-1.5">
              <span class="text-[13px] font-bold text-[#3390ec]">@{bot()?.bot_username}</span>
              <span class="w-1 h-1 rounded-full bg-[#3a3a3c]" />
              <span class="text-[12px] font-medium text-[#8e8e93]">ID: {bot()?.id.slice(0, 8)}</span>
            </div>
          </Show>
        </div>

        <button 
          onClick={() => { hapticFeedback.impactOccurred('light'); navigate('/managed-bots'); }}
          class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] transition-all active:scale-90"
        >
          <span class="material-symbols-outlined text-white text-[20px]">close</span>
        </button>
      </div>

      <div class="p-5 flex flex-col gap-8 max-w-md mx-auto">
        <Show when={bot()}>
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

          {/* Bot Stats Cards */}
          <div class="grid grid-cols-2 gap-3">
             <div class="bg-[#1c1c1c] rounded-[1.75rem] border border-[#2a2a2a] p-4 flex flex-col gap-1">
                <span class="text-[11px] font-black text-[#8e8e93] uppercase tracking-wider">{t('botManage.managedGroups')}</span>
                <span class="text-2xl font-black text-white">{bot()?.managed_groups_count || 0}</span>
             </div>
             <div class="bg-[#1c1c1c] rounded-[1.75rem] border border-[#2a2a2a] p-4 flex flex-col gap-1">
                <span class="text-[11px] font-black text-[#8e8e93] uppercase tracking-wider">Subscription</span>
                <span class={`text-[15px] font-black uppercase ${bot()?.subscription_status === 'pro' ? 'text-[#ff9f0a]' : 'text-[#8e8e93]'}`}>
                  {bot()?.subscription_status || 'Free'}
                </span>
             </div>
          </div>

          {/* Setup Bot Card */}
          <Motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            class="bg-[#1c1c1c] rounded-[2rem] border border-[#2a2a2a] overflow-hidden"
          >
            <div class="p-6 flex flex-col gap-5">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-[#3390ec]/10 flex items-center justify-center border border-[#3390ec]/20">
                  <span class="material-symbols-outlined text-[#3390ec] text-[28px]">rocket_launch</span>
                </div>
                <div class="flex flex-col">
                  <h3 class="text-lg font-black text-white leading-tight">{t('botManage.setupTitle')}</h3>
                  <p class="text-[12px] font-medium text-[#8e8e93]">{t('botManage.setupSubtitle')}</p>
                </div>
              </div>

              <div class="space-y-4">
                <div class="flex items-start gap-3">
                  <div class="w-6 h-6 rounded-full bg-[#2c2c2e] text-white text-[12px] font-black flex items-center justify-center shrink-0">1</div>
                  <p class="text-[13px] text-[#8e8e93] leading-relaxed">
                    <span class="text-white font-bold">{t('botManage.step1Title')}</span>: {t('botManage.step1Desc')}
                  </p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="w-6 h-6 rounded-full bg-[#2c2c2e] text-white text-[12px] font-black flex items-center justify-center shrink-0">2</div>
                  <p class="text-[13px] text-[#8e8e93] leading-relaxed">
                    <span class="text-white font-bold">{t('botManage.step2Title')}</span>: {t('botManage.step2Desc')}
                  </p>
                </div>
              </div>

              <button 
                onClick={handleInvite}
                class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7bc9] text-white rounded-2xl font-black text-[16px] shadow-[0_15px_35px_rgba(51,144,236,0.25)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span class="material-symbols-outlined">person_add</span>
                {t('botManage.inviteBtn')}
              </button>
            </div>
          </Motion.div>

          {/* Connected Groups Section */}
          <div class="flex flex-col gap-4">
            <h2 class="text-xl font-black text-white px-2 flex items-center gap-3">
              <span class="w-1.5 h-6 bg-[#3390ec] rounded-full"></span>
              {t('botManage.connectedGroups')}
            </h2>
            
            <div class="flex flex-col gap-3">


              <Show when={!groups.loading && (!groups() || groups()!.length === 0)}>
                <div class="bg-[#1c1c1c] rounded-[2rem] p-10 border border-[#2a2a2a] flex flex-col items-center justify-center text-center gap-3 shadow-inner">
                  <div class="w-16 h-16 rounded-full bg-[#2c2c2e] flex items-center justify-center border border-[#3a3a3c]">
                    <span class="material-symbols-outlined text-[#3a3a3c] text-[32px]">forum</span>
                  </div>
                  <p class="text-[#8e8e93] text-sm font-bold">{t('botManage.noGroups')}</p>
                </div>
              </Show>

              <For each={groups() || []}>
                {(group: ManagedGroup, i) => {
                   const endDateStr = group.subscription_status === 'trial' ? group.trial_ends_at : group.paid_until;
                   return (
                    <Motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + (i() * 0.08), duration: 0.4 }}
                      class="bg-[#1c1c1c] rounded-[1.75rem] p-4 border border-[#2a2a2a] flex flex-col gap-4 group hover:border-[#3390ec]/30 transition-all shadow-lg active:scale-[0.99]"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4 overflow-hidden">
                          <div class="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-[#3390ec]/10 to-transparent flex items-center justify-center border border-[#3390ec]/20">
                            <span class="text-lg font-black text-[#3390ec]">{group.chat_title.charAt(0)}</span>
                          </div>
                          <div class="flex flex-col overflow-hidden">
                            <h3 class="text-[16px] font-black text-white leading-tight mb-0.5 truncate">{group.chat_title}</h3>
                            <span class="text-[12px] text-[#8e8e93] font-bold">{group.members_count.toLocaleString()} {t('botManage.members')}</span>
                          </div>
                        </div>
                        
                        <div class="flex flex-col items-end shrink-0">
                          <span class={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                            group.subscription_status === 'paid' ? 'text-[#34c759] border-[#34c759]/20 bg-[#34c759]/5' : 
                            group.subscription_status === 'trial' ? 'text-[#ff9f0a] border-[#ff9f0a]/20 bg-[#ff9f0a]/5' : 'text-[#ff3b30] border-[#ff3b30]/20 bg-[#ff3b30]/5'
                          }`}>
                            {group.subscription_status === 'paid' ? 'Active' : group.subscription_status === 'trial' ? 'Trial' : t('botManage.expired' as any) || 'Expired'}
                          </span>
                          <Show when={endDateStr && group.subscription_status !== 'expired'}>
                            <span class="text-[10px] text-[#8e8e93] font-medium mt-1 whitespace-nowrap">{formatTimeRemaining(endDateStr!)}</span>
                          </Show>
                        </div>
                      </div>
                      
                      <div class="flex gap-2 w-full">
                        <Show when={group.subscription_status !== 'expired'}>
                          <button 
                            onClick={() => { hapticFeedback.impactOccurred('light'); navigate(`/group/${group.id}`); }}
                            class="flex-1 h-11 rounded-xl text-[13px] font-black transition-all bg-[#2c2c2e] text-white border border-[#3a3a3c] hover:bg-[#3a3a3c]"
                          >
                            {t('botManage.manage')}
                          </button>
                        </Show>
                        <button 
                          onClick={() => openSubscription(group.id)}
                          class={`flex-1 h-11 rounded-xl text-[13px] font-black transition-all border ${
                            group.subscription_status === 'paid' 
                              ? 'bg-[#1c1c1c] text-[#8e8e93] border-[#2a2a2a] hover:bg-[#2a2a2a]' 
                              : 'bg-[#3390ec] text-white border-transparent shadow-[0_8px_20px_rgba(51,144,236,0.3)] hover:scale-[1.02]'
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

          {/* Connected Channels Section */}
          <div class="flex flex-col gap-4 mt-6">
            <h2 class="text-xl font-black text-white px-2 flex items-center gap-3">
              <span class="w-1.5 h-6 bg-[#32ade6] rounded-full"></span>
              Connected Channels
            </h2>
            
            <div class="flex flex-col gap-3">


              <Show when={!channels.loading && (!channels() || channels()!.length === 0)}>
                <div class="bg-[#1c1c1c] rounded-[2rem] p-10 border border-[#2a2a2a] flex flex-col items-center justify-center text-center gap-3 shadow-inner">
                  <div class="w-16 h-16 rounded-full bg-[#2c2c2e] flex items-center justify-center border border-[#3a3a3c]">
                    <span class="material-symbols-outlined text-[#3a3a3c] text-[32px]">campaign</span>
                  </div>
                  <p class="text-[#8e8e93] text-sm font-bold">No channels connected yet</p>
                </div>
              </Show>

              <For each={channels() || []}>
                {(channel: any, i) => {
                   const endDateStr = channel.subscription_status === 'trial' ? channel.trial_ends_at : channel.paid_until;
                   return (
                    <Motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + (i() * 0.08), duration: 0.4 }}
                      class="bg-[#1c1c1c] rounded-[1.75rem] p-4 border border-[#2a2a2a] flex flex-col gap-4 group hover:border-[#32ade6]/30 transition-all shadow-lg active:scale-[0.99]"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4 overflow-hidden">
                          <div class="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-[#32ade6]/10 to-transparent flex items-center justify-center border border-[#32ade6]/20">
                            <span class="text-lg font-black text-[#32ade6]">{channel.title.charAt(0)}</span>
                          </div>
                          <div class="flex flex-col overflow-hidden">
                            <h3 class="text-[16px] font-black text-white leading-tight mb-0.5 truncate">{channel.title}</h3>
                            <span class="text-[12px] text-[#8e8e93] font-bold">{channel.members} subscribers</span>
                          </div>
                        </div>
                        
                        <div class="flex flex-col items-end shrink-0">
                          <span class={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                            channel.subscription_status === 'paid' ? 'text-[#34c759] border-[#34c759]/20 bg-[#34c759]/5' : 
                            channel.subscription_status === 'trial' ? 'text-[#ff9f0a] border-[#ff9f0a]/20 bg-[#ff9f0a]/5' : 'text-[#ff3b30] border-[#ff3b30]/20 bg-[#ff3b30]/5'
                          }`}>
                            {channel.subscription_status === 'paid' ? 'Active' : channel.subscription_status === 'trial' ? 'Trial' : 'Expired'}
                          </span>
                          <Show when={endDateStr && channel.subscription_status !== 'expired'}>
                            <span class="text-[10px] text-[#8e8e93] font-medium mt-1 whitespace-nowrap">{formatTimeRemaining(endDateStr!)}</span>
                          </Show>
                        </div>
                      </div>
                      
                      <div class="flex gap-2 w-full">
                        <Show when={channel.subscription_status !== 'expired'}>
                          <button 
                            onClick={() => { hapticFeedback.impactOccurred('light'); navigate(`/channel/${channel.id}`); }}
                            class="flex-1 h-11 rounded-xl text-[13px] font-black transition-all bg-[#2c2c2e] text-white border border-[#3a3a3c] hover:bg-[#3a3a3c]"
                          >
                            Manage Channel
                          </button>
                        </Show>
                      </div>
                    </Motion.div>
                   )
                }}
              </For>
            </div>
          </div>
        </Show>
      </div>

      {/* Subscription Bottom Sheet */}
      <Show when={showSubscription()}>
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          class="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSubscription(false); }}
        >
          <Motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.4, easing: [0.32, 0.72, 0, 1] }}
            class="w-full max-h-[85vh] bg-[#1c1c1c] rounded-t-[2.5rem] border-t border-[#2a2a2a] p-6 overflow-y-auto no-scrollbar shadow-2xl"
          >
            {/* Handle */}
            <div class="w-12 h-1.5 bg-[#3a3a3a] rounded-full mx-auto mb-6" />

            {/* FRG Balance Banner */}
            <div class="bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/20 rounded-3xl p-5 flex items-center justify-between mb-6 shadow-inner">
              <div class="flex flex-col">
                <span class="text-[11px] font-black text-[#8e8e93] uppercase tracking-widest mb-1">Your Balance</span>
                <div class="flex items-baseline gap-1.5">
                  <span class="text-3xl font-black text-white">
                    {balance.loading ? '...' : (balance()?.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span class="text-[14px] font-black text-[#3390ec]">FRG</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/marketplace')}
                class="w-12 h-12 rounded-2xl bg-[#3390ec] text-white flex items-center justify-center hover:scale-105 transition-all shadow-[0_8px_15px_rgba(51,144,236,0.3)]"
              >
                <span class="material-symbols-outlined text-[24px]">add</span>
              </button>
            </div>

            <h3 class="text-[20px] font-black text-white mb-2 leading-tight">
              {t('botManage.choosePackage' as any) || 'Choose Subscription'}
            </h3>
            <p class="text-[13px] font-medium text-[#8e8e93] mb-6">Select a premium package for your group</p>

            {/* Package Cards */}
            <div class="space-y-3">
              <For each={packages() || []}>
                {(pkg: SubscriptionPackage) => (
                  <button
                    onClick={() => { setSelectedPkg(pkg.id); hapticFeedback.selectionChanged(); }}
                    class={`w-full rounded-3xl p-5 flex items-center justify-between border-2 transition-all active:scale-[0.98] ${
                      selectedPkg() === pkg.id
                        ? 'border-[#3390ec] bg-[#3390ec]/10 shadow-lg'
                        : 'border-[#2a2a2a] bg-[#242426] hover:border-[#3a3a3a]'
                    }`}
                  >
                    <div class="flex flex-col items-start gap-1">
                      <div class="flex items-center gap-2">
                        <span class={`text-[16px] font-black ${selectedPkg() === pkg.id ? 'text-white' : 'text-white/90'}`}>{pkg.name}</span>
                        <Show when={pkg.discount}>
                          <span class="text-[10px] font-black text-[#34c759] bg-[#34c759]/10 px-2.5 py-1 rounded-full uppercase">
                            -{pkg.discount}
                          </span>
                        </Show>
                      </div>
                      <span class="text-[12px] font-bold text-[#8e8e93]">
                        {pkg.groups_limit} Group Management
                      </span>
                    </div>
                    <div class="flex items-baseline gap-1.5">
                      <span class="text-2xl font-black text-white">{pkg.price_frg}</span>
                      <span class="text-[13px] font-black text-[#3390ec]">FRG</span>
                    </div>
                  </button>
                )}
              </For>
            </div>

            {/* Subscribe Button */}
            <button
              onClick={handleSubscribe}
              disabled={!selectedPkg() || isProcessing()}
              class="w-full h-16 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-[1.5rem] font-black text-[17px] mt-8 transition-all disabled:opacity-40 flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(51,144,236,0.3)] active:scale-95"
            >
              <Show when={!isProcessing()} fallback={<span class="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
                <span class="material-symbols-outlined text-[24px]">shopping_bag</span>
                {t('botManage.buySubscription' as any) || 'Activate Pro'}
              </Show>
            </button>
            <p class="text-[11px] text-[#555] text-center mt-4 font-medium px-6">
              By activating, you agree to our Terms of Service. Payments are processed instantly via FRG balance.
            </p>
          </Motion.div>
        </Motion.div>
      </Show>
    </div>
  );
};
