import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { FragStatusPill, TonAmount } from '@/shared/ui/fragment/FragmentPrimitives.js';

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
		let rawDigits = toAscii(text).replace(/\D/g, '');
		const trimmedText = text.trim();

		if (trimmedText.startsWith('+888')) {
			rawDigits = rawDigits.slice(3);
		} else if (rawDigits.length === 11 && rawDigits.startsWith('888')) {
			rawDigits = rawDigits.slice(3);
		} else if (rawDigits.length === 7 && rawDigits.startsWith('888')) {
			rawDigits = rawDigits.slice(3);
		}

		const maxLen = lengthMode() === '4' ? 4 : 8;

		if (rawDigits.length > 0) {
			try {
				haptic.impact('medium');
			} catch {}
			const next = Array(maxLen).fill('*');
			for (let i = 0; i < maxLen; i++) {
				if (i < rawDigits.length) {
					next[i] = rawDigits[i];
				}
			}
			if (lengthMode() === '4') {
				setSlots4(next);
			} else {
				setSlots8(next);
			}
			const targetFocus = Math.min(maxLen - 1, rawDigits.length);
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
		<div class="frag-canvas pb-36 text-white min-h-screen relative selection:bg-[#2990ff]/30 overflow-x-hidden">
			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				{/* Top Navigation */}
				<div class="flex items-center justify-between gap-2 mb-4">
					<div class="flex items-center gap-2.5 min-w-0">
						<div class="w-10 h-10 rounded-[11px] bg-[#2990ff]/12 border border-[#2990ff]/30 flex items-center justify-center shrink-0">
							<span class="material-symbols-outlined text-[#2990ff] text-[20px]">tune</span>
						</div>
						<div class="min-w-0">
							<h1 class="text-[16px] font-semibold tracking-[-0.015em] text-white truncate">
								{t('numbers.maskBuilderTitle')}
							</h1>
							<p class="text-[11.5px] font-medium text-[#8c9ba5] truncate">
								{t('numbers.maskBuilderSub')}
							</p>
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
						class="px-3 py-1.5 rounded-[9px] frag-btn-secondary text-[11.5px] font-semibold shrink-0"
					>
						{t('numbers.intelOverview')}
					</button>
				</div>

				{/* 4-Digit vs 8-Digit Length Segmented Switch */}
				<div class="grid grid-cols-2 frag-inset p-1 rounded-[12px] mb-3.5 gap-1">
					<button
						type="button"
						onClick={() => switchLengthMode('8')}
						class={`py-2 px-3 rounded-[9px] text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
							lengthMode() === '8'
								? 'bg-[#2990ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
								: 'text-[#8c9ba5] hover:text-white'
						}`}
					>
						<span>{t('numbers.mode8Digit') || '8-Digit Standard'}</span>
						<span class="text-[10.5px] opacity-75 font-mono tabular-nums">(135.5k)</span>
					</button>
					<button
						type="button"
						onClick={() => switchLengthMode('4')}
						class={`py-2 px-3 rounded-[9px] text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 ${
							lengthMode() === '4'
								? 'bg-[#2990ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
								: 'text-[#8c9ba5] hover:text-white'
						}`}
					>
						<span>{t('numbers.mode4Digit') || '4-Digit Genesis'}</span>
						<span class="text-[10.5px] opacity-75 font-mono tabular-nums">(1,000)</span>
					</button>
				</div>

				{/* Tactile Dialpad Mask Box */}
				<div class="frag-card-elevated rounded-[16px] p-4 mb-4">
					<div class="flex items-center justify-between mb-3">
						<span class="text-[12px] font-medium text-[#8c9ba5]">{t('numbers.patternQuery')}:</span>
						<span class="text-[12px] font-mono font-semibold text-[#2990ff] tabular-nums" dir="ltr">
							{currentMaskString()}
						</span>
					</div>

					<div class="flex items-center gap-1.5 justify-center mb-3.5" dir="ltr">
						<div class="px-2.5 h-11 rounded-[10px] bg-[#2990ff]/14 border border-[#2990ff]/35 text-[#2990ff] font-mono font-semibold text-[13.5px] flex items-center justify-center select-none tabular-nums">
							+888
						</div>

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
									class={`w-8 sm:w-9 h-11 rounded-[10px] text-center font-mono font-semibold text-[16px] tabular-nums focus:outline-none transition-all ${
										slot === '*'
											? 'bg-[#11161d] text-[#60707c] border border-white/[0.08] focus:border-[#2990ff]'
											: 'bg-[#2990ff]/14 text-white border border-[#2990ff]/60 focus:border-[#2990ff] ring-1 ring-[#2990ff]/30'
									}`}
								/>
							)}
						</For>
					</div>

					<Show when={genesisWarning()}>
						<div class="mb-3 px-3 py-2 rounded-[9px] bg-[#ffb340]/12 border border-[#ffb340]/30 text-[#ffb340] text-[11.5px] font-medium flex items-center gap-2">
							<span class="material-symbols-outlined text-[15px]">info</span>
							<span>
								{t('numbers.genesisWarning') || 'Genesis numbers always start with 8 (+888 8XXX)'}
							</span>
						</div>
					</Show>

					{/* Quick Preset Pattern Chips */}
					<div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
						<For each={lengthMode() === '4' ? PRESET_PATTERNS_4 : PRESET_PATTERNS_8}>
							{(preset) => (
								<button
									type="button"
									onClick={() => applyPreset(preset.mask)}
									class="px-2.5 py-1 rounded-[7px] frag-btn-secondary text-[11px] font-medium text-[#d7e0e8] whitespace-nowrap active:scale-95"
								>
									{preset.label}
								</button>
							)}
						</For>
					</div>
				</div>

				{/* Filter Chips & Counter */}
				<div class="flex items-center justify-between gap-2 mb-3">
					<div class="flex items-center gap-1 frag-inset p-1 rounded-[11px] text-[11.5px] font-semibold">
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setFilterStatus('all');
							}}
							class={`px-2.5 py-1 rounded-[8px] transition-all ${
								filterStatus() === 'all'
									? 'bg-[#2990ff] text-white'
									: 'text-[#8c9ba5] hover:text-white'
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
							class={`px-2.5 py-1 rounded-[8px] transition-all flex items-center gap-1.5 ${
								filterStatus() === 'for_sale'
									? 'bg-[#232d3a] text-[#ffb340] border border-[#ffb340]/30'
									: 'text-[#8c9ba5] hover:text-white'
							}`}
						>
							<span class="w-1.5 h-1.5 rounded-full bg-[#ffb340]" />
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
							class={`px-2.5 py-1 rounded-[8px] transition-all flex items-center gap-1.5 ${
								filterStatus() === 'taken'
									? 'bg-[#232d3a] text-white border border-white/[0.1]'
									: 'text-[#8c9ba5] hover:text-white'
							}`}
						>
							<span class="w-1.5 h-1.5 rounded-full bg-[#8c9ba5]" />
							<span>{t('numbers.taken')}</span>
						</button>
					</div>

					<div class="text-[11px] font-mono text-[#60707c] tabular-nums">
						{filteredResults().length} {t('numbers.allResults')?.toLowerCase() || 'matches'}
					</div>
				</div>

				{/* Matched Numbers List */}
				<div class="space-y-2">
					<For each={filteredResults()}>
						{(item) => (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.impact('light');
									} catch {}
									navigate(`/numbers/report?n=${encodeURIComponent(item.number)}`);
								}}
								class="w-full frag-card-interactive rounded-[12px] p-3.5 flex items-center justify-between gap-3 text-start active:scale-[0.99]"
							>
								<div class="flex items-center gap-3 min-w-0">
									<span
										class={`w-2 h-2 rounded-full shrink-0 ${
											item.status === 'for_sale' ? 'bg-[#ffb340]' : 'bg-[#60707c]'
										}`}
									/>
									<div class="min-w-0">
										<div
											class="text-[14px] font-semibold text-white font-mono tabular-nums truncate"
											dir="ltr"
										>
											{item.display_number}
										</div>
										<div class="text-[11px] text-[#8c9ba5] flex items-center gap-1.5 mt-0.5 font-mono tabular-nums">
											<span>{item.color}</span>
											<span>·</span>
											<span>Rarity {item.rarity_score}/100</span>
										</div>
									</div>
								</div>

								<div class="text-end shrink-0">
									<Show
										when={item.status === 'for_sale' && item.listing_price_ton}
										fallback={<FragStatusPill status="taken" label={t('numbers.taken')} />}
									>
										<TonAmount
											value={formatTon(item.listing_price_ton)}
											size="sm"
											unit
											tone="warning"
										/>
										<div class="text-[10px] text-[#8c9ba5] mt-0.5">{t('numbers.askPrice')}</div>
									</Show>
								</div>
							</button>
						)}
					</For>
				</div>
			</div>
		</div>
	);
};
