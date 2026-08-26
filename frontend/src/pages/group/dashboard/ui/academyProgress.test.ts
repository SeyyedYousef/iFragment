import { describe, expect, it } from 'vitest';
import type { GroupSettings } from '@/entities/group/index.js';
import { calculateAcademyProgress } from './academyProgress.js';

describe('academyProgress mapping', () => {
	it('returns 0% for empty settings', () => {
		const result = calculateAcademyProgress(null);
		expect(result.percentage).toBe(0);
		expect(result.completedCount).toBe(0);
		expect(result.totalCount).toBe(7);
	});

	it('calculates correct percentage based on real schema keys', () => {
		const mockSettings: GroupSettings = {
			group_id: '123-uuid',
			version: 1,
			updated_at: new Date().toISOString(),
			general: {
				welcome_message: true,
			},
			content_restrictions: {
				removeLinks: { enabled: true, window: 'Always', penalty: 'delete' },
			},
			limits: {
				floodMessages: 5,
			},
			quiet_hours: {
				periods: [{ id: 'p1', start: '22:00', end: '08:00' }],
			},
			mandatory_membership: {
				required_channels: ['@testchannel'],
			},
			custom_texts: {
				welcomeText: 'Welcome!',
			},
			dynamic_bio: {
				enabled: true,
			} as any,
		};

		const result = calculateAcademyProgress(mockSettings);
		expect(result.percentage).toBe(100);
		expect(result.completedCount).toBe(7);
	});

	it('handles partial configuration correctly', () => {
		const mockSettings: GroupSettings = {
			group_id: '123-uuid',
			version: 1,
			updated_at: new Date().toISOString(),
			general: {
				language: 'fa',
			},
			content_restrictions: {
				removeLinks: { enabled: true, window: 'Always', penalty: 'delete' },
			},
			limits: {},
			quiet_hours: {},
			mandatory_membership: {},
			custom_texts: {},
		};

		const result = calculateAcademyProgress(mockSettings);
		expect(result.completedCount).toBe(1);
		expect(result.percentage).toBe(Math.round((1 / 7) * 100));
		expect(result.lessons.find((l) => l.key === 'antiSpam')?.done).toBe(true);
		expect(result.lessons.find((l) => l.key === 'ephemeral')?.done).toBe(false);
	});
});
