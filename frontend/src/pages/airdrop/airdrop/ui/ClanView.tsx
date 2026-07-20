import { hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createEffect, createResource, createSignal, For, Show } from 'solid-js';
import { API_CONFIG } from '@/shared/api/config.js';
import { getClanMembers, getTopClans, joinClan, leaveClan } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
import { setUserClan, userClan } from '@/shared/store/airdrop.js';

export const ClanView: Component<{ onOpenLeaderboard?: () => void }> = (props) => {
	const [usernameInput, setUsernameInput] = createSignal('');
	const [showSearch, setShowSearch] = createSignal(false);
	const [loading, setLoading] = createSignal(false);
	const [errorMsg, setErrorMsg] = createSignal('');
	const [showLeaveModal, setShowLeaveModal] = createSignal(false);
	const [filterCategory, setFilterCategory] = createSignal<'featured' | 'growing' | 'friends'>('featured');
	const [topClans] = createResource(getTopClans);

	const clanId = () => userClan()?.id;
	const [clanMembers] = createResource(clanId, (id) => getClanMembers(id));

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
		return score.toLocaleString('fa-IR');
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
			setErrorMsg(e.message || 'خطا در عضویت در کلن');
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
			`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t('airdropFinal.clan.inviteText', { title: clan.chat_title }))}`,
		);
	};

	return (
		<div class="theme-play flex-1 overflow-y-auto no-scrollbar pb-32 relative bg-[#08090D] text-white select-none">
			<Show
				when={userClan()}
				fallback={
					/* NOT IN A CLAN — Join Clan View */
					<div class="px-5 pt-6 relative z-10 min-h-full flex flex-col items-center max-w-md mx-auto">
						<div class="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3 text-amber-400">
							<span class="material-symbols-outlined text-3xl">shield</span>
						</div>

						<h1 class="text-xl font-black text-white mb-1 text-center">
							کلن‌های رسمی iFragment
						</h1>
						<p class="text-white/50 text-xs text-center mb-5 leading-relaxed font-bold">
							به کلن‌های تلگرامی ملحق شوید تا امتیازات استخراج و شانس ایردراپ گروهی را افزایش دهید.
						</p>

						<button
							onClick={() => setShowSearch(!showSearch())}
							class="w-full h-12 rounded-xl bg-[#3390ec] hover:bg-[#2b7ec9] text-white font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-[#3390ec]/20 mb-4"
						>
							<span class="material-symbols-outlined text-[18px]">search</span>
							جستجو و عضویت در کلن
						</button>

						<Show when={showSearch()}>
							<div class="w-full bg-[#151822] rounded-2xl p-4 mb-4 border border-white/10 space-y-3">
								<div class="flex gap-2">
									<input
										type="text"
										placeholder="یوزرنیم کلن یا کانال..."
										value={usernameInput()}
										onInput={(e) => setUsernameInput(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
										class="flex-1 bg-black/40 text-white font-mono text-xs p-3 rounded-xl border border-white/10 outline-none focus:border-[#3390ec]"
										dir="ltr"
									/>
									<button
										onClick={() => handleJoin()}
										disabled={loading() || !usernameInput().trim()}
										class="px-4 py-3 rounded-xl bg-[#3390ec] text-white font-black text-xs shrink-0 active:scale-95 disabled:opacity-40"
									>
										{loading() ? '...' : 'عضویت'}
									</button>
								</div>
								<Show when={errorMsg()}>
									<div class="text-red-400 text-xs font-bold px-1">{errorMsg()}</div>
								</Show>
							</div>
						</Show>

						{/* Discovery Category Filters */}
						<div class="w-full flex gap-2 border-b border-white/10 pb-2 mb-3">
							<button
								onClick={() => setFilterCategory('featured')}
								class={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
									filterCategory() === 'featured' ? 'bg-[#3390ec] text-white' : 'text-white/50 hover:text-white'
								}`}
							>
								برترین‌ها (Featured)
							</button>
							<button
								onClick={() => setFilterCategory('growing')}
								class={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
									filterCategory() === 'growing' ? 'bg-[#3390ec] text-white' : 'text-white/50 hover:text-white'
								}`}
							>
								در حال رشد
							</button>
						</div>

						{/* Popular Clans List */}
						<div class="w-full space-y-2">
							<For each={topClans() || []}>
								{(clan) => (
									<div class="bg-[#151822] border border-white/10 rounded-[20px] p-3.5 flex items-center justify-between">
										<div class="flex items-center gap-3">
											<div class="w-10 h-10 rounded-xl bg-black border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
												<Show when={clan.channel_photo} fallback={<span class="text-amber-400 font-bold text-xs">🛡️</span>}>
													<img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan.channel_username}`} alt="" class="w-full h-full object-cover" />
												</Show>
											</div>
											<div class="flex flex-col text-start">
												<span class="text-xs font-black text-white">{clan.chat_title}</span>
												<span class="text-[10px] font-mono text-white/40">{clan.members_count} عضو</span>
											</div>
										</div>

										<div class="flex items-center gap-2">
											<button
												onClick={() => openTelegramLink(`https://t.me/${clan.channel_username}`)}
												class="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-bold flex items-center gap-1"
											>
												<span class="material-symbols-outlined text-[14px]">open_in_new</span>
												کانال
											</button>
											<button
												onClick={() => handleJoin(clan.channel_username)}
												class="px-3 py-1.5 rounded-xl bg-[#3390ec] hover:bg-[#2b7ec9] text-white text-xs font-black"
											>
												عضویت در کلن
											</button>
										</div>
									</div>
								)}
							</For>
						</div>
					</div>
				}
			>
				{/* IN A CLAN — Squad Details View */}
				{(clan) => (
					<div class="min-h-full flex flex-col relative w-full pb-8 max-w-md mx-auto px-4 pt-6">
						<div class="bg-[#151822] border border-white/10 rounded-[24px] p-5 space-y-4 text-center">
							<div class="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center overflow-hidden">
								<Show when={clan().channel_photo} fallback={<span class="text-2xl">🛡️</span>}>
									<img src={`${API_CONFIG.BASE_URL}/profile/clan/photo?username=${clan().channel_username}`} alt="" class="w-full h-full object-cover" />
								</Show>
							</div>

							<div class="space-y-1">
								<h2 class="text-lg font-black text-white">{clan().chat_title}</h2>
								<div class="text-xs font-mono text-amber-400 font-bold">{(clan().total_score || 0).toLocaleString('fa-IR')} کل امتیازات</div>
							</div>

							<div class="grid grid-cols-3 gap-2 pt-2">
								<button
									onClick={handleInvite}
									class="col-span-2 h-11 rounded-xl bg-[#3390ec] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#3390ec]/20"
								>
									<span class="material-symbols-outlined text-[18px]">group_add</span>
									دعوت دوستان به کلن
								</button>
								<button
									onClick={() => setShowLeaveModal(true)}
									class="h-11 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-black text-xs flex items-center justify-center gap-1"
								>
									ترک کلن
								</button>
							</div>
							<Show when={props.onOpenLeaderboard}>
								<button
									onClick={() => props.onOpenLeaderboard?.()}
									class="w-full mt-2 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-amber-400 font-bold text-xs flex items-center justify-center gap-1"
								>
									🏆 لیدربورد کلن‌ها
								</button>
							</Show>
						</div>

						{/* Members List */}
						<div class="mt-6 space-y-3">
							<h3 class="text-xs font-black text-white uppercase tracking-wider px-1">اعضای کلن</h3>
							<div class="space-y-2">
								<For each={clanMembers() || []}>
									{(member, index) => (
										<div class="bg-[#151822] border border-white/10 rounded-2xl p-3 flex items-center justify-between">
											<div class="flex items-center gap-3">
												<span class="text-xs font-mono font-bold text-white/40">#{index() + 1}</span>
												<span class="text-xs font-bold text-white"><bdi>{member.first_name}</bdi></span>
											</div>
											<span class="text-xs font-mono font-black text-amber-400">{formatScore(member.score)}</span>
										</div>
									)}
								</For>
							</div>
						</div>
					</div>
				)}
			</Show>

			{/* Leave Clan Confirmation Sheet */}
			<Show when={showLeaveModal()}>
				<div class="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
					<div class="w-full max-w-sm bg-[#151822] border border-white/10 rounded-[28px] p-6 space-y-4 shadow-2xl">
						<div class="flex items-center gap-2 text-red-400">
							<span class="material-symbols-outlined text-2xl">warning</span>
							<h3 class="text-base font-black">ترک کلن فعلی</h3>
						</div>
						<p class="text-xs text-white/70 leading-relaxed font-bold">
							با خروج از کلن، ضریب بونوس استخراج ایردراپ کلن از دست رفته و امتیاز شما در این کلن صفر خواهد شد.
						</p>
						<div class="flex gap-3 pt-2">
							<button onClick={() => setShowLeaveModal(false)} class="flex-1 h-11 bg-white/5 rounded-xl text-xs font-bold text-white">
								انصراف
							</button>
							<button onClick={confirmLeaveClan} class="flex-1 h-11 bg-red-500 rounded-xl text-xs font-black text-white shadow-lg shadow-red-500/20">
								تأیید خروج
							</button>
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
};
