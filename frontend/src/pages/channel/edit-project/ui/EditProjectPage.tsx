import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	type Component,
	createEffect,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { channelApi, ChannelHamburgerMenu } from '@/entities/channel/index.js';
import type { ManagedChannel, Project } from '@/entities/channel/model/types.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';

export const EditProjectPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [projectName, setProjectName] = createSignal('');
	const [sourceChannelId, setSourceChannelId] = createSignal('');
	const [sourceCustomInput, setSourceCustomInput] = createSignal('');
	const [targetChannelId, setTargetChannelId] = createSignal('');
	const [targetCustomInput, setTargetCustomInput] = createSignal('');
	const [isVerifyingSource, setIsVerifyingSource] = createSignal(false);
	const [isVerifyingTarget, setIsVerifyingTarget] = createSignal(false);

	// Pipeline filters & AI config
	const [removeAds, setRemoveAds] = createSignal(true);
	const [removeLinks, setRemoveLinks] = createSignal(false);
	const [removeHashtags, setRemoveHashtags] = createSignal(false);
	const [dropMedia, setDropMedia] = createSignal(false);
	const [aiRewrite, setAiRewrite] = createSignal(false);
	const [watermark, setWatermark] = createSignal('');

	const [isSaving, setIsSaving] = createSignal(false);

	const channelIdForMenu = () => targetChannelId() || sourceChannelId() || params.id;

	// Fetch project data (with fallback to funnel)
	const [projectData] = createResource(
		() => params.id,
		async (id: string): Promise<Project | null> => {
			try {
				const p = await channelApi.getProject(id);
				if (p && p.id) return p;
			} catch (_e) {}

			try {
				const f = await channelApi.getFunnel(id);
				if (f) {
					return {
						id: f.id || id,
						owner_user_id: f.owner_user_id || 0,
						name: f.project_name || '',
						status: f.is_active ? 'active' : 'paused',
						stars_subscription_active: true,
						trial_used: true,
						source_channel_id: f.input_channel_id ? String(f.input_channel_id) : null,
						target_channel_id: f.output_channel_id ? String(f.output_channel_id) : null,
						source_chat_id: f.input_chat_id,
						target_chat_id: f.output_chat_id,
						pipeline_config: {},
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					};
				}
			} catch (_e) {}

			return null;
		},
	);

	// Fetch user's managed channels for easy selection
	const [userChannels] = createResource(() => channelApi.getUserChannels());

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					navigate(-1);
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

	createEffect(() => {
		const p = projectData();
		if (p) {
			setProjectName(p.name || '');
			if (p.source_channel_id) {
				setSourceChannelId(p.source_channel_id);
			} else if (p.source_chat_id) {
				setSourceCustomInput(String(p.source_chat_id));
			} else if (p.pipeline_config?.source_channel_identifier) {
				setSourceCustomInput(p.pipeline_config.source_channel_identifier);
			}

			if (p.target_channel_id) {
				setTargetChannelId(p.target_channel_id);
			} else if (p.target_chat_id) {
				setTargetCustomInput(String(p.target_chat_id));
			} else if (p.pipeline_config?.target_channel_identifier) {
				setTargetCustomInput(p.pipeline_config.target_channel_identifier);
			}

			if (p.pipeline_config) {
				setRemoveAds(p.pipeline_config.remove_ads !== false);
				setRemoveLinks(!!p.pipeline_config.remove_links);
				setRemoveHashtags(!!p.pipeline_config.remove_hashtags);
				setDropMedia(!!p.pipeline_config.drop_media);
				setAiRewrite(!!p.pipeline_config.ai_rewrite);
				setWatermark(p.pipeline_config.watermark || '');
			}
		}
	});

	const handleVerifySource = async () => {
		const val = sourceCustomInput().trim();
		if (!val) return;
		setIsVerifyingSource(true);
		try {
			const res = await channelApi.connectChannel('auto', val);
			if (res && res.id) {
				setSourceChannelId(res.id);
				setSourceCustomInput(res.chat_username ? `@${res.chat_username}` : res.chat_title || '');
				haptic.notify('success');
				showToast(t('managedChannels.verified') || 'Source channel verified!', 'success');
			}
		} catch (err: any) {
			const msg = err?.response?.data?.error || err?.message || 'Bot must be admin in source channel';
			showToast(msg, 'error');
			haptic.notify('error');
		} finally {
			setIsVerifyingSource(false);
		}
	};

	const handleVerifyTarget = async () => {
		const val = targetCustomInput().trim();
		if (!val) return;
		setIsVerifyingTarget(true);
		try {
			const res = await channelApi.connectChannel('auto', val);
			if (res && res.id) {
				setTargetChannelId(res.id);
				setTargetCustomInput(res.chat_username ? `@${res.chat_username}` : res.chat_title || '');
				haptic.notify('success');
				showToast(t('managedChannels.verified') || 'Target channel verified!', 'success');
			}
		} catch (err: any) {
			const msg = err?.response?.data?.error || err?.message || 'Bot must be admin in target channel';
			showToast(msg, 'error');
			haptic.notify('error');
		} finally {
			setIsVerifyingTarget(false);
		}
	};

	const handleSave = async () => {
		if (!projectName().trim()) {
			showToast(t('channel.projects.name_required') || 'Project name is required', 'error');
			haptic.notify('error');
			return;
		}

		const hasSource = sourceChannelId() || sourceCustomInput().trim();
		const hasTarget = targetChannelId() || targetCustomInput().trim();

		if (!hasSource || !hasTarget) {
			showToast(
				t('channel.projects.channels_required') || 'Both source and target channels are required',
				'error',
			);
			haptic.notify('error');
			return;
		}

		haptic.impact('medium');
		setIsSaving(true);

		// If user typed custom input, connect channel automatically
		if (!sourceChannelId() && sourceCustomInput().trim()) {
			try {
				showToast(t('connectChannel.verifyingInput') || 'Verifying input channel...', 'info');
				const inChan = await channelApi.connectChannel('auto', sourceCustomInput().trim());
				if (inChan && inChan.id) {
					setSourceChannelId(inChan.id);
				}
			} catch (e: any) {
				const msg = e?.response?.data?.error || e?.message || 'Failed to verify input channel';
				showToast(msg, 'error');
				setIsSaving(false);
				return;
			}
		}

		if (!targetChannelId() && targetCustomInput().trim()) {
			try {
				showToast(t('connectChannel.verifyingOutput') || 'Verifying target channel...', 'info');
				const outChan = await channelApi.connectChannel('auto', targetCustomInput().trim());
				if (outChan && outChan.id) {
					setTargetChannelId(outChan.id);
				}
			} catch (e: any) {
				const msg = e?.response?.data?.error || e?.message || 'Failed to verify target channel';
				showToast(msg, 'error');
				setIsSaving(false);
				return;
			}
		}

		try {
			const pipelineConfig = {
				remove_ads: removeAds(),
				remove_links: removeLinks(),
				remove_hashtags: removeHashtags(),
				drop_media: dropMedia(),
				ai_rewrite: aiRewrite(),
				ai_model: 'gemini-3.8-flash',
				watermark: watermark().trim(),
			};

			const payload: any = {
				name: projectName().trim(),
				source_channel_id: sourceChannelId() || null,
				target_channel_id: targetChannelId() || null,
				pipeline_config: pipelineConfig,
			};

			if (!sourceChannelId() && sourceCustomInput().trim()) {
				payload.source_channel_identifier = sourceCustomInput().trim();
			}
			if (!targetChannelId() && targetCustomInput().trim()) {
				payload.target_channel_identifier = targetCustomInput().trim();
			}

			await channelApi.updateProject(params.id, payload);

			haptic.notify('success');
			showToast(
				t('channel.projects.updated_success') || 'Project pipeline saved successfully!',
				'success',
			);
			navigate('/channel/projects', { replace: true });
		} catch (err: any) {
			// Fallback: try updateFunnel if project update errored
			try {
				await channelApi.updateFunnel(params.id, {
					project_name: projectName().trim(),
					input_channel_id: sourceChannelId() || sourceCustomInput().trim(),
					output_channel_id: targetChannelId() || targetCustomInput().trim(),
				});
				haptic.notify('success');
				showToast(t('connectChannel.success') || 'Project updated successfully!', 'success');
				navigate('/channel/projects', { replace: true });
				return;
			} catch (_fbErr) {}

			const errMsg =
				err?.response?.data?.error ||
				err?.response?.data?.message ||
				err?.message ||
				'Failed to update project';
			showToast(errMsg, 'error');
			haptic.notify('error');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div
			class={`min-h-screen bg-[#030303] pb-36 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30 ${isRtl() ? 'rtl' : 'ltr'}`}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[380px] bg-gradient-to-b from-[#3390ec]/20 via-transparent to-transparent blur-[90px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="px-5 pt-6 pb-4 bg-[#030303]/85 backdrop-blur-2xl sticky top-0 z-40 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3.5">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(-1);
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight flex items-center gap-2">
							<span>⚡</span>
							<span>{t('connectChannel.editProjectTitle') || 'Project Settings & Funnel'}</span>
						</h1>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider truncate mt-0.5">
							{t('connectChannel.editProjectSubtitle') || 'Configure AI rewriting, filters & channels'}
						</span>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<div class="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#3390ec] text-[11px] font-black flex items-center gap-1">
						<span class="w-1.5 h-1.5 rounded-full bg-[#3390ec] animate-pulse" />
						<span>Funnel</span>
					</div>
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							setIsMenuOpen(true);
						}}
						class="w-10 h-10 rounded-[12px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.toggle') || 'Menu'}
						title={t('channel.menu.title') || 'Menu'}
					>
						<span class="material-symbols-outlined text-[20px]">menu</span>
					</button>
				</div>
			</div>

			{/* Channel Hamburger Drawer */}
			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={channelIdForMenu()}
				activeTab="projects"
			/>

			<div class="px-5 pt-6 flex flex-col gap-6 max-w-lg mx-auto relative z-10 w-full">
				<Show
					when={!projectData.loading}
					fallback={
						<div class="flex flex-col gap-4 animate-pulse">
							<div class="h-44 bg-[#12141C]/50 rounded-[24px] border border-white/5 w-full" />
							<div class="h-64 bg-[#12141C]/50 rounded-[24px] border border-white/5 w-full" />
						</div>
					}
				>
					{/* ── CARD 1: Basic Info & Name ── */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.05 }}
						class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-5 border border-white/5 flex flex-col gap-4 shadow-sm relative overflow-hidden"
					>
						<div class="flex items-center gap-3 border-b border-white/5 pb-3">
							<div class="w-9 h-9 rounded-[12px] bg-[#3390ec]/15 text-[#3390ec] font-black flex items-center justify-center border border-[#3390ec]/30 shadow-inner shrink-0">
								<span class="material-symbols-outlined text-[18px]">edit_note</span>
							</div>
							<h2 class="text-[15px] font-black text-white tracking-tight">
								{t('connectChannel.projectDetails') || 'Project Identity'}
							</h2>
						</div>

						<div class="flex flex-col gap-1.5">
							<label class="block text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
								{t('connectChannel.projectNameLabel') || 'Project Name'}
							</label>
							<input
								type="text"
								value={projectName()}
								onInput={(e) => setProjectName(e.currentTarget.value)}
								placeholder="e.g. Crypto Signals Funnel"
								class="w-full h-13 bg-[#08090D] border border-white/5 text-white text-[14px] font-bold rounded-[16px] px-4 focus:outline-none focus:border-[#3390ec]/50 placeholder-white/20 transition-all shadow-inner"
							/>
						</div>
					</Motion.div>

					{/* ── CARD 2: Channel Routing (Input & Output) ── */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
						class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-5 border border-white/5 flex flex-col gap-5 shadow-sm relative overflow-hidden"
					>
						<div class="flex items-center justify-between border-b border-white/5 pb-3">
							<div class="flex items-center gap-3">
								<div class="w-9 h-9 rounded-[12px] bg-cyan-500/15 text-cyan-400 font-black flex items-center justify-center border border-cyan-500/30 shadow-inner shrink-0">
									<span class="material-symbols-outlined text-[18px]">alt_route</span>
								</div>
								<h2 class="text-[15px] font-black text-white tracking-tight">
									{t('channel.projects.channels') || 'Channel Funnel Routing'}
								</h2>
							</div>
							<span class="text-[10px] text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
								Live Preview Active
							</span>
						</div>

						{/* Source Channel (Input) */}
						<div class="flex flex-col gap-2 p-3.5 rounded-[18px] bg-[#08090D]/80 border border-white/5">
							<div class="flex items-center justify-between">
								<span class="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
									<span>📥</span>
									<span>{t('channel.projects.source') || 'Input Channel (Source)'}</span>
								</span>
								<span class="text-[10px] text-white/40">Where raw posts are drafted</span>
							</div>

							<select
								value={sourceChannelId()}
								onChange={(e) => {
									setSourceChannelId(e.currentTarget.value);
									if (e.currentTarget.value) setSourceCustomInput('');
								}}
								class="w-full h-12 bg-[#12141C] border border-white/10 text-white text-[13px] font-bold rounded-[14px] px-3 focus:outline-none focus:border-cyan-500/50"
							>
								<option value="">-- Select from your connected channels --</option>
								<For each={userChannels()}>
									{(ch: ManagedChannel) => (
										<option value={ch.id}>
											{ch.chat_title} (@{ch.chat_username || ch.chat_id})
										</option>
									)}
								</For>
							</select>

							<Show when={!sourceChannelId()}>
								<div class="mt-1 flex gap-2">
									<input
										type="text"
										value={sourceCustomInput()}
										onInput={(e) => setSourceCustomInput(e.currentTarget.value)}
										placeholder="Or enter @channel_username or Chat ID"
										class="flex-1 h-11 bg-[#12141C] border border-white/5 text-white text-[12px] font-mono rounded-[12px] px-3 focus:outline-none focus:border-cyan-500/50 placeholder-white/20"
										dir="ltr"
									/>
									<button
										type="button"
										onClick={handleVerifySource}
										disabled={isVerifyingSource() || !sourceCustomInput().trim()}
										class="px-3 h-11 rounded-[12px] bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 font-bold text-xs flex items-center gap-1 border border-cyan-500/30 transition-all disabled:opacity-40 shrink-0 active:scale-95"
									>
										<Show
											when={!isVerifyingSource()}
											fallback={
												<span class="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
											}
										>
											<span>{t('managedChannels.check') || 'Check'}</span>
										</Show>
									</button>
								</div>
							</Show>
						</div>

						{/* Funnel Arrow indicator */}
						<div class="flex items-center justify-center -my-2 text-white/30">
							<div class="w-8 h-8 rounded-full bg-[#08090D] border border-white/10 flex items-center justify-center text-[16px] text-[#3390ec] shadow-sm">
								⬇️
							</div>
						</div>

						{/* Target Channel (Output) */}
						<div class="flex flex-col gap-2 p-3.5 rounded-[18px] bg-[#08090D]/80 border border-white/5">
							<div class="flex items-center justify-between">
								<span class="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
									<span>📤</span>
									<span>{t('channel.projects.target') || 'Output Channel (Target)'}</span>
								</span>
								<span class="text-[10px] text-white/40">Only publishes after approval</span>
							</div>

							<select
								value={targetChannelId()}
								onChange={(e) => {
									setTargetChannelId(e.currentTarget.value);
									if (e.currentTarget.value) setTargetCustomInput('');
								}}
								class="w-full h-12 bg-[#12141C] border border-white/10 text-white text-[13px] font-bold rounded-[14px] px-3 focus:outline-none focus:border-emerald-500/50"
							>
								<option value="">-- Select from your connected channels --</option>
								<For each={userChannels()}>
									{(ch: ManagedChannel) => (
										<option value={ch.id}>
											{ch.chat_title} (@{ch.chat_username || ch.chat_id})
										</option>
									)}
								</For>
							</select>

							<Show when={!targetChannelId()}>
								<div class="mt-1 flex gap-2">
									<input
										type="text"
										value={targetCustomInput()}
										onInput={(e) => setTargetCustomInput(e.currentTarget.value)}
										placeholder="Or enter @channel_username or Chat ID"
										class="flex-1 h-11 bg-[#12141C] border border-white/5 text-white text-[12px] font-mono rounded-[12px] px-3 focus:outline-none focus:border-emerald-500/50 placeholder-white/20"
										dir="ltr"
									/>
									<button
										type="button"
										onClick={handleVerifyTarget}
										disabled={isVerifyingTarget() || !targetCustomInput().trim()}
										class="px-3 h-11 rounded-[12px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1 border border-emerald-500/30 transition-all disabled:opacity-40 shrink-0 active:scale-95"
									>
										<Show
											when={!isVerifyingTarget()}
											fallback={
												<span class="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
											}
										>
											<span>{t('managedChannels.check') || 'Check'}</span>
										</Show>
									</button>
								</div>
							</Show>
						</div>
					</Motion.div>

					{/* ── CARD 3: Pipeline Processing & Gemini AI ── */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.15 }}
						class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-5 border border-white/5 flex flex-col gap-4 shadow-sm relative overflow-hidden"
					>
						<div class="flex items-center justify-between border-b border-white/5 pb-3">
							<div class="flex items-center gap-3">
								<div class="w-9 h-9 rounded-[12px] bg-amber-500/15 text-amber-400 font-black flex items-center justify-center border border-amber-500/30 shadow-inner shrink-0">
									<span class="material-symbols-outlined text-[18px]">auto_awesome</span>
								</div>
								<h2 class="text-[15px] font-black text-white tracking-tight">
									{t('channel.projects.pipeline_filters') || 'Processing Filters & AI'}
								</h2>
							</div>
							<span class="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
								Gemini 3.8 Flash
							</span>
						</div>

						{/* Toggle: Remove Ads */}
						<div class="flex items-center justify-between p-3 rounded-[16px] bg-[#08090D] border border-white/5">
							<div class="flex flex-col">
								<span class="text-[13px] font-bold text-white flex items-center gap-2">
									<span>🛡️</span>
									<span>{t('channelForwarding.noAds') || 'Remove Ads'}</span>
								</span>
								<span class="text-[11px] text-white/40">Automatically strip sponsor links & promos</span>
							</div>
							<input
								type="checkbox"
								checked={removeAds()}
								onChange={(e) => setRemoveAds(e.currentTarget.checked)}
								class="w-5 h-5 rounded accent-[#3390ec] cursor-pointer"
							/>
						</div>

						{/* Toggle: Remove Links */}
						<div class="flex items-center justify-between p-3 rounded-[16px] bg-[#08090D] border border-white/5">
							<div class="flex flex-col">
								<span class="text-[13px] font-bold text-white flex items-center gap-2">
									<span>🔗</span>
									<span>{t('channelForwarding.noLinks') || 'Remove Links'}</span>
								</span>
								<span class="text-[11px] text-white/40">Clean all external URLs from messages</span>
							</div>
							<input
								type="checkbox"
								checked={removeLinks()}
								onChange={(e) => setRemoveLinks(e.currentTarget.checked)}
								class="w-5 h-5 rounded accent-[#3390ec] cursor-pointer"
							/>
						</div>

						{/* Toggle: Remove Hashtags */}
						<div class="flex items-center justify-between p-3 rounded-[16px] bg-[#08090D] border border-white/5">
							<div class="flex flex-col">
								<span class="text-[13px] font-bold text-white flex items-center gap-2">
									<span>#️⃣</span>
									<span>{t('channelForwarding.noHashtags') || 'Remove Hashtags'}</span>
								</span>
								<span class="text-[11px] text-white/40">Strip #tags from input posts</span>
							</div>
							<input
								type="checkbox"
								checked={removeHashtags()}
								onChange={(e) => setRemoveHashtags(e.currentTarget.checked)}
								class="w-5 h-5 rounded accent-[#3390ec] cursor-pointer"
							/>
						</div>

						{/* Toggle: Drop Media */}
						<div class="flex items-center justify-between p-3 rounded-[16px] bg-[#08090D] border border-white/5">
							<div class="flex flex-col">
								<span class="text-[13px] font-bold text-white flex items-center gap-2">
									<span>📷</span>
									<span>{t('channelProjects.dropMedia') || 'Drop Media (Text-Only)'}</span>
								</span>
								<span class="text-[11px] text-white/40">Discard photos/videos, forward text caption only</span>
							</div>
							<input
								type="checkbox"
								checked={dropMedia()}
								onChange={(e) => setDropMedia(e.currentTarget.checked)}
								class="w-5 h-5 rounded accent-[#3390ec] cursor-pointer"
							/>
						</div>

						{/* Toggle: Gemini AI Rewrite */}
						<div class="flex items-center justify-between p-3 rounded-[16px] bg-gradient-to-r from-purple-950/20 to-[#08090D] border border-purple-500/20">
							<div class="flex flex-col">
								<span class="text-[13px] font-bold text-purple-300 flex items-center gap-2">
									<span>🤖</span>
									<span>AI Rewrite (Gemini 3.8 Flash)</span>
								</span>
								<span class="text-[11px] text-white/40">Generates 3 engaging variations automatically</span>
							</div>
							<input
								type="checkbox"
								checked={aiRewrite()}
								onChange={(e) => setAiRewrite(e.currentTarget.checked)}
								class="w-5 h-5 rounded accent-purple-500 cursor-pointer"
							/>
						</div>

						{/* Watermark / Brand Signature */}
						<div class="flex flex-col gap-1.5">
							<label class="block text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
								{t('channelForwarding.watermark') || 'Brand Signature / Watermark'}
							</label>
							<input
								type="text"
								value={watermark()}
								onInput={(e) => setWatermark(e.currentTarget.value)}
								placeholder="e.g. 📢 Join @MyChannel for daily signals"
								class="w-full h-12 bg-[#08090D] border border-white/5 text-white text-[13px] rounded-[14px] px-4 focus:outline-none focus:border-[#3390ec]/50 placeholder-white/20 transition-all shadow-inner"
							/>
						</div>
					</Motion.div>
				</Show>
			</div>

			{/* ═══════ FLOATING SUBMIT BUTTON ═══════ */}
			<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#030303] via-[#030303]/90 to-transparent z-40 pointer-events-none">
				<div class="max-w-lg mx-auto pointer-events-auto">
					<button
						type="button"
						onClick={handleSave}
						disabled={isSaving() || !projectName().trim()}
						class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[18px] font-black text-[14px] uppercase tracking-widest transition-all disabled:opacity-40 disabled:scale-100 flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(51,144,236,0.35)] active:scale-95 border border-white/10"
					>
						<Show
							when={!isSaving()}
							fallback={
								<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
							}
						>
							<span>{t('connectChannel.saveBtn') || 'Save Project Pipeline'}</span>
							<span class="material-symbols-outlined text-[20px]">save</span>
						</Show>
					</button>
				</div>
			</div>
		</div>
	);
};

