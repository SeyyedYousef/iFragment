import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	type Component,
	createResource,
	createSignal,
	onCleanup,
	onMount,
	Show,
	Suspense,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/entities/group/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { SettingsGuard } from '@/shared/ui/SettingsGuard.js';
import { InlineButtonField } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

interface CustomTextsConfig {
	welcomeText: string;
	warningText: string;
	silenceStartText: string;
	silenceEndText: string;
	rulesText: string;
	forceJoinText: string;
	forceAddText: string;
	inlineButtons: { id: string; title: string; url: string }[];
}

const defaults: CustomTextsConfig = {
	welcomeText: '',
	warningText: '',
	silenceStartText: '',
	silenceEndText: '',
	rulesText: '',
	forceJoinText: '',
	forceAddText: '',
	inlineButtons: [],
};

export const CustomTextsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);
	const [showUnsavedSheet, setShowUnsavedSheet] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const [cfg, setCfg] = createStore<CustomTextsConfig>({ ...defaults });
	const [initialCfg, setInitialCfg] = createSignal<CustomTextsConfig>({ ...defaults });

	const [_] = createResource(
		() => params.id,
		async (groupId) => {
			const data = await groupApi.getSettings(groupId);
			setSettingsVersion(data.version);
			const ct = (data.custom_texts || {}) as Partial<CustomTextsConfig>;
			const merged = { ...defaults, ...ct };
			setInitialCfg({ ...merged });
			setCfg(reconcile(merged));
			setIsDirty(false);
			return data;
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

	const update = (key: keyof CustomTextsConfig, val: any) => {
		setCfg(key, val);
		setIsDirty(true);
	};

	const handleSave = async () => {
		if (!isDirty() || isSaving()) return;
		setIsSaving(true);
		try {
			const result = await groupApi.updateSettings(
				params.id,
				'custom_texts',
				cfg as any,
				settingsVersion(),
			);
			setSettingsVersion(result.version);
			setInitialCfg({ ...cfg });
			setIsDirty(false);
			setShowUnsavedSheet(false);
			haptic.notify('success');
			showToast(t('common.settingsSaved') || 'Settings saved successfully', 'success');
			navigate(`/group/${params.id}`);
			backButton.hide();
		} catch (_e) {
			showToast(t('common.errorUpdateFailed'), 'error');
			haptic.notify('error');
		} finally {
			setIsSaving(false);
		}
	};

	const handleDiscard = () => {
		setCfg(reconcile({ ...initialCfg() }));
		setIsDirty(false);
		setShowUnsavedSheet(false);
		window.history.back();
	};

	return (
		<div
			class="min-h-screen bg-[#030303] text-white pb-28 relative font-sans selection:bg-[#3390ec]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						type="button"
						onClick={() => {
							haptic.impact('light');
							handleBack();
						}}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">
							arrow_back
						</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2.5">
							<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
								{t('customTextsSettings.title')}
							</h1>
							<Show when={isDirty()}>
								<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
							</Show>
						</div>
						<p class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('customTextsSettings.subtitle')}
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => setIsMenuOpen(true)}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 shadow-sm text-white/80"
					aria-label={t('common.toggle')}
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<HamburgerMenu
				isOpen={isMenuOpen()}
				onClose={() => setIsMenuOpen(false)}
				groupId={params.id}
				activeTab="custom"
			/>

			<Suspense
				fallback={
					<div class="p-8 flex justify-center">
						<div class="w-8 h-8 border-2 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
					</div>
				}
			>
				<div class="p-5 flex flex-col gap-5 max-w-md mx-auto relative z-10">
					{/* ═══════ WELCOME MESSAGE ═══════ */}
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm flex flex-col gap-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-[#3390ec] text-[20px]">
									waving_hand
								</span>
								<h2 class="text-[13px] font-black text-[#3390ec] uppercase tracking-widest">
									{t('customTextsSettings.welcomeTitle')}
								</h2>
							</div>
							<span class="text-[10px] text-white/40 font-mono font-bold">
								{t('ownerBroadcast.htmlTags')}
							</span>
						</div>

						<textarea
							rows={3}
							value={cfg.welcomeText}
							onInput={(e) => update('welcomeText', e.currentTarget.value)}
							placeholder={t('customTextsSettings.welcomePlaceholder')}
							class="w-full bg-[#08090D] border border-white/10 rounded-[16px] p-4 text-[13px] text-white focus:outline-none focus:border-[#3390ec]/50 transition-colors resize-none shadow-inner leading-relaxed"
						/>
						<div class="flex items-center gap-1 text-[10px] text-white/40 font-mono">
							<span>{t('groupCustomTexts.variables')} </span>
							<code class="text-[#3390ec] font-bold">{'{user}'}</code>,{' '}
							<code class="text-[#3390ec] font-bold">{'{group}'}</code>,{' '}
							<code class="text-[#3390ec] font-bold">{'{id}'}</code>
						</div>
					</div>

					{/* ═══════ WARNING MESSAGE ═══════ */}
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm flex flex-col gap-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400 text-[20px]">warning</span>
								<h2 class="text-[13px] font-black text-amber-400 uppercase tracking-widest">
									{t('customTextsSettings.warningTitle')}
								</h2>
							</div>
						</div>

						<textarea
							rows={3}
							value={cfg.warningText}
							onInput={(e) => update('warningText', e.currentTarget.value)}
							placeholder={t('customTextsSettings.warningPlaceholder')}
							class="w-full bg-[#08090D] border border-white/10 rounded-[16px] p-4 text-[13px] text-white focus:outline-none focus:border-amber-400/50 transition-colors resize-none shadow-inner leading-relaxed"
						/>
						<div class="flex items-center gap-1 text-[10px] text-white/40 font-mono">
							<span>{t('groupCustomTexts.variables')} </span>
							<code class="text-amber-400 font-bold">{'{user}'}</code>,{' '}
							<code class="text-amber-400 font-bold">{'{count}'}</code>,{' '}
							<code class="text-amber-400 font-bold">{'{threshold}'}</code>,{' '}
							<code class="text-amber-400 font-bold">{'{reason}'}</code>
						</div>
					</div>

					{/* ═══════ GROUP RULES ═══════ */}
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm flex flex-col gap-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-[#10b981] text-[20px]">gavel</span>
								<h2 class="text-[13px] font-black text-[#10b981] uppercase tracking-widest">
									{t('customTextsSettings.rulesTitle')}
								</h2>
							</div>
						</div>

						<textarea
							rows={4}
							value={cfg.rulesText}
							onInput={(e) => update('rulesText', e.currentTarget.value)}
							placeholder={t('customTextsSettings.rulesPlaceholder')}
							class="w-full bg-[#08090D] border border-white/10 rounded-[16px] p-4 text-[13px] text-white focus:outline-none focus:border-[#10b981]/50 transition-colors resize-none shadow-inner leading-relaxed"
						/>
					</div>

					{/* ═══════ QUIET HOURS NOTICES ═══════ */}
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm flex flex-col gap-4">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#ff4a4a] text-[20px]">bedtime</span>
							<h2 class="text-[13px] font-black text-[#ff4a4a] uppercase tracking-widest">
								{t('groupCustomTexts.quietHoursMessages')}
							</h2>
						</div>

						<div class="flex flex-col gap-1.5">
							<div class="text-[11px] font-bold text-white/50">
								{t('customTextsSettings.silenceStart')}
							</div>
							<input
								type="text"
								value={cfg.silenceStartText}
								onInput={(e) => update('silenceStartText', e.currentTarget.value)}
								class="w-full h-12 bg-[#08090D] border border-white/10 rounded-[14px] px-4 text-[13px] text-white focus:outline-none focus:border-[#ff4a4a]/50"
							/>
						</div>

						<div class="flex flex-col gap-1.5">
							<div class="text-[11px] font-bold text-white/50">
								{t('customTextsSettings.silenceEnd')}
							</div>
							<input
								type="text"
								value={cfg.silenceEndText}
								onInput={(e) => update('silenceEndText', e.currentTarget.value)}
								class="w-full h-12 bg-[#08090D] border border-white/10 rounded-[14px] px-4 text-[13px] text-white focus:outline-none focus:border-[#ff4a4a]/50"
							/>
						</div>
					</div>

					{/* ═══════ INLINE BUTTONS ═══════ */}
					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm flex flex-col gap-3">
						<InlineButtonField
							label={t('customTextsSettings.inlineButtons')}
							buttons={cfg.inlineButtons}
							onAdd={(btn) => update('inlineButtons', [...cfg.inlineButtons, btn])}
							onRemove={(id) =>
								update(
									'inlineButtons',
									cfg.inlineButtons.filter((b) => b.id !== id),
								)
							}
							description={t('customTextsSettings.inlineButtonsDesc')}
						/>
					</div>
				</div>
			</Suspense>

			<SettingsGuard
				isDirty={isDirty()}
				isSaving={isSaving()}
				showSheet={showUnsavedSheet()}
				onSave={handleSave}
				onDiscard={handleDiscard}
				onCloseSheet={() => setShowUnsavedSheet(false)}
			/>
		</div>
	);
};
