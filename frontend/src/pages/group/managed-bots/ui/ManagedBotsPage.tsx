import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { ManagedBot } from '@/shared/api/bot-management.js';
import { botApi } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

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
			haptic.impact('light');
			if (showCreateModal()) setShowCreateModal(false);
			else navigate('/dashboard');
		});
		onCleanup(() => { off(); backButton.hide(); });
	});

	const handleCreateBot = async () => {
		const token = botToken().trim();
		if (!token) {
			setErrorMsg(t('managedBots.tokenRequired'));
			haptic.notify('warning');
			return;
		}

		if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
			setErrorMsg(t('managedBots.tokenInvalidFormat'));
			haptic.notify('warning');
			return;
		}

		setIsCreating(true);
		setErrorMsg('');

		try {
			const botIdStr = token.split(':')[0];
			const botIdNum = parseInt(botIdStr, 10);

			await botApi.registerBot({
				token,
				username: `bot_${botIdStr}`,
				name: 'New Bot',
				bot_id: botIdNum,
			});

			haptic.notify('success');
			setBotToken('');
			setShowCreateModal(false);
			refetch();
		} catch (e: any) {
			const msg = e?.response?.data?.error || t('managedBots.registerFailed');
			setErrorMsg(msg);
			haptic.notify('error');
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
			haptic.notify('success');
			setBotToDelete(null);
			refetch();
		} catch (_e: any) {
			haptic.notify('error');
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-[#3390ec]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-30 border-b border-white/5 flex items-center gap-3.5 shadow-sm">
				<button
					onClick={() => { haptic.impact('light'); navigate('/dashboard'); }}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
					aria-label={t('common.back')}
				>
					<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
				</button>
				<div class="flex flex-col gap-0.5 min-w-0">
					<h1 class="text-[18px] font-black text-white tracking-tight truncate drop-shadow-sm">
						{t('managedBots.title')}
					</h1>
					<p class="text-[11px] font-bold uppercase tracking-wider text-white/50 leading-snug truncate">
						{t('managedBots.description')}
					</p>
				</div>
			</div>

			<div class="px-5 mt-6 flex flex-col gap-6 max-w-md mx-auto relative z-10 w-full">
				
				{/* ═══════ CREATE BOT HERO BUTTON ═══════ */}
				<Motion.button
					initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, easing: [0.32, 0.72, 0, 1] }}
					onClick={() => { haptic.impact('medium'); setShowCreateModal(true); }}
					class="w-full group relative overflow-hidden rounded-[24px] p-[1.5px] bg-gradient-to-br from-[#3390ec] via-[#3390ec] to-[#2b7bc9] shadow-[0_15px_35px_rgba(51,144,236,0.25)] active:scale-95 transition-all text-left"
				>
					<div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
					<div class="bg-[#12141C]/60 backdrop-blur-xl rounded-[22.5px] p-5 flex items-center gap-4 relative z-10">
						<div class="w-14 h-14 rounded-[16px] bg-white/10 flex items-center justify-center border border-white/20 shadow-inner shrink-0 group-hover:scale-105 transition-transform duration-300">
							<span class="material-symbols-outlined text-white text-[32px] drop-shadow-md">add_circle</span>
						</div>
						<div class="flex flex-col items-start gap-1 flex-1 min-w-0">
							<span class="text-[16px] font-black text-white leading-tight truncate w-full">
								{t('managedBots.createBtn')}
							</span>
							<span class="text-[10px] text-white/70 font-bold tracking-widest uppercase truncate w-full">
								{t('managedBots.connectBotFatherApi')}
							</span>
						</div>
						<div class={`shrink-0 w-8 h-8 rounded-[10px] bg-white/10 flex items-center justify-center border border-white/5 ${isRtl() ? 'rotate-180' : ''}`}>
							<span class="material-symbols-outlined text-white/60 text-[18px] group-hover:translate-x-0.5 transition-transform">arrow_forward_ios</span>
						</div>
					</div>
				</Motion.button>

				{/* ═══════ YOUR BOTS LIST ═══════ */}
				<div class="flex flex-col gap-4">
					<div class="flex items-center justify-between px-1 mb-1 border-b border-white/5 pb-2">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#3390ec] text-[20px]">smart_toy</span>
							<h2 class="text-[12px] font-black text-white/60 uppercase tracking-widest">
								{t('managedBots.yourBots')}
							</h2>
						</div>
						<Show when={bots() && bots()!.length > 0}>
							<span class="bg-[#3390ec]/10 text-[#3390ec] text-[10px] font-black px-2.5 py-1 rounded-[8px] border border-[#3390ec]/30 shadow-sm">
								{bots()?.length} BOTS
							</span>
						</Show>
					</div>

					<Show when={!bots.loading && (!bots() || bots()!.length === 0)}>
						<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, easing: [0.32, 0.72, 0, 1] }} class="relative overflow-hidden rounded-[28px] bg-[#12141C]/80 backdrop-blur-xl border border-white/5 p-8 flex flex-col items-center text-center gap-6 shadow-sm">
							<div class="absolute -top-16 -left-16 w-32 h-32 bg-[#3390ec]/15 rounded-full blur-3xl pointer-events-none" />
							<div class="absolute -bottom-16 -right-16 w-32 h-32 bg-[#34c759]/10 rounded-full blur-3xl pointer-events-none" />

							<div class="relative w-20 h-20 rounded-[20px] bg-gradient-to-tr from-[#3390ec]/20 to-[#3390ec]/5 flex items-center justify-center border border-[#3390ec]/30 shadow-inner">
								<span class="material-symbols-outlined text-[42px] text-[#3390ec] drop-shadow-[0_0_10px_rgba(51,144,236,0.5)]" style={{ 'font-variation-settings': '"FILL" 1' }}>smart_toy</span>
							</div>

							<div class="flex flex-col gap-2.5 max-w-xs relative z-10">
								<p class="text-[18px] font-black text-white leading-tight tracking-tight">
									{t('managedBots.createCustomBotTitle')}
								</p>
								<p class="text-[12px] text-white/50 font-medium leading-relaxed">
									{t('managedBots.createCustomBotDesc')}
								</p>
							</div>

							<div class="w-full flex flex-col gap-2.5 text-start relative z-10">
								<div class="flex items-center gap-3.5 bg-[#08090D] rounded-[16px] p-3.5 border border-white/5 shadow-inner">
									<span class="material-symbols-outlined text-[#3390ec] text-[22px]">brand_family</span>
									<div class="flex flex-col gap-0.5">
										<span class="text-[13px] font-black text-white">{t('managedBots.featureBrandTitle')}</span>
										<span class="text-[11px] font-medium text-white/40">{t('managedBots.featureBrandDesc')}</span>
									</div>
								</div>
								<div class="flex items-center gap-3.5 bg-[#08090D] rounded-[16px] p-3.5 border border-white/5 shadow-inner">
									<span class="material-symbols-outlined text-[#10b981] text-[22px]">security</span>
									<div class="flex flex-col gap-0.5">
										<span class="text-[13px] font-black text-white">{t('managedBots.featureProtectTitle')}</span>
										<span class="text-[11px] font-medium text-white/40">{t('managedBots.featureProtectDesc')}</span>
									</div>
								</div>
								<div class="flex items-center gap-3.5 bg-[#08090D] rounded-[16px] p-3.5 border border-white/5 shadow-inner">
									<span class="material-symbols-outlined text-amber-400 text-[22px]">monetization_on</span>
									<div class="flex flex-col gap-0.5">
										<span class="text-[13px] font-black text-white">{t('managedBots.featureEarnTitle')}</span>
										<span class="text-[11px] font-medium text-white/40">{t('managedBots.featureEarnDesc')}</span>
									</div>
								</div>
							</div>

							<button
								onClick={() => {
									haptic.impact('medium');
									const link = 'https://t.me/BotFather';
									try { if ((window as any).Telegram?.WebApp?.openTelegramLink) (window as any).Telegram.WebApp.openTelegramLink(link); else window.open(link, '_blank'); }
									catch (_) { window.open(link, '_blank'); }
								}}
								class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7bc9] hover:from-[#2b7bc9] hover:to-[#3390ec] active:scale-95 text-white rounded-[16px] font-black text-[13px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(51,144,236,0.3)] relative z-10 border border-white/10"
							>
								<span class="material-symbols-outlined text-[20px]">open_in_new</span>
								{t('managedBots.botFatherBtn')}
							</button>
						</Motion.div>
					</Show>

					<div class="flex flex-col gap-3">
						<For each={bots() || []}>
							{(bot: ManagedBot, index) => (
								<Motion.div
									initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index() * 0.08, easing: [0.32, 0.72, 0, 1] }}
									onClick={() => { haptic.impact('light'); navigate(`/bot/${bot.id}/manage`); }}
									class="bg-[#12141C]/80 backdrop-blur-xl rounded-[20px] border border-white/5 p-4 flex items-center gap-4 hover:border-[#3390ec]/30 transition-all cursor-pointer active:scale-[0.98] shadow-sm group"
								>
									<div class={`w-14 h-14 rounded-[16px] flex items-center justify-center shrink-0 relative overflow-hidden shadow-inner ${bot.status === 'active' ? 'bg-[#3390ec]/15 border border-[#3390ec]/30' : 'bg-[#08090D] border border-white/10'}`}>
										<div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
										<span class={`material-symbols-outlined text-[28px] relative z-10 ${bot.status === 'active' ? 'text-[#3390ec] drop-shadow-md' : 'text-white/30'}`}>
											smart_toy
										</span>
									</div>

									<div class="flex flex-col flex-1 min-w-0 gap-0.5">
										<div class="flex items-center gap-2">
											<span class="text-[15px] font-black text-white truncate tracking-tight">{bot.bot_name}</span>
											<div class={`w-2 h-2 rounded-full shrink-0 shadow-sm ${bot.status === 'active' ? 'bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-[#ff4a4a]'}`} />
										</div>
										<span class="text-[12px] font-bold text-white/40 font-mono truncate">@{bot.bot_username}</span>
									</div>

									<div class="flex items-center gap-1.5 shrink-0">
										<button
											onClick={(e) => { e.stopPropagation(); haptic.impact('medium'); setBotToDelete(bot); }}
											class="w-10 h-10 rounded-[12px] flex items-center justify-center bg-transparent hover:bg-[#ff4a4a]/10 text-white/20 hover:text-[#ff4a4a] transition-colors border border-transparent hover:border-[#ff4a4a]/20"
											aria-label={t('managedBots.delete')}
										>
											<span class="material-symbols-outlined text-[20px]">delete</span>
										</button>
										<div class={`w-10 h-10 rounded-[12px] flex items-center justify-center transition-transform ${isRtl() ? 'rotate-180' : ''} group-hover:translate-x-1 text-white/20 group-hover:text-[#3390ec]`}>
											<span class="material-symbols-outlined text-[24px]">chevron_right</span>
										</div>
									</div>
								</Motion.div>
							)}
						</For>
					</div>
				</div>
			</div>

			{/* ═══════ CREATE BOT MODAL (Bottom Sheet) ═══════ */}
			<Show when={showCreateModal()}>
				<Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} class="fixed inset-0 bg-[#030303]/90 backdrop-blur-2xl z-50 flex items-end justify-center" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
					<Motion.div initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }} class="w-full max-h-[92vh] bg-[#12141C] rounded-t-[32px] border-t border-white/10 p-6 overflow-y-auto no-scrollbar shadow-[0_-30px_80px_rgba(0,0,0,0.8)] relative">
						
						<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

						<div class="flex flex-col gap-1.5 mb-6">
							<h3 class="text-[20px] font-black text-white tracking-tight">{t('managedBots.connectYourBot')}</h3>
							<p class="text-[12px] font-medium text-white/50">{t('managedBots.pasteBotToken')}</p>
						</div>

						<div class="flex flex-col gap-3.5 mb-6">
							<div class="flex items-center gap-3.5 bg-[#08090D] p-3.5 rounded-[16px] border border-white/5 shadow-inner">
								<div class="w-9 h-9 rounded-[12px] bg-[#3390ec]/15 flex items-center justify-center shrink-0 border border-[#3390ec]/30 shadow-sm"><span class="text-[13px] font-black text-[#3390ec]">1</span></div>
								<div class="flex flex-col gap-0.5">
									<p class="text-[13px] text-white font-bold tracking-tight">{t('managedBots.step1Title')}</p>
									<p class="text-[11px] font-medium text-white/40">{t('managedBots.step1Desc')}</p>
								</div>
							</div>
							<div class="flex items-center gap-3.5 bg-[#08090D] p-3.5 rounded-[16px] border border-white/5 shadow-inner">
								<div class="w-9 h-9 rounded-[12px] bg-[#3390ec]/15 flex items-center justify-center shrink-0 border border-[#3390ec]/30 shadow-sm"><span class="text-[13px] font-black text-[#3390ec]">2</span></div>
								<div class="flex flex-col gap-0.5">
									<p class="text-[13px] text-white font-bold tracking-tight">{t('managedBots.step2Title')}</p>
									<p class="text-[11px] font-medium text-white/40 font-mono">{t('managedBots.step2Desc')}</p>
								</div>
							</div>
							<div class="flex items-center gap-3.5 bg-[#08090D] p-3.5 rounded-[16px] border border-white/5 shadow-inner">
								<div class="w-9 h-9 rounded-[12px] bg-[#3390ec]/15 flex items-center justify-center shrink-0 border border-[#3390ec]/30 shadow-sm"><span class="text-[13px] font-black text-[#3390ec]">3</span></div>
								<div class="flex flex-col gap-0.5">
									<p class="text-[13px] text-white font-bold tracking-tight">{t('managedBots.step3Title')}</p>
									<p class="text-[11px] font-medium text-[#10b981] flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">lock</span> {t('managedBots.step3Desc')}</p>
								</div>
							</div>
						</div>

						<Show when={errorMsg()}>
							<div class="bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 text-[#ff4a4a] rounded-[14px] px-4 py-3 text-[12px] font-bold mb-4 flex items-center gap-2 shadow-sm">
								<span class="material-symbols-outlined text-[18px]">error</span> {errorMsg()}
							</div>
						</Show>

						<div class="relative mb-5">
							<input
								type="password" value={botToken()} onInput={(e) => setBotToken(e.currentTarget.value)} placeholder={t('managedBots.pasteBotTokenPlaceholder')}
								class="w-full h-14 bg-[#08090D] border border-white/10 text-white text-[14px] font-mono font-bold rounded-[16px] px-4 pl-12 focus:outline-none focus:border-[#3390ec]/50 transition-colors placeholder-white/20 shadow-inner"
								dir="ltr"
							/>
							<span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-[20px] pointer-events-none">key</span>
						</div>

						<button
							onClick={handleCreateBot} disabled={isCreating() || !botToken().trim()}
							class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7bc9] hover:from-[#2b7bc9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[13px] uppercase tracking-widest transition-all disabled:opacity-40 disabled:scale-100 flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(51,144,236,0.3)] active:scale-95 border border-white/10"
						>
							<Show when={!isCreating()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
								<span class="material-symbols-outlined text-[20px]">link</span> {t('managedBots.connectBotBtn')}
							</Show>
						</button>
					</Motion.div>
				</Motion.div>
			</Show>

			{/* ═══════ DELETE BOT MODAL (Danger Zone) ═══════ */}
			<Show when={botToDelete()}>
				<Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} class="fixed inset-0 bg-[#030303]/90 backdrop-blur-2xl z-50 flex items-center justify-center px-5" onClick={(e) => { if (e.target === e.currentTarget && !isDeleting()) setBotToDelete(null); }}>
					<Motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }} class="w-full max-w-sm max-h-[85vh] overflow-y-auto no-scrollbar bg-[#12141C] border border-white/10 rounded-[32px] p-7 flex flex-col items-center text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative">
						<div class="absolute -top-10 -left-10 w-32 h-32 bg-[#ff4a4a]/20 blur-3xl rounded-full pointer-events-none" />
						
						<div class="w-20 h-20 rounded-[24px] bg-[#ff4a4a]/10 border border-[#ff4a4a]/30 flex items-center justify-center mb-5 shadow-inner relative z-10">
							<span class="material-symbols-outlined text-[#ff4a4a] text-[40px] drop-shadow-md">delete_forever</span>
						</div>

						<h3 class="text-[22px] font-black text-white mb-2 tracking-tight relative z-10">{t('managedBots.deleteConfirmTitle')}</h3>
						<p class="text-[13px] text-white/50 mb-8 leading-relaxed font-medium px-2 relative z-10">
							{t('managedBots.deleteConfirmDesc')}
						</p>

						<div class="w-full flex flex-col gap-3 relative z-10">
							<button onClick={handleDeleteBot} disabled={isDeleting()} class="w-full h-14 rounded-[16px] font-black text-[14px] uppercase tracking-widest bg-[#ff4a4a] hover:bg-[#ff3b30] text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(255,74,74,0.3)] active:scale-95 border border-white/10">
								<Show when={!isDeleting()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
									<span class="material-symbols-outlined text-[20px]">warning</span> {t('managedBots.delete')}
								</Show>
							</button>
							<button onClick={() => setBotToDelete(null)} disabled={isDeleting()} class="w-full h-14 rounded-[16px] font-bold text-[14px] uppercase tracking-widest bg-transparent hover:bg-white/5 text-white/60 hover:text-white transition-all disabled:opacity-50 active:scale-95 border border-transparent hover:border-white/5">
								{t('common.cancel')}
							</button>
						</div>
					</Motion.div>
				</Motion.div>
			</Show>
		</div>
	);
};
