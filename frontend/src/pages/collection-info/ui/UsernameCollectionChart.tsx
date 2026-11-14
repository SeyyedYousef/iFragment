import { type Component, createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { apiClient as api } from '@/shared/api/axios.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	currentFloorTon?: number;
	totalVolumeTon?: string;
	tonUsdRate?: number;
}

type Timeframe = '24h' | '7d' | '30d' | 'all';
type MetricMode = 'floor' | 'median' | 'volume';

interface ChartPoint {
	timestamp: string;
	label: string;
	floorTon: number;
	floorUsd: number;
	medianTon: number;
	medianUsd: number;
	volumeTon: number;
	volumeUsd: number;
	salesCount: number;
}

interface HistoryResponse {
	timeframe: string;
	points?: Array<{
		timestamp: string;
		label: string;
		floor_ton: number;
		median_ton?: number;
		volume_ton: number;
		sales_count?: number;
	}>;
}

const TonCrystalSvg: Component<{ class?: string }> = (props) => (
	<svg viewBox="0 0 24 24" fill="none" class={props.class || 'w-4 h-4 shrink-0'} aria-hidden="true">
		<circle cx="12" cy="12" r="11" fill="#2990FF" />
		<path
			d="M7.6 8.2H16.4C17.05 8.2 17.46 8.9 17.13 9.47L12.73 17.1C12.41 17.66 11.59 17.66 11.27 17.1L6.87 9.47C6.54 8.9 6.95 8.2 7.6 8.2Z"
			stroke="white"
			stroke-width="1.65"
			stroke-linejoin="round"
		/>
		<path d="M12 8.3V17.2" stroke="white" stroke-width="1.5" stroke-linecap="round" />
	</svg>
);

