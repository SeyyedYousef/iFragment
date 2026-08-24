import { useSearchParams } from '@solidjs/router';
import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { numbersApi, type CuriosityGateData, type NumberValuationResult } from '@/entities/numbers/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { copyToClipboard, openTelegramLink, shareToStory } from '@/shared/lib/telegram-native.js';

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

	// Watchlist state (Sacred Rule 4: only allowed post-purchase)
	const [isWatching, setIsWatching] = createSignal(false);
	const [watchLoading, setWatchLoading] = createSignal(false);

	// Certificate copy state
	const [copiedCert, setCopiedCert] = createSignal(false);

	const ANALYSIS_STEPS = [
		'Connecting to Telemint Smart Contracts...',
		'Querying 136,566 Closed Collection Matrix...',
		'Extracting 11 Structural & Mathematical Features...',
		'Running Hedonic Regression & Bayesian Shrinkage...',
	];

	// Run initial analysis on load
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

		// Animate analysis steps for 3 seconds
		const interval = setInterval(() => {
			setAnalysisStep((prev) => {
				if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
				return prev;
			});
		}, 700);

		try {
			const gate = await numbersApi.getCuriosityGate(num);
			setGateData(gate);
		} catch (err: any) {
			setError(err?.message || 'Failed to connect to Telegram Telemint registry');
		} finally {
			setTimeout(() => {
				clearInterval(interval);
				setIsAnalyzing(false);
			}, 3000);
		}
	};

	const handleUnlockWithCoins = async () => {
		try {
			haptic.impact('medium');
			setLoading(true);
			const res = await numbersApi.unlockWithCoins(inputNumber());
			setReportData(res);
			setIsUnlocked(true);
			haptic.notify('success');
		} catch (err: any) {
			haptic.notify('error');
			setError(err?.message || 'Failed to unlock with Airdrop coins');
		} finally {
			setLoading(false);
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
		} catch (err: any) {
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

	const handleShareToChat = () => {
		if (!reportData()) return;
		haptic.impact('light');
		const numClean = reportData()!.number.replace(/\s+/g, '');
		const text = `💎 Official iFragment AI Valuation for ${reportData()!.display_number}:\n\n` +
			`• Fair Valuation: ${formatTon(reportData()!.expected_ton)} TON (~${formatUsd(reportData()!.expected_usd)})\n` +
			`• Deterministic Rarity: ${reportData()!.rarity_dna[0]?.value || 'Top Tier'}\n` +
			`• Verified Certificate ID: ${reportData()!.certificate_id}\n\n` +
			`Check full valuation and risk audit here:`;
		const shareUrl = `https://t.me/iFragmentBot/iFragment?startapp=number_${numClean.replace('+', '')}`;
		openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`);
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
		return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	return (
		<div class="pb-36 bg-[#07080c] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Gradient Glows */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/15 via-transparent to-transparent blur-3xl pointer-events-none z-0" />

			<div class="relative z-10 max-w-md mx-auto px-4 pt-4">
				{/* Top Search Input Bar */}
				<div class="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-2xl p-2 mb-4 flex items-center gap-2 shadow-xl">
					<div class="w-9 h-9 rounded-xl bg-[#0098EA]/15 text-[#0098EA] flex items-center justify-center font-mono font-bold text-sm">
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
						class="flex-1 bg-transparent text-white placeholder-white/30 text-sm font-mono font-bold focus:outline-none"
					/>
					<button
						onClick={() => handleRunAnalysis(inputNumber())}
						disabled={isAnalyzing()}
						class="px-4 py-2 rounded-xl bg-[#0098EA] hover:bg-[#0080c7] text-white text-xs font-black tracking-tight active:scale-95 transition-all shadow-md shadow-[#0098EA]/30"
					>
						{isAnalyzing() ? 'Analyzing...' : 'Valuate'}
					</button>
				</div>

				<Show when={error()}>
					<div class="bg-red-500/10 border border-red-500/30 rounded-2xl p-3.5 mb-4 text-xs text-red-400 flex items-center gap-2">
						<span class="material-symbols-outlined text-base">error</span>
						<span>{error()}</span>
					</div>
				</Show>

				{/* ── STATE 1: ANALYZING SCAN ANIMATION ── */}
				<Show when={isAnalyzing()}>
					<div class="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 mb-6 text-center relative overflow-hidden">
						<div class="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#0098EA] to-[#00c6ff] mx-auto mb-4 flex items-center justify-center shadow-lg shadow-[#0098EA]/40 animate-pulse">
							<span class="material-symbols-outlined text-white text-3xl">psychology</span>
						</div>

						<h2 class="text-lg font-black text-white mb-1">
							{t('numbers.engineScanning' as any) || 'NV Engine Deep Scan'}
						</h2>
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
							Processing 136,566 Telemint contracts on TON
						</div>
					</div>
				</Show>

				{/* ── STATE 2: CURIOSITY PAYWALL GATE (SACRED RULE 3: ZERO PRICE LEAKAGE) ── */}
				<Show when={!isAnalyzing() && !isUnlocked() && gateData()}>
					<div class="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-3xl p-5 mb-6 shadow-2xl relative overflow-hidden">
						{/* Curiosity Teaser Header */}
						<div class="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
							<div>
								<span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									Analysis Ready
								</span>
								<h2 class="text-xl font-black text-white font-mono mt-1">
									{gateData()?.display_number}
								</h2>
							</div>
							<div class="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center">
								<span class="material-symbols-outlined text-xl">lock</span>
							</div>
						</div>

						{/* Curiosity Counters (Pure stats, strictly zero valuation numbers) */}
						<div class="grid grid-cols-3 gap-2 mb-6">
							<div class="bg-black/30 rounded-2xl p-3 text-center border border-white/5">
								<div class="text-lg font-black text-emerald-400">27</div>
								<div class="text-[10px] font-bold text-white/50 mt-0.5">Signals Evaluated</div>
							</div>
							<div class="bg-black/30 rounded-2xl p-3 text-center border border-white/5">
								<div class="text-lg font-black text-amber-400">2</div>
								<div class="text-[10px] font-bold text-white/50 mt-0.5">Risk Flags Checked</div>
							</div>
							<div class="bg-black/30 rounded-2xl p-3 text-center border border-white/5">
								<div class="text-lg font-black text-[#0098EA]">4</div>
								<div class="text-[10px] font-bold text-white/50 mt-0.5">On-Chain Sources</div>
							</div>
						</div>

						<p class="text-xs text-white/70 font-medium text-center mb-6 leading-relaxed">
							{t('numbers.paywallCuriosityText' as any) ||
								'گزارش جامع ارزش‌گذاری NV Engine، کمیابی قطعی در میان ۱۳۶,۵۶۶ شماره، تحلیل فرهنگی ارقام و راهنمای مدیریت دارایی با موفقیت تولید شد.'}
						</p>

						{/* Payment Selection Channels */}
						<div class="space-y-2.5">
							{/* Option 1: Shared Intel Credit */}
							<button
								onClick={handleUnlockWithCredit}
								disabled={loading()}
								class="w-full p-3.5 rounded-2xl bg-gradient-to-r from-[#0098EA] to-[#0070b8] hover:from-[#00a8ff] hover:to-[#0080c7] text-white flex items-center justify-between shadow-lg shadow-[#0098EA]/20 active:scale-[0.99] transition-all"
							>
								<div class="flex items-center gap-2.5">
									<span class="material-symbols-outlined text-lg">bolt</span>
									<div class="text-left">
										<div class="text-xs font-black">Unlock with 1 Intel Credit</div>
										<div class="text-[10px] text-white/70">Universal credit for Usernames & Numbers</div>
									</div>
								</div>
								<span class="text-xs font-black px-2 py-1 bg-black/20 rounded-lg">1 Credit</span>
							</button>

							{/* Option 2: Airdrop Coins (50% First Report Discount) */}
							<button
								onClick={handleUnlockWithCoins}
								disabled={loading()}
								class="w-full p-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white flex items-center justify-between active:scale-[0.99] transition-all"
							>
								<div class="flex items-center gap-2.5">
									<span class="material-symbols-outlined text-lg text-amber-400">monetization_on</span>
									<div class="text-left">
										<div class="text-xs font-black">Unlock with Airdrop Coins</div>
										<div class="text-[10px] text-white/50">First report 50% discount (7,500 Coins)</div>
									</div>
								</div>
								<span class="text-xs font-black text-amber-400">7,500 🪙</span>
							</button>

							{/* Option 3: Telegram Stars 3-Pack */}
							<button
								onClick={handleUnlockWithCredit}
								disabled={loading()}
								class="w-full p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-white/70 flex items-center justify-between text-xs font-bold transition-all"
							>
								<span>⭐ Buy 3 Intel Credits (100 Stars)</span>
								<span class="text-[10px] text-emerald-400 uppercase font-black">No KYC</span>
							</button>

							{/* Option 4: Free Unlock via Community / Sponsor Task */}
							<button
								onClick={() => {
									haptic.impact('light');
									openTelegramLink('https://t.me/iFragmentBot?start=task_number_unlock');
								}}
								class="w-full p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 flex items-center justify-between text-xs font-bold transition-all"
							>
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-base">task_alt</span>
									<span>🎁 Free Unlock via Sponsor Task</span>
								</div>
								<span class="text-[10px] text-emerald-300 font-extrabold uppercase">Free 0 TON</span>
							</button>
						</div>
					</div>
				</Show>

				{/* ── STATE 3: 14-SECTION UNLOCKED PREMIUM REPORT ── */}
				<Show when={isUnlocked() && reportData()}>
					{/* 1. Verdict Card */}
					<div class="bg-gradient-to-br from-[#0098EA]/20 via-[#0d1424] to-black/60 backdrop-blur-2xl border border-[#0098EA]/40 rounded-3xl p-5 mb-4 shadow-2xl relative overflow-hidden">
						<div class="flex items-center justify-between mb-3">
							<div class="flex items-center gap-2">
								<span class="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#0098EA]/30 text-white border border-[#0098EA]/50">
									Verified Valuation
								</span>
								<span class="text-[10px] font-mono text-white/40">NV-v2.4</span>
							</div>

							{/* Confidence Ring */}
							<div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-black font-mono">
								<span class="material-symbols-outlined text-xs">verified</span>
								{reportData()?.confidence_score}% Confidence
							</div>
						</div>

						{/* Number Title */}
						<h1 class="text-2xl font-black text-white font-mono tracking-tight mb-2">
							{reportData()?.display_number}
						</h1>

						{/* Expected Price Range */}
						<div class="bg-black/40 rounded-2xl p-4 border border-white/10 mb-3">
							<div class="text-[11px] font-bold text-white/50 mb-1">
								{t('numbers.expectedBand' as any) || 'Fair Valuation Band (TON)'}
							</div>
							<div class="text-2xl font-black text-white font-mono flex items-baseline gap-2">
								<span>{formatTon(reportData()?.low_ton)}</span>
								<span class="text-white/40 text-sm font-normal">~</span>
								<span class="text-[#0098EA]">{formatTon(reportData()?.expected_ton)}</span>
								<span class="text-white/40 text-sm font-normal">~</span>
								<span>{formatTon(reportData()?.high_ton)}</span>
								<span class="text-xs font-bold text-[#0098EA] ml-1">TON</span>
							</div>
							<div class="text-xs font-medium text-white/40 mt-1">
								≈ {formatUsd(reportData()?.expected_usd)} USD (Rate: ${reportData()?.ton_usd_rate}/TON)
							</div>
						</div>

						{/* Price Basis Chip */}
						<div class="flex items-center justify-between text-[10px] text-white/50 font-mono">
							<span>Basis: {reportData()?.price_basis}</span>
							<span>Data Freshness: Today</span>
						</div>
					</div>

					{/* 2. Rarity DNA Card (Signature Feature: Exact Deterministic Scarcity) */}
					<div class="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-5 mb-4">
						<div class="flex items-center justify-between mb-3">
							<div>
								<h3 class="text-sm font-black text-white flex items-center gap-1.5">
									⭐ {t('numbers.rarityDNA' as any) || 'Exact Rarity DNA'}
									<span class="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
										EXACT (136,566 Total)
									</span>
								</h3>
								<p class="text-[10px] text-white/50">
									Mathematically proven scarcity across the frozen collection
								</p>
							</div>
						</div>

						{/* 6-8 Horizontal DNA Bars */}
						<div class="space-y-3">
							<For each={reportData()?.rarity_dna || []}>
								{(bar) => (
									<div>
										<div class="flex items-center justify-between text-xs mb-1">
											<span class="font-bold text-white/80">{bar.label_fa || bar.label_en}</span>
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

					{/* 3. Color Premium Card */}
					<div class="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-4 mb-4 flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div
								class="w-10 h-10 rounded-2xl shadow-lg flex items-center justify-center font-bold text-xs"
								style={{ 'background-color': reportData()?.color?.hex || '#3498DB' }}
							/>
							<div>
								<div class="text-xs font-bold text-white/50">On-Chain NFT Color</div>
								<div class="text-sm font-black text-white">{reportData()?.color?.name} Tier</div>
							</div>
						</div>
						<div class="text-right">
							<div class="text-sm font-black text-emerald-400 font-mono">
								+{Math.round(((reportData()?.color?.multiplier || 1.0) - 1.0) * 100)}%
							</div>
							<div class="text-[10px] text-white/40">Hedonic Premium</div>
						</div>
					</div>

					{/* 4. Cultural Radar Card */}
					<div class="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-5 mb-4">
						<h3 class="text-sm font-black text-white mb-1">
							🌏 {t('numbers.culturalRadar' as any) || 'Cultural Desirability Radar'}
						</h3>
						<p class="text-[10px] text-white/50 mb-3">
							Target region digit affinity & buyer appeal analysis
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
										<div class="text-[11px] font-bold text-[#0098EA]">{item.verdict_fa}</div>
										<p class="text-[10px] text-white/50 mt-0.5">{item.description_fa}</p>
									</div>
								)}
							</For>
						</div>
					</div>

					{/* 5. Comps Card */}
					<div class="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-5 mb-4">
						<h3 class="text-sm font-black text-white mb-1">
							📊 {t('numbers.comparableSales' as any) || 'Comparable Historical Sales'}
						</h3>
						<p class="text-[10px] text-white/50 mb-3">
							Peer transactions matching pattern class and max runs
						</p>

						<div class="space-y-2">
							<For each={reportData()?.comps || []}>
								{(comp) => (
									<div class="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
										<div>
											<div class="text-xs font-mono font-black text-white">{comp.number}</div>
											<div class="text-[10px] text-white/40">{comp.tail_class}</div>
										</div>
										<div class="text-right">
											<div class="text-xs font-mono font-black text-[#0098EA]">
												{formatTon(comp.price_ton)} TON
											</div>
											<div class="text-[9px] text-white/40">{formatUsd(comp.price_usd)}</div>
										</div>
									</div>
								)}
							</For>
						</div>
					</div>

					{/* 6. Honest Risk Audit Card */}
					<div class="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-5 mb-4">
						<h3 class="text-sm font-black text-white mb-2 flex items-center gap-1.5">
							<span class="material-symbols-outlined text-amber-400 text-base">shield</span>
							{t('numbers.riskAuditTitle' as any) || 'Honest Risk Audit'}
						</h3>

						<div class="space-y-2 text-xs">
							<div class="p-3 rounded-2xl bg-black/30 border border-white/5">
								<div class="text-white/60 font-bold mb-0.5">Ownership Churn</div>
								<div class="text-white font-medium">{reportData()?.risk_audit?.ownership_churn}</div>
							</div>
							<div class="p-3 rounded-2xl bg-black/30 border border-white/5">
								<div class="text-white/60 font-bold mb-0.5">Restriction & Ban Safety</div>
								<div class="text-emerald-400 font-medium">
									{reportData()?.risk_audit?.restricted_risk}
								</div>
								<div class="text-[10px] text-white/40 mt-1">
									{reportData()?.risk_audit?.restricted_guide}
								</div>
							</div>
						</div>
					</div>

					{/* 7. Transaction Economics & Auction Playbook */}
					<div class="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-5 mb-4">
						<h3 class="text-sm font-black text-white mb-3">
							⚖️ {t('numbers.economicsTitle' as any) || 'Fragment Economics & Auction Playbook'}
						</h3>

						<div class="grid grid-cols-2 gap-2 mb-3">
							<div class="bg-black/30 p-3 rounded-2xl border border-white/5">
								<div class="text-[10px] text-white/50 font-bold">Min Starting Bid</div>
								<div class="text-sm font-black text-white font-mono">
									{formatTon(reportData()?.economics?.min_bid_ton)} TON
								</div>
							</div>
							<div class="bg-black/30 p-3 rounded-2xl border border-white/5">
								<div class="text-[10px] text-white/50 font-bold">Recommended Buy Now</div>
								<div class="text-sm font-black text-emerald-400 font-mono">
									{formatTon(reportData()?.economics?.buy_now_ton)} TON
								</div>
							</div>
						</div>

						<div class="p-3 rounded-2xl bg-[#0098EA]/10 border border-[#0098EA]/20 text-xs flex items-center justify-between">
							<span class="text-white/70 font-medium">Net Payout (After 5% Fragment Fee):</span>
							<span class="font-mono font-black text-white">
								{formatTon(reportData()?.economics?.net_payout_ton)} TON
							</span>
						</div>
					</div>

					{/* 8. Recommendation Verdict */}
					<div class="bg-gradient-to-r from-emerald-500/20 to-[#0098EA]/20 border border-emerald-500/30 rounded-3xl p-5 mb-4 text-center">
						<div class="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider mb-1">
							Strategic Verdict
						</div>
						<div class="text-2xl font-black text-white tracking-tight mb-1">
							{reportData()?.recommendation?.verdict}
						</div>
						<p class="text-xs text-white/70 leading-relaxed font-medium">
							{reportData()?.recommendation?.summary_fa}
						</p>
					</div>

					{/* 9. Official Certificate ID & Social Share Showcase */}
					<div class="bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-3xl p-5 mb-4 space-y-4">
						<div class="flex items-center justify-between">
							<div>
								<div class="text-[10px] text-white/40 uppercase font-bold">Official Certificate ID</div>
								<div class="text-xs font-mono font-black text-white">
									{reportData()?.certificate_id}
								</div>
							</div>
							<button
								onClick={handleCopyCertificate}
								class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all"
							>
								{copiedCert() ? 'Copied! ✓' : 'Copy'}
							</button>
						</div>

						{/* Telegram Native Share Buttons */}
						<div class="grid grid-cols-2 gap-2 pt-1">
							<button
								onClick={handleShareToStory}
								class="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-[#0098EA]/20 to-[#00c6ff]/20 hover:from-[#0098EA]/30 hover:to-[#00c6ff]/30 border border-[#0098EA]/40 text-xs font-black text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all"
							>
								<span class="material-symbols-outlined text-base text-[#0098EA]">history_toggle_off</span>
								Post Story
							</button>
							<button
								onClick={handleShareToChat}
								class="py-2.5 px-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-black text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all"
							>
								<span class="material-symbols-outlined text-base text-[#0098EA]">send</span>
								Share Card
							</button>
						</div>

						{/* Watchlist Toggle (Sacred Rule 4) */}
						<div class="pt-3 border-t border-white/10 flex items-center justify-between">
							<div>
								<div class="text-xs font-black text-white">Monitor This Number</div>
								<div class="text-[10px] text-white/50">Instant alerts on Fragment bids & sales</div>
							</div>
							<button
								onClick={handleToggleWatchlist}
								disabled={watchLoading()}
								class={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
									isWatching()
										? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
										: 'bg-white/10 text-white hover:bg-white/20'
								}`}
							>
								{isWatching() ? 'Watching ✓' : 'Watch +'}
							</button>
						</div>
					</div>

					{/* 10. Footer Disclaimer */}
					<div class="text-center text-[10px] text-white/30 space-y-1 mb-8">
						<p>NV Engine v2.4 · Deterministic Bayesian Valuation on TON</p>
						<p>Report valid for 24 hours · Back-safe verified</p>
					</div>
				</Show>
			</div>
		</div>
	);
};
