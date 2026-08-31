import { useNavigate } from '@solidjs/router';
import { type Component, For, Show } from 'solid-js';
import type { GiftsIntelResponse } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	intel?: GiftsIntelResponse;
}

export const GiftsArbitrageRadar: Component<Props> = (props) => {
	const navigate = useNavigate();

	const arbitrageList = () => props.intel?.arbitrage_matrix || [];

	const formatGram = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	return (
		<div class="space-y-4">
			{/* Arbitrage Opportunities Banner */}
			<div class="bg-gradient-to-r from-emerald-500/10 via-[#0098EA]/10 to-transparent border border-emerald-500/30 rounded-3xl p-4 backdrop-blur-xl">
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-emerald-400 text-xl">swap_horiz</span>
						<h3 class="text-sm font-black text-white">{t('gifts.arbitrageScanner')}</h3>
					</div>
					<span class="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
						7 Venues Synced
					</span>
				</div>
				<p class="text-xs text-white/50 font-medium">
					Instant profit spreads across Fragment, Getgems, MarketApp.ws, Tonnel, Portals, and MRKT.
				</p>
			</div>

			{/* Arbitrage Cards */}
			<div class="space-y-2.5">
				<For each={arbitrageList()}>
					{(item) => (
						<div class="bg-[#12141C]/80 border border-white/[0.08] rounded-2xl p-4 backdrop-blur-xl shadow-lg relative overflow-hidden">
							<div class="flex items-start justify-between mb-2">
								<div>
									<h4 class="text-sm font-bold text-white">{item.name}</h4>
									<div class="text-[10px] text-white/40 font-mono mt-0.5">
										Buy on <strong class="text-white/80">{item.buy_venue}</strong> → Sell on{' '}
										<strong class="text-emerald-400">{item.sell_venue}</strong>
									</div>
								</div>

								<div class="text-right">
									<span class="text-xs font-black text-emerald-400 font-mono bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 rounded-xl inline-block">
										+{item.spread_pct.toFixed(1)}% Net
									</span>
								</div>
							</div>

							<div class="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-xs">
								<div>
									<span class="text-[9px] uppercase text-white/40 block">Buy Floor</span>
									<span class="font-black text-white font-mono">⭐ {formatGram(item.buy_price_gram)}</span>
								</div>
								<div>
									<span class="text-[9px] uppercase text-white/40 block">Sell Target</span>
									<span class="font-black text-white font-mono">⭐ {formatGram(item.sell_price_gram)}</span>
								</div>
								<div class="text-right">
									<span class="text-[9px] uppercase text-emerald-400 font-bold block">Profit (USD)</span>
									<span class="font-black text-emerald-400 font-mono">+{formatUsd(item.profit_usd)}</span>
								</div>
							</div>

							<button
								type="button"
								onClick={() => {
									try { haptic.selection(); } catch {}
									navigate(`/gifts/collection?c=${encodeURIComponent(item.model_id)}`);
								}}
								class="w-full mt-3 py-2 bg-white/[0.04] hover:bg-[#0098EA]/20 active:scale-95 border border-white/10 hover:border-[#0098EA]/40 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all"
							>
								<span>View {item.name} Collection</span>
								<span class="material-symbols-outlined text-sm rtl:rotate-180">arrow_forward</span>
							</button>
						</div>
					)}
				</For>
			</div>
		</div>
	);
};
