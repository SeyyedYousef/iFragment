import { hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, Show, createEffect } from 'solid-js';
import { getTopClans, joinClan, leaveClan, getClanMembers } from '@/shared/api/profile.js';
import { setUserClan, userClan, currentLeague, LEAGUES } from '@/shared/store/airdrop.js';
import { t } from '@/shared/i18n/index.js';

export const ClanView: Component = () => {
	const [usernameInput, setUsernameInput] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	const [errorMsg, setErrorMsg] = createSignal('');
	const [topClans] = createResource(getTopClans);

	const clanId = () => userClan()?.id;
	const [clanMembers] = createResource(clanId, (id) => getClanMembers(id));


	// Automatically process deep link clan join on mount/render
	createEffect(() => {
		const pending = sessionStorage.getItem('pending_clan_join');
		if (pending) {
			sessionStorage.removeItem('pending_clan_join');
			handleJoin(pending);
		}
	});

	const triggerHaptic = (type: 'impact' | 'success' | 'error' | 'light') => {
		try {
			const tgHaptic = typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback;
			if (type === 'impact') {
				tgHaptic ? tgHaptic.impactOccurred('medium') : hapticFeedback.impactOccurred('medium');
			} else if (type === 'light') {
				tgHaptic ? tgHaptic.impactOccurred('light') : hapticFeedback.impactOccurred('light');
			} else {
				tgHaptic ? tgHaptic.notificationOccurred(type) : hapticFeedback.notificationOccurred(type);
			}
		} catch (_) {}
	};

	const formatScore = (score: number) => {
		if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`;
		if (score >= 1_000) return `${(score / 1_000).toFixed(0)}K`;
		return score.toString();
	};

	const handleJoin = async (username?: string) => {
		const target = username || usernameInput().trim();
		if (!target || loading()) return;
		setErrorMsg('');
		setLoading(true);
		try {
			triggerHaptic('impact');
			const clanDetails = await joinClan(target);
			setUserClan(clanDetails);
			setUsernameInput('');
		} catch (e: any) {
			setErrorMsg(e.message || 'Failed to join clan');
			triggerHaptic('error');
		} finally {
			setLoading(false);
		}
	};

	const handleLeave = async () => {
		if (loading()) return;
		setLoading(true);
		try {
			triggerHaptic('success');
			await leaveClan();
			setUserClan(null);
		} catch (e: any) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	const handleInvite = () => {
		triggerHaptic('light');
		const clan = userClan();
		if (!clan) return;
		const link = `https://t.me/iFragmentBot/iFragment?startapp=clan_${clan.channel_username}`;
		openTelegramLink(
			`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t('airdropFinal.clan.inviteText', { title: clan.chat_title }))}`,
		);
	};

	return (
		<div 
			class="flex-1 overflow-y-auto no-scrollbar animate-fade-in pb-36 relative" 
			style={{ background: '#000' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			<Show
				when={userClan()}
				fallback={
					/* === NOT IN A CLAN === */
					<div class="px-5 pt-14 relative z-10 min-h-full">
						{/* Ambient Mild Glow */}
						<div
							class="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none transition-colors duration-500 z-[-1]"
							style={{
								background: `radial-gradient(circle, ${currentLeague().color}10 0%, transparent 60%)`,
								filter: 'blur(50px)',
								transform: 'translate(30%, -30%)'
							}}
						></div>

						{/* Header */}
						<h1 class="text-[28px] font-bold text-white tracking-tight">{t('airdropFinal.clan.title')}</h1>
						<p class="text-[#8e8e93] text-[15px] mt-1">{t('airdropFinal.clan.subtitle')}</p>

						{/* How it works */}
						<button class="w-full mt-4 bg-[#1c1c1e] rounded-2xl p-4 flex items-center justify-between active:bg-white/5 transition-all">
							<div class="flex items-center gap-3">
								<span class="text-2xl">💡</span>
								<div class="text-start">
									<div class="text-white font-medium text-[15px]">{t('airdropFinal.clan.howItWorks')}</div>
									<div class="text-[#8e8e93] text-[13px]">{t('airdropFinal.clan.howItWorksDesc')}</div>
								</div>
							</div>
							<span class="material-symbols-outlined text-white/40 text-[20px]">chevron_right</span>
						</button>

						{/* Search to Join */}
						<div class="mt-5 bg-[#1c1c1e] rounded-2xl p-4">
							<h3 class="text-white font-semibold text-[17px] mb-3">{t('airdropFinal.clan.joinTitle')}</h3>
							<p class="text-[#8e8e93] text-[13px] mb-3">{t('airdropFinal.clan.joinDesc')}</p>
							<div class="flex gap-2">
								<input
									type="text"
									value={usernameInput()}
									onInput={(e) => setUsernameInput(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
									class={`flex-1 bg-[#2c2c2e] text-white font-medium text-[15px] py-3 px-4 rounded-xl border border-white/5 focus:border-[#3390ec]/40 focus:outline-none placeholder:text-[#555]`}
								/>
								<button
									onClick={() => handleJoin()}
									disabled={loading() || !usernameInput().trim()}
									class={`px-5 py-3 rounded-xl font-bold text-[14px] transition-all shrink-0 ${
										usernameInput().trim() && !loading()
											? 'bg-[#3390ec] text-white active:scale-95'
											: 'bg-[#2c2c2e] text-[#555]'
									}`}
								>
									{loading() ? '...' : t('airdropFinal.clan.joinBtn')}
								</button>
							</div>
							{errorMsg() && (
								<div class="text-red-500 text-[13px] font-medium mt-2.5 px-1">{errorMsg()}</div>
							)}
						</div>

						{/* Popular Squads */}
						<div class="mt-6">
							<h2 class="text-[20px] font-bold text-white mb-3 tracking-tight">{t('airdropFinal.clan.popularSquads')}</h2>
							<div class="bg-[#1c1c1e] rounded-[24px] overflow-hidden">
								<Show
									when={!topClans.loading}
									fallback={
										<div class="flex items-center justify-center py-10">
											<div class="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
										</div>
									}
								>
									<Show 
										when={!topClans.error}
										fallback={
											<div class="text-red-400 text-[14px] text-center py-8">
												{t('airdropFinal.clan.loadError', { defaultValue: 'Failed to load popular squads.' })}
											</div>
										}
									>
										<For
											each={topClans() || []}
											fallback={
												<div class="text-[#8e8e93] text-[14px] text-center py-8">{t('airdropFinal.clan.noSquads')}</div>
											}
										>
											{(clan, i) => (
												<button
													onClick={() => handleJoin(clan.channel_username)}
													disabled={loading()}
													class={`w-full flex items-center p-4 transition-all active:bg-white/5 text-start ${
														i() !== 0 ? 'border-t border-white/5' : ''
													}`}
												>
													{/* Rank */}
													<div
														class={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0 mr-3 ${
															i() === 0
																? 'bg-amber-400 text-black'
																: i() === 1
																	? 'bg-gray-300 text-black'
																	: i() === 2
																		? 'bg-[#cd7f32] text-white'
																		: 'bg-[#2c2c2e] text-[#8e8e93]'
														}`}
													>
														{i() + 1}
													</div>

													{/* Photo */}
													{clan.channel_photo ? (
														<img
															src={clan.channel_photo}
															alt={clan.chat_title}
															class="w-12 h-12 rounded-2xl object-cover border border-white/10 shrink-0 mr-3"
														/>
													) : (
														<div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 mr-3 text-xl">
															🛡️
														</div>
													)}

													{/* Info */}
													<div class="flex-1 min-w-0">
														<div class="text-white font-medium text-[16px] truncate">{clan.chat_title}</div>
														<div class="text-[#8e8e93] text-[13px] mt-0.5">
															{clan.members_count.toLocaleString('en-US')} {t('airdropFinal.clan.members')}
														</div>
													</div>

													{/* Score */}
													<div class="shrink-0 ms-2 text-end">
														<div class="flex items-center gap-1">
															<span
																class="material-symbols-outlined text-amber-400 text-[14px]"
																style={{ 'font-variation-settings': '"FILL" 1' }}
															>
																monetization_on
															</span>
															<span class="text-amber-400 font-bold text-[14px]">
																{formatScore(clan.total_score || clan.members_count * 1500)}
															</span>
														</div>
													</div>
												</button>
											)}
										</For>
									</Show>
								</Show>
							</div>
						</div>
					</div>
				}
			>
				{/* === IN A CLAN === */}
				{(clan) => {
					const getClanLeague = () => {
						const score = clan().total_score || clan().members_count * 1500;
						let l = LEAGUES[0];
						for (const league of LEAGUES) {
							if (score >= league.minScore) l = league;
						}
						return l.name;
					};

					const currentLeagueName = getClanLeague(); 
					const currentRank = clan().members_count > 100 ? 'Top 100' : 'Unranked';

					return (
						<div class="min-h-full flex flex-col relative w-full" style={{
							background: 'linear-gradient(180deg, #c77b28 0%, #a25c1a 30%, #1a1a1a 60%, #000000 100%)'
						}}>
							<div class="relative z-10 flex flex-col items-center pt-14 px-4 w-full max-w-md mx-auto">
								{/* Top Icon Box */}
								<div class="w-[100px] h-[100px] bg-black rounded-[32px] flex items-center justify-center mb-6 shadow-xl relative overflow-hidden shrink-0">
									{clan().channel_photo ? (
										<img src={clan().channel_photo} alt={clan().chat_title} class="w-full h-full object-cover" />
									) : (
										<svg viewBox="0 0 100 100" class="w-[50%] h-[50%]">
											<path d="M 50 15 L 15 80 L 85 80 Z" fill="none" stroke="white" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>
											<path d="M 50 15 L 50 80" fill="none" stroke="white" stroke-width="12" stroke-linecap="round"/>
										</svg>
									)}
								</div>

								{/* Clan Title & Link */}
								<button 
									onClick={() => openTelegramLink(`https://t.me/${clan().channel_username}`)}
									class="flex items-center justify-center gap-1.5 text-white font-black text-[28px] tracking-tight active:scale-95 transition-transform"
								>
									{clan().chat_title}
									<span class="material-symbols-outlined text-[20px] text-white/50 mb-1">open_in_new</span>
								</button>

								{/* Rank & League */}
								<button class="flex items-center gap-1.5 mt-2 active:scale-95 transition-transform">
									<div class="flex items-center gap-1">
										<span class="text-white/40 text-[16px] font-light">{'{'}</span>
										<span class="text-white/90 font-bold text-[14px]">{currentRank}</span>
										<span class="text-white/40 text-[16px] font-light">{'}'}</span>
									</div>
									<span class="text-white/30 text-[14px] mx-1">•</span>
									<span class="text-[14px]">🏆</span>
									<span class="text-amber-400 font-bold text-[14px] flex items-center gap-0.5">
										{currentLeagueName}
										<span class="material-symbols-outlined text-[16px] text-white/40">chevron_right</span>
									</span>
								</button>

								{/* How it works */}
								<button class="mt-6 text-white font-bold text-[15px] active:opacity-70 transition-opacity">
									{t('airdropFinal.clan.howItWorks')}
								</button>

								{/* Description Text */}
								<p class="text-center text-white/90 font-medium text-[14px] mt-4 max-w-[320px] leading-relaxed">
									{t('airdropFinal.clan.howItWorksDesc')}
								</p>

								{/* Action Card */}
								<div class="w-full bg-[#1c1c1e]/90 backdrop-blur-md rounded-[28px] mt-6 p-5 flex flex-col gap-4 border border-white/5 shadow-2xl">
									{/* Score & Invite Stats */}
									<div class="w-full flex justify-between items-start mb-2 px-1">
										<div class="flex flex-col items-start">
											<div class="flex items-center gap-1.5">
												<span class="text-[#ffcc00] text-[20px]">🟡</span>
												<span class="text-white font-bold text-[24px] tracking-tight">
													{(clan().total_score || clan().members_count * 1500).toLocaleString('en-US')}
												</span>
											</div>
											<span class="text-[#8e8e93] text-[13px] ml-7 font-medium">{t('airdropFinal.clan.totalScore', { defaultValue: 'Total score' })}</span>
										</div>
										
										<div class="flex flex-col items-end">
											<span class="text-white font-bold text-[17px]">{t('airdropFinal.clan.inviteToSquad', { defaultValue: 'Invite to squad' })}</span>
											<span class="text-[#8e8e93] text-[13px] font-medium">{t('airdropFinal.clan.getMoreCoins', { defaultValue: 'Get more Notcoin' })}</span>
										</div>
									</div>

									{/* Action Buttons */}
									<button
										onClick={handleInvite}
										class="w-full bg-[#007aff] text-white font-bold py-4 rounded-[18px] active:scale-[0.98] transition-transform text-[17px] mt-2"
									>
										{t('airdropFinal.friends.inviteBtn')}
									</button>
									<button
										onClick={handleLeave}
										disabled={loading()}
										class="w-full bg-[#2c2c2e] text-white/90 font-bold py-4 rounded-[18px] active:scale-[0.98] transition-transform text-[17px]"
									>
										{loading() ? '...' : t('airdropFinal.clan.leaveClan', { defaultValue: 'Leave squad' })}
									</button>
								</div>

								{/* Clan Members Leaderboard */}
								<div class="w-full mt-6 flex flex-col pb-32">
									<h3 class="text-white font-bold text-[18px] mb-3 px-1">
										{(t as any)('airdropFinal.clan.membersLeaderboard', { defaultValue: 'Squad Members' })}
									</h3>
									
									<div class="bg-[#1c1c1e]/50 rounded-2xl overflow-hidden border border-white/5">
										<Show
											when={!clanMembers.loading}
											fallback={
												<div class="flex items-center justify-center py-6">
													<div class="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
												</div>
											}
										>
											<For
												each={clanMembers() || []}
												fallback={
													<div class="text-[#8e8e93] text-[13px] text-center py-6">
														{(t as any)('airdropFinal.clan.noMembers', { defaultValue: 'No members found.' })}
													</div>
												}
											>
												{(member, index) => (
													<div class={`w-full p-3.5 flex items-center justify-between transition-colors ${
														index() !== 0 ? 'border-t border-white/5' : ''
													}`}>
														<div class="flex items-center gap-3 min-w-0">
															<div class={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[12px] shrink-0 ${
																index() === 0
																	? 'bg-amber-400 text-black'
																	: index() === 1
																		? 'bg-gray-300 text-black'
																		: index() === 2
																			? 'bg-[#cd7f32] text-white'
																			: 'text-[#8e8e93]'
															}`}>
																{index() + 1}
															</div>
															
															<div class="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-sm font-bold text-white overflow-hidden border border-white/10 shrink-0">
																{member.first_name.slice(0, 2).toUpperCase()}
															</div>
															
															<div class="flex flex-col min-w-0">
																<span class="text-white font-bold text-[15px] truncate">
																	{member.first_name} {member.last_name || ''}
																</span>
																<span class="text-white/50 text-[12px] mt-0.5">
																	Level {member.level}
																</span>
															</div>
														</div>
														
														<div class="shrink-0 text-end">
															<div class="flex items-center gap-1 justify-end">
																<span class="text-[#ffcc00] text-[12px]">🟡</span>
																<span class="text-white font-bold text-[14px]">
																	{member.score.toLocaleString('en-US')}
																</span>
															</div>
														</div>
													</div>
												)}
											</For>
										</Show>
									</div>
								</div>
							</div>
						</div>
					);
				}}
			</Show>
		</div>
	);
};
