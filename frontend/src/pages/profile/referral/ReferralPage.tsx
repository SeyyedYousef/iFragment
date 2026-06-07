import { Component, createSignal, onMount, onCleanup, For, Show, createMemo, createResource } from 'solid-js';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { createQuery } from '@tanstack/solid-query';
import QRCode from 'qrcode';
import { t, formatNumber } from '@/shared/i18n/index.js';
import { getReferralInfo } from '@/shared/api/profile.js';
import { copyToClipboard, shareToStory, switchInlineQuery, showScanQrPopup, showAlert, openTelegramLink } from '@/shared/lib/telegram-native.js';

export const ReferralPage: Component = () => {
  const [showQrModal, setShowQrModal] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  const referralQuery = createQuery(() => ({
    queryKey: ['profile', 'referral'],
    queryFn: getReferralInfo,
    staleTime: 60000,
  }));

  const refInfo = () => referralQuery.data || null;

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => window.history.back());
    onCleanup(() => {
      off();
      try { backButton.hide(); } catch {}
    });
  });

  const referralLink = createMemo(() => {
    const code = refInfo()?.referralCode;
    if (!code) return '';
    return `https://t.me/iFragmentBot?start=${code}`;
  });

  const [qrCodeUrl] = createResource(referralLink, async (link) => {
    if (!link) return '';
    try {
      return await QRCode.toDataURL(link, {
        margin: 1,
        width: 250,
        color: {
          dark: '#1c1c1c',
          light: '#ffffff',
        },
      });
    } catch (err) {
      console.error('Failed to generate QR code', err);
      return '';
    }
  });

  const handleCopyLink = async () => {
    const link = referralLink();
    if (!link) return;
    const success = await copyToClipboard(link);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareStory = () => {
    const link = referralLink();
    if (!link) return;
    try { hapticFeedback.impactOccurred('medium'); } catch {}
    shareToStory(
      window.location.origin + '/promo_banner.png',
      {
        text: 'Join me on iFragment and get free FRG tokens! 💎🚀',
        widget_link: {
          url: link,
          name: t('profile.share') || 'Join Now'
        }
      }
    );
  };

  const handleShareChat = () => {
    const link = referralLink();
    if (!link) return;
    try { hapticFeedback.impactOccurred('medium'); } catch {}
    const query = `Join me on iFragment! Use my link to claim free FRG: ${link}`;
    switchInlineQuery(query, ['users', 'groups']);
  };

  const handleScanReferral = async () => {
    try { hapticFeedback.impactOccurred('light'); } catch {}
    const scannedData = await showScanQrPopup(t('profile.scanReferralQr') || 'Scan referral QR code');
    if (scannedData) {
      try { hapticFeedback.notificationOccurred('success'); } catch {}
      if (scannedData.includes('t.me/') || scannedData.startsWith('https://')) {
        openTelegramLink(scannedData);
      } else {
        // If it's just a raw code
        openTelegramLink(`https://t.me/iFragmentBot?start=${scannedData}`);
      }
    }
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-24 text-white">
      {/* Header */}
      <div class="px-6 pt-8 pb-6 bg-[#1c1c1c] border-b border-[#2a2a2a] rounded-b-[32px]">
        <h1 class="text-2xl font-black">{t('referral.title') || 'Referral Hub'}</h1>
        <p class="text-[#a0a4ad] text-xs mt-1">{t('referral.subtitle') || 'Invite friends to earn FRG and secure exclusive rewards'}</p>

        {/* Stats Dashboard */}
        <div class="mt-6 grid grid-cols-2 gap-3">
          <div class="bg-[#0f1014]/60 border border-[#2a2a2a] rounded-2xl p-4 flex flex-col gap-1">
            <span class="material-symbols-outlined text-[#3390ec] text-2xl">group</span>
            <span class="text-[10px] text-[#a0a4ad] font-bold uppercase tracking-wider mt-1">{t('profile.friendsInvited') || 'Invited'}</span>
            <span class="text-lg font-black text-white font-mono">{formatNumber(refInfo()?.totalInvited ?? 0)}</span>
          </div>
          <div class="bg-[#0f1014]/60 border border-[#2a2a2a] rounded-2xl p-4 flex flex-col gap-1">
            <span class="material-symbols-outlined text-[#34c759] text-2xl">payments</span>
            <span class="text-[10px] text-[#a0a4ad] font-bold uppercase tracking-wider mt-1">{t('profile.earned') || 'Earned'}</span>
            <span class="text-lg font-black text-white font-mono">{formatNumber(refInfo()?.totalEarned ?? 0)} FRG</span>
          </div>
        </div>
      </div>

      <div class="px-6 pt-6 flex flex-col gap-5">
        {/* Link Actions */}
        <div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-3xl p-5 flex flex-col gap-4">
          <h2 class="text-sm font-black text-white">{t('referral.referralLink') || 'Your Referral Link'}</h2>
          
          <div class="bg-[#0f1014] border border-[#2a2a2a] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <span class="text-xs text-[#a0a4ad] truncate select-all">{referralLink() || 'Loading...'}</span>
            <button
              onClick={handleCopyLink}
              class={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-colors ${
                copied() ? 'bg-[#34c759] text-white' : 'bg-[#3390ec] text-white'
              }`}
            >
              {copied() ? t('profile.copied') || 'Copied' : t('profile.copy') || 'Copy'}
            </button>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <button
              onClick={handleShareChat}
              class="py-2.5 rounded-2xl bg-[#3390ec]/10 border border-[#3390ec]/20 flex flex-col items-center gap-1 hover:bg-[#3390ec]/20 transition-colors"
            >
              <span class="material-symbols-outlined text-[18px] text-[#3390ec]">share</span>
              <span class="text-[#3390ec] text-[10px] font-bold">{t('profile.share') || 'Send'}</span>
            </button>
            <button
              onClick={handleShareStory}
              class="py-2.5 rounded-2xl bg-[#ff9500]/10 border border-[#ff9500]/20 flex flex-col items-center gap-1 hover:bg-[#ff9500]/20 transition-colors"
            >
              <span class="material-symbols-outlined text-[18px] text-[#ff9500]">auto_stories</span>
              <span class="text-[#ff9500] text-[10px] font-bold">{t('profile.story') || 'Story'}</span>
            </button>
            <button
              onClick={() => {
                if (!referralLink()) return;
                try { hapticFeedback.impactOccurred('light'); } catch {}
                setShowQrModal(true);
              }}
              class="py-2.5 rounded-2xl bg-[#00c7e2]/10 border border-[#00c7e2]/20 flex flex-col items-center gap-1 hover:bg-[#00c7e2]/20 transition-colors"
            >
              <span class="material-symbols-outlined text-[18px] text-[#00c7e2]">qr_code</span>
              <span class="text-[#00c7e2] text-[10px] font-bold">QR Code</span>
            </button>
          </div>
        </div>

        {/* Scan Native QR */}
        <button
          onClick={handleScanReferral}
          class="w-full py-4 bg-[#1c1c1c] border border-[#2a2a2a] rounded-3xl font-black text-sm flex items-center justify-center gap-2 hover:bg-[#25252b] active:scale-[0.98] transition-all"
        >
          <span class="material-symbols-outlined text-[20px] text-[#00c7e2]">qr_code_scanner</span>
          {t('referral.scanQrBtn') || 'Scan Invite QR'}
        </button>

        {/* Friends List */}
        <div class="flex flex-col gap-3">
          <h2 class="text-sm font-black text-[#a0a4ad] uppercase tracking-wider px-1">{t('referral.friendsList') || 'Friends List'}</h2>
          
          <div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-3xl p-5 flex flex-col gap-4">
            <Show when={refInfo()?.friends && refInfo()!.friends.length > 0} fallback={
              <div class="py-8 flex flex-col items-center text-center gap-2">
                <span class="material-symbols-outlined text-4xl text-[#a0a4ad]/40">group_off</span>
                <p class="text-[#a0a4ad] text-xs max-w-xs">{t('referral.noFriends') || 'No friends invited yet. Start inviting to earn FRG!'}</p>
              </div>
            }>
              <For each={refInfo()?.friends}>
                {(friend) => (
                  <div class="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0 last:pb-0 first:pt-0">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-full bg-[#0f1014] border border-[#2a2a2a] flex items-center justify-center font-black text-xs text-[#3390ec]">
                        {friend.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div class="flex flex-col">
                        <span class="text-xs font-black text-white">{friend.name}</span>
                        <span class="text-[9px] text-[#a0a4ad]">
                          {t('referral.joinedOn') ? t('referral.joinedOn').replace('{date}', friend.joinedAt) : `Joined ${friend.joinedAt}`}
                        </span>
                      </div>
                    </div>
                    <div class="flex flex-col items-end">
                      <span class="text-xs font-black text-[#34c759] font-mono">+{formatNumber(friend.earned)} FRG</span>
                      <span class="text-[9px] text-[#a0a4ad]">{t('referral.invitedBy') || 'Invited by you'}</span>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>

      {/* QR Modal PopUp */}
      <Show when={showQrModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <Motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-[32px] p-6 w-full max-w-sm flex flex-col items-center text-center relative"
          >
            {/* Close Button */}
            <button
              onClick={() => setShowQrModal(false)}
              class="absolute top-4 end-4 w-8 h-8 rounded-full bg-[#0f1014] flex items-center justify-center border border-[#2a2a2a]"
            >
              <span class="material-symbols-outlined text-white text-[18px]">close</span>
            </button>

            <span class="text-3xl mt-4">📲</span>
            <h2 class="text-white text-lg font-black mt-2">iFragment Invite</h2>
            <p class="text-[#a0a4ad] text-xs mt-1">Ask a friend to scan this QR code using their camera or the QR scanner inside the bot.</p>

            {/* QR Image Frame */}
            <div class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] my-6 flex items-center justify-center">
              <img src={qrCodeUrl()} alt="Referral QR Code" class="w-48 h-48 rounded-2xl bg-white p-1" />
            </div>

            {/* Sub-label */}
            <span class="text-[10px] text-[#3390ec] font-black uppercase tracking-widest font-mono select-all">
              {refInfo()?.referralCode || '...'}
            </span>
          </Motion.div>
        </div>
      </Show>
    </div>
  );
};
