import { Component, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { backButton, hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { getTasksStatus, completeTask } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
import { SkeletonTask } from '@/shared/ui/Skeleton.js';

export const TasksPage: Component = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = createSignal<{ text: string; error: boolean } | null>(null);

  const tasksQuery = createQuery(() => ({
    queryKey: ['profile', 'tasks'],
    queryFn: getTasksStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  }));

  const completeTaskMutation = createMutation(() => ({
    mutationFn: ({ key }: { key: string }) => completeTask(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'stats'] });
      try { hapticFeedback.notificationOccurred('success'); } catch {}
      setMessage({ text: t('gamification.taskCompletedSuccess') || 'Task completed successfully! Reward credited.', error: false });
    },
    onError: (err: any) => {
      try { hapticFeedback.notificationOccurred('error'); } catch {}
      setMessage({ text: err.message || t('gamification.taskVerifyFailed') || 'Failed to verify task requirements.', error: true });
    }
  }));

  const tasks = () => tasksQuery.data || [];
  const loading = () => tasksQuery.isLoading;

  onMount(() => {
    try {
      backButton.show();
      const off = backButton.onClick(() => {
        try { hapticFeedback.impactOccurred('light'); } catch {}
        navigate('/profile');
      });
      onCleanup(() => {
        off();
        try { backButton.hide(); } catch {}
      });
    } catch {}
  });

  const handleComplete = async (key: string) => {
    setMessage(null);
    try {
      try { hapticFeedback.impactOccurred('medium'); } catch {}
      
      // If joining telegram channel, redirect user to the link first
      if (key === 'join_ifragment_channel') {
        openTelegramLink('https://t.me/iFragment_Official');
      }

      completeTaskMutation.mutate({ key });
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-32 text-white font-sans">
      {/* Header */}
      <div class="relative bg-gradient-to-b from-[#1a1b23] to-[#0f1014] pt-12 pb-8 px-6 text-center border-b border-[#222]">
        <div class="absolute top-4 left-6 flex items-center gap-2">
          <button 
            onClick={() => {
              try { hapticFeedback.impactOccurred('light'); } catch {}
              navigate('/profile');
            }} 
            class="flex items-center justify-center w-8 h-8 rounded-full bg-[#1c1c1c] border border-[#2a2a2a]"
          >
            <span class="material-symbols-outlined text-[16px] text-white">arrow_back</span>
          </button>
        </div>

        <h1 class="text-2xl font-black tracking-tight text-white mb-1">{t('gamification.questHub') || 'Quest Hub'}</h1>
        <p class="text-xs text-[#a0a4ad]">{t('gamification.questsSubtitle') || 'Complete specialized tasks to earn FRG and XP'}</p>
      </div>

      <div class="px-6 py-6 flex flex-col gap-4">
        {/* Status Toast */}
        <Show when={message()}>
          <div 
            class={`border rounded-2xl p-4 text-xs font-bold ${
              message()?.error ? 'bg-[#ff3b30]/10 border-[#ff3b30]/30 text-[#ff3b30]' : 'bg-[#34c759]/10 border-[#34c759]/30 text-[#34c759]'
            }`}
          >
            {message()?.text}
          </div>
        </Show>

        {loading() ? (
          <div class="flex flex-col gap-3">
            <SkeletonTask />
            <SkeletonTask />
            <SkeletonTask />
          </div>
        ) : (
          <div class="flex flex-col gap-3">
            <For each={tasks()}>
              {(task) => (
                <div class={`flex items-center justify-between border rounded-3xl p-5 bg-[#15161d]/60 border-[#222]/80 transition-all ${task.completed ? 'opacity-60' : 'hover:border-[#3390ec]/30'}`}>
                  <div class="flex flex-col gap-1 max-w-[65%]">
                    <span class="text-xs font-black text-white">{task.title}</span>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="px-2 py-0.5 rounded-lg bg-[#3390ec]/10 border border-[#3390ec]/20 text-[9px] font-black text-[#3390ec]">
                        +{task.reward_frg.toLocaleString()} FRG
                      </span>
                      <span class="px-2 py-0.5 rounded-lg bg-[#34c759]/10 border border-[#34c759]/20 text-[9px] font-black text-[#34c759]">
                        +{task.reward_xp} XP
                      </span>
                    </div>
                  </div>

                  <div>
                    <Show 
                      when={task.completed}
                      fallback={
                        <button
                          onClick={() => handleComplete(task.key)}
                          disabled={completeTaskMutation.isPending && completeTaskMutation.variables?.key === task.key}
                          class="px-4 py-2 bg-[#3390ec] active:scale-95 disabled:opacity-50 text-[10px] font-black text-white rounded-xl uppercase tracking-wider transition-all"
                        >
                          {completeTaskMutation.isPending && completeTaskMutation.variables?.key === task.key ? (t('gamification.verifying') || 'Verifying...') : (t('gamification.claim') || 'Claim')}
                        </button>
                      }
                    >
                      <div class="w-8 h-8 rounded-full bg-[#34c759]/10 border border-[#34c759]/20 flex items-center justify-center text-[#34c759]">
                        <span class="material-symbols-outlined text-[16px]">check</span>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        )}
      </div>
    </div>
  );
};
