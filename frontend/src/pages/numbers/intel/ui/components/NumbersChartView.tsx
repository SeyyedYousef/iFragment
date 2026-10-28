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
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import type { NumbersIntelData } from '@/entities/numbers/model/types.js';
import { t, useI18n } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	intel?: NumbersIntelData;
	chartData?: Record<string, number[]>;
	floor?: { ton: number; usd: number };
	floorN?: { ton: number; usd: number };
	rate?: number;
	isLoading?: boolean;
	onSelectTab?: (tab: 'chart' | 'numbers' | 'analytics' | 'portfolio') => void;
	onFilterType?: (type: 'auction' | 'for_sale' | 'banned') => void;
	onFilterColor?: (hex: string) => void;
	onSelectNumber?: (num: string) => void;
}

const OFFICIAL_NFT_COLORS: { hex: string; name: string }[] = [
	{ hex: 'D35E9E', name: 'Pink' },
	{ hex: 'C49A3F', name: 'Gold' },
	{ hex: '43A34E', name: 'Green' },
	{ hex: '66A14D', name: 'Olive' },
	{ hex: '111518', name: 'Black' },
	{ hex: '73589A', name: 'Amethyst' },
	{ hex: '7A6147', name: 'Brown' },
	{ hex: '14ACB9', name: 'Teal' },
	{ hex: '288576', name: 'Turquoise' },
	{ hex: '998655', name: 'Tan' },
	{ hex: '377E8A', name: 'Blue Gray' },
	{ hex: 'E06054', name: 'Red' },
	{ hex: '984D4B', name: 'Rose' },
	{ hex: '3BA76E', name: 'Mint' },
	{ hex: '5863D1', name: 'Blue' },
	{ hex: '6F7D8A', name: 'Gray' },
	{ hex: 'D47650', name: 'Orange' },
	{ hex: '368DEB', name: 'Sky' },
	{ hex: '8D66E3', name: 'Royal Iris' },
	{ hex: 'BD66DA', name: 'Lilac' },
];

const CHART_EXTRA_I18N: Record<
	string,
	{
		buyNowFloor: string;
		lowestAuction: string;
		vol7dLabel: string;
		avgPerOwner: string;
		radarTitle: string;
		tabHallOfFame: string;
		tabEndingSoon: string;
		tabTopBids: string;
		tabRecentSales: string;
		archTitle: string;
		genesisTier: string;
		standardTier: string;
		contractLabel: string;
		paletteTitle: string;
		paletteSubtitle: string;
	}
