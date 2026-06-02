import { Component, createSignal, createResource, createEffect, onCleanup, onMount, Show, For } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';

import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { SettingsSection, SelectField } from '@/shared/ui/settings-controls.js';
import { t } from '@/shared/i18n/index.js';
import { channelApi } from '@/shared/api/channel-management.js';

interface InlineBtn {
  id: string;
  title: string;
  value: string;
  type: string;
  style: string;
  emoji: string;
}

export const ChannelInlineButtonsPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  
  // Settings Config State
  const [isButtonsEnabled, setIsButtonsEnabled] = createSignal(true);
  const [activePreset, setActivePreset] = createSignal<'like' | 'link_share' | 'buy' | 'custom'>('like');

  
  // Active Glass Buttons List
  // Pre-load with a gorgeous Like/Dislike setup so the page looks alive out of the box
  const [buttons, setButtons] = createSignal<InlineBtn[]>([
    { id: 'p1', title: t('channelInlineButtons.likeBtn') || 'Like', value: 'like', type: 'counter', style: 'success', emoji: '👍' },
    { id: 'p2', title: t('channelInlineButtons.dislikeBtn') || 'Dislike', value: 'dislike', type: 'counter', style: 'danger', emoji: '👎' }
  ]);
  
  // State for adding a new button
  const [btnTitle, setBtnTitle] = createSignal('');
  const [btnValue, setBtnValue] = createSignal('');
  const [btnType, setBtnType] = createSignal('url');
  const [btnStyle, setBtnStyle] = createSignal('default');
  const [btnEmoji, setBtnEmoji] = createSignal('');
  const [editingId, setEditingId] = createSignal<string | null>(null);

  const [isDirty, setIsDirty] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);

  const [settings] = createResource(
    () => params.id,
    (id) => channelApi.getSettings(id)
  );

  const [buttonsData] = createResource(
    () => params.id,
    (id) => channelApi.getButtons(id)
  );

  createEffect(() => {
    const list = buttonsData();
    if (list) {
      setButtons(list.map((b: any) => ({
        id: b.id || '',
        title: b.title,
        value: b.value,
        type: b.type,
        style: b.style,
        emoji: b.emoji || ''
      })));
    }
  });

  createEffect(() => {
    const data = settings();
    if (data) {
      try {
        let inlineButtonsVal = data.inline_buttons;
        if (typeof inlineButtonsVal === 'string') {
          inlineButtonsVal = JSON.parse(inlineButtonsVal);
        }
        if (inlineButtonsVal && typeof inlineButtonsVal === 'object') {
          if ('enabled' in inlineButtonsVal) {
            setIsButtonsEnabled(inlineButtonsVal.enabled);
          }
          if ('preset' in inlineButtonsVal) {
            setActivePreset(inlineButtonsVal.preset as any);
          }
        }
      } catch (e) {
        console.error("Failed to parse inline_buttons from server settings:", e);
      }
    }
  });

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      navigate(`/channel/${params.id}`);
    });
    onCleanup(() => off());
  });

  const handleAddButton = () => {
    if (!btnTitle().trim() || !btnValue().trim()) return;
    hapticFeedback.impactOccurred('light');
    
    if (editingId()) {
      setButtons(buttons().map(b => b.id === editingId() ? {
        ...b,
        title: btnTitle().trim(),
        value: btnValue().trim(),
        type: btnType(),
        style: btnStyle(),
        emoji: btnEmoji().trim()
      } : b));
    } else {
      setButtons([...buttons(), {
        id: Date.now().toString(),
        title: btnTitle().trim(),
        value: btnValue().trim(),
        type: btnType(),
        style: btnStyle(),
        emoji: btnEmoji().trim()
      }]);
    }
    
    // Reset builder form
    setBtnTitle('');
    setBtnValue('');
    setBtnEmoji('');
    setEditingId(null);
    setIsDirty(true);
    setActivePreset('custom');
  };

  const handleEditButton = (id: string) => {
    hapticFeedback.impactOccurred('light');
    const btn = buttons().find(b => b.id === id);
    if (btn) {
      setBtnTitle(btn.title);
      setBtnValue(btn.value);
      setBtnType(btn.type);
      setBtnStyle(btn.style);
      setBtnEmoji(btn.emoji || '');
      setEditingId(id);
    }
  };

  const handleCancelEdit = () => {
    hapticFeedback.impactOccurred('light');
    setBtnTitle('');
    setBtnValue('');
    setBtnType('url');
    setBtnStyle('default');
    setBtnEmoji('');
    setEditingId(null);
  };

  const handleRemoveButton = (id: string) => {
    hapticFeedback.impactOccurred('light');
    setButtons(buttons().filter(b => b.id !== id));
    setIsDirty(true);
    setActivePreset('custom');
  };

  const applyPreset = (preset: string) => {
    hapticFeedback.impactOccurred('medium');
    setIsDirty(true);
    setActivePreset(preset as any);
    if (preset === 'like') {
      setButtons([
        { id: 'p1', title: t('channelInlineButtons.likeBtn') || 'Like', value: 'like', type: 'counter', style: 'success', emoji: '👍' },
        { id: 'p2', title: t('channelInlineButtons.dislikeBtn') || 'Dislike', value: 'dislike', type: 'counter', style: 'danger', emoji: '👎' }
      ]);
    } else if (preset === 'link_share') {
      setButtons([
        { id: 'p1', title: t('channelInlineButtons.viewSiteBtn') || 'View Site', value: 'https://site.com', type: 'url', style: 'primary', emoji: '📎' },
        { id: 'p2', title: t('channelInlineButtons.shareBtn') || 'Share', value: 'share', type: 'share', style: 'default', emoji: '📢' }
      ]);
    } else if (preset === 'buy') {
      setButtons([
        { id: 'p1', title: t('channelInlineButtons.buyNowBtn') || 'Buy Now', value: 'payment_id', type: 'payment', style: 'primary', emoji: '🛒' }
      ]);
    } else if (preset === 'custom') {
      setButtons([]);
    }
  };

  const handleSave = async () => {
    hapticFeedback.notificationOccurred('success');
    setIsSaving(true);
    
    // Save to server
    const currentVersion = settings()?.version ?? 1;
    const settingsPayload = {
      enabled: isButtonsEnabled(),
      preset: activePreset()
    };

    const buttonsPayload = buttons().map(b => ({
      channel_id: params.id,
      title: b.title,
      value: b.value,
      type: b.type as any,
      style: b.style,
      emoji: b.emoji,
      click_count: 0
    }));

    try {
      await channelApi.updateSettings(params.id, 'inline_buttons', settingsPayload, currentVersion);
      await channelApi.saveButtons(params.id, buttonsPayload);
      setIsDirty(false);
      navigate(`/channel/${params.id}`);
    } catch (e) {
      console.error("Failed to save inline buttons to server:", e);
      setIsDirty(false);
      navigate(`/channel/${params.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white">
      {/* Header */}
      <div class="px-5 pt-6 pb-4 bg-[#0f1014]/80 backdrop-blur-md sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 overflow-hidden flex-1">
          <button 
            onClick={() => { hapticFeedback.impactOccurred('light'); navigate(`/channel/${params.id}`); }}
            class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
            aria-label="Back"
          >
            <span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">arrow_back</span>
          </button>
          <div class="flex flex-col overflow-hidden">
            <div class="flex items-center gap-2">
              <h1 class="text-[18px] font-black text-white leading-tight truncate">{t('channelInlineButtons.title')}</h1>
              <Show when={isDirty()}>
                <span class="w-2.5 h-2.5 rounded-full bg-[#32ade6] animate-pulse shrink-0" />
              </Show>
            </div>
            <span class="text-[12px] text-on-surface-variant truncate">{t('channelInlineButtons.subtitle')}</span>
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

      <ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="inline-buttons" />

      <div class="px-5 pt-6 flex flex-col gap-6 pb-24">
        
        {/* Enable / Disable Glass Buttons */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-3">
          <SettingsSection
            title={t('channelInlineButtons.defaultForAll')}
            description={t('channelInlineButtons.defaultForAllDesc')}
            enabled={isButtonsEnabled()}
            onToggle={(v) => {
              setIsButtonsEnabled(v);
              setIsDirty(true);
            }}
          />
        </Motion.div>

        <Show when={isButtonsEnabled()}>
          
          {/* Active Mode Selector */}
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} class="flex flex-col gap-3">
             <h3 class="text-[13px] font-black text-[#8e8e93] px-1 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px] text-[#32ade6]">ads_click</span>
                {t('channelInlineButtons.presetSelectorTitle')}
             </h3>
             
             <div class="grid grid-cols-2 gap-3">
                {/* Preset 1: Like */}
                <button 
                  onClick={() => applyPreset('like')}
                  class={`p-4 rounded-3xl border transition-all flex flex-col gap-2 relative overflow-hidden active:scale-95 ${activePreset() === 'like' ? 'bg-[#32ade6]/10 border-[#32ade6] shadow-[0_4px_20px_rgba(50,173,230,0.15)]' : 'bg-[#1c1c1c] border-[#2a2a2a] hover:bg-[#252528]'}`}
                >
                   <Show when={activePreset() === 'like'}>
                      <div class="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#32ade6] text-black flex items-center justify-center">
                         <span class="material-symbols-outlined text-[14px] font-black">done</span>
                      </div>
                   </Show>
                   <span class="text-[20px]">👍👎</span>
                   <div class="flex flex-col">
                      <span class="text-[14px] font-bold text-white">{t('channelInlineButtons.presetLikeTitle')}</span>
                      <span class="text-[11px] text-[#8e8e93] leading-relaxed mt-0.5">{t('channelInlineButtons.presetLikeDesc')}</span>
                   </div>
                </button>

                {/* Preset 2: Link/Share */}
                <button 
                  onClick={() => applyPreset('link_share')}
                  class={`p-4 rounded-3xl border transition-all flex flex-col gap-2 relative overflow-hidden active:scale-95 ${activePreset() === 'link_share' ? 'bg-[#32ade6]/10 border-[#32ade6] shadow-[0_4px_20px_rgba(50,173,230,0.15)]' : 'bg-[#1c1c1c] border-[#2a2a2a] hover:bg-[#252528]'}`}
                >
                   <Show when={activePreset() === 'link_share'}>
                      <div class="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#32ade6] text-black flex items-center justify-center">
                         <span class="material-symbols-outlined text-[14px] font-black">done</span>
                      </div>
                   </Show>
                   <span class="text-[20px]">📎📢</span>
                   <div class="flex flex-col">
                      <span class="text-[14px] font-bold text-white">{t('channelInlineButtons.presetLinkShareTitle')}</span>
                      <span class="text-[11px] text-[#8e8e93] leading-relaxed mt-0.5">{t('channelInlineButtons.presetLinkShareDesc')}</span>
                   </div>
                </button>

                {/* Preset 3: Buy */}
                <button 
                  onClick={() => applyPreset('buy')}
                  class={`p-4 rounded-3xl border transition-all flex flex-col gap-2 relative overflow-hidden active:scale-95 ${activePreset() === 'buy' ? 'bg-[#32ade6]/10 border-[#32ade6] shadow-[0_4px_20px_rgba(50,173,230,0.15)]' : 'bg-[#1c1c1c] border-[#2a2a2a] hover:bg-[#252528]'}`}
                >
                   <Show when={activePreset() === 'buy'}>
                      <div class="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#32ade6] text-black flex items-center justify-center">
                         <span class="material-symbols-outlined text-[14px] font-black">done</span>
                      </div>
                   </Show>
                   <span class="text-[20px]">🛒</span>
                   <div class="flex flex-col">
                      <span class="text-[14px] font-bold text-white">{t('channelInlineButtons.presetBuyTitle')}</span>
                      <span class="text-[11px] text-[#8e8e93] leading-relaxed mt-0.5">{t('channelInlineButtons.presetBuyDesc')}</span>
                   </div>
                </button>

                {/* Preset 4: Custom */}
                <button 
                  onClick={() => applyPreset('custom')}
                  class={`p-4 rounded-3xl border transition-all flex flex-col gap-2 relative overflow-hidden active:scale-95 ${activePreset() === 'custom' ? 'bg-[#32ade6]/10 border-[#32ade6] shadow-[0_4px_20px_rgba(50,173,230,0.15)]' : 'bg-[#1c1c1c] border-[#2a2a2a] hover:bg-[#252528]'}`}
                >
                   <Show when={activePreset() === 'custom'}>
                      <div class="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#32ade6] text-black flex items-center justify-center">
                         <span class="material-symbols-outlined text-[14px] font-black">done</span>
                      </div>
                   </Show>
                   <span class="text-[20px]">🛠️</span>
                   <div class="flex flex-col">
                      <span class="text-[14px] font-bold text-white">{t('channelInlineButtons.presetCustomTitle')}</span>
                      <span class="text-[11px] text-[#8e8e93] leading-relaxed mt-0.5">{t('channelInlineButtons.presetCustomDesc')}</span>
                   </div>
                </button>
             </div>
          </Motion.div>

          {/* Active Buttons List and Form Builder */}
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-5">
             <div class="flex items-center justify-between border-b border-[#2a2a2a] pb-3">
                <h2 class="text-[16px] font-bold text-white flex items-center gap-2">
                   <span class="material-symbols-outlined text-[#32ade6]">splitscreen</span>
                   {t('channelInlineButtons.buttonRules')}
                </h2>
             </div>
             
             {/* 1. List of Current Buttons */}
             <div class="flex flex-col gap-2">
                <h3 class="text-[13px] font-bold text-[#8e8e93] px-1">{t('channelInlineButtons.activeButtons')}</h3>
                <Show when={buttons().length === 0}>
                   <div class="text-center py-4 bg-black/20 border border-dashed border-[#2a2a2a] rounded-2xl text-[12px] text-on-surface-variant">
                      {t('channelInlineButtons.noButtons')}
                   </div>
                </Show>
                <Show when={buttons().length > 0}>
                   <div class="flex flex-col gap-2">
                      <For each={buttons()}>
                         {(btn) => {
                            const styleClass = 
                              btn.style === 'primary' ? 'bg-[#3390ec]/10 text-[#3390ec] border-[#3390ec]/30' :
                              btn.style === 'success' ? 'bg-[#34c759]/10 text-[#34c759] border-[#34c759]/30' :
                              btn.style === 'danger' ? 'bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/30' :
                              'bg-[#2c2c2e]/50 text-white border-[#3a3a3c]';
                            
                            return (
                               <div class={`flex items-center justify-between p-3 rounded-2xl border ${styleClass}`}>
                                  <div class="flex items-center gap-3">
                                     <div class="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center text-[20px] shadow-sm">
                                        {btn.emoji || '🔘'}
                                     </div>
                                     <div class="flex flex-col">
                                        <span class="text-[14px] font-bold">{btn.title}</span>
                                        <span class="text-[11px] opacity-70 mt-0.5" dir="ltr">{btn.value}</span>
                                     </div>
                                  </div>
                                  <div class="flex items-center gap-1">
                                     <button 
                                        onClick={() => handleEditButton(btn.id)}
                                        class="w-8 h-8 bg-black/20 hover:bg-[#32ade6]/20 rounded-full flex items-center justify-center text-white/70 hover:text-[#32ade6] transition-colors border border-transparent hover:border-[#32ade6]/30"
                                        title={t('channelInlineButtons.editButton')}
                                     >
                                        <span class="material-symbols-outlined text-[18px]">edit</span>
                                     </button>
                                     <button 
                                        onClick={() => handleRemoveButton(btn.id)}
                                        class="w-8 h-8 bg-black/20 hover:bg-[#ff3b30]/20 rounded-full flex items-center justify-center text-white/70 hover:text-[#ff3b30] transition-colors border border-transparent hover:border-[#ff3b30]/30"
                                        title={t('common.close')}
                                     >
                                        <span class="material-symbols-outlined text-[18px]">delete</span>
                                     </button>
                                  </div>
                               </div>
                            );
                         }}
                      </For>
                   </div>
                </Show>
             </div>

             {/* 2. Builder Form Inputs */}
             <div class={`flex flex-col gap-3 p-3.5 rounded-2xl border transition-colors ${editingId() ? 'bg-[#32ade6]/5 border-[#32ade6]/30' : 'bg-[#2c2c2e]/30 border-[#2a2a2a]'}`}>
                <h3 class="text-[13px] font-bold text-white mb-1 flex items-center gap-1.5">
                   <span class="material-symbols-outlined text-[16px] text-[#32ade6]">{editingId() ? 'edit' : 'add_circle'}</span>
                   {editingId() ? t('channelInlineButtons.editButton') : t('channelInlineButtons.addButtonForm')}
                </h3>
                
                <div class="flex gap-2">
                   <div class="w-[70px] flex-shrink-0">
                      <input 
                        type="text" 
                        value={btnEmoji()} 
                        onInput={(e) => setBtnEmoji(e.currentTarget.value)}
                        placeholder={t('channelInlineButtons.buttonEmoji') || 'Emoji'}
                        class="w-full bg-[#1c1c1c] text-white text-[15px] text-center rounded-xl px-2 py-3 focus:outline-none focus:ring-2 focus:ring-[#32ade6] border border-[#2a2a2a] placeholder-[#555]"
                      />
                   </div>
                   <div class="flex-1">
                      <input 
                        type="text" 
                        value={btnTitle()} 
                        onInput={(e) => setBtnTitle(e.currentTarget.value)}
                        placeholder={t('channelInlineButtons.buttonText')}
                        class="w-full bg-[#1c1c1c] text-white text-[14px] rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-[#32ade6] border border-[#2a2a2a] placeholder-[#555]"
                      />
                   </div>
                </div>
                
                <div class="grid grid-cols-2 gap-2">
                   <SelectField 
                      label=""
                      value={btnType()}
                      onChange={(v) => setBtnType(v)}
                      options={[
                         { value: 'url', label: t('channelInlineButtons.typeUrl') },
                         { value: 'counter', label: t('channelInlineButtons.typeCounter') },
                         { value: 'share', label: t('channelInlineButtons.typeShare') },
                         { value: 'webapp', label: t('channelInlineButtons.typeWebApp') },
                         { value: 'payment', label: t('channelInlineButtons.typePay') },
                      ]}
                   />
                   <SelectField 
                      label=""
                      value={btnStyle()}
                      onChange={(v) => setBtnStyle(v)}
                      options={[
                         { value: 'default', label: t('channelInlineButtons.styleDefault') },
                         { value: 'primary', label: t('channelInlineButtons.stylePrimary') },
                         { value: 'success', label: t('channelInlineButtons.styleSuccess') },
                         { value: 'danger', label: t('channelInlineButtons.styleDanger') },
                      ]}
                   />
                </div>
                
                <div class="flex flex-col gap-2 mt-1">
                   <input 
                      type="text" 
                      value={btnValue()} 
                      onInput={(e) => setBtnValue(e.currentTarget.value)}
                      placeholder={t('channelInlineButtons.buttonValue')}
                      class="w-full bg-[#1c1c1c] text-white text-[14px] rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-[#32ade6] border border-[#2a2a2a] placeholder-[#555]"
                      dir="ltr"
                   />
                   <div class="flex gap-2 w-full mt-2">
                      <Show when={editingId()}>
                         <button 
                            onClick={handleCancelEdit}
                            class="flex-1 bg-[#1c1c1c] text-white/70 border border-[#2a2a2a] hover:bg-[#2a2a2a] py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors active:scale-95"
                         >
                            {t('common.cancel')}
                         </button>
                      </Show>
                      <button 
                         onClick={handleAddButton}
                         disabled={!btnTitle().trim() || !btnValue().trim()}
                         class={`flex-[2] py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors active:scale-95 disabled:active:scale-100 disabled:opacity-40 ${
                            editingId() 
                            ? 'bg-[#32ade6] text-black hover:bg-[#2b96c8] shadow-[0_4px_15px_rgba(50,173,230,0.3)]' 
                            : 'bg-[#32ade6]/10 text-[#32ade6] border border-[#32ade6]/30 hover:bg-[#32ade6]/20 disabled:hover:bg-[#32ade6]/10'
                         }`}
                      >
                         <span class="material-symbols-outlined text-[20px]">{editingId() ? 'save' : 'add'}</span>
                         {editingId() ? t('channelInlineButtons.saveChanges') : t('channelInlineButtons.addButtonToList')}
                      </button>
                   </div>
                </div>
             </div>

             {/* 3. Dynamic Live Telegram Post Mockup Simulator */}
             <div class="flex flex-col gap-2 mt-3">
                <label class="text-[13px] font-bold text-[#8e8e93] px-1 flex items-center gap-1.5">
                   <span class="material-symbols-outlined text-[16px]">visibility</span>
                   {t('channelDynamicBio.preview')}
                </label>
                
                {/* Premium Mockup Telegram Desktop/Mobile Wallpaper */}
                <div class="bg-[url('https://i.pinimg.com/1200x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center rounded-2xl p-4 min-h-[160px] flex flex-col justify-end relative overflow-hidden border border-[#2a2a2a]">
                   <div class="absolute inset-0 bg-black/45"></div>
                   
                   <div class="flex flex-col w-full gap-3.5 relative z-10">
                      
                      {/* Telegram Message Bubble */}
                      <div class="flex flex-col max-w-[90%] self-end w-full">
                         <div class="bg-[#243447] text-white rounded-2xl rounded-br-none p-3.5 shadow-xl text-[13px] leading-relaxed border border-[#32ade6]/20">
                            {t('channelInlineButtons.mockPostText')}
                            
                            <div class="flex items-center justify-end gap-1 mt-1.5 opacity-60 text-[10px]">
                               <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                               <span class="material-symbols-outlined text-[12px] text-[#32ade6]">done_all</span>
                            </div>
                         </div>
                         
                         {/* Glass Buttons */}
                         <div class="flex flex-col gap-1 mt-1.5 w-full">
                            <Show when={buttons().length === 0}>
                               <div class="text-center py-2 bg-black/30 border border-dashed border-white/10 rounded-xl text-[11px] text-white/50">
                                  {t('channelInlineButtons.noButtonsMock')}
                               </div>
                            </Show>
                            <Show when={buttons().length > 0}>
                               <div class="grid grid-cols-2 gap-1 w-full">
                                  <For each={buttons()}>
                                     {(btn) => {
                                        const styleClass = 
                                          btn.style === 'primary' ? 'bg-[#3390ec]/90 text-white border-[#3b9bfb]/30' :
                                          btn.style === 'success' ? 'bg-[#34c759]/25 text-[#34c759] border-[#34c759]/30' :
                                          btn.style === 'danger' ? 'bg-[#ff3b30]/25 text-[#ff3b30] border-[#ff3b30]/30' :
                                          'bg-[#1c2c3d]/90 text-[#3390ec] border-[#29425a]';
                                        
                                        return (
                                           <div class="relative group w-full">
                                              <button class={`w-full py-2.5 rounded-xl text-[12px] font-black flex items-center justify-center gap-1.5 backdrop-blur-md shadow-md border ${styleClass} pointer-events-none`}>
                                                 <Show when={btn.emoji}><span>{btn.emoji}</span></Show>
                                                 <span>{btn.title}</span>
                                              </button>
                                           </div>
                                        );
                                     }}
                                  </For>
                               </div>
                            </Show>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </Motion.div>

          {/* Information Card (Breathtaking Premium Banner) */}
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} class="bg-[#1c1c1c] rounded-3xl border border-[#32ade6]/30 p-4 flex flex-col gap-3 relative overflow-hidden mt-4">
             <div class="absolute -top-10 -right-10 w-36 h-36 bg-[#32ade6]/10 rounded-full blur-3xl"></div>
             <div class="flex items-start gap-3 relative z-10 w-full">
                <span class="material-symbols-outlined text-[#32ade6] text-[24px] shrink-0 mt-0.5 ml-1">lightbulb</span>
                <div class="flex flex-col gap-2 w-full">
                   <h3 class="text-[14px] font-black text-[#32ade6]">{t('channelInlineButtons.guideTitle')}</h3>
                   <ul class="text-[12px] text-white/90 leading-relaxed space-y-2 list-none p-0 m-0">
                      <li class="flex items-start gap-1.5">
                         <span class="text-[#32ade6] mt-0.5 font-bold">•</span>
                         <span>{t('channelInlineButtons.guide1')}</span>
                      </li>
                      <li class="flex items-start gap-1.5">
                         <span class="text-[#32ade6] mt-0.5 font-bold">•</span>
                         <span>{t('channelInlineButtons.guide2')}</span>
                      </li>
                      <li class="flex items-start gap-1.5">
                         <span class="text-[#32ade6] mt-0.5 font-bold">•</span>
                         <span>{t('channelInlineButtons.guide3')}</span>
                      </li>
                      <li class="flex items-start gap-1.5">
                         <span class="text-[#32ade6] mt-0.5 font-bold">•</span>
                         <span>{t('channelInlineButtons.guide4')}</span>
                      </li>
                   </ul>
                </div>
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
            {t('common.cancel')}
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving()}
            class="flex-[2] h-14 bg-[#32ade6] hover:bg-[#2b96c8] text-black rounded-2xl font-bold text-[16px] shadow-[0_10px_25px_rgba(50,173,230,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Show when={!isSaving()} fallback={<span class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>}>
              {t('channelInlineButtons.saveSettings')}
              <span class="material-symbols-outlined text-[20px]">save</span>
            </Show>
          </button>
        </div>
      </Show>
    </div>
  );
};
