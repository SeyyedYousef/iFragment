import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { apiClient } from '@/shared/api/axios.js';
import { t } from '@/shared/i18n/index.js';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';

interface AuditLog {
  id: string;
  owner_id: number;
  action: string;
  target_user_id?: number;
  payload?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export const OwnerAuditLog: Component = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = createSignal<AuditLog[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [offset, setOffset] = createSignal(0);
  const limit = 20;

  const loadLogs = async (currentOffset: number, append: boolean = false) => {
    setLoading(true);
    try {
      const resp = await apiClient.get(`/owner/audit-logs?limit=${limit}&offset=${currentOffset}`);
      const newLogs = resp.data || [];
      
      if (append) {
        setLogs([...logs(), ...newLogs]);
      } else {
        setLogs(newLogs);
      }
    } catch (err: any) {
      setError(t('ownerAuditLog.retrieveError'));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadLogs(0);
  });

  const handleLoadMore = () => {
    try { hapticFeedback.impactOccurred('light'); } catch {}
    const newOffset = offset() + limit;
    setOffset(newOffset);
    loadLogs(newOffset, true);
  };

  const handleNav = (path: string) => {
    try { hapticFeedback.impactOccurred('light'); } catch {}
    navigate(path);
  };

  return (
    <div class="min-h-screen bg-[#090a0f] text-white pb-32">
      {/* Header glow */}
      <div class="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-[#3390ec]/15 to-transparent pointer-events-none blur-[60px]" />

      {/* Header */}
      <div class="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/5 relative z-10">
        <div class="flex items-center gap-3">
          <div 
            onClick={() => handleNav('/owner/dashboard')}
            class="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 active:scale-95 transition-all"
          >
            <span class="material-symbols-outlined text-[18px] text-white/70">chevron_left</span>
          </div>
          <div>
            <h1 class="text-sm font-black uppercase tracking-wider text-white">{t('ownerAuditLog.title')}</h1>
            <p class="text-[9px] text-[#3390ec] font-black uppercase tracking-widest mt-0.5">{t('ownerAuditLog.systemSecurity')}</p>
          </div>
        </div>
      </div>

      <OwnerTabs active="audit-logs" />

      {/* Content */}
      <div class="px-6 mt-6 relative z-10">
        
        <Show when={error()}>
          <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-3xl text-center py-6">
            <span class="material-symbols-outlined text-red-500 text-3xl mb-2">info</span>
            <p class="text-xs text-red-400 font-bold leading-relaxed">{error()}</p>
          </div>
        </Show>

        {/* Logs list */}
        <div class="flex flex-col gap-3.5">
          <For each={logs()}>
            {(log) => (
              <div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5">
                <div class="flex justify-between items-start gap-4 mb-2 pb-2 border-b border-white/5">
                  <span class="px-2 py-0.5 rounded bg-[#3390ec]/10 border border-[#3390ec]/20 text-[8px] font-black uppercase tracking-wider text-[#3390ec]">
                    {log.action}
                  </span>
                  <span class="text-[9px] text-[#a0a4ad] font-bold">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>

                <div class="flex flex-col gap-1.5 text-xs">
                  <div class="flex justify-between text-white/60">
                    <span class="font-bold">{t('ownerAuditLog.operatorId')}</span>
                    <span class="text-white font-medium">{log.owner_id}</span>
                  </div>
                  <Show when={log.target_user_id}>
                    <div class="flex justify-between text-white/60">
                      <span class="font-bold">{t('ownerAuditLog.targetId')}</span>
                      <span class="text-[#3390ec] font-medium">{log.target_user_id}</span>
                    </div>
                  </Show>
                  <Show when={log.ip_address}>
                    <div class="flex justify-between text-white/60">
                      <span class="font-bold">{t('ownerAuditLog.ipAddress')}</span>
                      <span class="font-mono text-[10px] text-white/80">{log.ip_address}</span>
                    </div>
                  </Show>
                  <Show when={log.user_agent}>
                    <div class="flex flex-col gap-0.5 text-white/60">
                      <span class="font-bold">{t('ownerAuditLog.userAgent')}</span>
                      <span class="text-[10px] text-white/40 leading-relaxed font-mono truncate">{log.user_agent}</span>
                    </div>
                  </Show>
                  <Show when={log.payload}>
                    <div class="mt-2 p-3 bg-[#0f1014] border border-[#2a2c35]/30 rounded-2xl flex flex-col gap-1 font-mono text-[9px] text-white/50">
                      <span class="font-bold text-[#a0a4ad] uppercase text-[8px] tracking-wide mb-1">{t('ownerAuditLog.payloadChanges')}</span>
                      <pre class="whitespace-pre-wrap break-all leading-normal">{JSON.stringify(log.payload, null, 2)}</pre>
                    </div>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Load more button */}
        <Show when={!loading() && logs().length >= limit}>
          <button 
            onClick={handleLoadMore}
            class="w-full h-12 mt-6 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-wider text-white rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <span class="material-symbols-outlined text-[16px]">expand_more</span>
            {t('ownerAuditLog.loadMore')}
          </button>
        </Show>

        <Show when={loading()}>
          <div class="flex justify-center items-center py-8">
            <div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
          </div>
        </Show>

      </div>
    </div>
  );
};
