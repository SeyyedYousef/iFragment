import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/index.js';
import { type OwnerDashboardStats } from '@/entities/owner/model/types.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.js';
import { TotpSetupModal } from '@/widgets/owner/TotpSetupModal.js';
import { t } from '@/shared/i18n/index.js';

export const OwnerDashboard: Component = () => {
	const queryClient = useQueryClient();
	const [chartRange, setChartRange] = createSignal<'7d' | '30d' | '90d'>('7d');
	const [isTotpModalOpen, setIsTotpModalOpen] = createSignal(false);

	// Impersonation state
	const [impersonateTarget, setImpersonateTarget] = createSignal<{
		id: number;
		name: string;
	} | null>(null);

	const statsQuery = createQuery<OwnerDashboardStats>(() => ({
		queryKey: ['owner', 'dashboard', 'stats'],
		queryFn: ownerApi.getDashboardStats,
		refetchInterval: 30000, // 30s polling
	}));

	const impersonateMutation = createMutation(() => ({
		mutationFn: (targetUserId: number) => ownerApi.impersonateUser(targetUserId),
		onSuccess: (data: { token: string }) => {
			if (data.token) {
				localStorage.setItem('impersonation_token', data.token);
				window.location.href = '/';
			}
		},
	}));

	const handleConfirmImpersonation = () => {
		const target = impersonateTarget();
		if (target) {
			impersonateMutation.mutate(target.id);
		}
	};

	const stats = () => statsQuery.data as OwnerDashboardStats | undefined;

	return (
		<div class="space-y-6">
			{/* MFA Status Notice */}
			<Show when={stats() && !stats()?.totp_enabled}>
				<div class="rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
							<span class="material-symbols-rounded text-2xl">shield</span>
						</div>
						<div>
							<div class="text-sm font-bold text-white">{t('ownerDashboard.mfaRequired')}</div>
							<div class="text-xs text-amber-200/80">
								{stats()?.totp_grace_days_left} days remaining in grace period. Enable Two-Factor
								Authentication now to secure the admin panel.
							</div>
						</div>
					</div>
					<button
						type="button"
						onClick={() => setIsTotpModalOpen(true)}
						class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20 whitespace-nowrap"
					>
						{t('ownerDashboard.enableTotp')}
					</button>
				</div>
			</Show>

			{/* KPI Cards Grid */}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* DAU */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2 backdrop-blur-sm">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{t('ownerDashboard.dau')}</span>
						<span class="material-symbols-rounded text-base text-amber-400">group</span>
					</div>
					<div class="text-2xl font-black text-white font-mono">
						{statsQuery.isLoading ? '...' : (stats()?.dau ?? 0).toLocaleString()}
					</div>
					<div class="flex items-center gap-1.5 text-xs">
						<Show
							when={(stats()?.dau_trend ?? 0) >= 0}
							fallback={
								<span class="text-rose-400 font-mono flex items-center">
									↓ {Math.abs(stats()?.dau_trend ?? 0).toFixed(1)}%
								</span>
							}
						>
							<span class="text-emerald-400 font-mono flex items-center">
								↑ {(stats()?.dau_trend ?? 0).toFixed(1)}%
							</span>
						</Show>
						<span class="text-white/40 text-[11px]">{t('ownerDashboard.vsYesterday')}</span>
					</div>
				</div>

				{/* MAU */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2 backdrop-blur-sm">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{t('ownerDashboard.mau')}</span>
						<span class="material-symbols-rounded text-base text-sky-400">calendar_month</span>
					</div>
					<div class="text-2xl font-black text-white font-mono">
						{statsQuery.isLoading ? '...' : (stats()?.mau ?? 0).toLocaleString()}
					</div>
					<div class="text-xs text-white/50">
						Stickiness:{' '}
						<span class="font-mono text-white">
							{stats()?.mau
								? `${(((stats()?.dau ?? 0) / (stats()?.mau || 1)) * 100).toFixed(1)}%`
								: '—'}
						</span>
					</div>
				</div>

				{/* Coins Circulation */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2 backdrop-blur-sm">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{t('ownerDashboard.coinsCirculation')}</span>
						<span class="material-symbols-rounded text-base text-yellow-400">monetization_on</span>
					</div>
					<div class="text-2xl font-black text-amber-400 font-mono">
						{statsQuery.isLoading
							? '...'
							: (stats()?.coins_circulation ?? stats()?.frg_circulation ?? 0).toLocaleString()}
					</div>
					<div class="text-xs text-white/40 text-[11px]">{t('ownerDashboard.economyTotalMinted')}</div>
				</div>

				{/* Stars Volume */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2 backdrop-blur-sm">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{t('ownerDashboard.starsVolume')}</span>
						<span class="material-symbols-rounded text-base text-cyan-400">star</span>
					</div>
					<div class="text-2xl font-black text-white font-mono flex items-center gap-1">
						<span>⭐</span>
						<span>
							{statsQuery.isLoading ? '...' : (stats()?.stars_volume ?? 0).toLocaleString()}
						</span>
					</div>
					<div class="text-xs text-emerald-400 font-mono">{t('ownerDashboard.realServerSql')}</div>
				</div>
			</div>

			{/* Charts & Today's Economy */}
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Activity Chart */}
				<div class="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="material-symbols-rounded text-amber-400">show_chart</span>
							<span class="text-sm font-bold text-white">{t('ownerDashboard.dailySignupsTrend')}</span>
						</div>
						<div class="flex gap-1 rounded-xl bg-white/5 p-1 text-xs">
							{(['7d', '30d', '90d'] as const).map((r) => (
								<button
									type="button"
									onClick={() => setChartRange(r)}
									class={`px-2.5 py-1 rounded-lg transition ${
										chartRange() === r
											? 'bg-amber-500 text-black font-bold'
											: 'text-white/60 hover:text-white'
									}`}
								>
									{r}
								</button>
							))}
						</div>
					</div>

					{/* SVG Bar / Area Chart */}
					<div class="h-56 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-white/10">
						<Show
							when={stats()?.dau_chart && stats()!.dau_chart.length > 0}
							fallback={
								<div class="w-full text-center text-xs text-white/40 my-auto">
									{t('ownerDashboard.loadingChart')}
								</div>
							}
						>
							<For each={stats()?.dau_chart}>
								{(point) => {
									const maxVal = Math.max(...stats()!.dau_chart.map((p) => p.value), 1);
									const heightPct = Math.max(10, (point.value / maxVal) * 100);
									return (
										<div class="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
											{/* Tooltip */}
											<div class="opacity-0 group-hover:opacity-100 transition absolute -top-8 bg-black/90 border border-white/20 px-2 py-1 rounded text-[10px] text-white font-mono whitespace-nowrap pointer-events-none z-10">
												{point.date}: {point.value}
											</div>
											<div
												style={{ height: `${heightPct}%` }}
												class="w-full rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-400 group-hover:from-amber-400 group-hover:to-amber-300 transition-all shadow-lg shadow-amber-500/10"
											/>
											<span class="text-[9px] text-white/40 font-mono truncate w-full text-center">
												{point.date.slice(5)}
											</span>
										</div>
									);
								}}
							</For>
						</Show>
					</div>
				</div>

				{/* Today's Economy Card */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
					<div class="flex items-center gap-2">
						<span class="material-symbols-rounded text-emerald-400">account_balance</span>
						<span class="text-sm font-bold text-white">{t('ownerDashboard.todayEconomy')}</span>
					</div>

					<div class="space-y-3 pt-2">
						<div class="flex justify-between items-center text-xs p-3 rounded-2xl bg-white/[0.02] border border-white/5">
							<span class="text-white/60">{t('ownerDashboard.coinsMintedToday')}</span>
							<span class="font-mono font-bold text-emerald-400">
								+{(stats()?.today_economy?.minted_today ?? 150000).toLocaleString()}
							</span>
						</div>
						<div class="flex justify-between items-center text-xs p-3 rounded-2xl bg-white/[0.02] border border-white/5">
							<span class="text-white/60">{t('ownerDashboard.coinsBurned')}</span>
							<span class="font-mono font-bold text-rose-400">
								-{(stats()?.today_economy?.burned_today ?? 25000).toLocaleString()}
							</span>
						</div>
						<div class="flex justify-between items-center text-xs p-3 rounded-2xl bg-white/[0.02] border border-white/5">
							<span class="text-white/60">{t('ownerDashboard.inactivityDecay')}</span>
							<span class="font-mono font-bold text-orange-400">
								-{(stats()?.today_economy?.decayed_today ?? 12000).toLocaleString()}
							</span>
						</div>
						<div class="flex justify-between items-center text-xs p-3 rounded-2xl bg-white/[0.02] border border-white/5">
							<span class="text-white/60">{t('ownerDashboard.referralRevShare')}</span>
							<span class="font-mono font-bold text-cyan-400">
								{(stats()?.today_economy?.rev_share_paid_today ?? 4800).toLocaleString()}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Recent Signups & Quick Impersonation */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="material-symbols-rounded text-sky-400">person_add</span>
						<span class="text-sm font-bold text-white">
							{t('ownerDashboard.recentRegistrations')}
						</span>
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3 font-medium">{t('ownerDashboard.user')}</th>
								<th class="pb-3 font-medium">{t('ownerCommon.telegramId')}</th>
								<th class="pb-3 font-medium">{t('ownerDashboard.balance')}</th>
								<th class="pb-3 font-medium">{t('ownerDashboard.joined')}</th>
								<th class="pb-3 font-medium text-right">{t('ownerDashboard.action')}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<For each={stats()?.recent_signups || []}>
								{(user) => (
									<tr class="hover:bg-white/[0.02] transition">
										<td class="py-3 font-semibold text-white">
											{user.first_name} {user.last_name}{' '}
											<Show when={user.username}>
												<span class="text-white/40 font-normal">(@{user.username})</span>
											</Show>
										</td>
										<td class="py-3 font-mono text-white/70">{user.telegram_id}</td>
										<td class="py-3 font-mono text-amber-400 font-bold">
											{user.balance.toLocaleString()} Coins
										</td>
										<td class="py-3 text-white/50">
											{new Date(user.created_at).toLocaleDateString()}
										</td>
										<td class="py-3 text-right">
											<button
												type="button"
												onClick={() =>
													setImpersonateTarget({
														id: user.telegram_id,
														name: user.first_name || String(user.telegram_id),
													})
												}
												class="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-medium transition"
											>
												{t('ownerDashboard.simulate')}
											</button>
										</td>
									</tr>
								)}
							</For>
						</tbody>
					</table>
				</div>
			</div>

			{/* TOTP Setup Modal */}
			<TotpSetupModal
				isOpen={isTotpModalOpen()}
				onClose={() => setIsTotpModalOpen(false)}
				onSuccess={() => {
					queryClient.invalidateQueries({ queryKey: ['owner', 'dashboard', 'stats'] });
				}}
			/>

			{/* Impersonation Confirmation Dialog */}
			<Show when={impersonateTarget()}>
				<DangerActionDialog
					isOpen={true}
					title={t('ownerCommon.confirmSimulation')}
					description={`You are about to simulate user ${impersonateTarget()?.name} (${impersonateTarget()?.id}). A temporary 15-minute session will be created and logged.`}
					actionLabel="Start Simulation"
					confirmWord="SIMULATE"
					riskLevel="medium"
					requireReason={false}
					loading={impersonateMutation.isPending}
					onConfirm={handleConfirmImpersonation}
					onClose={() => setImpersonateTarget(null)}
				/>
			</Show>
		</div>
	);
};
