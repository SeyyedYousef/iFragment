import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { Component, createSignal, For, Show } from 'solid-js';
import { ownerApi } from '@/shared/api/owner.js';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';

export const OwnerCombos: Component = () => {
	const queryClient = useQueryClient();

	const [dateInput, setDateInput] = createSignal(new Date().toISOString().split('T')[0]);
	const [wordInput, setWordInput] = createSignal('');
	const [rewardInput, setRewardInput] = createSignal('500000');

	const combosQuery = createQuery(() => ({
		queryKey: ['admin-combos'],
		queryFn: () => ownerApi.listCombos(),
	}));

	const createMutation = createMutation(() => ({
		mutationFn: (data: { date: string; word: string; reward: number }) =>
			ownerApi.createCombo(data.date, data.word, data.reward),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin-combos'] });
			setWordInput('');
		},
	}));

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		const reward = parseInt(rewardInput(), 10);
		if (!dateInput() || !wordInput().trim() || isNaN(reward)) return;
		createMutation.mutate({
			date: dateInput(),
			word: wordInput().trim(),
			reward,
		});
	};

	return (
		<div class="flex flex-col min-h-screen bg-[#0f1016]" dir="rtl">
			<OwnerTabs active="combos" />
			<div class="p-6">
				<div class="flex items-center justify-between mb-8">
				<div>
					<h1 class="text-2xl font-bold text-white mb-1">Daily Combos</h1>
					<p class="text-slate-400">Manage daily secret words and rewards</p>
				</div>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div class="lg:col-span-1">
					<div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
						<h2 class="text-lg font-bold text-white mb-4">Set Combo</h2>
						<form onSubmit={handleSubmit} class="flex flex-col gap-4">
							<div>
								<label class="block text-sm font-medium text-slate-400 mb-1">Date</label>
								<input
									type="date"
									value={dateInput()}
									onInput={(e) => setDateInput(e.target.value)}
									class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition-colors"
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-slate-400 mb-1">Secret Word</label>
								<input
									type="text"
									placeholder="e.g. Satoshi"
									value={wordInput()}
									onInput={(e) => setWordInput(e.target.value)}
									class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition-colors"
								/>
							</div>
							<div>
								<label class="block text-sm font-medium text-slate-400 mb-1">Reward (FRG)</label>
								<input
									type="number"
									value={rewardInput()}
									onInput={(e) => setRewardInput(e.target.value)}
									class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500 transition-colors"
								/>
							</div>
							<button
								type="submit"
								disabled={createMutation.isPending || !wordInput().trim()}
								class="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors mt-2"
							>
								{createMutation.isPending ? 'Saving...' : 'Save Combo'}
							</button>
						</form>
					</div>
				</div>

				<div class="lg:col-span-2">
					<div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
						<h2 class="text-lg font-bold text-white mb-4">Recent Combos</h2>
						<div class="overflow-x-auto">
							<table class="w-full text-left">
								<thead>
									<tr class="border-b border-slate-700 text-sm text-slate-400">
										<th class="pb-3 pr-4 font-medium">Date</th>
										<th class="pb-3 pr-4 font-medium">Word</th>
										<th class="pb-3 pr-4 font-medium">Reward</th>
									</tr>
								</thead>
								<tbody class="text-sm">
									<Show
										when={!combosQuery.isLoading}
										fallback={
											<tr>
												<td colspan="3" class="py-4 text-center text-slate-400">Loading...</td>
											</tr>
										}
									>
										<For each={combosQuery.data}>
											{(combo) => (
												<tr class="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/30 transition-colors">
													<td class="py-3 pr-4 text-white">
														{new Date(combo.active_date).toLocaleDateString()}
													</td>
													<td class="py-3 pr-4 text-emerald-400 font-mono">
														{combo.secret_word}
													</td>
													<td class="py-3 pr-4 text-blue-400">
														{combo.reward_amount.toLocaleString()}
													</td>
												</tr>
											)}
										</For>
									</Show>
								</tbody>
							</table>
					</div>
				</div>
			</div>
		</div>
		</div>
		</div>
	);
};
