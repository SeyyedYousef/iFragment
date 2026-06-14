import * as v from 'valibot';
import { createSignal } from 'solid-js';

import { t } from '@/shared/i18n/index.js';

// Telegram Username Rules:
// 1. Length 5-32 (Premium can be 4, but 5 is standard for public)
// 2. Starts with a letter
// 3. No trailing underscores
// 4. No consecutive underscores
// Collectible Username Schema (4-32 characters)
export const CollectibleUsernameSchema = v.pipe(
  v.string(),
  v.minLength(4, () => t('entities.username.validation.minLength')),
  v.maxLength(32, () => t('entities.username.validation.maxLength')),
  v.regex(/^[a-zA-Z]/, () => t('entities.username.validation.startLetter')),
  v.regex(/^[a-zA-Z0-9_]+$/, () => t('entities.username.validation.invalidChars')),
  v.regex(/^(?!.*__)/, () => t('entities.username.validation.consecutiveUnderscores')),
  v.regex(/[^_]$/, () => t('entities.username.validation.trailingUnderscore'))
);

// Standard Username Schema (5-32 characters)
export const StandardUsernameSchema = v.pipe(
  v.string(),
  v.minLength(5, () => t('entities.username.validation.minLengthStandard')),
  v.maxLength(32, () => t('entities.username.validation.maxLength')),
  v.regex(/^[a-zA-Z]/, () => t('entities.username.validation.startLetter')),
  v.regex(/^[a-zA-Z0-9_]+$/, () => t('entities.username.validation.invalidChars')),
  v.regex(/^(?!.*__)/, () => t('entities.username.validation.consecutiveUnderscores')),
  v.regex(/[^_]$/, () => t('entities.username.validation.trailingUnderscore'))
);

// Fallback unified schema for compatibility
export const UsernameSchema = CollectibleUsernameSchema;

export type Username = v.InferOutput<typeof UsernameSchema>;

export const useUsernameSearch = () => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [isCollectibleOnly, setIsCollectibleOnly] = createSignal<boolean>(false);

  const validate = (val: string, tab?: 'username' | 'collectibles' | 'gifts') => {
    // Ensure val is a string to prevent runtime errors from unexpected inputs (e.g., event objects)
    const safeVal = typeof val === 'string' ? val : '';
    
    // Remove @ if present
    const cleanVal = safeVal.startsWith('@') ? safeVal.substring(1) : safeVal;
    
    // Select correct schema based on tab context (use CollectibleUsernameSchema if length is 4 since 4-char usernames must be collectibles)
    const schema = (tab === 'username' && cleanVal.length !== 4) ? StandardUsernameSchema : CollectibleUsernameSchema;
    
    const result = v.safeParse(schema, cleanVal);
    if (!result.success) {
      setSearchError(result.issues[0].message);
      setIsCollectibleOnly(false);
      return false;
    }

    // Check if it's strictly collectible length (4 chars)
    setIsCollectibleOnly(cleanVal.length === 4);

    setSearchError(null);
    return true;
  };

  return {
    searchQuery,
    setSearchQuery,
    searchError,
    setSearchError,
    isCollectibleOnly,
    validate
  };
};
