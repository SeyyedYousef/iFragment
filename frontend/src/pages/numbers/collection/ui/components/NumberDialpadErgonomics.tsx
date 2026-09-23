import { type Component, createSignal, For, Show } from 'solid-js';
import { layaT, NUMBERS_I18N } from '@/shared/i18n/laya-i18n.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	initialNumber?: string;
}

const DIALPAD_KEYS = [
	{ digit: '1', letters: '' },
	{ digit: '2', letters: 'ABC' },
	{ digit: '3', letters: 'DEF' },
	{ digit: '4', letters: 'GHI' },
	{ digit: '5', letters: 'JKL' },
	{ digit: '6', letters: 'MNO' },
	{ digit: '7', letters: 'PQRS' },
	{ digit: '8', letters: 'TUV' },
	{ digit: '9', letters: 'WXYZ' },
	{ digit: '*', letters: '' },
	{ digit: '0', letters: '+' },
	{ digit: '#', letters: '' },
];

export const NumberDialpadErgonomics: Component<Props> = (props) => {
	const [activeNumber, setActiveNumber] = createSignal<string>(props.initialNumber || '+888 8888 8888');

	// Clean digits only
	const rawDigits = () => activeNumber().replace(/\D/g, '').replace(/^888/, '');

	// Digit frequencies
	const digitFreq = () => {
		const freq: Record<string, number> = {};
		for (const ch of rawDigits()) {
			freq[ch] = (freq[ch] || 0) + 1;
		}
		return freq;
	};

	// Keypad Ergonomics Score (1-100)
	const ergonomicsScore = () => {
		const d = rawDigits();
		if (d.length === 0) return 50;
		const unique = new Set(d.split('')).size;
		if (unique === 1) return 99; // Monodigit: Zero thumb travel!
		if (unique === 2) return 92; // Binary: Minimal thumb travel!
		if (unique <= 3) return 84;
		if (unique <= 5) return 68;
		return 50;
	};

	// Travel distance description
	const travelMetric = () => {
		const s = ergonomicsScore();
		if (s >= 90) return layaT(NUMBERS_I18N.thumbZeroTravel);
		if (s >= 75) return layaT(NUMBERS_I18N.thumbFluidTravel);
		return layaT(NUMBERS_I18N.thumbStandardTravel);
	};

	return (
		<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start flex flex-col gap-4 relative overflow-hidden mb-4">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
						<span class="material-symbols-outlined text-[20px]">dialpad</span>
					</div>
					<div class="flex flex-col">
						<h4 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{layaT(NUMBERS_I18N.ergonomicsTitle)}
						</h4>
						<span class="text-[9px] font-mono text-white/40">
							{layaT(NUMBERS_I18N.ergonomicsSubtitle)}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-cyan-400 bg-cyan-400/10 border border-cyan-400/30 px-2 py-0.5 rounded-md">
					ERGONOMICS v2
				</span>
			</div>

			{/* Interactive Preset Buttons */}
			<div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
				<For
					each={[
						{ label: '8888 8888', num: '+888 8888 8888' },
						{ label: '0101 0101', num: '+888 0101 0101' },
						{ label: '1234 5678', num: '+888 1234 5678' },
						{ label: '0000 0000', num: '+888 0000 0000' },
						{ label: '0888 (Genesis)', num: '+888 0888' },
					]}
				>
					{(preset) => (
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setActiveNumber(preset.num);
							}}
							class={`px-2.5 py-1 rounded-[10px] text-[10px] font-mono font-bold transition-all border whitespace-nowrap ${
								activeNumber() === preset.num
									? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
									: 'bg-[#08090D] border-white/5 text-white/50 hover:text-white'
							}`}
						>
							{preset.label}
						</button>
					)}
				</For>
			</div>

			{/* Dialpad Visualization Grid & Score Panel */}
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
				{/* The 12-key Dialpad UI */}
				<div class="bg-[#08090D] border border-white/5 rounded-[22px] p-3 grid grid-cols-3 gap-1.5 shadow-inner">
					<For each={DIALPAD_KEYS}>
						{(key) => {
							const hits = () => digitFreq()[key.digit] || 0;
							const isHit = () => hits() > 0;
							return (
								<div
									class={`aspect-square rounded-[14px] flex flex-col items-center justify-center transition-all border ${
										isHit()
											? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.35)] scale-105'
											: 'bg-white/[0.02] border-white/5 text-white/30'
									}`}
								>
									<span class={`text-[16px] font-mono font-black ${isHit() ? 'text-cyan-300' : 'text-white/60'}`}>
										{key.digit}
									</span>
									<Show when={key.letters}>
										<span class="text-[7px] font-mono text-white/40 tracking-wider">
											{key.letters}
										</span>
									</Show>
									<Show when={isHit()}>
										<span class="text-[8px] font-mono font-bold text-amber-400">
											×{hits()}
										</span>
									</Show>
								</div>
							);
						}}
					</For>
				</div>

				{/* Ergonomics Metrics Summary */}
				<div class="flex flex-col gap-2.5">
					<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-1">
						<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
							{layaT(NUMBERS_I18N.cadenceTitle)}
						</span>
						<div class="flex items-baseline gap-2">
							<span class="text-[26px] font-mono font-black text-cyan-400 leading-none">
								{ergonomicsScore()}
							</span>
							<span class="text-[12px] font-mono font-bold text-white/40">/ 100</span>
						</div>
						<div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-1">
							<div
								class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
								style={{ width: `${ergonomicsScore()}%` }}
							/>
						</div>
						<span class="text-[10px] font-mono text-white/60 mt-1">
							{travelMetric()}
						</span>
					</div>

					<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3 flex flex-col gap-1 text-[10px] font-mono text-white/70">
						<div class="flex justify-between items-center">
							<span class="text-white/40">{layaT(NUMBERS_I18N.activeKeys)}</span>
							<span class="text-white font-bold">{Object.keys(digitFreq()).length} / 10</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-white/40">{layaT(NUMBERS_I18N.muscleMemory)}</span>
							<span class="text-emerald-400 font-bold">
								{ergonomicsScore() >= 80
									? layaT(NUMBERS_I18N.muscleMemoryElite)
									: layaT(NUMBERS_I18N.muscleMemoryStandard)}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
