import { Component, For, Show } from 'solid-js';
import { createQuery } from '@tanstack/solid-query';
import { hapticFeedback, retrieveLaunchParams } from '@tma.js/sdk-solid';
import { getProfileStats, getReferralInfo } from '@/shared/api/profile.js';
import { formatNumber, t, formatCoins } from '@/shared/i18n/index.js';
import { openTelegramLink } from '@/shared/lib/telegram-native.js';

export const FrensView: Component = () => {
	const referralQuery = createQuery(() => ({
		queryKey: ['profile', 'referral'],
		queryFn: getReferralInfo,
		staleTime: 60000,
	}));

	const profileQuery = createQuery(() => ({
		queryKey: ['profile', 'stats'],
		queryFn: getProfileStats,
		staleTime: 60000,
	}));

	const refInfo = () => referralQuery.data || null;
	const myStats = () => profileQuery.data || null;

	let myName = 'You';
	try {
		const user = retrieveLaunchParams().initData?.user;
		if (user?.firstName) {
			myName = user.firstName;
		}
	} catch (e) {
		// Ignore
	}

	const handleInvite = () => {
		const link = refInfo()?.referralCode;
		if (!link) return;
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}
		const fullLink = `https://t.me/iFragmentBot?start=${link}`;
		// Use openTelegramLink to trigger the native share sheet
		openTelegramLink(
			`https://t.me/share/url?url=${encodeURIComponent(fullLink)}&text=${encodeURIComponent('Join me on iFragment and earn free Coins! 🟡')}`,
		);
	};



	const frensCount = () => refInfo()?.totalInvited ?? 0;

	return (
		<div
			class="flex-1 overflow-y-auto no-scrollbar bg-black text-white flex flex-col font-sans relative pb-28"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Header Section */}
			<div class="px-5 pt-14 pb-8 flex flex-col items-center">
				<h1 class="text-[40px] font-bold tracking-tight mb-3 text-center text-white">
					{frensCount()} {t('airdrop.friends.friendsJoined') || 'Frens'}
				</h1>
				<p class="text-[#8e8e93] text-[15px] text-center mb-10 font-normal leading-relaxed max-w-[280px]">
					{t('airdrop.friends.subtitle') || 'Invite a friend to get bonuses and increase your squad'}
				</p>

				{/* Premium Invite Button */}
				<button
					onClick={handleInvite}
					class="w-full h-14 bg-white text-black rounded-[16px] font-semibold text-[17px] active:scale-[0.98] transition-transform flex items-center justify-center gap-2 shadow-sm"
				>
					{t('airdrop.friends.inviteBtn') || 'Invite a fren'}
					<span class="material-symbols-outlined text-[20px]">person_add</span>
				</button>
			</div>

			{/* Frens List Section */}
			<div class="px-5 mt-2 flex-1 flex flex-col">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-[17px] font-semibold text-white">
						{t('airdrop.friends.yourReferrals') || 'Frens list'}
					</h2>
				</div>

				<Show
					when={refInfo()?.friends && refInfo()!.friends.length > 0}
					fallback={
						<div class="flex-1 flex flex-col items-center justify-center py-10">
							<p class="text-[#8e8e93] text-[15px] font-medium">
								{t('airdrop.friends.noFriends') || "You haven't invited anyone yet"}
							</p>
						</div>
					}
				>
					<div class="flex flex-col gap-1">
						<For each={refInfo()?.friends}>
							{(friend, index) => {
								const rank = index() + 1;
								return (
									<div class="flex items-center py-3 px-1 hover:bg-white/5 rounded-[16px] transition-colors">
										<div class="w-7 text-left text-[15px] font-medium text-[#8e8e93] shrink-0">
											{rank}
										</div>
										<div class="w-[46px] h-[46px] rounded-full bg-[#1c1c1e] overflow-hidden mr-3 shrink-0 flex items-center justify-center">
											<img
												src={`/api/v1/profile/avatar/${friend.id}`}
												alt={friend.name}
												class="w-full h-full object-cover"
												onError={(e) => {
													(e.target as HTMLImageElement).style.display = 'none';
													(e.target as HTMLImageElement).nextElementSibling?.classList.remove(
														'hidden',
													);
												}}
											/>
											<div class="hidden w-full h-full bg-[#2c2c2e] flex items-center justify-center text-white font-medium text-[15px]">
												{friend.name.substring(0, 1).toUpperCase()}
											</div>
										</div>
										<div class="flex-1 min-w-0 flex flex-col justify-center items-start pr-2">
											<div class="text-white font-medium text-[16px] truncate leading-tight w-full text-left">
												{friend.name}
											</div>
											<div class="text-[#8e8e93] text-[13px] font-normal mt-1 leading-none w-full text-left">
												{formatNumber(friend.frensCount || 0)} {t('airdrop.friends.friendsJoined') || 'frens'}
											</div>
										</div>
										<div class="flex flex-col items-end justify-center shrink-0">
											<div class="text-white font-medium text-[15px] tracking-tight flex items-center gap-1.5" dir="ltr">
												{formatCoins(friend.airdropCoins || 0)} <span class="text-[#F5A623] text-sm">🟡</span>
											</div>
										</div>
									</div>
								);
							}}
						</For>
					</div>
				</Show>
			</div>
		</div>
	);
};
