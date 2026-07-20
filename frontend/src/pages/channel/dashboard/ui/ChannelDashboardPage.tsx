import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl } from '@/shared/i18n/index.js';
import { ChannelHamburgerMenu } from '@/shared/ui/channel-hamburger-menu.js';
import { FragmentPulse } from '@/shared/ui/FragmentPulse.js';

export const ChannelDashboardPage: Component = () => {
	const params = useParams();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [showTooltip, setShowTooltip] = createSignal(true);

	const [channel] = createResource(
		() => params.id,
		(id) => channelApi.getChannel(id),
	);

	const [analytics] = createResource(
		() => params.id,
		(id) => channelApi.getAnalytics(id, 7),
	);

	const [auditLogs] = createResource(
		() => params.id,
		(id) => channelApi.getAuditLogs(id, 5),
	);

	const [funnel] = createResource(
		() => params.id,
		(id) => channelApi.getFunnel(id),
	);

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => window.history.back());
		const timer = setTimeout(() => setShowTooltip(false), 10000);

		onCleanup(() => {
			off();
			clearTimeout(timer);
		});
	});

	const handleMenuOpen = () => {
		setIsMenuOpen(true);
		setShowTooltip(false);
		hapticFeedback.impactOccurred('light');
	};

	const getHealthColor = (rate: number) => {
		if (rate >= 20) return '#10b981';
		if (rate >= 10) return '#f59e0b';
		return '#ef4444';
	};

	return (
		<div class="theme-control min-h-screen bg-[#08090D] pb-24 relative overflow-x-hidden text-white select-none">
			{/* Top Bar Header */}
			<div class="px-5 pt-5 pb-4 flex items-center justify-between relative z-30 bg-[#0F1117]/90 backdrop-blur-md sticky top-0 border-b border-white/10">
				<div class="flex items-center gap-3 overflow-hidden">
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
					<div class="w-10 h-10 rounded-xl bg-[#0088cc]/15 border border-[#0088cc]/30 flex items-center justify-center relative shrink-0">
						<span class="text-sm font-black text-[#0088cc]">
							{channel()?.chat_title?.charAt(0) || 'C'}
						</span>
					</div>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2">
							<h1 class="text-sm font-black text-white leading-tight truncate max-w-[130px]">
								{channel.loading ? '...' : channel()?.chat_title || 'داشبورد کانال'}
							</h1>
							<span class="text-[9px] bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 px-2 py-0.5 rounded-md font-bold">
								متصل
							</span>
						</div>
						<div class="flex items-center gap-1.5 text-[10px] text-white/50 font-bold mt-0.5">
							<span>{(channel()?.members_count || 0).toLocaleString()} عضو</span>
							<span>•</span>
							<span class={channel()?.subscription_status === 'paid' ? 'text-[#10b981]' : 'text-[#f59e0b]'}>
								{channel()?.subscription_status === 'paid' ? 'پرمیوم (Pro)' : 'رایگان (Free)'}
							</span>
						</div>
					</div>
				</div>

				<div class="relative flex items-center gap-2">
					<Show when={showTooltip()}>
						<Motion.div
							initial={{ opacity: 0, scale: 0.9, y: 10 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9 }}
							class={`absolute top-[120%] w-[180px] bg-[#0088cc] text-white text-[12px] font-bold p-3 rounded-2xl shadow-xl z-50 flex flex-col gap-2 ${isRtl() ? 'left-0 origin-top-left' : 'right-0 origin-top-right'}`}
						>
							<div class={`absolute -top-2 w-4 h-4 bg-[#0088cc] rotate-45 rounded-sm ${isRtl() ? 'left-4' : 'right-4'}`} />
							<div class="relative z-10 flex items-start justify-between gap-2">
								<span>دستورات و ابزارهای انتشار کانال</span>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setShowTooltip(false);
									}}
									class="mt-0.5 opacity-80 hover:opacity-100 p-0.5 shrink-0 active:scale-95 transition-transform"
									aria-label="بستن راهنما"
								>
									<span class="material-symbols-outlined text-[14px]">close</span>
								</button>
							</div>
						</Motion.div>
					</Show>

					<button
						onClick={handleMenuOpen}
						class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
						aria-label="منوی کانال"
					>
						<span class="material-symbols-outlined text-white">menu</span>
					</button>
				</div>
			</div>

			{/* Main Content Area */}
			<div class="px-5 pt-6 flex flex-col gap-6">
				{/* Channel Pulse Command Center Header */}
				<div class="bg-gradient-to-b from-[#151822] to-[#0F1117] border border-white/10 rounded-[24px] p-5 space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<FragmentPulse state="healthy" />
							<h2 class="text-xs font-black uppercase text-white tracking-wider">اتاق فرمان انتشار (CHANNEL PULSE)</h2>
						</div>
						<span class="text-[11px] font-mono font-bold text-[#10b981]">
							+{analytics()?.summary?.new_members_today || 0} عضو امروز
						</span>
					</div>

					<div class="grid grid-cols-2 gap-3 pt-1">
						<button
							onClick={() => navigate(`/channel/${params.id}/posting`)}
							class="h-12 bg-[#3390ec] hover:bg-[#2b7ec9] text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-[#3390ec]/20 active:scale-95 transition-all"
						>
							<span class="material-symbols-outlined text-[18px]">edit_square</span>
							پست جدید
						</button>

						<button
							onClick={() => navigate(`/channel/${params.id}/funnel`)}
							class="h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
						>
							<span class="material-symbols-outlined text-[18px]">account_tree</span>
							قیف انتشار (Funnel)
						</button>
					</div>
				</div>

				{/* Funnel Visual Overview */}
				<Show when={funnel()}>
					<div class="bg-[#151822] border border-white/10 rounded-[24px] p-5 space-y-3">
						<div class="flex items-center justify-between">
							<h3 class="text-xs font-black text-[#06b6d4] uppercase tracking-wider">مسیر انتشار خودکار</h3>
							<button
								onClick={() => navigate(`/channel/${params.id}/funnel`)}
								class="text-[11px] font-bold text-[#3390ec] hover:underline"
							>
								ویرایش مسیر
							</button>
						</div>

						<div class="grid grid-cols-3 gap-2 text-center pt-2">
							<div class="bg-black/40 border border-white/5 rounded-2xl p-3">
								<span class="text-[10px] text-white/40 font-bold block mb-1">پیش‌نویس‌ها</span>
								<span class="text-sm font-black text-white font-mono">{funnel()?.input_title || 'ورودی'}</span>
							</div>
							<div class="flex items-center justify-center">
								<span class="material-symbols-outlined text-[#06b6d4] text-2xl">arrow_forward</span>
							</div>
							<div class="bg-black/40 border border-white/5 rounded-2xl p-3">
								<span class="text-[10px] text-[#10b981] font-bold block mb-1">کانال عمومی</span>
								<span class="text-sm font-black text-white font-mono">{channel()?.chat_title || 'خروجی'}</span>
							</div>
						</div>
					</div>
				</Show>

				{/* Engagement & Health Metrics */}
				<div class="bg-[#151822] border border-white/10 rounded-[24px] p-5 space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-xs font-black text-white">نرخ تعامل و بازدید (ERR)</span>
						<span
							class="text-base font-black font-mono"
							style={{ color: getHealthColor(analytics()?.summary?.engagement_rate || 0) }}
						>
							{analytics()?.summary?.engagement_rate || 0}%
						</span>
					</div>

					<div class="w-full h-3 bg-black/40 rounded-full overflow-hidden border border-white/10 flex">
						<div
							class="h-full rounded-full transition-all duration-1000 ease-out"
							style={{
								width: `${Math.min(100, (analytics()?.summary?.engagement_rate || 0) * 2)}%`,
								background: getHealthColor(analytics()?.summary?.engagement_rate || 0),
							}}
						/>
					</div>
				</div>

				{/* Stats Grid */}
				<div class="grid grid-cols-2 gap-3">
					<div class="bg-[#151822] border border-white/10 rounded-[20px] p-4 space-y-1">
						<span class="text-[10px] text-white/40 font-bold uppercase tracking-wider">کل بازدیدها</span>
						<div class="text-2xl font-black text-white font-mono">
							{(analytics()?.summary?.total_views || 0).toLocaleString()}
						</div>
						<div class="text-[10px] font-bold text-[#3390ec]">هفته جاری</div>
					</div>

					<div class="bg-[#151822] border border-white/10 rounded-[20px] p-4 space-y-1">
						<span class="text-[10px] text-white/40 font-bold uppercase tracking-wider">پست‌های امروز</span>
						<div class="text-2xl font-black text-white font-mono">
							{analytics()?.summary?.posts_today || 0}
						</div>
						<div class="text-[10px] font-bold text-[#10b981]">ثبت‌شده در کانال</div>
					</div>
				</div>

				{/* Admin Activity */}
				<div class="bg-[#151822] border border-white/10 rounded-[24px] p-5 space-y-3">
					<h3 class="text-xs font-black text-white uppercase tracking-wider">فعالیت‌های اخیر مدیران</h3>
					<div class="space-y-2">
						<For each={auditLogs()?.data || []}>
							{(log) => (
								<div class="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-white/40 text-[16px]">history</span>
										<span class="font-bold text-white/80">{log.action}</span>
									</div>
									<span class="text-[10px] font-mono text-white/40">
										{log.created_at ? new Date(log.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : ''}
									</span>
								</div>
							)}
						</For>
					</div>
				</div>
			</div>

			<ChannelHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				channelId={params.id}
				activeTab="dashboard"
			/>
		</div>
	);
};
