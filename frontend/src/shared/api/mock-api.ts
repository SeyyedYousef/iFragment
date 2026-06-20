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
					},
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
					},
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
					},
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

	if (path.includes('/settings') && !path.includes('/channels')) {
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

	if (path.includes('/analytics') && !path.includes('/channels')) {
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
					{ user_id: 3, name: 'User 3', msgs: 95 },
				],
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
			],
		};
	}

	if (path.includes('/packages')) {
		return [
			{ id: '1_month', name: '1 Month', duration_months: 1, price_usd: 1.99, price_per_month: 1.99, price_stars: 150, price_frg: 1.99 },
			{ id: '3_months', name: '3 Months', duration_months: 3, price_usd: 4.49, price_per_month: 1.49, price_stars: 350, price_frg: 4.49, discount: '25%', badge: 'popular' },
			{ id: '6_months', name: '6 Months', duration_months: 6, price_usd: 7.49, price_per_month: 1.29, price_stars: 575, price_frg: 7.49, discount: '35%' },
			{ id: '12_months', name: '12 Months', duration_months: 12, price_usd: 11.99, price_per_month: 1.00, price_stars: 925, price_frg: 11.99, discount: '50%', badge: 'best_value' },
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
				{
					id: 'gold_shimmer',
					type: 'border',
					name: 'Gold Shimmer',
					cost: 5000,
					purchased: false,
					borderClass: 'border-gold-shimmer',
				},
				{
					id: 'cyber_glow',
					type: 'border',
					name: 'Cyber Glow',
					cost: 7500,
					purchased: false,
					borderClass: 'border-cyber-glow',
				},
				{
					id: 'rainbow_wave',
					type: 'border',
					name: 'Rainbow Wave',
					cost: 10000,
					purchased: false,
					borderClass: 'border-rainbow-wave',
				},
				{
					id: 'cosmic_void',
					type: 'skin',
					name: 'Cosmic Void',
					cost: 12000,
					purchased: false,
					skinClass: 'bg-cosmic-void',
				},
				{
					id: 'neon_matrix',
					type: 'skin',
					name: 'Neon Matrix',
					cost: 15000,
					purchased: false,
					skinClass: 'bg-neon-matrix',
				},
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
					win.__mockProfileStats.equippedBorder =
						win.__mockProfileStats.equippedBorder === cosmeticId ? '' : cosmeticId;
				} else if (type === 'skin') {
					win.__mockProfileStats.equippedSkin =
						win.__mockProfileStats.equippedSkin === cosmeticId ? '' : cosmeticId;
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

	// ─── CHANNEL MANAGEMENT MOCKS ────────────────────────────
	if (path.includes('/channels')) {
		const methodUp = (method || 'GET').toUpperCase();
		const channelId = path.match(/\/channels\/([^/]+)/)?.[1] || 'mock-ch-1';
		const channelProfiles: Record<string, any> = {
			'mock-ch-1': {
				name: 'iFragment Channel',
				description: 'Official iFragment channel',
				username: 'ifragment_channel',
				timezone: 'Asia/Tehran',
				signature: 'iFragment',
				watermark: '@ifragment_channel',
			},
			'mock-ch-2': {
				name: 'Tech News FA',
				description: 'Daily Persian tech updates',
				username: 'tech_news_fa',
				timezone: 'Asia/Kabul',
				signature: 'Tech News FA',
				watermark: '@tech_news_fa',
			},
		};
		const channelProfile = channelProfiles[channelId] || {
			name: 'Unknown Channel',
			description: '',
			username: '',
			timezone: 'UTC',
			signature: '',
			watermark: '',
		};

		// POST /channels/connect
		if (path.endsWith('/connect') && methodUp === 'POST') {
			return {
				id: 'mock-ch-new',
				bot_id: 'mock-bot-1',
				chat_id: -1001999888777,
				chat_title: _data?.username?.replace('@', '') || 'New Channel',
				subscribers_count: 0,
				subscription_status: 'trial',
				trial_ends_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};
		}

		// /channels/:id/forwarding/rules
		if (path.includes('/forwarding/rules')) {
			if (methodUp === 'GET') {
				return [
					{
						id: 'rule-1',
						channel_id: channelId,
						direction: 'inbound',
						target_type: 'telegram',
						target: '@target_channel',
						mode: 'copy',
						delay: '0s',
						is_active: true,
						content_types: { text: true, photos: true, videos: true, files: false, voice: false },
						remove_ads: true,
						remove_hashtags: false,
						remove_links: false,
						watermark: '',
						created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
					},
				];
			}
			if (methodUp === 'POST') {
				return { id: `rule-new-${Date.now()}`, ..._data, created_at: new Date().toISOString() };
			}
			if (methodUp === 'PUT') {
				return { ..._data, updated_at: new Date().toISOString() };
			}
			if (methodUp === 'DELETE') {
				return { success: true };
			}
		}

		// /channels/:id/admins
		if (path.includes('/admins')) {
			if (path.includes('/sync') && methodUp === 'POST') {
				return { synced: 3 };
			}
			return [
				{
					id: 'admin-1',
					channel_id: channelId,
					telegram_id: 123456,
					username: 'admin_user',
					first_name: 'Admin',
					custom_title: 'مدیر اصلی',
					is_owner: true,
					created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
				},
				{
					id: 'admin-2',
					channel_id: channelId,
					telegram_id: 789012,
					username: 'editor_user',
					first_name: 'Editor',
					custom_title: 'ویرایشگر',
					is_owner: false,
					created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
				},
			];
		}

		// /channels/:id/buttons
		if (path.includes('/buttons')) {
			if (methodUp === 'POST') {
				return { success: true, count: Array.isArray(_data) ? _data.length : 0 };
			}
			return [
				{
					id: 'btn-1',
					channel_id: channelId,
					title: '🔗 وبسایت ما',
					value: 'https://example.com',
					type: 'url',
					style: 'primary',
					emoji: '🔗',
					click_count: 342,
					created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
				},
				{
					id: 'btn-2',
					channel_id: channelId,
					title: '❤️ لایک',
					value: 'like',
					type: 'counter',
					style: 'secondary',
					emoji: '❤️',
					click_count: 1284,
					created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
				},
			];
		}

		// /channels/:id/analytics
		if (path.includes('/analytics')) {
			const now = Date.now();
			return Array.from({ length: 7 }, (_, i) => ({
				date: new Date(now - (6 - i) * 86400000).toISOString().split('T')[0],
				subscribers_count: 12350 + i * 25,
				new_subscribers: 15 + Math.floor(Math.random() * 20),
				views_count: 3500 + Math.floor(Math.random() * 2000),
				posts_count: 3 + Math.floor(Math.random() * 4),
			}));
		}

		// /channels/:id/audit
		if (path.includes('/audit')) {
			return [
				{
					id: 'audit-1',
					channel_id: channelId,
					actor_id: 123456,
					action: 'تنظیمات فوروارد تغییر کرد',
					created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
				},
				{
					id: 'audit-2',
					channel_id: channelId,
					actor_id: 123456,
					action: 'پست جدید ارسال شد',
					created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
				},
				{
					id: 'audit-3',
					channel_id: channelId,
					actor_id: 0,
					action: 'پاسخ خودکار فعال شد',
					created_at: new Date(Date.now() - 12 * 3600000).toISOString(),
				},
				{
					id: 'audit-4',
					channel_id: channelId,
					actor_id: 789012,
					action: 'ادمین جدید اضافه شد',
					created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
				},
				{
					id: 'audit-5',
					channel_id: channelId,
					actor_id: 123456,
					action: 'دکمه شیشه‌ای جدید ساخته شد',
					created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
				},
			];
		}

		// /channels/:id/settings
		if (path.includes('/settings')) {
			if (methodUp === 'PUT') {
				return { version: (_data?.version || 1) + 1, updated_at: new Date().toISOString() };
			}
			return {
				channel_id: channelId,
				general: {
					language: 'fa',
					timezone: channelProfile.timezone,
					signMessages: true,
					customSignature: channelProfile.signature,
					autoForward: false,
					forwardDestination: '',
					disableReactions: false,
					name: channelProfile.name,
					description: channelProfile.description,
					photo: '',
					username: channelProfile.username,
					showAdminProfile: true,
					hideChatHistory: false,
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
					postInterval: '1h',
					watermarkEnabled: true,
					watermarkText: channelProfile.watermark,
					silentPosting: false,
					deleteAfter: 0,
				},
				inline_buttons: { enabled: true, preset: 'like' },
				forwarding: { enabled: true },
				dynamic_bio: {
					enabled: false,
					bioTemplate: `${channelProfile.name} | Members: $members`,
					displayInName: false,
					nameTemplate: '',
					interval: '10m',
				},
				auto_responder: {
					enabled: true,
					rules: [],
				},
				version: 1,
				updated_at: new Date().toISOString(),
			};
		}

		// GET /channels (list) or GET /channels/:id (detail)
		if (methodUp === 'GET') {
			// Check if it's a specific channel: /channels/some-id (no further sub-path)
			const channelIdMatch = path.match(/\/channels\/([^/]+)$/);
			if (channelIdMatch) {
				const chId = channelIdMatch[1];
				const mockChannels: Record<string, any> = {
					'mock-ch-1': {
						id: 'mock-ch-1',
						bot_id: 'mock-bot-1',
						chat_id: -1001234567890,
						chat_title: 'iFragment Channel',
						subscribers_count: 12500,
						subscription_status: 'paid',
						trial_ends_at: new Date(Date.now() - 20 * 86400000).toISOString(),
						paid_until: new Date(Date.now() + 25 * 86400000).toISOString(),
						linked_chat_id: -1001111222333,
						slow_mode_delay: 0,
						auto_delete_time: 0,
						sign_messages: true,
						protect_content: false,
						members_count: 12500,
						created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
						updated_at: new Date().toISOString(),
					},
					'mock-ch-2': {
						id: 'mock-ch-2',
						bot_id: 'mock-bot-1',
						chat_id: -1009876543210,
						chat_title: 'Tech News FA',
						subscribers_count: 8740,
						subscription_status: 'trial',
						trial_ends_at: new Date(Date.now() + 3 * 86400000).toISOString(),
						slow_mode_delay: 0,
						auto_delete_time: 0,
						sign_messages: false,
						protect_content: true,
						members_count: 8740,
						created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
						updated_at: new Date().toISOString(),
					},
				};
				return (
					mockChannels[chId] || {
						id: chId,
						bot_id: 'mock-bot-1',
						chat_id: -1000000000000,
						chat_title: 'Unknown Channel',
						subscribers_count: 0,
						subscription_status: 'trial',
						trial_ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
						members_count: 0,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					}
				);
			}

			// /channels (list all)
			return [
				{
					id: 'mock-ch-1',
					bot_id: 'mock-bot-1',
					chat_id: -1001234567890,
					chat_title: 'iFragment Channel',
					subscribers_count: 12500,
					subscription_status: 'paid',
					members_count: 12500,
					created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
					updated_at: new Date().toISOString(),
				},
				{
					id: 'mock-ch-2',
					bot_id: 'mock-bot-1',
					chat_id: -1009876543210,
					chat_title: 'Tech News FA',
					subscribers_count: 8740,
					subscription_status: 'trial',
					members_count: 8740,
					created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
					updated_at: new Date().toISOString(),
				},
			];
		}

		// DELETE /channels/:id
		if (methodUp === 'DELETE') {
			return { success: true };
		}
	}

	throw new Error('No mock found for this route');
};
