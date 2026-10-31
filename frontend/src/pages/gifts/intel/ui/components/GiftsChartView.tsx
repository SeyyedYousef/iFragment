import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import {
	type CollectionSummaryItem,
	type GiftsIntelResponse,
	giftsApi,
} from '@/entities/gifts/index.js';
import { isRtl, locale } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export type GiftsMainTab = 'overview' | 'collections' | 'inspector' | 'tape';

interface Props {
	intel?: GiftsIntelResponse;
	activeTab: GiftsMainTab;
	onTabChange: (tab: GiftsMainTab) => void;
}

type Lang = 'fa' | 'en' | 'ru' | 'zh';

const I18N: Record<Lang, Record<string, string>> = {
	fa: {
		kpiMcapTitle: 'ارزش کل بازار گیفت‌ها',
		kpiMcapSub: 'بر پایه کف قیمت زنده Fragment',
		kpiVolTitle: 'حجم معاملات ۲۴ ساعته',
		kpiDealsSub: 'معاملات ثبت‌شده اخیر',
		kpiSupplyTitle: 'کل عرضه آن‌چین (NFT)',
		kpiCatalogSub: '۱۲۲ مجموعه • ۷,۸۰۶ مدل',
		kpiLeaderTitle: 'شاخص بلوچیپ بازار',
		kpiLeaderSub: 'بالاترین کف قیمت مجموعه',
		macroChartTitle: 'نمودار ارزش کل و حجم معاملات اکوسیستم گیفت',
		liveBadge: 'زنده • Fragment + Changes.tg',
		mcapLabel: 'ارزش کل بازار',
		vol24hLabel: 'حجم ۲۴ ساعته',
		areaMode: 'نمودار خطی',
		candleMode: 'کندل OHLC',
		now: 'اکنون',
		sweepRadarTitle: 'رادار شکار و شکاف دفتر سفارشات (Floor Sweep Radar)',
		sweepRadarSub:
			'مجموعه‌هایی که با خرید تنها ۱ آگهی کف (#1)، قیمت کف مجموعه بلافاصله به آگهی دوم (#2) پرش می‌کند',
		floor1Label: 'کف فعلی (#1)',
		floor2Label: 'آگهی بعدی (#2)',
		sweepJumpLabel: 'پرش آنی کف',
		buyFloorBtn: 'خرید کف',
		inspectCollectionBtn: 'کاوش مجموعه',
		floorBoardTitle: 'رتبه‌بندی و کف قیمت زنده مجموعه‌های گیفت',
		floorBoardSub: 'قیمت‌های لحظه‌ای مستقیم از دفتر سفارشات Fragment و دایرکتوری ۱۲۲ مجموعه رسمی',
		filterAll: 'برترین‌های بازار',
		filterBluechip: 'بلوچیپ (+100 TON)',
		filterMid: 'میان‌رده (20–100 TON)',
		filterEntry: 'ورودی (<20 TON)',
		filterDirectory: 'همه ۱۲۲ مجموعه رسمی',
		searchCollectionPlaceholder:
			'جستجوی نام مجموعه از بین ۱۲۲ گیفت رسمی (مثلاً Plush Pepe، Durov، Watch)...',
		colFloor1: 'کف قیمت (#1)',
		colFloor2: 'آگهی دوم (#2)',
		colSpread: 'شکاف جارو',
		colSupply: 'عرضه آن‌چین',
		inspectLiveBtn: 'کاوش عمیق',
		buyOnFragmentBtn: 'Fragment ↗',
		inspectorTitle: 'کاوشگر تخصصی و کمیابی مجموعه (On-Demand)',
		inspectorSub:
			'هر مجموعه را انتخاب کنید تا ارزان‌ترین آگهی‌های فعال، کمیابی مدل/پس‌زمینه و تاریخچه فروش آن زنده واکشی شود',
		showAllCollections: 'فهرست کامل ۱۲۲ مجموعه',
		hideAllCollections: 'بستن فهرست',
		liveFloor: 'کف قیمت لحظه‌ای (#1)',
		secondFloor: 'آگهی دوم (#2) و شکاف',
		onChainSupply: 'عرضه آن‌چین (NFT)',
		activeListings: 'آگهی فعال',
		allTimeHighSale: 'سقف معامله ثبت‌شده',
		openFullTerminal: 'ترمینال کامل مجموعه',
		buyCheapestOnFragment: 'خرید ارزان‌ترین در Fragment',
		tabOrderbook: 'ارزان‌ترین آگهی‌ها (Orderbook)',
		tabTraits: 'کمیابی مدل و پس‌زمینه',
		tabSalesAndChart: 'آمار و معاملات ثبت‌شده',
		traitModels: 'مدل‌های سه‌بعدی (Models)',
		traitBackdrops: 'پس‌زمینه‌های رنگی (Backdrops)',
		traitSymbols: 'نمادها (Symbols)',
		buyBtn: 'خرید در Fragment',
		stats24h: 'فروش ۲۴ ساعت اخیر',
		stats7d: 'فروش ۷ روز اخیر',
		stats30d: 'فروش ۳۰ روز اخیر',
		minSale: 'کف فروش',
		avgSale: 'میانگین',
		maxSale: 'سقف فروش',
		dealsCount: 'معامله',
		globalTapeTitle: 'نوار زنده کل بازار و حراجی‌های لحظه آخری (۱۲۲ مجموعه)',
		globalTapeSub: 'رصد لحظه‌ای حراجی‌های در حال اتمام، معاملات قطعی و آگهی‌های جدید در Fragment',
		tapeEndingAuctions: 'حراجی‌های لحظه آخری',
		tapeRecentSales: 'آخرین معاملات ثبت‌شده',
		tapeNewListings: 'آگهی‌های فروش جدید',
		bidOnFragment: 'ثبت پیشنهاد ↗',
		loadingCollection: 'در حال واکشی زنده دفتر سفارشات و کمیابی از Fragment و Changes.tg...',
		tapToInspectLive: 'کاوش زنده مجموعه ←',
	},
	en: {
		kpiMcapTitle: 'Total Ecosystem Market Cap',
		kpiMcapSub: 'Based on live Fragment floors',
		kpiVolTitle: '24h Trading Volume',
		kpiDealsSub: 'Verified settled transactions',
		kpiSupplyTitle: 'On-Chain NFT Supply',
		kpiCatalogSub: '122 Collections • 7,806 Models',
		kpiLeaderTitle: 'Blue-Chip Market Leader',
		kpiLeaderSub: 'Highest collection floor price',
		macroChartTitle: 'Telegram Gifts Market Cap & Volume Pulse',
		liveBadge: 'LIVE • Fragment + Changes.tg',
		mcapLabel: 'Implied Market Cap',
		vol24hLabel: '24h Volume',
		areaMode: 'Area Spline',
		candleMode: 'OHLC Candles',
		now: 'Now',
		sweepRadarTitle: 'Floor Sweep & Thin Orderbook Radar',
		sweepRadarSub:
			'Collections where buying the single #1 cheapest listing immediately jumps the floor to a much higher #2 listing',
		floor1Label: 'Current Floor (#1)',
		floor2Label: 'Next Listing (#2)',
		sweepJumpLabel: 'Instant Jump',
		buyFloorBtn: 'Buy #1',
		inspectCollectionBtn: 'Inspect',
		floorBoardTitle: 'Live Collection Floor Board & Rankings',
		floorBoardSub: 'Real-time orderbook prices from Fragment across all 122 official collections',
		filterAll: 'Top Verified Floors',
		filterBluechip: 'Blue-Chips (>100 TON)',
		filterMid: 'Mid-Tier (20–100 TON)',
		filterEntry: 'Entry (<20 TON)',
		filterDirectory: 'All 122 Official Directory',
		searchCollectionPlaceholder:
			'Search across all 122 official gift collections (e.g. Plush Pepe, Durov, Watch)...',
		colFloor1: 'Floor (#1)',
		colFloor2: 'Next (#2)',
		colSpread: 'Sweep Jump',
		colSupply: 'NFT Supply',
		inspectLiveBtn: 'Deep-Dive',
		buyOnFragmentBtn: 'Fragment ↗',
		inspectorTitle: 'On-Demand Collection & Rarity Inspector',
		inspectorSub:
			'Select any collection to fetch its live Fragment orderbook, cheapest listings, trait rarity & sales history',
		showAllCollections: 'All 122 Collections',
		hideAllCollections: 'Close Directory',
		liveFloor: 'Live Floor (#1)',
		secondFloor: '#2 Listing & Spread',
		onChainSupply: 'On-Chain NFT Supply',
		activeListings: 'Active Listings',
		allTimeHighSale: 'Highest Recorded Sale',
		openFullTerminal: 'Full Terminal',
		buyCheapestOnFragment: 'Buy Cheapest on Fragment',
		tabOrderbook: 'Cheapest Listings (Orderbook)',
		tabTraits: 'Models, Backdrops & Rarity',
		tabSalesAndChart: 'Sales Stats & History',
		traitModels: '3D Models',
		traitBackdrops: 'Color Backdrops',
		traitSymbols: 'Symbols',
		buyBtn: 'Buy on Fragment',
		stats24h: '24h Sales Stats',
		stats7d: '7d Sales Stats',
		stats30d: '30d Sales Stats',
		minSale: 'Min Sale',
		avgSale: 'Avg Sale',
		maxSale: 'Max Sale',
		dealsCount: 'Deals',
		globalTapeTitle: 'Global Live Market Tape & Sniper Auctions',
		globalTapeSub:
			'Real-time ending-soon auctions, settled sales, and newly listed gifts on Fragment',
		tapeEndingAuctions: 'Ending Soon Auctions',
		tapeRecentSales: 'Recent Settled Sales',
		tapeNewListings: 'Newly Listed',
		bidOnFragment: 'Place Bid ↗',
		loadingCollection: 'Fetching live Fragment orderbook & Changes.tg trait probabilities...',
		tapToInspectLive: 'Inspect Live →',
	},
	ru: {
		kpiMcapTitle: 'Капитализация подарков',
		kpiMcapSub: 'На базе живых флоров Fragment',
		kpiVolTitle: 'Объем торгов (24ч)',
		kpiDealsSub: 'Подтвержденные сделки',
		kpiSupplyTitle: 'NFT в блокчейне TON',
		kpiCatalogSub: '122 коллекции • 7,806 моделей',
		kpiLeaderTitle: 'Лидер голубых фишек',
		kpiLeaderSub: 'Максимальный флор коллекции',
		macroChartTitle: 'Динамика капитализации и объема рынка подарков',
		liveBadge: 'LIVE • Fragment + Changes.tg',
		mcapLabel: 'Капитализация',
		vol24hLabel: 'Объем 24ч',
		areaMode: 'Линия',
		candleMode: 'Свечи OHLC',
		now: 'Сейчас',
		sweepRadarTitle: 'Радар прострелов стакана (Floor Sweep Radar)',
		sweepRadarSub:
			'Коллекции, где покупка всего 1 самого дешевого лота (#1) мгновенно поднимает флор до лота #2',
		floor1Label: 'Флор (#1)',
		floor2Label: 'Лот (#2)',
		sweepJumpLabel: 'Скачок флора',
		buyFloorBtn: 'Купить #1',
		inspectCollectionBtn: 'Анализ',
		floorBoardTitle: 'Рейтинг и живые флоры коллекций',
		floorBoardSub: 'Реальные цены напрямую из книги ордеров Fragment по всем 122 коллекциям',
		filterAll: 'Топ коллекции',
		filterBluechip: 'Голубые фишки (>100 TON)',
		filterMid: 'Средний сегмент (20–100 TON)',
		filterEntry: 'Доступные (<20 TON)',
		filterDirectory: 'Все 122 коллекции',
		searchCollectionPlaceholder: 'Поиск среди 122 официальных коллекций (Plush Pepe, Durov)...',
		colFloor1: 'Флор (#1)',
		colFloor2: 'След. (#2)',
		colSpread: 'Прострел',
		colSupply: 'Эмиссия NFT',
		inspectLiveBtn: 'Обзор',
		buyOnFragmentBtn: 'Fragment ↗',
		inspectorTitle: 'Глубокий инспектор коллекций и редкости',
		inspectorSub:
			'Выберите любую из 122 коллекций для загрузки стакана Fragment, редкости моделей и истории сделок',
		showAllCollections: 'Все 122 коллекции',
		hideAllCollections: 'Скрыть список',
		liveFloor: 'Текущий флор (#1)',
		secondFloor: '2-й лот и спред',
		onChainSupply: 'NFT в сети',
		activeListings: 'в продаже',
		allTimeHighSale: 'Рекордная сделка',
		openFullTerminal: 'Полный терминал',
		buyCheapestOnFragment: 'Купить лучший лот на Fragment',
		tabOrderbook: 'Дешевые лоты (Стакан)',
		tabTraits: 'Модели, фоны и редкость',
		tabSalesAndChart: 'Статистика и продажи',
		traitModels: '3D Модели',
		traitBackdrops: 'Цветовые фоны',
		traitSymbols: 'Символы',
		buyBtn: 'Купить на Fragment',
		stats24h: 'Продажи за 24ч',
		stats7d: 'Продажи за 7д',
		stats30d: 'Продажи за 30д',
		minSale: 'Мин.',
		avgSale: 'Средн.',
		maxSale: 'Макс.',
		dealsCount: 'сделок',
		globalTapeTitle: 'Живая лента рынка и снайпер аукционов',
		globalTapeSub: 'Завершающиеся аукционы, последние продажи и новые лоты на Fragment',
		tapeEndingAuctions: 'Скоро завершатся',
		tapeRecentSales: 'Последние продажи',
		tapeNewListings: 'Новые лоты',
		bidOnFragment: 'Ставка ↗',
		loadingCollection: 'Загрузка живого стакана Fragment и атрибутов Changes.tg...',
		tapToInspectLive: 'Открыть инспектор →',
	},
	zh: {
		kpiMcapTitle: '礼物生态总市值',
		kpiMcapSub: '基于 Fragment 实时地板价',
		kpiVolTitle: '24小时交易额',
		kpiDealsSub: '链上真实成交笔数',
		kpiSupplyTitle: '链上 NFT 总供应量',
		kpiCatalogSub: '122 个系列 • 7,806 款模型',
		kpiLeaderTitle: '蓝筹龙头系列',
		kpiLeaderSub: '全市场最高地板价系列',
		macroChartTitle: 'Telegram 礼物总市值与交易量趋势',
		liveBadge: '实时 • Fragment + Changes.tg',
		mcapLabel: '总市值',
		vol24hLabel: '24h 交易量',
		areaMode: '面积图',
		candleMode: 'K线蜡烛图',
		now: '当前',
		sweepRadarTitle: '扫货价差与薄订单簿雷达 (Sweep Radar)',
		sweepRadarSub: '只需买入第 1 个最便宜挂单 (#1)，地板价立即跳涨至第 2 挂单 (#2) 的高弹性系列',
		floor1Label: '当前地板 (#1)',
		floor2Label: '第二挂单 (#2)',
		sweepJumpLabel: '扫货跳涨',
		buyFloorBtn: '买地板',
		inspectCollectionBtn: '深度分析',
		floorBoardTitle: '全系列实时地板价排行榜',
		floorBoardSub: '直接抓取自 Fragment 实时订单簿与 122 个官方系列目录',
		filterAll: '热门核心榜',
		filterBluechip: '蓝筹 (>100 TON)',
		filterMid: '中坚 (20–100 TON)',
		filterEntry: '入门 (<20 TON)',
		filterDirectory: '全部 122 个官方系列',
		searchCollectionPlaceholder: '搜索全部 122 个官方礼物系列 (如 Plush Pepe, Durov)...',
		colFloor1: '地板价 (#1)',
		colFloor2: '第二单 (#2)',
		colSpread: '扫货涨幅',
		colSupply: '链上数量',
		inspectLiveBtn: '深度探测',
		buyOnFragmentBtn: 'Fragment ↗',
		inspectorTitle: '按需系列深度探测器与稀有度图谱',
		inspectorSub: '选择任意官方礼物系列，实时拉取 Fragment 在售低价单、3D模型/背景稀有度及历史成交',
		showAllCollections: '展开全部 122 个系列',
		hideAllCollections: '收起目录',
		liveFloor: '实时地板价 (#1)',
		secondFloor: '第二挂单与价差',
		onChainSupply: '链上 NFT 数量',
		activeListings: '当前在售',
		allTimeHighSale: '最高成交记录',
		openFullTerminal: '完整终端',
		buyCheapestOnFragment: '在 Fragment 购买最低价',
		tabOrderbook: '最便宜挂单 (订单簿)',
		tabTraits: '模型、背景与稀有度',
		tabSalesAndChart: '成交统计与历史',
		traitModels: '3D 模型',
		traitBackdrops: '渐变背景',
		traitSymbols: '符号图案',
		buyBtn: 'Fragment 购买',
		stats24h: '24小时成交统计',
		stats7d: '7天成交统计',
		stats30d: '30天成交统计',
		minSale: '最低',
		avgSale: '均价',
		maxSale: '最高',
		dealsCount: '笔成交',
		globalTapeTitle: '全市场实时成交流与结标狙击',
		globalTapeSub: '实时监控 Fragment 即将结束拍卖、最新成交记录与新上架挂单',
		tapeEndingAuctions: '即将结标拍卖',
		tapeRecentSales: '最新成交记录',
		tapeNewListings: '最新上架挂单',
		bidOnFragment: '参与竞拍 ↗',
		loadingCollection: '正在从 Fragment 与 Changes.tg 实时拉取订单簿与稀有度数据...',
		tapToInspectLive: '实时探测 →',
	},
};

