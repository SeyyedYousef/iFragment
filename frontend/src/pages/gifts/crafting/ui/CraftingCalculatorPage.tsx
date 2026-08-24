import { createMutation } from '@tanstack/solid-query';
import { useNavigate } from '@solidjs/router';
import { Component, createSignal, For, Show } from 'solid-js';
import { giftsApi, type CraftingEVData } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
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

	// 1 to 4 Input Slots
	const [slots, setSlots] = createSignal<CraftSlot[]>([
		{ id: '1', name: 'Plush Pepe #42', modelId: 'plush_pepe', serial: 42, valueGram: 320, craftChancePermille: 350 },
		{ id: '2', name: 'Cyber Heart #188', modelId: 'cyber_heart', serial: 188, valueGram: 85, craftChancePermille: 250 },
	]);

	const [calculationResult, setCalculationResult] = createSignal<CraftingEVData | null>(null);

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
				}))
			),
		onSuccess: (data) => {
			try { haptic.notify('success'); } catch {}
			setCalculationResult(data);
		},
		onError: () => {
			try { haptic.notify('error'); } catch {}
		},
	}));

	const addSlot = () => {
		if (slots().length >= 4) return;
		try { haptic.impact('light'); } catch {}
		const nextIdx = slots().length + 1;
		setSlots([
			...slots(),
			{
				id: String(nextIdx),
				name: `Celestial Star #${nextIdx * 100}`,
				modelId: 'golden_star',
				serial: nextIdx * 100,
				valueGram: 45,
				craftChancePermille: 200,
			},
		]);
	};

	const removeSlot = (index: number) => {
		if (slots().length <= 1) return;
		try { haptic.impact('light'); } catch {}
		setSlots(slots().filter((_, i) => i !== index));
	};

	const calculateEV = () => {
		try { haptic.impact('medium'); } catch {}
		evMutation.mutate();
	};

	return (
		<div class="pb-36 bg-[#090a0f] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Light */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#FF9500]/15 via-[#AF52DE]/10 to-transparent blur-3xl pointer-events-none z-0" />

			<div class="relative z-10 max-w-md mx-auto px-4 pt-4">
				{/* Top Bar */}
				<div class="flex items-center justify-between mb-4">
					<button
						onClick={() => navigate('/gifts/intel')}
						class="flex items-center gap-1 text-xs font-bold text-white/60 hover:text-white transition-colors"
					>
						<span class="material-symbols-outlined text-sm">arrow_back</span>
						<span>{t('gifts.backToIntel' as any) || 'Gifts Intel'}</span>
					</button>

					<div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-300">
						<span>10k Monte Carlo</span>
					</div>
				</div>

				<div class="text-center mb-5">
					<div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF9500] to-[#FF3B30] p-[1px] mx-auto mb-2 shadow-lg shadow-[#FF9500]/20 flex items-center justify-center">
						<div class="w-full h-full bg-[#0d111a] rounded-2xl flex items-center justify-center">
							<span class="material-symbols-outlined text-2xl text-[#FF9500]">local_fire_department</span>
						</div>
					</div>
					<h1 class="text-xl font-black text-white">World's 1st Crafting EV Calculator</h1>
					<p class="text-xs text-white/50 font-medium mt-1">Combine 1 to 4 gifts to forge higher-tier outputs with exact mathematical odds.</p>
				</div>

				{/* Input Slots Workbench */}
				<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl mb-4">
					<div class="flex items-center justify-between mb-3">
						<h3 class="text-sm font-black text-white">Input Gifts ({slots().length}/4)</h3>
						<Show when={slots().length < 4}>
							<button
								onClick={addSlot}
								class="px-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-bold text-[#0098EA] flex items-center gap-1 transition-all"
							>
								<span class="material-symbols-outlined text-sm">add</span>
								<span>Add Input</span>
							</button>
						</Show>
					</div>

					<div class="space-y-2">
						<For each={slots()}>
							{(slot, idx) => (
								<div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 flex items-center justify-between">
									<div>
										<h4 class="text-xs font-black text-white">{slot.name}</h4>
										<span class="text-[10px] text-white/40 block mt-0.5">
											Value: {slot.valueGram} GRAM · Roll Chance: {(slot.craftChancePermille / 10).toFixed(1)}%
										</span>
									</div>
									<Show when={slots().length > 1}>
										<button
											onClick={() => removeSlot(idx())}
											class="w-7 h-7 rounded-full bg-white/[0.04] text-white/40 hover:text-rose-400 flex items-center justify-center"
										>
											<span class="material-symbols-outlined text-sm">close</span>
										</button>
									</Show>
								</div>
							)}
						</For>
					</div>

					<button
						onClick={calculateEV}
						disabled={evMutation.isPending}
						class="w-full mt-4 h-13 rounded-2xl bg-gradient-to-r from-[#FF9500] to-[#FF3B30] text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#FF9500]/30 active:scale-[0.98] transition-all"
					>
						<span class="material-symbols-outlined text-base">functions</span>
						<span>{evMutation.isPending ? 'Simulating 10,000 Runs...' : 'Simulate Crafting EV'}</span>
					</button>
				</div>

				{/* Results Display */}
				<Show when={calculationResult()}>
					{(res) => (
						<div class="space-y-4">
							<div class="bg-[#12141C]/80 border border-amber-500/30 rounded-[28px] p-5 shadow-xl">
								<div class="flex items-center justify-between mb-3">
									<span class="text-xs font-black uppercase tracking-wider text-white/40">Verdict</span>
									<span class={`text-xs uppercase font-black px-2.5 py-0.5 rounded-full ${
										res().recommendation === 'YES' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
										res().recommendation === 'RISKY' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
										'bg-rose-500/20 text-rose-400 border border-rose-500/30'
									}`}>
										{res().recommendation} RECOMMENDATION
									</span>
								</div>

								<div class="text-center py-2">
									<span class="text-3xl font-black text-white">
										{res().net_ev_gram > 0 ? `+${res().net_ev_gram}` : res().net_ev_gram} GRAM
									</span>
									<span class="text-xs font-bold text-white/50 block mt-1">
										Expected Return on Inputs ({res().roi_percent > 0 ? `+${res().roi_percent}%` : `${res().roi_percent}%`})
									</span>
								</div>

								<div class="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
									<div class="bg-white/[0.03] p-2.5 rounded-xl">
										<span class="text-[9px] uppercase font-bold text-white/40 block">P10 (Worst)</span>
										<span class="font-black text-rose-400">{res().distribution_p10_gram} G</span>
									</div>
									<div class="bg-white/[0.03] p-2.5 rounded-xl">
										<span class="text-[9px] uppercase font-bold text-white/40 block">P50 (Median)</span>
										<span class="font-black text-white">{res().distribution_p50_gram} G</span>
									</div>
									<div class="bg-white/[0.03] p-2.5 rounded-xl">
										<span class="text-[9px] uppercase font-bold text-white/40 block">P90 (Best)</span>
										<span class="font-black text-emerald-400">{res().distribution_p90_gram} G</span>
									</div>
								</div>
							</div>

							{/* Formula Breakdown */}
							<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl text-xs space-y-2">
								<h4 class="font-black text-white mb-2">Detailed Formula Breakdown</h4>
								<For each={res().formula_breakdown}>
									{(item) => (
										<div class="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
											<span class="text-white/60">{item.term_name}:</span>
											<span class="font-black text-white">{item.value}</span>
										</div>
									)}
								</For>
							</div>

							{/* Burn Notice */}
							<div class="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 font-medium">
								{res().burn_warning_notice}
							</div>
						</div>
					)}
				</Show>
			</div>
		</div>
	);
};
