import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { Title } from '@solidjs/meta';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';
import { apiClient } from '@/shared/api/axios.js';

export const OwnerEntities: Component = () => {
	const [channels, setChannels] = createSignal<any[]>([]);
	const [groups, setGroups] = createSignal<any[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal('');

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
											<th class="px-6 py-3 rounded-tl-xl">وضعیت ربات</th>
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
											<th class="px-6 py-3 rounded-tl-xl">وضعیت ربات</th>
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
