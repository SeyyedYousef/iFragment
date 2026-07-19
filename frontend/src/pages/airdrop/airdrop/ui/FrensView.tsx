import { createQuery } from '@tanstack/solid-query';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, For, Show } from 'solid-js';
import { getReferralInfo } from '@/shared/api/profile.js';
import { formatCoins, formatNumber, t } from '@/shared/i18n/index.js';
import { openTelegramLink } from '@/shared/lib/telegram-native.js';

export const FrensView: Component = () => {
	const referralQuery = createQuery(() => ({
		queryKey: ['profile', 'referral'],
		queryFn: getReferralInfo,
		staleTime: 60000,
	}));

	const refInfo = () => referralQuery.data || null;

	const handleInvite = () => {
		const link = refInfo()?.referralCode;
		if (!link) return;
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}
		const fullLink = `https://t.me/iFragmentBot/iFragment?startapp=${link}`;
		openTelegramLink(
			`https://t.me/share/url?url=${encodeURIComponent(fullLink)}&text=${encodeURIComponent('Join me on iFragment and earn free Coins! 🟡')}`,
		);
	};

	const frensCount = () => refInfo()?.totalInvited ?? 0;

	return (
		<div
			class="flex-1 overflow-y-auto no-scrollbar relative pb-32 bg-[#08090d] text-white selection:bg-[#0098ea]/30"
			style={{ background: 'radial-gradient(ellipse at 50% 0%, #0c1220 0%, #08090d 100%)' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			<div class="max-w-md mx-auto px-4 pt-8">
				{/* Hero Header */}
				<div class="flex flex-col items-center text-center mb-6 relative">
					{/* Ambient glow */}
					<div
						class="absolute top-0 left-1/2 -translate-x-1/2 w-[280px] h-[280px] rounded-full pointer-events-none z-0"
						style={{
							background: 'radial-gradient(circle, rgba(0, 152, 234, 0.12) 0%, transparent 65%)',
							filter: 'blur(50px)',
						}}
					/>

					{/* Icon Badge */}
					<div class="w-16 h-16 rounded-2xl bg-[#121622] border border-[#0098ea]/30 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(0,152,234,0.15)] relative z-10 shrink-0">
						<span class="material-symbols-outlined text-[#0098ea] text-[34px]">group_add</span>
					</div>

					<h1 class="text-3xl font-black tracking-tight text-white mb-1.5 relative z-10">
						<span class="font-mono tabular-nums">{frensCount()}</span>{' '}
						{t('airdrop.friends.friendsJoined') || 'Frens'}
					</h1>
					<p class="text-white/50 text-[13px] font-medium leading-relaxed max-w-[280px] mb-5 relative z-10">
						{t('airdrop.friends.subtitle') ||
							'Invite friends to earn bonus coins and climb global leaderboards.'}
					</p>

					{/* Invite CTA Button */}
					<button
						onClick={handleInvite}
						class="w-full h-12 bg-[#0098ea] hover:bg-[#0088d4] text-white font-bold text-xs uppercase tracking-wider rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(0,152,234,0.3)] relative z-10"
					>
						<span>{t('airdrop.friends.inviteBtn') || 'Invite a fren'}</span>
						<span class="material-symbols-outlined text-base">person_add</span>
					</button>
				</div>

				{/* Frens List Container */}
				<div class="mt-6 flex flex-col">
					<div class="flex items-center justify-between mb-2 px-1">
						<span class="text-[11px] font-mono font-bold uppercase tracking-widest text-white/40">
							{t('airdrop.friends.yourReferrals') || 'Frens list'}
						</span>
						<span class="text-[11px] font-mono text-white/30" dir="ltr">
							Total: {frensCount()}
						</span>
					</div>

					<div class="bg-[#10141e] rounded-2xl p-2 border border-white/[0.08] shadow-2xl min-h-[160px]">
						<Show
							when={refInfo()?.friends && refInfo()!.friends.length > 0}
							fallback={
								<div class="flex flex-col items-center justify-center py-12 gap-1.5">
									<span class="material-symbols-outlined text-white/20 text-3xl">
										people_outline
									</span>
									<span class="text-white/30 text-xs font-medium">
										{t('airdrop.friends.noFriends') || "You haven't invited anyone yet."}
									</span>
								</div>
							}
						>
							<div class="flex flex-col">
								<For each={refInfo()?.friends}>
									{(friend, index) => {
										const rank = index() + 1;
										const isLast = index() === (refInfo()?.friends.length || 0) - 1;
										return (
											<div
												class={`flex items-center justify-between p-3 hover:bg-[#151a28] rounded-xl transition-colors ${!isLast ? 'border-b border-white/[0.05]' : ''}`}
											>
												<div class="flex items-center gap-3 min-w-0 pr-2">
													{/* Rank */}
													<span class="w-6 text-center text-xs font-mono font-bold text-white/30 shrink-0">
														{rank < 10 ? `0${rank}` : rank}
													</span>

													{/* Avatar */}
													<div class="w-9 h-9 rounded-full bg-[#161b28] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold text-white">
														<img
															src={`/api/v1/profile/avatar/${friend.id}`}
															alt={friend.name}
															class="w-full h-full object-cover"
															onError={(e) => {
																(e.target as HTMLImageElement).style.display = 'none';
															}}
														/>
														<span>{friend.name.slice(0, 2).toUpperCase()}</span>
													</div>

													{/* Info */}
													<div class="flex flex-col min-w-0">
														<span class="text-white font-semibold text-sm truncate tracking-tight">
															{friend.name}
														</span>
														<span class="text-white/40 text-[11px] font-mono">
															{formatNumber(friend.frensCount || 0)} frens
														</span>
													</div>
												</div>

												{/* Reward Coins */}
												<div
													class="shrink-0 flex items-center gap-1 pl-2 font-mono font-bold text-xs text-amber-400 tabular-nums"
													dir="ltr"
												>
													<span>🪙</span>
													<span>{formatCoins(friend.airdropCoins || 0)}</span>
												</div>
											</div>
										);
									}}
								</For>
							</div>
						</Show>
					</div>
				</div>
			</div>
		</div>
	);
};
