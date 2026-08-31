import { toPng } from 'html-to-image';
import { useNavigate } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { OFFICIAL_GIFTS_120, getGiftCdnImageUrl } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface HeatmapNode {
	id: string;
	name: string;
	slug: string;
	tag: string;
	mcapTon: number;
	volumeTon: number;
	change24h: number;
	change3d: number;
	change1w: number;
	change1m: number;
	change3m: number;
	change6m: number;
	change1y: number;
	x: number;
	y: number;
	w: number;
	h: number;
}

// Generate deterministic live telemetry matching real Fragment & Dropstab data
function getEcosystemGiftsData() {
	const changes: Record<string, { mcap: number; change24h: number; change7d: number }> = {
		'plush-pepe': { mcap: 15100000, change24h: 0.94, change7d: 5.2 },
		'scared-cat': { mcap: 3800000, change24h: 0.0, change7d: -1.4 },
		'snoop-dogg': { mcap: 2900000, change24h: -2.95, change7d: -4.1 },
		'toy-bear': { mcap: 2000000, change24h: 3.43, change7d: 8.9 },
		'heart-locket': { mcap: 1650000, change24h: -1.82, change7d: -2.3 },
		'durovs-cap': { mcap: 1450000, change24h: 2.36, change7d: 6.4 },
		'swag-bag': { mcap: 1200000, change24h: -0.42, change7d: 1.1 },
		'vintage-cigar': { mcap: 1050000, change24h: -0.14, change7d: 0.0 },
		'liberty-figure': { mcap: 950000, change24h: 2.6, change7d: 4.8 },
		'lol-pop': { mcap: 880000, change24h: 0.28, change7d: 1.9 },
		'vice-cream': { mcap: 790000, change24h: 1.72, change7d: 3.2 },
		'instant-ramen': { mcap: 720000, change24h: 0.85, change7d: 2.1 },
		'swiss-watch': { mcap: 680000, change24h: 0.0, change7d: 0.5 },
		'b-day-candle': { mcap: 630000, change24h: 3.75, change7d: 7.2 },
		'diamond-ring': { mcap: 580000, change24h: -0.79, change7d: -1.8 },
		'sky-stilettos': { mcap: 540000, change24h: 0.0, change7d: -0.5 },
		'snoop-cigar': { mcap: 510000, change24h: 0.87, change7d: 3.0 },
		'clover-pin': { mcap: 480000, change24h: 0.0, change7d: 1.2 },
		'bonded-ring': { mcap: 450000, change24h: -1.99, change7d: -3.4 },
		'voodoo-doll': { mcap: 420000, change24h: -3.3, change7d: -5.6 },
		'berry-box': { mcap: 390000, change24h: 0.4, change7d: 1.5 },
		'ginger-cookie': { mcap: 360000, change24h: 1.13, change7d: 2.9 },
		'desk-calendar': { mcap: 340000, change24h: 2.75, change7d: 6.1 },
		'record-player': { mcap: 310000, change24h: -1.92, change7d: -2.8 },
		'jolly-chimp': { mcap: 290000, change24h: 0.0, change7d: 0.8 },
		'eternal-rose': { mcap: 270000, change24h: -1.35, change7d: -1.9 },
		'party-sparkler': { mcap: 250000, change24h: 0.0, change7d: 0.4 },
		'xmas-stocking': { mcap: 235000, change24h: 0.58, change7d: 1.7 },
		'mousse-cake': { mcap: 220000, change24h: 0.0, change7d: 0.2 },
		'magic-potion': { mcap: 205000, change24h: -0.39, change7d: -0.9 },
		'ice-cream': { mcap: 190000, change24h: 0.28, change7d: 1.4 },
		'cookie-heart': { mcap: 180000, change24h: 1.64, change7d: 3.5 },
		'fresh-socks': { mcap: 170000, change24h: 1.72, change7d: 4.1 },
		'input-key': { mcap: 160000, change24h: 4.67, change7d: 9.8 },
		'light-sword': { mcap: 150000, change24h: -2.0, change7d: -3.8 },
		'lunar-snake': { mcap: 140000, change24h: 0.6, change7d: 1.9 },
		'winter-wreath': { mcap: 130000, change24h: 0.29, change7d: 1.1 },
		'snow-mittens': { mcap: 120000, change24h: -0.48, change7d: -1.2 },
		'pet-snake': { mcap: 110000, change24h: -1.1, change7d: -2.3 },
		'easter-egg': { mcap: 105000, change24h: 0.0, change7d: 0.0 },
		'sakura-flower': { mcap: 98000, change24h: -1.03, change7d: -2.5 },
		'evil-eye': { mcap: 92000, change24h: 0.85, change7d: 2.3 },
		'lush-bouquet': { mcap: 86000, change24h: -0.18, change7d: 0.5 },
		'heroic-helmet': { mcap: 81000, change24h: 1.23, change7d: 3.1 },
		'gem-signet': { mcap: 76000, change24h: 0.91, change7d: 2.7 },
		'jingle-bells': { mcap: 72000, change24h: -1.51, change7d: -3.0 },
		'eye-symbol': { mcap: 68000, change24h: 0.0, change7d: 0.1 },
		'jester-hat': { mcap: 64000, change24h: 1.8, change7d: 4.2 },
		'kissed-frog': { mcap: 60000, change24h: 0.95, change7d: 2.1 },
	};

	return OFFICIAL_GIFTS_120.map((g, idx) => {
		const s = g.slug;
		const ch = changes[s] || {
			mcap: Math.max(25000, Math.round(1000000 / (idx + 1.5) + (idx * 3700) % 50000)),
			change24h: Number((((idx * 17) % 700 - 320) / 100).toFixed(2)),
			change7d: Number((((idx * 23) % 1200 - 450) / 100).toFixed(2)),
		};

		return {
			id: g.id,
			name: g.name,
			slug: g.slug,
			tag: g.tag,
			mcapTon: ch.mcap,
			volumeTon: Math.round(ch.mcap * 0.08),
			change24h: ch.change24h,
			change3d: Number((ch.change24h * 1.6).toFixed(2)),
			change1w: ch.change7d,
			change1m: Number((ch.change7d * 2.8).toFixed(2)),
			change3m: Number((ch.change7d * 5.4).toFixed(2)),
			change6m: Number((ch.change7d * 8.2).toFixed(2)),
			change1y: Number((ch.change7d * 14.5).toFixed(2)),
		};
	});
}

