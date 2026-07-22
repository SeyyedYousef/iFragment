import { Component } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const ShopView: Component = () => {
	return (
		<div
			class="w-full h-full overflow-y-auto px-5 pt-6 pb-16 animate-fade-in no-scrollbar bg-[#07080c] text-white relative flex flex-col min-h-0"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[250px] bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent blur-[70px] pointer-events-none z-0" />

			<div class="max-w-md mx-auto w-full relative z-10 flex flex-col flex-1">
				
				{/* ═══════ HEADER ICON ═══════ */}
				<div class="flex justify-center mb-5 mt-1 shrink-0">
					<div class="w-20 h-20 bg-gradient-to-br from-[#1c1608] to-[#08090D] rounded-[24px] border-[1.5px] border-amber-500/30 flex items-center justify-center shadow-[inset_0_2px_12px_rgba(255,255,255,0.05),0_10px_25px_rgba(245,158,11,0.25)] relative overflow-hidden">
						<div class="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 bg-amber-400/25 blur-lg rounded-full pointer-events-none" />
						<span class="material-symbols-outlined text-[42px] text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]" style={{ 'font-variation-settings': '"FILL" 1' }}>
							token
						</span>
					</div>
				</div>

				{/* ═══════ TITLE & DESC ═══════ */}
				<div class="text-center mb-7 shrink-0">
					<h2 class="text-[22px] sm:text-[24px] text-white font-black mb-2 tracking-tight drop-shadow-md">
						{t('shopInfo.title')}
					</h2>
					<p class="text-white/60 text-[13px] leading-relaxed font-medium max-w-[310px] mx-auto">
						{t('shopInfo.desc')}
					</p>
				</div>

				{/* ═══════ ECOSYSTEM USE CASES ═══════ */}
				<div class="space-y-3 mb-8 shrink-0">
					
					{/* 1. Username Valuation Utility (Amber Theme) */}
					<div class="group bg-[#12141C]/80 backdrop-blur-xl border border-amber-400/20 hover:border-amber-400/40 rounded-[22px] p-4 flex items-center gap-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-[#161922]">
						<div class="w-12 h-12 rounded-[14px] bg-gradient-to-br from-amber-400/20 to-amber-400/5 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
							<span class="material-symbols-outlined text-amber-400 text-[26px] drop-shadow-md" style={{ 'font-variation-settings': '"FILL" 1' }}>
								analytics
							</span>
						</div>
						<div class="flex-1 text-start pr-1">
							<h3 class="text-white font-black text-[14px] sm:text-[15px] mb-1 tracking-tight">
								{t('shopInfo.usernameAnalytics')}
							</h3>
							<p class="text-white/50 text-[12px] leading-relaxed font-medium">
								{t('shopInfo.usernameAnalyticsDesc')}
							</p>
						</div>
					</div>

					{/* 2. Group Management (Blue Theme) */}
					<div class="group bg-[#12141C]/80 backdrop-blur-xl border border-blue-500/20 hover:border-blue-500/40 rounded-[22px] p-4 flex items-center gap-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-[#161922]">
						<div class="w-12 h-12 rounded-[14px] bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
							<span class="material-symbols-outlined text-blue-400 text-[26px] drop-shadow-md" style={{ 'font-variation-settings': '"FILL" 1' }}>
								shield_person
							</span>
						</div>
						<div class="flex-1 text-start pr-1">
							<h3 class="text-white font-black text-[14px] sm:text-[15px] mb-1 tracking-tight">
								{t('shopInfo.groupMgmt')}
							</h3>
							<p class="text-white/50 text-[12px] leading-relaxed font-medium">
								{t('shopInfo.groupMgmtDesc')}
							</p>
						</div>
					</div>

					{/* 3. Channel Tools (Cyan Theme) */}
					<div class="group bg-[#12141C]/80 backdrop-blur-xl border border-cyan-500/20 hover:border-cyan-500/40 rounded-[22px] p-4 flex items-center gap-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-[#161922]">
						<div class="w-12 h-12 rounded-[14px] bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
							<span class="material-symbols-outlined text-cyan-400 text-[26px] drop-shadow-md" style={{ 'font-variation-settings': '"FILL" 1' }}>
								podcasts
							</span>
						</div>
						<div class="flex-1 text-start pr-1">
							<h3 class="text-white font-black text-[14px] sm:text-[15px] mb-1 tracking-tight">
								{t('shopInfo.channelMgmt')}
							</h3>
							<p class="text-white/50 text-[12px] leading-relaxed font-medium">
								{t('shopInfo.channelMgmtDesc')}
							</p>
						</div>
					</div>
				</div>

				{/* ═══════ ECOSYSTEM NOTICE (Premium HUD Style) ═══════ */}
				<div class="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-500/20 rounded-[20px] p-4 flex items-center justify-center gap-2.5 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)] mx-1 mb-4 shrink-0">
					<div class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_#f59e0b] shrink-0" />
					<p class="text-amber-300/90 text-[12px] sm:text-[13px] font-medium leading-relaxed text-center">
						{t('shopInfo.comingSoon')}
					</p>
				</div>

			</div>
		</div>
	);
};
