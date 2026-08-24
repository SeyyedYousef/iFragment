import { createSignal, Show, For, type Component } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { ownerApi } from '../../../entities/owner/api/ownerApi';
import type { AdminDailyCombo } from '../../../entities/owner/model/types';
import { DangerActionDialog } from '../../../widgets/owner/DangerActionDialog';

export const OwnerCombos: Component = () => {
	const queryClient = useQueryClient();

	const [dateInput, setDateInput] = createSignal(new Date().toISOString().split('T')[0]);
	const [wordInput, setWordInput] = createSignal('');
	const [rewardInput, setRewardInput] = createSignal('500000');
	const [showSecrets, setShowSecrets] = createSignal<Record<string, boolean>>({});
	const [comboToDelete, setComboToDelete] = createSignal<AdminDailyCombo | null>(null);

	const combosQuery = createQuery(() => ({
		queryKey: ['owner', 'combos'],
		queryFn: ownerApi.listCombos,
	}));

	const upsertMutation = createMutation(() => ({
		mutationFn: ({ date, word, reward }: { date: string; word: string; reward: number }) =>
			ownerApi.upsertCombo(date, word, reward),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'combos'] });
			setWordInput('');
		},
	}));

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		const reward = parseInt(rewardInput(), 10);
		if (!dateInput() || !wordInput().trim() || Number.isNaN(reward)) return;
		upsertMutation.mutate({
			date: dateInput(),
			word: wordInput().trim().toUpperCase(),
			reward,
		});
	};

	const toggleSecret = (key: string) => {
		setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const combos = () => combosQuery.data || [];

	return (
		<div class="space-y-6">
			{/* Header */}
			<div>
				<h2 class="text-lg font-bold text-white">Daily Secret Combos</h2>
				<p class="text-xs text-white/50">Manage daily cipher words and coin rewards for the tapping game</p>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Create Form */}
				<div class="lg:col-span-1">
					<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
						<div class="flex items-center gap-2">
							<span class="material-symbols-rounded text-amber-400">key</span>
							<h3 class="text-sm font-bold text-white">Set Daily Combo</h3>
						</div>

						<form onSubmit={handleSubmit} class="space-y-3">
							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">Active Date</label>
								<input
									type="date"
									value={dateInput()}
									onInput={(e) => setDateInput(e.currentTarget.value)}
									class="w-full h-11 bg-white/5 border border-white/15 rounded-xl px-3 text-xs text-white outline-none focus:border-amber-400"
								/>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									Secret Word (Uppercase)
								</label>
								<input
									type="text"
									placeholder="e.g., SATOSHI"
									value={wordInput()}
									onInput={(e) => setWordInput(e.currentTarget.value)}
									class="w-full h-11 bg-white/5 border border-white/15 rounded-xl px-4 text-xs font-mono uppercase text-white outline-none focus:border-amber-400"
									required
								/>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									Reward Amount (Coins)
								</label>
								<input
									type="number"
									value={rewardInput()}
									onInput={(e) => setRewardInput(e.currentTarget.value)}
									class="w-full h-11 bg-white/5 border border-white/15 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-amber-400"
									required
								/>
							</div>

							<button
								type="submit"
								disabled={upsertMutation.isPending || !wordInput().trim()}
								class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-xs font-bold uppercase text-black rounded-xl transition-all disabled:opacity-40 shadow-lg shadow-amber-500/20"
							>
								{upsertMutation.isPending ? 'Saving...' : 'Save Daily Combo'}
							</button>
						</form>
					</div>
				</div>

				{/* Combos Table */}
				<div class="lg:col-span-2">
					<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="material-symbols-rounded text-amber-400">history</span>
								<h3 class="text-sm font-bold text-white">Combo History</h3>
							</div>
						</div>

						<div class="overflow-x-auto">
							<table class="w-full text-left text-xs">
								<thead>
									<tr class="border-b border-white/10 text-white/40">
										<th class="pb-3">Active Date</th>
										<th class="pb-3">Secret Word (Masked)</th>
										<th class="pb-3">Reward</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-white/5">
									<Show
										when={!combosQuery.isLoading && combos().length > 0}
										fallback={
											<tr>
												<td colspan="3" class="py-8 text-center text-white/40">
													{combosQuery.isLoading ? 'Loading combos...' : 'No combos recorded'}
												</td>
											</tr>
										}
									>
										<For each={combos()}>
											{(combo) => {
												const dateStr = combo.date || combo.active_date || '';
												const wordStr = combo.word || combo.secret_word || '';
												const rewardNum = combo.reward || combo.reward_amount || 0;
												const isRevealed = () => showSecrets()[dateStr];

												return (
													<tr class="hover:bg-white/[0.02] transition">
														<td class="py-3 font-mono text-white/80">{dateStr}</td>
														<td class="py-3 font-mono font-bold text-amber-400">
															<div class="flex items-center gap-2">
																<span class="tracking-widest">
																	{isRevealed() ? wordStr : '••••••••'}
																</span>
																<button
																	onClick={() => toggleSecret(dateStr)}
																	class="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition"
																	title={isRevealed() ? 'Hide' : 'Reveal'}
																>
																	<span class="material-symbols-rounded text-sm">
																		{isRevealed() ? 'visibility_off' : 'visibility'}
																	</span>
																</button>
															</div>
														</td>
														<td class="py-3 font-mono text-emerald-400 font-bold">
															{rewardNum.toLocaleString()} Coins
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
		</div>
	);
};
