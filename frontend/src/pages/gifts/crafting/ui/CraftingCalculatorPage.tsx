import { useNavigate } from '@solidjs/router';
import { createMutation } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { type CraftingEVData, giftsApi } from '@/entities/gifts/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { FragKV, TonAmount, TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';

interface CraftSlot {
	id: string;
	name: string;
	modelId: string;
	serial: number;
	valueGram: number;
	craftChancePermille: number;
}

export const CraftingCalculatorPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [slots, setSlots] = createSignal<CraftSlot[]>([
		{
			id: '1',
			name: 'Plush Pepe #42',
			modelId: 'plush_pepe',
			serial: 42,
			valueGram: 320,
			craftChancePermille: 250,
		},
		{
			id: '2',
			name: 'Plush Pepe #188',
			modelId: 'plush_pepe',
			serial: 188,
			valueGram: 180,
			craftChancePermille: 450,
		},
	]);

	const [calculationResult, setCalculationResult] = createSignal<CraftingEVData | null>(null);
	const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

	const evMutation = createMutation(() => ({
		mutationFn: () =>
			giftsApi.calculateCraftingEV(
				slots().map((s) => ({
					gift_id: `${s.modelId}-${s.serial}`,
					model_id: s.modelId,
					name: s.name,
					serial_number: s.serial,
					estimated_value_gram: s.valueGram,
					craft_chance_permille: s.craftChancePermille,
				})),
			),
		onSuccess: (data) => {
			try {
				haptic.notify('success');
			} catch {}
			setErrorMsg(null);
			setCalculationResult(data);
		},
		onError: (err: any) => {
			try {
				haptic.notify('error');
			} catch {}
			setErrorMsg(
				err?.response?.data?.error ||
					err?.response?.data?.message ||
					err?.message ||
					t('common.error') ||
					'Error calculating crafting EV.',
			);
		},
	}));

	const addSlot = () => {
		if (slots().length >= 4) return;
		try {
			haptic.impact('light');
		} catch {}
		const nextIdx = slots().length + 1;
		const serials = [42, 188, 550, 1200];
		const values = [320, 180, 110, 75];
		const sNum = serials[nextIdx - 1] || nextIdx * 300;
		const val = values[nextIdx - 1] || 65;
		setSlots([
			...slots(),
			{
				id: String(nextIdx),
				name: `Plush Pepe #${sNum}`,
				modelId: 'plush_pepe',
				serial: sNum,
				valueGram: val,
				craftChancePermille: nextIdx === 3 ? 650 : 850,
			},
		]);
	};

	const removeSlot = (index: number) => {
		if (slots().length <= 1) return;
		try {
			haptic.impact('light');
		} catch {}
		setSlots(slots().filter((_, i) => i !== index));
	};

	return (
		<div
			class="frag-canvas pb-32 text-white min-h-screen font-frag-sans relative overflow-x-clip"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => navigate('/gifts')}
					class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
				>
					<TonIcon size={20} color="#4db2ff" />
					<span class="text-[15px] font-bold tracking-[0.04em]" dir="ltr">
						FRAGMENT
					</span>
				</button>
				<span class="px-2.5 py-1 rounded-[4px] bg-[#ff9953]/10 text-[#ff9953] text-[11.5px] font-semibold">
					{t('gifts.craftingBadge')}
				</span>
			</header>

			<div class="max-w-[480px] mx-auto px-4 pt-5 relative z-10 space-y-4">
				<div>
					<h1 class="text-[20px] font-bold text-white tracking-[-0.015em]">
						{t('gifts.craftingTitle')}
					</h1>
					<p class="text-[12.5px] text-[#8794a1] mt-0.5 leading-snug">
						{t('gifts.craftingSubtitle')}
					</p>
				</div>

				{/* Input Slots Table */}
				<div class="frag-table-container">
					<div class="frag-table-header px-3.5 py-2 flex items-center justify-between">
						<span>
							{t('gifts.burnInputTitle')} ({slots().length}/4)
						</span>
						<Show when={slots().length < 4}>
							<button
								type="button"
								onClick={addSlot}
								class="text-[12px] font-semibold text-[#4db2ff] hover:underline flex items-center gap-0.5 cursor-pointer"
							>
								<span class="material-symbols-outlined text-[14px]">add</span>
								<span>{t('gifts.addSlot')}</span>
							</button>
						</Show>
					</div>

					<For each={slots()}>
						{(slot, idx) => (
							<div class="frag-table-row px-3.5 py-2.5 flex items-center justify-between gap-2.5">
								<div class="flex items-center gap-2.5 min-w-0">
									<span class="w-6 text-[12px] font-mono text-[#8c9aa9] shrink-0">
										#{idx() + 1}
									</span>
									<div class="min-w-0">
										<input
											type="text"
											value={slot.name}
											onInput={(e) => {
												const updated = [...slots()];
												updated[idx()].name = e.currentTarget.value;
												setSlots(updated);
											}}
											class="bg-transparent text-[13px] font-semibold text-white outline-none border-b border-transparent focus:border-[#4db2ff] w-36 truncate"
										/>
										<div class="flex items-center gap-2 text-[11.5px] text-[#8c9aa9] font-mono tabular-nums mt-0.5">
											<span dir="ltr" class="inline-flex items-center gap-1">
												<TonIcon size={12} />
												{slot.valueGram} TON
											</span>
											<span>·</span>
											<span class="text-[#ff9953]">{slot.craftChancePermille / 10}%</span>
										</div>
									</div>
								</div>

								<Show when={slots().length > 1}>
									<button
										type="button"
										onClick={() => removeSlot(idx())}
										class="w-7 h-7 rounded-[6px] text-[#8c9aa9] hover:text-[#ff5863] hover:bg-[#293440] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
									>
										<span class="material-symbols-outlined text-[16px]">close</span>
									</button>
								</Show>
							</div>
						)}
					</For>
				</div>

				<Show when={errorMsg()}>
					<div class="p-3 rounded-[8px] bg-[#ff5863]/10 text-[12.5px] text-[#ff5863] flex items-center gap-2">
						<span class="material-symbols-outlined text-[16px]">error</span>
						<span>{errorMsg()}</span>
					</div>
				</Show>

				<button
					type="button"
					onClick={() => evMutation.mutate()}
					disabled={evMutation.isPending}
					class="frag-btn-primary w-full h-11 rounded-[8px] text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
				>
					<span>
						{evMutation.isPending ? t('gifts.calculatingEv') : t('gifts.calculateEvButton')}
					</span>
				</button>

				{/* EV Results Card */}
				<Show when={calculationResult()}>
					{(res) => (
						<div class="frag-table-container">
							<div class="frag-table-header px-3.5 py-2 flex items-center justify-between">
								<span>{t('gifts.evAnalysisTitle')}</span>
								<span
									class={`px-2 py-0.5 rounded-[4px] text-[11px] font-semibold ${
										res().net_ev_gram >= 0
											? 'bg-[#5aec8c]/10 text-[#5aec8c]'
											: 'bg-[#ff5863]/10 text-[#ff5863]'
									}`}
								>
									{res().recommendation}
								</span>
							</div>
							<FragKV label={t('gifts.burnCost')}>
								<TonAmount value={res().total_inputs_cost_gram.toFixed(1)} size="sm" />
							</FragKV>
							<FragKV label={t('gifts.expectedReturn')}>
								<TonAmount value={res().expected_output_gram.toFixed(1)} size="sm" />
							</FragKV>
							<FragKV label={t('gifts.netEv')}>
								<TonAmount
									value={`${res().net_ev_gram >= 0 ? '+' : ''}${res().net_ev_gram.toFixed(1)}`}
									size="sm"
									tone={res().net_ev_gram >= 0 ? 'positive' : 'warning'}
								/>
							</FragKV>
							<FragKV label={t('gifts.winProbability')}>
								<span class="font-mono text-[#5aec8c]">
									{res().success_probability_pct.toFixed(1)}%
								</span>
							</FragKV>
						</div>
					)}
				</Show>
			</div>
		</div>
	);
};
