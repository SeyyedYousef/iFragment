import { Motion } from '@motionone/solid';
import { useParams } from '@solidjs/router';
import { type Component, createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { ChannelContextBar, ChannelHamburgerMenu, channelApi } from '@/entities/channel/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { showToast } from '@/shared/ui/index.js';
import { ToggleSwitch } from '@/shared/ui/settings-controls.js';

export const ChannelAdminsPage: Component = () => {
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [searchQuery, setSearchQuery] = createSignal('');

	const [editingAdmin, setEditingAdmin] = createSignal<any>(null);
	const [showModal, setShowModal] = createSignal(false);

	const [channelData] = createResource(
		() => params.id,
		(channelId) => channelApi.getChannel(channelId),
	);

	useTelegramBackButton(-1);

	const [adminsData, { refetch }] = createResource(
		() => params.id,
		(channelId) => channelApi.getAdmins(channelId),
	);

	const [isSyncing, setIsSyncing] = createSignal(false);

	const handleSync = async () => {
		try {
			setIsSyncing(true);
			haptic.impact('light');
			await channelApi.syncAdmins(params.id);
			await refetch();
			haptic.notify('success');
			showToast(t('channelAdmins.syncSuccess'), 'success');
		} catch (err) {
			console.error(err);
			haptic.notify('error');
			showToast(t('channelAdmins.syncFailed'), 'error');
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
				a.customTitle?.toLowerCase().includes(q),
		);
	});

	const groupedAdmins = createMemo(() => {
		const admins = filteredAdmins();
		const owners = admins.filter((a: any) => a.role === 'Owner');
		const bots = admins.filter((a: any) => a.role === 'Bot');

		const regularAdmins = admins.filter((a: any) => a.role !== 'Owner' && a.role !== 'Bot');
		const contentAdmins = regularAdmins.filter(
			(a: any) => a.perms.post || a.perms.edit || a.perms.postStories,
		);
		const inviteAdmins = regularAdmins.filter(
			(a: any) => (a.perms.invite || a.perms.promote) && !contentAdmins.includes(a),
		);
		const otherAdmins = regularAdmins.filter(
			(a: any) => !contentAdmins.includes(a) && !inviteAdmins.includes(a),
		);

		return [
			{ title: t('channelAdmins.owners'), items: owners },
			{ title: t('channelAdmins.contentAdmins'), items: contentAdmins },
			{ title: t('channelAdmins.inviteAdmins'), items: inviteAdmins },
			{ title: t('channelAdmins.otherAdmins'), items: otherAdmins },
			{ title: t('channelAdmins.bots'), items: bots },
		].filter((g) => g.items.length > 0);
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
		haptic.impact('light');
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
			haptic.notify('success');
			setShowModal(false);
			refetch();
			showToast(t('channelAdmins.saveSuccess'), 'success');
		} catch (err) {
			console.error(err);
			haptic.notify('error');
			showToast(t('channelAdmins.saveFailed'), 'error');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-30 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							window.history.back();
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2">
							<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
								{t('channelAdmins.adminsAndPermissions')}
							</h1>
							<span class="bg-white/5 border border-white/10 text-white/60 text-[10px] font-mono font-bold px-2 py-0.5 rounded-[6px] shrink-0">
								{channelData()?.members_count?.toLocaleString() || '0'}
							</span>
						</div>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider truncate mt-0.5">
							{t('channelAdmins.manageWhoCanPost')}
						</span>
					</div>
				</div>

				<button
					type="button"
					onClick={() => setIsMenuOpen(true)}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 shadow-sm text-white/80"
					aria-label={t('common.toggle')}
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="admins"
			/>

			<div class="p-5 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
				<ChannelContextBar channelId={params.id} />

				{/* ═══════ ACTIONS (Sync & Search) ═══════ */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.05 }}
					class="flex flex-col gap-3.5"
				>
					<button
						type="button"
						onClick={handleSync}
						disabled={isSyncing()}
						class="w-full h-14 bg-[#3390ec]/10 border border-[#3390ec]/20 hover:bg-[#3390ec]/20 text-[#3390ec] rounded-[16px] flex items-center justify-center gap-2 font-black uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 active:scale-95"
					>
						<Show
							when={isSyncing()}
							fallback={
								<>
									<span class="material-symbols-outlined text-[20px]">sync</span>{' '}
									{t('channelAdmins.syncFromTelegram')}
								</>
							}
						>
							<span class="material-symbols-outlined text-[20px] animate-spin">sync</span>{' '}
							{t('channelAdmins.syncing')}
						</Show>
					</button>

					<div class="relative z-10">
						<span class="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 material-symbols-outlined text-[22px] pointer-events-none">
							search
						</span>
						<input
							type="text"
							value={searchQuery()}
							onInput={(e) => setSearchQuery(e.currentTarget.value)}
							placeholder={t('channelAdmins.searchAdminsPlaceholder')}
							class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 text-white text-[13px] font-bold rounded-[16px] pl-12 pr-4 py-4 w-full focus:outline-none focus:border-[#3390ec]/50 placeholder-white/30 transition-all shadow-inner"
						/>
					</div>
				</Motion.div>

				{/* ═══════ ADMINS LIST ═══════ */}
				<div class="flex flex-col gap-4 pb-6">
					<Show
						when={filteredAdmins().length > 0}
						fallback={
							<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 py-12 flex flex-col items-center justify-center gap-3 shadow-sm border-dashed">
								<div class="w-16 h-16 rounded-[20px] bg-white/5 flex items-center justify-center border border-white/10 mb-1">
									<span class="material-symbols-outlined text-white/30 text-[36px]">
										search_off
									</span>
								</div>
								<span class="text-white/40 text-[13px] font-bold tracking-wide">
									{t('channelAdmins.noResults')}
								</span>
							</div>
						}
					>
						<For each={groupedAdmins()}>
							{(group) => (
								<div class="flex flex-col gap-2">
									<h2 class="text-[11px] font-black text-white/40 uppercase tracking-widest px-2">
										{group.title}
									</h2>

									<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 flex flex-col overflow-hidden shadow-sm">
										<For each={group.items}>
											{(item: any, i) => (
												<Motion.div
													initial={{ opacity: 0, y: 10 }}
													animate={{ opacity: 1, y: 0 }}
													transition={{ delay: 0.05 + i() * 0.05 }}
													class={`flex flex-col p-4.5 ${i() !== group.items.length - 1 ? 'border-b border-white/5' : ''}`}
												>
													<div class="flex items-center justify-between mb-3">
														<div class="flex items-center gap-3.5 overflow-hidden pr-2">
															<div
																class={`w-12 h-12 rounded-[14px] flex items-center justify-center font-black text-[18px] relative shadow-inner shrink-0 ${item.role === 'Owner' ? 'bg-gradient-to-br from-amber-400/20 to-amber-400/5 text-amber-400 border border-amber-400/30' : item.role === 'Bot' ? 'bg-gradient-to-br from-cyan-400/20 to-cyan-400/5 text-cyan-400 border border-cyan-400/30' : 'bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 text-[#3390ec] border border-[#3390ec]/30'}`}
															>
																{item.name.charAt(0)}
																<Show when={item.role === 'Owner'}>
																	<div class="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-400 rounded-[6px] border border-[#08090D] flex items-center justify-center shadow-md">
																		<span class="material-symbols-outlined text-[12px] text-black font-black">
																			star
																		</span>
																	</div>
																</Show>
																<Show when={item.role === 'Bot'}>
																	<div class="absolute -bottom-1 -right-1 w-5 h-5 bg-cyan-400 rounded-[6px] border border-[#08090D] flex items-center justify-center shadow-md">
																		<span class="material-symbols-outlined text-[12px] text-black font-black">
																			smart_toy
																		</span>
																	</div>
																</Show>
															</div>
															<div class="flex flex-col min-w-0">
																<div class="flex items-center gap-2 flex-wrap mb-0.5">
																	<span class="text-[15px] font-black text-white truncate max-w-[120px]">
																		{item.name}
																	</span>
																	<Show when={item.customTitle}>
																		<span class="bg-[#3390ec]/10 text-[#3390ec] text-[9px] px-2 py-0.5 rounded-[6px] border border-[#3390ec]/20 font-black uppercase tracking-wider">
																			{item.customTitle}
																		</span>
																	</Show>
																</div>
																<span class="text-[11px] text-white/50 font-bold truncate">
																	{item.username ||
																		(item.role === 'Owner'
																			? t('channelAdmins.owners')
																			: item.role === 'Bot'
																				? t('channelAdmins.bots')
																				: t('channelAdmins.currentAdmins'))}
																</span>
															</div>
														</div>

														<button
															type="button"
															onClick={() => openAdminModal(item)}
															class="w-10 h-10 rounded-[12px] bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 flex items-center justify-center transition-all shadow-sm shrink-0"
															aria-label={t('channelAdmins.edit')}
														>
															<span class="material-symbols-outlined text-[18px] text-white/60">
																edit
															</span>
														</button>
													</div>

													<div class="flex flex-wrap gap-1.5 mt-1">
														<Show when={item.perms.post}>
															<span class="px-2 py-1 rounded-[6px] text-[9px] font-black uppercase tracking-widest border bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]">
																{t('channelAdmins.post')}
															</span>
														</Show>
														<Show when={item.perms.edit}>
															<span class="px-2 py-1 rounded-[6px] text-[9px] font-black uppercase tracking-widest border bg-[#10b981]/10 border-[#10b981]/20 text-[#10b981]">
																{t('channelAdmins.edit')}
															</span>
														</Show>
														<Show when={item.perms.delete}>
															<span class="px-2 py-1 rounded-[6px] text-[9px] font-black uppercase tracking-widest border bg-[#ff4a4a]/10 border-[#ff4a4a]/20 text-[#ff4a4a]">
																{t('channelAdmins.delete')}
															</span>
														</Show>
														<Show when={item.perms.invite}>
															<span class="px-2 py-1 rounded-[6px] text-[9px] font-black uppercase tracking-widest border bg-[#3390ec]/10 border-[#3390ec]/20 text-[#3390ec]">
																{t('channelAdmins.invite')}
															</span>
														</Show>
														<Show when={item.perms.promote}>
															<span class="px-2 py-1 rounded-[6px] text-[9px] font-black uppercase tracking-widest border bg-amber-400/10 border-amber-400/20 text-amber-400">
																{t('channelAdmins.promote')}
															</span>
														</Show>
														<Show when={item.perms.postStories}>
															<span class="px-2 py-1 rounded-[6px] text-[9px] font-black uppercase tracking-widest border bg-cyan-400/10 border-cyan-400/20 text-cyan-400">
																{t('channelAdmins.stories')}
															</span>
														</Show>
														<Show when={item.perms.anonymous}>
															<span class="px-2 py-1 rounded-[6px] text-[9px] font-black uppercase tracking-widest border bg-white/10 border-white/20 text-white">
																{t('channelAdmins.anonymous')}
															</span>
														</Show>

														<Show
															when={
																!item.perms.post &&
																!item.perms.edit &&
																!item.perms.delete &&
																!item.perms.invite &&
																!item.perms.promote &&
																!item.perms.postStories &&
																!item.perms.anonymous
															}
														>
															<span class="px-2 py-1 rounded-[6px] text-[9px] font-black uppercase tracking-widest border bg-transparent border-white/10 text-white/40">
																{t('channelAdmins.noSpecialPerms')}
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

			{/* ═══════ PROMOTE/EDIT ADMIN MODAL (Bottom Sheet) ═══════ */}
			<Show when={showModal() && editingAdmin()}>
				<div class="fixed inset-0 bg-[#030303]/90 backdrop-blur-2xl z-[100] flex items-end sm:items-center justify-center p-4">
					<Motion.div
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }}
						class="bg-[#12141C] w-full max-w-md rounded-[32px] border border-white/10 flex flex-col max-h-[85vh] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative"
					>
						{/* Modal Header */}
						<div class="p-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#12141C]/90 backdrop-blur-md z-20 shadow-sm">
							<h2 class="text-[18px] font-black text-white truncate pr-4">
								{editingAdmin()?.name}
							</h2>
							<button
								type="button"
								onClick={() => setShowModal(false)}
								class="w-9 h-9 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all shrink-0"
							>
								<span class="material-symbols-outlined text-[20px]">close</span>
							</button>
						</div>

						{/* Modal Body */}
						<div class="p-5 overflow-y-auto no-scrollbar flex flex-col gap-6">
							{/* Custom Title Input */}
							<div class="flex flex-col gap-2">
								<div class="text-[11px] text-white/40 font-black uppercase tracking-widest ml-1">
									{t('channelAdmins.customTitle')}
								</div>
								<input
									type="text"
									value={editingAdmin().customTitle}
									onInput={(e) =>
										setEditingAdmin({ ...editingAdmin(), customTitle: e.currentTarget.value })
									}
									placeholder={t('channelAdmins.customTitlePlaceholder')}
									class="bg-[#08090D] border border-white/5 shadow-inner text-white text-[13px] font-bold rounded-[16px] px-4 py-4 w-full focus:outline-none focus:border-[#3390ec]/50 transition-all placeholder-white/20"
								/>
								<span class="text-[11px] text-white/40 leading-relaxed px-1">
									💡 Tip: Setting Custom Title to{' '}
									<code class="text-[#3390ec] font-mono font-bold">{'viewer'}</code> grants
									read-only access in iFragment without write permissions.
								</span>
							</div>

							{/* Permissions Toggles */}
							<div class="flex flex-col gap-2">
								<div class="text-[11px] text-white/40 font-black uppercase tracking-widest ml-1 mb-1">
									{t('channelAdmins.permissions')}
								</div>
								<div class="bg-[#08090D] shadow-inner border border-white/5 rounded-[24px] p-2 flex flex-col">
									<For
										each={[
											{ key: 'post', label: t('channelAdmins.permCanPost') },
											{ key: 'edit', label: t('channelAdmins.permCanEdit') },
											{ key: 'delete', label: t('channelAdmins.permCanDelete') },
											{ key: 'pin', label: t('channelAdmins.permCanPin') },
											{ key: 'invite', label: t('channelAdmins.permCanInvite') },
											{ key: 'postStories', label: t('channelAdmins.permCanPostStories') },
											{ key: 'editStories', label: t('channelAdmins.permCanEditStories') },
											{ key: 'deleteStories', label: t('channelAdmins.permCanDeleteStories') },
											{ key: 'videoChat', label: t('channelAdmins.permCanManageVC') },
											{ key: 'editInfo', label: t('channelAdmins.permCanEditInfo') },
											{ key: 'promote', label: t('channelAdmins.permCanPromote') },
											{ key: 'anonymous', label: t('channelAdmins.permAnonymous') },
										]}
									>
										{(perm, index) => (
											<div
												class={`flex items-center justify-between p-3.5 ${index() !== 11 ? 'border-b border-white/5' : ''}`}
											>
												<span class="text-[13px] font-bold text-white/90">{perm.label}</span>
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

						{/* Save Button */}
						<div class="p-5 border-t border-white/5 bg-[#12141C] sticky bottom-0 z-20">
							<button
								type="button"
								onClick={saveAdmin}
								disabled={isSaving()}
								class="w-full bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white font-black text-[14px] uppercase tracking-widest py-4 rounded-[16px] shadow-[0_10px_30px_rgba(51,144,236,0.3)] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center border border-white/10"
							>
								<Show
									when={!isSaving()}
									fallback={
										<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									}
								>
									{t('channelAdmins.saveAdmin')}
								</Show>
							</button>
						</div>
					</Motion.div>
				</div>
			</Show>
		</div>
	);
};
