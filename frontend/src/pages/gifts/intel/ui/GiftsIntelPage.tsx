import { createQuery } from '@tanstack/solid-query';
import type { Component } from 'solid-js';
import { giftsApi } from '@/entities/gifts/index.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { GiftsChartView } from './components/GiftsChartView.js';

export const GiftsIntelPage: Component = () => {
	useTelegramBackButton(-1);

	const intelQuery = createQuery(() => ({
		queryKey: ['giftsIntel'],
		queryFn: () => giftsApi.getIntel(),
		staleTime: 45 * 1000,
	}));

	const intel = () => intelQuery.data;

	return (
		<div class="pb-36 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient background glows matching iFragment palette */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/15 via-transparent to-transparent blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[520px] mx-auto px-4 pt-3 space-y-4">
				{/* Top Header Bar */}
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2.5">
						<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0098EA] to-[#0060aa] p-[1px] shadow-lg shadow-[#0098EA]/20 flex items-center justify-center">
							<div class="w-full h-full bg-[#0a0e17] rounded-xl flex items-center justify-center text-base">
								🎁
							</div>
						</div>
						<div>
							<h1 class="text-base font-black tracking-tight text-white flex items-center gap-1.5">
								<span>Telegram Gifts</span>
								<span class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									NFT
								</span>
							</h1>
							<p class="text-[10px] font-semibold text-white/40">
								Telegram Gifts & NFT Marketplace
							</p>
						</div>
					</div>

					{/* Live Ecosystem Market Cap Readout */}
					<div class="text-right">
						<div class="text-xs font-black text-white font-mono flex items-center justify-end gap-1">
							<span class="text-[#0098EA] text-[10px]">💎</span>
							<span>
								{intel()?.total_market_cap_usd
									? `~$${(intel()!.total_market_cap_usd / 1e6).toFixed(1)}M Cap`
									: 'Live Ecosystem'}
							</span>
						</div>
						<div class="text-[10px] text-emerald-400 font-mono font-bold">
							{intel()?.total_gifts_minted
								? `${intel()!.total_gifts_minted.toLocaleString()} Gifts Catalog`
								: 'Catalog Registry'}
						</div>
					</div>
				</div>

				{/* ═══════ SINGLE CHART & MARKET ANALYSIS VIEW ═══════ */}
				<GiftsChartView intel={intel()} />

				{/* Attribution Badge */}
				<div class="text-center pt-4 pb-2">
					<a
						href="https://t.me/GiftChanges"
						target="_blank"
						rel="noreferrer"
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-[10px] font-medium text-white/40 hover:text-white/80 transition-all"
					>
						<span class="material-symbols-outlined text-[13px] text-[#0098EA]">verified</span>
						<span>Powered by Telegram On-Chain & api.changes.tg · Thanks to @GiftChanges</span>
					</a>
				</div>
			</div>
		</div>
	);
};
