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
import { channelApi } from '@/entities/channel/api/channelApi.js';
import { ChannelContextBar, ChannelHamburgerMenu } from '@/entities/channel/index.js';
import type { ManagedChannel, Project } from '@/entities/channel/model/types.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';

export const ProjectsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isCreateModalOpen, setIsCreateModalOpen] = createSignal(false);

	// New Project Form Signals
	const [projectName, setProjectName] = createSignal('');
	const [sourceChannelId, setSourceChannelId] = createSignal('');
	const [sourceIdentifier, setSourceIdentifier] = createSignal('');
	const [targetChannelId, setTargetChannelId] = createSignal('');
	const [dropMedia, setDropMedia] = createSignal(false);
	const [removeAds, setRemoveAds] = createSignal(true);
	const [removeLinks, setRemoveLinks] = createSignal(false);
	const [removeHashtags, setRemoveHashtags] = createSignal(false);
	const [aiRewrite, setAiRewrite] = createSignal(false);
	const [watermark, setWatermark] = createSignal('');
	const [isSubmitting, setIsSubmitting] = createSignal(false);

	// Fast Switcher Signals for existing projects
	const [switchingProjectId, setSwitchingProjectId] = createSignal<string | null>(null);
	const [switchingType, setSwitchingType] = createSignal<'source' | 'target' | null>(null);

	// Fetch Projects and User's Managed Channels
	const [projects, { refetch: refetchProjects }] = createResource(channelApi.getProjects);
	const [userChannels] = createResource(() => channelApi.getUserChannels());

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					if (params.id) {
						navigate(`/channel/${params.id}/dashboard`);
					} else {
						navigate('/managed-channels');
					}
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

	const handleCreateProject = async (e: Event) => {
		e.preventDefault();
		if (!projectName().trim()) {
			showToast(t('channel.projects.name_required') || 'Project name is required', 'error');
			return;
		}

		setIsSubmitting(true);
		haptic.impact('medium');

		try {
			await channelApi.createProject({
				name: projectName().trim(),
				source_channel_id: sourceChannelId() || null,
				source_channel_identifier: sourceIdentifier().trim() || undefined,
				target_channel_id: targetChannelId() || null,
				pipeline_config: {
					drop_media: dropMedia(),
					remove_ads: removeAds(),
					remove_links: removeLinks(),
					remove_hashtags: removeHashtags(),
					ai_rewrite: aiRewrite(),
					watermark: watermark().trim(),
				},
			});

			haptic.notify('success');
			showToast(
				t('channel.projects.created_success') ||
					'Project created successfully with 72h free trial!',
				'success',
			);
			setIsCreateModalOpen(false);
			resetForm();
			refetchProjects();
		} catch (err: any) {
			haptic.notify('error');
			const errorMsg = err?.response?.data?.error || err?.message || 'Failed to create project';
			showToast(errorMsg, 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleToggleStatus = async (project: Project) => {
		const newStatus = project.status === 'active' ? 'paused' : 'active';
		haptic.impact('light');
		try {
			await channelApi.toggleProject(project.id, newStatus);
			showToast(
				newStatus === 'active'
					? t('channel.projects.resumed') || 'Project activated'
					: t('channel.projects.paused') || 'Project paused',
				'info',
			);
			refetchProjects();
		} catch (err: any) {
			showToast(err?.response?.data?.error || 'Failed to update project status', 'error');
		}
	};

	const handleFastSwitchChannel = async (
		projectId: string,
		field: 'source' | 'target',
		newChannelId: string,
	) => {
		haptic.impact('medium');
		try {
			await channelApi.updateProject(projectId, {
				[field === 'source' ? 'source_channel_id' : 'target_channel_id']: newChannelId || null,
			});
			haptic.notify('success');
			showToast(
				t('channel.projects.channel_switched') || 'Channel switched instantly without extra cost!',
				'success',
			);
			setSwitchingProjectId(null);
			setSwitchingType(null);
			refetchProjects();
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || 'Failed to switch channel', 'error');
		}
	};

	const handleDeleteProject = async (projectId: string) => {
		if (
			!confirm(
				t('channel.projects.confirm_delete') || 'Are you sure you want to delete this project?',
			)
		) {
			return;
		}
		haptic.notify('warning');
		try {
			await channelApi.deleteProject(projectId);
			showToast(t('channel.projects.deleted') || 'Project deleted', 'info');
			refetchProjects();
		} catch (err: any) {
			showToast(err?.response?.data?.error || 'Failed to delete project', 'error');
		}
	};

	const resetForm = () => {
		setProjectName('');
		setSourceChannelId('');
		setSourceIdentifier('');
		setTargetChannelId('');
		setDropMedia(false);
		setRemoveAds(true);
		setRemoveLinks(false);
		setRemoveHashtags(false);
		setAiRewrite(false);
		setWatermark('');
	};

	return (
		<div
			class="min-h-screen bg-neutral-950 text-neutral-100 pb-28 pt-2 px-4"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Context Bar */}
			<ChannelContextBar channelId={params.id} />

			{/* Hamburger Drawer */}
			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="projects"
			/>

			{/* Header */}
			<div class="mt-4 mb-6 flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
						<span>⚡</span>
						<span>{t('channel.projects.title') || 'Channel Projects'}</span>
					</h1>
					<p class="text-xs text-neutral-400 mt-1">
						{t('channel.projects.subtitle') ||
							'Decoupled pipelines: connect, filter, and switch channels freely in <5s.'}
					</p>
				</div>

				<button
					type="button"
					onClick={() => {
						haptic.impact('medium');
						setIsCreateModalOpen(true);
					}}
					class="py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#0098EA] to-[#0081C8] text-white text-xs font-semibold shadow-lg shadow-[#0098EA]/20 hover:opacity-95 active:scale-95 transition-all flex items-center gap-1.5"
				>
					<span>➕</span>
					<span>{t('channel.projects.new_project') || 'New Project'}</span>
				</button>
			</div>

			{/* Projects List */}
			<div class="space-y-4">
				<Show when={projects.loading}>
					<div class="space-y-3">
						<div class="h-40 rounded-2xl bg-neutral-900/60 animate-pulse border border-neutral-800" />
						<div class="h-40 rounded-2xl bg-neutral-900/60 animate-pulse border border-neutral-800" />
					</div>
				</Show>

				<Show when={!projects.loading && (!projects() || projects()?.length === 0)}>
					<div class="py-12 px-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-center space-y-4">
						<div class="w-16 h-16 mx-auto rounded-2xl bg-neutral-800/80 flex items-center justify-center text-3xl">
							🚀
						</div>
						<div class="space-y-1">
							<h3 class="text-base font-semibold text-white">
								{t('channel.projects.empty_title') || 'No Projects Yet'}
							</h3>
							<p class="text-xs text-neutral-400 max-w-sm mx-auto">
								{t('channel.projects.empty_desc') ||
									'Create your first project to start forwarding, filtering, or AI paraphrasing posts between channels.'}
							</p>
						</div>
						<button
							type="button"
							onClick={() => {
								haptic.impact('medium');
								setIsCreateModalOpen(true);
							}}
							class="py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#0098EA] to-[#0081C8] text-white text-xs font-semibold shadow-lg shadow-[#0098EA]/20 hover:opacity-95 active:scale-95 transition-all inline-flex items-center gap-2"
						>
							<span>➕</span>
							<span>{t('channel.projects.create_first') || 'Create 72h Free Trial Project'}</span>
						</button>
					</div>
				</Show>

				<For each={projects()}>
					{(project) => (
						<div class="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 hover:border-neutral-700 transition-all space-y-4 shadow-xl">
							{/* Card Header: Project Name & Status */}
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2.5">
									<div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0098EA]/20 to-blue-500/10 border border-[#0098EA]/30 flex items-center justify-center text-white font-bold text-sm">
										{project.name.charAt(0).toUpperCase()}
									</div>
									<div>
										<h3 class="text-sm font-bold text-white flex items-center gap-2">
											<span>{project.name}</span>
											<Show when={project.stars_subscription_active}>
												<span class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-medium">
													{t('channelProjects.starsActive')}
												</span>
											</Show>
											<Show when={!project.stars_subscription_active && project.trial_ends_at}>
												<span class="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-medium">
													{t('channelProjects.trial')}
												</span>
											</Show>
										</h3>
										<p class="text-[11px] text-neutral-400">
											{project.status === 'active'
												? '🟢 Active'
												: project.status === 'paused'
													? '⏸️ Paused'
													: '🔴 Expired'}
										</p>
									</div>
								</div>

								{/* Toggle & Action Buttons */}
								<div class="flex items-center gap-1.5">
									<button
										type="button"
										onClick={() => handleToggleStatus(project)}
										class={`p-2 rounded-xl text-xs font-semibold transition-all ${
											project.status === 'active'
												? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
												: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
										}`}
										title={project.status === 'active' ? 'Pause' : 'Activate'}
									>
										{project.status === 'active' ? '⏸️' : '▶️'}
									</button>

									<button
										type="button"
										onClick={() => handleDeleteProject(project.id)}
										class="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs transition-all"
										title={t('channelProjects.deleteProject')}
									>
										🗑️
									</button>
								</div>
							</div>

							{/* Pipeline Flow Visualization */}
							<div class="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/60 flex items-center justify-between gap-2 text-xs">
								{/* Source Channel Box */}
								<div class="flex-1 p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-center relative group">
									<div class="text-[10px] text-neutral-400 uppercase font-semibold mb-1">
										{t('channel.projects.source') || 'Source'}
									</div>
									<div class="font-medium text-white truncate text-xs">
										{project.source_title ||
											(project.source_chat_id ? `ID: ${project.source_chat_id}` : 'Not connected')}
									</div>
									<button
										type="button"
										onClick={() => {
											setSwitchingProjectId(project.id);
											setSwitchingType('source');
										}}
										class="mt-1 text-[10px] text-[#0098EA] hover:underline block mx-auto"
									>
										{t('channel.projects.switch') || '⇄ Fast Switch'}
									</button>
								</div>

								{/* Arrow / Badges */}
								<div class="flex flex-col items-center justify-center px-1 text-neutral-500">
									<span class="text-sm font-bold text-[#0098EA]">➔</span>
									<span class="text-[9px] text-neutral-400">&lt;5s sync</span>
								</div>

								{/* Target Channel Box */}
								<div class="flex-1 p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-center relative group">
									<div class="text-[10px] text-neutral-400 uppercase font-semibold mb-1">
										{t('channel.projects.target') || 'Target'}
									</div>
									<div class="font-medium text-white truncate text-xs">
										{project.target_title ||
											(project.target_chat_id ? `ID: ${project.target_chat_id}` : 'Not connected')}
									</div>
									<button
										type="button"
										onClick={() => {
											setSwitchingProjectId(project.id);
											setSwitchingType('target');
										}}
										class="mt-1 text-[10px] text-[#0098EA] hover:underline block mx-auto"
									>
										{t('channel.projects.switch') || '⇄ Fast Switch'}
									</button>
								</div>
							</div>

							{/* Fast Switcher Inline Modal */}
							<Show when={switchingProjectId() === project.id}>
								<div class="p-3 rounded-xl bg-neutral-950 border border-[#0098EA]/40 space-y-2">
									<div class="text-xs font-semibold text-white flex items-center justify-between">
										<span>
											{switchingType() === 'source'
												? t('channel.projects.select_new_source') || 'Select New Source Channel'
												: t('channel.projects.select_new_target') || 'Select New Target Channel'}
										</span>
										<button
											type="button"
											onClick={() => setSwitchingProjectId(null)}
											class="text-neutral-400 hover:text-white text-xs"
										>
											✕
										</button>
									</div>
									<select
										onChange={(e) =>
											handleFastSwitchChannel(project.id, switchingType()!, e.currentTarget.value)
										}
										class="w-full py-2 px-3 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs"
									>
										<option value="">
											{t('channel.projects.select_channel_placeholder') || '-- Choose Channel --'}
										</option>
										<For each={userChannels()}>
											{(ch: ManagedChannel) => (
												<option value={ch.id}>
													{ch.chat_title} (@{ch.chat_username || ch.chat_id})
												</option>
											)}
										</For>
									</select>
								</div>
							</Show>

							{/* Pipeline Badges */}
							<div class="flex flex-wrap items-center gap-1.5 pt-1">
								<Show when={project.pipeline_config?.remove_ads}>
									<span class="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
										{t('channelForwarding.noAds')}
									</span>
								</Show>
								<Show when={project.pipeline_config?.remove_links}>
									<span class="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
										{t('channelForwarding.noLinks')}
									</span>
								</Show>
								<Show when={project.pipeline_config?.remove_hashtags}>
									<span class="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">
										{t('channelForwarding.noTags')}
									</span>
								</Show>
								<Show when={project.pipeline_config?.drop_media}>
									<span class="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px]">
										{t('channelProjects.textOnly')}
									</span>
								</Show>
								<Show when={project.pipeline_config?.ai_rewrite}>
									<span class="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
										{t('channelProjects.aiRewrite')}
									</span>
								</Show>
							</div>
						</div>
					)}
				</For>
			</div>

			{/* Create Project Modal */}
			<Show when={isCreateModalOpen()}>
				<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
					<Motion.div
						initial={{ scale: 0.95, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						class="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
					>
						<div class="flex items-center justify-between pb-2 border-b border-neutral-800">
							<h3 class="text-base font-bold text-white flex items-center gap-2">
								<span>🚀</span>
								<span>{t('channel.projects.create_modal_title') || 'Create New Project'}</span>
							</h3>
							<button
								type="button"
								onClick={() => setIsCreateModalOpen(false)}
								class="text-neutral-400 hover:text-white p-1"
							>
								✕
							</button>
						</div>

						<form onSubmit={handleCreateProject} class="space-y-4">
							{/* Project Name */}
							<div class="space-y-1">
								<div class="text-xs font-semibold text-neutral-300">
									{t('channel.projects.form_name') || 'Project Name'}
								</div>
								<input
									type="text"
									value={projectName()}
									onInput={(e) => setProjectName(e.currentTarget.value)}
									placeholder={t('channelProjects.namePlaceholder')}
									class="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:border-[#0098EA] focus:outline-none"
									required
								/>
							</div>

							{/* Source Channel */}
							<div class="space-y-1">
								<div class="text-xs font-semibold text-neutral-300">
									{t('channel.projects.form_source') || 'Source Channel (Input)'}
								</div>
								<select
									value={sourceChannelId()}
									onChange={(e) => setSourceChannelId(e.currentTarget.value)}
									class="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs"
								>
									<option value="">
										{t('channel.projects.choose_or_type') || '-- Select from Connected Channels --'}
									</option>
									<For each={userChannels()}>
										{(ch: ManagedChannel) => (
											<option value={ch.id}>
												{ch.chat_title} (@{ch.chat_username || ch.chat_id})
											</option>
										)}
									</For>
								</select>
								<input
									type="text"
									value={sourceIdentifier()}
									onInput={(e) => setSourceIdentifier(e.currentTarget.value)}
									placeholder={
										t('channel.projects.or_public_username') ||
										'Or enter public @channel (e.g. @durov)'
									}
									class="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs focus:border-[#0098EA] focus:outline-none mt-1"
								/>
							</div>

							{/* Target Channel */}
							<div class="space-y-1">
								<div class="text-xs font-semibold text-neutral-300">
									{t('channel.projects.form_target') || 'Target Channel (Output Destination)'}
								</div>
								<select
									value={targetChannelId()}
									onChange={(e) => setTargetChannelId(e.currentTarget.value)}
									class="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-white text-xs"
								>
									<option value="">
										{t('channel.projects.select_target_placeholder') ||
											'-- Choose Managed Channel --'}
									</option>
									<For each={userChannels()}>
										{(ch: ManagedChannel) => (
											<option value={ch.id}>
												{ch.chat_title} (@{ch.chat_username || ch.chat_id})
											</option>
										)}
									</For>
								</select>
							</div>

							{/* Pipeline Toggles */}
							<div class="space-y-2 pt-2 border-t border-neutral-800">
								<div class="text-xs font-semibold text-neutral-300">
									{t('channel.projects.pipeline_options') || 'Pipeline Processing Rules'}
								</div>

								<div class="grid grid-cols-2 gap-2">
									<div class="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs cursor-pointer">
										<input
											type="checkbox"
											checked={removeAds()}
											onChange={(e) => setRemoveAds(e.currentTarget.checked)}
											class="rounded text-[#0098EA]"
										/>
										<span>🛡️ {t('channel.projects.remove_ads') || 'Remove Ads'}</span>
									</div>

									<div class="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs cursor-pointer">
										<input
											type="checkbox"
											checked={removeLinks()}
											onChange={(e) => setRemoveLinks(e.currentTarget.checked)}
											class="rounded text-[#0098EA]"
										/>
										<span>🔗 {t('channel.projects.remove_links') || 'Remove Links'}</span>
									</div>

									<div class="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs cursor-pointer">
										<input
											type="checkbox"
											checked={removeHashtags()}
											onChange={(e) => setRemoveHashtags(e.currentTarget.checked)}
											class="rounded text-[#0098EA]"
										/>
										<span># {t('channel.projects.remove_hashtags') || 'No Hashtags'}</span>
									</div>

									<div class="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs cursor-pointer">
										<input
											type="checkbox"
											checked={dropMedia()}
											onChange={(e) => setDropMedia(e.currentTarget.checked)}
											class="rounded text-[#0098EA]"
										/>
										<span>📄 {t('channel.projects.drop_media') || 'Text Only'}</span>
									</div>
								</div>
							</div>

							{/* Submit Button */}
							<button
								type="submit"
								disabled={isSubmitting()}
								class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0098EA] to-[#0081C8] text-white font-semibold text-sm shadow-lg shadow-[#0098EA]/20 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
							>
								<Show when={isSubmitting()}>
									<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								</Show>
								<span>
									{t('channel.projects.start_trial_btn') || 'Create Project (72h Free Trial)'}
								</span>
							</button>
						</form>
					</Motion.div>
				</div>
			</Show>
		</div>
	);
};
