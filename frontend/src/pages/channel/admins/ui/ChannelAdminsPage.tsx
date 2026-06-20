import { Motion } from '@motionone/solid';
import { useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import {
	Component,
	createMemo,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { t } from '@/shared/i18n/index.js';
import { ChannelContextBar } from '@/shared/ui/ChannelContextBar.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

export const ChannelAdminsPage: Component = () => {
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [searchQuery, setSearchQuery] = createSignal('');

	// Modal state
	const [editingAdmin, setEditingAdmin] = createSignal<any>(null);
	const [showModal, setShowModal] = createSignal(false);

	const [channelData] = createResource(
		() => params.id,
		(channelId) => channelApi.getChannel(channelId),
	);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => window.history.back());
		onCleanup(() => off());
	});

	const [adminsData, { refetch }] = createResource(
		() => params.id,
		(channelId) => channelApi.getAdmins(channelId),
	);

	const [isSyncing, setIsSyncing] = createSignal(false);

	const handleSync = async () => {
		try {
			setIsSyncing(true);
			hapticFeedback.impactOccurred('light');
			await channelApi.syncAdmins(params.id);
			await refetch();
			hapticFeedback.notificationOccurred('success');
			showToast(t('channelAdmins.syncSuccess') || 'Admins synced from Telegram', 'success');
		} catch (err) {
			console.error(err);
			hapticFeedback.notificationOccurred('error');
			showToast(t('channelAdmins.syncFailed') || 'Failed to sync admins', 'error');
		} finally {
			setIsSyncing(false);
		}
	};

	const allAdmins = createMemo(() => {
		const list = adminsData() || [];
		return list.map((a: any) => ({
			id: a.telegram_id?.toString() || a.id || '',
			name: a.first_name || a.name || 'Unknown',
			role: a.is_owner ? 'Owner' : a.username?.toLowerCase().includes('bot') ? 'Bot' : 'Admin',
			customTitle: a.custom_title || '',
			username: a.username ? `@${a.username}` : '',
			perms: a.permissions || {
				post: true,
				edit: true,
				delete: true,
				pin: true,
				invite: true,
				videoChat: false,
				editInfo: false,
				manageTags: false,
				anonymous: false,
				promote: false,
				postStories: false,
				editStories: false,
				deleteStories: false,
			},
		}));
	});

	const filteredAdmins = createMemo(() => {
		const q = searchQuery().toLowerCase();
		return allAdmins().filter(
			(a: any) =>
				a.name.toLowerCase().includes(q) ||
				a.role.toLowerCase().includes(q) ||
				(a.customTitle && a.customTitle.toLowerCase().includes(q)),
		);
	});

	const groupedAdmins = createMemo(() => {
		const admins = filteredAdmins();
		const owners = admins.filter((a: any) => a.role === 'Owner');
		const bots = admins.filter((a: any) => a.role === 'Bot');
		
		const regularAdmins = admins.filter((a: any) => a.role !== 'Owner' && a.role !== 'Bot');
		// ادمین‌های خروجی (محتوا)
		const contentAdmins = regularAdmins.filter((a: any) => a.perms.post || a.perms.edit || a.perms.postStories);
		// ادمین‌های ورودی (عضوگیری و مدیریت)
		const inviteAdmins = regularAdmins.filter((a: any) => (a.perms.invite || a.perms.promote) && !contentAdmins.includes(a));
		// سایر ادمین‌ها
		const otherAdmins = regularAdmins.filter((a: any) => !contentAdmins.includes(a) && !inviteAdmins.includes(a));

		return [
			{ title: t('channelAdmins.owners') || 'Owners', items: owners },
			{ title: t('channelAdmins.contentAdmins') || 'Content Admins (Output)', items: contentAdmins },
			{ title: t('channelAdmins.inviteAdmins') || 'Community Admins (Input)', items: inviteAdmins },
			{ title: t('channelAdmins.otherAdmins') || 'Other Admins', items: otherAdmins },
			{ title: 'Bots', items: bots },
		].filter(g => g.items.length > 0);
	});

	const openAdminModal = (admin: any = null) => {
		if (admin) {
			const adminCopy = JSON.parse(JSON.stringify(admin));
			if (!adminCopy.perms) {
				adminCopy.perms = {
					post: true,
					edit: true,
					delete: false,
					pin: false,
					invite: false,
					videoChat: false,
					editInfo: false,
					manageTags: false,
					anonymous: false,
					promote: false,
					postStories: false,
					editStories: false,
					deleteStories: false,
				};
			}
			setEditingAdmin(adminCopy);
		} else {
			setEditingAdmin({
				id: Date.now().toString(),
				name: 'New Admin',
				role: 'Admin',
				customTitle: '',
				perms: {
					post: true,
					edit: true,
					delete: false,
					pin: false,
					invite: false,
					videoChat: false,
					editInfo: false,
					manageTags: false,
					anonymous: false,
					promote: false,
					postStories: false,
					editStories: false,
					deleteStories: false,
				},
			});
		}
		setShowModal(true);
		hapticFeedback.impactOccurred('light');
	};

	const [isSaving, setIsSaving] = createSignal(false);

	const saveAdmin = async () => {
		if (!editingAdmin()) return;
		try {
			setIsSaving(true);
			await channelApi.updateAdmin(params.id, editingAdmin().id, {
				custom_title: editingAdmin().customTitle,
				permissions: editingAdmin().perms,
			});
			hapticFeedback.notificationOccurred('success');
			setShowModal(false);
			refetch();
			showToast(t('channelAdmins.saveSuccess') || 'Admin permissions saved', 'success');
		} catch (err) {
			console.error(err);
			hapticFeedback.notificationOccurred('error');
			showToast(t('channelAdmins.saveFailed') || 'Failed to save admin permissions', 'error');
		} finally {
			setIsSaving(false);
		}
	};



	return (
		<div class="min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white">
			{/* Header */}
			<div class="px-5 pt-6 pb-4 bg-[#0f1014]/80 backdrop-blur-md sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center justify-between gap-3">
				<div class="flex items-center gap-2 overflow-hidden flex-1">
					<button
						onClick={() => {
							hapticFeedback.impactOccurred('light');
							window.history.back();
						}}
						class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
						aria-label="Back"
					>
						<span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2">
							<h1 class="text-[18px] font-black text-white leading-tight truncate">
								{t('channelAdmins.adminsAndPermissions')}
							</h1>
							<span class="bg-[#1c1c1c] border border-[#2a2a2a] text-[#8e8e93] text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0">
								{channelData()?.members_count?.toLocaleString() || '0'}
							</span>
						</div>
						<span class="text-[12px] text-on-surface-variant truncate">
							{t('channelAdmins.manageWhoCanPost')}
						</span>
					</div>
				</div>

				<button
					onClick={() => setIsMenuOpen(true)}
					class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-95 transition-all shrink-0"
					aria-label="Open menu"
				>
					<span class="material-symbols-outlined text-white text-[20px]">menu</span>
				</button>
			</div>

			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="admins"
			/>

			<div class="px-5 pt-4 flex flex-col gap-5">
				<ChannelContextBar channelId={params.id} />

				{/* Removing Members tab entirely as it doesn't work well due to Telegram API limitations */}

				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.05 }}
					class="flex flex-col gap-3"
				>
					<button
						onClick={handleSync}
						disabled={isSyncing()}
						class="w-full bg-[#32ade6]/10 border border-[#32ade6]/20 hover:bg-[#32ade6]/15 active:scale-[0.98] text-[#32ade6] rounded-2xl py-3.5 flex items-center justify-center gap-2 font-bold transition-all shadow-sm disabled:opacity-50"
					>
						<Show
							when={isSyncing()}
							fallback={
								<>
									<span class="material-symbols-outlined text-[20px]">sync</span>
									Sync from Telegram
								</>
							}
						>
							<span class="material-symbols-outlined text-[20px] animate-spin">sync</span>
							Syncing...
						</Show>
					</button>

					{/* Search Bar */}
					<div class="relative">
						<span class="absolute left-4 top-1/2 -translate-y-1/2 text-[#a0a4ad] material-symbols-outlined text-[20px]">
							search
						</span>
						<input
							type="text"
							value={searchQuery()}
							onInput={(e) => setSearchQuery(e.currentTarget.value)}
							placeholder={t('channelAdmins.searchAdminsPlaceholder') || 'Search admins...'}
							class="bg-[#1c1c1c]/50 border border-white/5 text-white text-[15px] rounded-2xl pl-12 pr-4 py-3.5 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6]/40 placeholder-[#8e8e93] transition-all shadow-sm"
						/>
					</div>
				</Motion.div>

				<div class="flex flex-col gap-3 pb-6">
					<Show
						when={filteredAdmins().length > 0}
						fallback={
							<div class="bg-[#1c1c1c]/50 rounded-3xl border border-white/5 py-12 flex flex-col items-center justify-center gap-3 shadow-inner">
								<span class="material-symbols-outlined text-[#8e8e93] text-[36px] opacity-80">
									search_off
								</span>
								<span class="text-[#8e8e93] text-[14px] font-semibold">
									{t('channelAdmins.noResults')}
								</span>
							</div>
						}
					>
						<For each={groupedAdmins()}>
							{(group) => (
								<div class="flex flex-col gap-2">
									<h2 class="text-[13px] font-bold text-[#8e8e93] px-2 pt-2 uppercase tracking-wider">{group.title}</h2>
									<div class="bg-[#1c1c1c]/60 backdrop-blur-md rounded-3xl border border-white/5 flex flex-col overflow-hidden shadow-md">
										<For each={group.items}>
											{(item: any, i) => (
												<Motion.div
													initial={{ opacity: 0, y: 10 }}
													animate={{ opacity: 1, y: 0 }}
													transition={{ delay: 0.05 + i() * 0.05 }}
													class={`flex flex-col p-4.5 ${i() !== group.items.length - 1 ? 'border-b border-white/5' : ''}`}
												>
													<div class="flex items-center justify-between mb-2">
														<div class="flex items-center gap-3.5">
															<div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-[18px] text-[#32ade6] relative shadow-inner shrink-0">
																{item.name.charAt(0)}
																<Show when={item.role === 'Owner'}>
																	<div class="absolute -bottom-1 -right-1 w-5 h-5 bg-[#ff9f0a] rounded-lg border border-[#0f1014] flex items-center justify-center shadow-md">
																		<span class="material-symbols-outlined text-[12px] text-black font-black">
																			star
																		</span>
																	</div>
																</Show>
																<Show when={item.role === 'Bot'}>
																	<div class="absolute -bottom-1 -right-1 w-5 h-5 bg-[#bf5af2] rounded-lg border border-[#0f1014] flex items-center justify-center shadow-md">
																		<span class="material-symbols-outlined text-[12px] text-white">
																			smart_toy
																		</span>
																	</div>
																</Show>
															</div>
															<div class="flex flex-col min-w-0">
																<div class="flex items-center gap-2 flex-wrap">
																	<span class="text-[15px] font-bold text-white truncate max-w-[120px]">
																		{item.name}
																	</span>
																	<Show when={item.customTitle}>
																		<span class="bg-[#32ade6]/10 text-[#32ade6] text-[10px] px-2 py-0.5 rounded-full border border-[#32ade6]/20 font-bold tracking-wide">
																			{item.customTitle}
																		</span>
																	</Show>
																</div>
																<span class="text-[12px] text-[#8e8e93] truncate mt-0.5">
																	{item.username ||
																		(item.role === 'Owner'
																			? t('channelAdmins.customTitle')
																			: item.role === 'Bot'
																				? 'Bot'
																				: 'Admin')}
																</span>
															</div>
														</div>

														<button
															onClick={() => openAdminModal(item)}
															class="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-95 flex items-center justify-center transition-all shadow-sm"
															aria-label={t('channelAdmins.edit')}
														>
															<span class="material-symbols-outlined text-[18px] text-[#8e8e93]">
																edit
															</span>
														</button>
													</div>

													<div class="flex flex-wrap gap-1.5 mt-2">
														<Show when={item.perms.post}>
															<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all bg-[#34c759]/5 border-[#34c759]/20 text-[#34c759] shadow-[0_2px_8px_rgba(52,199,89,0.05)]">
																{t('channelAdmins.post') || 'Post'}
															</span>
														</Show>
														<Show when={item.perms.edit}>
															<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all bg-[#34c759]/5 border-[#34c759]/20 text-[#34c759] shadow-[0_2px_8px_rgba(52,199,89,0.05)]">
																{t('channelAdmins.edit') || 'Edit'}
															</span>
														</Show>
														<Show when={item.perms.delete}>
															<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all bg-[#34c759]/5 border-[#34c759]/20 text-[#34c759] shadow-[0_2px_8px_rgba(52,199,89,0.05)]">
																{t('channelAdmins.delete') || 'Delete'}
															</span>
														</Show>
														<Show when={item.perms.invite}>
															<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all bg-[#32ade6]/5 border-[#32ade6]/20 text-[#32ade6] shadow-[0_2px_8px_rgba(50,173,230,0.05)]">
																{t('channelAdmins.invite') || 'Invite'}
															</span>
														</Show>
														<Show when={item.perms.promote}>
															<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all bg-[#ff9f0a]/5 border-[#ff9f0a]/20 text-[#ff9f0a] shadow-[0_2px_8px_rgba(255,159,10,0.05)]">
																{t('channelAdmins.promote') || 'Promote'}
															</span>
														</Show>
														<Show when={item.perms.postStories}>
															<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all bg-[#bf5af2]/5 border-[#bf5af2]/20 text-[#bf5af2] shadow-[0_2px_8px_rgba(191,90,242,0.05)]">
																{t('channelAdmins.stories') || 'Stories'}
															</span>
														</Show>
														<Show when={item.perms.anonymous}>
															<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all bg-white/5 border-white/10 text-white/80">
																{t('channelAdmins.anonymous') || 'Anonymous'}
															</span>
														</Show>
														<Show when={!item.perms.post && !item.perms.edit && !item.perms.delete && !item.perms.invite && !item.perms.promote && !item.perms.postStories && !item.perms.anonymous}>
															<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all bg-white/5 border-white/10 text-[#8e8e93]">
																{t('channelAdmins.noSpecialPerms') || 'Read Only'}
															</span>
														</Show>
													</div>
												</Motion.div>
											)}
										</For>
									</div>
								</div>
							)}
						</For>
					</Show>
				</div>
			</div>

			{/* Promote/Edit Admin Modal */}
			<Show when={showModal() && editingAdmin()}>
				<div class="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
					<Motion.div
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						class="bg-[#1c1c1c] w-full max-w-md rounded-[32px] border border-[#2a2a2a] flex flex-col max-h-[85vh] overflow-hidden shadow-2xl"
					>
						<div class="p-5 border-b border-[#2a2a2a] flex items-center justify-between sticky top-0 bg-[#1c1c1c] z-10">
							<h2 class="text-[18px] font-bold text-white truncate pr-4">{editingAdmin()?.name}</h2>
							<button
								onClick={() => setShowModal(false)}
								class="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all"
							>
								<span class="material-symbols-outlined text-[18px]">close</span>
							</button>
						</div>

						<div class="p-5 overflow-y-auto flex flex-col gap-6">
							<div class="flex flex-col gap-2">
								<label class="text-[12px] text-[#8e8e93] font-bold uppercase tracking-wider ml-1">
									{t('channelAdmins.customTitle')}
								</label>
								<input
									type="text"
									value={editingAdmin().customTitle}
									onInput={(e) =>
										setEditingAdmin({ ...editingAdmin(), customTitle: e.currentTarget.value })
									}
									placeholder={t('channelAdmins.customTitlePlaceholder')}
									class="bg-[#2c2c2e] text-white text-[15px] rounded-2xl px-4 py-3.5 w-full focus:outline-none focus:ring-2 focus:ring-[#32ade6] border border-transparent transition-all placeholder-[#a0a4ad] shadow-inner"
								/>
							</div>

							<div class="flex flex-col gap-2">
								<label class="text-[12px] text-[#8e8e93] font-bold uppercase tracking-wider ml-1 mb-1">
									{t('channelAdmins.permissions')}
								</label>
								<div class="bg-[#2c2c2e]/60 rounded-2xl p-1.5 flex flex-col border border-white/5 shadow-inner">
									<For
										each={[
											{ key: 'post', label: t('channelAdmins.permCanPost') || 'Post Messages' },
											{ key: 'edit', label: t('channelAdmins.permCanEdit') || 'Edit Messages' },
											{ key: 'delete', label: t('channelAdmins.permCanDelete') || 'Delete Messages' },
											{ key: 'pin', label: t('channelAdmins.permCanPin') || 'Pin Messages' },
											{ key: 'invite', label: t('channelAdmins.permCanInvite') || 'Invite Users via Link' },
											{ key: 'postStories', label: t('channelAdmins.permCanPostStories') || 'Post Stories' },
											{ key: 'editStories', label: t('channelAdmins.permCanEditStories') || 'Edit Stories' },
											{ key: 'deleteStories', label: t('channelAdmins.permCanDeleteStories') || 'Delete Stories' },
											{ key: 'videoChat', label: t('channelAdmins.permCanManageVC') || 'Manage Video Chats' },
											{ key: 'editInfo', label: t('channelAdmins.permCanEditInfo') || 'Edit Channel Info' },
											{ key: 'promote', label: t('channelAdmins.permCanPromote') || 'Add New Admins' },
											{ key: 'anonymous', label: t('channelAdmins.permAnonymous') || 'Remain Anonymous' },
										]}
									>
										{(perm, index) => (
											<div
												class={`flex items-center justify-between p-3.5 ${index() !== 11 ? 'border-b border-[#3a3a3c]/55' : ''}`}
											>
												<span class="text-[15px] font-medium text-white">{perm.label}</span>
												<ToggleSwitch
													checked={editingAdmin().perms[perm.key]}
													onChange={(v) =>
														setEditingAdmin({
															...editingAdmin(),
															perms: { ...editingAdmin().perms, [perm.key]: v },
														})
													}
												/>
											</div>
										)}
									</For>
								</div>
							</div>
						</div>

						<div class="p-5 border-t border-[#2a2a2a] bg-[#1c1c1c] sticky bottom-0">
							<button
								onClick={saveAdmin}
								disabled={isSaving()}
								class="w-full bg-[#32ade6] text-black font-bold text-[16px] py-4 rounded-2xl shadow-[0_4px_15px_rgba(50,173,230,0.35)] hover:bg-[#2b96c8] active:scale-[0.98] transition-all disabled:opacity-50"
							>
								{isSaving()
									? t('channelAdmins.saving') || 'Saving...'
									: t('channelAdmins.saveAdmin')}
							</button>
						</div>
					</Motion.div>
				</div>
			</Show>
		</div>
	);
};
