import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useWallet } from './useWallet.js';

interface CreditWalletBarProps {
	onOpenStore?: () => void;
}

/** Animated integer count-up that respects reduced-motion. */
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
		const dur = 280;
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
		<div class="flex items-center justify-between gap-2 frag-inset rounded-[12px] px-3.5 py-2.5">
			<div class="flex min-w-0 items-center gap-2.5">
				<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-[#ffb340]/25 bg-[#ffb340]/12">
					<span class="material-symbols-outlined text-[16px] text-[#ffb340]">key</span>
				</div>
				<div class="min-w-0">
					<Show
						when={displayBalance() !== null}
						fallback={
							<div class="h-4 w-10 animate-pulse rounded bg-[#1b232d]" aria-hidden="true" />
						}
					>
						<span class="block font-mono text-[15px] font-semibold leading-none text-white tabular-nums">
							{displayBalance()}
						</span>
					</Show>
					<span class="mt-0.5 block truncate text-[11px] font-medium text-[#8c9ba5]">
						{t('paywall.wallet_balance')}
					</span>
				</div>

				<Show when={expiryDays() !== null && expiryDays()! <= 14}>
					<span class="hidden rounded-[6px] border border-[#ffb340]/25 bg-[#ffb340]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#ffb340] tabular-nums xs:inline-block">
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
				class="flex shrink-0 items-center gap-1 rounded-[9px] frag-btn-secondary px-3 py-1.5 text-[11.5px] font-semibold text-white active:scale-95"
			>
				<span class="material-symbols-outlined text-[14px] text-[#2990ff]">add_circle</span>
				<span>{t('paywall.get_credits')}</span>
			</button>
		</div>
	);
};
