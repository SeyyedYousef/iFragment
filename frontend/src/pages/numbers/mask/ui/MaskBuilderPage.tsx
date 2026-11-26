import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import {
	FragStatusPill,
	normalizeFragStatus,
	TonAmount,
	TonIcon,
} from '@/shared/ui/fragment/FragmentPrimitives.js';

export const MaskBuilderPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [lengthMode, setLengthMode] = createSignal<'8' | '4'>('8');
	const [slots8, setSlots8] = createSignal<string[]>(['8', '8', '8', '8', '*', '*', '*', '*']);
	const [slots4, setSlots4] = createSignal<string[]>(['8', '8', '8', '8']);
	const [filterStatus, setFilterStatus] = createSignal<'all' | 'for_sale' | 'taken'>('all');
	const [genesisWarning, setGenesisWarning] = createSignal<boolean>(false);

	const PRESET_PATTERNS_8 = [
		{ label: '8888****', mask: ['8', '8', '8', '8', '*', '*', '*', '*'] },
		{ label: '****8888', mask: ['*', '*', '*', '*', '8', '8', '8', '8'] },
		{ label: '*****777', mask: ['*', '*', '*', '*', '*', '7', '7', '7'] },
		{ label: '1234****', mask: ['1', '2', '3', '4', '*', '*', '*', '*'] },
		{ label: '8989****', mask: ['8', '9', '8', '9', '*', '*', '*', '*'] },
	];

	const PRESET_PATTERNS_4 = [
		{ label: '8888', mask: ['8', '8', '8', '8'] },
		{ label: '8000', mask: ['8', '0', '0', '0'] },
		{ label: '8*8*', mask: ['8', '*', '8', '*'] },
		{ label: '8***', mask: ['8', '*', '*', '*'] },
	];

	const currentSlots = () => (lengthMode() === '4' ? slots4() : slots8());

	const rawQueryString = createMemo(() => `+888${currentSlots().join('')}`);

	const maskQuery = createQuery(() => ({
		queryKey: ['maskSearch', rawQueryString()],
		queryFn: () => numbersApi.searchMask(rawQueryString(), 30),
		staleTime: 30 * 1000,
	}));

	const filteredResults = createMemo(() => {
		const list = maskQuery.data || [];
		if (filterStatus() === 'for_sale') return list.filter((it) => it.status === 'for_sale');
		if (filterStatus() === 'taken') return list.filter((it) => it.status === 'taken');
		return list;
	});

	const inputRefs: HTMLInputElement[] = [];

	const toAscii = (str: string) =>
		str
			.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
			.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));

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

		if (lengthMode() === '4') setSlots4(current);
		else setSlots8(current);
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

	const applyPreset = (presetMask: string[]) => {
		try {
			haptic.impact('light');
		} catch {}
		if (lengthMode() === '4') setSlots4([...presetMask]);
		else setSlots8([...presetMask]);
	};

	const formatTon = (val?: number) => {
		if (!val) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	return (
		<div class="frag-canvas pb-32 text-white min-h-screen relative font-frag-sans overflow-x-hidden">
			{/* Authentic Fragment.com Sticky Top Header (.tm-header) */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => navigate('/numbers/intel')}
					class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
				>
					<TonIcon size={20} color="#4db2ff" />
					<span class="text-[15px] font-bold tracking-[0.04em]" dir="ltr">
						FRAGMENT
					</span>
				</button>

				<button
					type="button"
					onClick={() => navigate('/numbers/intel')}
					class="h-8 px-2.5 rounded-[6px] bg-[#293440] hover:bg-[#384553] text-white text-[12px] font-semibold cursor-pointer"
				>
					{t('numbers.intelOverview')}
				</button>
			</header>

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-5 space-y-4">
				<div>
					<h1 class="text-[20px] font-bold text-white tracking-[-0.015em]">
						{t('numbers.maskBuilderTitle')}
					</h1>
					<p class="text-[12.5px] text-[#8794a1] mt-0.5">{t('numbers.maskBuilderSub')}</p>
				</div>

				{/* 8-Digit vs 4-Digit Mode Toggle */}
				<div class="grid grid-cols-2 bg-[#212a33] p-1 rounded-[8px] gap-1">
					<button
						type="button"
						onClick={() => setLengthMode('8')}
						class={`py-2 px-3 rounded-[6px] text-[12.5px] font-semibold transition-colors cursor-pointer ${
							lengthMode() === '8' ? 'bg-[#248bda] text-white' : 'text-[#8c9aa9] hover:text-white'
						}`}
					>
						{t('numbers.mode8Digit') || '8-Digit Standard'}
					</button>
					<button
						type="button"
						onClick={() => setLengthMode('4')}
						class={`py-2 px-3 rounded-[6px] text-[12.5px] font-semibold transition-colors cursor-pointer ${
							lengthMode() === '4' ? 'bg-[#248bda] text-white' : 'text-[#8c9aa9] hover:text-white'
						}`}
					>
						{t('numbers.mode4Digit') || '4-Digit Genesis'}
					</button>
				</div>

				{/* Clean Fragment Digit Slots Card (#212a33) */}
				<div class="frag-card p-4 space-y-3">
					<div class="flex items-center justify-center gap-1.5 flex-wrap" dir="ltr">
						<span class="px-2.5 h-10 rounded-[6px] bg-[#242e38] text-[#4db2ff] font-mono font-bold text-[14px] flex items-center">
							+888
						</span>
						<For each={currentSlots()}>
							{(slot, idx) => (
								<input
									ref={(el) => {
										inputRefs[idx()] = el;
									}}
									type="text"
									inputMode="numeric"
									maxLength={2}
									value={slot}
									onFocus={(e) => e.currentTarget.select()}
									onInput={(e) => handleSlotChange(idx(), e.currentTarget.value)}
									onKeyDown={(e) => handleKeyDown(idx(), e)}
									class={`w-8 sm:w-9 h-10 rounded-[6px] text-center font-mono text-[15px] font-bold outline-none transition-colors ${
										slot !== '*'
											? 'bg-[#248bda] text-white'
											: 'bg-[#242e38] hover:bg-[#293440] text-[#8c9aa9]'
									}`}
								/>
							)}
						</For>
					</div>

					<Show when={genesisWarning()}>
						<p class="text-[11.5px] text-[#ff9953] text-center">
							4-digit genesis numbers always start with digit 8 (8000–8999).
						</p>
					</Show>

					{/* Quick Presets */}
					<div class="flex items-center justify-center gap-1.5 flex-wrap pt-1" dir="ltr">
						<For each={lengthMode() === '4' ? PRESET_PATTERNS_4 : PRESET_PATTERNS_8}>
							{(preset) => (
								<button
									type="button"
									onClick={() => applyPreset(preset.mask)}
									class="px-2.5 py-1 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-[11.5px] font-mono font-semibold text-[#4db2ff] transition-colors cursor-pointer"
								>
									{preset.label}
								</button>
							)}
						</For>
					</div>
				</div>

				{/* Filter & Results Count Row */}
				<div class="flex items-center justify-between gap-2">
					<span class="text-[13px] font-semibold text-white">
						Results ({filteredResults().length})
					</span>
					<div class="flex items-center gap-1">
						<For
							each={
								[
									{ id: 'all', label: 'All' },
									{ id: 'for_sale', label: 'For sale' },
									{ id: 'taken', label: 'Taken' },
								] as const
							}
						>
							{(st) => (
								<button
									type="button"
									onClick={() => setFilterStatus(st.id)}
									class={`px-2.5 py-1 rounded-[6px] text-[11.5px] font-semibold transition-colors cursor-pointer ${
										filterStatus() === st.id
											? 'bg-[#248bda] text-white'
											: 'bg-[#212a33] text-[#8c9aa9] hover:text-white'
									}`}
								>
									{st.label}
								</button>
							)}
						</For>
					</div>
				</div>

				{/* Fragment Results Table (.tm-table) */}
				<div class="frag-table-container">
					<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
						<span class="col-span-6">{t('fragUi.number')}</span>
						<span class="col-span-3">{t('fragUi.price')}</span>
						<span class="col-span-3 text-end">{t('fragUi.status')}</span>
					</div>
					<Show
						when={!maskQuery.isLoading}
						fallback={
							<div class="p-8 text-center text-[13px] text-[#8c9aa9]">
								{t('fragUi.searchingPattern')}
							</div>
						}
					>
						<Show
							when={filteredResults().length > 0}
							fallback={
								<div class="p-8 text-center text-[13px] text-[#8c9aa9]">
									{t('fragUi.noMatchingMask')}
								</div>
							}
						>
							<For each={filteredResults()}>
								{(item) => (
									<button
										type="button"
										onClick={() =>
											navigate(
												`/numbers/report?n=${encodeURIComponent(item.display_number || item.number)}`,
											)
										}
										class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
									>
										<span
											class="col-span-6 font-mono font-semibold text-[13.5px] text-white truncate"
											dir="ltr"
										>
											{item.display_number || item.number}
										</span>
										<div class="col-span-3">
											<Show
												when={item.listing_price_ton}
												fallback={<span class="text-[12px] text-[#8c9aa9]">—</span>}
											>
												<TonAmount value={formatTon(item.listing_price_ton)} size="sm" />
											</Show>
										</div>
										<div class="col-span-3 flex justify-end">
											<FragStatusPill status={normalizeFragStatus(item.status)} />
										</div>
									</button>
								)}
							</For>
						</Show>
					</Show>
				</div>
			</div>
		</div>
	);
};
