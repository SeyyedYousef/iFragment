import { describe, it, expect, vi } from 'vitest';
import * as v from 'valibot';

// Mock the i18n t function before importing the schema
vi.mock('@/shared/i18n/index.js', () => ({
  t: (key: string) => key
}));

import { UsernameSchema } from './index.js';

describe('UsernameSchema', () => {
  it('should accept valid usernames', () => {
    expect(v.safeParse(UsernameSchema, 'fragment').success).toBe(true);
    expect(v.safeParse(UsernameSchema, 'user_123').success).toBe(true);
    expect(v.safeParse(UsernameSchema, 'a123').success).toBe(true);
  });

  it('should reject usernames that are too short', () => {
    const result = v.safeParse(UsernameSchema, 'abc');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0].message).toBe('entities.username.validation.minLength');
    }
  });

  it('should reject usernames that are too long', () => {
    const result = v.safeParse(UsernameSchema, 'a'.repeat(33));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues[0].message).toBe('entities.username.validation.maxLength');
    }
  });

  it('should reject usernames starting with a number or underscore', () => {
    expect(v.safeParse(UsernameSchema, '1user').success).toBe(false);
    expect(v.safeParse(UsernameSchema, '_user').success).toBe(false);
  });

  it('should reject usernames with invalid characters', () => {
    expect(v.safeParse(UsernameSchema, 'user-name').success).toBe(false);
    expect(v.safeParse(UsernameSchema, 'user.name').success).toBe(false);
    expect(v.safeParse(UsernameSchema, 'user name').success).toBe(false);
  });

  it('should reject consecutive underscores', () => {
    expect(v.safeParse(UsernameSchema, 'user__name').success).toBe(false);
  });

  it('should reject usernames ending with an underscore', () => {
    expect(v.safeParse(UsernameSchema, 'username_').success).toBe(false);
  });
});
