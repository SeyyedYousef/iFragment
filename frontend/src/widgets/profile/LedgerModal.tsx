import { Motion } from '@motionone/solid';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { getLedger, type LedgerEvent } from '@/entities/user/index.js';
import { formatNumber, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	onClose: () => void;
}

type LedgerCategory = 'all' | 'coins' | 'credits' | 'stars' | 'subscription';

export const LedgerModal: Component<Props> = (props) => {
	const [activeCategory, setActiveCategory] = createSignal<LedgerCategory>('all');
	const [selectedEvent, setSelectedEvent] = createSignal<LedgerEvent | null>(null);

	const ledgerQuery = createQuery(() => ({
		queryKey: ['profile', 'ledger', activeCategory()],
		queryFn: () => getLedger(activeCategory(), undefined, 50),
		staleTime: 10_000,
	}));

	const events = createMemo(() => ledgerQuery.data?.events || []);
	const loading = () => ledgerQuery.isLoading;

	const handleCategoryChange = (cat: LedgerCategory) => {
		try {
			haptic.selection();
		} catch {}
		setActiveCategory(cat);
	};

	const handleSelectEvent = (ev: LedgerEvent) => {
		try {
			haptic.impact('light');
		} catch {}
		setSelectedEvent(ev);
	};

	const getEventColor = (category: string, amount: number) => {
		if (amount > 0) return 'text-[#4cd964]';
		if (amount < 0) return 'text-[#ff5c6c]';
		switch (category) {
			case 'stars':
				return 'text-[#ffb340]';
			case 'credits':
				return 'text-[#5aaeff]';
			default:
				return 'text-white';
		}
	};

	const getEventIcon = (eventType: string, category: string) => {
		if (eventType.startsWith('earn_taps') || eventType.startsWith('earn_offline'))
			return 'touch_app';
		if (eventType.startsWith('earn_streak') || eventType.startsWith('earn_combo'))
			return 'local_fire_department';
		if (eventType.startsWith('earn_task')) return 'task_alt';
		if (eventType.startsWith('earn_referral')) return 'group_add';
		if (eventType.startsWith('earn_emoji')) return 'star';
		if (eventType.startsWith('spend_report')) return 'analytics';
		if (eventType.startsWith('spend_booster')) return 'rocket_launch';
		if (eventType.startsWith('spend_cosmetic')) return 'palette';
		if (category === 'stars') return 'hotel_class';
		if (category === 'credits') return 'verified';
		return 'account_balance_wallet';
	};

	const formatEventDate = (dateStr: string) => {
		try {
			const d = new Date(dateStr);
			return d.toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			});
		} catch {
			return dateStr;
		}
	};

	return (
		<div
			class="fixed inset-0 z-[120] flex flex-col justify-end px-2 pb-2"
			role="button"
			tabIndex={0}
			aria-label="Close"
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === 'Escape') props.onClose();
			}}
			onClick={props.onClose}
		>
			{/* Backdrop */}
			<div class="absolute inset-0 bg-[#0b0e14]/85 backdrop-blur-xl transition-opacity" />

			{/* Sheet Container */}
			<Motion.div
				initial={{ y: '100%', opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 0.32, easing: [0.32, 0.72, 0, 1] }}
				class="frag-sheet relative rounded-[26px] p-5 pb-7 w-full max-w-md max-h-[85vh] overflow-hidden mx-auto flex flex-col gap-4"
				onClick={(e: Event) => e.stopPropagation()}
			>
				{/* Handle */}
				<div class="w-10 h-1 bg-white/15 rounded-full mx-auto shrink-0" />

				{/* Header */}
				<div class="flex items-center justify-between shrink-0">
					<div class="flex items-center gap-2.5">
						<div class="w-9 h-9 rounded-xl bg-[#141a22] border border-[#2990ff]/25 flex items-center justify-center text-[#5aaeff]">
							<span class="material-symbols-outlined text-[20px]">receipt_long</span>
						</div>
						<div class="flex flex-col">
							<h3 class="text-white text-[17px] font-bold tracking-tight">
								{t('ledger.title' as any) || 'Financial Ledger'}
							</h3>
							<span class="text-[11px] text-[#8ca0b5] font-medium">
								{t('ledger.subtitle' as any) || 'All transactions and events'}
							</span>
						</div>
					</div>

					<button
						type="button"
						onClick={props.onClose}
						class="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-[#8ca0b5] active:scale-95 transition-all"
					>
						<span class="material-symbols-outlined text-[18px]">close</span>
					</button>
				</div>

				{/* Category Filter Chips */}
				<div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
					<For
						each={
							[
								{ id: 'all', label: t('ledger.all' as any) || 'All' },
								{ id: 'coins', label: t('ledger.coins' as any) || 'Coins' },
								{ id: 'credits', label: t('ledger.credits' as any) || 'Credits' },
								{ id: 'stars', label: t('ledger.stars' as any) || 'Stars' },
							] as const
						}
					>
						{(cat) => (
							<button
								type="button"
								onClick={() => handleCategoryChange(cat.id as LedgerCategory)}
								class={`px-3.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap active:scale-95 border ${
									activeCategory() === cat.id
										? 'bg-[#2990ff] text-white border-[#2990ff] shadow-[0_4px_12px_rgba(41,144,255,0.28)]'
										: 'frag-inset text-[#8ca0b5] hover:text-white hover:border-white/[0.15]'
								}`}
							>
								{cat.label}
							</button>
						)}
					</For>
				</div>

				{/* Transaction List */}
				<div class="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2 min-h-[280px]">
					<Show
						when={!loading()}
						fallback={
							<div class="flex flex-col gap-2 py-3 animate-pulse">
								<div class="h-14 bg-white/[0.05] rounded-xl" />
								<div class="h-14 bg-white/[0.05] rounded-xl" />
								<div class="h-14 bg-white/[0.05] rounded-xl" />
							</div>
						}
					>
						<Show
							when={events().length > 0}
							fallback={
								<div class="flex flex-col items-center justify-center gap-2 py-16 text-center">
									<span class="material-symbols-outlined text-[38px] text-[#738598]">
										history_toggle_off
									</span>
									<span class="text-[#8ca0b5] text-[12px] font-medium">
										{t('ledger.noTransactions' as any) || 'No transactions found'}
									</span>
								</div>
							}
						>
							<For each={events()}>
								{(ev) => (
									<button
										type="button"
										onClick={() => handleSelectEvent(ev)}
										class="frag-inset w-full p-3 hover:bg-white/[0.04] hover:border-white/[0.14] active:scale-[0.99] rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all text-start"
									>
										<div class="flex items-center gap-3 min-w-0">
											<div class="w-9 h-9 rounded-xl bg-[#1b232d] border border-white/[0.08] flex items-center justify-center text-[#c2cfde] shrink-0">
												<span class="material-symbols-outlined text-[18px]">
													{getEventIcon(ev.eventType, ev.category)}
												</span>
											</div>
											<div class="flex flex-col min-w-0">
												<span class="text-[13px] font-semibold text-white truncate tracking-tight">
													{ev.title || ev.eventType}
												</span>
												<span class="text-[11px] text-[#738598] font-mono tabular-nums">
													{formatEventDate(ev.createdAt)}
												</span>
											</div>
										</div>

										<div class="flex flex-col items-end shrink-0">
											<span
												dir="ltr"
												class={`text-[13px] font-semibold font-mono tracking-tight tabular-nums ${getEventColor(ev.category, ev.amount)}`}
											>
												{ev.amount > 0
													? `+${formatNumber(ev.amount)}`
													: ev.amount < 0
														? formatNumber(ev.amount)
														: '0'}
											</span>
											<span class="text-[10px] font-medium text-[#738598]">{ev.category}</span>
										</div>
									</button>
								)}
							</For>
						</Show>
					</Show>
				</div>
			</Motion.div>

			{/* Receipt Details Modal */}
			<Show when={selectedEvent()}>
				<div
					class="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-[#0b0e14]/85 backdrop-blur-md"
					role="button"
					tabIndex={0}
					onKeyDown={(e) => {
						if (e.key === 'Enter') (e.currentTarget as HTMLElement).click();
						else if (e.key === 'Escape') setSelectedEvent(null);
					}}
					onClick={() => setSelectedEvent(null)}
				>
					<div
						class="frag-sheet border border-white/[0.1] rounded-2xl p-5 w-full max-w-sm flex flex-col gap-4 relative overflow-hidden"
						role="button"
						tabIndex={0}
						onKeyDown={(e) => {
							if (e.key === 'Enter') (e.currentTarget as HTMLElement).click();
						}}
						onClick={(e: Event) => e.stopPropagation()}
					>
						{/* Top Icon */}
						<div class="w-13 h-13 rounded-2xl bg-[#141a22] border border-[#2990ff]/25 flex items-center justify-center text-[#5aaeff] mx-auto">
							<span class="material-symbols-outlined text-[26px]">
								{getEventIcon(selectedEvent()!.eventType, selectedEvent()!.category)}
							</span>
						</div>

						<div class="text-center flex flex-col gap-1">
							<h4 class="text-white text-[16px] font-bold tracking-tight">
								{selectedEvent()!.title || selectedEvent()!.eventType}
							</h4>
							<span dir="ltr" class="text-[#738598] text-[11px] font-mono">
								{selectedEvent()!.referenceId || selectedEvent()!.id}
							</span>
						</div>

						{/* Amount Banner */}
						<div class="frag-inset rounded-xl p-4 flex flex-col items-center justify-center gap-1">
							<span class="text-[11px] font-medium text-[#8ca0b5]">
								{t('ledger.amount' as any) || 'Amount'}
							</span>
							<span
								dir="ltr"
								class={`text-[24px] font-bold font-mono tabular-nums ${getEventColor(selectedEvent()!.category, selectedEvent()!.amount)}`}
							>
								{selectedEvent()!.amount > 0
									? `+${formatNumber(selectedEvent()!.amount)}`
									: formatNumber(selectedEvent()!.amount)}
							</span>
						</div>

						{/* Breakdown Fields */}
						<div class="flex flex-col gap-2 text-[12px] frag-inset rounded-xl p-3.5">
							<div class="flex justify-between items-center text-[#8ca0b5]">
								<span>{t('ledger.category' as any) || 'Category'}</span>
								<span class="text-white font-semibold">{selectedEvent()!.category}</span>
							</div>
							<div class="flex justify-between items-center text-[#8ca0b5]">
								<span>{t('ledger.status' as any) || 'Status'}</span>
								<span class="text-[#4cd964] font-semibold flex items-center gap-1">
									<span class="material-symbols-outlined text-[14px]">check_circle</span>
									{selectedEvent()!.status}
								</span>
							</div>
							<div class="flex justify-between items-center text-[#8ca0b5]">
								<span>{t('ledger.date' as any) || 'Timestamp'}</span>
								<span dir="ltr" class="text-[#c2cfde] font-mono text-[11px] tabular-nums">
									{formatEventDate(selectedEvent()!.createdAt)}
								</span>
							</div>
							<Show
								when={selectedEvent()!.balanceBefore !== 0 || selectedEvent()!.balanceAfter !== 0}
							>
								<div class="h-[1px] bg-white/[0.06] my-0.5" />
								<div class="flex justify-between items-center text-[#8ca0b5]">
									<span>{t('ledger.before' as any) || 'Balance Before'}</span>
									<span dir="ltr" class="text-[#c2cfde] font-mono tabular-nums">
										{formatNumber(selectedEvent()!.balanceBefore)}
									</span>
								</div>
								<div class="flex justify-between items-center text-[#8ca0b5]">
									<span>{t('ledger.after' as any) || 'Balance After'}</span>
									<span dir="ltr" class="text-white font-mono font-semibold tabular-nums">
										{formatNumber(selectedEvent()!.balanceAfter)}
									</span>
								</div>
							</Show>
						</div>

						{/* Close Button */}
						<button
							type="button"
							onClick={() => setSelectedEvent(null)}
							class="frag-btn-secondary w-full py-3 rounded-xl text-white font-semibold text-[13px] active:scale-95 transition-all"
						>
							{t('common.close' as any) || 'Close'}
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};
