import { Motion } from '@motionone/solid';
import { useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { DailyMetric } from '@/shared/api/bot-management.js';
import { groupApi } from '@/shared/api/bot-management.js';
import { t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';

export const AnalyticsPage: Component = () => {
	const params = useParams();
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
			try { hapticFeedback.impactOccurred('light'); } catch (_) {}
			window.history.back();
		});
		onCleanup(() => {
			off();
			backButton.hide();
		});
	});

	const changeDays = (d: number) => {
		setDays(d);
		setSelectedMetric(null);
		try { hapticFeedback.selectionChanged(); } catch (_) {}
	};

	const downloadCSV = () => {
		const d = data();
		if (!d) return;
		try { hapticFeedback.impactOccurred('medium'); } catch (_) {}

		let csv = 'Date,Growth,Activity\n';
		const maxLength = Math.max(d.growth.length, d.activity.length);
		for (let i = 0; i < maxLength; i++) {
			const date = d.growth[i]?.date || d.activity[i]?.date || '';
			const growth = d.growth[i]?.value || 0;
			const activity = d.activity[i]?.value || 0;
			csv += `${date},${growth},${activity}\n`;
		}

		const blob = new Blob([csv], { type: 'text/csv' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.setAttribute('href', url);
		a.setAttribute('download', `analytics_${params.id}_${days()}d.csv`);
		a.click();
	};

	const renderChart = (metrics: DailyMetric[], color: string, label: string, icon: string) => {
		if (!metrics || metrics.length === 0)
			return (
				<div class="flex flex-col items-center justify-center py-12 gap-2 border border-dashed border-white/10 rounded-[20px]">
					<span class="material-symbols-outlined text-white/20 text-[32px]">bar_chart</span>
					<span class="text-[12px] text-white/40 font-bold tracking-widest uppercase">No Data Available</span>
				</div>
			);

		const maxVal = Math.max(...metrics.map((m) => m.value), 1);

		return (
			<div class="flex flex-col select-none relative">
				{/* Chart Header */}
				<div class="flex items-center justify-between mb-6">
					<div class="flex items-center gap-2 text-white/90">
						<div class="w-8 h-8 rounded-[10px] bg-white/5 flex items-center justify-center border border-white/10" style={{ color: color }}>
							<span class="material-symbols-outlined text-[18px]">{icon}</span>
						</div>
						<span class="text-[13px] font-black uppercase tracking-widest">{label}</span>
					</div>
					
					{/* Floating Tooltip / Badge */}
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

				{/* Bars Area */}
				<div class="flex items-end gap-1.5 h-[140px] w-full relative z-10 border-b border-white/10 pb-1">
					<For each={metrics}>
						{(m) => {
							const h = Math.max(6, (m.value / maxVal) * 100);
							const isSelected = () => selectedMetric()?.date === m.date && selectedMetric()?.label === label;
							return (
								<button
									onClick={() => {
										try { hapticFeedback.impactOccurred('light'); } catch (_) {}
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
											background: isSelected() ? color : `linear-gradient(to top, ${color}40, ${color})`,
										}}
									/>
								</button>
							);
						}}
					</For>
				</div>
				
				{/* X-Axis Labels */}
				<div class="flex justify-between text-[10px] text-white/40 font-mono font-bold mt-2 px-1">
					<span>{metrics[0]?.date.slice(5)}</span>
					<span>{metrics[metrics.length - 1]?.date.slice(5)}</span>
				</div>
			</div>
		);
	};

	const statCards = () => {
		const s = data()?.summary;
		const growth = data()?.growth || [];
		const activity = data()?.activity || [];

		const calcTrend = (arr: DailyMetric[]) => {
			if (arr.length < 2) return 0;
			const first = arr[0].value;
			const last = arr[arr.length - 1].value;
			return last - first;
		};

		return [
			{ icon: 'person_add', label: t('analyticsSettings.newMembers') || 'NEW MEMBERS', value: s?.new_members ?? 0, color: '#10b981', change: calcTrend(growth) },
			{ icon: 'chat_bubble', label: t('analyticsSettings.totalMessages') || 'TOTAL MSGS', value: s?.total_messages ?? 0, color: '#3390ec', change: calcTrend(activity) },
			{ icon: 'calculate', label: t('analyticsSettings.avgPerDay') || 'AVG PER DAY', value: s ? Math.round(s.total_messages / Math.max(days(), 1)) : 0, color: '#f59e0b', change: 0 },
			{ icon: 'block', label: 'SPAM BLOCKED', value: s?.spam_blocked ?? 0, color: '#ef4444', change: 0 },
			{ icon: 'people', label: 'ACTIVE USERS', value: s?.active_users ?? 0, color: '#06b6d4', change: 0 },
			{ icon: 'person_remove', label: 'MEMBERS LEFT', value: s?.members_left ?? 0, color: '#ef4444', change: 0 },
		];
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-12 relative text-white select-none font-sans" dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#3390ec]/15 via-[#10b981]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="px-5 pt-6 pb-4 sticky top-0 bg-[#030303]/80 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => { try { hapticFeedback.impactOccurred('light'); } catch (_) {} window.history.back(); }}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm"
					>
						<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[17px] font-black text-white leading-tight truncate tracking-tight">
							{t('analyticsSettings.title') || 'Analytics'}
						</h1>
						<p class="text-[11px] text-white/50 truncate font-bold uppercase tracking-wider mt-0.5">
							{t('analyticsSettings.subtitle') || 'Group Traffic & Engagement'}
						</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button
						onClick={downloadCSV}
						class="w-11 h-11 rounded-[14px] bg-[#3390ec]/10 flex items-center justify-center border border-[#3390ec]/30 hover:bg-[#3390ec]/20 active:scale-95 transition-all shrink-0 shadow-sm text-[#3390ec]"
					>
						<span class="material-symbols-outlined text-[22px]">download</span>
					</button>
					<button
						onClick={() => setIsMenuOpen(true)}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
					>
						<span class="material-symbols-outlined text-[22px]">menu</span>
					</button>
				</div>
			</div>

			<div class="w-full max-w-[480px] mx-auto relative z-10 flex flex-col">
				
				{/* ═══════ TIME RANGE SELECTOR (iOS Segmented Control) ═══════ */}
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
								{d} DAYS
							</button>
						))}
					</div>
				</div>

				<div class="px-5 mt-5 space-y-4">
					
					{/* ═══════ STATS GRID (Crypto PnL Style) ═══════ */}
					<div class="grid grid-cols-2 gap-3.5">
						<Show when={data.loading || !data()}>
							{/* Loading Skeletons */}
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
										{/* Ambient Inner Glow */}
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
											<span class="text-[26px] font-black text-white font-mono tracking-tight leading-none drop-shadow-sm">
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
							{renderChart(data()?.growth || [], '#10b981', 'MEMBERS GROWTH', 'show_chart')}
						</Motion.div>

						{/* Activity Chart */}
						<Motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.3, easing: [0.32, 0.72, 0, 1] }}
							class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] border border-white/5 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] relative overflow-hidden"
						>
							<div class="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[1px] bg-gradient-to-r from-transparent via-[#3390ec]/30 to-transparent" />
							{renderChart(data()?.activity || [], '#3390ec', 'MESSAGE ACTIVITY', 'chat_bubble')}
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