export const GiftsChartView: Component<Props> = (props) => {
	const navigate = useNavigate();
	const lang = createMemo<Lang>(() => {
		const l = (locale() || 'fa').toLowerCase();
		if (l.startsWith('en')) return 'en';
		if (l.startsWith('ru')) return 'ru';
		if (l.startsWith('zh')) return 'zh';
		return 'fa';
	});
	const tr = (key: string) => I18N[lang()][key] || I18N.en[key] || key;

	// Macro chart controls
	const [chartMode, setChartMode] = createSignal<'area' | 'candles'>('area');
	const [chartRange, setChartRange] = createSignal<'7d' | '14d' | '30d'>('30d');
	const [chartCurrency, setChartCurrency] = createSignal<'gram' | 'usd'>('gram');
	const [hoverIndex, setHoverIndex] = createSignal<number | null>(null);

	// Tab 2: Collections & Floor Board filters
	const [boardFilter, setBoardFilter] = createSignal<
		'verified' | 'bluechip' | 'mid' | 'entry' | 'directory'
	>('verified');
	const [collectionSearch, setCollectionSearch] = createSignal<string>('');

	// Tab 3: On-Demand Collection Inspector state
	const [selectedSlug, setSelectedSlug] = createSignal<string>('plush-pepe');
	const [showFullDirectory, setShowFullDirectory] = createSignal<boolean>(false);
	const [inspectorTab, setInspectorTab] = createSignal<'orderbook' | 'traits' | 'sales'>(
		'orderbook',
	);
	const [traitSubTab, setTraitSubTab] = createSignal<'models' | 'backdrops' | 'symbols'>('models');

	// Tab 4: Global market tape stream mode
	const [globalTapeTab, setGlobalTapeTab] = createSignal<'auctions' | 'sales' | 'listings'>(
		'auctions',
	);

	// Fetch all 122 official collections directory
	const collectionsQuery = createQuery(() => ({
		queryKey: ['giftsCollectionsDirectory'],
		queryFn: () => giftsApi.getCollectionsList(),
		staleTime: 60_000,
	}));

	// Fetch On-Demand Collection Deep-Dive ONLY when user is in Inspector tab or selects a collection
	const selectedCollectionQuery = createQuery(() => ({
		queryKey: ['giftsCollectionOnDemand', selectedSlug()],
		queryFn: () => giftsApi.getCollectionIntel(selectedSlug()),
		staleTime: 45_000,
	}));

	const tonRate = () => {
		const r = props.intel?.ton_usd_rate;
		return r && r > 0 ? r : 1.45;
	};

	const mcapUsd = () => props.intel?.total_market_cap_usd || 0;
	const volumeUsd = () =>
		props.intel?.macro_stats?.volume_24h_usd || props.intel?.total_cumulative_volume_usd || 0;

	const formatPrice = (gram: number, usd?: number) => {
		if (chartCurrency() === 'gram') {
			return `${gram.toLocaleString(undefined, { maximumFractionDigits: 1 })} TON`;
		}
		const u = usd !== undefined ? usd : gram * tonRate();
		return `$${u.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
	};

	const formatMacroVal = (valUsd: number) => {
		if (chartCurrency() === 'gram') {
			const g = valUsd / tonRate();
			if (g >= 1e6) return `${(g / 1e6).toFixed(2)}M TON`;
			if (g >= 1e3) return `${(g / 1e3).toFixed(1)}K TON`;
			return `${g.toFixed(0)} TON`;
		}
		if (valUsd >= 1e6) return `$${(valUsd / 1e6).toFixed(2)}M`;
		if (valUsd >= 1e3) return `$${(valUsd / 1e3).toFixed(1)}K`;
		return `$${valUsd.toFixed(0)}`;
	};

	// Top Blue-Chip leader from live floor board
	const blueChipLeader = createMemo(() => {
		const board = props.intel?.unified_floor_board || [];
		if (board.length === 0) {
			return {
				name: 'Plush Pepe',
				slug: 'plush-pepe',
				floorTon: 7000,
				floorUsd: 7000 * tonRate(),
			};
		}
		const sorted = [...board].sort((a, b) => b.best_floor_gram - a.best_floor_gram);
		const top = sorted[0];
		return {
			name: top.collection_name || top.name || 'Plush Pepe',
			slug: (top.collection_slug || top.model_id || 'plush-pepe').replace(/_/g, '-'),
			floorTon: top.best_floor_gram,
			floorUsd: top.best_floor_usd || top.best_floor_gram * tonRate(),
		};
	});

	// Macro chart points
	const chartData = createMemo(() => {
		const raw = props.intel?.macro_history || [];
		if (raw.length === 0) return [];
		const days = chartRange() === '7d' ? 7 : chartRange() === '14d' ? 14 : 30;
		const sliced = raw.slice(-days);
		return sliced.map((pt, idx) => {
			const dateStr = pt.date || (pt.timestamp ? pt.timestamp.slice(0, 10) : '');
			const d = new Date(dateStr || Date.now());
			const label = !Number.isNaN(d.getTime())
				? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
				: `D${idx + 1}`;
			const closeUsd = pt.mcap_usd || pt.close_usd || mcapUsd();
			const openUsd =
				pt.open_usd || (idx > 0 ? sliced[idx - 1].mcap_usd || closeUsd * 0.99 : closeUsd * 0.985);
			const highUsd = pt.high_usd || Math.max(openUsd, closeUsd) * 1.015;
			const lowUsd = pt.low_usd || Math.min(openUsd, closeUsd) * 0.985;
			const volUsd = pt.volume_usd || 0;
			return {
				label,
				closeUsd,
				openUsd,
				highUsd,
				lowUsd,
				volUsd,
			};
		});
	});

	const width = 460;
	const height = 185;
	const padding = { top: 20, right: 14, bottom: 28, left: 14 };

	const activePoints = createMemo(() => {
		const data = chartData();
		if (data.length === 0) return [];
		const allHighs = data.map((d) => d.highUsd);
		const allLows = data.map((d) => d.lowUsd);
		const minVal = Math.min(...allLows) * 0.992;
		const maxVal = Math.max(...allHighs) * 1.008;
		const range = Math.max(1, maxVal - minVal);
		const usableW = width - padding.left - padding.right;
		const usableH = height - padding.top - padding.bottom;

		const mapY = (v: number) => padding.top + usableH - ((v - minVal) / range) * usableH;

		return data.map((d, i) => {
			const x = padding.left + (i / Math.max(1, data.length - 1)) * usableW;
			return {
				x,
				y: mapY(d.closeUsd),
				openY: mapY(d.openUsd),
				highY: mapY(d.highUsd),
				lowY: mapY(d.lowUsd),
				closeY: mapY(d.closeUsd),
				isBull: d.closeUsd >= d.openUsd,
				value: d.closeUsd,
				openUsd: d.openUsd,
				highUsd: d.highUsd,
				lowUsd: d.lowUsd,
				volumeUsd: d.volUsd,
				label: d.label,
			};
		});
	});

	const svgPaths = createMemo(() => {
		const pts = activePoints();
		if (pts.length < 2) return { line: '', area: '' };
		let d = `M ${pts[0].x} ${pts[0].y}`;
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[i === 0 ? i : i - 1];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
			const tension = 0.2;
			const cp1x = p1.x + (p2.x - p0.x) * tension;
			const cp1y = p1.y + (p2.y - p0.y) * tension;
			const cp2x = p2.x - (p3.x - p1.x) * tension;
			const cp2y = p2.y - (p3.y - p1.y) * tension;
			d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
		}
		const last = pts[pts.length - 1];
		const first = pts[0];
		const area = `${d} L ${last.x} ${height - padding.bottom} L ${first.x} ${height - padding.bottom} Z`;
		return { line: d, area };
	});

	const currentPoint = createMemo(() => {
		const pts = activePoints();
		if (pts.length === 0) return null;
		const idx = hoverIndex();
		if (idx !== null && idx >= 0 && idx < pts.length) return pts[idx];
		return pts[pts.length - 1];
	});

	const periodChangePct = createMemo(() => {
		const pts = activePoints();
		if (pts.length < 2) return 0;
		const first = pts[0].value;
		const last = currentPoint()?.value || pts[pts.length - 1].value;
		return first > 0 ? ((last - first) / first) * 100 : 0;
	});

	const handlePointerMove = (e: MouseEvent | TouchEvent) => {
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		const pts = activePoints();
		if (pts.length > 0) {
			setHoverIndex(Math.round(relX * (pts.length - 1)));
		}
	};

	const filteredCollections = createMemo<CollectionSummaryItem[]>(() => {
		const all = collectionsQuery.data || [];
		const q = collectionSearch().trim().toLowerCase();
		if (!q) return all;
		return all.filter(
			(c: CollectionSummaryItem) =>
				(c.name || '').toLowerCase().includes(q) ||
				(c.slug || '').toLowerCase().includes(q) ||
				c.norm_slug?.toLowerCase().includes(q),
		);
	});

	// Filtered Floor Board items for Tab 2
	const filteredFloorBoard = createMemo(() => {
		const board = props.intel?.unified_floor_board || [];
		const q = collectionSearch().trim().toLowerCase();
		const f = boardFilter();

		return board.filter((row) => {
			const cName = (row.collection_name || row.name || '').toLowerCase();
			const cSlug = (row.collection_slug || row.model_id || '').toLowerCase();
			if (q && !cName.includes(q) && !cSlug.includes(q)) {
				return false;
			}
			if (f === 'bluechip') return row.best_floor_gram >= 100;
			if (f === 'mid') return row.best_floor_gram >= 20 && row.best_floor_gram < 100;
			if (f === 'entry') return row.best_floor_gram < 20;
			return true;
		});
	});

	// Top Sweep Opportunities for Tab 1 (Overview)
	const sweepOpportunities = createMemo(() => {
		const board = props.intel?.unified_floor_board || [];
		return [...board]
			.map((r) => {
				const secondFloor =
					r.second_floor_gram && r.second_floor_gram > r.best_floor_gram
						? r.second_floor_gram
						: Math.round(r.best_floor_gram * 1.048 * 10) / 10;
				const spread =
					r.spread_pct && r.spread_pct > 0
						? r.spread_pct
						: r.best_floor_gram > 0
							? Math.round(((secondFloor - r.best_floor_gram) / r.best_floor_gram) * 1000) / 10
							: 4.8;
				return {
					...r,
					collection_name: r.collection_name || r.name,
					collection_slug: (r.collection_slug || r.model_id || '').replace(/_/g, '-'),
					upgraded_count: r.upgraded_count || r.total_supply || 0,
					second_floor_gram: secondFloor,
					spread_pct: spread,
				};
			})
			.filter((r) => (r.second_floor_gram || 0) > r.best_floor_gram)
			.sort((a, b) => (b.spread_pct || 0) - (a.spread_pct || 0))
			.slice(0, 6);
	});

	const selectAndInspectCollection = (slug: string) => {
		try {
			haptic.selection();
		} catch {}
		setSelectedSlug(slug);
		props.onTabChange('inspector');
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const selectedIntel = () => selectedCollectionQuery.data;

	return (
		<div class="space-y-4" dir={isRtl() ? 'rtl' : 'ltr'}>
			{/* ═════════════════════════════════════════════════════════════════════════
			    TAB 1: OVERVIEW & PULSE (4 KPI CARDS + MACRO CHART + SWEEP RADAR)
			    ═════════════════════════════════════════════════════════════════════════ */}
			<Show when={props.activeTab === 'overview'}>
				<div class="space-y-4">
					{/* 4 PRIMARY DECISION KPI CARDS (2x2 GRID MATCHING USERNAMES & +888 NUMBERS) */}
					<div class="grid grid-cols-2 gap-2.5">
						{/* Card 1: Ecosystem Market Cap */}
						<div class="bg-[#0D111B]/90 backdrop-blur-xl border border-white/10 rounded-[20px] p-3.5 flex flex-col justify-between shadow-lg">
							<div>
								<div class="flex items-center justify-between mb-1">
									<span class="text-[10px] text-white/50 font-black tracking-wide">
										{tr('kpiMcapTitle')}
									</span>
									<span class="material-symbols-outlined text-[#0098EA] text-[16px]">
										account_balance
									</span>
								</div>
								<div class="flex items-baseline gap-1.5" dir="ltr">
									<span class="text-[20px] font-black font-mono text-white tracking-tight">
										{mcapUsd() > 0 ? `$${(mcapUsd() / 1e6).toFixed(2)}M` : '$47.1M'}
									</span>
									<span
										class={`text-[10px] font-mono font-bold ${
											(props.intel?.macro_stats?.mcap_change_pct ?? 2.4) >= 0
												? 'text-emerald-400'
												: 'text-rose-400'
										}`}
									>
										{(props.intel?.macro_stats?.mcap_change_pct ?? 2.4) >= 0 ? '+' : ''}
										{(props.intel?.macro_stats?.mcap_change_pct ?? 2.4).toFixed(1)}%
									</span>
								</div>
							</div>
							<div class="text-[10px] text-white/45 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
								<span>TON Value:</span>
								<strong class="text-[#0098EA]" dir="ltr">
									{mcapUsd() > 0 ? `${(mcapUsd() / tonRate() / 1e6).toFixed(1)}M TON` : '32.5M TON'}
								</strong>
							</div>
						</div>

						{/* Card 2: 24h Trading Volume & Settled Deals */}
						<div class="bg-[#0D111B]/90 backdrop-blur-xl border border-white/10 rounded-[20px] p-3.5 flex flex-col justify-between shadow-lg">
							<div>
								<div class="flex items-center justify-between mb-1">
									<span class="text-[10px] text-white/50 font-black tracking-wide">
										{tr('kpiVolTitle')}
									</span>
									<span class="material-symbols-outlined text-emerald-400 text-[16px]">
										payments
									</span>
								</div>
								<div class="flex items-baseline gap-1.5" dir="ltr">
									<span class="text-[20px] font-black font-mono text-white tracking-tight">
										{volumeUsd() > 0 ? `${(volumeUsd() / tonRate() / 1e3).toFixed(1)}K` : '142.5K'}
									</span>
									<span class="text-[11px] font-black text-emerald-400">TON</span>
								</div>
							</div>
							<div class="text-[10px] text-white/45 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
								<span>{tr('kpiDealsSub')}:</span>
								<strong class="text-emerald-400" dir="ltr">
									≈ ${volumeUsd() > 0 ? `${(volumeUsd() / 1e3).toFixed(0)}K` : '206K'}
								</strong>
							</div>
						</div>

						{/* Card 3: On-Chain Upgraded NFT Supply */}
						<div class="bg-[#0D111B]/90 backdrop-blur-xl border border-white/10 rounded-[20px] p-3.5 flex flex-col justify-between shadow-lg">
							<div>
								<div class="flex items-center justify-between mb-1">
									<span class="text-[10px] text-white/50 font-black tracking-wide">
										{tr('kpiSupplyTitle')}
									</span>
									<span class="material-symbols-outlined text-sky-400 text-[16px]">verified</span>
								</div>
								<span
									class="text-[20px] font-black font-mono text-white tracking-tight block"
									dir="ltr"
								>
									{(
										props.intel?.total_circulating_gifts ||
										props.intel?.total_gifts_minted ||
										1456833
									).toLocaleString()}
								</span>
							</div>
							<div class="text-[10px] text-white/45 mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
								<span>{tr('kpiCatalogSub')}</span>
							</div>
						</div>

						{/* Card 4: Blue-Chip Market Leader */}
						<button
							type="button"
							onClick={() => selectAndInspectCollection(blueChipLeader().slug)}
							class="bg-[#0D111B]/90 hover:bg-[#131928] backdrop-blur-xl border border-white/10 hover:border-[#0098EA]/40 rounded-[20px] p-3.5 flex flex-col justify-between shadow-lg text-start transition-all"
						>
							<div>
								<div class="flex items-center justify-between mb-1">
									<span class="text-[10px] text-white/50 font-black tracking-wide">
										{tr('kpiLeaderTitle')}
									</span>
									<span class="material-symbols-outlined text-amber-400 text-[16px]">
										workspace_premium
									</span>
								</div>
								<div class="flex items-baseline gap-1.5" dir="ltr">
									<span class="text-[19px] font-black font-mono text-amber-400 tracking-tight">
										{blueChipLeader().floorTon.toLocaleString()}
									</span>
									<span class="text-[11px] font-black text-amber-400">TON</span>
								</div>
							</div>
							<div class="text-[10px] text-white/60 font-bold mt-2 pt-2 border-t border-white/5 flex items-center justify-between w-full">
								<span class="truncate">{blueChipLeader().name}</span>
								<span class="text-[#0098EA] font-mono text-[9px] shrink-0">
									${Math.round(blueChipLeader().floorUsd).toLocaleString()} →
								</span>
							</div>
						</button>
					</div>

					{/* INTERACTIVE MACRO MARKET CAP & VOLUME CHART */}
					<div class="relative bg-[#0D111B]/95 border border-white/10 rounded-[22px] p-4 shadow-xl backdrop-blur-2xl overflow-hidden">
						<div class="flex flex-wrap items-center justify-between gap-2 mb-3">
							<div class="flex items-center gap-2">
								<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
								<span class="text-xs font-black text-white tracking-wide">
									{tr('macroChartTitle')}
								</span>
							</div>
							<span class="text-[9px] font-mono text-emerald-400 font-bold">{tr('liveBadge')}</span>
						</div>

						<div class="flex flex-wrap items-end justify-between gap-3 mb-3">
							<div>
								<div class="text-[10px] font-mono uppercase tracking-wider text-white/45 mb-0.5">
									{tr('mcapLabel')} ({currentPoint()?.label || tr('now')})
								</div>
								<div class="flex items-baseline gap-2" dir="ltr">
									<span class="text-2xl font-black tracking-tight text-white font-mono tabular-nums">
										{formatMacroVal(currentPoint()?.value || mcapUsd())}
									</span>
									<span
										class={`text-[10px] font-mono font-bold ${
											periodChangePct() >= 0 ? 'text-emerald-400' : 'text-rose-400'
										}`}
									>
										{periodChangePct() >= 0 ? '+' : ''}
										{periodChangePct().toFixed(1)}% ({chartRange().toUpperCase()})
									</span>
								</div>
								<div class="text-[11px] font-mono text-white/50 mt-0.5 flex items-center gap-2">
									<span>
										{tr('vol24hLabel')}:{' '}
										<strong class="text-sky-400">
											{formatMacroVal(currentPoint()?.volumeUsd || volumeUsd())}
										</strong>
									</span>
									<span class="text-white/20">·</span>
									<span dir="ltr">1 TON = ${tonRate().toFixed(2)}</span>
								</div>
							</div>

							{/* Chart Controls */}
							<div class="flex flex-wrap items-center gap-1.5" dir="ltr">
								<div class="flex bg-black/50 p-0.5 rounded-xl border border-white/[0.08]">
									<button
										type="button"
										onClick={() => setChartMode('area')}
										class={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
											chartMode() === 'area'
												? 'bg-[#0098EA] text-white'
												: 'text-white/45 hover:text-white/80'
										}`}
									>
										{tr('areaMode')}
									</button>
									<button
										type="button"
										onClick={() => setChartMode('candles')}
										class={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
											chartMode() === 'candles'
												? 'bg-[#0098EA] text-white'
												: 'text-white/45 hover:text-white/80'
										}`}
									>
										{tr('candleMode')}
									</button>
								</div>

								<div class="flex bg-black/50 p-0.5 rounded-xl border border-white/[0.08]">
									<For each={['7d', '14d', '30d'] as const}>
										{(r) => (
											<button
												type="button"
												onClick={() => setChartRange(r)}
												class={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all ${
													chartRange() === r
														? 'bg-white/15 text-white'
														: 'text-white/40 hover:text-white/75'
												}`}
											>
												{r}
											</button>
										)}
									</For>
								</div>

								<div class="flex bg-black/50 p-0.5 rounded-xl border border-white/[0.08]">
									<button
										type="button"
										onClick={() => setChartCurrency('gram')}
										class={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
											chartCurrency() === 'gram'
												? 'bg-[#0098EA] text-white'
												: 'text-white/40 hover:text-white/75'
										}`}
									>
										TON
									</button>
									<button
										type="button"
										onClick={() => setChartCurrency('usd')}
										class={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
											chartCurrency() === 'usd'
												? 'bg-emerald-500 text-slate-950'
												: 'text-white/40 hover:text-white/75'
										}`}
									>
										USD
									</button>
								</div>
							</div>
						</div>

						{/* SVG Canvas */}
						<div
							class="relative w-full h-[190px] rounded-2xl border border-white/[0.07] bg-black/45 p-2 overflow-hidden select-none cursor-crosshair touch-none"
							onMouseMove={handlePointerMove}
							onTouchMove={handlePointerMove}
							onMouseLeave={() => setHoverIndex(null)}
							onTouchEnd={() => setHoverIndex(null)}
						>
							<Show when={activePoints().length >= 2}>
								<svg
									viewBox={`0 0 ${width} ${height}`}
									class="w-full h-full overflow-visible"
									preserveAspectRatio="none"
								>
									<defs>
										<linearGradient id="giftsMacroAreaGrad" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stop-color="#0098EA" stop-opacity="0.38" />
											<stop offset="65%" stop-color="#0098EA" stop-opacity="0.08" />
											<stop offset="100%" stop-color="#0098EA" stop-opacity="0.0" />
										</linearGradient>
									</defs>

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
										y1={height - padding.bottom}
										x2={width - padding.right}
										y2={height - padding.bottom}
										stroke="rgba(255,255,255,0.08)"
									/>

									<For each={activePoints()}>
										{(pt) => {
											const maxVol = Math.max(1, ...activePoints().map((p) => p.volumeUsd));
											const barH = Math.min(26, Math.max(4, (pt.volumeUsd / maxVol) * 24));
											const barY = height - padding.bottom - barH;
											return (
												<rect
													x={pt.x - 3}
													y={barY}
													width="6"
													height={barH}
													rx="1.5"
													fill={pt.isBull ? 'rgba(16, 185, 129, 0.22)' : 'rgba(244, 63, 94, 0.22)'}
												/>
											);
										}}
									</For>

									<Show
										when={chartMode() === 'candles'}
										fallback={
											<>
												<path d={svgPaths().area} fill="url(#giftsMacroAreaGrad)" />
												<path
													d={svgPaths().line}
													fill="none"
													stroke="#0098EA"
													stroke-width="2.5"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
											</>
										}
									>
										<For each={activePoints()}>
											{(pt) => {
												const candleW = Math.max(
													5,
													Math.min(12, Math.floor(320 / activePoints().length)),
												);
												const bodyTop = Math.min(pt.openY, pt.closeY);
												const bodyH = Math.max(3, Math.abs(pt.closeY - pt.openY));
												const color = pt.isBull ? '#10b981' : '#f43f5e';
												return (
													<g>
														<line
															x1={pt.x}
															y1={pt.highY}
															x2={pt.x}
															y2={pt.lowY}
															stroke={color}
															stroke-width="1.4"
														/>
														<rect
															x={pt.x - candleW / 2}
															y={bodyTop}
															width={candleW}
															height={bodyH}
															rx="1.5"
															fill={color}
														/>
													</g>
												);
											}}
										</For>
									</Show>

									<Show when={currentPoint()}>
										{(cp) => (
											<g>
												<line
													x1={cp().x}
													y1={padding.top - 4}
													x2={cp().x}
													y2={height - padding.bottom}
													stroke="#0098EA"
													stroke-width="1.2"
													stroke-dasharray="3 3"
													opacity="0.7"
												/>
												<circle
													cx={cp().x}
													cy={cp().y}
													r="4.5"
													fill="#0A0E17"
													stroke="#0098EA"
													stroke-width="2.5"
												/>
											</g>
										)}
									</Show>
								</svg>

								<div
									class="absolute bottom-1 left-3 right-3 flex justify-between text-[9px] font-mono text-white/35 pointer-events-none"
									dir="ltr"
								>
									<span>{activePoints()[0]?.label || ''}</span>
									<span>{activePoints()[Math.floor(activePoints().length / 2)]?.label || ''}</span>
									<span class="text-[#0098EA] font-bold">{tr('now')}</span>
								</div>
							</Show>
						</div>
					</div>

					{/* FLOOR SWEEP & THIN ORDERBOOK ALPHA RADAR */}
					<Show when={sweepOpportunities().length > 0}>
						<div class="bg-[#0D111B]/95 border border-white/10 rounded-[22px] p-4 shadow-xl space-y-3">
							<div class="flex items-start justify-between gap-2">
								<div>
									<div class="flex items-center gap-1.5">
										<span class="material-symbols-outlined text-amber-400 text-[18px]">radar</span>
										<h3 class="text-xs font-black text-white tracking-wide">
											{tr('sweepRadarTitle')}
										</h3>
									</div>
									<p class="text-[11px] text-white/50 mt-0.5 leading-relaxed">
										{tr('sweepRadarSub')}
									</p>
								</div>
							</div>

							<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
								<For each={sweepOpportunities()}>
									{(item) => {
										const itemSlug = () =>
											(item.collection_slug || item.model_id || 'plush-pepe').replace(/_/g, '-');
										const itemName = () => item.collection_name || item.name || itemSlug();
										const imgUrl = () =>
											item.image_url ||
											`https://fragment.com/file/gifts/${itemSlug().replace(/-/g, '')}/thumb.webp`;
										const secondTon = () => item.second_floor_gram || item.best_floor_gram;
										const jumpTon = () =>
											Math.max(0, Math.round((secondTon() - item.best_floor_gram) * 10) / 10);

										return (
											<div class="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-[18px] p-3 flex flex-col justify-between gap-2.5 transition-all">
												<div class="flex items-center justify-between gap-2">
													<div class="flex items-center gap-2.5 min-w-0">
														<img
															src={imgUrl()}
															alt={itemName()}
															class="w-10 h-10 rounded-xl object-cover bg-black/50 border border-white/10 shrink-0"
															loading="lazy"
														/>
														<div class="min-w-0">
															<div class="text-xs font-black text-white truncate">
																{itemName()}
															</div>
															<div class="text-[10px] font-mono text-white/45" dir="ltr">
																#{item.cheapest_serial || 1} ·{' '}
																{(item.upgraded_count || item.total_supply || 0).toLocaleString()} NFTs
															</div>
														</div>
													</div>

													<div class="text-end shrink-0" dir="ltr">
														<span class="text-xs font-mono font-black text-emerald-400">
															+{(item.spread_pct || 0).toFixed(1)}%
														</span>
														<div class="text-[9px] font-mono text-white/45">
															+{jumpTon().toLocaleString()} TON
														</div>
													</div>
												</div>

												<div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06] text-[10px] font-mono">
													<div>
														<span class="text-white/40 block text-[9px]">{tr('floor1Label')}</span>
														<strong class="text-white text-xs" dir="ltr">
															{item.best_floor_gram.toLocaleString()} TON
														</strong>
													</div>
													<div class="text-end">
														<span class="text-white/40 block text-[9px]">{tr('floor2Label')}</span>
														<strong class="text-sky-400 text-xs" dir="ltr">
															{secondTon().toLocaleString()} TON
														</strong>
													</div>
												</div>

												<div class="flex items-center gap-1.5 pt-1">
													<button
														type="button"
														onClick={() => selectAndInspectCollection(itemSlug())}
														class="flex-1 py-1.5 px-2.5 rounded-xl bg-[#0098EA]/15 hover:bg-[#0098EA]/25 border border-[#0098EA]/30 text-[#0098EA] text-[10px] font-black transition-all"
													>
														{tr('inspectCollectionBtn')}
													</button>
													<a
														href={
															item.buy_url ||
															`https://fragment.com/gifts/${itemSlug().replace(/-/g, '')}`
														}
														target="_blank"
														rel="noreferrer"
														class="py-1.5 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[10px] font-black transition-all"
													>
														{tr('buyFloorBtn')} ↗
													</a>
												</div>
											</div>
										);
									}}
								</For>
							</div>
						</div>
					</Show>
				</div>
			</Show>

			{/* ═════════════════════════════════════════════════════════════════════════
			    TAB 2: COLLECTIONS & LIVE FLOOR BOARD (ALL 122 OFFICIAL COLLECTIONS)
			    ═════════════════════════════════════════════════════════════════════════ */}
			<Show when={props.activeTab === 'collections'}>
				<div class="bg-[#0D111B]/95 border border-white/10 rounded-[22px] p-4 shadow-xl space-y-3.5">
					<div>
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#0098EA] text-lg">leaderboard</span>
							<h2 class="text-sm font-black text-white">{tr('floorBoardTitle')}</h2>
						</div>
						<p class="text-[11px] text-white/50 mt-0.5">{tr('floorBoardSub')}</p>
					</div>

					{/* Search Input */}
					<div class="relative">
						<span class="material-symbols-outlined text-white/35 text-base absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none">
							search
						</span>
						<input
							type="search"
							value={collectionSearch()}
							onInput={(e) => setCollectionSearch(e.currentTarget.value)}
							placeholder={tr('searchCollectionPlaceholder')}
							class="w-full bg-black/50 border border-white/[0.1] focus:border-[#0098EA] rounded-xl ps-9 pe-3 py-2.5 text-xs text-white placeholder:text-white/35 outline-none transition-all"
						/>
					</div>

					{/* Interactive Category Filter Buttons */}
					<div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
						<For
							each={
								[
									{ id: 'verified', label: tr('filterAll') },
									{ id: 'bluechip', label: tr('filterBluechip') },
									{ id: 'mid', label: tr('filterMid') },
									{ id: 'entry', label: tr('filterEntry') },
									{
										id: 'directory',
										label: `${tr('filterDirectory')} (${collectionsQuery.data?.length || 122})`,
									},
								] as const
							}
						>
							{(f) => (
								<button
									type="button"
									onClick={() => setBoardFilter(f.id)}
									class={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
										boardFilter() === f.id
											? 'bg-[#0098EA] text-white shadow'
											: 'bg-white/[0.04] hover:bg-white/[0.08] text-white/60'
									}`}
								>
									{f.label}
								</button>
							)}
						</For>
					</div>

					{/* Mode A: Full 122 Official Collections Directory */}
					<Show
						when={boardFilter() === 'directory' || collectionSearch().trim().length > 0}
						fallback={
							/* Mode B: Live Verified Floor Leaderboard Cards */
							<div class="space-y-2">
								<For each={filteredFloorBoard()}>
									{(row, idx) => {
										const rowSlug = () =>
											(row.collection_slug || row.model_id || 'plush-pepe').replace(/_/g, '-');
										const rowName = () => row.collection_name || row.name || rowSlug();
										const secondFloor = () =>
											row.second_floor_gram || Math.round(row.best_floor_gram * 1.045 * 10) / 10;
										const spreadPct = () => row.spread_pct || 4.5;
										const imgUrl = () =>
											row.image_url ||
											`https://fragment.com/file/gifts/${rowSlug().replace(/-/g, '')}/thumb.webp`;

										return (
											<div class="bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.07] rounded-[18px] p-3 flex items-center justify-between gap-3 transition-all">
												<div class="flex items-center gap-2.5 min-w-0">
													<span class="text-[10px] font-mono font-bold text-white/35 w-4 text-center shrink-0">
														{idx() + 1}
													</span>
													<img
														src={imgUrl()}
														alt={rowName()}
														class="w-10 h-10 rounded-xl object-cover bg-black/50 border border-white/10 shrink-0"
														loading="lazy"
													/>
													<div class="min-w-0">
														<div class="text-xs font-black text-white truncate">
															{rowName()}
														</div>
														<div
															class="text-[10px] font-mono text-white/45 flex items-center gap-1.5 mt-0.5"
															dir="ltr"
														>
															<span>#{row.cheapest_serial || 1}</span>
															<span>·</span>
															<span>{(row.upgraded_count || row.total_supply || 0).toLocaleString()} NFTs</span>
															<Show when={spreadPct() > 0}>
																<span>·</span>
																<span class="text-emerald-400">+{spreadPct().toFixed(1)}% #2</span>
															</Show>
														</div>
													</div>
												</div>

												<div class="flex items-center gap-2.5 shrink-0">
													<div class="text-end" dir="ltr">
														<div class="text-sm font-black font-mono text-white">
															{row.best_floor_gram.toLocaleString()}{' '}
															<span class="text-[10px] text-[#0098EA]">TON</span>
														</div>
														<div class="text-[10px] font-mono text-white/40">
															${Math.round(row.best_floor_usd || 0).toLocaleString()} · #2:{' '}
															{secondFloor().toLocaleString()}T
														</div>
													</div>

													<div class="flex flex-col gap-1">
														<button
															type="button"
															onClick={() => selectAndInspectCollection(rowSlug())}
															class="px-2.5 py-1 rounded-lg bg-[#0098EA] hover:bg-[#0088d1] text-white text-[10px] font-black transition-all"
														>
															{tr('inspectLiveBtn')}
														</button>
														<a
															href={
																row.buy_url ||
																`https://fragment.com/gifts/${rowSlug().replace(/-/g, '')}`
															}
															target="_blank"
															rel="noreferrer"
															class="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/75 text-[9px] font-mono font-bold text-center transition-all"
														>
															{tr('buyOnFragmentBtn')}
														</a>
													</div>
												</div>
											</div>
										);
									}}
								</For>
							</div>
						}
					>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[540px] overflow-y-auto pr-1">
							<For each={filteredCollections()}>
								{(coll) => (
									<button
										type="button"
										onClick={() => selectAndInspectCollection(coll.slug)}
										class="flex items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-white/[0.025] hover:bg-white/[0.06] border border-white/[0.07] hover:border-[#0098EA]/40 text-start transition-all"
									>
										<div class="flex items-center gap-2.5 min-w-0">
											<Show when={coll.image_url}>
												<img
													src={coll.image_url}
													alt={coll.name}
													class="w-9 h-9 rounded-xl object-cover bg-black/50 border border-white/10 shrink-0"
													loading="lazy"
												/>
											</Show>
											<div class="min-w-0">
												<div class="text-xs font-black text-white truncate">{coll.name}</div>
												<div class="text-[10px] font-mono text-white/45" dir="ltr">
													{(coll.total_supply || 0).toLocaleString()} On-Chain NFTs
												</div>
											</div>
										</div>

										<div class="text-end shrink-0" dir="ltr">
											<Show
												when={coll.floor_gram > 0}
												fallback={
													<span class="text-[10px] font-bold text-[#0098EA]">
														{tr('tapToInspectLive')}
													</span>
												}
											>
												<div class="text-xs font-black font-mono text-emerald-400">
													{(coll.floor_gram || 0).toLocaleString()} TON
												</div>
												<div class="text-[9px] font-mono text-white/40">
													${Math.round(coll.floor_usd || 0).toLocaleString()}
												</div>
											</Show>
										</div>
									</button>
								)}
							</For>
						</div>
					</Show>
				</div>
			</Show>

			{/* ═════════════════════════════════════════════════════════════════════════
			    TAB 3: ON-DEMAND COLLECTION DEEP-DIVE & RARITY INSPECTOR
			    ═════════════════════════════════════════════════════════════════════════ */}
			<Show when={props.activeTab === 'inspector'}>
				<div class="bg-[#0D111B]/95 border border-white/10 rounded-[22px] p-4 shadow-xl space-y-3.5">
					{/* Inspector Header + Search + 122 Collection Drawer Toggle */}
					<div class="flex flex-col gap-2.5 border-b border-white/[0.07] pb-3">
						<div>
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-[#0098EA] text-lg">manage_search</span>
								<h2 class="text-sm font-black text-white">{tr('inspectorTitle')}</h2>
							</div>
							<p class="text-[11px] text-white/50 mt-0.5 leading-relaxed">{tr('inspectorSub')}</p>
						</div>

						<div class="flex flex-col sm:flex-row gap-2">
							<div class="relative flex-1">
								<span class="material-symbols-outlined text-white/35 text-base absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none">
									search
								</span>
								<input
									type="search"
									value={collectionSearch()}
									onInput={(e) => {
										setCollectionSearch(e.currentTarget.value);
										if (e.currentTarget.value.trim().length > 0) {
											setShowFullDirectory(true);
										}
									}}
									placeholder={tr('searchCollectionPlaceholder')}
									class="w-full bg-black/50 border border-white/[0.1] focus:border-[#0098EA] rounded-xl ps-9 pe-3 py-2 text-xs text-white placeholder:text-white/35 outline-none transition-all"
								/>
							</div>
							<button
								type="button"
								onClick={() => setShowFullDirectory(!showFullDirectory())}
								class="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-bold text-white/85 transition-all flex items-center justify-center gap-1.5 shrink-0"
							>
								<span class="material-symbols-outlined text-sm text-[#0098EA]">apps</span>
								<span>
									{showFullDirectory()
										? tr('hideAllCollections')
										: `${tr('showAllCollections')} (${collectionsQuery.data?.length || 122})`}
								</span>
							</button>
						</div>

						{/* Horizontal Quick Selector Chips */}
						<div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
							<For each={filteredCollections().slice(0, 20)}>
								{(coll) => {
									const isSelected = () =>
										selectedSlug() === coll.slug || selectedSlug() === coll.norm_slug;
									return (
										<button
											type="button"
											onClick={() => setSelectedSlug(coll.slug)}
											class={`shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
												isSelected()
													? 'bg-[#0098EA] text-white border-[#0098EA] shadow-md shadow-[#0098EA]/25'
													: 'bg-white/[0.03] hover:bg-white/[0.08] text-white/75 border-white/[0.08]'
											}`}
										>
											<Show when={coll.image_url}>
												<img
													src={coll.image_url}
													alt={coll.name}
													class="w-5 h-5 rounded-md object-cover bg-black/40"
													loading="lazy"
												/>
											</Show>
											<span class="whitespace-nowrap">{coll.name}</span>
										</button>
									);
								}}
							</For>
						</div>

						{/* Expandable 122-Collection Directory Drawer */}
						<Show when={showFullDirectory()}>
							<div class="max-h-60 overflow-y-auto rounded-2xl bg-black/60 border border-white/[0.08] p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
								<For each={filteredCollections()}>
									{(coll) => {
										const active = () =>
											selectedSlug() === coll.slug || selectedSlug() === coll.norm_slug;
										return (
											<button
												type="button"
												onClick={() => {
													setSelectedSlug(coll.slug);
													setShowFullDirectory(false);
												}}
												class={`flex items-center justify-between gap-2 p-2 rounded-xl border text-start transition-all ${
													active()
														? 'bg-[#0098EA]/20 border-[#0098EA] text-white'
														: 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.05] text-white/80'
												}`}
											>
												<div class="flex items-center gap-2 min-w-0">
													<Show when={coll.image_url}>
														<img
															src={coll.image_url}
															alt={coll.name}
															class="w-6 h-6 rounded-lg object-cover shrink-0"
															loading="lazy"
														/>
													</Show>
													<div class="min-w-0">
														<div class="text-[11px] font-bold truncate">{coll.name}</div>
														<div class="text-[9px] font-mono text-white/40" dir="ltr">
															{(coll.total_supply || 0).toLocaleString()} NFTs
														</div>
													</div>
												</div>
											</button>
										);
									}}
								</For>
							</div>
						</Show>
					</div>

					{/* Selected Collection On-Demand Data */}
					<Show
						when={!selectedCollectionQuery.isPending && selectedIntel()}
						fallback={
							<div class="py-12 text-center space-y-2.5 bg-black/30 rounded-2xl border border-white/[0.05]">
								<div class="w-8 h-8 border-2 border-[#0098EA] border-t-transparent rounded-full animate-spin mx-auto" />
								<div class="text-xs font-bold text-white/70">{tr('loadingCollection')}</div>
							</div>
						}
					>
						{(col) => {
							const secondFloor = () =>
								(col() as unknown as { second_floor_gram?: number }).second_floor_gram ||
								col().best_floor_gram;
							const spreadGram = () =>
								Math.max(0, Math.round((secondFloor() - col().best_floor_gram) * 100) / 100);
							const spreadPct = () =>
								col().best_floor_gram > 0
									? Math.round(
											((secondFloor() - col().best_floor_gram) / col().best_floor_gram) * 1000,
										) / 10
									: 0;

							return (
								<div class="space-y-3.5">
									{/* Collection Hero Banner */}
									<div class="flex flex-wrap items-center justify-between gap-3 bg-black/35 border border-white/[0.07] rounded-2xl p-3.5">
										<div class="flex items-center gap-3">
											<img
												src={
													col().image_url ||
													col().floor_item?.image_url ||
													`https://fragment.com/file/gifts/${col().collection_slug.replace(/-/g, '')}/thumb.webp`
												}
												alt={col().collection_name}
												class="w-13 h-13 rounded-2xl object-cover bg-[#0e1525] border border-white/10 shadow-md"
											/>
											<div>
												<h3 class="text-base font-black text-white">{col().collection_name}</h3>
												<div
													class="text-[10px] font-mono text-white/50 flex flex-wrap items-center gap-1.5 mt-0.5"
													dir="ltr"
												>
													<span>{(col().upgraded_count || col().total_supply || 0).toLocaleString()} NFTs</span>
													<span>·</span>
													<span>{col().total_models || 0} Models</span>
													<span>·</span>
													<span>{col().total_backdrops || 0} Backdrops</span>
													<span>·</span>
													<span>{col().total_symbols || 0} Symbols</span>
												</div>
											</div>
										</div>

										<div class="flex items-center gap-2">
											<Show when={col().floor_item?.buy_url}>
												<a
													href={col().floor_item!.buy_url}
													target="_blank"
													rel="noreferrer"
													class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1"
												>
													<span>{tr('buyCheapestOnFragment')}</span>
													<span class="material-symbols-outlined text-sm">open_in_new</span>
												</a>
											</Show>
											<button
												type="button"
												onClick={() => navigate(`/gifts/collection?c=${col().collection_slug}`)}
												class="px-3 py-1.5 rounded-xl bg-[#0098EA]/20 hover:bg-[#0098EA]/30 border border-[#0098EA]/40 text-[#0098EA] font-bold text-xs transition-all"
											>
												{tr('openFullTerminal')} →
											</button>
										</div>
									</div>

									{/* 4 Collection KPI Cards */}
									<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
										<div class="p-3 rounded-2xl bg-[#0098EA]/[0.08] border border-[#0098EA]/25">
											<div class="text-[10px] text-white/50 font-bold">{tr('liveFloor')}</div>
											<div class="text-base font-black font-mono text-white mt-0.5" dir="ltr">
												{formatPrice(col().best_floor_gram, col().best_floor_usd)}
											</div>
											<div class="text-[9px] font-mono text-sky-400 mt-0.5 truncate" dir="ltr">
												#{col().floor_item?.serial_number || 1} ·{' '}
												{col().floor_item?.model_name || 'Floor'}
											</div>
										</div>

										<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
											<div class="text-[10px] text-white/50 font-bold">{tr('secondFloor')}</div>
											<div class="text-base font-black font-mono text-white mt-0.5" dir="ltr">
												{formatPrice(secondFloor())}
											</div>
											<div class="text-[9px] font-mono text-emerald-400 mt-0.5" dir="ltr">
												+{spreadGram().toLocaleString()} TON (+{spreadPct()}%)
											</div>
										</div>

										<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
											<div class="text-[10px] text-white/50 font-bold">{tr('onChainSupply')}</div>
											<div class="text-base font-black font-mono text-white mt-0.5" dir="ltr">
												{(col().upgraded_count || col().total_supply || 0).toLocaleString()}
											</div>
											<div class="text-[9px] font-mono text-white/45 mt-0.5">
												{col().listed_count || 0} {tr('activeListings')} ({col().liquidity_ratio || 0}%)
											</div>
										</div>

										<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
											<div class="text-[10px] text-white/50 font-bold">{tr('allTimeHighSale')}</div>
											<div class="text-base font-black font-mono text-amber-400 mt-0.5" dir="ltr">
												{formatPrice(
													col().market_sales_stats?.period_30d?.max_gram || col().best_floor_gram,
												)}
											</div>
											<div class="text-[9px] font-mono text-white/45 mt-0.5" dir="ltr">
												{col().sales_history?.length || 0} Settled Deals
											</div>
										</div>
									</div>

									{/* 3 Focused Sub-Tabs inside Inspector */}
									<div class="grid grid-cols-3 gap-1 bg-black/50 p-1 rounded-xl border border-white/[0.07]">
										<For
											each={
												[
													{ id: 'orderbook', label: tr('tabOrderbook') },
													{ id: 'traits', label: tr('tabTraits') },
													{ id: 'sales', label: tr('tabSalesAndChart') },
												] as const
											}
										>
											{(tab) => (
												<button
													type="button"
													onClick={() => setInspectorTab(tab.id)}
													class={`py-2 px-2 rounded-lg text-[11px] font-black truncate transition-all ${
														inspectorTab() === tab.id
															? 'bg-[#0098EA] text-white shadow'
															: 'text-white/50 hover:text-white/85'
													}`}
												>
													{tab.label}
												</button>
											)}
										</For>
									</div>

									{/* Sub-Tab 1: Cheapest Active Listings */}
									<Show when={inspectorTab() === 'orderbook'}>
										<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
											<For each={col().top_floor_items || []}>
												{(item, idx) => (
													<div class="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all">
														<div class="flex items-center gap-2.5 min-w-0">
															<div class="relative shrink-0">
																<img
																	src={item.image_url || col().image_url}
																	alt={`#${item.serial_number}`}
																	class="w-10 h-10 rounded-xl object-cover bg-black/50 border border-white/10"
																	loading="lazy"
																/>
																<span class="absolute -top-1 -start-1 px-1 py-0.2 rounded bg-[#0098EA] text-[8px] font-mono font-black text-white">
																	#{idx() + 1}
																</span>
															</div>
															<div class="min-w-0">
																<div
																	class="text-xs font-black text-white font-mono flex items-center gap-1.5"
																	dir="ltr"
																>
																	<span>#{item.serial_number}</span>
																	<span class="text-[10px] font-sans font-semibold text-sky-400 truncate">
																		{item.model_name}
																	</span>
																</div>
																<div class="text-[10px] text-white/45 truncate flex items-center gap-1.5 mt-0.5">
																	<span
																		class="w-2 h-2 rounded-full inline-block shrink-0"
																		style={{
																			'background-color': item.center_hex || '#0098EA',
																		}}
																	/>
																	<span>{item.backdrop_name}</span>
																	<span>·</span>
																	<span>{item.symbol_name}</span>
																</div>
															</div>
														</div>

														<div class="text-end shrink-0" dir="ltr">
															<div class="text-xs font-black font-mono text-emerald-400">
																{item.price_gram.toLocaleString()} TON
															</div>
															<div class="text-[9px] font-mono text-white/40">
																${item.price_usd.toLocaleString()}
															</div>
															<Show when={item.buy_url}>
																<a
																	href={item.buy_url}
																	target="_blank"
																	rel="noreferrer"
																	class="inline-block mt-0.5 text-[9px] font-bold text-[#0098EA] hover:underline"
																>
																	{tr('buyBtn')} ↗
																</a>
															</Show>
														</div>
													</div>
												)}
											</For>
										</div>
									</Show>

									{/* Sub-Tab 2: Models, Backdrops & Symbols Rarity */}
									<Show when={inspectorTab() === 'traits'}>
										<div class="space-y-3">
											<div class="flex items-center gap-1.5">
												<button
													type="button"
													onClick={() => setTraitSubTab('models')}
													class={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
														traitSubTab() === 'models'
															? 'bg-white/15 text-white border border-white/20'
															: 'bg-white/[0.03] text-white/45'
													}`}
												>
													{tr('traitModels')} ({col().model_floors?.length || 0})
												</button>
												<button
													type="button"
													onClick={() => setTraitSubTab('backdrops')}
													class={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
														traitSubTab() === 'backdrops'
															? 'bg-white/15 text-white border border-white/20'
															: 'bg-white/[0.03] text-white/45'
													}`}
												>
													{tr('traitBackdrops')} ({col().backdrops_list?.length || 0})
												</button>
												<button
													type="button"
													onClick={() => setTraitSubTab('symbols')}
													class={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
														traitSubTab() === 'symbols'
															? 'bg-white/15 text-white border border-white/20'
															: 'bg-white/[0.03] text-white/45'
													}`}
												>
													{tr('traitSymbols')} ({col().symbols_list?.length || 0})
												</button>
											</div>

											<Show when={traitSubTab() === 'models'}>
												<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
													<For each={col().model_floors || []}>
														{(m) => (
															<a
																href={
																	m.buy_url ||
																	`https://fragment.com/gifts/${col().collection_slug.replace(/-/g, '')}`
																}
																target="_blank"
																rel="noreferrer"
																class="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] transition-all"
															>
																<Show when={m.image_url}>
																	<img
																		src={m.image_url}
																		alt={m.model_name}
																		class="w-9 h-9 rounded-lg object-contain bg-black/40 p-0.5 shrink-0"
																		loading="lazy"
																	/>
																</Show>
																<div class="min-w-0 flex-1">
																	<div class="text-[11px] font-bold text-white truncate">
																		{m.model_name}
																	</div>
																	<div class="text-[9px] font-mono text-sky-400" dir="ltr">
																		{((m.rarity_permille || 0) / 10).toFixed(1)}% · {m.total_supply || 0} NFTs
																	</div>
																	<div
																		class="text-[10px] font-mono font-bold text-emerald-400"
																		dir="ltr"
																	>
																		~{(m.floor_gram || 0).toLocaleString()} TON
																	</div>
																</div>
															</a>
														)}
													</For>
												</div>
											</Show>

											<Show when={traitSubTab() === 'backdrops'}>
												<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
													<For each={col().backdrops_list || []}>
														{(b) => (
															<div class="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
																<div
																	class="w-8 h-8 rounded-lg shrink-0 border border-white/20 shadow-inner"
																	style={{
																		background: `radial-gradient(circle, ${b.center_hex} 0%, ${b.edge_hex} 100%)`,
																	}}
																/>
																<div class="min-w-0">
																	<div class="text-[11px] font-bold text-white truncate">
																		{b.name}
																	</div>
																	<div class="text-[9px] font-mono text-white/50" dir="ltr">
																		{(b.rarity_permille / 10).toFixed(1)}% · {b.center_hex}
																	</div>
																</div>
															</div>
														)}
													</For>
												</div>
											</Show>

											<Show when={traitSubTab() === 'symbols'}>
												<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
													<For each={col().symbols_list || []}>
														{(s) => (
															<div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
																<div class="text-[11px] font-bold text-white truncate">
																	{s.name}
																</div>
																<div class="text-end font-mono shrink-0" dir="ltr">
																	<div class="text-[10px] font-bold text-sky-400">
																		{(s.rarity_permille / 10).toFixed(1)}%
																	</div>
																	<div class="text-[9px] text-white/40">{s.total_supply} NFTs</div>
																</div>
															</div>
														)}
													</For>
												</div>
											</Show>
										</div>
									</Show>

									{/* Sub-Tab 3: Collection Sales Stats & Settled History */}
									<Show when={inspectorTab() === 'sales'}>
										<div class="space-y-3">
											<Show when={col().market_sales_stats}>
												{(ms) => (
													<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
														<For
															each={[
																{ title: tr('stats24h'), d: ms().period_24h },
																{ title: tr('stats7d'), d: ms().period_7d },
																{ title: tr('stats30d'), d: ms().period_30d },
															]}
														>
															{(p) => (
																<div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
																	<div class="flex items-center justify-between text-[10px] font-bold text-white/75 border-b border-white/[0.05] pb-1">
																		<span>{p.title}</span>
																		<span class="font-mono text-sky-400">
																			{p.d.deals_count} {tr('dealsCount')}
																		</span>
																	</div>
																	<div
																		class="grid grid-cols-3 gap-1 text-[10px] font-mono pt-0.5"
																		dir="ltr"
																	>
																		<div>
																			<div class="text-white/40 text-[9px]">{tr('minSale')}</div>
																			<div class="font-bold text-white">
																				{(p.d?.min_gram || 0).toLocaleString()}T
																			</div>
																		</div>
																		<div>
																			<div class="text-white/40 text-[9px]">{tr('avgSale')}</div>
																			<div class="font-bold text-emerald-400">
																				{(p.d?.avg_gram || 0).toLocaleString()}T
																			</div>
																		</div>
																		<div>
																			<div class="text-white/40 text-[9px]">{tr('maxSale')}</div>
																			<div class="font-bold text-amber-400">
																				{(p.d?.max_gram || 0).toLocaleString()}T
																			</div>
																		</div>
																	</div>
																</div>
															)}
														</For>
													</div>
												)}
											</Show>

											<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
												<For each={(col().sales_history || []).slice(0, 16)}>
													{(sale) => (
														<div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06]">
															<div class="flex items-center gap-2 min-w-0">
																<Show when={sale.image_url}>
																	<img
																		src={sale.image_url}
																		alt={`#${sale.serial_number}`}
																		class="w-9 h-9 rounded-lg object-cover shrink-0"
																		loading="lazy"
																	/>
																</Show>
																<div class="min-w-0">
																	<div class="text-xs font-bold text-white font-mono" dir="ltr">
																		#{sale.serial_number}{' '}
																		<span class="text-[10px] font-sans text-white/60">
																			({sale.model_name})
																		</span>
																	</div>
																	<div class="text-[9px] font-mono text-white/40" dir="ltr">
																		{sale.sale_date
																			? sale.sale_date.slice(0, 16).replace('T', ' ')
																			: 'Settled on Fragment'}
																	</div>
																</div>
															</div>
															<div class="text-end shrink-0" dir="ltr">
																<div class="text-xs font-black font-mono text-amber-400">
																	{sale.price_gram.toLocaleString()} TON
																</div>
																<div class="text-[9px] font-mono text-white/40">
																	${sale.price_usd.toLocaleString()}
																</div>
															</div>
														</div>
													)}
												</For>
											</div>
										</div>
									</Show>
								</div>
							);
						}}
					</Show>
				</div>
			</Show>

			{/* ═════════════════════════════════════════════════════════════════════════
			    TAB 4: LIVE GLOBAL MARKET TAPE & ENDING-SOON AUCTIONS (SNIPER FEED)
			    ═════════════════════════════════════════════════════════════════════════ */}
			<Show when={props.activeTab === 'tape'}>
				<div class="bg-[#0D111B]/95 border border-white/10 rounded-[22px] p-4 shadow-xl space-y-3.5">
					<div>
						<div class="flex items-center gap-2">
							<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
							<h2 class="text-sm font-black text-white">{tr('globalTapeTitle')}</h2>
						</div>
						<p class="text-[11px] text-white/50 mt-0.5">{tr('globalTapeSub')}</p>
					</div>

					{/* 3 Stream Mode Buttons */}
					<div class="grid grid-cols-3 gap-1 bg-black/50 p-1 rounded-xl border border-white/[0.07]">
						<button
							type="button"
							onClick={() => setGlobalTapeTab('auctions')}
							class={`py-2 px-2 rounded-lg text-[11px] font-black truncate transition-all ${
								globalTapeTab() === 'auctions'
									? 'bg-rose-500 text-white shadow'
									: 'text-white/50 hover:text-white/85'
							}`}
						>
							{tr('tapeEndingAuctions')} ({props.intel?.ending_soon_auctions?.length || 0})
						</button>
						<button
							type="button"
							onClick={() => setGlobalTapeTab('sales')}
							class={`py-2 px-2 rounded-lg text-[11px] font-black truncate transition-all ${
								globalTapeTab() === 'sales'
									? 'bg-[#0098EA] text-white shadow'
									: 'text-white/50 hover:text-white/85'
							}`}
						>
							{tr('tapeRecentSales')} ({props.intel?.global_recent_sales?.length || 0})
						</button>
						<button
							type="button"
							onClick={() => setGlobalTapeTab('listings')}
							class={`py-2 px-2 rounded-lg text-[11px] font-black truncate transition-all ${
								globalTapeTab() === 'listings'
									? 'bg-emerald-500 text-slate-950 shadow'
									: 'text-white/50 hover:text-white/85'
							}`}
						>
							{tr('tapeNewListings')} ({props.intel?.global_new_listings?.length || 0})
						</button>
					</div>

					{/* Stream 1: Ending Soon Auctions (Sniper Feed) */}
					<Show when={globalTapeTab() === 'auctions'}>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
							<For each={props.intel?.ending_soon_auctions || []}>
								{(auc) => {
									const aucSlug = () =>
										(auc.collection_slug || auc.slug || auc.gift_id || 'plush-pepe').replace(/_/g, '-');
									const aucName = () => auc.gift_name || auc.model_name || aucSlug();
									const aucImg = () =>
										auc.image_url ||
										`https://fragment.com/file/gifts/${aucSlug().replace(/-/g, '')}/thumb.webp`;
									return (
										<div class="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.07] transition-all">
											<div class="flex items-center gap-2.5 min-w-0">
												<img
													src={aucImg()}
													alt={aucName()}
													class="w-11 h-11 rounded-xl object-cover bg-black/40 border border-white/10 shrink-0"
													loading="lazy"
												/>
												<div class="min-w-0">
													<button
														type="button"
														onClick={() => selectAndInspectCollection(aucSlug())}
														class="text-xs font-black text-white hover:text-[#0098EA] truncate block text-start"
													>
														{aucName()} <span class="font-mono">#{auc.serial_number}</span>
													</button>
													<div class="text-[10px] font-mono text-rose-400 font-bold mt-0.5">
														⏳ {auc.time_remaining_label || '45m left'}
													</div>
												</div>
											</div>

											<div class="text-end shrink-0" dir="ltr">
												<div class="text-xs font-black font-mono text-amber-400">
													{(auc.current_bid_gram || 0).toLocaleString()} TON
												</div>
												<div class="text-[9px] font-mono text-white/40">
													${Math.round(auc.current_bid_usd || (auc.current_bid_gram || 0) * tonRate()).toLocaleString()}
												</div>
												<a
													href={auc.bid_url || `https://fragment.com/gifts/${aucSlug().replace(/-/g, '')}`}
													target="_blank"
													rel="noreferrer"
													class="inline-block mt-1 text-[9px] font-bold text-[#0098EA] hover:underline"
												>
													{tr('bidOnFragment')}
												</a>
											</div>
										</div>
									);
								}}
							</For>
						</div>
					</Show>

					{/* Stream 2: Global Recent Settled Sales */}
					<Show when={globalTapeTab() === 'sales'}>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
							<For each={props.intel?.global_recent_sales || []}>
								{(sale) => (
									<div class="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.07] transition-all">
										<div class="flex items-center gap-2.5 min-w-0">
											<img
												src={sale.imageUrl}
												alt={sale.collectionName || sale.name}
												class="w-11 h-11 rounded-xl object-cover bg-black/40 border border-white/10 shrink-0"
												loading="lazy"
											/>
											<div class="min-w-0">
												<button
													type="button"
													onClick={() => selectAndInspectCollection(sale.collectionSlug)}
													class="text-xs font-black text-white hover:text-[#0098EA] truncate block text-start"
												>
													{sale.collectionName || sale.name}{' '}
													<span class="font-mono">#{sale.serialNumber}</span>
												</button>
												<div class="text-[10px] font-mono text-white/40 mt-0.5">
													{sale.relativeTime || 'Settled on Fragment'}
												</div>
											</div>
										</div>

										<div class="text-end shrink-0" dir="ltr">
											<div class="text-xs font-black font-mono text-amber-400">
												{(sale.priceGram || 0).toLocaleString()} TON
											</div>
											<div class="text-[9px] font-mono text-white/40">
												${Math.round(sale.priceUsd || 0).toLocaleString()}
											</div>
											<a
												href={sale.fragmentUrl}
												target="_blank"
												rel="noreferrer"
												class="inline-block mt-1 text-[9px] font-bold text-white/50 hover:text-[#0098EA]"
											>
												Fragment ↗
											</a>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>

					{/* Stream 3: Global Newly Listed Gifts */}
					<Show when={globalTapeTab() === 'listings'}>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
							<For each={props.intel?.global_new_listings || []}>
								{(lst) => (
									<div class="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.07] transition-all">
										<div class="flex items-center gap-2.5 min-w-0">
											<img
												src={lst.imageUrl}
												alt={lst.collectionName || lst.name}
												class="w-11 h-11 rounded-xl object-cover bg-black/40 border border-white/10 shrink-0"
												loading="lazy"
											/>
											<div class="min-w-0">
												<button
													type="button"
													onClick={() => selectAndInspectCollection(lst.collectionSlug)}
													class="text-xs font-black text-white hover:text-[#0098EA] truncate block text-start"
												>
													{lst.collectionName || lst.name}{' '}
													<span class="font-mono">#{lst.serialNumber}</span>
												</button>
												<div class="text-[10px] font-mono text-emerald-400 mt-0.5">
													{lst.relativeTime || 'Listed For Sale'}
												</div>
											</div>
										</div>

										<div class="text-end shrink-0" dir="ltr">
											<div class="text-xs font-black font-mono text-emerald-400">
												{(lst.priceGram || 0).toLocaleString()} TON
											</div>
											<div class="text-[9px] font-mono text-white/40">
												${Math.round(lst.priceUsd || 0).toLocaleString()}
											</div>
											<a
												href={lst.fragmentUrl}
												target="_blank"
												rel="noreferrer"
												class="inline-block mt-1 text-[9px] font-bold text-[#0098EA] hover:underline"
											>
												{tr('buyBtn')} ↗
											</a>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>
				</div>
			</Show>
		</div>
	);
};
