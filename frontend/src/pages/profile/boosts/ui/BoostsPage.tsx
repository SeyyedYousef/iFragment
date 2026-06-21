import { useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, onCleanup, onMount } from 'solid-js';
import { BoostersView } from '@/pages/airdrop/airdrop/ui/BoostersView.js';

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
		<div class="min-h-screen bg-[#000000] pb-32 text-white font-sans flex flex-col">
			{/* Simple Header */}
			<div class="relative pt-6 pb-2 px-6 text-center shrink-0">
				<div class="absolute top-4 left-4 flex items-center gap-2 z-10">
					<button
						onClick={() => {
							try {
								hapticFeedback.impactOccurred('light');
							} catch {}
							navigate('/profile');
						}}
						class="flex items-center justify-center w-10 h-10 rounded-full bg-transparent active:bg-white/10 transition-colors"
					>
						<span class="material-symbols-outlined text-[24px] text-white">arrow_back_ios_new</span>
					</button>
				</div>
			</div>

			<div class="flex-1 overflow-hidden mt-4">
				<BoostersView />
			</div>
		</div>
	);
};
