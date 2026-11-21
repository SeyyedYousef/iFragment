import { useNavigate, useSearchParams } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, onMount, Show } from 'solid-js';
import {
	type CuriosityGateData,
	type NumberValuationResult,
	numbersApi,
} from '@/entities/numbers/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import {
	FragKV,
	FragStatusPill,
	normalizeFragStatus,
	TonAmount,
	TonIcon,
} from '@/shared/ui/fragment/FragmentPrimitives.js';
import { CreditStoreSheet, UnifiedPaywallGate, useWallet } from '@/widgets/paywall/index.js';
import { NumberDialpadErgonomics } from '../../collection/ui/components/NumberDialpadErgonomics.js';
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

type ReportTabKey = 'valuation' | 'siblings' | 'onchain';

const QUICK_BENCHMARK_NUMBERS = [
	{ raw: '+888 0888 8888', labelKey: 'numReportPage.bench1', badge: 'GRAIL' },
	{ raw: '+888 8 888', labelKey: 'numReportPage.bench2', badge: 'GENESIS #1' },
	{ raw: '+888 0000 0000', labelKey: 'numReportPage.bench3', badge: 'GRAIL' },
	{ raw: '+888 8 115', labelKey: 'numReportPage.bench4', badge: 'RESTRICTED' },
	{ raw: '+888 0777 7777', labelKey: 'numReportPage.bench5', badge: 'APEX' },
];

function toAsciiDigits(str: string): string {
	return str
		.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
		.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
}

