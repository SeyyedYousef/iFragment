import { toPng } from 'html-to-image';
import { useNavigate } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { OFFICIAL_GIFTS_120, GiftThumbnail } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export type HeatmapTimeframe = '24h' | '3d' | '1w' | '1m' | '3m' | '6m' | '1y';

interface HeatmapNode {
	id: string;
	name: string;
	slug: string;
	tag: string;
	emoji: string;
	mcapTon: number;
	volumeTon: number;
	currentChange: number;
	x: number;
	y: number;
	w: number;
	h: number;
}

// Generate realistic ecosystem metrics across all timeframes
function getEcosystemGiftsData() {
	const changes: Record<
		string,
		{ mcap: number; change24h: number; change3d: number; change1w: number; change1m: number; change3m: number; change6m: number; change1y: number }
	> = {
		'plush-pepe': { mcap: 15100000, change24h: 0.94, change3d: 2.15, change1w: 5.2, change1m: 14.8, change3m: 38.5, change6m: 85.0, change1y: 210.0 },
		'scared-cat': { mcap: 3800000, change24h: 0.0, change3d: -0.8, change1w: -1.4, change1m: 4.2, change3m: 12.0, change6m: 29.5, change1y: 95.0 },
		'snoop-dogg': { mcap: 2900000, change24h: -2.95, change3d: -5.1, change1w: -4.1, change1m: -8.5, change3m: 15.2, change6m: 45.0, change1y: 130.0 },
		'toy-bear': { mcap: 2000000, change24h: 3.43, change3d: 6.2, change1w: 8.9, change1m: 21.0, change3m: 54.0, change6m: 110.0, change1y: 320.0 },
		'heart-locket': { mcap: 1650000, change24h: -1.82, change3d: -3.0, change1w: -2.3, change1m: 1.5, change3m: 8.0, change6m: 22.0, change1y: 75.0 },
		'durovs-cap': { mcap: 1450000, change24h: 2.36, change3d: 4.5, change1w: 6.4, change1m: 18.0, change3m: 42.0, change6m: 95.0, change1y: 260.0 },
		'swag-bag': { mcap: 1200000, change24h: -0.42, change3d: 0.5, change1w: 1.1, change1m: 3.8, change3m: 9.5, change6m: 18.0, change1y: 50.0 },
		'vintage-cigar': { mcap: 1050000, change24h: -0.14, change3d: -0.2, change1w: 0.0, change1m: -2.1, change3m: 5.4, change6m: 14.0, change1y: 40.0 },
		'liberty-figure': { mcap: 950000, change24h: 2.6, change3d: 3.8, change1w: 4.8, change1m: 12.5, change3m: 31.0, change6m: 72.0, change1y: 190.0 },
		'lol-pop': { mcap: 880000, change24h: 0.28, change3d: 1.1, change1w: 1.9, change1m: 5.6, change3m: 14.2, change6m: 33.0, change1y: 88.0 },
		'vice-cream': { mcap: 790000, change24h: 1.72, change3d: 2.4, change1w: 3.2, change1m: 9.0, change3m: 24.5, change6m: 58.0, change1y: 160.0 },
		'instant-ramen': { mcap: 720000, change24h: 0.85, change3d: 1.5, change1w: 2.1, change1m: 7.4, change3m: 18.0, change6m: 42.0, change1y: 115.0 },
		'swiss-watch': { mcap: 680000, change24h: 0.0, change3d: 0.2, change1w: 0.5, change1m: 2.0, change3m: 6.8, change6m: 16.5, change1y: 48.0 },
		'b-day-candle': { mcap: 630000, change24h: 3.75, change3d: 5.8, change1w: 7.2, change1m: 19.5, change3m: 48.0, change6m: 105.0, change1y: 280.0 },
		'diamond-ring': { mcap: 580000, change24h: -0.79, change3d: -1.2, change1w: -1.8, change1m: 3.0, change3m: 11.5, change6m: 28.0, change1y: 82.0 },
		'sky-stilettos': { mcap: 540000, change24h: 0.0, change3d: -0.3, change1w: -0.5, change1m: 1.2, change3m: 4.5, change6m: 12.0, change1y: 35.0 },
		'snoop-cigar': { mcap: 510000, change24h: 0.87, change3d: 1.9, change1w: 3.0, change1m: 8.5, change3m: 22.0, change6m: 52.0, change1y: 140.0 },
		'clover-pin': { mcap: 480000, change24h: 0.0, change3d: 0.6, change1w: 1.2, change1m: 4.0, change3m: 10.5, change6m: 25.0, change1y: 70.0 },
		'bonded-ring': { mcap: 450000, change24h: -1.99, change3d: -2.8, change1w: -3.4, change1m: -6.0, change3m: 2.5, change6m: 15.0, change1y: 55.0 },
		'voodoo-doll': { mcap: 420000, change24h: -3.3, change3d: -4.5, change1w: -5.6, change1m: -10.2, change3m: -2.0, change6m: 8.5, change1y: 30.0 },
		'berry-box': { mcap: 390000, change24h: 0.4, change3d: 0.9, change1w: 1.5, change1m: 4.8, change3m: 13.0, change6m: 30.0, change1y: 80.0 },
		'ginger-cookie': { mcap: 360000, change24h: 1.13, change3d: 2.0, change1w: 2.9, change1m: 8.0, change3m: 20.5, change6m: 48.0, change1y: 130.0 },
		'desk-calendar': { mcap: 340000, change24h: 2.75, change3d: 4.2, change1w: 6.1, change1m: 16.0, change3m: 40.0, change6m: 90.0, change1y: 240.0 },
		'record-player': { mcap: 310000, change24h: -1.92, change3d: -2.5, change1w: -2.8, change1m: -4.5, change3m: 3.8, change6m: 14.0, change1y: 45.0 },
		'jolly-chimp': { mcap: 290000, change24h: 0.0, change3d: 0.4, change1w: 0.8, change1m: 2.5, change3m: 7.2, change6m: 18.0, change1y: 52.0 },
		'eternal-rose': { mcap: 270000, change24h: -1.35, change3d: -1.7, change1w: -1.9, change1m: 0.5, change3m: 6.0, change6m: 16.0, change1y: 50.0 },
		'party-sparkler': { mcap: 250000, change24h: 0.0, change3d: 0.2, change1w: 0.4, change1m: 1.8, change3m: 5.5, change6m: 13.5, change1y: 40.0 },
		'xmas-stocking': { mcap: 235000, change24h: 0.58, change3d: 1.1, change1w: 1.7, change1m: 5.2, change3m: 14.0, change6m: 32.0, change1y: 85.0 },
		'mousse-cake': { mcap: 220000, change24h: 0.0, change3d: 0.1, change1w: 0.2, change1m: 1.0, change3m: 4.2, change6m: 11.0, change1y: 32.0 },
		'magic-potion': { mcap: 205000, change24h: -0.39, change3d: -0.6, change1w: -0.9, change1m: 1.5, change3m: 5.8, change6m: 15.0, change1y: 45.0 },
		'ice-cream': { mcap: 190000, change24h: 0.28, change3d: 0.8, change1w: 1.4, change1m: 4.2, change3m: 11.5, change6m: 27.0, change1y: 72.0 },
		'cookie-heart': { mcap: 180000, change24h: 1.64, change3d: 2.5, change1w: 3.5, change1m: 9.8, change3m: 25.0, change6m: 60.0, change1y: 165.0 },
		'fresh-socks': { mcap: 170000, change24h: 1.72, change3d: 2.8, change1w: 4.1, change1m: 11.2, change3m: 29.0, change6m: 68.0, change1y: 180.0 },
		'input-key': { mcap: 160000, change24h: 4.67, change3d: 7.0, change1w: 9.8, change1m: 26.0, change3m: 65.0, change6m: 145.0, change1y: 380.0 },
		'light-sword': { mcap: 150000, change24h: -2.0, change3d: -3.0, change1w: -3.8, change1m: -7.2, change3m: 1.5, change6m: 12.0, change1y: 42.0 },
		'lunar-snake': { mcap: 140000, change24h: 0.6, change3d: 1.2, change1w: 1.9, change1m: 5.5, change3m: 15.0, change6m: 35.0, change1y: 92.0 },
		'winter-wreath': { mcap: 130000, change24h: 0.29, change3d: 0.7, change1w: 1.1, change1m: 3.6, change3m: 10.0, change6m: 24.0, change1y: 65.0 },
		'snow-mittens': { mcap: 120000, change24h: -0.48, change3d: -0.9, change1w: -1.2, change1m: 0.8, change3m: 4.8, change6m: 13.0, change1y: 38.0 },
		'pet-snake': { mcap: 110000, change24h: -1.1, change3d: -1.8, change1w: -2.3, change1m: -3.5, change3m: 2.8, change6m: 10.5, change1y: 34.0 },
		'easter-egg': { mcap: 105000, change24h: 0.0, change3d: 0.0, change1w: 0.0, change1m: 0.5, change3m: 2.5, change6m: 7.0, change1y: 22.0 },
		'sakura-flower': { mcap: 98000, change24h: -1.03, change3d: -1.7, change1w: -2.5, change1m: -4.0, change3m: 1.8, change6m: 9.0, change1y: 28.0 },
		'evil-eye': { mcap: 92000, change24h: 0.85, change3d: 1.5, change1w: 2.3, change1m: 6.8, change3m: 17.5, change6m: 40.0, change1y: 110.0 },
		'lush-bouquet': { mcap: 86000, change24h: -0.18, change3d: 0.1, change1w: 0.5, change1m: 2.2, change3m: 6.5, change6m: 16.0, change1y: 44.0 },
		'heroic-helmet': { mcap: 81000, change24h: 1.23, change3d: 2.1, change1w: 3.1, change1m: 8.8, change3m: 22.5, change6m: 54.0, change1y: 150.0 },
		'gem-signet': { mcap: 76000, change24h: 0.91, change3d: 1.8, change1w: 2.7, change1m: 7.9, change3m: 20.0, change6m: 48.0, change1y: 130.0 },
		'jingle-bells': { mcap: 72000, change24h: -1.51, change3d: -2.2, change1w: -3.0, change1m: -5.0, change3m: 1.2, change6m: 8.5, change1y: 26.0 },
		'eye-symbol': { mcap: 68000, change24h: 0.0, change3d: 0.1, change1w: 0.1, change1m: 0.8, change3m: 3.0, change6m: 8.0, change1y: 24.0 },
		'jester-hat': { mcap: 64000, change24h: 1.8, change3d: 2.9, change1w: 4.2, change1m: 11.5, change3m: 28.0, change6m: 65.0, change1y: 175.0 },
		'kissed-frog': { mcap: 60000, change24h: 0.95, change3d: 1.6, change1w: 2.1, change1m: 6.0, change3m: 15.5, change6m: 36.0, change1y: 98.0 },
	};

	return OFFICIAL_GIFTS_120.map((g, idx) => {
		const s = g.slug;
		const ch = changes[s] || {
			mcap: Math.max(25000, Math.round(1000000 / (idx + 1.5) + (idx * 3700) % 50000)),
			change24h: Number((((idx * 17) % 700 - 320) / 100).toFixed(2)),
			change3d: Number((((idx * 21) % 900 - 380) / 100).toFixed(2)),
			change1w: Number((((idx * 23) % 1200 - 450) / 100).toFixed(2)),
			change1m: Number((((idx * 29) % 2400 - 600) / 100).toFixed(2)),
			change3m: Number((((idx * 33) % 4500 - 800) / 100).toFixed(2)),
			change6m: Number((((idx * 41) % 8000 - 1000) / 100).toFixed(2)),
			change1y: Number((((idx * 47) % 15000 - 1200) / 100).toFixed(2)),
		};

		return {
			id: g.id,
			name: g.name,
			slug: g.slug,
			tag: g.tag,
			emoji: g.emoji || '🎁',
			mcapTon: ch.mcap,
			volumeTon: Math.round(ch.mcap * 0.08),
			change24h: ch.change24h,
			change3d: ch.change3d,
			change1w: ch.change1w,
			change1m: ch.change1m,
			change3m: ch.change3m,
			change6m: ch.change6m,
			change1y: ch.change1y,
		};
	});
}

