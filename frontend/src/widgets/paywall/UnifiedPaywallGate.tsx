import { haptic } from '@/shared/lib/haptic.js';
import { t } from '@/shared/i18n/index.js';
import { Show, createSignal, type Component } from 'solid-js';
import { CreditStoreSheet } from './CreditStoreSheet.js';
import { CreditWalletBar } from './CreditWalletBar.js';
import { useWallet } from './useWallet.js';
import { verticalThemes, type PaywallVertical } from './theme.js';

interface UnifiedPaywallGateProps {
    vertical: PaywallVertical;
    /** Executes the vertical-specific unlock-with-credit call */
    onUnlock: () => Promise<void>;
    unlocking: boolean;
    error?: string | null;
}

/**
 * The ONLY paywall surface. Purely payment-focused: price, balance, one action.
 * No curiosity counters, no free-unlock paths, no direct coin payments.
 */
export const UnifiedPaywallGate: Component<UnifiedPaywallGateProps> = (props) => {
    const wallet = useWallet();
    const [storeOpen, setStoreOpen] = createSignal(false);
    const theme = () => verticalThemes[props.vertical];

    const canAfford = () => {
        const b = wallet.balance();
        return b === null || b >= 1;
    };

    const handlePrimary = async () => {
        try {
            haptic.impact('medium');
        } catch { }
        if (!canAfford()) {
            setStoreOpen(true);
            return;
        }
        await props.onUnlock();
    };

    return (
        <div class="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#12141C]/80 shadow-xl backdrop-blur-xl">
            {/* Accent presence: soft corner glow, not a decorative border */}
            <div
                class="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-60 blur-3xl"
                style={{ background: theme().accentSoft }}
                aria-hidden="true"
            />

            <div class="relative space-y-4 p-5">
                {/* Price statement */}
                <div class="flex items-center justify-between gap-3">
                    <h3 class="text-[15px] font-black leading-snug tracking-tight text-white">
                        {t(`paywall.title.${props.vertical}` as const)}
                    </h3>
                    <div
                        class="flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5"
                        style={{ 'border-color': theme().accentBorder, background: theme().accentSoft }}
                    >
                        <span class="material-symbols-outlined text-[15px]" style={{ color: theme().accent }}>
                            key
                        </span>
                        <span class="font-mono text-sm font-black text-white">1</span>
                    </div>
                </div>

                {/* Live balance */}
                <CreditWalletBar onOpenStore={() => setStoreOpen(true)} />

                <Show when={props.error}>
                    <div class="flex items-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs font-bold text-rose-300">
                        <span class="material-symbols-outlined text-base">error</span>
                        {props.error}
                    </div>
                </Show>

                {/* Primary action */}
                <button
                    type="button"
                    disabled={props.unlocking}
                    onClick={handlePrimary}
                    class="group relative flex h-13 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 text-sm font-black text-white shadow-lg transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                    style={{ background: theme().gradient, 'box-shadow': `0 10px 30px -8px ${theme().glow}` }}
                >
                    <span
                        class="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-white/20 opacity-0 transition-all duration-300 group-hover:left-[110%] group-hover:opacity-100"
                        aria-hidden="true"
                    />
                    <Show
                        when={!props.unlocking}
                        fallback={
                            <span class="material-symbols-outlined animate-spin text-[18px]">
                                progress_activity
                            </span>
                        }
                    >
                        <span class="material-symbols-outlined text-[18px]">
                            {canAfford() ? 'lock_open' : 'shopping_bag'}
                        </span>
                    </Show>
                    {props.unlocking
                        ? t('paywall.working')
                        : canAfford()
                            ? t('paywall.cta_unlock')
                            : t('paywall.cta_get_credits')}
                </button>

                {/* Trust footer */}
                <div class="flex items-center justify-center gap-3 text-[10px] font-bold text-white/60">
                    <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[12px] text-emerald-400">bolt</span>
                        {t('paywall.trust_instant')}
                    </span>
                    <span class="h-3 w-px bg-white/10" />
                    <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[12px] text-emerald-400">history</span>
                        {t('paywall.trust_cached')}
                    </span>
                </div>
            </div>

            <CreditStoreSheet
                open={storeOpen()}
                onClose={() => setStoreOpen(false)}
                vertical={props.vertical}
            />
        </div>
    );
};
