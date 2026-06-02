import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Motion } from '@motionone/solid';
import { backButton, hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { showToast } from '@/shared/ui/toast.js';
import { t, isRtl } from '@/shared/i18n/index.js';
import { channelApi } from '@/shared/api/channel-management.js';

export const ConnectChannelPage: Component = () => {
  const navigate = useNavigate();
  const [channelInput, setChannelInput] = createSignal('');
  const [isVerifying, setIsVerifying] = createSignal(false);

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => window.history.back());
    onCleanup(() => off());
  });

  const handleConnect = async () => {
    if (!channelInput().trim()) {
      showToast(t('connectChannel.errorEmpty') || 'Channel username or ID cannot be empty', 'error');
      hapticFeedback.notificationOccurred('error');
      return;
    }

    hapticFeedback.impactOccurred('medium');
    setIsVerifying(true);

    try {
      await channelApi.connectChannel('auto', channelInput().trim());
      showToast(t('connectChannel.success') || 'Channel connected successfully!', 'success');
      hapticFeedback.notificationOccurred('success');
      navigate('/managed-channels', { replace: true });
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to connect channel';
      showToast(errMsg, 'error');
      hapticFeedback.notificationOccurred('error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOpenTelegram = () => {
    hapticFeedback.impactOccurred('light');
    openTelegramLink('https://t.me/iFragmentBot?startchannel=true');
  };

  return (
    <div class={`min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white ${isRtl() ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div class="px-5 pt-6 pb-4 bg-[#0f1014]/80 backdrop-blur-md sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center gap-3">
        <button 
          onClick={() => { hapticFeedback.impactOccurred('light'); window.history.back(); }}
          class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
          aria-label="Back"
        >
          <span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">arrow_back</span>
        </button>
        <div class="flex flex-col overflow-hidden">
          <h1 class="text-[18px] font-black text-white leading-tight truncate">{t('connectChannel.title') || 'Connect Channel'}</h1>
          <span class="text-[12px] text-on-surface-variant truncate">{t('connectChannel.subtitle') || 'Onboard a new Telegram channel'}</span>
        </div>
      </div>

      <div class="px-5 pt-6 flex flex-col gap-6">
        
        {/* Step 1: Add Bot */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} class="bg-[#1c1c1c] rounded-3xl p-5 border border-[#2a2a2a] flex flex-col gap-3">
          <div class="flex items-center gap-3 mb-1">
             <div class="w-8 h-8 rounded-full bg-[#32ade6] text-black font-black flex items-center justify-center text-[15px]">1</div>
             <h2 class="text-[16px] font-bold text-white">{t('connectChannel.step1Title') || 'Add Bot to Channel'}</h2>
          </div>
          <p class="text-[13px] text-[#8e8e93] leading-relaxed">
            {t('connectChannel.step1Desc') || 'Add our official bot to your Telegram channel as an administrator with post/edit permissions.'}
          </p>
          <button 
            onClick={handleOpenTelegram}
            class="mt-2 w-full bg-[#2a2a2a] hover:bg-[#333333] border border-[#3a3a3c] text-white rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold transition-all text-[14px]"
          >
            <span class="material-symbols-outlined text-[18px]">open_in_new</span>
            {t('connectChannel.openTelegram') || 'Open in Telegram'}
          </button>
        </Motion.div>

        {/* Step 2: Enter Channel & Connect */}
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} class="bg-[#1c1c1c] rounded-3xl p-5 border border-[#2a2a2a] flex flex-col gap-3">
          <div class="flex items-center gap-3 mb-1">
             <div class="w-8 h-8 rounded-full bg-[#32ade6] text-black font-black flex items-center justify-center text-[15px]">2</div>
             <h2 class="text-[16px] font-bold text-white">{t('connectChannel.step2Title') || 'Submit Channel Link'}</h2>
          </div>
          <p class="text-[13px] text-[#8e8e93] leading-relaxed mb-1">
            {t('connectChannel.step2Desc') || 'Enter your public channel username (e.g. @my_channel) or private channel invite link to verify.'}
          </p>
          
          <input 
            type="text" 
            value={channelInput()} 
            onInput={(e) => setChannelInput(e.currentTarget.value)}
            placeholder={t('connectChannel.inputPlaceholder') || 'e.g. @channel_username'}
            class="bg-[#0f1014] border border-[#3a3a3c] text-white text-[15px] rounded-xl px-4 py-3.5 w-full focus:outline-none focus:border-[#32ade6] placeholder-[#5a5a5e] transition-colors"
          />

          <button 
            onClick={handleConnect}
            disabled={isVerifying() || !channelInput().trim()}
            class="mt-3 w-full bg-[#32ade6] text-black disabled:bg-[#32ade6]/40 disabled:text-black/50 rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold transition-all text-[15px]"
          >
            <Show when={!isVerifying()} fallback={<span class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>}>
              {t('connectChannel.connectBtn') || 'Verify & Onboard Channel'}
            </Show>
          </button>
        </Motion.div>

      </div>
    </div>
  );
};
