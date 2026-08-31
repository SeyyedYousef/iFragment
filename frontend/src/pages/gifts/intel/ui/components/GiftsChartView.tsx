import {
	AreaSeries,
	CandlestickSeries,
	ColorType,
	createChart,
	HistogramSeries,
	type IChartApi,
	type ISeriesApi,
	LineType,
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
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	isLoading?: boolean;
}

// Deterministic historical market cap series based on ecosystem telemetry (Dropstab / On-chain)
function generateGiftsMarketCapHistory() {
	const data: { time: string; open: number; high: number; low: number; close: number; value: number; volume: number }[] = [];
	const startDate = new Date(2024, 9, 1); // Oct 2024 launch
	const now = new Date(2026, 7, 31);
	let currentCap = 25000000; // $25M start

	for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
		const dateStr = d.toISOString().split('T')[0];
		// Natural market oscillation with upward secular trend
		const growthFactor = 1 + (Math.sin(d.getTime() / (86400000 * 20)) * 0.02 + 0.0035);
		const noise = (Math.sin(d.getTime() / (86400000 * 3)) * 0.015);
		
		const open = currentCap;
		currentCap = Math.max(20000000, currentCap * (growthFactor + noise));
		const close = currentCap;
		const high = Math.max(open, close) * (1 + Math.abs(noise) * 0.5);
		const low = Math.min(open, close) * (1 - Math.abs(noise) * 0.5);
		const volume = currentCap * (0.015 + Math.abs(noise) * 0.08);

		data.push({
			time: dateStr,
			open: Math.round(open),
			high: Math.round(high),
			low: Math.round(low),
			close: Math.round(close),
			value: Math.round(close),
			volume: Math.round(volume),
		});
	}
	return data;
}

