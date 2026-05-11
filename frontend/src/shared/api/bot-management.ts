import { apiClient } from './axios.js';

// ─── Types ────────────────────────────────────────────────

export interface ManagedBot {
  id: string;
  owner_user_id: number;
  bot_username: string;
  bot_name: string;
  bot_id: number;
  status: 'active' | 'inactive' | 'revoked';
  created_at: string;
  updated_at: string;
}

export interface ManagedGroup {
  id: string;
  bot_id: string;
  chat_id: number;
  chat_title: string;
  chat_type: 'group' | 'supergroup' | 'channel';
  members_count: number;
  subscription_status: 'trial' | 'paid' | 'expired' | 'cancelled';
  trial_ends_at: string;
  paid_until?: string;
  created_at: string;
  updated_at: string;
}

export interface GroupSettings {
  group_id: string;
  general: Record<string, unknown>;
  content_restrictions: Record<string, unknown>;
  limits: Record<string, unknown>;
  quiet_hours: Record<string, unknown>;
  mandatory_membership: Record<string, unknown>;
  custom_texts: Record<string, unknown>;
  version: number;
  updated_at: string;
  updated_by?: number;
}

export interface SubscriptionPackage {
  id: string;
  name: string;
  groups_limit: number;
  price_frg: number;
  discount?: string;
}

export interface FRGBalance {
  user_id: number;
  balance: number;
  total_earned: number;
  total_spent: number;
  updated_at: string;
}

export interface FRGTransaction {
  id: string;
  user_id: number;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface PurchaseOption {
  id: string;
  method: 'stars' | 'toncoin';
  frg_amount: number;
  price: number;
  currency: string;
  discount?: string;
  popular?: boolean;
}

export interface AnalyticsSummary {
  total_members: number;
  members_change: number;
  total_messages: number;
  messages_change_pct: number;
  spam_blocked: number;
  new_members: number;
  members_left: number;
  active_users: number;
}

export interface DailyMetric {
  date: string;
  value: number;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  growth: DailyMetric[];
  activity: DailyMetric[];
}

export interface AuditLog {
  id: string;
  group_id: string;
  actor_id: number;
  action: string;
  target_type?: string;
  target_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ─── Bot API ──────────────────────────────────────────────

export const botApi = {
  listBots: () =>
    apiClient.get<ManagedBot[]>('/bots').then((r: any) => r.data),

  registerBot: (data: { token: string; username: string; name: string; bot_id: number }) =>
    apiClient.post<ManagedBot>('/bots', data).then((r: any) => r.data),

  getBot: (botId: string) =>
    apiClient.get<ManagedBot>(`/bots/${botId}`).then((r: any) => r.data),

  revokeBot: (botId: string) =>
    apiClient.delete(`/bots/${botId}`).then((r: any) => r.data),

  listGroups: (botId: string) =>
    apiClient.get<ManagedGroup[]>(`/bots/${botId}/groups`).then((r: any) => r.data),
};

// ─── Group API ────────────────────────────────────────────

export const groupApi = {
  getGroup: (groupId: string) =>
    apiClient.get<ManagedGroup>(`/groups/${groupId}`).then((r: any) => r.data),

  getSettings: (groupId: string) =>
    apiClient.get<GroupSettings>(`/groups/${groupId}/settings`).then((r: any) => r.data),

  updateSettings: (groupId: string, category: string, data: unknown, version: number) =>
    apiClient.put<GroupSettings>(`/groups/${groupId}/settings`, { category, data, version }).then((r: any) => r.data),

  getAnalytics: (groupId: string, days: number = 7) =>
    apiClient.get<AnalyticsData>(`/groups/${groupId}/analytics`, { params: { days } }).then((r: any) => r.data),

  getAuditLogs: (groupId: string, limit = 50, offset = 0) =>
    apiClient.get<AuditLog[]>(`/groups/${groupId}/audit`, { params: { limit, offset } }).then((r: any) => r.data),
};

// ─── Subscription API ─────────────────────────────────────

export const subscriptionApi = {
  getPackages: () =>
    apiClient.get<SubscriptionPackage[]>('/subscription/packages').then((r: any) => r.data),

  subscribe: (groupId: string, packageId: string) =>
    apiClient.post('/subscription/subscribe', { group_id: groupId, package_id: packageId }).then((r: any) => r.data),
};

// ─── FRG Token API ────────────────────────────────────────

export const frgApi = {
  getBalance: () =>
    apiClient.get<FRGBalance>('/frg/balance').then((r: any) => r.data),

  getTransactions: (limit = 20, offset = 0) =>
    apiClient.get<FRGTransaction[]>('/frg/transactions', { params: { limit, offset } }).then((r: any) => r.data),
};

// ─── Marketplace API ──────────────────────────────────────

export const marketplaceApi = {
  getOptions: () =>
    apiClient.get<PurchaseOption[]>('/marketplace/options').then((r: any) => r.data),

  purchaseWithStars: (optionId: string, telegramChargeId: string) =>
    apiClient.post<FRGTransaction>('/marketplace/purchase/stars', {
      option_id: optionId,
      telegram_charge_id: telegramChargeId,
    }).then((r: any) => r.data),

  purchaseWithToncoin: (optionId: string, txHash: string) =>
    apiClient.post<FRGTransaction>('/marketplace/purchase/toncoin', {
      option_id: optionId,
      tx_hash: txHash,
    }).then((r: any) => r.data),

  convertAirdropCoins: (coins: number) =>
    apiClient.post<FRGTransaction>('/marketplace/convert/airdrop', { coins }).then((r: any) => r.data),
};
