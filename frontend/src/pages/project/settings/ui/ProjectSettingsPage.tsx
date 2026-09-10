import { Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { ProjectContextBar, ProjectHamburgerMenu } from '@/widgets/project/index.js';
import { channelApi } from '@/entities/channel/api/channelApi.js';
import type { Project } from '@/entities/channel/model/types.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';

export const ProjectSettingsPage: Component = () => {
	const params = useParams<{ projectId: string }>();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [project, setProject] = createSignal<Project | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [saving, setSaving] = createSignal(false);
	const [name, setName] = createSignal('');
	const [showDeleteModal, setShowDeleteModal] = createSignal(false);

	const fetchProject = async () => {
		try {
			setLoading(true);
			const res = await channelApi.getProject(params.projectId);
			setProject(res);
			setName(res.name);
		} catch (err: any) {
			showToast(err?.response?.data?.error || err?.message || t('channelProjects.settingsPage.loadError'), 'error');
		} finally {
			setLoading(false);
		}
	};

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
		fetchProject();
	});

	onCleanup(() => {
		try {
			if (backButton.isSupported()) {
				backButton.hide();
			}
		} catch (_e) {}
	});

	const handleUpdate = async () => {
		if (!name().trim()) return;
		try {
			setSaving(true);
			haptic.impact('medium');
			const updated = await channelApi.updateProject(params.projectId, { name: name().trim() });
			setProject(updated);
			haptic.notify('success');
			showToast(t('channelProjects.common.savedSuccess'), 'success');
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || err?.message || t('channelProjects.common.saveError'), 'error');
		} finally {
			setSaving(false);
		}
	};

	const handleToggleStatus = async () => {
		const p = project();
		if (!p) return;
		try {
			setSaving(true);
			haptic.impact('medium');
			if (p.status === 'active') {
				await channelApi.pauseProject(p.id);
				haptic.notify('success');
				showToast(t('channelProjects.settingsPage.pausedToast'), 'success');
			} else {
				await channelApi.resumeProject(p.id);
				haptic.notify('success');
				showToast(t('channelProjects.settingsPage.resumedToast'), 'success');
			}
			await fetchProject();
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || err?.message || t('channelProjects.dashboard.actionError'), 'error');
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		try {
			setSaving(true);
			haptic.impact('heavy');
			await channelApi.deleteProject(params.projectId);
			haptic.notify('success');
			showToast(t('channelProjects.settingsPage.deletedSuccess'), 'success');
			navigate('/projects');
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || err?.message || t('channelProjects.dashboard.actionError'), 'error');
		} finally {
			setSaving(false);
			setShowDeleteModal(false);
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
						class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 text-white/80 active:scale-95"
					>
						<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col min-w-0">
						<h1 class="text-[17px] font-black text-white leading-tight truncate">
							{t('channelProjects.settingsPage.title')}
						</h1>
						<span class="text-[10px] font-bold text-white/50 uppercase tracking-wider">
							{t('channelProjects.settingsPage.subtitle')}
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

			<div class="px-5 pt-4 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
				<ProjectContextBar projectId={params.projectId} compact={true} />

				<Show when={loading()}>
					<div class="p-8 text-center text-white/40 text-sm">
						{t('channelProjects.context.loading')}
					</div>
				</Show>

				<Show when={!loading() && project()}>
					<div class="flex flex-col gap-4">
						{/* General Settings */}
						<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-5 flex flex-col gap-4 shadow-sm">
							<h2 class="text-[14px] font-black text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-[#3390ec] text-[20px]">settings</span>
								<span>{t('channelProjects.settingsPage.generalSettings')}</span>
							</h2>

							<div>
								<label class="block text-[11px] font-bold text-white/60 mb-1.5">
									{t('channelProjects.settingsPage.projectName')}
								</label>
								<input
									type="text"
									class="w-full bg-[#090a0f] border border-white/10 rounded-[16px] px-4 py-3 text-[13px] text-white focus:outline-none focus:border-[#3390ec]"
									value={name()}
									onInput={(e) => setName(e.currentTarget.value)}
								/>
							</div>

							<div class="flex items-center justify-between pt-2 border-t border-white/5">
								<div class="flex flex-col">
									<span class="text-[10px] text-white/50">{t('channelProjects.settingsPage.pipelineStatus')}</span>
									<span class={`text-[11px] font-black mt-0.5 ${project()?.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
										{project()?.status === 'active' ? t('channelProjects.settingsPage.statusRunning') : t('channelProjects.settingsPage.statusPaused')}
									</span>
								</div>
								<button
									type="button"
									onClick={handleToggleStatus}
									disabled={saving()}
									class={`px-3 py-1.5 rounded-[12px] text-[11px] font-bold border transition active:scale-95 ${
										project()?.status === 'active'
											? 'border-amber-400/40 text-amber-300 hover:bg-amber-400/10'
											: 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
									}`}
								>
									{project()?.status === 'active' ? t('channelProjects.settingsPage.pauseProject') : t('channelProjects.settingsPage.resumeProject')}
								</button>
							</div>

							<div class="pt-2 border-t border-white/5 flex justify-end">
								<button
									type="button"
									onClick={handleUpdate}
									disabled={saving() || !name().trim()}
									class="px-5 py-2.5 bg-[#3390ec] hover:bg-[#2b7ec9] text-white rounded-[14px] text-[12px] font-black transition active:scale-95 shadow-md disabled:opacity-50"
								>
									{saving() ? t('channelProjects.settingsPage.savingBtn') : t('channelProjects.settingsPage.saveBtn')}
								</button>
							</div>
						</div>

						{/* Channels Mapping & Architecture Info */}
						<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-5 flex flex-col gap-3 shadow-sm">
							<h2 class="text-[14px] font-black text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-[#3390ec] text-[20px]">hub</span>
								<span>{t('channelProjects.settingsPage.channelsBinding')}</span>
							</h2>
							<p class="text-[11px] text-white/50 leading-relaxed">
								{t('channelProjects.settingsPage.channelsBindingDesc')}
							</p>

							<div class="grid grid-cols-1 gap-2.5 pt-1">
								<div class="bg-[#090a0f] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-1">
									<span class="text-[10px] text-[#3390ec] font-bold">{t('channelProjects.settingsPage.sourceDesc')}</span>
									<div class="text-[13px] font-black text-white flex items-center gap-1.5" dir="ltr">
										<span>📥</span>
										<span>{project()?.source_channel_id || t('channelProjects.connected')}</span>
									</div>
								</div>

								<div class="bg-[#090a0f] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-1">
									<span class="text-[10px] text-emerald-400 font-bold">{t('channelProjects.settingsPage.targetDesc')}</span>
									<div class="text-[13px] font-black text-white flex items-center gap-1.5" dir="ltr">
										<span>📤</span>
										<span>{project()?.target_channel_id || t('channelProjects.connected')}</span>
									</div>
								</div>
							</div>
						</div>

						{/* Subscription & Quota */}
						<div class="bg-[#12141C] border border-white/10 rounded-[24px] p-5 flex flex-col gap-3 shadow-sm">
							<h2 class="text-[14px] font-black text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400 text-[20px]">diamond</span>
								<span>{t('channelProjects.settingsPage.subscriptionTitle')}</span>
							</h2>
							<p class="text-[11px] text-white/50 leading-relaxed">
								{t('channelProjects.settingsPage.subscriptionDesc')}
							</p>
							<div class="p-3.5 bg-gradient-to-r from-[#3390ec]/15 to-transparent border border-[#3390ec]/30 rounded-[18px] flex items-center justify-between text-xs">
								<div class="flex flex-col gap-0.5">
									<div class="font-black text-white text-[12px]">{t('channelProjects.settingsPage.planActiveTier')}</div>
									<div class="text-white/50 text-[10px]">{t('channelProjects.settingsPage.planActiveFeatures')}</div>
								</div>
								<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[10px] font-black shrink-0">
									{t('channelProjects.settingsPage.planValidUntil')}
								</span>
							</div>
						</div>

						{/* Danger Zone */}
						<div class="bg-[#12141C] border border-rose-500/20 rounded-[24px] p-5 flex flex-col gap-3 shadow-sm">
							<h2 class="text-[14px] font-black text-rose-400 flex items-center gap-2">
								<span class="material-symbols-outlined text-rose-400 text-[20px]">warning</span>
								<span>{t('channelProjects.settingsPage.dangerZone')}</span>
							</h2>
							<p class="text-[11px] text-white/50 leading-relaxed">
								{t('channelProjects.settingsPage.dangerDesc')}
							</p>
							<div class="pt-1">
								<button
									type="button"
									onClick={() => setShowDeleteModal(true)}
									class="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-[14px] text-[11px] font-black transition active:scale-95"
								>
									{t('channelProjects.settingsPage.deleteBtn')}
								</button>
							</div>
						</div>
					</div>
				</Show>
			</div>

			{/* Delete Confirmation Modal */}
			<Show when={showDeleteModal()}>
				<div class="fixed inset-0 bg-[#030303]/90 backdrop-blur-xl z-50 flex items-center justify-center p-4">
					<div class="bg-[#12141C] border border-white/10 rounded-[28px] max-w-sm w-full p-6 flex flex-col gap-4 shadow-2xl">
						<h3 class="text-[16px] font-black text-white">{t('channelProjects.settingsPage.deleteModalTitle')}</h3>
						<p class="text-[12px] text-white/50 leading-relaxed">
							{t('channelProjects.settingsPage.deleteModalDesc')}
						</p>
						<div class="flex items-center justify-end gap-3 pt-2">
							<button
								type="button"
								onClick={() => setShowDeleteModal(false)}
								class="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-[14px] text-[12px] font-bold transition"
							>
								{t('channelProjects.settingsPage.cancel')}
							</button>
							<button
								type="button"
								onClick={handleDelete}
								disabled={saving()}
								class="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-[14px] text-[12px] font-black transition active:scale-95 disabled:opacity-50 shadow-md"
							>
								{saving() ? t('channelProjects.settingsPage.deleting') : t('channelProjects.settingsPage.confirmDelete')}
							</button>
						</div>
					</div>
				</div>
			</Show>

			<ProjectHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				projectId={params.projectId}
				activeTab="settings"
			/>
		</div>
	);
};
