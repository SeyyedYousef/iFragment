import { useSearchParams } from '@solidjs/router';
import { type Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
	type CuriosityGateData,
	type NumberValuationResult,
	numbersApi,
} from '@/entities/numbers/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { copyToClipboard, shareToStory } from '@/shared/lib/telegram-native.js';
import { SearchTeaser, UnifiedPaywallGate } from '@/widgets/paywall/index.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

export const NumberReportPage: Component = () => {
	useTelegramBackButton(-1);
	const [searchParams] = useSearchParams();

	// Search & Input state
	const [inputNumber, setInputNumber] = createSignal(searchParams.n || '+888 8888 8888');
	const [isAnalyzing, setIsAnalyzing] = createSignal(false);
	const [analysisStep, setAnalysisStep] = createSignal(0);

	// Gate vs Unlocked State
	const [isUnlocked, setIsUnlocked] = createSignal(false);
	const [gateData, setGateData] = createSignal<CuriosityGateData | null>(null);
	const [reportData, setReportData] = createSignal<NumberValuationResult | null>(null);
	const [loading, setLoading] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	// Watchlist state
	const [isWatching, setIsWatching] = createSignal(false);
	const [watchLoading, setWatchLoading] = createSignal(false);

	// Certificate copy state
	const [copiedCert, setCopiedCert] = createSignal(false);

	// 3D Holographic Gyro Tilt State
	const [tilt, setTilt] = createSignal({ x: 0, y: 0, glossX: 50, glossY: 50 });
	let cardRef: HTMLDivElement | undefined;

	const handleMouseMove = (e: MouseEvent) => {
		if (!cardRef) return;
		const rect = cardRef.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;

		const tiltX = ((y - centerY) / centerY) * -12;
		const tiltY = ((x - centerX) / centerX) * 12;
		const glossX = (x / rect.width) * 100;
		const glossY = (y / rect.height) * 100;

		setTilt({ x: tiltX, y: tiltY, glossX, glossY });
	};

	const handleMouseLeave = () => {
		setTilt({ x: 0, y: 0, glossX: 50, glossY: 50 });
	};

	const handleTouchMove = (e: TouchEvent) => {
		if (!cardRef || e.touches.length === 0) return;
		const touch = e.touches[0];
		const rect = cardRef.getBoundingClientRect();
		const x = touch.clientX - rect.left;
		const y = touch.clientY - rect.top;
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;

		const tiltX = Math.max(-15, Math.min(15, ((y - centerY) / centerY) * -14));
		const tiltY = Math.max(-15, Math.min(15, ((x - centerX) / centerX) * 14));
		const glossX = Math.max(0, Math.min(100, (x / rect.width) * 100));
		const glossY = Math.max(0, Math.min(100, (y / rect.height) * 100));

		setTilt({ x: tiltX, y: tiltY, glossX, glossY });
	};

	onMount(() => {
		window.addEventListener('touchmove', handleTouchMove, { passive: true });
		window.addEventListener('touchend', handleMouseLeave);
	});

	onCleanup(() => {
		window.removeEventListener('touchmove', handleTouchMove);
		window.removeEventListener('touchend', handleMouseLeave);
	});

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
		if (!num) return;
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
			const gate = await numbersApi.getCuriosityGate(num);
			setGateData(gate);
		} catch (err: any) {
			setError(err?.message || 'Failed to connect to Telegram Telemint registry');
		} finally {
			setTimeout(() => {
				clearInterval(interval);
				setIsAnalyzing(false);
			}, 2600);
		}
	};

	const handleUnlockWithCredit = async () => {
		try {
			haptic.impact('medium');
			setLoading(true);
			const res = await numbersApi.unlockWithCredit(inputNumber());
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
		const num = (reportData()?.display_number || gateData()?.display_number || inputNumber()).replace(
			/\s+/g,
			'',
		);
		// Quad repeating digits (e.g. 8888 8888, 7777, etc.) -> Grail Gold
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
			};
		}
		// Sequential/Alternating (1234, 8989, etc.) -> Apex Purple
		if (num.includes('1234') || num.includes('8989') || num.includes('0101')) {
			return {
				name: 'APEX',
				badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
				gradient: 'from-[#AF52DE] via-[#8A2BE2] to-[#0098EA]',
				glowColor: 'rgba(175, 82, 222, 0.35)',
				border: 'border-purple-400/40',
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
			};
		}
		// Default -> Emerald Teal
		return {
			name: 'STANDARD',
			badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
			gradient: 'from-[#34C759] via-[#10B981] to-[#0098EA]',
			glowColor: 'rgba(52, 199, 89, 0.3)',
			border: 'border-emerald-500/30',
		};
	};

	return (
		<div class="pb-36 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Gradient Glows */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/20 via-[#AF52DE]/10 to-transparent blur-[90px] pointer-events-none z-0" />
			<div class="fixed bottom-20 right-0 w-80 h-80 bg-emerald-500/10 blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				{/* Top Search Input Bar */}
				<div
					class="bg-[#12141C]/80 backdrop-blur-2xl border border-white/10 rounded-[28px] p-2.5 mb-4 flex items-center gap-2 shadow-2xl"
					dir="ltr"
				>
					<div class="w-10 h-10 rounded-2xl bg-[#0098EA]/15 text-[#0098EA] flex items-center justify-center font-mono font-black text-sm border border-[#0098EA]/30">
						+888
					</div>
					<input
						type="text"
						value={inputNumber()}
						onInput={(e) => setInputNumber(e.currentTarget.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') handleRunAnalysis(inputNumber());
						}}
						placeholder="8888 8888 or 0123 4567"
						class="flex-1 bg-transparent text-white placeholder-white/30 text-base font-mono font-black focus:outline-none"
					/>
					<button
						type="button"
						onClick={() => handleRunAnalysis(inputNumber())}
						disabled={isAnalyzing()}
						class="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#0098EA] to-[#0070BA] hover:brightness-110 text-white text-xs font-black tracking-tight active:scale-95 transition-all shadow-md shadow-[#0098EA]/30"
					>
						{isAnalyzing() ? 'Analyzing...' : t('numbers.valuateBtn')}
					</button>
				</div>

				{/* Mystery hints computed locally from the raw query — zero price leakage */}
				<SearchTeaser vertical="number" value={inputNumber()} />

				<Show when={error()}>
					<div class="bg-red-500/10 border border-red-500/30 rounded-2xl p-3.5 mb-4 text-xs text-red-400 flex items-center gap-2">
						<span class="material-symbols-outlined text-base">error</span>
						<span>{error()}</span>
					</div>
				</Show>

				{/* ── STATE 1: ANALYZING SCAN ANIMATION ── */}
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

				{/* ── STATE 2 & 3: 3D HOLOGRAPHIC GYRO CARD (LOCKED OR UNLOCKED) ── */}
				<Show when={!isAnalyzing() && (gateData() || reportData())}>
					<div class="perspective-[1200px] mb-5">
						<div
							ref={cardRef}
							onMouseMove={handleMouseMove}
							onMouseLeave={handleMouseLeave}
							class={`relative w-full rounded-[32px] p-6 backdrop-blur-2xl border ${getNumberTheme().border} bg-gradient-to-b from-[#161925]/90 to-[#0A0C12]/95 shadow-2xl transition-transform duration-150 ease-out select-none cursor-pointer overflow-hidden`}
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
									<span class="text-[10px] font-mono text-white/40 uppercase tracking-wider">
										{'NV-v2.4'}
									</span>
								</div>

								<div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono font-bold text-white/70">
									<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
									<span>{t('numbers.supplyCount')}</span>
								</div>
							</div>

							{/* Monospace Phone Number */}
							<div class="text-center my-5 relative z-10">
								<h1 class="text-3xl xs:text-4xl font-black text-white font-mono tracking-tight drop-shadow-md">
									{reportData()?.display_number || gateData()?.display_number || inputNumber()}
								</h1>
								<span class="text-xs text-white/40 font-mono mt-1 block">
									{t('numbers.frozenAnonymous')}
								</span>
							</div>

							{/* Valuation Display (Locked vs Unlocked) */}
							<div class="bg-black/50 backdrop-blur-md rounded-2xl p-4 border border-white/10 relative z-10 mb-4">
								<div class="flex items-center justify-between mb-1">
									<span class="text-[10px] uppercase font-bold text-white/50 tracking-wider">
										{t('numbers.fairValue')}
									</span>
									<Show when={isUnlocked() && reportData()}>
										<span class="text-[11px] font-black text-emerald-400 font-mono flex items-center gap-1">
											<span class="material-symbols-outlined text-xs">verified</span>
											{reportData()?.confidence_score}% {t('numbers.confidence')}
										</span>
									</Show>
								</div>

								<Show
									when={isUnlocked() && reportData()}
									fallback={
										<div class="flex items-center justify-between py-1">
											<div class="text-2xl font-black text-white/30 filter blur-sm select-none font-mono">
												{'••••••••'} {t('common.ton')}
											</div>
											<span class="text-xs font-bold text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
												<span class="material-symbols-outlined text-sm">lock</span>
												{t('numbers.lockedIntel')}
											</span>
										</div>
									}
								>
									<div class="flex items-baseline gap-2">
										<span class="text-3xl font-black text-white font-mono">
											{formatTon(reportData()?.expected_ton)}
										</span>
										<span class="text-sm font-bold text-[#0098EA]">{t('common.ton')}</span>
										<span class="text-xs font-semibold text-white/40 ml-1 font-mono">
											({formatUsd(reportData()?.expected_usd)})
										</span>
									</div>
									<div class="text-[11px] text-white/40 font-mono mt-1 flex items-center gap-2">
										<span>
											Range: {formatTon(reportData()?.low_ton)} -{' '}
											{formatTon(reportData()?.high_ton)} TON
										</span>
										<span>·</span>
										<span>Rate: ${reportData()?.ton_usd_rate}/TON</span>
									</div>
								</Show>
							</div>

							{/* Card Footer */}
							<div class="flex items-center justify-between text-[10px] text-white/40 font-mono relative z-10">
								<span>{t('numbers.verifiedStamp')}</span>
								<span>
									{isUnlocked()
										? `CERT: ${reportData()?.certificate_id || 'IF-NUM-001'}`
										: 'TELEMINT REGISTRY'}
								</span>
							</div>
						</div>
					</div>
				</Show>

				{/* ── STATE 2: UNIFIED PAYWALL GATE (payment only) ── */}
				<Show when={!isAnalyzing() && !isUnlocked() && gateData()}>
					<div class="mb-6">
						<UnifiedPaywallGate
							vertical="number"
							onUnlock={handleUnlockWithCredit}
							unlocking={loading()}
							error={null}
						/>
					</div>
				</Show>

				{/* ── STATE 3: 14-SECTION UNLOCKED PREMIUM REPORT ── */}
				<Show when={isUnlocked() && reportData()}>
					<div class="space-y-4">
						{/* 1. Exact Rarity DNA (Signature Feature) */}
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

						{/* 2. Color Premium Card */}
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
							<div class="text-right">
								<div class="text-sm font-black text-emerald-400 font-mono">
									+{Math.round(((reportData()?.color?.multiplier || 1.0) - 1.0) * 100)}%
								</div>
								<div class="text-[10px] text-white/40">{t('numbers.hedonicPremium')}</div>
							</div>
						</div>

						{/* 3. Cultural Radar Card */}
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
											<p class="text-[10px] text-white/50 mt-0.5">
												{isRtl() ? item.description_fa : item.description_en}
											</p>
										</div>
									)}
								</For>
							</div>
						</div>

						{/* 4. Comparable Historical Sales (Comps) */}
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
												<span class="font-mono font-black text-white block">
													{comp.number}
												</span>
												<span class="text-[10px] text-white/40">
													{comp.sale_date} · {comp.tail_class}
												</span>
											</div>
											<div class="text-right">
												<span class="font-mono font-black text-white block">
													{formatTon(comp.price_ton)} TON
												</span>
												<span
													class={`text-[10px] font-bold ${comp.diff_percent >= 0 ? 'text-emerald-400' : 'text-rose-400'
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

						{/* 5. Transaction Economics & Net Payout */}
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
									<div class="text-right">
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

						{/* 6. 12-Month Valuation Projections */}
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

						{/* 7. Action Bar (Watchlist & Story) */}
						<div class="bg-[#12141C]/80 backdrop-blur-2xl border border-white/10 rounded-[28px] p-4 flex items-center justify-between gap-2 shadow-xl">
							<button
								type="button"
								onClick={handleToggleWatchlist}
								disabled={watchLoading()}
								class={`flex-1 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${isWatching()
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
		</div>
	);
};
