import { Component, createSignal, createResource, createMemo, createEffect, onCleanup, onMount, Show, For } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { SelectField, SettingsSection } from '@/shared/ui/settings-controls.js';
import { channelApi } from '@/shared/api/channel-management.js';
import { showToast } from '@/shared/ui/toast.js';

interface ContentTypes {
  text: boolean;
  photos: boolean;
  videos: boolean;
  files: boolean;
  voice: boolean;
}

interface ForwardRule {
  id: string;
  direction: 'inbound' | 'outbound';
  targetType: 'telegram' | 'webhook';
  target: string;
  mode: string;
  active: boolean;
}

export const ChannelForwardingPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [isCreating, setIsCreating] = createSignal(false);
  
  // Rule Form State
  const [direction, setDirection] = createSignal<'inbound' | 'outbound'>('outbound');
  const [targetType, setTargetType] = createSignal<'telegram' | 'webhook'>('telegram');
  const [targetChat, setTargetChat] = createSignal('');
  const [isVerified, setIsVerified] = createSignal<boolean | null>(null);
  const [mode, setMode] = createSignal('forward');
  
  const [contentTypes, setContentTypes] = createSignal<ContentTypes>({
    text: true, photos: true, videos: true, files: true, voice: true
  });
  
  // Advanced Options State
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [removeAds, setRemoveAds] = createSignal(false);
  const [removeHashtags, setRemoveHashtags] = createSignal(false);
  const [removeLinks, setRemoveLinks] = createSignal(false);
  const [watermark, setWatermark] = createSignal('');
  const [delay, setDelay] = createSignal('');
  
  const [rules, setRules] = createSignal<ForwardRule[]>([]);

  const [isSaving, setIsSaving] = createSignal(false);

  const [settings] = createResource(
    () => params.id,
    (id) => channelApi.getSettings(id)
  );

  const [rulesData, { refetch: refetchRules }] = createResource(
    () => params.id,
    (id) => channelApi.getForwardingRules(id)
  );

  createEffect(() => {
    const list = rulesData();
    if (list) {
      setRules(list.map((r: any) => ({
        id: r.id || '',
        direction: r.direction,
        targetType: r.target_type,
        target: r.target,
        mode: r.mode,
        active: r.is_active
      })));
    }
  });

  createEffect(() => {
    const data = settings();
    if (data) {
      try {
        let fwd = data.forwarding;
        if (typeof fwd === 'string') {
          fwd = JSON.parse(fwd);
        }
        if (fwd && typeof fwd === 'object') {
          if ('contentTypes' in fwd) setContentTypes(fwd.contentTypes);
          if ('removeAds' in fwd) setRemoveAds(fwd.removeAds);
          if ('removeHashtags' in fwd) setRemoveHashtags(fwd.removeHashtags);
          if ('removeLinks' in fwd) setRemoveLinks(fwd.removeLinks);
          if ('watermark' in fwd) setWatermark(fwd.watermark);
          if ('delay' in fwd) setDelay(fwd.delay);
        }
      } catch (e) {
        console.error("Failed to parse forwarding settings:", e);
      }
    }
  });

  const isDirty = createMemo(() => {
    const data = settings();
    if (!data) return false;

    let originalFwd: any = {};
    try {
      originalFwd = typeof data.forwarding === 'string' ? JSON.parse(data.forwarding) : data.forwarding;
    } catch (e) { originalFwd = {}; }

    const currentPayload = {
      contentTypes: contentTypes(),
      removeAds: removeAds(),
      removeHashtags: removeHashtags(),
      removeLinks: removeLinks(),
      watermark: watermark(),
      delay: delay(),
    };

    return JSON.stringify(currentPayload) !== JSON.stringify({
      contentTypes: originalFwd?.contentTypes || { text: true, photos: true, videos: true, files: true, voice: true },
      removeAds: !!originalFwd?.removeAds,
      removeHashtags: !!originalFwd?.removeHashtags,
      removeLinks: !!originalFwd?.removeLinks,
      watermark: originalFwd?.watermark || '',
      delay: originalFwd?.delay || '',
    });
  });

  const handleSave = async () => {
    hapticFeedback.notificationOccurred('success');
    setIsSaving(true);
    
    const currentVersion = settings()?.version ?? 1;
    const payload = {
      contentTypes: contentTypes(),
      removeAds: removeAds(),
      removeHashtags: removeHashtags(),
      removeLinks: removeLinks(),
      watermark: watermark(),
      delay: delay(),
    };

    try {
      await channelApi.updateSettings(params.id, 'forwarding', payload, currentVersion);
      navigate(`/channel/${params.id}`);
    } catch (e: any) {
      console.error("Failed to save forwarding settings:", e);
      if (e?.status === 409) {
        showToast(t('common.errorVersionMismatch') || 'Settings have been updated by another administrator. Please try again.', 'error');
      } else {
        showToast(t('channelPosting.failedToSaveSettings') || 'Failed to save forwarding settings', 'error');
      }
      navigate(`/channel/${params.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Mock Forward Log
  const forwardLog = () => [
    { id: 1, text: t('channelForwarding.logCopied').replace('{id}', '402').replace('{target}', '@backup_ch'), time: '10:42 AM', status: 'success' },
    { id: 2, text: t('channelForwarding.logReceived'), time: 'Yesterday', status: 'success' },
  ];

  const getLocalizedMode = (mode: string) => {
    if (mode === 'forward') return t('channelForwarding.modeForwardLabel') || 'Forward';
    if (mode === 'copy') return t('channelForwarding.modeCopyLabel') || 'Copy';
    if (mode === 'ai') return t('channelForwarding.modeCopyAiLabel') || 'AI Rewrite';
    return mode;
  };

  const getLocalizedDirection = (direction: string) => {
    if (direction === 'inbound') return t('channelForwarding.inbound') || 'Inbound';
    if (direction === 'outbound') return t('channelForwarding.outbound') || 'Outbound';
    return direction;
  };

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      if (isCreating()) {
        setIsCreating(false);
      } else {
        navigate(`/channel/${params.id}`);
      }
    });
    onCleanup(() => off());
  });

  const handleVerify = () => {
    if (!targetChat().trim()) return;
    hapticFeedback.impactOccurred('medium');
    setIsVerified(null);
    setTimeout(() => {
      // Mock verify
      if (targetChat().length > 3) {
        setIsVerified(true);
        hapticFeedback.notificationOccurred('success');
      } else {
        setIsVerified(false);
        hapticFeedback.notificationOccurred('error');
      }
    }, 800);
  };

  const handleSaveRule = async () => {
    let finalTarget = targetChat();
    let isReadyToSave = false;

    if (targetType() === 'webhook') {
       if (direction() === 'inbound') {
         finalTarget = 'Incoming Webhook';
         isReadyToSave = true;
       } else if (finalTarget.trim() && isVerified() === true) {
         isReadyToSave = true;
       }
    } else {
       if (finalTarget.trim() && isVerified() === true) {
         isReadyToSave = true;
       }
    }

    if (isReadyToSave) {
      hapticFeedback.notificationOccurred('success');
      
      const newRule = {
        channel_id: params.id,
        direction: direction(),
        target_type: targetType(),
        target: finalTarget,
        mode: mode() as any,
        delay: delay(),
        is_active: true,
        content_types: contentTypes(),
        remove_ads: removeAds(),
        remove_hashtags: removeHashtags(),
        remove_links: removeLinks(),
        watermark: watermark()
      };

      try {
        await channelApi.createForwardingRule(params.id, newRule);
        refetchRules();
        setIsCreating(false);
        setTargetChat('');
        setIsVerified(null);
        setMode('forward');
        setDelay('');
      } catch (err) {
        console.error("Failed to create rule:", err);
      }
    }
  };

  const toggleContentType = (key: keyof ContentTypes) => {
    hapticFeedback.selectionChanged();
    setContentTypes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white">
      {/* Header */}
      <div class="px-5 pt-6 pb-4 bg-[#0f1014]/80 backdrop-blur-md sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 overflow-hidden flex-1">
          <button 
            onClick={() => {
              hapticFeedback.impactOccurred('light');
              if (isCreating()) {
                setIsCreating(false);
              } else {
                navigate(`/channel/${params.id}`);
              }
            }}
            class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
            aria-label="Back"
          >
            <span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">arrow_back</span>
          </button>
          <div class="flex flex-col overflow-hidden">
            <h1 class="text-[18px] font-black text-white leading-tight truncate">{t('channelForwarding.autoForward') || 'Auto Forward'}</h1>
            <span class="text-[12px] text-on-surface-variant truncate">{t('channelForwarding.duplicatePosts')}</span>
          </div>
        </div>
        
        <button 
          onClick={() => setIsMenuOpen(true)}
          class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-95 transition-all shrink-0"
          aria-label="Open menu"
        >
          <span class="material-symbols-outlined text-white text-[20px]">menu</span>
        </button>
      </div>

      <ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="forwarding" />

      <div class="px-5 pt-6 flex flex-col gap-6 pb-24">
        <Show when={!isCreating()}>
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} class="flex flex-col gap-4">
            
            <div class="bg-gradient-to-r from-[#3390ec]/20 to-transparent border-l-2 border-[#3390ec] p-4 rounded-r-2xl mb-2">
               <h3 class="text-[14px] font-bold text-white flex items-center gap-2 mb-1">
                 <span class="material-symbols-outlined text-[#3390ec] text-[18px]">lightbulb</span>
                 {t('channelForwarding.howForwardingWorks')}
               </h3>
               <p class="text-[13px] text-[#8e8e93] leading-relaxed">
                 {t('channelForwarding.howForwardingWorksDesc')}
               </p>
            </div>

            <Show when={rules().length === 0}>
              <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-5 flex flex-col items-center text-center gap-3">
                <div class="w-16 h-16 rounded-full bg-[#3390ec]/10 text-[#3390ec] flex items-center justify-center mb-2">
                   <span class="material-symbols-outlined text-[32px]">call_split</span>
                </div>
                <h2 class="text-[16px] font-bold text-white">{t('channelForwarding.noForwardingRules') || 'No Forwarding Rules'}</h2>
                <p class="text-[13px] text-[#8e8e93]">{t('channelForwarding.noForwardingRulesDesc') || 'Set up automatic forwarding to other channels.'}</p>
                <button onClick={() => setIsCreating(true)} class="mt-4 px-6 py-3 bg-[#3390ec] text-white font-bold rounded-full hover:bg-[#2b7bc9] transition-colors shadow-[0_4px_15px_rgba(51,144,236,0.2)]">
                   {t('channelForwarding.createRule') || 'Create Rule'}
                </button>
              </div>
            </Show>

            <Show when={rules().length > 0}>
               <div class="flex items-center justify-between">
                 <h2 class="text-[16px] font-bold text-white">{t('channelForwarding.activeRules') || 'Active Rules'}</h2>
               </div>
               <div class="flex flex-col gap-3">
                 <For each={rules()}>
                   {(rule) => (
                      <div class="bg-[#1c1c1c] rounded-2xl border border-[#2a2a2a] p-4 flex flex-col gap-3">
                         <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                               <div class={`w-10 h-10 rounded-full flex items-center justify-center ${rule.direction === 'inbound' ? 'bg-[#34c759]/20 text-[#34c759]' : 'bg-[#3390ec]/20 text-[#3390ec]'}`}>
                                  <span class="material-symbols-outlined text-[20px]">
                                     {rule.targetType === 'webhook' ? 'webhook' : (rule.direction === 'inbound' ? 'download' : 'upload')}
                                  </span>
                               </div>
                               <div class="flex flex-col">
                                  <span class="text-[15px] font-bold text-white max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">
                                    {rule.targetType === 'webhook' 
                                       ? (rule.direction === 'inbound' ? rule.target : `${t('channelForwarding.to')} ${rule.target}`) 
                                       : (rule.direction === 'inbound' ? `${t('channelForwarding.from')} @${rule.target}` : `${t('channelForwarding.to')} @${rule.target}`)}
                                  </span>
                                  <span class="text-[12px] text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                                    <Show when={rule.targetType === 'webhook'}>
                                       <span class="material-symbols-outlined text-[12px] text-[#ff2a5f]">webhook</span>
                                    </Show>
                                    {getLocalizedMode(rule.mode)} • {getLocalizedDirection(rule.direction)}
                                  </span>
                               </div>
                            </div>
                            <div class="flex items-center gap-3">
                               <button 
                                  onClick={async () => {
                                    hapticFeedback.selectionChanged();
                                    const r = rulesData()?.find((x: any) => x.id === rule.id);
                                    if (r) {
                                      const updated = { ...r, is_active: !r.is_active };
                                      await channelApi.updateForwardingRule(params.id, r.id!, updated);
                                      refetchRules();
                                    }
                                  }}
                                  class={`w-12 h-7 rounded-full relative transition-colors ${rule.active ? 'bg-[#34c759]' : 'bg-[#3a3a3c]'}`}
                               >
                                  <div class={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${rule.active ? 'translate-x-5' : 'translate-x-0'}`}></div>
                               </button>

                               <button 
                                  onClick={async () => {
                                    hapticFeedback.impactOccurred('medium');
                                    await channelApi.deleteForwardingRule(params.id, rule.id);
                                    refetchRules();
                                  }}
                                  class="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 text-red-500 flex items-center justify-center transition-all shadow-sm shrink-0"
                               >
                                  <span class="material-symbols-outlined text-[16px]">delete</span>
                               </button>
                             </div>
                         </div>
                      </div>
                   )}
                 </For>
               </div>
               
               <button onClick={() => setIsCreating(true)} class="h-12 bg-[#2c2c2e] text-white font-bold rounded-xl hover:bg-[#3a3a3c] transition-colors flex items-center justify-center gap-2 mt-2 border border-[#3a3a3c]">
                   <span class="material-symbols-outlined text-[18px]">add</span>
                   {t('channelForwarding.addNewRule') || 'Add New Rule'}
                </button>
            </Show>

            {/* Forward Log */}
             <div class="mt-6 flex flex-col gap-3">
                <h2 class="text-[16px] font-bold text-white flex items-center gap-2">
                   <span class="material-symbols-outlined text-[#8e8e93]">history</span>
                   {t('channelForwarding.recentActivity')}
                </h2>
                <div class="bg-[#1c1c1c] rounded-2xl border border-[#2a2a2a] overflow-hidden">
                   <For each={forwardLog()}>
                      {(log, index) => (
                         <div class={`p-3 flex items-start gap-3 ${index() !== forwardLog().length - 1 ? 'border-b border-[#2a2a2a]' : ''}`}>
                            <span class="material-symbols-outlined text-[#34c759] text-[18px] mt-0.5">check_circle</span>
                            <div class="flex flex-col flex-1">
                               <span class="text-[13px] text-white">{log.text}</span>
                               <span class="text-[11px] text-[#8e8e93]">{log.time}</span>
                            </div>
                         </div>
                      )}
                   </For>
                </div>
             </div>

           </Motion.div>
         </Show>

         <Show when={isCreating()}>
           <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} class="flex flex-col gap-4">
             
             <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-5 flex flex-col gap-5">
               <h2 class="text-[16px] font-bold text-white flex items-center gap-2">
                  <span class="material-symbols-outlined text-[#3390ec]">add_circle</span>
                  {t('channelForwarding.addNewRule') || 'New Forward Rule'}
               </h2>
               
               {/* Direction Selector */}
               <div class="flex flex-col gap-2">
                  <label class="text-[13px] font-bold text-white">{t('channelForwarding.ruleDirection')}</label>
                  <div class="bg-[#2c2c2e] p-1 rounded-xl flex">
                     <button 
                       onClick={() => setDirection('outbound')}
                       class={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${direction() === 'outbound' ? 'bg-[#3a3a3c] text-white shadow' : 'text-[#8e8e93] hover:text-white'}`}
                     >
                       <span class="material-symbols-outlined text-[16px]">upload</span>
                       {t('channelForwarding.outbound')}
                     </button>
                     <button 
                       onClick={() => setDirection('inbound')}
                       class={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${direction() === 'inbound' ? 'bg-[#3a3a3c] text-white shadow' : 'text-[#8e8e93] hover:text-white'}`}
                     >
                       <span class="material-symbols-outlined text-[16px]">download</span>
                       {t('channelForwarding.inbound')}
                     </button>
                  </div>
                  <p class="text-[11px] text-[#8e8e93] mt-1 text-center">
                    {direction() === 'outbound' 
                      ? t('channelForwarding.outboundDesc') 
                      : t('channelForwarding.inboundDesc')}
                  </p>
               </div>

               {/* Integration Type Selector */}
               <div class="flex flex-col gap-2">
                  <label class="text-[13px] font-bold text-white">{t('channelForwarding.integrationType')}</label>
                  <div class="bg-[#2c2c2e] p-1 rounded-xl flex">
                     <button 
                       onClick={() => setTargetType('telegram')}
                       class={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${targetType() === 'telegram' ? 'bg-[#3a3a3c] text-white shadow' : 'text-[#8e8e93] hover:text-white'}`}
                     >
                       <span class="material-symbols-outlined text-[16px]">telegram</span>
                       {t('channelForwarding.telegram')}
                     </button>
                     <button 
                       onClick={() => setTargetType('webhook')}
                       class={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${targetType() === 'webhook' ? 'bg-[#3a3a3c] text-white shadow' : 'text-[#8e8e93] hover:text-white'}`}
                     >
                       <span class="material-symbols-outlined text-[16px]">webhook</span>
                       {t('channelForwarding.webhookApi')}
                     </button>
                  </div>
                  <p class="text-[11px] text-[#8e8e93] mt-1 text-center">
                    {targetType() === 'telegram' 
                      ? t('channelForwarding.telegramDesc') 
                      : t('channelForwarding.webhookDesc')}
                  </p>
               </div>

               <Show when={targetType() === 'telegram'}>
                 <div class="flex flex-col gap-2">
                   <label class="text-[13px] font-bold text-white flex items-center gap-2">
                     {direction() === 'outbound' ? t('channelForwarding.targetChannel') : t('channelForwarding.sourceChannel')}
                   </label>
                   <div class="flex gap-2">
                      <div class="relative flex-1">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93] font-bold">@</span>
                        <input 
                          type="text" 
                          value={targetChat()} 
                          onInput={(e) => {
                             setTargetChat(e.currentTarget.value.replace('@', ''));
                             setIsVerified(null);
                          }}
                          placeholder="channel_username"
                          class="bg-[#2c2c2e] text-white text-[15px] rounded-xl pl-8 pr-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-[#3390ec]"
                        />
                      </div>
                      <button 
                        onClick={handleVerify}
                        disabled={!targetChat().trim()}
                        class="w-[48px] shrink-0 bg-[#2c2c2e] hover:bg-[#3a3a3c] disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors"
                      >
                        <Show when={isVerified() === null}>
                           <span class="material-symbols-outlined text-[20px]">search</span>
                        </Show>
                        <Show when={isVerified() === true}>
                           <span class="material-symbols-outlined text-[#34c759] text-[20px]">check_circle</span>
                        </Show>
                        <Show when={isVerified() === false}>
                           <span class="material-symbols-outlined text-[#ff3b30] text-[20px]">error</span>
                        </Show>
                      </button>
                   </div>
                 </div>
               </Show>

               <Show when={targetType() === 'webhook' && direction() === 'outbound'}>
                 <div class="flex flex-col gap-2">
                   <label class="text-[13px] font-bold text-white flex items-center justify-between">
                      {t('channelForwarding.destinationWebhook')}
                      <div class="group relative">
                         <span class="material-symbols-outlined text-[16px] text-[#8e8e93] cursor-help">help</span>
                         <div class="absolute bottom-full right-0 mb-2 w-64 bg-[#2c2c2e] text-[11px] text-white p-3 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl border border-[#3a3a3c]">
                            {t('channelForwarding.destinationWebhookHelp')}
                         </div>
                      </div>
                   </label>
                   <div class="relative">
                     <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#8e8e93] text-[18px]">link</span>
                     <input 
                       type="url" 
                       value={targetChat()} 
                       onInput={(e) => {
                          setTargetChat(e.currentTarget.value);
                          setIsVerified(e.currentTarget.value.startsWith('http') ? true : false);
                       }}
                       placeholder="https://your-automation-tool.com/webhook/..."
                       class="bg-[#2c2c2e] text-white text-[15px] rounded-xl pl-10 pr-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-[#3390ec]"
                     />
                   </div>
                 </div>
               </Show>

               <Show when={targetType() === 'webhook' && direction() === 'inbound'}>
                 <div class="flex flex-col gap-2">
                   <label class="text-[13px] font-bold text-white flex items-center justify-between">
                      {t('channelForwarding.uniqueInboundWebhook')}
                      <div class="group relative">
                         <span class="material-symbols-outlined text-[16px] text-[#8e8e93] cursor-help">help</span>
                         <div class="absolute bottom-full right-0 mb-2 w-64 bg-[#2c2c2e] text-[11px] text-white p-3 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl border border-[#3a3a3c]">
                            {t('channelForwarding.uniqueInboundWebhookHelp')}
                         </div>
                      </div>
                   </label>
                   <div class="flex gap-2">
                      <input 
                        type="text" 
                        value={`${import.meta.env.VITE_API_URL || 'https://api.ifragment.app'}/wh/${params.id}/in_${Date.now().toString().slice(-6)}`} 
                        readonly
                        class="bg-[#2c2c2e] text-[#8e8e93] text-[13px] rounded-xl px-4 py-3 w-full focus:outline-none"
                      />
                      <button 
                        onClick={() => {
                           hapticFeedback.selectionChanged();
                           // mock copy
                        }}
                        class="w-[48px] shrink-0 bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white rounded-xl flex items-center justify-center transition-colors"
                      >
                        <span class="material-symbols-outlined text-[20px]">content_copy</span>
                     </button>
                  </div>
                  <p class="text-[11px] text-[#8e8e93]">{t('channelForwarding.inboundWebhookPlaceholder')}</p>
                </div>
              </Show>

              <div class="flex flex-col gap-2">
                 <label class="text-[13px] font-bold text-white flex items-center justify-between">
                    {t('channelForwarding.mode')}
                    <div class="group relative">
                       <span class="material-symbols-outlined text-[16px] text-[#8e8e93] cursor-help">help</span>
                       <div class="absolute bottom-full right-0 mb-2 w-64 bg-[#2c2c2e] text-[11px] text-white p-3 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl border border-[#3a3a3c] whitespace-pre-line">
                          {t('channelForwarding.modeHelp')}
                       </div>
                    </div>
                 </label>
                 <SelectField 
                    label=""
                    value={mode()}
                    onChange={setMode}
                    options={[
                      { value: 'forward', label: t('channelForwarding.modeForwardLabel') },
                      { value: 'copy', label: t('channelForwarding.modeCopyLabel') },
                      { value: 'ai', label: t('channelForwarding.modeCopyAiLabel') }
                    ]}
                 />
              </div>

              <div class="flex flex-col gap-2">
                 <label class="text-[13px] font-bold text-white flex items-center justify-between">
                    {t('channelForwarding.delay')}
                    <div class="group relative">
                       <span class="material-symbols-outlined text-[16px] text-[#8e8e93] cursor-help">help</span>
                       <div class="absolute bottom-full right-0 mb-2 w-48 bg-[#2c2c2e] text-[11px] text-white p-3 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl border border-[#3a3a3c]">
                          {t('channelForwarding.delayHelp')}
                       </div>
                    </div>
                 </label>
                 <div class="relative">
                     <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#8e8e93] text-[18px]">timer</span>
                    <input 
                      type="number" 
                      value={delay()} 
                      onInput={(e) => setDelay(e.currentTarget.value)}
                      placeholder={t('channelForwarding.delayPlaceholder')}
                      class="bg-[#2c2c2e] text-white text-[15px] rounded-xl pl-10 pr-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-[#3390ec]"
                    />
                 </div>
              </div>
            </div>

            {/* Content Types Filter */}
            <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-5 flex flex-col gap-4">
               <h3 class="text-[15px] font-bold text-white flex items-center gap-2">
                  <span class="material-symbols-outlined text-[#8e8e93]">filter_alt</span>
                  {t('channelForwarding.allowedContentTypes')}
               </h3>
               <p class="text-[12px] text-[#8e8e93] -mt-2">{t('channelForwarding.allowedContentTypesDesc')}</p>
               <div class="grid grid-cols-2 gap-3">
                  <div 
                     onClick={() => toggleContentType('text')}
                     class={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${contentTypes().text ? 'bg-[#3390ec]/10 border-[#3390ec]/30 text-[#3390ec]' : 'bg-[#2c2c2e] border-[#3a3a3c] text-white'}`}
                  >
                     <span class="material-symbols-outlined text-[18px]">format_align_left</span>
                     <span class="text-[13px] font-bold">{t('channelForwarding.filterText')}</span>
                  </div>
                  <div 
                     onClick={() => toggleContentType('photos')}
                     class={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${contentTypes().photos ? 'bg-[#3390ec]/10 border-[#3390ec]/30 text-[#3390ec]' : 'bg-[#2c2c2e] border-[#3a3a3c] text-white'}`}
                  >
                     <span class="material-symbols-outlined text-[18px]">image</span>
                     <span class="text-[13px] font-bold">{t('channelForwarding.filterPhoto')}</span>
                  </div>
                  <div 
                     onClick={() => toggleContentType('videos')}
                     class={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${contentTypes().videos ? 'bg-[#3390ec]/10 border-[#3390ec]/30 text-[#3390ec]' : 'bg-[#2c2c2e] border-[#3a3a3c] text-white'}`}
                  >
                     <span class="material-symbols-outlined text-[18px]">movie</span>
                     <span class="text-[13px] font-bold">{t('channelForwarding.filterVideo')}</span>
                  </div>
                  <div 
                     onClick={() => toggleContentType('files')}
                     class={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${contentTypes().files ? 'bg-[#3390ec]/10 border-[#3390ec]/30 text-[#3390ec]' : 'bg-[#2c2c2e] border-[#3a3a3c] text-white'}`}
                  >
                     <span class="material-symbols-outlined text-[18px]">description</span>
                     <span class="text-[13px] font-bold">{t('channelForwarding.filterDocument')}</span>
                  </div>
                  <div 
                     onClick={() => toggleContentType('voice')}
                     class={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors col-span-2 justify-center ${contentTypes().voice ? 'bg-[#3390ec]/10 border-[#3390ec]/30 text-[#3390ec]' : 'bg-[#2c2c2e] border-[#3a3a3c] text-white'}`}
                  >
                     <span class="material-symbols-outlined text-[18px]">mic</span>
                     <span class="text-[13px] font-bold">{t('channelForwarding.filterVoice')}</span>
                  </div>
               </div>
            </div>

            {/* Advanced Options */}
            <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-1 flex flex-col">
               <button 
                  onClick={() => setShowAdvanced(!showAdvanced())}
                  class="p-4 flex items-center justify-between w-full text-left"
               >
                  <span class="text-[15px] font-bold text-white flex items-center gap-2">
                     <span class="material-symbols-outlined text-[#8e8e93] text-[18px]">tune</span>
                     {t('channelForwarding.advancedMutators')}
                  </span>
                  <span class={`material-symbols-outlined text-white transition-transform ${showAdvanced() ? 'rotate-180' : ''}`}>expand_more</span>
               </button>
               
               <Show when={showAdvanced()}>
                  <div class="p-4 pt-0 flex flex-col gap-4 border-t border-[#2a2a2a] mt-1">
                     <div class="mt-4">
                        <SettingsSection
                           title={t('channelForwarding.removeAds')}
                           description={t('channelForwarding.removeAdsDesc')}
                           enabled={removeAds()}
                           onToggle={setRemoveAds}
                        />
                     </div>
                     <div class="h-[1px] bg-[#2a2a2a]"></div>
                     <SettingsSection
                        title={t('channelForwarding.removeHashtags')}
                        description={t('channelForwarding.removeHashtagsDesc')}
                        enabled={removeHashtags()}
                        onToggle={setRemoveHashtags}
                     />
                     <div class="h-[1px] bg-[#2a2a2a]"></div>
                     <SettingsSection
                        title={t('channelForwarding.removeLinks')}
                        description={t('channelForwarding.removeLinksDesc')}
                        enabled={removeLinks()}
                        onToggle={setRemoveLinks}
                     />
                     <div class="h-[1px] bg-[#2a2a2a]"></div>
                     <div class="flex flex-col gap-2">
                        <label class="text-[13px] font-bold text-white">{t('channelForwarding.watermarkText')}</label>
                        <p class="text-[11px] text-[#8e8e93]">{t('channelForwarding.watermarkDesc')}</p>
                        <input 
                          type="text" 
                          value={watermark()} 
                          onInput={(e) => setWatermark(e.currentTarget.value)}
                          placeholder={t('channelForwarding.watermarkPlaceholder')}
                          class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-[#3390ec]"
                        />
                     </div>
                  </div>
               </Show>
            </div>

            <div class="flex gap-3 mt-4">
               <button 
                 onClick={() => setIsCreating(false)}
                 class="flex-1 h-12 bg-[#2c2c2e] text-white rounded-xl font-bold hover:bg-[#3a3a3c] transition-colors"
               >
                 {t('common.cancel') || 'Cancel'}
               </button>
               <button 
                 onClick={handleSaveRule}
                 disabled={(targetType() === 'telegram' && !targetChat().trim()) || (targetType() === 'webhook' && direction() === 'outbound' && !targetChat().trim()) || (targetType() === 'telegram' && isVerified() === false)}
                 class="flex-[2] h-12 bg-[#3390ec] text-white rounded-xl font-bold hover:bg-[#2b7bc9] disabled:opacity-50 transition-colors"
               >
                 {t('channelForwarding.saveRule') || 'Save Rule'}
               </button>
            </div>
          </Motion.div>
         </Show>
      </div>

      {/* Footer Actions (Save button fixed bar) */}
      <Show when={isDirty()}>
        <div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/90 to-transparent z-40 flex gap-3">
          <button 
            onClick={() => navigate(`/channel/${params.id}`)}
            disabled={isSaving()}
            class="flex-1 h-14 bg-[#1c1c1c] text-[#ff3b30] border border-[#ff3b30]/20 rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 hover:bg-[#ff3b30]/10"
          >
            {t('common.cancel') || 'Cancel'}
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving()}
            class="flex-[2] h-14 bg-[#32ade6] hover:bg-[#2b96c8] text-black rounded-2xl font-bold text-[16px] shadow-[0_10px_25px_rgba(50,173,230,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Show when={!isSaving()} fallback={<span class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>}>
              {t('common.save') || 'Save Changes'}
              <span class="material-symbols-outlined text-[20px]">save</span>
            </Show>
          </button>
        </div>
      </Show>
    </div>
  );
};
