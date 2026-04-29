import { Component, createSignal, For, onMount, onCleanup } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t, locale } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';

const isRtl = () => locale() === 'fa';

// Mock Data
const MOCK_GROWTH = [12, 18, 15, 25, 32, 45, 52];
const MOCK_ACTIVITY = [120, 200, 150, 300, 250, 400, 380];

export const AnalyticsPage: Component = () => {
  const navigate = useNavigate();
  const params = useParams();

  // Menu State
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);

  // Handle Telegram Back Button
  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => {
      hapticFeedback.impactOccurred('light');
      window.history.back();
    });
    onCleanup(() => off());
  });

  const [dateRange, setDateRange] = createSignal<'7d' | '30d' | '90d'>('7d');
  const [granularity, setGranularity] = createSignal<'daily' | 'weekly'>('daily');

  // Helper to generate SVG Path for Area Chart
  const generateAreaPath = (data: number[], width: number, height: number) => {
    const max = Math.max(...data);
    const min = 0; // Or Math.min(...data)
    const range = max - min || 1;
    const stepX = width / (data.length - 1 || 1);

    const points = data.map((val, i) => {
      const x = i * stepX;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    });

    const pathData = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;
    const strokeData = `M ${points.join(' L ')}`;

    return { pathData, strokeData };
  };

  const areaChart = () => generateAreaPath(MOCK_GROWTH, 300, 100);

  return (
    <div class="min-h-screen bg-[#0f1014] text-white pb-10 overflow-x-hidden" dir={isRtl() ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div class="pt-6 pb-4 px-5 sticky top-0 bg-[#0f1014]/90 backdrop-blur-md z-20 border-b border-[#2a2a2a] flex items-center justify-between">
        <Motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          class="flex flex-col gap-1"
        >
          <h1 class="text-2xl font-black text-white">{t('analyticsSettings.title')}</h1>
          <p class="text-[13px] text-[#8e8e93] font-medium leading-snug">
            {t('analyticsSettings.subtitle')}
          </p>
        </Motion.div>

        <button 
          onClick={() => setIsMenuOpen(true)}
          class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors shrink-0"
        >
          <span class="material-symbols-outlined text-white text-[20px]">menu</span>
        </button>
      </div>

      <HamburgerMenu 
        isOpen={isMenuOpen()} 
        onClose={() => setIsMenuOpen(false)} 
        groupId={params.id} 
        activeTab="analytics" 
      />

      <div class="p-5 flex flex-col gap-5">
        
        {/* Filters */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          class="flex flex-col gap-3"
        >
          <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <For each={[{ id: '7d', label: t('analyticsSettings.range7d') }, { id: '30d', label: t('analyticsSettings.range30d') }, { id: '90d', label: t('analyticsSettings.range90d') }] as const}>
              {(range) => (
                <button 
                  onClick={() => { hapticFeedback.selectionChanged(); setDateRange(range.id); }}
                  class={`px-4 py-2 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors ${
                    dateRange() === range.id ? 'bg-[#3390ec] text-white' : 'bg-[#1c1c1c] text-[#8e8e93] border border-[#2a2a2a]'
                  }`}
                >
                  {range.label}
                </button>
              )}
            </For>
          </div>
        </Motion.div>

        {/* Stat Cards Grid */}
        <div class="grid grid-cols-2 gap-3">
          <Motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-2 relative overflow-hidden">
            <div class="absolute right-0 top-0 w-16 h-16 bg-[#34c759]/10 rounded-full blur-xl"></div>
            <span class="text-[12px] font-bold text-[#8e8e93]">{t('analyticsSettings.newMembers')}</span>
            <span class="text-2xl font-black text-white">1,245</span>
            <div class="flex items-center gap-1 text-[#34c759]">
              <span class="material-symbols-outlined text-[14px]">trending_up</span>
              <span class="text-[11px] font-bold">+12.5%</span>
            </div>
          </Motion.div>

          <Motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-2 relative overflow-hidden">
            <div class="absolute right-0 top-0 w-16 h-16 bg-[#3390ec]/10 rounded-full blur-xl"></div>
            <span class="text-[12px] font-bold text-[#8e8e93]">{t('analyticsSettings.totalMessages')}</span>
            <span class="text-2xl font-black text-white">45.2K</span>
            <div class="flex items-center gap-1 text-[#3390ec]">
              <span class="material-symbols-outlined text-[14px]">trending_up</span>
              <span class="text-[11px] font-bold">+5.2%</span>
            </div>
          </Motion.div>

          <Motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }} class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-2">
            <span class="text-[12px] font-bold text-[#8e8e93]">{t('analyticsSettings.avgPerDay')}</span>
            <span class="text-2xl font-black text-white">1,850</span>
            <div class="flex items-center gap-1 text-[#ff3b30]">
              <span class="material-symbols-outlined text-[14px]">trending_down</span>
              <span class="text-[11px] font-bold">-2.1%</span>
            </div>
          </Motion.div>

          <Motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-2">
            <span class="text-[12px] font-bold text-[#8e8e93]">{t('analyticsSettings.topType')}</span>
            <div class="flex items-center gap-2 mt-1">
              <span class="material-symbols-outlined text-[#ffcc00] text-[28px]">image</span>
              <span class="text-[16px] font-black text-white">Photo</span>
            </div>
          </Motion.div>
        </div>

        {/* Growth Area Chart */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-5 flex flex-col gap-4"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-[15px] font-bold text-white">{t('analyticsSettings.growthChart')}</h2>
            <div class="bg-[#34c759]/10 text-[#34c759] px-2 py-0.5 rounded text-[11px] font-bold border border-[#34c759]/20">+150</div>
          </div>
          <div class="w-full h-[120px] relative">
             <svg class="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
               <defs>
                 <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="0%" stop-color="#34c759" stop-opacity="0.3" />
                   <stop offset="100%" stop-color="#34c759" stop-opacity="0" />
                 </linearGradient>
               </defs>
               <path d={areaChart().pathData} fill="url(#growthGradient)" />
               <path d={areaChart().strokeData} fill="none" stroke="#34c759" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
             </svg>
          </div>
        </Motion.div>

        {/* Activity Bar Chart */}
        <Motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-5 flex flex-col gap-4"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-[15px] font-bold text-white">{t('analyticsSettings.activityChart')}</h2>
            <div class="flex items-center gap-1 bg-[#2c2c2e] rounded-lg p-0.5">
              <button onClick={() => setGranularity('daily')} class={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${granularity() === 'daily' ? 'bg-[#3a3a3c] text-white' : 'text-[#8e8e93]'}`}>{t('analyticsSettings.daily')}</button>
              <button onClick={() => setGranularity('weekly')} class={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${granularity() === 'weekly' ? 'bg-[#3a3a3c] text-white' : 'text-[#8e8e93]'}`}>{t('analyticsSettings.weekly')}</button>
            </div>
          </div>
          
          <div class="w-full h-[120px] flex items-end justify-between gap-2 pt-2">
            <For each={MOCK_ACTIVITY}>
              {(val, idx) => {
                const max = Math.max(...MOCK_ACTIVITY);
                const heightPercent = (val / max) * 100;
                const isToday = idx() === MOCK_ACTIVITY.length - 1;
                return (
                  <div class="flex-1 flex flex-col justify-end items-center group relative h-full">
                    {/* Tooltip */}
                    <div class="absolute -top-8 bg-[#2a2a2a] text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                      {val} msgs
                    </div>
                    {/* Bar */}
                    <div 
                      class={`w-full rounded-t-sm transition-all duration-500 ease-out ${isToday ? 'bg-[#3390ec]' : 'bg-[#3390ec]/30 group-hover:bg-[#3390ec]/50'}`}
                      style={{ height: `${heightPercent}%` }}
                    ></div>
                  </div>
                );
              }}
            </For>
          </div>
        </Motion.div>

      </div>
    </div>
  );
};
