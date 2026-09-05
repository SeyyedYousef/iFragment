import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type Component, createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { SearchedUser } from '@/entities/owner/model/types.js';
import { t } from '@/shared/i18n/index.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.jsx';

export const OwnerUsers: Component = () => {
	const queryClient = useQueryClient();
	const [searchQuery, setSearchQuery] = createSignal('');
	const [debouncedQuery, setDebouncedQuery] = createSignal('');
	const [activeFilter, setActiveFilter] = createSignal('all');
	const [page, setPage] = createSignal(0);
	const pageSize = 20;

	// Dialog States
	const [selectedUser, setSelectedUser] = createSignal<SearchedUser | null>(null);
	const [dialogMode, setDialogMode] = createSignal<
		'simulate' | 'ban' | 'unban' | 'flag' | 'adjust' | null
	>(null);
	const [adjustAmount, setAdjustAmount] = createSignal<number>(0);
	const [banDuration, _setBanDuration] = createSignal<number>(86400); // 1 day default

	// 300ms Search Debounce
	let timer: any;
	createEffect(() => {
		const q = searchQuery();
		clearTimeout(timer);
		timer = setTimeout(() => {
			setDebouncedQuery(q);
			setPage(0);
		}, 300);
	});
	onCleanup(() => clearTimeout(timer));

	const usersQuery = createQuery(() => ({
		queryKey: ['owner', 'users', debouncedQuery(), activeFilter(), page()],
		queryFn: () =>
			ownerApi.searchUsers({
				q: debouncedQuery(),
				filter: activeFilter(),
				limit: pageSize,
				offset: page() * pageSize,
			}),
	}));

	const simulateMutation = createMutation(() => ({
		mutationFn: (targetUserId: number) => ownerApi.impersonateUser(targetUserId),
		onSuccess: (data: { token: string }) => {
			if (data.token) {
				localStorage.setItem('impersonation_token', data.token);
				window.location.href = '/';
			}
		},
	}));

	const banMutation = createMutation(() => ({
		mutationFn: ({ userId, reason, dur }: { userId: number; reason: string; dur: number }) =>
			ownerApi.banUser(userId, 'full', reason, dur),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'users'] });
			closeDialog();
		},
	}));

	const unbanMutation = createMutation(() => ({
		mutationFn: ({ userId }: { userId: number }) => ownerApi.unbanUser(userId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'users'] });
			closeDialog();
		},
	}));

	const adjustMutation = createMutation(() => ({
		mutationFn: ({ userId, amount, reason }: { userId: number; amount: number; reason: string }) =>
			ownerApi.adjustCoins(userId, amount, reason),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'users'] });
			closeDialog();
		},
	}));

	const closeDialog = () => {
		setSelectedUser(null);
		setDialogMode(null);
		setAdjustAmount(0);
	};

	const users = () => usersQuery.data?.users || [];
	const total = () => usersQuery.data?.total || 0;
	const totalPages = () => Math.ceil(total() / pageSize);

	return (
		<div class="space-y-6">
			{/* Search & Filter Bar */}
			<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
				<div class="relative flex-1">
					<span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-lg">
						search
					</span>
					<input
						type="text"
						placeholder={t('ownerCommon.searchPlaceholder')}
						value={searchQuery()}
						onInput={(e) => setSearchQuery(e.currentTarget.value)}
						class="w-full h-11 pl-10 pr-4 rounded-2xl bg-white/5 border border-white/15 text-white text-xs placeholder:text-white/30 focus:border-amber-400 focus:outline-none transition"
					/>
				</div>

				<div class="flex gap-1.5 rounded-2xl bg-white/5 p-1 text-xs">
					{[
						{ id: 'all', label: 'All Users' },
						{ id: 'premium', label: 'Premium' },
						{ id: 'flagged', label: 'Flagged' },
						{ id: 'banned', label: 'Banned' },
					].map((tab) => (
						<button
							type="button"
							onClick={() => {
								setActiveFilter(tab.id);
								setPage(0);
							}}
							class={`px-3 py-1.5 rounded-xl font-medium transition ${
								activeFilter() === tab.id
									? 'bg-amber-500 text-black font-bold'
									: 'text-white/60 hover:text-white'
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{/* Users Table */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="flex items-center justify-between">
					<div class="text-xs text-white/50">
						{t('ownerCommon.found')}{' '}
						<span class="font-mono text-white font-bold">{total().toLocaleString()}</span> users
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3 font-medium">{t('ownerCommon.userProfile')}</th>
								<th class="pb-3 font-medium">{t('ownerCommon.telegramId')}</th>
								<th class="pb-3 font-medium">{t('ownerCommon.coinsBalance')}</th>
								<th class="pb-3 font-medium">{t('ownerCommon.status')}</th>
								<th class="pb-3 font-medium">{t('ownerCommon.registered')}</th>
								<th class="pb-3 font-medium text-right">{t('ownerCommon.actions')}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!usersQuery.isLoading && users().length > 0}
								fallback={
									<tr>
										<td colspan="6" class="py-8 text-center text-white/40">
											{usersQuery.isLoading ? 'Searching users...' : 'No users matching query'}
										</td>
									</tr>
								}
							>
								<For each={users()}>
									{(user) => (
										<tr class="hover:bg-white/[0.02] transition">
											<td class="py-3">
												<div class="font-bold text-white flex items-center gap-1.5">
													<span>
														{user.first_name} {user.last_name}
													</span>
													<Show when={user.is_premium}>
														<span class="text-amber-400 text-xs">★</span>
													</Show>
												</div>
												<Show when={user.username}>
													<div class="text-[11px] text-white/40">@{user.username}</div>
												</Show>
											</td>
											<td class="py-3 font-mono text-white/70">{user.telegram_id}</td>
											<td class="py-3 font-mono text-amber-400 font-bold">
												{user.balance.toLocaleString()} Coins
											</td>
											<td class="py-3">
												<div class="flex flex-wrap gap-1">
													<Show when={user.is_banned}>
														<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
															{t('ownerCommon.banned')}
														</span>
													</Show>
													<Show when={user.is_flagged}>
														<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
															{t('ownerCommon.flagged')}
														</span>
													</Show>
													<Show when={!user.is_banned && !user.is_flagged}>
														<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
															{t('ownerCommon.active')}
														</span>
													</Show>
												</div>
											</td>
											<td class="py-3 text-white/50">
												{new Date(user.created_at).toLocaleDateString()}
											</td>
											<td class="py-3 text-right">
												<div class="flex items-center justify-end gap-1.5">
													{/* Simulate */}
													<button
														type="button"
														onClick={() => {
															setSelectedUser(user);
															setDialogMode('simulate');
														}}
														class="p-1.5 rounded-lg text-sky-400 hover:bg-sky-500/10 transition"
														title={t('ownerCommon.simulateUser')}
													>
														<span class="material-symbols-outlined text-base">person</span>
													</button>

													{/* Adjust Balance */}
													<button
														type="button"
														onClick={() => {
															setSelectedUser(user);
															setDialogMode('adjust');
														}}
														class="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition"
														title={t('ownerCommon.adjustCoins')}
													>
														<span class="material-symbols-outlined text-base">toll</span>
													</button>

													{/* Flag/Unflag */}
													<button
														type="button"
														onClick={() => {
															setSelectedUser(user);
															setDialogMode('flag');
														}}
														class={`p-1.5 rounded-lg transition ${
															user.is_flagged
																? 'text-orange-400 bg-orange-500/10'
																: 'text-white/40 hover:text-orange-400 hover:bg-white/5'
														}`}
														title={user.is_flagged ? 'Unflag' : 'Flag for Fraud'}
													>
														<span class="material-symbols-outlined text-base">flag</span>
													</button>

													{/* Ban/Unban */}
													<Show
														when={user.is_banned}
														fallback={
															<button
																type="button"
																onClick={() => {
																	setSelectedUser(user);
																	setDialogMode('ban');
																}}
																class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
																title={t('ownerCommon.banUser')}
															>
																<span class="material-symbols-outlined text-base">block</span>
															</button>
														}
													>
														<button
															type="button"
															onClick={() => {
																setSelectedUser(user);
																setDialogMode('unban');
															}}
															class="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition"
															title={t('ownerCommon.unbanUser')}
														>
															<span class="material-symbols-outlined text-base">lock_open</span>
														</button>
													</Show>
												</div>
											</td>
										</tr>
									)}
								</For>
							</Show>
						</tbody>
					</table>
				</div>

				{/* Pagination Controls */}
				<Show when={totalPages() > 1}>
					<div class="flex items-center justify-between pt-4 border-t border-white/10 text-xs">
						<button
							type="button"
							onClick={() => setPage((p) => Math.max(0, p - 1))}
							disabled={page() === 0}
							class="px-3 py-1.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-40"
						>
							{t('ownerCommon.previous')}
						</button>
						<span class="text-white/50">
							Page {page() + 1} of {totalPages()}
						</span>
						<button
							type="button"
							onClick={() => setPage((p) => Math.min(totalPages() - 1, p + 1))}
							disabled={page() >= totalPages() - 1}
							class="px-3 py-1.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-40"
						>
							{t('ownerCommon.next')}
						</button>
					</div>
				</Show>
			</div>

			{/* Adjust Balance Modal */}
			<Show when={dialogMode() === 'adjust' && selectedUser()}>
				<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
					<div class="w-full max-w-sm rounded-3xl border border-white/15 bg-neutral-900 p-6 space-y-4 text-white">
						<h3 class="text-sm font-bold">{t('ownerCommon.adjustCoinsBalance')}</h3>
						<p class="text-xs text-white/60">
							{t('ownerCommon.targetUser')}{' '}
							<span class="font-bold text-white">{selectedUser()?.first_name}</span> (
							{selectedUser()?.telegram_id})
						</p>

						<div class="space-y-2">
							<div class="text-[11px] text-white/50">{t('ownerCommon.deltaAmount')}</div>
							<input
								type="number"
								value={adjustAmount()}
								onInput={(e) => setAdjustAmount(parseFloat(e.currentTarget.value) || 0)}
								class="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-sm"
							/>
						</div>

						<div class="text-xs p-3 rounded-xl bg-white/5 space-y-1">
							<div class="flex justify-between text-white/50">
								<span>{t('ownerCommon.currentBalance')}</span>
								<span>{selectedUser()?.balance.toLocaleString()} Coins</span>
							</div>
							<div class="flex justify-between font-bold text-amber-400">
								<span>{t('ownerCommon.newBalance')}</span>
								<span>{(selectedUser()!.balance + adjustAmount()).toLocaleString()} Coins</span>
							</div>
						</div>

						<div class="flex gap-2 pt-2">
							<button
								type="button"
								onClick={closeDialog}
								class="flex-1 py-2.5 rounded-xl border border-white/15 text-xs text-white/70"
							>
								{t('ownerCommon.cancel')}
							</button>
							<button
								type="button"
								onClick={() => {
									const reason = prompt('Please enter justification reason for audit log:');
									if (reason?.trim()) {
										adjustMutation.mutate({
											userId: selectedUser()!.telegram_id,
											amount: adjustAmount(),
											reason: reason.trim(),
										});
									}
								}}
								disabled={adjustAmount() === 0 || adjustMutation.isPending}
								class="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
							>
								{adjustMutation.isPending ? 'Saving...' : 'Confirm'}
							</button>
						</div>
					</div>
				</div>
			</Show>

			{/* Simulation Dialog */}
			<Show when={dialogMode() === 'simulate' && selectedUser()}>
				<DangerActionDialog
					isOpen={true}
					title={t('ownerCommon.confirmSimulation')}
					description={`Simulate session for ${selectedUser()?.first_name} (${selectedUser()?.telegram_id}).`}
					actionLabel="Start Simulation"
					confirmWord="SIMULATE"
					riskLevel="medium"
					requireReason={false}
					loading={simulateMutation.isPending}
					onConfirm={() => simulateMutation.mutate(selectedUser()!.telegram_id)}
					onClose={closeDialog}
				/>
			</Show>

			{/* Ban Dialog */}
			<Show when={dialogMode() === 'ban' && selectedUser()}>
				<DangerActionDialog
					isOpen={true}
					title={t('ownerCommon.banUserAccount')}
					description={`Permanently or temporarily restrict ${selectedUser()?.first_name} (${selectedUser()?.telegram_id}).`}
					actionLabel="Execute Ban"
					confirmWord="BAN"
					riskLevel="critical"
					requireReason={true}
					loading={banMutation.isPending}
					onConfirm={(reason: string) =>
						banMutation.mutate({
							userId: selectedUser()!.telegram_id,
							reason,
							dur: banDuration(),
						})
					}
					onClose={closeDialog}
				/>
			</Show>

			{/* Unban Dialog */}
			<Show when={dialogMode() === 'unban' && selectedUser()}>
				<DangerActionDialog
					isOpen={true}
					title={t('ownerCommon.unbanUserAccount')}
					description={`Lift restrictions for ${selectedUser()?.first_name} (${selectedUser()?.telegram_id}).`}
					actionLabel="Unban User"
					confirmWord="UNBAN"
					riskLevel="medium"
					requireReason={false}
					loading={unbanMutation.isPending}
					onConfirm={() => unbanMutation.mutate({ userId: selectedUser()!.telegram_id })}
					onClose={closeDialog}
				/>
			</Show>
		</div>
	);
};
