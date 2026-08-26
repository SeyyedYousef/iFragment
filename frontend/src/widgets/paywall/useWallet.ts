import { createQuery } from '@tanstack/solid-query';
import { createMemo, type Accessor } from 'solid-js';
import { creditsApi, type CreditsConfig } from '@/entities/intel/api/creditsApi.js';
import { getProfileStats } from '@/entities/user/api/profileApi.js';

export interface WalletData {
    /** Live credit balance; null while loading or unavailable */
    balance: Accessor<number | null>;
    /** ISO expiry of the soonest-expiring credit batch; null when none */
    nextExpiry: Accessor<string | null>;
    /** Airdrop coin balance from profile stats; null while loading */
    coins: Accessor<number | null>;
    /** Store configuration from backend; null while loading or on failure */
    config: Accessor<CreditsConfig | null>;
    configFailed: Accessor<boolean>;
    isLoading: Accessor<boolean>;
    refetch: () => void;
}

/**
 * Single source of truth for the credit economy surfaces.
 * Every value comes from a live API response — never fabricated.
 */
export function useWallet(): WalletData {
    const creditsQuery = createQuery(() => ({
        queryKey: ['intelCredits'],
        queryFn: () => creditsApi.getCredits(),
        staleTime: 30 * 1000,
    }));

    const configQuery = createQuery(() => ({
        queryKey: ['creditsConfig'],
        queryFn: () => creditsApi.getConfig(),
        staleTime: 10 * 60 * 1000,
        retry: 1,
    }));

    const profileQuery = createQuery(() => ({
        queryKey: ['walletProfileStats'],
        queryFn: () => getProfileStats(),
        staleTime: 60 * 1000,
    }));

    const balance = createMemo(() => {
        const b = creditsQuery.data?.balance;
        return typeof b === 'number' ? b : null;
    });

    const nextExpiry = createMemo(() => creditsQuery.data?.next_expiry ?? null);

    const coins = createMemo(() => {
        const c = profileQuery.data?.airdropCoins;
        return typeof c === 'number' ? c : null;
    });

    const refetch = () => {
        void creditsQuery.refetch();
        void profileQuery.refetch();
    };

    return {
        balance,
        nextExpiry,
        coins,
        config: createMemo(() => configQuery.data ?? null),
        configFailed: createMemo(() => configQuery.isError),
        isLoading: createMemo(() => creditsQuery.isLoading || configQuery.isLoading),
        refetch,
    };
}
