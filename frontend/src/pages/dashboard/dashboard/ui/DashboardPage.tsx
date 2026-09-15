import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import type { Component } from 'solid-js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';

export const DashboardPage: Component = () => {
	const navigate = useNavigate();

	const hubCards = [
		{
			title: 'Telegram Gifts Intel',
			description: 'Real-time appraisal, rarity matrix, floor pricing & crafting calculator.',
			icon: 'featured_seasonal_and_gifts',
			accentColor: '#AF52DE',
			path: '/gifts',
			badge: 'Live',
		},
		{
			title: 'Numbers +888 Valuation',
			description: 'Mathematical NV engine, mask patterns & realized Fragment sales data.',
			icon: 'dialpad',
			accentColor: '#F59E0B',
			path: '/numbers',
			badge: 'NV Engine',
		},
		{
			title: 'Airdrop & Tap-to-Earn',
			description: 'Multi-tap mining, offline bots, energy boosters & clan wars.',
			icon: 'touch_app',
			accentColor: '#0098EA',
			path: '/airdrop',
			badge: 'Farming',
		},
		{
			title: 'Usernames Valuation',
			description: 'Comprehensive valuation, auction analytics & market liquidity scores.',
			icon: 'alternate_email',
			accentColor: '#10B981',
			path: '/',
			badge: 'Core',
		},
	];

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
						{t('dashboard.title' as any) || 'iFragment Hub'}
					</h1>
					<p class="text-white/50 text-[13px] font-medium max-w-xs mx-auto leading-relaxed">
						{t('dashboard.description' as any) ||
							'Explore telegram collectibles intelligence, valuations & tools.'}
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
				<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6" />

				<div class="w-full max-w-[420px] flex flex-col gap-3">
					{hubCards.map((card) => (
						<div
							role="button"
							tabIndex={0}
							onClick={() => {
								haptic.impact('medium');
								navigate(card.path);
							}}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									haptic.impact('medium');
									navigate(card.path);
								}
							}}
							class="w-full bg-[#08090D] rounded-[22px] p-4 border border-white/5 hover:border-white/20 shadow-sm flex flex-col gap-3 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all duration-300 outline-none"
						>
							<div
								class="absolute -right-10 -top-10 w-28 h-28 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-all pointer-events-none"
								style={{ 'background-color': card.accentColor }}
							/>

							<div class="flex items-start gap-3.5 relative z-10">
								<div
									class="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 border border-white/10 group-hover:scale-105 transition-transform duration-300 shadow-inner"
									style={{ 'background-color': `${card.accentColor}18` }}
								>
									<span
										class="material-symbols-outlined text-[24px] drop-shadow-md"
										style={{ color: card.accentColor }}
									>
										{card.icon}
									</span>
								</div>
								<div class="flex-1 pt-0.5 flex flex-col text-start min-w-0">
									<div class="flex items-center justify-between gap-2 mb-1">
										<h3 class="text-[15px] font-black text-white tracking-tight truncate">
											{card.title}
										</h3>
										<span
											class="text-[9px] font-black px-2 py-0.5 rounded-[6px] uppercase tracking-wider shrink-0"
											style={{
												'background-color': `${card.accentColor}20`,
												color: card.accentColor,
												border: `1px solid ${card.accentColor}40`,
											}}
										>
											{card.badge}
										</span>
									</div>
									<p class="text-[11px] text-white/45 leading-relaxed font-medium line-clamp-2">
										{card.description}
									</p>
								</div>
							</div>

							<div class="flex items-center justify-between border-t border-white/5 pt-2.5 relative z-10">
								<span class="text-[10px] font-bold text-white/40 group-hover:text-white transition-colors">
									Open Vertical
								</span>
								<span class="material-symbols-outlined rtl:-scale-x-100 text-[18px] text-white/30 group-hover:text-white transition-colors">
									arrow_forward
								</span>
							</div>
						</div>
					))}
				</div>
			</Motion.div>

			<div class="z-50 relative">
				<BottomNav />
			</div>
		</div>
	);
};
