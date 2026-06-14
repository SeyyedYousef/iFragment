import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
export const DashboardPage: Component = () => {
	const navigate = useNavigate();
	return (
		<div class="min-h-screen bg-[#0f1014] pb-40 relative overflow-y-auto no-scrollbar text-white">
			{/* Top Header Area */}
			<div class="pt-10 pb-20 px-6 text-center relative z-10">
				<Motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
					class="flex flex-col items-center justify-center mb-2"
				>
					<div class="w-20 h-20 rounded-[20px] bg-[#1c1c1c] flex items-center justify-center mb-4 border border-[#2a2a2a] shadow-inner">
						<span
							class="material-symbols-outlined text-[#3390ec] text-4xl"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							dashboard
						</span>
					</div>
					<h1 class="text-3xl font-black tracking-tight">{t('dashboard.title')}</h1>
					<p class="text-on-surface-variant mt-2 font-medium max-w-xs mx-auto text-sm">
						{t('dashboard.description')}
					</p>
				</Motion.div>
			</div>

			{/* Main Content Area (Dark Card) */}
			<Motion.div
				initial={{ opacity: 0, y: 100 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.6, easing: [0.4, 0, 0.2, 1] }}
				class="w-full bg-[#1c1c1c] border-t border-[#2a2a2a] rounded-t-[40px] relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] pt-8 pb-12 px-5 min-h-[60vh] -mt-10"
			>
				<div class="flex flex-col gap-4">
					{/* Card 1: Group Management */}
					<Motion.div
						role="button"
						tabIndex={0}
						onClick={() => {
							hapticFeedback.impactOccurred('medium');
							navigate('/managed-bots');
						}}
						onKeyDown={(e: KeyboardEvent) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								hapticFeedback.impactOccurred('medium');
								navigate('/managed-bots');
							}
						}}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: 0.1, duration: 0.5, easing: [0.34, 1.56, 0.64, 1] }}
						class="bg-[#0f1014] rounded-3xl p-5 shadow-inner border border-[#2a2a2a] flex flex-col gap-4 relative overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3390ec] hover:scale-[1.02] active:scale-[0.96] transition-all"
					>
						<div class="flex items-start gap-4 relative z-10">
							<div class="w-14 h-14 rounded-2xl bg-[#1c1c1c] flex items-center justify-center shrink-0 border border-[#2a2a2a] group-hover:scale-110 transition-transform duration-300">
								<span class="material-symbols-outlined text-[#3390ec] text-3xl">groups</span>
							</div>
							<div class="flex-1 pt-1">
								<h3 class="text-lg font-bold text-white mb-1">{t('dashboard.groupMgmt')}</h3>
								<p class="text-sm text-on-surface-variant leading-relaxed font-medium">
									{t('dashboard.groupDesc')}
								</p>
							</div>
						</div>

						<div class="flex items-center justify-end mt-2 relative z-10">
							<div class="w-10 h-10 rounded-full bg-[#3390ec] text-white flex items-center justify-center group-hover:bg-[#2b7bc9] transition-all shadow-sm">
								<span class="material-symbols-outlined rtl:-scale-x-100 group-hover:translate-x-1 transition-transform">
									arrow_forward
								</span>
							</div>
						</div>
					</Motion.div>

					{/* Card 2: Channel Management */}
					<Motion.div
						role="button"
						tabIndex={0}
						onClick={() => {
							hapticFeedback.impactOccurred('medium');
							navigate('/managed-channels'); // Link to channel management list
						}}
						onKeyDown={(e: KeyboardEvent) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								hapticFeedback.impactOccurred('medium');
								navigate('/managed-channels');
							}
						}}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: 0.2, duration: 0.5, easing: [0.34, 1.56, 0.64, 1] }}
						class="bg-[#0f1014] rounded-3xl p-5 shadow-inner border border-[#2a2a2a] flex flex-col gap-4 relative overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3390ec] hover:scale-[1.02] active:scale-[0.96] transition-all"
					>
						<div class="flex items-start gap-4 relative z-10">
							<div class="w-14 h-14 rounded-2xl bg-[#1c1c1c] flex items-center justify-center shrink-0 border border-[#2a2a2a] group-hover:scale-110 transition-transform duration-300">
								<span class="material-symbols-outlined text-[#3390ec] text-3xl">campaign</span>
							</div>
							<div class="flex-1 pt-1">
								<h3 class="text-lg font-bold text-white mb-1">{t('dashboard.channelMgmt')}</h3>
								<p class="text-sm text-[#a0a4ad] leading-relaxed font-medium">
									{t('dashboard.channelDesc')}
								</p>
							</div>
						</div>

						<div class="flex items-center justify-end mt-2 relative z-10">
							<div class="w-10 h-10 rounded-full bg-[#3390ec] text-white flex items-center justify-center group-hover:bg-[#2b7bc9] transition-all shadow-sm">
								<span class="material-symbols-outlined rtl:-scale-x-100 group-hover:translate-x-1 transition-transform">
									arrow_forward
								</span>
							</div>
						</div>
					</Motion.div>
				</div>
			</Motion.div>

			<BottomNav />
		</div>
	);
};
