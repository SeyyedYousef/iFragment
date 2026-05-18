import { Component, createResource, onMount, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Motion } from '@motionone/solid';
import { backButton, hapticFeedback, initData } from '@tma.js/sdk-solid';
import { channelApi } from '@/shared/api/channel-management.js';
import { t, isRtl } from '@/shared/i18n/index.js';

export const ManagedChannelsPage: Component = () => {
  const navigate = useNavigate();
  
  // Get Telegram user info
  const userId = () => initData.user()?.id?.toString() || 'guest_user';

  // Fetch channels specific to THIS logged-in user
  const [channels] = createResource(
    userId,
    (id) => channelApi.getUserChannels(id)
  );

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => window.history.back());
    onCleanup(() => off());
  });

  const handleConnectNew = () => {
    hapticFeedback.impactOccurred('medium');
    navigate('/channel/connect');
  };

  return (
    <div class={`min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white ${isRtl() ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div class="px-5 pt-6 pb-4 bg-[#0f1014] sticky top-0 z-30 border-b border-[#1c1c1c]">
        <h1 class="text-[20px] font-black text-white leading-tight">{t('managedChannels.title')}</h1>
        <span class="text-[12px] text-on-surface-variant">{t('managedChannels.description')}</span>
      </div>

      <div class="px-5 pt-6 flex flex-col gap-6">
        
        {/* Connect New Channel Button */}
        <button 
          onClick={handleConnectNew}
          class="w-full bg-[#1c1c1c] border border-[#32ade6]/30 hover:border-[#32ade6] hover:bg-[#32ade6]/10 text-[#32ade6] rounded-2xl py-4 flex items-center justify-center gap-2 font-bold transition-all shadow-sm group"
        >
          <div class="w-8 h-8 rounded-full bg-[#32ade6]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-[20px]">add</span>
          </div>
          {t('managedChannels.connectNew')}
        </button>

        {/* Channel List */}
        <Show when={channels.loading}>
          <div class="flex items-center justify-center py-10">
             <span class="w-6 h-6 border-2 border-[#32ade6]/30 border-t-[#32ade6] rounded-full animate-spin" />
          </div>
        </Show>

        <Show 
          when={channels() && channels()!.length > 0} 
          fallback={
            !channels.loading ? (
              <div class="bg-[#1c1c1c] rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-3 border border-[#2a2a2a]">
                <div class="w-16 h-16 rounded-full bg-[#2a2a2a] flex items-center justify-center mb-2">
                  <span class="material-symbols-outlined text-[#8e8e93] text-3xl">campaign</span>
                </div>
                <h3 class="text-white font-bold text-[16px]">{t('managedChannels.noChannels')}</h3>
              </div>
            ) : null
          }
        >
          <div class="flex flex-col gap-3">
            <h2 class="text-[14px] font-bold text-[#8e8e93] uppercase tracking-wider pl-2 mb-1">{t('managedChannels.yourChannels')}</h2>
            <For each={channels()}>
              {(channel, i) => (
                <Motion.div
                  onClick={() => {
                    hapticFeedback.impactOccurred('light');
                    navigate(`/channel/${channel.id}`);
                  }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i() * 0.05 }}
                  class="bg-[#1c1c1c] rounded-3xl p-4 border border-[#2a2a2a] hover:border-[#32ade6]/50 cursor-pointer flex items-center gap-4 group transition-all"
                >
                  <div class="w-14 h-14 rounded-full bg-gradient-to-br from-[#32ade6] to-[#2b96c8] flex items-center justify-center font-black text-black text-xl shadow-lg group-hover:scale-105 transition-transform">
                    {channel.avatar}
                  </div>
                  <div class="flex-1 flex flex-col gap-1">
                    <span class="text-white font-bold text-[16px]">{channel.title}</span>
                    <span class="text-[13px] text-[#8e8e93]">{channel.members} {t('managedChannels.subscribers')}</span>
                  </div>
                  <div class="w-10 h-10 rounded-full bg-[#2a2a2a] group-hover:bg-[#32ade6] flex items-center justify-center transition-colors">
                    <span class={`material-symbols-outlined text-[#8e8e93] group-hover:text-black transition-colors ${isRtl() ? 'rotate-180' : ''}`}>chevron_right</span>
                  </div>
                </Motion.div>
              )}
            </For>
          </div>
        </Show>

      </div>
    </div>
  );
};
