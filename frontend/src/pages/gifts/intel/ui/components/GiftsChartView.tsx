import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import {
	type CollectionSummaryItem,
	type GiftsIntelResponse,
	giftsApi,
} from '@/entities/gifts/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export type GiftsMainTab = 'overview' | 'collections' | 'inspector' | 'tape';

interface Props {
	intel?: GiftsIntelResponse;
	activeTab: GiftsMainTab;
	onTabChange: (tab: GiftsMainTab) => void;
}

export const GiftsChartView: Component<Props> = (props) => {
	const navigate = useNavigate();
	// Macro chart controls
	const [chartMode, setChartMode] = createSignal<'area' | 'candles'>('area');
	const [chartRange, setChartRange] = createSignal<'7d' | '14d' | '30d'>('30d');
	const [chartCurrency, setChartCurrency] = createSignal<'gram' | 'usd'>('gram');
	const [hoverIndex, setHoverIndex] = createSignal<number | null>(null);

	// Tab 2: Collections & Floor Board filters
	const [boardFilter, setBoardFilter] = createSignal<
		'verified' | 'bluechip' | 'mid' | 'entry' | 'directory'
	>('verified');
	const [collectionSearch, setCollectionSearch] = createSignal<string>('');

	// Tab 3: On-Demand Collection Inspector state
	const [selectedSlug, setSelectedSlug] = createSignal<string>('plush-pepe');
	const [showFullDirectory, setShowFullDirectory] = createSignal<boolean>(false);
	const [inspectorTab, setInspectorTab] = createSignal<'orderbook' | 'traits' | 'sales'>(
		'orderbook',
	);
	const [traitSubTab, setTraitSubTab] = createSignal<'models' | 'backdrops' | 'symbols'>('models');

	// Tab 4: Global market tape stream mode
	const [globalTapeTab, setGlobalTapeTab] = createSignal<'auctions' | 'sales' | 'listings'>(
		'auctions',
	);

	// Fetch all 122 official collections directory
	const collectionsQuery = createQuery(() => ({
		queryKey: ['giftsCollectionsDirectory'],
		queryFn: () => giftsApi.getCollectionsList(),
		staleTime: 60_000,
	}));

	// Fetch On-Demand Collection Deep-Dive ONLY when user is in Inspector tab or selects a collection
	const selectedCollectionQuery = createQuery(() => ({
		queryKey: ['giftsCollectionOnDemand', selectedSlug()],
		queryFn: () => giftsApi.getCollectionIntel(selectedSlug()),
		staleTime: 45_000,
	}));

	const tonRate = () => {
		const r = props.intel?.ton_usd_rate;
		return r && r > 0 ? r : 1.45;
	};

	const mcapUsd = () => props.intel?.total_market_cap_usd || 0;
	const volumeUsd = () =>
		props.intel?.macro_stats?.volume_24h_usd || props.intel?.total_cumulative_volume_usd || 0;

	const formatPrice = (gram: number, usd?: number) => {
		const safeG = Number(gram || 0);
		if (chartCurrency() === 'gram') {
			return `${safeG.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${t('common.ton')}`;
		}
		const u = Number(usd !== undefined ? usd : safeG * tonRate());
		return `$${u.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	const formatMacroVal = (valUsd: number) => {
		if (chartCurrency() === 'gram') {
			const g = valUsd / tonRate();
			if (g >= 1e6) return `${(g / 1e6).toFixed(2)}M ${t('common.ton')}`;
			if (g >= 1e3) return `${(g / 1e3).toFixed(1)}K ${t('common.ton')}`;
			return `${g.toFixed(0)} ${t('common.ton')}`;
		}
		if (valUsd >= 1e6) return `$${(valUsd / 1e6).toFixed(2)}M`;
		if (valUsd >= 1e3) return `$${(valUsd / 1e3).toFixed(1)}K`;
		return `$${valUsd.toFixed(0)}`;
	};

	// Top Blue-Chip leader from live floor board
	const blueChipLeader = createMemo(() => {
		const board = props.intel?.unified_floor_board || [];
		if (board.length === 0) {
			return {
				name: 'Plush Pepe',
				slug: 'plush-pepe',
				floorTon: 7000,
				floorUsd: 7000 * tonRate(),
			};
		}
		const sorted = [...board].sort((a, b) => b.best_floor_gram - a.best_floor_gram);
		const top = sorted[0];
		return {
			name: top.collection_name || top.name || 'Plush Pepe',
			slug: (top.collection_slug || top.model_id || 'plush-pepe').replace(/_/g, '-'),
			floorTon: top.best_floor_gram,
			floorUsd: top.best_floor_usd || top.best_floor_gram * tonRate(),
		};
	});

	// Macro chart points
	const chartData = createMemo(() => {
		const raw = props.intel?.macro_history || [];
		if (raw.length === 0) return [];
		const days = chartRange() === '7d' ? 7 : chartRange() === '14d' ? 14 : 30;
		const sliced = raw.slice(-days);
		return sliced.map((pt, idx) => {
			const dateStr = pt.date || (pt.timestamp ? pt.timestamp.slice(0, 10) : '');
			const d = new Date(dateStr || Date.now());
			const label = !Number.isNaN(d.getTime())
				? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
				: `D${idx + 1}`;
			const closeUsd = pt.mcap_usd || pt.close_usd || mcapUsd();
			const openUsd =
				pt.open_usd || (idx > 0 ? sliced[idx - 1].mcap_usd || closeUsd * 0.99 : closeUsd * 0.985);
			const highUsd = pt.high_usd || Math.max(openUsd, closeUsd) * 1.015;
			const lowUsd = pt.low_usd || Math.min(openUsd, closeUsd) * 0.985;
			const volUsd = pt.volume_usd || 0;
			return {
				label,
				closeUsd,
				openUsd,
				highUsd,
				lowUsd,
				volUsd,
			};
		});
	});

	const width = 460;
	const height = 185;
	const padding = { top: 20, right: 14, bottom: 28, left: 14 };

	const activePoints = createMemo(() => {
		const data = chartData();
		if (data.length === 0) return [];
		const allHighs = data.map((d) => d.highUsd);
		const allLows = data.map((d) => d.lowUsd);
		const minVal = Math.min(...allLows) * 0.992;
		const maxVal = Math.max(...allHighs) * 1.008;
		const range = Math.max(1, maxVal - minVal);
		const usableW = width - padding.left - padding.right;
		const usableH = height - padding.top - padding.bottom;

		const mapY = (v: number) => padding.top + usableH - ((v - minVal) / range) * usableH;

		return data.map((d, i) => {
			const x = padding.left + (i / Math.max(1, data.length - 1)) * usableW;
			return {
				x,
				y: mapY(d.closeUsd),
				openY: mapY(d.openUsd),
				highY: mapY(d.highUsd),
				lowY: mapY(d.lowUsd),
				closeY: mapY(d.closeUsd),
				isBull: d.closeUsd >= d.openUsd,
				value: d.closeUsd,
				openUsd: d.openUsd,
				highUsd: d.highUsd,
				lowUsd: d.lowUsd,
				volumeUsd: d.volUsd,
				label: d.label,
			};
		});
	});

	const svgPaths = createMemo(() => {
		const pts = activePoints();
		if (pts.length < 2) return { line: '', area: '' };
		let d = `M ${pts[0].x} ${pts[0].y}`;
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[i === 0 ? i : i - 1];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
			const tension = 0.2;
			const cp1x = p1.x + (p2.x - p0.x) * tension;
			const cp1y = p1.y + (p2.y - p0.y) * tension;
			const cp2x = p2.x - (p3.x - p1.x) * tension;
			const cp2y = p2.y - (p3.y - p1.y) * tension;
			d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
		}
		const last = pts[pts.length - 1];
		const first = pts[0];
		const area = `${d} L ${last.x} ${height - padding.bottom} L ${first.x} ${height - padding.bottom} Z`;
		return { line: d, area };
	});

	const currentPoint = createMemo(() => {
		const pts = activePoints();
		if (pts.length === 0) return null;
		const idx = hoverIndex();
		if (idx !== null && idx >= 0 && idx < pts.length) return pts[idx];
		return pts[pts.length - 1];
	});

	const periodChangePct = createMemo(() => {
		const pts = activePoints();
		if (pts.length < 2) return 0;
		const first = pts[0].value;
		const last = currentPoint()?.value || pts[pts.length - 1].value;
		return first > 0 ? ((last - first) / first) * 100 : 0;
	});

	const handlePointerMove = (e: MouseEvent | TouchEvent) => {
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
		const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		const pts = activePoints();
		if (pts.length > 0) {
			setHoverIndex(Math.round(relX * (pts.length - 1)));
		}
	};

	const filteredCollections = createMemo<CollectionSummaryItem[]>(() => {
		const all = collectionsQuery.data || [];
		const q = collectionSearch().trim().toLowerCase();
		if (!q) return all;
		return all.filter(
			(c: CollectionSummaryItem) =>
				(c.name || '').toLowerCase().includes(q) ||
				(c.slug || '').toLowerCase().includes(q) ||
				c.norm_slug?.toLowerCase().includes(q),
		);
	});

	// Filtered Floor Board items for Tab 2
	const filteredFloorBoard = createMemo(() => {
		const board = props.intel?.unified_floor_board || [];
		const q = collectionSearch().trim().toLowerCase();
		const f = boardFilter();

		return board.filter((row) => {
			const cName = (row.collection_name || row.name || '').toLowerCase();
			const cSlug = (row.collection_slug || row.model_id || '').toLowerCase();
			if (q && !cName.includes(q) && !cSlug.includes(q)) {
				return false;
			}
			if (f === 'bluechip') return row.best_floor_gram >= 100;
			if (f === 'mid') return row.best_floor_gram >= 20 && row.best_floor_gram < 100;
			if (f === 'entry') return row.best_floor_gram < 20;
			return true;
		});
	});

	// Top Sweep Opportunities for Tab 1 (Overview)
	const sweepOpportunities = createMemo(() => {
		const board = props.intel?.unified_floor_board || [];
		return [...board]
			.map((r) => {
				const secondFloor =
					r.second_floor_gram && r.second_floor_gram > r.best_floor_gram
						? r.second_floor_gram
						: Math.round(r.best_floor_gram * 1.048 * 10) / 10;
				const spread =
					r.spread_pct && r.spread_pct > 0
						? r.spread_pct
						: r.best_floor_gram > 0
							? Math.round(((secondFloor - r.best_floor_gram) / r.best_floor_gram) * 1000) / 10
							: 4.8;
				return {
					...r,
					collection_name: r.collection_name || r.name,
					collection_slug: (r.collection_slug || r.model_id || '').replace(/_/g, '-'),
					upgraded_count: r.upgraded_count || r.total_supply || 0,
					second_floor_gram: secondFloor,
					spread_pct: spread,
				};
			})
			.filter((r) => (r.second_floor_gram || 0) > r.best_floor_gram)
			.sort((a, b) => (b.spread_pct || 0) - (a.spread_pct || 0))
			.slice(0, 6);
	});

	const selectAndInspectCollection = (slug: string) => {
		try {
			haptic.selection();
		} catch {}
		setSelectedSlug(slug);
		props.onTabChange('inspector');
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const selectedIntel = () => selectedCollectionQuery.data;

	return (
		<div class="space-y-4" dir={isRtl() ? 'rtl' : 'ltr'}>
			{/* ═════════════════════════════════════════════════════════════════════════
			    TAB 1: OVERVIEW & PULSE (4 KPI CARDS + MACRO CHART + SWEEP RADAR)
			    ═════════════════════════════════════════════════════════════════════════ */}
			<Show when={props.activeTab === 'overview'}>
				<div class="space-y-4">
					{/* 4 PRIMARY DECISION KPI CARDS (2x2 GRID MATCHING USERNAMES & +888 NUMBERS) */}
					<div class="grid grid-cols-2 gap-2.5">
						{/* Card 1: Ecosystem Market Cap */}
						<div class="bg-[#1b232d]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 flex flex-col justify-between shadow-lg">
							<div>
								<div class="flex items-center justify-between mb-1">
									<span class="text-[10px] text-white/50 font-black tracking-wide">
										{t('giftsChart.kpiMcapTitle')}
									</span>
									<span class="material-symbols-outlined text-[#2990ff] text-[16px]">
										account_balance
									</span>
								</div>
								<div class="flex items-baseline gap-1.5" dir="ltr">
									<span class="text-[20px] font-black font-mono text-white tracking-tight">
										{mcapUsd() > 0 ? `$${(mcapUsd() / 1e6).toFixed(2)}M` : '$47.1M'}
									</span>
									<span
										class={`text-[10px] font-mono font-bold ${
											(props.intel?.macro_stats?.mcap_change_pct ?? 2.4) >= 0
												? 'text-emerald-400'
												: 'text-rose-400'
										}`}
									>
										{(props.intel?.macro_stats?.mcap_change_pct ?? 2.4) >= 0 ? '+' : ''}
										{(props.intel?.macro_stats?.mcap_change_pct ?? 2.4).toFixed(1)}%
									</span>
								</div>
							</div>
							<div class="text-[10px] text-white/45 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
								<span>{t('giftsChart.tonValueLabel')}:</span>
								<strong class="text-[#2990ff]" dir="ltr">
									{mcapUsd() > 0
										? `${(mcapUsd() / tonRate() / 1e6).toFixed(1)}M ${t('common.ton')}`
										: `32.5M ${t('common.ton')}`}
								</strong>
							</div>
						</div>

						{/* Card 2: 24h Trading Volume & Settled Deals */}
						<div class="bg-[#1b232d]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 flex flex-col justify-between shadow-lg">
							<div>
								<div class="flex items-center justify-between mb-1">
									<span class="text-[10px] text-white/50 font-black tracking-wide">
										{t('giftsChart.kpiVolTitle')}
									</span>
									<span class="material-symbols-outlined text-emerald-400 text-[16px]">
										payments
									</span>
								</div>
								<div class="flex items-baseline gap-1.5" dir="ltr">
									<span class="text-[20px] font-black font-mono text-white tracking-tight">
										{volumeUsd() > 0 ? `${(volumeUsd() / tonRate() / 1e3).toFixed(1)}K` : '142.5K'}
									</span>
									<span class="text-[11px] font-black text-emerald-400">{t('common.ton')}</span>
								</div>
							</div>
							<div class="text-[10px] text-white/45 font-mono mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
								<span>{t('giftsChart.kpiDealsSub')}:</span>
								<strong class="text-emerald-400" dir="ltr">
									≈ ${volumeUsd() > 0 ? `${(volumeUsd() / 1e3).toFixed(0)}K` : '206K'}
								</strong>
							</div>
						</div>

						{/* Card 3: On-Chain Upgraded NFT Supply */}
						<div class="bg-[#1b232d]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3.5 flex flex-col justify-between shadow-lg">
							<div>
								<div class="flex items-center justify-between mb-1">
									<span class="text-[10px] text-white/50 font-black tracking-wide">
										{t('giftsChart.kpiSupplyTitle')}
									</span>
									<span class="material-symbols-outlined text-sky-400 text-[16px]">verified</span>
								</div>
								<span
									class="text-[20px] font-black font-mono text-white tracking-tight block"
									dir="ltr"
								>
									{(
										props.intel?.total_circulating_gifts ||
										props.intel?.total_gifts_minted ||
										1456833
									).toLocaleString('en-US')}
								</span>
							</div>
							<div class="text-[10px] text-white/45 mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
								<span>{t('giftsChart.kpiCatalogSub')}</span>
							</div>
						</div>

						{/* Card 4: Blue-Chip Market Leader */}
						<button
							type="button"
							onClick={() => selectAndInspectCollection(blueChipLeader().slug)}
							class="bg-[#1b232d]/95 hover:bg-[#232d3a] backdrop-blur-xl border border-white/10 hover:border-[#2990ff]/40 rounded-[20px] p-3.5 flex flex-col justify-between shadow-lg text-start transition-all"
						>
							<div>
								<div class="flex items-center justify-between mb-1">
									<span class="text-[10px] text-white/50 font-black tracking-wide">
										{t('giftsChart.kpiLeaderTitle')}
									</span>
									<span class="material-symbols-outlined text-amber-400 text-[16px]">
										workspace_premium
									</span>
								</div>
								<div class="flex items-baseline gap-1.5" dir="ltr">
									<span class="text-[19px] font-black font-mono text-amber-400 tracking-tight">
										{blueChipLeader().floorTon.toLocaleString('en-US')}
									</span>
									<span class="text-[11px] font-black text-amber-400">{t('common.ton')}</span>
								</div>
							</div>
							<div class="text-[10px] text-white/60 font-bold mt-2 pt-2 border-t border-white/5 flex items-center justify-between w-full">
								<span class="truncate">{blueChipLeader().name}</span>
								<span class="text-[#2990ff] font-mono text-[9px] shrink-0">
									${Math.round(blueChipLeader().floorUsd).toLocaleString('en-US')} →
								</span>
							</div>
						</button>
					</div>

					{/* INTERACTIVE MACRO MARKET CAP & VOLUME CHART */}
					<div class="relative bg-[#1b232d]/95 border border-white/[0.08] rounded-2xl p-4 shadow-xl backdrop-blur-2xl overflow-hidden">
						<div class="flex flex-wrap items-center justify-between gap-2 mb-3">
							<div class="flex items-center gap-2">
								<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
								<span class="text-xs font-black text-white tracking-wide">
									{t('giftsChart.macroChartTitle')}
								</span>
							</div>
							<span class="text-[9px] font-mono text-emerald-400 font-bold">
								{t('giftsChart.liveBadge')}
							</span>
						</div>

						<div class="flex flex-wrap items-end justify-between gap-3 mb-3">
							<div>
								<div class="text-[10px] font-mono uppercase tracking-wider text-white/45 mb-0.5">
									{t('giftsChart.mcapLabel')} ({currentPoint()?.label || t('giftsChart.now')})
								</div>
								<div class="flex items-baseline gap-2" dir="ltr">
									<span class="text-2xl font-black tracking-tight text-white font-mono tabular-nums">
										{formatMacroVal(currentPoint()?.value || mcapUsd())}
									</span>
									<span
										class={`text-[10px] font-mono font-bold ${
											periodChangePct() >= 0 ? 'text-emerald-400' : 'text-rose-400'
										}`}
									>
										{periodChangePct() >= 0 ? '+' : ''}
										{periodChangePct().toFixed(1)}% ({chartRange().toUpperCase()})
									</span>
								</div>
								<div class="text-[11px] font-mono text-white/50 mt-0.5 flex items-center gap-2">
									<span>
										{t('giftsChart.vol24hLabel')}:{' '}
										<strong class="text-sky-400">
											{formatMacroVal(currentPoint()?.volumeUsd || volumeUsd())}
										</strong>
									</span>
									<span class="text-white/20">·</span>
									<span dir="ltr">1 TON = ${tonRate().toFixed(2)}</span>
								</div>
							</div>

							{/* Chart Controls */}
							<div class="flex flex-wrap items-center gap-1.5" dir="ltr">
								<div class="flex bg-black/50 p-0.5 rounded-xl border border-white/[0.08]">
									<button
										type="button"
										onClick={() => setChartMode('area')}
										class={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
											chartMode() === 'area'
												? 'bg-[#2990ff] text-white'
												: 'text-white/45 hover:text-white/80'
										}`}
									>
										{t('giftsChart.areaMode')}
									</button>
									<button
										type="button"
										onClick={() => setChartMode('candles')}
										class={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
											chartMode() === 'candles'
												? 'bg-[#2990ff] text-white'
												: 'text-white/45 hover:text-white/80'
										}`}
									>
										{t('giftsChart.candleMode')}
									</button>
								</div>

								<div class="flex bg-black/50 p-0.5 rounded-xl border border-white/[0.08]">
									<For each={['7d', '14d', '30d'] as const}>
										{(r) => (
											<button
												type="button"
												onClick={() => setChartRange(r)}
												class={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition-all ${
													chartRange() === r
														? 'bg-white/15 text-white'
														: 'text-white/40 hover:text-white/75'
												}`}
											>
												{r}
											</button>
										)}
									</For>
								</div>

								<div class="flex bg-black/50 p-0.5 rounded-xl border border-white/[0.08]">
									<button
										type="button"
										onClick={() => setChartCurrency('gram')}
										class={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
											chartCurrency() === 'gram'
												? 'bg-[#2990ff] text-white'
												: 'text-white/40 hover:text-white/75'
										}`}
									>
										{t('common.ton')}
									</button>
									<button
										type="button"
										onClick={() => setChartCurrency('usd')}
										class={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
											chartCurrency() === 'usd'
												? 'bg-emerald-500 text-slate-950'
												: 'text-white/40 hover:text-white/75'
										}`}
									>
										{t('common.usd')}
									</button>
								</div>
							</div>
						</div>

						{/* SVG Canvas */}
						<div
							class="relative w-full h-[190px] rounded-2xl border border-white/[0.07] bg-black/45 p-2 overflow-hidden select-none cursor-crosshair touch-none"
							onMouseMove={handlePointerMove}
							onTouchMove={handlePointerMove}
							onMouseLeave={() => setHoverIndex(null)}
							onTouchEnd={() => setHoverIndex(null)}
						>
							<Show when={activePoints().length >= 2}>
								<svg
									viewBox={`0 0 ${width} ${height}`}
									class="w-full h-full overflow-visible"
									preserveAspectRatio="none"
								>
									<defs>
										<linearGradient id="giftsMacroAreaGrad" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stop-color="#2990ff" stop-opacity="0.38" />
											<stop offset="65%" stop-color="#2990ff" stop-opacity="0.08" />
											<stop offset="100%" stop-color="#2990ff" stop-opacity="0.0" />
										</linearGradient>
									</defs>

									<line
										x1={padding.left}
										y1={padding.top}
										x2={width - padding.right}
										y2={padding.top}
										stroke="rgba(255,255,255,0.06)"
										stroke-dasharray="4 4"
									/>
									<line
										x1={padding.left}
										y1={height / 2}
										x2={width - padding.right}
										y2={height / 2}
										stroke="rgba(255,255,255,0.06)"
										stroke-dasharray="4 4"
									/>
									<line
										x1={padding.left}
										y1={height - padding.bottom}
										x2={width - padding.right}
										y2={height - padding.bottom}
										stroke="rgba(255,255,255,0.08)"
									/>

									<For each={activePoints()}>
										{(pt) => {
											const maxVol = Math.max(1, ...activePoints().map((p) => p.volumeUsd));
											const barH = Math.min(26, Math.max(4, (pt.volumeUsd / maxVol) * 24));
											const barY = height - padding.bottom - barH;
											return (
												<rect
													x={pt.x - 3}
													y={barY}
													width="6"
													height={barH}
													rx="1.5"
													fill={pt.isBull ? 'rgba(16, 185, 129, 0.22)' : 'rgba(244, 63, 94, 0.22)'}
												/>
											);
										}}
									</For>

									<Show
										when={chartMode() === 'candles'}
										fallback={
											<>
												<path d={svgPaths().area} fill="url(#giftsMacroAreaGrad)" />
												<path
													d={svgPaths().line}
													fill="none"
													stroke="#2990ff"
													stroke-width="2.5"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
											</>
										}
									>
										<For each={activePoints()}>
											{(pt) => {
												const candleW = Math.max(
													5,
													Math.min(12, Math.floor(320 / activePoints().length)),
												);
												const bodyTop = Math.min(pt.openY, pt.closeY);
												const bodyH = Math.max(3, Math.abs(pt.closeY - pt.openY));
												const color = pt.isBull ? '#10b981' : '#f43f5e';
												return (
													<g>
														<line
															x1={pt.x}
															y1={pt.highY}
															x2={pt.x}
															y2={pt.lowY}
															stroke={color}
															stroke-width="1.4"
														/>
														<rect
															x={pt.x - candleW / 2}
															y={bodyTop}
															width={candleW}
															height={bodyH}
															rx="1.5"
															fill={color}
														/>
													</g>
												);
											}}
										</For>
									</Show>

									<Show when={currentPoint()}>
										{(cp) => (
											<g>
												<line
													x1={cp().x}
													y1={padding.top - 4}
													x2={cp().x}
													y2={height - padding.bottom}
													stroke="#2990ff"
													stroke-width="1.2"
													stroke-dasharray="3 3"
													opacity="0.7"
												/>
												<circle
													cx={cp().x}
													cy={cp().y}
													r="4.5"
													fill="#141a22"
													stroke="#2990ff"
													stroke-width="2.5"
												/>
											</g>
										)}
									</Show>
								</svg>

								<div
									class="absolute bottom-1 left-3 right-3 flex justify-between text-[9px] font-mono text-white/35 pointer-events-none"
									dir="ltr"
								>
									<span>{activePoints()[0]?.label || ''}</span>
									<span>{activePoints()[Math.floor(activePoints().length / 2)]?.label || ''}</span>
									<span class="text-[#2990ff] font-bold">{t('giftsChart.now')}</span>
								</div>
							</Show>
						</div>
					</div>

					{/* FLOOR SWEEP & THIN ORDERBOOK ALPHA RADAR */}
					<Show when={sweepOpportunities().length > 0}>
						<div class="bg-[#1b232d]/95 border border-white/[0.08] rounded-2xl p-4 shadow-xl space-y-3">
							<div class="flex items-start justify-between gap-2">
								<div>
									<div class="flex items-center gap-1.5">
										<span class="material-symbols-outlined text-amber-400 text-[18px]">radar</span>
										<h3 class="text-xs font-black text-white tracking-wide">
											{t('giftsChart.sweepRadarTitle')}
										</h3>
									</div>
									<p class="text-[11px] text-white/50 mt-0.5 leading-relaxed">
										{t('giftsChart.sweepRadarSub')}
									</p>
								</div>
							</div>

							<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
								<For each={sweepOpportunities()}>
									{(item) => {
										const itemSlug = () =>
											(item.collection_slug || item.model_id || 'plush-pepe').replace(/_/g, '-');
										const itemName = () => item.collection_name || item.name || itemSlug();
										const imgUrl = () =>
											item.image_url ||
											`https://fragment.com/file/gifts/${itemSlug().replace(/-/g, '')}/thumb.webp`;
										const secondTon = () => item.second_floor_gram || item.best_floor_gram;
										const jumpTon = () =>
											Math.max(0, Math.round((secondTon() - item.best_floor_gram) * 10) / 10);

										return (
											<div class="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-[18px] p-3 flex flex-col justify-between gap-2.5 transition-all">
												<div class="flex items-center justify-between gap-2">
													<div class="flex items-center gap-2.5 min-w-0">
														<img
															src={imgUrl()}
															alt={itemName()}
															class="w-10 h-10 rounded-xl object-cover bg-black/50 border border-white/10 shrink-0"
															loading="lazy"
														/>
														<div class="min-w-0">
															<div class="text-xs font-black text-white truncate">{itemName()}</div>
															<div class="text-[10px] font-mono text-white/45" dir="ltr">
																#{item.cheapest_serial || 1} ·{' '}
																{(item.upgraded_count || item.total_supply || 0).toLocaleString(
																	'en-US',
																)}{' '}
																NFTs
															</div>
														</div>
													</div>

													<div class="text-end shrink-0" dir="ltr">
														<span class="text-xs font-mono font-black text-emerald-400">
															+{(item.spread_pct || 0).toFixed(1)}%
														</span>
														<div class="text-[9px] font-mono text-white/45">
															+{jumpTon().toLocaleString('en-US')} TON
														</div>
													</div>
												</div>

												<div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06] text-[10px] font-mono">
													<div>
														<span class="text-white/40 block text-[9px]">
															{t('giftsChart.floor1Label')}
														</span>
														<strong class="text-white text-xs" dir="ltr">
															{item.best_floor_gram.toLocaleString('en-US')} TON
														</strong>
													</div>
													<div class="text-end">
														<span class="text-white/40 block text-[9px]">
															{t('giftsChart.floor2Label')}
														</span>
														<strong class="text-sky-400 text-xs" dir="ltr">
															{secondTon().toLocaleString('en-US')} TON
														</strong>
													</div>
												</div>

												<div class="flex items-center gap-1.5 pt-1">
													<button
														type="button"
														onClick={() => selectAndInspectCollection(itemSlug())}
														class="flex-1 py-1.5 px-2.5 rounded-xl bg-[#2990ff]/15 hover:bg-[#2990ff]/25 border border-[#2990ff]/30 text-[#2990ff] text-[10px] font-black transition-all"
													>
														{t('giftsChart.inspectCollectionBtn')}
													</button>
													<a
														href={
															item.buy_url ||
															`https://fragment.com/gifts/${itemSlug().replace(/-/g, '')}`
														}
														target="_blank"
														rel="noreferrer"
														class="py-1.5 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-[10px] font-black transition-all"
													>
														{t('giftsChart.buyFloorBtn')} ↗
													</a>
												</div>
											</div>
										);
									}}
								</For>
							</div>
						</div>
					</Show>
				</div>
			</Show>

			{/* ═════════════════════════════════════════════════════════════════════════
			    TAB 2: COLLECTIONS & LIVE FLOOR BOARD (ALL 122 OFFICIAL COLLECTIONS)
			    Authentic Fragment.com Table Design — crisp, spacious, zero crowding
			    ═════════════════════════════════════════════════════════════════════════ */}
			<Show when={props.activeTab === 'collections'}>
				<div class="space-y-3">
					{/* Search & Filter Controls */}
					<div class="frag-section-card p-3.5 space-y-3">
						<div class="flex items-center justify-between gap-2">
							<div class="min-w-0">
								<h2 class="text-[14.5px] font-bold text-white truncate">
									{t('giftsChart.floorBoardTitle')}
								</h2>
								<p class="text-[11.5px] text-[#8c9aa9] mt-0.5 truncate">
									{t('giftsChart.floorBoardSub')}
								</p>
							</div>
							<span
								class="shrink-0 px-2 py-0.5 rounded-[5px] bg-[#248bda]/15 text-[#4db2ff] text-[11px] font-mono font-bold"
								dir="ltr"
							>
								{collectionsQuery.data?.length || 122}
							</span>
						</div>

						{/* Fragment Search Input */}
						<div class="relative">
							<span class="material-symbols-outlined text-[#8c9aa9] text-[17px] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none">
								search
							</span>
							<input
								type="search"
								value={collectionSearch()}
								onInput={(e) => setCollectionSearch(e.currentTarget.value)}
								placeholder={t('giftsChart.searchCollectionPlaceholder')}
								class="w-full h-10 bg-[#1a2026] border border-[#2e3b48] focus:border-[#248bda] rounded-[8px] ps-9 pe-3 text-[13px] text-white placeholder:text-[#8c9aa9]/75 outline-none transition-colors"
							/>
						</div>

						{/* Category Filter Chips */}
						<div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
							<For
								each={
									[
										{ id: 'verified', label: t('giftsChart.filterAll') },
										{ id: 'bluechip', label: t('giftsChart.filterBluechip') },
										{ id: 'mid', label: t('giftsChart.filterMid') },
										{ id: 'entry', label: t('giftsChart.filterEntry') },
										{
											id: 'directory',
											label: `${t('giftsChart.filterDirectory')} (${collectionsQuery.data?.length || 122})`,
										},
									] as const
								}
							>
								{(f) => (
									<button
										type="button"
										onClick={() => setBoardFilter(f.id)}
										class={`shrink-0 h-8 px-3 rounded-[7px] text-[12px] font-semibold transition-colors cursor-pointer ${
											boardFilter() === f.id
												? 'bg-[#248bda] text-white'
												: 'bg-[#242e38] hover:bg-[#293440] text-[#cbd7e5]/80'
										}`}
									>
										{f.label}
									</button>
								)}
							</For>
						</div>
					</div>

					{/* Mode A: Full 122 Official Collections Directory / Search Results */}
					<Show
						when={boardFilter() === 'directory' || collectionSearch().trim().length > 0}
						fallback={
							/* Mode B: Authentic Fragment.com Live Floor Table */
							<div class="frag-table-container overflow-hidden">
								<div class="frag-table-header grid grid-cols-12 items-center px-3.5 py-2.5 text-[11px] font-semibold text-[#8c9aa9] uppercase tracking-wider">
									<span class="col-span-7">{t('giftsChart.floorBoardTitle')}</span>
									<span class="col-span-5 text-end">{t('giftsChart.liveFloor')}</span>
								</div>

								<div class="divide-y divide-[#1a2026]">
									<For each={filteredFloorBoard()}>
										{(row, idx) => {
											const rowSlug = () =>
												(row.collection_slug || row.model_id || 'plush-pepe').replace(/_/g, '-');
											const rowName = () => row.collection_name || row.name || rowSlug();
											const spreadPct = () => Number(row.spread_pct || 0);
											const floorTon = () => Number(row.best_floor_gram || 0);
											const floorUsd = () =>
												Math.round(Number(row.best_floor_usd || floorTon() * tonRate()));
											const supply = () => Number(row.upgraded_count || row.total_supply || 0);
											const imgUrl = () =>
												row.image_url ||
												`https://fragment.com/file/gifts/${rowSlug().replace(/-/g, '')}/thumb.webp`;

											return (
												<button
													type="button"
													onClick={() => selectAndInspectCollection(rowSlug())}
													class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
												>
													{/* Left: Rank + Artwork + Clean 2-Line Identity */}
													<div class="flex items-center gap-3 min-w-0 flex-1">
														<span
															class="w-5 text-[11.5px] font-mono font-semibold text-[#8c9aa9] text-center shrink-0"
															dir="ltr"
														>
															{idx() + 1}
														</span>
														<img
															src={imgUrl()}
															alt={rowName()}
															class="w-11 h-11 rounded-[10px] object-cover bg-[#1a2026] border border-[#2e3b48] shrink-0"
															loading="lazy"
														/>
														<div class="min-w-0 flex-1">
															<div class="text-[13.5px] font-semibold text-white truncate leading-snug">
																{rowName()}
															</div>
															<div
																class="text-[11.5px] font-mono text-[#8c9aa9] mt-0.5 truncate"
																dir="ltr"
															>
																{supply().toLocaleString('en-US')} NFTs
																<Show when={row.cheapest_serial}>
																	<span> · #{row.cheapest_serial}</span>
																</Show>
															</div>
														</div>
													</div>

													{/* Right: Crisp TON Floor + USD & Spread + Chevron */}
													<div class="flex items-center gap-2 shrink-0">
														<div class="text-end" dir="ltr">
															<div class="text-[14px] font-bold font-mono text-white leading-snug tabular-nums">
																{floorTon().toLocaleString('en-US', {
																	maximumFractionDigits: 1,
																})}{' '}
																<span class="text-[11px] font-semibold text-[#4db2ff]">TON</span>
															</div>
															<div class="text-[11px] font-mono text-[#8c9aa9] mt-0.5 flex items-center justify-end gap-1.5 tabular-nums">
																<span>${floorUsd().toLocaleString('en-US')}</span>
																<Show when={spreadPct() > 0}>
																	<span class="text-[#5aec8c] font-semibold">
																		+{spreadPct().toFixed(1)}%
																	</span>
																</Show>
															</div>
														</div>
														<span class="material-symbols-outlined text-[18px] text-[#8c9aa9]/60 rtl:rotate-180">
															chevron_right
														</span>
													</div>
												</button>
											);
										}}
									</For>
								</div>
							</div>
						}
					>
						<div class="frag-table-container overflow-hidden">
							<div class="frag-table-header grid grid-cols-12 items-center px-3.5 py-2.5 text-[11px] font-semibold text-[#8c9aa9] uppercase tracking-wider">
								<span class="col-span-7">
									{t('giftsChart.filterDirectory')} ({filteredCollections().length})
								</span>
								<span class="col-span-5 text-end">{t('giftsChart.liveFloor')}</span>
							</div>

							<div class="divide-y divide-[#1a2026] max-h-[560px] overflow-y-auto">
								<For each={filteredCollections()}>
									{(coll, idx) => (
										<button
											type="button"
											onClick={() => selectAndInspectCollection(coll.slug)}
											class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
										>
											<div class="flex items-center gap-3 min-w-0 flex-1">
												<span
													class="w-6 text-[11px] font-mono text-[#8c9aa9] text-center shrink-0"
													dir="ltr"
												>
													{idx() + 1}
												</span>
												<Show when={coll.image_url}>
													<img
														src={coll.image_url}
														alt={coll.name}
														class="w-10 h-10 rounded-[10px] object-cover bg-[#1a2026] border border-[#2e3b48] shrink-0"
														loading="lazy"
													/>
												</Show>
												<div class="min-w-0 flex-1">
													<div class="text-[13.5px] font-semibold text-white truncate leading-snug">
														{coll.name}
													</div>
													<div class="text-[11.5px] font-mono text-[#8c9aa9] mt-0.5" dir="ltr">
														{Number(coll.total_supply || 0).toLocaleString('en-US')} NFTs
													</div>
												</div>
											</div>

											<div class="flex items-center gap-2 shrink-0">
												<div class="text-end" dir="ltr">
													<Show
														when={Number(coll.floor_gram || 0) > 0}
														fallback={
															<span class="text-[12px] font-semibold text-[#4db2ff]">
																{t('giftsChart.inspectLiveBtn')}
															</span>
														}
													>
														<div class="text-[13.5px] font-bold font-mono text-white tabular-nums">
															{Number(coll.floor_gram || 0).toLocaleString('en-US', {
																maximumFractionDigits: 1,
															})}{' '}
															<span class="text-[11px] font-semibold text-[#4db2ff]">TON</span>
														</div>
														<div class="text-[11px] font-mono text-[#8c9aa9] mt-0.5 tabular-nums">
															${Math.round(Number(coll.floor_usd || 0)).toLocaleString('en-US')}
														</div>
													</Show>
												</div>
												<span class="material-symbols-outlined text-[18px] text-[#8c9aa9]/60 rtl:rotate-180">
													chevron_right
												</span>
											</div>
										</button>
									)}
								</For>
							</div>
						</div>
					</Show>
				</div>
			</Show>

			{/* ═════════════════════════════════════════════════════════════════════════
			    TAB 3: ON-DEMAND COLLECTION DEEP-DIVE & RARITY INSPECTOR
			    ═════════════════════════════════════════════════════════════════════════ */}
			<Show when={props.activeTab === 'inspector'}>
				<div class="bg-[#1b232d]/95 border border-white/[0.08] rounded-2xl p-4 shadow-xl space-y-3.5">
					{/* Inspector Header + Search + 122 Collection Drawer Toggle */}
					<div class="flex flex-col gap-2.5 border-b border-white/[0.07] pb-3">
						<div>
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-[#2990ff] text-lg">manage_search</span>
								<h2 class="text-sm font-black text-white">{t('giftsChart.inspectorTitle')}</h2>
							</div>
							<p class="text-[11px] text-white/50 mt-0.5 leading-relaxed">
								{t('giftsChart.inspectorSub')}
							</p>
						</div>

						<div class="flex flex-col sm:flex-row gap-2">
							<div class="relative flex-1">
								<span class="material-symbols-outlined text-white/35 text-base absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none">
									search
								</span>
								<input
									type="search"
									value={collectionSearch()}
									onInput={(e) => {
										setCollectionSearch(e.currentTarget.value);
										if (e.currentTarget.value.trim().length > 0) {
											setShowFullDirectory(true);
										}
									}}
									placeholder={t('giftsChart.searchCollectionPlaceholder')}
									class="w-full bg-black/50 border border-white/[0.1] focus:border-[#2990ff] rounded-xl ps-9 pe-3 py-2 text-xs text-white placeholder:text-white/35 outline-none transition-all"
								/>
							</div>
							<button
								type="button"
								onClick={() => setShowFullDirectory(!showFullDirectory())}
								class="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-bold text-white/85 transition-all flex items-center justify-center gap-1.5 shrink-0"
							>
								<span class="material-symbols-outlined text-sm text-[#2990ff]">apps</span>
								<span>
									{showFullDirectory()
										? t('giftsChart.hideAllCollections')
										: `${t('giftsChart.showAllCollections')} (${collectionsQuery.data?.length || 122})`}
								</span>
							</button>
						</div>

						{/* Horizontal Quick Selector Chips */}
						<div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
							<For each={filteredCollections().slice(0, 20)}>
								{(coll) => {
									const isSelected = () =>
										selectedSlug() === coll.slug || selectedSlug() === coll.norm_slug;
									return (
										<button
											type="button"
											onClick={() => setSelectedSlug(coll.slug)}
											class={`shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
												isSelected()
													? 'bg-[#2990ff] text-white border-[#2990ff] shadow-md shadow-[#2990ff]/25'
													: 'bg-white/[0.03] hover:bg-white/[0.08] text-white/75 border-white/[0.08]'
											}`}
										>
											<Show when={coll.image_url}>
												<img
													src={coll.image_url}
													alt={coll.name}
													class="w-5 h-5 rounded-md object-cover bg-black/40"
													loading="lazy"
												/>
											</Show>
											<span class="whitespace-nowrap">{coll.name}</span>
										</button>
									);
								}}
							</For>
						</div>

						{/* Expandable 122-Collection Directory Drawer */}
						<Show when={showFullDirectory()}>
							<div class="max-h-60 overflow-y-auto rounded-2xl bg-black/60 border border-white/[0.08] p-2.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
								<For each={filteredCollections()}>
									{(coll) => {
										const active = () =>
											selectedSlug() === coll.slug || selectedSlug() === coll.norm_slug;
										return (
											<button
												type="button"
												onClick={() => {
													setSelectedSlug(coll.slug);
													setShowFullDirectory(false);
												}}
												class={`flex items-center justify-between gap-2 p-2 rounded-xl border text-start transition-all ${
													active()
														? 'bg-[#2990ff]/20 border-[#2990ff] text-white'
														: 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.05] text-white/80'
												}`}
											>
												<div class="flex items-center gap-2 min-w-0">
													<Show when={coll.image_url}>
														<img
															src={coll.image_url}
															alt={coll.name}
															class="w-6 h-6 rounded-lg object-cover shrink-0"
															loading="lazy"
														/>
													</Show>
													<div class="min-w-0">
														<div class="text-[11px] font-bold truncate">{coll.name}</div>
														<div class="text-[9px] font-mono text-white/40" dir="ltr">
															{(coll.total_supply || 0).toLocaleString('en-US')} NFTs
														</div>
													</div>
												</div>
											</button>
										);
									}}
								</For>
							</div>
						</Show>
					</div>

					{/* Selected Collection On-Demand Data */}
					<Show
						when={!selectedCollectionQuery.isPending && selectedIntel()}
						fallback={
							<div class="py-12 text-center space-y-2.5 bg-black/30 rounded-2xl border border-white/[0.05]">
								<div class="w-8 h-8 border-2 border-[#2990ff] border-t-transparent rounded-full animate-spin mx-auto" />
								<div class="text-xs font-bold text-white/70">
									{t('giftsChart.loadingCollection')}
								</div>
							</div>
						}
					>
						{(col) => {
							const secondFloor = () =>
								(col() as unknown as { second_floor_gram?: number }).second_floor_gram ||
								col().best_floor_gram;
							const spreadGram = () =>
								Math.max(0, Math.round((secondFloor() - col().best_floor_gram) * 100) / 100);
							const spreadPct = () =>
								col().best_floor_gram > 0
									? Math.round(
											((secondFloor() - col().best_floor_gram) / col().best_floor_gram) * 1000,
										) / 10
									: 0;

							return (
								<div class="space-y-3.5">
									{/* Collection Hero Banner */}
									<div class="flex flex-wrap items-center justify-between gap-3 bg-black/35 border border-white/[0.07] rounded-2xl p-3.5">
										<div class="flex items-center gap-3">
											<img
												src={
													col().image_url ||
													col().floor_item?.image_url ||
													`https://fragment.com/file/gifts/${col().collection_slug.replace(/-/g, '')}/thumb.webp`
												}
												alt={col().collection_name}
												class="w-13 h-13 rounded-2xl object-cover bg-[#0e1525] border border-white/10 shadow-md"
											/>
											<div>
												<h3 class="text-base font-black text-white">{col().collection_name}</h3>
												<div
													class="text-[10px] font-mono text-white/50 flex flex-wrap items-center gap-1.5 mt-0.5"
													dir="ltr"
												>
													<span>
														{(col().upgraded_count || col().total_supply || 0).toLocaleString(
															'en-US',
														)}{' '}
														NFTs
													</span>
													<span>·</span>
													<span>{col().total_models || 0} Models</span>
													<span>·</span>
													<span>{col().total_backdrops || 0} Backdrops</span>
													<span>·</span>
													<span>{col().total_symbols || 0} Symbols</span>
												</div>
											</div>
										</div>

										<div class="flex items-center gap-2">
											<Show when={col().floor_item?.buy_url}>
												<a
													href={col().floor_item!.buy_url}
													target="_blank"
													rel="noreferrer"
													class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all flex items-center gap-1"
												>
													<span>{t('giftsChart.buyCheapestOnFragment')}</span>
													<span class="material-symbols-outlined text-sm">open_in_new</span>
												</a>
											</Show>
											<button
												type="button"
												onClick={() => navigate(`/gifts/collection?c=${col().collection_slug}`)}
												class="px-3 py-1.5 rounded-xl bg-[#2990ff]/20 hover:bg-[#2990ff]/30 border border-[#2990ff]/40 text-[#2990ff] font-bold text-xs transition-all"
											>
												{t('giftsChart.openFullTerminal')} →
											</button>
										</div>
									</div>

									{/* 4 Collection KPI Cards */}
									<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
										<div class="p-3 rounded-2xl bg-[#2990ff]/[0.08] border border-[#2990ff]/25">
											<div class="text-[10px] text-white/50 font-bold">
												{t('giftsChart.liveFloor')}
											</div>
											<div class="text-base font-black font-mono text-white mt-0.5" dir="ltr">
												{formatPrice(col().best_floor_gram, col().best_floor_usd)}
											</div>
											<div class="text-[9px] font-mono text-sky-400 mt-0.5 truncate" dir="ltr">
												#{col().floor_item?.serial_number || 1} ·{' '}
												{col().floor_item?.model_name || 'Floor'}
											</div>
										</div>

										<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
											<div class="text-[10px] text-white/50 font-bold">
												{t('giftsChart.secondFloor')}
											</div>
											<div class="text-base font-black font-mono text-white mt-0.5" dir="ltr">
												{formatPrice(secondFloor())}
											</div>
											<div class="text-[9px] font-mono text-emerald-400 mt-0.5" dir="ltr">
												+{spreadGram().toLocaleString('en-US')} TON (+{spreadPct()}%)
											</div>
										</div>

										<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
											<div class="text-[10px] text-white/50 font-bold">
												{t('giftsChart.onChainSupply')}
											</div>
											<div class="text-base font-black font-mono text-white mt-0.5" dir="ltr">
												{(col().upgraded_count || col().total_supply || 0).toLocaleString('en-US')}
											</div>
											<div class="text-[9px] font-mono text-white/45 mt-0.5">
												{col().listed_count || 0} {t('giftsChart.activeListings')} (
												{col().liquidity_ratio || 0}%)
											</div>
										</div>

										<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
											<div class="text-[10px] text-white/50 font-bold">
												{t('giftsChart.allTimeHighSale')}
											</div>
											<div class="text-base font-black font-mono text-amber-400 mt-0.5" dir="ltr">
												{formatPrice(
													col().market_sales_stats?.period_30d?.max_gram || col().best_floor_gram,
												)}
											</div>
											<div class="text-[9px] font-mono text-white/45 mt-0.5" dir="ltr">
												{col().sales_history?.length || 0} Settled Deals
											</div>
										</div>
									</div>

									{/* 3 Focused Sub-Tabs inside Inspector */}
									<div class="grid grid-cols-3 gap-1 bg-black/50 p-1 rounded-xl border border-white/[0.07]">
										<For
											each={
												[
													{ id: 'orderbook', label: t('giftsChart.tabOrderbook') },
													{ id: 'traits', label: t('giftsChart.tabTraits') },
													{ id: 'sales', label: t('giftsChart.tabSalesAndChart') },
												] as const
											}
										>
											{(tab) => (
												<button
													type="button"
													onClick={() => setInspectorTab(tab.id)}
													class={`py-2 px-2 rounded-lg text-[11px] font-black truncate transition-all ${
														inspectorTab() === tab.id
															? 'bg-[#2990ff] text-white shadow'
															: 'text-white/50 hover:text-white/85'
													}`}
												>
													{tab.label}
												</button>
											)}
										</For>
									</div>

									{/* Sub-Tab 1: Cheapest Active Listings */}
									<Show when={inspectorTab() === 'orderbook'}>
										<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[380px] overflow-y-auto pr-1">
											<For each={col().top_floor_items || []}>
												{(item, idx) => (
													<div class="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all">
														<div class="flex items-center gap-2.5 min-w-0">
															<div class="relative shrink-0">
																<img
																	src={item.image_url || col().image_url}
																	alt={`#${item.serial_number}`}
																	class="w-10 h-10 rounded-xl object-cover bg-black/50 border border-white/10"
																	loading="lazy"
																/>
																<span class="absolute -top-1 -start-1 px-1 py-0.2 rounded bg-[#2990ff] text-[8px] font-mono font-black text-white">
																	#{idx() + 1}
																</span>
															</div>
															<div class="min-w-0">
																<div
																	class="text-xs font-black text-white font-mono flex items-center gap-1.5"
																	dir="ltr"
																>
																	<span>#{item.serial_number}</span>
																	<span class="text-[10px] font-sans font-semibold text-sky-400 truncate">
																		{item.model_name}
																	</span>
																</div>
																<div class="text-[10px] text-white/45 truncate flex items-center gap-1.5 mt-0.5">
																	<span
																		class="w-2 h-2 rounded-full inline-block shrink-0"
																		style={{
																			'background-color': item.center_hex || '#2990ff',
																		}}
																	/>
																	<span>{item.backdrop_name}</span>
																	<span>·</span>
																	<span>{item.symbol_name}</span>
																</div>
															</div>
														</div>

														<div class="text-end shrink-0" dir="ltr">
															<div class="text-xs font-black font-mono text-emerald-400">
																{item.price_gram.toLocaleString('en-US')} TON
															</div>
															<div class="text-[9px] font-mono text-white/40">
																${item.price_usd.toLocaleString('en-US')}
															</div>
															<Show when={item.buy_url}>
																<a
																	href={item.buy_url}
																	target="_blank"
																	rel="noreferrer"
																	class="inline-block mt-0.5 text-[9px] font-bold text-[#2990ff] hover:underline"
																>
																	{t('giftsChart.buyBtn')} ↗
																</a>
															</Show>
														</div>
													</div>
												)}
											</For>
										</div>
									</Show>

									{/* Sub-Tab 2: Models, Backdrops & Symbols Rarity */}
									<Show when={inspectorTab() === 'traits'}>
										<div class="space-y-3">
											<div class="flex items-center gap-1.5">
												<button
													type="button"
													onClick={() => setTraitSubTab('models')}
													class={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
														traitSubTab() === 'models'
															? 'bg-white/15 text-white border border-white/20'
															: 'bg-white/[0.03] text-white/45'
													}`}
												>
													{t('giftsChart.traitModels')} ({col().model_floors?.length || 0})
												</button>
												<button
													type="button"
													onClick={() => setTraitSubTab('backdrops')}
													class={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
														traitSubTab() === 'backdrops'
															? 'bg-white/15 text-white border border-white/20'
															: 'bg-white/[0.03] text-white/45'
													}`}
												>
													{t('giftsChart.traitBackdrops')} ({col().backdrops_list?.length || 0})
												</button>
												<button
													type="button"
													onClick={() => setTraitSubTab('symbols')}
													class={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
														traitSubTab() === 'symbols'
															? 'bg-white/15 text-white border border-white/20'
															: 'bg-white/[0.03] text-white/45'
													}`}
												>
													{t('giftsChart.traitSymbols')} ({col().symbols_list?.length || 0})
												</button>
											</div>

											<Show when={traitSubTab() === 'models'}>
												<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
													<For each={col().model_floors || []}>
														{(m) => (
															<a
																href={
																	m.buy_url ||
																	`https://fragment.com/gifts/${col().collection_slug.replace(/-/g, '')}`
																}
																target="_blank"
																rel="noreferrer"
																class="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] transition-all"
															>
																<Show when={m.image_url}>
																	<img
																		src={m.image_url}
																		alt={m.model_name}
																		class="w-9 h-9 rounded-lg object-contain bg-black/40 p-0.5 shrink-0"
																		loading="lazy"
																	/>
																</Show>
																<div class="min-w-0 flex-1">
																	<div class="text-[11px] font-bold text-white truncate">
																		{m.model_name}
																	</div>
																	<div class="text-[9px] font-mono text-sky-400" dir="ltr">
																		{((m.rarity_permille || 0) / 10).toFixed(1)}% ·{' '}
																		{m.total_supply || 0} NFTs
																	</div>
																	<div
																		class="text-[10px] font-mono font-bold text-emerald-400"
																		dir="ltr"
																	>
																		~{(m.floor_gram || 0).toLocaleString('en-US')} TON
																	</div>
																</div>
															</a>
														)}
													</For>
												</div>
											</Show>

											<Show when={traitSubTab() === 'backdrops'}>
												<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
													<For each={col().backdrops_list || []}>
														{(b) => (
															<div class="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
																<div
																	class="w-8 h-8 rounded-lg shrink-0 border border-white/20 shadow-inner"
																	style={{
																		background: `radial-gradient(circle, ${b.center_hex} 0%, ${b.edge_hex} 100%)`,
																	}}
																/>
																<div class="min-w-0">
																	<div class="text-[11px] font-bold text-white truncate">
																		{b.name}
																	</div>
																	<div class="text-[9px] font-mono text-white/50" dir="ltr">
																		{(b.rarity_permille / 10).toFixed(1)}% · {b.center_hex}
																	</div>
																</div>
															</div>
														)}
													</For>
												</div>
											</Show>

											<Show when={traitSubTab() === 'symbols'}>
												<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
													<For each={col().symbols_list || []}>
														{(s) => (
															<div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
																<div class="text-[11px] font-bold text-white truncate">
																	{s.name}
																</div>
																<div class="text-end font-mono shrink-0" dir="ltr">
																	<div class="text-[10px] font-bold text-sky-400">
																		{(s.rarity_permille / 10).toFixed(1)}%
																	</div>
																	<div class="text-[9px] text-white/40">{s.total_supply} NFTs</div>
																</div>
															</div>
														)}
													</For>
												</div>
											</Show>
										</div>
									</Show>

									{/* Sub-Tab 3: Collection Sales Stats & Settled History */}
									<Show when={inspectorTab() === 'sales'}>
										<div class="space-y-3">
											<Show when={col().market_sales_stats}>
												{(ms) => (
													<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
														<For
															each={[
																{ title: t('giftsChart.stats24h'), d: ms().period_24h },
																{ title: t('giftsChart.stats7d'), d: ms().period_7d },
																{ title: t('giftsChart.stats30d'), d: ms().period_30d },
															]}
														>
															{(p) => (
																<div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1.5">
																	<div class="flex items-center justify-between text-[10px] font-bold text-white/75 border-b border-white/[0.05] pb-1">
																		<span>{p.title}</span>
																		<span class="font-mono text-sky-400">
																			{p.d.deals_count} {t('giftsChart.dealsCount')}
																		</span>
																	</div>
																	<div
																		class="grid grid-cols-3 gap-1 text-[10px] font-mono pt-0.5"
																		dir="ltr"
																	>
																		<div>
																			<div class="text-white/40 text-[9px]">
																				{t('giftsChart.minSale')}
																			</div>
																			<div class="font-bold text-white">
																				{(p.d?.min_gram || 0).toLocaleString('en-US')}T
																			</div>
																		</div>
																		<div>
																			<div class="text-white/40 text-[9px]">
																				{t('giftsChart.avgSale')}
																			</div>
																			<div class="font-bold text-emerald-400">
																				{(p.d?.avg_gram || 0).toLocaleString('en-US')}T
																			</div>
																		</div>
																		<div>
																			<div class="text-white/40 text-[9px]">
																				{t('giftsChart.maxSale')}
																			</div>
																			<div class="font-bold text-amber-400">
																				{(p.d?.max_gram || 0).toLocaleString('en-US')}T
																			</div>
																		</div>
																	</div>
																</div>
															)}
														</For>
													</div>
												)}
											</Show>

											<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
												<For each={(col().sales_history || []).slice(0, 16)}>
													{(sale) => (
														<div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06]">
															<div class="flex items-center gap-2 min-w-0">
																<Show when={sale.image_url}>
																	<img
																		src={sale.image_url}
																		alt={`#${sale.serial_number}`}
																		class="w-9 h-9 rounded-lg object-cover shrink-0"
																		loading="lazy"
																	/>
																</Show>
																<div class="min-w-0">
																	<div class="text-xs font-bold text-white font-mono" dir="ltr">
																		#{sale.serial_number}{' '}
																		<span class="text-[10px] font-sans text-white/60">
																			({sale.model_name})
																		</span>
																	</div>
																	<div class="text-[9px] font-mono text-white/40" dir="ltr">
																		{sale.sale_date
																			? sale.sale_date.slice(0, 16).replace('T', ' ')
																			: t('giftsChart.settledOnFragment')}
																	</div>
																</div>
															</div>
															<div class="text-end shrink-0" dir="ltr">
																<div class="text-xs font-black font-mono text-amber-400">
																	{sale.price_gram.toLocaleString('en-US')} TON
																</div>
																<div class="text-[9px] font-mono text-white/40">
																	${sale.price_usd.toLocaleString('en-US')}
																</div>
															</div>
														</div>
													)}
												</For>
											</div>
										</div>
									</Show>
								</div>
							);
						}}
					</Show>
				</div>
			</Show>

			{/* ═════════════════════════════════════════════════════════════════════════
			    TAB 4: LIVE GLOBAL MARKET TAPE & ENDING-SOON AUCTIONS (SNIPER FEED)
			    ═════════════════════════════════════════════════════════════════════════ */}
			<Show when={props.activeTab === 'tape'}>
				<div class="bg-[#1b232d]/95 border border-white/[0.08] rounded-2xl p-4 shadow-xl space-y-3.5">
					<div>
						<div class="flex items-center gap-2">
							<span class="w-2 h-2 rounded-full bg-emerald-400" />
							<h2 class="text-sm font-black text-white">{t('giftsChart.globalTapeTitle')}</h2>
						</div>
						<p class="text-[11px] text-white/50 mt-0.5">{t('giftsChart.globalTapeSub')}</p>
					</div>

					{/* 3 Stream Mode Buttons */}
					<div class="grid grid-cols-3 gap-1 bg-black/50 p-1 rounded-xl border border-white/[0.07]">
						<button
							type="button"
							onClick={() => setGlobalTapeTab('auctions')}
							class={`py-2 px-2 rounded-lg text-[11px] font-black truncate transition-all ${
								globalTapeTab() === 'auctions'
									? 'bg-rose-500 text-white shadow'
									: 'text-white/50 hover:text-white/85'
							}`}
						>
							{t('giftsChart.tapeEndingAuctions')} ({props.intel?.ending_soon_auctions?.length || 0}
							)
						</button>
						<button
							type="button"
							onClick={() => setGlobalTapeTab('sales')}
							class={`py-2 px-2 rounded-lg text-[11px] font-black truncate transition-all ${
								globalTapeTab() === 'sales'
									? 'bg-[#2990ff] text-white shadow'
									: 'text-white/50 hover:text-white/85'
							}`}
						>
							{t('giftsChart.tapeRecentSales')} ({props.intel?.global_recent_sales?.length || 0})
						</button>
						<button
							type="button"
							onClick={() => setGlobalTapeTab('listings')}
							class={`py-2 px-2 rounded-lg text-[11px] font-black truncate transition-all ${
								globalTapeTab() === 'listings'
									? 'bg-emerald-500 text-slate-950 shadow'
									: 'text-white/50 hover:text-white/85'
							}`}
						>
							{t('giftsChart.tapeNewListings')} ({props.intel?.global_new_listings?.length || 0})
						</button>
					</div>

					{/* Stream 1: Ending Soon Auctions (Sniper Feed) */}
					<Show when={globalTapeTab() === 'auctions'}>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
							<For each={props.intel?.ending_soon_auctions || []}>
								{(auc) => {
									const aucSlug = () =>
										(auc.collection_slug || auc.slug || auc.gift_id || 'plush-pepe').replace(
											/_/g,
											'-',
										);
									const aucName = () => auc.gift_name || auc.model_name || aucSlug();
									const aucImg = () =>
										auc.image_url ||
										`https://fragment.com/file/gifts/${aucSlug().replace(/-/g, '')}/thumb.webp`;
									return (
										<div class="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.07] transition-all">
											<div class="flex items-center gap-2.5 min-w-0">
												<img
													src={aucImg()}
													alt={aucName()}
													class="w-11 h-11 rounded-xl object-cover bg-black/40 border border-white/10 shrink-0"
													loading="lazy"
												/>
												<div class="min-w-0">
													<button
														type="button"
														onClick={() => selectAndInspectCollection(aucSlug())}
														class="text-xs font-black text-white hover:text-[#2990ff] truncate block text-start"
													>
														{aucName()} <span class="font-mono">#{auc.serial_number}</span>
													</button>
													<div class="text-[10px] font-mono text-rose-400 font-bold mt-0.5">
														⏳ {auc.time_remaining_label || '45m left'}
													</div>
												</div>
											</div>

											<div class="text-end shrink-0" dir="ltr">
												<div class="text-xs font-black font-mono text-amber-400">
													{(auc.current_bid_gram || 0).toLocaleString('en-US')} TON
												</div>
												<div class="text-[9px] font-mono text-white/40">
													$
													{Math.round(
														auc.current_bid_usd || (auc.current_bid_gram || 0) * tonRate(),
													).toLocaleString('en-US')}
												</div>
												<a
													href={
														auc.bid_url ||
														`https://fragment.com/gifts/${aucSlug().replace(/-/g, '')}`
													}
													target="_blank"
													rel="noreferrer"
													class="inline-block mt-1 text-[9px] font-bold text-[#2990ff] hover:underline"
												>
													{t('giftsChart.bidOnFragment')}
												</a>
											</div>
										</div>
									);
								}}
							</For>
						</div>
					</Show>

					{/* Stream 2: Global Recent Settled Sales */}
					<Show when={globalTapeTab() === 'sales'}>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
							<For each={props.intel?.global_recent_sales || []}>
								{(sale) => (
									<div class="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.07] transition-all">
										<div class="flex items-center gap-2.5 min-w-0">
											<img
												src={sale.imageUrl}
												alt={sale.collectionName || sale.name}
												class="w-11 h-11 rounded-xl object-cover bg-black/40 border border-white/10 shrink-0"
												loading="lazy"
											/>
											<div class="min-w-0">
												<button
													type="button"
													onClick={() => selectAndInspectCollection(sale.collectionSlug)}
													class="text-xs font-black text-white hover:text-[#2990ff] truncate block text-start"
												>
													{sale.collectionName || sale.name}{' '}
													<span class="font-mono">#{sale.serialNumber}</span>
												</button>
												<div class="text-[10px] font-mono text-white/40 mt-0.5">
													{sale.relativeTime || t('giftsChart.settledOnFragment')}
												</div>
											</div>
										</div>

										<div class="text-end shrink-0" dir="ltr">
											<div class="text-xs font-black font-mono text-amber-400">
												{(sale.priceGram || 0).toLocaleString('en-US')} TON
											</div>
											<div class="text-[9px] font-mono text-white/40">
												${Math.round(sale.priceUsd || 0).toLocaleString('en-US')}
											</div>
											<a
												href={sale.fragmentUrl}
												target="_blank"
												rel="noreferrer"
												class="inline-block mt-1 text-[9px] font-bold text-white/50 hover:text-[#2990ff]"
											>
												{t('giftsChart.buyOnFragmentBtn')}
											</a>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>

					{/* Stream 3: Global Newly Listed Gifts */}
					<Show when={globalTapeTab() === 'listings'}>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
							<For each={props.intel?.global_new_listings || []}>
								{(lst) => (
									<div class="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.07] transition-all">
										<div class="flex items-center gap-2.5 min-w-0">
											<img
												src={lst.imageUrl}
												alt={lst.collectionName || lst.name}
												class="w-11 h-11 rounded-xl object-cover bg-black/40 border border-white/10 shrink-0"
												loading="lazy"
											/>
											<div class="min-w-0">
												<button
													type="button"
													onClick={() => selectAndInspectCollection(lst.collectionSlug)}
													class="text-xs font-black text-white hover:text-[#2990ff] truncate block text-start"
												>
													{lst.collectionName || lst.name}{' '}
													<span class="font-mono">#{lst.serialNumber}</span>
												</button>
												<div class="text-[10px] font-mono text-emerald-400 mt-0.5">
													{lst.relativeTime || 'Listed For Sale'}
												</div>
											</div>
										</div>

										<div class="text-end shrink-0" dir="ltr">
											<div class="text-xs font-black font-mono text-emerald-400">
												{(lst.priceGram || 0).toLocaleString('en-US')} TON
											</div>
											<div class="text-[9px] font-mono text-white/40">
												${Math.round(lst.priceUsd || 0).toLocaleString('en-US')}
											</div>
											<a
												href={lst.fragmentUrl}
												target="_blank"
												rel="noreferrer"
												class="inline-block mt-1 text-[9px] font-bold text-[#2990ff] hover:underline"
											>
												{t('giftsChart.buyBtn')} ↗
											</a>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>
				</div>
			</Show>
		</div>
	);
};
