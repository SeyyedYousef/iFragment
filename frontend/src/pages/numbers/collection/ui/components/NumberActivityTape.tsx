import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/api/numbersApi.js';
import { t } from '@/shared/i18n/index.js';

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

	const activityQuery = createQuery(() => ({
		queryKey: ['numbersLiveActivityTape'],
		queryFn: () => numbersApi.getActivity(),
		staleTime: 30 * 1000,
	}));

	const allEvents = createMemo<ActivityEvent[]>(() => {
		const live = activityQuery.data;
		if (live && Array.isArray(live) && live.length > 0) {
			return live.map((item: Record<string, any>, idx) => {
				const rawType = String(item.event_type || '');
				let type: ActivityEvent['type'] = 'sale';
				if (rawType === 'transfer') type = 'transfer';
				else if (rawType === 'listing') type = 'listing';
				else if (rawType === 'auction_settled' || item.id?.startsWith('frag-sold'))
					type = 'auction_settled';
				return {
					id: item.id || `live-${idx}`,
					type,
					number: item.number,
					displayNumber: item.display_number || item.number,
					priceTon: item.sale_price_ton > 0 ? item.sale_price_ton : undefined,
					from: item.marketplace || 'Fragment',
					to: item.to_address || undefined,
					timestamp: item.sale_date || new Date().toISOString(),
					venue: item.marketplace || 'Fragment',
					txHash: item.tx_hash,
				};
			});
		}
		return [];
	});

	const filteredEvents = () => {
		const f = filterType();
		const list = allEvents();
		if (f === 'sales') return list.filter((e) => e.type === 'sale' || e.type === 'auction_settled');
		if (f === 'transfers') {
			const tr = list.filter((e) => e.type === 'transfer' || e.type === 'listing');
			return tr.length > 0 ? tr : list;
		}
		return list;
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
		const parsed = Date.parse(isoStr);
		if (Number.isNaN(parsed)) return isoStr;
		const diffMin = Math.max(1, Math.floor((Date.now() - parsed) / 60000));
		if (diffMin < 60) return t('numActivityTape.minAgo', { m: diffMin });
		if (diffMin < 1440) return t('numActivityTape.hrAgo', { h: Math.floor(diffMin / 60) });
		return isoStr.slice(0, 10);
	};

	const getEventBadge = (type: ActivityEvent['type']) => {
		switch (type) {
			case 'sale':
				return {
					label: t('numActivityTape.badgeSale'),
					bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
				};
			case 'auction_settled':
				return {
					label: t('numActivityTape.badgeAuction'),
					bg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
				};
			case 'listing':
				return {
					label: t('numActivityTape.badgeListing'),
					bg: 'bg-[#2990ff]/15 text-[#2990ff] border-[#2990ff]/30',
				};
			case 'transfer':
				return {
					label: t('numActivityTape.badgeTransfer'),
					bg: 'bg-white/[0.06] text-white/60 border-white/10',
				};
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
							filterType() === 'all' ? 'bg-[#2990ff] text-white shadow-sm' : 'text-white/40'
						}`}
					>
						{t('numActivityTape.allEvents')}
					</button>
					<button
						type="button"
						onClick={() => setFilterType('sales')}
						class={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all ${
							filterType() === 'sales' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/40'
						}`}
					>
						{t('numActivityTape.settledSales')}
					</button>
					<button
						type="button"
						onClick={() => setFilterType('transfers')}
						class={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all ${
							filterType() === 'transfers' ? 'bg-white/10 text-white' : 'text-white/40'
						}`}
					>
						{t('numActivityTape.transfers')}
					</button>
				</div>

				<span class="text-[9px] text-white/40 font-mono pl-2">
					{t('numActivityTape.liveOnChainTape')}
				</span>
			</div>

			{/* Events Feed */}
			<div class="space-y-2">
				<For each={filteredEvents()}>
					{(ev) => {
						const badge = getEventBadge(ev.type);
						return (
							<div class="p-3.5 rounded-2xl frag-inset flex items-center justify-between gap-3">
								<div class="space-y-1 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<span class="text-xs font-black text-white font-mono">{ev.displayNumber}</span>
										<span class={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${badge.bg}`}>
											{badge.label}
										</span>
									</div>

									<div class="flex items-center gap-2 text-[10px] text-white/40 font-mono">
										<span>
											{t('numActivityTape.fromLabel')} {ev.from}
										</span>
										<Show when={ev.to}>
											<span>
												→ {t('numActivityTape.toLabel')} {ev.to}
											</span>
										</Show>
										<span>· {formatTimeAgo(ev.timestamp)}</span>
									</div>
								</div>

								<div class="text-end shrink-0">
									<Show when={ev.priceTon}>
										<div class="text-xs font-black text-white font-mono">
											{formatTon(ev.priceTon)}{' '}
											<span class="text-[10px] text-[#2990ff]">{t('common.ton')}</span>
										</div>
										<div class="text-[9px] font-mono text-white/40">{formatUsd(ev.priceTon)}</div>
									</Show>

									<Show when={ev.txHash}>
										<a
											href={`https://tonviewer.com/transaction/${ev.txHash}`}
											target="_blank"
											rel="noopener noreferrer"
											class="text-[9px] font-mono text-[#2990ff] hover:underline block mt-0.5"
										>
											{t('numActivityTape.tonviewerBtn')}
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
