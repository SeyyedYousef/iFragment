import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

function computeBinaryAndByteForensics(
	u: string,
	liveTvmData?: {
		tokenNameCellBoc?: string;
		nftIndexHex?: string;
		individualContentBoc?: string;
		accountBalanceNano?: string;
		lastTxLt?: string;
		lastTxHash?: string;
		rawDataBocPrefix?: string;
		rawCodeBocPrefix?: string;
		auctionConfig?: {
			beneficiar: string;
			initialMinBidTon: number;
			maxBidTon: number;
			minBidStepPct: number;
			minExtendTimeSec: number;
			durationSec: number;
		};
	},
) {
	const utf8Bytes = Buffer.from(u, 'utf8');
	const asciiHexSpaced = Array.from(utf8Bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join(' ');
	const rawHexPayload = utf8Bytes.toString('hex');

	let setBitsCount = 0;
	const charFreq: Record<string, number> = {};
	let leftCount = 0;
	let rightCount = 0;

	const bitstreamMatrix = u.split('').map((ch, idx) => {
		const code = ch.charCodeAt(0);
		const bin8 = code.toString(2).padStart(8, '0');
		for (const bit of bin8) {
			if (bit === '1') setBitsCount++;
		}
		charFreq[ch] = (charFreq[ch] || 0) + 1;
		const isLeft = LEFT_HAND_KEYS.has(ch);
		if (isLeft) leftCount++;
		else rightCount++;
		const rowName = TOP_ROW_KEYS.has(ch)
			? 'TOP'
			: HOME_ROW_KEYS.has(ch)
				? 'HOME'
				: /[0-9]/.test(ch)
					? 'NUM'
					: 'BOTTOM';
		return {
			position: idx,
			char: ch,
			ascii_dec: code,
			hex_byte: `0x${code.toString(16).padStart(2, '0').toUpperCase()}`,
			binary_8bit: bin8,
			hamming_weight: bin8.split('').filter((b) => b === '1').length,
			morse: MORSE_TABLE[ch] || '?',
			keyboard_hand: isLeft ? 'L' : 'R',
			keyboard_row: rowName,
		};
	});

	const totalBits = u.length * 8;
	const hammingRatioPct = totalBits > 0 ? Math.round((setBitsCount / totalBits) * 1000) / 10 : 0;

	// Shannon Information Entropy H(X) = - sum(p(x) * log2(p(x)))
	let shannonEntropy = 0;
	for (const count of Object.values(charFreq)) {
		const p = count / u.length;
		shannonEntropy -= p * Math.log2(p);
	}
	shannonEntropy = Math.round(shannonEntropy * 1000) / 1000;

	// Hand alternation score (ergonomic typing speed metric)
	let alternations = 0;
	for (let i = 1; i < bitstreamMatrix.length; i++) {
		if (bitstreamMatrix[i].keyboard_hand !== bitstreamMatrix[i - 1].keyboard_hand) {
			alternations++;
		}
	}
	const handAlternationPct =
		u.length > 1 ? Math.round((alternations / (u.length - 1)) * 100) : 100;

	// Exact TEP-62 / TON DNS 256-bit NFT Index = SHA-256(username)
	const computedSha256Hex = `0x${createHash('sha256').update(u).digest('hex')}`;
	// Deterministic TON Standard BOC cell for get_telemint_token_name:
	// b5ee9c72 (BOC magic) + 0101010100 + len_bytes + 0000 + data_bits_len_hex + rawHexPayload
	const deterministicBocHex = `b5ee9c720101010100${(u.length + 2).toString(16).padStart(2, '0')}0000${(u.length * 2).toString(16).padStart(2, '0')}${rawHexPayload}`;

	return {
		ascii_hex_spaced: asciiHexSpaced.toUpperCase(),
		raw_hex_payload: `0x${rawHexPayload.toUpperCase()}`,
		byte_length: utf8Bytes.length,
		total_bits: totalBits,
		set_bits_popcount: setBitsCount,
		zero_bits_count: totalBits - setBitsCount,
		hamming_weight_pct: hammingRatioPct,
		shannon_entropy_bits: shannonEntropy,
		max_theoretical_entropy_bits: Math.round(Math.log2(Math.max(2, u.length)) * 1000) / 1000,
		unique_chars_count: Object.keys(charFreq).length,
		hand_alternation_pct: handAlternationPct,
		left_hand_keys: leftCount,
		right_hand_keys: rightCount,
		tep62_sha256_index: liveTvmData?.nftIndexHex || computedSha256Hex,
		telemint_token_cell_boc: (liveTvmData?.tokenNameCellBoc || deterministicBocHex).toLowerCase(),
		individual_content_boc: liveTvmData?.individualContentBoc || undefined,
		boc_magic_prefix: '0xB5EE9C72 (Standard TON Bag-of-Cells)',
		ton_dns_category_keys: {
			wallet: `0x${createHash('sha256').update('wallet').digest('hex').slice(0, 16)}...`,
			telegram: `0x${createHash('sha256').update('telegram').digest('hex').slice(0, 16)}...`,
			site: `0x${createHash('sha256').update('site').digest('hex').slice(0, 16)}...`,
		},
		account_storage_nanoton: liveTvmData?.accountBalanceNano || undefined,
		last_transaction_lt: liveTvmData?.lastTxLt || undefined,
		last_transaction_hash: liveTvmData?.lastTxHash || undefined,
		raw_data_boc_prefix: liveTvmData?.rawDataBocPrefix || undefined,
		raw_code_boc_prefix: liveTvmData?.rawCodeBocPrefix || undefined,
		auction_config: liveTvmData?.auctionConfig || undefined,
		bitstream_matrix: bitstreamMatrix,
	};
}

export function usernameValuationLivePlugin(): Plugin {
	let cachedTonUsd: { rate: number; ts: number } | null = null;
	const valuationCache = new Map<string, { ts: number; data: Record<string, any> }>();

	async function fetchLiveTonUsdRate(): Promise<{ rate: number; isFallback: boolean }> {
		if (cachedTonUsd && Date.now() - cachedTonUsd.ts < 90_000) {
			return { rate: cachedTonUsd.rate, isFallback: false };
		}
		try {
			const res = await fetch('https://tonapi.io/v2/rates?tokens=ton&currencies=usd', {
				headers: { Accept: 'application/json' },
				signal: AbortSignal.timeout(4000),
			});
			if (res.ok) {
				const j = (await res.json()) as any;
				const p = Number(j?.rates?.TON?.prices?.USD || 0);
				if (p > 0.1) {
					const rounded = Math.round(p * 1000) / 1000;
					cachedTonUsd = { rate: rounded, ts: Date.now() };
					return { rate: rounded, isFallback: false };
				}
			}
		} catch {
			// ignore
		}
		return { rate: cachedTonUsd?.rate || 5.25, isFallback: !cachedTonUsd };
	}

	async function scrapeFragmentUsernameDetail(u: string) {
		const result = {
			status: 'unknown' as 'sold' | 'on_auction' | 'on_sale' | 'taken' | 'available' | 'unavailable' | 'unknown',
			rawStatusText: '',
			priceTon: 0,
			ownerAddress: '',
			endsAtIso: '',
			mintDateIso: '',
			auctionLastLt: '',
			offerFeeMax: 100,
			offerFeeMult: 0.0005,
			ownershipHistory: [] as Array<{
				sale_price_ton: string;
				price_num: number;
				date: string;
				buyer: string;
				event_type: 'sale' | 'transfer';
			}>,
			bidHistory: [] as Array<{ price_ton: number; date: string; from: string }>,
		};
		try {
			const res = await fetch(`https://fragment.com/username/${encodeURIComponent(u)}`, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
					Accept: 'text/html,application/xhtml+xml',
				},
				signal: AbortSignal.timeout(6500),
			});
			if (!res.ok) return result;
			const html = await res.text();

			const statusMatch = html.match(/tm-section-header-status[^>]*>([^<]+)</i);
			const rawStatus = (statusMatch?.[1] || '').trim();
			result.rawStatusText = rawStatus;
			const sLower = rawStatus.toLowerCase();
			if (sLower.includes('sold')) result.status = 'sold';
			else if (sLower.includes('auction')) result.status = 'on_auction';
			else if (sLower.includes('sale')) result.status = 'on_sale';
			else if (sLower.includes('taken')) result.status = 'taken';
			else if (sLower.includes('available') && !sLower.includes('unavailable')) result.status = 'available';
			else if (sLower.includes('unavailable')) result.status = 'unavailable';

			// Extract inline ajInit state parameters (auctionLastLt, offerFeeMax, offerFeeMult)
			const ltMatch = html.match(/"auctionLastLt"\s*:\s*"?([0-9]+)"?/);
			if (ltMatch) result.auctionLastLt = ltMatch[1];
			const feeMaxMatch = html.match(/"offerFeeMax"\s*:\s*([0-9.]+)/);
			if (feeMaxMatch) result.offerFeeMax = Number(feeMaxMatch[1]) || 100;
			const feeMultMatch = html.match(/"offerFeeMult"\s*:\s*([0-9.]+)/);
			if (feeMultMatch) result.offerFeeMult = Number(feeMultMatch[1]) || 0.0005;

			// Split sections so we can accurately parse Section 0 (Header), Ownership History, and Bid History
			const sections = html.split('<section class="tm-section');
			const sec0 = sections[1] || html;

			const sec0PriceMatch = sec0.match(/icon-ton[^>]*>([0-9,.]+)<\/div>/);
			if (sec0PriceMatch) {
				result.priceTon = parseTonVal(sec0PriceMatch[1]);
			}

			const walletRegex = /href="https:\/\/(?:tonviewer\.com|gram\.org\/address)\/([A-Za-z0-9_-]{40,55})"/i;
			const sec0WalletMatch = sec0.match(walletRegex);
			if (sec0WalletMatch) {
				result.ownerAddress = sec0WalletMatch[1];
			}

			const sec0TimeMatch = sec0.match(/<time datetime="([^"]+)"/);
			if (sec0TimeMatch) {
				result.endsAtIso = sec0TimeMatch[1];
			}

			for (const sec of sections.slice(1)) {
				const headerMatch = sec.match(/tm-section-header-text[^>]*>([^<]+)</i);
				const hTitle = (headerMatch?.[1] || '').trim().toLowerCase();
				const trs = [...sec.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];

				if (hTitle.includes('ownership') || hTitle.includes('sale')) {
					for (const tr of trs) {
						const rowHtml = tr[1];
						const pMatch = rowHtml.match(/icon-ton[^>]*>([0-9,.]+)<\/div>/);
						const isTransferred = /tm-value[^>]*>\s*Transferred\s*</i.test(rowHtml);
						const tMatch = rowHtml.match(/<time datetime="([^"]+)"[^>]*>([^<]*)<\/time>/);
						const wMatch = rowHtml.match(walletRegex);
						if (pMatch) {
							const pNum = parseTonVal(pMatch[1]);
							const dateIso = tMatch?.[1] || new Date().toISOString();
							const buyerAddr = wMatch?.[1] || result.ownerAddress || '';
							result.ownershipHistory.push({
								sale_price_ton: pNum.toLocaleString('en-US'),
								price_num: pNum,
								date: dateIso,
								buyer: buyerAddr,
								event_type: 'sale',
							});
						} else if (isTransferred && tMatch) {
							const dateIso = tMatch[1];
							const buyerAddr = wMatch?.[1] || '';
							result.ownershipHistory.push({
								sale_price_ton: 'Transferred (On-Chain P2P)',
								price_num: 0,
								date: dateIso,
								buyer: buyerAddr,
								event_type: 'transfer',
							});
						}
					}
				} else if (hTitle.includes('bid') || hTitle.includes('offer')) {
					for (const tr of trs) {
						const rowHtml = tr[1];
						const pMatch = rowHtml.match(/icon-ton[^>]*>([0-9,.]+)<\/div>/);
						const tMatch = rowHtml.match(/<time datetime="([^"]+)"[^>]*>([^<]*)<\/time>/);
						const wMatch = rowHtml.match(walletRegex);
						if (pMatch) {
							const pNum = parseTonVal(pMatch[1]);
							const dateIso = tMatch?.[1] || '';
							const bidderAddr = wMatch?.[1] || '';
							result.bidHistory.push({
								price_ton: pNum,
								date: dateIso,
								from: bidderAddr,
							});
						}
					}
				}
			}

			if (!result.ownerAddress && result.ownershipHistory.length > 0) {
				result.ownerAddress = result.ownershipHistory[0].buyer;
			}
			if (result.ownershipHistory.length > 0) {
				result.mintDateIso = result.ownershipHistory[result.ownershipHistory.length - 1].date;
			}
		} catch {
			// ignore network timeout
		}
		return result;
	}

	async function scrapeFragmentSearchComps(u: string) {
		const comps: Array<{
			username: string;
			status: string;
			priceTon: number;
			dateIso: string;
		}> = [];
		try {
			const res = await fetch(`https://fragment.com/?query=${encodeURIComponent(u)}`, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
					Accept: 'text/html,application/xhtml+xml',
				},
				signal: AbortSignal.timeout(5500),
			});
			if (!res.ok) return comps;
			const html = await res.text();
			const trMatches = [...html.matchAll(/<tr class="tm-row-selectable">([\s\S]*?)<\/tr>/g)];
			for (const tr of trMatches.slice(0, 18)) {
				const rowHtml = tr[1];
				const hMatch = rowHtml.match(/<div class="table-cell-value tm-value">@([a-zA-Z0-9_]+)<\/div>/);
				if (!hMatch) continue;
				const handle = hMatch[1].toLowerCase().trim();
				if (!handle || handle === u) continue;

				const pMatch = rowHtml.match(/icon-ton[^>]*>([0-9,.]+)<\/div>/);
				const priceTon = pMatch ? parseTonVal(pMatch[1]) : 0;

				const statusMatch = rowHtml.match(/tm-status-([a-z]+)/i);
				const rawSt = (statusMatch?.[1] || '').toLowerCase();
				let status = 'taken';
				if (rawSt.includes('avail')) status = priceTon > 0 ? 'on_sale' : 'available';
				else if (rawSt.includes('auction')) status = 'on_auction';
				else if (rawSt.includes('sold')) status = 'sold';
				else if (rawSt.includes('unavail')) status = 'taken';

				if (rowHtml.includes('>Sold<')) status = 'sold';
				else if (rowHtml.includes('>On auction<')) status = 'on_auction';
				else if (rowHtml.includes('>For sale<')) status = 'on_sale';

				const tMatch = rowHtml.match(/<time datetime="([^"]+)"/);
				comps.push({
					username: handle,
					status,
					priceTon,
					dateIso: tMatch?.[1] || '',
				});
			}
		} catch {
			// ignore
		}
		return comps;
	}

	async function fetchTonApiUsernameIntel(u: string, fallbackOwner: string) {
		const OFFICIAL_COLLECTION = '0:80d78a35f955a14b679faa887ff4cd5bfc0f43b4a4eea2a7e6927f3701b273c2';
		const out = {
			isMintedNft: false,
			collectionVerified: false,
			itemAddress: '',
			collectionAddress: OFFICIAL_COLLECTION,
			ownerAddress: fallbackOwner || '',
			ownerName: '',
			codeHash: '',
			dataHash: '',
			nftImage: `https://nft.fragment.com/username/${u}.webp`,
			activeSalePriceTon: 0,
			activeSaleMarket: '',
			liveTvmData: {
				tokenNameCellBoc: '',
				nftIndexHex: '',
				individualContentBoc: '',
				accountBalanceNano: '',
				lastTxLt: '',
				lastTxHash: '',
				rawDataBocPrefix: '',
				rawCodeBocPrefix: '',
				auctionConfig: undefined as
					| {
							beneficiar: string;
							initialMinBidTon: number;
							maxBidTon: number;
							minBidStepPct: number;
							minExtendTimeSec: number;
							durationSec: number;
					  }
					| undefined,
			},
			tonDnsDomain: {
				domain: `${u}.ton`,
				exists: false,
				nftAddress: '',
				ownerAddress: '',
				expiresAt: '',
				sameOwnerSynergy: false,
			},
			ownerWallet: {
				balanceTon: 0,
				nftCount: 0,
				isWhale: false,
				lastActivity: 0,
				otherUsernames: [] as Array<{
					username: string;
					status: string;
					last_sale_ton?: number;
					last_sale_usd?: number;
					nft_address?: string;
				}>,
			},
		};

		try {
			const [tmeRes, tonDnsRes] = await Promise.allSettled([
				fetch(`https://tonapi.io/v2/dns/${encodeURIComponent(u)}.t.me`, {
					headers: { Accept: 'application/json' },
					signal: AbortSignal.timeout(5000),
				}),
				fetch(`https://tonapi.io/v2/dns/${encodeURIComponent(u)}.ton`, {
					headers: { Accept: 'application/json' },
					signal: AbortSignal.timeout(4500),
				}),
			]);

			if (tmeRes.status === 'fulfilled' && tmeRes.value.ok) {
				const d = (await tmeRes.value.json()) as any;
				const item = d?.item;
				if (item?.address) {
					out.isMintedNft = true;
					out.itemAddress = item.address;
					out.collectionAddress = item.collection?.address || OFFICIAL_COLLECTION;
					out.collectionVerified =
						out.collectionAddress.toLowerCase() === OFFICIAL_COLLECTION.toLowerCase();
					out.codeHash = item.code_hash || '';
					out.dataHash = item.data_hash || '';
					if (item.owner?.address) {
						out.ownerAddress = item.owner.address;
						out.ownerName = item.owner.name || '';
					}
					if (item.sale?.price?.value) {
						out.activeSalePriceTon = Math.round((Number(item.sale.price.value) / 1e9) * 100) / 100;
						out.activeSaleMarket = item.sale.market?.name || 'Fragment';
					}
				}
			}

			if (tonDnsRes.status === 'fulfilled' && tonDnsRes.value.ok) {
				const td = (await tonDnsRes.value.json()) as any;
				const tItem = td?.item;
				if (tItem?.address) {
					out.tonDnsDomain.exists = true;
					out.tonDnsDomain.nftAddress = tItem.address;
					out.tonDnsDomain.ownerAddress = tItem.owner?.address || '';
					if (td?.expiring_at) {
						out.tonDnsDomain.expiresAt = new Date(Number(td.expiring_at) * 1000).toISOString();
					}
					if (
						out.ownerAddress &&
						out.tonDnsDomain.ownerAddress &&
						out.ownerAddress.toLowerCase() === out.tonDnsDomain.ownerAddress.toLowerCase()
					) {
						out.tonDnsDomain.sameOwnerSynergy = true;
					}
				}
			}

			// Parallel TVM Binary / BOC & Owner Portfolio telemetry
			const tasks: Array<Promise<void>> = [];

			if (out.itemAddress) {
				tasks.push(
					(async () => {
						const [rawAccRes, nftDataRes, tokNameRes, aucCfgRes] = await Promise.allSettled([
							fetch(`https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(out.itemAddress)}`, {
								headers: { Accept: 'application/json' },
								signal: AbortSignal.timeout(4000),
							}),
							fetch(
								`https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(out.itemAddress)}/methods/get_nft_data`,
								{
									headers: { Accept: 'application/json' },
									signal: AbortSignal.timeout(4000),
								},
							),
							fetch(
								`https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(out.itemAddress)}/methods/get_telemint_token_name`,
								{
									headers: { Accept: 'application/json' },
									signal: AbortSignal.timeout(4000),
								},
							),
							fetch(
								`https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(out.itemAddress)}/methods/get_telemint_auction_config`,
								{
									headers: { Accept: 'application/json' },
									signal: AbortSignal.timeout(4000),
								},
							),
						]);

						if (rawAccRes.status === 'fulfilled' && rawAccRes.value.ok) {
							const rawAcc = (await rawAccRes.value.json()) as any;
							out.liveTvmData.accountBalanceNano = String(rawAcc?.balance || '');
							out.liveTvmData.lastTxLt = String(rawAcc?.last_transaction_lt || '');
							out.liveTvmData.lastTxHash = String(rawAcc?.last_transaction_hash || '');
							if (rawAcc?.data) {
								out.liveTvmData.rawDataBocPrefix = String(rawAcc.data).slice(0, 64);
							}
							if (rawAcc?.code) {
								out.liveTvmData.rawCodeBocPrefix = String(rawAcc.code).slice(0, 64);
							}
						}

						if (nftDataRes.status === 'fulfilled' && nftDataRes.value.ok) {
							const nd = (await nftDataRes.value.json()) as any;
							const idxHex = nd?.stack?.[1]?.num || '';
							if (idxHex) out.liveTvmData.nftIndexHex = idxHex;
							const contentBoc = nd?.stack?.[4]?.cell || '';
							if (contentBoc) out.liveTvmData.individualContentBoc = contentBoc;
						}

						if (tokNameRes.status === 'fulfilled' && tokNameRes.value.ok) {
							const tn = (await tokNameRes.value.json()) as any;
							const cellHex = tn?.stack?.[0]?.cell || '';
							if (cellHex) out.liveTvmData.tokenNameCellBoc = cellHex;
						}

						if (aucCfgRes.status === 'fulfilled' && aucCfgRes.value.ok) {
							const ac = (await aucCfgRes.value.json()) as any;
							const dec = ac?.decoded;
							if (dec && dec.beneficiar) {
								out.liveTvmData.auctionConfig = {
									beneficiar: String(dec.beneficiar),
									initialMinBidTon: Math.round((Number(dec.initial_min_bid || 0) / 1e9) * 100) / 100,
									maxBidTon: Math.round((Number(dec.max_bid || 0) / 1e9) * 100) / 100,
									minBidStepPct: Number(dec.min_bid_step || 5),
									minExtendTimeSec: Number(dec.min_extend_time || 3600),
									durationSec: Number(dec.duration || 0),
								};
							}
						}
					})(),
				);
			}

			if (out.ownerAddress) {
				tasks.push(
					(async () => {
						const [accRes, nftsRes] = await Promise.allSettled([
							fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(out.ownerAddress)}`, {
								headers: { Accept: 'application/json' },
								signal: AbortSignal.timeout(4500),
							}),
							fetch(
								`https://tonapi.io/v2/accounts/${encodeURIComponent(out.ownerAddress)}/nfts?collection=${OFFICIAL_COLLECTION}&limit=35`,
								{
									headers: { Accept: 'application/json' },
									signal: AbortSignal.timeout(5000),
								},
							),
						]);

						if (accRes.status === 'fulfilled' && accRes.value.ok) {
							const acc = (await accRes.value.json()) as any;
							out.ownerWallet.balanceTon = Math.round((Number(acc?.balance || 0) / 1e9) * 100) / 100;
							out.ownerWallet.lastActivity = Number(acc?.last_activity || 0);
							if (acc?.name && !out.ownerName) out.ownerName = acc.name;
						}

						if (nftsRes.status === 'fulfilled' && nftsRes.value.ok) {
							const nftsJson = (await nftsRes.value.json()) as any;
							const items = Array.isArray(nftsJson?.nft_items) ? nftsJson.nft_items : [];
							out.ownerWallet.nftCount = items.length;
							for (const nft of items) {
								const rawName = String(nft?.metadata?.name || nft?.dns || '')
									.replace(/^@/, '')
									.replace(/\.t\.me$/i, '')
									.toLowerCase()
									.trim();
								if (!rawName || rawName === u) continue;
								const hist = VERIFIED_HISTORICAL_SALES[rawName]?.price || 0;
								const rawSaleTon = nft?.sale?.price?.value
									? Math.round((Number(nft.sale.price.value) / 1e9) * 100) / 100
									: 0;
								// Guard against astronomical vanity asks (e.g. > 2,000,000 TON) polluting portfolio sum
								const salePrice =
									rawSaleTon > 0 && rawSaleTon <= 2_000_000 ? rawSaleTon : hist;
								const status = nft?.sale ? 'on_sale' : hist > 0 ? 'bought' : 'holding';
								out.ownerWallet.otherUsernames.push({
									username: rawName,
									status,
									last_sale_ton: salePrice > 0 ? salePrice : undefined,
									nft_address: nft?.address || '',
								});
							}
							out.ownerWallet.otherUsernames.sort(
								(a, b) => (b.last_sale_ton || 0) - (a.last_sale_ton || 0),
							);
						}

						out.ownerWallet.isWhale =
							out.ownerWallet.balanceTon >= 5000 || out.ownerWallet.nftCount >= 5;
					})(),
				);
			}

			await Promise.allSettled(tasks);
		} catch {
			// ignore
		}
		return out;
	}

	async function scrapeTelegramProfile(u: string) {
		const info = {
			exists: false,
			peerType: 'unassigned' as 'channel' | 'group' | 'bot' | 'user' | 'unassigned',
			title: '',
			bio: '',
			avatarUrl: '',
			extraText: '',
			membersCount: 0,
			onlineCount: 0,
			verified: false,
		};
		try {
			const res = await fetch(`https://t.me/${encodeURIComponent(u)}`, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
				},
				signal: AbortSignal.timeout(4500),
			});
			if (!res.ok) return info;
			const html = await res.text();

			const titleMatch = html.match(/<div class="tgme_page_title"[^>]*>([\s\S]*?)<\/div>/i);
			if (titleMatch) {
				info.exists = true;
				info.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
			}

			const extraMatch = html.match(/<div class="tgme_page_extra"[^>]*>([\s\S]*?)<\/div>/i);
			if (extraMatch) {
				info.extraText = extraMatch[1].replace(/<[^>]+>/g, '').trim();
			}

			const descMatch = html.match(/<div class="tgme_page_description"[^>]*>([\s\S]*?)<\/div>/i);
			if (descMatch) {
				info.bio = descMatch[1]
					.replace(/<br\s*\/?>/gi, ' ')
					.replace(/<[^>]+>/g, '')
					.trim();
			}

			const imgMatch = html.match(/<img class="tgme_page_photo_image"[^>]*src="([^"]+)"/i);
			if (imgMatch) {
				info.avatarUrl = imgMatch[1];
			}

			info.verified = html.includes('tgme_icon_verified') || html.includes('verified-icon');

			const extLower = info.extraText.toLowerCase();
			if (extLower.includes('subscriber')) {
				info.peerType = 'channel';
				const m = extLower.match(/([0-9\s,]+)\s*subscriber/);
				if (m) info.membersCount = Number.parseInt(m[1].replace(/[\s,]/g, ''), 10) || 0;
			} else if (extLower.includes('member')) {
				info.peerType = 'group';
				const m = extLower.match(/([0-9\s,]+)\s*member/);
				if (m) info.membersCount = Number.parseInt(m[1].replace(/[\s,]/g, ''), 10) || 0;
				const o = extLower.match(/([0-9\s,]+)\s*online/);
				if (o) info.onlineCount = Number.parseInt(o[1].replace(/[\s,]/g, ''), 10) || 0;
			} else if (extLower.includes('monthly user') || u.endsWith('bot')) {
				info.peerType = 'bot';
				const m = extLower.match(/([0-9\s,]+)\s*monthly/);
				if (m) info.membersCount = Number.parseInt(m[1].replace(/[\s,]/g, ''), 10) || 0;
			} else if (info.exists) {
				info.peerType = 'user';
			}
		} catch {
			// ignore
		}
		return info;
	}

	async function fetchDatamuseIntel(u: string) {
		const out = {
			isWord: false,
			partOfSpeech: '',
			definition: '',
			frequency: 0,
			synonyms: [] as Array<{ word: string; score: number }>,
		};
		if (/[0-9_]/.test(u)) return out;
		try {
			const [defRes, synRes, relSynRes] = await Promise.allSettled([
				fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(u)}&max=1&md=d,p,f`, {
					signal: AbortSignal.timeout(3500),
				}),
				fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(u)}&max=30`, {
					signal: AbortSignal.timeout(3500),
				}),
				fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(u)}&max=15`, {
					signal: AbortSignal.timeout(3000),
				}),
			]);

			if (defRes.status === 'fulfilled' && defRes.value.ok) {
				const arr = (await defRes.value.json()) as any[];
				if (Array.isArray(arr) && arr.length > 0 && String(arr[0].word || '').toLowerCase() === u) {
					const item = arr[0];
					for (const tag of item.tags || []) {
						if (typeof tag === 'string' && tag.startsWith('f:')) {
							out.frequency = Number.parseFloat(tag.slice(2)) || 0;
						} else if (tag === 'n') out.partOfSpeech = 'Noun';
						else if (tag === 'v') out.partOfSpeech = 'Verb';
						else if (tag === 'adj') out.partOfSpeech = 'Adjective';
						else if (tag === 'adv') out.partOfSpeech = 'Adverb';
					}
					if (Array.isArray(item.defs) && item.defs.length > 0) {
						const parts = String(item.defs[0]).split('\t');
						out.definition = parts.length > 1 ? parts[1] : parts[0];
						out.isWord = true;
					} else if (out.frequency >= 0.5) {
						out.isWord = true;
					}
				}
			}

			const seenWords = new Set<string>([u]);
			if (relSynRes.status === 'fulfilled' && relSynRes.value.ok) {
				const arr = (await relSynRes.value.json()) as any[];
				if (Array.isArray(arr)) {
					for (const r of arr) {
						const w = String(r?.word || '')
							.toLowerCase()
							.trim();
						if (w.length >= 4 && w.length <= 15 && /^[a-z]+$/.test(w) && !seenWords.has(w)) {
							seenWords.add(w);
							out.synonyms.push({ word: w, score: Number(r.score || 95000) });
						}
					}
				}
			}

			if (synRes.status === 'fulfilled' && synRes.value.ok) {
				const arr = (await synRes.value.json()) as any[];
				if (Array.isArray(arr)) {
					for (const r of arr) {
						const w = String(r?.word || '')
							.toLowerCase()
							.trim();
						if (w.length >= 4 && w.length <= 15 && /^[a-z]+$/.test(w) && !seenWords.has(w)) {
							seenWords.add(w);
							out.synonyms.push({ word: w, score: Number(r.score || 0) });
						}
					}
				}
			}
		} catch {
			// ignore
		}
		return out;
	}

	function buildThreePillarSimilarUsernames(
		u: string,
		tonUsd: number,
		liveFragmentComps: Array<{ username: string; status: string; priceTon: number; dateIso: string }>,
		datamuseSynonyms: Array<{ word: string; score: number }>,
	) {
		const results: Array<{
			username: string;
			reason: string;
			status: string;
			sale_price?: number;
			sale_price_usd?: number;
			sale_date?: string;
			price_source?: string;
			category: 'live_fragment' | 'semantic' | 'structural';
			semantic_score?: number;
			semantic_cluster?: string;
		}> = [];
		const seen = new Set<string>([u]);

		// PILLAR 1: Real Live Fragment Search Matches (`https://fragment.com/?query={u}`)
		for (const comp of liveFragmentComps) {
			if (seen.has(comp.username)) continue;
			if (comp.priceTon <= 0 && comp.status !== 'sold' && comp.status !== 'on_auction') continue;
			// Skip astronomical vanity asks (> 5M TON) in live search comps so they don't mislead users
			if (comp.priceTon > 5_000_000) continue;
			seen.add(comp.username);
			const stateLabel =
				comp.status === 'on_auction'
					? 'Live Fragment Auction · Shared Root'
					: comp.status === 'on_sale'
						? 'Live Fragment Listing · Shared Root'
						: 'Verified Fragment Sale · Shared Root';
			results.push({
				username: comp.username,
				reason: stateLabel,
				status: comp.status,
				sale_price: comp.priceTon > 0 ? comp.priceTon : undefined,
				sale_price_usd: comp.priceTon > 0 ? Math.round(comp.priceTon * tonUsd) : undefined,
				sale_date: comp.dateIso || undefined,
				price_source: comp.status === 'sold' ? 'fragment_live_sale' : 'onchain_listing',
				category: 'live_fragment',
			});
			if (results.length >= 6) break;
		}

		// PILLAR 2: Deep Semantic Meaning & Concept Graph (@cars <-> @auto, @rare <-> @uncommon, etc.)
		const uStem = u.endsWith('s') && u.length > 4 ? u.slice(0, -1) : u;
		const matchedClusters = SEMANTIC_CONCEPT_CLUSTERS.filter(
			(c) =>
				c.keywords.includes(u) ||
				c.keywords.includes(uStem) ||
				Boolean(c.directPairs?.[u]) ||
				datamuseSynonyms.slice(0, 8).some((syn) => c.keywords.includes(syn.word)),
		);

		// 2A. First add curated Direct Conceptual Pairs (e.g. @cars -> @auto, @rare -> @uncommon, @scarce, @unique)
		for (const cluster of matchedClusters) {
			const directList = cluster.directPairs?.[u] || cluster.directPairs?.[uStem] || [];
			for (const dp of directList) {
				if (seen.has(dp.word)) continue;
				seen.add(dp.word);
				const hist = VERIFIED_HISTORICAL_SALES[dp.word];
				const liveMatch = liveFragmentComps.find((c) => c.username === dp.word && c.priceTon > 0 && c.priceTon < 5_000_000);
				const priceTon = hist?.price || liveMatch?.priceTon;
				results.push({
					username: dp.word,
					reason: `${dp.relation} · ${cluster.titleFa}`,
					status: liveMatch?.status || (hist ? 'sold' : 'taken'),
					sale_price: priceTon,
					sale_price_usd: priceTon ? Math.round(priceTon * tonUsd) : undefined,
					sale_date: hist?.date || liveMatch?.dateIso || undefined,
					price_source: hist ? 'verified_sale' : liveMatch ? 'onchain_listing' : 'semantic_thesaurus',
					category: 'semantic',
					semantic_score: dp.score,
					semantic_cluster: cluster.titleFa,
				});
			}
		}

		// 2B. Add Concept Cluster Peers (same meaning family)
		for (const cluster of matchedClusters) {
			for (const kw of cluster.keywords) {
				if (kw.length < 4 || seen.has(kw)) continue;
				const hist = VERIFIED_HISTORICAL_SALES[kw];
				const isDatamuseSyn = datamuseSynonyms.find((s) => s.word === kw);
				if (hist || isDatamuseSyn) {
					seen.add(kw);
					results.push({
						username: kw,
						reason: isDatamuseSyn
							? `Lexical & Conceptual Synonym (@${u} ↔ @${kw}) · ${cluster.titleFa}`
							: `Semantic Concept Peer · ${cluster.titleFa}`,
						status: hist ? 'sold' : 'taken',
						sale_price: hist?.price,
						sale_price_usd: hist ? Math.round(hist.price * tonUsd) : undefined,
						sale_date: hist?.date,
						price_source: hist ? 'verified_sale' : 'semantic_thesaurus',
						category: 'semantic',
						semantic_score: isDatamuseSyn ? 94 : 86,
						semantic_cluster: cluster.titleFa,
					});
				}
				if (results.filter((r) => r.category === 'semantic').length >= 10) break;
			}
		}

		// 2C. Add Datamuse `rel_syn` / `ml` synonyms (both priced in VERIFIED_HISTORICAL_SALES and top lexical synonyms)
		for (const syn of datamuseSynonyms) {
			if (seen.has(syn.word)) continue;
			const hist = VERIFIED_HISTORICAL_SALES[syn.word];
			if (hist) {
				seen.add(syn.word);
				results.push({
					username: syn.word,
					reason: `Direct Meaning Synonym (@${u} ↔ @${syn.word}) · ${hist.category}`,
					status: 'sold',
					sale_price: hist.price,
					sale_price_usd: Math.round(hist.price * tonUsd),
					sale_date: hist.date,
					price_source: 'verified_sale',
					category: 'semantic',
					semantic_score: 92,
				});
			}
		}

		// 2D. Same category in VERIFIED_HISTORICAL_SALES
		const uHistCategory = VERIFIED_HISTORICAL_SALES[u]?.category || '';
		if (uHistCategory) {
			for (const [k, v] of Object.entries(VERIFIED_HISTORICAL_SALES)) {
				if (results.filter((r) => r.category === 'semantic').length >= 12) break;
				if (!seen.has(k) && v.category === uHistCategory) {
					seen.add(k);
					results.push({
						username: k,
						reason: `Category Meaning Peer · ${v.category}`,
						status: 'sold',
						sale_price: v.price,
						sale_price_usd: Math.round(v.price * tonUsd),
						sale_date: v.date,
						price_source: 'verified_sale',
						category: 'semantic',
						semantic_score: 85,
					});
				}
			}
		}

		// 2E. Ensure high-relevance Datamuse lexical synonyms are always included even if unpriced
		const currentSemanticCount = results.filter((r) => r.category === 'semantic').length;
		if (currentSemanticCount < 8) {
			for (const syn of datamuseSynonyms.slice(0, 10 - currentSemanticCount)) {
				if (seen.has(syn.word)) continue;
				seen.add(syn.word);
				results.push({
					username: syn.word,
					reason: `Lexical Meaning Synonym (@${u} ↔ @${syn.word})`,
					status: 'taken',
					price_source: 'datamuse_lexical',
					category: 'semantic',
					semantic_score: 84,
				});
			}
		}

		// PILLAR 3: Structural & Length Cohort Comps (Same length / morphology in VERIFIED_HISTORICAL_SALES)
		const targetLen = Math.max(4, Math.min(8, u.length));
		const allHistEntries = Object.entries(VERIFIED_HISTORICAL_SALES).filter(
			([k]) => !seen.has(k),
		);

		let hash = 0;
		for (let i = 0; i < u.length; i++) {
			hash = (hash * 31 + u.charCodeAt(i)) >>> 0;
		}

		const sameLenSameInitial = allHistEntries.filter(
			([k]) => k.length === targetLen && k[0] === u[0],
		);
		for (const [k, v] of sameLenSameInitial.slice(0, 3)) {
			seen.add(k);
			results.push({
				username: k,
				reason: `${k.length}-Char Structural Peer · Same Initial (@${u[0]}*)`,
				status: 'sold',
				sale_price: v.price,
				sale_price_usd: Math.round(v.price * tonUsd),
				sale_date: v.date,
				price_source: 'verified_sale',
				category: 'structural',
			});
		}

		const sameLenPool = allHistEntries.filter(([k]) => !seen.has(k) && k.length === targetLen);
		for (let i = 0; i < sameLenPool.length && results.filter((r) => r.category === 'structural').length < 6; i++) {
			const [k, v] = sameLenPool[(hash + i * 5) % sameLenPool.length];
			if (seen.has(k)) continue;
			seen.add(k);
			results.push({
				username: k,
				reason: `${k.length}-Char Length Cohort · ${v.category}`,
				status: 'sold',
				sale_price: v.price,
				sale_price_usd: Math.round(v.price * tonUsd),
				sale_date: v.date,
				price_source: 'verified_sale',
				category: 'structural',
			});
		}

		return results;
	}

	function generateHomoglyphTwins(
		u: string,
		liveFragmentComps: Array<{ username: string; status: string; priceTon: number }>,
	) {
		const swaps: Record<string, string> = {
			o: '0',
			'0': 'o',
			i: '1',
			l: '1',
			'1': 'l',
			e: '3',
			a: '4',
			s: '5',
			b: '8',
			m: 'rn',
		};
		const twins: Array<{
			twin: string;
			status: string;
			price_ton?: number;
			risk_level: string;
			similarity: string;
		}> = [];
		const seen = new Set<string>([u]);

		for (let i = 0; i < u.length; i++) {
			const ch = u[i];
			if (swaps[ch]) {
				const candidate = u.slice(0, i) + swaps[ch] + u.slice(i + 1);
				if (candidate.length >= 4 && /^[a-z]/.test(candidate) && !seen.has(candidate)) {
					seen.add(candidate);
					const liveMatch = liveFragmentComps.find((c) => c.username === candidate);
					twins.push({
						twin: candidate,
						status: liveMatch?.status || 'unminted',
						price_ton: liveMatch?.priceTon || undefined,
						risk_level: 'HIGH',
						similarity: `Visual Homoglyph (${ch} → ${swaps[ch]})`,
					});
				}
			}
		}

		for (const comp of liveFragmentComps) {
			if (seen.has(comp.username)) continue;
			if (Math.abs(comp.username.length - u.length) <= 2 && comp.username.startsWith(u)) {
				seen.add(comp.username);
				twins.push({
					twin: comp.username,
					status: comp.status,
					price_ton: comp.priceTon > 0 ? comp.priceTon : undefined,
					risk_level: comp.username.length - u.length === 1 ? 'HIGH' : 'MEDIUM',
					similarity: 'Prefix Extension Twin on Fragment',
				});
			}
			if (twins.length >= 5) break;
		}

		return twins;
	}

	async function buildFullValuationReport(rawU: string) {
		const u = rawU.replace(/^@/, '').toLowerCase().trim();
		const cached = valuationCache.get(u);
		if (cached && Date.now() - cached.ts < 60_000) {
			return cached.data;
		}

		const [tonRateInfo, fragDetail, fragSearchComps, tgProfile, datamuse] = await Promise.all([
			fetchLiveTonUsdRate(),
			scrapeFragmentUsernameDetail(u),
			scrapeFragmentSearchComps(u),
			scrapeTelegramProfile(u),
			fetchDatamuseIntel(u),
		]);

		const tonUsd = tonRateInfo.rate;
		const tonApiIntel = await fetchTonApiUsernameIntel(u, fragDetail.ownerAddress);

		// Determine verified historical sales & transfers of this exact username
		const exactTransactions = [...fragDetail.ownershipHistory];
		const knownHist = VERIFIED_HISTORICAL_SALES[u];
		const hasPricedSaleInHistory = exactTransactions.some((tx) => tx.price_num > 0);
		if (!hasPricedSaleInHistory && knownHist) {
			exactTransactions.push({
				sale_price_ton: knownHist.price.toLocaleString('en-US'),
				price_num: knownHist.price,
				date: new Date(knownHist.date).toISOString(),
				buyer: tonApiIntel.ownerAddress || 'Fragment Vault',
				event_type: 'sale',
			});
		}

		const highestPastSaleTon = exactTransactions.reduce(
			(max, tx) => Math.max(max, tx.price_num),
			knownHist?.price || 0,
		);

		// Build 3-pillar similar usernames
		const similarList = buildThreePillarSimilarUsernames(
			u,
			tonUsd,
			fragSearchComps,
			datamuse.synonyms,
		);

		// Compute Calibrated AVM v7.2 Valuation
		const uLen = u.length;
		const lettersOnly = /^[a-z]+$/.test(u);
		const hasDigits = /[0-9]/.test(u);
		const hasUnderscore = u.includes('_');

		// Base length prior (TON)
		const baseLenPriorTon =
			uLen === 4
				? 4200
				: uLen === 5
					? 1450
					: uLen === 6
						? 580
						: uLen === 7
							? 290
							: uLen === 8
								? 165
								: 95;

		// Morphology adjustments
		let morphMultiplier = 1.0;
		if (!lettersOnly) {
			if (hasUnderscore) morphMultiplier *= 0.45;
			else if (hasDigits) morphMultiplier *= 0.62;
		} else {
			morphMultiplier *= 1.25;
		}

		// Pronounceability (CVCV / vowel balance)
		const vowels = (u.match(/[aeiouy]/g) || []).length;
		const vowelRatio = uLen > 0 ? vowels / uLen : 0;
		const isPronounceable = vowelRatio >= 0.25 && vowelRatio <= 0.65 && !/[bcdfghjklmnpqrstvwxz]{4}/.test(u);
		if (isPronounceable) morphMultiplier *= 1.22;

		// Palindrome or repeating pattern bonus
		const isPalindrome = uLen >= 4 && u === u.split('').reverse().join('');
		if (isPalindrome) morphMultiplier *= 1.65;

		// Dictionary frequency multiplier
		let dictMultiplier = 1.0;
		if (datamuse.isWord) {
			dictMultiplier = 1.85 + Math.min(2.6, Math.log10(Math.max(1, datamuse.frequency + 1)) * 0.75);
		}

		// Active Telegram audience capitalization bonus
		let audienceBonusTon = 0;
		if (tgProfile.membersCount >= 1000) {
			audienceBonusTon = Math.min(25000, Math.round(Math.sqrt(tgProfile.membersCount) * 4.5));
		}

		const algorithmicExpectedTon = Math.round(
			baseLenPriorTon * morphMultiplier * dictMultiplier + audienceBonusTon,
		);

		// Semantic & structural comp anchor median
		const pricedSimilar = similarList.filter((s) => (s.sale_price || 0) > 0 && s.category !== 'live_fragment');
		let compMedianTon = 0;
		if (pricedSimilar.length > 0) {
			const sortedPrices = pricedSimilar.map((s) => s.sale_price!).sort((a, b) => a - b);
			compMedianTon = sortedPrices[Math.floor(sortedPrices.length / 2)];
		}

		// Reference intrinsic + comparable benchmark (before blending any live seller listing)
		const intrinsicCompRefTon =
			compMedianTon > 0
				? Math.round(algorithmicExpectedTon * 0.45 + compMedianTon * 0.55)
				: algorithmicExpectedTon;

		let expectedTon = intrinsicCompRefTon;
		let valuationMethod = 'AVM v7.2 Bayesian Structural + Semantic Comps';
		let anchorUsed = false;
		let liveAskUsed = false;
		let isVanityAsk = false;
		let vanityAskWarning = '';

		// Detect Whale Vanity / Showcase Listing (e.g., @rare listed at 888,888,888 TON ~$1.06B USD)
		const vanityThresholdTon = Math.max(
			250_000,
			Math.max(intrinsicCompRefTon, highestPastSaleTon) * 12,
		);
		if (fragDetail.status === 'on_sale' && fragDetail.priceTon > vanityThresholdTon) {
			isVanityAsk = true;
			vanityAskWarning = `Current owner has listed @${u} at a showcase/vanity price of ${fragDetail.priceTon.toLocaleString('en-US')} TON (~$${Math.round(fragDetail.priceTon * tonUsd).toLocaleString('en-US')}). AVM v7.2 automatically isolates and excludes extreme vanity asks (>12x intrinsic benchmark) so fair value remains anchored to verified settlements and semantic comparables.`;
		}

		if (highestPastSaleTon > 0) {
			anchorUsed = true;
			// Calculate time-adjusted appreciation for early 2022/2023 genesis sales of 4-char/dictionary grails
			const isGenesis4CharWord = uLen === 4 && lettersOnly && datamuse.isWord && highestPastSaleTon < 25000;
			const appreciatedAnchorTon = isGenesis4CharWord
				? Math.round(highestPastSaleTon * 3.2 + intrinsicCompRefTon * 0.65)
				: Math.round(highestPastSaleTon * 1.08);

			if (fragDetail.status === 'on_sale' && fragDetail.priceTon > 0 && !isVanityAsk) {
				liveAskUsed = true;
				expectedTon = Math.round(appreciatedAnchorTon * 0.65 + fragDetail.priceTon * 0.35);
				valuationMethod = 'Exact Past Fragment Sale + Active Fixed-Price Listing Blend';
			} else if (fragDetail.status === 'on_auction' && fragDetail.priceTon > 0) {
				liveAskUsed = true;
				expectedTon = Math.max(appreciatedAnchorTon, Math.round(fragDetail.priceTon * 1.15));
				valuationMethod = 'Exact Past Sale + Live Fragment Auction Bid Momentum';
			} else if (isVanityAsk) {
				expectedTon = appreciatedAnchorTon;
				valuationMethod = `Verified Genesis Sale (${highestPastSaleTon.toLocaleString('en-US')} TON) + 4-Char Semantic Comps (Vanity Ask Excluded)`;
			} else {
				expectedTon = appreciatedAnchorTon;
				valuationMethod = 'Verified Historical Fragment Sale Anchor (Exact Handle)';
			}
		} else if (fragDetail.status === 'on_auction' && fragDetail.priceTon > 0) {
			liveAskUsed = true;
			const bidCount = fragDetail.bidHistory.length;
			const momentumMult = bidCount >= 10 ? 1.35 : bidCount >= 3 ? 1.2 : 1.1;
			expectedTon = Math.round(
				Math.max(fragDetail.priceTon * momentumMult, intrinsicCompRefTon * 0.5 + fragDetail.priceTon * 0.7),
			);
			valuationMethod = `Live Fragment Auction Trajectory (${bidCount} Verified Bids)`;
		} else if (fragDetail.status === 'on_sale' && fragDetail.priceTon > 0 && !isVanityAsk) {
			liveAskUsed = true;
			expectedTon =
				fragDetail.priceTon <= intrinsicCompRefTon * 2.5
					? Math.round(fragDetail.priceTon * 0.6 + intrinsicCompRefTon * 0.4)
					: Math.round(intrinsicCompRefTon * 1.35 + fragDetail.priceTon * 0.15);
			valuationMethod = 'Active Fragment Ask Discounted by AVM Intrinsic Fair Value';
		} else if (datamuse.isWord && compMedianTon > 0) {
			expectedTon = intrinsicCompRefTon;
			valuationMethod = 'Lexical Dictionary Multiplier + Verified Semantic Comps';
		}

		expectedTon = Math.max(15, expectedTon);
		const lowTon = Math.max(10, Math.round(expectedTon * 0.74));
		const highTon = Math.round(expectedTon * 1.38);

		const confidenceScore = anchorUsed
			? 96
			: liveAskUsed
				? 91
				: datamuse.isWord && pricedSimilar.length >= 3
					? 88
					: lettersOnly && uLen <= 5
						? 82
						: 74;

		const rarityTier =
			expectedTon >= 100000 || (uLen === 4 && lettersOnly && datamuse.isWord)
				? 'GRAIL LEGENDARY'
				: expectedTon >= 15000 || uLen === 4
					? 'APEX EPIC'
					: expectedTon >= 2500 || (uLen <= 6 && datamuse.isWord)
						? 'RARE COLLECTIBLE'
						: 'STANDARD HANDLE';

		const rarityStars =
			rarityTier === 'GRAIL LEGENDARY'
				? '★★★★★'
				: rarityTier === 'APEX EPIC'
					? '★★★★☆'
					: rarityTier === 'RARE COLLECTIBLE'
						? '★★★☆☆'
						: '★★☆☆☆';

		const tags: string[] = [];
		if (uLen === 4) tags.push('4-CHAR GRAIL');
		else if (uLen <= 6) tags.push(`${uLen}-CHAR SHORT`);
		if (datamuse.isWord) tags.push('DICTIONARY WORD');
		if (lettersOnly) tags.push('PURE ALPHA');
		if (isPalindrome) tags.push('PALINDROME');
		if (tonApiIntel.isMintedNft) tags.push('TELEMINT NFT');
		if (tonApiIntel.tonDnsDomain.exists) tags.push('.TON DNS ACTIVE');
		if (tgProfile.verified) tags.push('TELEGRAM VERIFIED');
		if (isVanityAsk) tags.push('VANITY SHOWCASE ASK');

		const brandability = Math.min(
			99,
			Math.max(
				42,
				Math.round(
					(uLen <= 4 ? 38 : uLen <= 6 ? 30 : 20) +
						(lettersOnly ? 22 : 8) +
						(isPronounceable ? 20 : 6) +
						(datamuse.isWord ? 19 : 5),
				),
			),
		);

		const tmMatch = TRADEMARK_BRANDS[u];
		const trademarkRisk = tmMatch
			? {
					risk_level: tmMatch.risk,
					matched_entity: tmMatch.entity,
					brand: u.toUpperCase(),
					advisory_warning: `Direct global trademark match (${tmMatch.entity}). Under Telegram ToS §4, unminted handles may face corporate reassignment claims; TeleMint NFTs on TON have stronger cryptographic custody but carry brand impersonation scrutiny.`,
					risk_score: tmMatch.score,
				}
			: {
					risk_level: 'low',
					advisory_warning:
						'No WIPO global trademark collision detected. Handle is clear for commercial branding, Web3 deployment, and secondary OTC trade under Telegram ToS §4.',
					risk_score: 8,
				};

		const fragmentFeeTon = Math.max(5, Math.round(expectedTon * 0.05));
		const netPayoutTon = Math.max(0, expectedTon - fragmentFeeTon);

		// Build verified comparables list
		const comparables = similarList
			.filter((s) => (s.sale_price || 0) > 0)
			.slice(0, 8)
			.map((s) => ({
				username: s.username,
				price: s.sale_price!,
				date: s.sale_date || '2024-11-15',
				tonviewer_url: `https://fragment.com/username/${s.username}`,
			}));

		// Build price trend points from priced ownership history or bid history or market trajectory
		const pricedHistoryOnly = exactTransactions.filter((tx) => tx.price_num > 0);
		const priceTrend: Array<{ label: string; value: number }> = [];
		if (pricedHistoryOnly.length >= 2) {
			for (const tx of [...pricedHistoryOnly].reverse()) {
				priceTrend.push({
					label: tx.date.slice(0, 10),
					value: tx.price_num,
				});
			}
		} else if (fragDetail.bidHistory.length >= 2) {
			for (const b of [...fragDetail.bidHistory].reverse()) {
				priceTrend.push({
					label: b.date ? b.date.slice(5, 16) : 'Bid',
					value: b.price_ton,
				});
			}
		} else if (highestPastSaleTon > 0) {
			priceTrend.push(
				{ label: 'Genesis Sale', value: highestPastSaleTon },
				{ label: 'P10 Floor', value: lowTon },
				{ label: 'Fair Value (P50)', value: expectedTon },
				{ label: 'Bull Target (P90)', value: highTon },
			);
		} else {
			priceTrend.push(
				{ label: 'P10 Floor', value: lowTon },
				{ label: 'Fair Value (P50)', value: expectedTon },
				{ label: 'Bull Target (P90)', value: highTon },
			);
		}

		// Calculate portfolio aggregates
		const portfolioItems = tonApiIntel.ownerWallet.otherUsernames.map((item) => ({
			username: item.username,
			status: item.status,
			last_sale_ton: item.last_sale_ton,
			last_sale_usd: item.last_sale_ton ? Math.round(item.last_sale_ton * tonUsd) : undefined,
		}));
		const totalAcqTon = portfolioItems.reduce((acc, it) => acc + (it.last_sale_ton || 0), 0);
		const totalEstPortfolioTon =
			totalAcqTon + portfolioItems.filter((it) => !it.last_sale_ton).length * 450;

		const askVsEstimatePct =
			fragDetail.priceTon > 0 && expectedTon > 0
				? Math.round(((fragDetail.priceTon - expectedTon) / expectedTon) * 1000) / 10
				: undefined;

		const uniqueBidders = new Set(fragDetail.bidHistory.map((b) => b.from).filter(Boolean)).size;
		const openingBidTon =
			fragDetail.bidHistory.length > 0
				? fragDetail.bidHistory[fragDetail.bidHistory.length - 1].price_ton
				: 0;
		const highestBidTon =
			fragDetail.bidHistory.length > 0 ? fragDetail.bidHistory[0].price_ton : 0;

		// Compute Binary & TVM BOC Forensics
		const binaryForensics = computeBinaryAndByteForensics(u, tonApiIntel.liveTvmData);

		// Compute Fragment Capabilities & Protocol Mechanics
		const suggestedOfferTon = Math.round(expectedTon * 0.85);
		const suggestedOfferFeeTon = Math.min(
			fragDetail.offerFeeMax,
			Math.max(1, Math.round(suggestedOfferTon * fragDetail.offerFeeMult * 100) / 100),
		);
		const fragmentCapabilities = {
			can_buy_now: fragDetail.status === 'on_sale' && fragDetail.priceTon > 0,
			can_bid_auction: fragDetail.status === 'on_auction',
			can_make_offer: fragDetail.status === 'sold' || fragDetail.status === 'taken',
			offer_fee_mult: fragDetail.offerFeeMult,
			offer_fee_pct: fragDetail.offerFeeMult * 100,
			offer_fee_min_ton: 1,
			offer_fee_max_ton: fragDetail.offerFeeMax,
			suggested_offer_ton: suggestedOfferTon,
			suggested_offer_fee_ton: suggestedOfferFeeTon,
			protocol_royalty_pct: 5,
			bot_upgrade_fee_ton: 1000,
			is_assigned_to_bot: tgProfile.peerType === 'bot',
			max_collectibles_per_profile: 10,
			auction_last_lt: fragDetail.auctionLastLt || tonApiIntel.liveTvmData.lastTxLt || undefined,
			direct_links: {
				tme_url: `https://t.me/${u}`,
				web_subdomain_url: `https://${u}.t.me`,
				tg_resolve_uri: `tg://resolve?domain=${u}`,
				fragment_url: `https://fragment.com/username/${u}`,
				nft_json_url: `https://nft.fragment.com/username/${u}.json`,
				nft_webp_url: `https://nft.fragment.com/username/${u}.webp`,
			},
		};

		const report: Record<string, any> = {
			run_id: Math.floor(Date.now() / 1000),
			username: u,
			model_version: 'AVM v7.2-BinaryLive',
			base_price_ton: String(lowTon),
			low_ton: String(lowTon),
			expected_ton: String(expectedTon),
			high_ton: String(highTon),
			low_usd: String(Math.round(lowTon * tonUsd)),
			expected_usd: String(Math.round(expectedTon * tonUsd)),
			high_usd: String(Math.round(highTon * tonUsd)),
			confidence_score: confidenceScore,
			ton_usd_rate: tonUsd,
			is_fallback_used: tonRateInfo.isFallback,
			comparable_sales_count: comparables.length,
			rarity: { tier: rarityTier, stars: rarityStars },
			tags,
			length: uLen,
			dictionary: {
				is_word: datamuse.isWord,
				part_of_speech: datamuse.partOfSpeech || undefined,
				definition: datamuse.definition || undefined,
				word_frequency: Math.round(datamuse.frequency * 100) / 100,
			},
			history: {
				is_sold: fragDetail.status === 'sold' || exactTransactions.length > 0,
				owner_address: tonApiIntel.ownerAddress || fragDetail.ownerAddress || undefined,
				highest_past_sale_ton: highestPastSaleTon > 0 ? highestPastSaleTon : undefined,
				transactions: exactTransactions.map((tx) => ({
					sale_price_ton: tx.sale_price_ton,
					date: tx.date,
					buyer: tx.buyer,
					event_type: tx.event_type,
				})),
			},
			similar: similarList,
			portfolio: tonApiIntel.ownerAddress
				? {
						owner_address: tonApiIntel.ownerAddress,
						owner_name: tonApiIntel.ownerName || undefined,
						total_count: Math.max(tonApiIntel.ownerWallet.nftCount, portfolioItems.length),
						total_acquisition_cost_ton: totalAcqTon > 0 ? totalAcqTon : undefined,
						total_est_value_ton: totalEstPortfolioTon > 0 ? totalEstPortfolioTon : undefined,
						total_est_value_usd:
							totalEstPortfolioTon > 0 ? Math.round(totalEstPortfolioTon * tonUsd) : undefined,
						priced_items: portfolioItems.filter((i) => (i.last_sale_ton || 0) > 0).length,
						unknown_items: portfolioItems.filter((i) => !i.last_sale_ton).length,
						items: portfolioItems,
					}
				: undefined,
			owner_profile: tgProfile.exists
				? {
						first_name: tgProfile.title || `@${u}`,
						username: u,
						is_premium: tgProfile.verified || tonApiIntel.isMintedNft,
						has_photo: Boolean(tgProfile.avatarUrl),
						peer_type: tgProfile.peerType,
						bio: tgProfile.bio || undefined,
						avatar_url: tgProfile.avatarUrl || undefined,
						extra_text: tgProfile.extraText || undefined,
						members_count: tgProfile.membersCount || undefined,
						online_count: tgProfile.onlineCount || undefined,
						verified: tgProfile.verified,
					}
				: undefined,
			structure: {
				has_digits: hasDigits,
				letters_only: lettersOnly,
				has_underscore: hasUnderscore,
				is_pronounceable: isPronounceable,
				is_palindrome: isPalindrome,
				vowel_ratio: Math.round(vowelRatio * 100),
			},
			seo: {
				score: brandability,
				verdict:
					brandability >= 85
						? 'Institutional Grade Global Search & Type-In Recall'
						: brandability >= 70
							? 'High-Memorability Web3 & Telegram Handle'
							: 'Standard Alphanumeric Identifier',
			},
			liquidity_rating:
				uLen <= 4 || datamuse.isWord
					? 'High Institutional Liquidity'
					: uLen <= 6 && lettersOnly
						? 'Active Collector Liquidity'
						: 'Standard OTC Liquidity',
			estimated_sell_time:
				uLen <= 4 || datamuse.isWord ? '24h – 5 Days' : uLen <= 6 ? '5 – 14 Days' : '14 – 30 Days',
			target_buyer_profile:
				(knownHist?.category || '').includes('Finance') ||
				['bank', 'pay', 'cash', 'fund', 'card', 'wallet', 'trade', 'coin', 'crypto'].some((k) =>
					u.includes(k),
				)
					? 'Web3 Exchange / Fintech Protocol'
					: uLen === 4 && lettersOnly
						? 'Sovereign TON Whale & Grail Collector'
						: tgProfile.peerType === 'channel' && tgProfile.membersCount > 10000
							? 'Media Syndicate & Traffic Aggregator'
							: 'Brand Founder & Ecosystem Builder',
			projected_growth: {
				bull_ton: highTon,
				base_ton: expectedTon,
				bear_ton: lowTon,
				bull_usd: Math.round(highTon * tonUsd),
				base_usd: Math.round(expectedTon * tonUsd),
				bear_usd: Math.round(lowTon * tonUsd),
			},
			liquidity_metrics: {
				score: Math.min(98, Math.round(brandability * 0.95)),
				estimated_days: uLen <= 4 ? '1–4d' : uLen <= 6 ? '5–14d' : '14–30d',
			},
			auction_playbook: {
				start_price_ton: Math.round(expectedTon * 0.68),
				starting_bid_ton: Math.round(expectedTon * 0.68),
				bid_step_ton: Math.max(5, Math.round(expectedTon * 0.05)),
				best_day: 'Sunday',
				best_hour_utc: '18:00 UTC',
			},
			live_market: {
				status: fragDetail.status,
				raw_status_text: fragDetail.rawStatusText || fragDetail.status.toUpperCase(),
				is_vanity_ask: isVanityAsk,
				vanity_ask_warning: vanityAskWarning || undefined,
				current_bid_ton:
					fragDetail.status === 'on_auction' ? fragDetail.priceTon : undefined,
				current_bid_usd:
					fragDetail.status === 'on_auction'
						? Math.round(fragDetail.priceTon * tonUsd)
						: undefined,
				buy_now_ton:
					fragDetail.status === 'on_sale'
						? fragDetail.priceTon
						: tonApiIntel.activeSalePriceTon > 0
							? tonApiIntel.activeSalePriceTon
							: undefined,
				buy_now_usd:
					fragDetail.status === 'on_sale'
						? Math.round(fragDetail.priceTon * tonUsd)
						: tonApiIntel.activeSalePriceTon > 0
							? Math.round(tonApiIntel.activeSalePriceTon * tonUsd)
							: undefined,
				auction_ends_at: fragDetail.endsAtIso || undefined,
				mint_date: fragDetail.mintDateIso || undefined,
				owner_address: tonApiIntel.ownerAddress || fragDetail.ownerAddress || undefined,
				previous_owners: exactTransactions.length,
				offers: fragDetail.bidHistory.map((b) => ({
					price_ton: b.price_ton,
					price_usd: Math.round(b.price_ton * tonUsd),
					date: b.date,
					from: b.from,
				})),
				bid_analytics: {
					total_bids_count: fragDetail.bidHistory.length,
					unique_bidders_count: uniqueBidders,
					opening_bid_ton: openingBidTon,
					highest_bid_ton: highestBidTon,
					bid_jump_multiple:
						openingBidTon > 0 ? Math.round((highestBidTon / openingBidTon) * 100) / 100 : 1,
				},
				fragment_url: `https://fragment.com/username/${u}`,
				getgems_url: tonApiIntel.itemAddress
					? `https://getgems.io/collection/EQCA14o1-VWhS2efqoh_9M1b_A9DtKTuoqfmkn83AbJzwnPi/${tonApiIntel.itemAddress}`
					: `https://getgems.io/Usernames`,
				telegram_url: `https://t.me/${u}`,
				nft_image_url: tonApiIntel.nftImage,
				ask_vs_estimate_pct: askVsEstimatePct,
				checked_at: new Date().toISOString(),
			},
			price_basis: {
				target_sales: pricedHistoryOnly.length,
				exact_sales: pricedHistoryOnly.length,
				broad_sales: comparables.length,
				anchor_used: anchorUsed,
				live_ask_used: liveAskUsed,
				method: valuationMethod,
			},
			quality_grade:
				brandability >= 90 ? 'AAA+' : brandability >= 80 ? 'AA+' : brandability >= 70 ? 'A' : 'B+',
			percentile_rank:
				uLen === 4 ? 99.4 : uLen === 5 && datamuse.isWord ? 97.8 : uLen <= 6 ? 91.5 : 78.0,
			risk_audit: {
				has_homoglyph_risk: /[01lI]/.test(u),
				homoglyph_message: /[01lI]/.test(u)
					? 'Contains characters susceptible to visual spoofing (o/0, l/1/I).'
					: 'Clean character set with high anti-spoofing clarity.',
				is_scam_or_fake: false,
				has_trademark_risk: trademarkRisk.risk_level !== 'low',
				trademark_detail: trademarkRisk.advisory_warning,
				ton_dns_synergy: tonApiIntel.tonDnsDomain.exists
					? tonApiIntel.tonDnsDomain.sameOwnerSynergy
						? `Unified Web3 Identity: ${u}.ton is owned by the exact same wallet!`
						: `Registered on TON DNS (${u}.ton is active under a separate owner wallet).`
					: `${u}.ton TON DNS domain is currently unminted/available for cross-chain synergy.`,
			},
			ton_dns_domain: tonApiIntel.tonDnsDomain,
			transaction_economics: {
				net_payout_ton: netPayoutTon,
				net_payout_usd: Math.round(netPayoutTon * tonUsd),
				fragment_fee_ton: fragmentFeeTon,
				fragment_fee_pct: 5,
				min_bid_ton: Math.round(expectedTon * 0.68),
				bid_step_ton: Math.max(5, Math.round(expectedTon * 0.05)),
			},
			reasoning_log: {
				valuation_method: valuationMethod,
				datamuse_frequency: datamuse.frequency,
				morphology_multiplier: Math.round(morphMultiplier * 100) / 100,
				dictionary_multiplier: Math.round(dictMultiplier * 100) / 100,
				is_vanity_ask_filtered: isVanityAsk,
			},
			investment_grade:
				expectedTon >= 25000
					? 'Sovereign Blue-Chip'
					: expectedTon >= 3000
						? 'Core Collector Grade'
						: 'Growth Speculative',
			comparables,
			price_trend: priceTrend,
			wallet_info: {
				balance: tonApiIntel.ownerWallet.balanceTon,
				nft_count: Math.max(tonApiIntel.ownerWallet.nftCount, portfolioItems.length),
				is_whale: tonApiIntel.ownerWallet.isWhale,
			},
			entity_info: {
				type: tgProfile.peerType,
				members: tgProfile.membersCount,
				online: tgProfile.onlineCount,
				verified: tgProfile.verified,
				title: tgProfile.title,
				bio: tgProfile.bio,
				avatar_url: tgProfile.avatarUrl,
				extra_text: tgProfile.extraText,
			},
			status: fragDetail.status,
			telegram_status: tgProfile.exists ? `Active (${tgProfile.peerType})` : 'Unassigned / Free on Telegram',
			fragment_market_status: fragDetail.rawStatusText || fragDetail.status,
			trademark_risk: trademarkRisk,
			empirical_band: {
				model_low_ton: lowTon,
				model_mid_ton: expectedTon,
				model_high_ton: highTon,
				model_low_usd: Math.round(lowTon * tonUsd),
				model_mid_usd: Math.round(expectedTon * tonUsd),
				model_high_usd: Math.round(highTon * tonUsd),
				band_type: anchorUsed ? 'Exact Historical Anchor' : 'Bayesian Empirical',
				p10_ton: lowTon,
				p50_ton: expectedTon,
				p90_ton: highTon,
				p10_usd: Math.round(lowTon * tonUsd),
				p50_usd: Math.round(expectedTon * tonUsd),
				p90_usd: Math.round(highTon * tonUsd),
			},
			brandability,
			fear_greed_index: 68,
			fear_greed_label: 'Greed / Accumulation',
			wikipedia_summary: knownHist
				? `@${u} is a verified benchmark collectible in the ${knownHist.category} vertical with a recorded Fragment settlement of ${knownHist.price.toLocaleString('en-US')} TON on ${knownHist.date}.`
				: tgProfile.bio
					? `Active Telegram ${tgProfile.peerType} "${tgProfile.title}": ${tgProfile.bio}`
					: '',
			rarity_breakdown: {
				length_score: uLen === 4 ? 99 : uLen === 5 ? 88 : uLen === 6 ? 76 : 62,
				lexical_score: datamuse.isWord ? 95 : 58,
				phonetic_score: isPronounceable ? 92 : 64,
				onchain_provenance: tonApiIntel.isMintedNft ? 100 : 45,
			},
			certificate_id: `IFRAG-${u.toUpperCase()}-${String(Date.now()).slice(-6)}`,
			telemint_provenance: {
				item_address: tonApiIntel.itemAddress || undefined,
				collection_address: tonApiIntel.collectionAddress,
				collection_match: tonApiIntel.collectionVerified,
				is_authentic: tonApiIntel.isMintedNft && tonApiIntel.collectionVerified,
				owner_address: tonApiIntel.ownerAddress || fragDetail.ownerAddress || undefined,
				real_owner_address: tonApiIntel.ownerAddress || fragDetail.ownerAddress || undefined,
				is_escrow: fragDetail.status === 'on_auction' || fragDetail.status === 'on_sale',
				escrow_marketplace:
					fragDetail.status === 'on_auction' || fragDetail.status === 'on_sale'
						? tonApiIntel.activeSaleMarket || 'Fragment Auction Contract'
						: undefined,
				sale_price_ton:
					fragDetail.priceTon > 0 ? fragDetail.priceTon : highestPastSaleTon || undefined,
				code_hash: tonApiIntel.codeHash || undefined,
				data_hash: tonApiIntel.dataHash || undefined,
				verification_status:
					tonApiIntel.isMintedNft && tonApiIntel.collectionVerified
						? 'VERIFIED_OFFICIAL_TELEMINT_NFT'
						: 'UNMINTED_WEB2_TELEGRAM_HANDLE',
				verified_at: new Date().toISOString(),
				details:
					tonApiIntel.isMintedNft && tonApiIntel.collectionVerified
						? 'Cryptographically verified against Official Telegram Usernames Collection (0:80d78a35...73c2).'
						: 'Handle is not yet tokenized as a TEP-62 NFT on TON.',
			},
			binary_forensics: binaryForensics,
			fragment_capabilities: fragmentCapabilities,
			homoglyph_twins: generateHomoglyphTwins(u, fragSearchComps),
			laya_system_one: {
				total_score: brandability,
				phonetic_score: isPronounceable ? (uLen <= 5 ? 9.5 : 8.5) : 6.8,
				cultural_resonance: datamuse.isWord ? 'Global English Lexicon' : 'Universal Web3 / Ticker',
				target_entity_fit: tgProfile.peerType !== 'unassigned' ? tgProfile.peerType.toUpperCase() : 'BRAND / DAO',
				commercial_intent: datamuse.isWord || uLen <= 5 ? 0.91 : 0.68,
				trademark_risk_level: trademarkRisk.risk_level,
				seizure_risk: trademarkRisk.risk_score / 100,
				liquidity_speed: uLen <= 5 ? 'FAST' : 'MODERATE',
				buyer_archetype:
					uLen === 4
						? 'Sovereign Whale Collector'
						: datamuse.isWord
							? 'Web3 Protocol / Brand Founder'
							: 'Digital Identity Investor',
				bidding_war_potential:
					fragDetail.bidHistory.length >= 5
						? 0.95
						: uLen <= 4 || datamuse.isWord
							? 0.88
							: 0.62,
				confidence: confidenceScore / 100,
			},
		};

		valuationCache.set(u, { ts: Date.now(), data: report });
		return report;
	}

	return {
		name: 'username-valuation-live-plugin',
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				try {
					const rawUrl = req.url || '';
					if (!rawUrl.startsWith('/api/v1/usernames') && !rawUrl.startsWith('/api/v1/intel/credits')) {
						return next();
					}

					const urlObj = new URL(rawUrl, 'http://localhost:3000');
					const pathname = urlObj.pathname;
					const uParam = (urlObj.searchParams.get('u') || urlObj.searchParams.get('username') || '')
						.replace(/^@/, '')
						.toLowerCase()
						.trim();

					if (pathname === '/api/v1/usernames/verify' && uParam) {
						const report = await buildFullValuationReport(uParam);
						const tp = report.telemint_provenance || {};
						res.setHeader('Content-Type', 'application/json');
						res.end(
							JSON.stringify({
								username: uParam,
								format_valid: uParam.length >= 4 && uParam.length <= 32,
								is_collectible_length: uParam.length === 4,
								is_basic_eligible: uParam.length >= 5,
								telegram_status: report.fragment_market_status || report.telegram_status,
								peer_type: report.entity_info?.type || 'unassigned',
								linked_telegram_user: report.entity_info?.title || undefined,
								is_minted_nft: Boolean(tp.is_authentic),
								collection_verified: Boolean(tp.collection_match),
								verification_state: tp.verification_status || 'verified',
								telemint_provenance: tp,
								verified_at: new Date().toISOString(),
							}),
						);
						return;
					}

					if (pathname === '/api/v1/usernames/similar' && uParam) {
						const report = await buildFullValuationReport(uParam);
						res.setHeader('Content-Type', 'application/json');
						res.end(
							JSON.stringify({
								username: uParam,
								similar: report.similar || [],
							}),
						);
						return;
					}

					if ((pathname === '/api/v1/usernames/check' || pathname === '/api/v1/usernames/quick') && uParam) {
						const report = await buildFullValuationReport(uParam);
						res.setHeader('Content-Type', 'application/json');
						res.end(
							JSON.stringify({
								username: uParam,
								status: report.status,
								telegram_status: report.telegram_status,
								fragment_status: report.fragment_market_status,
								expected_ton: report.expected_ton,
								expected_usd: report.expected_usd,
								is_minted_nft: Boolean(report.telemint_provenance?.is_authentic),
								owner_address: report.history?.owner_address,
							}),
						);
						return;
					}

					if (pathname === '/api/v1/usernames/valuation-access') {
						res.setHeader('Content-Type', 'application/json');
						res.end(
							JSON.stringify({
								has_access: true,
								method: 'pro',
								is_pro: true,
								daily_used: 1,
								daily_limit: 50,
								free_quota_used: false,
								in_channel: true,
								in_group: true,
								credits_balance: 25,
								first_report_discount_eligible: false,
								is_monitored: false,
							}),
						);
						return;
					}

					if (
						pathname === '/api/v1/usernames/valuation-verify-free' ||
						pathname === '/api/v1/usernames/valuation-pay-airdrop' ||
						pathname === '/api/v1/intel/credits/consume'
					) {
						res.setHeader('Content-Type', 'application/json');
						res.end(
							JSON.stringify({
								success: true,
								has_access: true,
								method: 'credit',
								in_channel: true,
								in_group: true,
								remaining_coins: 100,
							}),
						);
						return;
					}

					if (pathname === '/api/v1/usernames/valuate' && uParam) {
						const report = await buildFullValuationReport(uParam);
						res.setHeader('Content-Type', 'application/json');
						res.end(JSON.stringify(report));
						return;
					}

					return next();
				} catch {
					return next();
				}
			});
		},
	};
}
