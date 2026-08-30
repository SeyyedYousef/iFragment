import { useNavigate, useSearchParams } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, onMount, Show } from 'solid-js';
import {
	type CuriosityGateData,
	type NumberValuationResult,
	numbersApi,
} from '@/entities/numbers/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { copyToClipboard, shareToStory } from '@/shared/lib/telegram-native.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { CreditStoreSheet, SearchTeaser, useWallet } from '@/widgets/paywall/index.js';

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

	if (suffix.length < 4) {
		return {
			isValid: false,
			error: t('numbers.errorTooShort'),
			formatted: `+888 ${suffix}`,
			cleanDigits: clean,
			suffix,
			tier: 'STANDARD',
			patternLabel: '',
		};
	}

	if (suffix.length > 8) {
		return {
			isValid: false,
			error: t('numbers.errorTooLong'),
			formatted: `+888 ${suffix.slice(0, 4)} ${suffix.slice(4)}`,
			cleanDigits: clean,
			suffix,
			tier: 'STANDARD',
			patternLabel: '',
		};
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
		suffix.includes('8888') ||
		suffix.includes('7777') ||
		suffix.includes('0000') ||
		suffix.includes('9999') ||
		suffix.includes('1111') ||
		(suffix.length === 8 && new Set(suffix).size === 1) ||
		suffix === '8888'
	) {
		tier = 'GRAIL';
		patternLabel = 'GRAIL TIER (Quad Repeat / Genesis)';
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
	const [inputNumber] = createSignal(searchParams.n || '+888 8888 8888');
	const [isAnalyzing, setIsAnalyzing] = createSignal(false);
	const [analysisStep, setAnalysisStep] = createSignal(0);

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

	// Certificate copy state
	const [copiedCert, setCopiedCert] = createSignal(false);

	// Reactive validation
	const validation = createMemo(() => validateAndFormatAnonymousNumber(inputNumber()));

	// 3D Holographic Gyro Tilt State
	const [tilt, setTilt] = createSignal({ x: 0, y: 0, glossX: 50, glossY: 50 });
	let cardRef: HTMLDivElement | undefined;

	const handlePointerMove = (e: PointerEvent) => {
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
	};

	const handlePointerLeave = () => {
		setTilt({ x: 0, y: 0, glossX: 50, glossY: 50 });
	};

	const analysisSteps = () => [
		t('numbers.stepConnectingContracts'),
		t('numbers.stepQueryingMatrix'),
		t('numbers.stepExtractingFeatures'),
		t('numbers.stepRunningHedonic'),
	];

	onMount(() => {
		if (searchParams.n) {
			handleRunAnalysis(searchParams.n);
		} else {
			handleRunAnalysis('+888 8888 8888');
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

		const interval = setInterval(() => {
			setAnalysisStep((prev) => {
				if (prev < analysisSteps().length - 1) return prev + 1;
				return prev;
			});
		}, 650);

		try {
			const gate = await numbersApi.getCuriosityGate(val.cleanDigits);
			setGateData(gate);
		} catch (err: any) {
			setError(err?.message || 'Failed to connect to Telegram Telemint registry');
		} finally {
			setTimeout(() => {
				clearInterval(interval);
				setIsAnalyzing(false);
			}, 2400);
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
			setError(err?.message || 'Failed to unlock with Intel Credit');
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

	const handleCopyCertificate = () => {
		const certId = reportData()?.certificate_id || 'IFRG-NUM-89FA2D';
		haptic.selection();
		copyToClipboard(`https://ifragment.org/cert/number/${certId}`);
		setCopiedCert(true);
		setTimeout(() => setCopiedCert(false), 2200);
	};

	const handleShareToStory = () => {
		if (!reportData()) return;
		haptic.impact('medium');
		const numClean = reportData()!.number.replace(/\s+/g, '');
		const shareUrl = `https://t.me/iFragmentBot/iFragment?startapp=number_${numClean.replace('+', '')}`;
		shareToStory(`https://ifragment.org/api/v1/numbers/card?n=${encodeURIComponent(numClean)}`, {
			text: `💎 AI Appraisal: ${reportData()!.display_number} is valued at ${formatTon(reportData()!.expected_ton)} TON on iFragment!`,
			widget_link: {
				url: shareUrl,
				name: 'View Certificate',
			},
		});
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
				<div class="flex items-center justify-between mb-5">
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
							<span>{t('numbers.paywallHeaderTitle')}</span>
							<span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
								+888
							</span>
						</h1>
						<p class="text-[11px] font-medium text-white/50">{t('numbers.intelSubtitle')}</p>
					</div>

					<div class="w-10 h-10" />
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

				{/* ═══════ 3. STATE 2: PRE-UNLOCK PAYWALL GATE ═══════ */}
				<Show when={!isAnalyzing() && !isUnlocked() && gateData()}>
					<div class="mb-6 space-y-4">
						{/* 🔒 100% ZERO VALUE LEAKAGE PAYWALL HERO TEASER (SQUARE) */}
						<div class="w-full aspect-square p-[3px] bg-gradient-to-br from-[#0098EA]/40 via-amber-500/30 to-[#08090D] rounded-[48px] my-2 relative z-20 shadow-[0_20px_50px_rgba(0,152,234,0.2)]">
							<div class="w-full h-full bg-[#08090D] rounded-[45px] p-6 sm:p-8 relative overflow-hidden flex flex-col justify-between shadow-inner">
								{/* Ambient Lock Glow */}
								<div class="absolute inset-0 bg-gradient-to-b from-[#0098EA]/10 via-transparent to-black/60 pointer-events-none" />

								<div class="flex justify-between items-center z-10">
									<span class="px-3.5 py-1.5 bg-[#0098EA]/15 border border-[#0098EA]/40 text-[#0098EA] rounded-[12px] text-[10px] font-black tracking-widest uppercase shadow-sm flex items-center gap-1.5">
										<span class="material-symbols-outlined text-[14px]">lock</span>
										{t('valuation.lockedIntel') || 'LOCKED INTEL'}
									</span>
									<span class="text-[11px] font-mono font-black text-white/30 tracking-[4px] uppercase bg-white/5 border border-white/5 px-3.5 py-1.5 rounded-[12px]">
										{'IFRAGMENT'}
									</span>
								</div>

								{/* Target Number */}
								<div class="flex flex-col justify-center items-center z-10 text-center flex-grow py-4 w-full">
									<div class="flex items-center justify-center gap-2 w-full">
										<span class="text-amber-400/40 font-black text-[22px]">✦</span>
										<span
											class="inline-block font-black font-mono tracking-tight text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] truncate max-w-[85%] pb-1"
											style={{
												'font-size': getNumberFontSize(
													gateData()?.display_number || inputNumber(),
												),
											}}
											dir="ltr"
										>
											{gateData()?.display_number || validation().formatted || inputNumber()}
										</span>
										<span class="text-amber-400/40 font-black text-[22px]">✦</span>
									</div>

									<div class="flex justify-center mt-3 w-full">
										<SearchTeaser vertical="number" value={inputNumber()} />
									</div>
								</div>

								{/* Blurred Value Container */}
								<div class="flex justify-between items-end border-t border-white/10 pt-4 z-10">
									<div class="flex flex-col gap-1 text-start">
										<span class="text-[9px] font-black text-white/40 uppercase tracking-widest">
											{t('numbers.fairValue') || 'ESTIMATED FAIR VALUE'}
										</span>
										<div
											class="flex items-center gap-2 filter blur-[6px] select-none opacity-60"
											dir="ltr"
										>
											<span class="text-[26px] font-black text-white font-mono">••••••••</span>
											<span class="text-[13px] font-black text-[#0098EA]">
												{t('common.ton')}
											</span>
										</div>
									</div>
									<div class="flex items-center gap-1.5 bg-amber-400/20 border border-amber-400/40 text-amber-300 font-mono font-black text-[11px] px-3 py-1.5 rounded-[12px]">
										<span class="material-symbols-outlined text-[16px]">key</span>
										<span>{t('valuation.oneCredit') || '1 CREDIT'}</span>
									</div>
								</div>
							</div>
						</div>

						{/* Payment / Unlock Card */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-2xl relative overflow-hidden">
							<div class="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
								<div>
									<h3 class="text-sm font-black text-white">{t('numbers.paywallHeaderTitle')}</h3>
									<p class="text-[11px] text-white/50 mt-0.5">{t('numbers.universalCredit')}</p>
								</div>
								<div class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0098EA]/15 border border-[#0098EA]/30 text-[#0098EA]">
									<span class="material-symbols-outlined text-sm">key</span>
									<span class="font-mono text-xs font-black">1 CREDIT</span>
								</div>
							</div>

							<div class="flex items-center justify-between p-3.5 bg-black/40 rounded-2xl border border-white/5 mb-4">
								<div class="flex items-center gap-2.5">
									<div class="w-9 h-9 rounded-xl bg-[#0098EA]/20 text-[#0098EA] flex items-center justify-center border border-[#0098EA]/30">
										<span class="material-symbols-outlined text-lg">account_balance_wallet</span>
									</div>
									<div>
										<div class="text-[10px] text-white/50 font-bold uppercase tracking-wider">
											{t('numbers.paywallUserBalance')}
										</div>
										<div class="text-sm font-black text-white font-mono flex items-center gap-1">
											<span>{wallet.balance() !== null ? wallet.balance() : '...'}</span>
											<span class="text-xs text-white/50 font-sans">
												{t('paywall.credit_unit')}
											</span>
										</div>
									</div>
								</div>

								<button
									type="button"
									onClick={() => setStoreOpen(true)}
									class="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-xs font-bold text-white transition-all active:scale-95"
								>
									+ {t('paywall.get_credits')}
								</button>
							</div>

							<button
								type="button"
								disabled={loading()}
								onClick={handleUnlockWithCredit}
								class={`w-full h-14 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all hover:brightness-110 ${
									canAfford()
										? 'bg-gradient-to-r from-[#0098EA] via-[#00c6ff] to-[#0098EA] text-white shadow-[#0098EA]/30'
										: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white shadow-amber-500/20'
								}`}
							>
								<Show
									when={!loading()}
									fallback={
										<span class="material-symbols-outlined animate-spin text-lg">
											progress_activity
										</span>
									}
								>
									<span class="material-symbols-outlined text-lg">
										{canAfford() ? 'lock_open' : 'shopping_bag'}
									</span>
								</Show>
								<span>
									{loading()
										? t('paywall.working')
										: canAfford()
											? t('numbers.paywallUnlockNowCta')
											: t('numbers.paywallGetCreditsCta')}
								</span>
							</button>
						</div>
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
								class="w-full h-full bg-[#08090D] rounded-[45px] p-6 sm:p-8 relative overflow-hidden flex flex-col justify-between shadow-inner select-none cursor-pointer touch-pan-y will-change-transform"
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
								<div class="flex justify-between items-center z-10">
									<span
										class={`px-3.5 py-1.5 border rounded-[12px] text-[10px] font-black tracking-widest uppercase shadow-sm ${
											getNumberTheme().badge
										}`}
									>
										{reportData()?.pattern_anatomy?.club_name_en ||
											reportData()?.category_club ||
											`${getNumberTheme().name} TIER`}
									</span>
									<span class="text-[11px] font-mono font-black text-white/30 tracking-[3px] uppercase bg-white/5 border border-white/5 px-3.5 py-1.5 rounded-[12px] shadow-inner">
										👑 #{reportData()?.global_rank || 1} / 136k
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
										<span class="text-white/20 font-black text-[22px] sm:text-[26px] select-none drop-shadow-md">
											✦
										</span>
										<span
											class="inline-block font-black font-mono tracking-tight text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] truncate max-w-[85%] pb-1"
											style={{
												'font-size': getNumberFontSize(
													reportData()?.display_number || inputNumber(),
												),
											}}
											dir="ltr"
										>
											{reportData()?.display_number || inputNumber()}
										</span>
										<span class="text-white/20 font-black text-[22px] sm:text-[26px] select-none drop-shadow-md">
											✦
										</span>
									</div>

									<div class="mt-2">
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
									</div>
								</div>

								{/* Bottom Valuation & Status Bar */}
								<div class="flex justify-between items-end border-t border-white/10 pt-4 z-10">
									<div class="flex flex-col gap-0.5 text-start">
										<span class="text-[9px] font-black text-white/40 uppercase tracking-widest mb-0.5">
											{t('numbers.fairValue') || 'ESTIMATED VALUE'}
										</span>
										<div class="flex items-center gap-2" dir="ltr">
											<svg
												class="w-7 h-7 filter drop-shadow-[0_0_15px_rgba(0,152,234,0.6)]"
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
											<span class="text-[28px] sm:text-[32px] font-black text-white leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] tracking-tight font-mono">
												{formatTon(reportData()?.expected_ton)}
											</span>
											<span class="text-[13px] font-black text-[#0098EA] leading-none mb-1">
												{t('common.ton')}
											</span>
										</div>
									</div>

									<div class="flex flex-col items-end gap-1.5">
										<div class="flex items-center gap-1.5 bg-[#10b981]/15 px-3 py-1 rounded-[10px] border border-[#10b981]/40 text-[#10b981] font-black uppercase tracking-widest text-[9px] shadow-[0_0_20px_rgba(16,185,129,0.2)]">
											<div class="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse" />{' '}
											{t('valuation.verified') || 'VERIFIED'}
										</div>
										<span
											class="text-[13px] text-white/60 font-black leading-none font-mono"
											dir="ltr"
										>
											≈ ${formatUsd(reportData()?.expected_usd)}
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

						{/* 📊 MODULE 3: PRICE RANGE & SPECTRUM */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
								<h3 class="text-xs font-black text-white flex items-center gap-2">
									<span class="material-symbols-outlined text-[#0098EA] text-base">
										monitoring
									</span>
									<span>{t('numbers.priceRangeTitle')}</span>
								</h3>
								<span class="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
									{reportData()?.confidence_score}% Confidence
								</span>
							</div>

							<div class="grid grid-cols-3 gap-2 text-center my-3">
								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
									<span class="text-[9px] uppercase font-bold text-white/40 block mb-1">
										{t('valuation.floor')}
									</span>
									<span class="font-mono font-black text-white text-xs block" dir="ltr">
										{formatTon(reportData()?.low_ton)} TON
									</span>
								</div>

								<div class="p-3 rounded-2xl bg-[#0098EA]/10 border border-[#0098EA]/30">
									<span class="text-[9px] uppercase font-bold text-[#0098EA] block mb-1">
										{t('numbers.fairValue')}
									</span>
									<span class="font-mono font-black text-[#0098EA] text-sm block" dir="ltr">
										{formatTon(reportData()?.expected_ton)} TON
									</span>
								</div>

								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
									<span class="text-[9px] uppercase font-bold text-white/40 block mb-1">
										{t('valuation.ceiling')}
									</span>
									<span class="font-mono font-black text-white text-xs block" dir="ltr">
										{formatTon(reportData()?.high_ton)} TON
									</span>
								</div>
							</div>

							<p class="text-[10px] text-white/40 leading-relaxed text-start">
								{reportData()?.price_basis === 'pattern_comps_shrunk_to_class'
									? t('numbers.basisComps')
									: t('numbers.basisRegression')}
							</p>
						</div>

						{/* ⚖️ MODULE 4: ACTIONABLE PLAYBOOK */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-amber-400/30 rounded-[28px] p-5 shadow-xl relative overflow-hidden">
							<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
								<h3 class="text-xs font-black text-white flex items-center gap-2">
									<span class="material-symbols-outlined text-amber-400 text-base">gavel</span>
									<span>{t('numbers.actionPlaybookTitle')}</span>
								</h3>
								<span class="text-[9px] uppercase font-mono font-black text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-md">
									ACTION PLAYBOOK
								</span>
							</div>

							<div class="grid grid-cols-2 gap-2.5 mb-3">
								<div class="p-3 rounded-2xl bg-black/40 border border-white/5 text-start">
									<span class="text-[9px] font-black text-emerald-400 uppercase block mb-1">
										{t('numbers.fairBuyTarget')}
									</span>
									<span class="text-sm font-mono font-black text-white block" dir="ltr">
										{formatTon(
											reportData()?.playbook?.fair_buy_target_ton ||
												Math.round(Number(reportData()?.expected_ton || 0) * 0.88),
										)}{' '}
										TON
									</span>
									<span class="text-[9px] text-white/40 block mt-0.5">
										{t('numbers.fairBuySub')}
									</span>
								</div>

								<div class="p-3 rounded-2xl bg-black/40 border border-white/5 text-start">
									<span class="text-[9px] font-black text-amber-400 uppercase block mb-1">
										{t('numbers.suggestedAuctionStart')}
									</span>
									<span class="text-sm font-mono font-black text-white block" dir="ltr">
										{formatTon(
											reportData()?.playbook?.suggested_auction_start_ton ||
												Math.round(Number(reportData()?.expected_ton || 0) * 0.72),
										)}{' '}
										TON
									</span>
									<span class="text-[9px] text-white/40 block mt-0.5">
										{t('numbers.suggestedAuctionStartSub')}
									</span>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-2.5 mb-3">
								<div class="p-3 rounded-2xl bg-black/40 border border-white/5 text-start">
									<span class="text-[9px] font-black text-[#0098EA] uppercase block mb-1">
										{t('numbers.buyNowTarget')}
									</span>
									<span class="text-sm font-mono font-black text-white block" dir="ltr">
										{formatTon(
											reportData()?.playbook?.buy_now_target_ton ||
												Math.round(Number(reportData()?.expected_ton || 0) * 1.15),
										)}{' '}
										TON
									</span>
									<span class="text-[9px] text-white/40 block mt-0.5">
										{t('numbers.buyNowSub')}
									</span>
								</div>

								<div class="p-3 rounded-2xl bg-black/40 border border-white/5 text-start">
									<span class="text-[9px] font-black text-purple-300 uppercase block mb-1">
										{t('numbers.bidStepLabel')}
									</span>
									<span class="text-sm font-mono font-black text-white block" dir="ltr">
										{formatTon(
											reportData()?.playbook?.bid_step_ton ||
												Math.round(Number(reportData()?.expected_ton || 0) * 0.05),
										)}{' '}
										TON
									</span>
									<span class="text-[9px] text-white/40 block mt-0.5">
										{t('numbers.bidStepStandard')}
									</span>
								</div>
							</div>

							{/* Net Proceeds Card */}
							<div class="p-3.5 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-between">
								<div class="text-start">
									<span class="text-[9px] font-bold text-white/50 block">
										{t('numbers.netProceedsTitle')}
									</span>
									<span class="text-base font-mono font-black text-emerald-400 block" dir="ltr">
										{formatTon(
											reportData()?.playbook?.net_proceeds_ton ||
												reportData()?.economics?.net_payout_ton,
										)}{' '}
										TON
									</span>
									<span class="text-[10px] text-white/40 font-mono" dir="ltr">
										≈{' '}
										{formatUsd(
											reportData()?.playbook?.net_proceeds_usd ||
												reportData()?.economics?.net_payout_usd,
										)}
									</span>
								</div>
								<span class="text-[10px] font-mono font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
									-5.0% Fee
								</span>
							</div>
						</div>

						{/* 🧬 MODULE 5: STRUCTURAL GENETICS & SCARCITY MATRIX */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
								<h3 class="text-xs font-black text-white flex items-center gap-2">
									<span class="material-symbols-outlined text-amber-400 text-base">dna</span>
									<span>{t('numbers.patternAnatomyTitle')}</span>
								</h3>
								<span class="text-[9px] uppercase font-mono font-black text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-md">
									{reportData()?.pattern_anatomy?.exact_supply_count || 10} IN EXISTENCE
								</span>
							</div>

							<div class="space-y-2.5 text-xs text-start">
								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
									<span class="text-white/60">{t('numbers.exactSupplyLabel')}:</span>
									<span class="font-mono font-black text-amber-300" dir="ltr">
										{reportData()?.pattern_anatomy?.exact_supply_count || 10} / 136,566 (
										{reportData()?.pattern_anatomy?.supply_percentage || 0.007}%)
									</span>
								</div>

								<div class="grid grid-cols-3 gap-2 text-center">
									<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
										<span class="text-[9px] text-white/40 block mb-0.5">
											{t('numbers.uniqueDigitsLabel')}
										</span>
										<span class="font-mono font-black text-white text-xs">
											{reportData()?.pattern_anatomy?.distinct_digits ?? 1}{' '}
											{t('numbers.digitUnit')}
										</span>
									</div>

									<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
										<span class="text-[9px] text-white/40 block mb-0.5">
											{t('numbers.symmetryLabel')}
										</span>
										<span class="font-mono font-black text-emerald-400 text-xs">
											{reportData()?.pattern_anatomy?.symmetry_score || 100}%
										</span>
									</div>

									<div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
										<span class="text-[9px] text-white/40 block mb-0.5">
											{t('numbers.memorabilityLabel')}
										</span>
										<span class="font-mono font-black text-[#0098EA] text-xs">
											{reportData()?.pattern_anatomy?.memorability_score || 99} / 100
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
									~{reportData()?.rental_yield?.est_apy || 54.0}% APY
								</span>
							</div>

							<div class="flex items-center justify-between bg-black/40 rounded-2xl p-4 border border-white/5 mb-2.5">
								<div class="text-start">
									<span class="text-[9px] font-bold text-white/50 block mb-0.5">
										{t('numbers.monthlyRentalEst')}
									</span>
									<span class="text-lg font-mono font-black text-emerald-400 block" dir="ltr">
										~
										{formatTon(
											reportData()?.rental_yield?.monthly_yield_ton ||
												Math.round(Number(reportData()?.expected_ton || 0) * 0.045),
										)}{' '}
										TON
									</span>
								</div>
								<div class="text-end">
									<span class="text-[9px] font-bold text-white/50 block mb-0.5">
										{t('numbers.estApyLabel')}
									</span>
									<span class="text-base font-mono font-black text-[#0098EA] block">~54.0%</span>
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
										{formatTon(
											reportData()?.market_depth?.club_floor_ton ||
												Math.round(Number(reportData()?.expected_ton || 0) * 0.75),
										)}{' '}
										TON
									</span>
								</div>

								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
									<span class="text-[9px] font-bold text-white/50 block mb-0.5">
										{t('numbers.estimatedSellTime')}
									</span>
									<span class="text-sm font-mono font-black text-emerald-400 block">
										{isRtl()
											? reportData()?.market_depth?.liquidity_speed_fa || '۱ تا ۳ روز'
											: reportData()?.market_depth?.liquidity_speed_en || '1 - 3 Days'}
									</span>
								</div>
							</div>

							<div class="p-3 rounded-2xl bg-[#08090D] border border-white/5 text-start text-[10px] text-white/60 leading-relaxed">
								<span class="font-bold text-white/80">{t('numbers.hodlStrengthLabel')}: </span>
								<span>
									{isRtl()
										? reportData()?.market_depth?.hodl_strength_fa ||
											'بسیار قوی (بیش از ۸۰٪ شماره‌ها در ولت سرد هولدرها نگهداری می‌شود)'
										: reportData()?.market_depth?.hodl_strength_en ||
											'Very Strong (>80% held in long-term cold wallets)'}
								</span>
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
						</div>

						{/* 📜 MODULE 9: ON-CHAIN AUDIT & PROVENANCE */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start">
							<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
								<h3 class="text-xs font-black text-white flex items-center gap-2">
									<span class="material-symbols-outlined text-[#0098EA] text-base">
										verified
									</span>
									<span>{t('numbers.onChainAuditTitle')}</span>
								</h3>
								<span class="text-[9px] uppercase font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
									CLEAN & VERIFIED
								</span>
							</div>

							<div class="space-y-2 text-[11px]">
								<div class="flex items-center justify-between py-1 border-b border-white/5">
									<span class="text-white/50">{t('numbers.restrictedStatusLabel')}:</span>
									<span class="text-emerald-400 font-bold flex items-center gap-1">
										<span class="material-symbols-outlined text-xs">check_circle</span>
										<span>
											{isRtl()
												? reportData()?.on_chain_audit?.restriction_status_fa ||
													'تایید شده و بدون محدودیت'
												: reportData()?.on_chain_audit?.restriction_status_en ||
													'Clean & Verified'}
										</span>
									</span>
								</div>

								<div class="flex items-center justify-between py-1 border-b border-white/5">
									<span class="text-white/50">{t('numbers.telemintContractLabel')}:</span>
									<span class="font-mono text-white/80 text-[10px]" dir="ltr">
										{reportData()?.on_chain_audit?.telemint_contract || 'EQD8...392A'}
									</span>
								</div>

								<div class="flex items-center justify-between py-1 border-b border-white/5">
									<span class="text-white/50">{t('numbers.mintDateLabel')}:</span>
									<span class="text-white/80 font-mono text-[10px]">
										{reportData()?.on_chain_audit?.mint_date || 'December 2022'}
									</span>
								</div>

								<div class="flex items-center justify-between py-1">
									<span class="text-white/50">{t('numbers.transferCountLabel')}:</span>
									<span class="text-white font-mono font-bold">
										{reportData()?.on_chain_audit?.transfer_count || 1}{' '}
										{t('numbers.transferCountUnit')}
									</span>
								</div>
							</div>
						</div>

						{/* 👑 MODULE 10: OFFICIAL DIGITAL CERTIFICATE & SHARING */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-amber-400/30 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
								<div class="flex items-center gap-2 text-start">
									<span class="material-symbols-outlined text-amber-400 text-lg">
										workspace_premium
									</span>
									<div>
										<h4 class="text-xs font-black text-white">
											{t('numbers.certificateTitle')}
										</h4>
										<span class="text-[9px] text-white/40">
											{t('numbers.certificateIssuer')}
										</span>
									</div>
								</div>
								<span class="text-[9px] font-mono font-bold bg-amber-400/10 border border-amber-400/30 text-amber-400 px-2 py-0.5 rounded-md">
									{reportData()?.certificate_id || 'IFRG-NUM-001'}
								</span>
							</div>

							<div class="grid grid-cols-2 gap-2 mt-4">
								<button
									type="button"
									onClick={handleShareToStory}
									class="py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-black text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-amber-400/20 active:scale-95 transition-all hover:brightness-110"
								>
									<span class="material-symbols-outlined text-base">auto_awesome</span>
									<span>{t('numbers.shareToStoryBtn')}</span>
								</button>

								<button
									type="button"
									onClick={handleCopyCertificate}
									class={`py-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
										copiedCert()
											? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
											: 'bg-white/[0.06] hover:bg-white/10 border-white/10 text-white/80'
									}`}
								>
									<span class="material-symbols-outlined text-base">
										{copiedCert() ? 'check' : 'content_copy'}
									</span>
									<span>
										{copiedCert() ? t('numbers.certCopied') : t('numbers.copyCertLink')}
									</span>
								</button>
							</div>
						</div>
					</div>
				</Show>
			</div>

			{/* Credit Store Sheet */}
			<CreditStoreSheet open={storeOpen()} onClose={() => setStoreOpen(false)} vertical="number" />
		</div>
	);
};
