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

  throw new Error('No mock found for this route');
};
