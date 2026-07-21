import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { AuditLogEntry, ownerApi } from '@/shared/api/owner.js';

export const OwnerAuditLog: Component = () => {
	const [logs, setLogs] = createSignal<AuditLogEntry[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal('');
	const [offset, setOffset] = createSignal(0);
	const [hasMore, setHasMore] = createSignal(true);
	const [searchQuery, setSearchQuery] = createSignal('');
	const [expandedLogId, setExpandedLogId] = createSignal<string | number | null>(null);
	const limit = 20;

	const redactSensitiveKeys = (data?: Record<string, any>): Record<string, any> | undefined => {
		if (!data) return undefined;
		const clone = { ...data };
		const sensitivePatterns = ['token', 'password', 'secret', 'initdata', 'auth'];
		Object.keys(clone).forEach((key) => {
			if (sensitivePatterns.some((p) => key.toLowerCase().includes(p))) {
				clone[key] = '*** [REDACTED SECRET] ***';
			} else if (typeof clone[key] === 'object' && clone[key] !== null) {
				clone[key] = redactSensitiveKeys(clone[key]);
			}
		});
		return clone;
	};

	const loadLogs = async (currentOffset: number, append: boolean = false) => {
		setLoading(true);
		setError('');
		try {
			const res = await ownerApi.getAuditLogs(limit, currentOffset);
			const fetched = res.logs || [];
			setHasMore(res.has_more ?? fetched.length >= limit);

			if (append) {
				setLogs([...logs(), ...fetched]);
			} else {
				setLogs(fetched);
			}
		} catch (err: any) {
			setError(err.response?.data?.error || 'خطا در دریافت لاگ‌های امنیتی سیستم');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		loadLogs(0);
	});

	const handleLoadMore = () => {
		if (loading() || !hasMore()) return;
		try {
			hapticFeedback.impactOccurred('light');
		} catch {}
		const nextOffset = offset() + limit;
		setOffset(nextOffset);
		loadLogs(nextOffset, true);
	};

	const toggleExpand = (id: string | number) => {
		setExpandedLogId(expandedLogId() === id ? null : id);
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		try {
			hapticFeedback.notificationOccurred('success');
		} catch {}
	};

	const filteredLogs = () => {
		const q = searchQuery().trim().toLowerCase();
		if (!q) return logs();
		return logs().filter(
			(l) =>
				l.action.toLowerCase().includes(q) ||
				String(l.owner_id).includes(q) ||
				(l.target_id && String(l.target_id).includes(q)) ||
				l.ip_address?.includes(q),
		);
	};

	return (
		<div class="space-y-6">
			{/* Search & Action Filter Bar */}
			<div class="bg-[#16171d]/60 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
				<div>
					<h2 class="text-sm font-black text-white">لاگ‌ها و رویدادهای امنیتی سیستم</h2>
					<p class="text-xs text-white/40 font-bold mt-0.5">
						ثبت غیرقابل تغییر (Audit Ledger) تمام تراکنش‌های ارشد
					</p>
				</div>

				<div class="w-full md:w-72 bg-black/40 border border-white/10 focus-within:border-[#3390ec] rounded-2xl px-4 flex items-center gap-2.5 transition-all">
					<span class="material-symbols-outlined text-white/40 text-[18px]">search</span>
					<input
						type="text"
						placeholder="فیلتر رویداد، آی‌پی، شناسه ادمین..."
						value={searchQuery()}
						onInput={(e) => setSearchQuery(e.currentTarget.value)}
						class="w-full h-11 bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
					/>
				</div>
			</div>

			<Show when={error()}>
				<div class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold">
					<span class="material-symbols-outlined text-xl">error</span>
					<span>{error()}</span>
				</div>
			</Show>

			{/* Log List */}
			<div class="space-y-3.5">
				<For each={filteredLogs()}>
					{(log) => {
						const isExpanded = () => expandedLogId() === log.id;
						const safePayload = redactSensitiveKeys(log.payload);
						return (
							<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 space-y-3 transition-all hover:border-white/20">
								<div class="flex items-center justify-between gap-3 pb-3 border-b border-white/5">
									<div class="flex items-center gap-2.5">
										<span class="px-2.5 py-1 rounded-xl bg-[#3390ec]/10 border border-[#3390ec]/20 text-[10px] font-mono font-bold text-[#3390ec]">
											{log.action}
										</span>
										<span class="text-xs text-white font-bold">ادمین: {log.owner_id}</span>
									</div>

									<span class="text-[10px] text-white/40 font-mono">
										{log.created_at ? new Date(log.created_at).toLocaleString('fa-IR') : '---'}
									</span>
								</div>

								<div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-white/70">
									<Show when={log.target_id}>
										<div>
											<span class="text-white/40 font-bold block text-[10px]">
												موجودیت/کاربر هدف:
											</span>
											<span class="font-mono text-white text-xs">{log.target_id}</span>
										</div>
									</Show>

									<Show when={log.ip_address}>
										<div>
											<span class="text-white/40 font-bold block text-[10px]">آدرس IP:</span>
											<span class="font-mono text-emerald-400 text-xs">{log.ip_address}</span>
										</div>
									</Show>

									<Show when={log.user_agent}>
										<div class="md:col-span-3">
											<span class="text-white/40 font-bold block text-[10px]">
												مشخصات مرورگر / User Agent:
											</span>
											<span class="font-mono text-[10px] text-white/50 truncate block">
												{log.user_agent}
											</span>
										</div>
									</Show>
								</div>

								{/* Payload Viewer */}
								<Show when={safePayload}>
									<div class="pt-2">
										<button
											onClick={() => toggleExpand(log.id)}
											class="text-[10px] font-bold text-[#3390ec] flex items-center gap-1 hover:underline"
										>
											<span class="material-symbols-outlined text-[14px]">
												{isExpanded() ? 'unfold_less' : 'unfold_more'}
											</span>
											{isExpanded() ? 'پنهان‌سازی جزئیات Payload' : 'مشاهده جزئیات Payload'}
										</button>

										<Show when={isExpanded()}>
											<div class="mt-2 p-3 bg-black/60 border border-white/10 rounded-2xl relative font-mono text-[11px] text-emerald-400/90 overflow-x-auto">
												<button
													onClick={() => copyToClipboard(JSON.stringify(safePayload, null, 2))}
													class="absolute top-2 end-2 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[9px] font-sans font-bold transition-all"
												>
													کپی JSON
												</button>
												<pre class="whitespace-pre-wrap leading-relaxed">
													{JSON.stringify(safePayload, null, 2)}
												</pre>
											</div>
										</Show>
									</div>
								</Show>
							</div>
						);
					}}
				</For>
			</div>

			{/* Load More Control */}
			<Show when={!loading() && hasMore()}>
				<button
					onClick={handleLoadMore}
					class="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black text-white rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95"
				>
					<span class="material-symbols-outlined text-[18px]">expand_more</span>
					بارگذاری صفحات بعدی
				</button>
			</Show>

			<Show when={loading()}>
				<div class="flex justify-center items-center py-10">
					<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
				</div>
			</Show>
		</div>
	);
};
