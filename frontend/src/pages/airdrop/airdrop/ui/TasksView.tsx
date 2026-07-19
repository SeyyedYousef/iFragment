import { createQuery } from '@tanstack/solid-query';
import { hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createSignal, For, Show } from 'solid-js';
import {
	claimDailyCombo,
	completeTask,
	DailyComboStatus,
	getDailyComboStatus,
	getTasksStatus,
	TaskStatus,
} from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
import { syncProfileStats } from '@/shared/store/airdrop.js';

export const TasksView: Component = () => {
	const [taskErrors, setTaskErrors] = createSignal<Record<string, string>>({});
	const [loadingKeys, setLoadingKeys] = createSignal<Record<string, boolean>>({});
	const [activeQuizTask, setActiveQuizTask] = createSignal<TaskStatus | null>(null);
	const [activeCampaign, setActiveCampaign] = createSignal<TaskStatus | null>(null);
	const [quizAnswerInput, setQuizAnswerInput] = createSignal('');
	const [quizError, setQuizError] = createSignal('');
	const [comboInput, setComboInput] = createSignal('');
	const [comboError, setComboError] = createSignal('');
	const [isSubmittingCombo, setIsSubmittingCombo] = createSignal(false);

	const comboQuery = createQuery<DailyComboStatus>(() => ({
		queryKey: ['daily-combo-status'],
		queryFn: getDailyComboStatus as () => Promise<DailyComboStatus>,
		staleTime: 60_000,
	}));

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
			let channelName = task.config?.channel_username || 'Fragmentscommunity';
			channelName = channelName.replace(/^@/, '');
			try {
				openTelegramLink(`https://t.me/${channelName}`);
			} catch (_) {
				window.open(`https://t.me/${channelName}`, '_blank');
			}
			// Timeout for channel redirection before triggering verification
			await new Promise((resolve) => setTimeout(resolve, 800));
		} else if (task.type === 'link' || task.type === 'social') {
			const targetUrl = task.config?.url;
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
			await new Promise((resolve) => setTimeout(resolve, 4000));
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
					errorMessage = e.message;
				} else if (msg.includes('total taps')) {
					errorMessage = 'Keep tapping! Goal not reached yet.';
				} else if (msg.includes('telegram premium')) {
					errorMessage = 'Active Telegram Premium subscription required.';
				} else if (
					msg.includes('join official telegram channel') ||
					msg.includes('official channel')
				) {
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

	const handleComboSubmit = async (e: Event) => {
		e.preventDefault();
		const answer = comboInput().trim();
		if (!answer) {
			setComboError('Secret word cannot be empty.');
			return;
		}

		setComboError('');
		setIsSubmittingCombo(true);

		try {
			const success = await claimDailyCombo(answer);
			if (success) {
				try {
					hapticFeedback.notificationOccurred('success');
				} catch (_) {}
				comboQuery.refetch();
				await syncProfileStats();
				setComboInput('');
			}
		} catch (e: any) {
			console.error('Failed to claim daily combo:', e);
			let errorMessage = 'Incorrect word. Please try again.';
			if (e?.message) {
				const msg = e.message.toLowerCase();
				if (msg.includes('already claimed')) {
					errorMessage = 'Already claimed today!';
				} else if (msg.includes('incorrect')) {
					errorMessage = 'Incorrect word. Please try again.';
				} else {
					errorMessage = e.message;
				}
			}
			setComboError(errorMessage);
			try {
				hapticFeedback.notificationOccurred('error');
			} catch (_) {}
		} finally {
			setIsSubmittingCombo(false);
		}
	};

	const getTaskDetails = (task: TaskStatus) => {
		const key = task.key;
		switch (key) {
			case 'league_gold':
				return { title: t('airdropFinal.tasks.leagueGold') || task.title, icon: 'emoji_events' };
			case 'join_clan':
				return { title: t('airdropFinal.tasks.joinClan') || task.title, icon: 'shield' };
			case 'invite_1_fren':
				return { title: t('airdropFinal.tasks.invite1') || task.title, icon: 'person_add' };
			case 'invite_3_frens':
				return { title: t('airdropFinal.tasks.invite3') || task.title, icon: 'group_add' };
			case 'invite_10_frens':
				return { title: t('airdropFinal.tasks.invite10') || task.title, icon: 'groups' };
			case 'taps_100k':
				return { title: t('airdropFinal.tasks.taps100k') || task.title, icon: 'touch_app' };
			case 'telegram_premium':
				return { title: t('airdropFinal.tasks.premium') || task.title, icon: 'stars' };
			case 'join_ifragment_channel':
				return { title: t('airdropFinal.tasks.joinChannel') || task.title, icon: 'podcasts' };
			default: {
				let icon = 'card_giftcard';
				if (task.type === 'channel_join' || key.includes('channel') || key.includes('telegram')) {
					icon = 'podcasts';
				} else if (task.type === 'quiz' || key.includes('quiz') || key.includes('question')) {
					icon = 'help';
				} else if (key.includes('invite') || key.includes('fren')) {
					icon = 'group_add';
				}
				return { title: task.title || t('airdropFinal.tasks.specialTask'), icon };
			}
		}
	};

	const formatCoins = (coins: number) => {
		if (coins >= 1000) return `+${coins / 1000}k`;
		return `+${coins}`;
	};

	return (
		<div
			class="flex-1 overflow-y-auto no-scrollbar pb-32 relative bg-[#08090d] text-white selection:bg-[#0098ea]/30"
			style={{ background: 'radial-gradient(ellipse at 50% 0%, #0c1220 0%, #08090d 100%)' }}
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			<div class="max-w-md mx-auto">
				{/* Header Section */}
				<div class="px-5 pt-8 pb-3 flex flex-col items-center relative">
					<div class="w-16 h-16 bg-[#121622] rounded-2xl border border-[#0098ea]/30 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(0,152,234,0.15)] shrink-0">
						<span class="material-symbols-outlined text-[34px] text-[#0098ea]">task_alt</span>
					</div>
					<h1 class="text-2xl font-black tracking-tight mb-1 text-center text-white">
						{t('airdropFinal.tasks.title')}
					</h1>
					<p class="text-white/50 text-[13px] text-center font-medium max-w-xs leading-relaxed">
						{t('airdropFinal.tasks.subtitle')}
					</p>
				</div>

				{/* Daily Combo Section */}
				<Show when={comboQuery.data?.is_active}>
					<div class="px-4 mt-2">
						<div class="bg-[#10141e] rounded-2xl p-4 flex flex-col items-center relative border border-amber-400/30 shadow-2xl">
							<h3 class="text-white text-base font-black mb-1 z-10 flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400 text-lg">extension</span>{' '}
								Daily Combo
							</h3>
							<p class="text-white/50 text-xs text-center mb-3 z-10 flex items-center justify-center gap-1 font-medium">
								Guess secret word & earn
								<span class="text-amber-400 font-mono font-bold text-xs flex items-center gap-0.5">
									+{formatCoins(comboQuery.data?.reward || 0)} 🪙
								</span>
							</p>

							<Show
								when={!comboQuery.data?.is_claimed}
								fallback={
									<div class="w-full py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col items-center justify-center z-10">
										<span class="text-emerald-400 font-bold text-xs">Reward Claimed!</span>
										<span class="text-white/40 text-[11px] font-mono mt-0.5">
											Come back tomorrow for a new code.
										</span>
									</div>
								}
							>
								<form onSubmit={handleComboSubmit} class="w-full flex flex-col gap-2.5 z-10">
									<input
										type="text"
										placeholder="Enter secret word..."
										value={comboInput()}
										onInput={(e) => setComboInput(e.target.value)}
										class="w-full bg-[#161b28] border border-white/10 rounded-xl py-2.5 px-4 text-white placeholder-white/20 text-center font-mono font-bold text-sm focus:outline-none focus:border-amber-400 transition-colors"
										disabled={isSubmittingCombo()}
									/>
									<Show when={comboError()}>
										<span class="text-red-400 text-[11px] text-center bg-red-400/10 py-1 px-3 rounded-lg border border-red-400/20 font-bold">
											{comboError()}
										</span>
									</Show>
									<button
										type="submit"
										disabled={!comboInput().trim() || isSubmittingCombo()}
										class="w-full h-11 bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs uppercase tracking-wider rounded-xl active:scale-[0.98] transition-all disabled:opacity-40 flex justify-center items-center gap-2 shadow-md"
									>
										<Show when={isSubmittingCombo()} fallback="Verify Secret Word">
											<div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
											Verifying...
										</Show>
									</button>
								</form>
							</Show>
						</div>
					</div>
				</Show>

				{/* Tasks List Container */}
				<div class="px-4 mt-5 flex flex-col">
					<div class="text-[11px] font-mono font-bold uppercase tracking-widest text-white/40 mb-2 px-1">
						{t('airdropFinal.tasks.tasksTab')}
					</div>

					<div class="bg-[#10141e] rounded-2xl p-2 flex flex-col border border-white/[0.08] shadow-2xl">
						<Show
							when={!tasksQuery.isLoading}
							fallback={
								<div class="w-full py-12 flex items-center justify-center gap-2">
									<div class="w-6 h-6 border-2 border-white/10 border-t-[#0098ea] rounded-full animate-spin" />
									<span class="text-xs font-mono text-white/30">Loading Tasks...</span>
								</div>
							}
						>
							<Show
								when={!tasksQuery.isError}
								fallback={
									<div class="py-8 text-center flex flex-col items-center">
										<span class="text-white/40 text-xs">{t('airdropFinal.tasks.failedLoad')}</span>
										<button
											onClick={() => tasksQuery.refetch()}
											class="mt-3 px-5 py-2 bg-[#0098ea] text-white rounded-xl font-bold text-xs"
										>
											{t('airdropFinal.tasks.retryBtn')}
										</button>
									</div>
								}
							>
								<Show
									when={tasksQuery.data && tasksQuery.data.length > 0}
									fallback={
										<div class="py-8 text-center text-white/30 text-xs font-medium">
											{t('airdropFinal.tasks.noTasks')}
										</div>
									}
								>
									<For each={tasksQuery.data?.filter((t) => !t.parent_key)}>
										{(task, index) => {
											const details = getTaskDetails(task);
											const isLast =
												index() === (tasksQuery.data?.filter((t) => !t.parent_key).length || 0) - 1;

											// Progress calculation
											const hasProgress =
												typeof task.progress_target === 'number' && task.progress_target > 0;
											const progressCurrent =
												typeof task.progress_current === 'number' ? task.progress_current : 0;
											const progressTarget = task.progress_target || 1;
											let progressPercent = hasProgress
												? Math.min(100, Math.round((progressCurrent / progressTarget) * 100))
												: 0;
											if (hasProgress && progressCurrent > 0 && !task.completed) {
												progressPercent = Math.max(15, progressPercent);
											}
											const isPremium = task.is_premium_req;

											const actionText = task.action_text || '';
											let btnText = 'Start';
											if (task.type === 'channel_join') btnText = 'Join';
											else if (task.type === 'quiz') btnText = 'Solve';
											else if (hasProgress && progressCurrent >= progressTarget) btnText = 'Claim';
											else if (task.type === 'link' || task.type === 'social') btnText = 'Go';

											return (
												<div
													class={`flex flex-col relative overflow-hidden ${!isLast ? 'border-b border-white/[0.06]' : ''}`}
												>
													<button
														onClick={() => handleTaskClick(task)}
														disabled={task.completed || loadingKeys()[task.key]}
														class={`w-full flex flex-col py-3 px-2 text-start transition-all disabled:opacity-100 hover:bg-[#151a28] rounded-xl my-0.5 ${isPremium && !task.completed ? 'bg-amber-400/[0.04] border border-amber-400/20' : ''}`}
													>
														<div class="flex items-center justify-between w-full">
															<div class="flex items-center gap-3 min-w-0 flex-1 pr-2">
																<div
																	class={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${isPremium && !task.completed ? 'bg-amber-400/15 border-amber-400/30 text-amber-400' : 'bg-[#161b28] border-white/10 text-white/80'}`}
																>
																	<span class="material-symbols-outlined text-[20px]">
																		{details.icon}
																	</span>
																</div>

																<div class="flex flex-col min-w-0">
																	<div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
																		<span class="text-white font-semibold text-[14px] truncate leading-tight tracking-tight">
																			{details.title}
																		</span>
																		{isPremium && !task.completed && (
																			<span class="text-amber-400 text-[9px] bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded-md font-mono font-bold uppercase">
																				STAR ⭐️
																			</span>
																		)}
																	</div>

																	<div class="flex items-center gap-2 flex-wrap">
																		<span class="text-amber-400 font-mono font-bold text-xs flex items-center gap-0.5 shrink-0">
																			<span>🪙</span>
																			<span>{formatCoins(task.reward_frg)}</span>
																		</span>

																		{(actionText || (task.config as any)?.channel_username) && (
																			<span
																				class="text-[#0098ea] bg-[#0098ea]/10 border border-[#0098ea]/20 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold truncate max-w-[150px] flex items-center gap-1"
																				dir="ltr"
																			>
																				<span class="material-symbols-outlined text-[11px]">
																					podcasts
																				</span>
																				{(task.config as any)?.channel_username
																					? `@${(task.config as any).channel_username}`
																					: actionText}
																			</span>
																		)}
																	</div>
																</div>
															</div>

															<div class="shrink-0 flex items-center justify-center pl-2">
																{task.completed ? (
																	<span class="material-symbols-outlined text-emerald-400 text-[24px]">
																		check_circle
																	</span>
																) : loadingKeys()[task.key] ? (
																	<span class="material-symbols-outlined animate-spin text-[20px] text-white/40">
																		progress_activity
																	</span>
																) : (
																	<div
																		class={`px-3.5 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 ${isPremium ? 'bg-amber-400 text-black hover:bg-amber-300' : 'bg-[#0098ea] text-white hover:bg-[#0088d4]'}`}
																	>
																		{btnText}
																	</div>
																)}
															</div>
														</div>

														{/* Progress Bar */}
														<Show when={hasProgress && !task.completed}>
															<div class="w-full mt-2.5 flex items-center gap-2.5 px-1">
																<div class="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden p-[1px]">
																	<div
																		class="h-full bg-[#0098ea] rounded-full transition-all duration-500 ease-out"
																		style={{ width: `${progressPercent}%` }}
																	/>
																</div>
																<span class="text-[10px] font-mono font-bold text-white/40 shrink-0 text-right">
																	{progressCurrent >= 1000
																		? `${(progressCurrent / 1000).toFixed(1)}k`
																		: progressCurrent}{' '}
																	/{' '}
																	{progressTarget >= 1000
																		? `${(progressTarget / 1000).toFixed(1)}k`
																		: progressTarget}
																</span>
															</div>
														</Show>
													</button>

													{taskErrors()[task.key] && (
														<div class="text-red-400 font-semibold text-xs py-1.5 px-3 text-center bg-red-400/10 rounded-xl mx-2 mb-2 border border-red-400/20">
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
			</div>

			{/* QUIZ MODAL */}
			<Show when={activeQuizTask()}>
				<div class="fixed inset-0 z-[9999] flex items-center justify-center p-5 bg-black/80 backdrop-blur-md animate-fade-in">
					<div class="w-full max-w-sm bg-[#10141e] border border-white/10 rounded-2xl p-6 shadow-2xl relative">
						<button
							onClick={() => setActiveQuizTask(null)}
							class="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all text-white/60"
						>
							<span class="material-symbols-outlined text-[18px]">close</span>
						</button>

						<div class="flex flex-col items-center text-center mt-1">
							<div class="w-14 h-14 bg-[#0098ea]/15 border border-[#0098ea]/30 rounded-2xl flex items-center justify-center mb-3 text-2xl">
								❓
							</div>
							<h3 class="text-base font-black text-white mb-1.5">
								{activeQuizTask()?.title || t('airdropFinal.tasks.specialTask')}
							</h3>
							<p class="text-xs text-white/60 leading-relaxed mb-5 font-medium">
								{activeQuizTask()?.config?.quiz_question ||
									'Solve this riddle to claim the reward!'}
							</p>
						</div>

						<form onSubmit={handleQuizSubmit} class="space-y-3">
							<input
								type="text"
								required
								value={quizAnswerInput()}
								onInput={(e) => setQuizAnswerInput(e.currentTarget.value)}
								class="w-full h-11 px-4 bg-[#161b28] border border-white/10 focus:border-[#0098ea] text-white text-sm font-semibold rounded-xl focus:outline-none transition-all text-center font-mono"
								placeholder="Enter answer..."
								autofocus
							/>

							<Show when={quizError()}>
								<p class="text-xs text-red-400 font-semibold text-center bg-red-400/10 py-1 rounded-lg border border-red-400/20">
									{quizError()}
								</p>
							</Show>

							<button
								type="submit"
								disabled={loadingKeys()[activeQuizTask()!.key]}
								class="w-full h-11 bg-[#0098ea] hover:bg-[#0088d4] active:scale-95 text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-white"
							>
								{loadingKeys()[activeQuizTask()!.key] ? (
									<span class="material-symbols-outlined animate-spin text-[18px]">
										progress_activity
									</span>
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
				<div class="fixed inset-0 z-[9999] flex items-center justify-center p-5 bg-black/80 backdrop-blur-md animate-fade-in">
					<div class="w-full max-w-sm bg-[#10141e] border border-white/10 rounded-2xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto no-scrollbar">
						<button
							onClick={() => setActiveCampaign(null)}
							class="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all text-white/60"
						>
							<span class="material-symbols-outlined text-[18px]">close</span>
						</button>

						<div class="flex flex-col items-center text-center mt-1 mb-5">
							<div class="w-14 h-14 bg-[#0098ea]/15 border border-[#0098ea]/30 rounded-2xl flex items-center justify-center mb-3 text-white">
								<span class="material-symbols-outlined text-2xl">
									{getTaskDetails(activeCampaign()!).icon}
								</span>
							</div>
							<h3 class="text-base font-black text-white mb-1">{activeCampaign()?.title}</h3>
							<p class="text-xs text-white/50 font-medium">
								Complete sub-tasks to unlock campaign rewards.
							</p>
						</div>

						<div class="bg-[#161b28] rounded-xl border border-white/10 flex flex-col mb-4 overflow-hidden">
							<For each={tasksQuery.data?.filter((t) => t.parent_key === activeCampaign()?.key)}>
								{(task, index) => {
									const details = getTaskDetails(task);
									const isLast =
										index() ===
										(tasksQuery.data?.filter((t) => t.parent_key === activeCampaign()?.key)
											.length || 0) -
											1;
									return (
										<div class={`flex flex-col ${!isLast ? 'border-b border-white/10' : ''}`}>
											<button
												onClick={() => handleTaskClick(task)}
												disabled={task.completed || loadingKeys()[task.key]}
												class="w-full flex items-center justify-between py-3 px-3.5 text-start active:bg-white/5 transition-colors disabled:opacity-100"
											>
												<div class="flex items-center gap-3 min-w-0 flex-1 pr-2">
													<div class="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center shrink-0 border border-white/10">
														<span class="material-symbols-outlined text-[16px]">
															{details.icon}
														</span>
													</div>
													<div class="flex flex-col min-w-0 pr-1">
														<span class="text-white font-medium text-xs truncate">
															{details.title}
														</span>
														<Show when={task.reward_frg > 0}>
															<span class="text-amber-400 font-mono font-bold text-[11px] flex items-center gap-0.5 mt-0.5">
																<span>🪙</span> {formatCoins(task.reward_frg)}
															</span>
														</Show>
													</div>
												</div>
												<div class="shrink-0 flex items-center justify-center">
													{task.completed ? (
														<span class="material-symbols-outlined text-emerald-400 text-[20px]">
															check_circle
														</span>
													) : loadingKeys()[task.key] ? (
														<span class="material-symbols-outlined animate-spin text-[18px] text-white/40">
															progress_activity
														</span>
													) : (
														<span class="material-symbols-outlined text-[18px] text-white/30">
															chevron_right
														</span>
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
							disabled={
								activeCampaign()?.completed ||
								loadingKeys()[activeCampaign()!.key] ||
								tasksQuery.data
									?.filter((t) => t.parent_key === activeCampaign()?.key)
									.some((t) => !t.completed)
							}
							class="w-full h-11 bg-[#0098ea] hover:bg-[#0088d4] active:scale-95 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center"
						>
							{activeCampaign()?.completed
								? 'Claimed'
								: loadingKeys()[activeCampaign()!.key]
									? 'Claiming...'
									: 'Claim Reward'}
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};
