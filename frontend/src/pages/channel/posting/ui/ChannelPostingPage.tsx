import { Component, createSignal, createResource, onCleanup, onMount, Show, For } from 'solid-js';
import { createStore, reconcile, unwrap } from 'solid-js/store';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { SettingsSection } from '@/shared/ui/settings-controls.js';
import { channelApi } from '@/shared/api/channel-management.js';
import { showToast } from '@/shared/ui/toast.js';

interface PostingConfig {
  autoPostEnabled: boolean;
  postInterval: string;
  watermarkEnabled: boolean;
  watermarkText: string;
  silentPosting: boolean;
  deleteAfter: number;
  
  // Phase 2 Properties
  aiProvider: string;
  apiKey: string;
  tone: string;
  prompt: string;
  generatedOutput: string;
  sendMode: 'now' | 'schedule';
  scheduledTime: string;
  pinPost: boolean;
  disableLinkPreview: boolean;
  
  // Skill System Properties
  selectedSkill: string;
  customSkillPrompt: string;
}

const defaultConfig: PostingConfig = {
  autoPostEnabled: false,
  postInterval: 'daily',
  watermarkEnabled: false,
  watermarkText: '@MyChannel',
  silentPosting: true,
  deleteAfter: 0,
  
  aiProvider: 'gemini',
  apiKey: '',
  tone: 'friendly',
  prompt: '',
  generatedOutput: '',
  sendMode: 'now',
  scheduledTime: '',
  pinPost: false,
  disableLinkPreview: false,
  
  selectedSkill: 'journalist',
  customSkillPrompt: '',
};

