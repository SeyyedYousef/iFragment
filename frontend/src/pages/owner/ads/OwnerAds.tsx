import { Component, createSignal, onMount, For, Show } from 'solid-js';
import { ownerApi, DashboardAd } from '@/shared/api/owner.js';
import { hapticFeedback } from '@tma.js/sdk-solid';

export const OwnerAds: Component = () => {
	const [ads, setAds] = createSignal<DashboardAd[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [saving, setSaving] = createSignal(false);
	const [error, setError] = createSignal('');
	const [successMsg, setSuccessMsg] = createSignal('');

	const fetchAds = async () => {
		setLoading(true);
		setError('');
		try {
			const data = await ownerApi.getAds();
			setAds(data || []);
		} catch (e: any) {
			setError('خطا در دریافت لیست تبلیغات داشبورد');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchAds();
	});

	const handleAddAd = () => {
		const newAd: DashboardAd = {
			id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ad_${Date.now()}`,
			title: '',
			image_url: '',
			target: '',
			is_active: true,
		};
		setAds([newAd, ...ads()]);
	};

	const handleRemoveAd = (id: string) => {
		setAds(ads().filter((ad) => ad.id !== id));
	};

	const handleChange = (id: string, field: keyof DashboardAd, value: any) => {
		setAds(ads().map((ad) => (ad.id === id ? { ...ad, [field]: value } : ad)));
	};

	const handleSave = async () => {
		setSaving(true);
		setError('');
		setSuccessMsg('');
		try {
			// P0-3 FIX: Use decoupled updateAds API method to prevent overwriting SystemSettings!
			await ownerApi.updateAds(ads());
			setSuccessMsg('تنظیمات بنرهای تبلیغاتی داشبورد با موفقیت ذخیره شد.');
			try {
				hapticFeedback.notificationOccurred('success');
			} catch {}

			setTimeout(() => setSuccessMsg(''), 4000);
		} catch (e: any) {
			setError('خطا در ذخیره‌سازی تبلیغات داشبورد');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} fontally: {
			setSaving(false);
		}
	};

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="bg-[#16171d]/60 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
				<div>
					<h2 class="text-sm font-black text-white">تنظیمات و مدیریت بنرهای تبلیغاتی داشبورد</h2>
					<p class="text-xs text-white/40 font-bold mt-0.5">مدیریت لایه‌بندی بنرهای تبلیغاتی متصل به فرانت‌اند وب‌اپ</p>
				</div>
				<button
					onClick={handleAddAd}
					class="h-10 px-5 bg-[#3390ec] hover:bg-[#2b7ec9] text-xs font-black uppercase text-white rounded-2xl active:scale-95 transition-all flex items-center gap-1.5 shadow-lg shadow-[#3390ec]/20"
				>
					<span class="material-symbols-outlined text-[18px]">add</span>
					افزودن بنر جديد
				</button>
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

			<Show
				when={!loading()}
				fallback={
					<div class="flex flex-col items-center justify-center py-20 gap-3">
						<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
						<span class="text-xs text-white/50 font-bold">در حال دریافت بنرهای تبلیغاتی...</span>
					</div>
				}
			>
				<div class="space-y-4">
					<Show when={ads().length === 0}>
						<div class="text-center py-12 bg-[#16171d]/60 border border-white/5 rounded-3xl text-white/40 text-xs font-bold space-y-2">
							<span class="material-symbols-outlined text-4xl text-white/20">campaign</span>
							<p>هیچ بنر تبلیغاتی تعریف نشده است.</p>
						</div>
					</Show>

					<For each={ads()}>
						{(ad) => (
							<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 relative flex flex-col md:flex-row gap-6 hover:border-white/20 transition-all">
								<button
									onClick={() => handleRemoveAd(ad.id)}
									class="absolute top-4 end-4 w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all z-10"
									title="حذف این بنر"
								>
									<span class="material-symbols-outlined text-[16px]">delete</span>
								</button>

								<div class="flex-1 space-y-4 pt-4 md:pt-0">
									<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label class="block text-[10px] font-bold text-white/50 mb-1">عنوان بنر (جهت شناسایی)</label>
											<input
												type="text"
												class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs text-white focus:border-[#3390ec] outline-none"
												value={ad.title}
												onInput={(e) => handleChange(ad.id, 'title', e.currentTarget.value)}
												placeholder="مثال: بنر تبلیغاتی اسپانسر X"
											/>
										</div>

										<div>
											<label class="block text-[10px] font-bold text-white/50 mb-1">لینک تصویر (Image URL)</label>
											<input
												type="url"
												class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white focus:border-[#3390ec] outline-none"
												value={ad.image_url}
												onInput={(e) => handleChange(ad.id, 'image_url', e.currentTarget.value)}
												placeholder="https://..."
												dir="ltr"
											/>
										</div>
									</div>

									<div>
										<label class="block text-[10px] font-bold text-white/50 mb-1">لینک مقصد (Target URL / Telegram Channel)</label>
										<input
											type="text"
											class="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-xs font-mono text-white focus:border-[#3390ec] outline-none"
											value={ad.target}
											onInput={(e) => handleChange(ad.id, 'target', e.currentTarget.value)}
											placeholder="https://t.me/..."
											dir="ltr"
										/>
									</div>

									<div class="flex items-center gap-3 pt-2">
										<label class="relative inline-flex items-center cursor-pointer">
											<input
												type="checkbox"
												class="sr-only peer"
												checked={ad.is_active}
												onChange={(e) => handleChange(ad.id, 'is_active', e.currentTarget.checked)}
											/>
											<div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3390ec]" />
										</label>
										<span class="text-xs font-bold text-white/80">وضعیت نمایش بنر (فعال / غیرفعال)</span>
									</div>
								</div>

								{/* Preview */}
								<div class="w-full md:w-48 shrink-0 flex flex-col gap-2">
									<span class="block text-[10px] font-bold text-white/50">پیش‌نمایش بنر</span>
									<div class="w-full aspect-video rounded-2xl bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center relative group">
										<Show
											when={ad.image_url}
											fallback={<span class="text-white/20 text-[10px] font-bold">بدون تصویر</span>}
										>
											<img
												src={ad.image_url}
												alt="پیش‌نمایش"
												class="w-full h-full object-cover"
												onError={(e) => {
													(e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" viewBox="0 0 100 60"><rect width="100" height="60" fill="%23222"/><text x="50" y="35" fill="%23666" font-size="10" text-anchor="middle">Broken Image</text></svg>';
												}}
											/>
										</Show>
									</div>
								</div>
							</div>
						)}
					</For>

					<div class="pt-4 flex justify-end">
						<button
							onClick={handleSave}
							disabled={saving()}
							class="h-12 px-10 bg-[#3390ec] hover:bg-[#2b7ec9] text-xs font-black uppercase text-white rounded-2xl transition-all disabled:opacity-40 flex items-center gap-2 active:scale-95 shadow-lg shadow-[#3390ec]/20"
						>
							<Show when={saving()} fallback={
								<>
									<span class="material-symbols-outlined text-[18px]">save</span>
									ذخیره تغییرات تبلیغات
								</>
							}>
								<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
								در حال ذخیره...
							</Show>
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};
