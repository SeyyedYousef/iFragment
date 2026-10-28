import { useNavigate, useSearchParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { toPng } from 'html-to-image';
import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { creditsApi } from '@/entities/intel/api/creditsApi.js';
import { valuationApi } from '@/entities/username/index.js';
import { apiFetch } from '@/shared/api/base.js';
import { isRtl, locale, t } from '@/shared/i18n/index.js';
import { layaT, USERNAME_I18N } from '@/shared/i18n/laya-i18n.js';
import { cloudStorage } from '@/shared/lib/cloud-storage.js';
import { haptic } from '@/shared/lib/haptic.js';
import {
	getCachedReport,
	getCacheExpiry,
	getRecentReports,
	type RecentReport,
	saveReport,
} from '@/shared/lib/report-cache.js';
import { copyToClipboard, shareToStory } from '@/shared/lib/telegram-native.js';
import { UnifiedPaywallGate } from '@/widgets/paywall/index.js';
import { LayaCategoriesExplorer } from './components/LayaCategoriesExplorer.js';
import { LayaMultiDimensionalCard } from './components/LayaMultiDimensionalCard.js';
import { TargetBuyerPersonaCard } from './components/TargetBuyerPersonaCard.js';
import { TelegramTOSLegalMatrix } from './components/TelegramTOSLegalMatrix.js';

interface ValuationResult {
	run_id: number;
	username: string;
	model_version: string;
	base_price_ton: string;
	low_ton: string;
	expected_ton: string;
	high_ton: string;
	low_usd: string;
	expected_usd: string;
	high_usd: string;
	confidence_score: number;
	ton_usd_rate: number;
	comparable_sales_count: number;
	rarity: { tier: string; stars: string };
	tags: string[];
	length: number;
	dictionary: {
		is_word: boolean;
		part_of_speech?: string;
		definition?: string;
		word_frequency?: number;
	};
	history: {
		is_sold: boolean;
		owner_address?: string;
		highest_past_sale_ton?: number;
		transactions?: {
			sale_price_ton: string;
			date: string;
			buyer: string;
			event_type?: 'sale' | 'transfer';
		}[];
	};
	similar: {
		username: string;
		reason: string;
		status?: string;
		sale_price?: number;
		sale_price_usd?: number;
		sale_date?: string;
		price_source?: string;
		category?: 'live_fragment' | 'semantic' | 'structural' | string;
		semantic_score?: number;
		semantic_cluster?: string;
	}[];
	portfolio?: {
		owner_address: string;
		owner_name?: string;
		total_count: number;
		total_last_sale_ton?: number;
		total_last_sale_usd?: number;
		total_acquisition_cost_ton?: number;
		total_est_value_ton?: number;
		total_est_value_usd?: number;
		priced_items?: number;
		unknown_items?: number;
		items: {
			username: string;
			status: string;
			last_sale_ton?: number;
			last_sale_usd?: number;
			last_sale_date?: string;
		}[];
	};
	owner_profile?: {
		user_id?: number;
		first_name?: string;
		last_name?: string;
		username?: string;
		is_premium?: boolean;
		has_photo?: boolean;
		peer_type?: string;
		bio?: string;
		avatar_url?: string;
		extra_text?: string;
		members_count?: number;
		online_count?: number;
		verified?: boolean;
	};
	structure: {
		has_digits: boolean;
		letters_only: boolean;
		has_underscore: boolean;
		is_pronounceable?: boolean;
		is_palindrome?: boolean;
		vowel_ratio?: number;
	};
	seo: { score: number; verdict: string };
	liquidity_rating?: string;
	estimated_sell_time?: string;
	target_buyer_profile?: string;
	projected_growth?: {
		bull_ton: number;
		base_ton: number;
		bear_ton: number;
		bull_usd: number;
		base_usd: number;
		bear_usd: number;
	};
	liquidity_metrics?: { score: number; estimated_days: string };
	auction_playbook?: {
		start_price_ton: number;
		starting_bid_ton?: number;
		bid_step_ton: number;
		best_day: string;
		best_hour_utc: string;
	};
	search_trend?: { surge_percent: number; status: string };
	live_market?: {
		status: string;
		raw_status_text?: string;
		is_vanity_ask?: boolean;
		vanity_ask_warning?: string;
		current_bid_ton?: number;
		current_bid_usd?: number;
		buy_now_ton?: number;
		buy_now_usd?: number;
		auction_ends_at?: string;
		mint_date?: string;
		owner_address?: string;
		previous_owners?: number;
		offers?: { price_ton: number; price_usd?: number; date?: string; from?: string }[];
		bid_analytics?: {
			total_bids_count: number;
			unique_bidders_count: number;
			opening_bid_ton: number;
			highest_bid_ton: number;
			bid_jump_multiple: number;
		};
		fragment_url: string;
		getgems_url?: string;
		telegram_url: string;
		nft_image_url?: string;
		ask_vs_estimate_pct?: number;
		checked_at: string;
	};
	price_basis?: {
		target_sales: number;
		exact_sales: number;
		broad_sales: number;
		anchor_used: boolean;
		live_ask_used: boolean;
		method: string;
	};
	quality_grade?: string;
	percentile_rank?: number;
	risk_audit?: {
		has_homoglyph_risk: boolean;
		homoglyph_message?: string;
		is_scam_or_fake: boolean;
		has_trademark_risk: boolean;
		trademark_detail?: string;
		ton_dns_synergy?: string;
	};
	ton_dns_domain?: {
		domain: string;
		exists: boolean;
		nftAddress?: string;
		ownerAddress?: string;
		expiresAt?: string;
		sameOwnerSynergy?: boolean;
	};
	transaction_economics?: {
		net_payout_ton: number;
		net_payout_usd: number;
		fragment_fee_ton: number;
		fragment_fee_pct: number;
		min_bid_ton: number;
		bid_step_ton: number;
	};
	reasoning_log: Record<string, any>;
	investment_grade: string;
	comparables: { username: string; price: number; date: string; tonviewer_url?: string }[];
	price_trend: { label: string; value: number }[];
	wallet_info?: { balance: number; nft_count: number; is_whale: boolean };
	entity_info?: {
		type: string;
		members: number;
		online?: number;
		verified: boolean;
		title?: string;
		bio?: string;
		avatar_url?: string;
		extra_text?: string;
	};
	status?: string;
	telegram_status?: string;
	fragment_market_status?: string;
	trademark_risk?: {
		risk_level: string;
		matched_entity?: string;
		brand?: string;
		advisory_warning: string;
		risk_score: number;
	};
	empirical_band?: {
		model_low_ton?: number;
		model_mid_ton?: number;
		model_high_ton?: number;
		model_low_usd?: number;
		model_mid_usd?: number;
		model_high_usd?: number;
		band_type?: string;
		p10_ton: number;
		p50_ton: number;
		p90_ton: number;
		p10_usd: number;
		p50_usd: number;
		p90_usd: number;
	};
	data_badges?: Record<string, string>;
	is_fallback_used?: boolean;
	brandability: number;
	fear_greed_index: number;
	fear_greed_label: string;
	wikipedia_summary: string;
	rarity_breakdown: Record<string, number>;
	certificate_id?: string;
	certificate_signature?: string;
	telemint_provenance?: TelemintProvenance;
	binary_forensics?: BinaryForensicsDto;
	fragment_capabilities?: FragmentCapabilitiesDto;
	homoglyph_twins?: HomoglyphTwin[];
	laya_system_one?: any;
}

export interface BinaryForensicsDto {
	ascii_hex_spaced: string;
	raw_hex_payload: string;
	byte_length: number;
	total_bits: number;
	set_bits_popcount: number;
	zero_bits_count: number;
	hamming_weight_pct: number;
	shannon_entropy_bits: number;
	max_theoretical_entropy_bits: number;
	unique_chars_count: number;
	hand_alternation_pct: number;
	left_hand_keys: number;
	right_hand_keys: number;
	tep62_sha256_index: string;
	telemint_token_cell_boc: string;
	individual_content_boc?: string;
	boc_magic_prefix: string;
	ton_dns_category_keys: {
		wallet: string;
		telegram: string;
		site: string;
	};
	account_storage_nanoton?: string;
	last_transaction_lt?: string;
	last_transaction_hash?: string;
	raw_data_boc_prefix?: string;
	raw_code_boc_prefix?: string;
	auction_config?: {
		beneficiar: string;
		initialMinBidTon: number;
		maxBidTon: number;
		minBidStepPct: number;
		minExtendTimeSec: number;
		durationSec: number;
	};
	bitstream_matrix: {
		position: number;
		char: string;
		ascii_dec: number;
		hex_byte: string;
		binary_8bit: string;
		hamming_weight: number;
		morse: string;
		keyboard_hand: string;
		keyboard_row: string;
	}[];
}

export interface FragmentCapabilitiesDto {
	can_buy_now: boolean;
	can_bid_auction: boolean;
	can_make_offer: boolean;
	offer_fee_mult: number;
	offer_fee_pct: number;
	offer_fee_min_ton: number;
	offer_fee_max_ton: number;
	suggested_offer_ton: number;
	suggested_offer_fee_ton: number;
	protocol_royalty_pct: number;
	bot_upgrade_fee_ton: number;
	is_assigned_to_bot: boolean;
	max_collectibles_per_profile: number;
	auction_last_lt?: string;
	direct_links: {
		tme_url: string;
		web_subdomain_url: string;
		tg_resolve_uri: string;
		fragment_url: string;
		nft_json_url: string;
		nft_webp_url: string;
	};
}

export interface TelemintProvenance {
	item_address?: string;
	collection_address?: string;
	collection_match?: boolean;
	is_authentic?: boolean;
	owner_address?: string;
	real_owner_address?: string;
	is_escrow?: boolean;
	escrow_marketplace?: string;
	sale_price_ton?: number;
	code_hash?: string;
	data_hash?: string;
	verification_status?: string;
	verified_at?: string;
	details?: string;
}

export interface HomoglyphTwin {
	twin: string;
	status: string;
	price_ton?: number;
	risk_level: string;
	similarity?: string;
}

export interface UsernameVerificationResult {
	username: string;
	format_valid: boolean;
	is_collectible_length: boolean;
	is_basic_eligible: boolean;
	telegram_status: string;
	peer_type?: string;
	linked_telegram_user?: string;
	is_minted_nft: boolean;
	collection_verified: boolean;
	verification_state: string;
	telemint_provenance: TelemintProvenance;
	data_badges?: Record<string, string>;
	verified_at?: string;
}

type ReportTab = 'valuation' | 'onchain' | 'similar' | 'anatomy';

export const UsernamePage: Component = () => {
	const [searchParams] = useSearchParams();
	const [data, setData] = createSignal<ValuationResult | null>(null);
	const [loading, setLoading] = createSignal<boolean>(true);
	const [refreshing, setRefreshing] = createSignal<boolean>(false);
	const [error, setError] = createSignal<string | null>(null);
	const [sharing, setSharing] = createSignal<boolean>(false);
	const [downloading, setDownloading] = createSignal<boolean>(false);
	const [sent, setSent] = createSignal<boolean>(false);
	const [sendCount, setSendCount] = createSignal<number>(0);

	const [activeTab, setActiveTab] = createSignal<ReportTab>('valuation');
	const [showQuickSearch, setShowQuickSearch] = createSignal<boolean>(false);
	const [quickQuery, setQuickQuery] = createSignal<string>('');

	const [accessGranted, setAccessGranted] = createSignal<boolean>(false);
	const [_accessMethod, setAccessMethod] = createSignal<
		'free' | 'stars' | 'coins' | 'pro' | 'credit' | null
	>(null);
	const [_isPro, setIsPro] = createSignal<boolean>(false);
	const [_dailyUsed, setDailyUsed] = createSignal<number>(0);
	const [_showPaymentGate, setShowPaymentGate] = createSignal<boolean>(false);
	const [_freeQuotaUsed, setFreeQuotaUsed] = createSignal<boolean>(false);
	const [lastOrderPayload, _setLastOrderPayload] = createSignal<string>('');
	const [isProcessingPayment, setIsProcessingPayment] = createSignal<boolean>(false);
	const [paymentPending, setPaymentPending] = createSignal<boolean>(false);
	const [pollingStatus, setPollingStatus] = createSignal<string>('');
	const [paymentError, setPaymentError] = createSignal<string>('');
	const [showMethodologyModal, setShowMethodologyModal] = createSignal<boolean>(false);

	// On-Chain verification & Terminal state
	const [searchTerm, setSearchTerm] = createSignal<string>('');
	const [verifyingOnChain, setVerifyingOnChain] = createSignal<boolean>(false);
	const [verificationData, setVerificationData] = createSignal<UsernameVerificationResult | null>(
		null,
	);
	const [similarFilter, setSimilarFilter] = createSignal<
		'all' | 'live_fragment' | 'semantic' | 'structural'
	>('all');
	const [customOfferInput, setCustomOfferInput] = createSignal<string>('');

	// Cached-report state: a paid report stays readable for 24h
	const [_fromCache, setFromCache] = createSignal<boolean>(false);
	const [_cacheExpiry, setCacheExpiry] = createSignal<number | null>(null);
	const [recents, setRecents] = createSignal<RecentReport[]>([]);

	const navigate = useNavigate();
	const username = () => (searchParams.u || '').replace(/^@/, '').toLowerCase().trim();

	const tr = (fa: string, en: string, ru?: string, zh?: string) => {
		const loc = locale() || 'en';
		if (loc === 'fa') return fa;
		if (loc === 'ru') return ru || en;
		if (loc === 'zh') return zh || en;
		return en;
	};

	let cardRef: HTMLDivElement | undefined;
	let hiddenCardRef: HTMLDivElement | undefined;
	let pollIntervalId: any = null;

	const [tilt, setTilt] = createSignal({ x: 0, y: 0, glossX: 50, glossY: 50 });

	const clearPaymentPolling = () => {
		if (pollIntervalId) {
			clearInterval(pollIntervalId);
			pollIntervalId = null;
		}
	};

	onCleanup(() => {
		clearPaymentPolling();
	});

	const openReport = (name: string) => {
		const clean = (name || '').replace(/^@/, '').toLowerCase().trim();
		if (!clean || clean.length < 4) return;
		haptic.impact('light');
		setShowQuickSearch(false);
		navigate(`/username/report?u=${encodeURIComponent(clean)}`);
	};

	const similarBadge = (item: { status?: string; sale_price?: number; price_source?: string }) => {
		const status = (item.status || '').toLowerCase();
		const priced = (item.sale_price ?? 0) > 0;
		if (status === 'sold' && priced) {
			return {
				label: tr('فروخته شده (تایید شده)', 'VERIFIED SALE', 'ПРОДАНО', '已成交验证'),
				class: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30',
			};
		}
		if (status === 'on_auction') {
			return {
				label: tr('در حال حراج زنده', 'LIVE AUCTION', 'АУКЦИОН', '拍卖中'),
				class: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
			};
		}
		if (status === 'on_sale') {
			return {
				label: tr('آگهی فروش فعال', 'FOR SALE', 'В ПРОДАЖЕ', '在售'),
				class: 'bg-[#0098EA]/15 text-[#0098EA] border-[#0098EA]/30',
			};
		}
		if (status === 'taken' || status === 'sold') {
			return {
				label: tr('ثبت شده / فعال', 'TAKEN', 'ЗАНЯТ', '已占用'),
				class: 'bg-white/10 text-white/60 border-white/15',
			};
		}
		if (status === 'available') {
			return {
				label: tr('آزاد برای ثبت', 'AVAILABLE', 'ДОСТУПЕН', '可注册'),
				class: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
			};
		}
		return {
			label: tr('بررسی شده', 'CHECKED', 'ПРОВЕРЕН', '已核验'),
			class: 'bg-white/5 text-white/40 border-white/10',
		};
	};

	const portfolioBadge = (status: string) => {
		switch (status) {
			case 'on_sale':
			case 'sale':
				return {
					label: tr('آگهی فروش', 'LISTED', 'В ПРОДАЖЕ', '在售'),
					class: 'bg-[#0098EA]/15 text-[#0098EA] border-[#0098EA]/30',
				};
			case 'on_auction':
				return {
					label: tr('در حراج', 'AUCTION', 'АУКЦИОН', '拍卖中'),
					class: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
				};
			case 'bought':
				return {
					label: tr('خریداری شده', 'ACQUIRED', 'КУПЛЕН', '已购入'),
					class: 'bg-cyan-400/15 text-cyan-300 border-cyan-400/30',
				};
			default:
				return {
					label: tr('نگهداری (Hold)', 'HOLDING', 'В КОШЕЛЬКЕ', '持有中'),
					class: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
				};
		}
	};

	const hasPortfolio = () => (data()?.portfolio?.items?.length ?? 0) > 0;

	const ownerProfile = () => {
		const p = data()?.owner_profile;
		if (!p) return null;
		if (!p.user_id && !p.first_name) return null;
		return p;
	};

	const [copiedText, setCopiedText] = createSignal<string>('');
	const handleCopy = async (txt: string, key: string) => {
		if (!txt) return;
		await copyToClipboard(txt);
		setCopiedText(key);
		haptic.notify('success');
		setTimeout(() => setCopiedText(''), 2200);
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (!cardRef) return;
		const rect = cardRef.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		setTilt({
			x: (rect.height / 2 - y) / 10,
			y: (x - rect.width / 2) / 10,
			glossX: (x / rect.width) * 100,
			glossY: (y / rect.height) * 100,
		});
	};

	const handleMouseLeave = () => setTilt({ x: 0, y: 0, glossX: 50, glossY: 50 });

	const handleTouchMove = (e: TouchEvent) => {
		if (!cardRef || !e.touches || e.touches.length === 0) return;
		const touch = e.touches[0];
		const rect = cardRef.getBoundingClientRect();
		const x = touch.clientX - rect.left;
		const y = touch.clientY - rect.top;
		const clampedX = Math.max(0, Math.min(rect.width, x));
		const clampedY = Math.max(0, Math.min(rect.height, y));
		setTilt({
			x: (rect.height / 2 - clampedY) / 8,
			y: (clampedX - rect.width / 2) / 8,
			glossX: (clampedX / rect.width) * 100,
			glossY: (clampedY / rect.height) * 100,
		});
	};

	const handleTouchEnd = () => setTilt({ x: 0, y: 0, glossX: 50, glossY: 50 });

	const getFontSize = (name: string) => {
		const len = name.length;
		if (len <= 5) return '42px';
		if (len <= 8) return '34px';
		if (len <= 12) return '26px';
		return '20px';
	};

	const getTierTheme = (tier: string) => {
		const tStr = (tier || '').toLowerCase();
		if (tStr.includes('legendary') || tStr.includes('grail') || tStr.includes('god')) {
			return {
				wrapper:
					'from-[#ffaa00] via-[#ff7700] to-[#e65100] shadow-[0_20px_50px_rgba(255,119,0,0.35),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#ffaa00]/15 border-[#ffaa00]/40 text-[#ffaa00] shadow-[0_0_15px_rgba(255,170,0,0.25)]',
				text: 'from-[#ffeaa7] via-[#ffaa00] to-[#ff7700]',
				glow: 'rgba(255,119,0,0.3)',
			};
		}
		if (tStr.includes('epic') || tStr.includes('elite') || tStr.includes('apex')) {
			return {
				wrapper:
					'from-[#0098EA] via-[#0070BA] to-[#004B87] shadow-[0_20px_50px_rgba(0,152,234,0.35),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#0098EA]/15 border-[#0098EA]/40 text-[#0098EA] shadow-[0_0_15px_rgba(0,152,234,0.25)]',
				text: 'from-[#e0f2fe] via-[#38bdf8] to-[#0098EA]',
				glow: 'rgba(0,152,234,0.3)',
			};
		}
		if (tStr.includes('rare') || tStr.includes('premium') || tStr.includes('grand')) {
			return {
				wrapper:
					'from-[#10b981] via-[#059669] to-[#047857] shadow-[0_20px_50px_rgba(16,185,129,0.35),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.25)]',
				text: 'from-[#a7f3d0] via-[#10b981] to-[#059669]',
				glow: 'rgba(16,185,129,0.3)',
			};
		}
		return {
			wrapper:
				'from-[#64748b] via-[#475569] to-[#334155] shadow-[0_20px_50px_rgba(100,116,139,0.25),inset_0_2px_10px_rgba(255,255,255,0.15)]',
			badge: 'bg-[#64748b]/15 border-[#64748b]/40 text-[#cbd5e1]',
			text: 'from-white via-[#cbd5e1] to-[#64748b]',
			glow: 'rgba(255,255,255,0.1)',
		};
	};

	const triggerAlert = (msg: string) => {
		const tg = (window as any).Telegram?.WebApp;
		if (tg?.showAlert) {
			tg.showAlert(msg);
		}
	};

	const grantAccess = (
		method: 'free' | 'stars' | 'coins' | 'pro' | 'credit',
		targetUser: string,
	) => {
		try {
			localStorage.setItem(`val_access_${targetUser}`, method);
		} catch (_) {}
		setAccessMethod(method);
		setAccessGranted(true);
		setShowPaymentGate(false);
		setPaymentPending(false);
		fetchValuation(targetUser);
	};

	const applyReport = (res: ValuationResult, cached: boolean) => {
		setData(res);
		setFromCache(cached);
		setCacheExpiry(getCacheExpiry(res.username || username()));
		setRecents(getRecentReports());
	};

	const fetchValuation = async (u: string, opts: { force?: boolean } = {}) => {
		if (!u) return;

		if (!opts.force) {
			const cached = getCachedReport<ValuationResult>(u);
			// Ensure cached reports have our new 3-pillar categories; otherwise refresh live
			const hasModernCategories = cached?.similar?.some(
				(s) =>
					s.category === 'live_fragment' ||
					s.category === 'semantic' ||
					s.category === 'structural',
			);
			if (cached && hasModernCategories) {
				applyReport(cached, true);
				setLoading(false);
				return;
			}
		}

		if (opts.force) setRefreshing(true);
		else setLoading(true);
		setError(null);
		try {
			const res = await apiFetch<ValuationResult>(
				`/usernames/valuate?u=${encodeURIComponent(u)}${opts.force ? '&refresh=true' : ''}`,
			);
			if (res) {
				saveReport(u, res);
				applyReport(res, false);
			} else {
				setError(t('valuation.err_meta') || 'Failed to fetch metadata');
			}
		} catch (err: any) {
			if (err?.response?.status === 403 || err?.status === 403) {
				try {
					localStorage.removeItem(`val_access_${u}`);
				} catch (_) {}
				setAccessGranted(false);
				setAccessMethod(null);
				setShowPaymentGate(true);
				setError(null);
				return;
			}
			if (opts.force && data()) {
				triggerAlert(err?.message || t('valuation.err_server') || 'Refresh failed');
			} else {
				setError(err.message || t('valuation.err_server') || 'A server error occurred');
			}
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	const pollPaymentAccess = (targetUser: string, payload?: string, maxAttempts = 40) => {
		clearPaymentPolling();
		setPaymentPending(true);
		setPollingStatus(
			t('valuation.payment_pending_check') || 'Payment confirmation is processing on-chain...',
		);
		let attempts = 0;

		pollIntervalId = setInterval(async () => {
			attempts++;
			try {
				const statusRes = await valuationApi.checkOrderStatus({ payload, username: targetUser });
				if (statusRes.paid || statusRes.status === 'paid') {
					clearPaymentPolling();
					setPaymentPending(false);
					setPollingStatus('');
					haptic.notify('success');
					grantAccess('stars', targetUser);
					return;
				}
				if (statusRes.status === 'failed') {
					clearPaymentPolling();
					setPaymentPending(false);
					setPaymentError(t('valuation.payment_failed') || 'Payment failed. Please try again.');
					haptic.notify('error');
					return;
				}
			} catch (_) {}

			if (attempts >= maxAttempts) {
				clearPaymentPolling();
				setPaymentPending(false);
				setPaymentError(
					t('valuation.payment_timeout') ||
						'Payment verification timed out. Click below to check again.',
				);
			}
		}, 3000);
	};

	const handleUnlockWithCredit = async () => {
		const u = username();
		if (!u || isProcessingPayment() || paymentPending()) return;
		setIsProcessingPayment(true);
		setPaymentError('');
		try {
			await creditsApi.consumeCredit('username', u);
			haptic.notify('success');
			grantAccess('credit', u);
		} catch (e: any) {
			setPaymentError(
				e?.response?.data?.error ||
					e?.message ||
					t('valuation.payment_failed') ||
					'Failed to unlock valuation',
			);
			haptic.notify('error');
		} finally {
			setIsProcessingPayment(false);
		}
	};

	const handleSendToChat = async () => {
		if (!hiddenCardRef || downloading()) return;
		if (sendCount() >= 2) return triggerAlert(t('valuation.err_server') || 'Send limit reached.');
		setDownloading(true);
		setSent(false);
		try {
			haptic.impact('medium');
			const dataUrl = await toPng(hiddenCardRef, { width: 400, height: 400, pixelRatio: 3 });
			const res = await apiFetch<{ success: boolean }>('/usernames/send-to-chat', {
				method: 'POST',
				body: JSON.stringify({ image: dataUrl }),
				headers: { 'Content-Type': 'application/json' },
			});
			if (res?.success) {
				haptic.notify('success');
				setSent(true);
				setSendCount((c) => c + 1);
				setTimeout(() => setSent(false), 3000);
			}
		} catch {
			triggerAlert(t('valuation.err_server') || 'Failed to send.');
		} finally {
			setDownloading(false);
		}
	};

	const handleShareToStory = async () => {
		const u = data()?.username || username();
		if (!u || !hiddenCardRef || sharing()) return;
		setSharing(true);
		try {
			haptic.impact('medium');
			const dataUrl = await toPng(hiddenCardRef, { width: 400, height: 400, pixelRatio: 3 });
			const res = await apiFetch<{ url: string }>('/usernames/share', {
				method: 'POST',
				body: JSON.stringify({ image: dataUrl }),
				headers: { 'Content-Type': 'application/json' },
			});
			if (res?.url) {
				shareToStory(res.url, {
					text: `Check out the on-chain valuation of @${u} on iFragment! 💎`,
					widget_link: {
						url: `https://t.me/iFragmentBot/iFragment?startapp=val_${u}`,
						name: 'iFragment',
					},
				});
			}
		} catch {
		} finally {
			setSharing(false);
		}
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			haptic.impact('light');
			window.history.back();
		});
		onCleanup(() => {
			off();
			backButton.hide();
		});
	});

	const fetchVerification = async (target: string) => {
		if (!target) return;
		setVerifyingOnChain(true);
		try {
			const res = await apiFetch<UsernameVerificationResult>(
				`/usernames/verify?u=${encodeURIComponent(target.replace(/^@/, ''))}`,
			);
			if (res) {
				setVerificationData(res);
			}
		} catch (_) {
		} finally {
			setVerifyingOnChain(false);
		}
	};

	createEffect(() => {
		const initValuation = async () => {
			const u = username();
			setRecents(getRecentReports());
			if (!u) {
				setLoading(false);
				setData(null);
				setError(null);
				setAccessGranted(false);
				setVerificationData(null);
				return;
			}

			setSearchTerm(u);
			setQuickQuery(u);
			fetchVerification(u);

			const cachedAccess = localStorage.getItem(`val_access_${u}`);
			const cached = getCachedReport<ValuationResult>(u);
			const hasModernCategories =
				Boolean(cached?.binary_forensics) &&
				Boolean(cached?.fragment_capabilities) &&
				Boolean(
					cached?.similar?.some(
						(s) =>
							s.category === 'live_fragment' ||
							s.category === 'semantic' ||
							s.category === 'structural',
					),
				);

			if (cached && cachedAccess && hasModernCategories) {
				setAccessMethod(cachedAccess as any);
				setAccessGranted(true);
				setShowPaymentGate(false);
				applyReport(cached, true);
				setLoading(false);
				return;
			}

			setLoading(true);
			setError(null);

			if (localStorage.getItem('val_free_used') === 'true') setFreeQuotaUsed(true);
			else {
				cloudStorage.getItem('val_free_used').then((val) => {
					if (val === 'true') {
						setFreeQuotaUsed(true);
						localStorage.setItem('val_free_used', 'true');
					}
				});
			}

			try {
				const res = await valuationApi.checkAccess(u);
				if (res?.is_pro) {
					setIsPro(true);
					if (res.daily_used !== undefined) setDailyUsed(res.daily_used);
				}
				if (res?.free_quota_used) {
					localStorage.setItem('val_free_used', 'true');
					cloudStorage.setItem('val_free_used', 'true');
				}
				if (res?.has_access) {
					const method = res.method || (res.is_pro ? 'pro' : 'stars');
					try {
						localStorage.setItem(`val_access_${u}`, method);
					} catch (_) {}
					setAccessGranted(true);
					setAccessMethod(method as any);
					setShowPaymentGate(false);
					fetchValuation(u, { force: !hasModernCategories });
				} else {
					try {
						localStorage.removeItem(`val_access_${u}`);
					} catch (_) {}
					setAccessGranted(false);
					setAccessMethod(null);
					setShowPaymentGate(true);
					setLoading(false);
				}
			} catch (_) {
				try {
					localStorage.removeItem(`val_access_${u}`);
				} catch (_) {}
				setShowPaymentGate(true);
				setLoading(false);
			}
		};
		initValuation();
	});

	// Derived metrics
	const expectedTon = () => parseFloat(data()?.expected_ton || '0');
	const lowTon = () => parseFloat(data()?.low_ton || '0');
	const highTon = () => parseFloat(data()?.high_ton || '0');

	const bandPosition = (value: number) => {
		const lo = lowTon();
		const hi = highTon();
		if (!(hi > lo) || !(value > 0)) return 50;
		return Math.min(96, Math.max(4, ((value - lo) / (hi - lo)) * 100));
	};

	const confidenceTheme = () => {
		const score = data()?.confidence_score ?? 0;
		if (score >= 80)
			return { color: '#10b981', label: t('valuation.conf_high') || 'HIGH CONFIDENCE' };
		if (score >= 60)
			return { color: '#0098EA', label: t('valuation.conf_medium') || 'MODERATE CONFIDENCE' };
		if (score >= 45)
			return { color: '#f59e0b', label: t('valuation.conf_low') || 'LOW CONFIDENCE' };
		return { color: '#ff4a4a', label: t('valuation.conf_thin') || 'THIN DATA' };
	};

	const fmtTon = (value?: number | null) =>
		(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
	const fmtUsd = (value?: number | null) =>
		(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

	const similarCounts = createMemo(() => {
		const list = data()?.similar || [];
		return {
			all: list.length,
			live_fragment: list.filter((i) => i.category === 'live_fragment').length,
			semantic: list.filter(
				(i) =>
					i.category === 'semantic' ||
					(i.reason || '').toLowerCase().includes('semantic') ||
					(i.reason || '').toLowerCase().includes('synonym') ||
					(i.reason || '').toLowerCase().includes('category'),
			).length,
			structural: list.filter(
				(i) =>
					i.category === 'structural' ||
					(i.reason || '').toLowerCase().includes('char') ||
					(i.reason || '').toLowerCase().includes('length'),
			).length,
		};
	});

	const filteredSimilar = createMemo(() => {
		const list = data()?.similar || [];
		const f = similarFilter();
		if (f === 'live_fragment') {
			return list.filter((i) => i.category === 'live_fragment');
		}
		if (f === 'semantic') {
			return list.filter(
				(i) =>
					i.category === 'semantic' ||
					(i.reason || '').toLowerCase().includes('semantic') ||
					(i.reason || '').toLowerCase().includes('synonym') ||
					(i.reason || '').toLowerCase().includes('category'),
			);
		}
		if (f === 'structural') {
			return list.filter(
				(i) =>
					i.category === 'structural' ||
					(i.reason || '').toLowerCase().includes('char') ||
					(i.reason || '').toLowerCase().includes('length'),
			);
		}
		return list;
	});

	const liveMarketBadge = () => {
		const st = (data()?.live_market?.status || data()?.status || '').toLowerCase();
		if (st === 'on_auction') {
			return {
				label: tr('در حراج زنده فرگمنت', 'ON AUCTION (FRAGMENT)', 'НА АУКЦИОНЕ', '拍卖中'),
				class: 'bg-amber-400/15 border-amber-400/40 text-amber-400',
				dot: 'bg-amber-400 animate-ping',
			};
		}
		if (st === 'on_sale') {
			return {
				label: tr('آگهی فروش در فرگمنت', 'FOR SALE (FRAGMENT)', 'В ПРОДАЖЕ', '固定价在售'),
				class: 'bg-[#0098EA]/15 border-[#0098EA]/40 text-[#0098EA]',
				dot: 'bg-[#0098EA] animate-pulse',
			};
		}
		if (st === 'sold') {
			return {
				label: tr('فروخته شده (NFT)', 'SOLD TELEMINT NFT', 'ПРОДАН (NFT)', '已售出 NFT'),
				class: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
				dot: 'bg-emerald-400',
			};
		}
		if (st === 'available') {
			return {
				label: tr('آزاد برای ثبت / حراج', 'AVAILABLE ON FRAGMENT', 'ДОСТУПЕН', '可铸造'),
				class: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
				dot: 'bg-cyan-400',
			};
		}
		return {
			label: tr('فعال در تلگرام', 'TAKEN / ACTIVE', 'ЗАНЯТ', '已激活'),
			class: 'bg-white/10 border-white/20 text-white/70',
			dot: 'bg-white/50',
		};
	};

	return (
		<Show
			when={!loading()}
			fallback={
				<div class="flex flex-col justify-center items-center h-screen bg-[#030303] text-white/60 gap-5 relative overflow-hidden">
					<div class="absolute inset-0 bg-gradient-to-b from-[#0098EA]/15 to-transparent blur-[120px]" />
					<div class="relative flex items-center justify-center w-20 h-20">
						<div class="absolute w-full h-full border-[3px] border-white/5 border-t-[#0098EA] rounded-full animate-spin shadow-[0_0_20px_rgba(0,152,234,0.6)]" />
						<span class="material-symbols-outlined text-[24px] text-[#0098EA] animate-pulse">
							radar
						</span>
					</div>
					<div class="flex flex-col items-center gap-1">
						<span class="text-[13px] font-black tracking-[4px] uppercase text-[#0098EA] animate-pulse">
							{t('valuation.analyzing') || 'DECRYPTING'}
						</span>
						<span class="text-[10px] font-mono font-bold text-white/40 tracking-widest">
							{t('valuation.onChainIntel')}
						</span>
					</div>
				</div>
			}
		>
			<Show
				when={!error()}
				fallback={
					<div class="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
						<div class="absolute inset-0 bg-gradient-to-b from-[#ff4a4a]/15 to-transparent blur-[120px]" />
						<div class="w-24 h-24 rounded-[24px] bg-[#ff4a4a]/10 flex items-center justify-center mb-6 border border-[#ff4a4a]/30 shadow-[0_0_30px_rgba(255,74,74,0.2)] z-10">
							<span class="material-symbols-outlined text-[48px] text-[#ff4a4a] drop-shadow-md">
								gpp_bad
							</span>
						</div>
						<h1 class="text-[22px] font-black mb-2 tracking-tight z-10 font-mono">
							{t('valuation.error_title') || 'INTELLIGENCE FAILED'}
						</h1>
						<p class="text-[13px] text-white/50 leading-relaxed mb-8 max-w-[280px] font-medium z-10">
							{error()}
						</p>
						<button
							type="button"
							onClick={() => window.history.back()}
							class="h-14 px-10 bg-[#12141C]/80 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest text-[13px] rounded-[16px] transition-all active:scale-95 shadow-sm z-10 backdrop-blur-md"
						>
							{t('valuation.back') || 'RETURN TO BASE'}
						</button>
					</div>
				}
			>
				<div
					class="min-h-screen bg-[#030303] text-white px-4 py-4 flex flex-col items-center font-sans pb-32 select-none relative overflow-x-hidden overflow-y-auto w-full"
					style={{ 'touch-action': 'pan-y' }}
					dir={isRtl() ? 'rtl' : 'ltr'}
				>
					{/* Ambient Dynamic Background */}
					<div
						class="fixed top-0 left-1/2 -translate-x-1/2 w-[150vw] h-[500px] blur-[120px] pointer-events-none z-0 opacity-35 transition-colors duration-1000"
						style={{
							background: `radial-gradient(circle, ${
								accessGranted()
									? getTierTheme(data()?.rarity?.tier || '').glow
									: 'rgba(0,152,234,0.25)'
							} 0%, transparent 60%)`,
						}}
					/>

					<div class="w-full max-w-[440px] flex flex-col items-center gap-3.5 relative z-10">
						<Show
							when={username()}
							fallback={
								/* ═══════ MODE A: USERNAME DISCOVERY & VALUATION HUB ═══════ */
								<div class="w-full max-w-[440px] flex flex-col items-center gap-4 relative z-10 pt-2 pb-12">
									<div class="w-full flex flex-col items-center text-center gap-2">
										<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0098EA]/10 border border-[#0098EA]/30 text-[#0098EA] text-[11px] font-mono font-black tracking-widest uppercase shadow-[0_0_15px_rgba(0,152,234,0.2)]">
											<span class="w-2 h-2 rounded-full bg-[#0098EA] animate-ping" />
											<span>TEP-62 TELEMINT · AVM v7.0</span>
										</div>
										<h1 class="text-[26px] font-black tracking-tight text-white font-mono drop-shadow-md">
											{layaT(USERNAME_I18N.radarTitle)}
										</h1>
										<p class="text-[12px] text-white/60 font-medium max-w-[320px] leading-relaxed">
											{layaT(USERNAME_I18N.radarDesc)}
										</p>
									</div>

									{/* Interactive Cyber Search Input */}
									<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col gap-3.5 shadow-2xl relative overflow-hidden text-start">
										<div class="absolute inset-0 bg-gradient-to-br from-[#0098EA]/5 via-transparent to-emerald-500/5 pointer-events-none" />

										<div class="flex items-center justify-between text-[11px] font-mono font-bold text-white/50 px-1">
											<span>{layaT(USERNAME_I18N.searchHandle)}</span>
											<Show when={searchTerm().length > 0}>
												<span
													class={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
														searchTerm().length < 4
															? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
															: searchTerm().length === 4
																? 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
																: 'bg-emerald-400/15 text-emerald-400 border border-emerald-400/30'
													}`}
												>
													{searchTerm().length} {layaT(USERNAME_I18N.charsLabel)} ·{' '}
													{searchTerm().length < 4
														? layaT(USERNAME_I18N.charShort)
														: searchTerm().length === 4
															? layaT(USERNAME_I18N.charGrail)
															: layaT(USERNAME_I18N.charStandard)}
												</span>
											</Show>
										</div>

										<div class="relative flex items-center w-full">
											<span class="absolute left-4 text-[22px] font-mono font-bold text-white/30 select-none pointer-events-none">
												@
											</span>
											<input
												type="text"
												value={searchTerm()}
												onInput={(e) =>
													setSearchTerm(
														e.currentTarget.value.replace(/^@/, '').toLowerCase().trim(),
													)
												}
												onKeyDown={(e) => {
													if (e.key === 'Enter' && searchTerm().length >= 4) {
														openReport(searchTerm());
													}
												}}
												placeholder={layaT(USERNAME_I18N.inputPlaceholder)}
												class="w-full h-14 bg-[#08090D] border border-white/10 focus:border-[#0098EA]/70 rounded-[18px] pl-10 pr-10 text-white font-mono font-bold text-[16px] tracking-wide placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[#0098EA]/30 transition-all shadow-inner"
												dir="ltr"
											/>
											<Show when={searchTerm().length > 0}>
												<button
													type="button"
													onClick={() => setSearchTerm('')}
													class="absolute right-3.5 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-colors"
												>
													<span class="material-symbols-outlined text-[16px]">close</span>
												</button>
											</Show>
										</div>

										<div class="grid grid-cols-2 gap-2.5 pt-1">
											<button
												type="button"
												disabled={searchTerm().length < 4}
												onClick={() => openReport(searchTerm())}
												class="h-12 rounded-[16px] bg-gradient-to-r from-[#0098EA] to-[#0070BA] hover:from-[#00a6ff] hover:to-[#0080d0] disabled:opacity-40 disabled:pointer-events-none text-white font-mono font-black text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(0,152,234,0.4)] active:scale-[0.98] transition-all"
											>
												<span class="material-symbols-outlined text-[18px]">query_stats</span>
												<span>{layaT(USERNAME_I18N.btnValuate)}</span>
											</button>
											<button
												type="button"
												disabled={searchTerm().length < 4 || verifyingOnChain()}
												onClick={() => fetchVerification(searchTerm())}
												class="h-12 rounded-[16px] bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none border border-white/10 hover:border-white/20 text-white font-mono font-bold text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
											>
												<span
													class={`material-symbols-outlined text-[18px] text-cyan-400 ${verifyingOnChain() ? 'animate-spin' : ''}`}
												>
													{verifyingOnChain() ? 'sync' : 'verified'}
												</span>
												<span>{layaT(USERNAME_I18N.btnVerifyOnChain)}</span>
											</button>
										</div>
									</div>

									{/* On-Chain Instant Verification Box */}
									<Show when={verificationData()}>
										{(ver) => (
											<div class="w-full bg-[#12141C]/95 backdrop-blur-2xl border border-emerald-500/30 rounded-[24px] p-4 flex flex-col gap-3 shadow-xl text-start">
												<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
													<div class="flex items-center gap-2">
														<span
															class={`material-symbols-outlined text-[18px] ${
																ver().is_minted_nft && ver().collection_verified
																	? 'text-emerald-400'
																	: 'text-amber-400'
															}`}
														>
															{ver().is_minted_nft && ver().collection_verified
																? 'verified'
																: 'info'}
														</span>
														<span class="text-[13px] font-black font-mono text-white" dir="ltr">
															@{ver().username}
														</span>
													</div>
													<span
														class={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-[6px] border ${
															ver().is_minted_nft && ver().collection_verified
																? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
																: 'bg-amber-400/15 border-amber-400/30 text-amber-400'
														}`}
													>
														{ver().is_minted_nft && ver().collection_verified
															? layaT(USERNAME_I18N.statusTelemint)
															: layaT(USERNAME_I18N.statusNotTokenized)}
													</span>
												</div>

												<div class="flex flex-col gap-1.5 text-[11px] font-mono text-white/70">
													<div class="flex justify-between items-center">
														<span class="text-white/40">{layaT(USERNAME_I18N.telegramStatus)}</span>
														<span class="text-white font-bold">{ver().telegram_status}</span>
													</div>
													<Show when={ver().telemint_provenance?.item_address}>
														<div class="flex justify-between items-center">
															<span class="text-white/40">{layaT(USERNAME_I18N.itemContract)}</span>
															<a
																href={`https://tonviewer.com/${ver().telemint_provenance.item_address}`}
																target="_blank"
																rel="noreferrer"
																class="text-[#0098EA] hover:underline"
																dir="ltr"
															>
																{ver().telemint_provenance.item_address!.slice(0, 6)}...
																{ver().telemint_provenance.item_address!.slice(-4)} ↗
															</a>
														</div>
													</Show>
												</div>

												<button
													type="button"
													onClick={() => openReport(ver().username)}
													class="w-full h-10 rounded-[14px] bg-[#0098EA]/20 hover:bg-[#0098EA]/30 border border-[#0098EA]/40 text-[#0098EA] font-mono font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all mt-1"
												>
													<span>{layaT(USERNAME_I18N.viewFullReport)}</span>
													<span class="material-symbols-outlined text-[15px]">arrow_forward</span>
												</button>
											</div>
										)}
									</Show>

									{/* Curated Trending Handles */}
									<div class="w-full flex flex-col gap-2.5 text-start">
										<div class="flex items-center justify-between px-1">
											<span class="text-[11px] font-mono font-black text-white/50 uppercase tracking-wider flex items-center gap-1.5">
												<span class="material-symbols-outlined text-[16px] text-amber-400">
													local_fire_department
												</span>
												{layaT(USERNAME_I18N.trendingHandles)}
											</span>
											<span class="text-[10px] font-mono text-white/30">
												{layaT(USERNAME_I18N.tapToInspect)}
											</span>
										</div>
										<div class="flex flex-wrap gap-2">
											<For
												each={[
													'news',
													'durov',
													'bank',
													'crypto',
													'rolex',
													'sara',
													'rare',
													'auto',
													'gift',
													'king',
													'doge',
												]}
											>
												{(h) => (
													<button
														type="button"
														onClick={() => openReport(h)}
														class="px-3 py-2 rounded-[14px] bg-white/[0.04] hover:bg-[#0098EA]/15 border border-white/10 hover:border-[#0098EA]/40 text-white/80 hover:text-white font-mono font-bold text-[12px] transition-all active:scale-95 flex items-center gap-1 shadow-sm"
														dir="ltr"
													>
														<span class="text-[#0098EA]">@</span>
														<span>{h}</span>
													</button>
												)}
											</For>
										</div>
									</div>

									<LayaCategoriesExplorer onSelectHandle={(h) => openReport(h)} />

									<Show when={recents().length > 0}>
										<div class="w-full flex flex-col gap-2.5 text-start">
											<div class="flex items-center justify-between px-1">
												<span class="text-[11px] font-mono font-black text-white/50 uppercase tracking-wider flex items-center gap-1.5">
													<span class="material-symbols-outlined text-[16px] text-[#0098EA]">
														history
													</span>
													{layaT(USERNAME_I18N.recentAudits)}
												</span>
												<span class="text-[10px] font-mono text-white/30">
													{recents().length} {layaT(USERNAME_I18N.itemsCount)}
												</span>
											</div>
											<div class="grid grid-cols-1 xs:grid-cols-2 gap-2 w-full">
												<For each={recents().slice(0, 6)}>
													{(rep) => (
														<button
															type="button"
															onClick={() => openReport(rep.username)}
															class="p-3 rounded-[16px] bg-[#08090D] hover:bg-white/[0.04] border border-white/5 hover:border-[#0098EA]/30 transition-all text-start flex items-center justify-between gap-2 active:scale-95"
														>
															<div class="flex flex-col min-w-0">
																<span
																	class="text-white font-mono font-bold text-[13px] truncate"
																	dir="ltr"
																>
																	@{rep.username}
																</span>
																<span class="text-white/40 text-[10px] font-mono">
																	{new Date(rep.savedAt).toLocaleDateString()}
																</span>
															</div>
															<div class="flex flex-col items-end shrink-0">
																<span class="text-emerald-400 font-mono font-black text-[12px]">
																	{rep.expectedTon
																		? `${fmtTon(parseFloat(rep.expectedTon))} TON`
																		: 'View'}
																</span>
																<span class="text-[9px] font-black uppercase text-[#0098EA] bg-[#0098EA]/10 px-1.5 py-0.5 rounded">
																	{rep.tier || 'STANDARD'}
																</span>
															</div>
														</button>
													)}
												</For>
											</div>
										</div>
									</Show>
								</div>
							}
						>
							{/* ═══════ STICKY REPORT HEADER & QUICK SWITCH BAR ═══════ */}
							<div class="w-full bg-[#12141C]/95 backdrop-blur-2xl border border-white/10 rounded-[22px] p-3 flex flex-col gap-2.5 shadow-xl">
								<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-2.5 min-w-0">
										<Show
											when={data()?.telemint_provenance?.is_authentic}
											fallback={
												<div class="w-10 h-10 rounded-[14px] bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center text-[#0098EA] font-mono font-black text-[18px] shrink-0">
													@
												</div>
											}
										>
											<img
												src={`https://nft.fragment.com/username/${username()}.webp`}
												alt={`@${username()}`}
												class="w-10 h-10 rounded-[14px] object-cover border border-white/15 shrink-0 bg-[#08090D]"
												onError={(e) => {
													e.currentTarget.style.display = 'none';
												}}
											/>
										</Show>
										<div class="flex flex-col text-start min-w-0">
											<div class="flex items-center gap-1.5">
												<span
													class="text-[16px] font-mono font-black text-white truncate"
													dir="ltr"
												>
													@{data()?.username || username()}
												</span>
												<Show when={data()?.telemint_provenance?.is_authentic}>
													<span
														class="material-symbols-outlined text-[16px] text-[#0098EA] shrink-0"
														title="Official TeleMint NFT"
													>
														verified
													</span>
												</Show>
											</div>
											<div class="flex items-center gap-1.5">
												<span class={`w-1.5 h-1.5 rounded-full ${liveMarketBadge().dot}`} />
												<span class="text-[10px] font-mono font-bold text-white/60 truncate">
													{liveMarketBadge().label}
												</span>
											</div>
										</div>
									</div>

									<div class="flex items-center gap-1.5 shrink-0">
										<button
											type="button"
											onClick={() => setShowQuickSearch((prev) => !prev)}
											class="h-9 px-3 rounded-[12px] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white flex items-center gap-1 text-[11px] font-mono font-bold transition-all active:scale-95"
										>
											<span class="material-symbols-outlined text-[16px] text-[#0098EA]">
												search
											</span>
											<span>{tr('جستجوی شناسه', 'Search', 'Поиск', '搜索')}</span>
										</button>
										<Show when={accessGranted()}>
											<button
												type="button"
												disabled={refreshing()}
												onClick={() => fetchValuation(username(), { force: true })}
												class="w-9 h-9 rounded-[12px] bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-95"
												title="Refresh Live Data"
											>
												<span
													class={`material-symbols-outlined text-[17px] ${refreshing() ? 'animate-spin text-[#0098EA]' : ''}`}
												>
													refresh
												</span>
											</button>
										</Show>
									</div>
								</div>

								{/* Collapsible Quick Search Input */}
								<Show when={showQuickSearch()}>
									<div class="flex items-center gap-2 pt-2 border-t border-white/5">
										<div class="relative flex-1">
											<span class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 font-mono font-bold text-[14px]">
												@
											</span>
											<input
												type="text"
												value={quickQuery()}
												onInput={(e) =>
													setQuickQuery(
														e.currentTarget.value.replace(/^@/, '').toLowerCase().trim(),
													)
												}
												onKeyDown={(e) => {
													if (e.key === 'Enter' && quickQuery().length >= 4) {
														openReport(quickQuery());
													}
												}}
												placeholder={tr(
													'نام کاربری جدید (مثلاً news یا rolex)',
													'Enter another handle...',
													'Введите другой юзернейм...',
													'输入其他用户名...',
												)}
												class="w-full h-10 bg-[#08090D] border border-white/10 focus:border-[#0098EA] rounded-[12px] pl-7 pr-3 text-white font-mono font-bold text-[13px] focus:outline-none"
												dir="ltr"
											/>
										</div>
										<button
											type="button"
											disabled={quickQuery().length < 4}
											onClick={() => openReport(quickQuery())}
											class="h-10 px-4 rounded-[12px] bg-[#0098EA] hover:bg-[#0086cf] disabled:opacity-40 text-white font-mono font-black text-[11px] uppercase tracking-wider shrink-0"
										>
											{tr('بررسی', 'GO', 'ПЕРЕЙТИ', '查询')}
										</button>
									</div>
								</Show>
							</div>

							{/* ═══════ UNLOCKED vs PAYWALL GATE ═══════ */}
							<Show
								when={accessGranted() && data()}
								fallback={
									<div class="w-full max-w-[440px] mx-auto my-1 flex flex-col gap-3 relative z-20">
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col items-center text-center relative overflow-hidden shadow-2xl">
											<div class="absolute inset-0 bg-gradient-to-br from-[#0098EA]/10 via-transparent to-emerald-500/10 pointer-events-none" />

											<div class="flex items-center gap-2 mb-2 z-10">
												<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
												<span class="text-[11px] font-mono font-black uppercase tracking-widest text-emerald-400">
													{t('valuation.report_ready') || 'APPRAISAL READY'}
												</span>
											</div>

											<h3
												class="text-[26px] font-black text-white font-mono tracking-tight drop-shadow-md z-10"
												dir="ltr"
											>
												@{username()}
											</h3>

											<Show when={verificationData()}>
												{(ver) => (
													<div class="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-white/70 z-10 my-1">
														<span
															class={`w-2 h-2 rounded-full ${ver().is_minted_nft ? 'bg-emerald-400' : 'bg-amber-400'}`}
														/>
														<span class="font-bold">
															{ver().is_minted_nft ? 'TELEMINT NFT (ON-CHAIN)' : 'UNMINTED HANDLE'}
														</span>
														<span class="text-white/30">|</span>
														<span class="capitalize">{ver().telegram_status}</span>
													</div>
												)}
											</Show>

											<div class="w-full bg-white/5 border border-white/10 rounded-[20px] p-4 flex flex-col items-center justify-center my-3 relative overflow-hidden backdrop-blur-md z-10 shadow-inner">
												<span class="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">
													{t('valuation.estimated_price') || 'ESTIMATED FAIR VALUE'}
												</span>
												<div class="flex items-center gap-2 filter blur-[6px] select-none opacity-80">
													<span class="text-[26px] font-black text-white font-mono">✦✦,✦✦✦</span>
													<span class="text-[16px] font-bold text-[#0098EA]">TON</span>
												</div>
												<span class="text-[10px] text-white/40 font-mono filter blur-[3px] mt-0.5">
													≈ $✦✦✦,✦✦✦ USD
												</span>

												<div class="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
													<span class="px-3.5 py-1.5 rounded-[12px] bg-[#0098EA]/20 border border-[#0098EA]/50 text-[#0098EA] text-[11px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
														<span class="material-symbols-outlined text-[15px]">lock</span>
														{t('valuation.locked_tap_to_decrypt') || 'DECRYPT REPORT'}
													</span>
												</div>
											</div>
										</div>

										<UnifiedPaywallGate
											vertical="username"
											targetTitle={`@${username()}`}
											targetIcon="alternate_email"
											targetBadge={t('paywall.ready_for_appraisal')}
											unlockCtaText={t('paywall.cta_unlock_specific', { target: `@${username()}` })}
											onUnlock={handleUnlockWithCredit}
											unlocking={isProcessingPayment() || loading()}
											error={paymentError()}
											lastOrderPayload={lastOrderPayload()}
											paymentPending={paymentPending()}
											pollingStatus={pollingStatus()}
											onCheckPaymentStatus={() =>
												pollPaymentAccess(username(), lastOrderPayload(), 5)
											}
										/>
									</div>
								}
							>
								{/* ═══════ 4-TAB SEGMENTED NAVIGATION BAR ═══════ */}
								<div class="w-full grid grid-cols-4 gap-1.5 p-1.5 rounded-[20px] bg-[#12141C]/95 border border-white/10 shadow-lg sticky top-2 z-30 backdrop-blur-2xl">
									<button
										type="button"
										onClick={() => {
											haptic.impact('light');
											setActiveTab('valuation');
										}}
										class={`py-2.5 px-1.5 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all ${
											activeTab() === 'valuation'
												? 'bg-[#0098EA] text-white shadow-[0_4px_15px_rgba(0,152,234,0.35)]'
												: 'text-white/50 hover:text-white hover:bg-white/5'
										}`}
									>
										<span class="material-symbols-outlined text-[18px]">diamond</span>
										<span class="text-[10px] font-black leading-none truncate max-w-full">
											{tr('ارزش‌گذاری', 'Valuation', 'Оценка', '估值与市场')}
										</span>
									</button>

									<button
										type="button"
										onClick={() => {
											haptic.impact('light');
											setActiveTab('onchain');
										}}
										class={`py-2.5 px-1.5 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all ${
											activeTab() === 'onchain'
												? 'bg-[#0098EA] text-white shadow-[0_4px_15px_rgba(0,152,234,0.35)]'
												: 'text-white/50 hover:text-white hover:bg-white/5'
										}`}
									>
										<span class="material-symbols-outlined text-[18px]">
											account_balance_wallet
										</span>
										<span class="text-[10px] font-black leading-none truncate max-w-full">
											{tr('زنجیره و نهنگ', 'On-Chain', 'Ончейн', '链上与巨鲸')}
										</span>
									</button>

									<button
										type="button"
										onClick={() => {
											haptic.impact('light');
											setActiveTab('similar');
										}}
										class={`py-2.5 px-1.5 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all relative ${
											activeTab() === 'similar'
												? 'bg-[#0098EA] text-white shadow-[0_4px_15px_rgba(0,152,234,0.35)]'
												: 'text-white/50 hover:text-white hover:bg-white/5'
										}`}
									>
										<span class="material-symbols-outlined text-[18px]">hub</span>
										<span class="text-[10px] font-black leading-none truncate max-w-full">
											{tr('موارد مشابه', 'Similar', 'Похожие', '相似对比')}
										</span>
									</button>

									<button
										type="button"
										onClick={() => {
											haptic.impact('light');
											setActiveTab('anatomy');
										}}
										class={`py-2.5 px-1.5 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all ${
											activeTab() === 'anatomy'
												? 'bg-[#0098EA] text-white shadow-[0_4px_15px_rgba(0,152,234,0.35)]'
												: 'text-white/50 hover:text-white hover:bg-white/5'
										}`}
									>
										<span class="material-symbols-outlined text-[18px]">psychology</span>
										<span class="text-[10px] font-black leading-none truncate max-w-full">
											{tr('کالبدشکافی', 'Anatomy', 'Анатомия', '结构与合规')}
										</span>
									</button>
								</div>

								{/* ════════════════════════════════════════════════════════════════
								    TAB 1: VALUATION & LIVE MARKET SIGNAL
								    ════════════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'valuation'}>
									<div class="w-full flex flex-col gap-3.5">
										{/* 3D Interactive Certificate Card */}
										<div
											class={`w-full aspect-square p-[3px] bg-gradient-to-br ${
												getTierTheme(data()?.rarity?.tier || '').wrapper
											} rounded-[44px] relative z-20 transition-all duration-300`}
										>
											<div
												ref={cardRef}
												onMouseMove={handleMouseMove}
												onMouseLeave={handleMouseLeave}
												onTouchMove={handleTouchMove}
												onTouchEnd={handleTouchEnd}
												onTouchCancel={handleTouchEnd}
												class="w-full h-full bg-[#08090D] rounded-[41px] p-7 relative overflow-hidden flex flex-col justify-between shadow-inner"
												style={{
													transform: `perspective(1200px) rotateX(${tilt().x}deg) rotateY(${tilt().y}deg)`,
													'background-image':
														'radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px)',
													'background-size': '24px 24px',
													transition: 'transform 0.1s ease-out',
												}}
											>
												<div
													class="absolute inset-0 pointer-events-none z-20 mix-blend-overlay transition-opacity duration-300 opacity-80"
													style={{
														background: `radial-gradient(circle at ${tilt().glossX}% ${
															tilt().glossY
														}%, rgba(255,255,255,0.38) 0%, transparent 60%)`,
													}}
												/>

												<div class="flex justify-between items-center z-10">
													<span
														class={`px-3.5 py-1.5 border rounded-[12px] text-[10px] font-black tracking-widest uppercase shadow-sm ${
															getTierTheme(data()?.rarity?.tier || '').badge
														}`}
													>
														{data()?.rarity?.tier || 'STANDARD'}
													</span>
													<span class="text-[10px] font-mono font-black text-white/40 tracking-[3px] uppercase bg-white/5 border border-white/10 px-3 py-1.5 rounded-[12px]">
														{data()?.model_version || 'AVM v7.0'}
													</span>
												</div>

												<div class="flex flex-col justify-center items-center z-10 text-center flex-grow relative py-4 w-full gap-2">
													<div
														class="absolute w-full h-[150px] opacity-65 -z-10 pointer-events-none mix-blend-screen"
														style={{
															background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${
																getTierTheme(data()?.rarity?.tier || '').glow
															}, transparent 70%)`,
														}}
													/>
													<div class="flex items-center justify-center gap-2 w-full">
														<span class="text-white/20 font-black text-[24px] select-none">✦</span>
														<span
															class="inline-block font-black tracking-tighter text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] truncate max-w-[78%] pb-1"
															style={{ 'font-size': getFontSize(data()?.username || username()) }}
															dir="ltr"
														>
															@{data()?.username || username()}
														</span>
														<span class="text-white/20 font-black text-[24px] select-none">✦</span>
													</div>
													<div class="flex flex-wrap items-center justify-center gap-1.5 max-w-[90%]">
														<For each={(data()?.tags || []).slice(0, 4)}>
															{(tag) => (
																<span class="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[9px] font-mono font-bold text-white/70">
																	{tag}
																</span>
															)}
														</For>
													</div>
												</div>

												<div class="flex justify-between items-end border-t border-white/10 pt-4 z-10">
													<div class="flex flex-col gap-1 text-left">
														<span class="text-[9px] font-black text-white/40 uppercase tracking-widest">
															{t('valuation.estimated_price') || 'ESTIMATED FAIR VALUE'}
														</span>
														<div class="flex items-center gap-2">
															<span class="text-[32px] font-black text-white font-mono leading-none tracking-tight">
																{fmtTon(expectedTon())}
															</span>
															<span class="text-[14px] font-black text-[#0098EA] leading-none">
																TON
															</span>
														</div>
													</div>
													<div class="flex flex-col items-end gap-1.5">
														<div class="flex items-center gap-1.5 bg-[#10b981]/15 px-2.5 py-1 rounded-[9px] border border-[#10b981]/40 text-[#10b981] font-black uppercase tracking-widest text-[9px]">
															<div class="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse" />
															<span>
																{data()?.quality_grade || 'AA+'} · {data()?.confidence_score}%
															</span>
														</div>
														<span class="text-[13px] text-white/70 font-black leading-none font-mono">
															≈ ${fmtUsd(parseFloat(data()?.expected_usd || '0'))}
														</span>
													</div>
												</div>
											</div>
										</div>

										{/* Share Certificate Actions */}
										<div class="w-full grid grid-cols-2 gap-2.5">
											<button
												type="button"
												onClick={handleShareToStory}
												disabled={sharing()}
												class="h-11 bg-[#0098EA] hover:bg-[#0086cf] text-white font-black text-[11px] uppercase tracking-wider rounded-[16px] flex items-center justify-center gap-1.5 shadow-[0_6px_20px_rgba(0,152,234,0.3)] active:scale-95 transition-all"
											>
												<span class="material-symbols-outlined text-[17px]">auto_awesome</span>
												<span>
													{sharing()
														? tr('در حال ساخت...', 'Preparing...')
														: tr('اشتراک در استوری', 'Share Story')}
												</span>
											</button>
											<button
												type="button"
												onClick={handleSendToChat}
												disabled={downloading() || sent()}
												class="h-11 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-[11px] uppercase tracking-wider rounded-[16px] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
											>
												<span class="material-symbols-outlined text-[17px]">
													{sent() ? 'check' : 'send'}
												</span>
												<span>
													{sent()
														? tr('ارسال شد', 'Sent')
														: tr('ارسال کارت به چت', 'Send Certificate')}
												</span>
											</button>
										</div>

										{/* Live Market Status & Direct Marketplace Links */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3 shadow-xl text-start">
											<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[19px] text-[#0098EA]">
														storefront
													</span>
													<span class="text-[12px] font-black uppercase tracking-wider text-white">
														{tr(
															'وضعیت زنده بازار و فرگمنت',
															'LIVE FRAGMENT MARKET STATUS',
															'СТАТУС РЫНКА FRAGMENT',
															'FRAGMENT 实时市场状态',
														)}
													</span>
												</div>
												<span
													class={`text-[9px] font-mono font-black uppercase px-2.5 py-1 rounded-[8px] border ${liveMarketBadge().class}`}
												>
													{data()?.live_market?.raw_status_text || liveMarketBadge().label}
												</span>
											</div>

											{/* Whale Vanity / Showcase Listing Alert (e.g. @rare listed at 888,888,888 TON) */}
											<Show when={data()?.live_market?.is_vanity_ask}>
												<div class="bg-amber-500/10 border border-amber-500/35 rounded-[16px] p-3.5 flex flex-col gap-1.5">
													<div class="flex items-center justify-between gap-2">
														<div class="flex items-center gap-1.5">
															<span class="material-symbols-outlined text-amber-400 text-[18px]">
																warning
															</span>
															<span class="text-[11px] font-black text-amber-300 uppercase">
																{tr(
																	'تشخیص قیمت نمایشی نهنگ (Vanity / Showcase Ask)',
																	'WHALE VANITY / SHOWCASE LISTING DETECTED',
																)}
															</span>
														</div>
														<span class="text-[9px] font-mono font-black px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
															FILTERED BY AVM v7.2
														</span>
													</div>
													<p class="text-[11px] text-white/75 leading-relaxed">
														{tr(
															`مالک فعلی قیمت نمایشی ${fmtTon(data()?.live_market?.buy_now_ton)} TON (≈ $${fmtUsd(data()?.live_market?.buy_now_usd)}) را صرفاً جهت نمایش کلکسیونی ثبت کرده است. موتور AVM v7.2 این عدد غیرواقعی را از میانگین ارزش‌گذاری حذف کرده و قیمت منصفانه را بر اساس معامله واقعی فرگمنت (${fmtTon(data()?.history?.highest_past_sale_ton)} TON) و هم‌ترازهای معنایی محاسبه نموده است.`,
															data()?.live_market?.vanity_ask_warning ||
																'Extreme showcase ask detected and excluded from fair value blend.',
														)}
													</p>
												</div>
											</Show>

											<div class="grid grid-cols-2 gap-2.5">
												<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex flex-col gap-0.5">
													<span class="text-[9px] font-mono font-black text-white/40 uppercase">
														{data()?.live_market?.status === 'on_auction'
															? tr('بالاترین پیشنهاد فعلی', 'CURRENT HIGHEST BID')
															: data()?.live_market?.status === 'on_sale'
																? data()?.live_market?.is_vanity_ask
																	? tr('قیمت نمایشی ثبت‌شده (Ask)', 'SHOWCASE VANITY ASK')
																	: tr('قیمت فروش فوری (Ask)', 'ACTIVE BUY-NOW ASK')
																: tr('آخرین معامله ثبت‌شده', 'HIGHEST RECORDED SALE')}
													</span>
													<span
														class={`text-[15px] font-mono font-black ${
															data()?.live_market?.is_vanity_ask
																? 'text-amber-400'
																: 'text-emerald-400'
														}`}
													>
														{data()?.live_market?.current_bid_ton
															? `${fmtTon(data()?.live_market?.current_bid_ton)} TON`
															: data()?.live_market?.buy_now_ton
																? `${fmtTon(data()?.live_market?.buy_now_ton)} TON`
																: data()?.history?.highest_past_sale_ton
																	? `${fmtTon(data()?.history?.highest_past_sale_ton)} TON`
																	: tr('بدون سابقه فروش', 'No Prior Sale')}
													</span>
													<Show
														when={
															(data()?.history?.highest_past_sale_ton ?? 0) > 0 &&
															data()?.live_market?.status === 'on_sale'
														}
														fallback={
															<Show when={data()?.live_market?.ask_vs_estimate_pct !== undefined}>
																<span
																	class={`text-[10px] font-mono font-bold ${
																		(data()?.live_market?.ask_vs_estimate_pct || 0) <= 0
																			? 'text-emerald-400'
																			: 'text-amber-400'
																	}`}
																>
																	{(data()?.live_market?.ask_vs_estimate_pct || 0) > 0 ? '+' : ''}
																	{data()?.live_market?.ask_vs_estimate_pct}% vs Fair Value
																</span>
															</Show>
														}
													>
														<span class="text-[10px] font-mono font-bold text-emerald-400">
															{tr('معامله واقعی قبلی:', 'Verified Past Sale:')}{' '}
															{fmtTon(data()?.history?.highest_past_sale_ton)} TON
														</span>
													</Show>
												</div>

												<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex flex-col gap-0.5">
													<span class="text-[9px] font-mono font-black text-white/40 uppercase">
														{tr('نقدشوندگی و زمان فروش', 'LIQUIDITY & SELL TIME')}
													</span>
													<span class="text-[13px] font-mono font-black text-white truncate">
														{data()?.estimated_sell_time || '3 – 10 Days'}
													</span>
													<span class="text-[10px] font-mono text-[#0098EA] truncate">
														{data()?.liquidity_rating || 'Active Liquidity'}
													</span>
												</div>
											</div>

											<div class="grid grid-cols-3 gap-2 pt-1">
												<a
													href={
														data()?.live_market?.fragment_url ||
														`https://fragment.com/username/${username()}`
													}
													target="_blank"
													rel="noreferrer"
													class="h-10 rounded-[12px] bg-[#0098EA]/15 hover:bg-[#0098EA]/25 border border-[#0098EA]/35 text-[#0098EA] font-mono font-black text-[11px] flex items-center justify-center gap-1 transition-all"
												>
													<span>Fragment</span>
													<span class="material-symbols-outlined text-[13px]">open_in_new</span>
												</a>
												<a
													href={data()?.live_market?.getgems_url || 'https://getgems.io/Usernames'}
													target="_blank"
													rel="noreferrer"
													class="h-10 rounded-[12px] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-mono font-bold text-[11px] flex items-center justify-center gap-1 transition-all"
												>
													<span>Getgems</span>
													<span class="material-symbols-outlined text-[13px]">open_in_new</span>
												</a>
												<a
													href={data()?.live_market?.telegram_url || `https://t.me/${username()}`}
													target="_blank"
													rel="noreferrer"
													class="h-10 rounded-[12px] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-mono font-bold text-[11px] flex items-center justify-center gap-1 transition-all"
												>
													<span>t.me</span>
													<span class="material-symbols-outlined text-[13px]">open_in_new</span>
												</a>
											</div>
										</div>

										{/* Quantitative Price Band (P10 / P50 / P90) & Price Basis Breakdown */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-5 flex flex-col gap-4 shadow-xl text-start">
											<div class="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[20px] text-[#0098EA]">
														monitoring
													</span>
													<span class="text-[12px] font-black uppercase tracking-wider text-white">
														{tr(
															'بازه ارزش‌گذاری کمی (P10 / P50 / P90)',
															'BAYESIAN VALUATION BAND',
															'ДИАПАЗОН ОЦЕНКИ',
															'贝叶斯估值区间',
														)}
													</span>
												</div>
												<button
													type="button"
													onClick={() => setShowMethodologyModal(true)}
													class="text-[10px] font-mono font-bold text-[#0098EA] hover:underline flex items-center gap-1"
												>
													<span>{tr('روش‌شناسی', 'Methodology')}</span>
													<span class="material-symbols-outlined text-[14px]">info</span>
												</button>
											</div>

											<div class="relative w-full h-3.5 bg-[#08090D] rounded-full overflow-hidden border border-white/5">
												<div class="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-emerald-500/20 via-[#0098EA]/60 to-amber-500/30" />
												<div
													class="absolute top-0 bottom-0 w-2 bg-white shadow-[0_0_12px_#0098EA] rounded-full -translate-x-1/2"
													style={{ left: `${bandPosition(expectedTon())}%` }}
												/>
											</div>

											<div class="grid grid-cols-3 gap-2 text-center">
												<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
													<span class="text-[9px] font-mono font-bold text-white/40 uppercase">
														{tr('کف محافظه‌کارانه (P10)', 'P10 FLOOR')}
													</span>
													<span class="text-[13px] font-mono font-black text-white/80">
														{fmtTon(lowTon())} TON
													</span>
													<span class="text-[9px] font-mono text-white/40">
														≈ ${fmtUsd(parseFloat(data()?.low_usd || '0'))}
													</span>
												</div>
												<div class="bg-[#0098EA]/10 border border-[#0098EA]/35 rounded-[14px] p-2.5 flex flex-col gap-0.5">
													<span class="text-[9px] font-mono font-black text-[#0098EA] uppercase">
														{tr('ارزش منصفانه (P50)', 'P50 FAIR VALUE')}
													</span>
													<span class="text-[15px] font-mono font-black text-white">
														{fmtTon(expectedTon())} TON
													</span>
													<span class="text-[9px] font-mono text-[#0098EA]">
														≈ ${fmtUsd(parseFloat(data()?.expected_usd || '0'))}
													</span>
												</div>
												<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
													<span class="text-[9px] font-mono font-bold text-white/40 uppercase">
														{tr('سقف صعودی (P90)', 'P90 CEILING')}
													</span>
													<span class="text-[13px] font-mono font-black text-amber-400">
														{fmtTon(highTon())} TON
													</span>
													<span class="text-[9px] font-mono text-white/40">
														≈ ${fmtUsd(parseFloat(data()?.high_usd || '0'))}
													</span>
												</div>
											</div>

											{/* Method & Basis Summary */}
											<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3.5 flex flex-col gap-2">
												<div class="flex items-center justify-between">
													<span class="text-[10px] font-mono text-white/40 uppercase">
														{tr('مبنای محاسبه مدل:', 'Pricing Basis:')}
													</span>
													<span
														class="text-[10px] font-mono font-black uppercase"
														style={{ color: confidenceTheme().color }}
													>
														{confidenceTheme().label} ({data()?.confidence_score}%)
													</span>
												</div>
												<p class="text-[11px] font-mono font-bold text-white/85 leading-relaxed">
													{data()?.price_basis?.method || 'AVM v7.2 Empirical Bayesian Valuation'}
												</p>
												<div class="grid grid-cols-3 gap-2 pt-1 border-t border-white/5 text-[10px] font-mono">
													<div class="flex flex-col">
														<span class="text-white/40">{tr('معاملات مستقیم', 'Exact Sales')}</span>
														<span class="text-white font-bold">
															{data()?.price_basis?.exact_sales ??
																data()?.history?.transactions?.length ??
																0}
														</span>
													</div>
													<div class="flex flex-col">
														<span class="text-white/40">{tr('معاملات هم‌تراز', 'Comp Sales')}</span>
														<span class="text-white font-bold">
															{data()?.comparable_sales_count || 0}
														</span>
													</div>
													<div class="flex flex-col">
														<span class="text-white/40">{tr('صدک کمیابی', 'Percentile')}</span>
														<span class="text-emerald-400 font-bold">
															Top {(100 - (data()?.percentile_rank || 85)).toFixed(1)}%
														</span>
													</div>
												</div>
											</div>
										</div>

										{/* Fragment.com Capabilities, Make-an-Offer Calculator & Protocol Rules */}
										<Show when={data()?.fragment_capabilities}>
											{(fc) => {
												const offerAmountTon = () => {
													const parsed = Number.parseFloat(customOfferInput());
													return Number.isFinite(parsed) && parsed > 0
														? parsed
														: fc().suggested_offer_ton || Math.round(expectedTon() * 0.85);
												};
												const offerFeeTon = () => {
													const raw = offerAmountTon() * (fc().offer_fee_mult || 0.0005);
													return Math.min(
														fc().offer_fee_max_ton || 100,
														Math.max(fc().offer_fee_min_ton || 1, Math.round(raw * 100) / 100),
													);
												};
												return (
													<div class="w-full bg-gradient-to-br from-[#0098EA]/12 via-[#12141C]/95 to-[#08090D] backdrop-blur-2xl border border-[#0098EA]/30 rounded-[26px] p-5 flex flex-col gap-4 shadow-xl text-start">
														<div class="flex items-center justify-between border-b border-white/5 pb-3">
															<div class="flex items-center gap-2">
																<span class="material-symbols-outlined text-[20px] text-[#0098EA]">
																	tune
																</span>
																<div class="flex flex-col">
																	<span class="text-[12px] font-black uppercase tracking-wider text-white">
																		{tr(
																			'قابلیت‌ها و عملیات مستقیم در Fragment.com',
																			'FRAGMENT.COM PROTOCOL CAPABILITIES & TOOLS',
																		)}
																	</span>
																	<span class="text-[10px] font-mono text-white/45">
																		{tr(
																			'ماشین‌حساب پیشنهاد خرید (Make Offer)، ارتقای ربات و لینک‌های مستقیم',
																			'Make-an-Offer Fee Calculator, Bot Upgrade & Protocol Endpoints',
																		)}
																	</span>
																</div>
															</div>
															<span class="text-[9px] font-mono font-black text-[#0098EA] bg-[#0098EA]/15 border border-[#0098EA]/35 px-2.5 py-1 rounded-[8px]">
																FEE: 0.05%
															</span>
														</div>

														{/* Interactive Make-an-Offer Fee Calculator (offerFeeMult = 0.0005) */}
														<div class="bg-[#08090D] border border-white/10 rounded-[18px] p-3.5 flex flex-col gap-3">
															<div class="flex items-center justify-between">
																<span class="text-[11px] font-bold text-white">
																	{tr(
																		'شبیه‌ساز ثبت پیشنهاد خرید (Make an Offer) در فرگمنت',
																		'Fragment Make-an-Offer Fee Simulator',
																	)}
																</span>
																<span class="text-[9px] font-mono text-white/40">
																	Min {fc().offer_fee_min_ton} TON · Max {fc().offer_fee_max_ton} TON
																</span>
															</div>

															<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
																<div class="flex flex-col gap-1">
																	<span class="text-[9px] font-mono text-white/45 uppercase">
																		{tr('مبلغ پیشنهادی شما (TON):', 'Your Offer Amount (TON):')}
																	</span>
																	<div class="flex items-center bg-[#12141C] border border-white/15 focus-within:border-[#0098EA] rounded-[12px] px-3 h-10">
																		<input
																			type="number"
																			value={customOfferInput() || String(fc().suggested_offer_ton)}
																			onInput={(e) => setCustomOfferInput(e.currentTarget.value)}
																			placeholder={String(fc().suggested_offer_ton)}
																			class="w-full bg-transparent text-white font-mono font-black text-[13px] focus:outline-none"
																			dir="ltr"
																		/>
																		<span class="text-[10px] font-mono font-black text-[#0098EA]">
																			TON
																		</span>
																	</div>
																</div>

																<div class="bg-[#12141C] border border-white/5 rounded-[12px] p-2.5 flex items-center justify-between">
																	<div class="flex flex-col">
																		<span class="text-[9px] font-mono text-white/40 uppercase">
																			{tr('کارمزد ارسال پیشنهاد (0.05%):', 'Protocol Offer Fee (0.05%):')}
																		</span>
																		<span class="text-[14px] font-mono font-black text-amber-400">
																			{offerFeeTon()} TON
																		</span>
																		<span class="text-[9px] font-mono text-white/40">
																			≈ ${(offerFeeTon() * (data()?.ton_usd_rate || 5.25)).toFixed(2)}{' '}
																			USD
																		</span>
																	</div>
																	<a
																		href={fc().direct_links.fragment_url}
																		target="_blank"
																		rel="noreferrer"
																		class="px-3 py-2 rounded-[10px] bg-[#0098EA] hover:bg-[#0086cf] text-white font-mono font-black text-[10px] uppercase shrink-0"
																	>
																		{tr('ثبت پیشنهاد ↗', 'Make Offer ↗')}
																	</a>
																</div>
															</div>
														</div>

														{/* Fragment Protocol Capabilities Matrix */}
														<div class="grid grid-cols-3 gap-2 text-center">
															<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
																<span class="text-[8px] font-mono text-white/40 uppercase">
																	{tr('ارتقای ربات تلگرام', 'BOT UPGRADE FEE')}
																</span>
																<span class="text-[12px] font-mono font-black text-white">
																	{fmtTon(fc().bot_upgrade_fee_ton)} TON
																</span>
																<span class="text-[9px] font-mono text-cyan-400">
																	{fc().is_assigned_to_bot
																		? tr('فعال روی ربات ✓', 'Assigned to Bot')
																		: tr('هزینه اتصال به Bot', 'One-time Bot Fee')}
																</span>
															</div>

															<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
																<span class="text-[8px] font-mono text-white/40 uppercase">
																	{tr('سقف اتصال همزمان', 'PROFILE STACKING')}
																</span>
																<span class="text-[12px] font-mono font-black text-white">
																	{fc().max_collectibles_per_profile} Handles
																</span>
																<span class="text-[9px] font-mono text-emerald-400">
																	{tr('قابل چیدمان در پروفایل', 'Multi-Handle Ready')}
																</span>
															</div>

															<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
																<span class="text-[8px] font-mono text-white/40 uppercase">
																	{tr('ابرداده استاندارد NFT', 'TEP-64 METADATA')}
																</span>
																<a
																	href={fc().direct_links.nft_json_url}
																	target="_blank"
																	rel="noreferrer"
																	class="text-[11px] font-mono font-black text-[#0098EA] hover:underline"
																>
																	{username()}.json ↗
																</a>
																<a
																	href={fc().direct_links.web_subdomain_url}
																	target="_blank"
																	rel="noreferrer"
																	class="text-[9px] font-mono text-white/50 hover:text-white truncate"
																	dir="ltr"
																>
																	{username()}.t.me ↗
																</a>
															</div>
														</div>
													</div>
												);
											}}
										</Show>

										{/* Transaction Economics & MarketApp Rental Yield */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-5 flex flex-col gap-3.5 shadow-xl text-start">
											<div class="flex items-center justify-between border-b border-white/5 pb-3">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[20px] text-emerald-400">
														payments
													</span>
													<span class="text-[12px] font-black uppercase tracking-wider text-white">
														{layaT(USERNAME_I18N.txEconomics)}
													</span>
												</div>
												<span class="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-[6px]">
													Fragment 5% Fee
												</span>
											</div>

											<div class="grid grid-cols-2 gap-2.5">
												<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex flex-col gap-0.5">
													<span class="text-[9px] font-mono font-black text-white/40 uppercase">
														{layaT(USERNAME_I18N.netSellerProceeds)}
													</span>
													<span class="text-emerald-400 font-mono font-black text-[15px]">
														{fmtTon(Math.max(0, expectedTon() - Math.max(5, expectedTon() * 0.05)))}{' '}
														TON
													</span>
													<span class="text-[10px] font-mono text-white/40">
														-{fmtTon(Math.max(5, Math.round(expectedTon() * 0.05)))} TON Fee
													</span>
												</div>

												<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex flex-col gap-0.5">
													<span class="text-[9px] font-mono font-black text-white/40 uppercase">
														{tr('درآمد اجاره ماهانه (MarketApp)', 'EST. MONTHLY RENT')}
													</span>
													{(() => {
														const uLen = data()?.length || username().length || 6;
														const rate =
															uLen <= 4 ? 0.045 : uLen === 5 ? 0.038 : uLen === 6 ? 0.032 : 0.025;
														const monthlyTon = Math.max(1, Math.round(expectedTon() * rate));
														const apy = (rate * 12 * 100).toFixed(1);
														return (
															<>
																<span class="text-[#0098EA] font-mono font-black text-[15px]">
																	~{fmtTon(monthlyTon)} TON/mo
																</span>
																<span class="text-[10px] font-mono text-emerald-400">
																	~{apy}% Est. APY
																</span>
															</>
														);
													})()}
												</div>
											</div>
										</div>
									</div>
								</Show>

								{/* ════════════════════════════════════════════════════════════════
								    TAB 2: ON-CHAIN TELEMINT, BINARY BOC FORENSICS, .TON DNS & WHALE
								    ════════════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'onchain'}>
									<div class="w-full flex flex-col gap-3.5 text-start">
										{/* 1. TEP-62 TeleMint Smart Contract Provenance */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-5 flex flex-col gap-3.5 shadow-xl">
											<div class="flex items-center justify-between border-b border-white/5 pb-3">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[20px] text-cyan-400">
														verified_user
													</span>
													<div class="flex flex-col">
														<span class="text-[12px] font-black uppercase tracking-wider text-white">
															{tr(
																'اصالت قرارداد هوشمند TEP-62 TeleMint',
																'TEP-62 TELEMINT PROVENANCE',
																'ОНЧЕЙН АУДИТ TELEMINT',
																'TEP-62 链上合约溯源',
															)}
														</span>
														<span class="text-[10px] font-mono text-white/40">
															{data()?.username || username()}.t.me
														</span>
													</div>
												</div>
												<span
													class={`text-[9px] font-mono font-black uppercase px-2.5 py-1 rounded-[8px] border ${
														data()?.telemint_provenance?.is_authentic
															? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
															: 'bg-amber-400/15 border-amber-400/35 text-amber-400'
													}`}
												>
													{data()?.telemint_provenance?.is_authentic
														? tr('NFT رسمی تلگرام', 'OFFICIAL NFT', 'ОФИЦ. NFT', '官方 NFT')
														: tr('غیر توکنایز (وب ۲)', 'UNMINTED', 'НЕ NFT', '未铸造')}
												</span>
											</div>

											<div class="flex flex-col gap-2 text-[11px] font-mono">
												<Show when={data()?.telemint_provenance?.item_address}>
													<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-3 flex items-center justify-between gap-2">
														<div class="flex flex-col min-w-0">
															<span class="text-[9px] text-white/40 uppercase">
																{tr('آدرس قرارداد NFT آیتم:', 'NFT Item Contract:')}
															</span>
															<span class="text-white font-bold truncate" dir="ltr">
																{data()?.telemint_provenance?.item_address}
															</span>
														</div>
														<div class="flex items-center gap-1 shrink-0">
															<button
																type="button"
																onClick={() =>
																	handleCopy(
																		data()?.telemint_provenance?.item_address || '',
																		'nft_addr',
																	)
																}
																class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70"
															>
																<span class="material-symbols-outlined text-[15px]">
																	{copiedText() === 'nft_addr' ? 'check' : 'content_copy'}
																</span>
															</button>
															<a
																href={`https://tonviewer.com/${data()?.telemint_provenance?.item_address}`}
																target="_blank"
																rel="noreferrer"
																class="p-1.5 rounded-lg bg-[#0098EA]/15 text-[#0098EA]"
															>
																<span class="material-symbols-outlined text-[15px]">
																	open_in_new
																</span>
															</a>
														</div>
													</div>
												</Show>

												<Show when={data()?.telemint_provenance?.code_hash}>
													<div class="grid grid-cols-2 gap-2">
														<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-2.5 flex flex-col">
															<span class="text-[9px] text-white/40 uppercase">TVM Code Hash</span>
															<span class="text-cyan-300 font-bold truncate" dir="ltr">
																{data()?.telemint_provenance?.code_hash?.slice(0, 14)}...
															</span>
														</div>
														<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-2.5 flex flex-col">
															<span class="text-[9px] text-white/40 uppercase">TVM Data Hash</span>
															<span class="text-white/70 font-bold truncate" dir="ltr">
																{data()?.telemint_provenance?.data_hash?.slice(0, 14)}...
															</span>
														</div>
													</div>
												</Show>

												<p class="text-[11px] text-white/60 font-sans leading-relaxed pt-1">
													{data()?.telemint_provenance?.details}
												</p>
											</div>
										</div>

										{/* 1B. Binary & TVM Byte-Level BOC Forensics Inspector */}
										<Show when={data()?.binary_forensics}>
											{(bf) => (
												<div class="w-full bg-gradient-to-br from-cyan-500/10 via-[#12141C]/95 to-[#08090D] backdrop-blur-2xl border border-cyan-500/30 rounded-[26px] p-5 flex flex-col gap-3.5 shadow-xl">
													<div class="flex items-center justify-between border-b border-white/5 pb-3">
														<div class="flex items-center gap-2">
															<span class="material-symbols-outlined text-[20px] text-cyan-400">
																memory
															</span>
															<div class="flex flex-col">
																<span class="text-[12px] font-black uppercase tracking-wider text-white">
																	{tr(
																		'کالبدشکافی باینری، بیت‌استریم UTF-8 و سلول BOC ماشین مجازی TON',
																		'BINARY BITSTREAM & TVM BAG-OF-CELLS (BOC) FORENSICS',
																	)}
																</span>
																<span class="text-[10px] font-mono text-cyan-400/80" dir="ltr">
																	{bf().boc_magic_prefix} · {bf().total_bits}-Bit Payload
																</span>
															</div>
														</div>
														<span class="text-[9px] font-mono font-black text-cyan-300 bg-cyan-500/15 border border-cyan-500/35 px-2.5 py-1 rounded-[8px]">
															H(X) = {bf().shannon_entropy_bits} b/ch
														</span>
													</div>

													{/* Top Binary KPIs */}
													<div class="grid grid-cols-4 gap-2 text-center font-mono">
														<div class="bg-[#08090D] border border-white/5 rounded-[12px] p-2 flex flex-col">
															<span class="text-[8px] text-white/40 uppercase">ASCII HEX</span>
															<span class="text-[11px] font-black text-cyan-300 truncate" dir="ltr">
																{bf().ascii_hex_spaced}
															</span>
														</div>
														<div class="bg-[#08090D] border border-white/5 rounded-[12px] p-2 flex flex-col">
															<span class="text-[8px] text-white/40 uppercase">HAMMING WT</span>
															<span class="text-[11px] font-black text-white">
																{bf().set_bits_popcount}/{bf().total_bits} ({bf().hamming_weight_pct}%)
															</span>
														</div>
														<div class="bg-[#08090D] border border-white/5 rounded-[12px] p-2 flex flex-col">
															<span class="text-[8px] text-white/40 uppercase">SHANNON H(X)</span>
															<span class="text-[11px] font-black text-emerald-400">
																{bf().shannon_entropy_bits} bits
															</span>
														</div>
														<div class="bg-[#08090D] border border-white/5 rounded-[12px] p-2 flex flex-col">
															<span class="text-[8px] text-white/40 uppercase">HAND ALT</span>
															<span class="text-[11px] font-black text-amber-400">
																{bf().hand_alternation_pct}% ({bf().left_hand_keys}L/{bf().right_hand_keys}R)
															</span>
														</div>
													</div>

													{/* TEP-62 256-Bit SHA-256 Index & TeleMint Token BOC Cell */}
													<div class="flex flex-col gap-2 font-mono text-[10px]">
														<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-3 flex items-center justify-between gap-2">
															<div class="flex flex-col min-w-0">
																<span class="text-[8px] text-white/40 uppercase">
																	{tr(
																		'ایندکس ۲۵۶ بیتی قرارداد هوشمند (TEP-62 uint256 = SHA-256):',
																		'TEP-62 256-Bit NFT Index (sha256(username)):',
																	)}
																</span>
																<span class="text-cyan-300 font-bold truncate" dir="ltr">
																	{bf().tep62_sha256_index}
																</span>
															</div>
															<button
																type="button"
																onClick={() => handleCopy(bf().tep62_sha256_index, 'sha256_idx')}
																class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 shrink-0"
															>
																<span class="material-symbols-outlined text-[14px]">
																	{copiedText() === 'sha256_idx' ? 'check' : 'content_copy'}
																</span>
															</button>
														</div>

														<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-3 flex items-center justify-between gap-2">
															<div class="flex flex-col min-w-0">
																<span class="text-[8px] text-white/40 uppercase">
																	{tr(
																		'سلول باینری نام توکن (get_telemint_token_name BOC Hex):',
																		'TeleMint Token Name BOC Cell (get_telemint_token_name):',
																	)}
																</span>
																<span class="text-emerald-400 font-bold truncate" dir="ltr">
																	{bf().telemint_token_cell_boc}
																</span>
															</div>
															<button
																type="button"
																onClick={() =>
																	handleCopy(bf().telemint_token_cell_boc, 'boc_cell')
																}
																class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 shrink-0"
															>
																<span class="material-symbols-outlined text-[14px]">
																	{copiedText() === 'boc_cell' ? 'check' : 'content_copy'}
																</span>
															</button>
														</div>

														{/* Decoded TVM Auction Config if present on-chain */}
														<Show when={bf().auction_config}>
															{(ac) => (
																<div class="bg-[#08090D] border border-cyan-500/20 rounded-[14px] p-3 flex flex-col gap-1.5">
																	<div class="flex items-center justify-between">
																		<span class="text-[9px] font-black text-cyan-400 uppercase">
																			{tr(
																				'پیکربندی حراج درون‌زنجیره‌ای (get_telemint_auction_config)',
																				'TVM Decoded Auction Config (get_telemint_auction_config)',
																			)}
																		</span>
																		<Show when={bf().last_transaction_lt}>
																			<span class="text-[9px] text-white/40" dir="ltr">
																				LT: {bf().last_transaction_lt}
																			</span>
																		</Show>
																	</div>
																	<div class="grid grid-cols-3 gap-2 pt-1 text-[10px]">
																		<div class="flex flex-col">
																			<span class="text-white/40 text-[8px]">MIN BID / ASK</span>
																			<span class="text-white font-bold">
																				{fmtTon(ac().initialMinBidTon)} TON
																			</span>
																		</div>
																		<div class="flex flex-col">
																			<span class="text-white/40 text-[8px]">MIN STEP</span>
																			<span class="text-emerald-400 font-bold">
																				{ac().minBidStepPct}% Step
																			</span>
																		</div>
																		<div class="flex flex-col">
																			<span class="text-white/40 text-[8px]">ANTI-SNIPE</span>
																			<span class="text-amber-400 font-bold">
																				{Math.round(ac().minExtendTimeSec / 60)}m Window
																			</span>
																		</div>
																	</div>
																</div>
															)}
														</Show>
													</div>

													{/* Per-Character 8-Bit UTF-8 Binary Matrix */}
													<div class="flex flex-col rounded-[16px] overflow-hidden bg-[#08090D] border border-white/5">
														<div class="grid grid-cols-6 p-2.5 bg-white/[0.03] text-[8px] font-mono font-black text-white/40 uppercase tracking-wider border-b border-white/5 text-center">
															<span>CHAR</span>
															<span>ASCII</span>
															<span>HEX</span>
															<span class="col-span-2">8-BIT UTF-8 BINARY</span>
															<span>MORSE / KEY</span>
														</div>
														<For each={bf().bitstream_matrix}>
															{(row, idx) => (
																<div
																	class={`grid grid-cols-6 p-2.5 items-center text-[11px] font-mono text-center ${
																		idx() !== bf().bitstream_matrix.length - 1
																			? 'border-b border-white/5'
																			: ''
																	}`}
																	dir="ltr"
																>
																	<span class="text-white font-black text-[13px]">
																		'{row.char}'
																	</span>
																	<span class="text-white/60">{row.ascii_dec}</span>
																	<span class="text-cyan-400 font-bold">{row.hex_byte}</span>
																	<div class="col-span-2 flex items-center justify-center gap-0.5">
																		<For each={row.binary_8bit.split('')}>
																			{(bit) => (
																				<span
																					class={`w-3.5 h-4 rounded-[3px] flex items-center justify-center text-[9px] font-black ${
																						bit === '1'
																							? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
																							: 'bg-white/[0.03] text-white/30'
																					}`}
																				>
																					{bit}
																				</span>
																			)}
																		</For>
																	</div>
																	<span class="text-amber-400/90 text-[10px]">
																		{row.morse} · {row.keyboard_hand}
																	</span>
																</div>
															)}
														</For>
													</div>
												</div>
											)}
										</Show>

										{/* 2. Cross-Chain .ton TON DNS Sister Domain Synergy */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-[#0098EA]/25 rounded-[26px] p-5 flex flex-col gap-3 shadow-xl">
											<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[20px] text-[#0098EA]">
														language
													</span>
													<div class="flex flex-col">
														<span class="text-[12px] font-black uppercase tracking-wider text-white">
															{tr(
																'هم‌افزایی دامنه وب۳ (TON DNS .ton)',
																'TON DNS (.TON) SISTER DOMAIN',
																'СИНЕРГИЯ ДОМЕНА .TON',
																'TON DNS (.ton) 域名协同',
															)}
														</span>
														<span class="text-[10px] font-mono text-[#0098EA]" dir="ltr">
															{data()?.ton_dns_domain?.domain || `${username()}.ton`}
														</span>
													</div>
												</div>
												<span
													class={`text-[9px] font-mono font-black uppercase px-2.5 py-1 rounded-[8px] border ${
														data()?.ton_dns_domain?.sameOwnerSynergy
															? 'bg-amber-400/15 border-amber-400/40 text-amber-400'
															: data()?.ton_dns_domain?.exists
																? 'bg-[#0098EA]/15 border-[#0098EA]/35 text-[#0098EA]'
																: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
													}`}
												>
													{data()?.ton_dns_domain?.sameOwnerSynergy
														? tr(
																'مالک یکسان با @!',
																'UNIFIED WHALE OWNER',
																'ЕДИНЫЙ ВЛАДЕЛЕЦ',
																'同巨鲸持有',
															)
														: data()?.ton_dns_domain?.exists
															? tr(
																	'ثبت شده در TON DNS',
																	'MINTED ON TON DNS',
																	'ЗАРЕГИСТРИРОВАН',
																	'已注册',
																)
															: tr('آزاد برای ثبت', 'AVAILABLE (.TON)', 'СВОБОДЕН', '可注册')}
												</span>
											</div>
											<p class="text-[11px] text-white/75 leading-relaxed">
												{data()?.risk_audit?.ton_dns_synergy}
											</p>
											<Show when={data()?.ton_dns_domain?.nftAddress}>
												<div class="flex items-center justify-between bg-[#08090D] border border-white/5 rounded-[12px] px-3 py-2 text-[10px] font-mono">
													<span class="text-white/40">.ton NFT Address:</span>
													<a
														href={`https://tonviewer.com/${data()?.ton_dns_domain?.nftAddress}`}
														target="_blank"
														rel="noreferrer"
														class="text-[#0098EA] hover:underline"
														dir="ltr"
													>
														{data()?.ton_dns_domain?.nftAddress?.slice(0, 8)}...
														{data()?.ton_dns_domain?.nftAddress?.slice(-6)} ↗
													</a>
												</div>
											</Show>
										</div>

										{/* 3. Live Telegram Identity & Audience Telemetry (from t.me/{u}) */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-5 flex flex-col gap-3.5 shadow-xl">
											<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[20px] text-[#0098EA]">
														campaign
													</span>
													<span class="text-[12px] font-black uppercase tracking-wider text-white">
														{tr(
															'وضعیت زنده در تلگرام و مخاطبان (t.me)',
															'LIVE TELEGRAM ENTITY & AUDIENCE',
															'ПРОФИЛЬ И АУДИТОРИЯ TELEGRAM',
															'TELEGRAM 实时实体与受众',
														)}
													</span>
												</div>
												<span class="text-[9px] font-mono font-black uppercase px-2.5 py-1 rounded-[8px] bg-white/5 border border-white/10 text-white/70">
													{data()?.entity_info?.type?.toUpperCase() || 'UNASSIGNED'}
												</span>
											</div>

											<Show
												when={ownerProfile() || (data()?.entity_info?.title ?? '') !== ''}
												fallback={
													<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3.5 text-[11px] text-white/50">
														{tr(
															'این نام کاربری در حال حاضر به هیچ کانال، ربات یا اکانت عمومی در تلگرام متصل نیست (پارک شده در کیف پول یا آزاد).',
															'Handle is not currently assigned to an active public Telegram profile, channel, or bot (parked in wallet or unassigned).',
														)}
													</div>
												}
											>
												<div class="flex items-center justify-between gap-3 bg-[#08090D] border border-white/10 rounded-[18px] p-3.5">
													<div class="flex items-center gap-3 min-w-0">
														<Show
															when={data()?.entity_info?.avatar_url}
															fallback={
																<div class="w-11 h-11 rounded-full bg-gradient-to-tr from-[#0098EA] to-cyan-400 flex items-center justify-center text-white font-black text-[16px] shrink-0">
																	{(
																		data()?.entity_info?.title?.[0] ||
																		username()[0] ||
																		'T'
																	).toUpperCase()}
																</div>
															}
														>
															<img
																src={data()?.entity_info?.avatar_url}
																alt={data()?.entity_info?.title}
																class="w-11 h-11 rounded-full object-cover border border-white/15 shrink-0"
															/>
														</Show>
														<div class="flex flex-col min-w-0">
															<div class="flex items-center gap-1.5">
																<span class="text-white font-bold text-[13px] truncate">
																	{data()?.entity_info?.title || ownerProfile()?.first_name}
																</span>
																<Show when={data()?.entity_info?.verified}>
																	<span class="material-symbols-outlined text-[#0098EA] text-[15px] shrink-0">
																		verified
																	</span>
																</Show>
															</div>
															<span class="text-[11px] font-mono text-emerald-400 font-bold">
																{data()?.entity_info?.extra_text ||
																	(data()?.entity_info?.members
																		? `${fmtTon(data()?.entity_info?.members)} subscribers`
																		: `@${username()}`)}
															</span>
														</div>
													</div>
													<a
														href={`https://t.me/${username()}`}
														target="_blank"
														rel="noreferrer"
														class="px-3 py-1.5 rounded-[10px] bg-[#0098EA]/15 border border-[#0098EA]/30 text-[#0098EA] font-mono font-bold text-[10px] shrink-0"
													>
														t.me ↗
													</a>
												</div>
												<Show when={data()?.entity_info?.bio}>
													<p class="text-[11px] text-white/65 bg-[#08090D]/70 border border-white/5 rounded-[14px] p-3 leading-relaxed">
														{data()?.entity_info?.bio}
													</p>
												</Show>
											</Show>
										</div>

										{/* 4. Complete Fragment Ownership History */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-5 flex flex-col gap-3.5 shadow-xl">
											<div class="flex items-center justify-between border-b border-white/5 pb-3">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[20px] text-amber-400">
														history
													</span>
													<span class="text-[12px] font-black uppercase tracking-wider text-white">
														{t('valuation.history_title') || 'FRAGMENT OWNERSHIP HISTORY'}
													</span>
												</div>
												<Show when={data()?.history?.highest_past_sale_ton}>
													<span class="text-[10px] font-mono font-black text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2.5 py-1 rounded-[8px]">
														MAX: {fmtTon(data()?.history?.highest_past_sale_ton)} TON
													</span>
												</Show>
											</div>

											<Show when={data()?.history?.owner_address}>
												<div class="flex items-center justify-between bg-[#08090D] border border-white/5 rounded-[16px] p-3 gap-2">
													<div class="flex flex-col min-w-0">
														<span class="text-[9px] font-black text-white/40 uppercase">
															{t('valuation.owner') || 'Current Owner Wallet:'}
														</span>
														<span
															class="text-white font-mono font-black text-[11px] truncate"
															dir="ltr"
														>
															{data()?.history?.owner_address}
														</span>
													</div>
													<div class="flex items-center gap-1 shrink-0">
														<button
															type="button"
															onClick={() =>
																handleCopy(data()?.history?.owner_address || '', 'owner_wallet')
															}
															class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70"
														>
															<span class="material-symbols-outlined text-[15px]">
																{copiedText() === 'owner_wallet' ? 'check' : 'content_copy'}
															</span>
														</button>
														<a
															href={`https://tonviewer.com/${data()?.history?.owner_address}`}
															target="_blank"
															rel="noreferrer"
															class="p-1.5 rounded-lg bg-[#0098EA]/15 text-[#0098EA]"
														>
															<span class="material-symbols-outlined text-[15px]">open_in_new</span>
														</a>
													</div>
												</div>
											</Show>

											<Show
												when={(data()?.history?.transactions?.length ?? 0) > 0}
												fallback={
													<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-4 text-center text-[11px] text-white/50 font-mono">
														{tr(
															'هیچ معامله ثبت‌شده قبلی در تاریخچه فرگمنت برای این نام کاربری یافت نشد.',
															'No settled sale transactions recorded on Fragment for this handle yet.',
														)}
													</div>
												}
											>
												<div class="flex flex-col rounded-[16px] overflow-hidden bg-[#08090D] border border-white/5">
													<div class="grid grid-cols-3 p-3 bg-white/[0.03] text-[9px] font-black text-white/40 uppercase tracking-widest border-b border-white/5">
														<span class="text-start">{t('valuation.sale_price') || 'EVENT / PRICE'}</span>
														<span class="text-center">{t('valuation.date') || 'DATE'}</span>
														<span class="text-end">{t('valuation.buyer') || 'RECIPIENT WALLET'}</span>
													</div>
													<For each={data()?.history?.transactions}>
														{(tx, idx) => {
															const isTransfer =
																tx.event_type === 'transfer' ||
																tx.sale_price_ton.toLowerCase().includes('transfer');
															return (
																<div
																	class={`grid grid-cols-3 p-3 items-center text-[12px] ${
																		idx() !== (data()?.history?.transactions?.length || 0) - 1
																			? 'border-b border-white/5'
																			: ''
																	}`}
																>
																	<Show
																		when={!isTransfer}
																		fallback={
																			<span class="text-cyan-400 font-mono font-bold text-[10px] text-start">
																				⇄ P2P Transfer
																			</span>
																		}
																	>
																		<span class="text-emerald-400 font-mono font-black text-start">
																			{tx.sale_price_ton} TON
																		</span>
																	</Show>
																	<span class="text-white/50 text-[10px] font-mono font-bold text-center">
																		{new Date(tx.date).toLocaleDateString('en-GB', {
																			day: 'numeric',
																			month: 'short',
																			year: 'numeric',
																		})}
																	</span>
																	<a
																		href={
																			tx.buyer && tx.buyer.length > 20
																				? `https://tonviewer.com/${tx.buyer}`
																				: `https://fragment.com/username/${username()}`
																		}
																		target="_blank"
																		rel="noreferrer"
																		class="text-[#0098EA] hover:underline font-mono font-bold text-[11px] truncate text-end"
																		dir="ltr"
																	>
																		{tx.buyer && tx.buyer.length > 12
																			? `${tx.buyer.slice(0, 4)}...${tx.buyer.slice(-4)}`
																			: tx.buyer || 'Fragment'}
																	</a>
																</div>
															);
														}}
													</For>
												</div>
											</Show>
										</div>

										{/* 5. Live Fragment Bid History (Auction Offers Table) */}
										<Show when={(data()?.live_market?.offers?.length ?? 0) > 0}>
											<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-amber-500/25 rounded-[26px] p-5 flex flex-col gap-3.5 shadow-xl">
												<div class="flex items-center justify-between border-b border-white/5 pb-3">
													<div class="flex items-center gap-2">
														<span class="material-symbols-outlined text-[20px] text-amber-400">
															gavel
														</span>
														<span class="text-[12px] font-black uppercase tracking-wider text-white">
															{tr(
																'تاریخچه پیشنهادهای حراج فرگمنت',
																'FRAGMENT AUCTION BID HISTORY',
																'ИСТОРИЯ СТАВОК FRAGMENT',
																'FRAGMENT 拍卖出价记录',
															)}
														</span>
													</div>
													<span class="text-[10px] font-mono font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-[8px]">
														{data()?.live_market?.offers?.length} BIDS
													</span>
												</div>

												<Show when={data()?.live_market?.bid_analytics}>
													{(ba) => (
														<div class="grid grid-cols-3 gap-2 text-center">
															<div class="bg-[#08090D] border border-white/5 rounded-[12px] p-2 flex flex-col">
																<span class="text-[8px] font-mono text-white/40 uppercase">
																	{tr('شرکت‌کنندگان یکتا', 'UNIQUE BIDDERS')}
																</span>
																<span class="text-[13px] font-mono font-black text-white">
																	{ba().unique_bidders_count}
																</span>
															</div>
															<div class="bg-[#08090D] border border-white/5 rounded-[12px] p-2 flex flex-col">
																<span class="text-[8px] font-mono text-white/40 uppercase">
																	{tr('پیشنهاد شروع', 'OPENING BID')}
																</span>
																<span class="text-[13px] font-mono font-black text-white/80">
																	{fmtTon(ba().opening_bid_ton)} TON
																</span>
															</div>
															<div class="bg-[#08090D] border border-white/5 rounded-[12px] p-2 flex flex-col">
																<span class="text-[8px] font-mono text-white/40 uppercase">
																	{tr('ضریب جهش حراج', 'BID JUMP')}
																</span>
																<span class="text-[13px] font-mono font-black text-amber-400">
																	{ba().bid_jump_multiple}x
																</span>
															</div>
														</div>
													)}
												</Show>

												<div class="flex flex-col rounded-[16px] overflow-hidden bg-[#08090D] border border-white/5 max-h-[240px] overflow-y-auto">
													<For each={data()?.live_market?.offers?.slice(0, 15)}>
														{(offer, idx) => (
															<div
																class={`grid grid-cols-3 p-3 items-center text-[11px] font-mono ${
																	idx() !==
																	Math.min(15, data()?.live_market?.offers?.length || 0) - 1
																		? 'border-b border-white/5'
																		: ''
																}`}
															>
																<span class="text-amber-400 font-black text-start">
																	{fmtTon(offer.price_ton)} TON
																</span>
																<span class="text-white/40 text-[10px] text-center">
																	{offer.date
																		? new Date(offer.date).toLocaleDateString('en-GB', {
																				day: 'numeric',
																				month: 'short',
																				year: '2-digit',
																			})
																		: '—'}
																</span>
																<a
																	href={
																		offer.from ? `https://tonviewer.com/${offer.from}` : undefined
																	}
																	target="_blank"
																	rel="noreferrer"
																	class="text-white/75 hover:text-[#0098EA] text-end truncate"
																	dir="ltr"
																>
																	{offer.from
																		? `${offer.from.slice(0, 4)}...${offer.from.slice(-4)}`
																		: 'Bidder'}
																</a>
															</div>
														)}
													</For>
												</div>
											</div>
										</Show>

										{/* 6. Holder Whale Wallet & Live On-Chain Portfolio */}
										<Show when={hasPortfolio() || (data()?.wallet_info?.balance ?? 0) > 0}>
											<div class="w-full bg-gradient-to-br from-amber-500/10 via-[#12141C]/90 to-[#08090D] backdrop-blur-2xl border border-amber-500/30 rounded-[26px] p-5 flex flex-col gap-3.5 shadow-xl">
												<div class="flex items-center justify-between border-b border-white/5 pb-3">
													<div class="flex items-center gap-2">
														<span class="material-symbols-outlined text-[20px] text-amber-400">
															account_balance_wallet
														</span>
														<div class="flex flex-col">
															<span class="text-[12px] font-black uppercase tracking-wider text-white">
																{t('valuation.whale_portfolio_title') || 'HOLDER WHALE PORTFOLIO'}
															</span>
															<span class="text-[10px] font-mono text-white/40">
																{tr(
																	'موجودی زنده TON و سایر شناسه‌های همین کیف پول',
																	'Live TonAPI Wallet Balance & Other Usernames',
																)}
															</span>
														</div>
													</div>
													<span
														class={`text-[9px] font-mono font-black px-2.5 py-1 rounded-[8px] border ${
															data()?.wallet_info?.is_whale
																? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
																: 'bg-[#0098EA]/15 border-[#0098EA]/30 text-[#0098EA]'
														}`}
													>
														{data()?.wallet_info?.is_whale ? '🐋 WHALE WALLET' : '👤 COLLECTOR'}
													</span>
												</div>

												<div class="grid grid-cols-3 gap-2">
													<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-2.5 flex flex-col">
														<span class="text-[8px] font-mono text-white/40 uppercase">
															{tr('موجودی کیف پول', 'TON BALANCE')}
														</span>
														<span class="text-[13px] font-mono font-black text-amber-400">
															{fmtTon(data()?.wallet_info?.balance)} TON
														</span>
													</div>
													<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-2.5 flex flex-col">
														<span class="text-[8px] font-mono text-white/40 uppercase">
															{tr('تعداد شناسه‌ها', 'USERNAME NFTS')}
														</span>
														<span class="text-[13px] font-mono font-black text-white">
															{data()?.wallet_info?.nft_count ||
																data()?.portfolio?.total_count ||
																1}
														</span>
													</div>
													<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-2.5 flex flex-col">
														<span class="text-[8px] font-mono text-white/40 uppercase">
															{tr('ارزش کل پرتفوی', 'EST. PORTFOLIO')}
														</span>
														<span class="text-[13px] font-mono font-black text-emerald-400">
															{fmtTon(data()?.portfolio?.total_est_value_ton)} TON
														</span>
													</div>
												</div>

												<Show when={hasPortfolio()}>
													<div class="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
														<For each={data()?.portfolio?.items}>
															{(item) => {
																const badge = portfolioBadge(item.status);
																return (
																	<div
																		onClick={() => openReport(item.username)}
																		class="flex items-center justify-between gap-2 bg-[#08090D] hover:bg-white/[0.04] border border-white/5 hover:border-amber-400/30 rounded-[14px] p-3 cursor-pointer transition-all active:scale-[0.98]"
																	>
																		<div class="flex items-center gap-2 min-w-0">
																			<span class="text-amber-400/60 text-[12px] font-mono">✦</span>
																			<span
																				class="text-white font-mono font-black text-[13px] truncate"
																				dir="ltr"
																			>
																				@{item.username}
																			</span>
																		</div>
																		<div class="flex items-center gap-2 shrink-0">
																			<Show when={(item.last_sale_ton ?? 0) > 0}>
																				<span class="text-amber-400 font-mono font-black text-[11px]">
																					{fmtTon(item.last_sale_ton)} TON
																				</span>
																			</Show>
																			<span
																				class={`text-[9px] font-black px-2 py-0.5 rounded-[6px] border ${badge.class}`}
																			>
																				{badge.label}
																			</span>
																		</div>
																	</div>
																);
															}}
														</For>
													</div>
												</Show>
											</div>
										</Show>
									</div>
								</Show>

								{/* ════════════════════════════════════════════════════════════════
								    TAB 3: SIMILAR USERNAMES & SEMANTIC MEANING GRAPH (3-PILLAR ENGINE)
								    ════════════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'similar'}>
									<div class="w-full flex flex-col gap-3.5 text-start">
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-[#0098EA]/30 rounded-[26px] p-5 flex flex-col gap-4 shadow-xl">
											<div class="flex items-center justify-between border-b border-white/5 pb-3">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[21px] text-[#0098EA]">
														psychology
													</span>
													<div class="flex flex-col">
														<span class="text-[13px] font-black uppercase tracking-wider text-white">
															{tr(
																'موتور تشابه معنایی، مفهومی و معاملات هم‌تراز',
																'SEMANTIC MEANING GRAPH & COMPARABLE HANDLES',
															)}
														</span>
														<span class="text-[10px] font-mono text-white/45">
															{tr(
																'تمرکز بر هم‌معنی‌های مستقیم (مانند @cars ↔ @auto و @rare ↔ @uncommon) + ریشه فرگمنت',
																'Direct Conceptual Synonyms (@cars ↔ @auto, @rare ↔ @uncommon) + Live Fragment',
															)}
														</span>
													</div>
												</div>
												<span class="text-[10px] font-mono font-black text-[#0098EA] bg-[#0098EA]/10 border border-[#0098EA]/30 px-2.5 py-1 rounded-[8px]">
													{similarCounts().all} {tr('مورد', 'ITEMS')}
												</span>
											</div>

											{/* Semantic Cluster Highlight Banner */}
											{(() => {
												const topSemantic = (data()?.similar || []).filter(
													(s) => s.category === 'semantic',
												);
												const clusterName =
													topSemantic.find((s) => s.semantic_cluster)?.semantic_cluster ||
													tr('خوشه معنایی و لغوی مستقیم', 'Direct Lexical & Conceptual Cluster');
												return (
													<Show when={topSemantic.length > 0}>
														<div class="bg-gradient-to-r from-emerald-500/10 via-[#0098EA]/10 to-transparent border border-emerald-500/25 rounded-[16px] p-3.5 flex flex-col gap-2">
															<div class="flex items-center justify-between">
																<div class="flex items-center gap-1.5">
																	<span class="material-symbols-outlined text-emerald-400 text-[17px]">
																		auto_awesome
																	</span>
																	<span class="text-[11px] font-black text-emerald-300">
																		{tr('خوشه معنایی تشخیص‌داده‌شده:', 'Detected Meaning Cluster:')}{' '}
																		{clusterName}
																	</span>
																</div>
																<span class="text-[9px] font-mono font-black text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded">
																	{topSemantic.length} SYNONYMS
																</span>
															</div>
															<div class="flex flex-wrap gap-1.5">
																<For each={topSemantic.slice(0, 6)}>
																	{(syn) => (
																		<button
																			type="button"
																			onClick={() => openReport(syn.username)}
																			class="px-2.5 py-1 rounded-[9px] bg-[#08090D] hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono font-black text-[11px] flex items-center gap-1 transition-all"
																			dir="ltr"
																		>
																			<span>@{syn.username}</span>
																			<Show when={(syn.sale_price ?? 0) > 0}>
																				<span class="text-[9px] text-white/50">
																					({fmtTon(syn.sale_price)}T)
																				</span>
																			</Show>
																		</button>
																	)}
																</For>
															</div>
														</div>
													</Show>
												);
											})()}

											{/* 4 Sub-Filter Pills with Live Counts */}
											<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
												<button
													type="button"
													onClick={() => setSimilarFilter('all')}
													class={`py-2 px-2.5 rounded-[12px] border flex items-center justify-between transition-all ${
														similarFilter() === 'all'
															? 'bg-[#0098EA]/20 border-[#0098EA]/50 text-[#0098EA] font-black'
															: 'bg-[#08090D] border-white/10 text-white/60 hover:text-white'
													}`}
												>
													<span>{tr('همه موارد', 'All Matches')}</span>
													<span class="px-1.5 py-0.5 rounded bg-white/10 text-[9px]">
														{similarCounts().all}
													</span>
												</button>

												<button
													type="button"
													onClick={() => setSimilarFilter('semantic')}
													class={`py-2 px-2.5 rounded-[12px] border flex items-center justify-between transition-all ${
														similarFilter() === 'semantic'
															? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-black'
															: 'bg-[#08090D] border-white/10 text-white/60 hover:text-white'
													}`}
												>
													<span>{tr('هم‌معنی و مفهومی', 'Semantic Meaning')}</span>
													<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px]">
														{similarCounts().semantic}
													</span>
												</button>

												<button
													type="button"
													onClick={() => setSimilarFilter('live_fragment')}
													class={`py-2 px-2.5 rounded-[12px] border flex items-center justify-between transition-all ${
														similarFilter() === 'live_fragment'
															? 'bg-[#0098EA]/20 border-[#0098EA]/50 text-[#0098EA] font-black'
															: 'bg-[#08090D] border-white/10 text-white/60 hover:text-white'
													}`}
												>
													<span>{tr('ریشه مشابه (فرگمنت)', 'Fragment Root')}</span>
													<span class="px-1.5 py-0.5 rounded bg-white/10 text-[9px]">
														{similarCounts().live_fragment}
													</span>
												</button>

												<button
													type="button"
													onClick={() => setSimilarFilter('structural')}
													class={`py-2 px-2.5 rounded-[12px] border flex items-center justify-between transition-all ${
														similarFilter() === 'structural'
															? 'bg-[#0098EA]/20 border-[#0098EA]/50 text-[#0098EA] font-black'
															: 'bg-[#08090D] border-white/10 text-white/60 hover:text-white'
													}`}
												>
													<span>{tr('هم‌طول و ساختار', 'Same Length')}</span>
													<span class="px-1.5 py-0.5 rounded bg-white/10 text-[9px]">
														{similarCounts().structural}
													</span>
												</button>
											</div>

											<div class="flex flex-col gap-2.5">
												<For each={filteredSimilar()}>
													{(item) => {
														const badge = similarBadge(item);
														const hasPrice = (item.sale_price ?? 0) > 0;
														const isSemantic = item.category === 'semantic';
														return (
															<div
																onClick={() => openReport(item.username)}
																class={`flex items-center justify-between gap-3 bg-[#08090D] hover:bg-white/[0.04] p-3.5 rounded-[18px] border transition-all cursor-pointer group ${
																	isSemantic
																		? 'border-emerald-500/20 hover:border-emerald-400/50'
																		: 'border-white/5 hover:border-[#0098EA]/35'
																}`}
															>
																<div class="flex flex-col gap-1 min-w-0 flex-1">
																	<div class="flex items-center gap-2 min-w-0 flex-wrap">
																		<span
																			class="text-[#0098EA] font-mono font-black text-[14px] group-hover:underline truncate"
																			dir="ltr"
																		>
																			@{item.username}
																		</span>
																		<span
																			class={`text-[9px] font-black uppercase px-2 py-0.5 rounded-[6px] border shrink-0 whitespace-nowrap ${badge.class}`}
																		>
																			{badge.label}
																		</span>
																		<Show when={item.semantic_score}>
																			<span class="text-[9px] font-mono font-black text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
																				{item.semantic_score}% MEANING
																			</span>
																		</Show>
																	</div>
																	<span class="text-white/55 text-[11px] font-medium truncate">
																		{item.reason}
																	</span>
																</div>

																<div class="flex flex-col items-end shrink-0">
																	<Show
																		when={hasPrice}
																		fallback={
																			<span class="text-emerald-400/80 text-[10px] font-mono font-bold">
																				{tr('تحلیل هم‌معنی ←', 'Inspect ↗')}
																			</span>
																		}
																	>
																		<span class="text-white font-mono font-black text-[13px] whitespace-nowrap">
																			{fmtTon(item.sale_price)} TON
																		</span>
																		<Show when={(item.sale_price_usd ?? 0) > 0}>
																			<span class="text-white/40 text-[10px] font-mono font-bold whitespace-nowrap">
																				≈ ${fmtUsd(item.sale_price_usd)}
																			</span>
																		</Show>
																	</Show>
																</div>
															</div>
														);
													}}
												</For>
											</div>
										</div>
									</div>
								</Show>

								{/* ════════════════════════════════════════════════════════════════
								    TAB 4: ANATOMY, LAYA COGNITIVE, HOMOGLYPHS & LEGAL
								    ════════════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'anatomy'}>
									<div class="w-full flex flex-col gap-3.5 text-start">
										{/* 1. Linguistic Meaning & Datamuse Dictionary */}
										<div class="w-full bg-gradient-to-br from-[#0098EA]/15 via-[#12141C]/90 to-[#08090D] backdrop-blur-2xl border border-[#0098EA]/30 rounded-[26px] p-5 flex flex-col gap-3 shadow-xl">
											<div class="flex items-center justify-between border-b border-[#0098EA]/20 pb-2.5">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[20px] text-[#0098EA]">
														translate
													</span>
													<span class="text-[12px] font-black uppercase tracking-wider text-[#0098EA]">
														{t('valuation.ling_meaning_title') || 'LEXICAL MEANING & DICTIONARY'}
													</span>
												</div>
												<span
													class={`text-[9px] font-black uppercase px-2.5 py-1 rounded-[8px] border ${
														data()?.dictionary?.is_word
															? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/40'
															: 'bg-white/5 text-white/40 border-white/10'
													}`}
												>
													{data()?.dictionary?.is_word
														? t('valuation.dict_word_title') || 'DICTIONARY WORD'
														: t('valuation.dict_none') || 'GENERIC HANDLE'}
												</span>
											</div>

											<Show
												when={data()?.dictionary?.is_word && data()?.dictionary?.definition}
												fallback={
													<div class="bg-[#08090D]/70 rounded-[16px] p-3.5 border border-white/5 text-white/50 text-[11px]">
														{t('valuation.not_dict_word_desc') ||
															'Non-dictionary brand/alphanumeric handle without recorded standard English dictionary definitions.'}
													</div>
												}
											>
												<div class="bg-[#08090D]/90 rounded-[16px] p-3.5 border border-[#0098EA]/20 text-white/90 text-[12px] leading-relaxed flex flex-col gap-1">
													<div class="flex items-center justify-between">
														<Show when={data()?.dictionary?.part_of_speech}>
															<span class="text-[10px] text-[#0098EA] font-mono font-bold uppercase">
																[{data()?.dictionary?.part_of_speech}]
															</span>
														</Show>
														<Show when={(data()?.dictionary?.word_frequency ?? 0) > 0}>
															<span class="text-[10px] text-emerald-400 font-mono font-bold">
																Freq: {data()?.dictionary?.word_frequency}/M words
															</span>
														</Show>
													</div>
													<span class="italic">"{data()?.dictionary?.definition}"</span>
												</div>
											</Show>

											<Show when={data()?.wikipedia_summary}>
												<div class="bg-[#08090D]/80 rounded-[16px] p-3.5 border border-white/5 flex flex-col gap-1">
													<span class="text-[10px] font-black text-amber-400 uppercase tracking-wider">
														{t('valuation.wiki_summary_title') || 'BENCHMARK CONTEXT'}
													</span>
													<p class="text-[11px] text-white/75 leading-relaxed">
														{data()?.wikipedia_summary}
													</p>
												</div>
											</Show>
										</div>

										{/* 2. Structural & Phonetic Anatomy */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-5 flex flex-col gap-3.5 shadow-xl">
											<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[20px] text-[#0098EA]">
														dna
													</span>
													<span class="text-[12px] font-black uppercase tracking-wider text-white">
														{t('valuation.anatomy_title') || 'STRUCTURAL ANATOMY'}
													</span>
												</div>
												<span class="text-[10px] font-mono font-black text-white/50 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-[8px]">
													{data()?.length || username().length} CHARS · SEO {data()?.seo?.score}/100
												</span>
											</div>

											<div class="grid grid-cols-2 gap-2.5">
												<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex items-center justify-between">
													<div class="flex flex-col">
														<span class="text-white/40 text-[9px] font-black uppercase">
															{t('valuation.letters_only') || 'LETTERS ONLY'}
														</span>
														<span class="text-[12px] font-bold text-white">
															{data()?.structure?.letters_only ? 'Pure Alpha' : 'Mixed'}
														</span>
													</div>
													<span
														class={`material-symbols-outlined text-[19px] ${
															data()?.structure?.letters_only ? 'text-[#10b981]' : 'text-amber-400'
														}`}
													>
														{data()?.structure?.letters_only ? 'check_circle' : 'info'}
													</span>
												</div>

												<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex items-center justify-between">
													<div class="flex flex-col">
														<span class="text-white/40 text-[9px] font-black uppercase">
															{tr('روانی تلفظ آوایی', 'PRONOUNCEABILITY')}
														</span>
														<span class="text-[12px] font-bold text-white">
															{data()?.structure?.is_pronounceable
																? tr('بسیار خوش‌آوا', 'Fluent CVCV')
																: tr('استاندارد', 'Standard')}
														</span>
													</div>
													<span class="material-symbols-outlined text-[19px] text-[#0098EA]">
														record_voice_over
													</span>
												</div>

												<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex items-center justify-between">
													<div class="flex flex-col">
														<span class="text-white/40 text-[9px] font-black uppercase">
															{t('valuation.has_digits') || 'NUMBERS'}
														</span>
														<span class="text-[12px] font-bold text-white">
															{data()?.structure?.has_digits ? 'Contains Digits' : 'No Digits'}
														</span>
													</div>
													<span
														class={`material-symbols-outlined text-[19px] ${
															data()?.structure?.has_digits ? 'text-amber-400' : 'text-[#10b981]'
														}`}
													>
														{data()?.structure?.has_digits ? 'pin' : 'check_circle'}
													</span>
												</div>

												<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex items-center justify-between">
													<div class="flex flex-col">
														<span class="text-white/40 text-[9px] font-black uppercase">
															{t('valuation.has_underscore') || 'UNDERSCORE (_)'}
														</span>
														<span class="text-[12px] font-bold text-white">
															{data()?.structure?.has_underscore ? 'Contains (_)' : 'Clean (No _)'}
														</span>
													</div>
													<span
														class={`material-symbols-outlined text-[19px] ${
															data()?.structure?.has_underscore
																? 'text-amber-400'
																: 'text-[#10b981]'
														}`}
													>
														{data()?.structure?.has_underscore ? 'horizontal_rule' : 'check_circle'}
													</span>
												</div>
											</div>
										</div>

										{/* 3. LAYA Cognitive Card & Buyer Personas */}
										<LayaMultiDimensionalCard
											decision={data()?.laya_system_one || data()?.reasoning_log?.laya_system_one}
											username={data()?.username || username()}
										/>

										<TargetBuyerPersonaCard
											detectedPersona={
												data()?.target_buyer_profile || data()?.laya_system_one?.buyer_archetype
											}
											username={data()?.username || username()}
										/>

										{/* 4. Homoglyph & Anti-Phishing Visual Twins Radar */}
										<Show when={(data()?.homoglyph_twins?.length ?? 0) > 0}>
											<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-amber-500/25 rounded-[26px] p-5 flex flex-col gap-3 shadow-xl">
												<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
													<div class="flex items-center gap-2">
														<span class="material-symbols-outlined text-[20px] text-amber-400">
															shield_lock
														</span>
														<span class="text-[12px] font-black uppercase tracking-wider text-white">
															{tr(
																'رادار همزادهای فیشینگ و تشابه بصری',
																'HOMOGLYPH & SPOOFING TWINS RADAR',
																'РАДАР ОМОГЛИФОВ И ФИШИНГА',
																'同形异义词与防钓鱼雷达',
															)}
														</span>
													</div>
													<span class="text-[9px] font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded">
														{data()?.homoglyph_twins?.length} TWINS
													</span>
												</div>

												<div class="flex flex-col gap-2">
													<For each={data()?.homoglyph_twins}>
														{(tw) => (
															<div
																onClick={() => openReport(tw.twin)}
																class="flex items-center justify-between bg-[#08090D] hover:bg-white/[0.04] border border-white/5 rounded-[14px] p-3 cursor-pointer transition-all"
															>
																<div class="flex flex-col min-w-0">
																	<div class="flex items-center gap-2">
																		<span
																			class="text-white font-mono font-black text-[13px]"
																			dir="ltr"
																		>
																			@{tw.twin}
																		</span>
																		<span class="text-[9px] font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded">
																			{tw.risk_level} RISK
																		</span>
																	</div>
																	<span class="text-[10px] text-white/45">{tw.similarity}</span>
																</div>
																<div class="flex flex-col items-end shrink-0">
																	<Show
																		when={(tw.price_ton ?? 0) > 0}
																		fallback={
																			<span class="text-[10px] font-mono text-white/40 uppercase">
																				{tw.status}
																			</span>
																		}
																	>
																		<span class="text-[12px] font-mono font-black text-emerald-400">
																			{fmtTon(tw.price_ton)} TON
																		</span>
																	</Show>
																</div>
															</div>
														)}
													</For>
												</div>
											</div>
										</Show>

										{/* 5. Telegram ToS §4 & Trademark Liability Matrix */}
										<TelegramTOSLegalMatrix
											trademarkRisk={data()?.trademark_risk}
											username={data()?.username || username()}
										/>
									</div>
								</Show>

								{/* Audit Footer */}
								<div class="w-full flex flex-col items-center gap-1 pt-3 opacity-45 text-center">
									<span class="text-white/60 text-[10px] font-mono">
										{t('valuation.data_freshness_stamp', {
											date: new Date().toLocaleDateString('en-GB'),
										}) || `Live On-Chain Audit · ${new Date().toLocaleDateString('en-GB')}`}
									</span>
									<span class="text-white/40 text-[10px] font-mono">
										1 TON ≈ ${data()?.ton_usd_rate?.toFixed(2) || '5.25'} USD (Live TonAPI Rate)
									</span>
								</div>
							</Show>
						</Show>
					</div>

					{/* ═══════ METHODOLOGY MODAL ═══════ */}
					<Show when={showMethodologyModal()}>
						<div class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
							<div class="bg-[#12141C] border border-white/10 rounded-[32px] p-6 max-w-sm w-full flex flex-col gap-4 text-start">
								<div class="flex items-center justify-between border-b border-white/5 pb-3">
									<h3 class="text-white font-black text-[16px]">
										{t('valuation.confidence_methodology') || 'AVM v7.0 Methodology'}
									</h3>
									<button
										type="button"
										onClick={() => setShowMethodologyModal(false)}
										class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60"
									>
										<span class="material-symbols-outlined text-[18px]">close</span>
									</button>
								</div>
								<p class="text-white/70 text-[12px] leading-relaxed">
									{t('valuation.confidence_explanation') ||
										'Calculated using live Fragment ownership & auction bid history, TEP-62 TeleMint smart contract verification on TonAPI, Datamuse lexical frequency & semantic synonyms, and verified historical comparable sales.'}
								</p>
								<button
									type="button"
									onClick={() => setShowMethodologyModal(false)}
									class="w-full h-11 bg-[#0098EA] text-white font-black text-[12px] rounded-[16px] uppercase"
								>
									{t('valuation.close') || 'Close'}
								</button>
							</div>
						</div>
					</Show>

					{/* ═══════ HIDDEN EXPORT CARD (@skulls Obsidian Luxury Design) ═══════ */}
					<div class="fixed left-[-9999px] top-[-9999px] pointer-events-none" dir="ltr">
						<div
							ref={hiddenCardRef}
							class={`w-[400px] h-[400px] p-[3px] bg-gradient-to-br ${
								getTierTheme(data()?.rarity?.tier || '').wrapper
							} rounded-[40px] flex flex-col overflow-hidden bg-[#050609]`}
						>
							<div class="w-full h-full bg-[#08090D] rounded-[37px] p-7 flex flex-col justify-between relative overflow-hidden">
								<div class="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
								<div class="flex justify-between items-center z-10">
									<span
										class={`px-3.5 py-1.5 border rounded-[12px] text-[10px] font-black tracking-[0.18em] uppercase shadow-sm ${
											getTierTheme(data()?.rarity?.tier || '').badge
										}`}
									>
										{data()?.rarity?.tier || 'COMMON'}
									</span>
									<span class="text-[10px] font-mono font-black text-white/60 tracking-[4px] uppercase bg-white/[0.04] border border-white/10 px-3.5 py-1.5 rounded-[12px]">
										{'IFRAGMENT'}
									</span>
								</div>

								<div class="flex flex-col justify-center items-center z-10 text-center flex-grow py-4 w-full">
									<div class="inline-flex items-center justify-center gap-2.5 max-w-full">
										<span class="text-sky-300/90 text-lg select-none">✦</span>
										<span
											class="inline-block font-black tracking-tighter text-white truncate max-w-[82%]"
											style={{ 'font-size': getFontSize(data()?.username || username()) }}
											dir="ltr"
										>
											@{data()?.username || username()}
										</span>
										<span class="text-sky-300/90 text-lg select-none">✦</span>
									</div>
								</div>

								<div class="flex justify-between items-end border-t border-white/10 pt-4 z-10">
									<div class="flex flex-col gap-1 text-left">
										<span class="text-[9px] font-black text-white/45 uppercase tracking-[0.16em]">
											ESTIMATED MARKET PRICE
										</span>
										<div class="flex items-center gap-2">
											<span class="w-6 h-6 rounded-full bg-[#0098EA] inline-flex items-center justify-center text-white text-[11px] font-black shadow-[0_0_12px_rgba(0,152,234,0.45)]">
												▼
											</span>
											<span class="text-[28px] font-black text-white leading-none tracking-tight">
												{fmtTon(expectedTon())}
											</span>
											<span class="text-[13px] font-black text-[#0098EA] mb-0.5">
												TON
											</span>
										</div>
									</div>
									<div class="flex flex-col items-end gap-1.5">
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[8px] font-black text-emerald-400 tracking-widest uppercase">
											● VERIFIED
										</span>
										<span class="text-[14px] text-white/75 font-black leading-none font-mono">
											≈ ${fmtUsd(parseFloat(data()?.expected_usd || '0') || expectedTon() * 3.48)}
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</Show>
		</Show>
	);
};

export default UsernamePage;