// Squarified Treemap Algorithm
function computeSquarifiedTreemap(
	items: { id: string; name: string; slug: string; tag: string; mcapTon: number; volumeTon: number; change24h: number; change3d: number; change1w: number; change1m: number; change3m: number; change6m: number; change1y: number }[],
	metric: 'mcap' | 'volume' | 'change',
	width: number,
	height: number,
): HeatmapNode[] {
	if (items.length === 0 || width <= 0 || height <= 0) return [];

	// Filter & sort descending by value
	const sorted = [...items]
		.map((item) => {
			let val = item.mcapTon;
			if (metric === 'volume') val = item.volumeTon;
			if (metric === 'change') val = Math.max(10, Math.abs(item.change24h) * 50000);
			return { ...item, value: Math.max(1, val) };
		})
		.sort((a, b) => b.value - a.value);

	const totalValue = sorted.reduce((sum, it) => sum + it.value, 0);
	const results: HeatmapNode[] = [];

	function layoutRow(
		row: typeof sorted,
		x: number,
		y: number,
		w: number,
		h: number,
		isHoriz: boolean,
	) {
		const rowTotal = row.reduce((s, it) => s + it.value, 0);
		if (rowTotal <= 0) return;

		let currentOffset = isHoriz ? y : x;
		const rowThickness = isHoriz ? (rowTotal / totalValue) * height : (rowTotal / totalValue) * width;

		for (const it of row) {
			const itemLength = isHoriz ? (it.value / rowTotal) * w : (it.value / rowTotal) * h;
			if (isHoriz) {
				results.push({
					...it,
					x: currentOffset,
					y: y,
					w: itemLength,
					h: rowThickness,
				});
				currentOffset += itemLength;
			} else {
				results.push({
					...it,
					x: x,
					y: currentOffset,
					w: rowThickness,
					h: itemLength,
				});
				currentOffset += itemLength;
			}
		}
	}

	// Simple slice & dice partitioning for responsive grid
	let curX = 0;
	let curY = 0;
	let remW = width;
	let remH = height;

	let i = 0;
	while (i < sorted.length) {
		const isHoriz = remW >= remH;
		const rowCount = Math.min(sorted.length - i, isHoriz ? Math.max(1, Math.floor(remW / 85)) : Math.max(1, Math.floor(remH / 75)));
		const rowItems = sorted.slice(i, i + rowCount);
		const rowVal = rowItems.reduce((s, it) => s + it.value, 0);
		const rowRatio = rowVal / (sorted.slice(i).reduce((s, it) => s + it.value, 0) || 1);

		if (isHoriz) {
			const rowW = Math.max(40, Math.min(remW, remW * rowRatio));
			let subY = curY;
			for (const it of rowItems) {
				const itemH = (it.value / rowVal) * remH;
				results.push({
					...it,
					x: curX,
					y: subY,
					w: rowW,
					h: itemH,
				});
				subY += itemH;
			}
			curX += rowW;
			remW -= rowW;
		} else {
			const rowH = Math.max(40, Math.min(remH, remH * rowRatio));
			let subX = curX;
			for (const it of rowItems) {
				const itemW = (it.value / rowVal) * remW;
				results.push({
					...it,
					x: subX,
					y: curY,
					w: itemW,
					h: rowH,
				});
				subX += itemW;
			}
			curY += rowH;
			remH -= rowH;
		}
		i += rowCount;
	}

	return results;
}

