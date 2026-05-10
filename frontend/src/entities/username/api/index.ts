import { createQuery, createMutation } from '@tanstack/solid-query';
import { apiFetch } from '@/shared/api/base.js';
import { createSignal, createEffect, onCleanup } from 'solid-js';

export interface CollectionStats {
  total_supply: number;
  holders: number;
  floor_price: string;
  total_volume: string;
}

export interface AvailabilityStatus {
  username: string;
  status: 'available' | 'taken' | 'on_auction' | 'on_sale';
}

export interface PremiumReport {
  id: string;
  username: string;
  status: 'available' | 'taken' | 'on_auction' | 'on_sale';
  on_chain?: {
    collection: string;
    market: string;
    owner?: string;
    last_price?: string;
  };
  rarity_score: number;
  generated_at: string;
}

export const useCollectionStats = () => {
  return createQuery(() => ({
    queryKey: ['username', 'collection', 'stats'],
    queryFn: () => apiFetch<CollectionStats>('/usernames/collection/stats'),
    staleTime: 60 * 1000, // 1 minute
  }));
};

export const useUsernameAvailability = (username: () => string) => {
  const [debouncedUsername, setDebouncedUsername] = createSignal(username());

  createEffect(() => {
    const val = username();
    const timeout = setTimeout(() => {
      setDebouncedUsername(val);
    }, 350); // 350ms debounce
    onCleanup(() => clearTimeout(timeout));
  });

  return createQuery(() => ({
    queryKey: ['username', 'check', debouncedUsername()],
    queryFn: () => apiFetch<AvailabilityStatus>(`/usernames/check?u=${debouncedUsername()}`),
    enabled: !!debouncedUsername() && debouncedUsername().length >= 4,
    staleTime: 5 * 60 * 1000, // 5 minutes
  }));
};

export const useRequestPremiumReport = () => {
  return createMutation(() => ({
    mutationFn: (username: string) => apiFetch<{ invoice_link: string }>('/usernames/report/request', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  }));
};

export const usePremiumReport = (username: () => string) => {
  return createQuery(() => ({
    queryKey: ['username', 'report', username()],
    queryFn: () => apiFetch<PremiumReport>(`/usernames/report/view?u=${username()}`),
    enabled: !!username(),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  }));
};

export const useUserHistory = () => {
  return createQuery(() => ({
    queryKey: ['username', 'history'],
    queryFn: () => apiFetch<PremiumReport[]>('/usernames/report/history'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  }));
};

