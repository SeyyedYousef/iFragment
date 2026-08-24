import { createSignal, createEffect, onCleanup, Show, For, type Component } from 'solid-js';
import { createQuery } from '@tanstack/solid-query';
import { ownerApi } from '../../../entities/owner/api/ownerApi';
import type { AuditLogEntry } from '../../../entities/owner/model/types';

export const OwnerAuditLog: Component = () => {
	const [actionFilter, setActionFilter] = createSignal('');
	const [searchKeyword, setSearchKeyword] = createSignal('');
	const [debouncedKeyword, setDebouncedKeyword] = createSignal('');
	const [page, setPage] = createSignal(0);
	const pageSize = 25;

	// Search Debounce 300ms
	let timer: any;
	createEffect(() => {
		const q = searchKeyword();
		clearTimeout(timer);
		timer = setTimeout(() => {
			setDebouncedKeyword(q);
			setPage(0);
		}, 300);
	});
	onCleanup(() => clearTimeout(timer));

	const auditQuery = createQuery(() => ({
		queryKey: ['owner', 'audit-logs', actionFilter(), debouncedKeyword(), page()],
		queryFn: () =>
			ownerApi.getAuditLogs({
				action: actionFilter() || undefined,
				search: debouncedKeyword() || undefined,
				limit: pageSize,
				offset: page() * pageSize,
			}),
	}));

	const logs = () => auditQuery.data?.logs || [];
	const total = () => auditQuery.data?.total || 0;
	const totalPages = () => Math.ceil(total() / pageSize);

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div>
					<h2 class="text-lg font-bold text-white">Immutable Security Audit Logs</h2>
					<p class="text-xs text-white/50">
						Server-sanitized security events with recursive secret redaction (Total: {total().toLocaleString()} events)
					</p>
				</div>
			</div>

			{/* Filters Bar */}
			<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
				<div class="relative flex-1">
					<span class="material-symbols-rounded absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-lg">
						search
					</span>
					<input
						type="text"
						placeholder="Search by action, operator ID, IP, or payload..."
						value={searchKeyword()}
						onInput={(e) => setSearchKeyword(e.currentTarget.value)}
						class="w-full h-11 pl-10 pr-4 rounded-2xl bg-white/5 border border-white/15 text-white text-xs placeholder:text-white/30 focus:border-amber-400 focus:outline-none transition"
					/>
				</div>

				<select
					value={actionFilter()}
					onChange={(e) => {
						setActionFilter(e.currentTarget.value);
						setPage(0);
					}}
					class="h-11 px-4 rounded-2xl bg-neutral-900 border border-white/15 text-white text-xs focus:border-amber-400 focus:outline-none"
				>
					<option value="">All Action Types</option>
					<option value="owner_login">Owner Login</option>
					<option value="setup_totp">Setup TOTP</option>
					<option value="impersonate_user">Impersonate User</option>
					<option value="ban_user">Ban User</option>
					<option value="adjust_balance">Adjust Balance</option>
					<option value="extend_subscription">Extend Subscription</option>
					<option value="grant_coins">Grant Coins</option>
					<option value="update_settings">Update Settings</option>
					<option value="create_ad">Create Ad</option>
					<option value="delete_userbot">Delete Userbot</option>
				</select>
			</div>

			{/* Audit Log Table */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3">Action</th>
								<th class="pb-3">Operator / Target</th>
								<th class="pb-3">Payload (Sanitized)</th>
								<th class="pb-3">IP / Network</th>
								<th class="pb-3 text-right">Timestamp</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!auditQuery.isLoading && logs().length > 0}
								fallback={
									<tr>
										<td colspan="5" class="py-8 text-center text-white/40">
											{auditQuery.isLoading ? 'Loading audit logs...' : 'No audit events found'}
										</td>
									</tr>
								}
							>
								<For each={logs()}>
									{(log) => (
										<tr class="hover:bg-white/[0.02] transition align-top">
											<td class="py-3 font-mono font-bold text-amber-400">
												<span class="px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/10">
													{log.action}
												</span>
											</td>
											<td class="py-3 font-mono text-white/80">
												<div>Owner: {log.owner_id}</div>
												<Show when={log.target_user_id || log.target_id}>
													<div class="text-[11px] text-sky-400">Target: {log.target_user_id || log.target_id}</div>
												</Show>
											</td>
											<td class="py-3 max-w-sm">
												<Show
													when={log.payload && Object.keys(log.payload).length > 0}
													fallback={<span class="text-white/30">—</span>}
												>
													<pre class="bg-black/50 p-2 rounded-xl text-[10px] font-mono text-white/70 overflow-x-auto max-h-24 no-scrollbar border border-white/5">
														{JSON.stringify(log.payload, null, 2)}
													</pre>
												</Show>
											</td>
											<td class="py-3 font-mono text-white/50 text-[11px]">
												<div>{log.ip_address || '—'}</div>
												<Show when={log.user_agent}>
													<div class="truncate max-w-[120px] text-[10px] text-white/30">{log.user_agent}</div>
												</Show>
											</td>
											<td class="py-3 text-white/50 text-right font-mono text-[11px]">
												{new Date(log.created_at).toLocaleString()}
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
							onClick={() => setPage((p) => Math.max(0, p - 1))}
							disabled={page() === 0}
							class="px-3 py-1.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-40"
						>
							Previous
						</button>
						<span class="text-white/50">
							Page {page() + 1} of {totalPages()}
						</span>
						<button
							onClick={() => setPage((p) => Math.min(totalPages() - 1, p + 1))}
							disabled={page() >= totalPages() - 1}
							class="px-3 py-1.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-40"
						>
							Next
						</button>
					</div>
				</Show>
			</div>
		</div>
	);
};
