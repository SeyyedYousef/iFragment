import { type Component, For } from 'solid-js';
import type { GiftsIntelResponse } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';

interface Props {
	data?: GiftsIntelResponse;
	currency?: 'usd' | 'gram';
}

interface MacroItem {
	label: string;
	value: string | number;
	sub: string;
	icon: string;
	highlight?: boolean;
}

interface MacroSection {
	title: string;
	badge: string;
	items: MacroItem[];
}

export const GiftsMacroStats: Component<Props> = (props) => {
	const isGram = () => props.currency === 'gram';

	const formatMcap = () => {
		if (isGram()) {
			const g = props.data?.total_market_cap_gram;
			if (g && g > 0) return `${(g / 1_000_000).toFixed(1)}M TON`;
			const rate = props.data?.ton_usd_rate || 0;
			const u = props.data?.total_market_cap_usd || 0;
			if (rate > 0 && u > 0) return `${(u / rate / 1_000_000).toFixed(1)}M TON`;
			return 'پایش زنده';
		}
		const u = props.data?.total_market_cap_usd;
		if (!u || u <= 0) return 'پایش زنده';
		return `$${(u / 1_000_000).toFixed(1)}M`;
	};

	const formatVolume = () => {
		if (isGram()) {
			const g = props.data?.total_cumulative_volume_gram;
			if (g && g > 0) return `${(g / 1_000_000).toFixed(1)}M TON`;
			const rate = props.data?.ton_usd_rate || 0;
			const u = props.data?.total_cumulative_volume_usd || 0;
			if (rate > 0 && u > 0) return `${(u / rate / 1_000_000).toFixed(1)}M TON`;
			return 'پایش زنده';
		}
		const u = props.data?.total_cumulative_volume_usd;
		if (!u || u <= 0) return 'پایش زنده';
		return `$${(u / 1_000_000).toFixed(1)}M`;
	};

	const macroSections = (): MacroSection[] => [
		{
			title: 'دارایی‌ها و متادیتا (Supply & Assets)',
			badge: 'api.changes.tg',
			items: [
				{
					label: t('gifts.totalGiftsCount') || 'Total Gifts',
					value:
						props.data?.total_gifts_minted && props.data.total_gifts_minted > 0
							? props.data.total_gifts_minted.toLocaleString()
							: '۱۵۱',
					sub: 'Official Catalog Registry',
					icon: 'inventory_2',
				},
				{
					label: t('gifts.upgradableGiftsCount') || 'Upgradable to NFT',
					value:
						props.data?.macro_stats?.upgradable_gifts && props.data.macro_stats.upgradable_gifts > 0
							? props.data.macro_stats.upgradable_gifts.toLocaleString()
							: '۱۲۰',
					sub: 'TEP-62 Standard',
					icon: 'auto_awesome',
				},
				{
					label: t('gifts.uniqueModelsCount') || 'Unique 3D Models',
					value: props.data?.macro_stats?.total_unique_models
						? props.data.macro_stats.total_unique_models.toLocaleString()
						: '۷,۵۷۶',
					sub: 'High-Poly Renderings',
					icon: 'view_in_ar',
				},
				{
					label: t('gifts.backdropsCount') || 'Backdrops',
					value:
						props.data?.macro_stats?.total_backdrops && props.data.macro_stats.total_backdrops > 0
							? props.data.macro_stats.total_backdrops.toLocaleString()
							: '۸۰',
					sub: 'Metallic & Gradient',
					icon: 'palette',
				},
				{
					label: t('gifts.patternsCount') || 'Symbols & Textures',
					value: props.data?.macro_stats?.total_patterns
						? props.data.macro_stats.total_patterns.toLocaleString()
						: '۲۵,۳۷۳',
					sub: 'Pattern DNA',
					icon: 'texture',
				},
				{
					label: t('gifts.circulatingGifts') || 'Circulating Supply',
					value:
						props.data?.total_circulating_gifts && props.data.total_circulating_gifts > 0
							? props.data.total_circulating_gifts.toLocaleString()
							: (props.data?.total_gifts_minted && props.data.total_gifts_minted > 0
								? props.data.total_gifts_minted.toLocaleString()
								: 'پایش زنده'),
					sub: 'Circulating on TON',
					icon: 'layers',
				},
			],
		},
		{
			title: 'اقتصاد و بازار (Market Economics)',
			badge: 'Market Telemetry',
			items: [
				{
					label: t('gifts.marketCap') || 'Market Cap',
					value: formatMcap(),
					sub: 'Live Venue Floor Aggregation',
					icon: 'account_balance',
					highlight: true,
				},
				{
					label: t('gifts.cumulativeVolume') || 'All-Time Volume',
					value: formatVolume(),
					sub: 'Verified Marketplace Trades',
					icon: 'query_stats',
					highlight: true,
				},
				{
					label: t('gifts.activeWallets') || 'Active Wallets',
					value:
						props.data?.total_active_wallets && props.data.total_active_wallets > 0
							? props.data.total_active_wallets.toLocaleString()
							: 'پایش زنده',
					sub: 'Monthly Active',
					icon: 'wallet',
				},
				{
					label: t('gifts.holderUsers') || 'Unique Holders',
					value:
						props.data?.total_holder_users && props.data.total_holder_users > 0
							? `${(props.data.total_holder_users / 1_000_000).toFixed(2)}M+`
							: 'پایش زنده',
					sub: 'Telegram & Non-Custodial',
					icon: 'group',
				},
			],
		},
	];

	return (
		<div class="space-y-3">
			<For each={macroSections()}>
				{(section) => (
					<div class="bg-[#0b0e17]/90 border border-white/[0.07] rounded-[22px] p-3.5 backdrop-blur-2xl shadow-xl space-y-2.5">
						{/* Group Header */}
						<div class="flex items-center justify-between px-1 pb-1 border-b border-white/[0.05]">
							<span class="text-[11px] font-bold text-white/70 tracking-wide">{section.title}</span>
							<span class="text-[9px] font-mono text-[#0098EA] bg-[#0098EA]/10 border border-[#0098EA]/20 px-2 py-0.5 rounded-full font-bold">
								{section.badge}
							</span>
						</div>

						{/* Metric Cells */}
						<div
							class={`grid gap-2 ${section.items.length === 6 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}
						>
							<For each={section.items}>
								{(item) => (
									<div
										class={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
											item.highlight
												? 'bg-[#0098EA]/[0.06] border-[#0098EA]/20 hover:border-[#0098EA]/40'
												: 'bg-white/[0.02] border-white/[0.04] hover:border-white/10'
										}`}
									>
										<div class="flex items-center justify-between mb-1">
											<span class="text-[10px] font-medium text-white/40 truncate">
												{item.label}
											</span>
											<span class="material-symbols-outlined text-[13px] text-white/30">
												{item.icon}
											</span>
										</div>

										<div>
											<div class="text-base font-bold text-white font-mono tracking-tight tabular-nums">
												{item.value}
											</div>
											<div class="text-[9px] font-mono text-white/30 truncate mt-0.5">
												{item.sub}
											</div>
										</div>
									</div>
								)}
							</For>
						</div>
					</div>
				)}
			</For>
		</div>
	);
};
