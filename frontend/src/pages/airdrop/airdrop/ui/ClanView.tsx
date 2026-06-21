import { hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, Show } from 'solid-js';
import { getTopClans, joinClan, leaveClan } from '@/shared/api/profile.js';
import { setUserClan, userClan } from '@/shared/store/airdrop.js';
import { t } from '@/shared/i18n/index.js';

export const ClanView: Component = () => {
	const [usernameInput, setUsernameInput] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	const [errorMsg, setErrorMsg] = createSignal('');
	const [topClans] = createResource(getTopClans);

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
			hapticFeedback.impactOccurred('medium');
			const clanDetails = await joinClan(target);
			setUserClan(clanDetails);
			setUsernameInput('');
		} catch (e: any) {
			setErrorMsg(e.message || 'Failed to join clan');
			hapticFeedback.notificationOccurred('error');
		} finally {
			setLoading(false);
		}
	};

	const handleLeave = async () => {
		if (loading()) return;
		setLoading(true);
		try {
			hapticFeedback.notificationOccurred('success');
			await leaveClan();
			setUserClan(null);
		} catch (e: any) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	const handleInvite = () => {
		try {
			hapticFeedback.impactOccurred('light');
		} catch (_) {}
		const clan = userClan();
		if (!clan) return;
		const link = `https://t.me/iFragmentBot?start=clan_${clan.channel_username}`;
		openTelegramLink(
			`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t('airdropNew.clan.inviteText', { title: clan.chat_title }))}`,
		);
	};

	return (
		<div 
			class="flex-1 overflow-y-auto no-scrollbar animate-fade-in pb-36" 
			style={{ background: '#000' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			<Show
				when={userClan()}
				fallback={
					/* === NOT IN A CLAN === */
					<div class="px-5 pt-6">
						{/* Header */}
						<h1 class="text-[28px] font-bold text-white tracking-tight">{t('airdropNew.clan.title')}</h1>
						<p class="text-[#8e8e93] text-[15px] mt-1">{t('airdropNew.clan.subtitle')}</p>

						{/* How it works */}
						<button class="w-full mt-4 bg-[#1c1c1e] rounded-2xl p-4 flex items-center justify-between active:bg-white/5 transition-all">
							<div class="flex items-center gap-3">
								<span class="text-2xl">💡</span>
								<div class="text-start">
									<div class="text-white font-medium text-[15px]">{t('airdropNew.clan.howItWorks')}</div>
									<div class="text-[#8e8e93] text-[13px]">{t('airdropNew.clan.howItWorksDesc')}</div>
								</div>
							</div>
							<span class="material-symbols-outlined text-white/40 text-[20px]">chevron_right</span>
						</button>

						{/* Search to Join */}
						<div class="mt-5 bg-[#1c1c1e] rounded-2xl p-4">
							<h3 class="text-white font-semibold text-[17px] mb-3">{t('airdropNew.clan.joinTitle')}</h3>
							<p class="text-[#8e8e93] text-[13px] mb-3">{t('airdropNew.clan.joinDesc')}</p>
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
									{loading() ? '...' : t('airdropNew.clan.joinBtn')}
								</button>
							</div>
							{errorMsg() && (
								<div class="text-red-500 text-[13px] font-medium mt-2.5 px-1">{errorMsg()}</div>
							)}
						</div>

						{/* Popular Squads */}
						<div class="mt-6">
							<h2 class="text-[20px] font-bold text-white mb-3 tracking-tight">{t('airdropNew.clan.popularSquads')}</h2>
							<div class="bg-[#1c1c1e] rounded-[24px] overflow-hidden">
								<Show
									when={!topClans.loading}
									fallback={
										<div class="flex items-center justify-center py-10">
											<div class="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
										</div>
									}
								>
									<For
										each={topClans() || []}
										fallback={
											<div class="text-[#8e8e93] text-[14px] text-center py-8">{t('airdropNew.clan.noSquads')}</div>
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
														{clan.members_count.toLocaleString('en-US')} {t('airdropNew.clan.members')}
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
							</div>
						</div>
					</div>
				}
			>
				{/* === IN A CLAN === */}
				{(clan) => (
					<div class="px-5 pt-6">
						{/* Clan Header */}
						<div class="text-center mb-6">
							<h1 class="text-[24px] font-bold text-white tracking-tight">{t('airdropNew.clan.title')}</h1>

							{/* Clan Card */}
							<div class="mt-4 bg-[#1c1c1e] rounded-3xl p-5 relative overflow-hidden">
								{/* Ambient glow */}
								<div
									class="absolute top-0 end-0 w-40 h-40 rounded-full pointer-events-none"
									style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)' }}
								></div>

								<div class="relative z-10">
									<div class="flex items-center gap-4 mb-4">
										<img
											src={clan().channel_photo || 'https://telegram.org/img/t_logo.png'}
											alt={clan().chat_title}
											class="w-16 h-16 rounded-2xl object-cover border-2 border-white/10"
										/>
										<div class="text-start flex-1 min-w-0">
											<h2 class="text-white font-bold text-[20px] truncate">{clan().chat_title}</h2>
											<div class="text-[#8e8e93] text-[14px]">@{clan().channel_username}</div>
										</div>
									</div>

									{/* Stats Row */}
									<div class="grid grid-cols-2 gap-3 mb-4">
										<div class="bg-white/5 rounded-xl p-3 text-center">
											<div class="text-white font-bold text-[18px]">{clan().members_count.toLocaleString('en-US')}</div>
											<div class="text-[#8e8e93] text-[12px]">{t('airdropNew.clan.membersLabel')}</div>
										</div>
										<div class="bg-white/5 rounded-xl p-3 text-center">
											<div class="text-amber-400 font-bold text-[18px]">
												{formatScore(clan().total_score || clan().members_count * 1500)}
											</div>
											<div class="text-[#8e8e93] text-[12px]">{t('airdropNew.clan.scoreLabel')}</div>
										</div>
									</div>

									{/* Actions */}
									<button
										onClick={handleInvite}
										class="w-full bg-[#3390ec] text-white font-bold py-3.5 rounded-xl active:scale-[0.98] transition-transform text-[15px] mb-2"
									>
										{t('airdropNew.clan.invite')}
									</button>
									<button
										onClick={handleLeave}
										disabled={loading()}
										class="w-full bg-white/5 border border-white/10 text-white/70 font-medium py-3 rounded-xl active:scale-[0.98] transition-transform text-[14px]"
									>
										{loading() ? '...' : t('airdropNew.clan.leave')}
									</button>
								</div>
							</div>
						</div>

						{/* Global Squads Leaderboard */}
						<div>
							<h2 class="text-[20px] font-bold text-white mb-3 tracking-tight">{t('airdropNew.clan.topSquads')}</h2>
							<div class="bg-[#1c1c1e] rounded-[24px] overflow-hidden">
								<Show
									when={!topClans.loading}
									fallback={
										<div class="flex items-center justify-center py-10">
											<div class="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
										</div>
									}
								>
									<For each={topClans() || []}>
										{(c, i) => {
											const isMySquad = () => c.id === clan().id;
											return (
												<div
													class={`flex items-center p-4 ${i() !== 0 ? 'border-t border-white/5' : ''} ${
														isMySquad() ? 'bg-[#3390ec]/10' : ''
													}`}
												>
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
													{c.channel_photo ? (
														<img
															src={c.channel_photo}
															alt={c.chat_title}
															class="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0 mr-3"
														/>
													) : (
														<div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 mr-3 text-lg">
															🛡️
														</div>
													)}
													<div class="flex-1 min-w-0">
														<div class="flex items-center gap-2">
															<span class="text-white font-medium text-[15px] truncate">{c.chat_title}</span>
															{isMySquad() && (
																<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#3390ec]/20 text-[#3390ec]">{t('airdropNew.clan.you')}</span>
															)}
														</div>
														<div class="text-[#8e8e93] text-[13px]">
															{c.members_count.toLocaleString('en-US')} {t('airdropNew.clan.members')}
														</div>
													</div>
													<div class="flex items-center gap-1 shrink-0 ms-2">
														<span
															class="material-symbols-outlined text-amber-400 text-[14px]"
															style={{ 'font-variation-settings': '"FILL" 1' }}
														>
															monetization_on
														</span>
														<span class="text-amber-400 font-bold text-[14px]">
															{formatScore(c.total_score || c.members_count * 1500)}
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
				)}
			</Show>
		</div>
	);
};
