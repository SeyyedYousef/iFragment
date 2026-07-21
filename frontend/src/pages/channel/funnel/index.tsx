import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { t } from '@/shared/i18n/index.js';
import { ChannelContextBar } from '@/shared/ui/ChannelContextBar.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { FragmentPulse } from '@/shared/ui/FragmentPulse.js';
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
			showToast(t('channelFunnel.enabled') || 'قیف انتشار با موفقیت فعال شد', 'success');
			mutateFunnel({
				input_chat_id: Number(selectedInputChannel()),
				output_chat_id: channel()?.chat_id,
				is_active: true,
			});
		} catch (_error) {
			hapticFeedback.notificationOccurred('error');
			showToast(t('channelFunnel.enableError') || 'خطا در فعال‌سازی قیف انتشار', 'error');
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
			showToast(t('channelFunnel.disabled') || 'قیف انتشار غیرفعال گردید', 'success');
			mutateFunnel(null);
		} catch (_error) {
			hapticFeedback.notificationOccurred('error');
			showToast(t('channelFunnel.disableError') || 'خطا در غیرفعال‌سازی قیف', 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div class="theme-control min-h-screen bg-[#08090D] pb-24 relative overflow-x-hidden text-white select-none">
			{/* Header */}
			<div class="px-5 pt-5 pb-4 flex items-center justify-between sticky top-0 bg-[#0F1117]/90 backdrop-blur-md z-30 border-b border-white/10">
				<div class="flex items-center gap-3">
					<button
						onClick={() => {
							hapticFeedback.impactOccurred('light');
							navigate(`/channel/${params.id}`);
						}}
						class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0"
						aria-label="بازگشت"
					>
						<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col">
						<h1 class="text-base font-black">
							{t('channelFunnel.title') || 'قیف انتشار و تأیید محتوا'}
						</h1>
						<span class="text-xs text-white/50 font-bold">
							{t('channelFunnel.subtitle') || 'مسیر هوشمند بررسی و انتشار پست‌ها'}
						</span>
					</div>
				</div>
				<button
					onClick={() => {
						hapticFeedback.impactOccurred('light');
						setIsMenuOpen(true);
					}}
					class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0"
					aria-label="منوی کانال"
				>
					<span class="material-symbols-outlined">menu</span>
				</button>
			</div>

			<div class="px-5 pt-5 flex flex-col gap-6">
				<ChannelContextBar channelId={params.id} />

				{/* Visual Stage Diagram */}
				<div class="bg-gradient-to-b from-[#151822] to-[#0F1117] border border-white/10 rounded-[24px] p-5 space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<FragmentPulse state={funnel() ? 'healthy' : 'active'} />
							<h2 class="text-xs font-black uppercase text-white tracking-wider">
								دیگرام سه مرحله‌ای جریان پست‌ها
							</h2>
						</div>
						<span
							class={`text-[10px] font-bold px-2 py-0.5 rounded-md ${funnel() ? 'bg-[#10b981]/15 text-[#10b981]' : 'bg-white/10 text-white/50'}`}
						>
							{funnel() ? 'فعال' : 'غیرفعال'}
						</span>
					</div>

					<div class="grid grid-cols-3 gap-2 text-center pt-2">
						{/* Stage 1 */}
						<div class="bg-black/40 border border-white/5 rounded-2xl p-3 space-y-1">
							<span class="w-6 h-6 rounded-full bg-white/10 text-[10px] font-black inline-flex items-center justify-center text-white mb-1">
								۱
							</span>
							<div class="text-xs font-black text-white">ورودی اولیه</div>
							<div class="text-[10px] text-white/40 truncate font-mono">
								{funnel()?.input_title || 'پیش‌نویس خام'}
							</div>
						</div>

						{/* Stage 2 */}
						<div class="bg-black/40 border border-[#06b6d4]/30 rounded-2xl p-3 space-y-1 relative">
							<span class="w-6 h-6 rounded-full bg-[#06b6d4]/20 text-[#06b6d4] text-[10px] font-black inline-flex items-center justify-center mb-1">
								۲
							</span>
							<div class="text-xs font-black text-[#06b6d4]">پنل بررسی</div>
							<div class="text-[10px] text-white/50 font-bold">بازنویسی / AI</div>
						</div>

						{/* Stage 3 */}
						<div class="bg-black/40 border border-[#10b981]/30 rounded-2xl p-3 space-y-1">
							<span class="w-6 h-6 rounded-full bg-[#10b981]/20 text-[#10b981] text-[10px] font-black inline-flex items-center justify-center mb-1">
								۳
							</span>
							<div class="text-xs font-black text-[#10b981]">کانال نهایی</div>
							<div class="text-[10px] text-white/40 truncate font-mono">
								{channel()?.chat_title || 'انتشار عمومی'}
							</div>
						</div>
					</div>
				</div>

				<Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
					<div class="bg-[#151822] border border-white/10 rounded-[24px] p-5 flex flex-col gap-4">
						<Show
							when={!funnel()}
							fallback={
								<div class="flex flex-col gap-4">
									<div class="bg-[#10b981]/10 border border-[#10b981]/30 rounded-2xl p-4 flex flex-col gap-1">
										<span class="text-xs font-black text-[#10b981]">قیف خودکار فعال است</span>
										<span class="text-[11px] text-white/70 leading-relaxed font-bold">
											پست‌های ارسالی به کانال ورودی شناسا‌یی شده و جهت تأیید و ویرایش نهایی به پیوی
											ادمین هدایت می‌شوند.
										</span>
									</div>
									<button
										onClick={handleDeleteFunnel}
										disabled={isSubmitting()}
										class="w-full h-12 bg-red-500/10 text-red-400 border border-red-500/20 font-black rounded-xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
									>
										<Show
											when={isSubmitting()}
											fallback={<span class="material-symbols-outlined text-[18px]">delete</span>}
										>
											<span class="material-symbols-outlined text-[18px] animate-spin">
												refresh
											</span>
										</Show>
										غیرفعال‌سازی قیف انتشار
									</button>
								</div>
							}
						>
							<div class="flex flex-col gap-3">
								<label class="text-xs font-bold text-white/60">
									انتخاب کانال ورودی (پست‌های خام)
								</label>
								<div class="relative">
									<select
										class="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-xs text-white appearance-none outline-none focus:border-[#3390ec]"
										value={selectedInputChannel()}
										onChange={(e) => setSelectedInputChannel(e.currentTarget.value)}
									>
										<option value="" disabled>
											-- انتخاب کانال ورودی --
										</option>
										<For
											each={userChannels()?.filter((c: any) => c.chat_id !== channel()?.chat_id)}
										>
											{(c) => <option value={c.chat_id}>{c.title}</option>}
										</For>
									</select>
									<span class="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none text-[18px]">
										expand_more
									</span>
								</div>

								<label class="text-xs font-bold text-white/60 mt-1">یوزرنیم کانال ورودی</label>
								<input
									type="text"
									class="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-xs text-white outline-none focus:border-[#3390ec]"
									value={inputIdentifier()}
									onInput={(e) => setInputIdentifier(e.currentTarget.value)}
									placeholder="@channel_username"
									dir="ltr"
								/>

								<button
									onClick={handleCreateFunnel}
									disabled={!selectedInputChannel() || isSubmitting()}
									class="w-full h-12 mt-2 bg-[#3390ec] hover:bg-[#2b7ec9] text-white font-black rounded-xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 text-xs shadow-lg shadow-[#3390ec]/20"
								>
									<Show
										when={isSubmitting()}
										fallback={<span class="material-symbols-outlined text-[18px]">add</span>}
									>
										<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span>
									</Show>
									فعال‌سازی مسیر خودکار
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
