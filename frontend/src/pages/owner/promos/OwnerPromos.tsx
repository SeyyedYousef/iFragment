import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { ownerApi, PromoCode } from '@/shared/api/owner.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.js';
import { hapticFeedback } from '@tma.js/sdk-solid';

export const OwnerPromos: Component = () => {
	const [promos, setPromos] = createSignal<PromoCode[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal('');
	const [successMsg, setSuccessMsg] = createSignal('');

	const [newCode, setNewCode] = createSignal('');
	const [rewardAmount, setRewardAmount] = createSignal(10000);
	const [maxUses, setMaxUses] = createSignal(1000);
	const [expiresHours, setExpiresHours] = createSignal(24);
	const [creating, setCreating] = createSignal(false);
	const [deletingPromo, setDeletingPromo] = createSignal<PromoCode | null>(null);

	const fetchPromos = async () => {
		setLoading(true);
		setError('');
		try {
			const data = await ownerApi.listPromos();
			setPromos(data || []);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در دریافت لیست کدهای هدیه');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchPromos();
	});

	const generateRandomCode = () => {
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let code = 'FRG-';
		for (let i = 0; i < 6; i++) {
			code += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		setNewCode(code);
	};

	const handleCreate = async (e: Event) => {
		e.preventDefault();
		const codeStr = newCode().trim().toUpperCase();
		const reward = Number(rewardAmount()) || 0;
		const uses = Number(maxUses()) || 0;
		const hours = Number(expiresHours()) || 0;

		if (!codeStr || reward <= 0 || uses <= 0) {
			setError('لطفاً کد، مقدار جایزه و تعداد مجاز استفاده را وارد کنید.');
			return;
		}

		setCreating(true);
		setError('');
		setSuccessMsg('');

		const expiryDate = new Date(Date.now() + hours * 3600 * 1000).toISOString();

		try {
			await ownerApi.createPromo(codeStr, reward, uses, expiryDate);
			setSuccessMsg(`کد هدیه ${codeStr} با موفقیت ایجاد شد.`);
			setNewCode('');
			fetchPromos();
			try {
				hapticFeedback.notificationOccurred('success');
			} catch {}
			setTimeout(() => setSuccessMsg(''), 4000);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در ایجاد کد هدیه');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} finally {
			setCreating(false);
		}
	};

	const confirmDeletePromo = async () => {
		const promo = deletingPromo();
		if (!promo) return;
		try {
			await ownerApi.deletePromo(promo.id || promo.code);
			setSuccessMsg(`کد ${promo.code} با موفقیت حذف گردید.`);
			setDeletingPromo(null);
			fetchPromos();
			try {
				hapticFeedback.notificationOccurred('success');
			} catch {}
			setTimeout(() => setSuccessMsg(''), 3000);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در حذف کد هدیه');
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		try {
			hapticFeedback.notificationOccurred('success');
		} catch {}
	};

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="bg-[#16171d]/60 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
				<div>
					<h2 class="text-sm font-black text-white">مدیریت کدهای هدیه و پروموشن (Promo Codes)</h2>
					<p class="text-xs text-white/40 font-bold mt-0.5">ایجاد کدهای هدیه سکه FRG با سقف استفاده و انقضای زمانی</p>
				</div>
			</div>

			<Show when={error()}>
				<div class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold">
					<span class="material-symbols-outlined text-xl">error</span>
					<span>{error()}</span>
				</div>
			</Show>

			<Show when={successMsg()}>
				<div class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs font-bold">
					<span class="material-symbols-outlined text-xl">check_circle</span>
					<span>{successMsg()}</span>
				</div>
			</Show>

			{/* Create Form */}
			<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-xs font-black uppercase text-white tracking-wider">ایجاد کد هدیه جدید</h3>
					<button
						type="button"
						onClick={generateRandomCode}
						class="text-[10px] font-bold text-[#3390ec] bg-[#3390ec]/10 border border-[#3390ec]/20 px-3 py-1.5 rounded-xl hover:bg-[#3390ec]/20 transition-all flex items-center gap-1"
					>
						<span class="material-symbols-outlined text-[14px]">auto_awesome</span>
						تولید کد اتوماتیک
					</button>
				</div>

				<form onSubmit={handleCreate} class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<div>
						<label class="block text-[10px] font-bold text-white/50 mb-1">عبارت کد هدیه (انگلیسی)</label>
						<input
							type="text"
							required
							value={newCode()}
							onInput={(e) => setNewCode(e.currentTarget.value.toUpperCase().replace(/\s+/g, ''))}
							placeholder="مثال: FRG-GIFT2026"
							class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono uppercase text-white outline-none focus:border-[#3390ec]"
							dir="ltr"
						/>
					</div>

					<div>
						<label class="block text-[10px] font-bold text-white/50 mb-1">مقدار سکه پاداش (FRG)</label>
						<input
							type="number"
							required
							min="1"
							value={rewardAmount()}
							onInput={(e) => setRewardAmount(Number(e.currentTarget.value) || 0)}
							class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#3390ec]"
							dir="ltr"
						/>
					</div>

					<div>
						<label class="block text-[10px] font-bold text-white/50 mb-1">حداکثر تعداد استفاده (نفر)</label>
						<input
							type="number"
							required
							min="1"
							value={maxUses()}
							onInput={(e) => setMaxUses(Number(e.currentTarget.value) || 0)}
							class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#3390ec]"
							dir="ltr"
						/>
					</div>

					<div>
						<label class="block text-[10px] font-bold text-white/50 mb-1">مدت زمان اعتبار (ساعت)</label>
						<input
							type="number"
							min="1"
							value={expiresHours()}
							onInput={(e) => setExpiresHours(Number(e.currentTarget.value) || 24)}
							class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#3390ec]"
							dir="ltr"
						/>
					</div>

					<div class="md:col-span-2 lg:col-span-4 flex justify-end pt-2">
						<button
							type="submit"
							disabled={creating() || !newCode().trim()}
							class="h-11 px-8 bg-[#3390ec] hover:bg-[#2b7ec9] text-xs font-black uppercase text-white rounded-xl transition-all disabled:opacity-40 flex items-center gap-2 active:scale-95 shadow-lg shadow-[#3390ec]/20"
						>
							<Show when={creating()} fallback="ایجاد و فعال‌سازی کد">
								<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
								در حال صدور...
							</Show>
						</button>
					</div>
				</form>
			</div>

			{/* Promos Table */}
			<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-4">
				<h3 class="text-xs font-black uppercase text-white tracking-wider">لیست کدهای هدیه صادر شده</h3>

				<Show when={loading()}>
					<div class="flex justify-center items-center py-10">
						<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
					</div>
				</Show>

				<Show when={!loading() && promos().length === 0}>
					<div class="text-center py-10 text-white/40 text-xs font-bold">هیچ کد هدیه‌ای یافت نشد.</div>
				</Show>

				<Show when={!loading() && promos().length > 0}>
					<div class="overflow-x-auto">
						<table class="w-full text-start text-xs">
							<thead>
								<tr class="border-b border-white/10 text-white/40 text-[10px] font-bold">
									<th class="pb-3 text-start">عبارت کد</th>
									<th class="pb-3 text-start">مقدار پاداش</th>
									<th class="pb-3 text-start">تعداد مصرف شده</th>
									<th class="pb-3 text-start">تاریخ انقضا</th>
									<th class="pb-3 text-end">عملیات</th>
								</tr>
							</thead>
							<tbody>
								<For each={promos()}>
									{(promo) => {
										const usagePct = Math.min(100, Math.round(((promo.current_uses || 0) / (promo.max_uses || 1)) * 100));
										const isExpired = promo.expires_at ? new Date(promo.expires_at).getTime() < Date.now() : false;
										return (
											<tr class="border-b border-white/5 hover:bg-white/5 transition-all">
												<td class="py-4 text-start font-mono font-bold text-white">
													<div class="flex items-center gap-2">
														<span>{promo.code}</span>
														<button
															onClick={() => copyToClipboard(promo.code)}
															class="p-1 rounded bg-white/5 hover:bg-white/10 text-white/60 text-[10px]"
															title="کپی عبارت کد"
														>
															<span class="material-symbols-outlined text-[12px]">content_copy</span>
														</button>
													</div>
												</td>
												<td class="py-4 text-start font-mono font-bold text-amber-400">
													{promo.reward_frg?.toLocaleString() || promo.reward_frg} FRG
												</td>
												<td class="py-4 text-start">
													<div class="space-y-1">
														<div class="font-mono text-[11px] text-white/80">
															{promo.current_uses || 0} / {promo.max_uses} ({usagePct}%)
														</div>
														<div class="w-24 bg-white/5 rounded-full h-1 overflow-hidden">
															<div class="bg-[#3390ec] h-full rounded-full" style={{ width: `${usagePct}%` }} />
														</div>
													</div>
												</td>
												<td class="py-4 text-start text-xs text-white/50 font-mono">
													<Show when={promo.expires_at} fallback={<span class="text-emerald-400">دائمی</span>}>
														<span class={isExpired ? 'text-red-400' : 'text-white/70'}>
															{new Date(promo.expires_at!).toLocaleDateString('fa-IR')}
														</span>
													</Show>
												</td>
												<td class="py-4 text-end">
													<button
														onClick={() => setDeletingPromo(promo)}
														class="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all"
													>
														حذف
													</button>
												</td>
											</tr>
										);
									}}
								</For>
							</tbody>
						</table>
					</div>
				</Show>
			</div>

			{/* Danger Action Confirmation */}
			<Show when={deletingPromo()}>
				<DangerActionDialog
					isOpen={true}
					title="حذف کد هدیه"
					description={`با حذف این کد، امکان دریافت پاداش برای کاربران غیرفعال خواهد شد.`}
					actionLabel="حذف کد پروموشن"
					riskLevel="medium"
					details={[{ label: 'عبارت کد', value: deletingPromo()?.code }]}
					onConfirm={confirmDeletePromo}
					onClose={() => setDeletingPromo(null)}
				/>
			</Show>
		</div>
	);
};
