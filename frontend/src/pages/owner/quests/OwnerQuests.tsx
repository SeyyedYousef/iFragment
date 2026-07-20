import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { ownerApi, QuestItem } from '@/shared/api/owner.js';
import { hapticFeedback } from '@tma.js/sdk-solid';

export const OwnerQuests: Component = () => {
	const [quests, setQuests] = createSignal<QuestItem[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [errorMsg, setErrorMsg] = createSignal('');

	// Modal state
	const [isModalOpen, setIsModalOpen] = createSignal(false);
	const [isEditing, setIsEditing] = createSignal(false);

	// Form fields
	const [questId, setQuestId] = createSignal<string | number>('');
	const [title, setTitle] = createSignal('');
	const [description, setDescription] = createSignal('');
	const [type, setType] = createSignal<QuestItem['type']>('telegram_channel');
	const [rewardFrg, setRewardFrg] = createSignal(1000);
	const [rewardXp, setRewardXp] = createSignal(10);
	const [isActive, setIsActive] = createSignal(true);
	const [expiresAt, setExpiresAt] = createSignal('');
	const [channelUsername, setChannelUsername] = createSignal('');
	const [taskUrl, setTaskUrl] = createSignal('');

	const loadQuests = async () => {
		setLoading(true);
		setErrorMsg('');
		try {
			const data = await ownerApi.listQuests();
			setQuests(data || []);
		} catch (err: any) {
			setErrorMsg(err.response?.data?.error || 'خطا در دریافت مأموریت‌های سرور');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		loadQuests();
	});

	const openCreateModal = () => {
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}
		setIsEditing(false);
		setQuestId('');
		setTitle('');
		setDescription('');
		setType('telegram_channel');
		setRewardFrg(5000);
		setRewardXp(50);
		setIsActive(true);

		const defaultExpiry = new Date();
		defaultExpiry.setDate(defaultExpiry.getDate() + 30);
		setExpiresAt(defaultExpiry.toISOString().slice(0, 10));

		setChannelUsername('@Fragmentscommunity');
		setTaskUrl('https://ifragment.app');
		setIsModalOpen(true);
	};

	const openEditModal = (q: QuestItem) => {
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}
		setIsEditing(true);
		setQuestId(q.id);
		setTitle(q.title);
		setDescription(q.description || '');
		setType(q.type);
		setRewardFrg(q.reward_frg);
		setRewardXp(q.reward_xp);
		setIsActive(q.is_active);
		setExpiresAt(q.expires_at ? q.expires_at.slice(0, 10) : '');
		setChannelUsername(q.config?.channel_username || '');
		setTaskUrl(q.config?.url || '');
		setIsModalOpen(true);
	};

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setErrorMsg('');
		setLoading(true);

		const configObj: Record<string, any> = {};
		if (type() === 'telegram_channel' || type() === 'telegram_group') {
			configObj.channel_username = channelUsername();
		} else if (type() === 'external_link' || type() === 'partner') {
			configObj.url = taskUrl();
		}

		const questData: Partial<QuestItem> = {
			title: title(),
			description: description(),
			type: type(),
			reward_frg: Number(rewardFrg()),
			reward_xp: Number(rewardXp()),
			config: configObj,
			is_active: isActive(),
			expires_at: expiresAt() ? new Date(expiresAt()).toISOString() : undefined,
		};

		try {
			if (isEditing() && questId()) {
				await ownerApi.updateQuest(questId(), questData);
			} else {
				await ownerApi.createQuest(questData);
			}
			try {
				hapticFeedback.notificationOccurred('success');
			} catch {}
			setIsModalOpen(false);
			loadQuests();
		} catch (err: any) {
			setErrorMsg(err.response?.data?.error || 'ذخیره‌سازی مأموریت با خطا مواجه شد.');
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async (id: string | number) => {
		if (!confirm('آیا از حذف این مأموریت اطمینان دارید؟')) return;
		setLoading(true);
		try {
			await ownerApi.deleteQuest(id);
			hapticFeedback.notificationOccurred('success');
			loadQuests();
		} catch (err: any) {
			setErrorMsg(err.response?.data?.error || 'خطا در حذف مأموریت');
			setLoading(false);
		}
	};

	return (
		<div class="space-y-6">
			{/* Action & Filter Bar */}
			<div class="bg-[#16171d]/60 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
				<div>
					<h2 class="text-sm font-black text-white">مدیریت مأموریت‌ها و کمپین‌های پاداش‌دار</h2>
					<p class="text-xs text-white/40 font-bold mt-0.5">تعریف مأموریت‌های پاداش سکه و XP برای اعضای بات</p>
				</div>

				<button
					onClick={openCreateModal}
					class="h-10 px-5 bg-[#3390ec] hover:bg-[#2b7ec9] text-xs font-black uppercase text-white rounded-2xl active:scale-95 transition-all flex items-center gap-1.5 shadow-lg shadow-[#3390ec]/20"
				>
					<span class="material-symbols-outlined text-[18px]">add</span>
					ایجاد مأموریت جدید
				</button>
			</div>

			<Show when={errorMsg()}>
				<div class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold">
					<span class="material-symbols-outlined text-xl">error</span>
					<span>{errorMsg()}</span>
				</div>
			</Show>

			{/* Quests Grid */}
			<Show
				when={!loading()}
				fallback={
					<div class="flex flex-col items-center justify-center py-20 gap-3">
						<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
						<span class="text-xs text-white/50 font-bold">در حال دریافت لیست مأموریت‌ها...</span>
					</div>
				}
			>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<For each={quests()}>
						{(q) => {
							const isExpired = q.expires_at ? new Date(q.expires_at).getTime() < Date.now() : false;
							return (
								<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 space-y-4 hover:border-white/20 transition-all flex flex-col justify-between">
									<div class="space-y-2">
										<div class="flex items-center justify-between gap-2">
											<h3 class="text-sm font-black text-white">{q.title}</h3>
											<span
												class={`px-2.5 py-0.5 text-[9px] font-black uppercase rounded-lg border ${
													!q.is_active || isExpired
														? 'bg-red-500/10 border-red-500/20 text-red-400'
														: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
												}`}
											>
												{!q.is_active ? 'غیرفعال' : isExpired ? 'منقضی شده' : 'فعال'}
											</span>
										</div>

										<p class="text-xs text-white/60 font-medium line-clamp-2">{q.description || 'بدون توضیحات'}</p>

										<div class="flex items-center gap-3 text-[10px] text-amber-400 font-mono font-bold pt-1">
											<span>🪙 {q.reward_frg.toLocaleString()} FRG</span>
											<span>⚡ {q.reward_xp.toLocaleString()} XP</span>
										</div>
									</div>

									<div class="pt-3 border-t border-white/5 flex items-center justify-between">
										<span class="text-[9px] text-white/40 font-mono">
											انقضا: {q.expires_at ? new Date(q.expires_at).toLocaleDateString('fa-IR') : 'نامحدود'}
										</span>

										<div class="flex gap-2">
											<button
												onClick={() => openEditModal(q)}
												class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 flex items-center justify-center transition-all"
											>
												<span class="material-symbols-outlined text-[16px]">edit</span>
											</button>
											<button
												onClick={() => handleDelete(q.id)}
												class="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 flex items-center justify-center transition-all"
											>
												<span class="material-symbols-outlined text-[16px]">delete</span>
											</button>
										</div>
									</div>
								</div>
							);
						}}
					</For>
				</div>
			</Show>

			{/* Create/Edit Quest Modal */}
			<Show when={isModalOpen()}>
				<div class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
					<div class="w-full max-w-md bg-gradient-to-b from-[#1a1b22] to-[#111216] border border-white/10 rounded-[28px] p-6 shadow-2xl space-y-4 relative">
						<button
							onClick={() => setIsModalOpen(false)}
							class="absolute top-5 end-5 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-white/70"
						>
							<span class="material-symbols-outlined text-[18px]">close</span>
						</button>

						<h3 class="text-sm font-black text-white">
							{isEditing() ? 'ویرایش مأموریت' : 'ایجاد مأموریت جدید'}
						</h3>

						<form onSubmit={handleSubmit} class="space-y-3">
							<div>
								<label class="block text-[10px] text-white/50 font-bold mb-1">عنوان مأموریت</label>
								<input
									type="text"
									required
									value={title()}
									onInput={(e) => setTitle(e.currentTarget.value)}
									class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs text-white focus:border-[#3390ec] outline-none"
									placeholder="مثال: عضویت در کانال تلگرام"
								/>
							</div>

							<div>
								<label class="block text-[10px] text-white/50 font-bold mb-1">توضیحات کوتاه</label>
								<input
									type="text"
									value={description()}
									onInput={(e) => setDescription(e.currentTarget.value)}
									class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs text-white focus:border-[#3390ec] outline-none"
									placeholder="راهنمای انجام تسک برای کاربر..."
								/>
							</div>

							<div class="grid grid-cols-2 gap-3">
								<div>
									<label class="block text-[10px] text-white/50 font-bold mb-1">پاداش سکه (FRG)</label>
									<input
										type="number"
										required
										min="0"
										value={rewardFrg()}
										onInput={(e) => setRewardFrg(Number(e.currentTarget.value))}
										class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-3 text-xs font-mono text-white outline-none"
									/>
								</div>
								<div>
									<label class="block text-[10px] text-white/50 font-bold mb-1">پاداش تجربه (XP)</label>
									<input
										type="number"
										required
										min="0"
										value={rewardXp()}
										onInput={(e) => setRewardXp(Number(e.currentTarget.value))}
										class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-3 text-xs font-mono text-white outline-none"
									/>
								</div>
							</div>

							<div>
								<label class="block text-[10px] text-white/50 font-bold mb-1">نوع مأموریت</label>
								<select
									value={type()}
									onChange={(e) => setType(e.currentTarget.value as any)}
									class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-3 text-xs text-white outline-none"
								>
									<option value="telegram_channel">عضویت در کانال تلگرام</option>
									<option value="telegram_group">عضویت در گروه تلگرام</option>
									<option value="external_link">بازدید از وبسایت / لینک خارجی</option>
									<option value="partner">مأموریت همکاران / اسپانسر</option>
								</select>
							</div>

							<Show when={type() === 'telegram_channel' || type() === 'telegram_group'}>
								<div>
									<label class="block text-[10px] text-white/50 font-bold mb-1">شناسه کانال/گروه (آیدی با @)</label>
									<input
										type="text"
										value={channelUsername()}
										onInput={(e) => setChannelUsername(e.currentTarget.value)}
										class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none"
										placeholder="@Fragmentscommunity"
									/>
								</div>
							</Show>

							<Show when={type() === 'external_link' || type() === 'partner'}>
								<div>
									<label class="block text-[10px] text-white/50 font-bold mb-1">آدرس لینک مقصد (URL)</label>
									<input
										type="url"
										value={taskUrl()}
										onInput={(e) => setTaskUrl(e.currentTarget.value)}
										class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none"
										placeholder="https://..."
									/>
								</div>
							</Show>

							<div class="grid grid-cols-2 gap-3 pt-2">
								<div>
									<label class="block text-[10px] text-white/50 font-bold mb-1">تاریخ انقضا</label>
									<input
										type="date"
										value={expiresAt()}
										onInput={(e) => setExpiresAt(e.currentTarget.value)}
										class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-3 text-xs text-white outline-none"
									/>
								</div>
								<div class="flex flex-col justify-end">
									<button
										type="button"
										onClick={() => setIsActive(!isActive())}
										class={`h-11 rounded-xl text-xs font-bold border transition-all ${
											isActive() ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
										}`}
									>
										{isActive() ? 'وضعیت: فعال' : 'وضعیت: غیرفعال'}
									</button>
								</div>
							</div>

							<div class="pt-3 flex gap-2">
								<button type="button" onClick={() => setIsModalOpen(false)} class="flex-1 h-11 bg-white/5 text-xs font-bold rounded-xl">
									انصراف
								</button>
								<button type="submit" class="flex-1 h-11 bg-[#3390ec] text-white text-xs font-black rounded-xl">
									ذخیره‌سازی
								</button>
							</div>
						</form>
					</div>
				</div>
			</Show>
		</div>
	);
};
