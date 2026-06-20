import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';

export const ChannelDashboardPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [showTooltip, setShowTooltip] = createSignal(true);

	const [channel] = createResource(
		() => params.id,
		(id) => channelApi.getChannel(id),
	);

	const [analytics] = createResource(
		() => params.id,
		(id) => channelApi.getAnalytics(id, 7),
	);

	const [auditLogs] = createResource(
		() => params.id,
		(id) => channelApi.getAuditLogs(id, 5),
	);

	const [funnel] = createResource(
		() => params.id,
		(id) => channelApi.getFunnel(id),
	);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => window.history.back());
		const timer = setTimeout(() => setShowTooltip(false), 10000);

		onCleanup(() => {
			off();
			clearTimeout(timer);
		});
	});

	const handleMenuOpen = () => {
		setIsMenuOpen(true);
		setShowTooltip(false);
		hapticFeedback.impactOccurred('light');
	};

	const getHealthColor = (rate: number) => {
		if (rate >= 20) return '#34c759'; // High
		if (rate >= 10) return '#ffcc00'; // Med
		return '#ff3b30'; // Low
	};

	const generateSparklinePath = (data: number[] | undefined, width = 100, height = 40) => {
		if (!data || data.length === 0) return `M0,${height / 2} L${width},${height / 2}`;
		const validData = data.map((d) => Number(d)).filter((d) => !Number.isNaN(d));
		if (validData.length === 0) return `M0,${height / 2} L${width},${height / 2}`;
		const max = Math.max(...validData) || 1;
		const min = Math.min(...validData, 0); // Start from 0 to show true scale if possible
		const range = max - min || 1;
		const step = width / (validData.length - 1 || 1);

		return validData
			.map((val, i) => {
				const x = i * step;
				const y = height - ((val - min) / range) * (height * 0.8) - height * 0.1; // 10% padding
				return `${i === 0 ? 'M' : 'L'}${x},${y}`;
			})
			.join(' ');
	};

	return (
		<div class="min-h-screen bg-[#0f1014] pb-24 relative overflow-x-hidden text-white">
			{/* Header */}
			<div class="px-5 pt-6 pb-4 flex items-center justify-between relative z-30 bg-[#0f1014] sticky top-0 border-b border-[#1c1c1c]">
				<div class="flex items-center gap-2 overflow-hidden">
					<button
						onClick={() => {
							hapticFeedback.impactOccurred('light');
							window.history.back();
						}}
						class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-90 transition-all shrink-0"
						aria-label="Back"
					>
						<span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] relative shrink-0">
						<span class="text-sm font-bold text-[#32ade6]">
							{channel()?.chat_title?.charAt(0) || 'C'}
						</span>
						<div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#34c759] border-2 border-[#0f1014] rounded-full"></div>
					</div>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2">
							<h1 class="text-[15px] font-bold text-white leading-tight truncate max-w-[100px]">
								{channel.loading
									? t('channelDashboard.loading')
									: channel()?.chat_title || t('channelMenu.dashboard')}
							</h1>
							<span class="text-[8px] bg-[#34c759]/10 text-[#34c759] px-1 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0">
								{t('channelDashboard.connected')}
							</span>
						</div>
						<span
							class={`text-[9px] font-bold uppercase tracking-wider ${
								channel.loading
									? 'text-[#8e8e93]'
									: channel()?.subscription_status === 'paid'
										? 'text-[#34c759]'
										: 'text-[#ff3b30]'
							}`}
						>
							{channel.loading
								? t('channelDashboard.loading')
								: channel()?.subscription_status || 'free'}
						</span>
					</div>
				</div>

				<div class="relative">
					{/* Tooltip */}
					<Show when={showTooltip()}>
						<Motion.div
							initial={{ opacity: 0, scale: 0.9, y: 10 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9 }}
							class={`absolute top-[120%] w-[180px] bg-[#32ade6] text-black text-[12px] font-bold p-3 rounded-2xl shadow-[0_10px_25px_rgba(255,159,10,0.3)] z-50 flex flex-col gap-2 ${isRtl() ? 'left-0 origin-top-left' : 'right-0 origin-top-right'}`}
						>
							<div
								class={`absolute -top-2 w-4 h-4 bg-[#32ade6] rotate-45 rounded-sm ${isRtl() ? 'left-4' : 'right-4'}`}
							></div>
							<div class="relative z-10 flex items-start justify-between gap-2">
								<span>{t('channelDashboard.tooltipDesc')}</span>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setShowTooltip(false);
									}}
									class="mt-0.5 opacity-80 hover:opacity-100 p-0.5 shrink-0 active:scale-95 transition-transform"
									aria-label="Close tooltip"
								>
									<span class="material-symbols-outlined text-[14px]">close</span>
								</button>
							</div>
						</Motion.div>
					</Show>

					{/* Hamburger Button */}
					<button
						onClick={handleMenuOpen}
						class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-95 transition-all relative"
						aria-label="Open menu"
					>
						<span class="material-symbols-outlined text-white">menu</span>
					</button>
				</div>
			</div>

			{/* Main Content Area */}
			<div class="px-5 pt-6 flex flex-col gap-6">
				{/* Quick Actions */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.02 }}
				>
					<div class="grid grid-cols-3 gap-3">
						<button
							onClick={() => navigate(`/channel/${params.id}/posting`)}
							class="bg-[#1c1c1c] hover:bg-[#2a2a2a] active:scale-95 transition-all border border-[#2a2a2a] rounded-2xl p-3 flex flex-col items-center justify-center gap-2"
						>
							<div class="w-10 h-10 rounded-full bg-[#32ade6]/10 flex items-center justify-center text-[#32ade6]">
								<span class="material-symbols-outlined text-[20px]">edit_square</span>
							</div>
							<span class="text-[11px] font-bold text-white text-center">
								{t('channelDashboard.newPost')}
							</span>
						</button>
						<button
							onClick={() => navigate(`/channel/${params.id}/settings`)}
							class="bg-[#1c1c1c] hover:bg-[#2a2a2a] active:scale-95 transition-all border border-[#2a2a2a] rounded-2xl p-3 flex flex-col items-center justify-center gap-2"
						>
							<div class="w-10 h-10 rounded-full bg-[#34c759]/10 flex items-center justify-center text-[#34c759]">
								<span class="material-symbols-outlined text-[20px]">settings</span>
							</div>
							<span class="text-[11px] font-bold text-white text-center">
								{t('channelDashboard.manageSettings')}
							</span>
						</button>
						<button
							onClick={() => navigate(`/channel/${params.id}/admins`)}
							class="bg-[#1c1c1c] hover:bg-[#2a2a2a] active:scale-95 transition-all border border-[#2a2a2a] rounded-2xl p-3 flex flex-col items-center justify-center gap-2"
						>
							<div class="w-10 h-10 rounded-full bg-[#ff9f0a]/10 flex items-center justify-center text-[#ff9f0a]">
								<span class="material-symbols-outlined text-[20px]">admin_panel_settings</span>
							</div>
							<span class="text-[11px] font-bold text-white text-center">
								{t('channelMenu.admins')}
							</span>
						</button>
					</div>
				</Motion.div>

				{/* Funnel Info Card */}
				<Show when={funnel()}>
					<Motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						class="bg-[#32ade6]/10 border border-[#32ade6]/30 rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden"
					>
						<div class="absolute right-0 top-0 w-24 h-24 bg-[#32ade6]/10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2"></div>
						<span class="material-symbols-outlined text-[#32ade6] mt-0.5 relative z-10">
							filter_alt
						</span>
						<div class="flex flex-col relative z-10">
							<span class="text-[14px] font-bold text-white leading-tight">
								{t('channelDashboard.activeFunnel') || 'Active Publishing Funnel'}
							</span>
							<p class="text-[12px] text-white/80 leading-relaxed mt-1">
								{(t('channelDashboard.activeFunnelDesc') || '').replace('{channelName}', funnel()?.input_title || t('channelDashboard.inputChannelFallback') || 'Input Channel')}
							</p>
						</div>
					</Motion.div>
				</Show>

				{/* Analytics Error State */}
				<Show when={analytics.error}>
					<Motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						class="bg-[#ff3b30]/10 border border-[#ff3b30]/30 rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden"
					>
						<span class="material-symbols-outlined text-[#ff3b30] mt-0.5 relative z-10">
							error
						</span>
						<div class="flex flex-col relative z-10">
							<span class="text-[16px] font-bold text-white">
								{t('channelDashboard.analyticsError') || 'Analytics Load Error'}
							</span>
							<span class="text-[12px] text-[#8e8e93]">
								{t('channelDashboard.analyticsErrorDesc') || 'Failed to load channel analytics data.'}
							</span>
						</div>
					</Motion.div>
				</Show>

				{/* Health Alert Card (T1.9) */}
				<Show when={(analytics()?.summary?.new_members || 0) < 0}>
					<Motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						class="bg-[#ff3b30]/10 border border-[#ff3b30]/30 rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden"
					>
						<div class="absolute right-0 top-0 w-24 h-24 bg-[#ff3b30]/10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2"></div>
						<span class="material-symbols-outlined text-[#ff3b30] mt-0.5 relative z-10">
							warning
						</span>
						<div class="flex flex-col relative z-10">
							<span class="text-[14px] font-bold text-white leading-tight">
								{t('channelDashboard.memberLoss')}
							</span>
							<span class="text-[12px] text-[#ff3b30] leading-snug mt-1">
								{t('channelDashboard.memberLossDesc').replace(
									'{count}',
									String(Math.abs(analytics()?.summary?.new_members || 0)),
								)}
							</span>
						</div>
					</Motion.div>
				</Show>

				{/* Engagement Rate (ERR) Visual Bar + CI Badge */}
				<Motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.05 }}
					class="flex flex-col gap-2"
				>
					<div class="flex items-end justify-between">
						<span class="text-[15px] font-bold text-white flex items-center gap-2">
							<span class="material-symbols-outlined text-[#ff3b30] text-[18px]">favorite</span>
							{t('channelDashboard.healthScore')}
							{/* Citation Index Badge (T1.7) */}
							<span class="bg-[#bf5af2]/20 border border-[#bf5af2]/30 text-[#bf5af2] text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
								CI: {analytics()?.summary?.citation_index || 'N/A'}
							</span>
						</span>
						<span
							class="text-[18px] font-black"
							style={{ color: getHealthColor(analytics()?.summary?.engagement_rate || 0) }}
						>
							{analytics()?.summary?.engagement_rate || 0}%
						</span>
					</div>

					<div class="w-full h-3 bg-[#1c1c1c] rounded-full overflow-hidden border border-[#2a2a2a] flex">
						<div
							class="h-full rounded-full transition-all duration-1000 ease-out relative"
							style={{
								width: `${Math.min(100, (analytics()?.summary?.engagement_rate || 0) * 2)}%`,
								background: `linear-gradient(90deg, #1c1c1c, ${getHealthColor(analytics()?.summary?.engagement_rate || 0)})`,
							}}
						>
							<div class="absolute inset-0 bg-gradient-to-r from-transparent to-white/20"></div>
						</div>
					</div>
					<div class="flex justify-between text-[10px] text-[#8e8e93] font-medium px-1 uppercase tracking-wider">
						<span>{t('channelDashboard.poor')}</span>
						<span>{t('channelDashboard.average')}</span>
						<span>{t('channelDashboard.excellent')}</span>
					</div>
				</Motion.div>

				{/* 24hr Summary (T1.10) */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.08 }}
				>
					<div class="grid grid-cols-3 gap-2">
						<div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl p-2.5 flex flex-col items-center justify-center">
							<span class="text-[16px] font-black text-white">
								{analytics()?.summary?.posts_today || 0}
							</span>
							<span class="text-[10px] text-[#8e8e93] font-medium text-center leading-tight">
								{t('channelDashboard.postsToday')}
							</span>
						</div>
						<div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl p-2.5 flex flex-col items-center justify-center">
							<span
								class={`text-[16px] font-black ${(analytics()?.summary?.new_members_today || 0) >= 0 ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}
							>
								{(analytics()?.summary?.new_members_today || 0) > 0 ? '+' : ''}
								{analytics()?.summary?.new_members_today || 0}
							</span>
							<span class="text-[10px] text-[#8e8e93] font-medium text-center leading-tight">
								{t('channelDashboard.membersToday')}
							</span>
						</div>
						<div class="bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl p-2.5 flex flex-col items-center justify-center">
							<span class="text-[16px] font-black text-white">
								{(analytics()?.summary?.views_today || 0).toLocaleString()}
							</span>
							<span class="text-[10px] text-[#8e8e93] font-medium text-center leading-tight">
								{t('channelDashboard.viewsToday')}
							</span>
						</div>
					</div>
				</Motion.div>

				{/* Stats Grid */}
				<div class="grid grid-cols-2 gap-3">
					{/* Subscribers (T1.11 - Data-driven sparkline) */}
					<Motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
						class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-1 relative overflow-hidden"
					>
						<svg
							class="absolute bottom-0 right-0 w-full h-1/2 opacity-20"
							viewBox="0 0 100 40"
							preserveAspectRatio="none"
						>
							<path
								d={`${generateSparklinePath(analytics()?.timeline?.map((t: any) => t.subscribers_count))} L100,40 L0,40 Z`}
								fill="#34c759"
							/>
							<path
								d={generateSparklinePath(
									analytics()?.timeline?.map((t: any) => t.subscribers_count),
								)}
								fill="none"
								stroke="#34c759"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						<span class="material-symbols-outlined text-[#8e8e93] text-[20px] mb-1 relative z-10">
							group
						</span>
						<h3 class="text-2xl font-black text-white relative z-10">
							{(channel()?.members_count || 0).toLocaleString()}
						</h3>
						<p class="text-[11px] text-[#8e8e93] font-medium flex items-center gap-1 relative z-10">
							{t('managedChannels.subscribers')}
						</p>
					</Motion.div>

					{/* Total Views */}
					<Motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-1 relative overflow-hidden"
					>
						<svg
							class="absolute bottom-0 right-0 w-full h-1/2 opacity-20"
							viewBox="0 0 100 40"
							preserveAspectRatio="none"
						>
							<path
								d={`${generateSparklinePath(analytics()?.timeline?.map((t: any) => t.views_count))} L100,40 L0,40 Z`}
								fill="#3390ec"
							/>
							<path
								d={generateSparklinePath(analytics()?.timeline?.map((t: any) => t.views_count))}
								fill="none"
								stroke="#3390ec"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						<span class="material-symbols-outlined text-[#8e8e93] text-[20px] mb-1 relative z-10">
							visibility
						</span>
						<h3 class="text-2xl font-black text-white relative z-10">
							{(analytics()?.summary?.total_views || 0).toLocaleString()}
						</h3>
						<p class="text-[11px] text-[#8e8e93] font-medium flex items-center gap-1 relative z-10">
							{t('channelDashboard.viewsThisWeek')}
						</p>
					</Motion.div>
				</div>

				{/* Top Posts */}
				<Motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3 }}
					class="flex flex-col gap-3"
				>
					<h2 class="text-[15px] font-bold text-white px-1 flex items-center gap-2">
						<span class="material-symbols-outlined text-[#ff9f0a] text-[18px]">
							local_fire_department
						</span>
						{t('channelDashboard.topPosts')}
					</h2>

					<div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] flex flex-col overflow-hidden">
						<For
							each={analytics()?.summary?.top_posts || []}
							fallback={
								<div class="py-10 text-center text-[#8e8e93] text-[13px]">
									{t('channelDashboard.noPostsData')}
								</div>
							}
						>
							{(post, i) => (
								<div
									class={`flex items-center justify-between p-4 ${i() !== (analytics()?.summary?.top_posts?.length || 0) - 1 ? 'border-b border-[#2a2a2a]' : ''}`}
								>
									<div class="flex items-center gap-3">
										<div
											class={`text-[12px] font-black w-6 h-6 rounded-full flex items-center justify-center ${
												i() === 0 ? 'bg-[#ff9f0a]/20 text-[#ff9f0a]' : 'bg-[#2a2a2a] text-[#8e8e93]'
											}`}
										>
											{i() + 1}
										</div>
										<span class="text-[14px] font-bold text-white truncate max-w-[150px]">
											{post.title}
										</span>
									</div>
									<div class="flex items-center gap-1 text-[#8e8e93]">
										<span class="material-symbols-outlined text-[14px]">visibility</span>
										<span class="text-[12px] font-medium">{post.views?.toLocaleString() ?? 0}</span>
									</div>
								</div>
							)}
						</For>
					</div>
				</Motion.div>

				{/* Recent Admin Logs */}
				<Motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.4 }}
					class="flex flex-col gap-3"
				>
					<h2 class="text-[15px] font-bold text-white px-1 flex items-center gap-2">
						<span class="material-symbols-outlined text-[#bf5af2] text-[18px]">history</span>
						{t('channelDashboard.adminActivity')}
					</h2>

					<div class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-2 flex flex-col">
						<For
							each={auditLogs()?.data || []}
							fallback={
								<div class="py-10 text-center text-[#8e8e93] text-[13px]">
									{t('channelDashboard.noRecentActivity')}
								</div>
							}
						>
							{(log, index) => {
								return (
									<div
										class={`flex items-start gap-3 p-3 ${index() !== (auditLogs()?.data?.length || 0) - 1 ? 'border-b border-[#2a2a2a]' : ''}`}
									>
										<div class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-[#bf5af2]/10 text-[#bf5af2]">
											<span class="material-symbols-outlined text-[16px]">edit_document</span>
										</div>
										<div class="flex flex-col flex-1">
											<div class="flex items-center justify-between mb-0.5">
												<span class="text-[13px] font-bold text-white">
													{log.actor_name || 'Unknown'}
												</span>
												<span class="text-[10px] text-[#8e8e93] font-medium">
													{log.created_at
														? new Date(log.created_at).toLocaleTimeString([], {
																hour: '2-digit',
																minute: '2-digit',
															})
														: ''}
												</span>
											</div>
											<span class="text-[12px] text-[#8e8e93]">{log.action}</span>
										</div>
									</div>
								);
							}}
						</For>
					</div>
				</Motion.div>
			</div>

			{/* Hamburger Menu Drawer */}
			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="dashboard"
			/>
		</div>
	);
};
