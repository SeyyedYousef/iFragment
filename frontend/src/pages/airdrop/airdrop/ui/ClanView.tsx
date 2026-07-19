import { hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createEffect, createResource, createSignal, For, Show } from 'solid-js';
import { API_CONFIG } from '@/shared/api/config.js';
import { getClanMembers, getTopClans, joinClan, leaveClan } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
import { CLAN_LEAGUES, setUserClan, userClan } from '@/shared/store/airdrop.js';

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
			const tgHaptic =
				typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback;
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

	const getRankBadge = (index: number) => {
		if (index === 0)
			return {
				bg: 'bg-amber-400/10 text-amber-400 border-amber-400/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
				rankText: '01',
			};
		if (index === 1)
			return { bg: 'bg-slate-300/10 text-slate-200 border-slate-300/30', rankText: '02' };
		if (index === 2)
			return { bg: 'bg-amber-700/10 text-amber-500 border-amber-600/30', rankText: '03' };
		return {
			bg: 'bg-white/5 text-white/40 border-white/10',
			rankText: index + 1 < 10 ? `0${index + 1}` : `${index + 1}`,
		};
	};

	return (
		<div
			class="flex-1 overflow-y-auto no-scrollbar pb-32 relative bg-[#08090d] text-white selection:bg-[#0098ea]/30"
			style={{ background: 'radial-gradient(ellipse at 50% 0%, #0c1220 0%, #08090d 100%)' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			<Show
				when={userClan()}
				fallback={
					/* ═══════ NOT IN A CLAN — Join Clan View ═══════ */
					<div class="px-5 pt-8 relative z-10 min-h-full flex flex-col items-center max-w-md mx-auto">
						{/* Ambient Glow */}
						<div
							class="absolute top-0 left-1/2 -translate-x-1/2 w-[320px] h-[320px] rounded-full pointer-events-none z-0"
							style={{
								background: 'radial-gradient(circle, rgba(0, 152, 234, 0.12) 0%, transparent 65%)',
								filter: 'blur(60px)',
							}}
						/>

						{/* Fragment Style Hero Badge */}
						<div class="w-16 h-16 rounded-2xl bg-[#121622] border border-[#0098ea]/30 flex items-center justify-center mb-4 relative shadow-[0_0_30px_rgba(0,152,234,0.15)] shrink-0">
							<span class="material-symbols-outlined text-[#0098ea] text-[34px]">shield</span>
						</div>

						<h1 class="text-2xl font-black text-white tracking-tight mb-1.5 text-center">
							{t('airdropFinal.clan.joinSquadTitle', { defaultValue: 'Official iFragment Clans' })}
						</h1>
						<p class="text-white/50 text-[13px] text-center mb-6 max-w-[300px] leading-relaxed font-medium">
							{t('airdropFinal.clan.joinSquadDesc', {
								defaultValue:
									'Join an official community clan to pool rewards and compete on global leaderboards.',
							})}
						</p>

						{/* Main Action Button */}
						<button
							onClick={() => setShowSearch(!showSearch())}
							class="w-full h-12 rounded-xl bg-[#0098ea] hover:bg-[#0088d4] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(0,152,234,0.3)] mb-4"
						>
							<span class="material-symbols-outlined text-base">search</span>
							{t('airdropFinal.clan.joinAnother', { defaultValue: 'Search & Join Clan' })}
						</button>

						{/* Search Input Dropdown */}
						<Show when={showSearch()}>
							<div class="w-full bg-[#10141e] rounded-2xl p-4 mb-4 animate-fade-in border border-[#0098ea]/20 shadow-2xl">
								<div class="flex gap-2">
									<input
										type="text"
										placeholder={t('airdropFinal.clan.searchPlaceholder', {
											defaultValue: 'Squad username...',
										})}
										value={usernameInput()}
										onInput={(e) => setUsernameInput(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
										class="flex-1 bg-[#161b28] text-white font-mono text-[13px] py-3 px-4 rounded-xl border border-white/10 focus:border-[#0098ea] focus:outline-none placeholder:text-white/20 transition-colors"
									/>
									<button
										onClick={() => handleJoin()}
										disabled={loading() || !usernameInput().trim()}
										class="px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shrink-0 active:scale-95 disabled:opacity-40"
										style={
											usernameInput().trim() && !loading()
												? {
														background: '#0098ea',
														color: '#ffffff',
													}
												: {
														background: 'rgba(255,255,255,0.05)',
														color: 'rgba(255,255,255,0.3)',
													}
										}
									>
										{loading() ? '...' : t('airdropFinal.clan.joinBtn', { defaultValue: 'Join' })}
									</button>
								</div>
								{errorMsg() && (
									<div class="text-red-400 text-xs font-semibold mt-2.5 px-1">{errorMsg()}</div>
								)}
							</div>
						</Show>

						{/* Popular Squads List */}
						<div class="w-full mt-2 flex flex-col gap-2">
							<div class="text-[11px] font-mono font-bold uppercase tracking-widest text-white/40 mb-1 px-1">
								{t('airdropFinal.clan.popularClans' as any, { defaultValue: 'Popular Squads' })}
							</div>

							<Show
								when={!topClans.loading}
								fallback={
									<div class="flex items-center justify-center py-10">
										<div class="w-6 h-6 border-2 border-white/10 border-t-[#0098ea] rounded-full animate-spin" />
									</div>
								}
							>
								<Show
									when={!topClans.error}
									fallback={
										<div class="text-red-400 text-xs text-center py-6 font-medium">
											{t('airdropFinal.clan.loadError', {
												defaultValue: 'Failed to load popular squads.',
											})}
										</div>
									}
								>
									<For
										each={topClans() || []}
										fallback={
											<div class="text-white/30 text-xs text-center py-6 font-medium">
												{t('airdropFinal.clan.noSquads')}
											</div>
										}
									>
										{(clan) => {
											return (
												<button
													onClick={() => handleJoin(clan.channel_username)}
													disabled={loading()}
													class="w-full flex items-center p-3 rounded-2xl border border-white/[0.08] bg-[#10141e]/90 hover:bg-[#151a28] transition-all duration-200 active:scale-[0.98] text-start group"
												>
													{/* Photo */}
													<div class="w-11 h-11 rounded-xl bg-[#161b28] border border-white/10 flex items-center justify-center shrink-0 mr-3 overflow-hidden">
														{clan.channel_photo ? (
															<img
																src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`}
																alt={clan.chat_title}
																class="w-full h-full rounded-xl object-cover"
															/>
														) : (
															<span class="material-symbols-outlined text-white/40 text-xl">
																shield
															</span>
														)}
													</div>

													{/* Details */}
													<div class="flex-1 min-w-0 pr-2">
														<div class="text-white font-bold text-[14px] truncate tracking-tight group-hover:text-[#0098ea] transition-colors">
															{clan.chat_title}
														</div>
														<div class="flex items-center gap-2 mt-0.5" dir="ltr">
															<span class="text-white/40 text-[11px] font-mono">
																@{clan.channel_username.replace(/^@+/, '')}
															</span>
															<span class="text-white/20">·</span>
															<span class="text-white/50 text-[11px] font-medium">
																{clan.members_count} members
															</span>
														</div>
													</div>

													{/* Arrow */}
													<span class="material-symbols-outlined text-white/20 text-lg group-hover:text-white/60 group-hover:translate-x-0.5 transition-all">
														chevron_right
													</span>
												</button>
											);
										}}
									</For>
								</Show>
							</Show>
						</div>

						{/* Leaderboard Trigger Button */}
						<div class="w-full mt-4">
							<button
								onClick={() => props.onOpenLeaderboard?.()}
								class="w-full py-3 rounded-xl active:scale-[0.98] transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-white/10 bg-[#121622] hover:bg-[#181d2c] text-amber-400"
							>
								<span>🏆</span>
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

					return (
						<div class="min-h-full flex flex-col relative w-full pb-8 max-w-md mx-auto px-4 pt-8">
							{/* Background ambient glow */}
							<div
								class="absolute top-0 left-1/2 -translate-x-1/2 w-[320px] h-[320px] rounded-full pointer-events-none z-0"
								style={{
									background: `radial-gradient(circle, ${getClanLeague().color}18 0%, transparent 60%)`,
									filter: 'blur(60px)',
								}}
							/>

							<div class="relative z-10 flex flex-col items-center w-full">
								{/* Avatar Section */}
								<div
									class="w-20 h-20 rounded-2xl p-[2px] flex items-center justify-center mb-3 shrink-0"
									style={{
										background: `linear-gradient(135deg, ${getClanLeague().color}, rgba(255,255,255,0.1))`,
										'box-shadow': `0 0 24px ${getClanLeague().color}25`,
									}}
								>
									<div class="w-full h-full bg-[#121622] rounded-[14px] flex items-center justify-center overflow-hidden">
										{clan().channel_photo ? (
											<img
												src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`}
												alt={clan().chat_title}
												class="w-full h-full object-cover"
											/>
										) : (
											<span class="material-symbols-outlined text-[36px] text-[#0098ea]">
												shield
											</span>
										)}
									</div>
								</div>

								{/* Clan Title & External Link */}
								<button
									onClick={() => openTelegramLink(`https://t.me/${clan().channel_username}`)}
									class="flex items-center justify-center gap-1.5 text-white font-extrabold text-2xl tracking-tight active:scale-95 transition-transform"
								>
									{clan().chat_title}
									<span class="material-symbols-outlined text-[16px] text-white/30">
										open_in_new
									</span>
								</button>

								{/* League Badge */}
								<div class="flex items-center gap-1.5 mt-2 bg-[#121622] border border-white/10 rounded-full px-3 py-1">
									<span
										class="material-symbols-outlined text-sm"
										style={{
											color: getClanLeague().color,
											'font-variation-settings': '"FILL" 1',
										}}
									>
										{getClanLeague().icon}
									</span>
									<span class="text-white/60 font-mono text-[11px] uppercase tracking-wider font-bold">
										{currentLeagueName} League
									</span>
								</div>

								{/* Stats Card */}
								<div class="w-full rounded-2xl mt-5 flex flex-col border border-white/[0.08] bg-[#10141e]/90 shadow-2xl backdrop-blur-md">
									{/* Top stats grid */}
									<div class="grid grid-cols-2 divide-x divide-white/[0.08] p-4 border-b border-white/[0.08]">
										<div class="flex flex-col items-center text-center px-2">
											<span class="text-white/40 text-[11px] font-mono font-bold uppercase tracking-wider mb-1">
												Total Mined
											</span>
											<span class="text-white font-black text-xl font-mono tabular-nums flex items-center gap-1">
												<span>🪙</span>
												<span>
													{formatScore(clan().total_score || clan().members_count * 1500)}
												</span>
											</span>
										</div>
										<div class="flex flex-col items-center text-center px-2">
											<span class="text-white/40 text-[11px] font-mono font-bold uppercase tracking-wider mb-1">
												Members
											</span>
											<span class="text-white font-black text-xl font-mono tabular-nums">
												{clan().members_count.toLocaleString('en-US')}
											</span>
										</div>
									</div>

									{/* Action Buttons */}
									<div class="p-3.5 flex flex-col gap-2">
										<button
											onClick={handleInvite}
											class="w-full h-11 rounded-xl bg-[#0098ea] hover:bg-[#0088d4] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(0,152,234,0.25)]"
										>
											<span class="material-symbols-outlined text-base">group_add</span>
											{t('airdropFinal.clan.invite', { defaultValue: 'Invite Member' })}
										</button>

										<div class="flex gap-2">
											<button
												onClick={() => props.onOpenLeaderboard?.()}
												class="flex-1 h-10 bg-[#161b28] border border-white/10 hover:bg-[#1a2130] text-amber-400 font-bold text-xs uppercase tracking-wider rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
											>
												<span>🏆</span>
												{t('gamification.leaderboard' as any, { defaultValue: 'Leaderboard' })}
											</button>
											<button
												onClick={handleLeave}
												disabled={loading()}
												class="h-10 px-4 bg-white/5 border border-white/10 text-white/50 hover:text-white font-semibold text-xs rounded-xl active:scale-[0.98] transition-all disabled:opacity-40"
											>
												{loading()
													? '...'
													: t('airdropFinal.clan.leave', { defaultValue: 'Leave' })}
											</button>
										</div>
									</div>
								</div>

								{/* Member Period Segmented Control */}
								<div class="w-full flex justify-between items-center mt-6 mb-3 px-1">
									<span class="text-xs font-mono font-bold uppercase tracking-widest text-white/40">
										Members Rank
									</span>
									<div class="bg-[#121622] rounded-lg p-0.5 flex gap-0.5 border border-white/10">
										<button
											onClick={() => setActiveTab('day')}
											class={`px-3 py-1 rounded-md text-[11px] font-mono font-bold transition-all ${
												activeTab() === 'day'
													? 'bg-[#0098ea] text-white'
													: 'text-white/40 hover:text-white/70'
											}`}
										>
											Day
										</button>
										<button
											onClick={() => setActiveTab('week')}
											class={`px-3 py-1 rounded-md text-[11px] font-mono font-bold transition-all ${
												activeTab() === 'week'
													? 'bg-[#0098ea] text-white'
													: 'text-white/40 hover:text-white/70'
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
												<div class="w-6 h-6 border-2 border-white/10 border-t-[#0098ea] rounded-full animate-spin" />
											</div>
										}
									>
										<For
											each={clanMembers() || []}
											fallback={
												<div class="flex flex-col items-center justify-center py-8 gap-2 bg-[#10141e]/50 rounded-2xl border border-white/[0.05]">
													<span class="text-white/30 text-xs font-medium">
														{(t as any)('airdropFinal.clan.noMembers', {
															defaultValue: 'No members found.',
														})}
													</span>
												</div>
											}
										>
											{(member, index) => {
												const badge = () => getRankBadge(index());
												return (
													<div class="w-full p-3 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-[#10141e] hover:bg-[#151a28] transition-all">
														<div class="flex items-center gap-3 min-w-0 pr-2">
															{/* Rank Badge */}
															<div
																class={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs border shrink-0 ${badge().bg}`}
															>
																{badge().rankText}
															</div>

															{/* Member Avatar */}
															<div class="w-9 h-9 rounded-full bg-[#161b28] border border-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
																{member.first_name.slice(0, 2).toUpperCase()}
															</div>

															{/* Name */}
															<span class="text-white font-semibold text-sm truncate">
																{member.first_name} {member.last_name || ''}
															</span>
														</div>

														{/* Score */}
														<div
															class="shrink-0 flex items-center gap-1 pl-2 font-mono font-bold text-xs text-white/90 tabular-nums"
															dir="ltr"
														>
															<span>🪙</span>
															<span>{formatScore(member.score)}</span>
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
