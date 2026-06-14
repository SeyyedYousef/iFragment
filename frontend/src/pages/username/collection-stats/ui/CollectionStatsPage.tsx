import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { useCollectionStats } from '@/entities/username/api/index.js';
import { formatNumber, useI18n } from '@/shared/i18n/index.js';

export const CollectionStatsPage: Component = () => {
	const navigate = useNavigate();
	const stats = useCollectionStats();
	const { t, locale } = useI18n();
	const [timeText, setTimeText] = createSignal('');

	createEffect(() => {
		backButton.show();
		const unsubscribe = backButton.onClick(() => {
			if (window.history.length > 1) navigate(-1);
			else navigate('/');
		});
		onCleanup(() => {
			unsubscribe();
			backButton.hide();
		});
	});

	createEffect(() => {
		const updateTime = () => {
			const data = stats.data;
			if (!data?.last_updated_at || !data.next_update_at) {
				setTimeText('');
				return;
			}

			const now = Math.floor(Date.now() / 1000);
			const elapsedSec = now - data.last_updated_at;
			const remainingSec = data.next_update_at - now;

			const elapsedMin = Math.max(0, Math.floor(elapsedSec / 60));
			const remainingMin = Math.max(0, Math.ceil(remainingSec / 60));

			const isFa = locale() === 'fa';
			if (isFa) {
				setTimeText(
					`آخرین آپدیت: ${elapsedMin} دقیقه پیش • آپدیت بعدی: ${remainingMin} دقیقه دیگر`,
				);
			} else {
				setTimeText(`Last updated: ${elapsedMin}m ago • Next update in: ${remainingMin}m`);
			}
		};

		updateTime();
		const interval = setInterval(updateTime, 30000);
		onCleanup(() => clearInterval(interval));
	});

	const normalizeNum = (value: any) => {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	};

	const metric = (
		key:
			| 'totalSupply'
			| 'holders'
			| 'floorPrice'
			| 'totalVolume'
			| 'volume24h'
			| 'activeAuctions'
			| 'salesCount'
			| 'highestSale'
			| 'listedRatio',
	) => {
		if (!stats.data) return 0;
		const values = {
			totalSupply: normalizeNum(stats.data.total_supply),
			holders: normalizeNum(stats.data.holders),
			floorPrice: normalizeNum(stats.data.floor_price),
			totalVolume: normalizeNum(stats.data.total_volume),
			volume24h: normalizeNum(stats.data.daily_volume),
			activeAuctions: normalizeNum(stats.data.active_auctions),
			salesCount: normalizeNum(stats.data.sales_count),
			highestSale: normalizeNum(stats.data.highest_sale),
			listedRatio: normalizeNum(stats.data.listed_ratio),
		};
		return values[key] || 0;
	};

	const marketCap = () => metric('totalSupply') * metric('floorPrice');
	const distribution = () => stats.data?.distribution;
	const topHolders = () => stats.data?.top_holders || [];
	const topSales = () => stats.data?.top_sales || [];

	return (
		<div class="min-h-screen bg-[#0a0b0e] text-white p-6 pb-32 safe-area-bottom font-sans">
			<Motion.div
				initial={{ opacity: 0, scale: 0.98 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.5, easing: [0.23, 1, 0.32, 1] }}
				class="max-w-4xl mx-auto"
			>
				<Show when={stats.isLoading}>
					<div class="fixed top-0 left-0 w-full h-1 bg-white/10 z-50" aria-live="polite">
						<div class="h-full bg-[#3390ec] animate-pulse w-1/3" />
					</div>
				</Show>

				<Show when={stats.isError || (!stats.isLoading && !stats.data)}>
					<div class="bg-orange-500/10 border border-orange-500/20 text-orange-400 p-3 rounded-xl text-xs text-center font-bold mb-6">
						Collection stats are temporarily unavailable.
					</div>
				</Show>

				<div class="text-center mb-8 relative">
					<div class="inline-block px-4 py-1.5 rounded-full bg-[#3390ec]/10 border border-[#3390ec]/20 text-[#3390ec] text-[10px] font-black uppercase tracking-widest mb-4">
						Global Analytics
					</div>
					<h1 class="text-3xl font-black tracking-tight text-white mb-2">
						{t('action.username.collection_stats_title')}
					</h1>
					<p class="text-[#a6a6ad] text-sm font-medium mb-3">
						{t('action.username.collection_stats_subtitle')}
					</p>
					<Show when={timeText()}>
						<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 text-[10px] font-bold">
							<span class="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse" />
							{timeText()}
						</div>
					</Show>
				</div>

				<Show when={stats.data}>
					<div class="grid grid-cols-2 gap-3 mb-4">
						<div
							class="bg-[#141518] border border-[#2a2a2a] p-5 rounded-3xl col-span-2"
							role="region"
							aria-label="Market Cap"
						>
							<span class="text-[10px] text-[#a6a6ad] font-black uppercase tracking-widest">
								{t('action.username.marketCap')}
							</span>
							<div class="flex items-baseline gap-1 mt-1">
								<span class="text-4xl font-black text-white">
									{(marketCap() / 1e6).toFixed(1)}M
								</span>
								<span class="text-sm text-[#3390ec] font-bold">TON</span>
							</div>
						</div>

						<MetricCard
							label={t('action.username.floorPrice')}
							value={`${metric('floorPrice').toFixed(2)} TON`}
						/>
						<MetricCard
							label={t('action.username.volume24h')}
							value={`${formatNumber(metric('volume24h'))} TON`}
						/>
						<MetricCard
							label={t('action.username.totalVolume')}
							value={`${(metric('totalVolume') / 1e6).toFixed(1)}M TON`}
						/>
						<MetricCard
							label={t('action.username.activeAuctions')}
							value={formatNumber(metric('activeAuctions'))}
							accent="text-orange-400"
						/>
					</div>

					<div class="bg-[#141518] border border-[#2a2a2a] p-5 rounded-[24px] mb-4 space-y-4">
						<h3 class="text-[#a6a6ad] text-xs font-black uppercase tracking-widest flex items-center gap-2 border-b border-[#2a2a2a] pb-3">
							<span class="material-symbols-outlined text-[16px]">database</span> Supply & Activity
						</h3>
						<Row
							label={t('action.username.totalSupply')}
							value={formatNumber(metric('totalSupply'))}
						/>
						<Row label={t('action.username.holders')} value={formatNumber(metric('holders'))} />
						<Row
							label={t('action.username.listedRatio')}
							value={`${(metric('listedRatio') * 100).toFixed(2)}%`}
							accent="text-[#3390ec]"
						/>
						<Row
							label={t('action.username.totalSales')}
							value={formatNumber(metric('salesCount'))}
						/>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
						<Leaderboard
							title={t('action.username.whaleWatch')}
							icon="account_balance_wallet"
							accent="text-[#3390ec]"
							empty="No holder data available yet."
							hasData={topHolders().length > 0}
						>
							<ForHolders holders={topHolders()} />
						</Leaderboard>

						<Leaderboard
							title={t('action.username.allTimeHigh')}
							icon="military_tech"
							accent="text-[#34c759]"
							empty="No sale leaderboard data available yet."
							hasData={topSales().length > 0}
						>
							<For each={topSales().slice(0, 5)}>
								{(sale) => (
									<div class="flex items-center justify-between p-3 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a]">
										<span class="text-sm font-black text-white">
											{sale.username
												? sale.username.startsWith('@')
													? sale.username
													: `@${sale.username}`
												: 'Anonymous'}
										</span>
										<div class="text-right">
											<div class="font-black text-[#34c759] text-xs">
												{formatNumber(Number(sale.price || 0))} TON
											</div>
											<Show when={sale.date}>
												<div class="text-[10px] text-[#a6a6ad] font-bold">
													{new Date(
														typeof sale.date === 'number' && sale.date < 10000000000
															? sale.date * 1000
															: sale.date,
													).toLocaleDateString('en-US')}
												</div>
											</Show>
										</div>
									</div>
								)}
							</For>
						</Leaderboard>
					</div>

					<div class="bg-[#141518] border border-[#2a2a2a] p-5 rounded-[24px]">
						<h3 class="text-[#a6a6ad] text-xs font-black uppercase tracking-widest mb-4">
							{t('action.username.holdersDistribution')}
						</h3>
						<div class="h-2 w-full bg-[#1c1c1c] rounded-full overflow-hidden flex mb-4">
							<div
								class="h-full bg-[#3390ec]"
								style={{ width: `${Number(distribution()?.single || 0)}%` }}
								title="1 Item"
							/>
							<div
								class="h-full bg-blue-600"
								style={{ width: `${Number(distribution()?.small || 0)}%` }}
								title="2-5 Items"
							/>
							<div
								class="h-full bg-cyan-500"
								style={{ width: `${Number(distribution()?.medium || 0)}%` }}
								title="6-24 Items"
							/>
							<div
								class="h-full bg-teal-500"
								style={{ width: `${Number(distribution()?.large || 0)}%` }}
								title="25-50 Items"
							/>
							<div
								class="h-full bg-orange-500"
								style={{ width: `${Number(distribution()?.whale || 0)}%` }}
								title="50+ Items"
							/>
						</div>
						<div class="grid grid-cols-2 gap-2 text-[10px] font-bold">
							<DistributionItem
								label={t('action.username.dist1')}
								color="bg-[#3390ec]"
								value={distribution()?.single || 0}
							/>
							<DistributionItem
								label={t('action.username.dist2_5')}
								color="bg-blue-600"
								value={distribution()?.small || 0}
							/>
							<DistributionItem
								label={t('action.username.dist6_24')}
								color="bg-cyan-500"
								value={distribution()?.medium || 0}
							/>
							<DistributionItem
								label={t('action.username.dist25_50')}
								color="bg-teal-500"
								value={distribution()?.large || 0}
							/>
							<DistributionItem
								label={t('action.username.dist50_plus')}
								color="bg-orange-500"
								value={distribution()?.whale || 0}
								wide
							/>
						</div>
					</div>
				</Show>
			</Motion.div>
		</div>
	);
};

