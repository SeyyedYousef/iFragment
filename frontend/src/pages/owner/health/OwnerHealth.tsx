import { Component, createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { ownerApi, SystemHealthMetrics } from '@/shared/api/owner.js';

export const OwnerHealth: Component = () => {
	const [metrics, setMetrics] = createSignal<SystemHealthMetrics | null>(null);
	const [logs, setLogs] = createSignal<string[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [fetchError, setFetchError] = createSignal('');
	const [lastUpdated, setLastUpdated] = createSignal('');

	let intervalTimer: any;

	const fetchData = async () => {
		if (document.hidden) return; // Pause polling when tab is hidden
		setFetchError('');
		try {
			const [m, l] = await Promise.all([
				ownerApi.getHealthMetrics().catch(() => null),
				ownerApi.getHealthLogs().catch(() => ({ logs: [] })),
			]);
			if (m) setMetrics(m);
			setLogs((l as any)?.logs || (Array.isArray(l) ? l : []));
			setLastUpdated(new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
		} catch (e: any) {
			setFetchError(e.response?.data?.error || 'خطا در دریافت پایش سلامت سرور');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchData();
		// Solid JS explicit onCleanup for polling interval
		intervalTimer = setInterval(fetchData, 10000);
	});

	onCleanup(() => {
		if (intervalTimer) clearInterval(intervalTimer);
	});

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="bg-[#16171d]/60 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
				<div>
					<h2 class="text-sm font-black text-white">پایش سلامت سرور و مانیتورینگ زنده (Health Monitoring)</h2>
					<Show when={lastUpdated()}>
						<p class="text-xs text-white/40 font-bold mt-0.5">آخرین همگام‌سازی: {lastUpdated()}</p>
					</Show>
				</div>

				<button
					onClick={fetchData}
					disabled={loading()}
					class="h-9 px-4 bg-[#3390ec]/10 hover:bg-[#3390ec]/20 border border-[#3390ec]/30 text-[#3390ec] text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5"
				>
					<span class={`material-symbols-outlined text-[16px] ${loading() ? 'animate-spin' : ''}`}>sync</span>
					بروزرسانی دستی
				</button>
			</div>

			<Show when={fetchError()}>
				<div class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold">
					<span class="material-symbols-outlined text-xl">error</span>
					<span>{fetchError()}</span>
				</div>
			</Show>

			<Show
				when={!loading() || metrics()}
				fallback={
					<div class="flex flex-col items-center justify-center py-20 gap-3">
						<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
						<span class="text-xs text-white/50 font-bold">در حال آنالیز سلامت دیتابیس و منابع...</span>
					</div>
				}
			>
				{/* Metrics Grid */}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{/* DB Status */}
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 space-y-2">
						<span class="text-[10px] text-white/40 font-black uppercase tracking-wider block">وضعیت دیتابیس PostgreSQL</span>
						<div class="flex items-center gap-2">
							<span class={`w-3 h-3 rounded-full ${metrics()?.db_status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
							<span class="text-lg font-black text-white">{metrics()?.db_status === 'ok' ? 'متصل (Online)' : 'اختلال'}</span>
						</div>
						<p class="text-[10px] text-emerald-400 font-mono font-bold">پاسخ‌دهی: {metrics()?.db_latency_ms || 1} ms</p>
					</div>

					{/* Goroutines */}
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 space-y-2">
						<span class="text-[10px] text-white/40 font-black uppercase tracking-wider block">پروسه‌های همزمان (Goroutines)</span>
						<div class="text-2xl font-black text-amber-400 font-mono">{metrics()?.active_goroutines || 0}</div>
						<p class="text-[10px] text-white/40 font-bold">رشته‌های پردازشی پویا در سرور Go</p>
					</div>

					{/* Memory RAM */}
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 space-y-2">
						<span class="text-[10px] text-white/40 font-black uppercase tracking-wider block">مصرف حافظه رم (Allocated RAM)</span>
						<div class="text-2xl font-black text-[#3390ec] font-mono">{metrics()?.memory_used_mb || 0} MB</div>
						<p class="text-[10px] text-[#3390ec] font-bold">اختصاص یافته به برنامه</p>
					</div>

					{/* Redis Health */}
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 space-y-2">
						<span class="text-[10px] text-white/40 font-black uppercase tracking-wider block">حافظه کش Redis</span>
						<div class="flex items-center gap-2">
							<span class={`w-3 h-3 rounded-full ${metrics()?.redis_status === 'ok' ? 'bg-emerald-400' : 'bg-red-500'}`} />
							<span class="text-lg font-black text-white">{metrics()?.redis_status === 'ok' ? 'فعال (Healthy)' : 'غیرفعال'}</span>
						</div>
						<p class="text-[10px] text-white/40 font-bold">ذخیره‌سازی موقت جلسات کاربری</p>
					</div>
				</div>

				{/* System Event Logs */}
				<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-4">
					<h3 class="text-xs font-black uppercase text-white tracking-wider">لاگ‌ها و خطاهای ثبت‌شده سیستم</h3>

					<div class="bg-black/60 border border-white/10 rounded-2xl p-4 font-mono text-[11px] text-emerald-400 space-y-1.5 overflow-x-auto max-h-80 overflow-y-auto">
						<Show
							when={logs().length > 0}
							fallback={<div class="text-white/40 font-sans text-xs text-center py-4">هیچ خطا یا اخطاری در سرور ثبت نشده است.</div>}
						>
							<For each={logs()}>
								{(entry) => <div class="whitespace-pre-wrap leading-relaxed">{entry}</div>}
							</For>
						</Show>
					</div>
				</div>
			</Show>
		</div>
	);
};
