import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { QuestItem } from '@/entities/owner/model/types.js';
import { t } from '@/shared/i18n/index.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.jsx';

export const OwnerQuests: Component = () => {
	const queryClient = useQueryClient();

	const [isCreating, setIsCreating] = createSignal(false);
	const [editingQuest, setEditingQuest] = createSignal<QuestItem | null>(null);

	// Form State
	const [formKey, setFormKey] = createSignal('');
	const [formTitle, setFormTitle] = createSignal('');
	const [formType, setFormType] = createSignal<QuestItem['type']>('telegram_channel');
	const [formRewardCoins, setFormRewardCoins] = createSignal(5000);
	const [formRewardXp, setFormRewardXp] = createSignal(50);
	const [formChannelUsername, setFormChannelUsername] = createSignal('');
	const [formChannelId, setFormChannelId] = createSignal('');
	const [formIsActive, setFormIsActive] = createSignal(true);

	const [questToDelete, setQuestToDelete] = createSignal<QuestItem | null>(null);

	const questsQuery = createQuery<QuestItem[]>(() => ({
		queryKey: ['owner', 'quests'],
		queryFn: ownerApi.listQuests,
	}));

	const createQuestMutation = createMutation(() => ({
		mutationFn: (q: Partial<QuestItem>) => ownerApi.createQuest(q),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'quests'] });
			resetForm();
		},
	}));

	const updateMutation = createMutation(() => ({
		mutationFn: ({ key, q }: { key: string; q: Partial<QuestItem> }) =>
			ownerApi.updateQuest(key, q),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'quests'] });
			resetForm();
		},
	}));

	const deleteMutation = createMutation(() => ({
		mutationFn: (key: string) => ownerApi.deleteQuest(key),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'quests'] });
			setQuestToDelete(null);
		},
	}));

	const resetForm = () => {
		setIsCreating(false);
		setEditingQuest(null);
		setFormKey('');
		setFormTitle('');
		setFormType('telegram_channel');
		setFormRewardCoins(5000);
		setFormRewardXp(50);
		setFormChannelUsername('');
		setFormChannelId('');
		setFormIsActive(true);
	};

	const handleEdit = (q: QuestItem) => {
		setEditingQuest(q);
		setFormKey(q.key);
		setFormTitle(q.title);
		setFormType(q.type);
		setFormRewardCoins(q.reward_frg);
		setFormRewardXp(q.reward_xp);
		setFormChannelUsername(q.config?.channel_username || '');
		setFormChannelId(q.config?.channel_id || '');
		setFormIsActive(q.is_active);
		setIsCreating(true);
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		const payload: Partial<QuestItem> = {
			key: formKey().trim(),
			title: formTitle().trim(),
			type: formType(),
			reward_frg: formRewardCoins(),
			reward_xp: formRewardXp(),
			is_active: formIsActive(),
			config: {
				channel_username: formChannelUsername().trim(),
				channel_id: formChannelId().trim(),
			},
		};

		if (editingQuest()) {
			updateMutation.mutate({ key: editingQuest()!.key, q: payload });
		} else {
			createQuestMutation.mutate(payload);
		}
	};

	const quests = () => (questsQuery.data || []) as QuestItem[];

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div>
					<h2 class="text-lg font-bold text-white">{t('owner.quests.title')}</h2>
					<p class="text-xs text-white/50">{t('owner.quests.subtitle')}</p>
				</div>
				<button
					type="button"
					onClick={() => {
						resetForm();
						setIsCreating(true);
					}}
					class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20"
				>
					<span class="material-symbols-outlined text-base">add_task</span>
					<span>{t('owner.quests.createQuest')}</span>
				</button>
			</div>

			{/* Form Modal / Card */}
			<Show when={isCreating()}>
				<div class="rounded-3xl border border-amber-500/30 bg-black/60 p-6 space-y-5 backdrop-blur-xl">
					<div class="flex items-center justify-between border-b border-white/10 pb-3">
						<h3 class="text-sm font-bold text-white">
							{editingQuest() ? t('owner.quests.editQuest') : t('owner.quests.createNewQuest')}
						</h3>
						<button
							type="button"
							onClick={resetForm}
							class="text-xs text-white/50 hover:text-white"
						>
							{t('common.cancel')}
						</button>
					</div>

					<form onSubmit={handleSubmit} class="space-y-4">
						<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<div>
								<div class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('owner.quests.uniqueKey')}
								</div>
								<input
									type="text"
									placeholder={t('owner.quests.uniqueKeyPlaceholder')}
									value={formKey()}
									disabled={!!editingQuest()}
									onInput={(e) => setFormKey(e.currentTarget.value)}
									class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none disabled:opacity-50"
									required
								/>
							</div>

							<div>
								<div class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('owner.quests.titleLabel')}
								</div>
								<input
									type="text"
									placeholder={t('owner.quests.titlePlaceholder')}
									value={formTitle()}
									onInput={(e) => setFormTitle(e.currentTarget.value)}
									class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:border-amber-400 focus:outline-none"
									required
								/>
							</div>

							<div>
								<div class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('owner.quests.questType')}
								</div>
								<select
									value={formType()}
									onChange={(e) => setFormType(e.currentTarget.value as any)}
									class="w-full h-11 px-3 rounded-xl bg-neutral-900 border border-white/15 text-white text-xs focus:border-amber-400 focus:outline-none"
								>
									<option value="telegram_channel">{t('owner.quests.typeTelegramChannel')}</option>
									<option value="telegram_group">{t('owner.quests.typeTelegramGroup')}</option>
									<option value="daily_checkin">{t('owner.quests.typeDailyCheckin')}</option>
									<option value="invite">{t('owner.quests.typeInviteFriends')}</option>
									<option value="external_link">{t('owner.quests.typeExternalLink')}</option>
									<option value="partner">{t('owner.quests.typePartner')}</option>
								</select>
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<div class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('owner.quests.channelUsernameLabel')}
								</div>
								<input
									type="text"
									placeholder={t('owner.quests.channelUsernamePlaceholder')}
									value={formChannelUsername()}
									onInput={(e) => setFormChannelUsername(e.currentTarget.value.replace('@', ''))}
									class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:border-amber-400 focus:outline-none"
								/>
							</div>

							<div>
								<div class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('owner.quests.channelIdLabel')}
								</div>
								<input
									type="text"
									placeholder="-100123456789"
									value={formChannelId()}
									onInput={(e) => setFormChannelId(e.currentTarget.value)}
									class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
								/>
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<div class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('owner.quests.rewardCoins')}
								</div>
								<input
									type="number"
									value={formRewardCoins()}
									onInput={(e) => setFormRewardCoins(parseInt(e.currentTarget.value, 10) || 0)}
									class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
									required
								/>
							</div>

							<div>
								<div class="block text-[11px] font-semibold text-white/60 mb-1">
									{t('owner.quests.rewardXp')}
								</div>
								<input
									type="number"
									value={formRewardXp()}
									onInput={(e) => setFormRewardXp(parseInt(e.currentTarget.value, 10) || 0)}
									class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
									required
								/>
							</div>
						</div>

						<div class="flex items-center justify-between pt-2 border-t border-white/10">
							<div class="flex items-center gap-2 text-xs text-white cursor-pointer select-none">
								<input
									type="checkbox"
									checked={formIsActive()}
									onChange={(e) => setFormIsActive(e.currentTarget.checked)}
									class="rounded accent-amber-500 h-4 w-4"
								/>
								<span>{t('owner.quests.questActiveVisible')}</span>
							</div>

							<div class="flex gap-2">
								<button
									type="button"
									onClick={resetForm}
									class="px-4 py-2.5 rounded-xl text-xs text-white/70 hover:bg-white/5"
								>
									{t('common.cancel')}
								</button>
								<button
									type="submit"
									disabled={createQuestMutation.isPending || updateMutation.isPending}
									class="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
								>
									{editingQuest() ? t('owner.quests.saveQuest') : t('owner.quests.createQuest')}
								</button>
							</div>
						</div>
					</form>
				</div>
			</Show>

			{/* Quests Table */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3">{t('owner.quests.thTitleKey')}</th>
								<th class="pb-3">{t('owner.quests.thType')}</th>
								<th class="pb-3">{t('owner.quests.thChannelConfig')}</th>
								<th class="pb-3">{t('owner.quests.thReward')}</th>
								<th class="pb-3">{t('owner.quests.thStatus')}</th>
								<th class="pb-3 text-right">{t('owner.quests.thActions')}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!questsQuery.isLoading && quests().length > 0}
								fallback={
									<tr>
										<td colspan="6" class="py-8 text-center text-white/40">
											{questsQuery.isLoading ? t('owner.quests.loading') : t('owner.quests.empty')}
										</td>
									</tr>
								}
							>
								<For each={quests()}>
									{(quest) => (
										<tr class="hover:bg-white/[0.02] transition">
											<td class="py-3">
												<div class="font-bold text-white">{quest.title}</div>
												<div class="text-[11px] font-mono text-white/40">{quest.key}</div>
											</td>
											<td class="py-3">
												<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-amber-400 border border-white/10">
													{quest.type}
												</span>
											</td>
											<td class="py-3 text-white/70">
												<Show
													when={quest.config?.channel_username}
													fallback={<span class="text-white/30">—</span>}
												>
													<span class="text-sky-400 font-mono">
														@{quest.config?.channel_username}
													</span>
												</Show>
											</td>
											<td class="py-3">
												<div class="font-mono text-amber-400 font-bold">
													{t('owner.quests.coinsAmount', {
														amount: quest.reward_frg.toLocaleString(),
													})}
												</div>
												<div class="font-mono text-cyan-400 text-[11px]">+{quest.reward_xp} XP</div>
											</td>
											<td class="py-3">
												<span
													class={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
														quest.is_active
															? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
															: 'bg-white/5 text-white/40'
													}`}
												>
													{quest.is_active ? t('owner.quests.active') : t('owner.quests.disabled')}
												</span>
											</td>
											<td class="py-3 text-right">
												<div class="flex items-center justify-end gap-1.5">
													<button
														type="button"
														onClick={() => handleEdit(quest)}
														class="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
														title={t('owner.quests.editQuest')}
													>
														<span class="material-symbols-outlined text-base">edit</span>
													</button>
													<button
														type="button"
														onClick={() => setQuestToDelete(quest)}
														class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
														title={t('owner.quests.deleteQuest')}
													>
														<span class="material-symbols-outlined text-base">delete</span>
													</button>
												</div>
											</td>
										</tr>
									)}
								</For>
							</Show>
						</tbody>
					</table>
				</div>
			</div>

			{/* Delete Quest Confirmation */}
			<Show when={questToDelete()}>
				<DangerActionDialog
					isOpen={true}
					title={t('owner.quests.deleteQuest')}
					description={t('owner.quests.deleteConfirmDesc', {
						title: questToDelete()?.title,
						key: questToDelete()?.key,
					})}
					actionLabel={t('owner.quests.deleteQuest')}
					riskLevel="medium"
					requireReason={false}
					loading={deleteMutation.isPending}
					onConfirm={() => {
						if (questToDelete()) {
							deleteMutation.mutate(questToDelete()!.key);
						}
					}}
					onClose={() => setQuestToDelete(null)}
				/>
			</Show>
		</div>
	);
};