export const UsernameCollectionChart: Component<Props> = (props) => {
	const [timeframe, setTimeframe] = createSignal<Timeframe>('30d');
	const [metricMode, setMetricMode] = createSignal<MetricMode>('floor');
	const [currency, setCurrency] = createSignal<'ton' | 'usd'>('ton');
	const [hoverIdx, setHoverIdx] = createSignal<number | null>(null);

	const [historyData] = createResource(timeframe, async (tf) => {
		try {
			const res = await api.get<HistoryResponse>(`/usernames/collection/history?timeframe=${tf}`);
			return res.data?.points || [];
		} catch {
			return [];
		}
	});

	const chartPoints = createMemo<ChartPoint[]>(() => {
		const raw = historyData() || [];
		if (raw.length === 0) return [];
		const usdRate = props.tonUsdRate || 5.25;
		return raw.map((p) => {
			const med = p.median_ton && p.median_ton > 0 ? p.median_ton : p.floor_ton;
			return {
				timestamp: p.timestamp,
				label: p.label,
				floorTon: p.floor_ton,
				floorUsd: p.floor_ton * usdRate,
				medianTon: med,
				medianUsd: med * usdRate,
				volumeTon: p.volume_ton,
				volumeUsd: p.volume_ton * usdRate,
				salesCount: p.sales_count || 0,
			};
		});
	});

	const width = 520;
	const height = 186;
	const padding = { top: 20, bottom: 30, left: 8, right: 8 };

	const activePoints = createMemo(() => {
		const pts = chartPoints();
		if (pts.length === 0) return [];
		const isUsd = currency() === 'usd';
		const mode = metricMode();

		const vals = pts.map((p) => {
			if (mode === 'volume') return isUsd ? p.volumeUsd : p.volumeTon;
			if (mode === 'median') return isUsd ? p.medianUsd : p.medianTon;
			return isUsd ? p.floorUsd : p.floorTon;
		});

		const min = Math.min(...vals) * 0.94;
		const max = Math.max(...vals) * 1.05;
		const range = max - min || 1;
		const plotW = width - padding.left - padding.right;
		const plotH = height - padding.top - padding.bottom;

		return pts.map((p, idx) => {
			const val = vals[idx];
			const x = padding.left + (idx / Math.max(1, pts.length - 1)) * plotW;
			const y = padding.top + plotH - ((val - min) / range) * plotH;
			return { ...p, val, x, y };
		});
	});

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

		const bottomY = height - padding.bottom + 4;
		const last = pts[pts.length - 1];
		const first = pts[0];
		const area = `${line} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;

		return { line, area };
	});

	const currentPoint = createMemo(() => {
		const pts = activePoints();
		if (pts.length === 0) return null;
		const idx = hoverIdx();
		if (idx !== null && idx >= 0 && idx < pts.length) {
			return pts[idx];
		}
		return pts[pts.length - 1];
	});

	const deltaPct = createMemo(() => {
		const pts = activePoints();
		if (pts.length < 2) return 0;
		const s = pts[0].val;
		const e = pts[pts.length - 1].val;
		if (s <= 0) return 0;
		return ((e - s) / s) * 100;
	});

	const fmtNumberOnly = (val?: number) => {
		if (val === undefined || val === null) return '0';
		const isUsd = currency() === 'usd';
		if (val >= 1_000_000) {
			return isUsd ? `$${(val / 1_000_000).toFixed(2)}M` : `${(val / 1_000_000).toFixed(2)}M`;
		}
		if (val >= 10_000) {
			return isUsd ? `$${(val / 1_000).toFixed(1)}K` : `${(val / 1_000).toFixed(1)}K`;
		}
		if (isUsd) {
			return `$${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
		}
		return val.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const accentColor = () => {
		if (metricMode() === 'median') return '#32D74B';
		if (metricMode() === 'volume') return '#FF9F0A';
		return '#2990FF';
	};

	const handlePointerMove = (e: MouseEvent | TouchEvent) => {
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
		const ratio = relX / rect.width;
		const pts = activePoints();
		if (pts.length === 0) return;
		const idx = Math.round(ratio * (pts.length - 1));
		if (idx !== hoverIdx()) {
			setHoverIdx(idx);
			try {
				haptic.selection();
			} catch {}
		}
	};

	const handlePointerLeave = () => {
		setHoverIdx(null);
	};

	return (
		<div class="frag-card p-4 sm:p-5 space-y-3.5 relative overflow-hidden font-frag-sans">
			{/* Top Bar: Fragment-style Segmented Mode + Currency/Timeframe */}
			<div class="flex items-center justify-between gap-2 flex-wrap border-b border-white/[0.06] pb-3">
				<div class="flex items-center gap-1 p-1 bg-[#141a22] border border-white/[0.06] rounded-[10px]">
					{(
						[
							{ id: 'floor', label: t('usernameCollectionChart.floorTab') },
							{ id: 'median', label: t('usernameCollectionChart.medianTab') },
							{ id: 'volume', label: t('usernameCollectionChart.volumeTab') },
						] as const
					).map((m) => (
						<button
							type="button"
							onClick={() => {
								setMetricMode(m.id);
								try {
									haptic.selection();
								} catch {}
							}}
							class={`px-2.5 py-1 rounded-[7px] text-[11px] font-semibold transition-all ${
								metricMode() === m.id
									? 'bg-[#2990FF] text-white shadow-sm'
									: 'text-[#8c9ba5] hover:text-white'
							}`}
						>
							{m.label}
						</button>
					))}
				</div>

				{/* Currency & Timeframe Controls */}
				<div class="flex items-center gap-1.5">
					<div class="flex items-center gap-0.5 p-0.5 bg-[#141a22] border border-white/[0.06] rounded-[9px] text-[10px] font-frag-mono font-semibold">
						<button
							type="button"
							onClick={() => {
								setCurrency('ton');
								try {
									haptic.selection();
								} catch {}
							}}
							class={`px-2 py-1 rounded-[6px] transition-all ${
								currency() === 'ton'
									? 'bg-[#212b37] text-white border border-white/10'
									: 'text-[#8c9ba5] hover:text-white'
							}`}
						>
							{'TON'}
						</button>
						<button
							type="button"
							onClick={() => {
								setCurrency('usd');
								try {
									haptic.selection();
								} catch {}
							}}
							class={`px-2 py-1 rounded-[6px] transition-all ${
								currency() === 'usd'
									? 'bg-[#212b37] text-white border border-white/10'
									: 'text-[#8c9ba5] hover:text-white'
							}`}
						>
							{'USD'}
						</button>
					</div>

					<div class="flex items-center gap-0.5 p-0.5 bg-[#141a22] border border-white/[0.06] rounded-[9px] text-[10px] font-frag-mono">
						{(['24h', '7d', '30d', 'all'] as Timeframe[]).map((tf) => (
							<button
								type="button"
								onClick={() => {
									setTimeframe(tf);
									setHoverIdx(null);
									try {
										haptic.selection();
									} catch {}
								}}
								class={`px-2 py-1 rounded-[6px] font-semibold transition-all ${
									timeframe() === tf
										? 'bg-[#2990FF]/20 text-[#2990FF] border border-[#2990FF]/35'
										: 'text-[#8c9ba5] hover:text-white'
								}`}
							>
								{tf.toUpperCase()}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Active Value Readout with Authentic TON Crystal Icon */}
			<div class="flex items-end justify-between gap-2">
				<div class="flex flex-col gap-1">
					<div class="flex items-center gap-2" dir="ltr">
						<Show when={currency() === 'ton'}>
							<TonCrystalSvg class="w-5 h-5" />
						</Show>
						<span class="text-2xl sm:text-[28px] font-bold text-white font-frag-mono tracking-tight tabular-nums leading-none">
							{fmtNumberOnly(currentPoint()?.val)}
						</span>
						<Show when={currency() === 'ton'}>
							<span class="text-xs font-frag-mono font-semibold text-[#8c9ba5]">{'TON'}</span>
						</Show>
						<span
							class={`text-[11px] font-frag-mono font-semibold px-2 py-0.5 rounded-[6px] border ${
								deltaPct() >= 0
									? 'bg-[#32d74b]/12 text-[#32d74b] border-[#32d74b]/25'
									: 'bg-rose-500/12 text-rose-400 border-rose-500/25'
							}`}
						>
							{deltaPct() >= 0 ? '+' : ''}
							{deltaPct().toFixed(1)}%
						</span>
					</div>

					<div class="text-[11px] text-[#8c9ba5] font-frag-mono flex items-center flex-wrap gap-2">
						<Show
							when={currentPoint()}
							fallback={<span>{t('usernameCollectionChart.verifiedSub')}</span>}
						>
							<span class="text-white/90 font-semibold">{currentPoint()?.label}</span>
							<span class="text-white/20">·</span>
							<span>
								{t('usernameCollectionChart.volumeLabel')}:{' '}
								<strong class="text-white font-semibold">
									{Math.round(currentPoint()?.volumeTon || 0).toLocaleString()} TON
								</strong>
							</span>
							<Show when={(currentPoint()?.salesCount || 0) > 0}>
								<span class="text-white/20">·</span>
								<span>
									<strong class="text-[#32d74b]">{currentPoint()?.salesCount}</strong>{' '}
									{t('usernameCollectionChart.salesLabel')}
								</span>
							</Show>
						</Show>
					</div>
				</div>
			</div>

			{/* SVG Interactive Orderbook Chart Canvas */}
			<div
				class="relative w-full h-[176px] rounded-[10px] border border-white/[0.06] bg-[#141a22] p-2 overflow-hidden select-none flex items-center justify-center cursor-crosshair"
				onMouseMove={handlePointerMove}
				onTouchMove={handlePointerMove}
				onMouseLeave={handlePointerLeave}
				onTouchEnd={handlePointerLeave}
			>
				<Show
					when={activePoints().length > 0}
					fallback={
						<div class="text-center">
							<div class="text-[#8c9ba5] text-xs font-frag-mono">
								{t('collectionInfo.noHistoryAvailable')}
							</div>
						</div>
					}
				>
					<svg
						viewBox={`0 0 ${width} ${height}`}
						class="w-full h-full overflow-visible"
						preserveAspectRatio="none"
					>
						<defs>
							<linearGradient id="fragAreaGrad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color={accentColor()} stop-opacity="0.26" />
								<stop offset="70%" stop-color={accentColor()} stop-opacity="0.04" />
								<stop offset="100%" stop-color={accentColor()} stop-opacity="0.0" />
							</linearGradient>
						</defs>

						{/* Subtle Horizontal Reference Grid Lines */}
						<line
							x1={padding.left}
							y1={padding.top}
							x2={width - padding.right}
							y2={padding.top}
							stroke="rgba(255,255,255,0.045)"
							stroke-dasharray="3 3"
						/>
						<line
							x1={padding.left}
							y1={height / 2}
							x2={width - padding.right}
							y2={height / 2}
							stroke="rgba(255,255,255,0.045)"
							stroke-dasharray="3 3"
						/>
						<line
							x1={padding.left}
							y1={height - padding.bottom + 4}
							x2={width - padding.right}
							y2={height - padding.bottom + 4}
							stroke="rgba(255,255,255,0.06)"
						/>

						{/* Subtle Volume Histogram Bars */}
						<For each={activePoints()}>
							{(pt) => {
								const maxVol = Math.max(...activePoints().map((p) => p.volumeTon), 1);
								const barH = Math.min(26, Math.max(2, (pt.volumeTon / maxVol) * 26));
								const barY = height - padding.bottom + 4 - barH;
								return (
									<rect
										x={pt.x - 2.5}
										y={barY}
										width="5"
										height={barH}
										rx="1.5"
										fill="rgba(41, 144, 255, 0.18)"
									/>
								);
							}}
						</For>

						{/* Area Fill */}
						<Show when={svgPaths().area}>
							<path d={svgPaths().area} fill="url(#fragAreaGrad)" />
						</Show>

						{/* Main Price/Volume Curve */}
						<Show when={svgPaths().line}>
							<path
								d={svgPaths().line}
								fill="none"
								stroke={accentColor()}
								stroke-width="2.2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</Show>

						{/* Active Crosshair */}
						<Show when={currentPoint()}>
							{(() => {
								const cp = currentPoint()!;
								return (
									<g>
										<line
											x1={cp.x}
											y1={padding.top - 4}
											x2={cp.x}
											y2={height - padding.bottom + 4}
											stroke={accentColor()}
											stroke-width="1.2"
											stroke-dasharray="3 3"
											opacity="0.75"
										/>
										<circle
											cx={cp.x}
											cy={cp.y}
											r="4.5"
											fill="#141a22"
											stroke={accentColor()}
											stroke-width="2.2"
										/>
									</g>
								);
							})()}
						</Show>
					</svg>

					{/* Floating Fragment Tooltip */}
					<Show when={hoverIdx() !== null && currentPoint()}>
						{(() => {
							const cp = currentPoint()!;
							const isRightHalf = cp.x > width / 2;
							return (
								<div
									class="absolute pointer-events-none transition-transform duration-75 z-30"
									style={{
										left: `${(cp.x / width) * 100}%`,
										top: `${Math.max(16, Math.min(125, (cp.y / height) * 100))}%`,
										transform: `translate(${isRightHalf ? '-108%' : '8%'}, -50%)`,
									}}
								>
									<div class="bg-[#1b232d]/95 border border-white/15 rounded-[8px] px-2.5 py-1.5 shadow-xl backdrop-blur-md text-[10px] font-frag-mono whitespace-nowrap">
										<div class="text-white font-bold text-[11px]">
											{fmtNumberOnly(cp.val)} {currency() === 'ton' ? 'TON' : ''}
										</div>
										<div class="text-[#8c9ba5] text-[9px] mt-0.5">
											{cp.label} · {cp.salesCount} {t('usernameCollectionChart.salesLabel')}
										</div>
									</div>
								</div>
							);
						})()}
					</Show>

					{/* Time Bounds Footer */}
					<div
						class="absolute bottom-1.5 left-3 right-3 flex justify-between text-[10px] font-frag-mono text-[#60707c] pointer-events-none"
						dir="ltr"
					>
						<span>{activePoints()[0]?.label || ''}</span>
						<span class="text-[#2990FF] font-semibold">
							{activePoints()[activePoints().length - 1]?.label || 'LIVE'}
						</span>
					</div>
				</Show>
			</div>
		</div>
	);
};
