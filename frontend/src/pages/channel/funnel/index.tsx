import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl } from '@/shared/i18n/index.js';
import { ChannelContextBar } from '@/shared/ui/ChannelContextBar.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { showToast } from '@/shared/ui/toast.js';

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
		backButton.show();
		const off = backButton.onClick(() => navigate(`/channel/${params.id}`));
		onCleanup(() => off());
	});

	const handleCreateFunnel = async () => {
		if (!selectedInputChannel()) return;
		setIsSubmitting(true);
		hapticFeedback.impactOccurred('medium');
		try {
			await channelApi.createFunnel(params.id, selectedInputChannel(), inputIdentifier());
			hapticFeedback.notificationOccurred('success');
			showToast(isRtl() ? 'قیف فعال شد' : 'Funnel enabled', 'success');
			mutateFunnel({
				input_chat_id: Number(selectedInputChannel()),
				output_chat_id: channel()?.chat_id,
				is_active: true,
			});
		} catch (error) {
			hapticFeedback.notificationOccurred('error');
			showToast(isRtl() ? 'خطا در فعال‌سازی قیف' : 'Failed to enable funnel', 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteFunnel = async () => {
		setIsSubmitting(true);
		hapticFeedback.impactOccurred('medium');
		try {
			await channelApi.deleteFunnel(params.id);
			hapticFeedback.notificationOccurred('success');
			showToast(isRtl() ? 'قیف غیرفعال شد' : 'Funnel disabled', 'success');
			mutateFunnel(null);
		} catch (error) {
			hapticFeedback.notificationOccurred('error');
			showToast(isRtl() ? 'خطا در غیرفعال‌سازی قیف' : 'Failed to disable funnel', 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#0f1014] pb-24 relative overflow-x-hidden text-white">
			{/* Header */}
			<div class="px-5 pt-6 pb-4 flex items-center justify-between sticky top-0 bg-[#0f1014] z-30 border-b border-[#1c1c1c]">
				<div class="flex items-center gap-3">
					<button
						onClick={() => {
							hapticFeedback.impactOccurred('light');
							navigate(`/channel/${params.id}`);
						}}
						class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
					>
						<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col">
						<h1 class="text-[16px] font-bold">{isRtl() ? 'قیف / تأیید پست‌ها' : 'Funnel / Approvals'}</h1>
						<span class="text-[11px] text-[#8e8e93]">{isRtl() ? 'بررسی پست‌ها قبل از انتشار' : 'Review posts before publishing'}</span>
					</div>
				</div>
				<button
					onClick={() => {
						hapticFeedback.impactOccurred('light');
						setIsMenuOpen(true);
					}}
					class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-95 transition-all"
				>
					<span class="material-symbols-outlined">menu</span>
				</button>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-6">
				<ChannelContextBar channelId={params.id} />

				<Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
					<div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl p-5 flex flex-col gap-4">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-full bg-[#32ade6]/10 flex items-center justify-center text-[#32ade6] shrink-0">
								<span class="material-symbols-outlined text-[20px]">filter_alt</span>
							</div>
							<div class="flex flex-col">
							<h2 class="text-[15px] font-bold text-white">{isRtl() ? 'قیف انتشار' : 'Publishing Funnel'}</h2>
								<span class="text-[12px] text-[#8e8e93]">
									{isRtl() ? 'پست‌های خام را از کانال مخفی به پنل بررسی شما هدایت کنید.' : 'Route raw posts from a hidden channel to your review panel.'}
								</span>
							</div>
						</div>

						<Show
							when={!funnel()}
							fallback={
								<div class="flex flex-col gap-4 mt-2">
									<div class="bg-[#34c759]/10 border border-[#34c759]/30 rounded-xl p-3 flex flex-col gap-1">
										<span class="text-[13px] font-bold text-[#34c759]">{isRtl() ? 'فعال' : 'Active'}</span>
										<span class="text-[11px] text-white/70">
											{isRtl() ? 'پست‌های ارسالی به کانال ورودی شما رهگیری و برای تأیید به پیام خصوصی شما ارسال می‌شوند.' : 'Posts sent to your input channel are being intercepted and routed to your DM for approval.'}
										</span>
									</div>
									<button
										onClick={handleDeleteFunnel}
										disabled={isSubmitting()}
										class="w-full h-12 bg-[#ff3b30]/10 text-[#ff3b30] font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
									>
										<Show when={isSubmitting()} fallback={<span class="material-symbols-outlined">delete</span>}>
											<span class="material-symbols-outlined animate-spin">refresh</span>
										</Show>
										{isRtl() ? 'غیرفعال کردن قیف' : 'Disable Funnel'}
									</button>
								</div>
							}
						>
							<div class="flex flex-col gap-3 mt-2">
								<label class="text-[12px] font-bold text-[#8e8e93]">{isRtl() ? 'انتخاب کانال ورودی (پست‌های خام)' : 'Select Input Channel (Raw Posts)'}</label>
								<div class="relative">
									<select
										class="w-full h-12 bg-[#0f1014] border border-[#2a2a2a] rounded-xl px-4 text-[14px] text-white appearance-none outline-none focus:border-[#32ade6] transition-colors"
										value={selectedInputChannel()}
										onChange={(e) => setSelectedInputChannel(e.currentTarget.value)}
									>
										<option value="" disabled>{isRtl() ? '-- انتخاب کانال --' : '-- Select Channel --'}</option>
										<For each={userChannels()?.filter((c: any) => c.chat_id !== channel()?.chat_id)}>
											{(c) => <option value={c.chat_id}>{c.title}</option>}
										</For>
									</select>
									<span class="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#8e8e93] pointer-events-none">
										expand_more
									</span>
								</div>

								<label class="text-[12px] font-bold text-[#8e8e93] mt-2">{isRtl() ? 'آیدی کانال ورودی (برای جوین خودکار ربات)' : 'Input Channel Username (for Auto-Join)'}</label>
								<input
									type="text"
									class="w-full h-12 bg-[#0f1014] border border-[#2a2a2a] rounded-xl px-4 text-[14px] text-white outline-none focus:border-[#32ade6] transition-colors"
									value={inputIdentifier()}
									onInput={(e) => setInputIdentifier(e.currentTarget.value)}
									placeholder="@channel_username"
									dir="ltr"
								/>

								<button
									onClick={handleCreateFunnel}
									disabled={!selectedInputChannel() || isSubmitting()}
									class="w-full h-12 mt-2 bg-[#32ade6] text-black font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
								>
									<Show when={isSubmitting()} fallback={<span class="material-symbols-outlined">add</span>}>
										<span class="material-symbols-outlined animate-spin">refresh</span>
									</Show>
									{isRtl() ? 'فعال کردن قیف' : 'Enable Funnel'}
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
