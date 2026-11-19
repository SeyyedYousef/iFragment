import { type Component, createEffect, For, onCleanup, onMount, Show } from 'solid-js';
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
					class="frag-canvas min-h-screen pb-32 text-white font-frag-sans flex flex-col relative overflow-x-clip"
					dir={isRtl() ? 'rtl' : 'ltr'}
				>
					{/* Sticky Fragment Header */}
					<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center gap-3">
						<button
							type="button"
							onClick={() => requestLeave(() => window.history.back())}
							class="w-8 h-8 rounded-[6px] bg-[#242e38] hover:bg-[#293440] flex items-center justify-center text-white shrink-0 cursor-pointer"
							aria-label={t('common.back')}
						>
							<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_back</span>
						</button>
						<div class="flex flex-col min-w-0">
							<h1 class="text-[16px] font-bold text-white leading-tight truncate">
								{t('settings.title')}
							</h1>
							<span class="text-[11px] text-[#8c9aa9] truncate">{t('settings.subtitle')}</span>
						</div>
					</header>

					<div class="flex-1 w-full max-w-[480px] mx-auto relative z-10 flex flex-col px-4 pt-5 gap-5">
						{/* General Preferences (.frag-table-container) */}
						<div class="flex flex-col gap-2">
							<h2 class="text-[13px] font-semibold text-[#8c9aa9] px-0.5">
								{t('settings.general')}
							</h2>

							<div class="frag-table-container">
								{/* Haptic Feedback */}
								<div class="frag-table-row px-3.5 py-3 flex items-center justify-between gap-4">
									<div class="flex flex-col gap-0.5 min-w-0">
										<span class="text-[13.5px] font-semibold text-white">
											{t('settings.hapticFeedback')}
										</span>
										<span class="text-[11.5px] text-[#8794a1] leading-snug">
											{t('settings.hapticDesc')}
										</span>
									</div>
									<ToggleSwitch
										checked={draftProfileSettings().hapticEnabled}
										onChange={handleToggleHaptic}
									/>
								</div>

								{/* Sound Effects */}
								<div class="frag-table-row px-3.5 py-3 flex items-center justify-between gap-4">
									<div class="flex flex-col gap-0.5 min-w-0">
										<span class="text-[13.5px] font-semibold text-white">
											{t('settings.soundEffects')}
										</span>
										<span class="text-[11.5px] text-[#8794a1] leading-snug">
											{t('settings.soundDesc')}
										</span>
									</div>
									<ToggleSwitch
										checked={draftProfileSettings().soundEnabled}
										onChange={handleToggleSound}
									/>
								</div>

								{/* Animations */}
								<div class="frag-table-row px-3.5 py-3 flex items-center justify-between gap-4">
									<div class="flex flex-col gap-0.5 min-w-0">
										<span class="text-[13.5px] font-semibold text-white">
											{t('settings.animations')}
										</span>
										<span class="text-[11.5px] text-[#8794a1] leading-snug">
											{t('settings.animationsDesc')}
										</span>
									</div>
									<ToggleSwitch
										checked={draftProfileSettings().autoPlayAnimations}
										onChange={handleToggleAnimations}
									/>
								</div>
							</div>
						</div>

						{/* Language Selection (.frag-table-container) */}
						<div class="flex flex-col gap-2">
							<h2 class="text-[13px] font-semibold text-[#8c9aa9] px-0.5">
								{t('profile.languageSettings')}
							</h2>

							<div class="frag-table-container">
								<For
									each={
										[
											{ code: 'en', labelKey: 'settingsPg.langEn' },
											{ code: 'fa', labelKey: 'settingsPg.langFa' },
											{ code: 'ru', labelKey: 'settingsPg.langRu' },
											{ code: 'zh', labelKey: 'settingsPg.langZh' },
										] as const
									}
								>
									{(lang) => (
										<button
											type="button"
											onClick={() => {
												setLocale(lang.code);
												try {
													haptic.selection();
												} catch {}
											}}
											class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between text-start cursor-pointer"
										>
											<span
												class={`text-[13.5px] font-semibold ${
													locale() === lang.code ? 'text-[#4db2ff]' : 'text-white'
												}`}
											>
												{t(lang.labelKey as any)}
											</span>
											<Show when={locale() === lang.code}>
												<span class="material-symbols-outlined text-[18px] text-[#4db2ff]">
													check
												</span>
											</Show>
										</button>
									)}
								</For>
							</div>
						</div>
					</div>

					{/* Save / Discard Bar */}
					<Show when={isSettingsDirty()}>
						<div class="fixed bottom-0 left-0 right-0 p-4 bg-[#1a2026]/95 border-t border-[#293440] z-50">
							<div
								class="max-w-[480px] mx-auto flex gap-2.5 items-center"
								dir={isRtl() ? 'rtl' : 'ltr'}
							>
								<button
									type="button"
									onClick={handleDiscard}
									class="frag-btn-secondary px-4 h-10 text-[#ff5863] font-semibold text-[13px] cursor-pointer"
								>
									{t('common.cancel')}
								</button>
								<button
									type="button"
									onClick={handleSave}
									class="frag-btn-primary flex-1 h-10 font-semibold text-[13px] cursor-pointer"
								>
									{t('common.save')}
								</button>
							</div>
						</div>
					</Show>
				</div>
			)}
		</SettingsGuard>
	);
};
