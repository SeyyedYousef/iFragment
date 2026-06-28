import { Component, createSignal, onMount, For, Show } from 'solid-js';
import { Title } from '@solidjs/meta';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';
import { apiClient } from '@/shared/api/axios.js';
import { hapticFeedback } from '@tma.js/sdk-solid';

interface DashboardAd {
	id: string;
	title: string;
	image_url: string;
	target: string;
	is_active: boolean;
}

export const OwnerAds: Component = () => {
	const [ads, setAds] = createSignal<DashboardAd[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [saving, setSaving] = createSignal(false);
	const [error, setError] = createSignal('');
	const [successMsg, setSuccessMsg] = createSignal('');

	const fetchSettings = async () => {
		try {
			const { data } = await apiClient.get('/owner/settings');
			setAds(data.dashboard_ads || []);
		} catch (e: any) {
			setError('خطا در دریافت تبلیغات');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchSettings();
	});

	const handleAddAd = () => {
		const newAd: DashboardAd = {
			id: Math.random().toString(36).substring(2, 9),
			title: '',
			image_url: '',
			target: '',
			is_active: false,
		};
		setAds([newAd, ...ads()]);
	};

	const handleRemoveAd = (id: string) => {
		setAds(ads().filter(ad => ad.id !== id));
	};

	const handleChange = (id: string, field: keyof DashboardAd, value: any) => {
		setAds(ads().map(ad => ad.id === id ? { ...ad, [field]: value } : ad));
	};

	const handleSave = async () => {
		setSaving(true);
		setError('');
		setSuccessMsg('');
		try {
			// First get current settings to preserve other fields
			const { data: currentSettings } = await apiClient.get('/owner/settings');
			
			const payload = {
				...currentSettings,
				dashboard_ads: ads(),
			};
			
			await apiClient.put('/owner/settings', payload);
			setSuccessMsg('تبلیغات با موفقیت ذخیره شدند.');
			try {
				hapticFeedback.notificationOccurred('success');
			} catch {}
			
			setTimeout(() => setSuccessMsg(''), 3000);
		} catch (e: any) {
			setError('خطا در ذخیره تبلیغات');
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		} finally {
			setSaving(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#0f1016] text-white pb-20">
			<Title>پنل مدیریت | تنظیمات تبلیغات داشبورد</Title>

			<OwnerTabs active="ads" />

			<div class="p-6 max-w-4xl mx-auto mt-4">
				<div class="flex items-center justify-between mb-8">
					<div>
						<h1 class="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-l from-white to-white/50">
							تبلیغات داشبورد
						</h1>
						<p class="text-white/50 text-sm font-bold">
							مدیریت بنرهای تبلیغاتی در داشبورد وب‌اپ
						</p>
					</div>
					<button
						onClick={handleAddAd}
						class="px-5 py-2.5 bg-[#3390ec] text-white font-bold rounded-xl active:scale-95 transition-transform flex items-center gap-2"
					>
						<span class="material-symbols-outlined text-[18px]">add</span>
						افزودن بنر
					</button>
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

				<Show
					when={!loading()}
					fallback={
						<div class="flex justify-center py-20">
							<div class="w-8 h-8 border-4 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin"></div>
						</div>
					}
				>
					<div class="space-y-4">
						<Show when={ads().length === 0}>
							<div class="text-center py-10 bg-white/5 rounded-3xl border border-white/5 text-white/50">
								هیچ تبلیغی تعریف نشده است.
							</div>
						</Show>

						<For each={ads()}>
							{(ad) => (
								<div class="bg-white/5 border border-white/5 rounded-3xl p-6 relative flex flex-col md:flex-row gap-6">
									<button 
										onClick={() => handleRemoveAd(ad.id)}
										class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors z-10"
									>
										<span class="material-symbols-outlined text-[16px]">delete</span>
									</button>
									
									<div class="flex-1 space-y-4 pt-4 md:pt-0">
										<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<label class="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">
													عنوان (جهت شناسایی)
												</label>
												<input
													type="text"
													class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#3390ec] focus:outline-none transition-all font-sans text-sm"
													value={ad.title}
													onInput={(e) => handleChange(ad.id, 'title', e.currentTarget.value)}
													placeholder="مثال: تبلیغ اسپانسر X"
												/>
											</div>
											
											<div>
												<label class="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">
													لینک تصویر (Image URL)
												</label>
												<input
													type="url"
													class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#3390ec] focus:outline-none transition-all font-mono text-sm"
													value={ad.image_url}
													onInput={(e) => handleChange(ad.id, 'image_url', e.currentTarget.value)}
													placeholder="https://..."
												/>
											</div>
										</div>

										<div>
											<label class="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">
												لینک مقصد (Target URL / Telegram Link)
											</label>
											<input
												type="text"
												class="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#3390ec] focus:outline-none transition-all font-mono text-sm"
												value={ad.target}
												onInput={(e) => handleChange(ad.id, 'target', e.currentTarget.value)}
												placeholder="https://t.me/..."
											/>
										</div>

										<div class="mt-4 flex items-center gap-3 border-t border-white/5 pt-4">
											<label class="relative inline-flex items-center cursor-pointer">
												<input
													type="checkbox"
													class="sr-only peer"
													checked={ad.is_active}
													onChange={(e) => handleChange(ad.id, 'is_active', e.currentTarget.checked)}
												/>
												<div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3390ec]"></div>
											</label>
											<span class="text-sm font-bold text-white/80">وضعیت نمایش (روشن/خاموش)</span>
										</div>
									</div>

									{/* Preview Area */}
									<div class="w-full md:w-48 shrink-0 flex flex-col gap-2">
										<label class="block text-xs font-bold text-white/50 uppercase tracking-wider">
											پیش‌نمایش بنر
										</label>
										<div class="w-full aspect-video rounded-xl bg-black/50 border border-white/10 overflow-hidden flex items-center justify-center relative group">
											<Show 
												when={ad.image_url} 
												fallback={<span class="text-white/20 text-xs">بدون تصویر</span>}
											>
												<img src={ad.image_url} alt="پیش‌نمایش" class="w-full h-full object-cover" />
												<div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
													<a href={ad.target} target="_blank" rel="noopener noreferrer" class="text-white text-xs bg-black/50 px-3 py-1 rounded-full border border-white/20 backdrop-blur-md">
														لینک مقصد
													</a>
												</div>
											</Show>
										</div>
									</div>

								</div>
							)}
						</For>

						<div class="pt-6">
							<button
								onClick={handleSave}
								disabled={saving()}
								class="w-full md:w-auto px-10 py-4 bg-[#3390ec] text-white font-black rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
							>
								<Show when={saving()} fallback={
									<>
										<span class="material-symbols-outlined text-[20px]">save</span>
										ذخیره تغییرات
									</>
								}>
									<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
								</Show>
							</button>
						</div>
					</div>
				</Show>
			</div>
		</div>
	);
};
