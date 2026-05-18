export interface ChannelConfig {
  version: number;
  general: {
    language: string;
    timezone: string;
    signMessages: boolean;
    customSignature: string;
    autoForward: boolean;
    forwardDestination: string;
    disableReactions: boolean;
    
    // New Phase 1 Properties
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

export const channelApi = {
  getChannel: async (id: string) => {
    return {
      id,
      chat_title: 'My Awesome Channel',
      subscription_status: 'paid',
      members_count: 12500,
    };
  },
  getUserChannels: async (userId: string) => {
    // Returns channels specific to the requested user
    return [
      { id: `mock_${userId}_1`, title: 'کانال تستی من', members: '12.5k', avatar: 'M' },
      { id: `mock_${userId}_2`, title: 'اخبار کریپتو', members: '4.2k', avatar: 'C' },
    ];
  },
  getAnalytics: async (_id: string, _days: number) => {
    return {
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
    };
  },
  getSettings: async (_id: string): Promise<ChannelConfig> => {
    return {
      version: 1,
      general: {
        language: 'en',
        timezone: 'UTC',
        signMessages: true,
        customSignature: '— Admin',
        autoForward: false,
        forwardDestination: '',
        disableReactions: false,
        name: 'My Awesome Channel',
        description: 'Welcome to my channel',
        photo: '',
        username: 'my_awesome_channel',
        showAdminProfile: false,
        hideChatHistory: true,
        hideMemberList: false,
        antiSpam: true,
        slowMode: 0,
        autoDelete: 0,
        discussionGroupId: null,
        joinReqAge: 0,
        joinReqPhoto: false,
      },
      posting: {
        autoPostEnabled: false,
        postInterval: 'daily',
        watermarkEnabled: false,
        watermarkText: '@MyChannel',
        silentPosting: true,
        deleteAfter: 0,
      }
    };
  },
  updateSettings: async (_id: string, _section: string, _data: any, version: number) => {
    return { version: version + 1 };
  },
  getAuditLogs: async (_id: string, _limit: number) => {
    return [
      { id: 1, action: 'Posted a message', actor_name: 'Admin Joe', created_at: new Date().toISOString() },
      { id: 2, action: 'Changed channel description', actor_name: 'Owner', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 3, action: 'Pinned a message', actor_name: 'Admin Joe', created_at: new Date(Date.now() - 7200000).toISOString() },
    ];
  }
};
