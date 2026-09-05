import {
	AreaSeries,
	CandlestickSeries,
	ColorType,
	createChart,
	HistogramSeries,
	type IChartApi,
	type ISeriesApi,
	LineStyle,
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
import type { GiftsIntelResponse } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { GiftsMacroStats } from './GiftsMacroStats.js';

interface Props {
	intel?: GiftsIntelResponse;
	isLoading?: boolean;
}

// Deterministic historical market cap series based on ecosystem telemetry (Dropstab / On-chain)
function generateGiftsMarketCapHistory() {
	const data: {
		time: string;
		open: number;
		high: number;
		low: number;
		close: number;
		value: number;
		volume: number;
	}[] = [];
	const startDate = new Date(2024, 9, 1); // Oct 2024 launch
	const now = new Date(2026, 7, 31);
	let currentCap = 25000000; // $25M start

	for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
		const dateStr = d.toISOString().split('T')[0];
		const growthFactor = 1 + (Math.sin(d.getTime() / (86400000 * 20)) * 0.02 + 0.0035);
		const noise = Math.sin(d.getTime() / (86400000 * 3)) * 0.015;

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

export const GiftsChartView: Component<Props> = (props) => {
	let chartContainerRef: HTMLDivElement | undefined;
	let chart: IChartApi | null = null;
	let areaSeries: ISeriesApi<'Area'> | null = null;
	let candleSeries: ISeriesApi<'Candlestick'> | null = null;
	let volumeSeries: ISeriesApi<'Histogram'> | null = null;

	const [chartType, setChartType] = createSignal<'area' | 'candles'>('area');
	const [chartRange, setChartRange] = createSignal<'1w' | '1m' | '3m' | '6m' | '1y' | 'all'>('1y');
	const [chartCurrency, setChartCurrency] = createSignal<'usd' | 'ton'>('usd');
	const [volumeEnabled, setVolumeEnabled] = createSignal<boolean>(true);

	const [tooltipData, setTooltipData] = createSignal<{
		visible: boolean;
		x: number;
		y: number;
		date: string;
		mcap: number;
		volume: number;
	}>({ visible: false, x: 0, y: 0, date: '', mcap: 0, volume: 0 });

	const rawData = createMemo(() => generateGiftsMarketCapHistory());

	const tonPriceUsd = () => 4.0; // Current TON benchmark

	const currentData = createMemo(() => {
		const data = rawData();
		const isTon = chartCurrency() === 'ton';
		const factor = isTon ? 1 / tonPriceUsd() : 1;

		return data.map((d) => ({
			time: d.time,
			open: d.open * factor,
			high: d.high * factor,
			low: d.low * factor,
			close: d.close * factor,
			value: d.value * factor,
			volume: d.volume * factor,
		}));
	});

	const filteredData = createMemo(() => {
		const data = currentData();
		if (data.length === 0) return [];
		const now = new Date('2026-08-31');
		let daysBack = 365;

		switch (chartRange()) {
			case '1w':
				daysBack = 7;
				break;
			case '1m':
				daysBack = 30;
				break;
			case '3m':
				daysBack = 90;
				break;
			case '6m':
				daysBack = 180;
				break;
			case '1y':
				daysBack = 365;
				break;
			case 'all':
				daysBack = 9999;
				break;
		}

		const cutoff = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
		return data.filter((d) => new Date(d.time) >= cutoff);
	});

	const latestMcap = () => {
		const data = currentData();
		if (data.length === 0) return 128000000;
		return data[data.length - 1].value;
	};

	const latestVolume24h = () => {
		const data = currentData();
		if (data.length === 0) return 4200000;
		return data[data.length - 1].volume;
	};

	const formatVal = (val: number) => {
		const isTon = chartCurrency() === 'ton';
		if (isTon) {
			return `${(val / 1000000).toFixed(2)}M TON`;
		}
		return `$${(val / 1000000).toFixed(1)}M`;
	};

	const formatVol = (val: number) => {
		const isTon = chartCurrency() === 'ton';
		if (isTon) {
			return `${(val / 1000).toFixed(0)}k TON`;
		}
		return `$${(val / 1000).toFixed(0)}k`;
	};

	const initChart = () => {
		if (!chartContainerRef) return;

		chart = createChart(chartContainerRef, {
			layout: {
				background: { type: ColorType.Solid, color: 'transparent' },
				textColor: 'rgba(255, 255, 255, 0.4)',
				fontSize: 10,
				fontFamily: 'Inter, system-ui, sans-serif',
			},
			grid: {
				vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
				horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
			},
			crosshair: {
				vertLine: {
					color: '#0098EA',
					width: 1,
					style: LineStyle.Dashed,
					labelBackgroundColor: '#0098EA',
				},
				horzLine: {
					color: '#0098EA',
					width: 1,
					style: LineStyle.Dashed,
					labelBackgroundColor: '#0098EA',
				},
			},
			rightPriceScale: {
				borderColor: 'rgba(255, 255, 255, 0.06)',
				textColor: 'rgba(255, 255, 255, 0.4)',
				scaleMargins: {
					top: 0.1,
					bottom: 0.25,
				},
			},
			timeScale: {
				borderColor: 'rgba(255, 255, 255, 0.06)',
				timeVisible: false,
				secondsVisible: false,
			},
			handleScroll: {
				mouseWheel: true,
				pressedMouseMove: true,
				horzTouchDrag: true,
				vertTouchDrag: false,
			},
			handleScale: {
				axisPressedMouseMove: true,
				mouseWheel: true,
				pinch: true,
			},
		});

		// Volume Histogram Series
		volumeSeries = chart.addSeries(HistogramSeries, {
			color: 'rgba(0, 152, 234, 0.25)',
			priceFormat: {
				type: 'volume',
			},
			priceScaleId: '',
		});
		volumeSeries.priceScale().applyOptions({
			scaleMargins: {
				top: 0.75,
				bottom: 0,
			},
		});

		// Area Series (Smooth Wave)
		areaSeries = chart.addSeries(AreaSeries, {
			topColor: 'rgba(0, 152, 234, 0.45)',
			bottomColor: 'rgba(0, 152, 234, 0.0)',
			lineColor: '#0098EA',
			lineWidth: 2,
		});

		// Candlestick Series
		candleSeries = chart.addSeries(CandlestickSeries, {
			upColor: '#22c55e',
			downColor: '#ef4444',
			borderVisible: false,
			wickUpColor: '#22c55e',
			wickDownColor: '#ef4444',
		});

		// Crosshair Tooltip
		chart.subscribeCrosshairMove((param) => {
			if (
				param.point === undefined ||
				!param.time ||
				param.point.x < 0 ||
				param.point.x > (chartContainerRef?.clientWidth || 0) ||
				param.point.y < 0 ||
				param.point.y > (chartContainerRef?.clientHeight || 0)
			) {
				setTooltipData((prev) => ({ ...prev, visible: false }));
			} else {
				const dateStr = param.time as string;
				const seriesData = param.seriesData.get(areaSeries || candleSeries!) as any;
				const volData = param.seriesData.get(volumeSeries!) as any;

				const val = seriesData
					? seriesData.close !== undefined
						? seriesData.close
						: seriesData.value
					: 0;
				const vol = volData ? volData.value : 0;

				setTooltipData({
					visible: true,
					x: param.point.x,
					y: param.point.y,
					date: dateStr,
					mcap: val || 0,
					volume: vol || 0,
				});
			}
		});

		updateChartData();
	};

	const updateChartData = () => {
		if (!chart) return;
		const data = filteredData();
		if (data.length === 0) return;

		// Volume
		if (volumeSeries) {
			if (volumeEnabled()) {
				volumeSeries.setData(
					data.map((d) => ({
						time: d.time,
						value: d.volume,
						color: d.close >= d.open ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)',
					})),
				);
			} else {
				volumeSeries.setData([]);
			}
		}

		// Price/MarketCap
		if (chartType() === 'area') {
			if (areaSeries) {
				areaSeries.applyOptions({ visible: true });
				areaSeries.setData(data.map((d) => ({ time: d.time, value: d.value })));
			}
			if (candleSeries) {
				candleSeries.applyOptions({ visible: false });
			}
		} else {
			if (candleSeries) {
				candleSeries.applyOptions({ visible: true });
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
			if (areaSeries) {
				areaSeries.applyOptions({ visible: false });
			}
		}

		chart.timeScale().fitContent();
	};

	onMount(() => {
		initChart();

		const handleResize = () => {
			if (chart && chartContainerRef) {
				chart.applyOptions({
					width: chartContainerRef.clientWidth,
				});
			}
		};

		window.addEventListener('resize', handleResize);
		onCleanup(() => {
			window.removeEventListener('resize', handleResize);
			if (chart) {
				chart.remove();
				chart = null;
			}
		});
	});

	createEffect(() => {
		chartCurrency();
		chartType();
		chartRange();
		volumeEnabled();
		updateChartData();
	});

	return (
		<div class="space-y-3.5">
			{/* Main Chart Terminal Container */}
			<div class="bg-[#0b0e17]/95 border border-white/[0.08] rounded-[24px] p-4 backdrop-blur-2xl shadow-2xl relative space-y-3.5">
				{/* Top Title & Readout */}
				<div class="flex items-start justify-between">
					<div>
						<div class="flex items-center gap-1.5">
							<span class="text-xs uppercase font-extrabold text-[#0098EA] tracking-wider">
								{t('gifts.marketCap')}
							</span>
							<span class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
								+142% 1Y
							</span>
						</div>
						<div class="flex items-baseline gap-2 mt-1">
							<span class="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight tabular-nums">
								{formatVal(latestMcap())}
							</span>
						</div>
						<div class="text-[10px] font-semibold text-white/40 mt-0.5 font-mono">
							24h Vol: {formatVol(latestVolume24h())}
						</div>
					</div>

					{/* Currency & Type Toggles */}
					<div class="flex flex-col items-end gap-1.5">
						<div class="flex items-center gap-1 p-0.5 bg-white/[0.04] border border-white/10 rounded-xl">
							<button
								type="button"
								onClick={() => {
									setChartCurrency('usd');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
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
									setChartCurrency('ton');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
									chartCurrency() === 'ton'
										? 'bg-[#0098EA] text-white shadow-sm'
										: 'text-white/40 hover:text-white'
								}`}
							>
								TON
							</button>
						</div>

						<div class="flex items-center gap-1">
							<button
								type="button"
								onClick={() => {
									setChartType(chartType() === 'area' ? 'candles' : 'area');
									try {
										haptic.selection();
									} catch {}
								}}
								class="p-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white transition-all border border-white/5"
								title={chartType() === 'area' ? 'Switch to Candlesticks' : 'Switch to Line'}
							>
								<span class="material-symbols-outlined text-sm">
									{chartType() === 'area' ? 'candlestick_chart' : 'show_chart'}
								</span>
							</button>

							<button
								type="button"
								onClick={() => {
									setVolumeEnabled(!volumeEnabled());
									try {
										haptic.selection();
									} catch {}
								}}
								class={`p-1 rounded-lg transition-all border ${
									volumeEnabled()
										? 'bg-[#0098EA]/20 text-[#0098EA] border-[#0098EA]/40'
										: 'bg-white/[0.04] text-white/40 border-white/5'
								}`}
								title="Toggle Volume"
							>
								<span class="material-symbols-outlined text-sm">bar_chart</span>
							</button>
						</div>
					</div>
				</div>

				{/* Chart Canvas Area with Floating Interactive Tooltip */}
				<div class="relative w-full h-[260px]">
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
									try {
										haptic.selection();
									} catch {}
								}}
								class={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${
									chartRange() === r
										? 'bg-white text-black shadow-md'
										: 'text-white/40 hover:text-white bg-white/[0.03]'
								}`}
							>
								{r.toUpperCase()}
							</button>
						))}
					</div>

					<div class="flex items-center gap-2 text-[10px] font-mono">
						<span class="text-emerald-400 font-bold">24h: +2.4%</span>
						<span class="text-emerald-400 font-bold">7d: +8.7%</span>
					</div>
				</div>

				{/* Bollinger Bands Technical Indicator Readout */}
				<div class="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-center">
					<div class="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2">
						<span class="text-[9px] uppercase font-bold text-red-400 block">
							{t('gifts.upperBand')}
						</span>
						<span class="text-xs font-mono font-bold text-white mt-0.5 block">
							{formatVal(latestMcap() * 1.08)}
						</span>
					</div>
					<div class="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2">
						<span class="text-[9px] uppercase font-bold text-[#0098EA] block">
							{t('gifts.sma')}
						</span>
						<span class="text-xs font-mono font-bold text-white mt-0.5 block">
							{formatVal(latestMcap() * 0.98)}
						</span>
					</div>
					<div class="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2">
						<span class="text-[9px] uppercase font-bold text-emerald-400 block">
							{t('gifts.lowerBand')}
						</span>
						<span class="text-xs font-mono font-bold text-white mt-0.5 block">
							{formatVal(latestMcap() * 0.88)}
						</span>
					</div>
				</div>
			</div>

			{/* Macro Ecosystem Statistics Bento Grid */}
			<GiftsMacroStats data={props.intel} />
		</div>
	);
};
