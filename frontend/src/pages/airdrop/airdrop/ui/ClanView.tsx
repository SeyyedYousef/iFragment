import { hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, Show, createEffect } from 'solid-js';
import { getTopClans, joinClan, leaveClan, getClanMembers } from '@/shared/api/profile.js';
import { setUserClan, userClan, CLAN_LEAGUES } from '@/shared/store/airdrop.js';
import { t } from '@/shared/i18n/index.js';
import { API_CONFIG } from '@/shared/api/config.js';

export const ClanView: Component<{ onOpenLeaderboard?: () => void }> = (props) => {
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
		return score.toLocaleString('en-US');
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

	const getRankBadgeStyle = (index: number) => {
		if (index === 0) return { bg: 'bg-[#2a220c] text-[#f59e0b] border-[#523e14]', label: '01' };
		if (index === 1) return { bg: 'bg-[#1a202c] text-[#cbd5e1] border-[#334155]', label: '02' };
		if (index === 2) return { bg: 'bg-[#271911] text-[#d97706] border-[#452715]', label: '03' };
		return { bg: 'bg-[#111622] text-[#64748b] border-[#1e293b]', label: index < 9 ? `0${index + 1}` : `${index + 1}` };
	};

	return (
		<div
			class="flex-1 overflow-y-auto no-scrollbar pb-36 relative select-none font-sans"
			style={{ background: '#090b10', color: '#f8fafc' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Fragment subtle grid background accent */}
			<div 
				class="absolute inset-0 pointer-events-none opacity-[0.03]"
				style={{
					'background-image': `radial-gradient(#ffffff 1px, transparent 1px)`,
					'background-size': '24px 24px'
				}}
			/>

			<Show
				when={userClan()}
				fallback={
					/* ═══════ NOT IN A CLAN — Fragment Telegram Style Join Squad View ═══════ */
					<div class="px-5 pt-8 relative z-10 min-h-full flex flex-col items-center max-w-md mx-auto">
						{/* Subtle top ambient glow */}
						<div
							class="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-36 rounded-full pointer-events-none opacity-20 blur-3xl"
							style={{ background: '#00f0ff' }}
						/>

						{/* Emblem Shield */}
						<div class="relative mb-6">
							<div
								class="w-24 h-24 rounded-2xl flex items-center justify-center border border-[#00f0ff]/30 shadow-[0_0_30px_rgba(0,240,255,0.12)] relative z-10"
								style={{ background: 'linear-gradient(180deg, #131b29 0%, #0c111a 100%)' }}
							>
								<span class="material-symbols-outlined text-[44px] text-[#00f0ff]">shield</span>
							</div>
							<div class="absolute -inset-1 rounded-2xl bg-[#00f0ff]/10 blur-md pointer-events-none" />
						</div>

						<h1 class="text-2xl font-bold tracking-tight text-white mb-2 text-center">
							{t('airdropFinal.clan.joinSquadTitle', { defaultValue: 'Join Squad' })}
						</h1>
						<p class="text-[#8b94a5] text-sm text-center mb-6 max-w-xs leading-relaxed">
							{t('airdropFinal.clan.joinSquadDesc', { defaultValue: 'Squads aggregate mining power and compete for exclusive league allocations.' })}
						</p>

						{/* Search Trigger Button */}
						<button
							onClick={() => setShowSearch(!showSearch())}
							class="w-full py-3.5 px-5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border border-[#00f0ff]/40 text-black active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(0,240,255,0.2)]"
							style={{ background: 'linear-gradient(135deg, #00f0ff 0%, #00b8ff 100%)' }}
						>
							<span class="material-symbols-outlined text-lg">search</span>
							{t('airdropFinal.clan.joinAnother', { defaultValue: 'Search or Join Squad' })}
						</button>

						{/* Search Form Drawer */}
						<Show when={showSearch()}>
							<div class="w-full bg-[#111622] rounded-2xl p-4 my-4 border border-[#1e293b] shadow-xl">
								<div class="flex gap-2">
									<input
										type="text"
										placeholder={t('airdropFinal.clan.searchPlaceholder', { defaultValue: 'Enter squad @username...' })}
										value={usernameInput()}
										onInput={(e) => setUsernameInput(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
										class="flex-1 bg-[#090b10] text-white font-medium text-sm py-3 px-4 rounded-xl border border-[#1e293b] focus:border-[#00f0ff]/50 focus:outline-none placeholder:text-[#475569] transition-colors"
									/>
									<button
										onClick={() => handleJoin()}
										disabled={loading() || !usernameInput().trim()}
										class="px-5 py-3 rounded-xl font-semibold text-xs transition-all shrink-0 active:scale-95 flex items-center justify-center min-w-[70px]"
										style={usernameInput().trim() && !loading() ? {
											background: '#00f0ff',
											color: '#090b10',
										} : {
											background: '#1e293b',
											color: '#475569',
										}}
									>
										{loading() ? (
											<div class="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
										) : (
											t('airdropFinal.clan.joinBtn', { defaultValue: 'Join' })
										)}
									</button>
								</div>
								{errorMsg() && (
									<div class="text-rose-400 text-xs font-medium mt-2 px-1 flex items-center gap-1">
										<span class="material-symbols-outlined text-sm">error</span>
										{errorMsg()}
									</div>
								)}
							</div>
						</Show>

						{/* Popular Squads Header */}
						<div class="w-full flex items-center justify-between mt-8 mb-3 px-1">
							<span class="text-xs font-semibold tracking-wider uppercase text-[#64748b]">
								Featured Squads
							</span>
							<span class="text-xs text-[#334155] font-mono">LIVE RANKING</span>
						</div>

						{/* Popular Squads List */}
						<div class="w-full flex flex-col gap-2.5">
							<Show
								when={!topClans.loading}
								fallback={
									<div class="flex items-center justify-center py-12">
										<div class="w-6 h-6 border-2 border-[#1e293b] border-t-[#00f0ff] rounded-full animate-spin" />
									</div>
								}
							>
								<Show
									when={!topClans.error}
									fallback={
										<div class="text-rose-400 text-xs text-center py-8 font-medium">
											{t('airdropFinal.clan.loadError', { defaultValue: 'Failed to load popular squads.' })}
										</div>
									}
								>
									<For
										each={topClans() || []}
										fallback={
											<div class="text-[#475569] text-xs text-center py-8 font-medium">{t('airdropFinal.clan.noSquads')}</div>
										}
									>
										{(clan) => {
											const score = clan.total_score || clan.members_count * 1500;
											let l = CLAN_LEAGUES[0];
											for (const league of CLAN_LEAGUES) {
												if (score >= league.minScore) l = league;
											}
											return (
												<button
													onClick={() => handleJoin(clan.channel_username)}
													disabled={loading()}
													class="w-full flex items-center p-3.5 transition-all duration-200 active:scale-[0.98] rounded-xl border border-[#1e293b] bg-[#111622] hover:bg-[#161d2d] text-start group"
												>
													{/* Photo */}
													<div class="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 mr-3.5 overflow-hidden border border-[#1e293b] bg-[#090b10]">
														{clan.channel_photo ? (
															<img
																src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`}
																alt={clan.chat_title}
																class="w-full h-full object-cover"
															/>
														) : (
															<span class="material-symbols-outlined text-xl text-[#00f0ff]">groups</span>
														)}
													</div>

													{/* Info */}
													<div class="flex-1 min-w-0">
														<div class="text-white font-semibold text-sm truncate tracking-tight group-hover:text-[#00f0ff] transition-colors">
															{clan.chat_title}
														</div>
														<div class="flex items-center gap-2 mt-0.5">
															<span class="text-[#64748b] text-xs font-mono">
																{formatScore(score)} XP
															</span>
															<span class="text-[#334155]">•</span>
															<span class="text-xs font-medium" style={{ color: l.color }}>
																{l.name}
															</span>
														</div>
													</div>

													{/* Join Action */}
													<div class="px-3 py-1.5 rounded-lg bg-[#1e293b] group-hover:bg-[#00f0ff] group-hover:text-black text-white text-xs font-semibold transition-all">
														Join
													</div>
												</button>
											);
										}}
									</For>
								</Show>
							</Show>
						</div>

						{/* Open Leaderboard Footer CTA */}
						<div class="w-full mt-6">
							<button
								onClick={() => props.onOpenLeaderboard?.()}
								class="w-full py-3 rounded-xl border border-[#1e293b] bg-[#111622] hover:bg-[#161d2d] text-xs font-semibold text-[#8b94a5] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
							>
								<span class="material-symbols-outlined text-sm text-[#00f0ff]">trophy</span>
								{t('gamification.leaderboard' as any, { defaultValue: 'View Global Leaderboard' })}
							</button>
						</div>
					</div>
				}
			>
				{/* ═══════ IN A CLAN — Fragment Elite Squad Dashboard ═══════ */}
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
						? t('airdropFinal.clan.soccerSuccess', { defaultValue: "Full squad unlocked! Ready for maximum league multipliers ⚡" })
						: t('airdropFinal.clan.soccerInvite', { defaultValue: "Recruit members to boost your squad mining speed 🏃‍♂️" });

					return (
						<div class="min-h-full flex flex-col relative w-full pb-10 max-w-md mx-auto px-4 pt-6">

							{/* Top Squad Card Header */}
							<div class="bg-[#111622] border border-[#1e293b] rounded-2xl p-5 flex flex-col items-center relative overflow-hidden shadow-xl">
								
								{/* Subtle top gradient line */}
								<div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff]/50 to-transparent" />

								{/* Squad Avatar */}
								<div class="w-20 h-20 rounded-2xl p-0.5 mb-3 border border-[#1e293b] bg-[#090b10] flex items-center justify-center shadow-inner relative">
									{clan().channel_photo ? (
										<img
											src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`}
											alt={clan().chat_title}
											class="w-full h-full rounded-[14px] object-cover"
										/>
									) : (
										<span class="material-symbols-outlined text-[36px] text-[#00f0ff]">shield_person</span>
									)}
								</div>

								{/* Squad Title */}
								<button
									onClick={() => openTelegramLink(`https://t.me/${clan().channel_username}`)}
									class="flex items-center justify-center gap-1.5 text-white font-bold text-xl tracking-tight hover:text-[#00f0ff] transition-colors"
								>
									{clan().chat_title}
									<span class="material-symbols-outlined text-sm text-[#64748b]">open_in_new</span>
								</button>

								{/* League Pill */}
								<div class="inline-flex items-center gap-1.5 mt-2 bg-[#090b10] border border-[#1e293b] rounded-full px-3 py-1 text-xs font-medium">
									<span class="material-symbols-outlined text-sm" style={{ color: getClanLeague().color }}>
										{getClanLeague().icon}
									</span>
									<span class="text-[#94a3b8]">{currentLeagueName} League</span>
								</div>

								<p class="text-center text-[#64748b] font-medium text-xs mt-3 max-w-xs leading-relaxed">
									{soccerMessage}
								</p>

								{/* Metrics Bar */}
								<div class="w-full grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-[#1e293b]">
									<div class="flex flex-col items-center p-3 rounded-xl bg-[#090b10] border border-[#1e293b]/60">
										<span class="text-[10px] uppercase font-mono tracking-wider text-[#64748b]">TOTAL XP MINED</span>
										<span class="text-white font-bold text-lg font-mono mt-0.5">
											{formatScore(clan().total_score || clan().members_count * 1500)}
										</span>
									</div>
									<div class="flex flex-col items-center p-3 rounded-xl bg-[#090b10] border border-[#1e293b]/60">
										<span class="text-[10px] uppercase font-mono tracking-wider text-[#64748b]">MEMBERS</span>
										<span class="text-white font-bold text-lg font-mono mt-0.5">
											{clan().members_count}
										</span>
									</div>
								</div>

								{/* Action Controls */}
								<div class="w-full flex flex-col gap-2.5 mt-4">
									<button
										onClick={handleInvite}
										class="w-full py-3.5 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-[0_4px_18px_rgba(0,240,255,0.18)]"
										style={{ background: 'linear-gradient(135deg, #00f0ff 0%, #00b8ff 100%)' }}
									>
										<span class="material-symbols-outlined text-base">person_add</span>
										{t('airdropFinal.clan.invite', { defaultValue: 'Invite Member' })}
									</button>
									
									<div class="flex gap-2.5">
										<button
											onClick={handleLeave}
											disabled={loading()}
											class="flex-1 py-2.5 rounded-xl bg-[#090b10] border border-[#1e293b] text-xs font-semibold text-[#8b94a5] hover:text-rose-400 hover:border-rose-500/30 transition-all active:scale-[0.98]"
										>
											{loading() ? '...' : t('airdropFinal.clan.leave', { defaultValue: 'Leave Squad' })}
										</button>
										<button
											onClick={() => props.onOpenLeaderboard?.()}
											class="flex-1 py-2.5 rounded-xl bg-[#090b10] border border-[#1e293b] text-xs font-semibold text-[#00f0ff] hover:bg-[#00f0ff]/10 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
										>
											<span class="material-symbols-outlined text-xs">leaderboard</span>
											Global Stats
										</button>
									</div>
								</div>
							</div>

							{/* Period Selector Tabs */}
							<div class="w-full flex justify-between items-center mt-6 mb-3 px-1">
								<span class="text-xs font-semibold uppercase tracking-wider text-[#64748b]">
									Squad Roster & Contribution
								</span>
								<div class="bg-[#111622] p-0.5 rounded-lg border border-[#1e293b] flex gap-1">
									<button
										onClick={() => setActiveTab('day')}
										class={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
											activeTab() === 'day'
												? 'bg-[#00f0ff] text-black font-semibold'
												: 'text-[#64748b] hover:text-white'
										}`}
									>
										Day
									</button>
									<button
										onClick={() => setActiveTab('week')}
										class={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
											activeTab() === 'week'
												? 'bg-[#00f0ff] text-black font-semibold'
												: 'text-[#64748b] hover:text-white'
										}`}
									>
										Week
									</button>
								</div>
							</div>

							{/* Members List */}
							<div class="w-full flex flex-col gap-2">
								<Show
									when={!clanMembers.loading}
									fallback={
										<div class="flex items-center justify-center py-8">
											<div class="w-6 h-6 border-2 border-[#1e293b] border-t-[#00f0ff] rounded-full animate-spin" />
										</div>
									}
								>
									<For
										each={clanMembers() || []}
										fallback={
											<div class="bg-[#111622] rounded-xl border border-[#1e293b] p-6 text-center text-[#475569] text-xs font-medium">
												No squad members active yet.
											</div>
										}
									>
										{(member, index) => {
											const badge = () => getRankBadgeStyle(index());
											return (
												<div class="w-full p-3 flex items-center justify-between rounded-xl bg-[#111622] border border-[#1e293b] hover:border-[#334155] transition-all">
													<div class="flex items-center gap-3 min-w-0">
														{/* Rank Badge */}
														<div class={`w-7 h-7 rounded-md flex items-center justify-center font-mono font-bold text-xs border shrink-0 ${badge().bg}`}>
															{badge().label}
														</div>

														{/* Avatar */}
														<div class="w-9 h-9 rounded-full bg-[#090b10] border border-[#1e293b] flex items-center justify-center text-xs font-semibold text-white shrink-0">
															{member.first_name.slice(0, 2).toUpperCase()}
														</div>

														{/* Name */}
														<div class="flex flex-col min-w-0">
															<span class="text-white font-semibold text-sm truncate">
																{member.first_name} {member.last_name || ''}
															</span>
														</div>
													</div>

													{/* Score */}
													<div class="shrink-0 font-mono text-xs font-semibold text-[#00f0ff] bg-[#090b10] px-2.5 py-1 rounded-md border border-[#1e293b]">
														{formatScore(member.score)} XP
													</div>
												</div>
											);
										}}
									</For>
								</Show>
							</div>
						</div>
					);
				}}
			</Show>
		</div>
	);
};
