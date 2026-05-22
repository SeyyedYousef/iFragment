import { createQuery } from '@tanstack/solid-query';
import { apiFetch } from '@/shared/api/base.js';
import { createSignal, createEffect, onCleanup } from 'solid-js';

export interface CollectionStats {
  total_supply: number;
  holders: number;
  floor_price: string;
  total_volume: string;
  active_auctions: number;
  revenue: string;
  daily_volume: number;
  sales_count: number;
  highest_sale: number;
  listed_ratio: number;
  top_holders?: Array<{ address: string; count: number }>;
  top_sales?: Array<{ username: string; price: number; date: string }>;
  distribution?: {
    single: number;
    small: number;
    medium: number;
    large: number;
    whale: number;
    total_uniq: number;
  };
}

export interface AvailabilityStatus {
  username: string;
  status: 'available' | 'taken' | 'on_auction' | 'on_sale' | 'purchase_available' | string;
}

export interface QuickCheck {
  username: string;
  status: string;
  length: number;
  rarity_score: number;
  sale_status: string;
  buy_now_price?: number;
  highest_bid?: number;
  end_time?: string;
  fragment_url: string;
  search_popularity: number;
  linguistic_score: number;
}

export interface PriceEstimate {
  p10_ton: number;
  p50_ton: number;
  p90_ton: number;
  confidence: number;
  method: string;
  signals?: string[];
}

export interface SaleRecord {
  price: number;
  date: string;
  from?: string;
  to?: string;
}

export interface PremiumReport {
  username: string;
  length: number;
  contains_numbers: boolean;
  is_dictionary_word: boolean;

  status: string;
  peer_type: string;

  is_verified: boolean;
  is_premium: boolean;
  is_scam: boolean;
  is_fake: boolean;

  participants_count?: number;

  owner_address?: string;

  sale_status: string;
  highest_bid?: number;
  buy_now_price?: number;
  end_time?: string;

  mint_date?: string;
  previous_owners?: string[];
  past_sales?: SaleRecord[];

  owner_wallet_balance?: number;
  owner_other_assets?: number;

  rarity_score: number;
  linguistic_score: number;
  estimated_value?: number;
  value_estimate?: PriceEstimate;
  search_popularity: number;
  fragment_url: string;
  exchange_rate?: number;

  generated_at: string;
}

export const useCollectionStats = () => {
  return createQuery(() => ({
    queryKey: ['username', 'collection', 'stats'],
    queryFn: () => apiFetch<CollectionStats>('/usernames/collection/stats'),
    staleTime: 60 * 1000, // 1 minute
  }));
};



export const useUsernameQuickAnalysis = (username: () => string) => {
  const [debouncedUsername, setDebouncedUsername] = createSignal(username());

  createEffect(() => {
    const val = username();
    const timeout = setTimeout(() => {
      setDebouncedUsername(val);
    }, 450); // 450ms debounce
    onCleanup(() => clearTimeout(timeout));
  });

  return createQuery(() => ({
    queryKey: ['username', 'quick', debouncedUsername()],
    queryFn: () => apiFetch<QuickCheck>(`/usernames/quick?u=${debouncedUsername()}`),
    enabled: !!debouncedUsername() && debouncedUsername().length >= 4,
    staleTime: 3 * 60 * 1000, // 3 minutes
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

export const requestPremiumReport = (username: string) => {
  return apiFetch<{ invoice_link: string }>('/usernames/report/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
};

export const useTrendingUsernames = () => {
  return createQuery(() => ({
    queryKey: ['username', 'trending'],
    queryFn: () => apiFetch<string[]>('/usernames/trending'),
    staleTime: 10 * 60 * 1000, // 10 minutes
  }));
};

