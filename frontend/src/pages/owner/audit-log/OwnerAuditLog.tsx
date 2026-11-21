import { createQuery } from '@tanstack/solid-query';
import { type Component, createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { AuditLogEntry } from '@/entities/owner/model/types.js';
import { t } from '@/shared/i18n/index.js';

export const OwnerAuditLog: Component = () => {
	const [actionFilter, setActionFilter] = createSignal('');
	const [searchKeyword, setSearchKeyword] = createSignal('');
	const [debouncedKeyword, setDebouncedKeyword] = createSignal('');
	const [page, setPage] = createSignal(0);
	const pageSize = 25;

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

	const auditQuery = createQuery<{ logs: AuditLogEntry[]; total: number }>(() => ({
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
					<h2 class="text-lg font-black text-white">{t('ownerAuditPage.title')}</h2>
					<p class="text-xs text-white/50">
						{t('ownerAuditPage.subtitle', { count: total().toLocaleString('en-US') })}
					</p>
				</div>
			</div>

			{/* Filters Bar */}
			<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
				<div class="relative flex-1">
					<span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-lg">
						search
					</span>
					<input
						type="text"
						placeholder={t('ownerAuditPage.searchPlaceholder')}
						value={searchKeyword()}
						onInput={(e) => setSearchKeyword(e.currentTarget.value)}
						class="w-full h-11 pl-10 pr-4 rounded-2xl bg-white/5 border border-white/15 text-white text-xs placeholder:text-white/30 focus:border-cyan-400 focus:outline-none transition"
					/>
				</div>

				<select
					value={actionFilter()}
					onChange={(e) => {
						setActionFilter(e.currentTarget.value);
						setPage(0);
					}}
					class="h-11 px-4 rounded-2xl bg-[#0e111a] border border-white/15 text-white text-xs focus:border-cyan-400 focus:outline-none"
				>
					<option value="">{t('ownerAuditPage.allActionTypes')}</option>
					<option value="owner_login">{t('ownerAuditPage.act_owner_login')}</option>
					<option value="adjust_intel_credits">
						{t('ownerAuditPage.act_adjust_intel_credits')}
					</option>
					<option value="toggle_vip">{t('ownerAuditPage.act_toggle_vip')}</option>
					<option value="update_settings">{t('ownerAuditPage.act_update_settings')}</option>
					<option value="connect_mtproto_session">
						{t('ownerAuditPage.act_connect_mtproto_session')}
					</option>
					<option value="delete_userbot">{t('ownerAuditPage.act_delete_userbot')}</option>
					<option value="create_promo">{t('ownerAuditPage.act_create_promo')}</option>
					<option value="ban_user">{t('ownerAuditPage.act_ban_user')}</option>
					<option value="clear_cache">{t('ownerAuditPage.act_clear_cache')}</option>
				</select>
			</div>

			{/* Audit Log Table */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3">{t('ownerAuditPage.thAction')}</th>
								<th class="pb-3">{t('ownerAuditPage.thOperatorTarget')}</th>
								<th class="pb-3">{t('ownerAuditPage.thPayload')}</th>
								<th class="pb-3">{t('ownerAuditPage.thNetwork')}</th>
								<th class="pb-3 text-right">{t('ownerAuditPage.thTimestamp')}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!auditQuery.isLoading && logs().length > 0}
								fallback={
									<tr>
										<td colspan="5" class="py-8 text-center text-white/40">
											{auditQuery.isLoading
												? t('ownerAuditPage.loadingTrail')
												: t('ownerAuditPage.noEvents')}
										</td>
									</tr>
								}
							>
								<For each={logs()}>
									{(log) => (
										<tr class="hover:bg-white/[0.02] transition align-top">
											<td class="py-3 font-mono font-bold text-amber-400">
												<span class="px-2.5 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/10">
													{log.action}
												</span>
											</td>
											<td class="py-3 font-mono text-white/80">
												<div>{t('ownerAuditPage.ownerPrefix', { id: log.owner_id })}</div>
												<Show when={log.target_user_id || log.target_id}>
													<div class="text-[11px] text-cyan-400">
														{t('ownerAuditPage.targetPrefix', {
															id: log.target_user_id || log.target_id,
														})}
													</div>
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
												<div>{log.ip_address || '127.0.0.1'}</div>
											</td>
											<td class="py-3 text-white/50 text-right font-mono text-[11px]">
												{new Date(log.created_at).toLocaleString('en-US')}
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
							{t('ownerAuditPage.previous')}
						</button>
						<span class="text-white/50">
							{t('ownerAuditPage.pageOf', { page: page() + 1, total: totalPages() })}
						</span>
						<button
							type="button"
							onClick={() => setPage((p) => Math.min(totalPages() - 1, p + 1))}
							disabled={page() >= totalPages() - 1}
							class="px-3 py-1.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-40"
						>
							{t('ownerAuditPage.next')}
						</button>
					</div>
				</Show>
			</div>
		</div>
	);
};
