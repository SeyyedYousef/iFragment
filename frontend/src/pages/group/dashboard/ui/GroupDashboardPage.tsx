import { Motion } from '@motionone/solid';
import { useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { groupApi } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { FragmentPulse } from '@/shared/ui/FragmentPulse.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { showToast } from '@/shared/ui/toast.js';

export const GroupDashboardPage: Component = () => {
	const params = useParams();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [showTooltip, setShowTooltip] = createSignal(true);
	const [isLocking, setIsLocking] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);
	const [showLockConfirm, setShowLockConfirm] = createSignal(false);

	const [group] = createResource(
		() => params.id,
		(id) => groupApi.getGroup(id),
	);

	const [analytics] = createResource(
		() => params.id,
		(id) => groupApi.getAnalytics(id, 7),
	);

	const [settings, { mutate }] = createResource(
		() => params.id,
		async (id) => {
			const s = await groupApi.getSettings(id);
			setSettingsVersion(s.version);
			return s;
		},
	);

	const isGroupLocked = () => (settings()?.quiet_hours as any)?.emergencyLock || false;

	const [auditLogs] = createResource(
		() => params.id,
		(id) => groupApi.getAuditLogs(id, 5),
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

	const confirmToggleGroupLock = async () => {
		if (isLocking() || !settings()) return;
		const current = isGroupLocked();
		hapticFeedback.impactOccurred('medium');
		setIsLocking(true);
		setShowLockConfirm(false);
		try {
			const qh = { ...((settings()?.quiet_hours as any) || {}), emergencyLock: !current };
			const res = await groupApi.updateSettings(params.id, 'quiet_hours', qh, settingsVersion());
			if (res?.version) setSettingsVersion(res.version);
			mutate((prev: any) => (prev ? { ...prev, quiet_hours: qh } : { quiet_hours: qh }));
			hapticFeedback.notificationOccurred('success');
			showToast(current ? 'قفل گروه باز گردید' : 'گروه با موفقیت قفل گردید', 'success');
		} catch (_e) {
			hapticFeedback.notificationOccurred('error');
			showToast('خطا در تغییر وضعیت قفل گروه', 'error');
		} finally {
			setIsLocking(false);
		}
	};

	const handleMenuOpen = () => {
		setIsMenuOpen(true);
		setShowTooltip(false);
		hapticFeedback.impactOccurred('light');
	};

	const healthScore = () => {
		const data = analytics();
		if (!data?.summary) return 100;
		const spam = data.summary.spam_blocked || 0;
		const total = data.summary.total_messages || 0;
		if (total === 0) return 100;
		return Math.max(0, Math.round(100 - (spam / total) * 100));
	};

	const healthLabel = () => {
		const score = healthScore();
		if (score >= 90) return 'کاملاً امن (Very Safe)';
		if (score >= 70) return 'مطمئن (Safe)';
		if (score >= 50) return 'نیازمند بررسی (Needs Attention)';
		return 'بحرانی (Critical)';
	};

	const healthColorClass = () => {
		const score = healthScore();
		if (score >= 90) return 'text-[#10b981]';
		if (score >= 70) return 'text-[#f59e0b]';
		return 'text-[#ef4444]';
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
					<div class="w-10 h-10 rounded-xl bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center shrink-0">
						<span class="text-sm font-black text-[#3390ec]">
							{group()?.chat_title?.charAt(0) || 'G'}
						</span>
					</div>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-sm font-black text-white leading-tight truncate max-w-[150px]">
							{group.loading ? '...' : group()?.chat_title || 'داشبورد گروه'}
						</h1>
						{/* Compact Context Bar */}
						<div class="flex items-center gap-1.5 text-[10px] text-white/50 font-bold mt-0.5">
							<span>{group()?.chat_type || 'گروه'}</span>
							<span>•</span>
							<span
								class={
									group()?.subscription_status === 'paid' ? 'text-[#10b981]' : 'text-[#f59e0b]'
								}
							>
								{group()?.subscription_status === 'paid' ? 'پرمیوم (Pro)' : 'رایگان (Free)'}
							</span>
							<span>•</span>
							<span>{group()?.members_count || 0} عضو</span>
						</div>
					</div>
				</div>

				<div class="relative flex items-center gap-2">
					<Show when={showTooltip()}>
						<Motion.div
							initial={{ opacity: 0, scale: 0.9, y: 10 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9 }}
							class={`absolute top-[120%] w-[180px] bg-[#3390ec] text-white text-[12px] font-bold p-3 rounded-2xl shadow-xl z-50 flex flex-col gap-2 ${isRtl() ? 'left-0 origin-top-left' : 'right-0 origin-top-right'}`}
						>
							<div
								class={`absolute -top-2 w-4 h-4 bg-[#3390ec] rotate-45 rounded-sm ${isRtl() ? 'left-4' : 'right-4'}`}
							/>
							<div class="relative z-10 flex items-start justify-between gap-2">
								<span>{t('groupDashboard.tooltip') || 'دستورات مدیریت گروه'}</span>
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
						class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all relative"
						aria-label="منوی مدیریتی"
					>
						<Show when={showTooltip()}>
							<span class={`absolute top-0 flex h-3 w-3 ${isRtl() ? 'left-0' : 'right-0'}`}>
								<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75" />
								<span class="relative inline-flex rounded-full h-3 w-3 bg-[#ef4444] border-2 border-[#08090D]" />
							</span>
						</Show>
						<span class="material-symbols-outlined text-white">menu</span>
					</button>
				</div>
			</div>

			{/* Main Restructured 4-Layer Dashboard */}
			<div class="px-5 pt-6 flex flex-col gap-6">
				{/* LAYER 1: NOW (Live Status & Urgent Health) */}
				<div class="bg-gradient-to-b from-[#151822] to-[#0F1117] border border-white/10 rounded-[24px] p-5 space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<FragmentPulse
								state={healthScore() >= 90 ? 'healthy' : healthScore() >= 70 ? 'reward' : 'danger'}
							/>
							<span class="text-xs font-black uppercase text-white/50 tracking-wider">
								وضعیت کنونی سیستم (NOW)
							</span>
						</div>
						<span class={`text-xs font-black ${healthColorClass()}`}>{healthLabel()}</span>
					</div>

					<div class="flex items-center justify-between gap-4 pt-1">
						<div class="flex items-center gap-3">
							<div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-lg text-white">
								{healthScore()}%
							</div>
							<div>
								<div class="text-xs font-bold text-white">
									{t('groupDashboard.health') || 'امتیاز سلامت گروه (Health Score)'}
								</div>
								<div class="text-[11px] text-white/40 font-bold mt-0.5">
									{analytics()?.summary?.spam_blocked || 0} پیام هرزنامه مسدود شده
								</div>
							</div>
						</div>

						<button
							onClick={() => setShowLockConfirm(true)}
							disabled={isLocking() || settings.loading}
							class={`h-11 px-4 rounded-xl text-xs font-bold border transition-all active:scale-95 flex items-center gap-2 ${
								isGroupLocked()
									? 'bg-[#ef4444]/15 border-[#ef4444]/40 text-[#ef4444]'
									: 'bg-white/5 border-white/10 text-white hover:bg-white/10'
							}`}
						>
							<span class="material-symbols-outlined text-[18px]">
								{isGroupLocked() ? 'lock' : 'lock_open_right'}
							</span>
							<span>{isGroupLocked() ? 'قفل اضطراری فعال' : 'قفل سریع گروه'}</span>
						</button>
					</div>
				</div>

				{/* LAYER 2: TODAY (Members & Activity Stats) */}
				<div class="grid grid-cols-2 gap-3">
					<div class="bg-[#151822] border border-white/10 rounded-[20px] p-4 space-y-1">
						<div class="flex items-center justify-between text-white/40">
							<span class="text-[10px] font-bold uppercase tracking-wider">کل اعضا</span>
							<span class="material-symbols-outlined text-[18px]">group</span>
						</div>
						<div class="text-2xl font-black text-white font-mono">
							{(
								group()?.members_count ||
								analytics()?.summary?.total_members ||
								0
							).toLocaleString()}
						</div>
						<div class="text-[10px] font-bold text-[#10b981]">
							+{analytics()?.summary?.members_change || 0} امروز
						</div>
					</div>

					<div class="bg-[#151822] border border-white/10 rounded-[20px] p-4 space-y-1">
						<div class="flex items-center justify-between text-white/40">
							<span class="text-[10px] font-bold uppercase tracking-wider">پیام‌های امروز</span>
							<span class="material-symbols-outlined text-[18px]">forum</span>
						</div>
						<div class="text-2xl font-black text-white font-mono">
							{(analytics()?.summary?.total_messages || 0).toLocaleString()}
						</div>
						<div class="text-[10px] font-bold text-[#3390ec]">
							+{analytics()?.summary?.messages_change_pct || 0}% ترافیک
						</div>
					</div>
				</div>

				{/* LAYER 3: ATTENTION (Items Requiring Review) */}
				<div class="bg-[#151822] border border-white/10 rounded-[24px] p-5 space-y-3">
					<div class="flex items-center justify-between">
						<h3 class="text-xs font-black text-white uppercase tracking-wider">
							نیازمند توجه ادمین (ATTENTION)
						</h3>
						<span class="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold">
							۳ مورد اقدام
						</span>
					</div>

					<div class="space-y-2">
						<div class="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 text-xs">
							<div class="flex items-center gap-2.5">
								<span class="material-symbols-outlined text-amber-400 text-[18px]">gavel</span>
								<span class="font-bold text-white/80">بررسی ۳ کاربر گزارش‌شده توسط فیلتر محتوا</span>
							</div>
							<button
								onClick={handleMenuOpen}
								class="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-white"
							>
								مشاهده
							</button>
						</div>

						<div class="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 text-xs">
							<div class="flex items-center gap-2.5">
								<span class="material-symbols-outlined text-[#3390ec] text-[18px]">update</span>
								<span class="font-bold text-white/80">همگام‌سازی تنظیمات ضد اسپرم گروه</span>
							</div>
							<button
								onClick={handleMenuOpen}
								class="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-white"
							>
								تنظیمات
							</button>
						</div>
					</div>
				</div>

				{/* LAYER 4: ACTIVITY (Top Active Users & Audit Logs) */}
				<div class="bg-[#151822] border border-white/10 rounded-[24px] p-5 space-y-4">
					<h3 class="text-xs font-black text-white uppercase tracking-wider">
						کاربران فعال و لاگ‌ها (ACTIVITY)
					</h3>

					{/* Top Users */}
					<div class="grid grid-cols-3 gap-2">
						<For
							each={analytics()?.summary?.top_users || []}
							fallback={
								<div class="col-span-3 text-center py-4 text-xs text-white/40 font-bold">
									داده‌ای یافت نشد
								</div>
							}
						>
							{(u) => (
								<div class="bg-black/40 border border-white/5 rounded-2xl p-3 flex flex-col items-center text-center gap-1">
									<div class="w-10 h-10 rounded-full bg-[#3390ec]/20 border border-[#3390ec]/40 flex items-center justify-center text-xs font-black text-white">
										{u.name[0]}
									</div>
									<span class="text-[11px] font-bold text-white truncate w-full">{u.name}</span>
									<span class="text-[10px] font-mono text-white/40">{u.msgs} پیام</span>
								</div>
							)}
						</For>
					</div>

					{/* Audit Logs */}
					<div class="space-y-2 pt-2 border-t border-white/5">
						<For each={auditLogs() || []}>
							{(log) => (
								<div class="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-white/40 text-[16px]">history</span>
										<span class="font-bold text-white/80">{log.action}</span>
									</div>
									<span class="text-[10px] font-mono text-white/40">
										{new Date(log.created_at).toLocaleTimeString('fa-IR', {
											hour: '2-digit',
											minute: '2-digit',
										})}
									</span>
								</div>
							)}
						</For>
					</div>
				</div>
			</div>

			{/* Emergency Lock Confirmation Modal */}
			<Show when={showLockConfirm()}>
				<div class="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
					<div class="w-full max-w-sm bg-[#151822] border border-white/10 rounded-[28px] p-6 space-y-4 shadow-2xl">
						<div class="flex items-center gap-3 text-[#ef4444]">
							<span class="material-symbols-outlined text-3xl">lock</span>
							<h3 class="text-base font-black">تغییر وضعیت قفل اضطراری</h3>
						</div>
						<p class="text-xs text-white/70 leading-relaxed font-bold">
							با قفل کردن اضطراری، تمامی اعضای عادی گروه امکان ارسال پیام را به صورت موقت از دست
							خواهند داد.
						</p>
						<div class="flex gap-3 pt-2">
							<button
								onClick={() => setShowLockConfirm(false)}
								class="flex-1 h-11 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white"
							>
								انصراف
							</button>
							<button
								onClick={confirmToggleGroupLock}
								class="flex-1 h-11 bg-[#ef4444] hover:bg-[#dc2626] rounded-xl text-xs font-black text-white shadow-lg shadow-[#ef4444]/20"
							>
								تأیید قفل گروه
							</button>
						</div>
					</div>
				</div>
			</Show>

			<HamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				groupId={params.id}
				activeTab="dashboard"
			/>
		</div>
	);
};
