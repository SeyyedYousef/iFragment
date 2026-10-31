import { useNavigate, useSearchParams } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createEffect, createMemo, createSignal, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/index.js';
import { NumberActivityTape } from '@/pages/numbers/collection/ui/components/NumberActivityTape.js';
import { NumberClubFloorsTracker } from '@/pages/numbers/collection/ui/components/NumberClubFloorsTracker.js';
import { NumberCollectionKpis } from '@/pages/numbers/collection/ui/components/NumberCollectionKpis.js';
import { NumberCulturalRadarHeatmap } from '@/pages/numbers/collection/ui/components/NumberCulturalRadarHeatmap.js';
import { NumberDeFiFinancials } from '@/pages/numbers/collection/ui/components/NumberDeFiFinancials.js';
import { NumberDialpadErgonomics } from '@/pages/numbers/collection/ui/components/NumberDialpadErgonomics.js';
import { NumberHoldersView } from '@/pages/numbers/collection/ui/components/NumberHoldersView.js';
import { t, useI18n } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { NumbersChartView } from './components/NumbersChartView.js';
import { NumbersPortfolioView } from './components/NumbersPortfolioView.js';
import { NumbersTableView } from './components/NumbersTableView.js';

const INTEL_PAGE_I18N: Record<
	string,
	{
		tabAnalytics: string;
		maskBtn: string;
		fullCollectionBtn: string;
		liveTapeHeading: string;
	}
> = {
	fa: {
		tabAnalytics: 'الگوها و نهنگ‌ها',
		maskBtn: 'طراح ماسک +888',
		fullCollectionBtn: 'داشبورد کامل کالکشن',
		liveTapeHeading: 'نوار زنده معاملات آن‌چین (+888)',
	},
	en: {
		tabAnalytics: 'Clubs & Whales',
		maskBtn: 'Mask Builder',
		fullCollectionBtn: 'Full Collection Hub',
		liveTapeHeading: 'Live On-Chain Settlement Tape (+888)',
	},
	ru: {
		tabAnalytics: 'Клубы и Киты',
		maskBtn: 'Поиск по маске',
		fullCollectionBtn: 'Полный хаб коллекции',
		liveTapeHeading: 'Ончейн-лента сделок (+888)',
	},
	zh: {
		tabAnalytics: '靓号与巨鲸',
		maskBtn: '掩码检索器',
		fullCollectionBtn: '完整合集工作台',
		liveTapeHeading: '链上实时成交磁带 (+888)',
	},
};