const MetricCard: Component<{ label: string; value: string; accent?: string }> = (props) => (
	<div class="bg-[#141518] border border-[#2a2a2a] p-4 rounded-2xl">
		<span class="text-[10px] text-[#a6a6ad] font-black uppercase tracking-widest">
			{props.label}
		</span>
		<div class={`text-xl font-black mt-1 ${props.accent || 'text-white'}`}>{props.value}</div>
	</div>
);

const Row: Component<{ label: string; value: string; accent?: string }> = (props) => (
	<div class="flex items-center justify-between py-1">
		<span class="text-sm font-medium text-[#a6a6ad]">{props.label}</span>
		<span class={`text-sm font-black ${props.accent || 'text-white'}`}>{props.value}</span>
	</div>
);

const Leaderboard: Component<{
	title: string;
	icon: string;
	accent: string;
	empty: string;
	hasData?: boolean;
	children: any;
}> = (props) => (
	<div class="bg-[#141518] border border-[#2a2a2a] p-5 rounded-[24px]">
		<h3
			class={`${props.accent} text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2`}
		>
			<span class="material-symbols-outlined text-[16px]">{props.icon}</span>
			{props.title}
		</h3>
		<div class="space-y-3">
			<Show
				when={props.hasData ?? true}
				fallback={<p class="text-xs font-bold text-[#a6a6ad]">{props.empty}</p>}
			>
				{props.children}
			</Show>
		</div>
	</div>
);

