import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { OwnerEntityItem, ownerApi } from '@/shared/api/owner.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.js';

export const OwnerEntities: Component = () => {
	const [channels, setChannels] = createSignal<OwnerEntityItem[]>([]);
	const [groups, setGroups] = createSignal<OwnerEntityItem[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal('');

	const [selectedEntity, setSelectedEntity] = createSignal<OwnerEntityItem | null>(null);
	const [creditAmount, setCreditAmount] = createSignal(5000);
	const [showCreditModal, setShowCreditModal] = createSignal(false);
	const [creditLoading, setCreditLoading] = createSignal(false);
	const [impersonatingOwnerId, setImpersonatingOwnerId] = createSignal<number | null>(null);

	const fetchData = async () => {
		setLoading(true);
		setError('');
		try {
			const allEntities = await ownerApi.listEntities();
			setChannels(allEntities.filter((e) => e.type === 'channel') || []);
			setGroups(allEntities.filter((e) => e.type === 'group') || []);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در دریافت لیست گروه‌ها و کانال‌ها');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchData();
	});

	const openCreditModal = (entity: OwnerEntityItem) => {
		setSelectedEntity(entity);
		setCreditAmount(5000);
		setShowCreditModal(true);
	};

	const submitCredit = async (reason: string) => {
		const entity = selectedEntity();
		if (!entity || creditAmount() <= 0) return;

		setCreditLoading(true);
		try {
			await ownerApi.addEntityCredit(entity.id, creditAmount(), reason);
			hapticFeedback.notificationOccurred('success');
			setShowCreditModal(false);
			fetchData();
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در افزایش اعتبار موجودیت');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} finally {
			setCreditLoading(false);
		}
	};

	const confirmImpersonation = async () => {
		const ownerId = impersonatingOwnerId();
		if (!ownerId) return;

		try {
			const res = await ownerApi.impersonateUser(ownerId);
			if (res.token) {
				sessionStorage.setItem('owner_impersonation_token', res.token);
				sessionStorage.setItem('impersonated_user_id', String(ownerId));
				sessionStorage.setItem('impersonated_username', String(ownerId));
				localStorage.removeItem('cached_profile_stats');
				localStorage.removeItem('cached_profile_achievements');
				localStorage.removeItem('cached_profile_referral');
				window.location.href = `${window.location.pathname}#/`;
				window.location.reload();
			}
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در ورود به حساب مالك');
		}
	};

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="bg-[#16171d]/60 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
				<div>
					<h2 class="text-sm font-black text-white">مدیریت گروه‌ها و کانال‌های تحت پوشش</h2>
					<p class="text-xs text-white/40 font-bold mt-0.5">
						مشاهده وضعیت اتصال ربات، مالکیت‌ها و افزایش اعتبار مستقیم
					</p>
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
						<span class="text-xs text-white/50 font-bold">
							در حال دریافت لیست گروه‌ها و کانال‌ها...
						</span>
					</div>
				}
			>
				<div class="space-y-8">
					{/* Channels Section */}
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-4">
						<h3 class="text-xs font-black uppercase text-[#3390ec] tracking-wider">
							کانال‌های متصل ({channels().length})
						</h3>
						<div class="overflow-x-auto">
							<table class="w-full text-start text-xs">
								<thead>
									<tr class="border-b border-white/10 text-white/40 text-[10px] font-bold">
										<th class="pb-3 text-start">عنوان کانال</th>
										<th class="pb-3 text-start">شناسه عددی / آی‌پی</th>
										<th class="pb-3 text-start">مالک (Owner)</th>
										<th class="pb-3 text-start">وضعیت سیستم</th>
										<th class="pb-3 text-end">عملیات</th>
									</tr>
								</thead>
								<tbody>
									<For
										each={channels()}
										fallback={
											<tr>
												<td colSpan={5} class="py-6 text-center text-white/40 font-bold">
													هیچ کانالی در سیستم یافت نشد.
												</td>
											</tr>
										}
									>
										{(ch) => (
											<tr class="border-b border-white/5 hover:bg-white/5 transition-all">
												<td class="py-3 text-start font-bold text-white">{ch.title}</td>
												<td class="py-3 text-start font-mono text-white/60">
													@{ch.username || ch.telegram_id}
												</td>
												<td class="py-3 text-start font-mono text-white/80">
													{ch.owner_username ? `@${ch.owner_username}` : ch.owner_id}
												</td>
												<td class="py-3 text-start">
													<span
														class={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
															ch.status === 'active'
																? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
																: 'bg-red-500/10 text-red-400 border border-red-500/20'
														}`}
													>
														{ch.status}
													</span>
												</td>
												<td class="py-3 text-end">
													<div class="flex items-center justify-end gap-2">
														<button
															onClick={() => setImpersonatingOwnerId(ch.owner_id)}
															class="h-8 px-3 bg-[#3390ec]/10 hover:bg-[#3390ec]/20 border border-[#3390ec]/30 text-[10px] font-bold text-[#3390ec] rounded-xl transition-all active:scale-95"
														>
															ورود به مالک
														</button>
														<button
															onClick={() => openCreditModal(ch)}
															class="h-8 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 rounded-xl transition-all active:scale-95"
														>
															افزایش اعتبار
														</button>
													</div>
												</td>
											</tr>
										)}
									</For>
								</tbody>
							</table>
						</div>
					</div>

					{/* Groups Section */}
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-4">
						<h3 class="text-xs font-black uppercase text-amber-400 tracking-wider">
							گروه‌های متصل ({groups().length})
						</h3>
						<div class="overflow-x-auto">
							<table class="w-full text-start text-xs">
								<thead>
									<tr class="border-b border-white/10 text-white/40 text-[10px] font-bold">
										<th class="pb-3 text-start">عنوان گروه</th>
										<th class="pb-3 text-start">شناسه عددی</th>
										<th class="pb-3 text-start">مالک (Owner)</th>
										<th class="pb-3 text-start">وضعیت سیستم</th>
										<th class="pb-3 text-end">عملیات</th>
									</tr>
								</thead>
								<tbody>
									<For
										each={groups()}
										fallback={
											<tr>
												<td colSpan={5} class="py-6 text-center text-white/40 font-bold">
													هیچ گروهی در سیستم یافت نشد.
												</td>
											</tr>
										}
									>
										{(gr) => (
											<tr class="border-b border-white/5 hover:bg-white/5 transition-all">
												<td class="py-3 text-start font-bold text-white">{gr.title}</td>
												<td class="py-3 text-start font-mono text-white/60">
													@{gr.username || gr.telegram_id}
												</td>
												<td class="py-3 text-start font-mono text-white/80">
													{gr.owner_username ? `@${gr.owner_username}` : gr.owner_id}
												</td>
												<td class="py-3 text-start">
													<span
														class={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
															gr.status === 'active'
																? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
																: 'bg-red-500/10 text-red-400 border border-red-500/20'
														}`}
													>
														{gr.status}
													</span>
												</td>
												<td class="py-3 text-end">
													<div class="flex items-center justify-end gap-2">
														<button
															onClick={() => setImpersonatingOwnerId(gr.owner_id)}
															class="h-8 px-3 bg-[#3390ec]/10 hover:bg-[#3390ec]/20 border border-[#3390ec]/30 text-[10px] font-bold text-[#3390ec] rounded-xl transition-all active:scale-95"
														>
															ورود به مالک
														</button>
														<button
															onClick={() => openCreditModal(gr)}
															class="h-8 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 rounded-xl transition-all active:scale-95"
														>
															افزایش اعتبار
														</button>
													</div>
												</td>
											</tr>
										)}
									</For>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</Show>

			{/* Credit Dialog */}
			<Show when={showCreditModal() && selectedEntity()}>
				<DangerActionDialog
					isOpen={true}
					title="افزایش اعتبار موجودیت"
					description={`افزایش مستقیم اعتبار سکه‌ای به موجودیت ${selectedEntity()?.title}.`}
					actionLabel="ثبت و افزایش اعتبار"
					riskLevel="medium"
					details={[
						{ label: 'عنوان', value: selectedEntity()?.title },
						{
							label: 'موجودی اعتبار',
							before: `${selectedEntity()?.credit_balance?.toLocaleString() || 0} FRG`,
							after: `${((selectedEntity()?.credit_balance || 0) + creditAmount()).toLocaleString()} FRG`,
						},
					]}
					loading={creditLoading()}
					onConfirm={submitCredit}
					onClose={() => setShowCreditModal(false)}
				/>
			</Show>

			{/* Impersonation Dialog */}
			<Show when={impersonatingOwnerId()}>
				<DangerActionDialog
					isOpen={true}
					title="ورود به جای مالک کانال/گروه"
					description={`ورود شبیه‌سازی‌شده خواندنی به حساب ادمین ${impersonatingOwnerId()}`}
					actionLabel="آغاز شبیه‌سازی"
					confirmWord="SIMULATE"
					riskLevel="high"
					details={[{ label: 'شناسه تلگرام مالک', value: impersonatingOwnerId()! }]}
					onConfirm={confirmImpersonation}
					onClose={() => setImpersonatingOwnerId(null)}
				/>
			</Show>
		</div>
	);
};
