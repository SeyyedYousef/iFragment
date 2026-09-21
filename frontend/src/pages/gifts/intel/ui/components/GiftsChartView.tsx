import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import type { GiftsIntelResponse } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { GiftsMacroStats } from './GiftsMacroStats.js';

interface Props {
	intel?: GiftsIntelResponse;
	isLoading?: boolean;
}

type Timeframe = '24h' | '7d' | '30d' | '1y';

interface ChartPoint {
	label: string;
	timestamp: string;
	mcapUsd: number;
	mcapGram: number;
	volumeUsd: number;
	volumeGram: number;
}

export const GiftsChartView: Component<Props> = (props) => {
	const [chartCurrency, setChartCurrency] = createSignal<'usd' | 'gram'>('usd');
	const [timeframe, setTimeframe] = createSignal<Timeframe>('30d');
	const [hoverIndex, setHoverIndex] = createSignal<number | null>(null);

	// Real values from API telemetry
	const mcapUsd = () => props.intel?.total_market_cap_usd || 0;
	const mcapGram = () => props.intel?.total_market_cap_gram || 0;
	const volumeUsd = () => props.intel?.total_cumulative_volume_usd || 0;
	const volumeGram = () => props.intel?.total_cumulative_volume_gram || 0;
	const tonRate = () => props.intel?.ton_usd_rate || 0;

	// Populate chart points from real macro_history provided by API
	const chartData = createMemo<ChartPoint[]>(() => {
		const raw = props.intel?.macro_history || [];
		if (raw.length === 0) {
			// If no time series history yet, fallback to single live point if current market cap exists
			const curUsd = mcapUsd();
			const curGram = mcapGram() > 0 ? mcapGram() : (tonRate() > 0 ? curUsd / tonRate() : 0);
			if (curUsd > 0) {
				return [
					{
						label: 'Today',
						timestamp: new Date().toISOString(),
						mcapUsd: curUsd,
						mcapGram: curGram,
						volumeUsd: volumeUsd(),
						volumeGram: volumeGram() > 0 ? volumeGram() : (tonRate() > 0 ? volumeUsd() / tonRate() : 0),
					},
				];
			}
			return [];
		}

		// Filter by timeframe
		let filtered = [...raw];
		const tf = timeframe();
		if (tf === '24h') {
			filtered = raw.slice(-2);
		} else if (tf === '7d') {
			filtered = raw.slice(-7);
		} else if (tf === '30d') {
			filtered = raw.slice(-30);
		}

		return filtered.map((pt) => {
			const d = new Date(pt.timestamp);
			const label = !isNaN(d.getTime()) ? `${d.getMonth() + 1}/${d.getDate()}` : pt.timestamp;
			return {
				label,
				timestamp: pt.timestamp,
				mcapUsd: pt.mcap_usd,
				mcapGram: pt.mcap_gram,
				volumeUsd: pt.volume_usd,
				volumeGram: pt.volume_gram,
			};
		});
	});

	// SVG Coordinates & Bezier Spline
	const width = 500;
	const height = 180;
	const padding = { top: 20, bottom: 35, left: 10, right: 10 };

	const activePoints = createMemo(() => {
		const data = chartData();
		if (data.length === 0) return [];
		const isGram = chartCurrency() === 'gram';
		const values = data.map((d) => (isGram ? d.mcapGram : d.mcapUsd));
		const min = Math.min(...values) * 0.98;
		const max = Math.max(...values) * 1.02;
		const range = max - min || 1;

		const plotW = width - padding.left - padding.right;
		const plotH = height - padding.top - padding.bottom;

		return data.map((d, idx) => {
			const val = isGram ? d.mcapGram : d.mcapUsd;
			const x = padding.left + (idx / (data.length - 1)) * plotW;
			const y = padding.top + plotH - ((val - min) / range) * plotH;
			return { ...d, x, y, value: val };
		});
	});

	// Smooth SVG Bezier Path
	const svgPaths = createMemo(() => {
		const pts = activePoints();
		if (pts.length < 2) return { line: '', area: '' };

		let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[i === 0 ? 0 : i - 1];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[i + 2] || p2;

			const cp1x = p1.x + (p2.x - p0.x) / 6;
			const cp1y = p1.y + (p2.y - p0.y) / 6;
			const cp2x = p2.x - (p3.x - p1.x) / 6;
			const cp2y = p2.y - (p3.y - p1.y) / 6;

			line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
		}

		const bottomY = height - padding.bottom + 10;
		const last = pts[pts.length - 1];
		const first = pts[0];
		const area = `${line} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;

		return { line, area };
	});

	// Currently hovered or last point
	const currentPoint = createMemo(() => {
		const pts = activePoints();
		if (pts.length === 0) return null;
		const idx = hoverIndex();
		if (idx !== null && idx >= 0 && idx < pts.length) {
			return pts[idx];
		}
		return pts[pts.length - 1];
	});

	// 24h Delta
	const deltaPercent = createMemo(() => {
		const pts = activePoints();
		if (pts.length < 2) return 0;
		const start = pts[0].value;
		const end = pts[pts.length - 1].value;
		if (start <= 0) return 0;
		return ((end - start) / start) * 100;
	});

	const formatVal = (val?: number) => {
		if (!val || val <= 0) return '—';
		const isGram = chartCurrency() === 'gram';
		if (isGram) {
			return `${(val / 1_000_000).toFixed(2)}M TON`;
		}
		return `$${(val / 1_000_000).toFixed(2)}M`;
	};

	const formatVol = (val?: number) => {
		if (!val || val <= 0) return '—';
		const isGram = chartCurrency() === 'gram';
		if (isGram) {
			return `${(val / 1_000).toFixed(0)}k TON`;
		}
		return `$${(val / 1_000).toFixed(0)}k`;
	};

	// Mouse / Touch scrubber
	const handlePointerMove = (e: MouseEvent | TouchEvent) => {
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
		const ratio = relX / rect.width;
		const pts = activePoints();
		if (pts.length === 0) return;
		const idx = Math.round(ratio * (pts.length - 1));
		if (idx !== hoverIndex()) {
			setHoverIndex(idx);
			try {
				haptic.selection();
			} catch {}
		}
	};

	const handlePointerLeave = () => {
		setHoverIndex(null);
	};

	return (
		<div class="space-y-3.5">
			{/* Main Chart Terminal Container */}
			<div class="bg-gradient-to-b from-[#0e1320] to-[#080b12] border border-white/[0.09] rounded-[28px] p-4 sm:p-5 backdrop-blur-2xl shadow-2xl relative space-y-4 overflow-hidden">
				{/* Ambient Glow */}
				<div class="absolute top-0 right-1/4 w-64 h-32 bg-[#0098EA]/10 blur-3xl pointer-events-none" />

				{/* Top Title & Readout */}
				<div class="flex items-start justify-between relative z-10">
					<div>
						<div class="flex items-center gap-1.5 flex-wrap">
							<span class="text-xs uppercase font-extrabold text-[#0098EA] tracking-wider">
								{t('gifts.marketCap')}
							</span>
							<span
								class={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
									props.intel?.data_status === 'live'
										? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
										: props.intel?.data_status === 'delayed' || props.intel?.data_status === 'stale'
											? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
											: 'bg-white/10 text-white/60 border-white/20'
								}`}
							>
								<span
									class={`w-1.5 h-1.5 rounded-full ${
										props.intel?.data_status === 'live'
											? 'bg-emerald-400 animate-pulse'
											: 'bg-white/40'
									}`}
								/>
								<span>
									{props.intel?.data_status
										? props.intel.data_status.toUpperCase()
										: 'SNAPSHOT'}
								</span>
							</span>
							<Show when={props.intel?.updated_at}>
								<span class="text-[9px] text-white/40 font-mono">
									as of {new Date(props.intel!.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
								</span>
							</Show>
						</div>
						<div class="flex items-baseline gap-2.5 mt-1.5">
							<span class="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight tabular-nums drop-shadow-sm">
								{formatVal(
									currentPoint()?.value ||
										(chartCurrency() === 'gram'
											? (mcapGram() > 0 ? mcapGram() : (tonRate() > 0 ? mcapUsd() / tonRate() : 0))
											: mcapUsd())
								)}
							</span>
							<Show when={deltaPercent() !== 0}>
								<span
									class={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg border ${
										deltaPercent() >= 0
											? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
											: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
									}`}
								>
									{deltaPercent() >= 0 ? '+' : ''}
									{deltaPercent().toFixed(2)}%
								</span>
							</Show>
						</div>
						<div class="text-[11px] font-semibold text-white/50 mt-1 font-mono flex items-center gap-3">
							<span>
								Volume:{' '}
								<strong class="text-white/80">
									{formatVol(
										chartCurrency() === 'gram'
											? (currentPoint()?.volumeGram || (volumeGram() > 0 ? volumeGram() : (tonRate() > 0 ? volumeUsd() / tonRate() : 0)))
											: (currentPoint()?.volumeUsd || volumeUsd())
									)}
								</strong>
							</span>
							<Show when={hoverIndex() !== null && currentPoint()}>
								<span class="text-[#0098EA] font-mono">{currentPoint()?.label}</span>
							</Show>
						</div>
					</div>

					{/* Currency & Timeframe Toggles */}
					<div class="flex flex-col items-end gap-2 shrink-0">
						{/* Currency Toggle */}
						<div class="flex items-center gap-1 p-0.5 bg-white/[0.05] border border-white/10 rounded-xl">
							<button
								type="button"
								onClick={() => {
									setChartCurrency('usd');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
									chartCurrency() === 'usd'
										? 'bg-[#0098EA] text-white shadow-sm'
										: 'text-white/40 hover:text-white'
								}`}
							>
								USD
							</button>
							<button
								type="button"
								onClick={() => {
									setChartCurrency('gram');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
									chartCurrency() === 'gram'
										? 'bg-[#0098EA] text-white shadow-sm'
										: 'text-white/40 hover:text-white'
								}`}
							>
								TON
							</button>
						</div>

						{/* Timeframe Selector */}
						<div class="flex items-center gap-0.5 p-0.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[11px] font-mono">
							{(['24h', '7d', '30d', '1y'] as Timeframe[]).map((tf) => (
								<button
									type="button"
									onClick={() => {
										setTimeframe(tf);
										setHoverIndex(null);
										try {
											haptic.selection();
										} catch {}
									}}
									class={`px-2 py-0.5 rounded-lg font-bold transition-all ${
										timeframe() === tf
											? 'bg-white/15 text-white shadow-sm'
											: 'text-white/40 hover:text-white/80'
									}`}
								>
									{tf.toUpperCase()}
								</button>
							))}
						</div>
					</div>
				</div>

				{/* ═══ Interactive SVG Chart Area ═══ */}
				<div
					class="relative w-full h-[190px] rounded-2xl border border-white/[0.07] bg-black/40 p-2 overflow-hidden select-none cursor-crosshair touch-none"
					onMouseMove={handlePointerMove}
					onTouchMove={handlePointerMove}
					onMouseLeave={handlePointerLeave}
					onTouchEnd={handlePointerLeave}
				>
					<Show
						when={activePoints().length > 0}
						fallback={
							<div class="w-full h-full flex flex-col items-center justify-center text-center p-4">
								<span class="material-symbols-outlined text-3xl text-white/20 mb-1.5">
									query_stats
								</span>
								<p class="text-xs text-white/50 font-medium">
									{t('gifts.macroHistoryUnavailable') ||
										'Macro historical time-series indexing in progress'}
								</p>
								<span class="text-[10px] text-white/30 font-mono mt-1">
									Real-time snapshot: {formatVal(mcapUsd())}
								</span>
							</div>
						}
					>
						<svg
							viewBox={`0 0 ${width} ${height}`}
							class="w-full h-full overflow-visible"
							preserveAspectRatio="none"
						>
							<defs>
								<linearGradient id="chartGlowArea" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stop-color="#0098EA" stop-opacity="0.35" />
									<stop offset="60%" stop-color="#0098EA" stop-opacity="0.08" />
									<stop offset="100%" stop-color="#0098EA" stop-opacity="0.0" />
								</linearGradient>
								<filter id="neonStrokeGlow" x="-20%" y="-20%" width="140%" height="140%">
									<feGaussianBlur stdDeviation="3" result="blur" />
									<feMerge>
										<feMergeNode in="blur" />
										<feMergeNode in="SourceGraphic" />
									</feMerge>
								</filter>
							</defs>

							{/* Horizontal Reference Gridlines */}
							<line
								x1={padding.left}
								y1={padding.top}
								x2={width - padding.right}
								y2={padding.top}
								stroke="rgba(255,255,255,0.06)"
								stroke-dasharray="4 4"
							/>
							<line
								x1={padding.left}
								y1={height / 2}
								x2={width - padding.right}
								y2={height / 2}
								stroke="rgba(255,255,255,0.06)"
								stroke-dasharray="4 4"
							/>
							<line
								x1={padding.left}
								y1={height - padding.bottom + 5}
								x2={width - padding.right}
								y2={height - padding.bottom + 5}
								stroke="rgba(255,255,255,0.06)"
							/>

							{/* Volume Histogram Bars at Bottom */}
							<For each={activePoints()}>
								{(pt) => {
									const barH = Math.min(22, Math.max(4, (pt.volumeUsd / (volumeUsd() * 0.1)) * 14));
									const barY = height - padding.bottom + 5 - barH;
									return (
										<rect
											x={pt.x - 2.5}
											y={barY}
											width="5"
											height={barH}
											rx="1.5"
											fill="rgba(0, 152, 234, 0.18)"
											class="transition-all hover:fill-[#0098EA]/40"
										/>
									);
								}}
							</For>

							{/* Area Gradient Fill */}
							<Show when={svgPaths().area}>
								<path d={svgPaths().area} fill="url(#chartGlowArea)" />
							</Show>

							{/* Glowing Spline Line */}
							<Show when={svgPaths().line}>
								<path
									d={svgPaths().line}
									fill="none"
									stroke="#0098EA"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									filter="url(#neonStrokeGlow)"
								/>
							</Show>

							{/* Interactive Hover Crosshair & Indicator Point */}
							<Show when={currentPoint()}>
								{(() => {
									const cp = currentPoint()!;
									return (
										<g>
											{/* Vertical Crosshair Line */}
											<line
												x1={cp.x}
												y1={padding.top - 5}
												x2={cp.x}
												y2={height - padding.bottom + 5}
												stroke="#0098EA"
												stroke-width="1.5"
												stroke-dasharray="3 3"
												opacity="0.75"
											/>
											{/* Outer Pulsing Aura */}
											<circle
												cx={cp.x}
												cy={cp.y}
												r="7"
												fill="#0098EA"
												opacity="0.3"
												class="animate-ping"
											/>
											{/* Outer Ring */}
											<circle
												cx={cp.x}
												cy={cp.y}
												r="5"
												fill="#0A0E17"
												stroke="#0098EA"
												stroke-width="2.5"
											/>
											{/* Core Dot */}
											<circle cx={cp.x} cy={cp.y} r="2.5" fill="#FFFFFF" />
										</g>
									);
								})()}
							</Show>
						</svg>

						{/* Floating Scrubber Tooltip */}
						<Show when={hoverIndex() !== null && currentPoint()}>
							{(() => {
								const cp = currentPoint()!;
								const isRightHalf = cp.x > width / 2;
								return (
									<div
										class="absolute pointer-events-none transition-transform duration-75 z-30"
										style={{
											left: `${(cp.x / width) * 100}%`,
											top: `${Math.max(10, Math.min(130, (cp.y / height) * 100))}%`,
											transform: `translate(${isRightHalf ? '-110%' : '10%'}, -50%)`,
										}}
									>
										<div class="bg-[#0b101c]/95 border border-[#0098EA]/40 rounded-xl px-2.5 py-1.5 shadow-2xl backdrop-blur-md text-[10px] font-mono whitespace-nowrap">
											<div class="text-white font-bold text-xs">{formatVal(cp.value)}</div>
											<div class="text-white/50 text-[9px] flex items-center justify-between gap-2 mt-0.5">
												<span>{cp.label}</span>
												<span class="text-sky-400">{formatVol(cp.volumeUsd)} Vol</span>
											</div>
										</div>
									</div>
								);
							})()}
						</Show>

						{/* Time Axis Labels */}
						<div class="absolute bottom-1 left-3 right-3 flex justify-between text-[9px] font-mono text-white/30 pointer-events-none">
							<span>{chartData()[0]?.label || ''}</span>
							<span>{chartData()[Math.floor(chartData().length / 2)]?.label || ''}</span>
							<span class="text-[#0098EA] font-semibold">{t('gifts.now') || 'Now'}</span>
						</div>
					</Show>
				</div>
			</div>

			{/* Macro Ecosystem Statistics Bento Grid */}
			<GiftsMacroStats data={props.intel} currency={chartCurrency()} />

			{/* ═══════ Collection Discovery & Floor Board ═══════ */}
			<Show when={props.intel?.unified_floor_board && props.intel.unified_floor_board.length > 0}>
				<div class="bg-[#0e1320]/90 border border-white/[0.08] rounded-[24px] p-4 backdrop-blur-xl shadow-xl space-y-3">
					<div class="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#0098EA] text-base">grid_view</span>
							<span class="text-xs font-bold text-white tracking-wide">
								{t('gifts.unifiedFloorBoard') || 'Collection Discovery & Floor Board'}
							</span>
						</div>
						<span class="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
							Verified Market Depth
						</span>
					</div>

					<div class="overflow-x-auto scrollbar-none">
						<table class="w-full text-left rtl:text-right border-collapse text-xs">
							<thead>
								<tr class="border-b border-white/[0.06] text-[10px] text-white/40 uppercase font-mono">
									<th class="py-2 px-1">Collection</th>
									<th class="py-2 px-1 text-right rtl:text-left">Floor</th>
									<th class="py-2 px-1 text-center">24h</th>
									<th class="py-2 px-1 text-center">Venue</th>
									<th class="py-2 px-1 text-center">Status</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-white/[0.04]">
								<For each={props.intel?.unified_floor_board}>
									{(item) => (
										<tr class="hover:bg-white/[0.02] transition-colors">
											<td class="py-2.5 px-1 font-bold text-white flex items-center gap-2">
												<a
													href={`/gifts/collection?c=${item.model_id}`}
													class="hover:text-[#0098EA] transition-colors flex items-center gap-1.5"
												>
													<span>{item.name}</span>
													<Show when={item.has_real_volume_badge}>
														<span class="material-symbols-outlined text-[12px] text-emerald-400" title="Verified Volume in 7d">
															verified
														</span>
													</Show>
												</a>
											</td>
											<td class="py-2.5 px-1 text-right rtl:text-left font-mono font-bold text-white">
												{chartCurrency() === 'gram'
													? `${item.best_floor_gram.toLocaleString()} TON`
													: `$${item.best_floor_usd.toLocaleString()}`}
											</td>
											<td class="py-2.5 px-1 text-center font-mono">
												<span
													class={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
														item.price_change_24h_pct > 0
															? 'text-emerald-400 bg-emerald-500/10'
															: item.price_change_24h_pct < 0
																? 'text-rose-400 bg-rose-500/10'
																: 'text-white/40'
													}`}
												>
													{item.price_change_24h_pct > 0 ? '+' : ''}
													{item.price_change_24h_pct}%
												</span>
											</td>
											<td class="py-2.5 px-1 text-center">
												<span class="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-white/70">
													{item.best_venue_name || 'Fragment'}
												</span>
											</td>
											<td class="py-2.5 px-1 text-center">
												<span class="text-[9px] font-mono text-emerald-400 font-semibold">
													Active
												</span>
											</td>
										</tr>
									)}
								</For>
							</tbody>
						</table>
					</div>
				</div>
			</Show>

			{/* ═══════ Market Venues & Custody Architecture Table ═══════ */}
			<div class="bg-[#0e1320]/90 border border-white/[0.08] rounded-[24px] p-4 backdrop-blur-xl shadow-xl space-y-3">
				<div class="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-[#0098EA] text-base">storefront</span>
						<span class="text-xs font-bold text-white tracking-wide">
							{t('gifts.marketplaceComparison') || 'Marketplace Custody & Architecture'}
						</span>
					</div>
					<span class="text-[9px] font-mono text-white/50 bg-white/[0.05] px-2 py-0.5 rounded-full border border-white/[0.08]">
						Verified Adapters Only
					</span>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
					<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
						<div>
							<div class="font-bold text-white flex items-center gap-1.5">
								<span>Fragment</span>
								<span class="text-[9px] text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">On-Chain</span>
							</div>
							<div class="text-[10px] text-white/40 font-mono mt-0.5">Custody: Smart Contract (TEP-62)</div>
						</div>
						<span class="text-[10px] text-emerald-400 font-mono font-bold">Connected</span>
					</div>

					<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
						<div>
							<div class="font-bold text-white flex items-center gap-1.5">
								<span>Getgems</span>
								<span class="text-[9px] text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">On-Chain</span>
							</div>
							<div class="text-[10px] text-white/40 font-mono mt-0.5">Custody: Non-Custodial Marketplace</div>
						</div>
						<span class="text-[10px] text-emerald-400 font-mono font-bold">Connected</span>
					</div>

					<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
						<div>
							<div class="font-bold text-white/50 flex items-center gap-1.5">
								<span>Portals / Tonnel / MRKT</span>
								<span class="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">Mini App</span>
							</div>
							<div class="text-[10px] text-white/30 font-mono mt-0.5">Custody: Telegram Escrow / App</div>
						</div>
						<span class="text-[10px] text-white/40 font-mono">Adapter Inactive</span>
					</div>

					<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
						<div>
							<div class="font-bold text-white flex items-center gap-1.5">
								<span>Telegram Internal</span>
								<span class="text-[9px] text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">Native</span>
							</div>
							<div class="text-[10px] text-white/40 font-mono mt-0.5">Custody: Telegram MTProto Profile</div>
						</div>
						<span class="text-[10px] text-emerald-400 font-mono font-bold">Connected</span>
					</div>
				</div>
			</div>

			{/* ═══════ Methodology & Provenance Disclosure ═══════ */}
			<div class="bg-[#0e1320]/60 border border-white/[0.06] rounded-[20px] p-3.5 space-y-2 text-[11px]">
				<div class="flex items-center gap-2 text-white/70 font-bold">
					<span class="material-symbols-outlined text-sm text-[#0098EA]">info</span>
					<span>متدولوژی و شفافیت داده‌ها (Methodology & Provenance)</span>
				</div>
				<p class="text-white/40 text-[10px] leading-relaxed">
					ارزش بازار تخمینی (Implied Market Cap) بر اساس ضرب پایین‌ترین کف قیمت معتبر در عرضه کل کاتالوگ محاسبه شده و نشان‌دهنده نقدشوندگی کل نیست.
					ارقام حجم معاملات صرفاً معاملات تاییدشده بدون reorg را لحاظ می‌کنند و نقل و انتقالات عادی (Transfer) به عنوان معامله ثبت نمی‌شوند.
				</p>
			</div>
		</div>
	);
};
