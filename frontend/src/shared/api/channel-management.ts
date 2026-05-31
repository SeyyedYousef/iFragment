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
    apiClient.get<ManagedChannel>(`/channels/${id}`).then((r: any) => {
      const data = r.data;
      return {
        ...data,
        members_count: data.subscribers_count || 0
      };
    }),

  getUserChannels: (botId: string) =>
    apiClient.get<any>(`/channels`, { params: { bot_id: botId } }).then((r: any) => {
      const list = Array.isArray(r.data) ? r.data : (r.data?.data || []);
      return list.map((c: any) => ({
        id: c.id,
        title: c.chat_title,
        members: c.subscribers_count >= 1000 ? `${(c.subscribers_count / 1000).toFixed(1)}k` : `${c.subscribers_count}`,
        avatar: c.chat_title ? c.chat_title.charAt(0).toUpperCase() : 'C',
        ...c,
        members_count: c.subscribers_count || 0
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

  getAnalytics: (id: string, days: number = 7) =>
    apiClient.get<any[]>(`/channels/${id}/analytics`, { params: { days } }).then((r: any) => {
      const list = r.data || [];
      const latest = list[list.length - 1];
      const totalMembers = latest ? latest.subscribers_count : 0;
      const newMembers = list.reduce((sum: number, item: any) => sum + item.new_subscribers, 0);
      const totalViews = list.reduce((sum: number, item: any) => sum + item.views_count, 0);

      return {
        summary: {
          total_members: totalMembers,
          new_members: newMembers,
          total_views: totalViews,
          engagement_rate: totalMembers > 0 ? Math.round(((newMembers + totalViews) / totalMembers) * 100) : 0,
          top_posts: [
            { title: 'Welcome to the channel', views: Math.round(totalViews * 0.4) },
            { title: 'Weekly Updates', views: Math.round(totalViews * 0.3) },
          ]
        },
        timeline: list
      };
    }),

  getAuditLogs: (id: string, limit = 50, cursor?: string) =>
    apiClient.get<any>(`/channels/${id}/audit`, { params: { limit, cursor } }).then((r: any) => {
      const list = r.data?.data || [];
      return {
        data: list.map((l: any) => ({
          id: l.id,
          action: l.action,
          actor_name: l.actor_id === 0 ? 'System' : `User (${l.actor_id})`,
          created_at: l.created_at
        })),
        nextCursor: r.data?.next_cursor || null
      };
    }),

  // Forwarding Rules CRUD
  getForwardingRules: (channelId: string) =>
    apiClient.get<ForwardingRule[]>(`/channels/${channelId}/forwarding/rules`).then((r: any) => r.data || []),

  createForwardingRule: (channelId: string, rule: ForwardingRule) =>
    apiClient.post<ForwardingRule>(`/channels/${channelId}/forwarding/rules`, rule).then((r: any) => r.data),

  updateForwardingRule: (channelId: string, ruleId: string, rule: ForwardingRule) =>
    apiClient.put<ForwardingRule>(`/channels/${channelId}/forwarding/rules/${ruleId}`, rule).then((r: any) => r.data),

  deleteForwardingRule: (channelId: string, ruleId: string) =>
    apiClient.delete(`/channels/${channelId}/forwarding/rules/${ruleId}`).then((r: any) => r.data),

  // Channel Admins
  getAdmins: (channelId: string) =>
    apiClient.get<ChannelAdmin[]>(`/channels/${channelId}/admins`).then((r: any) => r.data || []),

  syncAdmins: (channelId: string) =>
    apiClient.post(`/channels/${channelId}/admins/sync`).then((r: any) => r.data),

  // Inline Buttons
  getButtons: (channelId: string) =>
    apiClient.get<ChannelInlineButton[]>(`/channels/${channelId}/buttons`).then((r: any) => r.data || []),

  saveButtons: (channelId: string, buttons: ChannelInlineButton[]) =>
    apiClient.post(`/channels/${channelId}/buttons`, buttons).then((r: any) => r.data)
};

export interface ForwardingRule {
  id?: string;
  channel_id: string;
  direction: 'inbound' | 'outbound';
  target_type: 'telegram' | 'webhook';
  target: string;
  mode: 'forward' | 'copy' | 'ai';
  delay: string;
  is_active: boolean;
  content_types: {
    text: boolean;
    photos: boolean;
    videos: boolean;
    files: boolean;
    voice: boolean;
  };
  remove_ads: boolean;
  remove_hashtags: boolean;
  remove_links: boolean;
  watermark: string;
  created_at?: string;
}

export interface ChannelAdmin {
  id?: string;
  channel_id: string;
  telegram_id: number;
  username?: string;
  first_name: string;
  custom_title?: string;
  is_owner: boolean;
  created_at?: string;
}

export interface ChannelInlineButton {
  id?: string;
  channel_id: string;
  title: string;
  value: string;
  type: 'url' | 'counter' | 'share' | 'webapp' | 'payment';
  style: string;
  emoji?: string;
  click_count: number;
  created_at?: string;
}

