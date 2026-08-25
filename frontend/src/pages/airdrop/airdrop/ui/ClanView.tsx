import { openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createEffect, createResource, createSignal, For, Show } from 'solid-js';
import { API_CONFIG } from '@/shared/api/config.js';
import { getClanMembers, getTopClans, joinClan, leaveClan } from '@/entities/user/index.js';
import { formatNumber, t } from '@/shared/i18n/index.js';
import { setUserClan, userClan } from '@/entities/airdrop/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export const ClanView: Component<{ onOpenLeaderboard?: () => void }> = (props) => {
	const [usernameInput, setUsernameInput] = createSignal('');
	const [showSearch, setShowSearch] = createSignal(false);
	const [loading, setLoading] = createSignal(false);
	const [errorMsg, setErrorMsg] = createSignal('');
	const [showLeaveModal, setShowLeaveModal] = createSignal(false);
	const [pendingClanModal, setPendingClanModal] = createSignal<string | null>(null);
	const [filterCategory, setFilterCategory] = createSignal<'featured' | 'growing'>('featured');
	const [topClans] = createResource(getTopClans);

	const clanId = () => userClan()?.id;
	const [clanMembers] = createResource(clanId, (id) => getClanMembers(id));

	createEffect(() => {
		const pending = sessionStorage.getItem('pending_clan_join');
		if (pending) {
			sessionStorage.removeItem('pending_clan_join');
			setPendingClanModal(pending);
		}
	});

	const triggerHaptic = (type: 'impact' | 'success' | 'error' | 'light') => {
		try {
			
			if (type === 'impact') {
				haptic.impact('medium');
			} else if (type === 'light') {
				haptic.impact('light');
			} else {
				haptic.notify(type);
			}
		} catch (_) {}
	};

	const formatScore = (score: number) => {
		if (score >= 1_000_000) return `${formatNumber(Number((score / 1_000_000).toFixed(1)))}M`;
		if (score >= 1_000) return `${formatNumber(Number((score / 1_000).toFixed(0)))}K`;
		return formatNumber(score);
	};

	const filteredClans = () => {
		const list = topClans() || [];
		if (filterCategory() === 'growing') {
			return [...list].sort((a, b) => (b.members_count || 0) - (a.members_count || 0));
		}
		return list;
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
			setErrorMsg(e.message || t('airdrop.clan.joinErrorText'));
			triggerHaptic('error');
		} finally {
			setLoading(false);
		}
	};

	const confirmLeaveClan = async () => {
		if (loading()) return;
		setLoading(true);
		setShowLeaveModal(false);
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
			`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t('airdrop.clan.inviteText', { title: clan.chat_title }))}`,
		);
	};

	return (
		<div class="theme-play flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-32 relative bg-[#030303] text-white select-none">
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-1/2 -translate-x-1/2 w-[150vw] h-[300px] bg-gradient-to-b from-[#3390ec]/10 via-[#3390ec]/5 to-transparent blur-3xl pointer-events-none z-0" />

			<Show
				when={userClan()}
				fallback={
					/* --- NOT IN A CLAN --- */
					<div class="px-5 pt-8 relative z-10 min-h-full flex flex-col items-center max-w-md mx-auto">
						{/* Hero Icon */}
						<div class="relative w-20 h-20 mb-5">
							<div class="absolute inset-0 bg-amber-500/20 blur-xl rounded-full animate-pulse" />
							<div class="relative w-full h-full rounded-[24px] bg-gradient-to-b from-[#12141C] to-[#08090D] border border-amber-500/30 shadow-[inset_0_2px_10px_rgba(255,255,255,0.1),0_8px_20px_rgba(0,0,0,0.5)] flex items-center justify-center text-amber-400">
								<span class="material-symbols-outlined text-[40px] drop-shadow-[0_0_12px_rgba(252,211,77,0.6)]">
									shield
								</span>
							</div>
						</div>

						<h1 class="text-[22px] font-black text-white mb-2 text-center tracking-tight drop-shadow-md">
							{t('airdrop.clan.officialClansTitle')}
						</h1>
						<p class="text-white/60 text-[13px] text-center mb-6 leading-relaxed font-medium max-w-[280px]">
							{t('airdrop.clan.officialClansDesc')}
						</p>

						<button
							onClick={() => setShowSearch(!showSearch())}
							class="w-full h-14 rounded-[20px] bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white font-black text-[14px] flex items-center justify-center gap-2 active:scale-95 transition-all duration-300 shadow-[0_8px_24px_rgba(51,144,236,0.3)] hover:shadow-[0_12px_32px_rgba(51,144,236,0.4)] mb-6 border border-white/10"
						>
							<span class="material-symbols-outlined text-[20px]">search</span>
							{t('airdrop.clan.searchAndJoinBtn')}
						</button>

						<div
							class={`w-full transition-all duration-400 overflow-hidden ${
								showSearch() ? 'max-h-[200px] opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'
							}`}
						>
							<div class="w-full bg-[#12141C]/80 backdrop-blur-xl rounded-[24px] p-4 border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] space-y-3">
								<div class="flex gap-2 bg-black/40 p-1.5 rounded-[18px] border border-white/5">
									<input
										type="text"
										placeholder={t('airdrop.clan.searchPlaceholder')}
										value={usernameInput()}
										onInput={(e) => setUsernameInput(e.currentTarget.value)}
										onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
										class="flex-1 bg-transparent text-white font-mono text-[13px] px-3 py-2 outline-none placeholder-white/30"
										dir="ltr"
									/>
									<button
										onClick={() => handleJoin()}
										disabled={loading() || !usernameInput().trim()}
										class="px-5 py-2.5 rounded-[14px] bg-[#3390ec] text-white font-black text-xs shrink-0 active:scale-95 disabled:opacity-40 disabled:scale-100 transition-all shadow-md"
									>
										{loading() ? '...' : t('airdrop.clan.joinBtnText')}
									</button>
								</div>
								<Show when={errorMsg()}>
									<div class="text-[#ff4a4a] text-xs font-bold px-2 flex items-center gap-1">
										<span class="material-symbols-outlined text-[14px]">error</span>
										{errorMsg()}
									</div>
								</Show>
							</div>
						</div>

						{/* Discovery Category Filters */}
						<div class="w-full bg-[#12141C]/60 backdrop-blur-md rounded-2xl p-1 flex gap-1 mb-5 border border-white/5 shadow-inner">
							<button
								onClick={() => setFilterCategory('featured')}
								class={`flex-1 h-9 rounded-xl text-[13px] font-bold transition-all duration-300 ${
									filterCategory() === 'featured'
										? 'bg-white/10 text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-white/10'
										: 'text-white/40 hover:text-white/80'
								}`}
							>
								{t('airdrop.clan.featuredTab')}
							</button>
							<button
								onClick={() => setFilterCategory('growing')}
								class={`flex-1 h-9 rounded-xl text-[13px] font-bold transition-all duration-300 ${
									filterCategory() === 'growing'
										? 'bg-white/10 text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-white/10'
										: 'text-white/40 hover:text-white/80'
								}`}
							>
								{t('airdrop.clan.growingTab')}
							</button>
						</div>

						{/* Popular Clans List */}
						<div class="w-full flex flex-col gap-3">
							<For each={filteredClans()}>
								{(clan) => (
									<div class="group bg-[#12141C]/80 backdrop-blur-xl border border-white/5 hover:border-white/15 rounded-[24px] p-4 flex items-center justify-between transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
										<div class="flex items-center gap-3.5 flex-1 min-w-0">
											<div class="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#1c2230] to-[#08090D] border border-white/10 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
												<Show
													when={clan.channel_photo}
													fallback={<span class="text-amber-400 font-bold text-lg">🛡️</span>}
												>
													<img loading="lazy" 														src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`}
														alt=""
														class="w-full h-full object-cover"
													/>
												</Show>
											</div>
											<div class="flex flex-col text-start flex-1 min-w-0">
												<span class="text-[14px] font-black text-white truncate pe-2">
													{clan.chat_title}
												</span>
												<div class="flex items-center gap-1.5 mt-0.5 opacity-60">
													<span class="material-symbols-outlined text-[14px]">group</span>
													<span class="text-[11px] font-mono tabular-nums font-bold pt-0.5">
														{t('airdrop.clan.membersCount', {
															count: formatNumber(clan.members_count),
														})}
													</span>
												</div>
											</div>
										</div>

										<div class="flex items-center gap-2 shrink-0">
											<button
												onClick={() => openTelegramLink(`https://t.me/${clan.channel_username}`)}
												class="w-9 h-9 rounded-[12px] bg-white/5 hover:bg-white/15 text-white/70 flex items-center justify-center transition-colors border border-transparent hover:border-white/10"
											>
												<span class="material-symbols-outlined text-[18px]">open_in_new</span>
											</button>
											<button
												onClick={() => handleJoin(clan.channel_username)}
												class="h-9 px-4 rounded-[12px] bg-[#3390ec] hover:bg-[#2b7ec9] text-white text-[12px] font-black active:scale-95 transition-all shadow-[0_4px_12px_rgba(51,144,236,0.3)]"
											>
												{t('airdrop.clan.joinClanBtn')}
											</button>
										</div>
									</div>
								)}
							</For>
						</div>
					</div>
				}
			>
				{/* --- IN A CLAN --- */}
				{(clan) => (
					<div class="min-h-full flex flex-col relative w-full pb-8 max-w-md mx-auto px-4 pt-8">
						{/* Active Clan Hero Card */}
						<div class="relative bg-gradient-to-b from-[#151822] to-[#0c0e14] border border-white/10 rounded-[32px] p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">
							<div class="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
							<div class="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

							<div class="relative w-20 h-20 mx-auto rounded-[22px] bg-gradient-to-br from-[#1c2230] to-[#08090D] border-[1.5px] border-amber-500/40 flex items-center justify-center overflow-hidden shadow-[0_10px_30px_rgba(245,158,11,0.2)] mb-4">
								<Show
									when={clan().channel_photo}
									fallback={<span class="text-3xl drop-shadow-md">🛡️</span>}
								>
									<img loading="lazy" 										src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`}
										alt=""
										class="w-full h-full object-cover"
									/>
								</Show>
							</div>

							<div class="space-y-1.5 relative z-10">
								<h2 class="text-[20px] font-black text-white tracking-tight">{clan().chat_title}</h2>
								<div class="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
									<span class="text-[14px] drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]">🏆</span>
									<span class="text-[13px] font-mono tabular-nums text-amber-400 font-bold pt-0.5">
										{t('airdrop.clan.totalScoreText', {
											score: formatNumber(clan().total_score || 0),
										})}
									</span>
								</div>
							</div>

							<div class="grid grid-cols-3 gap-2.5 pt-6 relative z-10">
								<button
									onClick={handleInvite}
									class="col-span-2 h-12 rounded-[16px] bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] text-white font-black text-[13px] flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(51,144,236,0.3)] active:scale-95 transition-all border border-white/10"
								>
									<span class="material-symbols-outlined text-[20px]">group_add</span>
									{t('airdrop.clan.inviteFriendsBtn')}
								</button>
								<button
									onClick={() => setShowLeaveModal(true)}
									class="h-12 rounded-[16px] bg-[#1a1010] text-[#ff4a4a] border border-[#ff4a4a]/20 font-black text-[13px] flex items-center justify-center active:scale-95 transition-all hover:bg-[#ff4a4a]/10"
								>
									{t('airdrop.clan.leaveClan')}
								</button>
							</div>

							<Show when={props.onOpenLeaderboard}>
								<button
									onClick={() => props.onOpenLeaderboard?.()}
									class="w-full mt-3 h-11 rounded-[16px] bg-white/5 hover:bg-white/10 text-white/80 font-bold text-[13px] flex items-center justify-center gap-1.5 transition-colors border border-transparent hover:border-white/5"
								>
									<span class="material-symbols-outlined text-[18px]">leaderboard</span>
									{t('airdrop.clan.leaderboardBtnText')}
								</button>
							</Show>
						</div>

						{/* Members List */}
						<div class="mt-8 space-y-4">
							<div class="flex items-center gap-2 px-2">
								<span class="material-symbols-outlined text-white/40 text-[18px]">
									military_tech
								</span>
								<h3 class="text-[13px] font-black text-white/60 uppercase tracking-widest">
									{t('airdrop.clan.membersHeader')}
								</h3>
							</div>

							<div class="flex flex-col gap-2.5">
								<For each={clanMembers() || []}>
									{(member, index) => {
										const isTop1 = index() === 0;
										const isTop2 = index() === 1;
										const isTop3 = index() === 2;

										return (
											<div
												class={`relative overflow-hidden bg-[#12141C]/80 backdrop-blur-xl border rounded-[20px] p-3.5 flex items-center justify-between transition-all shadow-sm
												${
													isTop1
														? 'border-amber-400/40 bg-gradient-to-r from-amber-400/5 to-transparent'
														: isTop2
															? 'border-gray-300/30 bg-gradient-to-r from-gray-300/5 to-transparent'
															: isTop3
																? 'border-orange-400/30 bg-gradient-to-r from-orange-400/5 to-transparent'
																: 'border-white/5'
												}`}
											>
												<div class="flex items-center gap-3.5 z-10">
													<div
														class={`w-8 h-8 rounded-[10px] flex items-center justify-center font-mono tabular-nums font-black text-[13px]
														${
															isTop1
																? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.4)]'
																: isTop2
																	? 'bg-gray-300 text-black'
																	: isTop3
																		? 'bg-orange-400 text-black'
																		: 'bg-white/5 text-white/40 border border-white/10'
														}`}
													>
														#{index() + 1}
													</div>
													<span class="text-[14px] font-bold text-white tracking-tight">
														<bdi>{member.first_name}</bdi>
													</span>
												</div>
												<span
													class={`text-[13px] font-mono tabular-nums font-black z-10 ${
														isTop1
															? 'text-amber-400'
															: isTop2
																? 'text-gray-300'
																: isTop3
																	? 'text-orange-400'
																	: 'text-white/60'
													}`}
												>
													{formatScore(member.score)}
												</span>
											</div>
										);
									}}
								</For>
							</div>
						</div>
					</div>
				)}
			</Show>

			{/* Premium Leave Clan Confirmation Sheet */}
			<Show when={showLeaveModal()}>
				<div class="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center p-0 sm:p-6">
					<div
						class="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-fade-in"
						onClick={() => setShowLeaveModal(false)}
					/>

					<div class="relative w-full max-w-sm bg-[#12141C] sm:rounded-[32px] rounded-t-[32px] p-6 space-y-5 shadow-[0_-20px_60px_rgba(0,0,0,0.8)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.8)] border-t sm:border border-white/10 animate-slide-up">
						<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto sm:hidden mb-2" />

						<div class="flex flex-col items-center text-center gap-3">
							<div class="w-16 h-16 rounded-[20px] bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 flex items-center justify-center text-[#ff4a4a] mb-1">
								<span class="material-symbols-outlined text-[32px]">logout</span>
							</div>
							<h3 class="text-[18px] font-black text-white">{t('airdrop.clan.leaveModalTitle')}</h3>
							<p class="text-[13px] text-white/60 leading-relaxed font-medium px-2">
								{t('airdrop.clan.leaveModalDesc')}
							</p>
						</div>

						<div class="flex flex-col gap-2.5 pt-2">
							<button
								onClick={confirmLeaveClan}
								class="w-full h-14 bg-[#ff4a4a] hover:bg-[#eb3b3b] rounded-[18px] text-[14px] font-black text-white shadow-[0_8px_24px_rgba(255,74,74,0.3)] active:scale-95 transition-all"
							>
								{t('airdrop.clan.confirmLeaveBtn')}
							</button>
							<button
								onClick={() => setShowLeaveModal(false)}
								class="w-full h-14 bg-transparent hover:bg-white/5 rounded-[18px] text-[14px] font-bold text-white/70 active:scale-95 transition-all"
							>
								{t('airdrop.clan.cancelBtn')}
							</button>
						</div>
					</div>
				</div>
			</Show>
			{/* ═══════ PENDING DEEP LINK CLAN JOIN MODAL ═══════ */}
			<Show when={pendingClanModal()}>
				{(clanUsername) => (
					<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div
							class="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-fade-in"
							onClick={() => setPendingClanModal(null)}
						/>
						<div class="relative w-full max-w-sm bg-[#12141C] rounded-[32px] p-6 space-y-5 shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/10 animate-slide-up text-center">
							<div class="w-16 h-16 rounded-[22px] bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec] mx-auto shadow-[0_0_20px_rgba(51,144,236,0.25)]">
								<span class="material-symbols-outlined text-[32px]">shield</span>
							</div>

							<div class="flex flex-col gap-1">
								<h3 class="text-[18px] font-black text-white">Join Squad via Invite</h3>
								<p class="text-[13px] text-white/60 font-mono">
									@{clanUsername().replace(/^@+/, '')}
								</p>
								<p class="text-[12px] text-white/50 mt-1">
									You have been invited to join this squad and pool your mining scores together.
								</p>
							</div>

							<div class="flex flex-col gap-2.5 pt-2">
								<button
									onClick={() => {
										const u = pendingClanModal();
										setPendingClanModal(null);
										if (u) handleJoin(u);
									}}
									disabled={loading()}
									class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2563eb] rounded-[18px] text-[14px] font-black text-white shadow-[0_8px_24px_rgba(51,144,236,0.35)] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
								>
									<span>Join Squad</span>
									<span class="material-symbols-outlined text-[18px]">group_add</span>
								</button>
								<button
									onClick={() => setPendingClanModal(null)}
									class="w-full h-12 bg-transparent hover:bg-white/5 rounded-[16px] text-[13px] font-bold text-white/60 active:scale-95 transition-all"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}
			</Show>
		</div>
	);
};
