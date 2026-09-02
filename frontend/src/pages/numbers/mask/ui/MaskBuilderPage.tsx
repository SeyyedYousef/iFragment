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

	const [lengthMode, setLengthMode] = createSignal<'8' | '4'>('8');
	const [slots8, setSlots8] = createSignal<string[]>(['8', '8', '8', '8', '*', '*', '*', '*']);
	const [slots4, setSlots4] = createSignal<string[]>(['8', '8', '8', '8']);
	const [filterStatus, setFilterStatus] = createSignal<'all' | 'for_sale' | 'taken'>('all');
	const [genesisWarning, setGenesisWarning] = createSignal<boolean>(false);

	const PRESET_PATTERNS_8 = [
		{ label: 'Quad 8888 Prefix', mask: ['8', '8', '8', '8', '*', '*', '*', '*'] },
		{ label: 'Quad 8888 Tail', mask: ['*', '*', '*', '*', '8', '8', '8', '8'] },
		{ label: 'Triple 777 Tail', mask: ['*', '*', '*', '*', '*', '7', '7', '7'] },
		{ label: 'Sequential 1234', mask: ['1', '2', '3', '4', '*', '*', '*', '*'] },
		{ label: 'Alternating 8989', mask: ['8', '9', '8', '9', '*', '*', '*', '*'] },
	];

	const PRESET_PATTERNS_4 = [
		{ label: 'Genesis Monodigit 8888', mask: ['8', '8', '8', '8'] },
		{ label: 'Genesis Floor 8000', mask: ['8', '0', '0', '0'] },
		{ label: 'Genesis Dual 8*8*', mask: ['8', '*', '8', '*'] },
		{ label: 'Genesis Any 8***', mask: ['8', '*', '*', '*'] },
	];

	const currentSlots = () => (lengthMode() === '4' ? slots4() : slots8());

	const currentMaskString = createMemo(() => {
		const s = currentSlots();
		if (s.length === 4) {
			return `+888 ${s.join('')}`;
		}
		return `+888 ${s.slice(0, 4).join('')} ${s.slice(4).join('')}`;
	});

	const rawQueryString = createMemo(() => {
		return `+888${currentSlots().join('')}`;
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

	const inputRefs: HTMLInputElement[] = [];

	const toAscii = (str: string) => {
		return str
			.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
			.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
	};

	const handleSlotChange = (index: number, val: string) => {
		try {
			haptic.selection();
		} catch {}
		const asciiVal = toAscii(val || '');
		const current = [...currentSlots()];
		const maxLen = lengthMode() === '4' ? 4 : 8;

		if (!asciiVal || asciiVal === ' ' || asciiVal === '*') {
			current[index] = '*';
		} else {
			const char = asciiVal.slice(-1);
			if (char >= '0' && char <= '9') {
				// In 4-digit mode, first digit must be 8 for Telegram genesis
				if (lengthMode() === '4' && index === 0 && char !== '8') {
					current[index] = '8';
					setGenesisWarning(true);
					setTimeout(() => setGenesisWarning(false), 3000);
					try {
						haptic.notify('warning');
					} catch {}
				} else {
					current[index] = char;
				}
				// Auto-advance focus to next slot
				if (index < maxLen - 1 && inputRefs[index + 1]) {
					inputRefs[index + 1]?.focus();
					inputRefs[index + 1]?.select();
				}
			} else {
				current[index] = '*';
			}
		}

		if (lengthMode() === '4') {
			setSlots4(current);
		} else {
			setSlots8(current);
		}
	};

	const handleKeyDown = (index: number, e: KeyboardEvent) => {
		const maxLen = lengthMode() === '4' ? 4 : 8;
		if (e.key === 'Backspace') {
			if (currentSlots()[index] === '*' && index > 0) {
				e.preventDefault();
				inputRefs[index - 1]?.focus();
				inputRefs[index - 1]?.select();
			}
		} else if (e.key === 'ArrowLeft' && index > 0) {
			e.preventDefault();
			inputRefs[index - 1]?.focus();
		} else if (e.key === 'ArrowRight' && index < maxLen - 1) {
			e.preventDefault();
			inputRefs[index + 1]?.focus();
		}
	};

	const handlePaste = (e: ClipboardEvent) => {
		e.preventDefault();
		const text = e.clipboardData?.getData('text') || '';
		const digitsOnly = toAscii(text).replace(/\D/g, '').replace(/^888/, '');
		const maxLen = lengthMode() === '4' ? 4 : 8;

		if (digitsOnly.length > 0) {
			try {
				haptic.impact('medium');
			} catch {}
			const next = [...currentSlots()];
			for (let i = 0; i < maxLen; i++) {
				if (i < digitsOnly.length) {
					next[i] = digitsOnly[i];
				}
			}
			if (lengthMode() === '4') {
				setSlots4(next);
			} else {
				setSlots8(next);
			}
			const targetFocus = Math.min(maxLen - 1, digitsOnly.length);
			inputRefs[targetFocus]?.focus();
		}
	};

	const applyPreset = (presetMask: string[]) => {
		try {
			haptic.impact('medium');
		} catch {}
		if (lengthMode() === '4') {
			setSlots4([...presetMask]);
		} else {
			setSlots8([...presetMask]);
		}
	};

	const switchLengthMode = (mode: '8' | '4') => {
		try {
			haptic.selection();
		} catch {}
		setLengthMode(mode);
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

				{/* 4-Digit vs 8-Digit Length Segmented Switch */}
				<div class="grid grid-cols-2 bg-[#12141C]/90 p-1 rounded-2xl border border-white/10 mb-4 shadow-lg">
					<button
						type="button"
						onClick={() => switchLengthMode('8')}
						class={`py-1.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
							lengthMode() === '8'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25'
								: 'text-white/50 hover:text-white'
						}`}
					>
						<span>{t('numbers.mode8Digit') || '8-Digit Standard'}</span>
						<span class="text-[10px] opacity-70 font-mono font-normal">(135.5k)</span>
					</button>
					<button
						type="button"
						onClick={() => switchLengthMode('4')}
						class={`py-1.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
							lengthMode() === '4'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25'
								: 'text-white/50 hover:text-white'
						}`}
					>
						<span>{t('numbers.mode4Digit') || '4-Digit Genesis'}</span>
						<span class="text-[10px] opacity-70 font-mono font-normal">(1,000)</span>
					</button>
				</div>

				{/* Visual Selector Box */}
				<div class="bg-[#12141C]/80 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 mb-4 shadow-xl">
					<div class="flex items-center justify-between mb-3">
						<span class="text-xs font-bold text-white/60">{t('numbers.patternQuery')}:</span>
						<span class="text-xs font-mono font-black text-[#0098EA]">{currentMaskString()}</span>
					</div>

					<div class="flex items-center gap-1.5 justify-center mb-4" dir="ltr">
						{/* +888 Fixed Badge */}
						<div class="px-2.5 py-3 rounded-2xl bg-[#0098EA]/20 border border-[#0098EA]/40 text-[#0098EA] font-mono font-black text-sm flex items-center justify-center select-none">
							+888
						</div>

						{/* Interactive Slot Inputs */}
						<For each={currentSlots()}>
							{(slot, idx) => (
								<input
									ref={(el) => {
										inputRefs[idx()] = el;
									}}
									type="text"
									inputMode="numeric"
									aria-label={`Number slot ${idx() + 1}`}
									maxLength={1}
									value={slot}
									onFocus={(e) => e.currentTarget.select()}
									onInput={(e) => handleSlotChange(idx(), e.currentTarget.value)}
									onKeyDown={(e) => handleKeyDown(idx(), e)}
									onPaste={handlePaste}
									class={`w-8 h-12 rounded-xl text-center font-mono font-black text-base focus:outline-none transition-all ${
										slot === '*'
											? 'bg-white/[0.04] text-white/40 border border-white/10 focus:border-[#0098EA] focus:bg-black/60'
											: 'bg-[#0098EA]/15 text-white border border-[#0098EA]/50 focus:border-[#0098EA] focus:ring-1 focus:ring-[#0098EA]'
									}`}
								/>
							)}
						</For>
					</div>

					<Show when={genesisWarning()}>
						<div class="mb-3 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs flex items-center gap-2 animate-pulse">
							<span class="material-symbols-outlined text-sm">info</span>
							<span>{t('numbers.genesisWarning') || 'Genesis numbers always start with 8 (+888 8XXX)'}</span>
						</div>
					</Show>

					{/* Quick Preset Pattern Chips */}
					<div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
						<For each={lengthMode() === '4' ? PRESET_PATTERNS_4 : PRESET_PATTERNS_8}>
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

				{/* Filter Chips: All | For Sale | Taken (Professional Dots without emojis) */}
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
							class={`px-3 py-1 rounded-xl transition-all flex items-center gap-1.5 ${
								filterStatus() === 'for_sale' ? 'bg-amber-500 text-white font-black' : 'text-white/50'
							}`}
						>
							<span class="w-2 h-2 rounded-full bg-amber-400" />
							<span>{t('numbers.forSale')}</span>
						</button>
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setFilterStatus('taken');
							}}
							class={`px-3 py-1 rounded-xl transition-all flex items-center gap-1.5 ${
								filterStatus() === 'taken' ? 'bg-slate-700 text-white font-black' : 'text-white/50'
							}`}
						>
							<span class="w-2 h-2 rounded-full bg-slate-400" />
							<span>{t('numbers.taken')}</span>
						</button>
					</div>

					<div class="text-[11px] font-mono text-white/40">
						{filteredResults().length} {t('numbers.allResults')?.toLowerCase() || 'matches'} (&lt;150ms)
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
