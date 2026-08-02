import { useNavigate } from '@solidjs/router';

import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { apiClient } from '@/shared/api/axios.js';
import { haptic } from '@/shared/lib/haptic.js';

interface DashboardStats {
	dau: number;
	mau: number;
	total_users: number;
	frg_circulation: number;
	stars_volume: number;
	recent_activity: Array<{
		id: string;
		owner_id: number;
		action: string;
		target_user_id?: number;
		payload?: Record<string, any>;
		ip_address?: string;
		created_at: string;
	}>;
	dau_chart: Array<{ date: string; value: number }>;
	coin_flow_chart: Array<{ date: string; value: number }>;
}

const MiniChart: Component<{ data: Array<{ date: string; value: number }>; color: string }> = (
	props,
) => {
	const max = () => Math.max(...props.data.map((d) => d.value), 1);
	return (
		<div class="flex items-end justify-between h-12 w-full mt-3 gap-1">
			<For each={props.data}>
				{(d) => (
					<div class="relative w-full flex justify-center group">
						<div
							class={`w-full max-w-[8px] rounded-t-sm transition-all duration-300 ${props.color}`}
							style={{ height: `${Math.max(10, (d.value / max()) * 100)}%` }}
						/>
						<div class="absolute -top-8 bg-black/90 text-white px-2 py-1 rounded text-[9px] font-black opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-lg">
							{d.date}: {d.value.toLocaleString()}
						</div>
					</div>
				)}
			</For>
		</div>
	);
};

