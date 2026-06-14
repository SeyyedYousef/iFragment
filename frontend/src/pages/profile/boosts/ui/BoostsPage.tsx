import { useNavigate } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, onCleanup, onMount } from 'solid-js';
import { BoostersView } from '@/pages/airdrop/airdrop/ui/BoostersView.js';
import { t } from '@/shared/i18n/index.js';
import { balance } from '@/shared/store/airdrop.js';

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
		<div class="min-h-screen bg-[#0f1014] pb-32 text-white font-sans flex flex-col">
			{/* Header */}
			<div class="relative bg-gradient-to-b from-[#1a1b23] to-[#0f1014] pt-12 pb-8 px-6 text-center border-b border-[#222] shrink-0">
				<div class="absolute top-4 left-6 flex items-center gap-2">
					<button
						onClick={() => {
							try {
								hapticFeedback.impactOccurred('light');
							} catch {}
							navigate('/profile');
						}}
						class="flex items-center justify-center w-8 h-8 rounded-full bg-[#1c1c1c] border border-[#2a2a2a]"
					>
						<span class="material-symbols-outlined text-[16px] text-white">arrow_back</span>
					</button>
				</div>

				<h1 class="text-2xl font-black tracking-tight text-white mb-1">
					{t('gamification.boostsTitle')}
				</h1>
				<p class="text-xs text-[#a0a4ad]">{t('gamification.boostsSubtitle')}</p>
			</div>

			<div class="px-6 py-6 flex flex-col gap-5 flex-1 overflow-hidden">
				{/* Balance card */}
				<div class="bg-gradient-to-r from-[#1c1c24] to-[#15161d] border border-[#2a2a2a] rounded-3xl p-5 flex items-center justify-between shrink-0">
					<div class="flex flex-col gap-1">
						<span class="text-[10px] text-[#a0a4ad] font-black uppercase tracking-wider">
							{t('gamification.yourFrgBalance')}
						</span>
						<span class="text-xl font-black text-[#3390ec]">
							{Math.floor(balance()).toLocaleString()}{' '}
							<span class="text-[10px] text-white font-bold tracking-widest uppercase">
								{t('airdrop.boosters.currency')}
							</span>
						</span>
					</div>
					<div class="w-10 h-10 rounded-2xl bg-[#3390ec]/10 border border-[#3390ec]/20 flex items-center justify-center text-[#3390ec]">
						<span class="material-symbols-outlined text-[20px]">account_balance_wallet</span>
					</div>
				</div>

				<div class="flex-1 overflow-hidden -mx-4 -mb-6">
					<BoostersView hideHeader={true} />
				</div>
			</div>
		</div>
	);
};
