import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	type Component,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { channelApi } from '@/entities/channel/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';
import { ProjectContextBar, ProjectHamburgerMenu } from '@/widgets/project/index.js';

export const ProjectDashboardPage: Component = () => {
	const params = useParams<{ projectId: string }>();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	const [project] = createResource(
		() => params.projectId,
		(id) => channelApi.getProject(id),
	);

	const [inboxItems, { refetch: refetchInbox }] = createResource(
		() => params.projectId,
		(id) => channelApi.getProjectInbox(id, 'awaiting_review', 5),
	);

	const [deliveries] = createResource(
		() => params.projectId,
		(id) => channelApi.getProjectDeliveries(id, 5),
	);

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					navigate('/projects');
				});
			}
		} catch (_e) {}
	});

	onCleanup(() => {
		try {
			if (backButton.isSupported()) {
				backButton.hide();
			}
		} catch (_e) {}
	});

	const handleQuickApprove = async (contentId: string) => {
		try {
			haptic.impact('heavy');
			await channelApi.approveContent(params.projectId, contentId);
			haptic.notify('success');
			showToast('محتوا با موفقیت تایید و منتشر شد', 'success');
			refetchInbox();
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || err?.message || 'خطا در انتشار', 'error');
		}
	};

	const handleQuickReject = async (contentId: string) => {
		try {
			haptic.impact('medium');
			await channelApi.rejectContent(params.projectId, contentId, 'رد سریع از داشبورد');
			haptic.notify('success');
			showToast('محتوا رد شد', 'success');
			refetchInbox();
		} catch (err: any) {
			haptic.notify('error');
			showToast('خطا در رد محتوا', 'error');
		}
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[320px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-30 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3 min-w-0">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate('/projects');
						}}
						class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 text-white/80"
						aria-label={t('common.back') || 'Back'}
					>
						<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col min-w-0">
						<h1 class="text-[17px] font-black text-white leading-tight truncate tracking-tight">
							{project()?.name || 'داشبورد پروژه'}
						</h1>
						<span class="text-[10px] font-bold text-white/50 uppercase tracking-wider">
							مدیریت تحریریه و انتقال
						</span>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							setIsMenuOpen(true);
						}}
						class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all text-white"
					>
						<span class="material-symbols-outlined text-[22px]">menu</span>
					</button>
				</div>
			</div>

			<div class="px-5 pt-5 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
				{/* Project Context Bar */}
				<ProjectContextBar projectId={params.projectId} />

				{/* ═══════ METRICS ROW ═══════ */}
				<div class="grid grid-cols-3 gap-2.5">
					<div
						onClick={() => navigate(`/projects/${params.projectId}/inbox`)}
						class="bg-[#12141C]/90 border border-white/10 rounded-[20px] p-3.5 flex flex-col gap-1 cursor-pointer hover:border-[#3390ec]/40 active:scale-95 transition-all"
					>
						<div class="flex items-center justify-between text-[#3390ec]">
							<span class="material-symbols-outlined text-[20px]">inbox</span>
							<span class="text-[10px] font-black uppercase">اینباکس</span>
						</div>
						<span class="text-[20px] font-black text-white mt-1">
							{inboxItems() ? inboxItems()!.length : 0}
						</span>
						<span class="text-[10px] text-white/40">در انتظار بررسی</span>
					</div>

					<div
						onClick={() => navigate(`/projects/${params.projectId}/deliveries`)}
						class="bg-[#12141C]/90 border border-white/10 rounded-[20px] p-3.5 flex flex-col gap-1 cursor-pointer hover:border-emerald-500/40 active:scale-95 transition-all"
					>
						<div class="flex items-center justify-between text-emerald-400">
							<span class="material-symbols-outlined text-[20px]">local_shipping</span>
							<span class="text-[10px] font-black uppercase">انتشار</span>
						</div>
						<span class="text-[20px] font-black text-white mt-1">
							{deliveries() ? deliveries()!.length : 0}
						</span>
						<span class="text-[10px] text-white/40">پست تحویل‌شده</span>
					</div>

					<div
						onClick={() => navigate(`/projects/${params.projectId}/pipeline`)}
						class="bg-[#12141C]/90 border border-white/10 rounded-[20px] p-3.5 flex flex-col gap-1 cursor-pointer hover:border-amber-400/40 active:scale-95 transition-all"
					>
						<div class="flex items-center justify-between text-amber-400">
							<span class="material-symbols-outlined text-[20px]">tune</span>
							<span class="text-[10px] font-black uppercase">پایپ‌لاین</span>
						</div>
						<span class="text-[14px] font-black text-white mt-2">
							{project()?.status === 'active' ? 'فعال' : 'متوقف'}
						</span>
						<span class="text-[10px] text-white/40">وضعیت ربات</span>
					</div>
				</div>

				{/* ═══════ FEATURE NAVIGATION GRID ═══════ */}
				<div class="grid grid-cols-2 gap-3">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}/inbox`);
						}}
						class="bg-gradient-to-br from-[#141722] to-[#0c0e15] border border-white/10 hover:border-[#3390ec]/40 rounded-[22px] p-4 flex flex-col items-start gap-2 active:scale-95 transition-all text-start"
					>
						<div class="w-10 h-10 rounded-[12px] bg-[#3390ec]/15 text-[#3390ec] flex items-center justify-center">
							<span class="material-symbols-outlined text-[22px]">inbox</span>
						</div>
						<span class="text-[14px] font-black text-white">صندوق بررسی</span>
						<span class="text-[11px] text-white/50">بررسی و تایید پیش از انتشار</span>
					</button>

					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}/pipeline`);
						}}
						class="bg-gradient-to-br from-[#141722] to-[#0c0e15] border border-white/10 hover:border-[#3390ec]/40 rounded-[22px] p-4 flex flex-col items-start gap-2 active:scale-95 transition-all text-start"
					>
						<div class="w-10 h-10 rounded-[12px] bg-purple-500/15 text-purple-400 flex items-center justify-center">
							<span class="material-symbols-outlined text-[22px]">tune</span>
						</div>
						<span class="text-[14px] font-black text-white">قوانین و هوش مصنوعی</span>
						<span class="text-[11px] text-white/50">فیلتر لینک، بازنویسی و دکمه</span>
					</button>

					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}/deliveries`);
						}}
						class="bg-gradient-to-br from-[#141722] to-[#0c0e15] border border-white/10 hover:border-[#3390ec]/40 rounded-[22px] p-4 flex flex-col items-start gap-2 active:scale-95 transition-all text-start"
					>
						<div class="w-10 h-10 rounded-[12px] bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
							<span class="material-symbols-outlined text-[22px]">local_shipping</span>
						</div>
						<span class="text-[14px] font-black text-white">رسیدهای تحویل</span>
						<span class="text-[11px] text-white/50">تاریخچه پیام‌های ارسالی بات</span>
					</button>

					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}/settings`);
						}}
						class="bg-gradient-to-br from-[#141722] to-[#0c0e15] border border-white/10 hover:border-[#3390ec]/40 rounded-[22px] p-4 flex flex-col items-start gap-2 active:scale-95 transition-all text-start"
					>
						<div class="w-10 h-10 rounded-[12px] bg-white/10 text-white/80 flex items-center justify-center">
							<span class="material-symbols-outlined text-[22px]">settings</span>
						</div>
						<span class="text-[14px] font-black text-white">تنظیمات پروژه</span>
						<span class="text-[11px] text-white/50">تعویض کانال‌ها و اشتراک</span>
					</button>
				</div>

				{/* ═══════ PENDING REVIEW INBOX PREVIEW ═══════ */}
				<div class="flex flex-col gap-3 pt-2">
					<div class="flex items-center justify-between px-1">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#3390ec] text-[20px]">mark_email_unread</span>
							<h3 class="text-[14px] font-black text-white">پست‌های آماده بررسی</h3>
						</div>
						<button
							type="button"
							onClick={() => navigate(`/projects/${params.projectId}/inbox`)}
							class="text-[11px] text-[#3390ec] font-bold hover:underline"
						>
							مشاهده همه ({inboxItems() ? inboxItems()!.length : 0})
						</button>
					</div>

					<Show
						when={inboxItems() && inboxItems()!.length > 0}
						fallback={
							<div class="bg-[#12141C]/60 border border-white/5 rounded-[22px] p-6 text-center text-white/40 text-[12px]">
								هیچ محتوایی در صف انتظار نیست. پیام‌های جدید کانال ورودی در اینجا نمایش داده می‌شوند.
							</div>
						}
					>
						<For each={inboxItems()!.slice(0, 3)}>
							{(item) => (
								<div class="bg-[#12141C] border border-white/10 rounded-[20px] p-4 flex flex-col gap-3">
									<div class="flex items-center justify-between text-[11px] text-white/40">
										<span>پیام #{item.source_message_id}</span>
										<span>{new Date(item.received_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
									</div>

									<p class="text-[13px] text-white/90 line-clamp-3 leading-relaxed">
										{item.revision?.text || item.revision?.caption || 'محتوای بدون متن (رسانه)'}
									</p>

									<div class="flex items-center gap-2 pt-1">
										<button
											type="button"
											onClick={() => handleQuickApprove(item.id)}
											class="flex-1 h-9 rounded-[12px] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[11px] font-black flex items-center justify-center gap-1 active:scale-95"
										>
											<span class="material-symbols-outlined text-[16px]">check</span>
											<span>تایید و انتشار</span>
										</button>
										<button
											type="button"
											onClick={() => handleQuickReject(item.id)}
											class="w-9 h-9 rounded-[12px] bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 flex items-center justify-center active:scale-95"
										>
											<span class="material-symbols-outlined text-[16px]">close</span>
										</button>
									</div>
								</div>
							)}
						</For>
					</Show>
				</div>
			</div>

			{/* Project Drawer Menu */}
			<ProjectHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				projectId={params.projectId}
				activeTab="dashboard"
			/>
		</div>
	);
};
