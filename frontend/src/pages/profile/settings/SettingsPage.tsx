import { Motion } from '@motionone/solid';
import { type Component, createEffect, onCleanup, onMount, Show } from 'solid-js';
import {
	commitDraftSettings,
	discardDraftSettings,
	draftProfileSettings,
	initDraftSettings,
	isSettingsDirty,
	updateDraftSetting,
} from '@/entities/user/index.js';
import { isRtl, locale, setLocale, t } from '@/shared/i18n/index.js';
import { audio } from '@/shared/lib/audio.js';
import { haptic } from '@/shared/lib/haptic.js';
import {
	disableClosingConfirmation,
	enableClosingConfirmation,
} from '@/shared/lib/telegram-native.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { SettingsGuard, ToggleSwitch } from '@/shared/ui/index.js';

export const SettingsPage: Component = () => {
	useTelegramBackButton(-1);

	onMount(() => {
		initDraftSettings();
	});

	onCleanup(() => {
		try {
			disableClosingConfirmation();
		} catch {}
	});

	// Sync Telegram closing confirmation with dirty state
	createEffect(() => {
		if (isSettingsDirty()) {
			enableClosingConfirmation();
		} else {
			disableClosingConfirmation();
		}
	});

	const handleToggleHaptic = (checked: boolean) => {
		updateDraftSetting('hapticEnabled', checked);
		if (checked) {
			try {
				haptic.impact('medium');
			} catch {}
		}
		audio.playToggle(checked);
	};

	const handleToggleSound = (checked: boolean) => {
		updateDraftSetting('soundEnabled', checked);
		try {
			haptic.impact('light');
		} catch {}
		audio.playToggle(checked);
	};

	const handleToggleAnimations = (checked: boolean) => {
		updateDraftSetting('autoPlayAnimations', checked);
		try {
			haptic.impact('light');
		} catch {}
		audio.playToggle(checked);
	};

	const handleSave = () => {
		commitDraftSettings();
		disableClosingConfirmation();
		try {
			haptic.notify('success');
		} catch {}
		audio.playSuccess();
	};

	const handleDiscard = () => {
		discardDraftSettings();
		disableClosingConfirmation();
		try {
			haptic.impact('light');
		} catch {}
		audio.playClick();
	};

	return (
		<SettingsGuard isDirty={isSettingsDirty()} onSave={handleSave} onDiscard={handleDiscard}>
			{({ requestLeave }) => (
				<div
					class="frag-canvas min-h-screen pb-32 text-[#f3f5f8] font-sans flex flex-col relative overflow-x-clip selection:bg-[#2990ff]/30"
					dir={isRtl() ? 'rtl' : 'ltr'}
				>
					{/* Sticky Header */}
					<div class="pt-5 pb-4 px-5 sticky top-0 bg-[#11161d]/92 backdrop-blur-2xl z-40 border-b border-white/[0.06] flex items-center gap-3.5 shrink-0">
						<button
							type="button"
							onClick={() => requestLeave(() => window.history.back())}
							class="w-10 h-10 rounded-xl bg-[#1b232d] flex items-center justify-center border border-white/[0.08] hover:border-white/15 active:scale-95 transition-all shrink-0 text-[#c2cfde]"
							aria-label={t('common.back')}
						>
							<span class="material-symbols-outlined text-[21px] rtl:-scale-x-100">arrow_back</span>
						</button>
						<div class="flex flex-col gap-0.5 min-w-0">
							<h1 class="text-[18px] font-bold text-white leading-tight tracking-tight">
								{t('settings.title')}
							</h1>
							<span class="text-[11px] font-medium text-[#8ca0b5] truncate">
								{t('settings.subtitle')}
							</span>
						</div>
					</div>

					<div class="flex-1 w-full max-w-md mx-auto relative z-10 flex flex-col px-4 pt-5 gap-6">
						{/* Preferences */}
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.05 }}
							class="flex flex-col gap-2.5"
						>
							<h2 class="text-xs font-semibold text-[#8ca0b5] px-1.5 flex items-center gap-2">
								<span class="material-symbols-outlined text-[16px] text-[#738598]">tune</span>
								{t('settings.general')}
							</h2>

							<div class="frag-card-elevated rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
								{/* Haptic Feedback */}
								<div class="flex items-center justify-between gap-4">
									<div class="flex items-center gap-3.5">
										<div class="w-10 h-10 rounded-xl bg-[#141a22] flex items-center justify-center border border-white/[0.08] shrink-0 text-[#c2cfde]">
											<span class="material-symbols-outlined text-[20px]">vibration</span>
										</div>
										<div class="flex flex-col gap-0.5">
											<span class="text-[14px] font-semibold text-white tracking-tight">
												{t('settings.hapticFeedback')}
											</span>
											<span class="text-[11px] font-medium text-[#8ca0b5] leading-relaxed">
												{t('settings.hapticDesc')}
											</span>
										</div>
									</div>
									<ToggleSwitch
										checked={draftProfileSettings().hapticEnabled}
										onChange={handleToggleHaptic}
									/>
								</div>

								<div class="h-[1px] bg-white/[0.06] w-full" />

								{/* Sound Effects */}
								<div class="flex items-center justify-between gap-4">
									<div class="flex items-center gap-3.5">
										<div class="w-10 h-10 rounded-xl bg-[#141a22] flex items-center justify-center border border-white/[0.08] shrink-0 text-[#c2cfde]">
											<span class="material-symbols-outlined text-[20px]">volume_up</span>
										</div>
										<div class="flex flex-col gap-0.5">
											<span class="text-[14px] font-semibold text-white tracking-tight">
												{t('settings.soundEffects')}
											</span>
											<span class="text-[11px] font-medium text-[#8ca0b5] leading-relaxed">
												{t('settings.soundDesc')}
											</span>
										</div>
									</div>
									<ToggleSwitch
										checked={draftProfileSettings().soundEnabled}
										onChange={handleToggleSound}
									/>
								</div>

								<div class="h-[1px] bg-white/[0.06] w-full" />

								{/* Animations */}
								<div class="flex items-center justify-between gap-4">
									<div class="flex items-center gap-3.5">
										<div class="w-10 h-10 rounded-xl bg-[#141a22] flex items-center justify-center border border-white/[0.08] shrink-0 text-[#c2cfde]">
											<span class="material-symbols-outlined text-[20px]">animation</span>
										</div>
										<div class="flex flex-col gap-0.5">
											<span class="text-[14px] font-semibold text-white tracking-tight">
												{t('settings.animations')}
											</span>
											<span class="text-[11px] font-medium text-[#8ca0b5] leading-relaxed">
												{t('settings.animationsDesc')}
											</span>
										</div>
									</div>
									<ToggleSwitch
										checked={draftProfileSettings().autoPlayAnimations}
										onChange={handleToggleAnimations}
									/>
								</div>
							</div>
						</Motion.div>

						{/* Language Selection */}
						<Motion.div
							initial={{ opacity: 0, y: 15 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.15 }}
							class="flex flex-col gap-2.5"
						>
							<h2 class="text-xs font-semibold text-[#8ca0b5] px-1.5 flex items-center gap-2">
								<span class="material-symbols-outlined text-[16px] text-[#738598]">language</span>
								{t('profile.languageSettings')}
							</h2>

							<div class="frag-card-elevated rounded-2xl p-4">
								<div class="grid grid-cols-2 gap-2.5">
									{/* English */}
									<button
										type="button"
										onClick={() => {
											setLocale('en');
											try {
												haptic.selection();
											} catch {}
										}}
										class={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 border transition-all active:scale-95 group ${
											locale() === 'en'
												? 'bg-[#2990ff]/12 border-[#2990ff]/40'
												: 'frag-inset hover:border-white/[0.15]'
										}`}
									>
										<div class="relative">
											<span class="text-[26px] transition-transform group-hover:scale-110 inline-block">
												🇬🇧
											</span>
											<Show when={locale() === 'en'}>
												<div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#2990ff] flex items-center justify-center shadow-sm">
													<span class="material-symbols-outlined text-[10px] text-white font-bold">
														done
													</span>
												</div>
											</Show>
										</div>
										<span
											class={`font-semibold ${locale() === 'en' ? 'text-[#5aaeff] text-[13px]' : 'text-[#c2cfde] text-[12px]'}`}
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
										class={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 border transition-all active:scale-95 group ${
											locale() === 'fa'
												? 'bg-[#2990ff]/12 border-[#2990ff]/40'
												: 'frag-inset hover:border-white/[0.15]'
										}`}
									>
										<div class="relative">
											<span class="text-[26px] transition-transform group-hover:scale-110 inline-block">
												🇮🇷
											</span>
											<Show when={locale() === 'fa'}>
												<div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#2990ff] flex items-center justify-center shadow-sm">
													<span class="material-symbols-outlined text-[10px] font-bold text-white">
														done
													</span>
												</div>
											</Show>
										</div>
										<span
											class={`font-semibold ${locale() === 'fa' ? 'text-[#5aaeff] text-[13px]' : 'text-[#c2cfde] text-[12px]'}`}
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
										class={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 border transition-all active:scale-95 group ${
											locale() === 'ru'
												? 'bg-[#2990ff]/12 border-[#2990ff]/40'
												: 'frag-inset hover:border-white/[0.15]'
										}`}
									>
										<div class="relative">
											<span class="text-[26px] transition-transform group-hover:scale-110 inline-block">
												🇷🇺
											</span>
											<Show when={locale() === 'ru'}>
												<div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#2990ff] flex items-center justify-center shadow-sm">
													<span class="material-symbols-outlined text-[10px] text-white font-bold">
														done
													</span>
												</div>
											</Show>
										</div>
										<span
											class={`font-semibold ${locale() === 'ru' ? 'text-[#5aaeff] text-[13px]' : 'text-[#c2cfde] text-[12px]'}`}
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
										class={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 border transition-all active:scale-95 group ${
											locale() === 'zh'
												? 'bg-[#2990ff]/12 border-[#2990ff]/40'
												: 'frag-inset hover:border-white/[0.15]'
										}`}
									>
										<div class="relative">
											<span class="text-[26px] transition-transform group-hover:scale-110 inline-block">
												🇨🇳
											</span>
											<Show when={locale() === 'zh'}>
												<div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#2990ff] flex items-center justify-center shadow-sm">
													<span class="material-symbols-outlined text-[10px] text-white font-bold">
														done
													</span>
												</div>
											</Show>
										</div>
										<span
											class={`font-semibold ${locale() === 'zh' ? 'text-[#5aaeff] text-[13px]' : 'text-[#c2cfde] text-[12px]'}`}
										>
											{t('settingsPg.langZh' as any)}
										</span>
									</button>
								</div>
							</div>
						</Motion.div>
					</div>

					{/* Floating Save / Discard Bar */}
					<Show when={isSettingsDirty()}>
						<Motion.div
							initial={{ opacity: 0, y: 30 }}
							animate={{ opacity: 1, y: 0 }}
							class="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#11161d] via-[#11161d]/95 to-transparent z-50 pointer-events-none"
						>
							<div
								class="max-w-md mx-auto flex gap-3 pointer-events-auto items-center"
								dir={isRtl() ? 'rtl' : 'ltr'}
							>
								<button
									type="button"
									onClick={handleDiscard}
									class="frag-btn-secondary px-5 h-12 text-[#ff5c6c] border-[#ff5c6c]/25 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-1.5 hover:bg-[#ff5c6c]/10 active:scale-95 transition-all"
								>
									<span class="material-symbols-outlined text-[19px]">close</span>
									<span>{t('common.cancel')}</span>
								</button>
								<button
									type="button"
									onClick={handleSave}
									class="frag-btn-primary flex-1 h-12 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-95 transition-all"
								>
									<span class="material-symbols-outlined text-[19px]">check</span>
									<span>{t('common.save')}</span>
								</button>
							</div>
						</Motion.div>
					</Show>
				</div>
			)}
		</SettingsGuard>
	);
};