// Squarified Treemap Algorithm with Timeframe & Metric Dynamics
function computeSquarifiedTreemap(
	items: ReturnType<typeof getEcosystemGiftsData>,
	metric: 'mcap' | 'change',
	timeframe: HeatmapTimeframe,
	width: number,
	height: number,
): HeatmapNode[] {
	if (items.length === 0 || width <= 0 || height <= 0) return [];

	const getNodeChange = (item: (typeof items)[0]): number => {
		switch (timeframe) {
			case '24h':
				return item.change24h;
			case '3d':
				return item.change3d;
			case '1w':
				return item.change1w;
			case '1m':
				return item.change1m;
			case '3m':
				return item.change3m;
			case '6m':
				return item.change6m;
			case '1y':
				return item.change1y;
		}
	};

	// Filter & sort descending by value
	const sorted = [...items]
		.map((item) => {
			const ch = getNodeChange(item);
			let val = item.mcapTon;
			if (metric === 'change') {
				val = Math.max(10, Math.abs(ch) * 100000 + item.mcapTon * 0.1);
			}
			return {
				...item,
				currentChange: ch,
				value: Math.max(1, val),
			};
		})
		.sort((a, b) => b.value - a.value);

	const totalValue = sorted.reduce((sum, it) => sum + it.value, 0);
	const results: HeatmapNode[] = [];

	let curX = 0;
	let curY = 0;
	let remW = width;
	let remH = height;

	let i = 0;
	while (i < sorted.length) {
		const isHoriz = remW >= remH;
		const rowCount = Math.min(
			sorted.length - i,
			isHoriz ? Math.max(1, Math.floor(remW / 85)) : Math.max(1, Math.floor(remH / 75)),
		);
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
	const [timeframe, setTimeframe] = createSignal<HeatmapTimeframe>('24h');
	const [containerWidth, setContainerWidth] = createSignal<number>(480);
	const [downloading, setDownloading] = createSignal<boolean>(false);
	const [showCategoryDropdown, setShowCategoryDropdown] = createSignal<boolean>(false);

	const allData = createMemo(() => getEcosystemGiftsData());

	const filteredData = createMemo(() => {
		const data = allData();
		const tag = tagFilter();
		if (tag === 'all') return data;
		return data.filter((d) => d.tag.toLowerCase() === tag.toLowerCase());
	});

	// Treemap recalculates cleanly whenever filteredData, metric, timeframe, or containerWidth changes!
	const treemapNodes = createMemo(() => {
		const width = containerWidth();
		const height = 620;
		return computeSquarifiedTreemap(filteredData(), metric(), timeframe(), width, height);
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

	const getCellColor = (change: number) => {
		if (change > 0) {
			if (change >= 5.0) return 'bg-[#15803d] hover:bg-[#16a34a] border-emerald-600/40 text-white';
			if (change >= 1.0) return 'bg-[#16a34a] hover:bg-[#22c55e] border-emerald-500/40 text-white';
			return 'bg-[#15803d]/90 hover:bg-[#16a34a] border-emerald-600/30 text-white';
		}
		if (change < 0) {
			if (change <= -5.0) return 'bg-[#991b1b] hover:bg-[#b91c1c] border-red-700/50 text-white';
			if (change <= -1.0) return 'bg-[#dc2626] hover:bg-[#ef4444] border-red-500/40 text-white';
			return 'bg-[#b91c1c]/90 hover:bg-[#dc2626] border-red-600/30 text-white';
		}
		return 'bg-[#374151] hover:bg-[#4b5563] border-white/10 text-white/90';
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
			link.download = `ifragment_telegram_gifts_heatmap_${timeframe()}_${metric()}.png`;
			link.href = dataUrl;
			link.click();
			haptic.notify('success');
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
					text: `Telegram Gifts ${timeframe()} Heatmap on iFragment`,
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
		<div ref={containerRef} class="space-y-2.5">
			{/* ═════════ 4 TOP CONTROLS TOOLBAR (PERFECT MOBILE RESPONSIVENESS) ═════════ */}
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0b0e17]/90 border border-white/[0.08] p-2 rounded-2xl shadow-lg">
				{/* 1. Metric Segment Switcher (Market Cap vs % Change) */}
				<div class="flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/5">
					<button
						type="button"
						onClick={() => {
							setMetric('mcap');
							try { haptic.selection(); } catch {}
						}}
						class={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-bold transition-all text-center ${
							metric() === 'mcap' ? 'bg-[#0098EA] text-white shadow' : 'text-white/50 hover:text-white'
						}`}
					>
						Market Cap
					</button>
					<button
						type="button"
						onClick={() => {
							setMetric('change');
							try { haptic.selection(); } catch {}
						}}
						class={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-bold transition-all text-center ${
							metric() === 'change' ? 'bg-[#0098EA] text-white shadow' : 'text-white/50 hover:text-white'
						}`}
					>
						% Change
					</button>
				</div>

				{/* 2. Currency Switcher (GRAM vs USD) */}
				<div class="flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/5">
					<button
						type="button"
						onClick={() => {
							setCurrency('gram');
							try { haptic.selection(); } catch {}
						}}
						class={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1 ${
							currency() === 'gram' ? 'bg-[#0098EA] text-white shadow' : 'text-white/50 hover:text-white'
						}`}
					>
						<span>💎</span>
						<span>GRAM</span>
					</button>
					<button
						type="button"
						onClick={() => {
							setCurrency('usd');
							try { haptic.selection(); } catch {}
						}}
						class={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-bold transition-all text-center ${
							currency() === 'usd' ? 'bg-[#0098EA] text-white shadow' : 'text-white/50 hover:text-white'
						}`}
					>
						$ USD
					</button>
				</div>

				{/* 3. Category Filter Dropdown */}
				<div class="relative">
					<button
						type="button"
						onClick={() => setShowCategoryDropdown(!showCategoryDropdown())}
						class="w-full flex items-center justify-between px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 rounded-xl text-[11px] font-bold text-white transition-all"
					>
						<div class="flex items-center gap-1 truncate">
							<span class="material-symbols-outlined text-xs text-[#0098EA]">tune</span>
							<span class="capitalize truncate">{tagFilter()}</span>
						</div>
						<span class="material-symbols-outlined text-xs text-white/50">expand_more</span>
					</button>

					<Show when={showCategoryDropdown()}>
						<div class="absolute left-0 right-0 top-full mt-1 bg-[#0e121c] border border-white/15 rounded-xl p-1 shadow-2xl z-40 space-y-0.5">
							{['all', 'Bluechip', 'Luxury', 'Seasonal', 'Talisman', 'Tech'].map((t) => (
								<button
									type="button"
									onClick={() => {
										setTagFilter(t);
										setShowCategoryDropdown(false);
										try { haptic.selection(); } catch {}
									}}
									class={`w-full text-left rtl:text-right px-2 py-1.5 rounded-lg text-xs font-bold capitalize flex items-center justify-between ${
										tagFilter() === t ? 'bg-[#0098EA] text-white' : 'text-white/60 hover:text-white'
									}`}
								>
									<span>{t === 'all' ? 'All (همه)' : t}</span>
									<Show when={tagFilter() === t}>
										<span class="material-symbols-outlined text-xs">check</span>
									</Show>
								</button>
							))}
						</div>
					</Show>
				</div>

				{/* 4. Action Buttons (Download & Share) */}
				<div class="flex items-center gap-1">
					<button
						type="button"
						onClick={handleDownload}
						disabled={downloading()}
						class="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-[#0098EA] hover:bg-[#0088d2] active:scale-95 text-white text-[11px] font-bold rounded-xl shadow-md shadow-[#0098EA]/25 transition-all"
					>
						<span class="material-symbols-outlined text-sm">download</span>
						<span>{downloading() ? '...' : 'Download'}</span>
					</button>
					<button
						type="button"
						onClick={handleShare}
						class="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 border border-white/10 flex items-center justify-center text-white transition-all shadow"
						title="Share Heatmap"
					>
						<span class="material-symbols-outlined text-sm">share</span>
					</button>
				</div>
			</div>

			{/* ═════════ TIMEFRAME SELECTOR PILLS (24h, 3d, 1w, 1m, 3m, 6m, 1y) ═════════ */}
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

			{/* ═════════ SQUARIFIED TREEMAP MARKET HEATMAP CANVAS ═════════ */}
			<div
				ref={heatmapCanvasRef}
				class="relative w-full h-[620px] bg-[#06070B] rounded-[24px] overflow-hidden border border-white/[0.08] shadow-2xl p-1"
			>
				{/* Top-Right Watermark */}
				<div class="absolute right-3 top-3 text-[10px] font-mono font-bold text-white/25 pointer-events-none z-20 flex items-center gap-1">
					<span class="text-[#0098EA]">⚡</span>
					<span>@iFragmentBot · {timeframe()}</span>
				</div>

				<For each={treemapNodes()}>
					{(node) => {
						const ch = node.currentChange;
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
								title={`${node.name} (${formatVal(node.mcapTon)}) ${ch >= 0 ? '+' : ''}${ch}% [${timeframe()}]`}
							>
								{/* Thumbnail Icon with 3D Fallback */}
								<GiftThumbnail
									slug={node.slug}
									name={node.name}
									size="sm"
									class={`border-0 bg-transparent flex-shrink-0 transition-transform group-hover:scale-110 ${
										isLarge ? 'w-10 h-10 mb-1 text-2xl' : isMedium ? 'w-6 h-6 mb-0.5 text-base' : 'w-4 h-4 text-xs'
									}`}
								/>

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

								{/* Value (Market Cap) */}
								<Show when={isLarge}>
									<span class="text-[10px] font-mono font-bold text-white/90 flex items-center gap-0.5 mt-0.5">
										{formatVal(node.mcapTon)}
									</span>
								</Show>

								{/* Dynamic Timeframe Percentage Change */}
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
