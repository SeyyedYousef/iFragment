import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	type Component,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { channelApi } from '@/entities/channel/index.js';
import type { ContentItem } from '@/entities/channel/model/types.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';
import { ProjectContextBar, ProjectHamburgerMenu } from '@/widgets/project/index.js';

export const ProjectInboxPage: Component = () => {
	const params = useParams<{ projectId: string }>();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [statusFilter, setStatusFilter] = createSignal<string>('awaiting_review');

	// Items resource based on filter
	const [items, { refetch }] = createResource(
		() => ({ projectId: params.projectId, status: statusFilter() }),
		({ projectId, status }) => channelApi.getProjectInbox(projectId, status === 'all' ? '' : status),
	);

	// Inline Edit Modal State
	const [editingItem, setEditingItem] = createSignal<ContentItem | null>(null);
	const [editText, setEditText] = createSignal('');
	const [isSavingEdit, setIsSavingEdit] = createSignal(false);

	// Action in-progress state
	const [actionId, setActionId] = createSignal<string | null>(null);

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					navigate(`/projects/${params.projectId}`);
				});
			}
		} catch (_e) {}
	});

	onCleanup(() => {
		try {
			if (backButton.isSupported()) {
				backButton.hide();
			}
		} catch (_e) {}
	});

	const handleApprove = async (contentId: string) => {
		setActionId(contentId);
		try {
			haptic.impact('heavy');
			await channelApi.approveContent(params.projectId, contentId);
			haptic.notify('success');
			showToast(t('channelProjects.inbox.approvedToast'), 'success');
			refetch();
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || err?.message || t('channelProjects.dashboard.actionError'), 'error');
		} finally {
			setActionId(null);
		}
	};

	const handleReject = async (contentId: string) => {
		setActionId(contentId);
		try {
			haptic.impact('medium');
			await channelApi.rejectContent(params.projectId, contentId, t('channelProjects.inbox.operatorRejectReason'));
			haptic.notify('success');
			showToast(t('channelProjects.inbox.rejectedToast'), 'success');
			refetch();
		} catch (err: any) {
			haptic.notify('error');
			showToast(t('channelProjects.dashboard.actionError'), 'error');
		} finally {
			setActionId(null);
		}
	};

	const openEditModal = (item: ContentItem) => {
		setEditingItem(item);
		setEditText(item.revision?.text || item.revision?.caption || '');
		haptic.impact('light');
	};

	const handleSaveEdit = async () => {
		const item = editingItem();
		if (!item) return;

		setIsSavingEdit(true);
		try {
			haptic.impact('medium');
			await channelApi.editContent(params.projectId, item.id, {
				text: editText(),
				caption: editText(),
			});
			haptic.notify('success');
			showToast(t('channelProjects.inbox.editedToast'), 'success');
			setEditingItem(null);
			refetch();
		} catch (err: any) {
			haptic.notify('error');
			showToast(t('channelProjects.common.saveError'), 'error');
		} finally {
			setIsSavingEdit(false);
		}
	};

	const getStatusBadge = (status: string) => {
		switch (status) {
			case 'awaiting_review':
				return { label: t('channelProjects.inbox.filterAwaiting'), class: 'text-amber-400 border-amber-400/30 bg-amber-400/10' };
			case 'approved':
				return { label: t('channelProjects.inbox.filterApproved'), class: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
			case 'published':
				return { label: t('channelProjects.inbox.filterPublished'), class: 'text-[#3390ec] border-[#3390ec]/30 bg-[#3390ec]/10' };
			case 'rejected':
				return { label: t('channelProjects.inbox.filterRejected'), class: 'text-rose-400 border-rose-500/30 bg-rose-500/10' };
			default:
				return { label: status, class: 'text-white/60 border-white/10 bg-white/5' };
		}
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-30 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3 min-w-0">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}`);
						}}
						class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 text-white/80"
					>
						<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col min-w-0">
						<h1 class="text-[17px] font-black text-white leading-tight truncate">
							{t('channelProjects.inbox.title')}
						</h1>
						<span class="text-[10px] font-bold text-white/50 uppercase tracking-wider">
							{t('channelProjects.inbox.subtitle')}
						</span>
					</div>
				</div>

				<button
					type="button"
					onClick={() => setIsMenuOpen(true)}
					class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 text-white"
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<div class="px-5 pt-4 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
				<ProjectContextBar projectId={params.projectId} compact={true} />

				{/* ═══════ FILTER TABS ═══════ */}
				<div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
					<button
						type="button"
						onClick={() => setStatusFilter('awaiting_review')}
						class={`px-3.5 py-2 rounded-[14px] text-[12px] font-black whitespace-nowrap transition-all ${
							statusFilter() === 'awaiting_review'
								? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm'
								: 'bg-white/5 text-white/60 hover:bg-white/10'
						}`}
					>
						{t('channelProjects.inbox.filterAwaiting')}
					</button>
					<button
						type="button"
						onClick={() => setStatusFilter('published')}
						class={`px-3.5 py-2 rounded-[14px] text-[12px] font-black whitespace-nowrap transition-all ${
							statusFilter() === 'published'
								? 'bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/40 shadow-sm'
								: 'bg-white/5 text-white/60 hover:bg-white/10'
						}`}
					>
						{t('channelProjects.inbox.filterPublished')}
					</button>
					<button
						type="button"
						onClick={() => setStatusFilter('rejected')}
						class={`px-3.5 py-2 rounded-[14px] text-[12px] font-black whitespace-nowrap transition-all ${
							statusFilter() === 'rejected'
								? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
								: 'bg-white/5 text-white/60 hover:bg-white/10'
						}`}
					>
						{t('channelProjects.inbox.filterRejected')}
					</button>
					<button
						type="button"
						onClick={() => setStatusFilter('all')}
						class={`px-3.5 py-2 rounded-[14px] text-[12px] font-black whitespace-nowrap transition-all ${
							statusFilter() === 'all'
								? 'bg-white/20 text-white border border-white/30 shadow-sm'
								: 'bg-white/5 text-white/60 hover:bg-white/10'
						}`}
					>
						{t('channelProjects.inbox.filterAll')}
					</button>
				</div>

				{/* ═══════ CONTENT ITEMS LIST ═══════ */}
				<Show
					when={items() && items()!.length > 0}
					fallback={
						!items.loading ? (
							<div class="bg-[#12141C]/80 border border-white/5 rounded-[24px] p-8 text-center flex flex-col items-center gap-3">
								<div class="w-14 h-14 rounded-[18px] bg-white/5 flex items-center justify-center text-white/40">
									<span class="material-symbols-outlined text-[32px]">inbox</span>
								</div>
								<span class="text-[14px] font-bold text-white/70">{t('channelProjects.inbox.emptyTitle')}</span>
								<span class="text-[11px] text-white/40 max-w-[240px]">
									{t('channelProjects.inbox.emptyDesc')}
								</span>
							</div>
						) : (
							<div class="flex flex-col gap-3">
								<For each={[1, 2]}>
									{() => (
										<div class="bg-[#12141C]/50 rounded-[20px] p-5 border border-white/5 animate-pulse h-36" />
									)}
								</For>
							</div>
						)
					}
				>
					<div class="flex flex-col gap-3.5">
						<For each={items()}>
							{(item, i) => {
								const badge = getStatusBadge(item.status);
								const isOperating = () => actionId() === item.id;

								return (
									<Motion.div
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: i() * 0.03 }}
										class="bg-gradient-to-b from-[#141722] to-[#0c0e15] border border-white/10 rounded-[24px] p-4 flex flex-col gap-3.5 shadow-md"
									>
										{/* Card Header */}
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<span class="text-[11px] font-mono font-bold text-white/60">
													#{item.source_message_id}
												</span>
												<Show when={item.source_media_group_id}>
													<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
														{t('channelProjects.inbox.mediaAlbum')}
													</span>
												</Show>
											</div>

											<span class={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${badge.class}`}>
												{badge.label}
											</span>
										</div>

										{/* Post Content Preview */}
										<div class="bg-[#08090e] border border-white/5 rounded-[16px] p-3 text-[13px] text-white/90 leading-relaxed font-sans select-text whitespace-pre-wrap">
											{item.revision?.text || item.revision?.caption || (
												<span class="text-white/40 italic">{t('channelProjects.inbox.mediaNoText')}</span>
											)}
										</div>

										{/* Transformations Pill */}
										<div class="flex items-center gap-2 text-[10px] text-white/40 font-mono">
											<span>{t('channelProjects.inbox.version')}: {item.revision?.version || 1}</span>
											<span>•</span>
											<span>
												{t('channelProjects.inbox.receivedAt')}: {new Date(item.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
											</span>
										</div>

										{/* Action Buttons (Only for awaiting_review) */}
										<Show when={item.status === 'awaiting_review' || item.status === 'editing'}>
											<div class="flex items-center gap-2 pt-1 border-t border-white/5">
												<button
													type="button"
													disabled={isOperating()}
													onClick={() => handleApprove(item.id)}
													class="flex-1 h-11 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-[14px] text-[12px] font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all"
												>
													<span class="material-symbols-outlined text-[18px]">publish</span>
													<span>{isOperating() ? t('channelProjects.inbox.dispatching') : t('channelProjects.inbox.approveBtn')}</span>
												</button>

												<button
													type="button"
													onClick={() => openEditModal(item)}
													class="h-11 px-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 rounded-[14px] text-[12px] font-bold flex items-center justify-center gap-1 active:scale-95"
												>
													<span class="material-symbols-outlined text-[18px]">edit</span>
													<span>{t('channelProjects.inbox.editBtn')}</span>
												</button>

												<button
													type="button"
													disabled={isOperating()}
													onClick={() => handleReject(item.id)}
													class="w-11 h-11 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 rounded-[14px] flex items-center justify-center active:scale-95"
													title={t('channelProjects.inbox.rejectTooltip')}
												>
													<span class="material-symbols-outlined text-[20px]">close</span>
												</button>
											</div>
										</Show>
									</Motion.div>
								);
							}}
						</For>
					</div>
				</Show>
			</div>

			{/* ═══════ INLINE EDIT MODAL ═══════ */}
			<Show when={editingItem()}>
				<div
					class="fixed inset-0 bg-[#030303]/90 backdrop-blur-xl z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
					onClick={(e) => {
						if (e.target === e.currentTarget && !isSavingEdit()) setEditingItem(null);
					}}
				>
					<div class="w-full max-w-lg bg-[#12141C] rounded-t-[32px] sm:rounded-[32px] border border-white/10 p-6 flex flex-col gap-4 shadow-2xl">
						<div class="flex items-center justify-between pb-3 border-b border-white/10">
							<h3 class="text-[16px] font-black text-white">{t('channelProjects.inbox.editModalTitle')}</h3>
							<button
								type="button"
								onClick={() => setEditingItem(null)}
								class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50"
							>
								<span class="material-symbols-outlined text-[18px]">close</span>
							</button>
						</div>

						<textarea
							rows={6}
							value={editText()}
							onInput={(e) => setEditText(e.currentTarget.value)}
							class="w-full bg-[#090a0f] rounded-[18px] p-4 text-[13px] text-white border border-white/10 focus:border-[#3390ec] outline-none leading-relaxed resize-none"
						/>

						<div class="flex items-center gap-2.5 pt-2">
							<button
								type="button"
								onClick={() => setEditingItem(null)}
								class="flex-1 h-12 rounded-[16px] bg-white/5 text-white/60 text-[12px] font-bold"
							>
								{t('channelProjects.inbox.cancelBtn')}
							</button>
							<button
								type="button"
								disabled={isSavingEdit()}
								onClick={handleSaveEdit}
								class="flex-[2] h-12 rounded-[16px] bg-[#3390ec] text-white text-[12px] font-black flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
							>
								<span class="material-symbols-outlined text-[18px]">save</span>
								<span>{isSavingEdit() ? t('channelProjects.common.saving') : t('channelProjects.inbox.saveNewVersion')}</span>
							</button>
						</div>
					</div>
				</div>
			</Show>

			<ProjectHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				projectId={params.projectId}
				activeTab="inbox"
			/>
		</div>
	);
};
