import { Component, createSignal, onMount, Show, ErrorBoundary } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Motion } from '@motionone/solid';
import { createQuery } from '@tanstack/solid-query';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { t, isRtl } from '@/shared/i18n/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { IdentityHero } from '@/widgets/profile/IdentityHero.js';
import { StatsDashboard } from '@/widgets/profile/StatsDashboard.js';
import { AchievementPreview } from '@/widgets/profile/AchievementPreview.js';
import { ReferralPreview } from '@/widgets/profile/ReferralPreview.js';
import { QuickActions } from '@/widgets/profile/QuickActions.js';
import { GamificationHub } from '@/widgets/profile/GamificationHub.js';
import { getProfileStats, getProfileAchievements, getReferralInfo } from '@/shared/api/profile.js';
import { checkHomeScreenStatus, addToHomeScreen } from '@/shared/lib/telegram-native.js';
import { SkeletonProfile } from '@/shared/ui/Skeleton.js';
import { ErrorFallback } from '@/shared/ui/ErrorFallback.js';
import { useSecretTrigger } from '@/features/owner-gate/lib/useSecretTrigger.js';
import { OwnerGateModal } from '@/widgets/owner/OwnerGateModal.js';
import { RedeemPromoModal } from '@/widgets/profile/RedeemPromoModal.js';

export const ProfilePage: Component = () => {
  const secretTrigger = useSecretTrigger();
  const navigate = useNavigate();
  const [showHomePrompt, setShowHomePrompt] = createSignal(false);
  const [showPromoModal, setShowPromoModal] = createSignal(false);

  const getCachedStats = () => {
    try {
      const raw = localStorage.getItem('cached_profile_stats');
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  };

  const getCachedAchievements = () => {
    try {
      const raw = localStorage.getItem('cached_profile_achievements');
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  };

  const getCachedReferral = () => {
    try {
      const raw = localStorage.getItem('cached_profile_referral');
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  };

  const statsQuery = createQuery(() => ({
    queryKey: ['profile', 'stats'],
    queryFn: async () => {
      const res = await getProfileStats();
      try {
        localStorage.setItem('cached_profile_stats', JSON.stringify(res));
      } catch {}
      return res;
    },
    initialData: getCachedStats(),
    staleTime: 15000,
    refetchOnWindowFocus: false,
  }));

  const achievementsQuery = createQuery(() => ({
    queryKey: ['profile', 'achievements'],
    queryFn: async () => {
      const res = await getProfileAchievements();
      try {
        localStorage.setItem('cached_profile_achievements', JSON.stringify(res));
      } catch {}
      return res;
    },
    initialData: getCachedAchievements(),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  }));

  const referralQuery = createQuery(() => ({
    queryKey: ['profile', 'referral'],
    queryFn: async () => {
      const res = await getReferralInfo();
      try {
        localStorage.setItem('cached_profile_referral', JSON.stringify(res));
      } catch {}
      return res;
    },
    initialData: getCachedReferral(),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  }));

  // Parallelize loading: only above-the-fold stats block the initial screen (bypassed if cache exists)
  const loading = () => statsQuery.isLoading;
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

      {/* Loading Skeleton for above-the-fold */}
      {loading() ? (
        <div class="px-6 py-6 min-h-[80vh]">
          <SkeletonProfile />
        </div>
      ) : (
        <ErrorBoundary fallback={(err, reset) => <ErrorFallback err={err} reset={reset} />}>
          <div class="flex flex-col">
            {/* Identity Hero Wrapper with Press Events */}
            <div 
              onTouchStart={secretTrigger.onLogoPressStart}
              onTouchEnd={secretTrigger.onLogoPressEnd}
              onMouseDown={secretTrigger.onLogoPressStart}
              onMouseUp={secretTrigger.onLogoPressEnd}
              onMouseLeave={secretTrigger.onLogoPressEnd}
            >
              <IdentityHero stats={stats()} />
            </div>



            {/* Stats Grid */}
            <StatsDashboard stats={stats()} />

            {/* Gamification Hub */}
            <GamificationHub />

            {/* Achievements Preview */}
            <div class="relative group cursor-pointer">
              <Show 
                when={!achievementsQuery.isLoading} 
                fallback={
                  <div class="mx-6 mt-4 bg-[#1c1c1c] rounded-3xl p-5 border border-[#2a2a2a] animate-pulse h-36 flex flex-col justify-between">
                    <div class="h-5 w-1/3 bg-white/5 rounded-lg" />
                    <div class="flex gap-3 overflow-x-hidden">
                      <div class="w-20 h-20 bg-white/5 rounded-2xl flex-shrink-0" />
                      <div class="w-20 h-20 bg-white/5 rounded-2xl flex-shrink-0" />
                      <div class="w-20 h-20 bg-white/5 rounded-2xl flex-shrink-0" />
                      <div class="w-20 h-20 bg-white/5 rounded-2xl flex-shrink-0" />
                    </div>
                  </div>
                }
              >
                <AchievementPreview achievements={achievements()} />
              </Show>
              <button
                onClick={() => handleNavigate('/profile/achievements')}
                class="absolute top-9 end-10 w-8 h-8 rounded-full bg-[#0f1014]/40 border border-[#2a2a2a] flex items-center justify-center active:scale-95 transition-all"
              >
                <span class={`material-symbols-outlined text-[16px] text-white transition-transform ${isRtl() ? 'rotate-180' : ''}`}>chevron_right</span>
              </button>
            </div>

            {/* Referral Preview */}
            <div class="relative group cursor-pointer">
              <Show 
                when={!referralQuery.isLoading} 
                fallback={
                  <div class="mx-6 mt-4 bg-[#1c1c1c] rounded-3xl p-5 border border-[#2a2a2a] animate-pulse h-48 flex flex-col gap-3">
                    <div class="h-5 w-1/3 bg-white/5 rounded-lg" />
                    <div class="grid grid-cols-2 gap-2 h-14">
                      <div class="bg-white/5 rounded-2xl" />
                      <div class="bg-white/5 rounded-2xl" />
                    </div>
                    <div class="bg-white/5 rounded-2xl h-10" />
                  </div>
                }
              >
                <ReferralPreview referral={referral()} />
              </Show>
              <button
                onClick={() => handleNavigate('/profile/referral')}
                class="absolute top-9 end-10 w-8 h-8 rounded-full bg-[#0f1014]/40 border border-[#2a2a2a] flex items-center justify-center active:scale-95 transition-all"
              >
                <span class={`material-symbols-outlined text-[16px] text-white transition-transform ${isRtl() ? 'rotate-180' : ''}`}>chevron_right</span>
              </button>
            </div>

            {/* Quick Actions (Home sync, status, support) */}
            <QuickActions onRedeemClick={() => setShowPromoModal(true)} />

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
              <span 
                onClick={secretTrigger.onVersionTap}
                class="text-[9px] text-[#a0a4ad] font-bold cursor-pointer select-none"
              >
                {t('profile.version') || 'Version'} 1.0.4 ({t('profile.tmaProduction') || 'TMA Production'})
              </span>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Owner Gate OTP Verification Popup */}
      <OwnerGateModal 
        isOpen={secretTrigger.showGate()} 
        onClose={() => secretTrigger.setShowGate(false)} 
      />

      {/* User Gift Code Redemption Popup */}
      <RedeemPromoModal 
        isOpen={showPromoModal()} 
        onClose={() => setShowPromoModal(false)} 
      />
    </div>
  );
};
