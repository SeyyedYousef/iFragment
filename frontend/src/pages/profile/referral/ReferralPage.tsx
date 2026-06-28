import { createQuery } from '@tanstack/solid-query';
import { backButton, hapticFeedback, retrieveLaunchParams } from '@tma.js/sdk-solid';
import { Component, For, onCleanup, onMount, Show } from 'solid-js';
import { getProfileStats, getReferralInfo } from '@/shared/api/profile.js';
import { PROFILE_CONFIG } from '@/shared/config/profile.js';
import { formatNumber, formatCoins, t } from '@/shared/i18n/index.js';
import { openTelegramLink } from '@/shared/lib/telegram-native.js';

export const ReferralPage: Component = () => {
	const referralQuery = createQuery(() => ({
		queryKey: ['profile', 'referral'],
		queryFn: getReferralInfo,
		staleTime: PROFILE_CONFIG.STALE_TIME.REFERRAL,
	}));

	const profileQuery = createQuery(() => ({
		queryKey: ['profile', 'stats'],
		queryFn: getProfileStats,
		staleTime: PROFILE_CONFIG.STALE_TIME.STATS,
	}));

	const refInfo = () => referralQuery.data || null;
	const myStats = () => profileQuery.data || null;

	let myName = t('referral.you') || 'You';
	try {
		const user = retrieveLaunchParams().initData?.user;
		if (user?.firstName) {
			myName = user.firstName;
		}
	} catch (e) {
		// Ignore
	}

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => window.history.back());
		onCleanup(() => {
			off();
			try {
				backButton.hide();
			} catch {}
		});
	});

	const handleInvite = () => {
		const link = refInfo()?.referralCode;
		if (!link) return;
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}
		const fullLink = `https://t.me/iFragmentBot?start=${link}`;
		openTelegramLink(
			`https://t.me/share/url?url=${encodeURIComponent(fullLink)}&text=${encodeURIComponent('Join me on iFragment and earn free Coins! 🟡')}`,
		);
	};

	return (
		<div class="min-h-screen bg-gradient-to-b from-[#2B1B47] to-[#0A051A] text-white flex flex-col font-sans relative">
			<Show
				when={!referralQuery.isLoading}
				fallback={
					<div class="flex-1 flex items-center justify-center">
						<div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#F5A623]"></div>
					</div>
				}
			>
				{/* Header Section */}
				<div class="px-6 pt-12 pb-6 flex flex-col items-center">
					<div class="text-6xl mb-4 drop-shadow-[0_0_30px_rgba(245,166,35,0.4)] relative w-24 h-24 flex items-center justify-center">
						<span class="absolute -top-1 -left-2 text-2xl animate-pulse">✨</span>
						<span class="absolute top-2 -right-4 text-xl animate-pulse delay-75">✨</span>
						<span class="absolute -bottom-2 right-2 text-3xl animate-bounce">✨</span>
						<span class="text-7xl">📣</span>
					</div>
					<h1 class="text-[32px] font-black tracking-tight mb-2 text-center text-white drop-shadow-md">
						{t('referral.partyKings') || 'Party Kings'}
					</h1>
					<p class="text-[#a0a4ad] text-[15px] text-center mb-8 font-medium">
						{t('referral.inviteMoreFrens') || 'Invite more frens and get here'}
					</p>

					{/* Invite Button */}
					<button
						onClick={handleInvite}
						class="w-full py-[18px] bg-gradient-to-b from-[#FAD961] to-[#F76B1C] rounded-[24px] text-black font-black text-[18px] shadow-[0_8px_24px_rgba(247,107,28,0.3)] active:scale-[0.98] transition-transform flex items-center justify-center"
					>
						{t('referral.inviteFrens') || 'Invite frens'}
					</button>
				</div>

				{/* Leaderboard Section */}
				<div class="flex-1 px-4 pb-[104px]">
					<div class="bg-[#1c1c1e]/60 backdrop-blur-xl border border-[#2c2c2e]/40 rounded-[32px] p-2 overflow-hidden shadow-2xl">
						<Show
							when={refInfo()?.friends && refInfo()!.friends.length > 0}
							fallback={
								<div class="py-12 flex flex-col items-center text-center gap-3">
									<span class="text-5xl opacity-40">😢</span>
									<p class="text-[#8e8e93] text-sm font-medium">
										{t('referral.noFriends') || "You haven't invited anyone yet."}
									</p>
								</div>
							}
						>
							<For each={refInfo()?.friends}>
								{(friend, index) => {
									const rank = index() + 1;
									let rankDisplay: any = rank;
									if (rank === 1) rankDisplay = '🥇';
									else if (rank === 2) rankDisplay = '🥈';
									else if (rank === 3) rankDisplay = '🥉';

									return (
										<div class="flex items-center py-3.5 px-2 border-b border-[#2c2c2e]/40 last:border-0 hover:bg-white/5 rounded-2xl transition-colors">
											<div class="w-9 text-center text-[15px] font-bold text-[#8e8e93] shrink-0">
												{rankDisplay}
											</div>
											<div class="w-[50px] h-[50px] rounded-full bg-[#2c2c2e] overflow-hidden ml-1 mr-3 shrink-0 flex items-center justify-center relative shadow-inner">
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
												<div class="hidden absolute inset-0 bg-gradient-to-br from-[#3a3a3c] to-[#1c1c1e] flex items-center justify-center text-white font-bold text-sm">
													{friend.name.substring(0, 2).toUpperCase()}
												</div>
											</div>
											<div class="flex-1 min-w-0 pr-2">
												<div class="text-white font-bold text-[16px] truncate leading-tight">
													{friend.name}
												</div>
												<div class="text-[#8e8e93] text-[13px] font-medium mt-1 leading-none">
													{formatNumber(friend.frensCount ?? 0)} {t('airdrop.friends.friendsJoined') || 'frens'}
												</div>
											</div>
											<div class="flex flex-col items-end justify-center shrink-0 pr-1">
												<div class="text-[#F5A623] font-bold text-[14px] tracking-tight flex items-center gap-1">
													<span class="text-[#8e8e93] text-xs font-normal opacity-70 flex items-center">•</span>
													{formatCoins(friend.airdropCoins)} <span class="text-sm">🟡</span>
												</div>
											</div>
										</div>
									);
								}}
							</For>
						</Show>
					</div>
				</div>

				{/* Sticky Footer: "You" */}
				<div class="fixed bottom-0 left-0 right-0 bg-[#1c1c1e]/95 backdrop-blur-3xl border-t border-[#2c2c2e]/50 p-4 pb-8 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.6)]">
					<div class="flex items-center px-1 max-w-2xl mx-auto">
						<div class="w-10 text-center text-[14px] font-bold text-[#8e8e93] shrink-0">
							{myStats()?.globalRank || '—'}
						</div>
						<div class="w-[50px] h-[50px] rounded-full bg-[#2c2c2e] overflow-hidden ml-1 mr-3 shrink-0 relative flex items-center justify-center shadow-inner">
							<img
								src={myStats()?.photoUrl || ''}
								alt="You"
								class="w-full h-full object-cover"
								onError={(e) => {
									(e.target as HTMLImageElement).style.display = 'none';
									(e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
								}}
							/>
							<div class="hidden absolute inset-0 bg-gradient-to-br from-[#3a3a3c] to-[#1c1c1e] flex items-center justify-center text-white font-bold text-sm">
								{t('referral.you') || 'ME'}
							</div>
						</div>
						<div class="flex-1 min-w-0">
							<div class="text-white font-bold text-[16px] truncate leading-tight">
								{myName}
							</div>
							<div class="text-[#8e8e93] text-[13px] font-medium mt-1 leading-none flex items-center gap-1.5">
								<span class="text-[#F5A623] text-xs">🟡</span> {formatNumber(refInfo()?.totalInvited ?? 0)} {t('airdrop.friends.friendsJoined') || 'frens'}
							</div>
						</div>
						<div class="flex flex-col items-end justify-center shrink-0 pr-2">
							<div class="text-white font-bold text-[16px]">
								{t('referral.you') || 'You'}
							</div>
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
};
