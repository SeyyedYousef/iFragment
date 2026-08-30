import { useNavigate } from '@solidjs/router';
import { retrieveLaunchParams } from '@tma.js/sdk-solid';
import { type Component, createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { ownerApi } from '../../entities/owner/api/ownerApi.js';
import { t } from '../../shared/i18n/index.js';
import { haptic } from '../../shared/lib/haptic.js';

interface OwnerGateModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export const OwnerGateModal: Component<OwnerGateModalProps> = (props) => {
	const navigate = useNavigate();
	const [step, setStep] = createSignal<'password' | 'mfa'>('password');
	const [password, setPassword] = createSignal('');
	const [showPassword, setShowPassword] = createSignal(false);
	const [totpCode, setTotpCode] = createSignal('');
	const [tempToken, setTempToken] = createSignal('');
	const [errorMsg, setErrorMsg] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	const [manualTgId, setManualTgId] = createSignal('');
	const [showManualTgInput, setShowManualTgInput] = createSignal(false);
	let passwordInputRef: HTMLInputElement | undefined;
	let totpInputRef: HTMLInputElement | undefined;

	const getDetectedTelegramId = (): number => {
		try {
			const tg = (window as any).Telegram?.WebApp;
			if (tg?.initDataUnsafe?.user?.id) return tg.initDataUnsafe.user.id;
		} catch (_e) {}

		try {
			const lp = retrieveLaunchParams();
			if ((lp.initData as any)?.user?.id) return (lp.initData as any).user.id;
		} catch (_e) {}

		try {
			const sessionCached = sessionStorage.getItem('cached_tg_init_data_user_id');
			if (sessionCached) {
				const parsed = parseInt(sessionCached, 10);
				if (!isNaN(parsed) && parsed > 0) return parsed;
			}
		} catch (_e) {}

		const savedId = localStorage.getItem('owner_telegram_id') || localStorage.getItem('tg_user_id');
		if (savedId) {
			const parsed = parseInt(savedId, 10);
			if (!isNaN(parsed) && parsed > 0) return parsed;
		}

		return 0;
	};

	const mapErrorMessage = (rawError: string): string => {
		if (!rawError) return t('ownerGate.errorAuth');
		const lower = rawError.toLowerCase();
		if (lower.includes('invalid password')) {
			return t('ownerGate.errorInvalidPassword');
		}
		if (lower.includes('not registered') || lower.includes('not allowed') || lower.includes('unauthorized')) {
			return t('ownerGate.errorNotRegistered');
		}
		if (lower.includes('too many') || lower.includes('locked')) {
			return t('ownerGate.errorRateLimited');
		}
		if (lower.includes('not configured') || lower.includes('missing owner_password') || lower.includes('missing owner_telegram_ids')) {
			return t('ownerGate.errorServerConfig');
		}
		if (lower.includes('totp') || lower.includes('recovery code')) {
			return t('ownerGate.errorInvalidTotp');
		}
		return rawError;
	};

	createEffect(() => {
		if (props.isOpen) {
			setErrorMsg('');
			setPassword('');
			setShowPassword(false);
			setTotpCode('');
			setTempToken('');
			setStep('password');

			const detected = getDetectedTelegramId();
			if (detected) {
				setManualTgId(String(detected));
				setShowManualTgInput(false);
			} else {
				setManualTgId('');
				setShowManualTgInput(true);
			}

			setTimeout(() => passwordInputRef?.focus(), 80);
		}
	});

	const handleGlobalKeyDown = (e: KeyboardEvent) => {
		if (!props.isOpen) return;
		if (e.key === 'Escape') {
			props.onClose();
		}
	};

	if (typeof window !== 'undefined') {
		window.addEventListener('keydown', handleGlobalKeyDown);
		onCleanup(() => window.removeEventListener('keydown', handleGlobalKeyDown));
	}

	const handlePasswordSubmit = async () => {
		if (loading() || !password()) return;
		setErrorMsg('');
		setLoading(true);

		try {
			haptic.impact('medium');
		} catch {}

		let tgUserId = getDetectedTelegramId();
		if (!tgUserId && manualTgId().trim()) {
			const parsed = parseInt(manualTgId().trim(), 10);
			if (!isNaN(parsed) && parsed > 0) {
				tgUserId = parsed;
			}
		}

		if (!tgUserId) {
			setShowManualTgInput(true);
			setErrorMsg(t('ownerGate.errorNoTgId'));
			setLoading(false);
			return;
		}

		try {
			const res = await ownerApi.login(password(), tgUserId);

			if (res.mfa_required && res.temp_token) {
				setTempToken(res.temp_token);
				setStep('mfa');
				setTimeout(() => totpInputRef?.focus(), 80);
			} else if (res.token) {
				sessionStorage.setItem('owner_token', res.token);
				sessionStorage.setItem('owner_telegram_id', String(tgUserId));
				localStorage.setItem('owner_telegram_id', String(tgUserId));
				localStorage.setItem('tg_user_id', String(tgUserId));
				try {
					haptic.notify('success');
				} catch {}
				props.onClose();
				navigate('/owner/dashboard');
			}
		} catch (err: any) {
			try {
				haptic.notify('error');
			} catch {}
			const rawErr = err.response?.data?.error;
			setErrorMsg(mapErrorMessage(rawErr));
			setPassword('');
			passwordInputRef?.focus();
		} finally {
			setLoading(false);
		}
	};

	const handleMfaSubmit = async () => {
		if (loading() || !totpCode()) return;
		setErrorMsg('');
		setLoading(true);

		try {
			const res = await ownerApi.verifyTotp(tempToken(), totpCode().trim());
			if (res.token) {
				sessionStorage.setItem('owner_token', res.token);
				try {
					haptic.notify('success');
				} catch {}
				props.onClose();
				navigate('/owner/dashboard');
			}
		} catch (err: any) {
			try {
				haptic.notify('error');
			} catch {}
			const rawErr = err.response?.data?.error;
			setErrorMsg(rawErr ? mapErrorMessage(rawErr) : t('ownerGate.errorInvalidTotp'));
			setTotpCode('');
			totpInputRef?.focus();
		} finally {
			setLoading(false);
		}
	};

	return (
		<Show when={props.isOpen}>
			<div
				role="button"
				tabIndex={0}
				onKeyDown={(e) => {
					if (e.key === 'Escape') props.onClose();
				}}
				onClick={(e) => {
					if (e.target === e.currentTarget) props.onClose();
				}}
				class="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-fade-in"
			>
				<div
					role="dialog"
					aria-modal="true"
					class="w-full max-w-sm max-h-[90vh] overflow-y-auto no-scrollbar bg-gradient-to-b from-[#181920] via-[#121318] to-[#0b0c10] border border-amber-500/25 rounded-[32px] p-6 shadow-[0_0_50px_rgba(245,158,11,0.12)] relative text-white"
					onClick={(e) => e.stopPropagation()}
				>
					{/* Close button */}
					<button
						type="button"
						onClick={props.onClose}
						aria-label={t('ownerGate.close')}
						class="absolute top-5 end-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center border border-white/10 transition-all text-white/70 hover:text-white"
					>
						<span class="material-symbols-outlined text-[18px]">close</span>
					</button>

					{/* Icon Header */}
					<div class="flex flex-col items-center text-center mt-2 mb-5">
						<div class="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
							<span class="material-symbols-outlined text-[32px] text-amber-400 select-none">
								{step() === 'mfa' ? 'lock_clock' : 'admin_panel_settings'}
							</span>
							<div class="absolute -top-1 -end-1 w-3 h-3 rounded-full bg-amber-400 animate-ping opacity-75" />
							<div class="absolute -top-1 -end-1 w-3 h-3 rounded-full bg-amber-400" />
						</div>
						<h2 class="text-base sm:text-lg font-black uppercase tracking-wider text-white">
							{step() === 'mfa' ? t('ownerGate.mfaTitle') : t('ownerGate.title')}
						</h2>
						<p class="text-xs text-white/60 font-medium mt-1.5 max-w-[260px] leading-relaxed">
							{step() === 'mfa' ? t('ownerGate.mfaDesc') : t('ownerGate.desc')}
						</p>
					</div>

					{/* Step 1: Master Password */}
					<Show when={step() === 'password'}>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								handlePasswordSubmit();
							}}
							class="space-y-4"
						>
							<Show when={showManualTgInput()}>
								<div class="space-y-1.5">
									<div class="flex items-center justify-between">
										<label class="block text-[11px] font-bold text-white/70 uppercase tracking-wider">
											{t('ownerGate.telegramUserId')}
										</label>
										<span class="text-[9px] font-bold text-amber-400/80 uppercase px-2 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/20">
											{t('ownerGate.browserModeBadge')}
										</span>
									</div>
									<input
										type="text"
										inputMode="numeric"
										placeholder={t('ownerGate.telegramUserIdPlaceholder')}
										value={manualTgId()}
										onInput={(e) => setManualTgId(e.currentTarget.value)}
										class="w-full h-12 px-4 bg-[#0a0b0f] border border-white/15 focus:border-amber-400 text-white text-sm rounded-2xl shadow-inner focus:outline-none transition-all placeholder:text-white/25 font-mono"
										disabled={loading()}
									/>
								</div>
							</Show>

							{/* Password Input with Visibility Toggle */}
							<div class="relative">
								<input
									type={showPassword() ? 'text' : 'password'}
									placeholder={t('ownerGate.securityPasswordPlaceholder')}
									value={password()}
									ref={passwordInputRef}
									onInput={(e) => setPassword(e.currentTarget.value)}
									class="w-full h-14 ps-4 pe-12 bg-[#0a0b0f] border border-white/15 focus:border-amber-400 text-white text-base rounded-2xl shadow-inner focus:outline-none transition-all placeholder:text-white/30"
									disabled={loading()}
									autoComplete="current-password"
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword())}
									aria-label={showPassword() ? t('ownerGate.hidePassword') : t('ownerGate.showPassword')}
									class="absolute end-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white active:scale-95 transition-all"
									tabIndex={-1}
								>
									<span class="material-symbols-outlined text-[20px]">
										{showPassword() ? 'visibility_off' : 'visibility'}
									</span>
								</button>
							</div>

							{/* Error Message */}
							<Show when={errorMsg()}>
								<div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 animate-shake">
									<span class="material-symbols-outlined text-[18px] text-rose-400 shrink-0 mt-0.5">
										error
									</span>
									<p class="text-xs text-rose-300 font-medium leading-relaxed">{errorMsg()}</p>
								</div>
							</Show>

							<button
								type="submit"
								disabled={loading() || !password()}
								class="w-full h-14 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:from-amber-600 active:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center shadow-lg shadow-amber-500/25 text-xs active:scale-[0.99]"
							>
								<Show when={loading()} fallback={<span>{t('ownerGate.authenticate')}</span>}>
									<div class="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
								</Show>
							</button>
						</form>
					</Show>

					{/* Step 2: TOTP Code */}
					<Show when={step() === 'mfa'}>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								handleMfaSubmit();
							}}
							class="space-y-4"
						>
							<div>
								<input
									type="text"
									inputMode="numeric"
									placeholder={t('ownerGate.totpPlaceholder')}
									value={totpCode()}
									ref={totpInputRef}
									onInput={(e) => setTotpCode(e.currentTarget.value)}
									class="w-full h-14 text-center tracking-[0.3em] font-mono text-xl bg-[#0a0b0f] border border-amber-500/40 focus:border-amber-400 text-white rounded-2xl shadow-inner focus:outline-none transition-all placeholder:text-white/25 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
									disabled={loading()}
									autofocus
								/>
							</div>

							<Show when={errorMsg()}>
								<div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 animate-shake">
									<span class="material-symbols-outlined text-[18px] text-rose-400 shrink-0 mt-0.5">
										error
									</span>
									<p class="text-xs text-rose-300 font-medium leading-relaxed">{errorMsg()}</p>
								</div>
							</Show>

							<div class="flex gap-2">
								<button
									type="button"
									onClick={() => {
										setStep('password');
										setTotpCode('');
									}}
									class="w-1/3 h-14 border border-white/15 text-white/75 hover:bg-white/5 active:scale-95 rounded-2xl text-xs font-semibold transition-all"
								>
									{t('ownerGate.mfaBack')}
								</button>
								<button
									type="submit"
									disabled={loading() || !totpCode()}
									class="w-2/3 h-14 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:from-amber-600 active:to-amber-500 text-black font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center shadow-lg shadow-amber-500/25 text-xs disabled:opacity-40 active:scale-[0.99]"
								>
									<Show when={loading()} fallback={<span>{t('ownerGate.verifyEnter')}</span>}>
										<div class="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
									</Show>
								</button>
							</div>
						</form>
					</Show>
				</div>
			</div>
		</Show>
	);
};
