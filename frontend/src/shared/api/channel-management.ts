import { apiClient } from './axios.js';

export interface ChannelConfig {
  channel_id: string;
  general: {
    language: string;
    timezone: string;
    signMessages: boolean;
    customSignature: string;
    autoForward: boolean;
    forwardDestination: string;
    disableReactions: boolean;
    name: string;
    description: string;
    photo: string;
    username: string;
    showAdminProfile: boolean;
    hideChatHistory: boolean;
    hideMemberList: boolean;
    antiSpam: boolean;
    slowMode: number;
    autoDelete: number;
    discussionGroupId: string | null;
    joinReqAge: number;
    joinReqPhoto: boolean;
  };
  posting: {
    autoPostEnabled: boolean;
    postInterval: string;
    watermarkEnabled: boolean;
    watermarkText: string;
    silentPosting: boolean;
    deleteAfter: number;
  };
}

export interface ManagedChannel {
  id: string;
  bot_id: string;
  chat_id: number;
  chat_title: string;
  subscribers_count: number;
  subscription_status: 'trial' | 'paid' | 'expired' | 'cancelled';
  trial_ends_at: string;
  paid_until?: string;
  linked_chat_id?: number;
  slow_mode_delay: number;
  auto_delete_time: number;
  sign_messages: boolean;
  protect_content: boolean;
  created_at: string;
  updated_at: string;
}

export const channelApi = {
  getChannel: (id: string) =>
    apiClient.get<ManagedChannel>(`/channels/${id}`).then((r: any) => r.data),

  getUserChannels: (botId: string) =>
    apiClient.get<any[]>(`/channels`, { params: { bot_id: botId } }).then((r: any) => {
      return r.data.map((c: any) => ({
        id: c.id,
        title: c.chat_title,
        members: c.subscribers_count >= 1000 ? `${(c.subscribers_count / 1000).toFixed(1)}k` : `${c.subscribers_count}`,
        avatar: c.chat_title ? c.chat_title.charAt(0).toUpperCase() : 'C',
        ...c,
      }));
    }),

  connectChannel: (botId: string, username: string) =>
    apiClient.post<ManagedChannel>(`/channels/connect`, { bot_id: botId, username }).then((r: any) => r.data),

  disconnectChannel: (id: string) =>
    apiClient.delete(`/channels/${id}`).then((r: any) => r.data),

  getSettings: (id: string) =>
    apiClient.get<ChannelConfig>(`/channels/${id}/settings`).then((r: any) => r.data),

  updateSettings: (id: string, category: string, data: any, version: number) =>
    apiClient.put<ChannelConfig>(`/channels/${id}/settings`, { category, data, version }).then((r: any) => r.data),

  getAnalytics: (_id: string, _days: number = 7) =>
    Promise.resolve({
      summary: {
        total_members: 12500,
        new_members: 145,
        total_views: 45200,
        engagement_rate: 85,
        top_posts: [
          { title: 'Update V2.0', views: 5200 },
          { title: 'Welcome to the channel', views: 3100 },
          { title: 'Weekly News', views: 2800 },
        ]
      }
    }),

  getAuditLogs: (_id: string, _limit = 50, _offset = 0) =>
    Promise.resolve([
      { id: '1', action: 'Posted a message', actor_name: 'Admin Joe', created_at: new Date().toISOString() },
      { id: '2', action: 'Changed channel description', actor_name: 'Owner', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: '3', action: 'Pinned a message', actor_name: 'Admin Joe', created_at: new Date(Date.now() - 7200000).toISOString() },
    ])
};
