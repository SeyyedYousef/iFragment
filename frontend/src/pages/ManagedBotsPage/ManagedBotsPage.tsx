import { Component, createSignal, createResource, onMount, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
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
      <div class="px-5 pt-6 pb-4 sticky top-0 bg-[#0f1014]/90 backdrop-blur-md z-30 border-b border-[#1c1c1c]">
        <h1 class="text-2xl font-black text-white">{t('managedBots.title')}</h1>
        <p class="text-[13px] font-medium text-[#8e8e93] leading-snug mt-1 max-w-[90%]">
          {t('managedBots.description')}
        </p>
      </div>

      <div class="px-5 mt-4 space-y-4">
        {/* Create Bot Button */}
        <Motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => { setShowCreateModal(true); hapticFeedback.impactOccurred('medium'); }}
          class="w-full bg-gradient-to-br from-[#3390ec] to-[#2b7bc9] rounded-3xl p-5 flex items-center gap-4 shadow-[0_10px_30px_rgba(51,144,236,0.25)] hover:shadow-[0_10px_40px_rgba(51,144,236,0.35)] transition-all active:scale-[0.98]"
        >
          <div class="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
            <span class="material-symbols-outlined text-white text-[28px]">add</span>
          </div>
          <div class="flex flex-col items-start gap-0.5">
            <span class="text-[16px] font-bold text-white">{t('managedBots.createBtn')}</span>
            <span class="text-[12px] text-white/60">Connect your BotFather bot</span>
          </div>
        </Motion.button>

        {/* Your Bots Section */}
        <div class="flex flex-col gap-2">
          <h2 class="text-[14px] font-bold text-[#8e8e93] uppercase tracking-wider px-1">
            {t('managedBots.yourBots')}
          </h2>

          <Show when={bots.loading}>
            <div class="flex items-center justify-center py-16">
              <span class="w-6 h-6 border-2 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin" />
            </div>
          </Show>

          <Show when={!bots.loading && (!bots() || bots()!.length === 0)}>
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              class="flex flex-col items-center justify-center py-20 gap-3"
            >
              <span class="material-symbols-outlined text-[56px] text-[#3a3a3a]">smart_toy</span>
              <p class="text-[14px] text-[#8e8e93] font-medium">{t('managedBots.noBots')}</p>
              <p class="text-[12px] text-[#555] text-center max-w-[80%]">
                Create your first bot to start managing Telegram groups professionally
              </p>
            </Motion.div>
          </Show>

          <For each={bots() || []}>
            {(bot: ManagedBot, index) => (
              <Motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index() * 0.05 }}
                class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex items-center gap-3 hover:bg-[#222] transition-colors"
              >
                {/* Bot Avatar */}
                <div class={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  bot.status === 'active'
                    ? 'bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5'
                    : 'bg-[#2c2c2e]'
                }`}>
                  <span class={`material-symbols-outlined text-[24px] ${
                    bot.status === 'active' ? 'text-[#3390ec]' : 'text-[#555]'
                  }`}>smart_toy</span>
                </div>

                {/* Bot Info */}
                <div class="flex flex-col flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-[15px] font-bold text-white truncate">{bot.bot_name}</span>
                    <span class={`w-2 h-2 rounded-full shrink-0 ${
                      bot.status === 'active' ? 'bg-[#34c759]' : 'bg-[#ff3b30]'
                    }`} />
                  </div>
                  <span class="text-[12px] text-[#8e8e93]">@{bot.bot_username}</span>
                </div>

                {/* Manage Button */}
                <button
                  onClick={() => {
                    hapticFeedback.impactOccurred('light');
                    navigate(`/bot/${bot.id}/manage`);
                  }}
                  class="bg-[#3390ec]/10 border border-[#3390ec]/20 text-[#3390ec] text-[13px] font-bold px-4 py-2.5 rounded-xl hover:bg-[#3390ec]/20 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {t('managedBots.manage')}
                  <span class="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </Motion.div>
            )}
          </For>
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
