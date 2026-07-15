import { useNavigate } from '@solidjs/router';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { apiClient } from '@/shared/api/axios.js';
import { t } from '@/shared/i18n/index.js';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';

interface Quest {
	key: string;
	title: string;
	type: string;
	reward_frg: number;
	reward_xp: number;
	config: Record<string, any>;
	is_active: boolean;
	expires_at?: string;
	created_at: string;
	parent_key?: string | null;
}

export const OwnerQuests: Component = () => {
	const navigate = useNavigate();
	const [quests, setQuests] = createSignal<Quest[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [errorMsg, setErrorMsg] = createSignal('');

	// Modals signals
	const [isModalOpen, setIsModalOpen] = createSignal(false);
	const [isEditing, setIsEditing] = createSignal(false);

	// Form signals
	const [key, setKey] = createSignal('');
	const [title, setTitle] = createSignal('');
	const [type, setType] = createSignal('channel_join');
	const [rewardFrg, setRewardFrg] = createSignal(1000);
	const [rewardXp, setRewardXp] = createSignal(10);
	const [isActive, setIsActive] = createSignal(true);
	const [expiresAt, setExpiresAt] = createSignal('');
	const [parentKey, setParentKey] = createSignal('');

	// Custom Dynamic configs
	const [channelUsername, setChannelUsername] = createSignal('');
	const [quizQuestion, setQuizQuestion] = createSignal('');
	const [quizAnswer, setQuizAnswer] = createSignal('');
	const [taskUrl, setTaskUrl] = createSignal('');

	onMount(() => {
		// Lock access strictly to owner session
		const ownerToken = sessionStorage.getItem('owner_token');
		if (!ownerToken) {
			navigate('/');
			return;
		}
		loadQuests();
	});

	const loadQuests = async () => {
		setLoading(true);
		setErrorMsg('');
		try {
			const resp = await apiClient.get('/owner/quests');
			setQuests(resp.data || []);
		} catch (err: any) {
			setErrorMsg(err.response?.data?.error || t('ownerAuditLog.retrieveError'));
		} finally {
			setLoading(false);
		}
	};

	const openCreateModal = () => {
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}
		setIsEditing(false);
		setKey('');
		setTitle('');
		setType('channel_join');
		setRewardFrg(5000);
		setRewardXp(50);
		setIsActive(true);
		setExpiresAt('');
		setParentKey('');
		setChannelUsername('');
		setQuizQuestion('');
		setQuizAnswer('');
		setTaskUrl('');
		setIsModalOpen(true);
	};

	const openEditModal = (q: Quest) => {
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}
		setIsEditing(true);
		setKey(q.key);
		setTitle(q.title);
		setType(q.type);
		setRewardFrg(q.reward_frg);
		setRewardXp(q.reward_xp);
		setIsActive(q.is_active);
		setParentKey(q.parent_key || '');

		// Parse expires_at into local input format YYYY-MM-DD
		if (q.expires_at) {
			setExpiresAt(q.expires_at.slice(0, 10));
		} else {
			setExpiresAt('');
		}

		// Load configs based on type
		setChannelUsername(q.config?.channel_username || '');
		setQuizQuestion(q.config?.quiz_question || '');
		setQuizAnswer(''); // quiz answer hash remains empty on editing form for security
		setTaskUrl(q.config?.url || '');

		setIsModalOpen(true);
	};

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setErrorMsg('');
		setLoading(true);

		// Build configuration based on type
		const configObj: Record<string, any> = {};
		if (type() === 'channel_join') {
			configObj.channel_username = channelUsername();
		} else if (type() === 'quiz') {
			configObj.quiz_question = quizQuestion();
			if (quizAnswer()) {
				configObj.answer = quizAnswer(); // Server automatically SHA256 hashes this
			}
		} else if (type() === 'link' || type() === 'social') {
			configObj.url = taskUrl();
		}

		const questData = {
			key: key(),
			title: title(),
			type: type(),
			reward_frg: Number(rewardFrg()),
			reward_xp: Number(rewardXp()),
			config: configObj,
			is_active: isActive(),
			expires_at: expiresAt() ? new Date(expiresAt()).toISOString() : null,
			parent_key: parentKey() || null,
		};

		try {
			if (isEditing()) {
				await apiClient.put('/owner/quests', questData);
			} else {
				await apiClient.post('/owner/quests', questData);
			}
			try {
				hapticFeedback.notificationOccurred('success');
			} catch {}
			setIsModalOpen(false);
			loadQuests();
		} catch (err: any) {
			setErrorMsg(err.response?.data?.error || t('owner.quests.saveError'));
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = (questKey: string) => {
		try {
			hapticFeedback.notificationOccurred('warning');
		} catch {}

		const deleteAction = async () => {
			setLoading(true);
			try {
				await apiClient.delete(`/owner/quests?key=${questKey}`);
				try {
					hapticFeedback.notificationOccurred('success');
				} catch {}
				loadQuests();
			} catch (err: any) {
				setErrorMsg(err.response?.data?.error || t('owner.quests.deleteError'));
				setLoading(false);
			}
		};

		const tg = (window as any).Telegram?.WebApp;
		if (tg?.showConfirm) {
			tg.showConfirm(t('owner.quests.deleteConfirm'), (confirmed: boolean) => {
				if (confirmed) {
					deleteAction();
				}
			});
		} else {
			if (confirm(t('owner.quests.deleteConfirm'))) {
				deleteAction();
			}
		}
	};

	return (
		<div class="min-h-screen bg-[#07080a] pb-24 text-white font-sans selection:bg-[#3390ec]/30 selection:text-white">
			{/* Impersonation simulation header is automatically handled by the parent */}

			{/* Header Panel */}
			<div class="px-6 pt-8 pb-5 bg-gradient-to-b from-[#13151b] to-[#07080a] border-b border-white/5 relative overflow-hidden">
				<div class="absolute -top-24 -end-24 w-48 h-48 rounded-full bg-[#3390ec]/5 blur-3xl" />
				<h1 class="text-xl font-black uppercase tracking-wider flex items-center gap-2">
					⚙️ {t('owner.quests.title')}
				</h1>
				<p class="text-xs text-[#a0a4ad] font-bold mt-1 max-w-[280px]">
					{t('owner.quests.subtitle')}
				</p>
			</div>

			<OwnerTabs active="quests" />

			{/* Main Container */}
			<div class="p-6">
				<Show when={errorMsg()}>
					<div class="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
						<span class="material-symbols-outlined text-[20px] text-red-500 flex-shrink-0">
							error
						</span>
						<p class="text-xs text-red-400 font-bold leading-normal">{errorMsg()}</p>
					</div>
				</Show>

				<div class="flex justify-between items-center mb-6">
					<div class="text-xs font-bold text-white/50">
						{t('bottomNav.airdrop')}: <span class="text-white">{quests().length}</span>
					</div>
					<button
						onClick={openCreateModal}
						class="h-9 px-4 bg-gradient-to-r from-[#3390ec] to-[#287ece] hover:opacity-90 active:scale-95 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5"
					>
						<span class="material-symbols-outlined text-[14px]">add</span>
						{t('owner.quests.createBtn')}
					</button>
				</div>

				{/* Quests Listing Grid */}
				<Show
					when={!loading()}
					fallback={
						<div class="flex flex-col items-center justify-center py-20 gap-4">
							<div class="w-10 h-10 border-4 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
							<div class="text-xs font-bold text-[#a0a4ad]">{t('common.loading')}</div>
						</div>
					}
				>
					<div class="grid gap-4">
						<For each={quests()}>
							{(q) => {
								const isExpired = q.expires_at
									? new Date(q.expires_at).getTime() < Date.now()
									: false;
								return (
									<div class="bg-[#121318]/90 border border-white/5 rounded-2xl p-5 shadow-inner hover:border-white/10 transition-all">
										<div class="flex justify-between items-start gap-2">
											<div>
												<div class="flex items-center gap-2 flex-wrap">
													<h3 class="text-sm font-black text-white">{q.title}</h3>
													<span class="px-2 py-0.5 text-[8px] font-black uppercase rounded-md bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/20 select-none">
														{q.type}
													</span>
													<span
														class={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md select-none ${
															!q.is_active || isExpired
																? 'bg-red-500/10 text-red-400 border border-red-500/10'
																: 'bg-green-500/10 text-green-400 border border-green-500/10'
														}`}
													>
														{!q.is_active
															? t('owner.quests.inactive')
															: isExpired
																? t('owner.quests.expired')
																: t('owner.quests.active')}
													</span>
												</div>
												<p class="text-[10px] text-white/50 font-bold font-mono mt-1 select-all">
													{q.key}
												</p>
												
												<Show when={q.type === 'channel_join' && q.config?.channel_username}>
													<div class="mt-2 text-xs font-bold text-[#3390ec] flex items-center gap-1">
														<span class="material-symbols-outlined text-[14px]">campaign</span>
														{q.config.channel_username}
													</div>
												</Show>
												<Show when={(q.type === 'link' || q.type === 'social') && q.config?.url}>
													<div class="mt-2 text-xs font-bold text-[#5ac8fa] flex items-center gap-1">
														<span class="material-symbols-outlined text-[14px]">link</span>
														<a href={q.config.url} target="_blank" class="truncate max-w-[150px] hover:underline">
															{q.config.url}
														</a>
													</div>
												</Show>
												<Show when={q.type === 'quiz' && q.config?.quiz_question}>
													<div class="mt-2 text-xs font-bold text-[#F5A623] flex items-center gap-1 truncate max-w-[200px]">
														<span class="material-symbols-outlined text-[14px]">help</span>
														{q.config.quiz_question}
													</div>
												</Show>
											</div>

											<div class="flex gap-2">
												<button
													onClick={() => openEditModal(q)}
													class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/5 active:scale-90 transition-all text-white/80"
												>
													<span class="material-symbols-outlined text-[16px]">edit</span>
												</button>
												<button
													onClick={() => handleDelete(q.key)}
													class="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center border border-red-500/10 active:scale-90 transition-all text-red-400"
												>
													<span class="material-symbols-outlined text-[16px]">delete</span>
												</button>
											</div>
										</div>

										<hr class="border-white/5 my-4" />

										<div class="grid grid-cols-2 gap-4 text-xs font-bold">
											<div class="flex flex-col gap-1">
												<span class="text-[9px] uppercase tracking-wider text-white/40">
													{t('owner.quests.rewardFrg')}
												</span>
												<span class="text-white text-sm font-black flex items-center gap-1">
													💰 {q.reward_frg.toLocaleString()}
												</span>
											</div>
											<div class="flex flex-col gap-1">
												<span class="text-[9px] uppercase tracking-wider text-white/40">
													{t('owner.quests.rewardXp')}
												</span>
												<span class="text-white text-sm font-black flex items-center gap-1">
													⚡ {q.reward_xp.toLocaleString()}
												</span>
											</div>
										</div>

										<div class="mt-4 text-[10px] font-bold text-white/30 flex justify-between items-center">
											<span>
												{t('owner.quests.expiry')}:{' '}
												<span class="text-white/60">
													{q.expires_at
														? new Date(q.expires_at).toLocaleDateString()
														: t('owner.quests.noExpiry')}
												</span>
											</span>
										</div>
									</div>
								);
							}}
						</For>
					</div>
				</Show>
			</div>

			{/* CREATE & EDIT QUEST MODAL */}
			<Show when={isModalOpen()}>
				<div class="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#000000]/80 backdrop-blur-md animate-fade-in overflow-y-auto">
					<div class="w-full max-w-md bg-gradient-to-b from-[#1c1d22] to-[#121316] border border-[#2a2c35]/50 rounded-[32px] p-6 shadow-2xl relative my-8">
						<button
							onClick={() => setIsModalOpen(false)}
							class="absolute top-5 end-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all text-white/70"
						>
							<span class="material-symbols-outlined text-[18px]">close</span>
						</button>

						<h2 class="text-lg font-black uppercase tracking-wider text-white mb-6">
							{isEditing() ? t('owner.quests.edit') : t('owner.quests.createBtn')}
						</h2>

						<form onSubmit={handleSubmit} class="space-y-4">
							<div class="flex flex-col gap-1.5">
								<label class="text-[10px] font-black uppercase text-[#a0a4ad]">
									{t('owner.quests.key')}
								</label>
								<input
									type="text"
									required
									disabled={isEditing()}
									value={key()}
									onInput={(e) => setKey(e.currentTarget.value.toLowerCase().replace(/\s+/g, '_'))}
									class="h-11 px-4 bg-[#0f1014] border border-[#2a2c35] focus:border-[#3390ec] text-white text-xs font-bold rounded-2xl focus:outline-none transition-all disabled:opacity-50"
									placeholder="مثلاً join_my_channel"
								/>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="text-[10px] font-black uppercase text-[#a0a4ad]">
									{t('owner.quests.questTitle')}
								</label>
								<input
									type="text"
									required
									value={title()}
									onInput={(e) => setTitle(e.currentTarget.value)}
									class="h-11 px-4 bg-[#0f1014] border border-[#2a2c35] focus:border-[#3390ec] text-white text-xs font-bold rounded-2xl focus:outline-none transition-all"
									placeholder="مثلاً عضویت در کانال رسمی"
								/>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<div class="flex flex-col gap-1.5">
									<label class="text-[10px] font-black uppercase text-[#a0a4ad]">
										{t('owner.quests.rewardFrg')}
									</label>
									<input
										type="number"
										min="0"
										required
										value={rewardFrg()}
										onInput={(e) => setRewardFrg(Number(e.currentTarget.value))}
										class="h-11 px-4 bg-[#0f1014] border border-[#2a2c35] focus:border-[#3390ec] text-white text-xs font-bold rounded-2xl focus:outline-none transition-all"
									/>
								</div>
								<div class="flex flex-col gap-1.5">
									<label class="text-[10px] font-black uppercase text-[#a0a4ad]">
										{t('owner.quests.rewardXp')}
									</label>
									<input
										type="number"
										min="0"
										required
										value={rewardXp()}
										onInput={(e) => setRewardXp(Number(e.currentTarget.value))}
										class="h-11 px-4 bg-[#0f1014] border border-[#2a2c35] focus:border-[#3390ec] text-white text-xs font-bold rounded-2xl focus:outline-none transition-all"
									/>
								</div>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="text-[10px] font-black uppercase text-[#a0a4ad]">
									{t('owner.quests.type')}
								</label>
								<select
									value={type()}
									onChange={(e) => setType(e.currentTarget.value)}
									class="h-11 px-4 bg-[#0f1014] border border-[#2a2c35] focus:border-[#3390ec] text-white text-xs font-bold rounded-2xl focus:outline-none transition-all appearance-none"
								>
									<option value="channel_join">عضویت در کانال تلگرام (بررسی زنده عضویت)</option>
									<option value="quiz">کوییز / معما (بررسی هش شده در سرور)</option>
									<option value="first_username_scan">ثبت نام اولیه (دارای یوزرنیم)</option>
									<option value="register_first_bot">ورود اولیه به ربات</option>
									<option value="campaign">کمپین (گروه‌بندی سایر تسک‌ها)</option>
									<option value="link">لینک سایت (Dumb Verification با تایمر)</option>
									<option value="social">شبکه‌های اجتماعی / توییتر / یوتیوب</option>
								</select>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="text-[10px] font-black uppercase text-[#a0a4ad]">
									کمپین والد (برای زیرمجموعه کردن تسک)
								</label>
								<select
									value={parentKey()}
									onChange={(e) => setParentKey(e.currentTarget.value)}
									class="h-11 px-4 bg-[#0f1014] border border-[#2a2c35] focus:border-[#3390ec] text-white text-xs font-bold rounded-2xl focus:outline-none transition-all appearance-none"
								>
									<option value="">-- بدون والد (مستقل) --</option>
									<For each={quests().filter((q) => q.type === 'campaign' && q.key !== key())}>
										{(q) => <option value={q.key}>{q.title}</option>}
									</For>
								</select>
							</div>

							{/* Dynamic Type Config Inputs */}
							<Show when={type() === 'link' || type() === 'social'}>
								<div class="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3 animate-fade-in">
									<div class="flex flex-col gap-1.5">
										<label class="text-[9px] font-black uppercase text-[#a0a4ad]">
											لینک (URL)
										</label>
										<input
											type="url"
											required
											value={taskUrl()}
											onInput={(e) => setTaskUrl(e.currentTarget.value)}
											class="h-9 px-3 bg-[#0f1014] border border-[#2a2c35] text-white text-xs font-bold rounded-xl focus:outline-none focus:border-[#3390ec] transition-all"
											placeholder="https://t.me/ifragment_net"
										/>
									</div>
								</div>
							</Show>

							<Show when={type() === 'channel_join'}>
								<div class="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3 animate-fade-in">
									<div class="flex flex-col gap-1.5">
										<label class="text-[9px] font-black uppercase text-[#a0a4ad]">
											{t('owner.quests.channelUsername')}
										</label>
										<input
											type="text"
											required
											value={channelUsername()}
											onInput={(e) => setChannelUsername(e.currentTarget.value)}
											class="h-9 px-3 bg-[#0f1014] border border-[#2a2c35] text-white text-xs font-bold rounded-xl focus:outline-none focus:border-[#3390ec] transition-all"
											placeholder="مثلاً @ifragment_channel"
										/>
									</div>
								</div>
							</Show>

							<Show when={type() === 'quiz'}>
								<div class="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3 animate-fade-in">
									<div class="flex flex-col gap-1.5">
										<label class="text-[9px] font-black uppercase text-[#a0a4ad]">
											{t('owner.quests.quizQuestion')}
										</label>
										<input
											type="text"
											required
											value={quizQuestion()}
											onInput={(e) => setQuizQuestion(e.currentTarget.value)}
											class="h-9 px-3 bg-[#0f1014] border border-[#2a2c35] text-white text-xs font-bold rounded-xl focus:outline-none focus:border-[#3390ec] transition-all"
											placeholder="مثلاً ۲ + ۲ چند می‌شود؟"
										/>
									</div>
									<div class="flex flex-col gap-1.5">
										<label class="text-[9px] font-black uppercase text-[#a0a4ad]">
											{t('owner.quests.quizAnswer')}
										</label>
										<input
											type="text"
											required={!isEditing()}
											value={quizAnswer()}
											onInput={(e) => setQuizAnswer(e.currentTarget.value)}
											class="h-9 px-3 bg-[#0f1014] border border-[#2a2c35] text-white text-xs font-bold rounded-xl focus:outline-none focus:border-[#3390ec] transition-all"
											placeholder={isEditing() ? 'برای تغییر ندادن جواب، خالی بگذارید' : 'مثلاً 4'}
										/>
									</div>
								</div>
							</Show>

							<div class="grid grid-cols-2 gap-4">
								<div class="flex flex-col gap-1.5">
									<label class="text-[10px] font-black uppercase text-[#a0a4ad]">
										{t('owner.quests.expiry')}
									</label>
									<input
										type="date"
										value={expiresAt()}
										onInput={(e) => setExpiresAt(e.currentTarget.value)}
										class="h-11 px-4 bg-[#0f1014] border border-[#2a2c35] focus:border-[#3390ec] text-white text-xs font-bold rounded-2xl focus:outline-none transition-all"
									/>
								</div>

								<div class="flex flex-col gap-1.5">
									<label class="text-[10px] font-black uppercase text-[#a0a4ad]">
										{t('owner.quests.status')}
									</label>
									<button
										type="button"
										onClick={() => setIsActive(!isActive())}
										class={`h-11 px-4 text-xs font-bold rounded-2xl border active:scale-95 transition-all select-none ${
											isActive()
												? 'bg-green-500/10 border-green-500/20 text-green-400'
												: 'bg-red-500/10 border-red-500/20 text-red-400'
										}`}
									>
										{isActive() ? t('owner.quests.active') : t('owner.quests.inactive')}
									</button>
								</div>
							</div>

							<div class="pt-4">
								<button
									type="submit"
									disabled={loading()}
									class="w-full h-11 bg-gradient-to-r from-[#3390ec] to-[#287ece] active:scale-95 text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center justify-center"
								>
									{loading() ? t('common.loading') : t('common.save')}
								</button>
							</div>
						</form>
					</div>
				</div>
			</Show>
		</div>
	);
};
