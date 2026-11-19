import { type Component, createSignal, For, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { creditsApi } from '@/entities/intel/api/creditsApi.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import type { PaywallVertical } from './theme.js';
import { useWallet } from './useWallet.js';

interface CreditStoreSheetProps {
	open: boolean;
	onClose: () => void;
	vertical?: PaywallVertical;
}

type Tab = 'stars' | 'free';

const tg = () =>
	typeof window !== 'undefined'
		? (
				window as unknown as {
					Telegram?: {
						WebApp?: {
							openInvoice?: (url: string, callback?: (status: string) => void) => void;
							openTelegramLink?: (url: string) => void;
						};
					};
				}
			).Telegram?.WebApp
		: undefined;

export const CreditStoreSheet: Component<CreditStoreSheetProps> = (props) => {
	const wallet = useWallet();
	const [tab, setTab] = createSignal<Tab>('stars');
	const [pendingPack, setPendingPack] = createSignal<string | null>(null);
	const [purchaseError, setPurchaseError] = createSignal<string | null>(null);
	const [purchaseSuccess, setPurchaseSuccess] = createSignal<boolean>(false);
	let pollTimer: ReturnType<typeof setInterval> | undefined;

	onCleanup(() => {
		clearInterval(pollTimer);
	});

	const startBalancePolling = (baseline: number) => {
		clearInterval(pollTimer);
		let tries = 0;
		pollTimer = setInterval(() => {
			wallet.refetch();
			tries += 1;
			if ((wallet.balance() !== null && wallet.balance()! > baseline) || tries > 30) {
				clearInterval(pollTimer);
				setPendingPack(null);
				if (wallet.balance() !== null && wallet.balance()! > baseline) {
					setPurchaseSuccess(true);
					try {
						haptic.notify('success');
					} catch {}
				}
			}
		}, 2000);
	};

	const buyPack = async (packId: string) => {
		try {
			haptic.impact('medium');
		} catch {}
		setPendingPack(packId);
		setPurchaseError(null);
		setPurchaseSuccess(false);
		try {
			const res = await creditsApi.purchaseCredits('stars', packId);
			if (res.invoice_link) {
				const baseline = wallet.balance() ?? 0;
				const webApp = tg();
				if (webApp?.openInvoice) {
					webApp.openInvoice(res.invoice_link, (status: string) => {
						if (status === 'paid') {
							setPurchaseSuccess(true);
							wallet.refetch();
							try {
								haptic.notify('success');
							} catch {}
							startBalancePolling(baseline);
						} else if (status === 'cancelled' || status === 'failed') {
							clearInterval(pollTimer);
							setPendingPack(null);
							if (status === 'failed') {
								setPurchaseError(t('paywall.store_config_error'));
							}
						}
					});
					startBalancePolling(baseline);
				} else if (typeof window !== 'undefined') {
					window.open(res.invoice_link, '_blank');
					startBalancePolling(baseline);
				}
			} else {
				setPendingPack(null);
				wallet.refetch();
			}
		} catch (err) {
			setPendingPack(null);
			setPurchaseError(err instanceof Error ? err.message : String(err));
		}
	};

	const close = () => {
		clearInterval(pollTimer);
		setPendingPack(null);
		props.onClose();
	};

	const openGroup = () => {
		try {
			haptic.impact('medium');
		} catch {}
		const webApp = tg();
		if (webApp?.openTelegramLink) {
			webApp.openTelegramLink('https://t.me/FragmentInvestors');
		} else {
			window.open('https://t.me/FragmentInvestors', '_blank');
		}
	};

	const goToLeaderboard = () => {
		try {
			haptic.impact('medium');
		} catch {}
		close();
		if (typeof window !== 'undefined') {
			window.location.hash = '#/leaderboard';
		}
	};

	return (
		<Show when={props.open}>
			<Portal>
				<div
					class="fixed inset-0 z-[140]"
					role="dialog"
					aria-modal="true"
					dir={isRtl() ? 'rtl' : 'ltr'}
				>
					<button
						type="button"
						aria-label="close"
						onClick={close}
						class="absolute inset-0 bg-black/70 backdrop-blur-sm"
					/>
					<div
						class="paywall-sheet frag-sheet absolute inset-x-0 bottom-0 mx-auto max-w-[480px] rounded-t-[16px] px-4 pb-8 pt-3"
						style={{ animation: 'sheet-up 240ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
					>
						<div class="mx-auto mb-3 h-1 w-9 rounded-full bg-white/15" />

						<div class="mb-3.5 flex items-center justify-between gap-3">
							<h2 class="text-[16px] font-semibold tracking-[-0.01em] text-white">
								{t('paywall.store_title')}
							</h2>
							<button
								type="button"
								onClick={close}
								class="flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-[#8c9aa9] hover:text-white cursor-pointer"
							>
								<span class="material-symbols-outlined text-[18px]">close</span>
							</button>
						</div>

						{/* Fragment Segmented Tabs */}
						<div class="mb-3.5 grid grid-cols-2 gap-1 rounded-[8px] bg-[#1a2026] p-1">
							<button
								type="button"
								onClick={() => {
									haptic.selection();
									setTab('stars');
								}}
								class={`flex items-center justify-center gap-1.5 rounded-[6px] py-2 text-[12px] font-semibold transition-colors cursor-pointer ${
									tab() === 'stars' ? 'bg-[#293440] text-white' : 'text-[#8c9aa9] hover:text-white'
								}`}
							>
								<span
									class="material-symbols-outlined text-[15px] text-[#ff9953]"
									style={{ 'font-variation-settings': '"FILL" 1' }}
								>
									star
								</span>
								<span>{t('paywall.store_stars_tab')}</span>
							</button>
							<button
								type="button"
								onClick={() => {
									haptic.selection();
									setTab('free');
								}}
								class={`flex items-center justify-center gap-1.5 rounded-[6px] py-2 text-[12px] font-semibold transition-colors cursor-pointer ${
									tab() === 'free' ? 'bg-[#293440] text-white' : 'text-[#8c9aa9] hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-[15px] text-[#5aec8c]">bolt</span>
								<span>{t('paywall.store_free_tab')}</span>
							</button>
						</div>

						<Show when={purchaseSuccess()}>
							<div class="mb-3 flex items-center gap-2 rounded-[8px] bg-[#5aec8c]/10 px-3.5 py-2.5 text-[12.5px] font-medium text-[#5aec8c]">
								<span class="material-symbols-outlined text-[17px] shrink-0">check_circle</span>
								<span class="font-mono tabular-nums">
									{t('paywall.credit_unit')} — {wallet.balance() ?? 0}
								</span>
							</div>
						</Show>

						<Show when={purchaseError()}>
							<div class="mb-3 rounded-[8px] bg-[#ff5863]/10 p-3 text-[12px] font-medium text-[#ff5863]">
								{purchaseError()}
							</div>
						</Show>

						<Show
							when={!wallet.configFailed()}
							fallback={
								<div class="rounded-[8px] bg-[#ff5863]/10 p-4 text-center">
									<p class="text-[12px] font-medium text-[#ff5863]">
										{t('paywall.store_config_error')}
									</p>
									<button
										type="button"
										onClick={() => wallet.refetch()}
										class="mt-2.5 rounded-[6px] frag-btn-secondary px-4 py-1.5 text-[12px] font-semibold text-white"
									>
										{t('paywall.retry')}
									</button>
								</div>
							}
						>
							<Show
								when={wallet.config()}
								fallback={
									<div class="space-y-2" aria-hidden="true">
										<div class="h-14 animate-pulse rounded-[8px] bg-[#242e38]" />
										<div class="h-14 animate-pulse rounded-[8px] bg-[#242e38]" />
										<div class="h-14 animate-pulse rounded-[8px] bg-[#242e38]" />
									</div>
								}
							>
								{/* Stars Package List — Fragment /stars/buy style */}
								<Show when={tab() === 'stars'}>
									<div class="space-y-2">
										<For each={wallet.config()?.packs ?? []}>
											{(pack) => (
												<button
													type="button"
													disabled={pendingPack() !== null}
													onClick={() => buyPack(pack.id)}
													class={`flex w-full items-center justify-between gap-3 rounded-[8px] p-3 text-start transition-colors disabled:opacity-50 cursor-pointer ${
														pack.popular
															? 'bg-[#242e38] hover:bg-[#293440] border-2 border-[#4db2ff]'
															: 'bg-[#242e38] hover:bg-[#293440]'
													}`}
												>
													<div class="flex items-center gap-3 min-w-0">
														<span
															class="material-symbols-outlined text-[20px] text-[#ff9953] shrink-0"
															style={{ 'font-variation-settings': '"FILL" 1' }}
														>
															star
														</span>
														<div class="min-w-0">
															<div class="flex items-center gap-1.5 flex-wrap">
																<span class="font-mono text-[15px] font-semibold text-white tabular-nums">
																	{pack.credits + pack.bonus_credits}
																</span>
																<span class="text-[12.5px] font-medium text-[#8c9aa9]">
																	{t('paywall.credit_unit')}
																</span>
																<Show when={pack.bonus_credits > 0}>
																	<span class="rounded-[4px] bg-[#5aec8c]/10 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-[#5aec8c] tabular-nums">
																		+{pack.bonus_credits}
																	</span>
																</Show>
															</div>
															<Show when={pack.popular}>
																<div class="mt-0.5 text-[11px] font-medium text-[#4db2ff]">
																	{t('paywall.pack_popular')}
																</div>
															</Show>
															<Show when={pack.best_value}>
																<div class="mt-0.5 text-[11px] font-medium text-[#5aec8c]">
																	{t('paywall.pack_best_value')}
																</div>
															</Show>
														</div>
													</div>
													<div class="shrink-0">
														<Show
															when={pendingPack() !== pack.id}
															fallback={
																<span class="material-symbols-outlined animate-spin text-[18px] text-[#8c9aa9]">
																	progress_activity
																</span>
															}
														>
															<span
																dir="ltr"
																class="inline-flex items-center gap-1 rounded-[6px] bg-[#212a33] px-2.5 py-1 font-mono text-[12.5px] font-semibold text-[#ff9953] tabular-nums"
															>
																<span>{pack.stars_price}</span>
																<span
																	class="material-symbols-outlined text-[13px]"
																	style={{ 'font-variation-settings': '"FILL" 1' }}
																>
																	star
																</span>
															</span>
														</Show>
													</div>
												</button>
											)}
										</For>
									</div>
								</Show>

								{/* Free Credits Tab */}
								<Show when={tab() === 'free'}>
									<div class="space-y-3">
										<div class="bg-[#242e38] rounded-[8px] p-4">
											<h3 class="text-[14px] font-semibold text-white mb-1">
												{t('paywall.free_credits_title')}
											</h3>
											<p class="text-[12px] leading-snug text-[#8794a1] mb-3">
												{t('paywall.free_credits_subtitle')}
											</p>

											<div class="space-y-2 bg-[#212a33] rounded-[6px] p-3 text-[12px] text-[#cbd7e5]">
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[15px] text-[#5aec8c] shrink-0">
														chat
													</span>
													<span>{t('paywall.free_credits_rule_msg')}</span>
												</div>
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[15px] text-[#ff9953] shrink-0">
														rocket_launch
													</span>
													<span>{t('paywall.free_credits_rule_boost')}</span>
												</div>
												<div class="flex items-center gap-2">
													<span class="material-symbols-outlined text-[15px] text-[#4db2ff] shrink-0">
														leaderboard
													</span>
													<span>{t('paywall.free_credits_leaderboard_info')}</span>
												</div>
											</div>

											<div class="mt-3 flex gap-2">
												<button
													type="button"
													onClick={openGroup}
													class="flex-1 flex items-center justify-center gap-1.5 rounded-[8px] frag-btn-primary py-2.5 px-3 text-[12.5px] font-semibold cursor-pointer"
												>
													<span>{t('paywall.free_credits_join_group')}</span>
												</button>
												<button
													type="button"
													onClick={goToLeaderboard}
													class="flex items-center justify-center gap-1.5 rounded-[8px] bg-[#212a33] hover:bg-[#1a2026] text-white py-2.5 px-3 text-[12.5px] font-semibold cursor-pointer"
												>
													<span>{t('paywall.free_credits_view_leaderboard')}</span>
												</button>
											</div>
										</div>
									</div>
								</Show>
							</Show>
						</Show>
					</div>
				</div>
			</Portal>
		</Show>
	);
};
