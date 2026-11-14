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
import {
	FragHandle,
	FragKV,
	FragNftTile,
	FragSectionHeader,
	FragStat,
	FragStatusPill,
	normalizeFragStatus,
	primaryMintFloorTon,
	TonAmount,
	TonIcon,
} from '@/shared/ui/fragment/FragmentPrimitives.js';
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
				label: t('usernamePage.badgeVerifiedSale'),
				class: 'bg-[#10b981]/15 text-[#4cd964] border-[#10b981]/30',
			};
		}
		if (status === 'on_auction') {
			return {
				label: t('usernamePage.badgeLiveAuction'),
				class: 'bg-amber-400/15 text-[#ffb340] border-amber-400/30',
			};
		}
		if (status === 'on_sale') {
			return {
				label: t('usernamePage.badgeForSale'),
				class: 'bg-[#2990FF]/15 text-[#2990FF] border-[#2990FF]/30',
			};
		}
		if (status === 'taken' || status === 'sold') {
			return {
				label: t('usernamePage.badgeTaken'),
				class: 'bg-white/10 text-white/60 border-white/15',
			};
		}
		if (status === 'available') {
			return {
				label: t('usernamePage.badgeAvailable'),
				class: 'bg-emerald-400/10 text-[#4cd964] border-emerald-400/20',
			};
		}
		return {
			label: t('usernamePage.badgeChecked'),
			class: 'bg-white/5 text-[#8c9ba5] border-white/[0.08]',
		};
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
				badge: 'bg-[#ffaa00]/15 border-[#ffaa00]/40 text-[#ffaa00]',
				text: 'from-[#ffeaa7] via-[#ffaa00] to-[#ff7700]',
				glow: 'rgba(255,119,0,0.3)',
			};
		}
		if (tStr.includes('epic') || tStr.includes('elite') || tStr.includes('apex')) {
			return {
				wrapper: 'from-[#2990FF] via-[#2280e6] to-[#004B87]',
				badge: 'bg-[#2990FF]/15 border-[#2990FF]/40 text-[#2990FF]',
				text: 'from-[#e0f2fe] via-[#38bdf8] to-[#2990FF]',
				glow: 'rgba(41, 144, 255,0.3)',
			};
		}
		if (tStr.includes('rare') || tStr.includes('premium') || tStr.includes('grand')) {
			return {
				wrapper:
					'from-[#10b981] via-[#059669] to-[#047857] shadow-[0_20px_50px_rgba(16,185,129,0.35),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge: 'bg-[#10b981]/15 border-[#10b981]/40 text-[#4cd964]',
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
			return { color: '#2990FF', label: t('valuation.conf_medium') || 'MODERATE CONFIDENCE' };
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

	return (
		<Show
			when={!loading()}
			fallback={
				<div class="flex flex-col justify-center items-center h-screen frag-canvas text-white/60 gap-5 relative overflow-hidden">
					<div class="absolute inset-0 bg-gradient-to-b from-[#2990FF]/15 to-transparent blur-[120px]" />
					<div class="relative flex items-center justify-center w-20 h-20">
						<div class="absolute w-full h-full border-[3px] border-white/[0.06] border-t-[#2990FF] rounded-full animate-spin" />
						<span class="material-symbols-outlined text-[24px] text-[#2990FF] animate-pulse">
							radar
						</span>
					</div>
					<div class="flex flex-col items-center gap-1">
						<span class="text-[13px] font-semibold text-[#2990FF] animate-pulse">
							{t('valuation.analyzing') || 'Analyzing handle…'}
						</span>
						<span class="text-[11px] font-bold text-[#8c9ba5]">{t('valuation.onChainIntel')}</span>
					</div>
				</div>
			}
		>
			<Show
				when={!error()}
				fallback={
					<div class="min-h-screen frag-canvas text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
						<div class="absolute inset-0 bg-gradient-to-b from-[#ff4a4a]/15 to-transparent blur-[120px]" />
						<div class="w-24 h-24 rounded-[10px] bg-[#ff4a4a]/10 flex items-center justify-center mb-6 border border-[#ff4a4a]/30 z-10">
							<span class="material-symbols-outlined text-[48px] text-[#ff4a4a]">gpp_bad</span>
						</div>
						<h1 class="text-[22px] font-semibold mb-2 tracking-tight z-10 font-mono">
							{t('valuation.error_title') || 'Appraisal unavailable'}
						</h1>
						<p class="text-[13px] text-[#8c9ba5] leading-relaxed mb-8 max-w-[280px] font-medium z-10">
							{error()}
						</p>
						<button
							type="button"
							onClick={() => window.history.back()}
							class="h-14 px-10 bg-[#1b232d] hover:bg-white/10 border border-white/[0.08] text-white font-semibold text-[13px] rounded-[10px] transition-all active:scale-95 shadow-sm z-10 backdrop-blur-md"
						>
							{t('valuation.back') || 'Back'}
						</button>
					</div>
				}
			>
				<div
					class="min-h-screen frag-canvas text-white px-4 py-4 flex flex-col items-center font-frag-sans pb-32 select-none relative overflow-x-hidden overflow-y-auto w-full"
					style={{ 'touch-action': 'pan-y' }}
					dir={isRtl() ? 'rtl' : 'ltr'}
				>
					{/* Ambient Dynamic Background */}
					<div
						class="fixed top-0 left-1/2 -translate-x-1/2 w-[150vw] h-[500px] blur-[120px] pointer-events-none z-0 opacity-[0.10] transition-colors duration-1000"
						style={{
							background: `radial-gradient(circle, ${
								accessGranted()
									? getTierTheme(data()?.rarity?.tier || '').glow
									: 'rgba(41, 144, 255,0.25)'
							} 0%, transparent 60%)`,
						}}
					/>

					<div class="w-full max-w-[500px] flex flex-col items-center gap-3.5 relative z-10">
						<Show
							when={username()}
							fallback={
								/* ═══════ MODE A: USERNAME DISCOVERY & VALUATION HUB ═══════ */
								<div class="w-full max-w-[500px] flex flex-col items-center gap-4 relative z-10 pt-2 pb-12">
									<div class="w-full flex flex-col items-start text-start gap-2 pt-1">
										<div class="inline-flex items-center gap-1.5 text-[12px] text-[#8c9ba5]">
											<TonIcon size={13} />
											<span>{t('usernamePage.heroEyebrow')}</span>
											<span class="text-white/15">·</span>
											<span class="font-mono">{'AVM v8.0'}</span>
										</div>
										<h1 class="text-[26px] leading-[1.15] font-semibold tracking-[-0.025em] text-white">
											{layaT(USERNAME_I18N.radarTitle)}
										</h1>
										<p class="text-[13px] text-[#8c9ba5] leading-relaxed max-w-[360px]">
											{layaT(USERNAME_I18N.radarDesc)}
										</p>
									</div>

									{/* Fragment-style @username search with live address preview */}
									<div class="frag-card w-full p-3 flex flex-col gap-3 text-start">
										<div class="relative flex items-center w-full" dir="ltr">
											<span class="material-symbols-outlined absolute left-3.5 text-[19px] text-[#60707c] pointer-events-none">
												search
											</span>
											<span class="absolute left-10 text-[16px] font-medium text-[#2990ff] pointer-events-none select-none">
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
												class="w-full h-12 bg-[#141a22] border border-white/[0.08] focus:border-[#2990ff]/70 rounded-[10px] pl-[3.4rem] pr-10 text-white font-medium text-[16px] tracking-[-0.01em] placeholder:text-[#60707c] focus:outline-none focus:ring-4 focus:ring-[#2990ff]/12 transition-[border-color,box-shadow]"
												autocomplete="off"
												autocapitalize="off"
												spellcheck={false}
											/>
											<Show when={searchTerm().length > 0}>
												<button
													type="button"
													onClick={() => setSearchTerm('')}
													class="absolute right-2.5 w-7 h-7 rounded-[7px] text-[#8c9ba5] hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors"
													aria-label="clear"
												>
													<span class="material-symbols-outlined text-[17px]">close</span>
												</button>
											</Show>
										</div>

										<Show when={searchTerm().length > 0}>
											<div class="frag-table-container">
												<FragKV label={t('usernamePage.webAddress')}>
													<span class="font-mono" dir="ltr">
														t.me/{searchTerm()}
													</span>
												</FragKV>
												<FragKV label={t('usernamePage.tonWeb3Address')}>
													<span class="font-mono" dir="ltr">
														{searchTerm()}.t.me
													</span>
												</FragKV>
												<FragKV
													label={t('usernamePage.lengthLabel')}
													hint={
														searchTerm().length < 4
															? layaT(USERNAME_I18N.charShort)
															: searchTerm().length === 4
																? layaT(USERNAME_I18N.charGrail)
																: layaT(USERNAME_I18N.charStandard)
													}
												>
													<span
														class={`font-mono tabular-nums ${
															searchTerm().length < 4
																? 'text-[#ff6b6b]'
																: searchTerm().length === 4
																	? 'text-[#ffb340]'
																	: 'text-white'
														}`}
													>
														{searchTerm().length} {layaT(USERNAME_I18N.charsLabel)}
													</span>
												</FragKV>
												<Show when={searchTerm().length >= 4}>
													<FragKV label={t('usernamePage.primaryAuctionMinBid')} hint="TeleMint">
														<TonAmount size="sm" value={primaryMintFloorTon(searchTerm().length)} />
													</FragKV>
												</Show>
											</div>
										</Show>

										<div class="grid grid-cols-2 gap-2">
											<button
												type="button"
												disabled={searchTerm().length < 4}
												onClick={() => openReport(searchTerm())}
												class="h-11 rounded-[10px] bg-[#2990ff] hover:bg-[#3d9bff] active:bg-[#2280e6] disabled:opacity-40 disabled:pointer-events-none text-white text-[14px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
											>
												<span>{layaT(USERNAME_I18N.btnValuate)}</span>
											</button>
											<button
												type="button"
												disabled={searchTerm().length < 4 || verifyingOnChain()}
												onClick={() => fetchVerification(searchTerm())}
												class="h-11 rounded-[10px] bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] disabled:opacity-40 disabled:pointer-events-none text-white text-[14px] font-medium flex items-center justify-center gap-1.5 transition-colors"
											>
												<span
													class={`material-symbols-outlined text-[17px] text-[#8c9ba5] ${verifyingOnChain() ? 'animate-spin' : ''}`}
												>
													{verifyingOnChain() ? 'progress_activity' : 'verified'}
												</span>
												<span>{layaT(USERNAME_I18N.btnVerifyOnChain)}</span>
											</button>
										</div>
									</div>

									{/* On-Chain Instant Verification Box */}
									<Show when={verificationData()}>
										{(ver) => (
											<div class="w-full frag-card p-4 flex flex-col gap-3 text-start">
												<div class="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
													<div class="flex items-center gap-2">
														<span
															class={`material-symbols-outlined text-[18px] ${
																ver().is_minted_nft && ver().collection_verified
																	? 'text-[#4cd964]'
																	: 'text-[#ffb340]'
															}`}
														>
															{ver().is_minted_nft && ver().collection_verified
																? 'verified'
																: 'info'}
														</span>
														<span class="text-[13px] font-semibold font-mono text-white" dir="ltr">
															@{ver().username}
														</span>
													</div>
													<span
														class={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-[6px] border ${
															ver().is_minted_nft && ver().collection_verified
																? 'bg-emerald-500/15 border-emerald-500/30 text-[#4cd964]'
																: 'bg-amber-400/15 border-amber-400/30 text-[#ffb340]'
														}`}
													>
														{ver().is_minted_nft && ver().collection_verified
															? layaT(USERNAME_I18N.statusTelemint)
															: layaT(USERNAME_I18N.statusNotTokenized)}
													</span>
												</div>

												<div class="flex flex-col gap-1.5 text-[11px] font-mono text-white/70">
													<div class="flex justify-between items-center">
														<span class="text-[#8c9ba5]">
															{layaT(USERNAME_I18N.telegramStatus)}
														</span>
														<span class="text-white font-bold">{ver().telegram_status}</span>
													</div>
													<Show when={ver().telemint_provenance?.item_address}>
														<div class="flex justify-between items-center">
															<span class="text-[#8c9ba5]">
																{layaT(USERNAME_I18N.itemContract)}
															</span>
															<a
																href={`https://tonviewer.com/${ver().telemint_provenance.item_address}`}
																target="_blank"
																rel="noreferrer"
																class="text-[#2990FF] hover:underline"
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
													class="w-full h-10 rounded-[10px] bg-[#2990FF]/20 hover:bg-[#2990FF]/30 border border-[#2990FF]/40 text-[#2990FF] font-mono font-semibold text-[11px] flex items-center justify-center gap-1.5 active:scale-95 transition-all mt-1"
												>
													<span>{layaT(USERNAME_I18N.viewFullReport)}</span>
													<span class="material-symbols-outlined text-[15px]">arrow_forward</span>
												</button>
											</div>
										)}
									</Show>

									{/* Trending — rendered as a Fragment table */}
									<div class="w-full flex flex-col gap-2 text-start">
										<div class="flex items-baseline justify-between px-0.5">
											<span class="text-[14px] font-semibold text-white tracking-[-0.01em]">
												{layaT(USERNAME_I18N.trendingHandles)}
											</span>
											<span class="text-[12px] text-[#60707c]">
												{layaT(USERNAME_I18N.tapToInspect)}
											</span>
										</div>
										<div class="frag-table-container">
											<div class="frag-table-header grid grid-cols-[1fr_auto_20px] gap-3 px-3.5 py-2">
												<span>{t('usernamePage.usernameCol')}</span>
												<span class="text-end">{t('usernamePage.lengthCol')}</span>
												<span />
											</div>
											<For
												each={['news', 'durov', 'bank', 'crypto', 'rolex', 'rare', 'gift', 'king']}
											>
												{(h) => (
													<button
														type="button"
														onClick={() => openReport(h)}
														class="frag-table-row w-full grid grid-cols-[1fr_auto_20px] gap-3 items-center px-3.5 py-2.5 text-start"
													>
														<FragHandle handle={h} size="sm" subline />
														<span class="text-[12px] font-mono text-[#8c9ba5] tabular-nums text-end">
															{h.length} {t('usernamePage.charsUnit')}
														</span>
														<span class="material-symbols-outlined text-[18px] text-[#60707c] rtl:rotate-180">
															chevron_right
														</span>
													</button>
												)}
											</For>
										</div>
									</div>

									<LayaCategoriesExplorer onSelectHandle={(h) => openReport(h)} />

									<Show when={recents().length > 0}>
										<div class="w-full flex flex-col gap-2.5 text-start">
											<div class="flex items-center justify-between px-1">
												<span class="text-[11px] font-semibold text-[#8c9ba5] flex items-center gap-1.5">
													<span class="material-symbols-outlined text-[16px] text-[#2990FF]">
														history
													</span>
													{layaT(USERNAME_I18N.recentAudits)}
												</span>
												<span class="text-[11px] font-mono text-[#60707c]">
													{recents().length} {layaT(USERNAME_I18N.itemsCount)}
												</span>
											</div>
											<div class="grid grid-cols-1 xs:grid-cols-2 gap-2 w-full">
												<For each={recents().slice(0, 6)}>
													{(rep) => (
														<button
															type="button"
															onClick={() => openReport(rep.username)}
															class="p-3 rounded-[10px] bg-[#141a22] hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#2990FF]/30 transition-all text-start flex items-center justify-between gap-2 active:scale-95"
														>
															<div class="flex flex-col min-w-0">
																<span
																	class="text-white font-mono font-bold text-[13px] truncate"
																	dir="ltr"
																>
																	@{rep.username}
																</span>
																<span class="text-[#8c9ba5] text-[11px] font-mono">
																	{new Date(rep.savedAt).toLocaleDateString()}
																</span>
															</div>
															<div class="flex flex-col items-end shrink-0">
																<span class="text-[#4cd964] font-mono font-semibold text-[12px]">
																	{rep.expectedTon
																		? `${fmtTon(parseFloat(rep.expectedTon))} TON`
																		: 'View'}
																</span>
																<span class="text-[11px] font-semibold text-[#2990FF] bg-[#2990FF]/10 px-1.5 py-0.5 rounded">
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
							{/* ═══════ COMPACT FRAGMENT BREADCRUMB & QUICK SWITCH BAR ═══════ */}
							<div class="w-full flex flex-col gap-2">
								<div class="frag-card w-full px-3 py-2 flex items-center justify-between gap-2">
									<div class="flex items-center gap-1.5 min-w-0">
										<button
											type="button"
											onClick={() => navigate('/username/report')}
											class="w-8 h-8 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[#8c9ba5] hover:text-white flex items-center justify-center shrink-0 transition-colors"
											title={t('usernamePage.allUsernamesTitle')}
										>
											<span class="material-symbols-outlined text-[18px] rtl:rotate-180">
												arrow_back
											</span>
										</button>
										<div class="flex items-center gap-1.5 min-w-0 text-[13px] font-medium">
											<button
												type="button"
												onClick={() => navigate('/collection-info')}
												class="text-[#8c9ba5] hover:text-white truncate transition-colors hidden sm:inline"
											>
												{t('usernamePage.usernamesCrumb')}
											</button>
											<span class="text-white/20 hidden sm:inline">/</span>
											<span class="font-semibold text-white truncate" dir="ltr">
												<span class="text-[#2990FF]">@</span>
												{data()?.username || username()}
											</span>
										</div>
									</div>

									<div class="flex items-center gap-1.5 shrink-0">
										<button
											type="button"
											onClick={() => setShowQuickSearch((prev) => !prev)}
											class={`h-8 px-2.5 rounded-[8px] border text-[12px] font-medium flex items-center gap-1 transition-colors ${
												showQuickSearch()
													? 'bg-[#2990FF]/15 border-[#2990FF]/40 text-[#2990FF]'
													: 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.07] text-[#a9b6bf] hover:text-white'
											}`}
										>
											<span class="material-symbols-outlined text-[15px]">search</span>
											<span>{t('usernamePage.switchBtn')}</span>
										</button>

										<button
											type="button"
											onClick={() =>
												handleCopy(`https://fragment.com/username/${username()}`, 'frag_link')
											}
											class="w-8 h-8 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-[#a9b6bf] hover:text-white flex items-center justify-center transition-colors"
											title={t('usernamePage.copyFragmentUrl')}
										>
											<span class="material-symbols-outlined text-[15px]">
												{copiedText() === 'frag_link' ? 'check' : 'link'}
											</span>
										</button>

										<Show when={accessGranted()}>
											<button
												type="button"
												disabled={refreshing()}
												onClick={() => fetchValuation(username(), { force: true })}
												class="w-8 h-8 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-[#a9b6bf] hover:text-white flex items-center justify-center transition-colors"
												title={t('usernamePage.refreshTelemetry')}
											>
												<span
													class={`material-symbols-outlined text-[16px] ${refreshing() ? 'animate-spin text-[#2990FF]' : ''}`}
												>
													refresh
												</span>
											</button>
										</Show>
									</div>
								</div>

								<Show when={showQuickSearch()}>
									<div class="frag-card p-2.5 flex items-center gap-2">
										<div class="relative flex-1 flex items-center" dir="ltr">
											<span class="material-symbols-outlined absolute left-3 text-[16px] text-[#60707c] pointer-events-none">
												search
											</span>
											<span class="absolute left-8 text-[14px] font-medium text-[#2990FF] pointer-events-none select-none">
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
												placeholder={t('usernamePage.switchPlaceholder')}
												class="w-full h-9 bg-[#141a22] border border-white/[0.08] focus:border-[#2990FF]/70 rounded-[8px] pl-12 pr-3 text-white font-medium text-[13px] placeholder:text-[#60707c] focus:outline-none"
												autocomplete="off"
												autocapitalize="off"
												spellcheck={false}
											/>
										</div>
										<button
											type="button"
											disabled={quickQuery().length < 4}
											onClick={() => openReport(quickQuery())}
											class="h-9 px-3.5 rounded-[8px] bg-[#2990FF] hover:bg-[#3d9bff] disabled:opacity-40 text-white font-semibold text-[12px] shrink-0 transition-colors"
										>
											{t('usernamePage.goBtn')}
										</button>
									</div>
								</Show>
							</div>

							{/* ═══════ UNLOCKED vs PAYWALL GATE ═══════ */}
							<Show
								when={accessGranted() && data()}
								fallback={
									<div class="w-full max-w-[500px] mx-auto my-1 flex flex-col gap-3 relative z-20">
										<div class="frag-collectible-pass w-full overflow-hidden text-start">
											<div class="p-4 pb-3.5 flex gap-3.5">
												<FragNftTile handle={username()} class="w-[88px] h-[88px] shrink-0" />
												<div class="flex flex-col min-w-0 flex-1 justify-center gap-1.5">
													<div class="flex items-center gap-1.5 flex-wrap">
														<span class="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[6px] text-[11px] font-medium text-[#4cd964] bg-[#4cd964]/10 border border-[#4cd964]/25">
															<span class="w-1.5 h-1.5 rounded-full bg-[#4cd964] animate-pulse" />
															{t('valuation.report_ready') || 'Appraisal ready'}
														</span>
														<Show when={verificationData()}>
															{(ver) => (
																<FragStatusPill
																	status={normalizeFragStatus(
																		ver().is_minted_nft
																			? ver().telegram_status || 'sold'
																			: 'unminted',
																	)}
																/>
															)}
														</Show>
													</div>
													<span
														class="text-[24px] font-semibold text-white tracking-[-0.025em] leading-none truncate"
														dir="ltr"
													>
														<span class="text-[#2990FF]">@</span>
														{username()}
													</span>
													<div class="flex items-center gap-1.5 flex-wrap" dir="ltr">
														<span class="frag-link-chip">t.me/{username()}</span>
														<span class="frag-link-chip">{username()}.t.me</span>
													</div>
												</div>
											</div>

											<div class="relative border-t border-white/[0.07] bg-black/[0.16] p-4 flex items-center justify-between gap-3">
												<div class="flex flex-col gap-1.5 filter blur-[5px] select-none opacity-75">
													<span class="text-[11px] text-[#8c9ba5]">
														{t('valuation.estimated_price') || 'Estimated fair value'}
													</span>
													<TonAmount size="lg" value="18,450" usd="96,860" />
												</div>
												<div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#2990FF]/15 border border-[#2990FF]/40 text-[#2990FF] text-[12px] font-medium shrink-0">
													<span class="material-symbols-outlined text-[15px]">lock</span>
													<span>{t('valuation.locked_tap_to_decrypt') || 'Unlock report'}</span>
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
								{/* ═══════ FRAGMENT-STYLE UNDERLINE TABS ═══════ */}
								<div class="w-full sticky top-0 z-30 bg-[#12171e]/90 backdrop-blur-xl border-b border-white/[0.07]">
									<div class="grid grid-cols-4">
										<For
											each={
												[
													{
														id: 'valuation',
														label: () => t('usernamePage.tabValuation'),
													},
													{
														id: 'onchain',
														label: () => t('usernamePage.tabOnchain'),
													},
													{
														id: 'similar',
														label: () => t('usernamePage.tabSimilar'),
													},
													{
														id: 'anatomy',
														label: () => t('usernamePage.tabAnatomy'),
													},
												] as const
											}
										>
											{(tab) => (
												<button
													type="button"
													onClick={() => {
														haptic.impact('light');
														setActiveTab(tab.id);
													}}
													class={`relative h-11 text-[13px] font-medium transition-colors ${
														activeTab() === tab.id
															? 'text-white'
															: 'text-[#8c9ba5] hover:text-white'
													}`}
												>
													{tab.label()}
													<span
														class={`absolute bottom-[-1px] left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-[#2990ff] transition-all duration-200 ${
															activeTab() === tab.id ? 'w-[56%] opacity-100' : 'w-0 opacity-0'
														}`}
													/>
												</button>
											)}
										</For>
									</div>
								</div>

								{/* ════════════════════════════════════════════════════════════════
								    TAB 1: VALUATION & LIVE MARKET SIGNAL
								    ════════════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'valuation'}>
									<div class="w-full flex flex-col gap-3.5">
										{/* Collectible pass — Fragment NFT artwork + appraisal header */}
										<div
											ref={cardRef}
											onMouseMove={handleMouseMove}
											onMouseLeave={handleMouseLeave}
											onTouchMove={handleTouchMove}
											onTouchEnd={handleTouchEnd}
											onTouchCancel={handleTouchEnd}
											class="frag-collectible-pass w-full relative overflow-hidden text-start"
											style={{
												transform: `perspective(1400px) rotateX(${tilt().x * 0.3}deg) rotateY(${tilt().y * 0.3}deg)`,
												transition: 'transform 0.12s ease-out',
											}}
										>
											<div
												class="absolute inset-0 pointer-events-none"
												style={{
													background: `radial-gradient(circle at ${tilt().glossX}% ${tilt().glossY}%, rgba(255,255,255,0.07) 0%, transparent 55%)`,
												}}
											/>

											{/* Identity */}
											<div class="relative p-4 pb-3.5 flex gap-3.5">
												<FragNftTile
													handle={data()?.username || username()}
													class="w-[104px] h-[104px] shrink-0"
												/>
												<div class="flex flex-col min-w-0 flex-1 gap-2 justify-center">
													<div class="flex items-center gap-1.5 flex-wrap">
														<FragStatusPill
															status={normalizeFragStatus(
																data()?.live_market?.status || data()?.status,
															)}
															pulse={data()?.live_market?.status === 'on_auction'}
														/>
														<span class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-medium text-[#a9b6bf] bg-white/[0.04] border border-white/[0.07] capitalize">
															{(data()?.rarity?.tier || 'standard').toLowerCase()}
														</span>
													</div>
													<span
														class="font-semibold text-white tracking-[-0.03em] leading-none truncate"
														style={{
															'font-size':
																(data()?.username || username()).length <= 5
																	? '30px'
																	: (data()?.username || username()).length <= 8
																		? '25px'
																		: '20px',
														}}
														dir="ltr"
													>
														<span class="text-[#2990ff]">@</span>
														{data()?.username || username()}
													</span>
													<div class="flex items-center gap-1.5 flex-wrap" dir="ltr">
														<a
															href={`https://t.me/${data()?.username || username()}`}
															target="_blank"
															rel="noreferrer"
															class="frag-link-chip"
														>
															t.me/{data()?.username || username()}
														</a>
														<a
															href={`https://${data()?.username || username()}.t.me`}
															target="_blank"
															rel="noreferrer"
															class="frag-link-chip"
														>
															{data()?.username || username()}.t.me
														</a>
													</div>
												</div>
											</div>

											<Show when={(data()?.tags || []).length > 0}>
												<div class="relative px-4 pb-3.5 flex flex-wrap gap-1.5">
													<For each={(data()?.tags || []).slice(0, 5)}>
														{(tag) => (
															<span class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] text-[#a9b6bf] bg-white/[0.035] border border-white/[0.06]">
																{tag}
															</span>
														)}
													</For>
												</div>
											</Show>

											{/* Appraisal */}
											<div class="relative border-t border-white/[0.07] bg-black/[0.14] px-4 pt-3.5 pb-4 flex flex-col gap-4">
												<div class="flex items-end justify-between gap-3">
													<div class="flex flex-col gap-2 min-w-0">
														<span class="text-[12px] text-[#8c9ba5]">
															{t('usernamePage.estimatedFairValue')}
														</span>
														<TonAmount
															size="xl"
															value={fmtTon(expectedTon())}
															usd={fmtUsd(parseFloat(data()?.expected_usd || '0'))}
														/>
													</div>
													<div class="flex flex-col items-end gap-1.5 shrink-0">
														<span class="h-7 min-w-[42px] px-2 rounded-[7px] inline-flex items-center justify-center font-mono font-semibold text-[13px] text-white bg-white/[0.06] border border-white/[0.1]">
															{data()?.quality_grade || 'AA+'}
														</span>
														<span
															class="text-[11px] font-mono tabular-nums"
															style={{ color: confidenceTheme().color }}
														>
															{t('usernamePage.confidence')} {data()?.confidence_score ?? 0}%
														</span>
													</div>
												</div>

												{/* P10 · P50 · P90 range with live market markers */}
												<div class="flex flex-col gap-2" dir="ltr">
													<div class="relative h-[6px] rounded-full bg-white/[0.06]">
														<div
															class="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#2990ff]/20 via-[#2990ff]/70 to-[#2990ff]/20"
															style={{ left: '4%', right: '4%' }}
														/>
														{(() => {
															const lm = data()?.live_market;
															const mk = lm?.is_vanity_ask
																? 0
																: lm?.current_bid_ton || lm?.buy_now_ton || 0;
															return (
																<Show when={mk > 0}>
																	<div
																		class="absolute top-1/2 w-[9px] h-[9px] rotate-45 bg-[#ffb340] border-[1.5px] border-[#1b232d] -translate-x-1/2 -translate-y-1/2"
																		style={{ left: `${bandPosition(mk)}%` }}
																		title={t('usernamePage.liveBidAsk')}
																	/>
																</Show>
															);
														})()}
														<Show when={(data()?.history?.highest_past_sale_ton ?? 0) > 0}>
															<div
																class="absolute top-1/2 w-[9px] h-[9px] rounded-full bg-[#4cd964] border-[1.5px] border-[#1b232d] -translate-x-1/2 -translate-y-1/2"
																style={{
																	left: `${bandPosition(data()?.history?.highest_past_sale_ton ?? 0)}%`,
																}}
																title={t('usernamePage.lastRealizedSale')}
															/>
														</Show>
														<div
															class="absolute top-1/2 w-[3px] h-[16px] rounded-full bg-white -translate-x-1/2 -translate-y-1/2"
															style={{ left: `${bandPosition(expectedTon())}%` }}
														/>
													</div>
													<div class="flex justify-between text-[11px] font-mono tabular-nums text-[#8c9ba5]">
														<span>P10 {fmtTon(lowTon())}</span>
														<span class="text-white">P50 {fmtTon(expectedTon())}</span>
														<span>P90 {fmtTon(highTon())}</span>
													</div>
													<div class="flex items-center gap-3 text-[11px] text-[#60707c]">
														<span class="inline-flex items-center gap-1.5">
															<span class="w-[3px] h-[10px] rounded-full bg-white" />
															{'AVM'}
														</span>
														<span class="inline-flex items-center gap-1.5">
															<span class="w-[7px] h-[7px] rotate-45 bg-[#ffb340]" />
															{t('usernamePage.liveMarketLegend')}
														</span>
														<span class="inline-flex items-center gap-1.5">
															<span class="w-[7px] h-[7px] rounded-full bg-[#4cd964]" />
															{t('usernamePage.lastSaleLegend')}
														</span>
													</div>
												</div>
											</div>

											<div
												class="relative flex items-center justify-between px-4 py-2.5 border-t border-white/[0.07] text-[11px] font-mono text-[#60707c]"
												dir="ltr"
											>
												<span>{data()?.model_version || 'AVM v8.0'} · LAYA System 1</span>
												<span>{'TEP-62 · TeleMint'}</span>
											</div>
										</div>

										{/* Share Certificate Actions */}
										<div class="w-full grid grid-cols-2 gap-2.5">
											<button
												type="button"
												onClick={handleShareToStory}
												disabled={sharing()}
												class="h-11 bg-[#2990FF] hover:bg-[#3d9bff] text-white font-semibold text-[11px] rounded-[10px] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
											>
												<span class="material-symbols-outlined text-[17px]">auto_awesome</span>
												<span>
													{sharing()
														? t('usernamePage.preparingStory')
														: t('usernamePage.shareStory')}
												</span>
											</button>
											<button
												type="button"
												onClick={handleSendToChat}
												disabled={downloading() || sent()}
												class="h-11 bg-white/5 hover:bg-white/10 border border-white/[0.08] text-white font-semibold text-[11px] rounded-[10px] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
											>
												<span class="material-symbols-outlined text-[17px]">
													{sent() ? 'check' : 'send'}
												</span>
												<span>
													{sent() ? t('usernamePage.sent') : t('usernamePage.sendCertificate')}
												</span>
											</button>
										</div>

										{/* Live Fragment market — Fragment ".tm-section" layout */}
										<div class="frag-card w-full p-4 flex flex-col gap-3 text-start">
											<FragSectionHeader
												title={t('usernamePage.onFragmentTitle')}
												subtitle={t('usernamePage.onFragmentSub')}
												right={
													<FragStatusPill
														status={normalizeFragStatus(
															data()?.live_market?.status || data()?.status,
														)}
														label={data()?.live_market?.raw_status_text || undefined}
														pulse={data()?.live_market?.status === 'on_auction'}
													/>
												}
											/>

											<Show when={data()?.live_market?.is_vanity_ask}>
												<div class="frag-inset px-3 py-2.5 flex gap-2.5 items-start !border-[#ffb340]/25">
													<span class="material-symbols-outlined text-[16px] text-[#ffb340] mt-[1px]">
														info
													</span>
													<div class="flex flex-col gap-1 min-w-0">
														<span class="text-[13px] font-semibold text-[#ffb340]">
															{t('usernamePage.showcaseAskDetected')}
														</span>
														<p class="text-[12px] text-[#a9b6bf] leading-relaxed">
															{locale() === 'en' && data()?.live_market?.vanity_ask_warning
																? data()?.live_market?.vanity_ask_warning
																: t('usernamePage.vanityAskDesc', {
																		askTon: fmtTon(data()?.live_market?.buy_now_ton),
																		askUsd: fmtUsd(data()?.live_market?.buy_now_usd),
																		pastTon: fmtTon(data()?.history?.highest_past_sale_ton),
																	})}
														</p>
													</div>
												</div>
											</Show>

											<div class="grid grid-cols-2 gap-2">
												<FragStat
													label={
														data()?.live_market?.status === 'on_auction'
															? t('usernamePage.highestBid')
															: data()?.live_market?.status === 'on_sale'
																? data()?.live_market?.is_vanity_ask
																	? t('usernamePage.showcaseAsk')
																	: t('usernamePage.buyNow')
																: t('usernamePage.highestRecordedSale')
													}
													sub={
														(data()?.history?.highest_past_sale_ton ?? 0) > 0 &&
														data()?.live_market?.status === 'on_sale' ? (
															<span class="text-[#4cd964]">
																{t('usernamePage.pastSale')}{' '}
																{fmtTon(data()?.history?.highest_past_sale_ton)}
															</span>
														) : data()?.live_market?.ask_vs_estimate_pct !== undefined ? (
															<span
																class={
																	(data()?.live_market?.ask_vs_estimate_pct || 0) <= 0
																		? 'text-[#4cd964]'
																		: 'text-[#ffb340]'
																}
															>
																{(data()?.live_market?.ask_vs_estimate_pct || 0) > 0 ? '+' : ''}
																{data()?.live_market?.ask_vs_estimate_pct}%{' '}
																{t('usernamePage.vsAvm')}
															</span>
														) : undefined
													}
												>
													<Show
														when={
															data()?.live_market?.current_bid_ton ||
															data()?.live_market?.buy_now_ton ||
															data()?.history?.highest_past_sale_ton
														}
														fallback={
															<span class="font-frag-sans font-medium text-[#8c9ba5]">
																{t('usernamePage.noPriorSale')}
															</span>
														}
													>
														<TonAmount
															size="md"
															value={fmtTon(
																data()?.live_market?.current_bid_ton ||
																	data()?.live_market?.buy_now_ton ||
																	data()?.history?.highest_past_sale_ton,
															)}
															tone={data()?.live_market?.is_vanity_ask ? 'warning' : 'default'}
														/>
													</Show>
												</FragStat>

												<FragStat
													label={t('usernamePage.estTimeToSell')}
													sub={
														<span class="text-[#8c9ba5]">
															{data()?.liquidity_rating || 'Active liquidity'}
														</span>
													}
												>
													{data()?.estimated_sell_time || '3 – 10 Days'}
												</FragStat>
											</div>

											<div class="flex flex-col gap-2 pt-0.5">
												<a
													href={
														data()?.live_market?.fragment_url ||
														`https://fragment.com/username/${username()}`
													}
													target="_blank"
													rel="noreferrer"
													class="h-11 rounded-[10px] bg-[#2990ff] hover:bg-[#3d9bff] text-white text-[14px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
												>
													<span>{t('usernamePage.viewOnFragment')}</span>
													<span class="material-symbols-outlined text-[16px]">north_east</span>
												</a>
												<div class="grid grid-cols-2 gap-2">
													<a
														href={
															data()?.live_market?.getgems_url || 'https://getgems.io/Usernames'
														}
														target="_blank"
														rel="noreferrer"
														class="h-10 rounded-[10px] bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors"
													>
														{'Getgems'}
														<span class="material-symbols-outlined text-[14px] text-[#8c9ba5]">
															north_east
														</span>
													</a>
													<a
														href={data()?.live_market?.telegram_url || `https://t.me/${username()}`}
														target="_blank"
														rel="noreferrer"
														class="h-10 rounded-[10px] bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors"
													>
														t.me/{username()}
														<span class="material-symbols-outlined text-[14px] text-[#8c9ba5]">
															north_east
														</span>
													</a>
												</div>
											</div>
										</div>

										{/* Valuation distribution & empirical basis */}
										<div class="frag-card w-full p-4 flex flex-col gap-3.5 text-start">
											<FragSectionHeader
												icon="monitoring"
												title={t('usernamePage.valDistTitle')}
												right={
													<button
														type="button"
														onClick={() => setShowMethodologyModal(true)}
														class="text-[12px] font-medium text-[#2990FF] hover:underline inline-flex items-center gap-1"
													>
														<span>{t('usernamePage.methodology')}</span>
														<span class="material-symbols-outlined text-[14px]">info</span>
													</button>
												}
											/>

											<div class="grid grid-cols-3 gap-2">
												<div class="frag-inset p-3 flex flex-col gap-1.5">
													<span class="text-[11px] text-[#8c9ba5]">
														{t('usernamePage.floorP10')}
													</span>
													<TonAmount
														size="sm"
														value={fmtTon(lowTon())}
														usd={fmtUsd(parseFloat(data()?.low_usd || '0'))}
													/>
												</div>
												<div class="frag-inset p-3 flex flex-col gap-1.5 !bg-[#2990FF]/10 !border-[#2990FF]/35">
													<span class="text-[11px] font-medium text-[#2990FF]">
														{t('usernamePage.fairP50')}
													</span>
													<TonAmount
														size="sm"
														value={fmtTon(expectedTon())}
														usd={fmtUsd(parseFloat(data()?.expected_usd || '0'))}
													/>
												</div>
												<div class="frag-inset p-3 flex flex-col gap-1.5">
													<span class="text-[11px] text-[#8c9ba5]">
														{t('usernamePage.ceilingP90')}
													</span>
													<TonAmount
														size="sm"
														tone="warning"
														value={fmtTon(highTon())}
														usd={fmtUsd(parseFloat(data()?.high_usd || '0'))}
													/>
												</div>
											</div>

											<div class="frag-table-container">
												<FragKV label={t('usernamePage.pricingBasis')}>
													<span class="font-mono text-[12px]">
														{data()?.price_basis?.method || 'AVM v8.0 Empirical Bayesian'}
													</span>
												</FragKV>
												<FragKV label={t('usernamePage.confidenceScore')}>
													<span
														class="font-mono tabular-nums"
														style={{ color: confidenceTheme().color }}
													>
														{confidenceTheme().label} · {data()?.confidence_score ?? 0}%
													</span>
												</FragKV>
												<FragKV label={t('usernamePage.directSettlements')}>
													<span class="font-mono tabular-nums">
														{data()?.price_basis?.exact_sales ??
															data()?.history?.transactions?.length ??
															0}
													</span>
												</FragKV>
												<FragKV label={t('usernamePage.comparableSales')}>
													<span class="font-mono tabular-nums">
														{data()?.comparable_sales_count || 0}
													</span>
												</FragKV>
												<FragKV label={t('usernamePage.scarcityRank')}>
													<span class="font-mono text-[#4cd964] tabular-nums" dir="ltr">
														Top {(100 - (data()?.percentile_rank || 85)).toFixed(1)}%
													</span>
												</FragKV>
											</div>
										</div>

										{/* Fragment protocol tools & Make-an-Offer calculator */}
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
													<div class="frag-card w-full p-4 flex flex-col gap-3.5 text-start">
														<FragSectionHeader
															icon="tune"
															title={t('usernamePage.protocolToolsTitle')}
															subtitle={t('usernamePage.protocolToolsSub')}
															right={
																<span class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-mono text-[#2990FF] bg-[#2990FF]/10 border border-[#2990FF]/25">
																	{t('usernamePage.offerFeeBadge')}
																</span>
															}
														/>

														<div class="frag-inset p-3.5 flex flex-col gap-3">
															<div class="flex items-center justify-between gap-2 text-[12px]">
																<span class="font-medium text-white">
																	{t('usernamePage.offerCalcTitle')}
																</span>
																<span class="text-[11px] font-mono text-[#60707c]" dir="ltr">
																	{fc().offer_fee_min_ton}–{fc().offer_fee_max_ton} TON
																</span>
															</div>

															<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-stretch">
																<div class="flex flex-col gap-1">
																	<span class="text-[11px] text-[#8c9ba5]">
																		{t('usernamePage.yourOfferAmount')}
																	</span>
																	<div
																		class="flex items-center gap-2 bg-[#1b232d] border border-white/[0.1] focus-within:border-[#2990FF] rounded-[8px] px-3 h-10"
																		dir="ltr"
																	>
																		<TonIcon size={14} />
																		<input
																			type="number"
																			value={customOfferInput() || String(fc().suggested_offer_ton)}
																			onInput={(e) => setCustomOfferInput(e.currentTarget.value)}
																			placeholder={String(fc().suggested_offer_ton)}
																			class="w-full bg-transparent text-white font-mono font-semibold text-[13px] tabular-nums focus:outline-none"
																		/>
																		<span class="text-[11px] font-mono text-[#60707c]">
																			{'TON'}
																		</span>
																	</div>
																</div>

																<div class="bg-[#1b232d] border border-white/[0.06] rounded-[8px] px-3 py-2 flex items-center justify-between gap-2">
																	<div class="flex flex-col gap-0.5 min-w-0">
																		<span class="text-[11px] text-[#8c9ba5]">
																			{t('usernamePage.offerFeeLabel')}
																		</span>
																		<TonAmount
																			size="sm"
																			tone="warning"
																			value={offerFeeTon()}
																			usd={(offerFeeTon() * (data()?.ton_usd_rate || 5.25)).toFixed(
																				2,
																			)}
																		/>
																	</div>
																	<a
																		href={fc().direct_links.fragment_url}
																		target="_blank"
																		rel="noreferrer"
																		class="h-8 px-3 rounded-[8px] bg-[#2990FF] hover:bg-[#3d9bff] text-white font-medium text-[12px] inline-flex items-center gap-1 shrink-0 transition-colors"
																	>
																		<span>{t('usernamePage.makeOfferBtn')}</span>
																		<span class="material-symbols-outlined text-[14px]">
																			north_east
																		</span>
																	</a>
																</div>
															</div>
														</div>

														<div class="grid grid-cols-3 gap-2">
															<FragStat
																label={t('usernamePage.botUpgrade')}
																sub={
																	<span class="text-[#64b5ff]">
																		{fc().is_assigned_to_bot
																			? t('usernamePage.activeBot')
																			: t('usernamePage.oneTimeFee')}
																	</span>
																}
															>
																<TonAmount size="sm" value={fmtTon(fc().bot_upgrade_fee_ton)} />
															</FragStat>

															<FragStat
																label={t('usernamePage.profileLimit')}
																sub={
																	<span class="text-[#4cd964]">{t('usernamePage.stackable')}</span>
																}
															>
																{fc().max_collectibles_per_profile} {t('usernamePage.handlesUnit')}
															</FragStat>

															<div class="frag-inset px-3 py-2.5 flex flex-col gap-1 min-w-0">
																<span class="text-[11px] text-[#8c9ba5] leading-tight truncate">
																	{t('usernamePage.tep64Data')}
																</span>
																<a
																	href={fc().direct_links.nft_json_url}
																	target="_blank"
																	rel="noreferrer"
																	class="text-[12px] font-mono font-semibold text-[#2990FF] hover:underline truncate"
																	dir="ltr"
																>
																	{username()}.json ↗
																</a>
																<a
																	href={fc().direct_links.web_subdomain_url}
																	target="_blank"
																	rel="noreferrer"
																	class="text-[11px] font-mono text-[#60707c] hover:text-white truncate"
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

										{/* Transaction economics & estimated rental yield */}
										<div class="frag-card w-full p-4 flex flex-col gap-3.5 text-start">
											<FragSectionHeader
												icon="payments"
												title={layaT(USERNAME_I18N.txEconomics)}
												right={
													<span class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-mono text-[#4cd964] bg-[#4cd964]/10 border border-[#4cd964]/25">
														{t('usernamePage.fragmentFeeBadge')}
													</span>
												}
											/>

											<div class="grid grid-cols-2 gap-2">
												<FragStat
													label={layaT(USERNAME_I18N.netSellerProceeds)}
													sub={
														<span>
															−{fmtTon(Math.max(5, Math.round(expectedTon() * 0.05)))} TON fee
														</span>
													}
												>
													<TonAmount
														size="md"
														tone="positive"
														value={fmtTon(
															Math.max(0, expectedTon() - Math.max(5, expectedTon() * 0.05)),
														)}
													/>
												</FragStat>

												{(() => {
													const uLen = data()?.length || username().length || 6;
													const rate =
														uLen <= 4 ? 0.045 : uLen === 5 ? 0.038 : uLen === 6 ? 0.032 : 0.025;
													const monthlyTon = Math.max(1, Math.round(expectedTon() * rate));
													const apy = (rate * 12 * 100).toFixed(1);
													return (
														<FragStat
															label={t('usernamePage.estMonthlyRent')}
															sub={<span class="text-[#4cd964]">~{apy}% est. APY</span>}
														>
															<span class="inline-flex items-center gap-1" dir="ltr">
																<TonIcon size={13} />
																<span>~{fmtTon(monthlyTon)}</span>
																<span class="text-[11px] text-[#8c9ba5] font-normal">/mo</span>
															</span>
														</FragStat>
													);
												})()}
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
										<div class="frag-card w-full p-4 flex flex-col gap-3">
											<FragSectionHeader
												icon="verified_user"
												title={t('usernamePage.telemintProvenance')}
												subtitle={`${data()?.username || username()}.t.me`}
												right={
													<FragStatusPill
														status={data()?.telemint_provenance?.is_authentic ? 'sold' : 'unminted'}
														label={
															data()?.telemint_provenance?.is_authentic
																? t('usernamePage.officialNft')
																: t('usernamePage.unminted')
														}
													/>
												}
											/>

											<div class="frag-table-container">
												<Show when={data()?.telemint_provenance?.item_address}>
													<FragKV
														label={t('usernamePage.nftItemContract')}
														copyValue={data()?.telemint_provenance?.item_address || ''}
														href={`https://tonviewer.com/${data()?.telemint_provenance?.item_address}`}
													>
														<span class="font-mono text-[12px]" dir="ltr">
															{data()?.telemint_provenance?.item_address?.slice(0, 8)}…
															{data()?.telemint_provenance?.item_address?.slice(-6)}
														</span>
													</FragKV>
												</Show>
												<Show when={data()?.telemint_provenance?.code_hash}>
													<FragKV
														label={t('usernamePage.tvmCodeHash')}
														copyValue={data()?.telemint_provenance?.code_hash || ''}
													>
														<span class="font-mono text-[12px] text-[#64b5ff]" dir="ltr">
															{data()?.telemint_provenance?.code_hash?.slice(0, 14)}…
														</span>
													</FragKV>
												</Show>
												<Show when={data()?.telemint_provenance?.data_hash}>
													<FragKV
														label={t('usernamePage.tvmDataHash')}
														copyValue={data()?.telemint_provenance?.data_hash || ''}
													>
														<span class="font-mono text-[12px] text-[#a9b6bf]" dir="ltr">
															{data()?.telemint_provenance?.data_hash?.slice(0, 14)}…
														</span>
													</FragKV>
												</Show>
											</div>

											<Show when={data()?.telemint_provenance?.details}>
												<p class="text-[12px] text-[#8c9ba5] leading-relaxed">
													{data()?.telemint_provenance?.details}
												</p>
											</Show>
										</div>

										{/* 2. Binary & TVM Byte-Level BOC Forensics Inspector */}
										<Show when={data()?.binary_forensics}>
											{(bf) => (
												<div class="frag-card w-full p-4 flex flex-col gap-3.5">
													<FragSectionHeader
														icon="memory"
														title={t('usernamePage.binaryForensicsTitle')}
														subtitle={`${bf().boc_magic_prefix} · ${bf().total_bits}-bit UTF-8`}
														right={
															<span
																class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-mono text-[#64b5ff] bg-[#2990FF]/10 border border-[#2990FF]/25"
																dir="ltr"
															>
																H(X) = {bf().shannon_entropy_bits} b/ch
															</span>
														}
													/>

													<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
														<FragStat label={t('usernamePage.asciiHex')}>
															<span class="text-[#64b5ff] text-[12px]" dir="ltr">
																{bf().ascii_hex_spaced}
															</span>
														</FragStat>
														<FragStat label={t('usernamePage.hammingWeight')}>
															<span class="text-[12px]" dir="ltr">
																{bf().set_bits_popcount}/{bf().total_bits} (
																{bf().hamming_weight_pct}%)
															</span>
														</FragStat>
														<FragStat label={t('usernamePage.shannonEntropy')}>
															<span class="text-[#4cd964] text-[12px]" dir="ltr">
																{bf().shannon_entropy_bits} bits
															</span>
														</FragStat>
														<FragStat label={t('usernamePage.handAlternation')}>
															<span class="text-[#ffb340] text-[12px]" dir="ltr">
																{bf().hand_alternation_pct}% ({bf().left_hand_keys}L/
																{bf().right_hand_keys}R)
															</span>
														</FragStat>
													</div>

													<div class="frag-table-container">
														<FragKV
															label="TEP-62 SHA-256 index"
															copyValue={bf().tep62_sha256_index}
														>
															<span class="font-mono text-[12px] text-[#64b5ff]" dir="ltr">
																{bf().tep62_sha256_index.slice(0, 14)}…
																{bf().tep62_sha256_index.slice(-8)}
															</span>
														</FragKV>
														<FragKV
															label={t('usernamePage.telemintBocCell')}
															copyValue={bf().telemint_token_cell_boc}
														>
															<span class="font-mono text-[12px] text-[#4cd964]" dir="ltr">
																{bf().telemint_token_cell_boc.slice(0, 18)}…
															</span>
														</FragKV>
														<Show when={bf().auction_config}>
															{(ac) => (
																<FragKV label={t('usernamePage.tvmAuctionConfig')}>
																	<span class="font-mono text-[12px]" dir="ltr">
																		Min {fmtTon(ac().initialMinBidTon)} TON · {ac().minBidStepPct}%
																		· {Math.round(ac().minExtendTimeSec / 60)}m
																	</span>
																</FragKV>
															)}
														</Show>
													</div>

													{/* Per-Character 8-Bit UTF-8 Binary Matrix */}
													<div class="frag-table-container">
														<div
															class="frag-table-header grid grid-cols-6 px-3 py-2 text-center"
															dir="ltr"
														>
															<span>{t('usernamePage.colChar')}</span>
															<span>{t('usernamePage.colAscii')}</span>
															<span>{t('usernamePage.colHex')}</span>
															<span class="col-span-2">{t('usernamePage.colUtf8')}</span>
															<span>Morse / Key</span>
														</div>
														<For each={bf().bitstream_matrix}>
															{(row) => (
																<div
																	class="frag-table-row grid grid-cols-6 px-3 py-2.5 items-center text-[11px] font-mono text-center"
																	dir="ltr"
																>
																	<span class="text-white font-semibold text-[13px]">
																		'{row.char}'
																	</span>
																	<span class="text-[#8c9ba5]">{row.ascii_dec}</span>
																	<span class="text-[#64b5ff] font-medium">{row.hex_byte}</span>
																	<div class="col-span-2 flex items-center justify-center gap-0.5">
																		<For each={row.binary_8bit.split('')}>
																			{(bit) => (
																				<span
																					class={`w-3.5 h-4 rounded-[3px] flex items-center justify-center text-[10px] font-semibold ${
																						bit === '1'
																							? 'bg-[#2990FF]/25 text-[#64b5ff] border border-[#2990FF]/40'
																							: 'bg-white/[0.03] text-[#60707c]'
																					}`}
																				>
																					{bit}
																				</span>
																			)}
																		</For>
																	</div>
																	<span class="text-[#ffb340] text-[11px]">
																		{row.morse} · {row.keyboard_hand}
																	</span>
																</div>
															)}
														</For>
													</div>
												</div>
											)}
										</Show>

										{/* 3. Cross-Chain .ton TON DNS Sister Domain Synergy */}
										<div class="frag-card w-full p-4 flex flex-col gap-3">
											<FragSectionHeader
												icon="language"
												title={t('usernamePage.tonDnsTitle')}
												subtitle={data()?.ton_dns_domain?.domain || `${username()}.ton`}
												right={
													<FragStatusPill
														status={
															data()?.ton_dns_domain?.sameOwnerSynergy
																? 'on_auction'
																: data()?.ton_dns_domain?.exists
																	? 'on_sale'
																	: 'available'
														}
														label={
															data()?.ton_dns_domain?.sameOwnerSynergy
																? t('usernamePage.unifiedOwner')
																: data()?.ton_dns_domain?.exists
																	? t('usernamePage.minted')
																	: t('usernamePage.availableDotTon')
														}
													/>
												}
											/>
											<p class="text-[12px] text-[#c7d0d9] leading-relaxed">
												{data()?.risk_audit?.ton_dns_synergy}
											</p>
											<Show when={data()?.ton_dns_domain?.nftAddress}>
												<div class="frag-table-container">
													<FragKV
														label={t('usernamePage.tonNftAddress')}
														copyValue={data()?.ton_dns_domain?.nftAddress || ''}
														href={`https://tonviewer.com/${data()?.ton_dns_domain?.nftAddress}`}
													>
														<span class="font-mono text-[12px]" dir="ltr">
															{data()?.ton_dns_domain?.nftAddress?.slice(0, 8)}…
															{data()?.ton_dns_domain?.nftAddress?.slice(-6)}
														</span>
													</FragKV>
												</div>
											</Show>
										</div>

										{/* 4. Live Telegram Identity & Audience Telemetry */}
										<div class="frag-card w-full p-4 flex flex-col gap-3">
											<FragSectionHeader
												icon="campaign"
												title={t('usernamePage.liveTgEntity')}
												right={
													<span class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-mono text-[#a9b6bf] bg-white/[0.04] border border-white/[0.07] capitalize">
														{data()?.entity_info?.type?.toLowerCase() || 'unassigned'}
													</span>
												}
											/>

											<Show
												when={ownerProfile() || (data()?.entity_info?.title ?? '') !== ''}
												fallback={
													<div class="frag-inset p-3.5 text-[12px] text-[#8c9ba5] leading-relaxed">
														{t('usernamePage.unassignedEntityDesc')}
													</div>
												}
											>
												<div class="frag-inset p-3 flex items-center justify-between gap-3">
													<div class="flex items-center gap-3 min-w-0">
														<Show
															when={data()?.entity_info?.avatar_url}
															fallback={
																<div class="w-10 h-10 rounded-full bg-gradient-to-b from-[#3a9bff] to-[#1f6fd1] flex items-center justify-center text-white font-semibold text-[15px] shrink-0">
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
																class="w-10 h-10 rounded-full object-cover border border-white/15 shrink-0"
															/>
														</Show>
														<div class="flex flex-col min-w-0">
															<div class="flex items-center gap-1.5">
																<span class="text-white font-semibold text-[13px] truncate">
																	{data()?.entity_info?.title || ownerProfile()?.first_name}
																</span>
																<Show when={data()?.entity_info?.verified}>
																	<span class="material-symbols-outlined filled-icon text-[#2990FF] text-[15px] shrink-0">
																		verified
																	</span>
																</Show>
															</div>
															<span class="text-[11px] font-mono text-[#4cd964]">
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
														class="h-8 px-3 rounded-[8px] bg-[#2990FF]/12 border border-[#2990FF]/30 text-[#2990FF] font-mono font-medium text-[11px] inline-flex items-center gap-1 shrink-0 hover:bg-[#2990FF]/20 transition-colors"
													>
														<span>{'t.me'}</span>
														<span class="material-symbols-outlined text-[13px]">north_east</span>
													</a>
												</div>
												<Show when={data()?.entity_info?.bio}>
													<p class="frag-inset p-3 text-[12px] text-[#a9b6bf] leading-relaxed">
														{data()?.entity_info?.bio}
													</p>
												</Show>
											</Show>
										</div>

										{/* 5. Fragment Ownership History */}
										<div class="frag-card w-full p-4 flex flex-col gap-3">
											<FragSectionHeader
												icon="history"
												title={t('usernamePage.ownershipHistory')}
												right={
													<Show when={data()?.history?.highest_past_sale_ton}>
														<TonAmount
															size="sm"
															tone="warning"
															value={fmtTon(data()?.history?.highest_past_sale_ton)}
														/>
													</Show>
												}
											/>

											<Show when={data()?.history?.owner_address}>
												<div class="frag-table-container">
													<FragKV
														label={t('valuation.owner') || 'Owner wallet'}
														copyValue={data()?.history?.owner_address || ''}
														href={`https://tonviewer.com/${data()?.history?.owner_address}`}
													>
														<span class="font-mono text-[12px]" dir="ltr">
															{data()?.history?.owner_address?.slice(0, 6)}…
															{data()?.history?.owner_address?.slice(-6)}
														</span>
													</FragKV>
												</div>
											</Show>

											<Show
												when={(data()?.history?.transactions?.length ?? 0) > 0}
												fallback={
													<div class="frag-inset p-4 text-center text-[12px] text-[#8c9ba5]">
														{t('usernamePage.noSettledSales')}
													</div>
												}
											>
												<div class="frag-table-container">
													<div class="frag-table-header grid grid-cols-3 px-3.5 py-2">
														<span class="text-start">
															{t('valuation.sale_price') || 'Price / event'}
														</span>
														<span class="text-center">{t('valuation.date') || 'Date'}</span>
														<span class="text-end">{t('valuation.buyer') || 'Recipient'}</span>
													</div>
													<For each={data()?.history?.transactions}>
														{(tx) => {
															const isTransfer =
																tx.event_type === 'transfer' ||
																tx.sale_price_ton.toLowerCase().includes('transfer');
															return (
																<div class="frag-table-row grid grid-cols-3 px-3.5 py-2.5 items-center text-[12px]">
																	<Show
																		when={!isTransfer}
																		fallback={
																			<span class="text-[#64b5ff] font-mono text-[11px] text-start">
																				{t('usernamePage.p2pTransfer')}
																			</span>
																		}
																	>
																		<TonAmount
																			size="sm"
																			tone="positive"
																			value={tx.sale_price_ton}
																		/>
																	</Show>
																	<span class="text-[#8c9ba5] text-[11px] font-mono text-center">
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
																		class="text-[#2990FF] hover:underline font-mono text-[11px] truncate text-end"
																		dir="ltr"
																	>
																		{tx.buyer && tx.buyer.length > 12
																			? `${tx.buyer.slice(0, 4)}…${tx.buyer.slice(-4)}`
																			: tx.buyer || 'Fragment'}
																	</a>
																</div>
															);
														}}
													</For>
												</div>
											</Show>
										</div>

										{/* 6. Live Fragment Bid History */}
										<Show when={(data()?.live_market?.offers?.length ?? 0) > 0}>
											<div class="frag-card w-full p-4 flex flex-col gap-3">
												<FragSectionHeader
													icon="gavel"
													title={t('usernamePage.auctionBidHistory')}
													right={
														<span class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-mono text-[#ffb340] bg-[#ffb340]/10 border border-[#ffb340]/25">
															{data()?.live_market?.offers?.length} bids
														</span>
													}
												/>

												<Show when={data()?.live_market?.bid_analytics}>
													{(ba) => (
														<div class="grid grid-cols-3 gap-2">
															<FragStat label={t('usernamePage.bidders')}>
																{ba().unique_bidders_count}
															</FragStat>
															<FragStat label={t('usernamePage.openingBid')}>
																<TonAmount size="sm" value={fmtTon(ba().opening_bid_ton)} />
															</FragStat>
															<FragStat label={t('usernamePage.bidJump')}>
																<span class="text-[#ffb340]">{ba().bid_jump_multiple}×</span>
															</FragStat>
														</div>
													)}
												</Show>

												<div class="frag-table-container max-h-[240px] overflow-y-auto">
													<For each={data()?.live_market?.offers?.slice(0, 15)}>
														{(offer) => (
															<div class="frag-table-row grid grid-cols-3 px-3.5 py-2.5 items-center text-[12px] font-mono">
																<TonAmount
																	size="sm"
																	tone="warning"
																	value={fmtTon(offer.price_ton)}
																/>
																<span class="text-[#8c9ba5] text-[11px] text-center">
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
																	class="text-[#a9b6bf] hover:text-[#2990FF] text-end truncate text-[11px]"
																	dir="ltr"
																>
																	{offer.from
																		? `${offer.from.slice(0, 4)}…${offer.from.slice(-4)}`
																		: 'Bidder'}
																</a>
															</div>
														)}
													</For>
												</div>
											</div>
										</Show>

										{/* 7. Holder Whale Wallet & Live On-Chain Portfolio */}
										<Show when={hasPortfolio() || (data()?.wallet_info?.balance ?? 0) > 0}>
											<div class="frag-card w-full p-4 flex flex-col gap-3">
												<FragSectionHeader
													icon="account_balance_wallet"
													title={t('usernamePage.holderPortfolioTitle')}
													subtitle={t('usernamePage.holderPortfolioSub')}
													right={
														<span
															class={`h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-medium border ${
																data()?.wallet_info?.is_whale
																	? 'bg-[#ffb340]/10 border-[#ffb340]/25 text-[#ffb340]'
																	: 'bg-[#2990FF]/10 border-[#2990FF]/25 text-[#2990FF]'
															}`}
														>
															{data()?.wallet_info?.is_whale
																? t('usernamePage.whaleWallet')
																: t('usernamePage.collector')}
														</span>
													}
												/>

												<div class="grid grid-cols-3 gap-2">
													<FragStat label={t('usernamePage.walletBalance')}>
														<TonAmount
															size="sm"
															tone="warning"
															value={fmtTon(data()?.wallet_info?.balance)}
														/>
													</FragStat>
													<FragStat label={t('usernamePage.walletHandles')}>
														{data()?.wallet_info?.nft_count || data()?.portfolio?.total_count || 1}
													</FragStat>
													<FragStat label={t('usernamePage.walletEstValue')}>
														<TonAmount
															size="sm"
															tone="positive"
															value={fmtTon(data()?.portfolio?.total_est_value_ton)}
														/>
													</FragStat>
												</div>

												<Show when={hasPortfolio()}>
													<div class="frag-table-container max-h-[260px] overflow-y-auto">
														<For each={data()?.portfolio?.items}>
															{(item) => {
																const clean = item.username.replace('@', '');
																return (
																	<button
																		type="button"
																		onClick={() => openReport(item.username)}
																		class="frag-table-row w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-start"
																	>
																		<div class="flex items-center gap-2.5 min-w-0">
																			<FragNftTile
																				handle={clean}
																				class="w-8 h-8 shrink-0"
																				rounded="rounded-[6px]"
																			/>
																			<FragHandle handle={clean} size="sm" />
																		</div>
																		<div class="flex items-center gap-2 shrink-0">
																			<Show when={(item.last_sale_ton ?? 0) > 0}>
																				<TonAmount size="sm" value={fmtTon(item.last_sale_ton)} />
																			</Show>
																			<FragStatusPill status={normalizeFragStatus(item.status)} />
																		</div>
																	</button>
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
										<div class="frag-card w-full p-4 flex flex-col gap-3.5">
											<FragSectionHeader
												icon="hub"
												title={t('usernamePage.comparablesTitle')}
												subtitle={t('usernamePage.comparablesSub')}
												right={
													<span class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-mono text-[#2990FF] bg-[#2990FF]/10 border border-[#2990FF]/25">
														{similarCounts().all}
													</span>
												}
											/>

											{/* Semantic cluster quick-jump chips */}
											{(() => {
												const topSemantic = (data()?.similar || []).filter(
													(s) => s.category === 'semantic',
												);
												const clusterName =
													topSemantic.find((s) => s.semantic_cluster)?.semantic_cluster ||
													t('usernamePage.semanticClusterDefault');
												return (
													<Show when={topSemantic.length > 0}>
														<div class="frag-inset p-3 flex flex-col gap-2">
															<div class="flex items-center justify-between gap-2 text-[12px]">
																<span class="font-medium text-[#4cd964] truncate">
																	{clusterName}
																</span>
																<span class="text-[11px] font-mono text-[#8c9ba5] shrink-0">
																	{topSemantic.length} {t('usernamePage.synonymsUnit')}
																</span>
															</div>
															<div class="flex flex-wrap gap-1.5">
																<For each={topSemantic.slice(0, 6)}>
																	{(syn) => (
																		<button
																			type="button"
																			onClick={() => openReport(syn.username)}
																			class="px-2.5 py-1 rounded-[7px] bg-[#1b232d] hover:bg-[#232d3a] border border-white/[0.08] text-[12px] font-medium flex items-center gap-1.5 transition-colors"
																			dir="ltr"
																		>
																			<span class="text-white">
																				<span class="text-[#2990FF]">@</span>
																				{syn.username}
																			</span>
																			<Show when={(syn.sale_price ?? 0) > 0}>
																				<span class="text-[11px] font-mono text-[#8c9ba5]">
																					{fmtTon(syn.sale_price)}
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

											{/* Neutral Fragment segmented filter */}
											<div class="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-[#141a22] p-1 rounded-[10px] border border-white/[0.06] text-[11px]">
												<button
													type="button"
													onClick={() => setSimilarFilter('all')}
													class={`py-1.5 px-2.5 rounded-[7px] flex items-center justify-between transition-colors ${
														similarFilter() === 'all'
															? 'bg-[#232d3a] text-white font-medium'
															: 'text-[#8c9ba5] hover:text-white'
													}`}
												>
													<span>{t('usernamePage.filterAll')}</span>
													<span class="font-mono text-[#60707c]">{similarCounts().all}</span>
												</button>

												<button
													type="button"
													onClick={() => setSimilarFilter('semantic')}
													class={`py-1.5 px-2.5 rounded-[7px] flex items-center justify-between transition-colors ${
														similarFilter() === 'semantic'
															? 'bg-[#232d3a] text-white font-medium'
															: 'text-[#8c9ba5] hover:text-white'
													}`}
												>
													<span>{t('usernamePage.filterSemantic')}</span>
													<span class="font-mono text-[#4cd964]">{similarCounts().semantic}</span>
												</button>

												<button
													type="button"
													onClick={() => setSimilarFilter('live_fragment')}
													class={`py-1.5 px-2.5 rounded-[7px] flex items-center justify-between transition-colors ${
														similarFilter() === 'live_fragment'
															? 'bg-[#232d3a] text-white font-medium'
															: 'text-[#8c9ba5] hover:text-white'
													}`}
												>
													<span>{t('usernamePage.filterFragmentRoot')}</span>
													<span class="font-mono text-[#60707c]">
														{similarCounts().live_fragment}
													</span>
												</button>

												<button
													type="button"
													onClick={() => setSimilarFilter('structural')}
													class={`py-1.5 px-2.5 rounded-[7px] flex items-center justify-between transition-colors ${
														similarFilter() === 'structural'
															? 'bg-[#232d3a] text-white font-medium'
															: 'text-[#8c9ba5] hover:text-white'
													}`}
												>
													<span>{t('usernamePage.filterSameLength')}</span>
													<span class="font-mono text-[#60707c]">{similarCounts().structural}</span>
												</button>
											</div>

											{/* Order-book comparables rows */}
											<div class="frag-table-container">
												<div class="frag-table-header flex items-center justify-between px-3.5 py-2">
													<span>{t('usernamePage.colHandle')}</span>
													<span>{t('usernamePage.colPriceAction')}</span>
												</div>
												<For each={filteredSimilar()}>
													{(item) => {
														const badge = similarBadge(item);
														const hasPrice = (item.sale_price ?? 0) > 0;
														const clean = item.username.replace('@', '');
														return (
															<button
																type="button"
																onClick={() => openReport(item.username)}
																class="frag-table-row w-full flex items-center justify-between gap-3 px-3.5 py-3 text-start"
															>
																<div class="flex items-center gap-3 min-w-0">
																	<FragNftTile
																		handle={clean}
																		class="w-9 h-9 shrink-0"
																		rounded="rounded-[8px]"
																	/>
																	<div class="flex flex-col min-w-0 gap-1">
																		<div class="flex items-center gap-1.5 min-w-0 flex-wrap">
																			<FragHandle handle={clean} size="sm" />
																			<Show when={item.semantic_score}>
																				<span class="text-[11px] font-mono text-[#4cd964] tabular-nums">
																					{item.semantic_score}%
																				</span>
																			</Show>
																			<span class="text-[11px] text-[#8c9ba5]">
																				· {badge.label}
																			</span>
																		</div>
																		<span class="text-[#60707c] text-[11px] truncate">
																			{item.reason}
																		</span>
																	</div>
																</div>

																<Show
																	when={hasPrice}
																	fallback={
																		<span class="text-[#2990FF] text-[12px] font-medium shrink-0 inline-flex items-center gap-0.5">
																			{t('usernamePage.inspectBtn')}
																			<span class="material-symbols-outlined text-[14px] rtl:rotate-180">
																				chevron_right
																			</span>
																		</span>
																	}
																>
																	<TonAmount
																		size="md"
																		class="items-end shrink-0"
																		value={fmtTon(item.sale_price)}
																		usd={
																			(item.sale_price_usd ?? 0) > 0
																				? fmtUsd(item.sale_price_usd)
																				: null
																		}
																	/>
																</Show>
															</button>
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
										<div class="frag-card w-full p-4 flex flex-col gap-3">
											<FragSectionHeader
												icon="translate"
												title={t('usernamePage.lexicalTitle')}
												right={
													<FragStatusPill
														status={data()?.dictionary?.is_word ? 'sold' : 'taken'}
														label={
															data()?.dictionary?.is_word
																? t('valuation.dict_word_title') || 'Dictionary word'
																: t('valuation.dict_none') || 'Brand / generic'
														}
													/>
												}
											/>

											<Show
												when={data()?.dictionary?.is_word && data()?.dictionary?.definition}
												fallback={
													<div class="frag-inset p-3.5 text-[#8c9ba5] text-[12px] leading-relaxed">
														{t('valuation.not_dict_word_desc') ||
															'Non-dictionary brand or alphanumeric handle without a standard English dictionary entry.'}
													</div>
												}
											>
												<div class="frag-inset p-3.5 text-white/90 text-[13px] leading-relaxed flex flex-col gap-1.5">
													<div class="flex items-center justify-between">
														<Show when={data()?.dictionary?.part_of_speech}>
															<span class="text-[11px] text-[#2990FF] font-mono">
																[{data()?.dictionary?.part_of_speech}]
															</span>
														</Show>
														<Show when={(data()?.dictionary?.word_frequency ?? 0) > 0}>
															<span class="text-[11px] text-[#4cd964] font-mono tabular-nums">
																{data()?.dictionary?.word_frequency}/M words
															</span>
														</Show>
													</div>
													<span class="italic text-[#d0d7dd]">
														"{data()?.dictionary?.definition}"
													</span>
												</div>
											</Show>

											<Show when={data()?.wikipedia_summary}>
												<div class="frag-inset p-3.5 flex flex-col gap-1">
													<span class="text-[11px] font-medium text-[#ffb340]">
														{t('valuation.wiki_summary_title') || 'Reference context'}
													</span>
													<p class="text-[12px] text-[#a9b6bf] leading-relaxed">
														{data()?.wikipedia_summary}
													</p>
												</div>
											</Show>
										</div>

										{/* 2. Structural & Phonetic Anatomy */}
										<div class="frag-card w-full p-4 flex flex-col gap-3">
											<FragSectionHeader
												icon="genetics"
												title={t('usernamePage.anatomyTitle')}
												right={
													<span
														class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-mono text-[#a9b6bf] bg-white/[0.04] border border-white/[0.07]"
														dir="ltr"
													>
														{data()?.length || username().length} chars · SEO {data()?.seo?.score}
														/100
													</span>
												}
											/>

											<div class="grid grid-cols-2 gap-2">
												<FragStat label={t('usernamePage.characterSet')}>
													<span
														class={
															data()?.structure?.letters_only ? 'text-[#4cd964]' : 'text-[#ffb340]'
														}
													>
														{data()?.structure?.letters_only ? 'Pure alpha' : 'Mixed alphanumeric'}
													</span>
												</FragStat>
												<FragStat label={t('usernamePage.pronounceability')}>
													{data()?.structure?.is_pronounceable
														? t('usernamePage.fluent')
														: t('usernamePage.standard')}
												</FragStat>
												<FragStat label={t('usernamePage.digitsLabel')}>
													<span
														class={
															data()?.structure?.has_digits ? 'text-[#ffb340]' : 'text-[#4cd964]'
														}
													>
														{data()?.structure?.has_digits
															? t('usernamePage.containsDigits')
															: t('usernamePage.noDigits')}
													</span>
												</FragStat>
												<FragStat label={t('usernamePage.underscoreLabel')}>
													<span
														class={
															data()?.structure?.has_underscore
																? 'text-[#ffb340]'
																: 'text-[#4cd964]'
														}
													>
														{data()?.structure?.has_underscore
															? t('usernamePage.containsUnderscore')
															: t('usernamePage.clean')}
													</span>
												</FragStat>
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
											<div class="frag-card w-full p-4 flex flex-col gap-3">
												<FragSectionHeader
													icon="shield_lock"
													title={t('usernamePage.visualTwinsTitle')}
													right={
														<span class="h-[22px] px-2 rounded-[6px] inline-flex items-center text-[11px] font-mono text-[#ffb340] bg-[#ffb340]/10 border border-[#ffb340]/25">
															{data()?.homoglyph_twins?.length} twins
														</span>
													}
												/>

												<div class="frag-table-container">
													<For each={data()?.homoglyph_twins}>
														{(tw) => (
															<button
																type="button"
																onClick={() => openReport(tw.twin)}
																class="frag-table-row w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-start"
															>
																<div class="flex flex-col min-w-0 gap-0.5">
																	<div class="flex items-center gap-2">
																		<FragHandle handle={tw.twin} size="sm" />
																		<span class="text-[11px] font-mono text-[#ffb340] bg-[#ffb340]/10 border border-[#ffb340]/25 px-1.5 py-0.5 rounded-[5px] lowercase">
																			{tw.risk_level} risk
																		</span>
																	</div>
																	<span class="text-[11px] text-[#8c9ba5] truncate">
																		{tw.similarity}
																	</span>
																</div>
																<Show
																	when={(tw.price_ton ?? 0) > 0}
																	fallback={
																		<span class="text-[11px] text-[#8c9ba5] shrink-0">
																			{tw.status}
																		</span>
																	}
																>
																	<TonAmount
																		size="sm"
																		tone="positive"
																		value={fmtTon(tw.price_ton)}
																	/>
																</Show>
															</button>
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
									<span class="text-white/60 text-[11px] font-mono">
										{t('valuation.data_freshness_stamp', {
											date: new Date().toLocaleDateString('en-GB'),
										}) || `Live On-Chain Audit · ${new Date().toLocaleDateString('en-GB')}`}
									</span>
									<span class="text-[#8c9ba5] text-[11px] font-mono">
										1 TON ≈ ${data()?.ton_usd_rate?.toFixed(2) || '5.25'} USD (Live TonAPI Rate)
									</span>
								</div>
							</Show>
						</Show>
					</div>

					{/* ═══════ METHODOLOGY MODAL ═══════ */}
					<Show when={showMethodologyModal()}>
						<div class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
							<div class="frag-card p-6 max-w-sm w-full flex flex-col gap-4 text-start">
								<div class="flex items-center justify-between border-b border-white/[0.06] pb-3">
									<h3 class="text-white font-semibold text-[16px]">
										{t('valuation.confidence_methodology') || 'AVM v8.0 Methodology'}
									</h3>
									<button
										type="button"
										onClick={() => setShowMethodologyModal(false)}
										class="w-8 h-8 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-[#8c9ba5] hover:text-white transition-colors"
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
									class="w-full h-11 bg-[#2990FF] text-white font-semibold text-[12px] rounded-[10px]"
								>
									{t('valuation.close') || 'Close'}
								</button>
							</div>
						</div>
					</Show>

					{/* ═══════ HIDDEN EXPORT CARD (Fragment Sovereign Pass Design) ═══════ */}
					<div class="fixed left-[-9999px] top-[-9999px] pointer-events-none" dir="ltr">
						<div
							ref={hiddenCardRef}
							class="w-[400px] h-[400px] rounded-[24px] p-7 flex flex-col justify-between relative overflow-hidden bg-[#141a22] border border-white/[0.12] font-frag-sans"
							style={{
								'background-image':
									'radial-gradient(circle at 50% 0%, rgba(41,144,255,0.22) 0%, transparent 62%), radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
								'background-size': '100% 100%, 16px 16px',
							}}
						>
							<div class="flex justify-between items-center z-10">
								<span
									class={`px-3 py-1 border rounded-[8px] text-[11px] font-medium capitalize ${
										getTierTheme(data()?.rarity?.tier || '').badge
									}`}
								>
									{(data()?.rarity?.tier || 'standard').toLowerCase()}
								</span>
								<span class="text-[11px] font-mono text-[#8c9ba5] bg-white/[0.04] border border-white/[0.08] px-3 py-1 rounded-[8px]">
									{'iFragment · AVM v8.0'}
								</span>
							</div>

							<div class="flex flex-col justify-center items-center z-10 text-center flex-grow py-4 w-full gap-2">
								<span
									class="inline-block font-semibold tracking-[-0.03em] text-white truncate max-w-[92%]"
									style={{ 'font-size': getFontSize(data()?.username || username()) }}
									dir="ltr"
								>
									<span class="text-[#2990FF]">@</span>
									{data()?.username || username()}
								</span>
								<span class="text-[12px] font-mono text-[#60707c]">
									t.me/{data()?.username || username()}
								</span>
							</div>

							<div class="flex justify-between items-end border-t border-white/[0.08] pt-4 z-10">
								<div class="flex flex-col gap-1.5 text-left">
									<span class="text-[11px] text-[#8c9ba5]">
										{t('usernamePage.estimatedFairValue')}
									</span>
									<TonAmount size="xl" value={fmtTon(expectedTon())} />
								</div>
								<div class="flex flex-col items-end gap-1.5">
									<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[6px] bg-[#4cd964]/12 border border-[#4cd964]/30 text-[11px] font-medium text-[#4cd964]">
										<span class="w-1.5 h-1.5 rounded-full bg-[#4cd964]" />
										{data()?.quality_grade || 'AA+'} · {data()?.confidence_score ?? 90}%
									</span>
									<span class="text-[13px] text-[#a9b6bf] font-mono tabular-nums leading-none">
										≈ ${fmtUsd(parseFloat(data()?.expected_usd || '0') || expectedTon() * 5.25)}
									</span>
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
