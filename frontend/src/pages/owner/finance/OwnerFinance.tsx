import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { Title } from '@solidjs/meta';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';
import { apiClient } from '@/shared/api/axios.js';

export const OwnerFinance: Component = () => {
	const [orders, setOrders] = createSignal<any[]>([]);
	const [subscriptions, setSubscriptions] = createSignal<any[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal('');

	const fetchData = async () => {
		try {
			const [ordersResp, subsResp] = await Promise.all([
				apiClient.get('/owner/finance/orders'),
				apiClient.get('/owner/finance/subscriptions'),
			]);
			setOrders(ordersResp.data || []);
			setSubscriptions(subsResp.data || []);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در دریافت اطلاعات مالی');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchData();
	});

	return (
		<div class="min-h-screen bg-[#0f1016] text-white pb-20">
			<Title>پنل مدیریت | امور مالی</Title>
			<OwnerTabs active="finance" />

			<div class="p-6 max-w-6xl mx-auto mt-4">
				<div class="mb-8">
					<h1 class="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-l from-white to-white/50">
						امور مالی و پرداخت‌ها
					</h1>
					<p class="text-white/50 text-sm font-bold">
						مدیریت تراکنش‌ها و اشتراک‌های فعال کانال‌ها و گروه‌ها
					</p>
				</div>

				<Show when={error()}>
					<div class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl mb-6 font-bold text-sm">
						{error()}
					</div>
				</Show>

				<Show
					when={!loading()}
					fallback={
						<div class="flex justify-center py-20">
							<div class="w-8 h-8 border-4 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin"></div>
						</div>
					}
				>
					<div class="space-y-8">
						{/* Subscriptions */}
						<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
							<h3 class="font-black text-xl mb-4">اشتراک‌های فعال پریمیوم</h3>
							<div class="overflow-x-auto">
								<table class="w-full text-sm text-right">
									<thead class="text-xs text-white/50 uppercase bg-white/5">
										<tr>
											<th class="px-6 py-3 rounded-tr-xl">نوع</th>
											<th class="px-6 py-3">شناسه/عنوان</th>
											<th class="px-6 py-3">کاربر (مالک)</th>
											<th class="px-6 py-3 rounded-tl-xl">پایان اشتراک</th>
										</tr>
									</thead>
									<tbody>
										<For each={subscriptions()} fallback={<tr><td colSpan="4" class="text-center py-4 text-white/50">هیچ اشتراک فعالی یافت نشد</td></tr>}>
											{(sub) => (
												<tr class="border-b border-white/5 hover:bg-white/5">
													<td class="px-6 py-4">{sub.entity_type === 'channel' ? 'کانال' : 'گروه'}</td>
													<td class="px-6 py-4 font-mono text-xs">{sub.title} <br/><span class="text-white/50">{sub.entity_id}</span></td>
													<td class="px-6 py-4">{sub.owner_id}</td>
													<td class="px-6 py-4" dir="ltr">{new Date(sub.premium_until).toLocaleString('fa-IR')}</td>
												</tr>
											)}
										</For>
									</tbody>
								</table>
							</div>
						</div>

						{/* Transactions */}
						<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
							<h3 class="font-black text-xl mb-4">تاریخچه تراکنش‌ها (Stars)</h3>
							<div class="overflow-x-auto">
								<table class="w-full text-sm text-right">
									<thead class="text-xs text-white/50 uppercase bg-white/5">
										<tr>
											<th class="px-6 py-3 rounded-tr-xl">وضعیت</th>
											<th class="px-6 py-3">مبلغ (ستاره)</th>
											<th class="px-6 py-3">کاربر</th>
											<th class="px-6 py-3">توضیحات (Payload)</th>
											<th class="px-6 py-3 rounded-tl-xl">تاریخ</th>
										</tr>
									</thead>
									<tbody>
										<For each={orders()} fallback={<tr><td colSpan="5" class="text-center py-4 text-white/50">هیچ تراکنشی یافت نشد</td></tr>}>
											{(order) => (
												<tr class="border-b border-white/5 hover:bg-white/5">
													<td class="px-6 py-4">
														<span class={`px-2 py-1 rounded text-xs font-bold ${
															order.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
														}`}>
															{order.status}
														</span>
													</td>
													<td class="px-6 py-4 font-bold text-amber-400">{order.amount} ⭐️</td>
													<td class="px-6 py-4 font-mono">{order.user_id}</td>
													<td class="px-6 py-4 text-xs max-w-xs truncate">{order.payload}</td>
													<td class="px-6 py-4 text-xs" dir="ltr">{new Date(order.created_at).toLocaleString('fa-IR')}</td>
												</tr>
											)}
										</For>
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</Show>
			</div>
		</div>
	);
};
