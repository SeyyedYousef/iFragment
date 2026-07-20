import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { ownerApi, FinanceOrder, OwnerEntityItem } from '@/shared/api/owner.js';

export const OwnerFinance: Component = () => {
	const [orders, setOrders] = createSignal<FinanceOrder[]>([]);
	const [subscriptions, setSubscriptions] = createSignal<OwnerEntityItem[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal('');

	const fetchData = async () => {
		setLoading(true);
		setError('');
		try {
			const [ordersData, entitiesData] = await Promise.all([
				ownerApi.getFinanceOrders().catch(() => []),
				ownerApi.listEntities().catch(() => []),
			]);
			setOrders(ordersData || []);
			setSubscriptions(entitiesData?.filter((e) => e.status === 'active') || []);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در دریافت اطلاعات مالی سرور');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchData();
	});

	const totalRevenueStars = () =>
		orders()
			.filter((o) => o.status === 'paid')
			.reduce((sum, o) => sum + (o.amount_stars || 0), 0);

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="bg-[#16171d]/60 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
				<div>
					<h2 class="text-sm font-black text-white">امور مالی، خریدهای ستاره و اشتراک‌ها</h2>
					<p class="text-xs text-white/40 font-bold mt-0.5">مدیریت تراکنش‌های درگاه ستاره تلگرام و وضعیت اعتبارات</p>
				</div>
			</div>

			<Show when={error()}>
				<div class="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-bold">
					<span class="material-symbols-outlined text-xl">error</span>
					<span>{error()}</span>
				</div>
			</Show>

			<Show
				when={!loading()}
				fallback={
					<div class="flex flex-col items-center justify-center py-20 gap-3">
						<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
						<span class="text-xs text-white/50 font-bold">در حال دریافت داده‌های حسابداری...</span>
					</div>
				}
			>
				{/* Financial KPI Summary Cards */}
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 space-y-2">
						<span class="text-[10px] text-white/40 font-black uppercase tracking-wider block">کل درآمد ستاره (Telegram Stars)</span>
						<div class="text-3xl font-black text-amber-400 font-mono">{totalRevenueStars().toLocaleString()} ⭐</div>
						<p class="text-[10px] text-emerald-400 font-bold">پرداخت‌های موفق ثبت‌شده</p>
					</div>

					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 space-y-2">
						<span class="text-[10px] text-white/40 font-black uppercase tracking-wider block">تعداد سفارشات</span>
						<div class="text-3xl font-black text-white font-mono">{orders().length.toLocaleString()}</div>
						<p class="text-[10px] text-white/50 font-bold">کل سفارشات صادرشده</p>
					</div>

					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-5 space-y-2">
						<span class="text-[10px] text-white/40 font-black uppercase tracking-wider block">اشتراک‌های فعال</span>
						<div class="text-3xl font-black text-[#3390ec] font-mono">{subscriptions().length.toLocaleString()}</div>
						<p class="text-[10px] text-white/50 font-bold">کانال‌ها و گروه‌های دارای اعتبار فعال</p>
					</div>
				</div>

				{/* Active Subscriptions */}
				<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-4">
					<h3 class="text-xs font-black uppercase text-white tracking-wider">اشتراک‌های فعال پریمیوم (گروه‌ها و کانال‌ها)</h3>
					<div class="overflow-x-auto">
						<table class="w-full text-start text-xs">
							<thead>
								<tr class="border-b border-white/10 text-white/40 text-[10px] font-bold">
									<th class="pb-3 text-start">نوع</th>
									<th class="pb-3 text-start">عنوان / آیدی</th>
									<th class="pb-3 text-start">شناسه مالك</th>
									<th class="pb-3 text-end">موجودی اعتبار (اعتبار باقی‌مانده)</th>
								</tr>
							</thead>
							<tbody>
								<For
									each={subscriptions()}
									fallback={
										<tr>
											<td colSpan={4} class="py-6 text-center text-white/40 font-bold">
												هیچ اشتراک فعالی یافت نشد.
											</td>
										</tr>
									}
								>
									{(sub) => (
										<tr class="border-b border-white/5 hover:bg-white/5 transition-all">
											<td class="py-3 text-start">
												<span class="px-2 py-0.5 rounded bg-[#3390ec]/10 text-[#3390ec] text-[9px] font-bold">
													{sub.type === 'channel' ? 'کانال' : 'گروه'}
												</span>
											</td>
											<td class="py-3 text-start font-bold text-white">
												{sub.title} <span class="text-white/40 text-[10px] font-mono block">@{sub.username || sub.telegram_id}</span>
											</td>
											<td class="py-3 text-start font-mono text-white/70">{sub.owner_username ? `@${sub.owner_username}` : sub.owner_id}</td>
											<td class="py-3 text-end font-mono font-bold text-emerald-400">
												{sub.credit_balance?.toLocaleString() || 0} سکه اعتبار
											</td>
										</tr>
									)}
								</For>
							</tbody>
						</table>
					</div>
				</div>

				{/* Transactions History */}
				<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-4">
					<h3 class="text-xs font-black uppercase text-white tracking-wider">تاریخچه آخرین تراکنش‌های پرداختی</h3>
					<div class="overflow-x-auto">
						<table class="w-full text-start text-xs">
							<thead>
								<tr class="border-b border-white/10 text-white/40 text-[10px] font-bold">
									<th class="pb-3 text-start">وضعیت</th>
									<th class="pb-3 text-start">مبلغ</th>
									<th class="pb-3 text-start">شناسه کاربر</th>
									<th class="pb-3 text-start">نوع سفارش</th>
									<th class="pb-3 text-end">تاریخ تراکنش</th>
								</tr>
							</thead>
							<tbody>
								<For
									each={orders()}
									fallback={
										<tr>
											<td colSpan={5} class="py-6 text-center text-white/40 font-bold">
												هیچ تراکنشی ثبت نشده است.
											</td>
										</tr>
									}
								>
									{(order) => (
										<tr class="border-b border-white/5 hover:bg-white/5 transition-all">
											<td class="py-3 text-start">
												<span
													class={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
														order.status === 'paid'
															? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
															: 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
													}`}
												>
													{order.status === 'paid' ? 'موفق' : order.status}
												</span>
											</td>
											<td class="py-3 text-start font-mono font-bold text-amber-400">
												{order.amount_stars} ⭐️
											</td>
											<td class="py-3 text-start font-mono text-white/80">{order.user_id}</td>
											<td class="py-3 text-start text-white/70 font-medium">{order.item_type || 'خرید داخل برنامه'}</td>
											<td class="py-3 text-end font-mono text-white/40 text-[10px]">
												{order.created_at ? new Date(order.created_at).toLocaleDateString('fa-IR') : '---'}
											</td>
										</tr>
									)}
								</For>
							</tbody>
						</table>
					</div>
				</div>
			</Show>
		</div>
	);
};
