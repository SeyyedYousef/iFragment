import { type Component, createMemo, createResource, createSignal, For, Show } from 'solid-js';
import { apiClient as api } from '@/shared/api/axios.js';
import { locale, t } from '@/shared/i18n/index.js';
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

const CHART_COPY: Record<
	string,
	{
		floorTab: string;
		medianTab: string;
		volumeTab: string;
		salesLabel: string;
		volumeLabel: string;
		medianLabel: string;
		floorLabel: string;
		verifiedSub: string;
	}
> = {
	fa: {
		floorTab: 'کف قیمت',
		medianTab: 'میانه فروش',
		volumeTab: 'حجم معاملات',
		salesLabel: 'تعداد فروش',
		volumeLabel: 'حجم',
		medianLabel: 'میانه',
		floorLabel: 'کف',
		verifiedSub: 'داده‌های واقعی بلاکچین TON و فرگمنت',
	},
	en: {
		floorTab: 'Floor',
		medianTab: 'Median',
		volumeTab: 'Volume',
		salesLabel: 'Sales',
		volumeLabel: 'Vol',
		medianLabel: 'Median',
		floorLabel: 'Floor',
		verifiedSub: 'Live TON TeleMint & Fragment Index',
	},
	ru: {
		floorTab: 'Флор',
		medianTab: 'Медиана',
		volumeTab: 'Объём',
		salesLabel: 'Сделки',
		volumeLabel: 'Объём',
		medianLabel: 'Медиана',
		floorLabel: 'Флор',
		verifiedSub: 'Ончейн-данные TON TeleMint и Fragment',
	},
	zh: {
		floorTab: '地板价',
		medianTab: '中位成交',
		volumeTab: '交易量',
		salesLabel: '成交笔数',
		volumeLabel: '交易量',
		medianLabel: '中位数',
		floorLabel: '地板价',
		verifiedSub: 'TON TeleMint 与 Fragment 链上实盘数据',
	},
};

