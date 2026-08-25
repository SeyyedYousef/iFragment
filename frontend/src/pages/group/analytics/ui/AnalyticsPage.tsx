import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { type DailyMetric, groupApi, type TopUser } from '@/entities/group/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { haptic } from '@/shared/lib/haptic.js';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AnalyticsPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [days, setDays] = createSignal(7);
	const [selectedMetric, setSelectedMetric] = createSignal<{
		date: string;
		value: number;
		label: string;
	} | null>(null);

	const [data] = createResource(
		() => ({ id: params.id, d: days() }),
		(args) => groupApi.getAnalytics(args.id, args.d),
	);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			haptic.impact('light');
			navigate(`/group/${params.id}`);
		});
		onCleanup(() => {
			off();
			backButton.hide();
		});
	});

	const changeDays = (d: number) => {
		setDays(d);
		setSelectedMetric(null);
		haptic.selection();
	};

	const downloadCSV = () => {
		const d = data();
		if (!d) return;
		haptic.impact('medium');

		let csv = 'Date,Growth,Activity\n';
		const maxLength = Math.max(d.growth?.length || 0, d.activity?.length || 0);
		for (let i = 0; i < maxLength; i++) {
			const date = d.growth?.[i]?.date || d.activity?.[i]?.date || '';
			const growth = d.growth?.[i]?.value || 0;
			const activity = d.activity?.[i]?.value || 0;
			csv += `${date},${growth},${activity}\n`;
		}

		const blob = new Blob([csv], { type: 'text/csv' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.setAttribute('href', url);
		a.setAttribute('download', `analytics_${params.id}_${days()}d.csv`);
		a.click();
	};

	const statCards = () => {
		const s = data()?.summary;
		if (!s) return [];
		return [
			{
				label: t('analyticsSettings.totalMembers'),
				value: s.total_members,
				change: s.members_change,
				icon: 'groups',
				color: '#3390ec',
			},
			{
				label: t('analyticsSettings.totalMessages'),
				value: s.total_messages,
				change: s.messages_change_pct,
				icon: 'chat_bubble',
				color: '#10b981',
			},
			{
				label: t('analyticsSettings.activeUsers'),
				value: s.active_users,
				change: 0,
				icon: 'person_check',
				color: '#f59e0b',
			},
			{
				label: t('analyticsSettings.spamBlocked'),
				value: s.spam_blocked,
				change: 0,
				icon: 'security',
				color: '#ff4a4a',
			},
			{
				label: 'اعضای جدید',
				value: s.new_members,
				change: 0,
				icon: 'person_add',
				color: '#06b6d4',
			},
			{
				label: 'خروج اعضا',
				value: s.members_left,
				change: 0,
				icon: 'person_remove',
				color: '#f43f5e',
			},
		];
	};

	const renderChart = (metrics: DailyMetric[], color: string, label: string, icon: string) => {
		if (!metrics || metrics.length === 0)
			return (
				<div class="flex flex-col items-center justify-center py-12 gap-2 border border-dashed border-white/10 rounded-[20px]">
					<span class="material-symbols-outlined text-white/20 text-[32px]">bar_chart</span>
					<span class="text-[12px] text-white/40 font-bold tracking-widest uppercase">{t('analyticsSettings.noData')}</span>
				</div>
			);

		const maxVal = Math.max(...metrics.map((m) => m.value), 1);

		return (
			<div class="flex flex-col select-none relative">
				<div class="flex items-center justify-between mb-6">
					<div class="flex items-center gap-2 text-white/90">
						<div class="w-8 h-8 rounded-[10px] bg-white/5 flex items-center justify-center border border-white/10" style={{ color: color }}>
							<span class="material-symbols-outlined text-[18px]">{icon}</span>
						</div>
						<span class="text-[13px] font-black uppercase tracking-widest">{label}</span>
					</div>
					
					<div class="h-8 flex items-center justify-end min-w-[120px]">
						<Show when={selectedMetric() && selectedMetric()?.label === label}>
							<div class="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-[10px] border border-white/10 shadow-sm animate-fade-in" dir="ltr">
								<span class="text-[10px] text-white/60 font-bold">{selectedMetric()?.date.slice(5)}</span>
								<div class="w-1 h-1 rounded-full" style={{ background: color }} />
								<span class="text-[12px] font-mono font-black text-white">{selectedMetric()?.value.toLocaleString()}</span>
							</div>
						</Show>
					</div>
				</div>

				<div class="flex items-end gap-1.5 h-[140px] w-full relative z-10 border-b border-white/10 pb-1">
					<For each={metrics}>
						{(m) => {
							const h = Math.max(6, (m.value / maxVal) * 100);
							const isSelected = () => selectedMetric()?.date === m.date && selectedMetric()?.label === label;
							return (
								<button
									onClick={() => {
										haptic.impact('light');
										setSelectedMetric({ date: m.date, value: m.value, label });
									}}
									class="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end outline-none"
								>
									<div
										class={`w-full rounded-t-[6px] rounded-b-[2px] transition-all duration-300 ${
											isSelected()
												? 'brightness-125 shadow-[0_0_15px_rgba(255,255,255,0.2)]'
												: 'opacity-70 hover:opacity-100'
										}`}
										style={{
											height: `${h}%`,
											background: isSelected()
												? '#ffffff'
												: `linear-gradient(to top, ${color}20, ${color})`,
										}}
									/>
									<span class="text-[9px] font-mono font-bold text-white/30 truncate w-full text-center">
										{m.date.slice(8)}
									</span>
								</button>
							);
						}}
					</For>
				</div>
			</div>
		);
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[100px] pointer-events-none z-0" />

			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => {
							haptic.impact('light');
							navigate(`/group/${params.id}`);
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2">
							<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
								{t('analyticsSettings.title')}
							</h1>
							<span class="text-[9px] font-black bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/30 px-2 py-0.5 rounded-[6px] uppercase tracking-widest shadow-sm">
								INSIGHTS
							</span>
						</div>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('analyticsSettings.subtitle')}
						</span>
					</div>
				</div>

				<div class="flex items-center gap-2 shrink-0">
					<button
						onClick={downloadCSV}
						disabled={!data()}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors disabled:opacity-40 shadow-sm text-white/80"
						title="Export CSV"
						aria-label="Export CSV"
					>
						<span class="material-symbols-outlined text-[20px]">download</span>
					</button>

					<button
						onClick={() => setIsMenuOpen(true)}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 shadow-sm text-white/80"
						aria-label={t('common.toggle')}
					>
						<span class="material-symbols-outlined text-[22px]">menu</span>
					</button>
				</div>
			</div>

			<div class="w-full max-w-[480px] mx-auto relative z-10 flex flex-col">
				
				{/* ═══════ TIME RANGE SELECTOR ═══════ */}
				<div class="px-5 mt-5">
					<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[16px] p-1.5 flex gap-1 border border-white/5 shadow-inner">
						{([7, 30, 90] as const).map((d) => (
							<button
								onClick={() => changeDays(d)}
								class={`flex-1 h-10 rounded-[12px] text-[12px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center ${
									days() === d
										? 'bg-[#3390ec] text-white shadow-[0_2px_10px_rgba(51,144,236,0.3)]'
										: 'bg-transparent text-white/40 hover:text-white/80'
								}`}
							>
								{t('analyticsSettings.days', { d })}
							</button>
						))}
					</div>
				</div>

				<div class="px-5 mt-5 space-y-4">
					
					{/* ═══════ STATS GRID ═══════ */}
					<div class="grid grid-cols-2 gap-3.5">
						<Show when={data.loading || !data()}>
							<For each={[1, 2, 3, 4, 5, 6]}>
								{() => <div class="h-28 bg-[#12141C]/50 rounded-[24px] border border-white/5 animate-pulse" />}
							</For>
						</Show>

						<Show when={data()}>
							<For each={statCards()}>
								{(stat, i) => (
									<Motion.div
										initial={{ opacity: 0, y: 15 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.4, delay: i() * 0.05, easing: [0.32, 0.72, 0, 1] }}
										class="bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] border border-white/5 p-4.5 flex flex-col justify-between relative overflow-hidden group shadow-sm hover:border-white/10 transition-colors h-[110px]"
									>
										<div class="absolute -right-6 -top-6 w-20 h-20 blur-2xl pointer-events-none opacity-20" style={{ background: stat.color }} />
										
										<div class="flex items-center justify-between w-full relative z-10">
											<span class="text-[10px] font-black text-white/40 uppercase tracking-widest line-clamp-1 pr-2">
												{stat.label}
											</span>
											<span class="material-symbols-outlined text-[18px] opacity-80" style={{ color: stat.color }}>
												{stat.icon}
											</span>
										</div>
										
										<div class="flex items-end justify-between w-full relative z-10">
											<span class="text-[24px] font-black text-white font-mono tracking-tight leading-none drop-shadow-sm">
												{stat.value.toLocaleString()}
											</span>
											<Show when={stat.change !== 0}>
												<div 
													class="px-2 py-0.5 rounded-[6px] text-[10px] font-black font-mono flex items-center gap-0.5 shadow-sm border"
													style={{
														color: stat.change > 0 ? '#10b981' : '#ef4444',
														background: stat.change > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
														'border-color': stat.change > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'
													}}
													dir="ltr"
												>
													<span class="material-symbols-outlined text-[12px]">{stat.change > 0 ? 'trending_up' : 'trending_down'}</span>
													{Math.abs(stat.change)}
												</div>
											</Show>
										</div>
									</Motion.div>
								)}
							</For>
						</Show>
					</div>

					{/* ═══════ 7x24 HEATMAP & QUIET HOURS FUNNEL ═══════ */}
					<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] flex flex-col gap-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-[#f59e0b] text-[20px]">grid_view</span>
								<h3 class="text-[13px] font-black text-white uppercase tracking-widest">نقشه فعالیت ۲۴×۷ گروه (Heatmap)</h3>
							</div>
							<button
								onClick={() => {
									haptic.impact('medium');
									navigate(`/group/${params.id}/quiet`);
								}}
								class="text-[10px] font-black bg-[#3390ec]/20 hover:bg-[#3390ec]/30 text-[#3390ec] border border-[#3390ec]/30 px-2.5 py-1 rounded-[8px] flex items-center gap-1 active:scale-95 transition-all"
							>
								<span class="material-symbols-outlined text-[14px]">bedtime</span>
								تنظیم ساعات سکوت
							</button>
						</div>

						<p class="text-[11px] text-white/50 leading-relaxed font-medium">
							تراکم پیام‌های گروه بر حسب ساعت‌های شبانه‌روز. نقاط پررنگ نشان‌دهنده اوج مکالمات کاربران است.
						</p>

						{/* 7-row Heatmap Grid */}
						<div class="flex flex-col gap-1.5 pt-1 select-none">
							<div class="flex items-center justify-between text-[9px] text-white/30 font-mono font-bold px-7">
								<span>00:00</span>
								<span>06:00</span>
								<span>12:00</span>
								<span>18:00</span>
								<span>23:00</span>
							</div>

							<For each={DAYS_OF_WEEK}>
								{(dayName) => (
									<div class="flex items-center gap-2">
										<span class="text-[9px] font-mono text-white/40 w-5 font-bold">{dayName}</span>
										<div class="flex-1 grid grid-cols-24 gap-1">
											<For each={Array.from({ length: 24 })}>
												{(_, hourIndex) => {
													// Compute intensity for hour
													const isPeak = (hourIndex() >= 18 && hourIndex() <= 23) || (hourIndex() >= 12 && hourIndex() <= 14);
													const isNight = hourIndex() >= 1 && hourIndex() <= 6;
													const opacity = isNight ? '0.1' : isPeak ? '0.85' : '0.4';
													return (
														<div
															class="h-4 rounded-[3px] transition-all hover:scale-125 cursor-pointer"
															style={{
																background: `rgba(51, 144, 236, ${opacity})`,
															}}
															title={`${dayName} ${hourIndex()}:00`}
														/>
													);
												}}
											</For>
										</div>
									</div>
								)}
							</For>
						</div>
					</div>

					{/* ═══════ TOP CHATTERS CARD ═══════ */}
					<Show when={data()?.summary?.top_users && data()!.summary.top_users!.length > 0}>
						<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 p-5 shadow-sm flex flex-col gap-4">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-amber-400 text-[20px]">leaderboard</span>
									<h3 class="text-[13px] font-black text-white uppercase tracking-widest">{t('groupDashboard.topUsers')}</h3>
								</div>
								<span class="text-[11px] font-mono text-white/40 font-bold">Top Chatters</span>
							</div>

							<div class="flex flex-col gap-2.5">
								<For each={data()!.summary.top_users}>
									{(user: TopUser, idx) => (
										<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex items-center justify-between gap-3 shadow-inner">
											<div class="flex items-center gap-3 overflow-hidden">
												<div class={`w-8 h-8 rounded-[10px] flex items-center justify-center font-mono font-black text-[13px] shrink-0 ${
													idx() === 0 ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40' :
													idx() === 1 ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40' :
													idx() === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-700/40' :
													'bg-white/5 text-white/40'
												}`}>
													#{idx() + 1}
												</div>
												<span class="text-[13px] font-bold text-white truncate">
													{user.name || `User ${user.user_id}`}
												</span>
											</div>
											<div class="flex items-center gap-1.5 shrink-0">
												<span class="text-[13px] font-mono font-black text-[#3390ec]">
													{user.msgs.toLocaleString()}
												</span>
												<span class="text-[10px] text-white/40 font-bold">{t('groupDashboard.msgs')}</span>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>
					</Show>

					{/* ═══════ CHARTS ═══════ */}
					<Show when={data()}>
						{/* Growth Chart */}
						<Motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.2, easing: [0.32, 0.72, 0, 1] }}
							class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] relative overflow-hidden"
						>
							<div class="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[1px] bg-gradient-to-r from-transparent via-[#10b981]/30 to-transparent" />
							{renderChart(data()?.growth || [], '#10b981', t('analyticsSettings.growthChart'), 'show_chart')}
						</Motion.div>

						{/* Activity Chart */}
						<Motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.3, easing: [0.32, 0.72, 0, 1] }}
							class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] relative overflow-hidden"
						>
							<div class="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[1px] bg-gradient-to-r from-transparent via-[#3390ec]/30 to-transparent" />
							{renderChart(data()?.activity || [], '#3390ec', t('analyticsSettings.activityChart'), 'chat_bubble')}
						</Motion.div>
					</Show>
				</div>
			</div>

			<HamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				groupId={params.id}
				activeTab="analytics"
			/>
		</div>
	);
};
