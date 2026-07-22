import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, For, Show } from 'solid-js';
import { ownerApi, SearchedUser } from '@/shared/api/owner.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.js';

export const OwnerUsers: Component = () => {
	const [query, setQuery] = createSignal('');
	const [users, setUsers] = createSignal<SearchedUser[]>([]);
	const [loading, setLoading] = createSignal(false);
	const [error, setError] = createSignal('');
	const [activeFilter, setActiveFilter] = createSignal<'all' | 'premium' | 'flagged' | 'banned'>(
		'all',
	);

	// Selected user for danger actions
	const [selectedUser, setSelectedUser] = createSignal<SearchedUser | null>(null);
	const [actionType, setActionType] = createSignal<
		'frg' | 'ban' | 'unban' | 'flag' | 'impersonate' | null
	>(null);

	// Action Form states
	const [actionStep, setActionStep] = createSignal<'form' | 'confirm'>('confirm');
	const [frgAmount, setFrgAmount] = createSignal<number>(0);
	const [banType, setBanType] = createSignal('full');
	const [banDuration, setBanDuration] = createSignal(86400);
	const [isFlaggedStatus, setIsFlaggedStatus] = createSignal(false);
	const [actionLoading, setActionLoading] = createSignal(false);

	let searchDebounceTimer: any;

	const handleSearchInput = (value: string) => {
		setQuery(value);
		if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
		if (!value.trim()) {
			setUsers([]);
			setError('');
			return;
		}

		searchDebounceTimer = setTimeout(() => {
			executeSearch(value.trim());
		}, 300);
	};

	const executeSearch = async (searchStr: string) => {
		if (!searchStr) return;
		setError('');
		setLoading(true);

		try {
			const data = await ownerApi.searchUsers(searchStr);
			setUsers(data || []);
			if (!data || data.length === 0) {
				setError('هیچ کاربری با شناسه یا مشخصات وارد شده پیدا نشد.');
			}
		} catch (err: any) {
			setError(err.response?.data?.error || 'خطا در برقراری ارتباط با دیتابیس کاربران.');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} finally {
			setLoading(false);
		}
	};

	// Dialog Handlers
	const openFrgModal = (user: SearchedUser) => {
		setSelectedUser(user);
		setFrgAmount(0);
		setActionStep('form');
		setActionType('frg');
	};

	const openBanModal = (user: SearchedUser) => {
		setSelectedUser(user);
		setBanType('full');
		setBanDuration(86400);
		setActionStep('form');
		setActionType('ban');
	};

	const openUnbanModal = (user: SearchedUser) => {
		setSelectedUser(user);
		setActionStep('confirm');
		setActionType('unban');
	};

	const openFlagModal = (user: SearchedUser) => {
		setSelectedUser(user);
		setIsFlaggedStatus(!user.is_flagged);
		setActionStep('confirm');
		setActionType('flag');
	};

	const openImpersonateModal = (user: SearchedUser) => {
		setSelectedUser(user);
		setActionStep('confirm');
		setActionType('impersonate');
	};

	const closeActionModal = () => {
		setSelectedUser(null);
		setActionType(null);
		setActionStep('confirm');
	};

	// Execute Operations
	const handleConfirmedAction = async (reason: string) => {
		const user = selectedUser();
		const currentAction = actionType();
		if (!user || !currentAction) return;

		setActionLoading(true);
		try {
			if (currentAction === 'frg') {
				const res = await ownerApi.adjustFrg(user.telegram_id, frgAmount(), reason);
				if (res.success) {
					setUsers(
						users().map((u) =>
							u.telegram_id === user.telegram_id ? { ...u, balance: res.new_balance } : u,
						),
					);
					hapticFeedback.notificationOccurred('success');
				}
			} else if (currentAction === 'ban') {
				const res = await ownerApi.banUser(user.telegram_id, banType(), reason, banDuration());
				if (res.success) {
					setUsers(
						users().map((u) =>
							u.telegram_id === user.telegram_id
								? { ...u, is_banned: true, ban_reason: reason }
								: u,
						),
					);
					hapticFeedback.notificationOccurred('success');
				}
			} else if (currentAction === 'unban') {
				const res = await ownerApi.unbanUser(user.telegram_id);
				if (res.success) {
					setUsers(
						users().map((u) =>
							u.telegram_id === user.telegram_id
								? { ...u, is_banned: false, ban_reason: undefined }
								: u,
						),
					);
					hapticFeedback.notificationOccurred('success');
				}
			} else if (currentAction === 'flag') {
				const res = await ownerApi.flagUser(user.telegram_id, isFlaggedStatus(), reason);
				if (res.success) {
					setUsers(
						users().map((u) =>
							u.telegram_id === user.telegram_id
								? { ...u, is_flagged: isFlaggedStatus(), fraud_reason: reason }
								: u,
						),
					);
					hapticFeedback.notificationOccurred('success');
				}
			} else if (currentAction === 'impersonate') {
				const res = await ownerApi.impersonateUser(user.telegram_id);
				if (res.token) {
					sessionStorage.setItem('owner_impersonation_token', res.token);
					sessionStorage.setItem('impersonated_user_id', String(user.telegram_id));
					sessionStorage.setItem(
						'impersonated_username',
						user.username || String(user.telegram_id),
					);
					if (user.first_name) sessionStorage.setItem('impersonated_first_name', user.first_name);
					if (user.last_name) sessionStorage.setItem('impersonated_last_name', user.last_name);
					localStorage.removeItem('cached_profile_stats');
					localStorage.removeItem('cached_profile_achievements');
					localStorage.removeItem('cached_profile_referral');
					window.location.href = `${window.location.pathname}#/`;
					window.location.reload();
					return;
				}
			}
			closeActionModal();
		} catch (err: any) {
			setError(err.response?.data?.error || 'عملیات با خطا مواجه شد.');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} finally {
			setActionLoading(false);
		}
	};

	const filteredUsers = () => {
		const filter = activeFilter();
		return users().filter((u) => {
			if (filter === 'premium') return u.is_premium;
			if (filter === 'flagged') return u.is_flagged;
			if (filter === 'banned') return u.is_banned;
			return true;
		});
	};

	const getDialogProps = () => {
		const user = selectedUser();
		const type = actionType();
		if (!user || !type || actionStep() !== 'confirm') return null;

		if (type === 'frg') {
			const currentBal = user.balance || 0;
			const change = frgAmount();
			const newBal = currentBal + change;
			return {
				title: 'تغییر موجودی سکه کاربر (FRG)',
				description: `افزایش یا کاهش موجودی حساب کاربر @${user.username || user.telegram_id}. تمام تغییرات در سامانه حسابرسی ثبت می‌شوند.`,
				actionLabel: 'تأیید و اعمال موجودی',
				riskLevel: (Math.abs(change) > 500000 ? 'high' : 'medium') as 'high' | 'medium',
				details: [
					{ label: 'نام کاربر', value: `${user.first_name} ${user.last_name}` },
					{
						label: 'موجودی سکه',
						before: `${currentBal.toLocaleString()} FRG`,
						after: `${newBal.toLocaleString()} FRG`,
					},
				],
			};
		}

		if (type === 'ban') {
			return {
				title: 'مسدودسازی حساب کاربر (Ban)',
				description: `محدودسازی دسترسی کاربر @${user.username || user.telegram_id} به سیستم iFragment.`,
				actionLabel: 'اعمال مسدودیت',
				confirmWord: 'BAN',
				riskLevel: 'critical' as const,
				details: [
					{ label: 'شناسه تلگرام', value: user.telegram_id },
					{
						label: 'نوع مسدودی',
						value: banType() === 'full' ? 'کامل' : banType() === 'shadow' ? 'شدوبن' : 'کیف پول',
					},
					{
						label: 'مدت زمان',
						value: banDuration() === 0 ? 'دائمی' : `${banDuration() / 3600} ساعت`,
					},
				],
			};
		}

		if (type === 'unban') {
			return {
				title: 'رفع مسدودیت کاربر (Unban)',
				description: `رفع تمامی محدودیت‌های حساب کاربر @${user.username || user.telegram_id}.`,
				actionLabel: 'رفع مسدودیت',
				riskLevel: 'medium' as const,
				details: [{ label: 'شناسه تلگرام', value: user.telegram_id }],
			};
		}

		if (type === 'flag') {
			return {
				title: isFlaggedStatus() ? 'نشانگذاری به عنوان متخلف' : 'حذف وضعیت متخلف',
				description: `تغییر وضعیت ریسک امنیتی حساب کاربر @${user.username || user.telegram_id}.`,
				actionLabel: 'ثبت وضعیت جدید',
				riskLevel: 'medium' as const,
				details: [{ label: 'وضعیت جدید', value: isFlaggedStatus() ? 'مشکوک به تقلب' : 'عادی' }],
			};
		}

		if (type === 'impersonate') {
			return {
				title: 'شبیه‌سازی حساب (Impersonation)',
				description: `ورود به حساب کاربر @${user.username || user.telegram_id} در حالت شبیه‌سازی خواندنی (Read-Only Simulation).`,
				actionLabel: 'آغاز شبیه‌سازی',
				confirmWord: 'SIMULATE',
				riskLevel: 'high' as const,
				details: [{ label: 'حساب هدف', value: `@${user.username || user.telegram_id}` }],
			};
		}

		return null;
	};

	return (
		<div class="space-y-6">
			{/* Search Box & Header */}
			<div class="bg-[#16171d]/60 border border-white/5 rounded-3xl p-5 space-y-4">
				<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<h2 class="text-sm font-black text-white">مدیریت و جستجوی کاربران</h2>
						<p class="text-xs text-white/40 font-bold mt-0.5">
							جستجو بر اساس نام کاربری، نام، یا شناسه عددی تلگرام
						</p>
					</div>

					{/* Category Filters */}
					<div class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
						<button
							onClick={() => setActiveFilter('all')}
							class={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
								activeFilter() === 'all'
									? 'bg-[#3390ec] text-white'
									: 'bg-white/5 text-white/60 hover:bg-white/10'
							}`}
						>
							همه ({users().length})
						</button>
						<button
							onClick={() => setActiveFilter('premium')}
							class={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
								activeFilter() === 'premium'
									? 'bg-teal-500 text-black'
									: 'bg-white/5 text-teal-400 hover:bg-white/10'
							}`}
						>
							پرمیوم
						</button>
						<button
							onClick={() => setActiveFilter('flagged')}
							class={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
								activeFilter() === 'flagged'
									? 'bg-amber-500 text-black'
									: 'bg-white/5 text-amber-400 hover:bg-white/10'
							}`}
						>
							متخلفان
						</button>
						<button
							onClick={() => setActiveFilter('banned')}
							class={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
								activeFilter() === 'banned'
									? 'bg-red-500 text-white'
									: 'bg-white/5 text-red-400 hover:bg-white/10'
							}`}
						>
							مسدودین
						</button>
					</div>
				</div>

				<div class="flex gap-2.5">
					<div class="flex-1 bg-black/40 border border-white/10 focus-within:border-[#3390ec] rounded-2xl px-4 flex items-center gap-2.5 transition-all">
						<span class="material-symbols-outlined text-white/40 text-[20px]">search</span>
						<input
							type="text"
							placeholder="تایپ کنید (مثلاً @username یا 12345678)..."
							value={query()}
							onInput={(e) => handleSearchInput(e.currentTarget.value)}
							class="w-full h-12 bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
						/>
					</div>
					<button
						onClick={() => executeSearch(query())}
						disabled={loading() || !query().trim()}
						class="h-12 px-6 bg-[#3390ec] hover:bg-[#2b7ec9] text-xs font-black uppercase text-white rounded-2xl active:scale-95 transition-all disabled:opacity-40"
					>
						جستجو
					</button>
				</div>
			</div>

			{/* Status Feedback */}
			<Show when={error()}>
				<div class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold">
					<span class="material-symbols-outlined text-xl">info</span>
					<span>{error()}</span>
				</div>
			</Show>

			<Show when={loading()}>
				<div class="flex flex-col items-center justify-center py-16 gap-3">
					<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
					<span class="text-xs text-white/50 font-bold">در حال جستجو در بانک اطلاعاتی...</span>
				</div>
			</Show>

			{/* Results List */}
			<Show when={!loading() && filteredUsers().length > 0}>
				<div class="space-y-4">
					<For each={filteredUsers()}>
						{(user) => (
							<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 hover:border-white/20 transition-all space-y-4">
								<div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
									<div class="space-y-1">
										<div class="flex items-center gap-2 flex-wrap">
											<h3 class="text-sm font-black text-white">
												{user.first_name} {user.last_name}
											</h3>
											<Show when={user.is_premium}>
												<span class="px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/30 text-[9px] font-black text-teal-400">
													پرمیوم
												</span>
											</Show>
											<Show when={user.is_flagged}>
												<span class="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[9px] font-black text-amber-400 flex items-center gap-1">
													⚠️ متخلف
												</span>
											</Show>
											<Show when={user.is_banned}>
												<span class="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-[9px] font-black text-red-400">
													⛔ مسدود
												</span>
											</Show>
										</div>

										<div class="flex items-center gap-3 text-xs">
											<span class="text-[#3390ec] font-bold">@{user.username || 'بدون شناسه'}</span>
											<span class="text-white/40 font-mono text-[10px]">
												ID: {user.telegram_id}
											</span>
											<Show when={user.language_code}>
												<span class="text-white/30 text-[10px] uppercase font-mono">
													زبان: {user.language_code}
												</span>
											</Show>
										</div>
									</div>

									<div class="text-start md:text-end">
										<span class="text-[10px] text-white/40 font-bold block">موجودی سکه</span>
										<span class="text-base font-black text-amber-400 font-mono">
											{Math.round(user.balance || 0).toLocaleString()} FRG
										</span>
									</div>
								</div>

								{/* Action Buttons */}
								<div class="pt-3 border-t border-white/5 flex gap-2 flex-wrap">
									<button
										onClick={() => openImpersonateModal(user)}
										class="h-8 px-3 bg-[#3390ec]/10 hover:bg-[#3390ec]/20 border border-[#3390ec]/30 text-[10px] font-bold text-[#3390ec] rounded-xl transition-all flex items-center gap-1 active:scale-95"
									>
										<span class="material-symbols-outlined text-[14px]">visibility</span>
										ورود به جای کاربر
									</button>

									<button
										onClick={() => openFrgModal(user)}
										class="h-8 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-400 rounded-xl transition-all flex items-center gap-1 active:scale-95"
									>
										<span class="material-symbols-outlined text-[14px]">
											account_balance_wallet
										</span>
										تغییر موجودی
									</button>

									<button
										onClick={() => openBanModal(user)}
										class="h-8 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-[10px] font-bold text-red-400 rounded-xl transition-all flex items-center gap-1 active:scale-95"
									>
										<span class="material-symbols-outlined text-[14px]">block</span>
										مسدود کردن
									</button>

									<button
										onClick={() => openUnbanModal(user)}
										class="h-8 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white/70 rounded-xl transition-all flex items-center gap-1 active:scale-95"
									>
										<span class="material-symbols-outlined text-[14px]">lock_open</span>
										رفع مسدودیت
									</button>

									<button
										onClick={() => openFlagModal(user)}
										class="h-8 px-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-[10px] font-bold text-orange-400 rounded-xl transition-all flex items-center gap-1 active:scale-95"
									>
										<span class="material-symbols-outlined text-[14px]">flag</span>
										{user.is_flagged ? 'حذف نشان متخلف' : 'نشانگذاری متخلف'}
									</button>
								</div>
							</div>
						)}
					</For>
				</div>
			</Show>

			{/* Form Controls embedded prior to Danger Confirmation */}
			<Show when={actionType() === 'frg' && actionStep() === 'form' && selectedUser()}>
				<div class="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
					<div class="w-full max-w-sm bg-[#16171d] border border-white/10 rounded-3xl p-5 space-y-4">
						<h3 class="text-sm font-black text-white">ورود مقدار تغییر موجودی</h3>
						<div>
							<label class="block text-[10px] text-white/50 font-bold mb-1">
								مقدار تغییر (سکه FRG)
							</label>
							<input
								type="number"
								placeholder="مثال: 50000 یا -20000"
								value={frgAmount() || ''}
								onInput={(e) => setFrgAmount(Number(e.currentTarget.value))}
								class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white focus:border-[#3390ec] outline-none"
							/>
						</div>
						<div class="flex gap-2">
							<button
								onClick={closeActionModal}
								class="flex-1 h-10 bg-white/5 text-xs font-bold rounded-xl"
							>
								انصراف
							</button>
							<button
								onClick={() => frgAmount() !== 0 && setActionStep('confirm')}
								disabled={frgAmount() === 0}
								class="flex-1 h-10 bg-amber-500 text-black text-xs font-black rounded-xl disabled:opacity-40"
							>
								مرحله بعد (تأییدیه)
							</button>
						</div>
					</div>
				</div>
			</Show>

			<Show when={actionType() === 'ban' && actionStep() === 'form' && selectedUser()}>
				<div class="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
					<div class="w-full max-w-sm bg-[#16171d] border border-white/10 rounded-3xl p-5 space-y-4">
						<h3 class="text-sm font-black text-white">تنظیم پارامترهای مسدودسازی</h3>
						<div>
							<label class="block text-[10px] text-white/50 font-bold mb-1">سطح مسدودسازی</label>
							<select
								value={banType()}
								onChange={(e) => setBanType(e.currentTarget.value)}
								class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-3 text-xs text-white outline-none"
							>
								<option value="full">مسدودی کامل (عدم ورود)</option>
								<option value="shadow">شدوبن (پنهان)</option>
								<option value="wallet_freeze">قفل کیف پول</option>
							</select>
						</div>
						<div>
							<label class="block text-[10px] text-white/50 font-bold mb-1">مدت زمان</label>
							<select
								value={banDuration()}
								onChange={(e) => setBanDuration(Number(e.currentTarget.value))}
								class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-3 text-xs text-white outline-none"
							>
								<option value={3600}>۱ ساعت</option>
								<option value={86400}>۲۴ ساعت</option>
								<option value={604800}>۷ روز</option>
								<option value={0}>دائمی</option>
							</select>
						</div>
						<div class="flex gap-2">
							<button
								onClick={closeActionModal}
								class="flex-1 h-10 bg-white/5 text-xs font-bold rounded-xl"
							>
								انصراف
							</button>
							<button
								onClick={() => setActionStep('confirm')}
								class="flex-1 h-10 bg-red-500 text-white text-xs font-black rounded-xl"
							>
								مرحله بعد (تأییدیه)
							</button>
						</div>
					</div>
				</div>
			</Show>

			{/* Danger Action Review Dialog */}
			<Show when={getDialogProps()}>
				{(dialogProps) => (
					<DangerActionDialog
						isOpen={true}
						title={dialogProps().title}
						description={dialogProps().description}
						actionLabel={dialogProps().actionLabel}
						confirmWord={dialogProps().confirmWord}
						riskLevel={dialogProps().riskLevel}
						details={dialogProps().details}
						loading={actionLoading()}
						onConfirm={handleConfirmedAction}
						onClose={closeActionModal}
					/>
				)}
			</Show>
		</div>
	);
};
