import { Component, createSignal, createResource, onMount, onCleanup, For, Show } from 'solid-js';
import { useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { groupApi } from '@/shared/api/bot-management.js';
import type { DailyMetric } from '@/shared/api/bot-management.js';

export const AnalyticsPage: Component = () => {
  const params = useParams();
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [days, setDays] = createSignal(7);

  const [data] = createResource(
    () => ({ id: params.id, d: days() }),
    (args) => groupApi.getAnalytics(args.id, args.d)
  );

  onMount(() => { backButton.show(); const off = backButton.onClick(() => window.history.back()); onCleanup(() => off()); });

  const changeDays = (d: number) => { setDays(d); hapticFeedback.selectionChanged(); };

  const downloadCSV = () => {
    const d = data();
    if (!d) return;
    hapticFeedback.impactOccurred('medium');
    
    let csv = "Date,Growth,Activity\n";
    const maxLength = Math.max(d.growth.length, d.activity.length);
    for (let i = 0; i < maxLength; i++) {
      const date = d.growth[i]?.date || d.activity[i]?.date || "";
      const growth = d.growth[i]?.value || 0;
      const activity = d.activity[i]?.value || 0;
      csv += `${date},${growth},${activity}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `analytics_${params.id}_${days()}d.csv`);
    a.click();
  };

  const renderChart = (metrics: DailyMetric[], color: string, label: string) => {
    if (!metrics || metrics.length === 0) return (
      <div class="flex items-center justify-center py-8"><span class="text-[13px] text-[#555]">No data yet</span></div>
    );
    const maxVal = Math.max(...metrics.map(m => m.value), 1);
    return (
      <div class="space-y-2">
        <span class="text-[13px] font-bold text-[#8e8e93]">{label}</span>
        <div class="flex items-end gap-1 h-32">
          <For each={metrics}>{(m) => {
            const h = Math.max(8, (m.value / maxVal) * 100);
            return (
              <div class="flex-1 flex flex-col items-center gap-1 group relative">
                <div class="absolute -top-10 bg-[#2c2c2e] border border-[#3a3a3c] text-white text-[11px] font-bold px-2 py-1.5 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none transform -translate-y-1 group-hover:translate-y-0 whitespace-nowrap z-50">
                  {m.value.toLocaleString()} <span class="text-[#8e8e93] font-medium ml-1">({m.date.slice(5)})</span>
                </div>
                <div class="w-full rounded-full transition-all duration-300 hover:brightness-125" style={{ height: `${h}%`, background: `linear-gradient(to top, ${color}cc, ${color})` }}/>
              </div>
            );
          }}</For>
        </div>
        <div class="flex justify-between">
          <span class="text-[10px] text-[#555]">{metrics[0]?.date.slice(5)}</span>
          <span class="text-[10px] text-[#555]">{metrics[metrics.length-1]?.date.slice(5)}</span>
        </div>
      </div>
    );
  };

  const statCards = () => {
    const s = data()?.summary;
    const growth = data()?.growth || [];
    const activity = data()?.activity || [];
    
    const calcTrend = (arr: DailyMetric[]) => {
      if (arr.length < 2) return 0;
      const first = arr[0].value;
      const last = arr[arr.length - 1].value;
      return last - first;
    };

    return [
      { icon: 'person_add', label: t('analyticsSettings.newMembers'), value: s?.new_members ?? 0, color: '#34c759', change: calcTrend(growth) },
      { icon: 'chat_bubble', label: t('analyticsSettings.totalMessages'), value: s?.total_messages ?? 0, color: '#3390ec', change: calcTrend(activity) },
      { icon: 'calculate', label: t('analyticsSettings.avgPerDay'), value: s ? Math.round(s.total_messages / Math.max(days(), 1)) : 0, color: '#ff9f0a', change: 0 },
      { icon: 'block', label: 'Spam Blocked', value: s?.spam_blocked ?? 0, color: '#ff3b30', change: 0 },
      { icon: 'people', label: 'Active Users', value: s?.active_users ?? 0, color: '#af52de', change: 0 },
      { icon: 'person_remove', label: 'Members Left', value: s?.members_left ?? 0, color: '#ff6482', change: 0 },
    ];
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-10 relative text-white">
      <div class="px-5 pt-6 pb-4 sticky top-0 bg-[#0f1014]/90 backdrop-blur-md z-30 border-b border-[#1c1c1c]">
        <div class="flex items-center justify-between">
          <div class="flex flex-col gap-1">
            <h1 class="text-2xl font-black text-white">{t('analyticsSettings.title')}</h1>
            <p class="text-[13px] font-medium text-[#8e8e93]">{t('analyticsSettings.subtitle')}</p>
          </div>
          <div class="flex items-center gap-3">
            <button 
              onClick={downloadCSV} 
              class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors"
              title="Export CSV"
            >
              <span class="material-symbols-outlined text-[#3390ec] text-[20px]">download</span>
            </button>
            <button onClick={()=>setIsMenuOpen(true)} class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a]">
              <span class="material-symbols-outlined text-white text-[20px]">menu</span>
            </button>
          </div>
        </div>
        {/* Date Range */}
        <div class="flex gap-2 mt-4">
          {([7,30,90] as const).map(d=>(
            <button onClick={()=>changeDays(d)}
              class={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all border ${
                days()===d?'bg-[#3390ec]/10 border-[#3390ec]/30 text-[#3390ec]':'bg-[#1c1c1c] border-[#2a2a2a] text-[#8e8e93]'
              }`}>
              {d===7?t('analyticsSettings.range7d'):d===30?t('analyticsSettings.range30d'):t('analyticsSettings.range90d')}
            </button>
          ))}
        </div>
      </div>
      <HamburgerMenu isOpen={isMenuOpen()} onClose={()=>setIsMenuOpen(false)} groupId={params.id} activeTab="analytics"/>

      <Show when={data.loading}><div class="flex items-center justify-center py-20"><span class="w-6 h-6 border-2 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin"/></div></Show>

      <Show when={!data.loading}>
        <div class="px-5 mt-4 space-y-4">
          {/* Stats Grid */}
          <div class="grid grid-cols-2 gap-3">
            <For each={statCards()}>{(stat,i)=>(
              <Motion.div initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{duration:0.3,delay:i()*0.05}}
                class="bg-[#1c1c1c] rounded-2xl border border-[#2a2a2a] p-4 flex flex-col gap-1">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px]" style={{color:stat.color}}>{stat.icon}</span>
                  <span class="text-[11px] font-bold text-[#8e8e93] uppercase">{stat.label}</span>
                </div>
                <span class="text-[22px] font-black text-white">{stat.value.toLocaleString()}</span>
                <Show when={stat.change!==0}>
                  <span class={`text-[11px] font-bold ${stat.change>0?'text-[#34c759]':'text-[#ff3b30]'}`}>
                    {stat.change>0?'↑':'↓'} {Math.abs(stat.change)} {stat.change>0?t('analyticsSettings.trendUp'):t('analyticsSettings.trendDown')}
                  </span>
                </Show>
              </Motion.div>
            )}</For>
          </div>

          {/* Growth Chart */}
          <Motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.4,delay:0.2}}
            class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4">
            {renderChart(data()?.growth || [], '#34c759', t('analyticsSettings.growthChart'))}
          </Motion.div>

          {/* Activity Chart */}
          <Motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.4,delay:0.3}}
            class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4">
            {renderChart(data()?.activity || [], '#3390ec', t('analyticsSettings.activityChart'))}
          </Motion.div>
        </div>
      </Show>
    </div>
  );
};
