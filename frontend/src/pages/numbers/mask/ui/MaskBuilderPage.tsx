import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

export const MaskBuilderPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	// 8 digit slots representing the suffix after +888
	const [slots, setSlots] = createSignal<string[]>(['8', '8', '8', '8', '*', '*', '*', '*']);
	const [filterStatus, setFilterStatus] = createSignal<'all' | 'for_sale' | 'taken'>('all');

	const PRESET_PATTERNS = [
		{ label: 'Quad 8888 Prefix', mask: ['8', '8', '8', '8', '*', '*', '*', '*'] },
		{ label: 'Quad 8888 Tail', mask: ['*', '*', '*', '*', '8', '8', '8', '8'] },
		{ label: 'Triple 777 Tail', mask: ['*', '*', '*', '*', '*', '7', '7', '7'] },
		{ label: 'Sequential 1234', mask: ['1', '2', '3', '4', '*', '*', '*', '*'] },
		{ label: 'Alternating 8989', mask: ['8', '9', '8', '9', '*', '*', '*', '*'] },
	];

	const currentMaskString = createMemo(() => {
		return `+888 ${slots().slice(0, 4).join('')} ${slots().slice(4).join('')}`;
	});

	const rawQueryString = createMemo(() => {
		return `+888${slots().join('')}`;
	});

	const maskQuery = createQuery(() => ({
		queryKey: ['maskSearch', rawQueryString()],
		queryFn: () => numbersApi.searchMask(rawQueryString(), 30),
		staleTime: 30 * 1000,
	}));

	const filteredResults = createMemo(() => {
		const list = maskQuery.data || [];
		if (filterStatus() === 'for_sale') {
			return list.filter((it) => it.status === 'for_sale');
		}
		if (filterStatus() === 'taken') {
			return list.filter((it) => it.status === 'taken');
		}
		return list;
	});

	const handleSlotChange = (index: number, val: string) => {
		try {
			haptic.selection();
		} catch {}
		const next = [...slots()];
		if (!val || val === ' ') {
			next[index] = '*';
		} else {
			const char = val.slice(-1);
			if (char >= '0' && char <= '9') {
				next[index] = char;
			} else {
				next[index] = '*';
			}
		}
		setSlots(next);
	};

	const applyPreset = (presetMask: string[]) => {
		try {
			haptic.impact('medium');
		} catch {}
		setSlots([...presetMask]);
	};

	const formatTon = (val?: number) => {
		if (!val) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	return (
		<div class="pb-36 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Glow */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/20 via-[#AF52DE]/10 to-transparent blur-[90px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				{/* Top Navigation */}
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-2.5">
						<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0098EA] to-[#00c6ff] p-[1px] shadow-lg shadow-[#0098EA]/20 flex items-center justify-center">
							<div class="w-full h-full bg-[#0d111a] rounded-2xl flex items-center justify-center">
								<span class="material-symbols-outlined text-[#0098EA] text-[22px]">tune</span>
							</div>
						</div>
						<div>
							<h1 class="text-[18px] font-black tracking-tight text-white">
								{t('numbers.maskBuilderTitle')}
							</h1>
							<p class="text-[11px] font-medium text-white/50">{t('numbers.maskBuilderSub')}</p>
						</div>
					</div>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.impact('light');
							} catch {}
							navigate('/numbers/intel');
						}}
						class="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white/80 transition-all active:scale-95"
					>
						{t('numbers.intelOverview')}
					</button>
				</div>

				{/* 8-Box Visual Selector */}
				<div class="bg-[#12141C]/80 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 mb-4 shadow-xl">
					<div class="flex items-center justify-between mb-3">
						<span class="text-xs font-bold text-white/60">{t('numbers.patternQuery')}:</span>
						<span class="text-xs font-mono font-black text-[#0098EA]">{currentMaskString()}</span>
					</div>

					<div class="flex items-center gap-1.5 justify-center mb-4" dir="ltr">
						{/* +888 Fixed Badge */}
						<div class="px-2.5 py-3 rounded-2xl bg-[#0098EA]/20 border border-[#0098EA]/40 text-[#0098EA] font-mono font-black text-sm flex items-center justify-center">
							+888
						</div>

						{/* 8 Interactive Slot Inputs */}
						<For each={slots()}>
							{(slot, idx) => (
								<input
									type="text"
									aria-label={`Number slot ${idx() + 1}`}
									maxLength={1}
									value={slot}
									onFocus={(e) => e.currentTarget.select()}
									onInput={(e) => handleSlotChange(idx(), e.currentTarget.value)}
									class={`w-8 h-12 rounded-xl text-center font-mono font-black text-base focus:outline-none transition-all ${
										slot === '*'
											? 'bg-white/[0.04] text-white/40 border border-white/10 focus:border-[#0098EA] focus:bg-black/60'
											: 'bg-[#0098EA]/15 text-white border border-[#0098EA]/50 focus:border-[#0098EA] focus:ring-1 focus:ring-[#0098EA]'
									}`}
								/>
							)}
						</For>
					</div>

					{/* Quick Preset Pattern Chips */}
					<div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
						<For each={PRESET_PATTERNS}>
							{(preset) => (
								<button
									type="button"
									onClick={() => applyPreset(preset.mask)}
									class="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-bold text-white/70 whitespace-nowrap active:scale-95 transition-all"
								>
									{preset.label}
								</button>
							)}
						</For>
					</div>
				</div>

				{/* Filter Chips: All | For Sale | Taken */}
				<div class="flex items-center justify-between mb-3">
					<div class="flex items-center gap-1 bg-[#12141C]/80 p-1 rounded-2xl border border-white/10 text-xs font-bold">
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setFilterStatus('all');
							}}
							class={`px-3 py-1 rounded-xl transition-all ${
								filterStatus() === 'all' ? 'bg-[#0098EA] text-white font-black' : 'text-white/50'
							}`}
						>
							{t('numbers.allResults')}
						</button>
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setFilterStatus('for_sale');
							}}
							class={`px-3 py-1 rounded-xl transition-all ${
								filterStatus() === 'for_sale' ? 'bg-amber-500 text-white font-black' : 'text-white/50'
							}`}
						>
							🟡 {t('numbers.forSale')}
						</button>
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setFilterStatus('taken');
							}}
							class={`px-3 py-1 rounded-xl transition-all ${
								filterStatus() === 'taken' ? 'bg-slate-700 text-white font-black' : 'text-white/50'
							}`}
						>
							🔴 {t('numbers.taken')}
						</button>
					</div>

					<div class="text-[11px] font-mono text-white/40">
						{filteredResults().length} matches (&lt;150ms)
					</div>
				</div>

				{/* Results List */}
				<div class="space-y-2">
					<For each={filteredResults()}>
						{(item) => (
							<div
								onClick={() => {
									try {
										haptic.impact('light');
									} catch {}
									navigate(`/numbers/report?n=${encodeURIComponent(item.number)}`);
								}}
								class="bg-[#12141C]/80 hover:bg-[#181b26] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all shadow-lg"
							>
								<div class="flex items-center gap-3">
									<div
										class={`w-2.5 h-2.5 rounded-full ${
											item.status === 'for_sale' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'
										}`}
									/>
									<div>
										<div class="text-sm font-black text-white font-mono">{item.display_number}</div>
										<div class="text-[10px] text-white/40 flex items-center gap-1.5 mt-0.5 font-mono">
											<span>{item.color}</span>
											<span>·</span>
											<span>Rarity {item.rarity_score}/100</span>
										</div>
									</div>
								</div>

								<div class="text-right rtl:text-left">
									<Show when={item.status === 'for_sale' && item.listing_price_ton}>
										<div class="text-xs font-black text-amber-400 font-mono">
											{formatTon(item.listing_price_ton)} {t('common.ton')}
										</div>
										<div class="text-[9px] text-white/40 uppercase font-bold">{t('numbers.askPrice')}</div>
									</Show>
									<Show when={item.status !== 'for_sale'}>
										<span class="text-[10px] font-bold text-white/50 bg-white/[0.06] px-2 py-0.5 rounded-lg">
											{t('numbers.taken')}
										</span>
									</Show>
								</div>
							</div>
						)}
					</For>
				</div>
			</div>
		</div>
	);
};
