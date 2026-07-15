import { hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, Show, createEffect } from 'solid-js';
import { getTopClans, joinClan, leaveClan, getClanMembers } from '@/shared/api/profile.js';
import { setUserClan, userClan, currentLeague, CLAN_LEAGUES } from '@/shared/store/airdrop.js';
import { t } from '@/shared/i18n/index.js';
import { API_CONFIG } from '@/shared/api/config.js';

export const ClanView: Component = () => {
	const [usernameInput, setUsernameInput] = createSignal('');
	const [showSearch, setShowSearch] = createSignal(false);
	const [loading, setLoading] = createSignal(false);
	const [errorMsg, setErrorMsg] = createSignal('');
	const [topClans] = createResource(getTopClans);

	const clanId = () => userClan()?.id;
	const [clanMembers] = createResource(clanId, (id) => getClanMembers(id));
	const [activeTab, setActiveTab] = createSignal<'day' | 'week'>('day');

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
			setShowSearch(false);
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
					/* === NOT IN A CLAN (Join Squad View) === */
					<div class="px-4 pt-10 relative z-10 min-h-full flex flex-col items-center">
						<div
							class="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none transition-colors duration-500 z-[-1]"
							style={{
								background: `radial-gradient(circle, ${currentLeague().color}10 0%, transparent 60%)`,
								filter: 'blur(50px)',
								transform: 'translate(30%, -30%)'
							}}
						></div>

						{/* Disco ball graphic */}
						<div class="w-32 h-32 mb-2 flex items-center justify-center drop-shadow-[0_0_40px_rgba(255,255,255,0.4)] relative">
							<span class="text-[100px] leading-none z-10">🪩</span>
							<div class="absolute inset-0 bg-white/10 blur-[40px] rounded-full z-0"></div>
						</div>

						<h1 class="text-[32px] font-bold text-white tracking-tight mb-2">
							{t('airdropFinal.clan.joinSquadTitle', { defaultValue: 'Join Squad!' })}
						</h1>
						<p class="text-[#8e8e93] text-[15px] text-center mb-6 max-w-[280px] leading-snug">
							{t('airdropFinal.clan.joinSquadDesc', { defaultValue: 'These squads recruiting now.\nDo you wanna join?' })}
						</p>

						<button 
							onClick={() => setShowSearch(!showSearch())}
							class="w-full bg-gradient-to-r from-amber-400 to-orange-400 text-black font-bold py-4 rounded-2xl active:scale-95 transition-transform text-[17px] mb-4 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
						>
							{t('airdropFinal.clan.joinAnother', { defaultValue: 'Join another squad' })}
						</button>

						{/* Search to Join (Animated dropdown) */}
						<Show when={showSearch()}>
							<div class="w-full bg-[#1c1c1e] rounded-2xl p-4 mb-4 animate-slide-down border border-white/5">
								<div class="flex gap-2">
									<input
										type="text"
										placeholder={t('airdropFinal.clan.searchPlaceholder', { defaultValue: 'Squad username...' })}
										value={usernameInput()}
										onInput={(e) => setUsernameInput(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
										class="flex-1 bg-[#2c2c2e] text-white font-medium text-[15px] py-3 px-4 rounded-xl border border-white/5 focus:border-[#3390ec]/40 focus:outline-none placeholder:text-[#555]"
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
										{loading() ? '...' : t('airdropFinal.clan.joinBtn', { defaultValue: 'Join' })}
									</button>
								</div>
								{errorMsg() && (
									<div class="text-red-500 text-[13px] font-medium mt-2.5 px-1">{errorMsg()}</div>
								)}
							</div>
						</Show>

						{/* Popular Squads List */}
						<div class="w-full bg-[#141415] rounded-[24px] overflow-hidden border border-white/5 mt-2">
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
										{(clan, i) => {
											const score = clan.total_score || clan.members_count * 1500;
											let l = CLAN_LEAGUES[0];
											for (const league of CLAN_LEAGUES) {
												if (score >= league.minScore) l = league;
											}
											return (
												<button
													onClick={() => handleJoin(clan.channel_username)}
													disabled={loading()}
													class={`w-full flex items-center p-4 transition-all active:bg-white/5 text-start ${
														i() !== 0 ? 'border-t border-white/5' : ''
													}`}
												>
													{/* Photo */}
													<div class="w-12 h-12 rounded-2xl bg-[#1c1c1e] p-1 flex items-center justify-center shrink-0 mr-4">
														{clan.channel_photo ? (
															<img
																src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`}
																alt={clan.chat_title}
																class="w-full h-full rounded-xl object-cover"
															/>
														) : (
															<div class="w-full h-full rounded-xl bg-white/5 flex items-center justify-center text-xl">
																🛡️
															</div>
														)}
													</div>

													{/* Info */}
													<div class="flex-1 min-w-0">
														<div class="text-white font-bold text-[16px] truncate tracking-tight">{clan.chat_title}</div>
														<div class="flex items-center gap-1 mt-0.5">
															<span class="text-[14px]">🏆</span>
															<span class="text-[#8e8e93] text-[13px] font-medium">{l.name}</span>
														</div>
													</div>

													{/* Arrow */}
													<span class="material-symbols-outlined text-[#8e8e93]/50 ml-2">chevron_right</span>
												</button>
											);
										}}
									</For>
								</Show>
							</Show>
						</div>
					</div>
				}
			>
				{/* === IN A CLAN (Squad Details View) === */}
				{(clan) => {
					const getClanLeague = () => {
						const score = clan().total_score || clan().members_count * 1500;
						let l = CLAN_LEAGUES[0];
						for (const league of CLAN_LEAGUES) {
							if (score >= league.minScore) l = league;
						}
						return l;
					};

					const currentLeagueName = getClanLeague().name; 

					const soccerMessage = clan().members_count >= 11 
						? t('airdropFinal.clan.soccerSuccess', { defaultValue: "Congratulations! You now have enough squad members to form a soccer team ⚽ 👏" })
						: t('airdropFinal.clan.soccerInvite', { defaultValue: "Invite more frens to form a complete team! 🏃‍♂️💨" });

					return (
						<div class="min-h-full flex flex-col relative w-full pb-10" style={{
							background: 'linear-gradient(180deg, #1c263b 0%, #0c121e 100%)'
						}}>
							{/* Background glow effect for Avatar */}
							<div class="absolute top-10 left-1/2 -translate-x-1/2 w-[200px] h-[200px] bg-white/10 blur-[80px] rounded-full pointer-events-none z-0"></div>

							<div class="relative z-10 flex flex-col items-center pt-10 px-4 w-full mx-auto">
								{/* Top Icon Box */}
								<div class="w-24 h-24 bg-[#4ade80] rounded-[28px] p-1.5 flex items-center justify-center mb-4 shadow-xl shrink-0">
									<div class="w-full h-full bg-white rounded-[22px] flex items-center justify-center overflow-hidden">
										{clan().channel_photo ? (
											<img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`} alt={clan().chat_title} class="w-full h-full object-cover" />
										) : (
											<span class="text-[40px]">☕</span>
										)}
									</div>
								</div>

								{/* Clan Title & Link */}
								<button 
									onClick={() => openTelegramLink(`https://t.me/${clan().channel_username}`)}
									class="flex items-center justify-center gap-2 text-white font-bold text-[28px] tracking-tight active:scale-95 transition-transform"
								>
									{clan().chat_title}
									<span class="material-symbols-outlined text-[20px] text-white/50 mb-1">open_in_new</span>
								</button>

								{/* League */}
								<button class="flex items-center gap-1.5 mt-1 active:scale-95 transition-transform">
									<span class="text-[18px]">🏆</span>
									<span class="text-[#8e8e93] font-medium text-[15px]">{currentLeagueName}</span>
									<span class="material-symbols-outlined text-[18px] text-[#8e8e93]">chevron_right</span>
								</button>

								{/* How it works */}
								<button class="mt-4 text-white/80 font-medium text-[14px] underline underline-offset-4 decoration-white/30 active:opacity-70 transition-opacity">
									{t('airdropFinal.clan.howItWorks', { defaultValue: 'How it works?' })}
								</button>

								{/* Description Text */}
								<p class="text-center text-white/90 font-medium text-[14px] mt-5 max-w-[320px] leading-relaxed">
									{soccerMessage}
								</p>

								{/* Action Card */}
								<div class="w-full bg-[#1c1c1e] rounded-[28px] mt-6 flex flex-col shadow-2xl border border-white/5">
									{/* Top stats */}
									<div class="flex justify-between items-center px-6 py-5 border-b border-white/5">
										<div class="flex items-center gap-3">
											<div class="w-7 h-7 rounded-full bg-gradient-to-br from-[#ffcd00] to-[#ff9500] flex items-center justify-center border border-[#ffe885] shrink-0">
												<span class="text-black text-[14px] font-black leading-none mt-0.5">¢</span>
											</div>
											<div class="flex flex-col items-start">
												<span class="text-white font-bold text-[20px] leading-tight">
													{formatScore(clan().total_score || clan().members_count * 1500)}
												</span>
												<span class="text-[#8e8e93] text-[13px] font-medium">
													{t('airdropFinal.clan.minedInSquad', { defaultValue: 'mined in squad' })}
												</span>
											</div>
										</div>
										<div class="flex flex-col items-end">
											<span class="text-white font-bold text-[20px] leading-tight">{clan().members_count}</span>
											<span class="text-[#8e8e93] text-[13px] font-medium">
												{t('airdropFinal.clan.players', { defaultValue: 'players' })}
											</span>
										</div>
									</div>

									{/* Action Buttons */}
									<div class="p-4 flex flex-col gap-3">
										<button
											onClick={handleInvite}
											class="w-full bg-[#3390ec] text-white font-bold py-4 rounded-[18px] active:scale-[0.98] transition-transform text-[16px]"
										>
											{t('airdropFinal.clan.invite', { defaultValue: 'Invite a fren' })}
										</button>
										<div class="flex gap-3">
											<button
												onClick={handleLeave}
												disabled={loading()}
												class="flex-1 bg-[#2c2c2e] text-white/90 font-bold py-3.5 rounded-[16px] active:scale-[0.98] transition-transform text-[15px]"
											>
												{loading() ? '...' : t('airdropFinal.clan.leave', { defaultValue: 'Leave squad' })}
											</button>
											<button class="flex-1 bg-[#2c2c2e] text-white/90 font-bold py-3.5 rounded-[16px] active:scale-[0.98] transition-transform text-[15px]">
												{t('airdropFinal.clan.boost', { defaultValue: 'Boost' })}
											</button>
										</div>
									</div>
								</div>

								{/* Tabs */}
								<div class="w-full flex mt-6 bg-[#141415] rounded-2xl p-1 mb-4 border border-white/5">
									<button 
										onClick={() => setActiveTab('day')}
										class={`flex-1 py-2 font-medium text-[14px] transition-all rounded-xl ${activeTab() === 'day' ? 'bg-[#2c2c2e] text-white shadow-sm' : 'text-[#8e8e93]'}`}
									>
										{t('airdropFinal.leaderboard.day', { defaultValue: 'Day' })}
									</button>
									<button 
										onClick={() => setActiveTab('week')}
										class={`flex-1 py-2 font-medium text-[14px] transition-all rounded-xl ${activeTab() === 'week' ? 'bg-[#2c2c2e] text-white shadow-sm' : 'text-[#8e8e93]'}`}
									>
										{t('airdropFinal.leaderboard.week', { defaultValue: 'Week' })}
									</button>
								</div>

								{/* Clan Members List */}
								<div class="w-full flex flex-col">
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
												<div class="w-full py-3 flex items-center justify-between">
													<div class="flex items-center gap-3 min-w-0">
														<div class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[13px] text-[#8e8e93] shrink-0">
															{index() + 1}
														</div>
														
														<div class="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-sm font-bold text-white overflow-hidden shrink-0">
															{member.first_name.slice(0, 2).toUpperCase()}
														</div>
														
														<div class="flex flex-col min-w-0">
															<span class="text-white font-medium text-[16px] truncate">
																{member.first_name} {member.last_name || ''}
															</span>
														</div>
													</div>
													
													<div class="shrink-0 text-end pl-2">
														<span class="text-white font-medium text-[15px]">
															{formatScore(member.score)}
														</span>
													</div>
												</div>
											)}
										</For>
									</Show>
								</div>
							</div>
						</div>
					);
				}}
			</Show>
		</div>
	);
};
