import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

export function ownerLiveCommandPlugin(): Plugin {
	// Live Server-Side State for Sovereign Owner Terminal
	let liveSettings = {
		version: 4,
		maintenance_mode: false,
		free_daily_quota: 1,
		signup_bonus_credits: 3,
		referral_bonus_credits: 2,
		referral_rev_share_pct: 15,
		cost_username_report: 1,
		cost_number_report: 1,
		cost_gift_report: 1,
		cost_portfolio_scan: 2,
		ton_usd_override: 0,
		gift_floor_strictness: 1.0,
		vanity_ask_multiplier_threshold: 3.5,
		enable_live_fragment_Verify: true,
		enable_live_tonapi_boc: true,
		investors_page_image_url: '',
		updated_at: new Date().toISOString(),
	};

	const recentValuations: Array<{
		id: string;
		asset_type: 'username' | 'number' | 'gift' | 'portfolio';
		query: string;
		display_title: string;
		fair_value_ton: number;
		fair_value_usd: number;
		confidence_score: number;
		credits_spent: number;
		latency_ms: number;
		created_at: string;
	}> = [
		{
			id: 'val-init-1',
			asset_type: 'gift',
			query: 'PlushPepe-1',
			display_title: 'Plush Pepe #1 (Genesis Crown)',
			fair_value_ton: 14500,
			fair_value_usd: 50460,
			confidence_score: 98,
			credits_spent: 1,
			latency_ms: 142,
			created_at: new Date(Date.now() - 180000).toISOString(),
		},
		{
			id: 'val-init-2',
			asset_type: 'number',
			query: '8888888',
			display_title: '+888 8 888 (4-Digit Sovereign Grail)',
			fair_value_ton: 107250,
			fair_value_usd: 373230,
			confidence_score: 99,
			credits_spent: 1,
			latency_ms: 168,
			created_at: new Date(Date.now() - 420000).toISOString(),
		},
		{
			id: 'val-init-3',
			asset_type: 'username',
			query: 'rare',
			display_title: '@rare (Tier-1 Dictionary Grail)',
			fair_value_ton: 38500,
			fair_value_usd: 133980,
			confidence_score: 97,
			credits_spent: 1,
			latency_ms: 118,
			created_at: new Date(Date.now() - 760000).toISOString(),
		},
		{
			id: 'val-init-4',
			asset_type: 'gift',
			query: 'DurovsCap-88',
			display_title: "Durov's Cap #88",
			fair_value_ton: 1120,
			fair_value_usd: 3898,
			confidence_score: 96,
			credits_spent: 1,
			latency_ms: 134,
			created_at: new Date(Date.now() - 1250000).toISOString(),
		},
		{
			id: 'val-init-5',
			asset_type: 'number',
			query: '88808888888',
			display_title: '+888 0888 8888 (7-Run Octuple)',
			fair_value_ton: 26400,
			fair_value_usd: 91872,
			confidence_score: 98,
			credits_spent: 1,
			latency_ms: 155,
			created_at: new Date(Date.now() - 1900000).toISOString(),
		},
	];

	const searchFrequency = new Map<
		string,
		{
			asset_type: 'username' | 'number' | 'gift';
			query: string;
			display_title: string;
			searches_24h: number;
			fair_value_ton: number;
			fair_value_usd: number;
			status_badge: string;
		}
	>([
		[
			'gift:PlushPepe-1',
			{
				asset_type: 'gift',
				query: 'PlushPepe-1',
				display_title: 'Plush Pepe #1',
				searches_24h: 48,
				fair_value_ton: 14500,
				fair_value_usd: 50460,
				status_badge: '4-Floor Verified',
			},
		],
		[
			'number:8888888',
			{
				asset_type: 'number',
				query: '8888888',
				display_title: '+888 8 888',
				searches_24h: 39,
				fair_value_ton: 107250,
				fair_value_usd: 373230,
				status_badge: 'Genesis #1 Grail',
			},
		],
		[
			'username:rare',
			{
				asset_type: 'username',
				query: 'rare',
				display_title: '@rare',
				searches_24h: 34,
				fair_value_ton: 38500,
				fair_value_usd: 133980,
				status_badge: 'On-Chain Minted',
			},
		],
		[
			'gift:DurovsCap-88',
			{
				asset_type: 'gift',
				query: 'DurovsCap-88',
				display_title: "Durov's Cap #88",
				searches_24h: 27,
				fair_value_ton: 1120,
				fair_value_usd: 3898,
				status_badge: 'Floor Anchored',
			},
		],
		[
			'number:88808888888',
			{
				asset_type: 'number',
				query: '88808888888',
				display_title: '+888 0888 8888',
				searches_24h: 22,
				fair_value_ton: 26400,
				fair_value_usd: 91872,
				status_badge: 'Unrestricted SIM',
			},
		],
		[
			'username:cars',
			{
				asset_type: 'username',
				query: 'cars',
				display_title: '@cars',
				searches_24h: 19,
				fair_value_ton: 24000,
				fair_value_usd: 83520,
				status_badge: 'Category Leader',
			},
		],
	]);

	let valuationsToday = {
		total: 189,
		usernames: 64,
		numbers: 52,
		gifts: 73,
		portfolios: 18,
	};

	let creditsEconomyToday = {
		consumed_today: 189,
		purchased_today: 420,
		promo_claimed_today: 85,
		referral_granted_today: 36,
	};

	const managedUsers = [
		{
			telegram_id: 777000,
			username: 'SovereignOwner',
			first_name: 'Sovereign',
			last_name: 'Admin',
			intel_credits: 950,
			total_valuations_run: 142,
			last_searched_asset: 'PlushPepe-1',
			is_premium: true,
			is_banned: false,
			is_flagged: false,
			created_at: '2025-11-10T10:00:00Z',
		},
		{
			telegram_id: 618492011,
			username: 'TonWhaleVault',
			first_name: 'Alexander',
			last_name: 'TON',
			intel_credits: 120,
			total_valuations_run: 68,
			last_searched_asset: '+888 8 888',
			is_premium: true,
			is_banned: false,
			is_flagged: false,
			created_at: '2026-01-14T14:22:00Z',
		},
		{
			telegram_id: 892341055,
			username: 'GiftArbitrage',
			first_name: 'Aria',
			last_name: 'Capital',
			intel_credits: 45,
			total_valuations_run: 39,
			last_searched_asset: 'DurovsCap-88',
			is_premium: true,
			is_banned: false,
			is_flagged: false,
			created_at: '2026-03-02T09:15:00Z',
		},
		{
			telegram_id: 504918233,
			username: 'FragmentCollector',
			first_name: 'Mehdi',
			last_name: 'R.',
			intel_credits: 14,
			total_valuations_run: 19,
			last_searched_asset: '@rare',
			is_premium: false,
			is_banned: false,
			is_flagged: false,
			created_at: '2026-06-19T18:40:00Z',
		},
	];

	let managedUserbots = [
		{
			id: 'mtproto-dc2-primary-01',
			phone_number: '+88808888888',
			account_name: 'Sovereign Core MTProto Node #1 (StarGift & Resolve)',
			telegram_uid: 777888001,
			dc_id: 2,
			mtproto_layer: 198,
			status: 'active',
			ping_ms: 28,
			requests_24h: 1480,
			flood_wait_seconds: 0,
			capabilities: ['StarGift RPC', 'Username Resolve', '+888 Spam Probe', 'Fragment Bridge'],
			last_active_at: new Date().toISOString(),
			created_at: '2026-02-01T12:00:00Z',
		},
		{
			id: 'mtproto-dc4-backup-02',
			phone_number: '+8888777',
			account_name: 'EU-West Failover MTProto Node #2',
			telegram_uid: 777888002,
			dc_id: 4,
			mtproto_layer: 198,
			status: 'active',
			ping_ms: 34,
			requests_24h: 620,
			flood_wait_seconds: 0,
			capabilities: ['StarGift RPC', 'Username Resolve', 'Portfolio X-Ray'],
			last_active_at: new Date().toISOString(),
			created_at: '2026-04-15T08:30:00Z',
		},
	];

	let activePromos = [
		{
			code: 'GIFTWHALE25',
			credit_amount: 25,
			grant_vip_days: 7,
			note: 'Telegram Gifts Launch VIP Promo',
			max_uses: 100,
			uses_count: 34,
			expires_at: '2026-12-31T23:59:59Z',
			is_active: true,
			created_at: '2026-10-01T10:00:00Z',
		},
		{
			code: 'INTEL10',
			credit_amount: 10,
			grant_vip_days: 0,
			note: 'Standard Community Welcome Code',
			max_uses: 500,
			uses_count: 142,
			expires_at: undefined,
			is_active: true,
			created_at: '2026-09-15T10:00:00Z',
		},
	];

	const auditLogs: Array<{
		id: string;
		owner_id: number;
		action: string;
		target_user_id?: number;
		target_id?: string;
		payload?: Record<string, unknown>;
		ip_address: string;
		created_at: string;
	}> = [
		{
			id: 'aud-101',
			owner_id: 777000,
			action: 'update_settings',
			payload: {
				cost_username_report: 1,
				cost_number_report: 1,
				cost_gift_report: 1,
				gift_floor_strictness: 1.0,
			},
			ip_address: '127.0.0.1',
			created_at: new Date(Date.now() - 3600000).toISOString(),
		},
		{
			id: 'aud-102',
			owner_id: 777000,
			action: 'connect_mtproto_session',
			target_id: 'mtproto-dc2-primary-01',
			payload: { dc_id: 2, layer: 198, capabilities: ['StarGift RPC', 'Username Resolve'] },
			ip_address: '127.0.0.1',
			created_at: new Date(Date.now() - 7200000).toISOString(),
		},
	];

	let adsList = [
		{
			id: 'ad-gift-terminal-1',
			slot: 'dashboard_banner',
			title: 'Telegram Collectible Gifts 4-Floor Terminal',
			image_url: 'https://nft.fragment.com/gift/plushpepe-1.webp',
			target_url: 'https://t.me/iFragmentBot',
			priority: 10,
			is_active: true,
			impressions_count: 14820,
			clicks_count: 1290,
			created_at: '2026-10-10T10:00:00Z',
		},
	];

	let broadcastsList = [
		{
			id: 'bc-01',
			target_audience: 'all',
			message:
				'<b>🎁 موتور جدید ارزش‌گذاری گیفت‌های تلگرام فعال شد!</b>\nهم‌اکنون می‌توانید ارزش واقعی، قیمت کف مدل و پس‌زمینه را با دقت ۴-فلور بررسی کنید.',
			status: 'completed',
			total_count: 1420,
			sent_count: 1416,
			failed_count: 4,
			created_at: new Date(Date.now() - 86400000).toISOString(),
		},
	];

	const financeOrders = [
		{
			id: 'ord-stars-901',
			user_id: 618492011,
			username: 'TonWhaleVault',
			amount: 500,
			amount_stars: 500,
			credits_granted: 50,
			currency: 'XTR',
			status: 'paid',
			payload: '50x Intel Credits ⚡ Pack + VIP Pro',
			created_at: new Date(Date.now() - 5400000).toISOString(),
		},
		{
			id: 'ord-stars-902',
			user_id: 892341055,
			username: 'GiftArbitrage',
			amount: 250,
			amount_stars: 250,
			credits_granted: 25,
			currency: 'XTR',
			status: 'paid',
			payload: '25x Intel Credits ⚡ Pack',
			created_at: new Date(Date.now() - 19400000).toISOString(),
		},
		{
			id: 'ord-stars-903',
			user_id: 504918233,
			username: 'FragmentCollector',
			amount: 100,
			amount_stars: 100,
			credits_granted: 10,
			currency: 'XTR',
			status: 'paid',
			payload: '10x Intel Credits ⚡ Starter',
			created_at: new Date(Date.now() - 48400000).toISOString(),
		},
	];

	const readJsonBody = (req: any): Promise<any> =>
		new Promise((resolve) => {
			let body = '';
			req.on('data', (chunk: any) => {
				body += chunk;
			});
			req.on('end', () => {
				try {
					resolve(body ? JSON.parse(body) : {});
				} catch {
					resolve({});
				}
			});
		});

	// Create an unexpired JWT for Owner sessions
	const generateOwnerJwt = (tgId: number) => {
		const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
		const payload = Buffer.from(
			JSON.stringify({
				sub: String(tgId || 777000),
				role: 'owner',
				iat: Math.floor(Date.now() / 1000),
				exp: Math.floor(Date.now() / 1000) + 86400 * 7,
			}),
		).toString('base64url');
		return `${header}.${payload}.sovereign_owner_sig`;
	};

	return {
		name: 'owner-live-command-plugin',
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				try {
					const rawUrl = req.url || '';
					const parsedUrl = new URL(rawUrl, 'http://localhost');
					const pathname = parsedUrl.pathname;

					// 1. Passively record live valuations across our 3 engines!
					if (
						pathname === '/api/v1/usernames/valuate' ||
						pathname === '/api/v1/numbers/valuate' ||
						pathname === '/api/v1/gifts/valuate'
					) {
						const startTs = Date.now();
						const u = parsedUrl.searchParams.get('username') || parsedUrl.searchParams.get('u');
						const n = parsedUrl.searchParams.get('number') || parsedUrl.searchParams.get('n');
						const g = parsedUrl.searchParams.get('gift') || parsedUrl.searchParams.get('g');
						const assetType: 'username' | 'number' | 'gift' = pathname.includes('usernames')
							? 'username'
							: pathname.includes('numbers')
								? 'number'
								: 'gift';
						const qStr = (u || n || g || '').trim();
						if (qStr) {
							valuationsToday.total += 1;
							if (assetType === 'username') valuationsToday.usernames += 1;
							if (assetType === 'number') valuationsToday.numbers += 1;
							if (assetType === 'gift') valuationsToday.gifts += 1;
							creditsEconomyToday.consumed_today += 1;

							const display =
								assetType === 'username'
									? `@${qStr.replace(/^@/, '')}`
									: assetType === 'number'
										? `+${qStr.replace(/[^\d]/g, '')}`
										: qStr;
							recentValuations.unshift({
								id: `val-${Date.now()}`,
								asset_type: assetType,
								query: qStr,
								display_title: display,
								fair_value_ton: assetType === 'number' ? 1250 : assetType === 'gift' ? 185 : 640,
								fair_value_usd: assetType === 'number' ? 4350 : assetType === 'gift' ? 644 : 2227,
								confidence_score: 96,
								credits_spent: 1,
								latency_ms: Math.max(45, Date.now() - startTs + 85),
								created_at: new Date().toISOString(),
							});
							if (recentValuations.length > 25) recentValuations.pop();

							const mapKey = `${assetType}:${qStr}`;
							const existing = searchFrequency.get(mapKey);
							if (existing) {
								existing.searches_24h += 1;
							} else {
								searchFrequency.set(mapKey, {
									asset_type: assetType,
									query: qStr,
									display_title: display,
									searches_24h: 1,
									fair_value_ton: assetType === 'number' ? 1250 : assetType === 'gift' ? 185 : 640,
									fair_value_usd: assetType === 'number' ? 4350 : assetType === 'gift' ? 644 : 2227,
									status_badge: 'Live Queried',
								});
							}
						}
						return next();
					}

					if (!pathname.startsWith('/api/v1/owner')) {
						return next();
					}

					res.setHeader('Content-Type', 'application/json');

					// POST /api/v1/owner/auth/login
					if (pathname === '/api/v1/owner/auth/login' && req.method === 'POST') {
						const body = await readJsonBody(req);
						const tgId = Number(body.telegram_id) || 777000;
						const token = generateOwnerJwt(tgId);
						auditLogs.unshift({
							id: `aud-${Date.now()}`,
							owner_id: tgId,
							action: 'owner_login',
							payload: { method: 'master_password', telegram_id: tgId },
							ip_address: '127.0.0.1',
							created_at: new Date().toISOString(),
						});
						res.end(
							JSON.stringify({
								mfa_required: false,
								token,
							}),
						);
						return;
					}

					// POST /api/v1/owner/auth/verify-totp
					if (pathname === '/api/v1/owner/auth/verify-totp' && req.method === 'POST') {
						res.end(JSON.stringify({ token: generateOwnerJwt(777000) }));
						return;
					}

					// GET /api/v1/owner/dashboard
					if (pathname === '/api/v1/owner/dashboard' && req.method === 'GET') {
						let liveTonUsd = 3.48;
						try {
							const cgRes = await fetch(
								'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
								{ signal: AbortSignal.timeout(2500) },
							);
							if (cgRes.ok) {
								const cgJson: any = await cgRes.json();
								if (cgJson?.['the-open-network']?.usd) {
									liveTonUsd = Number(cgJson['the-open-network'].usd);
								}
							}
						} catch {}

						if (liveSettings.ton_usd_override > 0) {
							liveTonUsd = liveSettings.ton_usd_override;
						}

						const totalCreditsInCirc = managedUsers.reduce(
							(acc, u) => acc + (u.intel_credits || 0),
							0,
						);
						const totalStarsRev = financeOrders
							.filter((o) => o.status === 'paid')
							.reduce((acc, o) => acc + (o.amount_stars || o.amount || 0), 0);

						const now = Date.now();
						const growth30d = Array.from({ length: 30 }, (_, idx) => {
							const d = new Date(now - (29 - idx) * 86400000).toISOString().slice(0, 10);
							return {
								date: d,
								new_users: 14 + ((idx * 7) % 19),
								active_users: 160 + idx * 6 + ((idx * 13) % 25),
								valuations_count: 95 + idx * 4 + ((idx * 11) % 30),
							};
						});

						const topAssets = Array.from(searchFrequency.values())
							.sort((a, b) => b.searches_24h - a.searches_24h)
							.slice(0, 8);

						res.end(
							JSON.stringify({
								total_users: 1420 + managedUsers.length,
								dau: 342,
								mau: 1180,
								premium_users: managedUsers.filter((u) => u.is_premium).length + 48,
								total_intel_credits_circulation: totalCreditsInCirc,
								total_stars_revenue: totalStarsRev,
								ton_usd_rate: liveTonUsd,
								nums888_floor_ton: 975,
								tracked_gift_collections: 105,
								valuations_today: valuationsToday,
								credits_economy_today: creditsEconomyToday,
								recent_valuations: recentValuations,
								top_searched_assets: topAssets,
								growth_30d: growth30d,
							}),
						);
						return;
					}

					// GET /api/v1/owner/users
					if (pathname === '/api/v1/owner/users' && req.method === 'GET') {
						const q = (parsedUrl.searchParams.get('q') || '').toLowerCase().trim();
						const filter = parsedUrl.searchParams.get('filter') || 'all';
						let filtered = [...managedUsers];
						if (q) {
							filtered = filtered.filter(
								(u) =>
									String(u.telegram_id).includes(q) ||
									(u.username || '').toLowerCase().includes(q) ||
									u.first_name.toLowerCase().includes(q),
							);
						}
						if (filter === 'premium') filtered = filtered.filter((u) => u.is_premium);
						if (filter === 'flagged') filtered = filtered.filter((u) => u.is_flagged);
						if (filter === 'banned') filtered = filtered.filter((u) => u.is_banned);

						res.end(JSON.stringify({ users: filtered, total: filtered.length }));
						return;
					}

					// POST /api/v1/owner/users/:id/intel-credits
					const creditsMatch = pathname.match(/^\/api\/v1\/owner\/users\/(\d+)\/intel-credits$/);
					if (creditsMatch && req.method === 'POST') {
						const uid = Number(creditsMatch[1]);
						const body = await readJsonBody(req);
						const delta = Number(body.delta) || 0;
						const user = managedUsers.find((u) => u.telegram_id === uid);
						if (user) {
							user.intel_credits = Math.max(0, (user.intel_credits || 0) + delta);
						}
						auditLogs.unshift({
							id: `aud-${Date.now()}`,
							owner_id: 777000,
							action: 'adjust_intel_credits',
							target_user_id: uid,
							payload: { delta, reason: body.reason, new_credits: user?.intel_credits ?? 0 },
							ip_address: '127.0.0.1',
							created_at: new Date().toISOString(),
						});
						res.end(
							JSON.stringify({
								status: 'ok',
								new_credits: user?.intel_credits ?? 0,
							}),
						);
						return;
					}

					// POST /api/v1/owner/users/:id/vip
					const vipMatch = pathname.match(/^\/api\/v1\/owner\/users\/(\d+)\/vip$/);
					if (vipMatch && req.method === 'POST') {
						const uid = Number(vipMatch[1]);
						const body = await readJsonBody(req);
						const user = managedUsers.find((u) => u.telegram_id === uid);
						if (user) {
							user.is_premium = Boolean(body.is_premium);
						}
						auditLogs.unshift({
							id: `aud-${Date.now()}`,
							owner_id: 777000,
							action: 'toggle_vip',
							target_user_id: uid,
							payload: { is_premium: Boolean(body.is_premium) },
							ip_address: '127.0.0.1',
							created_at: new Date().toISOString(),
						});
						res.end(JSON.stringify({ status: 'ok', is_premium: user?.is_premium ?? false }));
						return;
					}

					// POST /api/v1/owner/users/:id/flag
					const flagMatch = pathname.match(/^\/api\/v1\/owner\/users\/(\d+)\/flag$/);
					if (flagMatch && req.method === 'POST') {
						const uid = Number(flagMatch[1]);
						const body = await readJsonBody(req);
						const user = managedUsers.find((u) => u.telegram_id === uid);
						if (user) {
							user.is_flagged = Boolean(body.is_flagged);
						}
						res.end(JSON.stringify({ status: 'ok', is_flagged: user?.is_flagged ?? false }));
						return;
					}

					// POST /api/v1/owner/users/:id/ban & unban
					const banMatch = pathname.match(/^\/api\/v1\/owner\/users\/(\d+)\/(ban|unban)$/);
					if (banMatch && req.method === 'POST') {
						const uid = Number(banMatch[1]);
						const isBan = banMatch[2] === 'ban';
						const body = await readJsonBody(req);
						const user = managedUsers.find((u) => u.telegram_id === uid);
						if (user) {
							user.is_banned = isBan;
						}
						auditLogs.unshift({
							id: `aud-${Date.now()}`,
							owner_id: 777000,
							action: isBan ? 'ban_user' : 'unban_user',
							target_user_id: uid,
							payload: { reason: body.reason || 'owner_action' },
							ip_address: '127.0.0.1',
							created_at: new Date().toISOString(),
						});
						res.end(JSON.stringify({ status: 'ok' }));
						return;
					}

					// GET / PUT /api/v1/owner/settings
					if (pathname === '/api/v1/owner/settings') {
						if (req.method === 'GET') {
							res.end(JSON.stringify(liveSettings));
							return;
						}
						if (req.method === 'PUT') {
							const body = await readJsonBody(req);
							liveSettings = {
								...liveSettings,
								...body,
								version: (liveSettings.version || 1) + 1,
								updated_at: new Date().toISOString(),
							};
							auditLogs.unshift({
								id: `aud-${Date.now()}`,
								owner_id: 777000,
								action: 'update_settings',
								payload: {
									version: liveSettings.version,
									cost_username: liveSettings.cost_username_report,
									cost_number: liveSettings.cost_number_report,
									cost_gift: liveSettings.cost_gift_report,
								},
								ip_address: '127.0.0.1',
								created_at: new Date().toISOString(),
							});
							res.end(JSON.stringify(liveSettings));
							return;
						}
					}

					// GET / POST / DELETE /api/v1/owner/userbots (MTProto Sessions)
					if (pathname === '/api/v1/owner/userbots' && req.method === 'GET') {
						res.end(JSON.stringify({ userbots: managedUserbots }));
						return;
					}
					if (pathname === '/api/v1/owner/userbots/send-code' && req.method === 'POST') {
						res.end(
							JSON.stringify({
								phone_code_hash: `mtproto_hash_${Date.now()}`,
								dc_id: 2,
							}),
						);
						return;
					}
					if (pathname === '/api/v1/owner/userbots/verify-code' && req.method === 'POST') {
						const body = await readJsonBody(req);
						const newBot = {
							id: `mtproto-dc2-${Date.now().toString(36)}`,
							phone_number: body.phone_number || '+88800000000',
							account_name: body.account_name || 'MTProto Sovereign Worker Node',
							telegram_uid: Math.floor(700000000 + Math.random() * 90000000),
							dc_id: 2,
							mtproto_layer: 198,
							status: 'active',
							ping_ms: 26,
							requests_24h: 1,
							flood_wait_seconds: 0,
							capabilities: ['StarGift RPC', 'Username Resolve', '+888 Spam Probe'],
							last_active_at: new Date().toISOString(),
							created_at: new Date().toISOString(),
						};
						managedUserbots.unshift(newBot);
						auditLogs.unshift({
							id: `aud-${Date.now()}`,
							owner_id: 777000,
							action: 'connect_mtproto_session',
							target_id: newBot.id,
							payload: {
								phone: newBot.phone_number,
								has_2fa: Boolean(body.password_2fa),
								dc_id: 2,
							},
							ip_address: '127.0.0.1',
							created_at: new Date().toISOString(),
						});
						res.end(JSON.stringify({ status: 'connected', userbot: newBot }));
						return;
					}
					const pingBotMatch = pathname.match(/^\/api\/v1\/owner\/userbots\/([^/]+)\/ping$/);
					if (pingBotMatch && req.method === 'POST') {
						const botId = pingBotMatch[1];
						const bot = managedUserbots.find((b) => b.id === botId);
						const measuredPing = Math.floor(21 + Math.random() * 18);
						if (bot) {
							bot.ping_ms = measuredPing;
							bot.requests_24h = (bot.requests_24h || 0) + 1;
							bot.last_active_at = new Date().toISOString();
						}
						res.end(
							JSON.stringify({
								status: 'ok',
								ping_ms: measuredPing,
								dc_id: bot?.dc_id || 2,
							}),
						);
						return;
					}
					const delBotMatch = pathname.match(/^\/api\/v1\/owner\/userbots\/([^/]+)$/);
					if (delBotMatch && req.method === 'DELETE') {
						const botId = delBotMatch[1];
						managedUserbots = managedUserbots.filter((b) => b.id !== botId);
						auditLogs.unshift({
							id: `aud-${Date.now()}`,
							owner_id: 777000,
							action: 'delete_userbot',
							target_id: botId,
							ip_address: '127.0.0.1',
							created_at: new Date().toISOString(),
						});
						res.end(JSON.stringify({ status: 'deleted' }));
						return;
					}

					// GET / POST / DELETE /api/v1/owner/promos
					if (pathname === '/api/v1/owner/promos') {
						if (req.method === 'GET') {
							res.end(JSON.stringify({ promos: activePromos }));
							return;
						}
						if (req.method === 'POST') {
							const body = await readJsonBody(req);
							const newPromo = {
								code: (body.code || 'INTEL25').toUpperCase(),
								credit_amount: Number(body.credit_amount) || 10,
								grant_vip_days: Number(body.grant_vip_days) || 0,
								note: body.note || '',
								max_uses: Number(body.max_uses) || 100,
								uses_count: 0,
								expires_at: body.expires_at || undefined,
								is_active: true,
								created_at: new Date().toISOString(),
							};
							activePromos = [newPromo, ...activePromos.filter((p) => p.code !== newPromo.code)];
							auditLogs.unshift({
								id: `aud-${Date.now()}`,
								owner_id: 777000,
								action: 'create_promo',
								target_id: newPromo.code,
								payload: {
									credit_amount: newPromo.credit_amount,
									grant_vip_days: newPromo.grant_vip_days,
									max_uses: newPromo.max_uses,
								},
								ip_address: '127.0.0.1',
								created_at: new Date().toISOString(),
							});
							res.end(JSON.stringify({ promo: newPromo }));
							return;
						}
					}
					const delPromoMatch = pathname.match(/^\/api\/v1\/owner\/promos\/([^/]+)$/);
					if (delPromoMatch && req.method === 'DELETE') {
						const codeToDel = decodeURIComponent(delPromoMatch[1]);
						activePromos = activePromos.filter((p) => p.code !== codeToDel);
						res.end(JSON.stringify({ status: 'deleted' }));
						return;
					}

					// GET /api/v1/owner/finance/summary & orders
					if (pathname === '/api/v1/owner/finance/summary' && req.method === 'GET') {
						const totalStars = financeOrders.reduce((acc, o) => acc + (o.amount_stars || 0), 0);
						res.end(
							JSON.stringify({
								total_revenue_stars: totalStars + 14500,
								revenue_7d: totalStars + 2400,
								revenue_30d: totalStars + 8900,
								active_subscriptions: 51,
								churn_rate: 2.4,
							}),
						);
						return;
					}
					if (pathname === '/api/v1/owner/finance/orders' && req.method === 'GET') {
						res.end(JSON.stringify({ orders: financeOrders }));
						return;
					}

					// GET / POST /api/v1/owner/broadcasts
					if (pathname === '/api/v1/owner/broadcasts' && req.method === 'GET') {
						res.end(JSON.stringify({ broadcasts: broadcastsList }));
						return;
					}
					if (pathname === '/api/v1/owner/broadcasts/audience-count' && req.method === 'GET') {
						const target = parsedUrl.searchParams.get('target') || 'all';
						const counts: Record<string, number> = {
							all: 1424,
							premium: 51,
							active_7d: 618,
							inactive: 312,
						};
						res.end(JSON.stringify({ count: counts[target] || 1424 }));
						return;
					}
					if (pathname === '/api/v1/owner/broadcasts' && req.method === 'POST') {
						const body = await readJsonBody(req);
						const newBc = {
							id: `bc-${Date.now()}`,
							target_audience: body.target_audience || 'all',
							message: body.message || '',
							status: body.scheduled_at ? 'queued' : 'completed',
							total_count: 1424,
							sent_count: body.scheduled_at ? 0 : 1424,
							failed_count: 0,
							scheduled_at: body.scheduled_at,
							created_at: new Date().toISOString(),
						};
						broadcastsList.unshift(newBc as any);
						res.end(JSON.stringify({ broadcast: newBc }));
						return;
					}

					// GET / POST / PUT / DELETE /api/v1/owner/ads
					if (pathname === '/api/v1/owner/ads') {
						if (req.method === 'GET') {
							const slot = parsedUrl.searchParams.get('slot');
							const filtered = slot ? adsList.filter((a) => a.slot === slot) : adsList;
							res.end(JSON.stringify({ ads: filtered }));
							return;
						}
						if (req.method === 'POST') {
							const body = await readJsonBody(req);
							const newAd = {
								id: `ad-${Date.now()}`,
								slot: body.slot || 'dashboard_banner',
								title: body.title || 'New Campaign',
								image_url: body.image_url || '',
								target_url: body.target_url || 'https://t.me/',
								priority: Number(body.priority) || 1,
								is_active: Boolean(body.is_active ?? true),
								impressions_count: 1,
								clicks_count: 0,
								created_at: new Date().toISOString(),
							};
							adsList.unshift(newAd);
							res.end(JSON.stringify({ ad: newAd }));
							return;
						}
					}

					// GET /api/v1/owner/health & /health/external & /health/clear-cache
					if (pathname === '/api/v1/owner/health' && req.method === 'GET') {
						const memMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
						res.end(
							JSON.stringify({
								status: 'ok',
								db_status: 'ok',
								db_latency_ms: 1.8,
								redis_status: 'ok',
								cache_hit_rate_pct: 94.6,
								cached_valuations_count: searchFrequency.size + recentValuations.length,
								active_goroutines: 28,
								memory_used_mb: memMb,
								cpu_usage_percent: 4.2,
								uptime_seconds: Math.floor(process.uptime()),
								ton_usd_live: 3.48,
								timestamp: new Date().toISOString(),
							}),
						);
						return;
					}

					if (pathname === '/api/v1/owner/health/external' && req.method === 'GET') {
						// Perform real live HTTP latency probes against upstream ecosystem oracles
						const probeUrl = async (
							id: string,
							name: string,
							category: 'ton' | 'gifts' | 'market' | 'telegram' | 'macro',
							url: string,
							metricLabel: string,
						) => {
							const t0 = Date.now();
							try {
								const r = await fetch(url, {
									method: 'GET',
									headers: { 'User-Agent': 'Mozilla/5.0 iFragment-HealthProbe/1.0' },
									signal: AbortSignal.timeout(3500),
								});
								const ms = Date.now() - t0;
								return {
									id,
									name,
									category,
									endpoint: url,
									status: r.ok ? 'healthy' : 'degraded',
									latency_ms: ms,
									http_status: r.status,
									live_metric: metricLabel,
									checked_at: new Date().toISOString(),
								};
							} catch (e: any) {
								return {
									id,
									name,
									category,
									endpoint: url,
									status: 'degraded',
									latency_ms: Date.now() - t0,
									http_status: 503,
									live_metric: metricLabel,
									error: e?.message,
									checked_at: new Date().toISOString(),
								};
							}
						};

						const providers = await Promise.all([
							probeUrl(
								'fragment',
								'Fragment.com Official',
								'telegram',
								'https://fragment.com/numbers',
								'Usernames, +888 & Gifts Auction/Spam Oracle',
							),
							probeUrl(
								'tonapi',
								'TonAPI.io v2 (TVM BOC)',
								'ton',
								'https://tonapi.io/v2/status',
								'On-Chain NFT Provenance & Whale X-Ray',
							),
							probeUrl(
								'changes_tg',
								'Changes.tg Gift Registry',
								'gifts',
								'https://api.changes.tg/gifts',
								'Live StarGift Models, Backdrops & Symbols',
							),
							probeUrl(
								'nums888',
								'Nums888.io Analytics',
								'market',
								'https://nums888.io/',
								'Live +888 Anonymous Number Floor & Comps',
							),
							probeUrl(
								'coingecko',
								'CoinGecko TON/USD Oracle',
								'macro',
								'https://api.coingecko.com/api/v3/ping',
								'Real-Time TON/USD Spot Rate Feed',
							),
						]);

						res.end(
							JSON.stringify({
								status: 'ok',
								checked_at: new Date().toISOString(),
								providers,
							}),
						);
						return;
					}

					if (pathname === '/api/v1/owner/health/clear-cache' && req.method === 'POST') {
						const count = searchFrequency.size + recentValuations.length + 42;
						auditLogs.unshift({
							id: `aud-${Date.now()}`,
							owner_id: 777000,
							action: 'clear_cache',
							payload: { deleted_keys: count },
							ip_address: '127.0.0.1',
							created_at: new Date().toISOString(),
						});
						res.end(JSON.stringify({ status: 'ok', deleted_keys: count }));
						return;
					}

					if (pathname === '/api/v1/owner/health/errors' && req.method === 'GET') {
						res.end(JSON.stringify({ errors: [] }));
						return;
					}

					// GET /api/v1/owner/audit-logs
					if (pathname === '/api/v1/owner/audit-logs' && req.method === 'GET') {
						const action = parsedUrl.searchParams.get('action') || '';
						const search = (parsedUrl.searchParams.get('search') || '').toLowerCase().trim();
						let filtered = [...auditLogs];
						if (action) filtered = filtered.filter((l) => l.action === action);
						if (search) {
							filtered = filtered.filter(
								(l) =>
									l.action.toLowerCase().includes(search) ||
									String(l.target_user_id || '').includes(search) ||
									JSON.stringify(l.payload || {})
										.toLowerCase()
										.includes(search),
							);
						}
						res.end(JSON.stringify({ logs: filtered, total: filtered.length }));
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
