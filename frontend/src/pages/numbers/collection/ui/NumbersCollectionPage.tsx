import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { FragSectionHeader } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { NumberActivityTape } from './components/NumberActivityTape.js';
import { NumberAlertsModal } from './components/NumberAlertsModal.js';
import { NumberClubFloorsTracker } from './components/NumberClubFloorsTracker.js';
import { NumberCollectionChart } from './components/NumberCollectionChart.js';
import { NumberCollectionHeader } from './components/NumberCollectionHeader.js';
import { NumberCollectionKpis } from './components/NumberCollectionKpis.js';
import { NumberCulturalRadarHeatmap } from './components/NumberCulturalRadarHeatmap.js';
import { NumberDeFiFinancials } from './components/NumberDeFiFinancials.js';
import { NumberDialpadErgonomics } from './components/NumberDialpadErgonomics.js';
import { NumberExportModal } from './components/NumberExportModal.js';
import { NumberHoldersView } from './components/NumberHoldersView.js';
import { NumberMarketView } from './components/NumberMarketView.js';
import { NumberPatternsView } from './components/NumberPatternsView.js';
import { NumberRiskMethodology } from './components/NumberRiskMethodology.js';

export type CollectionTabKey = 'overview' | 'market' | 'patterns' | 'holders' | 'activity' | 'risk';

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
		<div class="frag-canvas pb-36 text-white min-h-screen relative selection:bg-[#2990ff]/30 overflow-x-hidden">
			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				<NumberCollectionHeader
					overview={overview()}
					onOpenExport={() => setIsExportOpen(true)}
					onOpenAlerts={() => setIsAlertsOpen(true)}
					onOpenMethodology={() => setIsMethodologyOpen(true)}
					onBack={() => navigate(-1)}
					onNavigateMask={() => navigate('/numbers/mask')}
				/>

				<NumberCollectionKpis overview={overview()} />

				<NumberCollectionChart
					points={history()}
					rate={rate()}
					timeframe={timeframe()}
					onTimeframeChange={setTimeframe}
					isLoading={historyQuery.isLoading}
				/>

				{/* 6-Tab Navigation Segment (3x2 mobile / 6x1 sm) */}
				<div class="grid grid-cols-3 sm:grid-cols-6 frag-inset p-1 rounded-[12px] mb-4 gap-1">
					<button
						type="button"
						onClick={() => switchTab('overview')}
						class={`py-2 px-1 rounded-[9px] text-[11px] font-semibold transition-all ${
							selectedTab() === 'overview'
								? 'bg-[#2990ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
								: 'text-[#8c9ba5] hover:text-white'
						}`}
					>
						{t('numCollectionPage.tabOverview')}
					</button>

					<button
						type="button"
						onClick={() => switchTab('market')}
						class={`py-2 px-1 rounded-[9px] text-[11px] font-semibold transition-all ${
							selectedTab() === 'market'
								? 'bg-[#2990ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
								: 'text-[#8c9ba5] hover:text-white'
						}`}
					>
						{t('numCollectionPage.tabMarket')}
					</button>

					<button
						type="button"
						onClick={() => switchTab('patterns')}
						class={`py-2 px-1 rounded-[9px] text-[11px] font-semibold transition-all ${
							selectedTab() === 'patterns'
								? 'bg-[#2990ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
								: 'text-[#8c9ba5] hover:text-white'
						}`}
					>
						{t('numCollectionPage.tabPatterns')}
					</button>

					<button
						type="button"
						onClick={() => switchTab('holders')}
						class={`py-2 px-1 rounded-[9px] text-[11px] font-semibold transition-all ${
							selectedTab() === 'holders'
								? 'bg-[#2990ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
								: 'text-[#8c9ba5] hover:text-white'
						}`}
					>
						{t('numCollectionPage.tabHolders')}
					</button>

					<button
						type="button"
						onClick={() => switchTab('activity')}
						class={`py-2 px-1 rounded-[9px] text-[11px] font-semibold transition-all ${
							selectedTab() === 'activity'
								? 'bg-[#2990ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
								: 'text-[#8c9ba5] hover:text-white'
						}`}
					>
						{t('numCollectionPage.tabActivity')}
					</button>

					<button
						type="button"
						onClick={() => switchTab('risk')}
						class={`py-2 px-1 rounded-[9px] text-[11px] font-semibold transition-all ${
							selectedTab() === 'risk'
								? 'bg-[#2990ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
								: 'text-[#8c9ba5] hover:text-white'
						}`}
					>
						{t('numCollectionPage.tabRisk')}
					</button>
				</div>

				{/* Tab 1: Overview */}
				<Show when={selectedTab() === 'overview'}>
					<div class="space-y-4">
						<NumberCulturalRadarHeatmap />

						<NumberClubFloorsTracker
							patterns={patterns()}
							overview={overview()}
							rate={rate()}
							onSelectNumber={(num) => navigate(`/numbers/report?n=${encodeURIComponent(num)}`)}
						/>

						<NumberDialpadErgonomics initialNumber={overview()?.floor_number || '+888 8888 8888'} />

						<NumberDeFiFinancials
							medianFloorTon={overview()?.floor_ask_ton || 75}
							tonUsdRate={rate()}
						/>

						<div class="frag-card rounded-[14px] p-4 space-y-2.5">
							<FragSectionHeader title={t('numCollectionPage.aboutTitle')} icon="info" />
							<p class="text-[12.5px] text-[#c7d0d9] leading-relaxed">
								{t('numCollectionPage.aboutBody')}
							</p>
						</div>

						<div class="grid grid-cols-2 gap-2.5">
							<button
								type="button"
								onClick={() => {
									try {
										haptic.impact('light');
									} catch {}
									navigate('/numbers/intel');
								}}
								class="p-3.5 rounded-[14px] frag-card-interactive text-start group"
							>
								<span class="material-symbols-outlined text-[#2990ff] text-[22px] mb-1.5 block">
									monitoring
								</span>
								<span class="text-[13px] font-semibold text-white block group-hover:text-[#2990ff] transition-colors">
									{t('numCollectionPage.intelTableTitle')}
								</span>
								<span class="text-[11px] text-[#8c9ba5] block mt-0.5 leading-snug">
									{t('numCollectionPage.intelTableSub')}
								</span>
							</button>

							<button
								type="button"
								onClick={() => {
									try {
										haptic.impact('light');
									} catch {}
									navigate('/numbers/mask');
								}}
								class="p-3.5 rounded-[14px] frag-card-interactive text-start group"
							>
								<span class="material-symbols-outlined text-[#2990ff] text-[22px] mb-1.5 block">
									tune
								</span>
								<span class="text-[13px] font-semibold text-white block group-hover:text-[#2990ff] transition-colors">
									{t('numCollectionPage.maskBuilderTitle')}
								</span>
								<span class="text-[11px] text-[#8c9ba5] block mt-0.5 leading-snug">
									{t('numCollectionPage.maskBuilderSub')}
								</span>
							</button>
						</div>
					</div>
				</Show>

				<Show when={selectedTab() === 'market'}>
					<NumberMarketView
						listings={listings()}
						total={listingsTotal()}
						page={marketPage()}
						onPageChange={setMarketPage}
						venue={marketVenue()}
						onVenueChange={setMarketVenue}
						listingType={marketType()}
						onListingTypeChange={setMarketType}
						floorTon={overview()?.floor_ask_ton}
						rate={rate()}
						isLoading={listingsQuery.isLoading}
					/>
				</Show>

				<Show when={selectedTab() === 'patterns'}>
					<NumberPatternsView patterns={patterns()} rate={rate()} />
				</Show>

				<Show when={selectedTab() === 'holders'}>
					<NumberHoldersView overview={overview()} />
				</Show>

				<Show when={selectedTab() === 'activity'}>
					<NumberActivityTape rate={rate()} />
				</Show>

				<Show when={selectedTab() === 'risk'}>
					<NumberRiskMethodology overview={overview()} />
				</Show>
			</div>

			{/* Methodology Drawer Modal */}
			<Show when={isMethodologyOpen()}>
				<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in p-0 sm:p-4">
					<div class="frag-sheet rounded-t-[24px] sm:rounded-[20px] p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto">
						<NumberRiskMethodology
							overview={overview()}
							isDrawer={true}
							onCloseDrawer={() => setIsMethodologyOpen(false)}
						/>
					</div>
				</div>
			</Show>

			<NumberAlertsModal
				isOpen={isAlertsOpen()}
				onClose={() => setIsAlertsOpen(false)}
				currentFloor={overview()?.floor_ask_ton}
			/>

			<NumberExportModal
				isOpen={isExportOpen()}
				onClose={() => setIsExportOpen(false)}
				overview={overview()}
			/>
		</div>
	);
};
export default NumbersCollectionPage;
