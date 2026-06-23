import { useNavigate } from '@solidjs/router';
import { hapticFeedback, retrieveLaunchParams } from '@tma.js/sdk-solid';
import { Component, createSignal, onMount, Show } from 'solid-js';
import { apiClient } from '@/shared/api/axios.js';
import { t } from '@/shared/i18n/index.js';

interface OwnerGateModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export const OwnerGateModal: Component<OwnerGateModalProps> = (props) => {
	const navigate = useNavigate();
	const [password, setPassword] = createSignal('');
	const [errorMsg, setErrorMsg] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	let inputRef: HTMLInputElement | undefined;

	onMount(() => {
		if (props.isOpen && inputRef) {
			inputRef.focus();
		}
	});

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Enter' && password().trim() !== '') {
			handleSubmit();
		}
	};

	const handleSubmit = async () => {
		if (loading() || !password()) return;
		setErrorMsg('');
		setLoading(true);
		
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}

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
			setErrorMsg(t('ownerGate.errorNotTMA') || 'This secure administrative panel can only be accessed inside the Telegram Mini App.');
			setLoading(false);
			return;
		}

		try {
			const resp = await apiClient.post('/owner/auth/totp', {
				init_data: initData,
				password: password(),
			});

			const { token } = resp.data;
			if (token) {
				try {
					hapticFeedback.notificationOccurred('success');
				} catch {}
				// Securely store administrative token in sessionStorage
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
				err.response?.data?.error || t('ownerGate.errorAuth') || 'Authentication failed. Please check your password.'
			);
			setPassword('');
			if (inputRef) inputRef.focus();
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
							{t('ownerGate.title') || 'Owner Portal Access'}
						</h2>
						<p class="text-xs text-[#a0a4ad] font-bold mt-1 max-w-[240px]">
							{t('ownerGate.desc') || 'Provide your secure password to access the administrative panel.'}
						</p>
					</div>

					{/* Password Input */}
					<div class="mb-6">
						<input
							type="password"
							placeholder={t('ownerGate.placeholder') || 'Enter password...'}
							value={password()}
							ref={inputRef}
							onInput={(e) => setPassword(e.currentTarget.value)}
							onKeyDown={handleKeyDown}
							class="w-full h-14 px-4 bg-[#0f1014] border border-[#2a2c35] focus:border-[#3390ec] text-white text-lg rounded-2xl shadow-inner focus:outline-none transition-all"
							disabled={loading()}
						/>
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

					{/* Submit Button */}
					<button
						onClick={handleSubmit}
						disabled={loading() || !password()}
						class="w-full h-14 bg-[#3390ec] hover:bg-[#2b7ec9] active:bg-[#2368a8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center"
					>
						<Show when={loading()} fallback={<span>{t('ownerGate.submit') || 'Authenticate'}</span>}>
							<div class="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
						</Show>
					</button>
				</div>
			</div>
		</Show>
	);
};
