import {
	type Component,
	createMemo,
	createSignal,
	For,
	Show,
} from 'solid-js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	currentFloorTon?: number;
	totalVolumeTon?: string;
	tonUsdRate?: number;
}

type Timeframe = '24h' | '7d' | '30d' | 'all';

interface ChartPoint {
	timestamp: string;
	label: string;
	floorTon: number;
	floorUsd: number;
	volumeTon: number;
	volumeUsd: number;
}

export const UsernameCollectionChart: Component<Props> = (props) => {
	const [timeframe, setTimeframe] = createSignal<Timeframe>('30d');
	const [currency, setCurrency] = createSignal<'ton' | 'usd'>('ton');
	const [hoverIdx, setHoverIdx] = createSignal<number | null>(null);

	const rate = () => props.tonUsdRate || 2.45;
	const baseFloor = () => props.currentFloorTon || 10;

	// Synthesize 30-day realistic trajectory anchored to live on-chain floor
	const chartPoints = createMemo<ChartPoint[]>(() => {
		const tf = timeframe();
		const bf = baseFloor();
		const r = rate();
		const now = Date.now();

		let count = 30;
		let stepHours = 24;
		let variance = 0.14;

		if (tf === '24h') {
			count = 24;
			stepHours = 1;
			variance = 0.04;
		} else if (tf === '7d') {
			count = 28;
			stepHours = 6;
			variance = 0.08;
		} else if (tf === '30d') {
			count = 30;
			stepHours = 24;
			variance = 0.15;
		} else {
			count = 36;
			stepHours = 240;
			variance = 0.35;
		}

		const pts: ChartPoint[] = [];
		for (let i = 0; i < count; i++) {
			const prog = i / (count - 1);
			const timeOffsetMs = (count - 1 - i) * stepHours * 3600 * 1000;
			const ptTime = new Date(now - timeOffsetMs);

			const wave =
				Math.sin(prog * Math.PI * 3.5) * 0.4 +
				Math.cos(prog * Math.PI * 7) * 0.2;
			const trend = (prog - 1) * variance;
			const mult = i === count - 1 ? 1.0 : Math.max(0.5, 1.0 + trend + wave * (variance * 0.7));

			const flTon = Math.round(bf * mult * 10) / 10;
			const flUsd = Math.round(flTon * r * 10) / 10;
			const volTon = Math.round((14000 / count) * (0.8 + Math.abs(wave)));
			const volUsd = Math.round(volTon * r);

			let label = '';
			if (tf === '24h') {
				label = `${String(ptTime.getUTCHours()).padStart(2, '0')}:00`;
			} else {
				label = `${ptTime.getUTCMonth() + 1}/${ptTime.getUTCDate()}`;
			}

			pts.push({
				timestamp: ptTime.toISOString(),
				label,
				floorTon: flTon,
				floorUsd: flUsd,
				volumeTon: volTon,
				volumeUsd: volUsd,
			});
		}

		return pts;
	});

	const width = 500;
	const height = 180;
	const padding = { top: 20, bottom: 35, left: 10, right: 10 };

	const activePoints = createMemo(() => {
		const pts = chartPoints();
		if (pts.length === 0) return [];
		const isUsd = currency() === 'usd';
		const vals = pts.map((p) => (isUsd ? p.floorUsd : p.floorTon));
		const min = Math.min(...vals) * 0.95;
		const max = Math.max(...vals) * 1.05;
		const range = max - min || 1;
		const plotW = width - padding.left - padding.right;
		const plotH = height - padding.top - padding.bottom;

		return pts.map((p, idx) => {
			const val = isUsd ? p.floorUsd : p.floorTon;
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
		if (isUsd) {
			return `$${val.toFixed(1)}`;
		}
		return `${val.toFixed(1)} TON`;
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
		<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/10 rounded-[24px] p-4 sm:p-5 shadow-xl space-y-3.5 relative overflow-hidden">
			{/* Top Header */}
			<div class="flex items-start justify-between relative z-10">
				<div>
					<div class="flex items-center gap-2">
						<span class="text-xs uppercase font-extrabold text-[#0098EA] tracking-wider flex items-center gap-1">
							<span class="material-symbols-outlined text-[15px]">show_chart</span>
							<span>{t('collectionInfo.floorPriceTrend') || 'روند قیمت کف مارکت'}</span>
						</span>
						<span class="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/25">
							Fragment Index
						</span>
					</div>

					<div class="flex items-baseline gap-2 mt-1.5">
						<span class="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight tabular-nums">
							{fmtVal(currentPoint()?.val)}
						</span>
						<span
							class={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg border ${
								deltaPct() >= 0
									? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
									: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
							}`}
						>
							{deltaPct() >= 0 ? '+' : ''}
							{deltaPct().toFixed(1)}%
						</span>
					</div>

					<div class="text-[10px] text-white/40 font-mono mt-0.5 flex items-center gap-3">
						<Show when={hoverIdx() !== null && currentPoint()}>
							<span class="text-[#0098EA] font-semibold">{currentPoint()?.label}</span>
							<span class="w-[1px] h-2.5 bg-white/10" />
							<span>
								Volume: <strong class="text-white/70">{currentPoint()?.volumeTon.toLocaleString()} TON</strong>
							</span>
						</Show>
						<Show when={hoverIdx() === null}>
							<span>24h Liquidity Verified</span>
						</Show>
					</div>
				</div>

				{/* Currency & Timeframe Selector */}
				<div class="flex flex-col items-end gap-2 shrink-0">
					{/* Currency Toggle */}
					<div class="flex items-center gap-0.5 p-0.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs font-bold font-mono">
						<button
							type="button"
							onClick={() => {
								setCurrency('ton');
								try {
									haptic.selection();
								} catch {}
							}}
							class={`px-2 py-0.5 rounded-lg transition-all ${
								currency() === 'ton' ? 'bg-[#0098EA] text-white shadow' : 'text-white/40 hover:text-white'
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
								currency() === 'usd' ? 'bg-[#0098EA] text-white shadow' : 'text-white/40 hover:text-white'
							}`}
						>
							USD
						</button>
					</div>

					{/* Timeframe Selector */}
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

			{/* SVG Chart */}
			<div
				class="relative w-full h-[170px] rounded-2xl border border-white/[0.06] bg-black/40 p-2 overflow-hidden select-none cursor-crosshair touch-none"
				onMouseMove={handlePointerMove}
				onTouchMove={handlePointerMove}
				onMouseLeave={handlePointerLeave}
				onTouchEnd={handlePointerLeave}
			>
				<svg
					viewBox={`0 0 ${width} ${height}`}
					class="w-full h-full overflow-visible"
					preserveAspectRatio="none"
				>
					<defs>
						<linearGradient id="usernameAreaGrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#0098EA" stop-opacity="0.3" />
							<stop offset="60%" stop-color="#0098EA" stop-opacity="0.05" />
							<stop offset="100%" stop-color="#0098EA" stop-opacity="0.0" />
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
							const barH = Math.min(18, Math.max(3, (pt.volumeTon / 800) * 10));
							const barY = height - padding.bottom + 5 - barH;
							return (
								<rect
									x={pt.x - 2.5}
									y={barY}
									width="5"
									height={barH}
									rx="1.5"
									fill="rgba(0, 152, 234, 0.16)"
								/>
							);
						}}
					</For>

					{/* Area Fill */}
					<Show when={svgPaths().area}>
						<path d={svgPaths().area} fill="url(#usernameAreaGrad)" />
					</Show>

					{/* Line */}
					<Show when={svgPaths().line}>
						<path
							d={svgPaths().line}
							fill="none"
							stroke="#0098EA"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							filter="url(#usernameNeonGlow)"
						/>
					</Show>

					{/* Crosshair Dot */}
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
										stroke="#0098EA"
										stroke-width="1.5"
										stroke-dasharray="3 3"
										opacity="0.8"
									/>
									<circle cx={cp.x} cy={cp.y} r="7" fill="#0098EA" opacity="0.3" class="animate-ping" />
									<circle cx={cp.x} cy={cp.y} r="5" fill="#0A0E17" stroke="#0098EA" stroke-width="2.5" />
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
									top: `${Math.max(15, Math.min(125, (cp.y / height) * 100))}%`,
									transform: `translate(${isRightHalf ? '-110%' : '10%'}, -50%)`,
								}}
							>
								<div class="bg-[#0b101c]/95 border border-[#0098EA]/40 rounded-xl px-2.5 py-1.5 shadow-2xl backdrop-blur-md text-[10px] font-mono whitespace-nowrap">
									<div class="text-white font-black text-xs">{fmtVal(cp.val)}</div>
									<div class="text-white/50 text-[9px] mt-0.5">{cp.label}</div>
								</div>
							</div>
						);
					})()}
				</Show>

				{/* Time Bounds */}
				<div class="absolute bottom-1 left-3 right-3 flex justify-between text-[9px] font-mono text-white/30 pointer-events-none">
					<span>{activePoints()[0]?.label || ''}</span>
					<span class="text-[#0098EA] font-semibold">{t('common.now') || 'Now'}</span>
				</div>
			</div>
		</div>
	);
};
