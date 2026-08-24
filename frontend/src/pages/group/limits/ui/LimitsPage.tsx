import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	Component,
	createResource,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
	Suspense,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/entities/group/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { SettingsGuard } from '@/shared/ui/SettingsGuard.js';
import { showToast } from '@/shared/ui/toast.js';
import { haptic } from '@/shared/lib/haptic.js';

interface LimitsConfig {
	minMessageLength: number;
	maxMessageLength: number;
	floodMessages: number;
	floodWindow: number;
	duplicateCount: number;
	duplicateWindow: number;
	slowMode: number;
}

const defaultConfig: LimitsConfig = {
	minMessageLength: 0,
	maxMessageLength: 0,
	floodMessages: 5,
	floodWindow: 5,
	duplicateCount: 2,
	duplicateWindow: 10,
	slowMode: 0,
};

const SLOW_MODE_PRESETS = [
	{ label: '0s (خاموش)', value: 0 },
	{ label: '10s', value: 10 },
	{ label: '30s', value: 30 },
	{ label: '1m', value: 60 },
	{ label: '5m', value: 300 },
	{ label: '15m', value: 900 },
	{ label: '1h', value: 3600 },
];

export const LimitsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [showUnsavedSheet, setShowUnsavedSheet] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const [limits, setLimits] = createStore<LimitsConfig>({ ...defaultConfig });
	const [initialLimits, setInitialLimits] = createSignal<LimitsConfig>({ ...defaultConfig });

	const [_, { refetch }] = createResource(() => params.id, async (groupId) => {
		const data = await groupApi.getSettings(groupId);
		setSettingsVersion(data.version);

		const remoteLimits = (data.limits || {}) as any;
		const mappedLimits: LimitsConfig = {
			minMessageLength: remoteLimits.minMessageLength ?? 0,
			maxMessageLength: remoteLimits.maxMessageLength ?? 0,
			floodMessages: remoteLimits.floodMessages || 5,
			floodWindow: remoteLimits.floodWindow || 5,
			duplicateCount: remoteLimits.duplicateCount || 2,
			duplicateWindow: remoteLimits.duplicateWindow || 10,
			slowMode: remoteLimits.slowMode ?? 0,
		};

		setInitialLimits({ ...mappedLimits });
		setLimits(reconcile({ ...defaultConfig, ...mappedLimits }));
		setIsDirty(false);
		return data;
	});

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

	const updateField = (key: keyof LimitsConfig, value: number) => {
		setLimits(key, value);
		setIsDirty(true);
	};

	const handleSave = async () => {
		if (!isDirty() || isSaving()) return;
		setIsSaving(true);
		try {
			const payload = {
				minMessageLength: limits.minMessageLength,
				maxMessageLength: limits.maxMessageLength,
				floodMessages: limits.floodMessages,
				floodWindow: limits.floodWindow,
				duplicateCount: limits.duplicateCount,
				duplicateWindow: limits.duplicateWindow,
				slowMode: limits.slowMode,
			};
			const result = await groupApi.updateSettings(params.id, 'limits', payload, settingsVersion());
			setSettingsVersion(result.version);
			setInitialLimits({ ...payload });
			setIsDirty(false);
			setShowUnsavedSheet(false);
			haptic.notify('success');
			showToast(t('common.settingsSaved'), 'success');
			navigate(`/group/${params.id}`);
		} catch (_e) {
			haptic.notify('error');
			showToast(t('common.errorUpdateFailed'), 'error');
		} finally {
			setIsSaving(false);
		}
	};

	const handleDiscard = () => {
		setLimits(reconcile({ ...initialLimits() }));
		setIsDirty(false);
		setShowUnsavedSheet(false);
		window.history.back();
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => { haptic.impact('light'); handleBack(); }}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-white/80 text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2.5">
							<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
								{t('limitsSettings.title')}
							</h1>
							<Show when={isDirty()}>
								<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
							</Show>
						</div>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('limitsSettings.description')}
						</span>
					</div>
				</div>

				<button
					onClick={() => setIsMenuOpen(true)}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-colors shrink-0 shadow-sm text-white/80"
					aria-label={t('common.toggle')}
				>
					<span class="material-symbols-outlined text-[22px]">menu</span>
				</button>
			</div>

			<HamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} groupId={params.id} activeTab="limits" />

			<Suspense fallback={<div class="p-8 flex justify-center"><div class="w-8 h-8 border-2 border-[#3390ec] border-t-transparent rounded-full animate-spin" /></div>}>
				<div class="p-5 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
					
					{/* ═══════ NATIVE SLOW MODE CARD ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-[#3390ec]/20 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-[#3390ec] text-[20px]">hourglass_bottom</span>
									<h2 class="text-[13px] font-black text-[#3390ec] uppercase tracking-widest">اسلومود نیتیو تلگرام (Slow Mode)</h2>
								</div>
								<span class="text-[9px] font-black bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/30 px-2 py-0.5 rounded-[6px] uppercase tracking-widest">NATIVE</span>
							</div>

							<p class="text-[11px] text-white/50 leading-relaxed font-medium">
								تعیین حداقل فاصله زمانی بین ارسال پیام‌های کاربران عادی مستقیماً در سرورهای تلگرام.
							</p>

							{/* Presets */}
							<div class="grid grid-cols-4 gap-2">
								<For each={SLOW_MODE_PRESETS}>
									{(preset) => (
										<button
											type="button"
											onClick={() => {
												haptic.selection();
												updateField('slowMode', preset.value);
											}}
											class={`h-10 rounded-[12px] text-[12px] font-mono font-bold transition-all border ${
												limits.slowMode === preset.value
													? 'bg-[#3390ec] text-white border-transparent shadow-[0_0_12px_rgba(51,144,236,0.5)]'
													: 'bg-[#08090D] text-white/60 border-white/10 hover:border-white/20'
											}`}
										>
											{preset.label}
										</button>
									)}
								</For>
							</div>

							<div class="flex items-center gap-3 pt-1">
								<input
									type="range"
									min="0"
									max="3600"
									step="10"
									value={limits.slowMode}
									onInput={(e) => updateField('slowMode', parseInt(e.currentTarget.value, 10) || 0)}
									class="w-full accent-[#3390ec] cursor-pointer"
								/>
								<span class="text-[13px] font-mono font-black text-white shrink-0 min-w-[50px] text-end">
									{limits.slowMode}s
								</span>
							</div>
						</div>
					</Motion.div>

					{/* ═══════ FLOOD CONTROL CARD ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-amber-400 text-[20px]">flood</span>
								<h2 class="text-[13px] font-black text-amber-400 uppercase tracking-widest">{t('limitsSettings.floodControl')}</h2>
							</div>

							<div class="grid grid-cols-2 gap-3.5">
								<div class="flex flex-col gap-1.5">
									<label class="text-[11px] font-bold text-white/60 uppercase tracking-wider">{t('limitsSettings.maxMessages')}</label>
									<div class="relative flex items-center">
										<input
											type="number" min="1" max="100" value={limits.floodMessages}
											onInput={(e) => updateField('floodMessages', parseInt(e.currentTarget.value, 10) || 1)}
											class="w-full h-12 bg-[#08090D] border border-white/10 text-white font-mono font-bold text-[14px] rounded-[14px] px-4 focus:outline-none focus:border-amber-400/50 text-center"
											dir="ltr"
										/>
										<span class="absolute right-3 text-[10px] text-white/40 pointer-events-none font-bold">پیام</span>
									</div>
								</div>
								<div class="flex flex-col gap-1.5">
									<label class="text-[11px] font-bold text-white/60 uppercase tracking-wider">{t('limitsSettings.timeWindow')}</label>
									<div class="relative flex items-center">
										<input
											type="number" min="1" max="600" value={limits.floodWindow}
											onInput={(e) => updateField('floodWindow', parseInt(e.currentTarget.value, 10) || 1)}
											class="w-full h-12 bg-[#08090D] border border-white/10 text-white font-mono font-bold text-[14px] rounded-[14px] px-4 focus:outline-none focus:border-amber-400/50 text-center"
											dir="ltr"
										/>
										<span class="absolute right-3 text-[10px] text-white/40 pointer-events-none font-bold">ثانیه</span>
									</div>
								</div>
							</div>
						</div>
					</Motion.div>

					{/* ═══════ MESSAGE LENGTH LIMITS ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-[#10b981] text-[20px]">text_fields</span>
								<h2 class="text-[13px] font-black text-[#10b981] uppercase tracking-widest">{t('limitsSettings.messageLength')}</h2>
							</div>

							<div class="grid grid-cols-2 gap-3.5">
								<div class="flex flex-col gap-1.5">
									<label class="text-[11px] font-bold text-white/60 uppercase tracking-wider">{t('limitsSettings.minLength')}</label>
									<div class="relative flex items-center">
										<input
											type="number" min="0" max="4096" value={limits.minMessageLength}
											onInput={(e) => updateField('minMessageLength', parseInt(e.currentTarget.value, 10) || 0)}
											class="w-full h-12 bg-[#08090D] border border-white/10 text-white font-mono font-bold text-[14px] rounded-[14px] px-4 focus:outline-none focus:border-[#10b981]/50 text-center"
											dir="ltr"
										/>
										<span class="absolute right-3 text-[10px] text-white/40 pointer-events-none font-bold">حرف</span>
									</div>
								</div>
								<div class="flex flex-col gap-1.5">
									<label class="text-[11px] font-bold text-white/60 uppercase tracking-wider">{t('limitsSettings.maxLength')}</label>
									<div class="relative flex items-center">
										<input
											type="number" min="0" max="4096" value={limits.maxMessageLength}
											onInput={(e) => updateField('maxMessageLength', parseInt(e.currentTarget.value, 10) || 0)}
											class="w-full h-12 bg-[#08090D] border border-white/10 text-white font-mono font-bold text-[14px] rounded-[14px] px-4 focus:outline-none focus:border-[#10b981]/50 text-center"
											dir="ltr"
										/>
										<span class="absolute right-3 text-[10px] text-white/40 pointer-events-none font-bold">حرف</span>
									</div>
								</div>
							</div>
						</div>
					</Motion.div>

					{/* ═══════ DUPLICATE MESSAGES ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4">
							<div class="flex items-center gap-2">
								<span class="material-symbols-outlined text-[#ff4a4a] text-[20px]">content_copy</span>
								<h2 class="text-[13px] font-black text-[#ff4a4a] uppercase tracking-widest">{t('limitsSettings.duplicateMessages')}</h2>
							</div>

							<div class="grid grid-cols-2 gap-3.5">
								<div class="flex flex-col gap-1.5">
									<label class="text-[11px] font-bold text-white/60 uppercase tracking-wider">{t('limitsSettings.maxDuplicates')}</label>
									<div class="relative flex items-center">
										<input
											type="number" min="1" max="20" value={limits.duplicateCount}
											onInput={(e) => updateField('duplicateCount', parseInt(e.currentTarget.value, 10) || 1)}
											class="w-full h-12 bg-[#08090D] border border-white/10 text-white font-mono font-bold text-[14px] rounded-[14px] px-4 focus:outline-none focus:border-[#ff4a4a]/50 text-center"
											dir="ltr"
										/>
										<span class="absolute right-3 text-[10px] text-white/40 pointer-events-none font-bold">بار</span>
									</div>
								</div>
								<div class="flex flex-col gap-1.5">
									<label class="text-[11px] font-bold text-white/60 uppercase tracking-wider">{t('limitsSettings.duplicateWindow')}</label>
									<div class="relative flex items-center">
										<input
											type="number" min="1" max="600" value={limits.duplicateWindow}
											onInput={(e) => updateField('duplicateWindow', parseInt(e.currentTarget.value, 10) || 1)}
											class="w-full h-12 bg-[#08090D] border border-white/10 text-white font-mono font-bold text-[14px] rounded-[14px] px-4 focus:outline-none focus:border-[#ff4a4a]/50 text-center"
											dir="ltr"
										/>
										<span class="absolute right-3 text-[10px] text-white/40 pointer-events-none font-bold">ثانیه</span>
									</div>
								</div>
							</div>
						</div>
					</Motion.div>
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
