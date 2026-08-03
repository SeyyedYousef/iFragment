import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { AdminsLessonCard } from './lessons/AdminsLessonCard.js';
import { AutoResponderLessonCard } from './lessons/AutoResponderLessonCard.js';
import { DynamicBioLessonCard } from './lessons/DynamicBioLessonCard.js';
import { ForwardingLessonCard } from './lessons/ForwardingLessonCard.js';
import { FunnelLessonCard } from './lessons/FunnelLessonCard.js';
import { InlineButtonsLessonCard } from './lessons/InlineButtonsLessonCard.js';
import { PostingLessonCard } from './lessons/PostingLessonCard.js';
import { haptic } from '@/shared/lib/haptic.js';

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
	const [funnel] = createResource(() => params.id, (id) => channelApi.getFunnel(id).catch(() => null));
	const [settings] = createResource(() => params.id, (id) => channelApi.getSettings(id).catch(() => null));

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			haptic.impact('light');
			window.history.back();
		});
		const timer = setTimeout(() => setShowTooltip(false), 10000);

		onCleanup(() => {
			off();
			clearTimeout(timer);
			backButton.hide();
		});
	});

	const handleMenuOpen = () => {
		setIsMenuOpen(true);
		setShowTooltip(false);
		haptic.impact('light');
	};

	const learnedFeatures = () => {
		const s = settings();
		const f = funnel();
		return [
			{ key: 'funnel', done: !!f && (f.enabled ?? true) },
			{ key: 'posting', done: true }, // Core feature always ready
			{ key: 'autoResponder', done: !!(s?.auto_responder as any)?.enabled },
			{ key: 'forwarding', done: !!(s as any)?.forwarding_rules?.length },
			{ key: 'dynamicBio', done: !!(s?.dynamic_bio as any)?.enabled },
			{ key: 'inlineButtons', done: !!(s as any)?.inline_buttons?.length },
			{ key: 'admins', done: true },
		];
	};

	const progress = () => {
		const list = learnedFeatures();
		if (!list.length) return 0;
		const completed = list.filter((item) => item.done).length;
		return Math.round((completed / list.length) * 100);
	};

	const isFeatureDone = (key: string) => {
		return learnedFeatures().find((item) => item.key === key)?.done || false;
	};

	const navigateWithFeedback = (path: string) => {
		haptic.impact('light');
		navigate(path);
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#3390ec]/15 via-[#06b6d4]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3 overflow-hidden flex-1">
					<button
						onClick={() => { haptic.impact('light'); window.history.back(); }}
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
							<span class="font-mono">{t('channelDashboard.membersCount', { count: (channel()?.members_count || 0).toLocaleString('en-US') })}</span>
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
										onClick={() => { haptic.impact('light'); setSearchQuery(''); navigate(feat.path); }}
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

				{/* ═══════ HERO: ACADEMY PROGRESS RING ═══════ */}
				<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[28px] p-5 flex items-center gap-4 shadow-sm relative overflow-hidden">
					<div class="absolute -right-8 -top-8 w-28 h-28 bg-[#3390ec]/10 blur-2xl rounded-full pointer-events-none" />
					
					<div class="relative w-16 h-16 shrink-0 flex items-center justify-center">
						<svg viewBox="0 0 64 64" class="w-full h-full -rotate-90">
							<circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6" />
							<circle
								cx="32" cy="32" r="26" fill="none" stroke="#3390ec" stroke-width="6" stroke-linecap="round"
								stroke-dasharray={`${(progress() / 100) * 163} 163`}
								class="transition-all duration-1000 ease-out"
							/>
						</svg>
						<span class="absolute inset-0 flex items-center justify-center text-[13px] font-black font-mono text-white">
							{progress()}%
						</span>
					</div>

					<div class="flex flex-col">
						<h2 class="text-[15px] font-black text-white tracking-tight">{t('lessons.heroTitle')}</h2>
						<p class="text-[11px] text-white/50 font-bold mt-1 leading-relaxed">{t('lessons.heroDesc')}</p>
					</div>
				</div>

				{/* ═══════ 0 TO 100 INTERACTIVE LESSON CARDS ═══════ */}
				<div class="flex flex-col gap-4">
					<FunnelLessonCard
						isDone={isFeatureDone('funnel')}
						onNavigate={() => navigateWithFeedback(`/channel/${params.id}/funnel`)}
					/>

					<PostingLessonCard
						isDone={isFeatureDone('posting')}
						onNavigate={() => navigateWithFeedback(`/channel/${params.id}/posting`)}
					/>

					<AutoResponderLessonCard
						isDone={isFeatureDone('autoResponder')}
						onNavigate={() => navigateWithFeedback(`/channel/${params.id}/auto-responder`)}
					/>

					<ForwardingLessonCard
						isDone={isFeatureDone('forwarding')}
						onNavigate={() => navigateWithFeedback(`/channel/${params.id}/forwarding`)}
					/>

					<DynamicBioLessonCard
						isDone={isFeatureDone('dynamicBio')}
						onNavigate={() => navigateWithFeedback(`/channel/${params.id}/dynamic-bio`)}
					/>

					<InlineButtonsLessonCard
						isDone={isFeatureDone('inlineButtons')}
						onNavigate={() => navigateWithFeedback(`/channel/${params.id}/inline-buttons`)}
					/>

					<AdminsLessonCard
						isDone={isFeatureDone('admins')}
						onNavigate={() => navigateWithFeedback(`/channel/${params.id}/admins`)}
					/>
				</div>

			</div>

			<ChannelHamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} channelId={params.id} activeTab="dashboard" />
		</div>
	);
};
