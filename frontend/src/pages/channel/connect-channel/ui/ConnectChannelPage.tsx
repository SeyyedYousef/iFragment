import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { backButton, openTelegramLink } from '@tma.js/sdk-solid';
import { type Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/entities/channel/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';

export const ConnectChannelPage: Component = () => {
	const navigate = useNavigate();
	const [channelUsername, setChannelUsername] = createSignal('');
	const [isConnecting, setIsConnecting] = createSignal(false);

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

	const handleConnect = async () => {
		const rawInput = channelUsername().trim();
		if (!rawInput) {
			showToast(
				t('connectChannel.validationError') || 'Please enter channel username or link',
				'error',
			);
			haptic.notify('error');
			return;
		}

		haptic.impact('medium');
		setIsConnecting(true);

		try {
			showToast(
				t('connectChannel.verifyingInput') ||
					'Verifying bot administrator permissions in channel...',
				'info',
			);
			const connectedChan = await channelApi.connectChannel('auto', rawInput);

			haptic.notify('success');
			showToast(t('connectChannel.success') || 'Channel successfully connected!', 'success');
			navigate(`/channel/${connectedChan.id}/dashboard`, { replace: true });
		} catch (err: any) {
			const errMsg =
				err?.response?.data?.error ||
				err?.response?.data?.message ||
				err?.message ||
				'Failed to connect channel. Ensure the bot is added as administrator.';
			showToast(errMsg, 'error');
			haptic.notify('error');
		} finally {
			setIsConnecting(false);
		}
	};

	const handleOpenTelegram = () => {
		haptic.impact('light');
		openTelegramLink('https://t.me/iFragmentBot?startchannel=true');
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-32 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* Sticky Header */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center gap-3.5 shadow-sm">
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
					<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
						{t('connectChannel.title') || 'Connect Channel'}
					</h1>
					<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider truncate mt-0.5">
						{t('connectChannel.subtitle') || 'Add bot as administrator to manage automation'}
					</span>
				</div>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
				{/* 72h Free Trial & Project Model Banner */}
				<div class="p-4 rounded-2xl bg-gradient-to-r from-blue-900/20 via-neutral-900 to-indigo-900/20 border border-blue-500/20 flex items-start gap-3">
					<div class="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 text-base shrink-0 mt-0.5">
						💎
					</div>
					<div class="text-xs text-neutral-300 space-y-1">
						<div class="font-semibold text-blue-300">
							{t('connectChannel.trialBannerTitle') || 'Free Channel Management'}
						</div>
						<p class="text-neutral-400 leading-relaxed">
							{t('connectChannel.trialBannerDesc') ||
								'Connecting channels is completely free. You can configure AI posting, dynamic bios, and interactive inline buttons directly.'}
						</p>
					</div>
				</div>

				{/* STEP 1: ADD BOT AS ADMIN */}
				<Motion.div
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.05 }}
					class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-5 border border-white/5 flex flex-col gap-4 shadow-sm relative overflow-hidden"
				>
					<div class="flex items-center gap-3.5 relative z-10">
						<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/15 text-[#3390ec] font-black flex items-center justify-center text-[16px] border border-[#3390ec]/30 shadow-inner shrink-0">
							1
						</div>
						<h2 class="text-[16px] font-black text-white tracking-tight">
							{t('connectChannel.step1Title') || 'Add Bot to Channel'}
						</h2>
					</div>

					<p class="text-[12px] text-white/50 font-medium leading-relaxed relative z-10">
						{t('connectChannel.step1Desc') ||
							'Add @iFragmentBot as an administrator with Post Messages & Edit Messages permissions.'}
					</p>

					<button
						type="button"
						onClick={handleOpenTelegram}
						class="w-full h-13 py-3 bg-gradient-to-r from-[#0098EA] to-[#0081C8] text-white rounded-[16px] flex items-center justify-center gap-2 font-black text-[13px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-[#0098EA]/20 relative z-10"
					>
						<span>🚀 {t('connectChannel.openTelegram') || 'Add Bot to Channel in Telegram'}</span>
					</button>
				</Motion.div>

				{/* STEP 2: ENTER CHANNEL USERNAME */}
				<Motion.div
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-5 border border-white/5 flex flex-col gap-4 shadow-sm relative overflow-hidden"
				>
					<div class="flex items-center gap-3.5 relative z-10">
						<div class="w-10 h-10 rounded-[12px] bg-emerald-500/15 text-emerald-400 font-black flex items-center justify-center text-[16px] border border-emerald-500/30 shadow-inner shrink-0">
							2
						</div>
						<h2 class="text-[16px] font-black text-white tracking-tight">
							{t('connectChannel.step2Title') || 'Confirm Channel'}
						</h2>
					</div>

					<p class="text-[12px] text-white/50 font-medium leading-relaxed relative z-10">
						{t('connectChannel.step2Desc') || 'Enter your public channel username or t.me link.'}
					</p>

					<div class="relative z-10">
						<input
							type="text"
							value={channelUsername()}
							onInput={(e) => setChannelUsername(e.currentTarget.value)}
							placeholder="e.g. @MyTelegramChannel or t.me/MyTelegramChannel"
							class="w-full h-14 bg-[#08090D] border border-white/5 text-white text-[14px] font-bold rounded-[16px] px-4 focus:outline-none focus:border-[#3390ec]/50 placeholder-white/20 transition-all shadow-inner font-mono"
							dir="ltr"
						/>
					</div>

					<button
						type="button"
						onClick={handleConnect}
						disabled={isConnecting() || !channelUsername().trim()}
						class="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white rounded-[16px] flex items-center justify-center gap-2 font-black text-[13px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:scale-100"
					>
						<Show
							when={!isConnecting()}
							fallback={
								<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
							}
						>
							<span>✅ {t('connectChannel.submitBtn') || 'Verify & Connect Channel'}</span>
						</Show>
					</button>
				</Motion.div>
			</div>
		</div>
	);
};
