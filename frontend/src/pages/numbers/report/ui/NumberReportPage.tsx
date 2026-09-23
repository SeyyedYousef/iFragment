import { useNavigate, useSearchParams } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, onMount, Show } from 'solid-js';
import {
	type CuriosityGateData,
	type NumberValuationResult,
	numbersApi,
} from '@/entities/numbers/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { copyToClipboard } from '@/shared/lib/telegram-native.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { CreditStoreSheet, UnifiedPaywallGate, useWallet } from '@/widgets/paywall/index.js';
import { NumberSingleCulturalRadarCard } from './components/NumberSingleCulturalRadarCard.js';
import { NumberFinancialEngineeringCard } from './components/NumberFinancialEngineeringCard.js';
import { NumberDigitalCertificateCard } from './components/NumberDigitalCertificateCard.js';

interface NumberValidation {
	isValid: boolean;
	error: string | null;
	formatted: string;
	cleanDigits: string;
	suffix: string;
	tier: 'GRAIL' | 'APEX' | 'GRAND' | 'STANDARD';
	patternLabel: string;
}

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
				suffix.length > 4 ? `+888 ${suffix.slice(0, 4)} ${suffix.slice(4)}` : `+888 ${suffix}`,
			cleanDigits: clean,
			suffix,
			tier: 'STANDARD',
			patternLabel: '',
		};
	}

	if (suffix.length === 4) {
		const val = parseInt(suffix, 10);
		if (isNaN(val) || val < 8000 || val > 8999) {
			return {
				isValid: false,
				error:
					t('numbers.errorGenesisRange') ||
					'4-digit genesis numbers must be between +888 8000 and +888 8999',
				formatted: `+888 ${suffix}`,
				cleanDigits: clean,
				suffix,
				tier: 'STANDARD',
				patternLabel: '',
			};
		}
	}

	let formatted = '';
	if (suffix.length <= 4) {
		formatted = `+888 ${suffix}`;
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
			suffix.length === 4 ? 'GRAIL TIER (4-Digit Genesis)' : 'GRAIL TIER (Quad Repeat / Genesis)';
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

	// Search & Input state
	const [inputNumber, setInputNumber] = createSignal(searchParams.n || '+888 8888 8888');
	const [isAnalyzing, setIsAnalyzing] = createSignal(false);
	const [analysisStep, setAnalysisStep] = createSignal(0);
	const [copiedHeroNumber, setCopiedHeroNumber] = createSignal(false);

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

	// Reactive validation
	const validation = createMemo(() => validateAndFormatAnonymousNumber(inputNumber()));

	// 3D Holographic Gyro Tilt State (GPU compositor & rAF throttled)
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
		t('numbers.stepConnectingContracts') || 'Verifying on-chain provenance',
		t('numbers.stepQueryingMatrix') || 'Loading 90-day comps window',
		t('numbers.stepExtractingFeatures') || 'Computing rarity delta vs Genesis club',
		t('numbers.stepRunningHedonic') || 'Calibrating with MAD sigma bounds',
	];

	onMount(() => {
		if (searchParams.n) {
			handleRunAnalysis(searchParams.n);
		} else {
			handleRunAnalysis(inputNumber());
		}
	});

	const handleRunAnalysis = async (num: string) => {
		const val = validateAndFormatAnonymousNumber(num);
		if (!val.isValid) {
			setError(val.error || t('numbers.errorTooShort'));
			return;
		}

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

			// Check if report was already unlocked by user (24h cache)
			try {
				const unlocked = await numbersApi.getValuation(val.cleanDigits);
				if (
					unlocked &&
					(Number(unlocked.expected_ton) > 0 ||
						Number(unlocked.base_price_ton) > 0 ||
						(unlocked as any).estimated_value_ton > 0 ||
						unlocked.run_id > 0)
				) {
					setReportData(unlocked);
					setIsUnlocked(true);
				}
			} catch {
				// Expected 403 when report has not been unlocked yet
			}
		} catch (err: any) {
			setError(err?.message || 'Failed to connect to Telegram Telemint registry');
		} finally {
			setTimeout(() => {
				setIsAnalyzing(false);
			}, 300);
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
			haptic.notify('success');
		} catch {
			haptic.notify('error');
		} finally {
			setWatchLoading(false);
		}
	};

	const handleToggleMonitoring = () => {
		haptic.selection();
		setIsMonitored(!isMonitored());
		haptic.notify('success');
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
		if (!val) return '0';
		const num = typeof val === 'string' ? parseFloat(val) : val;
		return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const formatUsd = (val?: number) => {
		if (!val) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	// Dynamic Rarity Tier Theme for Numbers
	const getNumberTheme = () => {
		const num = (
			reportData()?.display_number ||
			gateData()?.display_number ||
			validation().formatted ||
			inputNumber()
		).replace(/\s+/g, '');

		if (
			num.includes('88888888') ||
			num.includes('77777777') ||
			num.includes('00000000') ||
			num.includes('8888') ||
			num === '+8888888'
		) {
			return {
				name: 'GRAIL',
				wrapper:
					'from-[#ffaa00] via-[#ff7700] to-[#e65100] shadow-[0_20px_50px_rgba(255,119,0,0.4),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#ffaa00]/15 border-[#ffaa00]/40 text-[#ffaa00] shadow-[0_0_15px_rgba(255,170,0,0.3)]',
				glow: 'rgba(255,119,0,0.35)',
			};
		}
		if (num.includes('1234') || num.includes('8989') || num.includes('0101')) {
			return {
				name: 'APEX',
				wrapper:
					'from-[#0098EA] via-[#0070BA] to-[#004B87] shadow-[0_20px_50px_rgba(0,152,234,0.4),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#0098EA]/15 border-[#0098EA]/40 text-[#0098EA] shadow-[0_0_15px_rgba(0,152,234,0.3)]',
				glow: 'rgba(0,152,234,0.35)',
			};
		}
		if (num.endsWith('888') || num.endsWith('777') || num.endsWith('000')) {
			return {
				name: 'GRAND',
				wrapper:
					'from-[#10b981] via-[#059669] to-[#047857] shadow-[0_20px_50px_rgba(16,185,129,0.4),inset_0_2px_10px_rgba(255,255,255,0.3)]',
				badge:
					'bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.3)]',
				glow: 'rgba(16,185,129,0.35)',
			};
		}
		return {
			name: 'STANDARD',
			wrapper:
				'from-[#64748b] via-[#475569] to-[#334155] shadow-[0_20px_50px_rgba(100,116,139,0.25),inset_0_2px_10px_rgba(255,255,255,0.15)]',
			badge: 'bg-[#64748b]/15 border-[#64748b]/40 text-[#cbd5e1]',
			glow: 'rgba(255,255,255,0.12)',
		};
	};

	const getNumberFontSize = (numStr: string) => {
		const len = (numStr || '').replace(/\s+/g, '').length;
		if (len <= 7) return '34px';
		if (len <= 10) return '28px';
		if (len <= 12) return '24px';
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

	return (
		<div
			class="pb-36 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Dynamic Background Glows */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/20 via-[#AF52DE]/10 to-transparent blur-[90px] pointer-events-none z-0" />
			<div class="fixed bottom-20 right-0 w-80 h-80 bg-emerald-500/10 blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				{/* ═══════ 1. CLEAN HEADER ═══════ */}
				<div class="flex items-center justify-between mb-4">
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
							<span>{t('numbers.paywallHeaderTitle') || 'Telegram Anonymous Number'}</span>
							<span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
								+888
							</span>
						</h1>
						<p class="text-[11px] font-medium text-white/50">
							{t('numbers.intelSubtitle') || 'AI Valuation & Provenance'}
						</p>
					</div>

					<div class="w-10 h-10" />
				</div>

				{/* 🔍 TOP INTERACTIVE NUMBER SEARCH BAR */}
				<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 mb-4 flex items-center gap-2 shadow-lg">
					<span class="material-symbols-outlined text-[#0098EA] ml-2 text-xl">dialpad</span>
					<input
						type="text"
						value={inputNumber()}
						onInput={(e) => setInputNumber(e.currentTarget.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								handleRunAnalysis(inputNumber());
							}
						}}
						placeholder="+888 8888 8888"
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
						onClick={() => handleRunAnalysis(inputNumber())}
						disabled={isAnalyzing()}
						class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#0098EA] to-[#007ebb] text-white font-black text-xs hover:brightness-110 active:scale-95 transition-all shadow-md shadow-[#0098EA]/20 flex items-center gap-1"
					>
						<span>{t('common.search') || 'Appraise'}</span>
						<span class="material-symbols-outlined text-xs">arrow_forward</span>
					</button>
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
					<div class="mb-6 w-full max-w-[440px] mx-auto space-y-4">
						{/* Pre-Unlock Curiosity Teaser Card */}
						<div class="bg-gradient-to-br from-[#12141C] via-[#0E1017] to-[#0A0C10] border border-cyan-500/30 rounded-[28px] p-5 shadow-2xl relative overflow-hidden text-start">
							<div class="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

							<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
								<div class="flex items-center gap-2">
									<div class="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
										<span class="material-symbols-outlined text-lg">fact_check</span>
									</div>
									<div>
										<h4 class="text-xs font-black text-white">
											{isRtl()
												? 'تحلیل هوشمند پیش‌ارزیابی آماده است'
												: 'Pre-Appraisal Intelligence Ready'}
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

							{/* 3 Metric Pills */}
							<div class="grid grid-cols-3 gap-2 text-center mb-3.5">
								<div class="p-2 rounded-xl bg-black/40 border border-white/5">
									<span class="text-[9px] text-white/40 block mb-0.5">
										{isRtl() ? 'سیگنال‌ها' : 'Signals'}
									</span>
									<span class="text-xs font-black text-cyan-300 font-mono">
										{gateData()?.signals_analyzed || 27} {isRtl() ? 'مورد' : 'Pts'}
									</span>
								</div>
								<div class="p-2 rounded-xl bg-black/40 border border-white/5">
									<span class="text-[9px] text-white/40 block mb-0.5">
										{isRtl() ? 'ریسک آنچین' : 'On-Chain Risk'}
									</span>
									<span class="text-xs font-black text-emerald-400 font-mono">
										{gateData()?.risks_identified === 0
											? isRtl()
												? 'صفر (پاک)'
												: '0 (Clean)'
											: `${gateData()?.risks_identified} Warning`}
									</span>
								</div>
								<div class="p-2 rounded-xl bg-black/40 border border-white/5">
									<span class="text-[9px] text-white/40 block mb-0.5">
										{isRtl() ? 'منابع تطبیق' : 'Sources'}
									</span>
									<span class="text-xs font-black text-amber-300 font-mono">
										{gateData()?.data_sources_count || 4} {isRtl() ? 'مرجع' : 'APIs'}
									</span>
								</div>
							</div>

							{/* Blurred Preview Teaser */}
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
										<span class="text-white/60">Selling Probability (30d)</span>
										<span class="font-mono text-emerald-400">██% Likelihood</span>
									</div>
								</div>
								<div class="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
									<span class="text-[10px] font-black text-white/90 bg-white/10 px-3 py-1 rounded-full border border-white/20 flex items-center gap-1">
										<span class="material-symbols-outlined text-xs text-amber-400">lock</span>
										<span>
											{isRtl() ? 'بازگشایی با ۱ کریدیت iFragment' : 'Unlock with 1 Credit'}
										</span>
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

				{/* ═══════ 4. STATE 3: UNLOCKED 10-MODULE LUXURY APPRAISAL REPORT ═══════ */}
				<Show when={isUnlocked() && reportData()}>
					<div class="space-y-4">
						{/* 💎 1:1 PERFECT SQUARE 3D HOLOGRAPHIC HERO CARD (PROFILE-READY & SHOWCASE-GRADE) */}
						<div
							class={`w-full aspect-square p-[3px] bg-gradient-to-br ${
								getNumberTheme().wrapper
							} rounded-[48px] my-2 relative z-20 transition-all duration-300 shadow-2xl`}
						>
							<div
								ref={cardRef}
								onPointerMove={handlePointerMove}
								onPointerLeave={handlePointerLeave}
								onClick={handleCopyHeroNumber}
								class="w-full h-full bg-[#08090D] rounded-[45px] p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between shadow-inner select-none cursor-pointer touch-pan-y will-change-transform group"
								style={{
									transform: `perspective(1200px) rotateX(${tilt().x}deg) rotateY(${tilt().y}deg)`,
									'background-image':
										'radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px)',
									'background-size': '24px 24px',
									transition: 'transform 0.1s ease-out',
								}}
							>
								{/* Gloss Reflex Overlay */}
								<div
									class="absolute inset-0 pointer-events-none z-20 mix-blend-overlay transition-opacity duration-300 opacity-80"
									style={{
										background: `radial-gradient(circle at ${tilt().glossX}% ${
											tilt().glossY
										}%, rgba(255,255,255,0.35) 0%, transparent 60%)`,
									}}
								/>
								<div class="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

								{/* Top Header Stamp */}
								<div class="flex justify-between items-center z-10 w-full" dir="ltr">
									<div class="flex items-center gap-1.5 max-w-[65%]">
										<span
											class={`px-3 py-1 border rounded-xl text-[10px] font-black tracking-wider uppercase shadow-sm truncate ${
												getNumberTheme().badge
											}`}
										>
											{reportData()?.pattern_anatomy?.club_name_en ||
												reportData()?.category_club ||
												`${getNumberTheme().name} TIER`}
										</span>
										<Show
											when={
												validation().suffix.length === 4 ||
												(reportData()?.number &&
													reportData()!.number.replace(/\D/g, '').length === 7)
											}
										>
											<span class="px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-extrabold uppercase tracking-wider shrink-0">
												GENESIS ⛧ 1 of 1000
											</span>
										</Show>
									</div>

									<span
										class="text-[11px] font-mono font-black text-white/50 tracking-wider uppercase bg-white/5 border border-white/10 px-3 py-1 rounded-xl shadow-inner flex items-center gap-1.5 flex-shrink-0"
										dir="ltr"
									>
										<span>👑</span>
										<span>#{reportData()?.global_rank || 1}</span>
										<span class="text-white/30">/</span>
										<span class="text-white/40">136.5K</span>
									</span>
								</div>

								{/* Center Hero: Monospace Phone Number & Ambient Glow */}
								<div class="flex flex-col justify-center items-center z-10 text-center flex-grow relative py-2 w-full">
									{/* Ambient Tier Aura */}
									<div
										class="absolute w-full h-[140px] opacity-70 -z-10 pointer-events-none mix-blend-screen"
										style={{
											background: `radial-gradient(ellipse 65% 65% at 50% 50%, ${
												getNumberTheme().glow
											}, transparent 70%)`,
										}}
									/>
									<div class="flex items-center justify-center gap-2 w-full">
										<span class="text-white/20 font-black text-xl sm:text-2xl select-none drop-shadow-md">
											✦
										</span>
										<span
											class="inline-block font-black font-mono tracking-tight text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] truncate max-w-[85%] pb-1 group-hover:scale-105 transition-transform"
											style={{
												'font-size': getNumberFontSize(
													reportData()?.display_number || inputNumber(),
												),
											}}
											dir="ltr"
										>
											{reportData()?.display_number || inputNumber()}
										</span>
										<span class="text-white/20 font-black text-xl sm:text-2xl select-none drop-shadow-md">
											✦
										</span>
									</div>

									<div class="mt-2 flex items-center gap-2">
										<span class="text-[11px] font-mono font-bold text-white/50 tracking-wider">
											✦{' '}
											{isRtl()
												? reportData()?.pattern_anatomy?.pattern_type_fa ||
													reportData()?.category_club_fa ||
													'شماره کلکسیونی تلگرام'
												: reportData()?.pattern_anatomy?.pattern_type_en ||
													reportData()?.category_club ||
													'Telegram Anonymous Number'}{' '}
											✦
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
											{t('numbers.fairValue') || 'ESTIMATED VALUE'}
										</span>
										<div class="flex items-center gap-1.5 flex-wrap" dir="ltr">
											<svg
												class="w-6 h-6 flex-shrink-0 filter drop-shadow-[0_0_12px_rgba(0,152,234,0.6)]"
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
											<span
												class={`font-black text-white leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] tracking-tight font-mono truncate ${getTonPriceFontSize(reportData()?.expected_ton)}`}
											>
												{formatTon(reportData()?.expected_ton)}
											</span>
											<span class="text-xs font-black text-[#0098EA] leading-none mb-0.5 flex-shrink-0">
												{t('common.ton')}
											</span>
										</div>
									</div>

									<div class="flex flex-col items-end gap-1 flex-shrink-0">
										<Show
											when={reportData()?.telemint_provenance?.collection_verified && reportData()?.telemint_provenance?.data_status === 'live'}
											fallback={
												<div class="flex items-center gap-1.5 bg-amber-500/15 px-2.5 py-1 rounded-[8px] border border-amber-500/40 text-amber-400 font-bold uppercase tracking-wider text-[9px]">
													<div class="w-1.5 h-1.5 bg-amber-400 rounded-full" />
													<span>{isRtl() ? 'تأیید نشده' : 'UNVERIFIED'}</span>
												</div>
											}
										>
											<div class="flex items-center gap-1.5 bg-[#10b981]/15 px-2.5 py-1 rounded-[8px] border border-[#10b981]/40 text-[#10b981] font-black uppercase tracking-wider text-[9px] shadow-[0_0_15px_rgba(16,185,129,0.2)]">
												<div class="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse" />{' '}
												<span>{t('valuation.verified') || 'VERIFIED'}</span>
											</div>
										</Show>
										<span class="text-xs text-white/60 font-black leading-none font-mono" dir="ltr">
											≈ {formatUsd(reportData()?.expected_usd)}
										</span>
									</div>
								</div>
							</div>
						</div>

						{/* ⚡ MODULE 2: ACTION HUB (MONITOR, FRAGMENT, WATCHLIST) */}
						<div class="grid grid-cols-3 gap-2">
							<button
								type="button"
								onClick={handleToggleMonitoring}
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
									reportData()?.fragment_direct_url ||
									`https://fragment.com/number/${(reportData()?.number || '').replace('+888', '')}`
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
								onClick={handleToggleWatchlist}
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

						{/* 📊 MODULE 3: 4 VALUATION FIGURES GRID & PRICE SPECTRUM */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start">
							<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
								<h3 class="text-xs font-black text-white flex items-center gap-2">
									<span class="material-symbols-outlined text-[#0098EA] text-base">monitoring</span>
									<span>
										{isRtl() ? 'ماتریس ۴ رقمی ارزش‌گذاری هوشمند' : '4-Figure Valuation Matrix'}
									</span>
								</h3>
								<span
									class="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20"
									dir="ltr"
								>
									{reportData()?.confidence_score}% Confidence
								</span>
							</div>

							{/* 4 Figures Grid */}
							<div class="grid grid-cols-2 gap-2.5 my-3">
								{/* 1. Fair Value */}
								<div class="p-3.5 rounded-2xl bg-gradient-to-br from-[#0098EA]/15 via-black/40 to-black/60 border border-[#0098EA]/40 shadow-lg shadow-[#0098EA]/10 flex flex-col justify-between">
									<div class="flex items-center justify-between mb-1">
										<span class="text-[9px] uppercase font-black text-[#0098EA]">
											{isRtl() ? 'ارزش منصفانه (Fair Value)' : 'Fair Value'}
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

								{/* 2. Suggested Asking Price */}
								<div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
									<div class="flex items-center justify-between mb-1">
										<span class="text-[9px] uppercase font-black text-amber-300">
											{isRtl() ? 'قیمت پیشنهادی فروش' : 'Suggested Ask (+15%)'}
										</span>
										<span class="material-symbols-outlined text-xs text-amber-400">sell</span>
									</div>
									<div class="font-mono font-black text-white text-base sm:text-lg" dir="ltr">
										<Show
											when={reportData()?.suggested_ask_ton}
											fallback={<span class="text-white/40 text-sm">—</span>}
										>
											{formatTon(reportData()?.suggested_ask_ton)}{' '}
											<span class="text-xs text-amber-400">TON</span>
										</Show>
									</div>
									<span class="text-[10px] text-white/50 font-mono mt-0.5" dir="ltr">
										{reportData()?.suggested_ask_usd ? `≈ ${formatUsd(reportData()?.suggested_ask_usd)}` : '—'}
									</span>
								</div>

								{/* 3. Liquidation Value */}
								<div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
									<div class="flex items-center justify-between mb-1">
										<span class="text-[9px] uppercase font-black text-rose-400">
											{isRtl() ? 'ارزش نقدشوندگی فوری' : 'Liquidation (-25%)'}
										</span>
										<span class="material-symbols-outlined text-xs text-rose-400">flash_on</span>
									</div>
									<div class="font-mono font-black text-white text-base sm:text-lg" dir="ltr">
										<Show
											when={reportData()?.liquidation_ton}
											fallback={<span class="text-white/40 text-sm">—</span>}
										>
											{formatTon(reportData()?.liquidation_ton)}{' '}
											<span class="text-xs text-rose-400">TON</span>
										</Show>
									</div>
									<span class="text-[10px] text-white/50 font-mono mt-0.5" dir="ltr">
										{reportData()?.liquidation_usd ? `≈ ${formatUsd(reportData()?.liquidation_usd)}` : '—'}
									</span>
								</div>

								{/* 4. Uncertainty Band / Range */}
								<div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
									<div class="flex items-center justify-between mb-1">
										<span class="text-[9px] uppercase font-black text-emerald-400">
											{isRtl() ? 'بازه مجاز نوسان' : 'Uncertainty Band'}
										</span>
										<span class="material-symbols-outlined text-xs text-emerald-400">sync_alt</span>
									</div>
									<div
										class="font-mono font-black text-white text-xs sm:text-sm truncate"
										dir="ltr"
									>
										{formatTon(reportData()?.low_ton)} - {formatTon(reportData()?.high_ton)}{' '}
										<span class="text-[10px] text-emerald-400">TON</span>
									</div>
									<span class="text-[9px] text-white/40 mt-0.5">
										{isRtl() ? 'دامنه انحراف معیار MAD' : 'MAD Sigma Bounds'}
									</span>
								</div>
							</div>

							<p class="text-[10px] text-white/40 leading-relaxed text-start">
								{reportData()?.price_basis === 'pattern_comps_shrunk_to_class'
									? t('numbers.basisComps')
									: t('numbers.basisRegression')}
							</p>
						</div>

						{/* 🌍 LAYA 4-REGION CULTURAL RADAR */}
						<NumberSingleCulturalRadarCard
							radar={reportData()?.cultural_radar}
							number={reportData()?.number || inputNumber()}
							layaReasoning={reportData()?.reasoning_log?.laya_system_one}
						/>

						{/* 💸 TRANSACTION FINANCIAL ENGINEERING & 5% PROTOCOL FEE */}
						<NumberFinancialEngineeringCard
							expectedTon={reportData()?.expected_ton ? Number(reportData()!.expected_ton) : 0}
							expectedUsd={reportData()?.expected_usd}
							tonUsdRate={reportData()?.ton_usd_rate}
						/>

						{/* 🧬 MODULE 5: STRUCTURAL GENETICS & SCARCITY MATRIX */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
								<h3 class="text-xs font-black text-white flex items-center gap-2">
									<span class="material-symbols-outlined text-amber-400 text-base">dna</span>
									<span>{t('numbers.patternAnatomyTitle')}</span>
								</h3>
								<span
									class="text-[9px] uppercase font-mono font-black text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-md"
									dir="ltr"
								>
									{reportData()?.pattern_anatomy?.exact_supply_count ?? '—'} IN EXISTENCE
								</span>
							</div>

							<div class="space-y-2.5 text-xs text-start">
								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-2">
									<span class="text-white/60 truncate">{t('numbers.exactSupplyLabel')}:</span>
									<span class="font-mono font-black text-amber-300 flex-shrink-0" dir="ltr">
										<Show
											when={reportData()?.pattern_anatomy?.exact_supply_count != null}
											fallback={<span>—</span>}
										>
											{reportData()?.pattern_anatomy?.exact_supply_count} / 136,566 (
											{reportData()?.pattern_anatomy?.supply_percentage || 0}%)
										</Show>
									</span>
								</div>

								<div class="grid grid-cols-3 gap-2 text-center">
									<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 min-w-0">
										<span class="text-[9px] text-white/40 block mb-0.5 truncate">
											{t('numbers.uniqueDigitsLabel')}
										</span>
										<span class="font-mono font-black text-white text-xs block truncate" dir="ltr">
											{reportData()?.pattern_anatomy?.distinct_digits ?? '—'} {t('numbers.digitUnit')}
										</span>
									</div>

									<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 min-w-0">
										<span class="text-[9px] text-white/40 block mb-0.5 truncate">
											{t('numbers.symmetryLabel')}
										</span>
										<span
											class="font-mono font-black text-emerald-400 text-xs block truncate"
											dir="ltr"
										>
											{reportData()?.pattern_anatomy?.symmetry_score != null ? `${reportData()?.pattern_anatomy?.symmetry_score}%` : '—'}
										</span>
									</div>

									<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 min-w-0">
										<span class="text-[9px] text-white/40 block mb-0.5 truncate">
											{t('numbers.memorabilityLabel')}
										</span>
										<span
											class="font-mono font-black text-[#0098EA] text-xs block truncate"
											dir="ltr"
										>
											{reportData()?.pattern_anatomy?.memorability_score != null ? `${reportData()?.pattern_anatomy?.memorability_score} / 100` : '—'}
										</span>
									</div>
								</div>

								<div class="p-3 rounded-2xl bg-[#08090D] border border-white/5 text-[11px] text-white/70 leading-relaxed">
									{isRtl()
										? reportData()?.pattern_anatomy?.numerology_report_fa ||
											'تکرار یکنواخت و نایاب ارقام؛ این ساختار بالاترین سطح روانی و پرستیژ را در مسنجر تلگرام ارائه می‌دهد.'
										: reportData()?.pattern_anatomy?.numerology_report_en ||
											'Monolithic repetition structure delivering peak vanity and visual impact.'}
								</div>
							</div>
						</div>

						{/* 🏢 MODULE 6: ESTIMATED RENTAL YIELD */}
						<div class="bg-gradient-to-br from-[#0098EA]/15 via-[#12141C]/90 to-[#08090D] border border-[#0098EA]/30 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
								<h3 class="text-xs font-black text-white flex items-center gap-2">
									<span class="material-symbols-outlined text-[#0098EA] text-base">
										real_estate_agent
									</span>
									<span>{t('numbers.rentalYieldTitle')}</span>
								</h3>
								<span class="text-[9px] uppercase font-mono font-black text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2 py-0.5 rounded-md">
									{reportData()?.rental_yield?.est_apy != null ? `~${reportData()?.rental_yield?.est_apy}% APY` : (isRtl() ? 'شبیه‌سازی تحلیلی' : 'Simulation')}
								</span>
							</div>

							<div class="flex items-center justify-between bg-black/40 rounded-2xl p-4 border border-white/5 mb-2.5">
								<div class="text-start">
									<span class="text-[9px] font-bold text-white/50 block mb-0.5">
										{t('numbers.monthlyRentalEst')}
									</span>
									<span class="text-lg font-mono font-black text-emerald-400 block" dir="ltr">
										<Show
											when={reportData()?.rental_yield?.monthly_yield_ton}
											fallback={<span class="text-white/40 text-sm">—</span>}
										>
											~{formatTon(reportData()?.rental_yield?.monthly_yield_ton)} TON
										</Show>
									</span>
								</div>
								<div class="text-end">
									<span class="text-[9px] font-bold text-white/50 block mb-0.5">
										{t('numbers.estApyLabel')}
									</span>
									<span class="text-base font-mono font-black text-[#0098EA] block">
										{reportData()?.rental_yield?.est_apy != null ? `~${reportData()?.rental_yield?.est_apy}%` : '—'}
									</span>
								</div>
							</div>

							<p class="text-[10px] text-white/50 leading-relaxed text-start">
								{isRtl()
									? reportData()?.rental_yield?.target_audience_fa ||
										'مناسب برای اکانت پشتیبانی صرافی‌های کریپتو، کانال‌های VIP، و برندهای تجاری تلگرام.'
									: reportData()?.rental_yield?.target_audience_en ||
										'Ideal for Crypto Exchange Support, VIP Telegram Desks, and Elite Brands.'}
							</p>
						</div>

						{/* 📈 MODULE 7: MARKET DEPTH & CATEGORY FLOOR */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
								<h3 class="text-xs font-black text-white flex items-center gap-2">
									<span class="material-symbols-outlined text-[#0098EA] text-base">
										waterfall_chart
									</span>
									<span>{t('numbers.marketDepthTitle')}</span>
								</h3>
								<span class="text-[9px] uppercase font-mono font-black text-white/60 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
									DEPTH ANALYTICS
								</span>
							</div>

							<div class="grid grid-cols-2 gap-2.5 mb-2.5 text-start">
								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
									<span class="text-[9px] font-bold text-white/50 block mb-0.5">
										{t('numbers.clubFloorLabel')}
									</span>
									<span class="text-sm font-mono font-black text-white block" dir="ltr">
										<Show
											when={reportData()?.market_depth?.club_floor_ton}
											fallback={<span class="text-white/40 text-sm">—</span>}
										>
											{formatTon(reportData()?.market_depth?.club_floor_ton)} TON
										</Show>
									</span>
								</div>

								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
									<span class="text-[9px] font-bold text-white/50 block mb-0.5">
										{t('numbers.estimatedSellTime')}
									</span>
									<span class="text-sm font-mono font-black text-emerald-400 block">
										{isRtl()
											? reportData()?.market_depth?.liquidity_speed_fa || '—'
											: reportData()?.market_depth?.liquidity_speed_en || '—'}
									</span>
								</div>
							</div>

							<div class="p-3 rounded-2xl bg-[#08090D] border border-white/5 text-start text-[10px] text-white/60 leading-relaxed mb-2.5">
								<span class="font-bold text-white/80">{t('numbers.hodlStrengthLabel')}: </span>
								<span>
									{isRtl()
										? reportData()?.market_depth?.hodl_strength_fa ||
											'کالکشن بسته با سقف قطعی 136,566 شماره در تلگرام'
										: reportData()?.market_depth?.hodl_strength_en ||
											'Closed collection strictly capped at 136,566 numbers'}
								</span>
							</div>

							{/* Selling Probability Timeline */}
							<div class="pt-3 border-t border-white/5 text-start">
								<div class="flex items-center justify-between mb-2">
									<span class="text-[10px] font-bold text-white/70">
										{isRtl()
											? 'احتمال فروش در بازار (Selling Probabilities - شبیه‌سازی)'
											: 'Selling Probabilities (Simulation)'}
									</span>
									<span class="text-[9px] font-mono text-cyan-400 font-bold" dir="ltr">
										<Show
											when={reportData()?.selling_probabilities?.estimated_days_to_sell}
											fallback={<span>—</span>}
										>
											{isRtl()
												? `تخمین فروش: ${reportData()?.selling_probabilities?.estimated_days_to_sell} روز`
												: `Est: ${reportData()?.selling_probabilities?.estimated_days_to_sell} Days`}
										</Show>
									</span>
								</div>

								<div class="grid grid-cols-3 gap-2 text-center">
									<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
										<span class="text-[9px] text-white/40 block mb-0.5">7 Days</span>
										<span class="text-xs font-black font-mono text-amber-400">
											{reportData()?.selling_probabilities?.p_7d != null ? `${reportData()?.selling_probabilities?.p_7d}%` : '—'}
										</span>
									</div>
									<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
										<span class="text-[9px] text-white/40 block mb-0.5">30 Days</span>
										<span class="text-xs font-black font-mono text-cyan-400">
											{reportData()?.selling_probabilities?.p_30d != null ? `${reportData()?.selling_probabilities?.p_30d}%` : '—'}
										</span>
									</div>
									<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
										<span class="text-[9px] text-white/40 block mb-0.5">90 Days</span>
										<span class="text-xs font-black font-mono text-emerald-400">
											{reportData()?.selling_probabilities?.p_90d != null ? `${reportData()?.selling_probabilities?.p_90d}%` : '—'}
										</span>
									</div>
								</div>
							</div>
						</div>

						{/* 📊 MODULE 8: REAL ON-CHAIN COMPS */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
								<h3 class="text-xs font-black text-white flex items-center gap-2">
									<span class="material-symbols-outlined text-emerald-400 text-base">
										receipt_long
									</span>
									<span>{t('numbers.comparableSales')}</span>
								</h3>
								<span class="text-[9px] uppercase font-mono font-bold text-white/40">
									ON-CHAIN PROOF
								</span>
							</div>

							<div class="space-y-2">
								<Show
									when={(reportData()?.comps || []).length > 0}
									fallback={
										<div class="p-6 text-center text-white/40 text-xs bg-white/[0.02] border border-white/5 rounded-2xl">
											<span class="material-symbols-outlined text-2xl text-white/20 mb-1 block">
												receipt_long
											</span>
											<span>
												{t('numbers.noCompsFound') ||
													'No comparable sales in the past 90 days for this tier'}
											</span>
										</div>
									}
								>
									<For each={reportData()?.comps || []}>
										{(comp) => (
											<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
												<div class="text-start">
													<span class="font-mono font-black text-white block" dir="ltr">
														{comp.number}
													</span>
													<span class="text-[10px] text-white/40">
														{comp.sale_date} · {comp.tail_class}
													</span>
												</div>
												<div class="text-end">
													<span class="font-mono font-black text-white block" dir="ltr">
														{formatTon(comp.price_ton)} TON
													</span>
													<Show when={comp.tonviewer_url}>
														<a
															href={comp.tonviewer_url}
															target="_blank"
															rel="noopener noreferrer"
															class="text-[9px] text-[#0098EA] hover:underline font-bold flex items-center justify-end gap-0.5"
														>
															<span>{t('numbers.txProof')}</span>
															<span class="material-symbols-outlined text-[10px]">open_in_new</span>
														</a>
													</Show>
												</div>
											</div>
										)}
									</For>
								</Show>
							</div>
						</div>

						{/* 📜 DIGITAL VALUATION CERTIFICATE (HMAC-SHA256) */}
						<NumberDigitalCertificateCard
							certificateId={reportData()?.certificate_id}
							number={reportData()?.number || inputNumber()}
							expectedTon={reportData()?.expected_ton ? Number(reportData()!.expected_ton) : 0}
							confidence={reportData()?.confidence_score}
						/>
					</div>
				</Show>
			</div>

			{/* Credit Store Sheet */}
			<CreditStoreSheet open={storeOpen()} onClose={() => setStoreOpen(false)} vertical="number" />
		</div>
	);
};
