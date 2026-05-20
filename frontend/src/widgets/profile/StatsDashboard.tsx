import { Component, For } from 'solid-js';
import { Motion } from '@motionone/solid';
import { t, locale } from '@/shared/i18n/index.js';
import type { ProfileStats } from '@/shared/store/profile.js';

interface Props { stats: ProfileStats | null }

export const StatsDashboard: Component<Props> = (props) => {
  const statItems = () => [
    { key: 'usernamesAnalyzed', icon: 'search', color: '#3390ec', value: props.stats?.usernamesAnalyzed ?? 0, label: t('profile.statsAnalyzed') || 'Analyzed' },
    { key: 'groupsManaged', icon: 'group', color: '#34c759', value: props.stats?.groupsManaged ?? 0, label: t('profile.statsGroups') || 'Groups' },
    { key: 'channelsManaged', icon: 'campaign', color: '#ff9500', value: props.stats?.channelsManaged ?? 0, label: t('profile.statsChannels') || 'Channels' },
    { key: 'currentStreak', icon: 'local_fire_department', color: '#ff6b35', value: props.stats?.currentStreak ?? 0, label: t('profile.statsStreak') || 'Streak' },
    { key: 'daysActive', icon: 'event_available', color: '#00c7e2', value: props.stats?.daysActive ?? 0, label: t('profile.statsDaysActive') || 'Days Active' },
    { key: 'totalTaps', icon: 'touch_app', color: '#ff2d55', value: props.stats?.totalTaps ?? 0, label: t('profile.statsTaps') || 'Total Taps' },
  ];

  const formatVal = (v: number) => {
    const isFa = locale() === 'fa';
    if (v >= 1_000_000) {
      const val = (v / 1_000_000).toFixed(1);
      return (isFa ? parseFloat(val).toLocaleString('fa-IR') : val) + (isFa ? ' میلیون' : 'M');
    }
    if (v >= 1_000) {
      const val = (v / 1_000).toFixed(1);
      return (isFa ? parseFloat(val).toLocaleString('fa-IR') : val) + (isFa ? ' هزار' : 'K');
    }
    return v.toLocaleString(isFa ? 'fa-IR' : 'en-US');
  };

  return (
    <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      class="mx-6 mt-4 bg-[#1c1c1c] rounded-3xl p-5 border border-[#2a2a2a]">
      <div class="flex items-center gap-2 mb-4">
        <div class="w-8 h-8 rounded-xl bg-[#0f1014] flex items-center justify-center border border-[#2a2a2a]">
          <span class="material-symbols-outlined text-[18px] text-[#3390ec]">bar_chart</span>
        </div>
        <span class="text-white font-black text-sm">{t('profile.activityStats') || 'Activity Stats'}</span>
      </div>
      <div class="grid grid-cols-3 gap-2.5">
        <For each={statItems()}>
          {(item, i) => (
            <Motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i() * 0.05 }}
              class="bg-[#0f1014] rounded-2xl p-3 border border-[#2a2a2a] flex flex-col items-center text-center gap-1">
              <span class="material-symbols-outlined text-[20px]" style={{ color: item.color, 'font-variation-settings': '"FILL" 1' }}>{item.icon}</span>
              <span class="text-white font-black text-lg leading-none">{formatVal(item.value)}</span>
              <span class="text-[#a0a4ad] text-[10px] font-bold leading-tight">{item.label}</span>
            </Motion.div>
          )}
        </For>
      </div>
    </Motion.div>
  );
};
