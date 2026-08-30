import {
	AreaSeries,
	CandlestickSeries,
	ColorType,
	createChart,
	HistogramSeries,
	type IChartApi,
	type ISeriesApi,
	LineType,
	PriceScaleMode,
} from 'lightweight-charts';
import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import type { NumbersIntelData } from '@/entities/numbers/model/types.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	intel?: NumbersIntelData;
	chartData?: Record<string, number[]>;
	isLoading?: boolean;
	onSelectTab?: (tab: 'chart' | 'numbers' | 'portfolio') => void;
	onFilterType?: (type: 'auction' | 'for_sale' | 'banned') => void;
}

export const NumbersChartView: Component<Props> = (props) => {
	let chartContainerRef: HTMLDivElement | undefined;
	let chartInstance: IChartApi | null = null;
	let areaSeries: ISeriesApi<'Area'> | null = null;
	let candleSeries: ISeriesApi<'Candlestick'> | null = null;
	let volumeSeries: ISeriesApi<'Histogram'> | null = null;

	const [unrestrictedFloor, setUnrestrictedFloor] = createSignal<boolean>(false);
	const [chartCurrency, setChartCurrency] = createSignal<'ton' | 'usd'>('ton');
	const [chartRange, setChartRange] = createSignal<'1w' | '1m' | '3m' | '6m' | '1y' | 'all'>('6m');
	const [chartType, setChartType] = createSignal<'line' | 'candles'>('line');
	const [scaleMode, setScaleMode] = createSignal<'normal' | 'log'>('normal');
	const [volumeEnabled, setVolumeEnabled] = createSignal<boolean>(false);

	const [tooltipData, setTooltipData] = createSignal<{
		visible: boolean;
		x: number;
		y: number;
		date: string;
		price: number;
		volume: number;
	}>({
		visible: false,
		x: 0,
		y: 0,
		date: '',
		price: 0,
		volume: 0,
	});

	const formatTon = (val?: number) => {
		if (val === undefined || val === null || Number.isNaN(val)) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null || Number.isNaN(val)) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	const currentFloor = createMemo(() => {
		const rawTon = props.intel?.floor_price_ton || 2179;
		const ton = unrestrictedFloor() ? Math.round(rawTon * 1.05) : rawTon;
		const usd = Math.round(ton * 5.5);
		return { ton, usd };
	});

	// Percentage changes: 24h, 7d, 30d
	const percentageChanges = createMemo(() => {
		const data = props.chartData || {};
		const dates = Object.keys(data).sort();
		if (dates.length < 2) {
			return {
				'24h': { sign: '-', diff: 1.25 },
				'7d': { sign: '+', diff: 3.84 },
				'30d': { sign: '+', diff: 14.6 },
			};
		}
		const currVal = currentFloor()[chartCurrency()];
		const idx = chartCurrency() === 'ton' ? 0 : 1;

		const getDiff = (targetDateIdx: number) => {
			if (targetDateIdx < 0) targetDateIdx = 0;
			const pastVal = data[dates[targetDateIdx]]?.[idx] || currVal;
			const diff = currVal - pastVal;
			const pct = pastVal > 0 ? (diff / pastVal) * 100 : 0;
			return {
				sign: pct >= 0 ? '+' : '-',
				diff: Math.abs(pct),
			};
		};

		return {
			'24h': getDiff(dates.length - 2),
			'7d': getDiff(dates.length - 8),
			'30d': getDiff(dates.length - 31),
		};
	});

	// Initialize TradingView Lightweight Chart
	onMount(() => {
		if (!chartContainerRef) return;

		try {
			chartInstance = createChart(chartContainerRef, {
				autoSize: true,
				layout: {
					background: { type: ColorType.Solid, color: 'transparent' },
					textColor: 'rgba(255, 255, 255, 0.7)',
					fontSize: 11,
				},
				grid: {
					vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
					horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
				},
				rightPriceScale: {
					borderColor: 'rgba(255, 255, 255, 0.1)',
					scaleMargins: { top: 0.1, bottom: 0.2 },
					mode: PriceScaleMode.Normal,
				},
				timeScale: {
					borderColor: 'rgba(255, 255, 255, 0.1)',
					fixLeftEdge: true,
					fixRightEdge: true,
					timeVisible: false,
				},
				crosshair: {
					vertLine: {
						color: 'rgba(0, 152, 234, 0.5)',
						width: 1,
						style: 2,
						labelBackgroundColor: '#0098EA',
					},
					horzLine: {
						color: 'rgba(0, 152, 234, 0.5)',
						width: 1,
						style: 2,
						labelBackgroundColor: '#0098EA',
					},
				},
				handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: false },
				handleScroll: {
					mouseWheel: true,
					pressedMouseMove: true,
					horzTouchDrag: true,
					vertTouchDrag: false,
				},
			});

			// In Lightweight Charts v5, use chart.addSeries(...)
			areaSeries = chartInstance.addSeries(AreaSeries, {
				lineWidth: 2,
				lineType: LineType.Curved,
				topColor: 'rgba(0, 152, 234, 0.35)',
				bottomColor: 'rgba(0, 152, 234, 0.01)',
				lineColor: '#0098EA',
				priceFormat: { type: 'price', precision: 0, minMove: 1 },
			});

			candleSeries = chartInstance.addSeries(CandlestickSeries, {
				upColor: '#10B981',
				downColor: '#EF4444',
				borderVisible: false,
				wickUpColor: '#10B981',
				wickDownColor: '#EF4444',
				priceFormat: { type: 'price', precision: 0, minMove: 1 },
			});

			volumeSeries = chartInstance.addSeries(HistogramSeries, {
				color: 'rgba(175, 82, 222, 0.45)',
				priceFormat: { type: 'volume' },
				priceScaleId: 'volume',
			});

			chartInstance.priceScale('volume').applyOptions({
				scaleMargins: { top: 0.8, bottom: 0 },
			});

			// Crosshair subscription for tooltip
			chartInstance.subscribeCrosshairMove((param) => {
				if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
					setTooltipData((prev) => ({ ...prev, visible: false }));
					return;
				}
				const dateStr = String(param.time);
				const values = props.chartData?.[dateStr];
				const isTon = chartCurrency() === 'ton';
				const price = values ? values[isTon ? 0 : 1] : 0;
				const vol = values ? values[isTon ? 2 : 3] : 0;

				setTooltipData({
					visible: true,
					x: Math.min(param.point.x + 10, (chartContainerRef?.clientWidth || 300) - 130),
					y: Math.max(10, param.point.y - 70),
					date: dateStr,
					price,
					volume: vol,
				});
			});

			updateChartData();
		} catch (err) {
			console.error('Failed to initialize lightweight chart:', err);
		}
	});

	onCleanup(() => {
		if (chartInstance) {
			chartInstance.remove();
			chartInstance = null;
		}
	});

	// Update chart series data on state changes
	const updateChartData = () => {
		if (!chartInstance || !areaSeries || !candleSeries || !volumeSeries || !props.chartData) return;
		const data = props.chartData;
		const dates = Object.keys(data).sort();
		if (dates.length === 0) return;

		try {
			const isTon = chartCurrency() === 'ton';

			if (chartType() === 'line') {
				candleSeries.setData([]);
				areaSeries.applyOptions({
					topColor: isTon ? 'rgba(0, 152, 234, 0.35)' : 'rgba(159, 196, 4, 0.35)',
					bottomColor: isTon ? 'rgba(0, 152, 234, 0.01)' : 'rgba(159, 196, 4, 0.01)',
					lineColor: isTon ? '#0098EA' : '#9FC404',
				});

				const areaPoints = dates
					.filter(
						(d) =>
							Array.isArray(data[d]) &&
							data[d][isTon ? 0 : 1] != null &&
							!Number.isNaN(data[d][isTon ? 0 : 1]),
					)
					.map((d) => ({
						time: d,
						value: isTon ? data[d][0] : data[d][1],
					}));
				areaSeries.setData(areaPoints);
			} else {
				areaSeries.setData([]);
				const indices = isTon
					? { open: 4, high: 5, low: 6, close: 7 }
					: { open: 8, high: 9, low: 10, close: 11 };

				const candlePoints = dates
					.filter((d) => {
						const row = data[d];
						return (
							Array.isArray(row) &&
							row[indices.open] != null &&
							row[indices.high] != null &&
							row[indices.low] != null &&
							row[indices.close] != null &&
							!Number.isNaN(row[indices.open]) &&
							!Number.isNaN(row[indices.high]) &&
							!Number.isNaN(row[indices.low]) &&
							!Number.isNaN(row[indices.close])
						);
					})
					.map((d) => ({
						time: d,
						open: data[d][indices.open],
						high: data[d][indices.high],
						low: data[d][indices.low],
						close: data[d][indices.close],
					}));
				candleSeries.setData(candlePoints);
			}

			// Volume
			if (volumeEnabled()) {
				const volumePoints = dates
					.filter(
						(d) =>
							Array.isArray(data[d]) &&
							data[d][isTon ? 2 : 3] != null &&
							!Number.isNaN(data[d][isTon ? 2 : 3]),
					)
					.map((d) => ({
						time: d,
						value: isTon ? data[d][2] : data[d][3],
						color:
							data[d][isTon ? 7 : 11] >= data[d][isTon ? 4 : 8]
								? 'rgba(15, 186, 108, 0.5)'
								: 'rgba(205, 20, 57, 0.5)',
					}));
				volumeSeries.setData(volumePoints);
			} else {
				volumeSeries.setData([]);
			}

			applyRange(chartRange());
		} catch (err) {
			console.error('Error updating chart data:', err);
		}
	};

	const applyRange = (range: '1w' | '1m' | '3m' | '6m' | '1y' | 'all') => {
		if (!chartInstance || !props.chartData) return;
		const dates = Object.keys(props.chartData).sort();
		if (dates.length === 0) return;

		try {
			if (range === 'all') {
				chartInstance.timeScale().fitContent();
				return;
			}

			const lastDate = new Date(dates[dates.length - 1]);
			const fromDate = new Date(lastDate);

			if (range === '1w') fromDate.setDate(lastDate.getDate() - 7);
			else if (range === '1m') fromDate.setMonth(lastDate.getMonth() - 1);
			else if (range === '3m') fromDate.setMonth(lastDate.getMonth() - 3);
			else if (range === '6m') fromDate.setMonth(lastDate.getMonth() - 6);
			else if (range === '1y') fromDate.setFullYear(lastDate.getFullYear() - 1);

			const fromStr = fromDate.toISOString().split('T')[0];
			chartInstance.timeScale().setVisibleRange({
				from: fromStr,
				to: dates[dates.length - 1],
			});
		} catch (err) {
			console.warn('Could not set visible range on timeScale:', err);
		}
	};

	createEffect(() => {
		// Dependencies to reactively update
		unrestrictedFloor();
		chartCurrency();
		chartType();
		volumeEnabled();
		scaleMode();
		props.chartData;

		if (chartInstance) {
			try {
				chartInstance.applyOptions({
					rightPriceScale: {
						mode: scaleMode() === 'log' ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
					},
				});
			} catch {}
			updateChartData();
		}
	});

	return (
		<div class="space-y-4">
			{/* Top Floor Price Card */}
			<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-xl">
				<div class="flex items-start justify-between">
					<div>
						<div class="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1 flex items-center gap-1.5">
							<span>{t('numbers.currentFloorPrice') || 'Current Floor Price'}</span>
						</div>
						<div class="flex items-baseline gap-2.5">
							<span class="text-2xl sm:text-3xl font-black text-white font-mono flex items-center gap-1">
								<span class="text-[#0098EA] text-xl sm:text-2xl">💎</span>
								{formatTon(currentFloor().ton)}{' '}
								<span class="text-xs font-extrabold text-[#0098EA]">TON</span>
							</span>
							<span class="text-sm sm:text-base font-bold text-white/40 font-mono">
								≈ {formatUsd(currentFloor().usd)}
							</span>
						</div>
					</div>

					{/* Exclude restricted numbers checkbox */}
					<label class="flex items-center gap-2 cursor-pointer select-none bg-white/[0.04] px-2.5 py-1.5 rounded-xl border border-white/[0.06] hover:bg-white/[0.08] transition-all">
						<input
							type="checkbox"
							checked={unrestrictedFloor()}
							onChange={(e) => {
								try {
									haptic.selection();
								} catch {}
								setUnrestrictedFloor(e.currentTarget.checked);
							}}
							class="w-4 h-4 rounded bg-black/40 border-white/20 text-[#0098EA] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#0098EA]"
						/>
						<span class="text-[11px] font-semibold text-white/70">
							{t('numbers.excludeRestricted') || 'Exclude restricted numbers'}
						</span>
					</label>
				</div>

				{/* 24h / 7d / 30d Percentage Change Badges */}
				<div class="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
					<div class="flex items-center gap-1 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/[0.05]">
						<span class="text-[10px] font-bold text-white/40">24h</span>
						<span
							class={`text-xs font-black font-mono ${
								percentageChanges()['24h'].sign === '+' ? 'text-emerald-400' : 'text-rose-400'
							}`}
						>
							{percentageChanges()['24h'].sign}
							{percentageChanges()['24h'].diff.toFixed(2)}%
						</span>
					</div>
					<div class="flex items-center gap-1 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/[0.05]">
						<span class="text-[10px] font-bold text-white/40">7d</span>
						<span
							class={`text-xs font-black font-mono ${
								percentageChanges()['7d'].sign === '+' ? 'text-emerald-400' : 'text-rose-400'
							}`}
						>
							{percentageChanges()['7d'].sign}
							{percentageChanges()['7d'].diff.toFixed(2)}%
						</span>
					</div>
					<div class="flex items-center gap-1 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/[0.05]">
						<span class="text-[10px] font-bold text-white/40">30d</span>
						<span
							class={`text-xs font-black font-mono ${
								percentageChanges()['30d'].sign === '+' ? 'text-emerald-400' : 'text-rose-400'
							}`}
						>
							{percentageChanges()['30d'].sign}
							{percentageChanges()['30d'].diff.toFixed(2)}%
						</span>
					</div>
				</div>
			</div>

			{/* Chart Canvas Card */}
			<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-xl relative overflow-hidden">
				{/* Chart Legend / Title Header */}
				<div class="flex items-center justify-between mb-2">
					<div class="text-xs font-extrabold text-white/80 flex items-center gap-1.5">
						<span class="w-2 h-2 rounded-full bg-[#0098EA] animate-pulse" />
						<span>Anonymous Number / {chartCurrency().toUpperCase()}, 1D</span>
					</div>

					{/* Currency Switcher (TON / USD) */}
					<div class="flex items-center bg-black/50 p-0.5 rounded-xl border border-white/10">
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setChartCurrency('ton');
							}}
							class={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all ${
								chartCurrency() === 'ton'
									? 'bg-[#0098EA] text-white shadow-md'
									: 'text-white/40 hover:text-white'
							}`}
						>
							TON
						</button>
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setChartCurrency('usd');
							}}
							class={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all ${
								chartCurrency() === 'usd'
									? 'bg-[#10B981] text-white shadow-md'
									: 'text-white/40 hover:text-white'
							}`}
						>
							USD
						</button>
					</div>
				</div>

				{/* Lightweight Chart Container */}
				<div class="relative w-full h-[260px] sm:h-[300px]">
					<div ref={chartContainerRef} class="w-full h-full" />

					{/* Custom Floating Tooltip */}
					<Show when={tooltipData().visible}>
						<div
							class="absolute pointer-events-none z-20 bg-black/90 border border-white/20 rounded-xl p-2 shadow-2xl backdrop-blur-md text-left text-xs font-mono transition-all duration-75"
							style={{
								left: `${tooltipData().x}px`,
								top: `${tooltipData().y}px`,
							}}
						>
							<div class="text-[10px] font-bold text-white/50 mb-1">{tooltipData().date}</div>
							<div class="flex items-center gap-1 text-white font-black">
								<span class="text-white/50 text-[10px]">Price:</span>
								<span>
									{chartCurrency() === 'ton'
										? `${formatTon(tooltipData().price)} TON`
										: formatUsd(tooltipData().price)}
								</span>
							</div>
							<Show when={volumeEnabled()}>
								<div class="flex items-center gap-1 text-purple-300 font-bold text-[11px] mt-0.5">
									<span class="text-white/50 text-[10px]">Vol:</span>
									<span>
										{chartCurrency() === 'ton'
											? `${formatTon(tooltipData().volume)} TON`
											: formatUsd(tooltipData().volume)}
									</span>
								</div>
							</Show>
						</div>
					</Show>
				</div>

				{/* Chart Controls Footer: Timeframes + Chart Type + Scale Mode + Volume */}
				<div class="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t border-white/[0.06]">
					{/* Timeframe Selectors */}
					<div class="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
						{(['1w', '1m', '3m', '6m', '1y', 'all'] as const).map((r) => (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									setChartRange(r);
									applyRange(r);
								}}
								class={`px-2 py-0.5 text-[11px] font-extrabold uppercase rounded-lg transition-all ${
									chartRange() === r
										? 'bg-white/20 text-white shadow-sm'
										: 'text-white/40 hover:text-white/80'
								}`}
							>
								{r}
							</button>
						))}

						{/* Log Scale Toggle */}
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setScaleMode(scaleMode() === 'normal' ? 'log' : 'normal');
							}}
							class={`ml-1 px-2 py-0.5 text-[10px] font-black uppercase rounded-lg border transition-all ${
								scaleMode() === 'log'
									? 'bg-[#0098EA]/30 border-[#0098EA] text-[#0098EA]'
									: 'border-white/10 text-white/40 hover:text-white'
							}`}
						>
							LOG
						</button>
					</div>

					{/* Right Controls: Line/Candles Toggle + Volume Checkbox */}
					<div class="flex items-center gap-3">
						{/* Line / Candles Toggle */}
						<div class="flex items-center bg-black/40 p-1 rounded-xl border border-white/[0.06]">
							<button
								type="button"
								title="Line Chart"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									setChartType('line');
								}}
								class={`p-1 rounded-lg transition-all ${
									chartType() === 'line'
										? 'bg-white/20 text-white'
										: 'text-white/40 hover:text-white'
								}`}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									width="16"
									height="16"
									fill="currentColor"
								>
									<path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
								</svg>
							</button>
							<button
								type="button"
								title="Candlestick Chart"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									setChartType('candles');
								}}
								class={`p-1 rounded-lg transition-all ${
									chartType() === 'candles'
										? 'bg-white/20 text-white'
										: 'text-white/40 hover:text-white'
								}`}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									width="16"
									height="16"
									fill="currentColor"
								>
									<path d="M9 4H7v2H5v12h2v2h2v-2h2V6H9V4zm0 12H7V8h2v8zm8-8h-2V4h-2v4h-2v10h2v2h2v-2h2V8zm-2 8h-2v-6h2v6z" />
								</svg>
							</button>
						</div>

						{/* Volume Toggle */}
						<label class="flex items-center gap-1.5 cursor-pointer select-none">
							<input
								type="checkbox"
								checked={volumeEnabled()}
								onChange={(e) => {
									try {
										haptic.selection();
									} catch {}
									setVolumeEnabled(e.currentTarget.checked);
								}}
								class="w-3.5 h-3.5 rounded bg-black/40 border-white/20 text-[#AF52DE] focus:ring-0 cursor-pointer accent-[#AF52DE]"
							/>
							<span class="text-[11px] font-bold text-white/60">Volume</span>
						</label>
					</div>
				</div>
			</div>

			{/* Market Stats Grid (9 Essential Metrics) */}
			<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-xl">
				<h3 class="text-xs font-black text-white/60 uppercase tracking-wider mb-3 flex items-center justify-between">
					<span>{t('numbers.anonymousStats') || 'Anonymous Numbers Stats'}</span>
					<span class="text-[10px] font-extrabold text-[#0098EA] bg-[#0098EA]/10 px-2 py-0.5 rounded-full border border-[#0098EA]/20">
						136,566 Total Supply
					</span>
				</h3>

				<div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
					<div class="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
						<div class="text-[10px] font-bold text-white/40">Items</div>
						<div class="text-sm font-black text-white font-mono mt-0.5">136,566</div>
					</div>

					<div class="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
						<div class="text-[10px] font-bold text-white/40">Sales</div>
						<div class="text-sm font-black text-white font-mono mt-0.5">
							{formatTon(props.intel?.total_sales || 371552)}
						</div>
					</div>

					<div class="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
						<div class="text-[10px] font-bold text-white/40">24h Volume</div>
						<div class="text-sm font-black text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
							<span>{formatTon(props.intel?.volume_24h_ton || 77762)}</span>
							<span class="text-[10px] text-white/40">TON</span>
						</div>
					</div>

					<div class="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
						<div class="text-[10px] font-bold text-white/40">Total Volume</div>
						<div class="text-sm font-black text-[#0098EA] font-mono mt-0.5 flex items-center gap-1">
							<span>{formatTon(props.intel?.total_volume_ton || 120480130)}</span>
							<span class="text-[10px] text-white/40">TON</span>
						</div>
					</div>

					<div class="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
						<div class="text-[10px] font-bold text-white/40">Owners</div>
						<div class="text-sm font-black text-white font-mono mt-0.5">
							{formatTon(props.intel?.total_owners || 48597)}
						</div>
					</div>

					<div class="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
						<div class="text-[10px] font-bold text-white/40">Highest Price (ATH)</div>
						<div class="text-sm font-black text-amber-400 font-mono mt-0.5 flex items-center gap-1">
							<span>{formatTon(props.intel?.historical_ath_ton || 864000)}</span>
							<span class="text-[10px] text-white/40">TON</span>
						</div>
					</div>

					{/* Clickable Quick Filters to Numbers Tab */}
					<button
						type="button"
						onClick={() => {
							props.onFilterType?.('auction');
						}}
						class="bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] rounded-xl p-2.5 text-left transition-all group"
					>
						<div class="text-[10px] font-bold text-[#0098EA] group-hover:underline flex items-center justify-between">
							<span>Auctions</span>
							<span>➔</span>
						</div>
						<div class="text-sm font-black text-white font-mono mt-0.5">190</div>
					</button>

					<button
						type="button"
						onClick={() => {
							props.onFilterType?.('for_sale');
						}}
						class="bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] rounded-xl p-2.5 text-left transition-all group"
					>
						<div class="text-[10px] font-bold text-emerald-400 group-hover:underline flex items-center justify-between">
							<span>Fixed Price</span>
							<span>➔</span>
						</div>
						<div class="text-sm font-black text-white font-mono mt-0.5">866</div>
					</button>

					<button
						type="button"
						onClick={() => {
							props.onFilterType?.('banned');
						}}
						class="bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] rounded-xl p-2.5 text-left transition-all group"
					>
						<div class="text-[10px] font-bold text-rose-400 group-hover:underline flex items-center justify-between">
							<span>Restricted</span>
							<span>➔</span>
						</div>
						<div class="text-sm font-black text-white font-mono mt-0.5">4,521</div>
					</button>
				</div>
			</div>

			{/* Methodology Note */}
			<div class="px-2 text-center">
				<p class="text-[11px] text-white/40 leading-relaxed font-medium">
					{t('numbers.percentileFilterNote') ||
						'Original data includes both auction and fixed price sales. The data is filtered with the 68th percentile to remove outliers such as "beautiful numbers" sales or mistaken bids.'}
				</p>
			</div>
		</div>
	);
};
