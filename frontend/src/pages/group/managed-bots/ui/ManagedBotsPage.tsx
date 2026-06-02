import { Component, createSignal, createResource, onMount, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t, isRtl } from '@/shared/i18n/index.js';
import { botApi } from '@/shared/api/bot-management.js';
import type { ManagedBot } from '@/shared/api/bot-management.js';

export const ManagedBotsPage: Component = () => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [botToken, setBotToken] = createSignal('');
  const [isCreating, setIsCreating] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal('');

  const [bots, { refetch }] = createResource(botApi.listBots);

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      if (showCreateModal()) {
        setShowCreateModal(false);
      } else {
        navigate('/dashboard');
      }
    });
    onCleanup(() => off());
  });

  const handleCreateBot = async () => {
    const token = botToken().trim();
    if (!token) {
      setErrorMsg('Please enter a valid bot token');
      return;
    }

    // Basic token format validation (numbers:alphanumeric)
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
      setErrorMsg('Invalid token format. Get your token from @BotFather');
      return;
    }

    setIsCreating(true);
    setErrorMsg('');

    try {
      // Extract bot ID from token
      const botIdStr = token.split(':')[0];
      const botIdNum = parseInt(botIdStr, 10);

      await botApi.registerBot({
        token,
        username: `bot_${botIdStr}`, // Will be updated by backend after verifying with Telegram
        name: 'New Bot',
        bot_id: botIdNum,
      });

      hapticFeedback.notificationOccurred('success');
      setBotToken('');
      setShowCreateModal(false);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Failed to register bot. Please try again.';
      setErrorMsg(msg);
      hapticFeedback.notificationOccurred('error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-24 relative text-white">
      {/* Header */}
      <div class="px-6 pt-6 pb-5 sticky top-0 bg-[#0f1014]/90 backdrop-blur-xl z-30 border-b border-[#1c1c1c] flex items-center gap-3">
        <button 
          onClick={() => { hapticFeedback.impactOccurred('light'); navigate('/dashboard'); }}
          class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
          aria-label="Back"
        >
          <span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">arrow_back</span>
        </button>
        <div class="flex flex-col gap-0.5 min-w-0">
          <h1 class="text-xl font-black text-white tracking-tight truncate">{t('managedBots.title')}</h1>
          <p class="text-[11px] font-medium text-[#8e8e93] leading-snug truncate">
            {t('managedBots.description')}
          </p>
        </div>
      </div>

      <div class="px-5 mt-6 space-y-6">
        {/* Create Bot Button */}
        <Motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, easing: [0.22, 1, 0.36, 1] }}
          onClick={() => { setShowCreateModal(true); hapticFeedback.impactOccurred('medium'); }}
          class="w-full group relative overflow-hidden rounded-[2rem] p-[1.5px] bg-gradient-to-br from-[#3390ec] via-[#3390ec] to-[#2b7bc9] shadow-[0_20px_40px_rgba(51,144,236,0.25)] active:scale-95 transition-all"
        >
          <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div class="bg-[#1c1c1c]/40 backdrop-blur-md rounded-[1.9rem] p-5 flex items-center gap-4 relative z-10">
            <div class="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/10">
              <span class="material-symbols-outlined text-white text-[32px]">add_circle</span>
            </div>
            <div class="flex flex-col items-start gap-0.5">
              <span class="text-lg font-black text-white leading-tight">{t('managedBots.createBtn')}</span>
              <span class="text-[12px] text-white/60 font-medium tracking-wide uppercase">Connect BotFather API</span>
            </div>
            <div class={`ms-auto ${isRtl() ? 'rotate-180' : ''}`}>
              <span class="material-symbols-outlined text-white/40">arrow_forward_ios</span>
            </div>
          </div>
        </Motion.button>

        {/* Your Bots Section */}
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between px-1">
            <h2 class="text-[13px] font-black text-[#8e8e93] uppercase tracking-[0.15em]">
              {t('managedBots.yourBots')}
            </h2>
            <Show when={bots() && bots()!.length > 0}>
               <span class="bg-[#3390ec]/10 text-[#3390ec] text-[11px] font-black px-2 py-0.5 rounded-full border border-[#3390ec]/20">{bots()?.length} BOTS</span>
            </Show>
          </div>

          <Show when={bots.loading}>
            <div class="flex flex-col items-center justify-center py-20 gap-4">
              <div class="relative w-12 h-12">
                <div class="absolute inset-0 border-4 border-[#3390ec]/20 rounded-full"></div>
                <div class="absolute inset-0 border-4 border-[#3390ec] border-t-transparent rounded-full animate-spin"></div>
              </div>
              <span class="text-[13px] font-bold text-[#8e8e93] animate-pulse">Synchronizing with Telegram...</span>
            </div>
          </Show>

          <Show when={!bots.loading && (!bots() || bots()!.length === 0)}>
            <Motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              class="bg-[#1c1c1c] rounded-[2rem] border border-[#2a2a2a] p-10 flex flex-col items-center justify-center text-center gap-4"
            >
              <div class="w-20 h-20 rounded-full bg-[#2c2c2e] flex items-center justify-center border border-[#3a3a3c]">
                <span class="material-symbols-outlined text-[48px] text-[#3a3a3c]">smart_toy</span>
              </div>
              <div class="flex flex-col gap-1">
                <p class="text-[17px] text-white font-black">{t('managedBots.noBots')}</p>
                <p class="text-[13px] text-[#8e8e93] font-medium leading-relaxed max-w-[200px]">
                  Create your first bot to start managing Telegram groups professionally
                </p>
              </div>
            </Motion.div>
          </Show>

          <div class="grid grid-cols-1 gap-3">
            <For each={bots() || []}>
              {(bot: ManagedBot, index) => (
                <Motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index() * 0.08 }}
                  onClick={() => { hapticFeedback.impactOccurred('light'); navigate(`/bot/${bot.id}/manage`); }}
                  class="bg-[#1c1c1c] rounded-[1.75rem] border border-[#2a2a2a] p-4 flex items-center gap-4 hover:bg-[#222] transition-all cursor-pointer active:scale-[0.98] group"
                >
                  {/* Bot Avatar */}
                  <div class={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden ${
                    bot.status === 'active'
                      ? 'bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/20'
                      : 'bg-[#2c2c2e] border border-[#3a3a3c]'
                  }`}>
                    <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    <span class={`material-symbols-outlined text-[28px] relative z-10 ${
                      bot.status === 'active' ? 'text-[#3390ec]' : 'text-[#555]'
                    }`}>smart_toy</span>
                  </div>

                  {/* Bot Info */}
                  <div class="flex flex-col flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-[16px] font-black text-white truncate">{bot.bot_name}</span>
                      <div class={`w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px_rgba(52,199,89,0.5)] ${
                        bot.status === 'active' ? 'bg-[#34c759]' : 'bg-[#ff3b30]'
                      }`} />
                    </div>
                    <span class="text-[13px] font-bold text-[#8e8e93]">@{bot.bot_username}</span>
                  </div>

                  {/* Manage Button */}
                  <div class={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isRtl() ? 'rotate-180' : ''
                  } group-hover:bg-[#3390ec]/10 group-hover:translate-x-1`}>
                    <span class="material-symbols-outlined text-[#3390ec] text-[24px]">chevron_right</span>
                  </div>
                </Motion.div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Create Bot Modal */}
      <Show when={showCreateModal()}>
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
        >
          <Motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }}
            class="w-full bg-[#1c1c1c] rounded-t-[2rem] border-t border-[#2a2a2a] p-5"
          >
            <div class="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />

            <h3 class="text-[18px] font-black text-white mb-1">Connect Your Bot</h3>
            <p class="text-[13px] text-[#8e8e93] mb-5">
              Paste the bot token from @BotFather to connect your bot to iFragment
            </p>

            {/* Steps */}
            <div class="space-y-3 mb-5">
              <div class="flex items-start gap-3">
                <div class="w-7 h-7 rounded-full bg-[#3390ec]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span class="text-[12px] font-black text-[#3390ec]">1</span>
                </div>
                <div>
                  <p class="text-[13px] text-white font-medium">Open @BotFather in Telegram</p>
                  <p class="text-[11px] text-[#8e8e93]">Send /newbot or use an existing bot</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <div class="w-7 h-7 rounded-full bg-[#3390ec]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span class="text-[12px] font-black text-[#3390ec]">2</span>
                </div>
                <div>
                  <p class="text-[13px] text-white font-medium">Copy the bot token</p>
                  <p class="text-[11px] text-[#8e8e93]">It looks like: 123456:ABCdefGhi...</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <div class="w-7 h-7 rounded-full bg-[#3390ec]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span class="text-[12px] font-black text-[#3390ec]">3</span>
                </div>
                <div>
                  <p class="text-[13px] text-white font-medium">Paste it below</p>
                  <p class="text-[11px] text-[#8e8e93]">We'll encrypt it with AES-256</p>
                </div>
              </div>
            </div>

            <Show when={errorMsg()}>
              <div class="bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-[#ff3b30] rounded-xl px-4 py-2.5 text-[12px] font-bold mb-3 flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px]">error</span>
                {errorMsg()}
              </div>
            </Show>

            <input
              type="password"
              value={botToken()}
              onInput={(e) => setBotToken(e.currentTarget.value)}
              placeholder="Paste your bot token here..."
              class="w-full bg-[#2c2c2e] text-white text-[14px] rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#3390ec] placeholder:text-[#555] mb-4"
            />

            <button
              onClick={handleCreateBot}
              disabled={isCreating() || !botToken().trim()}
              class="w-full h-14 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-2xl font-bold text-[16px] transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(51,144,236,0.3)]"
            >
              <Show when={!isCreating()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
                <span class="material-symbols-outlined text-[20px]">link</span>
                Connect Bot
              </Show>
            </button>
          </Motion.div>
        </Motion.div>
      </Show>
    </div>
  );
};
