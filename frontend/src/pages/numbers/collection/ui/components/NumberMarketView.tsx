import { type Component, createSignal, For, Show } from 'solid-js';
import type { NumberMarketListing } from '@/entities/numbers/model/types.js';
import { useI18n } from '@/shared/i18n/index.js';

interface MarketViewProps {
	listings: NumberMarketListing[];
	total: number;
	page: number;
	onPageChange: (newPage: number) => void;
	venue: string;
	onVenueChange: (v: string) => void;
	listingType: string;
	onListingTypeChange: (lt: string) => void;
	floorTon?: number | null;
	rate: number;
	isLoading?: boolean;
}

const MARKET_COPY: Record<
	string,
	{
		allVenues: string;
		allTypes: string;
		fixedAsk: string;
		activeAuction: string;
		searchPlaceholder: string;
		syncingListings: string;
		noListingsFound: string;
		auctionTag: string;
		buyNowTag: string;
		aboveFloor: string;
		prevPage: string;
		nextPage: string;
		pageLabel: string;
	}
> = {
	fa: {
		allVenues: 'همه بازارها',
		allTypes: 'همه انواع',
		fixedAsk: 'قیمت مقطوع',
		activeAuction: 'حراجی فعال',
		searchPlaceholder: 'فیلتر سریع شماره در این صفحه (مثلاً 8888)...',
		syncingListings: 'در حال همگام‌سازی لیستینگ‌ها...',
		noListingsFound: 'آیتم منطبقی یافت نشد',
		auctionTag: 'حراجی',
		buyNowTag: 'فروش فوری',
		aboveFloor: 'از کف',
		prevPage: 'صفحه قبل',
		nextPage: 'صفحه بعد',
		pageLabel: 'صفحه',
	},
	en: {
		allVenues: 'All Venues',
		allTypes: 'All Types',
		fixedAsk: 'Fixed Price',
		activeAuction: 'Live Auction',
		searchPlaceholder: 'Quick filter numbers on this page (e.g. 8888)...',
		syncingListings: 'Syncing live listings...',
		noListingsFound: 'No matching listings found',
		auctionTag: 'Auction',
		buyNowTag: 'Buy Now',
		aboveFloor: 'above floor',
		prevPage: 'Prev',
		nextPage: 'Next',
		pageLabel: 'Page',
	},
	ru: {
		allVenues: 'Все маркеты',
		allTypes: 'Все типы',
		fixedAsk: 'Фикс. цена',
		activeAuction: 'Аукцион',
		searchPlaceholder: 'Быстрый фильтр номеров (напр. 8888)...',
		syncingListings: 'Синхронизация листингов...',
		noListingsFound: 'Подходящие листинги не найдены',
		auctionTag: 'Аукцион',
		buyNowTag: 'Купить сейчас',
		aboveFloor: 'выше пола',
		prevPage: 'Назад',
		nextPage: 'Далее',
		pageLabel: 'Стр.',
	},
	zh: {
		allVenues: '全部市场',
		allTypes: '全部类型',
		fixedAsk: '一口价',
		activeAuction: '实时拍卖',
		searchPlaceholder: '快速筛选当前页号码 (例如 8888)...',
		syncingListings: '正在同步实时挂单...',
		noListingsFound: '未找到匹配的在售号码',
		auctionTag: '拍卖中',
		buyNowTag: '一口价',
		aboveFloor: '高于地板价',
		prevPage: '上一页',
		nextPage: '下一页',
		pageLabel: '第',
	},
};

