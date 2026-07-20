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
	const [selectedMetric, setSelectedMetric] = createSignal<{ date: string; value: number; label: string } | null>(null);

	const [data] = createResource(
		() => ({ id: params.id, d: days() }),
		(args) => groupApi.getAnalytics(args.id, args.d),
	);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => window.history.back());
		onCleanup(() => off());
	});

	const changeDays = (d: number) => {
		setDays(d);
		setSelectedMetric(null);
		hapticFeedback.selectionChanged();
	};

	const downloadCSV = () => {
		const d = data();
		if (!d) return;
		hapticFeedback.impactOccurred('medium');

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

	const renderChart = (metrics: DailyMetric[], color: string, label: string) => {
		if (!metrics || metrics.length === 0)
			return (
				<div class="flex items-center justify-center py-8">
					<span class="text-xs text-white/40 font-bold">داده‌ای ثبت نشده است</span>
				</div>
			);
		const maxVal = Math.max(...metrics.map((m) => m.value), 1);

		return (
			<div class="space-y-3 select-none">
				<div class="flex items-center justify-between">
					<span class="text-xs font-black text-white">{label}</span>
					<Show when={selectedMetric() && selectedMetric()?.label === label}>
						<span class="text-[11px] font-mono font-black text-[#3390ec] bg-[#3390ec]/10 px-2 py-0.5 rounded-md">
							{selectedMetric()?.date}: {selectedMetric()?.value.toLocaleString()}
						</span>
					</Show>
				</div>

				<div class="flex items-end gap-1.5 h-36 pt-4 pb-1">
					<For each={metrics}>
						{(m) => {
							const h = Math.max(8, (m.value / maxVal) * 100);
							const isSelected = () => selectedMetric()?.date === m.date && selectedMetric()?.label === label;
							return (
								<button
									onClick={() => {
										hapticFeedback.impactOccurred('light');
										setSelectedMetric({ date: m.date, value: m.value, label });
									}}
									class="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end outline-none"
								>
									<div
										class={`w-full rounded-xl transition-all duration-200 ${
											isSelected() ? 'brightness-150 ring-2 ring-white scale-105' : 'hover:brightness-125'
										}`}
										style={{
											height: `${h}%`,
											background: `linear-gradient(to top, ${color}cc, ${color})`,
										}}
									/>
								</button>
							);
						}}
					</For>
				</div>
				<div class="flex justify-between text-[10px] text-white/40 font-mono">
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
			{
				icon: 'person_add',
				label: t('analyticsSettings.newMembers') || 'اعضای جدید',
				value: s?.new_members ?? 0,
				color: '#10b981',
				change: calcTrend(growth),
			},
			{
				icon: 'chat_bubble',
				label: t('analyticsSettings.totalMessages') || 'کل پیام‌ها',
				value: s?.total_messages ?? 0,
				color: '#3390ec',
				change: calcTrend(activity),
			},
			{
				icon: 'calculate',
				label: t('analyticsSettings.avgPerDay') || 'میانگین روزانه',
				value: s ? Math.round(s.total_messages / Math.max(days(), 1)) : 0,
				color: '#f59e0b',
				change: 0,
			},
			{
				icon: 'block',
				label: 'اسپم مسدود شده',
				value: s?.spam_blocked ?? 0,
				color: '#ef4444',
				change: 0,
			},
			{
				icon: 'people',
				label: 'اعضای فعال',
				value: s?.active_users ?? 0,
				color: '#06b6d4',
				change: 0,
			},
			{
				icon: 'person_remove',
				label: 'اعضای خروجی',
				value: s?.members_left ?? 0,
				color: '#ef4444',
				change: 0,
			},
		];
	};

	return (
		<div class="theme-control min-h-screen bg-[#08090D] pb-12 relative text-white select-none">
			{/* Top Bar Header */}
			<div class="px-5 pt-5 pb-4 sticky top-0 bg-[#0F1117]/90 backdrop-blur-md z-30 border-b border-white/10 flex items-center justify-between gap-3">
				<div class="flex items-center gap-3 overflow-hidden flex-1">
					<button
						onClick={() => {
							hapticFeedback.impactOccurred('light');
							window.history.back();
						}}
						class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0"
						aria-label="بازگشت"
					>
						<span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-base font-black text-white leading-tight truncate">
							{t('analyticsSettings.title') || 'آمار و آنالیز گروه'}
						</h1>
						<p class="text-xs text-white/50 truncate font-bold">
							{t('analyticsSettings.subtitle') || 'تحلیل ترافیک و تعاملات روزانه'}
						</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button
						onClick={downloadCSV}
						class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors shrink-0"
						title="دریافت فایل خروجی CSV"
					>
						<span class="material-symbols-outlined text-[#3390ec] text-[20px]">download</span>
					</button>
					<button
						onClick={() => setIsMenuOpen(true)}
						class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0"
						aria-label="منوی مدیریتی"
					>
						<span class="material-symbols-outlined text-white text-[20px]">menu</span>
					</button>
				</div>
			</div>

			<div class="px-5">
				{/* Date Range Selection */}
				<div class="flex gap-2 mt-4">
					{([7, 30, 90] as const).map((d) => (
						<button
							onClick={() => changeDays(d)}
							class={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
								days() === d
									? 'bg-[#3390ec]/20 border-[#3390ec]/50 text-[#3390ec]'
									: 'bg-[#151822] border-white/10 text-white/50 hover:text-white'
							}`}
						>
							{d === 7 ? '۷ روز اخیر' : d === 30 ? '۳۰ روز اخیر' : '۹۰ روز اخیر'}
						</button>
					))}
				</div>
			</div>

			<HamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				groupId={params.id}
				activeTab="analytics"
			/>

			<div class="px-5 mt-4 space-y-4">
				{/* Stats Grid */}
				<div class="grid grid-cols-2 gap-3">
					<For each={statCards()}>
						{(stat, i) => (
							<Motion.div
								initial={{ opacity: 0, y: 15 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, delay: i() * 0.05 }}
								class="bg-[#151822] rounded-[20px] border border-white/10 p-4 flex flex-col gap-1"
							>
								<div class="flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[16px]" style={{ color: stat.color }}>
										{stat.icon}
									</span>
									<span class="text-[11px] font-bold text-white/50 uppercase">{stat.label}</span>
								</div>
								<span class="text-xl font-black text-white font-mono">{stat.value.toLocaleString()}</span>
								<Show when={stat.change !== 0}>
									<span
										class={`text-[11px] font-bold ${stat.change > 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}
									>
										{stat.change > 0 ? '↑' : '↓'} {Math.abs(stat.change)}{' '}
										{stat.change > 0 ? 'رشد' : 'افت'}
									</span>
								</Show>
							</Motion.div>
						)}
					</For>
				</div>

				{/* Growth Chart */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, delay: 0.2 }}
					class="bg-[#151822] rounded-[24px] border border-white/10 p-5"
				>
					{renderChart(data()?.growth || [], '#10b981', 'نمودار رشد اعضا')}
				</Motion.div>

				{/* Activity Chart */}
				<Motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, delay: 0.3 }}
					class="bg-[#151822] rounded-[24px] border border-white/10 p-5"
				>
					{renderChart(data()?.activity || [], '#3390ec', 'نمودار فعالیت پیام‌ها')}
				</Motion.div>
			</div>
		</div>
	);
};
