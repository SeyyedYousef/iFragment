import { useNavigate } from '@solidjs/router';
import { type Component, createSignal, For, Show } from 'solid-js';
import { giftsApi } from '@/entities/gifts/api/giftsApi.js';
import type { PortfolioScanResponse as GiftsPortfolioResponse } from '@/entities/gifts/model/types.js';
import { numbersApi } from '@/entities/numbers/api/numbersApi.js';
import type { WalletPortfolioResult as NumbersPortfolioResponse } from '@/entities/numbers/model/types.js';
import { apiClient } from '@/shared/api/axios.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { TonAmount, TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { formatEnNumber, formatEnUsd } from './homeMarketData.js';

interface UsernamePortfolioResponse {
	total_value: number;
	usernames_list?: string[];
	items?: Array<{
		username: string;
		sold_price?: number;
		sale_date?: string;
		status?: string;
	}>;
	total_count: number;
	total_spent_ton?: number;
}

interface UnifiedHoldingItem {
	id: string;
	kind: 'username' | 'number' | 'gift';
	label: string;
	valueTon: number;
	route: string;
}

interface UnifiedScanResult {
	totalTon: number;
	totalUsd: number;
	usernamesCount: number;
	usernamesTon: number;
	numbersCount: number;
	numbersTon: number;
	giftsCount: number;
	giftsTon: number;
	giftsRateLimited: boolean;
	giftsSkippedNoUser: boolean;
	addressMissingForOnChain: boolean;
	topHoldings: UnifiedHoldingItem[];
}

interface UnifiedWalletScannerProps {
	tonUsdRate: number | null;
}

const isTonAddressLike = (raw: string): boolean => {
	const v = raw.trim();
	if (!v) return false;
	return (
		/^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{40,}$/i.test(v) ||
		/^-?\d:[0-9a-fA-F]{64}$/.test(v) ||
		/\.ton$/i.test(v)
	);
};

const getTelegramSessionUsername = (): string => {
	if (typeof window === 'undefined') return '';
	try {
		const tgUser = (
			window as unknown as {
				Telegram?: { WebApp?: { initDataUnsafe?: { user?: { username?: string } } } };
			}
		)?.Telegram?.WebApp?.initDataUnsafe?.user?.username;
		if (typeof tgUser === 'string' && tgUser.trim()) {
			return tgUser.trim().replace(/^@/, '');
		}
	} catch {}
	return '';
};

