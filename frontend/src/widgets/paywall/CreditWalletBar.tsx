import { haptic } from '@/shared/lib/haptic.js';
import { t } from '@/shared/i18n/index.js';
import { Show, createSignal, createEffect, onCleanup } from 'solid-js';
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
            const eased = 1 - Math.pow(2, -10 * p);
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
        <div class="flex items-center justify-between gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 backdrop-blur-xl">
            <div class="flex min-w-0 items-center gap-2.5">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15">
                    <span class="material-symbols-outlined text-[16px] text-amber-300">key</span>
                </div>
                <div class="min-w-0">
                    <Show
                        when={displayBalance() !== null}
                        fallback={<div class="h-4 w-10 animate-pulse rounded bg-white/10" aria-hidden="true" />}
                    >
                        <span class="block font-mono text-[15px] font-black leading-none text-white">
                            {displayBalance()}
                        </span>
                    </Show>
                    <span class="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-wider text-white/60">
                        {t('paywall.wallet_balance')}
                    </span>
                </div>

                <Show when={expiryDays() !== null && expiryDays()! <= 14}>
                    <span class="hidden rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black text-amber-300 xs:inline-block">
                        {t('paywall.wallet_expiring', { count: expiryDays()!, days: expiryDays()! })}
                    </span>
                </Show>
            </div>

            <button
                type="button"
                onClick={() => {
                    try {
                        haptic.impact('light');
                    } catch { }
                    props.onOpenStore?.();
                }}
                class="flex shrink-0 items-center gap-1 rounded-xl bg-white/[0.07] px-3 py-1.5 text-[11px] font-black text-white transition-all duration-150 hover:bg-white/[0.12] active:scale-95"
            >
                <span class="material-symbols-outlined text-[14px]">add_circle</span>
                {t('paywall.get_credits')}
            </button>
        </div>
    );
};
