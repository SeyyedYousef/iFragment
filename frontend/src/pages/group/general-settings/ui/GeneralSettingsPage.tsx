import { useNavigate, useParams } from '@solidjs/router';
import { backButton, hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/shared/api/bot-management.js';
import { t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { SelectField, SettingsSection, ToggleSwitch } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';
import { UnsavedChangesSheet } from '@/shared/ui/UnsavedChangesSheet.js';

interface GeneralConfig {
	language: string;
	timezone: string;
	welcomeMessage: boolean;
	warningMessage: boolean;
	autoDeleteBot: boolean;
	autoDeleteDelay: number;
	trackAdmin: boolean;
	verifyMembers: boolean;
	publicCommands: boolean;
	hideJoinLeave: boolean;
	defaultPenalty: string;
	autoWarning: boolean;
	warningThreshold: number;
	warningRetention: number;
	warningFinalPenalty: string;
	casEnabled: boolean;
	antiRaidThreshold: number;
	antiRaidAction: string;
	botEnabled: boolean;
	ephemeralAll: boolean;
	ephemeralWelcome: boolean;
	ephemeralWarnings: boolean;
	ephemeralCaptcha: boolean;
	ephemeralAdminCmd: boolean;
}

const defaultConfig: GeneralConfig = {
	language: 'en',
	timezone: 'UTC',
	welcomeMessage: true,
	warningMessage: true,
	autoDeleteBot: true,
	autoDeleteDelay: 60,
	trackAdmin: false,
	verifyMembers: false,
	publicCommands: false,
	hideJoinLeave: false,
	defaultPenalty: 'delete',
	autoWarning: true,
	warningThreshold: 3,
	warningRetention: 7,
	warningFinalPenalty: 'mute_24h',
	casEnabled: false,
	antiRaidThreshold: 0,
	antiRaidAction: 'none',
	botEnabled: true,
	ephemeralAll: false,
	ephemeralWelcome: false,
	ephemeralWarnings: false,
	ephemeralCaptcha: false,
	ephemeralAdminCmd: false,
};

export const GeneralSettingsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [showUnsavedSheet, setShowUnsavedSheet] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);
	const [searchQuery, setSearchQuery] = createSignal('');
	const [activeTab, setActiveTab] = createSignal<'all' | 'general' | 'moderation' | 'antiraid'>(
		'all',
	);

	const [config, setConfig] = createStore<GeneralConfig>({ ...defaultConfig });

	createResource(
		() => params.id,
		async (groupId) => {
			const settings = await groupApi.getSettings(groupId);
			setSettingsVersion(settings.version);
			const general = (settings.general || {}) as Partial<GeneralConfig>;
			const merged = { ...defaultConfig, ...general };
			setConfig(reconcile(merged));
			return settings;
		},
	);

	const handleBack = () => {
		if (isDirty()) {
			setShowUnsavedSheet(true);
			return;
		}
		window.history.back();
	};

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(handleBack);
		onCleanup(() => off());
	});

	const updateField = <K extends keyof GeneralConfig>(key: K, value: GeneralConfig[K]) => {
		setConfig(key, value);
		setIsDirty(true);
	};

	const handleSave = async () => {
		if (!isDirty()) return;
		setIsSaving(true);
		try {
			const result = await groupApi.updateSettings(
				params.id,
				'general',
				config as any,
				settingsVersion(),
			);
			setSettingsVersion(result.version);
			setIsDirty(false);
			setShowUnsavedSheet(false);
			hapticFeedback.notificationOccurred('success');
			showToast(t('common.settingsSaved') || 'تنظیمات با موفقیت ذخیره شد', 'success');
			navigate(`/group/${params.id}`);
		} catch (_e: any) {
			hapticFeedback.notificationOccurred('error');
			showToast(t('common.errorUpdateFailed') || 'خطا در ذخیره‌سازی تنظیمات', 'error');
		} finally {
			setIsSaving(false);
		}
	};

	const handleDiscard = () => {
		setIsDirty(false);
		setShowUnsavedSheet(false);
		window.history.back();
	};

	return (
		<div class="theme-control min-h-screen bg-[#08090D] pb-28 relative overflow-x-hidden text-white select-none">
			{/* Top Bar Header */}
			<div class="px-5 pt-5 pb-4 bg-[#0F1117]/90 backdrop-blur-md sticky top-0 z-30 border-b border-white/10 flex items-center justify-between gap-3">
				<div class="flex items-center gap-3 overflow-hidden flex-1">
					<button
						onClick={() => {
							hapticFeedback.impactOccurred('light');
							handleBack();
						}}
						class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0"
						aria-label="بازگشت"
					>
						<span class="material-symbols-outlined text-white text-[20px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2">
							<h1 class="text-base font-black text-white leading-tight truncate">
								{t('generalSettings.title') || 'تنظیمات عمومی گروه'}
							</h1>
							<Show when={isDirty()}>
								<span
									class="w-2.5 h-2.5 rounded-full bg-[#f59e0b] animate-pulse shrink-0"
									title="تغییرات ذخیره‌نشده"
								/>
							</Show>
						</div>
						<span class="text-xs text-white/50 truncate font-bold">
							{t('generalSettings.description') || 'پیکربندی قابلیت‌ها و قوانین ربات'}
						</span>
					</div>
				</div>

				<button
					onClick={() => setIsMenuOpen(true)}
					class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0"
					aria-label="منوی مدیریتی"
				>
					<span class="material-symbols-outlined text-white text-[20px]">menu</span>
				</button>
			</div>

			<HamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				groupId={params.id}
				activeTab="general"
			/>

			<div class="px-5 pt-5 flex flex-col gap-5">
				{/* Search & Category Filter Tabs */}
				<div class="space-y-3">
					<div class="bg-black/40 border border-white/10 rounded-2xl px-4 h-12 flex items-center gap-2.5">
						<span class="material-symbols-outlined text-white/40 text-[20px]">search</span>
						<input
							type="text"
							placeholder="جستجو در تنظیمات..."
							value={searchQuery()}
							onInput={(e) => setSearchQuery(e.currentTarget.value)}
							class="w-full bg-transparent text-xs text-white placeholder-white/30 outline-none"
						/>
					</div>

					<div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
						<button
							onClick={() => setActiveTab('all')}
							class={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
								activeTab() === 'all'
									? 'bg-[#3390ec] text-white'
									: 'bg-white/5 text-white/60 hover:text-white'
							}`}
						>
							همه تنظیمات
						</button>
						<button
							onClick={() => setActiveTab('general')}
							class={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
								activeTab() === 'general'
									? 'bg-[#3390ec] text-white'
									: 'bg-white/5 text-white/60 hover:text-white'
							}`}
						>
							عمومی و پیام‌ها
						</button>
						<button
							onClick={() => setActiveTab('moderation')}
							class={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
								activeTab() === 'moderation'
									? 'bg-[#3390ec] text-white'
									: 'bg-white/5 text-white/60 hover:text-white'
							}`}
						>
							مدیریت و اخطارها
						</button>
						<button
							onClick={() => setActiveTab('antiraid')}
							class={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
								activeTab() === 'antiraid'
									? 'bg-[#3390ec] text-white'
									: 'bg-white/5 text-white/60 hover:text-white'
							}`}
						>
							ضد حمله و ربات
						</button>
					</div>
				</div>

				{/* Bot Language & Basic Options */}
				<Show when={activeTab() === 'all' || activeTab() === 'general'}>
					<div class="bg-[#151822] border border-white/10 rounded-[24px] p-5 space-y-4">
						<h3 class="text-xs font-black text-[#3390ec] uppercase tracking-wider">
							تنظیمات اصلی ربات
						</h3>

						<SelectField
							label="زبان پاسخ‌دهی ربات"
							value={config.language}
							onChange={(v) => updateField('language', v)}
							options={[
								{ value: 'fa', label: 'فارسی (Persian)' },
								{ value: 'en', label: 'English' },
								{ value: 'ru', label: 'Русский (Russian)' },
								{ value: 'ar', label: 'العربية (Arabic)' },
							]}
						/>

						<SettingsSection
							title={t('generalSettings.botEnabled') || 'فعال بودن ربات در گروه'}
							description="غیرفعال‌سازی موقت فعالیت‌های ربات بدون نیاز به حذف آن"
							enabled={config.botEnabled}
							onToggle={(v) => updateField('botEnabled', v)}
						/>

						<SelectField
							label={t('generalSettings.timeZone') || 'منطقه زمانی'}
							value={config.timezone}
							onChange={(v) => updateField('timezone', v)}
							options={[
								{ value: 'Asia/Tehran', label: 'تهران (GMT+3:30)' },
								{ value: 'UTC', label: 'UTC (GMT+0)' },
								{ value: 'Europe/Moscow', label: 'مسکو (GMT+3)' },
								{ value: 'Asia/Dubai', label: 'دبی (GMT+4)' },
							]}
						/>
					</div>
				</Show>

				{/* Ephemeral & Messages Section */}
				<Show when={activeTab() === 'all' || activeTab() === 'general'}>
					<div class="bg-[#151822] border border-white/10 rounded-[24px] p-5 space-y-4">
						<h3 class="text-xs font-black text-amber-400 uppercase tracking-wider">
							پیام‌ها و رفتار پاسخ‌دهی
						</h3>

						<SettingsSection
							title={t('generalSettings.welcomeMessage') || 'پیام خوش‌آمدگویی'}
							description="ارسال پیام خوش‌آمدگویی هنگام ورود اعضای جدید"
							enabled={config.welcomeMessage}
							onToggle={(v) => updateField('welcomeMessage', v)}
							hasEditText={true}
							onEditText={() => navigate(`/group/${params.id}/settings/custom-texts`)}
						/>

						<SettingsSection
							title={t('generalSettings.warningMessage') || 'پیام‌های اخطار'}
							description="نمایش پیام متنی هنگام صدور اخطار به کاربر"
							enabled={config.warningMessage}
							onToggle={(v) => updateField('warningMessage', v)}
							hasEditText={true}
							onEditText={() => navigate(`/group/${params.id}/settings/custom-texts`)}
						/>

						<div class="bg-black/40 rounded-2xl border border-white/5 p-4 space-y-3">
							<div class="flex items-center justify-between gap-3">
								<div>
									<span class="text-xs font-bold text-white block">حذف خودکار پیام‌های ربات</span>
									<span class="text-[11px] text-white/40 font-bold">
										حذف پاسخ‌های ربات پس از زمان مشخص
									</span>
								</div>
								<ToggleSwitch
									checked={config.autoDeleteBot}
									onChange={(v) => updateField('autoDeleteBot', v)}
								/>
							</div>

							<Show when={config.autoDeleteBot}>
								<div class="flex items-center gap-3 pt-2">
									<input
										type="number"
										min="5"
										value={config.autoDeleteDelay}
										onInput={(e) =>
											updateField('autoDeleteDelay', parseInt(e.currentTarget.value, 10) || 60)
										}
										class="bg-black/60 border border-white/10 text-white text-xs font-mono rounded-xl px-3 py-2 w-24 text-center outline-none"
									/>
									<span class="text-xs text-white/50 font-bold">ثانیه</span>
								</div>
							</Show>
						</div>
					</div>
				</Show>

				{/* Moderation & Penalties Section */}
				<Show when={activeTab() === 'all' || activeTab() === 'moderation'}>
					<div class="bg-[#151822] border border-white/10 rounded-[24px] p-5 space-y-4">
						<h3 class="text-xs font-black text-[#10b981] uppercase tracking-wider">
							محدودیت‌ها و جریمه‌ها
						</h3>

						<SelectField
							label={t('generalSettings.defaultPenalty') || 'جریمه پیش‌فرض تخلفات'}
							value={config.defaultPenalty}
							onChange={(v) => updateField('defaultPenalty', v)}
							options={[
								{ value: 'delete', label: 'حذف پیام' },
								{ value: 'mute_1h', label: 'سکوت ۱ ساعته' },
								{ value: 'mute_24h', label: 'سکوت ۲۴ ساعته' },
								{ value: 'kick', label: 'اخراج از گروه' },
								{ value: 'ban', label: 'مسدودسازی دائمی' },
							]}
						/>

						<SettingsSection
							title={t('generalSettings.autoWarning') || 'سیستم اخطار خودکار'}
							description="ثبت اخطار و اعمال جریمه در صورت رسیدن به حد مجاز"
							enabled={config.autoWarning}
							onToggle={(v) => updateField('autoWarning', v)}
						/>
					</div>
				</Show>

				{/* Anti-Raid & Security */}
				<Show when={activeTab() === 'all' || activeTab() === 'antiraid'}>
					<div class="bg-[#151822] border border-white/10 rounded-[24px] p-5 space-y-4">
						<h3 class="text-xs font-black text-[#ef4444] uppercase tracking-wider">
							امنیت و ضد حمله (Anti-Raid)
						</h3>

						<SettingsSection
							title={t('generalSettings.casProtection') || 'محافظت CAS (شبکه ضد اسپم)'}
							description="جلوگیری از ورود اکانت‌های شناخته‌شده اسپمر"
							enabled={config.casEnabled}
							onToggle={(v) => updateField('casEnabled', v)}
						/>

						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-[11px] font-bold text-white/50 mb-1">
									حد آستانه ورود (Joins/min)
								</label>
								<input
									type="number"
									value={config.antiRaidThreshold}
									onInput={(e) =>
										updateField('antiRaidThreshold', parseInt(e.currentTarget.value, 10) || 0)
									}
									class="w-full bg-black/40 border border-white/10 text-white text-xs font-mono rounded-xl p-3 outline-none"
								/>
							</div>
							<div>
								<label class="block text-[11px] font-bold text-white/50 mb-1">اقدام ضد حمله</label>
								<select
									value={config.antiRaidAction}
									onChange={(e) => updateField('antiRaidAction', e.currentTarget.value)}
									class="w-full bg-black/40 border border-white/10 text-white text-xs rounded-xl p-3 outline-none"
								>
									<option value="none">غیرفعال</option>
									<option value="lockdown">قفل اضطراری گروه</option>
									<option value="alert">هشدار به ادمین‌ها</option>
								</select>
							</div>
						</div>
					</div>
				</Show>
			</div>

			{/* Save Floating Action Bar */}
			<Show when={isDirty()}>
				<div class="fixed bottom-0 left-0 right-0 p-4 bg-[#08090D]/90 backdrop-blur-md border-t border-white/10 z-40 flex gap-3">
					<button
						onClick={handleBack}
						disabled={isSaving()}
						class="flex-1 h-12 bg-white/5 text-red-400 border border-red-500/20 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 min-h-[44px]"
					>
						انصراف
					</button>
					<button
						onClick={handleSave}
						disabled={isSaving()}
						class="flex-[2] h-12 bg-[#3390ec] hover:bg-[#2b7ec9] text-white rounded-xl font-black text-xs shadow-lg shadow-[#3390ec]/20 transition-all flex items-center justify-center gap-2 min-h-[44px]"
					>
						<Show
							when={!isSaving()}
							fallback={
								<span class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
							}
						>
							ذخیره تنظیمات
							<span class="material-symbols-outlined text-[18px]">save</span>
						</Show>
					</button>
				</div>
			</Show>

			<UnsavedChangesSheet
				isOpen={showUnsavedSheet()}
				onSave={handleSave}
				onDiscard={handleDiscard}
				onClose={() => setShowUnsavedSheet(false)}
				saving={isSaving()}
			/>
		</div>
	);
};
