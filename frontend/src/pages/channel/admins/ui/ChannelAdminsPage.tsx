import { Component, createSignal, createResource, For, onCleanup, onMount, Show, createMemo } from 'solid-js';
import { useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Motion } from '@motionone/solid';
import { t } from '@/shared/i18n/index.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { channelApi } from '@/shared/api/channel-management.js';

export const ChannelAdminsPage: Component = () => {
  const params = useParams();
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [activeTab, setActiveTab] = createSignal<'admins' | 'members'>('admins');
  
  // Modal state
  const [editingAdmin, setEditingAdmin] = createSignal<any>(null);
  const [showModal, setShowModal] = createSignal(false);

  const [channelData] = createResource(
    () => params.id,
    (channelId) => channelApi.getChannel(channelId)
  );

  onMount(() => {
    backButton.show();
    const off = backButton.onClick(() => window.history.back());
    onCleanup(() => off());
  });

  // Mock Admin List
  const [allAdmins, setAllAdmins] = createSignal([
    { id: '1', name: 'Creator', role: 'Owner', customTitle: 'Founder', perms: { post: true, edit: true, delete: true, pin: true, invite: true, videoChat: true, editInfo: true, manageTags: true } },
    { id: '2', name: 'Moderator Bot', role: 'Bot', customTitle: '', perms: { post: false, edit: false, delete: true, pin: false, invite: false, videoChat: false, editInfo: false, manageTags: false } },
    { id: '3', name: 'Content Manager', role: 'Admin', customTitle: 'Editor', perms: { post: true, edit: true, delete: false, pin: true, invite: true, videoChat: false, editInfo: false, manageTags: true } },
  ]);

  // Mock Members List
  const [allMembers] = createSignal([
    { id: '10', name: 'John Doe', username: '@johndoe', joined: '2 days ago', status: 'active' },
    { id: '11', name: 'Alice Smith', username: '@alices', joined: '1 week ago', status: 'restricted' },
    { id: '12', name: 'Spam Bot', username: '@spambot99', joined: '1 hour ago', status: 'banned' },
  ]);

  const filteredItems = createMemo(() => {
    const q = searchQuery().toLowerCase();
    if (activeTab() === 'admins') {
      return allAdmins().filter(a => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q) || a.customTitle.toLowerCase().includes(q));
    } else {
      return allMembers().filter(m => m.name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q));
    }
  });

  const openAdminModal = (admin: any = null) => {
    if (admin) {
      setEditingAdmin(JSON.parse(JSON.stringify(admin)));
    } else {
      setEditingAdmin({
        id: Date.now().toString(), name: 'New Admin', role: 'Admin', customTitle: '',
        perms: { post: true, edit: true, delete: false, pin: false, invite: false, videoChat: false, editInfo: false, manageTags: false }
      });
    }
    setShowModal(true);
    hapticFeedback.impactOccurred('light');
  };

  const saveAdmin = () => {
    const isNew = !allAdmins().find(a => a.id === editingAdmin().id);
    if (isNew) setAllAdmins([...allAdmins(), editingAdmin()]);
    else setAllAdmins(allAdmins().map(a => a.id === editingAdmin().id ? editingAdmin() : a));
    setShowModal(false);
    hapticFeedback.notificationOccurred('success');
  };

  return (
    <div class="min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white">
      {/* Header */}
      <div class="px-5 pt-6 pb-4 bg-[#0f1014]/80 backdrop-blur-md sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center justify-between">
        <div class="flex flex-col">
          <div class="flex items-center gap-2">
            <h1 class="text-[20px] font-black text-white leading-tight">{t('channelAdmins.adminsAndPermissions')}</h1>
            <span class="bg-[#1c1c1c] border border-[#2a2a2a] text-[#8e8e93] text-[10px] font-bold px-2 py-0.5 rounded-md">
              {channelData()?.members_count?.toLocaleString() || '0'} {t('channelAdmins.members')}
            </span>
          </div>
          <span class="text-[12px] text-on-surface-variant">{t('channelAdmins.manageWhoCanPost')}</span>
        </div>
        
        <button 
          onClick={() => setIsMenuOpen(true)}
          class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all shrink-0 shadow-sm"
          aria-label="Open menu"
        >
          <span class="material-symbols-outlined text-white text-[20px]">menu</span>
        </button>
      </div>

      <ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="admins" />

      <Show when={channelData.loading}>
        <div class="flex items-center justify-center py-20">
          <span class="w-6 h-6 border-2 border-[#32ade6]/30 border-t-[#32ade6] rounded-full animate-spin" />
        </div>
      </Show>

      <Show when={!channelData.loading}>
        <div class="px-5 pt-4 flex flex-col gap-5">
          {/* Tabs */}
          <div class="bg-[#1c1c1c]/60 backdrop-blur-md p-1 rounded-2xl flex items-center w-full border border-white/5">
            <button 
              onClick={() => { setActiveTab('admins'); setSearchQuery(''); }}
              class={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-300 ${activeTab() === 'admins' ? 'bg-[#2c2c2e] text-white shadow-sm border border-white/5' : 'text-[#8e8e93] hover:text-white'}`}
            >
              {t('channelAdmins.currentAdmins')}
            </button>
            <button 
              onClick={() => { setActiveTab('members'); setSearchQuery(''); }}
              class={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-300 ${activeTab() === 'members' ? 'bg-[#2c2c2e] text-white shadow-sm border border-white/5' : 'text-[#8e8e93] hover:text-white'}`}
            >
              {t('channelAdmins.allMembers')}
            </button>
          </div>

          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} class="flex flex-col gap-3">
             <Show when={activeTab() === 'admins'}>
               <button onClick={() => openAdminModal()} class="w-full bg-[#32ade6]/10 border border-[#32ade6]/20 hover:bg-[#32ade6]/15 active:scale-[0.98] text-[#32ade6] rounded-2xl py-3.5 flex items-center justify-center gap-2 font-bold transition-all shadow-sm">
                 <span class="material-symbols-outlined text-[20px]">person_add</span>
                 {t('channelAdmins.addNewAdmin')}
               </button>
             </Show>
             
             {/* Search Bar */}
             <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[#a0a4ad] material-symbols-outlined text-[20px]">search</span>
                <input 
                  type="text" 
                  value={searchQuery()} 
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  placeholder={activeTab() === 'admins' ? t('channelAdmins.searchAdminsPlaceholder') || 'Search admins...' : t('channelAdmins.searchPlaceholder') || 'Search members...'}
                  class="bg-[#1c1c1c]/50 border border-white/5 text-white text-[15px] rounded-2xl pl-12 pr-4 py-3.5 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6]/40 placeholder-[#8e8e93] transition-all shadow-sm"
                />
             </div>
          </Motion.div>

          <div class="flex flex-col gap-3 pb-6">
            <Show when={filteredItems().length > 0} fallback={
               <div class="bg-[#1c1c1c]/50 rounded-3xl border border-white/5 py-12 flex flex-col items-center justify-center gap-3 shadow-inner">
                 <span class="material-symbols-outlined text-[#8e8e93] text-[36px] opacity-80">search_off</span>
                 <span class="text-[#8e8e93] text-[14px] font-semibold">{t('channelAdmins.noResults')}</span>
               </div>
            }>
               <div class="bg-[#1c1c1c]/60 backdrop-blur-md rounded-3xl border border-white/5 flex flex-col overflow-hidden shadow-md">
                 <For each={filteredItems()}>
                   {(item: any, i) => (
                      <Motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: 0.05 + (i() * 0.05) }}
                        class={`flex flex-col p-4.5 ${i() !== filteredItems().length - 1 ? 'border-b border-white/5' : ''}`}
                      >
                        <div class="flex items-center justify-between mb-2">
                          <div class="flex items-center gap-3.5">
                            <div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-[18px] text-[#32ade6] relative shadow-inner shrink-0">
                              {item.name.charAt(0)}
                              <Show when={item.role === 'Owner'}>
                                 <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-[#ff9f0a] rounded-lg border border-[#0f1014] flex items-center justify-center shadow-md">
                                    <span class="material-symbols-outlined text-[12px] text-black font-black">star</span>
                                 </div>
                              </Show>
                              <Show when={item.role === 'Bot'}>
                                 <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-[#bf5af2] rounded-lg border border-[#0f1014] flex items-center justify-center shadow-md">
                                    <span class="material-symbols-outlined text-[12px] text-white">smart_toy</span>
                                 </div>
                              </Show>
                            </div>
                            <div class="flex flex-col min-w-0">
                              <div class="flex items-center gap-2 flex-wrap">
                                <span class="text-[15px] font-bold text-white truncate max-w-[120px]">{item.name}</span>
                                <Show when={item.customTitle}>
                                   <span class="bg-[#32ade6]/10 text-[#32ade6] text-[10px] px-2 py-0.5 rounded-full border border-[#32ade6]/20 font-bold tracking-wide">
                                     {item.customTitle}
                                   </span>
                                </Show>
                              </div>
                              <span class="text-[12px] text-[#8e8e93] truncate mt-0.5">
                                {item.username || (item.role === 'Owner' ? t('channelAdmins.customTitle') : item.role === 'Bot' ? 'Bot' : 'Admin')}
                              </span>
                            </div>
                          </div>
                          
                          <Show when={activeTab() === 'admins'} fallback={
                             <div class="flex items-center gap-1.5">
                               <button 
                                 onClick={() => hapticFeedback.impactOccurred('light')} 
                                 class="w-9 h-9 rounded-xl bg-[#ff9f0a]/5 border border-[#ff9f0a]/10 hover:bg-[#ff9f0a]/15 hover:border-[#ff9f0a]/25 text-[#ff9f0a] flex items-center justify-center active:scale-95 transition-all shadow-sm" 
                                 title={t('channelAdmins.restrictUser')}
                               >
                                 <span class="material-symbols-outlined text-[16px]">do_not_disturb_on</span>
                               </button>
                               <button 
                                 onClick={() => hapticFeedback.impactOccurred('light')} 
                                 class="w-9 h-9 rounded-xl bg-[#ff3b30]/5 border border-[#ff3b30]/10 hover:bg-[#ff3b30]/15 hover:border-[#ff3b30]/25 text-[#ff3b30] flex items-center justify-center active:scale-95 transition-all shadow-sm" 
                                 title={t('channelAdmins.banUser')}
                               >
                                 <span class="material-symbols-outlined text-[16px]">block</span>
                               </button>
                               <button 
                                 onClick={() => openAdminModal(item)} 
                                 class="w-9 h-9 rounded-xl bg-[#34c759]/5 border border-[#34c759]/10 hover:bg-[#34c759]/15 hover:border-[#34c759]/25 text-[#34c759] flex items-center justify-center active:scale-95 transition-all shadow-sm" 
                                 title={t('channelAdmins.promoteToAdmin')}
                               >
                                 <span class="material-symbols-outlined text-[16px]">keyboard_double_arrow_up</span>
                               </button>
                             </div>
                          }>
                             <button 
                               onClick={() => openAdminModal(item)} 
                               class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-95 flex items-center justify-center transition-all shadow-sm"
                               aria-label={t('channelAdmins.edit')}
                             >
                               <span class="material-symbols-outlined text-[18px] text-[#8e8e93]">edit</span>
                             </button>
                          </Show>
                        </div>

                        {/* Beautiful Glassmorphic Permissions Badges for Admins */}
                        <Show when={activeTab() === 'admins'}>
                          <div class="flex flex-wrap gap-1.5 mt-2">
                            <span class={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${item.perms.post ? 'bg-[#34c759]/5 border-[#34c759]/20 text-[#34c759] shadow-[0_2px_8px_rgba(52,199,89,0.05)]' : 'bg-[#ff3b30]/5 border-[#ff3b30]/15 text-[#ff3b30]/80'}`}>
                              {t('channelAdmins.post')}
                            </span>
                            <span class={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${item.perms.edit ? 'bg-[#34c759]/5 border-[#34c759]/20 text-[#34c759] shadow-[0_2px_8px_rgba(52,199,89,0.05)]' : 'bg-[#ff3b30]/5 border-[#ff3b30]/15 text-[#ff3b30]/80'}`}>
                              {t('channelAdmins.edit')}
                            </span>
                            <span class={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${item.perms.delete ? 'bg-[#34c759]/5 border-[#34c759]/20 text-[#34c759] shadow-[0_2px_8px_rgba(52,199,89,0.05)]' : 'bg-[#ff3b30]/5 border-[#ff3b30]/15 text-[#ff3b30]/80'}`}>
                              {t('channelAdmins.delete')}
                            </span>
                            <span class={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${item.perms.pin ? 'bg-[#34c759]/5 border-[#34c759]/20 text-[#34c759] shadow-[0_2px_8px_rgba(52,199,89,0.05)]' : 'bg-white/5 border-white/10 text-[#8e8e93]'}`}>
                              {t('channelAdmins.pin')}
                            </span>
                            <span class={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all ${item.perms.invite ? 'bg-[#34c759]/5 border-[#34c759]/20 text-[#34c759] shadow-[0_2px_8px_rgba(52,199,89,0.05)]' : 'bg-white/5 border-white/10 text-[#8e8e93]'}`}>
                              {t('channelAdmins.invite')}
                            </span>
                          </div>
                        </Show>
                      </Motion.div>
                   )}
                 </For>
               </div>
            </Show>
          </div>
        </div>

        {/* Promote/Edit Admin Modal */}
        <Show when={showModal() && editingAdmin()}>
          <div class="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
            <Motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} class="bg-[#1c1c1c] w-full max-w-md rounded-[32px] border border-[#2a2a2a] flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
              <div class="p-5 border-b border-[#2a2a2a] flex items-center justify-between sticky top-0 bg-[#1c1c1c] z-10">
                <h2 class="text-[18px] font-bold text-white truncate pr-4">{editingAdmin()?.name}</h2>
                <button onClick={() => setShowModal(false)} class="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
                  <span class="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              
              <div class="p-5 overflow-y-auto flex flex-col gap-6">
                <div class="flex flex-col gap-2">
                  <label class="text-[12px] text-[#8e8e93] font-bold uppercase tracking-wider ml-1">{t('channelAdmins.customTitle')}</label>
                  <input 
                    type="text" 
                    value={editingAdmin().customTitle} 
                    onInput={(e) => setEditingAdmin({...editingAdmin(), customTitle: e.currentTarget.value})}
                    placeholder={t('channelAdmins.customTitlePlaceholder')}
                    class="bg-[#2c2c2e] text-white text-[15px] rounded-2xl px-4 py-3.5 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6] border border-transparent transition-all placeholder-[#a0a4ad] shadow-inner"
                  />
                </div>

                <div class="flex flex-col gap-2">
                  <label class="text-[12px] text-[#8e8e93] font-bold uppercase tracking-wider ml-1 mb-1">{t('channelAdmins.permissions')}</label>
                  <div class="bg-[#2c2c2e]/60 rounded-2xl p-1.5 flex flex-col border border-white/5 shadow-inner">
                    <For each={[
                      { key: 'post', label: t('channelAdmins.permCanPost') },
                      { key: 'edit', label: t('channelAdmins.permCanEdit') },
                      { key: 'delete', label: t('channelAdmins.permCanDelete') },
                      { key: 'pin', label: t('channelAdmins.permCanPin') },
                      { key: 'invite', label: t('channelAdmins.permCanInvite') },
                      { key: 'videoChat', label: t('channelAdmins.permCanManageVC') },
                      { key: 'editInfo', label: t('channelAdmins.permCanEditInfo') },
                      { key: 'manageTags', label: t('channelAdmins.permCanManageTags') }
                    ]}>
                      {(perm, index) => (
                        <div class={`flex items-center justify-between p-3.5 ${index() !== 7 ? 'border-b border-[#3a3a3c]/55' : ''}`}>
                           <span class="text-[15px] font-medium text-white">{perm.label}</span>
                           <ToggleSwitch 
                              checked={editingAdmin().perms[perm.key]} 
                              onChange={(v) => setEditingAdmin({...editingAdmin(), perms: {...editingAdmin().perms, [perm.key]: v}})} 
                           />
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
              
              <div class="p-5 border-t border-[#2a2a2a] bg-[#1c1c1c] sticky bottom-0">
                <button onClick={saveAdmin} class="w-full bg-[#32ade6] text-black font-bold text-[16px] py-4 rounded-2xl shadow-[0_4px_15px_rgba(50,173,230,0.35)] hover:bg-[#2b96c8] active:scale-[0.98] transition-all">
                  {t('channelAdmins.saveAdmin')}
                </button>
              </div>
            </Motion.div>
          </div>
        </Show>
      </Show>
    </div>
  );
};
