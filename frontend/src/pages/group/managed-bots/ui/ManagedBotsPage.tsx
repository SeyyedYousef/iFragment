import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { ManagedBot } from '@/shared/api/bot-management.js';
import { botApi } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';

export const ManagedBotsPage: Component = () => {
	const navigate = useNavigate();
	const [showCreateModal, setShowCreateModal] = createSignal(false);
	const [botToken, setBotToken] = createSignal('');
	const [isCreating, setIsCreating] = createSignal(false);
	const [errorMsg, setErrorMsg] = createSignal('');

	const [botToDelete, setBotToDelete] = createSignal<ManagedBot | null>(null);
	const [isDeleting, setIsDeleting] = createSignal(false);
	const [bots, { refetch }] = createResource(botApi.listBots);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			if (showCreateModal()) {
				setShowCreateModal(false);
			} else {
				navigate('/dashboard');
			}
		});
		onCleanup(() => off());
	});

	const handleCreateBot = async () => {
		const token = botToken().trim();
		if (!token) {
			setErrorMsg('Please enter a valid bot token');
			return;
		}

		// Basic token format validation (numbers:alphanumeric)
		if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
			setErrorMsg('Invalid token format. Get your token from @BotFather');
			return;
		}

		setIsCreating(true);
		setErrorMsg('');

		try {
			// Extract bot ID from token
			const botIdStr = token.split(':')[0];
			const botIdNum = parseInt(botIdStr, 10);

			await botApi.registerBot({
				token,
				username: `bot_${botIdStr}`, // Will be updated by backend after verifying with Telegram
				name: 'New Bot',
				bot_id: botIdNum,
			});

			hapticFeedback.notificationOccurred('success');
			setBotToken('');
			setShowCreateModal(false);
			refetch();
		} catch (e: any) {
			const msg = e?.response?.data?.error || 'Failed to register bot. Please try again.';
			setErrorMsg(msg);
			hapticFeedback.notificationOccurred('error');
		} finally {
			setIsCreating(false);
		}
	};

	const handleDeleteBot = async () => {
		const bot = botToDelete();
		if (!bot) return;

		setIsDeleting(true);
		try {
			await botApi.revokeBot(bot.id);
			hapticFeedback.notificationOccurred('success');
			setBotToDelete(null);
			refetch();
		} catch (_e: any) {
			hapticFeedback.notificationOccurred('error');
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#0f1014] pb-24 relative text-white">
			{/* Header */}
			<div class="px-6 pt-6 pb-5 sticky top-0 bg-[#0f1014]/90 backdrop-blur-xl z-30 border-b border-[#1c1c1c] flex items-center gap-3">
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
					<h1 class="text-xl font-black text-white tracking-tight truncate">
						{t('managedBots.title')}
					</h1>
					<p class="text-[11px] font-medium text-[#8e8e93] leading-snug truncate">
						{t('managedBots.description')}
					</p>
				</div>
			</div>

			<div class="px-5 mt-6 space-y-6">
				{/* Create Bot Button */}
				<Motion.button
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.4, easing: [0.22, 1, 0.36, 1] }}
					onClick={() => {
						setShowCreateModal(true);
						hapticFeedback.impactOccurred('medium');
					}}
					class="w-full group relative overflow-hidden rounded-[2rem] p-[1.5px] bg-gradient-to-br from-[#3390ec] via-[#3390ec] to-[#2b7bc9] shadow-[0_20px_40px_rgba(51,144,236,0.25)] active:scale-95 transition-all"
				>
					<div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
					<div class="bg-[#1c1c1c]/40 backdrop-blur-md rounded-[1.9rem] p-5 flex items-center gap-4 relative z-10">
						<div class="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/10">
							<span class="material-symbols-outlined text-white text-[32px]">add_circle</span>
						</div>
						<div class="flex flex-col items-start gap-0.5">
							<span class="text-lg font-black text-white leading-tight">
								{t('managedBots.createBtn')}
							</span>
							<span class="text-[12px] text-white/60 font-medium tracking-wide uppercase">
								{t('managedBots.connectBotFatherApi')}
							</span>
						</div>
						<div class={`ms-auto ${isRtl() ? 'rotate-180' : ''}`}>
							<span class="material-symbols-outlined text-white/40">arrow_forward_ios</span>
						</div>
					</div>
				</Motion.button>

				{/* Your Bots Section */}
				<div class="flex flex-col gap-4">
					<div class="flex items-center justify-between px-1">
						<h2 class="text-[13px] font-black text-[#8e8e93] uppercase tracking-[0.15em]">
							{t('managedBots.yourBots')}
						</h2>
						<Show when={bots() && bots()!.length > 0}>
							<span class="bg-[#3390ec]/10 text-[#3390ec] text-[11px] font-black px-2 py-0.5 rounded-full border border-[#3390ec]/20">
								{bots()?.length} BOTS
							</span>
						</Show>
					</div>

					<Show when={!bots.loading && (!bots() || bots()!.length === 0)}>
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, easing: [0.22, 1, 0.36, 1] }}
							class="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1c1c1c] to-[#0d0e12] border border-[#2a2a2a] p-8 flex flex-col items-center text-center gap-6 shadow-2xl"
						>
							{/* Subtle background glow */}
							<div class="absolute -top-16 -left-16 w-32 h-32 bg-[#3390ec]/10 rounded-full blur-3xl pointer-events-none" />
							<div class="absolute -bottom-16 -right-16 w-32 h-32 bg-[#34c759]/5 rounded-full blur-3xl pointer-events-none" />

							<div class="relative w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#3390ec]/20 to-[#3390ec]/5 flex items-center justify-center border border-[#3390ec]/20 shadow-inner group">
								<div class="absolute inset-0 bg-[#3390ec]/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
								<span
									class="material-symbols-outlined text-[54px] text-[#3390ec]"
									style={{ 'font-variation-settings': '"FILL" 1' }}
								>
									smart_toy
								</span>
							</div>

							<div class="flex flex-col gap-2 max-w-xs">
								<p class="text-xl font-black text-white leading-tight">
									{t('managedBots.createCustomBotTitle') || 'Create Your Custom Bot'}
								</p>
								<p class="text-[13px] text-[#8e8e93] font-medium leading-relaxed">
									{t('managedBots.createCustomBotDesc') ||
										'Connect your custom brand bot to access powerful group/channel tools and get exclusive developer benefits.'}
								</p>
							</div>

							{/* Feature highlights */}
							<div class="w-full grid grid-cols-1 gap-2.5 text-start px-2">
								<div class="flex items-center gap-3 bg-white/5 rounded-2xl p-3 border border-white/[0.03]">
									<span class="material-symbols-outlined text-[#3390ec] text-[20px]">
										brand_family
									</span>
									<div class="flex flex-col">
										<span class="text-[13px] font-black text-white">
											{t('managedBots.featureBrandTitle') || 'Custom Brand & Logo'}
										</span>
										<span class="text-[11px] text-[#8e8e93]">
											{t('managedBots.featureBrandDesc') || 'Your own bot name, photo, and bio.'}
										</span>
									</div>
								</div>
								<div class="flex items-center gap-3 bg-white/5 rounded-2xl p-3 border border-white/[0.03]">
									<span class="material-symbols-outlined text-[#34c759] text-[20px]">security</span>
									<div class="flex flex-col">
										<span class="text-[13px] font-black text-white">
											{t('managedBots.featureProtectTitle') || 'Full Group Protection'}
										</span>
										<span class="text-[11px] text-[#8e8e93]">
											{t('managedBots.featureProtectDesc') ||
												'Spam blocker, quiet hours & restrictions.'}
										</span>
									</div>
								</div>
								<div class="flex items-center gap-3 bg-white/5 rounded-2xl p-3 border border-white/[0.03]">
									<span class="material-symbols-outlined text-[#ffcc00] text-[20px]">
										monetization_on
									</span>
									<div class="flex flex-col">
										<span class="text-[13px] font-black text-white">
											{t('managedBots.featureEarnTitle') || 'Earn FRG Commissions'}
										</span>
										<span class="text-[11px] text-[#8e8e93]">
											{t('managedBots.featureEarnDesc') || 'Get paid from group package upgrades.'}
										</span>
									</div>
								</div>
							</div>

							<button
								onClick={() => {
									hapticFeedback.impactOccurred('medium');
									const link = 'https://t.me/BotFather';
									try {
										if ((window as any).Telegram?.WebApp?.openTelegramLink) {
											(window as any).Telegram.WebApp.openTelegramLink(link);
										} else {
											window.open(link, '_blank');
										}
									} catch (_e) {
										window.open(link, '_blank');
									}
								}}
								class="w-full h-12 bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-95 text-white rounded-2xl font-black text-[14px] transition-all flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(51,144,236,0.2)]"
							>
								<span class="material-symbols-outlined text-[18px]">open_in_new</span>
								{t('managedBots.botFatherBtn') || 'Create Bot via @BotFather'}
							</button>
						</Motion.div>
					</Show>

					<div class="grid grid-cols-1 gap-3">
						<For each={bots() || []}>
							{(bot: ManagedBot, index) => (
								<Motion.div
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ duration: 0.4, delay: index() * 0.08 }}
									onClick={() => {
										hapticFeedback.impactOccurred('light');
										navigate(`/bot/${bot.id}/manage`);
									}}
									class="bg-[#1c1c1c] rounded-[1.75rem] border border-[#2a2a2a] p-4 flex items-center gap-4 hover:bg-[#222] transition-all cursor-pointer active:scale-[0.98] group"
								>
									{/* Bot Avatar */}
									<div
										class={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden ${
											bot.status === 'active'
												? 'bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/20'
												: 'bg-[#2c2c2e] border border-[#3a3a3c]'
										}`}
									>
										<div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
										<span
											class={`material-symbols-outlined text-[28px] relative z-10 ${
												bot.status === 'active' ? 'text-[#3390ec]' : 'text-[#555]'
											}`}
										>
											smart_toy
										</span>
									</div>

									{/* Bot Info */}
									<div class="flex flex-col flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<span class="text-[16px] font-black text-white truncate">{bot.bot_name}</span>
											<div
												class={`w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px_rgba(52,199,89,0.5)] ${
													bot.status === 'active' ? 'bg-[#34c759]' : 'bg-[#ff3b30]'
												}`}
											/>
										</div>
										<span class="text-[13px] font-bold text-[#8e8e93]">@{bot.bot_username}</span>
									</div>

									{/* Actions */}
									<div class="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											onClick={(e) => {
												e.stopPropagation();
												hapticFeedback.impactOccurred('medium');
												setBotToDelete(bot);
											}}
											class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#ff3b30]/10 text-[#555] hover:text-[#ff3b30] transition-all"
											aria-label={t('managedBots.delete' as any) || 'Delete'}
										>
											<span class="material-symbols-outlined text-[22px]">delete</span>
										</button>
										<div
											class={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
												isRtl() ? 'rotate-180' : ''
											} group-hover:bg-[#3390ec]/10 group-hover:translate-x-1`}
										>
											<span class="material-symbols-outlined text-[#3390ec] text-[24px]">
												chevron_right
											</span>
										</div>
									</div>
								</Motion.div>
							)}
						</For>
					</div>
				</div>
			</div>

			{/* Create Bot Modal */}
			<Show when={showCreateModal()}>
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
					onClick={(e) => {
						if (e.target === e.currentTarget) setShowCreateModal(false);
					}}
				>
					<Motion.div
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }}
						class="w-full bg-[#1c1c1c] rounded-t-[2rem] border-t border-[#2a2a2a] p-5"
					>
						<div class="w-10 h-1 bg-[#3a3a3a] rounded-full mx-auto mb-5" />

						<h3 class="text-[18px] font-black text-white mb-1">
							{t('managedBots.connectYourBot')}
						</h3>
						<p class="text-[13px] text-[#8e8e93] mb-5">{t('managedBots.pasteBotToken')}</p>

						{/* Steps */}
						<div class="space-y-3 mb-5">
							<div class="flex items-start gap-3">
								<div class="w-7 h-7 rounded-full bg-[#3390ec]/10 flex items-center justify-center shrink-0 mt-0.5">
									<span class="text-[12px] font-black text-[#3390ec]">1</span>
								</div>
								<div>
									<p class="text-[13px] text-white font-medium">Open @BotFather in Telegram</p>
									<p class="text-[11px] text-[#8e8e93]">Send /newbot or use an existing bot</p>
								</div>
							</div>
							<div class="flex items-start gap-3">
								<div class="w-7 h-7 rounded-full bg-[#3390ec]/10 flex items-center justify-center shrink-0 mt-0.5">
									<span class="text-[12px] font-black text-[#3390ec]">2</span>
								</div>
								<div>
									<p class="text-[13px] text-white font-medium">Copy the bot token</p>
									<p class="text-[11px] text-[#8e8e93]">It looks like: 123456:ABCdefGhi...</p>
								</div>
							</div>
							<div class="flex items-start gap-3">
								<div class="w-7 h-7 rounded-full bg-[#3390ec]/10 flex items-center justify-center shrink-0 mt-0.5">
									<span class="text-[12px] font-black text-[#3390ec]">3</span>
								</div>
								<div>
									<p class="text-[13px] text-white font-medium">Paste it below</p>
									<p class="text-[11px] text-[#8e8e93]">We'll encrypt it with AES-256</p>
								</div>
							</div>
						</div>

						<Show when={errorMsg()}>
							<div class="bg-[#ff3b30]/10 border border-[#ff3b30]/30 text-[#ff3b30] rounded-xl px-4 py-2.5 text-[12px] font-bold mb-3 flex items-center gap-2">
								<span class="material-symbols-outlined text-[16px]">error</span>
								{errorMsg()}
							</div>
						</Show>

						<input
							type="password"
							value={botToken()}
							onInput={(e) => setBotToken(e.currentTarget.value)}
							placeholder={t('managedBots.pasteBotTokenPlaceholder') as string}
							class="w-full bg-[#2c2c2e] text-white text-[14px] rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#3390ec] placeholder:text-[#555] mb-4"
						/>

						<button
							onClick={handleCreateBot}
							disabled={isCreating() || !botToken().trim()}
							class="w-full h-14 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-2xl font-bold text-[16px] transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(51,144,236,0.3)]"
						>
							<Show
								when={!isCreating()}
								fallback={
									<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								}
							>
								<span class="material-symbols-outlined text-[20px]">link</span>
								{t('managedBots.connectBotBtn')}
							</Show>
						</button>
					</Motion.div>
				</Motion.div>
			</Show>

			{/* Delete Bot Modal */}
			<Show when={botToDelete()}>
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-5"
					onClick={(e) => {
						if (e.target === e.currentTarget && !isDeleting()) setBotToDelete(null);
					}}
				>
					<Motion.div
						initial={{ scale: 0.9, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ duration: 0.2, easing: [0.32, 0.72, 0, 1] }}
						class="w-full max-w-sm bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-6 flex flex-col items-center text-center"
					>
						<div class="w-16 h-16 rounded-full bg-[#ff3b30]/10 flex items-center justify-center mb-4">
							<span class="material-symbols-outlined text-[#ff3b30] text-[32px]">
								delete_forever
							</span>
						</div>

						<h3 class="text-[20px] font-black text-white mb-2">
							{t('managedBots.deleteConfirmTitle' as any)}
						</h3>
						<p class="text-[14px] text-[#8e8e93] mb-6 leading-relaxed">
							{t('managedBots.deleteConfirmDesc' as any)}
						</p>

						<div class="w-full flex gap-3">
							<button
								onClick={() => setBotToDelete(null)}
								disabled={isDeleting()}
								class="flex-1 h-12 rounded-2xl font-bold text-[15px] bg-[#2a2a2a] text-white hover:bg-[#333] transition-all disabled:opacity-50"
							>
								{t('common.cancel')}
							</button>
							<button
								onClick={handleDeleteBot}
								disabled={isDeleting()}
								class="flex-1 h-12 rounded-2xl font-bold text-[15px] bg-[#ff3b30] text-white hover:bg-[#ff453a] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(255,59,48,0.2)]"
							>
								<Show
									when={!isDeleting()}
									fallback={
										<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
									}
								>
									{t('managedBots.delete' as any)}
								</Show>
							</button>
						</div>
					</Motion.div>
				</Motion.div>
			</Show>
		</div>
	);
};
