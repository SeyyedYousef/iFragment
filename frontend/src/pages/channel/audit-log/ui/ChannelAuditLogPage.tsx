import { Component, createSignal, onCleanup, onMount, Show, For } from 'solid-js';
import { useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { SelectField } from '@/shared/ui/settings-controls.js';

export const ChannelAuditLogPage: Component = () => {
  const params = useParams();
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  
  const [actionFilter, setActionFilter] = createSignal('all');
  const [dateFilter, setDateFilter] = createSignal('today');
  const [adminFilter, setAdminFilter] = createSignal('all');
  const [searchQuery, setSearchQuery] = createSignal('');

  const mockLogs = [
    { id: 1, action: 'deleted', user: 'Admin Sarah', target: 'Spam Message', time: '10:45 AM', icon: 'delete', color: '#ff3b30' },
    { id: 2, action: 'settings', user: 'Admin Mike', target: 'Auto-Forwarding Enabled', time: '09:12 AM', icon: 'settings', color: '#32ade6' },
    { id: 3, action: 'banned', user: 'System Bot', target: 'User @spammer99', time: '08:30 AM', icon: 'block', color: '#ff9f0a' },
    { id: 4, action: 'edited', user: 'Admin Sarah', target: 'Channel Description', time: 'Yesterday', icon: 'edit', color: '#34c759' },
    { id: 5, action: 'promoted', user: 'Owner', target: 'Admin Mike (Full Rights)', time: 'Yesterday', icon: 'verified_user', color: '#bf5af2' },
  ];

  const getLocalizedUser = (user: string) => {
    if (user === 'Admin Sarah') return t('channelAuditLog.adminSarah') || 'Admin Sarah';
    if (user === 'Admin Mike') return t('channelAuditLog.adminMike') || 'Admin Mike';
    if (user === 'System Bot') return t('channelAuditLog.systemBot') || 'System Bot';
    if (user === 'Owner') return t('channelAuditLog.owner') || 'Owner';
    return user;
  };

  const getLocalizedTarget = (target: string) => {
    if (target === 'Spam Message') return t('channelAuditLog.targetSpam') || 'Spam Message';
    if (target === 'Auto-Forwarding Enabled') return t('channelAuditLog.targetAutoForward') || 'Auto-Forwarding Enabled';
    if (target === 'User @spammer99') return t('channelAuditLog.targetUserSpammer') || 'User @spammer99';
    if (target === 'Channel Description') return t('channelAuditLog.targetDesc') || 'Channel Description';
    if (target === 'Admin Mike (Full Rights)') return t('channelAuditLog.targetMikeRights') || 'Admin Mike (Full Rights)';
    return target;
  };

  const getLocalizedTime = (time: string) => {
    if (time === 'Yesterday') return t('channelAuditLog.dateYesterday') || 'Yesterday';
    return time;
  };

  const getLocalizedAction = (action: string) => {
    if (action === 'deleted') return t('channelAuditLog.actDeleted') || 'Deleted';
    if (action === 'settings') return t('channelAuditLog.actSettings') || 'Settings';
    if (action === 'banned') return t('channelAuditLog.actBanned') || 'Banned';
    if (action === 'edited') return t('channelAuditLog.actEdited') || 'Edited';
    if (action === 'promoted') return t('channelAuditLog.actPromoted') || 'Promoted';
    if (action === 'demoted') return t('channelAuditLog.actDemoted') || 'Demoted';
    if (action === 'pinned') return t('channelAuditLog.actPinned') || 'Pinned';
    return action;
  };

  const filteredLogs = () => {
    return mockLogs.filter(log => {
       const userMatch = getLocalizedUser(log.user).toLowerCase().includes(searchQuery().toLowerCase());
       const targetMatch = getLocalizedTarget(log.target).toLowerCase().includes(searchQuery().toLowerCase());
       
       const actionMatch = actionFilter() === 'all' || log.action === actionFilter();
       const dateMatch = dateFilter() === 'all' || 
                         (dateFilter() === 'today' ? log.time.includes('AM') || log.time.includes('PM') : 
                         (dateFilter() === 'yesterday' ? log.time === 'Yesterday' : true));
       const adminMatch = adminFilter() === 'all' || log.user === adminFilter();

       return (userMatch || targetMatch) && actionMatch && dateMatch && adminMatch;
    });
  };

  const handleExport = (format: 'csv' | 'json') => {
    hapticFeedback.notificationOccurred('success');
    // Mock export logic
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

          <div class="grid grid-cols-2 gap-3">
             {/* Action Filter */}
             <SelectField 
               label={t('channelAuditLog.filterAction') || 'Action'}
               value={actionFilter()}
               onChange={setActionFilter}
               options={[
                 { value: 'all', label: t('channelAuditLog.allActions') || 'All Actions' },
                 { value: 'deleted', label: t('channelAuditLog.actDeleted') || 'Deleted' },
                 { value: 'settings', label: t('channelAuditLog.actSettings') || 'Settings' },
                 { value: 'banned', label: t('channelAuditLog.actBanned') || 'Banned' }
               ]}
             />
             
             {/* Date Filter */}
             <SelectField 
               label={t('channelAnalytics.timeRange') || 'Time Range'}
               value={dateFilter()}
               onChange={setDateFilter}
               options={[
                 { value: 'today', label: t('channelAuditLog.dateToday') || 'Today' },
                 { value: 'yesterday', label: t('channelAuditLog.dateYesterday') || 'Yesterday' },
                 { value: '7d', label: t('analyticsSettings.range7d') || 'Last 7 Days' },
                 { value: '30d', label: t('analyticsSettings.range30d') || 'Last 30 Days' },
                 { value: 'custom', label: t('channelAnalytics.rangeCustom') || 'Custom Range' }
               ]}
             />

             {/* Admin Filter */}
             <div class="col-span-2">
                <SelectField 
                  label={t('channelAuditLog.filterByAdmin') || 'Performed By'}
                  value={adminFilter()}
                  onChange={setAdminFilter}
                  options={[
                    { value: 'all', label: t('channelAuditLog.allAdmins') || 'All Admins & Bots' },
                    { value: 'sarah', label: t('channelAuditLog.adminSarah') || 'Admin Sarah' },
                    { value: 'mike', label: t('channelAuditLog.adminMike') || 'Admin Mike' },
                    { value: 'bot', label: t('channelAuditLog.systemBot') || 'System Bot' }
                  ]}
                />
             </div>
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
              {(log: {id: number, action: string, user: string, target: string, time: string, icon: string, color: string}, i) => (
                <div class="flex gap-4 relative">
                  <Show when={i() !== filteredLogs().length - 1}>
                    <div class="absolute left-[19px] top-10 bottom-[-20px] w-[2px] bg-[#2a2a2a]"></div>
                  </Show>
                  <div class={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10`} style={{ "background-color": `${log.color}20`, color: log.color }}>
                     <span class="material-symbols-outlined text-[18px]">{log.icon}</span>
                  </div>
                  <div class="flex flex-col flex-1 min-w-0 pt-1">
                     <div class="flex items-center justify-between gap-2">
                       <span class="text-[14px] font-bold text-white truncate">{getLocalizedUser(log.user)}</span>
                       <span class="text-[11px] text-[#8e8e93] font-mono shrink-0">{getLocalizedTime(log.time)}</span>
                     </div>
                     <div class="flex items-center gap-1.5 mt-0.5">
                       <span class="text-[12px] font-bold uppercase tracking-wide" style={{ color: log.color }}>{getLocalizedAction(log.action)}</span>
                       <span class="text-[12px] text-[#8e8e93]">•</span>
                       <span class="text-[13px] text-[#a0a4ad] truncate">{getLocalizedTarget(log.target)}</span>
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
