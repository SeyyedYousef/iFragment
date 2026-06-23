import { Component, createSignal, onMount, Show } from 'solid-js';
import { Title } from '@solidjs/meta';
import { OwnerTabs } from '@/widgets/owner/OwnerTabs.js';
import { apiClient } from '@/shared/api/axios.js';

interface SystemSettings {
	maintenance_mode: boolean;
	tap_multiplier: number;
	referral_bonus: number;
	daily_reward_base: number;
}

export const OwnerSettings: Component = () => {
	const [settings, setSettings] = createSignal<SystemSettings | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [saving, setSaving] = createSignal(false);
	const [error, setError] = createSignal('');
	const [successMsg, setSuccessMsg] = createSignal('');

	const fetchSettings = async () => {
		try {
			const resp = await apiClient.get('/owner/settings');
			setSettings(resp.data);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در دریافت تنظیمات سیستم');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchSettings();
	});

	const handleSave = async (e: Event) => {
		e.preventDefault();
		if (!settings()) return;

		setSaving(true);
		setError('');
		setSuccessMsg('');

		try {
			await apiClient.put('/owner/settings', settings());
			setSuccessMsg('تنظیمات با موفقیت ذخیره شد');
			setTimeout(() => setSuccessMsg(''), 3000);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در ذخیره تنظیمات');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#0f1016] text-white pb-20">
			<Title>پنل مدیریت | تنظیمات سیستم</Title>

			<OwnerTabs active="settings" />

			<div class="p-6 max-w-4xl mx-auto mt-4">
				<div class="mb-8">
					<h1 class="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-l from-white to-white/50">
						تنظیمات سیستم
					</h1>
					<p class="text-white/50 text-sm font-bold">
						مدیریت حالت تعمیرات و متغیرهای اقتصادی بازی
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

				<Show
					when={!loading() && settings()}
					fallback={
						<div class="flex justify-center py-20">
							<div class="w-8 h-8 border-4 border-[#3390ec]/30 border-t-[#3390ec] rounded-full animate-spin"></div>
						</div>
					}
				>
					<form onSubmit={handleSave} class="space-y-6">
						{/* Maintenance Mode */}
						<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
							<div class="flex justify-between items-center mb-4">
								<div>
									<h3 class="font-black text-lg text-white">حالت تعمیرات</h3>
									<p class="text-white/50 text-xs mt-1">
										در صورت فعال‌سازی، دسترسی کاربران عادی به بات موقتاً مسدود می‌شود.
									</p>
								</div>
								<label class="relative inline-flex items-center cursor-pointer">
									<input
										type="checkbox"
										class="sr-only peer"
										checked={settings()?.maintenance_mode}
										onChange={(e) =>
											setSettings((s) => ({ ...s!, maintenance_mode: e.target.checked }))
										}
									/>
									<div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
								</label>
							</div>
						</div>

						{/* Economy Multipliers */}
						<div class="bg-white/5 border border-white/5 rounded-3xl p-6">
							<h3 class="font-black text-lg text-white mb-6">اقتصاد و ضرایب</h3>
							
							<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<label class="block text-xs font-bold text-white/50 mb-2">
										ضریب Tap (Tap Multiplier)
									</label>
									<input
										type="number"
										step="0.1"
										min="0.1"
										value={settings()?.tap_multiplier}
										onInput={(e) =>
											setSettings((s) => ({ ...s!, tap_multiplier: parseFloat(e.target.value) || 1.0 }))
										}
										class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3390ec] transition-colors"
										dir="ltr"
									/>
									<p class="text-[10px] text-white/40 mt-1">
										مقدار پایه استخراج به ازای هر تپ در این عدد ضرب می‌شود.
									</p>
								</div>

								<div>
									<label class="block text-xs font-bold text-white/50 mb-2">
										پاداش دعوت (Referral Bonus)
									</label>
									<input
										type="number"
										value={settings()?.referral_bonus}
										onInput={(e) =>
											setSettings((s) => ({ ...s!, referral_bonus: parseInt(e.target.value) || 0 }))
										}
										class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3390ec] transition-colors"
										dir="ltr"
									/>
									<p class="text-[10px] text-white/40 mt-1">
										مقدار سکه‌ای که دعوت‌کننده دریافت می‌کند.
									</p>
								</div>

								<div>
									<label class="block text-xs font-bold text-white/50 mb-2">
										پایه پاداش روزانه (Daily Reward Base)
									</label>
									<input
										type="number"
										value={settings()?.daily_reward_base}
										onInput={(e) =>
											setSettings((s) => ({ ...s!, daily_reward_base: parseInt(e.target.value) || 0 }))
										}
										class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3390ec] transition-colors"
										dir="ltr"
									/>
									<p class="text-[10px] text-white/40 mt-1">
										میزان پایه برای سیستم پاداش روزانه متوالی.
									</p>
								</div>
							</div>
						</div>

						<div class="flex justify-end pt-4">
							<button
								type="submit"
								disabled={saving()}
								class="bg-[#3390ec] text-white px-8 py-3 rounded-xl font-black text-sm hover:bg-[#3390ec]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
							>
								{saving() ? (
									<>
										<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
										در حال ذخیره...
									</>
								) : (
									<>
										<span class="material-symbols-outlined text-[18px]">save</span>
										ذخیره تغییرات
									</>
								)}
							</button>
						</div>
					</form>
				</Show>
			</div>
		</div>
	);
};
