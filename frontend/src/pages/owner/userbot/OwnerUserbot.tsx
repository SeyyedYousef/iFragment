import { Component, createSignal, onMount, For } from 'solid-js';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';
import { t } from '@/shared/i18n/index.js';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { ownerApi, ManagedUserbot } from '@/shared/api/owner.js';

export const OwnerUserbot: Component = () => {
	const [phone, setPhone] = createSignal('');
	const [code, setCode] = createSignal('');
	const [phoneCodeHash, setPhoneCodeHash] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	const [successMsg, setSuccessMsg] = createSignal('');
	const [errorMsg, setErrorMsg] = createSignal('');
	const [step, setStep] = createSignal<'phone' | 'code'>('phone');

	const [userbots, setUserbots] = createSignal<ManagedUserbot[]>([]);
	const [loadingBots, setLoadingBots] = createSignal(true);
	
	const loadUserbots = async () => {
		try {
			setLoadingBots(true);
			const bots = await ownerApi.listUserbots();
			setUserbots(bots || []);
		} catch (err) {
			console.error('Failed to load userbots', err);
		} finally {
			setLoadingBots(false);
		}
	};

	onMount(() => {
		loadUserbots();
	});

	const handleDelete = async (id: string) => {
		if (!confirm('آیا مطمئن هستید که می‌خواهید این حساب را حذف کنید؟ این حساب از ربات خارج شده و فوروارد پیام‌ها متوقف می‌شود.')) return;
		try {
			hapticFeedback.impactOccurred('medium');
			await ownerApi.deleteUserbot(id);
			loadUserbots();
		} catch (err) {
			alert('حذف حساب با خطا مواجه شد');
		}
	};

	const handleSendCode = async () => {
		if (!phone()) {
			setErrorMsg(t('owner.userbot.phoneRequired'));
			return;
		}

		try {
			setLoading(true);
			setErrorMsg('');
			hapticFeedback.impactOccurred('light');

			const resp = await ownerApi.sendUserbotCode(phone());

			setPhoneCodeHash(resp.phone_code_hash);
			setStep('code');
		} catch (err: any) {
			setErrorMsg(err?.response?.data?.error || 'ارسال کد با خطا مواجه شد');
		} finally {
			setLoading(false);
		}
	};

	const handleVerifyCode = async () => {
		if (!code()) {
			setErrorMsg(t('owner.userbot.codeRequired'));
			return;
		}

		try {
			setLoading(true);
			setErrorMsg('');
			hapticFeedback.impactOccurred('light');

			await ownerApi.verifyUserbotCode(phone(), code(), phoneCodeHash());

			setSuccessMsg(t('owner.userbot.successMsg'));
			setStep('phone');
			setPhone('');
			setCode('');
			setPhoneCodeHash('');
			loadUserbots();
		} catch (err: any) {
			setErrorMsg(err?.response?.data?.error || 'تایید کد با خطا مواجه شد');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#090a0f] text-white pb-32">
			{/* Premium Header Glow */}
			<div class="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-[#3390ec]/15 to-transparent pointer-events-none blur-[60px]" />

			{/* Admin Panel Header */}
			<div class="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/5 relative z-10">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#3390ec] to-[#2b7ec9] flex items-center justify-center text-xl shadow-lg shadow-[#3390ec]/10">
						🛡️
					</div>
					<div>
						<h2 class="text-sm font-black uppercase tracking-wider text-white">پنل مدیریت</h2>
						<p class="text-[9px] text-[#3390ec] font-black uppercase tracking-widest mt-0.5">
							تنظیمات حساب‌های متصل
						</p>
					</div>
				</div>
			</div>

			<OwnerTabs active="userbot" />

			<div class="px-6 mt-6 relative z-10">
				<div class="mb-6 flex justify-between items-end">
					<div>
						<h1 class="text-2xl font-black text-white">{t('owner.userbot.title')}</h1>
						<p class="text-[13px] text-white/60 mt-1">{t('owner.userbot.subtitle')}</p>
					</div>
					<button 
						onClick={loadUserbots}
						class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
					>
						<span class={`material-symbols-outlined text-[20px] text-white/70 ${loadingBots() ? 'animate-spin' : ''}`}>refresh</span>
					</button>
				</div>

				<div class="space-y-3 mb-8">
					{loadingBots() ? (
						<div class="animate-pulse bg-[#16171d] border border-[#2a2c35]/40 rounded-3xl h-24 w-full"></div>
					) : userbots().length === 0 ? (
						<div class="bg-[#16171d] border border-[#2a2c35]/40 rounded-3xl p-6 text-center">
							<span class="material-symbols-outlined text-4xl text-white/20 mb-2">person_add</span>
							<h3 class="text-white/80 font-semibold mb-1">هیچ حسابی متصل نیست</h3>
							<p class="text-[13px] text-white/50">یک حساب تلگرام اضافه کنید تا رهگیری پیام‌های کانال شروع شود.</p>
						</div>
					) : (
						<For each={userbots()}>
							{(bot) => (
								<div class="bg-[#16171d] border border-[#2a2c35]/40 rounded-3xl p-4 flex items-center justify-between">
									<div class="flex items-center gap-3">
										<div class="w-12 h-12 rounded-full bg-[#3390ec]/10 flex items-center justify-center text-[#3390ec]">
											<span class="material-symbols-outlined">smart_toy</span>
										</div>
										<div>
											<div class="flex items-center gap-2">
												<span class="font-bold text-white" dir="ltr">{bot.phone_number}</span>
												{bot.status === 'active' ? (
													<span class="px-2 py-0.5 rounded-full bg-[#34c759]/10 text-[#34c759] text-[10px] font-bold uppercase tracking-wider">فعال</span>
												) : (
													<span class="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-wider">{bot.status}</span>
												)}
											</div>
											<p class="text-[12px] text-white/50 mt-0.5">در حال بررسی {bot.channels_count} کانال</p>
										</div>
									</div>
									<button 
										onClick={() => handleDelete(bot.id)}
										class="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors"
									>
										<span class="material-symbols-outlined text-[18px]">delete</span>
									</button>
								</div>
							)}
						</For>
					)}
				</div>

				<h2 class="text-lg font-black text-white mb-4">اتصال حساب جدید</h2>

				<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6">
					{errorMsg() && (
						<div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">
							{errorMsg()}
						</div>
					)}
					
					{successMsg() && (
						<div class="mb-4 p-3 bg-[#34c759]/10 border border-[#34c759]/30 text-[#34c759] text-sm rounded-xl">
							{successMsg()}
						</div>
					)}

					{step() === 'phone' ? (
						<div class="space-y-4">
							<div>
								<label class="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
									{t('owner.userbot.phoneInputLabel')}
								</label>
								<input
									type="text"
									value={phone()}
									onInput={(e) => setPhone(e.currentTarget.value)}
									placeholder="+98912..."
									class="w-full bg-[#0f1014] border border-[#2a2c35]/40 rounded-xl px-4 py-3 text-white text-[15px] focus:outline-none focus:border-[#3390ec]"
									dir="ltr"
								/>
							</div>

							<button
								onClick={handleSendCode}
								disabled={loading()}
								class="w-full bg-[#3390ec] hover:bg-[#3390ec]/90 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center"
							>
								{loading() ? (
									<span class="material-symbols-outlined animate-spin">refresh</span>
								) : (
									t('owner.userbot.sendCodeBtn')
								)}
							</button>
						</div>
					) : (
						<div class="space-y-4">
							<div>
								<label class="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
									{t('owner.userbot.codeInputLabel')}
								</label>
								<input
									type="text"
									value={code()}
									onInput={(e) => setCode(e.currentTarget.value)}
									placeholder="12345"
									class="w-full bg-[#0f1014] border border-[#2a2c35]/40 rounded-xl px-4 py-3 text-white text-[15px] focus:outline-none focus:border-[#3390ec]"
									dir="ltr"
								/>
							</div>

							<button
								onClick={handleVerifyCode}
								disabled={loading()}
								class="w-full bg-[#34c759] hover:bg-[#34c759]/90 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center"
							>
								{loading() ? (
									<span class="material-symbols-outlined animate-spin">refresh</span>
								) : (
									t('owner.userbot.verifyCodeBtn')
								)}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
