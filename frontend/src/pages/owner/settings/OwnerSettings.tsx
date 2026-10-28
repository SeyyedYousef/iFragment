import { A } from '@solidjs/router';
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type Component, createEffect, createSignal, Show } from 'solid-js';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { SystemSettings } from '@/entities/owner/model/types.js';
import { locale } from '@/shared/i18n/index.js';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.jsx';

export const OwnerSettings: Component = () => {
	const queryClient = useQueryClient();
	const isFa = () => locale() === 'fa';

	const [settings, setSettings] = createSignal<SystemSettings | null>(null);
	const [statusMsg, setStatusMsg] = createSignal<{
		type: 'success' | 'error';
		text: string;
	} | null>(null);
	const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = createSignal(false);
	const [pendingMaintenanceState, setPendingMaintenanceState] = createSignal(false);

	const settingsQuery = createQuery(() => ({
		queryKey: ['owner', 'settings'],
		queryFn: ownerApi.getSettings,
	}));

	createEffect(() => {
		if (settingsQuery.data) {
			setSettings({ ...settingsQuery.data });
		}
	});

	const updateMutation = createMutation(() => ({
		mutationFn: (newSettings: SystemSettings) => ownerApi.updateSettings(newSettings),
		onSuccess: (saved) => {
			setSettings({ ...saved });
			queryClient.invalidateQueries({ queryKey: ['owner', 'settings'] });
			queryClient.invalidateQueries({ queryKey: ['owner', 'dashboard'] });
			setStatusMsg({
				type: 'success',
				text: isFa()
					? 'تنظیمات تعرفه کریدیت و کالیبراسیون موتورهای ارزش‌گذاری با موفقیت ذخیره شد.'
					: 'Credit pricing & Valuation Engine calibration saved successfully.',
			});
			setTimeout(() => setStatusMsg(null), 3500);
		},
		onError: (err: any) => {
			setStatusMsg({
				type: 'error',
				text: err.response?.data?.error || err.message || 'Failed to update settings.',
			});
		},
	}));

	const handleMaintenanceToggle = (checked: boolean) => {
		setPendingMaintenanceState(checked);
		setIsMaintenanceDialogOpen(true);
	};

	const handleConfirmMaintenance = () => {
		if (settings()) {
			const updated = { ...settings()!, maintenance_mode: pendingMaintenanceState() };
			setSettings(updated);
			updateMutation.mutate(updated);
		}
		setIsMaintenanceDialogOpen(false);
	};

	const handleSaveForm = (e: Event) => {
		e.preventDefault();
		if (settings()) {
			updateMutation.mutate(settings()!);
		}
	};

	const updateField = <K extends keyof SystemSettings>(field: K, val: SystemSettings[K]) => {
		if (settings()) {
			setSettings({ ...settings()!, [field]: val });
		}
	};

	const currentSettings = () => settings();

	return (
		<div class="space-y-6">
			{/* Header */}
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div>
					<h2 class="text-lg font-black text-white">
						{isFa()
							? 'تنظیمات تعرفه کریدیت ⚡ و کالیبراسیون موتورهای ارزش‌گذاری'
							: 'Intel Credit Pricing & Valuation Engine Calibration'}
					</h2>
					<p class="text-xs text-white/50">
						{isFa()
							? `کنترل زنده هزینه استعلام‌ها، سهمیه رایگان و ضرایب الگوریتم‌های نام کاربری، +888 و گیفت (نسخه پیکربندی: v${currentSettings()?.version ?? 1})`
							: `Live control of report credit costs, referral rewards, and valuation calibration (Config v${currentSettings()?.version ?? 1})`}
					</p>
				</div>
			</div>

			<Show when={statusMsg()}>
				<div
					class={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
						statusMsg()?.type === 'success'
							? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
							: 'bg-rose-500/10 border-rose-500/25 text-rose-400'
					}`}
				>
					<span class="material-symbols-outlined text-base">
						{statusMsg()?.type === 'success' ? 'check_circle' : 'error'}
					</span>
					<span>{statusMsg()?.text}</span>
				</div>
			</Show>

			<Show
				when={!settingsQuery.isLoading && currentSettings()}
				fallback={
					<div class="p-8 text-center text-xs text-white/40">
						{isFa() ? 'در حال بارگذاری پیکربندی سرور...' : 'Loading engine configuration...'}
					</div>
				}
			>
				<form onSubmit={handleSaveForm} class="space-y-6">
					{/* Maintenance Mode Banner */}
					<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-5 flex items-center justify-between gap-4">
						<div>
							<div class="text-sm font-bold text-white flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400">construction</span>
								<span>
									{isFa()
										? 'حالت تعمیرات و بروزرسانی سراسری (Maintenance Mode)'
										: 'Platform Maintenance Mode'}
								</span>
							</div>
							<div class="text-xs text-white/50 mt-0.5">
								{isFa()
									? 'نمایش صفحه بروزرسانی برای کاربران عادی؛ دسترسی پنل مالک و تست ادمین فعال باقی می‌ماند'
									: 'Block regular users with a maintenance screen while keeping Owner access active'}
							</div>
						</div>
						<label class="relative inline-flex items-center cursor-pointer shrink-0">
							<input
								type="checkbox"
								checked={currentSettings()?.maintenance_mode ?? false}
								onChange={(e) => handleMaintenanceToggle(e.currentTarget.checked)}
								class="sr-only peer"
							/>
							<div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
						</label>
					</div>

					{/* Section 1: Intel Credit Paywall & Report Costs */}
					<section class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
						<header class="border-b border-white/10 pb-3">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-cyan-400">bolt</span>
								<h3 class="text-sm font-bold text-white">
									{isFa()
										? 'تعرفه کریدیت گزارش‌ها و پاداش‌های معرفی (Intel Credit Economy ⚡)'
										: 'Intel Credit Report Costs & Referral Rewards (⚡)'}
								</h3>
							</div>
							<p class="text-xs text-white/50 mt-1">
								{isFa()
									? 'تعیین دقیق تعداد کریدیت لازم برای باز کردن هر گزارش تخصصی و پاداش ثبت‌نام/معرفی کاربران'
									: 'Set exact Intel Credit (⚡) costs per valuation report and user acquisition bonuses'}
							</p>
						</header>

						<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							<div class="space-y-1.5">
								<label class="text-xs text-sky-300 font-bold block">
									{isFa() ? 'هزینه گزارش نام کاربری (@)' : '@Username Report Cost (⚡)'}
								</label>
								<input
									type="number"
									min={0}
									max={50}
									value={currentSettings()?.cost_username_report ?? 1}
									onInput={(e) =>
										updateField('cost_username_report', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-amber-300 font-bold block">
									{isFa() ? 'هزینه گزارش شماره کلکسیونی (+888)' : '+888 Number Report Cost (⚡)'}
								</label>
								<input
									type="number"
									min={0}
									max={50}
									value={currentSettings()?.cost_number_report ?? 1}
									onInput={(e) =>
										updateField('cost_number_report', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-purple-300 font-bold block">
									{isFa() ? 'هزینه گزارش گیفت تلگرام (🎁)' : 'Telegram Gift Report Cost (⚡)'}
								</label>
								<input
									type="number"
									min={0}
									max={50}
									value={currentSettings()?.cost_gift_report ?? 1}
									onInput={(e) =>
										updateField('cost_gift_report', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-emerald-300 font-bold block">
									{isFa() ? 'هزینه اسکن پرتفوی نهنگ (X-Ray)' : 'Portfolio X-Ray Scan Cost (⚡)'}
								</label>
								<input
									type="number"
									min={0}
									max={50}
									value={currentSettings()?.cost_portfolio_scan ?? 2}
									onInput={(e) =>
										updateField('cost_portfolio_scan', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{isFa() ? 'سهمیه رایگان روزانه هر کاربر' : 'Free Daily Quota per User'}
								</label>
								<input
									type="number"
									min={0}
									max={20}
									value={currentSettings()?.free_daily_quota ?? 1}
									onInput={(e) =>
										updateField('free_daily_quota', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{isFa() ? 'کریدیت هدیه ورود اولیه (Signup ⚡)' : 'Initial Signup Bonus (⚡)'}
								</label>
								<input
									type="number"
									min={0}
									max={100}
									value={currentSettings()?.signup_bonus_credits ?? 3}
									onInput={(e) =>
										updateField('signup_bonus_credits', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{isFa() ? 'پاداش معرفی هر دوست (Referral ⚡)' : 'Referral Bonus (⚡ Credits)'}
								</label>
								<input
									type="number"
									min={0}
									max={100}
									value={currentSettings()?.referral_bonus_credits ?? 2}
									onInput={(e) =>
										updateField('referral_bonus_credits', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{isFa() ? 'پورسانت معرف از خرید Stars (%)' : 'Referral Stars Rev-Share (%)'}
								</label>
								<input
									type="number"
									step="0.5"
									min={0}
									max={50}
									value={currentSettings()?.referral_rev_share_pct ?? 15}
									onInput={(e) =>
										updateField('referral_rev_share_pct', parseFloat(e.currentTarget.value) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
								/>
							</div>
						</div>
					</section>

					{/* Section 2: Valuation Engine Calibration & Market Oracles */}
					<section class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
						<header class="border-b border-white/10 pb-3">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400">tune</span>
								<h3 class="text-sm font-bold text-white">
									{isFa()
										? 'کالیبراسیون الگوریتم‌های ارزش‌گذاری و اوراکل‌های بازار'
										: 'Valuation Engine Calibration & Live Oracle Rules'}
								</h3>
							</div>
							<p class="text-xs text-white/50 mt-1">
								{isFa()
									? 'تنظیم ضریب پایبندی به قیمت کف (Floor Anchor) در گیفت‌ها، فیلتر قیمت‌های کاذب نهنگ‌ها (Vanity Ask Guard) و نرخ TON/USD'
									: 'Configure 4-Floor strictness for Telegram Gifts, Whale Vanity Ask threshold, and TON/USD oracle override'}
							</p>
						</header>

						<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{isFa()
										? 'نرخ دستی TON/USD (عدد 0 = دریافت خودکار از اوراکل زنده)'
										: 'Manual TON/USD Override (0 = Auto Live Oracle)'}
								</label>
								<input
									type="number"
									step="0.01"
									min={0}
									value={currentSettings()?.ton_usd_override ?? 0}
									onInput={(e) =>
										updateField('ton_usd_override', parseFloat(e.currentTarget.value) || 0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{isFa()
										? 'ضریب لنگر قیمت کف در گیفت‌ها (1.0 = استاندارد بازار فعلی)'
										: 'Gift 4-Floor Anchor Strictness (1.0 = Market Standard)'}
								</label>
								<input
									type="number"
									step="0.05"
									min={0.5}
									max={2.0}
									value={currentSettings()?.gift_floor_strictness ?? 1.0}
									onInput={(e) =>
										updateField('gift_floor_strictness', parseFloat(e.currentTarget.value) || 1.0)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
								/>
							</div>

							<div class="space-y-1.5">
								<label class="text-xs text-white/70 font-medium block">
									{isFa()
										? 'آستانه هشدار قیمت نمایشی نهنگ (چند برابر ارزش منصفانه؟)'
										: 'Whale Vanity Ask Guard Multiplier (× Fair Value)'}
								</label>
								<input
									type="number"
									step="0.5"
									min={2.0}
									max={20.0}
									value={currentSettings()?.vanity_ask_multiplier_threshold ?? 3.5}
									onInput={(e) =>
										updateField(
											'vanity_ask_multiplier_threshold',
											parseFloat(e.currentTarget.value) || 3.5,
										)
									}
									class="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
								/>
							</div>
						</div>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
							<label class="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between cursor-pointer">
								<div>
									<div class="text-xs font-bold text-white">
										{isFa()
											? 'تایید زنده وضعیت حراجی و محدودیت اسپم از Fragment.com'
											: 'Live Fragment.com Auction & Restriction Verification'}
									</div>
									<div class="text-[11px] text-white/45 mt-0.5">
										{isFa()
											? 'بررسی لحظه‌ای پرچم tm-restricted-nft برای شماره‌های +888 و نام‌های کاربری'
											: 'Real-time scraping of tm-restricted-nft and live auction bids'}
									</div>
								</div>
								<input
									type="checkbox"
									checked={currentSettings()?.enable_live_fragment_Verify ?? true}
									onChange={(e) =>
										updateField('enable_live_fragment_Verify', e.currentTarget.checked)
									}
									class="h-4 w-4 rounded accent-cyan-500"
								/>
							</label>

							<label class="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between cursor-pointer">
								<div>
									<div class="text-xs font-bold text-white">
										{isFa()
											? 'کالبدشکافی باینری TVM BOC و تاریخچه آن‌چین از TonAPI.io'
											: 'Live TonAPI.io TVM BOC Binary Forensics'}
									</div>
									<div class="text-[11px] text-white/45 mt-0.5">
										{isFa()
											? 'استخراج مستقیم هش کد، تاریخچه انتقال و موجودی نهنگ مالک از بلاک‌چین TON'
											: 'Real-time on-chain NFT provenance and owner whale portfolio inspection'}
									</div>
								</div>
								<input
									type="checkbox"
									checked={currentSettings()?.enable_live_tonapi_boc ?? true}
									onChange={(e) => updateField('enable_live_tonapi_boc', e.currentTarget.checked)}
									class="h-4 w-4 rounded accent-cyan-500"
								/>
							</label>
						</div>
					</section>

					{/* Quick Link to Banners & Investors Media Manager */}
					<div class="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
						<div class="flex items-center gap-3">
							<span class="material-symbols-outlined text-amber-400">ads_click</span>
							<div class="text-xs">
								<div class="font-bold text-white">
									{isFa()
										? 'مدیریت بنرهای تبلیغاتی و پوستر تمام‌صفحه سرمایه‌گذاران'
										: 'Manage Promotional Banners & Full-Screen Investors Poster'}
								</div>
								<div class="text-white/50">
									{isFa()
										? 'تمامی تنظیمات بنرها و تصویر ۹:۱۶ سرمایه‌گذاران در تب «بنرها و سرمایه‌گذاران» یکپارچه شده است.'
										: 'All ad slots and the 9:16 Investors poster are unified in the Banners & Media tab.'}
								</div>
							</div>
						</div>
						<A
							href="/owner/ads"
							class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-amber-300 shrink-0 transition"
						>
							{isFa() ? 'مدیریت بنرها ↗' : 'Open Banners ↗'}
						</A>
					</div>

					{/* Save Button */}
					<div class="flex justify-end pt-2">
						<button
							type="submit"
							disabled={updateMutation.isPending}
							class="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
						>
							{updateMutation.isPending
								? isFa()
									? 'در حال ذخیره پیکربندی...'
									: 'Saving Configuration...'
								: isFa()
									? 'ذخیره تنظیمات تعرفه و موتور ارزش‌گذاری'
									: 'Save Pricing & Engine Calibration'}
						</button>
					</div>
				</form>
			</Show>

			{/* Maintenance Confirmation Dialog */}
			<Show when={isMaintenanceDialogOpen()}>
				<DangerActionDialog
					isOpen={true}
					title={pendingMaintenanceState() ? 'Enable Maintenance Mode' : 'Disable Maintenance Mode'}
					description={
						pendingMaintenanceState()
							? 'Are you sure you want to put the entire platform into Maintenance Mode? Regular users will see a maintenance notice.'
							: 'Re-enable public platform access for all Telegram users?'
					}
					actionLabel={pendingMaintenanceState() ? 'Enable Maintenance' : 'Disable Maintenance'}
					confirmWord={pendingMaintenanceState() ? 'MAINTENANCE' : undefined}
					riskLevel={pendingMaintenanceState() ? 'critical' : 'medium'}
					requireReason={false}
					loading={updateMutation.isPending}
					onConfirm={handleConfirmMaintenance}
					onClose={() => setIsMaintenanceDialogOpen(false)}
				/>
			</Show>
		</div>
	);
};