function validateAndFormatAnonymousNumber(raw: string): NumberValidation {
	const asciiRaw = toAsciiDigits(raw || '');
	const trimmed = asciiRaw.trim();
	const empty: NumberValidation = {
		isValid: false,
		error: null,
		formatted: '',
		cleanDigits: '',
		suffix: '',
		tier: 'STANDARD',
		patternLabel: '',
	};
	if (!trimmed) return empty;

	if (/[^0-9+\s\-()]/.test(trimmed)) {
		return { ...empty, error: t('numbers.errorInvalidChars'), formatted: trimmed };
	}

	if (trimmed.startsWith('+') && !trimmed.startsWith('+888')) {
		return { ...empty, error: t('numbers.errorInvalidPrefix'), formatted: trimmed };
	}

	const clean = trimmed.replace(/\D/g, '');
	const suffix = clean.startsWith('888') ? clean.slice(3) : clean;

	if (suffix.length === 0) {
		return {
			...empty,
			error: trimmed.startsWith('+888') ? t('numbers.errorTooShort') : null,
			formatted: '+888',
			cleanDigits: clean,
		};
	}

	if (suffix.length !== 4 && suffix.length !== 8) {
		return {
			...empty,
			error:
				suffix.length < 4
					? t('numbers.errorTooShort')
					: suffix.length > 8
						? t('numbers.errorTooLong')
						: t('numbers.errorInvalidLength') || 'Anonymous numbers must be 4 or 8 digits',
			formatted:
				suffix.length > 4 ? `+888 ${suffix.slice(0, 4)} ${suffix.slice(4)}` : `+888 ${suffix}`,
			cleanDigits: clean,
			suffix,
		};
	}

	if (suffix.length === 4) {
		const val = parseInt(suffix, 10);
		if (Number.isNaN(val) || val < 8000 || val > 8999) {
			return {
				...empty,
				error:
					t('numbers.errorGenesisRange') ||
					'4-digit genesis numbers must be between +888 8 000 and +888 8 999',
				formatted: `+888 ${suffix[0]} ${suffix.slice(1)}`,
				cleanDigits: clean,
				suffix,
			};
		}
	}

	const formatted =
		suffix.length === 4
			? `+888 ${suffix[0]} ${suffix.slice(1)}`
			: `+888 ${suffix.slice(0, 4)} ${suffix.slice(4)}`;

	let tier: 'GRAIL' | 'APEX' | 'GRAND' | 'STANDARD' = 'STANDARD';
	let patternLabel = 'Standard Collection';

	if (
		suffix.length === 4 ||
		suffix.includes('8888') ||
		suffix.includes('7777') ||
		suffix.includes('0000') ||
		suffix.includes('9999') ||
		suffix.includes('1111') ||
		(suffix.length === 8 && new Set(suffix).size === 1)
	) {
		tier = 'GRAIL';
		patternLabel = suffix.length === 4 ? '4-Digit Genesis' : 'Quad / Monodigit Grail';
	} else if (/012|123|234|345|456|567|678|789/.test(suffix)) {
		tier = 'APEX';
		patternLabel = 'Sequential Ladder';
	} else if (
		suffix.endsWith('888') ||
		suffix.endsWith('777') ||
		suffix.endsWith('000') ||
		(suffix.length >= 4 && suffix === [...suffix].reverse().join(''))
	) {
		tier = 'GRAND';
		patternLabel = 'Triple / Mirror Palindrome';
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

	const [inputNumber, setInputNumber] = createSignal(
		searchParams.n || searchParams.number || searchParams.num || '+888 0888 8888',
	);
	const [activeTab, setActiveTab] = createSignal<ReportTabKey>('valuation');
	const [isAnalyzing, setIsAnalyzing] = createSignal(false);
	const [isUnlocked, setIsUnlocked] = createSignal(false);
	const [gateData, setGateData] = createSignal<CuriosityGateData | null>(null);
	const [reportData, setReportData] = createSignal<NumberValuationResult | null>(null);
	const [loading, setLoading] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const [storeOpen, setStoreOpen] = createSignal(false);
	const [isWatching, setIsWatching] = createSignal(false);
	const [watchLoading, setWatchLoading] = createSignal(false);
	const [customOfferPct, setCustomOfferPct] = createSignal(93);

	const validation = createMemo(() => validateAndFormatAnonymousNumber(inputNumber()));

	const handleRunAnalysis = async (rawTarget?: string) => {
		const target = rawTarget !== undefined ? rawTarget : inputNumber();
		const val = validateAndFormatAnonymousNumber(target);
		if (!val.isValid) {
			setError(val.error || t('numbers.errorInvalidChars'));
			try {
				haptic.notify('error');
			} catch {}
			return;
		}

		setInputNumber(val.formatted);
		setIsAnalyzing(true);
		setIsUnlocked(false);
		setError(null);

		try {
			const gate = await numbersApi.getCuriosityGate(val.cleanDigits);
			setGateData(gate);

			try {
				const unlocked = await numbersApi.getValuation(val.cleanDigits);
				if (
					unlocked &&
					(Number(unlocked.expected_ton) > 0 ||
						Number(unlocked.base_price_ton) > 0 ||
						unlocked.run_id > 0)
				) {
					setReportData(unlocked);
					setIsUnlocked(true);
				}
			} catch {
				// Locked until credit consumed
			}
		} catch (err: any) {
			setError(err?.message || 'Failed to connect to Telegram TeleMint registry');
		} finally {
			setIsAnalyzing(false);
		}
	};

	onMount(() => {
		void handleRunAnalysis(inputNumber());
	});

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
			try {
				haptic.notify('success');
			} catch {}
		} catch (err: any) {
			try {
				haptic.notify('error');
			} catch {}
			setError(
				err?.response?.data?.error ||
					err?.response?.data?.message ||
					err?.message ||
					t('valuation.unlock_error') ||
					'Error unlocking report with credit.',
			);
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

	const formatTon = (val?: number | string) => {
		if (val === undefined || val === null || val === '') return '0';
		const num = typeof val === 'string' ? parseFloat(val) : val;
		if (Number.isNaN(num)) return '0';
		return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const formatUsd = (val?: number | string) => {
		if (val === undefined || val === null || val === '') return '0';
		const num = typeof val === 'string' ? parseFloat(val) : val;
		if (Number.isNaN(num)) return '0';
		return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const shortAddr = (addr?: string) => {
		if (!addr) return '—';
		if (addr.length <= 16) return addr;
		return `${addr.slice(0, 8)} … ${addr.slice(-8)}`;
	};

	const simulatedOfferStats = createMemo(() => {
		const r = reportData();
		const fairTon = Number(r?.expected_ton || 2717);
		const rate = r?.ton_usd_rate || 1.29;
		const offerTon = Math.round((fairTon * customOfferPct()) / 100);
		const offerUsd = Math.round(offerTon * rate);
		const protocolFeeTon = Math.round(offerTon * 0.05 * 10) / 10;
		const sellerNetTon = Math.round((offerTon - protocolFeeTon) * 10) / 10;
		const sellerNetUsd = Math.round(sellerNetTon * rate);
		return { offerTon, offerUsd, protocolFeeTon, sellerNetTon, sellerNetUsd };
	});

	const displayNum = () =>
		reportData()?.display_number ||
		gateData()?.display_number ||
		validation().formatted ||
		inputNumber();

	const cleanDigitsForUrl = () =>
		(validation().cleanDigits || inputNumber().replace(/\D/g, '')).replace(/^\+/, '');

	return (
		<div
			class="frag-canvas pb-32 text-white min-h-screen relative font-frag-sans overflow-x-hidden"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Authentic Fragment.com Sticky Detail Header (.tm-header) */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => navigate('/?tab=collectibles')}
					class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
				>
					<TonIcon size={20} color="#4db2ff" />
					<span class="text-[15px] font-bold tracking-[0.04em] hidden xs:inline" dir="ltr">
						FRAGMENT
					</span>
				</button>

				{/* Inline Header Number Search Box */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void handleRunAnalysis(inputNumber());
					}}
					class="flex-1 max-w-[300px] h-8 bg-[#242e38] hover:bg-[#293440] focus-within:bg-[#293440] rounded-[6px] px-2.5 flex items-center gap-1.5 transition-colors"
					dir="ltr"
				>
					<span class="material-symbols-outlined text-[16px] text-[#8a98a6]">search</span>
					<input
						type="text"
						value={inputNumber()}
						onInput={(e) => setInputNumber(e.currentTarget.value)}
						placeholder="+888 0888 8888"
						class="flex-1 min-w-0 bg-transparent text-[12.5px] font-mono font-semibold text-white placeholder:text-[#8a98a6] focus:outline-none"
					/>
					<Show when={inputNumber()}>
						<button
							type="button"
							onClick={() => setInputNumber('')}
							class="text-[#8c9aa9] hover:text-white"
						>
							<span class="material-symbols-outlined text-[14px]">close</span>
						</button>
					</Show>
				</form>

				<button
					type="button"
					onClick={() => navigate('/numbers/intel')}
					class="h-8 px-2.5 rounded-[6px] bg-[#293440] hover:bg-[#384553] text-white text-[12px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
				>
					<span class="material-symbols-outlined text-[15px] text-[#4db2ff]">table_chart</span>
					<span class="hidden sm:inline">{t('home.numbersIntel')}</span>
				</button>
			</header>

			<div class="max-w-[520px] mx-auto px-4 pt-4 flex flex-col gap-3.5 relative z-10">
				{/* Quick Benchmark Pills */}
				<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5" dir="ltr">
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
									class={`shrink-0 px-2.5 py-1 rounded-[6px] text-[11.5px] font-mono font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
										isSelected()
											? 'bg-[#248bda] text-white'
											: 'bg-[#212a33] hover:bg-[#293440] text-[#8c9aa9] hover:text-white'
									}`}
								>
									<span>{item.raw}</span>
								</button>
							);
						}}
					</For>
				</div>

				{/* Top Title Row: +888 XXXX XXXX + Status Badge on left, Fragment link on right */}
				<div class="flex items-center justify-between gap-2 flex-wrap pt-1">
					<div class="flex items-center gap-2.5 min-w-0" dir="ltr">
						<h1 class="text-[22px] sm:text-[24px] font-bold font-mono text-white tracking-[-0.015em] truncate">
							{displayNum()}
						</h1>
						<Show
							when={
								reportData()?.market_provenance?.is_restricted ||
								reportData()?.on_chain_audit?.is_restricted
							}
							fallback={
								<FragStatusPill
									status={normalizeFragStatus(
										reportData()?.live_listing?.status ||
											(reportData()?.market_provenance?.is_minted === false
												? 'unminted'
												: 'available'),
									)}
								/>
							}
						>
							<span class="px-2 py-0.5 rounded-[4px] bg-[#ff5863]/10 text-[#ff5863] text-[11.5px] font-semibold">
								{t('numReportPage.restrictedTag') || 'Restricted'}
							</span>
						</Show>
					</div>

					<div class="flex items-center gap-3 shrink-0">
						<Show when={isUnlocked() && reportData()}>
							<button
								type="button"
								onClick={handleToggleWatchlist}
								disabled={watchLoading()}
								class="text-[13px] font-semibold text-[#4db2ff] hover:underline flex items-center gap-1 cursor-pointer"
							>
								<span class="material-symbols-outlined text-[15px]">
									{isWatching() ? 'notifications_active' : 'notifications'}
								</span>
							</button>
						</Show>
						<a
							href={`https://fragment.com/number/${cleanDigitsForUrl()}`}
							target="_blank"
							rel="noreferrer"
							class="text-[13px] font-semibold text-[#4db2ff] hover:underline flex items-center gap-0.5"
						>
							<span>Fragment</span>
							<span class="material-symbols-outlined text-[14px]">north_east</span>
						</a>
					</div>
				</div>

				<Show when={error()}>
					<div class="bg-[#ff5863]/10 rounded-[8px] p-3 text-[12.5px] text-[#ff5863] flex items-center gap-2">
						<span class="material-symbols-outlined text-[16px]">error</span>
						<span>{error()}</span>
					</div>
				</Show>

				{/* Loading State */}
				<Show when={isAnalyzing()}>
					<div class="frag-card p-8 text-center flex flex-col items-center gap-3">
						<div class="w-8 h-8 rounded-full border-2 border-[#4db2ff]/25 border-t-[#4db2ff] animate-spin" />
						<span class="text-[14px] font-semibold text-white">{t('numbers.engineScanning')}</span>
						<span class="text-[12px] text-[#8794a1]">{t('numbers.telemintContracts')}</span>
					</div>
				</Show>

				{/* Pre-Unlock State */}
				<Show when={!isAnalyzing() && !isUnlocked()}>
					<div class="space-y-3.5">
						<div class="frag-table-container">
							<FragKV label="Anonymous Number" copyValue={displayNum()} accent>
								<span class="font-mono" dir="ltr">
									{displayNum()}
								</span>
							</FragKV>
							<FragKV label="Pattern Classification">
								{validation().patternLabel || validation().tier}
							</FragKV>
							<FragKV label="Collection">Telegram Anonymous Numbers (+888)</FragKV>
							<FragKV label="On-Chain Signals">
								{gateData()?.signals_analyzed || 48} verified signals
							</FragKV>
						</div>

						<UnifiedPaywallGate
							vertical="number"
							targetTitle={displayNum()}
							targetSubtitle={validation().patternLabel}
							targetIcon="tag"
							targetBadge={t('paywall.ready_for_appraisal')}
							unlockCtaText={t('paywall.cta_unlock_specific', { target: displayNum() })}
							onUnlock={handleUnlockWithCredit}
							unlocking={loading()}
							error={error()}
						/>
					</div>
				</Show>

				{/* Unlocked Report State */}
				<Show when={!isAnalyzing() && isUnlocked() && reportData()}>
					{(r) => (
						<div class="space-y-3.5">
							{/* Unminted Supply Alert (if number was never minted in Dec 2022) */}
							<Show when={r().market_provenance?.is_minted === false}>
								<div class="bg-[#212a33] border-l-4 border-[#ff9953] rounded-[8px] p-3.5 text-start space-y-2">
									<div class="flex items-center justify-between gap-2">
										<span class="text-[13px] font-semibold text-[#ff9953]">
											{t('numReportPage.unmintedCombinationDec2022Supply')}
										</span>
										<span class="text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#ff9953]/10 text-[#ff9953]">
											Unminted
										</span>
									</div>
									<p class="text-[12px] text-[#8794a1] leading-relaxed">
										{isRtl()
											? r().market_provenance?.minted_status_reason_fa
											: r().market_provenance?.minted_status_reason_en}
									</p>
									<Show
										when={(r().market_provenance?.suggested_minted_alternatives?.length || 0) > 0}
									>
										<div class="flex flex-wrap gap-1.5 pt-1" dir="ltr">
											<For each={r().market_provenance?.suggested_minted_alternatives || []}>
												{(alt) => (
													<button
														type="button"
														onClick={() => {
															setInputNumber(alt.display_number);
															void handleRunAnalysis(alt.display_number);
														}}
														class="px-2.5 py-1 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-[#4db2ff] font-mono text-[12px] font-semibold cursor-pointer"
													>
														{alt.display_number}
													</button>
												)}
											</For>
										</div>
									</Show>
								</div>
							</Show>

							{/* Restriction Warning Banner */}
							<Show
								when={r().market_provenance?.is_restricted || r().on_chain_audit?.is_restricted}
							>
								<div class="bg-[#212a33] border-l-4 border-[#ff5863] rounded-[8px] p-3.5 text-start">
									<div class="text-[13px] font-semibold text-[#ff5863] mb-1">
										{t('numReportPage.officialWarningThisNumberIs')}
									</div>
									<p class="text-[12px] text-[#8794a1] leading-relaxed">
										{isRtl()
											? r().market_provenance?.restriction_reason_fa ||
												r().risk_audit?.restricted_guide
											: r().market_provenance?.restriction_reason_en}
									</p>
								</div>
							</Show>

							{/* 1. Primary 3-Column Fragment Valuation Card (#212a33, 8px radius) */}
							<div class="frag-table-container">
								<div class="frag-table-header grid grid-cols-3 px-3.5 py-2">
									<span>Liquidation</span>
									<span>Fair Value</span>
									<span class="text-end">Suggested Ask</span>
								</div>
								<div class="grid grid-cols-3 px-3.5 py-3.5 items-start gap-2">
									<TonAmount
										value={formatTon(r().low_ton)}
										usd={formatUsd(r().low_usd)}
										size="md"
									/>
									<TonAmount
										value={formatTon(r().expected_ton)}
										usd={formatUsd(r().expected_usd)}
										size="lg"
										tone="positive"
									/>
									<div class="flex justify-end">
										<TonAmount
											value={formatTon(r().high_ton)}
											usd={formatUsd(r().high_usd)}
											size="md"
											class="items-end"
										/>
									</div>
								</div>
								<div class="px-3.5 py-2.5 border-t border-[#1a2026] flex items-center justify-between text-[12px] text-[#8c9aa9]">
									<span>
										Confidence: <strong class="text-white">{r().confidence_score || 92}%</strong>
									</span>
									<span>
										Rank:{' '}
										<strong class="text-[#4db2ff]">
											#{r().global_rank?.toLocaleString('en-US') || '—'}
										</strong>{' '}
										/ 136.5K
									</span>
									<span>
										Grade:{' '}
										<strong class="text-[#5aec8c]">
											{r().recommendation?.confidence_tier || 'A+'}
										</strong>
									</span>
								</div>
							</div>

							{/* Primary Action Buttons */}
							<div class="grid grid-cols-2 gap-2">
								<a
									href={
										r().live_listing?.direct_url ||
										r().fragment_direct_url ||
										`https://fragment.com/number/${cleanDigitsForUrl()}`
									}
									target="_blank"
									rel="noreferrer"
									class="frag-btn-primary h-10 px-4 rounded-[8px] text-[13.5px] font-semibold flex items-center justify-center gap-1.5"
								>
									<span>View on Fragment</span>
									<span class="material-symbols-outlined text-[15px]">north_east</span>
								</a>
								<button
									type="button"
									onClick={() => navigate('/numbers/mask')}
									class="frag-btn-secondary h-10 px-4 rounded-[8px] text-[13.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
								>
									<span class="material-symbols-outlined text-[16px] text-[#4db2ff]">dialpad</span>
									<span>{t('numbers.maskBuilderTitle')}</span>
								</button>
							</div>

							{/* 2. Fragment Key-Value Metadata Card (.tm-list) */}
							<div class="frag-table-container">
								<FragKV label="Anonymous Number" copyValue={displayNum()} accent>
									<span class="font-mono" dir="ltr">
										{displayNum()}
									</span>
								</FragKV>
								<FragKV label="Pattern Club">
									{r().pattern_anatomy?.club_name_en ||
										r().category_club ||
										validation().patternLabel}
								</FragKV>
								<Show when={r().market_provenance?.color_name_en}>
									<FragKV label="NFT Artwork Plate">
										<span class="inline-flex items-center gap-1.5">
											<Show when={r().market_provenance?.color_hex}>
												<span
													class="w-2.5 h-2.5 rounded-full inline-block"
													style={{
														'background-color': r().market_provenance?.color_hex,
													}}
												/>
											</Show>
											<span>
												{r().market_provenance?.color_name_en} (
												{r().market_provenance?.color_multiplier || 1}x)
											</span>
										</span>
									</FragKV>
								</Show>
								<Show when={r().live_listing?.ask_or_bid_ton}>
									<FragKV label="Live Market Ask / Bid">
										<TonAmount
											value={formatTon(r().live_listing?.ask_or_bid_ton)}
											usd={formatUsd(r().live_listing?.ask_or_bid_usd)}
											size="sm"
										/>
									</FragKV>
								</Show>
								<Show
									when={
										r().on_chain_audit?.real_owner_address ||
										r().telemint_provenance?.real_owner_address ||
										r().market_provenance?.owner_address
									}
								>
									{(ownerAddr) => (
										<FragKV
											label="Owner Wallet"
											copyValue={ownerAddr()}
											href={`https://tonviewer.com/${ownerAddr()}`}
											accent
										>
											<span class="font-mono">{shortAddr(ownerAddr())}</span>
										</FragKV>
									)}
								</Show>
							</div>

							{/* 3. Clean 3-Tab Fragment Section Bar */}
							<div class="flex items-center border-b border-[#293440] gap-5 px-1 pt-1">
								<For
									each={
										[
											{ id: 'valuation', label: 'Valuation & Offer' },
											{
												id: 'siblings',
												label: `Comparables (${(r().comps?.length || 0) + (r().pattern_siblings?.length || 0)})`,
											},
											{ id: 'onchain', label: 'History & On-Chain' },
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

							{/* TAB 1: VALUATION & INTERACTIVE OFFER CALCULATOR */}
							<Show when={activeTab() === 'valuation'}>
								<div class="space-y-3.5">
									<div class="frag-table-container">
										<div class="frag-table-header px-3.5 py-2">
											<span>Empirical Valuation Band</span>
										</div>
										<FragKV label="Collection Floor (+888)">
											<TonAmount value={formatTon(r().base_price_ton)} size="sm" />
										</FragKV>
										<FragKV label="P10 Liquidation Value">
											<TonAmount
												value={formatTon(r().liquidation_ton || r().low_ton)}
												usd={formatUsd(r().liquidation_usd || r().low_usd)}
												size="sm"
											/>
										</FragKV>
										<FragKV label="P50 Fair Market Value">
											<TonAmount
												value={formatTon(r().expected_ton)}
												usd={formatUsd(r().expected_usd)}
												size="sm"
												tone="positive"
											/>
										</FragKV>
										<FragKV label="P90 Strategic Ask">
											<TonAmount
												value={formatTon(r().suggested_ask_ton || r().high_ton)}
												usd={formatUsd(r().suggested_ask_usd || r().high_usd)}
												size="sm"
											/>
										</FragKV>
										<FragKV label="Liquidity & Exit Horizon">
											{r().liquidity?.liquidity_rating || 'High'} ·{' '}
											{r().liquidity?.estimated_sell_days || '2–5 days'}
										</FragKV>
									</div>

									{/* Minimalist Fragment Offer Calculator */}
									<div class="frag-card p-3.5 space-y-3">
										<div class="flex items-center justify-between">
											<span class="text-[13.5px] font-semibold text-white">
												Make an Offer Calculator ({customOfferPct()}%)
											</span>
											<TonAmount
												value={formatTon(simulatedOfferStats().offerTon)}
												usd={formatUsd(simulatedOfferStats().offerUsd)}
												size="sm"
												tone="positive"
											/>
										</div>
										<input
											type="range"
											min="75"
											max="115"
											step="1"
											value={customOfferPct()}
											onInput={(e) => setCustomOfferPct(parseInt(e.currentTarget.value, 10))}
											class="w-full accent-[#248bda] cursor-pointer"
										/>
										<div class="flex items-center justify-between text-[12px] text-[#8c9aa9] pt-1 border-t border-[#1a2026]">
											<span>Protocol Fee (5%): {simulatedOfferStats().protocolFeeTon} TON</span>
											<span>
												Seller Net:{' '}
												<strong class="text-white">
													{formatTon(simulatedOfferStats().sellerNetTon)} TON
												</strong>
											</span>
										</div>
									</div>

									{/* Combinatorial Scarcity & Pattern Anatomy */}
									<Show when={r().combinatorial_scarcity}>
										{(cs) => (
											<div class="frag-table-container">
												<div class="frag-table-header px-3.5 py-2 flex items-center justify-between">
													<span>Combinatorial Scarcity & Information Theory</span>
													<span class="font-mono text-[#4db2ff]">
														{cs().exact_pattern_pool_size.toLocaleString('en-US')} in{' '}
														{cs().total_supply.toLocaleString('en-US')}
													</span>
												</div>
												<FragKV label="Pattern Class">
													{isRtl()
														? r().pattern_anatomy?.pattern_type_fa || cs().scarcity_tier
														: r().pattern_anatomy?.pattern_type_en || cs().scarcity_tier}
												</FragKV>
												<FragKV label="Minted Supply Share">
													<span class="font-mono text-[#5aec8c]">
														{cs().pool_share_pct}% · {cs().mathematical_formula}
													</span>
												</FragKV>
												<Show when={r().pattern_anatomy}>
													{(pa) => (
														<FragKV label="Symmetry & Memorability">
															<span class="font-mono">
																Sym {pa().symmetry_score}/100 · Mem {pa().memorability_score}/100 ·
																Max Run {pa().max_run}
															</span>
														</FragKV>
													)}
												</Show>
											</div>
										)}
									</Show>

									{/* Multi-Regional Cultural Numerology Radar */}
									<NumberSingleCulturalRadarCard
										radar={r().cultural_radar}
										number={r().display_number || validation().formatted || inputNumber()}
									/>

									{/* DeFi Collateral & Rental Yield Financial Engineering */}
									<NumberFinancialEngineeringCard
										expectedTon={Number(r().expected_ton || 2717)}
										expectedUsd={r().expected_usd}
										tonUsdRate={r().ton_usd_rate || 1.29}
									/>

									{/* Interactive ITU-T E.161 / Q.23 Keypad Biomechanics */}
									<NumberDialpadErgonomics
										initialNumber={r().display_number || validation().formatted || inputNumber()}
									/>

									{/* Digital Certificate & Telegram Story / Chat Export */}
									<NumberDigitalCertificateCard
										certificateId={r().certificate_id}
										number={r().display_number || validation().formatted || inputNumber()}
										expectedTon={Number(r().expected_ton || 2717)}
										confidence={r().confidence_score}
									/>
								</div>
							</Show>

							{/* TAB 2: COMPARABLE SALES & PATTERN SIBLINGS */}
							<Show when={activeTab() === 'siblings'}>
								<div class="space-y-3.5">
									<div class="frag-table-container">
										<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
											<span class="col-span-6">Number</span>
											<span class="col-span-3">Price</span>
											<span class="col-span-3 text-end">Date / Status</span>
										</div>
										<Show
											when={(r().comps?.length || 0) > 0 || (r().pattern_siblings?.length || 0) > 0}
											fallback={
												<div class="p-6 text-center text-[13px] text-[#8c9aa9]">
													No comparable sales recorded for this pattern.
												</div>
											}
										>
											<For each={r().comps || []}>
												{(comp) => (
													<button
														type="button"
														onClick={() => {
															setInputNumber(comp.number);
															void handleRunAnalysis(comp.number);
														}}
														class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
													>
														<div
															class="col-span-6 font-mono font-semibold text-[13px] text-white truncate"
															dir="ltr"
														>
															{comp.number}
														</div>
														<div class="col-span-3">
															<TonAmount value={formatTon(comp.price_ton)} size="sm" />
														</div>
														<div class="col-span-3 text-end text-[11.5px] text-[#8c9aa9] truncate">
															{comp.sale_date}
														</div>
													</button>
												)}
											</For>
											<For each={r().pattern_siblings || []}>
												{(sib) => (
													<button
														type="button"
														onClick={() => {
															setInputNumber(sib.display_number || sib.number);
															void handleRunAnalysis(sib.display_number || sib.number);
														}}
														class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
													>
														<div
															class="col-span-6 font-mono font-semibold text-[13px] text-[#4db2ff] truncate"
															dir="ltr"
														>
															{sib.display_number || sib.number}
														</div>
														<div class="col-span-3">
															<Show
																when={sib.current_bid_or_ask_ton || sib.last_sale_ton}
																fallback={<span class="text-[12px] text-[#8c9aa9]">—</span>}
															>
																<TonAmount
																	value={formatTon(sib.current_bid_or_ask_ton || sib.last_sale_ton)}
																	size="sm"
																/>
															</Show>
														</div>
														<div class="col-span-3 flex justify-end">
															<FragStatusPill
																status={normalizeFragStatus(
																	sib.current_bid_or_ask_ton ? 'on_sale' : 'taken',
																)}
															/>
														</div>
													</button>
												)}
											</For>
										</Show>
									</div>
								</div>
							</Show>

							{/* TAB 3: HISTORY & TELEMINT ON-CHAIN PROVENANCE */}
							<Show when={activeTab() === 'onchain'}>
								<div class="space-y-3.5">
									<div class="frag-table-container">
										<div class="frag-table-header px-3.5 py-2">
											<span>TeleMint On-Chain Audit</span>
										</div>
										<Show
											when={
												r().market_provenance?.nft_address || r().telemint_provenance?.item_address
											}
										>
											{(addr) => (
												<FragKV
													label="NFT Item Address"
													copyValue={addr()}
													href={`https://tonviewer.com/${addr()}`}
													accent
												>
													<span class="font-mono">{shortAddr(addr())}</span>
												</FragKV>
											)}
										</Show>
										<FragKV
											label="Collection Contract"
											href="https://tonviewer.com/EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N"
											accent
										>
											<span class="font-mono">EQAOQdwd … vr9si5N</span>
										</FragKV>
										<FragKV label="Mint Provenance">
											{r().market_provenance?.is_minted === false
												? 'Unminted (Dec 2022 Cap)'
												: 'Verified TeleMint NFT'}
										</FragKV>
									</div>

									{/* TON Binary, 8421 BCD & ITU-T Q.23 DTMF Acoustic Forensics Matrix */}
									<Show when={r().binary_forensics}>
										{(bf) => (
											<div class="frag-table-container" dir="ltr">
												<div class="frag-table-header px-3.5 py-2 flex items-center justify-between">
													<span>TON TVM BOC, 8421 BCD & ITU-T Q.23 DTMF Forensics</span>
													<span class="font-mono text-[#4db2ff]">
														{bf().boc_magic_prefix || '0xb5ee9c72'}
													</span>
												</div>
												<FragKV label="UTF-8 ASCII Hex" copyValue={bf().utf8_hex}>
													<span class="font-mono text-[#4db2ff]">0x{bf().utf8_hex}</span>
												</FragKV>
												<FragKV label="8421 BCD Nibble Stream" copyValue={bf().bcd_stream}>
													<span class="font-mono text-[11px] text-[#5aec8c]">
														{bf().bcd_stream}
													</span>
												</FragKV>
												<FragKV label="BCD & ASCII Hamming Weight">
													<span class="font-mono">
														BCD: {bf().bcd_hamming_weight ?? '—'} bits · ASCII:{' '}
														{bf().total_hamming_weight} bits
														{bf().is_pure_msb_80_wave ? ' · Pure MSB 8/0 Wave' : ''}
													</span>
												</FragKV>
												<FragKV label="Shannon Entropy & Kolmogorov">
													<span class="font-mono">
														H = {bf().shannon_entropy_bits} / {bf().max_entropy_bits} bits · Comp{' '}
														{bf().kolmogorov_compression_pct}%
													</span>
												</FragKV>
												<FragKV label="Fitts's Law & Keypad Geometry">
													<span class="font-mono text-[#5aec8c]">
														ID {bf().fitts_index_bits ?? 0} bits · Ergo{' '}
														{bf().keypad_ergonomic_score}
														/100 · Manhattan {bf().keypad_manhattan_distance}
													</span>
												</FragKV>
												<FragKV label="ITU-T Q.23 DTMF Signature">
													<span class="font-mono text-[11px] text-[#4db2ff]">
														{bf().dtmf_acoustic_signature} (
														{Math.round(bf().dtmf_consonance_score || 85)}% consonance)
													</span>
												</FragKV>
												<FragKV
													label="TEP-62 SHA-256 Index"
													copyValue={bf().tep62_index_sha256_hex}
												>
													<span class="font-mono text-[11px]">
														{bf().tep62_index_sha256_hex.slice(0, 20)}…
													</span>
												</FragKV>
												<Show when={bf().token_name_boc_hex}>
													<FragKV
														label="TVM BOC Cell (Castagnoli CRC32-C)"
														copyValue={bf().token_name_boc_hex}
													>
														<span class="font-mono text-[11px] text-[#5aec8c]">
															{(bf().token_name_boc_hex || '').slice(0, 22)}… (
															{bf().crc32c_checksum_hex || 'CRC32-C'})
														</span>
													</FragKV>
												</Show>

												{/* Per-Digit 8421 BCD & DTMF Dual-Tone Frequency Table */}
												<Show when={(bf().digits_matrix?.length || 0) > 0}>
													<div class="p-3 border-t border-[#1a2026]">
														<span class="text-[10.5px] font-semibold text-[#8c9aa9] block mb-1.5">
															Per-Digit 8421 BCD Nibble & ITU-T Q.23 Dual-Tone Matrix
														</span>
														<div class="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
															<For each={bf().digits_matrix || []}>
																{(cell) => (
																	<div class="p-1.5 rounded-[6px] bg-[#1a2026] border border-[#293440] text-center font-mono">
																		<div class="text-[14px] font-bold text-white">{cell.digit}</div>
																		<div class="text-[9.5px] text-[#5aec8c]">{cell.bcd_nibble}</div>
																		<div class="text-[8.5px] text-[#8c9aa9]">
																			{cell.dtmf_row_hz}+{cell.dtmf_col_hz}Hz
																		</div>
																	</div>
																)}
															</For>
														</div>
													</div>
												</Show>
											</div>
										)}
									</Show>

									{/* Sale / Bid History Table */}
									<Show when={(r().history?.transactions?.length || 0) > 0}>
										<div>
											<h3 class="text-[15px] font-bold text-white mb-2 px-0.5">
												Sale & Transfer History
											</h3>
											<div class="frag-table-container">
												<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
													<span class="col-span-4">Price</span>
													<span class="col-span-4">Date</span>
													<span class="col-span-4 text-end">Buyer</span>
												</div>
												<For each={r().history?.transactions || []}>
													{(tx) => (
														<div class="frag-table-row grid grid-cols-12 items-center px-3.5 py-2.5 text-[12.5px]">
															<div class="col-span-4">
																<TonAmount value={formatTon(tx.price_ton)} size="sm" />
															</div>
															<div class="col-span-4 text-[#8c9aa9] truncate">{tx.sale_date}</div>
															<div
																class="col-span-4 text-end font-mono text-[#4db2ff] truncate"
																dir="ltr"
															>
																{shortAddr(tx.buyer_address)}
															</div>
														</div>
													)}
												</For>
											</div>
										</div>
									</Show>
								</div>
							</Show>
						</div>
					)}
				</Show>
			</div>

			<CreditStoreSheet open={storeOpen()} onClose={() => setStoreOpen(false)} vertical="number" />
		</div>
	);
};
