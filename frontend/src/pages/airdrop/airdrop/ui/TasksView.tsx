import { createQuery } from '@tanstack/solid-query';
import { hapticFeedback, openTelegramLink } from '@tma.js/sdk-solid';
import { Component, createSignal, For, Show } from 'solid-js';
import { completeTask, getTasksStatus, TaskStatus } from '@/shared/api/profile.js';
import { t } from '@/shared/i18n/index.js';
import { syncProfileStats } from '@/shared/store/airdrop.js';

export const TasksView: Component = () => {
	const [taskErrors, setTaskErrors] = createSignal<Record<string, string>>({});
	const [loadingKeys, setLoadingKeys] = createSignal<Record<string, boolean>>({});

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
		setLoadingKeys((prev) => ({ ...prev, [key]: true }));

		try {
			hapticFeedback.impactOccurred('medium');
		} catch (_) {}

		// CTA Redirect if Telegram channel task
		if (key === 'join_ifragment_channel') {
			openTelegramLink('https://t.me/ifragment_net');
			// Give a tiny timeout for channel redirection before triggering verification
			await new Promise((resolve) => setTimeout(resolve, 800));
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
				} else if (msg.includes('join official telegram channel')) {
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

	const getTaskDetails = (key: string) => {
		switch (key) {
			case 'league_gold':
				return { title: t('airdropFinal.tasks.leagueGold'), icon: '🏆' };
			case 'join_clan':
				return { title: t('airdropFinal.tasks.joinClan'), icon: '🛡️' };
			case 'invite_1_fren':
				return { title: t('airdropFinal.tasks.invite1'), icon: '🤝' };
			case 'invite_3_frens':
				return { title: t('airdropFinal.tasks.invite3'), icon: '👥' };
			case 'invite_10_frens':
				return { title: t('airdropFinal.tasks.invite10'), icon: '💎' };
			case 'taps_100k':
				return { title: t('airdropFinal.tasks.taps100k'), icon: '👆' };
			case 'telegram_premium':
				return { title: t('airdropFinal.tasks.premium'), icon: '⭐️' };
			case 'join_ifragment_channel':
				return { title: t('airdropFinal.tasks.joinChannel'), icon: '📣' };
			default:
				return { title: t('airdropFinal.tasks.specialTask'), icon: '🎁' };
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
								<For each={tasksQuery.data}>
									{(task, index) => {
										const details = getTaskDetails(task.key);
										const isLast = index() === (tasksQuery.data?.length || 0) - 1;
										return (
											<div class={`flex flex-col ${!isLast ? 'border-b border-white/5' : ''}`}>
												<button
													onClick={() => handleTaskClick(task)}
													disabled={task.completed || loadingKeys()[task.key]}
													class="w-full flex items-center justify-between py-4 text-left active:opacity-70 transition-opacity disabled:opacity-100"
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
		</div>
	);
};