export const UnifiedWalletScanner: Component<UnifiedWalletScannerProps> = (props) => {
	const navigate = useNavigate();
	const defaultTgUser = getTelegramSessionUsername();

	const [primaryInput, setPrimaryInput] = createSignal('');
	const [giftUsernameInput, setGiftUsernameInput] = createSignal(
		defaultTgUser ? `@${defaultTgUser}` : '',
	);
	const [showGiftField, setShowGiftField] = createSignal(false);
	const [scanning, setScanning] = createSignal(false);
	const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
	const [result, setResult] = createSignal<UnifiedScanResult | null>(null);

	const cleanHandle = (raw: string): string =>
		raw
			.trim()
			.replace(/^https?:\/\/(www\.)?t\.me\//i, '')
			.replace(/^@/, '')
			.split('/')[0]
			.split('?')[0]
			.trim();

	const handleScan = async (e?: Event) => {
		e?.preventDefault();
		const primary = primaryInput().trim();
		const optionalGiftHandle = cleanHandle(giftUsernameInput());
		if (!primary && !optionalGiftHandle) return;

		try {
			haptic.impact('medium');
		} catch {}

		setScanning(true);
		setErrorMsg(null);

		const hasTonAddress = isTonAddressLike(primary);
		const walletAddress = hasTonAddress ? primary : '';
		const giftHandle = hasTonAddress
			? optionalGiftHandle
			: cleanHandle(primary) || optionalGiftHandle;

		try {
			const [userRes, numRes, giftRes] = await Promise.allSettled([
				walletAddress
					? apiClient
							.get<UsernamePortfolioResponse>('/usernames/portfolio', {
								params: { address: walletAddress },
							})
							.then((r) => r.data)
					: Promise.resolve(null),
				walletAddress ? numbersApi.scanPortfolio(walletAddress) : Promise.resolve(null),
				giftHandle ? giftsApi.scanPortfolio(giftHandle) : Promise.resolve(null),
			]);

			const userData: UsernamePortfolioResponse | null =
				userRes.status === 'fulfilled' ? userRes.value : null;
			const numData: NumbersPortfolioResponse | null =
				numRes.status === 'fulfilled' ? numRes.value : null;
			const giftData: GiftsPortfolioResponse | null =
				giftRes.status === 'fulfilled' ? giftRes.value : null;

			const giftsRateLimited =
				giftRes.status === 'rejected' &&
				Number((giftRes.reason as { response?: { status?: number } })?.response?.status) === 429;

			// If every attempted call rejected (not just 429 on gifts), show friendly error
			const allFailed =
				(!walletAddress || (userRes.status === 'rejected' && numRes.status === 'rejected')) &&
				(!giftHandle || (giftRes.status === 'rejected' && !giftsRateLimited));

			if (allFailed) {
				setErrorMsg(t('home.walletError'));
				setResult(null);
				return;
			}

			const usernamesCount = userData?.total_count ?? userData?.usernames_list?.length ?? 0;
			const usernamesTon =
				typeof userData?.total_value === 'number' && Number.isFinite(userData.total_value)
					? userData.total_value
					: 0;

			const numbersCount = numData?.total_assets ?? numData?.assets?.length ?? 0;
			const numbersTon =
				typeof numData?.total_value_ton === 'number' && Number.isFinite(numData.total_value_ton)
					? numData.total_value_ton
					: 0;

			const giftsCount = giftData?.total_gifts_count ?? 0;
			const giftsTon =
				typeof giftData?.total_portfolio_value_gram === 'number' &&
				Number.isFinite(giftData.total_portfolio_value_gram)
					? giftData.total_portfolio_value_gram
					: 0;

			const totalTon = usernamesTon + numbersTon + giftsTon;
			const effectiveRate =
				props.tonUsdRate && props.tonUsdRate > 0
					? props.tonUsdRate
					: numData?.total_value_ton && numData.total_value_ton > 0 && numData.total_value_usd > 0
						? numData.total_value_usd / numData.total_value_ton
						: giftData?.total_portfolio_value_gram &&
								giftData.total_portfolio_value_gram > 0 &&
								giftData.total_portfolio_value_usd > 0
							? giftData.total_portfolio_value_usd / giftData.total_portfolio_value_gram
							: 0;

			const totalUsd =
				(numData?.total_value_usd || 0) +
				(giftData?.total_portfolio_value_usd || 0) +
				(effectiveRate > 0 ? usernamesTon * effectiveRate : 0);

			// Build unified top holdings preview (up to 6 items across all 3 verticals)
			const holdings: UnifiedHoldingItem[] = [];

			if (userData?.items && userData.items.length > 0) {
				for (const item of userData.items.slice(0, 6)) {
					const u = (item.username || '').replace(/^@/, '');
					if (!u) continue;
					holdings.push({
						id: `u:${u}`,
						kind: 'username',
						label: `@${u}`,
						valueTon: item.sold_price || 0,
						route: `/username?u=${encodeURIComponent(u.toLowerCase())}`,
					});
				}
			} else if (userData?.usernames_list && userData.usernames_list.length > 0) {
				for (const rawU of userData.usernames_list.slice(0, 6)) {
					const u = rawU.replace(/^@/, '');
					if (!u) continue;
					holdings.push({
						id: `u:${u}`,
						kind: 'username',
						label: `@${u}`,
						valueTon: 0,
						route: `/username?u=${encodeURIComponent(u.toLowerCase())}`,
					});
				}
			}

			if (numData?.assets && numData.assets.length > 0) {
				for (const asset of numData.assets.slice(0, 6)) {
					const digits = (asset.number || '').replace(/[^\d]/g, '');
					if (!digits) continue;
					holdings.push({
						id: `n:${digits}`,
						kind: 'number',
						label: asset.display_number || `+${digits}`,
						valueTon: asset.expected_ton || 0,
						route: `/numbers/report?n=${encodeURIComponent(digits)}`,
					});
				}
			}

			if (giftData?.top_valued_gifts && giftData.top_valued_gifts.length > 0) {
				for (const g of giftData.top_valued_gifts.slice(0, 6)) {
					if (!g.gift_id) continue;
					holdings.push({
						id: `g:${g.gift_id}`,
						kind: 'gift',
						label:
							g.serial_number > 0
								? `${g.model_name} #${g.serial_number}`
								: g.model_name || g.gift_id,
						valueTon: g.estimated_val_gram || 0,
						route: `/gifts/report?g=${encodeURIComponent(g.gift_id)}`,
					});
				}
			}

			holdings.sort((a, b) => b.valueTon - a.valueTon);

			setResult({
				totalTon,
				totalUsd,
				usernamesCount,
				usernamesTon,
				numbersCount,
				numbersTon,
				giftsCount,
				giftsTon,
				giftsRateLimited,
				giftsSkippedNoUser: hasTonAddress && !giftHandle,
				addressMissingForOnChain: !hasTonAddress && Boolean(giftHandle),
				topHoldings: holdings.slice(0, 6),
			});
		} catch {
			setErrorMsg(t('home.walletError'));
			setResult(null);
		} finally {
			setScanning(false);
		}
	};

	const resetScan = () => {
		setResult(null);
		setErrorMsg(null);
	};

	return (
		<section class="w-full mb-5" aria-label={t('home.walletScannerTitle')}>
			<div class="flex items-center justify-between px-1 mb-2">
				<div class="flex items-center gap-2 min-w-0">
					<span class="material-symbols-outlined text-[18px] text-[#4db2ff] shrink-0">
						account_balance_wallet
					</span>
					<h2 class="text-[15px] font-semibold text-white truncate">
						{t('home.walletScannerTitle')}
					</h2>
				</div>
				<Show when={result()}>
					<button
						type="button"
						onClick={resetScan}
						class="text-[12px] font-semibold text-[#8c9aa9] hover:text-white transition-colors cursor-pointer shrink-0"
					>
						{t('home.walletReset')}
					</button>
				</Show>
			</div>

			<div class="frag-card p-3.5">
				<p class="text-[12px] text-[#8c9aa9] leading-[1.45] mb-3">{t('home.walletScannerSub')}</p>

				<form onSubmit={handleScan} class="flex flex-col gap-2">
					<div class="w-full bg-[#242e38] hover:bg-[#293440] focus-within:bg-[#293440] rounded-[8px] p-1 flex items-center gap-1.5 transition-colors">
						<input
							type="text"
							value={primaryInput()}
							onInput={(e) => {
								const val = e.currentTarget.value;
								setPrimaryInput(val);
								if (isTonAddressLike(val)) {
									setShowGiftField(true);
								}
							}}
							placeholder={t('home.walletInputPlaceholder')}
							aria-label={t('home.walletInputPlaceholder')}
							dir={primaryInput() ? 'ltr' : isRtl() ? 'rtl' : 'ltr'}
							class="flex-1 min-w-0 bg-transparent text-white text-[12.5px] font-mono placeholder:font-frag-sans placeholder:text-[#8a98a6] focus:outline-none py-1.5 px-2"
							autocomplete="off"
							autocapitalize="off"
							spellcheck={false}
						/>
						<button
							type="submit"
							disabled={scanning() || (!primaryInput().trim() && !giftUsernameInput().trim())}
							class="frag-btn-primary px-3.5 h-8 rounded-[6px] text-[12.5px] font-semibold shrink-0 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
						>
							<Show when={scanning()}>
								<span class="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
							</Show>
							<span>{scanning() ? t('home.walletScanning') : t('home.walletScanBtn')}</span>
						</button>
					</div>

					{/* Optional @username field when scanning a TON wallet address to also include Gifts */}
					<Show when={showGiftField() || isTonAddressLike(primaryInput())}>
						<div class="w-full bg-[#1d252e] rounded-[6px] px-2.5 py-1.5 flex items-center gap-2 border border-white/[0.05]">
							<span class="material-symbols-outlined text-[15px] text-[#ff9953] shrink-0">
								featured_seasonal_and_gifts
							</span>
							<input
								type="text"
								value={giftUsernameInput()}
								onInput={(e) => setGiftUsernameInput(e.currentTarget.value)}
								placeholder={t('home.walletGiftUserPlaceholder')}
								aria-label={t('home.walletGiftUserPlaceholder')}
								dir={giftUsernameInput() ? 'ltr' : isRtl() ? 'rtl' : 'ltr'}
								class="flex-1 min-w-0 bg-transparent text-white text-[12px] font-mono placeholder:font-frag-sans placeholder:text-[#8a98a6] focus:outline-none"
								autocomplete="off"
								autocapitalize="off"
								spellcheck={false}
							/>
						</div>
					</Show>
				</form>

				<Show when={errorMsg()}>
					<p class="mt-2.5 text-[12px] text-[#ff5c6c]">{errorMsg()}</p>
				</Show>

				<Show when={result()}>
					{(res) => {
						const totalAssets = () => res().usernamesCount + res().numbersCount + res().giftsCount;
						return (
							<div class="mt-3.5 pt-3.5 border-t border-white/[0.07] flex flex-col gap-3">
								{/* Total Combined Net Worth */}
								<div class="flex items-center justify-between gap-2 bg-[#1a2026] rounded-[8px] px-3 py-2.5">
									<div class="flex flex-col min-w-0">
										<span class="text-[11.5px] text-[#8c9aa9]">{t('home.walletTotalWorth')}</span>
										<span class="text-[11.5px] text-[#4db2ff] font-medium mt-0.5">
											{t('home.walletItemsCount').replace(
												'{count}',
												formatEnNumber(totalAssets(), 0),
											)}
										</span>
									</div>
									<TonAmount
										value={formatEnNumber(res().totalTon, 1)}
										usd={res().totalUsd > 0 ? formatEnUsd(res().totalUsd, 0) : null}
										size="lg"
										class="items-end"
									/>
								</div>

								{/* 3-Vertical Breakdown */}
								<div class="grid grid-cols-3 gap-2">
									<div class="bg-[#242e38] rounded-[6px] p-2.5 flex flex-col gap-1">
										<span class="text-[11px] text-[#8c9aa9] truncate">
											{t('home.walletUsernames')}
										</span>
										<span
											class="inline-flex items-center gap-1 text-[13px] font-semibold text-white tabular-nums"
											dir="ltr"
										>
											<TonIcon size={11} color="#4db2ff" />
											{formatEnNumber(res().usernamesTon, 0)}
										</span>
										<span class="text-[10.5px] text-[#8c9aa9] font-mono tabular-nums" dir="ltr">
											{formatEnNumber(res().usernamesCount, 0)}x
										</span>
									</div>

									<div class="bg-[#242e38] rounded-[6px] p-2.5 flex flex-col gap-1">
										<span class="text-[11px] text-[#8c9aa9] truncate">
											{t('home.walletNumbers')}
										</span>
										<span
											class="inline-flex items-center gap-1 text-[13px] font-semibold text-white tabular-nums"
											dir="ltr"
										>
											<TonIcon size={11} color="#5aec8c" />
											{formatEnNumber(res().numbersTon, 0)}
										</span>
										<span class="text-[10.5px] text-[#8c9aa9] font-mono tabular-nums" dir="ltr">
											{formatEnNumber(res().numbersCount, 0)}x
										</span>
									</div>

									<div class="bg-[#242e38] rounded-[6px] p-2.5 flex flex-col gap-1">
										<span class="text-[11px] text-[#8c9aa9] truncate">{t('home.walletGifts')}</span>
										<span
											class="inline-flex items-center gap-1 text-[13px] font-semibold text-white tabular-nums"
											dir="ltr"
										>
											<TonIcon size={11} color="#ff9953" />
											{formatEnNumber(res().giftsTon, 0)}
										</span>
										<span class="text-[10.5px] text-[#8c9aa9] font-mono tabular-nums" dir="ltr">
											{formatEnNumber(res().giftsCount, 0)}x
										</span>
									</div>
								</div>

								{/* Subtle contextual hints (rate limit or missing secondary identifier) */}
								<Show when={res().giftsRateLimited}>
									<p class="text-[11.5px] text-[#ff9953]">{t('home.walletGiftsRateLimited')}</p>
								</Show>
								<Show when={res().giftsSkippedNoUser}>
									<p class="text-[11.5px] text-[#8c9aa9]">{t('home.walletGiftsNeedUser')}</p>
								</Show>
								<Show when={res().addressMissingForOnChain}>
									<p class="text-[11.5px] text-[#8c9aa9]">{t('home.walletAddAddressHint')}</p>
								</Show>

								{/* Empty state vs Top Holdings */}
								<Show
									when={res().topHoldings.length > 0}
									fallback={
										<Show when={totalAssets() === 0}>
											<p class="text-[12px] text-[#8c9aa9] text-center py-1">
												{t('home.walletEmpty')}
											</p>
										</Show>
									}
								>
									<div class="flex flex-col gap-1.5">
										<span class="text-[11.5px] font-semibold text-[#8c9aa9]">
											{t('home.walletTopHoldings')}
										</span>
										<div class="flex flex-wrap gap-1.5">
											<For each={res().topHoldings}>
												{(item) => (
													<button
														type="button"
														onClick={() => {
															try {
																haptic.selection();
															} catch {}
															navigate(item.route);
														}}
														class="h-7 px-2.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-[11.5px] text-white font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
														dir="ltr"
													>
														<span
															class={`w-1.5 h-1.5 rounded-full shrink-0 ${
																item.kind === 'number'
																	? 'bg-[#5aec8c]'
																	: item.kind === 'gift'
																		? 'bg-[#ff9953]'
																		: 'bg-[#4db2ff]'
															}`}
														/>
														<span class="truncate max-w-[140px]">{item.label}</span>
														<Show when={item.valueTon > 0}>
															<span class="text-[#8c9aa9] tabular-nums">
																{formatEnNumber(item.valueTon, 0)}
															</span>
														</Show>
													</button>
												)}
											</For>
										</div>
									</div>
								</Show>
							</div>
						);
					}}
				</Show>
			</div>
		</section>
	);
};
