import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { ColorType, createChart, type IChartApi, LineSeries } from 'lightweight-charts';
import { type Component, createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { DashboardMetrics } from '@/entities/owner/model/types.js';
import { locale } from '@/shared/i18n/index.js';
import { TotpSetupModal } from '@/widgets/owner/TotpSetupModal.jsx';

export const OwnerDashboard: Component = () => {
	const navigate = useNavigate();
	const isFa = () => locale() === 'fa';
	let chartContainerRef: HTMLDivElement | undefined;
	let chartInstance: IChartApi | undefined;

	const [isTotpModalOpen, setIsTotpModalOpen] = createSignal(false);
	const [quickQuery, setQuickQuery] = createSignal('');
	const [quickType, setQuickType] = createSignal<'username' | 'number' | 'gift'>('gift');

	const dashboardQuery = createQuery<DashboardMetrics>(() => ({
		queryKey: ['owner', 'dashboard'],
		queryFn: ownerApi.getDashboardMetrics,
		refetchInterval: 15000,
	}));

	const metrics = () => dashboardQuery.data as DashboardMetrics | undefined;

	const handleQuickInspect = (e: Event) => {
		e.preventDefault();
		const q = quickQuery().trim();
		if (!q) return;
		if (quickType() === 'username' || q.startsWith('@')) {
			const clean = q.replace(/^@/, '');
			navigate(`/username/report?u=${encodeURIComponent(clean)}`);
		} else if (quickType() === 'number' || q.startsWith('+888') || /^888\d+/.test(q)) {
			const clean = q.replace(/[^\d]/g, '');
			navigate(`/numbers/report?n=${encodeURIComponent(clean)}`);
		} else {
			navigate(`/gifts/report?g=${encodeURIComponent(q)}`);
		}
	};

	const inspectAsset = (type: string, query: string) => {
		if (type === 'username') {
			navigate(`/username/report?u=${encodeURIComponent(query.replace(/^@/, ''))}`);
		} else if (type === 'number') {
			navigate(`/numbers/report?n=${encodeURIComponent(query.replace(/[^\d]/g, ''))}`);
		} else if (type === 'portfolio') {
			navigate(`/gifts/portfolio`);
		} else {
			navigate(`/gifts/report?g=${encodeURIComponent(query)}`);
		}
	};

	// Initialize Lightweight Chart when 30-day data loads
	createEffect(() => {
		const data = metrics()?.growth_30d;
		if (!data || !chartContainerRef) return;

		if (chartInstance) {
			chartInstance.remove();
			chartInstance = undefined;
		}

		const chart = createChart(chartContainerRef, {
			layout: {
				background: { type: ColorType.Solid, color: 'transparent' },
				textColor: 'rgba(255, 255, 255, 0.5)',
			},
			grid: {
				vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
				horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
			},
			width: chartContainerRef.clientWidth,
			height: 240,
			timeScale: {
				borderColor: 'rgba(255, 255, 255, 0.1)',
			},
			rightPriceScale: {
				borderColor: 'rgba(255, 255, 255, 0.1)',
			},
		});

		chartInstance = chart;

		const activeSeries = chart.addSeries(LineSeries, {
			color: '#38bdf8',
			lineWidth: 2,
			title: isFa() ? 'کاربران فعال روزانه' : 'Active Users',
		});

		const valuationsSeries = chart.addSeries(LineSeries, {
			color: '#f59e0b',
			lineWidth: 2,
			title: isFa() ? 'استعلام‌های ارزش‌گذاری' : 'Valuations Run',
		});

		const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

		activeSeries.setData(
			sorted.map((d) => ({
				time: d.date,
				value: d.active_users,
			})),
		);

		valuationsSeries.setData(
			sorted.map((d) => ({
				time: d.date,
				value: d.valuations_count ?? d.new_users * 4,
			})),
		);

		chart.timeScale().fitContent();

		const handleResize = () => {
			if (chartContainerRef && chartInstance) {
				chartInstance.applyOptions({ width: chartContainerRef.clientWidth });
			}
		};

		window.addEventListener('resize', handleResize);
		onCleanup(() => {
			window.removeEventListener('resize', handleResize);
			if (chartInstance) {
				chartInstance.remove();
				chartInstance = undefined;
			}
		});
	});

	const totalValsToday = () => metrics()?.valuations_today?.total || 0;
	const pctOfTotal = (part = 0) => {
		const tot = Math.max(1, totalValsToday());
		return Math.round((part / tot) * 100);
	};

	return (
		<div class="space-y-6">
			{/* Top Action Bar & Quick Sovereign Inspector */}
			<div class="rounded-3xl border border-white/10 bg-gradient-to-r from-[#111522] via-[#0e121d] to-[#131726] p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-xl">
				<div class="space-y-1">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-amber-400 text-xl">bolt</span>
						<h2 class="text-base font-black text-white tracking-tight">
							{isFa()
								? 'مرکز فرماندهی و تلمتری زنده ارزش‌گذاری دارایی‌های تلگرام'
								: 'Live Asset Valuation & Credit Intelligence Command'}
						</h2>
					</div>
					<p class="text-xs text-white/50">
						{isFa()
							? 'داده‌های واقعی از ۳ موتور نام کاربری (@)، شماره‌های ناشناس (+888) و گیفت‌های کلکسیونی — بدون هیچ‌گونه دیتای بازی کلیکی'
							: 'Real-time telemetry across @Usernames, +888 Anonymous Numbers & Collectible Gifts'}
					</p>
				</div>

				{/* Quick Asset Valuation Launcher */}
				<form
					onSubmit={handleQuickInspect}
					class="flex flex-wrap sm:flex-nowrap items-center gap-2"
				>
					<div class="flex rounded-xl bg-black/40 border border-white/10 p-1 text-[11px] font-bold">
						<button
							type="button"
							onClick={() => setQuickType('username')}
							class={`px-2.5 py-1 rounded-lg transition ${
								quickType() === 'username'
									? 'bg-sky-500 text-black'
									: 'text-white/60 hover:text-white'
							}`}
						>
							@Username
						</button>
						<button
							type="button"
							onClick={() => setQuickType('number')}
							class={`px-2.5 py-1 rounded-lg transition ${
								quickType() === 'number'
									? 'bg-amber-500 text-black'
									: 'text-white/60 hover:text-white'
							}`}
						>
							+888
						</button>
						<button
							type="button"
							onClick={() => setQuickType('gift')}
							class={`px-2.5 py-1 rounded-lg transition ${
								quickType() === 'gift'
									? 'bg-purple-500 text-white'
									: 'text-white/60 hover:text-white'
							}`}
						>
							🎁 Gift
						</button>
					</div>

					<input
						type="text"
						value={quickQuery()}
						onInput={(e) => setQuickQuery(e.currentTarget.value)}
						placeholder={
							quickType() === 'username'
								? '@durov, @rare...'
								: quickType() === 'number'
									? '+888 8 888...'
									: 'PlushPepe-1, DurovsCap-88...'
						}
						class="h-9 px-3.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono placeholder:text-white/30 focus:border-cyan-400 focus:outline-none min-w-[180px]"
					/>

					<button
						type="submit"
						class="h-9 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs transition flex items-center gap-1.5 shrink-0"
					>
						<span class="material-symbols-outlined text-[16px]">radar</span>
						<span>{isFa() ? 'کالبدشکافی فوری' : 'Inspect'}</span>
					</button>

					<button
						type="button"
						onClick={() => setIsTotpModalOpen(true)}
						class="h-9 px-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs transition flex items-center gap-1.5 shrink-0"
						title="Configure 2FA TOTP"
					>
						<span class="material-symbols-outlined text-[16px]">security</span>
						<span>2FA</span>
					</button>
				</form>
			</div>

			{/* Top 4 Institutional KPI Cards */}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Card 1: Total Users & Active Retention */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2 backdrop-blur-xl">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{isFa() ? 'کل کاربران و اشتراک VIP' : 'Total Users & VIP Pro'}</span>
						<span class="material-symbols-outlined text-base text-sky-400">groups</span>
					</div>
					<div class="text-2xl font-black text-white font-mono">
						{dashboardQuery.isLoading ? '...' : (metrics()?.total_users ?? 0).toLocaleString()}
					</div>
					<div class="flex items-center justify-between text-[11px] text-white/50 pt-1 border-t border-white/5">
						<span>
							DAU: <strong class="text-emerald-400 font-mono">{metrics()?.dau ?? 0}</strong> / MAU:{' '}
							<strong class="text-white font-mono">{metrics()?.mau ?? 0}</strong>
						</span>
						<span class="text-amber-400 font-mono font-bold">
							★ {metrics()?.premium_users ?? 0} VIP
						</span>
					</div>
				</div>

				{/* Card 2: 24h Valuation Engine Throughput */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2 backdrop-blur-xl">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{isFa() ? 'استعلام‌های ارزش‌گذاری (۲۴ ساعت)' : '24h Valuations Executed'}</span>
						<span class="material-symbols-outlined text-base text-purple-400">query_stats</span>
					</div>
					<div class="text-2xl font-black text-purple-300 font-mono">
						{dashboardQuery.isLoading ? '...' : totalValsToday().toLocaleString()}
					</div>
					<div class="flex items-center justify-between text-[11px] font-mono text-white/60 pt-1 border-t border-white/5">
						<span class="text-sky-300">@{metrics()?.valuations_today?.usernames ?? 0}</span>
						<span class="text-amber-300">+888: {metrics()?.valuations_today?.numbers ?? 0}</span>
						<span class="text-purple-300">🎁 {metrics()?.valuations_today?.gifts ?? 0}</span>
					</div>
				</div>

				{/* Card 3: Intel Credits (⚡) & Stars Revenue (⭐) */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2 backdrop-blur-xl">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>
							{isFa() ? 'گردش کریدیت ⚡ و درآمد Stars ⭐' : 'Intel Credits ⚡ & Stars Revenue'}
						</span>
						<span class="material-symbols-outlined text-base text-cyan-400">bolt</span>
					</div>
					<div class="flex items-baseline gap-3">
						<div class="text-2xl font-black text-cyan-400 font-mono">
							⚡{' '}
							{dashboardQuery.isLoading
								? '...'
								: (metrics()?.total_intel_credits_circulation ?? 0).toLocaleString()}
						</div>
						<div class="text-sm font-black text-amber-400 font-mono">
							⭐ {(metrics()?.total_stars_revenue ?? 0).toLocaleString()}
						</div>
					</div>
					<div class="flex items-center justify-between text-[11px] text-white/50 pt-1 border-t border-white/5">
						<span>
							{isFa() ? 'مصرف امروز:' : 'Burned 24h:'}{' '}
							<strong class="text-rose-400 font-mono">
								-{metrics()?.credits_economy_today?.consumed_today ?? 0} ⚡
							</strong>
						</span>
						<span>
							{isFa() ? 'فروش امروز:' : 'Sold 24h:'}{' '}
							<strong class="text-emerald-400 font-mono">
								+{metrics()?.credits_economy_today?.purchased_today ?? 0} ⚡
							</strong>
						</span>
					</div>
				</div>

				{/* Card 4: Live TON/USD Oracle & Ecosystem Floors */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2 backdrop-blur-xl">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{isFa() ? 'نرخ زنده اوراکل TON و کف بازار' : 'Live TON Oracle & Market Floor'}</span>
						<span class="material-symbols-outlined text-base text-emerald-400">currency_exchange</span>
					</div>
					<div class="flex items-baseline gap-2.5">
						<div class="text-2xl font-black text-emerald-400 font-mono">
							${(metrics()?.ton_usd_rate ?? 0).toFixed(2)}
						</div>
						<span class="text-xs text-white/40 font-mono">TON/USD</span>
					</div>
					<div class="flex items-center justify-between text-[11px] font-mono text-white/50 pt-1 border-t border-white/5">
						<span>
							+888 Floor:{' '}
							<strong class="text-amber-300">{metrics()?.nums888_floor_ton ?? 0} TON</strong>
						</span>
						<span>
							Gifts:{' '}
							<strong class="text-purple-300">
								{metrics()?.tracked_gift_collections ?? 105} Cols
							</strong>
						</span>
					</div>
				</div>
			</div>

			{/* Middle Grid: Valuation Engine Breakdown + Hot Searched Assets */}
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
				{/* Left (5 cols): 3-Engine Split & Credit Economy Flow */}
				<div class="lg:col-span-5 rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
					<div class="flex items-center justify-between border-b border-white/10 pb-3">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-cyan-400">donut_large</span>
							<h3 class="text-sm font-bold text-white">
								{isFa()
									? 'سهم موتورهای ارزش‌گذاری و ترازنامه کریدیت ⚡'
									: 'Engine Telemetry & Intel Credit Flow'}
							</h3>
						</div>
						<span class="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
							REAL-TIME
						</span>
					</div>

					{/* 3-Engine Progress Bars */}
					<div class="space-y-3">
						<div>
							<div class="flex justify-between text-xs mb-1">
								<span class="text-sky-300 font-bold">
									@ {isFa() ? 'موتور نام کاربری (Usernames)' : 'Telegram Usernames Engine'}
								</span>
								<span class="font-mono text-white/80">
									{metrics()?.valuations_today?.usernames ?? 0} (
									{pctOfTotal(metrics()?.valuations_today?.usernames)}%)
								</span>
							</div>
							<div class="h-2 rounded-full bg-white/5 overflow-hidden">
								<div
									class="h-full bg-sky-400 transition-all duration-500"
									style={{ width: `${pctOfTotal(metrics()?.valuations_today?.usernames)}%` }}
								/>
							</div>
						</div>

						<div>
							<div class="flex justify-between text-xs mb-1">
								<span class="text-amber-300 font-bold">
									+888 {isFa() ? 'موتور شماره‌های کلکسیونی (Numbers)' : 'Anonymous Numbers Engine'}
								</span>
								<span class="font-mono text-white/80">
									{metrics()?.valuations_today?.numbers ?? 0} (
									{pctOfTotal(metrics()?.valuations_today?.numbers)}%)
								</span>
							</div>
							<div class="h-2 rounded-full bg-white/5 overflow-hidden">
								<div
									class="h-full bg-amber-400 transition-all duration-500"
									style={{ width: `${pctOfTotal(metrics()?.valuations_today?.numbers)}%` }}
								/>
							</div>
						</div>

						<div>
							<div class="flex justify-between text-xs mb-1">
								<span class="text-purple-300 font-bold">
									🎁 {isFa() ? 'موتور گیفت‌های کلکسیونی (Gifts 4-Floor)' : 'Collectible Gifts Engine'}
								</span>
								<span class="font-mono text-white/80">
									{metrics()?.valuations_today?.gifts ?? 0} (
									{pctOfTotal(metrics()?.valuations_today?.gifts)}%)
								</span>
							</div>
							<div class="h-2 rounded-full bg-white/5 overflow-hidden">
								<div
									class="h-full bg-purple-400 transition-all duration-500"
									style={{ width: `${pctOfTotal(metrics()?.valuations_today?.gifts)}%` }}
								/>
							</div>
						</div>
					</div>

					{/* Credit Flow Ledger (24h) */}
					<div class="pt-3 border-t border-white/10 space-y-2.5 text-xs">
						<div class="text-[11px] font-bold text-white/50 uppercase tracking-wider">
							{isFa() ? 'گردش واقعی کریدیت در ۲۴ ساعت گذشته' : '24h Intel Credit Flow'}
						</div>
						<div class="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.02] border border-white/5">
							<span class="text-white/70">
								{isFa() ? 'کریدیت مصرف‌شده برای گزارش‌ها' : 'Credits Spent on Reports'}
							</span>
							<span class="font-mono font-bold text-rose-400">
								-{metrics()?.credits_economy_today?.consumed_today ?? 0} ⚡
							</span>
						</div>
						<div class="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.02] border border-white/5">
							<span class="text-white/70">
								{isFa() ? 'کریدیت خریداری‌شده با Stars' : 'Credits Purchased via Stars'}
							</span>
							<span class="font-mono font-bold text-emerald-400">
								+{metrics()?.credits_economy_today?.purchased_today ?? 0} ⚡
							</span>
						</div>
						<div class="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.02] border border-white/5">
							<span class="text-white/70">
								{isFa() ? 'کریدیت دریافتی از کدهای هدیه' : 'Claimed via Promo Codes'}
							</span>
							<span class="font-mono font-bold text-amber-400">
								+{metrics()?.credits_economy_today?.promo_claimed_today ?? 0} ⚡
							</span>
						</div>
						<div class="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/[0.02] border border-white/5">
							<span class="text-white/70">
								{isFa() ? 'پاداش معرفی دوستان (Referral)' : 'Referral Credit Bonuses'}
							</span>
							<span class="font-mono font-bold text-cyan-400">
								+{metrics()?.credits_economy_today?.referral_granted_today ?? 0} ⚡
							</span>
						</div>
					</div>
				</div>

				{/* Right (7 cols): Top Searched Assets Radar (24h) */}
				<div class="lg:col-span-7 rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
					<div class="flex items-center justify-between border-b border-white/10 pb-3">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-amber-400">local_fire_department</span>
							<h3 class="text-sm font-bold text-white">
								{isFa()
									? 'داغ‌ترین دارایی‌های جستجو شده توسط کاربران (۲۴ ساعت)'
									: 'Most Searched Telegram Assets (24h Hot Radar)'}
							</h3>
						</div>
						<span class="text-xs text-white/40 font-mono">
							{isFa() ? 'کلیک برای باز کردن گزارش' : 'Click to inspect'}
						</span>
					</div>

					<div class="overflow-x-auto">
						<table class="w-full text-left text-xs">
							<thead>
								<tr class="border-b border-white/10 text-white/40">
									<th class="pb-2.5">{isFa() ? 'دارایی' : 'Asset'}</th>
									<th class="pb-2.5">{isFa() ? 'بخش' : 'Engine'}</th>
									<th class="pb-2.5">{isFa() ? 'تعداد استعلام' : 'Queries'}</th>
									<th class="pb-2.5">{isFa() ? 'ارزش منصفانه' : 'Fair Value'}</th>
									<th class="pb-2.5">{isFa() ? 'وضعیت' : 'Status'}</th>
									<th class="pb-2.5 text-right">{isFa() ? 'بررسی' : 'Inspect'}</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-white/5">
								<Show
									when={(metrics()?.top_searched_assets?.length ?? 0) > 0}
									fallback={
										<tr>
											<td colspan="6" class="py-8 text-center text-white/40">
												{isFa() ? 'در حال بارگذاری رادار جستجو...' : 'Loading search radar...'}
											</td>
										</tr>
									}
								>
									<For each={metrics()?.top_searched_assets}>
										{(item) => (
											<tr class="hover:bg-white/[0.03] transition">
												<td class="py-2.5 font-mono font-bold text-white">{item.display_title}</td>
												<td class="py-2.5">
													<span
														class={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
															item.asset_type === 'username'
																? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
																: item.asset_type === 'number'
																	? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
																	: 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
														}`}
													>
														{item.asset_type}
													</span>
												</td>
												<td class="py-2.5 font-mono text-cyan-400 font-bold">
													{item.searches_24h}×
												</td>
												<td class="py-2.5 font-mono">
													<span class="text-white font-bold">
														{item.fair_value_ton.toLocaleString()} TON
													</span>
													<span class="text-white/40 text-[10px] ml-1.5">
														(${item.fair_value_usd.toLocaleString()})
													</span>
												</td>
												<td class="py-2.5">
													<span class="text-[11px] text-emerald-400 font-medium">
														{item.status_badge}
													</span>
												</td>
												<td class="py-2.5 text-right">
													<button
														type="button"
														onClick={() => inspectAsset(item.asset_type, item.query)}
														class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-cyan-300 border border-white/10 text-[11px] font-bold transition"
													>
														{isFa() ? 'گزارش ↗' : 'Report ↗'}
													</button>
												</td>
											</tr>
										)}
									</For>
								</Show>
							</tbody>
						</table>
					</div>
				</div>
			</div>

			{/* Live Real-Time Valuation Telemetry Stream */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-emerald-400">sensors</span>
						<h3 class="text-sm font-bold text-white">
							{isFa()
								? 'جریان زنده استعلام‌های ارزش‌گذاری ثبت‌شده در سرور (Live Valuation Feed)'
								: 'Live Server Valuation Feed (@Usernames, +888 Numbers, Gifts)'}
						</h3>
					</div>
					<button
						type="button"
						onClick={() => dashboardQuery.refetch()}
						class="px-3 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/70 flex items-center gap-1 self-start sm:self-auto"
					>
						<span class="material-symbols-outlined text-sm">refresh</span>
						<span>{isFa() ? 'بروزرسانی زنده' : 'Refresh Feed'}</span>
					</button>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3">{isFa() ? 'دارایی استعلام‌شده' : 'Queried Asset'}</th>
								<th class="pb-3">{isFa() ? 'موتور' : 'Engine'}</th>
								<th class="pb-3">{isFa() ? 'ارزش منصفانه (TON / USD)' : 'Fair Valuation'}</th>
								<th class="pb-3">{isFa() ? 'ضریب اطمینان' : 'Confidence'}</th>
								<th class="pb-3">{isFa() ? 'کریدیت' : 'Cost'}</th>
								<th class="pb-3">{isFa() ? 'پاسخ سرور' : 'Latency'}</th>
								<th class="pb-3 text-right">{isFa() ? 'زمان / مشاهده' : 'Time / Action'}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={(metrics()?.recent_valuations?.length ?? 0) > 0}
								fallback={
									<tr>
										<td colspan="7" class="py-8 text-center text-white/40">
											{isFa()
												? 'هنوز استعلامی در این نشست ثبت نشده است'
												: 'No recent valuations recorded yet'}
										</td>
									</tr>
								}
							>
								<For each={metrics()?.recent_valuations}>
									{(v) => (
										<tr class="hover:bg-white/[0.02] transition">
											<td class="py-3 font-mono font-bold text-white">{v.display_title}</td>
											<td class="py-3">
												<span
													class={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
														v.asset_type === 'username'
															? 'bg-sky-500/15 text-sky-300'
															: v.asset_type === 'number'
																? 'bg-amber-500/15 text-amber-300'
																: 'bg-purple-500/15 text-purple-300'
													}`}
												>
													{v.asset_type}
												</span>
											</td>
											<td class="py-3 font-mono">
												<span class="text-emerald-400 font-bold">
													{v.fair_value_ton.toLocaleString()} TON
												</span>
												<span class="text-white/40 ml-1.5">
													(${v.fair_value_usd.toLocaleString()})
												</span>
											</td>
											<td class="py-3 font-mono text-white/80">{v.confidence_score}%</td>
											<td class="py-3 font-mono text-cyan-400 font-bold">⚡ {v.credits_spent}</td>
											<td class="py-3 font-mono text-white/60">{v.latency_ms} ms</td>
											<td class="py-3 text-right">
												<div class="flex items-center justify-end gap-2">
													<span class="text-white/40 font-mono text-[11px]">
														{new Date(v.created_at).toLocaleTimeString()}
													</span>
													<button
														type="button"
														onClick={() => inspectAsset(v.asset_type, v.query)}
														class="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 text-[10px] font-bold"
													>
														{isFa() ? 'باز کردن' : 'Open'}
													</button>
												</div>
											</td>
										</tr>
									)}
								</For>
							</Show>
						</tbody>
					</table>
				</div>
			</div>

			{/* 30-Day Active Users & Valuations Chart */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<h3 class="text-sm font-bold text-white">
							{isFa()
								? 'روند ۳۰ روزه کاربران فعال و تعداد استعلام‌های ارزش‌گذاری'
								: '30-Day Active Users & Valuation Velocity'}
						</h3>
						<p class="text-xs text-white/50">
							{isFa()
								? 'مقایسه روزانه تعداد کاربران فعال (آبی) و گزارش‌های صادرشده (طلایی)'
								: 'Daily Active Users (Blue) vs Executed Asset Valuations (Amber)'}
						</p>
					</div>
				</div>
				<div ref={chartContainerRef} class="w-full h-60" />
			</div>

			<TotpSetupModal isOpen={isTotpModalOpen()} onClose={() => setIsTotpModalOpen(false)} />
		</div>
	);
};
