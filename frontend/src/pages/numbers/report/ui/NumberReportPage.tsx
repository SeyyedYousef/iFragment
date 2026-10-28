import { useNavigate, useSearchParams } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
	type CuriosityGateData,
	type NumberValuationResult,
	numbersApi,
} from '@/entities/numbers/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { layaT, NUMBER_REPORT_I18N } from '@/shared/i18n/laya-i18n.js';
import { haptic } from '@/shared/lib/haptic.js';
import { copyToClipboard } from '@/shared/lib/telegram-native.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { CreditStoreSheet, UnifiedPaywallGate, useWallet } from '@/widgets/paywall/index.js';
import { NumberDigitalCertificateCard } from './components/NumberDigitalCertificateCard.js';
import { NumberFinancialEngineeringCard } from './components/NumberFinancialEngineeringCard.js';
import { NumberSingleCulturalRadarCard } from './components/NumberSingleCulturalRadarCard.js';

interface NumberValidation {
	isValid: boolean;
	error: string | null;
	formatted: string;
	cleanDigits: string;
	suffix: string;
	tier: 'GRAIL' | 'APEX' | 'GRAND' | 'STANDARD';
	patternLabel: string;
}

type ReportTabKey = 'valuation' | 'forensics' | 'onchain' | 'siblings';

const QUICK_BENCHMARK_NUMBERS = [
	{
		raw: '+888 0888 8888',
		label: {
			fa: 'جام مقدس ۸ رقمی (0888)',
			en: '8D Grail (45K TON)',
			ru: '8-зн. Грааль (45K TON)',
			zh: '8位圣杯靓号 (45K TON)',
		},
		badge: 'GRAIL',
	},
	{
		raw: '+888 8 888',
		label: {
			fa: 'جام مقدس ۴ رقمی (#1)',
			en: '4D Genesis #1 (300K TON)',
			ru: '4-зн. Genesis #1 (300K TON)',
			zh: '4位创世 #1 (300K TON)',
		},
		badge: 'GENESIS #1',
	},
	{
		raw: '+888 0000 0000',
		label: {
			fa: 'هشت صفر سلطنتی',
			en: 'Royal Null 00000000',
			ru: 'Королевские нули 00000000',
			zh: '皇家全零 00000000',
		},
		badge: 'GRAIL',
	},
	{
		raw: '+888 8 115',
		label: {
			fa: 'نمونه ۴ رقمی Restricted',
			en: 'Restricted 4D Sample',
			ru: 'Ограниченный 4-зн. номер',
			zh: '受限 4位号码样本',
		},
		badge: 'RESTRICTED',
	},
	{
		raw: '+888 0777 7777',
		label: {
			fa: 'هفت تایی خوش‌شانس',
			en: 'Lucky 7-Run',
			ru: 'Счастливые семёрки',
			zh: '幸运七连号',
		},
		badge: 'APEX',
	},
];

function toAsciiDigits(str: string): string {
	return str
		.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
		.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
}

function validateAndFormatAnonymousNumber(raw: string): NumberValidation {
	const asciiRaw = toAsciiDigits(raw || '');
	const trimmed = asciiRaw.trim();
	if (!trimmed) {
		return {
			isValid: false,
			error: null,
			formatted: '',
			cleanDigits: '',
			suffix: '',
			tier: 'STANDARD',
			patternLabel: '',
		};
	}

	if (/[^0-9+\s\-()]/.test(trimmed)) {
		return {
			isValid: false,
			error: t('numbers.errorInvalidChars'),
			formatted: trimmed,
			cleanDigits: '',
			suffix: '',
			tier: 'STANDARD',
			patternLabel: '',
		};
	}

	if (trimmed.startsWith('+') && !trimmed.startsWith('+888')) {
		return {
			isValid: false,
			error: t('numbers.errorInvalidPrefix'),
			formatted: trimmed,
			cleanDigits: '',
			suffix: '',
			tier: 'STANDARD',
			patternLabel: '',
		};
	}

	const clean = trimmed.replace(/\D/g, '');
	let suffix = '';
	if (clean.startsWith('888')) {
		suffix = clean.slice(3);
	} else {
		suffix = clean;
	}

	if (suffix.length === 0) {
		return {
			isValid: false,
			error: trimmed.startsWith('+888') ? t('numbers.errorTooShort') : null,
			formatted: '+888',
			cleanDigits: clean,
			suffix: '',
			tier: 'STANDARD',
			patternLabel: '',
		};
	}

	if (suffix.length !== 4 && suffix.length !== 8) {
		return {
			isValid: false,
			error:
				suffix.length < 4
					? t('numbers.errorTooShort')
					: suffix.length > 8
						? t('numbers.errorTooLong')
						: t('numbers.errorInvalidLength') || 'Anonymous numbers must be either 4 or 8 digits',
			formatted:
				suffix.length > 4
					? `+888 ${suffix.slice(0, 4)} ${suffix.slice(4)}`
					: `+888 ${suffix}`,
			cleanDigits: clean,
			suffix,
			tier: 'STANDARD',
			patternLabel: '',
		};
	}

	if (suffix.length === 4) {
		const val = parseInt(suffix, 10);
		if (Number.isNaN(val) || val < 8000 || val > 8999) {
			return {
				isValid: false,
				error:
					t('numbers.errorGenesisRange') ||
					'4-digit genesis numbers must be between +888 8 000 and +888 8 999',
				formatted: `+888 ${suffix[0]} ${suffix.slice(1)}`,
				cleanDigits: clean,
				suffix,
				tier: 'STANDARD',
				patternLabel: '',
			};
		}
	}

	let formatted = '';
	if (suffix.length === 4) {
		formatted = `+888 ${suffix[0]} ${suffix.slice(1)}`;
	} else {
		formatted = `+888 ${suffix.slice(0, 4)} ${suffix.slice(4)}`;
	}

	let tier: 'GRAIL' | 'APEX' | 'GRAND' | 'STANDARD' = 'STANDARD';
	let patternLabel = '';

	if (
		suffix.length === 4 ||
		suffix.includes('8888') ||
		suffix.includes('7777') ||
		suffix.includes('0000') ||
		suffix.includes('9999') ||
		suffix.includes('1111') ||
		(suffix.length === 8 && new Set(suffix).size === 1) ||
		suffix === '8888'
	) {
		tier = 'GRAIL';
		patternLabel =
			suffix.length === 4 ? 'GRAIL TIER (4-Digit Genesis)' : 'GRAIL TIER (Quad/Septa Repeat)';
	} else if (
		suffix.includes('1234') ||
		suffix.includes('5678') ||
		suffix.includes('8989') ||
		suffix.includes('0101') ||
		/012|123|234|345|456|567|678|789/.test(suffix)
	) {
		tier = 'APEX';
		patternLabel = 'APEX TIER (Sequence/Pair)';
	} else if (
		suffix.endsWith('888') ||
		suffix.endsWith('777') ||
		suffix.endsWith('000') ||
		(suffix.length >= 4 && suffix === [...suffix].reverse().join(''))
	) {
		tier = 'GRAND';
		patternLabel = 'GRAND TIER (Triple/Mirror)';
	} else {
		tier = 'STANDARD';
		patternLabel = 'STANDARD TIER';
	}

	return {
		isValid: true,
		error: null,
		formatted,
		cleanDigits: `888${suffix}`,
		suffix,
		tier,
		patternLabel,
	};
}

