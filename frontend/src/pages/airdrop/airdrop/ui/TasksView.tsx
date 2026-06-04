import { Component, createSignal, For, Show } from 'solid-js';
import { createQuery } from '@tanstack/solid-query';
import { t, locale } from '@/shared/i18n/index.js';
import { hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { syncProfileStats } from '@/shared/store/airdrop.js';
import { SectionHeader } from '@/shared/ui/section-header.js';
import { getTasksStatus, completeTask, TaskStatus } from '@/shared/api/profile.js';

const isRtl = () => locale() === 'fa';

export const TasksView: Component = () => {
  const [taskErrors, setTaskErrors] = createSignal<Record<string, string>>({});
  const [loadingKeys, setLoadingKeys] = createSignal<Record<string, boolean>>({});

  const tasksQuery = createQuery(() => ({
    queryKey: ['tasks-status'],
    queryFn: getTasksStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }));

  const handleTaskClick = async (task: TaskStatus) => {
    if (task.completed) return;
    const key = task.key;
    
    // Clear previous errors
    setTaskErrors(prev => ({ ...prev, [key]: '' }));
    setLoadingKeys(prev => ({ ...prev, [key]: true }));
    
    try { hapticFeedback.impactOccurred('medium'); } catch (_) {}

    // CTA Redirect if Telegram channel task
    if (key === "join_ifragment_channel") {
      openTelegramLink("https://t.me/ifragment_net");
      // Give a tiny timeout for channel redirection before triggering verification
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    try {
      const result = await completeTask(key);
      if (result) {
        try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
        tasksQuery.refetch();
        await syncProfileStats();
      }
    } catch (e: any) {
      console.error("Failed to complete task:", e);
      let farsiErr = "شرایط انجام این ماموریت هنوز برقرار نیست";
      if (e.message) {
        if (e.message.includes("search/scan")) {
          farsiErr = "ابتدا باید حداقل یک یوزرنیم تلگرام را جستجو/اسکن کنید";
        } else if (e.message.includes("managed bot")) {
          farsiErr = "ابتدا باید حداقل یک ربات مدیریت کانال ثبت کنید";
        } else {
          farsiErr = e.message;
        }
      }
      setTaskErrors(prev => ({ ...prev, [key]: farsiErr }));
      try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
    } finally {
      setLoadingKeys(prev => ({ ...prev, [key]: false }));
    }
  };

  const getTaskDetails = (key: string) => {
    switch (key) {
      case "join_ifragment_channel":
        return {
          title: "عضویت در کانال رسمی iFragment",
          desc: "به کانال رسمی تلگرام ما بپیوندید",
          icon: "campaign",
          color: "#3390ec"
        };
      case "first_username_scan":
        return {
          title: "اولین جستجو و اسکن یوزرنیم",
          desc: "یک یوزرنیم تلگرام را در سربرگ جستجو اسکن کنید",
          icon: "search",
          color: "#fbbf24"
        };
      case "register_first_bot":
        return {
          title: "ثبت اولین ربات مدیریت",
          desc: "یک ربات مدیریت در بخش مدیریت پنل ثبت و فعال کنید",
          icon: "smart_toy",
          color: "#34c759"
        };
      default:
        return {
          title: "ماموریت ویژه سیستم",
          desc: "شرایط ویژه این ماموریت را تکمیل کنید",
          icon: "assignment_turned_in",
          color: "#06b6d4"
        };
    }
  };

  return (
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-8 animate-fade-in no-scrollbar">
      <SectionHeader icon="assignment" title={t('airdrop.tasks.title')} subtitle={t('airdrop.tasks.subtitle')} gradient="#3390ec, #1a6fcc" shadowColor="rgba(51,144,236,0.3)" />

      {/* Referral Card */}
      <div class="bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e] rounded-2xl p-5 mb-6 border border-white/[0.06] relative overflow-hidden">
        <div class={`absolute top-0 ${isRtl() ? 'left-0' : 'right-0'} w-32 h-32 bg-[#3390ec]/20 blur-[50px] rounded-full pointer-events-none`}></div>
        <div class="relative z-10 flex items-center justify-between mb-4">
          <div>
            <h3 class="text-white font-bold text-sm flex items-center gap-2 mb-1">
              <span class="material-symbols-outlined text-[#3390ec] text-lg" style={{ 'font-variation-settings': '"FILL" 1' }}>people</span>
              {t('airdrop.friends.title')}
            </h3>
            <p class="text-[#8e8e93] text-xs max-w-[180px]">{t('airdrop.friends.subtitle')}</p>
          </div>
          <div class="w-12 h-12 rounded-xl bg-[#3390ec]/10 flex items-center justify-center">
            <span class="material-symbols-outlined text-[#3390ec] text-2xl" style={{ 'font-variation-settings': '"FILL" 1' }}>person_add</span>
          </div>
        </div>
        <button 
          onClick={() => {
            try { hapticFeedback.impactOccurred('light'); } catch (_) {}
            const link = 'https://t.me/iFragmentBot?start=ref_abc123';
            openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t('airdrop.friends.subtitle'))}`);
          }}
          class="w-full bg-[#3390ec] text-white font-bold py-3 rounded-xl active:scale-95 transition-transform text-sm shadow-[0_2px_10px_rgba(51,144,236,0.3)]"
        >
          {t('airdrop.friends.inviteBtn')}
        </button>
      </div>

      {/* System Tasks Section */}
      <div>
        <h2 class="text-white font-bold text-sm mb-2.5 flex items-center gap-2 px-1">
          <span class="material-symbols-outlined text-lg text-amber-400" style={{ 'font-variation-settings': '"FILL" 1' }}>military_tech</span>
          ماموریت‌های فعال ایردراپ
        </h2>
        <div class="bg-[#1c1c1e]/80 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/[0.04] min-h-[150px] flex flex-col">
          <Show 
            when={!tasksQuery.isLoading} 
            fallback={
              <div class="flex-1 flex items-center justify-center py-12">
                <div class="w-8 h-8 border-2 border-[#3390ec] border-t-transparent rounded-full animate-spin"></div>
              </div>
            }
          >
            <For each={tasksQuery.data} fallback={
              <div class="flex-1 flex items-center justify-center py-8 text-[#8e8e93] text-xs">هیچ ماموریت فعالی در حال حاضر وجود ندارد.</div>
            }>
              {(task, i) => {
                const details = getTaskDetails(task.key);
                return (
                  <div class={`flex flex-col px-4 py-3.5 ${i() < (tasksQuery.data?.length || 0) - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3 flex-1 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-[#2c2c2e] flex items-center justify-center shrink-0">
                          <span class="material-symbols-outlined text-xl" style={{ color: details.color }}>{details.icon}</span>
                        </div>
                        <div class="flex flex-col min-w-0">
                          <span class="text-white font-semibold text-[13px] truncate">{details.title}</span>
                          <span class="text-[#8e8e93] text-[10px] truncate mt-0.5">{details.desc}</span>
                          <span class="text-amber-400 font-bold text-xs flex items-center gap-1 mt-0.5">
                            <span class="material-symbols-outlined text-[13px]" style={{ 'font-variation-settings': '"FILL" 1' }}>monetization_on</span>
                            +{task.reward_frg.toLocaleString('en-US')} سکه
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleTaskClick(task)}
                        disabled={task.completed || loadingKeys()[task.key]}
                        class={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ml-3 ${
                          task.completed ? 'bg-[#34c759]/15 text-[#34c759]' :
                          loadingKeys()[task.key] ? 'bg-[#2c2c2e] text-[#8e8e93]' :
                          'bg-[#3390ec] text-white active:scale-95 shadow-[0_2px_10px_rgba(51,144,236,0.3)]'
                        }`}
                      >
                        {task.completed ? (
                          <span class="material-symbols-outlined text-sm" style={{ 'font-variation-settings': '"FILL" 1' }}>check_circle</span>
                        ) : loadingKeys()[task.key] ? (
                          <span class="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                        ) : (
                          task.key === "join_ifragment_channel" ? "عضویت و بررسی" : "بررسی و انجام"
                        )}
                      </button>
                    </div>
                    {taskErrors()[task.key] && (
                      <div class="text-red-500 font-semibold text-[10px] mt-2 px-1 flex items-center gap-1">
                        <span class="material-symbols-outlined text-xs">warning</span>
                        {taskErrors()[task.key]}
                      </div>
                    )}
                  </div>
                );
              }}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
};
