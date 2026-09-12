import { useNavigate, useSearchParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { toPng } from 'html-to-image';
import {
	type Component,
	createEffect,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { creditsApi } from '@/entities/intel/api/creditsApi.js';
import { valuationApi } from '@/entities/username/index.js';
import { apiFetch } from '@/shared/api/base.js';
import { isRtl, t } from '@/shared/i18n/index.js';
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
	dictionary: { is_word: boolean; part_of_speech?: string; definition?: string };
	history: {
		is_sold: boolean;
		owner_address?: string;
		highest_past_sale_ton?: number;
		transactions?: { sale_price_ton: string; date: string; buyer: string }[];
	};
	similar: {
		username: string;
		reason: string;
		status?: string;
		sale_price?: number;
		sale_price_usd?: number;
		sale_date?: string;
		price_source?: string;
	}[];
	portfolio?: {
		owner_address: string;
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
	};
	structure: { has_digits: boolean; letters_only: boolean; has_underscore: boolean };
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
		bid_step_ton: number;
		best_day: string;
		best_hour_utc: string;
	};
	search_trend?: { surge_percent: number; status: string };
	live_market?: {
		status: string;
		current_bid_ton?: number;
		current_bid_usd?: number;
		buy_now_ton?: number;
		buy_now_usd?: number;
		auction_ends_at?: string;
		mint_date?: string;
		owner_address?: string;
		previous_owners?: number;
		offers?: { price_ton: number; price_usd?: number; date?: string; from?: string }[];
		fragment_url: string;
		telegram_url: string;
		ask_vs_estimate_pct?: number;
		checked_at: string;
	};
	market_context?: {
		floor_price_ton?: number;
		volume_24h_ton?: number;
		total_volume_ton?: number;
		sales_count?: number;
		listed_ratio?: number;
		active_auctions?: number;
		total_owners?: number;
		items_count?: number;
		highest_sale_ton?: number;
	};
	price_basis?: {
		target_sales: number;
		exact_sales: number;
		broad_sales: number;
		anchor_used: boolean;
		live_ask_used: boolean;
		method: string;
	};
	model_accuracy?: {
		sample_size: number;
		median_error_pct: number;
		within_band_pct: number;
		evaluated_at: string;
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
	entity_info?: { type: string; members: number; verified: boolean };
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
	homoglyph_twins?: HomoglyphTwin[];
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

export const UsernamePage: Component = () => {
	const [searchParams] = useSearchParams();
	const [data, setData] = createSignal<ValuationResult | null>(null);
	const [loading, setLoading] = createSignal<boolean>(true);
	const [error, setError] = createSignal<string | null>(null);
	const [sharing, setSharing] = createSignal<boolean>(false);
	const [downloading, setDownloading] = createSignal<boolean>(false);
	const [sent, setSent] = createSignal<boolean>(false);
	const [sendCount, setSendCount] = createSignal<number>(0);

	const [accessGranted, setAccessGranted] = createSignal<boolean>(false);
	const [_accessMethod, setAccessMethod] = createSignal<
		'free' | 'stars' | 'coins' | 'pro' | 'credit' | null
	>(null);
	const [_isPro, setIsPro] = createSignal<boolean>(false);
	const [_dailyUsed, setDailyUsed] = createSignal<number>(0);
	const [copiedCert, setCopiedCert] = createSignal<boolean>(false);
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
	const [verificationData, setVerificationData] = createSignal<UsernameVerificationResult | null>(null);
	const [copiedSig, setCopiedSig] = createSignal<boolean>(false);
	const [similarFilter, setSimilarFilter] = createSignal<'all' | 'word' | 'structure' | 'price'>('all');

	// Cached-report state: a paid report stays readable for 24h
	const [_fromCache, setFromCache] = createSignal<boolean>(false);
	const [_cacheExpiry, setCacheExpiry] = createSignal<number | null>(null);
	const [recents, setRecents] = createSignal<RecentReport[]>([]);
	const [_showRecents, _setShowRecents] = createSignal<boolean>(false);

	const navigate = useNavigate();
	const username = () => (searchParams.u || '').replace(/^@/, '');

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
		if (!name) return;
		haptic.impact('light');
		navigate(`/username/report?u=${encodeURIComponent(name.replace(/^@/, ''))}`);
	};

	const similarBadge = (item: { status?: string; sale_price?: number; price_source?: string }) => {
		const status = item.status || '';
		const priced = (item.sale_price ?? 0) > 0;
		if (status === 'sold' && priced) {
			return item.price_source === 'archive_anchor'
				? {
						label: t('valuation.archive_sale_badge') || 'ARCHIVE SALE',
						class: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
					}
				: {
						label: t('valuation.historical_sale_badge') || 'VERIFIED SALE',
						class: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30',
					};
		}
		if (status === 'on_sale' || status === 'on_auction') {
			return {
				label: t('valuation.on_sale_badge') || 'ON SALE',
				class: 'bg-[#0098EA]/15 text-[#0098EA] border-[#0098EA]/30',
			};
		}
		if (status === 'taken' || status === 'sold') {
			return {
				label: t('valuation.taken_badge') || 'TAKEN',
				class: 'bg-white/10 text-white/60 border-white/10',
			};
		}
		if (status === 'available') {
			return {
				label: t('valuation.no_sale_badge') || 'UNSOLD / AVAILABLE',
				class: 'bg-emerald-400/10 text-emerald-300/70 border-emerald-400/20',
			};
		}
		return {
			label: t('valuation.unverified_badge') || 'UNVERIFIED',
			class: 'bg-white/5 text-white/35 border-white/10',
		};
	};

	const portfolioBadge = (status: string) => {
		switch (status) {
			case 'on_sale':
			case 'sale':
				return {
					label: t('valuation.listed_badge') || 'LISTED',
					class: 'bg-[#0098EA]/10 text-[#0098EA] border-[#0098EA]/30',
				};
			case 'on_auction':
				return {
					label: t('valuation.auction_badge') || 'AUCTION',
					class: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
				};
			case 'bought':
				return {
					label: t('valuation.acquired_badge') || 'ACQUIRED',
					class: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',
				};
			default:
				return {
					label: t('valuation.holding_badge') || 'HOLDING',
					class: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
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

	const [copiedWallet, setCopiedWallet] = createSignal<boolean>(false);
	const handleCopyWallet = async (addr: string) => {
		if (!addr) return;
		await copyToClipboard(addr);
		setCopiedWallet(true);
		haptic.notify('success');
		setTimeout(() => setCopiedWallet(false), 2500);
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
		if (len <= 5) return '44px';
		if (len <= 8) return '36px';
		if (len <= 12) return '28px';
		return '22px';
	};

	const getTierTheme = (tier: string) => {
		const t = (tier || '').toLowerCase();
		if (t.includes('legendary') || t.includes('grail') || t.includes('god')) {
			return {
				wrapper:
					'from-[#ffaa00] via-[#ff7700] to-[#e65100] shadow-[0_20px_50px_rgba(255,119,0,0.4),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#ffaa00]/15 border-[#ffaa00]/40 text-[#ffaa00] shadow-[0_0_15px_rgba(255,170,0,0.3)]',
				text: 'from-[#ffeaa7] via-[#ffaa00] to-[#ff7700]',
				glow: 'rgba(255,119,0,0.3)',
			};
		}
		if (t.includes('epic') || t.includes('elite') || t.includes('apex')) {
			return {
				wrapper:
					'from-[#0098EA] via-[#0070BA] to-[#004B87] shadow-[0_20px_50px_rgba(0,152,234,0.4),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#0098EA]/15 border-[#0098EA]/40 text-[#0098EA] shadow-[0_0_15px_rgba(0,152,234,0.3)]',
				text: 'from-[#e0f2fe] via-[#38bdf8] to-[#0098EA]',
				glow: 'rgba(0,152,234,0.3)',
			};
		}
		if (t.includes('rare') || t.includes('premium') || t.includes('grand')) {
			return {
				wrapper:
					'from-[#10b981] via-[#059669] to-[#047857] shadow-[0_20px_50px_rgba(16,185,129,0.4),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.3)]',
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
		tg?.showAlert ? tg.showAlert(msg) : alert(msg);
	};

	const handleCopyCertificate = async () => {
		const u = data()?.username || username();
		if (!u) return;
		const link = `${window.location.origin}/username/report?u=${encodeURIComponent(u)}`;
		await copyToClipboard(link);
		setCopiedCert(true);
		haptic.notify('success');
		setTimeout(() => setCopiedCert(false), 3000);
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
			if (cached) {
				applyReport(cached, true);
				setLoading(false);
				return;
			}
		}

		setLoading(true);
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
		}
	};

	// ─── Polling payment confirmation (Phase 0 Fix) ───
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
			fetchVerification(u);

			const cachedAccess = localStorage.getItem(`val_access_${u}`);
			const cached = getCachedReport<ValuationResult>(u);

			if (cached && cachedAccess) {
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
					fetchValuation(u);
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
					class="min-h-screen bg-[#030303] text-white px-5 py-6 flex flex-col items-center font-sans pb-32 select-none relative overflow-x-hidden overflow-y-auto w-full"
					style={{ 'touch-action': 'pan-y' }}
					dir={isRtl() ? 'rtl' : 'ltr'}
				>
					{/* Ambient Dynamic Background */}
					<div
						class="fixed top-0 left-1/2 -translate-x-1/2 w-[150vw] h-[500px] blur-[120px] pointer-events-none z-0 opacity-40 transition-colors duration-1000"
						style={{
							background: `radial-gradient(circle, ${
								accessGranted()
									? getTierTheme(data()?.rarity?.tier || '').glow
									: 'rgba(0,152,234,0.25)'
							} 0%, transparent 60%)`,
						}}
					/>

					<div class="w-full max-w-[420px] flex flex-col items-center gap-4 relative z-10">
						<Show
							when={username()}
							fallback={
								/* ═══════ MODE A: USERNAME DISCOVERY & VALUATION HUB ═══════ */
								<div class="w-full max-w-[440px] flex flex-col items-center gap-4 relative z-10 pt-2 pb-12">
									{/* Hero Header */}
									<div class="w-full flex flex-col items-center text-center gap-2">
										<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0098EA]/10 border border-[#0098EA]/30 text-[#0098EA] text-[11px] font-mono font-black tracking-widest uppercase shadow-[0_0_15px_rgba(0,152,234,0.2)]">
											<span class="w-2 h-2 rounded-full bg-[#0098EA] animate-ping" />
											<span>TEP-62 TELEMINT · AVM v7.0</span>
										</div>
										<h1 class="text-[26px] font-black tracking-tight text-white font-mono drop-shadow-md">
											{isRtl() ? 'رادار هوشمند نام‌های کاربری' : 'TELEGRAM USERNAMES'}
										</h1>
										<p class="text-[12px] text-white/60 font-medium max-w-[320px] leading-relaxed">
											{isRtl()
												? 'ارزیابی ارزش منصفانه با مدل بیزی، اصالت‌سنجی آن‌چین قراردادهای Telemint و ردیابی فیشینگ'
												: 'Empirical Bayesian valuation, on-chain Telemint provenance audit, and anti-phishing twins radar.'}
										</p>
									</div>

									{/* Interactive Cyber Search Input */}
									<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col gap-3.5 shadow-2xl relative overflow-hidden text-start">
										<div class="absolute inset-0 bg-gradient-to-br from-[#0098EA]/5 via-transparent to-emerald-500/5 pointer-events-none" />

										<div class="flex items-center justify-between text-[11px] font-mono font-bold text-white/50 px-1">
											<span>{isRtl() ? 'جستجو یا ارزیابی شناسه' : 'SEARCH & VALUATE HANDLE'}</span>
											<Show when={searchTerm().length > 0}>
												<span class={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
													searchTerm().length < 4
														? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
														: searchTerm().length === 4
															? 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
															: 'bg-emerald-400/15 text-emerald-400 border border-emerald-400/30'
												}`}>
													{searchTerm().length} {isRtl() ? 'کاراکتر' : 'chars'} · {
														searchTerm().length < 4
															? (isRtl() ? 'کوتاه‌تر از ۴' : 'Min 4 for Fragment')
															: searchTerm().length === 4
																? (isRtl() ? 'کلکسیونی ویژه' : 'Grail Collectible')
																: (isRtl() ? 'استاندارد' : 'Standard')
													}
												</span>
											</Show>
										</div>

										{/* Search Field */}
										<div class="relative flex items-center w-full">
											<span class="absolute left-4 text-[22px] font-mono font-bold text-white/30 select-none pointer-events-none">
												@
											</span>
											<input
												type="text"
												value={searchTerm()}
												onInput={(e) => setSearchTerm(e.currentTarget.value.replace(/^@/, '').toLowerCase().trim())}
												onKeyDown={(e) => {
													if (e.key === 'Enter' && searchTerm().length >= 4) {
														openReport(searchTerm());
													}
												}}
												placeholder={isRtl() ? 'نام کاربری مثلاً durov یا rare' : 'e.g. durov, rare, crypto'}
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

										{/* Action Buttons */}
										<div class="grid grid-cols-2 gap-2.5 pt-1">
											<button
												type="button"
												disabled={searchTerm().length < 4}
												onClick={() => openReport(searchTerm())}
												class="h-12 rounded-[16px] bg-gradient-to-r from-[#0098EA] to-[#0070BA] hover:from-[#00a6ff] hover:to-[#0080d0] disabled:opacity-40 disabled:pointer-events-none text-white font-mono font-black text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(0,152,234,0.4)] active:scale-[0.98] transition-all"
											>
												<span class="material-symbols-outlined text-[18px]">query_stats</span>
												<span>{isRtl() ? 'ارزیابی ارزش' : 'VALUATE'}</span>
											</button>
											<button
												type="button"
												disabled={searchTerm().length < 4 || verifyingOnChain()}
												onClick={() => fetchVerification(searchTerm())}
												class="h-12 rounded-[16px] bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none border border-white/10 hover:border-white/20 text-white font-mono font-bold text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
											>
												<span class={`material-symbols-outlined text-[18px] text-cyan-400 ${verifyingOnChain() ? 'animate-spin' : ''}`}>
													{verifyingOnChain() ? 'sync' : 'verified'}
												</span>
												<span>{isRtl() ? 'استعلام آن‌چین' : 'VERIFY ON-CHAIN'}</span>
											</button>
										</div>
									</div>

									{/* On-Chain Instant Verification Box (if searched in hub) */}
									<Show when={verificationData()}>
										{(ver) => (
											<div class="w-full bg-[#12141C]/95 backdrop-blur-2xl border border-emerald-500/30 rounded-[24px] p-4 flex flex-col gap-3 shadow-xl text-start">
												<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
													<div class="flex items-center gap-2">
														<span class={`material-symbols-outlined text-[18px] ${
															ver().is_minted_nft && ver().collection_verified
																? 'text-emerald-400'
																: 'text-amber-400'
														}`}>
															{ver().is_minted_nft && ver().collection_verified ? 'verified' : 'info'}
														</span>
														<span class="text-[13px] font-black font-mono text-white" dir="ltr">
															@{ver().username}
														</span>
													</div>
													<span class={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-[6px] border ${
														ver().is_minted_nft && ver().collection_verified
															? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
															: 'bg-amber-400/15 border-amber-400/30 text-amber-400'
													}`}>
														{ver().is_minted_nft && ver().collection_verified
															? (isRtl() ? 'تاییدشده Telemint' : 'TELEMINT NFT')
															: (isRtl() ? 'توکنایز نشده' : 'UNMINTED')}
													</span>
												</div>

												<div class="flex flex-col gap-1.5 text-[11px] font-mono text-white/70">
													<div class="flex justify-between items-center">
														<span class="text-white/40">{isRtl() ? 'وضعیت تلگرام:' : 'Telegram Status:'}</span>
														<span class="text-white font-bold">{ver().telegram_status}</span>
													</div>
													<Show when={ver().telemint_provenance?.item_address}>
														<div class="flex justify-between items-center">
															<span class="text-white/40">{isRtl() ? 'کانترکت آیتم:' : 'Item Contract:'}</span>
															<a
																href={`https://tonviewer.com/${ver().telemint_provenance.item_address}`}
																target="_blank"
																rel="noreferrer"
																class="text-[#0098EA] hover:underline"
															>
																{ver().telemint_provenance.item_address!.slice(0, 6)}...{ver().telemint_provenance.item_address!.slice(-4)} ↗
															</a>
														</div>
													</Show>
												</div>

												<button
													type="button"
													onClick={() => openReport(ver().username)}
													class="w-full h-10 rounded-[14px] bg-[#0098EA]/20 hover:bg-[#0098EA]/30 border border-[#0098EA]/40 text-[#0098EA] font-mono font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all mt-1"
												>
													<span>{isRtl() ? 'مشاهده گزارش کامل و ارزش‌گذاری' : 'VIEW FULL VALUATION REPORT'}</span>
													<span class="material-symbols-outlined text-[15px]">arrow_forward</span>
												</button>
											</div>
										)}
									</Show>

									{/* Curated Trending Handles */}
									<div class="w-full flex flex-col gap-2.5 text-start">
										<div class="flex items-center justify-between px-1">
											<span class="text-[11px] font-mono font-black text-white/50 uppercase tracking-wider flex items-center gap-1.5">
												<span class="material-symbols-outlined text-[16px] text-amber-400">local_fire_department</span>
												{isRtl() ? 'شناسه‌های داغ و برگزیده' : 'TRENDING & NOTABLE HANDLES'}
											</span>
											<span class="text-[10px] font-mono text-white/30">{isRtl() ? 'کلیک برای بررسی' : 'Tap to inspect'}</span>
										</div>
										<div class="flex flex-wrap gap-2">
											<For each={['rare', 'durov', 'bank', 'crypto', 'ton', 'vip', 'ai', 'meta', 'gift', 'telegram', 'news']}>
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

									{/* Recent Appraisals (from cache) */}
									<Show when={recents().length > 0}>
										<div class="w-full flex flex-col gap-2.5 text-start">
											<div class="flex items-center justify-between px-1">
												<span class="text-[11px] font-mono font-black text-white/50 uppercase tracking-wider flex items-center gap-1.5">
													<span class="material-symbols-outlined text-[16px] text-[#0098EA]">history</span>
													{isRtl() ? 'آخرین ارزیابی‌های شما (۲۴ ساعته)' : 'RECENT APPRAISALS (24H CACHE)'}
												</span>
												<span class="text-[10px] font-mono text-white/30">{recents().length} {isRtl() ? 'مورد' : 'saved'}</span>
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
																<span class="text-white font-mono font-bold text-[13px] truncate" dir="ltr">
																	@{rep.username}
																</span>
																<span class="text-white/40 text-[10px] font-mono">
																	{new Date(rep.savedAt).toLocaleDateString()}
																</span>
															</div>
															<div class="flex flex-col items-end shrink-0">
																<span class="text-emerald-400 font-mono font-black text-[12px]">
																	{rep.expectedTon ? `${fmtTon(parseFloat(rep.expectedTon))} TON` : 'View'}
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

									{/* Market Overview Highlights */}
									<div class="w-full grid grid-cols-2 gap-2.5 pt-2">
										<div class="p-3.5 rounded-[20px] bg-[#12141C]/80 border border-white/5 flex flex-col gap-1 text-start">
											<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-widest">
												{isRtl() ? 'رکورد بالاترین معامله' : 'ALL-TIME RECORD SALE'}
											</span>
											<span class="text-white font-mono font-black text-[15px] text-amber-400">
												994,000 TON
											</span>
											<span class="text-[10px] font-mono text-white/50" dir="ltr">@news (Fragment)</span>
										</div>
										<div class="p-3.5 rounded-[20px] bg-[#12141C]/80 border border-white/5 flex flex-col gap-1 text-start">
											<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-widest">
												{isRtl() ? 'استاندارد قرارداد هوشمند' : 'SMART CONTRACT'}
											</span>
											<span class="text-white font-mono font-black text-[15px] text-cyan-400">
												TEP-62 Telemint
											</span>
											<span class="text-[10px] font-mono text-white/50">{isRtl() ? 'بلاکچین TON' : 'TON Blockchain'}</span>
										</div>
									</div>
								</div>
							}
						>
							{/* ═══════ HERO CARD: UNLOCKED (3D GYRO) vs MINIMALIST PAYWALL ═══════ */}
							<Show
								when={accessGranted() && data()}
								fallback={
									<div class="w-full max-w-[440px] mx-auto my-2 flex flex-col gap-3 relative z-20">
										{/* 🌟 CURIOSITY TEASER CARD BEFORE UNLOCK */}
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

											{/* On-Chain Quick Status Chip on Teaser */}
											<Show when={verificationData()}>
												{(ver) => (
													<div class="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-white/70 z-10 my-1">
														<span class={`w-2 h-2 rounded-full ${ver().is_minted_nft ? 'bg-emerald-400' : 'bg-amber-400'}`} />
														<span class="font-bold">{ver().is_minted_nft ? 'TELEMINT NFT (ON-CHAIN)' : 'UNMINTED HANDLE'}</span>
														<span class="text-white/30">|</span>
														<span class="capitalize">{ver().telegram_status}</span>
													</div>
												)}
											</Show>

											{/* Redacted Fair Value Pill */}
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

											{/* 3 Core Value Signals */}
											<div class="w-full flex flex-col gap-2 text-start pt-2 border-t border-white/5 text-[11px] z-10">
												<div class="flex items-center gap-2 text-white/70 font-medium">
													<span class="text-[#0098EA] font-black">✓</span>
													<span>
														{t('valuation.teaser_signals') ||
															'17-Point Quantitative Bayesian Pricing Matrix'}
													</span>
												</div>
												<div class="flex items-center gap-2 text-white/70 font-medium">
													<span class="text-[#0098EA] font-black">✓</span>
													<span>
														{t('valuation.teaser_whale') ||
															'Whale Wallet Radar & Complete On-chain Ownership Scan'}
													</span>
												</div>
												<div class="flex items-center gap-2 text-white/70 font-medium">
													<span class="text-[#0098EA] font-black">✓</span>
													<span>
														{t('valuation.teaser_cert') ||
															'Official Digital Appraisal Certificate with 1-Click Story Export'}
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
							{/* 💎 SECTION 1: OVERVIEW & 3D GYRO CARD */}
							<div id="sec-overview" class="w-full scroll-mt-16 flex flex-col gap-3">
								<div
									class={`w-full aspect-square p-[3px] bg-gradient-to-br ${
										getTierTheme(data()?.rarity?.tier || '').wrapper
									} rounded-[48px] my-2 relative z-20 transition-all duration-300`}
								>
									<div
										ref={cardRef}
										onMouseMove={handleMouseMove}
										onMouseLeave={handleMouseLeave}
										onTouchMove={handleTouchMove}
										onTouchEnd={handleTouchEnd}
										onTouchCancel={handleTouchEnd}
										class="w-full h-full bg-[#08090D] rounded-[45px] p-8 relative overflow-hidden flex flex-col justify-between shadow-inner"
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
												}%, rgba(255,255,255,0.4) 0%, transparent 60%)`,
											}}
										/>
										<div class="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />

										<div class="flex justify-between items-center z-10">
											<span
												class={`px-4 py-2 border rounded-[12px] text-[10px] font-black tracking-widest uppercase shadow-sm ${
													getTierTheme(data()?.rarity?.tier || '').badge
												}`}
											>
												{data()?.rarity?.tier || 'STANDARD'}
											</span>
											<span class="text-[11px] font-mono font-black text-white/30 tracking-[5px] uppercase bg-white/5 border border-white/5 px-4 py-1.5 rounded-[12px] shadow-inner">
												{'IFRAGMENT'}
											</span>
										</div>

										<div class="flex flex-col justify-center items-center z-10 text-center flex-grow relative py-6 w-full">
											<div
												class="absolute w-full h-[160px] opacity-70 -z-10 pointer-events-none mix-blend-screen"
												style={{
													background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${
														getTierTheme(data()?.rarity?.tier || '').glow
													}, transparent 70%)`,
												}}
											/>
											<div class="flex items-center justify-center gap-2.5 w-full">
												<span class="text-white/20 font-black text-[28px] select-none drop-shadow-md">
													✦
												</span>
												<span
													class="inline-block font-black tracking-tighter text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] truncate max-w-[75%] pb-2"
													style={{ 'font-size': getFontSize(data()?.username || username()) }}
													dir="ltr"
												>
													@{data()?.username || username()}
												</span>
												<span class="text-white/20 font-black text-[28px] select-none drop-shadow-md">
													✦
												</span>
											</div>
										</div>

										<div class="flex justify-between items-end border-t border-white/10 pt-5 z-10">
											<div class="flex flex-col gap-1 text-left">
												<span class="text-[10px] font-black text-white/40 uppercase tracking-widest mb-0.5">
													{t('valuation.estimated_price') || 'ESTIMATED VALUE'}
												</span>
												<div class="flex items-center gap-2.5">
													<svg
														class="w-8 h-8 filter drop-shadow-[0_0_15px_rgba(0,152,234,0.6)]"
														viewBox="0 0 56 56"
														fill="none"
														xmlns="http://www.w3.org/2000/svg"
														aria-hidden="true"
													>
														<path
															d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z"
															fill="#0098EA"
														/>
														<path
															d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5765 15.6277H37.5603ZM26.2483 36.8068L23.6119 31.8097L17.2017 20.6506C16.6742 19.7557 17.3255 18.6198 18.4223 18.6198H26.2483V36.8068ZM38.7972 20.6506L32.387 31.8259L29.7506 36.8068V18.6361H37.5765C38.6734 18.6361 39.3247 19.772 38.7972 20.6669V20.6506Z"
															fill="white"
														/>
													</svg>
													<span class="text-[34px] font-black text-white leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] tracking-tight">
														{fmtTon(expectedTon())}
													</span>
													<span class="text-[15px] font-black text-[#0098EA] leading-none mb-1">
														{t('common.ton')}
													</span>
												</div>
											</div>
											<div class="flex flex-col items-end gap-2">
												<div class="flex items-center gap-1.5 bg-[#10b981]/15 px-3 py-1 rounded-[10px] border border-[#10b981]/40 text-[#10b981] font-black uppercase tracking-widest text-[9px] shadow-[0_0_20px_rgba(16,185,129,0.2)]">
													<div class="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse" />{' '}
													{t('valuation.verified')}
												</div>
												<span class="text-[14px] text-white/60 font-black leading-none font-mono">
													≈ ${fmtUsd(parseFloat(data()?.expected_usd || '0'))}
												</span>
											</div>
										</div>
									</div>
								</div>

								{/* ═══════ EXECUTIVE 4-PILLAR KPI SNAPSHOT ═══════ */}
								<div class="w-full grid grid-cols-2 sm:grid-cols-4 gap-2 my-1">
									{/* 1. Fair Value */}
									<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[20px] p-3 flex flex-col justify-between shadow-sm">
										<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5">
											<span class="w-1.5 h-1.5 rounded-full bg-[#0098EA]" />
											{t('valuation.fair_value') || 'FAIR VALUE'}
										</span>
										<div class="mt-2">
											<div class="text-[16px] font-black text-white font-mono tracking-tight flex items-baseline gap-1">
												{fmtTon(expectedTon())}
												<span class="text-[10px] font-normal text-[#0098EA]">TON</span>
											</div>
											<div class="text-[10px] font-mono text-white/40 font-semibold mt-0.5">
												≈ ${fmtUsd(parseFloat(data()?.expected_usd || '0'))}
											</div>
										</div>
									</div>

									{/* 2. Confidence */}
									<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[20px] p-3 flex flex-col justify-between shadow-sm">
										<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5">
											<span class="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
											{t('valuation.confidence_label') || 'CONFIDENCE'}
										</span>
										<div class="mt-2">
											<div class="text-[16px] font-black text-[#10b981] font-mono tracking-tight flex items-baseline gap-1">
												{data()?.confidence_score || 0}%
											</div>
											<div class="text-[10px] font-mono text-white/40 font-semibold mt-0.5">
												{data()?.rarity?.tier || 'Grade A'}
											</div>
										</div>
									</div>

									{/* 3. Liquidity */}
									<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[20px] p-3 flex flex-col justify-between shadow-sm">
										<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5">
											<span class="w-1.5 h-1.5 rounded-full bg-amber-400" />
											{t('valuation.liquidity') || 'LIQUIDITY'}
										</span>
										<div class="mt-2">
											<div class="text-[13px] font-black text-amber-400 font-mono tracking-tight truncate">
												{data()?.liquidity_rating || 'Moderate'}
											</div>
											<div class="text-[10px] font-mono text-white/40 font-semibold mt-0.5 truncate">
												{data()?.estimated_sell_time || '1–3 Weeks'}
											</div>
										</div>
									</div>

									{/* 4. Target Buyer */}
									<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[20px] p-3 flex flex-col justify-between shadow-sm">
										<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-widest flex items-center gap-1.5">
											<span class="w-1.5 h-1.5 rounded-full bg-cyan-400" />
											{t('valuation.target_profile') || 'BUYER CLASS'}
										</span>
										<div class="mt-2">
											<div class="text-[13px] font-black text-cyan-300 font-mono tracking-tight truncate">
												{data()?.target_buyer_profile || 'Brand & Investor'}
											</div>
											<div class="text-[10px] font-mono text-white/40 font-semibold mt-0.5 truncate">
												{data()?.comparable_sales_count || 0}{' '}
												{t('valuation.comparables_title') || 'Comps'}
											</div>
										</div>
									</div>
								</div>
							</div>
						</Show>

						{/* ═══════ UNLOCKED REPORT CONTENT (PHASE 3 & 4) ═══════ */}
						<Show when={accessGranted() && data()}>
							{/* ⚠️ STALE FALLBACK RATE WARNING */}
							<Show when={data()?.is_fallback_used}>
								<div class="w-full p-3.5 rounded-[20px] bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-amber-300 text-xs font-medium shadow-sm">
									<span class="material-symbols-outlined text-lg text-amber-400 shrink-0">warning</span>
									<span>
										{isRtl()
											? 'توجه: نرخ برابری TON به USD به دلیل اختلال موقت شبکه بر مبنای آخرین نرخ آفلاین (Stale Fallback) محاسبه شده است.'
											: 'Notice: TON/USD exchange rate is calculated based on an offline fallback rate due to upstream provider latency.'}
									</span>
								</div>
							</Show>

							{/* 🏷️ DATA PROVENANCE BADGES STRIP */}
							<div class="w-full flex flex-wrap items-center gap-2">
								<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-mono font-bold shadow-sm">
									<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
									<span>TEP-62 Verified</span>
								</div>
								<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0098EA]/10 border border-[#0098EA]/25 text-[#0098EA] text-[10px] font-mono font-bold shadow-sm">
									<span class="material-symbols-outlined text-[13px]">dataset</span>
									<span>AVM v7.0 Econometric</span>
								</div>
								<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/25 text-cyan-300 text-[10px] font-mono font-bold shadow-sm">
									<span class="material-symbols-outlined text-[13px]">account_balance</span>
									<span>TON Mainnet</span>
								</div>
								<Show when={data()?.is_fallback_used}>
									<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold shadow-sm">
										<span class="material-symbols-outlined text-[13px]">history_toggle_off</span>
										<span>Stale Rate Fallback</span>
									</div>
								</Show>
							</div>

							{/* 🛡️ ON-CHAIN TELEMINT PROVENANCE & AUTHENTICITY CARD */}
							<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start flex flex-col gap-3.5 relative overflow-hidden">
								<div class="absolute -right-8 -top-8 w-28 h-28 bg-[#0098EA]/10 blur-3xl rounded-full pointer-events-none" />

								<div class="flex items-center justify-between border-b border-white/5 pb-3 relative z-10">
									<div class="flex items-center gap-2.5 min-w-0">
										<div class={`w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 border ${
											(data()?.telemint_provenance?.is_authentic ?? verificationData()?.telemint_provenance?.is_authentic)
												? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
												: (data()?.telemint_provenance?.collection_match === false || verificationData()?.collection_verified === false)
													? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
													: 'bg-white/5 border-white/10 text-white/50'
										}`}>
											<span class="material-symbols-outlined text-[20px]">
												{(data()?.telemint_provenance?.is_authentic ?? verificationData()?.telemint_provenance?.is_authentic)
													? 'verified'
													: (data()?.telemint_provenance?.collection_match === false || verificationData()?.collection_verified === false)
														? 'gpp_bad'
														: 'shield_locked'}
											</span>
										</div>
										<div class="flex flex-col min-w-0">
											<h4 class="text-[13px] font-black text-white uppercase tracking-wider truncate">
												{isRtl() ? 'اصالت قرارداد هوشمند آن‌چین (Telemint)' : 'ON-CHAIN TELEMINT AUTHENTICITY'}
											</h4>
											<span class="text-[10px] text-white/40 font-mono truncate">
												{isRtl() ? 'تایید مستقیم قرارداد بر بستر شبکه TON' : 'TEP-62 Smart Contract Verification'}
											</span>
										</div>
									</div>
									<span class={`text-[9px] font-mono font-black uppercase px-2.5 py-1 rounded-[8px] border shrink-0 ${
										(data()?.telemint_provenance?.is_authentic ?? verificationData()?.telemint_provenance?.is_authentic)
											? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
											: (data()?.telemint_provenance?.collection_match === false || verificationData()?.collection_verified === false)
												? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
												: 'bg-white/5 border-white/10 text-white/40'
									}`}>
										{(data()?.telemint_provenance?.is_authentic ?? verificationData()?.telemint_provenance?.is_authentic)
											? (isRtl() ? 'قرارداد معتبر تلمینت' : 'VERIFIED TELEMINT')
											: (data()?.telemint_provenance?.collection_match === false || verificationData()?.collection_verified === false)
												? (isRtl() ? 'هشدار کالکشن جعلی!' : 'COUNTERFEIT MISMATCH')
												: (isRtl() ? 'توکنایز نشده' : 'UNMINTED HANDLE')}
									</span>
								</div>

								{/* Contract details */}
								<div class="flex flex-col gap-2 relative z-10 text-[11px] font-mono">
									{/* Item Contract Address */}
									<Show when={data()?.telemint_provenance?.item_address || verificationData()?.telemint_provenance?.item_address}>
										{(addr) => (
											<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex items-center justify-between gap-2">
												<div class="flex flex-col min-w-0">
													<span class="text-[9px] text-white/40 uppercase font-black tracking-wider">
														{isRtl() ? 'آدرس کانترکت NFT آیتم' : 'ITEM NFT CONTRACT'}
													</span>
													<span class="text-white font-mono text-[12px] truncate" dir="ltr">
														{addr()}
													</span>
												</div>
												<div class="flex items-center gap-1.5 shrink-0">
													<button
														type="button"
														onClick={() => handleCopyWallet(addr())}
														class="p-1.5 rounded-[8px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
														title="Copy Address"
													>
														<span class="material-symbols-outlined text-[15px]">content_copy</span>
													</button>
													<a
														href={`https://tonviewer.com/${addr()}`}
														target="_blank"
														rel="noreferrer"
														class="px-2 py-1 rounded-[8px] bg-[#0098EA]/15 border border-[#0098EA]/30 text-[#0098EA] text-[10px] font-mono font-bold flex items-center gap-1"
													>
														<span>Explorer</span>
														<span class="material-symbols-outlined text-[12px]">open_in_new</span>
													</a>
												</div>
											</div>
										)}
									</Show>

									{/* Canonical Collection Match */}
									<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex items-center justify-between gap-2">
										<div class="flex flex-col min-w-0">
											<span class="text-[9px] text-white/40 uppercase font-black tracking-wider">
												{isRtl() ? 'کالکشن رسمی تلگرام' : 'CANONICAL COLLECTION'}
											</span>
											<span class="text-emerald-400 font-mono text-[11px] truncate" dir="ltr">
												EQCA14o1-WWhHQBl5wuqRLCcGvlazoEkOOhodW2aqvoUsUQ2
											</span>
										</div>
										<span class="material-symbols-outlined text-[18px] text-emerald-400 shrink-0">
											check_circle
										</span>
									</div>

									{/* Escrow Status or Owner */}
									<Show when={data()?.telemint_provenance?.is_escrow || verificationData()?.telemint_provenance?.is_escrow}>
										<div class="p-3 rounded-[16px] bg-[#0098EA]/10 border border-[#0098EA]/30 flex items-center justify-between gap-2 text-[#0098EA]">
											<div class="flex items-center gap-2">
												<span class="material-symbols-outlined text-[18px]">lock_clock</span>
												<span class="text-[11px] font-bold">
													{isRtl()
														? `شناسه در اسکرو قرارداد ${data()?.telemint_provenance?.escrow_marketplace || verificationData()?.telemint_provenance?.escrow_marketplace || 'Fragment'} قرار دارد`
														: `Locked in Escrow: ${data()?.telemint_provenance?.escrow_marketplace || verificationData()?.telemint_provenance?.escrow_marketplace || 'Fragment'} Marketplace`}
												</span>
											</div>
											<span class="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded bg-[#0098EA]/20 border border-[#0098EA]/40">
												ESCROW
											</span>
										</div>
									</Show>
								</div>
							</div>

							{/* 🌐 CANONICAL DUAL-STATUS: TELEGRAM LIFECYCLE vs FRAGMENT MARKETPLACE */}
							<div class="w-full grid grid-cols-2 gap-2.5">
								{/* 1. Telegram App State */}
								<div class="p-3.5 rounded-[20px] bg-[#12141C]/90 backdrop-blur-xl border border-white/10 flex flex-col justify-between text-start shadow-sm">
									<div class="flex items-center justify-between gap-1 mb-1.5">
										<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
											{isRtl() ? 'وضعیت در تلگرام' : 'Telegram State'}
										</span>
										<span class="material-symbols-outlined text-xs text-cyan-400">person</span>
									</div>
									<div class="flex items-center gap-1.5">
										<span
											class={`w-2 h-2 rounded-full ${
												data()?.telegram_status === 'occupied' || data()?.status === 'taken'
													? 'bg-amber-400 animate-pulse'
													: 'bg-emerald-400'
											}`}
										/>
										<span class="text-xs font-black text-white">
											{data()?.telegram_status === 'occupied' || data()?.status === 'taken'
												? (isRtl() ? 'تخصیص‌یافته (مشغول)' : 'Occupied / In Use')
												: (isRtl() ? 'آزاد در شبکه' : 'Available on Telegram')}
										</span>
									</div>
								</div>

								{/* 2. Fragment Marketplace State */}
								<div class="p-3.5 rounded-[20px] bg-[#12141C]/90 backdrop-blur-xl border border-white/10 flex flex-col justify-between text-start shadow-sm">
									<div class="flex items-center justify-between gap-1 mb-1.5">
										<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
											{isRtl() ? 'وضعیت در فرگمنت' : 'Fragment Market'}
										</span>
										<span class="material-symbols-outlined text-xs text-[#0098EA]">storefront</span>
									</div>
									<div class="flex items-center gap-1.5">
										<span
											class={`w-2 h-2 rounded-full ${
												data()?.fragment_market_status === 'on_auction'
													? 'bg-cyan-400 animate-ping'
													: data()?.fragment_market_status === 'on_sale'
														? 'bg-emerald-400'
														: data()?.fragment_market_status === 'sold'
															? 'bg-indigo-400'
															: 'bg-white/30'
											}`}
										/>
										<span class="text-xs font-black text-white capitalize">
											{data()?.fragment_market_status === 'on_auction'
												? (isRtl() ? 'در حال حراج' : 'Live Auction')
												: data()?.fragment_market_status === 'on_sale'
													? (isRtl() ? 'فروش مقطوع' : 'Fixed Sale')
													: data()?.fragment_market_status === 'sold'
														? (isRtl() ? 'فروخته‌شده (در والت)' : 'Minted / In Wallet')
														: (isRtl() ? 'لیست‌نشده' : 'Unlisted')}
										</span>
									</div>
								</div>
							</div>

							{/* ⚖️ TRADEMARK & LEGAL RISK ADVISORY CARD */}
							<Show when={data()?.trademark_risk && data()!.trademark_risk!.risk_level !== 'low'}>
								<div class={`w-full p-4 rounded-[24px] border backdrop-blur-xl text-start shadow-xl relative overflow-hidden ${
									data()!.trademark_risk!.risk_level === 'high'
										? 'bg-gradient-to-br from-rose-950/40 via-[#12141C] to-rose-900/20 border-rose-500/40'
										: 'bg-gradient-to-br from-amber-950/40 via-[#12141C] to-amber-900/20 border-amber-500/40'
								}`}>
									<div class="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
										<div class="flex items-center gap-2">
											<span class={`material-symbols-outlined text-base ${
												data()!.trademark_risk!.risk_level === 'high' ? 'text-rose-400' : 'text-amber-400'
											}`}>
												gavel
											</span>
											<h4 class="text-xs font-black text-white">
												{isRtl() ? 'هشدار حقوقی و ریسک علامت تجاری (Trademark)' : 'Trademark & Legal Risk Advisory'}
											</h4>
										</div>
										<span class={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-md border ${
											data()!.trademark_risk!.risk_level === 'high'
												? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
												: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
										}`}>
											{data()!.trademark_risk!.risk_level === 'high' ? 'RISK: HIGH' : 'RISK: MEDIUM'}
										</span>
									</div>

									<p class="text-[11px] text-white/80 leading-relaxed mb-2.5">
										{data()!.trademark_risk!.advisory_warning}
									</p>

									<div class="flex items-center justify-between text-[10px] text-white/50 pt-2 border-t border-white/5 font-mono">
										<span>{isRtl() ? 'مرجع حقوقی:' : 'Legal Ref:'} Telegram ToS §4 & App Stores Policy</span>
										<Show when={data()!.trademark_risk!.matched_entity}>
											<span class="text-white/70 font-bold truncate max-w-[50%]">{data()!.trademark_risk!.matched_entity}</span>
										</Show>
									</div>
								</div>
							</Show>

							{/* 🪞 ANTI-PHISHING & HOMOGLYPH LOOKALIKE TWINS */}
							<Show when={(data()?.homoglyph_twins && data()!.homoglyph_twins!.length > 0) || data()?.risk_audit?.has_homoglyph_risk}>
								<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-rose-500/30 rounded-[28px] p-5 flex flex-col gap-3.5 shadow-[0_10px_30px_rgba(244,63,94,0.1)] text-start relative overflow-hidden">
									<div class="flex items-center justify-between border-b border-white/5 pb-3">
										<div class="flex items-center gap-2.5 min-w-0">
											<div class="w-9 h-9 rounded-[12px] bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
												<span class="material-symbols-outlined text-[20px]">security_update_warning</span>
											</div>
											<div class="flex flex-col min-w-0">
												<h4 class="text-[13px] font-black text-white uppercase tracking-wider truncate">
													{isRtl() ? 'دوقلوهای بصری و ردیابی فیشینگ' : 'CONFUSABLE TWINS & SPOOF RADAR'}
												</h4>
												<span class="text-[10px] text-white/40 font-mono truncate">
													{isRtl() ? 'کاراکترهای مشابه‌نما (Homoglyph substitutions)' : 'Visual confusable substitution attack vectors'}
												</span>
											</div>
										</div>
										<span class="text-[9px] font-mono font-black text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-[6px] shrink-0">
											{data()?.homoglyph_twins?.length || 1} {isRtl() ? 'مورد تحلیل' : 'TWINS'}
										</span>
									</div>

									<Show when={data()?.risk_audit?.homoglyph_message}>
										<div class="p-3 rounded-[16px] bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-mono leading-relaxed">
											{data()!.risk_audit!.homoglyph_message}
										</div>
									</Show>

									<Show when={data()?.homoglyph_twins && data()!.homoglyph_twins!.length > 0}>
										<div class="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
											<For each={data()!.homoglyph_twins}>
												{(twin) => (
													<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex items-center justify-between gap-2">
														<div class="flex flex-col min-w-0">
															<div class="flex items-center gap-2">
																<span class="text-white font-mono font-black text-[13px]" dir="ltr">
																	@{twin.twin}
																</span>
																<span class={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-[5px] border ${
																	twin.risk_level === 'critical'
																		? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
																		: twin.risk_level === 'high'
																			? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
																			: 'bg-white/10 text-white/50 border-white/10'
																}`}>
																	{twin.risk_level}
																</span>
															</div>
															<Show when={twin.similarity}>
																<span class="text-white/40 text-[10px] truncate mt-0.5">
																	{twin.similarity}
																</span>
															</Show>
														</div>
														<div class="flex flex-col items-end shrink-0">
															<span class="text-[10px] font-mono font-bold uppercase text-white/60">
																{twin.status}
															</span>
															<Show when={twin.price_ton}>
																<span class="text-emerald-400 font-mono font-bold text-[11px]">
																	{fmtTon(twin.price_ton)} TON
																</span>
															</Show>
														</div>
													</div>
												)}
											</For>
										</div>
									</Show>
								</div>
							</Show>

							{/* 💰 TRANSACTION ECONOMICS & FRAGMENT PROTOCOL FEE */}
							<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col gap-3.5 shadow-xl text-start">
								<div class="flex items-center justify-between border-b border-white/5 pb-3">
									<div class="flex items-center gap-2.5">
										<div class="w-9 h-9 rounded-[12px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
											<span class="material-symbols-outlined text-[20px]">payments</span>
										</div>
										<div class="flex flex-col">
											<h4 class="text-[13px] font-black text-white uppercase tracking-wider">
												{isRtl() ? 'محاسبات مالی معامله در فرگمنت' : 'TRANSACTION ECONOMICS'}
											</h4>
											<span class="text-[10px] text-white/40 font-mono">
												{isRtl() ? 'کسر کارمزد پروتکل ۵٪ (حداقل ۵ TON) و خالص دریافتی' : 'Net seller proceeds after 5% protocol fee (min 5 TON)'}
											</span>
										</div>
									</div>
									<span class="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-[6px]">
										Fragment v2
									</span>
								</div>

								<div class="grid grid-cols-2 gap-2.5">
									{/* Estimated Fair Value */}
									<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex flex-col gap-1">
										<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
											{isRtl() ? 'ارزش ناخالص تخمینی' : 'GROSS VALUATION'}
										</span>
										<span class="text-white font-mono font-black text-[15px]">
											{fmtTon(expectedTon())} TON
										</span>
										<span class="text-[10px] font-mono text-white/40">
											≈ ${fmtUsd(parseFloat(data()?.expected_usd || '0'))}
										</span>
									</div>

									{/* Fragment Fee */}
									<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3 flex flex-col gap-1">
										<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
											{isRtl() ? 'کارمزد فرگمنت (۵٪)' : 'FRAGMENT 5% FEE'}
										</span>
										<span class="text-amber-400 font-mono font-black text-[15px]">
											-{fmtTon(Math.max(5, Math.round(expectedTon() * 0.05)))} TON
										</span>
										<span class="text-[10px] font-mono text-white/40">
											{isRtl() ? 'حداقل ۵ TON بر معامله' : 'Min 5 TON per sale'}
										</span>
									</div>

									{/* Net Payout */}
									<div class="col-span-2 bg-gradient-to-r from-emerald-950/30 to-[#08090D] border border-emerald-500/20 rounded-[18px] p-3.5 flex items-center justify-between">
										<div class="flex flex-col">
											<span class="text-[9px] font-mono font-black text-emerald-400 uppercase tracking-wider">
												{isRtl() ? 'خالص دریافتی فروشنده' : 'NET SELLER PROCEEDS'}
											</span>
											<span class="text-emerald-400 font-mono font-black text-[17px]">
												{fmtTon(Math.max(0, expectedTon() - Math.max(5, expectedTon() * 0.05)))} TON
											</span>
											<span class="text-[10px] font-mono text-white/40">
												≈ ${fmtUsd(Math.max(0, parseFloat(data()?.expected_usd || '0') * 0.95))} USD
											</span>
										</div>
										<div class="flex flex-col items-end gap-1">
											<span class="text-[9px] font-mono font-bold text-white/40 uppercase">
												{isRtl() ? 'شروع پیشنهادی حراج' : 'REC. START BID'}
											</span>
											<span class="text-white font-mono font-black text-[13px] bg-white/5 px-2.5 py-1 rounded-[8px] border border-white/10">
												{fmtTon(Math.round(expectedTon() * 0.7))} TON
											</span>
										</div>
									</div>
								</div>
							</div>

							{/* 📊 MODEL VALUATION BAND */}
							<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start">
								<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-emerald-400 text-base">monitoring</span>
										<h4 class="text-xs font-black text-white">
											{isRtl() ? 'بازه مدل ارزش‌گذاری (Model Band)' : 'Econometric Model Band'}
										</h4>
									</div>
									<span class="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
										{data()?.empirical_band?.band_type || 'PARAMETRIC'}
									</span>
								</div>

								<div class="grid grid-cols-3 gap-2 text-center">
									{/* Model Low / Floor */}
									<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5 min-w-0">
										<span class="text-[9px] uppercase font-black text-rose-400 block mb-1 truncate">
											{isRtl() ? 'کف تحلیلی (Low)' : 'Model Low'}
										</span>
										<span class="font-mono font-black text-white text-xs sm:text-sm block truncate" dir="ltr">
											{fmtTon(data()?.empirical_band?.model_low_ton || data()?.empirical_band?.p10_ton || Math.round(expectedTon() * 0.7))} <span class="text-[9px] text-[#0098EA]">TON</span>
										</span>
										<span class="text-[9px] text-white/40 font-mono block mt-0.5 truncate" dir="ltr">
											≈ ${fmtUsd(data()?.empirical_band?.model_low_usd || data()?.empirical_band?.p10_usd || Math.round((data()?.empirical_band?.p10_ton || expectedTon() * 0.7) * (data()?.ton_usd_rate || 0)))}
										</span>
									</div>

									{/* Model Mid / Fair */}
									<div class="p-3 rounded-2xl bg-[#0098EA]/10 border border-[#0098EA]/30 min-w-0 shadow-sm">
										<span class="text-[9px] uppercase font-black text-[#0098EA] block mb-1 truncate">
											{isRtl() ? 'برآورد پایه (Mid)' : 'Model Mid'}
										</span>
										<span class="font-mono font-black text-white text-xs sm:text-sm block truncate" dir="ltr">
											{fmtTon(data()?.empirical_band?.model_mid_ton || data()?.empirical_band?.p50_ton || Math.round(expectedTon()))} <span class="text-[9px] text-[#0098EA]">TON</span>
										</span>
										<span class="text-[9px] text-white/40 font-mono block mt-0.5 truncate" dir="ltr">
											≈ ${fmtUsd(data()?.empirical_band?.model_mid_usd || data()?.empirical_band?.p50_usd || Math.round((data()?.empirical_band?.p50_ton || expectedTon()) * (data()?.ton_usd_rate || 0)))}
										</span>
									</div>

									{/* Model High / Premium */}
									<div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 min-w-0">
										<span class="text-[9px] uppercase font-black text-emerald-400 block mb-1 truncate">
											{isRtl() ? 'سقف تقاضا (High)' : 'Model High'}
										</span>
										<span class="font-mono font-black text-white text-xs sm:text-sm block truncate" dir="ltr">
											{fmtTon(data()?.empirical_band?.model_high_ton || data()?.empirical_band?.p90_ton || Math.round(expectedTon() * 1.35))} <span class="text-[9px] text-[#0098EA]">TON</span>
										</span>
										<span class="text-[9px] text-white/40 font-mono block mt-0.5 truncate" dir="ltr">
											≈ ${fmtUsd(data()?.empirical_band?.model_high_usd || data()?.empirical_band?.p90_usd || Math.round((data()?.empirical_band?.p90_ton || expectedTon() * 1.35) * (data()?.ton_usd_rate || 0)))}
										</span>
									</div>
								</div>
							</div>

							{/* 📜 OFFICIAL DIGITAL APPRAISAL CERTIFICATE */}
							<div
								id="sec-certificate"
								class="scroll-mt-16 w-full bg-[#12141C]/90 backdrop-blur-2xl border border-amber-400/30 rounded-[28px] p-5 flex flex-col gap-3.5 shadow-[0_10px_30px_rgba(251,191,36,0.08)] relative overflow-hidden"
							>
								<div class="flex items-center justify-between border-b border-white/5 pb-3">
									<div class="flex items-center gap-2.5">
										<div class="w-9 h-9 rounded-[12px] bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
											<span class="material-symbols-outlined text-[20px]">verified_user</span>
										</div>
										<div class="flex flex-col text-start min-w-0">
											<span class="text-[13px] font-black text-white tracking-tight uppercase truncate">
												{t('valuation.certificate_title') || 'DIGITAL APPRAISAL CERTIFICATE'}
											</span>
											<span class="text-[10px] text-white/40 font-medium truncate">
												{t('valuation.certificate_issuer') ||
													'iFragment Market Intelligence Engine'}
											</span>
										</div>
									</div>
									<span
										class="text-[9px] font-mono font-bold bg-amber-400/10 border border-amber-400/30 text-amber-400 px-2 py-0.5 rounded-[6px] shrink-0"
										title="Official Certificate Serial"
									>
										{data()?.certificate_id || (data()?.run_id ? `IFRG-USR-${data()!.run_id.toString(16).toUpperCase()}` : 'IFRG-USR-CERT')}
									</span>
								</div>

								<div class="grid grid-cols-2 gap-2.5 text-start">
									<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-3 flex flex-col gap-0.5 min-w-0">
										<span class="text-[9px] font-black text-white/40 uppercase tracking-wider">
											{t('valuation.certifiedHandle')}
										</span>
										<span class="text-white font-mono font-black text-[13px] truncate" dir="ltr">
											@{data()?.username || username()}
										</span>
									</div>
									<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-3 flex flex-col gap-0.5 min-w-0">
										<span class="text-[9px] font-black text-white/40 uppercase tracking-wider">
											{t('valuation.verifiedFairValue')}
										</span>
										<span
											class="text-emerald-400 font-mono font-black text-[13px] truncate"
											dir="ltr"
										>
											{fmtTon(expectedTon())} {t('common.ton')}
										</span>
									</div>
								</div>

								{/* SHA-256 Digital Signature Seal */}
								<Show when={data()?.certificate_signature}>
									{(sig) => (
										<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-3 flex items-center justify-between gap-2 text-start">
											<div class="flex flex-col min-w-0">
												<span class="text-[9px] font-black text-white/40 uppercase tracking-wider flex items-center gap-1">
													<span class="material-symbols-outlined text-[13px] text-amber-400">fingerprint</span>
													<span>SHA-256 DIGITAL SIGNATURE</span>
												</span>
												<span class="text-amber-400/80 font-mono text-[10px] truncate" dir="ltr">
													{sig()}
												</span>
											</div>
											<button
												type="button"
												onClick={async () => {
													await copyToClipboard(sig());
													setCopiedSig(true);
													haptic.notify('success');
													setTimeout(() => setCopiedSig(false), 2000);
												}}
												class="p-1.5 rounded-[8px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors shrink-0"
												title="Copy Signature"
											>
												<span class="material-symbols-outlined text-[15px]">
													{copiedSig() ? 'check' : 'content_copy'}
												</span>
											</button>
										</div>
									)}
								</Show>

								<button
									type="button"
									onClick={handleCopyCertificate}
									class={`w-full h-11 rounded-[14px] font-black text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm border ${
										copiedCert()
											? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
											: 'bg-gradient-to-r from-amber-400/20 to-amber-500/20 border-amber-400/40 text-amber-300 hover:from-amber-400/30 hover:to-amber-500/30'
									}`}
								>
									<span class="material-symbols-outlined text-[17px]">
										{copiedCert() ? 'check' : 'content_copy'}
									</span>
									<span>
										{copiedCert()
											? 'COPIED!'
											: t('valuation.certificate_copy_link') || 'COPY CERTIFICATE LINK'}
									</span>
								</button>
							</div>

							{/* 🏢 PHASE 3: RENT YIELD CARD (GLOBAL UNIQUE FEATURE) */}
							<div class="w-full bg-gradient-to-br from-[#0098EA]/15 via-[#12141C]/90 to-[#08090D] border border-[#0098EA]/30 rounded-[28px] p-5 flex flex-col gap-3 shadow-[0_10px_30px_rgba(0,152,234,0.15)]">
								<div class="flex items-center justify-between border-b border-white/5 pb-3">
									<div class="flex items-center gap-2.5">
										<div class="w-9 h-9 rounded-[12px] bg-[#0098EA]/20 border border-[#0098EA]/40 flex items-center justify-center text-[#0098EA] shrink-0">
											<span class="material-symbols-outlined text-[20px]">real_estate_agent</span>
										</div>
										<div class="flex flex-col text-start">
											<h4 class="text-[13px] font-black text-white uppercase tracking-wider">
												{t('valuation.rent_yield_title') || 'ESTIMATED RENTAL YIELD'}
											</h4>
											<span class="text-[10px] text-white/40 font-medium">
												{t('valuation.rent_yield_desc') ||
													'Monthly passive earning potential via MarketApp'}
											</span>
										</div>
									</div>
									<span class="text-[10px] font-mono font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2.5 py-1 rounded-[8px]">
										{t('valuation.yield')}
									</span>
								</div>

								<div class="flex items-center justify-between bg-[#08090D] border border-white/5 rounded-[18px] p-4">
									<div class="flex flex-col text-start">
										<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">
											{t('valuation.projectedEarning')}
										</span>
										<span class="text-emerald-400 font-mono font-black text-[18px]">
											~{(expectedTon() * 0.045).toFixed(1)} {t('common.ton')} / month
										</span>
									</div>
									<div class="flex flex-col items-end">
										<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">
											{t('valuation.estApy')}
										</span>
										<span class="text-[#0098EA] font-mono font-black text-[16px]">~54.0%</span>
									</div>
								</div>
							</div>

							{/* 📊 PRICE RANGE & CONFIDENCE */}
							<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-5 shadow-sm">
								<div class="flex items-center justify-between gap-3 text-white/90 border-b border-white/5 pb-3">
									<div class="flex items-center gap-2 min-w-0">
										<span class="material-symbols-outlined text-[20px] text-white shrink-0">
											monitoring
										</span>
										<span class="text-[13px] font-black uppercase tracking-widest truncate">
											{t('valuation.price_range') || 'PRICE RANGE'}
										</span>
									</div>
									<button
										type="button"
										onClick={() => setShowMethodologyModal(true)}
										class="text-[10px] font-black text-[#0098EA] hover:underline uppercase tracking-widest flex items-center gap-1"
									>
										<span>{t('valuation.confidence_methodology') || 'Methodology'}</span>
										<span class="material-symbols-outlined text-[14px]">info</span>
									</button>
								</div>

								<div class="relative w-full h-4 bg-[#08090D] rounded-full overflow-hidden shadow-inner border border-white/5">
									<div class="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-white/10 via-white/50 to-white/10" />
									<div
										class="absolute top-0 bottom-0 w-1.5 bg-[#0098EA] shadow-[0_0_15px_#0098EA] rounded-full -translate-x-1/2 transition-[left] duration-500"
										style={{ left: `${bandPosition(expectedTon())}%` }}
									/>
								</div>

								<div class="flex justify-between items-end w-full -mt-1">
									<div class="flex flex-col text-start">
										<span class="text-white/40 text-[9px] uppercase font-black tracking-widest mb-1">
											{t('valuation.floor') || 'LOW'}
										</span>
										<span class="text-white/70 font-mono font-black text-[13px]">
											{fmtTon(lowTon())}
										</span>
									</div>
									<div class="flex flex-col text-center">
										<span class="text-[#0098EA] text-[9px] uppercase font-black tracking-widest mb-1">
											{t('valuation.expected_label') || 'EXPECTED'}
										</span>
										<span class="text-white font-mono font-black text-[17px]">
											{fmtTon(expectedTon())}
										</span>
									</div>
									<div class="flex flex-col text-end">
										<span class="text-white/40 text-[9px] uppercase font-black tracking-widest mb-1">
											{t('valuation.ceiling') || 'HIGH'}
										</span>
										<span class="text-white/70 font-mono font-black text-[13px]">
											{fmtTon(highTon())}
										</span>
									</div>
								</div>

								<div class="flex flex-col gap-2 bg-[#08090D] border border-white/5 rounded-[18px] p-4 shadow-inner">
									<div class="flex items-center justify-between gap-2">
										<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">
											{t('valuation.confidence') || 'CONFIDENCE'}
										</span>
										<span
											class="text-[10px] font-black uppercase tracking-widest"
											style={{ color: confidenceTheme().color }}
										>
											{confidenceTheme().label} · {data()?.confidence_score ?? 0}%
										</span>
									</div>
									<div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
										<div
											class="h-full rounded-full transition-[width] duration-700"
											style={{
												width: `${data()?.confidence_score ?? 0}%`,
												background: confidenceTheme().color,
												'box-shadow': `0 0 12px ${confidenceTheme().color}`,
											}}
										/>
									</div>
								</div>
							</div>

							{/* ⚖️ ACTIONABLE RECOMMENDATIONS PLAYBOOK */}
							<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
								<div class="flex items-center justify-between border-b border-white/5 pb-3">
									<div class="flex items-center gap-2 min-w-0">
										<span class="material-symbols-outlined text-[20px] text-amber-400">gavel</span>
										<h4 class="text-[13px] font-black uppercase tracking-widest text-white truncate">
											{t('valuation.actionable_advice_title') || 'ACTIONABLE PLAYBOOK'}
										</h4>
									</div>
									<span class="text-[10px] font-mono font-black text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2.5 py-1 rounded-[8px]">
										{t('valuation.scenarios')}
									</span>
								</div>

								<div class="grid grid-cols-2 gap-3">
									<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-1">
										<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">
											{t('valuation.action_buy') || 'FAIR BUY TARGET'}
										</span>
										<span class="text-emerald-400 font-mono font-black text-[15px]">
											{fmtTon(Math.round(expectedTon() * 0.88))} TON
										</span>
										<span class="text-white/30 text-[9px]">{t('valuation.valueEntryPoint')}</span>
									</div>

									<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-1">
										<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">
											{t('valuation.action_auction_start') || 'SUGGESTED AUCTION START'}
										</span>
										<span class="text-amber-400 font-mono font-black text-[15px]">
											{fmtTon(Math.round(expectedTon() * 0.7))} TON
										</span>
										<span class="text-white/30 text-[9px]">{t('valuation.maxBidCompetition')}</span>
									</div>

									<div class="col-span-2 bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex items-center justify-between">
										<div class="flex flex-col text-start">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">
												{t('valuation.net_proceeds_after_fee') ||
													'NET PROCEEDS (AFTER 5% FRAGMENT FEE)'}
											</span>
											<span class="text-white font-mono font-black text-[14px]">
												{fmtTon(Math.round(expectedTon() * 0.95))} TON (≈ $
												{fmtUsd(parseFloat(data()?.expected_usd || '0') * 0.95)})
											</span>
										</div>
										<span class="text-amber-400 text-[11px] font-bold bg-amber-400/10 px-2 py-1 rounded-[6px] border border-amber-400/20">
											-5.0%
										</span>
									</div>
								</div>
							</div>

							{/* 🌟 1. LINGUISTIC MEANING, DICTIONARY & WIKIPEDIA */}
							<div
								id="sec-linguistics"
								class="scroll-mt-16 w-full bg-gradient-to-br from-[#0098EA]/15 via-[#12141C]/90 to-[#08090D] backdrop-blur-2xl border border-[#0098EA]/30 rounded-[28px] p-6 flex flex-col gap-3.5 shadow-[0_10px_30px_rgba(0,152,234,0.15)] relative overflow-hidden"
							>
								<div class="absolute -right-8 -top-8 w-32 h-32 bg-[#0098EA]/10 blur-3xl rounded-full pointer-events-none" />

								<div class="flex items-center justify-between text-white/90 relative z-10 border-b border-[#0098EA]/20 pb-3">
									<div class="flex items-center gap-2.5">
										<span class="material-symbols-outlined text-[22px] text-[#0098EA]">
											translate
										</span>
										<span class="text-[13px] font-black uppercase tracking-widest text-[#0098EA]">
											{t('valuation.ling_meaning_title') || 'MEANING & IDENTITY'}
										</span>
									</div>
									<span
										class={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[8px] border shadow-sm ${
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

								<div class="relative z-10 flex flex-col gap-2.5">
									<Show
										when={data()?.dictionary?.is_word && data()?.dictionary?.definition}
										fallback={
											<Show when={!data()?.dictionary?.is_word && !data()?.wikipedia_summary}>
												<div class="bg-[#08090D]/60 rounded-[18px] p-3.5 border border-white/5 text-white/40 text-[12px] font-medium text-start">
													{t('valuation.not_dict_word_desc') ||
														'Non-dictionary alphanumeric handle without recorded lexical definitions.'}
												</div>
											</Show>
										}
									>
										<div class="bg-[#08090D]/80 rounded-[18px] p-4 border border-[#0098EA]/20 text-white/90 text-[13px] leading-relaxed font-medium italic border-l-[4px] border-l-[#0098EA] shadow-inner text-start flex flex-col gap-1">
											<Show when={data()?.dictionary?.part_of_speech}>
												<span class="text-[10px] text-[#0098EA] font-mono font-bold uppercase not-italic">
													[{data()?.dictionary?.part_of_speech}]
												</span>
											</Show>
											<span>"{data()?.dictionary?.definition}"</span>
										</div>
									</Show>

									<Show when={data()?.wikipedia_summary}>
										<div class="bg-[#08090D]/80 rounded-[18px] p-4 border border-white/5 flex flex-col gap-2 shadow-inner text-start">
											<span class="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
												<span class="material-symbols-outlined text-[16px] text-amber-400">
													menu_book
												</span>
												{t('valuation.wiki_summary_title') || 'WIKIPEDIA & KNOWLEDGE BASE'}
											</span>
											<p class="text-[12px] font-medium text-white/70 leading-relaxed">
												{data()?.wikipedia_summary}
											</p>
										</div>
									</Show>
								</div>
							</div>

							{/* 🧬 2. USERNAME STRUCTURAL ANATOMY */}
							<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
								<div class="flex items-center justify-between text-white/90 border-b border-white/5 pb-3">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-[20px] text-[#0098EA]">dna</span>
										<span class="text-[13px] font-black uppercase tracking-widest truncate">
											{t('valuation.anatomy_title') || 'STRUCTURAL ANATOMY'}
										</span>
									</div>
									<span class="text-[10px] font-mono font-black text-white/40 bg-white/5 border border-white/10 px-2.5 py-1 rounded-[8px]">
										{data()?.length || username().length} {t('valuation.chars_suffix') || 'CHARS'}
									</span>
								</div>

								<div class="grid grid-cols-2 gap-3 text-start">
									<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex items-center justify-between">
										<div class="flex flex-col min-w-0">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest truncate">
												{t('valuation.letters_only') || 'LETTERS ONLY'}
											</span>
											<span class="text-[12px] font-bold text-white mt-0.5 truncate">
												{data()?.structure?.letters_only
													? t('valuation.anatomy_pure') || 'Pure Alphabetic'
													: t('valuation.no') || 'Mixed'}
											</span>
										</div>
										<span
											class={`material-symbols-outlined text-[20px] shrink-0 ${
												data()?.structure?.letters_only ? 'text-[#10b981]' : 'text-white/30'
											}`}
										>
											{data()?.structure?.letters_only ? 'check_circle' : 'remove_circle_outline'}
										</span>
									</div>

									<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex items-center justify-between">
										<div class="flex flex-col min-w-0">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest truncate">
												{t('valuation.has_digits') || 'NUMBERS'}
											</span>
											<span class="text-[12px] font-bold text-white mt-0.5 truncate">
												{data()?.structure?.has_digits
													? t('valuation.anatomy_contains') || 'Contains Digits'
													: t('valuation.anatomy_none') || 'None'}
											</span>
										</div>
										<span
											class={`material-symbols-outlined text-[20px] shrink-0 ${
												data()?.structure?.has_digits ? 'text-amber-400' : 'text-[#10b981]'
											}`}
										>
											{data()?.structure?.has_digits ? 'pin' : 'check_circle'}
										</span>
									</div>

									<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex items-center justify-between">
										<div class="flex flex-col min-w-0">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest truncate">
												{t('valuation.has_underscore') || 'UNDERSCORE (_)'}
											</span>
											<span class="text-[12px] font-bold text-white mt-0.5 truncate">
												{data()?.structure?.has_underscore
													? t('valuation.anatomy_yes') || 'Contains (_)'
													: t('valuation.anatomy_clean') || 'Clean (No _)'}
											</span>
										</div>
										<span
											class={`material-symbols-outlined text-[20px] shrink-0 ${
												data()?.structure?.has_underscore ? 'text-amber-400' : 'text-[#10b981]'
											}`}
										>
											{data()?.structure?.has_underscore ? 'horizontal_rule' : 'check_circle'}
										</span>
									</div>

									<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex items-center justify-between">
										<div class="flex flex-col min-w-0">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest truncate">
												{t('valuation.len_title') || 'LENGTH TIER'}
											</span>
											<span class="text-[12px] font-bold text-white mt-0.5 truncate">
												{(data()?.length || username().length) <= 4
													? t('valuation.len_ultra_short') || 'Ultra Short'
													: (data()?.length || username().length) <= 6
														? t('valuation.len_short') || 'Short'
														: t('valuation.len_standard') || 'Standard'}
											</span>
										</div>
										<span class="material-symbols-outlined text-[20px] text-[#0098EA] shrink-0">
											straighten
										</span>
									</div>
								</div>
							</div>

							{/* 🕮 3. HISTORY & OWNERSHIP */}
							<div
								id="sec-ownership"
								class="scroll-mt-16 w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm"
							>
								<div class="flex items-center justify-between text-white/90 border-b border-white/5 pb-3">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-[20px] text-white">history</span>
										<span class="text-[13px] font-black uppercase tracking-widest">
											{t('valuation.history_title') || 'OWNERSHIP HISTORY'}
										</span>
									</div>
									<Show when={data()?.history?.highest_past_sale_ton}>
										<span class="text-[10px] font-mono font-black text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2.5 py-1 rounded-[8px]">
											MAX: {fmtTon(data()?.history?.highest_past_sale_ton)} TON
										</span>
									</Show>
								</div>

								{/* Owner Address Box */}
								<Show when={data()?.history?.owner_address}>
									<div class="flex items-center justify-between bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 text-start gap-2">
										<div class="flex flex-col min-w-0">
											<span class="text-[9px] font-black text-white/40 uppercase tracking-wider">
												{t('valuation.owner') || 'Current Owner Wallet:'}
											</span>
											<span class="text-white font-mono font-black text-[12px] truncate" dir="ltr">
												{data()?.history?.owner_address}
											</span>
										</div>
										<button
											type="button"
											onClick={() => handleCopyWallet(data()?.history?.owner_address || '')}
											class="p-2 rounded-[10px] bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors shrink-0"
											title="Copy Address"
										>
											<span class="material-symbols-outlined text-[16px]">
												{copiedWallet() ? 'check' : 'content_copy'}
											</span>
										</button>
									</div>
								</Show>

								<Show
									when={
										data()?.history?.is_sold || (data()?.history?.transactions?.length ?? 0) > 0
									}
									fallback={
										<div class="flex items-center gap-3 bg-[#08090D] border border-[#10b981]/20 rounded-[18px] p-4 text-start">
											<div class="w-8 h-8 rounded-[10px] bg-[#10b981]/20 flex items-center justify-center shrink-0">
												<span class="material-symbols-outlined text-[#10b981] text-[18px]">
													verified
												</span>
											</div>
											<span class="text-[#10b981] text-[12px] font-black uppercase tracking-wider">
												{t('valuation.not_sold') || 'Status: Never sold on Fragment!'}
											</span>
										</div>
									}
								>
									<div class="flex flex-col rounded-[16px] overflow-hidden bg-[#08090D] border border-white/5 shadow-inner">
										<div class="grid grid-cols-3 p-3.5 bg-white/[0.03] text-[10px] font-black text-white/30 uppercase tracking-widest border-b border-white/5">
											<span class="text-start">{t('valuation.sale_price') || 'PRICE'}</span>
											<span class="text-center">{t('valuation.date') || 'DATE'}</span>
											<span class="text-end">{t('valuation.buyer') || 'BUYER'}</span>
										</div>
										<Show
											when={(data()?.history?.transactions?.length ?? 0) > 0}
											fallback={
												<div class="p-6 text-center text-white/30 text-[12px] font-bold uppercase tracking-widest">
													{t('valuation.no_transaction_data') || 'No transaction data'}
												</div>
											}
										>
											<For each={data()?.history?.transactions}>
												{(tx, idx) => (
													<div
														class={`grid grid-cols-3 p-3.5 items-center text-[13px] hover:bg-white/[0.02] transition-colors ${
															idx() !== (data()?.history?.transactions?.length || 0) - 1
																? 'border-b border-white/5'
																: ''
														}`}
													>
														<span class="text-emerald-400 font-mono font-black text-start">
															{tx.sale_price_ton} TON
														</span>
														<span class="text-white/40 text-[11px] font-mono font-bold text-center">
															{new Date(tx.date).toLocaleDateString('en-GB', {
																day: 'numeric',
																month: 'short',
																year: '2-digit',
															})}
														</span>
														<span
															class="text-white font-mono font-bold text-[12px] truncate text-end"
															dir="ltr"
														>
															{tx.buyer
																? `${tx.buyer.slice(0, 4)}...${tx.buyer.slice(-3)}`
																: 'Fragment'}
														</span>
													</div>
												)}
											</For>
										</Show>
									</div>
								</Show>
							</div>

							{/* 🐋 4. HOLDER PORTFOLIO & WHALE PROFILE */}
							<Show when={hasPortfolio() || ownerProfile()}>
								<div class="w-full bg-gradient-to-br from-amber-500/10 via-[#12141C]/90 to-[#08090D] backdrop-blur-2xl border border-amber-500/30 rounded-[28px] p-6 flex flex-col gap-4 shadow-[0_10px_30px_rgba(245,158,11,0.12)] relative overflow-hidden">
									<div class="absolute -right-8 -top-8 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

									<div class="flex items-center justify-between text-white/90 relative z-10 border-b border-white/5 pb-3">
										<div class="flex items-center gap-2.5 min-w-0">
											<div class="w-8 h-8 rounded-[10px] bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
												<span class="material-symbols-outlined text-[18px]">
													account_balance_wallet
												</span>
											</div>
											<div class="flex flex-col text-start min-w-0">
												<span class="text-[13px] font-black uppercase tracking-widest text-white truncate">
													{t('valuation.whale_portfolio_title') || 'HOLDER PORTFOLIO'}
												</span>
												<span class="text-[10px] text-white/40 font-medium truncate">
													{t('valuation.whale_portfolio_subtitle') || 'ON-CHAIN ASSET DISTRIBUTION'}
												</span>
											</div>
										</div>
										<Show when={hasPortfolio()}>
											<span
												class={`text-[10px] font-black px-2.5 py-1 rounded-[8px] border shadow-sm shrink-0 whitespace-nowrap ${
													data()?.wallet_info?.is_whale
														? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
														: 'bg-[#0098EA]/15 border-[#0098EA]/30 text-[#0098EA]'
												}`}
											>
												{data()?.wallet_info?.is_whale ? '🐋 WHALE HOLDER' : '👤 COLLECTOR'}
											</span>
										</Show>
									</div>

									{/* Owner Profile Badge — when MTProto resolved a real Telegram identity */}
									<Show when={ownerProfile()}>
										<div class="flex items-center justify-between gap-3 bg-[#08090D]/90 border border-white/10 rounded-[18px] p-3.5 relative z-10 shadow-inner">
											<div class="flex items-center gap-3 min-w-0">
												<div class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0098EA] to-[#00f0ff] flex items-center justify-center text-white font-black text-[14px] shadow-sm shrink-0">
													{(
														ownerProfile()?.first_name?.[0] ||
														ownerProfile()?.username?.[0] ||
														'?'
													).toUpperCase()}
												</div>
												<div class="flex flex-col text-start min-w-0">
													<div class="flex items-center gap-1.5 min-w-0">
														<span class="text-white font-bold text-[13px] truncate">
															{[ownerProfile()?.first_name, ownerProfile()?.last_name]
																.filter(Boolean)
																.join(' ')}
														</span>
														<Show when={ownerProfile()?.is_premium}>
															<span class="material-symbols-outlined text-amber-400 text-[14px] shrink-0">
																star
															</span>
														</Show>
													</div>
													<Show when={ownerProfile()?.username}>
														<span
															class="text-white/40 text-[11px] font-mono font-semibold truncate"
															dir="ltr"
														>
															@{ownerProfile()?.username}
														</span>
													</Show>
												</div>
											</div>
											<span class="text-[10px] font-black text-[#0098EA] bg-[#0098EA]/10 border border-[#0098EA]/30 px-2.5 py-1 rounded-[8px] shrink-0 uppercase">
												{ownerProfile()?.peer_type || 'account'}
											</span>
										</div>
									</Show>

									<Show
										when={hasPortfolio()}
										fallback={
											<div class="flex items-center gap-3 bg-[#08090D] border border-white/5 rounded-[18px] p-4 relative z-10 shadow-inner text-start">
												<span class="material-symbols-outlined text-white/25 text-[20px] shrink-0">
													search_off
												</span>
												<div class="flex flex-col text-start min-w-0">
													<span class="text-white/60 text-[12px] font-bold">
														{t('valuation.portfolio_empty_title') || 'No public holdings found'}
													</span>
													<span class="text-white/30 text-[11px] font-medium">
														{t('valuation.portfolio_empty_desc') ||
															'This wallet has no other verifiable collectibles on-chain.'}
													</span>
												</div>
											</div>
										}
									>
										{/* Wallet summary */}
										<div class="grid grid-cols-2 gap-3 relative z-10 text-start">
											<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-0.5 shadow-inner min-w-0">
												<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">
													{t('valuation.holder_wallet') || 'HOLDER WALLET'}
												</span>
												<span
													class="text-amber-400 font-mono font-black text-[12px] truncate"
													dir="ltr"
												>
													{data()?.portfolio?.owner_address
														? `${data()!.portfolio!.owner_address.slice(0, 6)}...${data()!.portfolio!.owner_address.slice(-4)}`
														: '—'}
												</span>
											</div>
											<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-0.5 shadow-inner min-w-0">
												<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">
													{t('valuation.total_nfts') || 'TOTAL ASSETS'}
												</span>
												<span class="text-white font-mono font-black text-[14px] truncate">
													{data()?.wallet_info?.nft_count ||
														data()?.portfolio?.total_count ||
														data()?.portfolio?.items?.length ||
														0}{' '}
													{t('valuation.items_suffix') || 'items'}
												</span>
											</div>
											<Show when={(data()?.portfolio?.total_est_value_ton ?? 0) > 0}>
												<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-0.5 shadow-inner min-w-0">
													<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">
														{t('valuation.portfolio_est_val') || 'EST. PORTFOLIO VALUE'}
													</span>
													<span class="text-emerald-400 font-mono font-black text-[14px] truncate">
														{fmtTon(data()?.portfolio?.total_est_value_ton)} TON
													</span>
												</div>
											</Show>
											<Show when={(data()?.portfolio?.total_acquisition_cost_ton ?? 0) > 0}>
												<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-0.5 shadow-inner min-w-0">
													<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">
														{t('valuation.portfolio_spent_total') || 'TOTAL ACQUISITION COST'}
													</span>
													<span class="text-white font-mono font-black text-[14px] truncate">
														{fmtTon(data()?.portfolio?.total_acquisition_cost_ton)} TON
													</span>
												</div>
											</Show>
										</div>

										{/* Portfolio Collectibles List */}
										<div class="flex flex-col gap-2 relative z-10 pt-1 text-start">
											<div class="flex items-center justify-between gap-2 px-1">
												<span class="text-white/50 text-[10px] font-black uppercase tracking-widest truncate">
													{t('valuation.other_collectibles') || 'OTHER ASSETS IN SAME WALLET'}
												</span>
												<span class="text-[#0098EA] text-[10px] font-mono font-bold shrink-0">
													{data()?.portfolio?.items?.length} ITEMS
												</span>
											</div>

											<div class="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
												<For each={data()?.portfolio?.items}>
													{(item) => {
														const badge = portfolioBadge(item.status);
														return (
															<div
																onClick={() => openReport(item.username)}
																class="flex items-center justify-between gap-2 bg-[#08090D] hover:bg-white/[0.04] border border-white/5 rounded-[14px] p-3 cursor-pointer transition-all active:scale-[0.98]"
															>
																<div class="flex items-center gap-2 min-w-0">
																	<span class="text-white/30 text-[12px] font-mono shrink-0">
																		✦
																	</span>
																	<span
																		class="text-white font-mono font-black text-[13px] truncate"
																		dir="ltr"
																	>
																		@{item.username}
																	</span>
																</div>
																<div class="flex items-center gap-2 shrink-0">
																	<Show
																		when={(item.last_sale_ton ?? 0) > 0}
																		fallback={
																			<span class="text-white/25 text-[10px] font-medium whitespace-nowrap">
																				{t('valuation.portfolio_unpriced') || 'no public price'}
																			</span>
																		}
																	>
																		<span class="text-amber-400 font-mono font-black text-[11px] whitespace-nowrap">
																			{fmtTon(item.last_sale_ton)} TON
																		</span>
																	</Show>
																	<span
																		class={`text-[9px] font-black px-2 py-0.5 rounded-[6px] border whitespace-nowrap ${badge.class}`}
																	>
																		{badge.label}
																	</span>
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

							{/* 🔥 5. SEMANTIC SIMILAR USERNAMES & BRAND EQUIVALENTS */}
							<Show when={(data()?.similar?.length ?? 0) > 0}>
								<div
									id="sec-market"
									class="scroll-mt-16 w-full bg-[#12141C]/90 backdrop-blur-2xl border border-[#0098EA]/30 rounded-[28px] p-6 flex flex-col gap-4 shadow-[0_10px_30px_rgba(0,152,234,0.15)] relative overflow-hidden"
								>
									<div class="absolute -right-8 -bottom-8 w-28 h-28 bg-[#0098EA]/10 blur-3xl rounded-full pointer-events-none" />

									<div class="flex items-center justify-between text-white/90 relative z-10 border-b border-white/5 pb-3">
										<div class="flex items-center gap-2.5">
											<span class="material-symbols-outlined text-[22px] text-[#0098EA]">hub</span>
											<span class="text-[13px] font-black uppercase tracking-widest text-white">
												{t('valuation.concept_similar_title') || 'موارد مشابه'}
											</span>
										</div>
										<span class="text-[10px] font-black text-[#0098EA] bg-[#0098EA]/10 border border-[#0098EA]/30 px-2.5 py-1 rounded-[8px] shadow-sm">
											{t('valuation.ai_matched') || 'AI MATCHED'}
										</span>
									</div>

									{/* Category Filter Tabs */}
									<div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono no-scrollbar relative z-10">
										<button
											type="button"
											onClick={() => setSimilarFilter('all')}
											class={`px-3 py-1 rounded-full border transition-all ${
												similarFilter() === 'all'
													? 'bg-[#0098EA]/20 border-[#0098EA]/50 text-[#0098EA] font-bold shadow-sm'
													: 'bg-white/5 border-white/10 text-white/50 hover:text-white'
											}`}
										>
											{isRtl() ? 'همه' : 'All'}
										</button>
										<button
											type="button"
											onClick={() => setSimilarFilter('word')}
											class={`px-3 py-1 rounded-full border transition-all ${
												similarFilter() === 'word'
													? 'bg-[#0098EA]/20 border-[#0098EA]/50 text-[#0098EA] font-bold shadow-sm'
													: 'bg-white/5 border-white/10 text-white/50 hover:text-white'
											}`}
										>
											{isRtl() ? 'معنایی / لغوی' : 'Semantic'}
										</button>
										<button
											type="button"
											onClick={() => setSimilarFilter('structure')}
											class={`px-3 py-1 rounded-full border transition-all ${
												similarFilter() === 'structure'
													? 'bg-[#0098EA]/20 border-[#0098EA]/50 text-[#0098EA] font-bold shadow-sm'
													: 'bg-white/5 border-white/10 text-white/50 hover:text-white'
											}`}
										>
											{isRtl() ? 'ساختاری / هم‌طول' : 'Structural'}
										</button>
										<button
											type="button"
											onClick={() => setSimilarFilter('price')}
											class={`px-3 py-1 rounded-full border transition-all ${
												similarFilter() === 'price'
													? 'bg-[#0098EA]/20 border-[#0098EA]/50 text-[#0098EA] font-bold shadow-sm'
													: 'bg-white/5 border-white/10 text-white/50 hover:text-white'
											}`}
										>
											{isRtl() ? 'دارای معامله' : 'With Sales'}
										</button>
									</div>

									<div class="flex flex-col gap-2.5 relative z-10 text-start">
										<For each={(() => {
											const list = data()?.similar || [];
											const f = similarFilter();
											if (f === 'word') {
												const filtered = list.filter((i) => (i.reason || '').toLowerCase().includes('word') || (i.reason || '').toLowerCase().includes('dictionary') || (i.reason || '').toLowerCase().includes('semantic') || (i.reason || '').toLowerCase().includes('brand'));
												return filtered.length > 0 ? filtered : list;
											}
											if (f === 'structure') {
												const filtered = list.filter((i) => (i.reason || '').toLowerCase().includes('char') || (i.reason || '').toLowerCase().includes('length') || (i.reason || '').toLowerCase().includes('structure') || (i.reason || '').toLowerCase().includes('pattern'));
												return filtered.length > 0 ? filtered : list;
											}
											if (f === 'price') {
												const filtered = list.filter((i) => (i.sale_price ?? 0) > 0);
												return filtered.length > 0 ? filtered : list;
											}
											return list;
										})()}>
											{(item) => {
												const badge = similarBadge(item);
												const hasPrice = (item.sale_price ?? 0) > 0;

												return (
													<div
														onClick={() => openReport(item.username)}
														class="flex items-center justify-between gap-3 bg-[#08090D] hover:bg-white/[0.04] p-3.5 rounded-[18px] border border-white/5 hover:border-[#0098EA]/30 transition-all cursor-pointer shadow-inner group"
													>
														<div class="flex flex-col gap-1 min-w-0 flex-1">
															<div class="flex items-center gap-2 min-w-0">
																<span
																	class="text-[#0098EA] font-black text-[14px] group-hover:underline truncate"
																	dir="ltr"
																>
																	@{item.username}
																</span>
																<span
																	class={`text-[9px] font-black uppercase px-2 py-0.5 rounded-[6px] border shrink-0 whitespace-nowrap ${badge.class}`}
																>
																	{badge.label}
																</span>
															</div>
															<span class="text-white/40 text-[11px] font-medium truncate">
																{item.reason}
															</span>
														</div>

														<div class="flex flex-col items-end shrink-0">
															<Show
																when={hasPrice}
																fallback={
																	<span class="text-white/25 text-[11px] font-medium whitespace-nowrap">
																		{t('valuation.no_sale_price') || 'No Sale Record'}
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
							</Show>

							{/* 📈 COMPARABLE REAL SALES */}
							<Show when={(data()?.comparables?.length ?? 0) > 0}>
								<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
									<div class="flex items-center justify-between border-b border-white/5 pb-3">
										<div class="flex items-center gap-2">
											<span class="material-symbols-outlined text-[20px] text-white">
												receipt_long
											</span>
											<span class="text-[13px] font-black uppercase tracking-widest">
												{t('valuation.comparables_title') || 'COMPARABLE ON-CHAIN SALES'}
											</span>
										</div>
										<span class="text-[10px] font-mono font-black text-white/40 bg-white/5 border border-white/10 px-2.5 py-1 rounded-[8px]">
											{data()?.comparables?.length} COMPS
										</span>
									</div>

									<div class="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
										<For each={data()?.comparables?.slice(0, 10)}>
											{(comp) => (
												<div class="flex items-center justify-between gap-2 bg-[#08090D] hover:bg-white/[0.04] border border-white/5 rounded-[14px] px-3.5 py-3 transition-all text-start">
													<button
														type="button"
														onClick={() => openReport(comp.username)}
														class="text-white font-mono font-black text-[12px] hover:underline truncate"
														dir="ltr"
													>
														@{comp.username}
													</button>
													<div class="flex items-center gap-2.5 shrink-0">
														<span class="text-emerald-400 font-mono font-black text-[12px]">
															{fmtTon(comp.price)} TON
														</span>
														<a
															href={
																comp.tonviewer_url ||
																`https://tonviewer.com/nft/${comp.username.replace('@', '')}`
															}
															target="_blank"
															rel="noreferrer"
															onClick={(e) => e.stopPropagation()}
															class="text-[#0098EA] hover:text-[#00c0ff] text-[10px] font-mono font-bold bg-[#0098EA]/10 border border-[#0098EA]/30 px-1.5 py-0.5 rounded-[5px]"
														>
															{'tx ↗'}
														</a>
													</div>
												</div>
											)}
										</For>
									</div>
								</div>
							</Show>

							{/* Social Sharing Actions */}
							<div class="w-full flex gap-3 mt-2">
								<button
									type="button"
									onClick={handleShareToStory}
									disabled={sharing()}
									class="flex-1 h-13 bg-[#0098EA] hover:bg-[#0086cf] text-white font-black text-[12px] uppercase tracking-wider rounded-[18px] flex items-center justify-center gap-2 shadow-[0_8px_25px_rgba(0,152,234,0.3)] active:scale-95 transition-all"
								>
									<span class="material-symbols-outlined text-[18px]">auto_awesome</span>
									<span>{sharing() ? 'Preparing...' : t('valuation.share') || 'Share Story'}</span>
								</button>
								<button
									type="button"
									onClick={handleSendToChat}
									disabled={downloading() || sent()}
									class="h-13 px-5 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-black text-[12px] uppercase rounded-[18px] flex items-center justify-center gap-2 active:scale-95 transition-all"
								>
									<span class="material-symbols-outlined text-[18px]">
										{sent() ? 'check' : 'send'}
									</span>
									<span>{sent() ? 'Sent' : 'Chat'}</span>
								</button>
							</div>

							{/* Audit Footer */}
							<div class="w-full flex flex-col items-center gap-1 pt-4 opacity-40 text-center">
								<span class="text-white/50 text-[9px] font-mono">
									{t('valuation.data_freshness_stamp', {
										date: new Date().toLocaleDateString('en-GB'),
									}) || `Data audited as of ${new Date().toLocaleDateString('en-GB')}`}
								</span>
								<span class="text-white/30 text-[9px] font-mono">
									1 TON ≈ ${data()?.ton_usd_rate?.toFixed(2) || '5.50'} USD
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
										{t('valuation.confidence_methodology') || 'Methodology'}
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
										'Calculated using real on-chain transaction density, dictionary frequency, active liquidity, and historical sale comp recency.'}
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

					{/* ═══════ HIDDEN EXPORT CARD ═══════ */}
					<div class="fixed left-[-9999px] top-[-9999px] pointer-events-none">
						<div
							ref={hiddenCardRef}
							class={`w-[400px] h-[400px] p-[3px] bg-gradient-to-br ${
								getTierTheme(data()?.rarity?.tier || '').wrapper
							} rounded-[40px] flex flex-col overflow-hidden`}
						>
							<div class="w-full h-full bg-[#08090D] rounded-[37px] p-7 flex flex-col justify-between relative overflow-hidden">
								<div class="flex justify-between items-center z-10">
									<span
										class={`px-3 py-1.5 border rounded-[10px] text-[9px] font-black tracking-widest uppercase shadow-sm ${
											getTierTheme(data()?.rarity?.tier || '').badge
										}`}
									>
										{data()?.rarity?.tier || 'STANDARD'}
									</span>
									<span class="text-[10px] font-mono font-black text-white/30 tracking-[4px] uppercase bg-white/5 border border-white/5 px-3 py-1 rounded-[10px]">
										{'IFRAGMENT'}
									</span>
								</div>

								<div class="flex flex-col justify-center items-center z-10 text-center flex-grow py-4 w-full">
									<span
										class="inline-block font-black tracking-tighter text-white truncate max-w-[80%]"
										style={{ 'font-size': getFontSize(data()?.username || username()) }}
										dir="ltr"
									>
										@{data()?.username || username()}
									</span>
								</div>

								<div class="flex justify-between items-end border-t border-white/10 pt-4 z-10">
									<div class="flex flex-col gap-0.5 text-left">
										<span class="text-[9px] font-black text-white/40 uppercase tracking-widest">
											{t('valuation.estimatedValue')}
										</span>
										<div class="flex items-center gap-2">
											<span class="text-[28px] font-black text-white leading-none tracking-tight">
												{fmtTon(expectedTon())}
											</span>
											<span class="text-[13px] font-black text-[#0098EA] mb-0.5">
												{t('common.ton')}
											</span>
										</div>
									</div>
									<span class="text-[13px] text-white/60 font-black leading-none font-mono">
										≈ ${fmtUsd(parseFloat(data()?.expected_usd || '0'))}
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
