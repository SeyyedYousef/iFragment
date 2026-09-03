import { haptic } from '@/shared/lib/haptic.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { creditsApi } from '@/entities/intel/api/creditsApi.js';
import { For, Show, createSignal, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useWallet } from './useWallet.js';
import type { PaywallVertical } from './theme.js';
import { verticalThemes } from './theme.js';

interface CreditStoreSheetProps {
    open: boolean;
    onClose: () => void;
    vertical: PaywallVertical;
}

type Tab = 'stars' | 'exchange';

const tg = () =>
    (typeof window !== 'undefined' ? (window as unknown as { Telegram?: { WebApp?: { openInvoice?: (l: string) => void } } }).Telegram?.WebApp : undefined);

export const CreditStoreSheet: Component<CreditStoreSheetProps> = (props) => {
    const wallet = useWallet();
    const [tab, setTab] = createSignal<Tab>('stars');
    const [pendingPack, setPendingPack] = createSignal<string | null>(null);
    const [exchangeState, setExchangeState] = createSignal<'idle' | 'working' | 'done'>('idle');
    const [exchangeError, setExchangeError] = createSignal<string | null>(null);
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const theme = () => verticalThemes[props.vertical] ?? verticalThemes.general;

    const startBalancePolling = (baseline: number) => {
        clearInterval(pollTimer);
        let tries = 0;
        pollTimer = setInterval(() => {
            wallet.refetch();
            tries += 1;
            if ((wallet.balance() !== null && wallet.balance()! > baseline) || tries > 30) {
                clearInterval(pollTimer);
                setPendingPack(null);
                if (wallet.balance() !== null && wallet.balance()! > baseline) {
                    try {
                        haptic.notify('success');
                    } catch { }
                }
            }
        }, 2000);
    };

    const buyPack = async (packId: string) => {
        try {
            haptic.impact('medium');
        } catch { }
        setPendingPack(packId);
        setExchangeError(null);
        try {
            const res = await creditsApi.purchaseCredits('stars', packId);
            if (res.invoice_link) {
                const baseline = wallet.balance() ?? 0;
                tg()?.openInvoice?.(res.invoice_link);
                startBalancePolling(baseline);
            } else {
                setPendingPack(null);
                wallet.refetch();
            }
        } catch (err) {
            setPendingPack(null);
            setExchangeError(err instanceof Error ? err.message : String(err));
        }
    };

    const exchangeCoins = async () => {
        try {
            haptic.impact('medium');
        } catch { }
        setExchangeState('working');
        setExchangeError(null);
        try {
            await creditsApi.exchangeCoins();
            setExchangeState('done');
            wallet.refetch();
            try {
                haptic.notify('success');
            } catch { }
            setTimeout(() => setExchangeState('idle'), 2400);
        } catch (err) {
            setExchangeState('idle');
            setExchangeError(err instanceof Error ? err.message : String(err));
            try {
                haptic.notify('error');
            } catch { }
        }
    };

    const close = () => {
        clearInterval(pollTimer);
        props.onClose();
    };

    const coinProgress = () => {
        const cfg = wallet.config();
        const coins = wallet.coins();
        if (!cfg || coins === null || cfg.coins_per_credit <= 0) return null;
        return Math.min(1, coins / cfg.coins_per_credit);
    };

    return (
        <Show when={props.open}>
            <Portal>
                <div class="fixed inset-0 z-[140]" role="dialog" aria-modal="true" dir={isRtl() ? 'rtl' : 'ltr'}>
                <button
                    type="button"
                    aria-label="close"
                    onClick={close}
                    class="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    style={{ 'animation': 'fade-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
                />
                <div
                    class="paywall-sheet absolute inset-x-0 bottom-0 mx-auto max-w-[480px] rounded-t-[24px] border-t border-white/10 bg-[#12141C] px-4 pb-8 pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
                    style={{ 'animation': 'sheet-up 280ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
                >
                    <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />

                    <div class="mb-4 flex items-center justify-between">
                        <h2 class="text-[16px] font-black tracking-tight text-white">
                            {t('paywall.store_title')}
                        </h2>
                        <button
                            type="button"
                            onClick={close}
                            class="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/70 transition-colors duration-150 hover:bg-white/[0.12]"
                        >
                            <span class="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div class="mb-4 flex gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.04] p-1">
                        <button
                            type="button"
                            onClick={() => {
                                haptic.selection();
                                setTab('stars');
                            }}
                            class={`flex-1 rounded-xl py-2 text-xs font-black transition-all duration-150 ${tab() === 'stars' ? 'bg-white/[0.12] text-white' : 'text-white/55'
                                }`}
                        >
                            ⭐ {t('paywall.store_stars_tab')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                haptic.selection();
                                setTab('exchange');
                            }}
                            class={`flex-1 rounded-xl py-2 text-xs font-black transition-all duration-150 ${tab() === 'exchange' ? 'bg-white/[0.12] text-white' : 'text-white/55'
                                }`}
                        >
                            {t('paywall.store_exchange_tab')}
                        </button>
                    </div>

                    <Show
                        when={!wallet.configFailed()}
                        fallback={
                            <div class="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-center">
                                <p class="text-xs font-bold text-rose-300">{t('paywall.store_config_error')}</p>
                                <button
                                    type="button"
                                    onClick={() => wallet.refetch()}
                                    class="mt-2 rounded-xl bg-white/[0.08] px-4 py-1.5 text-xs font-black text-white active:scale-95"
                                >
                                    {t('paywall.retry')}
                                </button>
                            </div>
                        }
                    >
                        <Show
                            when={wallet.config()}
                            fallback={
                                <div class="space-y-2.5" aria-hidden="true">
                                    <div class="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
                                    <div class="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
                                    <div class="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
                                </div>
                            }
                        >
                            {/* ── STARS TAB ── */}
                            <Show when={tab() === 'stars'}>
                                <div class="space-y-2.5">
                                    <For each={wallet.config()?.packs ?? []}>
                                        {(pack) => (
                                            <button
                                                type="button"
                                                disabled={pendingPack() !== null}
                                                onClick={() => buyPack(pack.id)}
                                                class={`relative flex w-full items-center justify-between overflow-hidden rounded-2xl border p-4 text-start transition-all duration-150 active:scale-[0.98] disabled:opacity-60 ${pack.popular
                                                    ? 'border-amber-400/40 bg-gradient-to-r from-amber-400/[0.12] to-transparent'
                                                    : 'border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.07]'
                                                    }`}
                                            >
                                                <div class="flex items-center gap-3">
                                                    <div class="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-lg">
                                                        ⭐
                                                    </div>
                                                    <div>
                                                        <div class="flex items-center gap-1.5">
                                                            <span class="font-mono text-[15px] font-black text-white">
                                                                {pack.credits + pack.bonus_credits}
                                                            </span>
                                                            <span class="text-xs font-bold text-white/60">
                                                                {t('paywall.credit_unit')}
                                                            </span>
                                                            <Show when={pack.bonus_credits > 0}>
                                                                <span class="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-black text-emerald-300">
                                                                    +{pack.bonus_credits}
                                                                </span>
                                                            </Show>
                                                        </div>
                                                        <Show when={pack.popular}>
                                                            <div class="mt-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
                                                                {t('paywall.pack_popular')}
                                                            </div>
                                                        </Show>
                                                        <Show when={pack.best_value}>
                                                            <div class="mt-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                                                                {t('paywall.pack_best_value')}
                                                            </div>
                                                        </Show>
                                                    </div>
                                                </div>
                                                <div class="shrink-0">
                                                    <Show
                                                        when={pendingPack() !== pack.id}
                                                        fallback={
                                                            <span class="material-symbols-outlined animate-spin text-[18px] text-white/70">
                                                                progress_activity
                                                            </span>
                                                        }
                                                    >
                                                        <span class="rounded-xl bg-black/30 px-3 py-1.5 font-mono text-xs font-black text-amber-300">
                                                            {pack.stars_price}★
                                                        </span>
                                                    </Show>
                                                </div>
                                            </button>
                                        )}
                                    </For>
                                </div>
                            </Show>

                            {/* ── EXCHANGE TAB ── */}
                            <Show when={tab() === 'exchange'}>
                                <div class="space-y-3">
                                    <div class="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center gap-3">
                                                <div class="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15 text-lg">
                                                    🪙
                                                </div>
                                                <div>
                                                    <div class="text-xs font-black text-white">
                                                        {t('paywall.coins_exchange_title', {
                                                            amount: wallet.config()?.coins_per_credit ?? 0,
                                                        })}
                                                    </div>
                                                    <div class="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] font-bold text-white/60">
                                                        <Show when={wallet.coins() !== null} fallback={<span>—</span>}>
                                                            <span>{wallet.coins()!.toLocaleString('en-US')}</span>
                                                        </Show>
                                                        <span>→</span>
                                                        <span>1 {t('paywall.credit_unit')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={
                                                    exchangeState() === 'working' ||
                                                    coinProgress() === null ||
                                                    coinProgress()! < 1
                                                }
                                                onClick={exchangeCoins}
                                                class="shrink-0 rounded-xl px-4 py-2 text-xs font-black text-white transition-all duration-150 active:scale-95 disabled:opacity-40"
                                                style={{ background: theme().gradient }}
                                            >
                                                <Show
                                                    when={exchangeState() !== 'working'}
                                                    fallback={t('paywall.working')}
                                                >
                                                    <Show when={exchangeState() !== 'done'} fallback="✓">
                                                        {t('paywall.exchange_cta')}
                                                    </Show>
                                                </Show>
                                            </button>
                                        </div>

                                        {/* Progress toward next credit */}
                                        <Show when={coinProgress() !== null}>
                                            <div class="mt-3">
                                                <div class="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                                                    <div
                                                        class="h-full rounded-full transition-all duration-300"
                                                        style={{
                                                            width: `${Math.round(coinProgress()! * 100)}%`,
                                                            background: theme().gradient,
                                                        }}
                                                    />
                                                </div>
                                                <p class="mt-1.5 text-[10px] font-medium leading-relaxed text-white/60">
                                                    {t('paywall.coins_grind_note')}
                                                </p>
                                            </div>
                                        </Show>
                                    </div>

                                    <Show when={exchangeError()}>
                                        <div class="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs font-bold text-rose-300">
                                            {exchangeError()}
                                        </div>
                                    </Show>

                                    {/* Utility education card */}
                                    <div class="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
                                        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10">
                                            <span class="material-symbols-outlined text-[18px] text-emerald-300">
                                                shield_person
                                            </span>
                                        </div>
                                        <div>
                                            <div class="text-xs font-black text-white">
                                                {t('paywall.plan_utility_title')}
                                            </div>
                                            <div class="mt-0.5 text-[10px] font-medium leading-relaxed text-white/60">
                                                {t('paywall.plan_utility_desc')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Show>
                        </Show>
                    </Show>
                </div>
            </div>
        </Portal>
    </Show>
);
};
