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
		'simulate' | 'ban' | 'unban' | 'adjustCredits' | null
	>(null);
	const [adjustCreditDelta, setAdjustCreditDelta] = createSignal<number>(5);
	const [adjustReason, setAdjustReason] = createSignal<string>('');
	const [banDuration, _setBanDuration] = createSignal<number>(86400);

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

	const adjustCreditsMutation = createMutation(() => ({
		mutationFn: ({ userId, delta, reason }: { userId: number; delta: number; reason: string }) =>
			ownerApi.adjustIntelCredits(userId, delta, reason),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'users'] });
			queryClient.invalidateQueries({ queryKey: ['owner', 'dashboard'] });
			closeDialog();
		},
	}));

	const toggleVipMutation = createMutation(() => ({
		mutationFn: ({ userId, isPremium }: { userId: number; isPremium: boolean }) =>
			ownerApi.toggleUserVip(userId, isPremium, 'Owner VIP toggle'),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'users'] });
			queryClient.invalidateQueries({ queryKey: ['owner', 'dashboard'] });
		},
	}));

	const flagMutation = createMutation(() => ({
		mutationFn: ({ userId, isFlagged }: { userId: number; isFlagged: boolean }) =>
			ownerApi.flagUser(userId, isFlagged),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'users'] });
		},
	}));

	const closeDialog = () => {
		setSelectedUser(null);
		setDialogMode(null);
		setAdjustCreditDelta(5);
		setAdjustReason('');
	};

	const users = () => usersQuery.data?.users || [];
	const total = () => usersQuery.data?.total || 0;
	const totalPages = () => Math.ceil(total() / pageSize);

	return (
		<div class="space-y-6">
			{/* Header */}
			<div>
				<h2 class="text-lg font-black text-white">{t('ownerUsersPage.title')}</h2>
				<p class="text-xs text-white/50">{t('ownerUsersPage.subtitle')}</p>
			</div>

			{/* Search & Filter Bar */}
			<div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
				<div class="relative flex-1">
					<span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-lg">
						search
					</span>
					<input
						type="text"
						placeholder={t('ownerUsersPage.searchPlaceholder')}
						value={searchQuery()}
						onInput={(e) => setSearchQuery(e.currentTarget.value)}
						class="w-full h-11 pl-10 pr-4 rounded-2xl bg-white/5 border border-white/15 text-white text-xs placeholder:text-white/30 focus:border-cyan-400 focus:outline-none transition"
					/>
				</div>

				<div class="flex gap-1.5 rounded-2xl bg-white/5 p-1 text-xs">
					{[
						{ id: 'all', labelKey: 'ownerUsersPage.filterAll' },
						{ id: 'premium', labelKey: 'ownerUsersPage.filterPremium' },
						{ id: 'flagged', labelKey: 'ownerUsersPage.filterFlagged' },
						{ id: 'banned', labelKey: 'ownerUsersPage.filterBanned' },
					].map((tab) => (
						<button
							type="button"
							onClick={() => {
								setActiveFilter(tab.id);
								setPage(0);
							}}
							class={`px-3 py-1.5 rounded-xl font-bold transition ${
								activeFilter() === tab.id
									? 'bg-cyan-500 text-black'
									: 'text-white/60 hover:text-white'
							}`}
						>
							{t(tab.labelKey)}
						</button>
					))}
				</div>
			</div>

			{/* Users Table */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="flex items-center justify-between text-xs text-white/50">
					<div>
						{t('ownerUsersPage.matchingUsers')}{' '}
						<span class="font-mono text-white font-bold">{total().toLocaleString()}</span>
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3 font-medium">{t('ownerUsersPage.thProfile')}</th>
								<th class="pb-3 font-medium">{t('ownerUsersPage.thTelegramId')}</th>
								<th class="pb-3 font-medium">{t('ownerUsersPage.thIntelCredits')}</th>
								<th class="pb-3 font-medium">{t('ownerUsersPage.thValuationsLastQuery')}</th>
								<th class="pb-3 font-medium">{t('ownerUsersPage.thStatus')}</th>
								<th class="pb-3 font-medium">{t('ownerUsersPage.thJoined')}</th>
								<th class="pb-3 font-medium text-right">{t('ownerUsersPage.thActions')}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!usersQuery.isLoading && users().length > 0}
								fallback={
									<tr>
										<td colspan="7" class="py-10 text-center text-white/40">
											{usersQuery.isLoading
												? t('ownerUsersPage.searchingUsers')
												: t('ownerUsersPage.noUsersMatching')}
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
														{user.first_name} {user.last_name || ''}
													</span>
													<Show when={user.is_premium}>
														<span class="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[9px] font-black">
															{t('ownerUsersPage.vipProBadge')}
														</span>
													</Show>
												</div>
												<Show when={user.username}>
													<div class="text-[11px] text-sky-400 font-mono">@{user.username}</div>
												</Show>
											</td>
											<td class="py-3 font-mono text-white/70">{user.telegram_id}</td>
											<td class="py-3">
												<span class="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/25 font-mono text-cyan-300 font-black">
													⚡ {(user.intel_credits ?? 0).toLocaleString()}
												</span>
											</td>
											<td class="py-3 font-mono">
												<div class="text-white/85 font-bold">
													{(user.total_valuations_run ?? 0).toLocaleString()} reports
												</div>
												<Show when={user.last_searched_asset}>
													<div class="text-[10px] text-white/45 truncate max-w-[140px]">
														Last: {user.last_searched_asset}
													</div>
												</Show>
											</td>
											<td class="py-3">
												<div class="flex flex-wrap gap-1">
													<Show when={user.is_banned}>
														<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
															{t('ownerUsersPage.statusBanned')}
														</span>
													</Show>
													<Show when={user.is_flagged}>
														<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">
															{t('ownerUsersPage.statusFlagged')}
														</span>
													</Show>
													<Show when={!user.is_banned && !user.is_flagged}>
														<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
															{t('ownerUsersPage.statusActive')}
														</span>
													</Show>
												</div>
											</td>
											<td class="py-3 text-white/50 font-mono text-[11px]">
												{new Date(user.created_at).toLocaleDateString()}
											</td>
											<td class="py-3 text-right">
												<div class="flex items-center justify-end gap-1.5">
													{/* Grant / Adjust Intel Credits */}
													<button
														type="button"
														onClick={() => {
															setSelectedUser(user);
															setAdjustCreditDelta(10);
															setDialogMode('adjustCredits');
														}}
														class="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition flex items-center gap-1"
														title={t('ownerUsersPage.adjustCreditsTitle')}
													>
														<span class="material-symbols-outlined text-[14px]">bolt</span>
														<span>{t('ownerUsersPage.creditsBtn')}</span>
													</button>

													{/* Toggle VIP Pro */}
													<button
														type="button"
														onClick={() =>
															toggleVipMutation.mutate({
																userId: user.telegram_id,
																isPremium: !user.is_premium,
															})
														}
														class={`p-1.5 rounded-lg transition ${
															user.is_premium
																? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
																: 'text-white/40 hover:text-amber-300 hover:bg-white/5'
														}`}
														title={
															user.is_premium
																? t('ownerUsersPage.revokeVip')
																: t('ownerUsersPage.grantVip')
														}
													>
														<span class="material-symbols-outlined text-base">
															workspace_premium
														</span>
													</button>

													{/* Simulate Session */}
													<button
														type="button"
														onClick={() => {
															setSelectedUser(user);
															setDialogMode('simulate');
														}}
														class="p-1.5 rounded-lg text-sky-400 hover:bg-sky-500/10 transition"
														title={t('ownerUsersPage.impersonateTitle')}
													>
														<span class="material-symbols-outlined text-base">person_search</span>
													</button>

													{/* Flag/Unflag */}
													<button
														type="button"
														onClick={() =>
															flagMutation.mutate({
																userId: user.telegram_id,
																isFlagged: !user.is_flagged,
															})
														}
														class={`p-1.5 rounded-lg transition ${
															user.is_flagged
																? 'text-orange-400 bg-orange-500/15'
																: 'text-white/40 hover:text-orange-400 hover:bg-white/5'
														}`}
														title={
															user.is_flagged
																? t('ownerUsersPage.removeFlag')
																: t('ownerUsersPage.flagUser')
														}
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
																title={t('ownerUsersPage.banUserTitle')}
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
															title={t('ownerUsersPage.unbanUserTitle')}
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
							{t('ownerUsersPage.previous')}
						</button>
						<span class="text-white/50">
							{t('ownerUsersPage.pageOf', { page: page() + 1, total: totalPages() })}
						</span>
						<button
							type="button"
							onClick={() => setPage((p) => Math.min(totalPages() - 1, p + 1))}
							disabled={page() >= totalPages() - 1}
							class="px-3 py-1.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-40"
						>
							{t('ownerUsersPage.next')}
						</button>
					</div>
				</Show>
			</div>

			{/* Adjust Intel Credits Modal with Quick Presets */}
			<Show when={dialogMode() === 'adjustCredits' && selectedUser()}>
				<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
					<div class="w-full max-w-md rounded-3xl border border-cyan-500/30 bg-[#0e111a] p-6 space-y-4 text-white shadow-2xl">
						<div class="flex items-center justify-between border-b border-white/10 pb-3">
							<h3 class="text-sm font-black flex items-center gap-2">
								<span class="material-symbols-outlined text-cyan-400">bolt</span>
								<span>{t('ownerUsersPage.modalCreditsTitle')}</span>
							</h3>
							<button
								type="button"
								onClick={closeDialog}
								class="text-xs text-white/50 hover:text-white"
							>
								✕
							</button>
						</div>

						<p class="text-xs text-white/65">
							{t('ownerUsersPage.targetUser')}{' '}
							<span class="font-bold text-white">{selectedUser()?.first_name}</span>{' '}
							<span class="font-mono text-cyan-300">({selectedUser()?.telegram_id})</span>
						</p>

						{/* Quick Preset Buttons */}
						<div class="space-y-1.5">
							<div class="text-[11px] text-white/50 font-semibold">
								{t('ownerUsersPage.quickPresets')}
							</div>
							<div class="grid grid-cols-5 gap-1.5">
								{[1, 5, 10, 25, 100].map((amt) => (
									<button
										type="button"
										onClick={() => setAdjustCreditDelta(amt)}
										class={`py-1.5 rounded-xl font-mono text-xs font-bold border transition ${
											adjustCreditDelta() === amt
												? 'bg-cyan-500 text-black border-cyan-400'
												: 'bg-white/5 text-cyan-300 border-white/10 hover:bg-white/10'
										}`}
									>
										+{amt} ⚡
									</button>
								))}
							</div>
						</div>

						<div class="space-y-1.5">
							<label class="text-[11px] text-white/50 block">
								{t('ownerUsersPage.creditDeltaLabel')}
							</label>
							<input
								type="number"
								value={adjustCreditDelta()}
								onInput={(e) => setAdjustCreditDelta(parseInt(e.currentTarget.value, 10) || 0)}
								class="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-sm text-white focus:border-cyan-400 focus:outline-none"
							/>
						</div>

						<div class="space-y-1.5">
							<label class="text-[11px] text-white/50 block">
								{t('ownerUsersPage.auditReasonLabel')}
							</label>
							<input
								type="text"
								placeholder={t('ownerUsersPage.auditReasonPlaceholder')}
								value={adjustReason()}
								onInput={(e) => setAdjustReason(e.currentTarget.value)}
								class="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/15 text-xs text-white focus:border-cyan-400 focus:outline-none"
							/>
						</div>

						<div class="text-xs p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5">
							<div class="flex justify-between text-white/50">
								<span>{t('ownerUsersPage.currentCredits')}</span>
								<span class="font-mono">
									⚡ {(selectedUser()?.intel_credits ?? 0).toLocaleString()}
								</span>
							</div>
							<div class="flex justify-between font-black text-cyan-400 text-sm">
								<span>{t('ownerUsersPage.projectedCredits')}</span>
								<span class="font-mono">
									⚡{' '}
									{Math.max(
										0,
										(selectedUser()?.intel_credits ?? 0) + adjustCreditDelta(),
									).toLocaleString()}
								</span>
							</div>
						</div>

						<div class="flex gap-2 pt-2">
							<button
								type="button"
								onClick={closeDialog}
								class="flex-1 py-3 rounded-xl border border-white/15 text-xs font-bold text-white/70 hover:bg-white/5"
							>
								{t('ownerUsersPage.cancel')}
							</button>
							<button
								type="button"
								onClick={() => {
									const reason = adjustReason().trim() || 'owner_credit_grant';
									adjustCreditsMutation.mutate({
										userId: selectedUser()!.telegram_id,
										delta: adjustCreditDelta(),
										reason,
									});
								}}
								disabled={adjustCreditDelta() === 0 || adjustCreditsMutation.isPending}
								class="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs disabled:opacity-40"
							>
								{adjustCreditsMutation.isPending
									? t('ownerUsersPage.saving')
									: t('ownerUsersPage.confirmCreditUpdate')}
							</button>
						</div>
					</div>
				</div>
			</Show>

			{/* Simulation Dialog */}
			<Show when={dialogMode() === 'simulate' && selectedUser()}>
				<DangerActionDialog
					isOpen={true}
					title={t('ownerUsersPage.simulateTitle')}
					description={t('ownerUsersPage.simulateDesc', {
						name: selectedUser()?.first_name ?? '',
						id: selectedUser()?.telegram_id ?? '',
					})}
					actionLabel={t('ownerUsersPage.simulateAction')}
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
					title={t('ownerUsersPage.banTitle')}
					description={t('ownerUsersPage.banDesc', {
						name: selectedUser()?.first_name ?? '',
						id: selectedUser()?.telegram_id ?? '',
					})}
					actionLabel={t('ownerUsersPage.banAction')}
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
					title={t('ownerUsersPage.unbanTitle')}
					description={t('ownerUsersPage.unbanDesc', {
						name: selectedUser()?.first_name ?? '',
						id: selectedUser()?.telegram_id ?? '',
					})}
					actionLabel={t('ownerUsersPage.unbanAction')}
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
