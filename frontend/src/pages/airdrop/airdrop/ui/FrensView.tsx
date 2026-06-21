import { Component, For, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { createQuery } from '@tanstack/solid-query';
import { getReferralInfo, ReferralInfo } from '@/shared/api/profile.js';

export const FrensView: Component = () => {
	const referralQuery = createQuery<ReferralInfo>(() => ({
		queryKey: ['referral-info'],
		queryFn: getReferralInfo as () => Promise<ReferralInfo>,
		staleTime: 60_000,
		refetchOnWindowFocus: false,
	}));

	const handleInvite = () => {
		try {
			hapticFeedback.impactOccurred('light');
		} catch (_) {}
		const code = referralQuery.data?.referralCode || 'ref_fallback';
		const link = `https://t.me/iFragmentBot?start=${code}`;
		openTelegramLink(
			`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t('airdropFinal.friends.subtitle'))}`,
		);
	};

	return (
		<div 
			class="flex-1 overflow-y-auto no-scrollbar animate-fade-in pb-36 px-5 relative" 
			style={{ background: '#000' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			<div class="flex flex-col items-center pt-10">
				<div class="text-[80px] mb-4">🐻</div>
				<h1 class="text-[32px] font-black text-white tracking-tight mb-2">{t('airdropFinal.friends.title')}</h1>
				<p class="text-[#8e8e93] text-[15px] text-center max-w-[280px]">
					{t('airdropFinal.friends.subtitle')}
				</p>

				{/* Invite Bonuses */}
				<div class="w-full mt-8 flex flex-col gap-3">
					<div class="bg-[#1c1c1e] rounded-[24px] p-4 flex items-center gap-4 border border-white/5">
						<div class="w-12 h-12 bg-amber-400/10 rounded-2xl flex items-center justify-center shrink-0">
							<span class="text-amber-400 text-[24px]">🎁</span>
						</div>
						<div class="flex flex-col">
							<span class="text-white font-bold text-[16px]">{t('airdropFinal.friends.inviteBoxTitle')}</span>
							<span class="text-amber-400 font-bold text-[14px] flex items-center gap-1 mt-0.5">
								<span class="text-[#ffcc00] text-[12px]">🟡</span> {t('airdropFinal.friends.inviteBoxDesc')}
							</span>
						</div>
					</div>

					<div class="bg-[#1c1c1e] rounded-[24px] p-4 flex items-center gap-4 border border-white/5">
						<div class="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center shrink-0">
							<span class="text-[24px]">⭐️</span>
						</div>
						<div class="flex flex-col">
							<span class="text-white font-bold text-[16px]">{t('airdropFinal.friends.premiumBoxTitle')}</span>
							<span class="text-amber-400 font-bold text-[14px] flex items-center gap-1 mt-0.5">
								<span class="text-[#ffcc00] text-[12px]">🟡</span> {t('airdropFinal.friends.premiumBoxDesc')}
							</span>
						</div>
					</div>
				</div>

				{/* Friends List */}
				<div class="w-full mt-10">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-[20px] font-bold text-white">{t('airdropFinal.friends.listTitle')}</h2>
						<Show when={referralQuery.data?.totalInvited}>
							<span class="text-[#8e8e93] font-medium">{referralQuery.data?.totalInvited} {t('airdropFinal.friends.frensCount')}</span>
						</Show>
					</div>

					<Show when={referralQuery.isLoading}>
						<div class="flex items-center justify-center py-8">
							<span class="material-symbols-outlined animate-spin text-[#3390ec] text-3xl">progress_activity</span>
						</div>
					</Show>

					<Show when={!referralQuery.isLoading && referralQuery.data?.friends?.length === 0}>
						<div class="bg-[#1c1c1e] rounded-[24px] p-8 flex flex-col items-center justify-center border border-white/5">
							<span class="text-[40px] mb-3 grayscale opacity-50">👻</span>
							<span class="text-[#8e8e93] text-[15px] font-medium text-center">{t('airdropFinal.friends.noFriends')}</span>
						</div>
					</Show>

					<Show when={!referralQuery.isLoading && (referralQuery.data?.friends?.length ?? 0) > 0}>
						<div class="flex flex-col gap-3">
							<For each={referralQuery.data?.friends}>
								{(friend) => (
									<div class="bg-[#1c1c1e] rounded-[20px] p-4 flex items-center justify-between border border-white/5 active:bg-white/5 transition-colors">
										<div class="flex items-center gap-3 min-w-0">
											<div class="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-xl overflow-hidden shrink-0 border border-white/10">
												<Show when={friend.avatar} fallback={<span class="text-white/50 text-[18px]">👤</span>}>
													<img src={friend.avatar} alt={friend.name} class="w-full h-full object-cover" />
												</Show>
											</div>
											<div class="flex flex-col min-w-0">
												<span class="text-white font-bold text-[16px] truncate">{friend.name}</span>
												<span class="text-white/80 text-[13px] font-medium flex items-center gap-1 mt-0.5">
													<span class="text-[#ffcc00] text-[12px]">🟡</span> +{friend.earned.toLocaleString('en-US')}
												</span>
											</div>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>
				</div>

				{/* Fixed bottom invite button */}
				<div class="fixed bottom-24 left-0 right-0 p-4 z-50">
					<div class="max-w-md mx-auto">
						<button
							onClick={handleInvite}
							disabled={referralQuery.isLoading}
							class="w-full bg-[#007aff] text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-transform text-[17px] shadow-[0_4px_12px_rgba(0,122,255,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
						>
							{t('airdropFinal.friends.inviteBtn')}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
