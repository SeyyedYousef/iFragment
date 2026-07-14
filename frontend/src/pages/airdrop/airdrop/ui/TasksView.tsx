import { createQuery } from '@tanstack/solid-query';
import { hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createSignal, For, Show } from 'solid-js';
import { completeTask, getTasksStatus, TaskStatus } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
import { syncProfileStats } from '@/shared/store/airdrop.js';

export const TasksView: Component = () => {
	const [taskErrors, setTaskErrors] = createSignal<Record<string, string>>({});
	const [loadingKeys, setLoadingKeys] = createSignal<Record<string, boolean>>({});
	const [activeQuizTask, setActiveQuizTask] = createSignal<TaskStatus | null>(null);
	const [activeCampaign, setActiveCampaign] = createSignal<TaskStatus | null>(null);
	const [quizAnswerInput, setQuizAnswerInput] = createSignal('');
	const [quizError, setQuizError] = createSignal('');

	const tasksQuery = createQuery<TaskStatus[]>(() => ({
		queryKey: ['tasks-status'],
		queryFn: getTasksStatus as () => Promise<TaskStatus[]>,
		staleTime: 30_000,
		refetchOnWindowFocus: false,
	}));

	const handleTaskClick = async (task: TaskStatus) => {
		if (task.completed) return;
		const key = task.key;

		// Clear previous errors
		setTaskErrors((prev) => ({ ...prev, [key]: '' }));

		try {
			hapticFeedback.impactOccurred('medium');
		} catch (_) {}

		// Quiz quest check: trigger input modal
		if (task.type === 'quiz') {
			setActiveQuizTask(task);
			setQuizAnswerInput('');
			setQuizError('');
			return;
		}

		if (task.type === 'campaign') {
			setActiveCampaign(task);
			return;
		}

		setLoadingKeys((prev) => ({ ...prev, [key]: true }));

		// CTA Redirect if Telegram channel task
		if (task.type === 'channel_join' || key === 'join_ifragment_channel') {
			let channelName = task.config?.channel_username || 'ifragment_net';
			channelName = channelName.replace(/^@/, '');
			try {
				openTelegramLink(`https://t.me/${channelName}`);
			} catch (_) {
				window.open(`https://t.me/${channelName}`, '_blank');
			}
			// Give a tiny timeout for channel redirection before triggering verification
			await new Promise((resolve) => setTimeout(resolve, 800));
		} else if (task.type === 'link' || task.type === 'social') {
			let targetUrl = task.config?.url;
			if (targetUrl) {
				try {
					if (targetUrl.includes('t.me')) {
						openTelegramLink(targetUrl);
					} else {
						window.open(targetUrl, '_blank');
					}
				} catch (_) {
					window.open(targetUrl, '_blank');
				}
			}
			// Dumb verification: wait 5 seconds while showing loading spinner
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}

		try {
			const result = await completeTask(key);
			if (result) {
				try {
					hapticFeedback.notificationOccurred('success');
				} catch (_) {}
				tasksQuery.refetch();
				await syncProfileStats();
			} else {
				throw new Error('empty_response');
			}
		} catch (e: any) {
			console.error('Failed to complete task:', e);
			let errorMessage = t('airdrop.tasks.errors.default') || 'Failed to verify task';
			if (e?.message) {
				const msg = e.message.toLowerCase();
				if (msg.includes('gold league')) {
					errorMessage = 'You need to reach Gold league first.';
				} else if (msg.includes('join a clan')) {
					errorMessage = 'You need to join a clan first.';
				} else if (msg.includes('invite at least')) {
					errorMessage = e.message; // Let backend message pass through
				} else if (msg.includes('total taps')) {
					errorMessage = "Keep tapping! You haven't reached the goal yet.";
				} else if (msg.includes('telegram premium')) {
					errorMessage = 'You need an active Telegram Premium subscription.';
				} else if (msg.includes('join official telegram channel') || msg.includes('official channel')) {
					errorMessage = 'Please join the channel first.';
				} else if (msg.includes('network') || msg.includes('fetch')) {
					errorMessage = t('airdrop.tasks.errors.network') || 'Network error.';
				}
			}
			setTaskErrors((prev) => ({ ...prev, [key]: errorMessage }));
			try {
				hapticFeedback.notificationOccurred('error');
			} catch (_) {}
		} finally {
			setLoadingKeys((prev) => ({ ...prev, [key]: false }));
		}
	};

	const handleQuizSubmit = async (e: Event) => {
		e.preventDefault();
		const task = activeQuizTask();
		if (!task) return;

		const answer = quizAnswerInput().trim();
		if (!answer) {
			setQuizError('Answer cannot be empty.');
			return;
		}

		setQuizError('');
		const key = task.key;
		setLoadingKeys((prev) => ({ ...prev, [key]: true }));

		try {
			const result = await completeTask(key, answer);
			if (result) {
				try {
					hapticFeedback.notificationOccurred('success');
				} catch (_) {}
				tasksQuery.refetch();
				await syncProfileStats();
				setActiveQuizTask(null);
			} else {
				throw new Error('empty_response');
			}
		} catch (e: any) {
			console.error('Failed to complete quiz task:', e);
			let errorMessage = 'Incorrect answer. Please try again.';
			if (e?.message) {
				const msg = e.message.toLowerCase();
				if (msg.includes('incorrect')) {
					errorMessage = 'Incorrect answer. Please try again.';
				} else if (msg.includes('network') || msg.includes('fetch')) {
					errorMessage = t('airdrop.tasks.errors.network') || 'Network error.';
				} else {
					errorMessage = e.message;
				}
			}
			setQuizError(errorMessage);
			try {
				hapticFeedback.notificationOccurred('error');
			} catch (_) {}
		} finally {
			setLoadingKeys((prev) => ({ ...prev, [key]: false }));
		}
	};

	const getTaskDetails = (task: TaskStatus) => {
		const key = task.key;
		switch (key) {
			case 'league_gold':
				return { title: t('airdropFinal.tasks.leagueGold') || task.title, icon: '🏆' };
			case 'join_clan':
				return { title: t('airdropFinal.tasks.joinClan') || task.title, icon: '🛡️' };
			case 'invite_1_fren':
				return { title: t('airdropFinal.tasks.invite1') || task.title, icon: '🤝' };
			case 'invite_3_frens':
				return { title: t('airdropFinal.tasks.invite3') || task.title, icon: '👥' };
			case 'invite_10_frens':
				return { title: t('airdropFinal.tasks.invite10') || task.title, icon: '💎' };
			case 'taps_100k':
				return { title: t('airdropFinal.tasks.taps100k') || task.title, icon: '👆' };
			case 'telegram_premium':
				return { title: t('airdropFinal.tasks.premium') || task.title, icon: '⭐️' };
			case 'join_ifragment_channel':
				return { title: t('airdropFinal.tasks.joinChannel') || task.title, icon: '📣' };
			default:
				let icon = '🎁';
				if (task.type === 'channel_join' || key.includes('channel') || key.includes('telegram')) {
					icon = '📣';
				} else if (task.type === 'quiz' || key.includes('quiz') || key.includes('question')) {
					icon = '❓';
				} else if (key.includes('invite') || key.includes('fren')) {
					icon = '🤝';
				}
				return { title: task.title || t('airdropFinal.tasks.specialTask'), icon };
		}
	};

	const formatCoins = (coins: number) => {
		if (coins >= 1000) return `+${coins / 1000}k`;
		return `+${coins}`;
	};

	return (
		<div class="flex-1 overflow-y-auto no-scrollbar bg-black text-white flex flex-col font-sans pb-28 relative">
			{/* Clean Header */}
			<div class="px-5 pt-14 pb-4 flex flex-col items-center">
				<div class="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-4">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<circle cx="12" cy="12" r="10" fill="#F5A623"/>
						<circle cx="12" cy="12" r="7" fill="#F5A623" stroke="#FFF7D6" stroke-width="1.5" stroke-opacity="0.5"/>
						<path d="M11 8V16M8 10H16M8 14H16" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</div>
				<h1 class="text-[40px] font-bold tracking-tight mb-2 text-center text-white">
					{t('airdropFinal.tasks.title')}
				</h1>
				<p class="text-[#8e8e93] text-[15px] text-center font-normal">
					{t('airdropFinal.tasks.subtitle')}
				</p>
			</div>

			{/* Tasks List */}
			<div class="px-5 mt-6 flex flex-col">
				<h2 class="text-[17px] font-semibold text-white mb-4">
					{t('airdropFinal.tasks.tasksTab')}
				</h2>

				<div class="bg-[#1c1c1e] rounded-[24px] px-4 py-2 overflow-hidden flex flex-col">
					<Show
						when={!tasksQuery.isLoading}
						fallback={
							<div class="w-full py-12 flex justify-center">
								<div class="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
							</div>
						}
					>
						<Show
							when={!tasksQuery.isError}
							fallback={
								<div class="py-8 text-center flex flex-col items-center">
									<span class="text-[#8e8e93] text-[15px]">{t('airdropFinal.tasks.failedLoad')}</span>
									<button onClick={() => tasksQuery.refetch()} class="mt-4 px-6 py-2 bg-white text-black rounded-full font-semibold">
										{t('airdropFinal.tasks.retryBtn')}
									</button>
								</div>
							}
						>
							<Show
								when={tasksQuery.data && tasksQuery.data.length > 0}
								fallback={
									<div class="py-8 text-center text-[#8e8e93] text-[15px]">
										{t('airdropFinal.tasks.noTasks')}
									</div>
								}
							>
								<For each={tasksQuery.data?.filter(t => !t.parent_key)}>
									{(task, index) => {
										const details = getTaskDetails(task);
										const isLast = index() === (tasksQuery.data?.filter(t => !t.parent_key).length || 0) - 1;
										return (
											<div class={`flex flex-col ${!isLast ? 'border-b border-white/5' : ''}`}>
												<button
													onClick={() => handleTaskClick(task)}
													disabled={task.completed || loadingKeys()[task.key]}
													class="w-full flex items-center justify-between py-4 text-start active:opacity-70 transition-opacity disabled:opacity-100"
												>
													<div class="flex items-center gap-4 min-w-0 flex-1">
														<div class="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center shrink-0">
															<span class="text-[24px]">{details.icon}</span>
														</div>
														<div class="flex flex-col min-w-0 pr-4">
															<span class="text-white font-medium text-[16px] truncate leading-tight mb-1">
																{details.title}
															</span>
															<span class="text-[#8e8e93] text-[14px] flex items-center gap-1">
																<span class="text-[#F5A623] text-[12px]">🟡</span>
																{formatCoins(task.reward_frg)}
															</span>
														</div>
													</div>
													<div class="shrink-0 flex items-center justify-center pl-2">
														{task.completed ? (
															<span class="material-symbols-outlined text-[#34c759] text-[28px]" style={{ 'font-variation-settings': '"FILL" 1' }}>check_circle</span>
														) : loadingKeys()[task.key] ? (
															<span class="material-symbols-outlined animate-spin text-[24px] text-[#8e8e93]">progress_activity</span>
														) : (
															<span class="material-symbols-outlined text-[24px] text-[#8e8e93]">chevron_right</span>
														)}
													</div>
												</button>
												{taskErrors()[task.key] && (
													<div class="text-[#ff453a] font-normal text-[13px] pb-3 px-1 text-center">
														{taskErrors()[task.key]}
													</div>
												)}
											</div>
										);
									}}
								</For>
							</Show>
						</Show>
					</Show>
				</div>
			</div>

			{/* QUIZ MODAL */}
			<Show when={activeQuizTask()}>
				<div class="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
					<div class="w-full max-w-sm bg-gradient-to-b from-[#1c1d22] to-[#121316] border border-white/10 rounded-[32px] p-6 shadow-2xl relative">
						<button
							onClick={() => setActiveQuizTask(null)}
							class="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all text-white/70"
						>
							<span class="material-symbols-outlined text-[18px]">close</span>
						</button>

						<div class="flex flex-col items-center text-center mt-2">
							<div class="w-16 h-16 bg-[#3390ec]/10 border border-[#3390ec]/20 rounded-2xl flex items-center justify-center mb-4 text-[32px]">
								❓
							</div>
							<h3 class="text-lg font-black text-white mb-2">
								{activeQuizTask()?.title || t('airdropFinal.tasks.specialTask')}
							</h3>
							<p class="text-[14px] text-[#a0a4ad] leading-relaxed mb-6">
								{activeQuizTask()?.config?.quiz_question || 'Solve this riddle to claim the reward!'}
							</p>
						</div>

						<form onSubmit={handleQuizSubmit} class="space-y-4">
							<div class="flex flex-col gap-1.5">
								<input
									type="text"
									required
									value={quizAnswerInput()}
									onInput={(e) => setQuizAnswerInput(e.currentTarget.value)}
									class="w-full h-12 px-4 bg-black/40 border border-white/10 focus:border-[#3390ec] text-white text-sm font-semibold rounded-2xl focus:outline-none transition-all text-center"
									placeholder="پاسخ را وارد کنید..."
									autofocus
								/>
							</div>

							<Show when={quizError()}>
								<p class="text-xs text-[#ff453a] font-bold text-center">
									{quizError()}
								</p>
							</Show>

							<button
								type="submit"
								disabled={loadingKeys()[activeQuizTask()!.key]}
								class="w-full h-12 bg-gradient-to-r from-[#3390ec] to-[#287ece] active:scale-95 text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
							>
								{loadingKeys()[activeQuizTask()!.key] ? (
									<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
								) : (
									t('airdrop.tasks.buttons.check') || 'Check Answer'
								)}
							</button>
						</form>
					</div>
				</div>
			</Show>

			{/* CAMPAIGN MODAL */}
			<Show when={activeCampaign()}>
				<div class="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
					<div class="w-full max-w-sm bg-gradient-to-b from-[#1c1d22] to-[#121316] border border-white/10 rounded-[32px] p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto no-scrollbar">
						<button
							onClick={() => setActiveCampaign(null)}
							class="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all text-white/70"
						>
							<span class="material-symbols-outlined text-[18px]">close</span>
						</button>

						<div class="flex flex-col items-center text-center mt-2 mb-6">
							<div class="w-16 h-16 bg-[#3390ec]/10 border border-[#3390ec]/20 rounded-2xl flex items-center justify-center mb-4 text-[32px]">
								{getTaskDetails(activeCampaign()!).icon}
							</div>
							<h3 class="text-lg font-black text-white mb-2">
								{activeCampaign()?.title}
							</h3>
							<p class="text-[14px] text-[#a0a4ad] leading-relaxed">
								تسک‌ها را کامل کنید تا جایزه باز شود!
							</p>
						</div>

						<div class="bg-[#0f1014] rounded-2xl border border-white/5 flex flex-col mb-4 overflow-hidden">
							<For each={tasksQuery.data?.filter(t => t.parent_key === activeCampaign()?.key)}>
								{(task, index) => {
									const details = getTaskDetails(task);
									const isLast = index() === (tasksQuery.data?.filter(t => t.parent_key === activeCampaign()?.key).length || 0) - 1;
									return (
										<div class={`flex flex-col ${!isLast ? 'border-b border-white/5' : ''}`}>
											<button
												onClick={() => handleTaskClick(task)}
												disabled={task.completed || loadingKeys()[task.key]}
												class="w-full flex items-center justify-between py-3 px-4 text-start active:opacity-70 transition-opacity disabled:opacity-100"
											>
												<div class="flex items-center gap-3 min-w-0 flex-1">
													<div class="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center shrink-0">
														<span class="text-[16px]">{details.icon}</span>
													</div>
													<div class="flex flex-col min-w-0 pr-2">
														<span class="text-white font-medium text-[14px] truncate leading-tight">
															{details.title}
														</span>
														<Show when={task.reward_frg > 0}>
															<span class="text-[#8e8e93] text-[12px] flex items-center gap-1 mt-0.5">
																<span class="text-[#F5A623] text-[10px]">🟡</span>
																{formatCoins(task.reward_frg)}
															</span>
														</Show>
													</div>
												</div>
												<div class="shrink-0 flex items-center justify-center">
													{task.completed ? (
														<span class="material-symbols-outlined text-[#34c759] text-[24px]" style={{ 'font-variation-settings': '"FILL" 1' }}>check_circle</span>
													) : loadingKeys()[task.key] ? (
														<span class="material-symbols-outlined animate-spin text-[20px] text-[#8e8e93]">progress_activity</span>
													) : (
														<span class="material-symbols-outlined text-[20px] text-[#8e8e93]">chevron_right</span>
													)}
												</div>
											</button>
										</div>
									);
								}}
							</For>
						</div>

						<button
							onClick={() => handleTaskClick(activeCampaign()!)}
							disabled={activeCampaign()?.completed || loadingKeys()[activeCampaign()!.key] || tasksQuery.data?.filter(t => t.parent_key === activeCampaign()?.key).some(t => !t.completed)}
							class="w-full h-12 bg-gradient-to-r from-[#3390ec] to-[#287ece] active:scale-95 disabled:opacity-50 disabled:active:scale-100 text-white font-black text-[15px] tracking-wider rounded-2xl shadow-lg transition-all flex items-center justify-center"
						>
							{activeCampaign()?.completed ? 'Claimed' : loadingKeys()[activeCampaign()!.key] ? 'Claiming...' : 'دریافت جایزه'}
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};