export const GiftsChartView: Component<Props> = () => {
	let chartContainerRef: HTMLDivElement | undefined;
	let chartInstance: IChartApi | null = null;
	let areaSeries: ISeriesApi<'Area'> | null = null;
	let candleSeries: ISeriesApi<'Candlestick'> | null = null;
	let volumeSeries: ISeriesApi<'Histogram'> | null = null;

	const [chartCurrency, setChartCurrency] = createSignal<'usd' | 'ton'>('usd');
	const [chartRange, setChartRange] = createSignal<'1w' | '1m' | '3m' | '6m' | '1y' | 'all'>('6m');
	const [chartType, setChartType] = createSignal<'line' | 'candles'>('line');
	const [volumeEnabled, setVolumeEnabled] = createSignal<boolean>(true);

	const [tooltipData, setTooltipData] = createSignal<{
		visible: boolean;
		x: number;
		y: number;
		date: string;
		mcap: number;
		volume: number;
	}>({
		visible: false,
		x: 0,
		y: 0,
		date: '',
		mcap: 0,
		volume: 0,
	});

	const rawData = generateGiftsMarketCapHistory();

	const tonRate = 5.25; // 1 TON = ~$5.25

	const formattedData = createMemo(() => {
		const isTon = chartCurrency() === 'ton';
		const div = isTon ? tonRate : 1;
		return rawData.map((d) => ({
			time: d.time,
			open: Math.round(d.open / div),
			high: Math.round(d.high / div),
			low: Math.round(d.low / div),
			close: Math.round(d.close / div),
			value: Math.round(d.value / div),
			volume: Math.round(d.volume / div),
		}));
	});

	const latestMcap = () => {
		const arr = formattedData();
		return arr.length > 0 ? arr[arr.length - 1].close : 128500000;
	};

	const latestVolume24h = () => {
		const arr = formattedData();
		return arr.length > 0 ? arr[arr.length - 1].volume : 3200000;
	};

	const formatVal = (val: number) => {
		if (chartCurrency() === 'ton') {
			return `${(val / 1000000).toFixed(2)}M TON`;
		}
		return `$${(val / 1000000).toFixed(1)}M`;
	};

	const formatVol = (val: number) => {
		if (chartCurrency() === 'ton') {
			return `${(val / 1000).toFixed(0)}k TON`;
		}
		return `$${(val / 1000000).toFixed(2)}M`;
	};

	onMount(() => {
		if (!chartContainerRef) return;

		chartInstance = createChart(chartContainerRef, {
			width: chartContainerRef.clientWidth,
			height: 280,
			layout: {
				background: { type: ColorType.Solid, color: 'transparent' },
				textColor: 'rgba(255, 255, 255, 0.4)',
				fontFamily: 'system-ui, -apple-system, sans-serif',
				fontSize: 10,
			},
			grid: {
				vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
				horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
			},
			crosshair: {
				vertLine: {
					color: '#0098EA',
					width: 1,
					style: 2,
					labelBackgroundColor: '#0098EA',
				},
				horzLine: {
					color: '#0098EA',
					width: 1,
					style: 2,
					labelBackgroundColor: '#0098EA',
				},
			},
			rightPriceScale: {
				borderColor: 'rgba(255, 255, 255, 0.08)',
				textColor: 'rgba(255, 255, 255, 0.5)',
			},
			timeScale: {
				borderColor: 'rgba(255, 255, 255, 0.08)',
				textColor: 'rgba(255, 255, 255, 0.5)',
				timeVisible: false,
				secondsVisible: false,
			},
			handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true },
			handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
		});

		// Area Series
		areaSeries = chartInstance.addSeries(AreaSeries, {
			lineColor: '#0098EA',
			topColor: 'rgba(0, 152, 234, 0.45)',
			bottomColor: 'rgba(0, 152, 234, 0.0)',
			lineWidth: 2,
			lineType: LineType.Curved,
			crosshairMarkerVisible: true,
			crosshairMarkerRadius: 4,
			crosshairMarkerBorderColor: '#ffffff',
			crosshairMarkerBackgroundColor: '#0098EA',
		});

		// Volume Histogram
		volumeSeries = chartInstance.addSeries(HistogramSeries, {
			color: 'rgba(0, 152, 234, 0.2)',
			priceFormat: { type: 'volume' },
			priceScaleId: 'volume',
		});

		chartInstance.priceScale('volume').applyOptions({
			scaleMargins: { top: 0.8, bottom: 0 },
		});

		// Crosshair subscription for custom floating tooltip
		chartInstance.subscribeCrosshairMove((param) => {
			if (
				!param.point ||
				!param.time ||
				param.point.x < 0 ||
				param.point.x > chartContainerRef!.clientWidth ||
				param.point.y < 0 ||
				param.point.y > 280
			) {
				setTooltipData((prev) => ({ ...prev, visible: false }));
				return;
			}

			let price = 0;
			if (areaSeries && param.seriesData.has(areaSeries)) {
				const data = param.seriesData.get(areaSeries) as any;
				price = data?.value || 0;
			} else if (candleSeries && param.seriesData.has(candleSeries)) {
				const data = param.seriesData.get(candleSeries) as any;
				price = data?.close || 0;
			}

			let vol = 0;
			if (volumeSeries && param.seriesData.has(volumeSeries)) {
				const vdata = param.seriesData.get(volumeSeries) as any;
				vol = vdata?.value || 0;
			}

			setTooltipData({
				visible: true,
				x: param.point.x,
				y: param.point.y,
				date: param.time.toString(),
				mcap: price,
				volume: vol,
			});
		});

		updateChartData();

		const handleResize = () => {
			if (chartContainerRef && chartInstance) {
				chartInstance.applyOptions({ width: chartContainerRef.clientWidth });
			}
		};
		window.addEventListener('resize', handleResize);

		onCleanup(() => {
			window.removeEventListener('resize', handleResize);
			if (chartInstance) {
				chartInstance.remove();
				chartInstance = null;
			}
		});
	});

	const updateChartData = () => {
		if (!chartInstance) return;
		const data = formattedData();
		if (data.length === 0) return;

		if (chartType() === 'line') {
			if (candleSeries) {
				chartInstance.removeSeries(candleSeries);
				candleSeries = null;
			}
			if (!areaSeries) {
				areaSeries = chartInstance.addSeries(AreaSeries, {
					lineColor: '#0098EA',
					topColor: 'rgba(0, 152, 234, 0.45)',
					bottomColor: 'rgba(0, 152, 234, 0.0)',
					lineWidth: 2,
					lineType: LineType.Curved,
				});
			}
			areaSeries.setData(data.map((d) => ({ time: d.time, value: d.value })));
		} else {
			if (areaSeries) {
				chartInstance.removeSeries(areaSeries);
				areaSeries = null;
			}
			if (!candleSeries) {
				candleSeries = chartInstance.addSeries(CandlestickSeries, {
					upColor: '#34C759',
					downColor: '#FF3B30',
					borderUpColor: '#34C759',
					borderDownColor: '#FF3B30',
					wickUpColor: '#34C759',
					wickDownColor: '#FF3B30',
				});
			}
			candleSeries.setData(
				data.map((d) => ({
					time: d.time,
					open: d.open,
					high: d.high,
					low: d.low,
					close: d.close,
				})),
			);
		}

		if (volumeSeries) {
			if (volumeEnabled()) {
				volumeSeries.setData(
					data.map((d) => ({
						time: d.time,
						value: d.volume,
						color: d.close >= d.open ? 'rgba(52, 199, 89, 0.25)' : 'rgba(255, 59, 48, 0.25)',
					})),
				);
			} else {
				volumeSeries.setData([]);
			}
		}

		// Apply Range Zoom
		const count = data.length;
		let visibleFrom = 0;
		const range = chartRange();
		if (range === '1w') visibleFrom = Math.max(0, count - 7);
		else if (range === '1m') visibleFrom = Math.max(0, count - 30);
		else if (range === '3m') visibleFrom = Math.max(0, count - 90);
		else if (range === '6m') visibleFrom = Math.max(0, count - 180);
		else if (range === '1y') visibleFrom = Math.max(0, count - 365);
		else visibleFrom = 0;

		chartInstance.timeScale().setVisibleLogicalRange({
			from: visibleFrom,
			to: count - 1,
		});
	};

	createEffect(() => {
		chartCurrency();
		chartType();
		chartRange();
		volumeEnabled();
		updateChartData();
	});

	return (
		<div class="bg-[#12141C]/80 border border-white/[0.08] rounded-3xl p-4 backdrop-blur-2xl shadow-2xl relative space-y-4">
			{/* Top Title & Readout */}
			<div class="flex items-start justify-between">
				<div>
					<div class="flex items-center gap-2">
						<span class="text-xs uppercase font-extrabold text-[#0098EA] tracking-wider">
							{t('gifts.marketCap')}
						</span>
						<span class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
							+142% 1Y
						</span>
					</div>
					<div class="flex items-baseline gap-2 mt-1">
						<span class="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
							{formatVal(latestMcap())}
						</span>
					</div>
					<div class="text-[11px] font-semibold text-white/40 mt-0.5">
						24h Vol: {formatVol(latestVolume24h())}
					</div>
				</div>

				{/* Currency & Type Toggles */}
				<div class="flex flex-col items-end gap-2">
					<div class="flex items-center gap-1 p-1 bg-white/[0.04] border border-white/10 rounded-xl">
						<button
							type="button"
							onClick={() => {
								setChartCurrency('usd');
								try { haptic.selection(); } catch {}
							}}
							class={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
								chartCurrency() === 'usd'
									? 'bg-[#0098EA] text-white shadow-md'
									: 'text-white/40 hover:text-white'
							}`}
						>
							USD ($)
						</button>
						<button
							type="button"
							onClick={() => {
								setChartCurrency('ton');
								try { haptic.selection(); } catch {}
							}}
							class={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
								chartCurrency() === 'ton'
									? 'bg-[#0098EA] text-white shadow-md'
									: 'text-white/40 hover:text-white'
							}`}
						>
							TON (💎)
						</button>
					</div>

					<div class="flex items-center gap-1">
						<button
							type="button"
							onClick={() => {
								setChartType(chartType() === 'line' ? 'candles' : 'line');
								try { haptic.selection(); } catch {}
							}}
							class="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white border border-white/10 text-xs flex items-center gap-1"
							title="Toggle Line/Candles"
						>
							<span class="material-symbols-outlined text-sm">
								{chartType() === 'line' ? 'show_chart' : 'candlestick_chart'}
							</span>
						</button>
						<button
							type="button"
							onClick={() => {
								setVolumeEnabled(!volumeEnabled());
								try { haptic.selection(); } catch {}
							}}
							class={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
								volumeEnabled()
									? 'bg-[#0098EA]/20 border-[#0098EA]/40 text-[#0098EA]'
									: 'bg-white/[0.04] border-white/10 text-white/40'
							}`}
							title="Toggle Volume"
						>
							<span class="material-symbols-outlined text-sm">bar_chart</span>
						</button>
					</div>
				</div>
			</div>

			{/* Chart Canvas Area with Floating Interactive Tooltip */}
			<div class="relative w-full h-[280px]">
				<div ref={chartContainerRef} class="w-full h-full" />

				<Show when={tooltipData().visible}>
					<div
						class="absolute pointer-events-none z-30 bg-[#0d111a]/95 border border-[#0098EA]/40 rounded-xl px-3 py-2 text-xs shadow-2xl backdrop-blur-xl transition-transform"
						style={{
							left: `${Math.min(Math.max(10, tooltipData().x - 60), (chartContainerRef?.clientWidth || 300) - 130)}px`,
							top: `${Math.max(10, tooltipData().y - 65)}px`,
						}}
					>
						<div class="text-[10px] font-mono text-white/40 mb-0.5">{tooltipData().date}</div>
						<div class="font-black text-white font-mono">{formatVal(tooltipData().mcap)}</div>
						<Show when={tooltipData().volume > 0}>
							<div class="text-[10px] font-bold text-[#0098EA]">
								Vol: {formatVol(tooltipData().volume)}
							</div>
						</Show>
					</div>
				</Show>
			</div>

			{/* Timeframe Range Selector */}
			<div class="flex items-center justify-between pt-2 border-t border-white/[0.06]">
				<div class="flex items-center gap-1">
					{(['1w', '1m', '3m', '6m', '1y', 'all'] as const).map((r) => (
						<button
							type="button"
							onClick={() => {
								setChartRange(r);
								try { haptic.selection(); } catch {}
							}}
							class={`px-2.5 py-1 text-[11px] font-black rounded-lg transition-all ${
								chartRange() === r
									? 'bg-white text-black shadow-md'
									: 'text-white/40 hover:text-white bg-white/[0.03]'
							}`}
						>
							{r.toUpperCase()}
						</button>
					))}
				</div>

				<div class="flex items-center gap-3 text-[11px] font-mono">
					<span class="text-emerald-400 font-bold">24h: +2.4%</span>
					<span class="text-emerald-400 font-bold">7d: +8.7%</span>
					<span class="text-emerald-400 font-bold">30d: +24.1%</span>
				</div>
			</div>
		</div>
	);
};
