import { useNavigate } from '@solidjs/router';
import { hapticFeedback, retrieveLaunchParams } from '@tma.js/sdk-solid';
import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { apiClient } from '@/shared/api/axios.js';

interface OwnerGateModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export const OwnerGateModal: Component<OwnerGateModalProps> = (props) => {
	const navigate = useNavigate();
	const [pin, setPin] = createSignal<string[]>(Array(6).fill(''));
	const [errorMsg, setErrorMsg] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	const inputRefs: HTMLInputElement[] = [];

	onMount(() => {
		// Focus first input on open
		if (props.isOpen && inputRefs[0]) {
			inputRefs[0].focus();
		}
	});

	const handleInput = (val: string, index: number) => {
		// Only allow numbers
		if (val && !/^\d$/.test(val)) return;

		const newPin = [...pin()];
		newPin[index] = val;
		setPin(newPin);

		// Auto focus next input
		if (val && index < 5 && inputRefs[index + 1]) {
			inputRefs[index + 1].focus();
		}

		// Auto submit on full PIN
		if (newPin.every((slot) => slot !== '')) {
			handleSubmit();
		}
	};

	const handleKeyDown = (e: KeyboardEvent, index: number) => {
		if (e.key === 'Backspace') {
			try {
				hapticFeedback.impactOccurred('light');
			} catch {}
			const newPin = [...pin()];

			if (!newPin[index] && index > 0 && inputRefs[index - 1]) {
				// If current is empty, delete previous and focus it
				newPin[index - 1] = '';
				setPin(newPin);
				inputRefs[index - 1].focus();
			} else {
				// Delete current
				newPin[index] = '';
				setPin(newPin);
			}
			e.preventDefault();
		} else if (e.key === 'ArrowLeft' && index > 0) {
			inputRefs[index - 1].focus();
			e.preventDefault();
		} else if (e.key === 'ArrowRight' && index < 5) {
			inputRefs[index + 1].focus();
			e.preventDefault();
		} else if (e.key === 'Enter') {
			if (pin().every((slot) => slot !== '')) {
				handleSubmit();
			}
		}
	};

	const handlePaste = (e: ClipboardEvent) => {
		e.preventDefault();
		const pastedData = e.clipboardData?.getData('text');
		if (!pastedData) return;

		const digits = pastedData.replace(/\D/g, '').split('').slice(0, 6);
		if (digits.length === 0) return;

		const newPin = [...pin()];
		for (let i = 0; i < digits.length; i++) {
			newPin[i] = digits[i];
		}
		setPin(newPin);

		// Focus appropriate input
		const nextIndex = Math.min(digits.length, 5);
		if (inputRefs[nextIndex]) {
			inputRefs[nextIndex].focus();
		} else if (inputRefs[5]) {
			inputRefs[5].focus();
		}

		if (newPin.every((slot) => slot !== '')) {
			handleSubmit();
		}
	};

	const handleSubmit = async () => {
		if (loading()) return;
		setErrorMsg('');
		setLoading(true);
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}

		const totpCode = pin().join('');

		// Get Telegram InitData securely
		let tgUser =
			typeof window !== 'undefined'
				? (window as any).Telegram?.WebApp?.initDataUnsafe?.user
				: undefined;
		let initData =
			typeof window !== 'undefined' ? (window as any).Telegram?.WebApp?.initData : undefined;
		try {
			const lp = retrieveLaunchParams();
			if (lp.initDataRaw) initData = lp.initDataRaw;
			if ((lp.initData as any)?.user) tgUser = (lp.initData as any).user;
		} catch (_e) {
			// ignore
		}

		if (!initData) {
			setErrorMsg(
				'This secure administrative panel can only be accessed inside the Telegram Mini App.',
			);
			setLoading(false);
			return;
		}

		try {
			const resp = await apiClient.post('/owner/auth/totp', {
				init_data: initData,
				code: totpCode,
			});

			const { token } = resp.data;
			if (token) {
				try {
					hapticFeedback.notificationOccurred('success');
				} catch {}
				// Securely store administrative token in sessionStorage (tab-scoped, neutralizes XSS persistence)
				sessionStorage.setItem('owner_token', token);
				if (tgUser?.id) {
					sessionStorage.setItem('owner_telegram_id', String(tgUser.id));
				}

				props.onClose();
				navigate('/owner/dashboard');
			} else {
				throw new Error('No authentication token received');
			}
		} catch (err: any) {
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
			setErrorMsg(
				err.response?.data?.error || 'Authentication failed. Please verify your TOTP key.',
			);
			// Clear pin
			setPin(Array(6).fill(''));
			if (inputRefs[0]) inputRefs[0].focus();
		} finally {
			setLoading(false);
		}
	};

	return (
		<Show when={props.isOpen}>
			<div class="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#000000]/80 backdrop-blur-md animate-fade-in">
				<div class="w-full max-w-sm overflow-hidden bg-gradient-to-b from-[#1c1d22] to-[#121316] border border-[#2a2c35]/50 rounded-[32px] p-6 shadow-2xl relative">
					{/* Close button */}
					<button
						onClick={() => {
							try {
								hapticFeedback.impactOccurred('light');
							} catch {}
							props.onClose();
						}}
						class="absolute top-5 end-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all"
					>
						<span class="material-symbols-outlined text-[18px] text-white/70">close</span>
					</button>

					{/* Icon Header */}
					<div class="flex flex-col items-center text-center mt-4 mb-6">
						<div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#3390ec]/20 to-[#3390ec]/5 border border-[#3390ec]/30 flex items-center justify-center text-3xl mb-4 shadow-inner">
							🛡️
						</div>
						<h2 class="text-lg font-black text-white uppercase tracking-wider">
							Owner Portal Access
						</h2>
						<p class="text-xs text-[#a0a4ad] font-bold mt-1 max-w-[240px]">
							Provide the 6-digit TOTP authentication code to access the secure administrative
							panel.
						</p>
					</div>

					{/* 6-Digit PIN input boxes */}
					<div class="flex justify-between gap-2 mb-6">
						<For each={pin()}>
							{(digit, index) => (
								<div class="block">
									<span id={`digit-label-${index()}`} class="sr-only">
										Digit {index() + 1}
									</span>
									<input
										type="text"
										inputmode="numeric"
										pattern="[0-9]*"
										maxLength={1}
										value={digit}
										aria-labelledby={`digit-label-${index()}`}
										ref={(el) => (inputRefs[index()] = el)}
										onInput={(e) => handleInput(e.currentTarget.value, index())}
										onKeyDown={(e) => handleKeyDown(e, index())}
										onPaste={handlePaste}
										class="w-12 h-14 bg-[#0f1014] border border-[#2a2c35] focus:border-[#3390ec] text-white text-xl font-bold text-center rounded-2xl shadow-inner focus:outline-none transition-all"
										disabled={loading()}
									/>
								</div>
							)}
						</For>
					</div>

					{/* Error Message */}
					<Show when={errorMsg()}>
						<div class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2.5 animate-shake">
							<span class="material-symbols-outlined text-[18px] text-red-500 flex-shrink-0 mt-0.5">
								error
							</span>
							<p class="text-[11px] text-red-400 font-bold leading-normal">{errorMsg()}</p>
						</div>
					</Show>

					{/* Loading Indicator */}
					<Show when={loading()}>
						<div class="flex justify-center items-center py-4">
							<div class="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin"></div>
						</div>
					</Show>
				</div>
			</div>
		</Show>
	);
};
