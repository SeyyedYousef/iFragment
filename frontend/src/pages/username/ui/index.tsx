import { Motion } from '@motionone/solid';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { backButton, openLink, openTelegramLink } from '@tma.js/sdk-solid';
import { toPng } from 'html-to-image';
import { Component, createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { apiFetch } from '@/shared/api/base.js';
import { valuationApi } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { cloudStorage } from '@/shared/lib/cloud-storage.js';
import {
	formatRemaining,
	getCacheExpiry,
	getCachedReport,
	getRecentReports,
	invalidateReport,
	saveReport,
	type RecentReport,
} from '@/shared/lib/report-cache.js';
import { shareToStory } from '@/shared/lib/telegram-native.js';
import { haptic } from '@/shared/lib/haptic.js';

interface ValuationResult {
	run_id: number; username: string; model_version: string; base_price_ton: string; low_ton: string; expected_ton: string; high_ton: string; low_usd: string; expected_usd: string; high_usd: string; confidence_score: number; ton_usd_rate: number; comparable_sales_count: number;
	rarity: { tier: string; stars: string; }; tags: string[]; length: number;
	dictionary: { is_word: boolean; part_of_speech?: string; definition?: string; };
	history: { is_sold: boolean; owner_address?: string; highest_past_sale_ton?: number; transactions?: { sale_price_ton: string; date: string; buyer: string; }[]; };
	similar: { username: string; reason: string; status?: string; sale_price?: number; sale_price_usd?: number; sale_date?: string; price_source?: string; }[];
	portfolio?: { owner_address: string; total_count: number; total_last_sale_ton?: number; total_last_sale_usd?: number; total_acquisition_cost_ton?: number; total_est_value_ton?: number; total_est_value_usd?: number; priced_items?: number; unknown_items?: number; items: { username: string; status: string; last_sale_ton?: number; last_sale_usd?: number; last_sale_date?: string; }[]; };
	owner_profile?: { user_id?: number; first_name?: string; last_name?: string; username?: string; is_premium?: boolean; has_photo?: boolean; peer_type?: string; };
	structure: { has_digits: boolean; letters_only: boolean; has_underscore: boolean; };
	seo: { score: number; verdict: string; };
	liquidity_rating?: string; estimated_sell_time?: string; target_buyer_profile?: string;
	projected_growth?: { bull_ton: number; base_ton: number; bear_ton: number; bull_usd: number; base_usd: number; bear_usd: number; };
	liquidity_metrics?: { score: number; estimated_days: string; };
	auction_playbook?: { start_price_ton: number; bid_step_ton: number; best_day: string; best_hour_utc: string; };
	search_trend?: { surge_percent: number; status: string; };
	live_market?: {
		status: string; current_bid_ton?: number; current_bid_usd?: number; buy_now_ton?: number; buy_now_usd?: number;
		auction_ends_at?: string; mint_date?: string; owner_address?: string; previous_owners?: number;
		offers?: { price_ton: number; price_usd?: number; date?: string; from?: string }[];
		fragment_url: string; telegram_url: string; ask_vs_estimate_pct?: number; checked_at: string;
	};
	market_context?: {
		floor_price_ton?: number; volume_24h_ton?: number; total_volume_ton?: number; sales_count?: number;
		listed_ratio?: number; active_auctions?: number; total_owners?: number; items_count?: number; highest_sale_ton?: number;
	};
	price_basis?: { target_sales: number; exact_sales: number; broad_sales: number; anchor_used: boolean; live_ask_used: boolean; method: string };
	model_accuracy?: { sample_size: number; median_error_pct: number; within_band_pct: number; evaluated_at: string };
	reasoning_log: Record<string, any>; investment_grade: string; comparables: { username: string; price: number; date: string; }[]; price_trend: { label: string; value: number; }[]; wallet_info?: { balance: number; nft_count: number; is_whale: boolean; }; entity_info?: { type: string; members: number; verified: boolean; }; status?: string; brandability: number; fear_greed_index: number; fear_greed_label: string; wikipedia_summary: string; rarity_breakdown: Record<string, number>;
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

	const [_accessGranted, setAccessGranted] = createSignal<boolean>(false);
	const [accessMethod, setAccessMethod] = createSignal<'free' | 'stars' | 'coins' | null>(null);
	const [showPaymentGate, setShowPaymentGate] = createSignal<boolean>(false);
	const [freeQuotaUsed, setFreeQuotaUsed] = createSignal<boolean>(false);
	const [isProcessingPayment, setIsProcessingPayment] = createSignal<boolean>(false);
	const [paymentError, setPaymentError] = createSignal<string>('');

	// Cached-report state: a paid report stays readable for 24h, so a stray back
	// press never costs the user anything.
	const [fromCache, setFromCache] = createSignal<boolean>(false);
	const [cacheExpiry, setCacheExpiry] = createSignal<number | null>(null);
	const [recents, setRecents] = createSignal<RecentReport[]>([]);
	const [refreshing, setRefreshing] = createSignal<boolean>(false);
	const [showRecents, setShowRecents] = createSignal<boolean>(false);
	// Ticks once a second purely to drive the auction countdown.
	const [now, setNow] = createSignal<number>(Date.now());
	const [expanded, setExpanded] = createSignal<Record<string, boolean>>({});

	const navigate = useNavigate();
	const username = () => searchParams.u || '';

	const toggleSection = (key: string) => {
		haptic.selection();
		setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	/** Internal navigation to another report. Plain hrefs pointed at `/username`, which is not a route. */
	const openReport = (name: string) => {
		if (!name) return;
		haptic.impact('light');
		navigate(`/username/report?u=${encodeURIComponent(name)}`);
	};

	const openExternal = (url?: string) => {
		if (!url) return;
		haptic.impact('medium');
		try {
			url.includes('t.me/') ? openTelegramLink(url) : openLink(url);
		} catch (_) {
			window.open(url, '_blank');
		}
	};
	let cardRef: HTMLDivElement | undefined;
	let hiddenCardRef: HTMLDivElement | undefined;
	const [tilt, setTilt] = createSignal({ x: 0, y: 0, glossX: 50, glossY: 50 });

	const handleMouseMove = (e: MouseEvent) => {
		if (!cardRef) return;
		const rect = cardRef.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		setTilt({ x: ((rect.height / 2) - y) / 10, y: (x - (rect.width / 2)) / 10, glossX: (x / rect.width) * 100, glossY: (y / rect.height) * 100 });
	};
	const handleMouseLeave = () => setTilt({ x: 0, y: 0, glossX: 50, glossY: 50 });

	const getFontSize = (name: string) => {
		const len = name.length;
		if (len <= 5) return '46px';
		if (len <= 8) return '38px';
		if (len <= 12) return '30px';
		return '24px';
	};

	const getTierTheme = (tier: string) => {
		const t = (tier || '').toLowerCase();
		if (t.includes('legendary') || t.includes('grail') || t.includes('god')) return { wrapper: 'from-[#ffaa00] via-[#ff5500] to-[#ff0055] shadow-[0_20px_50px_rgba(255,85,0,0.5),inset_0_2px_10px_rgba(255,255,255,0.3)]', badge: 'bg-[#ffaa00]/15 border-[#ffaa00]/40 text-[#ffaa00] shadow-[0_0_15px_rgba(255,170,0,0.3)]', text: 'from-[#ffeaa7] via-[#ffaa00] to-[#ff5500]', glow: 'rgba(255,85,0,0.3)' };
		if (t.includes('epic') || t.includes('elite') || t.includes('apex')) return { wrapper: 'from-[#00f0ff] via-[#0057ff] to-[#7000ff] shadow-[0_20px_50px_rgba(0,87,255,0.5),inset_0_2px_10px_rgba(255,255,255,0.3)]', badge: 'bg-[#00f0ff]/15 border-[#00f0ff]/40 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.3)]', text: 'from-[#a5f3fc] via-[#00f0ff] to-[#0057ff]', glow: 'rgba(0,87,255,0.3)' };
		if (t.includes('rare') || t.includes('premium') || t.includes('grand')) return { wrapper: 'from-[#10b981] via-[#059669] to-[#047857] shadow-[0_20px_50px_rgba(16,185,129,0.5),inset_0_2px_10px_rgba(255,255,255,0.3)]', badge: 'bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.3)]', text: 'from-[#a7f3d0] via-[#10b981] to-[#059669]', glow: 'rgba(16,185,129,0.3)' };
		return { wrapper: 'from-[#94a3b8] via-[#475569] to-[#334155] shadow-[0_20px_50px_rgba(148,163,184,0.3),inset_0_2px_10px_rgba(255,255,255,0.2)]', badge: 'bg-[#94a3b8]/15 border-[#94a3b8]/40 text-[#e2e8f0]', text: 'from-white via-[#cbd5e1] to-[#94a3b8]', glow: 'rgba(255,255,255,0.15)' };
	};

	// Backend status vocabulary: sold | on_sale | on_auction | taken | available | non_nft.
	// Each maps to one badge so an owned handle is never advertised as "available".
	const similarBadge = (item: { status?: string; sale_price?: number; price_source?: string }) => {
		const status = item.status || '';
		const priced = (item.sale_price ?? 0) > 0;
		if (status === 'sold' && priced) {
			return item.price_source === 'archive_anchor'
				? { label: t('valuation.archive_sale_badge') || 'ARCHIVE SALE', class: 'bg-amber-400/15 text-amber-400 border-amber-400/30' }
				: { label: t('valuation.historical_sale_badge') || 'VERIFIED SALE', class: 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30' };
		}
		if (status === 'on_sale' || status === 'on_auction') {
			return { label: t('valuation.on_sale_badge') || 'ON SALE', class: 'bg-[#3390ec]/15 text-[#3390ec] border-[#3390ec]/30' };
		}
		if (status === 'taken' || status === 'sold') {
			return { label: t('valuation.taken_badge') || 'TAKEN', class: 'bg-white/10 text-white/60 border-white/10' };
		}
		if (status === 'available') {
			return { label: t('valuation.no_sale_badge') || 'UNSOLD / AVAILABLE', class: 'bg-emerald-400/10 text-emerald-300/70 border-emerald-400/20' };
		}
		// Occupancy could not be resolved in time — say so instead of guessing.
		return { label: t('valuation.unverified_badge') || 'UNVERIFIED', class: 'bg-white/5 text-white/35 border-white/10' };
	};

	// Portfolio items use the wallet vocabulary: owned | on_sale | bought | on_auction.
	const portfolioBadge = (status: string) => {
		switch (status) {
			case 'on_sale':
			case 'sale':
				return { label: t('valuation.listed_badge') || 'LISTED', class: 'bg-[#3390ec]/10 text-[#3390ec] border-[#3390ec]/30' };
			case 'on_auction':
				return { label: t('valuation.auction_badge') || 'AUCTION', class: 'bg-amber-400/10 text-amber-400 border-amber-400/30' };
			case 'bought':
				return { label: t('valuation.acquired_badge') || 'ACQUIRED', class: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30' };
			default:
				return { label: t('valuation.holding_badge') || 'HOLDING', class: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30' };
		}
	};

	const hasPortfolio = () => (data()?.portfolio?.items?.length ?? 0) > 0;

	// A profile only counts as resolved when MTProto actually returned an identity —
	// not when the backend echoed the queried handle back.
	const ownerProfile = () => {
		const p = data()?.owner_profile;
		if (!p) return null;
		if (!p.user_id && !p.first_name) return null;
		return p;
	};

	const triggerAlert = (msg: string) => {
		const tg = (window as any).Telegram?.WebApp;
		tg?.showAlert ? tg.showAlert(msg) : alert(msg);
	};

	const handleSendToChat = async () => {
		if (!hiddenCardRef || downloading()) return;
		if (sendCount() >= 2) return triggerAlert(t('valuation.err_server') || 'Send limit reached.');
		setDownloading(true); setSent(false);
		try {
			haptic.impact('medium');
			const dataUrl = await toPng(hiddenCardRef, { width: 400, height: 400, pixelRatio: 3 });
			const res = await apiFetch<{ success: boolean }>('/usernames/send-to-chat', { method: 'POST', body: JSON.stringify({ image: dataUrl }), headers: { 'Content-Type': 'application/json' } });
			if (res?.success) {
				haptic.notify('success');
				setSent(true); setSendCount(c => c + 1); setTimeout(() => setSent(false), 3000);
			}
		} catch (err) {
			triggerAlert(t('valuation.err_server') || 'Failed to send.');
		} finally { setDownloading(false); }
	};

	const handleShareToStory = async () => {
		const u = data()?.username || username();
		if (!u || !hiddenCardRef || sharing()) return;
		setSharing(true);
		try {
			haptic.impact('medium');
			const dataUrl = await toPng(hiddenCardRef, { width: 400, height: 400, pixelRatio: 3 });
			const res = await apiFetch<{ url: string }>('/usernames/share', { method: 'POST', body: JSON.stringify({ image: dataUrl }), headers: { 'Content-Type': 'application/json' } });
			if (res?.url) {
				shareToStory(res.url, { text: `Check out the market valuation of @${u} on iFragment! 💎`, widget_link: { url: `https://t.me/iFragmentBot/iFragment?startapp=val_${u}`, name: 'iFragment' } });
			}
		} catch (err) {} finally { setSharing(false); }
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => { haptic.impact('light'); window.history.back(); });
		onCleanup(() => { off(); backButton.hide(); });
	});

	const grantAccess = (method: 'free' | 'stars' | 'coins', targetUser: string) => {
		try { localStorage.setItem(`val_access_${targetUser}`, method); } catch (_) {}
		setAccessMethod(method); setAccessGranted(true); setShowPaymentGate(false); fetchValuation(targetUser);
	};

	/** Applies a report to the view and refreshes the cache-status indicators. */
	const applyReport = (res: ValuationResult, cached: boolean) => {
		setData(res);
		setFromCache(cached);
		setCacheExpiry(getCacheExpiry(res.username || username()));
		setRecents(getRecentReports());
	};

	const fetchValuation = async (u: string, opts: { force?: boolean } = {}) => {
		if (!u) return;

		// Serve the 24h cache first: the user already paid for this report, and a
		// back-press should never make them pay or wait again.
		if (!opts.force) {
			const cached = getCachedReport<ValuationResult>(u);
			if (cached) {
				applyReport(cached, true);
				setLoading(false);
				return;
			}
		}

		opts.force ? setRefreshing(true) : setLoading(true);
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
			// A failed refresh must not destroy the report already on screen.
			if (opts.force && data()) {
				triggerAlert(err?.message || t('valuation.err_server') || 'Refresh failed');
			} else {
				setError(err.message || t('valuation.err_server') || 'A server error occurred');
			}
		} finally {
			setRefreshing(false);
			setLoading(false);
		}
	};

	const handleRefresh = async () => {
		const u = data()?.username || username();
		if (!u || refreshing()) return;
		haptic.impact('medium');
		invalidateReport(u);
		await fetchValuation(u, { force: true });
	};

	const handlePayStars = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		setIsProcessingPayment(true); setPaymentError('');
		try {
			const res = await valuationApi.createStarsInvoice(u);
			if (res?.invoice_link) {
				const tg = (window as any).Telegram?.WebApp;
				if (tg?.openInvoice) {
					tg.openInvoice(res.invoice_link, (status: string) => { if (status === 'paid') { haptic.notify('success'); grantAccess('stars', u); } });
				} else { openTelegramLink(res.invoice_link); grantAccess('stars', u); }
			} else grantAccess('stars', u);
		} catch (e: any) {
			setPaymentError(e?.message || 'Payment failed'); haptic.notify('error');
		} finally { setIsProcessingPayment(false); }
	};

	const handlePayCoins = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		setIsProcessingPayment(true); setPaymentError('');
		try {
			const res = await valuationApi.payWithAirdrop(u);
			if (res?.success) { haptic.notify('success'); grantAccess('coins', u); }
			else grantAccess('coins', u);
		} catch (e: any) {
			setPaymentError(e?.response?.data?.error || e?.message || 'Insufficient coin balance'); haptic.notify('error');
		} finally { setIsProcessingPayment(false); }
	};

	const handleVerifyFreeAccess = async () => {
		const u = username();
		if (!u || isProcessingPayment()) return;
		if (freeQuotaUsed()) { setPaymentError(t('valuation.free_quota_used') || 'Free quota used.'); haptic.notify('error'); return; }
		setIsProcessingPayment(true); setPaymentError('');
		try {
			const res = await valuationApi.verifyFreeAccess(u);
			if (res?.has_access) {
				haptic.notify('success');
				localStorage.setItem('val_free_used', 'true'); cloudStorage.setItem('val_free_used', 'true');
				setFreeQuotaUsed(true); grantAccess('free', u);
			} else {
				setPaymentError(t('valuation.free_quota_used') || 'Verification failed.'); haptic.notify('error');
			}
		} catch (e: any) {
			setPaymentError(e?.response?.data?.error || e?.message || 'Verification failed'); haptic.notify('error');
		} finally { setIsProcessingPayment(false); }
	};

	createEffect(() => {
		const initValuation = async () => {
			const u = username();
			setRecents(getRecentReports());
			if (!u) return;

			const cachedAccess = localStorage.getItem(`val_access_${u}`);
			const cached = getCachedReport<ValuationResult>(u);

			// Only serve local cache immediately if user has confirmed access
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
			else cloudStorage.getItem('val_free_used').then((val) => { if (val === 'true') { setFreeQuotaUsed(true); localStorage.setItem('val_free_used', 'true'); } });

			if (cachedAccess) {
				setAccessGranted(true);
				setAccessMethod(cachedAccess as any);
				fetchValuation(u);
			} else {
				try {
					const res = await valuationApi.checkAccess(u);
					if (res?.free_quota_used) {
						setFreeQuotaUsed(true);
						localStorage.setItem('val_free_used', 'true');
						cloudStorage.setItem('val_free_used', 'true');
					}
					if (res?.has_access) {
						const method = res.method || 'stars';
						try { localStorage.setItem(`val_access_${u}`, method); } catch (_) {}
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

	// One shared 1s tick drives the auction countdown; it only runs while an
	// auction is actually open.
	onMount(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		onCleanup(() => clearInterval(timer));
	});

	// --- Derived Intelligence Data ---
	const expectedTon = () => parseFloat(data()?.expected_ton || '0');
	const lowTon = () => parseFloat(data()?.low_ton || '0');
	const highTon = () => parseFloat(data()?.high_ton || '0');

	/** Position of `value` inside the low..high band, clamped to 4%..96% so the marker never clips. */
	const bandPosition = (value: number) => {
		const lo = lowTon();
		const hi = highTon();
		if (!(hi > lo) || !(value > 0)) return 50;
		return Math.min(96, Math.max(4, ((value - lo) / (hi - lo)) * 100));
	};

	const live = () => data()?.live_market;

	/** Remaining auction time, or null when there is no open auction. */
	const countdown = createMemo(() => {
		const endsAt = live()?.auction_ends_at;
		if (!endsAt) return null;
		const ms = new Date(endsAt).getTime() - now();
		if (!Number.isFinite(ms) || ms <= 0) return null;
		const days = Math.floor(ms / 86_400_000);
		const hours = Math.floor((ms % 86_400_000) / 3_600_000);
		const minutes = Math.floor((ms % 3_600_000) / 60_000);
		const seconds = Math.floor((ms % 60_000) / 1000);
		return { days, hours, minutes, seconds, urgent: ms < 3_600_000 };
	});

	const liveStatusTheme = (status: string) => {
		switch (status) {
			case 'on_auction':
				return { label: t('valuation.live_on_auction') || 'LIVE AUCTION', class: 'bg-amber-400/15 text-amber-400 border-amber-400/40', icon: 'gavel' };
			case 'on_sale':
				return { label: t('valuation.live_on_sale') || 'BUY NOW', class: 'bg-[#3390ec]/15 text-[#3390ec] border-[#3390ec]/40', icon: 'sell' };
			case 'available':
				return { label: t('valuation.live_available') || 'AVAILABLE', class: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/40', icon: 'how_to_reg' };
			case 'taken':
				return { label: t('valuation.live_taken') || 'NOT FOR SALE', class: 'bg-white/10 text-white/60 border-white/15', icon: 'lock' };
			default:
				return { label: t('valuation.live_unknown') || 'STATUS UNKNOWN', class: 'bg-white/5 text-white/35 border-white/10', icon: 'help' };
		}
	};

	/** Confidence bucket used for both the bar colour and its label. */
	const confidenceTheme = () => {
		const score = data()?.confidence_score ?? 0;
		if (score >= 80) return { color: '#10b981', label: t('valuation.conf_high') || 'HIGH CONFIDENCE' };
		if (score >= 60) return { color: '#3390ec', label: t('valuation.conf_medium') || 'MODERATE CONFIDENCE' };
		if (score >= 45) return { color: '#f59e0b', label: t('valuation.conf_low') || 'LOW CONFIDENCE' };
		return { color: '#ff4a4a', label: t('valuation.conf_thin') || 'THIN DATA' };
	};

	/** Percentage change of a projection scenario versus today's estimate. */
	const growthPct = (value?: number) => {
		const base = expectedTon();
		if (!value || !base) return '';
		const pct = Math.round(((value / base) - 1) * 100);
		return `${pct >= 0 ? '+' : ''}${pct}%`;
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
					<div class="absolute inset-0 bg-gradient-to-b from-[#3390ec]/15 to-transparent blur-[120px]" />
					<div class="relative flex items-center justify-center w-20 h-20">
						<div class="absolute w-full h-full border-[3px] border-white/5 border-t-[#3390ec] rounded-full animate-spin shadow-[0_0_20px_rgba(51,144,236,0.6)]" />
						<span class="material-symbols-outlined text-[24px] text-[#3390ec] animate-pulse">radar</span>
					</div>
					<div class="flex flex-col items-center gap-1">
						<span class="text-[13px] font-black tracking-[4px] uppercase text-[#3390ec] animate-pulse">{t('valuation.analyzing') || 'DECRYPTING'}</span>
						<span class="text-[10px] font-mono font-bold text-white/40 tracking-widest">ON-CHAIN INTELLIGENCE...</span>
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
							<span class="material-symbols-outlined text-[48px] text-[#ff4a4a] drop-shadow-md">gpp_bad</span>
						</div>
						<h1 class="text-[22px] font-black mb-2 tracking-tight z-10 font-mono">{t('valuation.error_title') || 'INTELLIGENCE FAILED'}</h1>
						<p class="text-[13px] text-white/50 leading-relaxed mb-8 max-w-[280px] font-medium z-10">{error()}</p>
						<button onClick={() => window.history.back()} class="h-14 px-10 bg-[#12141C]/80 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-widest text-[13px] rounded-[16px] transition-all active:scale-95 shadow-sm z-10 backdrop-blur-md">
							{t('valuation.back') || 'RETURN TO BASE'}
						</button>
					</div>
				}
			>
				<div class="min-h-screen bg-[#030303] text-white px-5 py-6 flex flex-col items-center font-sans pb-32 select-none relative overflow-x-hidden overflow-y-auto w-full" style={{ 'touch-action': 'pan-y' }} dir={isRtl() ? 'rtl' : 'ltr'}>
					
					{/* ═══════ AMBIENT DYNAMIC BACKGROUND ═══════ */}
					<div class="fixed top-0 left-1/2 -translate-x-1/2 w-[150vw] h-[500px] blur-[120px] pointer-events-none z-0 opacity-50 transition-colors duration-1000" style={{ background: `radial-gradient(circle, ${getTierTheme(data()?.rarity?.tier || '').glow} 0%, transparent 60%)` }} />

					<div class="w-full max-w-[420px] flex flex-col items-center gap-4">

						{/* ═══════ ACCESS AUDIT BADGE ═══════ */}
						<Show when={accessMethod()}>
							<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[20px] p-3.5 flex items-center justify-between shadow-sm relative z-10">
								<div class="flex items-center gap-3.5">
									<div class={`w-11 h-11 rounded-[14px] flex items-center justify-center text-[22px] shrink-0 border shadow-inner ${accessMethod() === 'stars' ? 'bg-amber-400/10 text-amber-400 border-amber-400/30' : accessMethod() === 'coins' ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30' : 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30'}`}>
										{accessMethod() === 'stars' ? '⭐' : accessMethod() === 'coins' ? '🪙' : '🎁'}
									</div>
									<div class="flex flex-col text-start">
										<span class="text-[9px] text-white/40 uppercase font-black tracking-widest">{t('valuation.payment_method_badge') || 'ACCESS PROTOCOL'}</span>
										<span class="text-[13px] font-black text-white">{accessMethod() === 'stars' ? t('valuation.method_stars') : accessMethod() === 'coins' ? t('valuation.method_coins') : t('valuation.method_free')}</span>
									</div>
								</div>
								<span class="text-[10px] font-mono px-3 py-1.5 rounded-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
									<div class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34d399]" />
									VERIFIED
								</span>
							</div>
						</Show>

						{/* ═══════ HERO HOLOGRAPHIC CARD ═══════ */}
						<div class={`w-full aspect-square p-[3px] bg-gradient-to-br ${getTierTheme(data()?.rarity?.tier || '').wrapper} rounded-[48px] my-2 relative z-20 transition-all duration-300`} style={{ 'aspect-ratio': '1 / 1' }}>
							<div
								ref={cardRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
								class="w-full h-full bg-[#08090D] rounded-[45px] p-8 relative overflow-hidden flex flex-col justify-between shadow-inner"
								style={{ transform: `perspective(1200px) rotateX(${tilt().x}deg) rotateY(${tilt().y}deg)`, 'background-image': 'radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px)', 'background-size': '24px 24px', transition: 'transform 0.1s ease-out' }}
							>
								<div class="absolute inset-0 pointer-events-none z-20 mix-blend-overlay transition-opacity duration-300 opacity-80" style={{ background: `radial-gradient(circle at ${tilt().glossX}% ${tilt().glossY}%, rgba(255,255,255,0.4) 0%, transparent 60%)` }} />
								<div class="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />

								<div class="flex justify-between items-center z-10">
									<span class={`px-4 py-2 border rounded-[12px] text-[10px] font-black tracking-widest uppercase shadow-sm ${getTierTheme(data()?.rarity?.tier || '').badge}`}>
										{data()?.rarity?.tier || 'STANDARD'}
									</span>
									<span class="text-[11px] font-mono font-black text-white/30 tracking-[5px] uppercase bg-white/5 border border-white/5 px-4 py-1.5 rounded-[12px] shadow-inner">IFRAGMENT</span>
								</div>

								<div class="flex flex-col justify-center items-center z-10 text-center flex-grow relative py-6 w-full">
									<div class="absolute w-full h-[160px] opacity-70 -z-10 pointer-events-none mix-blend-screen" style={{ background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${getTierTheme(data()?.rarity?.tier || '').glow}, transparent 70%)` }} />
									<div class="flex items-center justify-center gap-2.5 w-full">
										<span class="text-white/20 font-black text-[28px] select-none drop-shadow-md">✦</span>
										<span class="inline-block font-black tracking-tighter text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] truncate max-w-[75%] pb-2" style={{ 'font-size': getFontSize(data()?.username || username()) }} dir="ltr">
											@{data()?.username || username()}
										</span>
										<span class="text-white/20 font-black text-[28px] select-none drop-shadow-md">✦</span>
									</div>
								</div>

								<div class="flex justify-between items-end border-t border-white/10 pt-5 z-10">
									<div class="flex flex-col gap-1 text-left">
										<span class="text-[10px] font-black text-white/40 uppercase tracking-widest mb-0.5">{t('valuation.estimated_price') || 'ESTIMATED VALUE'}</span>
										<div class="flex items-center gap-2.5">
											<svg class="w-8 h-8 filter drop-shadow-[0_0_15px_rgba(0,152,234,0.6)]" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA"/><path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5765 15.6277H37.5603ZM26.2483 36.8068L23.6119 31.8097L17.2017 20.6506C16.6742 19.7557 17.3255 18.6198 18.4223 18.6198H26.2483V36.8068ZM38.7972 20.6506L32.387 31.8259L29.7506 36.8068V18.6361H37.5765C38.6734 18.6361 39.3247 19.772 38.7972 20.6669V20.6506Z" fill="white"/></svg>
											<span class="text-[34px] font-black text-white leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] tracking-tight">{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US')}</span>
											<span class="text-[15px] font-black text-[#3390ec] leading-none mb-1">TON</span>
										</div>
									</div>
									<div class="flex flex-col items-end gap-2.5">
										<div class="flex items-center gap-2 bg-[#10b981]/15 px-3.5 py-1.5 rounded-[10px] border border-[#10b981]/40 text-[#10b981] font-black uppercase tracking-widest text-[9px] shadow-[0_0_20px_rgba(16,185,129,0.2)] backdrop-blur-sm">
											<div class="w-2 h-2 bg-[#10b981] rounded-full animate-pulse shadow-[0_0_10px_#10b981]" /> VERIFIED
										</div>
										<span class="text-[15px] text-white/60 font-black leading-none tracking-tight font-mono">≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
									</div>
								</div>
							</div>
						</div>

						{/* ═══════ ACTION BUTTONS ═══════ */}
						<div class="flex gap-3 w-full relative z-20 mb-2">
							<button onClick={handleSendToChat} disabled={downloading() || sent()} class={`flex-1 h-14 rounded-[16px] font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-sm border ${sent() ? 'bg-[#10b981]/20 border-[#10b981]/40 text-[#10b981]' : 'bg-[#12141C]/90 backdrop-blur-xl hover:bg-white/10 active:scale-95 border-white/10 text-white/90'}`}>
								<Show when={!downloading()} fallback={<><div class="w-5 h-5 rounded-full border-[3px] border-current border-t-transparent animate-spin" /><span>{t('valuation.sending') || 'SENDING...'}</span></>}>
									<Show when={!sent()} fallback={<><span class="material-symbols-outlined text-[20px]">check_circle</span><span>{t('valuation.sent_to_chat') || 'SENT!'}</span></>}>
										<span class="material-symbols-outlined text-[20px]">send</span> {t('valuation.download') || 'SEND TO CHAT'}
									</Show>
								</Show>
							</button>
							<button onClick={handleShareToStory} disabled={sharing()} class="flex-1 h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] active:scale-95 text-white font-black text-[13px] uppercase tracking-widest rounded-[16px] flex items-center justify-center gap-2 transition-all shadow-[0_10px_30px_rgba(51,144,236,0.4)] disabled:opacity-60 border border-white/10">
								<Show when={!sharing()} fallback={<><div class="w-5 h-5 rounded-full border-[3px] border-white/30 border-t-white animate-spin" /><span>{t('valuation.sharing') || 'UPLOADING...'}</span></>}>
									<span class="material-symbols-outlined text-[22px]" style={{ 'font-variation-settings': '"FILL" 1' }}>auto_stories</span> {t('valuation.share') || 'STORY'}
								</Show>
							</button>
						</div>

						{/* ═══════ SAVED-REPORT BAR ═══════ */}
						{/* A report costs Stars or coins, so it is kept readable for 24h.
						    This bar makes that promise visible and gives a way back into
						    anything else the user has already paid for. */}
						<Show when={data()}>
							<div class="w-full flex flex-col gap-2 relative z-20">
								<div class="flex items-center gap-2">
									<Show when={fromCache() && cacheExpiry()}>
										<span class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2.5 py-1.5 rounded-[10px] whitespace-nowrap">
											<span class="material-symbols-outlined text-[14px]">bookmark</span>
											{t('valuation.cached_report') || 'Saved report'} · {formatRemaining(cacheExpiry()!)}
										</span>
									</Show>
									<button
										onClick={handleRefresh}
										disabled={refreshing()}
										class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1.5 rounded-[10px] transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
									>
										<span class={`material-symbols-outlined text-[14px] ${refreshing() ? 'animate-spin' : ''}`}>refresh</span>
										{refreshing() ? (t('valuation.refreshing') || 'Refreshing…') : (t('valuation.refresh_report') || 'Refresh')}
									</button>
									<Show when={recents().length > 1}>
										<button
											onClick={() => setShowRecents((v) => !v)}
											class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1.5 rounded-[10px] transition-all active:scale-95 ms-auto whitespace-nowrap"
										>
											<span class="material-symbols-outlined text-[14px]">history</span>
											{recents().length}
										</button>
									</Show>
								</div>

								<Show when={showRecents() && recents().length > 0}>
									<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[20px] p-4 flex flex-col gap-2.5">
										<div class="flex items-center justify-between gap-2">
											<span class="text-white/60 text-[10px] font-black uppercase tracking-widest truncate">{t('valuation.recents_title') || 'Your recent reports'}</span>
											<span class="text-white/25 text-[9px] font-medium shrink-0">{t('valuation.recents_hint') || 'Kept for 24 hours'}</span>
										</div>
										<div class="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
											<For each={recents()}>
												{(entry) => (
													<button
														onClick={() => { setShowRecents(false); openReport(entry.username); }}
														class={`flex items-center justify-between gap-2 rounded-[12px] px-3.5 py-2.5 border transition-all active:scale-[0.98] text-start ${
															entry.username === (data()?.username || '').toLowerCase()
																? 'bg-[#3390ec]/10 border-[#3390ec]/30'
																: 'bg-[#08090D] border-white/5 hover:bg-white/[0.04]'
														}`}
													>
														<span class="text-white font-mono font-black text-[12px] truncate" dir="ltr">@{entry.username}</span>
														<div class="flex items-center gap-2 shrink-0">
															<Show when={entry.expectedTon}>
																<span class="text-white/50 font-mono font-bold text-[11px] whitespace-nowrap">
																	{fmtTon(parseFloat(entry.expectedTon || '0'))} TON
																</span>
															</Show>
															<span class="text-white/20 text-[9px] font-mono whitespace-nowrap">
																{formatRemaining(entry.savedAt + 24 * 60 * 60 * 1000)}
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

						{/* ⚡ 0. LIVE MARKET STATE — the only actionable card on the page */}
						<Show when={live()}>
							{(m) => {
								const theme = () => liveStatusTheme(m().status);
								const isLive = () => m().status === 'on_auction' || m().status === 'on_sale';
								const ask = () => m().buy_now_ton || m().current_bid_ton || 0;
								const delta = () => m().ask_vs_estimate_pct ?? 0;

								return (
									<div class={`w-full rounded-[28px] p-6 flex flex-col gap-4 relative overflow-hidden border backdrop-blur-2xl shadow-lg ${
										isLive() ? 'bg-gradient-to-br from-amber-500/10 via-[#12141C]/95 to-[#08090D] border-amber-400/30' : 'bg-[#12141C]/80 border-white/5'
									}`}>
										<Show when={isLive()}>
											<div class="absolute -right-10 -top-10 w-36 h-36 bg-amber-400/10 blur-3xl rounded-full pointer-events-none" />
										</Show>

										<div class="flex items-center justify-between gap-3 relative z-10">
											<div class="flex items-center gap-2.5 min-w-0">
												<span class={`material-symbols-outlined text-[22px] shrink-0 ${isLive() ? 'text-amber-400' : 'text-white/50'}`}>{theme().icon}</span>
												<span class="text-[13px] font-black uppercase tracking-widest text-white truncate">
													{t('valuation.live_market_title') || 'LIVE MARKET'}
												</span>
											</div>
											<span class={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[8px] border shrink-0 whitespace-nowrap flex items-center gap-1.5 ${theme().class}`}>
												<Show when={isLive()}>
													<span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
												</Show>
												{theme().label}
											</span>
										</div>

										{/* Standing price + how it compares to our estimate */}
										<Show when={ask() > 0}>
											<div class="flex items-end justify-between gap-3 bg-[#08090D] border border-white/5 rounded-[18px] p-4 relative z-10 shadow-inner">
												<div class="flex flex-col gap-1 min-w-0">
													<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">
														{m().buy_now_ton ? (t('valuation.buy_now_price') || 'BUY NOW PRICE') : (t('valuation.current_bid') || 'CURRENT BID')}
													</span>
													<div class="flex items-baseline gap-2">
														<span class="text-white font-mono font-black text-[22px] leading-none">{fmtTon(ask())}</span>
														<span class="text-[#3390ec] font-black text-[12px]">TON</span>
													</div>
													<span class="text-white/35 text-[11px] font-mono font-bold">
														≈ ${fmtUsd(m().buy_now_usd || m().current_bid_usd)}
													</span>
												</div>
												<Show when={delta() !== 0}>
													<div class={`flex flex-col items-end gap-0.5 px-3 py-2 rounded-[12px] border shrink-0 ${
														delta() > 0 ? 'bg-[#ff4a4a]/10 border-[#ff4a4a]/30 text-[#ff4a4a]' : 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]'
													}`}>
														<span class="font-mono font-black text-[15px] leading-none">{delta() > 0 ? '+' : ''}{delta()}%</span>
														<span class="text-[8px] font-black uppercase tracking-widest opacity-80 whitespace-nowrap">
															{delta() > 0 ? (t('valuation.above_estimate') || 'ABOVE EST.') : (t('valuation.below_estimate') || 'BELOW EST.')}
														</span>
													</div>
												</Show>
											</div>
										</Show>

										{/* Auction countdown */}
										<Show when={countdown()}>
											{(c) => (
												<div class={`flex items-center justify-between gap-3 rounded-[18px] p-4 border relative z-10 ${
													c().urgent ? 'bg-[#ff4a4a]/10 border-[#ff4a4a]/30' : 'bg-[#08090D] border-white/5'
												}`}>
													<span class={`text-[9px] font-black uppercase tracking-widest ${c().urgent ? 'text-[#ff4a4a]' : 'text-white/40'}`}>
														{t('valuation.auction_ends_in') || 'AUCTION ENDS IN'}
													</span>
													<div class="flex items-center gap-1.5 font-mono font-black text-[16px] text-white tabular-nums" dir="ltr">
														<Show when={c().days > 0}>
															<span>{c().days}<span class="text-[10px] text-white/40 ml-0.5">d</span></span>
														</Show>
														<span>{String(c().hours).padStart(2, '0')}<span class="text-[10px] text-white/40 ml-0.5">h</span></span>
														<span>{String(c().minutes).padStart(2, '0')}<span class="text-[10px] text-white/40 ml-0.5">m</span></span>
														<span class={c().urgent ? 'text-[#ff4a4a]' : ''}>{String(c().seconds).padStart(2, '0')}<span class="text-[10px] text-white/40 ml-0.5">s</span></span>
													</div>
												</div>
											)}
										</Show>

										{/* Recorded offers / past sales from the marketplace */}
										<Show when={(m().offers?.length ?? 0) > 0}>
											<div class="flex flex-col gap-1.5 relative z-10">
												<span class="text-white/40 text-[9px] font-black uppercase tracking-widest px-1">
													{t('valuation.recorded_offers') || 'RECORDED MARKET ACTIVITY'}
												</span>
												<For each={m().offers}>
													{(offer) => (
														<div class="flex items-center justify-between gap-2 bg-[#08090D] border border-white/5 rounded-[12px] px-3.5 py-2.5">
															<span class="text-white font-mono font-black text-[12px] whitespace-nowrap">{fmtTon(offer.price_ton)} TON</span>
															<span class="text-white/30 text-[10px] font-mono font-bold truncate" dir="ltr">
																{offer.date ? new Date(offer.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
															</span>
														</div>
													)}
												</For>
											</div>
										</Show>

										{/* Act on it */}
										<div class="flex gap-2.5 relative z-10">
											<button
												onClick={() => openExternal(m().fragment_url)}
												class={`flex-1 h-12 rounded-[14px] font-black text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 border ${
													isLive()
														? 'bg-amber-400 hover:bg-amber-300 text-black border-amber-300 shadow-[0_8px_20px_rgba(245,158,11,0.3)]'
														: 'bg-white/5 hover:bg-white/10 text-white/80 border-white/10'
												}`}
											>
												<span class="material-symbols-outlined text-[18px]">open_in_new</span>
												{t('valuation.view_on_fragment') || 'FRAGMENT'}
											</button>
											<button
												onClick={() => openExternal(m().telegram_url)}
												class="flex-1 h-12 rounded-[14px] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-black text-[12px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
											>
												<span class="material-symbols-outlined text-[18px]">send</span>
												{t('valuation.open_in_telegram') || 'OPEN t.me'}
											</button>
										</div>

										<span class="text-white/20 text-[9px] font-mono text-center relative z-10">
											{t('valuation.checked_at') || 'Checked'} {new Date(m().checked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC
										</span>
									</div>
								);
							}}
						</Show>

						{/* 📊 1. PRICE RANGE + CONFIDENCE + BASIS */}
						<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-5 shadow-sm">
							<div class="flex items-center justify-between gap-3 text-white/90 border-b border-white/5 pb-3">
								<div class="flex items-center gap-2 min-w-0">
									<span class="material-symbols-outlined text-[20px] text-white shrink-0">monitoring</span>
									<span class="text-[13px] font-black uppercase tracking-widest truncate">{t('valuation.price_range') || 'PRICE RANGE'}</span>
								</div>
								<span class="text-[10px] font-black text-white/30 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-[8px] border border-white/5 shadow-inner shrink-0">{t('valuation.market_estimation') || 'ESTIMATION'}</span>
							</div>

							{/* The band is now drawn from the actual low/expected/high values.
							    It used to be hardcoded 30/40/30 with the marker pinned to 50%,
							    so every username produced an identical picture. */}
							<div class="relative w-full h-4 bg-[#08090D] rounded-full overflow-hidden shadow-inner border border-white/5">
								<div class="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-white/10 via-white/50 to-white/10" />
								<div
									class="absolute top-0 bottom-0 w-1.5 bg-[#3390ec] shadow-[0_0_15px_#3390ec] rounded-full -translate-x-1/2 transition-[left] duration-500"
									style={{ left: `${bandPosition(expectedTon())}%` }}
								/>
								{/* The live market price, plotted on the same axis when it exists */}
								<Show when={(live()?.buy_now_ton || live()?.current_bid_ton || 0) > 0}>
									<div
										class="absolute top-0 bottom-0 w-1.5 bg-amber-400 shadow-[0_0_12px_#fbbf24] rounded-full -translate-x-1/2 transition-[left] duration-500"
										style={{ left: `${bandPosition(live()!.buy_now_ton || live()!.current_bid_ton || 0)}%` }}
									/>
								</Show>
							</div>

							<div class="flex justify-between items-end w-full -mt-1">
								<div class="flex flex-col text-start">
									<span class="text-white/40 text-[9px] uppercase font-black tracking-widest mb-1">{t('valuation.floor') || 'LOW'}</span>
									<span class="text-white/70 font-mono font-black text-[13px]">{fmtTon(lowTon())}</span>
								</div>
								<div class="flex flex-col text-center">
									<span class="text-[#3390ec] text-[9px] uppercase font-black tracking-widest mb-1">{t('valuation.expected_label') || 'EXPECTED'}</span>
									<span class="text-white font-mono font-black text-[17px]">{fmtTon(expectedTon())}</span>
								</div>
								<div class="flex flex-col text-end">
									<span class="text-white/40 text-[9px] uppercase font-black tracking-widest mb-1">{t('valuation.ceiling') || 'HIGH'}</span>
									<span class="text-white/70 font-mono font-black text-[13px]">{fmtTon(highTon())}</span>
								</div>
							</div>

							{/* Confidence — the trust signal that was computed but never shown */}
							<div class="flex flex-col gap-2 bg-[#08090D] border border-white/5 rounded-[18px] p-4 shadow-inner">
								<div class="flex items-center justify-between gap-2">
									<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.confidence_label') || 'CONFIDENCE'}</span>
									<span class="text-[10px] font-black uppercase tracking-widest" style={{ color: confidenceTheme().color }}>
										{confidenceTheme().label} · {data()?.confidence_score ?? 0}%
									</span>
								</div>
								<div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
									<div
										class="h-full rounded-full transition-[width] duration-700"
										style={{ width: `${data()?.confidence_score ?? 0}%`, background: confidenceTheme().color, 'box-shadow': `0 0 12px ${confidenceTheme().color}` }}
									/>
								</div>

								{/* What the number is actually based on */}
								<Show when={data()?.price_basis}>
									{(basis) => (
										<div class="flex flex-wrap gap-1.5 pt-1">
											<Show when={basis().target_sales > 0}>
												<span class="text-[9px] font-bold text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/25 px-2 py-0.5 rounded-[6px]">
													{basis().target_sales} {t('valuation.basis_own_sales') || 'own sales'}
												</span>
											</Show>
											<Show when={basis().exact_sales > 0}>
												<span class="text-[9px] font-bold text-white/50 bg-white/5 border border-white/10 px-2 py-0.5 rounded-[6px]">
													{basis().exact_sales} {t('valuation.basis_exact') || 'same-length comps'}
												</span>
											</Show>
											<Show when={basis().broad_sales > 0}>
												<span class="text-[9px] font-bold text-white/50 bg-white/5 border border-white/10 px-2 py-0.5 rounded-[6px]">
													{basis().broad_sales} {t('valuation.basis_broad') || 'segment comps'}
												</span>
											</Show>
											<Show when={basis().live_ask_used}>
												<span class="text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded-[6px]">
													{t('valuation.basis_live_ask') || 'live ask included'}
												</span>
											</Show>
										</div>
									)}
								</Show>

								{/* Measured track record, shown only once it is statistically meaningful */}
								<Show when={data()?.model_accuracy}>
									{(acc) => (
										<div class="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5 mt-1">
											<span class="text-white/30 text-[9px] font-black uppercase tracking-widest">
												{t('valuation.model_track_record') || 'MEASURED TRACK RECORD'}
											</span>
											<span class="text-white/50 text-[10px] font-mono font-bold text-end">
												{acc().within_band_pct}% {t('valuation.in_band') || 'in band'} · ±{acc().median_error_pct}% · n={acc().sample_size}
											</span>
										</div>
									)}
								</Show>
							</div>
						</div>

						{/* 🌍 MARKET CONTEXT — a price needs a scale to be read against */}
						<Show when={data()?.market_context}>
							{(ctx) => (
								<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
									<div class="flex items-center justify-between gap-3 text-white/90 border-b border-white/5 pb-3">
										<div class="flex items-center gap-2 min-w-0">
											<span class="material-symbols-outlined text-[20px] text-emerald-400 shrink-0">public</span>
											<span class="text-[13px] font-black uppercase tracking-widest truncate">{t('valuation.market_context_title') || 'COLLECTION MARKET'}</span>
										</div>
										<span class="text-[10px] font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2.5 py-1 rounded-[8px] shrink-0">TON</span>
									</div>
									<div class="grid grid-cols-2 gap-3">
										<Show when={(ctx().floor_price_ton ?? 0) > 0}>
											<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3.5 flex flex-col gap-0.5 shadow-inner min-w-0">
												<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.floor_price') || 'FLOOR PRICE'}</span>
												<span class="text-white font-mono font-black text-[14px] truncate">{fmtTon(ctx().floor_price_ton)} TON</span>
											</div>
										</Show>
										<Show when={(ctx().volume_24h_ton ?? 0) > 0}>
											<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3.5 flex flex-col gap-0.5 shadow-inner min-w-0">
												<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.volume_24h') || '24H VOLUME'}</span>
												<span class="text-white font-mono font-black text-[14px] truncate">{fmtTon(ctx().volume_24h_ton)} TON</span>
											</div>
										</Show>
										<Show when={(ctx().active_auctions ?? 0) > 0}>
											<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3.5 flex flex-col gap-0.5 shadow-inner min-w-0">
												<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.active_auctions') || 'LIVE AUCTIONS'}</span>
												<span class="text-amber-400 font-mono font-black text-[14px] truncate">{ctx().active_auctions?.toLocaleString('en-US')}</span>
											</div>
										</Show>
										<Show when={(ctx().total_owners ?? 0) > 0}>
											<div class="bg-[#08090D] border border-white/5 rounded-[16px] p-3.5 flex flex-col gap-0.5 shadow-inner min-w-0">
												<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.total_holders') || 'HOLDERS'}</span>
												<span class="text-white font-mono font-black text-[14px] truncate">{ctx().total_owners?.toLocaleString('en-US')}</span>
											</div>
										</Show>
									</div>
								</div>
							)}
						</Show>

						{/* 🧬 2. USERNAME STRUCTURAL ANATOMY */}
						<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
							<div class="flex items-center justify-between gap-3 text-white/90 border-b border-white/5 pb-3">
								<div class="flex items-center gap-2 min-w-0">
									<span class="material-symbols-outlined text-[20px] text-cyan-400 shrink-0">dna</span>
									<span class="text-[13px] font-black uppercase tracking-widest truncate">{t('valuation.anatomy_title') || 'STRUCTURAL ANATOMY'}</span>
								</div>
								<span class="text-[10px] font-mono font-black text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2.5 py-1 rounded-[8px] shrink-0 whitespace-nowrap">
									{t('valuation.anatomy_length') || 'LENGTH'}: {data()?.length || (data()?.username || username()).length} {t('valuation.anatomy_chars') || 'chars'}
								</span>
							</div>

							<div class="grid grid-cols-3 gap-3">
								<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-1 text-center shadow-inner min-w-0">
									<span class="text-white/40 text-[9px] font-black uppercase truncate">{t('valuation.anatomy_letters_only') || 'LETTERS ONLY'}</span>
									<span class="text-white font-black text-[12px] truncate">
										{data()?.structure?.letters_only ? (t('valuation.anatomy_pure') || 'Yes (pure)') : (t('valuation.anatomy_no') || 'No')}
									</span>
								</div>
								<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-1 text-center shadow-inner min-w-0">
									<span class="text-white/40 text-[9px] font-black uppercase truncate">{t('valuation.anatomy_digits') || 'DIGITS'}</span>
									<span class="text-white font-black text-[12px] truncate">
										{data()?.structure?.has_digits ? (t('valuation.anatomy_contains') || 'Contains') : (t('valuation.anatomy_none') || 'None')}
									</span>
								</div>
								<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-1 text-center shadow-inner min-w-0">
									<span class="text-white/40 text-[9px] font-black uppercase truncate">{t('valuation.anatomy_underscore') || 'UNDERSCORE'}</span>
									<span class="text-white font-black text-[12px] truncate">
										{data()?.structure?.has_underscore ? (t('valuation.anatomy_yes') || 'Yes') : (t('valuation.anatomy_clean') || 'Clean')}
									</span>
								</div>
							</div>
						</div>

						{/* 🕮 3. HISTORY & OWNERSHIP */}
						<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
							<div class="flex items-center gap-2 text-white/90 border-b border-white/5 pb-3">
								<span class="material-symbols-outlined text-[20px] text-white">history</span>
								<span class="text-[13px] font-black uppercase tracking-widest">{t('valuation.history_title') || 'OWNERSHIP HISTORY'}</span>
							</div>
							<Show when={data()?.history?.is_sold || (data()?.history?.transactions?.length ?? 0) > 0} fallback={
								<div class="flex items-center gap-3.5 bg-[#10b981]/10 border border-[#10b981]/20 rounded-[16px] p-4.5 shadow-inner">
									<div class="w-8 h-8 rounded-[10px] bg-[#10b981]/20 flex items-center justify-center shrink-0">
										<span class="material-symbols-outlined text-[#10b981] text-[18px]">verified</span>
									</div>
									<span class="text-[#10b981] text-[12px] font-black uppercase tracking-widest">{t('valuation.not_sold') || 'NEVER SOLD ON FRAGMENT!'}</span>
								</div>
							}>
								<div class="flex flex-col rounded-[16px] overflow-hidden bg-[#08090D] border border-white/5 shadow-inner">
									<div class="grid grid-cols-3 p-3.5 bg-white/[0.03] text-[10px] font-black text-white/30 uppercase tracking-widest border-b border-white/5">
										<span>{t('valuation.sale_price') || 'PRICE'}</span><span class="text-center">{t('valuation.date') || 'DATE'}</span><span class="text-right">{t('valuation.buyer') || 'BUYER'}</span>
									</div>
									<Show when={(data()?.history?.transactions?.length ?? 0) > 0} fallback={<div class="p-6 text-center text-white/30 text-[12px] font-bold uppercase tracking-widest">{t('valuation.no_transaction_data') || 'No transaction data'}</div>}>
										{data()?.history?.transactions?.map((tx, idx) => (
											<div class={`grid grid-cols-3 p-4 items-center text-[13px] hover:bg-white/[0.02] transition-colors ${idx !== (data()?.history?.transactions?.length || 0) - 1 ? 'border-b border-white/5' : ''}`}>
												<span class="text-white font-mono font-black">{tx.sale_price_ton} TON</span>
												<span class="text-white/40 text-[11px] font-mono font-bold text-center">{new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
												<span class="text-white font-mono font-black text-[12px] truncate text-right">{tx.buyer ? `${tx.buyer.slice(0, 5)}...${tx.buyer.slice(-4)}` : 'Fragment'}</span>
											</div>
										))}
									</Show>
								</div>
							</Show>
						</div>

						{/* 🌟 4. LINGUISTIC MEANING & DICTIONARY */}
						<div class="w-full bg-gradient-to-br from-[#3390ec]/15 via-[#12141C]/90 to-[#08090D] backdrop-blur-2xl border border-[#3390ec]/30 rounded-[28px] p-6 flex flex-col gap-3.5 shadow-[0_10px_30px_rgba(51,144,236,0.15)] relative overflow-hidden">
							<div class="absolute -right-8 -top-8 w-32 h-32 bg-[#3390ec]/10 blur-3xl rounded-full pointer-events-none" />
							
							<div class="flex items-center justify-between text-white/90 relative z-10 border-b border-[#3390ec]/20 pb-3">
								<div class="flex items-center gap-2.5">
									<span class="material-symbols-outlined text-[22px] text-[#3390ec]">translate</span>
									<span class="text-[13px] font-black uppercase tracking-widest text-[#3390ec]">{t('valuation.ling_meaning_title') || 'MEANING & IDENTITY'}</span>
								</div>
								<span class={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-[8px] border shadow-sm ${data()?.dictionary?.is_word ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/40' : 'bg-white/5 text-white/40 border-white/10'}`}>
									{data()?.dictionary?.is_word ? (t('valuation.yes') || 'DICTIONARY WORD') : (t('valuation.no') || 'GENERIC HANDLE')}
								</span>
							</div>

							<div class="relative z-10 flex flex-col gap-2.5">
								<Show when={data()?.dictionary?.is_word && data()?.dictionary?.definition}>
									<div class="bg-[#08090D]/80 rounded-[18px] p-4 border border-[#3390ec]/20 text-white/80 text-[13px] leading-relaxed font-medium italic border-l-[4px] border-l-[#3390ec] shadow-inner">
										"{data()?.dictionary?.definition}"
									</div>
								</Show>

								<Show when={data()?.wikipedia_summary}>
									<div class="bg-[#08090D]/80 rounded-[18px] p-4 border border-white/5 flex flex-col gap-2 shadow-inner">
										<span class="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
											<span class="material-symbols-outlined text-[16px] text-amber-400">menu_book</span>
											{t('valuation.wiki_summary_title') || 'WIKIPEDIA & KNOWLEDGE BASE'}
										</span>
										<p class="text-[12px] font-medium text-white/70 leading-relaxed">
											{data()?.wikipedia_summary}
										</p>
									</div>
								</Show>
							</div>
						</div>

						{/* 🔥 5. SEMANTIC SIMILAR USERNAMES & BRAND EQUIVALENTS */}
						<Show when={(data()?.similar?.length ?? 0) > 0}>
							<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-[#3390ec]/30 rounded-[28px] p-6 flex flex-col gap-4 shadow-[0_10px_30px_rgba(51,144,236,0.15)] relative overflow-hidden">
								<div class="absolute -right-8 -bottom-8 w-28 h-28 bg-[#3390ec]/10 blur-3xl rounded-full pointer-events-none" />
								
								<div class="flex items-center justify-between text-white/90 relative z-10 border-b border-white/5 pb-3">
									<div class="flex items-center gap-2.5">
										<span class="material-symbols-outlined text-[22px] text-[#3390ec]">hub</span>
										<span class="text-[13px] font-black uppercase tracking-widest text-white">{t('valuation.concept_similar_title') || 'CONCEPT SIMILAR USERNAMES'}</span>
									</div>
									<span class="text-[10px] font-black text-[#3390ec] bg-[#3390ec]/10 border border-[#3390ec]/30 px-2.5 py-1 rounded-[8px] shadow-sm">
										{t('valuation.ai_matched') || 'AI MATCHED'}
									</span>
								</div>

								<div class="flex flex-col gap-2.5 relative z-10">
									{data()?.similar?.map((item) => {
										const badge = similarBadge(item);
										const hasPrice = (item.sale_price ?? 0) > 0;

										return (
											<div
												onClick={() => openReport(item.username)}
												class="flex items-center justify-between gap-3 bg-[#08090D] hover:bg-white/[0.04] p-4 rounded-[18px] border border-white/5 hover:border-[#3390ec]/30 transition-all cursor-pointer shadow-inner group"
											>
												<div class="flex flex-col gap-1.5 min-w-0 flex-1">
													<div class="flex items-center gap-2 min-w-0">
														<span class="text-[#3390ec] font-black text-[15px] group-hover:underline truncate" dir="ltr">@{item.username}</span>
														<span class={`text-[9px] font-black uppercase px-2 py-0.5 rounded-[6px] border shrink-0 whitespace-nowrap ${badge.class}`}>
															{badge.label}
														</span>
													</div>
													<span class="text-white/40 text-[11px] font-medium truncate">{item.reason}</span>
												</div>

												<div class="flex flex-col items-end shrink-0">
													<Show when={hasPrice} fallback={
														<span class="text-white/25 text-[11px] font-medium whitespace-nowrap">{t('valuation.no_sale_price') || 'No Sale Record'}</span>
													}>
														<span class="text-white font-mono font-black text-[14px] whitespace-nowrap">{item.sale_price?.toLocaleString('en-US', { maximumFractionDigits: 0 })} TON</span>
														<Show when={(item.sale_price_usd ?? 0) > 0}>
															<span class="text-white/40 text-[10px] font-mono font-bold whitespace-nowrap">≈ ${item.sale_price_usd?.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
														</Show>
														<Show when={item.sale_date}>
															<span class="text-white/25 text-[9px] font-mono font-bold whitespace-nowrap">{new Date(item.sale_date!).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
														</Show>
													</Show>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</Show>

						{/* 🐋 6. HOLDER PORTFOLIO & WHALE PROFILE */}
						{/* Rendered only when the wallet actually holds something verifiable —
						    the card used to always show, padding itself with "Fragment Wallet",
						    "1 Collectibles" and the queried username's own price as the
						    portfolio value. */}
						<Show when={hasPortfolio() || ownerProfile()}>
							<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-amber-500/20 rounded-[28px] p-6 flex flex-col gap-4 shadow-[0_10px_30px_rgba(245,158,11,0.08)] relative overflow-hidden">
								<div class="absolute -left-10 -bottom-10 w-36 h-36 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

								<div class="flex items-center justify-between gap-3 text-white/90 border-b border-white/5 pb-3.5 relative z-10">
									<div class="flex items-center gap-2.5 min-w-0">
										<div class="w-8 h-8 rounded-[10px] bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
											<span class="material-symbols-outlined text-[18px]">account_balance_wallet</span>
										</div>
										<div class="flex flex-col text-start min-w-0">
											<span class="text-[13px] font-black uppercase tracking-widest text-white truncate">{t('valuation.whale_portfolio_title') || 'HOLDER PORTFOLIO'}</span>
											<span class="text-[10px] text-white/40 font-medium truncate">{t('valuation.whale_portfolio_subtitle') || 'ON-CHAIN ASSET DISTRIBUTION'}</span>
										</div>
									</div>
									<Show when={hasPortfolio()}>
										<span class={`text-[10px] font-black px-2.5 py-1 rounded-[8px] border shadow-sm shrink-0 whitespace-nowrap ${
											data()?.wallet_info?.is_whale
												? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
												: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
										}`}>
											{data()?.wallet_info?.is_whale ? '🐋 WHALE HOLDER' : '👤 COLLECTOR'}
										</span>
									</Show>
								</div>

								{/* Owner Profile Badge — only when MTProto resolved a real identity */}
								<Show when={ownerProfile()}>
									<div class="flex items-center justify-between gap-3 bg-[#08090D]/90 border border-white/10 rounded-[18px] p-3.5 relative z-10 shadow-inner">
										<div class="flex items-center gap-3 min-w-0">
											<div class="w-9 h-9 rounded-full bg-gradient-to-tr from-[#3390ec] to-[#00f0ff] flex items-center justify-center text-white font-black text-[14px] shadow-sm shrink-0">
												{(ownerProfile()?.first_name?.[0] || ownerProfile()?.username?.[0] || '?').toUpperCase()}
											</div>
											<div class="flex flex-col text-start min-w-0">
												<div class="flex items-center gap-1.5 min-w-0">
													<span class="text-white font-bold text-[13px] truncate">
														{[ownerProfile()?.first_name, ownerProfile()?.last_name].filter(Boolean).join(' ')}
													</span>
													<Show when={ownerProfile()?.is_premium}>
														<span class="material-symbols-outlined text-amber-400 text-[14px] shrink-0">star</span>
													</Show>
												</div>
												<Show when={ownerProfile()?.username}>
													<span class="text-white/40 text-[11px] font-mono font-semibold truncate" dir="ltr">@{ownerProfile()?.username}</span>
												</Show>
											</div>
										</div>
										<span class="text-[10px] font-black text-[#3390ec] bg-[#3390ec]/10 border border-[#3390ec]/30 px-2.5 py-1 rounded-[8px] shrink-0 uppercase">
											{ownerProfile()?.peer_type || 'account'}
										</span>
									</div>
								</Show>

								<Show when={hasPortfolio()} fallback={
									<div class="flex items-center gap-3 bg-[#08090D] border border-white/5 rounded-[18px] p-4 relative z-10 shadow-inner">
										<span class="material-symbols-outlined text-white/25 text-[20px] shrink-0">search_off</span>
										<div class="flex flex-col text-start min-w-0">
											<span class="text-white/60 text-[12px] font-bold">{t('valuation.portfolio_empty_title') || 'No public holdings found'}</span>
											<span class="text-white/30 text-[11px] font-medium">{t('valuation.portfolio_empty_desc') || 'This wallet has no other verifiable collectibles on-chain.'}</span>
										</div>
									</div>
								}>
									{/* Wallet summary — every figure below is derived from resolved on-chain data */}
									<div class="grid grid-cols-2 gap-3 relative z-10">
										<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-0.5 shadow-inner min-w-0">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.holder_wallet') || 'HOLDER WALLET'}</span>
											<span class="text-amber-400 font-mono font-black text-[12px] truncate" dir="ltr">
												{`${data()!.portfolio!.owner_address.slice(0, 6)}...${data()!.portfolio!.owner_address.slice(-4)}`}
											</span>
										</div>
										<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-0.5 shadow-inner min-w-0">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.total_nfts') || 'TOTAL ASSETS'}</span>
											<span class="text-white font-mono font-black text-[14px] truncate">
												{data()?.wallet_info?.nft_count || data()!.portfolio!.total_count} {t('valuation.items_suffix') || 'items'}
											</span>
										</div>
										<Show when={(data()?.portfolio?.total_est_value_ton ?? 0) > 0}>
											<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-0.5 shadow-inner min-w-0">
												<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.portfolio_est_val') || 'EST. PORTFOLIO VALUE'}</span>
												<span class="text-emerald-400 font-mono font-black text-[14px] truncate">
													{data()?.portfolio?.total_est_value_ton?.toLocaleString('en-US', { maximumFractionDigits: 0 })} TON
												</span>
											</div>
										</Show>
										<Show when={(data()?.portfolio?.total_acquisition_cost_ton ?? 0) > 0}>
											<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 flex flex-col gap-0.5 shadow-inner min-w-0">
												<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.portfolio_spent_total') || 'TOTAL ACQUISITION COST'}</span>
												<span class="text-white font-mono font-black text-[14px] truncate">
													{data()?.portfolio?.total_acquisition_cost_ton?.toLocaleString('en-US', { maximumFractionDigits: 0 })} TON
												</span>
											</div>
										</Show>
									</div>

									{/* Portfolio Collectibles List */}
									<div class="flex flex-col gap-2 relative z-10 pt-1">
										<div class="flex items-center justify-between gap-2 px-1">
											<span class="text-white/50 text-[10px] font-black uppercase tracking-widest truncate">{t('valuation.other_collectibles') || 'OTHER ASSETS IN SAME WALLET'}</span>
											<span class="text-[#3390ec] text-[10px] font-mono font-bold shrink-0">{data()?.portfolio?.items?.length} ITEMS</span>
										</div>

										<div class="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
											{data()?.portfolio?.items?.map((item) => {
												const badge = portfolioBadge(item.status);
												return (
													<div
														onClick={() => openReport(item.username)}
														class="flex items-center justify-between gap-2 bg-[#08090D] hover:bg-white/[0.04] border border-white/5 rounded-[14px] p-3 cursor-pointer transition-all active:scale-[0.98]"
													>
														<div class="flex items-center gap-2 min-w-0">
															<span class="text-white/30 text-[12px] font-mono shrink-0">✦</span>
															<span class="text-white font-mono font-black text-[13px] truncate" dir="ltr">@{item.username}</span>
														</div>
														<div class="flex items-center gap-2 shrink-0">
															<Show when={(item.last_sale_ton ?? 0) > 0} fallback={
																<span class="text-white/25 text-[10px] font-medium whitespace-nowrap">{t('valuation.portfolio_unpriced') || 'no public price'}</span>
															}>
																<span class="text-amber-400 font-mono font-black text-[11px] whitespace-nowrap">{item.last_sale_ton?.toLocaleString('en-US', { maximumFractionDigits: 0 })} TON</span>
															</Show>
															<span class={`text-[9px] font-black px-2 py-0.5 rounded-[6px] border whitespace-nowrap ${badge.class}`}>
																{badge.label}
															</span>
														</div>
													</div>
												);
											})}
										</div>
									</div>
								</Show>
							</div>
						</Show>

						{/* 📈 7. COMPARABLE SALES — the evidence behind the number */}
						<Show when={(data()?.comparables?.length ?? 0) > 0}>
							<div class="w-full bg-[#12141C]/80 backdrop-blur-2xl border border-white/5 rounded-[28px] p-6 flex flex-col gap-4 shadow-sm">
								<div class="flex items-center justify-between gap-3 text-white/90 border-b border-white/5 pb-3">
									<div class="flex flex-col text-start min-w-0">
										<div class="flex items-center gap-2 min-w-0">
											<span class="material-symbols-outlined text-[20px] text-white shrink-0">receipt_long</span>
											<span class="text-[13px] font-black uppercase tracking-widest truncate">{t('valuation.comparables_title') || 'COMPARABLE SALES'}</span>
										</div>
										<span class="text-[10px] text-white/35 font-medium ps-7">{t('valuation.comparables_subtitle') || 'Real sales this estimate is built on'}</span>
									</div>
									<span class="text-[10px] font-mono font-black text-white/40 bg-white/5 border border-white/10 px-2.5 py-1 rounded-[8px] shrink-0">
										{data()?.comparable_sales_count ?? data()?.comparables?.length}
									</span>
								</div>

								<div class="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
									<For each={data()?.comparables?.slice(0, 12)}>
										{(comp) => (
											<button
												onClick={() => openReport(comp.username)}
												class="flex items-center justify-between gap-2 bg-[#08090D] hover:bg-white/[0.04] border border-white/5 rounded-[14px] px-3.5 py-3 transition-all active:scale-[0.98] text-start"
											>
												<span class="text-white/80 font-mono font-black text-[12px] truncate" dir="ltr">@{comp.username}</span>
												<div class="flex items-center gap-2.5 shrink-0">
													<span class="text-white font-mono font-black text-[12px] whitespace-nowrap">{fmtTon(comp.price)} TON</span>
													<Show when={comp.date}>
														<span class="text-white/25 text-[10px] font-mono whitespace-nowrap">
															{new Date(comp.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
														</span>
													</Show>
												</div>
											</button>
										)}
									</For>
								</div>
							</div>
						</Show>

						{/* 🧬 8. SELLER DNA — collapsed by default; these are heuristics, not measurements */}
						<div class="w-full bg-[#12141C]/60 backdrop-blur-2xl border border-white/5 rounded-[28px] overflow-hidden shadow-sm">
							<button onClick={() => toggleSection('dna')} class="w-full flex items-center justify-between gap-3 p-5 hover:bg-white/[0.02] transition-colors">
								<div class="flex items-center gap-2 min-w-0">
									<span class="material-symbols-outlined text-[20px] text-amber-400 shrink-0">person_search</span>
									<span class="text-[13px] font-black uppercase tracking-widest text-white/80 truncate">{t('valuation.seller_dna_title') || 'SELLER DNA & RADAR'}</span>
								</div>
								<span class={`material-symbols-outlined text-[20px] text-white/30 shrink-0 transition-transform ${expanded().dna ? 'rotate-180' : ''}`}>expand_more</span>
							</button>
							<Show when={expanded().dna}>
								<div class="px-5 pb-5 flex flex-col gap-3">
									<div class="grid grid-cols-2 gap-3">
										<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-4 flex flex-col gap-1 shadow-inner min-w-0">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.bidding_war_title') || 'BIDDING WAR PROBABILITY'}</span>
											<span class="text-amber-400 font-mono font-black text-[16px]">
												{Math.min(98, (data()?.brandability ?? 70) + 15)}%
											</span>
										</div>
										<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-4 flex flex-col gap-1 shadow-inner min-w-0">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.negotiation_tactic') || 'NEGOTIATION TACTIC'}</span>
											<span class="text-white font-mono font-black text-[13px] truncate">
												{data()?.dictionary?.is_word ? (t('valuation.hard_negotiation') || 'HARD HOLD') : (t('valuation.soft_negotiation') || 'FLEXIBLE')}
											</span>
										</div>
									</div>
									<Show when={data()?.target_buyer_profile}>
										<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-4 flex flex-col gap-1 shadow-inner">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.target_buyer') || 'LIKELY BUYER'}</span>
											<span class="text-white font-bold text-[13px]">{data()?.target_buyer_profile}</span>
										</div>
									</Show>
									<span class="text-white/20 text-[9px] font-medium text-center">{t('valuation.heuristic_note') || 'Heuristic guidance, not a measured market signal.'}</span>
								</div>
							</Show>
						</div>

						{/* ⚖️ 9. AUCTION PLAYBOOK */}
						<div class="w-full bg-[#12141C]/60 backdrop-blur-2xl border border-white/5 rounded-[28px] overflow-hidden shadow-sm">
							<button onClick={() => toggleSection('playbook')} class="w-full flex items-center justify-between gap-3 p-5 hover:bg-white/[0.02] transition-colors">
								<div class="flex items-center gap-2 min-w-0">
									<span class="material-symbols-outlined text-[20px] text-[#3390ec] shrink-0">gavel</span>
									<span class="text-[13px] font-black uppercase tracking-widest text-white/80 truncate">{t('valuation.auction_playbook_title') || 'AUCTION PLAYBOOK'}</span>
								</div>
								<span class={`material-symbols-outlined text-[20px] text-white/30 shrink-0 transition-transform ${expanded().playbook ? 'rotate-180' : ''}`}>expand_more</span>
							</button>
							<Show when={expanded().playbook}>
								<div class="px-5 pb-5 flex flex-col gap-3">
									<div class="grid grid-cols-2 gap-3">
										<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-4 flex flex-col gap-1 shadow-inner min-w-0">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.recommended_start') || 'RECOMMENDED START'}</span>
											<span class="text-white font-mono font-black text-[15px] truncate">
												{fmtTon(data()?.auction_playbook?.start_price_ton || Math.round(expectedTon() * 0.7))} TON
											</span>
										</div>
										<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-4 flex flex-col gap-1 shadow-inner min-w-0">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.bid_step') || 'BID STEP'}</span>
											<span class="text-white font-mono font-black text-[15px] truncate">
												{fmtTon(data()?.auction_playbook?.bid_step_ton)} TON
											</span>
										</div>
										<Show when={data()?.estimated_sell_time}>
											<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-4 flex flex-col gap-1 shadow-inner min-w-0">
												<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.time_to_sell') || 'ESTIMATED TIME TO SELL'}</span>
												<span class="text-emerald-400 font-mono font-black text-[14px] truncate">{data()?.estimated_sell_time}</span>
											</div>
										</Show>
										{/* Best listing window only appears when the comparable set was large
										    enough to reveal one — it used to read "Thursday 18:00" for everyone. */}
										<Show when={data()?.auction_playbook?.best_day}>
											<div class="bg-[#08090D] border border-white/5 rounded-[18px] p-4 flex flex-col gap-1 shadow-inner min-w-0">
												<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.best_window') || 'BEST LISTING WINDOW'}</span>
												<span class="text-white font-mono font-black text-[14px] truncate">
													{data()?.auction_playbook?.best_day} {data()?.auction_playbook?.best_hour_utc} UTC
												</span>
											</div>
										</Show>
									</div>
									<Show when={data()?.liquidity_rating || data()?.liquidity_metrics}>
										<div class="flex items-center justify-between gap-2 bg-[#08090D] border border-white/5 rounded-[18px] p-4 shadow-inner">
											<span class="text-white/40 text-[9px] font-black uppercase tracking-widest">{t('valuation.liquidity_label') || 'LIQUIDITY'}</span>
											<span class="text-[#3390ec] font-mono font-black text-[13px]">
												{data()?.liquidity_rating || `${data()?.liquidity_metrics?.score}/100`}
											</span>
										</div>
									</Show>
								</div>
							</Show>
						</div>

						{/* 🚀 10. 12-MONTH PROJECTION — percentages now reflect the real values */}
						<Show when={data()?.projected_growth}>
							{(growth) => (
								<div class="w-full bg-[#12141C]/60 backdrop-blur-2xl border border-white/5 rounded-[28px] overflow-hidden shadow-sm">
									<button onClick={() => toggleSection('projection')} class="w-full flex items-center justify-between gap-3 p-5 hover:bg-white/[0.02] transition-colors">
										<div class="flex items-center gap-2 min-w-0">
											<span class="material-symbols-outlined text-[20px] text-[#10b981] shrink-0">rocket_launch</span>
											<span class="text-[13px] font-black uppercase tracking-widest text-white/80 truncate">{t('valuation.roi_title') || '12-MO PROJECTION'}</span>
										</div>
										<span class={`material-symbols-outlined text-[20px] text-white/30 shrink-0 transition-transform ${expanded().projection ? 'rotate-180' : ''}`}>expand_more</span>
									</button>
									<Show when={expanded().projection}>
										<div class="px-5 pb-5 flex flex-col gap-3">
											<div class="grid grid-cols-3 gap-2.5">
												<div class="bg-[#08090D] border border-[#10b981]/30 rounded-[18px] p-3.5 flex flex-col items-center text-center gap-1 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)] min-w-0">
													<span class="text-[#10b981] text-[9px] font-black uppercase tracking-widest">BULL</span>
													<span class="text-[#10b981]/70 text-[10px] font-mono font-bold">{growthPct(growth().bull_ton)}</span>
													<span class="text-white font-mono font-black text-[13px] mt-0.5 truncate w-full">{fmtTon(growth().bull_ton)}</span>
												</div>
												<div class="bg-[#08090D] border border-white/20 rounded-[18px] p-3.5 flex flex-col items-center text-center gap-1 shadow-inner min-w-0">
													<span class="text-white/60 text-[9px] font-black uppercase tracking-widest">BASE</span>
													<span class="text-white/40 text-[10px] font-mono font-bold">{growthPct(growth().base_ton)}</span>
													<span class="text-white font-mono font-black text-[13px] mt-0.5 truncate w-full">{fmtTon(growth().base_ton)}</span>
												</div>
												<div class="bg-[#08090D] border border-[#ff4a4a]/30 rounded-[18px] p-3.5 flex flex-col items-center text-center gap-1 shadow-[inset_0_0_15px_rgba(255,74,74,0.1)] min-w-0">
													<span class="text-[#ff4a4a] text-[9px] font-black uppercase tracking-widest">BEAR</span>
													<span class="text-[#ff4a4a]/70 text-[10px] font-mono font-bold">{growthPct(growth().bear_ton)}</span>
													<span class="text-white font-mono font-black text-[13px] mt-0.5 truncate w-full">{fmtTon(growth().bear_ton)}</span>
												</div>
											</div>
											<span class="text-white/20 text-[9px] font-medium text-center">
												{t('valuation.projection_note') || 'Cone width follows the dispersion of this segment’s comparable sales.'}
											</span>
										</div>
									</Show>
								</div>
							)}
						</Show>

						{/* Audit footer — the report is reproducible, and says so */}
						<Show when={data()?.run_id}>
							<div class="w-full flex flex-col items-center gap-1 pt-2 pb-4 opacity-40">
								<span class="text-white/50 text-[9px] font-mono">
									{data()?.model_version} · run #{data()?.run_id}
								</span>
								<span class="text-white/30 text-[9px] font-mono">
									1 TON ≈ ${data()?.ton_usd_rate?.toFixed(2)}
								</span>
							</div>
						</Show>

					</div>

					{/* ═══════ HIDDEN HOLOGRAPHIC EXPORT CARD ═══════ */}
					<div class="fixed left-[-9999px] top-[-9999px] pointer-events-none">
						<div
							ref={hiddenCardRef}
							class={`w-[400px] h-[400px] p-[3px] bg-gradient-to-br ${getTierTheme(data()?.rarity?.tier || '').wrapper} rounded-[40px] flex flex-col overflow-hidden`}
						>
							<div class="w-full h-full bg-[#08090D] rounded-[37px] p-7 flex flex-col justify-between relative overflow-hidden">
								<div class="flex justify-between items-center z-10">
									<span class={`px-3 py-1.5 border rounded-[10px] text-[9px] font-black tracking-widest uppercase shadow-sm ${getTierTheme(data()?.rarity?.tier || '').badge}`}>
										{data()?.rarity?.tier || 'STANDARD'}
									</span>
									<span class="text-[10px] font-mono font-black text-white/30 tracking-[4px] uppercase bg-white/5 border border-white/5 px-3 py-1 rounded-[10px]">IFRAGMENT</span>
								</div>

								<div class="flex flex-col justify-center items-center z-10 text-center flex-grow py-4 w-full">
									<div class="flex items-center justify-center gap-2 w-full">
										<span class="text-white/20 font-black text-[22px]">✦</span>
										<span class="inline-block font-black tracking-tighter text-white truncate max-w-[80%]" style={{ 'font-size': getFontSize(data()?.username || username()) }} dir="ltr">
											@{data()?.username || username()}
										</span>
										<span class="text-white/20 font-black text-[22px]">✦</span>
									</div>
								</div>

								<div class="flex justify-between items-end border-t border-white/10 pt-4 z-10">
									<div class="flex flex-col gap-0.5 text-left">
										<span class="text-[9px] font-black text-white/40 uppercase tracking-widest">ESTIMATED VALUE</span>
										<div class="flex items-center gap-2">
											<span class="text-[28px] font-black text-white leading-none tracking-tight">{parseFloat(data()?.expected_ton || '0').toLocaleString('en-US')}</span>
											<span class="text-[13px] font-black text-[#3390ec] mb-0.5">TON</span>
										</div>
									</div>
									<div class="flex flex-col items-end gap-1.5">
										<span class="text-[13px] text-white/60 font-black leading-none font-mono">≈ ${parseFloat(data()?.expected_usd || '0').toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* ═══════ PAYMENT MODAL GATE ═══════ */}
					<Show when={showPaymentGate()}>
						<Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} class="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
							<Motion.div initial={{ y: '100%' }} animate={{ y: 0 }} class="w-full max-w-[420px] bg-[#12141C] border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-6 flex flex-col gap-5 shadow-2xl relative">
								<div class="flex justify-between items-center border-b border-white/5 pb-4">
									<div class="flex items-center gap-2">
										<span class="material-symbols-outlined text-amber-400 text-[24px]">lock</span>
										<h3 class="text-[17px] font-black text-white tracking-tight">{t('valuation.gate_title') || 'UNLOCK FULL AI INTELLIGENCE'}</h3>
									</div>
									<button onClick={() => window.history.back()} class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors">
										<span class="material-symbols-outlined text-[18px]">close</span>
									</button>
								</div>

								<Show when={paymentError()}>
									<div class="p-[#ff4a4a]/10 border border-[#ff4a4a]/30 rounded-[14px] text-[#ff4a4a] text-[12px] font-bold text-center">
										{paymentError()}
									</div>
								</Show>

								<div class="flex flex-col gap-3">
									{/* Stars Option */}
									<button onClick={handlePayStars} disabled={isProcessingPayment()} class="w-full relative group overflow-hidden bg-[#08090D] border border-amber-400/20 hover:border-amber-400/50 rounded-[24px] p-4.5 text-left transition-all active:scale-[0.98] disabled:opacity-50 shadow-md">
										<div class="absolute -right-6 -top-6 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl group-hover:bg-amber-400/20 transition-all pointer-events-none" />
										<div class="relative flex items-center justify-between gap-3 z-10 w-full">
											<div class="flex items-center gap-4 flex-1 min-w-0">
												<div class="w-12 h-12 rounded-[16px] bg-amber-400/10 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
													<span class="material-symbols-outlined text-amber-400 text-[26px]">star</span>
												</div>
												<div class="flex flex-col text-start min-w-0">
													<h4 class="text-[15px] font-black text-white truncate">{t('valuation.pay_stars_title') || 'Pay with Stars'}</h4>
													<span class="text-[11px] font-medium text-white/50 mt-0.5 truncate">{t('valuation.pay_stars_desc') || 'Instant Telegram Payment'}</span>
												</div>
											</div>
											<div class="px-3.5 py-1.5 rounded-[10px] bg-amber-400/10 border border-amber-400/30 text-amber-400 font-black text-[13px] shrink-0 flex items-center gap-1.5 shadow-sm">
												<span class="material-symbols-outlined text-[16px]">star</span> 49
											</div>
										</div>
									</button>

									{/* Coins Option */}
									<button onClick={handlePayCoins} disabled={isProcessingPayment()} class="w-full relative group overflow-hidden bg-[#08090D] border border-cyan-400/20 hover:border-cyan-400/50 rounded-[24px] p-4.5 text-left transition-all active:scale-[0.98] disabled:opacity-50 shadow-md">
										<div class="absolute -right-6 -top-6 w-24 h-24 bg-cyan-400/10 rounded-full blur-2xl group-hover:bg-cyan-400/20 transition-all pointer-events-none" />
										<div class="relative flex items-center justify-between gap-3 z-10 w-full">
											<div class="flex items-center gap-4 flex-1 min-w-0">
												<div class="w-12 h-12 rounded-[16px] bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center shrink-0 shadow-inner">
													<span class="material-symbols-outlined text-cyan-400 text-[26px]">toll</span>
												</div>
												<div class="flex flex-col text-start min-w-0">
													<h4 class="text-[15px] font-black text-white truncate">{t('valuation.pay_coins_title') || 'Pay with Coins'}</h4>
													<span class="text-[11px] font-medium text-white/50 mt-0.5 truncate">{t('valuation.pay_coins_desc') || 'Use your mined balance'}</span>
												</div>
											</div>
											<div class="px-3.5 py-1.5 rounded-[10px] bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 font-black text-[13px] shrink-0 flex items-center gap-1.5 shadow-sm">
												<span class="material-symbols-outlined text-[16px]">toll</span> 88K
											</div>
										</div>
									</button>

									{/* Community Free Access */}
									<Show when={!freeQuotaUsed()}>
										<div class="w-full bg-[#08090D] border border-emerald-400/20 hover:border-emerald-400/50 rounded-[24px] p-4.5 flex flex-col gap-4 transition-all shadow-md mt-2">
											<div class="flex items-center gap-4">
												<div class="w-12 h-12 rounded-[16px] bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-inner">
													<span class="material-symbols-outlined text-emerald-400 text-[26px]">card_giftcard</span>
												</div>
												<div class="flex-1 flex flex-col text-start min-w-0">
													<h4 class="text-[15px] font-black text-white truncate">{t('valuation.free_channel_group_title') || 'Community Access'}</h4>
													<span class="text-[11px] font-medium text-white/50 mt-0.5 leading-relaxed">{t('valuation.free_channel_group_desc') || '1-Time Free pass for members'}</span>
												</div>
											</div>

											<div class="grid grid-cols-2 gap-2.5 w-full">
												<button onClick={() => openTelegramLink('https://t.me/FragmentsCommunity')} class="h-11 bg-white/5 hover:bg-white/10 border border-white/5 text-emerald-300 font-bold text-[12px] rounded-[14px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
													<span class="material-symbols-outlined text-[18px]">podcasts</span> {t('valuation.join_channel_btn') || 'CHANNEL'}
												</button>
												<button onClick={() => openTelegramLink('https://t.me/FragmentInvestors')} class="h-11 bg-white/5 hover:bg-white/10 border border-white/5 text-emerald-300 font-bold text-[12px] rounded-[14px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
													<span class="material-symbols-outlined text-[18px]">groups</span> {t('valuation.join_group_btn') || 'GROUP'}
												</button>
											</div>

											<button onClick={handleVerifyFreeAccess} disabled={isProcessingPayment()} class="w-full h-14 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-black font-black text-[13px] tracking-widest uppercase rounded-[16px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(52,211,153,0.3)] active:scale-95 transition-all disabled:opacity-50">
												<Show when={isProcessingPayment()} fallback={<><span class="material-symbols-outlined text-[20px]">verified</span>{t('valuation.verify_membership_btn') || 'VERIFY & ANALYZE'}</>}>
													<div class="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
												</Show>
											</button>
										</div>
									</Show>
								</div>

								<Show when={isProcessingPayment()}>
									<div class="absolute inset-0 bg-[#12141C]/90 backdrop-blur-md z-30 flex flex-col items-center justify-center rounded-t-[32px]">
										<span class="w-12 h-12 border-4 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin mb-4 shadow-[0_0_15px_#3390ec]" />
										<span class="text-[14px] font-black uppercase tracking-widest text-white animate-pulse">PROCESSING...</span>
									</div>
								</Show>
							</Motion.div>
						</Motion.div>
					</Show>
				</div>
			</Show>
		</Show>
	);
};

export default UsernamePage;