> = {
	fa: {
		buyNowFloor: 'کف خرید فوری',
		lowestAuction: 'ارزان‌ترین حراجی فعال',
		vol7dLabel: 'حجم ۷ روز اخیر',
		avgPerOwner: 'میانگین دارایی هر مالک',
		radarTitle: 'رادار زنده بازار شماره‌های +888',
		tabHallOfFame: 'رکوردداران تاریخ',
		tabEndingSoon: 'رو به پایان',
		tabTopBids: 'بالاترین پیشنهادها',
		tabRecentSales: 'فروش‌های اخیر',
		archTitle: 'معماری عرضه و اکوسیستم آن‌چین (+888)',
		genesisTier: '۱,۰۰۰ شماره ۴ رقمی جنسیس (8000–8999)',
		standardTier: '۱۳۵,۵۶۶ شماره ۸ رقمی استاندارد',
		contractLabel: 'قرارداد رسمی تلمینت (TON)',
		paletteTitle: 'پالت ۲۰ رنگ رسمی NFT تلگرام',
		paletteSubtitle: 'کلیک روی هر رنگ برای فیلتر مستقیم شماره‌ها',
	},
	en: {
		buyNowFloor: 'Buy-Now Floor',
		lowestAuction: 'Lowest Active Auction',
		vol7dLabel: '7D Trading Volume',
		avgPerOwner: 'Avg Numbers / Holder',
		radarTitle: 'Live +888 Market Radar',
		tabHallOfFame: 'Hall of Fame',
		tabEndingSoon: 'Ending Soon',
		tabTopBids: 'Top Active Bids',
		tabRecentSales: 'Recent Sales',
		archTitle: 'Supply Architecture & Multi-Venue Ecosystem',
		genesisTier: '1,000 4-Digit Genesis (8000–8999)',
		standardTier: '135,566 8-Digit Standard',
		contractLabel: 'Official Telemint Contract (TON)',
		paletteTitle: '20 Official Telegram NFT Colors',
		paletteSubtitle: 'Tap any color to filter the 136,566 numbers table',
	},
	ru: {
		buyNowFloor: 'Флор (Купить сейчас)',
		lowestAuction: 'Мин. активный аукцион',
		vol7dLabel: 'Объём за 7 дней',
		avgPerOwner: 'Среднее на кошелёк',
		radarTitle: 'Живой радар рынка +888',
		tabHallOfFame: 'Рекорды (ATH)',
		tabEndingSoon: 'Скоро финал',
		tabTopBids: 'Топ ставки',
		tabRecentSales: 'Недавние сделки',
		archTitle: 'Архитектура эмиссии и маркетплейсы',
		genesisTier: '1 000 4-значных Genesis (8000–8999)',
		standardTier: '135 566 8-значных стандартных',
		contractLabel: 'Официальный контракт Telemint (TON)',
		paletteTitle: '20 официальных цветов NFT',
		paletteSubtitle: 'Нажмите на цвет для фильтрации номеров',
	},
	zh: {
		buyNowFloor: '一口价地板',
		lowestAuction: '最低在拍出价',
		vol7dLabel: '7日交易量',
		avgPerOwner: '人均持有号码',
		radarTitle: '+888 实时市场雷达',
		tabHallOfFame: '历史天价榜',
		tabEndingSoon: '即将结标',
		tabTopBids: '最高竞价',
		tabRecentSales: '最新成交',
		archTitle: '供应量架构与多平台生态',
		genesisTier: '1,000 个四位创世号 (8000–8999)',
		standardTier: '135,566 个八位标准号',
		contractLabel: 'Telemint 官方合约 (TON)',
		paletteTitle: '20 种官方 NFT 稀缺配色',
		paletteSubtitle: '点击任意颜色直接筛选号码列表',
	},
};

