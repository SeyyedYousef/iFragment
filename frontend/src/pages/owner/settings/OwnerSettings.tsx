import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type Component, createEffect, createSignal, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { SystemSettings } from '@/entities/owner/model/types.js';
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

					{/* Economic Engine Parameters */}
					<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
						<div class="flex items-center gap-2 border-b border-white/10 pb-3">
							<span class="material-symbols-outlined text-amber-400">tune</span>
							<h3 class="text-sm font-bold text-white">{t('ownerSettings.tapDailyRewards')}</h3>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerSettings.tapMultiplier')}
									<input
										type="number"
										step="0.1"
										aria-label={t('ownerSettings.tapMultiplier')}
										value={currentSettings()?.tap_multiplier ?? 1}
										onInput={(e) =>
											updateField('tap_multiplier', parseFloat(e.currentTarget.value) || 1)
										}
										class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none mt-1"
									/>
								</label>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerSettings.referralBonus')}
									<input
										type="number"
										aria-label={t('ownerSettings.referralBonus')}
										value={currentSettings()?.referral_bonus ?? 25000}
										onInput={(e) =>
											updateField('referral_bonus', parseInt(e.currentTarget.value, 10) || 0)
										}
										class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none mt-1"
									/>
								</label>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerSettings.dailyRewardBase')}
									<input
										type="number"
										aria-label={t('ownerSettings.dailyRewardBase')}
										value={currentSettings()?.daily_reward_base ?? 5000}
										onInput={(e) =>
											updateField('daily_reward_base', parseInt(e.currentTarget.value, 10) || 0)
										}
										class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none mt-1"
									/>
								</label>
							</div>
						</div>

						{/* Fatigue Thresholds */}
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerSettings.fatigueThreshold1')}
									<input
										type="number"
										aria-label={t('ownerSettings.fatigueThreshold1')}
										value={currentSettings()?.fatigue_threshold_1 ?? 500}
										onInput={(e) =>
											updateField('fatigue_threshold_1', parseInt(e.currentTarget.value, 10) || 500)
										}
										class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none mt-1"
									/>
								</label>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerSettings.fatigueThreshold2')}
									<input
										type="number"
										aria-label={t('ownerSettings.fatigueThreshold2')}
										value={currentSettings()?.fatigue_threshold_2 ?? 1500}
										onInput={(e) =>
											updateField(
												'fatigue_threshold_2',
												parseInt(e.currentTarget.value, 10) || 1500,
											)
										}
										class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none mt-1"
									/>
								</label>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerSettings.fatigueThreshold3')}
									<input
										type="number"
										aria-label={t('ownerSettings.fatigueThreshold3')}
										value={currentSettings()?.fatigue_threshold_3 ?? 3000}
										onInput={(e) =>
											updateField(
												'fatigue_threshold_3',
												parseInt(e.currentTarget.value, 10) || 3000,
											)
										}
										class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none mt-1"
									/>
								</label>
							</div>
						</div>
					</div>

					{/* Economy Sinks & Inflation Controls */}
					<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
						<div class="flex items-center gap-2 border-b border-white/10 pb-3">
							<span class="material-symbols-outlined text-emerald-400">savings</span>
							<h3 class="text-sm font-bold text-white">{t('ownerSettings.monetaryPolicy')}</h3>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerSettings.inactivityDecayRate')}
									<input
										type="number"
										step="0.5"
										aria-label={t('ownerSettings.inactivityDecayRate')}
										value={currentSettings()?.coin_decay_pct ?? 5.0}
										onInput={(e) =>
											updateField('coin_decay_pct', parseFloat(e.currentTarget.value) || 0)
										}
										class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none mt-1"
									/>
								</label>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerSettings.referralRevSharePct')}
									<input
										type="number"
										aria-label={t('ownerSettings.referralRevSharePct')}
										value={currentSettings()?.referral_rev_share_pct ?? 15}
										onInput={(e) =>
											updateField(
												'referral_rev_share_pct',
												parseInt(e.currentTarget.value, 10) || 0,
											)
										}
										class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none mt-1"
									/>
								</label>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerSettings.turboDuration')}
									<input
										type="number"
										aria-label={t('ownerSettings.turboDuration')}
										value={currentSettings()?.turbo_duration_seconds ?? 20}
										onInput={(e) =>
											updateField(
												'turbo_duration_seconds',
												parseInt(e.currentTarget.value, 10) || 20,
											)
										}
										class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none mt-1"
									/>
								</label>
							</div>
						</div>
					</div>

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
