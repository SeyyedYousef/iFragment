import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { Title } from '@solidjs/meta';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';
import { apiClient } from '@/shared/api/axios.js';
import { hapticFeedback } from '@tma.js/sdk-solid';

export const OwnerEntities: Component = () => {
	const [channels, setChannels] = createSignal<any[]>([]);
	const [groups, setGroups] = createSignal<any[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal('');

	const [showCreditModal, setShowCreditModal] = createSignal(false);
	const [selectedEntity, setSelectedEntity] = createSignal<{id: string, type: string, title: string} | null>(null);
	const [creditDays, setCreditDays] = createSignal(30);
	const [creditLoading, setCreditLoading] = createSignal(false);

	const fetchData = async () => {
		try {
			const [channelsResp, groupsResp] = await Promise.all([
				apiClient.get('/owner/entities/channels'),
				apiClient.get('/owner/entities/groups'),
			]);
			setChannels(channelsResp.data || []);
			setGroups(groupsResp.data || []);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در دریافت لیست موجودیت‌ها');
		} finally {
			setLoading(false);
		}
	};

	const showTmaConfirm = (message: string, onConfirm: () => void) => {
		const tg = (window as any).Telegram?.WebApp;
		if (tg?.showConfirm) {
			tg.showConfirm(message, (confirmed: boolean) => {
				if (confirmed) onConfirm();
			});
		} else {
			if (window.confirm(message)) onConfirm();
		}
	};

	const openCreditModal = (id: string, type: string, title: string) => {
		setSelectedEntity({id, type, title});
		setCreditDays(30);
		setShowCreditModal(true);
	};

	const submitCredit = async () => {
		const entity = selectedEntity();
		if (!entity || creditDays() <= 0) return;
		
		setCreditLoading(true);
		try {
			await apiClient.post('/owner/entities/add-credit', {
				entity_id: entity.id,
				entity_type: entity.type,
				days: creditDays(),
			});
			try {
				hapticFeedback.notificationOccurred('success');
			} catch {}
			setShowCreditModal(false);
			fetchData();
		} catch (e: any) {
			alert(e.response?.data?.error || 'خطا در افزودن اعتبار');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} finally {
			setCreditLoading(false);
		}
	};

	const handleImpersonate = (ownerId: number) => {
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}

		showTmaConfirm(
			`Are you sure you want to impersonate user ${ownerId}? You will enter simulation mode.`,
			async () => {
				try {
					const resp = await apiClient.post('/owner/users/impersonate', {
						user_id: ownerId,
					});
					const { token } = resp.data;
					
					sessionStorage.setItem('owner_impersonation_token', token);
					sessionStorage.setItem('impersonated_user_id', String(ownerId));
					sessionStorage.setItem('impersonated_username', String(ownerId));
					// Clear cached owner profile data so impersonated user gets fresh data
					localStorage.removeItem('cached_profile_stats');
					localStorage.removeItem('cached_profile_achievements');
					localStorage.removeItem('cached_profile_referral');
					// Redirect to home under impersonation (HashRouter-compatible)
					window.location.href = window.location.pathname + '#/';
					window.location.reload();
				} catch (e: any) {
					alert(e.response?.data?.error || 'Failed to impersonate');
				}
			}
		);
	};

	onMount(() => {
		fetchData();
	});

	return (
		<div class="min-h-screen bg-[#0f1016] text-white pb-20">
			<Title>پنل مدیریت | مدیریت کانال‌ها و گروه‌ها</Title>
			<OwnerTabs active="entities" />

			<div class="p-6 max-w-6xl mx-auto mt-4">
				<div class="mb-8">
					<h1 class="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-l from-white to-white/50">
						کانال‌ها و گروه‌های متصل
					</h1>
					<p class="text-white/50 text-sm font-bold">
						فهرست تمام موجودیت‌هایی که ربات در آن‌ها ادمین است
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
						{/* Channels */}
						<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
							<h3 class="font-black text-xl mb-4 text-[#3390ec]">کانال‌ها ({channels().length})</h3>
							<div class="overflow-x-auto">
								<table class="w-full text-sm text-right">
									<thead class="text-xs text-white/50 uppercase bg-white/5">
										<tr>
											<th class="px-6 py-3 rounded-tr-xl">عنوان کانال</th>
											<th class="px-6 py-3">شناسه کانال</th>
											<th class="px-6 py-3">مالک (User ID)</th>
											<th class="px-6 py-3">وضعیت ربات</th>
											<th class="px-6 py-3 rounded-tl-xl">عملیات</th>
										</tr>
									</thead>
									<tbody>
										<For each={channels()} fallback={<tr><td colSpan="4" class="text-center py-4 text-white/50">هیچ کانالی یافت نشد</td></tr>}>
											{(ch) => (
												<tr class="border-b border-white/5 hover:bg-white/5">
													<td class="px-6 py-4 font-bold">{ch.title}</td>
													<td class="px-6 py-4 font-mono text-xs">{ch.entity_id}</td>
													<td class="px-6 py-4">{ch.owner_id}</td>
													<td class="px-6 py-4">
														<span class={`px-2 py-1 rounded text-xs font-bold ${
															ch.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
														}`}>
															{ch.status}
														</span>
													</td>
													<td class="px-6 py-4">
														<div class="flex items-center gap-2">
															<button
																onClick={() => handleImpersonate(ch.owner_id)}
																class="h-8 px-3 bg-gradient-to-r from-[#3390ec]/15 to-[#3390ec]/5 hover:from-[#3390ec]/25 border border-[#3390ec]/30 text-[9px] font-black uppercase tracking-wider text-[#3390ec] rounded-xl active:scale-95 transition-all flex items-center gap-1"
															>
																<span class="material-symbols-outlined text-[12px]">visibility</span>
																ورود
															</button>
															<button
																onClick={() => openCreditModal(ch.id, 'channel', ch.title)}
																class="h-8 px-3 bg-gradient-to-r from-green-500/15 to-green-500/5 hover:from-green-500/25 border border-green-500/30 text-[9px] font-black uppercase tracking-wider text-green-400 rounded-xl active:scale-95 transition-all flex items-center gap-1"
															>
																<span class="material-symbols-outlined text-[12px]">add</span>
																اعتبار
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

						{/* Groups */}
						<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
							<h3 class="font-black text-xl mb-4 text-amber-400">گروه‌ها ({groups().length})</h3>
							<div class="overflow-x-auto">
								<table class="w-full text-sm text-right">
									<thead class="text-xs text-white/50 uppercase bg-white/5">
										<tr>
											<th class="px-6 py-3 rounded-tr-xl">عنوان گروه</th>
											<th class="px-6 py-3">شناسه گروه</th>
											<th class="px-6 py-3">مالک (User ID)</th>
											<th class="px-6 py-3">وضعیت ربات</th>
											<th class="px-6 py-3 rounded-tl-xl">عملیات</th>
										</tr>
									</thead>
									<tbody>
										<For each={groups()} fallback={<tr><td colSpan="4" class="text-center py-4 text-white/50">هیچ گروهی یافت نشد</td></tr>}>
											{(gr) => (
												<tr class="border-b border-white/5 hover:bg-white/5">
													<td class="px-6 py-4 font-bold">{gr.title}</td>
													<td class="px-6 py-4 font-mono text-xs">{gr.entity_id}</td>
													<td class="px-6 py-4">{gr.owner_id}</td>
													<td class="px-6 py-4">
														<span class={`px-2 py-1 rounded text-xs font-bold ${
															gr.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
														}`}>
															{gr.status}
														</span>
													</td>
													<td class="px-6 py-4">
														<div class="flex items-center gap-2">
															<button
																onClick={() => handleImpersonate(gr.owner_id)}
																class="h-8 px-3 bg-gradient-to-r from-[#3390ec]/15 to-[#3390ec]/5 hover:from-[#3390ec]/25 border border-[#3390ec]/30 text-[9px] font-black uppercase tracking-wider text-[#3390ec] rounded-xl active:scale-95 transition-all flex items-center gap-1"
															>
																<span class="material-symbols-outlined text-[12px]">visibility</span>
																ورود
															</button>
															<button
																onClick={() => openCreditModal(gr.id, 'group', gr.title)}
																class="h-8 px-3 bg-gradient-to-r from-green-500/15 to-green-500/5 hover:from-green-500/25 border border-green-500/30 text-[9px] font-black uppercase tracking-wider text-green-400 rounded-xl active:scale-95 transition-all flex items-center gap-1"
															>
																<span class="material-symbols-outlined text-[12px]">add</span>
																اعتبار
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
			</div>

			{/* Add Credit Modal */}
			<Show when={showCreditModal()}>
				<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
					<div class="bg-[#1c1c1e] border border-white/10 w-full max-w-sm rounded-[24px] p-6 shadow-2xl">
						<div class="flex items-center justify-between mb-4">
							<h3 class="text-xl font-bold text-white">افزایش اعتبار</h3>
							<button onClick={() => setShowCreditModal(false)} class="text-white/50 hover:text-white">
								<span class="material-symbols-outlined">close</span>
							</button>
						</div>
						
						<p class="text-sm text-white/60 mb-6">
							در حال اضافه کردن اعتبار به <span class="font-bold text-white">{selectedEntity()?.title}</span> هستید.
						</p>

						<div class="mb-6">
							<label class="block text-xs font-semibold text-white/50 mb-2 uppercase tracking-wider">
								تعداد روز
							</label>
							<input
								type="number"
								min="1"
								class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#3390ec] focus:outline-none transition-all font-mono"
								value={creditDays()}
								onInput={(e) => setCreditDays(Number(e.currentTarget.value))}
							/>
						</div>

						<div class="flex gap-3">
							<button
								onClick={() => setShowCreditModal(false)}
								class="flex-1 py-3 rounded-xl bg-white/5 text-white/70 font-semibold hover:bg-white/10 transition-colors"
							>
								انصراف
							</button>
							<button
								onClick={submitCredit}
								disabled={creditLoading() || creditDays() <= 0}
								class="flex-1 py-3 rounded-xl bg-[#3390ec] text-white font-bold hover:bg-[#2b7bc9] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
							>
								<Show when={creditLoading()} fallback="ثبت اعتبار">
									<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
								</Show>
							</button>
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
};
