import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { BroadcastMessage } from '@/entities/owner/model/types.js';
import { t } from '@/shared/i18n/index.js';

export const OwnerBroadcast: Component = () => {
	const queryClient = useQueryClient();

	// Form State
	const [targetAudience, setTargetAudience] = createSignal<
		'all' | 'premium' | 'active_7d' | 'inactive'
	>('all');
	const [messageText, setMessageText] = createSignal('');
	const [isScheduled, setIsScheduled] = createSignal(false);
	const [scheduledAt, setScheduledAt] = createSignal('');

	const broadcastsQuery = createQuery<BroadcastMessage[]>(() => ({
		queryKey: ['owner', 'broadcasts'],
		queryFn: ownerApi.listBroadcasts,
		refetchInterval: 5000, // 5s live progress polling
	}));

	const audienceCountQuery = createQuery<{ count: number }>(() => ({
		queryKey: ['owner', 'broadcasts', 'audience-count', targetAudience()],
		queryFn: () => ownerApi.getAudienceCount(targetAudience()),
	}));

	const createBroadcastMutation = createMutation(() => ({
		mutationFn: (data: { target_audience: string; message: string; scheduled_at?: string }) =>
			ownerApi.createBroadcast(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'broadcasts'] });
			setMessageText('');
			setIsScheduled(false);
			setScheduledAt('');
		},
	}));

	const pauseMutation = createMutation(() => ({
		mutationFn: (id: string) => ownerApi.pauseBroadcast(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner', 'broadcasts'] }),
	}));

	const resumeMutation = createMutation(() => ({
		mutationFn: (id: string) => ownerApi.resumeBroadcast(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner', 'broadcasts'] }),
	}));

	const insertTag = (openTag: string, closeTag: string) => {
		setMessageText((prev) => `${prev}${openTag}text${closeTag}`);
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		if (!messageText().trim()) return;

		createBroadcastMutation.mutate({
			target_audience: targetAudience(),
			message: messageText().trim(),
			scheduled_at:
				isScheduled() && scheduledAt() ? new Date(scheduledAt()).toISOString() : undefined,
		});
	};

	const broadcasts = () => (broadcastsQuery.data || []) as BroadcastMessage[];

	return (
		<div class="space-y-6">
			{/* Header */}
			<div>
				<h2 class="text-lg font-bold text-white">{t('ownerBroadcast.title')}</h2>
				<p class="text-xs text-white/50">{t('ownerBroadcast.subtitle')}</p>
			</div>

			{/* Compose Card */}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Composer Form */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-amber-400">send</span>
						<h3 class="text-sm font-bold text-white">{t('ownerBroadcast.newMessageTitle')}</h3>
					</div>

					<form onSubmit={handleSubmit} class="space-y-4">
						{/* Target Audience */}
						<div>
							<div class="flex items-center justify-between text-xs mb-1.5">
								<span class="text-white/60">{t('ownerBroadcast.targetAudience')}</span>
								<span class="text-amber-400 font-mono">
									{audienceCountQuery.isLoading
										? t('ownerBroadcast.counting')
										: t('ownerBroadcast.usersTargeted', {
												count: (audienceCountQuery.data?.count ?? 0).toLocaleString(),
											})}
								</span>
							</div>
							<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
								{[
									{ id: 'all', label: t('ownerBroadcast.allUsers') },
									{ id: 'premium', label: t('ownerBroadcast.premiumOnly') },
									{ id: 'active_7d', label: t('ownerBroadcast.active7d') },
									{ id: 'inactive', label: t('ownerBroadcast.inactive') },
								].map((aud) => (
									<button
										type="button"
										onClick={() => setTargetAudience(aud.id as any)}
										class={`py-2 rounded-xl text-xs font-semibold transition ${
											targetAudience() === aud.id
												? 'bg-amber-500 text-black'
												: 'bg-white/5 text-white/60 hover:text-white'
										}`}
									>
										{aud.label}
									</button>
								))}
							</div>
						</div>

						{/* Formatting Toolbar */}
						<div class="flex items-center gap-1.5 border-t border-b border-white/10 py-2 text-xs">
							<span class="text-white/40 text-[11px] mr-1">{t('ownerBroadcast.htmlTags')}</span>
							<button
								type="button"
								onClick={() => insertTag('<b>', '</b>')}
								class="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white font-bold"
							>
								{'<b>'}
							</button>
							<button
								type="button"
								onClick={() => insertTag('<i>', '</i>')}
								class="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white italic"
							>
								{'<i>'}
							</button>
							<button
								type="button"
								onClick={() => insertTag('<a href="https://t.me/...">', '</a>')}
								class="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-amber-400"
							>
								{'<a>'}
							</button>
							<button
								type="button"
								onClick={() => insertTag('<code>', '</code>')}
								class="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-sky-400 font-mono"
							>
								{'<code>'}
							</button>
						</div>

						{/* Textarea */}
						<div>
							<textarea
								rows={5}
								placeholder={t('ownerBroadcast.placeholder')}
								value={messageText()}
								onInput={(e) => setMessageText(e.currentTarget.value)}
								class="w-full p-3.5 rounded-2xl bg-white/5 border border-white/15 text-white text-xs placeholder:text-white/30 focus:border-amber-400 focus:outline-none resize-none font-sans leading-relaxed"
								required
							/>
						</div>

						{/* Scheduling Option */}
						<div class="space-y-2 rounded-2xl bg-white/[0.02] border border-white/5 p-3.5">
							<div class="flex items-center gap-2 text-xs text-white cursor-pointer select-none">
								<input
									type="checkbox"
									checked={isScheduled()}
									onChange={(e) => setIsScheduled(e.currentTarget.checked)}
									class="rounded accent-amber-500 h-4 w-4"
								/>
								<span>{t('ownerBroadcast.scheduleLater')}</span>
							</div>

							<Show when={isScheduled()}>
								<div class="pt-2">
									<input
										type="datetime-local"
										value={scheduledAt()}
										onInput={(e) => setScheduledAt(e.currentTarget.value)}
										class="w-full h-10 px-3 rounded-xl bg-black/50 border border-white/15 text-white text-xs focus:border-amber-400 focus:outline-none"
									/>
								</div>
							</Show>
						</div>

						{/* Submit */}
						<button
							type="submit"
							disabled={createBroadcastMutation.isPending || !messageText().trim()}
							class="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
						>
							<Show
								when={createBroadcastMutation.isPending}
								fallback={
									<span>
										{isScheduled()
											? t('ownerBroadcast.scheduleBroadcast')
											: t('ownerBroadcast.queueImmediately')}
									</span>
								}
							>
								<div class="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
								<span>{t('ownerBroadcast.queueing')}</span>
							</Show>
						</button>
					</form>
				</div>

				{/* HTML Live Preview Box */}
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4 flex flex-col">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-sky-400">preview</span>
						<h3 class="text-sm font-bold text-white">{t('ownerBroadcast.previewTitle')}</h3>
					</div>

					<div class="flex-1 rounded-2xl border border-white/10 bg-[#17212b] p-4 text-white text-xs leading-relaxed overflow-y-auto">
						<Show
							when={messageText().trim()}
							fallback={
								<div class="text-white/30 italic text-center my-auto">
									{t('ownerBroadcast.previewEmpty')}
								</div>
							}
						>
							<div
								innerHTML={messageText()}
								class="prose prose-invert prose-xs max-w-none break-words"
							/>
						</Show>
					</div>
					<div class="text-[11px] text-white/40 text-center">{t('ownerBroadcast.previewNote')}</div>
				</div>
			</div>

			{/* Broadcast Queue & History */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-amber-400">queue</span>
						<span class="text-sm font-bold text-white">{t('ownerBroadcast.queueTitle')}</span>
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3 font-medium">{t('ownerBroadcast.thAudienceMessage')}</th>
								<th class="pb-3 font-medium">{t('ownerBroadcast.thStatus')}</th>
								<th class="pb-3 font-medium">{t('ownerBroadcast.thProgress')}</th>
								<th class="pb-3 font-medium">{t('ownerBroadcast.thScheduled')}</th>
								<th class="pb-3 font-medium">{t('ownerBroadcast.thFailed')}</th>
								<th class="pb-3 font-medium text-right">{t('ownerBroadcast.thControl')}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!broadcastsQuery.isLoading && broadcasts().length > 0}
								fallback={
									<tr>
										<td colspan="6" class="py-8 text-center text-white/40">
											{broadcastsQuery.isLoading
												? t('ownerBroadcast.loadingQueue')
												: t('ownerBroadcast.emptyQueue')}
										</td>
									</tr>
								}
							>
								<For each={broadcasts()}>
									{(b) => {
										const pct = () =>
											b.total_count > 0 ? (b.sent_count / b.total_count) * 100 : 0;
										return (
											<tr class="hover:bg-white/[0.02] transition">
												<td class="py-3 max-w-[280px]">
													<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-amber-400 border border-white/10 uppercase mr-2">
														{b.target_audience}
													</span>
													<div class="truncate text-white/80 mt-1">
														{b.message || b.message_text}
													</div>
												</td>
												<td class="py-3">
													<span
														class={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
															b.status === 'completed'
																? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
																: b.status === 'sending'
																	? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse'
																	: b.status === 'paused'
																		? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
																		: b.status === 'failed'
																			? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
																			: 'bg-white/5 text-white/50'
														}`}
													>
														{b.status}
													</span>
												</td>
												<td class="py-3 w-40">
													<div class="text-[11px] font-mono text-white/70 mb-1">
														{b.sent_count.toLocaleString()} / {b.total_count.toLocaleString()} (
														{pct().toFixed(0)}%)
													</div>
													<div class="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
														<div
															style={{ width: `${pct()}%` }}
															class="h-full bg-amber-400 transition-all duration-300"
														/>
													</div>
												</td>
												<td class="py-3 text-white/50">
													{b.scheduled_at
														? new Date(b.scheduled_at).toLocaleString()
														: t('ownerBroadcast.immediate')}
												</td>
												<td class="py-3 font-mono text-rose-400 font-bold">
													{(b.failed_count ?? 0).toLocaleString()}
												</td>
												<td class="py-3 text-right">
													<div class="flex items-center justify-end gap-1.5">
														<Show when={b.status === 'sending'}>
															<button
																type="button"
																onClick={() => pauseMutation.mutate(b.id)}
																class="px-2.5 py-1 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 font-medium text-xs"
															>
																{t('ownerBroadcast.pause')}
															</button>
														</Show>
														<Show when={b.status === 'paused'}>
															<button
																type="button"
																onClick={() => resumeMutation.mutate(b.id)}
																class="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium text-xs"
															>
																{t('ownerBroadcast.resume')}
															</button>
														</Show>
													</div>
												</td>
											</tr>
										);
									}}
								</For>
							</Show>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};
