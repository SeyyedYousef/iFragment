import { A } from '@solidjs/router';
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type Component, createEffect, createSignal, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { SystemSettings } from '@/entities/owner/model/types.js';
import { ImageCropUploader } from '@/features/owner/ads/ImageCropUploader.js';
import { t } from '@/shared/i18n/index.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.jsx';

export const OwnerSettings: Component = () => {
	const queryClient = useQueryClient();

	const [settings, setSettings] = createSignal<SystemSettings | null>(null);
	const [statusMsg, setStatusMsg] = createSignal<{
		type: 'success' | 'error';
		text: string;
	} | null>(null);
	const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = createSignal(false);
	const [pendingMaintenanceState, setPendingMaintenanceState] = createSignal(false);

	const settingsQuery = createQuery(() => ({
		queryKey: ['owner', 'settings'],
		queryFn: ownerApi.getSettings,
	}));

	createEffect(() => {
		if (settingsQuery.data) {
			setSettings({ ...settingsQuery.data });
		}
	});

	const updateMutation = createMutation(() => ({
		mutationFn: (newSettings: SystemSettings) => ownerApi.updateSettings(newSettings),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'settings'] });
			setStatusMsg({ type: 'success', text: 'System settings saved successfully.' });
			setTimeout(() => setStatusMsg(null), 3000);
		},
		onError: (err: any) => {
			if (err.response?.status === 409) {
				setStatusMsg({
					type: 'error',
					text: 'Conflict: Settings were modified by another admin. Refreshing latest data...',
				});
				queryClient.invalidateQueries({ queryKey: ['owner', 'settings'] });
			} else {
				setStatusMsg({
					type: 'error',
					text: err.response?.data?.error || err.message || 'Failed to update settings.',
				});
			}
		},
	}));

	const handleMaintenanceToggle = (checked: boolean) => {
		setPendingMaintenanceState(checked);
		setIsMaintenanceDialogOpen(true);
	};

	const handleConfirmMaintenance = () => {
		if (settings()) {
			const updated = { ...settings()!, maintenance_mode: pendingMaintenanceState() };
			setSettings(updated);
			updateMutation.mutate(updated);
		}
		setIsMaintenanceDialogOpen(false);
	};

	const handleSaveForm = (e: Event) => {
		e.preventDefault();
		if (settings()) {
			updateMutation.mutate(settings()!);
		}
	};

	const updateField = (field: keyof SystemSettings, val: any) => {
		if (settings()) {
			setSettings({ ...settings()!, [field]: val });
		}
	};

	const currentSettings = () => settings();

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-lg font-bold text-white">{t('ownerSettings.title')}</h2>
					<p class="text-xs text-white/50">
						Optimistic concurrency controlled settings (Version: {currentSettings()?.version ?? 1})
					</p>
				</div>
			</div>

			<Show when={statusMsg()}>
				<div
					class={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
						statusMsg()?.type === 'success'
							? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
							: 'bg-rose-500/10 border-rose-500/20 text-rose-400'
					}`}
				>
					<span class="material-symbols-outlined text-base">
						{statusMsg()?.type === 'success' ? 'check_circle' : 'error'}
					</span>
					<span>{statusMsg()?.text}</span>
				</div>
			</Show>

			<Show
				when={!settingsQuery.isLoading && currentSettings()}
				fallback={
					<div class="p-8 text-center text-xs text-white/40">{t('ownerSettings.loading')}</div>
				}
			>
				<form onSubmit={handleSaveForm} class="space-y-6">
					{/* Maintenance Mode Banner */}
					<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 flex items-center justify-between">
						<div>
							<div class="text-sm font-bold text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400">construction</span>
								<span>{t('ownerSettings.maintenanceMode')}</span>
							</div>
							<div class="text-xs text-white/50 mt-0.5">
								Temporarily block regular users with a maintenance screen while allowing Owner
								access
							</div>
						</div>
						<label class="relative inline-flex items-center cursor-pointer">
							<input
								type="checkbox"
								aria-label={t('ownerSettings.maintenanceMode')}
								checked={currentSettings()?.maintenance_mode ?? false}
								onChange={(e) => handleMaintenanceToggle(e.currentTarget.checked)}
								class="sr-only peer"
							/>
							<div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
						</label>
					</div>



					{/* Investors Page Promotional Image */}
					<section class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
						<header>
							<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-amber-400">handshake</span>
									<h3 class="text-sm font-bold text-white">
										تصویر تمام‌صفحه صفحه سرمایه‌گذاران (تب دوم ربات)
									</h3>
								</div>
								<A
									href="/owner/investors"
									class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3390ec]/20 hover:bg-[#3390ec]/30 text-[#3390ec] text-xs font-bold transition border border-[#3390ec]/30"
								>
									<span class="material-symbols-outlined text-sm">open_in_new</span>
									<span>صفحه اختصاصی با پیش‌نمایش زنده</span>
								</A>
							</div>
							<p class="text-xs text-white/50 mt-2 leading-relaxed">
								تصویر تمام‌صفحه که به جای کل صفحه تب دوم (سرمایه‌گذاران) نمایش داده می‌شود. ابعاد
								استاندارد: ۱۰۸۰×۱۹۲۰ (عمودی ۹:۱۶). این بخش کاملاً مستقل از بنرهای صفحه اول است.
							</p>
						</header>

						<ImageCropUploader
							slot="investors_page"
							currentImageUrl={currentSettings()?.investors_page_image_url}
							targetWidth={1080}
							targetHeight={1920}
							aspectRatio={9 / 16}
							maxFileSizeMB={5}
							outputFormat="image/webp"
							outputQuality={0.86}
							onUploaded={(url) => updateField('investors_page_image_url', url)}
							onRemove={() => updateField('investors_page_image_url', '')}
						/>
					</section>

					{/* Save Button */}
					<div class="flex justify-end pt-2">
						<button
							type="submit"
							disabled={updateMutation.isPending}
							class="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded-2xl transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
						>
							{updateMutation.isPending ? 'Saving Settings...' : 'Save Configuration'}
						</button>
					</div>
				</form>
			</Show>

			{/* Maintenance Confirmation Dialog */}
			<Show when={isMaintenanceDialogOpen()}>
				<DangerActionDialog
					isOpen={true}
					title={pendingMaintenanceState() ? 'Enable Maintenance Mode' : 'Disable Maintenance Mode'}
					description={
						pendingMaintenanceState()
							? 'Are you sure you want to put the entire platform into Maintenance Mode? Regular users will be unable to access the app.'
							: 'Re-enable public platform access for all Telegram users?'
					}
					actionLabel={pendingMaintenanceState() ? 'Enable Maintenance' : 'Disable Maintenance'}
					confirmWord={pendingMaintenanceState() ? 'MAINTENANCE' : undefined}
					riskLevel={pendingMaintenanceState() ? 'critical' : 'medium'}
					requireReason={false}
					loading={updateMutation.isPending}
					onConfirm={handleConfirmMaintenance}
					onClose={() => setIsMaintenanceDialogOpen(false)}
				/>
			</Show>
		</div>
	);
};
