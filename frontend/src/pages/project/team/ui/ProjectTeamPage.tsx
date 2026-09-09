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
import { isRtl } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { showToast } from '@/shared/ui/index.js';
import { ProjectContextBar, ProjectHamburgerMenu } from '@/widgets/project/index.js';

export const ProjectTeamPage: Component = () => {
	const params = useParams<{ projectId: string }>();
	const navigate = useNavigate();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [showAddModal, setShowAddModal] = createSignal(false);
	const [userIdInput, setUserIdInput] = createSignal('');
	const [roleInput, setRoleInput] = createSignal<'admin' | 'editor' | 'approver' | 'viewer'>('approver');
	const [isSubmitting, setIsSubmitting] = createSignal(false);

	const [members, { refetch }] = createResource(
		() => params.projectId,
		(id) => channelApi.getProjectMembers(id),
	);

	onMount(() => {
		try {
			if (backButton.isSupported() && backButton.mount.isAvailable()) {
				backButton.mount();
				backButton.show();
				backButton.onClick(() => {
					haptic.impact('light');
					navigate(`/projects/${params.projectId}`);
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

	const handleAddMember = async (e: Event) => {
		e.preventDefault();
		const num = Number.parseInt(userIdInput().trim(), 10);
		if (!num || Number.isNaN(num)) {
			showToast('شناسه کاربری تلگرام نامعتبر است', 'error');
			return;
		}

		setIsSubmitting(true);
		try {
			haptic.impact('medium');
			await channelApi.addProjectMember(params.projectId, num, roleInput());
			haptic.notify('success');
			showToast('عضو جدید با موفقیت اضافه شد', 'success');
			setShowAddModal(false);
			setUserIdInput('');
			refetch();
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || err?.message || 'خطا در ثبت عضو', 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleRemoveMember = async (userId: number) => {
		try {
			haptic.impact('medium');
			await channelApi.removeProjectMember(params.projectId, userId);
			haptic.notify('success');
			showToast('عضو با موفقیت حذف شد', 'success');
			refetch();
		} catch (err: any) {
			haptic.notify('error');
			showToast(err?.response?.data?.error || err?.message || 'خطا در حذف عضو', 'error');
		}
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-30 border-b border-white/5 flex items-center justify-between shadow-sm">
				<div class="flex items-center gap-3 min-w-0">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							navigate(`/projects/${params.projectId}`);
						}}
						class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 text-white/80 active:scale-95"
					>
						<span class="material-symbols-outlined text-[20px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col min-w-0">
						<h1 class="text-[17px] font-black text-white leading-tight truncate">
							تیم و سطوح دسترسی
						</h1>
						<span class="text-[10px] font-bold text-white/50 uppercase tracking-wider">
							Project Roles & Permissions
						</span>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setShowAddModal(true)}
						class="h-9 px-3 rounded-[12px] bg-[#3390ec] text-white text-[11px] font-bold flex items-center gap-1 active:scale-95"
					>
						<span class="material-symbols-outlined text-[16px]">person_add</span>
						<span>افزودن</span>
					</button>
					<button
						type="button"
						onClick={() => setIsMenuOpen(true)}
						class="w-10 h-10 rounded-[12px] bg-[#12141C] flex items-center justify-center border border-white/10 text-white"
					>
						<span class="material-symbols-outlined text-[22px]">menu</span>
					</button>
				</div>
			</div>

			<div class="px-5 pt-4 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
				<ProjectContextBar projectId={params.projectId} compact={true} />

				{/* Role Explanations */}
				<div class="bg-[#12141C]/60 border border-white/5 rounded-[20px] p-4 text-[11px] text-white/50 leading-relaxed flex flex-col gap-1.5">
					<span class="font-bold text-white/80">نقش‌های پروژه:</span>
					<div>• <strong class="text-white">Admin:</strong> دسترسی کامل به تنظیمات، پایپ‌لاین و انتشار</div>
					<div>• <strong class="text-white">Editor:</strong> ویرایش محتوا و پیش‌نویس‌ها</div>
					<div>• <strong class="text-white">Approver:</strong> بررسی و تایید/رد پیام‌ها در اینباکس</div>
					<div>• <strong class="text-white">Viewer:</strong> مشاهده آمار و رسیدها بدون دسترسی تغییر</div>
				</div>

				{/* Members List */}
				<Show
					when={members() && members()!.length > 0}
					fallback={
						<div class="bg-[#12141C]/80 border border-white/5 rounded-[22px] p-6 text-center text-white/40 text-[12px]">
							هیچ عضو اضافی ثبت نشده است.
						</div>
					}
				>
					<div class="flex flex-col gap-2.5">
						<For each={members()}>
							{(m) => (
								<div class="bg-[#12141C] border border-white/10 rounded-[20px] p-3.5 flex items-center justify-between gap-3 shadow-sm">
									<div class="flex items-center gap-3 min-w-0">
										<div class="w-10 h-10 rounded-[14px] bg-white/5 border border-white/10 flex items-center justify-center text-white font-mono text-[13px] font-bold shrink-0">
											{m.role.charAt(0).toUpperCase()}
										</div>
										<div class="flex flex-col min-w-0">
											<span class="text-[13px] font-mono font-bold text-white truncate" dir="ltr">
												ID: {m.user_id}
											</span>
											<span class="text-[10px] text-white/40 uppercase font-black">
												نقش: {m.role}
											</span>
										</div>
									</div>

									<Show when={m.role !== 'owner'}>
										<button
											type="button"
											onClick={() => handleRemoveMember(m.user_id)}
											class="w-9 h-9 rounded-[12px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center active:scale-95"
										>
											<span class="material-symbols-outlined text-[18px]">delete</span>
										</button>
									</Show>
								</div>
							)}
						</For>
					</div>
				</Show>
			</div>

			{/* Add Member Modal */}
			<Show when={showAddModal()}>
				<div
					class="fixed inset-0 bg-[#030303]/90 backdrop-blur-xl z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
					onClick={(e) => {
						if (e.target === e.currentTarget && !isSubmitting()) setShowAddModal(false);
					}}
				>
					<div class="w-full max-w-md bg-[#12141C] rounded-t-[32px] sm:rounded-[32px] border border-white/10 p-6 flex flex-col gap-4 shadow-2xl">
						<div class="flex items-center justify-between pb-3 border-b border-white/10">
							<h3 class="text-[16px] font-black text-white">افزودن عضو به پروژه</h3>
							<button
								type="button"
								onClick={() => setShowAddModal(false)}
								class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50"
							>
								<span class="material-symbols-outlined text-[18px]">close</span>
							</button>
						</div>

						<form onSubmit={handleAddMember} class="flex flex-col gap-3.5">
							<div>
								<label class="block text-[12px] font-bold text-white/70 mb-1">شناسه تلگرام (Telegram User ID)</label>
								<input
									type="number"
									placeholder="مثال: 123456789"
									value={userIdInput()}
									onInput={(e) => setUserIdInput(e.currentTarget.value)}
									dir="ltr"
									class="w-full h-12 bg-[#090a0f] rounded-[16px] px-4 text-[13px] text-white border border-white/10 focus:border-[#3390ec] outline-none font-mono"
								/>
							</div>

							<div>
								<label class="block text-[12px] font-bold text-white/70 mb-1">نقش کاربر</label>
								<select
									value={roleInput()}
									onChange={(e) => setRoleInput(e.currentTarget.value as any)}
									class="w-full h-12 bg-[#090a0f] rounded-[16px] px-4 text-[13px] text-white border border-white/10 focus:border-[#3390ec] outline-none"
								>
									<option value="approver">Approver (تاییدکننده محتوا)</option>
									<option value="editor">Editor (ویرایشگر محتوا)</option>
									<option value="admin">Admin (مدیر ارشد پروژه)</option>
									<option value="viewer">Viewer (مشاهده‌کننده آمار)</option>
								</select>
							</div>

							<button
								type="submit"
								disabled={isSubmitting()}
								class="mt-2 h-12 bg-[#3390ec] text-white text-[13px] font-black rounded-[16px] flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
							>
								<span>{isSubmitting() ? 'در حال ثبت...' : 'افزودن عضو'}</span>
							</button>
						</form>
					</div>
				</div>
			</Show>

			<ProjectHamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				projectId={params.projectId}
				activeTab="team"
			/>
		</div>
	);
};
