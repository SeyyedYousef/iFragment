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

		const savedId = localStorage.getItem('owner_telegram_id') || localStorage.getItem('tg_user_id');
		if (savedId) {
			const parsed = parseInt(savedId, 10);
			if (!isNaN(parsed) && parsed > 0) return parsed;
		}

		return 0;
	};

	createEffect(() => {
		if (props.isOpen) {
			setErrorMsg('');
			setPassword('');
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

			setTimeout(() => passwordInputRef?.focus(), 50);
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
			setErrorMsg(
				t('ownerGate.errorNotTMA' as any) ||
					'Telegram User ID not detected. Please enter your Telegram ID or open inside Telegram.',
			);
			setLoading(false);
			return;
		}

		try {
			const res = await ownerApi.login(password(), tgUserId);

			if (res.mfa_required && res.temp_token) {
				// Transition to MFA Step
				setTempToken(res.temp_token);
				setStep('mfa');
				setTimeout(() => totpInputRef?.focus(), 50);
			} else if (res.token) {
				// Login success
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
			setErrorMsg(
				err.response?.data?.error ||
					t('ownerGate.errorAuth' as any) ||
					'Authentication failed. Please verify your password.',
			);
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
			setErrorMsg(err.response?.data?.error || 'Invalid 6-digit TOTP or recovery code.');
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
				class="fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in"
			>
				<div
					role="dialog"
					aria-modal="true"
					class="w-full max-w-sm max-h-[85vh] overflow-y-auto no-scrollbar bg-gradient-to-b from-[#1c1d22] to-[#121316] border border-white/15 rounded-[32px] p-6 shadow-2xl relative text-white"
				>
					{/* Close button */}
					<button
						type="button"
						onClick={props.onClose}
						aria-label={t('dangerAction.closeWindow')}
						class="absolute top-5 end-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all text-white/70 hover:text-white"
					>
						<span class="material-symbols-outlined text-[18px]">close</span>
					</button>

					{/* Icon Header */}
					<div class="flex flex-col items-center text-center mt-4 mb-6">
						<div class="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl mb-4 text-amber-400">
							<span class="material-symbols-rounded text-3xl">
								{step() === 'mfa' ? 'pin' : 'shield_person'}
							</span>
						</div>
						<h2 class="text-lg font-black uppercase tracking-wider">
							{step() === 'mfa' ? 'Two-Factor Authentication' : 'Owner Master Gate'}
						</h2>
						<p class="text-xs text-white/60 font-medium mt-1 max-w-[240px]">
							{step() === 'mfa'
								? 'Enter the 6-digit authenticator code or single-use recovery code.'
								: 'Enter your master security password to access the panel.'}
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
								<div>
									<label class="block text-[11px] font-bold text-white/60 mb-1.5 uppercase tracking-wider">
										Telegram User ID (Browser Mode)
									</label>
									<input
										type="text"
										inputMode="numeric"
										placeholder="e.g. 5076130392"
										value={manualTgId()}
										onInput={(e) => setManualTgId(e.currentTarget.value)}
										class="w-full h-12 px-4 bg-[#0f1014] border border-white/15 focus:border-amber-400 text-white text-sm rounded-2xl shadow-inner focus:outline-none transition-all placeholder:text-white/20 font-mono"
										disabled={loading()}
									/>
								</div>
							</Show>

							<div>
								<input
									type="password"
									placeholder={t('ownerGate.securityPasswordPlaceholder')}
									value={password()}
									ref={passwordInputRef}
									onInput={(e) => setPassword(e.currentTarget.value)}
									class="w-full h-14 px-4 bg-[#0f1014] border border-white/15 focus:border-amber-400 text-white text-base rounded-2xl shadow-inner focus:outline-none transition-all placeholder:text-white/20"
									disabled={loading()}
								/>
							</div>

							{/* Error Message */}
							<Show when={errorMsg()}>
								<div class="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5">
									<span class="material-symbols-outlined text-[18px] text-rose-400 flex-shrink-0 mt-0.5">
										error
									</span>
									<p class="text-[11px] text-rose-300 font-medium leading-normal">{errorMsg()}</p>
								</div>
							</Show>

							<button
								type="submit"
								disabled={loading() || !password()}
								class="w-full h-14 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center shadow-lg shadow-amber-500/20 text-xs"
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
									class="w-full h-14 text-center tracking-[0.3em] font-mono text-xl bg-[#0f1014] border border-amber-500/40 focus:border-amber-400 text-white rounded-2xl shadow-inner focus:outline-none transition-all placeholder:text-white/20 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
									disabled={loading()}
									autofocus
								/>
							</div>

							<Show when={errorMsg()}>
								<div class="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5">
									<span class="material-symbols-outlined text-[18px] text-rose-400 flex-shrink-0 mt-0.5">
										error
									</span>
									<p class="text-[11px] text-rose-300 font-medium leading-normal">{errorMsg()}</p>
								</div>
							</Show>

							<div class="flex gap-2">
								<button
									type="button"
									onClick={() => {
										setStep('password');
										setTotpCode('');
									}}
									class="w-1/3 h-14 border border-white/15 text-white/70 hover:bg-white/5 rounded-2xl text-xs font-semibold"
								>
									{t('ownerCommon.back')}
								</button>
								<button
									type="submit"
									disabled={loading() || !totpCode()}
									class="w-2/3 h-14 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center shadow-lg shadow-amber-500/20 text-xs disabled:opacity-50"
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
