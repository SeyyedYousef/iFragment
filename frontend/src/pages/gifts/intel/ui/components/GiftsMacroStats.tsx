import { type Component, For } from 'solid-js';
import type { GiftsIntelResponse } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';

interface Props {
	data?: GiftsIntelResponse;
}

export const GiftsMacroStats: Component<Props> = (props) => {
	const macroSections = () => [
		{
			title: 'دارایی‌ها و متادیتا (Supply & Assets)',
			badge: 'api.changes.tg',
			items: [
				{
					label: t('gifts.totalGiftsCount') || 'Total Gifts',
					value: '149',
					sub: '138 Limited · 11 Store',
					icon: 'inventory_2',
				},
				{
					label: t('gifts.upgradableGiftsCount') || 'Upgradable to NFT',
					value: '120',
					sub: 'TEP-62 Standard',
					icon: 'auto_awesome',
				},
				{
					label: t('gifts.uniqueModelsCount') || 'Unique 3D Models',
					value: (props.data?.macro_stats?.total_unique_models || 7576).toLocaleString(),
					sub: 'High-Poly Renderings',
					icon: 'view_in_ar',
				},
				{
					label: t('gifts.backdropsCount') || 'Backdrops',
					value: '80',
					sub: 'Metallic & Gradient',
					icon: 'palette',
				},
				{
					label: t('gifts.patternsCount') || 'Symbols & Textures',
					value: (props.data?.macro_stats?.total_patterns || 25373).toLocaleString(),
					sub: 'Pattern DNA',
					icon: 'texture',
				},
				{
					label: t('gifts.circulatingGifts') || 'Circulating Supply',
					value: '~9,000,000',
					sub: 'Total Minted Items',
					icon: 'layers',
				},
			],
		},
		{
			title: 'اقتصاد و بازار (Market Economics)',
			badge: 'Dropstab · On-Chain',
			items: [
				{
					label: t('gifts.marketCap') || 'Market Cap',
					value: '$128M+',
					sub: '≈ 32,000,000 TON',
					icon: 'account_balance',
					highlight: true,
				},
				{
					label: t('gifts.cumulativeVolume') || 'All-Time Volume',
					value: '$300M+',
					sub: '7 Major Venues',
					icon: 'query_stats',
					highlight: true,
				},
				{
					label: t('gifts.activeWallets') || 'Active Wallets',
					value: '500,000+',
					sub: 'Monthly Active',
					icon: 'wallet',
				},
				{
					label: t('gifts.holderUsers') || 'Unique Holders',
					value: '~2,000,000',
					sub: 'Telegram Profiles',
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
							<span class="text-[11px] font-bold text-white/70 tracking-wide">
								{section.title}
							</span>
							<span class="text-[9px] font-mono text-[#0098EA] bg-[#0098EA]/10 border border-[#0098EA]/20 px-2 py-0.5 rounded-full font-bold">
								{section.badge}
							</span>
						</div>

						{/* Metric Cells */}
						<div class={`grid gap-2 ${section.items.length === 6 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
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
