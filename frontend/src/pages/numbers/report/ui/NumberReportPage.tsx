import { useSearchParams } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
	type CuriosityGateData,
	type NumberValuationResult,
	numbersApi,
} from '@/entities/numbers/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { copyToClipboard, shareToStory } from '@/shared/lib/telegram-native.js';
import { CreditStoreSheet, SearchTeaser, useWallet } from '@/widgets/paywall/index.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

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

	// Check if contains illegal non-numeric characters (allow +, space, hyphen, parentheses)
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

	// Check if user entered a cellular country code like +98, +1, +44 instead of +888
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

	// Format display number: +888 XXXX XXXX
	let formatted = '';
	if (suffix.length <= 4) {
		formatted = `+888 ${suffix}`;
	} else {
		formatted = `+888 ${suffix.slice(0, 4)} ${suffix.slice(4)}`;
	}

	// Calculate rarity tier preview based on structural pattern
	let tier: 'GRAIL' | 'APEX' | 'GRAND' | 'STANDARD' = 'STANDARD';
	let patternLabel = '';

	if (
		suffix.includes('8888') ||
		suffix.includes('7777') ||
		suffix.includes('0000') ||
		suffix.includes('9999') ||
		suffix.includes('1111') ||
		(suffix.length === 8 && new Set(suffix).size === 1)
	) {
		tier = 'GRAIL';
		patternLabel = 'GRAIL TIER (Quad Repeat)';
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
	const [searchParams] = useSearchParams();
	const wallet = useWallet();

	// Search & Input state
	const [inputNumber, setInputNumber] = createSignal(searchParams.n || '+888 8888 8888');
	const [showGuide, setShowGuide] = createSignal(false);
	const [isAnalyzing, setIsAnalyzing] = createSignal(false);
	const [analysisStep, setAnalysisStep] = createSignal(0);

	// Gate vs Unlocked State
	const [isUnlocked, setIsUnlocked] = createSignal(false);
	const [gateData, setGateData] = createSignal<CuriosityGateData | null>(null);
	const [reportData, setReportData] = createSignal<NumberValuationResult | null>(null);
	const [loading, setLoading] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const [storeOpen, setStoreOpen] = createSignal(false);

	// Watchlist state
	const [isWatching, setIsWatching] = createSignal(false);
	const [watchLoading, setWatchLoading] = createSignal(false);

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

	const ANALYSIS_STEPS = [
		'Connecting to Telemint Smart Contracts...',
		'Querying 136,566 Closed Collection Matrix...',
		'Extracting 11 Structural & Mathematical Features...',
		'Running Hedonic Regression & Bayesian Shrinkage...',
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
				if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
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

	const handleCopyCertificate = () => {
		if (!reportData()?.certificate_id) return;
		haptic.selection();
		copyToClipboard(reportData()!.certificate_id);
		setCopiedCert(true);
		setTimeout(() => setCopiedCert(false), 2000);
	};

	const handleShareToStory = () => {
		if (!reportData()) return;
		haptic.impact('medium');
		const numClean = reportData()!.number.replace(/\s+/g, '');
		const shareUrl = `https://t.me/iFragmentBot/iFragment?startapp=number_${numClean.replace('+', '')}`;
		shareToStory(`https://ifragment.org/api/v1/numbers/card?n=${encodeURIComponent(numClean)}`, {
			text: `💎 AI Valuation: ${reportData()!.display_number} is worth ${formatTon(reportData()!.expected_ton)} TON on iFragment!`,
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
		const num = (reportData()?.display_number || gateData()?.display_number || validation().formatted || inputNumber()).replace(
			/\s+/g,
			'',
		);
		// Quad repeating digits -> Grail Gold
		if (
			num.includes('88888888') ||
			num.includes('77777777') ||
			num.includes('00000000') ||
			num.includes('8888')
		) {
			return {
				name: 'GRAIL',
				badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
				gradient: 'from-[#FFB800] via-[#FF8C00] to-[#E52E71]',
				glowColor: 'rgba(255, 184, 0, 0.35)',
				border: 'border-amber-400/40',
				accent: '#FFB800',
			};
		}
		// Sequential/Alternating -> Apex Purple
		if (num.includes('1234') || num.includes('8989') || num.includes('0101')) {
			return {
				name: 'APEX',
				badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
				gradient: 'from-[#AF52DE] via-[#8A2BE2] to-[#0098EA]',
				glowColor: 'rgba(175, 82, 222, 0.35)',
				border: 'border-purple-400/40',
				accent: '#AF52DE',
			};
		}
		// Triple Tail -> Grand Blue
		if (num.endsWith('888') || num.endsWith('777') || num.endsWith('000')) {
			return {
				name: 'GRAND',
				badgeBg: 'bg-[#0098EA]/20 text-[#0098EA] border-[#0098EA]/40',
				gradient: 'from-[#0098EA] via-[#0070BA] to-[#34C759]',
				glowColor: 'rgba(0, 152, 234, 0.35)',
				border: 'border-[#0098EA]/40',
				accent: '#0098EA',
			};
		}
		// Default -> Emerald Teal
		return {
			name: 'STANDARD',
			badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
			gradient: 'from-[#34C759] via-[#10B981] to-[#0098EA]',
			glowColor: 'rgba(52, 199, 89, 0.3)',
			border: 'border-emerald-500/30',
			accent: '#34C759',
		};
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
				{/* ═══════ CLEAN DEDICATED HEADER ═══════ */}
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
							<span>{isUnlocked() ? t('numbers.valuationReportTitle') : t('numbers.paywallHeaderTitle')}</span>
							<span class="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
								+888
							</span>
						</h1>
						<p class="text-[11px] font-medium text-white/50">{t('numbers.intelSubtitle')}</p>
					</div>

					{/* Spacer to keep title centered */}
					<div class="w-10 h-10" />
				</div>

				<Show when={error()}>
					<div class="bg-red-500/10 border border-red-500/30 rounded-2xl p-3.5 mb-4 text-xs text-red-400 flex items-center gap-2">
						<span class="material-symbols-outlined text-base">error</span>
						<span>{error()}</span>
					</div>
				</Show>

				{/* ═══════ 3. STATE 1: ANALYZING SCAN ANIMATION ═══════ */}
				<Show when={isAnalyzing()}>
					<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 mb-6 text-center relative overflow-hidden shadow-2xl">
						<div class="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#0098EA] to-[#00c6ff] mx-auto mb-4 flex items-center justify-center shadow-lg shadow-[#0098EA]/40 animate-pulse">
							<span class="material-symbols-outlined text-white text-3xl">psychology</span>
						</div>

						<h2 class="text-lg font-black text-white mb-1">{t('numbers.engineScanning')}</h2>
						<p class="text-xs text-white/50 mb-6 font-mono font-bold">
							{ANALYSIS_STEPS[analysisStep()]}
						</p>

						{/* Progress Bar */}
						<div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
							<div
								class="h-full bg-gradient-to-r from-[#0098EA] to-emerald-400 rounded-full transition-all duration-500"
								style={{ width: `${((analysisStep() + 1) / ANALYSIS_STEPS.length) * 100}%` }}
							/>
						</div>
						<div class="text-[10px] text-white/40 font-mono">
							{t('numbers.telemintContracts')}
						</div>
					</div>
				</Show>

				{/* ═══════ 4. STATE 2: WORLD-CLASS PAYWALL & VALUE PROPOSITION (NO BLURRED CARDS) ═══════ */}
				<Show when={!isAnalyzing() && !isUnlocked() && gateData()}>
					<div class="mb-6 space-y-4">
						{/* Target Asset Header Card */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-[#0098EA]/30 rounded-[28px] p-4.5 shadow-2xl relative overflow-hidden">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<span
										class={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${getNumberTheme().badgeBg}`}
									>
										{getNumberTheme().name} TIER
									</span>
									<span class="text-[10px] font-mono text-white/40 uppercase">
										{t('numbers.frozenAnonymous')}
									</span>
								</div>
								<span class="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
									<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
									136,566 Total Supply
								</span>
							</div>

							<div class="text-center my-3" dir="ltr">
								<span class="text-2xl xs:text-3xl font-black text-white font-mono tracking-tight drop-shadow-md">
									{gateData()?.display_number || validation().formatted || inputNumber()}
								</span>
							</div>

							{/* Signals Analyzed Badge */}
							<div class="flex items-center justify-center gap-2 text-[11px] text-white/70 font-semibold bg-white/[0.04] p-2 rounded-xl border border-white/5">
								<span class="material-symbols-outlined text-[#0098EA] text-sm">verified_user</span>
								<span>
									{gateData()?.signals_analyzed || 27} on-chain & statistical signals analyzed
								</span>
							</div>
						</div>

						{/* Dedicated Payment & Quota Card */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-2xl relative overflow-hidden">
							<div class="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
								<div>
									<h3 class="text-sm font-black text-white">{t('numbers.paywallHeaderTitle')}</h3>
									<p class="text-[11px] text-white/50 mt-0.5">
										{t('numbers.universalCredit')}
									</p>
								</div>

								{/* Cost Tag */}
								<div class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0098EA]/15 border border-[#0098EA]/30 text-[#0098EA]">
									<span class="material-symbols-outlined text-sm">key</span>
									<span class="font-mono text-xs font-black">1 CREDIT</span>
								</div>
							</div>

							{/* Quota & Wallet Balance Bar */}
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
											<span class="text-xs text-white/50 font-sans">{t('paywall.credit_unit')}</span>
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

							{/* Primary Action Button */}
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
										<span class="material-symbols-outlined animate-spin text-lg">progress_activity</span>
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

							{/* Trust Footer */}
							<div class="flex items-center justify-center gap-3 text-[10px] font-bold text-white/50 mt-3.5">
								<span class="flex items-center gap-1">
									<span class="material-symbols-outlined text-[12px] text-emerald-400">bolt</span>
									{t('numbers.paywallTrustInstant')}
								</span>
								<span class="h-3 w-px bg-white/10" />
								<span class="flex items-center gap-1">
									<span class="material-symbols-outlined text-[12px] text-emerald-400">history</span>
									{t('numbers.paywallTrustValidity')}
								</span>
							</div>
						</div>

						{/* ═══════ WHAT YOU UNLOCK: 7-FEATURE VALUE PROPOSITION ═══════ */}
						<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-2xl">
							<h3 class="text-sm font-black text-white mb-1 flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400 text-lg">workspace_premium</span>
								<span>{t('numbers.paywallBenefitsTitle')}</span>
							</h3>
							<p class="text-[11px] text-white/50 mb-4">
								{t('numbers.paywallCuriosityText')}
							</p>

							<div class="space-y-2.5 text-xs">
								{/* 1. Fair Valuation */}
								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
									<div class="w-8 h-8 rounded-xl bg-[#0098EA]/20 text-[#0098EA] flex items-center justify-center shrink-0 mt-0.5">
										<span class="material-symbols-outlined text-base">price_check</span>
									</div>
									<div>
										<h4 class="font-black text-white text-xs">{t('numbers.benefit1Title')}</h4>
										<p class="text-[11px] text-white/50 mt-0.5 leading-relaxed">{t('numbers.benefit1Desc')}</p>
									</div>
								</div>

								{/* 2. Rarity DNA */}
								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
									<div class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
										<span class="material-symbols-outlined text-base">genetics</span>
									</div>
									<div>
										<h4 class="font-black text-white text-xs">{t('numbers.benefit2Title')}</h4>
										<p class="text-[11px] text-white/50 mt-0.5 leading-relaxed">{t('numbers.benefit2Desc')}</p>
									</div>
								</div>

								{/* 3. Color Tier */}
								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
									<div class="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
										<span class="material-symbols-outlined text-base">palette</span>
									</div>
									<div>
										<h4 class="font-black text-white text-xs">{t('numbers.benefit3Title')}</h4>
										<p class="text-[11px] text-white/50 mt-0.5 leading-relaxed">{t('numbers.benefit3Desc')}</p>
									</div>
								</div>

								{/* 4. Cultural Radar */}
								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
									<div class="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
										<span class="material-symbols-outlined text-base">public</span>
									</div>
									<div>
										<h4 class="font-black text-white text-xs">{t('numbers.benefit4Title')}</h4>
										<p class="text-[11px] text-white/50 mt-0.5 leading-relaxed">{t('numbers.benefit4Desc')}</p>
									</div>
								</div>

								{/* 5. Comps */}
								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
									<div class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
										<span class="material-symbols-outlined text-base">table_chart</span>
									</div>
									<div>
										<h4 class="font-black text-white text-xs">{t('numbers.benefit5Title')}</h4>
										<p class="text-[11px] text-white/50 mt-0.5 leading-relaxed">{t('numbers.benefit5Desc')}</p>
									</div>
								</div>

								{/* 6. Economics */}
								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
									<div class="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
										<span class="material-symbols-outlined text-base">account_balance</span>
									</div>
									<div>
										<h4 class="font-black text-white text-xs">{t('numbers.benefit6Title')}</h4>
										<p class="text-[11px] text-white/50 mt-0.5 leading-relaxed">{t('numbers.benefit6Desc')}</p>
									</div>
								</div>

								{/* 7. Projections */}
								<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
									<div class="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
										<span class="material-symbols-outlined text-base">trending_up</span>
									</div>
									<div>
										<h4 class="font-black text-white text-xs">{t('numbers.benefit7Title')}</h4>
										<p class="text-[11px] text-white/50 mt-0.5 leading-relaxed">{t('numbers.benefit7Desc')}</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				</Show>

				{/* ═══════ 5. STATE 3: WORLD-CLASS UNLOCKED 9-SECTION PREMIUM REPORT ═══════ */}
				<Show when={isUnlocked() && reportData()}>
					<div class="space-y-4">
						{/* 1. 3D HOLOGRAPHIC GYRO CERTIFICATE CARD */}
						<div class="perspective-[1200px]">
							<div
								ref={cardRef}
								onPointerMove={handlePointerMove}
								onPointerLeave={handlePointerLeave}
								class={`relative w-full rounded-[32px] p-6 backdrop-blur-2xl border ${getNumberTheme().border} bg-gradient-to-b from-[#161925]/90 to-[#0A0C12]/95 shadow-2xl transition-transform duration-150 ease-out select-none cursor-pointer overflow-hidden touch-pan-y will-change-transform`}
								style={{
									transform: `perspective(1200px) rotateX(${tilt().x}deg) rotateY(${tilt().y}deg)`,
									'box-shadow': `0 20px 45px -10px ${getNumberTheme().glowColor}`,
								}}
							>
								{/* Gloss Reflex Overlay */}
								<div
									class="absolute inset-0 pointer-events-none rounded-[32px] transition-opacity duration-300"
									style={{
										background: `radial-gradient(circle 350px at ${tilt().glossX}% ${tilt().glossY}%, rgba(255,255,255,0.18), transparent 70%)`,
									}}
								/>

								{/* Card Header Stamp */}
								<div class="flex items-center justify-between mb-4 relative z-10">
									<div class="flex items-center gap-2">
										<span
											class={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${getNumberTheme().badgeBg}`}
										>
											{getNumberTheme().name} TIER
										</span>
										<span class="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-mono">
											👑 {t('numbers.globalRankBadge')} #{reportData()?.global_rank || 1}
										</span>
									</div>

									<div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono font-bold text-white/70">
										<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
										<span>{t('numbers.supplyCount')}</span>
									</div>
								</div>

								{/* Monospace Phone Number */}
								<div class="text-center my-4 relative z-10" dir="ltr">
									<h2 class="text-3xl xs:text-4xl font-black text-white font-mono tracking-tight drop-shadow-md">
										{reportData()?.display_number || inputNumber()}
									</h2>
									<div class="flex items-center justify-center gap-2 mt-1.5">
										<span class="text-xs text-white/50 font-mono">
											{t('numbers.frozenAnonymous')}
										</span>
										<span class="text-white/30">•</span>
										<span class="text-xs text-[#0098EA] font-bold">
											{reportData()?.category_club || 'Standard Collection'}
										</span>
									</div>
								</div>

								{/* Valuation Display Banner */}
								<div class="bg-black/50 backdrop-blur-md rounded-2xl p-4 border border-white/10 relative z-10 mb-4">
									<div class="flex items-center justify-between mb-1">
										<span class="text-[10px] uppercase font-bold text-white/50 tracking-wider">
											{t('numbers.fairValue')}
										</span>
										<span class="text-[11px] font-black text-emerald-400 font-mono flex items-center gap-1">
											<span class="material-symbols-outlined text-xs">verified</span>
											{reportData()?.confidence_score}% {t('numbers.confidence')}
										</span>
									</div>

									<div class="flex items-baseline gap-2" dir="ltr">
										<span class="text-3xl font-black text-white font-mono">
											{formatTon(reportData()?.expected_ton)}
										</span>
										<span class="text-sm font-bold text-[#0098EA]">{t('common.ton')}</span>
										<span class="text-xs font-semibold text-white/40 ml-1 font-mono">
											({formatUsd(reportData()?.expected_usd)})
										</span>
									</div>
									<div class="text-[11px] text-white/40 font-mono mt-1 flex items-center gap-2" dir="ltr">
										<span>
											Range: {formatTon(reportData()?.low_ton)} - {formatTon(reportData()?.high_ton)} TON
										</span>
										<span>·</span>
										<span>Rate: ${reportData()?.ton_usd_rate}/TON</span>
									</div>
								</div>

								{/* Card Footer */}
								<div class="flex items-center justify-between text-[10px] text-white/40 font-mono relative z-10">
									<span>{t('numbers.verifiedStamp')}</span>
									<span>CERT: {reportData()?.certificate_id || 'IF-NUM-001'}</span>
								</div>
							</div>
						</div>

						{/* 2. DIRECT FRAGMENT ACTION & LIVE AUCTION CARD */}
						<div class="bg-gradient-to-r from-[#0098EA]/15 via-purple-500/10 to-[#0098EA]/15 border border-[#0098EA]/30 rounded-[28px] p-4.5 shadow-xl backdrop-blur-2xl">
							<div class="flex items-center justify-between mb-3">
								<div class="flex items-center gap-2">
									<div class="w-8 h-8 rounded-xl bg-[#0098EA]/20 text-[#0098EA] flex items-center justify-center border border-[#0098EA]/30">
										<span class="material-symbols-outlined text-base">gavel</span>
									</div>
									<div>
										<h3 class="text-xs font-black text-white">Fragment Protocol Integration</h3>
										<span class="text-[10px] text-white/50">Direct on-chain Telemint link</span>
									</div>
								</div>
								<div class="text-right rtl:text-left">
									<div class="text-[9px] uppercase font-bold text-white/40">Min Next Bid</div>
									<div class="text-xs font-mono font-black text-white">
										{formatTon(reportData()?.economics?.min_bid_ton || 2205)} TON
									</div>
								</div>
							</div>

							<a
								href={reportData()?.fragment_direct_url || `https://fragment.com/number/${(reportData()?.number || '').replace('+888', '')}`}
								target="_blank"
								rel="noopener noreferrer"
								class="w-full py-3 rounded-2xl bg-gradient-to-r from-[#0098EA] via-[#00c6ff] to-[#0098EA] text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#0098EA]/25 active:scale-[0.98] transition-all hover:brightness-110"
							>
								<span class="material-symbols-outlined text-sm">open_in_new</span>
								<span>{t('numbers.fragmentDirectCta')}</span>
							</a>
						</div>

						{/* 3. NFT COLLATERAL & INSTANT LENDING LIMIT */}
						<div class="bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-emerald-500/15 border border-emerald-500/30 rounded-[28px] p-4.5 shadow-xl backdrop-blur-2xl">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<div class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
										<span class="material-symbols-outlined text-base">account_balance</span>
									</div>
									<div>
										<h3 class="text-xs font-black text-white">{t('numbers.collateralTitle')}</h3>
										<span class="text-[10px] text-emerald-400 font-bold">55% LTV DeFi Credit Line</span>
									</div>
								</div>
								<div class="text-right rtl:text-left">
									<div class="text-sm font-mono font-black text-emerald-400">
										{formatTon(reportData()?.collateral_value_ton)} TON
									</div>
									<div class="text-[9px] text-white/40 font-mono">
										≈ {formatUsd(reportData()?.collateral_value_usd)}
									</div>
								</div>
							</div>
							<p class="text-[10px] text-white/60 leading-relaxed mt-1">
								{t('numbers.collateralDesc')}
							</p>
						</div>

						{/* 4. EXACT RARITY DNA (Signature Feature) */}
						<div class="bg-[#12141C]/80 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl">
							<div class="flex items-center justify-between mb-3">
								<div>
									<h3 class="text-sm font-black text-white flex items-center gap-1.5">
										⭐ {t('numbers.rarityDNA')}
										<span class="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
											EXACT (136,566 Total)
										</span>
									</h3>
									<p class="text-[10px] text-white/50 mt-0.5">
										{t('numbers.provenScarcity')}
									</p>
								</div>
							</div>

							<div class="space-y-3">
								<For each={reportData()?.rarity_dna || []}>
									{(bar) => (
										<div>
											<div class="flex items-center justify-between text-xs mb-1">
												<span class="font-bold text-white/80">
													{isRtl() ? bar.label_fa || bar.label_en : bar.label_en}
												</span>
												<span class="font-mono font-black text-[#0098EA]">{bar.value}</span>
											</div>
											<div class="w-full h-2 bg-white/10 rounded-full overflow-hidden">
												<div
													class="h-full bg-gradient-to-r from-[#0098EA] to-emerald-400 rounded-full transition-all duration-700"
													style={{ width: `${Math.max(15, bar.percentile)}%` }}
												/>
											</div>
											<div class="text-[9px] text-white/40 mt-0.5">{bar.description}</div>
										</div>
									)}
								</For>
							</div>
						</div>

						{/* 3. COLOR PREMIUM CARD */}
						<div class="bg-[#12141C]/80 backdrop-blur-2xl border border-white/10 rounded-[28px] p-4 flex items-center justify-between shadow-xl">
							<div class="flex items-center gap-3">
								<div
									class="w-10 h-10 rounded-2xl shadow-lg flex items-center justify-center font-bold text-xs"
									style={{ 'background-color': reportData()?.color?.hex || '#3498DB' }}
								/>
								<div>
									<div class="text-xs font-bold text-white/50">{t('numbers.colorTier')}</div>
									<div class="text-sm font-black text-white">
										{reportData()?.color?.name} Tier
									</div>
								</div>
							</div>
							<div class="text-right rtl:text-left">
								<div class="text-sm font-black text-emerald-400 font-mono">
									+{Math.round(((reportData()?.color?.multiplier || 1.0) - 1.0) * 100)}%
								</div>
								<div class="text-[10px] text-white/40">{t('numbers.hedonicPremium')}</div>
							</div>
						</div>

						{/* 4. CULTURAL RADAR CARD */}
						<div class="bg-[#12141C]/80 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl">
							<h3 class="text-sm font-black text-white mb-1">
								🌏 {t('numbers.culturalRadar')}
							</h3>
							<p class="text-[10px] text-white/50 mb-3">
								{t('numbers.targetRegionAffinity')}
							</p>

							<div class="space-y-2.5">
								<For each={reportData()?.cultural_radar || []}>
									{(item) => (
										<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
											<div class="flex items-center justify-between mb-1">
												<span class="text-xs font-black text-white">{item.market_name}</span>
												<span class="text-xs font-mono font-black text-emerald-400">
													{item.score} / 100
												</span>
											</div>
											<div class="text-[11px] font-bold text-[#0098EA]">
												{isRtl() ? item.verdict_fa : item.verdict_en}
											</div>
											<p class="text-[10px] text-white/50 mt-0.5 leading-relaxed">
												{isRtl() ? item.description_fa : item.description_en}
											</p>
										</div>
									)}
								</For>
							</div>
						</div>

						{/* 5. COMPARABLE HISTORICAL SALES (COMPS) */}
						<div class="bg-[#12141C]/80 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl">
							<h3 class="text-sm font-black text-white mb-1">
								📊 {t('numbers.comparableSales')}
							</h3>
							<p class="text-[10px] text-white/50 mb-3">
								{t('numbers.peerTransactions')}
							</p>

							<div class="space-y-2">
								<For each={reportData()?.comps || []}>
									{(comp) => (
										<div class="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
											<div>
												<span class="font-mono font-black text-white block" dir="ltr">
													{comp.number}
												</span>
												<span class="text-[10px] text-white/40">
													{comp.sale_date} · {comp.tail_class}
												</span>
											</div>
											<div class="text-right rtl:text-left">
												<span class="font-mono font-black text-white block">
													{formatTon(comp.price_ton)} TON
												</span>
												<span
													class={`text-[10px] font-bold ${
														comp.diff_percent >= 0 ? 'text-emerald-400' : 'text-rose-400'
													}`}
												>
													{comp.diff_percent >= 0 ? `+${comp.diff_percent}%` : `${comp.diff_percent}%`}
												</span>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>

						{/* 6. TRANSACTION ECONOMICS & NET PAYOUT */}
						<div class="bg-[#12141C]/80 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl">
							<h3 class="text-sm font-black text-white mb-1">💰 {t('numbers.economics')}</h3>
							<p class="text-[10px] text-white/50 mb-3">
								{t('numbers.royaltyFeeCalc')}
							</p>

							<div class="space-y-2 text-xs">
								<div class="flex items-center justify-between py-1 border-b border-white/5">
									<span class="text-white/60">{t('numbers.fragmentFee')}</span>
									<span class="font-mono font-bold text-rose-400">
										-{formatTon(reportData()?.economics?.fragment_fee_ton)} TON
									</span>
								</div>
								<div class="flex items-center justify-between py-1 pt-2">
									<span class="text-white font-bold">{t('numbers.netPayout')}</span>
									<div class="text-right rtl:text-left">
										<span class="font-mono font-black text-emerald-400 text-sm block">
											{formatTon(reportData()?.economics?.net_payout_ton)} TON
										</span>
										<span class="text-[10px] text-white/40 font-mono">
											({formatUsd(reportData()?.economics?.net_payout_usd)})
										</span>
									</div>
								</div>
							</div>
						</div>

						{/* 7. 12-MONTH VALUATION PROJECTIONS */}
						<div class="bg-[#12141C]/80 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl">
							<h3 class="text-sm font-black text-white mb-1">
								📈 {t('numbers.projections')}
							</h3>
							<p class="text-[10px] text-white/50 mb-3">
								{t('numbers.monteCarloScenarios')}
							</p>

							<div class="grid grid-cols-3 gap-2 text-center text-xs">
								<div class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
									<span class="text-[10px] font-bold text-rose-300 block mb-1">{t('numbers.bearMarket')}</span>
									<span class="font-mono font-black text-white text-xs block">
										{formatTon(reportData()?.projection?.bear_ton)} TON
									</span>
								</div>
								<div class="p-3 rounded-2xl bg-white/[0.04] border border-white/10">
									<span class="text-[10px] font-bold text-white/60 block mb-1">{t('numbers.baseMarket')}</span>
									<span class="font-mono font-black text-[#0098EA] text-xs block">
										{formatTon(reportData()?.projection?.base_ton)} TON
									</span>
								</div>
								<div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
									<span class="text-[10px] font-bold text-emerald-300 block mb-1">{t('numbers.bullMarket')}</span>
									<span class="font-mono font-black text-emerald-400 text-xs block">
										{formatTon(reportData()?.projection?.bull_ton)} TON
									</span>
								</div>
							</div>
						</div>

						{/* 8. ACTION TOOLBAR (WATCHLIST & STORY) */}
						<div class="bg-[#12141C]/80 backdrop-blur-2xl border border-white/10 rounded-[28px] p-4 flex items-center justify-between gap-2 shadow-xl">
							<button
								type="button"
								onClick={handleToggleWatchlist}
								disabled={watchLoading()}
								class={`flex-1 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
									isWatching()
										? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
										: 'bg-white/[0.06] text-white/80 hover:bg-white/10 border border-white/10'
								}`}
							>
								<span class="material-symbols-outlined text-sm">
									{isWatching() ? 'bookmark_added' : 'bookmark_add'}
								</span>
								<span>{isWatching() ? t('numbers.watching') : t('numbers.watchNumber')}</span>
							</button>

							<button
								type="button"
								onClick={handleShareToStory}
								class="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#0098EA] to-[#0070BA] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-[#0098EA]/20 active:scale-95 transition-all hover:brightness-110"
							>
								<span class="material-symbols-outlined text-sm">auto_awesome</span>
								<span>{t('numbers.shareStory')}</span>
							</button>

							<button
								type="button"
								onClick={handleCopyCertificate}
								class="px-3.5 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-white/80 text-xs font-bold transition-all active:scale-95"
								title={t('numbers.copyLink')}
							>
								<span class="material-symbols-outlined text-sm">
									{copiedCert() ? 'check' : 'content_copy'}
								</span>
							</button>
						</div>
					</div>
				</Show>
			</div>

			{/* Credit Store Sheet */}
			<CreditStoreSheet
				open={storeOpen()}
				onClose={() => setStoreOpen(false)}
				vertical="number"
			/>
		</div>
	);
};
