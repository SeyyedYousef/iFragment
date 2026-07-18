import { Component } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const ShopView: Component = () => {
	return (
		<div
			class="flex-1 overflow-y-auto px-5 pt-6 pb-10 animate-fade-in no-scrollbar bg-[#090a0d] text-white"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Header Icon */}
			<div class="flex justify-center mb-5">
				<div class="w-18 h-18 bg-[#11131a] rounded-3xl border border-amber-400/30 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.15)] relative">
					<span
						class="material-symbols-outlined text-[36px] text-amber-400"
						style={{ 'font-variation-settings': '"FILL" 1' }}
					>
						token
					</span>
				</div>
			</div>

			{/* Title & Description */}
			<div class="text-center mb-8">
				<h2 class="text-white text-2xl font-black mb-2 tracking-tight">
					{t('shopInfo.title')}
				</h2>
				<p class="text-white/60 text-[13.5px] leading-relaxed font-medium max-w-xs mx-auto">
					{t('shopInfo.desc')}
				</p>
			</div>

			{/* Use Cases Grid / Cards */}
			<div class="space-y-3 mb-8">
				{/* 1. Username Valuation Utility */}
				<div class="bg-[#11131a] border border-amber-400/30 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
					<div class="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
						<span
							class="material-symbols-outlined text-amber-400 text-[26px]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							analytics
						</span>
					</div>
					<div class="flex-1 text-start">
						<h3 class="text-white font-bold text-[15px] mb-0.5">{t('shopInfo.usernameAnalytics')}</h3>
						<p class="text-white/50 text-[12px] leading-snug">
							{t('shopInfo.usernameAnalyticsDesc')}
						</p>
					</div>
				</div>

				{/* 2. Group Management */}
				<div class="bg-[#11131a] border border-white/10 rounded-2xl p-4 flex items-center gap-4 shadow-md">
					<div class="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
						<span
							class="material-symbols-outlined text-blue-400 text-[24px]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							shield_person
						</span>
					</div>
					<div class="flex-1 text-start">
						<h3 class="text-white font-bold text-[15px] mb-0.5">{t('shopInfo.groupMgmt')}</h3>
						<p class="text-white/50 text-[12px] leading-snug">
							{t('shopInfo.groupMgmtDesc')}
						</p>
					</div>
				</div>

				{/* 3. Channel Tools */}
				<div class="bg-[#11131a] border border-white/10 rounded-2xl p-4 flex items-center gap-4 shadow-md">
					<div class="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
						<span
							class="material-symbols-outlined text-cyan-400 text-[24px]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							podcasts
						</span>
					</div>
					<div class="flex-1 text-start">
						<h3 class="text-white font-bold text-[15px] mb-0.5">{t('shopInfo.channelMgmt')}</h3>
						<p class="text-white/50 text-[12px] leading-snug">
							{t('shopInfo.channelMgmtDesc')}
						</p>
					</div>
				</div>
			</div>

			{/* Ecosystem Notice */}
			<div class="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4 text-center mb-6">
				<p class="text-cyan-400 text-[13px] leading-relaxed font-medium">
					{t('shopInfo.comingSoon')}
				</p>
			</div>
		</div>
	);
};
