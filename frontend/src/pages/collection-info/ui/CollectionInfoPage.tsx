import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { apiClient as api } from '@/shared/api/axios.js';
import { isRtl, locale, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
import { UsernameCollectionChart } from './UsernameCollectionChart.js';

interface CollectionStats {
	stat_date: string;
	items_count: string;
	owners_count: string;
	floor_price: string;
	buy_now_floor_ton?: number;
	auction_floor_ton?: number;
	total_volume: string;
	volume_30d_ton?: number;
	sales_30d_count?: number;
	avg_handles_per_owner?: number;
	active_auctions_count?: number;
	listed_for_sale_count?: number;
	source?: string;
	is_stale?: boolean;
}

interface CollectionAuction {
	item_name: string;
	price: string;
	price_ton?: number;
	status: string;
	auction_type?: string;
	ends_at?: string;
	time_left?: string;
	char_length?: number;
	tx_hash?: string;
	timestamp?: string;
	verified?: boolean;
}

interface FXRateInfo {
	ton_usd: number;
	source: string;
	observed_at: string;
	is_stale: boolean;
}

interface SourceHealth {
	name: string;
	status: string;
	observed_at: string;
}

interface LengthTierMetric {
	tier_name: string;
	length_bucket: string;
	theoretical_supply?: string;
	primary_min_bid_ton?: number;
	floor_price_ton: number;
	median_sale_30d_ton: number;
	volume_30d_ton: number;
	sales_count_30d: number;
	sell_through_pct: number;
}

interface UndervaluedAuctionItem {
	username: string;
	current_bid_ton: number;
	estimated_fair_ton: number;
	discount_pct: number;
	length: number;
	auction_type?: string;
	ends_at?: string;
	time_left?: string;
	signal: string;
	status: string;
}

interface CollectionData {
	collection_address?: string;
	stats: CollectionStats | null;
	length_tier_matrix?: LengthTierMetric[];
	undervalued_auctions?: UndervaluedAuctionItem[];
	auctions: CollectionAuction[];
	ending_soon_auctions?: CollectionAuction[];
	floor_listings?: CollectionAuction[];
	top_sales: CollectionAuction[];
	recent_activity: CollectionAuction[];
	fx?: FXRateInfo;
	sources?: SourceHealth[];
	ton_usd_rate?: number;
	status?: string;
}

interface LeaderboardItem {
	rank: number;
	handle: string;
	priceTon: number;
	priceUsd?: number;
	date: string;
	auctionType?: string;
	category: 'short' | 'crypto' | 'brand' | 'other';
	verified: boolean;
	txHash?: string;
}

type MainTab = 'overview' | 'market' | 'leaderboard';
type MarketStreamMode = 'top_bids' | 'ending_soon' | 'buy_now_floor';
type HallMode = 'all_time' | 'recent_sold';

interface CopyDictionary {
	liveOnChainBadge: string;
	tabOverview: string;
	tabMarket: string;
	tabHall: string;
	buyNowFloor: string;
	auctionFloor: string;
	vol30d: string;
	sales30d: string;
	txsUnit: string;
	avgPerOwner: string;
	tierMatrixTitle: string;
	tierMatrixBadge: string;
	tier4Name: string;
	tier5Name: string;
	tier6Name: string;
	tier7Name: string;
	strBadge: string;
	floor30dLabel: string;
	median30dLabel: string;
	primaryMinBid: string;
	sales30dShort: string;
	undervaluedTitle: string;
	liveAlphaBadge: string;
	fairValue: string;
	currentBid: string;
	topBidsStream: string;
	endingSoonStream: string;
	floorListingsStream: string;
	primaryMintBadge: string;
	resaleBadge: string;
	fixedPriceBadge: string;
	settledBadge: string;
	searchHandlesPlaceholder: string;
	lenAll: string;
	len4: string;
	len5: string;
	len6Plus: string;
	charUnitShort: string;
	noMatchingHandles: string;
	statusActive: string;
	statusEndingSoon: string;
	statusForSale: string;
	statusSold: string;
	allTimeRecordsTab: string;
	recentSoldTapeTab: string;
	filterAll: string;
	filterShort: string;
	filterCrypto: string;
	filterBrand: string;
}

const UI_COPY: Record<string, CopyDictionary> = {
	fa: {
		liveOnChainBadge: 'زنده روی زنجیره TON',
		tabOverview: 'نمای کلی',
		tabMarket: 'مزایده‌ها و بازار',
		tabHall: 'رکوردها و فروش‌ها',
		buyNowFloor: 'کف خرید آنی (Fragment)',
		auctionFloor: 'کف مزایده فعال',
		vol30d: 'حجم ۳۰ روزه',
		sales30d: 'معاملات ۳۰ روزه',
		txsUnit: 'معامله',
		avgPerOwner: 'میانگین هر مالک',
		tierMatrixTitle: 'ماتریس کمیابی، کف مینت اولیه و نقدشوندگی طولی',
		tierMatrixBadge: '۳۰ روزه آن‌چین',
		tier4Name: '۴ حرفی کمیاب (4-Char)',
		tier5Name: '۵ حرفی پریمیوم (5-Char)',
		tier6Name: '۶ حرفی برند (6-Char)',
		tier7Name: '۷+ حرفی و لغات دیکشنری',
		strBadge: 'نقدشوندگی',
		floor30dLabel: 'کف ۳۰ روزه',
		median30dLabel: 'میانه ۳۰ روزه',
		primaryMinBid: 'کف مینت تلگرام',
		sales30dShort: 'فروش ۳۰ روزه',
		undervaluedTitle: 'رادار شکار مزایده‌های زیر ارزش ذاتی (AVM Alpha)',
		liveAlphaBadge: 'آلفای زنده',
		fairValue: 'ارزش ذاتی',
		currentBid: 'پیشنهاد فعلی',
		topBidsStream: 'داغ‌ترین مزایده‌ها',
		endingSoonStream: 'در حال اتمام (Sniper)',
		floorListingsStream: 'کف خرید آنی',
		primaryMintBadge: 'مینت اولیه تلگرام',
		resaleBadge: 'فروش مجدد مالک',
		fixedPriceBadge: 'قیمت مقطوع',
		settledBadge: 'تسویه‌شده',
		searchHandlesPlaceholder: 'جستجو در نام‌های کاربری زنده (@handle)...',
		lenAll: 'همه',
		len4: '۴حرف',
		len5: '۵حرف',
		len6Plus: '۶+حرف',
		charUnitShort: 'حرف',
		noMatchingHandles: 'هیچ نام کاربری منطبقی در این جریان یافت نشد.',
		statusActive: 'مزایده فعال',
		statusEndingSoon: 'رو به اتمام',
		statusForSale: 'فروش آنی',
		statusSold: 'فروخته‌شده',
		allTimeRecordsTab: 'گران‌ترین‌های تاریخ',
		recentSoldTapeTab: 'آخرین فروش‌های لحظه‌ای',
		filterAll: 'همه یوزرنیم‌ها',
		filterShort: '۴ حرفی کمیاب',
		filterCrypto: 'کریپتو و TON',
		filterBrand: 'لغات و برندها',
	},
	en: {
		liveOnChainBadge: 'LIVE ON-CHAIN',
		tabOverview: 'Overview',
		tabMarket: 'Live Market',
		tabHall: 'Hall of Fame',
		buyNowFloor: 'Buy-Now Floor (Fragment)',
		auctionFloor: 'Min Auction Bid',
		vol30d: '30D Volume',
		sales30d: '30D Settled',
		txsUnit: 'TXs',
		avgPerOwner: 'Avg / Holder',
		tierMatrixTitle: 'Length-Tier Scarcity & Liquidity Matrix',
		tierMatrixBadge: '30D ON-CHAIN',
		tier4Name: '4-Letter Ultra-Rare',
		tier5Name: '5-Letter Premium',
		tier6Name: '6-Letter Brand',
		tier7Name: '7+ & Dictionary Words',
		strBadge: 'STR',
		floor30dLabel: '30d Floor',
		median30dLabel: '30d Median',
		primaryMinBid: 'Primary Mint Base',
		sales30dShort: '30d Sales',
		undervaluedTitle: 'Undervalued Auction Radar (AVM Alpha)',
		liveAlphaBadge: 'LIVE ALPHA',
		fairValue: 'Fair Value',
		currentBid: 'Current Bid',
		topBidsStream: 'Top Bids',
		endingSoonStream: 'Ending Soon',
		floorListingsStream: 'Buy-Now Floor',
		primaryMintBadge: 'Primary Mint',
		resaleBadge: 'Secondary Resale',
		fixedPriceBadge: 'Fixed Price',
		settledBadge: 'Settled',
		searchHandlesPlaceholder: 'Filter live handles (@handle)...',
		lenAll: 'ALL',
		len4: '4C',
		len5: '5C',
		len6Plus: '6+C',
		charUnitShort: 'C',
		noMatchingHandles: 'No matching handles found in the current stream.',
		statusActive: 'Active Auction',
		statusEndingSoon: 'Ending Soon',
		statusForSale: 'For Sale',
		statusSold: 'Sold',
		allTimeRecordsTab: 'All-Time Records',
		recentSoldTapeTab: 'Live Sold Tape',
		filterAll: 'All Handles',
		filterShort: '4-Letter Rare',
		filterCrypto: 'Crypto & TON',
		filterBrand: 'Dictionary & Brands',
	},
	ru: {
		liveOnChainBadge: 'ОНЧЕЙН LIVE',
		tabOverview: 'Обзор',
		tabMarket: 'Аукционы',
		tabHall: 'Рекорды',
		buyNowFloor: 'Флор покупки (Fragment)',
		auctionFloor: 'Мин. ставка',
		vol30d: 'Объём 30Д',
		sales30d: 'Сделки 30Д',
		txsUnit: 'сделок',
		avgPerOwner: 'На холдера',
		tierMatrixTitle: 'Матрица дефицита и ликвидности по длине',
		tierMatrixBadge: '30Д ОНЧЕЙН',
		tier4Name: '4-символьные редкие',
		tier5Name: '5-символьные премиум',
		tier6Name: '6-символьные бренды',
		tier7Name: '7+ и словарные слова',
		strBadge: 'Ликв.',
		floor30dLabel: 'Флор 30д',
		median30dLabel: 'Медиана 30д',
		primaryMinBid: 'База минта',
		sales30dShort: 'Сделки 30д',
		undervaluedTitle: 'Радар недооценённых аукционов (AVM Alpha)',
		liveAlphaBadge: 'АЛЬФА LIVE',
		fairValue: 'Справедливая',
		currentBid: 'Текущая ставка',
		topBidsStream: 'Топ ставки',
		endingSoonStream: 'Скоро конец',
		floorListingsStream: 'Флор продаж',
		primaryMintBadge: 'Первичный минт',
		resaleBadge: 'Перепродажа',
		fixedPriceBadge: 'Фикс. цена',
		settledBadge: 'Завершено',
		searchHandlesPlaceholder: 'Поиск по живым лотам (@handle)...',
		lenAll: 'ВСЕ',
		len4: '4С',
		len5: '5С',
		len6Plus: '6+С',
		charUnitShort: 'С',
		noMatchingHandles: 'В текущем потоке подходящих юзернеймов не найдено.',
		statusActive: 'Активный аукцион',
		statusEndingSoon: 'Скоро закрытие',
		statusForSale: 'В продаже',
		statusSold: 'Продано',
		allTimeRecordsTab: 'Рекорды за всё время',
		recentSoldTapeTab: 'Лента продаж',
		filterAll: 'Все лоты',
		filterShort: '4-буквенные',
		filterCrypto: 'Крипто и TON',
		filterBrand: 'Бренды и слова',
	},
	zh: {
		liveOnChainBadge: '链上实时 LIVE',
		tabOverview: '市场总览',
		tabMarket: '实时拍卖',
		tabHall: '成交纪录',
		buyNowFloor: '一口价地板 (Fragment)',
		auctionFloor: '最低竞拍价',
		vol30d: '30天交易量',
		sales30d: '30天成交数',
		txsUnit: '笔',
		avgPerOwner: '人均持有',
		tierMatrixTitle: '字符长度稀缺度与流动性矩阵',
		tierMatrixBadge: '30天链上实盘',
		tier4Name: '4字符极品短号',
		tier5Name: '5字符高级短号',
		tier6Name: '6字符品牌短号',
		tier7Name: '7+字符与词典单词',
		strBadge: '成交率',
		floor30dLabel: '30天地板',
		median30dLabel: '30天中位',
		primaryMinBid: '官方起拍价',
		sales30dShort: '30天成交',
		undervaluedTitle: '低估拍卖阿尔法雷达 (AVM Alpha)',
		liveAlphaBadge: '实时阿尔法',
		fairValue: '公允估值',
		currentBid: '当前出价',
		topBidsStream: '最高出价',
		endingSoonStream: '即将截标',
		floorListingsStream: '一口价地板',
		primaryMintBadge: '官方首发铸造',
		resaleBadge: '二级转售',
		fixedPriceBadge: '一口价',
		settledBadge: '已成交',
		searchHandlesPlaceholder: '搜索实时用户名 (@handle)...',
		lenAll: '全部',
		len4: '4位',
		len5: '5位',
		len6Plus: '6+位',
		charUnitShort: '位',
		noMatchingHandles: '当前流中未找到匹配的用户名。',
		statusActive: '竞拍中',
		statusEndingSoon: '即将结束',
		statusForSale: '在售一口价',
		statusSold: '已售出',
		allTimeRecordsTab: '历史最高成交榜',
		recentSoldTapeTab: '实时成交磁带',
		filterAll: '全部用户名',
		filterShort: '4位极品短号',
		filterCrypto: '加密与 TON',
		filterBrand: '词典与品牌',
	},
};

export const CollectionInfoPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const copy = () => UI_COPY[locale()] || UI_COPY.fa;

	const [activeTab, setActiveTab] = createSignal<MainTab>('overview');
	const [marketStream, setMarketStream] = createSignal<MarketStreamMode>('top_bids');
	const [marketSearch, setMarketSearch] = createSignal('');
	const [marketLenFilter, setMarketLenFilter] = createSignal<'all' | '4' | '5' | '6+'>('all');

	const [hallMode, setHallMode] = createSignal<HallMode>('all_time');
	const [leaderboardFilter, setLeaderboardFilter] = createSignal<
		'all' | 'short' | 'crypto' | 'brand'
	>('all');

	const usernameQuery = createQuery(() => ({
		queryKey: ['usernameCollectionStats'],
		queryFn: async () => {
			const { data } = await api.get<CollectionData>('/usernames/collection/stats');
			return data;
		},
		staleTime: 2 * 60 * 1000,
	}));

	const tonUsdRate = createMemo<number | undefined>(() => {
		return usernameQuery.data?.fx?.ton_usd ?? usernameQuery.data?.ton_usd_rate;
	});

	const localizedTierName = (bucket: string, fallback: string) => {
		const c = copy();
		if (bucket === '4') return c.tier4Name;
		if (bucket === '5') return c.tier5Name;
		if (bucket === '6') return c.tier6Name;
		if (bucket === '7+') return c.tier7Name;
		return fallback;
	};

	const localizedStatus = (st?: string) => {
		const c = copy();
		if (!st) return c.statusActive;
		const low = st.toLowerCase();
		if (low.includes('ending')) return c.statusEndingSoon;
		if (low.includes('sale')) return c.statusForSale;
		if (low.includes('sold') || low.includes('confirmed')) return c.statusSold;
		return st;
	};

	const localizedTimeLeft = (raw?: string) => {
		if (!raw) return '';
		const lang = locale();
		if (lang === 'en') return raw;
		if (lang === 'fa') {
			return raw
				.replace(/0 seconds/gi, 'در حال بسته‌شدن')
				.replace(/days?/gi, 'روز')
				.replace(/hours?/gi, 'ساعت')
				.replace(/minutes?/gi, 'دقیقه')
				.replace(/seconds?/gi, 'ثانیه');
		}
		if (lang === 'ru') {
			return raw
				.replace(/0 seconds/gi, 'Закрывается')
				.replace(/days?/gi, 'дн.')
				.replace(/hours?/gi, 'ч.')
				.replace(/minutes?/gi, 'мин.')
				.replace(/seconds?/gi, 'сек.');
		}
		if (lang === 'zh') {
			return raw
				.replace(/0 seconds/gi, '即将截标')
				.replace(/days?/gi, '天')
				.replace(/hours?/gi, '小时')
				.replace(/minutes?/gi, '分')
				.replace(/seconds?/gi, '秒');
		}
		return raw;
	};

	const activeMarketItems = createMemo<CollectionAuction[]>(() => {
		const d = usernameQuery.data;
		if (!d) return [];
		let base: CollectionAuction[] = [];
		if (marketStream() === 'ending_soon') {
			base = d.ending_soon_auctions || d.auctions || [];
		} else if (marketStream() === 'buy_now_floor') {
			base = d.floor_listings || [];
		} else {
			base = d.auctions || [];
		}

		const q = marketSearch().trim().toLowerCase().replace(/^@/, '');
		const lf = marketLenFilter();

		return base.filter((item) => {
			const clean = item.item_name.replace(/^@/, '').toLowerCase();
			if (q && !clean.includes(q)) return false;
			const cLen = item.char_length || clean.length;
			if (lf === '4' && cLen > 4) return false;
			if (lf === '5' && cLen !== 5) return false;
			if (lf === '6+' && cLen < 6) return false;
			return true;
		});
	});

	const filteredLeaderboard = createMemo<LeaderboardItem[]>(() => {
		const sourceList =
			hallMode() === 'recent_sold'
				? usernameQuery.data?.recent_activity || []
				: usernameQuery.data?.top_sales || [];
		if (sourceList.length === 0) return [];
		const rate = tonUsdRate();

		return sourceList
			.map((item, idx) => {
				const cleanName = item.item_name.replace('@', '');
				const priceNum = item.price_ton || parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0;
				let category: 'short' | 'crypto' | 'brand' | 'other' = 'other';
				if (cleanName.length <= 4) category = 'short';
				else if (/crypto|ton|btc|eth|sol|gram|coin|wallet|dex|nft|pay|bank/i.test(cleanName))
					category = 'crypto';
				else category = 'brand';

				return {
					rank: idx + 1,
					handle: cleanName,
					priceTon: priceNum,
					priceUsd: rate && rate > 0 ? priceNum * rate : undefined,
					date: item.time_left || item.ends_at || localizedStatus(item.status),
					auctionType: item.auction_type,
					category: category,
					verified: Boolean(item.tx_hash || item.verified),
					txHash: item.tx_hash,
				};
			})
			.filter((item) => {
				const filter = leaderboardFilter();
				if (filter === 'all') return true;
				return item.category === filter;
			});
	});

	const openValuation = (handle: string) => {
		try {
			haptic.impact('light');
		} catch {}
		const clean = handle.trim().replace(/^@/, '');
		if (!clean) return;
		navigate(`/username/report?u=${encodeURIComponent(clean)}`);
	};

	const fmtCompactTon = (val?: number) => {
		if (val === undefined || val === null || val <= 0) return '—';
		if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M TON`;
		if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K TON`;
		return `${val.toLocaleString()} TON`;
	};

	return (
		<div
			class="min-h-screen bg-[#05070C] text-white font-sans selection:bg-[#0098EA]/30 flex flex-col relative pb-36 overflow-x-hidden"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Dynamic Gradient Glow */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[420px] bg-gradient-to-b from-[#0098EA]/20 via-cyan-500/8 to-transparent blur-[110px] pointer-events-none z-0" />

			<div class="w-full max-w-[480px] mx-auto px-4 flex flex-col relative z-10 flex-1">
				{/* ═══════ HEADER ═══════ */}
				<div class="flex flex-col items-start pt-5 pb-2 px-0.5">
					<div class="flex items-center justify-between w-full mb-2.5">
						<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0098EA]/10 border border-[#0098EA]/25 rounded-full text-[9px] font-black uppercase tracking-widest text-[#0098EA] shadow-sm">
							<span class="w-1.5 h-1.5 rounded-full bg-[#0098EA] animate-pulse shadow-[0_0_6px_#0098EA]" />
							{t('collectionInfo.fragmentTerminal') || 'TeleMint Market Terminal'}
						</span>

						<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
							<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
							<span class="text-[9px] font-mono text-emerald-400 font-bold tracking-wider">
								{copy().liveOnChainBadge}
							</span>
						</div>
					</div>

					<h1 class="text-[26px] font-black tracking-tight text-white leading-tight mb-1.5">
						{t('action.username.collection_stats_title') || 'Telegram Usernames'}
					</h1>
					<p class="text-[12px] text-white/55 leading-relaxed font-medium">
						{t('action.username.collection_stats_subtitle') ||
							'Audited TON TeleMint & Fragment liquidity, live sniper auctions & verified records.'}
					</p>

					{/* 3-TAB NAVIGATION BAR (OVERVIEW, LIVE MARKET, HALL OF FAME) */}
					<div class="w-full grid grid-cols-3 gap-1.5 bg-[#0D111B]/95 border border-white/10 rounded-[18px] p-1.5 mt-4 shadow-xl backdrop-blur-xl">
						{(
							[
								{ id: 'overview', label: copy().tabOverview, icon: 'dashboard' },
								{ id: 'market', label: copy().tabMarket, icon: 'gavel' },
								{ id: 'leaderboard', label: copy().tabHall, icon: 'military_tech' },
							] as const
						).map((tab) => (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									setActiveTab(tab.id);
								}}
								class={`py-2.5 px-2 rounded-[13px] text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
									activeTab() === tab.id
										? 'bg-gradient-to-r from-[#0098EA] to-[#0077B8] text-white shadow-lg shadow-[#0098EA]/25'
										: 'text-white/50 hover:text-white/85'
								}`}
							>
								<span class="material-symbols-outlined text-[16px]">{tab.icon}</span>
								<span class="truncate">{tab.label}</span>
							</button>
						))}
					</div>
				</div>

				{/* ═══════ LOADING STATE ═══════ */}
				<Show when={usernameQuery.isLoading}>
					<div class="flex flex-col items-center justify-center h-[40vh]">
						<div class="w-12 h-12 border-[3px] border-white/10 border-t-[#0098EA] rounded-full animate-spin mb-4 shadow-[0_0_15px_#0098EA]" />
						<span class="text-[12px] font-mono font-bold tracking-widest text-white/40 uppercase animate-pulse">
							{t('collectionInfo.syncingOnChain')}
						</span>
					</div>
				</Show>

				{/* ═══════════════════════════════════════════════════════════════════
				    TAB 1: OVERVIEW (REAL MACRO KPIs, CHART, LENGTH TIERS & ALPHA RADAR)
				    ═══════════════════════════════════════════════════════════════════ */}
				<Show when={activeTab() === 'overview' && !usernameQuery.isLoading}>
					<div class="flex flex-col gap-4 mt-3">
						{/* 4-CARD PRIMARY ON-CHAIN KPI GRID */}
						<div class="grid grid-cols-2 gap-2.5">
							{/* Buy-Now Floor & Auction Floor */}
							<div class="bg-[#0D111B]/90 backdrop-blur-xl border border-white/10 rounded-[20px] p-3.5 flex flex-col justify-between shadow-lg">
								<div>
									<div class="flex items-center justify-between mb-1">
										<span class="text-[10px] text-white/45 uppercase tracking-wider font-black">
											{copy().buyNowFloor}
										</span>
										<span class="material-symbols-outlined text-[#0098EA] text-[15px]">sell</span>
									</div>
									<div class="flex items-baseline gap-1" dir="ltr">
										<span class="text-[22px] font-black font-mono text-white tracking-tight">
											{usernameQuery.data?.stats?.floor_price?.replace('TON', '').trim() || '6'}
										</span>
										<span class="text-[11px] text-[#0098EA] font-black">TON</span>
										<Show when={tonUsdRate() && tonUsdRate()! > 0}>
											<span class="text-[11px] text-white/40 font-mono ms-1">
												≈ $
												{(
													(usernameQuery.data?.stats?.buy_now_floor_ton ||
														parseFloat(
															usernameQuery.data?.stats?.floor_price?.replace(/[^0-9.]/g, '') ||
																'6',
														)) * tonUsdRate()!
												).toFixed(1)}
											</span>
										</Show>
									</div>
								</div>
								<div class="text-[10px] text-white/50 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
									<span>{copy().auctionFloor}:</span>
									<strong class="text-amber-400" dir="ltr">
										{usernameQuery.data?.stats?.auction_floor_ton || 2} TON
									</strong>
								</div>
							</div>

							{/* All-Time & 30D Volume */}
							<div class="bg-[#0D111B]/90 backdrop-blur-xl border border-white/10 rounded-[20px] p-3.5 flex flex-col justify-between shadow-lg">
								<div>
									<div class="flex items-center justify-between mb-1">
										<span class="text-[10px] text-white/45 uppercase tracking-wider font-black">
											{t('collectionInfo.totalVolume')}
										</span>
										<span class="material-symbols-outlined text-emerald-400 text-[15px]">
											payments
										</span>
									</div>
									<div class="flex items-baseline gap-1" dir="ltr">
										<span class="text-[22px] font-black font-mono text-white tracking-tight">
											{usernameQuery.data?.stats?.total_volume?.replace('TON', '').trim() ||
												'124.0M'}
										</span>
										<span class="text-[11px] text-emerald-400 font-black">TON</span>
									</div>
								</div>
								<div class="text-[10px] text-white/50 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
									<span>{copy().vol30d}:</span>
									<strong class="text-emerald-400" dir="ltr">
										{fmtCompactTon(usernameQuery.data?.stats?.volume_30d_ton)}
									</strong>
								</div>
							</div>

							{/* Minted Handles & 30D Sales */}
							<div class="bg-[#0D111B]/90 backdrop-blur-xl border border-white/10 rounded-[20px] p-3.5 flex flex-col justify-between shadow-lg">
								<div>
									<div class="flex items-center justify-between mb-1">
										<span class="text-[10px] text-white/45 uppercase tracking-wider font-black">
											{t('collectionInfo.mintedHandles')}
										</span>
										<span class="material-symbols-outlined text-sky-400 text-[15px]">verified</span>
									</div>
									<span
										class="text-[21px] font-black font-mono text-white tracking-tight block"
										dir="ltr"
									>
										{usernameQuery.data?.stats?.items_count || '582.8K'}
									</span>
								</div>
								<div class="text-[10px] text-white/50 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
									<span>{copy().sales30d}:</span>
									<strong class="text-sky-400">
										{(usernameQuery.data?.stats?.sales_30d_count || 0).toLocaleString()}{' '}
										{copy().txsUnit}
									</strong>
								</div>
							</div>

							{/* Unique Owners & Concentration */}
							<div class="bg-[#0D111B]/90 backdrop-blur-xl border border-white/10 rounded-[20px] p-3.5 flex flex-col justify-between shadow-lg">
								<div>
									<div class="flex items-center justify-between mb-1">
										<span class="text-[10px] text-white/45 uppercase tracking-wider font-black">
											{t('collectionInfo.totalOwners')}
										</span>
										<span class="material-symbols-outlined text-purple-400 text-[15px]">
											groups
										</span>
									</div>
									<span
										class="text-[21px] font-black font-mono text-white tracking-tight block"
										dir="ltr"
									>
										{usernameQuery.data?.stats?.owners_count || '164.6K'}
									</span>
								</div>
								<div class="text-[10px] text-white/50 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
									<span>{copy().avgPerOwner}:</span>
									<strong class="text-purple-400" dir="ltr">
										{usernameQuery.data?.stats?.avg_handles_per_owner || 3.54}x
									</strong>
								</div>
							</div>
						</div>

						{/* INTERACTIVE FLOOR / MEDIAN / VOLUME HISTORY CHART */}
						<UsernameCollectionChart
							currentFloorTon={
								usernameQuery.data?.stats?.buy_now_floor_ton ||
								(usernameQuery.data?.stats?.floor_price
									? parseFloat(usernameQuery.data.stats.floor_price.replace(/[^0-9.]/g, '') || '6')
									: undefined)
							}
							totalVolumeTon={usernameQuery.data?.stats?.total_volume}
							tonUsdRate={tonUsdRate()}
						/>

						{/* LENGTH-TIER SCARCITY & LIQUIDITY MATRIX */}
						<Show when={(usernameQuery.data?.length_tier_matrix?.length ?? 0) > 0}>
							<div class="flex flex-col gap-2.5 mt-1">
								<div class="flex items-center justify-between px-1">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-[#0098EA] text-[18px]">
											stacked_bar_chart
										</span>
										<h3 class="text-[12px] font-black tracking-wide text-white uppercase">
											{copy().tierMatrixTitle}
										</h3>
									</div>
									<span class="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#0098EA]/15 text-[#0098EA] font-bold">
										{copy().tierMatrixBadge}
									</span>
								</div>

								<div class="grid grid-cols-2 gap-2.5">
									<For each={usernameQuery.data?.length_tier_matrix || []}>
										{(tier) => (
											<div class="bg-[#0D111B]/90 border border-white/10 rounded-[20px] p-3.5 flex flex-col gap-2 shadow-lg">
												<div class="flex items-center justify-between gap-1">
													<span class="text-[11px] font-black text-white truncate">
														{localizedTierName(tier.length_bucket, tier.tier_name)}
													</span>
													<span class="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-[#0098EA]/15 text-[#0098EA] font-bold shrink-0">
														{tier.sell_through_pct}% {copy().strBadge}
													</span>
												</div>

												{/* Progress Bar for Sell-Through */}
												<div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
													<div
														class="h-full bg-gradient-to-r from-[#0098EA] to-emerald-400 rounded-full"
														style={{ width: `${Math.min(100, tier.sell_through_pct)}%` }}
													/>
												</div>

												<div class="space-y-1 text-[10px] font-mono pt-0.5">
													<div class="flex items-center justify-between">
														<span class="text-white/40">{copy().floor30dLabel}</span>
														<span class="text-white font-black" dir="ltr">
															{tier.floor_price_ton.toLocaleString()} TON
														</span>
													</div>
													<div class="flex items-center justify-between">
														<span class="text-white/40">{copy().median30dLabel}</span>
														<span class="text-emerald-400 font-bold" dir="ltr">
															{tier.median_sale_30d_ton.toLocaleString()} TON
														</span>
													</div>
													<Show when={tier.primary_min_bid_ton}>
														<div class="flex items-center justify-between">
															<span class="text-white/40">{copy().primaryMinBid}</span>
															<span class="text-amber-400 font-bold" dir="ltr">
																{tier.primary_min_bid_ton} TON
															</span>
														</div>
													</Show>
													<Show when={tier.sales_count_30d > 0}>
														<div class="flex items-center justify-between pt-1 border-t border-white/5">
															<span class="text-white/40">{copy().sales30dShort}</span>
															<span class="text-sky-400 font-bold" dir="ltr">
																{tier.sales_count_30d} ({fmtCompactTon(tier.volume_30d_ton)})
															</span>
														</div>
													</Show>
												</div>
											</div>
										)}
									</For>
								</div>
							</div>
						</Show>

						{/* AVM UNDERVALUED AUCTION RADAR */}
						<Show when={(usernameQuery.data?.undervalued_auctions?.length ?? 0) > 0}>
							<div class="flex flex-col gap-2.5 mt-1">
								<div class="flex items-center justify-between px-1">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-emerald-400 text-[18px]">
											radar
										</span>
										<h3 class="text-[12px] font-black tracking-wide text-white uppercase">
											{copy().undervaluedTitle}
										</h3>
									</div>
									<span class="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
										{copy().liveAlphaBadge}
									</span>
								</div>

								<div class="bg-[#0D111B]/90 border border-white/10 rounded-[22px] overflow-hidden shadow-xl">
									<For each={(usernameQuery.data?.undervalued_auctions || []).slice(0, 6)}>
										{(item, idx) => (
											<div
												onClick={() => openValuation(item.username)}
												class={`flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer ${
													idx() !== 0 ? 'border-t border-white/5' : ''
												}`}
											>
												<div class="flex flex-col text-start min-w-0 gap-1">
													<div class="flex items-center gap-2 flex-wrap">
														<span class="font-black text-[14px] text-white font-mono" dir="ltr">
															{item.username}
														</span>
														<span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-bold">
															−{item.discount_pct}%
														</span>
														<Show when={item.auction_type}>
															<span
																class={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
																	item.auction_type === 'Primary Mint'
																		? 'bg-[#0098EA]/15 text-[#0098EA]'
																		: 'bg-purple-500/15 text-purple-300'
																}`}
															>
																{item.auction_type === 'Primary Mint'
																	? copy().primaryMintBadge
																	: copy().resaleBadge}
															</span>
														</Show>
													</div>
													<div class="flex items-center gap-2 text-[10px] text-white/50 font-mono">
														<span>
															{copy().fairValue}:{' '}
															<strong class="text-emerald-400" dir="ltr">
																{item.estimated_fair_ton.toLocaleString()} TON
															</strong>
														</span>
														<Show when={item.time_left}>
															<span>•</span>
															<span class="text-amber-400">
																⏱ {localizedTimeLeft(item.time_left)}
															</span>
														</Show>
													</div>
												</div>

												<div class="flex flex-col items-end shrink-0" dir="ltr">
													<span class="text-[14px] font-black font-mono text-white">
														{item.current_bid_ton.toLocaleString()} TON
													</span>
													<span class="text-[9px] text-white/40">{copy().currentBid}</span>
												</div>
											</div>
										)}
									</For>
								</div>
							</div>
						</Show>
					</div>
				</Show>

				{/* ═══════════════════════════════════════════════════════════════════
				    TAB 2: LIVE AUCTIONS, SNIPER COUNTDOWN & BUY-NOW FLOOR
				    ═══════════════════════════════════════════════════════════════════ */}
				<Show when={activeTab() === 'market' && !usernameQuery.isLoading}>
					<div class="flex flex-col gap-3.5 mt-3">
						{/* Stream Sub-Mode Switcher */}
						<div class="grid grid-cols-3 gap-1.5 bg-[#0D111B]/95 p-1.5 rounded-[18px] border border-white/10">
							<button
								type="button"
								onClick={() => {
									setMarketStream('top_bids');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`py-2 px-2 rounded-[13px] text-[10px] font-black transition-all flex items-center justify-center gap-1 ${
									marketStream() === 'top_bids'
										? 'bg-[#0098EA] text-white shadow-md'
										: 'text-white/50 hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-[14px]">local_fire_department</span>
								<span class="truncate">{copy().topBidsStream}</span>
							</button>

							<button
								type="button"
								onClick={() => {
									setMarketStream('ending_soon');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`py-2 px-2 rounded-[13px] text-[10px] font-black transition-all flex items-center justify-center gap-1 ${
									marketStream() === 'ending_soon'
										? 'bg-amber-500 text-black shadow-md'
										: 'text-white/50 hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-[14px]">timer</span>
								<span class="truncate">{copy().endingSoonStream}</span>
							</button>

							<button
								type="button"
								onClick={() => {
									setMarketStream('buy_now_floor');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`py-2 px-2 rounded-[13px] text-[10px] font-black transition-all flex items-center justify-center gap-1 ${
									marketStream() === 'buy_now_floor'
										? 'bg-emerald-500 text-black shadow-md'
										: 'text-white/50 hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-[14px]">sell</span>
								<span class="truncate">{copy().floorListingsStream}</span>
							</button>
						</div>

						{/* Search & Length Filter Bar */}
						<div class="flex items-center gap-2">
							<div class="flex-1 relative">
								<input
									type="text"
									value={marketSearch()}
									onInput={(e) => setMarketSearch(e.currentTarget.value)}
									placeholder={copy().searchHandlesPlaceholder}
									class="w-full bg-[#0D111B]/90 border border-white/10 focus:border-[#0098EA] rounded-[14px] px-3.5 py-2 text-[12px] text-white placeholder:text-white/35 outline-none font-mono"
									dir="ltr"
								/>
							</div>

							<div class="flex items-center gap-1 bg-[#0D111B]/90 border border-white/10 rounded-[14px] p-1 font-mono text-[10px]">
								{(
									[
										{ id: 'all', label: copy().lenAll },
										{ id: '4', label: copy().len4 },
										{ id: '5', label: copy().len5 },
										{ id: '6+', label: copy().len6Plus },
									] as const
								).map((lf) => (
									<button
										type="button"
										onClick={() => setMarketLenFilter(lf.id)}
										class={`px-2 py-1 rounded-[10px] font-black transition-all ${
											marketLenFilter() === lf.id
												? 'bg-[#0098EA] text-white'
												: 'text-white/45 hover:text-white'
										}`}
									>
										{lf.label}
									</button>
								))}
							</div>
						</div>

						{/* Live Stream List */}
						<div class="bg-[#0D111B]/90 backdrop-blur-xl border border-white/10 rounded-[22px] overflow-hidden shadow-xl">
							<Show
								when={activeMarketItems().length > 0}
								fallback={
									<div class="p-8 text-center text-white/40 text-xs font-mono">
										{copy().noMatchingHandles}
									</div>
								}
							>
								<For each={activeMarketItems()}>
									{(auc, index) => {
										const rate = tonUsdRate() || 0;
										const pTon =
											auc.price_ton || parseFloat(auc.price.replace(/[^0-9.]/g, '')) || 0;
										return (
											<div
												onClick={() => openValuation(auc.item_name)}
												class={`flex items-center justify-between p-3.5 hover:bg-white/[0.04] transition-colors cursor-pointer active:scale-[0.99] ${
													index() !== 0 ? 'border-t border-white/5' : ''
												}`}
											>
												<div class="flex items-center gap-3 min-w-0">
													<div class="w-10 h-10 rounded-[12px] bg-[#06080E] flex flex-col items-center justify-center text-white/90 font-black text-[12px] border border-white/10 shrink-0 font-mono">
														<span>
															{auc.item_name.replace('@', '').substring(0, 2).toUpperCase()}
														</span>
														<span class="text-[8px] text-[#0098EA]">
															{auc.char_length || auc.item_name.replace('@', '').length}
															{copy().charUnitShort}
														</span>
													</div>

													<div class="flex flex-col min-w-0 text-start gap-0.5">
														<div class="flex items-center gap-1.5 flex-wrap">
															<span
																class="font-black text-[14px] text-white font-mono truncate"
																dir="ltr"
															>
																{auc.item_name}
															</span>
															<Show when={auc.auction_type}>
																<span
																	class={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
																		auc.auction_type === 'Primary Mint'
																			? 'bg-[#0098EA]/15 text-[#0098EA] border border-[#0098EA]/25'
																			: auc.auction_type === 'Fixed Price'
																				? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
																				: 'bg-purple-500/15 text-purple-300 border border-purple-500/25'
																	}`}
																>
																	{auc.auction_type === 'Primary Mint'
																		? copy().primaryMintBadge
																		: auc.auction_type === 'Fixed Price'
																			? copy().fixedPriceBadge
																			: copy().resaleBadge}
																</span>
															</Show>
														</div>

														<div class="flex items-center gap-2 text-[10px] font-mono text-white/45">
															<Show
																when={auc.time_left}
																fallback={<span>{localizedStatus(auc.status)}</span>}
															>
																<span class="text-amber-400 font-bold flex items-center gap-1">
																	<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
																	⏱ {localizedTimeLeft(auc.time_left)}
																</span>
															</Show>
														</div>
													</div>
												</div>

												<div class="flex flex-col items-end shrink-0" dir="ltr">
													<div class="flex items-baseline gap-1">
														<span class="text-[14px] font-black font-mono text-white">
															{pTon > 0 ? pTon.toLocaleString() : auc.price}
														</span>
														<span class="text-[9px] font-black text-[#0098EA]">TON</span>
													</div>
													<Show when={rate > 0 && pTon > 0}>
														<span class="text-[10px] font-mono text-white/40">
															≈ ${Math.round(pTon * rate).toLocaleString()}
														</span>
													</Show>
												</div>
											</div>
										);
									}}
								</For>
							</Show>
						</div>
					</div>
				</Show>

				{/* ═══════════════════════════════════════════════════════════════════
				    TAB 3: HALL OF FAME (ALL-TIME RECORDS) & REAL-TIME SOLD TAPE
				    ═══════════════════════════════════════════════════════════════════ */}
				<Show when={activeTab() === 'leaderboard' && !usernameQuery.isLoading}>
					<div class="flex flex-col gap-3.5 mt-3">
						{/* Mode Switcher: All-Time Hall of Fame vs Live Sold Tape */}
						<div class="grid grid-cols-2 gap-1.5 bg-[#0D111B]/95 p-1.5 rounded-[18px] border border-white/10">
							<button
								type="button"
								onClick={() => {
									setHallMode('all_time');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`py-2 rounded-[13px] text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
									hallMode() === 'all_time'
										? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md'
										: 'text-white/50 hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-[15px]">trophy</span>
								<span>{copy().allTimeRecordsTab}</span>
							</button>

							<button
								type="button"
								onClick={() => {
									setHallMode('recent_sold');
									try {
										haptic.selection();
									} catch {}
								}}
								class={`py-2 rounded-[13px] text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
									hallMode() === 'recent_sold'
										? 'bg-emerald-500 text-black shadow-md'
										: 'text-white/50 hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-[15px]">bolt</span>
								<span>{copy().recentSoldTapeTab}</span>
							</button>
						</div>

						{/* Category Filter Chips (4-Language Localized) */}
						<div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
							<For
								each={[
									{ id: 'all', label: copy().filterAll },
									{ id: 'short', label: copy().filterShort },
									{ id: 'crypto', label: copy().filterCrypto },
									{ id: 'brand', label: copy().filterBrand },
								]}
							>
								{(chip) => (
									<button
										type="button"
										onClick={() => {
											try {
												haptic.selection();
											} catch {}
											setLeaderboardFilter(chip.id as 'all' | 'short' | 'crypto' | 'brand');
										}}
										class={`px-3.5 py-1.5 rounded-[12px] text-[11px] font-black whitespace-nowrap transition-all uppercase tracking-wider border ${
											leaderboardFilter() === chip.id
												? 'bg-white text-black border-white shadow-sm'
												: 'bg-[#0D111B] text-white/60 border-white/10 hover:border-white/20'
										}`}
									>
										{chip.label}
									</button>
								)}
							</For>
						</div>

						{/* Records List */}
						<div class="bg-[#0D111B]/95 backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden shadow-xl">
							<Show
								when={filteredLeaderboard().length > 0}
								fallback={
									<div class="p-8 text-center text-white/40 text-xs">
										{t('collectionInfo.noLeaderboardData') || copy().noMatchingHandles}
									</div>
								}
							>
								<For each={filteredLeaderboard()}>
									{(item) => {
										const rankColor =
											item.rank === 1
												? 'text-amber-400 bg-amber-400/15 border-amber-400/30'
												: item.rank === 2
													? 'text-slate-300 bg-slate-300/15 border-slate-300/30'
													: item.rank === 3
														? 'text-amber-600 bg-amber-600/15 border-amber-600/30'
														: 'text-white/45 bg-white/5 border-white/10';

										return (
											<div
												onClick={() => openValuation(item.handle)}
												class="flex items-center justify-between p-4 hover:bg-white/[0.04] transition-all cursor-pointer border-b border-white/5 last:border-0 active:scale-[0.99]"
											>
												<div class="flex items-center gap-3.5 min-w-0">
													<div
														class={`w-8 h-8 rounded-[10px] flex items-center justify-center font-black font-mono text-[12px] border shrink-0 ${rankColor}`}
													>
														{item.rank === 1
															? '🥇'
															: item.rank === 2
																? '🥈'
																: item.rank === 3
																	? '🥉'
																	: `#${item.rank}`}
													</div>

													<div class="flex flex-col min-w-0 text-start gap-0.5">
														<div class="flex items-center gap-1.5 flex-wrap">
															<span
																class="text-white font-mono font-black text-[14px] truncate"
																dir="ltr"
															>
																@{item.handle}
															</span>
															<Show when={item.verified}>
																<span
																	class="material-symbols-outlined text-[#0098EA] text-[14px]"
																	title={copy().settledBadge}
																>
																	verified
																</span>
															</Show>
															<Show when={item.auctionType}>
																<span
																	class={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
																		item.auctionType === 'Primary Mint'
																			? 'bg-[#0098EA]/15 text-[#0098EA]'
																			: item.auctionType === 'Secondary Resale'
																				? 'bg-purple-500/15 text-purple-300'
																				: 'bg-emerald-500/15 text-emerald-400'
																	}`}
																>
																	{item.auctionType === 'Primary Mint'
																		? copy().primaryMintBadge
																		: item.auctionType === 'Secondary Resale'
																			? copy().resaleBadge
																			: copy().settledBadge}
																</span>
															</Show>
														</div>
														<span class="text-[10px] text-white/40 font-mono">{item.date}</span>
													</div>
												</div>

												<div class="flex flex-col items-end shrink-0" dir="ltr">
													<div class="flex items-baseline gap-1">
														<span class="text-white font-mono font-black text-[14px]">
															{item.priceTon.toLocaleString()}
														</span>
														<span class="text-[9px] font-black text-[#0098EA]">TON</span>
													</div>
													<Show when={item.priceUsd && item.priceUsd > 0}>
														<span class="text-[10px] text-white/40 font-mono">
															≈ ${Math.round(item.priceUsd!).toLocaleString()}
														</span>
													</Show>
												</div>
											</div>
										);
									}}
								</For>
							</Show>
						</div>
					</div>
				</Show>
			</div>
			<BottomNav />
		</div>
	);
};
