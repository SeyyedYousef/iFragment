import { createSignal, createEffect, onMount, For, Show, type Component } from 'solid-js';
import QRCode from 'qrcode';
import { ownerApi } from '../../entities/owner/api/ownerApi';

interface TotpSetupModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

export const TotpSetupModal: Component<TotpSetupModalProps> = (props) => {
	const [step, setStep] = createSignal<'loading' | 'qr' | 'recovery' | 'verify'>('loading');
	const [secret, setSecret] = createSignal('');
	const [qrDataUrl, setQrDataUrl] = createSignal('');
	const [recoveryCodes, setRecoveryCodes] = createSignal<string[]>([]);
	const [verifyCode, setVerifyCode] = createSignal('');
	const [error, setError] = createSignal<string | null>(null);
	const [isLoading, setIsLoading] = createSignal(false);
	const [copiedSecret, setCopiedSecret] = createSignal(false);
	const [copiedRecovery, setCopiedRecovery] = createSignal(false);

	const initSetup = async () => {
		setStep('loading');
		setError(null);
		try {
			const res = await ownerApi.setupTotp();
			setSecret(res.secret);
			setRecoveryCodes(res.recovery_codes);

			// Generate QR code data URL
			const qrUrl = await QRCode.toDataURL(res.provisioning_uri, {
				width: 220,
				margin: 2,
				color: {
					dark: '#000000',
					light: '#ffffff',
				},
			});
			setQrDataUrl(qrUrl);
			setStep('qr');
		} catch (err: any) {
			setError(err.response?.data?.error || err.message || 'Failed to initialize TOTP setup');
			setStep('qr');
		}
	};

	createEffect(() => {
		if (props.isOpen) {
			initSetup();
		}
	});

	const copySecret = () => {
		navigator.clipboard.writeText(secret());
		setCopiedSecret(true);
		setTimeout(() => setCopiedSecret(false), 2000);
	};

	const copyRecoveryCodes = () => {
		const text = `iFragment Admin Recovery Codes (Store Securely):\n\n${recoveryCodes().join('\n')}`;
		navigator.clipboard.writeText(text);
		setCopiedRecovery(true);
		setTimeout(() => setCopiedRecovery(false), 2000);
	};

	const handleVerifyAndEnable = async (e: Event) => {
		e.preventDefault();
		if (verifyCode().length !== 6) {
			setError('Please enter the 6-digit code from your authenticator app');
			return;
		}

		setIsLoading(true);
		setError(null);
		try {
			await ownerApi.verifyTotpSetup(verifyCode());
			props.onSuccess();
			props.onClose();
		} catch (err: any) {
			setError(err.response?.data?.error || err.message || 'Invalid verification code');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Show when={props.isOpen}>
			<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
				<div class="w-full max-w-md rounded-3xl border border-white/15 bg-neutral-900/95 p-6 shadow-2xl space-y-5 text-white">
					{/* Header */}
					<div class="flex items-center justify-between border-b border-white/10 pb-4">
						<div class="flex items-center gap-2.5">
							<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
								<span class="material-symbols-rounded text-2xl">verified_user</span>
							</div>
							<div>
								<h2 class="text-base font-bold">Two-Factor Authentication (MFA)</h2>
								<p class="text-xs text-white/50">Secure your Owner panel with TOTP</p>
							</div>
						</div>
						<button
							onClick={props.onClose}
							class="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition"
						>
							<span class="material-symbols-rounded text-xl">close</span>
						</button>
					</div>

					{/* Step 1: QR & Secret */}
					<Show when={step() === 'qr'}>
						<div class="space-y-4 text-center">
							<p class="text-xs text-white/70">
								Scan this QR code using Google Authenticator, 1Password, or Authy:
							</p>

							<Show when={qrDataUrl()} fallback={<div class="h-48 flex items-center justify-center text-xs text-white/50">Generating QR...</div>}>
								<div class="mx-auto flex h-52 w-52 items-center justify-center rounded-2xl bg-white p-3 shadow-inner">
									<img src={qrDataUrl()} alt="TOTP QR Code" class="h-full w-full object-contain" />
								</div>
							</Show>

							{/* Manual Entry Key */}
							<div class="rounded-xl border border-white/10 bg-black/40 p-3 text-left">
								<div class="flex items-center justify-between text-xs text-white/50 mb-1">
									<span>Manual Entry Secret Key:</span>
									<button onClick={copySecret} class="text-amber-400 hover:underline flex items-center gap-1">
										<span class="material-symbols-rounded text-sm">
											{copiedSecret() ? 'done' : 'content_copy'}
										</span>
										<span>{copiedSecret() ? 'Copied' : 'Copy'}</span>
									</button>
								</div>
								<div class="font-mono text-xs text-amber-200 tracking-wider break-all">{secret()}</div>
							</div>

							<button
								onClick={() => setStep('recovery')}
								class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition shadow-lg shadow-amber-500/20"
							>
								Next: Save Recovery Codes →
							</button>
						</div>
					</Show>

					{/* Step 2: Recovery Codes */}
					<Show when={step() === 'recovery'}>
						<div class="space-y-4">
							<div class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2.5">
								<span class="material-symbols-rounded text-amber-400 text-base mt-0.5">warning</span>
								<div>
									<div class="font-semibold">Save your backup recovery codes</div>
									<div class="text-[11px] text-amber-200/80 mt-0.5">
										Each code can be used once if you lose access to your authenticator app.
									</div>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-white/90">
								<For each={recoveryCodes()}>
									{(code) => (
										<div class="rounded-lg bg-white/5 px-2.5 py-1.5 text-center border border-white/5">
											{code}
										</div>
									)}
								</For>
							</div>

							<button
								onClick={copyRecoveryCodes}
								class="w-full py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-xs font-medium text-white flex items-center justify-center gap-2 transition"
							>
								<span class="material-symbols-rounded text-sm">
									{copiedRecovery() ? 'done' : 'content_copy'}
								</span>
								<span>{copiedRecovery() ? 'All Codes Copied!' : 'Copy All 10 Recovery Codes'}</span>
							</button>

							<div class="flex gap-2 pt-2">
								<button
									onClick={() => setStep('qr')}
									class="w-1/3 py-2.5 rounded-xl border border-white/10 text-xs text-white/70 hover:bg-white/5 transition"
								>
									Back
								</button>
								<button
									onClick={() => setStep('verify')}
									class="w-2/3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition"
								>
									Next: Verify 6-Digit Code →
								</button>
							</div>
						</div>
					</Show>

					{/* Step 3: Verify & Activate */}
					<Show when={step() === 'verify'}>
						<form onSubmit={handleVerifyAndEnable} class="space-y-4">
							<p class="text-xs text-white/70">
								Enter the 6-digit code currently shown in your authenticator app to confirm setup:
							</p>

							<div>
								<input
									type="text"
									inputMode="numeric"
									maxLength={6}
									placeholder="000000"
									value={verifyCode()}
									onInput={(e) => setVerifyCode(e.currentTarget.value.replace(/\D/g, ''))}
									class="w-full text-center tracking-[0.5em] font-mono text-2xl py-3 rounded-2xl border border-white/20 bg-black/60 text-white placeholder:text-white/20 focus:border-amber-400 focus:outline-none"
									autofocus
								/>
							</div>

							<Show when={error()}>
								<div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
									<span class="material-symbols-rounded text-sm">error</span>
									<span>{error()}</span>
								</div>
							</Show>

							<div class="flex gap-2 pt-2">
								<button
									type="button"
									onClick={() => setStep('recovery')}
									class="w-1/3 py-3 rounded-xl border border-white/10 text-xs text-white/70 hover:bg-white/5 transition"
								>
									Back
								</button>
								<button
									type="submit"
									disabled={isLoading() || verifyCode().length !== 6}
									class="w-2/3 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
								>
									<Show when={isLoading()} fallback={<span>Verify & Activate MFA</span>}>
										<div class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
										<span>Activating...</span>
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