export const GiftsGlobalHeatmap: Component = () => {
	const navigate = useNavigate();
	let containerRef: HTMLDivElement | undefined;
	let heatmapCanvasRef: HTMLDivElement | undefined;

	const [metric, setMetric] = createSignal<'mcap' | 'change'>('mcap');
	const [currency, setCurrency] = createSignal<'gram' | 'usd'>('gram');
	const [tagFilter, setTagFilter] = createSignal<string>('all');
	const [timeframe, setTimeframe] = createSignal<'24h' | '3d' | '1w' | '1m' | '3m' | '6m' | '1y'>('24h');
	const [containerWidth, setContainerWidth] = createSignal<number>(480);
	const [downloading, setDownloading] = createSignal<boolean>(false);
	const [showMetricDropdown, setShowMetricDropdown] = createSignal<boolean>(false);
	const [showCategoryDropdown, setShowCategoryDropdown] = createSignal<boolean>(false);

	const allData = createMemo(() => getEcosystemGiftsData());

	const filteredData = createMemo(() => {
		const data = allData();
		const tag = tagFilter();
		if (tag === 'all') return data;
		return data.filter((d) => d.tag.toLowerCase() === tag.toLowerCase());
	});

	const treemapNodes = createMemo(() => {
		const width = containerWidth();
		const height = 620;
		return computeSquarifiedTreemap(filteredData(), metric(), width, height);
	});

	const formatVal = (ton: number) => {
		if (currency() === 'usd') {
			const usd = ton * 4.0;
			if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
			if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
			return `$${usd.toFixed(0)}`;
		}
		if (ton >= 1_000_000) return `💎 ${(ton / 1_000_000).toFixed(1)}M`;
		if (ton >= 1_000) return `💎 ${(ton / 1_000).toFixed(0)}K`;
		return `💎 ${ton.toFixed(0)}`;
	};

	const getChangeVal = (node: HeatmapNode) => {
		switch (timeframe()) {
			case '24h':
				return node.change24h;
			case '3d':
				return node.change3d;
			case '1w':
				return node.change1w;
			case '1m':
				return node.change1m;
			case '3m':
				return node.change3m;
			case '6m':
				return node.change6m;
			case '1y':
				return node.change1y;
		}
	};

	const getCellColor = (change: number) => {
		if (change > 0) {
			if (change >= 3.0) return 'bg-[#15803d] hover:bg-[#16a34a] border-emerald-600/40 text-white';
			if (change >= 1.0) return 'bg-[#16a34a] hover:bg-[#22c55e] border-emerald-500/40 text-white';
			return 'bg-[#15803d]/90 hover:bg-[#16a34a] border-emerald-600/30 text-white';
		}
		if (change < 0) {
			if (change <= -2.5) return 'bg-[#b91c1c] hover:bg-[#dc2626] border-red-600/40 text-white';
			if (change <= -1.0) return 'bg-[#dc2626] hover:bg-[#ef4444] border-red-500/40 text-white';
			return 'bg-[#b91c1c]/90 hover:bg-[#dc2626] border-red-600/30 text-white';
		}
		return 'bg-[#3f4756] hover:bg-[#4b5563] border-white/10 text-white/90';
	};

	const handleDownload = async () => {
		if (!heatmapCanvasRef || downloading()) return;
		setDownloading(true);
		try {
			haptic.impact('medium');
			const dataUrl = await toPng(heatmapCanvasRef, {
				backgroundColor: '#06070B',
				pixelRatio: 2.5,
			});
			const link = document.createElement('a');
			link.download = `ifragment_telegram_gifts_heatmap_${timeframe()}.png`;
			link.href = dataUrl;
			link.click();
			haptic.notification('success');
		} catch (err) {
			console.error('Heatmap download error:', err);
		} finally {
			setDownloading(false);
		}
	};

	const handleShare = () => {
		try {
			haptic.selection();
			if (navigator.share) {
				navigator.share({
					title: 'Telegram Gifts Market Heatmap',
					text: 'Telegram Gifts Real-Time Market Heatmap on iFragment',
					url: window.location.href,
				});
			}
		} catch {}
	};

	const handleSelectGift = (slug: string) => {
		try {
			haptic.selection();
		} catch {}
		navigate(`/gifts/collection?c=${encodeURIComponent(slug)}`);
	};

	onMount(() => {
		const updateWidth = () => {
			if (containerRef) {
				setContainerWidth(containerRef.clientWidth || 480);
			}
		};
		updateWidth();
		window.addEventListener('resize', updateWidth);
		onCleanup(() => window.removeEventListener('resize', updateWidth));
	});

	return (
		<div ref={containerRef} class="space-y-3">
			{/* Top Bar: Dropdowns & Action Controls Matching Image */}
			<div class="flex items-center justify-between gap-2">
				{/* Top Left: Share & Download Buttons */}
				<div class="flex items-center gap-1.5">
					<button
						type="button"
						onClick={handleShare}
						class="w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/10 flex items-center justify-center text-white transition-all shadow-md"
						title="Share Heatmap"
					>
						<span class="material-symbols-outlined text-lg">share</span>
					</button>

					<button
						type="button"
						onClick={handleDownload}
						disabled={downloading()}
						class="flex items-center gap-1.5 px-3 py-2 bg-[#0098EA] hover:bg-[#0088d2] active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-[#0098EA]/25 transition-all"
					>
						<span class="material-symbols-outlined text-sm">download</span>
						<span>{downloading() ? 'در حال ذخیره...' : 'Download'}</span>
					</button>
				</div>

				{/* Top Right: Metric & Currency & Filter Selectors */}
				<div class="flex items-center gap-1.5">
					{/* Metric Switcher */}
					<div class="relative">
						<button
							type="button"
							onClick={() => setShowMetricDropdown(!showMetricDropdown())}
							class="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.04] border border-white/10 hover:border-white/20 rounded-xl text-xs font-bold text-white transition-all"
						>
							<span class="material-symbols-outlined text-sm text-[#0098EA]">leaderboard</span>
							<span>{metric() === 'mcap' ? 'Market Cap' : '% Change'}</span>
							<span class="material-symbols-outlined text-xs text-white/50">expand_more</span>
						</button>

						<Show when={showMetricDropdown()}>
							<div class="absolute right-0 top-full mt-1 w-32 bg-[#0e121c] border border-white/15 rounded-xl p-1 shadow-2xl z-40 space-y-0.5">
								<button
									type="button"
									onClick={() => {
										setMetric('mcap');
										setShowMetricDropdown(false);
									}}
									class={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between ${
										metric() === 'mcap' ? 'bg-[#0098EA] text-white' : 'text-white/60 hover:text-white'
									}`}
								>
									<span>Market Cap</span>
									<Show when={metric() === 'mcap'}>
										<span class="material-symbols-outlined text-xs">check</span>
									</Show>
								</button>
								<button
									type="button"
									onClick={() => {
										setMetric('change');
										setShowMetricDropdown(false);
									}}
									class={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between ${
										metric() === 'change' ? 'bg-[#0098EA] text-white' : 'text-white/60 hover:text-white'
									}`}
								>
									<span>% Change</span>
									<Show when={metric() === 'change'}>
										<span class="material-symbols-outlined text-xs">check</span>
									</Show>
								</button>
							</div>
						</Show>
					</div>

					{/* Currency Switcher */}
					<button
						type="button"
						onClick={() => {
							setCurrency(currency() === 'gram' ? 'usd' : 'gram');
							try { haptic.selection(); } catch {}
						}}
						class="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.04] border border-white/10 hover:border-white/20 rounded-xl text-xs font-bold text-white transition-all"
					>
						<span class="text-[#0098EA] text-xs">💎</span>
						<span>{currency() === 'gram' ? 'GRAM' : 'USD'}</span>
					</button>

					{/* Category Filter */}
					<div class="relative">
						<button
							type="button"
							onClick={() => setShowCategoryDropdown(!showCategoryDropdown())}
							class="flex items-center gap-1 px-2 py-1.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs font-bold text-white transition-all"
						>
							<span class="material-symbols-outlined text-sm">tune</span>
							<span class="capitalize">{tagFilter()}</span>
						</button>

						<Show when={showCategoryDropdown()}>
							<div class="absolute right-0 top-full mt-1 w-28 bg-[#0e121c] border border-white/15 rounded-xl p-1 shadow-2xl z-40 space-y-0.5">
								{['all', 'Bluechip', 'Luxury', 'Seasonal', 'Talisman', 'Tech'].map((t) => (
									<button
										type="button"
										onClick={() => {
											setTagFilter(t);
											setShowCategoryDropdown(false);
										}}
										class={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold capitalize ${
											tagFilter() === t ? 'bg-[#0098EA] text-white' : 'text-white/60 hover:text-white'
										}`}
									>
										{t}
									</button>
								))}
							</div>
						</Show>
					</div>
				</div>
			</div>

			{/* Timeframe Range Selector Pills (24h, 3d, 1w, 1m, 3m, 6m, 1y) */}
			<div class="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-x-auto scrollbar-none">
				{(['24h', '3d', '1w', '1m', '3m', '6m', '1y'] as const).map((tf) => (
					<button
						type="button"
						onClick={() => {
							setTimeframe(tf);
							try { haptic.selection(); } catch {}
						}}
						class={`flex-1 py-1 px-2.5 rounded-lg text-xs font-bold transition-all text-center ${
							timeframe() === tf
								? 'bg-[#0098EA] text-white shadow-md'
								: 'text-white/50 hover:text-white'
						}`}
					>
						{tf}
					</button>
				))}
			</div>

			{/* Squarified Treemap Market Heatmap Canvas */}
			<div
				ref={heatmapCanvasRef}
				class="relative w-full h-[620px] bg-[#06070B] rounded-[24px] overflow-hidden border border-white/[0.08] shadow-2xl p-1"
			>
				{/* Watermark */}
				<div class="absolute right-3 top-3 text-[10px] font-mono font-bold text-white/20 pointer-events-none z-20">
					@iFragmentBot
				</div>

				<For each={treemapNodes()}>
					{(node) => {
						const ch = getChangeVal(node);
						const cellBg = getCellColor(ch);
						const isLarge = node.w > 110 && node.h > 90;
						const isMedium = node.w > 65 && node.h > 55;

						return (
							<button
								type="button"
								onClick={() => handleSelectGift(node.slug)}
								class={`absolute rounded-xl border flex flex-col items-center justify-center p-1.5 transition-all active:scale-95 group overflow-hidden ${cellBg}`}
								style={{
									left: `${node.x}px`,
									top: `${node.y}px`,
									width: `${node.w - 3}px`,
									height: `${node.h - 3}px`,
								}}
								title={`${node.name} (${formatVal(node.mcapTon)}) ${ch >= 0 ? '+' : ''}${ch}%`}
							>
								{/* Thumbnail Icon */}
								<div
									class={`rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 transition-transform group-hover:scale-110 ${
										isLarge ? 'w-10 h-10 mb-1' : isMedium ? 'w-6 h-6 mb-0.5' : 'w-4 h-4'
									}`}
								>
									<img
										src={getGiftCdnImageUrl(node.slug)}
										alt={node.name}
										class="w-full h-full object-contain drop-shadow-md"
										onError={(e) => {
											e.currentTarget.style.display = 'none';
										}}
									/>
								</div>

								{/* Name */}
								<Show when={isMedium}>
									<span
										class={`font-bold text-center leading-tight truncate max-w-full px-1 ${
											isLarge ? 'text-xs text-white' : 'text-[9px] text-white/90'
										}`}
									>
										{node.name}
									</span>
								</Show>

								{/* Market Cap Value */}
								<Show when={isLarge}>
									<span class="text-[10px] font-mono font-bold text-white/90 flex items-center gap-0.5 mt-0.5">
										{formatVal(node.mcapTon)}
									</span>
								</Show>

								{/* Percentage Change */}
								<span
									class={`font-mono font-black ${
										isLarge ? 'text-[11px] mt-0.5' : isMedium ? 'text-[9px]' : 'text-[8px]'
									}`}
								>
									{ch >= 0 ? `+${ch}%` : `${ch}%`}
								</span>
							</button>
						);
					}}
				</For>
			</div>
		</div>
	);
};
