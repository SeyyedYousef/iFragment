import { Motion } from '@motionone/solid';
import { type Component, createSignal, Show } from 'solid-js';
import { profileSettings, updateNotification, updateSetting } from '@/entities/user/index.js';
import { isRtl, locale, setLocale, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { requestWriteAccess } from '@/shared/lib/telegram-native.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { SettingsGuard, ToggleSwitch } from '@/shared/ui/index.js';

export const SettingsPage: Component = () => {
	useTelegramBackButton(-1);
	const [isDirty, setIsDirty] = createSignal(false);

	const handleToggleNotification = async (
		key: 'mining' | 'referral' | 'community' | 'promotions',
	) => {
		const currentVal = profileSettings().notifications[key];
		const targetVal = !currentVal;

		if (targetVal) {
			await requestWriteAccess();
		}

		updateNotification(key, targetVal);
		setIsDirty(true);
		try {
			haptic.impact('light');
		} catch {}
	};

	const handleToggleHaptic = (checked: boolean) => {
		updateSetting('hapticEnabled', checked);
		setIsDirty(true);
		if (checked) {
			try {
				haptic.impact('medium');
			} catch {}
		}
	};

	const handleToggleSound = (checked: boolean) => {
		updateSetting('soundEnabled', checked);
		setIsDirty(true);
		try {
			haptic.impact('light');
		} catch {}
	};

	const handleToggleAnimations = (checked: boolean) => {
		updateSetting('autoPlayAnimations', checked);
		setIsDirty(true);
		try {
			haptic.impact('light');
		} catch {}
	};

	const handleSave = () => {
		setIsDirty(false);
	};

	const handleDiscard = () => {
		setIsDirty(false);
	};

	return (
		<SettingsGuard isDirty={isDirty()} onSave={handleSave} onDiscard={handleDiscard}>
			{({ requestLeave }) => (
				<div
					class="min-h-screen bg-[#030303] pb-28 text-white font-sans flex flex-col relative overflow-x-hidden selection:bg-[#0098EA]/30"
					dir={isRtl() ? 'rtl' : 'ltr'}
				>
					{/* Ambient Top Glow */}
					<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#0098EA]/15 via-[#06b6d4]/5 to-transparent blur-[90px] pointer-events-none z-0" />

					{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
					<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center gap-3.5 shadow-sm shrink-0">
						<button
							type="button"
							onClick={() => requestLeave(() => window.history.back())}
							class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
							aria-label={t('common.back')}
						>
							<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
						</button>
						<div class="flex flex-col gap-0.5 min-w-0">
							<h1 class="text-[18px] font-black text-white leading-tight tracking-tight">
								{t('settings.title')}
							</h1>
							<span class="text-[11px] font-bold text-white/50 uppercase tracking-wider truncate">
								{t('settings.subtitle')}
							</span>
						</div>
					</div>

					<div class="flex-1 w-full max-w-md mx-auto relative z-10 flex flex-col px-5 pt-6 gap-6">
						{/* ═══════ PREFERENCES (Haptics, Sound, Animations) ═══════ */}
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.05 }}
							class="flex flex-col gap-3"
						>
							<h2 class="text-[11px] font-black text-white/40 uppercase tracking-widest px-2 flex items-center gap-2">
								<span class="material-symbols-outlined text-[16px] text-white/30">tune</span>
								{t('settings.general')}
							</h2>

							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
								<div class="absolute -right-6 -top-6 w-24 h-24 bg-[#0098EA]/10 blur-2xl rounded-full pointer-events-none" />

								{/* Haptic Feedback */}
								<div class="flex items-center justify-between gap-4 relative z-10">
									<div class="flex items-center gap-3.5">
										<div class="w-10 h-10 rounded-[12px] bg-white/5 flex items-center justify-center border border-white/10 shadow-inner shrink-0 text-white/70">
											<span class="material-symbols-outlined text-[20px]">vibration</span>
										</div>
										<div class="flex flex-col gap-0.5">
											<span class="text-[14px] font-black text-white tracking-tight">
												{t('settings.hapticFeedback')}
											</span>
											<span class="text-[11px] font-medium text-white/50 leading-relaxed">
												{t('settings.hapticDesc')}
											</span>
										</div>
									</div>
									<ToggleSwitch
										checked={profileSettings().hapticEnabled}
										onChange={handleToggleHaptic}
									/>
								</div>

								<div class="h-[1px] bg-white/5 w-full my-1 rounded-full relative z-10" />

								{/* Sound Effects */}
								<div class="flex items-center justify-between gap-4 relative z-10">
									<div class="flex items-center gap-3.5">
										<div class="w-10 h-10 rounded-[12px] bg-white/5 flex items-center justify-center border border-white/10 shadow-inner shrink-0 text-white/70">
											<span class="material-symbols-outlined text-[20px]">volume_up</span>
										</div>
										<div class="flex flex-col gap-0.5">
											<span class="text-[14px] font-black text-white tracking-tight">
												{t('settings.soundEffects')}
											</span>
											<span class="text-[11px] font-medium text-white/50 leading-relaxed">
												{t('settings.soundDesc')}
											</span>
										</div>
									</div>
									<ToggleSwitch
										checked={profileSettings().soundEnabled}
										onChange={handleToggleSound}
									/>
								</div>

								<div class="h-[1px] bg-white/5 w-full my-1 rounded-full relative z-10" />

								{/* Animations */}
								<div class="flex items-center justify-between gap-4 relative z-10">
									<div class="flex items-center gap-3.5">
										<div class="w-10 h-10 rounded-[12px] bg-white/5 flex items-center justify-center border border-white/10 shadow-inner shrink-0 text-white/70">
											<span class="material-symbols-outlined text-[20px]">animation</span>
										</div>
										<div class="flex flex-col gap-0.5">
											<span class="text-[14px] font-black text-white tracking-tight">
												{t('settings.animations')}
											</span>
											<span class="text-[11px] font-medium text-white/50 leading-relaxed">
												{t('settings.animationsDesc')}
											</span>
										</div>
									</div>
									<ToggleSwitch
										checked={profileSettings().autoPlayAnimations}
										onChange={handleToggleAnimations}
									/>
								</div>
							</div>
						</Motion.div>

						{/* ═══════ NOTIFICATIONS ═══════ */}
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1 }}
							class="flex flex-col gap-3"
						>
							<h2 class="text-[11px] font-black text-white/40 uppercase tracking-widest px-2 flex items-center gap-2">
								<span class="material-symbols-outlined text-[16px] text-white/30">
									notifications_active
								</span>
								{t('settings.notifications')}
							</h2>

							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
								<div class="absolute -left-6 -bottom-6 w-24 h-24 bg-[#06b6d4]/10 blur-2xl rounded-full pointer-events-none" />

								{/* Mining */}
								<div class="flex items-center justify-between gap-4 relative z-10">
									<div class="flex items-center gap-3.5">
										<div class="w-10 h-10 rounded-[12px] bg-amber-400/10 flex items-center justify-center border border-amber-400/20 shadow-inner shrink-0 text-amber-400">
											<span class="material-symbols-outlined text-[20px]">diamond</span>
										</div>
										<span class="text-[14px] font-black text-white tracking-tight">
											{t('settings.pushMining')}
										</span>
									</div>
									<ToggleSwitch
										checked={profileSettings().notifications.mining}
										onChange={() => handleToggleNotification('mining')}
									/>
								</div>

								<div class="h-[1px] bg-white/5 w-full my-1 rounded-full relative z-10" />

								{/* Referrals */}
								<div class="flex items-center justify-between gap-4 relative z-10">
									<div class="flex items-center gap-3.5">
										<div class="w-10 h-10 rounded-[12px] bg-[#10b981]/10 flex items-center justify-center border border-[#10b981]/20 shadow-inner shrink-0 text-[#10b981]">
											<span class="material-symbols-outlined text-[20px]">group_add</span>
										</div>
										<span class="text-[14px] font-black text-white tracking-tight">
											{t('settings.pushReferrals')}
										</span>
									</div>
									<ToggleSwitch
										checked={profileSettings().notifications.referral}
										onChange={() => handleToggleNotification('referral')}
									/>
								</div>

								<div class="h-[1px] bg-white/5 w-full my-1 rounded-full relative z-10" />

								{/* Community */}
								<div class="flex items-center justify-between gap-4 relative z-10">
									<div class="flex items-center gap-3.5">
										<div class="w-10 h-10 rounded-[12px] bg-[#0098EA]/10 flex items-center justify-center border border-[#0098EA]/20 shadow-inner shrink-0 text-[#0098EA]">
											<span class="material-symbols-outlined text-[20px]">forum</span>
										</div>
										<span class="text-[14px] font-black text-white tracking-tight">
											{t('settings.pushCommunity')}
										</span>
									</div>
									<ToggleSwitch
										checked={profileSettings().notifications.community}
										onChange={() => handleToggleNotification('community')}
									/>
								</div>

								<div class="h-[1px] bg-white/5 w-full my-1 rounded-full relative z-10" />

								{/* Promotions */}
								<div class="flex items-center justify-between gap-4 relative z-10">
									<div class="flex items-center gap-3.5">
										<div class="w-10 h-10 rounded-[12px] bg-[#ff4a4a]/10 flex items-center justify-center border border-[#ff4a4a]/20 shadow-inner shrink-0 text-[#ff4a4a]">
											<span class="material-symbols-outlined text-[20px]">campaign</span>
										</div>
										<span class="text-[14px] font-black text-white tracking-tight">
											{t('settings.pushPromotions')}
										</span>
									</div>
									<ToggleSwitch
										checked={profileSettings().notifications.promotions}
										onChange={() => handleToggleNotification('promotions')}
									/>
								</div>
							</div>
						</Motion.div>

						{/* ═══════ LANGUAGE SELECTION ═══════ */}
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.15 }}
							class="flex flex-col gap-3"
						>
							<h2 class="text-[11px] font-black text-white/40 uppercase tracking-widest px-2 flex items-center gap-2">
								<span class="material-symbols-outlined text-[16px] text-white/30">language</span>
								{t('profile.languageSettings')}
							</h2>

							<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-4 shadow-sm">
								<div class="grid grid-cols-2 gap-3">
									{/* English */}
									<button
										type="button"
										onClick={() => {
											setLocale('en');
											try {
												haptic.selection();
											} catch {}
										}}
										class={`p-4 rounded-[20px] flex flex-col items-center justify-center gap-2 border transition-all active:scale-95 shadow-sm group ${
											locale() === 'en'
												? 'bg-[#0098EA]/15 border-[#0098EA]/40 shadow-[0_0_15px_rgba(0,152,234,0.15)]'
												: 'bg-[#08090D] border-white/5 hover:border-white/20'
										}`}
									>
										<div class="relative">
											<span class="text-[28px] drop-shadow-md transition-transform group-hover:scale-110">
												🇬🇧
											</span>
											<Show when={locale() === 'en'}>
												<div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#0098EA] flex items-center justify-center shadow-md">
													<span class="material-symbols-outlined text-[10px] text-white font-black">
														done
													</span>
												</div>
											</Show>
										</div>
										<span
											class={`font-black tracking-wide ${locale() === 'en' ? 'text-[#0098EA] text-[13px]' : 'text-white/80 text-[12px]'}`}
										>
											{t('settingsPg.langEn' as any)}
										</span>
									</button>

									{/* Persian */}
									<button
										type="button"
										onClick={() => {
											setLocale('fa');
											try {
												haptic.selection();
											} catch {}
										}}
										class={`p-4 rounded-[20px] flex flex-col items-center justify-center gap-2 border transition-all active:scale-95 shadow-sm group ${
											locale() === 'fa'
												? 'bg-[#0098EA]/15 border-[#0098EA]/40 shadow-[0_0_15px_rgba(0,152,234,0.15)]'
												: 'bg-[#08090D] border-white/5 hover:border-white/20'
										}`}
									>
										<div class="relative">
											<span class="text-[28px] drop-shadow-md transition-transform group-hover:scale-110">
												🇮🇷
											</span>
											<Show when={locale() === 'fa'}>
												<div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#0098EA] flex items-center justify-center shadow-md">
													<span class="material-symbols-outlined text-[10px] font-black text-black">
														done
													</span>
												</div>
											</Show>
										</div>
										<span
											class={`font-black tracking-wide ${locale() === 'fa' ? 'text-[#0098EA] text-[13px]' : 'text-white/80 text-[12px]'}`}
										>
											{t('settingsPg.langFa' as any)}
										</span>
									</button>

									{/* Russian */}
									<button
										type="button"
										onClick={() => {
											setLocale('ru');
											try {
												haptic.selection();
											} catch {}
										}}
										class={`p-4 rounded-[20px] flex flex-col items-center justify-center gap-2 border transition-all active:scale-95 shadow-sm group ${
											locale() === 'ru'
												? 'bg-[#0098EA]/15 border-[#0098EA]/40 shadow-[0_0_15px_rgba(0,152,234,0.15)]'
												: 'bg-[#08090D] border-white/5 hover:border-white/20'
										}`}
									>
										<div class="relative">
											<span class="text-[28px] drop-shadow-md transition-transform group-hover:scale-110">
												🇷🇺
											</span>
											<Show when={locale() === 'ru'}>
												<div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#0098EA] flex items-center justify-center shadow-md">
													<span class="material-symbols-outlined text-[10px] text-white font-black">
														done
													</span>
												</div>
											</Show>
										</div>
										<span
											class={`font-black tracking-wide ${locale() === 'ru' ? 'text-[#0098EA] text-[13px]' : 'text-white/80 text-[12px]'}`}
										>
											{t('settingsPg.langRu' as any)}
										</span>
									</button>

									{/* Chinese */}
									<button
										type="button"
										onClick={() => {
											setLocale('zh');
											try {
												haptic.selection();
											} catch {}
										}}
										class={`p-4 rounded-[20px] flex flex-col items-center justify-center gap-2 border transition-all active:scale-95 shadow-sm group ${
											locale() === 'zh'
												? 'bg-[#0098EA]/15 border-[#0098EA]/40 shadow-[0_0_15px_rgba(0,152,234,0.15)]'
												: 'bg-[#08090D] border-white/5 hover:border-white/20'
										}`}
									>
										<div class="relative">
											<span class="text-[28px] drop-shadow-md transition-transform group-hover:scale-110">
												🇨🇳
											</span>
											<Show when={locale() === 'zh'}>
												<div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#0098EA] flex items-center justify-center shadow-md">
													<span class="material-symbols-outlined text-[10px] text-white font-black">
														done
													</span>
												</div>
											</Show>
										</div>
										<span
											class={`font-black tracking-wide ${locale() === 'zh' ? 'text-[#0098EA] text-[13px]' : 'text-white/80 text-[12px]'}`}
										>
											{t('settingsPg.langZh' as any)}
										</span>
									</button>
								</div>
							</div>
						</Motion.div>
					</div>
				</div>
			)}
		</SettingsGuard>
	);
};
