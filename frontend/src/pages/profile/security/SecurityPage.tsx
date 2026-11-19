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
		} catch {}
	};

	onMount(async () => {
		try {
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
		} catch {}

		fetchSessions();

		try {
			const initResult = await biometric.init();
			if (initResult) {
				setBiometricsAvailable(biometric.isAvailable());
			}
		} catch {}
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
				t('securityPg.biometricAccessReason' as any) ||
					'Authenticate to enable biometric protection',
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
			await deleteAccountGDPR();
			purgeAllUserCache();
			audio.playSuccess();
			try {
				haptic.notify('success');
			} catch {}
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
			class="frag-canvas min-h-screen pb-28 text-white font-frag-sans flex flex-col relative overflow-x-hidden"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			<Show when={isAccountDeleted()}>
				<div class="fixed inset-0 bg-[#1a2026] z-50 flex flex-col items-center justify-center p-6 text-center">
					<span class="material-symbols-outlined text-[40px] text-[#5aec8c] mb-3">
						check_circle
					</span>
					<h2 class="text-[20px] font-bold text-white mb-2">
						{t('security.deleteSuccessTitle' as any) || 'Account Permanently Deleted'}
					</h2>
					<p class="text-[13px] text-[#8794a1] max-w-sm mb-6 leading-relaxed">
						{t('security.deleteSuccessDesc' as any) ||
							'All your user records, watchlists, and local caches have been permanently purged.'}
					</p>
					<button
						type="button"
						onClick={closeMiniApp}
						class="frag-btn-primary w-full max-w-xs h-11 font-semibold text-[13.5px] cursor-pointer"
					>
						{t('common.close' as any) || 'Close Telegram App'}
					</button>
				</div>
			</Show>

			{/* Sticky Fragment Header */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center gap-3">
				<button
					type="button"
					onClick={() => window.history.back()}
					class="w-8 h-8 rounded-[6px] bg-[#242e38] hover:bg-[#293440] flex items-center justify-center text-white shrink-0 cursor-pointer"
					aria-label={t('common.back')}
				>
					<span class="material-symbols-outlined text-[18px] rtl:-scale-x-100">arrow_back</span>
				</button>
				<div class="flex flex-col min-w-0">
					<h1 class="text-[16px] font-bold text-white leading-tight truncate">
						{t('security.title')}
					</h1>
					<span class="text-[11px] text-[#8c9aa9] truncate">{t('security.subtitle')}</span>
				</div>
			</header>

			<div class="flex-1 w-full max-w-[480px] mx-auto relative z-10 flex flex-col px-4 pt-5 gap-5">
				{/* Active Sessions Table */}
				<div class="flex flex-col gap-2">
					<h2 class="text-[13px] font-semibold text-[#8c9aa9] px-0.5">
						{t('securityPg.sessionsHeading' as any)}
					</h2>

					<div class="frag-table-container">
						<div class="frag-table-row px-3.5 py-3 flex items-center justify-between gap-3">
							<div class="flex flex-col gap-0.5">
								<span class="text-[13.5px] font-semibold text-white">
									{t('securityPg.currentDevice' as any)}
								</span>
								<span class="text-[11.5px] text-[#8794a1]">{t('securityPg.tokenDesc' as any)}</span>
							</div>
							<span class="px-2 py-0.5 rounded-[4px] bg-[#5aec8c]/10 text-[#5aec8c] text-[11px] font-semibold">
								{t('securityPg.activeBadge' as any)}
							</span>
						</div>

						<For each={sessionsList()}>
							{(session) => (
								<div class="frag-table-row px-3.5 py-2.5 flex items-center justify-between text-[12px]">
									<div class="flex flex-col min-w-0">
										<span class="font-semibold text-white truncate max-w-[220px]">
											{session.ua || 'Telegram Client'}
										</span>
										<span class="text-[11px] text-[#8c9aa9] font-mono">
											{session.ip || 'IP'} ·{' '}
											{session.created_at
												? new Date(session.created_at).toLocaleDateString()
												: 'Active'}
										</span>
									</div>
									<span class="text-[11px] text-[#5aec8c]">
										{t('securityPg.online' as any) || 'Online'}
									</span>
								</div>
							)}
						</For>

						<div class="frag-table-row px-3.5 py-2.5 flex items-center justify-between">
							<span class="text-[12px] text-[#8c9aa9]">
								{t('securityPg.totalSessions' as any)}{' '}
								<strong class="text-white font-mono">{activeSessionsCount()}</strong>
							</span>
							<button
								type="button"
								onClick={handleRevokeOtherSessions}
								disabled={revokingSessions() || activeSessionsCount() <= 1}
								class="px-2.5 py-1 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-[#ff9953] text-[11.5px] font-semibold disabled:opacity-40 cursor-pointer"
							>
								{revokingSessions()
									? t('securityPg.revoking' as any)
									: t('securityPg.revokeOtherBtn' as any)}
							</button>
						</div>
					</div>
				</div>

				{/* Biometric Protection */}
				<div class="flex flex-col gap-2">
					<h2 class="text-[13px] font-semibold text-[#8c9aa9] px-0.5">
						{t('security.biometricTitle')}
					</h2>

					<div class="frag-table-container">
						<div class="frag-table-row px-3.5 py-3 flex items-center justify-between gap-4">
							<div class="flex flex-col gap-0.5 flex-1">
								<span class="text-[13.5px] font-semibold text-white">
									{t('security.biometricLock')}
								</span>
								<span class="text-[11.5px] text-[#8794a1] leading-snug">
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
								class={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
									profileSettings().biometricEnabled ? 'bg-[#248bda]' : 'bg-[#242e38]'
								} ${!biometricsAvailable() ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
							>
								<div
									class={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
										profileSettings().biometricEnabled ? 'translate-x-5' : 'translate-x-0'
									}`}
								/>
							</button>
						</div>

						<Show when={!biometricsAvailable()}>
							<div class="frag-table-row px-3.5 py-2.5 text-[11.5px] text-[#ff9953]">
								{t('security.biometricNotSupported')}
							</div>
						</Show>
					</div>
				</div>

				{/* Danger Zone */}
				<div class="flex flex-col gap-2">
					<h2 class="text-[13px] font-semibold text-[#ff5863] px-0.5">
						{t('security.dangerZone')}
					</h2>

					<div class="frag-table-container">
						<div class="p-3.5 space-y-3">
							<div>
								<span class="text-[13.5px] font-semibold text-white block">
									{t('security.deleteAccount')}
								</span>
								<span class="text-[12px] text-[#8794a1] block mt-0.5 leading-snug">
									{t('security.deleteDesc')}
								</span>
							</div>

							<button
								type="button"
								onClick={handleDeleteAccount}
								class="w-full h-10 bg-[#ff5863]/10 hover:bg-[#ff5863]/20 text-[#ff5863] font-semibold text-[13px] rounded-[8px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
							>
								<span class="material-symbols-outlined text-[17px]">delete_forever</span>
								<span>{t('security.deleteAccount')}</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
