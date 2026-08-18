import { createQuery } from '@tanstack/solid-query';

import { Component, createSignal, For, Show } from 'solid-js';
import { getReferralInfo } from '@/entities/user/index.js';
import { PROFILE_CONFIG } from '@/shared/config/profile.js';
import { formatCoins, formatNumber, t } from '@/shared/i18n/index.js';
import { openTelegramLink } from '@/shared/lib/telegram-native.js';
import { haptic } from '@/shared/lib/haptic.js';

export const FrensView: Component = () => {
	const [copied, setCopied] = createSignal(false);

	const referralQuery = createQuery(() => ({
		queryKey: ['profile', 'referral'],
		queryFn: getReferralInfo,
		staleTime: 60000,
	}));

	const refInfo = () => referralQuery.data || null;

	const getBotUsername = (): string => {
		const envUsername = import.meta.env.VITE_BOT_USERNAME as string | undefined;
		if (envUsername) return envUsername.replace('@', '');
		const tgBot = (window as any).Telegram?.WebApp?.initDataUnsafe?.bot?.username;
		if (tgBot) return tgBot;
		return PROFILE_CONFIG.IFRAGMENT_BOT || 'iFragmentBot';
	};

	const getReferralLink = (): string => {
		const code = refInfo()?.referralCode;
		const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
		const botUsername = getBotUsername();

		let refParam = '';
		if (code) {
			refParam = code.startsWith('ref_') ? code : `ref_${code}`;
		} else if (tgUser?.id) {
			refParam = `ref_${tgUser.id}`;
		}

		return refParam ? `https://t.me/${botUsername}?start=${refParam}` : `https://t.me/${botUsername}`;
	};

	const handleInvite = () => {
		const fullLink = getReferralLink();
		try {
			haptic.impact('medium');
		} catch {}
		openTelegramLink(
			`https://t.me/share/url?url=${encodeURIComponent(fullLink)}&text=${encodeURIComponent('Join me on iFragment and earn free Coins! 🟡')}`,
		);
	};

	const handleCopy = async () => {
		const fullLink = getReferralLink();
		try {
			await navigator.clipboard.writeText(fullLink);
			setCopied(true);
			try {
				haptic.notify('success');
			} catch {}
			setTimeout(() => setCopied(false), 2000);
		} catch {
			openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(fullLink)}`);
		}
	};

	const frensCount = () => refInfo()?.totalInvited ?? 0;

	return (
		<div
			class="flex-1 overflow-y-auto no-scrollbar relative pb-32 bg-[#030303] text-white selection:bg-[#3390ec]/30"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/20 via-[#3390ec]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			<div class="max-w-md mx-auto px-4 pt-8 relative z-10 flex flex-col gap-6">
				
				{/* ═══════ HERO HEADER ═══════ */}
				<div class="flex flex-col items-center text-center relative">
					{/* Icon Badge */}
					<div class="w-20 h-20 rounded-[24px] bg-gradient-to-br from-[#12141C] to-[#08090D] border-[1.5px] border-[#3390ec]/30 flex items-center justify-center mb-5 shadow-[inset_0_2px_12px_rgba(255,255,255,0.05),0_10px_30px_rgba(51,144,236,0.2)] relative overflow-hidden shrink-0">
						<div class="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 bg-[#3390ec]/20 blur-xl rounded-full" />
						<span class="material-symbols-outlined text-[#3390ec] text-[40px] drop-shadow-[0_0_12px_rgba(51,144,236,0.6)]">group_add</span>
					</div>

					<h1 class="text-[32px] font-black tracking-tight text-white mb-2 drop-shadow-md flex items-center gap-2">
						<span class="font-mono tabular-nums text-[#3390ec] bg-[#3390ec]/10 px-3 py-1 rounded-[12px] border border-[#3390ec]/20 shadow-inner">
							{frensCount()}
						</span>
						{t('airdrop.friends.friendsJoined') || 'Frens'}
					</h1>
					<p class="text-white/60 text-[13px] font-medium leading-relaxed max-w-[280px] mb-6">
						{t('airdrop.friends.subtitle') || 'Invite friends to earn bonus coins and climb global leaderboards.'}
					</p>

					{/* Invite CTA Buttons */}
					<div class="w-full flex items-center gap-2">
						<button
							onClick={handleInvite}
							class="flex-1 h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white font-black text-[13px] uppercase tracking-widest rounded-[18px] active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(51,144,236,0.4)] border border-white/10"
						>
							<span>{t('airdrop.friends.inviteBtn') || 'INVITE A FREN'}</span>
							<span class="material-symbols-outlined text-[20px]">person_add</span>
						</button>
						<button
							onClick={handleCopy}
							class="w-14 h-14 bg-[#161b28] hover:bg-[#1f2638] text-white/90 font-bold rounded-[18px] active:scale-95 transition-all duration-300 flex items-center justify-center border border-white/10 shrink-0"
							title="Copy Referral Link"
						>
							<span class="material-symbols-outlined text-[22px]">
								{copied() ? 'check' : 'content_copy'}
							</span>
						</button>
					</div>

					{/* Live Unique Referral Link Box */}
					<div class="w-full mt-3 bg-[#12141C]/90 border border-[#3390ec]/30 rounded-[14px] p-2.5 flex items-center justify-between gap-2 shadow-inner">
						<span class="text-[12px] font-mono text-[#3390ec] truncate select-all px-1">
							{getReferralLink()}
						</span>
						<button
							onClick={handleCopy}
							class="text-[11px] font-bold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-[8px] transition-all shrink-0 flex items-center gap-1"
						>
							<span class="material-symbols-outlined text-[14px]">{copied() ? 'check' : 'content_copy'}</span>
							<span>{copied() ? 'Copied' : 'Copy'}</span>
						</button>
					</div>
				</div>

				{/* ═══════ FRENS LIST ═══════ */}
				<div class="flex flex-col">
					<div class="flex items-center justify-between mb-3 px-2">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-white/40 text-[18px]">diversity_3</span>
							<span class="text-[12px] font-mono font-black uppercase tracking-widest text-white/60">
								{t('airdrop.friends.yourReferrals') || 'Frens List'}
							</span>
						</div>
						<span class="text-[11px] font-mono font-bold text-[#3390ec] bg-[#3390ec]/10 px-2 py-0.5 rounded-[6px] border border-[#3390ec]/20" dir="ltr">
							Total: {frensCount()}
						</span>
					</div>

					<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] p-2 flex flex-col border border-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.3)] min-h-[200px]">
						<Show
							when={refInfo()?.friends && refInfo()!.friends.length > 0}
							fallback={
								<div class="flex flex-col items-center justify-center py-16 gap-3">
									<div class="w-16 h-16 rounded-[20px] bg-white/5 border border-dashed border-white/10 flex items-center justify-center mb-2">
										<span class="material-symbols-outlined text-white/20 text-[32px]">group_off</span>
									</div>
									<span class="text-white/40 text-[13px] font-medium">
										{t('airdrop.friends.noFriends') || "You haven't invited anyone yet."}
									</span>
								</div>
							}
						>
							<div class="flex flex-col gap-1.5">
								<For each={refInfo()?.friends}>
									{(friend, index) => {
										// Top 3 Gamification
										const isTop1 = index() === 0;
										const isTop2 = index() === 1;
										const isTop3 = index() === 2;
										const rank = index() + 1;

										return (
											<div class={`flex items-center justify-between p-3.5 rounded-[20px] transition-all duration-300 border 
												${isTop1 ? 'border-amber-400/30 bg-gradient-to-r from-amber-400/10 to-transparent hover:bg-amber-400/15' : 
												  isTop2 ? 'border-slate-300/20 bg-gradient-to-r from-slate-300/5 to-transparent hover:bg-slate-300/10' : 
												  isTop3 ? 'border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-transparent hover:bg-orange-500/10' : 
												  'bg-[#161b28]/40 border-white/5 hover:border-white/15 hover:bg-[#1a2133]'}`
											}>
												<div class="flex items-center gap-3.5 min-w-0 pr-2">
													
													{/* Rank Badge */}
													<div class={`w-8 h-8 rounded-[12px] flex items-center justify-center font-mono font-black text-[12px] shrink-0
														${isTop1 ? 'bg-amber-400 text-black shadow-[0_0_12px_rgba(251,191,36,0.4)]' : 
														  isTop2 ? 'bg-slate-300 text-black' : 
														  isTop3 ? 'bg-orange-400 text-black' : 'bg-white/5 text-white/40 border border-white/10'}`
													}>
														{rank < 10 ? `0${rank}` : rank}
													</div>

													{/* Avatar Component */}
													<div class={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 overflow-hidden text-[14px] font-black border shadow-inner transition-colors relative
														${isTop1 ? 'bg-amber-400/10 border-amber-400/30 text-amber-400' : 
														  isTop2 ? 'bg-slate-300/10 border-slate-300/30 text-slate-200' : 
														  isTop3 ? 'bg-orange-400/10 border-orange-400/30 text-orange-400' : 'bg-[#08090D] border-white/10 text-white/80'}`
													}>
														<span class="absolute">{friend.name.slice(0, 2).toUpperCase()}</span>
														<img loading="lazy" 															src={`/api/v1/profile/avatar/${friend.id}`}
															alt={friend.name}
															class="w-full h-full object-cover relative z-10"
															onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
														/>
													</div>

													{/* Info */}
													<div class="flex flex-col min-w-0 py-0.5">
														<span class="text-white font-bold text-[14px] truncate tracking-tight mb-0.5">
															{friend.name}
														</span>
														<div class="flex items-center gap-1.5 opacity-60">
															<span class="material-symbols-outlined text-[12px]">group</span>
															<span class="text-[11px] font-mono font-medium">
																{formatNumber(friend.frensCount || 0)} frens
															</span>
														</div>
													</div>
												</div>

												{/* Reward Coins */}
												<div class={`shrink-0 flex items-center gap-1.5 pl-2 font-mono font-black text-[13px] tabular-nums
													${isTop1 ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]' : 
													  isTop2 ? 'text-slate-200' : 
													  isTop3 ? 'text-orange-400' : 'text-amber-400/80'}`} 
													dir="ltr"
												>
													<span class="text-[15px]">🪙</span>
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
