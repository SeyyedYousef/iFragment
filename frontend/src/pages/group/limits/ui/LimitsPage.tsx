import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	Component,
	createResource,
	createSignal,
	onCleanup,
	onMount,
	Show,
	Suspense,
} from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { NumberInputField } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';
import { haptic } from '@/shared/lib/haptic.js';

interface LimitsConfig { minMessageLength: number; maxMessageLength: number; floodMessages: number; floodWindow: number; duplicateCount: number; duplicateWindow: number; }

const defaultConfig: LimitsConfig = { minMessageLength: 0, maxMessageLength: 0, floodMessages: 0, floodWindow: 0, duplicateCount: 0, duplicateWindow: 0 };

export const LimitsPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);

	const [limits, setLimits] = createStore<LimitsConfig>({ ...defaultConfig });

	const [_, { refetch }] = createResource(() => params.id, async (groupId) => {
		const data = await groupApi.getSettings(groupId);
		setSettingsVersion(data.version);

		const remoteLimits = (data.limits || {}) as any;
		const mappedLimits = {
			minMessageLength: remoteLimits.minMessageLength ?? 0,
			maxMessageLength: remoteLimits.maxMessageLength ?? 0,
			floodMessages: remoteLimits.floodMessages || 5,
			floodWindow: remoteLimits.floodWindow || 5,
			duplicateCount: remoteLimits.duplicateCount || 2,
			duplicateWindow: remoteLimits.duplicateWindow || 10,
		};

		setLimits(reconcile({ ...defaultConfig, ...mappedLimits }));
		setIsDirty(false);
		return data;
	});

	onMount(() => {
		backButton.show();
		const off = backButton.onClick(() => {
			haptic.impact('light');
			window.history.back();
		});
		onCleanup(() => off());
	});

	const updateField = (key: keyof LimitsConfig, value: number) => {
		setLimits(key, value);
		setIsDirty(true);
	};

	const handleSave = async () => {
		if (!isDirty()) return;
		haptic.notify('success');
		setIsSaving(true);
		try {
			const payload = {
				minMessageLength: limits.minMessageLength,
				maxMessageLength: limits.maxMessageLength,
				floodMessages: limits.floodMessages,
				floodWindow: limits.floodWindow,
				duplicateCount: limits.duplicateCount,
				duplicateWindow: limits.duplicateWindow,
			};
			const result = await groupApi.updateSettings(params.id, 'limits', payload, settingsVersion());
			setSettingsVersion(result.version);
			setIsDirty(false);
			showToast(t('common.settingsSaved'), 'success');
			navigate(`/group/${params.id}`);
			backButton.hide();
		} catch (_e) {
			showToast(t('common.errorUpdateFailed'), 'error');
			haptic.notify('error');
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => { haptic.impact('light'); window.history.back(); }}
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
								<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
							</Show>
						</div>
						<p class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('limitsSettings.subtitle')}
						</p>
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

			<Suspense fallback={null}>
				<div class="p-5 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
					
					{/* ═══════ INFO BANNER (Rule of Zero) ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} class="bg-gradient-to-br from-[#3390ec]/10 to-transparent border border-[#3390ec]/20 rounded-[20px] p-4 flex items-start gap-3.5 shadow-sm relative overflow-hidden">
						<div class="absolute -right-6 -top-6 w-24 h-24 bg-[#3390ec]/10 blur-2xl rounded-full pointer-events-none" />
						<div class="w-9 h-9 rounded-[10px] bg-[#3390ec]/15 border border-[#3390ec]/30 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
							<span class="material-symbols-outlined text-[#3390ec] text-[20px]">info</span>
						</div>
						<div class="flex flex-col relative z-10">
							<span class="text-[13px] font-black text-white mb-1 tracking-tight">{t('limitsSettings.ruleOfZero')}</span>
							<span class="text-[11px] text-white/60 leading-relaxed font-medium">
								{t('limitsSettings.ruleOfZeroDesc')}<br />
								<span class="text-[#3390ec] font-bold">{t('limitsSettings.ruleOfZeroExample')}</span> {t('limitsSettings.ruleOfZeroExampleText')}
							</span>
						</div>
					</Motion.div>

					{/* ═══════ DANGER BANNER (Loss Aversion) ═══════ */}
					<Show when={limits.floodMessages === 0 || limits.duplicateCount === 0}>
						<Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} class="bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 rounded-[20px] p-4 flex items-start gap-3.5 shadow-sm">
							<div class="w-9 h-9 rounded-[10px] bg-[#ff4a4a]/15 border border-[#ff4a4a]/30 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
								<span class="material-symbols-outlined text-[#ff4a4a] text-[20px]">warning</span>
							</div>
							<div class="flex flex-col">
								<span class="text-[13px] font-black text-[#ff4a4a] mb-1 tracking-tight">
									{t('limitsSettings.warningTitle')}
								</span>
								<span class="text-[11px] text-[#ff4a4a]/70 leading-relaxed font-bold">
									{t('limitsSettings.warningDesc')}
								</span>
							</div>
						</Motion.div>
					</Show>

					{/* ═══════ MESSAGE LENGTH LIMITS ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4 mt-2">
						<div class="absolute -right-6 -top-6 w-24 h-24 bg-[#3390ec]/10 blur-2xl rounded-full pointer-events-none" />
						<div class="flex items-center gap-2 mb-1 relative z-10">
							<span class="material-symbols-outlined text-[20px] text-[#3390ec]">sort_by_alpha</span>
							<h3 class="text-[13px] font-black text-[#3390ec] uppercase tracking-widest">{t('limitsSettings.messageLength')}</h3>
						</div>
						<div class="relative z-10 flex flex-col gap-4">
							<NumberInputField label={t('limitsSettings.minLen')} description={t('limitsSettings.minLenDesc')} value={limits.minMessageLength} onChange={(v) => updateField('minMessageLength', v)} placeholder="0" />
							<div class="w-full h-[1px] bg-white/5 rounded-full my-1" />
							<NumberInputField label={t('limitsSettings.maxLen')} description={t('limitsSettings.maxLenDesc')} value={limits.maxMessageLength} onChange={(v) => updateField('maxMessageLength', v)} placeholder="0" />
						</div>
					</Motion.div>

					{/* ═══════ FLOOD CONTROL ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4 mt-1">
						<div class="absolute -left-6 -top-6 w-24 h-24 bg-amber-400/10 blur-2xl rounded-full pointer-events-none" />
						<div class="flex items-center gap-2 mb-1 relative z-10">
							<span class="material-symbols-outlined text-[20px] text-amber-400">speed</span>
							<h3 class="text-[13px] font-black text-amber-400 uppercase tracking-widest">{t('limitsSettings.floodControl')}</h3>
						</div>
						<div class="relative z-10 flex flex-col gap-4">
							<NumberInputField label={t('limitsSettings.floodMsgs')} description={t('limitsSettings.floodMsgsDesc')} value={limits.floodMessages} onChange={(v) => updateField('floodMessages', v)} placeholder="0" />
							<div class="w-full h-[1px] bg-white/5 rounded-full my-1" />
							<NumberInputField label={t('limitsSettings.floodWin')} description={t('limitsSettings.floodWinDesc')} value={limits.floodWindow} onChange={(v) => updateField('floodWindow', v)} placeholder="0" />
						</div>
					</Motion.div>

					{/* ═══════ DUPLICATE PROTECTION ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex flex-col gap-4 mt-1">
						<div class="absolute -right-6 -bottom-6 w-24 h-24 bg-[#10b981]/10 blur-2xl rounded-full pointer-events-none" />
						<div class="flex items-center gap-2 mb-1 relative z-10">
							<span class="material-symbols-outlined text-[20px] text-[#10b981]">file_copy</span>
							<h3 class="text-[13px] font-black text-[#10b981] uppercase tracking-widest">{t('limitsSettings.duplicateProtection')}</h3>
						</div>
						<div class="relative z-10 flex flex-col gap-4">
							<NumberInputField label={t('limitsSettings.dupCount')} description={t('limitsSettings.dupCountDesc')} value={limits.duplicateCount} onChange={(v) => updateField('duplicateCount', v)} placeholder="0" />
							<div class="w-full h-[1px] bg-white/5 rounded-full my-1" />
							<NumberInputField label={t('limitsSettings.dupWin')} description={t('limitsSettings.dupWinDesc')} value={limits.duplicateWindow} onChange={(v) => updateField('duplicateWindow', v)} placeholder="0" />
						</div>
					</Motion.div>
				</div>
			</Suspense>

			{/* ═══════ FLOATING ACTION BAR ═══════ */}
			<Show when={isDirty()}>
				<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#030303] via-[#030303]/90 to-transparent z-40 pointer-events-none">
					<div class="max-w-md mx-auto flex gap-3 pointer-events-auto">
						<button
							onClick={() => refetch()} disabled={isSaving()}
							class="w-16 h-14 bg-[#12141C]/80 backdrop-blur-md text-[#ff4a4a] border border-[#ff4a4a]/20 rounded-[16px] transition-all flex items-center justify-center hover:bg-[#ff4a4a]/10 active:scale-95 shadow-sm"
						>
							<span class="material-symbols-outlined text-[24px]">close</span>
						</button>
						<button
							onClick={handleSave} disabled={isSaving()}
							class="flex-1 h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest shadow-[0_10px_30px_rgba(51,144,236,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:scale-100 active:scale-95 border border-white/10"
						>
							<Show when={!isSaving()} fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}>
								{t('generalSettings.saveSettings')} <span class="material-symbols-outlined text-[22px]">save</span>
							</Show>
						</button>
					</div>
				</div>
			</Show>
		</div>
	);
};
