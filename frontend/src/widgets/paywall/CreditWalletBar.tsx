import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useWallet } from './useWallet.js';

interface CreditWalletBarProps {
	onOpenStore?: () => void;
}

function useCountUp(target: () => number | null) {
	const [display, setDisplay] = createSignal<number | null>(null);
	let raf = 0;
	let currentVal = 0;

	createEffect(() => {
		const to = target();
		if (to === null) {
			setDisplay(null);
			return;
		}
		const reduce =
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

		if (reduce) {
			currentVal = to;
			setDisplay(to);
			return;
		}

		cancelAnimationFrame(raf);
		const from = currentVal;
		const start = performance.now();
		const dur = 240;
		const step = (now: number) => {
			const p = Math.min(1, (now - start) / dur);
			const eased = 1 - 2 ** (-10 * p);
			const val = Math.round(from + (to - from) * eased);
			currentVal = val;
			setDisplay(val);
			if (p < 1) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	});

	onCleanup(() => cancelAnimationFrame(raf));
	return display;
}

export const CreditWalletBar = (props: CreditWalletBarProps) => {
	const wallet = useWallet();
	const displayBalance = useCountUp(wallet.balance);

	const expiryDays = () => {
		const exp = wallet.nextExpiry();
		if (!exp) return null;
		const diff = new Date(exp).getTime() - Date.now();
		if (Number.isNaN(diff) || diff <= 0) return null;
		return Math.ceil(diff / 86_400_000);
	};

	return (
		<div class="flex items-center justify-between gap-2 bg-[#242e38] rounded-[8px] px-3.5 py-2.5">
			<div class="flex min-w-0 items-center gap-2.5">
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#ff9953]/10">
					<span
						class="material-symbols-outlined text-[16px] text-[#ff9953]"
						style={{ 'font-variation-settings': '"FILL" 1' }}
					>
						star
					</span>
				</div>
				<div class="min-w-0">
					<Show
						when={displayBalance() !== null}
						fallback={
							<div class="h-4 w-10 animate-pulse rounded bg-[#293440]" aria-hidden="true" />
						}
					>
						<span class="block font-mono text-[15px] font-semibold leading-none text-white tabular-nums">
							{displayBalance()}
						</span>
					</Show>
					<span class="mt-0.5 block truncate text-[11.5px] font-medium text-[#8c9aa9]">
						{t('paywall.wallet_balance')}
					</span>
				</div>

				<Show when={expiryDays() !== null && expiryDays()! <= 14}>
					<span class="hidden rounded-[4px] bg-[#ff9953]/10 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-[#ff9953] tabular-nums xs:inline-block">
						{t('paywall.wallet_expiring', { count: expiryDays()!, days: expiryDays()! })}
					</span>
				</Show>
			</div>

			<button
				type="button"
				onClick={() => {
					try {
						haptic.impact('light');
					} catch {}
					props.onOpenStore?.();
				}}
				class="flex shrink-0 items-center gap-1 rounded-[6px] bg-[#293440] hover:bg-[#384553] px-3 py-1.5 text-[12px] font-semibold text-[#4db2ff] transition-colors cursor-pointer"
			>
				<span class="material-symbols-outlined text-[15px]">add</span>
				<span>{t('paywall.get_credits')}</span>
			</button>
		</div>
	);
};
