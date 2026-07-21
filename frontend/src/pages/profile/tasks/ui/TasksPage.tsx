import { useNavigate } from '@solidjs/router';
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { backButton, hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { completeTask, getTasksStatus } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
import { SkeletonTask } from '@/shared/ui/Skeleton.js';

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
				hapticFeedback.notificationOccurred('success');
			} catch {}
			setMessage({
				text:
					t('gamification.taskCompletedSuccess') || 'Task completed successfully! Reward credited.',
				error: false,
			});
		},
		onError: (err: any) => {
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
			setMessage({
				text:
					err.message ||
					t('gamification.taskVerifyFailed') ||
					'Failed to verify task requirements.',
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
					hapticFeedback.impactOccurred('light');
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
				hapticFeedback.impactOccurred('medium');
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
			setQuizError('Answer cannot be empty.');
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
					setQuizError(err.message || 'Incorrect answer. Please try again.');
				},
			},
		);
	};

	return (
		<div class="min-h-screen bg-[#0f1014] pb-32 text-white font-sans">
			{/* Header */}
			<div class="relative bg-gradient-to-b from-[#1a1b23] to-[#0f1014] pt-12 pb-8 px-6 text-center border-b border-[#222]">
				<div class="absolute top-4 left-6 flex items-center gap-2">
					<button
						onClick={() => {
							try {
								hapticFeedback.impactOccurred('light');
							} catch {}
							navigate('/profile');
						}}
						class="flex items-center justify-center w-8 h-8 rounded-full bg-[#1c1c1c] border border-[#2a2a2a]"
					>
						<span class="material-symbols-outlined text-[16px] text-white">arrow_back</span>
					</button>
				</div>

				<h1 class="text-2xl font-black tracking-tight text-white mb-1">
					{t('gamification.questHub') || 'Quest Hub'}
				</h1>
				<p class="text-xs text-[#a0a4ad]">
					{t('gamification.questsSubtitle') || 'Complete specialized tasks to earn FRG and XP'}
				</p>
			</div>

			<div class="px-6 py-6 flex flex-col gap-4">
				{/* Status Toast */}
				<Show when={message()}>
					<div
						class={`border rounded-2xl p-4 text-xs font-bold ${
							message()?.error
								? 'bg-[#ff3b30]/10 border-[#ff3b30]/30 text-[#ff3b30]'
								: 'bg-[#34c759]/10 border-[#34c759]/30 text-[#34c759]'
						}`}
					>
						{message()?.text}
					</div>
				</Show>

				{loading() ? (
					<div class="flex flex-col gap-3">
						<SkeletonTask />
						<SkeletonTask />
						<SkeletonTask />
					</div>
				) : (
					<Show
						when={tasks().length > 0}
						fallback={
							<div class="flex flex-col items-center justify-center py-12 text-center bg-[#15161d]/60 border border-[#222]/80 rounded-3xl">
								<span class="material-symbols-outlined text-4xl text-[#3390ec] mb-3">
									assignment_turned_in
								</span>
								<p class="text-sm font-bold text-white mb-1">
									{t('gamification.noTasksTitle') || 'All Caught Up!'}
								</p>
								<p class="text-xs text-[#a0a4ad]">
									{t('gamification.noTasksSubtitle') || 'Check back later for more quests.'}
								</p>
							</div>
						}
					>
						<div class="flex flex-col gap-3">
							<For each={tasks()}>
								{(task) => (
									<div
										class={`flex items-center justify-between border rounded-3xl p-5 bg-[#15161d]/60 border-[#222]/80 transition-all ${task.completed ? 'opacity-60' : 'hover:border-[#3390ec]/30'}`}
									>
										<div class="flex flex-col gap-1 max-w-[65%]">
											<span class="text-xs font-black text-white">{task.title}</span>
											<div class="flex items-center gap-2 mt-1">
												<span class="px-2 py-0.5 rounded-lg bg-[#3390ec]/10 border border-[#3390ec]/20 text-[9px] font-black text-[#3390ec]">
													+{(task.reward_frg ?? 0).toLocaleString()} FRG
												</span>
												<span class="px-2 py-0.5 rounded-lg bg-[#34c759]/10 border border-[#34c759]/20 text-[9px] font-black text-[#34c759]">
													+{(task.reward_xp ?? 0).toLocaleString()} XP
												</span>
											</div>
										</div>

										<div>
											<Show
												when={task.completed}
												fallback={
													<button
														onClick={() => handleComplete(task)}
														disabled={
															completeTaskMutation.isPending &&
															completeTaskMutation.variables?.key === task.key
														}
														class="px-4 py-2 bg-[#3390ec] active:scale-95 disabled:opacity-50 text-[10px] font-black text-white rounded-xl uppercase tracking-wider transition-all"
													>
														{completeTaskMutation.isPending &&
														completeTaskMutation.variables?.key === task.key
															? t('gamification.verifying') || 'Verifying...'
															: t('gamification.claim') || 'Claim'}
													</button>
												}
											>
												<div class="w-8 h-8 rounded-full bg-[#34c759]/10 border border-[#34c759]/20 flex items-center justify-center text-[#34c759]">
													<span class="material-symbols-outlined text-[16px]">check</span>
												</div>
											</Show>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>
				)}
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
								{activeQuizTask()?.config?.quiz_question ||
									'Solve this riddle to claim the reward!'}
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
								<p class="text-xs text-[#ff453a] font-bold text-center">{quizError()}</p>
							</Show>

							<button
								type="submit"
								disabled={
									completeTaskMutation.isPending &&
									completeTaskMutation.variables?.key === activeQuizTask()!.key
								}
								class="w-full h-12 bg-gradient-to-r from-[#3390ec] to-[#287ece] active:scale-95 text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
							>
								{completeTaskMutation.isPending &&
								completeTaskMutation.variables?.key === activeQuizTask()!.key ? (
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
		</div>
	);
};
