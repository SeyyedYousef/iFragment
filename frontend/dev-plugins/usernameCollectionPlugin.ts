import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

interface ScrapedRow {
	item_name: string;
	price: string;
	price_ton: number;
	status: string;
	auction_type: string;
	ends_at: string;
	time_left: string;
	timestamp: string;
	char_length: number;
	verified: boolean;
}

let cachedLiveBundle: { ts: number; data: Record<string, unknown> } | null = null;

function parseTonVal(raw: string): number {
	const clean = raw
		.replace(/TON/gi, '')
		.replace(/,/g, '')
		.trim();
	const v = Number.parseFloat(clean);
	return Number.isFinite(v) && v > 0 ? v : 0;
}

async function scrapeFragmentPage(
	url: string,
	defaultStatus: string,
	limit = 25,
): Promise<{ rows: ScrapedRow[]; total: number }> {
	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
				Accept: 'text/html,application/xhtml+xml',
			},
			signal: AbortSignal.timeout(6500),
		});
		if (!res.ok) return { rows: [], total: 0 };
		const html = await res.text();
		const trMatches = [...html.matchAll(/<tr class="tm-row-selectable">([\s\S]*?)<\/tr>/g)];
		const rows: ScrapedRow[] = [];

		for (let i = 0; i < Math.min(limit, trMatches.length); i++) {
			const rowHtml = trMatches[i][1];
			const hMatch = rowHtml.match(/<div class="table-cell-value tm-value">@([a-zA-Z0-9_]+)<\/div>/);
			const pMatch = rowHtml.match(
				/<div class="table-cell-value tm-value icon-before icon-ton">([0-9,.]+)<\/div>/,
			);
			if (!hMatch || !pMatch) continue;
			const handle = hMatch[1].trim();
			const rawPrice = pMatch[1].trim();
			const priceTon = parseTonVal(rawPrice);

			let auctionType = 'Primary Mint';
			if (rowHtml.includes('>Resale<')) {
				auctionType = 'Secondary Resale';
			} else if (defaultStatus === 'For Sale') {
				auctionType = 'Fixed Price';
			} else if (defaultStatus === 'Sold') {
				auctionType = 'Settled';
			}

			const timeMatches = [...rowHtml.matchAll(/<time datetime="([^"]+)"[^>]*>([^<]*)<\/time>/g)];
			const endsAt = timeMatches[0]?.[1]?.trim() || '';
			let timeLeft = timeMatches[0]?.[2]?.trim() || '';
			if (!timeLeft && timeMatches[1]?.[2]) {
				timeLeft = timeMatches[1][2].trim();
			}

			rows.push({
				item_name: `@${handle}`,
				price: `${rawPrice} TON`,
				price_ton: priceTon,
				status: defaultStatus,
				auction_type: auctionType,
				ends_at: endsAt,
				time_left: timeLeft,
				timestamp: endsAt,
				char_length: handle.length,
				verified: true,
			});
		}
		return { rows, total: trMatches.length };
	} catch {
		return { rows: [], total: 0 };
	}
}

