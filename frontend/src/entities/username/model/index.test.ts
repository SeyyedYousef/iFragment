import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';

// Mock the i18n t function before importing the schema
vi.mock('@/shared/i18n/index.js', () => ({
	t: (key: string) => key,
}));

import { CollectibleUsernameSchema, StandardUsernameSchema, UsernameSchema } from './index.js';

describe('CollectibleUsernameSchema', () => {
	it('should accept valid collectible usernames (4+ chars)', () => {
		expect(v.safeParse(CollectibleUsernameSchema, 'a123').success).toBe(true);
		expect(v.safeParse(CollectibleUsernameSchema, 'user').success).toBe(true);
		expect(v.safeParse(CollectibleUsernameSchema, 'user_123').success).toBe(true);
	});

	it('should reject usernames that are too short (less than 4)', () => {
		expect(v.safeParse(CollectibleUsernameSchema, 'abc').success).toBe(false);
	});

	it('should reject usernames starting with a number', () => {
		expect(v.safeParse(CollectibleUsernameSchema, '1user').success).toBe(false);
		expect(v.safeParse(CollectibleUsernameSchema, '9999').success).toBe(false);
	});
});

describe('StandardUsernameSchema', () => {
	it('should accept valid standard usernames (5+ chars)', () => {
		expect(v.safeParse(StandardUsernameSchema, 'user1').success).toBe(true);
		expect(v.safeParse(StandardUsernameSchema, 'user_123').success).toBe(true);
	});

	it('should reject standard usernames that are too short (less than 5)', () => {
		expect(v.safeParse(StandardUsernameSchema, 'user').success).toBe(false);
	});

	it('should reject usernames starting with a number', () => {
		expect(v.safeParse(StandardUsernameSchema, '1user').success).toBe(false);
	});
});

describe('Common Username Constraints', () => {
	it('should reject starting with an underscore', () => {
		expect(v.safeParse(UsernameSchema, '_user').success).toBe(false);
	});

	it('should reject invalid characters', () => {
		expect(v.safeParse(UsernameSchema, 'user-name').success).toBe(false);
		expect(v.safeParse(UsernameSchema, 'user.name').success).toBe(false);
	});

	it('should reject consecutive underscores', () => {
		expect(v.safeParse(UsernameSchema, 'user__name').success).toBe(false);
	});

	it('should reject ending with an underscore', () => {
		expect(v.safeParse(UsernameSchema, 'username_').success).toBe(false);
	});
});
