import { Motion } from '@motionone/solid';
import { useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	Component,
	createMemo,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { ChannelContextBar } from '@/shared/ui/ChannelContextBar.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { haptic } from '@/shared/lib/haptic.js';

export const ChannelAnalyticsPage: Component = () => {
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [timeRange, setTimeRange] = createSignal('30d');
	const [showCiModal, setShowCiModal] = createSignal(false);

	const [analytics] = createResource(
		() => ({ id: params.id, range: timeRange() }),
		({ id, range }) => {
			const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
			return channelApi.getAnalytics(id, days);
		},
	);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			haptic.impact('light');
			window.history.back();
		});
		onCleanup(() => off());
	});

	const timeline = createMemo(() => analytics()?.timeline || []);

	const growthData = createMemo(() => {
		const arr = timeline().map((t: any) => t.subscribers_count);
		return arr.length > 0 ? arr : [0];
	});

	const postViewsData = createMemo(() => {
		const arr = timeline().map((t: any) => t.views_count);
		return arr.length > 0 ? arr : [0];
	});

	const getErrColor = (err: number) => {
		if (err > 5) return 'text-[#10b981]';
		if (err >= 2) return 'text-amber-400';
		return 'text-[#ff4a4a]';
	};

	const getErrBg = (err: number) => {
		if (err > 5) return 'bg-[#10b981]/10 border-[#10b981]/20';
		if (err >= 2) return 'bg-amber-400/10 border-amber-400/20';
		return 'bg-[#ff4a4a]/10 border-[#ff4a4a]/20';
	};

	const maxGrowth = createMemo(() => Math.max(1, ...growthData()));
	const maxViews = createMemo(() => Math.max(1, ...postViewsData()));

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-[#06b6d4]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => { haptic.impact('light'); window.history.back(); }}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
							{t('channelAnalytics.analyticsAndStats')}
						</h1>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider truncate mt-0.5">
							{t('channelAnalytics.deepDive')}
						</span>
					</div>
				</div>

				<button
					onClick={() => setIsMenuOpen(true)}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 shadow-sm text-white/80"
					aria-label={t('common.toggle')}
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="analytics" />

			<div class="px-5 pt-5 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
				
				<ChannelContextBar channelId={params.id} />

				{/* ═══════ TIME RANGE SELECTOR ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[16px] p-1.5 flex gap-1 shadow-sm mt-1">
					<For each={['7d', '30d', '90d']}>
						{(range) => (
							<button
								onClick={() => { haptic.selection(); setTimeRange(range); }}
								class={`flex-1 h-10 rounded-[12px] text-[12px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center ${
									timeRange() === range
										? 'bg-[#3390ec] text-white shadow-[0_2px_10px_rgba(51,144,236,0.3)]'
										: 'bg-transparent text-white/40 hover:text-white/80'
								}`}
							>
								{range === '7d' ? t('channelAnalytics.range7d') : range === '30d' ? t('channelAnalytics.range30d') : t('channelAnalytics.range90d')}
							</button>
						)}
					</For>
				</div>

				{/* ═══════ KPI CARDS ═══════ */}
				<div class="grid grid-cols-2 gap-3.5">
					
					{/* ERR Card */}
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[24px] p-4.5 flex flex-col justify-center transition-all shadow-sm group">
						<div class="flex items-center gap-2 mb-2">
							<div class={`w-8 h-8 rounded-[10px] flex items-center justify-center border shadow-inner ${getErrBg(analytics()?.summary?.engagement_rate ?? 0)}`}>
								<span class={`material-symbols-outlined text-[16px] ${getErrColor(analytics()?.summary?.engagement_rate ?? 0)}`}>trending_up</span>
							</div>
							<span class="text-[10px] font-black uppercase tracking-widest text-white/40">{t('channelAnalytics.errRate')}</span>
						</div>
						<h3 class={`text-[28px] font-black font-mono tracking-tight drop-shadow-sm ${getErrColor(analytics()?.summary?.engagement_rate ?? 0)}`}>
							{analytics()?.summary?.engagement_rate ?? 0}%
						</h3>
					</div>

					{/* Citation Index Card */}
					<button
						onClick={() => { haptic.impact('light'); setShowCiModal(true); }}
						class="bg-[#12141C]/80 backdrop-blur-xl border border-[#06b6d4]/20 hover:border-[#06b6d4]/40 rounded-[24px] p-4.5 flex flex-col justify-center transition-all shadow-[0_4px_20px_rgba(6,182,212,0.05)] text-start relative overflow-hidden group active:scale-95"
					>
						<div class="absolute -right-6 -top-6 w-20 h-20 bg-[#06b6d4]/10 blur-xl rounded-full pointer-events-none" />
						<div class="flex items-center gap-2 mb-2 relative z-10">
							<div class="w-8 h-8 rounded-[10px] bg-[#06b6d4]/10 flex items-center justify-center border border-[#06b6d4]/30 shadow-inner shrink-0">
								<span class="material-symbols-outlined text-[#06b6d4] text-[16px]">workspace_premium</span>
							</div>
							<span class="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1">{t('channelAnalytics.citationIndex')} <span class="material-symbols-outlined text-[14px]">info</span></span>
						</div>
						<div class="flex items-end gap-2 relative z-10">
							<h3 class="text-[28px] font-black font-mono text-white tracking-tight drop-shadow-sm">{analytics()?.summary?.citation_index || 'A+'}</h3>
							<span class="text-[10px] font-black text-[#06b6d4] bg-[#06b6d4]/10 px-2 py-0.5 rounded-[6px] border border-[#06b6d4]/20 uppercase tracking-widest mb-1 shadow-sm">TOP 5%</span>
						</div>
					</button>

					{/* ═══════ GROWTH CHART ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} class="col-span-2 bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
						<div class="absolute -left-10 -top-10 w-32 h-32 bg-[#10b981]/10 blur-3xl rounded-full pointer-events-none" />
						
						<div class="flex items-center justify-between relative z-10">
							<div class="flex flex-col gap-0.5">
								<span class="text-[11px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5"><span class="material-symbols-outlined text-[#10b981] text-[16px]">groups</span> {t('channelAnalytics.memberGrowth')}</span>
								<div class="flex items-end gap-2.5">
									<h3 class="text-[26px] font-black text-white font-mono tracking-tight drop-shadow-sm">+{(analytics()?.summary?.new_members || 0).toLocaleString()}</h3>
									<Show when={analytics()?.summary?.new_members_today}>
										<span class="text-[10px] font-black text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded-[6px] border border-[#10b981]/20 uppercase tracking-widest mb-1.5 shadow-sm">+{analytics()?.summary?.new_members_today || 0} {t('channelAnalytics.today')}</span>
									</Show>
								</div>
							</div>
						</div>

						<div class="h-[100px] w-full flex items-end gap-1.5 relative z-10 border-b border-white/5 pb-1">
							<For each={growthData()}>
								{(point) => (
									<div class="flex-1 flex flex-col justify-end h-full group">
										<div class="w-full bg-gradient-to-t from-[#10b981]/20 to-[#10b981]/60 group-hover:to-[#10b981] transition-all duration-300 rounded-t-[4px] rounded-b-[2px]" style={{ height: `${Math.max(4, (point / maxGrowth()) * 100)}%` }} />
									</div>
								)}
							</For>
						</div>
					</Motion.div>

					{/* ═══════ VIEWS CHART ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} class="col-span-2 bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
						<div class="absolute -right-10 -bottom-10 w-32 h-32 bg-[#3390ec]/10 blur-3xl rounded-full pointer-events-none" />
						
						<div class="flex items-center justify-between relative z-10">
							<div class="flex flex-col gap-0.5">
								<span class="text-[11px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5"><span class="material-symbols-outlined text-[#3390ec] text-[16px]">visibility</span> {t('channelAnalytics.avgViewsPerPost')}</span>
								<h3 class="text-[26px] font-black text-white font-mono tracking-tight drop-shadow-sm">{(analytics()?.summary?.total_views || 0).toLocaleString()}</h3>
							</div>
						</div>

						<div class="h-[100px] w-full flex items-end gap-2 relative z-10 border-b border-white/5 pb-1">
							<For each={postViewsData()}>
								{(views) => (
									<div class="flex-1 flex flex-col justify-end h-full group">
										<div class="w-full bg-gradient-to-t from-[#3390ec]/20 to-[#3390ec]/60 group-hover:to-[#3390ec] transition-all duration-300 rounded-t-[4px] rounded-b-[2px]" style={{ height: `${Math.max(4, (views / maxViews()) * 100)}%` }} />
									</div>
								)}
							</For>
						</div>
					</Motion.div>

				</div>
			</div>

			{/* ═══════ CITATION INDEX MODAL (Bottom Sheet) ═══════ */}
			<Show when={showCiModal()}>
				<div class="fixed inset-0 z-[9990] bg-[#030303]/90 backdrop-blur-2xl flex items-end justify-center px-2 pb-2" onClick={(e) => { if (e.target === e.currentTarget) setShowCiModal(false); }}>
					<Motion.div initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.35, easing: [0.32, 0.72, 0, 1] }} class="w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar bg-[#12141C] border border-white/10 rounded-[32px] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative">
						<div class="absolute -top-10 -right-10 w-40 h-40 bg-[#06b6d4]/15 blur-3xl rounded-full pointer-events-none" />
						
						<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

						<div class="flex items-center gap-3.5 mb-5 relative z-10">
							<div class="w-12 h-12 rounded-[16px] bg-[#06b6d4]/10 border border-[#06b6d4]/30 flex items-center justify-center shadow-inner shrink-0">
								<span class="material-symbols-outlined text-[#06b6d4] text-[24px]">workspace_premium</span>
							</div>
							<h3 class="text-[18px] font-black text-white tracking-tight">{t('channelAnalytics.ciModalTitle')}</h3>
						</div>

						<p class="text-[13px] text-white/50 leading-relaxed font-medium mb-6 relative z-10">
							{t('channelAnalytics.ciModalDesc')}
						</p>

						<div class="bg-[#08090D] border border-white/5 rounded-[20px] p-4 flex flex-col gap-3 relative z-10 shadow-inner mb-6">
							<div class="flex items-center justify-between border-b border-white/5 pb-3">
								<span class="text-[11px] font-black uppercase tracking-widest text-white/40">{t('channelAnalytics.currentRank')}</span>
								<span class="text-[12px] font-black text-[#06b6d4] bg-[#06b6d4]/10 px-2.5 py-1 rounded-[8px] border border-[#06b6d4]/20 shadow-sm uppercase tracking-widest">TOP 5%</span>
							</div>
							<div class="flex items-center justify-between pt-1">
								<span class="text-[11px] font-black uppercase tracking-widest text-white/40">{t('channelAnalytics.qualityClass')}</span>
								<span class="text-[12px] font-black text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-[8px] border border-[#10b981]/20 shadow-sm uppercase tracking-widest">{t('channelAnalytics.qualityValue')}</span>
							</div>
						</div>

						<button onClick={() => setShowCiModal(false)} class="w-full h-14 bg-white/5 hover:bg-white/10 active:scale-95 text-white rounded-[16px] font-black text-[13px] uppercase tracking-widest transition-all relative z-10 border border-white/10">
							{t('channelAnalytics.gotIt')}
						</button>
					</Motion.div>
				</div>
			</Show>
		</div>
	);
};
