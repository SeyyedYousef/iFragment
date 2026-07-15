import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { Title } from '@solidjs/meta';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';
import { apiClient } from '@/shared/api/axios.js';

interface Broadcast {
	id: string;
	target_audience: string;
	message: string;
	status: string;
	sent_count: number;
	created_at: string;
}

export const OwnerBroadcast: Component = () => {
	const [broadcasts, setBroadcasts] = createSignal<Broadcast[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal('');
	const [successMsg, setSuccessMsg] = createSignal('');

	const [audience, setAudience] = createSignal('all');
	const [message, setMessage] = createSignal('');
	const [sending, setSending] = createSignal(false);

	// Smart Defaults: Pre-fill broadcast schedule times (1 day from now at 10:00 AM)
	const getSmartDefaultScheduleTime = () => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(10, 0, 0, 0);
		const year = tomorrow.getFullYear();
		const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
		const day = String(tomorrow.getDate()).padStart(2, '0');
		const hours = String(tomorrow.getHours()).padStart(2, '0');
		const minutes = String(tomorrow.getMinutes()).padStart(2, '0');
		return `${year}-${month}-${day}T${hours}:${minutes}`;
	};
	const [scheduleTime, setScheduleTime] = createSignal(getSmartDefaultScheduleTime());

	const fetchBroadcasts = async () => {
		try {
			const resp = await apiClient.get('/owner/broadcasts');
			setBroadcasts(resp.data || []);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در دریافت لیست پیام‌ها');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchBroadcasts();
	});

	const handleSend = async (e: Event) => {
		e.preventDefault();
		if (!message().trim()) return;

		setSending(true);
		setError('');
		setSuccessMsg('');

		try {
			await apiClient.post('/owner/broadcasts', {
				target_audience: audience(),
				message: message().trim(),
				scheduled_at: scheduleTime(),
			});
			setSuccessMsg('پیام در صف ارسال قرار گرفت');
			setMessage('');
			fetchBroadcasts();
			setTimeout(() => setSuccessMsg(''), 3000);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در ارسال پیام');
		} finally {
			setSending(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#0f1016] text-white pb-20">
			<Title>پنل مدیریت | ارسال پیام همگانی</Title>

			<OwnerTabs active="broadcast" />

			<div class="p-6 max-w-4xl mx-auto mt-4">
				<div class="mb-8">
					<h1 class="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-l from-white to-white/50">
						پیام همگانی (Broadcast)
					</h1>
					<p class="text-white/50 text-sm font-bold">
						ارسال پیام گروهی به کاربران ربات
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

				{/* Send Form */}
				<div class="bg-white/5 border border-white/5 rounded-3xl p-6 mb-8">
					<form onSubmit={handleSend} class="space-y-4">
						<div>
							<label class="block text-xs font-bold text-white/50 mb-2">مخاطبین هدف</label>
							<select
								value={audience()}
								onChange={(e) => setAudience(e.target.value)}
								class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3390ec]"
								dir="rtl"
							>
								<option value="all">همه کاربران</option>
								<option value="premium">کاربران دارای اشتراک</option>
								<option value="active">کاربران فعال (۷ روز گذشته)</option>
							</select>
						</div>

						<div>
							<label class="block text-xs font-bold text-white/50 mb-2">زمان ارسال زمان‌بندی شده (Smart Default)</label>
							<input
								type="datetime-local"
								value={scheduleTime()}
								onInput={(e) => setScheduleTime(e.target.value)}
								class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3390ec]"
								dir="rtl"
							/>
						</div>

						<div>
							<label class="block text-xs font-bold text-white/50 mb-2">متن پیام (پشتیبانی از HTML/Markdown تلگرام)</label>
							<textarea
								rows="5"
								required
								value={message()}
								onInput={(e) => setMessage(e.target.value)}
								class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3390ec] resize-none"
								dir="rtl"
								placeholder="سلام، نسخه جدید ربات در دسترس است..."
							></textarea>
						</div>

						<div class="flex justify-end pt-2">
							<button
								type="submit"
								disabled={sending() || !message().trim()}
								class="bg-[#3390ec] text-white px-8 py-3 rounded-xl font-black text-sm hover:bg-[#3390ec]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
							>
								{sending() ? (
									<>
										<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
										در حال ارسال...
									</>
								) : (
									<>
										<span class="material-symbols-outlined text-[18px]">send</span>
										ارسال پیام
									</>
								)}
							</button>
						</div>
					</form>
				</div>

				{/* History */}
				<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
					<h3 class="font-black text-lg text-white mb-6">تاریخچه ارسال‌ها</h3>
					<Show when={loading()}>
						<div class="flex justify-center py-10">
							<div class="w-8 h-8 border-4 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin"></div>
						</div>
					</Show>
					<Show when={!loading() && broadcasts().length === 0}>
						<div class="text-center py-10 text-white/50 font-bold">هیچ پیامی ارسال نشده است.</div>
					</Show>
					<Show when={!loading() && broadcasts().length > 0}>
						<div class="overflow-x-auto">
							<table class="w-full text-right text-sm">
								<thead class="text-xs text-white/50 border-b border-white/10">
									<tr>
										<th class="px-4 py-3">تاریخ</th>
										<th class="px-4 py-3">مخاطبین</th>
										<th class="px-4 py-3">متن (خلاصه)</th>
										<th class="px-4 py-3">وضعیت</th>
										<th class="px-4 py-3">تعداد ارسال</th>
									</tr>
								</thead>
								<tbody>
									<For each={broadcasts()}>
										{(b) => (
											<tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
												<td class="px-4 py-4 text-xs" dir="ltr">{new Date(b.created_at).toLocaleString()}</td>
												<td class="px-4 py-4">
													<span class="bg-white/10 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
														{b.target_audience}
													</span>
												</td>
												<td class="px-4 py-4 max-w-[200px] truncate" title={b.message}>{b.message}</td>
												<td class="px-4 py-4">
													<span class={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
														b.status === 'completed' ? 'bg-green-500/20 text-green-400' :
														b.status === 'failed' ? 'bg-red-500/20 text-red-400' :
														'bg-yellow-500/20 text-yellow-400'
													}`}>
														{b.status}
													</span>
												</td>
												<td class="px-4 py-4 font-black" dir="ltr">{b.sent_count}</td>
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
