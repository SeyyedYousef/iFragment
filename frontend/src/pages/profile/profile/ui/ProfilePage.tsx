import { Component, createSignal, onMount, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Motion } from '@motionone/solid';
import { createQuery } from '@tanstack/solid-query';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { t, isRtl } from '@/shared/i18n/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { IdentityHero } from '@/widgets/profile/IdentityHero.js';
import { FrgWalletCard } from '@/widgets/profile/FrgWalletCard.js';
import { StatsDashboard } from '@/widgets/profile/StatsDashboard.js';
import { AchievementPreview } from '@/widgets/profile/AchievementPreview.js';
import { ReferralPreview } from '@/widgets/profile/ReferralPreview.js';
import { QuickActions } from '@/widgets/profile/QuickActions.js';
import { GamificationHub } from '@/widgets/profile/GamificationHub.js';
import { getProfileStats, getProfileAchievements, getReferralInfo } from '@/shared/api/profile.js';
import { checkHomeScreenStatus, addToHomeScreen } from '@/shared/lib/telegram-native.js';
import { SkeletonProfile } from '@/shared/ui/Skeleton.js';

export const ProfilePage: Component = () => {
  const navigate = useNavigate();
  const [showHomePrompt, setShowHomePrompt] = createSignal(false);

  const statsQuery = createQuery(() => ({
    queryKey: ['profile', 'stats'],
    queryFn: getProfileStats,
    staleTime: 15000,
  }));

  const achievementsQuery = createQuery(() => ({
    queryKey: ['profile', 'achievements'],
    queryFn: getProfileAchievements,
    staleTime: 30000,
  }));

  const referralQuery = createQuery(() => ({
    queryKey: ['profile', 'referral'],
    queryFn: getReferralInfo,
    staleTime: 60000,
  }));

  const loading = () => statsQuery.isLoading || achievementsQuery.isLoading || referralQuery.isLoading;
  const stats = () => statsQuery.data || null;
  const achievements = () => achievementsQuery.data || [];
  const referral = () => referralQuery.data || null;

  onMount(async () => {
    try {
      backButton.hide();
    } catch {}

    try {
      // Check if we should prompt to add to home screen
      const status = await checkHomeScreenStatus();
      if (status === 'missed' || status === 'unknown') {
        setShowHomePrompt(true);
      }
    } catch (e) {
      console.error('Failed to load home screen status', e);
    }
  });

  const handleNavigate = (path: string) => {
    try { hapticFeedback.impactOccurred('light'); } catch {}
    navigate(path);
  };

  const handleAddHome = () => {
    try { hapticFeedback.impactOccurred('medium'); } catch {}
    addToHomeScreen();
    setShowHomePrompt(false);
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-32 text-white">
      {/* Home Screen Banner Prompt */}
      <Show when={showHomePrompt()}>
        <div class="mx-6 mt-4 bg-gradient-to-r from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/30 rounded-3xl p-4 flex items-center justify-between gap-3 animate-fade-in">
          <div class="flex items-center gap-3">
            <span class="text-2xl">📱</span>
            <div class="flex flex-col">
              <span class="text-xs font-black text-white">{t('profile.addHomeTitle') || 'Add iFragment to Home'}</span>
              <span class="text-[9px] text-[#a0a4ad] font-bold">{t('profile.addHomeDesc') || 'Fast access & claim +1,000 FRG reward!'}</span>
            </div>
          </div>
          <button 
            onClick={handleAddHome}
            class="px-3.5 py-1.5 bg-[#3390ec] hover:bg-[#2b7ec9] text-[9px] font-black text-white rounded-xl uppercase tracking-wider transition-all"
          >
            {t('profile.addBtn') || 'Add'}
          </button>
        </div>
      </Show>

      {/* Loading Skeleton */}
      {loading() ? (
        <div class="px-6 py-6 min-h-[80vh]">
          <SkeletonProfile />
        </div>
      ) : (
        <div class="flex flex-col">
          {/* Identity Hero */}
          <IdentityHero stats={stats()} />

          {/* Wallet Card */}
          <FrgWalletCard stats={stats()} />

          {/* Stats Grid */}
          <StatsDashboard stats={stats()} />

          {/* Gamification Hub */}
          <GamificationHub />

          {/* Achievements Preview */}
          <div class="relative group cursor-pointer">
            <AchievementPreview achievements={achievements()} />
            <button
              onClick={() => handleNavigate('/profile/achievements')}
              class="absolute top-9 end-10 w-8 h-8 rounded-full bg-[#0f1014]/40 border border-[#2a2a2a] flex items-center justify-center active:scale-95 transition-all"
            >
              <span class={`material-symbols-outlined text-[16px] text-white transition-transform ${isRtl() ? 'rotate-180' : ''}`}>chevron_right</span>
            </button>
          </div>

          {/* Referral Preview */}
          <div class="relative group cursor-pointer">
            <ReferralPreview referral={referral()} />
            <button
              onClick={() => handleNavigate('/profile/referral')}
              class="absolute top-9 end-10 w-8 h-8 rounded-full bg-[#0f1014]/40 border border-[#2a2a2a] flex items-center justify-center active:scale-95 transition-all"
            >
              <span class={`material-symbols-outlined text-[16px] text-white transition-transform ${isRtl() ? 'rotate-180' : ''}`}>chevron_right</span>
            </button>
          </div>

          {/* Quick Actions (Home sync, status, support) */}
          <QuickActions />

          {/* Navigation Menu (Settings & Security) */}
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            class="mx-6 mt-4 bg-[#1c1c1c] border border-[#2a2a2a] rounded-3xl p-5 flex flex-col gap-4"
          >
            {/* Premium & Cosmetics Hub button */}
            <button
              onClick={() => handleNavigate('/profile/premium')}
              class="flex items-center justify-between w-full py-1 group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ffd700]/20 to-[#ff8c00]/20 flex items-center justify-center border border-[#ffd700]/30">
                  <span class="material-symbols-outlined text-[20px] text-amber-400" style={{ 'font-variation-settings': '"FILL" 1' }}>verified</span>
                </div>
                <div class="flex flex-col items-start">
                  <span class="text-xs font-black text-white flex items-center gap-1.5">
                    {t('premium.title') || 'Premium & Cosmetics'}
                    <span class="px-1.5 py-0.5 text-[8px] bg-gradient-to-r from-[#ffd700] to-[#ff8c00] text-black font-black rounded uppercase tracking-wider">New</span>
                  </span>
                  <span class="text-[9px] text-[#a0a4ad] font-bold">{t('premium.subtitle') || 'Skins, Borders, Emoji Status'}</span>
                </div>
              </div>
              <span class={`material-symbols-outlined text-[#a0a4ad] text-[18px] transition-transform ${isRtl() ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}>chevron_right</span>
            </button>

            <div class="h-[1px] bg-[#2a2a2a] w-full" />

            {/* Settings button */}
            <button
              onClick={() => handleNavigate('/profile/settings')}
              class="flex items-center justify-between w-full py-1 group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-[#0f1014] flex items-center justify-center border border-[#2a2a2a]">
                  <span class="material-symbols-outlined text-[20px] text-[#3390ec]">settings</span>
                </div>
                <span class="text-xs font-black text-white">{t('settings.title') || 'Settings'}</span>
              </div>
              <span class={`material-symbols-outlined text-[#a0a4ad] text-[18px] transition-transform ${isRtl() ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}>chevron_right</span>
            </button>

            <div class="h-[1px] bg-[#2a2a2a] w-full" />

            {/* Security button */}
            <button
              onClick={() => handleNavigate('/profile/security')}
              class="flex items-center justify-between w-full py-1 group"
            >
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-[#0f1014] flex items-center justify-center border border-[#2a2a2a]">
                  <span class="material-symbols-outlined text-[20px] text-[#34c759]">security</span>
                </div>
                <span class="text-xs font-black text-white">{t('security.title') || 'Security & Keys'}</span>
              </div>
              <span class={`material-symbols-outlined text-[#a0a4ad] text-[18px] transition-transform ${isRtl() ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}>chevron_right</span>
            </button>
          </Motion.div>

          {/* Profile Footer */}
          <div class="mt-8 mb-6 text-center flex flex-col items-center gap-1 opacity-40">
            <span class="text-[10px] font-black text-white uppercase tracking-widest">{t('profile.walletHub') || 'iFragment Wallet Hub'}</span>
            <span class="text-[9px] text-[#a0a4ad] font-bold">{t('profile.version') || 'Version'} 1.0.4 ({t('profile.tmaProduction') || 'TMA Production'})</span>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};
