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
import { isRtl, t } from '@/shared/i18n/index.js';
import { layaT, USERNAME_I18N } from '@/shared/i18n/laya-i18n.js';
import { cloudStorage } from '@/shared/lib/cloud-storage.js';
import { haptic } from '@/shared/lib/haptic.js';
import {
	getCachedReport,
	getRecentReports,
	type RecentReport,
	saveReport,
} from '@/shared/lib/report-cache.js';
import { shareToStory } from '@/shared/lib/telegram-native.js';
import {
	FragHandle,
	FragKV,
	FragNftTile,
	FragStatusPill,
	normalizeFragStatus,
	primaryMintFloorTon,
	TonAmount,
	TonIcon,
} from '@/shared/ui/fragment/FragmentPrimitives.js';
import { UnifiedPaywallGate } from '@/widgets/paywall/index.js';
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
		total_est_value_ton?: number;
		total_est_value_usd?: number;
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
		peer_type?: string;
		bio?: string;
		members_count?: number;
		verified?: boolean;
	};
	structure: {
		has_digits: boolean;
		letters_only: boolean;
		has_underscore: boolean;
		is_pronounceable?: boolean;
		is_palindrome?: boolean;
	};
	seo: { score: number; verdict: string };
	liquidity_rating?: string;
	estimated_sell_time?: string;
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
		fragment_url: string;
		getgems_url?: string;
		telegram_url: string;
		nft_image_url?: string;
		checked_at: string;
	};
	quality_grade?: string;
	percentile_rank?: number;
	risk_audit?: {
		has_homoglyph_risk: boolean;
		homoglyph_message?: string;
		is_scam_or_fake: boolean;
		has_trademark_risk: boolean;
		trademark_detail?: string;
	};
	ton_dns_domain?: {
		domain: string;
		exists: boolean;
		nftAddress?: string;
		ownerAddress?: string;
	};
	transaction_economics?: {
		net_payout_ton: number;
		net_payout_usd: number;
		fragment_fee_ton: number;
		fragment_fee_pct: number;
		min_bid_ton: number;
		bid_step_ton: number;
	};
	investment_grade: string;
	comparables: { username: string; price: number; date: string; tonviewer_url?: string }[];
	status?: string;
	telegram_status?: string;
	fragment_market_status?: string;
	target_buyer_profile?: string;
	empirical_band?: {
		p10_ton: number;
		p50_ton: number;
		p90_ton: number;
		p10_usd: number;
		p50_usd: number;
		p90_usd: number;
	};
	brandability: number;
	trademark_risk?: {
		risk_level?: string;
		severity?: string;
		matched_entity?: string;
		brand?: string;
		advisory_warning?: string;
		advisory_warnings?: Record<string, string>;
		risk_score?: number;
	};
	seller_hold_conviction?: {
		owner_balance_ton: number;
		is_whale_holder: boolean;
		hold_conviction_score: number;
		reservation_multiplier: number;
		seller_reservation_ton: number;
		negotiation_stance: string;
	};
	laya_system_one?: {
		total_score?: number;
		phonetic_score?: number;
		ergonomic_score?: number;
		cultural_resonance?: string;
		target_entity_fit?: string;
		commercial_intent?: number;
		trademark_risk_level?: string;
		seizure_risk?: number;
		liquidity_speed?: string;
		buyer_archetype?: string;
		bidding_war_potential?: number;
		auction_tactics?: string;
		confidence?: number;
		system_one_verdict?: string;
		tags?: string[];
	};
	homoglyph_spoofing_matrix?: {
		confusable_count: number;
		visual_entropy_risk: string;
		defense_score: number;
		spoofing_vectors?: string[];
		active_collision_risk?: string;
		twins?: HomoglyphTwin[];
	};
	homoglyph_twins?: HomoglyphTwin[];
	telemint_provenance?: TelemintProvenance;
	binary_forensics?: BinaryForensicsDto;
	fragment_capabilities?: FragmentCapabilitiesDto;
}

export interface BinaryForensicsDto {
	ascii_hex_payload?: string;
	ascii_hex_spaced: string;
	raw_hex_payload: string;
	byte_length: number;
	total_bits: number;
	set_bits_popcount: number;
	zero_bits_count: number;
	hamming_weight_density?: number;
	hamming_weight_pct: number;
	shannon_entropy_bits: number;
	max_theoretical_entropy_bits: number;
	normalized_entropy?: number;
	unique_chars_count: number;
	hand_alternation_pct: number;
	left_hand_keys: number;
	right_hand_keys: number;
	fitts_index_bits?: number;
	fitts_ergonomic_score?: number;
	optical_kerning_symmetry?: number;
	viterbi_tokens?: string[];
	viterbi_coverage?: number;
	tep62_index_sha256?: string;
	tep62_sha256_index?: string;
	tvm_boc_cell_hex?: string;
	telemint_token_cell_boc: string;
	boc_magic_prefix: string;
	cell_descriptor_d1_hex?: string;
	cell_descriptor_d2_hex?: string;
	crc32c_checksum_hex?: string;
	tep81_dns_internal_hex?: string;
	ton_dns_resolve_method_id?: string;
	collection_address?: string;
	ton_dns_category_keys: Record<string, string>;
	bitstream_matrix: string[];
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
	verification_status?: string;
}

export interface HomoglyphTwin {
	twin: string;
	status: string;
	price_ton?: number;
	risk_level: string;
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
}

