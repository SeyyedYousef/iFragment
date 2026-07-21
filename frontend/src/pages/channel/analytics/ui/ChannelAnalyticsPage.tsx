import { Motion } from '@motionone/solid';
import { useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import {
	Component,
	createMemo,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { t } from '@/shared/i18n/index.js';
import { ChannelContextBar } from '@/shared/ui/ChannelContextBar.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';

export const ChannelAnalyticsPage: Component = () => {
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [timeRange, setTimeRange] = createSignal('30d');
	const [showCiModal, setShowCiModal] = createSignal(false);

	const [analytics] = createResource(
		() => ({ id: params.id, range: timeRange() }),
		({ id, range }) => {
			const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
			return channelApi.getAnalytics(id, days);
		},
	);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => window.history.back());
		onCleanup(() => off());
	});

	const timeline = createMemo(() => analytics()?.timeline || []);

	const growthData = createMemo(() => {
		const arr = timeline().map((t: any) => t.subscribers_count);
		return arr.length > 0 ? arr : [0];
	});

	const postViewsData = createMemo(() => {
		const arr = timeline().map((t: any) => t.views_count);
		return arr.length > 0 ? arr : [0];
	});

	const getErrColor = (err: number) => {
		if (err > 5) return 'text-[#10b981]';
		if (err >= 2) return 'text-[#f59e0b]';
		return 'text-[#ef4444]';
	};

	const maxGrowth = createMemo(() => Math.max(1, ...growthData()));
	const maxViews = createMemo(() => Math.max(1, ...postViewsData()));

	return (
		<div class="theme-control min-h-screen bg-[#08090D] pb-28 relative overflow-x-hidden text-white select-none">
			{/* Header */}
			<div class="px-5 pt-5 pb-4 bg-[#0F1117]/90 backdrop-blur-md sticky top-0 z-30 border-b border-white/10 flex items-center justify-between gap-3">
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
							{t('channelAnalytics.analyticsAndStats') || 'تحلیل و آنالیز کانال'}
						</h1>
						<span class="text-xs text-white/50 truncate font-bold">
							{t('channelAnalytics.deepDive') || 'آمار تفکیکی رشد و تعامل مخاطبان'}
						</span>
					</div>
				</div>

				<button
					onClick={() => setIsMenuOpen(true)}
					class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0"
					aria-label="منوی کانال"
				>
					<span class="material-symbols-outlined text-white text-[20px]">menu</span>
				</button>
			</div>

			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="analytics"
			/>

			<div class="px-5 pt-5 flex flex-col gap-5">
				<ChannelContextBar channelId={params.id} />

				{/* Time Range Selector */}
				<div class="flex bg-black/40 p-1 rounded-xl border border-white/10">
					<For each={['7d', '30d', '90d']}>
						{(range) => (
							<button
								onClick={() => {
									hapticFeedback.selectionChanged();
									setTimeRange(range);
								}}
								class={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
									timeRange() === range
										? 'bg-[#3390ec] text-white shadow-sm'
										: 'text-white/50 hover:text-white'
								}`}
							>
								{range === '7d' ? '۷ روز' : range === '30d' ? '۳۰ روز' : '۹۰ روز'}
							</button>
						)}
					</For>
				</div>

				<div class="grid grid-cols-2 gap-3">
					{/* ERR Card */}
					<div class="bg-[#151822] p-4 rounded-[20px] border border-white/10 flex flex-col gap-1">
						<span class="material-symbols-outlined text-[#3390ec] text-[20px] mb-1">
							trending_up
						</span>
						<h3
							class={`text-2xl font-black font-mono ${getErrColor(analytics()?.summary?.engagement_rate ?? 0)}`}
						>
							{analytics()?.summary?.engagement_rate ?? 0}%
						</h3>
						<p class="text-xs text-white/50 font-bold">نرخ تعامل (ERR)</p>
					</div>

					{/* Citation Index Card */}
					<button
						onClick={() => {
							hapticFeedback.impactOccurred('light');
							setShowCiModal(true);
						}}
						class="bg-[#151822] p-4 rounded-[20px] border border-white/10 flex flex-col gap-1 relative overflow-hidden text-start hover:border-[#06b6d4]/40 transition-all active:scale-95"
					>
						<span class="material-symbols-outlined text-[#06b6d4] text-[20px] mb-1">
							workspace_premium
						</span>
						<div class="flex items-end gap-2">
							<h3 class="text-2xl font-black text-white font-mono">
								{analytics()?.summary?.citation_index || 'A+'}
							</h3>
							<span class="text-xs font-bold text-[#06b6d4] mb-1">Top 5%</span>
						</div>
						<p class="text-xs text-white/50 font-bold flex items-center justify-between">
							<span>شاخص اعتبار (CI)</span>
							<span class="material-symbols-outlined text-[14px]">info</span>
						</p>
					</button>

					{/* Member Growth Line Chart */}
					<div class="bg-[#151822] p-5 rounded-[24px] border border-white/10 flex flex-col gap-2 col-span-2">
						<div class="flex items-center justify-between">
							<div class="flex flex-col">
								<span class="text-xs text-white/50 font-bold">رشد اعضای کانال</span>
								<div class="flex items-end gap-2">
									<h3 class="text-2xl font-black text-white font-mono">
										+{(analytics()?.summary?.new_members || 0).toLocaleString()}
									</h3>
									<Show when={analytics()?.summary?.new_members_today}>
										<span class="text-xs font-bold text-[#10b981] mb-1 font-mono">
											+{analytics()?.summary?.new_members_today || 0} امروز
										</span>
									</Show>
								</div>
							</div>
							<span class="material-symbols-outlined text-[#10b981] text-[20px]">groups</span>
						</div>

						<div class="h-20 w-full flex items-end gap-1 mt-2">
							<For each={growthData()}>
								{(point) => (
									<div
										class="flex-1 bg-[#10b981]/20 hover:bg-[#10b981] transition-colors rounded-t-sm"
										style={{ height: `${(point / maxGrowth()) * 100}%` }}
									/>
								)}
							</For>
						</div>
					</div>

					{/* Views Per Post Bar Chart */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
						class="bg-[#151822] rounded-[24px] border border-white/10 p-5 flex flex-col gap-2 col-span-2"
					>
						<div class="flex items-center justify-between">
							<div class="flex flex-col">
								<span class="text-xs text-white/50 font-bold">میانگین بازدید هر پست</span>
								<h3 class="text-2xl font-black text-white font-mono">
									{(analytics()?.summary?.total_views || 0).toLocaleString()}
								</h3>
							</div>
							<span class="material-symbols-outlined text-[#3390ec] text-[20px]">visibility</span>
						</div>

						<div class="h-24 w-full flex items-end gap-2 justify-between mt-2">
							<For each={postViewsData()}>
								{(views) => (
									<div class="flex flex-col items-center gap-1 flex-1 h-full justify-end">
										<div
											class="w-full bg-[#3390ec]/20 hover:bg-[#3390ec] transition-colors rounded-t-sm"
											style={{ height: `${(views / maxViews()) * 100}%` }}
										/>
									</div>
								)}
							</For>
						</div>
					</Motion.div>
				</div>
			</div>

			{/* Citation Index Explanation Sheet */}
			<Show when={showCiModal()}>
				<div
					onClick={() => setShowCiModal(false)}
					class="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-sm flex items-end justify-center p-0 md:p-6"
				>
					<div
						onClick={(e) => e.stopPropagation()}
						class="w-full max-w-lg bg-[#151822] border-t md:border border-white/10 rounded-t-[28px] md:rounded-[28px] p-6 space-y-4 shadow-2xl animate-slide-up"
					>
						<div class="flex items-center justify-between border-b border-white/10 pb-3">
							<div class="flex items-center gap-2 text-[#06b6d4]">
								<span class="material-symbols-outlined text-2xl">workspace_premium</span>
								<h3 class="text-base font-black">شاخص اعتبار کانال (Citation Index)</h3>
							</div>
							<button onClick={() => setShowCiModal(false)} class="text-white/50 hover:text-white">
								<span class="material-symbols-outlined">close</span>
							</button>
						</div>

						<p class="text-xs text-white/70 leading-relaxed font-bold">
							شاخص اعتبار (CI) بر برپایه میزان ارجاع سایر کانال‌ها، فوروارد بازنشرها، پایداری
							بازدیدها و اصالت محتوای کانال محاسبه می‌گردد.
						</p>

						<div class="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2 text-xs">
							<div class="flex items-center justify-between">
								<span class="font-bold text-white/50">رتبه فعلی کانال:</span>
								<span class="font-black text-[#06b6d4] font-mono">برتر ۵٪ شبکه (Top 5%)</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="font-bold text-white/50">کلاس کیفیت:</span>
								<span class="font-black text-[#10b981] font-mono">A+ (محتوای مرجع)</span>
							</div>
						</div>

						<button
							onClick={() => setShowCiModal(false)}
							class="w-full h-12 bg-white/10 hover:bg-white/15 rounded-xl font-bold text-xs text-white"
						>
							متوجه شدم
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};