const ForHolders: Component<{ holders: Array<{ address: string; count: number }> }> = (props) => (
	<For each={props.holders?.slice(0, 5) || []}>
		{(holder, idx) => (
			<div class="flex items-center justify-between p-3 rounded-2xl bg-[#1c1c1c] border border-[#2a2a2a]">
				<div class="flex items-center gap-3">
					<div class="w-6 h-6 rounded-full bg-[#3390ec]/20 text-[#3390ec] flex items-center justify-center text-xs font-black">
						{idx() + 1}
					</div>
					<span class="text-xs font-bold text-white font-mono">
						{holder.address
							? `${holder.address.slice(0, 6)}...${holder.address.slice(-4)}`
							: 'Unknown'}
					</span>
				</div>
				<div class="text-xs font-black text-white">{formatNumber(Number(holder.count || 0))}</div>
			</div>
		)}
	</For>
);

const DistributionItem: Component<{
	label: string;
	color: string;
	value: number | string;
	wide?: boolean;
}> = (props) => (
	<div
		class={`flex items-center justify-between px-2 py-1.5 bg-[#1c1c1c] rounded-lg ${props.wide ? 'col-span-2' : ''}`}
	>
		<span class="flex items-center gap-1.5 text-[#a6a6ad]">
			<span class={`w-1.5 h-1.5 rounded-full ${props.color}`} />
			{props.label}
		</span>
		<span class="text-white">{Number(props.value || 0).toFixed(1)}%</span>
	</div>
);
