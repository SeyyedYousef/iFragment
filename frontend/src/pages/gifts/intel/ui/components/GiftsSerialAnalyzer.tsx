import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { giftsApi, type SerialClassification } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	rate?: number;
}

export const GiftsSerialAnalyzer: Component<Props> = (props) => {
	const [serialInput, setSerialInput] = createSignal<string>('888');
	const [baseFloorInput, setBaseFloorInput] = createSignal<string>('15');

	const parsedSerial = () => {
		const val = Number.parseInt(serialInput().trim(), 10);
		return Number.isNaN(val) || val <= 0 ? 1 : val;
	};

	const parsedBaseFloor = () => {
		const val = Number.parseFloat(baseFloorInput().trim());
		return Number.isNaN(val) || val <= 0 ? 15 : val;
	};

	const serialQuery = createQuery(() => ({
		queryKey: ['giftsSerialClassification', parsedSerial(), parsedBaseFloor()],
		queryFn: () => giftsApi.classifySerial(parsedSerial(), parsedBaseFloor()),
		staleTime: 5 * 60 * 1000,
	}));

	const classification = (): SerialClassification | undefined => serialQuery.data;

	const presetSerials = [
		{ num: 1, label: '#1 Genesis', boost: '35x' },
		{ num: 7, label: '#7 Lucky', boost: '25x' },
		{ num: 888, label: '#888 Wealth', boost: '22x' },
		{ num: 777, label: '#777 Jackpot', boost: '20x' },
		{ num: 42, label: '#42 Two-Digit', boost: '5x' },
		{ num: 101, label: '#101 Palindrome', boost: '4x' },
		{ num: 1000, label: '#1000 Century', boost: '3x' },
		{ num: 1337, label: '#1337 Elite', boost: '2.5x' },
	];

	const tonToUsd = (ton: number) => {
		const r = props.rate || 5.2;
		return (ton * r).toFixed(0);
	};

	const getCategoryBadge = (cat?: string) => {
		const c = (cat || '').toLowerCase();
		if (c === 'single_digit') {
			return {
				bg: 'bg-amber-500/15',
				border: 'border-amber-400/50',
				text: 'text-amber-300',
				title: '💎 تک‌رقمی جنسیس (Single-Digit Apex)',
			};
		}
		if (c === 'repeating') {
			return {
				bg: 'bg-emerald-500/15',
				border: 'border-emerald-400/50',
				text: 'text-emerald-300',
				title: '✨ ارقام تکرارشونده خاص (Repeating Digits)',
			};
		}
		if (c === 'palindrome') {
			return {
				bg: 'bg-cyan-500/15',
				border: 'border-cyan-400/50',
				text: 'text-cyan-300',
				title: '🔄 متقارن آینه‌ای (Palindrome)',
			};
		}
		if (c === 'two_digit') {
			return {
				bg: 'bg-[#0098EA]/15',
				border: 'border-[#0098EA]/50',
				text: 'text-[#0098EA]',
				title: '⚡️ دورقمی کلکسیونی (Two-Digit Tier)',
			};
		}
		if (c === 'round_number') {
			return {
				bg: 'bg-teal-500/15',
				border: 'border-teal-400/50',
				text: 'text-teal-300',
				title: '🎯 رند صدگان و هزارگان (Round Number)',
			};
		}
		if (c === 'early_mint') {
			return {
				bg: 'bg-blue-500/15',
				border: 'border-blue-400/50',
				text: 'text-blue-300',
				title: '🚀 مینت اولیه (Early Mint)',
			};
		}
		return {
			bg: 'bg-white/[0.04]',
			border: 'border-white/10',
			text: 'text-white/60',
			title: 'استاندارد (Standard Serial)',
		};
	};

	return (
		<div class="space-y-3.5">
			{/* Header Banner */}
			<div class="bg-[#0b0e17]/95 border border-white/[0.08] rounded-[24px] p-4 backdrop-blur-2xl shadow-xl space-y-2">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" />
						<h3 class="text-xs font-black uppercase tracking-wider text-white">
							{t('gifts.serialGeneticsHeader') || 'Serial Number Genetics & Valuation'}
						</h3>
					</div>
					<span class="text-[9px] uppercase font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
						NV Mathematical Engine
					</span>
				</div>
				<p class="text-[11px] text-white/50 font-medium leading-relaxed">
					تحلیل ریاضی گرانش و نایابی شماره سریال‌های خاص گیفت‌های تلگرام؛ کشف ضرایب چندبرابری ارزش
					کلکسیونی بر اساس الگوهای عددی.
				</p>

				{/* Quick Tap Preset Pills */}
				<div class="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
					<For each={presetSerials}>
						{(p) => (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									setSerialInput(p.num.toString());
								}}
								class={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold whitespace-nowrap transition-all border ${
									parsedSerial() === p.num
										? 'bg-amber-500/20 text-amber-300 border-amber-400/50 shadow-md shadow-amber-500/10'
										: 'bg-white/[0.03] text-white/50 hover:text-white border-white/[0.06]'
								}`}
							>
								<span>{p.label}</span>
								<span class="text-amber-400 mr-1 rtl:ml-1 font-sans">({p.boost})</span>
							</button>
						)}
					</For>
				</div>
			</div>

			{/* Interactive Inputs */}
			<div class="grid grid-cols-2 gap-2 bg-[#0b0e17]/90 border border-white/[0.07] rounded-2xl p-3 shadow-lg">
				<div>
					<label class="block text-[10px] uppercase font-bold text-white/40 mb-1">
						شماره سریال گیفت (#)
					</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 font-mono text-xs">
							#
						</span>
						<input
							type="number"
							min="1"
							value={serialInput()}
							onInput={(e) => setSerialInput(e.currentTarget.value)}
							class="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-7 pr-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-[#0098EA]/60 focus:ring-1 focus:ring-[#0098EA]/30 transition-all"
							placeholder="e.g. 888"
						/>
					</div>
				</div>

				<div>
					<label class="block text-[10px] uppercase font-bold text-white/40 mb-1">
						کف قیمت مدل پایه (TON)
					</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">💎</span>
						<input
							type="number"
							min="1"
							step="0.5"
							value={baseFloorInput()}
							onInput={(e) => setBaseFloorInput(e.currentTarget.value)}
							class="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-7 pr-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-[#0098EA]/60 focus:ring-1 focus:ring-[#0098EA]/30 transition-all"
							placeholder="15"
						/>
					</div>
				</div>
			</div>

			{/* Genetic Valuation Output Card */}
			<Show when={classification()}>
				{(() => {
					const c = classification()!;
					const badge = getCategoryBadge(c.category);
					const isHighTier = c.multiplier >= 4.0;

					return (
						<div class="relative overflow-hidden bg-gradient-to-br from-[#0c101a] to-[#080b12] border border-white/[0.09] rounded-2xl p-4 shadow-xl space-y-3.5">
							{/* Ambient Glow */}
							<div
								class={`absolute -top-12 -right-12 w-44 h-44 rounded-full blur-[70px] pointer-events-none opacity-20 ${
									isHighTier ? 'bg-amber-400' : 'bg-[#0098EA]'
								}`}
							/>

							{/* Header Row */}
							<div class="flex items-start justify-between relative z-10">
								<div>
									<div class="flex items-center gap-2">
										<span class="text-xl font-black text-white font-mono">
											#{c.serial_number}
										</span>
										<span
											class={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${badge.bg} ${badge.border} ${badge.text}`}
										>
											{badge.title}
										</span>
									</div>
									<p class="text-[11px] text-white/50 mt-1 font-medium leading-normal">
										{c.description}
									</p>
								</div>

								{/* Multiplier Badge */}
								<div class="text-right flex-shrink-0">
									<div class="text-2xl font-black text-amber-400 font-mono tracking-tight drop-shadow-md">
										{c.multiplier.toFixed(1)}x
									</div>
									<div class="text-[9px] uppercase font-bold text-white/40">ضریب نایابی</div>
								</div>
							</div>

							{/* Valuation Metrics Bento */}
							<div class="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/[0.06] relative z-10">
								<div class="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
									<span class="text-[10px] uppercase text-white/40 font-bold block">
										کف قیمت عادی مدل
									</span>
									<span class="text-sm font-bold text-white font-mono mt-0.5 block">
										💎 {parsedBaseFloor().toFixed(1)} TON
									</span>
									<span class="text-[10px] text-white/40 font-mono">
										≈ ${tonToUsd(parsedBaseFloor())} USD
									</span>
								</div>

								<div class="bg-gradient-to-br from-amber-500/10 to-amber-600/[0.03] border border-amber-400/30 rounded-xl p-3 text-right rtl:text-left">
									<span class="text-[10px] uppercase text-amber-300 font-bold block">
										ارزش تخمینی این سریال
									</span>
									<span class="text-base font-black text-amber-400 font-mono mt-0.5 block">
										💎 {c.estimated_floor_gram.toFixed(1)} TON
									</span>
									<span class="text-[10px] text-amber-300/70 font-mono">
										≈ ${tonToUsd(c.estimated_floor_gram)} USD
									</span>
								</div>
							</div>

							{/* Rarity Percentile Readout */}
							<div class="flex items-center justify-between text-[11px] font-mono text-white/50 pt-1 border-t border-white/[0.04] relative z-10">
								<span>درصد کمیابی در کل کالکشن:</span>
								<span class="font-bold text-emerald-400">
									تاپ {c.rarity_percentage.toFixed(2)}% کل عرضه
								</span>
							</div>
						</div>
					);
				})()}
			</Show>
		</div>
	);
};
