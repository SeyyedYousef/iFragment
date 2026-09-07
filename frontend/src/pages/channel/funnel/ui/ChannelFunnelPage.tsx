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
import { ChannelContextBar, ChannelHamburgerMenu, channelApi } from '@/entities/channel/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { FragmentPulse, showToast } from '@/shared/ui/index.js';

export const ChannelFunnelPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [selectedInputChannel, setSelectedInputChannel] = createSignal<string>('');
	const [inputIdentifier, setInputIdentifier] = createSignal<string>('');
	const [isSubmitting, setIsSubmitting] = createSignal(false);

	const [channel] = createResource(
		() => params.id,
		(id) => channelApi.getChannel(id),
	);
	const [funnel, { mutate: mutateFunnel }] = createResource(
		() => params.id,
		(id) => channelApi.getFunnel(id),
	);
	const [userChannels] = createResource(
		() => channel()?.bot_id,
		(botId) => (botId ? channelApi.getUserChannels(botId) : Promise.resolve([])),
	);

	onMount(() => {
		// Funnel has been unified into ProjectsPage
		navigate(`/channel/${params.id}/projects`, { replace: true });
	});

	const handleCreateFunnel = async () => {
		if (!selectedInputChannel()) return;
		setIsSubmitting(true);
		haptic.impact('medium');
		try {
			await channelApi.createFunnel(params.id, selectedInputChannel(), inputIdentifier());
			haptic.notify('success');
			showToast(t('channelFunnel.enabled'), 'success');
			mutateFunnel({
				input_chat_id: Number(selectedInputChannel()),
				output_chat_id: channel()?.chat_id,
				is_active: true,
			});
		} catch (_error) {
			haptic.notify('error');
			showToast(t('channelFunnel.enableError'), 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteFunnel = async () => {
		setIsSubmitting(true);
		haptic.impact('medium');
		try {
			await channelApi.deleteFunnel(params.id);
			haptic.notify('success');
			showToast(t('channelFunnel.disabled'), 'success');
			mutateFunnel(null);
		} catch (_error) {
			haptic.notify('error');
			showToast(t('channelFunnel.disableError'), 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#06b6d4]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3 overflow-hidden flex-1">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/channel/${params.id}`);
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
							{t('channelFunnel.title')}
						</h1>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider truncate mt-0.5">
							{t('channelFunnel.subtitle')}
						</span>
					</div>
				</div>

				<button
					type="button"
					onClick={() => {
						haptic.impact('light');
						setIsMenuOpen(true);
					}}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 shadow-sm text-white/80"
					aria-label={t('common.toggle')}
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<div class="px-5 pt-5 flex flex-col gap-6 max-w-md mx-auto relative z-10 w-full">
				<ChannelContextBar channelId={params.id} />

				{/* ═══════ VISUAL FUNNEL DIAGRAM ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[28px] p-5 flex flex-col gap-5 shadow-sm relative overflow-hidden">
					<div class="absolute -right-10 -bottom-10 w-32 h-32 bg-[#06b6d4]/10 rounded-full blur-3xl pointer-events-none" />

					<div class="flex items-center justify-between border-b border-white/5 pb-3 relative z-10">
						<div class="flex items-center gap-2.5">
							<FragmentPulse state={funnel() ? 'healthy' : 'active'} />
							<h2 class="text-[11px] font-black uppercase text-white/50 tracking-widest">
								{t('channelFunnel.autoRouting')}
							</h2>
						</div>
						<span
							class={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[8px] shadow-sm border ${funnel() ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : 'bg-white/5 text-white/40 border-white/10'}`}
						>
							{funnel() ? t('channelFunnel.activeStatus') : t('channelFunnel.inactiveStatus')}
						</span>
					</div>

					<div class="grid grid-cols-3 gap-2 text-center pt-1 relative z-10">
						{/* Stage 1: Input */}
						<div class="bg-[#08090D] border border-white/5 rounded-[20px] p-3.5 flex flex-col items-center gap-1.5 shadow-inner relative group overflow-hidden">
							<div class="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-colors pointer-events-none" />
							<div class="w-8 h-8 rounded-[10px] bg-white/5 text-[14px] font-black flex items-center justify-center text-white/60 mb-1 border border-white/10 shadow-sm">
								1
							</div>
							<span class="text-[11px] font-black text-white/80 uppercase tracking-widest">
								{t('channelFunnel.inputRaw')}
							</span>
							<span class="text-[10px] text-white/40 truncate w-full px-1 font-mono font-bold leading-snug">
								{funnel()?.input_title || t('channelFunnel.inputDrafts')}
							</span>
						</div>

						{/* Stage 2: Processing (Highlight) */}
						<div class="bg-[#06b6d4]/10 border border-[#06b6d4]/30 rounded-[20px] p-3.5 flex flex-col items-center gap-1.5 shadow-[inset_0_0_15px_rgba(6,182,212,0.1)] relative overflow-hidden">
							<div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
							<div class="w-8 h-8 rounded-[10px] bg-[#06b6d4]/20 text-[#06b6d4] text-[14px] font-black flex items-center justify-center mb-1 border border-[#06b6d4]/40 shadow-sm relative z-10">
								2
							</div>
							<span class="text-[11px] font-black text-[#06b6d4] uppercase tracking-widest relative z-10">
								{t('channelFunnel.processAi')}
							</span>
							<span class="text-[10px] text-[#06b6d4]/70 font-bold w-full relative z-10">
								{t('channelFunnel.processReview')}
							</span>
						</div>

						{/* Stage 3: Output */}
						<div class="bg-[#10b981]/10 border border-[#10b981]/20 rounded-[20px] p-3.5 flex flex-col items-center gap-1.5 shadow-inner relative group overflow-hidden">
							<div class="absolute inset-0 bg-[#10b981]/5 opacity-0 group-hover:opacity-100 transition-colors pointer-events-none" />
							<div class="w-8 h-8 rounded-[10px] bg-[#10b981]/20 text-[#10b981] text-[14px] font-black flex items-center justify-center mb-1 border border-[#10b981]/30 shadow-sm relative z-10">
								3
							</div>
							<span class="text-[11px] font-black text-[#10b981] uppercase tracking-widest relative z-10">
								{t('channelFunnel.outputFinal')}
							</span>
							<span class="text-[10px] text-[#10b981]/60 truncate w-full px-1 font-mono font-bold leading-snug relative z-10">
								{channel()?.chat_title || t('channelFunnel.outputPublic')}
							</span>
						</div>
					</div>
				</div>

				<Motion.div
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.05 }}
				>
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[28px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
						<Show
							when={!funnel()}
							fallback={
								<div class="flex flex-col gap-5 relative z-10">
									<div class="bg-[#10b981]/10 border border-[#10b981]/20 rounded-[20px] p-5 flex flex-col gap-2 shadow-inner">
										<div class="flex items-center gap-2 mb-1">
											<div class="w-8 h-8 rounded-[10px] bg-[#10b981]/20 flex items-center justify-center border border-[#10b981]/30 shrink-0">
												<span class="material-symbols-outlined text-[16px] text-[#10b981]">
													check_circle
												</span>
											</div>
											<span class="text-[14px] font-black text-[#10b981] tracking-tight">
												{t('channelFunnel.activeDesc')}
											</span>
										</div>
										<span class="text-[12px] text-white/70 leading-relaxed font-medium pl-10">
											{t('channelFunnel.publishingFunnelDesc')}
										</span>
									</div>
									<button
										type="button"
										onClick={handleDeleteFunnel}
										disabled={isSubmitting()}
										class="w-full h-14 bg-transparent border border-[#ff4a4a]/30 text-[#ff4a4a] hover:bg-[#ff4a4a]/10 hover:border-[#ff4a4a]/50 font-black uppercase tracking-widest rounded-[16px] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-[13px] shadow-sm"
									>
										<Show
											when={isSubmitting()}
											fallback={
												<span class="material-symbols-outlined text-[20px]">delete_forever</span>
											}
										>
											<span class="material-symbols-outlined text-[20px] animate-spin">sync</span>
										</Show>
										{t('channelFunnel.disablePathBtn')}
									</button>
								</div>
							}
						>
							<div class="flex flex-col gap-4 relative z-10">
								{/* ═══════ INPUT CONFIGURATION ═══════ */}
								<div class="flex flex-col gap-1.5">
									<div class="text-[11px] font-black text-white/50 uppercase tracking-widest px-1 flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[16px] text-white/40">input</span>
										{t('channelFunnel.selectInputChannel')}
									</div>
									<div class="relative">
										<select
											class="w-full h-14 bg-[#08090D] border border-white/5 rounded-[16px] px-4 text-[13px] font-bold text-white appearance-none outline-none focus:border-[#06b6d4]/50 shadow-inner transition-colors"
											value={selectedInputChannel()}
											onChange={(e) => setSelectedInputChannel(e.currentTarget.value)}
										>
											<option value="" disabled class="text-white/40">
												{t('channelFunnel.noChannelSelected')}
											</option>
											<For
												each={userChannels()?.filter((c: any) => c.chat_id !== channel()?.chat_id)}
											>
												{(c) => <option value={c.chat_id}>{c.title}</option>}
											</For>
										</select>
										<span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none text-[20px]">
											expand_more
										</span>
									</div>
								</div>

								<div class="flex flex-col gap-1.5 mt-2">
									<div class="text-[11px] font-black text-white/50 uppercase tracking-widest px-1 flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[16px] text-white/40">
											alternate_email
										</span>
										{t('channelFunnel.inputChannelUsername')}
									</div>
									<input
										type="text"
										class="w-full h-14 bg-[#08090D] border border-white/5 rounded-[16px] px-4 text-[14px] font-bold font-mono text-white outline-none focus:border-[#06b6d4]/50 shadow-inner placeholder-white/20 transition-colors"
										value={inputIdentifier()}
										onInput={(e) => setInputIdentifier(e.currentTarget.value)}
										placeholder="@channel_username"
										dir="ltr"
									/>
								</div>

								<button
									type="button"
									onClick={handleCreateFunnel}
									disabled={!selectedInputChannel() || isSubmitting()}
									class="w-full h-14 mt-4 bg-gradient-to-r from-[#06b6d4] to-[#0284c7] hover:from-[#0284c7] hover:to-[#06b6d4] text-white font-black uppercase tracking-widest rounded-[16px] active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 flex items-center justify-center gap-2 text-[13px] shadow-[0_10px_25px_rgba(6,182,212,0.3)] border border-white/10"
								>
									<Show
										when={isSubmitting()}
										fallback={<span class="material-symbols-outlined text-[20px]">play_arrow</span>}
									>
										<span class="material-symbols-outlined text-[20px] animate-spin">sync</span>
									</Show>
									{t('channelFunnel.activatePathBtn')}
								</button>
							</div>
						</Show>
					</div>
				</Motion.div>
			</div>

			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="funnel"
			/>
		</div>
	);
};
