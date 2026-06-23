import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { Title } from '@solidjs/meta';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';
import { apiClient } from '@/shared/api/client.js';

export const OwnerHealth: Component = () => {
	const [metrics, setMetrics] = createSignal<any>(null);
	const [errors, setErrors] = createSignal<any[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [fetchError, setFetchError] = createSignal('');

	const fetchData = async () => {
		try {
			const [metricsResp, errorsResp] = await Promise.all([
				apiClient.get('/owner/health/metrics'),
				apiClient.get('/owner/health/errors'),
			]);
			setMetrics(metricsResp.data);
			setErrors(errorsResp.data || []);
		} catch (e: any) {
			setFetchError(e.response?.data?.error || 'خطا در دریافت وضعیت سیستم');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchData();
		// Auto refresh metrics every 10 seconds
		const interval = setInterval(fetchData, 10000);
		return () => clearInterval(interval);
	});

	return (
		<div class="min-h-screen bg-[#0f1016] text-white pb-20">
			<Title>پنل مدیریت | سلامت سیستم</Title>
			<OwnerTabs active="health" />

			<div class="p-6 max-w-6xl mx-auto mt-4">
				<div class="mb-8">
					<h1 class="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-l from-white to-white/50">
						سلامت سیستم و مانیتورینگ
					</h1>
					<p class="text-white/50 text-sm font-bold">
						رصد منابع سرور و خطاهای سیستم تلگرام به صورت زنده
					</p>
				</div>

				<Show when={fetchError()}>
					<div class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl mb-6 font-bold text-sm">
						{fetchError()}
					</div>
				</Show>

				<Show
					when={!loading()}
					fallback={
						<div class="flex justify-center py-20">
							<div class="w-8 h-8 border-4 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin"></div>
						</div>
					}
				>
					<div class="space-y-8">
						{/* Server Metrics Cards */}
						<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
							<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
								<div class="text-white/50 text-xs font-bold uppercase mb-2">وضعیت دیتابیس</div>
								<div class={`text-2xl font-black ${metrics()?.db_status === 'healthy' ? 'text-green-400' : 'text-red-400'}`}>
									{metrics()?.db_status === 'healthy' ? 'متصل (Healthy)' : 'قطع ارتباط'}
								</div>
							</div>
							<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
								<div class="text-white/50 text-xs font-bold uppercase mb-2">رشته‌های پردازشی (Goroutines)</div>
								<div class="text-2xl font-black text-amber-400">
									{metrics()?.goroutines}
								</div>
							</div>
							<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
								<div class="text-white/50 text-xs font-bold uppercase mb-2">رم اختصاص یافته (Allocated)</div>
								<div class="text-2xl font-black text-blue-400">
									{metrics()?.allocated_mb} MB
								</div>
							</div>
							<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
								<div class="text-white/50 text-xs font-bold uppercase mb-2">کل رم مصرفی سیستم (Sys)</div>
								<div class="text-2xl font-black text-[#3390ec]">
									{metrics()?.total_sys_mb} MB
								</div>
							</div>
						</div>

						{/* System Errors Table */}
						<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
							<div class="flex justify-between items-center mb-4">
								<h3 class="font-black text-xl">لاگ خطاهای تلگرام (Flood Wait & Limits)</h3>
								<button onClick={fetchData} class="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition">
									<span class="material-symbols-outlined text-[16px]">refresh</span>
								</button>
							</div>
							<div class="overflow-x-auto">
								<table class="w-full text-sm text-right">
									<thead class="text-xs text-white/50 uppercase bg-white/5">
										<tr>
											<th class="px-6 py-3 rounded-tr-xl">سورس</th>
											<th class="px-6 py-3">پیام خطا</th>
											<th class="px-6 py-3 rounded-tl-xl">تاریخ و زمان</th>
										</tr>
									</thead>
									<tbody>
										<For each={errors()} fallback={<tr><td colSpan="3" class="text-center py-4 text-white/50">هیچ خطایی در سیستم یافت نشد</td></tr>}>
											{(err) => (
												<tr class="border-b border-white/5 hover:bg-white/5">
													<td class="px-6 py-4 font-bold text-amber-400">{err.source}</td>
													<td class="px-6 py-4 text-xs font-mono text-red-300 max-w-lg">{err.error_message}</td>
													<td class="px-6 py-4 text-xs" dir="ltr">{new Date(err.created_at).toLocaleString('fa-IR')}</td>
												</tr>
											)}
										</For>
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</Show>
			</div>
		</div>
	);
};
