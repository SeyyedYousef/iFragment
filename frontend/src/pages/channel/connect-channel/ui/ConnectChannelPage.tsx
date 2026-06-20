import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { showToast } from '@/shared/ui/toast.js';

export const ConnectChannelPage: Component = () => {
	const navigate = useNavigate();
	const [inputChannel, setInputChannel] = createSignal('');
	const [outputChannel, setOutputChannel] = createSignal('');
	const [isVerifying, setIsVerifying] = createSignal(false);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => navigate(-1));
		onCleanup(() => off());
	});

	const handleConnect = async () => {
		if (!inputChannel().trim() || !outputChannel().trim()) {
			showToast(
				t('connectChannel.validationError') || 'Please specify both input and output channels',
				'error',
			);
			hapticFeedback.notificationOccurred('error');
			return;
		}

		hapticFeedback.impactOccurred('medium');
		setIsVerifying(true);

		try {
			showToast(t('connectChannel.verifyingInput') || 'Verifying input channel...', 'info');
			const inChan = await channelApi.connectChannel('auto', inputChannel().trim());

			showToast(t('connectChannel.verifyingOutput') || 'Verifying output channel...', 'info');
			const outChan = await channelApi.connectChannel('auto', outputChannel().trim());

			showToast(
				t('connectChannel.creatingConnection') || 'Creating channel connection...',
				'info',
			);
			await channelApi.createFunnel(outChan.id, inChan.id);

			showToast(
				t('connectChannel.success') || 'Channel connected successfully!',
				'success',
			);
			hapticFeedback.notificationOccurred('success');
			navigate('/managed-channels', { replace: true });
		} catch (err: any) {
			const errMsg =
				err?.response?.data?.error ||
				err?.response?.data?.message ||
				err?.message ||
				'Failed to connect channel';
			showToast(errMsg, 'error');
			hapticFeedback.notificationOccurred('error');
		} finally {
			setIsVerifying(false);
		}
	};

	const handleOpenTelegram = () => {
		hapticFeedback.impactOccurred('light');
		openTelegramLink('https://t.me/iFragmentBot?startchannel=true');
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
						{t('connectChannel.title') || 'Connect Channel'}
					</h1>
					<span class="text-[12px] text-on-surface-variant truncate">
						{t('connectChannel.subtitle') || 'Onboard a new Telegram channel'}
					</span>
				</div>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-6">
				{/* Step 1: Add Bot */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.05 }}
					class="bg-[#1c1c1c] rounded-3xl p-5 border border-[#2a2a2a] flex flex-col gap-3"
				>
					<div class="flex items-center gap-3 mb-1">
						<div class="w-8 h-8 rounded-full bg-[#32ade6] text-black font-black flex items-center justify-center text-[15px]">
							1
						</div>
						<h2 class="text-[16px] font-bold text-white">
							{t('connectChannel.step1Title') || 'Add Bot to Channel(s)'}
						</h2>
					</div>
					<p class="text-[13px] text-[#8e8e93] leading-relaxed">
						{t('connectChannel.step1Desc') || 'Add our official bot as an Administrator with post sending rights to your channels.'}
					</p>
					<button
						onClick={handleOpenTelegram}
						class="mt-2 w-full bg-[#2a2a2a] hover:bg-[#333333] border border-[#3a3a3c] text-white rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold transition-all text-[14px]"
					>
						<span class="material-symbols-outlined text-[18px]">open_in_new</span>
						{t('connectChannel.openTelegram') || 'Open in Telegram'}
					</button>
				</Motion.div>

				{/* Step 2: Enter Channel & Connect */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.09 }}
					class="bg-[#1c1c1c] rounded-3xl p-5 border border-[#2a2a2a] flex flex-col gap-3"
				>
					<div class="flex items-center gap-3 mb-1">
						<div class="w-8 h-8 rounded-full bg-[#32ade6] text-black font-black flex items-center justify-center text-[15px]">
							2
						</div>
						<h2 class="text-[16px] font-bold text-white">
							{t('connectChannel.step2Title') || 'Submit Channel / Funnel Information'}
						</h2>
					</div>
						<p class="text-[13px] text-[#8e8e93] leading-relaxed mb-3">
							{t('connectChannel.step2Desc') || 'Enter the input channel address (for sending raw posts) and output channel address (for publishing final approved posts).'}
						</p>

						<div class="flex flex-col gap-3">
							<div>
								<label class="block text-[11px] uppercase tracking-wider text-[#8e8e93] font-bold mb-1.5 pl-1">
									{t('connectChannel.inputChannelLabel') || 'Input Channel'}
								</label>
								<input
									type="text"
									value={inputChannel()}
									onInput={(e) => setInputChannel(e.currentTarget.value)}
									placeholder="e.g. @my_raw_posts_channel"
									class="bg-[#0f1014] border border-[#3a3a3c] text-white text-[15px] rounded-xl px-4 py-3.5 w-full focus:outline-none focus:border-[#32ade6] placeholder-[#5a5a5e] transition-colors"
								/>
							</div>

							<div>
								<label class="block text-[11px] uppercase tracking-wider text-[#8e8e93] font-bold mb-1.5 pl-1">
									{t('connectChannel.outputChannelLabel') || 'Output Channel'}
								</label>
								<input
									type="text"
									value={outputChannel()}
									onInput={(e) => setOutputChannel(e.currentTarget.value)}
									placeholder="e.g. @my_public_channel"
									class="bg-[#0f1014] border border-[#3a3a3c] text-white text-[15px] rounded-xl px-4 py-3.5 w-full focus:outline-none focus:border-[#32ade6] placeholder-[#5a5a5e] transition-colors"
								/>
							</div>
						</div>

					<button
						onClick={handleConnect}
						disabled={isVerifying() || !inputChannel().trim() || !outputChannel().trim()}
						class="mt-3 w-full bg-[#32ade6] text-black disabled:bg-[#32ade6]/40 disabled:text-black/50 rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold transition-all text-[15px]"
					>
						<Show
							when={!isVerifying()}
							fallback={
								<span class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
							}
						>
							{t('connectChannel.verifyConnectBtn') || 'Verify & Connect Channel'}
						</Show>
					</button>
				</Motion.div>
			</div>
		</div>
	);
};
