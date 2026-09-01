import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { numbersApi, splitNumberPrefix } from '@/entities/numbers/index.js';
import type { NumbersFilterState } from '@/entities/numbers/model/types.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	initialFilter?: {
		saleType?: '' | 'auction' | 'for_sale' | 'not_for_sale';
		numberType?: '' | 'banned' | 'not_banned';
	};
	onSelectNumber?: (num: string) => void;
	onViewOwnerPortfolio?: (address: string) => void;
}

const NFT_COLORS: { hex: string; name: string }[] = [
	{ hex: 'D35E9E', name: 'Pink' },
	{ hex: 'C49A3F', name: 'Gold' },
	{ hex: '43A34E', name: 'Green' },
	{ hex: '66A14D', name: 'Olive' },
	{ hex: '111518', name: 'Black' },
	{ hex: '73589A', name: 'Purple' },
	{ hex: '7A6147', name: 'Brown' },
	{ hex: '14ACB9', name: 'Teal' },
	{ hex: '288576', name: 'Turquoise' },
	{ hex: '998655', name: 'Tan' },
	{ hex: '377E8A', name: 'Blue Gray' },
	{ hex: 'E06054', name: 'Red' },
	{ hex: '984D4B', name: 'Rose' },
	{ hex: '3BA76E', name: 'Mint' },
	{ hex: '5863D1', name: 'Blue' },
	{ hex: '6F7D8A', name: 'Gray' },
	{ hex: 'D47650', name: 'Orange' },
	{ hex: '368DEB', name: 'Sky' },
	{ hex: '8D66E3', name: 'Violet' },
	{ hex: 'BD66DA', name: 'Lavender' },
];

