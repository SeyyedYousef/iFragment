import { Component } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const ShopView: Component = () => {
	return (
		<div
			class="flex-1 overflow-y-auto px-5 pt-8 pb-36 animate-fade-in no-scrollbar"
			style={{ background: '#000' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Header Icon */}
			<div class="flex justify-center mb-6">
				<div class="relative w-24 h-24 flex items-center justify-center">
					<div class="absolute inset-0 bg-[#FFC107] rounded-full blur-[40px] opacity-20"></div>
					<div class="w-20 h-20 bg-gradient-to-br from-[#2a2a2a] to-[#1c1c1c] rounded-full border border-white/10 flex items-center justify-center shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-10">
						<span
							class="material-symbols-outlined text-[42px] text-[#FFC107]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							shopping_bag
						</span>
					</div>
				</div>
			</div>

			{/* Title & Description */}
			<div class="text-center mb-10">
				<h2 class="text-white text-2xl font-black mb-3 tracking-tight">
					{t('shopInfo.title')}
				</h2>
				<p class="text-white/60 text-[14px] leading-relaxed font-medium">
					{t('shopInfo.desc')}
				</p>
			</div>

			{/* Use Cases List */}
			<div class="space-y-3 mb-8">
				<div class="bg-[#1c1c1e]/60 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex items-center gap-4">
					<div class="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
						<span
							class="material-symbols-outlined text-blue-400 text-[24px]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							shield_person
						</span>
					</div>
					<div>
						<h3 class="text-white font-bold text-[15px] mb-1">{t('shopInfo.groupMgmt')}</h3>
						<p class="text-white/50 text-[12px] leading-tight">
							{t('shopInfo.groupMgmtDesc')}
						</p>
					</div>
				</div>

				<div class="bg-[#1c1c1e]/60 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex items-center gap-4">
					<div class="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
						<span
							class="material-symbols-outlined text-purple-400 text-[24px]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							podcasts
						</span>
					</div>
					<div>
						<h3 class="text-white font-bold text-[15px] mb-1">{t('shopInfo.channelMgmt')}</h3>
						<p class="text-white/50 text-[12px] leading-tight">
							{t('shopInfo.channelMgmtDesc')}
						</p>
					</div>
				</div>

				<div class="bg-[#1c1c1e]/60 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex items-center gap-4">
					<div class="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
						<span
							class="material-symbols-outlined text-green-400 text-[24px]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							analytics
						</span>
					</div>
					<div>
						<h3 class="text-white font-bold text-[15px] mb-1">{t('shopInfo.usernameAnalytics')}</h3>
						<p class="text-white/50 text-[12px] leading-tight">
							{t('shopInfo.usernameAnalyticsDesc')}
						</p>
					</div>
				</div>
			</div>


		</div>
	);
};
