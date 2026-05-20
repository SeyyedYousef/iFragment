export const mockApiLogic = (method: string = 'GET', url: string = '', _data: any = null) => {
  // Extract path from URL
  const path = url.split('?')[0];

  if (path.includes('/bots') && !path.includes('/groups')) {
    if (method.toUpperCase() === 'GET') {
      if (path === '/bots') {
        return [
          {
            id: 'mock-bot-1',
            owner_user_id: 1,
            bot_username: 'mocked_manager_bot',
            bot_name: 'Mocked Manager Bot',
            bot_id: 123456789,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        ];
      }
      return {
        id: 'mock-bot-1',
        owner_user_id: 1,
        bot_username: 'mocked_manager_bot',
        bot_name: 'Mocked Manager Bot',
        bot_id: 123456789,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  if (path.includes('/groups') && !path.includes('/settings') && !path.includes('/analytics')) {
    if (method.toUpperCase() === 'GET') {
      if (path.includes('/audit')) {
        return [
          {
            id: 'log-1',
            group_id: 'mock-group-1',
            actor_id: 12345,
            actor_name: 'Admin User',
            action: 'warned user @spammer',
            created_at: new Date(Date.now() - 5 * 60000).toISOString(),
          },
          {
            id: 'log-2',
            group_id: 'mock-group-1',
            actor_id: 0,
            actor_name: 'System',
            action: 'deleted spam message',
            created_at: new Date(Date.now() - 15 * 60000).toISOString(),
          }
        ];
      }
      if (path.includes('/bots/') && path.includes('/groups')) {
        return [
          {
            id: 'mock-group-1',
            bot_id: 'mock-bot-1',
            chat_id: -100123456,
            chat_title: 'MOCK Telegram Group',
            chat_type: 'supergroup',
            members_count: 1337,
            subscription_status: 'trial',
            trial_ends_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        ];
      }
      return {
        id: 'mock-group-1',
        bot_id: 'mock-bot-1',
        chat_id: -100123456,
        chat_title: 'MOCK Telegram Group',
        chat_type: 'supergroup',
        members_count: 1337,
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  if (path.includes('/settings')) {
    if (method.toUpperCase() === 'GET') {
      return {
        group_id: 'mock-group-1',
        general: { language: 'fa', delete_joins: true },
        content_restrictions: { links: 'delete', forward: 'delete' },
        limits: { max_warnings: 3 },
        quiet_hours: { enabled: false },
        mandatory_membership: { forceJoinEnabled: false },
        custom_texts: { welcome: 'Welcome to Mock Group!' },
        version: 1,
        updated_at: new Date().toISOString(),
      };
    }
    if (method.toUpperCase() === 'PUT') {
      // Simulate successful save
      return {
        group_id: 'mock-group-1',
        version: 2,
        updated_at: new Date().toISOString(),
      };
    }
  }

  if (path.includes('/analytics')) {
    return {
        summary: {
          total_messages: 5000,
          active_users: 150,
          new_members: 20,
          removed_members: 5,
          deleted_messages: 120,
          warnings_issued: 15,
          bans_issued: 2,
          spam_blocked: 450,
          total_members: 1337,
          members_change: 20,
          messages_change_pct: 12.5,
          members_left: 5,
          top_users: [
            { user_id: 1, name: 'User 1', msgs: 150 },
            { user_id: 2, name: 'User 2', msgs: 120 },
            { user_id: 3, name: 'User 3', msgs: 95 }
          ]
        },
      growth: [
        { date: '2026-05-01', members_count: 1300 },
        { date: '2026-05-05', members_count: 1320 },
        { date: '2026-05-10', members_count: 1337 },
      ],
      activity: [
        { date: '2026-05-01', messages_count: 500, active_users: 120 },
        { date: '2026-05-05', messages_count: 600, active_users: 130 },
        { date: '2026-05-10', messages_count: 750, active_users: 150 },
      ]
    };
  }

  if (path.includes('/packages')) {
    return [
      { id: 'trial', name: 'تست 24 ساعته', groups_limit: 1, price_frg: 0 },
      { id: '1_group_monthly', name: '1 گروه - 1 ماه', groups_limit: 1, price_frg: 1.5 },
      { id: '5_group_monthly', name: '5 گروه - 1 ماه', groups_limit: 5, price_frg: 5.0 },
    ];
  }

  if (path.includes('/frg/balance')) {
    return {
      user_id: 1,
      balance: 100.5,
      total_earned: 200,
      total_spent: 99.5,
      updated_at: new Date().toISOString(),
    };
  }

  if (path.includes('/profile/stats')) {
    // Keep dynamic memory in window if present for realistic testing
    const win = window as any;
    if (!win.__mockProfileStats) {
      win.__mockProfileStats = {
        usernamesAnalyzed: 47,
        groupsManaged: 3,
        channelsManaged: 2,
        daysActive: 34,
        currentStreak: 12,
        globalRank: 156,
        totalTaps: 84250,
        totalFrgEarned: 12450,
        totalFrgSpent: 3200,
        frgBalance: 9250,
        memberSince: '2026-04-15T00:00:00Z',
        level: 5,
        xp: 8500,
        xpToNextLevel: 12000,
        isPremium: false,
        emojiStatus: '',
        equippedBorder: '',
        equippedSkin: '',
      };
    }
    return win.__mockProfileStats;
  }

  if (path.includes('/profile/cosmetics')) {
    const win = window as any;
    if (!win.__mockCosmetics) {
      win.__mockCosmetics = [
        { id: 'gold_shimmer', type: 'border', name: 'Gold Shimmer', cost: 5000, purchased: false, borderClass: 'border-gold-shimmer' },
        { id: 'cyber_glow', type: 'border', name: 'Cyber Glow', cost: 7500, purchased: false, borderClass: 'border-cyber-glow' },
        { id: 'rainbow_wave', type: 'border', name: 'Rainbow Wave', cost: 10000, purchased: false, borderClass: 'border-rainbow-wave' },
        { id: 'cosmic_void', type: 'skin', name: 'Cosmic Void', cost: 12000, purchased: false, skinClass: 'bg-cosmic-void' },
        { id: 'neon_matrix', type: 'skin', name: 'Neon Matrix', cost: 15000, purchased: false, skinClass: 'bg-neon-matrix' }
      ];
    }
    if (path.includes('/purchase')) {
      const { cosmeticId } = _data || {};
      const found = win.__mockCosmetics.find((c: any) => c.id === cosmeticId);
      if (found) {
        found.purchased = true;
        if (win.__mockProfileStats) {
          win.__mockProfileStats.frgBalance -= found.cost;
        }
      }
      return { success: true };
    }
    if (path.includes('/equip')) {
      const { cosmeticId, type } = _data || {};
      if (win.__mockProfileStats) {
        if (type === 'border') {
          win.__mockProfileStats.equippedBorder = win.__mockProfileStats.equippedBorder === cosmeticId ? '' : cosmeticId;
        } else if (type === 'skin') {
          win.__mockProfileStats.equippedSkin = win.__mockProfileStats.equippedSkin === cosmeticId ? '' : cosmeticId;
        }
      }
      return { success: true };
    }
    return win.__mockCosmetics;
  }

  if (path.includes('/profile/emoji-status')) {
    const win = window as any;
    const { emoji } = _data || {};
    if (win.__mockProfileStats) {
      win.__mockProfileStats.emojiStatus = emoji;
    }
    return { success: true };
  }

  if (path.includes('/profile/premium/checkout')) {
    const win = window as any;
    // Simulate successful payment instantly or return mock invoice
    setTimeout(() => {
      if (win.__mockProfileStats) {
        win.__mockProfileStats.isPremium = true;
      }
    }, 1500);
    return { invoice_link: 'https://t.me/stars?start=stars_premium_1m_mock' };
  }

  if (path.includes('/profile/achievements')) {
    return [
      { id: 'first_steps', unlocked: true, unlockedAt: '2026-04-15', progress: 1, target: 1 },
      { id: 'home_base', unlocked: false, progress: 0, target: 1 },
      { id: 'tap_novice', unlocked: true, unlockedAt: '2026-04-16', progress: 1000, target: 1000 },
      { id: 'mining_machine', unlocked: false, progress: 84250, target: 100000 },
      { id: 'frg_millionaire', unlocked: false, progress: 12450, target: 1000000 },
      { id: 'first_scan', unlocked: true, unlockedAt: '2026-04-15', progress: 1, target: 1 },
      { id: 'whale_hunter', unlocked: false, progress: 47, target: 100 },
      { id: 'data_scientist', unlocked: false, progress: 47, target: 500 },
      { id: 'social_butterfly', unlocked: true, unlockedAt: '2026-04-20', progress: 5, target: 5 },
      { id: 'army_builder', unlocked: false, progress: 8, target: 50 },
      { id: 'network_king', unlocked: false, progress: 8, target: 200 },
      { id: 'group_guardian', unlocked: true, unlockedAt: '2026-04-18', progress: 1, target: 1 },
      { id: 'channel_commander', unlocked: true, unlockedAt: '2026-04-22', progress: 1, target: 1 },
      { id: 'empire_builder', unlocked: false, progress: 5, target: 10 },
      { id: 'week_warrior', unlocked: true, unlockedAt: '2026-04-22', progress: 7, target: 7 },
      { id: 'month_master', unlocked: false, progress: 12, target: 30 },
      { id: 'legendary', unlocked: false, progress: 12, target: 100 },
      { id: 'early_adopter', unlocked: true, unlockedAt: '2026-04-15', progress: 1, target: 1 },
      { id: 'premium_user', unlocked: false, progress: 0, target: 1 },
      { id: 'bug_hunter', unlocked: false, progress: 0, target: 1 },
    ];
  }

  if (path.includes('/profile/referral')) {
    return {
      referralCode: 'ref_12345',
      totalInvited: 8,
      totalEarned: 80000,
      friends: [
        { id: 101, name: 'Alex K.', joinedAt: '2026-04-20', earned: 10000 },
        { id: 102, name: 'Sara M.', joinedAt: '2026-04-21', earned: 10000 },
        { id: 103, name: 'Mike R.', joinedAt: '2026-04-25', earned: 10000 },
        { id: 104, name: 'Nina P.', joinedAt: '2026-05-01', earned: 10000 },
        { id: 105, name: 'David L.', joinedAt: '2026-05-05', earned: 10000 },
      ],
    };
  }

  throw new Error('No mock found for this route');
};
