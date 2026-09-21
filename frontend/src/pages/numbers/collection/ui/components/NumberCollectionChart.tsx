import { type Component, createSignal, For, Show } from 'solid-js';
import type { NumberCollectionHistoryPoint } from '@/entities/numbers/model/types.js';

interface ChartProps {
	points: NumberCollectionHistoryPoint[];
	rate: number;
	timeframe: string;
	onTimeframeChange: (tf: '24h' | '7d' | '30d' | '90d' | 'all') => void;
	isLoading?: boolean;
}

export const NumberCollectionChart: Component<ChartProps> = (props) => {
	const [chartMode, setChartMode] = createSignal<'price' | 'volume'>('price');
	const [currency, setCurrency] = createSignal<'TON' | 'USD'>('TON');
	const [hoveredPoint, setHoveredPoint] = createSignal<NumberCollectionHistoryPoint | null>(null);

	const timeframes: Array<'24h' | '7d' | '30d' | '90d' | 'all'> = ['24h', '7d', '30d', '90d', 'all'];

	const getVal = (pt: NumberCollectionHistoryPoint, key: 'floor' | 'median' | 'volume') => {
		const isUsd = currency() === 'USD';
		if (key === 'floor') return isUsd ? pt.floor_usd : pt.floor_ton;
		if (key === 'median') {
			if (!pt.median_sale_ton) return isUsd ? pt.floor_usd : pt.floor_ton;
			return isUsd ? (pt.median_sale_usd || pt.median_sale_ton * props.rate) : pt.median_sale_ton;
		}
		if (key === 'volume') return isUsd ? pt.volume_usd : pt.volume_ton;
		return 0;
	};

	const chartData = () => {
		const pts = props.points || [];
		if (pts.length === 0) return null;

		const values = pts.map((p) => getVal(p, chartMode() === 'price' ? 'floor' : 'volume'));
		const minVal = Math.min(...values) * 0.95;
		const maxVal = Math.max(...values) * 1.05 || 1;
		const range = maxVal - minVal || 1;

		const width = 360;
		const height = 140;

		const pointsCoords = pts.map((p, idx) => {
			const x = (idx / Math.max(pts.length - 1, 1)) * width;
			const val = getVal(p, chartMode() === 'price' ? 'floor' : 'volume');
			const y = height - ((val - minVal) / range) * height;
			return { x, y, point: p, val };
		});

		const pathD = pointsCoords.reduce((acc, pt, idx) => {
			return `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
		}, '');

		const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

		return { minVal, maxVal, pointsCoords, pathD, areaD, width, height };
	};

	const fmtNum = (val?: number | null) => {
		if (val === undefined || val === null || isNaN(val)) return '—';
		return val.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	return (
		<div class="bg-gradient-to-br from-[#0c101a] to-[#07090e] border border-white/[0.08] rounded-3xl p-4 mb-4 shadow-xl relative">
			{/* Chart Controls Bar */}
			<div class="flex items-center justify-between gap-2 mb-3 flex-wrap">
				{/* Mode Switch: Price vs Volume */}
				<div class="flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/[0.06]">
					<button
						type="button"
						onClick={() => setChartMode('price')}
						class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
							chartMode() === 'price'
								? 'bg-[#0098EA] text-white shadow-sm'
								: 'text-white/50 hover:text-white'
						}`}
					>
						قیمت و کف (Price)
					</button>
					<button
						type="button"
						onClick={() => setChartMode('volume')}
						class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
							chartMode() === 'volume'
								? 'bg-[#0098EA] text-white shadow-sm'
								: 'text-white/50 hover:text-white'
						}`}
					>
						حجم و معاملات (Volume)
					</button>
				</div>

				{/* Currency Toggle (TON vs USD) */}
				<div class="flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/[0.06]">
					<button
						type="button"
						onClick={() => setCurrency('TON')}
						class={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
							currency() === 'TON' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40'
						}`}
					>
						TON
					</button>
					<button
						type="button"
						onClick={() => setCurrency('USD')}
						class={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
							currency() === 'USD' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/40'
						}`}
					>
						USD
					</button>
				</div>

				{/* Timeframe Selector */}
				<div class="flex items-center gap-1 bg-white/[0.03] p-0.5 rounded-xl border border-white/[0.06]">
					<For each={timeframes}>
						{(tf) => (
							<button
								type="button"
								onClick={() => props.onTimeframeChange(tf)}
								class={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all uppercase ${
									props.timeframe === tf
										? 'bg-white/10 text-white border border-white/20'
										: 'text-white/40 hover:text-white'
								}`}
							>
								{tf}
							</button>
						)}
					</For>
				</div>
			</div>

			{/* SVG Chart Area */}
			<div class="relative h-[160px] w-full flex items-center justify-center">
				<Show
					when={!props.isLoading && chartData()}
					fallback={
						<div class="text-center py-8">
							<Show when={props.isLoading}>
								<div class="w-6 h-6 border-2 border-[#0098EA]/30 border-t-[#0098EA] rounded-full animate-spin mx-auto mb-2" />
								<span class="text-xs text-white/40 font-mono">در حال دریافت داده‌های تاییدشده...</span>
							</Show>
							<Show when={!props.isLoading && (!props.points || props.points.length === 0)}>
								<span class="material-symbols-outlined text-3xl text-white/20 mb-1 block">
									query_stats
								</span>
								<span class="text-xs font-medium text-white/50 block">
									در این بازه فروش تأییدشده‌ای پیدا نشد
								</span>
								<span class="text-[10px] text-white/30 block mt-0.5 font-mono">
									هیچ داده فرضی یا سینوسی برای این بازه رسم نمی‌شود
								</span>
							</Show>
						</div>
					}
				>
					{/* Interactive SVG Chart */}
					<svg
						viewBox={`0 0 ${chartData()!.width} ${chartData()!.height}`}
						class="w-full h-full overflow-visible"
						preserveAspectRatio="none"
					>
						<defs>
							<linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="0%"
									stop-color={chartMode() === 'price' ? '#0098EA' : '#10b981'}
									stop-opacity="0.35"
								/>
								<stop
									offset="100%"
									stop-color={chartMode() === 'price' ? '#0098EA' : '#10b981'}
									stop-opacity="0.0"
								/>
							</linearGradient>
						</defs>

						{/* Area Fill */}
						<path d={chartData()!.areaD} fill="url(#chartGradient)" />

						{/* Stroke Line */}
						<path
							d={chartData()!.pathD}
							fill="none"
							stroke={chartMode() === 'price' ? '#0098EA' : '#10b981'}
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>

						{/* Data Points */}
						<For each={chartData()!.pointsCoords}>
							{(pt) => (
								<circle
									cx={pt.x}
									cy={pt.y}
									r={hoveredPoint() === pt.point ? '5' : '2.5'}
									class="transition-all cursor-pointer fill-[#030303]"
									stroke={chartMode() === 'price' ? '#0098EA' : '#10b981'}
									stroke-width="2"
									onMouseEnter={() => setHoveredPoint(pt.point)}
									onTouchStart={() => setHoveredPoint(pt.point)}
								/>
							)}
						</For>
					</svg>

					{/* Tooltip Overlay */}
					<Show when={hoveredPoint()}>
						<div class="absolute bottom-2 left-3 bg-[#121622]/95 border border-white/10 backdrop-blur-md rounded-xl p-2.5 shadow-2xl text-[10px] pointer-events-none z-20 space-y-1">
							<div class="flex items-center justify-between gap-4 font-mono text-white/50 border-b border-white/10 pb-1">
								<span>{new Date(hoveredPoint()!.timestamp).toUTCString().slice(0, 22)}</span>
								<span class="text-emerald-400 font-bold uppercase">{hoveredPoint()!.provenance}</span>
							</div>

							<div class="flex items-center justify-between gap-4">
								<span class="text-white/60">کف قیمت (Floor):</span>
								<span class="font-mono font-bold text-white">
									{currency() === 'TON'
										? `${fmtNum(hoveredPoint()!.floor_ton)} TON`
										: `$${fmtNum(hoveredPoint()!.floor_usd)}`}
								</span>
							</div>

							<Show when={hoveredPoint()!.median_sale_ton}>
								<div class="flex items-center justify-between gap-4">
									<span class="text-white/60">میانه فروش (Median):</span>
									<span class="font-mono font-bold text-emerald-400">
										{currency() === 'TON'
											? `${fmtNum(hoveredPoint()!.median_sale_ton)} TON`
											: `$${fmtNum(hoveredPoint()!.median_sale_usd)}`}
									</span>
								</div>
							</Show>

							<div class="flex items-center justify-between gap-4">
								<span class="text-white/60">تعداد معاملات / حجم:</span>
								<span class="font-mono font-bold text-cyan-300">
									{hoveredPoint()!.sales_count} معامله · {fmtNum(hoveredPoint()!.volume_ton)} TON
								</span>
							</div>
						</div>
					</Show>
				</Show>
			</div>

			{/* Chart Footer Indicator */}
			<div class="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[9px] text-white/40 font-mono">
				<span>پروتکل تلمینت · بدون نقاط جعلی (Zero Synthetic OHLCV)</span>
				<span>تایم‌استمپ دقیق UTC</span>
			</div>
		</div>
	);
};
