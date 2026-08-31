import { type Component, For, Show } from 'solid-js';
import type { GiftsIntelResponse } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';

interface Props {
	data?: GiftsIntelResponse;
}

export const GiftsMacroStats: Component<Props> = (props) => {
	const statsList = () => [
		{
			id: 'total_gifts',
			label: t('gifts.totalGiftsCount'),
			value: props.data?.macro_stats?.total_unique_gifts || 149,
			source: 'api.changes.tg/total',
			icon: 'featured_seasonal_and_gifts',
			color: 'from-[#0098EA]/20 to-[#0098EA]/5 text-[#0098EA] border-[#0098EA]/30',
			subtitle: '138 Limited + 11 Unlimited',
		},
		{
			id: 'upgradable',
			label: t('gifts.upgradableGiftsCount'),
			value: props.data?.macro_stats?.total_upgradable || 120,
			source: 'api.changes.tg/total',
			icon: 'upgrade',
			color: 'from-[#AF52DE]/20 to-[#AF52DE]/5 text-[#AF52DE] border-[#AF52DE]/30',
			subtitle: 'NFT Ready on TON Blockchain',
		},
		{
			id: 'limited',
			label: t('gifts.limitedGiftsCount'),
			value: 138,
			source: 'api.changes.tg/total',
			icon: 'lock',
			color: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30',
			subtitle: 'Capped Minting Supply',
		},
		{
			id: 'unlimited',
			label: t('gifts.unlimitedGiftsCount'),
			value: 11,
			source: 'api.changes.tg/total',
			icon: 'all_inclusive',
			color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30',
			subtitle: 'Continuous Telegram Store',
		},
		{
			id: 'models',
			label: t('gifts.uniqueModelsCount'),
			value: props.data?.macro_stats?.total_unique_models?.toLocaleString() || '7,576',
			source: 'api.changes.tg/total',
			icon: 'view_in_ar',
			color: 'from-cyan-500/20 to-cyan-500/5 text-cyan-400 border-cyan-500/30',
			subtitle: 'Distinct 3D Visual Renderings',
		},
		{
			id: 'backdrops',
			label: t('gifts.backdropsCount'),
			value: props.data?.macro_stats?.total_backdrops || 80,
			source: 'api.changes.tg/total',
			icon: 'palette',
			color: 'from-pink-500/20 to-pink-500/5 text-pink-400 border-pink-500/30',
			subtitle: 'Gradient & Metallic Palettes',
		},
		{
			id: 'patterns',
			label: t('gifts.patternsCount'),
			value: props.data?.macro_stats?.total_patterns?.toLocaleString() || '25,373',
			source: 'api.changes.tg/total',
			icon: 'grain',
			color: 'from-purple-500/20 to-purple-500/5 text-purple-400 border-purple-500/30',
			subtitle: 'Symbolic Background Textures',
		},
		{
			id: 'market_cap',
			label: t('gifts.marketCap'),
			value: '$128M+',
			source: 'Dropstab / Binance',
			icon: 'monitoring',
			color: 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/30',
			subtitle: '~32M TON Equivalent',
		},
		{
			id: 'volume_cum',
			label: t('gifts.cumulativeVolume'),
			value: '$300M+',
			source: 'DurovsCode / Binance',
			icon: 'bar_chart',
			color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30',
			subtitle: 'All-time Secondary & Store',
		},
		{
			id: 'active_wallets',
			label: t('gifts.activeWallets'),
			value: '500,000+',
			source: 'Dropstab / On-chain',
			icon: 'account_balance_wallet',
			color: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30',
			subtitle: 'Monthly Active Traders',
		},
		{
			id: 'holders',
			label: t('gifts.holderUsers'),
			value: '~2,000,000',
			source: 'Dropstab / Telegram',
			icon: 'groups',
			color: 'from-indigo-500/20 to-indigo-500/5 text-indigo-400 border-indigo-500/30',
			subtitle: 'Profiles with Displayed Gifts',
		},
		{
			id: 'circulating',
			label: t('gifts.circulatingGifts'),
			value: '~9,000,000',
			source: 'Dropstab / On-chain',
			icon: 'inventory_2',
			color: 'from-teal-500/20 to-teal-500/5 text-teal-400 border-teal-500/30',
			subtitle: 'Total Minted & Transferred',
		},
	];

	return (
		<div class="space-y-3">
			{/* Section Header with Live API Badge */}
			<div class="flex items-center justify-between px-1">
				<div class="flex items-center gap-2">
					<span class="material-symbols-outlined text-[#0098EA] text-lg">dataset</span>
					<h2 class="text-sm font-black text-white tracking-tight">{t('gifts.macroStatsTitle')}</h2>
				</div>
				<div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
					<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
					<span>api.changes.tg • Live</span>
				</div>
			</div>

			{/* 12-Card Grid */}
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
				<For each={statsList()}>
					{(item) => (
						<div
							class={`bg-gradient-to-br ${item.color} border rounded-2xl p-3 flex flex-col justify-between backdrop-blur-xl transition-all hover:scale-[1.02]`}
						>
							<div class="flex items-start justify-between mb-1.5">
								<span class="material-symbols-outlined text-xl opacity-80">{item.icon}</span>
								<span class="text-[9px] font-mono opacity-50 px-1.5 py-0.5 rounded bg-black/30 truncate max-w-[90px]">
									{item.source}
								</span>
							</div>

							<div>
								<div class="text-[11px] font-bold text-white/70 leading-tight mb-0.5 truncate">
									{item.label}
								</div>
								<div class="text-base font-black text-white font-mono tracking-tight">
									{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
								</div>
								<div class="text-[9px] font-medium text-white/40 truncate mt-0.5">
									{item.subtitle}
								</div>
							</div>
						</div>
					)}
				</For>
			</div>
		</div>
	);
};
