import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { ownerApi, BroadcastMessage } from '@/shared/api/owner.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.js';
import { hapticFeedback } from '@tma.js/sdk-solid';

export const OwnerBroadcast: Component = () => {
	const [broadcasts, setBroadcasts] = createSignal<BroadcastMessage[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [error, setError] = createSignal('');
	const [successMsg, setSuccessMsg] = createSignal('');

	const [audience, setAudience] = createSignal<'all' | 'premium' | 'active_7d' | 'inactive'>('all');
	const [message, setMessage] = createSignal('');
	const [sending, setSending] = createSignal(false);
	const [isPreviewOpen, setIsPreviewOpen] = createSignal(false);
	const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);

	const getSmartDefaultScheduleTime = () => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(10, 0, 0, 0);
		return tomorrow.toISOString().slice(0, 16);
	};
	const [scheduleTime, setScheduleTime] = createSignal(getSmartDefaultScheduleTime());

	const fetchBroadcasts = async () => {
		setLoading(true);
		setError('');
		try {
			const data = await ownerApi.listBroadcasts();
			setBroadcasts(data || []);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در دریافت لیست پیام‌های همگانی');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchBroadcasts();
	});

	const handleInitiateSend = (e: Event) => {
		e.preventDefault();
		if (!message().trim()) {
			setError('متن پیام همگانی نمی‌تواند خالی باشد.');
			return;
		}
		setShowConfirmDialog(true);
	};

	const executeSendBroadcast = async (_reason: string) => {
		setSending(true);
		setError('');
		setSuccessMsg('');

		try {
			await ownerApi.sendBroadcast(audience(), message().trim(), scheduleTime() || undefined);
			setSuccessMsg('پیام همگانی با موفقیت ثبت شد و در صف ارسال قرار گرفت.');
			setMessage('');
			setShowConfirmDialog(false);
			fetchBroadcasts();
			try {
				hapticFeedback.notificationOccurred('success');
			} catch {}
			setTimeout(() => setSuccessMsg(''), 4000);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در ارسال پیام همگانی');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} finally {
			setSending(false);
		}
	};

	const getAudienceLabel = (aud: string) => {
		if (aud === 'premium') return 'کاربران پرمیوم';
		if (aud === 'active_7d' || aud === 'active') return 'فعالان ۷ روز اخیر';
		if (aud === 'inactive') return 'کاربران غیرفعال';
		return 'تمام کاربران ربات';
	};

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="bg-[#16171d]/60 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
				<div>
					<h2 class="text-sm font-black text-white">سامانه ارسال پیام همگانی (Broadcast System)</h2>
					<p class="text-xs text-white/40 font-bold mt-0.5">ارسال انبوه پیام‌های اطلاع‌رسانی به کاربران با قابلیت انتخاب جامعه هدف</p>
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

			{/* Form */}
			<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-4">
				<h3 class="text-xs font-black uppercase text-white tracking-wider">تنظیم و ارسال پیام جدید</h3>

				<form onSubmit={handleInitiateSend} class="space-y-4">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label class="block text-[10px] font-bold text-white/50 mb-1">جامعه هدف (Audience)</label>
							<select
								value={audience()}
								onChange={(e) => setAudience(e.currentTarget.value as any)}
								class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs text-white outline-none focus:border-[#3390ec]"
							>
								<option value="all">همه کاربران (عمومی)</option>
								<option value="premium">کاربران پرمیوم (Premium)</option>
								<option value="active_7d">کاربران فعال ۷ روز اخیر</option>
								<option value="inactive">کاربران غیرفعال</option>
							</select>
						</div>

						<div>
							<label class="block text-[10px] font-bold text-white/50 mb-1">زمان‌بندی ارسال (اختیاری)</label>
							<input
								type="datetime-local"
								value={scheduleTime()}
								onInput={(e) => setScheduleTime(e.currentTarget.value)}
								class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white outline-none focus:border-[#3390ec]"
							/>
						</div>
					</div>

					<div>
						<div class="flex items-center justify-between mb-1">
							<label class="block text-[10px] font-bold text-white/50">متن پیام تلگرام (پشتیبانی از فرمت HTML)</label>
							<button
								type="button"
								onClick={() => setIsPreviewOpen(!isPreviewOpen())}
								class="text-[10px] text-[#3390ec] font-bold underline"
							>
								{isPreviewOpen() ? 'پنهان‌سازی پیش‌نمایش' : 'مشاهده پیش‌نمایش تلگرام'}
							</button>
						</div>
						<textarea
							rows={5}
							required
							value={message()}
							onInput={(e) => setMessage(e.currentTarget.value)}
							placeholder="سلام کاربران گرامی، نسخه جدید ربات منتشر شد..."
							class="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white focus:border-[#3390ec] outline-none resize-none font-sans leading-relaxed"
						/>
					</div>

					{/* Telegram Live Preview */}
					<Show when={isPreviewOpen() && message().trim()}>
						<div class="p-4 bg-[#182533] border border-white/10 rounded-2xl space-y-2">
							<div class="flex items-center gap-2 text-white/40 text-[9px] font-bold uppercase">
								<span>📱 پیش‌نمایش نمایش پیام در تلگرام:</span>
							</div>
							<div class="text-xs text-white font-sans whitespace-pre-wrap leading-relaxed">
								{message()}
							</div>
						</div>
					</Show>

					<div class="flex justify-end pt-2">
						<button
							type="submit"
							disabled={sending() || !message().trim()}
							class="h-11 px-8 bg-[#3390ec] hover:bg-[#2b7ec9] text-xs font-black uppercase text-white rounded-xl transition-all disabled:opacity-40 flex items-center gap-2 active:scale-95 shadow-lg shadow-[#3390ec]/20"
						>
							<span class="material-symbols-outlined text-[18px]">send</span>
							ارسال همگانی پیام
						</button>
					</div>
				</form>
			</div>

			{/* History Table */}
			<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-4">
				<h3 class="text-xs font-black uppercase text-white tracking-wider">تاریخچه پیام‌های صادر شده</h3>

				<Show when={loading()}>
					<div class="flex justify-center items-center py-10">
						<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
					</div>
				</Show>

				<Show when={!loading() && broadcasts().length === 0}>
					<div class="text-center py-10 text-white/40 text-xs font-bold">هیچ پیام همگانی صادر نشده است.</div>
				</Show>

				<Show when={!loading() && broadcasts().length > 0}>
					<div class="overflow-x-auto">
						<table class="w-full text-start text-xs">
							<thead>
								<tr class="border-b border-white/10 text-white/40 text-[10px] font-bold">
									<th class="pb-3 text-start">تاریخ</th>
									<th class="pb-3 text-start">جامعه هدف</th>
									<th class="pb-3 text-start">خلاصه متن</th>
									<th class="pb-3 text-start">وضعیت</th>
									<th class="pb-3 text-end">تعداد ارسال شده</th>
								</tr>
							</thead>
							<tbody>
								<For each={broadcasts()}>
									{(b) => (
										<tr class="border-b border-white/5 hover:bg-white/5 transition-all">
											<td class="py-4 text-start font-mono text-white/70 text-[11px]">
												{b.created_at ? new Date(b.created_at).toLocaleDateString('fa-IR') : '---'}
											</td>
											<td class="py-4 text-start">
												<span class="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-white">
													{getAudienceLabel(b.target_audience)}
												</span>
											</td>
											<td class="py-4 text-start max-w-[200px] truncate text-white/80 font-medium" title={b.message_text}>
												{b.message_text}
											</td>
											<td class="py-4 text-start">
												<span
													class={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase ${
														b.status === 'completed' || (b.status as string) === 'sent'
															? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
															: b.status === 'failed'
																? 'bg-red-500/10 text-red-400 border border-red-500/20'
																: 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
													}`}
												>
													{b.status}
												</span>
											</td>
											<td class="py-4 text-end font-mono font-bold text-white">{b.sent_count?.toLocaleString() || 0}</td>
										</tr>
									)}
								</For>
							</tbody>
						</table>
					</div>
				</Show>
			</div>

			{/* Review Confirmation Step */}
			<Show when={showConfirmDialog()}>
				<DangerActionDialog
					isOpen={true}
					title="تأیید نهایی ارسال همگانی پیام"
					description={`آیا از ارسال پیام همگانی به ${getAudienceLabel(audience())} اطمینان کامل دارید؟ این عملیات غیرقابل بازگشت است.`}
					actionLabel="تأیید و ارسال انبوه"
					confirmWord="SEND"
					riskLevel="critical"
					details={[
						{ label: 'جامعه هدف', value: getAudienceLabel(audience()) },
						{ label: 'زمان ارسال', value: scheduleTime() ? new Date(scheduleTime()).toLocaleString('fa-IR') : 'بلافاصله' },
					]}
					loading={sending()}
					onConfirm={executeSendBroadcast}
					onClose={() => setShowConfirmDialog(false)}
				/>
			</Show>
		</div>
	);
};
