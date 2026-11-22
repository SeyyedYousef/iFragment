import { useNavigate } from '@solidjs/router';
import { type Component, For, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { TonAmount } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { type EndingSoonAuctionItem, formatEnNumber } from './homeMarketData.js';

interface EndingSoonWidgetProps {
	items: EndingSoonAuctionItem[];
	loading: boolean;
}

export const EndingSoonWidget: Component<EndingSoonWidgetProps> = (props) => {
	const navigate = useNavigate();

	const openAuction = (item: EndingSoonAuctionItem) => {
		try {
			haptic.impact('light');
		} catch {}
		navigate(item.route);
	};

	return (
		<section class="w-full mb-5" aria-label={t('home.endingSoonTitle')}>
			<div class="flex items-center justify-between px-1 mb-2">
				<div class="flex items-center gap-2">
					<span class="w-2 h-2 rounded-full bg-[#ff9953] animate-pulse shrink-0" />
					<h2 class="text-[15px] font-semibold text-white">{t('home.endingSoonTitle')}</h2>
				</div>
				<button
					type="button"
					onClick={() => navigate('/collection-info')}
					class="text-[12px] font-semibold text-[#4db2ff] hover:text-[#66beff] transition-colors cursor-pointer flex items-center gap-0.5"
				>
					<span>{t('home.endingSoonAll')}</span>
					<span class="material-symbols-outlined text-[15px] rtl:rotate-180">chevron_right</span>
				</button>
			</div>

			<div class="frag-table-container divide-y divide-[#1a2026]">
				<Show
					when={!props.loading}
					fallback={
						<For each={[0, 1, 2]}>
							{() => (
								<div class="px-3.5 py-3 flex items-center justify-between gap-3 animate-pulse">
									<div class="flex items-center gap-3 min-w-0">
										<div class="w-8 h-8 rounded-[6px] bg-[#293440] shrink-0" />
										<div class="flex flex-col gap-1.5">
											<div class="w-24 h-3.5 rounded bg-[#293440]" />
											<div class="w-16 h-2.5 rounded bg-[#242e38]" />
										</div>
									</div>
									<div class="flex flex-col items-end gap-1.5">
										<div class="w-16 h-3.5 rounded bg-[#293440]" />
										<div class="w-12 h-3 rounded bg-[#242e38]" />
									</div>
								</div>
							)}
						</For>
					}
				>
					<Show
						when={props.items.length > 0}
						fallback={
							<div class="px-4 py-4 text-center text-[12.5px] text-[#8c9aa9]">
								{t('home.endingSoonEmpty')}
							</div>
						}
					>
						<For each={props.items.slice(0, 3)}>
							{(item) => (
								<button
									type="button"
									onClick={() => openAuction(item)}
									class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
								>
									<div class="flex items-center gap-3 min-w-0">
										<Show
											when={item.kind === 'gift' && item.imageUrl}
											fallback={
												<div
													class={`w-8 h-8 rounded-[6px] bg-[#242e38] flex items-center justify-center shrink-0 font-semibold text-[15px] ${
														item.kind === 'gift' ? 'text-[#ff9953]' : 'text-[#4db2ff]'
													}`}
												>
													<Show
														when={item.kind === 'username'}
														fallback={
															<span class="material-symbols-outlined text-[17px]">
																featured_seasonal_and_gifts
															</span>
														}
													>
														@
													</Show>
												</div>
											}
										>
											<img
												src={item.imageUrl}
												alt={item.title}
												class="w-8 h-8 rounded-[6px] bg-[#242e38] object-cover shrink-0"
												loading="lazy"
											/>
										</Show>

										<div class="flex flex-col min-w-0">
											<span class="text-[13.5px] font-semibold text-white truncate" dir="ltr">
												{item.title}
											</span>
											<span class="text-[11.5px] text-[#8c9aa9] truncate">
												{item.kind === 'gift'
													? t('home.endingSoonGift')
													: t('home.endingSoonUsername')}
											</span>
										</div>
									</div>

									<div class="flex items-center gap-2 shrink-0">
										<div class="flex flex-col items-end gap-1">
											<Show when={item.priceTon > 0}>
												<TonAmount value={formatEnNumber(item.priceTon, 1)} size="sm" />
											</Show>
											<span
												class="px-1.5 py-0.5 rounded-[4px] bg-[#ff9953]/12 text-[#ff9953] text-[10.5px] font-mono font-semibold tabular-nums leading-none"
												dir="ltr"
											>
												{item.timeLeft}
											</span>
										</div>
										<span class="material-symbols-outlined text-[16px] text-[#8c9aa9] rtl:rotate-180">
											chevron_right
										</span>
									</div>
								</button>
							)}
						</For>
					</Show>
				</Show>
			</div>
		</section>
	);
};
