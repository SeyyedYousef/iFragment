import { Component, createSignal, For } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { setBalance } from '@/shared/store/airdrop.js';
import { SectionHeader } from '@/shared/ui/section-header.js';

interface Task {
  id: string;
  titleKey: string;
  reward: number;
  icon: string;
  type: 'daily' | 'partner' | 'social';
  status: 'todo' | 'verifying' | 'done';
}

export const TasksView: Component = () => {
  const [tasks, setTasks] = createSignal<Task[]>([
    { id: '1', titleKey: 'airdrop.tasks.joinChannel', reward: 50000, icon: 'campaign', type: 'daily', status: 'todo' },
    { id: '2', titleKey: 'airdrop.tasks.answerQuestion', reward: 10000, icon: 'quiz', type: 'daily', status: 'todo' },
    { id: '3', titleKey: 'airdrop.tasks.tapMilestone', reward: 25000, icon: 'trending_up', type: 'daily', status: 'todo' },
    { id: '4', titleKey: 'airdrop.tasks.joinSponsor', reward: 75000, icon: 'handshake', type: 'partner', status: 'todo' },
    { id: '5', titleKey: 'airdrop.tasks.buyNumber', reward: 150000, icon: 'shopping_bag', type: 'partner', status: 'done' },
    { id: '6', titleKey: 'airdrop.tasks.inviteFriend', reward: 10000, icon: 'person_add', type: 'social', status: 'todo' },
    { id: '7', titleKey: 'airdrop.tasks.followTwitter', reward: 30000, icon: 'share', type: 'social', status: 'todo' },
  ]);

  const handleTaskClick = (id: string) => {
    const task = tasks().find(t => t.id === id);
    if (!task || task.status !== 'todo') return;
    try { hapticFeedback.impactOccurred('light'); } catch (_) {}

    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'verifying' as const } : t));
    setTimeout(() => {
      setTasks(p => p.map(t => t.id === id ? { ...t, status: 'done' as const } : t));
      setBalance(b => b + task.reward);
      try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
    }, 2000);
  };

  const renderTaskGroup = (type: Task['type'], labelKey: string, icon: string, iconColor: string) => {
    const filtered = () => tasks().filter(t => t.type === type);
    return (
      <div class="mb-5">
        <h2 class="text-white font-bold text-sm mb-2.5 flex items-center gap-2 px-1">
          <span class={`material-symbols-outlined text-lg`} style={{ color: iconColor, 'font-variation-settings': '"FILL" 1' }}>{icon}</span>
          {t(labelKey as any)}
        </h2>
        <div class="bg-[#1c1c1e]/80 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/[0.04]">
          <For each={filtered()}>
            {(task, i) => (
              <div class={`flex items-center justify-between px-4 py-3.5 ${i() < filtered().length - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <div class="w-10 h-10 rounded-xl bg-[#2c2c2e] flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-xl" style={{ color: iconColor }}>{task.icon}</span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-white font-semibold text-[13px] truncate">{t(task.titleKey as any)}</span>
                    <span class="text-amber-400 font-bold text-xs flex items-center gap-1 mt-0.5">
                      <span class="material-symbols-outlined text-[13px]" style={{ 'font-variation-settings': '"FILL" 1' }}>monetization_on</span>
                      +{task.reward.toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleTaskClick(task.id)}
                  disabled={task.status !== 'todo'}
                  class={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ml-3 ${
                    task.status === 'done' ? 'bg-[#34c759]/15 text-[#34c759]' :
                    task.status === 'verifying' ? 'bg-[#2c2c2e] text-[#8e8e93]' :
                    'bg-[#3390ec] text-white active:scale-95 shadow-[0_2px_10px_rgba(51,144,236,0.3)]'
                  }`}
                >
                  {task.status === 'done' ? (
                    <span class="material-symbols-outlined text-sm" style={{ 'font-variation-settings': '"FILL" 1' }}>check_circle</span>
                  ) : task.status === 'verifying' ? (
                    <span class="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  ) : t('airdrop.tasks.startBtn')}
                </button>
              </div>
            )}
          </For>
        </div>
      </div>
    );
  };

  return (
    <div class="flex-1 overflow-y-auto px-4 pt-4 pb-8 animate-fade-in no-scrollbar">
      <SectionHeader icon="assignment" title={t('airdrop.tasks.title')} subtitle={t('airdrop.tasks.subtitle')} gradient="#3390ec, #1a6fcc" shadowColor="rgba(51,144,236,0.3)" />

      {/* Referral Card */}
      <div class="bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e] rounded-2xl p-5 mb-6 border border-white/[0.06] relative overflow-hidden">
        <div class="absolute top-0 right-0 w-32 h-32 bg-[#3390ec]/20 blur-[50px] rounded-full pointer-events-none"></div>
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
            window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t('airdrop.friends.subtitle'))}`, '_blank');
          }}
          class="w-full bg-[#3390ec] text-white font-bold py-3 rounded-xl active:scale-95 transition-transform text-sm shadow-[0_2px_10px_rgba(51,144,236,0.3)]"
        >
          {t('airdrop.friends.inviteBtn')}
        </button>
      </div>

      {renderTaskGroup('daily', 'airdrop.tasks.daily', 'wb_sunny', '#fbbf24')}
      {renderTaskGroup('social', 'airdrop.tasks.social', 'groups', '#3390ec')}
      {renderTaskGroup('partner', 'airdrop.tasks.partners', 'verified', '#34c759')}
    </div>
  );
};
