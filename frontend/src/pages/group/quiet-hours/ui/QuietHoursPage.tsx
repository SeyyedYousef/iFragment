import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { Component, createResource, createSignal, For, onCleanup, onMount, Show, Suspense } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import { groupApi } from '@/shared/api/bot-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { SettingsSection } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';
import { haptic } from '@/shared/lib/haptic.js';

interface QuietPeriod { id: string; start: string; end: string; }
interface QuietHoursConfig { emergencyLock: boolean; adminOverride: boolean; sendNotifications: boolean; periods: QuietPeriod[]; }

const defaultConfig: QuietHoursConfig = { emergencyLock: false, adminOverride: true, sendNotifications: true, periods: [] };

export const QuietHoursPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);
	const [overlapWarning, setOverlapWarning] = createSignal('');

	const [config, setConfig] = createStore<QuietHoursConfig>({ ...defaultConfig });

	const [_, { refetch }] = createResource(() => params.id, async (groupId) => {
		const data = await groupApi.getSettings(groupId);
		setSettingsVersion(data.version);
		const qh = (data.quiet_hours || {}) as Partial<QuietHoursConfig>;
		setConfig(reconcile({ ...defaultConfig, ...qh }));
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

	const isTimeInPeriod = (time: string, start: string, end: string) => {
		if (start < end) return time >= start && time <= end;
		return time >= start || time <= end;
	};

	const checkOverlaps = (periods: QuietPeriod[]) => {
		const getMinutes = (timeStr: string): number => {
			const [h, m] = timeStr.split(':').map(Number);
			return h * 60 + m;
		};

		const getIntervals = (startStr: string, endStr: string): { start: number; end: number }[] => {
			const start = getMinutes(startStr);
			const end = getMinutes(endStr);
			if (start < end) return [{ start, end }];
			else if (start > end) return [{ start, end: 1440 }, { start: 0, end }];
			else return [{ start: 0, end: 1440 }];
		};

		const isOverlap = (i1: { start: number; end: number }, i2: { start: number; end: number }): boolean => {
			return i1.start < i2.end && i2.start < i1.end;
		};

		for (let i = 0; i < periods.length; i++) {
			const intervalsA = getIntervals(periods[i].start, periods[i].end);
			for (let j = i + 1; j < periods.length; j++) {
				const intervalsB = getIntervals(periods[j].start, periods[j].end);
				for (const intA of intervalsA) {
					for (const intB of intervalsB) {
						if (isOverlap(intA, intB)) {
							setOverlapWarning(t('quietHoursSettings.periodOverlap'));
							return;
						}
					}
				}
			}
		}
		setOverlapWarning('');
	};

	const isCurrentlyQuiet = () => {
		if (config.emergencyLock) return true;
		const now = new Date();
		const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
		return config.periods.some((p) => isTimeInPeriod(currentTime, p.start, p.end));
	};

	const addPeriod = () => {
		haptic.impact('medium');
		const newPeriod: QuietPeriod = { id: crypto.randomUUID(), start: '22:00', end: '08:00' };
		setConfig('periods', [...config.periods, newPeriod]);
		setIsDirty(true);
		checkOverlaps([...config.periods, newPeriod]);
	};

	const removePeriod = (id: string) => {
		haptic.impact('light');
		const updated = config.periods.filter((p) => p.id !== id);
		setConfig('periods', updated);
		setIsDirty(true);
		checkOverlaps(updated);
	};

	const updatePeriod = (id: string, field: 'start' | 'end', value: string) => {
		const updated = config.periods.map((p) => (p.id === id ? { ...p, [field]: value } : p));
		setConfig('periods', updated);
		setIsDirty(true);
		checkOverlaps(updated);
	};

	const handleSave = async () => {
		if (overlapWarning()) {
			haptic.notify('error');
			return;
		}
		if (!isDirty()) return;

		haptic.notify('success');
		setIsSaving(true);
		try {
			const result = await groupApi.updateSettings(params.id, 'quiet_hours', config as any, settingsVersion());
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
		<div class="min-h-screen bg-[#030303] text-white pb-28 relative font-sans selection:bg-[#3390ec]/30" dir={isRtl() ? 'rtl' : 'ltr'}>
			
			{/* Ambient Top Glow */}
			<div class="absolute top-0 left-0 right-0 h-[350px] bg-gradient-to-b from-[#3390ec]/15 via-transparent to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center justify-between gap-3 shadow-sm">
				<div class="flex items-center gap-3.5 overflow-hidden flex-1">
					<button
						onClick={() => { haptic.impact('light'); window.history.back(); }}
						class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
						aria-label={t('common.back')}
					>
						<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
					</button>
					<div class="flex flex-col overflow-hidden">
						<div class="flex items-center gap-2.5">
							<h1 class="text-[18px] font-black text-white leading-tight truncate tracking-tight">
								{t('quietHoursSettings.title')}
							</h1>
							<Show when={isDirty()}>
								<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
							</Show>
						</div>
						<p class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('quietHoursSettings.subtitle')}
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

			<HamburgerMenu isOpen={isMenuOpen()} onClose={() => setIsMenuOpen(false)} groupId={params.id} activeTab="quiet" />

			<Suspense fallback={null}>
				<div class="p-5 flex flex-col gap-4 max-w-md mx-auto relative z-10 w-full">
					
					{/* ═══════ CURRENT STATUS PREVIEW ═══════ */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
						class={`p-5 rounded-[24px] border backdrop-blur-xl flex items-center justify-between shadow-sm relative overflow-hidden transition-colors duration-500 ${
							isCurrentlyQuiet() ? 'bg-[#ff4a4a]/10 border-[#ff4a4a]/30 text-[#ff4a4a]' : 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]'
						}`}
					>
						<div class={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl pointer-events-none ${isCurrentlyQuiet() ? 'bg-[#ff4a4a]/20' : 'bg-[#10b981]/20'}`} />
						
						<div class="flex items-center gap-4 relative z-10">
							<div class={`w-12 h-12 rounded-[16px] flex items-center justify-center shadow-inner border ${isCurrentlyQuiet() ? 'bg-[#ff4a4a]/20 border-[#ff4a4a]/30' : 'bg-[#10b981]/20 border-[#10b981]/30'}`}>
								<span class="material-symbols-outlined text-[24px]">
									{isCurrentlyQuiet() ? 'lock' : 'lock_open'}
								</span>
							</div>
							<div class="flex flex-col gap-0.5">
								<span class="text-[15px] font-black uppercase tracking-tight flex items-center gap-2">
									{isCurrentlyQuiet() ? t('quietHoursSettings.groupLocked') : t('quietHoursSettings.groupActive')}
									<span class={`w-2 h-2 rounded-full animate-pulse ${isCurrentlyQuiet() ? 'bg-[#ff4a4a] shadow-[0_0_8px_#ff4a4a]' : 'bg-[#10b981] shadow-[0_0_8px_#10b981]'}`} />
								</span>
								<span class="text-[11px] opacity-70 font-bold font-mono tracking-tight">
									{t('quietHoursSettings.serverTime')}: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
								</span>
							</div>
						</div>
					</Motion.div>

					{/* ═══════ EMERGENCY LOCK ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
						<div class={`rounded-[24px] p-1.5 border transition-all duration-300 backdrop-blur-xl shadow-sm ${config.emergencyLock ? 'bg-[#ff4a4a]/15 border-[#ff4a4a]/40 shadow-[0_0_20px_rgba(255,74,74,0.15)]' : 'bg-[#12141C]/80 border-white/5'}`}>
							<SettingsSection
								title={t('quietHoursSettings.emergencyLock')}
								description={t('quietHoursSettings.emergencyLockDesc')}
								enabled={config.emergencyLock}
								onToggle={(val) => { setConfig('emergencyLock', val); setIsDirty(true); }}
							/>
						</div>
					</Motion.div>

					{/* ═══════ ADMIN INFO BANNER ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} class="bg-amber-400/10 border border-amber-400/20 rounded-[20px] p-4.5 flex items-start gap-3.5 shadow-sm relative overflow-hidden">
						<div class="w-10 h-10 rounded-[12px] bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
							<span class="material-symbols-outlined text-amber-400 text-[20px]">admin_panel_settings</span>
						</div>
						<div class="flex flex-col relative z-10">
							<span class="text-[14px] font-black text-amber-400 mb-1 tracking-tight">{t('quietHoursSettings.adminOverride')}</span>
							<span class="text-[11px] text-amber-400/70 leading-relaxed font-bold">{t('quietHoursSettings.adminOverrideDesc')}</span>
						</div>
					</Motion.div>

					{/* ═══════ QUIET PERIODS LIST ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} class="flex flex-col gap-3">
						<div class="flex items-center gap-2 px-1 mb-1 border-b border-white/5 pb-2">
							<span class="material-symbols-outlined text-[#3390ec] text-[20px]">schedule</span>
							<h2 class="text-[12px] font-black text-white/60 uppercase tracking-widest">{t('quietHoursSettings.quietPeriods')}</h2>
						</div>

						<For each={config.periods}>
							{(period) => (
								<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[20px] border border-white/5 p-4 flex items-center justify-between shadow-sm hover:border-white/15 transition-colors">
									<div class="flex items-center gap-3">
										<div class="flex flex-col gap-1">
											<span class="text-[9px] font-black uppercase tracking-widest text-white/30 px-1">{t('quietHoursSettings.start')}</span>
											<label>
												<input
													type="time" value={period.start} onChange={(e) => updatePeriod(period.id, 'start', e.currentTarget.value)}
													class="bg-[#08090D] border border-white/10 rounded-[12px] px-3 py-2 text-[14px] text-white font-mono font-bold focus:border-[#3390ec]/50 outline-none shadow-inner transition-colors"
													dir="ltr"
												/>
											</label>
										</div>
										<span class="text-white/20 mt-4 material-symbols-outlined text-[18px]">arrow_forward</span>
										<div class="flex flex-col gap-1">
											<span class="text-[9px] font-black uppercase tracking-widest text-white/30 px-1">{t('quietHoursSettings.end')}</span>
											<label>
												<input
													type="time" value={period.end} onChange={(e) => updatePeriod(period.id, 'end', e.currentTarget.value)}
													class="bg-[#08090D] border border-white/10 rounded-[12px] px-3 py-2 text-[14px] text-white font-mono font-bold focus:border-[#3390ec]/50 outline-none shadow-inner transition-colors"
													dir="ltr"
												/>
											</label>
										</div>
									</div>
									<button onClick={() => removePeriod(period.id)} class="w-10 h-10 rounded-[12px] flex items-center justify-center bg-[#ff4a4a]/10 text-[#ff4a4a] border border-[#ff4a4a]/20 hover:bg-[#ff4a4a] hover:text-white transition-all active:scale-95 mt-4 shadow-sm" aria-label={t('common.delete')}>
										<span class="material-symbols-outlined text-[20px]">delete</span>
									</button>
								</div>
							)}
						</For>
						
						<button onClick={addPeriod} class="w-full h-14 border-2 border-dashed border-white/10 hover:border-[#3390ec]/50 rounded-[20px] text-white/40 hover:text-[#3390ec] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 bg-white/5 hover:bg-[#3390ec]/10 mt-1">
							<span class="material-symbols-outlined text-[22px]">add_circle</span>
							{t('quietHoursSettings.addPeriod')}
						</button>
						
						<Show when={overlapWarning()}>
							<div class="bg-[#ff4a4a]/10 border border-[#ff4a4a]/20 text-[#ff4a4a] rounded-[12px] px-4 py-2.5 text-[11px] font-bold mt-1 flex items-center justify-center gap-2 shadow-sm">
								<span class="material-symbols-outlined text-[16px]">error</span> {overlapWarning()}
							</div>
						</Show>
					</Motion.div>

					{/* ═══════ NOTIFICATIONS ═══════ */}
					<Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} class="mt-2">
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-1.5 shadow-sm">
							<SettingsSection
								title={t('quietHoursSettings.sendMessages')}
								description={t('quietHoursSettings.sendMessagesDesc')}
								enabled={config.sendNotifications}
								onToggle={(val) => { setConfig('sendNotifications', val); setIsDirty(true); }}
								hasEditText={true}
								onEditText={() => navigate(`/group/${params.id}/settings/custom-texts`)}
							/>
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
