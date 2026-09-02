import { useNavigate } from '@solidjs/router';
import { createMutation } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { type CraftingEVData, giftsApi } from '@/entities/gifts/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

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
				'خطا در محاسبه ارزش انتظاری کرفتینگ. تمام آیتم‌ها باید متعلق به یک کالکشن باشند.',
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
		<div class="pb-36 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Light */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#FF9500]/20 via-[#0098EA]/10 to-transparent blur-[90px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				{/* Top Bar */}
				<div class="flex items-center justify-between mb-4">
					<button
						type="button"
						onClick={() => navigate('/gifts/intel')}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white/80 transition-all active:scale-95"
					>
						<span class="material-symbols-outlined text-sm rtl:rotate-180">arrow_back</span>
						<span>{t('gifts.backToIntel')}</span>
					</button>

					<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-300">
						<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
						<span>{t('gifts.tenKMonteCarlo')}</span>
					</div>
				</div>

				<div class="text-center mb-5">
					<div class="w-14 h-14 rounded-3xl bg-gradient-to-tr from-[#FF9500] to-[#FF3B30] p-[1px] mx-auto mb-2.5 shadow-lg shadow-[#FF9500]/20 flex items-center justify-center">
						<div class="w-full h-full bg-[#0d111a] rounded-3xl flex items-center justify-center">
							<span class="material-symbols-outlined text-3xl text-[#FF9500]">
								local_fire_department
							</span>
						</div>
					</div>
					<h1 class="text-xl font-black text-white">{t('gifts.crafting')}</h1>
					<p class="text-xs text-white/50 font-medium mt-1">
						{t('gifts.combineGiftsDesc')}
					</p>
				</div>

				<Show when={errorMsg()}>
					<div class="bg-red-500/10 border border-red-500/30 rounded-2xl p-3.5 mb-4 flex items-center gap-2.5 text-xs text-red-400">
						<span class="material-symbols-outlined text-base shrink-0">error</span>
						<span>{errorMsg()}</span>
					</div>
				</Show>

				{/* Input Slots Workbench */}
				<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl mb-4">
					<div class="flex items-center justify-between mb-3">
						<h3 class="text-sm font-black text-white">Input Gifts ({slots().length}/4)</h3>
						<Show when={slots().length < 4}>
							<button
								type="button"
								onClick={addSlot}
								class="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-bold text-[#0098EA] flex items-center gap-1 transition-all active:scale-95"
							>
								<span class="material-symbols-outlined text-sm">add</span>
								<span>{t('gifts.addInput')}</span>
							</button>
						</Show>
					</div>

					<div class="space-y-2.5">
						<For each={slots()}>
							{(slot, idx) => (
								<div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 flex items-center justify-between">
									<div class="flex items-center gap-2.5">
										<span class="w-6 h-6 rounded-lg bg-white/10 text-[11px] font-black flex items-center justify-center text-white/60">
											{idx() + 1}
										</span>
										<div>
											<h4 class="text-xs font-black text-white">{slot.name}</h4>
											<span class="text-[10px] text-white/40 font-mono">
												Value: {slot.valueGram} TON · {(slot.craftChancePermille / 10).toFixed(1)}%
												weight
											</span>
										</div>
									</div>

									<Show when={slots().length > 1}>
										<button
											type="button"
											onClick={() => removeSlot(idx())}
											class="w-7 h-7 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition-colors"
											title="Remove"
										>
											<span class="material-symbols-outlined text-sm">delete</span>
										</button>
									</Show>
								</div>
							)}
						</For>
					</div>

					<button
						type="button"
						onClick={calculateEV}
						disabled={evMutation.isPending}
						class="w-full mt-4 h-13 rounded-2xl bg-gradient-to-r from-[#FF9500] via-[#FF5E3A] to-[#FF2A6D] text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF9500]/25 active:scale-[0.98] transition-all hover:brightness-110"
					>
						<span class="material-symbols-outlined text-lg">science</span>
						<span>{evMutation.isPending ? 'Simulating 10,000 runs...' : 'Simulate Crafting EV'}</span>
					</button>
				</div>

				{/* EV Simulation Results */}
				<Show when={calculationResult()}>
					{(res) => (
						<div class="space-y-4">
							<div class="bg-[#12141C]/80 border border-amber-500/30 rounded-[28px] p-5 shadow-2xl">
								<div class="flex items-center justify-between mb-3">
									<span
										class={`px-3 py-1 rounded-full text-xs font-black uppercase ${
											res().recommendation === 'YES'
												? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
												: res().recommendation === 'RISKY'
													? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
													: 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
										}`}
									>
										{res().recommendation} {t('gifts.recommendation')}
									</span>
									<span class="text-xs font-black text-white/50">
										{res().simulated_iterations.toLocaleString()} Runs
									</span>
								</div>

								<h3 class="text-base font-black text-white mb-1">
									{isRtl() ? res().verdict_summary_fa || res().verdict_summary_en : res().verdict_summary_en}
								</h3>

								<div class="grid grid-cols-2 gap-2 text-xs my-4">
									<div class="bg-white/[0.03] p-3 rounded-2xl border border-white/[0.05]">
										<span class="text-[10px] uppercase font-bold text-white/40 block">
											{t('gifts.expectedOutput')}
										</span>
										<span class="text-base font-black text-white font-mono">
											{res().expected_output_gram} {t('common.ton')}
										</span>
										<span class="text-[10px] text-white/40 block">(${res().expected_output_usd})</span>
									</div>
									<div class="bg-white/[0.03] p-3 rounded-2xl border border-white/[0.05]">
										<span class="text-[10px] uppercase font-bold text-white/40 block">
											{t('gifts.netExpectedRoi')}
										</span>
										<span
											class={`text-base font-black font-mono ${
												res().roi_percent > 0 ? 'text-emerald-400' : 'text-rose-400'
											}`}
										>
											{res().roi_percent > 0 ? `+${res().roi_percent}%` : `${res().roi_percent}%`}
										</span>
										<span class="text-[10px] text-white/40 block font-mono">
											{res().net_ev_gram} {t('common.ton')} Net
										</span>
									</div>
								</div>

								{/* Warning */}
								<div class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-medium">
									⚠️ {res().burn_warning_notice}
								</div>
							</div>
						</div>
					)}
				</Show>
			</div>
		</div>
	);
};
