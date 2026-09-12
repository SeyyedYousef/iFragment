import {
	type Component,
	createMemo,
	createSignal,
	For,
	Show,
} from 'solid-js';
import { useNavigate } from '@solidjs/router';
import type { RarityHeatmapCell } from '@/entities/gifts/index.js';
import { GiftThumbnail } from '@/entities/gifts/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	cells: RarityHeatmapCell[];
	collectionSlug: string;
	collectionName: string;
	bestFloorGram: number;
	gramUsdRate?: number;
}

export const CollectionRarityHeatmap: Component<Props> = (props) => {
	const navigate = useNavigate();
	const [viewMode, setViewMode] = createSignal<'matrix' | 'cards'>('matrix');
	const [tierFilter, setTierFilter] = createSignal<string>('all');
	const [selectedCell, setSelectedCell] = createSignal<RarityHeatmapCell | null>(null);

	const rate = () => props.gramUsdRate || 1.335;

	// Extract unique models and backdrops for 2D matrix
	const uniqueModels = createMemo(() => {
		const set = new Set<string>();
		const list: string[] = [];
		for (const c of props.cells) {
			if (!set.has(c.model_name)) {
				set.add(c.model_name);
				list.push(c.model_name);
			}
		}
		return list.length > 0 ? list : ['Genesis', 'Cyber', 'Royal', 'Master', 'Standard'];
	});

	const uniqueBackdrops = createMemo(() => {
		const set = new Set<string>();
		const list: string[] = [];
		for (const c of props.cells) {
			if (!set.has(c.backdrop_name)) {
				set.add(c.backdrop_name);
				list.push(c.backdrop_name);
			}
		}
		return list.length > 0 ? list : ['Onyx', 'Cosmic Blue', 'Crimson', 'Emerald', 'Golden', 'Electric Violet'];
	});

	// Fast lookup map: `${model}::${backdrop}` -> Cell
	const cellMap = createMemo(() => {
		const map = new Map<string, RarityHeatmapCell>();
		for (const c of props.cells) {
			map.set(`${c.model_name}::${c.backdrop_name}`, c);
		}
		return map;
	});

	// Filtered cells for cards view
	const filteredCells = createMemo(() => {
		let list = props.cells || [];
		const f = tierFilter().toLowerCase();
		if (f !== 'all') {
			list = list.filter((c) => (c.rarity_tier || '').toLowerCase() === f);
		}
		return list;
	});

	// Analytics summary
	const stats = createMemo(() => {
		const all = props.cells || [];
		let mythicCount = 0;
		let legendaryCount = 0;
		let rarest = all[0];
		let highestFloor = all[0];

		for (const c of all) {
			const t = (c.rarity_tier || '').toLowerCase();
			if (t === 'mythic') mythicCount++;
			if (t === 'legendary') legendaryCount++;

			if (!rarest || c.combined_rarity_pct < rarest.combined_rarity_pct) {
				rarest = c;
			}
			if (!highestFloor || c.floor_gram > highestFloor.floor_gram) {
				highestFloor = c;
			}
		}

		return {
			total: all.length,
			mythicCount,
			legendaryCount,
			rarest,
			highestFloor,
		};
	});

	const fmt = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const fmtUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
	};

	// Heatmap Cell Theme by Rarity Tier
	const getCellTheme = (tier?: string) => {
		const t = (tier || '').toLowerCase();
		if (t === 'mythic') {
			return {
				bg: 'bg-gradient-to-br from-purple-600/80 via-pink-600/70 to-purple-800/80 text-white border-purple-400/60 shadow-[0_0_12px_rgba(168,85,247,0.35)]',
				badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
				dot: 'bg-purple-400',
			};
		}
		if (t === 'legendary') {
			return {
				bg: 'bg-gradient-to-br from-amber-500/80 via-yellow-600/70 to-amber-700/80 text-white border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.25)]',
				badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
				dot: 'bg-amber-400',
			};
		}
		if (t === 'epic') {
			return {
				bg: 'bg-gradient-to-br from-sky-600/70 via-indigo-600/60 to-blue-700/70 text-white border-sky-400/40 shadow-[0_0_8px_rgba(56,189,248,0.2)]',
				badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
				dot: 'bg-sky-400',
			};
		}
		if (t === 'rare') {
			return {
				bg: 'bg-gradient-to-br from-emerald-600/60 via-teal-700/50 to-emerald-800/60 text-emerald-100 border-emerald-500/30',
				badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
				dot: 'bg-emerald-400',
			};
		}
		return {
			bg: 'bg-white/[0.04] hover:bg-white/[0.08] text-white/60 border-white/[0.08]',
			badge: 'bg-white/10 text-white/60 border-white/10',
			dot: 'bg-white/40',
		};
	};

	const handleCellClick = (cell: RarityHeatmapCell) => {
		setSelectedCell(cell);
		try {
			haptic.selection();
		} catch {}
	};

	return (
		<div class="bg-[#12141C]/90 border border-white/[0.08] rounded-3xl p-4 sm:p-5 shadow-xl space-y-4 text-start relative overflow-hidden backdrop-blur-xl">
			{/* ═══ Header & Mode Switcher ═══ */}
			<div class="flex items-center justify-between pb-3 border-b border-white/[0.06] flex-wrap gap-2">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-xl bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center text-[#0098EA]">
						<span class="material-symbols-outlined text-lg">grid_view</span>
					</div>
					<div>
						<h3 class="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
							<span>{t('gifts.rarityHeatmapTitle') || 'نقشه حرارتی کمیابی صفات'}</span>
							<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 font-mono">
								2D MATRIX
							</span>
						</h3>
						<span class="text-[10px] text-white/40 block">
							{isRtl() ? 'چگالی آماری ترکیب مدل و پس‌زمینه' : 'Model × Backdrop statistical density'}
						</span>
					</div>
				</div>

				{/* View Toggle */}
				<div class="flex items-center gap-0.5 p-0.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs font-bold font-mono">
					<button
						type="button"
						onClick={() => {
							setViewMode('matrix');
							try {
								haptic.selection();
							} catch {}
						}}
						class={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
							viewMode() === 'matrix' ? 'bg-[#0098EA] text-white shadow' : 'text-white/40 hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-xs">table_chart</span>
						<span>{isRtl() ? 'ماتریس' : 'Matrix'}</span>
					</button>
					<button
						type="button"
						onClick={() => {
							setViewMode('cards');
							try {
								haptic.selection();
							} catch {}
						}}
						class={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
							viewMode() === 'cards' ? 'bg-[#0098EA] text-white shadow' : 'text-white/40 hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-xs">view_agenda</span>
						<span>{isRtl() ? 'کارت‌ها' : 'Cards'}</span>
					</button>
				</div>
			</div>

			{/* ═══ Analytics Summary Strip ═══ */}
			<div class="grid grid-cols-3 gap-2 text-center text-xs">
				<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-2.5">
					<span class="text-[9px] text-white/40 uppercase block font-bold mb-0.5">
						{isRtl() ? 'کل ترکیبات' : 'Total Combos'}
					</span>
					<div class="font-mono font-black text-white text-sm">
						{stats().total}
					</div>
					<span class="text-[9px] text-emerald-400 font-bold block mt-0.5">
						{stats().mythicCount} Mythic
					</span>
				</div>

				<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-2.5">
					<span class="text-[9px] text-white/40 uppercase block font-bold mb-0.5">
						{isRtl() ? 'کمیاب‌ترین ترکیب' : 'Rarest Combo'}
					</span>
					<div class="font-bold text-purple-300 text-[11px] truncate" title={stats().rarest?.model_name}>
						{stats().rarest?.model_name || 'Genesis'}
					</div>
					<span class="text-[9px] text-white/40 font-mono block mt-0.5">
						{(stats().rarest?.combined_rarity_pct || 0.006).toFixed(3)}%
					</span>
				</div>

				<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-2.5">
					<span class="text-[9px] text-white/40 uppercase block font-bold mb-0.5">
						{isRtl() ? 'بالاترین کف' : 'Top Floor'}
					</span>
					<div class="font-mono font-black text-amber-400 text-sm truncate">
						{fmt(stats().highestFloor?.floor_gram)} T
					</div>
					<span class="text-[9px] text-white/40 font-mono block mt-0.5">
						{fmtUsd(Number(stats().highestFloor?.floor_gram || 0) * rate())}
					</span>
				</div>
			</div>

			{/* ═══ VIEW 1: TRUE 2D HEATMAP MATRIX ═══ */}
			<Show when={viewMode() === 'matrix'}>
				<div class="space-y-2.5">
					<div class="text-[10px] text-white/40 flex items-center justify-between px-1">
						<span>{isRtl() ? 'سطرها: مدل‌های گیفت | ستون‌ها: پس‌زمینه‌ها' : 'Rows: Models | Columns: Backdrops'}</span>
						<span class="text-[#0098EA] font-semibold">{isRtl() ? 'لمس برای بررسی' : 'Tap to inspect'}</span>
					</div>

					<div class="overflow-x-auto rounded-2xl border border-white/[0.07] bg-black/40 p-2 scrollbar-thin">
						<table class="w-full text-center border-collapse">
							<thead>
								<tr>
									<th class="p-2 text-[10px] font-bold text-white/40 text-start uppercase tracking-wider min-w-[70px]">
										{isRtl() ? 'مدل' : 'Model'}
									</th>
									<For each={uniqueBackdrops()}>
										{(backdrop) => (
											<th class="p-1.5 text-[9px] font-bold text-white/60 min-w-[62px] max-w-[75px] truncate">
												<span class="block truncate" title={backdrop}>
													{backdrop.split(' ')[0]}
												</span>
											</th>
										)}
									</For>
								</tr>
							</thead>
							<tbody>
								<For each={uniqueModels()}>
									{(model) => (
										<tr class="border-t border-white/[0.04]">
											{/* Sticky Model Row Header */}
											<td class="p-2 text-start font-bold text-xs text-white whitespace-nowrap">
												<span class="block truncate max-w-[80px]" title={model}>
													{model}
												</span>
											</td>

											{/* Heatmap Matrix Cells */}
											<For each={uniqueBackdrops()}>
												{(backdrop) => {
													const key = `${model}::${backdrop}`;
													const cell = cellMap().get(key);
													const theme = getCellTheme(cell?.rarity_tier);
													const isSelected = selectedCell()?.model_name === model && selectedCell()?.backdrop_name === backdrop;

													return (
														<td class="p-1">
															<button
																type="button"
																onClick={() => {
																	if (cell) handleCellClick(cell);
																}}
																class={`w-full h-11 rounded-xl p-1 flex flex-col items-center justify-center transition-all active:scale-95 border ${
																	theme.bg
																} ${isSelected ? 'ring-2 ring-[#0098EA] scale-105 z-10' : ''}`}
																title={`${model} × ${backdrop}: ${cell?.floor_gram} TON (${cell?.rarity_tier})`}
															>
																<span class="text-[10px] font-black font-mono leading-none">
																	{fmt(cell?.floor_gram)}
																</span>
																<span class="text-[8px] font-mono opacity-70 mt-0.5 leading-none">
																	{cell?.combined_rarity_pct ? `${cell.combined_rarity_pct.toFixed(2)}%` : '—'}
																</span>
															</button>
														</td>
													);
												}}
											</For>
										</tr>
									)}
								</For>
							</tbody>
						</table>
					</div>

					{/* Heatmap Legend */}
					<div class="flex items-center justify-between text-[9px] text-white/40 pt-1 px-1 font-mono">
						<span class="flex items-center gap-1">
							<span class="w-2 h-2 rounded-full bg-white/20" /> Common
						</span>
						<span class="flex items-center gap-1">
							<span class="w-2 h-2 rounded-full bg-emerald-500" /> Rare
						</span>
						<span class="flex items-center gap-1">
							<span class="w-2 h-2 rounded-full bg-sky-500" /> Epic
						</span>
						<span class="flex items-center gap-1">
							<span class="w-2 h-2 rounded-full bg-amber-500" /> Legendary
						</span>
						<span class="flex items-center gap-1">
							<span class="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_6px_#a855f7]" /> Mythic
						</span>
					</div>
				</div>
			</Show>

			{/* ═══ VIEW 2: RANKED COMBINATION CARDS ═══ */}
			<Show when={viewMode() === 'cards'}>
				<div class="space-y-3">
					{/* Tier Filter Pills */}
					<div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
						<For each={['all', 'Mythic', 'Legendary', 'Epic', 'Rare', 'Common']}>
							{(tier) => (
								<button
									type="button"
									onClick={() => {
										setTierFilter(tier);
										try {
											haptic.selection();
										} catch {}
									}}
									class={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all shrink-0 ${
										tierFilter().toLowerCase() === tier.toLowerCase()
											? 'bg-[#0098EA] text-white shadow'
											: 'bg-white/[0.03] text-white/50 hover:text-white border border-white/5'
									}`}
								>
									{tier === 'all' ? t('common.all') || 'همه' : tier}
								</button>
							)}
						</For>
					</div>

					{/* Combination Cards */}
					<div class="space-y-2 max-h-[380px] overflow-y-auto pr-1">
						<For each={filteredCells().slice(0, 40)}>
							{(cell) => {
								const theme = getCellTheme(cell.rarity_tier);
								return (
									<button
										type="button"
										onClick={() => handleCellClick(cell)}
										class="w-full bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] rounded-2xl p-3 flex items-center justify-between text-xs transition-all active:scale-[0.99] text-start group"
									>
										<div class="flex items-center gap-2.5 min-w-0">
											<div class="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
												<GiftThumbnail
													slug={props.collectionSlug}
													name={cell.model_name}
													model={cell.model_name}
													size="sm"
													class="w-6 h-6 object-contain"
												/>
											</div>
											<div class="min-w-0">
												<div class="flex items-center gap-1.5">
													<span class="font-bold text-white truncate">{cell.model_name}</span>
													<span class={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border ${theme.badge}`}>
														{cell.rarity_tier}
													</span>
												</div>
												<span class="text-[10px] text-white/40 block mt-0.5 truncate">
													{cell.backdrop_name} · {cell.combined_rarity_pct.toFixed(3)}%
												</span>
											</div>
										</div>

										<div class="text-right rtl:text-left shrink-0">
											<div class="font-mono font-black text-white text-xs">
												{fmt(cell.floor_gram)} TON
											</div>
											<span class="text-[9.5px] text-white/40 font-mono">
												{fmtUsd(cell.floor_gram * rate())}
											</span>
										</div>
									</button>
								);
							}}
						</For>
					</div>
				</div>
			</Show>

			{/* ═══ SELECTED COMBINATION INSPECTOR MODAL/DRAWER ═══ */}
			<Show when={selectedCell()}>
				{(() => {
					const c = selectedCell()!;
					const theme = getCellTheme(c.rarity_tier);
					return (
						<div class="p-3.5 rounded-2xl bg-gradient-to-br from-[#121624] via-[#0E121C] to-[#0A0D15] border border-[#0098EA]/40 space-y-3 shadow-2xl relative overflow-hidden animate-in fade-in">
							<div class="flex items-center justify-between border-b border-white/10 pb-2">
								<div class="flex items-center gap-2">
									<span class={`w-2 h-2 rounded-full ${theme.dot} animate-pulse`} />
									<span class="text-xs font-black text-white">
										{c.model_name} × {c.backdrop_name}
									</span>
								</div>
								<button
									type="button"
									onClick={() => setSelectedCell(null)}
									class="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
								>
									<span class="material-symbols-outlined text-sm">close</span>
								</button>
							</div>

							<div class="grid grid-cols-2 gap-2 text-xs">
								<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
									<span class="text-[9px] text-white/40 uppercase block mb-0.5">
										{isRtl() ? 'کف قیمت تخمینی' : 'Estimated Floor'}
									</span>
									<div class="font-mono font-black text-white text-sm">
										{fmt(c.floor_gram)} TON
									</div>
									<span class="text-[10px] text-white/40 font-mono">
										{fmtUsd(c.floor_gram * rate())}
									</span>
								</div>

								<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
									<span class="text-[9px] text-white/40 uppercase block mb-0.5">
										{isRtl() ? 'کمیابی ترکیبی' : 'Combined Rarity'}
									</span>
									<div class="font-mono font-black text-sky-400 text-sm">
										{c.combined_rarity_pct.toFixed(3)}%
									</div>
									<span class={`text-[9px] font-bold px-1.5 py-0.2 rounded border inline-block mt-0.5 ${theme.badge}`}>
										{c.rarity_tier}
									</span>
								</div>
							</div>

							<button
								type="button"
								onClick={() => {
									navigate(`/gifts/report?g=${props.collectionSlug}-1`);
									try {
										haptic.impact('light');
									} catch {}
								}}
								class="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0098EA] to-[#0081C8] hover:brightness-110 text-white font-black text-xs text-center shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
							>
								<span>{isRtl() ? 'کارشناسی و صدور شناسنامه این مدل' : 'Inspect & Certify Model'}</span>
								<span class="material-symbols-outlined text-sm rtl:rotate-180">arrow_forward</span>
							</button>
						</div>
					);
				})()}
			</Show>
		</div>
	);
};
