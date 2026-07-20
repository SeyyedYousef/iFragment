import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { Component, createSignal, For, Show } from 'solid-js';
import { ownerApi, AdminDailyCombo } from '@/shared/api/owner.js';
import { hapticFeedback } from '@tma.js/sdk-solid';

export const OwnerCombos: Component = () => {
	const queryClient = useQueryClient();

	const [dateInput, setDateInput] = createSignal(new Date().toISOString().split('T')[0]);
	const [wordInput, setWordInput] = createSignal('');
	const [rewardInput, setRewardInput] = createSignal('500000');
	const [showSecrets, setShowSecrets] = createSignal<Record<number, boolean>>({});
	const [statusMsg, setStatusMsg] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);

	const combosQuery = createQuery(() => ({
		queryKey: ['admin-combos'],
		queryFn: () => ownerApi.listCombos(),
	}));

	const createMutationHook = createMutation(() => ({
		mutationFn: (data: { date: string; word: string; reward: number }) =>
			ownerApi.createCombo(data.date, data.word, data.reward),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin-combos'] });
			setWordInput('');
			setStatusMsg({ type: 'success', text: 'کامبو روزانه با موفقیت ثبت شد.' });
			try {
				hapticFeedback.notificationOccurred('success');
			} catch {}
			setTimeout(() => setStatusMsg(null), 3000);
		},
		onError: (err: any) => {
			setStatusMsg({ type: 'error', text: err.response?.data?.error || 'خطا در ثبت کامبو روزانه.' });
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		},
	}));

	const deleteMutationHook = createMutation(() => ({
		mutationFn: (id: number) => ownerApi.deleteCombo(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin-combos'] });
			setStatusMsg({ type: 'success', text: 'کامبو روزانه حذف شد.' });
			try {
				hapticFeedback.notificationOccurred('success');
			} catch {}
			setTimeout(() => setStatusMsg(null), 3000);
		},
		onError: (err: any) => {
			setStatusMsg({ type: 'error', text: err.response?.data?.error || 'خطا در حذف کامبو.' });
		},
	}));

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		const reward = parseInt(rewardInput(), 10);
		if (!dateInput() || !wordInput().trim() || isNaN(reward)) return;
		createMutationHook.mutate({
			date: dateInput(),
			word: wordInput().trim().toUpperCase(),
			reward,
		});
	};

	const toggleSecret = (id: number) => {
		setShowSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="bg-[#16171d]/60 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
				<div>
					<h2 class="text-sm font-black text-white">مدیریت کامبو و کلمات رمز روزانه</h2>
					<p class="text-xs text-white/40 font-bold mt-0.5">تعیین رمز عبور مخفی روزانه و مقدار سکه پاداش برای کاربران</p>
				</div>
			</div>

			<Show when={statusMsg()}>
				<div
					class={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
						statusMsg()?.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
					}`}
				>
					<span class="material-symbols-outlined text-base">
						{statusMsg()?.type === 'success' ? 'check_circle' : 'error'}
					</span>
					<span>{statusMsg()?.text}</span>
				</div>
			</Show>

			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Create Form */}
				<div class="lg:col-span-1">
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 space-y-4">
						<h3 class="text-xs font-black uppercase text-white tracking-wider">ثبت کامبو جدید</h3>
						<form onSubmit={handleSubmit} class="space-y-3">
							<div>
								<label class="block text-[10px] font-bold text-white/50 mb-1">تاریخ فعالسازی</label>
								<input
									type="date"
									value={dateInput()}
									onInput={(e) => setDateInput(e.currentTarget.value)}
									class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-3 text-xs text-white outline-none focus:border-[#3390ec]"
								/>
							</div>

							<div>
								<label class="block text-[10px] font-bold text-white/50 mb-1">کلمه رمز (Secret Word)</label>
								<input
									type="text"
									placeholder="مثلاً SATOSHI_2026"
									value={wordInput()}
									onInput={(e) => setWordInput(e.currentTarget.value)}
									class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono uppercase text-white outline-none focus:border-[#3390ec]"
									required
								/>
							</div>

							<div>
								<label class="block text-[10px] font-bold text-white/50 mb-1">مقدار سکه پاداش (FRG)</label>
								<input
									type="number"
									value={rewardInput()}
									onInput={(e) => setRewardInput(e.currentTarget.value)}
									class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#3390ec]"
									required
								/>
							</div>

							<button
								type="submit"
								disabled={createMutationHook.isPending || !wordInput().trim()}
								class="w-full h-11 bg-[#3390ec] hover:bg-[#2b7ec9] text-xs font-black uppercase text-white rounded-xl transition-all active:scale-95 disabled:opacity-40"
							>
								{createMutationHook.isPending ? 'در حال ثبت...' : 'ذخیره کامبو روزانه'}
							</button>
						</form>
					</div>
				</div>

				{/* Combos Table */}
				<div class="lg:col-span-2">
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 space-y-4">
						<h3 class="text-xs font-black uppercase text-white tracking-wider">تاریخچه کامبوهای اخیر</h3>

						<div class="overflow-x-auto">
							<table class="w-full text-end text-xs">
								<thead>
									<tr class="border-b border-white/10 text-white/40 text-[10px] font-bold">
										<th class="pb-3 text-start">تاریخ</th>
										<th class="pb-3 text-start">کلمه محرمانه</th>
										<th class="pb-3 text-start">پاداش (FRG)</th>
										<th class="pb-3 text-end">عملیات</th>
									</tr>
								</thead>
								<tbody>
									<Show
										when={!combosQuery.isLoading}
										fallback={
											<tr>
												<td colSpan={4} class="py-8 text-center text-white/40 font-bold">
													در حال دریافت اطلاعات...
												</td>
											</tr>
										}
									>
										<For each={combosQuery.data}>
											{(combo: AdminDailyCombo) => (
												<tr class="border-b border-white/5 hover:bg-white/5 transition-all">
													<td class="py-3 text-start font-mono text-white/80">
														{new Date(combo.active_date).toLocaleDateString('fa-IR')}
													</td>
													<td class="py-3 text-start font-mono font-bold text-amber-400">
														<div class="flex items-center gap-2">
															<span>{showSecrets()[combo.id] ? combo.secret_word : '••••••••'}</span>
															<button
																onClick={() => toggleSecret(combo.id)}
																class="text-white/40 hover:text-white text-[12px]"
															>
																<span class="material-symbols-outlined text-[14px]">
																	{showSecrets()[combo.id] ? 'visibility_off' : 'visibility'}
																</span>
															</button>
														</div>
													</td>
													<td class="py-3 text-start font-mono text-emerald-400 font-bold">
														{combo.reward_amount.toLocaleString()} FRG
													</td>
													<td class="py-3 text-end">
														<button
															onClick={() => deleteMutationHook.mutate(combo.id)}
															disabled={deleteMutationHook.isPending}
															class="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[12px] transition-all"
															title="حذف کامبو"
														>
															<span class="material-symbols-outlined text-[14px]">delete</span>
														</button>
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
	);
};
