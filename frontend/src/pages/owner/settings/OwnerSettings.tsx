
import { Component, createSignal, onMount, Show } from 'solid-js';
import { ownerApi, type SystemSettings } from '@/entities/owner/index.js';
import { DangerActionDialog } from '@/widgets/owner/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export const OwnerSettings: Component = () => {
	const [initialSettings, setInitialSettings] = createSignal<SystemSettings | null>(null);
	const [settings, setSettings] = createSignal<SystemSettings | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [saving, setSaving] = createSignal(false);
	const [error, setError] = createSignal('');
	const [successMsg, setSuccessMsg] = createSignal('');
	const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);

	const fetchSettings = async () => {
		setLoading(true);
		setError('');
		try {
			const data = await ownerApi.getSettings();
			setInitialSettings(JSON.parse(JSON.stringify(data)));
			setSettings(data);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در دریافت تنظیمات سیستم');
		} finally {
			setLoading(false);
		}
	};

	onMount(() => {
		fetchSettings();
	});

	const isDirty = () => {
		if (!initialSettings() || !settings()) return false;
		return JSON.stringify(initialSettings()) !== JSON.stringify(settings());
	};

	const handleSaveInitiate = (e: Event) => {
		e.preventDefault();
		if (!settings() || !isDirty()) return;

		// If maintenance mode status changed or big multiplier jump, require confirmation
		const initM = initialSettings()?.maintenance_mode;
		const currM = settings()?.maintenance_mode;

		if (initM !== currM) {
			setShowConfirmDialog(true);
		} else {
			executeSave('تغییر پارامترهای اقتصادی بدون قطع دسترسی');
		}
	};

	const executeSave = async (_reason: string) => {
		const s = settings();
		if (!s) return;

		setSaving(true);
		setError('');
		setSuccessMsg('');

		try {
			const payload: SystemSettings = {
				...s,
				// P0-3 FIX: Explicitly preserve dashboard_ads so saving system settings never wipes ads!
				dashboard_ads: initialSettings()?.dashboard_ads || s.dashboard_ads || [],
			};

			const updated = await ownerApi.updateSettings(payload);
			setInitialSettings(JSON.parse(JSON.stringify(updated)));
			setSettings(updated);
			setSuccessMsg('تنظیمات با موفقیت ذخیره و در سراسر سرور اعمال شد.');
			setShowConfirmDialog(false);

			try {
				haptic.notify('success');
			} catch {}

			setTimeout(() => setSuccessMsg(''), 4000);
		} catch (e: any) {
			setError(e.response?.data?.error || 'خطا در ذخیره‌سازی تنظیمات');
			try {
				haptic.notify('error');
			} catch {}
		} finally {
			setSaving(false);
		}
	};

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="bg-[#16171d]/60 border border-white/5 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
				<div>
					<h2 class="text-sm font-black text-white">تنظیمات اصلی و اقتصاد سیستم</h2>
					<p class="text-xs text-white/40 font-bold mt-0.5">
						مدیریت حالت تعمیرات و ضرایب پایه کلیک و پاداش‌ها
					</p>
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

			<Show
				when={!loading() && settings()}
				fallback={
					<div class="flex flex-col items-center justify-center py-20 gap-3">
						<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
						<span class="text-xs text-white/50 font-bold">در حال دریافت متغیرهای سیستم...</span>
					</div>
				}
			>
				<form onSubmit={handleSaveInitiate} class="space-y-6">
					{/* Maintenance Mode Control */}
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6">
						<div class="flex justify-between items-start md:items-center">
							<div>
								<div class="flex items-center gap-2">
									<h3 class="font-black text-sm text-white">
										حالت تعمیرات و نگهداری (Maintenance Mode)
									</h3>
									<Show when={settings()?.maintenance_mode}>
										<span class="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-black">
											فعال (مسدود عمومی)
										</span>
									</Show>
								</div>
								<p class="text-xs text-white/50 font-medium mt-1 leading-relaxed">
									در صورت فعال‌سازی، تمامی کاربران عادی با صفحه «در حال بروزرسانی» مواجه خواهند شد و
									صرفاً ادمین‌ها دسترسی دارند.
								</p>
							</div>

							<label class="relative inline-flex items-center cursor-pointer shrink-0 mt-2 md:mt-0">
								<input
									type="checkbox"
									class="sr-only peer"
									checked={settings()?.maintenance_mode || false}
									onChange={(e) =>
										setSettings((s) => ({ ...s!, maintenance_mode: e.target.checked }))
									}
								/>
								<div class="w-12 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500" />
							</label>
						</div>
					</div>

					{/* Game Economy Variables */}
					<div class="bg-gradient-to-b from-[#16171d] to-[#0f1014] border border-[#2a2c35]/40 rounded-3xl p-6 space-y-6">
						<h3 class="font-black text-sm text-white border-b border-white/5 pb-3">
							اقتصاد و ضرایب پاداش
						</h3>

						<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div>
								<label class="block text-xs font-bold text-white/60 mb-2">
									ضریب تپ (Tap Multiplier)
								</label>
								<input
									type="number"
									step="0.1"
									min="0.1"
									max="100"
									value={settings()?.tap_multiplier || 1.0}
									onInput={(e) =>
										setSettings((s) => ({
											...s!,
											tap_multiplier: parseFloat(e.target.value) || 1.0,
										}))
									}
									class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-[#3390ec] outline-none"
									dir="ltr"
								/>
								<p class="text-[10px] text-white/40 font-bold mt-1.5">
									ضریب ضرب‌کننده به ازای هر تپ در استخراج
								</p>
							</div>

							<div>
								<label class="block text-xs font-bold text-white/60 mb-2">
									پاداش دعوت دوستان (Referral Bonus)
								</label>
								<input
									type="number"
									min="0"
									value={settings()?.referral_bonus || 0}
									onInput={(e) =>
										setSettings((s) => ({
											...s!,
											referral_bonus: parseInt(e.target.value, 10) || 0,
										}))
									}
									class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-[#3390ec] outline-none"
									dir="ltr"
								/>
								<p class="text-[10px] text-white/40 font-bold mt-1.5">
									مقدار پاداش اولیه جهت ورود هر زیرمجموعه
								</p>
							</div>

							<div>
								<label class="block text-xs font-bold text-white/60 mb-2">
									پایه پاداش روزانه (Daily Base)
								</label>
								<input
									type="number"
									min="0"
									value={settings()?.daily_reward_base || 0}
									onInput={(e) =>
										setSettings((s) => ({
											...s!,
											daily_reward_base: parseInt(e.target.value, 10) || 0,
										}))
									}
									class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:border-[#3390ec] outline-none"
									dir="ltr"
								/>
								<p class="text-[10px] text-white/40 font-bold mt-1.5">
									مقدار پاداش ورود روزانه متوالی
								</p>
							</div>
						</div>
					</div>

					{/* Save Actions Bar */}
					<div class="flex justify-end">
						<button
							type="submit"
							disabled={saving() || !isDirty()}
							class="h-12 px-8 bg-[#3390ec] hover:bg-[#2b7ec9] text-white text-xs font-black uppercase rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95 shadow-lg shadow-[#3390ec]/20"
						>
							<Show
								when={saving()}
								fallback={
									<>
										<span class="material-symbols-outlined text-[18px]">save</span>
										ذخیره تغییرات تنظیمات
									</>
								}
							>
								<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
								در حال ذخیره‌سازی...
							</Show>
						</button>
					</div>
				</form>
			</Show>

			{/* Review Modal for Maintenance Mode state changes */}
			<Show when={showConfirmDialog()}>
				<DangerActionDialog
					isOpen={true}
					title="تغییر وضعیت حالت تعمیرات (Maintenance Mode)"
					description="با فعال یا غیرفعال‌سازی حالت تعمیرات، دسترسی تمامی کاربران عادی قطع یا وصل خواهد شد."
					actionLabel="اعمال تغییرات حالت تعمیرات"
					confirmWord="MAINTENANCE"
					riskLevel="critical"
					details={[
						{
							label: 'حالت تعمیرات',
							before: initialSettings()?.maintenance_mode ? 'فعال' : 'غیرفعال',
							after: settings()?.maintenance_mode ? 'فعال' : 'غیرفعال',
						},
					]}
					onConfirm={executeSave}
					onClose={() => setShowConfirmDialog(false)}
				/>
			</Show>
		</div>
	);
};