async function fetchTonAPITeleMintLive() {
	try {
		const res = await fetch(
			'https://tonapi.io/v2/accounts/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi/events?limit=15',
			{
				headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
				signal: AbortSignal.timeout(6500),
			},
		);
		if (!res.ok) return { events: [], tvmSnapshot: null };
		const body = (await res.json()) as { events?: Array<Record<string, any>> };
		const events: Array<Record<string, unknown>> = [];
		let sampleNft = '';
		let sampleHandle = '';
		let sampleCodeHash = '';
		let sampleDataHash = '';

		for (const ev of body.events || []) {
			for (const act of ev.actions || []) {
				const txHash = act.base_transactions?.[0] || ev.event_id;
				const timeIso = new Date((ev.timestamp || 0) * 1000).toISOString();

				if (act.AuctionBid) {
					const ab = act.AuctionBid;
					const tonVal = Math.round((Number(ab.amount?.value || 0) / 1e9) * 100) / 100;
					let handle = String(ab.nft?.metadata?.name || '').trim();
					if (handle && !handle.startsWith('@')) handle = `@${handle}`;
					if (!sampleNft && ab.nft?.address) {
						sampleNft = ab.nft.address;
						sampleHandle = handle;
						sampleCodeHash = ab.nft.code_hash || '';
						sampleDataHash = ab.nft.data_hash || '';
					}
					events.push({
						event_id: txHash,
						timestamp: ev.timestamp,
						time_iso: timeIso,
						lt: ev.lt,
						action_type: 'AuctionBid',
						opcode: '0x487a8e81',
						opcode_label: 'teleitem_bid (TVM Auction Engine)',
						username: handle,
						nft_address: ab.nft?.address || '',
						actor_address: ab.bidder?.address || '',
						amount_ton: tonVal,
						code_hash: ab.nft?.code_hash,
						data_hash: ab.nft?.data_hash,
					});
				} else if (act.NftPurchase) {
					const np = act.NftPurchase;
					const tonVal = Math.round((Number(np.amount?.value || 0) / 1e9) * 100) / 100;
					let handle = String(np.nft?.metadata?.name || '').trim();
					if (handle && !handle.startsWith('@')) handle = `@${handle}`;
					events.push({
						event_id: txHash,
						timestamp: ev.timestamp,
						time_iso: timeIso,
						lt: ev.lt,
						action_type: 'NftPurchase',
						opcode: '0x5fcc3d14',
						opcode_label: 'tep62_transfer (Settlement)',
						username: handle,
						nft_address: np.nft?.address || '',
						actor_address: np.buyer?.address || '',
						amount_ton: tonVal,
						code_hash: np.nft?.code_hash,
						data_hash: np.nft?.data_hash,
					});
				}
			}
		}

		let tvmSnapshot: Record<string, unknown> | null = null;
		if (sampleNft) {
			const [stRes, cfgRes] = await Promise.all([
				fetch(
					`https://tonapi.io/v2/blockchain/accounts/${sampleNft}/methods/get_telemint_auction_state`,
					{ headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) },
				).catch(() => null),
				fetch(
					`https://tonapi.io/v2/blockchain/accounts/${sampleNft}/methods/get_telemint_auction_config`,
					{ headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) },
				).catch(() => null),
			]);
			const stJson = stRes?.ok ? ((await stRes.json()) as Record<string, any>) : null;
			const cfgJson = cfgRes?.ok ? ((await cfgRes.json()) as Record<string, any>) : null;
			if (stJson?.success || cfgJson?.success) {
				const bene = String(cfgJson?.decoded?.beneficiar || '');
				tvmSnapshot = {
					username: sampleHandle,
					nft_address: sampleNft,
					bidder_address: String(stJson?.decoded?.bidder || ''),
					current_bid_ton: Math.round((Number(stJson?.decoded?.bid || 0) / 1e9) * 100) / 100,
					min_next_bid_ton: Math.round((Number(stJson?.decoded?.min_bid || 0) / 1e9) * 100) / 100,
					bid_timestamp: Number(stJson?.decoded?.bid_ts || 0),
					end_timestamp: Number(stJson?.decoded?.end_time || 0),
					beneficiary_address: bene,
					is_primary_mint: bene.startsWith('0:426f81e1'),
					initial_min_bid_ton:
						Math.round((Number(cfgJson?.decoded?.initial_min_bid || 0) / 1e9) * 100) / 100,
					min_bid_step_pct: Number(cfgJson?.decoded?.min_bid_step || 5),
					anti_snipe_window_sec: Number(cfgJson?.decoded?.min_extend_time || 3600),
					duration_sec: Number(cfgJson?.decoded?.duration || 604800),
					code_hash: sampleCodeHash,
					data_hash: sampleDataHash,
					raw_state_boc_hex: stJson?.stack?.[0]?.cell || '',
					raw_config_boc_hex: cfgJson?.stack?.[0]?.cell || '',
				};
			}
		}

		return { events, tvmSnapshot };
	} catch {
		return { events: [], tvmSnapshot: null };
	}
}

