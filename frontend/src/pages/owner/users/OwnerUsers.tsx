import { useNavigate } from '@solidjs/router';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, For, Show } from 'solid-js';
import { apiClient } from '@/shared/api/axios.js';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';

interface SearchedUser {
	telegram_id: number;
	username: string;
	first_name: string;
	last_name: string;
	language_code: string;
	created_at: string;
	balance: number;
	is_premium: boolean;
	is_flagged: boolean;
	fraud_reason: string;
}

export const OwnerUsers: Component = () => {
	const navigate = useNavigate();

	const showTmaAlert = (message: string) => {
		const tg = (window as any).Telegram?.WebApp;
		if (tg?.showAlert) {
			tg.showAlert(message);
		} else {
			alert(message);
		}
	};

	const showTmaConfirm = (message: string, onConfirm: () => void) => {
		const tg = (window as any).Telegram?.WebApp;
		if (tg?.showConfirm) {
			tg.showConfirm(message, (ok: boolean) => {
				if (ok) onConfirm();
			});
		} else {
			if (confirm(message)) {
				onConfirm();
			}
		}
	};
	const [query, setQuery] = createSignal('');
	const [users, setUsers] = createSignal<SearchedUser[]>([]);
	const [loading, setLoading] = createSignal(false);
	const [error, setError] = createSignal('');

	// Modals signals
	const [selectedUser, setSelectedUser] = createSignal<SearchedUser | null>(null);
	const [showFrgModal, setShowFrgModal] = createSignal(false);
	const [showBanModal, setShowBanModal] = createSignal(false);

	// FRG Form inputs
	const [frgAmount, setFrgAmount] = createSignal<number>(0);
	const [frgReason, setFrgReason] = createSignal('');
	const [frgLoading, setFrgLoading] = createSignal(false);

	// Ban Form inputs
	const [banType, setBanType] = createSignal('full'); // 'full', 'shadow', 'wallet_freeze'
	const [banReason, setBanReason] = createSignal('');
	const [banDuration, setBanDuration] = createSignal(86400); // 1 day default (in seconds)
	const [banLoading, setBanLoading] = createSignal(false);

	// Flag Form inputs
	const [showFlagModal, setShowFlagModal] = createSignal(false);
	const [flagReason, setFlagReason] = createSignal('');
	const [isFlaggedStatus, setIsFlaggedStatus] = createSignal(false);
	const [flagLoading, setFlagLoading] = createSignal(false);

	const handleSearch = async (e?: Event) => {
		if (e) e.preventDefault();
		if (!query().trim()) return;

		setError('');
		setLoading(true);
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}

		try {
			const resp = await apiClient.get(
				`/owner/users/search?q=${encodeURIComponent(query().trim())}`,
			);
			setUsers(resp.data || []);
			if (resp.data.length === 0) {
				setError('No users found matching your search query.');
			}
		} catch (err: any) {
			setError(err.response?.data?.error || 'User lookup failed.');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} finally {
			setLoading(false);
		}
	};

	const handleImpersonate = (user: SearchedUser) => {
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}

		showTmaConfirm(
			`Are you sure you want to impersonate @${user.username || user.telegram_id}? You will enter read-only simulation mode.`,
			async () => {
				try {
					const resp = await apiClient.post('/owner/users/impersonate', {
						user_id: user.telegram_id,
					});
					const { token } = resp.data;
					if (token) {
						try {
							hapticFeedback.notificationOccurred('success');
						} catch {}
						// Save the impersonation token in sessionStorage for transient security
						sessionStorage.setItem('owner_impersonation_token', token);
						sessionStorage.setItem('impersonated_user_id', String(user.telegram_id));
						sessionStorage.setItem(
							'impersonated_username',
							user.username || String(user.telegram_id),
						);
						// Clear cached owner profile data so impersonated user gets fresh data
						localStorage.removeItem('cached_profile_stats');
						localStorage.removeItem('cached_profile_achievements');
						localStorage.removeItem('cached_profile_referral');
						// Redirect to home under impersonation context.
						// Use direct location change (not navigate+reload) to avoid race conditions.
						window.location.href = window.location.pathname + '#/';
						window.location.reload();
					}
				} catch (err: any) {
					showTmaAlert(err.response?.data?.error || 'Failed to initialize impersonation session.');
					try {
						hapticFeedback.notificationOccurred('error');
					} catch {}
				}
			},
		);
	};

	const handleOpenFrgModal = (user: SearchedUser) => {
		try {
			hapticFeedback.impactOccurred('light');
		} catch {}
		setSelectedUser(user);
		setFrgAmount(0);
		setFrgReason('');
		setShowFrgModal(true);
	};

	const handleOpenBanModal = (user: SearchedUser) => {
		try {
			hapticFeedback.impactOccurred('light');
		} catch {}
		setSelectedUser(user);
		setBanReason('');
		setBanType('full');
		setBanDuration(86400);
		setShowBanModal(true);
	};

	const handleOpenFlagModal = (user: SearchedUser) => {
		try {
			hapticFeedback.impactOccurred('light');
		} catch {}
		setSelectedUser(user);
		setFlagReason(user.fraud_reason || '');
		setIsFlaggedStatus(!user.is_flagged);
		setShowFlagModal(true);
	};

	const submitFrgAdjustment = async (e: Event) => {
		e.preventDefault();
		const user = selectedUser();
		if (!user || frgAmount() === 0 || !frgReason().trim()) return;

		setFrgLoading(true);
		try {
			const resp = await apiClient.post('/owner/users/adjust-frg', {
				user_id: user.telegram_id,
				amount: frgAmount(),
				reason: frgReason().trim(),
			});

			if (resp.data.success) {
				try {
					hapticFeedback.notificationOccurred('success');
				} catch {}
				// Update user balance locally in the view list
				setUsers(
					users().map((u) =>
						u.telegram_id === user.telegram_id ? { ...u, balance: resp.data.new_balance } : u,
					),
				);
				setShowFrgModal(false);
			}
		} catch (err: any) {
			showTmaAlert(err.response?.data?.error || 'FRG adjustment failed.');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} finally {
			setFrgLoading(false);
		}
	};

	const submitBanOperation = async (e: Event) => {
		e.preventDefault();
		const user = selectedUser();
		if (!user || !banReason().trim()) return;

		setBanLoading(true);
		try {
			const resp = await apiClient.post('/owner/users/ban', {
				user_id: user.telegram_id,
				ban_type: banType(),
				reason: banReason().trim(),
				duration_seconds: banDuration(),
			});

			if (resp.data.success) {
				try {
					hapticFeedback.notificationOccurred('success');
				} catch {}
				setShowBanModal(false);
			}
		} catch (err: any) {
			showTmaAlert(err.response?.data?.error || 'Account suspension failed.');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} finally {
			setBanLoading(false);
		}
	};

	const handleUnban = (user: SearchedUser) => {
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}

		showTmaConfirm(
			`Are you sure you want to remove all suspensions for user ${user.username || user.telegram_id}?`,
			async () => {
				try {
					const resp = await apiClient.post('/owner/users/unban', { user_id: user.telegram_id });
					if (resp.data.success) {
						try {
							hapticFeedback.notificationOccurred('success');
						} catch {}
						showTmaAlert('All bans and locks successfully lifted.');
					}
				} catch (err: any) {
					showTmaAlert(err.response?.data?.error || 'Failed to remove bans.');
					try {
						hapticFeedback.notificationOccurred('error');
					} catch {}
				}
			},
		);
	};

	const submitFlagOperation = async (e: Event) => {
		e.preventDefault();
		const user = selectedUser();
		if (!user) return;

		setFlagLoading(true);
		try {
			const resp = await apiClient.post('/owner/users/flag', {
				user_id: user.telegram_id,
				is_flagged: isFlaggedStatus(),
				fraud_reason: flagReason().trim(),
			});

			if (resp.data.success) {
				try {
					hapticFeedback.notificationOccurred('success');
				} catch {}
				setUsers(
					users().map((u) =>
						u.telegram_id === user.telegram_id ? { ...u, is_flagged: isFlaggedStatus(), fraud_reason: flagReason().trim() } : u,
					),
				);
				setShowFlagModal(false);
			}
		} catch (err: any) {
			showTmaAlert(err.response?.data?.error || 'Flagging operation failed.');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} finally {
			setFlagLoading(false);
		}
	};

	const handleNav = (path: string) => {
		try {
			hapticFeedback.impactOccurred('light');
		} catch {}
		navigate(path);
	};

	return (
		<div class="min-h-screen bg-[#090a0f] text-white pb-32">
			{/* Glow header */}
			<div class="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-[#3390ec]/15 to-transparent pointer-events-none blur-[60px]" />

			{/* Header */}
			<div class="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/5 relative z-10">
				<div class="flex items-center gap-3">
					<div
						onClick={() => handleNav('/owner/dashboard')}
						class="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 active:scale-95 transition-all"
					>
						<span class="material-symbols-outlined text-[18px] text-white/70">chevron_left</span>
					</div>
					<div>
						<h1 class="text-sm font-black uppercase tracking-wider text-white">کاربران</h1>
						<p class="text-[9px] text-[#3390ec] font-black uppercase tracking-widest mt-0.5">
							مدیریت
						</p>
					</div>
				</div>
			</div>

			{/* Sub tabs */}
			<OwnerTabs active="users" />

			{/* Main Area */}
			<div class="px-6 mt-6 relative z-10">
				{/* Search form */}
				<form onSubmit={handleSearch} class="flex gap-2.5 mb-6">
					<div class="flex-1 bg-[#16171d]/60 border border-[#2a2c35]/50 focus-within:border-[#3390ec] rounded-2xl px-4 flex items-center gap-2.5 transition-all">
						<span class="material-symbols-outlined text-white/40 text-[20px]">search</span>
						<input
							type="text"
							placeholder="نام کاربری، نام، شناسه تلگرام..."
							value={query()}
							onInput={(e) => setQuery(e.currentTarget.value)}
							class="w-full h-12 bg-transparent text-xs text-white placeholder-white/30 focus:outline-none"
						/>
					</div>
					<button
						type="submit"
						class="h-12 px-6 bg-[#3390ec] hover:bg-[#2b7ec9] text-xs font-black uppercase tracking-wider text-white rounded-2xl shadow-lg shadow-[#3390ec]/10 active:scale-95 transition-all"
					>
						جستجو
					</button>
				</form>

				{/* Info/Errors */}
				<Show when={error()}>
					<div class="p-4 bg-red-500/10 border border-red-500/20 rounded-3xl text-center py-6">
						<span class="material-symbols-outlined text-red-500 text-3xl mb-2">info</span>
						<p class="text-xs text-red-400 font-bold leading-relaxed">{error()}</p>
					</div>
				</Show>

				<Show when={loading()}>
					<div class="flex flex-col items-center justify-center py-12 gap-4">
						<div class="w-10 h-10 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
						<span class="text-xs text-[#a0a4ad] font-bold">در حال جستجو در دیتابیس...</span>
					</div>
				</Show>

				{/* Search Results List */}
				<Show when={!loading() && users().length > 0}>
					<div class="flex flex-col gap-3.5">
						<For each={users()}>
							{(user) => (
								<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 hover:scale-[1.01] transition-all">
									<div class="flex justify-between items-start mb-3">
										<div class="flex flex-col gap-0.5">
											<div class="flex items-center gap-2">
												<span class="text-xs font-black text-white truncate max-w-[140px]">
													{user.first_name} {user.last_name}
												</span>
												<Show when={user.is_premium}>
													<span class="px-2 py-0.5 rounded bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-500/30 text-[8px] font-black uppercase tracking-wider text-teal-400">
														پرمیوم
													</span>
												</Show>
												<Show when={user.is_flagged}>
													<span class="px-2 py-0.5 rounded bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 text-[8px] font-black uppercase tracking-wider text-orange-400 flex items-center gap-1" title={user.fraud_reason}>
														<span class="material-symbols-outlined text-[10px]">warning</span>
														متخلف
													</span>
												</Show>
											</div>
											<span class="text-[10px] text-[#3390ec] font-bold">
												@{user.username || 'no-username'}
											</span>
											<span class="text-[9px] text-[#a0a4ad] font-bold mt-1">
												ID: {user.telegram_id}
											</span>
										</div>

										<div class="flex flex-col items-end">
											<span class="text-[10px] text-[#a0a4ad] font-black uppercase tracking-wider">
												موجودی سکه
											</span>
											<span class="text-sm font-black text-[#ffcc00] mt-0.5">
												{Math.round(user.balance).toLocaleString()} سکه
											</span>
										</div>
									</div>

									{/* Actions Area */}
									<div class="pt-3.5 border-t border-white/5 flex gap-2 flex-wrap">
										<button
											onClick={() => handleImpersonate(user)}
											class="h-8 px-3 bg-gradient-to-r from-[#3390ec]/15 to-[#3390ec]/5 hover:from-[#3390ec]/25 border border-[#3390ec]/30 text-[9px] font-black uppercase tracking-wider text-[#3390ec] rounded-xl active:scale-95 transition-all flex items-center gap-1"
										>
											<span class="material-symbols-outlined text-[12px]">visibility</span>
											ورود به جای کاربر
										</button>

										<button
											onClick={() => handleOpenFrgModal(user)}
											class="h-8 px-3 bg-[#ffcc00]/10 hover:bg-[#ffcc00]/20 border border-[#ffcc00]/30 text-[9px] font-black uppercase tracking-wider text-[#ffcc00] rounded-xl active:scale-95 transition-all flex items-center gap-1"
										>
											<span class="material-symbols-outlined text-[12px]">
												account_balance_wallet
											</span>
											تغییر موجودی
										</button>

										<button
											onClick={() => handleOpenBanModal(user)}
											class="h-8 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-[9px] font-black uppercase tracking-wider text-red-400 rounded-xl active:scale-95 transition-all flex items-center gap-1"
										>
											<span class="material-symbols-outlined text-[12px]">block</span>
											مسدود کردن
										</button>

										<button
											onClick={() => handleUnban(user)}
											class="h-8 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-black uppercase tracking-wider text-white/70 hover:text-white rounded-xl active:scale-95 transition-all flex items-center gap-1"
										>
											<span class="material-symbols-outlined text-[12px]">lock_open</span>
											رفع مسدودیت
										</button>

										<button
											onClick={() => handleOpenFlagModal(user)}
											class="h-8 px-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-[9px] font-black uppercase tracking-wider text-orange-400 rounded-xl active:scale-95 transition-all flex items-center gap-1"
										>
											<span class="material-symbols-outlined text-[12px]">flag</span>
											{user.is_flagged ? 'حذف وضعیت متخلف' : 'نشان‌گذاری به عنوان متخلف'}
										</button>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>
			</div>

			{/* Modal 1: FRG Adjustment Modal */}
			<Show when={showFrgModal() && selectedUser()}>
				<div class="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#000000]/80 backdrop-blur-md animate-fade-in">
					<div class="w-full max-w-sm bg-gradient-to-b from-[#1c1d22] to-[#121316] border border-[#2a2c35]/50 rounded-[32px] p-6 shadow-2xl relative">
						<button
							onClick={() => setShowFrgModal(false)}
							class="absolute top-5 end-5 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 active:scale-95 transition-all"
						>
							<span class="material-symbols-outlined text-[18px] text-white/70">close</span>
						</button>

						<h2 class="text-sm font-black uppercase tracking-wider text-white mb-4">
							تغییر موجودی کاربر
						</h2>
						<p class="text-[10px] text-[#a0a4ad] font-bold mb-4">
							مقادیر مثبت موجودی را افزایش می‌دهند. مقادیر منفی باعث کسر از حساب می‌شوند. 
							علت تغییر در لاگ‌ها ثبت خواهد شد.
						</p>

						<form onSubmit={submitFrgAdjustment} class="flex flex-col gap-4">
							<div class="flex flex-col gap-1.5">
								<label class="text-[9px] text-[#a0a4ad] font-black uppercase tracking-wider">
									مقدار تغییر (سکه)
								</label>
								<input
									type="number"
									placeholder="مثلاً 50000 یا -20000"
									value={frgAmount() || ''}
									onInput={(e) => setFrgAmount(Number(e.currentTarget.value))}
									class="w-full h-12 bg-[#0f1014] border border-[#2a2c35] focus:border-[#ffcc00] rounded-2xl px-4 text-xs text-white font-bold focus:outline-none transition-all"
									required
								/>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="text-[9px] text-[#a0a4ad] font-black uppercase tracking-wider">
									علت تغییر برای لاگ امنیتی
								</label>
								<textarea
									placeholder="مثلاً جایزه قرعه‌کشی یا رفع مشکل خرید"
									value={frgReason()}
									onInput={(e) => setFrgReason(e.currentTarget.value)}
									class="w-full h-20 bg-[#0f1014] border border-[#2a2c35] focus:border-[#ffcc00] rounded-2xl p-4 text-xs text-white focus:outline-none transition-all resize-none"
									required
								/>
							</div>

							<button
								type="submit"
								disabled={frgLoading()}
								class="w-full h-12 bg-[#ffcc00] hover:bg-[#e6b800] text-xs font-black uppercase tracking-wider text-[#0f1014] rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-[#ffcc00]/10"
							>
								<Show when={frgLoading()} fallback="اعمال تغییرات">
									<div class="w-5 h-5 border-2 border-[#0f1014] border-t-transparent rounded-full animate-spin" />
								</Show>
							</button>
						</form>
					</div>
				</div>
			</Show>

			{/* Modal: Flag User */}
			<Show when={showFlagModal() && selectedUser()}>
				<div class="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#000000]/80 backdrop-blur-md animate-fade-in">
					<div class="w-full max-w-sm bg-gradient-to-b from-[#1c1d22] to-[#121316] border border-[#2a2c35]/50 rounded-[32px] p-6 shadow-2xl relative">
						<button
							onClick={() => setShowFlagModal(false)}
							class="absolute top-5 end-5 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 active:scale-95 transition-all"
						>
							<span class="material-symbols-outlined text-[18px] text-white/70">close</span>
						</button>

						<h2 class="text-sm font-black uppercase tracking-wider text-white mb-4">
							{isFlaggedStatus() ? 'نشان‌گذاری به عنوان متخلف' : 'حذف وضعیت متخلف'}
						</h2>
						<p class="text-[10px] text-[#a0a4ad] font-bold mb-4">
							کاربرانی که نشان‌گذاری می‌شوند در لیست بررسی قرار می‌گیرند.
						</p>

						<form onSubmit={submitFlagOperation} class="flex flex-col gap-4">
							<Show when={isFlaggedStatus()}>
								<div class="flex flex-col gap-1.5">
									<label class="text-[9px] text-[#a0a4ad] font-black uppercase tracking-wider">
										علت تخلف
									</label>
									<textarea
										placeholder="مثلاً استفاده از بات‌های خودکار، تقلب در دعوت دوستان..."
										value={flagReason()}
										onInput={(e) => setFlagReason(e.currentTarget.value)}
										class="w-full h-20 bg-[#0f1014] border border-[#2a2c35] focus:border-[#ff9500] rounded-2xl p-4 text-xs text-white focus:outline-none transition-all resize-none"
										required
									/>
								</div>
							</Show>

							<button
								type="submit"
								disabled={flagLoading()}
								class={`w-full h-12 text-xs font-black uppercase tracking-wider rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg ${
									isFlaggedStatus()
										? 'bg-[#ff9500] hover:bg-[#e68600] text-[#0f1014] shadow-[#ff9500]/10'
										: 'bg-white/10 hover:bg-white/20 text-white shadow-white/5'
								}`}
							>
								<Show when={flagLoading()} fallback="ثبت وضعیت">
									<div class="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
								</Show>
							</button>
						</form>
					</div>
				</div>
			</Show>

			{/* Modal 2: Ban/Suspension Modal */}
			<Show when={showBanModal() && selectedUser()}>
				<div class="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#000000]/80 backdrop-blur-md animate-fade-in">
					<div class="w-full max-w-sm bg-gradient-to-b from-[#1c1d22] to-[#121316] border border-[#2a2c35]/50 rounded-[32px] p-6 shadow-2xl relative">
						<button
							onClick={() => setShowBanModal(false)}
							class="absolute top-5 end-5 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 active:scale-95 transition-all"
						>
							<span class="material-symbols-outlined text-[18px] text-white/70">close</span>
						</button>

						<h2 class="text-sm font-black uppercase tracking-wider text-white mb-4">
							مسدودسازی حساب
						</h2>
						<p class="text-[10px] text-[#a0a4ad] font-bold mb-4">
							دسترس‌های کاربر محدود می‌شود و تمامی این محدودیت‌ها در لاگ سرور ثبت می‌گردد.
						</p>

						<form onSubmit={submitBanOperation} class="flex flex-col gap-4">
							<div class="flex flex-col gap-1.5">
								<label class="text-[9px] text-[#a0a4ad] font-black uppercase tracking-wider">
									سطح مسدودسازی
								</label>
								<select
									value={banType()}
									onChange={(e) => setBanType(e.currentTarget.value)}
									class="w-full h-12 bg-[#0f1014] border border-[#2a2c35] focus:border-red-500 rounded-2xl px-4 text-xs text-white focus:outline-none transition-all"
								>
									<option value="full">مسدودی کامل (عدم اجازه ورود)</option>
									<option value="shadow">شدوبن (کاربر متوجه مسدودی نمی‌شود)</option>
									<option value="wallet_freeze">قفل کیف پول (عدم اجازه انتقال)</option>
								</select>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="text-[9px] text-[#a0a4ad] font-black uppercase tracking-wider">
									مدت زمان
								</label>
								<select
									value={banDuration()}
									onChange={(e) => setBanDuration(Number(e.currentTarget.value))}
									class="w-full h-12 bg-[#0f1014] border border-[#2a2c35] focus:border-red-500 rounded-2xl px-4 text-xs text-white focus:outline-none transition-all"
								>
									<option value={3600}>۱ ساعت</option>
									<option value={86400}>۱ روز</option>
									<option value={604800}>۱ هفته</option>
									<option value={0}>دائمی</option>
								</select>
							</div>

							<div class="flex flex-col gap-1.5">
								<label class="text-[9px] text-[#a0a4ad] font-black uppercase tracking-wider">
									علت مسدودسازی
								</label>
								<textarea
									placeholder="مثلاً استفاده از اتوکلیکر یا تقلب در زیرمجموعه گیری"
									value={banReason()}
									onInput={(e) => setBanReason(e.currentTarget.value)}
									class="w-full h-20 bg-[#0f1014] border border-[#2a2c35] focus:border-red-500 rounded-2xl p-4 text-xs text-white focus:outline-none transition-all resize-none"
									required
								/>
							</div>

							<button
								type="submit"
								disabled={banLoading()}
								class="w-full h-12 bg-red-500 hover:bg-red-600 text-xs font-black uppercase tracking-wider text-white rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-red-500/10"
							>
								<Show when={banLoading()} fallback="اعمال محدودیت">
									<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
								</Show>
							</button>
						</form>
					</div>
				</div>
			</Show>
		</div>
	);
};
