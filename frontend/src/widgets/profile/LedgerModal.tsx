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
		if (amount > 0) return 'text-emerald-400';
		if (amount < 0) return 'text-rose-400';
		switch (category) {
			case 'stars':
				return 'text-amber-400';
			case 'credits':
				return 'text-[#0098EA]';
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
			<div class="absolute inset-0 bg-[#030303]/90 backdrop-blur-2xl transition-opacity" />

			{/* Sheet Container */}
			<Motion.div
				initial={{ y: '100%', opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 0.32, easing: [0.32, 0.72, 0, 1] }}
				class="relative bg-[#0D1017] border border-white/10 rounded-[32px] p-5 pb-8 w-full max-w-md max-h-[85vh] overflow-hidden mx-auto flex flex-col gap-4 shadow-[0_20px_60px_rgba(0,0,0,0.9)]"
				onClick={(e: Event) => e.stopPropagation()}
			>
				{/* Handle */}
				<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto shrink-0" />

				{/* Header */}
				<div class="flex items-center justify-between shrink-0">
					<div class="flex items-center gap-2.5">
						<div class="w-9 h-9 rounded-[12px] bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center text-[#0098EA]">
							<span class="material-symbols-outlined text-[20px]">receipt_long</span>
						</div>
						<div class="flex flex-col">
							<h3 class="text-white text-[17px] font-black tracking-tight">
								{t('ledger.title' as any) || 'Financial Ledger'}
							</h3>
							<span class="text-[10px] text-white/40 font-bold uppercase tracking-wider">
								{t('ledger.subtitle' as any) || 'All transactions and events'}
							</span>
						</div>
					</div>

					<button
						type="button"
						onClick={props.onClose}
						class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 active:scale-95 transition-all"
					>
						<span class="material-symbols-outlined text-[18px]">close</span>
					</button>
				</div>

				{/* Category Filter Chips */}
				<div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 shrink-0">
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
								class={`px-3.5 py-1.5 rounded-[12px] text-[11px] font-black transition-all whitespace-nowrap active:scale-95 border ${
									activeCategory() === cat.id
										? 'bg-[#0098EA] text-black border-[#0098EA] shadow-[0_0_12px_rgba(0,152,234,0.4)]'
										: 'bg-[#07090E] text-white/60 border-white/5 hover:text-white hover:border-white/10'
								}`}
							>
								{cat.label}
							</button>
						)}
					</For>
				</div>

				{/* Transaction List */}
				<div class="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2 min-h-[300px]">
					<Show
						when={!loading()}
						fallback={
							<div class="flex flex-col gap-2 py-4 animate-pulse">
								<div class="h-14 bg-white/5 rounded-[18px]" />
								<div class="h-14 bg-white/5 rounded-[18px]" />
								<div class="h-14 bg-white/5 rounded-[18px]" />
							</div>
						}
					>
						<Show
							when={events().length > 0}
							fallback={
								<div class="flex flex-col items-center justify-center gap-2 py-16 text-center">
									<span class="material-symbols-outlined text-[40px] text-white/20">
										history_toggle_off
									</span>
									<span class="text-white/40 text-[12px] font-bold">
										{t('ledger.noTransactions' as any) || 'No transactions found'}
									</span>
								</div>
							}
						>
							<For each={events()}>
								{(ev) => (
									<div
										role="button"
										tabIndex={0}
										onKeyDown={(e) => {
											if (e.key === 'Enter') handleSelectEvent(ev);
										}}
										onClick={() => handleSelectEvent(ev)}
										class="p-3 bg-[#07090E] hover:bg-white/5 active:scale-[0.99] border border-white/5 hover:border-white/10 rounded-[18px] flex items-center justify-between gap-3 cursor-pointer transition-all shadow-sm"
									>
										<div class="flex items-center gap-3 min-w-0">
											<div class="w-9 h-9 rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white/70 shrink-0">
												<span class="material-symbols-outlined text-[18px]">
													{getEventIcon(ev.eventType, ev.category)}
												</span>
											</div>
											<div class="flex flex-col min-w-0">
												<span class="text-[13px] font-black text-white truncate tracking-tight">
													{ev.title || ev.eventType}
												</span>
												<span class="text-[10px] text-white/40 font-mono">
													{formatEventDate(ev.createdAt)}
												</span>
											</div>
										</div>

										<div class="flex flex-col items-end shrink-0">
											<span
												class={`text-[13px] font-black font-mono tracking-tight ${getEventColor(ev.category, ev.amount)}`}
											>
												{ev.amount > 0
													? `+${formatNumber(ev.amount)}`
													: ev.amount < 0
														? formatNumber(ev.amount)
														: '0'}
											</span>
											<span class="text-[9px] uppercase font-bold text-white/30 tracking-wider">
												{ev.category}
											</span>
										</div>
									</div>
								)}
							</For>
						</Show>
					</Show>
				</div>
			</Motion.div>

			{/* ═══════ RECEIPT DETAILS MODAL ═══════ */}
			<Show when={selectedEvent()}>
				<div
					class="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
					role="button"
					tabIndex={0}
					onKeyDown={(e) => {
						if (e.key === 'Enter') (e.currentTarget as HTMLElement).click();
						else if (e.key === 'Escape') setSelectedEvent(null);
					}}
					onClick={() => setSelectedEvent(null)}
				>
					<div
						class="bg-[#12141C] border border-white/10 rounded-[28px] p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl relative overflow-hidden"
						role="button"
						tabIndex={0}
						onKeyDown={(e) => {
							if (e.key === 'Enter') (e.currentTarget as HTMLElement).click();
						}}
						onClick={(e: Event) => e.stopPropagation()}
					>
						{/* Top Icon */}
						<div class="w-14 h-14 rounded-[20px] bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center text-[#0098EA] mx-auto shadow-inner">
							<span class="material-symbols-outlined text-[28px]">
								{getEventIcon(selectedEvent()!.eventType, selectedEvent()!.category)}
							</span>
						</div>

						<div class="text-center flex flex-col gap-1">
							<h4 class="text-white text-[16px] font-black tracking-tight">
								{selectedEvent()!.title || selectedEvent()!.eventType}
							</h4>
							<span class="text-white/40 text-[11px] font-mono">
								{selectedEvent()!.referenceId || selectedEvent()!.id}
							</span>
						</div>

						{/* Amount Banner */}
						<div class="bg-[#07090E] border border-white/5 rounded-[18px] p-4 flex flex-col items-center justify-center gap-1 shadow-inner">
							<span class="text-[10px] font-bold text-white/40 uppercase tracking-widest">
								{t('ledger.amount' as any) || 'Amount'}
							</span>
							<span
								class={`text-[24px] font-black font-mono ${getEventColor(selectedEvent()!.category, selectedEvent()!.amount)}`}
							>
								{selectedEvent()!.amount > 0
									? `+${formatNumber(selectedEvent()!.amount)}`
									: formatNumber(selectedEvent()!.amount)}
							</span>
						</div>

						{/* Breakdown Fields */}
						<div class="flex flex-col gap-2 text-[12px] bg-[#07090E] border border-white/5 rounded-[18px] p-3.5">
							<div class="flex justify-between items-center text-white/60">
								<span>{t('ledger.category' as any) || 'Category'}</span>
								<span class="text-white font-bold uppercase">{selectedEvent()!.category}</span>
							</div>
							<div class="flex justify-between items-center text-white/60">
								<span>{t('ledger.status' as any) || 'Status'}</span>
								<span class="text-emerald-400 font-bold uppercase flex items-center gap-1">
									<span class="material-symbols-outlined text-[14px]">check_circle</span>
									{selectedEvent()!.status}
								</span>
							</div>
							<div class="flex justify-between items-center text-white/60">
								<span>{t('ledger.date' as any) || 'Timestamp'}</span>
								<span class="text-white/80 font-mono text-[11px]">
									{formatEventDate(selectedEvent()!.createdAt)}
								</span>
							</div>
							<Show
								when={selectedEvent()!.balanceBefore !== 0 || selectedEvent()!.balanceAfter !== 0}
							>
								<div class="h-[1px] bg-white/5 my-1" />
								<div class="flex justify-between items-center text-white/60">
									<span>{t('ledger.before' as any) || 'Balance Before'}</span>
									<span class="text-white/70 font-mono">
										{formatNumber(selectedEvent()!.balanceBefore)}
									</span>
								</div>
								<div class="flex justify-between items-center text-white/60">
									<span>{t('ledger.after' as any) || 'Balance After'}</span>
									<span class="text-white font-mono font-bold">
										{formatNumber(selectedEvent()!.balanceAfter)}
									</span>
								</div>
							</Show>
						</div>

						{/* Close Button */}
						<button
							type="button"
							onClick={() => setSelectedEvent(null)}
							class="w-full py-3 rounded-[16px] bg-white/10 hover:bg-white/15 active:scale-95 text-white font-black text-[13px] tracking-wide transition-all border border-white/10"
						>
							{t('common.close' as any) || 'Close'}
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};
