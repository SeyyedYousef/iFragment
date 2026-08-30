import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { FinanceOrder, FinanceSummary } from '@/entities/owner/model/types.js';
import { t } from '@/shared/i18n/index.js';

export const OwnerFinance: Component = () => {
	const [page, setPage] = createSignal(0);
	const pageSize = 20;

	const summaryQuery = createQuery<FinanceSummary>(() => ({
		queryKey: ['owner', 'finance', 'summary'],
		queryFn: ownerApi.getFinanceSummary,
	}));

	const ordersQuery = createQuery<FinanceOrder[]>(() => ({
		queryKey: ['owner', 'finance', 'orders', page()],
		queryFn: () => ownerApi.getFinanceOrders(pageSize, page() * pageSize),
	}));

	const summary = () => summaryQuery.data as FinanceSummary | undefined;
	const orders = () => (ordersQuery.data || []) as FinanceOrder[];

	return (
		<div class="space-y-6">
			{/* Header */}
			<div>
				<h2 class="text-lg font-bold text-white">{t('ownerFinance.title')}</h2>
				<p class="text-xs text-white/50">{t('ownerFinance.subtitle')}</p>
			</div>

			{/* Aggregation Cards */}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Total Revenue */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{t('ownerFinance.totalRevenue')}</span>
						<span class="material-symbols-outlined text-base text-yellow-400">payments</span>
					</div>
					<div class="text-2xl font-black text-amber-400 font-mono flex items-center gap-1.5">
						<span>⭐</span>
						<span>
							{summaryQuery.isLoading
								? '...'
								: (summary()?.total_revenue_stars ?? 0).toLocaleString()}
						</span>
					</div>
					<div class="text-[11px] text-white/40">{t('ownerFinance.lifetimeInvoiced')}</div>
				</div>

				{/* 7-Day Revenue */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{t('ownerFinance.volume7d')}</span>
						<span class="material-symbols-outlined text-base text-emerald-400">trending_up</span>
					</div>
					<div class="text-2xl font-black text-emerald-400 font-mono flex items-center gap-1.5">
						<span>⭐</span>
						<span>
							{summaryQuery.isLoading ? '...' : (summary()?.revenue_7d ?? 0).toLocaleString()}
						</span>
					</div>
					<div class="text-[11px] text-emerald-400/80 font-mono">{t('ownerFinance.last7Days')}</div>
				</div>

				{/* 30-Day Revenue */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{t('ownerFinance.volume30d')}</span>
						<span class="material-symbols-outlined text-base text-sky-400">calendar_view_month</span>
					</div>
					<div class="text-2xl font-black text-white font-mono flex items-center gap-1.5">
						<span>⭐</span>
						<span>
							{summaryQuery.isLoading ? '...' : (summary()?.revenue_30d ?? 0).toLocaleString()}
						</span>
					</div>
					<div class="text-[11px] text-white/40">{t('ownerFinance.monthlyVelocity')}</div>
				</div>

				{/* Active Subscriptions & Churn */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-2">
					<div class="flex items-center justify-between text-xs text-white/50">
						<span>{t('ownerFinance.vipSubscriptions')}</span>
						<span class="material-symbols-outlined text-base text-cyan-400">workspace_premium</span>
					</div>
					<div class="text-2xl font-black text-white font-mono">
						{summaryQuery.isLoading
							? '...'
							: (summary()?.active_subscriptions ?? 0).toLocaleString()}
					</div>
					<div class="text-[11px] text-white/50">
						{t('ownerFinance.churnRate')}{' '}
						<span class="font-mono text-white">{(summary()?.churn_rate ?? 0).toFixed(1)}%</span>
					</div>
				</div>
			</div>

			{/* Orders Table */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-amber-400">receipt_long</span>
						<span class="text-sm font-bold text-white">{t('ownerFinance.recentTransactions')}</span>
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3 font-medium">{t('ownerFinance.thOrderId')}</th>
								<th class="pb-3 font-medium">{t('common.user')}</th>
								<th class="pb-3 font-medium">{t('ownerFinance.thPayloadItem')}</th>
								<th class="pb-3 font-medium">{t('ownerFinance.thAmount')}</th>
								<th class="pb-3 font-medium">{t('ownerFinance.thStatus')}</th>
								<th class="pb-3 font-medium text-right">{t('ownerFinance.thDate')}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!ordersQuery.isLoading && orders().length > 0}
								fallback={
									<tr>
										<td colspan="6" class="py-8 text-center text-white/40">
											{ordersQuery.isLoading ? t('ownerFinance.loading') : t('ownerFinance.empty')}
										</td>
									</tr>
								}
							>
								<For each={orders()}>
									{(order) => (
										<tr class="hover:bg-white/[0.02] transition">
											<td class="py-3 font-mono text-white/70">{order.id.slice(0, 8)}...</td>
											<td class="py-3">
												<div class="font-mono text-white">{order.user_id}</div>
												<Show when={order.username}>
													<div class="text-[11px] text-white/40">@{order.username}</div>
												</Show>
											</td>
											<td class="py-3 text-white/80 font-mono text-[11px]">
												{order.payload || t('ownerFinance.starsPurchase')}
											</td>
											<td class="py-3 font-mono font-bold text-amber-400 flex items-center gap-1">
												<span>⭐</span>
												<span>{(order.amount ?? order.amount_stars ?? 0).toLocaleString()}</span>
											</td>
											<td class="py-3">
												<span
													class={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
														order.status === 'paid'
															? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
															: order.status === 'pending'
																? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
																: 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
													}`}
												>
													{order.status}
												</span>
											</td>
											<td class="py-3 text-white/50 text-right">
												{new Date(order.created_at).toLocaleString()}
											</td>
										</tr>
									)}
								</For>
							</Show>
						</tbody>
					</table>
				</div>

				{/* Pagination */}
				<div class="flex items-center justify-between pt-4 border-t border-white/10 text-xs">
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(0, p - 1))}
						disabled={page() === 0}
						class="px-3 py-1.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-40"
					>
						{t('ownerFinance.previous')}
					</button>
					<span class="text-white/50">{t('ownerFinance.pageInfo', { page: page() + 1 })}</span>
					<button
						type="button"
						onClick={() => setPage((p) => p + 1)}
						disabled={orders().length < pageSize}
						class="px-3 py-1.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-40"
					>
						{t('ownerFinance.next')}
					</button>
				</div>
			</div>
		</div>
	);
};