export const OwnerDashboard: Component = () => {
	const navigate = useNavigate();
	const [stats, setStats] = createSignal<DashboardStats | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal('');
	const [lastRefreshed, setLastRefreshed] = createSignal<string>('');

	const fetchStats = async () => {
		setLoading(true);
		setError('');
		try {
			const resp = await apiClient.get('/owner/dashboard/stats');
			setStats(resp.data);
			setLastRefreshed(
				new Date().toLocaleTimeString('fa-IR', {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
				}),
			);
		} catch (err: any) {
			setError(
				err.response?.data?.error || 'خطا در دریافت آمارهای داشبورد. عدم دسترسی احراز هویت.',
			);
			try {
				haptic.notify('error');
			} catch {}
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchStats();
	});

	const handleNav = (path: string) => {
		try {
			haptic.impact('light');
		} catch {}
		navigate(path);
	};

	const calculateDauMauRatio = () => {
		const d = stats()?.dau || 0;
		const m = stats()?.mau || 1;
		return Math.round((d / m) * 100);
	};

	return (
		<div class="space-y-6">
			{/* Refresh Bar */}
			<div class="flex items-center justify-between bg-white/5 border border-white/5 rounded-2xl p-4">
				<div>
					<h2 class="text-sm font-black text-white">داشبورد مدیریتی و پایش سیستم</h2>
					<Show when={lastRefreshed()}>
						<p class="text-[10px] text-white/40 font-bold mt-0.5">
							آخرین بهروزرسانی: {lastRefreshed()}
						</p>
					</Show>
				</div>
				<button
					onClick={fetchStats}
					disabled={loading()}
					class="h-9 px-4 bg-[#3390ec]/10 hover:bg-[#3390ec]/20 border border-[#3390ec]/30 text-[#3390ec] text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
				>
					<span class={`material-symbols-outlined text-[16px] ${loading() ? 'animate-spin' : ''}`}>
						sync
					</span>
					بروزرسانی داده‌ها
				</button>
			</div>

			<Show when={error()}>
				<div class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-fade-in">
					<span class="material-symbols-outlined text-red-500 mt-0.5">error</span>
					<div>
						<h3 class="text-sm font-black text-white">خطای دریافت آمارهای سرور</h3>
						<p class="text-xs text-red-400 mt-1 leading-relaxed">{error()}</p>
					</div>
				</div>
			</Show>

			<Show
				when={!loading() && stats()}
				fallback={
					<div class="flex flex-col items-center justify-center py-20 gap-4">
						<div class="w-10 h-10 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
						<span class="text-xs text-[#a0a4ad] font-bold">
							در حال دریافت و تحلیل آمارهای لحظهای...
						</span>
					</div>
				}
			>
				{/* Metrics Grid */}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{/* DAU */}
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 flex flex-col justify-between hover:scale-[1.01] transition-all">
						<div class="flex items-center justify-between mb-2">
							<span class="text-xs text-[#a0a4ad] font-black uppercase tracking-wider">
								فعالین امروز (DAU)
							</span>
							<div class="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs">
								⚡
							</div>
						</div>
						<span class="text-3xl font-black text-white">
							{stats()?.dau?.toLocaleString() ?? 0}
						</span>
						<div class="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[10px]">
							<span class="text-emerald-400 font-bold">
								ضریب بازگشت کاربر (Stickiness): {calculateDauMauRatio()}%
							</span>
						</div>
						<Show when={stats()?.dau_chart?.length}>
							<MiniChart data={stats()!.dau_chart} color="bg-emerald-500" />
						</Show>
					</div>

					{/* MAU */}
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 flex flex-col justify-between hover:scale-[1.01] transition-all">
						<div class="flex items-center justify-between mb-2">
							<span class="text-xs text-[#a0a4ad] font-black uppercase tracking-wider">
								فعالین ماه (MAU)
							</span>
							<div class="w-7 h-7 rounded-xl bg-[#3390ec]/10 border border-[#3390ec]/20 flex items-center justify-center text-[#3390ec] text-xs">
								📊
							</div>
						</div>
						<span class="text-3xl font-black text-white">
							{stats()?.mau?.toLocaleString() ?? 0}
						</span>
						<span class="text-[10px] text-[#3390ec] font-bold mt-2">نرخ ماندگاری ۳۰ روز اخیر</span>
					</div>

					{/* Total Users */}
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 flex flex-col justify-between hover:scale-[1.01] transition-all">
						<div class="flex items-center justify-between mb-2">
							<span class="text-xs text-[#a0a4ad] font-black uppercase tracking-wider">
								کل اعضای ثبتنامی
							</span>
							<div class="w-7 h-7 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs">
								👥
							</div>
						</div>
						<span class="text-3xl font-black text-white">
							{stats()?.total_users?.toLocaleString() ?? 0}
						</span>
						<span class="text-[10px] text-white/50 font-bold mt-2">
							تعداد کل حساب‌های کاربری فعال
						</span>
					</div>

					{/* Coins Circulation */}
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 flex flex-col justify-between hover:scale-[1.01] transition-all">
						<div class="flex items-center justify-between mb-2">
							<span class="text-xs text-[#a0a4ad] font-black uppercase tracking-wider">
								سکه‌های در گردش
							</span>
							<div class="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs">
								🪙
							</div>
						</div>
						<span class="text-2xl font-black text-amber-400 truncate">
							{Math.round(stats()?.frg_circulation ?? 0).toLocaleString()} FRG
						</span>
						<div class="mt-2 pt-2 border-t border-white/5">
							<div class="flex justify-between text-[9px] text-white/40 font-bold mb-1">
								<span>سقف تورمی: ۱۰۰,۰۰۰,۰۰۰</span>
								<span>
									{Math.min(100, Math.round(((stats()?.frg_circulation ?? 0) / 100000000) * 100))}%
								</span>
							</div>
							<div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
								<div
									class="bg-amber-400 h-full rounded-full transition-all"
									style={{
										width: `${Math.min(100, ((stats()?.frg_circulation ?? 0) / 100000000) * 100)}%`,
									}}
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Stars Revenue Banner */}
				<div class="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
					<div>
						<div class="flex items-center gap-2 mb-1">
							<span class="text-amber-400 text-lg">⭐</span>
							<h3 class="text-xs font-black uppercase tracking-wider text-amber-400">
								حجم خریدهای ستاره تلگرام
							</h3>
						</div>
						<div class="text-3xl font-black text-white">
							{Number(stats()?.stars_volume ?? 0).toLocaleString()} Stars
						</div>
						<p class="text-xs text-white/50 font-bold mt-1">
							درآمد ناخالص کلی پرداختیهای درگاه ستاره تلگرام
						</p>
					</div>

					<Show when={stats()?.coin_flow_chart?.length}>
						<div class="w-full md:w-64">
							<MiniChart data={stats()!.coin_flow_chart} color="bg-amber-400" />
						</div>
					</Show>
				</div>

				{/* Network Traffic Trend Chart */}
				<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-4">
					<div class="flex items-center justify-between pb-3 border-b border-white/5">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#3390ec]">trending_up</span>
							<h3 class="text-xs font-black uppercase tracking-wider text-white">
								نمودار روند ترافیک و تعاملات کاربران
							</h3>
						</div>
						<span class="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
							سیستم آنلاین
						</span>
					</div>

					<div class="h-32 w-full relative overflow-hidden flex items-end">
						{(() => {
							const data = stats()?.dau_chart || [];
							const maxVal = Math.max(...data.map((d) => d.value), 1);
							const minVal = Math.min(...data.map((d) => d.value), 0);
							const range = maxVal - minVal || 1;

							const coords =
								data.length > 0
									? data.map((d, i) => {
											const x = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
											const y = 26 - ((d.value - minVal) / range) * 20;
											return `${x.toFixed(1)} ${y.toFixed(1)}`;
										})
									: ['0 25', '50 15', '100 8'];

							const linePath = `M ${coords.join(' L ')}`;
							const areaPath = `M 0 30 L ${coords.join(' L ')} L 100 30 Z`;

							return (
								<svg class="w-full h-28" viewBox="0 0 100 30" preserveAspectRatio="none">
									<defs>
										<linearGradient id="dashboardChartGrad" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stop-color="#3390ec" stop-opacity="0.4" />
											<stop offset="100%" stop-color="#3390ec" stop-opacity="0" />
										</linearGradient>
									</defs>
									<path d={areaPath} fill="url(#dashboardChartGrad)" />
									<path
										d={linePath}
										fill="none"
										stroke="#3390ec"
										stroke-width="1.5"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							);
						})()}
					</div>
				</div>

				{/* Recent System Activity Logs */}
				<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-4">
					<div class="flex items-center justify-between pb-3 border-b border-white/5">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#3390ec]">receipt_long</span>
							<h3 class="text-xs font-black uppercase tracking-wider text-white">
								آخرین رخدادها و فعالیت‌های امنیتی
							</h3>
						</div>
						<button
							onClick={() => handleNav('/owner/audit-logs')}
							class="text-xs text-[#3390ec] font-bold flex items-center gap-1 hover:underline"
						>
							مشاهده کامل لاگ‌ها
							<span class="material-symbols-outlined text-sm">chevron_left</span>
						</button>
					</div>

					<div class="space-y-2.5">
						<Show
							when={(stats()?.recent_activity?.length ?? 0) > 0}
							fallback={
								<div class="text-center py-8 text-xs text-white/40 font-bold">
									هیچ فعالیت امنیتی اخیراً ثبت نشده است. وضعیت سیستم کاملاً امن و پایدار است.
								</div>
							}
						>
							<For each={stats()?.recent_activity ?? []}>
								{(log) => (
									<div class="p-3.5 bg-black/30 border border-white/5 rounded-2xl flex items-center justify-between gap-3 text-xs">
										<div class="flex items-center gap-3">
											<span class="px-2.5 py-1 rounded-lg bg-[#3390ec]/10 border border-[#3390ec]/20 text-[10px] font-mono font-bold text-[#3390ec]">
												{log.action}
											</span>
											<div>
												<p class="text-white/80 font-bold text-xs">ادمین شناسه {log.owner_id}</p>
												<Show when={log.target_user_id}>
													<p class="text-[10px] text-white/40 font-medium">
														کاربر هدف: {log.target_user_id}
													</p>
												</Show>
											</div>
										</div>

										<div class="text-end text-[10px] text-white/40 font-mono">
											<div>
												{log.created_at
													? new Date(log.created_at).toLocaleTimeString('fa-IR', {
															hour: '2-digit',
															minute: '2-digit',
														})
													: '---'}
											</div>
											<div class="text-[#3390ec] mt-0.5">{log.ip_address || 'داخلی'}</div>
										</div>
									</div>
								)}
							</For>
						</Show>
					</div>
				</div>
			</Show>
		</div>
	);
};