export const NumberReportPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const wallet = useWallet();

	// Search & Input state — Default to real minted Grail +888 0888 8888
	const [inputNumber, setInputNumber] = createSignal(
		searchParams.n || searchParams.number || searchParams.num || '+888 0888 8888',
	);
	const [activeTab, setActiveTab] = createSignal<ReportTabKey>('valuation');
	const [isAnalyzing, setIsAnalyzing] = createSignal(false);
	const [analysisStep, setAnalysisStep] = createSignal(0);
	const [copiedHeroNumber, setCopiedHeroNumber] = createSignal(false);
	const [copiedField, setCopiedField] = createSignal<string | null>(null);

	// Gate vs Unlocked State
	const [isUnlocked, setIsUnlocked] = createSignal(false);
	const [gateData, setGateData] = createSignal<CuriosityGateData | null>(null);
	const [reportData, setReportData] = createSignal<NumberValuationResult | null>(null);
	const [loading, setLoading] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const [storeOpen, setStoreOpen] = createSignal(false);

	// Watchlist & Monitoring state
	const [isWatching, setIsWatching] = createSignal(false);
	const [watchLoading, setWatchLoading] = createSignal(false);
	const [isMonitored, setIsMonitored] = createSignal(false);

	// Interactive Make-an-Offer slider state
	const [customOfferPct, setCustomOfferPct] = createSignal(93);

	// Interactive Custom Pattern Mask Lab & Bargain Sniper state (Tab 4)
	const [customMaskInput, setCustomMaskInput] = createSignal('8880AAAAAAA');
	const [maskSearchLoading, setMaskSearchLoading] = createSignal(false);
	const [customMaskResults, setCustomMaskResults] = createSignal<
		import('@/entities/numbers/index.js').NumberTableItem[] | null
	>(null);

	// Web Audio API DTMF Synthesizer state
	const [isPlayingDtmf, setIsPlayingDtmf] = createSignal(false);
	const [activeDtmfIndex, setActiveDtmfIndex] = createSignal<number | null>(null);
	let audioCtx: AudioContext | null = null;
	let dtmfTimerIds: number[] = [];

	const stopDtmfPlayback = () => {
		for (const id of dtmfTimerIds) {
			window.clearTimeout(id);
		}
		dtmfTimerIds = [];
		setIsPlayingDtmf(false);
		setActiveDtmfIndex(null);
	};

	onCleanup(() => {
		stopDtmfPlayback();
		if (audioCtx && audioCtx.state !== 'closed') {
			void audioCtx.close().catch(() => {});
		}
	});

	const playSingleDtmfTone = (rowHz: number, colHz: number, durationMs = 175) => {
		try {
			const AudioContextClass =
				window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (!AudioContextClass) return;
			if (!audioCtx || audioCtx.state === 'closed') {
				audioCtx = new AudioContextClass();
			}
			if (audioCtx.state === 'suspended') {
				void audioCtx.resume();
			}
			const now = audioCtx.currentTime;
			const oscRow = audioCtx.createOscillator();
			const oscCol = audioCtx.createOscillator();
			const gain = audioCtx.createGain();

			oscRow.type = 'sine';
			oscCol.type = 'sine';
			oscRow.frequency.setValueAtTime(rowHz, now);
			oscCol.frequency.setValueAtTime(colHz, now);

			gain.gain.setValueAtTime(0.001, now);
			gain.gain.exponentialRampToValueAtTime(0.14, now + 0.015);
			gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

			oscRow.connect(gain);
			oscCol.connect(gain);
			gain.connect(audioCtx.destination);

			oscRow.start(now);
			oscCol.start(now);
			oscRow.stop(now + durationMs / 1000 + 0.02);
			oscCol.stop(now + durationMs / 1000 + 0.02);
		} catch {
			// Ignore audio context restrictions if blocked
		}
	};

	const handlePlayFullDtmfSequence = () => {
		if (isPlayingDtmf()) {
			stopDtmfPlayback();
			return;
		}
		const cells = reportData()?.binary_forensics?.digits_matrix || [];
		if (cells.length === 0) return;

		try {
			haptic.selection();
		} catch {}
		setIsPlayingDtmf(true);
		const stepMs = 230;
		cells.forEach((cell, idx) => {
			const tId = window.setTimeout(() => {
				setActiveDtmfIndex(idx);
				playSingleDtmfTone(cell.dtmf_row_hz, cell.dtmf_col_hz, 175);
			}, idx * stepMs);
			dtmfTimerIds.push(tId);
		});

		const endId = window.setTimeout(() => {
			setIsPlayingDtmf(false);
			setActiveDtmfIndex(null);
		}, cells.length * stepMs + 80);
		dtmfTimerIds.push(endId);
	};

	// Reactive validation
	const validation = createMemo(() => validateAndFormatAnonymousNumber(inputNumber()));

	// 3D Holographic Gyro Tilt State
	const [tilt, setTilt] = createSignal({ x: 0, y: 0, glossX: 50, glossY: 50 });
	let cardRef: HTMLDivElement | undefined;
	let rAfId: number | null = null;

	const handlePointerMove = (e: PointerEvent) => {
		if (!cardRef) return;
		if (window.matchMedia && !window.matchMedia('(pointer: fine)').matches) return;
		if (rAfId !== null) cancelAnimationFrame(rAfId);
		rAfId = requestAnimationFrame(() => {
			if (!cardRef) return;
			const rect = cardRef.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const centerX = rect.width / 2;
			const centerY = rect.height / 2;

			const tiltX = Math.max(-14, Math.min(14, ((y - centerY) / centerY) * -12));
			const tiltY = Math.max(-14, Math.min(14, ((x - centerX) / centerX) * 12));
			const glossX = Math.max(0, Math.min(100, (x / rect.width) * 100));
			const glossY = Math.max(0, Math.min(100, (y / rect.height) * 100));

			setTilt({ x: tiltX, y: tiltY, glossX, glossY });
		});
	};

	const handlePointerLeave = () => {
		if (rAfId !== null) cancelAnimationFrame(rAfId);
		setTilt({ x: 0, y: 0, glossX: 50, glossY: 50 });
	};

	const analysisSteps = () => [
		t('numbers.stepConnectingContracts') || 'Querying Live Fragment, Nums888 & TonAPI TVM BOC',
		t('numbers.stepQueryingMatrix') || 'Auditing On-Chain Sales Ledger & Restriction Flags',
		t('numbers.stepExtractingFeatures') || 'Computing 256-Bit TEP-62 Hash, BCD & DTMF Acoustics',
		t('numbers.stepRunningHedonic') || 'Calibrating NV-Engine v7.5-BinaryLive Fair Value',
	];

	onMount(() => {
		if (searchParams.n) {
			void handleRunAnalysis(searchParams.n);
		} else {
			void handleRunAnalysis(inputNumber());
		}
	});

	const handleRunAnalysis = async (num: string) => {
		stopDtmfPlayback();
		const val = validateAndFormatAnonymousNumber(num);
		if (!val.isValid) {
			setError(val.error || t('numbers.errorTooShort'));
			return;
		}

		setInputNumber(val.formatted);
		setIsAnalyzing(true);
		setIsUnlocked(false);
		setAnalysisStep(0);
		setError(null);

		try {
			setAnalysisStep(1);
			const gate = await numbersApi.getCuriosityGate(val.cleanDigits);
			setAnalysisStep(2);
			setGateData(gate);
			setAnalysisStep(3);

			// Load full live valuation
			try {
				const unlocked = await numbersApi.getValuation(val.cleanDigits);
				if (
					unlocked &&
					(Number(unlocked.expected_ton) > 0 ||
						Number(unlocked.base_price_ton) > 0 ||
						unlocked.run_id > 0)
				) {
					setReportData(unlocked);
					if (unlocked.smart_mask) {
						setCustomMaskInput(unlocked.smart_mask);
					}
					setCustomMaskResults(null);
					setIsUnlocked(true);
				}
			} catch {
				// Expected when locked
			}
		} catch (err: any) {
			setError(err?.message || 'Failed to connect to Telegram Telemint registry');
		} finally {
			setTimeout(() => {
				setIsAnalyzing(false);
			}, 260);
		}
	};

	const handleRunCustomMaskSearch = async (overrideMask?: string) => {
		const rawMask = (overrideMask ?? customMaskInput()).trim().replace(/\+/g, '').replace(/\s+/g, '').toUpperCase();
		if (!rawMask) return;
		const normalizedMask = rawMask.startsWith('888') ? rawMask : `888${rawMask}`;
		setCustomMaskInput(normalizedMask);
		setMaskSearchLoading(true);
		try {
			try {
				haptic.selection();
			} catch {}
			const res = await numbersApi.getNumbersList({ mask: normalizedMask, page: 1 });
			setCustomMaskResults(res.items || []);
		} catch {
			setCustomMaskResults([]);
		} finally {
			setMaskSearchLoading(false);
		}
	};

	const canAfford = () => {
		const b = wallet.balance();
		return b !== null && b >= 1;
	};

	const handleUnlockWithCredit = async () => {
		try {
			haptic.impact('medium');
			if (!canAfford()) {
				setStoreOpen(true);
				return;
			}
			setLoading(true);
			const targetNum = validation().cleanDigits || inputNumber();
			const res = await numbersApi.unlockWithCredit(targetNum);
			setReportData(res);
			setIsUnlocked(true);
			haptic.notify('success');
		} catch (err: any) {
			haptic.notify('error');
			const errorMsg =
				err?.response?.data?.error ||
				err?.response?.data?.message ||
				err?.message ||
				t('valuation.unlock_error') ||
				'Error unlocking report with credit.';
			setError(errorMsg);
		} finally {
			setLoading(false);
		}
	};

	const handleToggleWatchlist = async () => {
		if (!isUnlocked() || watchLoading()) return;
		try {
			setWatchLoading(true);
			haptic.selection();
			const nextState = !isWatching();
			await numbersApi.toggleWatchlist(inputNumber(), nextState);
			setIsWatching(nextState);
			setIsMonitored(nextState);
			haptic.notify('success');
		} catch {
			haptic.notify('error');
		} finally {
			setWatchLoading(false);
		}
	};

	const handleCopyText = (val: string, key: string) => {
		if (!val) return;
		copyToClipboard(val);
		try {
			haptic.notify('success');
		} catch {}
		setCopiedField(key);
		setTimeout(() => {
			if (copiedField() === key) setCopiedField(null);
		}, 1800);
	};

	const handleCopyHeroNumber = () => {
		const target = reportData()?.display_number || validation().formatted || inputNumber();
		copyToClipboard(target);
		try {
			haptic.notify('success');
		} catch {}
		setCopiedHeroNumber(true);
		setTimeout(() => setCopiedHeroNumber(false), 2000);
	};

	const formatTon = (val?: number | string) => {
		if (val === undefined || val === null || val === '') return '0';
		const num = typeof val === 'string' ? parseFloat(val) : val;
		if (Number.isNaN(num)) return '0';
		return num.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const formatUsd = (val?: number) => {
		if (!val) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	const shortAddr = (addr?: string) => {
		if (!addr) return '—';
		if (addr.length <= 16) return addr;
		return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
	};

	// Dynamic Rarity Tier Theme for Numbers
	const getNumberTheme = () => {
		const num = (
			reportData()?.display_number ||
			gateData()?.display_number ||
			validation().formatted ||
			inputNumber()
		).replace(/\s+/g, '');

		const officialHex = reportData()?.market_provenance?.color_hex || reportData()?.color?.hex;

		if (
			num.includes('88888888') ||
			num.includes('08888888') ||
			num.includes('77777777') ||
			num.includes('00000000') ||
			num.length <= 8
		) {
			return {
				name: 'GRAIL',
				wrapper:
					'from-[#ffaa00] via-[#ff7700] to-[#e65100] shadow-[0_20px_50px_rgba(255,119,0,0.35),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#ffaa00]/15 border-[#ffaa00]/40 text-[#ffaa00] shadow-[0_0_15px_rgba(255,170,0,0.3)]',
				glow: officialHex ? `${officialHex}66` : 'rgba(255,119,0,0.35)',
			};
		}
		if (num.includes('1234') || num.includes('8989') || num.includes('0101')) {
			return {
				name: 'APEX',
				wrapper:
					'from-[#0098EA] via-[#0070BA] to-[#004B87] shadow-[0_20px_50px_rgba(0,152,234,0.35),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#0098EA]/15 border-[#0098EA]/40 text-[#0098EA] shadow-[0_0_15px_rgba(0,152,234,0.3)]',
				glow: officialHex ? `${officialHex}66` : 'rgba(0,152,234,0.35)',
			};
		}
		return {
			name: 'COLLECTOR',
			wrapper:
				'from-[#10b981] via-[#059669] to-[#047857] shadow-[0_20px_50px_rgba(16,185,129,0.3),inset_0_2px_10px_rgba(255,255,255,0.25)]',
			badge:
				'bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.25)]',
			glow: officialHex ? `${officialHex}66` : 'rgba(16,185,129,0.35)',
		};
	};

	const getNumberFontSize = (numStr: string) => {
		const len = (numStr || '').replace(/\s+/g, '').length;
		if (len <= 8) return '32px';
		if (len <= 10) return '27px';
		if (len <= 12) return '23px';
		return '20px';
	};

	const getTonPriceFontSize = (tonVal?: number | string) => {
		const formatted = formatTon(tonVal);
		const len = formatted.length;
		if (len <= 6) return 'text-2xl sm:text-3xl';
		if (len <= 9) return 'text-xl sm:text-2xl';
		if (len <= 12) return 'text-lg sm:text-xl';
		return 'text-base sm:text-lg';
	};

	// Dynamic Offer Calculation based on slider
	const simulatedOfferStats = createMemo(() => {
		const r = reportData();
		const fairTon = Number(r?.expected_ton || 2717);
		const rate = r?.ton_usd_rate || 1.29;
		const offerTon = Math.round((fairTon * customOfferPct()) / 100);
		const offerUsd = Math.round(offerTon * rate);
		const feeTon = Math.max(0.5, Math.round(offerTon * 0.0005 * 100) / 100);
		const protocolFeeTon = Math.round(offerTon * 0.05 * 10) / 10;
		const sellerNetTon = Math.round((offerTon - protocolFeeTon) * 10) / 10;
		const sellerNetUsd = Math.round(sellerNetTon * rate);
		const isVanity = Boolean(r?.live_listing?.is_vanity_ask);
		const baseAccept = isVanity ? 45 : 78;
		const acceptProb = Math.max(
			12,
			Math.min(98, Math.round(baseAccept + (customOfferPct() - 93) * 1.4)),
		);
		return {
			offerTon,
			offerUsd,
			feeTon,
			protocolFeeTon,
			sellerNetTon,
			sellerNetUsd,
			acceptProb,
		};
	});

	// Active DTMF Cell for Dual-Sine Acoustic Interference Oscilloscope
	const activeAcousticCell = createMemo(() => {
		const cells = reportData()?.binary_forensics?.digits_matrix || [];
		if (cells.length === 0) return null;
		const idx = activeDtmfIndex();
		if (idx !== null && cells[idx]) return cells[idx];
		return cells[0];
	});

	// Compute SVG path for Dual-Sine Acoustic Superposition sin(2π*f_row*t) + sin(2π*f_col*t)
	const acousticWaveformPath = createMemo(() => {
		const cell = activeAcousticCell();
		if (!cell) return 'M 0 32 L 320 32';
		const fRow = cell.dtmf_row_hz || 852;
		const fCol = cell.dtmf_col_hz || 1336;
		const width = 320;
		const height = 64;
		const midY = height / 2;
		const pts: string[] = [];
		// 6ms window sampled across 80 points
		const durationSec = 0.006;
		const steps = 80;
		for (let i = 0; i <= steps; i++) {
			const tSec = (i / steps) * durationSec;
			const yVal =
				0.5 *
				(Math.sin(2 * Math.PI * fRow * tSec) + Math.sin(2 * Math.PI * fCol * tSec));
			const x = Math.round((i / steps) * width * 10) / 10;
			const y = Math.round((midY - yVal * 24) * 10) / 10;
			pts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
		}
		return pts.join(' ');
	});

	// Compute SVG Keypad Laser Vector Trajectory Coordinates over 3x4 Grid (210x184 viewBox)
	const keypadVectorData = createMemo(() => {
		const cells = reportData()?.binary_forensics?.digits_matrix || [];
		const coords = cells.map((c, idx) => ({
			idx,
			digit: c.digit,
			x: c.keypad_col * 70 + 35,
			y: c.keypad_row * 46 + 23,
		}));
		const pathStr = coords
			.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
			.join(' ');
		return { coords, pathStr };
	});

	return (
		<div
			class="pb-36 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Dynamic Background Glows */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/20 via-[#AF52DE]/10 to-transparent blur-[90px] pointer-events-none z-0" />
			<div class="fixed bottom-20 right-0 w-80 h-80 bg-emerald-500/10 blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[520px] mx-auto px-4 pt-4">
				{/* ═══════ 1. CLEAN HEADER ═══════ */}
				<div class="flex items-center justify-between mb-3">
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							navigate('/?tab=collectibles');
						}}
						class="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/80 active:scale-95 transition-all shadow-sm"
					>
						<span class="material-symbols-outlined text-xl rtl:rotate-180">arrow_back</span>
					</button>

					<div class="text-center flex-1 px-3">
						<h1 class="text-base font-black text-white flex items-center justify-center gap-1.5">
							<span>
								{layaT({
									fa: 'کالبدشکافی و ارزش‌گذاری شماره',
									en: 'Telegram Anonymous Number',
									ru: 'Оценка анонимного номера',
									zh: 'Telegram 匿名靓号估值',
								})}
							</span>
							<span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
								+888
							</span>
						</h1>
						<p class="text-[11px] font-medium text-white/50">
							{layaT({
								fa: 'موتور NV-Engine v7.5 • تحلیل باینری، آکوستیک DTMF و آن‌چین',
								en: 'NV-Engine v7.5 • Live Binary, DTMF & On-Chain Forensics',
								ru: 'NV-Engine v7.5 • Бинарный, DTMF и ончейн-анализ',
								zh: 'NV-Engine v7.5 • 实时二进制、DTMF 声学与链上溯源',
							})}
						</p>
					</div>

					<div class="w-10 h-10 flex items-center justify-center">
						<span class="text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-xl">
							LIVE
						</span>
					</div>
				</div>

				{/* 🔍 TOP INTERACTIVE NUMBER SEARCH BAR */}
				<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 mb-2.5 flex items-center gap-2 shadow-lg">
					<span class="material-symbols-outlined text-[#0098EA] ml-2 text-xl">dialpad</span>
					<input
						type="text"
						value={inputNumber()}
						onInput={(e) => setInputNumber(e.currentTarget.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								void handleRunAnalysis(inputNumber());
							}
						}}
						placeholder="+888 0888 8888"
						class="bg-transparent text-white placeholder-white/30 text-xs font-mono font-bold flex-1 focus:outline-none px-2 py-1"
						dir="ltr"
					/>
					<Show when={inputNumber()}>
						<button
							type="button"
							onClick={() => setInputNumber('')}
							class="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center transition-all"
						>
							<span class="material-symbols-outlined text-xs">close</span>
						</button>
					</Show>
					<button
						type="button"
						onClick={() => void handleRunAnalysis(inputNumber())}
						disabled={isAnalyzing()}
						class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#0098EA] to-[#007ebb] text-white font-black text-xs hover:brightness-110 active:scale-95 transition-all shadow-md shadow-[#0098EA]/20 flex items-center gap-1"
					>
						<span>
							{layaT({
								fa: 'کالبدشکافی',
								en: 'Appraise',
								ru: 'Оценить',
								zh: '鉴定估值',
							})}
						</span>
						<span class="material-symbols-outlined text-xs">arrow_forward</span>
					</button>
				</div>

				{/* ⚡ QUICK BENCHMARK CHIPS (REAL MINTED GRAILS & RESTRICTED SAMPLE) */}
				<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3">
					<For each={QUICK_BENCHMARK_NUMBERS}>
						{(item) => {
							const isSelected = () =>
								inputNumber().replace(/\D/g, '') === item.raw.replace(/\D/g, '');
							return (
								<button
									type="button"
									onClick={() => {
										setInputNumber(item.raw);
										void handleRunAnalysis(item.raw);
									}}
									class={`shrink-0 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all flex items-center gap-1.5 ${
										isSelected()
											? 'bg-[#0098EA]/20 border-[#0098EA]/50 text-white shadow-sm shadow-[#0098EA]/20'
											: 'bg-[#12141C]/80 border-white/10 text-white/60 hover:text-white hover:border-white/20'
									}`}
								>
									<span class="font-mono font-black text-cyan-300" dir="ltr">
										{item.raw}
									</span>
									<span class="text-white/40">|</span>
									<span>{layaT(item.label)}</span>
								</button>
							);
						}}
					</For>
				</div>

				<Show when={error()}>
					<div class="bg-red-500/10 border border-red-500/30 rounded-2xl p-3.5 mb-4 text-xs text-red-400 flex items-center gap-2">
						<span class="material-symbols-outlined text-base">error</span>
						<span>{error()}</span>
					</div>
				</Show>

				{/* ═══════ 2. STATE 1: SCANNING ANIMATION ═══════ */}
				<Show when={isAnalyzing()}>
					<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 mb-6 text-center relative overflow-hidden shadow-2xl">
						<div class="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#0098EA] to-[#00c6ff] mx-auto mb-4 flex items-center justify-center shadow-lg shadow-[#0098EA]/40 animate-pulse">
							<span class="material-symbols-outlined text-white text-3xl">psychology</span>
						</div>

						<h2 class="text-lg font-black text-white mb-1">{t('numbers.engineScanning')}</h2>
						<p class="text-xs text-white/50 mb-6 font-mono font-bold">
							{analysisSteps()[analysisStep()]}
						</p>

						<div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
							<div
								class="h-full bg-gradient-to-r from-[#0098EA] to-emerald-400 rounded-full transition-all duration-500"
								style={{ width: `${((analysisStep() + 1) / analysisSteps().length) * 100}%` }}
							/>
						</div>
						<div class="text-[10px] text-white/40 font-mono">{t('numbers.telemintContracts')}</div>
					</div>
				</Show>

				{/* ═══════ 3. STATE 2: PRE-UNLOCK CURIOSITY GATE & PAYWALL ═══════ */}
				<Show when={!isAnalyzing() && !isUnlocked() && gateData()}>
					<div class="mb-6 w-full max-w-[460px] mx-auto space-y-4">
						<div class="bg-gradient-to-br from-[#12141C] via-[#0E1017] to-[#0A0C10] border border-cyan-500/30 rounded-[28px] p-5 shadow-2xl relative overflow-hidden text-start">
							<div class="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

							<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
								<div class="flex items-center gap-2">
									<div class="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
										<span class="material-symbols-outlined text-lg">fact_check</span>
									</div>
									<div>
										<h4 class="text-xs font-black text-white">
											{layaT({
												fa: 'تحلیل هوشمند پیش‌ارزیابی آماده است',
												en: 'Pre-Appraisal Intelligence Ready',
												ru: 'Предварительный анализ готов',
												zh: '预评估智能情报已就绪',
											})}
										</h4>
										<span class="text-[9px] font-bold text-cyan-400 font-mono" dir="ltr">
											{gateData()?.display_number || validation().formatted}
										</span>
									</div>
								</div>
								<span class="text-[9px] font-mono font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
									READY
								</span>
							</div>

							<div class="grid grid-cols-3 gap-2 text-center mb-3.5">
								<div class="p-2 rounded-xl bg-black/40 border border-white/5">
									<span class="text-[9px] text-white/40 block mb-0.5">
										{layaT(NUMBER_REPORT_I18N.signals)}
									</span>
									<span class="text-xs font-black text-cyan-300 font-mono">
										{gateData()?.signals_analyzed || 48} {layaT(NUMBER_REPORT_I18N.pts)}
									</span>
								</div>
								<div class="p-2 rounded-xl bg-black/40 border border-white/5">
									<span class="text-[9px] text-white/40 block mb-0.5">
										{layaT(NUMBER_REPORT_I18N.onChainRisk)}
									</span>
									<span class="text-xs font-black text-emerald-400 font-mono">
										{gateData()?.risks_identified === 0
											? layaT(NUMBER_REPORT_I18N.cleanRisk)
											: `${gateData()?.risks_identified} Warning`}
									</span>
								</div>
								<div class="p-2 rounded-xl bg-black/40 border border-white/5">
									<span class="text-[9px] text-white/40 block mb-0.5">
										{layaT(NUMBER_REPORT_I18N.sources)}
									</span>
									<span class="text-xs font-black text-amber-300 font-mono">
										{gateData()?.data_sources_count || 6} {layaT(NUMBER_REPORT_I18N.apis)}
									</span>
								</div>
							</div>

							<div class="p-3 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden">
								<div class="space-y-1.5 opacity-40 blur-[2px] select-none pointer-events-none">
									<div class="flex justify-between items-center text-[10px]">
										<span class="text-white/60">Fair Value Appraisal</span>
										<span class="font-mono text-cyan-400">█████ TON (≈ $████)</span>
									</div>
									<div class="flex justify-between items-center text-[10px]">
										<span class="text-white/60">Liquidation & Asking Band</span>
										<span class="font-mono text-amber-400">████ — ████ TON</span>
									</div>
									<div class="flex justify-between items-center text-[10px]">
										<span class="text-white/60">TEP-62 SHA256 & DTMF Forensics</span>
										<span class="font-mono text-emerald-400">0x████████████</span>
									</div>
								</div>
								<div class="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
									<span class="text-[10px] font-black text-white/90 bg-white/10 px-3 py-1 rounded-full border border-white/20 flex items-center gap-1">
										<span class="material-symbols-outlined text-xs text-amber-400">lock</span>
										<span>{layaT(NUMBER_REPORT_I18N.unlock1Credit)}</span>
									</span>
								</div>
							</div>
						</div>

						<UnifiedPaywallGate
							vertical="number"
							targetTitle={gateData()?.display_number || validation().formatted || inputNumber()}
							targetIcon="tag"
							targetBadge={t('paywall.ready_for_appraisal')}
							unlockCtaText={t('paywall.cta_unlock_specific', {
								target: gateData()?.display_number || validation().formatted || inputNumber(),
							})}
							onUnlock={handleUnlockWithCredit}
							unlocking={loading()}
							error={error()}
						/>
					</div>
				</Show>

				{/* ═══════ 4. STATE 3: UNLOCKED INSTITUTIONAL +888 REPORT ═══════ */}
				<Show when={isUnlocked() && reportData()}>
					<div class="space-y-4">
						{/* 🚨 UNMINTED SUPPLY FREEZE ALERT BANNER (e.g. if user enters unminted +888 8888 8888) */}
						<Show when={reportData()?.market_provenance?.is_minted === false}>
							<div class="bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-[#12141C] border border-amber-400/50 rounded-[26px] p-4 shadow-xl text-start">
								<div class="flex items-start gap-2.5">
									<div class="w-9 h-9 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
										<span class="material-symbols-outlined text-xl">ac_unit</span>
									</div>
									<div class="flex-1 min-w-0">
										<div class="flex items-center justify-between gap-2 mb-1">
											<span class="text-xs font-black text-amber-300">
												{layaT({
													fa: 'ترکیب ضرب‌نشده (قفل دائمی عرضه دسامبر ۲۰۲۲)',
													en: 'Unminted Combination (Dec 2022 Supply Freeze)',
													ru: 'Невыпущенная комбинация (Лимит эмиссии дек. 2022)',
													zh: '未铸造号码组合（2022年12月发行永久锁定）',
												})}
											</span>
											<span class="text-[9px] font-mono font-black px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200 border border-amber-400/40">
												136,566 CAP
											</span>
										</div>
										<p class="text-[11px] text-white/80 leading-relaxed mb-3">
											{isRtl()
												? reportData()?.market_provenance?.minted_status_reason_fa
												: reportData()?.market_provenance?.minted_status_reason_en}
										</p>
										<div class="text-[10px] font-bold text-amber-200/90 mb-2">
											{layaT({
												fa: 'نسخه‌های واقعی و ضرب‌شده همین الگو در بلاک‌چین:',
												en: 'Switch to Verified Minted Equivalents on TON:',
												ru: 'Проверенные выпущенные аналоги в сети TON:',
												zh: '切换至 TON 链上已铸造的同形态真实靓号：',
											})}
										</div>
										<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
											<For
												each={
													reportData()?.market_provenance?.suggested_minted_alternatives || []
												}
											>
												{(alt) => (
													<button
														type="button"
														onClick={() => {
															setInputNumber(alt.display_number);
															void handleRunAnalysis(alt.display_number);
														}}
														class="p-2.5 rounded-xl bg-black/50 hover:bg-amber-400/20 border border-amber-400/30 text-start transition-all active:scale-95"
													>
														<div class="font-mono font-black text-xs text-amber-300" dir="ltr">
															{alt.display_number}
														</div>
														<div class="text-[9px] text-white/60 truncate mt-0.5">
															{alt.label_fa}
														</div>
													</button>
												)}
											</For>
										</div>
									</div>
								</div>
							</div>
						</Show>

						{/* 🚨 LIVE TELEGRAM RESTRICTION BANNER (tm-restricted-nft / number-warning) */}
						<Show
							when={
								reportData()?.market_provenance?.is_restricted ||
								reportData()?.on_chain_audit?.is_restricted
							}
						>
							<div class="bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-[#12141C] border border-rose-500/50 rounded-[26px] p-4 shadow-xl text-start">
								<div class="flex items-start gap-2.5">
									<div class="w-9 h-9 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
										<span class="material-symbols-outlined text-xl">gpp_bad</span>
									</div>
									<div class="flex-1 min-w-0">
										<div class="flex items-center justify-between gap-2 mb-1">
											<span class="text-xs font-black text-rose-300">
												{layaT({
													fa: 'هشدار رسمی: این شماره در تلگرام محدود (Restricted) شده است!',
													en: 'OFFICIAL WARNING: This Number is Restricted on Telegram',
													ru: 'ВНИМАНИЕ: Этот номер ограничен (Restricted) в Telegram',
													zh: '官方警告：该号码在 Telegram 上处于受限 (Restricted) 状态',
												})}
											</span>
											<span class="text-[9px] font-mono font-black px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">
												tm-restricted-nft
											</span>
										</div>
										<p class="text-[11px] text-white/80 leading-relaxed">
											{isRtl()
												? reportData()?.market_provenance?.restriction_reason_fa ||
													reportData()?.risk_audit?.restricted_guide
												: reportData()?.market_provenance?.restriction_reason_en}
										</p>
									</div>
								</div>
							</div>
						</Show>

						{/* 💎 3D HOLOGRAPHIC HERO CARD WITH OFFICIAL NFT COLOR PLATE */}
						<div
							class={`w-full p-[2.5px] bg-gradient-to-br ${
								getNumberTheme().wrapper
							} rounded-[36px] my-1 relative z-20 transition-all duration-300 shadow-2xl`}
						>
							<div
								ref={cardRef}
								onPointerMove={handlePointerMove}
								onPointerLeave={handlePointerLeave}
								onClick={handleCopyHeroNumber}
								class="w-full bg-[#08090D] rounded-[34px] p-5 sm:p-6 relative overflow-hidden flex flex-col justify-between gap-5 shadow-inner select-none cursor-pointer touch-pan-y will-change-transform group"
								style={{
									transform: `perspective(1200px) rotateX(${tilt().x}deg) rotateY(${tilt().y}deg)`,
									'background-image':
										'radial-gradient(rgba(255, 255, 255, 0.07) 1.5px, transparent 1.5px)',
									'background-size': '22px 22px',
									transition: 'transform 0.1s ease-out',
								}}
							>
								{/* Gloss Reflex Overlay */}
								<div
									class="absolute inset-0 pointer-events-none z-20 mix-blend-overlay transition-opacity duration-300 opacity-75"
									style={{
										background: `radial-gradient(circle at ${tilt().glossX}% ${
											tilt().glossY
										}%, rgba(255,255,255,0.32) 0%, transparent 60%)`,
									}}
								/>

								{/* Top Header Stamp */}
								<div class="flex justify-between items-center z-10 w-full gap-2" dir="ltr">
									<div class="flex items-center gap-1.5 flex-wrap">
										<span
											class={`px-2.5 py-1 border rounded-xl text-[10px] font-black tracking-wider uppercase shadow-sm ${
												getNumberTheme().badge
											}`}
										>
											{reportData()?.pattern_anatomy?.club_name_en ||
												reportData()?.category_club ||
												`${getNumberTheme().name} TIER`}
										</span>
										<Show when={reportData()?.market_provenance?.color_hex}>
											<span
												class="px-2.5 py-1 rounded-xl border border-white/20 text-[10px] font-mono font-black text-white flex items-center gap-1.5 shadow-sm"
												style={{
													'background-color': `${reportData()?.market_provenance?.color_hex}33`,
												}}
											>
												<span
													class="w-2.5 h-2.5 rounded-full border border-white/40"
													style={{
														'background-color': reportData()?.market_provenance?.color_hex,
													}}
												/>
												<span>
													{reportData()?.market_provenance?.color_name_en} (
													{reportData()?.market_provenance?.color_multiplier}x)
												</span>
											</span>
										</Show>
									</div>

									<span
										class="text-[11px] font-mono font-black text-white/70 tracking-wider uppercase bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl shadow-inner flex items-center gap-1 shrink-0"
										dir="ltr"
									>
										<span>👑</span>
										<span>#{reportData()?.global_rank || 1}</span>
										<span class="text-white/30">/</span>
										<span class="text-white/40">136.5K</span>
									</span>
								</div>

								{/* Center Hero: Official NFT Color Plate + Phone Number */}
								<div class="flex flex-col justify-center items-center z-10 text-center relative py-3 w-full">
									<div
										class="absolute w-full h-[130px] opacity-75 -z-10 pointer-events-none blur-2xl"
										style={{
											background: `radial-gradient(ellipse 65% 65% at 50% 50%, ${
												getNumberTheme().glow
											}, transparent 70%)`,
										}}
									/>

									<div
										class="px-5 py-3 rounded-2xl border border-white/20 shadow-xl flex items-center justify-center gap-2 transition-transform group-hover:scale-[1.02]"
										style={{
											background: reportData()?.market_provenance?.color_hex
												? `linear-gradient(135deg, ${reportData()!.market_provenance!.color_hex}dd, ${reportData()!.market_provenance!.color_hex}88)`
												: 'rgba(255,255,255,0.06)',
										}}
										dir="ltr"
									>
										<span
											class="font-black font-mono tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
											style={{
												'font-size': getNumberFontSize(
													reportData()?.display_number || inputNumber(),
												),
											}}
										>
											{reportData()?.display_number || inputNumber()}
										</span>
									</div>

									<div class="mt-2.5 flex items-center justify-center gap-2 flex-wrap">
										<span class="text-[11px] font-bold text-white/70">
											{isRtl()
												? reportData()?.pattern_anatomy?.club_name_fa ||
													reportData()?.category_club_fa
												: reportData()?.pattern_anatomy?.club_name_en ||
													reportData()?.category_club}
										</span>
										<Show when={copiedHeroNumber()}>
											<span class="text-[10px] font-black text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
												Copied ✓
											</span>
										</Show>
									</div>
								</div>

								{/* Bottom Valuation & Status Bar */}
								<div class="flex justify-between items-end border-t border-white/10 pt-3.5 z-10 w-full gap-2">
									<div class="flex flex-col gap-0.5 text-start min-w-0 flex-1">
										<span class="text-[9px] font-black text-white/40 uppercase tracking-widest truncate block">
											{layaT({
												fa: 'ارزش منصفانه آن‌چین (NV-Engine v7.5)',
												en: 'FAIR INSTITUTIONAL VALUE',
												ru: 'СПРАВЕДЛИВАЯ ОНЧЕЙН-ОЦЕНКА',
												zh: '链上公允估值 (NV-Engine v7.5)',
											})}
										</span>
										<div class="flex items-center gap-1.5 flex-wrap" dir="ltr">
											<span
												class={`font-black text-white leading-none tracking-tight font-mono ${getTonPriceFontSize(reportData()?.expected_ton)}`}
											>
												{formatTon(reportData()?.expected_ton)}
											</span>
											<span class="text-xs font-black text-[#0098EA] leading-none">TON</span>
											<span class="text-xs text-white/60 font-bold font-mono">
												(≈ {formatUsd(reportData()?.expected_usd)})
											</span>
										</div>
									</div>

									<div class="flex flex-col items-end gap-1 shrink-0">
										<Show
											when={
												reportData()?.market_provenance?.is_minted !== false &&
												!reportData()?.market_provenance?.is_restricted
											}
											fallback={
												<div class="flex items-center gap-1.5 bg-rose-500/15 px-2.5 py-1 rounded-lg border border-rose-500/40 text-rose-300 font-black uppercase tracking-wider text-[9px]">
													<div class="w-1.5 h-1.5 bg-rose-400 rounded-full animate-pulse" />
													<span>
														{reportData()?.market_provenance?.is_minted === false
															? layaT({
																	fa: 'ضرب‌نشده (Unminted)',
																	en: 'UNMINTED',
																	ru: 'НЕ ВЫПУЩЕН',
																	zh: '未铸造',
																})
															: layaT({
																	fa: 'محدودشده (Restricted)',
																	en: 'RESTRICTED',
																	ru: 'ОГРАНИЧЕН',
																	zh: '受限状态',
																})}
													</span>
												</div>
											}
										>
											<div class="flex items-center gap-1.5 bg-[#10b981]/15 px-2.5 py-1 rounded-lg border border-[#10b981]/40 text-[#10b981] font-black uppercase tracking-wider text-[9px]">
												<div class="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse" />
												<span>
													{layaT({
														fa: 'تاییدشده و سالم (Clean NFT)',
														en: 'VERIFIED & CLEAN',
														ru: 'ПРОВЕРЕН И ЧИСТ',
														zh: '已验证且安全',
													})}
												</span>
											</div>
										</Show>
										<Show when={(reportData()?.market_provenance?.last_sale_ton || 0) > 0}>
											<span class="text-[10px] text-amber-300 font-mono font-bold" dir="ltr">
												Last Sale: {formatTon(reportData()?.market_provenance?.last_sale_ton)} TON (
												{reportData()?.market_provenance?.last_sale_date})
											</span>
										</Show>
									</div>
								</div>
							</div>
						</div>

						{/* 🧭 4-TAB INSTITUTIONAL NAVIGATION BAR */}
						<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-[#12141C]/95 p-1.5 rounded-2xl border border-white/10 shadow-xl sticky top-2 z-30 backdrop-blur-xl">
							<button
								type="button"
								onClick={() => setActiveTab('valuation')}
								class={`py-2.5 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
									activeTab() === 'valuation'
										? 'bg-gradient-to-r from-[#0098EA] to-[#0077b6] text-white shadow-md shadow-[#0098EA]/25'
										: 'text-white/60 hover:text-white hover:bg-white/5'
								}`}
							>
								<span class="material-symbols-outlined text-sm">monitoring</span>
								<span>
									{layaT({
										fa: 'ارزش‌گذاری و اقتصاد',
										en: 'Valuation',
										ru: 'Оценка',
										zh: '估值与经济',
									})}
								</span>
							</button>

							<button
								type="button"
								onClick={() => setActiveTab('forensics')}
								class={`py-2.5 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
									activeTab() === 'forensics'
										? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25'
										: 'text-white/60 hover:text-white hover:bg-white/5'
								}`}
							>
								<span class="material-symbols-outlined text-sm">memory</span>
								<span>
									{layaT({
										fa: 'باینری و آکوستیک',
										en: 'Binary & DTMF',
										ru: 'Бинарный и DTMF',
										zh: '二进制与声学',
									})}
								</span>
							</button>

							<button
								type="button"
								onClick={() => setActiveTab('onchain')}
								class={`py-2.5 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
									activeTab() === 'onchain'
										? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25'
										: 'text-white/60 hover:text-white hover:bg-white/5'
								}`}
							>
								<span class="material-symbols-outlined text-sm">verified_user</span>
								<span>
									{layaT({
										fa: 'تاریخچه و امنیت',
										en: 'On-Chain',
										ru: 'Ончейн',
										zh: '链上与安全',
									})}{' '}
									({(reportData()?.onchain_history || []).length})
								</span>
							</button>

							<button
								type="button"
								onClick={() => setActiveTab('siblings')}
								class={`py-2.5 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
									activeTab() === 'siblings'
										? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25'
										: 'text-white/60 hover:text-white hover:bg-white/5'
								}`}
							>
								<span class="material-symbols-outlined text-sm">hub</span>
								<span>
									{layaT({
										fa: 'هم‌الگوها',
										en: 'Pattern Peers',
										ru: 'Аналоги',
										zh: '同形态靓号',
									})}{' '}
									({(reportData()?.pattern_siblings || []).length})
								</span>
							</button>
						</div>

						{/* ═══════════════════════════════════════════════════════════════════════════
						    TAB 1: VALUATION & ECONOMICS (ارزش‌گذاری و مهندسی مالی)
						   ═══════════════════════════════════════════════════════════════════════════ */}
						<Show when={activeTab() === 'valuation'}>
							<div class="space-y-4">
								{/* 🐋 WHALE VANITY ASK ALERT */}
								<Show when={reportData()?.live_listing?.is_vanity_ask}>
									<div class="bg-amber-500/10 border border-amber-400/40 rounded-2xl p-4 text-start">
										<div class="flex items-center justify-between mb-1">
											<span class="text-xs font-black text-amber-300 flex items-center gap-1.5">
												<span class="material-symbols-outlined text-base">warning</span>
												<span>
													{layaT({
														fa: 'فیلتر قیمت نمایشی نهنگ (Whale Vanity Ask Detected)',
														en: 'Whale Vanity Ask Filtered',
														ru: 'Фильтр завышенной цены кита',
														zh: '巨鲸虚高挂单过滤',
													})}
												</span>
											</span>
											<span class="text-[10px] font-mono font-black text-amber-300" dir="ltr">
												Listed: {formatTon(reportData()?.live_listing?.ask_or_bid_ton)} TON
											</span>
										</div>
										<p class="text-[11px] text-white/75 leading-relaxed">
											{layaT({
												fa: `مالک فعلی این شماره را با قیمت نمایشی ${formatTon(reportData()?.live_listing?.ask_or_bid_ton)} TON لیست کرده است، اما بر اساس آخرین معامله واقعی روی زنجیره (${formatTon(reportData()?.market_provenance?.last_sale_ton)} TON) و کف بازار، ارزش منصفانه واقعی آن ${formatTon(reportData()?.expected_ton)} TON است.`,
												en: `Current owner listed a vanity ask of ${formatTon(reportData()?.live_listing?.ask_or_bid_ton)} TON. NV-Engine anchored Fair Value to real on-chain clearing history (${formatTon(reportData()?.expected_ton)} TON).`,
												ru: `Текущий владелец выставил завышенную цену ${formatTon(reportData()?.live_listing?.ask_or_bid_ton)} TON. NV-Engine опирается на реальные ончейн-сделки (${formatTon(reportData()?.expected_ton)} TON).`,
												zh: `当前持有者挂出了 ${formatTon(reportData()?.live_listing?.ask_or_bid_ton)} TON 的展示性高价。NV-Engine 基于链上真实成交锚定公允价值为 ${formatTon(reportData()?.expected_ton)} TON。`,
											})}
										</p>
									</div>
								</Show>

								{/* 📊 4 VALUATION FIGURES GRID */}
								<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start">
									<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
										<h3 class="text-xs font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-[#0098EA] text-base">
												monitoring
											</span>
											<span>{layaT(NUMBER_REPORT_I18N.fourFigureMatrix)}</span>
										</h3>
										<span
											class="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20"
											dir="ltr"
										>
											{reportData()?.confidence_score}% Confidence
										</span>
									</div>

									<div class="grid grid-cols-2 gap-2.5 my-3">
										<div class="p-3.5 rounded-2xl bg-gradient-to-br from-[#0098EA]/15 via-black/40 to-black/60 border border-[#0098EA]/40 shadow-lg shadow-[#0098EA]/10 flex flex-col justify-between">
											<div class="flex items-center justify-between mb-1">
												<span class="text-[9px] uppercase font-black text-[#0098EA]">
													{layaT(NUMBER_REPORT_I18N.fairValue)}
												</span>
												<span class="w-2 h-2 rounded-full bg-[#0098EA] animate-pulse" />
											</div>
											<div class="font-mono font-black text-white text-base sm:text-lg" dir="ltr">
												{formatTon(reportData()?.expected_ton)}{' '}
												<span class="text-xs text-[#0098EA]">TON</span>
											</div>
											<span class="text-[10px] text-white/50 font-mono mt-0.5" dir="ltr">
												≈ {formatUsd(reportData()?.expected_usd)}
											</span>
										</div>

										<div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
											<div class="flex items-center justify-between mb-1">
												<span class="text-[9px] uppercase font-black text-amber-300">
													{layaT(NUMBER_REPORT_I18N.suggestedAsk)}
												</span>
												<span class="material-symbols-outlined text-xs text-amber-400">sell</span>
											</div>
											<div class="font-mono font-black text-white text-base sm:text-lg" dir="ltr">
												{formatTon(reportData()?.suggested_ask_ton)}{' '}
												<span class="text-xs text-amber-400">TON</span>
											</div>
											<span class="text-[10px] text-white/50 font-mono mt-0.5" dir="ltr">
												≈ {formatUsd(reportData()?.suggested_ask_usd)}
											</span>
										</div>

										<div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
											<div class="flex items-center justify-between mb-1">
												<span class="text-[9px] uppercase font-black text-rose-400">
													{layaT(NUMBER_REPORT_I18N.liquidation)}
												</span>
												<span class="material-symbols-outlined text-xs text-rose-400">
													flash_on
												</span>
											</div>
											<div class="font-mono font-black text-white text-base sm:text-lg" dir="ltr">
												{formatTon(reportData()?.liquidation_ton)}{' '}
												<span class="text-xs text-rose-400">TON</span>
											</div>
											<span class="text-[10px] text-white/50 font-mono mt-0.5" dir="ltr">
												≈ {formatUsd(reportData()?.liquidation_usd)}
											</span>
										</div>

										<div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
											<div class="flex items-center justify-between mb-1">
												<span class="text-[9px] uppercase font-black text-emerald-400">
													{layaT(NUMBER_REPORT_I18N.uncertaintyBand)}
												</span>
												<span class="material-symbols-outlined text-xs text-emerald-400">
													sync_alt
												</span>
											</div>
											<div
												class="font-mono font-black text-white text-xs sm:text-sm truncate"
												dir="ltr"
											>
												{formatTon(reportData()?.low_ton)} - {formatTon(reportData()?.high_ton)}{' '}
												<span class="text-[10px] text-emerald-400">TON</span>
											</div>
											<span class="text-[9px] text-white/40 mt-0.5">
												{layaT(NUMBER_REPORT_I18N.madSigmaBounds)}
											</span>
										</div>
									</div>

									<div class="p-3 rounded-2xl bg-black/40 border border-white/5 text-[11px] text-white/75 leading-relaxed">
										<div class="font-bold text-cyan-300 mb-0.5">
											{layaT({
												fa: 'خلاصه داوری الگوریتم:',
												en: 'Executive Valuation Verdict:',
												ru: 'Вердикт алгоритма оценки:',
												zh: '算法估值总结：',
											})}
										</div>
										<div>
											{isRtl()
												? reportData()?.recommendation?.summary_fa
												: reportData()?.recommendation?.summary_en}
										</div>
										<div class="mt-2 pt-2 border-t border-white/5 text-[10px] font-mono text-white/45" dir="ltr">
											Basis: {reportData()?.price_basis}
										</div>
									</div>
								</div>

								{/* 📈 HISTORICAL PRICE & FLOOR-MULTIPLE TRAJECTORY SVG CHART */}
								<Show when={(reportData()?.price_trajectory || []).length > 0}>
									<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-cyan-500/30 rounded-[28px] p-5 shadow-xl text-start">
										<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5 flex-wrap gap-2">
											<div>
												<h3 class="text-xs font-black text-white flex items-center gap-2">
													<span class="material-symbols-outlined text-cyan-400 text-base">
														show_chart
													</span>
													<span>
														{layaT({
															fa: 'منحنی تاریخی قیمت و ضریب نسبت به کف (Mint ← معاملات ← ارزش فعلی ← هدف ۱۲ ماهه)',
															en: 'On-Chain Price & Floor-Multiple Trajectory Curve',
															ru: 'Кривая ончейн-цены и мультипликатора к Floor',
															zh: '链上历史价格与地板价倍数轨迹曲线',
														})}
													</span>
												</h3>
												<p class="text-[10px] text-white/50 mt-0.5">
													{layaT({
														fa: 'ترسیم دقیق مسیر رشد دارایی از ضرب اولیه دسامبر ۲۰۲۲ تا ارزش منصفانه کنونی و هدف صعودی',
														en: 'Complete lifecycle trajectory from Dec 2022 Genesis Mint to Today & 12M Bull Target',
														ru: 'Полная траектория от минта декабря 2022 до текущей справедливой цены и цели 12М',
														zh: '从 2022 年 12 月创世铸造至今及未来 12 个月目标的完整价值轨迹',
													})}
												</p>
											</div>
											<span class="text-[9px] font-mono font-black px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" dir="ltr">
												{
													reportData()?.price_trajectory?.[
														(reportData()?.price_trajectory?.length || 2) - 2
													]?.floor_multiple
												}
												× FLOOR
											</span>
										</div>

										{/* SVG Trajectory Curve */}
										{(() => {
											const pts = reportData()?.price_trajectory || [];
											const maxTon = Math.max(...pts.map((p) => p.price_ton), 100);
											const minTon = Math.min(...pts.map((p) => p.price_ton), 0);
											const span = Math.max(1, maxTon - minTon);
											const coords = pts.map((p, i) => {
												const x =
													pts.length === 1
														? 180
														: Math.round(28 + (i / (pts.length - 1)) * 304);
												const y = Math.round(
													102 - ((p.price_ton - minTon) / span) * 74,
												);
												return { ...p, x, y };
											});
											const linePath = coords
												.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
												.join(' ');
											const areaPath =
												coords.length > 1
													? `${linePath} L ${coords[coords.length - 1].x} 116 L ${coords[0].x} 116 Z`
													: '';

											return (
												<div>
													<div class="bg-black/50 rounded-2xl border border-white/5 p-3 mb-3">
														<svg
															viewBox="0 0 360 128"
															class="w-full h-32 overflow-visible"
															dir="ltr"
														>
															<defs>
																<linearGradient
																	id="trajGrad888"
																	x1="0"
																	y1="0"
																	x2="0"
																	y2="1"
																>
																	<stop
																		offset="0%"
																		stop-color="#0098EA"
																		stop-opacity="0.42"
																	/>
																	<stop
																		offset="100%"
																		stop-color="#0098EA"
																		stop-opacity="0.0"
																	/>
																</linearGradient>
															</defs>
															<line
																x1="20"
																y1="28"
																x2="340"
																y2="28"
																stroke="rgba(255,255,255,0.06)"
																stroke-dasharray="3 3"
															/>
															<line
																x1="20"
																y1="65"
																x2="340"
																y2="65"
																stroke="rgba(255,255,255,0.06)"
																stroke-dasharray="3 3"
															/>
															<line
																x1="20"
																y1="102"
																x2="340"
																y2="102"
																stroke="rgba(255,255,255,0.06)"
																stroke-dasharray="3 3"
															/>
															{areaPath && (
																<path d={areaPath} fill="url(#trajGrad888)" />
															)}
															<path
																d={linePath}
																fill="none"
																stroke="#0098EA"
																stroke-width="2.5"
																stroke-linecap="round"
																stroke-linejoin="round"
															/>
															<For each={coords}>
																{(pt) => (
																	<g>
																		<circle
																			cx={pt.x}
																			cy={pt.y}
																			r={
																				pt.point_type === 'FairValue'
																					? '5.5'
																					: '4'
																			}
																			fill={
																				pt.point_type === 'Mint'
																					? '#f59e0b'
																					: pt.point_type === 'Sale'
																						? '#10b981'
																						: pt.point_type === 'FairValue'
																							? '#0098EA'
																							: '#a855f7'
																			}
																			stroke="#08090D"
																			stroke-width="1.5"
																		/>
																		<text
																			x={pt.x}
																			y={Math.max(14, pt.y - 9)}
																			text-anchor="middle"
																			fill="#ffffff"
																			font-size="8.5"
																			font-family="monospace"
																			font-weight="bold"
																		>
																			{formatTon(pt.price_ton)}T
																		</text>
																		<text
																			x={pt.x}
																			y="123"
																			text-anchor="middle"
																			fill="rgba(255,255,255,0.5)"
																			font-size="7.5"
																			font-family="monospace"
																		>
																			{pt.date}
																		</text>
																	</g>
																)}
															</For>
														</svg>
													</div>

													<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
														<For each={pts.slice(-4)}>
															{(pt) => (
																<div class="p-2.5 rounded-xl bg-black/40 border border-white/5 text-center">
																	<span class="text-[9px] text-white/45 block truncate">
																		{isRtl() ? pt.label_fa : pt.label}
																	</span>
																	<span
																		class="text-xs font-mono font-black text-white block mt-0.5"
																		dir="ltr"
																	>
																		{formatTon(pt.price_ton)} TON
																	</span>
																	<span
																		class="text-[9px] font-mono text-cyan-300 block"
																		dir="ltr"
																	>
																		{pt.floor_multiple}× Floor ({formatUsd(pt.price_usd)})
																	</span>
																</div>
															)}
														</For>
													</div>
												</div>
											);
										})()}
									</div>
								</Show>

								{/* 🐋 OWNER COST-BASIS, UNREALIZED PNL & SELLER NEGOTIATION LEVERAGE */}
								<Show when={reportData()?.owner_intelligence}>
									<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-amber-500/30 rounded-[28px] p-5 shadow-xl text-start">
										<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5 flex-wrap gap-2">
											<div>
												<h3 class="text-xs font-black text-white flex items-center gap-2">
													<span class="material-symbols-outlined text-amber-400 text-base">
														account_balance_wallet
													</span>
													<span>
														{layaT({
															fa: 'کالبدشکافی بهای تمام‌شده مالک، سود تحقق‌نیافته (PnL) و اهرم مذاکره خرید',
															en: 'Owner Cost-Basis, Unrealized PnL & Negotiation Leverage',
															ru: 'Себестоимость владельца, нереализованный PnL и переговорный рычаг',
															zh: '持有者建仓成本、未实现盈亏 (PnL) 与议价杠杆分析',
														})}
													</span>
												</h3>
												<p class="text-[10px] text-white/50 mt-0.5">
													{isRtl()
														? reportData()?.owner_intelligence?.holder_tier_fa
														: reportData()?.owner_intelligence?.holder_tier_en}
												</p>
											</div>
											<span class="text-[9px] font-mono font-black px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30" dir="ltr">
												{reportData()?.owner_intelligence?.total_numbers_held || 1}× +888 HELD
											</span>
										</div>

										<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-center">
											<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
												<span class="text-[9px] text-white/40 block mb-0.5">
													{layaT({
														fa: 'بهای ورود مالک',
														en: 'Owner Entry Cost',
														ru: 'Цена входа',
														zh: '持有者入场成本',
													})}
												</span>
												<span class="text-xs font-mono font-black text-white block" dir="ltr">
													{formatTon(reportData()?.owner_intelligence?.entry_cost_ton)} TON
												</span>
												<span class="text-[9px] text-white/40 font-mono" dir="ltr">
													{reportData()?.owner_intelligence?.entry_type} •{' '}
													{formatUsd(reportData()?.owner_intelligence?.entry_cost_usd)}
												</span>
											</div>

											<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
												<span class="text-[9px] text-white/40 block mb-0.5">
													{layaT({
														fa: 'سود تحقق‌نیافته مالک',
														en: 'Owner Unrealized PnL',
														ru: 'Нереализованный PnL',
														zh: '未实现盈亏',
													})}
												</span>
												<span
													class={`text-xs font-mono font-black block ${
														(reportData()?.owner_intelligence?.unrealized_pnl_ton || 0) >= 0
															? 'text-emerald-400'
															: 'text-rose-400'
													}`}
													dir="ltr"
												>
													{(reportData()?.owner_intelligence?.unrealized_pnl_ton || 0) >= 0
														? '+'
														: ''}
													{formatTon(reportData()?.owner_intelligence?.unrealized_pnl_ton)} TON
												</span>
												<span class="text-[9px] text-emerald-300/80 font-mono" dir="ltr">
													{(reportData()?.owner_intelligence?.unrealized_pnl_pct || 0) >= 0
														? '+'
														: ''}
													{reportData()?.owner_intelligence?.unrealized_pnl_pct}% ROI
												</span>
											</div>

											<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
												<span class="text-[9px] text-white/40 block mb-0.5">
													{layaT({
														fa: 'موجودی نقد کیف‌پول مالک',
														en: 'Owner Liquid TON',
														ru: 'Ликвидный баланс TON',
														zh: '钱包流动 TON 余额',
													})}
												</span>
												<span class="text-xs font-mono font-black text-cyan-300 block" dir="ltr">
													{formatTon(reportData()?.owner_intelligence?.liquid_balance_ton)} TON
												</span>
												<span class="text-[9px] text-white/40 font-mono" dir="ltr">
													≈ {formatUsd(reportData()?.owner_intelligence?.liquid_balance_usd)}
												</span>
											</div>

											<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
												<span class="text-[9px] text-white/40 block mb-0.5">
													{layaT({
														fa: 'انعطاف فروشنده',
														en: 'Seller Flexibility',
														ru: 'Гибкость продавца',
														zh: '卖家议价弹性',
													})}
												</span>
												<span class="text-xs font-mono font-black text-amber-300 block" dir="ltr">
													{reportData()?.owner_intelligence?.seller_negotiation_score}/100
												</span>
												<span class="text-[9px] text-white/40">
													{(reportData()?.owner_intelligence?.seller_negotiation_score || 50) >=
													60
														? layaT({
																fa: 'منعطف',
																en: 'Flexible',
																ru: 'Гибкий',
																zh: '可议价',
															})
														: layaT({
																fa: 'نگهدارنده سرسخت',
																en: 'Diamond Hands',
																ru: 'Держит крепко',
																zh: '坚定持有',
															})}
												</span>
											</div>
										</div>

										<div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-white/85 leading-relaxed">
											<div class="font-black text-amber-300 mb-0.5">
												{layaT({
													fa: `استراتژی مذاکره (${reportData()?.owner_intelligence?.negotiation_stance_fa}):`,
													en: 'Institutional Negotiation Strategy:',
													ru: 'Институциональная стратегия переговоров:',
													zh: '机构级议价策略建议：',
												})}
											</div>
											<div>{reportData()?.owner_intelligence?.negotiation_strategy_fa}</div>
										</div>
									</div>
								</Show>

								{/* 🤝 FRAGMENT MAKE-AN-OFFER (0.05% FEE) & 5% PROTOCOL NET PROCEEDS SIMULATOR */}
								<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start">
									<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
										<h3 class="text-xs font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-emerald-400 text-base">
												handshake
											</span>
											<span>
												{layaT({
													fa: 'شبیه‌ساز ثبت پیشنهاد (Make an Offer) و خالص دریافتی فروشنده',
													en: 'Fragment Make-an-Offer (0.05%) & Net Proceeds Simulator',
													ru: 'Симулятор оффера Fragment (0.05%) и чистой выручки продавца',
													zh: 'Fragment 报价模拟器 (0.05% 费率) 与卖家净收益测算',
												})}
											</span>
										</h3>
										<span class="text-[9px] font-mono font-black px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
											0.05% OFFER FEE
										</span>
									</div>

									<div class="mb-3">
										<div class="flex items-center justify-between text-[11px] mb-1.5">
											<span class="text-white/60">
												{layaT({
													fa: 'نسبت پیشنهاد خرید نسبت به ارزش منصفانه:',
													en: 'Offer Percentage of Fair Value:',
													ru: 'Процент оффера от справедливой цены:',
													zh: '报价占公允价值比例：',
												})}
											</span>
											<span class="font-mono font-black text-cyan-300" dir="ltr">
												{customOfferPct()}% ({formatTon(simulatedOfferStats().offerTon)} TON)
											</span>
										</div>
										<input
											type="range"
											min="75"
											max="125"
											step="1"
											value={customOfferPct()}
											onInput={(e) => setCustomOfferPct(Number(e.currentTarget.value))}
											class="w-full accent-[#0098EA] cursor-pointer"
										/>
									</div>

									<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
										<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
											<span class="text-[9px] text-white/40 block mb-0.5">
												{layaT({
													fa: 'مبلغ پیشنهاد شما',
													en: 'Your Offer',
													ru: 'Ваш оффер',
													zh: '您的出价',
												})}
											</span>
											<span class="text-xs font-mono font-black text-white block" dir="ltr">
												{formatTon(simulatedOfferStats().offerTon)} TON
											</span>
											<span class="text-[9px] text-white/40 font-mono" dir="ltr">
												{formatUsd(simulatedOfferStats().offerUsd)}
											</span>
										</div>

										<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
											<span class="text-[9px] text-white/40 block mb-0.5">
												{layaT({
													fa: 'کارمزد پیشنهاد (0.05%)',
													en: 'Offer Fee (0.05%)',
													ru: 'Комиссия оффера (0.05%)',
													zh: '报价手续费 (0.05%)',
												})}
											</span>
											<span class="text-xs font-mono font-black text-amber-300 block" dir="ltr">
												{simulatedOfferStats().feeTon} TON
											</span>
											<span class="text-[9px] text-white/40">Fragment Contract</span>
										</div>

										<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
											<span class="text-[9px] text-white/40 block mb-0.5">
												{layaT({
													fa: 'خالص دریافتی فروشنده (-5%)',
													en: 'Seller Net (-5%)',
													ru: 'Чистыми продавцу (-5%)',
													zh: '卖家净得 (-5%)',
												})}
											</span>
											<span class="text-xs font-mono font-black text-emerald-400 block" dir="ltr">
												{formatTon(simulatedOfferStats().sellerNetTon)} TON
											</span>
											<span class="text-[9px] text-white/40 font-mono" dir="ltr">
												{formatUsd(simulatedOfferStats().sellerNetUsd)}
											</span>
										</div>

										<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
											<span class="text-[9px] text-white/40 block mb-0.5">
												{layaT({
													fa: 'شانس پذیرش مالک',
													en: 'Acceptance Odds',
													ru: 'Шанс принятия',
													zh: '成交概率',
												})}
											</span>
											<span class="text-xs font-mono font-black text-cyan-300 block" dir="ltr">
												{simulatedOfferStats().acceptProb}%
											</span>
											<span class="text-[9px] text-white/40">
												{simulatedOfferStats().acceptProb >= 75 ? 'High' : 'Moderate'}
											</span>
										</div>
									</div>
								</div>

								{/* 💸 TRANSACTION FINANCIAL ENGINEERING & 5% PROTOCOL FEE */}
								<NumberFinancialEngineeringCard
									expectedTon={
										reportData()?.expected_ton ? Number(reportData()!.expected_ton) : 0
									}
									expectedUsd={reportData()?.expected_usd}
									tonUsdRate={reportData()?.ton_usd_rate}
								/>

								{/* 📈 MARKET DEPTH, RENTAL YIELD & SELLING PROBABILITIES */}
								<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start">
									<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
										<h3 class="text-xs font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-[#0098EA] text-base">
												waterfall_chart
											</span>
											<span>
												{layaT({
													fa: 'عمق نقدشوندگی، اجاره ماهانه و احتمال فروش',
													en: 'Liquidity Depth, Rental Yield & Selling Probabilities',
													ru: 'Глубина ликвидности, доходность аренды и вероятность продажи',
													zh: '流动性深度、月度租金收益与售出概率',
												})}
											</span>
										</h3>
										<span class="text-[9px] uppercase font-mono font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2 py-0.5 rounded-md">
											~{reportData()?.rental_yield?.est_apy || 9.8}% APY
										</span>
									</div>

									<div class="grid grid-cols-3 gap-2 mb-3 text-center">
										<div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
											<span class="text-[9px] text-white/40 block mb-0.5">
												{layaT({
													fa: 'کف باشگاه هم‌ردیف',
													en: 'Club Floor',
													ru: 'Флор клуба',
													zh: '同级地板价',
												})}
											</span>
											<span class="text-xs font-mono font-black text-white" dir="ltr">
												{formatTon(reportData()?.market_depth?.club_floor_ton)} TON
											</span>
										</div>
										<div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
											<span class="text-[9px] text-white/40 block mb-0.5">
												{layaT({
													fa: 'اجاره تخمینی ماهانه',
													en: 'Est. Monthly Rent',
													ru: 'Аренда в месяц',
													zh: '预估月租金',
												})}
											</span>
											<span class="text-xs font-mono font-black text-emerald-400" dir="ltr">
												~{formatTon(reportData()?.rental_yield?.monthly_yield_ton)} TON
											</span>
										</div>
										<div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
											<span class="text-[9px] text-white/40 block mb-0.5">
												{layaT({
													fa: 'وثیقه دیفای (65% LTV)',
													en: 'DeFi Collateral',
													ru: 'Залог DeFi (65%)',
													zh: 'DeFi 抵押额 (65%)',
												})}
											</span>
											<span class="text-xs font-mono font-black text-cyan-300" dir="ltr">
												{formatTon(reportData()?.collateral_value_ton)} TON
											</span>
										</div>
									</div>

									<div class="grid grid-cols-3 gap-2 text-center">
										<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
											<span class="text-[9px] text-white/40 block mb-0.5">
												{layaT({
													fa: 'فروش تا ۷ روز',
													en: '7-Day Sale Prob',
													ru: 'Продажа за 7 дн.',
													zh: '7天售出率',
												})}
											</span>
											<span class="text-xs font-black font-mono text-amber-400">
												{reportData()?.selling_probabilities?.p_7d ?? 85}%
											</span>
										</div>
										<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
											<span class="text-[9px] text-white/40 block mb-0.5">
												{layaT({
													fa: 'فروش تا ۳۰ روز',
													en: '30-Day Sale Prob',
													ru: 'Продажа за 30 дн.',
													zh: '30天售出率',
												})}
											</span>
											<span class="text-xs font-black font-mono text-cyan-400">
												{reportData()?.selling_probabilities?.p_30d ?? 96}%
											</span>
										</div>
										<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
											<span class="text-[9px] text-white/40 block mb-0.5">
												{layaT({
													fa: 'فروش تا ۹۰ روز',
													en: '90-Day Sale Prob',
													ru: 'Продажа за 90 дн.',
													zh: '90天售出率',
												})}
											</span>
											<span class="text-xs font-black font-mono text-emerald-400">
												{reportData()?.selling_probabilities?.p_90d ?? 99}%
											</span>
										</div>
									</div>
								</div>
							</div>
						</Show>

						{/* ═══════════════════════════════════════════════════════════════════════════
						    TAB 2: BINARY, 4-BIT BCD, ITU-T Q.23 DTMF ACOUSTICS & PATTERN DNA
						   ═══════════════════════════════════════════════════════════════════════════ */}
						<Show when={activeTab() === 'forensics'}>
							<div class="space-y-4">
								{/* 🎹 INTERACTIVE 3x4 KEYPAD TRAJECTORY & WEB AUDIO DTMF SYNTHESIZER */}
								<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-purple-500/30 rounded-[28px] p-5 shadow-xl text-start">
									<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5 flex-wrap gap-2">
										<div>
											<h3 class="text-xs font-black text-white flex items-center gap-2">
												<span class="material-symbols-outlined text-purple-400 text-base">
													graphic_eq
												</span>
												<span>
													{layaT({
														fa: 'سینتی‌سایزر صوتی DTMF (ITU-T Q.23) و هندسه حرکت کی‌پد',
														en: 'ITU-T Q.23 DTMF Acoustic Synthesizer & Keypad Trajectory',
														ru: 'Акустический синтезатор DTMF (ITU-T Q.23) и траектория набора',
														zh: 'ITU-T Q.23 双音多频 (DTMF) 声学合成器与拨号盘轨迹',
													})}
												</span>
											</h3>
											<p class="text-[10px] text-white/50 mt-0.5">
												{isRtl()
													? reportData()?.binary_forensics?.keypad_geometry_class_fa
													: reportData()?.binary_forensics?.keypad_geometry_class_en}
											</p>
										</div>

										<button
											type="button"
											onClick={handlePlayFullDtmfSequence}
											class={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition-all active:scale-95 ${
												isPlayingDtmf()
													? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
													: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 hover:brightness-110'
											}`}
										>
											<span class="material-symbols-outlined text-sm">
												{isPlayingDtmf() ? 'stop_circle' : 'volume_up'}
											</span>
											<span>
												{isPlayingDtmf()
													? layaT({
															fa: 'توقف پخش',
															en: 'Stop Audio',
															ru: 'Стоп',
															zh: '停止播放',
														})
													: layaT({
															fa: 'پخش سیگنال صوتی شماره',
															en: 'Play DTMF Dial Tones',
															ru: 'Прослушать DTMF сигнал',
															zh: '播放拨号音频信号',
														})}
											</span>
										</button>
									</div>

									{/* Interactive Digit Sequence Strip (Click any digit to hear its dual-frequency tone) */}
									<div class="mb-4">
										<div class="text-[10px] text-white/50 mb-1.5">
											{layaT({
												fa: 'روی هر رقم کلیک کنید تا فرکانس دوگانه استاندارد مخابراتی (Row Hz + Col Hz) آن پخش شود:',
												en: 'Click any digit cell to synthesize its exact ITU-T Q.23 dual-tone frequency:',
												ru: 'Нажмите на любую цифру для синтеза двухтональной частоты ITU-T Q.23:',
												zh: '点击任意数字格即可合成播放标准 ITU-T Q.23 双音频频率：',
											})}
										</div>
										<div class="grid grid-cols-4 sm:grid-cols-8 gap-1.5" dir="ltr">
											<For each={reportData()?.binary_forensics?.digits_matrix || []}>
												{(cell, idx) => (
													<button
														type="button"
														onClick={() => {
															setActiveDtmfIndex(idx());
															playSingleDtmfTone(cell.dtmf_row_hz, cell.dtmf_col_hz, 210);
														}}
														class={`p-2 rounded-xl border text-center transition-all ${
															activeDtmfIndex() === idx()
																? 'bg-purple-500/30 border-purple-400 scale-105 shadow-md shadow-purple-500/30'
																: 'bg-black/40 border-white/10 hover:border-purple-400/50'
														}`}
													>
														<div class="text-base font-mono font-black text-white">
															{cell.digit}
														</div>
														<div class="text-[8px] font-mono text-purple-300">
															{cell.dtmf_row_hz}+{cell.dtmf_col_hz}Hz
														</div>
														<div class="text-[8px] font-mono text-emerald-400 mt-0.5">
															BCD {cell.bcd_nibble}
														</div>
													</button>
												)}
											</For>
										</div>
									</div>

									{/* 3x4 Standard Telephone Keypad Grid with SVG Laser Vector Trajectory Overlay */}
									<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center bg-black/40 p-3.5 rounded-2xl border border-white/5">
										<div class="relative max-w-[210px] mx-auto w-full" dir="ltr">
											<div class="grid grid-cols-3 gap-1.5 w-full relative z-10">
												<For each={['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']}>
													{(keyChar) => {
														const hitCount = () =>
															(reportData()?.binary_forensics?.digits_matrix || []).filter(
																(c) => c.digit === keyChar,
															).length;
														const isActiveNow = () => {
															const idx = activeDtmfIndex();
															if (idx === null) return false;
															const cell =
																reportData()?.binary_forensics?.digits_matrix?.[idx];
															return cell?.digit === keyChar;
														};
														return (
															<div
																class={`h-10 rounded-xl border flex items-center justify-between px-2.5 font-mono text-xs font-black transition-all ${
																	isActiveNow()
																		? 'bg-purple-500 text-white border-white scale-105 shadow-lg shadow-purple-500/50'
																		: hitCount() > 0
																			? 'bg-purple-500/20 border-purple-400/50 text-white'
																			: 'bg-white/[0.02] border-white/5 text-white/25'
																}`}
															>
																<span>{keyChar}</span>
																<Show when={hitCount() > 0}>
																	<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-400/30 text-purple-200">
																		×{hitCount()}
																	</span>
																</Show>
															</div>
														);
													}}
												</For>
											</div>

											{/* SVG Laser Vector Stroke Overlay */}
											<svg
												viewBox="0 0 210 184"
												class="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
											>
												<defs>
													<linearGradient id="laserVec888" x1="0" y1="0" x2="1" y2="1">
														<stop offset="0%" stop-color="#00f2fe" />
														<stop offset="50%" stop-color="#a855f7" />
														<stop offset="100%" stop-color="#10b981" />
													</linearGradient>
												</defs>
												<Show when={keypadVectorData().coords.length > 1}>
													<path
														d={keypadVectorData().pathStr}
														fill="none"
														stroke="url(#laserVec888)"
														stroke-width="2.75"
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-dasharray="4 2"
														opacity="0.9"
													/>
												</Show>
												<For each={keypadVectorData().coords}>
													{(pt, i) => (
														<circle
															cx={pt.x}
															cy={pt.y}
															r={i() === 0 || i() === keypadVectorData().coords.length - 1 ? '4.5' : '3'}
															fill={
																i() === 0
																	? '#00f2fe'
																	: i() === keypadVectorData().coords.length - 1
																		? '#10b981'
																		: '#a855f7'
															}
															stroke="#08090D"
															stroke-width="1.2"
														/>
													)}
												</For>
											</svg>
										</div>

										<div class="space-y-2 text-xs">
											<div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
												<span class="text-white/60 text-[10px]">
													{layaT({
														fa: 'فاصله منهتن روی کی‌پد:',
														en: 'Keypad Manhattan Distance:',
														ru: 'Манхэттенское расстояние:',
														zh: '拨号盘曼哈顿距离：',
													})}
												</span>
												<span class="font-mono font-black text-purple-300" dir="ltr">
													{reportData()?.binary_forensics?.keypad_manhattan_distance ?? 0} steps
												</span>
											</div>
											<div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
												<span class="text-white/60 text-[10px]">
													{layaT({
														fa: 'امتیاز ارگونومی شماره‌گیری:',
														en: 'Ergonomic Dial Score:',
														ru: 'Эргономика набора:',
														zh: '拨号人体工学评分：',
													})}
												</span>
												<span class="font-mono font-black text-emerald-400" dir="ltr">
													{reportData()?.binary_forensics?.keypad_ergonomic_score ?? 90} / 100
												</span>
											</div>
											<div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
												<span class="text-white/60 text-[10px]">
													{layaT({
														fa: 'آنتروپی شانون و فشرده‌سازی:',
														en: 'Shannon Entropy:',
														ru: 'Энтропия Шеннона:',
														zh: '香农信息熵：',
													})}
												</span>
												<span class="font-mono font-black text-cyan-300" dir="ltr">
													{reportData()?.binary_forensics?.shannon_entropy_bits} bits (
													{reportData()?.binary_forensics?.kolmogorov_compression_pct}% comp)
												</span>
											</div>
										</div>
									</div>

									{/* 〰️ LIVE DUAL-SINE ACOUSTIC INTERFERENCE OSCILLOSCOPE */}
									<Show when={activeAcousticCell()}>
										<div class="mt-3 p-3.5 rounded-2xl bg-black/50 border border-purple-500/25">
											<div class="flex items-center justify-between mb-2 flex-wrap gap-1" dir="ltr">
												<span class="text-[10px] font-mono font-black text-purple-300">
													OSCILLOSCOPE • Digit '{activeAcousticCell()?.digit}' = sin(2π·
													{activeAcousticCell()?.dtmf_row_hz}Hz·t) + sin(2π·
													{activeAcousticCell()?.dtmf_col_hz}Hz·t)
												</span>
												<span class="text-[9px] font-mono text-emerald-400">
													Δf Beat:{' '}
													{(activeAcousticCell()?.dtmf_col_hz || 1336) -
														(activeAcousticCell()?.dtmf_row_hz || 852)}{' '}
													Hz
												</span>
											</div>
											<svg viewBox="0 0 320 64" class="w-full h-16 bg-[#07080C] rounded-xl border border-white/5 p-1">
												<line
													x1="0"
													y1="32"
													x2="320"
													y2="32"
													stroke="rgba(255,255,255,0.08)"
													stroke-dasharray="2 2"
												/>
												<path
													d={acousticWaveformPath()}
													fill="none"
													stroke="#c084fc"
													stroke-width="2"
													stroke-linecap="round"
												/>
											</svg>
										</div>
									</Show>
								</div>

								{/* 🧮 PER-DIGIT 8-BIT ASCII, 4-BIT BCD NIBBLE & HAMMING WEIGHT TABLE */}
								<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start">
									<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
										<h3 class="text-xs font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-cyan-400 text-base">
												terminal
											</span>
											<span>
												{layaT({
													fa: 'ماتریس بایت‌به‌بایت ASCII، کد باینری BCD و وزن همینگ',
													en: 'Byte-Level 8-Bit ASCII, 4-Bit BCD Nibble & Hamming Matrix',
													ru: 'Побайтовая матрица ASCII (8 бит), BCD (4 бита) и веса Хэмминга',
													zh: '字节级 8 位 ASCII、4 位 BCD 半字节与汉明权重矩阵',
												})}
											</span>
										</h3>
										<span class="text-[9px] font-mono font-black text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-md" dir="ltr">
											HW={reportData()?.binary_forensics?.total_hamming_weight} bits
										</span>
									</div>

									<div class="overflow-x-auto">
										<table class="w-full text-[10px] font-mono text-left" dir="ltr">
											<thead>
												<tr class="text-white/40 border-b border-white/10">
													<th class="py-1.5 px-2">#</th>
													<th class="py-1.5 px-2">Digit</th>
													<th class="py-1.5 px-2">ASCII Hex</th>
													<th class="py-1.5 px-2">8-Bit Binary</th>
													<th class="py-1.5 px-2">4-Bit BCD</th>
													<th class="py-1.5 px-2">DTMF (Row/Col)</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-white/5">
												<For each={reportData()?.binary_forensics?.digits_matrix || []}>
													{(row) => (
														<tr class="hover:bg-white/[0.03]">
															<td class="py-1.5 px-2 text-white/40">{row.position}</td>
															<td class="py-1.5 px-2 font-black text-white">{row.digit}</td>
															<td class="py-1.5 px-2 text-amber-300">{row.ascii_hex}</td>
															<td class="py-1.5 px-2 text-cyan-300">{row.ascii_binary}</td>
															<td class="py-1.5 px-2 text-emerald-400 font-bold">
																{row.bcd_nibble}
															</td>
															<td class="py-1.5 px-2 text-purple-300">
																{row.dtmf_row_hz}Hz / {row.dtmf_col_hz}Hz
															</td>
														</tr>
													)}
												</For>
											</tbody>
										</table>
									</div>
								</div>

								{/* 🔐 TEP-62 SHA-256 256-BIT INDEX & TVM BAG-OF-CELLS (BOC) FORENSICS */}
								<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start space-y-2.5">
									<div class="flex items-center justify-between border-b border-white/5 pb-2.5">
										<h3 class="text-xs font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-emerald-400 text-base">
												token
											</span>
											<span>
												{layaT({
													fa: 'شناسه ۲۵۶ بیتی TEP-62 و سلول‌های باینری TVM BOC',
													en: 'TEP-62 256-Bit SHA-256 Index & TVM Bag-of-Cells (BOC)',
													ru: '256-битный индекс TEP-62 SHA-256 и ячейки TVM BOC',
													zh: 'TEP-62 256 位 SHA-256 索引与 TVM 单元包 (BOC)',
												})}
											</span>
										</h3>
										<span class="text-[9px] font-mono text-emerald-400 font-bold">TON TVM</span>
									</div>

									<div class="p-3 rounded-2xl bg-black/50 border border-white/5">
										<div class="flex items-center justify-between mb-1">
											<span class="text-[10px] text-white/50">
												TEP-62 Item Index — SHA-256("{reportData()?.binary_forensics?.clean_digits}"):
											</span>
											<button
												type="button"
												onClick={() =>
													handleCopyText(
														reportData()?.binary_forensics?.tep62_index_sha256_hex || '',
														'sha256',
													)
												}
												class="text-[9px] font-mono text-cyan-400 hover:underline"
											>
												{copiedField() === 'sha256' ? 'Copied ✓' : 'Copy Hex'}
											</button>
										</div>
										<div class="font-mono text-[10px] text-cyan-300 break-all" dir="ltr">
											{reportData()?.binary_forensics?.tep62_index_sha256_hex}
										</div>
									</div>

									<div class="p-3 rounded-2xl bg-black/50 border border-white/5">
										<span class="text-[10px] text-white/50 block mb-1">
											uint256 Decimal Representation (Telemint Smart Contract Key):
										</span>
										<div class="font-mono text-[10px] text-amber-300 break-all" dir="ltr">
											{reportData()?.binary_forensics?.tep62_index_uint256_dec}
										</div>
									</div>

									<Show when={reportData()?.binary_forensics?.token_name_boc_hex}>
										<div class="p-3 rounded-2xl bg-black/50 border border-white/5">
											<span class="text-[10px] text-white/50 block mb-1">
												Live TVM get_telemint_token_name Raw BOC Cell (Hex):
											</span>
											<div class="font-mono text-[10px] text-emerald-400 break-all" dir="ltr">
												{reportData()?.binary_forensics?.token_name_boc_hex}
											</div>
										</div>
									</Show>

									<Show when={reportData()?.binary_forensics?.tvm_code_hash}>
										<div class="grid grid-cols-1 sm:grid-cols-2 gap-2" dir="ltr">
											<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
												<span class="text-[9px] text-white/40 block">TVM Code Hash:</span>
												<span class="text-[9px] font-mono text-white/80 break-all">
													{reportData()?.binary_forensics?.tvm_code_hash}
												</span>
											</div>
											<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
												<span class="text-[9px] text-white/40 block">TVM Data Hash:</span>
												<span class="text-[9px] font-mono text-white/80 break-all">
													{reportData()?.binary_forensics?.tvm_data_hash}
												</span>
											</div>
										</div>
									</Show>
								</div>

								{/* 🌍 LAYA 4-REGION CULTURAL RADAR */}
								<NumberSingleCulturalRadarCard
									radar={reportData()?.cultural_radar}
									number={reportData()?.number || inputNumber()}
									layaReasoning={reportData()?.reasoning_log?.laya_system_one}
								/>
							</div>
						</Show>

						{/* ═══════════════════════════════════════════════════════════════════════════
						    TAB 3: ON-CHAIN HISTORY, OFFICIAL COLOR PLATE & SECURITY PLAYBOOK
						   ═══════════════════════════════════════════════════════════════════════════ */}
						<Show when={activeTab() === 'onchain'}>
							<div class="space-y-4">
								{/* 🎨 OFFICIAL NFT COLOR PLATE & MULTI-MARKETPLACE LAUNCHPAD */}
								<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start">
									<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
										<h3 class="text-xs font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-amber-400 text-base">
												palette
											</span>
											<span>
												{layaT({
													fa: 'پلیت رنگی رسمی NFT، قرارداد تلمینت و لینک بازارها',
													en: 'Official NFT Color Plate & Marketplace Explorer',
													ru: 'Официальная цветовая палитра NFT и маркетплейсы',
													zh: '官方 NFT 色板、Telemint 合约与市场链接',
												})}
											</span>
										</h3>
										<span
											class="text-[10px] font-mono font-black px-2 py-0.5 rounded-md border border-white/20 text-white"
											style={{
												'background-color':
													reportData()?.market_provenance?.color_hex || '#8D66E3',
											}}
											dir="ltr"
										>
											{reportData()?.market_provenance?.color_hex}
										</span>
									</div>

									<div class="grid grid-cols-2 gap-2.5 mb-3">
										<div class="p-3 rounded-2xl bg-black/40 border border-white/5">
											<span class="text-[9px] text-white/40 block mb-0.5">
												{layaT({
													fa: 'نام و رده پلیت رنگی:',
													en: 'Official Plate Color:',
													ru: 'Официальный цвет палитры:',
													zh: '官方色板颜色与等级：',
												})}
											</span>
											<span class="text-xs font-black text-white block">
												{isRtl()
													? reportData()?.market_provenance?.color_name_fa
													: reportData()?.market_provenance?.color_name_en}
											</span>
											<span class="text-[9px] font-mono text-amber-300">
												{reportData()?.market_provenance?.color_tier_fa}
											</span>
										</div>

										<div class="p-3 rounded-2xl bg-black/40 border border-white/5">
											<span class="text-[9px] text-white/40 block mb-0.5">
												{layaT({
													fa: 'آدرس قرارداد NFT:',
													en: 'NFT Contract Address:',
													ru: 'Адрес NFT-контракта:',
													zh: 'NFT 合约地址：',
												})}
											</span>
											<div class="flex items-center justify-between gap-1" dir="ltr">
												<span class="text-xs font-mono font-black text-cyan-300 truncate">
													{shortAddr(reportData()?.market_provenance?.nft_address)}
												</span>
												<Show when={reportData()?.market_provenance?.nft_address}>
													<button
														type="button"
														onClick={() =>
															handleCopyText(
																reportData()?.market_provenance?.nft_address || '',
																'nft_addr',
															)
														}
														class="text-[9px] text-white/50 hover:text-white"
													>
														{copiedField() === 'nft_addr' ? '✓' : 'Copy'}
													</button>
												</Show>
											</div>
											<span class="text-[9px] font-mono text-white/40 block mt-0.5" dir="ltr">
												Owner: {shortAddr(reportData()?.market_provenance?.owner_address)}
											</span>
										</div>
									</div>

									{/* Direct Multi-Marketplace Links */}
									<div class="grid grid-cols-2 sm:grid-cols-5 gap-2" dir="ltr">
										<a
											href={reportData()?.market_provenance?.fragment_url}
											target="_blank"
											rel="noopener noreferrer"
											class="py-2 px-2.5 rounded-xl bg-[#0098EA]/15 hover:bg-[#0098EA]/25 border border-[#0098EA]/40 text-center text-[10px] font-black text-cyan-300 flex items-center justify-center gap-1"
										>
											<span>Fragment</span>
											<span class="material-symbols-outlined text-xs">open_in_new</span>
										</a>
										<a
											href={reportData()?.market_provenance?.nums888_url}
											target="_blank"
											rel="noopener noreferrer"
											class="py-2 px-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-center text-[10px] font-black text-purple-300 flex items-center justify-center gap-1"
										>
											<span>Nums888</span>
											<span class="material-symbols-outlined text-xs">open_in_new</span>
										</a>
										<a
											href={reportData()?.market_provenance?.getgems_url}
											target="_blank"
											rel="noopener noreferrer"
											class="py-2 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-center text-[10px] font-black text-emerald-300 flex items-center justify-center gap-1"
										>
											<span>Getgems</span>
											<span class="material-symbols-outlined text-xs">open_in_new</span>
										</a>
										<a
											href={reportData()?.market_provenance?.marketapp_url}
											target="_blank"
											rel="noopener noreferrer"
											class="py-2 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-center text-[10px] font-black text-amber-300 flex items-center justify-center gap-1"
										>
											<span>Marketapp</span>
											<span class="material-symbols-outlined text-xs">open_in_new</span>
										</a>
										<a
											href={reportData()?.market_provenance?.tonviewer_url}
											target="_blank"
											rel="noopener noreferrer"
											class="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-center text-[10px] font-black text-white/80 flex items-center justify-center gap-1"
										>
											<span>Tonviewer</span>
											<span class="material-symbols-outlined text-xs">open_in_new</span>
										</a>
									</div>

									{/* Official Fragment .webp Artwork + 20-Color Rarity Matrix */}
									<Show when={(reportData()?.color_palette_matrix || []).length > 0}>
										<div class="mt-4 pt-3.5 border-t border-white/10">
											<div class="flex items-center justify-between mb-2">
												<span class="text-[10px] font-black text-white/70">
													{layaT({
														fa: 'ماتریس ۲۰ پلیت رنگی رسمی تلمینت و جایگاه ضریب این شماره:',
														en: '20-Color Official Telemint Plate Rarity & Multiplier Matrix:',
														ru: 'Матрица 20 официальных цветовых палитр Telemint и множителей:',
														zh: 'Telemint 20 色官方色板稀有度与溢价倍率矩阵：',
													})}
												</span>
												<a
													href={reportData()?.market_provenance?.nft_image_url}
													target="_blank"
													rel="noopener noreferrer"
													class="text-[9px] font-mono text-cyan-400 hover:underline"
													dir="ltr"
												>
													Official .webp Plate ↗
												</a>
											</div>
											<div class="grid grid-cols-4 sm:grid-cols-5 gap-1.5" dir="ltr">
												<For each={reportData()?.color_palette_matrix || []}>
													{(cItem) => (
														<div
															class={`p-1.5 rounded-xl border text-center transition-all ${
																cItem.is_active
																	? 'border-white bg-white/15 scale-105 shadow-md'
																	: 'border-white/5 bg-black/40 opacity-65'
															}`}
														>
															<div
																class="w-full h-3 rounded-md mb-1 border border-white/20"
																style={{ 'background-color': cItem.hex }}
															/>
															<div class="text-[8px] font-mono font-black text-white truncate">
																{cItem.hex}
															</div>
															<div class="text-[8px] font-mono text-amber-300">
																{cItem.multiplier}x
															</div>
														</div>
													)}
												</For>
											</div>
										</div>
									</Show>
								</div>

								{/* 🐋 LIVE OWNER WHALE PORTFOLIO X-RAY (ALL +888 NUMBERS HELD BY CURRENT OWNER) */}
								<Show when={reportData()?.owner_intelligence}>
									<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-emerald-500/30 rounded-[28px] p-5 shadow-xl text-start">
										<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5 flex-wrap gap-2">
											<div>
												<h3 class="text-xs font-black text-white flex items-center gap-2">
													<span class="material-symbols-outlined text-emerald-400 text-base">
														radar
													</span>
													<span>
														{layaT({
															fa: 'اشعه ایکس کیف‌پول مالک فعلی و سایر شماره‌های +888 او در بلاک‌چین',
															en: 'Live Owner Whale Portfolio X-Ray & Co-Held +888 Numbers',
															ru: 'Рентген портфеля владельца и другие номера +888 в кошельке',
															zh: '当前持有者巨鲸钱包透视及名下其他 +888 号码',
														})}
													</span>
												</h3>
												<p class="text-[10px] text-white/50 mt-0.5 font-mono" dir="ltr">
													{shortAddr(reportData()?.owner_intelligence?.owner_address)} •{' '}
													{reportData()?.owner_intelligence?.wallet_workchain}
												</p>
											</div>
											<span class="text-[9px] font-mono font-black px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" dir="ltr">
												{reportData()?.owner_intelligence?.total_numbers_held || 1} NUMBERS IN VAULT
											</span>
										</div>

										<div class="grid grid-cols-3 gap-2 mb-3 text-center">
											<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
												<span class="text-[9px] text-white/40 block mb-0.5">
													{layaT({
														fa: 'تعداد کل شماره‌های مالک',
														en: 'Total Numbers Held',
														ru: 'Всего номеров у владельца',
														zh: '持有号码总数',
													})}
												</span>
												<span class="text-xs font-mono font-black text-white" dir="ltr">
													{reportData()?.owner_intelligence?.total_numbers_held} Lines
												</span>
											</div>
											<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
												<span class="text-[9px] text-white/40 block mb-0.5">
													{layaT({
														fa: 'سرمایه‌گذاری ثبت‌شده مالک',
														en: 'Total Invested',
														ru: 'Всего инвестировано',
														zh: '已记录总投入',
													})}
												</span>
												<span class="text-xs font-mono font-black text-amber-300" dir="ltr">
													{formatTon(reportData()?.owner_intelligence?.total_invested_ton)} TON
												</span>
											</div>
											<div class="p-2.5 rounded-xl bg-black/40 border border-white/5">
												<span class="text-[9px] text-white/40 block mb-0.5">
													{layaT({
														fa: 'ارزش تخمینی کل سبد',
														en: 'Est. Vault Worth',
														ru: 'Оценка портфеля',
														zh: '组合预估总值',
													})}
												</span>
												<span class="text-xs font-mono font-black text-emerald-400" dir="ltr">
													{formatTon(
														reportData()?.owner_intelligence?.portfolio_floor_worth_ton,
													)}{' '}
													TON
												</span>
											</div>
										</div>

										<div class="space-y-2">
											<For each={reportData()?.owner_intelligence?.other_holdings || []}>
												{(held) => (
													<div
														class={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
															held.is_current_number
																? 'bg-emerald-500/15 border-emerald-400/40'
																: 'bg-black/40 border-white/5 hover:border-white/20'
														}`}
													>
														<div class="min-w-0">
															<div class="flex items-center gap-1.5">
																<span
																	class="font-mono font-black text-xs text-white"
																	dir="ltr"
																>
																	{held.display_number}
																</span>
																<Show when={held.is_current_number}>
																	<span class="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
																		CURRENT
																	</span>
																</Show>
															</div>
															<div
																class="text-[9px] font-mono text-white/45 mt-0.5"
																dir="ltr"
															>
																Acquired: {held.acquired_date}
															</div>
														</div>

														<div class="flex items-center gap-2 shrink-0">
															<div class="text-end" dir="ltr">
																<div class="text-xs font-mono font-black text-amber-300">
																	{held.acquired_price_ton > 0
																		? `${formatTon(held.acquired_price_ton)} TON`
																		: 'Transferred'}
																</div>
																<Show when={held.acquired_price_usd > 0}>
																	<div class="text-[9px] font-mono text-white/40">
																		≈ {formatUsd(held.acquired_price_usd)}
																	</div>
																</Show>
															</div>
															<Show when={!held.is_current_number}>
																<button
																	type="button"
																	onClick={() => {
																		setInputNumber(held.display_number);
																		setActiveTab('valuation');
																		void handleRunAnalysis(held.display_number);
																	}}
																	class="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/40 text-[10px] font-black text-emerald-300 transition-all active:scale-95"
																>
																	{layaT({
																		fa: 'کالبدشکافی',
																		en: 'Appraise',
																		ru: 'Оценить',
																		zh: '深度评估',
																	})}
																</button>
															</Show>
														</div>
													</div>
												)}
											</For>
										</div>
									</div>
								</Show>

								{/* 📜 COMPLETE ON-CHAIN LIFECYCLE LEDGER (MINT, SALE, TRANSFER) */}
								<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start">
									<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
										<h3 class="text-xs font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-emerald-400 text-base">
												history_edu
											</span>
											<span>
												{layaT({
													fa: 'دفترکل کامل رویدادهای آن‌چین (Mint / Sale / Transfer)',
													en: 'Complete On-Chain Lifecycle Ledger (Mint / Sale / Transfer)',
													ru: 'Полный ончейн-реестр транзакций (Mint / Sale / Transfer)',
													zh: '完整链上生命周期账本 (Mint / Sale / Transfer)',
												})}
											</span>
										</h3>
										<span class="text-[9px] font-mono font-bold text-emerald-400">
											{(reportData()?.onchain_history || []).length} TXs
										</span>
									</div>

									<Show
										when={(reportData()?.onchain_history || []).length > 0}
										fallback={
											<div class="p-5 rounded-2xl bg-black/40 border border-white/5 text-center text-xs text-white/50">
												{layaT({
													fa: 'هیچ تراکنش آن‌چینی برای این ترکیب ثبت نشده است.',
													en: 'No on-chain transactions recorded for this combination.',
													ru: 'Ончейн-транзакции для этой комбинации не найдены.',
													zh: '该号码组合暂无链上交易记录。',
												})}
											</div>
										}
									>
										<div class="space-y-2">
											<For each={reportData()?.onchain_history || []}>
												{(ev) => (
													<div class="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between gap-2 text-xs">
														<div class="min-w-0">
															<div class="flex items-center gap-2">
																<span
																	class={`px-2 py-0.5 rounded-md text-[9px] font-mono font-black uppercase ${
																		ev.event_type === 'Sale'
																			? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
																			: ev.event_type === 'Mint'
																				? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
																				: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
																	}`}
																>
																	{isRtl() ? ev.event_type_fa : ev.event_type}
																</span>
																<span class="text-[10px] font-mono text-white/50" dir="ltr">
																	{ev.date}
																</span>
															</div>
															<div
																class="text-[10px] font-mono text-white/60 mt-1 truncate"
																dir="ltr"
															>
																{shortAddr(ev.from_wallet)} → {shortAddr(ev.to_wallet)}
															</div>
														</div>

														<div class="text-end shrink-0">
															<Show
																when={ev.price_ton > 0}
																fallback={
																	<span class="text-[10px] font-mono text-white/40">
																		Wallet Transfer
																	</span>
																}
															>
																<div
																	class="font-mono font-black text-white text-xs"
																	dir="ltr"
																>
																	{formatTon(ev.price_ton)} TON
																</div>
																<div
																	class="text-[9px] font-mono text-white/45"
																	dir="ltr"
																>
																	≈ {formatUsd(ev.price_usd)}
																</div>
															</Show>
															<Show when={ev.tx_hash}>
																<a
																	href={ev.tonscan_url}
																	target="_blank"
																	rel="noopener noreferrer"
																	class="text-[9px] font-mono text-[#0098EA] hover:underline inline-flex items-center gap-0.5 mt-0.5"
																	dir="ltr"
																>
																	<span>TX Proof</span>
																	<span class="material-symbols-outlined text-[10px]">
																		open_in_new
																	</span>
																</a>
															</Show>
														</div>
													</div>
												)}
											</For>
										</div>
									</Show>
								</div>

								{/* 🛡️ SIM-FREE LOGIN & 2FA ANTI-TAKEOVER SECURITY PLAYBOOK */}
								<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start">
									<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
										<h3 class="text-xs font-black text-white flex items-center gap-2">
											<span class="material-symbols-outlined text-cyan-400 text-base">
												shield_lock
											</span>
											<span>
												{layaT({
													fa: 'پروتکل امنیتی لاگین بدون سیم‌کارت و محافظت از نشست‌های تلگرام',
													en: 'SIM-Free Login & 2FA Anti-Takeover Security Playbook',
													ru: 'Протокол безопасности входа без SIM и защита сессий Telegram',
													zh: '免 SIM 卡登录与 2FA 防盗号安全指南',
												})}
											</span>
										</h3>
										<span class="text-[9px] font-mono font-black text-emerald-400">
											ZERO SIM-SWAP
										</span>
									</div>

									<p class="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 mb-3 leading-relaxed">
										{reportData()?.security_advisory?.two_factor_warning}
									</p>

									<div class="space-y-2">
										<For each={reportData()?.security_advisory?.takeover_mitigation_steps || []}>
											{(step, idx) => (
												<div class="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5 text-[11px] text-white/80">
													<span class="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-black flex items-center justify-center shrink-0">
														{idx() + 1}
													</span>
													<span>{step}</span>
												</div>
											)}
										</For>
									</div>
								</div>
							</div>
						</Show>

						{/* ═══════════════════════════════════════════════════════════════════════════
						    TAB 4: PATTERN SIBLINGS & COMPARABLE SALES (شماره‌های هم‌الگو و مشابه)
						   ═══════════════════════════════════════════════════════════════════════════ */}
						<Show when={activeTab() === 'siblings'}>
							<div class="space-y-4">
								{/* 🔬 INTERACTIVE CUSTOM PATTERN MASK LAB & BARGAIN SNIPER */}
								<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-amber-500/35 rounded-[28px] p-5 shadow-xl text-start">
									<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5 flex-wrap gap-2">
										<div>
											<h3 class="text-xs font-black text-white flex items-center gap-2">
												<span class="material-symbols-outlined text-amber-400 text-base">
													science
												</span>
												<span>
													{layaT({
														fa: 'آزمایشگاه زنده ماسک الگو و شکارچی ارزان‌ترین هم‌خانواده‌ها',
														en: 'Interactive Pattern Mask Lab & Live Sibling Bargain Sniper',
														ru: 'Лаборатория масок паттернов и поиск выгодных аналогов',
														zh: '实时规律掩码实验室与同族低价猎手',
													})}
												</span>
											</h3>
											<p class="text-[10px] text-white/50 mt-0.5">
												{layaT({
													fa: 'با استفاده از حروف A, B, C, X هر الگوی دلخواه را مستقیماً از دیتابیس زنده Nums888 استخراج و مقایسه کنید:',
													en: 'Use wildcard letters (A, B, C, X) to query live pattern cohorts directly from Nums888:',
													ru: 'Используйте символы A, B, C, X для поиска живых номеров по маске в базе Nums888:',
													zh: '使用通配符 (A, B, C, X) 直接从 Nums888 实时检索并对比同规律号码：',
												})}
											</p>
										</div>
										<span class="text-[9px] font-mono font-black px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30" dir="ltr">
											MASK ENGINE
										</span>
									</div>

									<div class="flex items-center gap-2 mb-2.5" dir="ltr">
										<input
											type="text"
											value={customMaskInput()}
											onInput={(e) => setCustomMaskInput(e.currentTarget.value.toUpperCase())}
											onKeyDown={(e) => {
												if (e.key === 'Enter') {
													void handleRunCustomMaskSearch();
												}
											}}
											placeholder="8880AAAAAAA"
											class="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono font-black text-amber-300 focus:outline-none focus:border-amber-400"
										/>
										<button
											type="button"
											onClick={() => void handleRunCustomMaskSearch()}
											disabled={maskSearchLoading()}
											class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-black hover:brightness-110 active:scale-95 transition-all"
										>
											{maskSearchLoading()
												? layaT({
														fa: 'در حال جستجو...',
														en: 'Scanning...',
														ru: 'Поиск...',
														zh: '扫描中...',
													})
												: layaT({
														fa: 'جستجوی ماسک',
														en: 'Scan Mask',
														ru: 'Найти по маске',
														zh: '搜索掩码',
													})}
										</button>
									</div>

									<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-2" dir="ltr">
										<For
											each={[
												{ mask: '8888AAA', label: '4D Triple (8AAA)' },
												{ mask: '8880AAAAAAA', label: '7-Run (0AAAAAAA)' },
												{ mask: '8880AAAABBBB', label: 'Twin Block (AAAABBBB)' },
												{ mask: '8880ABABABAB', label: 'Alternating (ABAB)' },
												{ mask: '8880XXXX8888', label: 'Quad-8 Tail' },
											]}
										>
											{(preset) => (
												<button
													type="button"
													onClick={() => void handleRunCustomMaskSearch(preset.mask)}
													class="shrink-0 px-2.5 py-1 rounded-lg bg-black/40 hover:bg-amber-500/20 border border-white/10 hover:border-amber-400/40 text-[10px] font-mono text-white/75 hover:text-amber-200 transition-all"
												>
													{preset.label}: <strong class="text-amber-300">{preset.mask}</strong>
												</button>
											)}
										</For>
									</div>

									<Show when={customMaskResults() !== null}>
										<div class="mt-3 pt-3 border-t border-white/10 space-y-2">
											<div class="flex items-center justify-between text-[10px] text-white/60">
												<span>
													{layaT({
														fa: `نتایج زنده ماسک ${customMaskInput()} (${(customMaskResults() || []).length} مورد):`,
														en: `Live Nums888 Matches for ${customMaskInput()} (${(customMaskResults() || []).length}):`,
														ru: `Найдено в Nums888 по маске ${customMaskInput()} (${(customMaskResults() || []).length}):`,
														zh: `Nums888 掩码 ${customMaskInput()} 实时匹配 (${(customMaskResults() || []).length})：`,
													})}
												</span>
												<button
													type="button"
													onClick={() => setCustomMaskResults(null)}
													class="text-rose-400 hover:underline text-[10px]"
												>
													{layaT({
														fa: 'بستن نتایج ماسک',
														en: 'Clear',
														ru: 'Очистить',
														zh: '清除结果',
													})}
												</button>
											</div>
											<Show
												when={(customMaskResults() || []).length > 0}
												fallback={
													<div class="p-3 rounded-xl bg-black/40 text-center text-[11px] text-white/45">
														{layaT({
															fa: 'هیچ شماره ضرب‌شده‌ای با این ماسک در بلاک‌چین یافت نشد.',
															en: 'No minted numbers matched this custom mask.',
															ru: 'Сминченных номеров по этой маске не найдено.',
															zh: '未找到符合该自定义掩码的已铸造号码。',
														})}
													</div>
												}
											>
												<div class="space-y-1.5 max-h-64 overflow-y-auto pr-1">
													<For each={(customMaskResults() || []).slice(0, 8)}>
														{(mItem) => (
															<div class="p-2.5 rounded-xl bg-black/50 border border-white/10 flex items-center justify-between gap-2">
																<div class="flex items-center gap-2 min-w-0">
																	<span
																		class="w-2.5 h-6 rounded border border-white/30 shrink-0"
																		style={{ 'background-color': mItem.color_hex }}
																	/>
																	<div class="min-w-0">
																		<span
																			class="font-mono font-black text-xs text-white block"
																			dir="ltr"
																		>
																			{mItem.display_number}
																		</span>
																		<span class="text-[9px] text-white/40 font-mono" dir="ltr">
																			{mItem.last_sale_date}
																		</span>
																	</div>
																</div>
																<div class="flex items-center gap-2 shrink-0">
																	<span
																		class="font-mono font-black text-xs text-emerald-400"
																		dir="ltr"
																	>
																		{mItem.last_sale_ton > 0
																			? `${formatTon(mItem.last_sale_ton)} TON`
																			: 'Unlisted'}
																	</span>
																	<button
																		type="button"
																		onClick={() => {
																			setInputNumber(mItem.display_number);
																			setActiveTab('valuation');
																			void handleRunAnalysis(mItem.display_number);
																		}}
																		class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-[10px] font-black text-amber-300"
																	>
																		{layaT({
																			fa: 'کالبدشکافی',
																			en: 'Appraise',
																			ru: 'Оценить',
																			zh: '深度评估',
																		})}
																	</button>
																</div>
															</div>
														)}
													</For>
												</div>
											</Show>
										</div>
									</Show>
								</div>

								<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start">
									<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
										<div>
											<h3 class="text-xs font-black text-white flex items-center gap-2">
												<span class="material-symbols-outlined text-amber-400 text-base">
													hub
												</span>
												<span>
													{layaT({
														fa: 'شماره‌های هم‌الگو و هم‌خانواده در بلاک‌چین (Live Pattern Siblings)',
														en: 'Live Structural Pattern Siblings on TON',
														ru: 'Структурно похожие номера в блокчейне TON',
														zh: 'TON 链上同结构规律号码 (Pattern Siblings)',
													})}
												</span>
											</h3>
											<p class="text-[10px] text-white/50 mt-0.5">
												{layaT({
													fa: 'استخراج زنده از Nums888 بر اساس ماسک ساختاری مشابه؛ برای کالبدشکافی هر شماره روی آن کلیک کنید.',
													en: 'Scraped live from Nums888 pattern mask; click any sibling to appraise.',
													ru: 'Живые данные из Nums888 по структурной маске; нажмите для оценки.',
													zh: '基于相同结构掩码从 Nums888 实时提取；点击任意号码即可深度评估。',
												})}
											</p>
										</div>
										<span class="text-[9px] font-mono font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
											LIVE PEERS
										</span>
									</div>

									<Show
										when={(reportData()?.pattern_siblings || []).length > 0}
										fallback={
											<div class="p-6 text-center text-xs text-white/40 bg-black/40 rounded-2xl border border-white/5">
												{layaT({
													fa: 'در حال حاضر هم‌خانواده دیگری برای این ماسک یافت نشد.',
													en: 'No additional pattern siblings found.',
													ru: 'Других номеров с такой же структурной маской не найдено.',
													zh: '暂未找到更多相同结构掩码的同族号码。',
												})}
											</div>
										}
									>
										<div class="space-y-2.5">
											<For each={reportData()?.pattern_siblings || []}>
												{(sib) => (
													<div class="p-3 rounded-2xl bg-black/40 border border-white/10 hover:border-amber-400/40 transition-all flex items-center justify-between gap-2">
														<div class="flex items-center gap-2.5 min-w-0">
															<span
																class="w-3.5 h-8 rounded-lg border border-white/30 shrink-0"
																style={{ 'background-color': sib.color_hex }}
															/>
															<div class="min-w-0">
																<div class="flex items-center gap-1.5 flex-wrap">
																	<span
																		class="font-mono font-black text-xs text-white"
																		dir="ltr"
																	>
																		{sib.display_number}
																	</span>
																	<Show when={sib.is_restricted}>
																		<span class="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
																			RESTRICTED
																		</span>
																	</Show>
																</div>
																<div class="text-[10px] text-white/50 truncate">
																	{isRtl()
																		? sib.similarity_reason_fa
																		: sib.similarity_reason_en}{' '}
																	• {sib.owners_count}{' '}
																	{layaT({
																		fa: 'مالک',
																		en: 'Owners',
																		ru: 'Владельцев',
																		zh: '位持有者',
																	})}
																</div>
															</div>
														</div>

														<div class="flex items-center gap-2 shrink-0">
															<div class="text-end" dir="ltr">
																<div class="font-mono font-black text-xs text-amber-300">
																	{sib.last_sale_ton > 0
																		? `${formatTon(sib.last_sale_ton)} TON`
																		: 'Vaulted'}
																</div>
																<div class="text-[9px] font-mono text-white/40">
																	{sib.last_sale_date}
																</div>
															</div>

															<button
																type="button"
																onClick={() => {
																	setInputNumber(sib.display_number);
																	setActiveTab('valuation');
																	void handleRunAnalysis(sib.display_number);
																}}
																class="px-2.5 py-1.5 rounded-xl bg-[#0098EA]/20 hover:bg-[#0098EA]/35 border border-[#0098EA]/40 text-[10px] font-black text-cyan-300 transition-all active:scale-95"
															>
																{layaT({
																	fa: 'کالبدشکافی',
																	en: 'Appraise',
																	ru: 'Оценить',
																	zh: '深度评估',
																})}
															</button>
														</div>
													</div>
												)}
											</For>
										</div>
									</Show>
								</div>

								{/* 📜 DIGITAL VALUATION CERTIFICATE (HMAC-SHA256) */}
								<NumberDigitalCertificateCard
									certificateId={reportData()?.certificate_id}
									number={reportData()?.number || inputNumber()}
									expectedTon={
										reportData()?.expected_ton ? Number(reportData()!.expected_ton) : 0
									}
									confidence={reportData()?.confidence_score}
								/>
							</div>
						</Show>

						{/* ⚡ BOTTOM QUICK ACTION HUB (MONITOR, FRAGMENT, WATCHLIST) */}
						<div class="grid grid-cols-3 gap-2 pt-1">
							<button
								type="button"
								onClick={() => void handleToggleWatchlist()}
								class={`py-3 px-2 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
									isMonitored()
										? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
										: 'bg-[#12141C]/80 border-white/10 text-white/70 hover:bg-white/5'
								}`}
							>
								<span class="material-symbols-outlined text-lg">
									{isMonitored() ? 'notifications_active' : 'notifications'}
								</span>
								<span class="text-[10px] font-black tracking-tight">
									{isMonitored() ? t('numbers.monitorActive') : t('numbers.monitorToggle')}
								</span>
							</button>

							<a
								href={
									reportData()?.market_provenance?.fragment_url ||
									reportData()?.fragment_direct_url ||
									`https://fragment.com/number/${(reportData()?.number || inputNumber() || '').replace(/^\+/, '').replace(/\s+/g, '')}`
								}
								target="_blank"
								rel="noopener noreferrer"
								class="py-3 px-2 rounded-2xl bg-gradient-to-r from-[#0098EA] via-[#00c6ff] to-[#0098EA] text-white border border-[#0098EA]/30 flex flex-col items-center justify-center gap-1 shadow-md shadow-[#0098EA]/20 active:scale-95 transition-all hover:brightness-110"
							>
								<span class="material-symbols-outlined text-lg">open_in_new</span>
								<span class="text-[10px] font-black tracking-tight">
									{t('numbers.viewOnFragment')}
								</span>
							</a>

							<button
								type="button"
								onClick={() => void handleToggleWatchlist()}
								disabled={watchLoading()}
								class={`py-3 px-2 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
									isWatching()
										? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
										: 'bg-[#12141C]/80 border-white/10 text-white/70 hover:bg-white/5'
								}`}
							>
								<span class="material-symbols-outlined text-lg">
									{isWatching() ? 'bookmark_added' : 'bookmark_add'}
								</span>
								<span class="text-[10px] font-black tracking-tight">
									{isWatching() ? t('numbers.watching') : t('numbers.watchNumber')}
								</span>
							</button>
						</div>
					</div>
				</Show>
			</div>

			{/* Credit Store Sheet */}
			<CreditStoreSheet open={storeOpen()} onClose={() => setStoreOpen(false)} vertical="number" />
		</div>
	);
};
