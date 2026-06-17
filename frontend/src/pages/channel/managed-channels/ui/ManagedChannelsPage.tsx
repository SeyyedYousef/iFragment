import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';

export const ManagedChannelsPage: Component = () => {
	const navigate = useNavigate();

	// Fetch all channels for the logged-in user
	const [channels, { refetch }] = createResource(
		() => true,
		() => channelApi.getUserChannels('all'),
	);

	const [channelToDelete, setChannelToDelete] = createSignal<any | null>(null);
	const [isDeleting, setIsDeleting] = createSignal(false);

	const handleDeleteChannel = async () => {
		const channel = channelToDelete();
		if (!channel) return;

		setIsDeleting(true);
		try {
			await channelApi.disconnectChannel(channel.id);
			hapticFeedback.notificationOccurred('success');
			setChannelToDelete(null);
			refetch();
		} catch (e: any) {
			hapticFeedback.notificationOccurred('error');
		} finally {
			setIsDeleting(false);
		}
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => window.history.back());
		onCleanup(() => off());
	});

	const handleConnectNew = () => {
		hapticFeedback.impactOccurred('medium');
		navigate('/channel/connect');
	};

	return (
		<div
			class={`min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white ${isRtl() ? 'rtl' : 'ltr'}`}
		>
			{/* Header */}
			<div class="px-5 pt-6 pb-4 bg-[#0f1014] sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center gap-3">
				<button
					onClick={() => {
						hapticFeedback.impactOccurred('light');
						navigate('/dashboard');
					}}
					class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
					aria-label="Back"
				>
					<span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">
						arrow_back
					</span>
				</button>
				<div class="flex flex-col gap-0.5 min-w-0">
					<h1 class="text-[18px] font-black text-white leading-tight truncate">
						{t('managedChannels.title')}
					</h1>
					<span class="text-[12px] text-on-surface-variant truncate">
						{t('managedChannels.description')}
					</span>
				</div>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-6">
				{/* Connect New Channel Button */}
				<button
					onClick={handleConnectNew}
					class="w-full bg-[#1c1c1c] border border-[#32ade6]/30 hover:border-[#32ade6] hover:bg-[#32ade6]/10 text-[#32ade6] rounded-2xl py-4 flex items-center justify-center gap-2 font-bold transition-all shadow-sm group"
				>
					<div class="w-8 h-8 rounded-full bg-[#32ade6]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
						<span class="material-symbols-outlined text-[20px]">add</span>
					</div>
					{t('managedChannels.connectNew')}
				</button>

				{/* Channel List */}

				<Show
					when={channels() && channels()!.length > 0}
					fallback={
						!channels.loading ? (
							<div class="bg-[#1c1c1c] rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-3 border border-[#2a2a2a]">
								<div class="w-16 h-16 rounded-full bg-[#2a2a2a] flex items-center justify-center mb-2">
									<span class="material-symbols-outlined text-[#8e8e93] text-3xl">campaign</span>
								</div>
								<h3 class="text-white font-bold text-[16px]">{t('managedChannels.noChannels')}</h3>
							</div>
						) : null
					}
				>
					<div class="flex flex-col gap-3">
						<h2 class="text-[14px] font-bold text-[#8e8e93] uppercase tracking-wider pl-2 mb-1">
							{t('managedChannels.yourChannels')}
						</h2>
						<For each={channels()}>
							{(channel, i) => (
								<Motion.div
									onClick={() => {
										hapticFeedback.impactOccurred('light');
										navigate(`/channel/${channel.id}`);
									}}
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									transition={{ delay: 0.1 + i() * 0.05 }}
									class="bg-[#1c1c1c] rounded-3xl p-4 border border-[#2a2a2a] hover:border-[#32ade6]/50 cursor-pointer flex items-center gap-4 group transition-all"
								>
									<div class="w-14 h-14 rounded-full bg-gradient-to-br from-[#32ade6] to-[#2b96c8] flex items-center justify-center font-black text-black text-xl shadow-lg group-hover:scale-105 transition-transform">
										{channel.avatar}
									</div>
									<div class="flex-1 flex flex-col gap-1">
										<span class="text-white font-bold text-[16px]">{channel.title}</span>
										<span class="text-[13px] text-[#8e8e93]">
											{channel.members} {t('managedChannels.subscribers')}
										</span>
									</div>
									<div class="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											onClick={(e) => {
												e.stopPropagation();
												hapticFeedback.impactOccurred('medium');
												setChannelToDelete(channel);
											}}
											class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#ff3b30]/10 text-[#555] hover:text-[#ff3b30] transition-all"
											aria-label={t('managedChannels.delete' as any) || 'Delete'}
										>
											<span class="material-symbols-outlined text-[22px]">delete</span>
										</button>
										<div class="w-10 h-10 rounded-full bg-[#2a2a2a] group-hover:bg-[#32ade6] flex items-center justify-center transition-colors">
											<span
												class={`material-symbols-outlined text-[#8e8e93] group-hover:text-black transition-colors ${isRtl() ? 'rotate-180' : ''}`}
											>
												chevron_right
											</span>
										</div>
									</div>
								</Motion.div>
							)}
						</For>
					</div>
				</Show>
			</div>

			{/* Delete Channel Modal */}
			<Show when={channelToDelete()}>
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-5"
					onClick={(e) => {
						if (e.target === e.currentTarget && !isDeleting()) setChannelToDelete(null);
					}}
				>
					<Motion.div
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ duration: 0.2, easing: [0.32, 0.72, 0, 1] }}
						class="w-full max-w-sm bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-6 flex flex-col items-center text-center"
					>
						<div class="w-16 h-16 rounded-full bg-[#ff3b30]/10 flex items-center justify-center mb-4">
							<span class="material-symbols-outlined text-[#ff3b30] text-[32px]">delete_forever</span>
						</div>
						
						<h3 class="text-[20px] font-black text-white mb-2">
							{t('managedChannels.deleteConfirmTitle' as any)}
						</h3>
						<p class="text-[14px] text-[#8e8e93] mb-6 leading-relaxed">
							{t('managedChannels.deleteConfirmDesc' as any)}
						</p>

						<div class="w-full flex gap-3">
							<button
								onClick={() => setChannelToDelete(null)}
								disabled={isDeleting()}
								class="flex-1 h-12 rounded-2xl font-bold text-[15px] bg-[#2a2a2a] text-white hover:bg-[#333] transition-all disabled:opacity-50"
							>
								{t('common.cancel')}
							</button>
							<button
								onClick={handleDeleteChannel}
								disabled={isDeleting()}
								class="flex-1 h-12 rounded-2xl font-bold text-[15px] bg-[#ff3b30] text-white hover:bg-[#ff453a] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(255,59,48,0.2)]"
							>
								<Show
									when={!isDeleting()}
									fallback={
										<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									}
								>
									{t('managedChannels.delete' as any)}
								</Show>
							</button>
						</div>
					</Motion.div>
				</Motion.div>
			</Show>
		</div>
	);
};
