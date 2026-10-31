import { A, useNavigate, useSearchParams } from '@solidjs/router';
import { toPng } from 'html-to-image';
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	Show,
} from 'solid-js';
import { giftsApi } from '@/entities/gifts/api/giftsApi.js';
import type {
	ComparableGiftSale,
	CuriosityGateData,
	EnrichedGiftReport,
} from '@/entities/gifts/model/types.js';
import { GiftThumbnail } from '@/entities/gifts/ui/GiftThumbnail.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { copyToClipboard, shareToStory } from '@/shared/lib/telegram-native.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import {
	CreditStoreSheet,
	UnifiedPaywallGate,
	useWallet,
} from '@/widgets/paywall/index.js';

function formatUsd(val: number | string | undefined | null): string {
	const num = typeof val === 'string' ? Number.parseFloat(val) : (val ?? 0);
	if (!Number.isFinite(num) || num <= 0) return '$0';
	if (num >= 1000) {
		return `$${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	}
	return `$${num.toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function formatTon(val: number | string | undefined | null): string {
	const num = typeof val === 'string' ? Number.parseFloat(val) : (val ?? 0);
	if (!Number.isFinite(num) || num <= 0) return '0';
	if (num >= 1000) {
		return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
	}
	if (num >= 10) {
		return num.toLocaleString('en-US', { maximumFractionDigits: 1 });
	}
	return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatDateLocale(iso?: string): string {
	if (!iso) return isRtl() ? 'نامشخص' : 'Unknown';
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString(isRtl() ? 'fa-IR' : 'en-US', {
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
	{ id: 'plush_pepe-1', label: 'Plush Pepe #1', tag: 'Genesis #1' },
	{ id: 'plush_pepe-42', label: 'Plush Pepe #42', tag: '2-Digit Grail' },
	{ id: 'durovs_cap-1', label: "Durov's Cap #1", tag: 'Founder #1' },
	{ id: 'heart_locket-7', label: 'Heart Locket #7', tag: 'Single Digit' },
	{ id: 'loot_bag-88', label: 'Loot Bag #88', tag: 'Repeating #88' },
	{ id: 'swiss_watch-100', label: 'Swiss Watch #100', tag: 'Clean #100' },
];

type ActiveTab = 'valuation' | 'traits' | 'onchain' | 'comps';
type HeroViewMode = 'card' | 'wear' | 'cert';

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
	const [scanStep, setScanStep] = createSignal(0);

	// Interactive UI states
	const [activeTab, setActiveTab] = createSignal<ActiveTab>('valuation');
	const [heroMode, setHeroMode] = createSignal<HeroViewMode>('card');
	const [darkCardBg, setDarkCardBg] = createSignal(false);
	const [watched, setWatched] = createSignal(false);
	const [watchBusy, setWatchBusy] = createSignal(false);
	const [copiedKey, setCopiedKey] = createSignal<string | null>(null);
	const [compFilter, setCompFilter] = createSignal<
		'all' | 'exact_model' | 'exact_backdrop' | 'collection_floor'
	>('all');
	const [customOfferTon, setCustomOfferTon] = createSignal<number | null>(null);
	const [sharingStory, setSharingStory] = createSignal(false);
	const [downloadingCert, setDownloadingCert] = createSignal(false);

	// Trait simulator states
	const [simModel, setSimModel] = createSignal<string>('');
	const [simBackdrop, setSimBackdrop] = createSignal<string>('');
	const [simSymbol, setSimSymbol] = createSignal<string>('');
	const [catalogSubTab, setCatalogSubTab] = createSignal<
		'models' | 'backdrops' | 'symbols'
	>('models');

	// 3D Holographic Card Tilt State
	let heroCardRef: HTMLDivElement | undefined;
	const [tilt, setTilt] = createSignal({
		x: 0,
		y: 0,
		glossX: 50,
		glossY: 50,
	});

	const tr = (fa: string, en: string, ru?: string, zh?: string) => {
		if (isRtl()) return fa;
		return en || ru || zh || fa;
	};

	const scanMessages = createMemo(() => [
		tr(
			'واکاوی رجیستری گیفت‌های تلگرام و استاندارد TEP-62...',
			'Scanning Telegram Gift Registry & TEP-62 Contract...',
		),
		tr(
			'استخراج DNA سه‌محوره (Model, Backdrop, Symbol)...',
			'Extracting 3-Axis Trait DNA (Model, Backdrop, Symbol)...',
		),
		tr(
			'بررسی ماتریس کف قیمت در ۶ مارکت‌پلیس فعال...',
			'Querying 4-Floor Matrix Across 6 Active Marketplaces...',
		),
		tr(
			'محاسبه ارزش منصفانه ۴ پایه‌ای (GV Engine v4.2)...',
			'Computing Bayesian 4-Pillar Valuation (GV Engine v4.2)...',
		),
	]);

	let scanTimer: ReturnType<typeof setInterval> | undefined;
	const startScanAnimation = () => {
		setScanStep(0);
		if (scanTimer) clearInterval(scanTimer);
		scanTimer = setInterval(() => {
			setScanStep((prev) => (prev < 3 ? prev + 1 : prev));
		}, 420);
	};

	onCleanup(() => {
		if (scanTimer) clearInterval(scanTimer);
	});

	const handleCardPointerMove = (clientX: number, clientY: number) => {
		if (!heroCardRef) return;
		const rect = heroCardRef.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		const relX = (clientX - rect.left) / rect.width;
		const relY = (clientY - rect.top) / rect.height;
		const rotateY = (relX - 0.5) * 18;
		const rotateX = (0.5 - relY) * 18;
		setTilt({
			x: Math.round(rotateX * 10) / 10,
			y: Math.round(rotateY * 10) / 10,
			glossX: Math.round(relX * 100),
			glossY: Math.round(relY * 100),
		});
	};

	const resetCardTilt = () => {
		setTilt({ x: 0, y: 0, glossX: 50, glossY: 50 });
	};

	const loadGiftIntelligence = async (targetRaw: string) => {
		const normalized = parseRawGiftInput(targetRaw);
		setLoading(true);
		setError(null);
		setUnlockError(null);
		setCustomOfferTon(null);
		startScanAnimation();

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
					setReport(null);
					setIsUnlocked(false);
				}
			} else {
				setReport(null);
				setIsUnlocked(false);
			}
		} catch (e: unknown) {
			setError(
				e instanceof Error
					? e.message
					: tr(
							'خطا در برقراری ارتباط با موتور ارزش‌گذاری گیفت',
							'Failed to connect to Gift Valuation Engine',
						),
			);
		} finally {
			setLoading(false);
			if (scanTimer) clearInterval(scanTimer);
		}
	};

	createEffect(() => {
		const g = searchParams.g;
		const str = Array.isArray(g) ? g[0] : g;
		if (str) {
			const norm = parseRawGiftInput(str);
			if (norm !== giftQuery()) {
				setGiftQuery(norm);
				setSearchInput(norm);
			}
		}
	});

	createEffect(() => {
		const q = giftQuery();
		if (q) {
			void loadGiftIntelligence(q);
		}
	});

	const handleSearchSubmit = (e?: Event) => {
		e?.preventDefault();
		const cleaned = parseRawGiftInput(searchInput());
		if (!cleaned) return;
		try {
			haptic.impact('light');
		} catch {}
		setSearchInput(cleaned);
		setGiftQuery(cleaned);
		setSearchParams({ g: cleaned });
	};

	const selectQuickGift = (id: string) => {
		try {
			haptic.impact('light');
		} catch {}
		setSearchInput(id);
		setGiftQuery(id);
		setSearchParams({ g: id });
	};

	const handleUnlockWithCredit = async () => {
		const target = giftQuery();
		if (!target) return;
		try {
			haptic.impact('medium');
		} catch {}
		setUnlockError(null);

		const bal = wallet.balance();
		if (bal !== null && bal < 1) {
			setStoreOpen(true);
			return;
		}

		setUnlocking(true);
		try {
			const unlockedRes = (await giftsApi.unlockWithCredit(target)) as EnrichedGiftReport & {
				is_unlocked?: boolean;
			};

			// Fetch full enriched report after unlocking to guarantee all deep-dive fields
			try {
				const enriched = await giftsApi.getEnrichedReport(target);
				if (enriched && (enriched.pillars || enriched.expected_gram)) {
					setReport(enriched);
					setIsUnlocked(true);
					const mTrait = enriched.trait_dna?.find((x) => x.axis_key === 'model');
					const bTrait = enriched.trait_dna?.find((x) => x.axis_key === 'backdrop');
					const sTrait = enriched.trait_dna?.find((x) => x.axis_key === 'symbol');
					setSimModel(mTrait?.value || enriched.selected_model || '');
					setSimBackdrop(bTrait?.value || '');
					setSimSymbol(sTrait?.value || '');
				} else {
					setReport(unlockedRes);
					setIsUnlocked(true);
				}
			} catch {
				setReport(unlockedRes);
				setIsUnlocked(true);
			}

			try {
				haptic.notify('success');
			} catch {}
			wallet.refetch();
		} catch (err: unknown) {
			try {
				haptic.notify('error');
			} catch {}
			const status = (err as { response?: { status?: number } })?.response?.status;
			const msg =
				(err as { response?: { data?: { error?: string; message?: string } } })?.response
					?.data?.error ||
				(err as { response?: { data?: { message?: string } } })?.response?.data
					?.message ||
				(err instanceof Error ? err.message : '');

			if (
				status === 400 ||
				status === 402 ||
				msg.toLowerCase().includes('credit') ||
				msg.toLowerCase().includes('insufficient')
			) {
				setStoreOpen(true);
			} else {
				setUnlockError(
					msg ||
						tr(
							'خطا در بازگشایی گزارش با کردیت. لطفاً دوباره تلاش کنید.',
							'Failed to unlock gift report with credit.',
						),
				);
			}
		} finally {
			setUnlocking(false);
		}
	};

	const handleSimulateTraits = async (
		nextModel?: string,
		nextBackdrop?: string,
		nextSymbol?: string,
	) => {
		const current = report();
		if (!current) return;
		try {
			haptic.impact('medium');
		} catch {}
		setSimulating(true);
		try {
			const res = await fetch(
				`/api/v1/gifts/enriched-report?g=${encodeURIComponent(giftQuery())}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						gift_id: giftQuery(),
						model: nextModel ?? simModel(),
						backdrop: nextBackdrop ?? simBackdrop(),
						symbol: nextSymbol ?? simSymbol(),
					}),
				},
			);
			if (res.ok) {
				const updated = (await res.json()) as EnrichedGiftReport;
				if (updated && (updated.pillars || updated.expected_gram)) {
					setReport(updated);
				}
			}
		} catch {
			// keep current report
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

	const copyText = (text: string, key: string) => {
		try {
			haptic.impact('light');
		} catch {}
		void copyToClipboard(text);
		setCopiedKey(key);
		setTimeout(() => {
			if (copiedKey() === key) setCopiedKey(null);
		}, 1800);
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
				text: `🎁 ${title} — Fair Value: ${fv} TON on @iFragmentBot`,
			});
		} catch {
			// fallback copy link
			copyText(window.location.href, 'share_link');
		} finally {
			setSharingStory(false);
		}
	};

	const handleDownloadCertificate = async () => {
		if (!heroCardRef || downloadingCert()) return;
		try {
			haptic.impact('light');
		} catch {}
		setDownloadingCert(true);
		try {
			const dataUrl = await toPng(heroCardRef, {
				quality: 0.96,
				pixelRatio: 2,
				cacheBust: true,
			});
			const link = document.createElement('a');
			link.download = `${giftQuery()}-appraisal.png`;
			link.href = dataUrl;
			link.click();
		} catch {
			copyText(window.location.href, 'share_link');
		} finally {
			setDownloadingCert(false);
		}
	};

	const parsedTarget = createMemo(() => splitGiftSlugAndSerial(giftQuery()));

	const backdropColors = createMemo(() => {
		const r = report();
		if (r?.backdrop_colors) return r.backdrop_colors;
		const bdTrait = r?.trait_dna?.find((x) => x.axis_key === 'backdrop');
		if (bdTrait?.colors) return bdTrait.colors;
		return {
			center_hex: '#1e293b',
			edge_hex: '#0f172a',
			pattern_hex: '#38bdf8',
			text_hex: '#f8fafc',
		};
	});

	const modelTrait = createMemo(() =>
		report()?.trait_dna?.find((x) => x.axis_key === 'model'),
	);
	const backdropTrait = createMemo(() =>
		report()?.trait_dna?.find((x) => x.axis_key === 'backdrop'),
	);
	const symbolTrait = createMemo(() =>
		report()?.trait_dna?.find((x) => x.axis_key === 'symbol'),
	);

	const fairValueTon = createMemo(() => {
		const r = report();
		if (!r) return 0;
		return (
			r.pillars?.fair_value_gram ||
			Number.parseFloat(String(r.expected_gram || '0')) ||
			0
		);
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

	const activeOfferTon = createMemo(() => {
		const custom = customOfferTon();
		if (custom !== null && custom > 0) return custom;
		return fairValueTon() || 10;
	});

	const filteredComps = createMemo((): ComparableGiftSale[] => {
		const all = report()?.comps || [];
		const f = compFilter();
		if (f === 'all') return all;
		return all.filter((c) => c.trait_match_type === f);
	});

	const compChartPoints = createMemo(() => {
		const sales = [...filteredComps()].reverse();
		if (sales.length === 0) return [];
		const prices = sales.map((s) => s.sale_price_gram);
		const fv = fairValueTon();
		const minP = Math.min(...prices, fv) * 0.88;
		const maxP = Math.max(...prices, fv) * 1.12;
		const range = Math.max(1, maxP - minP);

		return sales.map((s, idx) => {
			const x =
				sales.length === 1 ? 50 : Math.round((idx / (sales.length - 1)) * 88 + 6);
			const y = Math.round(86 - ((s.sale_price_gram - minP) / range) * 70);
			return {
				x,
				y,
				price: s.sale_price_gram,
				serial: s.serial_number,
				date: formatDateLocale(s.sale_date),
			};
		});
	});

	const rarityBadgeTheme = createMemo(() => {
		const score = report()?.rarity_score || 75;
		const sn = report()?.serial_number || parsedTarget().serial;
		if (sn <= 9 || score >= 92) {
			return {
				label: 'GRAIL TIER',
				badge: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
				wrapper: 'from-amber-400/50 via-[#0098EA]/40 to-purple-500/50',
			};
		}
		if (sn <= 99 || score >= 82) {
			return {
				label: 'APEX COLLECTIBLE',
				badge: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
				wrapper: 'from-purple-500/40 via-[#0098EA]/40 to-emerald-400/40',
			};
		}
		return {
			label: 'VERIFIED TEP-62',
			badge: 'bg-[#0098EA]/20 text-[#38bdf8] border-[#0098EA]/40',
			wrapper: 'from-[#0098EA]/40 via-white/15 to-emerald-500/30',
		};
	});

	return (
		<div
			class="pb-36 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Dynamic Backdrop Glow */}
			<div
				class="fixed top-[-12%] left-[-10%] w-[380px] h-[380px] rounded-full blur-[135px] pointer-events-none z-0 opacity-25 transition-colors duration-700"
				style={{ background: backdropColors().center_hex }}
			/>
			<div
				class="fixed bottom-[-12%] right-[-10%] w-[360px] h-[360px] rounded-full blur-[135px] pointer-events-none z-0 opacity-20 transition-colors duration-700"
				style={{ background: '#0098EA' }}
			/>

			<div class="max-w-[520px] mx-auto px-4 pt-4 relative z-10 flex flex-col gap-3.5">
				{/* ═══════ 1. TOP INSTITUTIONAL HEADER ═══════ */}
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2.5 min-w-0">
						<button
							type="button"
							onClick={() => {
								try {
									haptic.impact('light');
								} catch {}
								navigate('/gifts');
							}}
							class="w-10 h-10 rounded-[14px] bg-[#12141C] border border-white/10 flex items-center justify-center text-white/75 hover:text-white active:scale-95 transition-all shrink-0"
							aria-label="Back"
						>
							<span class="material-symbols-outlined text-[20px]">
								{isRtl() ? 'arrow_forward' : 'arrow_back'}
							</span>
						</button>
						<div class="min-w-0">
							<div class="flex items-center gap-1.5">
								<h1 class="text-[15px] font-black tracking-tight text-white truncate">
									{tr(
										'کارشناسی و کالبدشکافی گیفت',
										'Telegram Gift Appraisal',
									)}
								</h1>
								<span class="px-1.5 py-0.5 rounded-md bg-[#0098EA]/15 border border-[#0098EA]/30 text-[#38bdf8] text-[9px] font-mono font-black uppercase shrink-0">
									TEP-62
								</span>
							</div>
							<p class="text-[10px] text-white/45 font-medium truncate">
								{tr(
									'ارزش‌گذاری ۴ پایه‌ای، ماتریس کف تریت و رصد آن‌چین TON',
									'4-Pillar GV Engine, Trait Floor Matrix & On-Chain Telemetry',
								)}
							</p>
						</div>
					</div>

					<div class="flex items-center gap-1.5 shrink-0">
						<A
							href={`/gifts/collection?c=${encodeURIComponent(
								report()?.collection_id ||
									parsedTarget().slug.replace(/_/g, '-'),
							)}`}
							class="h-9 px-2.5 rounded-[12px] bg-[#12141C] border border-white/10 hover:border-[#0098EA]/40 text-[10px] font-bold text-white/75 hover:text-white flex items-center gap-1 transition-all"
						>
							<span class="material-symbols-outlined text-[15px] text-[#0098EA]">
								grid_view
							</span>
							<span>{tr('کلکسیون', 'Collection')}</span>
						</A>
						<div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
							<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
							<span class="text-[9px] font-mono font-black text-emerald-400 uppercase tracking-wider">
								LIVE
							</span>
						</div>
					</div>
				</div>

				{/* ═══════ 2. SEARCH BAR & QUICK BENCHMARK CHIPS ═══════ */}
				<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[22px] p-3 flex flex-col gap-2.5 shadow-xl">
					<form onSubmit={handleSearchSubmit} class="flex items-center gap-2">
						<div class="relative flex-1">
							<span class="material-symbols-outlined text-[18px] text-[#0098EA] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
								redeem
							</span>
							<input
								type="text"
								value={searchInput()}
								onInput={(e) => setSearchInput(e.currentTarget.value)}
								placeholder="plush_pepe-42 or t.me/nft/PlushPepe-42"
								dir="ltr"
								class="w-full h-10 bg-[#08090D] border border-white/10 focus:border-[#0098EA] rounded-[13px] pl-9 pr-8 text-[12px] font-mono font-bold text-white placeholder:text-white/30 focus:outline-none transition-colors"
							/>
							<Show when={searchInput().length > 0}>
								<button
									type="button"
									onClick={() => setSearchInput('')}
									class="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-white"
								>
									<span class="material-symbols-outlined text-[16px]">
										close
									</span>
								</button>
							</Show>
						</div>
						<button
							type="submit"
							disabled={loading()}
							class="h-10 px-4 rounded-[13px] bg-[#0098EA] hover:bg-[#0086cf] disabled:opacity-50 text-white font-black text-[11px] flex items-center gap-1.5 shadow-[0_4px_14px_rgba(0,152,234,0.3)] active:scale-95 transition-all shrink-0"
						>
							<span class="material-symbols-outlined text-[16px]">
								travel_explore
							</span>
							<span>{tr('کالبدشکافی', 'Appraise')}</span>
						</button>
					</form>

					{/* Quick Benchmark Gift Chips */}
					<div
						class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
						dir="ltr"
					>
						<For each={BENCHMARK_GIFTS}>
							{(item) => {
								const isActive = () => giftQuery() === item.id;
								return (
									<button
										type="button"
										onClick={() => selectQuickGift(item.id)}
										class={`px-2.5 py-1 rounded-[10px] text-[10px] font-mono font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 border ${
											isActive()
												? 'bg-[#0098EA]/20 text-white border-[#0098EA]/50 shadow-[0_2px_10px_rgba(0,152,234,0.2)]'
												: 'bg-[#08090D] text-white/55 border-white/5 hover:text-white hover:border-white/15'
										}`}
									>
										<span>{item.label}</span>
										<span class="text-[8px] px-1 py-0.2 rounded bg-white/5 text-[#38bdf8]">
											{item.tag}
										</span>
									</button>
								);
							}}
						</For>
					</div>
				</div>

				{/* ═══════ 3. COMPACT ASSET IDENTITY BAR ═══════ */}
				<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[22px] p-3 flex items-center justify-between gap-2 shadow-lg">
					<div class="flex items-center gap-2.5 min-w-0">
						<div
							class="w-11 h-11 rounded-[14px] p-1 flex items-center justify-center border border-white/15 shrink-0 overflow-hidden relative"
							style={{
								background: `radial-gradient(circle, ${backdropColors().center_hex}, ${backdropColors().edge_hex})`,
							}}
						>
							<GiftThumbnail
								slug={parsedTarget().slug}
								model={report()?.selected_model || gate()?.selected_model}
								serial={parsedTarget().serial}
								imageUrl={report()?.image_url || gate()?.image_url}
								alt={parsedTarget().prettyTitle}
								size="sm"
							/>
						</div>
						<div class="flex flex-col min-w-0 text-start">
							<div class="flex items-center gap-1.5">
								<span
									class="text-[15px] font-mono font-black text-white truncate"
									dir="ltr"
								>
									{report()?.display_title || parsedTarget().prettyTitle}
								</span>
								<span
									class="material-symbols-outlined text-[16px] text-[#0098EA] shrink-0"
									title="Verified Telegram Collectible Gift"
								>
									verified
								</span>
							</div>
							<div class="flex items-center gap-1.5">
								<span
									class={`w-1.5 h-1.5 rounded-full ${
										report()?.custody_type === 'on_chain_nft'
											? 'bg-emerald-400'
											: 'bg-[#0098EA]'
									}`}
								/>
								<span class="text-[10px] font-mono font-bold text-white/60 truncate">
									{isUnlocked() && report()
										? `${modelTrait()?.value || report()?.selected_model || 'Original'} · ${backdropTrait()?.value || 'Verified'}`
										: tr(
												'آماده رمزگشایی گزارش کامل',
												'Appraisal Ready to Decrypt',
											)}
								</span>
							</div>
						</div>
					</div>

					<div class="flex items-center gap-1.5 shrink-0">
						<Show when={isUnlocked() && report()}>
							<button
								type="button"
								onClick={handleToggleWatchlist}
								disabled={watchBusy()}
								class={`w-9 h-9 rounded-[12px] border flex items-center justify-center transition-all active:scale-95 ${
									watched()
										? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
										: 'bg-white/5 border-white/10 text-white/65 hover:text-white'
								}`}
								title={tr('افزودن به دیده‌بان قیمت', 'Watchlist Alert')}
							>
								<span class="material-symbols-outlined text-[18px]">
									{watched() ? 'notifications_active' : 'notifications'}
								</span>
							</button>
						</Show>
						<button
							type="button"
							disabled={loading()}
							onClick={() => void loadGiftIntelligence(giftQuery())}
							class="w-9 h-9 rounded-[12px] bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-95"
							title={tr('بروزرسانی زنده', 'Refresh Live Data')}
						>
							<span
								class={`material-symbols-outlined text-[18px] ${
									loading() ? 'animate-spin text-[#0098EA]' : ''
								}`}
							>
								refresh
							</span>
						</button>
					</div>
				</div>

				{/* ═══════ 4. STATE 1: SCANNING ANIMATION ═══════ */}
				<Show when={loading()}>
					<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-7 flex flex-col items-center justify-center text-center gap-4 shadow-2xl my-2">
						<div class="relative w-16 h-16 flex items-center justify-center">
							<div class="absolute inset-0 rounded-full border-2 border-[#0098EA]/20 border-t-[#0098EA] animate-spin" />
							<span class="material-symbols-outlined text-[28px] text-[#0098EA] animate-pulse">
								redeem
							</span>
						</div>
						<div class="flex flex-col gap-1">
							<span
								class="text-[15px] font-mono font-black text-white"
								dir="ltr"
							>
								{parsedTarget().prettyTitle}
							</span>
							<span class="text-[12px] font-bold text-[#38bdf8] min-h-[20px]">
								{scanMessages()[scanStep()]}
							</span>
						</div>
						<div class="w-full max-w-[260px] flex items-center gap-1.5">
							<For each={[0, 1, 2, 3]}>
								{(idx) => (
									<div
										class={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
											scanStep() >= idx ? 'bg-[#0098EA]' : 'bg-white/10'
										}`}
									/>
								)}
							</For>
						</div>
					</div>
				</Show>

				{/* ═══════ 5. ERROR BANNER ═══════ */}
				<Show when={!loading() && error()}>
					<div class="w-full bg-rose-500/10 border border-rose-500/30 rounded-[24px] p-5 text-center flex flex-col items-center gap-3">
						<span class="material-symbols-outlined text-[32px] text-rose-400">
							error
						</span>
						<p class="text-[12px] font-bold text-rose-200">{error()}</p>
						<button
							type="button"
							onClick={() => void loadGiftIntelligence(giftQuery())}
							class="h-10 px-5 rounded-[12px] bg-rose-500 hover:bg-rose-600 text-white font-black text-[11px]"
						>
							{tr('تلاش مجدد', 'Try Again')}
						</button>
					</div>
				</Show>

				{/* ═══════ 6. STATE 2 (PRE-UNLOCK PAYWALL GATE) vs STATE 3 (UNLOCKED REPORT) ═══════ */}
				<Show when={!loading() && !error()}>
					<Show
						when={isUnlocked() && report()}
						fallback={
							<div class="w-full flex flex-col gap-3.5 relative z-20">
								{/* Pre-Appraisal Curiosity Teaser Card (Matches Username & Number Reports) */}
								<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col items-center text-center relative overflow-hidden shadow-2xl">
									<div class="absolute inset-0 bg-gradient-to-br from-[#0098EA]/10 via-transparent to-emerald-500/10 pointer-events-none" />

									<div class="flex items-center gap-2 mb-2 z-10">
										<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
										<span class="text-[11px] font-mono font-black uppercase tracking-widest text-emerald-400">
											{t('valuation.report_ready') ||
												tr(
													'گزارش کارشناسی آماده رمزگشایی است',
													'GIFT APPRAISAL READY',
												)}
										</span>
									</div>

									<h3
										class="text-[24px] font-black text-white font-mono tracking-tight drop-shadow-md z-10"
										dir="ltr"
									>
										{gate()?.model_name
											? `${gate()?.model_name} #${gate()?.serial_number || parsedTarget().serial}`
											: parsedTarget().prettyTitle}
									</h3>

									<div class="flex flex-wrap items-center justify-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-white/75 z-10 my-1.5">
										<span class="w-2 h-2 rounded-full bg-emerald-400" />
										<span class="font-bold">TEP-62 COLLECTIBLE GIFT</span>
										<Show when={gate()?.selected_model}>
											<span class="text-white/30">|</span>
											<span class="text-[#38bdf8] font-bold">
												Model: {gate()?.selected_model}
											</span>
										</Show>
										<Show when={gate()?.floor_price_gram}>
											<span class="text-white/30">|</span>
											<span class="text-emerald-400 font-bold">
												Floor: {formatTon(gate()?.floor_price_gram)} TON
											</span>
										</Show>
									</div>

									{/* 3-Metric Pre-Unlock Telemetry Strip */}
									<div class="w-full grid grid-cols-3 gap-2 my-2.5 z-10">
										<div class="bg-[#08090D]/90 border border-white/8 rounded-[14px] p-2.5 flex flex-col items-center">
											<span class="text-[15px] font-mono font-black text-[#38bdf8]">
												{gate()?.signals_analyzed || 28}
											</span>
											<span class="text-[9px] text-white/50 font-bold">
												{tr('سیگنال آن‌چین', 'On-Chain Signals')}
											</span>
										</div>
										<div class="bg-[#08090D]/90 border border-white/8 rounded-[14px] p-2.5 flex flex-col items-center">
											<span class="text-[15px] font-mono font-black text-emerald-400">
												{gate()?.data_sources_count || 6}
											</span>
											<span class="text-[9px] text-white/50 font-bold">
												{tr('مارکت‌پلیس زنده', 'Live Venues')}
											</span>
										</div>
										<div class="bg-[#08090D]/90 border border-white/8 rounded-[14px] p-2.5 flex flex-col items-center">
											<span class="text-[15px] font-mono font-black text-amber-400">
												4-Axis
											</span>
											<span class="text-[9px] text-white/50 font-bold">
												{tr('ماتریس کف تریت', 'Trait Floors')}
											</span>
										</div>
									</div>

									{/* Blurred Price Preview Box */}
									<div class="w-full bg-white/5 border border-white/10 rounded-[20px] p-4 flex flex-col items-center justify-center my-1.5 relative overflow-hidden backdrop-blur-md z-10 shadow-inner">
										<span class="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">
											{t('valuation.estimated_price') ||
												tr(
													'برآورد ارزش منصفانه (Fair Value)',
													'ESTIMATED FAIR VALUE',
												)}
										</span>
										<div class="flex items-center gap-2 filter blur-[6px] select-none opacity-80">
											<span class="text-[26px] font-black text-white font-mono">
												✦,✦✦✦
											</span>
											<span class="text-[16px] font-bold text-[#0098EA]">
												TON
											</span>
										</div>
										<span class="text-[10px] text-white/40 font-mono filter blur-[3px] mt-0.5">
											≈ $✦✦,✦✦✦ USD · P10 / P50 / P90
										</span>

										<div class="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
											<span class="px-3.5 py-1.5 rounded-[12px] bg-[#0098EA]/20 border border-[#0098EA]/50 text-[#38bdf8] text-[11px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
												<span class="material-symbols-outlined text-[15px]">
													lock
												</span>
												{t('valuation.locked_tap_to_decrypt') ||
													tr(
														'بازگشایی با ۱ کردیت تحلیلی',
														'UNLOCK WITH 1 INTEL CREDIT',
													)}
											</span>
										</div>
									</div>
								</div>

								{/* Unified Institutional Paywall Gate (Requires 1 Credit) */}
								<UnifiedPaywallGate
									vertical="gift"
									targetTitle={parsedTarget().prettyTitle}
									targetSubtitle={tr(
										'گزارش کامل ارزش‌گذاری ۴ پایه‌ای، ماتریس کف تریت، شبیه‌ساز تریت و تاریخچه مالکیت',
										'Full 4-Pillar Valuation, Trait Floor Matrix, What-If Simulator & Provenance',
									)}
									targetGiftSlug={parsedTarget().slug}
									targetGiftModel={gate()?.selected_model}
									targetGiftSerial={parsedTarget().serial}
									targetImage={gate()?.image_url}
									targetBadge={
										t('paywall.ready_for_appraisal') || 'READY FOR APPRAISAL'
									}
									unlockCtaText={tr(
										`بازگشایی گزارش ${parsedTarget().prettyTitle} (۱ کردیت)`,
										`Unlock ${parsedTarget().prettyTitle} (1 Credit)`,
									)}
									onUnlock={handleUnlockWithCredit}
									unlocking={unlocking()}
									error={unlockError()}
								/>
							</div>
						}
					>
						{(rep) => (
							<div class="w-full flex flex-col gap-3.5">
								{/* ═══════ 4-TAB STICKY SEGMENTED NAVIGATION BAR ═══════ */}
								<div class="w-full grid grid-cols-4 gap-1.5 p-1.5 rounded-[20px] bg-[#12141C]/95 border border-white/10 shadow-lg sticky top-2 z-30 backdrop-blur-2xl">
									<button
										type="button"
										onClick={() => {
											try {
												haptic.impact('light');
											} catch {}
											setActiveTab('valuation');
										}}
										class={`py-2.5 px-1.5 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all ${
											activeTab() === 'valuation'
												? 'bg-[#0098EA] text-white shadow-[0_4px_15px_rgba(0,152,234,0.35)]'
												: 'text-white/50 hover:text-white hover:bg-white/5'
										}`}
									>
										<span class="material-symbols-outlined text-[18px]">
											diamond
										</span>
										<span class="text-[10px] font-black leading-none truncate max-w-full">
											{tr('ارزش‌گذاری', 'Valuation')}
										</span>
									</button>

									<button
										type="button"
										onClick={() => {
											try {
												haptic.impact('light');
											} catch {}
											setActiveTab('traits');
										}}
										class={`py-2.5 px-1.5 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all ${
											activeTab() === 'traits'
												? 'bg-[#0098EA] text-white shadow-[0_4px_15px_rgba(0,152,234,0.35)]'
												: 'text-white/50 hover:text-white hover:bg-white/5'
										}`}
									>
										<span class="material-symbols-outlined text-[18px]">
											palette
										</span>
										<span class="text-[10px] font-black leading-none truncate max-w-full">
											{tr('تریت و کمیابی', 'Trait DNA')}
										</span>
									</button>

									<button
										type="button"
										onClick={() => {
											try {
												haptic.impact('light');
											} catch {}
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
											{tr('زنجیره و نهنگ', 'On-Chain')}
										</span>
									</button>

									<button
										type="button"
										onClick={() => {
											try {
												haptic.impact('light');
											} catch {}
											setActiveTab('comps');
										}}
										class={`py-2.5 px-1.5 rounded-[14px] flex flex-col items-center justify-center gap-1 transition-all ${
											activeTab() === 'comps'
												? 'bg-[#0098EA] text-white shadow-[0_4px_15px_rgba(0,152,234,0.35)]'
												: 'text-white/50 hover:text-white hover:bg-white/5'
										}`}
									>
										<span class="material-symbols-outlined text-[18px]">
											monitoring
										</span>
										<span class="text-[10px] font-black leading-none truncate max-w-full">
											{tr('معاملات و ریسک', 'Comps & Risk')}
										</span>
									</button>
								</div>

								{/* ════════════════════════════════════════════════════════════════
								    TAB 1: VALUATION, 3D HERO CARD, 4-FLOOR MATRIX & EXIT PLANNER
								    ════════════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'valuation'}>
									<div class="w-full flex flex-col gap-3.5">
										{/* 3-Mode Hero View Switcher */}
										<div class="w-full flex items-center justify-between gap-1.5 bg-[#12141C]/90 border border-white/10 rounded-[16px] p-1">
											<button
												type="button"
												onClick={() => setHeroMode('card')}
												class={`flex-1 py-2 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
													heroMode() === 'card'
														? 'bg-[#0098EA]/20 text-[#38bdf8] border border-[#0098EA]/40'
														: 'text-white/50 hover:text-white'
												}`}
											>
												<span class="material-symbols-outlined text-[15px]">
													view_in_ar
												</span>
												<span>{tr('کارت هولوگرافیک 3D', '3D Holo Card')}</span>
											</button>
											<button
												type="button"
												onClick={() => setHeroMode('wear')}
												class={`flex-1 py-2 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
													heroMode() === 'wear'
														? 'bg-[#0098EA]/20 text-[#38bdf8] border border-[#0098EA]/40'
														: 'text-white/50 hover:text-white'
												}`}
											>
												<span class="material-symbols-outlined text-[15px]">
													person_celebrate
												</span>
												<span>{tr('نمای پروفایل تلگرام', 'Profile Wear')}</span>
											</button>
											<button
												type="button"
												onClick={() => setHeroMode('cert')}
												class={`flex-1 py-2 rounded-[12px] text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
													heroMode() === 'cert'
														? 'bg-[#0098EA]/20 text-[#38bdf8] border border-[#0098EA]/40'
														: 'text-white/50 hover:text-white'
												}`}
											>
												<span class="material-symbols-outlined text-[15px]">
													verified_user
												</span>
												<span>{tr('سند دیجیتال', 'Certificate')}</span>
											</button>
										</div>

										{/* HERO MODE 1: 3D Interactive Holographic Gift Card */}
										<Show when={heroMode() === 'card'}>
											<div
												class={`w-full aspect-square p-[3px] bg-gradient-to-br ${rarityBadgeTheme().wrapper} rounded-[42px] relative z-20 transition-all duration-300 shadow-2xl`}
											>
												<div
													ref={heroCardRef}
													onMouseMove={(e) =>
														handleCardPointerMove(e.clientX, e.clientY)
													}
													onMouseLeave={resetCardTilt}
													onTouchMove={(e) => {
														const t0 = e.touches[0];
														if (t0)
															handleCardPointerMove(t0.clientX, t0.clientY);
													}}
													onTouchEnd={resetCardTilt}
													class="w-full h-full rounded-[39px] p-6 relative overflow-hidden flex flex-col justify-between shadow-inner select-none"
													style={{
														transform: `perspective(1200px) rotateX(${tilt().x}deg) rotateY(${tilt().y}deg)`,
														background: darkCardBg()
															? '#08090D'
															: `radial-gradient(circle at 50% 42%, ${backdropColors().center_hex} 0%, ${backdropColors().edge_hex} 88%, #06070B 100%)`,
														transition: 'transform 0.12s ease-out',
													}}
												>
													{/* Subtle Dotted Pattern + Gloss Reflex */}
													<div
														class="absolute inset-0 pointer-events-none opacity-20"
														style={{
															'background-image':
																'radial-gradient(rgba(255,255,255,0.28) 1.25px, transparent 1.25px)',
															'background-size': '22px 22px',
														}}
													/>
													<div
														class="absolute inset-0 pointer-events-none z-20 mix-blend-overlay transition-opacity duration-300 opacity-75"
														style={{
															background: `radial-gradient(circle at ${tilt().glossX}% ${tilt().glossY}%, rgba(255,255,255,0.42) 0%, transparent 58%)`,
														}}
													/>

													{/* Card Top Row: Rarity Tier & Serial/Backdrop Switch */}
													<div class="flex items-center justify-between gap-2 z-10">
														<span
															class={`px-3 py-1 border rounded-[12px] text-[10px] font-mono font-black tracking-widest uppercase backdrop-blur-md ${rarityBadgeTheme().badge}`}
														>
															{rarityBadgeTheme().label}
														</span>
														<div class="flex items-center gap-1.5">
															<button
																type="button"
																onClick={() => setDarkCardBg((p) => !p)}
																class="px-2.5 py-1 rounded-[10px] bg-black/35 hover:bg-black/55 border border-white/15 text-[9px] font-mono font-bold text-white/80 backdrop-blur-md"
															>
																{darkCardBg()
																	? tr('پس‌زمینه رنگی', 'Chromatic BG')
																	: tr('زمینه تاریک', 'Dark BG')}
															</button>
															<span
																class="text-[11px] font-mono font-black text-white bg-black/40 border border-white/15 px-3 py-1 rounded-[12px] backdrop-blur-md"
																dir="ltr"
															>
																#{rep().serial_number} · Rank #
																{rep().rarity_rank || 1}
															</span>
														</div>
													</div>

													{/* Card Center: High-Res Gift Visual & Trait Pills */}
													<div class="flex flex-col items-center justify-center z-10 my-auto py-2 gap-2.5">
														<div class="relative w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center">
															<div
																class="absolute inset-0 rounded-full blur-2xl opacity-60 pointer-events-none"
																style={{
																	background: backdropColors().center_hex,
																}}
															/>
															<img
																src={
																	modelTrait()?.image_url ||
																	rep().image_url ||
																	`https://nft.fragment.com/gift/${parsedTarget().slug.replace(/_/g, '')}-${rep().serial_number}.webp`
																}
																alt={rep().display_title}
																onError={(e) => {
																	const fallback =
																		rep().image_url ||
																		`https://nft.fragment.com/gift/${parsedTarget().slug.replace(/_/g, '')}-${rep().serial_number}.webp`;
																	if (e.currentTarget.src !== fallback) {
																		e.currentTarget.src = fallback;
																	}
																}}
																class="w-full h-full object-contain drop-shadow-[0_16px_28px_rgba(0,0,0,0.65)] transition-transform duration-300 hover:scale-105"
															/>
														</div>

														<h2
															class="text-[22px] font-black text-white font-mono tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
															dir="ltr"
														>
															{rep().display_title ||
																parsedTarget().prettyTitle}
														</h2>

														<div class="flex flex-wrap items-center justify-center gap-1.5 max-w-[95%]">
															<Show when={modelTrait()}>
																{(mt) => (
																	<span class="px-2.5 py-0.5 rounded-lg bg-black/45 border border-white/15 text-[10px] font-mono font-bold text-white/90 backdrop-blur-md">
																		🎨 {mt().value} ({mt().percentile}%)
																	</span>
																)}
															</Show>
															<Show when={backdropTrait()}>
																{(bt) => (
																	<span class="px-2.5 py-0.5 rounded-lg bg-black/45 border border-white/15 text-[10px] font-mono font-bold text-white/90 backdrop-blur-md flex items-center gap-1">
																		<span
																			class="w-2 h-2 rounded-full border border-white/40"
																			style={{
																				background: backdropColors().center_hex,
																			}}
																		/>
																		{bt().value} ({bt().percentile}%)
																	</span>
																)}
															</Show>
															<Show when={symbolTrait()}>
																{(st) => (
																	<span class="px-2.5 py-0.5 rounded-lg bg-black/45 border border-white/15 text-[10px] font-mono font-bold text-white/80 backdrop-blur-md">
																		✦ {st().value} ({st().percentile}%)
																	</span>
																)}
															</Show>
														</div>
													</div>

													{/* Card Bottom Row: Fair Value TON, USD & Confidence */}
													<div class="flex justify-between items-end border-t border-white/15 pt-3.5 z-10 bg-black/25 -mx-6 -mb-6 px-6 py-4 backdrop-blur-md">
														<div class="flex flex-col gap-0.5 text-start">
															<span class="text-[9px] font-black text-white/55 uppercase tracking-widest">
																{tr(
																	'ارزش منصفانه کارشناسی',
																	'ESTIMATED FAIR VALUE',
																)}
															</span>
															<div
																class="flex items-baseline gap-1.5"
																dir="ltr"
															>
																<span class="text-[28px] font-black text-white font-mono leading-none tracking-tight">
																	{formatTon(fairValueTon())}
																</span>
																<span class="text-[13px] font-black text-[#38bdf8]">
																	TON
																</span>
															</div>
														</div>

														<div class="flex flex-col items-end gap-1">
															<div class="flex items-center gap-1.5 bg-emerald-500/20 px-2.5 py-0.5 rounded-[8px] border border-emerald-400/40 text-emerald-300 font-mono font-black text-[9px]">
																<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
																<span>
																	CONFIDENCE {rep().confidence_score || 94}%
																</span>
															</div>
															<span
																class="text-[13px] text-white/85 font-black font-mono leading-none"
																dir="ltr"
															>
																≈ {formatUsd(fairValueUsd())} USD
															</span>
														</div>
													</div>
												</div>
											</div>
										</Show>

										{/* HERO MODE 2: Telegram Profile Wear Showcase Simulator */}
										<Show when={heroMode() === 'wear'}>
											<div class="w-full rounded-[32px] overflow-hidden border border-white/15 bg-[#12141C] shadow-2xl">
												<div
													class="p-6 relative flex flex-col items-center text-center overflow-hidden"
													style={{
														background: `radial-gradient(circle at 50% 30%, ${backdropColors().center_hex} 0%, ${backdropColors().edge_hex} 90%)`,
													}}
												>
													<span class="px-3 py-1 rounded-full bg-black/35 border border-white/15 text-[9px] font-mono font-bold text-white/80 mb-3 backdrop-blur-md">
														{tr(
															'شبیه‌ساز نمایش در هدر پروفایل تلگرام (Profile Wear)',
															'Telegram Profile Header Wear Preview',
														)}
													</span>
													<div class="relative w-24 h-24 rounded-full bg-black/35 border-2 border-white/30 flex items-center justify-center p-2 shadow-2xl">
														<img
															src={
																modelTrait()?.image_url ||
																rep().image_url ||
																`https://nft.fragment.com/gift/${parsedTarget().slug.replace(/_/g, '')}-${rep().serial_number}.webp`
															}
															alt={rep().display_title}
															class="w-full h-full object-contain drop-shadow-lg"
														/>
														<span
															class="absolute -bottom-1.5 px-2 py-0.5 rounded-full bg-[#0098EA] text-[9px] font-mono font-black text-white shadow"
															dir="ltr"
														>
															#{rep().serial_number}
														</span>
													</div>
													<div class="mt-3 flex items-center gap-1.5">
														<span class="text-[16px] font-black text-white">
															{rep().owner_intelligence?.owner_display ||
																rep().owner_name ||
																'Telegram Collector'}
														</span>
														<span class="material-symbols-outlined text-[17px] text-[#38bdf8]">
															verified
														</span>
													</div>
													<span class="text-[11px] text-white/75 font-mono mt-0.5">
														Wearing {rep().display_title} ·{' '}
														{backdropTrait()?.value}
													</span>
												</div>
												<div class="p-4 bg-[#08090D] flex items-center justify-between text-[11px]">
													<span class="text-white/55">
														{tr(
															'وضعیت نمایش در ویترین پروفایل:',
															'Profile Showcase Status:',
														)}
													</span>
													<span class="font-mono font-bold text-emerald-400">
														{tr(
															'فعال و قابل اتصال به Status تلگرام ✓',
															'Ready for Emoji Status & Profile Pin ✓',
														)}
													</span>
												</div>
											</div>
										</Show>

										{/* HERO MODE 3: Institutional Digital Certificate */}
										<Show when={heroMode() === 'cert'}>
											<div class="w-full bg-gradient-to-br from-[#12141C] via-[#0B0D14] to-[#08090D] border-2 border-[#0098EA]/35 rounded-[32px] p-5 flex flex-col gap-4 shadow-2xl relative overflow-hidden">
												<div class="flex items-center justify-between border-b border-white/10 pb-3">
													<div class="flex items-center gap-2">
														<span class="material-symbols-outlined text-[22px] text-[#0098EA]">
															workspace_premium
														</span>
														<div class="flex flex-col">
															<span class="text-[11px] font-black uppercase tracking-wider text-white">
																{tr(
																	'گواهی رسمی کارشناسی iFragment',
																	'iFRAGMENT INSTITUTIONAL CERTIFICATE',
																)}
															</span>
															<span
																class="text-[9px] font-mono text-white/45"
																dir="ltr"
															>
																{rep().certificate_id ||
																	`IFRAG-GIFT-${rep().gift_id.toUpperCase()}`}
															</span>
														</div>
													</div>
													<span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-[9px] font-mono font-black">
														VERIFIED TEP-62
													</span>
												</div>

												<div class="grid grid-cols-2 gap-2.5 text-[11px]">
													<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-3 flex flex-col gap-0.5">
														<span class="text-[9px] text-white/40 uppercase font-mono">
															{tr('دارایی مورد ارزیابی', 'ASSET TITLE')}
														</span>
														<span
															class="font-mono font-black text-white text-[13px]"
															dir="ltr"
														>
															{rep().display_title}
														</span>
													</div>
													<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-3 flex flex-col gap-0.5">
														<span class="text-[9px] text-white/40 uppercase font-mono">
															{tr('ارزش منصفانه (P50)', 'FAIR VALUE (P50)')}
														</span>
														<span
															class="font-mono font-black text-[#38bdf8] text-[13px]"
															dir="ltr"
														>
															{formatTon(fairValueTon())} TON (
															{formatUsd(fairValueUsd())})
														</span>
													</div>
													<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-3 flex flex-col gap-0.5">
														<span class="text-[9px] text-white/40 uppercase font-mono">
															{tr('امتیاز کمیابی ترکیبی', 'HARMONIC RARITY')}
														</span>
														<span
															class="font-mono font-black text-amber-400 text-[13px]"
															dir="ltr"
														>
															{rep().rarity_score}/100 (Rank #
															{rep().rarity_rank})
														</span>
													</div>
													<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-3 flex flex-col gap-0.5">
														<span class="text-[9px] text-white/40 uppercase font-mono">
															{tr('موتور ارزش‌گذاری', 'VALUATION ENGINE')}
														</span>
														<span
															class="font-mono font-bold text-white/85 text-[11px]"
															dir="ltr"
														>
															{rep().model_version || 'GV Engine v4.2'}
														</span>
													</div>
												</div>
											</div>
										</Show>

										{/* Share Story & Export Certificate Buttons */}
										<div class="w-full grid grid-cols-2 gap-2.5">
											<button
												type="button"
												onClick={handleShareCertificateStory}
												disabled={sharingStory()}
												class="h-11 bg-[#0098EA] hover:bg-[#0086cf] text-white font-black text-[11px] uppercase tracking-wider rounded-[16px] flex items-center justify-center gap-1.5 shadow-[0_6px_20px_rgba(0,152,234,0.3)] active:scale-95 transition-all"
											>
												<span class="material-symbols-outlined text-[17px]">
													auto_awesome
												</span>
												<span>
													{sharingStory()
														? tr('در حال ساخت...', 'Preparing...')
														: tr('اشتراک در استوری', 'Share Story')}
												</span>
											</button>
											<button
												type="button"
												onClick={handleDownloadCertificate}
												disabled={downloadingCert()}
												class="h-11 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-[11px] uppercase tracking-wider rounded-[16px] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
											>
												<span class="material-symbols-outlined text-[17px]">
													download
												</span>
												<span>
													{downloadingCert()
														? tr('در حال ذخیره...', 'Saving...')
														: tr('ذخیره کارت کارشناسی', 'Save Certificate')}
												</span>
											</button>
										</div>

										{/* ═══════ 4-FLOOR MATRIX CARD (Collection / Model / Backdrop / Symbol) ═══════ */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3 shadow-xl text-start">
											<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[19px] text-[#0098EA]">
														grid_on
													</span>
													<div class="flex flex-col">
														<span class="text-[12px] font-black uppercase tracking-wider text-white">
															{tr(
																'ماتریس ۴گانه کف قیمت (4-Floor Matrix)',
																'4-AXIS TRAIT FLOOR MATRIX',
															)}
														</span>
														<span class="text-[10px] text-white/45">
															{tr(
																'مقایسه کف کلکسیون با کف واقعی مدل، پس‌زمینه و نماد',
																'Collection Floor vs Exact Model, Backdrop & Symbol Floors',
															)}
														</span>
													</div>
												</div>
												<span class="px-2 py-1 rounded-[8px] bg-[#0098EA]/15 border border-[#0098EA]/35 text-[9px] font-mono font-black text-[#38bdf8] uppercase">
													{rep().floor_matrix?.dominant_floor_driver === 'model'
														? 'MODEL DRIVEN'
														: rep().floor_matrix?.dominant_floor_driver ===
																'backdrop'
															? 'BACKDROP DRIVEN'
															: rep().floor_matrix?.dominant_floor_driver ===
																	'serial_grail'
																? 'SERIAL GRAIL'
																: 'FLOOR ANCHORED'}
												</span>
											</div>

											<div class="grid grid-cols-2 gap-2.5">
												{/* 1. Collection Floor */}
												<a
													href={
														rep().floor_matrix?.collection_floor_url ||
														`https://fragment.com/gifts/${parsedTarget().slug.replace(/_/g, '')}`
													}
													target="_blank"
													rel="noreferrer"
													class="bg-[#08090D] hover:bg-white/[0.03] border border-white/8 rounded-[16px] p-3 flex flex-col gap-1 transition-all"
												>
													<div class="flex items-center justify-between">
														<span class="text-[9px] font-mono font-bold text-white/45 uppercase">
															{tr('۱. کف کلکسیون', '1. COLLECTION FLOOR')}
														</span>
														<span class="material-symbols-outlined text-[13px] text-white/30">
															open_in_new
														</span>
													</div>
													<span
														class="text-[15px] font-mono font-black text-white"
														dir="ltr"
													>
														{formatTon(collectionFloorTon())} TON
													</span>
													<span
														class="text-[10px] font-mono text-white/45"
														dir="ltr"
													>
														≈{' '}
														{formatUsd(
															rep().floor_matrix?.collection_floor_usd ||
																collectionFloorTon() *
																	(rep().gram_usd_rate || 1.5),
														)}
													</span>
												</a>

												{/* 2. Exact Model Floor */}
												<a
													href={
														rep().floor_matrix?.model_floor_url ||
														`https://fragment.com/gifts/${parsedTarget().slug.replace(/_/g, '')}`
													}
													target="_blank"
													rel="noreferrer"
													class={`bg-[#08090D] hover:bg-white/[0.03] border rounded-[16px] p-3 flex flex-col gap-1 transition-all ${
														rep().floor_matrix?.dominant_floor_driver ===
														'model'
															? 'border-[#0098EA]/50 bg-[#0098EA]/5'
															: 'border-white/8'
													}`}
												>
													<div class="flex items-center justify-between">
														<span class="text-[9px] font-mono font-bold text-[#38bdf8] uppercase truncate">
															{tr('۲. کف مدل:', '2. MODEL:')}{' '}
															{rep().floor_matrix?.model_name ||
																modelTrait()?.value}
														</span>
														<span class="text-[9px] font-mono text-white/40">
															{rep().floor_matrix?.model_rarity_pct ||
																modelTrait()?.percentile ||
																1.5}
															%
														</span>
													</div>
													<span
														class="text-[15px] font-mono font-black text-emerald-400"
														dir="ltr"
													>
														{formatTon(
															rep().floor_matrix?.model_floor_gram ||
																modelTrait()?.floor_gram ||
																collectionFloorTon(),
														)}{' '}
														TON
													</span>
													<span
														class="text-[10px] font-mono text-white/45"
														dir="ltr"
													>
														≈{' '}
														{formatUsd(
															rep().floor_matrix?.model_floor_usd ||
																modelTrait()?.floor_usd,
														)}
													</span>
												</a>

												{/* 3. Exact Backdrop Floor */}
												<a
													href={
														rep().floor_matrix?.backdrop_floor_url ||
														`https://fragment.com/gifts/${parsedTarget().slug.replace(/_/g, '')}`
													}
													target="_blank"
													rel="noreferrer"
													class={`bg-[#08090D] hover:bg-white/[0.03] border rounded-[16px] p-3 flex flex-col gap-1 transition-all ${
														rep().floor_matrix?.dominant_floor_driver ===
														'backdrop'
															? 'border-[#0098EA]/50 bg-[#0098EA]/5'
															: 'border-white/8'
													}`}
												>
													<div class="flex items-center justify-between">
														<span class="text-[9px] font-mono font-bold text-purple-300 uppercase truncate">
															{tr('۳. کف پس‌زمینه:', '3. BACKDROP:')}{' '}
															{rep().floor_matrix?.backdrop_name ||
																backdropTrait()?.value}
														</span>
														<span class="text-[9px] font-mono text-white/40">
															{rep().floor_matrix?.backdrop_rarity_pct ||
																backdropTrait()?.percentile ||
																2.0}
															%
														</span>
													</div>
													<span
														class="text-[15px] font-mono font-black text-white"
														dir="ltr"
													>
														{formatTon(
															rep().floor_matrix?.backdrop_floor_gram ||
																backdropTrait()?.floor_gram ||
																collectionFloorTon(),
														)}{' '}
														TON
													</span>
													<span
														class="text-[10px] font-mono text-white/45"
														dir="ltr"
													>
														≈{' '}
														{formatUsd(
															rep().floor_matrix?.backdrop_floor_usd ||
																backdropTrait()?.floor_usd,
														)}
													</span>
												</a>

												{/* 4. Exact Symbol Floor */}
												<a
													href={
														rep().floor_matrix?.symbol_floor_url ||
														`https://fragment.com/gifts/${parsedTarget().slug.replace(/_/g, '')}`
													}
													target="_blank"
													rel="noreferrer"
													class="bg-[#08090D] hover:bg-white/[0.03] border border-white/8 rounded-[16px] p-3 flex flex-col gap-1 transition-all"
												>
													<div class="flex items-center justify-between">
														<span class="text-[9px] font-mono font-bold text-amber-300 uppercase truncate">
															{tr('۴. کف نماد:', '4. SYMBOL:')}{' '}
															{rep().floor_matrix?.symbol_name ||
																symbolTrait()?.value}
														</span>
														<span class="text-[9px] font-mono text-white/40">
															{rep().floor_matrix?.symbol_rarity_pct ||
																symbolTrait()?.percentile ||
																1.2}
															%
														</span>
													</div>
													<span
														class="text-[15px] font-mono font-black text-white"
														dir="ltr"
													>
														{formatTon(
															rep().floor_matrix?.symbol_floor_gram ||
																symbolTrait()?.floor_gram ||
																collectionFloorTon(),
														)}{' '}
														TON
													</span>
													<span
														class="text-[10px] font-mono text-white/45"
														dir="ltr"
													>
														≈{' '}
														{formatUsd(
															rep().floor_matrix?.symbol_floor_usd ||
																symbolTrait()?.floor_usd,
														)}
													</span>
												</a>
											</div>

											<Show
												when={
													rep().floor_matrix?.driver_explanation_fa ||
													rep().recommendation?.summary_fa
												}
											>
												<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-3 text-[11px] text-white/80 leading-relaxed">
													<span class="text-[#38bdf8] font-black">
														{tr('تحلیل محرک قیمت: ', 'Price Driver Analysis: ')}
													</span>
													{isRtl()
														? rep().floor_matrix?.driver_explanation_fa ||
															rep().recommendation?.summary_fa
														: rep().floor_matrix?.driver_explanation_en ||
															rep().recommendation?.summary_en}
												</div>
											</Show>
										</div>

										{/* ═══════ 4-PILLAR VALUATION & P10 / P50 / P90 QUANTITATIVE BAND ═══════ */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3.5 shadow-xl text-start">
											<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[19px] text-[#0098EA]">
														analytics
													</span>
													<span class="text-[12px] font-black uppercase tracking-wider text-white">
														{tr(
															'ارزش‌گذاری ۴ پایه‌ای (P10 / P50 / P90 & Stars)',
															'4-PILLAR BAYESIAN VALUATION BAND',
														)}
													</span>
												</div>
												<span class="text-[10px] font-mono font-bold text-emerald-400">
													{rep().confidence_score || 94}% Confidence
												</span>
											</div>

											<div class="grid grid-cols-3 gap-2 text-center">
												<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
													<span class="text-[9px] font-mono font-bold text-white/45 uppercase">
														{tr('نقدشوندگی سریع (P10)', 'LIQUIDATION (P10)')}
													</span>
													<span
														class="text-[13px] font-mono font-black text-emerald-400"
														dir="ltr"
													>
														{formatTon(liquidationTon())} TON
													</span>
													<span
														class="text-[9px] font-mono text-white/40"
														dir="ltr"
													>
														≈{' '}
														{formatUsd(
															rep().pillars?.liquidation_value_usd ||
																rep().low_usd,
														)}
													</span>
												</div>

												<div class="bg-[#0098EA]/12 border border-[#0098EA]/40 rounded-[14px] p-2.5 flex flex-col gap-0.5">
													<span class="text-[9px] font-mono font-black text-[#38bdf8] uppercase">
														{tr('ارزش منصفانه (P50)', 'FAIR VALUE (P50)')}
													</span>
													<span
														class="text-[15px] font-mono font-black text-white"
														dir="ltr"
													>
														{formatTon(fairValueTon())} TON
													</span>
													<span
														class="text-[9px] font-mono text-[#38bdf8]"
														dir="ltr"
													>
														≈ {formatUsd(fairValueUsd())}
													</span>
												</div>

												<div class="bg-[#08090D] border border-white/5 rounded-[14px] p-2.5 flex flex-col gap-0.5">
													<span class="text-[9px] font-mono font-bold text-white/45 uppercase">
														{tr('پیشنهاد فروش (P90)', 'OPTIMAL ASK (P90)')}
													</span>
													<span
														class="text-[13px] font-mono font-black text-amber-400"
														dir="ltr"
													>
														{formatTon(suggestedAskTon())} TON
													</span>
													<span
														class="text-[9px] font-mono text-white/40"
														dir="ltr"
													>
														≈{' '}
														{formatUsd(
															rep().pillars?.suggested_ask_usd ||
																rep().high_usd,
														)}
													</span>
												</div>
											</div>

											{/* Interactive Offer & Seller Net Proceeds Calculator */}
											<div class="bg-[#08090D] border border-white/8 rounded-[18px] p-3.5 flex flex-col gap-2.5">
												<div class="flex items-center justify-between">
													<span class="text-[11px] font-black text-white">
														{tr(
															'ماشین‌حساب پیشنهاد خرید و دریافتی خالص فروشنده',
															'Interactive Offer & Net Seller Proceeds Simulator',
														)}
													</span>
													<span
														class="text-[11px] font-mono font-black text-[#38bdf8]"
														dir="ltr"
													>
														{formatTon(activeOfferTon())} TON
													</span>
												</div>

												<input
													type="range"
													min={Math.max(
														1,
														Math.round(liquidationTon() * 0.7),
													)}
													max={Math.max(
														10,
														Math.round(suggestedAskTon() * 1.4),
													)}
													step={1}
													value={activeOfferTon()}
													onInput={(e) =>
														setCustomOfferTon(
															Number.parseFloat(e.currentTarget.value),
														)
													}
													class="w-full accent-[#0098EA] cursor-pointer"
												/>

												<div class="grid grid-cols-3 gap-2 pt-1 text-center text-[10px] font-mono">
													<div class="bg-[#12141C] rounded-[10px] p-2 border border-white/5">
														<div class="text-white/40">Portals (2.5%)</div>
														<div class="text-emerald-400 font-black mt-0.5">
															{formatTon(activeOfferTon() * 0.975 - 0.05)} TON
														</div>
													</div>
													<div class="bg-[#12141C] rounded-[10px] p-2 border border-white/5">
														<div class="text-white/40">Tonnel (3.5%)</div>
														<div class="text-white font-black mt-0.5">
															{formatTon(activeOfferTon() * 0.965 - 0.03)} TON
														</div>
													</div>
													<div class="bg-[#12141C] rounded-[10px] p-2 border border-white/5">
														<div class="text-white/40">Fragment (5%)</div>
														<div class="text-amber-300 font-black mt-0.5">
															{formatTon(activeOfferTon() * 0.95 - 0.08)} TON
														</div>
													</div>
												</div>
											</div>
										</div>

										{/* ═══════ MULTI-VENUE EXIT PLANNER (6 Marketplaces) ═══════ */}
										<Show when={rep().exit_planner?.options?.length}>
											<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3 shadow-xl text-start">
												<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
													<div class="flex items-center gap-2">
														<span class="material-symbols-outlined text-[19px] text-emerald-400">
															alt_route
														</span>
														<div class="flex flex-col">
															<span class="text-[12px] font-black uppercase tracking-wider text-white">
																{tr(
																	'مسیریاب فروش و مقایسه کارمزد مارکت‌پلیس‌ها',
																	'CROSS-VENUE EXIT PLANNER & FEE MATRIX',
																)}
															</span>
															<span class="text-[10px] text-white/45">
																{tr(
																	'رتبه‌بندی ۶ بازار بر اساس بیشترین دریافتی خالص پس از کسر کارمزد',
																	'Ranked by Highest Net Seller Payout After Protocol Fees',
																)}
															</span>
														</div>
													</div>
													<span class="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-mono font-black text-emerald-400">
														BEST: {rep().exit_planner?.best_venue_name}
													</span>
												</div>

												<div class="flex flex-col gap-2">
													<For each={rep().exit_planner?.options || []}>
														{(opt, idx) => (
															<div
																class={`rounded-[16px] p-3 border flex items-center justify-between gap-2 ${
																	idx() === 0
																		? 'bg-emerald-500/[0.07] border-emerald-500/35'
																		: 'bg-[#08090D] border-white/6'
																}`}
															>
																<div class="flex items-center gap-2.5 min-w-0">
																	<span
																		class={`w-6 h-6 rounded-lg font-mono font-black text-[11px] flex items-center justify-center shrink-0 ${
																			idx() === 0
																				? 'bg-emerald-500 text-black'
																				: 'bg-white/8 text-white/60'
																		}`}
																	>
																		#{opt.rank || idx() + 1}
																	</span>
																	<div class="flex flex-col min-w-0">
																		<div class="flex items-center gap-1.5">
																			<span class="text-[12px] font-black text-white truncate">
																				{opt.venue_name}
																			</span>
																			<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/8 text-white/65">
																				Fee {opt.fee_percent}%
																			</span>
																		</div>
																		<span class="text-[10px] text-white/45 truncate">
																			{opt.requires_kyc
																				? tr('نیازمند KYC', 'KYC Required')
																				: tr(
																						'بدون نیاز به احراز هویت',
																						'No KYC · Instant',
																					)}{' '}
																			· ~{opt.estimated_days_to_sell}d
																		</span>
																	</div>
																</div>

																<div class="flex items-center gap-2.5 shrink-0">
																	<div
																		class="flex flex-col items-end"
																		dir="ltr"
																	>
																		<span class="text-[13px] font-mono font-black text-emerald-400">
																			{formatTon(opt.net_payout_gram)} TON
																		</span>
																		<span class="text-[9px] font-mono text-white/45">
																			≈ {formatUsd(opt.net_payout_usd)}
																		</span>
																	</div>
																	<Show when={opt.deep_link}>
																		<a
																			href={opt.deep_link}
																			target="_blank"
																			rel="noreferrer"
																			class="w-8 h-8 rounded-[10px] bg-white/8 hover:bg-[#0098EA] text-white flex items-center justify-center transition-colors"
																		>
																			<span class="material-symbols-outlined text-[15px]">
																				open_in_new
																			</span>
																		</a>
																	</Show>
																</div>
															</div>
														)}
													</For>
												</div>
											</div>
										</Show>

										{/* ═══════ 12-MONTH GROWTH PROJECTION (Bull / Base / Bear) ═══════ */}
										<Show when={rep().projection}>
											<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3 shadow-xl text-start">
												<div class="flex items-center gap-2 border-b border-white/5 pb-2">
													<span class="material-symbols-outlined text-[18px] text-[#0098EA]">
														trending_up
													</span>
													<span class="text-[12px] font-black uppercase tracking-wider text-white">
														{tr(
															'چشم‌انداز سناریوهای قیمتی (Bull / Base / Bear)',
															'FORWARD VALUATION SCENARIOS',
														)}
													</span>
												</div>
												<div class="grid grid-cols-3 gap-2 text-center">
													<div class="bg-[#08090D] border border-rose-500/20 rounded-[14px] p-2.5">
														<div class="text-[9px] font-mono text-rose-400 font-bold">
															{tr('سناریوی رکودی', 'BEAR CASE')}
														</div>
														<div
															class="text-[13px] font-mono font-black text-white mt-1"
															dir="ltr"
														>
															{formatTon(rep().projection?.bear_gram)} TON
														</div>
														<div
															class="text-[9px] font-mono text-white/40"
															dir="ltr"
														>
															{formatUsd(rep().projection?.bear_usd)}
														</div>
													</div>
													<div class="bg-[#08090D] border border-[#0098EA]/30 rounded-[14px] p-2.5">
														<div class="text-[9px] font-mono text-[#38bdf8] font-bold">
															{tr('سناریوی پایه', 'BASE CASE')}
														</div>
														<div
															class="text-[13px] font-mono font-black text-white mt-1"
															dir="ltr"
														>
															{formatTon(rep().projection?.base_gram)} TON
														</div>
														<div
															class="text-[9px] font-mono text-white/40"
															dir="ltr"
														>
															{formatUsd(rep().projection?.base_usd)}
														</div>
													</div>
													<div class="bg-[#08090D] border border-emerald-500/25 rounded-[14px] p-2.5">
														<div class="text-[9px] font-mono text-emerald-400 font-bold">
															{tr('سناریوی صعودی', 'BULL CASE')}
														</div>
														<div
															class="text-[13px] font-mono font-black text-emerald-400 mt-1"
															dir="ltr"
														>
															{formatTon(rep().projection?.bull_gram)} TON
														</div>
														<div
															class="text-[9px] font-mono text-white/40"
															dir="ltr"
														>
															{formatUsd(rep().projection?.bull_usd)}
														</div>
													</div>
												</div>
											</div>
										</Show>
									</div>
								</Show>

								{/* ════════════════════════════════════════════════════════════════
								    TAB 2: 3-AXIS TRAIT DNA, COLOR HARMONY & WHAT-IF SIMULATOR
								    ════════════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'traits'}>
									<div class="w-full flex flex-col gap-3.5">
										{/* 3-Axis Trait DNA Breakdown */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3.5 shadow-xl text-start">
											<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[19px] text-[#0098EA]">
														biotech
													</span>
													<div class="flex flex-col">
														<span class="text-[12px] font-black uppercase tracking-wider text-white">
															{tr(
																'کالبدشکافی ۳ محور تریت (3-Axis Trait DNA)',
																'3-AXIS TRAIT DNA & SCARCITY',
															)}
														</span>
														<span class="text-[10px] text-white/45">
															{tr(
																'فراوانی دقیق، سطح کمیابی و کف قیمت مستقل هر ویژگی',
																'Exact Permille Rarity, Tier & Independent Trait Floor',
															)}
														</span>
													</div>
												</div>
												<span class="px-2.5 py-1 rounded-[8px] bg-purple-500/15 border border-purple-500/35 text-[9px] font-mono font-black text-purple-300">
													SCORE {rep().rarity_score}/100
												</span>
											</div>

											<div class="flex flex-col gap-2.5">
												<For each={rep().trait_dna || []}>
													{(bar) => (
														<div class="bg-[#08090D] border border-white/8 rounded-[18px] p-3.5 flex flex-col gap-2.5">
															<div class="flex items-center justify-between gap-2">
																<div class="flex items-center gap-2.5 min-w-0">
																	<Show
																		when={bar.image_url}
																		fallback={
																			<div
																				class="w-10 h-10 rounded-[12px] border border-white/20 shrink-0"
																				style={{
																					background: bar.colors
																						? `radial-gradient(circle, ${bar.colors.center_hex}, ${bar.colors.edge_hex})`
																						: '#1e293b',
																				}}
																			/>
																		}
																	>
																		<img
																			src={bar.image_url}
																			alt={bar.value}
																			class="w-10 h-10 rounded-[12px] object-contain bg-white/5 p-1 border border-white/10 shrink-0"
																			onError={(e) => {
																				e.currentTarget.style.display = 'none';
																			}}
																		/>
																	</Show>
																	<div class="flex flex-col min-w-0">
																		<span class="text-[10px] font-bold text-white/45">
																			{isRtl()
																				? bar.label_fa || bar.label_en
																				: bar.label_en || bar.label_fa}
																		</span>
																		<span
																			class="text-[14px] font-mono font-black text-white truncate"
																			dir="ltr"
																		>
																			{bar.value}
																		</span>
																	</div>
																</div>

																<div class="flex flex-col items-end shrink-0">
																	<div class="flex items-center gap-1.5">
																		<span class="px-2 py-0.5 rounded bg-[#0098EA]/15 border border-[#0098EA]/30 text-[9px] font-mono font-black text-[#38bdf8]">
																			{bar.percentile}%
																		</span>
																		<span class="px-2 py-0.5 rounded bg-white/8 text-[9px] font-mono font-bold text-white/75">
																			{bar.rarity_tier}
																		</span>
																	</div>
																	<Show when={bar.floor_gram}>
																		<span
																			class="text-[11px] font-mono font-black text-emerald-400 mt-1"
																			dir="ltr"
																		>
																			Floor: {formatTon(bar.floor_gram)} TON
																		</span>
																	</Show>
																</div>
															</div>

															{/* Rarity Progress Bar */}
															<div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
																<div
																	class="h-full bg-gradient-to-r from-[#0098EA] to-emerald-400 rounded-full"
																	style={{
																		width: `${Math.max(6, Math.min(100, 100 - (bar.percentile || 1) * 8))}%`,
																	}}
																/>
															</div>

															{/* Backdrop 4-Hex Swatches */}
															<Show when={bar.colors}>
																{(cols) => (
																	<div
																		class="grid grid-cols-4 gap-1.5 pt-1"
																		dir="ltr"
																	>
																		<For
																			each={[
																				{
																					label: 'Center',
																					hex: cols().center_hex,
																				},
																				{ label: 'Edge', hex: cols().edge_hex },
																				{
																					label: 'Pattern',
																					hex: cols().pattern_hex,
																				},
																				{ label: 'Text', hex: cols().text_hex },
																			]}
																		>
																			{(sw) => (
																				<button
																					type="button"
																					onClick={() =>
																						copyText(sw.hex, `hex_${sw.label}`)
																					}
																					class="bg-[#12141C] hover:bg-white/10 border border-white/8 rounded-[10px] p-1.5 flex items-center gap-1.5 transition-all"
																				>
																					<span
																						class="w-3.5 h-3.5 rounded-md border border-white/25 shrink-0"
																						style={{ background: sw.hex }}
																					/>
																					<div class="flex flex-col text-left min-w-0">
																						<span class="text-[8px] text-white/40 leading-none">
																							{sw.label}
																						</span>
																						<span class="text-[9px] font-mono font-bold text-white truncate">
																							{copiedKey() === `hex_${sw.label}`
																								? 'Copied!'
																								: sw.hex}
																						</span>
																					</div>
																				</button>
																			)}
																		</For>
																	</div>
																)}
															</Show>

															<Show when={bar.description}>
																<p class="text-[10px] text-white/55 leading-relaxed">
																	{bar.description}
																</p>
															</Show>
														</div>
													)}
												</For>
											</div>
										</div>

										{/* Joint Rarity, Serial Gravity & Color-Match Harmony */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3 shadow-xl text-start">
											<div class="flex items-center gap-2 border-b border-white/5 pb-2">
												<span class="material-symbols-outlined text-[18px] text-amber-400">
													auto_awesome
												</span>
												<span class="text-[12px] font-black uppercase tracking-wider text-white">
													{tr(
														'جاذبه شماره سریال و هماهنگی رنگ (Serial & Color Intel)',
														'SERIAL GRAVITY & CHROMATIC HARMONY',
													)}
												</span>
											</div>

											<div class="grid grid-cols-2 gap-2.5">
												<div class="bg-[#08090D] border border-white/6 rounded-[16px] p-3 flex flex-col gap-1">
													<span class="text-[9px] font-mono text-white/40 uppercase">
														{tr(
															'ضریب شماره سریال',
															'SERIAL GRAVITY MULTIPLIER',
														)}
													</span>
													<span
														class="text-[16px] font-mono font-black text-amber-400"
														dir="ltr"
													>
														#{rep().serial_number} ·{' '}
														{rep().serial_intel?.multiplier || 1}x
													</span>
													<span class="text-[10px] text-white/65">
														{rep().serial_intel?.description ||
															rep().serial_intel?.tier}
													</span>
												</div>

												<div class="bg-[#08090D] border border-white/6 rounded-[16px] p-3 flex flex-col gap-1">
													<span class="text-[9px] font-mono text-white/40 uppercase">
														{tr('آنتروپی و کمیابی مشترک', 'SURPRISAL ENTROPY')}
													</span>
													<span
														class="text-[16px] font-mono font-black text-[#38bdf8]"
														dir="ltr"
													>
														{rep().joint_rarity?.surprisal_bits || 14.2} bits
													</span>
													<span class="text-[10px] text-white/65">
														{rep().color_match_intel?.harmony_class ||
															'Standard Contrast'}
													</span>
												</div>
											</div>
										</div>

										{/* Interactive "What-If" Trait Simulator & Collection Catalog */}
										<Show when={rep().collection_catalog}>
											{(cat) => (
												<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-[#0098EA]/30 rounded-[26px] p-4 flex flex-col gap-3.5 shadow-xl text-start">
													<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
														<div class="flex items-center gap-2">
															<span class="material-symbols-outlined text-[19px] text-[#0098EA]">
																tune
															</span>
															<div class="flex flex-col">
																<span class="text-[12px] font-black uppercase tracking-wider text-white">
																	{tr(
																		'شبیه‌ساز تعاملی تریت (What-If Simulator)',
																		'INTERACTIVE TRAIT SIMULATOR & CATALOG',
																	)}
																</span>
																<span class="text-[10px] text-white/45">
																	{tr(
																		'تغییر مدل یا پس‌زمینه برای مشاهده تاثیر آنی بر قیمت گیفت',
																		'Test any Model, Backdrop or Symbol to recalculate Fair Value',
																	)}
																</span>
															</div>
														</div>
														<Show when={simulating()}>
															<span class="text-[10px] font-mono text-[#38bdf8] animate-pulse">
																{tr('در حال محاسبه...', 'Recalculating...')}
															</span>
														</Show>
													</div>

													<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
														<div class="flex flex-col gap-1">
															<span class="text-[9px] font-mono text-white/45">
																{tr('انتخاب مدل (Model):', 'Select Model:')}
															</span>
															<select
																value={simModel()}
																onChange={(e) => {
																	const v = e.currentTarget.value;
																	setSimModel(v);
																	void handleSimulateTraits(
																		v,
																		simBackdrop(),
																		simSymbol(),
																	);
																}}
																class="h-9 bg-[#08090D] border border-white/15 rounded-[10px] px-2.5 text-[11px] font-mono text-white focus:border-[#0098EA] focus:outline-none"
																dir="ltr"
															>
																<For each={cat().models}>
																	{(m) => (
																		<option value={m.name}>
																			{m.name} ({m.rarity_pct}%)
																		</option>
																	)}
																</For>
															</select>
														</div>

														<div class="flex flex-col gap-1">
															<span class="text-[9px] font-mono text-white/45">
																{tr(
																	'انتخاب پس‌زمینه (Backdrop):',
																	'Select Backdrop:',
																)}
															</span>
															<select
																value={simBackdrop()}
																onChange={(e) => {
																	const v = e.currentTarget.value;
																	setSimBackdrop(v);
																	void handleSimulateTraits(
																		simModel(),
																		v,
																		simSymbol(),
																	);
																}}
																class="h-9 bg-[#08090D] border border-white/15 rounded-[10px] px-2.5 text-[11px] font-mono text-white focus:border-[#0098EA] focus:outline-none"
																dir="ltr"
															>
																<For each={cat().backdrops}>
																	{(b) => (
																		<option value={b.name}>
																			{b.name} ({b.rarity_pct}%)
																		</option>
																	)}
																</For>
															</select>
														</div>

														<div class="flex flex-col gap-1">
															<span class="text-[9px] font-mono text-white/45">
																{tr('انتخاب نماد (Symbol):', 'Select Symbol:')}
															</span>
															<select
																value={simSymbol()}
																onChange={(e) => {
																	const v = e.currentTarget.value;
																	setSimSymbol(v);
																	void handleSimulateTraits(
																		simModel(),
																		simBackdrop(),
																		v,
																	);
																}}
																class="h-9 bg-[#08090D] border border-white/15 rounded-[10px] px-2.5 text-[11px] font-mono text-white focus:border-[#0098EA] focus:outline-none"
																dir="ltr"
															>
																<For each={cat().symbols}>
																	{(s) => (
																		<option value={s.name}>
																			{s.name} ({s.rarity_pct}%)
																		</option>
																	)}
																</For>
															</select>
														</div>
													</div>

													{/* Mini Collection Trait Catalog Browser */}
													<div class="flex items-center gap-1.5 pt-1">
														<button
															type="button"
															onClick={() => setCatalogSubTab('models')}
															class={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
																catalogSubTab() === 'models'
																	? 'bg-[#0098EA] text-white'
																	: 'bg-[#08090D] text-white/55'
															}`}
														>
															{tr('مدل‌ها', 'Models')} ({cat().models.length})
														</button>
														<button
															type="button"
															onClick={() => setCatalogSubTab('backdrops')}
															class={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
																catalogSubTab() === 'backdrops'
																	? 'bg-[#0098EA] text-white'
																	: 'bg-[#08090D] text-white/55'
															}`}
														>
															{tr('پس‌زمینه‌ها', 'Backdrops')} (
															{cat().backdrops.length})
														</button>
														<button
															type="button"
															onClick={() => setCatalogSubTab('symbols')}
															class={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
																catalogSubTab() === 'symbols'
																	? 'bg-[#0098EA] text-white'
																	: 'bg-[#08090D] text-white/55'
															}`}
														>
															{tr('نمادها', 'Symbols')} ({cat().symbols.length})
														</button>
													</div>

													<div class="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1">
														<For
															each={
																catalogSubTab() === 'models'
																	? cat().models.slice(0, 24)
																	: catalogSubTab() === 'backdrops'
																		? cat().backdrops.slice(0, 24)
																		: cat().symbols.slice(0, 24)
															}
														>
															{(item) => (
																<button
																	type="button"
																	onClick={() => {
																		if (catalogSubTab() === 'models') {
																			setSimModel(item.name);
																			void handleSimulateTraits(
																				item.name,
																				simBackdrop(),
																				simSymbol(),
																			);
																		} else if (
																			catalogSubTab() === 'backdrops'
																		) {
																			setSimBackdrop(item.name);
																			void handleSimulateTraits(
																				simModel(),
																				item.name,
																				simSymbol(),
																			);
																		} else {
																			setSimSymbol(item.name);
																			void handleSimulateTraits(
																				simModel(),
																				simBackdrop(),
																				item.name,
																			);
																		}
																	}}
																	class="bg-[#08090D] hover:bg-white/5 border border-white/6 rounded-[12px] p-2 flex items-center justify-between gap-2 text-left transition-all"
																	dir="ltr"
																>
																	<div class="flex items-center gap-2 min-w-0">
																		<Show when={item.center_hex}>
																			<span
																				class="w-4 h-4 rounded-full border border-white/20 shrink-0"
																				style={{
																					background: `radial-gradient(circle, ${item.center_hex}, ${item.edge_hex || item.center_hex})`,
																				}}
																			/>
																		</Show>
																		<span class="text-[10px] font-mono font-bold text-white truncate">
																			{item.name}
																		</span>
																	</div>
																	<span class="text-[9px] font-mono text-[#38bdf8] shrink-0">
																		{item.rarity_pct}%
																	</span>
																</button>
															)}
														</For>
													</div>
												</div>
											)}
										</Show>

										{/* Same-Serial Cross-Collection Siblings */}
										<Show when={rep().same_serial_siblings?.length}>
											<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3 shadow-xl text-start">
												<div class="flex items-center justify-between border-b border-white/5 pb-2">
													<div class="flex items-center gap-2">
														<span class="material-symbols-outlined text-[18px] text-[#0098EA]">
															tag
														</span>
														<span class="text-[12px] font-black uppercase tracking-wider text-white">
															{tr(
																`هم‌ترازهای سریال #${rep().serial_number} در سایر کلکسیون‌ها`,
																`SAME-SERIAL #${rep().serial_number} SIBLINGS`,
															)}
														</span>
													</div>
												</div>

												<div class="grid grid-cols-2 gap-2">
													<For each={rep().same_serial_siblings || []}>
														{(sib) => (
															<button
																type="button"
																onClick={() => selectQuickGift(sib.gift_id)}
																class="bg-[#08090D] hover:bg-white/5 border border-white/8 rounded-[14px] p-2.5 flex items-center justify-between gap-2 transition-all text-start"
															>
																<div class="flex flex-col min-w-0">
																	<span
																		class="text-[11px] font-mono font-black text-white truncate"
																		dir="ltr"
																	>
																		{sib.collection_name} #{sib.serial_number}
																	</span>
																	<span
																		class="text-[10px] font-mono text-emerald-400 font-bold"
																		dir="ltr"
																	>
																		~{formatTon(sib.estimated_serial_value_gram)}{' '}
																		TON
																	</span>
																</div>
																<span class="material-symbols-outlined text-[15px] text-white/35">
																	arrow_outward
																</span>
															</button>
														)}
													</For>
												</div>
											</div>
										</Show>
									</div>
								</Show>

								{/* ════════════════════════════════════════════════════════════════
								    TAB 3: ON-CHAIN CUSTODY, WHALE OWNER INTEL & PROVENANCE
								    ════════════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'onchain'}>
									<div class="w-full flex flex-col gap-3.5">
										{/* Custody, Host Profile & Whale Owner Intelligence */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3.5 shadow-xl text-start">
											<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[19px] text-[#0098EA]">
														shield_person
													</span>
													<div class="flex flex-col">
														<span class="text-[12px] font-black uppercase tracking-wider text-white">
															{tr(
																'اطلاعات مالک، کیف‌پول و وضعیت نگهداری (Custody)',
																'OWNER INTELLIGENCE & ON-CHAIN CUSTODY',
															)}
														</span>
														<span class="text-[10px] text-white/45">
															{rep().upgrade_info?.custody_notice}
														</span>
													</div>
												</div>
												<span class="px-2.5 py-1 rounded-[8px] bg-emerald-500/15 border border-emerald-500/35 text-[9px] font-mono font-black text-emerald-400">
													{rep().custody_type === 'on_chain_nft'
														? 'TEP-62 ON-CHAIN'
														: 'TELEGRAM CUSTODY'}
												</span>
											</div>

											<div class="grid grid-cols-2 gap-2.5">
												<div class="bg-[#08090D] border border-white/6 rounded-[16px] p-3 flex flex-col gap-1">
													<span class="text-[9px] font-mono text-white/40 uppercase">
														{tr('مالک / میزبان پروفایل', 'CURRENT OWNER / HOST')}
													</span>
													<span
														class="text-[13px] font-mono font-black text-white truncate"
														dir="ltr"
													>
														{rep().owner_intelligence?.owner_display ||
															rep().host_profile?.host_name ||
															rep().owner_name ||
															'Verified Collector'}
													</span>
													<span class="text-[10px] text-[#38bdf8] font-bold truncate">
														{rep().owner_intelligence?.whale_tier_fa ||
															rep().owner_intelligence?.whale_tier ||
															'Active Holder'}
													</span>
												</div>

												<div class="bg-[#08090D] border border-white/6 rounded-[16px] p-3 flex flex-col gap-1">
													<span class="text-[9px] font-mono text-white/40 uppercase">
														{tr('آدرس کیف‌پول TON', 'TON WALLET ADDRESS')}
													</span>
													<div class="flex items-center justify-between gap-1">
														<span
															class="text-[11px] font-mono font-bold text-white/85 truncate"
															dir="ltr"
														>
															{rep().owner_wallet?.wallet_address ||
																rep().on_chain?.owner_address ||
																'Telegram Off-Chain Vault'}
														</span>
														<Show
															when={
																rep().owner_wallet?.wallet_address ||
																rep().on_chain?.owner_address
															}
														>
															<button
																type="button"
																onClick={() =>
																	copyText(
																		rep().owner_wallet?.wallet_address ||
																			rep().on_chain?.owner_address ||
																			'',
																		'owner_addr',
																	)
																}
																class="text-[#38bdf8] text-[10px] font-mono shrink-0"
															>
																{copiedKey() === 'owner_addr' ? '✓' : 'Copy'}
															</button>
														</Show>
													</div>
													<span class="text-[10px] text-white/45 truncate">
														{rep().owner_wallet?.is_escrow
															? rep().owner_wallet?.escrow_name
															: tr('نگهداری غیرامانی', 'Self-Custody')}
													</span>
												</div>
											</div>

											{/* Direct Protocol & Explorer Links */}
											<div class="grid grid-cols-3 gap-2 pt-1">
												<a
													href={
														rep().on_chain?.marketplace_links?.fragment ||
														`https://fragment.com/gift/${parsedTarget().slug.replace(/_/g, '')}-${rep().serial_number}`
													}
													target="_blank"
													rel="noreferrer"
													class="h-9 rounded-[11px] bg-[#0098EA]/15 hover:bg-[#0098EA]/25 border border-[#0098EA]/35 text-[#38bdf8] font-mono font-black text-[10px] flex items-center justify-center gap-1"
												>
													<span>Fragment</span>
													<span class="material-symbols-outlined text-[13px]">
														open_in_new
													</span>
												</a>
												<a
													href={
														rep().binary_forensics?.tme_nft_url ||
														rep().on_chain?.marketplace_links?.tme_nft ||
														`https://t.me/nft`
													}
													target="_blank"
													rel="noreferrer"
													class="h-9 rounded-[11px] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-mono font-bold text-[10px] flex items-center justify-center gap-1"
												>
													<span>t.me/nft</span>
													<span class="material-symbols-outlined text-[13px]">
														open_in_new
													</span>
												</a>
												<a
													href={
														rep().on_chain?.tonviewer_url ||
														'https://tonviewer.com'
													}
													target="_blank"
													rel="noreferrer"
													class="h-9 rounded-[11px] bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-mono font-bold text-[10px] flex items-center justify-center gap-1"
												>
													<span>Tonviewer</span>
													<span class="material-symbols-outlined text-[13px]">
														open_in_new
													</span>
												</a>
											</div>
										</div>

										{/* Provenance & Ownership History Timeline */}
										<Show when={rep().provenance?.length}>
											<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3 shadow-xl text-start">
												<div class="flex items-center gap-2 border-b border-white/5 pb-2">
													<span class="material-symbols-outlined text-[18px] text-[#0098EA]">
														history
													</span>
													<span class="text-[12px] font-black uppercase tracking-wider text-white">
														{tr(
															'تاریخچه منشأ و معاملات زنجیره (Provenance)',
															'ON-CHAIN PROVENANCE TIMELINE',
														)}
													</span>
												</div>

												<div class="flex flex-col gap-2">
													<For each={rep().provenance || []}>
														{(ev) => (
															<div class="bg-[#08090D] border border-white/6 rounded-[14px] p-3 flex items-center justify-between gap-2">
																<div class="flex items-center gap-2.5 min-w-0">
																	<span class="w-8 h-8 rounded-xl bg-[#0098EA]/15 border border-[#0098EA]/30 text-[#38bdf8] flex items-center justify-center shrink-0">
																		<span class="material-symbols-outlined text-[16px]">
																			{ev.event_type === 'upgraded'
																				? 'auto_awesome'
																				: 'swap_horiz'}
																		</span>
																	</span>
																	<div class="flex flex-col min-w-0">
																		<span class="text-[11px] font-bold text-white truncate">
																			{ev.note ||
																				`${ev.event_type.toUpperCase()} on ${ev.venue || 'TON'}`}
																		</span>
																		<span class="text-[9px] font-mono text-white/45">
																			{formatDateLocale(ev.timestamp)} ·{' '}
																			{ev.venue || 'TON Blockchain'}
																		</span>
																	</div>
																</div>

																<div class="flex items-center gap-2 shrink-0">
																	<Show when={ev.price_gram}>
																		<span
																			class="text-[12px] font-mono font-black text-emerald-400"
																			dir="ltr"
																		>
																			{formatTon(ev.price_gram)} TON
																		</span>
																	</Show>
																	<Show when={ev.tonviewer_url}>
																		<a
																			href={ev.tonviewer_url}
																			target="_blank"
																			rel="noreferrer"
																			class="text-white/40 hover:text-white"
																		>
																			<span class="material-symbols-outlined text-[15px]">
																				open_in_new
																			</span>
																		</a>
																	</Show>
																</div>
															</div>
														)}
													</For>
												</div>
											</div>
										</Show>

										{/* Binary & MTProto Forensics */}
										<Show when={rep().binary_forensics}>
											{(bf) => (
												<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3 shadow-xl text-start">
													<div class="flex items-center justify-between border-b border-white/5 pb-2">
														<div class="flex items-center gap-2">
															<span class="material-symbols-outlined text-[18px] text-purple-400">
																terminal
															</span>
															<span class="text-[12px] font-black uppercase tracking-wider text-white">
																{tr(
																	'کالبدشکافی باینری و استاندارد MTProto / TEP-62',
																	'MTPROTO & TEP-62 BINARY FORENSICS',
																)}
															</span>
														</div>
													</div>

													<div class="grid grid-cols-2 gap-2 text-[10px] font-mono">
														<div class="bg-[#08090D] border border-white/5 rounded-[12px] p-2.5">
															<div class="text-white/40">TL Constructor</div>
															<div
																class="text-[#38bdf8] font-bold truncate mt-0.5"
																dir="ltr"
															>
																{bf().mtproto_constructor}
															</div>
														</div>
														<div class="bg-[#08090D] border border-white/5 rounded-[12px] p-2.5">
															<div class="text-white/40">Upgraded Supply</div>
															<div
																class="text-emerald-400 font-bold mt-0.5"
																dir="ltr"
															>
																{bf().issued_count.toLocaleString()} /{' '}
																{bf().total_supply_count.toLocaleString()} (
																{bf().upgraded_percentage}%)
															</div>
														</div>
													</div>

													<div class="grid grid-cols-3 gap-2 pt-1">
														<a
															href={bf().lottie_url}
															target="_blank"
															rel="noreferrer"
															class="h-8 rounded-[10px] bg-[#08090D] hover:bg-white/5 border border-white/10 text-[10px] font-mono text-white/75 flex items-center justify-center gap-1"
														>
															<span>Lottie JSON</span>
															<span class="material-symbols-outlined text-[12px]">
																open_in_new
															</span>
														</a>
														<a
															href={bf().webp_url}
															target="_blank"
															rel="noreferrer"
															class="h-8 rounded-[10px] bg-[#08090D] hover:bg-white/5 border border-white/10 text-[10px] font-mono text-white/75 flex items-center justify-center gap-1"
														>
															<span>Official WebP</span>
															<span class="material-symbols-outlined text-[12px]">
																open_in_new
															</span>
														</a>
														<a
															href={bf().metadata_json_url}
															target="_blank"
															rel="noreferrer"
															class="h-8 rounded-[10px] bg-[#08090D] hover:bg-white/5 border border-white/10 text-[10px] font-mono text-white/75 flex items-center justify-center gap-1"
														>
															<span>TEP-64 JSON</span>
															<span class="material-symbols-outlined text-[12px]">
																open_in_new
															</span>
														</a>
													</div>
												</div>
											)}
										</Show>
									</div>
								</Show>

								{/* ════════════════════════════════════════════════════════════════
								    TAB 4: COMPARABLE SALES, ACTIVE ORDERBOOK, CRAFTING & RISK AUDIT
								    ════════════════════════════════════════════════════════════════ */}
								<Show when={activeTab() === 'comps'}>
									<div class="w-full flex flex-col gap-3.5">
										{/* Settled Comparable Sales & SVG Price Trajectory */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3.5 shadow-xl text-start">
											<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[19px] text-[#0098EA]">
														ssid_chart
													</span>
													<div class="flex flex-col">
														<span class="text-[12px] font-black uppercase tracking-wider text-white">
															{tr(
																'معاملات مشابه تسویه‌شده (Verified Comps)',
																'SETTLED COMPARABLE SALES',
															)}
														</span>
														<span class="text-[10px] text-white/45">
															{tr(
																'معاملات واقعی ثبت‌شده برای همین مدل، پس‌زمینه و کلکسیون',
																'Real settled trades for matching Model, Backdrop & Collection',
															)}
														</span>
													</div>
												</div>
												<span class="text-[10px] font-mono font-bold text-[#38bdf8]">
													{filteredComps().length} Deals
												</span>
											</div>

											{/* Comp Filter Pills */}
											<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
												<For
													each={[
														{
															id: 'all' as const,
															label: tr('همه معاملات', 'All Sales'),
														},
														{
															id: 'exact_model' as const,
															label: tr('همین مدل', 'Exact Model'),
														},
														{
															id: 'exact_backdrop' as const,
															label: tr('همین پس‌زمینه', 'Exact Backdrop'),
														},
														{
															id: 'collection_floor' as const,
															label: tr('کف کلکسیون', 'Collection'),
														},
													]}
												>
													{(f) => (
														<button
															type="button"
															onClick={() => setCompFilter(f.id)}
															class={`px-2.5 py-1 rounded-[10px] text-[10px] font-bold whitespace-nowrap transition-all ${
																compFilter() === f.id
																	? 'bg-[#0098EA] text-white'
																	: 'bg-[#08090D] text-white/55 hover:text-white'
															}`}
														>
															{f.label}
														</button>
													)}
												</For>
											</div>

											{/* SVG Price Trajectory Chart */}
											<Show when={compChartPoints().length > 1}>
												<div class="w-full h-32 bg-[#08090D] border border-white/5 rounded-[16px] p-2 relative">
													<svg
														viewBox="0 0 100 100"
														preserveAspectRatio="none"
														class="w-full h-full overflow-visible"
													>
														<polyline
															fill="none"
															stroke="#0098EA"
															stroke-width="2"
															points={compChartPoints()
																.map((p) => `${p.x},${p.y}`)
																.join(' ')}
														/>
														<For each={compChartPoints()}>
															{(pt) => (
																<circle
																	cx={pt.x}
																	cy={pt.y}
																	r="2.5"
																	fill="#38bdf8"
																/>
															)}
														</For>
													</svg>
												</div>
											</Show>

											<div class="flex flex-col gap-2">
												<For each={filteredComps()}>
													{(comp) => (
														<a
															href={
																comp.tonviewer_url ||
																`https://fragment.com/gifts`
															}
															target="_blank"
															rel="noreferrer"
															class="bg-[#08090D] hover:bg-white/[0.03] border border-white/6 rounded-[14px] p-3 flex items-center justify-between gap-2 transition-all"
														>
															<div class="flex items-center gap-2.5 min-w-0">
																<span
																	class="px-2 py-1 rounded-lg bg-white/8 text-[10px] font-mono font-black text-white shrink-0"
																	dir="ltr"
																>
																	#{comp.serial_number}
																</span>
																<div class="flex flex-col min-w-0">
																	<span class="text-[11px] font-bold text-white truncate">
																		{comp.model_id} · {comp.backdrop_name}
																	</span>
																	<span class="text-[9px] font-mono text-white/45">
																		{comp.venue} ·{' '}
																		{formatDateLocale(comp.sale_date)}
																	</span>
																</div>
															</div>

															<div
																class="flex flex-col items-end shrink-0"
																dir="ltr"
															>
																<span class="text-[13px] font-mono font-black text-emerald-400">
																	{formatTon(comp.sale_price_gram)} TON
																</span>
																<span class="text-[9px] font-mono text-white/45">
																	≈ {formatUsd(comp.sale_price_usd)}
																</span>
															</div>
														</a>
													)}
												</For>
											</div>
										</div>

										{/* Live Trait Active Listings Orderbook */}
										<Show when={rep().trait_active_listings?.length}>
											<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3 shadow-xl text-start">
												<div class="flex items-center justify-between border-b border-white/5 pb-2">
													<div class="flex items-center gap-2">
														<span class="material-symbols-outlined text-[18px] text-emerald-400">
															storefront
														</span>
														<span class="text-[12px] font-black uppercase tracking-wider text-white">
															{tr(
																'اردربوک زنده لیستینگ‌های هم‌تریت در فرگمنت',
																'LIVE TRAIT ORDERBOOK LISTINGS',
															)}
														</span>
													</div>
												</div>

												<div class="flex flex-col gap-2">
													<For each={rep().trait_active_listings || []}>
														{(lst) => (
															<a
																href={lst.fragment_url}
																target="_blank"
																rel="noreferrer"
																class="bg-[#08090D] hover:bg-white/[0.04] border border-white/6 rounded-[14px] p-3 flex items-center justify-between gap-2 transition-all"
															>
																<div class="flex flex-col min-w-0">
																	<span class="text-[11px] font-bold text-white truncate">
																		{lst.trait_value} (#{lst.serial_number})
																	</span>
																	<span class="text-[9px] font-mono text-[#38bdf8]">
																		Fragment Active Listing ↗
																	</span>
																</div>
																<div
																	class="flex flex-col items-end shrink-0"
																	dir="ltr"
																>
																	<span class="text-[13px] font-mono font-black text-white">
																		{formatTon(lst.price_gram)} TON
																	</span>
																	<span class="text-[9px] font-mono text-white/45">
																		≈ {formatUsd(lst.price_usd)}
																	</span>
																</div>
															</a>
														)}
													</For>
												</div>
											</div>
										</Show>

										{/* Crafting Forge Verdict & Institutional Risk Audit */}
										<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[26px] p-4 flex flex-col gap-3 shadow-xl text-start">
											<div class="flex items-center justify-between border-b border-white/5 pb-2">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[18px] text-emerald-400">
														verified_user
													</span>
													<span class="text-[12px] font-black uppercase tracking-wider text-white">
														{tr(
															'ممیزی ریسک، اصالت قرارداد و کارگاه کرفت',
															'RISK AUDIT & CRAFTING FORGE VERDICT',
														)}
													</span>
												</div>
												<span class="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-mono font-black text-emerald-400">
													{rep().risk_audit?.overall_risk_level || 'LOW RISK'}
												</span>
											</div>

											<Show when={rep().crafting_forge}>
												{(cf) => (
													<div class="bg-[#08090D] border border-amber-500/25 rounded-[14px] p-3 flex flex-col gap-1">
														<span class="text-[10px] font-mono font-black text-amber-300 uppercase">
															{cf().burn_candidate_verdict ===
															'DO_NOT_BURN_PREMIUM'
																? tr(
																		'⛔ حکم کارگاه کرفت: ممنوعیت سوزاندن (دارای پریمیوم)',
																		'⛔ FORGE VERDICT: DO NOT BURN (PREMIUM ASSET)',
																	)
																: tr(
																		'کارگاه کرفت (Crafting Forge)',
																		'Crafting Forge Status',
																	)}
														</span>
														<p class="text-[11px] text-white/75 leading-relaxed">
															{cf().burn_candidate_reason_fa}
														</p>
													</div>
												)}
											</Show>

											<div class="flex flex-col gap-2">
												<For each={rep().risk_audit?.risk_checklist || []}>
													{(chk) => (
														<div class="bg-[#08090D] border border-white/6 rounded-[14px] p-3 flex items-start gap-2.5">
															<span
																class={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
																	chk.passed
																		? 'text-emerald-400'
																		: 'text-amber-400'
																}`}
															>
																{chk.passed ? 'check_circle' : 'warning'}
															</span>
															<div class="flex flex-col gap-0.5">
																<span class="text-[11px] font-black text-white">
																	{isRtl() ? chk.title_fa : chk.title_en}
																</span>
																<span class="text-[10px] text-white/60 leading-relaxed">
																	{chk.detail}
																</span>
															</div>
														</div>
													)}
												</For>
											</div>
										</div>
									</div>
								</Show>
							</div>
						)}
					</Show>
				</Show>
			</div>

			{/* Credit Store Bottom Sheet for Top-Up */}
			<CreditStoreSheet
				open={storeOpen()}
				onClose={() => setStoreOpen(false)}
				vertical="gift"
			/>
		</div>
	);
};

export default GiftReportPage;
