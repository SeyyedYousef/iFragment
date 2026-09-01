import {
	createEffect,
	createSignal,
	For,
	onMount,
	Show,
	type Component,
} from 'solid-js';
import { numbersApi, splitNumberPrefix } from '@/entities/numbers/index.js';
import type { WalletPortfolioResult } from '@/entities/numbers/model/types.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	initialAddress?: string;
	floorPriceTon?: number;
	rate?: number;
	onValuateNumber?: (num: string) => void;
}

export const NumbersPortfolioView: Component<Props> = (props) => {
	const [address, setAddress] = createSignal<string>(props.initialAddress || '');
	const [isScanning, setIsScanning] = createSignal<boolean>(false);
	const [result, setResult] = createSignal<WalletPortfolioResult | null>(null);
	const [error, setError] = createSignal<string | null>(null);
	const [deductFee, setDeductFee] = createSignal<boolean>(false);

	createEffect(() => {
		if (props.initialAddress && props.initialAddress !== address()) {
			setAddress(props.initialAddress);
			handleScan(props.initialAddress);
		}
	});

	onMount(() => {
		if (props.initialAddress) {
			handleScan(props.initialAddress);
		}
	});

	const floorTon = () => props.floorPriceTon || 2280;
	const tonRate = () => props.rate || 5.5;

	const handleScan = async (targetAddr?: string) => {
		const query = (targetAddr !== undefined ? targetAddr : address()).trim();
		if (!query) {
			setError(t('numbers.enterWalletAddress') || 'Please enter a valid TON wallet address');
			return;
		}

		try {
			haptic.impact('medium');
		} catch {}

		setIsScanning(true);
		setError(null);

		try {
			const res = await numbersApi.scanPortfolio(query);
			setResult(res);
		} catch (err: any) {
			setError(err?.message || 'Failed to scan wallet portfolio');
		} finally {
			setIsScanning(false);
		}
	};

	// Calculate adjusted net worth considering 5% Fragment fee
	const portfolioMetrics = () => {
		const data = result();
		if (!data || data.total_assets === 0) {
			return {
				totalAssets: 0,
				rawTon: 0,
				rawUsd: 0,
				netTon: 0,
				netUsd: 0,
				feeTon: 0,
			};
		}

		const totalAssets = data.total_assets;
		const rawTon = data.total_value_ton || totalAssets * floorTon();
		const rawUsd = Math.round(rawTon * tonRate);
		const feeFactor = deductFee() ? 0.05 : 0;
		const feeTon = Math.round(rawTon * feeFactor);
		const netTon = rawTon - feeTon;
		const netUsd = Math.round(netTon * tonRate);

		return {
			totalAssets,
			rawTon,
			rawUsd,
			netTon,
			netUsd,
			feeTon,
		};
	};

	const formatTon = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	return (
		<div class="space-y-4">
			{/* Wallet Search Box Card */}
			<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-xl">
				<label class="block text-xs font-black text-white/70 uppercase tracking-wider mb-2">
					{t('numbers.portfolioTitle') || 'Telegram Anonymous Numbers Portfolio'}
				</label>
				<p class="text-[11px] text-white/40 mb-3">
					{t('numbers.portfolioDescription') ||
						"Inspect any TON wallet's +888 collection holdings, estimated market floor worth, and net PnL."}
				</p>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleScan();
					}}
					class="space-y-3"
				>
					<div class="flex gap-2">
						<input
							type="text"
							placeholder={t('numbers.walletInputPlaceholder') || 'Enter TON wallet address (EQ... / UQ...)'}
							value={address()}
							onInput={(e) => setAddress(e.currentTarget.value)}
							class="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#0098EA] font-mono transition-all"
						/>
						<button
							type="submit"
							disabled={isScanning()}
							class="px-4 py-2.5 rounded-xl bg-[#0098EA] hover:bg-[#0086cf] disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-[#0098EA]/20 transition-all active:scale-95 shrink-0"
						>
							<Show
								when={!isScanning()}
								fallback={
									<div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
								}
							>
								<span class="material-symbols-outlined text-base">search</span>
								<span>{t('numbers.scanBtn') || 'Scan'}</span>
							</Show>
						</button>
					</div>

					{/* 5% Fragment Fee Toggle */}
					<div class="flex items-center justify-between pt-1">
						<label class="flex items-center gap-2 cursor-pointer select-none">
							<input
								type="checkbox"
								checked={deductFee()}
								onChange={(e) => {
									try {
										haptic.selection();
									} catch {}
									setDeductFee(e.currentTarget.checked);
								}}
								class="w-4 h-4 rounded bg-black/40 border-white/20 text-[#0098EA] focus:ring-0 cursor-pointer accent-[#0098EA]"
							/>
							<span class="text-[11px] font-semibold text-white/70">
								{t('numbers.deductFragmentFee') || 'Deduct Fragment 5% Royalty Fee'}
							</span>
						</label>

						{/* Quick Demo Holder Search */}
						<button
							type="button"
							onClick={() => {
								const sample = 'EQBPsG9cmIq0V56Hlkd-7YkR0O1qJcDk1so_nomdKG7GT3gH';
								setAddress(sample);
								handleScan(sample);
							}}
							class="text-[10px] font-bold text-[#0098EA] hover:underline flex items-center gap-1"
						>
							<span>{t('numbers.sampleWhale') || 'Sample Whale Wallet'}</span>
							<span class="material-symbols-outlined text-[12px]">arrow_forward</span>
						</button>
					</div>
				</form>

				<Show when={error()}>
					<div class="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
						{error()}
					</div>
				</Show>
			</div>

			{/* Portfolio Summary Results */}
			<Show when={result()}>
				<div class="space-y-4 animate-in fade-in duration-300">
					{/* Summary KPIs */}
					<div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
						<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-3.5 backdrop-blur-xl">
							<div class="text-[10px] font-bold text-white/40 uppercase">{t('numbers.totalNumbers') || 'Total Numbers'}</div>
							<div class="text-xl font-black text-white font-mono mt-1">
								{portfolioMetrics().totalAssets}{' '}
								<span class="text-xs font-medium text-white/40">NFTs</span>
							</div>
						</div>

						<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-3.5 backdrop-blur-xl">
							<div class="text-[10px] font-bold text-white/40 uppercase">
								{deductFee() ? (t('numbers.netPortfolioFee') || 'Net Portfolio (5% Fee)') : (t('numbers.floorPortfolioValue') || 'Floor Portfolio Value')}
							</div>
							<div class="text-xl font-black text-[#0098EA] font-mono mt-1 flex items-center gap-1">
								<span>{formatTon(portfolioMetrics().netTon)}</span>
								<span class="text-xs text-white/40">TON</span>
							</div>
							<div class="text-[10px] text-white/40 font-mono mt-0.5">
								≈ {formatUsd(portfolioMetrics().netUsd)}
							</div>
						</div>

						<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-3.5 backdrop-blur-xl col-span-2 sm:col-span-1">
							<div class="text-[10px] font-bold text-white/40 uppercase">{t('numbers.bestGlobalRank') || 'Best Global Rank'}</div>
							<div class="text-xl font-black text-amber-400 font-mono mt-1">
								#{result()?.best_global_rank || '-'}
							</div>
						</div>
					</div>

					{/* Owned Numbers List */}
					<div class="bg-[#0e131d]/90 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-xl">
						<h4 class="text-xs font-black text-white/70 uppercase tracking-wider mb-3">
							{t('numbers.holdings') || 'Holdings'} ({result()?.assets?.length || 0})
						</h4>

						<Show
							when={(result()?.assets || []).length > 0}
							fallback={
								<div class="p-8 text-center text-white/40 text-xs font-medium">
									{t('numbers.portfolioNoAssets') || 'No Anonymous Numbers found in this wallet.'}
								</div>
							}
						>
							<div class="space-y-2">
								<For each={result()?.assets || []}>
									{(asset) => (
										<button
											type="button"
											onClick={() => {
												try {
													haptic.selection();
												} catch {}
												props.onValuateNumber?.(asset.number);
											}}
											class="w-full bg-white/[0.02] hover:bg-white/[0.06] active:scale-[0.99] border border-white/[0.05] hover:border-[#0098EA]/30 rounded-xl p-3 flex items-center justify-between transition-all group text-left"
										>
											<div class="flex items-center gap-2.5">
												<div class="w-8 h-8 rounded-lg bg-[#0098EA]/10 border border-[#0098EA]/20 flex items-center justify-center font-bold text-xs text-[#0098EA] font-mono shrink-0">
													+888
												</div>
												<div>
													<div class="font-black text-white font-mono text-xs group-hover:text-[#0098EA] transition-colors">
														{(() => {
															const p = splitNumberPrefix(asset.display_number || asset.number);
															return p.body || p.rawDigits;
														})()}
													</div>
													<div class="text-[10px] text-white/40 font-medium">
														Rank #{asset.global_rank} • Score {asset.rarity_score}
													</div>
												</div>
											</div>

											<div class="text-right">
												<div class="font-black text-white font-mono text-xs flex items-center justify-end gap-1.5">
													<span class="w-1.5 h-1.5 rounded-full bg-[#0098EA]" />
													<span>{formatTon(asset.expected_ton || floorTon())} TON</span>
												</div>
												<div class="text-[10px] text-white/40 font-mono">
													≈ {formatUsd(asset.expected_usd || Math.round(floorTon() * tonRate))}
												</div>
											</div>
										</button>
									)}
								</For>
							</div>
						</Show>
					</div>
				</div>
			</Show>
		</div>
	);
};