type ReportTab = 'valuation' | 'similar' | 'onchain';

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
	const [quickQuery, setQuickQuery] = createSignal<string>('');

	const [accessGranted, setAccessGranted] = createSignal<boolean>(false);
	const [lastOrderPayload, _setLastOrderPayload] = createSignal<string>('');
	const [isProcessingPayment, setIsProcessingPayment] = createSignal<boolean>(false);
	const [paymentPending, setPaymentPending] = createSignal<boolean>(false);
	const [pollingStatus, _setPollingStatus] = createSignal<string>('');
	const [paymentError, setPaymentError] = createSignal<string>('');

	const [searchTerm, setSearchTerm] = createSignal<string>('');
	const [verificationData, setVerificationData] = createSignal<UsernameVerificationResult | null>(
		null,
	);
	const [similarFilter, setSimilarFilter] = createSignal<
		'all' | 'live_fragment' | 'semantic' | 'structural'
	>('all');
	const [recents, setRecents] = createSignal<RecentReport[]>([]);

	const navigate = useNavigate();
	const username = () => (searchParams.u || '').replace(/^@/, '').toLowerCase().trim();

	let hiddenCardRef: HTMLDivElement | undefined;
	let pollIntervalId: any = null;

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
		try {
			haptic.impact('light');
		} catch {}
		navigate(`/username/report?u=${encodeURIComponent(clean)}`);
	};

	const shortAddr = (addr?: string) => {
		if (!addr) return '—';
		if (addr.length <= 16) return addr;
		return `${addr.slice(0, 8)} … ${addr.slice(-8)}`;
	};

	const triggerAlert = (msg: string) => {
		const tg = (window as any).Telegram?.WebApp;
		if (tg?.showAlert) tg.showAlert(msg);
	};

	const grantAccess = (
		method: 'free' | 'stars' | 'coins' | 'pro' | 'credit',
		targetUser: string,
	) => {
		try {
			localStorage.setItem(`val_access_${targetUser}`, method);
		} catch {}
		setAccessGranted(true);
		setPaymentPending(false);
		fetchValuation(targetUser);
	};

	const applyReport = (res: ValuationResult) => {
		setData(res);
		setRecents(getRecentReports());
	};

	const fetchValuation = async (u: string, opts: { force?: boolean } = {}) => {
		if (!u) return;

		if (!opts.force) {
			const cached = getCachedReport<ValuationResult>(u);
			const hasModernCategories = cached?.similar?.some(
				(s) =>
					s.category === 'live_fragment' ||
					s.category === 'semantic' ||
					s.category === 'structural',
			);
			if (cached && hasModernCategories) {
				applyReport(cached);
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
				applyReport(res);
			} else {
				setError(t('valuation.err_meta') || 'Failed to fetch metadata');
			}
		} catch (err: any) {
			if (err?.response?.status === 403 || err?.status === 403) {
				try {
					localStorage.removeItem(`val_access_${u}`);
				} catch {}
				setAccessGranted(false);
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

	const handleUnlockWithCredit = async () => {
		const u = username();
		if (!u || isProcessingPayment() || paymentPending()) return;
		setIsProcessingPayment(true);
		setPaymentError('');
		try {
			await creditsApi.consumeCredit('username', u);
			try {
				haptic.notify('success');
			} catch {}
			grantAccess('credit', u);
		} catch (e: any) {
			setPaymentError(
				e?.response?.data?.error ||
					e?.message ||
					t('valuation.payment_failed') ||
					'Failed to unlock valuation',
			);
			try {
				haptic.notify('error');
			} catch {}
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
					text: `@${u} valuation on iFragment`,
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
		try {
			backButton.show();
			const off = backButton.onClick(() => {
				try {
					haptic.impact('light');
				} catch {}
				window.history.back();
			});
			onCleanup(() => {
				off();
				try {
					backButton.hide();
				} catch {}
			});
		} catch {}
	});

	const fetchVerification = async (target: string) => {
		if (!target) return;
		try {
			const res = await apiFetch<UsernameVerificationResult>(
				`/usernames/verify?u=${encodeURIComponent(target.replace(/^@/, ''))}`,
			);
			if (res) setVerificationData(res);
		} catch {}
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
				setAccessGranted(true);
				applyReport(cached);
				setLoading(false);
				return;
			}

			setLoading(true);
			setError(null);

			if (localStorage.getItem('val_free_used') !== 'true') {
				cloudStorage.getItem('val_free_used').then((val) => {
					if (val === 'true') localStorage.setItem('val_free_used', 'true');
				});
			}

			try {
				const res = await valuationApi.checkAccess(u);
				if (res?.free_quota_used) {
					localStorage.setItem('val_free_used', 'true');
					cloudStorage.setItem('val_free_used', 'true');
				}
				if (res?.has_access) {
					const method = res.method || (res.is_pro ? 'pro' : 'stars');
					try {
						localStorage.setItem(`val_access_${u}`, method);
					} catch {}
					setAccessGranted(true);
					fetchValuation(u, { force: !hasModernCategories });
				} else {
					try {
						localStorage.removeItem(`val_access_${u}`);
					} catch {}
					setAccessGranted(false);
					setLoading(false);
				}
			} catch {
				try {
					localStorage.removeItem(`val_access_${u}`);
				} catch {}
				setAccessGranted(false);
				setLoading(false);
			}
		};
		initValuation();
	});

	const expectedTon = () => parseFloat(data()?.expected_ton || '0');
	const lowTon = () => parseFloat(data()?.low_ton || '0');
	const highTon = () => parseFloat(data()?.high_ton || '0');

	const fmtTon = (value?: number | string | null) => {
		const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
		if (!Number.isFinite(n)) return '0';
		return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};
	const fmtUsd = (value?: number | string | null) => {
		const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
		if (!Number.isFinite(n)) return '0';
		return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const filteredSimilar = createMemo(() => {
		const list = data()?.similar || [];
		const f = similarFilter();
		if (f === 'live_fragment') return list.filter((i) => i.category === 'live_fragment');
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

	const resolvedStatus = createMemo(() =>
		normalizeFragStatus(
			data()?.live_market?.status ||
				data()?.fragment_market_status ||
				data()?.status ||
				verificationData()?.telegram_status,
		),
	);

	return (
		<div
			class="min-h-screen frag-canvas text-white font-frag-sans pb-32 select-none relative overflow-x-hidden w-full"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Authentic Fragment.com Adaptive Detail Header (.tm-header) */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<div class="flex items-center gap-2 shrink-0">
					<button
						type="button"
						onClick={() => navigate('/')}
						class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity cursor-pointer"
					>
						<TonIcon size={20} color="#4db2ff" />
						<span class="text-[15px] font-bold tracking-[0.04em] hidden xs:inline" dir="ltr">
							FRAGMENT
						</span>
					</button>
				</div>

				{/* Compact Header Search Box (just like fragment.com/username/guess) */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (quickQuery().trim().length >= 4) openReport(quickQuery());
					}}
					class="flex-1 max-w-[300px] h-8 bg-[#242e38] hover:bg-[#293440] focus-within:bg-[#293440] rounded-[6px] px-2.5 flex items-center gap-1.5 transition-colors"
					dir="ltr"
				>
					<span class="material-symbols-outlined text-[16px] text-[#8a98a6]">search</span>
					<input
						type="text"
						value={quickQuery()}
						onInput={(e) => setQuickQuery(e.currentTarget.value.replace(/^@/, '').toLowerCase())}
						placeholder={t('fragUi.searchUsernamesPh')}
						class="flex-1 min-w-0 bg-transparent text-[12.5px] font-medium text-white placeholder:text-[#8a98a6] focus:outline-none"
						autocomplete="off"
						autocapitalize="off"
						spellcheck={false}
					/>
				</form>

				<button
					type="button"
					onClick={() => navigate('/collection-info')}
					class="h-8 px-2.5 rounded-[6px] bg-[#293440] hover:bg-[#384553] text-white text-[12px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
				>
					<span class="material-symbols-outlined text-[15px] text-[#4db2ff]">table_chart</span>
					<span class="hidden sm:inline">{t('home.collectionInfo')}</span>
				</button>
			</header>

			<div class="w-full max-w-[520px] mx-auto px-4 pt-5 flex flex-col gap-4 relative z-10">
				<Show
					when={!loading()}
					fallback={
						<div class="frag-card p-10 flex flex-col items-center justify-center gap-3 text-center my-6">
							<div class="w-8 h-8 border-2 border-[#4db2ff]/25 border-t-[#4db2ff] rounded-full animate-spin" />
							<span class="text-[13px] font-semibold text-white">
								{t('valuation.analyzing') || 'Analyzing handle…'}
							</span>
							<span class="text-[12px] text-[#8794a1]">{t('valuation.onChainIntel')}</span>
						</div>
					}
				>
					<Show
						when={!error()}
						fallback={
							<div class="frag-card p-6 flex flex-col items-center justify-center text-center gap-3 my-6">
								<span class="material-symbols-outlined text-[32px] text-[#ff5863]">error</span>
								<h1 class="text-[17px] font-semibold text-white">
									{t('valuation.error_title') || 'Appraisal unavailable'}
								</h1>
								<p class="text-[13px] text-[#8794a1] max-w-xs">{error()}</p>
								<button
									type="button"
									onClick={() => window.history.back()}
									class="frag-btn-secondary h-10 px-6 text-[13px] font-semibold"
								>
									{t('valuation.back') || 'Back'}
								</button>
							</div>
						}
					>
						<Show
							when={username()}
							fallback={
								/* Mode A: Clean Username Search Hub when no ?u= param */
								<div class="w-full flex flex-col gap-4 pt-2">
									<div class="text-center flex flex-col items-center">
										<h1 class="text-[22px] font-semibold text-white mb-1.5">
											{layaT(USERNAME_I18N.radarTitle)}
										</h1>
										<p class="text-[13px] text-[#8794a1] max-w-[360px]">
											{layaT(USERNAME_I18N.radarDesc)}
										</p>
									</div>

									<div class="bg-[#242e38] rounded-[8px] p-1.5 flex items-center gap-1.5" dir="ltr">
										<span class="pl-2.5 text-[16px] font-semibold text-[#4db2ff]">@</span>
										<input
											type="text"
											value={searchTerm()}
											onInput={(e) =>
												setSearchTerm(e.currentTarget.value.replace(/^@/, '').toLowerCase().trim())
											}
											onKeyDown={(e) => {
												if (e.key === 'Enter' && searchTerm().length >= 4) {
													openReport(searchTerm());
												}
											}}
											placeholder={layaT(USERNAME_I18N.inputPlaceholder)}
											class="flex-1 bg-transparent text-white font-mono text-[14px] font-semibold placeholder:text-[#8a98a6] focus:outline-none py-1.5"
										/>
										<button
											type="button"
											disabled={searchTerm().length < 4}
											onClick={() => openReport(searchTerm())}
											class="frag-btn-primary h-9 px-4 text-[13px] font-semibold disabled:opacity-40"
										>
											{t('hero.smartSearchBtn')}
										</button>
									</div>

									<Show when={recents().length > 0}>
										<div class="frag-table-container">
											<div class="frag-table-header px-3.5 py-2 flex items-center justify-between">
												<span>{t('fragUi.recentAppraisals')}</span>
												<span>{t('fragUi.estimatedValue')}</span>
											</div>
											<For each={recents().slice(0, 6)}>
												{(r) => (
													<button
														type="button"
														onClick={() => openReport(r.username)}
														class="frag-table-row w-full px-3.5 py-2.5 flex items-center justify-between text-start cursor-pointer"
													>
														<FragHandle handle={r.username} size="sm" subline />
														<TonAmount
															value={r.expectedTon || '—'}
															usd={r.expectedUsd}
															size="sm"
															class="items-end"
														/>
													</button>
												)}
											</For>
										</div>
									</Show>
								</div>
							}
						>
							{/* Mode B: Authentic Fragment.com Item Detail Page (like guess.t.me) */}
							<div class="w-full flex flex-col gap-3.5">
								{/* Top Title Row: handle.t.me + Status Pill on left, Subscribe/Actions on right */}
								<div class="flex items-center justify-between gap-2 flex-wrap">
									<div class="flex items-center gap-2.5 min-w-0" dir="ltr">
										<h1 class="text-[22px] sm:text-[24px] font-bold text-white tracking-[-0.015em] truncate">
											{username()}.t.me
										</h1>
										<FragStatusPill status={resolvedStatus()} />
									</div>

									<div class="flex items-center gap-3 shrink-0">
										<Show when={accessGranted() && data()}>
											<button
												type="button"
												disabled={refreshing()}
												onClick={() => fetchValuation(username(), { force: true })}
												class="text-[13px] font-semibold text-[#4db2ff] hover:underline flex items-center gap-1 cursor-pointer"
											>
												<span
													class={`material-symbols-outlined text-[15px] ${
														refreshing() ? 'animate-spin' : ''
													}`}
												>
													refresh
												</span>
												<span>{t('common.retry')}</span>
											</button>
										</Show>
										<a
											href={`https://fragment.com/username/${username()}`}
											target="_blank"
											rel="noreferrer"
											class="text-[13px] font-semibold text-[#4db2ff] hover:underline flex items-center gap-0.5"
										>
											<span>Fragment</span>
											<span class="material-symbols-outlined text-[14px]">north_east</span>
										</a>
									</div>
								</div>

								{/* Locked vs Unlocked State */}
								<Show
									when={accessGranted() && data()}
									fallback={
										<div class="space-y-3.5">
											{/* Clean Fragment Key-Value Metadata Card before unlock */}
											<div class="frag-table-container">
												<FragKV
													label={t('fragUi.telegramUsername')}
													copyValue={`@${username()}`}
													accent
												>
													@{username()}
												</FragKV>
												<FragKV
													label={t('fragUi.webAddress')}
													href={`https://t.me/${username()}`}
													accent
												>
													t.me/{username()}
												</FragKV>
												<FragKV
													label={t('fragUi.tonWeb3Address')}
													href={`https://${username()}.t.me`}
													accent
												>
													{username()}.t.me
												</FragKV>
												<FragKV label={t('fragUi.lengthTier')}>
													{username().length} {layaT(USERNAME_I18N.charsLabel)} ·{' '}
													{primaryMintFloorTon(username().length)} TON
												</FragKV>
											</div>

											<UnifiedPaywallGate
												vertical="username"
												targetTitle={`@${username()}`}
												targetSubtitle={`${username()}.t.me · ${username().length} chars`}
												targetIcon="alternate_email"
												onUnlock={handleUnlockWithCredit}
												unlocking={isProcessingPayment()}
												error={paymentError() || null}
												lastOrderPayload={lastOrderPayload()}
												paymentPending={paymentPending()}
												pollingStatus={pollingStatus()}
											/>
										</div>
									}
								>
									{(d) => (
										<>
											{/* 1. Primary Fragment Bid / Valuation Summary Card (#212a33, 8px radius) */}
											<div class="frag-table-container">
												<div class="frag-table-header grid grid-cols-3 px-3.5 py-2">
													<span>{t('valuation.low') || 'Low / Floor'}</span>
													<span>{t('valuation.expected_price') || 'Fair Value'}</span>
													<span class="text-end">{t('valuation.high') || 'High / Ceiling'}</span>
												</div>
												<div class="grid grid-cols-3 px-3.5 py-3.5 items-start gap-2">
													<TonAmount value={fmtTon(lowTon())} usd={fmtUsd(d().low_usd)} size="md" />
													<TonAmount
														value={fmtTon(expectedTon())}
														usd={fmtUsd(d().expected_usd)}
														size="lg"
														tone="positive"
													/>
													<div class="flex justify-end">
														<TonAmount
															value={fmtTon(highTon())}
															usd={fmtUsd(d().high_usd)}
															size="md"
															class="items-end"
														/>
													</div>
												</div>
												<div class="px-3.5 py-2.5 border-t border-[#1a2026] flex items-center justify-between text-[12px] text-[#8c9aa9]">
													<span>
														{t('fragUi.confidenceLabel')}{' '}
														<strong class="text-white">{d().confidence_score}%</strong>
													</span>
													<span>
														{t('fragUi.tier')}:{' '}
														<strong class="text-[#5aec8c]">
															{d().quality_grade || d().investment_grade || 'A'}
														</strong>
													</span>
													<span>
														{t('fragUi.compsLabel')}{' '}
														<strong class="text-white">{d().comparable_sales_count}</strong>
													</span>
												</div>
											</div>

											{/* Primary Action Buttons (Exact Fragment #248bda style) */}
											<div class="grid grid-cols-2 gap-2">
												<a
													href={
														d().live_market?.fragment_url ||
														`https://fragment.com/username/${username()}`
													}
													target="_blank"
													rel="noreferrer"
													class="frag-btn-primary h-10 px-4 rounded-[8px] text-[13.5px] font-semibold flex items-center justify-center gap-1.5"
												>
													<span>{t('fragUi.viewOnFragment')}</span>
													<span class="material-symbols-outlined text-[15px]">north_east</span>
												</a>

												<button
													type="button"
													disabled={sharing() || downloading()}
													onClick={handleShareToStory}
													class="frag-btn-secondary h-10 px-4 rounded-[8px] text-[13.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
												>
													<span class="material-symbols-outlined text-[16px] text-[#4db2ff]">
														ios_share
													</span>
													<span>
														{sharing()
															? t('valuation.sharing') || 'Sharing…'
															: t('valuation.share_story') || 'Share Story'}
													</span>
												</button>
											</div>

											{/* 2. Fragment Key-Value Metadata Card (.tm-list) */}
											<div class="frag-table-container">
												<FragKV
													label={t('fragUi.telegramUsername')}
													copyValue={`@${d().username || username()}`}
													accent
												>
													@{d().username || username()}
												</FragKV>
												<FragKV
													label={t('fragUi.webAddress')}
													href={`https://t.me/${d().username || username()}`}
													accent
												>
													t.me/{d().username || username()}
												</FragKV>
												<FragKV
													label={t('fragUi.tonWeb3Address')}
													href={`https://${d().username || username()}.t.me`}
													accent
												>
													{d().username || username()}.t.me
												</FragKV>
												<Show
													when={d().live_market?.current_bid_ton || d().live_market?.buy_now_ton}
												>
													<FragKV label={t('fragUi.currentBid')}>
														<TonAmount
															value={fmtTon(
																d().live_market?.buy_now_ton || d().live_market?.current_bid_ton,
															)}
															usd={fmtUsd(
																d().live_market?.buy_now_usd || d().live_market?.current_bid_usd,
															)}
															size="sm"
														/>
													</FragKV>
												</Show>
												<Show
													when={
														d().telemint_provenance?.real_owner_address ||
														d().live_market?.owner_address ||
														d().history?.owner_address
													}
												>
													{(ownerAddr) => (
														<FragKV
															label={t('fragUi.ownerWallet')}
															copyValue={ownerAddr()}
															href={`https://tonviewer.com/${ownerAddr()}`}
															accent
														>
															<span class="font-mono">{shortAddr(ownerAddr())}</span>
														</FragKV>
													)}
												</Show>
											</div>

											{/* 3. Clean 3-Tab Fragment Section Navigation */}
											<div class="flex items-center border-b border-[#293440] gap-5 px-1 pt-1">
												<For
													each={
														[
															{ id: 'valuation', label: t('numReportPage.valuation') },
															{
																id: 'similar',
																label: `${t('numReportPage.patternPeers')} (${d().similar?.length || 0})`,
															},
															{ id: 'onchain', label: t('numReportPage.onChain') },
														] as const
													}
												>
													{(tab) => {
														const active = () => activeTab() === tab.id;
														return (
															<button
																type="button"
																onClick={() => {
																	try {
																		haptic.selection();
																	} catch {}
																	setActiveTab(tab.id);
																}}
																class={`relative pb-2.5 text-[13.5px] font-semibold transition-colors cursor-pointer ${
																	active() ? 'text-white' : 'text-[#8c9aa9] hover:text-white'
																}`}
															>
																<span>{tab.label}</span>
																<Show when={active()}>
																	<span class="absolute inset-x-0 bottom-0 h-[3px] bg-[#248bda] rounded-t-[3px]" />
																</Show>
															</button>
														);
													}}
												</For>
											</div>

											{/* TAB 1: VALUATION & ECONOMICS */}
											<Show when={activeTab() === 'valuation'}>
												<div class="space-y-3.5">
													{/* Empirical Band & Transaction Economics */}
													<div class="frag-table-container">
														<div class="frag-table-header px-3.5 py-2">
															<span>{t('fragUi.valuationBreakdown')}</span>
														</div>
														<Show when={d().empirical_band}>
															{(band) => (
																<>
																	<FragKV label={t('fragUi.p10ConservativeFloor')}>
																		<TonAmount
																			value={fmtTon(band().p10_ton)}
																			usd={fmtUsd(band().p10_usd)}
																			size="sm"
																		/>
																	</FragKV>
																	<FragKV label={t('fragUi.p50FairMedian')}>
																		<TonAmount
																			value={fmtTon(band().p50_ton)}
																			usd={fmtUsd(band().p50_usd)}
																			size="sm"
																			tone="positive"
																		/>
																	</FragKV>
																	<FragKV label={t('fragUi.p90StrategicCeiling')}>
																		<TonAmount
																			value={fmtTon(band().p90_ton)}
																			usd={fmtUsd(band().p90_usd)}
																			size="sm"
																		/>
																	</FragKV>
																</>
															)}
														</Show>
														<Show when={d().transaction_economics}>
															{(econ) => (
																<>
																	<FragKV label={layaT(USERNAME_I18N.netSellerProceeds)}>
																		<TonAmount
																			value={fmtTon(econ().net_payout_ton)}
																			usd={fmtUsd(econ().net_payout_usd)}
																			size="sm"
																		/>
																	</FragKV>
																	<FragKV label={layaT(USERNAME_I18N.fragmentFee)}>
																		<TonAmount value={fmtTon(econ().bid_step_ton)} size="sm" />
																	</FragKV>
																</>
															)}
														</Show>
														<FragKV label={t('fragUi.liquidityExitTime')}>
															{d().liquidity_rating || 'High'} ·{' '}
															{d().estimated_sell_time || '3–7 days'}
														</FragKV>
														<FragKV label={t('fragUi.lexicalBrandScore')}>
															{d().dictionary?.is_word ? 'Dictionary' : 'Brandable'} ·{' '}
															{d().brandability || d().seo?.score || 85}/100
														</FragKV>
													</div>

													{/* Seller Hold Conviction & Market Psychology */}
													<Show when={d().seller_hold_conviction}>
														{(conv) => (
															<div class="frag-table-container">
																<div class="frag-table-header px-3.5 py-2 flex items-center justify-between">
																	<span>{t('fragUi.sellerHoldConviction')}</span>
																	<span class="font-mono text-[#4db2ff]">
																		{conv().hold_conviction_score}/100
																	</span>
																</div>
																<FragKV label={t('fragUi.negotiationLeverage')}>
																	{conv().negotiation_stance}
																</FragKV>
																<FragKV label={t('fragUi.suggestedReservation')}>
																	<TonAmount
																		value={fmtTon(conv().seller_reservation_ton)}
																		size="sm"
																	/>
																</FragKV>
															</div>
														)}
													</Show>

													{/* Laya System-1 6-Axis Cognitive & Cultural Resonance */}
													<Show when={d().laya_system_one}>
														{(laya) => (
															<LayaMultiDimensionalCard
																decision={{
																	...laya(),
																	phonetic_score:
																		laya().phonetic_score ||
																		Math.round((laya().total_score || 78) / 10),
																}}
																username={d().username || username()}
															/>
														)}
													</Show>

													{/* Target Buyer Persona & Outreach Strategy */}
													<TargetBuyerPersonaCard
														username={d().username || username()}
														matchedArchetype={
															d().laya_system_one?.buyer_archetype || d().target_buyer_profile
														}
														detectedPersona={d().laya_system_one?.target_entity_fit}
													/>

													{/* Telegram ToS & Legal Safety Matrix */}
													<TelegramTOSLegalMatrix
														username={d().username || username()}
														trademarkRisk={
															d().trademark_risk ||
															(d().risk_audit?.has_trademark_risk
																? {
																		risk_level: 'high',
																		advisory_warning: d().risk_audit?.trademark_detail,
																	}
																: null)
														}
													/>

													{/* Send Certificate to Telegram Chat */}
													<button
														type="button"
														disabled={downloading()}
														onClick={handleSendToChat}
														class="frag-btn-secondary w-full h-10 rounded-[8px] text-[13px] font-semibold flex items-center justify-center gap-2 cursor-pointer"
													>
														<span class="material-symbols-outlined text-[16px] text-[#4db2ff]">
															{sent() ? 'check_circle' : 'send'}
														</span>
														<span>
															{sent()
																? t('fragUi.sentToTgChat')
																: downloading()
																	? t('fragUi.generatingCert')
																	: t('fragUi.sendValuationCardTg')}
														</span>
													</button>
												</div>
											</Show>

											{/* TAB 2: COMPARABLE SALES TABLE (.tm-table) */}
											<Show when={activeTab() === 'similar'}>
												<div class="space-y-2.5">
													<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
														<For
															each={
																[
																	{ id: 'all', label: layaT(USERNAME_I18N.allFilter) },
																	{ id: 'live_fragment', label: 'Fragment' },
																	{ id: 'semantic', label: layaT(USERNAME_I18N.semanticFilter) },
																	{
																		id: 'structural',
																		label: layaT(USERNAME_I18N.structuralFilter),
																	},
																] as const
															}
														>
															{(f) => (
																<button
																	type="button"
																	onClick={() => setSimilarFilter(f.id)}
																	class={`px-2.5 py-1 rounded-[6px] text-[12px] font-semibold shrink-0 transition-colors cursor-pointer ${
																		similarFilter() === f.id
																			? 'bg-[#248bda] text-white'
																			: 'bg-[#212a33] text-[#8c9aa9] hover:text-white'
																	}`}
																>
																	{f.label}
																</button>
															)}
														</For>
													</div>

													<div class="frag-table-container">
														<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
															<span class="col-span-5">{t('fragUi.username')}</span>
															<span class="col-span-4">{t('fragUi.price')}</span>
															<span class="col-span-3 text-end">{t('fragUi.status')}</span>
														</div>
														<Show
															when={filteredSimilar().length > 0}
															fallback={
																<div class="p-6 text-center text-[13px] text-[#8c9aa9]">
																	{t('fragUi.noComparableHandles')}
																</div>
															}
														>
															<For each={filteredSimilar()}>
																{(item) => (
																	<button
																		type="button"
																		onClick={() => openReport(item.username)}
																		class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
																	>
																		<div class="col-span-5 min-w-0 pr-2">
																			<FragHandle handle={item.username} size="sm" />
																			<span class="block text-[11px] text-[#8c9aa9] truncate mt-0.5">
																				{item.reason}
																			</span>
																		</div>
																		<div class="col-span-4">
																			<Show
																				when={(item.sale_price ?? 0) > 0}
																				fallback={<span class="text-[12px] text-[#8c9aa9]">—</span>}
																			>
																				<TonAmount
																					value={fmtTon(item.sale_price)}
																					usd={
																						item.sale_price_usd
																							? fmtUsd(item.sale_price_usd)
																							: undefined
																					}
																					size="sm"
																				/>
																			</Show>
																		</div>
																		<div class="col-span-3 flex justify-end">
																			<FragStatusPill status={normalizeFragStatus(item.status)} />
																		</div>
																	</button>
																)}
															</For>
														</Show>
													</div>
												</div>
											</Show>

											{/* TAB 3: BID / SALE HISTORY & ON-CHAIN PROVENANCE (Like fragment.com/username/guess) */}
											<Show when={activeTab() === 'onchain'}>
												<div class="space-y-4">
													{/* Bid / Sale History Table */}
													<div>
														<h3 class="text-[16px] font-bold text-white mb-2 px-0.5">
															{t('fragUi.bidSaleHistory')}
														</h3>
														<div class="frag-table-container">
															<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
																<span class="col-span-4">{t('fragUi.price')}</span>
																<span class="col-span-4">{t('fragUi.date')}</span>
																<span class="col-span-4 text-end">{t('fragUi.from')}</span>
															</div>
															<Show
																when={
																	(d().history?.transactions?.length || 0) > 0 ||
																	(d().live_market?.offers?.length || 0) > 0
																}
																fallback={
																	<div class="p-5 text-center text-[13px] text-[#8c9aa9]">
																		{t('fragUi.noOnChainHistory')}
																	</div>
																}
															>
																<For each={d().history?.transactions || []}>
																	{(tx) => (
																		<div class="frag-table-row grid grid-cols-12 items-center px-3.5 py-2.5 text-[12.5px]">
																			<div class="col-span-4">
																				<TonAmount value={fmtTon(tx.sale_price_ton)} size="sm" />
																			</div>
																			<div class="col-span-4 text-[#8c9aa9] truncate">
																				{tx.date}
																			</div>
																			<div
																				class="col-span-4 text-end font-mono text-[#4db2ff] truncate"
																				dir="ltr"
																			>
																				{shortAddr(tx.buyer)}
																			</div>
																		</div>
																	)}
																</For>
															</Show>
														</div>
													</div>

													{/* TeleMint Provenance & Security Table */}
													<div class="frag-table-container">
														<div class="frag-table-header px-3.5 py-2">
															<span>{t('fragUi.telemintProvenance')}</span>
														</div>
														<Show when={d().telemint_provenance?.item_address}>
															{(addr) => (
																<FragKV
																	label={t('fragUi.nftContract')}
																	copyValue={addr()}
																	href={`https://tonviewer.com/${addr()}`}
																	accent
																>
																	<span class="font-mono">{shortAddr(addr())}</span>
																</FragKV>
															)}
														</Show>
														<FragKV label="TON DNS (.ton)">
															{d().ton_dns_domain?.exists
																? `${d().ton_dns_domain?.domain}`
																: `${username()}.ton`}
														</FragKV>
														<FragKV label={t('fragUi.trademarkHomoglyphCheck')}>
															<span
																class={
																	d().risk_audit?.has_trademark_risk ||
																	d().risk_audit?.has_homoglyph_risk ||
																	d().trademark_risk?.risk_level === 'high' ||
																	d().trademark_risk?.risk_level === 'medium'
																		? 'text-[#ff9953]'
																		: 'text-[#5aec8c]'
																}
															>
																{(() => {
																	const tm = d().trademark_risk;
																	const hasTm =
																		d().risk_audit?.has_trademark_risk ||
																		tm?.risk_level === 'high' ||
																		tm?.risk_level === 'medium';
																	if (hasTm) {
																		const brand = tm?.brand || '';
																		const entity = tm?.matched_entity || brand;
																		if (brand) {
																			const sev = (tm?.severity || '').toLowerCase();
																			const tpl =
																				sev === 'exact_match' || tm?.risk_level === 'high'
																					? layaT(USERNAME_I18N.inlineTrademarkExact)
																					: sev === 'tld_squat'
																						? layaT(USERNAME_I18N.inlineTrademarkSquat)
																						: layaT(USERNAME_I18N.inlineTrademarkSubstring);
																			return tpl
																				.replace(/\{brand\}/g, brand)
																				.replace(/\{entity\}/g, entity);
																		}
																		return layaT(USERNAME_I18N.inlineTrademarkGeneric);
																	}
																	if (d().risk_audit?.has_homoglyph_risk) {
																		return layaT(USERNAME_I18N.inlineHomoglyphRisk);
																	}
																	return layaT(USERNAME_I18N.inlineCleanAscii);
																})()}
															</span>
														</FragKV>
													</div>

													{/* TON Binary, TeleMint BOC & Biomechanical Forensics Matrix */}
													<Show when={d().binary_forensics}>
														{(bf) => (
															<div class="frag-table-container" dir="ltr">
																<div class="frag-table-header px-3.5 py-2 flex items-center justify-between">
																	<span>{t('fragUi.tvmBocForensics')}</span>
																	<span class="font-mono text-[#4db2ff]">
																		{bf().boc_magic_prefix || '0xb5ee9c72'}
																	</span>
																</div>
																<FragKV
																	label={t('fragUi.asciiHexPayload')}
																	copyValue={bf().ascii_hex_payload || bf().ascii_hex_spaced}
																>
																	<span class="font-mono text-[#4db2ff]">
																		{bf().ascii_hex_spaced || bf().ascii_hex_payload}
																	</span>
																</FragKV>
																<FragKV label={t('fragUi.bitDensityHamming')}>
																	<span class="font-mono">
																		{bf().set_bits_popcount}/{bf().total_bits} bits (
																		{bf().hamming_weight_pct ??
																			Math.round((bf().hamming_weight_density || 0) * 100)}
																		%)
																	</span>
																</FragKV>
																<FragKV label={t('fragUi.shannonInfoEntropy')}>
																	<span class="font-mono">
																		{bf().shannon_entropy_bits} bits (Norm:{' '}
																		{((bf().normalized_entropy || 0) * 100).toFixed(1)}%)
																	</span>
																</FragKV>
																<FragKV label={t('fragUi.fittsBiomechanics')}>
																	<span class="font-mono text-[#5aec8c]">
																		ID {bf().fitts_index_bits ?? 0.8} bits · Ergo{' '}
																		{Math.round((bf().fitts_ergonomic_score || 0.85) * 100)}/100 ·
																		Alt {bf().hand_alternation_pct}%
																	</span>
																</FragKV>
																<FragKV label={t('fragUi.opticalKerning')}>
																	<span class="font-mono">
																		{Math.round((bf().optical_kerning_symmetry || 0.82) * 100)}% SF
																		Pro
																	</span>
																</FragKV>
																<Show when={(bf().viterbi_tokens?.length || 0) > 0}>
																	<FragKV label={t('fragUi.viterbiSegmentation')}>
																		<span class="font-mono text-[#4db2ff]">
																			{(bf().viterbi_tokens || []).join(' + ')} (
																			{Math.round((bf().viterbi_coverage || 0) * 100)}%)
																		</span>
																	</FragKV>
																</Show>
																<FragKV
																	label="TEP-62 SHA-256 Index"
																	copyValue={bf().tep62_index_sha256 || bf().tep62_sha256_index}
																>
																	<span class="font-mono text-[11px]">
																		{(
																			bf().tep62_index_sha256 ||
																			bf().tep62_sha256_index ||
																			''
																		).slice(0, 20)}
																		…
																	</span>
																</FragKV>
																<Show when={bf().tep81_dns_internal_hex}>
																	<FragKV
																		label={t('fragUi.tep81DnsSlice')}
																		copyValue={bf().tep81_dns_internal_hex}
																	>
																		<span class="font-mono text-[11px] text-[#4db2ff]">
																			{bf().tep81_dns_internal_hex}
																		</span>
																	</FragKV>
																</Show>
																<FragKV
																	label="TVM BOC Cell (CRC32-C)"
																	copyValue={bf().telemint_token_cell_boc || bf().tvm_boc_cell_hex}
																>
																	<span class="font-mono text-[11px] text-[#5aec8c]">
																		{(
																			bf().telemint_token_cell_boc ||
																			bf().tvm_boc_cell_hex ||
																			''
																		).slice(0, 22)}
																		… ({bf().crc32c_checksum_hex || 'CRC32-C'})
																	</span>
																</FragKV>
																<div class="p-3 border-t border-[#1a2026]">
																	<span class="text-[10.5px] font-semibold text-[#8c9aa9] block mb-1.5">
																		{t('fragUi.asciiBitstreamMatrix')}
																	</span>
																	<div class="flex flex-wrap gap-1.5">
																		<For each={bf().bitstream_matrix || []}>
																			{(bits, idx) => (
																				<div class="px-2 py-1 rounded-[5px] bg-[#1a2026] border border-[#293440] font-mono text-[10.5px]">
																					<span class="text-[#4db2ff] font-bold mr-1">
																						{(d().username || username())[idx()] || ''}
																					</span>
																					<span class="text-white">{String(bits)}</span>
																				</div>
																			)}
																		</For>
																	</div>
																</div>
															</div>
														)}
													</Show>

													{/* Homoglyph Spoofing Matrix */}
													<Show
														when={
															(d().homoglyph_spoofing_matrix?.twins || d().homoglyph_twins || [])
																.length > 0
														}
													>
														<div class="frag-table-container">
															<div class="frag-table-header px-3.5 py-2 flex items-center justify-between">
																<span>{t('fragUi.homoglyphTwinMatrix')}</span>
																<Show
																	when={d().homoglyph_spoofing_matrix?.defense_score !== undefined}
																>
																	<span class="font-mono text-[#4db2ff]">
																		{d().homoglyph_spoofing_matrix!.defense_score}/100
																	</span>
																</Show>
															</div>
															<For
																each={
																	d().homoglyph_spoofing_matrix?.twins || d().homoglyph_twins || []
																}
															>
																{(hg) => (
																	<button
																		type="button"
																		onClick={() => openReport(hg.twin)}
																		class="frag-table-row w-full px-3.5 py-2.5 flex items-center justify-between text-start cursor-pointer"
																	>
																		<FragHandle handle={hg.twin} size="sm" />
																		<span class="text-[11.5px] font-mono text-[#ff9953]">
																			{hg.risk_level} · {hg.status}
																		</span>
																	</button>
																)}
															</For>
														</div>
													</Show>

													{/* Owner Portfolio Holdings (if available) */}
													<Show when={(d().portfolio?.items?.length || 0) > 0}>
														<div>
															<h3 class="text-[15px] font-semibold text-white mb-2 px-0.5">
																{t('fragUi.ownerPortfolio')} ({d().portfolio?.total_count || 0})
															</h3>
															<div class="frag-table-container">
																<For each={(d().portfolio?.items || []).slice(0, 6)}>
																	{(pItem) => (
																		<button
																			type="button"
																			onClick={() => openReport(pItem.username)}
																			class="frag-table-row w-full px-3.5 py-2.5 flex items-center justify-between text-start cursor-pointer"
																		>
																			<FragHandle handle={pItem.username} size="sm" />
																			<Show
																				when={pItem.last_sale_ton}
																				fallback={
																					<span class="text-[12px] text-[#8c9aa9]">
																						{pItem.status}
																					</span>
																				}
																			>
																				<TonAmount value={fmtTon(pItem.last_sale_ton)} size="sm" />
																			</Show>
																		</button>
																	)}
																</For>
															</div>
														</div>
													</Show>
												</div>
											</Show>
										</>
									)}
								</Show>
							</div>
						</Show>
					</Show>
				</Show>
			</div>

			{/* Offscreen 400x400 Certificate Card for Telegram Story & Chat Export */}
			<div class="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
				<div
					ref={hiddenCardRef}
					class="w-[400px] h-[400px] bg-[#1a2026] p-6 flex flex-col justify-between text-white font-frag-sans"
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<TonIcon size={20} color="#4db2ff" />
							<span class="text-[15px] font-bold tracking-[0.04em]">FRAGMENT</span>
						</div>
						<span class="px-2.5 py-1 rounded-[4px] bg-[#5aec8c]/10 text-[#5aec8c] text-[12px] font-semibold">
							{t('fragUi.verifiedValuation')}
						</span>
					</div>

					<div class="bg-[#212a33] rounded-[8px] p-5 flex items-center gap-4">
						<FragNftTile handle={username() || 'telegram'} class="w-20 h-20 shrink-0" />
						<div class="min-w-0">
							<div class="text-[24px] font-bold text-white truncate">@{username()}</div>
							<div class="text-[13px] text-[#4db2ff] truncate">{username()}.t.me</div>
						</div>
					</div>

					<div class="bg-[#212a33] rounded-[8px] p-4 grid grid-cols-3 gap-2">
						<div>
							<div class="text-[11px] text-[#8c9aa9]">{t('fragUi.floor')}</div>
							<div class="text-[16px] font-bold text-white mt-0.5">{fmtTon(lowTon())} TON</div>
						</div>
						<div>
							<div class="text-[11px] text-[#8c9aa9]">{t('fragUi.fairValue')}</div>
							<div class="text-[18px] font-bold text-[#5aec8c] mt-0.5">
								{fmtTon(expectedTon())} TON
							</div>
						</div>
						<div class="text-right">
							<div class="text-[11px] text-[#8c9aa9]">{t('fragUi.ceiling')}</div>
							<div class="text-[16px] font-bold text-white mt-0.5">{fmtTon(highTon())} TON</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