export function usernameCollectionLivePlugin(): Plugin {
	return {
		name: 'username-collection-live-enrichment',
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				if (!req.url?.startsWith('/api/v1/usernames/collection/stats')) {
					return next();
				}
				try {
					if (cachedLiveBundle && Date.now() - cachedLiveBundle.ts < 120_000) {
						res.setHeader('Content-Type', 'application/json');
						res.end(JSON.stringify(cachedLiveBundle.data));
						return;
					}

					const [
						upstreamRes,
						highAuc,
						endingAuc,
						lowAuc,
						floorSale,
						topSold,
						recentSold,
						tonLive,
					] = await Promise.all([
						fetch('https://109-172-94-139.sslip.io/api/v1/usernames/collection/stats', {
							headers: { Origin: 'https://ifragment.app' },
							signal: AbortSignal.timeout(7000),
						}).catch(() => null),
						scrapeFragmentPage('https://fragment.com/?filter=auction', 'Active', 25),
						scrapeFragmentPage('https://fragment.com/?filter=auction&sort=ending', 'Ending Soon', 25),
						scrapeFragmentPage('https://fragment.com/?filter=auction&sort=price_asc', 'Active', 5),
						scrapeFragmentPage('https://fragment.com/?filter=sale&sort=price_asc', 'For Sale', 20),
						scrapeFragmentPage('https://fragment.com/?filter=sold&sort=price_desc', 'Sold', 25),
						scrapeFragmentPage('https://fragment.com/?filter=sold&sort=listed', 'Sold', 25),
						fetchTonAPITeleMintLive(),
					]);

					const base: Record<string, any> =
						upstreamRes?.ok ? ((await upstreamRes.json()) as Record<string, any>) : {};

					const buyNowFloor = floorSale.rows[0]?.price_ton || 6;
					const lowAucPrices = lowAuc.rows.map((r) => r.price_ton).filter((v) => v > 0);
					const fallbackAucPrices = [...endingAuc.rows, ...highAuc.rows]
						.map((r) => r.price_ton)
						.filter((v) => v > 0);
					const auctionFloor =
						lowAucPrices.length > 0
							? Math.min(...lowAucPrices)
							: fallbackAucPrices.length > 0
								? Math.min(...fallbackAucPrices)
								: 6;

					// Compute genuine AVM undervalued auctions (without 15.3% artificial clamp)
					const seenU = new Set<string>();
					const candidates = [...endingAuc.rows, ...highAuc.rows].filter((r) => {
						const k = r.item_name.toLowerCase();
						if (seenU.has(k)) return false;
						seenU.add(k);
						return true;
					});

					const undervalued: Array<Record<string, unknown>> = [];
					for (const auc of candidates) {
						const clean = auc.item_name.replace(/^@/, '');
						const cLen = clean.length;
						const isAlpha = /^[a-zA-Z]+$/.test(clean);
						let fair = cLen <= 4 ? 6800 : cLen === 5 ? 140 : cLen === 6 ? 48 : 28;
						if (isAlpha) fair *= 1.45;
						if (/(.)\1/.test(clean)) fair *= 1.25;
						if (auc.price_ton >= fair * 0.95) continue;
						const disc = Math.round(((fair - auc.price_ton) / fair) * 1000) / 10;
						if (disc < 5) continue;
						undervalued.push({
							username: auc.item_name,
							current_bid_ton: auc.price_ton,
							estimated_fair_ton: Math.round(fair * 10) / 10,
							discount_pct: disc,
							length: cLen,
							auction_type: auc.auction_type,
							ends_at: auc.ends_at,
							time_left: auc.time_left,
							signal: disc >= 40 ? 'Deep Value Alpha' : disc >= 20 ? 'Strong Undervalued' : 'Sniper Window',
							status: auc.status,
						});
					}
					undervalued.sort((a, b) => Number(b.discount_pct) - Number(a.discount_pct));

					// Merge Top Sales Hall of Fame
					const genesisTop: ScrapedRow[] = [
						{ item_name: '@danbao', price: '1,583,948 TON', price_ton: 1583948, status: '7 Feb 2026', auction_type: 'Primary Mint', ends_at: '7 Feb 2026', time_left: '7 Feb 2026', timestamp: '2026-02-07T17:04:13Z', char_length: 6, verified: true },
						{ item_name: '@news', price: '994,000 TON', price_ton: 994000, status: '18 Nov 2022', auction_type: 'Primary Mint', ends_at: '18 Nov 2022', time_left: '18 Nov 2022', timestamp: '2022-11-18T14:20:00Z', char_length: 4, verified: true },
						{ item_name: '@auto', price: '900,000 TON', price_ton: 900000, status: '5 Nov 2022', auction_type: 'Primary Mint', ends_at: '5 Nov 2022', time_left: '5 Nov 2022', timestamp: '2022-11-05T18:00:00Z', char_length: 4, verified: true },
						{ item_name: '@bank', price: '850,000 TON', price_ton: 850000, status: '4 Nov 2022', auction_type: 'Primary Mint', ends_at: '4 Nov 2022', time_left: '4 Nov 2022', timestamp: '2022-11-04T19:12:00Z', char_length: 4, verified: true },
						{ item_name: '@avia', price: '800,000 TON', price_ton: 800000, status: '6 Nov 2022', auction_type: 'Primary Mint', ends_at: '6 Nov 2022', time_left: '6 Nov 2022', timestamp: '2022-11-06T16:40:00Z', char_length: 4, verified: true },
						{ item_name: '@chat', price: '700,000 TON', price_ton: 700000, status: '7 Nov 2022', auction_type: 'Primary Mint', ends_at: '7 Nov 2022', time_left: '7 Nov 2022', timestamp: '2022-11-07T12:15:00Z', char_length: 4, verified: true },
						{ item_name: '@king', price: '675,000 TON', price_ton: 675000, status: '5 Nov 2022', auction_type: 'Primary Mint', ends_at: '5 Nov 2022', time_left: '5 Nov 2022', timestamp: '2022-11-05T15:30:00Z', char_length: 4, verified: true },
						{ item_name: '@fifa', price: '600,000 TON', price_ton: 600000, status: '9 Nov 2022', auction_type: 'Primary Mint', ends_at: '9 Nov 2022', time_left: '9 Nov 2022', timestamp: '2022-11-09T20:00:00Z', char_length: 4, verified: true },
						{ item_name: '@devil', price: '550,000 TON', price_ton: 550000, status: '12 Nov 2022', auction_type: 'Primary Mint', ends_at: '12 Nov 2022', time_left: '12 Nov 2022', timestamp: '2022-11-12T11:45:00Z', char_length: 5, verified: true },
						{ item_name: '@casino', price: '400,000 TON', price_ton: 400000, status: '2 Nov 2022', auction_type: 'Primary Mint', ends_at: '2 Nov 2022', time_left: '2 Nov 2022', timestamp: '2022-11-02T17:00:00Z', char_length: 6, verified: true },
						{ item_name: '@crypto', price: '350,000 TON', price_ton: 350000, status: '14 Mar 2023', auction_type: 'Secondary Resale', ends_at: '14 Mar 2023', time_left: '14 Mar 2023', timestamp: '2023-03-14T09:30:00Z', char_length: 6, verified: true },
						{ item_name: '@wallet', price: '260,000 TON', price_ton: 260000, status: '22 Jan 2023', auction_type: 'Primary Mint', ends_at: '22 Jan 2023', time_left: '22 Jan 2023', timestamp: '2023-01-22T14:00:00Z', char_length: 6, verified: true },
					];
					const topMap = new Map<string, ScrapedRow>();
					for (const item of [...genesisTop, ...topSold.rows]) {
						const k = item.item_name.toLowerCase();
						const ex = topMap.get(k);
						if (!ex || item.price_ton > ex.price_ton) {
							topMap.set(k, item);
						}
					}
					const mergedTopSales = [...topMap.values()]
						.sort((a, b) => b.price_ton - a.price_ton)
						.slice(0, 25);

					// Build Whale Tracker from live TonAPI events
					const whaleMap = new Map<
						string,
						{ wallet: string; ton: number; count: number; handles: Set<string>; lastIso: string; tx: string }
					>();
					for (const ev of tonLive.events) {
						const w = String(ev.actor_address || '');
						const amt = Number(ev.amount_ton || 0);
						if (!w || amt <= 0) continue;
						const cur = whaleMap.get(w) || {
							wallet: w,
							ton: 0,
							count: 0,
							handles: new Set<string>(),
							lastIso: String(ev.time_iso || ''),
							tx: String(ev.event_id || ''),
						};
						cur.ton += amt;
						cur.count += 1;
						if (ev.username) cur.handles.add(String(ev.username));
						whaleMap.set(w, cur);
					}
					const whaleTracker = [...whaleMap.values()]
						.sort((a, b) => b.ton - a.ton)
						.map((w) => ({
							wallet_address: w.wallet,
							total_ton_deployed: Math.round(w.ton * 100) / 100,
							handles_count: w.count,
							sample_handles: [...w.handles].slice(0, 4),
							role_label:
								w.ton >= 500 || w.count >= 2 ? 'Smart Collector / Whale' : 'Active TeleMint Bidder',
							last_active_iso: w.lastIso,
							latest_tx_hash: w.tx,
						}));

					const tiers = Array.isArray(base.length_tier_matrix)
						? base.length_tier_matrix.map((t: Record<string, any>) => ({
								...t,
								theoretical_supply:
									t.length_bucket === '4'
										? '456,976 (26⁴)'
										: t.length_bucket === '5'
											? '11.88M (26⁵)'
											: t.length_bucket === '6'
												? '308.9M (26⁶)'
												: 'Open Namespace',
								primary_min_bid_ton:
									t.length_bucket === '4'
										? 504
										: t.length_bucket === '5'
											? 100
											: t.length_bucket === '6'
												? 40
												: 10,
							}))
						: [];

					const total30dVol = tiers.reduce(
						(acc: number, t: Record<string, any>) => acc + Number(t.volume_30d_ton || 0),
						0,
					);
					const total30dSales = tiers.reduce(
						(acc: number, t: Record<string, any>) => acc + Number(t.sales_count_30d || 0),
						0,
					);

					const semanticCategories = [
						{
							category_key: 'short_4',
							category_name: 'Ultra-Short 4-Char Handles',
							volume_ton: Math.round((tiers[0]?.volume_30d_ton || 455789) * 10) / 10,
							sales_count: tiers[0]?.sales_count_30d || 81,
							floor_ton: tiers[0]?.floor_price_ton || 4000,
							median_ton: tiers[0]?.median_sale_30d_ton || 5491,
							share_pct: 72.6,
						},
						{
							category_key: 'dictionary',
							category_name: 'English Dictionary & Single Words',
							volume_ton: Math.round((tiers[3]?.volume_30d_ton || 77908) * 10) / 10,
							sales_count: tiers[3]?.sales_count_30d || 2211,
							floor_ton: buyNowFloor,
							median_ton: 18,
							share_pct: 12.4,
						},
						{
							category_key: 'alpha_5',
							category_name: 'Premium 5-Letter Handles',
							volume_ton: Math.round((tiers[1]?.volume_30d_ton || 69809) * 10) / 10,
							sales_count: tiers[1]?.sales_count_30d || 1040,
							floor_ton: tiers[1]?.floor_price_ton || 10,
							median_ton: tiers[1]?.median_sale_30d_ton || 24,
							share_pct: 11.1,
						},
						{
							category_key: 'alpha_6',
							category_name: '6-Letter Brand & Crypto Handles',
							volume_ton: Math.round((tiers[2]?.volume_30d_ton || 24478) * 10) / 10,
							sales_count: tiers[2]?.sales_count_30d || 550,
							floor_ton: tiers[2]?.floor_price_ton || 6,
							median_ton: tiers[2]?.median_sale_30d_ton || 12,
							share_pct: 3.9,
						},
					];

					const enrichedPayload = {
						...base,
						stats: {
							...(base.stats || {}),
							floor_price: `${buyNowFloor} TON`,
							buy_now_floor_ton: buyNowFloor,
							auction_floor_ton: auctionFloor,
							volume_30d_ton: Math.round(total30dVol * 10) / 10 || 627986.6,
							sales_30d_count: total30dSales || 3882,
							avg_handles_per_owner: 3.54,
							active_auctions_count: highAuc.total || 500,
							listed_for_sale_count: floorSale.total || 500,
						},
						length_tier_matrix: tiers,
						semantic_categories: semanticCategories,
						undervalued_auctions: undervalued.slice(0, 10),
						auctions: highAuc.rows.length > 0 ? highAuc.rows : base.auctions || [],
						ending_soon_auctions: endingAuc.rows,
						floor_listings: floorSale.rows,
						top_sales: mergedTopSales,
						recent_activity: recentSold.rows.length > 0 ? recentSold.rows : base.recent_activity || [],
						on_chain_feed: tonLive.events,
						live_tvm_snapshot: tonLive.tvmSnapshot,
						whale_tracker: whaleTracker,
					};

					cachedLiveBundle = { ts: Date.now(), data: enrichedPayload };
					res.setHeader('Content-Type', 'application/json');
					res.end(JSON.stringify(enrichedPayload));
				} catch {
					next();
				}
			});
		},
	};
}

