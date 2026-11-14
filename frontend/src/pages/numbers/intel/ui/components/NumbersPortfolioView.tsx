import { type Component, createEffect, createSignal, For, onMount, Show } from 'solid-js';
import { numbersApi, splitNumberPrefix } from '@/entities/numbers/index.js';
import type { WalletPortfolioResult } from '@/entities/numbers/model/types.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { FragSectionHeader, TonAmount } from '@/shared/ui/fragment/FragmentPrimitives.js';

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

	const floorTon = (): number => Number(props.floorPriceTon) || 0;
	const tonRate = (): number => Number(props.rate) || 0;

	const handleScan = async (targetAddr?: string) => {
		const query = (targetAddr !== undefined ? targetAddr : address()).trim();
		if (!query) {
			setError(t('numbers.enterWalletAddress'));
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
			console.error('Portfolio scan failed:', err);
			setError(err?.response?.data?.error || t('common.unknownError') || 'Failed to scan wallet');
		} finally {
			setIsScanning(false);
		}
	};

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
		const rate = tonRate();
		const rawUsd = rate > 0 ? Math.round(rawTon * rate) : 0;
		const feeFactor = deductFee() ? 0.05 : 0;
		const feeTon = Math.round(rawTon * feeFactor);
		const netTon = rawTon - feeTon;
		const netUsd = rate > 0 ? Math.round(netTon * rate) : 0;

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

	const formatUsdPlain = (val?: number) => {
		if (val === undefined || val === null || val <= 0) return null;
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	return (
		<div class="space-y-3.5">
			{/* Wallet Search Card */}
			<div class="frag-card-elevated rounded-[16px] p-4 space-y-3">
				<FragSectionHeader
					title={t('numbers.portfolioTitle')}
					subtitle={
						t('numbers.portfolioDescription') ||
						"Inspect any TON wallet's +888 collection holdings, estimated market floor worth, and net PnL."
					}
					icon="account_balance_wallet"
				/>

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
							placeholder={
								t('numbers.walletInputPlaceholder') || 'Enter TON wallet address (EQ... / UQ...)'
							}
							value={address()}
							onInput={(e) => setAddress(e.currentTarget.value)}
							dir="ltr"
							class="flex-1 frag-inset rounded-[10px] px-3.5 py-2.5 text-[12.5px] text-white placeholder:text-[#60707c] focus:outline-none focus:border-[#2990ff] font-mono transition-all"
						/>
						<button
							type="submit"
							disabled={isScanning()}
							class="px-4 py-2.5 rounded-[10px] frag-btn-primary disabled:opacity-50 font-semibold text-[12.5px] flex items-center gap-1.5 shrink-0"
						>
							<Show
								when={!isScanning()}
								fallback={
									<div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
								}
							>
								<span class="material-symbols-outlined text-[16px]">search</span>
								<span>{t('numbers.scanBtn')}</span>
							</Show>
						</button>
					</div>

					{/* 5% Fragment Fee Toggle + Sample */}
					<div class="flex items-center justify-between pt-0.5 flex-wrap gap-2">
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
								class="w-4 h-4 rounded bg-[#11161d] border-white/20 text-[#2990ff] focus:ring-0 cursor-pointer accent-[#2990ff]"
							/>
							<span class="text-[11.5px] font-medium text-[#c7d0d9]">
								{t('numbers.deductFragmentFee')}
							</span>
						</label>

						<button
							type="button"
							onClick={() => {
								const sample = 'EQDPxS8aXBrJs4OGBGW3mkNXyMa6zzOol83bxOoEo_nXNWzT';
								setAddress(sample);
								handleScan(sample);
							}}
							class="text-[11.5px] font-semibold text-[#2990ff] hover:text-[#4aa3ff] flex items-center gap-1"
						>
							<span>{t('numbers.sampleWhale')}</span>
							<span class="material-symbols-outlined text-[14px]">north_east</span>
						</button>
					</div>
				</form>

				<Show when={error()}>
					<div class="p-3 rounded-[10px] bg-[#ff5c6c]/12 border border-[#ff5c6c]/30 text-[#ff8591] text-[12px] font-medium">
						{error()}
					</div>
				</Show>
			</div>

			{/* Portfolio Summary Results */}
			<Show when={result()}>
				<div class="space-y-3.5">
					<div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
						<div class="frag-inset rounded-[12px] p-3.5">
							<div class="text-[11px] font-medium text-[#8c9ba5]">{t('numbers.totalNumbers')}</div>
							<div class="text-[19px] font-semibold text-white font-mono mt-1 tabular-nums">
								{portfolioMetrics().totalAssets}{' '}
								<span class="text-[11.5px] font-normal text-[#8c9ba5]">
									{t('numPortfolio.nftsUnit')}
								</span>
							</div>
						</div>

						<div class="frag-inset rounded-[12px] p-3.5">
							<div class="text-[11px] font-medium text-[#8c9ba5]">
								{deductFee() ? t('numbers.netPortfolioFee') : t('numbers.floorPortfolioValue')}
							</div>
							<div class="mt-1">
								<TonAmount
									value={formatTon(portfolioMetrics().netTon)}
									size="lg"
									unit
									usd={formatUsdPlain(portfolioMetrics().netUsd)}
								/>
							</div>
						</div>

						<div class="frag-inset rounded-[12px] p-3.5 col-span-2 sm:col-span-1">
							<div class="text-[11px] font-medium text-[#8c9ba5]">
								{t('numbers.bestGlobalRank')}
							</div>
							<div class="text-[19px] font-semibold text-[#ffb340] font-mono mt-1 tabular-nums">
								#{result()?.best_global_rank || '-'}
							</div>
						</div>
					</div>

					{/* Owned Numbers List */}
					<div class="frag-card rounded-[14px] p-4 space-y-3">
						<FragSectionHeader
							title={`${t('numbers.holdings') || 'Holdings'} (${result()?.assets?.length || 0})`}
							icon="dialpad"
						/>

						<Show
							when={(result()?.assets || []).length > 0}
							fallback={
								<div class="p-8 text-center text-[#8c9ba5] text-[12.5px]">
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
											class="w-full frag-inset hover:bg-[#232d3a] hover:border-[#2990ff]/35 active:scale-[0.99] rounded-[11px] p-3 flex items-center justify-between transition-all group text-start"
										>
											<div class="flex items-center gap-2.5 min-w-0">
												<div class="w-9 h-8 rounded-[8px] bg-[#2990ff]/12 border border-[#2990ff]/25 flex items-center justify-center font-semibold text-[11px] text-[#2990ff] font-mono shrink-0">
													+888
												</div>
												<div class="min-w-0">
													<div
														class="font-semibold text-white font-mono text-[13px] group-hover:text-[#2990ff] transition-colors truncate tabular-nums"
														dir="ltr"
													>
														{(() => {
															const p = splitNumberPrefix(asset.display_number || asset.number);
															return p.body || p.rawDigits;
														})()}
													</div>
													<div class="text-[11px] text-[#8c9ba5] font-mono tabular-nums">
														Rank #{asset.global_rank} · Score {asset.rarity_score}
													</div>
												</div>
											</div>

											<div class="text-end shrink-0">
												<TonAmount
													value={
														asset.expected_ton
															? formatTon(asset.expected_ton)
															: floorTon() > 0
																? formatTon(floorTon())
																: '-'
													}
													size="sm"
													unit
													usd={
														asset.expected_usd || (floorTon() > 0 && tonRate() > 0)
															? formatUsdPlain(
																	asset.expected_usd || Math.round(floorTon() * tonRate()),
																)
															: null
													}
													class="items-end"
												/>
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
