import { Component, createSignal, onMount, onCleanup, For, Show, createMemo } from 'solid-js';
import { backButton } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { createQuery } from '@tanstack/solid-query';
import { t, locale, formatNumber } from '@/shared/i18n/index.js';
import { getProfileAchievements, getAchievementDefs } from '@/shared/api/profile.js';
import { ACHIEVEMENT_DEFS } from '@/shared/store/profile.js';
import { shareToStory, switchInlineQuery, haptic } from '@/shared/lib/telegram-native.js';

export const AchievementsPage: Component = () => {
  const [activeCategory, setActiveCategory] = createSignal<string>('all');
  const [selectedAch, setSelectedAch] = createSignal<any | null>(null);

  const achievementsQuery = createQuery(() => ({
    queryKey: ['profile', 'achievements'],
    queryFn: getProfileAchievements,
    staleTime: 30000,
  }));

  const defsQuery = createQuery(() => ({
    queryKey: ['profile', 'achievements', 'defs'],
    queryFn: getAchievementDefs,
    staleTime: 300000,
  }));

  const categories = [
    { id: 'all', label: () => t('achievements.categories.all') || 'All' },
    { id: 'onboarding', label: () => t('achievements.categories.onboarding') || 'Onboarding' },
    { id: 'mining', label: () => t('achievements.categories.mining') || 'Mining' },
    { id: 'analysis', label: () => t('achievements.categories.analysis') || 'Analysis' },
    { id: 'social', label: () => t('achievements.categories.social') || 'Social' },
    { id: 'management', label: () => t('achievements.categories.management') || 'Management' },
    { id: 'streaks', label: () => t('achievements.categories.streaks') || 'Streaks' },
    { id: 'special', label: () => t('achievements.categories.special') || 'Special' },
  ];

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => window.history.back());
    onCleanup(() => {
      off();
      try { backButton.hide(); } catch {}
    });
  });

  const mergedAchievements = createMemo(() => {
    const serverDefs = defsQuery.data || [];
    const serverAchs = achievementsQuery.data || [];

    // Map using either server definition target or local fallback
    return ACHIEVEMENT_DEFS.map(localDef => {
      const serverDef = serverDefs.find(d => d.id === localDef.id);
      const serverData = serverAchs.find(a => a.id === localDef.id);
      
      const target = serverDef ? serverDef.target : localDef.target;
      const title = t(`achievements.${localDef.id}_title` as any) || localDef.id;
      const desc = t(`achievements.${localDef.id}_desc` as any) || '';

      return {
        ...localDef,
        target,
        unlocked: serverData?.unlocked ?? false,
        progress: serverData?.progress ?? 0,
        unlockedAt: serverData?.unlockedAt,
        title,
        desc
      };
    });
  });

  const filteredAchievements = createMemo(() => {
    const cat = activeCategory();
    if (cat === 'all') return mergedAchievements();
    return mergedAchievements().filter(a => a.category === cat);
  });

  const unlockedCount = createMemo(() => {
    return mergedAchievements().filter(a => a.unlocked).length;
  });

  const handleCardClick = (ach: any) => {
    haptic.impact('light');
    setSelectedAch(ach);
  };

  const handleShareToStory = () => {
    const ach = selectedAch();
    if (!ach) return;
    haptic.impact('medium');
    const storyText = `I unlocked the "${ach.title}" achievement on iFragment! 🏆`;
    // Share with bot referral link widget
    shareToStory(
      window.location.origin + '/promo_banner.png',
      {
        text: storyText,
        widget_link: {
          url: `https://t.me/iFragmentBot?start=ach_${ach.id}`,
          name: 'iFragment'
        }
      }
    );
  };

  const handleShareToChat = () => {
    const ach = selectedAch();
    if (!ach) return;
    haptic.impact('medium');
    const query = `Check out my unlocked achievement: ${ach.icon} ${ach.title} - ${ach.desc}`;
    switchInlineQuery(query, ['users', 'groups']);
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-24 text-white">
      {/* Header */}
      <div class="px-6 pt-8 pb-6 bg-[#1c1c1c] border-b border-[#2a2a2a] rounded-b-[32px]">
        <h1 class="text-2xl font-black">{t('achievements.title') || 'Achievements'}</h1>
        <p class="text-[#a0a4ad] text-xs mt-1">{t('achievements.subtitle') || 'Track your milestones and collect badges'}</p>

        {/* Progress summary */}
        <div class="mt-6 bg-[#0f1014]/60 border border-[#2a2a2a] rounded-2xl p-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-3xl">🏆</span>
            <div>
              <span class="text-xs text-[#a0a4ad] block font-bold uppercase tracking-wider">{t('achievements.title') || 'Milestones'}</span>
              <span class="text-lg font-black text-white">{unlockedCount()} / {mergedAchievements().length} {t('achievements.completed') || 'Completed'}</span>
            </div>
          </div>
          <div class="w-16 h-16 rounded-full border-4 border-[#2a2a2a] relative flex items-center justify-center font-black text-sm text-[#3390ec]">
            {mergedAchievements().length ? Math.round((unlockedCount() / mergedAchievements().length) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div class="flex gap-2 overflow-x-auto px-6 py-4" style={{ 'scrollbar-width': 'none' }}>
        <For each={categories}>
          {(cat) => (
            <button
              onClick={() => {
                haptic.selection();
                setActiveCategory(cat.id);
              }}
              class={`px-4 py-2 rounded-full font-bold text-xs shrink-0 border transition-all ${
                activeCategory() === cat.id
                  ? 'bg-white border-white text-black'
                  : 'bg-[#1c1c1c] border-[#2a2a2a] text-[#a0a4ad] hover:border-[#3a3a3a]'
              }`}
            >
              {cat.label()}
            </button>
          )}
        </For>
      </div>

      {/* Achievements Grid */}
      <div class="px-6 grid grid-cols-2 gap-3">
        <For each={filteredAchievements()}>
          {(ach) => (
            <Motion.button
              onClick={() => handleCardClick(ach)}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              class={`rounded-3xl p-4 border flex flex-col items-center text-center gap-2 relative transition-all ${
                ach.unlocked
                  ? 'bg-[#1c1c1c] border-[#ffd700]/30 shadow-[0_0_15px_rgba(255,215,0,0.05)]'
                  : 'bg-[#1a1b20] border-[#2a2a2a] opacity-60'
              }`}
            >
              {/* Badge Icon */}
              <div class={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-1 relative ${
                ach.unlocked ? 'bg-gradient-to-br from-amber-400/20 to-orange-500/20' : 'bg-[#0f1014]'
              }`}>
                <span>{ach.icon}</span>
                <Show when={!ach.unlocked}>
                  <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a]">
                    <span class="material-symbols-outlined text-[10px] text-[#a0a4ad]">lock</span>
                  </div>
                </Show>
              </div>

              {/* Progress or check */}
              <Show when={ach.unlocked} fallback={
                <Show when={ach.target > 1} fallback={<span class="text-[10px] font-bold text-[#8e8e93] uppercase tracking-wider">{t('achievements.locked') || 'Locked'}</span>}>
                  <div class="w-full flex flex-col gap-1 mt-auto">
                    <div class="w-full h-1 bg-[#0f1014] rounded-full overflow-hidden">
                      <div class="h-full bg-[#3390ec] rounded-full" style={{ width: `${Math.min(100, (ach.progress / ach.target) * 100)}%` }} />
                    </div>
                    <span class="text-[9px] text-[#a0a4ad] font-bold font-mono">{formatNumber(ach.progress)} / {formatNumber(ach.target)}</span>
                  </div>
                </Show>
              }>
                <span class="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                  <span class="material-symbols-outlined text-[12px]">verified</span>
                  {t('achievements.unlocked') || 'Unlocked'}
                </span>
              </Show>

              {/* Title & Desc */}
              <span class="text-xs font-black text-white mt-1 leading-tight line-clamp-1">{ach.title}</span>
              <span class="text-[9px] text-[#a0a4ad] leading-normal line-clamp-2">{ach.desc}</span>
            </Motion.button>
          )}
        </For>
      </div>

      {/* Detail Dialog/Modal */}
      <Show when={selectedAch()}>
        {(ach) => (
          <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm">
            <Motion.div
              initial={{ y: '100%' }}
              animate={{ y: '0%' }}
              class="w-full max-w-md bg-[#1c1c1c] border-t border-[#2a2a2a] rounded-t-[32px] p-6 pb-10 flex flex-col items-center text-center relative"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedAch(null)}
                class="absolute top-4 end-4 w-8 h-8 rounded-full bg-[#0f1014] flex items-center justify-center border border-[#2a2a2a]"
              >
                <span class="material-symbols-outlined text-white text-[18px]">close</span>
              </button>

              {/* Large Icon */}
              <div class={`w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mb-4 mt-2 ${
                ach().unlocked ? 'bg-gradient-to-br from-amber-400/20 to-orange-500/20 border-2 border-amber-400/30' : 'bg-[#0f1014] border border-[#2a2a2a]'
              }`}>
                <span>{ach().icon}</span>
              </div>

              {/* Category tag */}
              <span class="px-3 py-1 rounded-full bg-[#0f1014] border border-[#2a2a2a] text-[9px] font-bold text-[#3390ec] uppercase tracking-wider mb-2">
                {ach().category ? t(`achievements.categories.${ach().category}` as any) || ach().category : ''}
              </span>

              {/* Title & Desc */}
              <h2 class="text-white text-xl font-black">{ach().title}</h2>
              <p class="text-[#a0a4ad] text-xs mt-2 max-w-xs">{ach().desc}</p>

              {/* Lock details or date */}
              <div class="my-6 w-full py-4 px-5 bg-[#0f1014] border border-[#2a2a2a] rounded-2xl">
                <Show when={ach().unlocked} fallback={
                  <div class="flex flex-col items-center gap-2">
                    <span class="text-xs text-[#a0a4ad] font-bold">{t('achievements.progress') || 'Current Progress'}</span>
                    <span class="text-lg font-black text-white font-mono">{formatNumber(ach().progress)} / {formatNumber(ach().target)}</span>
                    <div class="w-full h-2 bg-[#1c1c1c] rounded-full overflow-hidden">
                      <div class="h-full bg-[#3390ec] rounded-full" style={{ width: `${Math.min(100, (ach().progress / ach().target) * 100)}%` }} />
                    </div>
                  </div>
                }>
                  <div class="flex flex-col items-center gap-1">
                    <span class="text-[10px] text-[#a0a4ad] font-bold uppercase tracking-widest">{t('achievements.unlockedAtLabel') || 'Date Unlocked'}</span>
                    <span class="text-sm font-black text-white">{ach().unlockedAt ? new Date(ach().unlockedAt!).toLocaleDateString(locale() === 'fa' ? 'fa-IR' : 'en-US', { dateStyle: 'medium' }) : '---'}</span>
                  </div>
                </Show>
              </div>

              {/* Share actions */}
              <Show when={ach().unlocked}>
                <div class="flex flex-col gap-2 w-full">
                  <button
                    onClick={handleShareToStory}
                    class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 active:scale-[0.98] transition-all"
                  >
                    <span class="material-symbols-outlined text-[20px]" style={{ 'font-variation-settings': '"FILL" 1' }}>auto_stories</span>
                    {t('achievements.shareStory') || 'Share to Telegram Story'}
                  </button>
                  <button
                    onClick={handleShareToChat}
                    class="w-full py-3 bg-[#0f1014] border border-[#2a2a2a] text-white font-bold text-sm flex items-center justify-center gap-2 rounded-2xl active:scale-[0.98] transition-all"
                  >
                    <span class="material-symbols-outlined text-[18px]">share</span>
                    {t('achievements.shareChat') || 'Send to Friends'}
                  </button>
                </div>
              </Show>
            </Motion.div>
          </div>
        )}
      </Show>
    </div>
  );
};
