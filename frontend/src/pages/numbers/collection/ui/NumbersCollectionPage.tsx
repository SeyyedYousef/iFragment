import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { NumberActivityTape } from './components/NumberActivityTape.js';
import { NumberAlertsModal } from './components/NumberAlertsModal.js';
import { NumberCollectionChart } from './components/NumberCollectionChart.js';
import { NumberCollectionHeader } from './components/NumberCollectionHeader.js';
import { NumberCollectionKpis } from './components/NumberCollectionKpis.js';
import { NumberExportModal } from './components/NumberExportModal.js';
import { NumberHoldersView } from './components/NumberHoldersView.js';
import { NumberMarketView } from './components/NumberMarketView.js';
import { NumberPatternsView } from './components/NumberPatternsView.js';
import { NumberRiskMethodology } from './components/NumberRiskMethodology.js';
import { NumberClubFloorsTracker } from './components/NumberClubFloorsTracker.js';
import { NumberCulturalRadarHeatmap } from './components/NumberCulturalRadarHeatmap.js';
import { NumberDeFiFinancials } from './components/NumberDeFiFinancials.js';
import { NumberDialpadErgonomics } from './components/NumberDialpadErgonomics.js';

export type CollectionTabKey = 'overview' | 'market' | 'patterns' | 'holders' | 'activity' | 'risk';

