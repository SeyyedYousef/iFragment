import { useQueryClient } from '@tanstack/solid-query';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, Show } from 'solid-js';
import { apiClient } from '@/shared/api/axios.js';
import { t } from '@/shared/i18n/index.js';

interface RedeemPromoModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export const RedeemPromoModal: Component<RedeemPromoModalProps> = (props) => {
	const queryClient = useQueryClient();
	const [code, setCode] = createSignal('');
	const [successMsg, setSuccessMsg] = createSignal('');
	const [errorMsg, setErrorMsg] = createSignal('');
	const [loading, setLoading] = createSignal(false);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		if (!code().trim()) return;

		setErrorMsg('');
		setSuccessMsg('');
		setLoading(true);
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}

		try {
			const resp = await apiClient.post('/profile/promo/redeem', {
				code: code().trim().toUpperCase(),
			});

			if (resp.data.success) {
				try {
					hapticFeedback.notificationOccurred('success');
				} catch {}
				setSuccessMsg(resp.data.message || t('promo.success')());
				setCode('');

				// Invalidate profile query to refetch new FRG balance instantly
				queryClient.invalidateQueries({ queryKey: ['profile', 'stats'] });

				setTimeout(() => {
					props.onClose();
					setSuccessMsg('');
				}, 2000);
			}
		} catch (err: any) {
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
			setErrorMsg(
				err.response?.data?.error || t('promo.error')(),
			);
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
							setErrorMsg('');
							setSuccessMsg('');
						}}
						class="absolute top-5 end-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 active:scale-95 transition-all"
						disabled={loading()}
					>
						<span class="material-symbols-outlined text-[18px] text-white/70">close</span>
					</button>

					{/* Icon Header */}
					<div class="flex flex-col items-center text-center mt-4 mb-6">
						<div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#ffcc00]/20 to-[#ffcc00]/5 border border-[#ffcc00]/30 flex items-center justify-center text-3xl mb-4 shadow-inner">
							🎁
						</div>
						<h2 class="text-lg font-black text-white uppercase tracking-wider">{t('promo.title')()}</h2>
						<p class="text-xs text-[#a0a4ad] font-bold mt-1 max-w-[240px]">
							{t('promo.description')()}
						</p>
					</div>

					<form onSubmit={handleSubmit} class="flex flex-col gap-4">
						<div class="flex flex-col gap-1.5">
							<input
								type="text"
								placeholder={t('promo.placeholder')()}
								value={code()}
								onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
								class="w-full h-12 bg-[#0f1014] border border-[#2a2c35] focus:border-[#ffcc00] text-center text-white text-sm font-bold uppercase tracking-wider rounded-2xl shadow-inner focus:outline-none transition-all"
								disabled={loading()}
								required
							/>
						</div>

						{/* Error Message */}
						<Show when={errorMsg()}>
							<div class="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-2.5 animate-shake">
								<span class="material-symbols-outlined text-[18px] text-red-500 flex-shrink-0 mt-0.5">
									error
								</span>
								<p class="text-[11px] text-red-400 font-bold leading-normal">{errorMsg()}</p>
							</div>
						</Show>

						{/* Success Message */}
						<Show when={successMsg()}>
							<div class="p-3 bg-[#34c759]/10 border border-[#34c759]/20 rounded-2xl flex items-start gap-2.5 animate-fade-in">
								<span class="material-symbols-outlined text-[18px] text-[#34c759] flex-shrink-0 mt-0.5">
									check_circle
								</span>
								<p class="text-[11px] text-[#34c759] font-bold leading-normal">{successMsg()}</p>
							</div>
						</Show>

						<button
							type="submit"
							disabled={loading() || !code().trim()}
							class="w-full h-12 bg-[#ffcc00] disabled:bg-[#ffcc00]/50 hover:bg-[#e6b800] text-xs font-black uppercase tracking-wider text-[#0f1014] rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-[#ffcc00]/10"
						>
							<Show when={loading()} fallback={t('promo.claim')()}>
								<div class="w-5 h-5 border-2 border-[#0f1014] border-t-transparent rounded-full animate-spin" />
							</Show>
						</button>
					</form>
				</div>
			</div>
		</Show>
	);
};
