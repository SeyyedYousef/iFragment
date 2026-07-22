import { useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, onCleanup, onMount } from 'solid-js';
import { BoostersView } from '@/pages/airdrop/airdrop/ui/BoostersView.js';
import { isRtl, t } from '@/shared/i18n/index.js';

export const BoostsPage: Component = () => {
	const navigate = useNavigate();

	onMount(() => {
		try {
			backButton.show();
			const off = backButton.onClick(() => {
				try {
					hapticFeedback.impactOccurred('light');
				} catch {}
				navigate('/profile');
			});
			onCleanup(() => {
				off();
				try {
					backButton.hide();
				} catch {}
			});
		} catch {}
	});

	return (
		<div
			class="min-h-screen bg-[#030303] pb-10 text-white font-sans flex flex-col relative overflow-x-hidden selection:bg-orange-500/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow (Energy Theme) */}
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-orange-500/20 via-orange-500/5 to-transparent blur-[90px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm shrink-0">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => {
							try {
								hapticFeedback.impactOccurred('light');
							} catch {}
							navigate('/profile');
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label="Back"
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
							{t('boosters.title')}
						</h1>
						<span class="text-[11px] font-bold text-white/50 uppercase tracking-wider truncate mt-0.5">
							{t('boosters.subtitle')}
						</span>
					</div>
				</div>

				<div class="w-11 h-11 rounded-[14px] bg-gradient-to-br from-orange-500/20 to-orange-500/5 flex items-center justify-center border border-orange-500/30 shrink-0 shadow-inner">
					<span class="material-symbols-outlined text-orange-400 text-[22px] drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">
						rocket_launch
					</span>
				</div>
			</div>

			{/* ═══════ BOOSTERS CONTENT ═══════ */}
			<div class="flex-1 w-full max-w-md mx-auto relative z-10 flex flex-col overflow-hidden mt-2">
				<BoostersView />
			</div>
		</div>
	);
};
