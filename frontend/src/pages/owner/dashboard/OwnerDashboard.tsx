import { useNavigate } from '@solidjs/router';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { apiClient } from '@/shared/api/axios.js';

import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';

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
		payload?: any;
		ip_address?: string;
		created_at: string;
	}>;
	dau_chart: Array<{ date: string; value: number }>;
	coin_flow_chart: Array<{ date: string; value: number }>;
}

const MiniChart: Component<{ data: Array<{ date: string; value: number }>; color: string }> = (props) => {
	const max = () => Math.max(...props.data.map((d) => d.value), 1);
	return (
		<div class="flex items-end justify-between h-12 w-full mt-3 gap-1">
			<For each={props.data}>
				{(d) => (
					<div class="relative w-full flex justify-center group">
						<div
							class={`w-full max-w-[8px] rounded-t-sm transition-all duration-300 ${props.color}`}
							style={{ height: `${(d.value / max()) * 100}%` }}
						/>
						<div class="absolute -top-8 bg-black/80 px-2 py-1 rounded text-[9px] font-black opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
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

	onMount(async () => {
		try {
			const resp = await apiClient.get('/owner/dashboard/stats');
			setStats(resp.data);
		} catch (err: any) {
			setError(
				err.response?.data?.error || 'Failed to fetch dashboard metrics. Unauthorized access.',
			);
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} finally {
			setLoading(false);
		}
	});

	const handleLogout = () => {
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}
		sessionStorage.removeItem('owner_token');
		sessionStorage.removeItem('owner_telegram_id');
		navigate('/profile');
	};

	const handleNav = (path: string) => {
		try {
			hapticFeedback.impactOccurred('light');
		} catch {}
		navigate(path);
	};

	return (
		<div class="min-h-screen bg-[#090a0f] text-white pb-32">
			{/* Premium Header Glow */}
			<div class="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-[#3390ec]/15 to-transparent pointer-events-none blur-[60px]" />

			{/* Admin Panel Header */}
			<div class="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/5 relative z-10">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#3390ec] to-[#2b7ec9] flex items-center justify-center text-xl shadow-lg shadow-[#3390ec]/10">
						🛡️
					</div>
					<div>
						<h1 class="text-sm font-black uppercase tracking-wider text-white">پنل مدیریت</h1>
						<p class="text-[9px] text-[#3390ec] font-black uppercase tracking-widest mt-0.5">
							مرکز کنترل سرور
						</p>
					</div>
				</div>

				<button
					onClick={handleLogout}
					class="h-9 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-[10px] font-black text-red-400 rounded-xl uppercase tracking-wider transition-all flex items-center gap-1.5"
				>
					<span class="material-symbols-outlined text-[14px]">logout</span>
					خروج از پنل
				</button>
			</div>

			{/* Tabs / Navigation Subheader */}
			<OwnerTabs active="dashboard" />

			{/* Main Content Area */}
			<div class="px-6 mt-6 relative z-10">
				<Show when={error()}>
					<div class="p-4 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-start gap-3 animate-fade-in mb-6">
						<span class="material-symbols-outlined text-red-500 mt-0.5">error</span>
						<div>
							<h3 class="text-sm font-black text-white">خطای دسترسی</h3>
							<p class="text-xs text-red-400 mt-1 leading-relaxed">{error()}</p>
						</div>
					</div>
				</Show>

				<Show
					when={!loading()}
					fallback={
						<div class="flex flex-col items-center justify-center py-20 gap-4">
							<div class="w-10 h-10 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
							<span class="text-xs text-[#a0a4ad] font-bold">
								در حال همگام‌سازی اطلاعات سرور...
							</span>
						</div>
					}
				>
					<Show when={stats()}>
						{/* Grid of Key Metrics */}
						<div class="grid grid-cols-2 gap-3 mb-6">
							{/* DAU */}
							<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-4 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
								<div class="flex items-center justify-between mb-2">
									<span class="text-[10px] text-[#a0a4ad] font-black uppercase tracking-wider">
										فعالین امروز (DAU)
									</span>
									<div class="w-6 h-6 rounded-lg bg-[#34c759]/10 flex items-center justify-center text-[#34c759] text-xs">
										⚡
									</div>
								</div>
								<span class="text-2xl font-black text-white">
									{(stats()?.dau ?? 0).toLocaleString()}
								</span>
								<span class="text-[9px] text-[#34c759] font-bold mt-1">
									تعداد کاربرانی که امروز فعال بوده‌اند
								</span>
								<Show when={stats()?.dau_chart?.length}>
									<MiniChart data={stats()!.dau_chart} color="bg-[#34c759]" />
								</Show>
							</div>

							{/* MAU */}
							<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-4 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
								<div class="flex items-center justify-between mb-2">
									<span class="text-[10px] text-[#a0a4ad] font-black uppercase tracking-wider">
										فعالین ماه (MAU)
									</span>
									<div class="w-6 h-6 rounded-lg bg-[#3390ec]/10 flex items-center justify-center text-[#3390ec] text-xs">
										📊
									</div>
								</div>
								<span class="text-2xl font-black text-white">
									{(stats()?.mau ?? 0).toLocaleString()}
								</span>
								<span class="text-[9px] text-[#3390ec] font-bold mt-1">30 days retention rate</span>
							</div>

							{/* Total Users */}
							<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-4 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
								<div class="flex items-center justify-between mb-2">
									<span class="text-[10px] text-[#a0a4ad] font-black uppercase tracking-wider">
										کل کاربران ثبت نامی
									</span>
									<div class="w-6 h-6 rounded-lg bg-[#5856d6]/10 flex items-center justify-center text-[#5856d6] text-xs">
										👥
									</div>
								</div>
								<span class="text-2xl font-black text-white">
									{(stats()?.total_users ?? 0).toLocaleString()}
								</span>
								<span class="text-[9px] text-[#a0a4ad] font-bold mt-1">تعداد اعضای دیتابیس</span>
							</div>

							{/* Coins Circulation */}
							<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-4 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
								<div class="flex items-center justify-between mb-2">
									<span class="text-[10px] text-[#a0a4ad] font-black uppercase tracking-wider">
										سکه‌های در گردش
									</span>
									<div class="w-6 h-6 rounded-lg bg-[#ffcc00]/10 flex items-center justify-center text-[#ffcc00] text-xs">
										🪙
									</div>
								</div>
								<span class="text-lg font-black text-white truncate">
									{Math.round(stats()?.frg_circulation ?? 0).toLocaleString()} سکه
								</span>
								<span class="text-[9px] text-[#ffcc00] font-bold mt-1">
									کل سکه‌های ارائه شده در سیستم
								</span>
							</div>
						</div>

						{/* Stars Volume card */}
						<div class="w-full bg-gradient-to-r from-[#ffd21e]/20 to-[#ffd21e]/5 border border-[#ffd21e]/30 rounded-3xl p-5 mb-6 hover:scale-[1.01] transition-all duration-300 flex justify-between items-center">
							<div>
								<span class="text-[10px] text-[#ffd21e] font-black uppercase tracking-widest block mb-1">
									حجم خریدهای تلگرام
								</span>
								<h3 class="text-2xl font-black text-white">
									{Number(stats()?.stars_volume ?? 0).toFixed(0)} ⭐
								</h3>
								<span class="text-[9px] text-white/50 font-bold block mt-0.5">
									درآمد ناخالص از خرید ستاره‌های تلگرام
								</span>
							</div>
							<div class="w-1/3">
								<Show when={stats()?.coin_flow_chart?.length}>
									<MiniChart data={stats()!.coin_flow_chart} color="bg-[#ffd21e]" />
								</Show>
							</div>
							<div class="w-12 h-12 rounded-2xl bg-black/20 flex items-center justify-center text-xl shrink-0">
								💳
							</div>
						</div>

						{/* Custom SVG Line Chart for Network traffic trend */}
						<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 mb-6 hover:scale-[1.01] transition-all duration-300">
							<div class="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
								<span class="material-symbols-outlined text-[#3390ec] text-[18px]">
									trending_up
								</span>
								<h3 class="text-xs font-black uppercase tracking-wider text-white">
									رشد ترافیک کاربران
								</h3>
							</div>
							<div class="h-28 w-full relative overflow-hidden flex items-end">
								{/* SVG Area with neon gradient */}
								<svg class="w-full h-24" viewBox="0 0 100 30" preserveAspectRatio="none">
									<defs>
										<linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stop-color="#3390ec" stop-opacity="0.35" />
											<stop offset="100%" stop-color="#3390ec" stop-opacity="0" />
										</linearGradient>
									</defs>

									{/* Glowing Fill */}
									<path
										d="M 0 30 Q 15 15 30 20 T 60 10 T 85 14 T 100 8 L 100 30 Z"
										fill="url(#chartGradient)"
									/>

									{/* Glowing Line */}
									<path
										d="M 0 30 Q 15 15 30 20 T 60 10 T 85 14 T 100 8"
										fill="none"
										stroke="#3390ec"
										stroke-width="1.5"
										stroke-linecap="round"
									/>

									{/* Grid Lines */}
									<line
										x1="0"
										y1="10"
										x2="100"
										y2="10"
										stroke="white"
										stroke-opacity="0.03"
										stroke-width="0.5"
									/>
									<line
										x1="0"
										y1="20"
										x2="100"
										y2="20"
										stroke="white"
										stroke-opacity="0.03"
										stroke-width="0.5"
									/>
								</svg>

								{/* Animated Indicator dot */}
								<div class="absolute top-[28px] right-[4px] w-2 h-2 bg-[#3390ec] rounded-full border border-white shadow-[0_0_8px_#3390ec] animate-ping pointer-events-none" />
							</div>

							{/* Timeline labels */}
							<div class="flex justify-between text-[8px] text-[#a0a4ad] font-bold mt-3 uppercase tracking-wider">
								<span>دوشنبه</span>
								<span>سه‌شنبه</span>
								<span>چهارشنبه</span>
								<span>پنجشنبه</span>
								<span>جمعه</span>
								<span>شنبه</span>
								<span>یکشنبه</span>
							</div>
						</div>

						{/* Recent Audit Activities */}
						<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 mb-6">
							<div class="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-[#3390ec]">receipt_long</span>
									<h3 class="text-xs font-black uppercase tracking-wider text-white">
										فعالیت‌های اخیر
									</h3>
								</div>
								<button
									onClick={() => handleNav('/owner/audit-logs')}
									class="text-[9px] text-[#3390ec] font-black uppercase tracking-wider flex items-center gap-0.5 hover:underline"
								>
									مشاهده همه
									<span class="material-symbols-outlined text-[12px]">chevron_left</span>
								</button>
							</div>

							<div class="flex flex-col gap-3">
								<Show
									when={(stats()?.recent_activity?.length ?? 0) > 0}
									fallback={
										<div class="text-center py-6 text-xs text-[#a0a4ad] font-bold">
											هیچ لاگ امنیتی یافت نشد. وضعیت عادی است.
										</div>
									}
								>
									<For each={stats()?.recent_activity ?? []}>
										{(log) => (
											<div class="p-3 bg-[#0f1014]/60 border border-[#2a2c35]/20 rounded-2xl flex items-center justify-between gap-3 text-xs">
												<div class="flex flex-col gap-1 min-w-0">
													<div class="flex items-center gap-2">
														<span class="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-wide text-white">
															{log.action}
														</span>
														<span class="text-[9px] text-[#a0a4ad] font-bold">
															توسط ادمین {log.owner_id}
														</span>
													</div>
													<Show when={log.target_user_id}>
														<span class="text-[10px] text-white/80 font-medium truncate">
															کاربر هدف: {log.target_user_id}
														</span>
													</Show>
												</div>
												<div class="flex flex-col items-end gap-1 flex-shrink-0">
													<span class="text-[9px] text-[#a0a4ad] font-bold">
														{log.created_at
															? new Date(log.created_at).toLocaleTimeString([], {
																	hour: '2-digit',
																	minute: '2-digit',
																})
															: 'نامشخص'}
													</span>
													<span class="text-[8px] text-[#3390ec] font-bold">
														{log.ip_address || 'سرور'}
													</span>
												</div>
											</div>
										)}
									</For>
								</Show>
							</div>
						</div>
					</Show>
				</Show>
			</div>
		</div>
	);
};
