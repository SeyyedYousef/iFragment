import { hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, Show, createEffect } from 'solid-js';
import { getTopClans, joinClan, leaveClan, getClanMembers } from '@/shared/api/profile.js';
import { setUserClan, userClan, currentLeague, CLAN_LEAGUES } from '@/shared/store/airdrop.js';
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

	const getRankBadge = (index: number) => {
		if (index === 0) return { bg: 'bg-amber-400/10 text-amber-400 border-amber-400/30', icon: '👑' };
		if (index === 1) return { bg: 'bg-slate-300/10 text-slate-300 border-slate-300/30', icon: '🥈' };
		if (index === 2) return { bg: 'bg-amber-700/10 text-amber-600 border-amber-600/30', icon: '🥉' };
		return { bg: 'bg-white/5 text-white/50 border-white/5', icon: null };
	};

	const getMemberRowStyle = (index: number) => {
		if (index === 0) return {
			background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.015))',
			'border-color': 'rgba(251,191,36,0.2)',
		};
		if (index === 1) return {
			background: 'linear-gradient(135deg, rgba(148,163,184,0.06), rgba(148,163,184,0.01))',
			'border-color': 'rgba(148,163,184,0.15)',
		};
		if (index === 2) return {
			background: 'linear-gradient(135deg, rgba(217,119,6,0.06), rgba(217,119,6,0.01))',
			'border-color': 'rgba(217,119,6,0.15)',
		};
		return {};
	};

	return (
		<div
			class="flex-1 overflow-y-auto no-scrollbar animate-fade-in pb-36 relative"
			style={{ background: 'linear-gradient(180deg, #0c0c0f 0%, #09090b 100%)' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Keyframes for clan animations */}
			<style>{`
				@keyframes nc-fadeInUp {
					from { opacity: 0; transform: translateY(14px); }
					to { opacity: 1; transform: translateY(0); }
				}
				@keyframes nc-glowRing {
					0%, 100% { opacity: 0.4; transform: scale(1); }
					50% { opacity: 0.8; transform: scale(1.04); }
				}
				@keyframes nc-heroFloat {
					0%, 100% { transform: translateY(0) scale(1); }
					50% { transform: translateY(-6px) scale(1.02); }
				}
				@keyframes nc-pulseGlow {
					0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.15); }
					50% { box-shadow: 0 0 35px rgba(245,158,11,0.3); }
				}
			`}</style>

			<Show
				when={userClan()}
				fallback={
					/* ═══════ NOT IN A CLAN — Join Clan View ═══════ */
					<div class="px-4 pt-10 relative z-10 min-h-full flex flex-col items-center">
						{/* Ambient glow */}
						<div
							class="absolute top-0 left-1/2 -translate-x-1/2 w-[350px] h-[350px] rounded-full pointer-events-none z-[-1]"
							style={{
								background: 'radial-gradient(circle, rgba(51,144,236,0.1) 0%, transparent 60%)',
								filter: 'blur(50px)',
							}}
						/>

						{/* Fragment Style Hero Icon */}
						<div class="w-20 h-20 rounded-3xl bg-[#11131a] border border-cyan-500/30 flex items-center justify-center mb-5 relative shadow-[0_0_30px_rgba(51,144,236,0.15)]">
							<span class="material-symbols-outlined text-cyan-400 text-[40px]">shield</span>
						</div>

						<h1 class="text-[26px] font-black text-white tracking-tight mb-2 text-center">
							{t('airdropFinal.clan.joinSquadTitle', { defaultValue: 'Official iFragment Clans' })}
						</h1>
						<p class="text-white/50 text-[13px] text-center mb-6 max-w-[280px] leading-relaxed font-medium">
							{t('airdropFinal.clan.joinSquadDesc', { defaultValue: 'Join an official community clan to pool rewards and compete on global leaderboards.' })}
						</p>

						{/* Join Button */}
						<button
							onClick={() => setShowSearch(!showSearch())}
							class="w-full h-13 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all hover:bg-white/90 shadow-xl mb-4"
						>
							<span class="material-symbols-outlined text-base">search</span>
							{t('airdropFinal.clan.joinAnother', { defaultValue: 'Search & Join Clan' })}
						</button>

						{/* Search to Join (Animated dropdown) */}
						<Show when={showSearch()}>
							<div class="w-full bg-white/[0.03] rounded-[18px] p-4 mb-4 mt-4 animate-fade-in border border-white/[0.07]"
								style={{ 'box-shadow': '0 4px 20px rgba(0,0,0,0.3)' }}
							>
								<div class="flex gap-2">
									<input
										type="text"
										placeholder={t('airdropFinal.clan.searchPlaceholder', { defaultValue: 'Squad username...' })}
										value={usernameInput()}
										onInput={(e) => setUsernameInput(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
										class="flex-1 bg-white/[0.05] text-white font-medium text-[14px] py-3 px-4 rounded-xl border border-white/[0.08] focus:border-amber-500/40 focus:outline-none placeholder:text-white/20 transition-colors"
									/>
									<button
										onClick={() => handleJoin()}
										disabled={loading() || !usernameInput().trim()}
										class="px-5 py-3 rounded-xl font-bold text-[13px] transition-all duration-200 shrink-0 active:scale-95"
										style={usernameInput().trim() && !loading() ? {
											background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
											color: '#000',
										} : {
											background: 'rgba(255,255,255,0.05)',
											color: 'rgba(255,255,255,0.25)',
										}}
									>
										{loading() ? '...' : t('airdropFinal.clan.joinBtn', { defaultValue: 'Join' })}
									</button>
								</div>
								{errorMsg() && (
									<div class="text-red-400 text-[13px] font-medium mt-2.5 px-1">{errorMsg()}</div>
								)}
							</div>
						</Show>

						{/* ── Popular Squads List ── */}
						<div class="w-full mt-4 flex flex-col gap-2">
							<Show
								when={!topClans.loading}
								fallback={
									<div class="flex items-center justify-center py-10">
										<div class="w-7 h-7 border-2 border-white/15 border-t-amber-400 rounded-full animate-spin" />
									</div>
								}
							>
								<Show
									when={!topClans.error}
									fallback={
										<div class="text-red-400 text-[13px] text-center py-8 font-medium">
											{t('airdropFinal.clan.loadError', { defaultValue: 'Failed to load popular squads.' })}
										</div>
									}
								>
									<For
										each={topClans() || []}
										fallback={
											<div class="text-white/30 text-[13px] text-center py-8 font-medium">{t('airdropFinal.clan.noSquads')}</div>
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
													class="w-full flex items-center p-3.5 transition-all duration-200 active:scale-[0.98] rounded-[16px] border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] text-start"
													style={{ animation: `nc-fadeInUp 400ms ease ${i() * 60}ms both` }}
												>
													{/* Photo */}
													<div
														class="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 mr-3.5 overflow-hidden"
														style={{
															background: 'rgba(255,255,255,0.04)',
															border: '1.5px solid rgba(255,255,255,0.08)',
															padding: '2px',
														}}
													>
														{clan.channel_photo ? (
															<img
																src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`}
																alt={clan.chat_title}
																class="w-full h-full rounded-[10px] object-cover"
															/>
														) : (
															<div class="w-full h-full rounded-[10px] bg-white/[0.04] flex items-center justify-center text-xl">
																🛡️
															</div>
														)}
													</div>

													{/* Info */}
													<div class="flex-1 min-w-0">
														<div class="text-white font-bold text-[15px] truncate tracking-tight">{clan.chat_title}</div>
														<div class="flex items-center gap-1.5 mt-0.5">
															<span
																class="material-symbols-outlined text-[14px]"
																style={{
																	color: l.color,
																	'font-variation-settings': '"FILL" 1',
																}}
															>{l.icon}</span>
															<span class="text-white/35 text-[12px] font-medium">{l.name}</span>
														</div>
													</div>

													{/* Arrow */}
													<span class="material-symbols-outlined text-white/20 ml-2 text-lg">chevron_right</span>
												</button>
											);
										}}
									</For>
								</Show>
							</Show>
						</div>

						{/* Open Leaderboard Button for Non-Clan Users */}
						<div class="w-full mt-5">
							<button
								onClick={() => props.onOpenLeaderboard?.()}
								class="w-full py-3.5 rounded-[14px] active:scale-[0.97] transition-all duration-200 text-[14px] flex items-center justify-center gap-2 font-bold"
								style={{
									background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))',
									border: '1px solid rgba(245,158,11,0.2)',
									color: '#f59e0b',
									'box-shadow': '0 0 20px rgba(245,158,11,0.08)',
								}}
							>
								<span class="text-[16px]">🏆</span>
								{t('gamification.leaderboard' as any, { defaultValue: 'View Global Leaderboard' })}
							</button>
						</div>
					</div>
				}
			>
				{/* ═══════ IN A CLAN — Squad Details View ═══════ */}
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

					const squadMessage = clan().members_count >= 10
						? t('airdropFinal.clan.soccerSuccess', { defaultValue: "Your clan is fully active! Keep mining together to dominate global leaderboards." })
						: t('airdropFinal.clan.soccerInvite', { defaultValue: "Invite more members to pool rewards and climb global clan rankings." });

					return (
						<div class="min-h-full flex flex-col relative w-full pb-10"
							style={{ background: 'linear-gradient(180deg, #0e1220 0%, #09090b 100%)' }}
						>
							{/* Background ambient glow */}
							<div
								class="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full pointer-events-none z-0"
								style={{
									background: `radial-gradient(circle, ${getClanLeague().color}15 0%, transparent 55%)`,
									filter: 'blur(60px)',
								}}
							/>

							<div class="relative z-10 flex flex-col items-center pt-10 px-4 w-full mx-auto">

								{/* ── Avatar Section ── */}
								<div
									class="w-[88px] h-[88px] rounded-[24px] p-[3px] flex items-center justify-center mb-4 shrink-0"
									style={{
										background: `linear-gradient(145deg, ${getClanLeague().color}60, ${getClanLeague().color}20)`,
										'box-shadow': `0 8px 30px ${getClanLeague().color}18`,
									}}
								>
									<div class="w-full h-full bg-[#12141a] rounded-[21px] flex items-center justify-center overflow-hidden">
										{clan().channel_photo ? (
											<img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`} alt={clan().chat_title} class="w-full h-full object-cover" />
										) : (
											<span class="material-symbols-outlined text-[36px] text-cyan-400">shield</span>
										)}
									</div>
								</div>

								{/* Clan Title & Link */}
								<button
									onClick={() => openTelegramLink(`https://t.me/${clan().channel_username}`)}
									class="flex items-center justify-center gap-2 text-white font-extrabold text-[26px] tracking-tight active:scale-95 transition-transform"
									style={{ 'text-shadow': '0 2px 10px rgba(0,0,0,0.5)' }}
								>
									{clan().chat_title}
									<span class="material-symbols-outlined text-[18px] text-white/30 mb-0.5">open_in_new</span>
								</button>

								{/* League Badge */}
								<button class="flex items-center gap-1.5 mt-1.5 active:scale-95 transition-transform bg-white/[0.04] rounded-full px-3 py-1 border border-white/[0.06]">
									<span
										class="material-symbols-outlined text-[16px]"
										style={{
											color: getClanLeague().color,
											'font-variation-settings': '"FILL" 1',
										}}
									>{getClanLeague().icon}</span>
									<span class="text-white/45 font-semibold text-[13px]">{currentLeagueName}</span>
									<span class="material-symbols-outlined text-[16px] text-white/25">chevron_right</span>
								</button>

								{/* How it works */}
								<button class="mt-4 text-white/50 font-medium text-[13px] underline underline-offset-4 decoration-white/15 active:opacity-70 transition-opacity">
									{t('airdropFinal.clan.howItWorks', { defaultValue: 'How it works?' })}
								</button>

								{/* Description Text */}
								<p class="text-center text-white/50 font-medium text-[13px] mt-4 max-w-[280px] leading-relaxed">
									{squadMessage}
								</p>

								{/* ── Stats & Actions Card ── */}
								<div
									class="w-full rounded-[20px] mt-6 flex flex-col border border-white/[0.07]"
									style={{
										background: 'rgba(255,255,255,0.025)',
										'box-shadow': '0 8px 30px rgba(0,0,0,0.4)',
									}}
								>
									{/* Top stats */}
									<div class="flex justify-between items-center px-5 py-5 border-b border-white/[0.06]">
										<div class="flex items-center gap-3">
											<div
												class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
												style={{
													background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
													'box-shadow': '0 0 12px rgba(245,158,11,0.25)',
												}}
											>
												<span class="text-black text-[15px] font-black leading-none mt-0.5">¢</span>
											</div>
											<div class="flex flex-col items-start">
												<span class="text-white font-bold text-[20px] leading-tight tabular-nums">
													{formatScore(clan().total_score || clan().members_count * 1500)}
												</span>
												<span class="text-white/35 text-[12px] font-medium">
													{t('airdropFinal.clan.minedInSquad', { defaultValue: 'mined in squad' })}
												</span>
											</div>
										</div>
										<div class="flex flex-col items-end">
											<span class="text-white font-bold text-[20px] leading-tight tabular-nums">{clan().members_count}</span>
											<span class="text-white/35 text-[12px] font-medium">
												{t('airdropFinal.clan.players', { defaultValue: 'players' })}
											</span>
										</div>
									</div>

						{/* ── Action Buttons ── */}
									<div class="p-4 flex flex-col gap-2.5">
										<button
											onClick={handleInvite}
											class="w-full h-12 rounded-xl bg-white text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all hover:bg-white/90 shadow-lg"
										>
											<span class="material-symbols-outlined text-base">group_add</span>
											{t('airdropFinal.clan.invite', { defaultValue: 'Invite Member' })}
										</button>
										<button
											onClick={handleLeave}
											disabled={loading()}
											class="w-full h-11 bg-white/5 border border-white/10 text-white/60 font-bold text-xs rounded-xl active:scale-98 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
										>
											{loading() ? '...' : t('airdropFinal.clan.leave', { defaultValue: 'Leave Clan' })}
										</button>
									</div>

									{/* Open Leaderboard Button */}
									<div class="px-4 pb-4">
										<button
											onClick={() => props.onOpenLeaderboard?.()}
											class="w-full py-3.5 rounded-[14px] active:scale-[0.97] transition-all duration-200 text-[14px] flex items-center justify-center gap-2 font-bold"
											style={{
												background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.03))',
												border: '1px solid rgba(245,158,11,0.18)',
												color: '#f59e0b',
												'box-shadow': '0 0 15px rgba(245,158,11,0.06)',
											}}
										>
											<span class="text-[16px]">🏆</span>
											{t('gamification.leaderboard' as any, { defaultValue: 'View Global Leaderboard' })}
										</button>
									</div>
								</div>

								{/* ── Period Tabs ── */}
								<div class="w-full flex justify-center mt-6 mb-4">
									<div class="bg-white/[0.03] rounded-full p-[3px] flex gap-0.5 border border-white/[0.05]">
										<button
											onClick={() => setActiveTab('day')}
											class={`px-6 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-300 ${
												activeTab() === 'day'
													? 'bg-white/[0.1] text-white shadow-sm'
													: 'text-white/35 hover:text-white/55'
											}`}
										>
											{t('airdropFinal.leaderboard.day', { defaultValue: 'Day' })}
										</button>
										<button
											onClick={() => setActiveTab('week')}
											class={`px-6 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-300 ${
												activeTab() === 'week'
													? 'bg-white/[0.1] text-white shadow-sm'
													: 'text-white/35 hover:text-white/55'
											}`}
										>
											{t('airdropFinal.leaderboard.week', { defaultValue: 'Week' })}
										</button>
									</div>
								</div>

								{/* ── Clan Members List ── */}
								<div class="w-full flex flex-col gap-2">
									<Show
										when={!clanMembers.loading}
										fallback={
											<div class="flex items-center justify-center py-6">
												<div class="w-6 h-6 border-2 border-white/15 border-t-amber-400 rounded-full animate-spin" />
											</div>
										}
									>
										<For
											each={clanMembers() || []}
											fallback={
												<div class="flex flex-col items-center justify-center py-8 gap-2">
													<span class="text-[24px]">👥</span>
													<span class="text-white/25 text-[13px] font-medium">
														{(t as any)('airdropFinal.clan.noMembers', { defaultValue: 'No members found.' })}
													</span>
												</div>
											}
										>
											{(member, index) => {
												const badge = () => getRankBadge(index());
												const isTop3 = () => index() < 3;
												return (
													<div
														class={`w-full p-3.5 flex items-center justify-between rounded-[16px] border transition-all duration-200 ${
															isTop3()
																? ''
																: 'bg-white/[0.02] border-white/[0.05]'
														}`}
														style={{
															animation: `nc-fadeInUp 400ms ease ${Math.min(index() * 50, 500)}ms both`,
															...getMemberRowStyle(index()),
														}}
													>
														<div class="flex items-center gap-3 min-w-0">
															{/* Rank Badge */}
															<div class={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] border shrink-0 ${badge().bg}`}>
																{badge().icon || (index() + 1)}
															</div>

															{/* Avatar */}
															<div
																class="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white overflow-hidden shrink-0"
																style={{
																	background: isTop3()
																		? `linear-gradient(135deg, ${index() === 0 ? 'rgba(251,191,36,0.12)' : index() === 1 ? 'rgba(148,163,184,0.12)' : 'rgba(217,119,6,0.12)'}, rgba(255,255,255,0.03))`
																		: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
																	border: `1.5px solid ${isTop3()
																		? (index() === 0 ? 'rgba(251,191,36,0.25)' : index() === 1 ? 'rgba(148,163,184,0.2)' : 'rgba(217,119,6,0.2)')
																		: 'rgba(255,255,255,0.06)'
																	}`,
																}}
															>
																{member.first_name.slice(0, 2).toUpperCase()}
															</div>

															{/* Name */}
															<div class="flex flex-col min-w-0">
																<span class="text-white font-semibold text-[15px] truncate">
																	{member.first_name} {member.last_name || ''}
																</span>
															</div>
														</div>

														{/* Score */}
														<div class="shrink-0 text-end pl-2 flex items-center gap-1.5">
															<span class="text-[12px]">🪙</span>
															<span class="text-white font-bold text-[14px] tabular-nums">
																{formatScore(member.score)}
															</span>
														</div>
													</div>
												);
											}}
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
