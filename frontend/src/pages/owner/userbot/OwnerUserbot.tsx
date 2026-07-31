
import { Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { ManagedUserbot, ownerApi } from '@/shared/api/owner.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.js';
import { haptic } from '@/shared/lib/haptic.js';

export const OwnerUserbot: Component = () => {
	const [phone, setPhone] = createSignal('');
	const [code, setCode] = createSignal('');
	const [password2FA, setPassword2FA] = createSignal('');
	const [phoneCodeHash, setPhoneCodeHash] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	const [successMsg, setSuccessMsg] = createSignal('');
	const [errorMsg, setErrorMsg] = createSignal('');
	const [step, setStep] = createSignal<'phone' | 'code'>('phone');
	const [resendTimer, setResendTimer] = createSignal(0);
	let countdownInterval: any;

	const [userbots, setUserbots] = createSignal<ManagedUserbot[]>([]);
	const [loadingBots, setLoadingBots] = createSignal(true);

	// Danger action dialog state
	const [deletingBotId, setDeletingBotId] = createSignal<string | null>(null);

	const loadUserbots = async () => {
		try {
			setLoadingBots(true);
			const bots = await ownerApi.listUserbots();
			setUserbots(bots || []);
		} catch (err: any) {
			setErrorMsg(err.response?.data?.error || 'خطا در بارگذاری لیست ربات‌ها');
		}
		setLoadingBots(false);
	};

	onMount(() => {
		loadUserbots();
	});

	onCleanup(() => {
		if (countdownInterval) clearInterval(countdownInterval);
	});

	const startResendCountdown = () => {
		setResendTimer(60);
		if (countdownInterval) clearInterval(countdownInterval);
		countdownInterval = setInterval(() => {
			if (resendTimer() > 0) {
				setResendTimer((t) => t - 1);
			} else {
				clearInterval(countdownInterval);
			}
		}, 1000);
	};

	const maskPhoneNumber = (num: string): string => {
		if (!num || num.length < 7) return num;
		return `${num.slice(0, 4)} **** ${num.slice(-3)}`;
	};

	const handleSendCode = async () => {
		const rawPhone = phone().trim();
		if (!rawPhone?.startsWith('+')) {
			setErrorMsg('لطفاً شماره تلفن معتبر همراه با پیش‌شماره کشور (مانند 989123456789+) وارد کنید.');
			return;
		}

		try {
			setLoading(true);
			setErrorMsg('');
			haptic.impact('light');

			const resp = await ownerApi.sendUserbotCode(rawPhone);
			setPhoneCodeHash(resp.phone_code_hash);
			setStep('code');
			startResendCountdown();
		} catch (err: any) {
			setErrorMsg(err?.response?.data?.error || 'ارسال کد تایید با خطا مواجه شد');
		} finally {
			setLoading(false);
		}
	};

	const handleVerifyCode = async () => {
		if (!code().trim()) {
			setErrorMsg('کد تایید دریافتی تلگرام را وارد کنید.');
			return;
		}

		try {
			setLoading(true);
			setErrorMsg('');
			haptic.impact('light');

			await ownerApi.verifyUserbotCode(
				phone().trim(),
				code().trim(),
				phoneCodeHash(),
				password2FA().trim() || undefined,
			);

			setSuccessMsg('حساب تلگرام با موفقیت متصل شد.');
			setStep('phone');
			setPhone('');
			setCode('');
			setPassword2FA('');
			setPhoneCodeHash('');
			loadUserbots();
		} catch (err: any) {
			setErrorMsg(err?.response?.data?.error || 'تایید کد ورود ناموفق بود.');
		} finally {
			setLoading(false);
		}
	};

	const confirmDeleteBot = async (_reason: string) => {
		const id = deletingBotId();
		if (!id) return;
		try {
			await ownerApi.deleteUserbot(id);
			haptic.notify('success');
			setDeletingBotId(null);
			loadUserbots();
		} catch (err: any) {
			setErrorMsg(err.response?.data?.error || 'حذف ربات با خطا مواجه شد.');
		}
	};

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="bg-[#16171d]/60 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
				<div>
					<h2 class="text-sm font-black text-white">مدیریت حساب‌های ربات متصل (Userbot Session)</h2>
					<p class="text-xs text-white/40 font-bold mt-0.5">
						اتصال لایه استخراج و پایش کانال‌های رسمی تلگرام
					</p>
				</div>
				<button
					onClick={loadUserbots}
					class="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 transition-all active:scale-95"
				>
					<span
						class={`material-symbols-outlined text-[20px] ${loadingBots() ? 'animate-spin' : ''}`}
					>
						refresh
					</span>
				</button>
			</div>

			<Show when={errorMsg()}>
				<div class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold">
					<span class="material-symbols-outlined text-xl">error</span>
					<span>{errorMsg()}</span>
				</div>
			</Show>

			<Show when={successMsg()}>
				<div class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs font-bold">
					<span class="material-symbols-outlined text-xl">check_circle</span>
					<span>{successMsg()}</span>
				</div>
			</Show>

			{/* List of active userbots */}
			<div class="space-y-3">
				<h3 class="text-xs font-black uppercase text-white tracking-wider">حساب‌های فعال تلگرام</h3>
				<Show
					when={!loadingBots()}
					fallback={
						<div class="flex justify-center items-center py-10">
							<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
						</div>
					}
				>
					<Show
						when={userbots().length > 0}
						fallback={
							<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-8 text-center text-white/50 text-xs font-bold space-y-2">
								<span class="material-symbols-outlined text-4xl text-white/20">smart_toy</span>
								<p>هیچ حساب تلگرامی در حال حاضر به عنوان ربات پایش متصل نیست.</p>
							</div>
						}
					>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<For each={userbots()}>
								{(bot) => (
									<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 flex items-center justify-between">
										<div class="flex items-center gap-3">
											<div class="w-10 h-10 rounded-2xl bg-[#3390ec]/10 border border-[#3390ec]/20 flex items-center justify-center text-[#3390ec]">
												<span class="material-symbols-outlined text-xl">smart_toy</span>
											</div>
											<div>
												<span class="font-mono font-bold text-xs text-white" dir="ltr">
													{maskPhoneNumber(bot.phone_number)}
												</span>
												<div class="flex items-center gap-2 mt-1">
													<span class="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[9px] font-mono font-bold">
														{bot.status}
													</span>
													<span class="text-[10px] text-white/40 font-bold">
														پایش {bot.channels_count} کانال
													</span>
												</div>
											</div>
										</div>

										<button
											onClick={() => setDeletingBotId(bot.id)}
											class="w-9 h-9 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all active:scale-95"
											title="قطع اتصال حساب"
										>
											<span class="material-symbols-outlined text-[18px]">delete</span>
										</button>
									</div>
								)}
							</For>
						</div>
					</Show>
				</Show>
			</div>

			{/* Connect New Userbot Form */}
			<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-4">
				<h3 class="text-xs font-black uppercase text-white tracking-wider">
					افزودن حساب جدید تلگرام
				</h3>

				<Show when={step() === 'phone'}>
					<div class="space-y-3">
						<div>
							<label class="block text-[10px] font-bold text-white/50 mb-1">
								شماره تلفن همراه با پیش‌شماره (مثلاً 989123456789+)
							</label>
							<input
								type="tel"
								value={phone()}
								onInput={(e) => setPhone(e.currentTarget.value)}
								placeholder="+989123456789"
								class="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#3390ec]"
								dir="ltr"
							/>
						</div>

						<button
							onClick={handleSendCode}
							disabled={loading() || !phone().trim()}
							class="w-full h-12 bg-[#3390ec] hover:bg-[#2b7ec9] text-xs font-black uppercase text-white rounded-xl transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
						>
							<Show when={loading()} fallback="ارسال کد ورود تلگرام">
								<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
							</Show>
						</button>
					</div>
				</Show>

				<Show when={step() === 'code'}>
					<div class="space-y-3">
						<div>
							<label class="block text-[10px] font-bold text-white/50 mb-1">
								کد تایید ۵ رقمی تلگرام
							</label>
							<input
								type="text"
								value={code()}
								onInput={(e) => setCode(e.currentTarget.value)}
								placeholder="12345"
								class="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-sm font-mono text-white outline-none focus:border-[#3390ec]"
								dir="ltr"
							/>
						</div>

						<div>
							<label class="block text-[10px] font-bold text-white/50 mb-1">
								رمز 2FA تلگرام (در صورت داشتن تایید دو مرحله‌ای)
							</label>
							<input
								type="password"
								value={password2FA()}
								onInput={(e) => setPassword2FA(e.currentTarget.value)}
								placeholder="رمز دوم تلگرام..."
								class="w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-xs text-white outline-none focus:border-[#3390ec]"
							/>
						</div>

						<div class="flex gap-2">
							<button
								onClick={() => setStep('phone')}
								class="flex-1 h-12 bg-white/5 text-xs font-bold text-white/70 rounded-xl"
							>
								اصلاح شماره
							</button>

							<button
								onClick={handleVerifyCode}
								disabled={loading() || !code().trim()}
								class="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 text-xs font-black uppercase text-white rounded-xl transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
							>
								<Show when={loading()} fallback="تکمیل ورود و ثبت حساب">
									<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
								</Show>
							</button>
						</div>

						<Show
							when={resendTimer() > 0}
							fallback={
								<button
									onClick={handleSendCode}
									class="text-[10px] text-[#3390ec] font-bold underline"
								>
									ارسال مجدد کد تایید
								</button>
							}
						>
							<p class="text-[10px] text-white/40 font-mono text-center">
								امکان ارسال مجدد کد تا {resendTimer()} ثانیه دیگر
							</p>
						</Show>
					</div>
				</Show>
			</div>

			{/* Danger Action Confirmation */}
			<Show when={deletingBotId()}>
				<DangerActionDialog
					isOpen={true}
					title="قطع اتصال حساب تلگرام"
					description="با قطع این حساب، دریافت اتوماتیک پیام‌ها و پایش کانال‌ها توسط این ربات متوقف خواهد شد."
					actionLabel="حذف ربات"
					confirmWord="DELETE"
					riskLevel="high"
					details={[{ label: 'شناسه ربات', value: deletingBotId()! }]}
					onConfirm={confirmDeleteBot}
					onClose={() => setDeletingBotId(null)}
				/>
			</Show>
		</div>
	);
};
