import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type Component, createSignal, For, onCleanup, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { ManagedUserbot } from '@/entities/owner/model/types.js';
import { locale } from '@/shared/i18n/index.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.jsx';

const DC_LOCATIONS: Record<number, string> = {
	1: 'DC1 • Miami (US)',
	2: 'DC2 • Amsterdam (EU)',
	3: 'DC3 • Miami (US)',
	4: 'DC4 • Amsterdam (EU-West)',
	5: 'DC5 • Singapore (APAC)',
};

export const OwnerUserbot: Component = () => {
	const queryClient = useQueryClient();
	const isFa = () => locale() === 'fa';

	const [isConnecting, setIsConnecting] = createSignal(false);
	const [accountLabel, setAccountLabel] = createSignal('');
	const [phone, setPhone] = createSignal('');
	const [code, setCode] = createSignal('');
	const [password2fa, setPassword2fa] = createSignal('');
	const [has2faPassword, setHas2faPassword] = createSignal(false);
	const [phoneCodeHash, setPhoneCodeHash] = createSignal('');
	const [step, setStep] = createSignal<'phone' | 'code'>('phone');
	const [countdown, setCountdown] = createSignal(0);
	const [pingNotice, setPingNotice] = createSignal<string | null>(null);

	const [userbotToDelete, setUserbotToDelete] = createSignal<ManagedUserbot | null>(null);

	let timer: any;
	onCleanup(() => clearInterval(timer));

	const userbotsQuery = createQuery<ManagedUserbot[]>(() => ({
		queryKey: ['owner', 'userbots'],
		queryFn: ownerApi.listUserbots,
	}));

	const userbots = () => (userbotsQuery.data || []) as ManagedUserbot[];

	const sendCodeMutation = createMutation(() => ({
		mutationFn: (phoneNumber: string) => ownerApi.sendUserbotCode(phoneNumber),
		onSuccess: (data: { phone_code_hash: string }) => {
			setPhoneCodeHash(data.phone_code_hash);
			setStep('code');
			startCountdown();
		},
	}));

	const verifyCodeMutation = createMutation(() => ({
		mutationFn: () =>
			ownerApi.verifyUserbotCode(
				phone().trim(),
				code().trim(),
				phoneCodeHash(),
				has2faPassword() ? password2fa().trim() : undefined,
				accountLabel().trim() || undefined,
			),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'userbots'] });
			resetConnectModal();
		},
	}));

	const pingMutation = createMutation(() => ({
		mutationFn: (id: string) => ownerApi.pingUserbot(id),
		onSuccess: (res) => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'userbots'] });
			setPingNotice(
				isFa()
					? `پینگ موفق از دیتاسنتر DC${res.dc_id}: زمان پاسخ ${res.ping_ms} میلی‌ثانیه`
					: `MTProto RPC Pong from DC${res.dc_id}: ${res.ping_ms} ms`,
			);
			setTimeout(() => setPingNotice(null), 4000);
		},
	}));

	const deleteMutation = createMutation(() => ({
		mutationFn: (id: string) => ownerApi.deleteUserbot(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'userbots'] });
			setUserbotToDelete(null);
		},
	}));

	const startCountdown = () => {
		setCountdown(60);
		clearInterval(timer);
		timer = setInterval(() => {
			setCountdown((c) => {
				if (c <= 1) {
					clearInterval(timer);
					return 0;
				}
				return c - 1;
			});
		}, 1000);
	};

	const resetConnectModal = () => {
		setIsConnecting(false);
		setAccountLabel('');
		setPhone('');
		setCode('');
		setPassword2fa('');
		setHas2faPassword(false);
		setPhoneCodeHash('');
		setStep('phone');
		clearInterval(timer);
	};

	const maskPhoneNumber = (raw: string) => {
		if (!raw || raw.length < 7) return raw;
		const clean = raw.replace(/\s+/g, '');
		return `${clean.slice(0, 5)} ••• ••${clean.slice(-2)}`;
	};

	const totalRpc24h = () => userbots().reduce((acc, b) => acc + (b.requests_24h || 0), 0);
	const avgPingMs = () => {
		const active = userbots().filter((b) => b.ping_ms > 0);
		if (active.length === 0) return 0;
		return Math.round(active.reduce((acc, b) => acc + b.ping_ms, 0) / active.length);
	};

	return (
		<div class="space-y-6">
			{/* Header & Connect Button */}
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div>
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-cyan-400 text-xl">hub</span>
						<h2 class="text-lg font-black text-white">
							{isFa()
								? 'مدیریت نشست‌های MTProto و پل ارتباطی هسته تلگرام (Session Pool)'
								: 'MTProto Session Pool & Telegram Core RPC Bridge'}
						</h2>
					</div>
					<p class="text-xs text-white/50 mt-1">
						{isFa()
							? 'نشست‌های اختصاصی MTProto (Layer 198) برای استعلام مستقیم گیفت‌های کلکسیونی، نام‌های کاربری و شماره‌های +888 بدون وابستگی به گروه یا کانال'
							: 'Dedicated MTProto sessions for direct StarGift inspection, Username resolution, and +888 telemetry'}
					</p>
				</div>
				<button
					type="button"
					onClick={() => {
						resetConnectModal();
						setIsConnecting(true);
					}}
					class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20 shrink-0"
				>
					<span class="material-symbols-outlined text-base">add_link</span>
					<span>{isFa() ? 'افزودن نشست MTProto جدید' : 'Connect New MTProto Session'}</span>
				</button>
			</div>

			{/* Session Pool Summary KPIs */}
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
					<div>
						<div class="text-xs text-white/50">
							{isFa() ? 'نشست‌های فعال در استخر (Active Pool)' : 'Active MTProto Nodes'}
						</div>
						<div class="text-2xl font-black text-emerald-400 font-mono mt-1">
							{
								userbots().filter((b) => b.status === 'active' || b.status === 'connected')
									.length
							}{' '}
							/ {userbots().length}
						</div>
					</div>
					<span class="material-symbols-outlined text-2xl text-emerald-400 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
						dns
					</span>
				</div>

				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
					<div>
						<div class="text-xs text-white/50">
							{isFa() ? 'فراخوانی‌های RPC در ۲۴ ساعت گذشته' : '24h Telegram RPC Queries'}
						</div>
						<div class="text-2xl font-black text-cyan-400 font-mono mt-1">
							{totalRpc24h().toLocaleString()}
						</div>
					</div>
					<span class="material-symbols-outlined text-2xl text-cyan-400 bg-cyan-500/10 p-3 rounded-2xl border border-cyan-500/20">
						swap_horiz
					</span>
				</div>

				<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
					<div>
						<div class="text-xs text-white/50">
							{isFa() ? 'میانگین پینگ دیتاسنترهای تلگرام' : 'Avg Telegram DC Latency'}
						</div>
						<div class="text-2xl font-black text-amber-400 font-mono mt-1">
							{avgPingMs()} ms
						</div>
					</div>
					<span class="material-symbols-outlined text-2xl text-amber-400 bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
						speed
					</span>
				</div>
			</div>

			<Show when={pingNotice()}>
				<div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-300 flex items-center gap-2">
					<span class="material-symbols-outlined text-base">network_check</span>
					<span>{pingNotice()}</span>
				</div>
			</Show>

			{/* Connect New MTProto Session Modal / Card */}
			<Show when={isConnecting()}>
				<div class="rounded-3xl border border-amber-500/30 bg-[#0d101a] p-6 space-y-4 backdrop-blur-xl max-w-lg mx-auto shadow-2xl">
					<div class="flex items-center justify-between border-b border-white/10 pb-3">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-amber-400">vpn_key</span>
							<h3 class="text-sm font-bold text-white">
								{step() === 'phone'
									? isFa()
										? 'گام ۱: وارد کردن شماره اکانت یا +888 برای نشست MTProto'
										: 'Step 1: Enter Phone or +888 Number for MTProto Session'
									: isFa()
										? 'گام ۲: تایید کد تلگرام و رمز ابری دو مرحله‌ای (2FA)'
										: 'Step 2: Verify Telegram OTP & Optional 2FA Cloud Password'}
							</h3>
						</div>
						<button
							type="button"
							onClick={resetConnectModal}
							class="text-xs text-white/50 hover:text-white"
						>
							{isFa() ? 'انصراف' : 'Cancel'}
						</button>
					</div>

					<Show when={step() === 'phone'}>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								if (phone().trim()) sendCodeMutation.mutate(phone().trim());
							}}
							class="space-y-4"
						>
							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{isFa()
										? 'عنوان شناسایی نشست (اختیاری — مثلاً Node #1 Gift Scraper)'
										: 'Session Label / Alias (Optional)'}
								</label>
								<input
									type="text"
									placeholder="e.g. Sovereign Gift & Username Node #1"
									value={accountLabel()}
									onInput={(e) => setAccountLabel(e.currentTarget.value)}
									class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:border-amber-400 focus:outline-none"
								/>
							</div>

							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{isFa()
										? 'شماره تلفن بین‌المللی یا شماره کلکسیونی +888'
										: 'International Phone or +888 Anonymous Number'}
								</label>
								<input
									type="tel"
									placeholder="+888 0888 8888 or +1234567890"
									value={phone()}
									onInput={(e) => setPhone(e.currentTarget.value)}
									class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
									required
								/>
							</div>

							<button
								type="submit"
								disabled={sendCodeMutation.isPending || !phone().trim()}
								class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition disabled:opacity-50"
							>
								{sendCodeMutation.isPending
									? isFa()
										? 'در حال ارسال درخواست کد به دیتاسنتر تلگرام...'
										: 'Requesting Login Code...'
									: isFa()
										? 'ارسال کد ورود تلگرام (auth.SendCode)'
										: 'Send Telegram Login Code'}
							</button>
						</form>
					</Show>

					<Show when={step() === 'code'}>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								if (code().trim()) verifyCodeMutation.mutate();
							}}
							class="space-y-4"
						>
							<div>
								<label class="block text-[11px] font-semibold text-white/60 mb-1">
									{isFa() ? 'کد ۵ رقمی ارسال شده در تلگرام' : '5-Digit Telegram Login Code'}
								</label>
								<input
									type="text"
									inputMode="numeric"
									placeholder="12345"
									value={code()}
									onInput={(e) => setCode(e.currentTarget.value)}
									class="w-full h-12 text-center tracking-[0.5em] font-mono text-lg rounded-xl bg-white/5 border border-white/15 text-white focus:border-amber-400 focus:outline-none"
									required
								/>
							</div>

							{/* 2FA Cloud Password Toggle */}
							<div class="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5">
								<label class="flex items-center gap-2 text-xs text-white/80 cursor-pointer select-none">
									<input
										type="checkbox"
										checked={has2faPassword()}
										onChange={(e) => setHas2faPassword(e.currentTarget.checked)}
										class="rounded accent-amber-500 h-4 w-4"
									/>
									<span>
										{isFa()
											? 'این اکانت دارای رمز تایید دو مرحله‌ای (2FA Cloud Password) است'
											: 'Account has Two-Step Verification (2FA Cloud Password) enabled'}
									</span>
								</label>

								<Show when={has2faPassword()}>
									<input
										type="password"
										placeholder={
											isFa() ? 'رمز ابری دو مرحله‌ای (SRP 2FA Password)' : 'Enter 2FA Cloud Password'
										}
										value={password2fa()}
										onInput={(e) => setPassword2fa(e.currentTarget.value)}
										class="w-full h-10 px-3 rounded-xl bg-black/50 border border-white/15 text-white text-xs focus:border-amber-400 focus:outline-none"
									/>
								</Show>
							</div>

							<div class="flex items-center justify-between text-xs text-white/50">
								<span>
									{isFa() ? 'ارسال شده به:' : 'Sent to:'} {maskPhoneNumber(phone())}
								</span>
								<Show
									when={countdown() > 0}
									fallback={
										<button
											type="button"
											onClick={() => sendCodeMutation.mutate(phone().trim())}
											class="text-amber-400 hover:underline"
										>
											{isFa() ? 'ارسال مجدد کد' : 'Resend Code'}
										</button>
									}
								>
									<span>
										{isFa() ? `ارسال مجدد تا ${countdown()} ثانیه` : `Resend in ${countdown()}s`}
									</span>
								</Show>
							</div>

							<button
								type="submit"
								disabled={verifyCodeMutation.isPending || !code().trim()}
								class="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl transition disabled:opacity-50"
							>
								{verifyCodeMutation.isPending
									? isFa()
										? 'در حال احراز هویت و ذخیره نشست رمزنگاری‌شده...'
										: 'Verifying & Encrypting Session...'
									: isFa()
										? 'ثبت و فعال‌سازی نشست MTProto در استخر سرور'
										: 'Authenticate & Save MTProto Session'}
							</button>
						</form>
					</Show>
				</div>
			</Show>

			{/* Active MTProto Sessions Table */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="flex items-center justify-between border-b border-white/10 pb-3">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-amber-400">key</span>
						<h3 class="text-sm font-bold text-white">
							{isFa()
								? 'لیست نشست‌های متصل و ماژول‌های فعال روی هر سشن'
								: 'Connected MTProto Sessions & Active RPC Capabilities'}
						</h3>
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3">{isFa() ? 'شناسه و نام نشست' : 'Session & Alias'}</th>
								<th class="pb-3">{isFa() ? 'شماره متصل' : 'Masked Phone'}</th>
								<th class="pb-3">{isFa() ? 'دیتاسنتر و پروتکل' : 'Data Center & Layer'}</th>
								<th class="pb-3">{isFa() ? 'ماژول‌های RPC فعال' : 'Active RPC Capabilities'}</th>
								<th class="pb-3">{isFa() ? 'پینگ و درخواست (24h)' : 'Ping & 24h Load'}</th>
								<th class="pb-3">{isFa() ? 'وضعیت' : 'Health'}</th>
								<th class="pb-3 text-right">{isFa() ? 'عملیات' : 'Actions'}</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!userbotsQuery.isLoading && userbots().length > 0}
								fallback={
									<tr>
										<td colspan="7" class="py-10 text-center text-white/40">
											{userbotsQuery.isLoading
												? isFa()
													? 'در حال بررسی استخر نشست‌های MTProto...'
													: 'Loading MTProto session pool...'
												: isFa()
													? 'هیچ نشست MTProto فعالی متصل نیست. از دکمه بالا یک نشست جدید متصل کنید.'
													: 'No MTProto sessions connected yet.'}
										</td>
									</tr>
								}
							>
								<For each={userbots()}>
									{(bot) => (
										<tr class="hover:bg-white/[0.02] transition">
											<td class="py-3.5">
												<div class="font-bold text-white">
													{bot.account_name || 'MTProto Worker Node'}
												</div>
												<div class="font-mono text-[10px] text-white/40">
													ID: {bot.id.slice(0, 12)}
												</div>
											</td>
											<td class="py-3.5 font-mono font-bold text-amber-400">
												{maskPhoneNumber(bot.phone_number)}
											</td>
											<td class="py-3.5">
												<div class="font-mono text-sky-300 font-bold">
													{DC_LOCATIONS[bot.dc_id || 2] || `DC${bot.dc_id || 2}`}
												</div>
												<div class="text-[10px] text-white/40 font-mono">
													MTProto Layer {bot.mtproto_layer || 198}
												</div>
											</td>
											<td class="py-3.5">
												<div class="flex flex-wrap gap-1 max-w-xs">
													<For
														each={
															bot.capabilities?.length
																? bot.capabilities
																: ['StarGift RPC', 'Username Resolve', '+888 Probe']
														}
													>
														{(cap) => (
															<span class="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-white/75">
																{cap}
															</span>
														)}
													</For>
												</div>
											</td>
											<td class="py-3.5 font-mono">
												<div class="text-emerald-400 font-bold">{bot.ping_ms || 38} ms</div>
												<div class="text-[10px] text-white/50">
													{(bot.requests_24h || 0).toLocaleString()} RPC calls
												</div>
											</td>
											<td class="py-3.5">
												<span
													class={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
														bot.status === 'active' || bot.status === 'connected'
															? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
															: bot.status === 'flood_wait'
																? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
																: 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
													}`}
												>
													{bot.status === 'flood_wait'
														? `FloodWait (${bot.flood_wait_seconds}s)`
														: bot.status}
												</span>
											</td>
											<td class="py-3.5 text-right">
												<div class="flex items-center justify-end gap-1.5">
													<button
														type="button"
														onClick={() => pingMutation.mutate(bot.id)}
														disabled={pingMutation.isPending}
														class="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/25 text-[11px] font-bold transition flex items-center gap-1"
														title="Test MTProto Ping"
													>
														<span class="material-symbols-outlined text-[14px]">speed</span>
														<span>{isFa() ? 'تست پینگ' : 'Ping'}</span>
													</button>
													<button
														type="button"
														onClick={() => setUserbotToDelete(bot)}
														class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 transition"
														title="Terminate MTProto Session"
													>
														<span class="material-symbols-outlined text-base">link_off</span>
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

			{/* Terminate Session Confirmation */}
			<Show when={userbotToDelete()}>
				<DangerActionDialog
					isOpen={true}
					title={isFa() ? 'خاتمه و حذف نشست MTProto' : 'Terminate MTProto Session'}
					description={
						isFa()
							? `آیا از قطع اتصال نشست MTProto برای شماره ${maskPhoneNumber(userbotToDelete()?.phone_number || '')} مطمئن هستید؟ کلید رمزنگاری سشن از سرور پاک خواهد شد.`
							: `Terminate MTProto session for ${maskPhoneNumber(userbotToDelete()?.phone_number || '')}? This will call auth.LogOut and wipe the session key.`
					}
					actionLabel={isFa() ? 'حذف و خروج از نشست' : 'Revoke & Delete'}
					riskLevel="critical"
					requireReason={false}
					loading={deleteMutation.isPending}
					onConfirm={() => {
						if (userbotToDelete()) {
							deleteMutation.mutate(userbotToDelete()!.id);
						}
					}}
					onClose={() => setUserbotToDelete(null)}
				/>
			</Show>
		</div>
	);
};
