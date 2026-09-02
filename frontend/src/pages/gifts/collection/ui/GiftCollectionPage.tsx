import { useLocation, useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { giftsApi, GiftThumbnail } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

export const GiftCollectionPage: Component = () => {
	useTelegramBackButton(-1);
	const location = useLocation();
	const navigate = useNavigate();

	const getCollectionSlug = () => {
		const params = new URLSearchParams(location.search);
		return params.get('c') || 'plush_pepe';
	};

	const slug = () => getCollectionSlug();
	const [searchQuery, setSearchQuery] = createSignal('');
	const [showSearch, setShowSearch] = createSignal(false);
	const [selectedTab, setSelectedTab] = createSignal<'models' | 'venues' | 'backdrops' | 'heatmap'>('models');
	const [copiedContract, setCopiedContract] = createSignal(false);

	const collectionsQuery = createQuery(() => ({
		queryKey: ['giftCollectionsList'],
		queryFn: () => giftsApi.listCollections(),
		staleTime: 5 * 60 * 1000,
	}));

	const intelQuery = createQuery(() => ({
		queryKey: ['giftCollectionIntel', slug()],
		queryFn: () => giftsApi.getCollectionIntel(slug()),
		staleTime: 60 * 1000,
		enabled: !!slug(),
	}));

	const data = () => intelQuery.data;

	const filteredCollections = createMemo(() => {
		const q = searchQuery().toLowerCase().trim();
		const list = collectionsQuery.data || [];
		if (!q) return list;
		return list.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
	});

	const selectCollection = (newSlug: string) => {
		navigate(`/gifts/collection?c=${newSlug}`, { replace: true });
		setShowSearch(false);
		setSearchQuery('');
		try {
			haptic.selection();
		} catch {}
	};

	const copyContract = (addr?: string) => {
		if (!addr) return;
		try {
			navigator.clipboard.writeText(addr);
			setCopiedContract(true);
			haptic.notify('success');
			setTimeout(() => setCopiedContract(false), 2000);
		} catch {}
	};

	const fmt = (val?: number, decimals = 2) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: decimals });
	};

	const fmtUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
		if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
		return `$${val.toFixed(0)}`;
	};

	const rarityTierBadge = (permille: number) => {
		if (permille <= 1) return { label: 'Mythic', bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
		if (permille <= 5) return { label: 'Legendary', bg: 'bg-[#0098EA]/20 text-[#0098EA] border-[#0098EA]/35' };
		if (permille <= 20) return { label: 'Epic', bg: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
		if (permille <= 50) return { label: 'Rare', bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
		if (permille <= 150) return { label: 'Uncommon', bg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' };
		return { label: 'Common', bg: 'bg-white/5 text-white/50 border-white/10' };
	};

	return (
		<div class="pb-36 bg-[#030303] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[380px] bg-gradient-to-b from-[#0098EA]/15 via-transparent to-transparent blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				<div class="flex items-center justify-between mb-4">
					<div class="flex items-center gap-3">
						<button
							type="button"
							onClick={() => navigate(-1)}
							class="w-10 h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95"
						>
							<span class="material-symbols-outlined text-xl rtl:rotate-180">arrow_back</span>
						</button>
						<div>
							<h1 class="text-base font-black tracking-tight text-white flex items-center gap-2">
								<span>{data()?.collection_name || t('gifts.giftCollection')}</span>
								<span class="text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-[#0098EA]/15 text-[#0098EA] border border-[#0098EA]/30">
									TEP-62
								</span>
							</h1>
							<p class="text-[11px] font-medium text-white/40">{t('gifts.collectionSubtitle')}</p>
						</div>
					</div>

					<button
						type="button"
						onClick={() => {
							setShowSearch(!showSearch());
							setSearchQuery('');
							try {
								haptic.impact('light');
							} catch {}
						}}
						class="w-10 h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95"
					>
						<span class="material-symbols-outlined text-lg">{showSearch() ? 'close' : 'search'}</span>
					</button>
				</div>

				<Show when={showSearch()}>
					<div class="mb-5 bg-[#12141C] border border-white/10 rounded-3xl p-4 shadow-2xl space-y-3">
						<div class="relative">
							<span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-lg">search</span>
							<input
								type="text"
								value={searchQuery()}
								onInput={(e) => setSearchQuery(e.currentTarget.value)}
								placeholder={t('gifts.searchPlaceholder')}
								class="w-full pl-11 pr-4 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-white text-xs font-medium placeholder:text-white/30 focus:outline-none focus:border-[#0098EA]/50 transition-all"
								autofocus
							/>
						</div>

						<div class="max-h-[260px] overflow-y-auto space-y-1.5 scrollbar-thin">
							<For each={filteredCollections()}>
								{(coll) => (
									<button
										type="button"
										onClick={() => selectCollection(coll.slug)}
										class={`w-full flex items-center gap-3 p-2.5 rounded-2xl border transition-all active:scale-[0.98] ${
											slug() === coll.slug
												? 'bg-[#0098EA]/15 border-[#0098EA]/40 text-white'
												: 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.04] text-white/80'
										}`}
									>
										<GiftThumbnail slug={coll.slug} name={coll.name} size="sm" class="w-9 h-9 rounded-xl" />
										<div class="flex-1 text-left rtl:text-right min-w-0">
											<div class="text-xs font-bold truncate text-white">{coll.name}</div>
											<div class="text-[10px] text-white/40 font-medium">
												{t('gifts.supplyPrefix')} {coll.total_supply.toLocaleString()} · ⭐ {fmt(coll.floor_gram)} TON
											</div>
										</div>
										<span class="material-symbols-outlined text-white/30 text-base rtl:rotate-180">chevron_right</span>
									</button>
								)}
							</For>
						</div>
					</div>
				</Show>

				<Show when={intelQuery.isLoading}>
					<div class="space-y-4">
						<div class="h-44 bg-[#12141C]/60 rounded-3xl animate-pulse" />
						<div class="grid grid-cols-3 gap-2.5">
							<div class="h-20 bg-[#12141C]/60 rounded-2xl animate-pulse" />
							<div class="h-20 bg-[#12141C]/60 rounded-2xl animate-pulse" />
							<div class="h-20 bg-[#12141C]/60 rounded-2xl animate-pulse" />
						</div>
						<div class="h-64 bg-[#12141C]/60 rounded-3xl animate-pulse" />
					</div>
				</Show>

				<Show when={data() && !intelQuery.isLoading}>
					<div class="bg-gradient-to-br from-[#12141C] to-[#0A0D14] border border-white/[0.08] rounded-3xl p-5 mb-3.5 shadow-xl relative overflow-hidden space-y-4">
						<div class="flex items-center gap-4">
							<div class="relative w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-2 flex items-center justify-center shrink-0 shadow-lg">
								<GiftThumbnail slug={slug()} name={data()!.collection_name} size="lg" class="w-full h-full object-contain" />
							</div>

							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<h2 class="text-lg font-black text-white truncate">{data()!.collection_name}</h2>
								</div>
								<div class="flex flex-wrap gap-1.5 mb-2">
									<Show when={data()!.is_limited}>
										<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
											{t('gifts.limited')}
										</span>
									</Show>
									<Show when={!data()!.is_limited}>
										<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
											{t('gifts.standard')}
										</span>
									</Show>
									<Show when={data()!.is_craftable}>
										<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">
											{t('gifts.craftable')}
										</span>
									</Show>
								</div>
								<div class="text-[11px] text-white/50 flex items-center gap-2 font-medium">
									<span>{t('gifts.totalSupplyLabel')} <strong class="text-white">{data()!.total_supply.toLocaleString()}</strong></span>
									<span class="w-[1px] h-3 bg-white/10" />
									<span class="text-emerald-400 font-bold">
										{t('gifts.onChainUpgrades', { count: data()!.upgraded_count.toLocaleString() })}
									</span>
								</div>
							</div>
						</div>

						<div class="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06] text-xs">
							<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-2.5 text-center">
								<span class="text-[9px] text-white/40 uppercase block font-bold mb-0.5">{t('gifts.uniqueModels')}</span>
								<span class="font-mono font-black text-white text-sm">{data()!.total_models || data()!.model_floors.length}</span>
							</div>
							<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-2.5 text-center">
								<span class="text-[9px] text-white/40 uppercase block font-bold mb-0.5">{t('gifts.backdrops')}</span>
								<span class="font-mono font-black text-sky-400 text-sm">{data()!.total_backdrops || 60}</span>
							</div>
							<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-2.5 text-center">
								<span class="text-[9px] text-white/40 uppercase block font-bold mb-0.5">{t('gifts.symbolsPatterns')}</span>
								<span class="font-mono font-black text-amber-400 text-sm">{data()!.total_symbols || 200}</span>
							</div>
						</div>

						<div class="bg-black/40 border border-white/[0.06] rounded-2xl p-3 flex items-center justify-between text-xs">
							<div class="min-w-0 flex-1 pr-2 rtl:pr-0 rtl:pl-2">
								<span class="text-[9px] uppercase font-bold text-white/40 block">{t('gifts.contractId')}</span>
								<span class="font-mono text-white/70 text-[11px] block truncate mt-0.5">
									{data()!.contract_address || t('gifts.contractNotRegistered')}
								</span>
							</div>
							<Show when={data()!.contract_address}>
								<div class="flex items-center gap-1.5 shrink-0">
									<button
										type="button"
										onClick={() => copyContract(data()!.contract_address)}
										class="px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-[10px] font-bold flex items-center gap-1 transition-all"
									>
										<span class="material-symbols-outlined text-xs">
											{copiedContract() ? 'check' : 'content_copy'}
										</span>
										<span>{copiedContract() ? t('gifts.copied') : t('gifts.copy')}</span>
									</button>
									<a
										href={`https://tonviewer.com/${data()!.contract_address}`}
										target="_blank"
										rel="noopener noreferrer"
										class="px-2.5 py-1.5 rounded-xl bg-[#0098EA]/15 hover:bg-[#0098EA]/25 text-[#0098EA] border border-[#0098EA]/30 text-[10px] font-bold flex items-center gap-1 transition-all"
									>
										<span>TonViewer</span>
										<span class="material-symbols-outlined text-xs">open_in_new</span>
									</a>
								</div>
							</Show>
						</div>
					</div>

					<div class="grid grid-cols-3 gap-2.5 mb-4">
						<div class="bg-[#12141C]/90 border border-white/[0.06] rounded-2xl p-3 text-center">
							<span class="text-[9px] uppercase font-bold text-white/40 block mb-1">{t('gifts.floorPrice')}</span>
							<div class="text-base font-black text-white font-mono">{fmt(data()!.best_floor_gram)} TON</div>
							<span class="text-[10px] text-white/40 font-mono block mt-0.5">{fmtUsd(data()!.best_floor_usd)}</span>
						</div>

						<div class="bg-[#12141C]/90 border border-white/[0.06] rounded-2xl p-3 text-center">
							<span class="text-[9px] uppercase font-bold text-white/40 block mb-1">{t('gifts.volume24h')}</span>
							<div class="text-base font-black text-white font-mono">{fmtUsd(data()!.volume_24h_usd)}</div>
							<span class="text-[10px] text-white/40 font-mono block mt-0.5">{fmt(data()!.volume_24h_gram, 0)} TON</span>
						</div>

						<div class="bg-[#12141C]/90 border border-white/[0.06] rounded-2xl p-3 text-center">
							<span class="text-[9px] uppercase font-bold text-white/40 block mb-1">{t('gifts.marketCap')}</span>
							<div class="text-base font-black text-white font-mono">{fmtUsd(data()!.market_cap_usd)}</div>
							<span class="text-[10px] text-emerald-400 font-bold block mt-0.5">{t('gifts.activeItemsCount', { count: data()!.listed_count })}</span>
						</div>
					</div>

					<div class="flex items-center gap-1.5 p-1 bg-[#12141C]/80 border border-white/[0.06] rounded-2xl mb-4 overflow-x-auto scrollbar-none">
						<button
							type="button"
							onClick={() => {
								setSelectedTab('models');
								try {
									haptic.impact('light');
								} catch {}
							}}
							class={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap text-center ${
								selectedTab() === 'models'
									? 'bg-[#0098EA] text-white shadow-lg shadow-[#0098EA]/30'
									: 'text-white/50 hover:text-white hover:bg-white/[0.03]'
							}`}
						>
							{t('gifts.tabModels')} ({data()!.model_floors.length})
						</button>

						<button
							type="button"
							onClick={() => {
								setSelectedTab('venues');
								try {
									haptic.impact('light');
								} catch {}
							}}
							class={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap text-center ${
								selectedTab() === 'venues'
									? 'bg-[#0098EA] text-white shadow-lg shadow-[#0098EA]/30'
									: 'text-white/50 hover:text-white hover:bg-white/[0.03]'
							}`}
						>
							{t('gifts.tabVenues')}
						</button>

						<button
							type="button"
							onClick={() => {
								setSelectedTab('backdrops');
								try {
									haptic.impact('light');
								} catch {}
							}}
							class={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap text-center ${
								selectedTab() === 'backdrops'
									? 'bg-[#0098EA] text-white shadow-lg shadow-[#0098EA]/30'
									: 'text-white/50 hover:text-white hover:bg-white/[0.03]'
							}`}
						>
							{t('gifts.tabBackdrops')}
						</button>

						<button
							type="button"
							onClick={() => {
								setSelectedTab('heatmap');
								try {
									haptic.impact('light');
								} catch {}
							}}
							class={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap text-center ${
								selectedTab() === 'heatmap'
									? 'bg-[#0098EA] text-white shadow-lg shadow-[#0098EA]/30'
									: 'text-white/50 hover:text-white hover:bg-white/[0.03]'
							}`}
						>
							{t('gifts.tabHeatmap')}
						</button>
					</div>

					<Show when={selectedTab() === 'models'}>
						<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-3xl p-4 shadow-xl mb-4 space-y-2">
							<div class="flex items-center justify-between pb-2 mb-1 border-b border-white/[0.06]">
								<h3 class="text-xs font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-base">grid_view</span>
									<span>{t('gifts.registeredModelsList')}</span>
								</h3>
								<span class="text-[10px] text-white/40 font-medium">{t('gifts.clickModelHint')}</span>
							</div>

							<div class="divide-y divide-white/[0.04]">
								<For each={data()!.model_floors}>
									{(model, i) => {
										const tier = rarityTierBadge(model.rarity_permille);
										return (
											<button
												type="button"
												onClick={() => {
													navigate(`/gifts/report?g=${slug()}-${i() + 1}`);
													try {
														haptic.impact('light');
													} catch {}
												}}
												class="w-full flex items-center gap-3 py-3 hover:bg-white/[0.03] rounded-2xl px-2 transition-all active:scale-[0.99] text-left rtl:text-right"
											>
												<span class="text-xs font-mono font-bold text-white/30 w-5 shrink-0 text-center">
													#{i() + 1}
												</span>

												<div class="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-1 flex items-center justify-center shrink-0">
													<GiftThumbnail slug={slug()} name={model.model_name} model={model.model_name} size="sm" class="w-full h-full object-contain" />
												</div>

												<div class="flex-1 min-w-0">
													<div class="flex items-center gap-1.5">
														<span class="text-xs font-bold text-white truncate">{model.model_name}</span>
														<Show when={model.custom_emoji_id}>
															<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-[#0098EA]/15 text-[#0098EA] border border-[#0098EA]/30 font-mono shrink-0" title={`TG Custom Emoji ID: ${model.custom_emoji_id}`}>
																TG Emoji
															</span>
														</Show>
													</div>
													<div class="text-[10px] text-white/40 flex items-center gap-2 mt-0.5">
														<span>{t('gifts.supplyPrefix')} {model.total_supply.toLocaleString()}</span>
														<span class="w-[1px] h-2.5 bg-white/10" />
														<span>{t('gifts.rarityPrefix')} {(model.rarity_permille / 10).toFixed(1)}%</span>
													</div>
												</div>

												<div class="text-right rtl:text-left shrink-0">
													<div class="text-xs font-black text-white font-mono">
														{fmt(model.floor_gram)} TON
													</div>
													<span class={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border inline-block mt-0.5 ${tier.bg}`}>
														{tier.label}
													</span>
												</div>
											</button>
										);
									}}
								</For>
							</div>
						</div>
					</Show>

					<Show when={selectedTab() === 'venues'}>
						<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-3xl p-4 shadow-xl mb-4 space-y-3">
							<div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
								<h3 class="text-xs font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-base">storefront</span>
									<span>{t('gifts.venueFloorTitle')}</span>
								</h3>
							</div>

							<div class="space-y-2">
								<For each={data()!.venue_floors}>
									{(venue) => (
										<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3 flex items-center justify-between text-xs">
											<div class="flex items-center gap-2.5">
												<div class="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center font-bold text-white text-xs">
													{venue.venue_name.slice(0, 2).toUpperCase()}
												</div>
												<div>
													<div class="flex items-center gap-1.5">
														<span class="font-bold text-white">{venue.venue_name}</span>
														<Show when={venue.is_on_chain}>
															<span class="text-[8px] font-bold px-1 rounded bg-sky-500/15 text-sky-300">
																On-Chain
															</span>
														</Show>
													</div>
													<span class="text-[10px] text-white/40">{t('gifts.venueFeePrefix')} {venue.fee_pct}%</span>
												</div>
											</div>

											<div class="text-right rtl:text-left">
												<div class="font-black text-white font-mono">
													⭐ {fmt(venue.floor_gram)} TON
												</div>
												<span class="text-[10px] text-emerald-400 font-mono font-medium block">
													{t('gifts.netPayoutPrefix')} {fmt(venue.net_payout_gram)} TON
												</span>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>
					</Show>

					<Show when={selectedTab() === 'backdrops'}>
						<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-3xl p-4 shadow-xl mb-4 space-y-3">
							<div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
								<h3 class="text-xs font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-base">palette</span>
									<span>{t('gifts.colorBackdropsPalette')}</span>
								</h3>
							</div>

							<div class="grid grid-cols-1 gap-2">
								<For each={data()!.backdrops_list || []}>
									{(bd) => (
										<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3 flex items-center justify-between">
											<div class="flex items-center gap-3">
												<div class="flex items-center -space-x-1.5 rtl:space-x-reverse">
													<div class="w-5 h-5 rounded-full border border-black/40 shadow-sm" style={{ 'background-color': bd.center_hex }} title="Center" />
													<div class="w-5 h-5 rounded-full border border-black/40 shadow-sm" style={{ 'background-color': bd.edge_hex }} title="Edge" />
													<div class="w-5 h-5 rounded-full border border-black/40 shadow-sm" style={{ 'background-color': bd.pattern_hex }} title="Pattern" />
													<div class="w-5 h-5 rounded-full border border-black/40 shadow-sm" style={{ 'background-color': bd.text_hex }} title="Text" />
												</div>
												<div>
													<span class="text-xs font-bold text-white block">{bd.name}</span>
													<span class="text-[9px] font-mono text-white/40 block">
														{bd.center_hex} · {bd.edge_hex}
													</span>
												</div>
											</div>
											<span class="text-[10px] font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
												{(bd.rarity_permille / 10).toFixed(1)}%
											</span>
										</div>
									)}
								</For>
							</div>
						</div>
					</Show>

					<Show when={selectedTab() === 'heatmap'}>
						<div class="bg-[#12141C]/80 border border-white/[0.06] rounded-3xl p-4 shadow-xl mb-4 space-y-3">
							<div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
								<h3 class="text-xs font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[#0098EA] text-base">heat_pump</span>
									<span>{t('gifts.rarityHeatmapTitle')}</span>
								</h3>
							</div>

							<div class="space-y-2">
								<For each={data()!.rarity_heatmap.slice(0, 15)}>
									{(cell) => (
										<div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-3 flex items-center justify-between text-xs">
											<div>
												<span class="font-bold text-white block truncate">{cell.model_name}</span>
												<span class="text-[10px] text-white/40 block mt-0.5">{t('gifts.backdropPrefix')} {cell.backdrop_name}</span>
											</div>

											<div class="text-right rtl:text-left shrink-0">
												<span class="font-mono font-black text-white block">⭐ {fmt(cell.floor_gram)} TON</span>
												<span class="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 inline-block mt-0.5">
													{cell.rarity_tier}
												</span>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>
					</Show>

					{/* ═══ 4. Dutch Upgrade Auction Clock ═══ */}
					<Show when={data()!.upgrade_ladder && data()!.upgrade_ladder.length > 0}>
						<div class="bg-gradient-to-br from-[#12141C] to-[#0D111A] border border-white/[0.06] rounded-3xl p-4 shadow-xl mb-4 space-y-3">
							<div class="flex items-center justify-between">
								<h3 class="text-xs font-black text-white flex items-center gap-1.5">
									<span class="material-symbols-outlined text-amber-400 text-base">timer</span>
									<span>{t('gifts.dutchAuctionTitle')}</span>
								</h3>
								<span class="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
									{t('gifts.staircasePriceReduction')}
								</span>
							</div>

							<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
								<For each={data()!.upgrade_ladder.slice(0, 4)}>
									{(step) => (
										<div class={`p-2.5 rounded-2xl border text-center transition-all ${
											step.is_current
												? 'bg-[#0098EA]/15 border-[#0098EA]/40 text-white'
												: 'bg-white/[0.02] border-white/[0.05] text-white/70'
										}`}>
											<span class="text-[9px] text-white/40 block font-bold">{t('gifts.stepPrefix', { step: step.step })}</span>
											<span class="font-black text-white font-mono text-xs block mt-0.5">
												{step.price_stars.toLocaleString()} ⭐
											</span>
											<span class="text-[10px] text-white/40 font-mono block">
												(≈ {fmt(step.price_gram)} TON)
											</span>
										</div>
									)}
								</For>
							</div>
						</div>
					</Show>

					{/* ═══ 5. Footer & Official Attribution ═══ */}
					<div class="mt-6 text-center text-[10px] text-white/30 font-medium space-y-1.5 pb-4">
						<div class="flex items-center justify-center gap-2">
							<span>{t('gifts.poweredBy')}</span>
							<span>·</span>
							<span class="px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-white/50 font-bold">
								{t('gifts.thanksTo')}
							</span>
						</div>
						<p class="text-white/20">{t('gifts.officialAttribution')}</p>
					</div>
				</Show>
			</div>
		</div>
	);
};
