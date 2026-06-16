import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { showToast } from '@/shared/ui/toast.js';

export const ConnectChannelPage: Component = () => {
	const navigate = useNavigate();
	const [connectMode, setConnectMode] = createSignal<'single' | 'funnel'>('single');
	const [channelInput, setChannelInput] = createSignal('');
	const [inputChannel, setInputChannel] = createSignal('');
	const [outputChannel, setOutputChannel] = createSignal('');
	const [isVerifying, setIsVerifying] = createSignal(false);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => navigate(-1));
		onCleanup(() => off());
	});

	const handleConnect = async () => {
		if (connectMode() === 'single') {
			if (!channelInput().trim()) {
				showToast(
					t('connectChannel.errorEmpty') || 'Channel username or ID cannot be empty',
					'error',
				);
				hapticFeedback.notificationOccurred('error');
				return;
			}

			hapticFeedback.impactOccurred('medium');
			setIsVerifying(true);

			try {
				await channelApi.connectChannel('auto', channelInput().trim());
				showToast(t('connectChannel.success') || 'Channel connected successfully!', 'success');
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
		} else {
			if (!inputChannel().trim() || !outputChannel().trim()) {
				showToast(
					isRtl()
						? 'لطفاً هم کانال ورودی و هم کانال خروجی را مشخص کنید'
						: 'Please specify both input and output channels',
					'error',
				);
				hapticFeedback.notificationOccurred('error');
				return;
			}

			hapticFeedback.impactOccurred('medium');
			setIsVerifying(true);

			try {
				showToast(
					isRtl() ? 'در حال تایید کانال ورودی...' : 'Verifying input channel...',
					'info',
				);
				const inChan = await channelApi.connectChannel('auto', inputChannel().trim());

				showToast(
					isRtl() ? 'در حال تایید کانال خروجی...' : 'Verifying output channel...',
					'info',
				);
				const outChan = await channelApi.connectChannel('auto', outputChannel().trim());

				showToast(
					isRtl() ? 'در حال برقراری قیف انتشار...' : 'Creating publishing funnel...',
					'info',
				);
				await channelApi.createFunnel(outChan.id, inChan.id);

				showToast(
					isRtl() ? 'قیف انتشار دو کاناله با موفقیت متصل شد!' : 'Channel funnel connected successfully!',
					'success',
				);
				hapticFeedback.notificationOccurred('success');
				navigate('/managed-channels', { replace: true });
			} catch (err: any) {
				const errMsg =
					err?.response?.data?.error ||
					err?.response?.data?.message ||
					err?.message ||
					'Failed to connect funnel';
				showToast(errMsg, 'error');
				hapticFeedback.notificationOccurred('error');
			} finally {
				setIsVerifying(false);
			}
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
						{isRtl()
							? 'ربات رسمی ما را به عنوان مدیر (Administrator) با دسترسی ارسال پیام در کانال‌های خود عضو کنید.'
							: 'Add our official bot to your Telegram channel(s) as an administrator with post/edit permissions.'}
					</p>
					<button
						onClick={handleOpenTelegram}
						class="mt-2 w-full bg-[#2a2a2a] hover:bg-[#333333] border border-[#3a3a3c] text-white rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold transition-all text-[14px]"
					>
						<span class="material-symbols-outlined text-[18px]">open_in_new</span>
						{t('connectChannel.openTelegram') || 'Open in Telegram'}
					</button>
				</Motion.div>

				{/* Connection Mode Selector Toggle */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.07 }}
					class="flex bg-[#1c1c1c] p-1 rounded-2xl border border-[#2a2a2a]"
				>
					<button
						onClick={() => setConnectMode('single')}
						class={`flex-1 py-3 text-center text-[12px] font-bold rounded-xl transition-all ${
							connectMode() === 'single'
								? 'bg-[#32ade6] text-black shadow-md'
								: 'text-[#8e8e93] hover:text-white'
						}`}
					>
						{isRtl() ? 'تک کانال معمولی' : 'Single Channel'}
					</button>
					<button
						onClick={() => setConnectMode('funnel')}
						class={`flex-1 py-3 text-center text-[12px] font-bold rounded-xl transition-all ${
							connectMode() === 'funnel'
								? 'bg-[#32ade6] text-black shadow-md'
								: 'text-[#8e8e93] hover:text-white'
						}`}
					>
						{isRtl() ? 'قیف دو کاناله (Funnel)' : 'Channel Funnel'}
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
							{connectMode() === 'single'
								? (t('connectChannel.step2Title') || 'Submit Channel Link')
								: (isRtl() ? 'ثبت اطلاعات قیف کانال' : 'Submit Funnel Channels')}
						</h2>
					</div>

					<Show
						when={connectMode() === 'funnel'}
						fallback={
							<>
								<p class="text-[13px] text-[#8e8e93] leading-relaxed mb-1">
									{t('connectChannel.step2Desc') ||
										'Enter your public channel username (e.g. @my_channel) or private channel invite link to verify.'}
								</p>

								<input
									type="text"
									value={channelInput()}
									onInput={(e) => setChannelInput(e.currentTarget.value)}
									placeholder={t('connectChannel.inputPlaceholder') || 'e.g. @channel_username'}
									class="bg-[#0f1014] border border-[#3a3a3c] text-white text-[15px] rounded-xl px-4 py-3.5 w-full focus:outline-none focus:border-[#32ade6] placeholder-[#5a5a5e] transition-colors"
								/>
							</>
						}
					>
						<p class="text-[13px] text-[#8e8e93] leading-relaxed mb-2">
							{isRtl()
								? 'آدرس کانال ورودی (برای فرستادن پست‌های خام) و کانال خروجی (برای انتشار نسخه نهایی و تایید شده) را وارد کنید.'
								: 'Enter both your Input Channel (where raw posts are dropped) and Output Channel (where reviewed posts are published).'}
						</p>

						<div class="flex flex-col gap-3">
							<div>
								<label class="block text-[11px] uppercase tracking-wider text-[#8e8e93] font-bold mb-1.5 pl-1">
									{isRtl() ? 'کانال ورودی (Input Channel)' : 'Input Channel'}
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
									{isRtl() ? 'کانال خروجی (Output Channel)' : 'Output Channel'}
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
					</Show>

					<button
						onClick={handleConnect}
						disabled={
							isVerifying() ||
							(connectMode() === 'single' ? !channelInput().trim() : (!inputChannel().trim() || !outputChannel().trim()))
						}
						class="mt-3 w-full bg-[#32ade6] text-black disabled:bg-[#32ade6]/40 disabled:text-black/50 rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold transition-all text-[15px]"
					>
						<Show
							when={!isVerifying()}
							fallback={
								<span class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
							}
						>
							{connectMode() === 'single'
								? (t('connectChannel.connectBtn') || 'Verify & Onboard Channel')
								: (isRtl() ? 'تایید و ساخت قیف انتشار' : 'Verify & Create Funnel')}
						</Show>
					</button>
				</Motion.div>
			</div>
		</div>
	);
};
