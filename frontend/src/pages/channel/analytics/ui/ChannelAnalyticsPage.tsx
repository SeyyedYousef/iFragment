import { Motion } from '@motionone/solid';
import { useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { t } from '@/shared/i18n/index.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';

export const ChannelAnalyticsPage: Component = () => {
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	const [timeRange, setTimeRange] = createSignal('30d');
	const [competitorInput, setCompetitorInput] = createSignal('');
	const [isComparing, setIsComparing] = createSignal(false);

	const [analytics] = createResource(
		() => ({ id: params.id, range: timeRange() }),
		({ id, range }) => {
			const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
			return channelApi.getAnalytics(id, days);
		},
	);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => window.history.back());
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

	const geoDistribution = [
		{ country: 'Iran', percent: 65, color: '#34c759' },
		{ country: 'USA', percent: 15, color: '#32ade6' },
		{ country: 'Germany', percent: 10, color: '#ffcc00' },
		{ country: 'UK', percent: 6, color: '#ff3b30' },
		{ country: 'Other', percent: 4, color: '#8e8e93' },
	];

	const similarChannels = [
		{ name: 'Tech Daily', members: '120k', match: '95%' },
		{ name: 'Crypto News', members: '85k', match: '88%' },
		{ name: 'Web Dev Pro', members: '40k', match: '82%' },
	];

	const getErrColor = (err: number) => {
		if (err > 5) return 'text-[#34c759]';
		if (err >= 2) return 'text-[#ffcc00]';
		return 'text-[#ff3b30]';
	};

	const maxGrowth = createMemo(() => Math.max(1, ...growthData()));
	const maxViews = createMemo(() => Math.max(1, ...postViewsData()));

	return (
		<div class="min-h-screen bg-[#0f1014] pb-28 relative overflow-x-hidden text-white">
			{/* Header */}
			<div class="px-5 pt-6 pb-4 bg-[#0f1014] sticky top-0 z-30 border-b border-[#1c1c1c] flex items-center justify-between gap-3">
				<div class="flex items-center gap-2 overflow-hidden flex-1">
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
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[18px] font-black text-white leading-tight truncate">
							{t('channelAnalytics.analyticsAndStats') || 'Advanced Analytics'}
						</h1>
						<span class="text-[12px] text-on-surface-variant truncate">
							{t('channelAnalytics.deepDive') || 'Deep dive into channel metrics'}
						</span>
					</div>
				</div>

				<button
					onClick={() => setIsMenuOpen(true)}
					class="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center border border-[#2a2a2a] hover:bg-[#2a2a2a] active:scale-95 transition-all shrink-0"
				>
					<span class="material-symbols-outlined text-white text-[20px]">menu</span>
				</button>
			</div>

			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="analytics"
			/>

			<div class="px-5 pt-6 flex flex-col gap-6">
				{/* Time Range Selector */}
				<div class="flex bg-[#1c1c1c] p-1 rounded-xl border border-[#2a2a2a]">
					<For each={['7d', '30d', '90d', 'Custom']}>
						{(range) => (
							<button
								onClick={() => {
									hapticFeedback.selectionChanged();
									setTimeRange(range);
								}}
								class={`flex-1 py-1.5 text-[13px] font-bold rounded-lg transition-colors ${timeRange() === range ? 'bg-[#2c2c2e] text-white shadow-sm' : 'text-[#8e8e93] hover:text-white'}`}
							>
								{range === '7d'
									? t('channelAnalytics.range7d')
									: range === '30d'
										? t('channelAnalytics.range30d')
										: range === '90d'
											? t('channelAnalytics.range90d')
											: t('channelAnalytics.rangeCustom')}
							</button>
						)}
					</For>
				</div>

				<div class="grid grid-cols-2 gap-3">
					{/* ERR Card */}
					<div class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-1">
						<span class="material-symbols-outlined text-[#8e8e93] text-[20px] mb-1">
							trending_up
						</span>
						<h3
							class={`text-2xl font-black ${getErrColor(analytics()?.summary?.engagement_rate ?? 0)}`}
						>
							{analytics()?.summary?.engagement_rate ?? 0}%
						</h3>
						<p class="text-[11px] text-[#8e8e93] font-medium">
							{t('channelAnalytics.avgEngagement') || 'Engagement Rate'}
						</p>
					</div>

					{/* Citation Index Card */}
					<div class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-1 relative overflow-hidden">
						<div class="absolute -right-4 -top-4 w-16 h-16 bg-[#bf5af2]/10 rounded-full blur-xl"></div>
						<span class="material-symbols-outlined text-[#bf5af2] text-[20px] mb-1">
							workspace_premium
						</span>
						<div class="flex items-end gap-2">
							<h3 class="text-2xl font-black text-white">{analytics()?.summary?.citation_index || 'A+'}</h3>
							<span class="text-[12px] font-bold text-[#bf5af2] mb-1">Top 5%</span>
						</div>
						<p class="text-[11px] text-[#8e8e93] font-medium">
							{t('channelAnalytics.citationIndex')}
						</p>
					</div>

					{/* Member Growth Line Chart */}
					<div class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-2 col-span-2">
						<div class="flex items-center justify-between">
							<div class="flex flex-col">
								<span class="text-[11px] text-[#8e8e93] font-medium">
									{t('channelAnalytics.followersGrowth') || 'Member Growth'}
								</span>
								<div class="flex items-end gap-2">
									<h3 class="text-2xl font-black text-white">+{analytics()?.summary?.new_members || 0}</h3>
									<Show when={analytics()?.summary?.new_members_today}>
										<span class="text-[12px] font-bold text-[#34c759] mb-1">
											+{analytics()?.summary?.new_members_today} today
										</span>
									</Show>
								</div>
							</div>
							<span class="material-symbols-outlined text-[#34c759] text-[20px]">groups</span>
						</div>

						<div class="h-16 w-full flex items-end gap-1 mt-2">
							<For each={growthData()}>
								{(point) => (
									<div
										class="flex-1 bg-[#34c759]/20 hover:bg-[#34c759] transition-colors rounded-t-sm"
										style={{ height: `${(point / maxGrowth()) * 100}%` }}
									></div>
								)}
							</For>
						</div>
					</div>

					{/* Views Per Post Bar Chart */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
						class="bg-[#1c1c1c] rounded-3xl border border-[#2a2a2a] p-4 flex flex-col gap-2 col-span-2"
					>
						<div class="flex items-center justify-between">
							<div class="flex flex-col">
								<span class="text-[11px] text-[#8e8e93] font-medium">
									{t('channelAnalytics.viewsPerPostAvg') || 'Views Per Post (Avg)'}
								</span>
								<h3 class="text-2xl font-black text-white">
									{analytics()?.summary?.total_views || 0}
								</h3>
							</div>
							<span class="material-symbols-outlined text-[#32ade6] text-[20px]">visibility</span>
						</div>

						<div class="h-24 w-full flex items-end gap-2 justify-between mt-2">
							<For each={postViewsData()}>
								{(views, idx) => (
									<div class="flex flex-col items-center gap-1 flex-1">
										<div
											class="w-full bg-[#32ade6]/20 hover:bg-[#32ade6] transition-colors rounded-t-sm relative group"
											style={{ height: `${(views / maxViews()) * 100}%` }}
										>
											<div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#2c2c2e] px-2 py-0.5 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
												{views} views
											</div>
										</div>
									</div>
								)}
							</For>
						</div>
					</Motion.div>

					{/* Best Posting Time */}
					<div class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-1 col-span-2 relative overflow-hidden">
						<div class="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#32ade6]/10 to-transparent pointer-events-none"></div>
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-full bg-[#32ade6]/20 flex items-center justify-center text-[#32ade6] shrink-0">
								<span class="material-symbols-outlined">schedule</span>
							</div>
							<div class="flex flex-col">
								<span class="text-[13px] font-bold text-white">
									{t('channelAnalytics.bestPostingTime')}
								</span>
								<span class="text-[11px] text-[#8e8e93]">
									{t('channelAnalytics.bestPostingTimeDesc')}
								</span>
							</div>
							<div class="ml-auto text-[18px] font-black text-white">18:30</div>
						</div>
					</div>

					{/* AI Content Analysis */}
					<div class="bg-gradient-to-br from-[#32ade6]/10 to-transparent p-4 rounded-3xl border border-[#32ade6]/30 flex flex-col gap-2 col-span-2">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#32ade6] text-[18px]">auto_awesome</span>
							<span class="text-[14px] font-bold text-white">
								{t('channelAnalytics.contentAnalysis')}
							</span>
						</div>
						<p
							class="text-[13px] text-on-surface-variant leading-relaxed"
							innerHTML={t('channelAnalytics.aiInsightsText')}
						/>
					</div>

					{/* Mentions */}
					<div class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-1">
						<span class="material-symbols-outlined text-[#34c759] text-[20px] mb-1">
							alternate_email
						</span>
						<h3 class="text-2xl font-black text-white">142</h3>
						<p class="text-[11px] text-[#8e8e93] font-medium">{t('channelAnalytics.mentionsIn')}</p>
					</div>
					<div class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-1">
						<span class="material-symbols-outlined text-[#ff3b30] text-[20px] mb-1">
							forward_to_inbox
						</span>
						<h3 class="text-2xl font-black text-white">28</h3>
						<p class="text-[11px] text-[#8e8e93] font-medium">
							{t('channelAnalytics.mentionsOut')}
						</p>
					</div>

					{/* Geographic Distribution */}
					<div class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-4 col-span-2 mt-2">
						<h3 class="text-[15px] font-bold text-white flex items-center gap-2">
							<span class="material-symbols-outlined text-[#8e8e93]">public</span>
							{t('channelAnalytics.geoDistribution')}
						</h3>
						<div class="flex flex-col gap-3">
							<For each={geoDistribution}>
								{(geo) => (
									<div class="flex items-center gap-3">
										<span class="text-[13px] font-medium text-white w-16">
											{geo.country === 'Iran'
												? t('channelAnalytics.geoIran')
												: geo.country === 'USA'
													? t('channelAnalytics.geoUSA')
													: geo.country === 'Germany'
														? t('channelAnalytics.geoGermany')
														: geo.country === 'UK'
															? t('channelAnalytics.geoUK')
															: t('channelAnalytics.geoOther')}
										</span>
										<div class="flex-1 h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
											<div
												class="h-full rounded-full"
												style={{ width: `${geo.percent}%`, 'background-color': geo.color }}
											></div>
										</div>
										<span class="text-[12px] font-bold text-[#8e8e93] w-8 text-right">
											{geo.percent}%
										</span>
									</div>
								)}
							</For>
						</div>
					</div>

					{/* Competitor Compare */}
					<div class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-3 col-span-2 mt-2">
						<h3 class="text-[15px] font-bold text-white flex items-center gap-2">
							<span class="material-symbols-outlined text-[#8e8e93]">compare_arrows</span>
							{t('channelAnalytics.compareCompetitor')}
						</h3>
						<div class="flex gap-2">
							<input
								type="text"
								value={competitorInput()}
								onInput={(e) => setCompetitorInput(e.currentTarget.value)}
								placeholder={t('channelAnalytics.competitorPlaceholder')}
								class="bg-[#2c2c2e] text-white text-[14px] rounded-xl px-4 py-3 flex-1 focus:outline-none focus:ring-2 focus:ring-[#32ade6]"
							/>
							<button
								onClick={() => {
									hapticFeedback.impactOccurred('light');
									setIsComparing(true);
									setTimeout(() => setIsComparing(false), 150);
								}}
								disabled={!competitorInput().trim() || isComparing()}
								class="px-5 bg-[#32ade6] text-black font-bold rounded-xl hover:bg-[#2b96c8] disabled:opacity-50 transition-colors flex items-center justify-center"
							>
								<Show
									when={!isComparing()}
									fallback={
										<span class="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
									}
								>
									{t('channelAnalytics.compare') || 'Compare'}
								</Show>
							</button>
						</div>
					</div>

					{/* Similar Channels */}
					<div class="bg-[#1c1c1c] p-4 rounded-3xl border border-[#2a2a2a] flex flex-col gap-3 col-span-2 mt-2">
						<h3 class="text-[15px] font-bold text-white flex items-center gap-2">
							<span class="material-symbols-outlined text-[#8e8e93]">diversity_3</span>
							{t('channelAnalytics.similarChannels')}
						</h3>
						<div class="flex flex-col gap-2">
							<For each={similarChannels}>
								{(channel) => (
									<div class="flex items-center justify-between p-3 bg-[#2c2c2e] rounded-xl border border-[#3a3a3c]">
										<div class="flex flex-col">
											<span class="text-[14px] font-bold text-white">{channel.name}</span>
											<span class="text-[11px] text-[#8e8e93]">
												{channel.members} {t('channelAdmins.members') || 'members'}
											</span>
										</div>
										<div class="flex flex-col items-end">
											<span class="text-[12px] font-bold text-[#32ade6]">
												{channel.match} {t('channelAnalytics.match') || 'Match'}
											</span>
										</div>
									</div>
								)}
							</For>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
