import { A } from '@solidjs/router';
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
		onSuccess: (saved) => {
			setSettings({ ...saved });
			queryClient.invalidateQueries({ queryKey: ['owner', 'settings'] });
			queryClient.invalidateQueries({ queryKey: ['owner', 'dashboard'] });
			setStatusMsg({
				type: 'success',
				text: t('ownerEngineSettings.savedSuccess'),
			});
			setTimeout(() => setStatusMsg(null), 3500);
		},
		onError: (err: any) => {
			setStatusMsg({
				type: 'error',
				text: err.response?.data?.error || err.message || 'Failed to update settings.',
			});
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

	const updateField = <K extends keyof SystemSettings>(field: K, val: SystemSettings[K]) => {
		if (settings()) {
			setSettings({ ...settings()!, [field]: val });
		}
	};

	const currentSettings = () => settings();

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h2 class="text-lg font-black text-white">{t('ownerEngineSettings.title')}</h2>
					<p class="text-xs text-white/50">
						{t('ownerEngineSettings.subtitle', { version: currentSettings()?.version ?? 1 })}
					</p>
				</div>
			</div>

			<Show when={statusMsg()}>
				<div
					class={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
						statusMsg()?.type === 'success'
							? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
							: 'bg-rose-500/10 border-rose-500/25 text-rose-400'
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
					<div class="p-8 text-center text-xs text-white/40">
						{t('ownerEngineSettings.loadingConfig')}
					</div>
				}
			>
				<form onSubmit={handleSaveForm} class="space-y-6">
					{/* Maintenance Mode Banner */}
					<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 flex items-center justify-between gap-4">
						<div>
							<div class="text-sm font-bold text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400">construction</span>
								<span>{t('ownerEngineSettings.maintenanceTitle')}</span>
							</div>
							<div class="text-xs text-white/50 mt-0.5">
								{t('ownerEngineSettings.maintenanceDesc')}
							</div>
						</div>
						<label class="relative inline-flex items-center cursor-pointer shrink-0">
							<input
								type="checkbox"
								checked={currentSettings()?.maintenance_mode ?? false}
								onChange={(e) => handleMaintenanceToggle(e.currentTarget.checked)}
								class="sr-only peer"
							/>
							<div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
						</label>
					</div>

					{/* Section 1: Intel Credit Paywall & Report Costs */}
					<section class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
						<header class="border-b border-white/10 pb-3">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-cyan-400">bolt</span>
								<h3 class="text-sm font-bold text-white">
									{t('ownerEngineSettings.creditsEconomyTitle')}
								</h3>
							</div>
							<p class="text-xs text-white/50 mt-1">
								{t('ownerEngineSettings.creditsEconomyDesc')}
							</p>
						</header>

						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							<div class="space-y-1.5">
								<label class="text-xs text-sky-300 font-bold block">
									{t('ownerEngineSettings.usernameCostLabel')}
								</label>
								<input
									type="number"
									min={0}
									max={50}
									value={currentSettings()?.cost_username_report ?? 1}
									onInput={(e) =>
										updateField('cost_username_report', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-amber-300 font-bold block">
									{t('ownerEngineSettings.numberCostLabel')}
								</label>
								<input
									type="number"
									min={0}
									max={50}
									value={currentSettings()?.cost_number_report ?? 1}
									onInput={(e) =>
										updateField('cost_number_report', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-purple-300 font-bold block">
									{t('ownerEngineSettings.giftCostLabel')}
								</label>
								<input
									type="number"
									min={0}
									max={50}
									value={currentSettings()?.cost_gift_report ?? 1}
									onInput={(e) =>
										updateField('cost_gift_report', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-emerald-300 font-bold block">
									{t('ownerEngineSettings.portfolioCostLabel')}
								</label>
								<input
									type="number"
									min={0}
									max={50}
									value={currentSettings()?.cost_portfolio_scan ?? 2}
									onInput={(e) =>
										updateField('cost_portfolio_scan', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{t('ownerEngineSettings.dailyQuotaLabel')}
								</label>
								<input
									type="number"
									min={0}
									max={20}
									value={currentSettings()?.free_daily_quota ?? 1}
									onInput={(e) =>
										updateField('free_daily_quota', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{t('ownerEngineSettings.signupBonusLabel')}
								</label>
								<input
									type="number"
									min={0}
									max={100}
									value={currentSettings()?.signup_bonus_credits ?? 3}
									onInput={(e) =>
										updateField('signup_bonus_credits', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{t('ownerEngineSettings.referralBonusLabel')}
								</label>
								<input
									type="number"
									min={0}
									max={100}
									value={currentSettings()?.referral_bonus_credits ?? 2}
									onInput={(e) =>
										updateField('referral_bonus_credits', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{t('ownerEngineSettings.referralRevShareLabel')}
								</label>
								<input
									type="number"
									step="0.5"
									min={0}
									max={50}
									value={currentSettings()?.referral_rev_share_pct ?? 15}
									onInput={(e) =>
										updateField('referral_rev_share_pct', parseFloat(e.currentTarget.value) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>
						</div>
					</section>

					{/* Section 2: Valuation Engine Calibration & Market Oracles */}
					<section class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
						<header class="border-b border-white/10 pb-3">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400">tune</span>
								<h3 class="text-sm font-bold text-white">
									{t('ownerEngineSettings.calibrationTitle')}
								</h3>
							</div>
							<p class="text-xs text-white/50 mt-1">{t('ownerEngineSettings.calibrationDesc')}</p>
						</header>

						<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{t('ownerEngineSettings.tonOverrideLabel')}
								</label>
								<input
									type="number"
									step="0.01"
									min={0}
									value={currentSettings()?.ton_usd_override ?? 0}
									onInput={(e) =>
										updateField('ton_usd_override', parseFloat(e.currentTarget.value) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{t('ownerEngineSettings.floorStrictnessLabel')}
								</label>
								<input
									type="number"
									step="0.05"
									min={0.5}
									max={2.0}
									value={currentSettings()?.gift_floor_strictness ?? 1.0}
									onInput={(e) =>
										updateField('gift_floor_strictness', parseFloat(e.currentTarget.value) || 1.0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{t('ownerEngineSettings.vanityGuardLabel')}
								</label>
								<input
									type="number"
									step="0.5"
									min={2.0}
									max={20.0}
									value={currentSettings()?.vanity_ask_multiplier_threshold ?? 3.5}
									onInput={(e) =>
										updateField(
											'vanity_ask_multiplier_threshold',
											parseFloat(e.currentTarget.value) || 3.5,
										)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
								/>
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
							<label class="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between cursor-pointer">
								<div>
									<div class="text-xs font-bold text-white">
										{t('ownerEngineSettings.fragmentScrapingTitle')}
									</div>
									<div class="text-[11px] text-white/45 mt-0.5">
										{t('ownerEngineSettings.fragmentScrapingDesc')}
									</div>
								</div>
								<input
									type="checkbox"
									checked={currentSettings()?.enable_live_fragment_Verify ?? true}
									onChange={(e) =>
										updateField('enable_live_fragment_Verify', e.currentTarget.checked)
									}
									class="h-4 w-4 rounded accent-cyan-500"
								/>
							</label>

							<label class="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between cursor-pointer">
								<div>
									<div class="text-xs font-bold text-white">
										{t('ownerEngineSettings.tonapiForensicsTitle')}
									</div>
									<div class="text-[11px] text-white/45 mt-0.5">
										{t('ownerEngineSettings.tonapiForensicsDesc')}
									</div>
								</div>
								<input
									type="checkbox"
									checked={currentSettings()?.enable_live_tonapi_boc ?? true}
									onChange={(e) => updateField('enable_live_tonapi_boc', e.currentTarget.checked)}
									class="h-4 w-4 rounded accent-cyan-500"
								/>
							</label>
						</div>
					</section>

					{/* Quick Link to Banners & Investors Media Manager */}
					<div class="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
						<div class="flex items-center gap-3">
							<span class="material-symbols-outlined text-amber-400">ads_click</span>
							<div class="text-xs">
								<div class="font-bold text-white">{t('ownerEngineSettings.bannersCardTitle')}</div>
								<div class="text-white/50">{t('ownerEngineSettings.bannersCardDesc')}</div>
							</div>
						</div>
						<A
							href="/owner/ads"
							class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-amber-300 shrink-0 transition"
						>
							{t('ownerEngineSettings.openBannersBtn')}
						</A>
					</div>

					{/* Save Button */}
					<div class="flex justify-end pt-2">
						<button
							type="submit"
							disabled={updateMutation.isPending}
							class="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
						>
							{updateMutation.isPending
								? t('ownerEngineSettings.savingConfig')
								: t('ownerEngineSettings.saveConfigBtn')}
						</button>
					</div>
				</form>
			</Show>

			{/* Maintenance Confirmation Dialog */}
			<Show when={isMaintenanceDialogOpen()}>
				<DangerActionDialog
					isOpen={true}
					title={
						pendingMaintenanceState()
							? t('ownerEngineSettings.enableMaintenanceTitle')
							: t('ownerEngineSettings.disableMaintenanceTitle')
					}
					description={
						pendingMaintenanceState()
							? t('ownerEngineSettings.enableMaintenanceDesc')
							: t('ownerEngineSettings.disableMaintenanceDesc')
					}
					actionLabel={
						pendingMaintenanceState()
							? t('ownerEngineSettings.enableMaintenanceAction')
							: t('ownerEngineSettings.disableMaintenanceAction')
					}
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
