import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';

import type { Component } from 'solid-js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';

export const DashboardPage: Component = () => {
	const navigate = useNavigate();

	return (
		<div
			class="min-h-screen bg-[#030303] relative overflow-y-auto no-scrollbar text-white flex flex-col font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-[#3390ec]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ TOP HEADER AREA ═══════ */}
			<div class="pt-10 pb-6 px-6 text-center relative z-10 flex flex-col items-center">
				<Motion.div
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.5, easing: [0.32, 0.72, 0, 1] }}
					class="flex flex-col items-center justify-center w-full max-w-md"
				>
					{/* Premium 3D App Icon */}
					<div class="w-20 h-20 rounded-[24px] bg-gradient-to-br from-[#12141C] to-[#08090D] border-[1.5px] border-[#3390ec]/30 flex items-center justify-center mb-4 shadow-[inset_0_2px_12px_rgba(255,255,255,0.05),0_10px_30px_rgba(51,144,236,0.2)] relative overflow-hidden">
						<div class="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 bg-[#3390ec]/20 blur-xl rounded-full" />
						<span
							class="material-symbols-outlined text-[#3390ec] text-[40px] drop-shadow-md"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							dashboard
						</span>
					</div>
					<h1 class="text-[28px] font-black tracking-tight text-white mb-1.5 drop-shadow-sm">
						{t('dashboard.title')}
					</h1>
					<p class="text-white/50 text-[13px] font-medium max-w-xs mx-auto leading-relaxed">
						{t('dashboard.description')}
					</p>
				</Motion.div>
			</div>

			{/* ═══════ MAIN CONTENT AREA (Glassmorphism HUD) ═══════ */}
			<Motion.div
				initial={{ opacity: 0, y: 120 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, easing: [0.32, 0.72, 0, 1] }}
				class="flex-1 w-full bg-[#12141C]/90 backdrop-blur-2xl border-t border-white/10 rounded-t-[40px] relative z-20 shadow-[0_-30px_80px_rgba(0,0,0,0.8)] pt-5 pb-32 px-4 flex flex-col items-center"
			>
				{/* Inner Top Glow & iOS Style Grab Handle */}
				<div class="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
				<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />

				<div class="w-full max-w-[420px] flex flex-col gap-6">

					{/* ── MANAGEMENT CARDS ── */}
					<div class="flex flex-col gap-3.5 w-full">
						{/* Card 1: Group Management */}
						<div
							role="button"
							tabIndex={0}
							onClick={() => {
								haptic.impact('medium');
								navigate('/managed-bots');
							}}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									haptic.impact('medium');
									navigate('/managed-bots');
								}
							}}
							class="w-full bg-[#08090D] rounded-[24px] p-4.5 border border-white/5 hover:border-[#3390ec]/40 shadow-sm hover:shadow-[0_8px_30px_rgba(51,144,236,0.15)] flex flex-col gap-4 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[#3390ec]/50"
						>
							<div class="absolute -right-10 -top-10 w-32 h-32 bg-[#3390ec]/10 rounded-full blur-3xl group-hover:bg-[#3390ec]/20 transition-all pointer-events-none" />

							<div class="flex items-start gap-4 relative z-10">
								<div class="w-14 h-14 rounded-[16px] bg-[#3390ec]/10 flex items-center justify-center shrink-0 border border-[#3390ec]/20 group-hover:scale-110 transition-transform duration-300 shadow-inner">
									<span class="material-symbols-outlined text-[#3390ec] text-[28px] drop-shadow-md">
										groups
									</span>
								</div>
								<div class="flex-1 pt-1 flex flex-col text-start">
									<h3 class="text-[16px] font-black text-white mb-1 tracking-tight">
										{t('dashboard.groupMgmt')}
									</h3>
									<p class="text-[12px] text-white/50 leading-relaxed font-medium">
										{t('dashboard.groupDesc')}
									</p>
								</div>
							</div>

							<div class="flex items-center justify-between border-t border-white/5 pt-3.5 mt-1 relative z-10">
								<span class="text-[11px] font-bold text-[#3390ec] uppercase tracking-widest pl-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
									{t('dashboardPg.manageGroups')}
								</span>
								<div class="w-10 h-10 rounded-[12px] bg-[#3390ec] text-white flex items-center justify-center group-hover:bg-[#2b7bc9] transition-colors shadow-md">
									<span class="material-symbols-outlined rtl:-scale-x-100 text-[20px]">
										arrow_forward
									</span>
								</div>
							</div>
						</div>

						{/* Card 2: Channel Management */}
						<div
							role="button"
							tabIndex={0}
							onClick={() => {
								haptic.impact('medium');
								navigate('/managed-channels');
							}}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									haptic.impact('medium');
									navigate('/managed-channels');
								}
							}}
							class="w-full bg-[#08090D] rounded-[24px] p-4.5 border border-white/5 hover:border-sky-400/40 shadow-sm hover:shadow-[0_8px_30px_rgba(14,165,233,0.15)] flex flex-col gap-4 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
						>
							<div class="absolute -right-10 -top-10 w-32 h-32 bg-sky-400/10 rounded-full blur-3xl group-hover:bg-sky-400/20 transition-all pointer-events-none" />

							<div class="flex items-start gap-4 relative z-10">
								<div class="w-14 h-14 rounded-[16px] bg-sky-500/10 flex items-center justify-center shrink-0 border border-sky-400/20 group-hover:scale-110 transition-transform duration-300 shadow-inner">
									<span class="material-symbols-outlined text-sky-400 text-[28px] drop-shadow-md">
										campaign
									</span>
								</div>
								<div class="flex-1 pt-1 flex flex-col text-start">
									<h3 class="text-[16px] font-black text-white mb-1 tracking-tight">
										{t('dashboard.channelMgmt')}
									</h3>
									<p class="text-[12px] text-white/50 leading-relaxed font-medium">
										{t('dashboard.channelDesc')}
									</p>
								</div>
							</div>

							<div class="flex items-center justify-between border-t border-white/5 pt-3.5 mt-1 relative z-10">
								<span class="text-[11px] font-bold text-sky-400 uppercase tracking-widest pl-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
									{t('dashboardPg.manageChannels')}
								</span>
								<div class="w-10 h-10 rounded-[12px] bg-sky-500 text-white flex items-center justify-center group-hover:bg-sky-600 transition-colors shadow-md">
									<span class="material-symbols-outlined rtl:-scale-x-100 text-[20px]">
										arrow_forward
									</span>
								</div>
							</div>
						</div>

						{/* ── DEMO / PREVIEW STRIP ── */}
						<div class="w-full rounded-[24px] border border-dashed border-amber-400/25 bg-amber-400/[0.04] p-4 flex flex-col gap-3">
							<div class="flex items-center gap-2.5">
								<span class="material-symbols-outlined text-amber-400 text-[20px]">science</span>
								<div class="flex flex-col text-start">
									<h4 class="text-[13px] font-black text-amber-300">{t('demo.tryTitle')}</h4>
									<p class="text-[11px] text-white/45 font-medium">{t('demo.tryDesc')}</p>
								</div>
							</div>
							<div class="flex gap-2">
								<button
									type="button"
									onClick={() => {
										haptic.impact('light');
										navigate('/group/demo-group');
									}}
									class="flex-1 h-11 rounded-[14px] bg-[#08090D] border border-white/10 hover:border-[#3390ec]/40 text-white/80 text-[12px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5"
								>
									<span class="material-symbols-outlined text-[18px] text-[#3390ec]">groups</span>
									{t('demo.previewGroup')}
								</button>
								<button
									type="button"
									onClick={() => {
										haptic.impact('light');
										navigate('/channel/demo-channel');
									}}
									class="flex-1 h-11 rounded-[14px] bg-[#08090D] border border-white/10 hover:border-sky-400/40 text-white/80 text-[12px] font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5"
								>
									<span class="material-symbols-outlined text-[18px] text-sky-400">campaign</span>
									{t('demo.previewChannel')}
								</button>
							</div>
						</div>
					</div>
				</div>
			</Motion.div>

			<div class="z-50 relative">
				<BottomNav />
			</div>
		</div>
	);
};
