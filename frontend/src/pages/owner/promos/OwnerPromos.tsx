import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { Title } from '@solidjs/meta';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';
import { apiClient } from '@/shared/api/client.js';

interface PromoCode {
	code: string;
	reward_amount: number;
	max_uses: number;
	uses_count: number;
	expires_at?: string;
	created_at: string;
}

export const OwnerPromos: Component = () => {
	const [promos, setPromos] = createSignal<PromoCode[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal('');
	const [successMsg, setSuccessMsg] = createSignal('');

	const [newCode, setNewCode] = createSignal('');
	const [rewardAmount, setRewardAmount] = createSignal(100);
	const [maxUses, setMaxUses] = createSignal(1000);
	const [expiresHours, setExpiresHours] = createSignal(24);
	const [creating, setCreating] = createSignal(false);

	const fetchPromos = async () => {
		try {
			const resp = await apiClient.get('/owner/promos');
			setPromos(resp.data || []);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در دریافت لیست کدها');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchPromos();
	});

	const handleCreate = async (e: Event) => {
		e.preventDefault();
		setCreating(true);
		setError('');
		setSuccessMsg('');

		try {
			await apiClient.post('/owner/promos', {
				code: newCode(),
				reward_amount: rewardAmount(),
				max_uses: maxUses(),
				expires_in_hours: expiresHours() > 0 ? expiresHours() : undefined,
			});
			setSuccessMsg('کد هدیه با موفقیت ایجاد شد');
			setNewCode('');
			fetchPromos();
			setTimeout(() => setSuccessMsg(''), 3000);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در ایجاد کد هدیه');
		} finally {
			setCreating(false);
		}
	};

	const handleDelete = async (code: string) => {
		if (!confirm(`آیا از حذف کد ${code} اطمینان دارید؟`)) return;
		try {
			await apiClient.delete(`/owner/promos?code=${code}`);
			setSuccessMsg('کد با موفقیت حذف شد');
			fetchPromos();
			setTimeout(() => setSuccessMsg(''), 3000);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در حذف کد');
		}
	};

	return (
		<div class="min-h-screen bg-[#0f1016] text-white pb-20">
			<Title>پنل مدیریت | کدهای هدیه</Title>

			<OwnerTabs active="promos" />

			<div class="p-6 max-w-4xl mx-auto mt-4">
				<div class="mb-8">
					<h1 class="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-l from-white to-white/50">
						مدیریت کدهای هدیه
					</h1>
					<p class="text-white/50 text-sm font-bold">
						ایجاد و مدیریت کدهای تخفیف و جوایز برای کاربران
					</p>
				</div>

				<Show when={error()}>
					<div class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl mb-6 font-bold text-sm">
						{error()}
					</div>
				</Show>

				<Show when={successMsg()}>
					<div class="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-2xl mb-6 font-bold text-sm">
						{successMsg()}
					</div>
				</Show>

				{/* Create Form */}
				<div class="bg-white/5 border border-white/5 rounded-3xl p-6 mb-8">
					<h3 class="font-black text-lg text-white mb-6">ایجاد کد جدید</h3>
					<form onSubmit={handleCreate} class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
						<div>
							<label class="block text-xs font-bold text-white/50 mb-2">کد (انگلیسی)</label>
							<input
								type="text"
								required
								pattern="[A-Za-z0-9]{4,20}"
								value={newCode()}
								onInput={(e) => setNewCode(e.target.value.toUpperCase())}
								placeholder="مثلا: NEWYEAR"
								class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3390ec]"
								dir="ltr"
							/>
						</div>
						<div>
							<label class="block text-xs font-bold text-white/50 mb-2">مقدار جایزه (FRG)</label>
							<input
								type="number"
								required
								min="1"
								value={rewardAmount()}
								onInput={(e) => setRewardAmount(parseFloat(e.target.value))}
								class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3390ec]"
								dir="ltr"
							/>
						</div>
						<div>
							<label class="block text-xs font-bold text-white/50 mb-2">تعداد مجاز</label>
							<input
								type="number"
								required
								min="1"
								value={maxUses()}
								onInput={(e) => setMaxUses(parseInt(e.target.value))}
								class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3390ec]"
								dir="ltr"
							/>
						</div>
						<div>
							<label class="block text-xs font-bold text-white/50 mb-2">انقضا (ساعت)</label>
							<input
								type="number"
								value={expiresHours()}
								onInput={(e) => setExpiresHours(parseInt(e.target.value))}
								class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3390ec]"
								dir="ltr"
							/>
						</div>
						<div class="md:col-span-2 lg:col-span-4 flex justify-end mt-2">
							<button
								type="submit"
								disabled={creating()}
								class="bg-[#3390ec] text-white px-8 py-3 rounded-xl font-black text-sm hover:bg-[#3390ec]/90 transition-colors disabled:opacity-50"
							>
								{creating() ? 'در حال ایجاد...' : 'ایجاد کد'}
							</button>
						</div>
					</form>
				</div>

				{/* List */}
				<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
					<h3 class="font-black text-lg text-white mb-6">کدهای فعال و منقضی</h3>
					<Show when={loading()}>
						<div class="flex justify-center py-10">
							<div class="w-8 h-8 border-4 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin"></div>
						</div>
					</Show>
					<Show when={!loading() && promos().length === 0}>
						<div class="text-center py-10 text-white/50 font-bold">هیچ کدی یافت نشد.</div>
					</Show>
					<Show when={!loading() && promos().length > 0}>
						<div class="overflow-x-auto">
							<table class="w-full text-right text-sm">
								<thead class="text-xs text-white/50 uppercase border-b border-white/10">
									<tr>
										<th class="px-4 py-3">کد</th>
										<th class="px-4 py-3">جایزه</th>
										<th class="px-4 py-3">استفاده</th>
										<th class="px-4 py-3">انقضا</th>
										<th class="px-4 py-3">عملیات</th>
									</tr>
								</thead>
								<tbody>
									<For each={promos()}>
										{(promo) => (
											<tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
												<td class="px-4 py-4 font-black" dir="ltr">{promo.code}</td>
												<td class="px-4 py-4 text-[#ffcc00] font-bold" dir="ltr">{promo.reward_amount} FRG</td>
												<td class="px-4 py-4" dir="ltr">{promo.uses_count} / {promo.max_uses}</td>
												<td class="px-4 py-4 text-xs text-white/50" dir="ltr">
													{promo.expires_at ? new Date(promo.expires_at).toLocaleString() : 'بدون انقضا'}
												</td>
												<td class="px-4 py-4">
													<button
														onClick={() => handleDelete(promo.code)}
														class="text-red-400 hover:text-red-300 font-bold text-xs"
													>
														حذف
													</button>
												</td>
											</tr>
										)}
									</For>
								</tbody>
							</table>
						</div>
					</Show>
				</div>
			</div>
		</div>
	);
};