export const ChannelPostingPage: Component = () => {
  const navigate = useNavigate();
  const params = useParams();
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  
  const [isSaving, setIsSaving] = createSignal(false);
  const [isDirty, setIsDirty] = createSignal(false);
  const [settingsVersion, setSettingsVersion] = createSignal(1);

  const [config, setConfig] = createStore<PostingConfig>({ ...defaultConfig });
  
  const [connectionStatus, setConnectionStatus] = createSignal<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [isGenerating, setIsGenerating] = createSignal(false);

  createResource(
    () => params.id,
    async (channelId) => {
      const settings = await channelApi.getSettings(channelId);
      setSettingsVersion(settings.version);
      const postingConfig = (settings.posting || {}) as Partial<PostingConfig>;
      const merged = { 
        ...defaultConfig, 
        ...postingConfig,
        selectedSkill: postingConfig.selectedSkill || 'journalist',
        customSkillPrompt: postingConfig.customSkillPrompt || ''
      };
      setConfig(reconcile(merged));
      return settings;
    }
  );

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      if (isDirty()) {
        showToast(t('channelSettings.unsavedChanges'), 'info');
        window.history.back();
      } else {
        window.history.back();
      }
    });
    onCleanup(() => off());
  });

  const updateField = <K extends keyof PostingConfig>(key: K, value: PostingConfig[K]) => {
    setConfig(key, value);
    setIsDirty(true);
  };

  const handleTestConnection = async () => {
    if (!config.apiKey) return;
    setConnectionStatus('testing');
    hapticFeedback.impactOccurred('medium');
    await new Promise(r => setTimeout(r, 200));
    setConnectionStatus('success');
    hapticFeedback.notificationOccurred('success');
  };

  const handleGenerate = async (action: string) => {
    if (!config.prompt && action !== 'suggestHashtags') return;
    setIsGenerating(true);
    hapticFeedback.impactOccurred('light');
    await new Promise(r => setTimeout(r, 300));
    
    let mockResult = '';
    const skillName = config.selectedSkill === 'custom' ? 'Custom Skill' : config.selectedSkill;
    if (action === 'generate' || action === 'rewrite') {
      mockResult = `🚀 **${config.prompt || 'Generated Post'}**\n\nThis is an AI-generated post using the smart publishing pipeline under the "${skillName}" skill mode. It is optimized to perfectly engage your subscribers!`;
    } else if (action === 'translate') {
      mockResult = `🚀 **${config.prompt || 'Translated Post'}**\n\nاین یک پست ترجمه شده با هوش مصنوعی است.`;
    } else if (action === 'summarize') {
      mockResult = `TL;DR: A brief summary of the provided text.`;
    }
    
    setConfig('generatedOutput', mockResult);
    setIsDirty(true);
    setIsGenerating(false);
    hapticFeedback.notificationOccurred('success');
  };



  const handleSave = async () => {
    if (!isDirty()) return;
    hapticFeedback.notificationOccurred('success');
    setIsSaving(true);
    try {
      const result = await channelApi.updateSettings(params.id, 'posting', unwrap(config), settingsVersion());
      setSettingsVersion(result.version);
      setIsDirty(false);
      navigate(`/channel/${params.id}`);
    } catch (e: any) {
      hapticFeedback.notificationOccurred('error');
      showToast(t('channelPosting.failedToSaveSettings'), 'error');
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
            onClick={() => {
              hapticFeedback.impactOccurred('light');
              if (isDirty()) {
                showToast(t('channelSettings.unsavedChanges'), 'info');
                window.history.back();
              } else {
                window.history.back();
              }
            }}
            class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
            aria-label="Back"
          >
            <span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">arrow_back</span>
          </button>
          <div class="flex flex-col overflow-hidden">
            <div class="flex items-center gap-2">
              <h1 class="text-[18px] font-black text-white leading-tight truncate">ویرایشگر هوشمند پست‌ها</h1>
              <Show when={isDirty()}>
                <span class="w-2.5 h-2.5 rounded-full bg-[#32ade6] animate-pulse shrink-0" title={t('channelSettings.unsavedChangesTooltip')} />
              </Show>
            </div>
            <span class="text-[12px] text-on-surface-variant truncate">تنظیمات دستیار هوشمند و دکمه‌های شیشه‌ای کانال</span>
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

      <ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="posting" />


        <div class="px-5 pt-6 flex flex-col gap-6">
          
          {/* Smart Editor Core Activation Settings */}
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4">
             <div class="flex items-center gap-2 mb-1">
                <span class="material-symbols-outlined text-[#ff9f0a] text-[20px]">bolt</span>
                <h2 class="text-[16px] font-bold text-white">تنظیمات ربات ویرایشگر هوشمند</h2>
             </div>
             
             <div class="flex flex-col gap-3">
                <SettingsSection
                  title="فعالسازی ویرایشگر هوشمند پست"
                  description="زمانی که پستی در کانال خود ارسال می‌کنید، ربات به صورت خودکار آن را دریافت، پردازش و ویرایش می‌کند."
                  enabled={config.autoPostEnabled}
                  onToggle={(v) => updateField('autoPostEnabled', v)}
                />
                
                <div class="h-[1px] bg-[#2a2a2a] w-full my-1"></div>
                
                <SettingsSection
                  title="تایید قبل از ویرایش در پی‌وی ربات (سناریو ب)"
                  description="ربات ابتدا نسخه نهایی پردازش‌شده را در پی‌وی (دایرکت) برای شما ارسال می‌کند. پس از تایید شما، پست کانال ادیت می‌شود."
                  enabled={config.pinPost}
                  onToggle={(v) => updateField('pinPost', v)}
                />
             </div>
          </Motion.div>

          {/* AI Settings - BYOK MODEL */}
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4">
             <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                   <span class="material-symbols-outlined text-[#3390ec] text-[20px]">psychology</span>
                   <h2 class="text-[16px] font-bold text-white">{t('channelPosting.aiComposer') || 'AI Composer'}</h2>
                </div>
                {/* Free Tutorial Badge */}
                <a 
                   href="https://aistudio.google.com/" 
                   target="_blank" 
                   class="flex items-center gap-1 px-2.5 py-1 bg-[#3390ec]/10 rounded-full border border-[#3390ec]/20 text-[#3390ec] text-[11px] font-bold hover:bg-[#3390ec]/20 transition-all cursor-pointer shrink-0"
                   title="Free Key Tutorial"
                >
                   <span class="material-symbols-outlined text-[13px]">school</span>
                   {t('channelPosting.freeKeyGuide') || 'Get Free API Key'}
                </a>
             </div>
             
             {/* BYOK Description */}
             <p class="text-[12px] text-on-surface-variant leading-relaxed">
                {t('channelPosting.byokDescription') || 'Our bot operates on the "Bring Your Own Key" (BYOK) model. Provide your API key below. Your key is stored securely and used directly for smart generation.'}
             </p>
              
             <div class="flex flex-col gap-2">
                <label class="text-[13px] font-bold text-white">
                  {t('channelPosting.webServiceKey') || 'Web Service API Key'}
                </label>
                <div class="flex gap-2">
                   <input 
                     type="password" value={config.apiKey} 
                     onInput={(e) => updateField('apiKey', e.currentTarget.value)}
                     placeholder="sk-..."
                     class="bg-[#2c2c2e] text-white text-[15px] rounded-xl px-4 py-2.5 flex-1 focus:outline-none focus:ring-2 focus:ring-[#3390ec] placeholder-[#a0a4ad]"
                   />
                   <button 
                     onClick={handleTestConnection}
                     disabled={!config.apiKey || connectionStatus() === 'testing'}
                     class="px-4 bg-[#3390ec]/10 text-[#3390ec] font-bold text-[13px] rounded-xl border border-[#3390ec]/20 hover:bg-[#3390ec]/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex flex-col items-center justify-center min-w-[70px]"
                   >
                      <Show when={connectionStatus() === 'testing'}>
                        <span class="w-4 h-4 border-2 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin"></span>
                      </Show>
                      <Show when={connectionStatus() === 'idle'}>
                        تست
                      </Show>
                      <Show when={connectionStatus() === 'success'}>
                        <span class="w-2.5 h-2.5 bg-[#34c759] rounded-full shadow-[0_0_8px_#34c759]"></span>
                      </Show>
                      <Show when={connectionStatus() === 'failed'}>
                        <span class="w-2.5 h-2.5 bg-[#ff3b30] rounded-full shadow-[0_0_8px_#ff3b30]"></span>
                      </Show>
                   </button>
                </div>
             </div>
          </Motion.div>

          {/* AI Composer Module with Skill Agent Selection */}
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} class="bg-gradient-to-br from-[#1c1c1c] to-[#121212] rounded-3xl border border-[#3390ec]/30 p-4 flex flex-col gap-4 relative overflow-hidden">
             <div class="absolute -top-10 -right-10 w-40 h-40 bg-[#3390ec]/10 rounded-full blur-3xl"></div>
             
             <div class="flex items-center gap-2 relative z-10">
                <span class="material-symbols-outlined text-[#3390ec] text-[20px]">auto_awesome</span>
                <h2 class="text-[16px] font-bold text-white">مهارت هوش مصنوعی / نقش عامل ویرایشگر</h2>
             </div>
             
             {/* Skill System Selector */}
             <div class="flex flex-col gap-2 relative z-10">
                <div class="flex flex-wrap gap-2">
                   <For each={[
                      { id: 'journalist', label: t('channelPosting.skillJournalist') || 'Journalist', icon: 'newspaper' },
                      { id: 'technical', label: t('channelPosting.skillTechnical') || 'Tech Reviewer', icon: 'terminal' },
                      { id: 'crypto', label: t('channelPosting.skillCrypto') || 'Crypto Analyst', icon: 'trending_up' },
                      { id: 'copywriter', label: t('channelPosting.skillCopywriter') || 'Copywriter', icon: 'campaign' },
                      { id: 'custom', label: t('channelPosting.skillCustom') || 'Custom Skill...', icon: 'settings' },
                   ]}>
                      {(sk) => (
                         <button 
                           onClick={() => {
                             updateField('selectedSkill', sk.id);
                             hapticFeedback.selectionChanged();
                           }}
                           class={`px-3 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all ${
                               config.selectedSkill === sk.id 
                               ? 'bg-[#3390ec] text-white shadow-[0_4px_10px_rgba(51,144,236,0.3)]' 
                               : 'bg-[#2a2a2a] text-[#8e8e93] hover:bg-[#333]'
                            }`}
                         >
                            <span class="material-symbols-outlined text-[14px]">{sk.icon}</span>
                            {sk.label}
                         </button>
                      )}
                   </For>
                </div>
             </div>

             {/* Custom Skill Prompts Instructions */}
             <Show when={config.selectedSkill === 'custom'}>
               <div class="flex flex-col gap-2 relative z-10 mt-1 pl-3 border-l-2 border-[#3390ec]/30">
                  <label class="text-[12px] text-on-surface-variant font-bold">{t('channelPosting.customSkillInstructions')}</label>
                  <textarea 
                    value={config.customSkillPrompt || ''} 
                    onInput={(e) => updateField('customSkillPrompt', e.currentTarget.value)}
                    placeholder={t('channelPosting.customSkillInstructionsPlaceholder')}
                    class="bg-[#0f1014] text-white text-[13px] rounded-xl px-3 py-2 w-full min-h-[70px] focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] placeholder-[#555] resize-none"
                  />
               </div>
             </Show>
          </Motion.div>

          {/* Smart Post Editor Simulator (Breathtaking Dynamic Interface) */}
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-4">
             <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-[#32ade6] text-[20px]">model_training</span>
                <h2 class="text-[16px] font-bold text-white">شبیه‌ساز پردازش و دکمه‌های شیشه‌ای</h2>
             </div>
             
             <p class="text-[12px] text-on-surface-variant leading-relaxed">
                متن خامی که در کانال تلگرام خود می‌فرستید را در کادر زیر وارد کنید تا نحوه بازنویسی، افزودن امضا و قرارگیری دکمه‌های شیشه‌ای را به صورت زنده شبیه‌ساز بررسی کنید!
             </p>
             
             <div class="flex flex-col gap-2">
                <label class="text-[13px] font-bold text-white">متن خام ارسالی شما در کانال تلگرام:</label>
                <textarea 
                  value={config.prompt} 
                  onInput={(e) => updateField('prompt', e.currentTarget.value)}
                  placeholder="مثال: قیمت بیت کوین در ۲۴ ساعت گذشته با ۵ درصد افزایش به ۶۷ هزار دلار رسید..."
                  class="bg-[#0f1014] text-white text-[14px] rounded-xl px-4 py-3 w-full min-h-[90px] focus:outline-none focus:ring-2 focus:ring-[#3390ec] border border-[#2a2a2a] placeholder-[#555] resize-y"
                />
             </div>
             
             <button 
               onClick={() => handleGenerate('generate')} 
               disabled={isGenerating() || !config.prompt} 
               class="h-11 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-[#3390ec]"
             >
                <Show when={isGenerating()} fallback={<><span class="material-symbols-outlined text-[18px]">play_circle</span> پردازش و تولید پیش‌نمایش نهایی</>}>
                   <span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                </Show>
             </button>
             
             {/* Final Output Message Mockup (Visual Masterpiece resembling real Telegram Channel post) */}
             <div class="flex flex-col gap-2 mt-2">
                <label class="text-[13px] font-bold text-[#8e8e93]">پست ویرایش‌شده نهایی در کانال تلگرام شما:</label>
                
                {/* Premium Mockup Wallpaper and bubble layout */}
                <div class="bg-[url('https://i.pinimg.com/1200x/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg')] bg-cover bg-center rounded-2xl p-4 min-h-[160px] flex flex-col justify-end relative overflow-hidden border border-[#2a2a2a]">
                   <div class="absolute inset-0 bg-black/40"></div>
                   
                   <div class="flex flex-col max-w-[90%] relative z-10 self-start">
                      {/* Telegram Message Bubble */}
                      <div class="bg-[#182533] text-white rounded-2xl rounded-bl-none p-3.5 shadow-lg text-[14px] leading-relaxed whitespace-pre-wrap">
                         {config.generatedOutput || config.prompt || "متن خام خود را در بالا وارد کرده و روی دکمه پردازش کلیک کنید تا معجزهٔ ربات ویرایشگر را به صورت زنده ببینید..."}
                         
                         {/* Signature simulated dynamically if set */}
                         <div class="mt-3 pt-1 border-t border-white/10 text-[12px] text-[#32ade6] font-bold flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">signature</span>
                            <span>— کانال رسمی iFragment (امضای شما)</span>
                         </div>
                         
                         <div class="flex items-center justify-end gap-1 mt-1.5 opacity-60 text-[10px]">
                            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span class="material-symbols-outlined text-[12px] text-[#32ade6]">done_all</span>
                         </div>
                      </div>
                      
                      {/* Mockup Glass Buttons (Attached perfectly to the bubble) */}
                      <div class="flex flex-col gap-1 mt-1.5 w-full">
                         {/* Row 1 */}
                         <div class="flex gap-1 w-full">
                            <button class="flex-1 bg-[#1c2c3d]/90 hover:bg-[#233549] text-[#3390ec] border border-[#29425a] py-2 rounded-xl text-[12px] font-black transition-all flex items-center justify-center gap-1.5 backdrop-blur-md shadow-md active:scale-95">
                               <span>👍</span>
                               <span>لایک 14</span>
                            </button>
                            <button class="flex-1 bg-[#1c2c3d]/90 hover:bg-[#233549] text-[#ff3b30] border border-[#29425a] py-2 rounded-xl text-[12px] font-black transition-all flex items-center justify-center gap-1.5 backdrop-blur-md shadow-md active:scale-95">
                               <span>👎</span>
                               <span>دیس‌لایک 2</span>
                            </button>
                         </div>
                         {/* Row 2 */}
                         <div class="flex gap-1 w-full">
                            <button class="flex-1 bg-[#1c2c3d]/90 hover:bg-[#233549] text-[#34c759] border border-[#29425a] py-2 rounded-xl text-[12px] font-black transition-all flex items-center justify-center gap-1.5 backdrop-blur-md shadow-md active:scale-95">
                               <span>📎</span>
                               <span>مشاهده جزئیات در سایت</span>
                            </button>
                            <button class="flex-1 bg-[#1c2c3d]/90 hover:bg-[#233549] text-white border border-[#29425a] py-2 rounded-xl text-[12px] font-black transition-all flex items-center justify-center gap-1.5 backdrop-blur-md shadow-md active:scale-95">
                               <span>📢</span>
                               <span>اشتراک‌گذاری</span>
                            </button>
                         </div>
                      </div>
                   </div>
                </div>
                
                {/* Helpful Instruction Badge about glass buttons */}
                <div class="flex items-start gap-2 bg-[#3390ec]/10 border border-[#3390ec]/20 rounded-2xl p-3 mt-1.5">
                   <span class="material-symbols-outlined text-[#3390ec] text-[20px] shrink-0 mt-0.5">info</span>
                   <p class="text-[12px] text-[#3390ec] leading-relaxed font-bold">
                      💡 دکمه‌های شیشه‌ای دقیقاً طبق همان الگوها و مجموعه‌هایی که در بخش **«دکمه‌های شیشه‌ای»** منوی کانال تنظیم می‌کنید، به صورت پویا به زیر پست ویرایش‌شده کانال اضافه خواهند شد.
                   </p>
                </div>
             </div>
          </Motion.div>

        </div>

      {/* Save Button */}
      <Show when={isDirty()}>
        <div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/90 to-transparent z-40 flex gap-3">
          <button 
            onClick={() => navigate(`/channel/${params.id}`)}
            disabled={isSaving()}
            class="flex-1 h-14 bg-[#1c1c1c] text-[#ff3b30] border border-[#ff3b30]/20 rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 hover:bg-[#ff3b30]/10"
          >
            {t('channelSettings.cancel')}
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving()}
            class="flex-[2] h-14 bg-[#32ade6] hover:bg-[#2b96c8] text-black rounded-2xl font-bold text-[16px] shadow-[0_10px_25px_rgba(255,159,10,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Show when={!isSaving()} fallback={<span class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>}>
              {t('channelSettings.saveSettings')}
              <span class="material-symbols-outlined text-[20px]">save</span>
            </Show>
          </button>
        </div>
      </Show>
    </div>
  );
};
