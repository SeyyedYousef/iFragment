import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { backButton, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { completeTask, getTasksStatus } from '@/shared/api/profile.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { SkeletonTask } from '@/shared/ui/Skeleton.js';
import { haptic } from '@/shared/lib/haptic.js';

export const TasksPage: Component = () => {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [message, setMessage] = createSignal<{ text: string; error: boolean } | null>(null);
	const [activeQuizTask, setActiveQuizTask] = createSignal<any | null>(null);
	const [quizAnswerInput, setQuizAnswerInput] = createSignal('');
	const [quizError, setQuizError] = createSignal('');

	const tasksQuery = createQuery(() => ({
		queryKey: ['profile', 'tasks'],
		queryFn: getTasksStatus,
		staleTime: 30_000,
		refetchOnWindowFocus: false,
	}));

	const completeTaskMutation = createMutation(() => ({
		mutationFn: ({ key, answer }: { key: string; answer?: string }) => completeTask(key, answer),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['profile', 'tasks'] });
			queryClient.invalidateQueries({ queryKey: ['profile', 'stats'] });
			try {
				haptic.notify('success');
			} catch {}
			setMessage({
				text: t('gamification.taskCompletedSuccess'),
				error: false,
			});
		},
		onError: (err: any) => {
			try {
				haptic.notify('error');
			} catch {}
			setMessage({
				text: err.message || t('gamification.taskVerifyFailed'),
				error: true,
			});
		},
	}));

	const tasks = () => tasksQuery.data || [];
	const loading = () => tasksQuery.isLoading;

	onMount(() => {
		try {
			backButton.show();
			const off = backButton.onClick(() => {
				try {
					haptic.impact('light');
				} catch {}
				navigate('/profile');
			});
			onCleanup(() => {
				off();
				try {
					backButton.hide();
				} catch {}
			});
		} catch {}
	});

	const handleComplete = async (task: any) => {
		setMessage(null);
		const key = task.key;
		try {
			try {
				haptic.impact('medium');
			} catch {}

			// Quiz quest check: trigger input modal
			if (task.type === 'quiz') {
				setActiveQuizTask(task);
				setQuizAnswerInput('');
				setQuizError('');
				return;
			}

			// If joining telegram channel, redirect user to the link first
			if (task.type === 'channel_join' || key === 'join_ifragment_channel') {
				let channelName = task.config?.channel_username || 'Fragmentscommunity';
				channelName = channelName.replace(/^@/, '');
				try {
					openTelegramLink(`https://t.me/${channelName}`);
				} catch {}
				await new Promise((resolve) => setTimeout(resolve, 800));
			}

			completeTaskMutation.mutate({ key });
		} catch (e: any) {
			console.error('Failed to complete task:', e);
		}
	};

	const handleQuizSubmit = async (e: Event) => {
		e.preventDefault();
		const task = activeQuizTask();
		if (!task) return;

		const answer = quizAnswerInput().trim();
		if (!answer) {
			setQuizError(t('gamification.quizAnswerEmpty'));
			return;
		}

		setQuizError('');
		const key = task.key;
		completeTaskMutation.mutate(
			{ key, answer },
			{
				onSuccess: () => {
					setActiveQuizTask(null);
				},
				onError: (err: any) => {
					setQuizError(err.message || t('gamification.quizAnswerIncorrect'));
				},
			},
		);
	};

	const getTaskIcon = (type?: string, key?: string) => {
		if (type === 'quiz') return 'psychology';
		if (type === 'channel_join' || (key && key.includes('join'))) return 'campaign';
		return 'task_alt';
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-32 text-white font-sans selection:bg-[#3390ec]/30 relative overflow-x-hidden"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#3390ec]/15 via-[#10b981]/5 to-transparent blur-[90px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-30 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm shrink-0">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => {
							try {
								haptic.impact('light');
							} catch {}
							navigate('/profile');
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label="Back"
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col gap-0.5 min-w-0">
						<h1 class="text-[18px] font-black text-white leading-tight tracking-tight">
							{t('gamification.questHub')}
						</h1>
						<span class="text-[11px] font-bold text-white/50 uppercase tracking-wider truncate">
							{t('gamification.questsSubtitle')}
						</span>
					</div>
				</div>
				<div class="w-11 h-11 rounded-[14px] bg-gradient-to-br from-[#3390ec]/20 to-[#10b981]/10 flex items-center justify-center border border-[#3390ec]/30 shrink-0 shadow-inner">
					<span class="material-symbols-outlined text-[#3390ec] text-[22px] drop-shadow-[0_0_8px_rgba(51,144,236,0.5)]">
						explore
					</span>
				</div>
			</div>

			<div class="flex-1 w-full max-w-md mx-auto relative z-10 flex flex-col px-5 pt-5 gap-5">
				{/* ═══════ STATUS TOAST ═══════ */}
				<Show when={message()}>
					<Motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						class={`rounded-[20px] p-4 flex items-start gap-3 shadow-sm border ${
							message()?.error
								? 'bg-[#ff4a4a]/10 border-[#ff4a4a]/20'
								: 'bg-[#10b981]/10 border-[#10b981]/20'
						}`}
					>
						<span
							class={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${message()?.error ? 'text-[#ff4a4a]' : 'text-[#10b981]'}`}
						>
							{message()?.error ? 'error' : 'check_circle'}
						</span>
						<p
							class={`text-[12px] font-bold leading-relaxed ${message()?.error ? 'text-[#ff4a4a]' : 'text-[#10b981]'}`}
						>
							{message()?.text}
						</p>
					</Motion.div>
				</Show>

				{/* ═══════ TASK LIST ═══════ */}
				<Show
					when={!loading()}
					fallback={
						<div class="flex flex-col gap-3">
							<SkeletonTask />
							<SkeletonTask />
							<SkeletonTask />
						</div>
					}
				>
					<Show
						when={tasks().length > 0}
						fallback={
							<Motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								class="flex flex-col items-center justify-center py-12 text-center bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[32px] shadow-sm mt-2"
							>
								<div class="w-20 h-20 bg-[#3390ec]/10 rounded-[24px] flex items-center justify-center mb-4 border border-[#3390ec]/20 shadow-inner">
									<span class="material-symbols-outlined text-[40px] text-[#3390ec] drop-shadow-md">
										assignment_turned_in
									</span>
								</div>
								<h3 class="text-[18px] font-black text-white mb-1.5 tracking-tight">
									{t('gamification.noTasksTitle')}
								</h3>
								<p class="text-[12px] font-medium text-white/50 max-w-[200px] leading-relaxed">
									{t('gamification.noTasksSubtitle')}
								</p>
							</Motion.div>
						}
					>
						<div class="flex flex-col gap-3.5">
							<For each={tasks()}>
								{(task, i) => (
									<Motion.div
										initial={{ opacity: 0, y: 15 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: i() * 0.05 }}
										class={`flex items-center justify-between border rounded-[24px] p-4 bg-[#12141C]/80 backdrop-blur-xl transition-all group ${
											task.completed
												? 'opacity-60 grayscale border-white/5 shadow-none'
												: 'border-white/5 shadow-sm hover:border-[#3390ec]/30 hover:bg-[#12141C]'
										}`}
									>
										<div class="flex items-center gap-3.5 flex-1 min-w-0 pr-2">
											<div
												class={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 shadow-inner border ${
													task.completed
														? 'bg-white/5 border-white/10 text-white/40'
														: 'bg-[#3390ec]/15 border-[#3390ec]/30 text-[#3390ec] group-hover:scale-105 transition-transform'
												}`}
											>
												<span class="material-symbols-outlined text-[24px]">
													{getTaskIcon(task.type, task.key)}
												</span>
											</div>
											<div class="flex flex-col gap-1.5 flex-1 min-w-0">
												<span class="text-[14px] font-black text-white tracking-tight truncate w-full">
													{task.title}
												</span>
												<div class="flex items-center gap-2 flex-wrap">
													<Show when={task.reward_frg}>
														<span class="px-2 py-0.5 rounded-[6px] bg-amber-400/10 border border-amber-400/20 text-[10px] font-black font-mono text-amber-400 tracking-tight shadow-sm flex items-center gap-1">
															<span class="material-symbols-outlined text-[12px]">
																toll
															</span>{' '}
															+{(task.reward_frg ?? 0).toLocaleString('en-US')}
														</span>
													</Show>
													<Show when={task.reward_xp}>
														<span class="px-2 py-0.5 rounded-[6px] bg-[#3390ec]/10 border border-[#3390ec]/20 text-[10px] font-black font-mono text-[#3390ec] tracking-tight shadow-sm flex items-center gap-1">
															<span class="material-symbols-outlined text-[12px]">
																bolt
															</span>{' '}
															+{(task.reward_xp ?? 0).toLocaleString('en-US')} XP
														</span>
													</Show>
												</div>
											</div>
										</div>

										<div class="shrink-0 flex items-center justify-center">
											<Show
												when={task.completed}
												fallback={
													<button
														onClick={() => handleComplete(task)}
														disabled={
															completeTaskMutation.isPending &&
															completeTaskMutation.variables?.key === task.key
														}
														class="px-5 h-10 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] active:scale-95 disabled:opacity-50 disabled:scale-100 text-[11px] font-black text-white rounded-[12px] uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(51,144,236,0.3)] border border-white/10 flex items-center justify-center min-w-[70px]"
													>
														{completeTaskMutation.isPending &&
														completeTaskMutation.variables?.key === task.key ? (
															<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
														) : (
															t('gamification.claim')
														)}
													</button>
												}
											>
												<div class="w-10 h-10 rounded-[12px] bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] shadow-inner">
													<span class="material-symbols-outlined text-[20px] drop-shadow-md">
														done_all
													</span>
												</div>
											</Show>
										</div>
									</Motion.div>
								)}
							</For>
						</div>
					</Show>
				</Show>
			</div>

			{/* ═══════ QUIZ MODAL (3D Glassmorphism) ═══════ */}
			<Show when={activeQuizTask()}>
				<div
					class="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-[#030303]/90 backdrop-blur-2xl animate-fade-in"
					onClick={(e) => {
						if (e.target === e.currentTarget) setActiveQuizTask(null);
					}}
				>
					<Motion.div
						initial={{ opacity: 0, scale: 0.9, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }}
						class="w-full max-w-sm max-h-[85vh] overflow-y-auto no-scrollbar bg-[#12141C] border border-white/10 rounded-[32px] p-6 pb-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative"
					>
						{/* Inner Glow */}
						<div class="absolute -top-10 -right-10 w-40 h-40 bg-[#3390ec]/20 rounded-full blur-3xl pointer-events-none" />

						<button
							onClick={() => setActiveQuizTask(null)}
							class="absolute top-5 right-5 w-9 h-9 rounded-[12px] bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all text-white/60 hover:text-white z-20"
						>
							<span class="material-symbols-outlined text-[20px]">close</span>
						</button>

						<div class="flex flex-col items-center text-center mt-2 relative z-10">
							<div class="w-20 h-20 bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/30 rounded-[24px] flex items-center justify-center mb-5 text-[36px] shadow-inner drop-shadow-md">
								❓
							</div>
							<h3 class="text-[20px] font-black text-white mb-2 tracking-tight">
								{activeQuizTask()?.title || t('airdropFinal.tasks.specialTask' as any)}
							</h3>
							<p class="text-[13px] font-medium text-white/60 leading-relaxed mb-6 px-2">
								{activeQuizTask()?.config?.quiz_question ||
									t('airdropFinal.tasks.items.default.desc' as any)}
							</p>
						</div>

						<form onSubmit={handleQuizSubmit} class="flex flex-col gap-4 relative z-10 w-full">
							<div class="flex flex-col gap-1.5 w-full">
								<input
									type="text"
									required
									value={quizAnswerInput()}
									onInput={(e) => setQuizAnswerInput(e.currentTarget.value)}
									class="w-full h-14 px-4 bg-[#08090D] border border-white/10 focus:border-[#3390ec]/50 text-white text-[14px] font-bold rounded-[16px] focus:outline-none transition-colors text-center shadow-inner placeholder-white/20"
									placeholder={t('airdropNew.clan.joinPlaceholder')}
									autofocus
								/>
							</div>

							<Show when={quizError()}>
								<p class="text-[11px] text-[#ff4a4a] font-black uppercase tracking-widest text-center animate-shake">
									{quizError()}
								</p>
							</Show>

							<button
								type="submit"
								disabled={
									completeTaskMutation.isPending &&
									completeTaskMutation.variables?.key === activeQuizTask()!.key
								}
								class="w-full h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] active:scale-95 text-[13px] font-black uppercase tracking-widest text-white rounded-[16px] shadow-[0_8px_25px_rgba(51,144,236,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 border border-white/10 mt-1"
							>
								{completeTaskMutation.isPending &&
								completeTaskMutation.variables?.key === activeQuizTask()!.key ? (
									<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								) : (
									<>
										<span class="material-symbols-outlined text-[20px]">
											fact_check
										</span>
										{t('airdropNew.tasks.buttons.check')}
									</>
								)}
							</button>
						</form>
					</Motion.div>
				</div>
			</Show>
		</div>
	);
};
