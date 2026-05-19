import { Component, createSignal, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Motion } from '@motionone/solid';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { t } from '@/shared/i18n/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { IdentityHero } from '@/widgets/profile/IdentityHero.jsx';
import { FrgWalletCard } from '@/widgets/profile/FrgWalletCard.jsx';
import { StatsDashboard } from '@/widgets/profile/StatsDashboard.jsx';
import { AchievementPreview } from '@/widgets/profile/AchievementPreview.jsx';
import { ReferralPreview } from '@/widgets/profile/ReferralPreview.jsx';
import { QuickActions } from '@/widgets/profile/QuickActions.jsx';
import { getProfileStats, getProfileAchievements, getReferralInfo } from '@/shared/api/profile.js';
import type { ProfileStats, Achievement, ReferralInfo } from '@/shared/store/profile.js';

export const ProfilePage: Component = () => {
  const navigate = useNavigate();
  const [stats, setStats] = createSignal<ProfileStats | null>(null);
  const [achievements, setAchievements] = createSignal<Achievement[]>([]);
  const [referral, setReferral] = createSignal<ReferralInfo | null>(null);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      backButton.hide();
    } catch {}

    try {
      const [s, a, r] = await Promise.all([
        getProfileStats(),
        getProfileAchievements(),
        getReferralInfo()
      ]);
      setStats(s);
      setAchievements(a);
      setReferral(r);
    } catch (e) {
      console.error('Failed to load profile data', e);
    } finally {
      setLoading(false);
    }
  });

  const handleNavigate = (path: string) => {
    try { hapticFeedback.impactOccurred('light'); } catch {}
    navigate(path);
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-32 text-white">
      {/* Loading Skeleton */}
      {loading() ? (
        <div class="flex flex-col items-center justify-center min-h-[80vh] gap-4">
          <div class="w-12 h-12 rounded-full border-4 border-[#3390ec]/20 border-t-[#3390ec] animate-spin" />
          <span class="text-xs text-[#a0a4ad] font-bold uppercase tracking-wider">Loading Profile...</span>
        </div>
      ) : (
        <div class="flex flex-col">
          {/* Identity Hero */}
          <IdentityHero stats={stats()} />

          {/* Wallet Card */}
          <FrgWalletCard stats={stats()} />

          {/* Stats Grid */}
          <StatsDashboard stats={stats()} />

          {/* Achievements Preview */}
          <div class="relative group cursor-pointer">
            <AchievementPreview achievements={achievements()} />
            <button
              onClick={() => handleNavigate('/profile/achievements')}
              class="absolute top-9 right-10 w-8 h-8 rounded-full bg-[#0f1014]/40 border border-[#2a2a2a] flex items-center justify-center active:scale-95 transition-all"
            >
              <span class="material-symbols-outlined text-[16px] text-white">chevron_right</span>
            </button>
          </div>

          {/* Referral Preview */}
          <div class="relative group cursor-pointer">
            <ReferralPreview referral={referral()} />
            <button
              onClick={() => handleNavigate('/profile/referral')}
              class="absolute top-9 right-10 w-8 h-8 rounded-full bg-[#0f1014]/40 border border-[#2a2a2a] flex items-center justify-center active:scale-95 transition-all"
            >
              <span class="material-symbols-outlined text-[16px] text-white">chevron_right</span>
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
              <span class="material-symbols-outlined text-[#a0a4ad] text-[18px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
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
              <span class="material-symbols-outlined text-[#a0a4ad] text-[18px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
            </button>
          </Motion.div>

          {/* Profile Footer */}
          <div class="mt-8 mb-6 text-center flex flex-col items-center gap-1 opacity-40">
            <span class="text-[10px] font-black text-white uppercase tracking-widest">iFragment Wallet Hub</span>
            <span class="text-[9px] text-[#a0a4ad] font-bold">Version 1.0.4 (TMA Production)</span>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};
