import { Component, createMemo, createSignal, For, Show } from 'solid-js';

interface SparklinePoint {
	label: string;
	value: number;
}

interface SparklineChartProps {
	data?: SparklinePoint[];
	width?: number;
	height?: number;
	color?: string;
	fillColor?: string;
	unit?: string;
	title?: string;
}

export const SparklineChart: Component<SparklineChartProps> = (props) => {
	const [activeIdx, setActiveIdx] = createSignal<number | null>(null);

	const points = createMemo(() => {
		if (props.data && props.data.length > 0) return props.data;
		return [
			{ label: '6M ago', value: 120 },
			{ label: '5M ago', value: 145 },
			{ label: '4M ago', value: 138 },
			{ label: '3M ago', value: 170 },
			{ label: '2M ago', value: 195 },
			{ label: '1M ago', value: 230 },
			{ label: 'Now', value: 280 },
		];
	});

	const w = () => props.width || 320;
	const h = () => props.height || 100;
	const padding = 12;

	const stats = createMemo(() => {
		const pts = points();
		if (!pts.length) return { min: 0, max: 0, changePct: 0 };
		const values = pts.map((p) => p.value);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const first = values[0] || 1;
		const last = values[values.length - 1] || 1;
		const changePct = Math.round(((last - first) / first) * 100);
		return { min, max: max === min ? min + 1 : max, changePct };
	});

	const pathData = createMemo(() => {
		const pts = points();
		const { min, max } = stats();
		const width = w();
		const height = h();
		const innerW = width - padding * 2;
		const innerH = height - padding * 2;

		const coords = pts.map((p, idx) => {
			const x = padding + (idx / (pts.length - 1 || 1)) * innerW;
			const y = height - padding - ((p.value - min) / (max - min)) * innerH;
			return { x, y, label: p.label, value: p.value };
		});

		// Build smooth path
		let d = '';
		for (let i = 0; i < coords.length; i++) {
			if (i === 0) {
				d += `M ${coords[i].x} ${coords[i].y}`;
			} else {
				const prev = coords[i - 1];
				const curr = coords[i];
				const cx = (prev.x + curr.x) / 2;
				d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
			}
		}

		// Area path
		const lastCoord = coords[coords.length - 1];
		const firstCoord = coords[0];
		const areaD = `${d} L ${lastCoord.x} ${height - padding} L ${firstCoord.x} ${height - padding} Z`;

		return { d, areaD, coords };
	});

	const activePoint = createMemo(() => {
		const idx = activeIdx();
		if (idx === null) return null;
		return pathData().coords[idx] || null;
	});

	const strokeColor = () => props.color || '#0098EA';

	return (
		<div class="w-full flex flex-col gap-2.5">
			<div class="flex items-center justify-between">
				<Show when={props.title}>
					<span class="text-white/50 text-[10px] font-black uppercase tracking-widest">{props.title}</span>
				</Show>
				<div class="flex items-center gap-1.5 ms-auto">
					<span
						class={`text-[10px] font-mono font-black px-2 py-0.5 rounded-[6px] border ${
							stats().changePct >= 0
								? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
								: 'bg-[#ff4a4a]/10 text-[#ff4a4a] border-[#ff4a4a]/25'
						}`}
					>
						{stats().changePct >= 0 ? '+' : ''}
						{stats().changePct}%
					</span>
				</div>
			</div>

			<div class="w-full relative bg-[#08090D] border border-white/5 rounded-[18px] p-3 overflow-hidden shadow-inner">
				<svg
					viewBox={`0 0 ${w()} ${h()}`}
					class="w-full h-[110px] overflow-visible"
					onMouseLeave={() => setActiveIdx(null)}
				>
					<defs>
						<linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color={strokeColor()} stop-opacity="0.3" />
							<stop offset="100%" stop-color={strokeColor()} stop-opacity="0.0" />
						</linearGradient>
					</defs>

					{/* Grid Lines */}
					<line
						x1={padding}
						y1={padding}
						x2={w() - padding}
						y2={padding}
						stroke="rgba(255,255,255,0.05)"
						stroke-dasharray="3,3"
					/>
					<line
						x1={padding}
						y1={h() / 2}
						x2={w() - padding}
						y2={h() / 2}
						stroke="rgba(255,255,255,0.05)"
						stroke-dasharray="3,3"
					/>
					<line
						x1={padding}
						y1={h() - padding}
						x2={w() - padding}
						y2={h() - padding}
						stroke="rgba(255,255,255,0.05)"
					/>

					{/* Area Fill */}
					<path d={pathData().areaD} fill="url(#sparkline-fill)" />

					{/* Trend Line */}
					<path
						d={pathData().d}
						fill="none"
						stroke={strokeColor()}
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>

					{/* Interactive Points */}
					<For each={pathData().coords}>
						{(coord, i) => (
							<g
								onMouseEnter={() => setActiveIdx(i())}
								onTouchStart={() => setActiveIdx(i())}
								class="cursor-pointer"
							>
								<circle
									cx={coord.x}
									cy={coord.y}
									r={activeIdx() === i() ? 5 : 3}
									fill={activeIdx() === i() ? '#ffffff' : strokeColor()}
									stroke="#08090D"
									stroke-width="2"
									class="transition-all duration-200"
								/>
							</g>
						)}
					</For>
				</svg>

				{/* Active Hover Floating Tooltip */}
				<Show when={activePoint()}>
					{(pt) => (
						<div
							class="absolute top-2 left-1/2 -translate-x-1/2 bg-[#12141C]/95 border border-white/15 px-3 py-1 rounded-[10px] text-center shadow-lg backdrop-blur-md pointer-events-none"
						>
							<span class="text-white/40 text-[9px] font-mono block">{pt().label}</span>
							<span class="text-white font-mono font-black text-[12px]">
								{pt().value.toLocaleString('en-US')} {props.unit || 'TON'}
							</span>
						</div>
					)}
				</Show>
			</div>
		</div>
	);
};
