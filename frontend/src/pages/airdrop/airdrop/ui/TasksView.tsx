import { createQuery } from '@tanstack/solid-query';
import { openTelegramLink } from '@tma.js/sdk-solid';
import { type Component, createSignal, For, Show } from 'solid-js';
import { balance, syncProfileStats } from '@/entities/airdrop/index.js';
import {
	claimDailyCombo,
	completeTask,
	type DailyComboStatus,
	getDailyComboStatus,
	getTasksStatus,
	type TaskStatus,
} from '@/entities/user/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { flyCoinsToBalance } from '@/shared/ui/index.js';

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

	const handleTaskClick = async (task: TaskStatus, event?: MouseEvent | PointerEvent) => {
		if (task.completed) return;
		const key = task.key;

		setTaskErrors((prev) => ({ ...prev, [key]: '' }));

		haptic.impact('medium');

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

		if (task.type === 'channel_join' || key === 'join_ifragment_channel') {
			let channelName = task.config?.channel_username || 'Fragmentscommunity';
			channelName = channelName.replace(/^@/, '');
			try {
				openTelegramLink(`https://t.me/${channelName}`);
			} catch (_) {
				window.open(`https://t.me/${channelName}`, '_blank');
			}
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
				tasksQuery.refetch();
				await syncProfileStats();
				const rewardAmount = task.reward_frg || 1000;
				const sx = event?.clientX ?? window.innerWidth / 2;
				const sy = event?.clientY ?? window.innerHeight / 2;
				flyCoinsToBalance({
					amount: rewardAmount,
					startX: sx,
					startY: sy,
					targetSelector: '#airdrop-tasks-balance',
				});
			} else {
				throw new Error('empty_response');
			}
		} catch (e: any) {
			console.error('Failed to complete task:', e);
			const raw = e?.message || String(e || '');
			let errorMessage = t('airdrop.tasks.errors.default', {
				defaultValue: 'Failed to verify task',
			});
			if (raw.includes('ERR_NEED_GOLD_LEAGUE') || raw.toLowerCase().includes('gold league')) {
				errorMessage = t('airdrop.tasks.errors.needGoldLeague', {
					defaultValue: 'You need to reach Gold league first.',
				});
			} else if (raw.includes('ERR_NEED_CLAN') || raw.toLowerCase().includes('join a clan')) {
				errorMessage = t('airdrop.tasks.errors.needClan', {
					defaultValue: 'You need to join a squad first.',
				});
			} else if (raw.includes('ERR_NEED_FRENS_COUNT')) {
				const count = raw.split(':')[1] || '3';
				errorMessage = t('airdrop.tasks.errors.needFrens', {
					count,
					defaultValue: `Invite at least ${count} friends first.`,
				});
			} else if (raw.includes('ERR_NEED_100K_TAPS') || raw.toLowerCase().includes('total taps')) {
				errorMessage = t('airdrop.tasks.errors.need100kTaps', {
					defaultValue: 'Keep tapping! 100,000 taps required.',
				});
			} else if (
				raw.includes('ERR_NEED_TG_PREMIUM') ||
				raw.toLowerCase().includes('telegram premium')
			) {
				errorMessage = t('airdrop.tasks.errors.needTgPremium', {
					defaultValue: 'Active Telegram Premium subscription required.',
				});
			} else if (
				raw.includes('ERR_NEED_CHANNEL_JOIN') ||
				raw.toLowerCase().includes('official channel')
			) {
				errorMessage = t('airdrop.tasks.errors.needChannelJoin', {
					defaultValue: 'Please join the channel first.',
				});
			} else if (raw.includes('ERR_MEMBERSHIP_PENDING')) {
				errorMessage = t('airdrop.tasks.errors.membershipPending', {
					defaultValue: 'Verification in progress, please wait...',
				});
			}
			setTaskErrors((prev) => ({ ...prev, [key]: errorMessage }));
			haptic.notify('error');
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
				haptic.notify('success');
				tasksQuery.refetch();
				await syncProfileStats();
				const rewardAmount = task.reward_frg || 5000;
				flyCoinsToBalance({
					amount: rewardAmount,
					startX: window.innerWidth / 2,
					startY: window.innerHeight / 2,
					targetSelector: '#airdrop-tasks-balance',
				});
				setActiveQuizTask(null);
			} else {
				throw new Error('empty_response');
			}
		} catch (e: any) {
			console.error('Failed to complete quiz task:', e);
			let errorMessage = 'Incorrect answer. Please try again.';
			if (e?.message) {
				const msg = e.message.toLowerCase();
				if (msg.includes('incorrect')) errorMessage = 'Incorrect answer. Please try again.';
				else if (msg.includes('network') || msg.includes('fetch'))
					errorMessage = t('airdrop.tasks.errors.network') || 'Network error.';
				else errorMessage = e.message;
			}
			setQuizError(errorMessage);
			haptic.notify('error');
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
				haptic.notify('success');
				comboQuery.refetch();
				await syncProfileStats();
				const rewardAmount = comboQuery.data?.reward || 10000;
				flyCoinsToBalance({
					amount: rewardAmount,
					startX: window.innerWidth / 2,
					startY: window.innerHeight / 2,
					targetSelector: '#airdrop-tasks-balance',
				});
				setComboInput('');
			}
		} catch (e: any) {
			console.error('Failed to claim daily combo:', e);
			let errorMessage = 'Incorrect word. Please try again.';
			if (e?.message) {
				const msg = e.message.toLowerCase();
				if (msg.includes('already claimed')) errorMessage = 'Already claimed today!';
				else if (msg.includes('incorrect')) errorMessage = 'Incorrect word. Please try again.';
				else errorMessage = e.message;
			}
			setComboError(errorMessage);
			haptic.notify('error');
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
				if (task.type === 'channel_join' || key.includes('channel') || key.includes('telegram'))
					icon = 'podcasts';
				else if (task.type === 'quiz' || key.includes('quiz') || key.includes('question'))
					icon = 'help';
				else if (key.includes('invite') || key.includes('fren')) icon = 'group_add';
				return { title: task.title || t('airdropFinal.tasks.specialTask'), icon };
			}
		}
	};

	const formatCoins = (coins: number) => (coins >= 1000 ? `+${coins / 1000}k` : `+${coins}`);

	return (
		<div
			class="flex-1 w-full max-w-full overflow-x-hidden no-scrollbar pb-32 relative bg-[#030303] text-white selection:bg-[#3390ec]/30"
			dir={t('dir' as any) === 'rtl' ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow - Contained in overflow-hidden wrapper */}
			<div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
				<div class="absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-b from-[#3390ec]/15 via-[#3390ec]/5 to-transparent blur-[80px]" />
			</div>

			<div class="max-w-md mx-auto relative z-10 pt-3 flex flex-col gap-4">
				{/* ═══════ TOP BALANCE PILL ═══════ */}
				<div class="px-5 flex items-center justify-center">
					<div
						id="airdrop-tasks-balance"
						class="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#12141C]/90 border border-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all duration-200 group"
					>
						<div class="w-6 h-6 rounded-full bg-gradient-to-b from-[#FFD700] via-[#F7B733] to-[#FC4A1A] flex items-center justify-center shrink-0 border border-[#FFE885] shadow-inner">
							<span class="text-[#4A2500] text-[13px] font-black leading-none select-none">¢</span>
						</div>
						<div class="flex items-center gap-2 font-mono">
							<span class="text-white/50 text-[11px] font-bold uppercase tracking-wider">BALANCE</span>
							<span class="text-white font-black text-[18px] tabular-nums tracking-tight">
								{balance().toLocaleString('en-US')}
							</span>
						</div>
					</div>
				</div>

				{/* ═══════ HEADER ═══════ */}
				<div class="px-5 flex flex-col items-center text-center">
					<div class="w-16 h-16 bg-gradient-to-br from-[#12141C] to-[#08090D] rounded-[20px] border-[1.5px] border-[#3390ec]/30 flex items-center justify-center mb-3 shadow-[inset_0_2px_12px_rgba(255,255,255,0.05),0_10px_30px_rgba(51,144,236,0.2)]">
						<span class="material-symbols-outlined text-[36px] text-[#3390ec] drop-shadow-md">
							task_alt
						</span>
					</div>
					<h1 class="text-[22px] font-black tracking-tight mb-1 text-white drop-shadow-sm">
						{t('airdropFinal.tasks.title')}
					</h1>
					<p class="text-white/60 text-[12px] font-medium max-w-[280px] leading-relaxed">
						{t('airdropFinal.tasks.subtitle')}
					</p>
				</div>

				{/* ═══════ DAILY COMBO CARD (Premium Edition) ═══════ */}
				<Show when={comboQuery.data?.is_active}>
					<div class="px-4">
						<div class="bg-gradient-to-b from-[#1c1608] to-[#12141C] rounded-[28px] p-5 flex flex-col items-center relative border border-amber-400/20 shadow-[0_12px_40px_rgba(0,0,0,0.4)] overflow-hidden">
							{/* Golden Inner Glow */}
							<div class="absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

							<h3 class="text-white text-[17px] font-black mb-1.5 z-10 flex items-center gap-2 drop-shadow-md">
								<span class="material-symbols-outlined text-amber-400 text-[20px]">extension</span>
								{t('tasks.dailyCombo')}
							</h3>
							<p class="text-white/60 text-[12px] text-center mb-4 z-10 flex items-center justify-center gap-1.5 font-medium">
								{t('tasks.guessSecretWord')}
								<span class="bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md text-amber-400 font-mono font-bold text-[11px] flex items-center gap-0.5 shadow-sm">
									{formatCoins(comboQuery.data?.reward || 0)} 🪙
								</span>
							</p>

							<Show
								when={!comboQuery.data?.is_claimed}
								fallback={
									<div class="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-[18px] flex flex-col items-center justify-center z-10 shadow-inner">
										<span class="material-symbols-outlined text-emerald-400 text-[24px] mb-1">
											check_circle
										</span>
										<span class="text-emerald-400 font-black text-[13px] tracking-wide">
											{t('tasks.rewardClaimed')}
										</span>
										<span class="text-emerald-400/60 text-[11px] font-mono mt-1">
											{t('tasks.comeBackTomorrow')}
										</span>
									</div>
								}
							>
								<form onSubmit={handleComboSubmit} class="w-full flex flex-col gap-3 z-10">
									<div class="relative">
										<input
											type="text"
											placeholder={t('tasks.enterSecretWord')}
											value={comboInput()}
											onInput={(e) => setComboInput(e.target.value)}
											class="w-full bg-[#08090D] border border-amber-400/20 focus:border-amber-400 rounded-[16px] py-3.5 px-4 text-amber-50 placeholder-white/20 text-center font-mono font-bold text-[14px] outline-none transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
											disabled={isSubmittingCombo()}
										/>
									</div>
									<Show when={comboError()}>
										<div class="text-[#ff4a4a] text-[11px] text-center bg-[#ff4a4a]/10 py-1.5 px-3 rounded-[10px] border border-[#ff4a4a]/20 font-bold flex items-center justify-center gap-1">
											<span class="material-symbols-outlined text-[14px]">error</span>{' '}
											{comboError()}
										</div>
									</Show>
									<button
										type="submit"
										disabled={!comboInput().trim() || isSubmittingCombo()}
										class="w-full h-14 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-black text-[13px] uppercase tracking-widest rounded-[16px] active:scale-95 transition-all disabled:opacity-40 disabled:scale-100 flex justify-center items-center gap-2 shadow-[0_8px_20px_rgba(245,158,11,0.3)]"
									>
										<Show when={isSubmittingCombo()} fallback="Verify Code">
											<div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />{' '}
											Verifying...
										</Show>
									</button>
								</form>
							</Show>
						</div>
					</div>
				</Show>

				{/* ═══════ TASKS LIST ═══════ */}
				<div class="px-4 flex flex-col">
					<div class="flex items-center gap-2 px-2 mb-3">
						<span class="material-symbols-outlined text-white/40 text-[18px]">
							format_list_bulleted
						</span>
						<h2 class="text-[12px] font-mono font-black uppercase tracking-widest text-white/60">
							{t('airdropFinal.tasks.tasksTab')}
						</h2>
					</div>

					<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[28px] p-2 flex flex-col border border-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
						<Show
							when={!tasksQuery.isLoading}
							fallback={
								<div class="w-full py-16 flex flex-col items-center justify-center gap-3">
									<div class="w-8 h-8 border-[3px] border-white/10 border-t-[#3390ec] rounded-full animate-spin" />
									<span class="text-[12px] font-mono font-bold text-white/40 tracking-widest">
										{t('tasks.loadingTasks')}
									</span>
								</div>
							}
						>
							<Show
								when={!tasksQuery.isError}
								fallback={
									<div class="py-12 text-center flex flex-col items-center">
										<span class="text-[#ff4a4a]/80 text-[13px] font-bold mb-3">
											{t('airdropFinal.tasks.failedLoad')}
										</span>
										<button
											type="button"
											onClick={() => tasksQuery.refetch()}
											class="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-[14px] font-bold text-[12px] border border-white/10 transition-all"
										>
											{t('airdropFinal.tasks.retryBtn')}
										</button>
									</div>
								}
							>
								<Show
									when={tasksQuery.data && tasksQuery.data.length > 0}
									fallback={
										<div class="py-12 text-center text-white/40 text-[13px] font-medium border border-dashed border-white/10 rounded-[20px] m-2">
											{t('airdropFinal.tasks.noTasks')}
										</div>
									}
								>
									<div class="flex flex-col gap-1.5">
										<For each={tasksQuery.data?.filter((t) => !t.parent_key)}>
											{(task) => {
												const details = getTaskDetails(task);
												const hasProgress =
													typeof task.progress_target === 'number' && task.progress_target > 0;
												const progressCurrent =
													typeof task.progress_current === 'number' ? task.progress_current : 0;
												const progressTarget = task.progress_target || 1;
												let progressPercent = hasProgress
													? Math.min(100, Math.round((progressCurrent / progressTarget) * 100))
													: 0;
												if (hasProgress && progressCurrent > 0 && !task.completed)
													progressPercent = Math.max(15, progressPercent);

												const isPremium = task.is_premium_req;
												const actionText = task.action_text || '';
												let btnText = 'START';
												if (task.type === 'channel_join') btnText = 'JOIN';
												else if (task.type === 'quiz') btnText = 'SOLVE';
												else if (hasProgress && progressCurrent >= progressTarget)
													btnText = 'CLAIM';
												else if (task.type === 'link' || task.type === 'social') btnText = 'GO';

												return (
													<div class="flex flex-col relative group">
														<button
															type="button"
															onClick={(e) => handleTaskClick(task, e)}
															disabled={task.completed || loadingKeys()[task.key]}
															class={`w-full flex flex-col p-3 text-start transition-all duration-300 disabled:opacity-100 rounded-[20px] border 
																${
																	task.completed
																		? 'bg-white/[0.02] border-transparent opacity-60'
																		: isPremium
																			? 'bg-gradient-to-r from-amber-400/10 to-transparent border-amber-400/20 hover:border-amber-400/40 hover:bg-amber-400/10'
																			: 'bg-[#161b28]/40 border-white/5 hover:border-white/15 hover:bg-[#1a2133]'
																}`}
														>
															<div class="flex items-center justify-between w-full">
																<div class="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
																	{/* Task Icon */}
																	<div
																		class={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 border shadow-inner transition-colors
																		${
																			task.completed
																				? 'bg-[#08090D] border-white/5 text-white/30'
																				: isPremium
																					? 'bg-gradient-to-br from-amber-400/20 to-amber-400/5 border-amber-400/40 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]'
																					: 'bg-[#08090D] border-white/10 text-white/80'
																		}`}
																	>
																		<span class="material-symbols-outlined text-[24px]">
																			{details.icon}
																		</span>
																	</div>

																	{/* Task Info */}
																	<div class="flex flex-col min-w-0 py-0.5">
																		<div class="flex items-center gap-2 mb-1 flex-wrap">
																			<span class="text-white font-bold text-[14.5px] truncate tracking-tight">
																				{details.title}
																			</span>
																			{isPremium && !task.completed && (
																				<span class="text-amber-400 text-[9px] bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded-[6px] font-mono font-black uppercase tracking-wider drop-shadow-md">
																					{t('tasks.starBadge')}
																				</span>
																			)}
																		</div>
																		<div class="flex items-center gap-2.5 flex-wrap opacity-90">
																			<span
																				class={`font-mono font-black text-[12px] flex items-center gap-0.5 shrink-0 ${task.completed ? 'text-white/40' : 'text-amber-400'}`}
																			>
																				<span>🪙</span>{' '}
																				<span>{formatCoins(task.reward_frg ?? 0)}</span>
																			</span>
																			{(actionText || (task.config as any)?.channel_username) &&
																				!task.completed && (
																					<span
																						class="text-[#3390ec] bg-[#3390ec]/10 border border-[#3390ec]/20 px-2 py-[2px] rounded-[6px] font-mono text-[10px] font-bold truncate max-w-[140px] flex items-center gap-1"
																						dir="ltr"
																					>
																						<span class="material-symbols-outlined text-[12px]">
																							podcasts
																						</span>
																						{(task.config as any)?.channel_username
																							? `@${(task.config as any).channel_username.replace(/^@+/, '')}`
																							: actionText}
																					</span>
																				)}
																		</div>
																	</div>
																</div>

																{/* Action Button / Status */}
																<div class="shrink-0 flex items-center justify-center pl-2">
																	{task.completed ? (
																		<span class="material-symbols-outlined text-emerald-500/80 text-[28px] mr-1">
																			check_circle
																		</span>
																	) : loadingKeys()[task.key] ? (
																		<span class="material-symbols-outlined animate-spin text-[22px] text-white/40 mr-2">
																			progress_activity
																		</span>
																	) : (
																		<div
																			class={`h-9 px-4 rounded-[12px] font-black text-[11px] uppercase tracking-widest flex items-center justify-center transition-all shadow-md active:scale-95
																			${isPremium ? 'bg-amber-400 text-black shadow-[0_4px_12px_rgba(251,191,36,0.3)] hover:bg-amber-300' : 'bg-[#3390ec] text-white shadow-[0_4px_12px_rgba(51,144,236,0.3)] hover:bg-[#2b7ec9]'}`}
																		>
																			{btnText}
																		</div>
																	)}
																</div>
															</div>

															{/* Premium Progress Bar */}
															<Show when={hasProgress && !task.completed}>
																<div class="w-full mt-3 flex items-center gap-3 px-1">
																	<div class="flex-1 h-[6px] bg-black/60 rounded-full overflow-hidden border border-white/5 p-[1px] shadow-inner">
																		<div
																			class="h-full bg-gradient-to-r from-[#3390ec] to-[#60a5fa] rounded-full transition-all duration-700 ease-out relative overflow-hidden"
																			style={{ width: `${progressPercent}%` }}
																		>
																			<div
																				class="absolute inset-0 bg-white/20 w-full h-full animate-[spinSlow_2s_linear_infinite]"
																				style={{ transform: 'skewX(-45deg)' }}
																			/>
																		</div>
																	</div>
																	<span class="text-[11px] font-mono font-bold text-white/50 shrink-0 tabular-nums">
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

														{/* Error Message */}
														<Show when={taskErrors()[task.key]}>
															<div class="mt-1 text-[#ff4a4a] font-bold text-[11px] py-2 px-3 text-center bg-[#ff4a4a]/10 rounded-[14px] mx-1 border border-[#ff4a4a]/20 flex items-center justify-center gap-1">
																<span class="material-symbols-outlined text-[14px]">info</span>{' '}
																{taskErrors()[task.key]}
															</div>
														</Show>
													</div>
												);
											}}
										</For>
									</div>
								</Show>
							</Show>
						</Show>
					</div>
				</div>
			</div>

			{/* ═══════ QUIZ MODAL (Glassmorphic Box) ═══════ */}
			<Show when={activeQuizTask()}>
				<div
					class="fixed inset-0 z-[9999] flex items-center justify-center p-5 bg-black/80 backdrop-blur-md animate-fade-in"
					dir="rtl"
				>
					<div class="w-full max-w-sm max-h-[85vh] overflow-y-auto no-scrollbar bg-[#12141C] border border-white/10 rounded-[32px] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative animate-slide-up">
						{/* Ambient Glow */}
						<div class="absolute -top-10 -right-10 w-32 h-32 bg-[#3390ec]/20 rounded-full blur-3xl pointer-events-none" />

						<button
							type="button"
							onClick={() => setActiveQuizTask(null)}
							class="absolute top-5 right-5 w-8 h-8 rounded-[12px] bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all text-white/50 hover:text-white"
						>
							<span class="material-symbols-outlined text-[20px]">close</span>
						</button>

						<div class="flex flex-col items-center text-center mt-2">
							<div class="w-16 h-16 bg-gradient-to-br from-[#3390ec]/20 to-transparent border border-[#3390ec]/30 rounded-[20px] flex items-center justify-center mb-4 text-[32px] shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)]">
								🧠
							</div>
							<h3 class="text-[18px] font-black text-white mb-2 tracking-tight">
								{activeQuizTask()?.title || t('airdropFinal.tasks.specialTask')}
							</h3>
							<p class="text-[13px] text-white/60 leading-relaxed mb-6 font-medium">
								{activeQuizTask()?.config?.quiz_question ||
									'Solve this riddle to claim the reward!'}
							</p>
						</div>

						<form onSubmit={handleQuizSubmit} class="space-y-4">
							<input
								type="text"
								required
								value={quizAnswerInput()}
								onInput={(e) => setQuizAnswerInput(e.currentTarget.value)}
								class="w-full h-14 px-4 bg-[#08090D] border border-white/10 focus:border-[#3390ec] text-white text-[15px] font-bold rounded-[16px] focus:outline-none transition-all text-center font-mono shadow-inner placeholder-white/20"
								placeholder={t('tasks.enterYourAnswer')}
								autofocus
								dir="ltr"
							/>
							<Show when={quizError()}>
								<p class="text-[12px] text-[#ff4a4a] font-bold text-center bg-[#ff4a4a]/10 py-2 rounded-[12px] border border-[#ff4a4a]/20 flex items-center justify-center gap-1">
									<span class="material-symbols-outlined text-[16px]">error</span> {quizError()}
								</p>
							</Show>
							<button
								type="submit"
								disabled={loadingKeys()[activeQuizTask()!.key]}
								class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] active:scale-95 text-[13px] font-black uppercase tracking-widest rounded-[16px] shadow-[0_8px_20px_rgba(51,144,236,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-white border border-white/10"
							>
								{loadingKeys()[activeQuizTask()!.key] ? (
									<span class="material-symbols-outlined animate-spin text-[22px]">
										progress_activity
									</span>
								) : (
									t('airdrop.tasks.buttons.check') || 'CHECK ANSWER'
								)}
							</button>
						</form>
					</div>
				</div>
			</Show>

			{/* ═══════ CAMPAIGN MODAL (Premium Nested List) ═══════ */}
			<Show when={activeCampaign()}>
				<div
					class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
					dir="rtl"
				>
					<div class="w-full max-w-sm bg-[#12141C] sm:rounded-[32px] rounded-t-[32px] p-6 sm:p-7 shadow-[0_-20px_60px_rgba(0,0,0,0.8)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative max-h-[85vh] overflow-y-auto no-scrollbar animate-slide-up border-t sm:border border-white/10">
						<div class="w-12 h-1.5 bg-white/10 rounded-full mx-auto sm:hidden mb-4" />

						<button
							type="button"
							onClick={() => setActiveCampaign(null)}
							class="absolute top-5 right-5 w-8 h-8 rounded-[12px] bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all text-white/50 hover:text-white hidden sm:flex"
						>
							<span class="material-symbols-outlined text-[20px]">close</span>
						</button>

						<div class="flex flex-col items-center text-center mt-2 mb-6">
							<div class="w-16 h-16 bg-[#3390ec]/10 border border-[#3390ec]/30 rounded-[20px] flex items-center justify-center mb-3 text-white shadow-inner">
								<span class="material-symbols-outlined text-[32px] text-[#3390ec] drop-shadow-md">
									{getTaskDetails(activeCampaign()!).icon}
								</span>
							</div>
							<h3 class="text-[18px] font-black text-white mb-1.5">{activeCampaign()?.title}</h3>
							<p class="text-[12px] text-white/50 font-medium px-4">
								{t('tasks.completeSubTasksDesc')}
							</p>
						</div>

						<div class="bg-[#08090D] rounded-[24px] border border-white/10 flex flex-col mb-5 overflow-hidden shadow-inner">
							<For each={tasksQuery.data?.filter((t) => t.parent_key === activeCampaign()?.key)}>
								{(task, index) => {
									const details = getTaskDetails(task);
									const isLast =
										index() ===
										(tasksQuery.data?.filter((t) => t.parent_key === activeCampaign()?.key)
											.length || 0) -
											1;
									return (
										<div class={`flex flex-col ${!isLast ? 'border-b border-white/5' : ''}`}>
											<button
												type="button"
												onClick={(e) => handleTaskClick(task, e)}
												disabled={task.completed || loadingKeys()[task.key]}
												class="w-full flex items-center justify-between py-3.5 px-4 text-start hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-100 group"
											>
												<div class="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
													<div class="w-10 h-10 bg-[#161b28] rounded-[12px] flex items-center justify-center shrink-0 border border-white/10 group-hover:border-white/20 transition-colors">
														<span class="material-symbols-outlined text-[20px] text-white/70">
															{details.icon}
														</span>
													</div>
													<div class="flex flex-col min-w-0 pr-1">
														<span class="text-white font-bold text-[13px] truncate">
															{details.title}
														</span>
														<Show when={(task.reward_frg ?? 0) > 0}>
															<span
																class="text-amber-400 font-mono font-bold text-[11px] flex items-center gap-1 mt-0.5"
																dir="ltr"
															>
																<span>🪙</span> {formatCoins(task.reward_frg ?? 0)}
															</span>
														</Show>
													</div>
												</div>
												<div class="shrink-0 flex items-center justify-center">
													{task.completed ? (
														<span class="material-symbols-outlined text-emerald-500 text-[24px]">
															check_circle
														</span>
													) : loadingKeys()[task.key] ? (
														<span class="material-symbols-outlined animate-spin text-[20px] text-white/40">
															progress_activity
														</span>
													) : (
														<span class="material-symbols-outlined text-[20px] text-white/30 rtl:-scale-x-100 group-hover:text-white/60 transition-colors">
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
							type="button"
							onClick={(e) => handleTaskClick(activeCampaign()!, e)}
							disabled={
								activeCampaign()?.completed ||
								loadingKeys()[activeCampaign()!.key] ||
								tasksQuery.data
									?.filter((t) => t.parent_key === activeCampaign()?.key)
									.some((t) => !t.completed)
							}
							class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] active:scale-95 disabled:opacity-40 disabled:grayscale text-white font-black text-[13px] uppercase tracking-widest rounded-[16px] shadow-[0_8px_20px_rgba(51,144,236,0.3)] transition-all flex items-center justify-center border border-white/10"
						>
							{activeCampaign()?.completed
								? 'REWARD CLAIMED'
								: loadingKeys()[activeCampaign()!.key]
									? 'CLAIMING...'
									: 'CLAIM REWARD'}
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};
