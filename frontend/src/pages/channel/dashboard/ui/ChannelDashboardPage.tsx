import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { FragmentPulse } from '@/shared/ui/FragmentPulse.js';

export const ChannelDashboardPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [showTooltip, setShowTooltip] = createSignal(true);
	const [searchQuery, setSearchQuery] = createSignal('');

	const channelFeatures = () => [
		{ name: t('search.features.channelPosting'), icon: 'send', path: `/channel/${params.id}/posting` },
		{ name: t('search.features.channelSettings'), icon: 'settings', path: `/channel/${params.id}/settings` },
		{ name: t('search.features.channelFunnel'), icon: 'filter_alt', path: `/channel/${params.id}/funnel` },
		{ name: t('search.features.channelForwarding'), icon: 'forward', path: `/channel/${params.id}/forwarding` },
		{ name: t('search.features.channelAdmins'), icon: 'admin_panel_settings', path: `/channel/${params.id}/admins` },
		{ name: t('search.features.channelInlineButtons'), icon: 'smart_button', path: `/channel/${params.id}/inline-buttons` },
		{ name: t('search.features.channelAutoResponder'), icon: 'question_answer', path: `/channel/${params.id}/auto-responder` },
		{ name: t('search.features.channelAnalytics'), icon: 'analytics', path: `/channel/${params.id}/analytics` },
		{ name: t('search.features.channelDynamicBio'), icon: 'badge', path: `/channel/${params.id}/dynamic-bio` },
		{ name: t('search.features.channelAuditLog'), icon: 'history', path: `/channel/${params.id}/audit-log` },
	];

	const filteredFeatures = () => {
		const q = searchQuery().trim().toLowerCase();
		if (!q) return [];
		return channelFeatures().filter((f) => f.name.toLowerCase().includes(q));
	};

	const [channel] = createResource(() => params.id, (id) => channelApi.getChannel(id));
	const [analytics] = createResource(() => params.id, (id) => channelApi.getAnalytics(id, 7));
	const [auditLogs] = createResource(() => params.id, (id) => channelApi.getAuditLogs(id, 5));
	const [funnel] = createResource(() => params.id, (id) => channelApi.getFunnel(id));

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} window.history.back(); });
		const timer = setTimeout(() => setShowTooltip(false), 10000);

		onCleanup(() => { off(); clearTimeout(timer); backButton.hide(); });
	});

	const handleMenuOpen = () => {
		setIsMenuOpen(true);
		setShowTooltip(false);
		try { hapticFeedback.impactOccurred('light'); } catch (_) {}
	};

	const getHealthColor = (rate: number) => {
		if (rate >= 20) return '#10b981';
		if (rate >= 10) return '#f59e0b';
		return '#ff4a4a';
	};

	const getHealthBg = (rate: number) => {
		if (rate >= 20) return 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]';
		if (rate >= 10) return 'bg-amber-400/10 border-amber-400/30 text-amber-400';
		return 'bg-[#ff4a4a]/10 border-[#ff4a4a]/30 text-[#ff4a4a]';
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#3390ec]/15 via-[#06b6d4]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3 overflow-hidden flex-1">
					<button
						onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} window.history.back(); }}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/30 flex items-center justify-center relative shrink-0 shadow-inner">
						<span class="text-[16px] font-black text-[#3390ec] drop-shadow-md">
							{channel()?.chat_title?.charAt(0) || 'C'}
						</span>
					</div>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2">
							<h1 class="text-[16px] font-black text-white leading-tight truncate max-w-[130px] tracking-tight">
								{channel.loading ? '...' : channel()?.chat_title || t('channelDashboard.title')}
							</h1>
							<span class="text-[9px] bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 px-2 py-0.5 rounded-[6px] font-black uppercase tracking-widest shadow-sm">
								{t('channelDashboard.connected')}
							</span>
						</div>
						<div class="flex items-center gap-1.5 text-[10px] text-white/50 font-bold mt-0.5 tracking-wider uppercase">
							<span class="font-mono">{t('channelDashboard.membersCount', { count: (channel()?.members_count || 0).toLocaleString() })}</span>
							<span class="w-1 h-1 rounded-full bg-white/20" />
							<span class={channel()?.subscription_status === 'paid' ? 'text-[#10b981]' : 'text-amber-400'}>
								{channel()?.subscription_status === 'paid' ? t('common.pro') : t('common.free')}
							</span>
						</div>
					</div>
				</div>

				<div class="relative flex items-center gap-2">
					<Show when={showTooltip()}>
						<Motion.div
							initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
							class={`absolute top-[125%] w-[190px] bg-[#3390ec] text-white text-[12px] font-bold p-3.5 rounded-[16px] shadow-[0_10px_30px_rgba(51,144,236,0.3)] z-50 flex flex-col gap-2 ${isRtl() ? 'left-0 origin-top-left' : 'right-0 origin-top-right'}`}
						>
							<div class={`absolute -top-2 w-4 h-4 bg-[#3390ec] rotate-45 rounded-sm ${isRtl() ? 'left-4' : 'right-4'}`} />
							<div class="relative z-10 flex items-start justify-between gap-2">
								<span class="leading-relaxed">{t('channelDashboard.tooltipDesc')}</span>
								<button onClick={(e) => { e.stopPropagation(); setShowTooltip(false); }} class="mt-0.5 opacity-80 hover:opacity-100 shrink-0 active:scale-95 transition-transform bg-white/10 rounded-full w-5 h-5 flex items-center justify-center">
									<span class="material-symbols-outlined text-[14px]">close</span>
								</button>
							</div>
						</Motion.div>
					</Show>

					<button
						onClick={handleMenuOpen}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all relative shadow-sm text-white/80"
						aria-label={t('common.toggle')}
					>
						<Show when={showTooltip()}>
							<span class={`absolute -top-1 -right-1 flex h-3.5 w-3.5`}>
								<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff4a4a] opacity-75" />
								<span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#ff4a4a] border-2 border-[#030303]" />
							</span>
						</Show>
						<span class="material-symbols-outlined text-[22px]">menu</span>
					</button>
				</div>
			</div>

			<div class="px-5 pt-6 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
				
				{/* ═══════ QUICK SPOTLIGHT SEARCH ═══════ */}
				<div class="relative w-full z-30">
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/10 rounded-[18px] px-4 h-14 flex items-center gap-3 focus-within:border-[#3390ec]/50 focus-within:bg-[#08090D] transition-all shadow-inner">
						<span class="material-symbols-outlined text-white/40 text-[22px]">search</span>
						<input
							type="text" placeholder={t('search.channelPlaceholder')}
							value={searchQuery()} onInput={(e) => setSearchQuery(e.currentTarget.value)}
							class="w-full bg-transparent text-[13px] font-bold text-white placeholder-white/30 outline-none"
						/>
						<Show when={searchQuery()}>
							<button onClick={() => setSearchQuery('')} class="text-white/40 hover:text-white p-1 transition-colors">
								<span class="material-symbols-outlined text-[18px]">close</span>
							</button>
						</Show>
					</div>

					<Show when={searchQuery().trim() !== ''}>
						<Motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} class="absolute top-16 left-0 right-0 bg-[#12141C]/95 backdrop-blur-2xl border border-white/10 rounded-[20px] p-2 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-1 max-h-[300px] overflow-y-auto">
							<For each={filteredFeatures()} fallback={<div class="p-4 text-[12px] text-white/40 text-center font-bold">{t('search.notFoundChannel')}</div>}>
								{(feat) => (
									<button
										onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} setSearchQuery(''); navigate(feat.path); }}
										class="w-full p-3 rounded-[14px] bg-transparent hover:bg-white/10 flex items-center gap-3.5 text-right transition-all active:scale-95"
									>
										<div class="w-9 h-9 rounded-[10px] bg-[#3390ec]/10 flex items-center justify-center border border-[#3390ec]/20 shrink-0">
											<span class="material-symbols-outlined text-[#3390ec] text-[20px]">{feat.icon}</span>
										</div>
										<span class="text-[13px] font-bold text-white">{feat.name}</span>
									</button>
								)}
							</For>
						</Motion.div>
					</Show>
				</div>

				{/* ═══════ LAYER 1: COMMAND CENTER (PULSE) ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[28px] p-5 flex flex-col gap-5 shadow-sm relative overflow-hidden">
					<div class="absolute -right-6 -top-6 w-24 h-24 bg-[#06b6d4]/10 blur-2xl rounded-full pointer-events-none" />
					
					<div class="flex items-center justify-between relative z-10 border-b border-white/5 pb-3">
						<div class="flex items-center gap-2.5">
							<FragmentPulse state="healthy" />
							<h2 class="text-[10px] font-black uppercase text-white/40 tracking-widest">
								{t('channelDashboard.commandCenter')}
							</h2>
						</div>
						<span class="text-[11px] font-black text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20 px-2 py-0.5 rounded-[6px] shadow-sm uppercase tracking-wider">
							+{analytics()?.summary?.new_members_today || 0} {t('channelDashboard.today')}
						</span>
					</div>

					<div class="grid grid-cols-2 gap-3 relative z-10">
						<button
							onClick={() => navigate(`/channel/${params.id}/posting`)}
							class="h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] text-[13px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(51,144,236,0.3)] active:scale-95 transition-all border border-white/10"
						>
							<span class="material-symbols-outlined text-[20px]">edit_square</span>
							{t('channelDashboard.newPost')}
						</button>

						<button
							onClick={() => navigate(`/channel/${params.id}/funnel`)}
							class="h-14 bg-[#08090D] hover:bg-white/5 border border-white/10 text-white rounded-[16px] text-[12px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
						>
							<span class="material-symbols-outlined text-[#06b6d4] text-[20px]">account_tree</span>
							{t('channelDashboard.funnelTitle')}
						</button>
					</div>
				</div>

				{/* ═══════ FUNNEL VISUAL OVERVIEW ═══════ */}
				<Show when={funnel()}>
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-4 shadow-sm">
						<div class="flex items-center justify-between border-b border-white/5 pb-3">
							<h3 class="text-[11px] font-black text-[#06b6d4] uppercase tracking-widest flex items-center gap-1.5">
								<span class="material-symbols-outlined text-[16px]">route</span>
								{t('channelDashboard.autoFunnelPath')}
							</h3>
							<button onClick={() => navigate(`/channel/${params.id}/funnel`)} class="text-[10px] font-black text-[#3390ec] bg-[#3390ec]/10 px-2 py-0.5 rounded-[6px] border border-[#3390ec]/20 uppercase tracking-widest shadow-sm">
								{t('common.edit')}
							</button>
						</div>

						<div class="flex items-center justify-between gap-2 mt-1">
							<div class="flex-1 bg-[#08090D] border border-white/5 rounded-[16px] p-3.5 flex flex-col items-center text-center gap-1 shadow-inner relative overflow-hidden group">
								<div class="absolute inset-0 bg-[#06b6d4]/5 opacity-0 group-hover:opacity-100 transition-colors" />
								<span class="text-[9px] font-black text-white/30 uppercase tracking-widest relative z-10">{t('channelDashboard.inputDrafts')}</span>
								<span class="text-[13px] font-black text-white truncate w-full relative z-10 px-1">{funnel()?.input_title || t('channelDashboard.inputChannel')}</span>
							</div>
							<div class="w-8 flex items-center justify-center shrink-0">
								<span class="material-symbols-outlined text-[#06b6d4] text-[24px] rtl:rotate-180">double_arrow</span>
							</div>
							<div class="flex-1 bg-[#08090D] border border-white/5 rounded-[16px] p-3.5 flex flex-col items-center text-center gap-1 shadow-inner relative overflow-hidden group">
								<div class="absolute inset-0 bg-[#10b981]/5 opacity-0 group-hover:opacity-100 transition-colors" />
								<span class="text-[9px] font-black text-white/30 uppercase tracking-widest relative z-10">{t('channelDashboard.outputPublic')}</span>
								<span class="text-[13px] font-black text-white truncate w-full relative z-10 px-1">{channel()?.chat_title || t('channelDashboard.mainChannel')}</span>
							</div>
						</div>
					</div>
				</Show>

				{/* ═══════ ENGAGEMENT & HEALTH METRICS ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
					<div class="absolute -left-6 -top-6 w-24 h-24 bg-white/5 blur-2xl rounded-full pointer-events-none" />
					
					<div class="flex items-center justify-between relative z-10">
						<span class="text-[13px] font-black text-white tracking-tight flex items-center gap-1.5"><span class="material-symbols-outlined text-[18px] text-white/40">monitoring</span> {t('channelDashboard.healthScore')}</span>
						<span class={`text-[18px] font-black font-mono px-3 py-1 rounded-[10px] shadow-inner border ${getHealthBg(analytics()?.summary?.engagement_rate || 0)}`}>
							{analytics()?.summary?.engagement_rate || 0}%
						</span>
					</div>

					<div class="w-full h-4 bg-[#08090D] rounded-full overflow-hidden border border-white/5 shadow-inner relative z-10 flex">
						<div
							class="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_currentColor]"
							style={{
								width: `${Math.min(100, (analytics()?.summary?.engagement_rate || 0) * 2)}%`,
								background: getHealthColor(analytics()?.summary?.engagement_rate || 0),
							}}
						/>
					</div>
				</div>

				{/* ═══════ STATS GRID ═══════ */}
				<div class="grid grid-cols-2 gap-3.5">
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[24px] p-4.5 flex flex-col justify-center transition-all shadow-sm group relative overflow-hidden">
						<div class="absolute -right-4 -top-4 w-16 h-16 bg-[#3390ec]/10 blur-xl rounded-full pointer-events-none" />
						<span class="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1 relative z-10">{t('channelDashboard.totalViews')}</span>
						<div class="text-[26px] font-black text-white font-mono tracking-tight drop-shadow-sm relative z-10">
							{(analytics()?.summary?.total_views || 0).toLocaleString()}
						</div>
						<div class="text-[10px] font-bold text-[#3390ec] mt-1 uppercase tracking-wider relative z-10 bg-[#3390ec]/10 w-fit px-1.5 py-0.5 rounded-[4px] border border-[#3390ec]/20">{t('channelDashboard.viewsThisWeek')}</div>
					</div>

					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[24px] p-4.5 flex flex-col justify-center transition-all shadow-sm group relative overflow-hidden">
						<div class="absolute -left-4 -top-4 w-16 h-16 bg-[#10b981]/10 blur-xl rounded-full pointer-events-none" />
						<span class="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1 relative z-10">{t('channelDashboard.postsToday')}</span>
						<div class="text-[26px] font-black text-white font-mono tracking-tight drop-shadow-sm relative z-10">
							{analytics()?.summary?.posts_today || 0}
						</div>
						<div class="text-[10px] font-bold text-[#10b981] mt-1 uppercase tracking-wider relative z-10 bg-[#10b981]/10 w-fit px-1.5 py-0.5 rounded-[4px] border border-[#10b981]/20">{t('channelDashboard.published')}</div>
					</div>
				</div>

				{/* ═══════ ADMIN ACTIVITY ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-3 shadow-sm">
					<h3 class="text-[11px] font-black text-white/40 uppercase tracking-widest border-b border-white/5 pb-3">{t('channelDashboard.adminActivity')}</h3>
					<div class="flex flex-col pt-1">
						<Show when={auditLogs()?.data?.length === 0}>
							<div class="py-4 text-center text-[11px] font-bold text-white/30 uppercase tracking-widest bg-[#08090D] rounded-[16px] border border-white/5">{t('channelDashboard.noRecentActivity')}</div>
						</Show>
						<For each={auditLogs()?.data?.slice(0, 5) || []}>
							{(log) => (
								<div class="flex items-center justify-between text-[12px] py-3 border-b border-white/5 last:border-0 group hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2">
									<div class="flex items-center gap-3">
										<span class="material-symbols-outlined text-white/30 text-[18px] group-hover:text-[#3390ec] transition-colors">history</span>
										<span class="font-bold text-white/80">{log.action}</span>
									</div>
									<span class="text-[10px] font-mono font-bold text-white/40 bg-[#08090D] border border-white/5 px-2 py-1 rounded-[6px] shadow-inner">
										{log.created_at ? new Date(log.created_at).toLocaleTimeString(isRtl() ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
									</span>
								</div>
							)}
						</For>
					</div>
				</div>
			</div>

			<ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="dashboard" />
		</div>
	);
};
