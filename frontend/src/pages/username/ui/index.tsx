import { useNavigate, useSearchParams } from '@solidjs/router';
import { backButton, openTelegramLink } from '@tma.js/sdk-solid';
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
import { balance } from '@/entities/airdrop/index.js';
import { valuationApi } from '@/entities/username/index.js';
import { apiFetch } from '@/shared/api/base.js';
import { ECONOMY_CONFIG } from '@/shared/config/economy.js';
import { formatNumber, isRtl, t } from '@/shared/i18n/index.js';
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
import { creditsApi } from '@/entities/intel/api/creditsApi.js';
import { SearchTeaser, UnifiedPaywallGate } from '@/widgets/paywall/index.js';

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
	brandability: number;
	fear_greed_index: number;
	fear_greed_label: string;
	wikipedia_summary: string;
	rarity_breakdown: Record<string, number>;
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
	const [accessMethod, setAccessMethod] = createSignal<
		'free' | 'stars' | 'coins' | 'pro' | 'credit' | null
	>(null);
	const [isPro, setIsPro] = createSignal<boolean>(false);
	const [dailyUsed, setDailyUsed] = createSignal<number>(0);
	const [copiedCert, setCopiedCert] = createSignal<boolean>(false);
	const [_showPaymentGate, setShowPaymentGate] = createSignal<boolean>(false);
	const [freeQuotaUsed, setFreeQuotaUsed] = createSignal<boolean>(false);
	const [firstReportDiscountEligible, setFirstReportDiscountEligible] = createSignal<boolean>(true);
	const [inChannel, setInChannel] = createSignal<boolean>(false);
	const [inGroup, setInGroup] = createSignal<boolean>(false);
	const [isProcessingPayment, setIsProcessingPayment] = createSignal<boolean>(false);
	const [paymentPending, setPaymentPending] = createSignal<boolean>(false);
	const [pollingStatus, setPollingStatus] = createSignal<string>('');
	const [paymentError, setPaymentError] = createSignal<string>('');
	const [lastOrderPayload, setLastOrderPayload] = createSignal<string>('');
	const [activeStarsPack, setActiveStarsPack] = createSignal<string>('pack_starter_3');
	const [showMethodologyModal, setShowMethodologyModal] = createSignal<boolean>(false);
	const [isMonitored, setIsMonitored] = createSignal<boolean>(false);
	const [isTogglingMonitor, setIsTogglingMonitor] = createSignal<boolean>(false);

	// Cached-report state: a paid report stays readable for 24h
	const [_fromCache, setFromCache] = createSignal<boolean>(false);
	const [_cacheExpiry, setCacheExpiry] = createSignal<number | null>(null);
	const [_recents, setRecents] = createSignal<RecentReport[]>([]);
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

	const handlePayStars = async (packId?: string) => {
		const u = username();
		if (!u || isProcessingPayment() || paymentPending()) return;
		setIsProcessingPayment(true);
		setPaymentError('');
		const chosenPack = packId || activeStarsPack();
		try {
			const res = await valuationApi.createStarsInvoice(u, chosenPack);
			if (res?.payload) setLastOrderPayload(res.payload);
			if (res?.invoice_link) {
				const tg = (window as any).Telegram?.WebApp;
				if (tg?.openInvoice) {
					tg.openInvoice(res.invoice_link, (status: string) => {
						if (status === 'paid') {
							pollPaymentAccess(u, res.payload);
						} else if (status === 'cancelled') {
							setPaymentError(t('valuation.payment_cancelled') || 'Payment was cancelled.');
							haptic.impact('light');
						} else if (status === 'failed') {
							setPaymentError(t('valuation.payment_failed') || 'Payment failed. Please try again.');
							haptic.notify('error');
						} else if (status === 'pending') {
							pollPaymentAccess(u, res.payload);
						}
					});
				} else {
					openTelegramLink(res.invoice_link);
					pollPaymentAccess(u, res.payload);
				}
			}
		} catch (e: any) {
			setPaymentError(
				e?.response?.data?.error || e?.message || t('valuation.payment_failed') || 'Payment failed',
			);
			haptic.notify('error');
		} finally {
			setIsProcessingPayment(false);
		}
	};

	const handlePayCoins = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		setIsProcessingPayment(true);
		setPaymentError('');
		try {
			const res = await valuationApi.payWithAirdrop(u);
			if (res?.success === true) {
				haptic.notify('success');
				grantAccess('coins', u);
			} else {
				setPaymentError(t('shopInfo.insufficientCoins') || 'Insufficient coin balance.');
				haptic.notify('error');
			}
		} catch (e: any) {
			setPaymentError(
				e?.response?.data?.error ||
					e?.message ||
					t('shopInfo.insufficientCoins') ||
					'Insufficient coin balance',
			);
			haptic.notify('error');
		} finally {
			setIsProcessingPayment(false);
		}
	};

	const handleVerifyFreeAccess = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		if (freeQuotaUsed()) {
			setPaymentError(t('valuation.free_quota_used') || 'Free quota used.');
			haptic.notify('error');
			return;
		}
		setIsProcessingPayment(true);
		setPaymentError('');
		try {
			const res = await valuationApi.verifyFreeAccess(u);
			if (res?.has_access) {
				haptic.notify('success');
				localStorage.setItem('val_free_used', 'true');
				cloudStorage.setItem('val_free_used', 'true');
				setFreeQuotaUsed(true);
				grantAccess('free', u);
			} else {
				setPaymentError(t('valuation.free_quota_used') || 'Verification failed.');
				haptic.notify('error');
			}
		} catch (e: any) {
			const accessCheck = await valuationApi.checkAccess(u).catch(() => null);
			if (accessCheck) {
				if (accessCheck.in_channel !== undefined) setInChannel(accessCheck.in_channel);
				if (accessCheck.in_group !== undefined) setInGroup(accessCheck.in_group);
			}
			setPaymentError(e?.response?.data?.error || e?.message || 'Verification failed');
			haptic.notify('error');
		} finally {
			setIsProcessingPayment(false);
		}
	};

	const handleToggleMonitoring = async () => {
		const u = username();
		if (!u || isTogglingMonitor()) return;
		setIsTogglingMonitor(true);
		try {
			haptic.selection();
			const nextState = !isMonitored();
			const res = await valuationApi.toggleMonitoring(u, nextState);
			if (res?.success) {
				setIsMonitored(res.is_monitored);
				haptic.notify('success');
			}
		} catch (err: any) {
			triggerAlert(err?.message || 'Failed to update alert monitor');
		} finally {
			setIsTogglingMonitor(false);
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

	createEffect(() => {
		const initValuation = async () => {
			const u = username();
			setRecents(getRecentReports());
			if (!u) return;

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

			if (cachedAccess) {
				setAccessGranted(true);
				setAccessMethod(cachedAccess as any);
				fetchValuation(u);
			} else {
				try {
					const res = await valuationApi.checkAccess(u);
					if (res?.in_channel !== undefined) setInChannel(res.in_channel);
					if (res?.in_group !== undefined) setInGroup(res.in_group);
					if (res?.is_pro) {
						setIsPro(true);
						if (res.daily_used !== undefined) setDailyUsed(res.daily_used);
					}
					if (res?.free_quota_used) {
						setFreeQuotaUsed(true);
						localStorage.setItem('val_free_used', 'true');
						cloudStorage.setItem('val_free_used', 'true');
					}
					if (res?.first_report_discount_eligible !== undefined) {
						setFirstReportDiscountEligible(res.first_report_discount_eligible);
					}
					if (res?.is_monitored !== undefined) {
						setIsMonitored(res.is_monitored);
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
						setShowPaymentGate(true);
						setLoading(false);
					}
				} catch (_) {
					setShowPaymentGate(true);
					setLoading(false);
				}
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

	const coinRequiredAmount = () =>
		firstReportDiscountEligible()
			? ECONOMY_CONFIG.FIRST_REPORT_COIN_PRICE
			: ECONOMY_CONFIG.REPORT_COIN_PRICE;

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
						{/* ═══════ UNLOCKED ACCESS BADGE ═══════ */}
						<Show when={accessGranted() && accessMethod()}>
							<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[20px] p-3.5 flex items-center justify-between shadow-sm relative z-10">
								<div class="flex items-center gap-3.5">
									<div
										class={`w-11 h-11 rounded-[14px] flex items-center justify-center text-[22px] shrink-0 border shadow-inner ${
											accessMethod() === 'pro' || accessMethod() === 'stars'
												? 'bg-amber-400/10 text-amber-400 border-amber-400/30'
												: accessMethod() === 'coins'
													? 'bg-[#0098EA]/10 text-[#0098EA] border-[#0098EA]/30'
													: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30'
										}`}
									>
										{accessMethod() === 'pro'
											? '👑'
											: accessMethod() === 'stars'
												? '⭐'
												: accessMethod() === 'coins'
													? '🪙'
													: '🎁'}
									</div>
									<div class="flex flex-col text-start">
										<span class="text-[9px] text-white/40 uppercase font-black tracking-widest">
											{t('valuation.payment_method_badge') || 'ACCESS PROTOCOL'}
										</span>
										<span class="text-[13px] font-black text-white">
											{accessMethod() === 'pro'
												? 'PRO ANALYST PASS'
												: accessMethod() === 'stars'
													? t('valuation.method_stars')
													: accessMethod() === 'coins'
														? t('valuation.method_coins')
														: t('valuation.method_free')}
										</span>
									</div>
								</div>
								<div class="flex flex-col items-end gap-1">
									<span class="text-[10px] font-mono px-3 py-1 rounded-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
										<div class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34d399]" />
										{t('valuation.verified')}
									</span>
									<Show when={isPro()}>
										<span class="text-[9px] font-mono text-white/40 font-bold">
											{t('valuation.daily_quota_counter', { used: dailyUsed() }) ||
												`Today: ${dailyUsed()}/3 used`}
										</span>
									</Show>
								</div>
							</div>
						</Show>

						{/* ═══════ HERO CARD: UNLOCKED (3D GYRO) vs MINIMALIST PAYWALL ═══════ */}
						<Show
							when={accessGranted() && data()}
							fallback={
								<div class="w-full max-w-[440px] mx-auto my-3 relative z-20">
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
										onCheckPaymentStatus={() => pollPaymentAccess(username(), lastOrderPayload(), 5)}
									/>
								</div>
							}
						>
							{/* 💎 FULL UNLOCKED 3D HOLOGRAPHIC GYRO CARD */}
							<div
								class={`w-full aspect-square p-[3px] bg-gradient-to-br ${
									getTierTheme(data()?.rarity?.tier || '').wrapper
								} rounded-[48px] my-2 relative z-20 transition-all duration-300`}
							>
								<div
									ref={cardRef}
									onMouseMove={handleMouseMove}
									onMouseLeave={handleMouseLeave}
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
						</Show>

						{/* ═══════ UNLOCKED REPORT CONTENT (PHASE 3 & 4) ═══════ */}
						<Show when={accessGranted() && data()}>
							{/* 📜 OFFICIAL DIGITAL APPRAISAL CERTIFICATE (Bug 5 Fix: No Fake 8942) */}
							<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-amber-400/30 rounded-[28px] p-5 flex flex-col gap-3.5 shadow-[0_10px_30px_rgba(251,191,36,0.08)] relative overflow-hidden">
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
										title={
											data()?.run_id
												? `Audit Run #${data()?.run_id}`
												: t('valuation.cert_pending_audit') || 'Pending Audit'
										}
									>
										{data()?.run_id
											? `ID: IFR-${data()!.run_id.toString(16).toUpperCase()}`
											: 'ID: IFR-—'}
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

							{/* 🔔 PHASE 4: TARGETED USERNAME MONITOR TOGGLE */}
							<div class="w-full bg-[#12141C]/80 border border-white/10 rounded-[24px] p-4 flex items-center justify-between gap-3 shadow-sm">
								<div class="flex items-center gap-3 min-w-0">
									<div
										class={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border ${
											isMonitored()
												? 'bg-amber-400/15 border-amber-400/40 text-amber-400'
												: 'bg-white/5 border-white/10 text-white/40'
										}`}
									>
										<span class="material-symbols-outlined text-[20px]">
											{isMonitored() ? 'notifications_active' : 'notifications'}
										</span>
									</div>
									<div class="flex flex-col text-start min-w-0">
										<span class="text-white font-black text-[13px] truncate">
											{t('valuation.monitor_username_toggle') || 'Monitor this Username'}
										</span>
										<span class="text-white/40 text-[10px] font-medium truncate">
											{t('valuation.monitor_username_desc') ||
												'Instant alerts on auction start, sale, or price swings'}
										</span>
									</div>
								</div>

								<button
									type="button"
									onClick={handleToggleMonitoring}
									disabled={isTogglingMonitor()}
									class={`px-3.5 py-1.5 rounded-[12px] font-black text-[11px] uppercase tracking-wider transition-all active:scale-95 shrink-0 border ${
										isMonitored()
											? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
											: 'bg-white/5 text-white/70 hover:text-white border-white/10'
									}`}
								>
									{isMonitored() ? 'ACTIVE' : 'MONITOR'}
								</button>
							</div>

							{/* 📈 PHASE 3: SPARKLINE PRICE TREND CHART */}
							<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
								<SparklineChart
									data={data()?.price_trend}
									title={t('valuation.price_trend_title') || 'HISTORICAL VALUATION TREND'}
									unit="TON"
									color="#0098EA"
								/>
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
							<div class="w-full bg-gradient-to-br from-[#0098EA]/15 via-[#12141C]/90 to-[#08090D] backdrop-blur-2xl border border-[#0098EA]/30 rounded-[28px] p-6 flex flex-col gap-3.5 shadow-[0_10px_30px_rgba(0,152,234,0.15)] relative overflow-hidden">
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
							<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
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
								<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-[#0098EA]/30 rounded-[28px] p-6 flex flex-col gap-4 shadow-[0_10px_30px_rgba(0,152,234,0.15)] relative overflow-hidden">
									<div class="absolute -right-8 -bottom-8 w-28 h-28 bg-[#0098EA]/10 blur-3xl rounded-full pointer-events-none" />

									<div class="flex items-center justify-between text-white/90 relative z-10 border-b border-white/5 pb-3">
										<div class="flex items-center gap-2.5">
											<span class="material-symbols-outlined text-[22px] text-[#0098EA]">hub</span>
											<span class="text-[13px] font-black uppercase tracking-widest text-white">
												{t('valuation.concept_similar_title') || 'CONCEPT SIMILAR USERNAMES'}
											</span>
										</div>
										<span class="text-[10px] font-black text-[#0098EA] bg-[#0098EA]/10 border border-[#0098EA]/30 px-2.5 py-1 rounded-[8px] shadow-sm">
											{t('valuation.ai_matched') || 'AI MATCHED'}
										</span>
									</div>

									<div class="flex flex-col gap-2.5 relative z-10 text-start">
										<For each={data()?.similar}>
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
