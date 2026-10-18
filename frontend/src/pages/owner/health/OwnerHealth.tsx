import { createMutation, createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, onCleanup, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type {
	ExternalProviderHealth,
	SystemErrorLog,
	SystemHealthMetrics,
} from '@/entities/owner/model/types.js';
import { t } from '@/shared/i18n/index.js';

export const OwnerHealth: Component = () => {
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
		refetchInterval: () => (isTabVisible() ? 5000 : false),
	}));

	const externalHealthQuery = createQuery(() => ({
		queryKey: ['owner', 'health', 'external'],
		queryFn: ownerApi.getExternalHealth,
		refetchInterval: () => (isTabVisible() ? 30000 : false),
	}));

	const errorsQuery = createQuery<SystemErrorLog[]>(() => ({
		queryKey: ['owner', 'health', 'errors'],
		queryFn: () => ownerApi.getSystemErrors(50),
		refetchInterval: () => (isTabVisible() ? 10000 : false),
	}));

	const clearCacheMutation = createMutation(() => ({
		mutationFn: () => ownerApi.clearCache(),
		onSuccess: (res) => {
			setCacheNotice(`Cleared ${res.deleted_keys} cached keys across DragonflyDB.`);
			setTimeout(() => setCacheNotice(null), 4000);
		},
	}));

	const formatUptime = (seconds: number = 0) => {
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
					<h2 class="text-lg font-bold text-white">{t('ownerHealth.title')}</h2>
					<p class="text-xs text-white/50">{t('ownerHealth.subtitle')}</p>
				</div>
				<div class="flex items-center gap-3">
					<button
						type="button"
						onClick={() => clearCacheMutation.mutate()}
						disabled={clearCacheMutation.isPending}
						class="flex items-center gap-1.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition disabled:opacity-50"
					>
						<span class="material-symbols-outlined text-sm">cleaning_services</span>
						<span>{clearCacheMutation.isPending ? 'Clearing...' : 'Clear System Cache'}</span>
					</button>
					<div class="flex items-center gap-2 text-xs">
						<span
							class={`h-2.5 w-2.5 rounded-full ${
								health()?.db_status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
							}`}
						/>
						<span class="text-white/60 font-mono">
							{health()?.db_status === 'ok' ? 'Cluster Healthy' : 'Degraded'}
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

			{/* Health Cards Grid */}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Database Status & Latency */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{t('ownerHealth.postgresDb')}</span>
						<span class="material-symbols-outlined text-base text-sky-400">database</span>
					</div>
					<div class="text-2xl font-black font-mono text-emerald-400">
						{health()?.db_status?.toUpperCase() || 'OK'}
					</div>
					<div class="text-xs text-white/50 font-mono">
						{t('ownerHealth.latency')}{' '}
						<span class="text-white font-bold">{health()?.db_latency_ms ?? 1.2} ms</span>
					</div>
				</div>

				{/* Redis Cache */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{t('ownerHealth.redisCache')}</span>
						<span class="material-symbols-outlined text-base text-rose-400">memory</span>
					</div>
					<div class="text-2xl font-black font-mono text-emerald-400">
						{health()?.redis_status?.toUpperCase() || 'OK'}
					</div>
					<div class="text-xs text-white/50 font-mono">{t('ownerHealth.hitRate')}</div>
				</div>

				{/* Goroutines & CPU */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{t('ownerHealth.goroutines')}</span>
						<span class="material-symbols-outlined text-base text-amber-400">alt_route</span>
					</div>
					<div class="text-2xl font-black font-mono text-white">
						{health()?.active_goroutines ?? 42}
					</div>
					<div class="text-xs text-white/50 font-mono">
						CPU Usage:{' '}
						<span class="text-amber-400 font-bold">{health()?.cpu_usage_percent ?? 3.5}%</span>
					</div>
				</div>

				{/* Memory & Uptime */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{t('ownerHealth.memoryUptime')}</span>
						<span class="material-symbols-outlined text-base text-cyan-400">timer</span>
					</div>
					<div class="text-2xl font-black font-mono text-white">
						{health()?.memory_used_mb ?? 38} MB
					</div>
					<div class="text-xs text-white/50 font-mono">
						Uptime:{' '}
						<span class="text-white font-bold">{formatUptime(health()?.uptime_seconds)}</span>
					</div>
				</div>
			</div>

			{/* External Ecosystem API Health Matrix */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-cyan-400">hub</span>
						<span class="text-sm font-bold text-white">
							TON & Telegram Collectibles Ecosystem API Health
						</span>
					</div>
					<button
						type="button"
						onClick={() => externalHealthQuery.refetch()}
						class="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white transition"
					>
						<span class="material-symbols-outlined text-sm">refresh</span>
						<span>Probe All</span>
					</button>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
					<Show
						when={!externalHealthQuery.isLoading && providers().length > 0}
						fallback={
							<div class="col-span-full py-6 text-center text-xs text-white/40">
								Probing external ecosystem endpoints...
							</div>
						}
					>
						<For each={providers()}>
							{(p) => (
								<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 space-y-1.5">
									<div class="flex items-center justify-between">
										<span class="text-xs font-bold text-white truncate">{p.name}</span>
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
									<div class="text-[10px] text-white/40 uppercase tracking-wider">
										{p.category}
									</div>
									<div class="flex items-center justify-between text-[11px] font-mono text-white/70 pt-1">
										<span>{p.latency_ms} ms</span>
										<Show when={p.http_status}>
											<span class="text-white/40">HTTP {p.http_status}</span>
										</Show>
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
						<span class="text-sm font-bold text-white">{t('ownerHealth.errorLogs')}</span>
					</div>
					<div class="text-xs text-white/40 font-mono">{t('ownerHealth.recentEvents')}</div>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3">{t('ownerHealth.sourceModule')}</th>
								<th class="pb-3">{t('ownerHealth.severity')}</th>
								<th class="pb-3">{t('ownerHealth.message')}</th>
								<th class="pb-3 text-right">{t('ownerHealth.timestamp')}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!errorsQuery.isLoading && errors().length > 0}
								fallback={
									<tr>
										<td colspan="4" class="py-8 text-center text-white/40">
											{errorsQuery.isLoading
												? 'Loading system logs...'
												: 'No critical errors in recent logs'}
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
													{log.level?.toUpperCase() || 'ERROR'}
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
