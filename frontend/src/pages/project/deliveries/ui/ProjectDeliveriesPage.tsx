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
import { channelApi } from '@/entities/channel/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { ProjectContextBar, ProjectHamburgerMenu } from '@/widgets/project/index.js';

export const ProjectDeliveriesPage: Component = () => {
	const params = useParams<{ projectId: string }>();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	const [deliveries] = createResource(
		() => params.projectId,
		(id) => channelApi.getProjectDeliveries(id, 50),
	);

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					navigate(`/projects/${params.projectId}`);
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

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-30 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3 min-w-0">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}`);
						}}
						class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 text-white/80"
					>
						<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col min-w-0">
						<h1 class="text-[17px] font-black text-white leading-tight truncate">
							{t('channelProjects.deliveries.title')}
						</h1>
						<span class="text-[10px] font-bold text-white/50 uppercase tracking-wider">
							{t('channelProjects.deliveries.subtitle')}
						</span>
					</div>
				</div>

				<button
					type="button"
					onClick={() => setIsMenuOpen(true)}
					class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 text-white"
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<div class="px-5 pt-4 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
				<ProjectContextBar projectId={params.projectId} compact={true} />

				{/* Description Note */}
				<div class="bg-[#12141C]/60 border border-white/5 rounded-[18px] p-3.5 text-[11px] text-white/50 leading-relaxed flex items-start gap-2.5">
					<span class="material-symbols-outlined text-[#3390ec] text-[18px] shrink-0 mt-0.5">verified</span>
					<span>
						{t('channelProjects.deliveries.verifiedNote')}
					</span>
				</div>

				{/* Deliveries List */}
				<Show
					when={deliveries() && deliveries()!.length > 0}
					fallback={
						!deliveries.loading ? (
							<div class="bg-[#12141C]/80 border border-white/5 rounded-[24px] p-8 text-center flex flex-col items-center gap-3">
								<div class="w-14 h-14 rounded-[18px] bg-white/5 flex items-center justify-center text-white/40">
									<span class="material-symbols-outlined text-[32px]">local_shipping</span>
								</div>
								<span class="text-[14px] font-bold text-white/70">{t('channelProjects.deliveries.emptyTitle')}</span>
								<span class="text-[11px] text-white/40 max-w-[240px]">
									{t('channelProjects.deliveries.emptyDesc')}
								</span>
							</div>
						) : (
							<div class="flex flex-col gap-3">
								<For each={[1, 2, 3]}>
									{() => (
										<div class="bg-[#12141C]/50 rounded-[20px] p-4 border border-white/5 animate-pulse h-24" />
									)}
								</For>
							</div>
						)
					}
				>
					<div class="flex flex-col gap-3">
						<For each={deliveries()}>
							{(delivery, i) => {
								const isSuccess = delivery.status === 'published';
								return (
									<Motion.div
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: i() * 0.03 }}
										class="bg-gradient-to-b from-[#141722] to-[#0c0e15] border border-white/10 rounded-[22px] p-4 flex flex-col gap-2.5 shadow-sm"
									>
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<span class={`w-2.5 h-2.5 rounded-full ${isSuccess ? 'bg-emerald-400' : 'bg-rose-500'}`} />
												<span class="text-[12px] font-black text-white">
													{isSuccess ? t('channelProjects.deliveries.dispatchSuccess') : t('channelProjects.deliveries.dispatchFailed')}
												</span>
											</div>
											<span class="text-[10px] text-white/40 font-mono">
												{new Date(delivery.created_at).toLocaleString()}
											</span>
										</div>

										<div class="grid grid-cols-2 gap-2 text-[11px] bg-[#090a0f] p-2.5 rounded-[14px] border border-white/5 font-mono text-white/70">
											<div>
												<span class="text-white/40 block text-[9px]">{t('channelProjects.deliveries.telegramMessageId')}</span>
												<span>{delivery.telegram_message_id ? `#${delivery.telegram_message_id}` : '-'}</span>
											</div>
											<div>
												<span class="text-white/40 block text-[9px]">{t('channelProjects.settingsPage.targetChannel')}</span>
												<span>{delivery.destination_chat_id}</span>
											</div>
										</div>

										<div class="flex items-center justify-between text-[10px] text-white/40 font-mono truncate">
											<span class="truncate">{t('channelProjects.deliveries.idempotencyKey')}: {delivery.idempotency_key}</span>
											<span class="text-emerald-400 font-bold shrink-0">{t('channelProjects.deliveries.botOwned')}</span>
										</div>
									</Motion.div>
								);
							}}
						</For>
					</div>
				</Show>
			</div>

			<ProjectHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				projectId={params.projectId}
				activeTab="deliveries"
			/>
		</div>
	);
};
