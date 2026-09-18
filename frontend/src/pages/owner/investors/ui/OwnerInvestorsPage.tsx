import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type Component, createEffect, createSignal, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { SystemSettings } from '@/entities/owner/model/types.js';
import { ImageCropUploader } from '@/features/owner/ads/ImageCropUploader.jsx';
import { buildMediaUrl } from '@/shared/api/config.js';
import { t } from '@/shared/i18n/index.js';
import { showToast } from '@/shared/ui/toast.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.jsx';

export const OwnerInvestorsPage: Component = () => {
	const queryClient = useQueryClient();

	const [stagedImageUrl, setStagedImageUrl] = createSignal<string | null>(null);
	const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
	const [saveSuccess, setSaveSuccess] = createSignal(false);

	const settingsQuery = createQuery<SystemSettings>(() => ({
		queryKey: ['owner', 'settings'],
		queryFn: () => ownerApi.getSystemSettings(),
	}));

	// Sync staged URL with loaded settings
	createEffect(() => {
		const current = settingsQuery.data?.investors_page_image_url;
		if (stagedImageUrl() === null && current !== undefined) {
			setStagedImageUrl(current || '');
		}
	});

	const activeImageUrl = () => {
		if (stagedImageUrl() !== null) return stagedImageUrl()!;
		return settingsQuery.data?.investors_page_image_url || '';
	};

	const hasUnsavedChanges = () => {
		if (stagedImageUrl() === null) return false;
		const serverVal = settingsQuery.data?.investors_page_image_url || '';
		return stagedImageUrl() !== serverVal;
	};

	const updateMutation = createMutation(() => ({
		mutationFn: (newUrl: string) => {
			const current = settingsQuery.data;
			if (!current) throw new Error('Settings not loaded');
			return ownerApi.updateSystemSettings({
				...current,
				investors_page_image_url: newUrl,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'settings'] });
			queryClient.invalidateQueries({ queryKey: ['public', 'investors-page'] });
			setSaveSuccess(true);
			showToast(t('ownerInvestors.savedSuccess') || 'Saved successfully');
			setTimeout(() => setSaveSuccess(false), 3500);
		},
		onError: (err: any) => {
			showToast(`Error: ${err.message || 'Failed to save configuration'}`);
		},
	}));

	const handleSave = () => {
		updateMutation.mutate(activeImageUrl());
	};

	const handleConfirmRemove = () => {
		setStagedImageUrl('');
		setShowDeleteConfirm(false);
		updateMutation.mutate('');
	};

	return (
		<div class="space-y-6">
			{/* Page Header */}
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
				<div>
					<div class="flex items-center gap-2.5">
						<span class="material-symbols-outlined text-2xl text-[#3390ec]">handshake</span>
						<h2 class="text-xl font-black text-white tracking-tight">
							{t('ownerInvestors.title')}
						</h2>
					</div>
					<p class="text-xs text-white/50 mt-1 leading-relaxed max-w-2xl">
						{t('ownerInvestors.subtitle')}
					</p>
				</div>

				<div class="flex items-center gap-3 self-stretch sm:self-auto justify-end">
					<Show when={activeImageUrl() && activeImageUrl() !== ''}>
						<button
							type="button"
							onClick={() => setShowDeleteConfirm(true)}
							disabled={updateMutation.isPending}
							class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition disabled:opacity-50"
						>
							<span class="material-symbols-outlined text-base">delete</span>
							<span>{t('ownerInvestors.removeButton')}</span>
						</button>
					</Show>

					<button
						type="button"
						onClick={handleSave}
						disabled={updateMutation.isPending || !hasUnsavedChanges()}
						class={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-lg ${
							hasUnsavedChanges()
								? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20 animate-pulse'
								: 'bg-white/10 text-white/40 cursor-not-allowed'
						}`}
					>
						<span class="material-symbols-outlined text-base">
							{updateMutation.isPending ? 'sync' : 'check_circle'}
						</span>
						<span>
							{updateMutation.isPending ? 'Saving...' : t('ownerInvestors.saveButton')}
						</span>
					</button>
				</div>
			</div>

			{/* Distinction Callout Banner */}
			<div class="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3.5">
				<span class="material-symbols-outlined text-amber-400 text-2xl shrink-0 mt-0.5">
					info
				</span>
				<div class="space-y-1 text-xs">
					<div class="font-bold text-amber-300">
						{t('ownerInvestors.noticeTitle')}
					</div>
					<p class="text-white/70 leading-relaxed">
						{t('ownerInvestors.noticeDesc')}
					</p>
				</div>
			</div>

			{/* Main Grid: Upload & Settings (Left) vs Live Mobile Mockup (Right) */}
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
				{/* Left: Uploader Card (7 cols) */}
				<div class="lg:col-span-7 space-y-6">
					<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-5 backdrop-blur-xl">
						<div class="flex items-center justify-between border-b border-white/10 pb-3">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400">crop_portrait</span>
								<h3 class="text-sm font-bold text-white">
									{t('ownerInvestors.uploadTitle')}
								</h3>
							</div>
							<span class="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60">
								1080 × 1920 (9:16)
							</span>
						</div>

						<p class="text-xs text-white/50 leading-relaxed">
							تصویر انتخابی را با نسبت عمودی ۹:۱۶ برش دهید. بخش امن (Safe Zone) شامل ۱۴۰ پیکسل از بالا (هدر تلگرام) و ۲۶۰ پیکسل از پایین (نوار پیمایش) است.
						</p>

						<ImageCropUploader
							slot="investors_page"
							currentImageUrl={activeImageUrl()}
							targetWidth={1080}
							targetHeight={1920}
							aspectRatio={9 / 16}
							maxFileSizeMB={5}
							outputFormat="image/webp"
							outputQuality={0.86}
							onUploaded={(url) => {
								setStagedImageUrl(url);
							}}
							onRemove={() => {
								setStagedImageUrl('');
							}}
						/>

						{/* Changes status bar */}
						<Show when={hasUnsavedChanges()}>
							<div class="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-center justify-between">
								<div class="flex items-center gap-2 text-xs text-amber-300">
									<span class="material-symbols-outlined text-base">pending</span>
									<span>تغییرات هنوز ذخیره نشده‌اند. برای انتشار روی دکمه «ذخیره تنظیمات تصویر» کلیک کنید.</span>
								</div>
								<button
									type="button"
									onClick={handleSave}
									disabled={updateMutation.isPending}
									class="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shrink-0 transition"
								>
									ذخیره
								</button>
							</div>
						</Show>

						<Show when={saveSuccess()}>
							<div class="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center gap-2 text-xs text-emerald-400">
								<span class="material-symbols-outlined text-base">verified</span>
								<span>{t('ownerInvestors.savedSuccess')}</span>
							</div>
						</Show>
					</div>
				</div>

				{/* Right: Live TMA Mobile Phone Mockup (5 cols) */}
				<div class="lg:col-span-5 flex flex-col items-center">
					<div class="w-full max-w-[320px] rounded-[44px] border-4 border-white/20 bg-[#08090d] shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden relative aspect-[9/18.5] flex flex-col justify-between select-none">
						{/* Simulated TMA Header */}
						<div class="relative z-20 px-4 pt-3 pb-2 flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-white/10 text-white">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-sm text-white/60">arrow_back</span>
								<span class="text-xs font-bold tracking-tight">iFragment</span>
							</div>
							<div class="flex items-center gap-1.5">
								<div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
								<span class="material-symbols-outlined text-sm text-white/60">more_vert</span>
							</div>
						</div>

						{/* Full-Screen Content Area */}
						<div class="absolute inset-0 w-full h-full">
							<Show
								when={activeImageUrl() && activeImageUrl() !== ''}
								fallback={
									<div class="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white/30 space-y-2 bg-[#0d0f17]">
										<span class="material-symbols-outlined text-4xl">image_not_supported</span>
										<span class="text-[11px] leading-tight">
											{t('ownerInvestors.noImageWarning')}
										</span>
									</div>
								}
							>
								<img
									src={buildMediaUrl(activeImageUrl()!)}
									alt="Preview"
									class="w-full h-full object-cover object-center"
								/>
							</Show>
						</div>

						{/* Simulated Floating Bottom Navigation */}
						<div class="relative z-20 p-3 pb-4">
							<div class="backdrop-blur-2xl rounded-2xl bg-[#0D0F17]/90 border border-white/15 px-2 py-1 flex items-center justify-between shadow-2xl">
								{/* Tab 1: Home */}
								<div class="flex-1 flex flex-col items-center justify-center py-1 text-white/40">
									<span class="material-symbols-outlined text-base">home</span>
									<span class="text-[8px] mt-0.5">خانه</span>
								</div>

								{/* Tab 2: Investors (ACTIVE with handshake) */}
								<div class="flex-1 flex flex-col items-center justify-center py-1 bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/30 rounded-xl">
									<span
										class="material-symbols-outlined text-base"
										style={{ 'font-variation-settings': '"FILL" 1' }}
									>
										handshake
									</span>
									<span class="text-[8px] font-bold mt-0.5">سرمایه‌گذاران</span>
								</div>

								{/* Tab 3: Rewards */}
								<div class="flex-1 flex flex-col items-center justify-center py-1 text-white/40">
									<span class="material-symbols-outlined text-base">card_giftcard</span>
									<span class="text-[8px] mt-0.5">پاداش</span>
								</div>
							</div>
						</div>
					</div>

					<span class="text-xs text-white/40 mt-3 font-semibold">
						{t('ownerInvestors.currentPreview')}
					</span>
				</div>
			</div>

			{/* Delete Confirmation Modal */}
			<Show when={showDeleteConfirm()}>
				<DangerActionDialog
					title={t('ownerInvestors.removeButton')}
					description="آیا مطمئن هستید که می‌خواهید تصویر تمام‌صفحه صفحه سرمایه‌گذاران را حذف کنید؟ در این صورت کاربران صفحه خالی پیش‌فرض را مشاهده خواهند کرد."
					confirmLabel={t('common.delete')}
					cancelLabel={t('common.cancel')}
					onConfirm={handleConfirmRemove}
					onCancel={() => setShowDeleteConfirm(false)}
				/>
			</Show>
		</div>
	);
};
