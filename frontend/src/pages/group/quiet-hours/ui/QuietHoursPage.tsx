import { Motion } from '@motionone/solid';
import { useNavigate, useParams } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import {
	type Component,
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
import { haptic } from '@/shared/lib/haptic.js';
import { HamburgerMenu } from '@/shared/ui/hamburger-menu.js';
import { SettingsGuard } from '@/shared/ui/SettingsGuard.js';
import { SettingsSection } from '@/shared/ui/settings-controls.js';
import { showToast } from '@/shared/ui/toast.js';

interface QuietPeriod {
	id: string;
	start: string;
	end: string;
}
interface QuietHoursConfig {
	emergencyLock: boolean;
	adminOverride: boolean;
	sendNotifications: boolean;
	periods: QuietPeriod[];
}

const defaultConfig: QuietHoursConfig = {
	emergencyLock: false,
	adminOverride: true,
	sendNotifications: true,
	periods: [],
};

export const QuietHoursPage: Component = () => {
	const navigate = useNavigate();
	const params = useParams();

	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isSaving, setIsSaving] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [showUnsavedSheet, setShowUnsavedSheet] = createSignal(false);
	const [settingsVersion, setSettingsVersion] = createSignal(1);
	const [overlapWarning, setOverlapWarning] = createSignal('');
	const [timezone, setTimezone] = createSignal('UTC');
	const [currentTimeStr, setCurrentTimeStr] = createSignal('');

	const [config, setConfig] = createStore<QuietHoursConfig>({ ...defaultConfig });
	const [initialConfig, setInitialConfig] = createSignal<QuietHoursConfig>({ ...defaultConfig });

	const updateClock = () => {
		try {
			const formatter = new Intl.DateTimeFormat('en-GB', {
				timeZone: timezone() || 'UTC',
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			});
			setCurrentTimeStr(formatter.format(new Date()));
		} catch {
			const now = new Date();
			setCurrentTimeStr(
				`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
			);
		}
	};

	const [_] = createResource(
		() => params.id,
		async (groupId) => {
			const data = await groupApi.getSettings(groupId);
			setSettingsVersion(data.version);
			const gen = (data.general || {}) as any;
			if (gen.timezone) {
				setTimezone(gen.timezone);
			}
			updateClock();
			const qh = (data.quiet_hours || {}) as Partial<QuietHoursConfig>;
			const merged = { ...defaultConfig, ...qh };
			setInitialConfig(merged);
			setConfig(reconcile(merged));
			setIsDirty(false);
			return data;
		},
	);

	const clockTimer = setInterval(updateClock, 10000);
	onCleanup(() => clearInterval(clockTimer));

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
			else if (start > end)
				return [
					{ start, end: 1440 },
					{ start: 0, end },
				];
			else return [{ start: 0, end: 1440 }];
		};

		const isOverlap = (
			i1: { start: number; end: number },
			i2: { start: number; end: number },
		): boolean => {
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
		const nowStr = currentTimeStr();
		if (!nowStr) return false;
		return config.periods.some((p) => isTimeInPeriod(nowStr, p.start, p.end));
	};

	const addPeriod = () => {
		haptic.impact('medium');
		const newPeriod: QuietPeriod = { id: crypto.randomUUID(), start: '22:00', end: '08:00' };
		setConfig('periods', [...config.periods, newPeriod]);
		setIsDirty(true);
		checkOverlaps([...config.periods, newPeriod]);
	};

	const removePeriod = (id: string) => {
		haptic.impact('medium');
		const filtered = config.periods.filter((p) => p.id !== id);
		setConfig('periods', filtered);
		setIsDirty(true);
		checkOverlaps(filtered);
	};

	const updatePeriod = (id: string, field: 'start' | 'end', val: string) => {
		const updated = config.periods.map((p) => (p.id === id ? { ...p, [field]: val } : p));
		setConfig('periods', updated);
		setIsDirty(true);
		checkOverlaps(updated);
	};

	const handleSave = async () => {
		if (!isDirty() || isSaving()) return;
		setIsSaving(true);
		try {
			const res = await groupApi.updateSettings(
				params.id,
				'quiet_hours',
				config as any,
				settingsVersion(),
			);
			setSettingsVersion(res.version);
			setInitialConfig({ ...config });
			setIsDirty(false);
			setShowUnsavedSheet(false);
			haptic.notify('success');
			showToast(t('common.settingsSaved'), 'success');
			navigate(`/group/${params.id}`);
		} catch (_e: any) {
			haptic.notify('error');
			showToast(t('common.errorUpdateFailed'), 'error');
		} finally {
			setIsSaving(false);
		}
	};

	const handleDiscard = () => {
		setConfig(reconcile({ ...initialConfig() }));
		setIsDirty(false);
		setShowUnsavedSheet(false);
		window.history.back();
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 relative overflow-x-hidden text-white font-sans selection:bg-[#3390ec]/30"
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
								{t('quietHoursSettings.title')}
							</h1>
							<Show when={isDirty()}>
								<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
							</Show>
						</div>
						<span class="text-[11px] text-white/50 font-bold uppercase tracking-wider leading-snug truncate mt-0.5">
							{t('quietHoursSettings.description')}
						</span>
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
				activeTab="quiet"
			/>

			<Suspense
				fallback={
					<div class="p-8 flex justify-center">
						<div class="w-8 h-8 border-2 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
					</div>
				}
			>
				<div class="p-5 flex flex-col gap-5 max-w-md mx-auto relative z-10 w-full">
					{/* ═══════ CURRENT STATUS HERO BANNER ═══════ */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
					>
						<div
							class={`rounded-[24px] p-5 border flex items-center gap-4.5 relative overflow-hidden backdrop-blur-xl shadow-sm ${isCurrentlyQuiet() ? 'bg-gradient-to-r from-[#ff4a4a]/20 to-[#12141C]/80 border-[#ff4a4a]/30' : 'bg-gradient-to-r from-[#10b981]/20 to-[#12141C]/80 border-[#10b981]/30'}`}
						>
							<div
								class={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 border shadow-inner ${isCurrentlyQuiet() ? 'bg-[#ff4a4a]/20 border-[#ff4a4a]/40 text-[#ff4a4a]' : 'bg-[#10b981]/20 border-[#10b981]/40 text-[#10b981]'}`}
							>
								<span class="material-symbols-outlined text-[26px]">
									{isCurrentlyQuiet() ? 'lock' : 'lock_open'}
								</span>
							</div>
							<div class="flex flex-col gap-0.5 flex-1">
								<span class="text-[15px] font-black uppercase tracking-tight flex items-center gap-2">
									{isCurrentlyQuiet()
										? t('quietHoursSettings.groupLocked')
										: t('quietHoursSettings.groupActive')}
									<span
										class={`w-2 h-2 rounded-full animate-pulse ${isCurrentlyQuiet() ? 'bg-[#ff4a4a] shadow-[0_0_8px_#ff4a4a]' : 'bg-[#10b981] shadow-[0_0_8px_#10b981]'}`}
									/>
								</span>
								<div class="flex items-center justify-between text-[11px] opacity-70 font-bold font-mono tracking-tight pt-0.5">
									<span>
										{t('quietHoursSettings.serverTime')}: {currentTimeStr()}
									</span>
									<span class="text-[10px] text-white/40">{timezone()}</span>
								</div>
							</div>
						</div>
					</Motion.div>

					{/* ═══════ EMERGENCY LOCK ═══════ */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.15 }}
					>
						<div
							class={`rounded-[24px] p-1.5 border transition-all duration-300 backdrop-blur-xl shadow-sm ${config.emergencyLock ? 'bg-[#ff4a4a]/15 border-[#ff4a4a]/40 shadow-[0_0_20px_rgba(255,74,74,0.15)]' : 'bg-[#12141C]/80 border-white/5'}`}
						>
							<SettingsSection
								title={t('quietHoursSettings.emergencyLock')}
								description={t('quietHoursSettings.emergencyLockDesc')}
								enabled={config.emergencyLock}
								onToggle={(val) => {
									setConfig('emergencyLock', val);
									setIsDirty(true);
								}}
							/>
						</div>
					</Motion.div>

					{/* ═══════ ADMIN INFO BANNER ═══════ */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						class="bg-amber-400/10 border border-amber-400/20 rounded-[20px] p-4.5 flex items-start gap-3.5 shadow-sm relative overflow-hidden"
					>
						<div class="w-10 h-10 rounded-[12px] bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
							<span class="material-symbols-outlined text-amber-400 text-[20px]">
								admin_panel_settings
							</span>
						</div>
						<div class="flex flex-col relative z-10">
							<span class="text-[14px] font-black text-amber-400 mb-1 tracking-tight">
								{t('quietHoursSettings.adminOverride')}
							</span>
							<span class="text-[11px] text-amber-400/70 leading-relaxed font-bold">
								{t('quietHoursSettings.adminOverrideDesc')}
							</span>
						</div>
					</Motion.div>

					{/* ═══════ QUIET PERIODS LIST ═══════ */}
					<Motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.25 }}
						class="flex flex-col gap-3"
					>
						<div class="flex items-center gap-2 px-1 mb-1 border-b border-white/5 pb-2">
							<span class="material-symbols-outlined text-[#3390ec] text-[20px]">schedule</span>
							<h2 class="text-[12px] font-black text-white/60 uppercase tracking-widest">
								{t('quietHoursSettings.quietPeriods')}
							</h2>
						</div>

						<For each={config.periods}>
							{(period) => (
								<div class="bg-[#12141C]/80 backdrop-blur-xl rounded-[20px] border border-white/5 p-4 flex items-center justify-between shadow-sm hover:border-white/15 transition-colors">
									<div class="flex items-center gap-3">
										<div class="flex flex-col gap-1">
											<span class="text-[9px] font-black uppercase tracking-widest text-white/30 px-1">
												{t('quietHoursSettings.start')}
											</span>
											<div>
												<input
													type="time"
													value={period.start}
													onChange={(e) => updatePeriod(period.id, 'start', e.currentTarget.value)}
													class="bg-[#08090D] border border-white/10 rounded-[12px] px-3 py-2 text-[14px] text-white font-mono font-bold focus:border-[#3390ec]/50 outline-none shadow-inner transition-colors"
													dir="ltr"
												/>
											</div>
										</div>
										<span class="text-white/20 mt-4 material-symbols-outlined text-[18px]">
											arrow_forward
										</span>
										<div class="flex flex-col gap-1">
											<span class="text-[9px] font-black uppercase tracking-widest text-white/30 px-1">
												{t('quietHoursSettings.end')}
											</span>
											<div>
												<input
													type="time"
													value={period.end}
													onChange={(e) => updatePeriod(period.id, 'end', e.currentTarget.value)}
													class="bg-[#08090D] border border-white/10 rounded-[12px] px-3 py-2 text-[14px] text-white font-mono font-bold focus:border-[#3390ec]/50 outline-none shadow-inner transition-colors"
													dir="ltr"
												/>
											</div>
										</div>
									</div>
									<button
										type="button"
										onClick={() => removePeriod(period.id)}
										class="w-10 h-10 rounded-[12px] flex items-center justify-center bg-[#ff4a4a]/10 text-[#ff4a4a] border border-[#ff4a4a]/20 hover:bg-[#ff4a4a] hover:text-white transition-all active:scale-95 mt-4 shadow-sm"
										aria-label={t('common.delete')}
									>
										<span class="material-symbols-outlined text-[20px]">delete</span>
									</button>
								</div>
							)}
						</For>

						<button
							type="button"
							onClick={addPeriod}
							class="w-full h-14 border-2 border-dashed border-white/10 hover:border-[#3390ec]/50 rounded-[20px] text-white/40 hover:text-[#3390ec] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 bg-white/5 hover:bg-[#3390ec]/10 mt-1"
						>
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
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.3 }}
						class="mt-2"
					>
						<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-1.5 shadow-sm">
							<SettingsSection
								title={t('quietHoursSettings.sendMessages')}
								description={t('quietHoursSettings.sendMessagesDesc')}
								enabled={config.sendNotifications}
								onToggle={(val) => {
									setConfig('sendNotifications', val);
									setIsDirty(true);
								}}
								hasEditText={true}
								onEditText={() => navigate(`/group/${params.id}/settings/custom-texts`)}
							/>
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
