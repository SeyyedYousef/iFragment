import { useNavigate } from '@solidjs/router';
import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	For,
	on,
	onMount,
	Show,
} from 'solid-js';
import { type DictPaths, locale, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { EndingSoonWidget } from './EndingSoonWidget.js';
import {
	clearRecentSearches,
	fetchGiftCollectionsCatalog,
	fetchHomeMarketPulse,
	formatEnNumber,
	type GiftAutocompleteCollection,
	getInitialGiftCollections,
	type HomeMarketPulse,
	loadRecentSearches,
	type RecentSearchItem,
	saveRecentSearch,
} from './homeMarketData.js';
import { LiveMarketTicker } from './LiveMarketTicker.js';
import { UnifiedWalletScanner } from './UnifiedWalletScanner.js';

const isRtl = () => locale() === 'fa';

type TabType = 'username' | 'collectibles' | 'gifts';

interface HeroTabsProps {
	activeTab: TabType | null;
	onTabChange: (tab: TabType) => void;
	onResetTab?: () => void;
	onOpenCreditStore?: () => void;
	refreshTick?: number;
}

export const HeroTabs: Component<HeroTabsProps> = (props) => {
	const navigate = useNavigate();
	const [quickQuery, setQuickQuery] = createSignal('');
	const [searchFocused, setSearchFocused] = createSignal(false);
	const [recentSearches, setRecentSearches] = createSignal<RecentSearchItem[]>(
		loadRecentSearches(),
	);
	const [collections, setCollections] = createSignal<GiftAutocompleteCollection[]>(
		getInitialGiftCollections(),
	);
	const [marketPulse, setMarketPulse] = createSignal<HomeMarketPulse | null>(null);
	const [pulseLoading, setPulseLoading] = createSignal(true);

	const loadPulse = async (force = false) => {
		setPulseLoading(true);
		try {
			const data = await fetchHomeMarketPulse(force);
			setMarketPulse(data);
		} finally {
			setPulseLoading(false);
		}
	};

	onMount(() => {
		void loadPulse(false);
		void fetchGiftCollectionsCatalog().then((list) => {
			if (list.length > 0) setCollections(list);
		});
	});

	createEffect(
		on(
			() => props.refreshTick,
			(tick, prev) => {
				if (tick !== undefined && prev !== undefined && tick !== prev) {
					void loadPulse(true);
				}
			},
			{ defer: true },
		),
	);

	const detectedType = createMemo<'username' | 'number' | 'gift' | null>(() => {
		const raw = quickQuery().trim();
		if (!raw) return null;
		const digits = raw.replace(/[\s\-+()]/g, '');
		if (raw.startsWith('+888') || (digits.startsWith('888') && /^\d{7,15}$/.test(digits))) {
			return 'number';
		}
		if (
			/t\.me\/nft\//i.test(raw) ||
			/fragment\.com\/gift\//i.test(raw) ||
			/^[a-zA-Z0-9_]+-\d+$/.test(raw) ||
			/#\d+$/.test(raw)
		) {
			return 'gift';
		}
		return 'username';
	});

	// Filter 122 official Gift collections for live Smart Search autocomplete
	const matchingCollections = createMemo<GiftAutocompleteCollection[]>(() => {
		const raw = quickQuery().trim();
		if (!raw) return [];
		// Skip collection suggestions for explicit +888 numbers or specific gift serials
		if (detectedType() === 'number' || detectedType() === 'gift') return [];
		const qLower = raw.replace(/^@/, '').toLowerCase();
		const qNorm = qLower.replace(/[^a-z0-9]/g, '');
		if (qNorm.length < 2) return [];

		const scored: Array<{ item: GiftAutocompleteCollection; score: number }> = [];
		for (const col of collections()) {
			const nameLower = col.name.toLowerCase();
			if (nameLower.startsWith(qLower) || col.normSlug.startsWith(qNorm)) {
				scored.push({ item: col, score: 3 });
			} else if (nameLower.includes(qLower) || col.normSlug.includes(qNorm)) {
				scored.push({ item: col, score: 2 });
			}
		}
		scored.sort((a, b) => b.score - a.score || b.item.floorTon - a.item.floorTon);
		return scored.slice(0, 5).map((s) => s.item);
	});

	const showAutocomplete = createMemo(
		() => searchFocused() && quickQuery().trim().length >= 1 && matchingCollections().length > 0,
	);

	const handleSelectCollection = (col: GiftAutocompleteCollection) => {
		try {
			haptic.impact('light');
		} catch {}
		const route = `/gifts/collection?c=${encodeURIComponent(col.slug)}`;
		setRecentSearches(
			saveRecentSearch({
				query: col.slug,
				label: col.name,
				type: 'collection',
				route,
			}),
		);
		setSearchFocused(false);
		navigate(route);
	};

	const handleUniversalSubmit = (e?: Event) => {
		e?.preventDefault();
		const raw = quickQuery().trim();
		if (!raw) return;
		try {
			haptic.impact('medium');
		} catch {}

		setSearchFocused(false);
		const type = detectedType();

		if (type === 'number') {
			const cleanDigits = raw.replace(/[^\d]/g, '');
			const route = `/numbers/report?n=${encodeURIComponent(cleanDigits)}`;
			setRecentSearches(
				saveRecentSearch({
					query: `+${cleanDigits}`,
					label: `+${cleanDigits}`,
					type: 'number',
					route,
				}),
			);
			navigate(route);
			return;
		}
		if (type === 'gift') {
			let slug = raw
				.replace(/^https?:\/\/(www\.)?t\.me\/nft\//i, '')
				.replace(/^https?:\/\/(www\.)?fragment\.com\/gift\//i, '')
				.split('?')[0]
				.trim();
			slug = slug.replace(/\s+#/, '-');
			const route = `/gifts/report?g=${encodeURIComponent(slug)}`;
			setRecentSearches(
				saveRecentSearch({
					query: slug,
					label: slug,
					type: 'gift',
					route,
				}),
			);
			navigate(route);
			return;
		}
		const cleanUser = raw
			.replace(/^https?:\/\/(www\.)?t\.me\//i, '')
			.replace(/^https?:\/\/(www\.)?fragment\.com\/username\//i, '')
			.replace(/^@/, '')
			.split('/')[0]
			.split('?')[0]
			.trim()
			.toLowerCase();
		if (cleanUser) {
			const route = `/username?u=${encodeURIComponent(cleanUser)}`;
			setRecentSearches(
				saveRecentSearch({
					query: `@${cleanUser}`,
					label: `@${cleanUser}`,
					type: 'username',
					route,
				}),
			);
			navigate(route);
		}
	};

	const handleRecentClick = (item: RecentSearchItem) => {
		try {
			haptic.selection();
		} catch {}
		navigate(item.route);
	};

	const handleClearRecent = () => {
		try {
			haptic.selection();
		} catch {}
		setRecentSearches(clearRecentSearches());
	};

	const TABS: {
		id: TabType;
		icon: string;
		labelKey: DictPaths;
		marketPath: string;
	}[] = [
		{
			id: 'username',
			icon: 'alternate_email',
			labelKey: 'action.username.label',
			marketPath: '/collection-info',
		},
		{
			id: 'collectibles',
			icon: 'tag',
			labelKey: 'action.collectibles.label',
			marketPath: '/numbers/intel',
		},
		{
			id: 'gifts',
			icon: 'featured_seasonal_and_gifts',
			labelKey: 'action.gifts.label',
			marketPath: '/gifts/intel',
		},
	];

	const handleTabClick = (tab: (typeof TABS)[number]) => {
		try {
			haptic.impact('light');
		} catch {}
		props.onTabChange(tab.id);
	};

	return (
		<div class="w-full flex flex-col font-frag-sans relative z-10">
			{/* Authentic Fragment.com Top Sticky Bar (.tm-header) — Full-width 3-column tabs so Gifts is always 100% visible */}
			<header class="frag-header sticky top-0 z-40 w-full">
				<div class="w-full h-[48px] px-4 flex items-center justify-between gap-3">
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							if (props.onResetTab) props.onResetTab();
						}}
						class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
					>
						<TonIcon size={20} color="#4db2ff" />
						<span class="text-[15px] font-bold tracking-[0.04em] text-white" dir="ltr">
							FRAGMENT
						</span>
					</button>

					<Show when={props.onOpenCreditStore}>
						<button
							type="button"
							onClick={props.onOpenCreditStore}
							class="h-8 px-2.5 rounded-[8px] bg-[#293440] hover:bg-[#384553] text-white text-[12px] font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
						>
							<span
								class="material-symbols-outlined text-[15px] text-[#ff9953]"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								star
							</span>
							<span>{t('paywall.credit_unit')}</span>
						</button>
					</Show>
				</div>

				{/* Full-Width 3-Column Navigation Tabs (Usernames | Numbers | Gifts — zero overflow clipping on mobile) */}
				<div
					class="grid grid-cols-3 w-full border-t border-white/[0.06] px-2"
					role="tablist"
					aria-label={t('heroTabs.analysisCategories')}
				>
					<For each={TABS}>
						{(tab) => {
							const isSelected = () => props.activeTab === tab.id;
							return (
								<button
									type="button"
									role="tab"
									aria-selected={isSelected()}
									aria-label={t(tab.labelKey)}
									onClick={() => handleTabClick(tab)}
									class={`relative h-[40px] px-1.5 flex items-center justify-center text-[12.5px] font-semibold truncate transition-colors cursor-pointer ${
										isSelected() ? 'text-white' : 'text-[#cbd7e5]/75 hover:text-white'
									}`}
								>
									<span class="truncate">{t(tab.labelKey)}</span>
									<Show when={isSelected()}>
										<span
											class="absolute inset-x-3 bottom-0 h-[3px] bg-[#248bda] rounded-t-[3px]"
											aria-hidden="true"
										/>
									</Show>
								</button>
							);
						}}
					</For>
				</div>
			</header>

			{/* Landing Overview (when no sub-tab is locked open) */}
			<Show when={!props.activeTab}>
				{/* Live Market Ticker directly under header */}
				<LiveMarketTicker pulse={marketPulse()} loading={pulseLoading()} />

				<div class="w-full max-w-[480px] mx-auto px-4 pt-6 pb-10 flex flex-col items-center">
					{/* Centered Fragment Intro (.tm-main-intro) */}
					<div class="w-full text-center mb-5 flex flex-col items-center">
						<h1 class="text-[22px] sm:text-[24px] font-semibold tracking-[-0.015em] leading-[1.25] text-white mb-2">
							{t('hero.title')}
						</h1>
						<p class="text-[13px] text-[#8794a1] font-normal leading-[1.55] max-w-[380px]">
							{t('hero.description')}
						</p>
					</div>

					{/* Universal Smart Search Field + 122-Collection Live Autocomplete */}
					<div class="w-full relative mb-3">
						<form
							onSubmit={handleUniversalSubmit}
							class="w-full bg-[#242e38] hover:bg-[#293440] focus-within:bg-[#293440] rounded-[8px] p-1.5 flex items-center gap-1.5 transition-colors"
						>
							<div class="pl-2.5 pr-1 flex items-center text-[#8a98a6] shrink-0">
								<span class="material-symbols-outlined text-[19px]" aria-hidden="true">
									search
								</span>
							</div>
							<input
								type="text"
								value={quickQuery()}
								onFocus={() => setSearchFocused(true)}
								onBlur={() => setTimeout(() => setSearchFocused(false), 160)}
								onKeyDown={(e) => {
									if (e.key === 'Escape') setSearchFocused(false);
								}}
								onInput={(e) => {
									setQuickQuery(e.currentTarget.value);
									setSearchFocused(true);
								}}
								placeholder={t('hero.smartSearch')}
								aria-label={t('hero.smartSearch')}
								dir={quickQuery() ? 'ltr' : isRtl() ? 'rtl' : 'ltr'}
								class="flex-1 min-w-0 bg-transparent text-white text-[13.5px] font-semibold placeholder:text-[#8a98a6] placeholder:font-normal focus:outline-none py-1.5 px-1"
								autocomplete="off"
								autocapitalize="off"
								spellcheck={false}
							/>
							<Show when={detectedType()}>
								<span
									class={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-[4px] shrink-0 ${
										detectedType() === 'number'
											? 'bg-[#5aec8c]/10 text-[#5aec8c]'
											: detectedType() === 'gift'
												? 'bg-[#ff9953]/10 text-[#ff9953]'
												: 'bg-[#4db2ff]/10 text-[#4db2ff]'
									}`}
									dir="ltr"
								>
									{detectedType() === 'number'
										? '+888'
										: detectedType() === 'gift'
											? 'GIFT'
											: '@USER'}
								</span>
							</Show>
							<button
								type="submit"
								class="frag-btn-primary px-4 h-9 rounded-[6px] text-[13px] font-semibold shrink-0 cursor-pointer"
							>
								{t('hero.smartSearchBtn')}
							</button>
						</form>

						{/* Live Autocomplete Popover for 122 Gift Collections */}
						<Show when={showAutocomplete()}>
							<div
								class="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-[8px] bg-[#212a33] border border-white/[0.08] shadow-xl overflow-hidden"
								role="listbox"
								aria-label={t('home.autocompleteCollections')}
							>
								<div class="px-3 py-1.5 bg-[#1d252e] border-b border-white/[0.06] flex items-center justify-between text-[11px] font-semibold text-[#8c9aa9]">
									<span>{t('home.autocompleteCollections')}</span>
									<span class="font-mono text-[#4db2ff]" dir="ltr">
										{formatEnNumber(matchingCollections().length, 0)}
									</span>
								</div>
								<div class="divide-y divide-[#1a2026]">
									<For each={matchingCollections()}>
										{(col) => (
											<button
												type="button"
												role="option"
												onMouseDown={(e) => {
													e.preventDefault();
													handleSelectCollection(col);
												}}
												onClick={() => handleSelectCollection(col)}
												class="w-full px-3 py-2.5 hover:bg-[#293440] flex items-center justify-between gap-2.5 text-start transition-colors cursor-pointer"
											>
												<div class="flex items-center gap-2.5 min-w-0">
													<Show
														when={col.imageUrl}
														fallback={
															<span class="w-7 h-7 rounded-[6px] bg-[#242e38] flex items-center justify-center text-[15px] shrink-0">
																{col.emoji || '🎁'}
															</span>
														}
													>
														<img
															src={col.imageUrl}
															alt={col.name}
															class="w-7 h-7 rounded-[6px] bg-[#242e38] object-cover shrink-0"
															loading="lazy"
														/>
													</Show>
													<div class="flex flex-col min-w-0">
														<span class="text-[13px] font-semibold text-white truncate" dir="ltr">
															{col.name}
														</span>
														<Show when={col.supply > 0}>
															<span
																class="text-[11px] text-[#8c9aa9] font-mono tabular-nums"
																dir="ltr"
															>
																{formatEnNumber(col.supply, 0)} supply
															</span>
														</Show>
													</div>
												</div>
												<div class="flex items-center gap-1.5 shrink-0" dir="ltr">
													<Show when={col.floorTon > 0}>
														<span class="inline-flex items-center gap-1 text-[12px] font-semibold text-white tabular-nums">
															<TonIcon size={11} color="#4db2ff" />
															{formatEnNumber(col.floorTon, 1)}
														</span>
													</Show>
													<span class="material-symbols-outlined text-[15px] text-[#8c9aa9]">
														chevron_right
													</span>
												</div>
											</button>
										)}
									</For>
								</div>
								<button
									type="button"
									onMouseDown={(e) => {
										e.preventDefault();
										handleUniversalSubmit();
									}}
									onClick={() => handleUniversalSubmit()}
									class="w-full px-3 py-2 bg-[#1d252e] hover:bg-[#293440] border-t border-white/[0.06] flex items-center justify-between text-[12px] text-[#4db2ff] font-semibold transition-colors cursor-pointer"
								>
									<span>{t('home.autocompleteDirect')}</span>
									<span class="font-mono text-white/90 truncate max-w-[160px]" dir="ltr">
										{quickQuery().trim()}
									</span>
								</button>
							</div>
						</Show>
					</div>

					{/* Recent Searches (Last 5 persisted in localStorage) */}
					<Show when={recentSearches().length > 0}>
						<div class="w-full flex items-center gap-1.5 mb-5 overflow-x-auto no-scrollbar">
							<span class="text-[11px] font-semibold text-[#8c9aa9] shrink-0 flex items-center gap-1">
								<span class="material-symbols-outlined text-[13px]">history</span>
								<span>{t('home.recentSearches')}:</span>
							</span>
							<For each={recentSearches()}>
								{(item) => (
									<button
										type="button"
										onClick={() => handleRecentClick(item)}
										class="shrink-0 h-6 px-2.5 rounded-[5px] bg-[#212a33] hover:bg-[#293440] border border-white/[0.06] text-[11.5px] font-medium text-[#cbd7e5] hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
										dir="ltr"
									>
										<span
											class={`w-1.5 h-1.5 rounded-full shrink-0 ${
												item.type === 'number'
													? 'bg-[#5aec8c]'
													: item.type === 'gift' || item.type === 'collection'
														? 'bg-[#ff9953]'
														: 'bg-[#4db2ff]'
											}`}
										/>
										<span class="truncate max-w-[120px]">{item.label}</span>
									</button>
								)}
							</For>
							<button
								type="button"
								onClick={handleClearRecent}
								aria-label={t('home.clearRecent')}
								class="shrink-0 h-6 px-2 rounded-[5px] text-[11px] text-[#8c9aa9] hover:text-white transition-colors cursor-pointer"
							>
								{t('home.clearRecent')}
							</button>
						</div>
					</Show>
					<Show when={recentSearches().length === 0}>
						<div class="mb-2" />
					</Show>

					{/* Ending Soon Auctions Widget (replaces redundant 3 middle category cards) */}
					<EndingSoonWidget items={marketPulse()?.endingSoon ?? []} loading={pulseLoading()} />

					{/* Unified 3-in-1 Wallet Portfolio Scanner */}
					<UnifiedWalletScanner tonUsdRate={marketPulse()?.tonUsdRate ?? null} />

					{/* Fragment Market Directory Table (.tm-table-wrap) */}
					<div class="w-full">
						<div class="flex items-center justify-between px-1 mb-2">
							<h2 class="text-[15px] font-semibold text-white">{t('home.collectionInfo')}</h2>
						</div>
						<div class="frag-table-container divide-y divide-[#1a2026]">
							<button
								type="button"
								onClick={() => navigate('/collection-info')}
								class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
							>
								<div class="flex items-center gap-3 min-w-0">
									<div class="w-8 h-8 rounded-[6px] bg-[#242e38] flex items-center justify-center text-[#4db2ff] font-semibold text-[15px] shrink-0">
										@
									</div>
									<div class="flex flex-col min-w-0">
										<span class="text-[13.5px] font-semibold text-white truncate">
											{t('action.username.label')}
										</span>
										<span class="text-[12px] text-[#8c9aa9] truncate">
											{t('home.collectionInfo')}
										</span>
									</div>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<span class="px-2 py-0.5 rounded-[4px] bg-[#5aec8c]/10 text-[#5aec8c] text-[11px] font-semibold">
										Live
									</span>
									<span class="material-symbols-outlined text-[17px] text-[#8c9aa9] rtl:rotate-180">
										chevron_right
									</span>
								</div>
							</button>

							<button
								type="button"
								onClick={() => navigate('/numbers/intel')}
								class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
							>
								<div class="flex items-center gap-3 min-w-0">
									<div class="w-8 h-8 rounded-[6px] bg-[#242e38] flex items-center justify-center text-[#4db2ff] shrink-0">
										<span class="material-symbols-outlined text-[17px]">tag</span>
									</div>
									<div class="flex flex-col min-w-0">
										<span class="text-[13.5px] font-semibold text-white truncate">
											{t('action.collectibles.label')}
										</span>
										<span class="text-[12px] text-[#8c9aa9] truncate">
											{t('home.numbersIntel')}
										</span>
									</div>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<span class="px-2 py-0.5 rounded-[4px] bg-[#4db2ff]/10 text-[#4db2ff] text-[11px] font-mono font-semibold">
										136,566
									</span>
									<span class="material-symbols-outlined text-[17px] text-[#8c9aa9] rtl:rotate-180">
										chevron_right
									</span>
								</div>
							</button>

							<button
								type="button"
								onClick={() => navigate('/gifts/intel')}
								class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
							>
								<div class="flex items-center gap-3 min-w-0">
									<div class="w-8 h-8 rounded-[6px] bg-[#242e38] flex items-center justify-center text-[#4db2ff] shrink-0">
										<span class="material-symbols-outlined text-[17px]">
											featured_seasonal_and_gifts
										</span>
									</div>
									<div class="flex flex-col min-w-0">
										<span class="text-[13.5px] font-semibold text-white truncate">
											{t('action.gifts.label')}
										</span>
										<span class="text-[12px] text-[#8c9aa9] truncate">{t('home.giftsIntel')}</span>
									</div>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<span class="px-2 py-0.5 rounded-[4px] bg-[#ff9953]/10 text-[#ff9953] text-[11px] font-semibold">
										TEP-62
									</span>
									<span class="material-symbols-outlined text-[17px] text-[#8c9aa9] rtl:rotate-180">
										chevron_right
									</span>
								</div>
							</button>
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
};
