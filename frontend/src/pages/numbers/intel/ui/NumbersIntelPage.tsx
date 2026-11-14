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
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { FragSectionHeader, TonAmount } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { NumbersChartView } from './components/NumbersChartView.js';
import { NumbersPortfolioView } from './components/NumbersPortfolioView.js';
import { NumbersTableView } from './components/NumbersTableView.js';

export const NumbersIntelPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

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
		<div class="frag-canvas pb-32 text-white min-h-screen relative selection:bg-[#2990ff]/30 overflow-x-hidden">
			<div class="relative z-10 max-w-[540px] mx-auto px-4 pt-3.5 space-y-3.5">
				{/* Top Fragment Header */}
				<div class="frag-card-elevated rounded-[14px] p-3 flex items-center justify-between gap-2.5">
					<div class="flex items-center gap-2.5 min-w-0">
						<div class="w-9 h-9 rounded-[10px] bg-[#2990ff]/12 border border-[#2990ff]/30 flex items-center justify-center text-[#2990ff] shrink-0">
							<span class="material-symbols-outlined text-[19px]">tag</span>
						</div>
						<div class="min-w-0">
							<div class="flex items-center gap-1.5 flex-wrap">
								<h1 class="text-[15px] font-semibold tracking-[-0.015em] text-white">
									{t('numIntel.pageHeading')}
								</h1>
								<span class="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-[5px] bg-[#2990ff]/12 text-[#2990ff] border border-[#2990ff]/25 tabular-nums">
									136,566
								</span>
							</div>
							<p class="text-[11px] font-medium text-[#8c9ba5] truncate">
								{t('numbers.headerSubtitle')}
							</p>
						</div>
					</div>

					{/* Right Actions: Mask Builder + Live Floor */}
					<div class="flex items-center gap-2.5 shrink-0">
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								navigate('/numbers/mask');
							}}
							class="px-2.5 py-1.5 rounded-[9px] frag-btn-secondary text-[11px] font-semibold text-[#d7e0e8] flex items-center gap-1"
							title={t('numIntel.maskBtn')}
						>
							<span class="material-symbols-outlined text-[15px] text-[#2990ff]">dialpad</span>
							<span class="hidden sm:inline">{t('numIntel.maskBtn')}</span>
						</button>

						<div class="flex flex-col items-end">
							<TonAmount
								value={formatTon(liveFloor().ton)}
								size="sm"
								unit
								usd={formatUsdPlain(liveFloor().usd)}
								class="items-end"
							/>
						</div>
					</div>
				</div>

				{/* 4-Way Fragment Segmented Bar */}
				<div class="grid grid-cols-4 frag-inset p-1 rounded-[12px] gap-1">
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('chart');
						}}
						class={`py-2 px-1.5 text-[11.5px] font-semibold rounded-[9px] transition-all flex items-center justify-center gap-1 min-w-0 ${
							activeTab() === 'chart'
								? 'bg-[#2990ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
								: 'text-[#8c9ba5] hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-[15px]">show_chart</span>
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
						class={`py-2 px-1.5 text-[11.5px] font-semibold rounded-[9px] transition-all flex items-center justify-center gap-1 min-w-0 ${
							activeTab() === 'numbers'
								? 'bg-[#2990ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
								: 'text-[#8c9ba5] hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-[15px]">format_list_numbered</span>
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
						class={`py-2 px-1.5 text-[11.5px] font-semibold rounded-[9px] transition-all flex items-center justify-center gap-1 min-w-0 ${
							activeTab() === 'analytics'
								? 'bg-[#2990ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
								: 'text-[#8c9ba5] hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-[15px]">analytics</span>
						<span class="truncate">{t('numIntel.tabAnalytics')}</span>
					</button>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('portfolio');
						}}
						class={`py-2 px-1.5 text-[11.5px] font-semibold rounded-[9px] transition-all flex items-center justify-center gap-1 min-w-0 ${
							activeTab() === 'portfolio'
								? 'bg-[#2990ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
								: 'text-[#8c9ba5] hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-[15px]">account_balance_wallet</span>
						<span class="truncate">{t('numbers.tabPortfolio') || 'Portfolio'}</span>
					</button>
				</div>

				{/* Active View */}
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
					<div class="space-y-3.5">
						<NumberCollectionKpis overview={overview()} />
						<NumberClubFloorsTracker
							patterns={patternsQuery.data}
							overview={overview()}
							rate={liveFloor().rate}
							onSelectNumber={handleSelectNumber}
						/>
						<NumberHoldersView overview={overview()} />
						<div class="frag-card rounded-[14px] p-4 space-y-3">
							<FragSectionHeader
								title={t('numIntel.liveTapeHeading')}
								icon="sensors"
								right={
									<button
										type="button"
										onClick={() => navigate('/numbers/collection')}
										class="text-[11px] font-semibold text-[#2990ff] hover:text-[#4aa3ff] flex items-center gap-1"
									>
										<span>{t('numIntel.fullCollectionBtn')}</span>
										<span class="material-symbols-outlined text-[14px]">north_east</span>
									</button>
								}
							/>
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
