import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { FragSectionHeader, TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { NumberActivityTape } from './components/NumberActivityTape.js';
import { NumberAlertsModal } from './components/NumberAlertsModal.js';
import { NumberClubFloorsTracker } from './components/NumberClubFloorsTracker.js';
import { NumberCollectionChart } from './components/NumberCollectionChart.js';
import { NumberCollectionKpis } from './components/NumberCollectionKpis.js';
import { NumberExportModal } from './components/NumberExportModal.js';
import { NumberHoldersView } from './components/NumberHoldersView.js';
import { NumberMarketView } from './components/NumberMarketView.js';
import { NumberPatternsView } from './components/NumberPatternsView.js';
import { NumberRiskMethodology } from './components/NumberRiskMethodology.js';

export type CollectionTabKey = 'overview' | 'market' | 'patterns' | 'holders' | 'activity';

export const NumbersCollectionPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [selectedTab, setSelectedTab] = createSignal<CollectionTabKey>('overview');
	const [timeframe, setTimeframe] = createSignal<'24h' | '7d' | '30d' | '90d' | 'all'>('30d');
	const [marketVenue, setMarketVenue] = createSignal<string>('all');
	const [marketType, setMarketType] = createSignal<string>('all');
	const [marketPage, setMarketPage] = createSignal<number>(1);

	const [isExportOpen, setIsExportOpen] = createSignal(false);
	const [isAlertsOpen, setIsAlertsOpen] = createSignal(false);
	const [isMethodologyOpen, setIsMethodologyOpen] = createSignal(false);

	const overviewQuery = createQuery(() => ({
		queryKey: ['numbersCollectionOverview'],
		queryFn: () => numbersApi.getCollectionOverview(),
		staleTime: 60 * 1000,
	}));

	const historyQuery = createQuery(() => ({
		queryKey: ['numbersCollectionHistory', timeframe()],
		queryFn: () => numbersApi.getCollectionHistory(timeframe()),
		staleTime: 120 * 1000,
	}));

	const listingsQuery = createQuery(() => ({
		queryKey: ['numbersCollectionListings', marketVenue(), marketType(), marketPage()],
		queryFn: () =>
			numbersApi.getCollectionListings({
				venue: marketVenue(),
				listing_type: marketType(),
				page: marketPage(),
				limit: 20,
			}),
		staleTime: 30 * 1000,
	}));

	const patternsQuery = createQuery(() => ({
		queryKey: ['numbersPatternAnalytics'],
		queryFn: () => numbersApi.getPatternAnalytics(),
		staleTime: 300 * 1000,
	}));

	const overview = () => overviewQuery.data;
	const history = () => historyQuery.data?.points || [];
	const rate = () => overviewQuery.data?.ton_usd_rate || 1.23;
	const listings = () => listingsQuery.data?.items || [];
	const listingsTotal = () => listingsQuery.data?.total || 0;
	const patterns = () => patternsQuery.data || [];

	const switchTab = (tab: CollectionTabKey) => {
		try {
			haptic.selection();
		} catch {}
		setSelectedTab(tab);
	};

	return (
		<div class="frag-canvas pb-32 text-white min-h-screen relative font-frag-sans overflow-x-hidden">
			{/* Authentic Fragment.com Sticky Top Header (.tm-header) */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => navigate('/numbers/intel')}
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
						class="h-8 px-2.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-[12px] font-semibold text-white cursor-pointer"
					>
						{t('numIntel.maskBtn')}
					</button>
					<button
						type="button"
						onClick={() => setIsExportOpen(true)}
						class="h-8 px-2.5 rounded-[6px] bg-[#293440] hover:bg-[#384553] text-[12px] font-semibold text-white cursor-pointer"
					>
						Export
					</button>
				</div>
			</header>

			<div class="relative z-10 max-w-[520px] mx-auto px-4 pt-5 space-y-4">
				<div>
					<h1 class="text-[20px] sm:text-[22px] font-bold text-white tracking-[-0.015em]">
						Anonymous Numbers (+888)
					</h1>
					<p class="text-[12.5px] text-[#8794a1] mt-0.5">{t('numCollectionPage.aboutBody')}</p>
				</div>

				<NumberCollectionKpis overview={overview()} />

				{/* 5-Tab Fragment Horizontal Bar */}
				<div class="flex items-center border-b border-[#293440] gap-4 overflow-x-auto no-scrollbar px-1">
					<For
						each={
							[
								{ id: 'overview', label: t('numCollectionPage.tabOverview') },
								{ id: 'market', label: t('numCollectionPage.tabMarket') },
								{ id: 'patterns', label: t('numCollectionPage.tabPatterns') },
								{ id: 'holders', label: t('numCollectionPage.tabHolders') },
								{ id: 'activity', label: t('numCollectionPage.tabActivity') },
							] as const
						}
					>
						{(tab) => {
							const active = () => selectedTab() === tab.id;
							return (
								<button
									type="button"
									onClick={() => switchTab(tab.id)}
									class={`relative pb-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
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

				{/* Tab 1: Overview */}
				<Show when={selectedTab() === 'overview'}>
					<div class="space-y-4">
						<NumberCollectionChart
							points={history()}
							rate={rate()}
							timeframe={timeframe()}
							onTimeframeChange={setTimeframe}
							isLoading={historyQuery.isLoading}
						/>

						<NumberClubFloorsTracker
							patterns={patterns()}
							overview={overview()}
							rate={rate()}
							onSelectNumber={(num) => navigate(`/numbers/report?n=${encodeURIComponent(num)}`)}
						/>
					</div>
				</Show>

				{/* Tab 2: Market */}
				<Show when={selectedTab() === 'market'}>
					<NumberMarketView
						listings={listings()}
						total={listingsTotal()}
						page={marketPage()}
						venue={marketVenue()}
						listingType={marketType()}
						rate={rate()}
						floorTon={overview()?.floor_ask_ton}
						isLoading={listingsQuery.isLoading}
						onVenueChange={(v: string) => {
							setMarketVenue(v);
							setMarketPage(1);
						}}
						onListingTypeChange={(tp: string) => {
							setMarketType(tp);
							setMarketPage(1);
						}}
						onPageChange={setMarketPage}
					/>
				</Show>

				{/* Tab 3: Patterns */}
				<Show when={selectedTab() === 'patterns'}>
					<NumberPatternsView patterns={patterns()} rate={rate()} />
				</Show>

				{/* Tab 4: Holders */}
				<Show when={selectedTab() === 'holders'}>
					<NumberHoldersView overview={overview()} />
				</Show>

				{/* Tab 5: Activity */}
				<Show when={selectedTab() === 'activity'}>
					<div class="frag-card p-3.5">
						<FragSectionHeader title={t('numIntel.liveTapeHeading')} />
						<NumberActivityTape rate={rate()} />
					</div>
				</Show>
			</div>

			<NumberExportModal
				isOpen={isExportOpen()}
				onClose={() => setIsExportOpen(false)}
				overview={overview()}
			/>
			<NumberAlertsModal
				isOpen={isAlertsOpen()}
				onClose={() => setIsAlertsOpen(false)}
				currentFloor={overview()?.floor_ask_ton || 2717}
			/>
			<Show when={isMethodologyOpen()}>
				<div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
					<div class="bg-[#212a33] w-full max-w-md rounded-[12px] p-4 max-h-[80vh] overflow-y-auto">
						<div class="flex justify-between items-center mb-3">
							<h3 class="text-[15px] font-semibold text-white">Methodology</h3>
							<button
								type="button"
								onClick={() => setIsMethodologyOpen(false)}
								class="text-[#8c9aa9] hover:text-white"
							>
								<span class="material-symbols-outlined text-[18px]">close</span>
							</button>
						</div>
						<NumberRiskMethodology />
					</div>
				</div>
			</Show>
		</div>
	);
};
