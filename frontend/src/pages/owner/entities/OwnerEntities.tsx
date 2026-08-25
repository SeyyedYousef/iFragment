import { createSignal, Show, For, type Component } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { OwnerEntityItem } from '@/entities/owner/model/types.js';
import { DangerActionDialog, type DangerActionDetail } from '@/widgets/owner/DangerActionDialog.jsx';

export const OwnerEntities: Component = () => {
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = createSignal<'channel' | 'group'>('channel');

	// Modals State
	const [selectedEntity, setSelectedEntity] = createSignal<OwnerEntityItem | null>(null);
	const [dialogMode, setDialogMode] = createSignal<'extend_sub' | 'grant_coins' | null>(null);
	const [daysToAdd, setDaysToAdd] = createSignal(30);
	const [coinsToGrant, setCoinsToGrant] = createSignal(1000);

	const entitiesQuery = createQuery<OwnerEntityItem[]>(() => ({
		queryKey: ['owner', 'entities', activeTab()],
		queryFn: () =>
			activeTab() === 'channel'
				? ownerApi.getAllChannels(50, 0)
				: ownerApi.getAllGroups(50, 0),
	}));

	const extendSubMutation = createMutation(() => ({
		mutationFn: ({
			entityType,
			entityId,
			days,
			reason,
		}: {
			entityType: 'channel' | 'group';
			entityId: string;
			days: number;
			reason: string;
		}) => ownerApi.extendSubscription(entityType, entityId, days, reason),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'entities'] });
			closeDialog();
		},
	}));

	const grantCoinsMutation = createMutation(() => ({
		mutationFn: ({
			entityType,
			entityId,
			coins,
			reason,
		}: {
			entityType: 'channel' | 'group';
			entityId: string;
			coins: number;
			reason: string;
		}) => ownerApi.grantEntityCoins(entityType, entityId, coins, reason),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'entities'] });
			closeDialog();
		},
	}));

	const closeDialog = () => {
		setSelectedEntity(null);
		setDialogMode(null);
		setDaysToAdd(30);
		setCoinsToGrant(1000);
	};

	const getExtendSubDetails = (): DangerActionDetail[] => {
		const ent = selectedEntity();
		if (!ent) return [];
		return [
			{ label: 'Target Entity', value: `${ent.title} (${ent.entity_id})` },
			{ label: 'Current Paid Until', value: ent.paid_until ? new Date(ent.paid_until).toLocaleDateString() : 'Expired' },
			{ label: 'Days Extension', value: `+${daysToAdd()} Days` },
		];
	};

	const getGrantCoinsDetails = (): DangerActionDetail[] => {
		const ent = selectedEntity();
		if (!ent) return [];
		return [
			{ label: 'Target Entity', value: `${ent.title} (${ent.entity_id})` },
			{
				label: 'Credit Balance',
				before: `${ent.credit_balance.toLocaleString()} Coins`,
				after: `${(ent.credit_balance + coinsToGrant()).toLocaleString()} Coins`,
			},
		];
	};

	return (
		<div class="space-y-6">
			{/* Header & Tabs */}
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div>
					<h2 class="text-lg font-bold text-white">Managed Channels & Groups</h2>
					<p class="text-xs text-white/50">Manage subscription validity and credit balances for VIP entities</p>
				</div>

				<div class="flex gap-1.5 rounded-2xl bg-white/5 p-1 text-xs">
					<button
						onClick={() => setActiveTab('channel')}
						class={`px-4 py-2 rounded-xl font-medium transition ${
							activeTab() === 'channel'
								? 'bg-amber-500 text-black font-bold'
								: 'text-white/60 hover:text-white'
						}`}
					>
						Channels
					</button>
					<button
						onClick={() => setActiveTab('group')}
						class={`px-4 py-2 rounded-xl font-medium transition ${
							activeTab() === 'group'
								? 'bg-amber-500 text-black font-bold'
								: 'text-white/60 hover:text-white'
						}`}
					>
						Groups
					</button>
				</div>
			</div>

			{/* Entities Table */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3 font-medium">Title & Telegram ID</th>
								<th class="pb-3 font-medium">Owner</th>
								<th class="pb-3 font-medium">Paid Until</th>
								<th class="pb-3 font-medium">Credit Balance</th>
								<th class="pb-3 font-medium">Status</th>
								<th class="pb-3 font-medium text-right">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!entitiesQuery.isLoading && (entitiesQuery.data?.length ?? 0) > 0}
								fallback={
									<tr>
										<td colspan="6" class="py-8 text-center text-white/40">
											{entitiesQuery.isLoading ? 'Loading entities...' : 'No managed entities found'}
										</td>
									</tr>
								}
							>
								<For each={entitiesQuery.data}>
									{(entity) => (
										<tr class="hover:bg-white/[0.02] transition">
											<td class="py-3">
												<div class="font-bold text-white">{entity.title}</div>
												<div class="text-[11px] font-mono text-white/40">{entity.entity_id}</div>
											</td>
											<td class="py-3">
												<div class="text-white font-mono">{entity.owner_id}</div>
												<Show when={entity.owner_username}>
													<div class="text-[11px] text-white/40">@{entity.owner_username}</div>
												</Show>
											</td>
											<td class="py-3 font-mono text-white/80">
												{entity.paid_until ? new Date(entity.paid_until).toLocaleDateString() : '—'}
											</td>
											<td class="py-3 font-mono text-amber-400 font-bold">
												{entity.credit_balance.toLocaleString()} Coins
											</td>
											<td class="py-3">
												<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
													{entity.status || 'Active'}
												</span>
											</td>
											<td class="py-3 text-right">
												<div class="flex items-center justify-end gap-2">
													{/* Extend Subscription */}
													<button
														onClick={() => {
															setSelectedEntity(entity);
															setDialogMode('extend_sub');
														}}
														class="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-medium transition"
													>
														+ Days
													</button>

													{/* Grant Coins */}
													<button
														onClick={() => {
															setSelectedEntity(entity);
															setDialogMode('grant_coins');
														}}
														class="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-medium transition"
													>
														+ Coins
													</button>
												</div>
											</td>
										</tr>
									)}
								</For>
							</Show>
						</tbody>
					</table>
				</div>
			</div>

			{/* Extend Subscription Dialog */}
			<Show when={dialogMode() === 'extend_sub' && selectedEntity()}>
				<DangerActionDialog
					isOpen={true}
					title="Extend Subscription Validity"
					description="Grant premium subscription days to this entity. Requires reason for audit logging."
					actionLabel="Confirm Subscription Extension"
					riskLevel="medium"
					requireReason={true}
					details={getExtendSubDetails()}
					loading={extendSubMutation.isPending}
					onConfirm={(reason: string) => {
						extendSubMutation.mutate({
							entityType: activeTab(),
							entityId: selectedEntity()!.entity_id,
							days: daysToAdd(),
							reason,
						});
					}}
					onClose={closeDialog}
				/>
			</Show>

			{/* Grant Coins Dialog */}
			<Show when={dialogMode() === 'grant_coins' && selectedEntity()}>
				<DangerActionDialog
					isOpen={true}
					title="Grant Entity Coins Credit"
					description="Increase credit balance for auto-renewal and bot upgrades. Requires reason for audit logging."
					actionLabel="Confirm Coins Grant"
					riskLevel="medium"
					requireReason={true}
					details={getGrantCoinsDetails()}
					loading={grantCoinsMutation.isPending}
					onConfirm={(reason: string) => {
						grantCoinsMutation.mutate({
							entityType: activeTab(),
							entityId: selectedEntity()!.entity_id,
							coins: coinsToGrant(),
							reason,
						});
					}}
					onClose={closeDialog}
				/>
			</Show>
		</div>
	);
};
