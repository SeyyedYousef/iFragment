import { createSignal, Show, For, type Component } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { PromoCode } from '@/entities/owner/model/types.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.jsx';

export const OwnerPromos: Component = () => {
	const queryClient = useQueryClient();

	const [code, setCode] = createSignal('');
	const [rewardAmount, setRewardAmount] = createSignal(10000);
	const [maxUses, setMaxUses] = createSignal(100);
	const [expiresAt, setExpiresAt] = createSignal('');
	const [promoToDelete, setPromoToDelete] = createSignal<PromoCode | null>(null);

	const promosQuery = createQuery<PromoCode[]>(() => ({
		queryKey: ['owner', 'promos'],
		queryFn: ownerApi.listPromos,
	}));

	const createPromoMutation = createMutation(() => ({
		mutationFn: () =>
			ownerApi.createPromo(
				code().trim().toUpperCase(),
				rewardAmount(),
				maxUses(),
				expiresAt() ? new Date(expiresAt()).toISOString() : undefined
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'promos'] });
			setCode('');
			setRewardAmount(10000);
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

	// Generates unambiguous code (no O, 0, I, 1)
	const generateRandomCode = () => {
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let result = '';
		for (let i = 0; i < 8; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		setCode(result);
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		if (!code().trim()) return;
		// 100K Reward Cap check
		if (rewardAmount() > 100000) {
			alert('Maximum promo reward amount is 100,000 Coins');
			return;
		}
		createPromoMutation.mutate();
	};

	const promos = () => (promosQuery.data || []) as PromoCode[];

	return (
		<div class="space-y-6">
			{/* Header */}
			<div>
				<h2 class="text-lg font-bold text-white">Promotional Gift Codes</h2>
				<p class="text-xs text-white/50">
					Generate and distribute promo codes with redemption limits and anti-abuse caps (max 100K)
				</p>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Create Form */}
				<div class="lg:col-span-1">
					<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="material-symbols-rounded text-amber-400">confirmation_number</span>
								<h3 class="text-sm font-bold text-white">Create Promo Code</h3>
							</div>
							<button
								type="button"
								onClick={generateRandomCode}
								class="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
							>
								<span class="material-symbols-rounded text-xs">autorenew</span>
								<span>Generate</span>
							</button>
						</div>

						<form onSubmit={handleSubmit} class="space-y-3">
							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">Promo Code</label>
								<input
									type="text"
									placeholder="e.g., SUMMER2026"
									value={code()}
									onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
									class="w-full h-11 bg-white/5 border border-white/15 rounded-xl px-4 text-xs font-mono uppercase text-white outline-none focus:border-amber-400"
									required
								/>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									Reward Amount (Max 100,000 Coins)
								</label>
								<input
									type="number"
									max={100000}
									min={100}
									value={rewardAmount()}
									onInput={(e) => setRewardAmount(parseInt(e.currentTarget.value, 10) || 0)}
									class="w-full h-11 bg-white/5 border border-white/15 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-amber-400"
									required
								/>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">Max Redemptions</label>
								<input
									type="number"
									min={1}
									value={maxUses()}
									onInput={(e) => setMaxUses(parseInt(e.currentTarget.value, 10) || 1)}
									class="w-full h-11 bg-white/5 border border-white/15 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-amber-400"
									required
								/>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">Expiry Date (Optional)</label>
								<input
									type="datetime-local"
									value={expiresAt()}
									onInput={(e) => setExpiresAt(e.currentTarget.value)}
									class="w-full h-11 bg-white/5 border border-white/15 rounded-xl px-3 text-xs text-white outline-none focus:border-amber-400"
								/>
							</div>

							<button
								type="submit"
								disabled={createPromoMutation.isPending || !code().trim()}
								class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-xs font-bold uppercase text-black rounded-xl transition-all disabled:opacity-40 shadow-lg shadow-amber-500/20"
							>
								{createPromoMutation.isPending ? 'Generating...' : 'Create Promo Code'}
							</button>
						</form>
					</div>
				</div>

				{/* Promos Table */}
				<div class="lg:col-span-2">
					<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="material-symbols-rounded text-amber-400">redeem</span>
								<h3 class="text-sm font-bold text-white">Active Promo Codes</h3>
							</div>
						</div>

						<div class="overflow-x-auto">
							<table class="w-full text-left text-xs">
								<thead>
									<tr class="border-b border-white/10 text-white/40">
										<th class="pb-3">Code</th>
										<th class="pb-3">Reward</th>
										<th class="pb-3">Uses / Limit</th>
										<th class="pb-3">Expires</th>
										<th class="pb-3 text-right">Actions</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-white/5">
									<Show
										when={!promosQuery.isLoading && promos().length > 0}
										fallback={
											<tr>
												<td colspan="5" class="py-8 text-center text-white/40">
													{promosQuery.isLoading ? 'Loading promo codes...' : 'No promo codes found'}
												</td>
											</tr>
										}
									>
										<For each={promos()}>
											{(promo) => {
												const reward = promo.reward_amount || promo.reward_frg || 0;
												const used = promo.uses_count || promo.current_uses || 0;
												const max = promo.max_uses || 1;
												const pct = Math.min(100, (used / max) * 100);

												return (
													<tr class="hover:bg-white/[0.02] transition">
														<td class="py-3 font-mono font-bold text-amber-400 tracking-wider">
															{promo.code}
														</td>
														<td class="py-3 font-mono text-emerald-400 font-bold">
															{reward.toLocaleString()} Coins
														</td>
														<td class="py-3 w-36">
															<div class="text-[11px] font-mono text-white/70 mb-1">
																{used} / {max}
															</div>
															<div class="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
																<div
																	style={{ width: `${pct}%` }}
																	class="h-full bg-amber-400"
																/>
															</div>
														</td>
														<td class="py-3 text-white/50">
															{promo.expires_at ? new Date(promo.expires_at).toLocaleDateString() : 'Never'}
														</td>
														<td class="py-3 text-right">
															<button
																onClick={() => setPromoToDelete(promo)}
																class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
																title="Delete Promo Code"
															>
																<span class="material-symbols-rounded text-base">delete</span>
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
					title="Delete Promo Code"
					description={`Permanently invalidate promo code "${promoToDelete()?.code}"? Users will no longer be able to claim it.`}
					actionLabel="Delete Promo Code"
					confirmWord="DELETE"
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
