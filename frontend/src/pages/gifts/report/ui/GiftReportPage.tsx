import { A, useNavigate, useSearchParams } from '@solidjs/router';
import { toPng } from 'html-to-image';
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import { giftsApi } from '@/entities/gifts/api/giftsApi.js';
import type {
	ComparableGiftSale,
	CuriosityGateData,
	EnrichedGiftReport,
} from '@/entities/gifts/model/types.js';
import { GiftThumbnail } from '@/entities/gifts/ui/GiftThumbnail.js';
import { isRtl, locale, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { copyToClipboard, shareToStory } from '@/shared/lib/telegram-native.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import {
	FragKV,
	FragStatusPill,
	normalizeFragStatus,
	TonAmount,
	TonIcon,
} from '@/shared/ui/fragment/FragmentPrimitives.js';
import { CreditStoreSheet, UnifiedPaywallGate, useWallet } from '@/widgets/paywall/index.js';
import { GiftExitPlannerCard } from './components/GiftExitPlannerCard.js';
import { GiftLayaActionCard } from './components/GiftLayaActionCard.js';
import { GiftStarsParityCard } from './components/GiftStarsParityCard.js';
import { GiftTraitSynergyCard } from './components/GiftTraitSynergyCard.js';

function formatUsdPlain(val: number | string | undefined | null): string {
	const num = typeof val === 'string' ? Number.parseFloat(val) : (val ?? 0);
	if (!Number.isFinite(num) || num <= 0) return '0';
	if (num >= 100) {
		return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
	}
	return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatTon(val: number | string | undefined | null): string {
	const num = typeof val === 'string' ? Number.parseFloat(val) : (val ?? 0);
	if (!Number.isFinite(num) || num <= 0) return '0';
	if (num >= 100) {
		return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
	}
	return num.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function formatDateLocale(iso?: string): string {
	if (!iso) return '—';
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		const locMap: Record<string, string> = {
			fa: 'fa-IR-u-nu-latn',
			ru: 'ru-RU',
			zh: 'zh-CN',
			en: 'en-US',
		};
		return d.toLocaleDateString(locMap[locale()] || 'en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	} catch {
		return iso;
	}
}

function parseRawGiftInput(raw: string): string {
	let s = raw.trim();
	if (!s) return 'plush_pepe-42';
	s = s.replace(/^https?:\/\/(t\.me\/nft\/|fragment\.com\/gift\/)/i, '');
	s = s.split('?')[0].split('#')[0].trim();
	const match = s.match(/^([A-Za-z0-9_'’-]+?)[-\s#]+(\d+)$/);
	if (match) {
		const rawSlug = match[1]
			.replace(/([a-z])([A-Z])/g, '$1_$2')
			.toLowerCase()
			.replace(/['’]/g, '')
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
		return `${rawSlug}-${match[2]}`;
	}
	return s.toLowerCase().replace(/\s+/g, '_');
}

function splitGiftSlugAndSerial(giftId: string): {
	slug: string;
	serial: number;
	prettyTitle: string;
} {
	const clean = parseRawGiftInput(giftId);
	const dashIdx = clean.lastIndexOf('-');
	if (dashIdx > 0) {
		const slug = clean.slice(0, dashIdx);
		const serial = Number.parseInt(clean.slice(dashIdx + 1), 10) || 1;
		const prettyName = slug
			.split(/[_-]+/)
			.filter(Boolean)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
		return { slug, serial, prettyTitle: `${prettyName} #${serial}` };
	}
	return { slug: clean, serial: 1, prettyTitle: `${clean} #1` };
}

const BENCHMARK_GIFTS = [
	{ id: 'plush_pepe-1', label: 'Plush Pepe #1' },
	{ id: 'plush_pepe-42', label: 'Plush Pepe #42' },
	{ id: 'durovs_cap-1', label: "Durov's Cap #1" },
	{ id: 'heart_locket-7', label: 'Heart Locket #7' },
	{ id: 'loot_bag-88', label: 'Loot Bag #88' },
	{ id: 'swiss_watch-100', label: 'Swiss Watch #100' },
];

type ActiveTab = 'valuation' | 'traits' | 'comps';

export const GiftReportPage = () => {
	const navigate = useNavigate();
	useTelegramBackButton(-1);
	const wallet = useWallet();

	const [searchParams, setSearchParams] = useSearchParams();
	const initialGift = () => {
		const g = searchParams.g;
		const str = Array.isArray(g) ? g[0] : g;
		return str ? parseRawGiftInput(str) : 'plush_pepe-42';
	};

	const [giftQuery, setGiftQuery] = createSignal(initialGift());
	const [searchInput, setSearchInput] = createSignal(initialGift());
	const [report, setReport] = createSignal<EnrichedGiftReport | null>(null);
	const [gate, setGate] = createSignal<CuriosityGateData | null>(null);
	const [isUnlocked, setIsUnlocked] = createSignal(false);
	const [loading, setLoading] = createSignal(true);
	const [unlocking, setUnlocking] = createSignal(false);
	const [simulating, setSimulating] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const [unlockError, setUnlockError] = createSignal<string | null>(null);
	const [storeOpen, setStoreOpen] = createSignal(false);

	const [activeTab, setActiveTab] = createSignal<ActiveTab>('valuation');
	const [watched, setWatched] = createSignal(false);
	const [watchBusy, setWatchBusy] = createSignal(false);
	const [compFilter, setCompFilter] = createSignal<
		'all' | 'exact_model' | 'exact_backdrop' | 'collection_floor'
	>('all');
	const [sharingStory, setSharingStory] = createSignal(false);

	const [simModel, setSimModel] = createSignal<string>('');
	const [simBackdrop, setSimBackdrop] = createSignal<string>('');
	const [simSymbol, setSimSymbol] = createSignal<string>('');

	let heroCardRef: HTMLDivElement | undefined;

	const loadGiftIntelligence = async (targetRaw: string) => {
		const normalized = parseRawGiftInput(targetRaw);
		setLoading(true);
		setError(null);
		setUnlockError(null);

		try {
			const [gateRes, enrichedRes] = await Promise.allSettled([
				giftsApi.getCuriosityGate(normalized),
				giftsApi.getEnrichedReport(normalized),
			]);

			if (gateRes.status === 'fulfilled' && gateRes.value) {
				setGate(gateRes.value);
			}

			if (enrichedRes.status === 'fulfilled' && enrichedRes.value) {
				const r = enrichedRes.value as EnrichedGiftReport & {
					is_unlocked?: boolean;
					requires_unlock?: boolean;
					curiosity_gate?: CuriosityGateData;
				};

				if (r.curiosity_gate && !gate()) {
					setGate(r.curiosity_gate);
				}

				const unlocked =
					r.is_unlocked !== false &&
					r.requires_unlock !== true &&
					Boolean(
						r.pillars ||
							(r.expected_gram && Number.parseFloat(String(r.expected_gram)) > 0) ||
							(Array.isArray(r.trait_dna) && r.trait_dna.length > 0),
					);

				if (unlocked) {
					setReport(r);
					setIsUnlocked(true);
					const mTrait = r.trait_dna?.find((x) => x.axis_key === 'model');
					const bTrait = r.trait_dna?.find((x) => x.axis_key === 'backdrop');
					const sTrait = r.trait_dna?.find((x) => x.axis_key === 'symbol');
					setSimModel(mTrait?.value || r.selected_model || '');
					setSimBackdrop(bTrait?.value || '');
					setSimSymbol(sTrait?.value || '');
				} else {
					setReport(r);
					setIsUnlocked(false);
				}
			} else if (gateRes.status === 'fulfilled' && gateRes.value) {
				setIsUnlocked(false);
			} else {
				const reason =
					enrichedRes.status === 'rejected'
						? (enrichedRes.reason as Error)?.message
						: 'Failed to load gift intelligence';
				setError(reason || 'Failed to load gift intelligence');
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	};

	createEffect(() => {
		const g = searchParams.g;
		const str = Array.isArray(g) ? g[0] : g;
		const normalized = str ? parseRawGiftInput(str) : 'plush_pepe-42';
		if (normalized !== giftQuery()) {
			setGiftQuery(normalized);
			setSearchInput(normalized);
		}
		void loadGiftIntelligence(normalized);
	});

	const handleSearchSubmit = (e?: Event) => {
		e?.preventDefault();
		const normalized = parseRawGiftInput(searchInput());
		if (!normalized) return;
		try {
			haptic.impact('light');
		} catch {}
		setGiftQuery(normalized);
		setSearchInput(normalized);
		setSearchParams({ g: normalized });
	};

	const selectQuickGift = (id: string) => {
		try {
			haptic.selection();
		} catch {}
		setGiftQuery(id);
		setSearchInput(id);
		setSearchParams({ g: id });
	};

	const handleUnlockWithCredit = async () => {
		const target = giftQuery();
		setUnlocking(true);
		setUnlockError(null);
		try {
			const balance = wallet.balance();
			if (balance !== null && balance < 1) {
				setStoreOpen(true);
				setUnlocking(false);
				return;
			}
			const unlocked = await giftsApi.unlockWithCredit(target);
			setReport(unlocked as EnrichedGiftReport);
			setIsUnlocked(true);
			const mTrait = unlocked.trait_dna?.find((x) => x.axis_key === 'model');
			const bTrait = unlocked.trait_dna?.find((x) => x.axis_key === 'backdrop');
			const sTrait = unlocked.trait_dna?.find((x) => x.axis_key === 'symbol');
			setSimModel(mTrait?.value || unlocked.selected_model || '');
			setSimBackdrop(bTrait?.value || '');
			setSimSymbol(sTrait?.value || '');
			wallet.refetch();
			try {
				haptic.notify('success');
			} catch {}
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			if (/insufficient|credit|402/i.test(msg)) {
				setStoreOpen(true);
			} else {
				setUnlockError(msg);
			}
		} finally {
			setUnlocking(false);
		}
	};

	const runTraitSimulation = async (nextM?: string, nextB?: string, nextS?: string) => {
		const m = nextM !== undefined ? nextM : simModel();
		const b = nextB !== undefined ? nextB : simBackdrop();
		const s = nextS !== undefined ? nextS : simSymbol();
		setSimulating(true);
		try {
			const q = new URLSearchParams();
			if (m) q.set('model', m);
			if (b) q.set('backdrop', b);
			if (s) q.set('symbol', s);
			const res = await fetch(
				`/api/v1/gifts/valuate/${encodeURIComponent(giftQuery())}?${q.toString()}`,
			);
			if (res.ok) {
				const updated = (await res.json()) as EnrichedGiftReport;
				if (updated && (updated.pillars || updated.expected_gram)) {
					setReport(updated);
				}
			}
		} catch {
		} finally {
			setSimulating(false);
		}
	};

	const handleToggleWatchlist = async () => {
		const r = report();
		if (!r || watchBusy()) return;
		try {
			haptic.impact('light');
		} catch {}
		setWatchBusy(true);
		const nextState = !watched();
		try {
			await giftsApi.toggleWatchlist(r.gift_id, nextState);
			setWatched(nextState);
		} catch {
			setWatched(nextState);
		} finally {
			setWatchBusy(false);
		}
	};

	const handleShareCertificateStory = async () => {
		if (!heroCardRef || sharingStory()) return;
		try {
			haptic.impact('medium');
		} catch {}
		setSharingStory(true);
		try {
			const dataUrl = await toPng(heroCardRef, {
				quality: 0.96,
				pixelRatio: 2,
				cacheBust: true,
			});
			const title = report()?.display_title || parsedTarget().prettyTitle;
			const fv = formatTon(fairValueTon());
			await shareToStory(dataUrl, {
				text: `${title} — Fair Value: ${fv} TON on @iFragmentBot`,
			});
		} catch {
			void copyToClipboard(window.location.href);
		} finally {
			setSharingStory(false);
		}
	};

	const parsedTarget = createMemo(() => splitGiftSlugAndSerial(giftQuery()));

	const backdropColors = createMemo(() => {
		const r = report();
		if (r?.backdrop_colors) return r.backdrop_colors;
		const bdTrait = r?.trait_dna?.find((x) => x.axis_key === 'backdrop');
		if (bdTrait?.colors) return bdTrait.colors;
		return {
			center_hex: '#293440',
			edge_hex: '#212a33',
			pattern_hex: '#4db2ff',
			text_hex: '#ffffff',
		};
	});

	const modelTrait = createMemo(() => report()?.trait_dna?.find((x) => x.axis_key === 'model'));
	const backdropTrait = createMemo(() =>
		report()?.trait_dna?.find((x) => x.axis_key === 'backdrop'),
	);
	const symbolTrait = createMemo(() => report()?.trait_dna?.find((x) => x.axis_key === 'symbol'));

	const fairValueTon = createMemo(() => {
		const r = report();
		if (!r) return 0;
		return r.pillars?.fair_value_gram || Number.parseFloat(String(r.expected_gram || '0')) || 0;
	});

	const fairValueUsd = createMemo(() => {
		const r = report();
		if (!r) return 0;
		return r.pillars?.fair_value_usd || r.expected_usd || 0;
	});

	const liquidationTon = createMemo(() => {
		const r = report();
		if (!r) return 0;
		return (
			r.pillars?.liquidation_value_gram ||
			Number.parseFloat(String(r.low_gram || '0')) ||
			Math.round(fairValueTon() * 0.9 * 10) / 10
		);
	});

	const suggestedAskTon = createMemo(() => {
		const r = report();
		if (!r) return 0;
		return (
			r.pillars?.suggested_ask_gram ||
			Number.parseFloat(String(r.high_gram || '0')) ||
			Math.round(fairValueTon() * 1.08 * 10) / 10
		);
	});

	const collectionFloorTon = createMemo(() => {
		const r = report();
		if (!r) return 0;
		return (
			r.floor_matrix?.collection_floor_gram ||
			r.pillars?.observed_floor_gram ||
			Number.parseFloat(String(r.base_price_gram || '0')) ||
			0
		);
	});

	const filteredComps = createMemo((): ComparableGiftSale[] => {
		const all = report()?.comps || [];
		const f = compFilter();
		if (f === 'all') return all;
		return all.filter((c) => c.trait_match_type === f);
	});

	const shortAddr = (addr?: string) => {
		if (!addr) return '—';
		if (addr.length <= 16) return addr;
		return `${addr.slice(0, 8)} … ${addr.slice(-8)}`;
	};

	const fragmentGiftSlug = () => {
		const pascal = parsedTarget()
			.slug.split(/[_-]+/)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join('');
		return `${pascal}-${parsedTarget().serial}`;
	};

	return (
		<div
			class="frag-canvas pb-32 text-white min-h-screen relative font-frag-sans overflow-x-clip"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Authentic Fragment.com Sticky Detail Header (.tm-header) */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => navigate('/gifts')}
					class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
				>
					<TonIcon size={20} color="#4db2ff" />
					<span class="text-[15px] font-bold tracking-[0.04em] hidden xs:inline" dir="ltr">
						FRAGMENT
					</span>
				</button>

				{/* Inline Header Gift Search Box */}
				<form
					onSubmit={handleSearchSubmit}
					class="flex-1 max-w-[300px] h-8 bg-[#242e38] hover:bg-[#293440] focus-within:bg-[#293440] rounded-[6px] px-2.5 flex items-center gap-1.5 transition-colors"
					dir="ltr"
				>
					<span class="material-symbols-outlined text-[16px] text-[#8a98a6]">search</span>
					<input
						type="text"
						value={searchInput()}
						onInput={(e) => setSearchInput(e.currentTarget.value)}
						placeholder="PlushPepe-42"
						class="flex-1 min-w-0 bg-transparent text-[12.5px] font-mono font-semibold text-white placeholder:text-[#8a98a6] focus:outline-none"
					/>
					<Show when={searchInput().length > 0}>
						<button
							type="button"
							onClick={() => setSearchInput('')}
							class="text-[#8c9aa9] hover:text-white"
						>
							<span class="material-symbols-outlined text-[14px]">close</span>
						</button>
					</Show>
				</form>

				<A
					href={`/gifts/collection?c=${encodeURIComponent(
						report()?.collection_id || parsedTarget().slug.replace(/_/g, '-'),
					)}`}
					class="h-8 px-2.5 rounded-[6px] bg-[#293440] hover:bg-[#384553] text-white text-[12px] font-semibold flex items-center gap-1 shrink-0 transition-colors"
				>
					<span class="material-symbols-outlined text-[15px] text-[#4db2ff]">grid_view</span>
					<span class="hidden sm:inline">{t('giftReport.collectionBtn')}</span>
				</A>
			</header>

			<div class="max-w-[520px] mx-auto px-4 pt-4 relative z-10 flex flex-col gap-3.5">
				{/* Quick Benchmark Gift Pills */}
				<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5" dir="ltr">
					<For each={BENCHMARK_GIFTS}>
						{(item) => {
							const isActive = () => giftQuery() === item.id;
							return (
								<button
									type="button"
									onClick={() => selectQuickGift(item.id)}
									class={`px-2.5 py-1 rounded-[6px] text-[11.5px] font-mono font-semibold whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
										isActive()
											? 'bg-[#248bda] text-white'
											: 'bg-[#212a33] hover:bg-[#293440] text-[#8c9aa9] hover:text-white'
									}`}
								>
									{item.label}
								</button>
							);
						}}
					</For>
				</div>

				{/* Compact Asset Title Row */}
				<div ref={heroCardRef} class="flex items-center justify-between gap-2 flex-wrap pt-1">
					<div class="flex items-center gap-3 min-w-0">
						<div
							class="w-11 h-11 rounded-[8px] p-1 flex items-center justify-center shrink-0 overflow-hidden"
							style={{
								background: `radial-gradient(circle, ${backdropColors().center_hex}, ${backdropColors().edge_hex})`,
							}}
						>
							<GiftThumbnail
								slug={parsedTarget().slug}
								model={report()?.selected_model || gate()?.selected_model}
								serialNumber={parsedTarget().serial}
								customImageUrl={report()?.image_url || gate()?.image_url}
								name={parsedTarget().prettyTitle}
								size="sm"
							/>
						</div>
						<div class="flex flex-col min-w-0">
							<div class="flex items-center gap-2 flex-wrap" dir="ltr">
								<h1 class="text-[20px] sm:text-[22px] font-bold text-white tracking-[-0.015em] truncate">
									{report()?.display_title || parsedTarget().prettyTitle}
								</h1>
								<FragStatusPill
									status={normalizeFragStatus(
										report()?.custody_type === 'on_chain_nft' ? 'available' : 'taken',
									)}
									label="TEP-62"
								/>
							</div>
							<span class="text-[12px] text-[#8c9aa9] truncate">
								{isUnlocked() && report()
									? `${modelTrait()?.value || report()?.selected_model || 'Original'} · ${backdropTrait()?.value || 'Verified'}`
									: t('giftReport.readyToDecrypt')}
							</span>
						</div>
					</div>

					<div class="flex items-center gap-3 shrink-0">
						<Show when={isUnlocked() && report()}>
							<button
								type="button"
								onClick={handleToggleWatchlist}
								disabled={watchBusy()}
								class="text-[13px] font-semibold text-[#4db2ff] hover:underline flex items-center gap-1 cursor-pointer"
							>
								<span class="material-symbols-outlined text-[16px]">
									{watched() ? 'notifications_active' : 'notifications'}
								</span>
							</button>
						</Show>
						<button
							type="button"
							disabled={loading()}
							onClick={() => void loadGiftIntelligence(giftQuery())}
							class="text-[13px] font-semibold text-[#4db2ff] hover:underline flex items-center gap-1 cursor-pointer"
						>
							<span
								class={`material-symbols-outlined text-[16px] ${loading() ? 'animate-spin' : ''}`}
							>
								refresh
							</span>
						</button>
						<a
							href={`https://t.me/nft/${fragmentGiftSlug()}`}
							target="_blank"
							rel="noreferrer"
							class="text-[13px] font-semibold text-[#4db2ff] hover:underline flex items-center gap-0.5"
						>
							<span>t.me/nft</span>
							<span class="material-symbols-outlined text-[14px]">north_east</span>
						</a>
					</div>
				</div>

				{/* Loading State */}
				<Show when={loading()}>
					<div class="frag-card p-8 flex flex-col items-center justify-center text-center gap-3">
						<div class="w-8 h-8 rounded-full border-2 border-[#4db2ff]/25 border-t-[#4db2ff] animate-spin" />
						<span class="text-[14px] font-semibold text-white" dir="ltr">
							{parsedTarget().prettyTitle}
						</span>
						<span class="text-[12px] text-[#8794a1]">{t('giftReport.scanStep1')}</span>
					</div>
				</Show>

				{/* Error State */}
				<Show when={!loading() && error()}>
					<div class="bg-[#ff5863]/10 rounded-[8px] p-4 text-center flex flex-col items-center gap-2.5">
						<span class="material-symbols-outlined text-[24px] text-[#ff5863]">error</span>
						<p class="text-[12.5px] font-medium text-[#ff5863]">{error()}</p>
						<button
							type="button"
							onClick={() => void loadGiftIntelligence(giftQuery())}
							class="frag-btn-secondary h-9 px-4 text-[12.5px] font-semibold"
						>
							{t('giftReport.tryAgainBtn')}
						</button>
					</div>
				</Show>

				{/* Main Content: Pre-Unlock vs Unlocked */}
				<Show when={!loading() && !error()}>
					<Show
						when={isUnlocked() && report()}
						fallback={
							<div class="space-y-3.5">
								<div class="frag-table-container">
									<FragKV label={t('fragUi.collectibleGift')} accent>
										<span dir="ltr">{parsedTarget().prettyTitle}</span>
									</FragKV>
									<FragKV
										label={t('fragUi.webAddress')}
										href={`https://t.me/nft/${fragmentGiftSlug()}`}
										accent
									>
										t.me/nft/{fragmentGiftSlug()}
									</FragKV>
									<Show when={gate()?.selected_model}>
										<FragKV label={t('giftReport.modelsTab')}>{gate()?.selected_model}</FragKV>
									</Show>
									<Show when={gate()?.floor_price_gram}>
										<FragKV label={t('fragUi.collectionFloor')}>
											<TonAmount value={formatTon(gate()?.floor_price_gram)} size="sm" />
										</FragKV>
									</Show>
								</div>

								<UnifiedPaywallGate
									vertical="gift"
									targetTitle={parsedTarget().prettyTitle}
									targetSubtitle={t('giftReport.paywallTargetSubtitle')}
									targetGiftSlug={parsedTarget().slug}
									targetGiftModel={gate()?.selected_model}
									targetGiftSerial={parsedTarget().serial}
									targetImage={gate()?.image_url}
									targetBadge={t('paywall.ready_for_appraisal') || 'READY FOR APPRAISAL'}
									unlockCtaText={t('giftReport.unlockGiftCta', {
										title: parsedTarget().prettyTitle,
									})}
									onUnlock={handleUnlockWithCredit}
									unlocking={unlocking()}
									error={unlockError()}
								/>
							</div>
						}
					>
						{(rep) => (
							<div class="space-y-3.5">
								{/* 1. Primary 3-Column Fragment Valuation Summary Card (#212a33, 8px radius) */}
								<div class="frag-table-container">
									<div class="frag-table-header grid grid-cols-3 px-3.5 py-2">
										<span>{t('fragUi.liquidation')}</span>
										<span>{t('fragUi.fairValue')}</span>
										<span class="text-end">{t('fragUi.suggestedAsk')}</span>
									</div>
									<div class="grid grid-cols-3 px-3.5 py-3.5 items-start gap-2">
										<TonAmount
											value={formatTon(liquidationTon())}
											usd={formatUsdPlain(
												rep().pillars?.liquidation_value_usd || fairValueUsd() * 0.9,
											)}
											size="md"
										/>
										<TonAmount
											value={formatTon(fairValueTon())}
											usd={formatUsdPlain(fairValueUsd())}
											size="lg"
											tone="positive"
										/>
										<div class="flex justify-end">
											<TonAmount
												value={formatTon(suggestedAskTon())}
												usd={formatUsdPlain(
													rep().pillars?.suggested_ask_usd || fairValueUsd() * 1.08,
												)}
												size="md"
												class="items-end"
											/>
										</div>
									</div>
									<div class="px-3.5 py-2.5 border-t border-[#1a2026] flex items-center justify-between text-[12px] text-[#8c9aa9]">
										<span>
											{t('fragUi.rarity')}:{' '}
											<strong class="text-white">{rep().rarity_score || 85}/100</strong>
										</span>
										<span>
											{t('fragUi.confidenceLabel')}{' '}
											<strong class="text-[#5aec8c]">{rep().confidence_score || 92}%</strong>
										</span>
										<span>
											{t('fragUi.floor')}:{' '}
											<strong class="text-white">{formatTon(collectionFloorTon())} TON</strong>
										</span>
									</div>
								</div>

								{/* Primary Action Buttons */}
								<div class="grid grid-cols-2 gap-2">
									<a
										href={`https://t.me/nft/${fragmentGiftSlug()}`}
										target="_blank"
										rel="noreferrer"
										class="frag-btn-primary h-10 px-4 rounded-[8px] text-[13.5px] font-semibold flex items-center justify-center gap-1.5"
									>
										<span>{t('fragUi.openCollectible')}</span>
										<span class="material-symbols-outlined text-[15px]">north_east</span>
									</a>
									<button
										type="button"
										disabled={sharingStory()}
										onClick={handleShareCertificateStory}
										class="frag-btn-secondary h-10 px-4 rounded-[8px] text-[13.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
									>
										<span class="material-symbols-outlined text-[16px] text-[#4db2ff]">
											ios_share
										</span>
										<span>{t('valuation.share_story') || 'Share Story'}</span>
									</button>
								</div>

								{/* 2. Key-Value Metadata Card (.tm-list) */}
								<div class="frag-table-container">
									<FragKV label={t('fragUi.collectibleGift')} accent>
										<span dir="ltr">{rep().display_title || parsedTarget().prettyTitle}</span>
									</FragKV>
									<FragKV
										label={t('fragUi.webAddress')}
										href={`https://t.me/nft/${fragmentGiftSlug()}`}
										accent
									>
										t.me/nft/{fragmentGiftSlug()}
									</FragKV>
									<FragKV
										label={t('fragUi.fragmentCollectible')}
										href={
											rep().binary_forensics?.fragment_gift_web_uri ||
											rep().binary_forensics?.fragment_url ||
											`https://fragment.com/gift/${parsedTarget().slug.replace(/[_-]+/g, '')}-${parsedTarget().serial}`
										}
										accent
									>
										fragment.com/gift/{parsedTarget().slug.replace(/[_-]+/g, '')}-
										{parsedTarget().serial}
									</FragKV>
									<Show when={modelTrait()}>
										{(mt) => (
											<FragKV
												label={t('giftReport.modelsTab')}
												hint={mt().percentile ? `${mt().percentile}%` : undefined}
											>
												{mt().value}
											</FragKV>
										)}
									</Show>
									<Show when={backdropTrait()}>
										{(bt) => (
											<FragKV
												label={t('giftReport.backdropsTab')}
												hint={bt().percentile ? `${bt().percentile}%` : undefined}
											>
												<span class="inline-flex items-center gap-1.5">
													<span
														class="w-2.5 h-2.5 rounded-full inline-block"
														style={{ 'background-color': backdropColors().center_hex }}
													/>
													<span>{bt().value}</span>
												</span>
											</FragKV>
										)}
									</Show>
									<Show when={symbolTrait()}>
										{(st) => (
											<FragKV
												label={t('giftReport.symbolsTab')}
												hint={st().percentile ? `${st().percentile}%` : undefined}
											>
												{st().value}
											</FragKV>
										)}
									</Show>
									<Show when={rep().owner_wallet?.wallet_address || rep().on_chain?.owner_address}>
										{(addr) => (
											<FragKV
												label={t('fragUi.ownerWallet')}
												copyValue={addr()}
												href={`https://tonviewer.com/${addr()}`}
												accent
											>
												<span class="font-mono">{shortAddr(addr())}</span>
											</FragKV>
										)}
									</Show>
								</div>

								{/* 3. Clean 3-Tab Fragment Section Bar */}
								<div class="flex items-center border-b border-[#293440] gap-5 px-1 pt-1">
									<For
										each={
											[
												{ id: 'valuation', label: '4-Floor Matrix' },
												{ id: 'traits', label: 'Traits & Binary' },
												{ id: 'comps', label: `Recent Sales (${rep().comps?.length || 0})` },
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

								{/* TAB 1: 4-FLOOR MATRIX & ECONOMICS */}
								<Show when={activeTab() === 'valuation'}>
									<div class="space-y-3.5">
										<div class="frag-table-container">
											<div class="frag-table-header px-3.5 py-2">
												<span>{t('fragUi.fourAxisFloorMatrix')}</span>
											</div>
											<FragKV label={t('fragUi.collectionBaseFloor')}>
												<TonAmount value={formatTon(collectionFloorTon())} size="sm" />
											</FragKV>
											<FragKV
												label={`${t('giftReport.modelsTab')} (${modelTrait()?.value || '—'})`}
											>
												<TonAmount
													value={formatTon(
														rep().floor_matrix?.model_floor_gram ||
															modelTrait()?.floor_gram ||
															collectionFloorTon(),
													)}
													size="sm"
												/>
											</FragKV>
											<FragKV
												label={`${t('giftReport.backdropsTab')} (${backdropTrait()?.value || '—'})`}
											>
												<TonAmount
													value={formatTon(
														rep().floor_matrix?.backdrop_floor_gram ||
															backdropTrait()?.floor_gram ||
															collectionFloorTon(),
													)}
													size="sm"
												/>
											</FragKV>
											<FragKV label={t('fragUi.exactComboFairValue')}>
												<TonAmount
													value={formatTon(fairValueTon())}
													usd={formatUsdPlain(fairValueUsd())}
													size="sm"
													tone="positive"
												/>
											</FragKV>
											<FragKV label={t('fragUi.supplySerialEdition')}>
												#{rep().serial_number || parsedTarget().serial} /{' '}
												{(
													rep().binary_forensics?.issued_count ||
													rep().binary_forensics?.total_supply_count ||
													10000
												).toLocaleString('en-US')}
											</FragKV>
										</div>

										<GiftLayaActionCard
											expectedTon={fairValueTon()}
											expectedUsd={fairValueUsd()}
											serialNumber={rep().serial_number}
											modelName={modelTrait()?.value || rep().selected_model}
											isUpgraded={rep().upgrade_info?.is_upgraded}
											isCraftable={rep().crafting_forge?.is_craftable_collection}
											confidenceScore={rep().confidence_score}
											verdict={
												rep().laya_system_one?.action_recommendation ||
												rep().recommendation?.verdict
											}
											summaryFa={
												rep().laya_system_one?.verdict_summary_fa ||
												rep().recommendation?.summary_fa
											}
											summaryEn={
												rep().laya_system_one?.verdict_summary_en ||
												rep().recommendation?.summary_en
											}
										/>

										<GiftExitPlannerCard
											expectedTon={fairValueTon()}
											expectedUsd={fairValueUsd()}
											tonUsdRate={rep().gram_usd_rate}
										/>

										<GiftStarsParityCard
											expectedTon={fairValueTon()}
											tonUsdRate={rep().gram_usd_rate}
											isUpgraded={rep().upgrade_info?.is_upgraded}
											parity={rep().stars_parity}
										/>

										<div class="grid grid-cols-2 gap-2">
											<button
												type="button"
												onClick={() => navigate('/gifts/crafting')}
												class="frag-btn-secondary h-10 px-3 rounded-[8px] text-[12.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
											>
												<span class="material-symbols-outlined text-[16px] text-[#ff9953]">
													local_fire_department
												</span>
												<span>{t('gifts.craftingTitle')}</span>
											</button>
											<button
												type="button"
												onClick={() => navigate('/gifts/portfolio')}
												class="frag-btn-secondary h-10 px-3 rounded-[8px] text-[12.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
											>
												<span class="material-symbols-outlined text-[16px] text-[#5aec8c]">
													account_balance_wallet
												</span>
												<span>{t('gifts.portfolioTitle')}</span>
											</button>
										</div>
									</div>
								</Show>

								{/* TAB 2: TRAIT DNA, SIMULATOR & MTPROTO / TON TEP-62 BINARY FORENSICS */}
								<Show when={activeTab() === 'traits'}>
									<div class="space-y-3.5">
										<div class="frag-table-container">
											<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
												<span class="col-span-4">{t('fragUi.trait')}</span>
												<span class="col-span-5">{t('fragUi.value')}</span>
												<span class="col-span-3 text-end">{t('fragUi.rarity')}</span>
											</div>
											<For each={rep().trait_dna || []}>
												{(tr) => (
													<div class="frag-table-row grid grid-cols-12 items-center px-3.5 py-2.5 text-[13px]">
														<span class="col-span-4 font-semibold text-white capitalize">
															{tr.label_en || tr.axis_key}
														</span>
														<span class="col-span-5 text-[#4db2ff] font-medium truncate">
															{tr.value}
														</span>
														<span class="col-span-3 text-end font-mono text-[12px] text-[#5aec8c]">
															{tr.percentile}%
														</span>
													</div>
												)}
											</For>
										</div>

										<GiftTraitSynergyCard
											baseExpectedTon={fairValueTon()}
											modelName={modelTrait()?.value || rep().selected_model}
											backdropName={backdropTrait()?.value}
											symbolName={symbolTrait()?.value}
											synergyMultiplier={
												rep().laya_system_one?.synergy_multiplier ||
												rep().joint_rarity?.beta_synergy
											}
											synergyScore={
												rep().laya_system_one?.trait_synergy_score
													? rep().laya_system_one!.trait_synergy_score! * 10
													: undefined
											}
											backdropColors={backdropColors()}
										/>

										{/* Minimalist Trait Combo Simulator */}
										<Show when={rep().collection_catalog}>
											{(cat) => (
												<div class="frag-card p-3.5 space-y-3">
													<div class="flex items-center justify-between">
														<span class="text-[13.5px] font-semibold text-white">
															{t('fragUi.simulateTraitCombo')}
														</span>
														<Show when={simulating()}>
															<span class="text-[11.5px] text-[#4db2ff]">
																{t('fragUi.updating')}
															</span>
														</Show>
													</div>

													<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
														<Show when={(cat().models?.length || 0) > 0}>
															<select
																value={simModel()}
																onChange={(e) => {
																	setSimModel(e.currentTarget.value);
																	void runTraitSimulation(
																		e.currentTarget.value,
																		simBackdrop(),
																		simSymbol(),
																	);
																}}
																class="h-9 rounded-[6px] bg-[#242e38] px-2.5 text-[12.5px] font-medium text-white outline-none"
															>
																<For each={cat().models}>
																	{(m) => <option value={m.name}>{m.name}</option>}
																</For>
															</select>
														</Show>

														<Show when={(cat().backdrops?.length || 0) > 0}>
															<select
																value={simBackdrop()}
																onChange={(e) => {
																	setSimBackdrop(e.currentTarget.value);
																	void runTraitSimulation(
																		simModel(),
																		e.currentTarget.value,
																		simSymbol(),
																	);
																}}
																class="h-9 rounded-[6px] bg-[#242e38] px-2.5 text-[12.5px] font-medium text-white outline-none"
															>
																<For each={cat().backdrops}>
																	{(b) => <option value={b.name}>{b.name}</option>}
																</For>
															</select>
														</Show>

														<Show when={(cat().symbols?.length || 0) > 0}>
															<select
																value={simSymbol()}
																onChange={(e) => {
																	setSimSymbol(e.currentTarget.value);
																	void runTraitSimulation(
																		simModel(),
																		simBackdrop(),
																		e.currentTarget.value,
																	);
																}}
																class="h-9 rounded-[6px] bg-[#242e38] px-2.5 text-[12.5px] font-medium text-white outline-none"
															>
																<For each={cat().symbols}>
																	{(s) => <option value={s.name}>{s.name}</option>}
																</For>
															</select>
														</Show>
													</div>
												</div>
											)}
										</Show>

										{/* MTProto Layer 198+, CIEDE2000 Color Science & TON TEP-62/TEP-64 Binary Forensics Card */}
										<Show when={rep().binary_forensics}>
											{(bf) => (
												<div class="frag-table-container" dir="ltr">
													<div class="frag-table-header px-3.5 py-2 flex items-center justify-between">
														<span>{t('fragUi.mtprotoBocForensics')}</span>
														<span class="font-mono text-[#4db2ff]">
															{bf().boc_magic_prefix || '0xb5ee9c72'}
														</span>
													</div>
													<FragKV label={t('fragUi.mtprotoConstructor')}>
														<span class="font-mono text-[#4db2ff]">
															{bf().mtproto_constructor || 'starGiftUnique#5c62d151'}
														</span>
													</FragKV>
													<Show when={bf().mtproto_header_hex}>
														<FragKV
															label={t('fragUi.header24ByteLe')}
															copyValue={bf().mtproto_header_hex}
														>
															<span class="font-mono text-[11px] text-[#5aec8c]">
																{(bf().mtproto_header_hex || '').slice(0, 22)}…
															</span>
														</FragKV>
													</Show>
													<Show when={bf().center_color_bit_stream_24}>
														<FragKV label={t('fragUi.centerRgb24')}>
															<span class="font-mono text-[11px]">
																{bf().center_color_hex} · {bf().center_color_bit_stream_24}
															</span>
														</FragKV>
													</Show>
													<Show when={bf().edge_color_bit_stream_24}>
														<FragKV label={t('fragUi.edgeRgb24')}>
															<span class="font-mono text-[11px]">
																{bf().edge_color_hex} · {bf().edge_color_bit_stream_24}
															</span>
														</FragKV>
													</Show>
													<Show when={bf().ciede2000_model_backdrop !== undefined}>
														<FragKV label="CIEDE2000 ΔE00">
															<span class="font-mono text-[#5aec8c]">
																ΔE00 = {bf().ciede2000_model_backdrop} · Contrast{' '}
																{bf().wcag_contrast_ratio}:1
																{bf().is_monochrome_color_match ? ' · Monochrome' : ''}
															</span>
														</FragKV>
													</Show>
													<Show when={bf().shannon_surprisal_bits !== undefined}>
														<FragKV label={t('fragUi.shannonTraitSurprisal')}>
															<span class="font-mono">
																{bf().shannon_surprisal_bits} bits (P = {bf().joint_probability})
															</span>
														</FragKV>
													</Show>
													<Show when={bf().tep62_item_index_sha256}>
														<FragKV
															label="TEP-62 SHA-256 Index"
															copyValue={bf().tep62_item_index_sha256}
														>
															<span class="font-mono text-[11px]">
																{(bf().tep62_item_index_sha256 || '').slice(0, 20)}…
															</span>
														</FragKV>
													</Show>
													<Show when={bf().tvm_cell_boc_hex}>
														<FragKV
															label="TVM BOC Cell (CRC32-C)"
															copyValue={bf().tvm_cell_boc_hex}
														>
															<span class="font-mono text-[11px] text-[#5aec8c]">
																{(bf().tvm_cell_boc_hex || '').slice(0, 22)}… (
																{bf().crc32c_checksum_hex || 'CRC32-C'})
															</span>
														</FragKV>
													</Show>
													<FragKV
														label="TGS / Lottie"
														href={bf().tgs_sticker_uri || bf().lottie_vector_uri || bf().lottie_url}
														accent
													>
														<span class="font-mono text-[11.5px]">nft.fragment.com/gift/…tgs</span>
													</FragKV>
													<FragKV
														label={t('fragUi.tep64OffChainJson')}
														href={bf().tep64_metadata_uri || bf().metadata_json_url}
														accent
													>
														<span class="font-mono text-[11.5px]">nft.fragment.com/gift/…json</span>
													</FragKV>
												</div>
											)}
										</Show>
									</div>
								</Show>

								{/* TAB 3: COMPARABLE GIFT SALES TABLE (.tm-table) */}
								<Show when={activeTab() === 'comps'}>
									<div class="space-y-2.5">
										<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
											<For
												each={
													[
														{ id: 'all', label: t('giftReport.compAllSales') },
														{ id: 'exact_model', label: t('giftReport.compExactModel') },
														{ id: 'exact_backdrop', label: t('giftReport.compExactBackdrop') },
													] as const
												}
											>
												{(f) => (
													<button
														type="button"
														onClick={() => setCompFilter(f.id)}
														class={`px-2.5 py-1 rounded-[6px] text-[12px] font-semibold shrink-0 transition-colors cursor-pointer ${
															compFilter() === f.id
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
												<span class="col-span-5">{t('fragUi.giftSerial')}</span>
												<span class="col-span-4">{t('fragUi.price')}</span>
												<span class="col-span-3 text-end">{t('fragUi.date')}</span>
											</div>
											<Show
												when={filteredComps().length > 0}
												fallback={
													<div class="p-6 text-center text-[13px] text-[#8c9aa9]">
														{t('fragUi.noComparableGifts')}
													</div>
												}
											>
												<For each={filteredComps()}>
													{(comp) => (
														<button
															type="button"
															onClick={() =>
																selectQuickGift(`${parsedTarget().slug}-${comp.serial_number}`)
															}
															class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
														>
															<div class="col-span-5 min-w-0 pr-2">
																<span class="text-[13px] font-semibold text-white font-mono">
																	#{comp.serial_number}
																</span>
																<span class="block text-[11px] text-[#8c9aa9] truncate">
																	{comp.backdrop_name || comp.venue || 'Verified Sale'}
																</span>
															</div>
															<div class="col-span-4">
																<TonAmount
																	value={formatTon(comp.sale_price_gram)}
																	usd={
																		comp.sale_price_usd
																			? formatUsdPlain(comp.sale_price_usd)
																			: undefined
																	}
																	size="sm"
																/>
															</div>
															<div class="col-span-3 text-end text-[11.5px] text-[#8c9aa9] truncate">
																{formatDateLocale(comp.sale_date)}
															</div>
														</button>
													)}
												</For>
											</Show>
										</div>
									</div>
								</Show>
							</div>
						)}
					</Show>
				</Show>
			</div>

			<CreditStoreSheet open={storeOpen()} onClose={() => setStoreOpen(false)} vertical="gift" />
		</div>
	);
};
