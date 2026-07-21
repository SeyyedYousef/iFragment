import { Component } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const ShopView: Component = () => {
	return (
		<div
			class="flex-1 overflow-y-auto px-5 pt-8 pb-12 animate-fade-in no-scrollbar bg-[#030303] text-white relative"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent blur-[80px] pointer-events-none z-0" />

			<div class="max-w-md mx-auto relative z-10 flex flex-col">
				
				{/* ═══════ HEADER ICON ═══════ */}
				<div class="flex justify-center mb-6 mt-2">
					<div class="w-24 h-24 bg-gradient-to-br from-[#1c1608] to-[#08090D] rounded-[28px] border-[1.5px] border-amber-500/30 flex items-center justify-center shadow-[inset_0_2px_12px_rgba(255,255,255,0.05),0_12px_30px_rgba(245,158,11,0.2)] relative overflow-hidden">
						<div class="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-amber-400/20 blur-xl rounded-full pointer-events-none" />
						<span class="material-symbols-outlined text-[48px] text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]" style={{ 'font-variation-settings': '"FILL" 1' }}>
							token
						</span>
					</div>
				</div>

				{/* ═══════ TITLE & DESC ═══════ */}
				<div class="text-center mb-10">
					<h2 class="text-[24px] text-white font-black mb-2 tracking-tight drop-shadow-md">
						{t('shopInfo.title')}
					</h2>
					<p class="text-white/60 text-[13px] leading-relaxed font-medium max-w-[280px] mx-auto">
						{t('shopInfo.desc')}
					</p>
				</div>

				{/* ═══════ ECOSYSTEM USE CASES ═══════ */}
				<div class="space-y-3.5 mb-10">
					
					{/* 1. Username Valuation Utility (Amber Theme) */}
					<div class="group bg-[#12141C]/80 backdrop-blur-xl border border-amber-400/20 hover:border-amber-400/40 rounded-[24px] p-4 flex items-center gap-4 shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-[#161922]">
						<div class="w-14 h-14 rounded-[16px] bg-gradient-to-br from-amber-400/20 to-amber-400/5 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
							<span class="material-symbols-outlined text-amber-400 text-[28px] drop-shadow-md" style={{ 'font-variation-settings': '"FILL" 1' }}>
								analytics
							</span>
						</div>
						<div class="flex-1 text-start pr-1">
							<h3 class="text-white font-black text-[15px] mb-1 tracking-tight">
								{t('shopInfo.usernameAnalytics')}
							</h3>
							<p class="text-white/50 text-[12px] leading-relaxed font-medium">
								{t('shopInfo.usernameAnalyticsDesc')}
							</p>
						</div>
					</div>

					{/* 2. Group Management (Blue Theme) */}
					<div class="group bg-[#12141C]/80 backdrop-blur-xl border border-blue-500/20 hover:border-blue-500/40 rounded-[24px] p-4 flex items-center gap-4 shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-[#161922]">
						<div class="w-14 h-14 rounded-[16px] bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
							<span class="material-symbols-outlined text-blue-400 text-[28px] drop-shadow-md" style={{ 'font-variation-settings': '"FILL" 1' }}>
								shield_person
							</span>
						</div>
						<div class="flex-1 text-start pr-1">
							<h3 class="text-white font-black text-[15px] mb-1 tracking-tight">
								{t('shopInfo.groupMgmt')}
							</h3>
							<p class="text-white/50 text-[12px] leading-relaxed font-medium">
								{t('shopInfo.groupMgmtDesc')}
							</p>
						</div>
					</div>

					{/* 3. Channel Tools (Cyan Theme) */}
					<div class="group bg-[#12141C]/80 backdrop-blur-xl border border-cyan-500/20 hover:border-cyan-500/40 rounded-[24px] p-4 flex items-center gap-4 shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition-all duration-300 hover:bg-[#161922]">
						<div class="w-14 h-14 rounded-[16px] bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
							<span class="material-symbols-outlined text-cyan-400 text-[28px] drop-shadow-md" style={{ 'font-variation-settings': '"FILL" 1' }}>
								podcasts
							</span>
						</div>
						<div class="flex-1 text-start pr-1">
							<h3 class="text-white font-black text-[15px] mb-1 tracking-tight">
								{t('shopInfo.channelMgmt')}
							</h3>
							<p class="text-white/50 text-[12px] leading-relaxed font-medium">
								{t('shopInfo.channelMgmtDesc')}
							</p>
						</div>
					</div>
				</div>

				{/* ═══════ ECOSYSTEM NOTICE (Premium HUD Style) ═══════ */}
				<div class="relative overflow-hidden bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-cyan-500/10 border border-cyan-500/20 rounded-[20px] p-4 flex items-center justify-center gap-2.5 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)] mx-2">
					<div class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]" />
					<p class="text-cyan-400 text-[13px] font-black uppercase tracking-widest pt-0.5">
						{t('shopInfo.comingSoon')}
					</p>
				</div>

			</div>
		</div>
	);
};