export const NumberMarketView: Component<MarketViewProps> = (props) => {
	const { locale } = useI18n();
	const copy = () => MARKET_COPY[locale()] || MARKET_COPY.fa;
	const [searchFilter, setSearchFilter] = createSignal('');

	const formatTon = (nano?: number | null) => {
		if (!nano) return '—';
		const ton = nano / 1e9;
		return ton.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const formatUsd = (nano?: number | null) => {
		if (!nano) return '—';
		const ton = nano / 1e9;
		const usd = ton * props.rate;
		return `$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	const filteredItems = () => {
		const q = searchFilter().trim().replace(/\D/g, '');
		const items = props.listings || [];
		if (!q) return items;
		return items.filter((item) => item.number.replace(/\D/g, '').includes(q));
	};

	const getListingUrl = (item: NumberMarketListing) => {
		if (item.source_url) return item.source_url;
		const clean = item.number.replace(/\D/g, '');
		if (item.venue === 'getgems' && item.nft_item_address) {
			return `https://getgems.io/nft/${item.nft_item_address}`;
		}
		return `https://fragment.com/number/${clean}`;
	};

	return (
		<div class="space-y-3">
			{/* Filters Bar */}
			<div class="bg-[#0e121d]/90 border border-white/[0.08] rounded-2xl p-3 backdrop-blur-xl">
				<div class="flex items-center justify-between gap-2 flex-wrap mb-2.5">
					{/* Venue Filter */}
					<div class="flex items-center bg-white/[0.03] p-0.5 rounded-xl border border-white/[0.06]">
						<button
							type="button"
							onClick={() => props.onVenueChange('all')}
							class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
								props.venue === 'all' ? 'bg-[#0098EA] text-white shadow-sm' : 'text-white/40'
							}`}
						>
							{copy().allVenues}
						</button>
						<button
							type="button"
							onClick={() => props.onVenueChange('fragment')}
							class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
								props.venue === 'fragment' ? 'bg-[#0098EA] text-white shadow-sm' : 'text-white/40'
							}`}
						>
							Fragment
						</button>
						<button
							type="button"
							onClick={() => props.onVenueChange('getgems')}
							class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
								props.venue === 'getgems' ? 'bg-[#0098EA] text-white shadow-sm' : 'text-white/40'
							}`}
						>
							Getgems
						</button>
					</div>

					{/* Listing Type Filter */}
					<div class="flex items-center bg-white/[0.03] p-0.5 rounded-xl border border-white/[0.06]">
						<button
							type="button"
							onClick={() => props.onListingTypeChange('all')}
							class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
								props.listingType === 'all' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40'
							}`}
						>
							{copy().allTypes}
						</button>
						<button
							type="button"
							onClick={() => props.onListingTypeChange('ask')}
							class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
								props.listingType === 'ask' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40'
							}`}
						>
							{copy().fixedAsk}
						</button>
						<button
							type="button"
							onClick={() => props.onListingTypeChange('auction')}
							class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
								props.listingType === 'auction' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40'
							}`}
						>
							{copy().activeAuction}
						</button>
					</div>
				</div>

				{/* Quick Number Search Input */}
				<div class="relative">
					<span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-base">
						search
					</span>
					<input
						type="text"
						value={searchFilter()}
						onInput={(e) => setSearchFilter(e.currentTarget.value)}
						placeholder={copy().searchPlaceholder}
						class="w-full pl-3 pr-9 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#0098EA]/50 font-mono"
					/>
				</div>
			</div>

			{/* Listings Table / Cards */}
			<div class="space-y-2">
				<Show
					when={!props.isLoading && filteredItems().length > 0}
					fallback={
						<div class="text-center py-10 bg-[#0e121d]/50 rounded-2xl border border-white/[0.05]">
							<Show when={props.isLoading}>
								<div class="w-6 h-6 border-2 border-[#0098EA]/30 border-t-[#0098EA] rounded-full animate-spin mx-auto mb-2" />
								<span class="text-xs text-white/40 font-mono">{copy().syncingListings}</span>
							</Show>
							<Show when={!props.isLoading}>
								<span class="material-symbols-outlined text-3xl text-white/20 mb-1 block">
									inventory_2
								</span>
								<span class="text-xs text-white/50 block">{copy().noListingsFound}</span>
							</Show>
						</div>
					}
				>
					<For each={filteredItems()}>
						{(item) => (
							<div class="p-3.5 rounded-2xl bg-[#0c101a] border border-white/[0.06] hover:border-[#0098EA]/30 flex items-center justify-between gap-3 transition-all group">
								{/* Left: Number & Badges */}
								<div class="space-y-1 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<span class="text-sm font-black text-white font-mono tracking-tight group-hover:text-[#0098EA] transition-colors">
											{item.display_number || item.number}
										</span>
										<Show when={item.is_genesis}>
											<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
												GENESIS
											</span>
										</Show>
										<Show when={item.pattern_tag}>
											<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/[0.05] text-white/60">
												{item.pattern_tag}
											</span>
										</Show>
									</div>

									<div class="flex items-center gap-2 text-[10px] text-white/40 font-mono">
										<span class="capitalize">{item.venue}</span>
										<span>·</span>
										<span class="capitalize">
											{item.listing_type === 'auction' ? copy().auctionTag : copy().buyNowTag}
										</span>
										<Show when={item.difference_from_floor_pct > 0}>
											<span class="text-amber-400/80">
												+{item.difference_from_floor_pct.toFixed(1)}% {copy().aboveFloor}
											</span>
										</Show>
									</div>
								</div>

								{/* Right: Price & Buy Link */}
								<div class="text-end shrink-0 flex items-center gap-3">
									<div>
										<div class="text-sm font-black text-white font-mono">
											{formatTon(item.ask_price_nano_ton || item.current_bid_nano_ton)}{' '}
											<span class="text-[10px] text-[#0098EA]">TON</span>
										</div>
										<div class="text-[10px] font-mono text-white/40">
											{formatUsd(item.ask_price_nano_ton || item.current_bid_nano_ton)}
										</div>
									</div>

									<a
										href={getListingUrl(item)}
										target="_blank"
										rel="noopener noreferrer"
										class="w-9 h-9 rounded-xl bg-[#0098EA]/15 hover:bg-[#0098EA] text-[#0098EA] hover:text-white border border-[#0098EA]/30 flex items-center justify-center transition-all active:scale-95"
									>
										<span class="material-symbols-outlined text-base">open_in_new</span>
									</a>
								</div>
							</div>
						)}
					</For>
				</Show>
			</div>

			{/* Pagination Controls */}
			<Show when={props.total > 20}>
				<div class="flex items-center justify-between pt-2">
					<button
						type="button"
						disabled={props.page <= 1}
						onClick={() => props.onPageChange(props.page - 1)}
						class="px-3 py-1.5 rounded-xl bg-white/[0.04] disabled:opacity-30 text-xs font-bold text-white"
					>
						{copy().prevPage}
					</button>
					<span class="text-xs font-mono text-white/50">
						{copy().pageLabel} {props.page}
					</span>
					<button
						type="button"
						disabled={props.page * 20 >= props.total}
						onClick={() => props.onPageChange(props.page + 1)}
						class="px-3 py-1.5 rounded-xl bg-white/[0.04] disabled:opacity-30 text-xs font-bold text-white"
					>
						{copy().nextPage}
					</button>
				</div>
			</Show>
		</div>
	);
};
