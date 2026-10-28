import { A, useSearchParams } from '@solidjs/router';
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Show,
} from 'solid-js';
import { giftsApi } from '../../../../entities/gifts/api/giftsApi';
import type {
	ComparableGiftSale,
	CuriosityGateData,
	EnrichedGiftReport,
	TraitActiveListingItem,
	TraitCatalogOption,
} from '../../../../entities/gifts/model/types';

function haptic(type: 'light' | 'medium' | 'heavy' = 'light') {
	try {
		const tg = (
			window as unknown as {
				Telegram?: {
					WebApp?: {
						HapticFeedback?: { impactOccurred?: (t: string) => void };
					};
				};
			}
		).Telegram?.WebApp;
		tg?.HapticFeedback?.impactOccurred?.(type);
	} catch {
		// ignore
	}
}

function formatUsd(val: number | undefined | null): string {
	const num = val ?? 0;
	if (!Number.isFinite(num)) return '$0';
	if (num >= 1000) {
		return `$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	}
	return `$${num.toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function formatTon(val: number | string | undefined | null): string {
	const num = typeof val === 'string' ? Number.parseFloat(val) : (val ?? 0);
	if (!Number.isFinite(num)) return '0';
	if (num >= 1000) {
		return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
	}
	if (num >= 10) {
		return num.toLocaleString('en-US', { maximumFractionDigits: 1 });
	}
	return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatDateFa(iso?: string): string {
	if (!iso) return 'نامشخص';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	try {
		return new Intl.DateTimeFormat('fa-IR', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		}).format(d);
	} catch {
		return d.toISOString().slice(0, 10);
	}
}

type ReportTabId = 'valuation' | 'traits' | 'ownership' | 'venues';
type HeroVisualMode = 'hd_svg' | 'fragment_webp' | 'profile_wear';
type CatalogExplorerTab = 'models' | 'backdrops' | 'symbols';

const QUICK_SAMPLE_GIFTS = [
	{ id: 'plush_pepe-42', label: 'Plush Pepe #42', tag: 'Gold Backdrop' },
	{ id: 'plush_pepe-1', label: 'Plush Pepe #1', tag: 'Genesis Grail' },
	{ id: 'durovs_cap-1', label: "Durov's Cap #1", tag: 'Crown #1' },
	{ id: 'heart_locket-7', label: 'Heart Locket #7', tag: 'Single Digit' },
	{ id: 'loot_bag-88', label: 'Loot Bag #88', tag: 'Repeating' },
	{ id: 'swiss_watch-100', label: 'Swiss Watch #100', tag: 'Floor Liquid' },
];

export function GiftReportPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const giftQueryParam = () => {
		const raw = searchParams.g;
		const val = Array.isArray(raw) ? raw[0] : raw;
		return (val || 'plush_pepe-42').trim();
	};

	const [searchInput, setSearchInput] = createSignal(giftQueryParam());
	const [activeTab, setActiveTab] = createSignal<ReportTabId>('valuation');
	const [heroMode, setHeroMode] = createSignal<HeroVisualMode>('hd_svg');
	const [gateData, setGateData] = createSignal<CuriosityGateData | null>(null);
	const [report, setReport] = createSignal<EnrichedGiftReport | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [simulating, setSimulating] = createSignal(false);
	const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
	const [copiedKey, setCopiedKey] = createSignal<string | null>(null);

	// Filters & What-If Simulator State
	const [compFilter, setCompFilter] = createSignal<
		'all' | 'exact_model' | 'exact_backdrop' | 'same_gift_history'
	>('all');
	const [orderbookFilter, setOrderbookFilter] = createSignal<
		'all' | 'model' | 'backdrop' | 'collection'
	>('all');
	const [simModel, setSimModel] = createSignal<string>('');
	const [simBackdrop, setSimBackdrop] = createSignal<string>('');
	const [simSymbol, setSimSymbol] = createSignal<string>('');
	const [catalogTab, setCatalogTab] = createSignal<CatalogExplorerTab>('models');
	const [catalogSearch, setCatalogSearch] = createSignal<string>('');
	const [watchlistSaved, setWatchlistSaved] = createSignal(false);

	let activeRequestId = 0;

	async function loadGiftIntelligence(
		targetQuery: string,
		overrideTraits?: { model?: string; backdrop?: string; symbol?: string },
	) {
		const reqId = ++activeRequestId;
		if (overrideTraits) {
			setSimulating(true);
		} else {
			setLoading(true);
			setErrorMsg(null);
		}

		try {
			if (overrideTraits) {
				const res = await fetch('/api/v1/gifts/valuate', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						gift_id: targetQuery,
						model: overrideTraits.model || undefined,
						backdrop: overrideTraits.backdrop || undefined,
						symbol: overrideTraits.symbol || undefined,
					}),
				});
				if (!res.ok) throw new Error('خطا در شبیه‌سازی تریت');
				const enriched = (await res.json()) as EnrichedGiftReport;
				if (reqId !== activeRequestId) return;
				setReport(enriched);
			} else {
				const [enrichedRes, gateRes] = await Promise.allSettled([
					giftsApi.getEnrichedReport(targetQuery),
					giftsApi.getCuriosityGate(targetQuery),
				]);

				if (reqId !== activeRequestId) return;

				if (enrichedRes.status === 'fulfilled' && enrichedRes.value) {
					const r = enrichedRes.value;
					setReport(r);
					const mBar = r.trait_dna?.find((t) => t.axis_key === 'model');
					const bBar = r.trait_dna?.find((t) => t.axis_key === 'backdrop');
					const sBar = r.trait_dna?.find((t) => t.axis_key === 'symbol');
					setSimModel(mBar?.value || r.selected_model || '');
					setSimBackdrop(bBar?.value || '');
					setSimSymbol(sBar?.value || '');
				} else {
					const unlocked = await giftsApi.unlockWithCredit(targetQuery);
					if (reqId !== activeRequestId) return;
					setReport(unlocked as EnrichedGiftReport);
				}

				if (gateRes.status === 'fulfilled' && gateRes.value) {
					setGateData(gateRes.value);
				}
			}
		} catch (err) {
			if (reqId !== activeRequestId) return;
			setErrorMsg(
				err instanceof Error
					? err.message
					: 'خطا در دریافت اطلاعات زنده گیفت از شبکه TON و فرگمنت',
			);
		} finally {
			if (reqId === activeRequestId) {
				setLoading(false);
				setSimulating(false);
			}
		}
	}

	createEffect(() => {
		const q = giftQueryParam();
		setSearchInput(q);
		void loadGiftIntelligence(q);
	});

	function handleSearchSubmit(e: Event) {
		e.preventDefault();
		const trimmed = searchInput().trim();
		if (!trimmed) return;
		haptic('medium');
		setSearchParams({ g: trimmed });
	}

	function selectPresetGift(id: string) {
		haptic('light');
		setSearchInput(id);
		setSearchParams({ g: id });
	}

	function applyTraitSimulation() {
		haptic('medium');
		void loadGiftIntelligence(giftQueryParam(), {
			model: simModel(),
			backdrop: simBackdrop(),
			symbol: simSymbol(),
		});
	}

	function simulateSingleCatalogItem(
		axis: CatalogExplorerTab,
		traitName: string,
	) {
		haptic('medium');
		if (axis === 'models') setSimModel(traitName);
		if (axis === 'backdrops') setSimBackdrop(traitName);
		if (axis === 'symbols') setSimSymbol(traitName);
		void loadGiftIntelligence(giftQueryParam(), {
			model: axis === 'models' ? traitName : simModel(),
			backdrop: axis === 'backdrops' ? traitName : simBackdrop(),
			symbol: axis === 'symbols' ? traitName : simSymbol(),
		});
	}

	function resetTraitSimulation() {
		haptic('light');
		void loadGiftIntelligence(giftQueryParam());
	}

	function copyToClipboard(text: string, key: string) {
		haptic('light');
		navigator.clipboard?.writeText(text).catch(() => {});
		setCopiedKey(key);
		setTimeout(() => {
			if (copiedKey() === key) setCopiedKey(null);
		}, 1800);
	}

	async function handleAddToWatchlist() {
		const r = report();
		if (!r) return;
		haptic('medium');
		try {
			await giftsApi.toggleWatchlist(r.gift_id, true);
			setWatchlistSaved(true);
			setTimeout(() => setWatchlistSaved(false), 3000);
		} catch {
			setWatchlistSaved(true);
		}
	}

	const modelTrait = createMemo(() =>
		report()?.trait_dna?.find((t) => t.axis_key === 'model'),
	);
	const backdropTrait = createMemo(() =>
		report()?.trait_dna?.find((t) => t.axis_key === 'backdrop'),
	);
	const symbolTrait = createMemo(() =>
		report()?.trait_dna?.find((t) => t.axis_key === 'symbol'),
	);

	const filteredComps = createMemo<ComparableGiftSale[]>(() => {
		const all = report()?.comps || [];
		const f = compFilter();
		if (f === 'all') return all;
		return all.filter((c) => c.trait_match_type === f);
	});

	const filteredOrderbook = createMemo<TraitActiveListingItem[]>(() => {
		const all = report()?.trait_active_listings || [];
		const f = orderbookFilter();
		if (f === 'all') return all;
		return all.filter((item) => item.trait_axis === f);
	});

	const filteredCatalogItems = createMemo<TraitCatalogOption[]>(() => {
		const cat = report()?.collection_catalog;
		if (!cat) return [];
		const tab = catalogTab();
		const list =
			tab === 'models'
				? cat.models
				: tab === 'backdrops'
					? cat.backdrops
					: cat.symbols;
		const q = catalogSearch().trim().toLowerCase();
		const filtered = q
			? list.filter((it) => it.name.toLowerCase().includes(q))
			: list;
		return [...filtered].sort((a, b) => a.rarity_pct - b.rarity_pct);
	});

	// SVG Price Trajectory Points from settled comps
	const chartPoints = createMemo(() => {
		const comps = [...(report()?.comps || [])]
			.filter((c) => c.sale_price_gram > 0)
			.reverse();
		if (comps.length < 2) return null;
		const prices = comps.map((c) => c.sale_price_gram);
		const fair = report()?.pillars?.fair_value_gram || prices[prices.length - 1];
		const colFloor =
			report()?.floor_matrix?.collection_floor_gram || Math.min(...prices);
		const allVals = [...prices, fair, colFloor];
		const minVal = Math.min(...allVals) * 0.92;
		const maxVal = Math.max(...allVals) * 1.08;
		const span = Math.max(1, maxVal - minVal);

		const width = 640;
		const height = 180;
		const padX = 28;
		const padY = 22;

		const pts = comps.map((c, idx) => {
			const x =
				padX +
				(idx / Math.max(1, comps.length - 1)) * (width - padX * 2);
			const y =
				height -
				padY -
				((c.sale_price_gram - minVal) / span) * (height - padY * 2);
			return {
				x: Math.round(x * 10) / 10,
				y: Math.round(y * 10) / 10,
				price: c.sale_price_gram,
				serial: c.serial_number,
				type: c.trait_match_type,
				date: formatDateFa(c.sale_date),
			};
		});

		const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
		const areaPath = `M ${pts[0].x},${height - padY} L ${pts
			.map((p) => `${p.x},${p.y}`)
			.join(' L ')} L ${pts[pts.length - 1].x},${height - padY} Z`;

		const fairY =
			height - padY - ((fair - minVal) / span) * (height - padY * 2);
		const floorY =
			height - padY - ((colFloor - minVal) / span) * (height - padY * 2);

		return {
			width,
			height,
			pts,
			polyline,
			areaPath,
			fairY: Math.max(padY, Math.min(height - padY, fairY)),
			floorY: Math.max(padY, Math.min(height - padY, floorY)),
			fair,
			colFloor,
		};
	});

	return (
		<div
			dir="rtl"
			class="min-h-screen bg-[#070b14] text-slate-100 pb-28 font-sans selection:bg-cyan-500/30"
		>
			{/* Top Institutional Navigation & Live Gift Switcher */}
			<header class="sticky top-0 z-30 border-b border-white/[0.08] bg-[#070b14]/92 backdrop-blur-xl">
				<div class="mx-auto max-w-5xl px-4 sm:px-6 py-3">
					<div class="flex flex-wrap items-center justify-between gap-3 mb-2.5">
						<div class="flex items-center gap-4 text-xs">
							<A
								href="/gifts"
								class="font-semibold text-slate-300 hover:text-white hover:underline transition"
							>
								→ ترمینال بازار گیفت‌ها
							</A>
							<span class="text-slate-600" aria-hidden="true">
								/
							</span>
							<Show when={report()?.collection_id}>
								<A
									href={`/gifts/collection?c=${report()?.collection_id}`}
									class="font-semibold text-cyan-300 hover:text-cyan-200 hover:underline transition"
								>
									تحلیل کلکسیون {report()?.display_title.replace(/#\d+$/, '')}
								</A>
								<span class="text-slate-600" aria-hidden="true">
									/
								</span>
							</Show>
							<A
								href="/gifts/portfolio"
								class="font-semibold text-slate-400 hover:text-slate-200 hover:underline transition"
							>
								اسکنر پورتفوی نهنگ‌ها
							</A>
						</div>

						<div class="flex items-center gap-2 text-xs text-slate-400">
							<span>خوراک زنده فرگمنت و TonAPI</span>
							<Show when={report()?.gram_usd_rate}>
								<span aria-hidden="true">·</span>
								<span class="font-mono text-slate-300" dir="ltr">
									1 TON = ${report()?.gram_usd_rate.toFixed(2)}
								</span>
							</Show>
							<Show when={gateData()?.signals_analyzed}>
								<span aria-hidden="true">·</span>
								<span>{gateData()?.signals_analyzed} سیگنال زنجیره‌ای</span>
							</Show>
						</div>
					</div>

					{/* Search Input Bar */}
					<form onSubmit={handleSearchSubmit} class="flex items-center gap-2">
						<div class="relative flex-1">
							<input
								type="text"
								dir="ltr"
								value={searchInput()}
								onInput={(e) => setSearchInput(e.currentTarget.value)}
								placeholder="plush_pepe-42, durovs_cap-1, or t.me/nft/PlushPepe-42"
								class="w-full rounded-xl border border-white/15 bg-slate-900/90 px-3.5 py-2 text-xs sm:text-sm font-mono text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
							/>
						</div>
						<button
							type="submit"
							class="rounded-xl bg-gradient-to-l from-cyan-500 to-blue-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-95 transition shrink-0 cursor-pointer"
						>
							کالبدشکافی گیفت
						</button>
					</form>

					{/* Quick Sample Gift Switcher (Functional Interactive Buttons) */}
					<div class="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
						<span class="text-[11px] text-slate-500 shrink-0 ml-1">
							نمونه‌های زنده:
						</span>
						<For each={QUICK_SAMPLE_GIFTS}>
							{(item) => {
								const isActive = () =>
									giftQueryParam().toLowerCase().replace(/-/g, '_') ===
									item.id.toLowerCase().replace(/-/g, '_');
								return (
									<button
										type="button"
										onClick={() => selectPresetGift(item.id)}
										class={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-mono transition shrink-0 cursor-pointer ${
											isActive()
												? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200 font-bold'
												: 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'
										}`}
									>
										<span>{item.label}</span>
										<span class="text-[10px] text-slate-400">· {item.tag}</span>
									</button>
								);
							}}
						</For>
					</div>
				</div>
			</header>

			<main class="mx-auto max-w-5xl px-4 sm:px-6 pt-5 space-y-5">
				{/* Loading State */}
				<Show when={loading()}>
					<div class="rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center space-y-4">
						<div class="mx-auto h-12 w-12 rounded-2xl border-2 border-cyan-400 border-t-transparent animate-spin" />
						<div class="text-sm font-bold text-white">
							در حال استخراج زنده کف قیمت مدل، پس‌زمینه، سابقه معاملات فرگمنت و کیف‌پول مالک...
						</div>
						<div class="text-xs text-slate-400 font-mono" dir="ltr">
							t.me/nft · nft.fragment.com · fragment.com/gifts · api.changes.tg · tonapi.io
						</div>
					</div>
				</Show>

				{/* Error State */}
				<Show when={!loading() && errorMsg()}>
					<div class="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-5 text-center space-y-3">
						<div class="text-sm font-bold text-rose-300">{errorMsg()}</div>
						<button
							type="button"
							onClick={() => void loadGiftIntelligence(giftQueryParam())}
							class="rounded-xl bg-rose-500/20 border border-rose-400/40 px-4 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/30 cursor-pointer"
						>
							تلاش مجدد
						</button>
					</div>
				</Show>

				{/* Main Loaded Report */}
				<Show when={!loading() && report()}>
					{(rep) => {
						const fm = () => rep().floor_matrix;
						const bg = () =>
							rep().backdrop_colors || {
								center_hex: '#3b82f6',
								edge_hex: '#1e3a8a',
								pattern_hex: '#0f172a',
								text_hex: '#f8fafc',
							};
						const isListedForSale = () =>
							rep().owner_intelligence?.live_listing_type === 'sale' &&
							(rep().owner_intelligence?.live_listing_price_gram || 0) > 0;

						return (
							<>
								{/* ═══════════════════════════════════════════════════════════
								    HERO SECTION: 3-Mode Interactive Gift Showcase + 4-Floor Matrix
								   ═══════════════════════════════════════════════════════════ */}
								<section class="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-slate-900/95 to-[#0a101f] p-4 sm:p-6 shadow-2xl">
									<div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
										{/* Left/Right Column: 3-Mode Interactive Gift Visual & Profile Wear Simulator */}
										<div class="lg:col-span-4 flex flex-col justify-between space-y-2.5">
											{/* Segmented 3-Mode Visual Switcher */}
											<div class="grid grid-cols-3 gap-1 rounded-xl bg-slate-950/90 p-1 border border-white/10">
												<button
													type="button"
													onClick={() => setHeroMode('hd_svg')}
													class={`rounded-lg py-1.5 text-[11px] font-semibold transition cursor-pointer ${
														heroMode() === 'hd_svg'
															? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
															: 'text-slate-400 hover:text-white'
													}`}
												>
													مدل شفاف HD
												</button>
												<button
													type="button"
													onClick={() => setHeroMode('fragment_webp')}
													class={`rounded-lg py-1.5 text-[11px] font-semibold transition cursor-pointer ${
														heroMode() === 'fragment_webp'
															? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
															: 'text-slate-400 hover:text-white'
													}`}
												>
													کارت فرگمنت
												</button>
												<button
													type="button"
													onClick={() => setHeroMode('profile_wear')}
													class={`rounded-lg py-1.5 text-[11px] font-semibold transition cursor-pointer ${
														heroMode() === 'profile_wear'
															? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
															: 'text-slate-400 hover:text-white'
													}`}
												>
													پروفایل تلگرام
												</button>
											</div>

											{/* Mode 1 & 2: Authentic Telegram Gift Card */}
											<Show when={heroMode() !== 'profile_wear'}>
												<div
													class="flex-1 flex flex-col justify-between rounded-2xl border border-white/15 p-4 relative overflow-hidden min-h-[275px]"
													style={{
														background: `radial-gradient(circle at 50% 42%, ${bg().center_hex} 0%, ${bg().edge_hex} 100%)`,
													}}
												>
													{/* Subtle Symbol Pattern Overlay */}
													<Show when={symbolTrait()?.image_url}>
														<div
															class="pointer-events-none absolute inset-0 opacity-15"
															style={{
																'background-image': `url("${symbolTrait()?.image_url}")`,
																'background-size': '44px 44px',
																'background-repeat': 'repeat',
															}}
														/>
													</Show>

													<div class="relative z-10 flex items-center justify-between gap-2 text-xs font-mono">
														<span
															class="rounded-md px-2 py-0.5 font-bold shadow-sm"
															style={{
																color: bg().text_hex,
																background:
																	bg().pattern_hex || 'rgba(15,23,42,0.65)',
															}}
															dir="ltr"
														>
															#{rep().serial_number}
														</span>
														<span class="text-[11px] text-white/85 drop-shadow" dir="ltr">
															{rep().rarity_score} Rarity
														</span>
													</div>

													<div class="relative z-10 my-3 flex items-center justify-center">
														<Show
															when={
																heroMode() === 'hd_svg' && modelTrait()?.image_url
															}
															fallback={
																<img
																	src={
																		rep().binary_forensics?.webp_url ||
																		rep().image_url
																	}
																	alt={rep().display_title}
																	class="h-40 w-40 rounded-2xl object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.55)] transition-transform duration-300 hover:scale-105"
																/>
															}
														>
															<img
																src={modelTrait()?.image_url}
																alt={modelTrait()?.value || rep().display_title}
																class="h-40 w-40 object-contain drop-shadow-[0_16px_28px_rgba(0,0,0,0.6)] transition-transform duration-300 hover:scale-105"
																onError={() => setHeroMode('fragment_webp')}
															/>
														</Show>
													</div>

													<div class="relative z-10 rounded-xl bg-black/55 backdrop-blur-md border border-white/15 p-2.5 text-center space-y-1">
														<div
															class="text-sm font-black text-white tracking-tight"
															dir="ltr"
														>
															{rep().display_title}
														</div>
														<div class="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-slate-200">
															<span>{modelTrait()?.value}</span>
															<span aria-hidden="true">·</span>
															<span>{backdropTrait()?.value}</span>
															<span aria-hidden="true">·</span>
															<span>{symbolTrait()?.value}</span>
														</div>
													</div>
												</div>
											</Show>

											{/* Mode 3: Telegram Profile "Wear Gift" & Pinned Showcase Preview */}
											<Show when={heroMode() === 'profile_wear'}>
												<div
													class="flex-1 flex flex-col justify-between rounded-2xl border border-white/15 p-4 relative overflow-hidden min-h-[275px]"
													style={{
														background: `linear-gradient(145deg, ${bg().center_hex} 0%, ${bg().edge_hex} 65%, #090d16 100%)`,
													}}
												>
													<div class="text-[10px] text-white/75 text-center">
														شبیه‌ساز پوشیدن گیفت در پروفایل تلگرام (Telegram Wear Status)
													</div>

													{/* Simulated Telegram Profile Header */}
													<div class="my-2 flex flex-col items-center text-center space-y-2">
														<div class="relative">
															<div class="h-16 w-16 rounded-full border-2 border-white/40 bg-slate-900/80 flex items-center justify-center text-xl font-black text-white shadow-lg">
																{(
																	rep().owner_intelligence?.owner_display || 'TG'
																)
																	.replace(/^@/, '')
																	.slice(0, 2)
																	.toUpperCase()}
															</div>
															<span class="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-slate-950" />
														</div>

														{/* Name + Worn Collectible Gift Status Badge */}
														<div
															class="inline-flex items-center gap-1.5 rounded-xl bg-black/45 px-3 py-1 backdrop-blur-md border border-white/15"
															dir="ltr"
														>
															<span class="text-sm font-black text-white truncate max-w-[140px]">
																{rep().owner_intelligence?.owner_display ||
																	'Collector'}
															</span>
															<img
																src={
																	modelTrait()?.image_url ||
																	rep().binary_forensics?.webp_url ||
																	rep().image_url
																}
																alt="Worn Status"
																class="h-5 w-5 object-contain drop-shadow"
															/>
														</div>
														<div class="text-[11px] text-white/80">
															آنلاین · نمایش بج وضعیت کلکسیونی #{rep().serial_number}
														</div>
													</div>

													{/* Simulated Profile Gifts Tab Row */}
													<div class="rounded-xl bg-black/60 backdrop-blur-md border border-white/15 p-2.5">
														<div class="flex items-center justify-between text-[10px] text-slate-300 mb-1.5">
															<span>ویترین گیفت‌های پروفایل</span>
															<span class="font-mono" dir="ltr">
																1 of{' '}
																{rep().owner_intelligence
																	?.telegram_gifts_held_count || 1}{' '}
																Gifts
															</span>
														</div>
														<div class="flex items-center gap-2.5">
															<div
																class="h-11 w-11 rounded-xl p-1 flex items-center justify-center relative shrink-0 border border-white/20"
																style={{
																	background: `radial-gradient(circle, ${bg().center_hex}, ${bg().edge_hex})`,
																}}
															>
																<img
																	src={
																		modelTrait()?.image_url ||
																		rep().binary_forensics?.webp_url
																	}
																	alt={rep().display_title}
																	class="h-8 w-8 object-contain"
																/>
															</div>
															<div class="min-w-0 text-right">
																<div
																	class="text-xs font-bold text-white truncate"
																	dir="ltr"
																>
																	{rep().display_title}
																</div>
																<div class="text-[10px] text-cyan-300">
																	پالت رنگی پروفایل: {backdropTrait()?.value} (
																	{bg().center_hex})
																</div>
															</div>
														</div>
													</div>
												</div>
											</Show>
										</div>

										{/* Valuation Summary & Floor Driver Column */}
										<div class="lg:col-span-8 flex flex-col justify-between space-y-4">
											{/* Header Row (Zero-Pill Static Metadata Discipline) */}
											<div class="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3.5">
												<div>
													<h1
														class="text-xl sm:text-2xl font-black text-white tracking-tight"
														dir="ltr"
													>
														{rep().display_title}
													</h1>
													<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
														<span class="text-cyan-300 font-semibold">
															{rep().serial_intel?.tier ||
																`سریال #${rep().serial_number}`}
														</span>
														<span aria-hidden="true">·</span>
														<span>
															{rep().custody_type === 'on_chain_nft'
																? 'ضرب‌شده روی زنجیره TON (TEP-62)'
																: 'نگهداری در حساب تلگرام (Off-Chain Custody)'}
														</span>
														<span aria-hidden="true">·</span>
														<span>
															مالک:{' '}
															<strong
																class="font-mono text-slate-200"
																dir="ltr"
															>
																{rep().owner_intelligence?.owner_display ||
																	rep().owner_name ||
																	'Verified Holder'}
															</strong>
														</span>
													</div>
												</div>

												{/* Functional Action Buttons */}
												<div class="flex items-center gap-2">
													<button
														type="button"
														onClick={() => void handleAddToWatchlist()}
														class="rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.09] px-3.5 py-2 text-xs font-semibold text-slate-200 transition cursor-pointer"
													>
														{watchlistSaved()
															? '✓ در دیده‌بان ذخیره شد'
															: 'افزودن به دیده‌بان قیمت'}
													</button>
													<a
														href={
															rep().binary_forensics?.fragment_url ||
															'https://fragment.com/gifts'
														}
														target="_blank"
														rel="noopener noreferrer"
														class="rounded-xl border border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 px-3.5 py-2 text-xs font-bold text-cyan-200 transition"
													>
														صفحه رسمی فرگمنت ↗
													</a>
												</div>
											</div>

											{/* Core Fair Value vs Live Listing */}
											<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
												<div class="sm:col-span-2 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 via-slate-900/80 to-slate-900 p-4">
													<div class="flex items-center justify-between text-xs text-cyan-300 mb-1">
														<span class="font-bold">
															ارزش منصفانه بازار (Floor-Anchored Fair Value)
														</span>
														<span class="font-mono text-[11px] text-emerald-300">
															دقت الگوریتم: {rep().confidence_score}%
														</span>
													</div>
													<div class="flex flex-wrap items-baseline gap-3 my-1">
														<span
															class="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight"
															dir="ltr"
														>
															{formatTon(
																rep().pillars?.fair_value_gram ??
																	rep().expected_gram,
															)}{' '}
															<span class="text-lg text-cyan-400">TON</span>
														</span>
														<span
															class="text-base font-mono font-semibold text-slate-300"
															dir="ltr"
														>
															≈{' '}
															{formatUsd(
																rep().pillars?.fair_value_usd ??
																	rep().expected_usd,
															)}
														</span>
													</div>
													<div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
														<span>
															بازه نوسان منطقی:{' '}
															<strong class="font-mono text-white" dir="ltr">
																{formatTon(rep().low_gram)} –{' '}
																{formatTon(rep().high_gram)} TON
															</strong>
														</span>
														<span aria-hidden="true">·</span>
														<span>
															معادل تلگرام استارز:{' '}
															<strong
																class="font-mono text-amber-300"
																dir="ltr"
															>
																★{' '}
																{(
																	rep().stars_parity?.implied_stars_value || 0
																).toLocaleString()}
															</strong>
														</span>
													</div>
												</div>

												{/* Live Sale Status or Dominant Driver */}
												<div class="rounded-2xl border border-white/10 bg-slate-900/90 p-4 flex flex-col justify-between">
													<div>
														<div class="text-[11px] text-slate-400">
															وضعیت فعلی در اردربوک فرگمنت
														</div>
														<Show
															when={isListedForSale()}
															fallback={
																<div class="mt-1.5">
																	<div class="text-sm font-bold text-slate-200">
																		خارج از لیست فروش (نگهداری توسط مالک)
																	</div>
																	<div class="mt-1 text-[11px] text-slate-400">
																		بهترین خروجی خالص در{' '}
																		<span class="text-cyan-300 font-semibold">
																			{rep().exit_planner?.best_venue_name}
																		</span>
																		:{' '}
																		<span
																			class="font-mono text-white"
																			dir="ltr"
																		>
																			{formatTon(
																				rep().exit_planner?.max_net_gram,
																			)}{' '}
																			TON
																		</span>
																	</div>
																</div>
															}
														>
															<div class="mt-1">
																<div class="text-xs font-bold text-emerald-300">
																	فعال برای خرید آنی (For Sale)
																</div>
																<div
																	class="mt-1 text-xl font-black font-mono text-emerald-400"
																	dir="ltr"
																>
																	{formatTon(
																		rep().owner_intelligence
																			?.live_listing_price_gram,
																	)}{' '}
																	TON
																</div>
															</div>
														</Show>
													</div>

													<div class="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
														<span class="text-slate-400">ضریب شماره سریال:</span>
														<span
															class="font-mono font-bold text-amber-300"
															dir="ltr"
														>
															{rep().serial_intel?.multiplier ?? 1}x (#
															{rep().serial_number})
														</span>
													</div>
												</div>
											</div>

											{/* Floor Dominance Explanation Banner */}
											<div class="rounded-xl border border-indigo-500/30 bg-indigo-950/30 px-3.5 py-2.5 text-xs text-indigo-100 leading-relaxed">
												<strong class="font-bold text-cyan-300 ml-1">
													منطق قیمت‌گذاری کف بازار (Floor-Anchored Engine):
												</strong>
												<span>
													{fm()?.driver_explanation_fa ||
														rep().recommendation?.summary_fa}
												</span>
											</div>
										</div>
									</div>

									{/* ═══════════════════════════════════════════════════════════
									    4-FLOOR MATRIX STRIP: Collection vs Model vs Backdrop vs Symbol Floor
									   ═══════════════════════════════════════════════════════════ */}
									<Show when={fm()}>
										{(matrix) => (
											<div class="mt-5 pt-4 border-t border-white/10">
												<div class="flex flex-wrap items-center justify-between gap-2 mb-3">
													<h2 class="text-xs sm:text-sm font-bold text-slate-200">
														ماتریس ۴گانه کف قیمت لحظه‌ای در فرگمنت (Live Trait Floor Matrix)
													</h2>
													<span class="text-[11px] text-slate-400">
														کف نقدشونده موثر:{' '}
														<strong class="font-mono text-cyan-300" dir="ltr">
															{formatTon(matrix().effective_liquid_floor_gram)}{' '}
															TON
														</strong>
													</span>
												</div>

												<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
													{/* 1. Collection Floor */}
													<div
														class={`rounded-2xl border p-3.5 transition ${
															matrix().dominant_floor_driver === 'collection'
																? 'border-cyan-400/60 bg-cyan-950/25 shadow-lg shadow-cyan-500/10'
																: 'border-white/10 bg-slate-900/70'
														}`}
													>
														<div class="flex items-center justify-between text-[11px] text-slate-400">
															<span>۰۱. کف کل کلکسیون</span>
															<Show
																when={
																	matrix().dominant_floor_driver ===
																	'collection'
																}
															>
																<span class="text-[10px] font-bold text-cyan-300">
																	محرک اصلی
																</span>
															</Show>
														</div>
														<div
															class="mt-1.5 text-lg sm:text-xl font-black font-mono text-white"
															dir="ltr"
														>
															{formatTon(matrix().collection_floor_gram)} TON
														</div>
														<div
															class="text-[11px] font-mono text-slate-400"
															dir="ltr"
														>
															{formatUsd(matrix().collection_floor_usd)} · Next:{' '}
															{formatTon(
																matrix().collection_second_floor_gram,
															)}{' '}
															TON
														</div>
														<div class="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-400">
															<span>
																ارزان‌ترین: #{matrix().collection_floor_serial}
															</span>
															<a
																href={matrix().collection_floor_url}
																target="_blank"
																rel="noopener noreferrer"
																class="text-cyan-400 hover:underline"
															>
																اردربوک ↗
															</a>
														</div>
													</div>

													{/* 2. Exact Model Floor */}
													<div
														class={`rounded-2xl border p-3.5 transition ${
															matrix().dominant_floor_driver === 'model'
																? 'border-cyan-400/60 bg-cyan-950/25 shadow-lg shadow-cyan-500/10'
																: 'border-white/10 bg-slate-900/70'
														}`}
													>
														<div class="flex items-center justify-between text-[11px] text-slate-400">
															<span class="truncate">
																۰۲. کف مدل ({matrix().model_name})
															</span>
															<span class="font-mono text-[10px] text-amber-300 shrink-0">
																{matrix().model_rarity_pct}%
															</span>
														</div>
														<div class="mt-1.5 flex items-baseline gap-1.5">
															<span
																class="text-lg sm:text-xl font-black font-mono text-white"
																dir="ltr"
															>
																{formatTon(matrix().model_floor_gram)} TON
															</span>
															<Show when={matrix().model_is_vanity_ask}>
																<span
																	title="اردر فعلی فرگمنت بالاتر از میانه معاملات واقعی است"
																	class="text-[10px] font-semibold text-amber-300"
																>
																	· اردر هیجانی
																</span>
															</Show>
														</div>
														<div
															class="text-[11px] font-mono text-slate-400"
															dir="ltr"
														>
															{matrix().model_median_sale_gram > 0
																? `Median Sold: ${formatTon(matrix().model_median_sale_gram)} TON`
																: formatUsd(matrix().model_floor_usd)}
														</div>
														<div class="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-400">
															<span>
																{matrix().model_active_count} فعال (#
																{matrix().model_floor_serial})
															</span>
															<a
																href={matrix().model_floor_url}
																target="_blank"
																rel="noopener noreferrer"
																class="text-cyan-400 hover:underline"
															>
																فیلتر مدل ↗
															</a>
														</div>
													</div>

													{/* 3. Exact Backdrop Floor */}
													<div
														class={`rounded-2xl border p-3.5 transition ${
															matrix().dominant_floor_driver === 'backdrop'
																? 'border-cyan-400/60 bg-cyan-950/25 shadow-lg shadow-cyan-500/10'
																: 'border-white/10 bg-slate-900/70'
														}`}
													>
														<div class="flex items-center justify-between text-[11px] text-slate-400">
															<span class="truncate flex items-center gap-1.5">
																<span
																	class="inline-block h-2.5 w-2.5 rounded-full border border-white/30"
																	style={{ background: bg().center_hex }}
																/>
																<span>
																	۰۳. کف پس‌زمینه ({matrix().backdrop_name})
																</span>
															</span>
															<span class="font-mono text-[10px] text-amber-300 shrink-0">
																{matrix().backdrop_rarity_pct}%
															</span>
														</div>
														<div class="mt-1.5 flex items-baseline gap-1.5">
															<span
																class="text-lg sm:text-xl font-black font-mono text-white"
																dir="ltr"
															>
																{formatTon(matrix().backdrop_floor_gram)} TON
															</span>
															<Show when={matrix().backdrop_is_vanity_ask}>
																<span class="text-[10px] font-semibold text-amber-300">
																	· اردر هیجانی
																</span>
															</Show>
														</div>
														<div
															class="text-[11px] font-mono text-slate-400"
															dir="ltr"
														>
															{matrix().backdrop_median_sale_gram > 0
																? `Median Sold: ${formatTon(matrix().backdrop_median_sale_gram)} TON`
																: formatUsd(matrix().backdrop_floor_usd)}
														</div>
														<div class="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-400">
															<span>
																{matrix().backdrop_active_count} فعال (#
																{matrix().backdrop_floor_serial})
															</span>
															<a
																href={matrix().backdrop_floor_url}
																target="_blank"
																rel="noopener noreferrer"
																class="text-cyan-400 hover:underline"
															>
																فیلتر رنگ ↗
															</a>
														</div>
													</div>

													{/* 4. Exact Symbol Floor */}
													<div class="rounded-2xl border border-white/10 bg-slate-900/70 p-3.5">
														<div class="flex items-center justify-between text-[11px] text-slate-400">
															<span class="truncate">
																۰۴. کف نماد ({matrix().symbol_name})
															</span>
															<span class="font-mono text-[10px] text-amber-300 shrink-0">
																{matrix().symbol_rarity_pct}%
															</span>
														</div>
														<div
															class="mt-1.5 text-lg sm:text-xl font-black font-mono text-white"
															dir="ltr"
														>
															{formatTon(matrix().symbol_floor_gram)} TON
														</div>
														<div
															class="text-[11px] font-mono text-slate-400"
															dir="ltr"
														>
															{formatUsd(matrix().symbol_floor_usd)}
														</div>
														<div class="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-400">
															<span>
																{matrix().symbol_active_count} فعال (#
																{matrix().symbol_floor_serial})
															</span>
															<a
																href={matrix().symbol_floor_url}
																target="_blank"
																rel="noopener noreferrer"
																class="text-cyan-400 hover:underline"
															>
																فیلتر نماد ↗
															</a>
														</div>
													</div>
												</div>
											</div>
										)}
									</Show>
								</section>

								{/* ═══════════════════════════════════════════════════════════
								    4-TAB INSTITUTIONAL NAVIGATION BAR
								   ═══════════════════════════════════════════════════════════ */}
								<nav class="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-slate-900/90 p-1.5">
									{[
										{
											id: 'valuation' as ReportTabId,
											num: '01.',
											label: 'ارزش‌گذاری و کف بازار',
											sub: 'دماسنج معامله، اردربوک و هم‌سریال‌ها',
										},
										{
											id: 'traits' as ReportTabId,
											num: '02.',
											label: 'کالبدشکافی تریت و رنگ',
											sub: 'DNA، شبیه‌ساز و کاتالوگ کلکسیون',
										},
										{
											id: 'ownership' as ReportTabId,
											num: '03.',
											label: 'مالک، زنجیره و نهنگ‌شناسی',
											sub: 'پورتفوی مالک، تاریخچه و باینری',
										},
										{
											id: 'venues' as ReportTabId,
											num: '04.',
											label: 'مارکت‌پلیس‌ها، کرفت و ارتقا',
											sub: 'خروجی خالص ۶ بازار و کارگاه کرفت',
										},
									].map((tab) => {
										const active = () => activeTab() === tab.id;
										return (
											<button
												type="button"
												onClick={() => {
													haptic('light');
													setActiveTab(tab.id);
												}}
												class={`flex flex-col items-start rounded-xl px-3.5 py-2.5 text-right transition cursor-pointer ${
													active()
														? 'bg-gradient-to-l from-cyan-500/25 to-blue-600/20 border border-cyan-400/50 text-white shadow-md'
														: 'hover:bg-white/[0.04] text-slate-400 border border-transparent'
												}`}
											>
												<div class="flex items-center gap-1.5 text-xs sm:text-sm font-bold">
													<span class="font-mono text-cyan-400 text-xs">
														{tab.num}
													</span>
													<span>{tab.label}</span>
												</div>
												<span class="mt-0.5 text-[10px] text-slate-400 line-clamp-1">
													{tab.sub}
												</span>
											</button>
										);
									})}
								</nav>

								{/* ═══════════════════════════════════════════════════════════
								    TAB 1: VALUATION, DEAL THERMOMETER, ORDERBOOK & SIBLINGS
								   ═══════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'valuation'}>
									<div class="space-y-5">
										{/* Deal Thermometer & Liquidity Spectrum Gauge */}
										<Show when={rep().deal_thermometer}>
											{(thermo) => (
												<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
													<div class="flex flex-wrap items-center justify-between gap-2">
														<div>
															<h3 class="text-sm sm:text-base font-bold text-white">
																۰۱. دماسنج نقدشوندگی و طیف قیمت‌گذاری (Liquidity & Spread Spectrum)
															</h3>
															<p class="text-xs text-slate-400 mt-0.5">
																موقعیت دقیق این گیفت از کف نقدشوندگی فوری (Bid) تا سقف اردر فروش (Ask)
															</p>
														</div>
														<span class="text-xs font-bold text-cyan-300">
															{thermo().deal_rating_fa} · اسپرد Bid/Ask:{' '}
															<span class="font-mono" dir="ltr">
																{thermo().spread_bid_ask_pct}%
															</span>
														</span>
													</div>

													{/* 5-Point Horizontal Liquidity Bar */}
													<div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
														<div class="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3">
															<div class="text-[10px] text-emerald-300">
																۱. فروش آنی (Instant Bid)
															</div>
															<div
																class="mt-1 text-sm font-black font-mono text-emerald-400"
																dir="ltr"
															>
																{formatTon(thermo().liquidation_bid_gram)} TON
															</div>
														</div>

														<div class="rounded-xl border border-white/10 bg-slate-950/60 p-3">
															<div class="text-[10px] text-slate-400">
																۲. کف کلکسیون (Base Floor)
															</div>
															<div
																class="mt-1 text-sm font-black font-mono text-slate-200"
																dir="ltr"
															>
																{formatTon(thermo().collection_floor_gram)} TON
															</div>
														</div>

														<div class="rounded-xl border border-white/10 bg-slate-950/60 p-3">
															<div class="text-[10px] text-slate-300">
																۳. کف نقدشونده تریت
															</div>
															<div
																class="mt-1 text-sm font-black font-mono text-cyan-300"
																dir="ltr"
															>
																{formatTon(thermo().trait_liquid_floor_gram)}{' '}
																TON
															</div>
														</div>

														<div class="rounded-xl border border-cyan-400/50 bg-cyan-950/30 p-3">
															<div class="text-[10px] font-bold text-cyan-300">
																۴. ارزش منصفانه (Fair Value)
															</div>
															<div
																class="mt-1 text-sm font-black font-mono text-white"
																dir="ltr"
															>
																{formatTon(thermo().fair_value_gram)} TON
															</div>
														</div>

														<div class="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3 col-span-2 sm:col-span-1">
															<div class="text-[10px] text-indigo-300">
																۵. سقف پیشنهادی لیست (Ask)
															</div>
															<div
																class="mt-1 text-sm font-black font-mono text-indigo-300"
																dir="ltr"
															>
																{formatTon(thermo().optimal_ask_gram)} TON
															</div>
														</div>
													</div>

													<div class="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-300 leading-relaxed">
														<strong class="text-white ml-1">
															توصیه اجرایی معامله‌گر:
														</strong>
														{thermo().execution_advice_fa}
													</div>
												</section>
											)}
										</Show>

										{/* Live Trait-Filtered Active Listings (Fragment Orderbook) */}
										<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
											<div class="flex flex-wrap items-center justify-between gap-2">
												<div>
													<h3 class="text-sm sm:text-base font-bold text-white">
														۰۲. اردربوک زنده آیتم‌های هم‌مدل و هم‌پس‌زمینه در فرگمنت
													</h3>
													<p class="text-xs text-slate-400 mt-0.5">
														مقایسه مستقیم ارزان‌ترین لیستینگ‌های فعال برای مدل «
														{modelTrait()?.value}» و پس‌زمینه «
														{backdropTrait()?.value}»
													</p>
												</div>

												<div class="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-white/10">
													{[
														{ id: 'all' as const, label: 'همه' },
														{
															id: 'model' as const,
															label: `مدل ${modelTrait()?.value}`,
														},
														{
															id: 'backdrop' as const,
															label: `رنگ ${backdropTrait()?.value}`,
														},
														{ id: 'collection' as const, label: 'کف کلکسیون' },
													].map((btn) => (
														<button
															type="button"
															onClick={() => setOrderbookFilter(btn.id)}
															class={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
																orderbookFilter() === btn.id
																	? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
																	: 'text-slate-400 hover:text-white'
															}`}
														>
															{btn.label}
														</button>
													))}
												</div>
											</div>

											<Show
												when={filteredOrderbook().length > 0}
												fallback={
													<div class="rounded-xl border border-white/5 bg-slate-950/50 p-6 text-center text-xs text-slate-400">
														هیچ آیتم فعالی برای این فیلتر در حال حاضر برای فروش مستقیم لیست نشده است (نشان‌دهنده کمیابی عرضه در اردربوک).
													</div>
												}
											>
												<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
													<For each={filteredOrderbook()}>
														{(item) => (
															<div class="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/70 p-3 hover:border-cyan-500/40 transition">
																<div class="flex items-center gap-3 min-w-0">
																	<img
																		src={item.image_url}
																		alt={`#${item.serial_number}`}
																		class="h-12 w-12 rounded-xl object-cover border border-white/10 shrink-0 bg-slate-900"
																	/>
																	<div class="min-w-0">
																		<div class="flex items-center gap-1.5 text-xs">
																			<button
																				type="button"
																				onClick={() =>
																					selectPresetGift(item.gift_id)
																				}
																				class="font-mono font-bold text-white hover:text-cyan-300 transition cursor-pointer"
																				dir="ltr"
																			>
																				#{item.serial_number}
																			</button>
																			<span aria-hidden="true" class="text-slate-600">
																				·
																			</span>
																			<span class="text-[11px] text-slate-400 truncate">
																				{item.trait_value}
																			</span>
																		</div>
																		<div
																			class="mt-1 text-sm font-black font-mono text-emerald-400"
																			dir="ltr"
																		>
																			{formatTon(item.price_gram)} TON{' '}
																			<span class="text-[11px] font-normal text-slate-400">
																				({formatUsd(item.price_usd)})
																			</span>
																		</div>
																	</div>
																</div>

																<a
																	href={item.fragment_url}
																	target="_blank"
																	rel="noopener noreferrer"
																	class="rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1.5 text-[11px] font-bold text-cyan-300 shrink-0"
																>
																	فرگمنت ↗
																</a>
															</div>
														)}
													</For>
												</div>
											</Show>
										</section>

										{/* SVG Price Trajectory & Floor Benchmark Chart */}
										<Show when={chartPoints()}>
											{(chart) => (
												<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3">
													<div class="flex flex-wrap items-center justify-between gap-2">
														<div>
															<h3 class="text-sm sm:text-base font-bold text-white">
																۰۳. نمودار معاملات واقعی در برابر ارزش منصفانه و کف کلکسیون
															</h3>
															<p class="text-xs text-slate-400">
																نقاط آبی معاملات ثبت‌شده روی زنجیره TON برای همین مدل و پس‌زمینه هستند
															</p>
														</div>
														<div class="flex items-center gap-3 text-[11px]">
															<span class="flex items-center gap-1 text-cyan-300">
																<span class="h-2 w-2 rounded-full bg-cyan-400" />
																ارزش منصفانه: {formatTon(chart().fair)} TON
															</span>
															<span class="flex items-center gap-1 text-amber-300">
																<span class="h-2 w-2 rounded-full bg-amber-400" />
																کف کلکسیون: {formatTon(chart().colFloor)} TON
															</span>
														</div>
													</div>

													<div class="overflow-x-auto">
														<svg
															viewBox={`0 0 ${chart().width} ${chart().height}`}
															class="w-full h-44 rounded-xl bg-slate-950/80 border border-white/5"
														>
															<defs>
																<linearGradient
																	id="giftCompAreaGrad"
																	x1="0"
																	y1="0"
																	x2="0"
																	y2="1"
																>
																	<stop
																		offset="0%"
																		stop-color="#22d3ee"
																		stop-opacity="0.32"
																	/>
																	<stop
																		offset="100%"
																		stop-color="#22d3ee"
																		stop-opacity="0.0"
																	/>
																</linearGradient>
															</defs>

															<line
																x1="28"
																y1={chart().floorY}
																x2={chart().width - 28}
																y2={chart().floorY}
																stroke="#f59e0b"
																stroke-width="1.2"
																stroke-dasharray="4 4"
																opacity="0.7"
															/>

															<line
																x1="28"
																y1={chart().fairY}
																x2={chart().width - 28}
																y2={chart().fairY}
																stroke="#22d3ee"
																stroke-width="1.5"
																stroke-dasharray="6 4"
																opacity="0.85"
															/>

															<path
																d={chart().areaPath}
																fill="url(#giftCompAreaGrad)"
															/>
															<polyline
																fill="none"
																stroke="#38bdf8"
																stroke-width="2.5"
																points={chart().polyline}
															/>

															<For each={chart().pts}>
																{(pt) => (
																	<g>
																		<circle
																			cx={pt.x}
																			cy={pt.y}
																			r="4.5"
																			fill="#0284c7"
																			stroke="#e0f2fe"
																			stroke-width="1.8"
																		/>
																		<text
																			x={pt.x}
																			y={Math.max(14, pt.y - 8)}
																			text-anchor="middle"
																			fill="#e2e8f0"
																			font-size="9.5"
																			font-family="monospace"
																		>
																			{formatTon(pt.price)}
																		</text>
																	</g>
																)}
															</For>
														</svg>
													</div>
												</section>
											)}
										</Show>

										{/* Real Settled Sales Table (Comps) */}
										<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
											<div class="flex flex-wrap items-center justify-between gap-2">
												<div>
													<h3 class="text-sm sm:text-base font-bold text-white">
														۰۴. معاملات قطعی و تسویه‌شده زنجیره (Verified On-Chain Comps)
													</h3>
													<p class="text-xs text-slate-400">
														استخراج مستقیم از تاریخچه فروش‌های واقعی فرگمنت برای مدل و پس‌زمینه مشابه
													</p>
												</div>

												<div class="flex flex-wrap items-center gap-1 rounded-xl bg-slate-950 p-1 border border-white/10">
													{[
														{ id: 'all' as const, label: 'همه معاملات' },
														{ id: 'exact_model' as const, label: 'هم‌مدل' },
														{
															id: 'exact_backdrop' as const,
															label: 'هم‌پس‌زمینه',
														},
														{
															id: 'same_gift_history' as const,
															label: 'همین گیفت',
														},
													].map((tab) => (
														<button
															type="button"
															onClick={() => setCompFilter(tab.id)}
															class={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
																compFilter() === tab.id
																	? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
																	: 'text-slate-400 hover:text-white'
															}`}
														>
															{tab.label}
														</button>
													))}
												</div>
											</div>

											<div class="overflow-x-auto">
												<table class="w-full text-right text-xs">
													<thead>
														<tr class="border-b border-white/10 text-[11px] text-slate-400">
															<th class="pb-2.5 font-semibold">آیتم و سریال</th>
															<th class="pb-2.5 font-semibold">نوع تطابق تریت</th>
															<th class="pb-2.5 font-semibold">مبلغ فروش</th>
															<th class="pb-2.5 font-semibold">
																اختلاف با ارزش منصفانه
															</th>
															<th class="pb-2.5 font-semibold">تاریخ</th>
															<th class="pb-2.5 font-semibold text-left">
																لینک زنجیره
															</th>
														</tr>
													</thead>
													<tbody class="divide-y divide-white/[0.06]">
														<For each={filteredComps()}>
															{(comp) => (
																<tr class="hover:bg-white/[0.02] transition">
																	<td class="py-3">
																		<div class="flex items-center gap-2.5">
																			<Show when={comp.image_url}>
																				<img
																					src={comp.image_url}
																					alt={`#${comp.serial_number}`}
																					class="h-9 w-9 rounded-lg object-cover border border-white/10 bg-slate-900"
																				/>
																			</Show>
																			<div>
																				<button
																					type="button"
																					onClick={() =>
																						selectPresetGift(comp.gift_id)
																					}
																					class="font-mono font-bold text-white hover:text-cyan-300 cursor-pointer"
																					dir="ltr"
																				>
																					#{comp.serial_number}
																				</button>
																				<div class="text-[10px] text-slate-400">
																					{comp.venue}
																				</div>
																			</div>
																		</div>
																	</td>
																	<td class="py-3 text-slate-300">
																		{comp.model_id}
																	</td>
																	<td
																		class="py-3 font-mono font-bold text-emerald-400"
																		dir="ltr"
																	>
																		{formatTon(comp.sale_price_gram)} TON
																		<div class="text-[10px] font-normal text-slate-400">
																			{formatUsd(comp.sale_price_usd)}
																		</div>
																	</td>
																	<td class="py-3 font-mono" dir="ltr">
																		<span
																			class={
																				comp.diff_percent > 0
																					? 'text-emerald-300 font-bold'
																					: comp.diff_percent < 0
																						? 'text-amber-300 font-bold'
																						: 'text-slate-300'
																			}
																		>
																			{comp.diff_percent > 0 ? '+' : ''}
																			{comp.diff_percent}%
																		</span>
																	</td>
																	<td class="py-3 text-slate-300">
																		{formatDateFa(comp.sale_date)}
																	</td>
																	<td class="py-3 text-left">
																		<a
																			href={comp.tonviewer_url}
																			target="_blank"
																			rel="noopener noreferrer"
																			class="text-cyan-400 hover:underline font-mono text-[11px]"
																		>
																			بررسی ↗
																		</a>
																	</td>
																</tr>
															)}
														</For>
													</tbody>
												</table>
											</div>
										</section>

										{/* Same-Serial Siblings Matrix Across Top Collections */}
										<Show
											when={
												(rep().same_serial_siblings || []).length > 0
											}
										>
											<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3">
												<div class="flex flex-wrap items-center justify-between gap-2">
													<div>
														<h3 class="text-sm sm:text-base font-bold text-white">
															۰۵. ماتریس هم‌سریال در کلکسیون‌های برتر (Same-Serial #{rep().serial_number} Set Builder)
														</h3>
														<p class="text-xs text-slate-400 mt-0.5">
															مقایسه ارزش شماره سریال #{rep().serial_number} در سایر کلکسیون‌های شاخص برای کلکسیونرهای ست‌ساز
														</p>
													</div>
												</div>

												<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
													<For each={rep().same_serial_siblings}>
														{(sib) => (
															<div class="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/75 p-3 hover:border-cyan-500/40 transition">
																<div class="flex items-center gap-3 min-w-0">
																	<img
																		src={sib.image_url}
																		alt={`${sib.collection_name} #${sib.serial_number}`}
																		class="h-12 w-12 rounded-xl object-cover border border-white/10 bg-slate-900 shrink-0"
																	/>
																	<div class="min-w-0">
																		<button
																			type="button"
																			onClick={() =>
																				selectPresetGift(sib.gift_id)
																			}
																			class="text-xs font-bold text-white hover:text-cyan-300 truncate block cursor-pointer"
																			dir="ltr"
																		>
																			{sib.collection_name} #{sib.serial_number}
																		</button>
																		<div
																			class="text-xs font-mono font-bold text-cyan-300 mt-0.5"
																			dir="ltr"
																		>
																			≈ {formatTon(sib.estimated_serial_value_gram)}{' '}
																			TON{' '}
																			<span class="text-[10px] font-normal text-slate-400">
																				({formatUsd(sib.estimated_serial_value_usd)})
																			</span>
																		</div>
																		<div class="text-[10px] text-slate-500 font-mono" dir="ltr">
																			Floor: {formatTon(sib.collection_floor_gram)} TON
																		</div>
																	</div>
																</div>

																<button
																	type="button"
																	onClick={() => selectPresetGift(sib.gift_id)}
																	class="rounded-lg border border-white/15 bg-white/[0.04] hover:bg-cyan-500/20 hover:border-cyan-500/40 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:text-cyan-200 shrink-0 cursor-pointer"
																>
																	بررسی
																</button>
															</div>
														)}
													</For>
												</div>
											</section>
										</Show>
									</div>
								</Show>

								{/* ═══════════════════════════════════════════════════════════
								    TAB 2: TRAIT DNA, CHROMATIC LAB, WHAT-IF & FULL CATALOG
								   ═══════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'traits'}>
									<div class="space-y-5">
										{/* 3-Axis Trait DNA Cards */}
										<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
											<div class="flex flex-wrap items-center justify-between gap-2">
												<div>
													<h3 class="text-sm sm:text-base font-bold text-white">
														۰۱. کالبدشکافی ۳ محور تریت (Model · Backdrop · Symbol DNA)
													</h3>
													<p class="text-xs text-slate-400">
														مقایسه فراوانی فعلی با فراوانی اولیه (قبل از سوزاندن در کارگاه کرفت) و کف قیمت اختصاصی هر تریت
													</p>
												</div>
												<span class="text-xs font-mono text-cyan-300" dir="ltr">
													Harmonic Rarity: {rep().rarity_score}/100 · Rank #
													{rep().rarity_rank}
												</span>
											</div>

											<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
												<For each={rep().trait_dna}>
													{(trait) => (
														<div class="rounded-2xl border border-white/10 bg-slate-950/80 p-4 flex flex-col justify-between space-y-3">
															<div>
																<div class="flex items-center justify-between text-xs text-slate-400">
																	<span>{trait.label_fa}</span>
																	<span class="font-mono text-[11px] font-bold text-cyan-300">
																		{trait.rarity_tier}
																	</span>
																</div>

																<div class="mt-3 flex items-center gap-3">
																	<Show
																		when={trait.image_url}
																		fallback={
																			<div
																				class="h-14 w-14 rounded-2xl border border-white/20 shrink-0 shadow-inner"
																				style={{
																					background: `radial-gradient(circle, ${trait.colors?.center_hex || '#3b82f6'} 0%, ${trait.colors?.edge_hex || '#1d4ed8'} 100%)`,
																				}}
																			/>
																		}
																	>
																		<div class="h-14 w-14 rounded-2xl border border-white/10 bg-slate-900 p-1.5 flex items-center justify-center shrink-0">
																			<img
																				src={trait.image_url}
																				alt={trait.value}
																				class="max-h-full max-w-full object-contain"
																			/>
																		</div>
																	</Show>

																	<div>
																		<div
																			class="text-base font-black text-white"
																			dir="ltr"
																		>
																			{trait.value}
																		</div>
																		<div class="text-xs font-mono text-amber-300 mt-0.5">
																			ضریب شیوع فعلی: {trait.percentile}%
																		</div>
																		<Show
																			when={
																				trait.original_percentile &&
																				trait.original_percentile !==
																					trait.percentile
																			}
																		>
																			<div class="text-[10px] font-mono text-slate-400">
																				شیوع اولیه قبل از کرفت:{' '}
																				{trait.original_percentile}%
																			</div>
																		</Show>
																	</div>
																</div>

																<p class="mt-3 text-xs text-slate-300 leading-relaxed">
																	{trait.description}
																</p>
															</div>

															<div class="pt-3 border-t border-white/[0.07] flex items-center justify-between text-xs">
																<span class="text-slate-400">
																	کف قیمت این تریت:
																</span>
																<span
																	class="font-mono font-bold text-emerald-400"
																	dir="ltr"
																>
																	{formatTon(trait.floor_gram)} TON (
																	{formatUsd(trait.floor_usd || 0)})
																</span>
															</div>
														</div>
													)}
												</For>
											</div>
										</section>

										{/* Interactive What-If Trait & Backdrop Simulator */}
										<Show when={rep().collection_catalog}>
											{(catalog) => (
												<section class="rounded-2xl border border-cyan-500/35 bg-gradient-to-br from-cyan-950/25 via-slate-900/90 to-slate-900 p-4 sm:p-5 space-y-4">
													<div class="flex flex-wrap items-center justify-between gap-2">
														<div>
															<h3 class="text-sm sm:text-base font-bold text-white">
																۰۲. شبیه‌ساز تعاملی قیمت با تغییر مدل و پس‌زمینه (Live What-If Simulator)
															</h3>
															<p class="text-xs text-slate-300 mt-0.5">
																بررسی کنید اگر این گیفت پس‌زمینه Black / Satin Gold یا مدل دیگری داشت، کف قیمت واقعی آن در فرگمنت چقدر می‌شد
															</p>
														</div>
														<button
															type="button"
															onClick={resetTraitSimulation}
															class="rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-300 hover:text-white cursor-pointer"
														>
															بازنشانی به تریت اصلی گیفت
														</button>
													</div>

													<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
														<div>
															<label class="block text-xs text-slate-400 mb-1">
																انتخاب مدل ({catalog().models.length} مدل):
															</label>
															<select
																value={simModel()}
																onChange={(e) =>
																	setSimModel(e.currentTarget.value)
																}
																dir="ltr"
																class="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
															>
																<For each={catalog().models}>
																	{(m) => (
																		<option value={m.name}>
																			{m.name} ({m.rarity_pct}%)
																		</option>
																	)}
																</For>
															</select>
														</div>

														<div>
															<label class="block text-xs text-slate-400 mb-1">
																انتخاب پس‌زمینه ({catalog().backdrops.length}{' '}
																رنگ):
															</label>
															<select
																value={simBackdrop()}
																onChange={(e) =>
																	setSimBackdrop(e.currentTarget.value)
																}
																dir="ltr"
																class="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
															>
																<For each={catalog().backdrops}>
																	{(b) => (
																		<option value={b.name}>
																			{b.name} ({b.rarity_pct}%)
																		</option>
																	)}
																</For>
															</select>
														</div>

														<div>
															<label class="block text-xs text-slate-400 mb-1">
																انتخاب نماد ({catalog().symbols.length} الگو):
															</label>
															<select
																value={simSymbol()}
																onChange={(e) =>
																	setSimSymbol(e.currentTarget.value)
																}
																dir="ltr"
																class="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
															>
																<For each={catalog().symbols}>
																	{(s) => (
																		<option value={s.name}>
																			{s.name} ({s.rarity_pct}%)
																		</option>
																	)}
																</For>
															</select>
														</div>
													</div>

													<div class="flex justify-end">
														<button
															type="button"
															disabled={simulating()}
															onClick={applyTraitSimulation}
															class="rounded-xl bg-gradient-to-l from-cyan-500 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-95 disabled:opacity-50 cursor-pointer"
														>
															{simulating()
																? 'در حال استعلام کف قیمت جدید از فرگمنت...'
																: 'محاسبه زنده ارزش با این ترکیب تریت'}
														</button>
													</div>
												</section>
											)}
										</Show>

										{/* Chromatic Backdrop & Wallpaper Palette Lab */}
										<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
											<div class="flex flex-wrap items-center justify-between gap-2">
												<div>
													<h3 class="text-sm sm:text-base font-bold text-white">
														۰۳. آزمایشگاه کروماتیک پس‌زمینه و تطابق رنگی (ΔE Chromatic Harmony)
													</h3>
													<p class="text-xs text-slate-400">
														کدهای هگزادسیمال استخراج‌شده از SVG رسمی{' '}
														<code class="font-mono">t.me/nft</code> و بررسی هم‌خانوادگی رنگ مدل و پس‌زمینه
													</p>
												</div>
												<Show when={rep().color_match_intel}>
													{(cm) => (
														<span class="text-xs font-semibold text-cyan-300">
															{cm().harmony_class} · ΔE = {cm().delta_e_score}
														</span>
													)}
												</Show>
											</div>

											<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
												{[
													{
														label: 'مرکز گرادیان (Center Hex)',
														hex: bg().center_hex,
													},
													{
														label: 'لبه گرادیان (Edge Hex)',
														hex: bg().edge_hex,
													},
													{
														label: 'رنگ الگو (Pattern Hex)',
														hex: bg().pattern_hex,
													},
													{
														label: 'رنگ نوشتار بج (Text Hex)',
														hex: bg().text_hex,
													},
												].map((item) => (
													<button
														type="button"
														onClick={() =>
															copyToClipboard(item.hex, item.label)
														}
														class="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/75 p-3 text-right hover:border-cyan-500/40 transition cursor-pointer"
													>
														<span
															class="h-10 w-10 rounded-xl border border-white/20 shrink-0 shadow"
															style={{ background: item.hex }}
														/>
														<div class="min-w-0">
															<div class="text-[11px] text-slate-400 truncate">
																{item.label}
															</div>
															<div
																class="font-mono text-xs font-bold text-white mt-0.5"
																dir="ltr"
															>
																{copiedKey() === item.label
																	? 'Copied!'
																	: item.hex}
															</div>
														</div>
													</button>
												))}
											</div>
										</section>

										{/* Full Collection Trait & Burn-Delta Explorer */}
										<Show when={rep().collection_catalog}>
											{(catalog) => (
												<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
													<div class="flex flex-wrap items-center justify-between gap-3">
														<div>
															<h3 class="text-sm sm:text-base font-bold text-white">
																۰۴. دانشنامه کامل تریت‌ها و نرخ سوزاندن کرفت در این کلکسیون
															</h3>
															<p class="text-xs text-slate-400 mt-0.5">
																مشاهده تمام مدل‌ها، پس‌زمینه‌ها و نمادهای کلکسیون به ترتیب کمیابی + کلیک برای شبیه‌سازی فوری
															</p>
														</div>

														<div class="flex flex-wrap items-center gap-2">
															<input
																type="text"
																dir="ltr"
																value={catalogSearch()}
																onInput={(e) =>
																	setCatalogSearch(e.currentTarget.value)
																}
																placeholder="Search trait..."
																class="rounded-xl border border-white/15 bg-slate-950 px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
															/>
															<div class="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-white/10">
																{[
																	{
																		id: 'models' as CatalogExplorerTab,
																		label: `مدل‌ها (${catalog().models.length})`,
																	},
																	{
																		id: 'backdrops' as CatalogExplorerTab,
																		label: `پس‌زمینه‌ها (${catalog().backdrops.length})`,
																	},
																	{
																		id: 'symbols' as CatalogExplorerTab,
																		label: `نمادها (${catalog().symbols.length})`,
																	},
																].map((tBtn) => (
																	<button
																		type="button"
																		onClick={() => setCatalogTab(tBtn.id)}
																		class={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
																			catalogTab() === tBtn.id
																				? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
																				: 'text-slate-400 hover:text-white'
																		}`}
																	>
																		{tBtn.label}
																	</button>
																))}
															</div>
														</div>
													</div>

													<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
														<For each={filteredCatalogItems()}>
															{(item) => {
																const isCurrent = () =>
																	(catalogTab() === 'models' &&
																		modelTrait()?.value === item.name) ||
																	(catalogTab() === 'backdrops' &&
																		backdropTrait()?.value === item.name) ||
																	(catalogTab() === 'symbols' &&
																		symbolTrait()?.value === item.name);

																return (
																	<div
																		class={`flex items-center justify-between gap-2.5 rounded-xl border p-2.5 transition ${
																			isCurrent()
																				? 'border-cyan-400/60 bg-cyan-950/30'
																				: 'border-white/10 bg-slate-950/70 hover:border-white/25'
																		}`}
																	>
																		<div class="flex items-center gap-2.5 min-w-0">
																			<Show
																				when={item.image_url}
																				fallback={
																					<span
																						class="h-10 w-10 rounded-xl border border-white/20 shrink-0"
																						style={{
																							background: `radial-gradient(circle, ${item.center_hex || '#334155'}, ${item.edge_hex || '#0f172a'})`,
																						}}
																					/>
																				}
																			>
																				<img
																					src={item.image_url}
																					alt={item.name}
																					class="h-10 w-10 rounded-xl object-contain bg-slate-900 p-1 border border-white/10 shrink-0"
																				/>
																			</Show>

																			<div class="min-w-0">
																				<div
																					class="text-xs font-bold text-white truncate"
																					dir="ltr"
																				>
																					{item.name}
																				</div>
																				<div
																					class="text-[11px] font-mono text-amber-300"
																					dir="ltr"
																				>
																					{item.rarity_pct}%{' '}
																					<Show
																						when={
																							item.original_rarity_pct &&
																							item.original_rarity_pct !==
																								item.rarity_pct
																						}
																					>
																						<span class="text-[10px] text-slate-400">
																							(Orig: {item.original_rarity_pct}%)
																						</span>
																					</Show>
																				</div>
																				<Show when={item.estimated_floor_gram}>
																					<div
																						class="text-[10px] font-mono text-emerald-400"
																						dir="ltr"
																					>
																						Est. Floor: ~
																						{formatTon(
																							item.estimated_floor_gram,
																						)}{' '}
																						TON
																					</div>
																				</Show>
																			</div>
																		</div>

																		<button
																			type="button"
																			onClick={() =>
																				simulateSingleCatalogItem(
																					catalogTab(),
																					item.name,
																				)
																			}
																			class="rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/25 px-2.5 py-1 text-[10px] font-bold text-cyan-200 shrink-0 cursor-pointer"
																		>
																			{isCurrent() ? 'تریت فعلی' : 'شبیه‌سازی'}
																		</button>
																	</div>
																);
															}}
														</For>
													</div>
												</section>
											)}
										</Show>
									</div>
								</Show>

								{/* ═══════════════════════════════════════════════════════════
								    TAB 3: OWNER WHALE X-RAY, PROVENANCE & BINARY FORENSICS
								   ═══════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'ownership'}>
									<div class="space-y-5">
										{/* Owner Whale X-Ray */}
										<Show when={rep().owner_intelligence}>
											{(owner) => (
												<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
													<div class="flex flex-wrap items-center justify-between gap-2">
														<div>
															<h3 class="text-sm sm:text-base font-bold text-white">
																۰۱. کالبدشکافی کیف‌پول مالک و نهنگ‌شناسی (Owner Whale X-Ray)
															</h3>
															<p class="text-xs text-slate-400">
																استعلام مستقیم موجودی و سایر گیفت‌های کلکسیونی نگهداری‌شده در کیف‌پول مالک از TonAPI
															</p>
														</div>
														<div class="flex items-center gap-3 text-xs">
															<span class="font-bold text-cyan-300">
																{owner().whale_tier_fa}
															</span>
															<A
																href={`/gifts/portfolio?u=${encodeURIComponent(owner().owner_ton_domain || owner().owner_wallet_address || owner().owner_display)}`}
																class="rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-1.5 text-xs font-bold text-emerald-300 transition"
															>
																اسکن کامل پورتفوی مالک ↗
															</A>
														</div>
													</div>

													<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
														<div class="rounded-xl border border-white/10 bg-slate-950/70 p-3.5">
															<div class="text-[11px] text-slate-400">
																شناسه / دامنه مالک
															</div>
															<div
																class="mt-1 text-sm font-bold font-mono text-white truncate"
																dir="ltr"
															>
																{owner().owner_display}
															</div>
															<Show when={owner().owner_wallet_address}>
																<button
																	type="button"
																	onClick={() =>
																		copyToClipboard(
																			owner().owner_wallet_address || '',
																			'owner_addr',
																		)
																	}
																	class="mt-1 text-[10px] font-mono text-cyan-400 hover:underline cursor-pointer"
																	dir="ltr"
																>
																	{copiedKey() === 'owner_addr'
																		? 'Copied Address!'
																		: `${owner().owner_wallet_address?.slice(0, 8)}...${owner().owner_wallet_address?.slice(-6)}`}
																</button>
															</Show>
														</div>

														<div class="rounded-xl border border-white/10 bg-slate-950/70 p-3.5">
															<div class="text-[11px] text-slate-400">
																موجودی نقد کیف‌پول (TON)
															</div>
															<div
																class="mt-1 text-base font-black font-mono text-emerald-400"
																dir="ltr"
															>
																{owner().wallet_balance_ton !== undefined
																	? `${formatTon(owner().wallet_balance_ton)} TON`
																	: 'حساب داخلی تلگرام'}
															</div>
															<Show
																when={owner().wallet_balance_usd !== undefined}
															>
																<div
																	class="text-[10px] font-mono text-slate-400"
																	dir="ltr"
																>
																	{formatUsd(owner().wallet_balance_usd || 0)}
																</div>
															</Show>
														</div>

														<div class="rounded-xl border border-white/10 bg-slate-950/70 p-3.5">
															<div class="text-[11px] text-slate-400">
																تعداد گیفت‌های تلگرام در کیف‌پول
															</div>
															<div
																class="mt-1 text-base font-black font-mono text-white"
																dir="ltr"
															>
																{owner().telegram_gifts_held_count} Gifts
															</div>
															<div class="text-[10px] text-slate-400">
																از مجموع {owner().total_nfts_count} NFT در کیف‌پول
															</div>
														</div>

														<div class="rounded-xl border border-white/10 bg-slate-950/70 p-3.5">
															<div class="text-[11px] text-slate-400">
																تعداد از همین کلکسیون
															</div>
															<div
																class="mt-1 text-base font-black font-mono text-amber-300"
																dir="ltr"
															>
																{owner().same_collection_held_count} Items
															</div>
															<div class="text-[10px] text-slate-400">
																تمرکز مالک در این کلکسیون
															</div>
														</div>
													</div>

													{/* Other Gifts Held by This Owner */}
													<Show when={owner().other_gifts_sample.length > 0}>
														<div class="pt-2">
															<div class="text-xs font-bold text-slate-300 mb-2.5">
																سایر گیفت‌های کلکسیونی موجود در کیف‌پول همین مالک (کلیک برای بررسی):
															</div>
															<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
																<For each={owner().other_gifts_sample}>
																	{(item) => (
																		<div class="flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-950/80 p-2 hover:border-cyan-500/40 transition">
																			<img
																				src={item.image_url}
																				alt={item.name}
																				class="h-10 w-10 rounded-lg object-cover border border-white/10 shrink-0"
																			/>
																			<div class="min-w-0 flex-1">
																				<div
																					class="text-xs font-bold text-white truncate"
																					dir="ltr"
																				>
																					{item.name}
																				</div>
																				<div class="flex items-center gap-2 mt-0.5">
																					<Show when={item.gift_id}>
																						<button
																							type="button"
																							onClick={() =>
																								selectPresetGift(item.gift_id!)
																							}
																							class="text-[10px] text-cyan-400 hover:underline cursor-pointer"
																						>
																							تحلیل گیفت
																						</button>
																					</Show>
																					<a
																						href={item.tonviewer_url}
																						target="_blank"
																						rel="noopener noreferrer"
																						class="text-[10px] text-slate-400 hover:text-white"
																					>
																						Tonviewer ↗
																					</a>
																				</div>
																			</div>
																		</div>
																	)}
																</For>
															</div>
														</div>
													</Show>
												</section>
											)}
										</Show>

										{/* Real Ownership & Provenance Timeline */}
										<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
											<div>
												<h3 class="text-sm sm:text-base font-bold text-white">
													۰۲. تاریخچه مالکیت و معاملات ثبت‌شده در فرگمنت (Ownership History)
												</h3>
												<p class="text-xs text-slate-400">
													تمامی رخدادهای فروش، انتقال کیف‌پول و ارتقای اولیه این شماره سریال
												</p>
											</div>

											<div class="space-y-2.5">
												<For each={rep().provenance}>
													{(ev) => (
														<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/75 p-3.5">
															<div class="flex items-center gap-3">
																<span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono font-bold text-cyan-300">
																	{ev.event_type === 'sold'
																		? 'SALE'
																		: ev.event_type === 'listed'
																			? 'ASK'
																			: ev.event_type === 'upgraded'
																				? 'MINT'
																				: 'TX'}
																</span>
																<div>
																	<div class="text-xs font-bold text-white">
																		{ev.note || ev.event_type}
																	</div>
																	<div class="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
																		<span>بستر: {ev.venue}</span>
																		<Show when={ev.to_username || ev.to_address}>
																			<span aria-hidden="true">·</span>
																			<span class="font-mono" dir="ltr">
																				{ev.to_username ||
																					`${ev.to_address?.slice(0, 8)}...${ev.to_address?.slice(-6)}`}
																			</span>
																		</Show>
																	</div>
																</div>
															</div>

															<div class="text-left">
																<Show when={ev.price_gram && ev.price_gram > 0}>
																	<div
																		class="font-mono text-sm font-black text-emerald-400"
																		dir="ltr"
																	>
																		{formatTon(ev.price_gram)} TON
																	</div>
																</Show>
																<div class="text-[11px] text-slate-400">
																	{formatDateFa(ev.timestamp)}
																</div>
															</div>
														</div>
													)}
												</For>
											</div>
										</section>

										{/* Binary & Smart Contract Telemetry */}
										<Show when={rep().binary_forensics}>
											{(bin) => (
												<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
													<div>
														<h3 class="text-sm sm:text-base font-bold text-white">
															۰۳. کالبدشکافی باینری، TEP-62 و اسکیمای MTProto تلگرام
														</h3>
														<p class="text-xs text-slate-400">
															مشخصات فنی سطح پروتکل تلگرام، شناسه قرارداد ۶۴ بیتی و لینک‌های مستقیم متادیتا
														</p>
													</div>

													<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
														<div class="rounded-xl border border-white/10 bg-slate-950/75 p-3">
															<div class="text-[11px] text-slate-400">
																شناسه قرارداد کلکسیون (Contract ID)
															</div>
															<div
																class="mt-1 font-mono font-bold text-cyan-300"
																dir="ltr"
															>
																{bin().collection_contract_id}
															</div>
														</div>

														<div class="rounded-xl border border-white/10 bg-slate-950/75 p-3">
															<div class="text-[11px] text-slate-400">
																شناسه ایموجی سفارشی (Custom Emoji ID)
															</div>
															<div
																class="mt-1 font-mono font-bold text-white"
																dir="ltr"
															>
																{bin().custom_emoji_id}
															</div>
														</div>

														<div class="rounded-xl border border-white/10 bg-slate-950/75 p-3">
															<div class="text-[11px] text-slate-400">
																تعداد ارتقایافته (Issued / Supply)
															</div>
															<div
																class="mt-1 font-mono font-bold text-emerald-400"
																dir="ltr"
															>
																{bin().issued_count.toLocaleString()} /{' '}
																{bin().total_supply_count.toLocaleString()} (
																{bin().upgraded_percentage}%)
															</div>
														</div>

														<div class="rounded-xl border border-white/10 bg-slate-950/75 p-3">
															<div class="text-[11px] text-slate-400">
																سازنده باینری MTProto (TL Constructor)
															</div>
															<div
																class="mt-1 font-mono text-[11px] font-bold text-amber-300"
																dir="ltr"
															>
																{bin().mtproto_constructor}
															</div>
														</div>

														<div class="rounded-xl border border-white/10 bg-slate-950/75 p-3">
															<div class="text-[11px] text-slate-400">
																استاندارد قرارداد هوشمند TON
															</div>
															<div
																class="mt-1 font-mono text-[11px] font-bold text-slate-200"
																dir="ltr"
															>
																{bin().tep62_standard}
															</div>
														</div>

														<div class="rounded-xl border border-white/10 bg-slate-950/75 p-3">
															<div class="text-[11px] text-slate-400">
																لینک‌های مستقیم فایل‌های رسمی (Raw Assets)
															</div>
															<div
																class="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px]"
																dir="ltr"
															>
																<a
																	href={bin().metadata_json_url}
																	target="_blank"
																	rel="noopener noreferrer"
																	class="text-cyan-400 hover:underline"
																>
																	JSON ↗
																</a>
																<a
																	href={bin().lottie_url}
																	target="_blank"
																	rel="noopener noreferrer"
																	class="text-cyan-400 hover:underline"
																>
																	Lottie ↗
																</a>
																<a
																	href={bin().webp_url}
																	target="_blank"
																	rel="noopener noreferrer"
																	class="text-cyan-400 hover:underline"
																>
																	WebP ↗
																</a>
																<a
																	href={bin().tme_nft_url}
																	target="_blank"
																	rel="noopener noreferrer"
																	class="text-cyan-400 hover:underline"
																>
																	t.me/nft ↗
																</a>
															</div>
														</div>
													</div>
												</section>
											)}
										</Show>
									</div>
								</Show>

								{/* ═══════════════════════════════════════════════════════════
								    TAB 4: CONSOLIDATED 6-VENUE MATRIX, CRAFTING FORGE & RISK AUDIT
								   ═══════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'venues'}>
									<div class="space-y-5">
										{/* Consolidated 6-Venue Net Proceeds & Arbitrage Matrix */}
										<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
											<div class="flex flex-wrap items-center justify-between gap-2">
												<div>
													<h3 class="text-sm sm:text-base font-bold text-white">
														۰۱. ماتریس یکپارچه کارمزد و خالص دریافتی در ۶ مارکت‌پلیس تلگرام
													</h3>
													<p class="text-xs text-slate-400">
														مقایسه خروجی خالص پس از کسر کمیسیون پلتفرم و گس شبکه برای فروش این گیفت
													</p>
												</div>

												<span class="text-xs font-bold text-emerald-300">
													بهترین خروجی: {rep().exit_planner?.best_venue_name} ·
													اختلاف آربیتراژ:{' '}
													{rep().exit_planner?.arbitrage_spread_pct}%
												</span>
											</div>

											<div class="overflow-x-auto">
												<table class="w-full text-right text-xs">
													<thead>
														<tr class="border-b border-white/10 text-[11px] text-slate-400">
															<th class="pb-2.5 font-semibold">
																رتبه و مارکت‌پلیس
															</th>
															<th class="pb-2.5 font-semibold">
																قیمت ناخالص فروش
															</th>
															<th class="pb-2.5 font-semibold">کارمزد پلتفرم</th>
															<th class="pb-2.5 font-semibold">
																خالص دریافتی شما (Net)
															</th>
															<th class="pb-2.5 font-semibold">وضعیت KYC</th>
															<th class="pb-2.5 font-semibold">
																توضیحات عملیاتی
															</th>
															<th class="pb-2.5 font-semibold text-left">
																ورود به بازار
															</th>
														</tr>
													</thead>
													<tbody class="divide-y divide-white/[0.06]">
														<For each={rep().exit_planner?.options || []}>
															{(opt) => (
																<tr
																	class={`hover:bg-white/[0.02] transition ${
																		opt.rank === 1 ? 'bg-emerald-950/15' : ''
																	}`}
																>
																	<td class="py-3 font-bold text-white">
																		<span class="font-mono text-cyan-400 ml-1.5">
																			0{opt.rank}.
																		</span>
																		<span>{opt.venue_name}</span>
																	</td>
																	<td
																		class="py-3 font-mono text-slate-200"
																		dir="ltr"
																	>
																		{formatTon(opt.gross_price_gram)} TON
																	</td>
																	<td
																		class="py-3 font-mono text-amber-300"
																		dir="ltr"
																	>
																		{opt.fee_percent}% (-
																		{formatTon(opt.fee_amount_gram)} TON)
																	</td>
																	<td
																		class="py-3 font-mono font-black text-emerald-400"
																		dir="ltr"
																	>
																		{formatTon(opt.net_payout_gram)} TON
																		<div class="text-[10px] font-normal text-slate-400">
																			{formatUsd(opt.net_payout_usd)}
																		</div>
																	</td>
																	<td class="py-3 text-[11px]">
																		<span
																			class={
																				opt.requires_kyc
																					? 'text-amber-300'
																					: 'text-emerald-300'
																			}
																		>
																			{opt.requires_kyc
																				? 'نیازمند KYC'
																				: 'بدون KYC'}
																		</span>
																	</td>
																	<td class="py-3 text-[11px] text-slate-300 max-w-xs">
																		{opt.recommendation_note}
																	</td>
																	<td class="py-3 text-left">
																		<a
																			href={opt.deep_link}
																			target="_blank"
																			rel="noopener noreferrer"
																			class="rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 px-2.5 py-1 text-[11px] font-bold text-cyan-300"
																		>
																			معامله ↗
																		</a>
																	</td>
																</tr>
															)}
														</For>
													</tbody>
												</table>
											</div>
										</section>

										{/* Live Crafting Forge Intelligence (from api.changes.tg/crafts) */}
										<Show when={rep().crafting_forge}>
											{(forge) => (
												<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-4">
													<div class="flex flex-wrap items-center justify-between gap-2">
														<div>
															<h3 class="text-sm sm:text-base font-bold text-white">
																۰۲. هوشمندی کارگاه کرفت تلگرام (Crafting Forge & Burn Guard)
															</h3>
															<p class="text-xs text-slate-400">
																بررسی وضعیت کرفت‌پذیری کلکسیون و مدل‌های انحصاری کارگاه از{' '}
																<code class="font-mono">
																	api.changes.tg/crafts
																</code>
															</p>
														</div>

														<div class="flex items-center gap-3 text-xs">
															<span
																class={`font-bold ${
																	forge().burn_candidate_verdict ===
																	'DO_NOT_BURN_PREMIUM'
																		? 'text-rose-300'
																		: forge().burn_candidate_verdict ===
																				'SAFE_BURN_FLOOR'
																			? 'text-emerald-300'
																			: 'text-slate-400'
																}`}
															>
																{forge().burn_candidate_verdict ===
																'DO_NOT_BURN_PREMIUM'
																	? '⛔ ممنوعیت سوزاندن در کرفت (دارای پریمیوم)'
																	: forge().burn_candidate_verdict ===
																			'SAFE_BURN_FLOOR'
																		? '✅ مناسب برای ورودی کرفت (کف قیمت)'
																		: 'فاقد کارگاه کرفت فعال'}
															</span>
															<A
																href="/gifts/crafting"
																class="rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 text-xs font-bold text-amber-200 transition"
															>
																ماشین‌حساب مونت‌کارلو کرفت ↗
															</A>
														</div>
													</div>

													<div class="rounded-xl border border-white/10 bg-slate-950/75 p-3.5 text-xs text-slate-200 leading-relaxed">
														{forge().burn_candidate_reason_fa}
														<div
															class="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono"
															dir="ltr"
														>
															<span>
																4x Floor Forge Cost:{' '}
																{formatTon(forge().forge_input_cost_4x_gram)}{' '}
																TON (
																{formatUsd(forge().forge_input_cost_4x_usd)})
															</span>
															<span aria-hidden="true">·</span>
															<span>
																Crafted Exclusive Models:{' '}
																{forge().crafted_models_count}
															</span>
														</div>
													</div>

													<Show when={forge().crafted_models.length > 0}>
														<div>
															<div class="text-xs font-bold text-slate-300 mb-2.5">
																مدل‌های انحصاری قابل ساخت در کارگاه کرفت این کلکسیون:
															</div>
															<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
																<For each={forge().crafted_models}>
																	{(cm) => (
																		<div class="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/80 p-2.5">
																			<img
																				src={cm.image_url}
																				alt={cm.name}
																				class="h-12 w-12 object-contain shrink-0"
																			/>
																			<div class="min-w-0">
																				<div
																					class="text-xs font-bold text-white truncate"
																					dir="ltr"
																				>
																					{cm.name}
																				</div>
																				<div class="text-[10px] font-mono text-amber-300 uppercase mt-0.5">
																					{cm.rarity} ({cm.rarity_permille / 10}
																					%)
																				</div>
																			</div>
																		</div>
																	)}
																</For>
															</div>
														</div>
													</Show>
												</section>
											)}
										</Show>

										{/* Security & Authenticity Audit Checklist */}
										<Show when={rep().risk_audit}>
											{(audit) => (
												<section class="rounded-2xl border border-white/10 bg-slate-900/75 p-4 sm:p-5 space-y-3">
													<h3 class="text-sm sm:text-base font-bold text-white">
														۰۳. ممیزی امنیت، اصالت قرارداد و ریسک اردربوک
													</h3>
													<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
														<For each={audit().risk_checklist}>
															{(item) => (
																<div class="rounded-xl border border-white/10 bg-slate-950/75 p-3.5 space-y-1">
																	<div class="flex items-center justify-between">
																		<span class="text-xs font-bold text-white">
																			{item.title_fa}
																		</span>
																		<span
																			class={`text-xs font-bold ${
																				item.passed
																					? 'text-emerald-400'
																					: 'text-amber-400'
																			}`}
																		>
																			{item.passed ? '✓ تاییدشده' : '⚠ توجه'}
																		</span>
																	</div>
																	<p class="text-[11px] text-slate-400 leading-relaxed">
																		{item.detail}
																	</p>
																</div>
															)}
														</For>
													</div>
												</section>
											)}
										</Show>
									</div>
								</Show>

								{/* Required Attribution Footer */}
								<footer class="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
									<div>
										منابع داده زنده:{' '}
										<span class="font-mono text-slate-300">fragment.com</span> ·{' '}
										<span class="font-mono text-slate-300">t.me/nft</span> ·{' '}
										<span class="font-mono text-slate-300">tonapi.io</span> ·{' '}
										<a
											href="https://t.me/GiftChanges"
											target="_blank"
											rel="noopener noreferrer"
											class="text-cyan-400 hover:underline font-mono"
										>
											@GiftChanges (api.changes.tg)
										</a>
									</div>
									<div class="font-mono" dir="ltr">
										Certificate: {rep().certificate_id}
									</div>
								</footer>
							</>
						);
					}}
				</Show>
			</main>
		</div>
	);
}
export default GiftReportPage;
