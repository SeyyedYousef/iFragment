import { useNavigate } from '@solidjs/router';
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import {
	type ArbitrageOpportunity,
	giftsApi,
	type GiftsIntelResponse,
} from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	intel?: GiftsIntelResponse;
}

export const GiftsArbitrageRadar: Component<Props> = (props) => {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [selectedFilter, setSelectedFilter] = createSignal<'all' | 'high_roi' | 'high_usd'>('all');
	const [syncSuccess, setSyncSuccess] = createSignal(false);

	const arbitrageQuery = createQuery(() => ({
		queryKey: ['giftsArbitrageLiveRadar'],
		queryFn: () => giftsApi.getArbitrageRadar(),
		staleTime: 45 * 1000,
	}));

	const syncMutation = createMutation(() => ({
		mutationFn: () => giftsApi.triggerSync(),
		onSuccess: () => {
			try {
				haptic.notify('success');
			} catch {}
			setSyncSuccess(true);
			setTimeout(() => setSyncSuccess(false), 3000);
			queryClient.invalidateQueries({ queryKey: ['giftsArbitrageLiveRadar'] });
			queryClient.invalidateQueries({ queryKey: ['giftsIntel'] });
		},
		onError: () => {
			try {
				haptic.notify('error');
			} catch {}
		},
	}));

	const rawList = () => {
		if (arbitrageQuery.data && arbitrageQuery.data.length > 0) {
			return arbitrageQuery.data;
		}
		return props.intel?.arbitrage_radar || props.intel?.arbitrage_matrix || [];
	};

	const filteredList = () => {
		const list = rawList();
		const f = selectedFilter();
		if (f === 'high_roi') {
			return list.filter((item) => item.spread_percent >= 15.0);
		}
		if (f === 'high_usd') {
			return list.filter((item) => item.net_profit_usd >= 30.0);
		}
		return list;
	};

	const formatTon = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	const handleSync = async () => {
		try {
			haptic.impact('medium');
		} catch {}
		await syncMutation.mutateAsync();
	};

	return (
		<div class="space-y-3.5">
			{/* Arbitrage Scanner Header Card */}
			<div class="bg-[#0b0e17]/95 border border-white/[0.08] rounded-[24px] p-4 backdrop-blur-2xl shadow-xl space-y-2">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
						<h3 class="text-xs font-black uppercase tracking-wider text-white">
							{t('gifts.arbitrageScanner') || 'Cross-Market Arbitrage Radar'}
						</h3>
					</div>

					<div class="flex items-center gap-2">
						<span class="text-[9px] uppercase font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
							7 Venues Monitored
						</span>

						{/* Manual Sync Trigger Button */}
						<button
							type="button"
							onClick={handleSync}
							disabled={syncMutation.isPending}
							class="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/[0.05] hover:bg-[#0098EA]/20 border border-white/10 hover:border-[#0098EA]/40 text-[10px] font-bold text-white transition-all disabled:opacity-50"
							title="همگام‌سازی آنی بازارها"
						>
							<span
								class={`material-symbols-outlined text-[13px] text-[#0098EA] ${
									syncMutation.isPending ? 'animate-spin' : ''
								}`}
							>
								refresh
							</span>
							<span>{syncMutation.isPending ? 'در حال اسکن...' : 'اسکن آنی'}</span>
						</button>
					</div>
				</div>

				<p class="text-[11px] text-white/50 font-medium leading-relaxed">
					اسکن زنده اختلاف قیمت کف در Fragment، Getgems، MarketApp، Tonnel، Portals و MRKT.
					تمامی ارقام پس از کسر کارمزد مارکت‌ها و کارمزد تراکنش بلاکچین محاسبه شده‌اند.
				</p>

				{/* Filter Chips */}
				<div class="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
					{[
						{ id: 'all', label: `همه فرصت‌ها (${rawList().length})` },
						{ id: 'high_roi', label: 'سود بالای ۱۵٪ (ROI)' },
						{ id: 'high_usd', label: 'سود خالص بالای $30' },
					].map((chip) => (
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setSelectedFilter(chip.id as any);
							}}
							class={`px-2.5 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${
								selectedFilter() === chip.id
									? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
									: 'bg-white/[0.03] text-white/50 hover:text-white border border-white/[0.05]'
							}`}
						>
							{chip.label}
						</button>
					))}
				</div>

				<Show when={syncSuccess()}>
					<div class="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-2 text-center text-xs font-bold text-emerald-300 animate-fade-in">
						سیکل همگام‌سازی ۶ ساعته با موفقیت تریگر شد و بازارها به‌روز شدند.
					</div>
				</Show>
			</div>

			{/* Loading State */}
			<Show when={arbitrageQuery.isLoading}>
				<div class="p-8 text-center bg-[#0b0e17]/80 rounded-2xl border border-white/[0.06] space-y-2">
					<div class="w-7 h-7 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
					<p class="text-xs text-white/40 font-mono">در حال واکشی آخرین اسپردهای آربیتراژ...</p>
				</div>
			</Show>

			{/* Empty State */}
			<Show when={!arbitrageQuery.isLoading && filteredList().length === 0}>
				<div class="p-8 text-center bg-[#0b0e17]/80 rounded-2xl border border-white/[0.06] space-y-1.5">
					<span class="material-symbols-outlined text-3xl text-white/20">currency_exchange</span>
					<p class="text-xs text-white/40 font-medium">فرصت آربیتراژی در این فیلتر یافت نشد.</p>
				</div>
			</Show>

			{/* Arbitrage Opportunities Cards */}
			<div class="space-y-2.5">
				<For each={filteredList()}>
					{(item: ArbitrageOpportunity) => (
						<div class="bg-[#0b0e17]/90 hover:bg-[#0b0e17] border border-white/[0.07] hover:border-emerald-500/30 rounded-2xl p-3.5 backdrop-blur-xl shadow-lg transition-all space-y-2.5">
							{/* Top Row: Name + Venues + Spread Badge */}
							<div class="flex items-start justify-between">
								<div>
									<h4 class="text-sm font-bold text-white tracking-tight">{item.model_name}</h4>
									<div class="text-[10px] text-white/40 font-mono mt-0.5 flex items-center gap-1.5">
										<span>
											خرید از <strong class="text-white/80">{item.buy_venue}</strong>
										</span>
										<span class="text-emerald-400">➔</span>
										<span>
											فروش در <strong class="text-emerald-400">{item.sell_venue}</strong>
										</span>
									</div>
								</div>

								<div class="text-right">
									<span class="text-xs font-black text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg inline-block">
										+{item.spread_percent.toFixed(1)}% Net ROI
									</span>
								</div>
							</div>

							{/* Numbers Grid */}
							<div class="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.05] text-xs">
								<div class="bg-white/[0.02] border border-white/[0.03] rounded-xl p-2">
									<span class="text-[9px] uppercase text-white/40 block">کف خرید</span>
									<span class="font-bold text-white font-mono mt-0.5 block">
										💎 {formatTon(item.buy_price_gram)} TON
									</span>
								</div>
								<div class="bg-white/[0.02] border border-white/[0.03] rounded-xl p-2">
									<span class="text-[9px] uppercase text-white/40 block">تارگت فروش</span>
									<span class="font-bold text-white font-mono mt-0.5 block">
										💎 {formatTon(item.sell_price_gram)} TON
									</span>
								</div>
								<div class="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-xl p-2 text-right rtl:text-left">
									<span class="text-[9px] uppercase text-emerald-400 font-bold block">
										سود خالص
									</span>
									<span class="font-black text-emerald-400 font-mono mt-0.5 block">
										+{formatUsd(item.net_profit_usd)}
									</span>
									<span class="text-[9px] text-emerald-400/70 font-mono block">
										+{formatTon(item.net_profit_gram)} TON
									</span>
								</div>
							</div>

							{/* Action Button */}
							<button
								type="button"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									navigate(`/gifts/collection?c=${encodeURIComponent(item.model_id)}`);
								}}
								class="w-full py-2 bg-white/[0.03] hover:bg-emerald-500/20 active:scale-98 border border-white/[0.06] hover:border-emerald-500/40 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all"
							>
								<span>مشاهده و تحلیل کالکشن {item.model_name}</span>
								<span class="material-symbols-outlined text-sm rtl:rotate-180">arrow_forward</span>
							</button>
						</div>
					)}
				</For>
			</div>
		</div>
	);
};
