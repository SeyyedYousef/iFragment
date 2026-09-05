import { useNavigate } from '@solidjs/router';
import { type Component, For } from 'solid-js';
import type { GiftsIntelResponse } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	intel?: GiftsIntelResponse;
}

export const GiftsArbitrageRadar: Component<Props> = (props) => {
	const navigate = useNavigate();

	const arbitrageList = () => props.intel?.arbitrage_radar || props.intel?.arbitrage_matrix || [];

	const formatTon = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	return (
		<div class="space-y-3.5">
			{/* Arbitrage Scanner Header Card */}
			<div class="bg-[#0b0e17]/95 border border-white/[0.08] rounded-[24px] p-4 backdrop-blur-2xl shadow-xl space-y-1.5">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
						<h3 class="text-xs font-black uppercase tracking-wider text-white">
							{t('gifts.arbitrageScanner') || 'Cross-Market Arbitrage Radar'}
						</h3>
					</div>
					<span class="text-[9px] uppercase font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
						7 Venues Monitored
					</span>
				</div>
				<p class="text-[11px] text-white/50 font-medium">
					اسکن آنی اختلاف قیمت کف در بازارهای Fragment، Getgems، MarketApp.ws، Tonnel، Portals، MRKT
					و بازار رسمی داخلی تلگرام.
				</p>
			</div>

			{/* Arbitrage Opportunities Cards */}
			<div class="space-y-2">
				<For each={arbitrageList()}>
					{(item) => (
						<div class="bg-[#0b0e17]/90 hover:bg-[#0b0e17] border border-white/[0.07] hover:border-[#0098EA]/30 rounded-2xl p-3.5 backdrop-blur-xl shadow-lg transition-all space-y-2.5">
							{/* Top Row: Name + Venues + Spread Badge */}
							<div class="flex items-start justify-between">
								<div>
									<h4 class="text-sm font-bold text-white tracking-tight">{item.model_name}</h4>
									<div class="text-[10px] text-white/40 font-mono mt-0.5 flex items-center gap-1">
										<span>
											خرید از <strong class="text-white/80">{item.buy_venue}</strong>
										</span>
										<span class="text-[#0098EA]">➔</span>
										<span>
											فروش در <strong class="text-emerald-400">{item.sell_venue}</strong>
										</span>
									</div>
								</div>

								<div class="text-right">
									<span class="text-xs font-black text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg inline-block">
										+{item.spread_percent.toFixed(1)}% Net
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
										سود تخمینی
									</span>
									<span class="font-black text-emerald-400 font-mono mt-0.5 block">
										+{formatUsd(item.net_profit_usd)}
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
								class="w-full py-2 bg-white/[0.03] hover:bg-[#0098EA]/20 active:scale-98 border border-white/[0.06] hover:border-[#0098EA]/40 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all"
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
