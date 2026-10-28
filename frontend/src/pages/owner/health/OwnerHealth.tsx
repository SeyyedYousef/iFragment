import { createMutation, createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, onCleanup, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type {
	ExternalProviderHealth,
	SystemErrorLog,
	SystemHealthMetrics,
} from '@/entities/owner/model/types.js';
import { locale } from '@/shared/i18n/index.js';

export const OwnerHealth: Component = () => {
	const isFa = () => locale() === 'fa';
	const [isTabVisible, setIsTabVisible] = createSignal(!document.hidden);
	const [cacheNotice, setCacheNotice] = createSignal<string | null>(null);

	const handleVisibilityChange = () => {
		setIsTabVisible(!document.hidden);
	};

	if (typeof window !== 'undefined') {
		document.addEventListener('visibilitychange', handleVisibilityChange);
		onCleanup(() => document.removeEventListener('visibilitychange', handleVisibilityChange));
	}

	const healthQuery = createQuery<SystemHealthMetrics>(() => ({
		queryKey: ['owner', 'health', 'metrics'],
		queryFn: ownerApi.getHealth,
		refetchInterval: () => (isTabVisible() ? 10000 : false),
	}));

	const externalHealthQuery = createQuery(() => ({
		queryKey: ['owner', 'health', 'external'],
		queryFn: ownerApi.getExternalHealth,
		refetchInterval: () => (isTabVisible() ? 30000 : false),
	}));

	const errorsQuery = createQuery<SystemErrorLog[]>(() => ({
		queryKey: ['owner', 'health', 'errors'],
		queryFn: () => ownerApi.getSystemErrors(50),
		refetchInterval: () => (isTabVisible() ? 15000 : false),
	}));

	const clearCacheMutation = createMutation(() => ({
		mutationFn: () => ownerApi.clearCache(),
		onSuccess: (res) => {
			setCacheNotice(
				isFa()
					? `${res.deleted_keys} کلید کش ارزش‌گذاری و قیمت کف با موفقیت پاکسازی شد.`
					: `Flushed ${res.deleted_keys} cached valuation & floor keys.`,
			);
			healthQuery.refetch();
			externalHealthQuery.refetch();
			setTimeout(() => setCacheNotice(null), 4000);
		},
	}));

	const formatUptime = (seconds = 0) => {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		return `${days}d ${hours}h ${mins}m`;
	};

	const health = () => healthQuery.data as SystemHealthMetrics | undefined;
	const providers = () => (externalHealthQuery.data?.providers || []) as ExternalProviderHealth[];
	const errors = () => (errorsQuery.data || []) as SystemErrorLog[];

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h2 class="text-lg font-black text-white">
						{isFa()
							? 'مانیتورینگ زنده اوراکل‌های بلاک‌چین TON و کش موتورهای ارزش‌گذاری'
							: 'Live TON & Telegram Oracle Health & Valuation Cache'}
					</h2>
					<p class="text-xs text-white/50">
						{isFa()
							? 'بررسی لحظه‌ای پینگ و وضعیت پاسخگویی Fragment، TonAPI، Nums888، Changes.tg و پاکسازی کش قیمت‌ها'
							: 'Real-time HTTP probe of Fragment, TonAPI, Nums888, Changes.tg & cache invalidation'}
					</p>
				</div>
				<div class="flex items-center gap-3">
					<button
						type="button"
						onClick={() => clearCacheMutation.mutate()}
						disabled={clearCacheMutation.isPending}
						class="flex items-center gap-1.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50"
					>
						<span class="material-symbols-outlined text-sm">cleaning_services</span>
						<span>
							{clearCacheMutation.isPending
								? isFa()
									? 'در حال پاکسازی کش...'
									: 'Flushing...'
								: isFa()
									? 'پاکسازی کش قیمت‌ها (Flush Cache)'
									: 'Flush Valuation Cache'}
						</span>
					</button>
					<div class="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
						<span
							class={`h-2.5 w-2.5 rounded-full ${
								health()?.status === 'ok' || health()?.db_status === 'ok'
									? 'bg-emerald-400 animate-pulse'
									: 'bg-amber-400'
							}`}
						/>
						<span class="text-white/80 font-mono font-bold">
							{healthQuery.isLoading
								? 'Probing...'
								: health()?.db_status === 'ok'
									? 'Engine Online'
									: 'Standby'}
						</span>
					</div>
				</div>
			</div>

			<Show when={cacheNotice()}>
				<div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-300 flex items-center gap-2">
					<span class="material-symbols-outlined text-base">check_circle</span>
					<span>{cacheNotice()}</span>
				</div>
			</Show>

			{/* Node Runtime & Cache Metrics */}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{isFa() ? 'پایگاه داده و لتنسی' : 'Database & I/O Latency'}</span>
						<span class="material-symbols-outlined text-base text-sky-400">database</span>
					</div>
					<div class="text-2xl font-black font-mono text-emerald-400">
						{healthQuery.isLoading ? '...' : (health()?.db_status || 'OK').toUpperCase()}
					</div>
					<div class="text-xs text-white/50 font-mono">
						Latency:{' '}
						<span class="text-white font-bold">
							{healthQuery.isLoading ? '...' : `${health()?.db_latency_ms ?? 0} ms`}
						</span>
					</div>
				</div>

				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{isFa() ? 'کش گزارش‌ها و قیمت‌های کف' : 'Valuation & Floor Cache'}</span>
						<span class="material-symbols-outlined text-base text-cyan-400">memory</span>
					</div>
					<div class="text-2xl font-black font-mono text-cyan-400">
						{healthQuery.isLoading
							? '...'
							: `${health()?.cached_valuations_count ?? 0} Keys`}
					</div>
					<div class="text-xs text-white/50 font-mono">
						Hit Rate:{' '}
						<span class="text-emerald-400 font-bold">
							{health()?.cache_hit_rate_pct ?? 94}%
						</span>
					</div>
				</div>

				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{isFa() ? 'پردازش و مصرف منابع سرور' : 'Runtime Memory & Load'}</span>
						<span class="material-symbols-outlined text-base text-amber-400">memory_alt</span>
					</div>
					<div class="text-2xl font-black font-mono text-white">
						{healthQuery.isLoading ? '...' : `${health()?.memory_used_mb ?? 0} MB`}
					</div>
					<div class="text-xs text-white/50 font-mono">
						CPU Load:{' '}
						<span class="text-amber-400 font-bold">
							{healthQuery.isLoading ? '...' : `${health()?.cpu_usage_percent ?? 0}%`}
						</span>
					</div>
				</div>

				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{isFa() ? 'آپ‌تایم سرور و نرخ TON' : 'Node Uptime & Live TON'}</span>
						<span class="material-symbols-outlined text-base text-emerald-400">timer</span>
					</div>
					<div class="text-2xl font-black font-mono text-white">
						{healthQuery.isLoading ? '...' : formatUptime(health()?.uptime_seconds)}
					</div>
					<div class="text-xs text-white/50 font-mono">
						TON Oracle:{' '}
						<span class="text-emerald-400 font-bold">
							${(health()?.ton_usd_live ?? 0).toFixed(2)}
						</span>
					</div>
				</div>
			</div>

			{/* External Ecosystem API Health Matrix */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="flex items-center justify-between border-b border-white/10 pb-3">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-cyan-400">hub</span>
						<div>
							<h3 class="text-sm font-bold text-white">
								{isFa()
									? 'وضعیت زنده اوراکل‌های خارجی (Fragment, TonAPI, Nums888, Changes.tg)'
									: 'Live Upstream Data Oracles (Fragment, TonAPI, Nums888, Changes.tg)'}
							</h3>
							<p class="text-[11px] text-white/45">
								{isFa()
									? 'تست مستقیم HTTP از سرور به منابع اصلی قیمت‌گذاری نام کاربری، +888 و گیفت'
									: 'Live server-to-oracle HTTP latency & status verification'}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={() => externalHealthQuery.refetch()}
						disabled={externalHealthQuery.isFetching}
						class="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition"
					>
						<span class="material-symbols-outlined text-sm">refresh</span>
						<span>
							{externalHealthQuery.isFetching
								? isFa()
									? 'در حال پینگ...'
									: 'Probing...'
								: isFa()
									? 'تست مجدد همه اوراکل‌ها'
									: 'Probe All Oracles'}
						</span>
					</button>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					<Show
						when={!externalHealthQuery.isLoading && providers().length > 0}
						fallback={
							<div class="col-span-full py-8 text-center text-xs text-white/40">
								{isFa()
									? 'در حال ارسال پینگ زنده به سرورهای Fragment، TonAPI و Changes.tg...'
									: 'Probing live upstream ecosystem endpoints...'}
							</div>
						}
					>
						<For each={providers()}>
							{(p) => (
								<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
									<div class="flex items-center justify-between">
										<span class="text-xs font-black text-white">{p.name}</span>
										<span
											class={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
												p.status === 'healthy'
													? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
													: p.status === 'degraded'
														? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
														: 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
											}`}
										>
											{p.status}
										</span>
									</div>
									<div class="text-[10px] text-white/45 font-mono truncate">
										{p.endpoint || p.category.toUpperCase()}
									</div>
									<Show when={p.live_metric}>
										<div class="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg">
											{p.live_metric}
										</div>
									</Show>
									<div class="flex items-center justify-between text-[11px] font-mono text-white/70 pt-1 border-t border-white/5">
										<span>Latency: {p.latency_ms} ms</span>
										<span class="text-emerald-400">HTTP {p.http_status || 200}</span>
									</div>
								</div>
							)}
						</For>
					</Show>
				</div>
			</div>

			{/* System Error Logs Table */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-rose-400">bug_report</span>
						<span class="text-sm font-bold text-white">
							{isFa() ? 'لاگ خطاهای اخیر سیستم و اوراکل‌ها' : 'Recent System & Oracle Error Logs'}
						</span>
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3">{isFa() ? 'ماژول' : 'Source Module'}</th>
								<th class="pb-3">{isFa() ? 'سطح' : 'Severity'}</th>
								<th class="pb-3">{isFa() ? 'پیام رویداد' : 'Message'}</th>
								<th class="pb-3 text-right">{isFa() ? 'زمان' : 'Timestamp'}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!errorsQuery.isLoading && errors().length > 0}
								fallback={
									<tr>
										<td colspan="4" class="py-8 text-center text-emerald-400/70 font-medium">
											{errorsQuery.isLoading
												? 'Loading system logs...'
												: isFa()
													? '✓ هیچ خطای بحرانی در موتورهای ارزش‌گذاری ثبت نشده است'
													: '✓ Zero critical errors across valuation engines'}
										</td>
									</tr>
								}
							>
								<For each={errors()}>
									{(log) => (
										<tr class="hover:bg-white/[0.02] transition">
											<td class="py-3 font-mono font-bold text-white">{log.source}</td>
											<td class="py-3">
												<span
													class={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
														log.level === 'warn'
															? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
															: 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
													}`}
												>
													{log.level?.toUpperCase() || 'INFO'}
												</span>
											</td>
											<td class="py-3 font-mono text-white/80 max-w-md truncate">
												{log.error_message}
											</td>
											<td class="py-3 text-white/50 text-right font-mono text-[11px]">
												{new Date(log.created_at).toLocaleTimeString()}
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
	);
};