export const UsernameCollectionChart: Component<Props> = (props) => {
	const [timeframe, setTimeframe] = createSignal<Timeframe>('30d');
	const [metricMode, setMetricMode] = createSignal<MetricMode>('floor');
	const [currency, setCurrency] = createSignal<'ton' | 'usd'>('ton');
	const [hoverIdx, setHoverIdx] = createSignal<number | null>(null);

	const copy = () => CHART_COPY[locale()] || CHART_COPY.fa;

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
		const usdRate = props.tonUsdRate || 0;
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

	const width = 500;
	const height = 190;
	const padding = { top: 22, bottom: 34, left: 10, right: 10 };

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
		const max = Math.max(...vals) * 1.06;
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

		const bottomY = height - padding.bottom + 5;
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

	const fmtVal = (val?: number) => {
		if (val === undefined || val === null) return '0';
		const isUsd = currency() === 'usd';
		if (val >= 1_000_000) {
			return isUsd ? `$${(val / 1_000_000).toFixed(2)}M` : `${(val / 1_000_000).toFixed(2)}M TON`;
		}
		if (val >= 1_000) {
			return isUsd ? `$${(val / 1_000).toFixed(1)}K` : `${(val / 1_000).toFixed(1)}K TON`;
		}
		if (isUsd) {
			return `$${val.toFixed(2)}`;
		}
		return `${val.toFixed(2)} TON`;
	};

	const accentColor = () => {
		if (metricMode() === 'median') return '#10B981';
		if (metricMode() === 'volume') return '#F59E0B';
		return '#0098EA';
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
		<div class="bg-[#0B0E17]/95 backdrop-blur-2xl border border-white/10 rounded-[24px] p-4 sm:p-5 shadow-2xl space-y-3.5 relative overflow-hidden">
			{/* Top Metric Mode Switcher */}
			<div class="flex items-center justify-between gap-2 flex-wrap">
				<div class="flex items-center gap-1 p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl">
					{(
						[
							{ id: 'floor', label: copy().floorTab, icon: 'trending_down' },
							{ id: 'median', label: copy().medianTab, icon: 'equalizer' },
							{ id: 'volume', label: copy().volumeTab, icon: 'bar_chart' },
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
							class={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 ${
								metricMode() === m.id
									? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/30'
									: 'text-white/45 hover:text-white/80'
							}`}
						>
							<span class="material-symbols-outlined text-[13px]">{m.icon}</span>
							<span>{m.label}</span>
						</button>
					))}
				</div>

				{/* Currency & Timeframe Controls */}
				<div class="flex items-center gap-1.5">
					<div class="flex items-center gap-0.5 p-0.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[10px] font-bold font-mono">
						<button
							type="button"
							onClick={() => {
								setCurrency('ton');
								try {
									haptic.selection();
								} catch {}
							}}
							class={`px-2 py-0.5 rounded-lg transition-all ${
								currency() === 'ton'
									? 'bg-[#0098EA] text-white shadow'
									: 'text-white/40 hover:text-white'
							}`}
						>
							TON
						</button>
						<button
							type="button"
							onClick={() => {
								setCurrency('usd');
								try {
									haptic.selection();
								} catch {}
							}}
							class={`px-2 py-0.5 rounded-lg transition-all ${
								currency() === 'usd'
									? 'bg-[#0098EA] text-white shadow'
									: 'text-white/40 hover:text-white'
							}`}
						>
							USD
						</button>
					</div>

					<div class="flex items-center gap-0.5 p-0.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[10px] font-mono">
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
								class={`px-2 py-0.5 rounded-lg font-bold transition-all ${
									timeframe() === tf
										? 'bg-white/15 text-white shadow'
										: 'text-white/40 hover:text-white/80'
								}`}
							>
								{tf.toUpperCase()}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Active Value Readout */}
			<div class="flex items-end justify-between gap-2 pt-0.5">
				<div>
					<div class="flex items-baseline gap-2" dir="ltr">
						<span class="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight tabular-nums">
							{fmtVal(currentPoint()?.val)}
						</span>
						<span
							class={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
								deltaPct() >= 0
									? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
									: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
							}`}
						>
							{deltaPct() >= 0 ? '+' : ''}
							{deltaPct().toFixed(1)}%
						</span>
					</div>

					<div class="text-[10px] text-white/45 font-mono mt-1 flex items-center flex-wrap gap-2">
						<Show when={currentPoint()} fallback={<span>{copy().verifiedSub}</span>}>
							<span class="text-[#0098EA] font-bold">{currentPoint()?.label}</span>
							<span class="text-white/20">•</span>
							<span>
								{copy().volumeLabel}:{' '}
								<strong class="text-white/80">
									{Math.round(currentPoint()?.volumeTon || 0).toLocaleString()} TON
								</strong>
							</span>
							<Show when={(currentPoint()?.salesCount || 0) > 0}>
								<span class="text-white/20">•</span>
								<span>
									{copy().salesLabel}:{' '}
									<strong class="text-emerald-400">{currentPoint()?.salesCount}</strong>
								</span>
							</Show>
						</Show>
					</div>
				</div>
			</div>

			{/* SVG Interactive Canvas */}
			<div
				class="relative w-full h-[180px] rounded-2xl border border-white/[0.07] bg-[#06080E]/90 p-2 overflow-hidden select-none flex items-center justify-center"
				onMouseMove={handlePointerMove}
				onTouchMove={handlePointerMove}
				onMouseLeave={handlePointerLeave}
				onTouchEnd={handlePointerLeave}
			>
				<Show
					when={activePoints().length > 0}
					fallback={
						<div class="text-center">
							<div class="text-white/40 text-xs font-mono mb-1">
								{t('collectionInfo.noHistoryAvailable') || 'در حال همگام‌سازی تاریخچه معاملات...'}
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
							<linearGradient id="usernameAreaGrad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color={accentColor()} stop-opacity="0.32" />
								<stop offset="65%" stop-color={accentColor()} stop-opacity="0.06" />
								<stop offset="100%" stop-color={accentColor()} stop-opacity="0.0" />
							</linearGradient>
							<filter id="usernameNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
								<feGaussianBlur stdDeviation="3" result="blur" />
								<feMerge>
									<feMergeNode in="blur" />
									<feMergeNode in="SourceGraphic" />
								</feMerge>
							</filter>
						</defs>

						{/* Grid Lines */}
						<line
							x1={padding.left}
							y1={padding.top}
							x2={width - padding.right}
							y2={padding.top}
							stroke="rgba(255,255,255,0.05)"
							stroke-dasharray="3 3"
						/>
						<line
							x1={padding.left}
							y1={height / 2}
							x2={width - padding.right}
							y2={height / 2}
							stroke="rgba(255,255,255,0.05)"
							stroke-dasharray="3 3"
						/>
						<line
							x1={padding.left}
							y1={height - padding.bottom + 5}
							x2={width - padding.right}
							y2={height - padding.bottom + 5}
							stroke="rgba(255,255,255,0.05)"
						/>

						{/* Volume Bars */}
						<For each={activePoints()}>
							{(pt) => {
								const maxVol = Math.max(...activePoints().map((p) => p.volumeTon), 1);
								const barH = Math.min(28, Math.max(3, (pt.volumeTon / maxVol) * 28));
								const barY = height - padding.bottom + 5 - barH;
								return (
									<rect
										x={pt.x - 3}
										y={barY}
										width="6"
										height={barH}
										rx="2"
										fill="rgba(0, 152, 234, 0.22)"
									/>
								);
							}}
						</For>

						{/* Area Fill */}
						<Show when={svgPaths().area}>
							<path d={svgPaths().area} fill="url(#usernameAreaGrad)" />
						</Show>

						{/* Main Curve */}
						<Show when={svgPaths().line}>
							<path
								d={svgPaths().line}
								fill="none"
								stroke={accentColor()}
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								filter="url(#usernameNeonGlow)"
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
											y1={padding.top - 5}
											x2={cp.x}
											y2={height - padding.bottom + 5}
											stroke={accentColor()}
											stroke-width="1.5"
											stroke-dasharray="3 3"
											opacity="0.85"
										/>
										<circle
											cx={cp.x}
											cy={cp.y}
											r="7"
											fill={accentColor()}
											opacity="0.3"
											class="animate-ping"
										/>
										<circle
											cx={cp.x}
											cy={cp.y}
											r="5"
											fill="#0A0E17"
											stroke={accentColor()}
											stroke-width="2.5"
										/>
										<circle cx={cp.x} cy={cp.y} r="2.5" fill="#FFFFFF" />
									</g>
								);
							})()}
						</Show>
					</svg>

					{/* Floating Tooltip */}
					<Show when={hoverIdx() !== null && currentPoint()}>
						{(() => {
							const cp = currentPoint()!;
							const isRightHalf = cp.x > width / 2;
							return (
								<div
									class="absolute pointer-events-none transition-transform duration-75 z-30"
									style={{
										left: `${(cp.x / width) * 100}%`,
										top: `${Math.max(16, Math.min(130, (cp.y / height) * 100))}%`,
										transform: `translate(${isRightHalf ? '-110%' : '10%'}, -50%)`,
									}}
								>
									<div class="bg-[#0b101c]/95 border border-[#0098EA]/40 rounded-xl px-2.5 py-1.5 shadow-2xl backdrop-blur-md text-[10px] font-mono whitespace-nowrap">
										<div class="text-white font-black text-xs">{fmtVal(cp.val)}</div>
										<div class="text-white/60 text-[9px] mt-0.5">
											{cp.label} • {cp.salesCount} {copy().salesLabel}
										</div>
									</div>
								</div>
							);
						})()}
					</Show>

					{/* Time Bounds */}
					<div
						class="absolute bottom-1 left-3 right-3 flex justify-between text-[9px] font-mono text-white/35 pointer-events-none"
						dir="ltr"
					>
						<span>{activePoints()[0]?.label || ''}</span>
						<span class="text-[#0098EA] font-semibold">
							{activePoints()[activePoints().length - 1]?.label || 'LIVE'}
						</span>
					</div>
				</Show>
			</div>
		</div>
	);
};