export const NumbersIntelPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const { locale } = useI18n();
	const pageCopy = () => INTEL_PAGE_I18N[locale()] || INTEL_PAGE_I18N.fa;

	const [activeTab, setActiveTab] = createSignal<'chart' | 'numbers' | 'analytics' | 'portfolio'>(
		'chart',
	);
	const [listFilterState, setListFilterState] = createSignal<{
		saleType?: '' | 'auction' | 'for_sale' | 'not_for_sale';
		numberType?: '' | 'banned' | 'not_banned';
		nftColors?: string[];
		mask?: string;
	}>({});
	const [portfolioTargetAddress, setPortfolioTargetAddress] = createSignal<string>('');

	createEffect(() => {
		const addr = searchParams.address;
		const tab = searchParams.tab;
		if (addr) {
			setPortfolioTargetAddress(decodeURIComponent(addr));
			setActiveTab('portfolio');
		} else if (tab === 'portfolio') {
			setActiveTab('portfolio');
		} else if (tab === 'numbers') {
			setActiveTab('numbers');
		} else if (tab === 'analytics') {
			setActiveTab('analytics');
		}
	});

	// Intel / Market overview query
	const intelQuery = createQuery(() => ({
		queryKey: ['numbersIntel'],
		queryFn: () => numbersApi.getIntel(),
		staleTime: 60 * 1000,
	}));

	// Historical Chart data query
	const chartQuery = createQuery(() => ({
		queryKey: ['numbersChartData'],
		queryFn: () => numbersApi.getChartData(),
		staleTime: 5 * 60 * 1000,
	}));

	// Institutional Collection Overview query (for Analytics & Whales tab)
	const overviewQuery = createQuery(() => ({
		queryKey: ['numbersCollectionOverview'],
		queryFn: () => numbersApi.getCollectionOverview(),
		staleTime: 60 * 1000,
	}));

	// Pattern Analytics query (for Club Floors Tracker)
	const patternsQuery = createQuery(() => ({
		queryKey: ['numbersPatternAnalytics'],
		queryFn: () => numbersApi.getPatternAnalytics(),
		staleTime: 300 * 1000,
	}));

	const intel = () => intelQuery.data;
	const chartData = () => chartQuery.data?.data;
	const overview = () => overviewQuery.data;

	const liveFloor = createMemo(() => {
		const chartFloor = chartQuery.data?.floor?.ton;
		const rate =
			intel()?.ton_rate_usd ||
			chartQuery.data?.rate ||
			(intel()?.floor_price_usd && intel()?.floor_price_ton && intel()!.floor_price_ton > 0
				? intel()!.floor_price_usd / intel()!.floor_price_ton
				: 1.23);

		let ton = intel()?.floor_price_ton || chartFloor;
		if (!ton || ton <= 0) {
			const data = chartQuery.data?.data;
			if (data && Object.keys(data).length > 0) {
				const dates = Object.keys(data).sort();
				const latest = data[dates[dates.length - 1]];
				if (latest && latest[0] > 0) {
					ton = latest[0];
				}
			}
		}
		if (!ton || ton <= 0) {
			ton = 2717;
		}
		const usd = intel()?.floor_price_usd || chartQuery.data?.floor?.usd || Math.round(ton * rate);
		return { ton, usd, rate };
	});

	const formatTon = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	const handleChartQuickFilter = (type: 'auction' | 'for_sale' | 'banned') => {
		try {
			haptic.selection();
		} catch {}
		if (type === 'banned') {
			setListFilterState({ numberType: 'banned', saleType: '', nftColors: [] });
		} else {
			setListFilterState({ saleType: type, numberType: '', nftColors: [] });
		}
		setActiveTab('numbers');
	};

	const handleFilterByColor = (hex: string) => {
		try {
			haptic.selection();
		} catch {}
		setListFilterState({
			saleType: '',
			numberType: '',
			nftColors: [hex.replace('#', '')],
		});
		setActiveTab('numbers');
	};

	const handleViewOwnerPortfolio = (address: string) => {
		try {
			haptic.selection();
		} catch {}
		setPortfolioTargetAddress(address);
		setActiveTab('portfolio');
	};

	const handleSelectNumber = (number: string) => {
		try {
			haptic.selection();
		} catch {}
		navigate(`/numbers/report?n=${encodeURIComponent(number)}`);
	};

	return (
		<div class="pb-32 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient background glows matching iFragment palette */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/15 via-transparent to-transparent blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[540px] mx-auto px-4 pt-3 space-y-4">
				{/* Top Header Bar */}
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2.5">
						<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0098EA] to-[#0060aa] p-[1px] shadow-lg shadow-[#0098EA]/20 flex items-center justify-center">
							<div class="w-full h-full bg-[#0a0e17] rounded-xl flex items-center justify-center text-[#0098EA]">
								<span class="material-symbols-outlined text-lg">tag</span>
							</div>
						</div>
						<div>
							<h1 class="text-base font-black tracking-tight text-white flex items-center gap-1.5">
								<span>+888 Numbers</span>
								<span class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									136,566 NFT
								</span>
							</h1>
							<p class="text-[10px] font-semibold text-white/40">
								{t('numbers.headerSubtitle') || 'Telegram Anonymous Marketplace'}
							</p>
						</div>
					</div>

					{/* Right Actions: Mask Builder + Live Floor Badge */}
					<div class="flex items-center gap-2">
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								navigate('/numbers/mask');
							}}
							class="px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[10px] font-bold text-cyan-300 flex items-center gap-1 transition-all"
							title={pageCopy().maskBtn}
						>
							<span class="material-symbols-outlined text-xs">dialpad</span>
							<span class="hidden sm:inline">{pageCopy().maskBtn}</span>
						</button>

						<div class="text-right">
							<div class="text-xs font-black text-white font-mono flex items-center justify-end gap-1.5">
								<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
								<span>{formatTon(liveFloor().ton)} TON</span>
							</div>
							<div class="text-[10px] text-white/40 font-mono">≈ {formatUsd(liveFloor().usd)}</div>
						</div>
					</div>
				</div>

				{/* 4 Main Segmented Tabs: Chart | Numbers | Analytics & Whales | Portfolio */}
				<div class="grid grid-cols-4 bg-[#0d121c] p-1 rounded-2xl border border-white/[0.08] shadow-lg gap-0.5">
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('chart');
						}}
						class={`py-2 px-1.5 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1 ${
							activeTab() === 'chart'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25 scale-[1.01]'
								: 'text-white/50 hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-sm">show_chart</span>
						<span class="truncate">{t('numbers.tabChart') || 'Chart'}</span>
					</button>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('numbers');
						}}
						class={`py-2 px-1.5 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1 ${
							activeTab() === 'numbers'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25 scale-[1.01]'
								: 'text-white/50 hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-sm">format_list_numbered</span>
						<span class="truncate">{t('numbers.tabNumbers') || 'Numbers'}</span>
					</button>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('analytics');
						}}
						class={`py-2 px-1.5 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1 ${
							activeTab() === 'analytics'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25 scale-[1.01]'
								: 'text-white/50 hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-sm">analytics</span>
						<span class="truncate">{pageCopy().tabAnalytics}</span>
					</button>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('portfolio');
						}}
						class={`py-2 px-1.5 text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1 ${
							activeTab() === 'portfolio'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25 scale-[1.01]'
								: 'text-white/50 hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-sm">account_balance_wallet</span>
						<span class="truncate">{t('numbers.tabPortfolio') || 'Portfolio'}</span>
					</button>
				</div>

				{/* Active View Rendering */}
				<Show when={activeTab() === 'chart'}>
					<NumbersChartView
						intel={intel()}
						chartData={chartData()}
						floor={chartQuery.data?.floor}
						floorN={chartQuery.data?.floor_n}
						rate={liveFloor().rate}
						isLoading={chartQuery.isPending}
						onFilterType={handleChartQuickFilter}
						onFilterColor={handleFilterByColor}
						onSelectNumber={handleSelectNumber}
						onSelectTab={(tab) => setActiveTab(tab)}
					/>
				</Show>

				<Show when={activeTab() === 'numbers'}>
					<NumbersTableView
						initialFilter={listFilterState()}
						intel={intel()}
						onSelectNumber={handleSelectNumber}
						onViewOwnerPortfolio={handleViewOwnerPortfolio}
					/>
				</Show>

				<Show when={activeTab() === 'analytics'}>
					<div class="space-y-4">
						<NumberCollectionKpis overview={overview()} />
						<NumberClubFloorsTracker
							patterns={patternsQuery.data}
							overview={overview()}
							rate={liveFloor().rate}
							onSelectNumber={handleSelectNumber}
						/>
						<NumberHoldersView overview={overview()} />
						<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-xl">
							<div class="flex items-center justify-between mb-3">
								<h3 class="text-xs font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-emerald-400 text-base">sensors</span>
									<span>{pageCopy().liveTapeHeading}</span>
								</h3>
								<button
									type="button"
									onClick={() => navigate('/numbers/collection')}
									class="text-[10px] font-bold text-[#0098EA] hover:underline flex items-center gap-1"
								>
									<span>{pageCopy().fullCollectionBtn}</span>
									<span class="material-symbols-outlined text-xs">open_in_new</span>
								</button>
							</div>
							<NumberActivityTape rate={liveFloor().rate} />
						</div>
						<NumberCulturalRadarHeatmap />
						<NumberDialpadErgonomics initialNumber={overview()?.floor_number || '+888 8888 8888'} />
						<NumberDeFiFinancials
							medianFloorTon={liveFloor().ton || 2717}
							tonUsdRate={liveFloor().rate}
						/>
					</div>
				</Show>

				<Show when={activeTab() === 'portfolio'}>
					<NumbersPortfolioView
						initialAddress={portfolioTargetAddress()}
						floorPriceTon={liveFloor().ton}
						rate={liveFloor().rate}
						onValuateNumber={handleSelectNumber}
					/>
				</Show>
			</div>
		</div>
	);
};
