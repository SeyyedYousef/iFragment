import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createEffect, createResource, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { showToast } from '@/shared/ui/toast.js';

export const EditProjectPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();
	const [projectName, setProjectName] = createSignal('');
	const [inputChannel, setInputChannel] = createSignal('');
	const [outputChannel, setOutputChannel] = createSignal('');
	const [isSaving, setIsSaving] = createSignal(false);

	const [funnel] = createResource(
		() => params.id,
		(id) => channelApi.getFunnel(id)
	);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => navigate(-1));
		onCleanup(() => off());
	});

	createEffect(() => {
		const f = funnel();
		if (f) {
			setProjectName(f.project_name || '');
			setInputChannel(f.input_chat_id.toString());
			setOutputChannel(f.output_chat_id.toString());
		}
	});

	const handleSave = async () => {
		if (!projectName().trim() || !inputChannel().trim() || !outputChannel().trim()) {
			showToast(
				t('connectChannel.validationError') || 'Please specify project name, input, and output channels',
				'error',
			);
			hapticFeedback.notificationOccurred('error');
			return;
		}

		hapticFeedback.impactOccurred('medium');
		setIsSaving(true);

		try {
			// Connect input and output again to verify them and ensure they are added to DB
			showToast(t('connectChannel.verifyingInput') || 'Verifying input channel...', 'info');
			const inChan = await channelApi.connectChannel('auto', inputChannel().trim());

			showToast(t('connectChannel.verifyingOutput') || 'Verifying output channel...', 'info');
			const outChan = await channelApi.connectChannel('auto', outputChannel().trim());

			showToast(
				t('connectChannel.creatingConnection') || 'Updating project connection...',
				'info',
			);
			
			// We pass the new info to updateFunnel
			await channelApi.updateFunnel(params.id, {
				project_name: projectName().trim(),
				input_channel_id: inChan.id,
				output_channel_id: outChan.id,
			});

			showToast(
				t('connectChannel.success') || 'Project updated successfully!',
				'success',
			);
			
			hapticFeedback.notificationOccurred('success');
			// If output channel changed, the channel ID (and url) would be different, we should navigate back to dashboard list
			if (outChan.id !== params.id) {
				navigate('/managed-channels', { replace: true });
			} else {
				navigate(`/channel/${params.id}`, { replace: true });
			}
		} catch (err: any) {
			const errMsg =
				err?.response?.data?.error ||
				err?.response?.data?.message ||
				err?.message ||
				'Failed to update project';
			showToast(errMsg, 'error');
			hapticFeedback.notificationOccurred('error');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div
			class={`min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white ${isRtl() ? 'rtl' : 'ltr'}`}
		>
			{/* Header */}
			<div class="px-5 pt-6 pb-4 bg-[#0f1014]/80 backdrop-blur-md sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center gap-3">
				<button
					onClick={() => {
						hapticFeedback.impactOccurred('light');
						navigate(-1);
					}}
					class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
					aria-label="Back"
				>
					<span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">
						arrow_back
					</span>
				</button>
				<div class="flex flex-col overflow-hidden">
					<h1 class="text-[18px] font-black text-white leading-tight truncate">
						{t('connectChannel.editProjectTitle') || 'Edit Project'}
					</h1>
					<span class="text-[12px] text-on-surface-variant truncate">
						{t('connectChannel.editProjectSubtitle') || 'Update project name and channels'}
					</span>
				</div>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-6">
				<Show
					when={!funnel.loading}
					fallback={
						<div class="flex items-center justify-center py-10">
							<span class="w-8 h-8 border-4 border-[#32ade6]/25 border-t-[#32ade6] rounded-full animate-spin"></span>
						</div>
					}
				>
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.03 }}
						class="bg-[#1c1c1c] rounded-3xl p-5 border border-[#2a2a2a] flex flex-col gap-3"
					>
						<div class="flex items-center gap-3 mb-1">
							<div class="w-8 h-8 rounded-full bg-[#32ade6] text-black font-black flex items-center justify-center text-[15px]">
								<span class="material-symbols-outlined text-[18px]">edit</span>
							</div>
							<h2 class="text-[16px] font-bold text-white">
								{t('connectChannel.projectDetails') || 'Project Details'}
							</h2>
						</div>

						<div class="flex flex-col gap-4 mt-2">
							<div>
								<label class="block text-[11px] uppercase tracking-wider text-[#8e8e93] font-bold mb-1.5 pl-1">
									{t('connectChannel.projectNameLabel') || 'Project Name'}
								</label>
								<input
									type="text"
									value={projectName()}
									onInput={(e) => setProjectName(e.currentTarget.value)}
									placeholder="e.g. My Crypto Channel"
									class="bg-[#0f1014] border border-[#3a3a3c] text-white text-[15px] rounded-xl px-4 py-3.5 w-full focus:outline-none focus:border-[#32ade6] placeholder-[#5a5a5e] transition-colors"
								/>
							</div>

							<div>
								<label class="block text-[11px] uppercase tracking-wider text-[#8e8e93] font-bold mb-1.5 pl-1">
									{t('connectChannel.inputChannelLabel') || 'Input Channel (@username)'}
								</label>
								<input
									type="text"
									value={inputChannel()}
									onInput={(e) => setInputChannel(e.currentTarget.value)}
									placeholder="e.g. @my_raw_posts_channel"
									class="bg-[#0f1014] border border-[#3a3a3c] text-white text-[15px] rounded-xl px-4 py-3.5 w-full focus:outline-none focus:border-[#32ade6] placeholder-[#5a5a5e] transition-colors"
								/>
								<span class="text-[11px] text-[#8e8e93] mt-1.5 block">
									{t('connectChannel.inputChannelNote') || 'Ensure the bot is admin in the new channel.'}
								</span>
							</div>

							<div>
								<label class="block text-[11px] uppercase tracking-wider text-[#8e8e93] font-bold mb-1.5 pl-1">
									{t('connectChannel.outputChannelLabel') || 'Output Channel (@username)'}
								</label>
								<input
									type="text"
									value={outputChannel()}
									onInput={(e) => setOutputChannel(e.currentTarget.value)}
									placeholder="e.g. @my_public_channel"
									class="bg-[#0f1014] border border-[#3a3a3c] text-white text-[15px] rounded-xl px-4 py-3.5 w-full focus:outline-none focus:border-[#32ade6] placeholder-[#5a5a5e] transition-colors"
								/>
								<span class="text-[11px] text-[#8e8e93] mt-1.5 block">
									{t('connectChannel.outputChannelNote') || 'If changed, subscriptions will be transferred automatically.'}
								</span>
							</div>
						</div>

						<button
							onClick={handleSave}
							disabled={isSaving() || !projectName().trim() || !inputChannel().trim() || !outputChannel().trim()}
							class="mt-3 w-full bg-[#32ade6] text-black disabled:bg-[#32ade6]/40 disabled:text-black/50 rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold transition-all text-[15px]"
						>
							<Show
								when={!isSaving()}
								fallback={
									<span class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
								}
							>
								{t('connectChannel.saveBtn') || 'Save Changes'}
							</Show>
						</button>
					</Motion.div>
				</Show>
			</div>
		</div>
	);
};