export const NumbersTableView: Component<Props> = (props) => {
	const [filters, setFilters] = createSignal<NumbersFilterState>({
		saleType: props.initialFilter?.saleType || '',
		numberType: props.initialFilter?.numberType || '',
		ownersHistory: '',
		nftColors: [],
		mask: '',
		page: 1,
		limit: 50,
	});

	const [isFiltersOpen, setIsFiltersOpen] = createSignal<boolean>(false);
	const [copiedAddress, setCopiedAddress] = createSignal<string | null>(null);
	const [jumpPageInput, setJumpPageInput] = createSignal<string>('');
	const [localMask, setLocalMask] = createSignal<string>('');
	let maskDebounceTimer: any = null;

	const handleMaskInput = (val: string) => {
		setLocalMask(val);
		if (maskDebounceTimer) clearTimeout(maskDebounceTimer);
		maskDebounceTimer = setTimeout(() => {
			setFilters((prev) => ({ ...prev, mask: val, page: 1 }));
		}, 300);
	};

	const handleClearMask = () => {
		setLocalMask('');
		if (maskDebounceTimer) clearTimeout(maskDebounceTimer);
		setFilters((prev) => ({ ...prev, mask: '', page: 1 }));
	};

	// Fetch filtered list (50 real numbers per page)
	const numbersQuery = createQuery(() => ({
		queryKey: ['numbersList', filters()],
		queryFn: () => numbersApi.getNumbersList(filters()),
		staleTime: 30 * 1000,
	}));

	const activeFiltersCount = () => {
		let count = 0;
		if (filters().saleType) count++;
		if (filters().numberType) count++;
		if (filters().ownersHistory) count++;
		if (filters().nftColors.length > 0) count++;
		if (filters().mask) count++;
		return count;
	};

	const resetFilters = () => {
		try {
			haptic.impact('medium');
		} catch {}
		setLocalMask('');
		if (maskDebounceTimer) clearTimeout(maskDebounceTimer);
		setFilters({
			saleType: '',
			numberType: '',
			ownersHistory: '',
			nftColors: [],
			mask: '',
			page: 1,
			limit: 50,
		});
	};

	const handleCopy = (address: string) => {
		try {
			navigator.clipboard.writeText(address);
			haptic.notify('success');
			setCopiedAddress(address);
			setTimeout(() => setCopiedAddress(null), 2000);
		} catch {}
	};

	const formatTon = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const handleJumpPage = (e: Event) => {
		e.preventDefault();
		const p = parseInt(jumpPageInput(), 10);
		const max = numbersQuery.data?.totalPages || 1;
		if (!isNaN(p) && p >= 1 && p <= max) {
			try {
				haptic.selection();
			} catch {}
			setFilters((prev) => ({ ...prev, page: p }));
			setJumpPageInput('');
		}
	};

	// Generate pagination page list
	const getPagePills = () => {
		const cur = filters().page;
		const total = numbersQuery.data?.totalPages || 1;
		if (total <= 7) {
			return Array.from({ length: total }, (_, i) => i + 1);
		}

		const pages: (number | string)[] = [];
		if (cur <= 4) {
			pages.push(1, 2, 3, 4, 5, '...', total);
		} else if (cur >= total - 3) {
			pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
		} else {
			pages.push(1, '...', cur - 1, cur, cur + 1, '...', total);
		}
		return pages;
	};

	return (
		<div class="space-y-4">
			{/* Fast Filter Quick Chips (No emojis, clean Material icons, fully localized) */}
			<div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
				{[
					{ label: () => t('numbers.filterAll') || 'All Numbers', count: '136.5k', saleType: '', numberType: '', icon: 'all_inclusive' },
					{ label: () => t('numbers.filterAuctions') || 'Auctions', count: '190+', saleType: 'auction', numberType: '', icon: 'gavel' },
					{ label: () => t('numbers.filterFixedPrice') || 'Fixed Price', count: '860+', saleType: 'for_sale', numberType: '', icon: 'sell' },
					{ label: () => t('numbers.filterNotForSale') || 'Not For Sale', count: '135k', saleType: 'not_for_sale', numberType: '', icon: 'lock' },
					{ label: () => t('numbers.filterRestricted') || 'Restricted', count: '4.5k', saleType: '', numberType: 'banned', icon: 'warning' },
				].map((chip) => {
					const isActive = () =>
						filters().saleType === chip.saleType &&
						(chip.numberType === '' ? filters().numberType !== 'banned' : filters().numberType === chip.numberType);
					return (
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setFilters((prev) => ({
									...prev,
									saleType: chip.saleType as any,
									numberType: chip.numberType as any,
									page: 1,
								}));
							}}
							class={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
								isActive()
									? 'bg-[#0098EA]/20 border-[#0098EA] text-[#0098EA] shadow-[0_0_12px_rgba(0,152,234,0.3)]'
									: 'bg-white/[0.03] border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.06]'
							}`}
						>
							<span class="material-symbols-outlined text-[13px]">{chip.icon}</span>
							<span>{chip.label()}</span>
							<span class="text-[10px] opacity-60 font-mono">({chip.count})</span>
						</button>
					);
				})}
			</div>

			{/* Filters Accordion / Control Bar */}
			<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-xl">
				<div class="flex items-center justify-between">
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setIsFiltersOpen(!isFiltersOpen());
						}}
						class="flex items-center gap-2 text-sm font-black text-white hover:text-[#0098EA] transition-all"
					>
						<span class="material-symbols-outlined text-lg text-[#0098EA]">tune</span>
						<span>{t('numbers.filtersTitle') || 'Advanced Filters'}</span>
						<Show when={activeFiltersCount() > 0}>
							<span class="px-2 py-0.5 text-[10px] font-black rounded-full bg-[#0098EA] text-white">
								{activeFiltersCount()}
							</span>
						</Show>
						<span
							class={`material-symbols-outlined text-sm transition-transform duration-200 ${
								isFiltersOpen() ? 'rotate-180' : ''
							}`}
						>
							expand_more
						</span>
					</button>

					<div class="flex items-center gap-2">
						<Show when={activeFiltersCount() > 0}>
							<button
								type="button"
								onClick={resetFilters}
								class="text-[11px] font-bold text-rose-400 hover:underline px-2 py-1"
							>
								{t('numbers.reset') || 'Reset'}
							</button>
						</Show>
					</div>
				</div>

				{/* Expanded Filters Drawer */}
				<Show when={isFiltersOpen()}>
					<div class="pt-4 mt-4 border-t border-white/[0.06] space-y-4 animate-in fade-in duration-200">
						{/* 1. Mask / Search Box */}
						<div>
							<label class="block text-[11px] font-extrabold text-white/50 mb-1.5 uppercase tracking-wider">
								{t('numbers.patternQuery') || 'Search Number / Mask'}
							</label>
							<div class="relative">
								<input
									type="text"
									placeholder="e.g. 8888000 or +888..."
									value={localMask()}
									onInput={(e) => handleMaskInput(e.currentTarget.value)}
									class="w-full bg-black/40 border border-white/10 rounded-xl pl-3 pr-8 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#0098EA] font-mono transition-all"
								/>
								<Show when={localMask()}>
									<button
										type="button"
										onClick={handleClearMask}
										class="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
										title="Clear search"
									>
										<span class="material-symbols-outlined text-sm">close</span>
									</button>
								</Show>
							</div>
						</div>

						{/* 2. Sale Type */}
						<div>
							<label class="block text-[11px] font-extrabold text-white/50 mb-1.5 uppercase tracking-wider">
								Sale Type
							</label>
							<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
								{[
									{ id: '', label: 'Any' },
									{ id: 'auction', label: 'Auction' },
									{ id: 'for_sale', label: 'Fixed Price' },
									{ id: 'not_for_sale', label: 'Not For Sale' },
								].map((item) => (
									<button
										type="button"
										onClick={() => {
											try {
												haptic.selection();
											} catch {}
											setFilters((prev) => ({
												...prev,
												saleType: item.id as any,
												page: 1,
											}));
										}}
										class={`px-3 py-1.5 rounded-xl text-xs font-bold text-center border transition-all ${
											filters().saleType === item.id
												? 'bg-[#0098EA]/20 border-[#0098EA] text-[#0098EA]'
												: 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white'
										}`}
									>
										{item.label}
									</button>
								))}
							</div>
						</div>

						{/* 3. Number Type */}
						<div>
							<label class="block text-[11px] font-extrabold text-white/50 mb-1.5 uppercase tracking-wider">
								{t('numbers.filterNumberType') || 'Number Type'}
							</label>
							<div class="grid grid-cols-3 gap-1.5">
								{[
									{ id: '', label: () => t('numbers.filterAny') || 'Any' },
									{ id: 'banned', label: () => t('numbers.filterRestricted') || 'Restricted' },
									{ id: 'not_banned', label: () => t('numbers.filterNonRestricted') || 'Non-Restricted' },
								].map((item) => (
									<button
										type="button"
										onClick={() => {
											try {
												haptic.selection();
											} catch {}
											setFilters((prev) => ({
												...prev,
												numberType: item.id as any,
												page: 1,
											}));
										}}
										class={`px-3 py-1.5 rounded-xl text-xs font-bold text-center border transition-all ${
											filters().numberType === item.id
												? 'bg-[#0098EA]/20 border-[#0098EA] text-[#0098EA]'
												: 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white'
										}`}
									>
										{item.label()}
									</button>
								))}
							</div>
						</div>

						{/* 4. Owners History */}
						<div>
							<label class="block text-[11px] font-extrabold text-white/50 mb-1.5 uppercase tracking-wider">
								{t('numbers.filterOwnersHistory') || 'Owners History'}
							</label>
							<div class="grid grid-cols-4 gap-1.5">
								{[
									{ id: '', label: () => t('numbers.filterAny') || 'Any' },
									{ id: '1', label: () => t('numbers.filterTheOnly') || 'The Only' },
									{ id: '2-3', label: () => '2-3' },
									{ id: '4+', label: () => '4+' },
								].map((item) => (
									<button
										type="button"
										onClick={() => {
											try {
												haptic.selection();
											} catch {}
											setFilters((prev) => ({
												...prev,
												ownersHistory: item.id as any,
												page: 1,
											}));
										}}
										class={`px-3 py-1.5 rounded-xl text-xs font-bold text-center border transition-all ${
											filters().ownersHistory === item.id
												? 'bg-[#0098EA]/20 border-[#0098EA] text-[#0098EA]'
												: 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white'
										}`}
									>
										{item.label()}
									</button>
								))}
							</div>
						</div>

						{/* 5. NFT Colors Palette */}
						<div>
							<div class="flex items-center justify-between mb-1.5">
								<label class="block text-[11px] font-extrabold text-white/50 uppercase tracking-wider">
									{t('numbers.filterNftColor') || 'NFT Color'}
								</label>
								<Show when={filters().nftColors.length > 0}>
									<button
										type="button"
										onClick={() => setFilters((prev) => ({ ...prev, nftColors: [], page: 1 }))}
										class="text-[10px] text-[#0098EA] hover:underline"
									>
										{t('numbers.filterClearColors') || 'Clear colors'}
									</button>
								</Show>
							</div>
							<div class="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-40 overflow-y-auto pr-1">
								<For each={NFT_COLORS}>
									{(c) => {
										const isSelected = () => filters().nftColors.includes(c.hex);
										return (
											<button
												type="button"
												onClick={() => {
													try {
														haptic.selection();
													} catch {}
													const current = filters().nftColors;
													const next = current.includes(c.hex)
														? current.filter((x) => x !== c.hex)
														: [...current, c.hex];
													setFilters((prev) => ({ ...prev, nftColors: next, page: 1 }));
												}}
												class={`px-2 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 transition-all ${
													isSelected()
														? 'bg-white/15 border-white text-white shadow-sm'
														: 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white'
												}`}
											>
												<span
													class="w-3 h-3 rounded-full border border-white/30 shrink-0"
													style={{ background: `#${c.hex}` }}
												/>
												<span class="truncate">{c.name}</span>
											</button>
										);
									}}
								</For>
							</div>
						</div>
					</div>
				</Show>
			</div>

			{/* Results Table (50 real numbers per page) */}
			<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl backdrop-blur-xl shadow-xl overflow-hidden">
				<div class="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
						<span class="text-xs font-black text-white">{t('numbers.liveOnChainFeed') || 'Live On-Chain Feed'}</span>
						<span class="text-[10px] font-mono text-white/40">
							({numbersQuery.data?.items.length || 0} / {numbersQuery.data?.total?.toLocaleString() || '136,566'})
						</span>
					</div>
					<div class="text-[11px] font-mono text-white/60">
						{filters().page} / {numbersQuery.data?.totalPages || 2732}
					</div>
				</div>

				<Show
					when={!numbersQuery.isPending}
					fallback={
						<div class="p-4 space-y-3 animate-pulse">
							<For each={[1, 2, 3, 4, 5, 6]}>
								{() => (
									<div class="flex items-center justify-between py-2 border-b border-white/[0.04]">
										<div class="flex items-center gap-2.5">
											<div class="w-3.5 h-3.5 rounded-full bg-white/10" />
											<div class="flex items-center gap-1.5">
												<div class="w-10 h-5 rounded bg-[#0098EA]/15" />
												<div class="w-20 h-5 rounded bg-white/10" />
											</div>
										</div>
										<div class="w-16 h-5 rounded bg-white/10" />
										<div class="w-8 h-5 rounded bg-white/10" />
										<div class="w-24 h-5 rounded bg-white/10" />
									</div>
								)}
							</For>
						</div>
					}
				>
					<Show
						when={(numbersQuery.data?.items || []).length > 0}
						fallback={
							<div class="p-12 text-center space-y-2">
								<span class="material-symbols-outlined text-4xl text-white/20">search_off</span>
								<p class="text-xs text-white/60 font-bold">
									{t('numbers.noNumbersFound') || 'No numbers matching the filters'}
								</p>
								<button
									type="button"
									onClick={resetFilters}
									class="text-xs text-[#0098EA] font-extrabold hover:underline pt-2"
								>
									Clear filters
								</button>
							</div>
						}
					>
						{/* Table */}
						<div class="overflow-x-auto">
							<table class="w-full text-left border-collapse min-w-[460px]">
								<thead>
									<tr class="border-b border-white/[0.08] bg-white/[0.02] text-[10px] font-black text-white/40 uppercase tracking-wider">
										<th class="py-3 px-4">{t('numbers.colNumber') || 'Number'}</th>
										<th class="py-3 px-4 text-center">{t('numbers.colLastSaleBid') || 'Last Sale / Bid'}</th>
										<th class="py-3 px-4 text-center">{t('numbers.colOwners') || 'Owners'}</th>
										<th class="py-3 px-4 text-right">{t('numbers.colCurrentOwner') || 'Current Owner'}</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-white/[0.04] text-xs">
									<For each={numbersQuery.data?.items || []}>
										{(item) => (
											<tr
												onClick={() => props.onSelectNumber?.(item.number)}
												class="hover:bg-white/[0.06] active:bg-white/[0.09] transition-colors group cursor-pointer"
											>
												{/* Number & Color */}
												<td class="py-3 px-4">
													<div class="flex items-center gap-2.5">
														<span
															class="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm border border-white/30"
															style={{
																background: item.color_hex?.startsWith('#')
																	? item.color_hex
																	: `#${item.color_hex || '0098EA'}`,
															}}
															title={item.color_name}
														/>
														<div class="flex flex-col">
															<div class="font-mono flex items-center text-left">
																{(() => {
																	const p = splitNumberPrefix(item.display_number || item.number);
																	return (
																		<div class="flex items-center gap-1.5 font-mono">
																			<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#0098EA]/15 text-[#0098EA] border border-[#0098EA]/30 shrink-0 select-none">
																				+888
																			</span>
																			<span class="font-black text-white text-xs tracking-wider group-hover:text-[#0098EA] transition-colors">
																				{p.body || p.rawDigits}
																			</span>
																			<Show when={item.is_restricted}>
																				<span
																					class="text-[9px] px-1 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-sans leading-none flex items-center"
																					title="Restricted / Banned on Telegram"
																				>
																					<span class="material-symbols-outlined text-[10px]">warning</span>
																				</span>
																			</Show>
																		</div>
																	);
																})()}
															</div>
															<div class="flex items-center gap-1.5 mt-0.5">
																<a
																	href={item.market_url}
																	target="_blank"
																	rel="noreferrer"
																	onClick={(e) => e.stopPropagation()}
																	class="text-[9px] font-bold text-white/40 hover:text-[#0098EA] transition-colors flex items-center gap-0.5"
																>
																	<span class="material-symbols-outlined text-[10px]">open_in_new</span>
																	<span>{item.source === 'getgems' ? 'Getgems' : 'Fragment'}</span>
																</a>
															</div>
														</div>
													</div>
												</td>

												{/* Last Sale / Current Bid */}
												<td class="py-3 px-4 text-center">
													<Show
														when={item.current_bid_ton}
														fallback={
															<>
																<div class="font-black text-white font-mono flex items-center justify-center gap-1.5">
																	<span class="w-1.5 h-1.5 rounded-full bg-[#0098EA]" />
																	<span>{formatTon(item.last_sale_ton)}</span>
																</div>
																<div class="text-[10px] text-white/40 mt-0.5 hover:text-white transition-colors">
																	{item.last_sale_date}
																</div>
															</>
														}
													>
														<div class="font-black text-amber-400 font-mono flex items-center justify-center gap-1">
															<span class="material-symbols-outlined text-[13px]">bolt</span>
															<span>{formatTon(item.current_bid_ton)} TON</span>
														</div>
														<div class="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mt-0.5">
															{t('numbers.liveBid') || 'Live Bid'}
														</div>
													</Show>
												</td>

												{/* Owners count */}
												<td class="py-3 px-4 text-center font-bold text-white/70 font-mono">
													{item.owners_count}
												</td>

												{/* Current Owner Address */}
												<td class="py-3 px-4 text-right">
													<div class="flex items-center justify-end gap-1.5">
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																props.onViewOwnerPortfolio?.(item.current_owner);
															}}
															class="font-mono text-[11px] text-white/60 hover:text-[#0098EA] underline decoration-dotted transition-colors max-w-[120px] sm:max-w-none truncate"
															title={t('numbers.viewPortfolio') || 'View Portfolio'}
														>
															{item.current_owner.length > 15
																? `${item.current_owner.slice(0, 6)}...${item.current_owner.slice(-6)}`
																: item.current_owner}
														</button>
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																handleCopy(item.current_owner);
															}}
															class="text-white/30 hover:text-white transition-colors p-1"
															title={t('numbers.copyAddress') || 'Copy address'}
														>
															<span class="material-symbols-outlined text-xs">
																{copiedAddress() === item.current_owner ? 'check' : 'content_copy'}
															</span>
														</button>
													</div>
												</td>
											</tr>
										)}
									</For>
								</tbody>
							</table>
						</div>

						{/* Advanced Pagination & Quick Jump */}
						<div class="p-4 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
							{/* Page Navigation Buttons */}
							<div class="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
								{/* First Page */}
								<button
									type="button"
									disabled={filters().page <= 1}
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setFilters((prev) => ({ ...prev, page: 1 }));
									}}
									class="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-20 disabled:pointer-events-none font-bold text-white transition-all text-xs flex items-center justify-center"
									title={t('numbers.firstPage') || 'First page'}
								>
									<span class="material-symbols-outlined text-sm">first_page</span>
								</button>
								{/* Prev Page */}
								<button
									type="button"
									disabled={filters().page <= 1}
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }));
									}}
									class="h-7 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-20 disabled:pointer-events-none font-bold text-white transition-all text-xs flex items-center gap-1"
								>
									<span class="material-symbols-outlined text-sm">chevron_left</span>
									<span>{t('numbers.prevPage') || 'Prev'}</span>
								</button>

								{/* Page Number Pills */}
								<For each={getPagePills()}>
									{(p) => {
										if (typeof p === 'string') {
											return <span class="px-1.5 text-white/30 font-mono">...</span>;
										}
										const isCur = () => filters().page === p;
										return (
											<button
												type="button"
												onClick={() => {
													try {
														haptic.selection();
													} catch {}
													setFilters((prev) => ({ ...prev, page: p }));
												}}
												class={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
													isCur()
														? 'bg-[#0098EA] border-[#0098EA] text-white shadow-md'
														: 'bg-white/[0.03] border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.08]'
												}`}
											>
												{p}
											</button>
										);
									}}
								</For>

								{/* Next Page */}
								<button
									type="button"
									disabled={filters().page >= (numbersQuery.data?.totalPages || 1)}
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setFilters((prev) => ({ ...prev, page: prev.page + 1 }));
									}}
									class="h-7 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-20 disabled:pointer-events-none font-bold text-white transition-all text-xs flex items-center gap-1"
								>
									<span>{t('numbers.nextPage') || 'Next'}</span>
									<span class="material-symbols-outlined text-sm">chevron_right</span>
								</button>
								{/* Last Page */}
								<button
									type="button"
									disabled={filters().page >= (numbersQuery.data?.totalPages || 1)}
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										setFilters((prev) => ({ ...prev, page: numbersQuery.data?.totalPages || 1 }));
									}}
									class="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-20 disabled:pointer-events-none font-bold text-white transition-all text-xs flex items-center justify-center"
									title={t('numbers.lastPage') || 'Last page'}
								>
									<span class="material-symbols-outlined text-sm">last_page</span>
								</button>
							</div>

							{/* Jump to Page Form */}
							<form onSubmit={handleJumpPage} class="flex items-center gap-2">
								<span class="text-white/40 text-[11px]">{t('numbers.goToPage') || 'Go to:'}</span>
								<input
									type="number"
									min="1"
									max={numbersQuery.data?.totalPages || 2732}
									placeholder={String(filters().page)}
									value={jumpPageInput()}
									onInput={(e) => setJumpPageInput(e.currentTarget.value)}
									class="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center font-mono focus:outline-none focus:border-[#0098EA]"
								/>
								<button
									type="submit"
									class="px-2.5 py-1 rounded-lg bg-[#0098EA]/20 border border-[#0098EA]/40 text-[#0098EA] font-bold text-xs hover:bg-[#0098EA] hover:text-white transition-all"
								>
									➔
								</button>
							</form>
						</div>
					</Show>
				</Show>
			</div>
		</div>
	);
};
