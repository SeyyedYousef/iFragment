import { useNavigate } from '@solidjs/router';
import { createMutation } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { type CraftingEVData, giftsApi } from '@/entities/gifts/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';

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

	// 1 to 4 Input Slots (Strict Telegram Crafting Rule: same collection)
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
					'Error calculating crafting EV. All items must belong to the same collection.',
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

	const calculateEV = () => {
		try {
			haptic.impact('medium');
		} catch {}
		evMutation.mutate();
	};

	return (
		<div
			class="frag-canvas pb-36 text-[#f3f5f8] min-h-screen font-sans relative overflow-x-clip"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			<div class="max-w-lg mx-auto px-4 pt-3.5 relative z-10">
				{/* Navigation Header */}
				<div class="flex items-center justify-between gap-2 mb-4">
					<button
						type="button"
						onClick={() => navigate('/gifts')}
						class="w-10 h-10 rounded-xl bg-[#1b232d] border border-white/[0.08] flex items-center justify-center text-[#c2cfde] hover:text-white active:scale-95 transition-all"
					>
						<span class="material-symbols-outlined text-[20px]">
							{isRtl() ? 'arrow_forward' : 'arrow_back'}
						</span>
					</button>
					<span class="px-3 py-1 rounded-full bg-[#1b232d] border border-[#ffb340]/25 text-[#ffb340] text-[11px] font-semibold inline-flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[14px]">whatshot</span>
						{t('gifts.craftingBadge')}
					</span>
				</div>

				{/* Header Title Card */}
				<div class="frag-card-elevated rounded-2xl p-4 mb-4 flex items-center gap-3.5">
					<div class="w-12 h-12 rounded-2xl bg-[#141a22] border border-[#ffb340]/25 flex items-center justify-center shrink-0">
						<span class="material-symbols-outlined text-[24px] text-[#ffb340]">
							local_fire_department
						</span>
					</div>
					<div class="min-w-0">
						<h1 class="text-lg font-bold tracking-tight text-white">{t('gifts.craftingTitle')}</h1>
						<p class="text-[12px] text-[#8ca0b5] mt-0.5 leading-snug">
							{t('gifts.craftingSubtitle')}
						</p>
					</div>
				</div>

				{/* Workbench Input Slots Card */}
				<div class="frag-card-elevated rounded-2xl p-4 mb-4">
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-xs font-semibold text-[#c2cfde]">
							{t('gifts.burnInputTitle')} ({slots().length}/4)
						</h2>
						<Show when={slots().length < 4}>
							<button
								type="button"
								onClick={addSlot}
								class="frag-btn-secondary px-2.5 py-1.5 rounded-lg text-[#5aaeff] text-[11px] font-semibold flex items-center gap-1"
							>
								<span class="material-symbols-outlined text-[14px]">add</span>
								{t('gifts.addSlot')}
							</button>
						</Show>
					</div>

					<div class="space-y-2.5">
						<For each={slots()}>
							{(slot, idx) => (
								<div class="frag-inset rounded-xl p-3 flex items-center justify-between gap-2.5">
									<div class="flex items-center gap-2.5 min-w-0">
										<div class="w-9 h-9 rounded-lg bg-[#1b232d] border border-white/[0.08] flex items-center justify-center font-mono text-xs font-semibold text-[#5aaeff] shrink-0">
											#{idx() + 1}
										</div>
										<div class="min-w-0">
											<input
												type="text"
												value={slot.name}
												onInput={(e) => {
													const updated = [...slots()];
													updated[idx()].name = e.currentTarget.value;
													setSlots(updated);
												}}
												class="bg-transparent text-xs font-semibold text-white outline-none border-b border-transparent focus:border-[#2990ff] w-36 truncate"
											/>
											<div class="flex items-center gap-2 text-[11px] text-[#8ca0b5] font-mono tabular-nums mt-0.5">
												<span dir="ltr" class="inline-flex items-center gap-1">
													<TonIcon class="w-3 h-3" />
													{slot.valueGram} {t('common.ton')}
												</span>
												<span>·</span>
												<span class="text-[#ffb340]">{slot.craftChancePermille / 10}%</span>
											</div>
										</div>
									</div>

									<Show when={slots().length > 1}>
										<button
											type="button"
											onClick={() => removeSlot(idx())}
											class="w-7 h-7 rounded-lg bg-[#ff5c6c]/10 border border-[#ff5c6c]/20 text-[#ff5c6c] hover:bg-[#ff5c6c]/20 flex items-center justify-center transition-colors shrink-0"
										>
											<span class="material-symbols-outlined text-[15px]">close</span>
										</button>
									</Show>
								</div>
							)}
						</For>
					</div>

					{/* Error Toast */}
					<Show when={errorMsg()}>
						<div class="mt-3 p-3 rounded-xl bg-[#ff5c6c]/10 border border-[#ff5c6c]/25 text-xs text-[#ff8793] flex items-center gap-2">
							<span class="material-symbols-outlined text-[16px] text-[#ff5c6c]">error</span>
							<span>{errorMsg()}</span>
						</div>
					</Show>

					{/* Run Monte Carlo Simulation Button */}
					<button
						type="button"
						onClick={calculateEV}
						disabled={evMutation.isPending}
						class="frag-btn-primary w-full mt-4 h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
					>
						<Show
							when={evMutation.isPending}
							fallback={
								<>
									<span class="material-symbols-outlined text-[19px]">calculate</span>
									{t('gifts.simulateEvButton')}
								</>
							}
						>
							<span class="material-symbols-outlined text-[19px] animate-spin">sync</span>
							{t('gifts.simulatingMonteCarlo')}
						</Show>
					</button>
				</div>

				{/* EV Simulation Results */}
				<Show when={calculationResult()}>
					{(res) => (
						<div class="space-y-4">
							<div class="frag-card-elevated rounded-2xl p-4 border-[#ffb340]/25">
								<div class="flex items-center justify-between mb-3">
									<span
										class={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
											res().recommendation === 'YES'
												? 'bg-[#4cd964]/12 text-[#4cd964] border-[#4cd964]/30'
												: res().recommendation === 'RISKY'
													? 'bg-[#ffb340]/12 text-[#ffb340] border-[#ffb340]/30'
													: 'bg-[#ff5c6c]/12 text-[#ff5c6c] border-[#ff5c6c]/30'
										}`}
									>
										{res().recommendation} · {t('gifts.recommendation')}
									</span>
									<span class="text-[11px] font-mono text-[#8ca0b5] tabular-nums">
										{res().simulated_iterations.toLocaleString()} runs
									</span>
								</div>

								<h3 class="text-base font-bold text-white mb-1">
									{isRtl()
										? res().verdict_summary_fa || res().verdict_summary_en
										: res().verdict_summary_en}
								</h3>

								<div class="grid grid-cols-2 gap-2.5 text-xs my-3.5">
									<div class="frag-inset p-3 rounded-xl">
										<span class="text-[10px] font-medium text-[#8ca0b5] block mb-1">
											{t('gifts.expectedOutput')}
										</span>
										<span
											dir="ltr"
											class="text-base font-bold text-white font-mono tabular-nums inline-flex items-center gap-1"
										>
											<TonIcon class="w-3.5 h-3.5" />
											{res().expected_output_gram} {t('common.ton')}
										</span>
										<span class="text-[11px] text-[#738598] font-mono block mt-0.5 tabular-nums">
											(${res().expected_output_usd})
										</span>
									</div>
									<div class="frag-inset p-3 rounded-xl">
										<span class="text-[10px] font-medium text-[#8ca0b5] block mb-1">
											{t('gifts.netExpectedRoi')}
										</span>
										<span
											dir="ltr"
											class={`text-base font-bold font-mono tabular-nums block ${
												res().roi_percent > 0 ? 'text-[#4cd964]' : 'text-[#ff5c6c]'
											}`}
										>
											{res().roi_percent > 0 ? `+${res().roi_percent}%` : `${res().roi_percent}%`}
										</span>
										<span class="text-[11px] text-[#738598] font-mono block mt-0.5 tabular-nums">
											{res().net_ev_gram} {t('common.ton')} net
										</span>
									</div>
								</div>

								{/* Burn Warning */}
								<div class="p-3 rounded-xl bg-[#ff5c6c]/10 border border-[#ff5c6c]/25 text-xs text-[#ff9aa4] flex items-start gap-2">
									<span class="material-symbols-outlined text-[16px] text-[#ff5c6c] shrink-0 mt-0.5">
										warning
									</span>
									<span>{res().burn_warning_notice}</span>
								</div>
							</div>
						</div>
					)}
				</Show>
			</div>
		</div>
	);
};
