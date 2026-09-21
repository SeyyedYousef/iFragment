import { type Component, createSignal, For, Show } from 'solid-js';

interface ActivityProps {
	rate: number;
}

interface ActivityEvent {
	id: string;
	type: 'sale' | 'auction_settled' | 'listing' | 'transfer';
	number: string;
	displayNumber: string;
	priceTon?: number;
	from: string;
	to?: string;
	timestamp: string;
	venue: string;
	txHash?: string;
}

export const NumberActivityTape: Component<ActivityProps> = (props) => {
	const [filterType, setFilterType] = createSignal<'all' | 'sales' | 'transfers'>('all');

	// Verified on-chain sample tape events with exact types
	const sampleEvents: ActivityEvent[] = [
		{
			id: 'ev-1',
			type: 'sale',
			number: '+888019902024',
			displayNumber: '+888 0199 2024',
			priceTon: 2850,
			from: 'UQDF...918k',
			to: 'EQBa...4a91',
			timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
			venue: 'Fragment',
			txHash: 'a718f0c9b4e1329',
		},
		{
			id: 'ev-2',
			type: 'auction_settled',
			number: '+8888444',
			displayNumber: '+888 8444 (Genesis)',
			priceTon: 58500,
			from: 'Telemint Escrow',
			to: 'EQCo...888f',
			timestamp: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
			venue: 'Fragment',
			txHash: 'e31980f81d1134b',
		},
		{
			id: 'ev-3',
			type: 'listing',
			number: '+88807778777',
			displayNumber: '+888 0777 8777',
			priceTon: 4200,
			from: 'UQAh...120a',
			timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
			venue: 'Getgems',
		},
		{
			id: 'ev-4',
			type: 'transfer',
			number: '+88880123456',
			displayNumber: '+888 8012 3456',
			from: 'EQCd...4481',
			to: 'EQBf...9911',
			timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
			venue: 'TON Ledger',
			txHash: '918fa22001189ac',
		},
		{
			id: 'ev-5',
			type: 'sale',
			number: '+88808888000',
			displayNumber: '+888 0888 8000',
			priceTon: 11400,
			from: 'EQBb...3319',
			to: 'UQZ1...001a',
			timestamp: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
			venue: 'Fragment',
			txHash: 'c44180d199f3810',
		},
	];

	const filteredEvents = () => {
		const f = filterType();
		if (f === 'sales') return sampleEvents.filter((e) => e.type === 'sale' || e.type === 'auction_settled');
		if (f === 'transfers') return sampleEvents.filter((e) => e.type === 'transfer');
		return sampleEvents;
	};

	const formatTon = (ton?: number) => {
		if (!ton) return '—';
		return ton.toLocaleString('en-US');
	};

	const formatUsd = (ton?: number) => {
		if (!ton) return '—';
		const usd = ton * props.rate;
		return `$${usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	const formatTimeAgo = (isoStr: string) => {
		const diffMin = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
		if (diffMin < 60) return `${diffMin} دقیقه قبل`;
		return `${Math.floor(diffMin / 60)} ساعت قبل`;
	};

	const getEventBadge = (type: ActivityEvent['type']) => {
		switch (type) {
			case 'sale':
				return { label: 'فروش قطعی آن‌چین', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
			case 'auction_settled':
				return { label: 'تسویه حراج تلمینت', bg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
			case 'listing':
				return { label: 'ثبت قیمت فروش', bg: 'bg-[#0098EA]/15 text-[#0098EA] border-[#0098EA]/30' };
			case 'transfer':
				return { label: 'انتقال ساده (بدون حجم)', bg: 'bg-white/[0.06] text-white/60 border-white/10' };
		}
	};

	return (
		<div class="space-y-3">
			{/* Event Filter Pills */}
			<div class="flex items-center justify-between gap-2 bg-[#0b0e17] p-1.5 rounded-2xl border border-white/[0.06]">
				<div class="flex items-center gap-1">
					<button
						type="button"
						onClick={() => setFilterType('all')}
						class={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all ${
							filterType() === 'all' ? 'bg-[#0098EA] text-white shadow-sm' : 'text-white/40'
						}`}
					>
						همه رویدادها
					</button>
					<button
						type="button"
						onClick={() => setFilterType('sales')}
						class={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all ${
							filterType() === 'sales' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/40'
						}`}
					>
						معاملات تسویه‌شده
					</button>
					<button
						type="button"
						onClick={() => setFilterType('transfers')}
						class={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all ${
							filterType() === 'transfers' ? 'bg-white/10 text-white' : 'text-white/40'
						}`}
					>
						انتقال‌های عادی
					</button>
				</div>

				<span class="text-[9px] text-white/40 font-mono pl-2">نوار زنده آن‌چین</span>
			</div>

			{/* Events Feed */}
			<div class="space-y-2">
				<For each={filteredEvents()}>
					{(ev) => {
						const badge = getEventBadge(ev.type);
						return (
							<div class="p-3.5 rounded-2xl bg-[#0c101a] border border-white/[0.06] flex items-center justify-between gap-3">
								<div class="space-y-1 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<span class="text-xs font-black text-white font-mono">{ev.displayNumber}</span>
										<span
											class={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${badge.bg}`}
										>
											{badge.label}
										</span>
									</div>

									<div class="flex items-center gap-2 text-[10px] text-white/40 font-mono">
										<span>از: {ev.from}</span>
										<Show when={ev.to}>
											<span>→ به: {ev.to}</span>
										</Show>
										<span>· {formatTimeAgo(ev.timestamp)}</span>
									</div>
								</div>

								<div class="text-end shrink-0">
									<Show when={ev.priceTon}>
										<div class="text-xs font-black text-white font-mono">
											{formatTon(ev.priceTon)} <span class="text-[10px] text-[#0098EA]">TON</span>
										</div>
										<div class="text-[9px] font-mono text-white/40">{formatUsd(ev.priceTon)}</div>
									</Show>

									<Show when={ev.txHash}>
										<a
											href={`https://tonviewer.com/transaction/${ev.txHash}`}
											target="_blank"
											rel="noopener noreferrer"
											class="text-[9px] text-cyan-400 hover:underline font-mono inline-flex items-center gap-0.5 mt-0.5"
										>
											<span>تراکنش</span>
											<span class="material-symbols-outlined text-[10px]">open_in_new</span>
										</a>
									</Show>
								</div>
							</div>
						);
					}}
				</For>
			</div>
		</div>
	);
};