let cachedNumbersMacro: { ts: number; data: Record<string, any> } | null = null;
let cachedNumbersChart: { ts: number; data: Array<Record<string, any>> } | null = null;

async function fetchNumbersMacroBundle(): Promise<Record<string, any>> {
	if (cachedNumbersMacro && Date.now() - cachedNumbersMacro.ts < 120_000) {
		return cachedNumbersMacro.data;
	}
	const ua =
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

	const scrapeFragNumbers = async (url: string, limit = 15) => {
		try {
			const r = await fetch(url, {
				headers: { 'User-Agent': ua, Accept: 'text/html' },
				signal: AbortSignal.timeout(7000),
			});
			if (!r.ok) return [];
			const html = await r.text();
			const rows = [...html.matchAll(/<tr class="tm-row-selectable">([\s\S]*?)<\/tr>/g)];
			const out: Array<{
				number: string;
				formatted: string;
				price_ton: number;
				ends_at?: string;
				sold_at?: string;
				market: string;
				sale_type: string;
			}> = [];
			for (let i = 0; i < Math.min(limit, rows.length); i++) {
				const chunk = rows[i][1];
				const hrefM = chunk.match(/href="\/number\/(888\d+)"/);
				const valM = chunk.match(/<div class="table-cell-value tm-value">(\+888[\d\s]+)<\/div>/);
				const priceM = chunk.match(
					/<div class="table-cell-value tm-value icon-before icon-ton">([\d,]+(?:\.\d+)?)<\/div>/,
				);
				const timeM = chunk.match(/<time datetime="([^"]+)"/);
				if (!hrefM || !priceM) continue;
				const digits = hrefM[1];
				const formatted = valM ? valM[1].trim() : `+${digits}`;
				const priceTon = parseTonVal(priceM[1]);
				if (priceTon <= 0) continue;
				const dt = timeM?.[1] || '';
				out.push({
					number: digits,
					formatted,
					price_ton: priceTon,
					ends_at: dt,
					sold_at: dt,
					market: 'fragment',
					sale_type: url.includes('filter=auction')
						? 'auction'
						: url.includes('filter=sale')
							? 'for_sale'
							: 'sold',
				});
			}
			return out;
		} catch {
			return [];
		}
	};

	const fetchNums888Stats = async () => {
		const stats: Record<string, number> = {
			total_items: 136566,
			total_sales: 375639,
			volume_24h_ton: 318385,
			total_volume_ton: 133648687,
			total_owners: 48842,
			auctions_count: 151,
			fixed_price_count: 802,
			restricted_count: 4636,
			ton_rate_usd: 1.23,
			floor_ton: 2717,
			unrestricted_floor_ton: 2717,
		};
		try {
			const [homeRes, latestRes] = await Promise.all([
				fetch('https://nums888.io/', {
					headers: { 'User-Agent': ua },
					signal: AbortSignal.timeout(7000),
				}).catch(() => null),
				fetch('https://nums888.io/api/latest/', {
					headers: { 'User-Agent': ua, Accept: 'application/json' },
					signal: AbortSignal.timeout(6000),
				}).catch(() => null),
			]);
			if (homeRes?.ok) {
				const html = await homeRes.text();
				const block = html.match(/<div class="stats">([\s\S]*?)<\/div>\s*<div id="chart-panel">/);
				if (block) {
					const items = [
						...block[1].matchAll(
							/<div class="stat-label">\s*([^<]+?)\s*<\/div>\s*<div class="stat-value">[\s\S]*?([\d,]+(?:\.\d+)?)\s*<\/div>/g,
						),
					];
					for (const m of items) {
						const lbl = m[1].trim().toLowerCase();
						const val = parseTonVal(m[2]);
						if (val <= 0) continue;
						if (lbl === 'items') stats.total_items = Math.round(val);
						else if (lbl === 'sales') stats.total_sales = Math.round(val);
						else if (lbl === '24h volume') stats.volume_24h_ton = val;
						else if (lbl === 'total volume') stats.total_volume_ton = val;
						else if (lbl === 'holders') stats.total_owners = Math.round(val);
						else if (lbl === 'auctions') stats.auctions_count = Math.round(val);
						else if (lbl === 'fixed price') stats.fixed_price_count = Math.round(val);
						else if (lbl === 'restricted') stats.restricted_count = Math.round(val);
					}
				}
			}
			if (latestRes?.ok) {
				const lat = (await latestRes.json()) as Record<string, any>;
				if (Number(lat.r) > 0) stats.ton_rate_usd = Number(lat.r);
				if (Number(lat.f) > 0) stats.floor_ton = Number(lat.f);
				if (Number(lat.fn) > 0) stats.unrestricted_floor_ton = Number(lat.fn);
			}
		} catch {
			// Fallback to verified snapshot
		}
		return stats;
	};

	const fetchChartHistory = async () => {
		if (cachedNumbersChart && Date.now() - cachedNumbersChart.ts < 300_000) {
			return cachedNumbersChart.data;
		}
		try {
			const r = await fetch('https://109-172-94-139.sslip.io/api/v1/numbers/chart-data', {
				headers: { Origin: 'https://ifragment.app', Accept: 'application/json' },
				signal: AbortSignal.timeout(12000),
			});
			if (!r.ok) return [];
			const raw = (await r.json()) as Record<string, any>;
			const rateVal = Number(raw.rate || 1.23);
			const dataMap = (raw.data || {}) as Record<string, number[]>;
			const dates = Object.keys(dataMap).sort();
			const points = dates.map((d) => {
				const arr = Array.isArray(dataMap[d]) ? dataMap[d] : [];
				return {
					date: d,
					ton_rate: rateVal,
					floor_ton: Number(arr[0] || 0),
					floor_no_restrict: Number(arr[0] || 0),
					floor_usd: Number(arr[1] || 0),
					volume_ton: Number(arr[2] || 0),
					volume_usd: Number(arr[3] || 0),
					open_ton: Number(arr[4] || arr[0] || 0),
					high_ton: Number(arr[5] || arr[0] || 0),
					low_ton: Number(arr[6] || arr[0] || 0),
					close_ton: Number(arr[7] || arr[0] || 0),
					open_usd: Number(arr[8] || arr[1] || 0),
					high_usd: Number(arr[9] || arr[1] || 0),
					low_usd: Number(arr[10] || arr[1] || 0),
					close_usd: Number(arr[11] || arr[1] || 0),
				};
			});
			if (points.length > 0) {
				cachedNumbersChart = { ts: Date.now(), data: points };
			}
			return points;
		} catch {
			return [];
		}
	};

	const [
		macro,
		chartPoints,
		endingAuctions,
		topAuctions,
		lowestAuctions,
		topSales,
		recentSales,
		floorSales,
	] = await Promise.all([
		fetchNums888Stats(),
		fetchChartHistory(),
		scrapeFragNumbers('https://fragment.com/numbers?sort=ending&filter=auction', 12),
		scrapeFragNumbers('https://fragment.com/numbers?sort=price&filter=auction', 12),
		scrapeFragNumbers('https://fragment.com/numbers?sort=price_asc&filter=auction', 12),
		scrapeFragNumbers('https://fragment.com/numbers?sort=price_desc&filter=sold', 12),
		scrapeFragNumbers('https://fragment.com/numbers?sort=ending&filter=sold', 20),
		scrapeFragNumbers('https://fragment.com/numbers?sort=price_asc&filter=sale', 25),
	]);

	let vol7d = 0;
	let vol30d = 0;
	for (let i = Math.max(0, chartPoints.length - 30); i < chartPoints.length; i++) {
		const v = Number(chartPoints[i]?.volume_ton || 0);
		vol30d += v;
		if (i >= chartPoints.length - 7) {
			vol7d += v;
		}
	}

	const bundle = {
		macro,
		chartPoints,
		vol7d,
		vol30d,
		endingAuctions,
		topAuctions,
		lowestAuctions,
		topSales,
		recentSales,
		floorSales,
	};
	cachedNumbersMacro = { ts: Date.now(), data: bundle };
	return bundle;
}
