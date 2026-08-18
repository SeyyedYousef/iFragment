import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { backButton, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/entities/channel/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { showToast } from '@/shared/ui/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export const ConnectChannelPage: Component = () => {
	const navigate = useNavigate();
	const [projectName, setProjectName] = createSignal('');
	const [inputChannel, setInputChannel] = createSignal('');
	const [outputChannel, setOutputChannel] = createSignal('');
	const [isVerifying, setIsVerifying] = createSignal(false);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			haptic.impact('light');
			navigate(-1);
		});
		onCleanup(() => {
			off();
			backButton.hide();
		});
	});

	const handleConnect = async () => {
		if (!projectName().trim() || !inputChannel().trim() || !outputChannel().trim()) {
			showToast(t('connectChannel.validationError'), 'error');
			haptic.notify('error');
			return;
		}

		haptic.impact('medium');
		setIsVerifying(true);

		try {
			showToast(t('connectChannel.verifyingInput'), 'info');
			const inChan = await channelApi.connectChannel('auto', inputChannel().trim());

			showToast(t('connectChannel.verifyingOutput'), 'info');
			const outChan = await channelApi.connectChannel('auto', outputChannel().trim());

			showToast(t('connectChannel.creatingConnection'), 'info');
			await channelApi.createFunnel(outChan.id, inChan.id, projectName().trim());

			if (inChan.subscription_status === 'expired' || outChan.subscription_status === 'expired') {
				showToast(t('connectChannel.trialLimitReached'), 'error');
			} else {
				showToast(t('connectChannel.success'), 'success');
			}

			haptic.notify('success');
			navigate('/managed-channels', { replace: true });
		} catch (err: any) {
			const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to connect channel';
			showToast(errMsg, 'error');
			haptic.notify('error');
		} finally {
			setIsVerifying(false);
		}
	};

	const handleOpenTelegram = () => {
		haptic.impact('light');
		openTelegramLink('https://t.me/iFragmentBot?startchannel=true');
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-32 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center gap-3.5 shadow-sm">
				<button
					onClick={() => { haptic.impact('light'); navigate(-1); }}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
					aria-label={t('common.back')}
				>
					<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
				</button>
				<div class="flex flex-col overflow-hidden">
					<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
						{t('connectChannel.title')}
					</h1>
					<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider truncate mt-0.5">
						{t('connectChannel.subtitle')}
					</span>
				</div>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
				
				{/* ═══════ STEP 1: PROJECT NAME (Blue Theme) ═══════ */}
				<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-5 border border-white/5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
					<div class="absolute -right-6 -top-6 w-24 h-24 bg-[#3390ec]/10 blur-2xl rounded-full pointer-events-none" />
					
					<div class="flex items-center gap-3.5 relative z-10">
						<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/15 text-[#3390ec] font-black flex items-center justify-center text-[16px] border border-[#3390ec]/30 shadow-inner shrink-0">1</div>
						<h2 class="text-[16px] font-black text-white tracking-tight">
							{t('connectChannel.step0Title')}
						</h2>
					</div>
					
					<p class="text-[12px] text-white/50 font-medium leading-relaxed relative z-10">
						{t('connectChannel.step0Desc')}
					</p>
					
					<div class="relative z-10">
						<input
							type="text" value={projectName()} onInput={(e) => setProjectName(e.currentTarget.value)}
							placeholder={t('connectChannel.projectNameLabel')}
							class="w-full h-14 bg-[#08090D] border border-white/5 text-white text-[14px] font-bold rounded-[16px] px-4 focus:outline-none focus:border-[#3390ec]/50 placeholder-white/20 transition-all shadow-inner"
						/>
					</div>
				</Motion.div>

				{/* ═══════ STEP 2: ADD BOT (Amber Theme) ═══════ */}
				<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-5 border border-white/5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
					<div class="absolute -left-6 -top-6 w-24 h-24 bg-amber-400/10 blur-2xl rounded-full pointer-events-none" />
					
					<div class="flex items-center gap-3.5 relative z-10">
						<div class="w-10 h-10 rounded-[12px] bg-amber-400/15 text-amber-400 font-black flex items-center justify-center text-[16px] border border-amber-400/30 shadow-inner shrink-0">2</div>
						<h2 class="text-[16px] font-black text-white tracking-tight">
							{t('connectChannel.step1Title')}
						</h2>
					</div>
					
					<p class="text-[12px] text-white/50 font-medium leading-relaxed relative z-10">
						{t('connectChannel.step1Desc')}
					</p>
					
					<button
						onClick={handleOpenTelegram}
						class="mt-1 w-full h-14 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-[16px] flex items-center justify-center gap-2 font-black text-[13px] uppercase tracking-widest transition-all active:scale-95 shadow-sm relative z-10"
					>
						<span class="material-symbols-outlined text-[20px]">open_in_new</span>
						{t('connectChannel.openTelegram')}
					</button>
				</Motion.div>

				{/* ═══════ STEP 3: CHANNELS INFO (Green Theme) ═══════ */}
				<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-5 border border-white/5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
					<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-[#10b981]/10 blur-2xl rounded-full pointer-events-none" />
					
					<div class="flex items-center gap-3.5 relative z-10">
						<div class="w-10 h-10 rounded-[12px] bg-[#10b981]/15 text-[#10b981] font-black flex items-center justify-center text-[16px] border border-[#10b981]/30 shadow-inner shrink-0">3</div>
						<h2 class="text-[16px] font-black text-white tracking-tight">
							{t('connectChannel.step2Title')}
						</h2>
					</div>
					
					<p class="text-[12px] text-white/50 font-medium leading-relaxed mb-1 relative z-10">
						{t('connectChannel.step2Desc')}
					</p>

					<div class="flex flex-col gap-4 relative z-10">
						<div class="flex flex-col gap-1.5">
							<label class="block text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
								{t('connectChannel.inputChannelLabel')}
							</label>
							<input
								type="text" value={inputChannel()} onInput={(e) => setInputChannel(e.currentTarget.value)}
								placeholder="e.g. @my_raw_posts_channel"
								class="w-full h-14 bg-[#08090D] border border-white/5 text-white text-[14px] font-bold font-mono rounded-[16px] px-4 focus:outline-none focus:border-[#10b981]/50 placeholder-white/20 transition-all shadow-inner"
								dir="ltr"
							/>
						</div>

						<div class="flex flex-col gap-1.5">
							<label class="block text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
								{t('connectChannel.outputChannelLabel')}
							</label>
							<input
								type="text" value={outputChannel()} onInput={(e) => setOutputChannel(e.currentTarget.value)}
								placeholder="e.g. @my_public_channel"
								class="w-full h-14 bg-[#08090D] border border-white/5 text-white text-[14px] font-bold font-mono rounded-[16px] px-4 focus:outline-none focus:border-[#10b981]/50 placeholder-white/20 transition-all shadow-inner"
								dir="ltr"
							/>
						</div>
					</div>
				</Motion.div>
			</div>

			{/* ═══════ FLOATING SUBMIT BUTTON ═══════ */}
			<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#030303] via-[#030303]/90 to-transparent z-40 pointer-events-none">
				<div class="max-w-md mx-auto pointer-events-auto">
					<button
						onClick={handleConnect}
						disabled={isVerifying() || !projectName().trim() || !inputChannel().trim() || !outputChannel().trim()}
						class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest transition-all disabled:opacity-40 disabled:scale-100 flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(51,144,236,0.35)] active:scale-95 border border-white/10"
					>
						<Show when={!isVerifying()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
							{t('connectChannel.verifyConnectBtn')}
							<span class="material-symbols-outlined text-[22px]">rocket_launch</span>
						</Show>
					</button>
				</div>
			</div>
		</div>
	);
};
