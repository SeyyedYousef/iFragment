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
						class="absolute inset-0 bg-black/75 backdrop-blur-sm"
						style={{ animation: 'fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
					/>
					<div
						class="paywall-sheet frag-sheet absolute inset-x-0 bottom-0 mx-auto max-w-[480px] rounded-t-[24px] px-4 pb-8 pt-3"
						style={{ animation: 'sheet-up 280ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
					>
						<div class="mx-auto mb-3 h-1 w-9 rounded-full bg-white/20" />

						<div class="mb-4 flex items-center justify-between gap-3">
							<h2 class="text-[16px] font-semibold tracking-[-0.015em] text-white">
								{t('paywall.store_title')}
							</h2>
							<button
								type="button"
								onClick={close}
								class="flex h-8 w-8 items-center justify-center rounded-[10px] frag-btn-secondary text-[#8c9ba5] hover:text-white"
							>
								<span class="material-symbols-outlined text-[18px]">close</span>
							</button>
						</div>

						{/* Segmented Tabs */}
						<div class="mb-4 grid grid-cols-2 gap-1 rounded-[12px] frag-inset p-1">
							<button
								type="button"
								onClick={() => {
									haptic.selection();
									setTab('stars');
								}}
								class={`flex items-center justify-center gap-1.5 rounded-[9px] py-2 text-[12px] font-semibold transition-all duration-150 ${
									tab() === 'stars'
										? 'bg-[#232d3a] text-white border border-white/[0.08] shadow-sm'
										: 'text-[#8c9ba5] hover:text-white'
								}`}
							>
								<span
									class="material-symbols-outlined text-[15px] text-[#ffb340]"
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
								class={`flex items-center justify-center gap-1.5 rounded-[9px] py-2 text-[12px] font-semibold transition-all duration-150 ${
									tab() === 'free'
										? 'bg-[#232d3a] text-white border border-white/[0.08] shadow-sm'
										: 'text-[#8c9ba5] hover:text-white'
								}`}
							>
								<span class="material-symbols-outlined text-[15px] text-[#4cd964]">bolt</span>
								<span>{t('paywall.store_free_tab')}</span>
							</button>
						</div>

						<Show when={purchaseSuccess()}>
							<div class="mb-3 flex items-center gap-2 rounded-[12px] border border-[#4cd964]/30 bg-[#4cd964]/12 px-3.5 py-2.5 text-[12px] font-medium text-[#7ce88f]">
								<span class="material-symbols-outlined text-[17px] text-[#4cd964] shrink-0">
									check_circle
								</span>
								<span class="font-mono tabular-nums">
									{t('paywall.credit_unit')} — {wallet.balance() ?? 0}
								</span>
							</div>
						</Show>

						<Show when={purchaseError()}>
							<div class="mb-3 rounded-[12px] border border-[#ff5c6c]/30 bg-[#ff5c6c]/10 p-3 text-[12px] font-medium text-[#ff9ca6]">
								{purchaseError()}
							</div>
						</Show>

						<Show
							when={!wallet.configFailed()}
							fallback={
								<div class="rounded-[12px] border border-[#ff5c6c]/30 bg-[#ff5c6c]/10 p-4 text-center">
									<p class="text-[12px] font-medium text-[#ff9ca6]">
										{t('paywall.store_config_error')}
									</p>
									<button
										type="button"
										onClick={() => wallet.refetch()}
										class="mt-2.5 rounded-[8px] frag-btn-secondary px-4 py-1.5 text-[12px] font-semibold text-white active:scale-95"
									>
										{t('paywall.retry')}
									</button>
								</div>
							}
						>
							<Show
								when={wallet.config()}
								fallback={
									<div class="space-y-2.5" aria-hidden="true">
										<div class="h-16 animate-pulse rounded-[12px] bg-[#1b232d]" />
										<div class="h-16 animate-pulse rounded-[12px] bg-[#1b232d]" />
										<div class="h-16 animate-pulse rounded-[12px] bg-[#1b232d]" />
									</div>
								}
							>
								{/* Stars Packs */}
								<Show when={tab() === 'stars'}>
									<div class="space-y-2">
										<For each={wallet.config()?.packs ?? []}>
											{(pack) => (
												<button
													type="button"
													disabled={pendingPack() !== null}
													onClick={() => buyPack(pack.id)}
													class={`relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-[12px] border p-3.5 text-start transition-all duration-150 active:scale-[0.985] disabled:opacity-55 ${
														pack.popular
															? 'border-[#ffb340]/35 bg-[#1b232d] shadow-[inset_0_1px_0_rgba(255,179,64,0.16)]'
															: 'border-white/[0.07] bg-[#141a22] hover:bg-[#1b232d] hover:border-white/[0.12]'
													}`}
												>
													<div class="flex items-center gap-3 min-w-0">
														<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#ffb340]/25 bg-[#ffb340]/12">
															<span
																class="material-symbols-outlined text-[20px] text-[#ffb340]"
																style={{ 'font-variation-settings': '"FILL" 1' }}
															>
																star
															</span>
														</div>
														<div class="min-w-0">
															<div class="flex items-center gap-1.5 flex-wrap">
																<span class="font-mono text-[15px] font-semibold text-white tabular-nums">
																	{pack.credits + pack.bonus_credits}
																</span>
																<span class="text-[12px] font-medium text-[#8c9ba5]">
																	{t('paywall.credit_unit')}
																</span>
																<Show when={pack.bonus_credits > 0}>
																	<span class="rounded-[5px] border border-[#4cd964]/30 bg-[#4cd964]/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#4cd964] tabular-nums">
																		+{pack.bonus_credits}
																	</span>
																</Show>
															</div>
															<Show when={pack.popular}>
																<div class="mt-0.5 text-[10.5px] font-medium text-[#ffb340]">
																	{t('paywall.pack_popular')}
																</div>
															</Show>
															<Show when={pack.best_value}>
																<div class="mt-0.5 text-[10.5px] font-medium text-[#4cd964]">
																	{t('paywall.pack_best_value')}
																</div>
															</Show>
														</div>
													</div>
													<div class="shrink-0">
														<Show
															when={pendingPack() !== pack.id}
															fallback={
																<span class="material-symbols-outlined animate-spin text-[18px] text-[#8c9ba5]">
																	progress_activity
																</span>
															}
														>
															<span
																dir="ltr"
																class="inline-flex items-center gap-1 rounded-[8px] border border-[#ffb340]/25 bg-[#ffb340]/10 px-2.5 py-1 font-mono text-[12px] font-semibold text-[#ffb340] tabular-nums"
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
										<div class="frag-card rounded-[14px] border-[#4cd964]/25 p-4">
											<div class="flex items-center gap-3 mb-3">
												<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#4cd964]/30 bg-[#4cd964]/12 text-[#4cd964]">
													<span class="material-symbols-outlined text-[20px]">bolt</span>
												</div>
												<div class="min-w-0">
													<h3 class="text-[13px] font-semibold text-white">
														{t('paywall.free_credits_title')}
													</h3>
													<p class="mt-0.5 text-[11px] leading-snug text-[#8c9ba5]">
														{t('paywall.free_credits_subtitle')}
													</p>
												</div>
											</div>

											<div class="space-y-2 frag-inset rounded-[10px] p-3">
												<div class="flex items-center gap-2.5 text-[12px] font-medium text-[#d7e0e8]">
													<span class="material-symbols-outlined text-[16px] text-[#4cd964] shrink-0">
														chat
													</span>
													<span>{t('paywall.free_credits_rule_msg')}</span>
												</div>
												<div class="flex items-center gap-2.5 text-[12px] font-medium text-[#d7e0e8]">
													<span class="material-symbols-outlined text-[16px] text-[#ffb340] shrink-0">
														rocket_launch
													</span>
													<span>{t('paywall.free_credits_rule_boost')}</span>
												</div>
												<div class="flex items-center gap-2.5 text-[12px] font-medium text-[#d7e0e8]">
													<span class="material-symbols-outlined text-[16px] text-[#2990ff] shrink-0">
														leaderboard
													</span>
													<span>{t('paywall.free_credits_leaderboard_info')}</span>
												</div>
											</div>

											<div class="mt-3.5 flex flex-col sm:flex-row gap-2">
												<button
													type="button"
													onClick={openGroup}
													class="flex-1 flex items-center justify-center gap-1.5 rounded-[10px] frag-btn-primary py-2.5 px-3 text-[12px] font-semibold"
												>
													<span class="material-symbols-outlined text-[16px]">groups</span>
													<span>{t('paywall.free_credits_join_group')}</span>
												</button>
												<button
													type="button"
													onClick={goToLeaderboard}
													class="flex items-center justify-center gap-1.5 rounded-[10px] frag-btn-secondary py-2.5 px-3 text-[12px] font-semibold"
												>
													<span class="material-symbols-outlined text-[16px]">leaderboard</span>
													<span>{t('paywall.free_credits_view_leaderboard')}</span>
												</button>
											</div>
										</div>

										<div class="flex items-center gap-3 frag-inset rounded-[12px] p-3.5">
											<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-white/[0.08] bg-white/[0.04]">
												<span class="material-symbols-outlined text-[18px] text-[#8c9ba5]">
													shield_person
												</span>
											</div>
											<div class="min-w-0">
												<div class="text-[12px] font-semibold text-white">
													{t('paywall.plan_utility_title')}
												</div>
												<div class="mt-0.5 text-[11px] leading-snug text-[#8c9ba5]">
													{t('paywall.plan_utility_desc')}
												</div>
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
