import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import {
	Component,
	createEffect,
	createResource,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
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
		(id) => channelApi.getFunnel(id),
	);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			try { hapticFeedback.impactOccurred('light'); } catch (_) {}
			navigate(-1);
		});
		onCleanup(() => {
			off();
			backButton.hide();
		});
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
			showToast(t('connectChannel.validationError'), 'error');
			try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
			return;
		}

		try { hapticFeedback.impactOccurred('medium'); } catch (_) {}
		setIsSaving(true);

		try {
			showToast(t('connectChannel.verifyingInput'), 'info');
			const inChan = await channelApi.connectChannel('auto', inputChannel().trim());

			showToast(t('connectChannel.verifyingOutput'), 'info');
			const outChan = await channelApi.connectChannel('auto', outputChannel().trim());

			showToast(t('connectChannel.creatingConnection'), 'info');

			await channelApi.updateFunnel(params.id, {
				project_name: projectName().trim(),
				input_channel_id: inChan.id,
				output_channel_id: outChan.id,
			});

			showToast(t('connectChannel.success'), 'success');

			try { hapticFeedback.notificationOccurred('success'); } catch (_) {}
			
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
			try { hapticFeedback.notificationOccurred('error'); } catch (_) {}
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div
			class={`min-h-screen bg-[#030303] pb-32 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30 ${isRtl() ? 'rtl' : 'ltr'}`}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="px-5 pt-6 pb-4 bg-[#030303]/85 backdrop-blur-2xl sticky top-0 z-40 border-b border-white/5 flex items-center gap-3.5 shadow-sm">
				<button
					onClick={() => {
						try { hapticFeedback.impactOccurred('light'); } catch (_) {}
						navigate(-1);
					}}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
					aria-label={t('common.back')}
				>
					<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">
						arrow_back
					</span>
				</button>
				<div class="flex flex-col overflow-hidden">
					<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
						{t('connectChannel.editProjectTitle')}
					</h1>
					<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider truncate mt-0.5">
						{t('connectChannel.editProjectSubtitle')}
					</span>
				</div>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-6 max-w-md mx-auto relative z-10 w-full">
				<Show
					when={!funnel.loading}
					fallback={
						<div class="flex flex-col gap-4 animate-pulse">
							<div class="h-64 bg-[#12141C]/50 rounded-[24px] border border-white/5 w-full"></div>
						</div>
					}
				>
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.05 }}
						class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-5 border border-white/5 flex flex-col gap-5 shadow-sm relative overflow-hidden"
					>
						<div class="absolute -right-6 -top-6 w-24 h-24 bg-[#3390ec]/10 blur-2xl rounded-full pointer-events-none" />

						<div class="flex items-center gap-3.5 relative z-10 border-b border-white/5 pb-4">
							<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/15 text-[#3390ec] font-black flex items-center justify-center border border-[#3390ec]/30 shadow-inner shrink-0">
								<span class="material-symbols-outlined text-[20px]">edit</span>
							</div>
							<h2 class="text-[15px] font-black text-white tracking-tight">
								{t('connectChannel.projectDetails')}
							</h2>
						</div>

						<div class="flex flex-col gap-5 relative z-10">
							<div class="flex flex-col gap-1.5">
								<label class="block text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
									{t('connectChannel.projectNameLabel')}
								</label>
								<input
									type="text"
									value={projectName()}
									onInput={(e) => setProjectName(e.currentTarget.value)}
									placeholder="e.g. My Crypto Channel"
									class="w-full h-14 bg-[#08090D] border border-white/5 text-white text-[14px] font-bold rounded-[16px] px-4 focus:outline-none focus:border-[#3390ec]/50 placeholder-white/20 transition-all shadow-inner"
								/>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="block text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
									{t('connectChannel.inputChannelLabel')}
								</label>
								<input
									type="text"
									value={inputChannel()}
									onInput={(e) => setInputChannel(e.currentTarget.value)}
									placeholder="e.g. @my_raw_posts_channel"
									class="w-full h-14 bg-[#08090D] border border-white/5 text-white text-[14px] font-bold font-mono rounded-[16px] px-4 focus:outline-none focus:border-[#3390ec]/50 placeholder-white/20 transition-all shadow-inner"
									dir="ltr"
								/>
								<span class="text-[10px] font-medium text-white/40 mt-0.5 block px-1 leading-snug">
									{t('connectChannel.inputChannelNote')}
								</span>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="block text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
									{t('connectChannel.outputChannelLabel')}
								</label>
								<input
									type="text"
									value={outputChannel()}
									onInput={(e) => setOutputChannel(e.currentTarget.value)}
									placeholder="e.g. @my_public_channel"
									class="w-full h-14 bg-[#08090D] border border-white/5 text-white text-[14px] font-bold font-mono rounded-[16px] px-4 focus:outline-none focus:border-[#3390ec]/50 placeholder-white/20 transition-all shadow-inner"
									dir="ltr"
								/>
								<span class="text-[10px] font-medium text-white/40 mt-0.5 block px-1 leading-snug">
									{t('connectChannel.outputChannelNote')}
								</span>
							</div>
						</div>
					</Motion.div>
				</Show>
			</div>

			{/* ═══════ FLOATING SUBMIT BUTTON ═══════ */}
			<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#030303] via-[#030303]/90 to-transparent z-40 pointer-events-none">
				<div class="max-w-md mx-auto pointer-events-auto">
					<button
						onClick={handleSave}
						disabled={
							isSaving() ||
							!projectName().trim() ||
							!inputChannel().trim() ||
							!outputChannel().trim()
						}
						class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest transition-all disabled:opacity-40 disabled:scale-100 flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(51,144,236,0.35)] active:scale-95 border border-white/10"
					>
						<Show
							when={!isSaving()}
							fallback={
								<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
							}
						>
							{t('connectChannel.saveBtn')}
							<span class="material-symbols-outlined text-[22px]">save</span>
						</Show>
					</button>
				</div>
			</div>
		</div>
	);
};
