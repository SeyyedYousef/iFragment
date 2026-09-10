import { Motion } from '@motionone/solid';
import { backButton } from '@tma.js/sdk-solid';
import { type Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import {
	deleteAccountGDPR,
	profileSettings,
	purgeAllUserCache,
	sessionsApi,
	updateSetting,
} from '@/entities/user/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { audio } from '@/shared/lib/audio.js';
import { haptic } from '@/shared/lib/haptic.js';
import {
	biometric,
	closeMiniApp,
	disableClosingConfirmation,
	showAlert,
	showConfirm,
} from '@/shared/lib/telegram-native.js';

interface SessionItem {
	ip?: string;
	ua?: string;
	created_at?: string;
	user_id?: number;
	username?: string;
}

export const SecurityPage: Component = () => {
	const [biometricsAvailable, setBiometricsAvailable] = createSignal(false);
	const [activeSessionsCount, setActiveSessionsCount] = createSignal<number>(1);
	const [sessionsList, setSessionsList] = createSignal<SessionItem[]>([]);
	const [revokingSessions, setRevokingSessions] = createSignal(false);
	const [isAccountDeleted, setIsAccountDeleted] = createSignal(false);

	const fetchSessions = async () => {
		try {
			const res = await sessionsApi.getSessions();
			if (res && typeof res.active_sessions_count === 'number') {
				setActiveSessionsCount(res.active_sessions_count);
				if (Array.isArray(res.sessions)) {
					setSessionsList(res.sessions);
				}
			}
		} catch {
			// keep default 1
		}
	};

	onMount(async () => {
		backButton.show();
		const off = backButton.onClick(() => {
			try {
				haptic.impact('light');
			} catch {}
			window.history.back();
		});
		onCleanup(() => {
			off();
			try {
				backButton.hide();
			} catch {}
			try {
				disableClosingConfirmation();
			} catch {}
		});

		fetchSessions();

		// Check biometric availability
		try {
			const initResult = await biometric.init();
			if (initResult) {
				setBiometricsAvailable(biometric.isAvailable());
			}
		} catch (e) {
			console.warn('Failed to check biometric availability', e);
		}
	});

	const handleToggleBiometrics = async () => {
		try {
			haptic.impact('medium');
		} catch {}

		if (!biometricsAvailable()) {
			await showAlert(t('security.biometricNotSupported'));
			return;
		}

		const currentVal = profileSettings().biometricEnabled;
		if (!currentVal) {
			const accessGranted = await biometric.requestAccess(
				t('securityPg.biometricAccessReason' as any) || 'Authenticate to enable biometric protection',
			);
			if (accessGranted) {
				const verified = await biometric.authenticate(
					t('securityPg.biometricVerifyReason' as any) || 'Verify biometric sensor',
				);
				if (verified) {
					updateSetting('biometricEnabled', true);
					audio.playSuccess();
					try {
						haptic.notify('success');
					} catch {}
				} else {
					updateSetting('biometricEnabled', false);
					audio.playError();
				}
			} else {
				updateSetting('biometricEnabled', false);
			}
		} else {
			updateSetting('biometricEnabled', false);
			audio.playToggle(false);
		}
	};

	const handleRevokeOtherSessions = async () => {
		try {
			haptic.impact('medium');
		} catch {}

		const confirmed = await showConfirm(t('securityPg.revokeConfirm' as any));
		if (!confirmed) return;

		// Step-up biometric authentication if enabled
		if (profileSettings().biometricEnabled && biometricsAvailable()) {
			const authOk = await biometric.authenticate(
				t('securityPg.biometricChallenge' as any) || 'Confirm session revocation',
			);
			if (!authOk) {
				audio.playError();
				return;
			}
		}

		setRevokingSessions(true);
		try {
			await sessionsApi.revokeAllSessions();
			audio.playSuccess();
			try {
				haptic.notify('success');
			} catch {}
			await showAlert(t('securityPg.revokeSuccess' as any));
			await fetchSessions();
		} catch (e: any) {
			audio.playError();
			try {
				haptic.notify('error');
			} catch {}
			await showAlert(
				t('securityPg.revokeFailed' as any, {
					error: e?.message || t('securityPg.tryAgain' as any),
				}),
			);
		} finally {
			setRevokingSessions(false);
		}
	};

	const handleDeleteAccount = async () => {
		try {
			haptic.notify('warning');
		} catch {}
		const confirmed = await showConfirm(t('security.deleteConfirm'));
		if (!confirmed) return;

		// Step-up biometric challenge if enabled
		if (profileSettings().biometricEnabled && biometricsAvailable()) {
			const authenticated = await biometric.authenticate(
				t('security.deleteBiometricPrompt' as any) || 'Confirm permanent account deletion',
			);
			if (!authenticated) {
				audio.playError();
				return;
			}
		}

		try {
			// 1. Server-side wipe
			await deleteAccountGDPR();

			// 2. Comprehensive local and user cache purge
			purgeAllUserCache();

			audio.playSuccess();
			try {
				haptic.notify('success');
			} catch {}

			// 3. Show Tombstone state
			setIsAccountDeleted(true);
		} catch (e: any) {
			audio.playError();
			try {
				haptic.notify('error');
			} catch {}
			await showAlert(t('security.deleteFailed', { error: e?.message || 'unknown error' }));
		}
	};

	return (
		<div
			class="min-h-screen bg-[#030303] pb-28 text-white font-sans flex flex-col relative overflow-x-hidden selection:bg-[#10b981]/30"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Glow: Security (Green) & Danger (Red) Mix */}
			<div class="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#10b981]/10 via-[#ff4a4a]/5 to-transparent blur-[80px] pointer-events-none z-0" />

			{/* ═══════ PERMANENT DELETION TOMBSTONE ═══════ */}
			<Show when={isAccountDeleted()}>
				<div class="fixed inset-0 bg-[#030303] z-50 flex flex-col items-center justify-center p-6 text-center">
					<div class="w-20 h-20 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] mb-5 shadow-2xl">
						<span class="material-symbols-outlined text-[40px]">check_circle</span>
					</div>
					<h2 class="text-[22px] font-black text-white mb-2 tracking-tight">
						{t('security.deleteSuccessTitle' as any) || 'Account Permanently Deleted'}
					</h2>
					<p class="text-[13px] text-white/60 max-w-sm mb-8 leading-relaxed">
						{t('security.deleteSuccessDesc' as any) ||
							'All your user records, database entries, watchlists, and local caches have been permanently purged.'}
					</p>
					<button
						type="button"
						onClick={closeMiniApp}
						class="w-full max-w-xs h-12 bg-white text-black font-black text-[14px] rounded-[16px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
					>
						<span>{t('common.close' as any) || 'Close Telegram App'}</span>
						<span class="material-symbols-outlined text-[18px]">close</span>
					</button>
				</div>
			</Show>

			{/* ═══════ PREMIUM STICKY HEADER ═══════ */}
			<div class="pt-6 pb-4 px-5 sticky top-0 bg-[#030303]/85 backdrop-blur-2xl z-40 border-b border-white/5 flex items-center gap-3.5 shadow-sm">
				<button
					type="button"
					onClick={() => {
						try {
							haptic.impact('light');
						} catch {}
						window.history.back();
					}}
					class="w-11 h-11 rounded-[14px] bg-[#12141C]/80 flex items-center justify-center border border-white/10 hover:bg-white/10 active:scale-95 transition-all shrink-0 shadow-sm text-white/80"
					aria-label={t('common.back')}
				>
					<span class="material-symbols-outlined text-[22px] rtl:-scale-x-100">arrow_back</span>
				</button>
				<div class="flex flex-col gap-0.5 min-w-0">
					<h1 class="text-[18px] font-black text-white leading-tight tracking-tight">
						{t('security.title')}
					</h1>
					<span class="text-[11px] font-bold text-white/50 uppercase tracking-wider truncate">
						{t('security.subtitle')}
					</span>
				</div>
			</div>

			<div class="flex-1 w-full max-w-md mx-auto relative z-10 flex flex-col px-5 pt-6 gap-6">
				{/* ═══════ SESSIONS MANAGEMENT ═══════ */}
				<Motion.div
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.03 }}
					class="flex flex-col gap-3"
				>
					<h2 class="text-[11px] font-black text-white/40 uppercase tracking-widest px-2 flex items-center gap-2">
						<span class="material-symbols-outlined text-[16px] text-white/30">devices</span>
						{t('securityPg.sessionsHeading' as any)}
					</h2>

					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
						<div class="flex items-center justify-between relative z-10">
							<div class="flex flex-col gap-1">
								<div class="flex items-center gap-2">
									<span class="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
									<span class="text-[14px] font-black text-white">
										{t('securityPg.currentDevice' as any)}
									</span>
								</div>
								<span class="text-[11px] font-medium text-white/50">
									{t('securityPg.tokenDesc' as any)}
								</span>
							</div>
							<span class="px-2.5 py-1 rounded-full bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 text-[10px] font-black">
								{t('securityPg.activeBadge' as any)}
							</span>
						</div>

						{/* Sessions Detail List */}
						<Show when={sessionsList().length > 0}>
							<div class="flex flex-col gap-2 pt-2 border-t border-white/5">
								<span class="text-[10px] font-bold text-white/40 uppercase tracking-wider">
									{t('securityPg.activeDevices' as any) || 'Connected Sessions'}
								</span>
								<For each={sessionsList()}>
									{(session) => (
										<div class="p-2.5 rounded-[14px] bg-[#08090D] border border-white/5 flex items-center justify-between text-[11px]">
											<div class="flex flex-col gap-0.5">
												<span class="font-bold text-white truncate max-w-[200px]">
													{session.ua || 'Telegram Client'}
												</span>
												<span class="text-[10px] text-white/40 font-mono">
													{session.ip || 'Unknown IP'} ·{' '}
													{session.created_at
														? new Date(session.created_at).toLocaleDateString()
														: 'Active'}
												</span>
											</div>
											<span class="text-[10px] px-2 py-0.5 rounded-[6px] bg-white/5 text-white/60">
												{t('securityPg.online' as any) || 'Online'}
											</span>
										</div>
									)}
								</For>
							</div>
						</Show>

						<div class="pt-2 border-t border-white/5 flex items-center justify-between">
							<span class="text-[11px] text-white/60 font-bold">
								{t('securityPg.totalSessions' as any)}{' '}
								<span class="text-white font-mono">{activeSessionsCount()}</span>
							</span>
							<button
								type="button"
								onClick={handleRevokeOtherSessions}
								disabled={revokingSessions() || activeSessionsCount() <= 1}
								class="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[10px] font-black transition-all cursor-pointer disabled:opacity-40"
							>
								{revokingSessions()
									? t('securityPg.revoking' as any)
									: t('securityPg.revokeOtherBtn' as any)}
							</button>
						</div>
					</div>
				</Motion.div>

				{/* ═══════ BIOMETRICS SECTION ═══════ */}
				<Motion.div
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.05 }}
					class="flex flex-col gap-3"
				>
					<h2 class="text-[11px] font-black text-white/40 uppercase tracking-widest px-2 flex items-center gap-2">
						<span class="material-symbols-outlined text-[16px] text-white/30">fingerprint</span>
						{t('security.biometricTitle')}
					</h2>

					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-white/5 rounded-[24px] p-5 flex flex-col gap-4 shadow-sm relative overflow-hidden">
						<div class="absolute -right-6 -top-6 w-24 h-24 bg-[#10b981]/10 blur-2xl rounded-full pointer-events-none" />

						<div class="flex items-center justify-between relative z-10">
							<div class="flex flex-col gap-1 flex-1 pr-4">
								<span class="text-[15px] font-black text-white tracking-tight">
									{t('security.biometricLock')}
								</span>
								<span class="text-[11px] font-medium text-white/50 leading-relaxed">
									{t('security.biometricDesc')}
								</span>
							</div>

							<button
								type="button"
								role="switch"
								aria-checked={profileSettings().biometricEnabled}
								aria-label={t('security.biometricLock')}
								disabled={!biometricsAvailable()}
								onClick={handleToggleBiometrics}
								class={`w-12 h-7 rounded-full relative transition-colors duration-300 shadow-inner shrink-0 ${
									profileSettings().biometricEnabled ? 'bg-[#10b981]' : 'bg-white/10'
								} ${!biometricsAvailable() ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
							>
								<div
									class={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${profileSettings().biometricEnabled ? 'translate-x-5' : 'translate-x-0'}`}
								/>
							</button>
						</div>

						<Show when={!biometricsAvailable()}>
							<div class="bg-amber-400/10 border border-amber-400/20 rounded-[16px] p-3 flex items-center gap-3 relative z-10 shadow-inner mt-1">
								<span class="material-symbols-outlined text-amber-400 text-[18px]">warning</span>
								<span class="text-[11px] font-bold text-amber-400/90 leading-snug">
									{t('security.biometricNotSupported')}
								</span>
							</div>
						</Show>
					</div>
				</Motion.div>

				{/* ═══════ DANGER ZONE ═══════ */}
				<Motion.div
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					class="flex flex-col gap-3 mt-2"
				>
					<h2 class="text-[11px] font-black text-[#ff4a4a]/60 uppercase tracking-widest px-2 flex items-center gap-2">
						<span class="material-symbols-outlined text-[16px] text-[#ff4a4a]/40">warning</span>
						{t('security.dangerZone')}
					</h2>

					<div class="bg-[#12141C]/80 backdrop-blur-xl border border-[#ff4a4a]/20 rounded-[24px] p-5 flex flex-col gap-5 shadow-sm relative overflow-hidden">
						<div class="absolute -left-6 -bottom-6 w-32 h-32 bg-[#ff4a4a]/10 blur-3xl rounded-full pointer-events-none" />

						<div class="flex items-start gap-3.5 relative z-10">
							<div class="w-10 h-10 rounded-[12px] bg-[#ff4a4a]/15 flex items-center justify-center border border-[#ff4a4a]/30 shadow-inner shrink-0 mt-0.5">
								<span class="material-symbols-outlined text-[#ff4a4a] text-[20px] drop-shadow-md">
									delete_forever
								</span>
							</div>
							<div class="flex flex-col gap-1">
								<span class="text-[15px] font-black text-[#ff4a4a] tracking-tight">
									{t('security.deleteAccount')}
								</span>
								<span class="text-[11px] font-medium text-white/50 leading-relaxed">
									{t('security.deleteDesc')}
								</span>
							</div>
						</div>

						<button
							type="button"
							onClick={handleDeleteAccount}
							class="w-full h-14 bg-[#ff4a4a]/10 hover:bg-[#ff4a4a] border border-[#ff4a4a]/30 text-[#ff4a4a] hover:text-white font-black text-[13px] uppercase tracking-widest rounded-[16px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm relative z-10 cursor-pointer"
						>
							<span class="material-symbols-outlined text-[20px]">warning</span>
							{t('security.deleteAccount')}
						</button>
					</div>
				</Motion.div>
			</div>
		</div>
	);
};
