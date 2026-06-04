import { Component, createSignal, For, Show, createResource } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { SectionHeader } from '@/shared/ui/section-header.js';
import { userClan, setUserClan } from '@/shared/store/airdrop.js';
import { joinClan, leaveClan, getTopClans } from '@/shared/api/profile.js';

export const ClanView: Component = () => {
  const [usernameInput, setUsernameInput] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal('');
  const [topClans] = createResource(getTopClans);

  const formatPool = (members: number) => {
    const score = members * 1500;
    if (score >= 1_000_000) return (score / 1_000_000).toFixed(1) + 'M';
    if (score >= 1_000) return (score / 1_000).toFixed(0) + 'K';
    return score.toString();
  };

  const handleJoin = async () => {
    if (!usernameInput().trim() || loading()) return;
    setErrorMsg('');
    setLoading(true);
    try {
      hapticFeedback.impactOccurred('medium');
      const clanDetails = await joinClan(usernameInput().trim());
      setUserClan(clanDetails);
      setUsernameInput('');
    } catch (e: any) {
      setErrorMsg(e.message || t('airdrop.clan.joinFailed'));
      hapticFeedback.notificationOccurred('error');
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (loading()) return;
    setLoading(true);
    try {
      hapticFeedback.notificationOccurred('success');
      await leaveClan();
      setUserClan(null);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-8 animate-fade-in no-scrollbar">
      <SectionHeader icon="shield" title={t('airdrop.clan.title')} subtitle={t('airdrop.clan.subtitle')} gradient="#ef4444, #f97316" shadowColor="rgba(239,68,68,0.3)" />

      {/* User Clan Section */}
      <Show
        when={userClan()}
        fallback={
          <div class="bg-[#1c1c1e]/80 backdrop-blur-lg rounded-2xl p-5 border border-white/[0.06] mb-5">
            <h3 class="text-white font-bold text-sm mb-3">{t('airdrop.clan.joinClanBtn')}</h3>
            <p class="text-[#8e8e93] text-xs mb-4 font-medium leading-relaxed">{t('airdrop.clan.channelPrompt')}</p>
            <div class="flex gap-2">
              <input
                type="text"
                value={usernameInput()}
                onInput={(e) => setUsernameInput(e.target.value)}
                placeholder="@username"
                class="flex-1 bg-[#2c2c2e] text-white font-semibold text-sm py-3 px-4 rounded-xl border border-white/[0.04] focus:border-red-500/40 focus:outline-none placeholder:text-[#555]"
              />
              <button
                onClick={handleJoin}
                disabled={loading() || !usernameInput().trim()}
                class={`px-5 py-3 rounded-xl font-bold text-xs transition-all ${
                  usernameInput().trim() && !loading()
                    ? 'bg-[#3390ec] text-white active:scale-95 shadow-[0_2px_10px_rgba(51,144,236,0.3)]'
                    : 'bg-[#2c2c2e] text-[#555]'
                }`}
              >
                {loading() ? '...' : t('airdrop.clan.searchAndJoin')}
              </button>
            </div>
            {errorMsg() && <div class="text-red-500 text-[11px] font-bold mt-2.5 px-1">{errorMsg()}</div>}
          </div>
        }
      >
        {(clan) => (
          <div class="bg-[#1c1c1e]/80 backdrop-blur-lg rounded-2xl p-5 border border-red-500/20 mb-5 relative overflow-hidden">
            <div class="flex items-center gap-4 mb-5">
              <img src={clan().channel_photo || "https://telegram.org/img/t_logo.png"} alt={clan().chat_title} class="w-14 h-14 rounded-2xl object-cover border border-white/10" />
              <div>
                <h4 class="text-white font-black text-base">{clan().chat_title}</h4>
                <div class="text-red-400 font-bold text-xs mt-0.5">@{clan().channel_username}</div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 bg-[#2c2c2e]/40 rounded-xl p-3 mb-5 border border-white/[0.02]">
              <div class="text-center border-r border-white/5">
                <div class="text-white font-black text-sm">{clan().members_count.toLocaleString('en-US')}</div>
                <div class="text-[#8e8e93] text-[9px] uppercase tracking-wider mt-0.5">{t('airdrop.clan.membersLabel')}</div>
              </div>
              <div class="text-center">
                <div class="text-amber-400 font-black text-sm">{t('airdrop.clan.active')}</div>
                <div class="text-[#8e8e93] text-[9px] uppercase tracking-wider mt-0.5">{t('airdrop.clan.clanStatus')}</div>
              </div>
            </div>

            <button
              onClick={handleLeave}
              disabled={loading()}
              class="w-full bg-red-500/10 border border-red-500/20 text-red-500 font-bold py-3.5 rounded-xl active:scale-[0.98] transition-transform text-xs"
            >
              {loading() ? '...' : t('airdrop.clan.leaveClan')}
            </button>
          </div>
        )}
      </Show>

      {/* Weekly Battle Banner */}
      <div class="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-2xl p-4 mb-5 flex items-center gap-3">
        <span class="material-symbols-outlined text-red-400 text-3xl" style={{ 'font-variation-settings': '"FILL" 1' }}>swords</span>
        <div>
          <div class="text-white font-bold text-sm">{t('airdrop.clan.weeklyBattle')}</div>
          <div class="text-[#8e8e93] text-[11px] mt-0.5">{t('airdrop.tasks.timeLeft')}</div>
        </div>
      </div>

      {/* Top Clans */}
      <h2 class="text-white font-bold text-sm mb-3 flex items-center gap-2 px-1">
        <span class="material-symbols-outlined text-amber-400 text-lg" style={{ 'font-variation-settings': '"FILL" 1' }}>emoji_events</span>
        {t('airdrop.clan.topClans')}
      </h2>
      <div class="bg-[#1c1c1e]/80 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/[0.04]">
        <Show when={!topClans.loading} fallback={
          <div class="flex items-center justify-center py-10">
            <div class="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <For each={topClans() || []} fallback={
            <div class="text-[#8e8e93] text-xs text-center py-8">{t('airdrop.clan.noClans')}</div>
          }>
            {(clan, i) => (
              <div class={`flex items-center justify-between px-4 py-3.5 ${i() < (topClans()?.length || 0) - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                <div class="flex items-center gap-3">
                  <div class={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    i() === 0 ? 'bg-amber-400 text-black' : i() === 1 ? 'bg-gray-300 text-black' : i() === 2 ? 'bg-[#cd7f32] text-white' : 'bg-[#2c2c2e] text-[#8e8e93]'
                  }`}>{i() + 1}</div>
                  {clan.channel_photo ? (
                    <img src={clan.channel_photo} alt={clan.chat_title} class="w-8 h-8 rounded-xl object-cover border border-white/10" />
                  ) : (
                    <div class="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-xs">🛡️</div>
                  )}
                  <div>
                    <div class="text-white font-bold text-[13px]">{clan.chat_title}</div>
                    <div class="text-[11px] text-[#8e8e93]">{clan.members_count.toLocaleString('en-US')} {t('airdrop.clan.members')}</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-amber-400 font-black text-sm">{formatPool(clan.members_count)}</div>
                  <div class="text-[10px] text-[#8e8e93]">{t('airdrop.clan.pool')}</div>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};
