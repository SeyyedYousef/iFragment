import { type Component, createSignal, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { creditsApi } from '@/entities/intel/api/creditsApi.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import type { PaywallVertical } from './theme.js';
import { verticalThemes } from './theme.js';
import { useWallet } from './useWallet.js';

interface CreditStoreSheetProps {
	open: boolean;
	onClose: () => void;
	vertical: PaywallVertical;
}

type Tab = 'stars' | 'free';

const tg = () =>
	typeof window !== 'undefined'
		? (window as unknown as {
				Telegram?: {
					WebApp?: {
						openInvoice?: (l: string) => void;
						openTelegramLink?: (url: string) => void;
					};
				};
			}).Telegram?.WebApp
		: undefined;

export const CreditStoreSheet: Component<CreditStoreSheetProps> = (props) => {
	const wallet = useWallet();
	const [tab, setTab] = createSignal<Tab>('stars');
	const [pendingPack, setPendingPack] = createSignal<string | null>(null);
	const [purchaseError, setPurchaseError] = createSignal<string | null>(null);
	let pollTimer: ReturnType<typeof setInterval> | undefined;

	const theme = () => verticalThemes[props.vertical] ?? verticalThemes.general;

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
		try {
			const res = await creditsApi.purchaseCredits('stars', packId);
			if (res.invoice_link) {
				const baseline = wallet.balance() ?? 0;
				tg()?.openInvoice?.(res.invoice_link);
				startBalancePolling(baseline);
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
						style={{ animation: 'fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
					/>
					<div
						class="paywall-sheet absolute inset-x-0 bottom-0 mx-auto max-w-[480px] rounded-t-[24px] border-t border-white/10 bg-[#12141C] px-4 pb-8 pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
						style={{ animation: 'sheet-up 280ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
					>
						<div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />

						<div class="mb-4 flex items-center justify-between">
							<h2 class="text-[16px] font-black tracking-tight text-white">
								{t('paywall.store_title')}
							</h2>
							<button
								type="button"
								onClick={close}
								class="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 transition-colors duration-150 hover:bg-white/[0.12]"
							>
								<span class="material-symbols-outlined text-[18px]">close</span>
							</button>
						</div>

						{/* Tabs */}
						<div class="mb-4 flex gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.04] p-1">
							<button
								type="button"
								onClick={() => {
									haptic.selection();
									setTab('stars');
								}}
								class={`flex-1 rounded-xl py-2 text-xs font-black transition-all duration-150 ${
									tab() === 'stars' ? 'bg-white/[0.12] text-white' : 'text-white/55'
								}`}
							>
								⭐ {t('paywall.store_stars_tab')}
							</button>
							<button
								type="button"
								onClick={() => {
									haptic.selection();
									setTab('free');
								}}
								class={`flex-1 rounded-xl py-2 text-xs font-black transition-all duration-150 ${
									tab() === 'free' ? 'bg-white/[0.12] text-white' : 'text-white/55'
								}`}
							>
								⚡ {t('paywall.store_free_tab')}
							</button>
						</div>

						<Show
							when={!wallet.configFailed()}
							fallback={
								<div class="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-center">
									<p class="text-xs font-bold text-rose-300">{t('paywall.store_config_error')}</p>
									<button
										type="button"
										onClick={() => wallet.refetch()}
										class="mt-2 rounded-xl bg-white/[0.08] px-4 py-1.5 text-xs font-black text-white active:scale-95"
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
										<div class="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
										<div class="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
										<div class="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
									</div>
								}
							>
								{/* ── STARS TAB ── */}
								<Show when={tab() === 'stars'}>
									<div class="space-y-2.5">
										<For each={wallet.config()?.packs ?? []}>
											{(pack) => (
												<button
													type="button"
													disabled={pendingPack() !== null}
													onClick={() => buyPack(pack.id)}
													class={`relative flex w-full items-center justify-between overflow-hidden rounded-2xl border p-4 text-start transition-all duration-150 active:scale-[0.98] disabled:opacity-60 ${
														pack.popular
															? 'border-amber-400/40 bg-gradient-to-r from-amber-400/[0.12] to-transparent'
															: 'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07]'
													}`}
												>
													<div class="flex items-center gap-3">
														<div class="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-lg">
															⭐
														</div>
														<div>
															<div class="flex items-center gap-1.5">
																<span class="font-mono text-[15px] font-black text-white">
																	{pack.credits + pack.bonus_credits}
																</span>
																<span class="text-xs font-bold text-white/60">
																	{t('paywall.credit_unit')}
																</span>
																<Show when={pack.bonus_credits > 0}>
																	<span class="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
																		+{pack.bonus_credits}
																	</span>
																</Show>
															</div>
															<Show when={pack.popular}>
																<div class="mt-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
																	{t('paywall.pack_popular')}
																</div>
															</Show>
															<Show when={pack.best_value}>
																<div class="mt-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">
																	{t('paywall.pack_best_value')}
																</div>
															</Show>
														</div>
													</div>
													<div class="shrink-0">
														<Show
															when={pendingPack() !== pack.id}
															fallback={
																<span class="material-symbols-outlined animate-spin text-[18px] text-white/70">
																	progress_activity
																</span>
															}
														>
															<span class="rounded-xl bg-black/30 px-3 py-1.5 font-mono text-xs font-black text-amber-300">
																{pack.stars_price}★
															</span>
														</Show>
													</div>
												</button>
											)}
										</For>
									</div>
								</Show>

								{/* ── FREE CREDITS TAB ── */}
								<Show when={tab() === 'free'}>
									<div class="space-y-3">
										{/* Highlight Banner */}
										<div class="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/[0.12] to-transparent p-4">
											<div class="flex items-center gap-3 mb-3">
												<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-400/20 text-emerald-300">
													<span class="material-symbols-outlined text-[22px]">bolt</span>
												</div>
												<div>
													<h3 class="text-xs font-black text-white">
														{t('paywall.free_credits_title')}
													</h3>
													<p class="mt-0.5 text-[10px] font-medium leading-relaxed text-white/60">
														{t('paywall.free_credits_subtitle')}
													</p>
												</div>
											</div>

											{/* Rewards Breakdown */}
											<div class="space-y-2 rounded-xl bg-black/30 p-3 border border-white/5">
												<div class="flex items-center gap-2.5 text-[11px] font-bold text-white/90">
													<span class="material-symbols-outlined text-[16px] text-emerald-400 shrink-0">
														chat
													</span>
													<span>{t('paywall.free_credits_rule_msg')}</span>
												</div>
												<div class="flex items-center gap-2.5 text-[11px] font-bold text-white/90">
													<span class="material-symbols-outlined text-[16px] text-amber-400 shrink-0">
														rocket_launch
													</span>
													<span>{t('paywall.free_credits_rule_boost')}</span>
												</div>
												<div class="flex items-center gap-2.5 text-[11px] font-bold text-white/90">
													<span class="material-symbols-outlined text-[16px] text-[#0098EA] shrink-0">
														leaderboard
													</span>
													<span>{t('paywall.free_credits_leaderboard_info')}</span>
												</div>
											</div>

											{/* CTAs */}
											<div class="mt-3.5 flex flex-col sm:flex-row gap-2">
												<button
													type="button"
													onClick={openGroup}
													class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 px-3 text-xs font-black text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-95 hover:brightness-110"
												>
													<span class="material-symbols-outlined text-[16px]">groups</span>
													<span>{t('paywall.free_credits_join_group')}</span>
												</button>
												<button
													type="button"
													onClick={goToLeaderboard}
													class="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.08] py-2.5 px-3 text-xs font-black text-white/90 transition-all active:scale-95 hover:bg-white/[0.14]"
												>
													<span class="material-symbols-outlined text-[16px]">leaderboard</span>
													<span>{t('paywall.free_credits_view_leaderboard')}</span>
												</button>
											</div>
										</div>

										<Show when={purchaseError()}>
											<div class="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs font-bold text-rose-300">
												{purchaseError()}
											</div>
										</Show>

										{/* Utility education card */}
										<div class="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
											<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
												<span class="material-symbols-outlined text-[18px] text-white/70">
													shield_person
												</span>
											</div>
											<div>
												<div class="text-xs font-black text-white">
													{t('paywall.plan_utility_title')}
												</div>
												<div class="mt-0.5 text-[10px] font-medium leading-relaxed text-white/60">
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
