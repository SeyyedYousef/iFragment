import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { ownerApi, type PromoCode } from '@/entities/owner/index.js';
import { t } from '@/shared/i18n/index.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.js';

export const OwnerPromos: Component = () => {
	const queryClient = useQueryClient();

	const [code, setCode] = createSignal('');
	const [creditAmount, setCreditAmount] = createSignal(10);
	const [grantVipDays, setGrantVipDays] = createSignal(0);
	const [note, setNote] = createSignal('');
	const [maxUses, setMaxUses] = createSignal(100);
	const [expiresAt, setExpiresAt] = createSignal('');
	const [copiedCode, setCopiedCode] = createSignal<string | null>(null);
	const [promoToDelete, setPromoToDelete] = createSignal<PromoCode | null>(null);

	const promosQuery = createQuery<PromoCode[]>(() => ({
		queryKey: ['owner', 'promos'],
		queryFn: ownerApi.listPromos,
	}));

	const createPromoMutation = createMutation(() => ({
		mutationFn: () =>
			ownerApi.createPromo(
				code().trim().toUpperCase(),
				creditAmount(),
				maxUses(),
				expiresAt() ? new Date(expiresAt()).toISOString() : undefined,
				grantVipDays(),
				note().trim(),
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'promos'] });
			setCode('');
			setCreditAmount(10);
			setGrantVipDays(0);
			setNote('');
			setMaxUses(100);
			setExpiresAt('');
		},
	}));

	const deleteMutation = createMutation(() => ({
		mutationFn: (promoCode: string) => ownerApi.deletePromo(promoCode),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'promos'] });
			setPromoToDelete(null);
		},
	}));

	const generateRandomCode = () => {
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let result = 'INTEL-';
		for (let i = 0; i < 6; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		setCode(result);
	};

	const copyPromo = (promoCode: string) => {
		try {
			navigator.clipboard.writeText(promoCode);
			setCopiedCode(promoCode);
			setTimeout(() => setCopiedCode(null), 2000);
		} catch {}
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		if (!code().trim() || creditAmount() < 1) return;
		createPromoMutation.mutate();
	};

	const promos = () => (promosQuery.data || []) as PromoCode[];

	return (
		<div class="space-y-6">
			{/* Header */}
			<div>
				<h2 class="text-lg font-black text-white">{t('ownerPromoGen.title')}</h2>
				<p class="text-xs text-white/50">{t('ownerPromoGen.subtitle')}</p>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
				{/* Create Form (4 cols) */}
				<div class="lg:col-span-4">
					<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
						<div class="flex items-center justify-between border-b border-white/10 pb-3">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-cyan-400">confirmation_number</span>
								<h3 class="text-sm font-bold text-white">{t('ownerPromoGen.createCardTitle')}</h3>
							</div>
							<button
								type="button"
								onClick={generateRandomCode}
								class="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 font-bold"
							>
								<span class="material-symbols-outlined text-xs">autorenew</span>
								<span>{t('ownerPromoGen.randomBtn')}</span>
							</button>
						</div>

						<form onSubmit={handleSubmit} class="space-y-3.5">
							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerPromoGen.codeLabel')}
								</label>
								<input
									type="text"
									placeholder={t('ownerPromoGen.codePlaceholder')}
									value={code()}
									onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
									class="w-full h-11 bg-white/5 border border-white/15 rounded-xl px-4 text-xs font-mono uppercase text-white outline-none focus:border-cyan-400"
									required
								/>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerPromoGen.creditsGrantedLabel')}
								</label>
								<div class="grid grid-cols-4 gap-1.5 mb-2">
									{[3, 10, 25, 100].map((val) => (
										<button
											type="button"
											onClick={() => setCreditAmount(val)}
											class={`py-1 rounded-lg font-mono text-[11px] font-bold border transition ${
												creditAmount() === val
													? 'bg-cyan-500 text-black border-cyan-400'
													: 'bg-white/5 text-cyan-300 border-white/10'
											}`}
										>
											+{val} ⚡
										</button>
									))}
								</div>
								<input
									type="number"
									max={5000}
									min={1}
									value={creditAmount()}
									onInput={(e) => setCreditAmount(parseInt(e.currentTarget.value, 10) || 1)}
									class="w-full h-10 bg-white/5 border border-white/15 rounded-xl px-3.5 text-xs font-mono text-white outline-none focus:border-cyan-400"
									required
								/>
							</div>

							<div class="grid grid-cols-2 gap-3">
								<div>
									<label class="block text-[11px] font-semibold text-white/60 mb-1">
										{t('ownerPromoGen.maxRedemptionsLabel')}
									</label>
									<input
										type="number"
										min={1}
										value={maxUses()}
										onInput={(e) => setMaxUses(parseInt(e.currentTarget.value, 10) || 1)}
										class="w-full h-10 bg-white/5 border border-white/15 rounded-xl px-3 text-xs font-mono text-white outline-none focus:border-cyan-400"
										required
									/>
								</div>

								<div>
									<label class="block text-[11px] font-semibold text-white/60 mb-1">
										{t('ownerPromoGen.bonusVipDaysLabel')}
									</label>
									<input
										type="number"
										min={0}
										max={365}
										value={grantVipDays()}
										onInput={(e) => setGrantVipDays(parseInt(e.currentTarget.value, 10) || 0)}
										class="w-full h-10 bg-white/5 border border-white/15 rounded-xl px-3 text-xs font-mono text-white outline-none focus:border-cyan-400"
									/>
								</div>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerPromoGen.noteLabel')}
								</label>
								<input
									type="text"
									placeholder={t('ownerPromoGen.notePlaceholder')}
									value={note()}
									onInput={(e) => setNote(e.currentTarget.value)}
									class="w-full h-10 bg-white/5 border border-white/15 rounded-xl px-3.5 text-xs text-white outline-none focus:border-cyan-400"
								/>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('ownerPromoGen.expiryLabel')}
								</label>
								<input
									type="datetime-local"
									value={expiresAt()}
									onInput={(e) => setExpiresAt(e.currentTarget.value)}
									class="w-full h-10 bg-white/5 border border-white/15 rounded-xl px-3 text-xs text-white outline-none focus:border-cyan-400"
								/>
							</div>

							<button
								type="submit"
								disabled={createPromoMutation.isPending || !code().trim()}
								class="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-xs font-black uppercase text-black rounded-xl transition-all disabled:opacity-40 shadow-lg shadow-cyan-500/20"
							>
								{createPromoMutation.isPending
									? t('ownerPromoGen.generatingBtn')
									: t('ownerPromoGen.createBtn')}
							</button>
						</form>
					</div>
				</div>

				{/* Promos Table (8 cols) */}
				<div class="lg:col-span-8">
					<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
						<div class="flex items-center justify-between border-b border-white/10 pb-3">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400">redeem</span>
								<h3 class="text-sm font-bold text-white">{t('ownerPromoGen.activeListTitle')}</h3>
							</div>
						</div>

						<div class="overflow-x-auto">
							<table class="w-full text-left text-xs">
								<thead>
									<tr class="border-b border-white/10 text-white/40">
										<th class="pb-3">{t('ownerPromoGen.thCode')}</th>
										<th class="pb-3">{t('ownerPromoGen.thReward')}</th>
										<th class="pb-3">{t('ownerPromoGen.thRedemptions')}</th>
										<th class="pb-3">{t('ownerPromoGen.thExpires')}</th>
										<th class="pb-3 text-right">{t('ownerPromoGen.thActions')}</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-white/5">
									<Show
										when={!promosQuery.isLoading && promos().length > 0}
										fallback={
											<tr>
												<td colspan="5" class="py-10 text-center text-white/40">
													{promosQuery.isLoading
														? t('ownerPromoGen.loadingPromos')
														: t('ownerPromoGen.noPromos')}
												</td>
											</tr>
										}
									>
										<For each={promos()}>
											{(promo) => {
												const credits = promo.credit_amount || 0;
												const used = promo.uses_count || 0;
												const max = promo.max_uses || 1;
												const pct = Math.min(100, (used / max) * 100);

												return (
													<tr class="hover:bg-white/[0.02] transition">
														<td class="py-3">
															<div class="flex items-center gap-2">
																<span class="font-mono font-black text-amber-400 tracking-wider">
																	{promo.code}
																</span>
																<button
																	type="button"
																	onClick={() => copyPromo(promo.code)}
																	class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white/60"
																>
																	{copiedCode() === promo.code ? '✓' : 'Copy'}
																</button>
															</div>
															<Show when={promo.note}>
																<div class="text-[10px] text-white/40 mt-0.5">{promo.note}</div>
															</Show>
														</td>
														<td class="py-3 font-mono">
															<span class="text-cyan-300 font-black">
																⚡ +{credits.toLocaleString()} Credits
															</span>
															<Show when={(promo.grant_vip_days ?? 0) > 0}>
																<span class="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
																	+{promo.grant_vip_days}d VIP
																</span>
															</Show>
														</td>
														<td class="py-3 w-36">
															<div class="text-[11px] font-mono text-white/70 mb-1">
																{used} / {max} ({Math.round(pct)}%)
															</div>
															<div class="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
																<div
																	style={{ width: `${pct}%` }}
																	class="h-full bg-gradient-to-r from-cyan-400 to-amber-400"
																/>
															</div>
														</td>
														<td class="py-3 text-white/50 font-mono text-[11px]">
															{promo.expires_at
																? new Date(promo.expires_at).toLocaleDateString()
																: t('ownerPromoGen.neverExpires')}
														</td>
														<td class="py-3 text-right">
															<button
																type="button"
																onClick={() => setPromoToDelete(promo)}
																class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
																title={t('ownerPromoGen.deleteTooltip')}
															>
																<span class="material-symbols-outlined text-base">delete</span>
															</button>
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
			</div>

			{/* Danger Action Dialog for Deletion */}
			<Show when={promoToDelete()}>
				<DangerActionDialog
					isOpen={true}
					title={t('ownerPromoGen.deleteTitle')}
					description={t('ownerPromoGen.deleteDesc', { code: promoToDelete()?.code ?? '' })}
					actionLabel={t('ownerPromoGen.deleteAction')}
					riskLevel="medium"
					requireReason={false}
					loading={deleteMutation.isPending}
					onConfirm={() => {
						if (promoToDelete()) {
							deleteMutation.mutate(promoToDelete()!.code);
						}
					}}
					onClose={() => setPromoToDelete(null)}
				/>
			</Show>
		</div>
	);
};