export const NumbersCollectionPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [selectedTab, setSelectedTab] = createSignal<CollectionTabKey>('overview');
	const [timeframe, setTimeframe] = createSignal<'24h' | '7d' | '30d' | '90d' | 'all'>('30d');
	const [marketVenue, setMarketVenue] = createSignal<string>('all');
	const [marketType, setMarketType] = createSignal<string>('all');
	const [marketPage, setMarketPage] = createSignal<number>(1);

	// Modals
	const [isExportOpen, setIsExportOpen] = createSignal(false);
	const [isAlertsOpen, setIsAlertsOpen] = createSignal(false);
	const [isMethodologyOpen, setIsMethodologyOpen] = createSignal(false);

	// 1. Core Collection Overview Query
	const overviewQuery = createQuery(() => ({
		queryKey: ['numbersCollectionOverview'],
		queryFn: () => numbersApi.getCollectionOverview(),
		staleTime: 60 * 1000,
	}));

	// 2. Collection Time-Series History Query
	const historyQuery = createQuery(() => ({
		queryKey: ['numbersCollectionHistory', timeframe()],
		queryFn: () => numbersApi.getCollectionHistory(timeframe()),
		staleTime: 120 * 1000,
	}));

	// 3. Market Listings Query
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

	// 4. Pattern Analytics Query
	const patternsQuery = createQuery(() => ({
		queryKey: ['numbersPatternAnalytics'],
		queryFn: () => numbersApi.getPatternAnalytics(),
		staleTime: 300 * 1000,
	}));

	const overview = () => overviewQuery.data;
	const history = () => historyQuery.data?.points || [];
	const rate = () => overviewQuery.data?.ton_usd_rate || 5.0;
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
		<div class="pb-36 bg-[#030303] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Gradient Glows */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[360px] bg-gradient-to-b from-[#0098EA]/15 via-cyan-500/5 to-transparent blur-[110px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				{/* Top Collection Header */}
				<NumberCollectionHeader
					overview={overview()}
					onOpenExport={() => setIsExportOpen(true)}
					onOpenAlerts={() => setIsAlertsOpen(true)}
					onOpenMethodology={() => setIsMethodologyOpen(true)}
					onBack={() => navigate(-1)}
					onNavigateMask={() => navigate('/numbers/mask')}
				/>

				{/* Primary Decision KPIs */}
				<NumberCollectionKpis overview={overview()} />

				{/* Interactive Multi-Mode Chart */}
				<NumberCollectionChart
					points={history()}
					rate={rate()}
					timeframe={timeframe()}
					onTimeframeChange={setTimeframe}
					isLoading={historyQuery.isLoading}
				/>

				{/* 6-Tab Navigation Segment */}
				<div class="grid grid-cols-6 bg-[#0e121d]/90 p-1 rounded-2xl border border-white/10 mb-4 shadow-xl backdrop-blur-xl">
					<button
						type="button"
						onClick={() => switchTab('overview')}
						class={`py-2 rounded-xl text-[10px] font-black transition-all ${
							selectedTab() === 'overview'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/30'
								: 'text-white/40 hover:text-white'
						}`}
					>
						نمای کلی
					</button>

					<button
						type="button"
						onClick={() => switchTab('market')}
						class={`py-2 rounded-xl text-[10px] font-black transition-all ${
							selectedTab() === 'market'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/30'
								: 'text-white/40 hover:text-white'
						}`}
					>
						بازار
					</button>

					<button
						type="button"
						onClick={() => switchTab('patterns')}
						class={`py-2 rounded-xl text-[10px] font-black transition-all ${
							selectedTab() === 'patterns'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/30'
								: 'text-white/40 hover:text-white'
						}`}
					>
						الگوها
					</button>

					<button
						type="button"
						onClick={() => switchTab('holders')}
						class={`py-2 rounded-xl text-[10px] font-black transition-all ${
							selectedTab() === 'holders'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/30'
								: 'text-white/40 hover:text-white'
						}`}
					>
						نهنگ‌ها
					</button>

					<button
						type="button"
						onClick={() => switchTab('activity')}
						class={`py-2 rounded-xl text-[10px] font-black transition-all ${
							selectedTab() === 'activity'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/30'
								: 'text-white/40 hover:text-white'
						}`}
					>
						رویدادها
					</button>

					<button
						type="button"
						onClick={() => switchTab('risk')}
						class={`py-2 rounded-xl text-[10px] font-black transition-all ${
							selectedTab() === 'risk'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/30'
								: 'text-white/40 hover:text-white'
						}`}
					>
						ریسک
					</button>
				</div>

				{/* Tab 1: Overview */}
				<Show when={selectedTab() === 'overview'}>
					<div class="space-y-4">
						{/* 🌍 1. LAYA MULTI-CULTURAL DEMAND HEATMAP */}
						<NumberCulturalRadarHeatmap />

						{/* 🏆 2. COLLECTIBLE CLUB FLOORS TRACKER */}
						<NumberClubFloorsTracker
							onSelectNumber={(num) => navigate(`/numbers/report?n=${encodeURIComponent(num)}`)}
						/>

						{/* 📱 3. LAYA DIALPAD ERGONOMICS SCORE */}
						<NumberDialpadErgonomics initialNumber={overview()?.floor_number || '+888 8888 8888'} />

						{/* 💎 4. DEFI COLLATERAL & RENTAL YIELD */}
						<NumberDeFiFinancials
							medianFloorTon={overview()?.floor_ask_ton || 75}
							tonUsdRate={rate()}
						/>

						{/* Market Summary Card */}
						<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-3xl p-4 backdrop-blur-xl">
							<h3 class="text-xs font-black text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
								<span class="material-symbols-outlined text-[#0098EA] text-sm">info</span>
								درباره شماره‌های کلکسیونی تلگرام (+888)
							</h3>
							<p class="text-xs text-white/70 leading-relaxed">
								شماره‌های ناشناس تلگرام دارایی‌های غیرمتمرکز NFT بر بستر استاندارد تلمینت (Telemint) در
								بلاکچین TON هستند. این مجموعه در دسامبر ۲۰۲۲ منجمد شده و عرضه کل آن دقیقاً ۱۳۶,۵۶۶ عدد
								است؛ بنابراین هیچ شماره جدیدی مینت نخواهد شد و تمامی معاملات ثانویه هستند.
							</p>
						</div>

						{/* Quick Tools Navigation */}
						<div class="grid grid-cols-2 gap-2.5">
							<button
								type="button"
								onClick={() => {
									try {
										haptic.impact('light');
									} catch {}
									navigate('/numbers/intel');
								}}
								class="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-start transition-all group"
							>
								<span class="material-symbols-outlined text-[#0098EA] text-2xl mb-1 block">
									monitoring
								</span>
								<span class="text-xs font-black text-white block group-hover:text-[#0098EA]">
									میز هوش بازار (Intel Table)
								</span>
								<span class="text-[10px] text-white/40 block mt-0.5">
									مشاهده حراجی‌ها و لیستینگ‌های جاری
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
								class="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-start transition-all group"
							>
								<span class="material-symbols-outlined text-cyan-400 text-2xl mb-1 block">
									tune
								</span>
								<span class="text-xs font-black text-white block group-hover:text-cyan-400">
									طراح ماسک و فیلتر الگو
								</span>
								<span class="text-[10px] text-white/40 block mt-0.5">
									جستجوی پیشرفته بر اساس الگوهای ریاضی
								</span>
							</button>
						</div>
					</div>
				</Show>

				{/* Tab 2: Market */}
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

				{/* Tab 3: Patterns & Rarity */}
				<Show when={selectedTab() === 'patterns'}>
					<NumberPatternsView patterns={patterns()} rate={rate()} />
				</Show>

				{/* Tab 4: Holders & Whales */}
				<Show when={selectedTab() === 'holders'}>
					<NumberHoldersView overview={overview()} />
				</Show>

				{/* Tab 5: Event Activity Tape */}
				<Show when={selectedTab() === 'activity'}>
					<NumberActivityTape rate={rate()} />
				</Show>

				{/* Tab 6: Risk & Methodology */}
				<Show when={selectedTab() === 'risk'}>
					<NumberRiskMethodology overview={overview()} />
				</Show>
			</div>

			{/* Methodology Drawer Modal */}
			<Show when={isMethodologyOpen()}>
				<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-0 sm:p-4">
					<div class="bg-[#0e121d] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl">
						<NumberRiskMethodology
							overview={overview()}
							isDrawer={true}
							onCloseDrawer={() => setIsMethodologyOpen(false)}
						/>
					</div>
				</div>
			</Show>

			{/* Alerts Modal */}
			<NumberAlertsModal
				isOpen={isAlertsOpen()}
				onClose={() => setIsAlertsOpen(false)}
				currentFloor={overview()?.floor_ask_ton}
			/>

			{/* Export Modal */}
			<NumberExportModal
				isOpen={isExportOpen()}
				onClose={() => setIsExportOpen(false)}
				overview={overview()}
			/>
		</div>
	);
};
export default NumbersCollectionPage;
