import { useNavigate, useSearchParams } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/index.js';
import { NumberActivityTape } from '@/pages/numbers/collection/ui/components/NumberActivityTape.js';
import { NumberClubFloorsTracker } from '@/pages/numbers/collection/ui/components/NumberClubFloorsTracker.js';
import { NumberCollectionKpis } from '@/pages/numbers/collection/ui/components/NumberCollectionKpis.js';
import { NumberHoldersView } from '@/pages/numbers/collection/ui/components/NumberHoldersView.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { FragSectionHeader, TonAmount, TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { NumbersChartView } from './components/NumbersChartView.js';
import { NumbersPortfolioView } from './components/NumbersPortfolioView.js';
import { NumbersTableView } from './components/NumbersTableView.js';

export const NumbersIntelPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const [activeTab, setActiveTab] = createSignal<'numbers' | 'chart' | 'analytics' | 'portfolio'>(
		'numbers',
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
		} else if (tab === 'chart') {
			setActiveTab('chart');
		}
	});

	const intelQuery = createQuery(() => ({
		queryKey: ['numbersIntel'],
		queryFn: () => numbersApi.getIntel(),
		staleTime: 60 * 1000,
	}));

	const chartQuery = createQuery(() => ({
		queryKey: ['numbersChartData'],
		queryFn: () => numbersApi.getChartData(),
		staleTime: 5 * 60 * 1000,
	}));

	const overviewQuery = createQuery(() => ({
		queryKey: ['numbersCollectionOverview'],
		queryFn: () => numbersApi.getCollectionOverview(),
		staleTime: 60 * 1000,
	}));

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
		if (!ton || ton <= 0) ton = 2717;
		const usd = intel()?.floor_price_usd || chartQuery.data?.floor?.usd || Math.round(ton * rate);
		return { ton, usd, rate };
	});

	const formatTon = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const formatUsdPlain = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
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
		<div class="frag-canvas pb-32 text-white min-h-screen relative font-frag-sans overflow-x-hidden">
			{/* Authentic Fragment.com Sticky Top Header (.tm-header) */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => navigate('/')}
					class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
				>
					<TonIcon size={20} color="#4db2ff" />
					<span class="text-[15px] font-bold tracking-[0.04em]" dir="ltr">
						FRAGMENT
					</span>
				</button>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onClick={() => navigate('/numbers/mask')}
						class="h-8 px-2.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-white text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
					>
						<span class="material-symbols-outlined text-[15px] text-[#4db2ff]">dialpad</span>
						<span>{t('numIntel.maskBtn')}</span>
					</button>
					<button
						type="button"
						onClick={() => navigate('/numbers/report')}
						class="h-8 px-2.5 rounded-[6px] frag-btn-primary text-[12px] font-semibold cursor-pointer"
					>
						Appraise
					</button>
				</div>
			</header>

			<div class="relative z-10 max-w-[540px] mx-auto px-4 pt-5 space-y-4">
				{/* Title & Live Floor Summary Row */}
				<div class="flex items-center justify-between gap-3">
					<div class="min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<h1 class="text-[20px] sm:text-[22px] font-bold tracking-[-0.015em] text-white">
								{t('numIntel.pageHeading')}
							</h1>
							<span class="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-[4px] bg-[#4db2ff]/10 text-[#4db2ff] tabular-nums">
								136,566
							</span>
						</div>
						<p class="text-[12.5px] text-[#8794a1] truncate mt-0.5">
							{t('numbers.headerSubtitle')}
						</p>
					</div>

					<div class="shrink-0 text-end">
						<span class="text-[11px] font-semibold text-[#8c9aa9] block mb-0.5">Floor Price</span>
						<TonAmount
							value={formatTon(liveFloor().ton)}
							size="sm"
							usd={formatUsdPlain(liveFloor().usd)}
							class="items-end"
						/>
					</div>
				</div>

				{/* 4-Tab Fragment Horizontal Bar */}
				<div class="flex items-center border-b border-[#293440] gap-5 px-1">
					<For
						each={
							[
								{ id: 'numbers', label: t('numbers.tabNumbers') || 'Numbers' },
								{ id: 'chart', label: t('numbers.tabChart') || 'Chart' },
								{ id: 'analytics', label: t('numIntel.tabAnalytics') || 'Analytics' },
								{ id: 'portfolio', label: t('numbers.tabPortfolio') || 'Portfolio' },
							] as const
						}
					>
						{(tab) => {
							const active = () => activeTab() === tab.id;
							return (
								<button
									type="button"
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setActiveTab(tab.id);
									}}
									class={`relative pb-2.5 text-[13.5px] font-semibold transition-colors cursor-pointer ${
										active() ? 'text-white' : 'text-[#8c9aa9] hover:text-white'
									}`}
								>
									<span>{tab.label}</span>
									<Show when={active()}>
										<span class="absolute inset-x-0 bottom-0 h-[3px] bg-[#248bda] rounded-t-[3px]" />
									</Show>
								</button>
							);
						}}
					</For>
				</div>

				{/* Active Tab View */}
				<Show when={activeTab() === 'numbers'}>
					<NumbersTableView
						initialFilter={listFilterState()}
						intel={intel()}
						onSelectNumber={handleSelectNumber}
						onViewOwnerPortfolio={handleViewOwnerPortfolio}
					/>
				</Show>

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
						<div class="frag-card p-3.5 space-y-3">
							<FragSectionHeader
								title={t('numIntel.liveTapeHeading')}
								right={
									<button
										type="button"
										onClick={() => navigate('/numbers/collection')}
										class="text-[12px] font-semibold text-[#4db2ff] hover:underline flex items-center gap-0.5 cursor-pointer"
									>
										<span>{t('numIntel.fullCollectionBtn')}</span>
										<span class="material-symbols-outlined text-[14px]">north_east</span>
									</button>
								}
							/>
							<NumberActivityTape rate={liveFloor().rate} />
						</div>
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