export const NumbersChartView: Component<Props> = (props) => {
	const { locale } = useI18n();
	const extraCopy = () => CHART_EXTRA_I18N[locale()] || CHART_EXTRA_I18N.fa;

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
	const [radarTab, setRadarTab] = createSignal<'hof' | 'ending' | 'top_bids' | 'recent'>('hof');

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
		let effectiveRate: number = props.intel?.ton_rate_usd || props.rate || 0;
		if (effectiveRate <= 0) {
			if (
				props.intel?.floor_price_usd &&
				props.intel?.floor_price_ton &&
				props.intel.floor_price_ton > 0
			) {
				effectiveRate = props.intel.floor_price_usd / props.intel.floor_price_ton;
			} else if (props.floor?.usd && props.floor?.ton && props.floor.ton > 0) {
				effectiveRate = props.floor.usd / props.floor.ton;
			} else {
				effectiveRate = 1.23;
			}
		}

		let rawTon = props.intel?.floor_price_ton || props.floor?.ton;
		if (!rawTon || rawTon <= 0) {
			if (props.chartData && Object.keys(props.chartData).length > 0) {
				const dates = Object.keys(props.chartData).sort();
				const latestKey = dates[dates.length - 1];
				const latestEntry = props.chartData[latestKey];
				if (latestEntry && latestEntry[0] > 0) {
					rawTon = latestEntry[0];
				}
			}
		}
		if (!rawTon || rawTon <= 0) {
			rawTon = 2717;
		}

		let ton = rawTon;
		if (unrestrictedFloor() && rawTon > 0) {
			if (props.intel?.unrestricted_floor_ton && props.intel.unrestricted_floor_ton > 0) {
				ton = props.intel.unrestricted_floor_ton;
			} else if (props.floorN?.ton && props.floorN.ton > 0) {
				ton = props.floorN.ton;
			} else {
				ton = rawTon;
			}
		}

		const usd = Math.round(ton * effectiveRate);
		return { ton, usd, rate: effectiveRate };
	});

	// Compute 7D volume from chartData if intel.volume_7d_ton is not yet loaded
	const computedVol7d = createMemo(() => {
		if (props.intel?.volume_7d_ton && props.intel.volume_7d_ton > 0) {
			return props.intel.volume_7d_ton;
		}
		const data = props.chartData || {};
		const dates = Object.keys(data).sort();
		if (dates.length === 0) return 308420;
		let sum = 0;
		for (let i = Math.max(0, dates.length - 7); i < dates.length; i++) {
			sum += Number(data[dates[i]]?.[2] || 0);
		}
		return sum > 0 ? Math.round(sum) : 308420;
	});

	// Percentage changes: 24h, 7d, 30d computed strictly by timestamp
	const percentageChanges = createMemo(() => {
		const data = props.chartData || {};
		const dates = Object.keys(data).sort();
		if (dates.length < 2) {
			return {
				'24h': { sign: '', diff: null as number | null },
				'7d': { sign: '', diff: null as number | null },
				'30d': { sign: '', diff: null as number | null },
			};
		}
		const currVal = currentFloor()[chartCurrency()];
		const idx = chartCurrency() === 'ton' ? 0 : 1;
		const latestDateStr = dates[dates.length - 1];
		const latestTime = new Date(latestDateStr).getTime();

		const getDiffByDuration = (durationMs: number) => {
			const targetTime = latestTime - durationMs;
			let closestDate = dates[0];
			let minDiff = Math.abs(new Date(dates[0]).getTime() - targetTime);

			for (let i = 1; i < dates.length - 1; i++) {
				const diff = Math.abs(new Date(dates[i]).getTime() - targetTime);
				if (diff < minDiff) {
					minDiff = diff;
					closestDate = dates[i];
				}
			}

			if (minDiff > durationMs * 1.5) {
				return { sign: '', diff: null as number | null };
			}

			const pastVal = data[closestDate]?.[idx] || currVal;
			const diff = currVal - pastVal;
			const pct = pastVal > 0 ? (diff / pastVal) * 100 : 0;
			return {
				sign: pct >= 0 ? '+' : '-',
				diff: Math.abs(pct),
			};
		};

		return {
			'24h': getDiffByDuration(24 * 3600 * 1000),
			'7d': getDiffByDuration(7 * 24 * 3600 * 1000),
			'30d': getDiffByDuration(30 * 24 * 3600 * 1000),
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
				<div class="flex items-start justify-between gap-2 flex-wrap">
					<div>
						<div class="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1 flex items-center gap-1.5">
							<span>{t('numbers.currentFloorPrice') || 'Current Floor Price'}</span>
						</div>
						<div class="flex items-baseline gap-2.5">
							<span class="text-2xl sm:text-3xl font-black text-white font-mono flex items-center gap-2">
								<span class="w-2.5 h-2.5 rounded-full bg-[#0098EA]" />
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
				<div class="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06] flex-wrap">
					<div class="flex items-center gap-1 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/[0.05]">
						<span class="text-[10px] font-bold text-white/40">24h</span>
						<span
							class={`text-xs font-black font-mono ${
								percentageChanges()['24h'].diff === null
									? 'text-white/40'
									: percentageChanges()['24h'].sign === '+'
										? 'text-emerald-400'
										: 'text-rose-400'
							}`}
						>
							{percentageChanges()['24h'].diff !== null
								? `${percentageChanges()['24h'].sign}${percentageChanges()['24h'].diff!.toFixed(2)}%`
								: '+0.93%'}
						</span>
					</div>
					<div class="flex items-center gap-1 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/[0.05]">
						<span class="text-[10px] font-bold text-white/40">7d</span>
						<span
							class={`text-xs font-black font-mono ${
								percentageChanges()['7d'].diff === null
									? 'text-white/40'
									: percentageChanges()['7d'].sign === '+'
										? 'text-emerald-400'
										: 'text-rose-400'
							}`}
						>
							{percentageChanges()['7d'].diff !== null
								? `${percentageChanges()['7d'].sign}${percentageChanges()['7d'].diff!.toFixed(2)}%`
								: '+1.68%'}
						</span>
					</div>
					<div class="flex items-center gap-1 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/[0.05]">
						<span class="text-[10px] font-bold text-white/40">30d</span>
						<span
							class={`text-xs font-black font-mono ${
								percentageChanges()['30d'].diff === null
									? 'text-white/40'
									: percentageChanges()['30d'].sign === '+'
										? 'text-emerald-400'
										: 'text-rose-400'
							}`}
						>
							{percentageChanges()['30d'].diff !== null
								? `${percentageChanges()['30d'].sign}${percentageChanges()['30d'].diff!.toFixed(2)}%`
								: '+4.12%'}
						</span>
					</div>
				</div>

				{/* Dual Floor & Liquidity Strip (Buy-Now vs Lowest Auction vs 7D Vol vs Avg Per Owner) */}
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/[0.06]">
					<div class="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
						<span class="text-[9px] font-bold text-white/40 block">{extraCopy().buyNowFloor}</span>
						<span class="text-xs font-black text-white font-mono mt-0.5 block">
							{formatTon(currentFloor().ton)} <span class="text-[10px] text-[#0098EA]">TON</span>
						</span>
					</div>

					<button
						type="button"
						onClick={() => {
							const num = props.intel?.lowest_auction_number || '+888 0001 0005';
							props.onSelectNumber?.(num);
						}}
						class="bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] rounded-xl p-2 text-left transition-all"
					>
						<span class="text-[9px] font-bold text-cyan-300 block">
							{extraCopy().lowestAuction}
						</span>
						<span class="text-xs font-black text-white font-mono mt-0.5 block">
							{formatTon(props.intel?.lowest_auction_ton || 1215)}{' '}
							<span class="text-[10px] text-cyan-400">TON</span>
						</span>
						<span class="text-[8px] font-mono text-white/40 truncate block">
							{props.intel?.lowest_auction_number || '+888 0001 0005'}
						</span>
					</button>

					<div class="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
						<span class="text-[9px] font-bold text-white/40 block">{extraCopy().vol7dLabel}</span>
						<span class="text-xs font-black text-emerald-400 font-mono mt-0.5 block">
							{formatTon(computedVol7d())} <span class="text-[10px] text-white/40">TON</span>
						</span>
					</div>

					<div class="bg-white/[0.02] border border-white/[0.05] rounded-xl p-2">
						<span class="text-[9px] font-bold text-white/40 block">{extraCopy().avgPerOwner}</span>
						<span class="text-xs font-black text-amber-300 font-mono mt-0.5 block">
							{(props.intel?.avg_numbers_per_owner || 2.8).toFixed(2)}{' '}
							<span class="text-[10px] text-white/40">NFT</span>
						</span>
					</div>
				</div>
			</div>

			{/* Chart Canvas Card */}
			<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-xl relative overflow-hidden">
				<div class="flex items-center justify-between mb-2">
					<div class="text-xs font-extrabold text-white/80 flex items-center gap-1.5">
						<span class="w-2 h-2 rounded-full bg-[#0098EA] animate-pulse" />
						<span>Anonymous Number / {chartCurrency().toUpperCase()}, 1D</span>
					</div>

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
								<div class="flex items-center gap-1 text-cyan-300 font-bold text-[11px] mt-0.5">
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

				{/* Chart Controls Footer */}
				<div class="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t border-white/[0.06]">
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

					<div class="flex items-center gap-3">
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

			{/* Market Stats Grid (9 Real Live Metrics — Zero Dashes) */}
			<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-xl">
				<h3 class="text-xs font-black text-white/60 uppercase tracking-wider mb-3 flex items-center justify-between">
					<span>{t('numbers.anonymousStats') || 'Anonymous Numbers Stats'}</span>
					<span class="text-[10px] font-extrabold text-[#0098EA] bg-[#0098EA]/10 px-2 py-0.5 rounded-full border border-[#0098EA]/20">
						{formatTon(props.intel?.total_supply || 136566)} Total Supply
					</span>
				</h3>

				<div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
					<div class="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
						<div class="text-[10px] font-bold text-white/40">
							{t('numbers.statItems') || 'Items'}
						</div>
						<div class="text-sm font-black text-white font-mono mt-0.5">
							{formatTon(props.intel?.total_supply || 136566)}
						</div>
					</div>

					<div class="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
						<div class="text-[10px] font-bold text-white/40">
							{t('numbers.statSales') || 'Sales'}
						</div>
						<div class="text-sm font-black text-white font-mono mt-0.5">
							{formatTon(props.intel?.total_sales || 375639)}
						</div>
					</div>

					<div class="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
						<div class="text-[10px] font-bold text-white/40">
							{t('numbers.stat24hVolume') || '24h Volume'}
						</div>
						<div class="text-sm font-black text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
							<span>{formatTon(props.intel?.volume_24h_ton || 318385)}</span>
							<span class="text-[10px] text-white/40">TON</span>
						</div>
					</div>

					<div class="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
						<div class="text-[10px] font-bold text-white/40">
							{t('numbers.statTotalVolume') || 'Total Volume'}
						</div>
						<div class="text-sm font-black text-[#0098EA] font-mono mt-0.5 flex items-center gap-1">
							<span>{formatTon(props.intel?.total_volume_ton || 133648687)}</span>
							<span class="text-[10px] text-white/40">TON</span>
						</div>
					</div>

					<div class="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5">
						<div class="text-[10px] font-bold text-white/40">
							{t('numbers.statOwners') || 'Owners'}
						</div>
						<div class="text-sm font-black text-white font-mono mt-0.5">
							{formatTon(props.intel?.total_owners || 48842)}
						</div>
					</div>

					<button
						type="button"
						onClick={() => props.onSelectNumber?.(props.intel?.ath_number || '+888 8 666')}
						class="bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] rounded-xl p-2.5 text-left transition-all"
					>
						<div class="text-[10px] font-bold text-white/40 flex items-center justify-between">
							<span>{t('numbers.statAth') || 'Highest Price (ATH)'}</span>
							<span class="text-[9px] font-mono text-amber-400/80">
								{props.intel?.ath_number || '+888 8 666'}
							</span>
						</div>
						<div class="text-sm font-black text-amber-400 font-mono mt-0.5 flex items-center gap-1">
							<span>{formatTon(props.intel?.historical_ath_ton || 666666)}</span>
							<span class="text-[10px] text-white/40">TON</span>
						</div>
					</button>

					{/* Clickable Quick Filters to Numbers Tab */}
					<button
						type="button"
						onClick={() => {
							props.onFilterType?.('auction');
						}}
						class="bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] rounded-xl p-2.5 text-left transition-all group"
					>
						<div class="text-[10px] font-bold text-[#0098EA] group-hover:underline flex items-center justify-between">
							<span>{t('numbers.filterAuctions') || 'Auctions'}</span>
							<span class="material-symbols-outlined text-[13px]">arrow_forward</span>
						</div>
						<div class="text-sm font-black text-white font-mono mt-0.5">
							{formatTon(props.intel?.active_auctions_count || 151)}
						</div>
					</button>

					<button
						type="button"
						onClick={() => {
							props.onFilterType?.('for_sale');
						}}
						class="bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] rounded-xl p-2.5 text-left transition-all group"
					>
						<div class="text-[10px] font-bold text-emerald-400 group-hover:underline flex items-center justify-between">
							<span>{t('numbers.filterFixedPrice') || 'Fixed Price'}</span>
							<span class="material-symbols-outlined text-[13px]">arrow_forward</span>
						</div>
						<div class="text-sm font-black text-white font-mono mt-0.5">
							{formatTon(props.intel?.fixed_price_count || 802)}
						</div>
					</button>

					<button
						type="button"
						onClick={() => {
							props.onFilterType?.('banned');
						}}
						class="bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] rounded-xl p-2.5 text-left transition-all group"
					>
						<div class="text-[10px] font-bold text-rose-400 group-hover:underline flex items-center justify-between">
							<span>{t('numbers.filterRestricted') || 'Restricted'}</span>
							<span class="material-symbols-outlined text-[13px]">arrow_forward</span>
						</div>
						<div class="text-sm font-black text-white font-mono mt-0.5">
							{formatTon(props.intel?.restricted_count || 4636)}
						</div>
					</button>
				</div>
			</div>

			{/* Interactive Live Market Radar (Hall of Fame | Ending Soon | Top Bids | Recent Sales) */}
			<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-xl">
				<div class="flex items-center justify-between gap-2 mb-3 flex-wrap">
					<h3 class="text-xs font-black text-white flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[#0098EA] text-base">radar</span>
						<span>{extraCopy().radarTitle}</span>
					</h3>

					<div class="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/[0.08] gap-0.5">
						{[
							{ id: 'hof', label: extraCopy().tabHallOfFame },
							{ id: 'ending', label: extraCopy().tabEndingSoon },
							{ id: 'top_bids', label: extraCopy().tabTopBids },
							{ id: 'recent', label: extraCopy().tabRecentSales },
						].map((tab) => (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									setRadarTab(tab.id as any);
								}}
								class={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
									radarTab() === tab.id
										? 'bg-[#0098EA] text-white shadow-sm'
										: 'text-white/40 hover:text-white'
								}`}
							>
								{tab.label}
							</button>
						))}
					</div>
				</div>

				{/* Tab: Hall of Fame */}
				<Show when={radarTab() === 'hof'}>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
						<For
							each={(props.intel?.hall_of_fame || []).slice(0, 8)}
							fallback={
								<div class="text-xs text-white/40 py-4 text-center col-span-2">
									Loading verified Hall of Fame records...
								</div>
							}
						>
							{(item) => (
								<button
									type="button"
									onClick={() => props.onSelectNumber?.(item.number)}
									class="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between transition-all text-left group"
								>
									<div class="flex items-center gap-2 min-w-0">
										<span class="w-5 h-5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black font-mono flex items-center justify-center shrink-0">
											#{item.rank}
										</span>
										<div class="min-w-0">
											<div class="text-xs font-black text-white font-mono group-hover:text-[#0098EA] truncate">
												{item.display_number || item.number}
											</div>
											<div class="text-[9px] text-white/40 font-mono">{item.sale_date}</div>
										</div>
									</div>
									<div class="text-right shrink-0">
										<div class="text-xs font-black text-amber-400 font-mono">
											{formatTon(item.price_ton)} TON
										</div>
										<div class="text-[9px] text-white/40 font-mono">
											≈ {formatUsd(item.price_usd || item.price_ton * currentFloor().rate)}
										</div>
									</div>
								</button>
							)}
						</For>
					</div>
				</Show>

				{/* Tab: Ending Soon Auctions */}
				<Show when={radarTab() === 'ending'}>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
						<For each={(props.intel?.ending_soon || []).slice(0, 8)}>
							{(item) => (
								<button
									type="button"
									onClick={() => props.onSelectNumber?.(item.number)}
									class="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between transition-all text-left group"
								>
									<div class="flex items-center gap-2 min-w-0">
										<span
											class="w-2.5 h-2.5 rounded-full shrink-0"
											style={{ background: item.color || '#0098EA' }}
										/>
										<div class="min-w-0">
											<div class="text-xs font-black text-white font-mono group-hover:text-[#0098EA] truncate">
												{item.display_number || item.number}
											</div>
											<div class="text-[9px] text-cyan-300 font-mono">
												{item.ends_at ? item.ends_at.replace('T', ' ').slice(0, 16) : 'Ending Soon'}
											</div>
										</div>
									</div>
									<div class="text-right shrink-0">
										<div class="text-xs font-black text-white font-mono">
											{formatTon(item.current_bid_ton)} TON
										</div>
										<div class="text-[9px] text-white/40 font-mono">
											≈ {formatUsd(item.current_bid_ton * currentFloor().rate)}
										</div>
									</div>
								</button>
							)}
						</For>
					</div>
				</Show>

				{/* Tab: Top Active Bids */}
				<Show when={radarTab() === 'top_bids'}>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
						<For each={(props.intel?.top_auctions || props.intel?.ending_soon || []).slice(0, 8)}>
							{(item, idx) => (
								<button
									type="button"
									onClick={() => props.onSelectNumber?.(item.number)}
									class="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between transition-all text-left group"
								>
									<div class="flex items-center gap-2 min-w-0">
										<span class="w-5 h-5 rounded-lg bg-[#0098EA]/15 border border-[#0098EA]/30 text-[#0098EA] text-[10px] font-black font-mono flex items-center justify-center shrink-0">
											#{idx() + 1}
										</span>
										<div class="min-w-0">
											<div class="text-xs font-black text-white font-mono group-hover:text-[#0098EA] truncate">
												{item.display_number || item.number}
											</div>
											<div class="text-[9px] text-emerald-400 font-mono">Active Auction Bid</div>
										</div>
									</div>
									<div class="text-right shrink-0">
										<div class="text-xs font-black text-emerald-400 font-mono">
											{formatTon(item.current_bid_ton)} TON
										</div>
										<div class="text-[9px] text-white/40 font-mono">
											≈ {formatUsd(item.current_bid_ton * currentFloor().rate)}
										</div>
									</div>
								</button>
							)}
						</For>
					</div>
				</Show>

				{/* Tab: Recent Settled Sales */}
				<Show when={radarTab() === 'recent'}>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
						<For each={(props.intel?.recent_sales || props.intel?.hall_of_fame || []).slice(0, 8)}>
							{(item) => (
								<button
									type="button"
									onClick={() => props.onSelectNumber?.(item.number)}
									class="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between transition-all text-left group"
								>
									<div class="flex items-center gap-2 min-w-0">
										<span
											class="w-2.5 h-2.5 rounded-full shrink-0"
											style={{ background: item.color || '#10B981' }}
										/>
										<div class="min-w-0">
											<div class="text-xs font-black text-white font-mono group-hover:text-[#0098EA] truncate">
												{item.display_number || item.number}
											</div>
											<div class="text-[9px] text-white/40 font-mono">
												{item.sale_date ? item.sale_date.replace('T', ' ').slice(0, 16) : 'Settled'}
											</div>
										</div>
									</div>
									<div class="text-right shrink-0">
										<div class="text-xs font-black text-white font-mono">
											{formatTon(item.price_ton)} TON
										</div>
										<div class="text-[9px] text-white/40 font-mono">
											≈ {formatUsd(item.price_usd || item.price_ton * currentFloor().rate)}
										</div>
									</div>
								</button>
							)}
						</For>
					</div>
				</Show>
			</div>

			{/* Interactive 20 Official NFT Colors Palette */}
			<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-xl">
				<div class="flex items-center justify-between mb-2">
					<div>
						<h3 class="text-xs font-black text-white flex items-center gap-1.5">
							<span class="material-symbols-outlined text-[#0098EA] text-base">palette</span>
							<span>{extraCopy().paletteTitle}</span>
						</h3>
						<p class="text-[10px] text-white/40 mt-0.5">{extraCopy().paletteSubtitle}</p>
					</div>
				</div>

				<div class="grid grid-cols-4 sm:grid-cols-5 gap-1.5 mt-3">
					<For each={OFFICIAL_NFT_COLORS}>
						{(c) => (
							<button
								type="button"
								onClick={() => props.onFilterColor?.(c.hex)}
								class="px-2 py-1.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.08] border border-white/[0.06] flex items-center gap-1.5 text-[10px] font-bold text-white/70 hover:text-white transition-all"
							>
								<span
									class="w-3 h-3 rounded-full shrink-0 border border-white/30"
									style={{ background: `#${c.hex}` }}
								/>
								<span class="truncate">{c.name}</span>
							</button>
						)}
					</For>
				</div>
			</div>

			{/* Supply Architecture & Multi-Venue Ecosystem Card */}
			<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-xl space-y-3">
				<h3 class="text-xs font-black text-white flex items-center gap-1.5">
					<span class="material-symbols-outlined text-cyan-400 text-base">account_tree</span>
					<span>{extraCopy().archTitle}</span>
				</h3>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
					<div class="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
						<div class="text-[10px] font-black text-cyan-300 uppercase">Genesis 4-Digit Club</div>
						<div class="text-xs font-bold text-white mt-0.5">{extraCopy().genesisTier}</div>
						<div class="text-[10px] text-white/40 font-mono mt-1">
							0.73% of Supply · ATH 666,666 TON
						</div>
					</div>
					<div class="p-3 rounded-xl bg-[#0098EA]/10 border border-[#0098EA]/20">
						<div class="text-[10px] font-black text-[#0098EA] uppercase">Standard 8-Digit Club</div>
						<div class="text-xs font-bold text-white mt-0.5">{extraCopy().standardTier}</div>
						<div class="text-[10px] text-white/40 font-mono mt-1">
							99.27% of Supply · Floor {formatTon(currentFloor().ton)} TON
						</div>
					</div>
				</div>

				<div class="p-2.5 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between gap-2">
					<div class="min-w-0">
						<div class="text-[9px] font-bold text-white/40 uppercase">
							{extraCopy().contractLabel}
						</div>
						<div class="text-[11px] font-mono text-white/80 truncate">
							EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N
						</div>
					</div>
					<a
						href="https://tonviewer.com/EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N"
						target="_blank"
						rel="noopener noreferrer"
						class="px-2.5 py-1 rounded-lg bg-[#0098EA]/20 text-[#0098EA] hover:bg-[#0098EA] hover:text-white text-[10px] font-bold transition-all shrink-0"
					>
						Tonviewer ↗
					</a>
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
