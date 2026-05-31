import { Component, createSignal, onCleanup, onMount, Show, For, createResource } from 'solid-js';
import { useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { SelectField } from '@/shared/ui/settings-controls.js';
import { channelApi } from '@/shared/api/channel-management.js';

export const ChannelAuditLogPage: Component = () => {
  const params = useParams();
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  
  const [actionFilter, setActionFilter] = createSignal('all');
  const [searchQuery, setSearchQuery] = createSignal('');

  const [auditLogsData] = createResource(
    () => params.id,
    (channelId) => channelApi.getAuditLogs(channelId)
  );

  const getActionIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('delete') || act.includes('remove') || act.includes('disconnect')) return 'delete';
    if (act.includes('settings') || act.includes('update')) return 'settings';
    if (act.includes('ban') || act.includes('restrict')) return 'block';
    if (act.includes('create') || act.includes('add') || act.includes('connect')) return 'add_circle';
    if (act.includes('sync')) return 'sync';
    return 'info';
  };

  const getActionColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('delete') || act.includes('remove') || act.includes('disconnect')) return '#ff3b30'; // Red
    if (act.includes('settings') || act.includes('update')) return '#32ade6'; // Blue
    if (act.includes('ban') || act.includes('restrict')) return '#ff9f0a'; // Orange
    if (act.includes('create') || act.includes('add') || act.includes('connect')) return '#34c759'; // Green
    if (act.includes('sync')) return '#00c7e6'; // Cyan
    return '#8e8e93';
  };

  const formatLogTime = (timeStr: string) => {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredLogs = () => {
    const list = auditLogsData()?.data || [];
    return list.filter((log: any) => {
       const searchStr = searchQuery().toLowerCase();
       const actionMatch = actionFilter() === 'all' || log.action.toLowerCase().includes(actionFilter().toLowerCase());
       
       const actionStr = log.action.toLowerCase();
       const actorStr = log.actor_name.toLowerCase();
       
       const textMatch = actionStr.includes(searchStr) || actorStr.includes(searchStr);

       return textMatch && actionMatch;
    });
  };

  const handleExport = (format: 'csv' | 'json') => {
    hapticFeedback.notificationOccurred('success');
    console.log(`Exporting logs as ${format.toUpperCase()}`);
  };

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => window.history.back());
    onCleanup(() => off());
  });

  return (
    <div class="min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white">
      {/* Header */}
      <div class="px-5 pt-6 pb-4 bg-[#0f1014] sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center justify-between">
        <div class="flex flex-col">
          <h1 class="text-[20px] font-black text-white leading-tight">{t('channelAuditLog.title') || 'Audit Log'}</h1>
          <span class="text-[12px] text-on-surface-variant">{t('channelAuditLog.subtitle') || 'Track all administrative actions'}</span>
        </div>
        
        <button 
          onClick={() => setIsMenuOpen(true)}
          class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-95 transition-all shrink-0"
        >
          <span class="material-symbols-outlined text-white text-[20px]">menu</span>
        </button>
      </div>

      <ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="audit-log" />

      <div class="px-5 pt-6 flex flex-col gap-5 pb-10">
        
        <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} class="flex flex-col gap-4">
          
          {/* Search Bar */}
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e93]">search</span>
            <input 
               type="text" 
               value={searchQuery()} 
               onInput={(e) => setSearchQuery(e.currentTarget.value)}
               placeholder={t('channelAuditLog.searchPlaceholder') || 'Search logs by action or name...'}
               class="bg-[#1c1c1c] text-white text-[15px] rounded-xl pl-10 pr-4 py-3 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6] border border-[#2a2a2a]"
            />
          </div>

          <div class="flex flex-col gap-3">
             {/* Action Filter */}
             <SelectField 
               label={t('channelAuditLog.filterAction') || 'Action'}
               value={actionFilter()}
               onChange={setActionFilter}
               options={[
                 { value: 'all', label: t('channelAuditLog.allActions') || 'All Actions' },
                 { value: 'delete', label: t('channelAuditLog.actDeleted') || 'Deleted' },
                 { value: 'settings', label: t('channelAuditLog.actSettings') || 'Settings' },
                 { value: 'sync', label: 'Synced' }
               ]}
             />
          </div>

          {/* Export Buttons */}
          <div class="flex items-center gap-3">
             <button onClick={() => handleExport('csv')} class="flex-1 bg-[#1c1c1c] border border-[#2a2a2a] py-2 rounded-xl text-[13px] font-bold hover:bg-[#2c2c2e] transition-colors flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-[16px]">download</span>
                {t('channelAuditLog.exportCsv') || 'Export CSV'}
             </button>
             <button onClick={() => handleExport('json')} class="flex-1 bg-[#1c1c1c] border border-[#2a2a2a] py-2 rounded-xl text-[13px] font-bold hover:bg-[#2c2c2e] transition-colors flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-[16px]">data_object</span>
                {t('channelAuditLog.exportJson') || 'Export JSON'}
             </button>
          </div>

          <div class="h-[1px] bg-[#2a2a2a] w-full my-1"></div>

          {/* Log List */}
          <div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-5 flex flex-col gap-5">
            <Show when={filteredLogs().length === 0}>
               <div class="py-8 flex flex-col items-center justify-center text-center gap-2">
                  <span class="material-symbols-outlined text-[40px] text-[#8e8e93]">receipt_long</span>
                  <span class="text-[#8e8e93] text-[14px]">{t('channelAuditLog.noLogs') || 'No logs match your search criteria.'}</span>
               </div>
            </Show>
            <For each={filteredLogs()}>
              {(log: any, i) => (
                <div class="flex gap-4 relative">
                  <Show when={i() !== filteredLogs().length - 1}>
                    <div class="absolute left-[19px] top-10 bottom-[-20px] w-[2px] bg-[#2a2a2a]"></div>
                  </Show>
                  <div class={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10`} style={{ "background-color": `${getActionColor(log.action)}20`, color: getActionColor(log.action) }}>
                     <span class="material-symbols-outlined text-[18px]">{getActionIcon(log.action)}</span>
                  </div>
                  <div class="flex flex-col flex-1 min-w-0 pt-1">
                     <div class="flex items-center justify-between gap-2">
                       <span class="text-[14px] font-bold text-white truncate">{log.actor_name}</span>
                       <span class="text-[11px] text-[#8e8e93] font-mono shrink-0">{formatLogTime(log.created_at)}</span>
                     </div>
                     <div class="flex items-center gap-1.5 mt-0.5">
                       <span class="text-[12px] font-bold uppercase tracking-wide" style={{ color: getActionColor(log.action) }}>{log.action}</span>
                     </div>
                  </div>
                </div>
              )}
            </For>
          </div>

        </Motion.div>
      </div>
    </div>
  );
};
