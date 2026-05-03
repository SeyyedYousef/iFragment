import * as v from 'valibot';
import { createSignal } from 'solid-js';

import { t } from '@/shared/i18n/index.js';

// Telegram Username Rules:
// 1. Length 5-32 (Premium can be 4, but 5 is standard for public)
// 2. Starts with a letter
// 3. No trailing underscores
// 4. No consecutive underscores
export const UsernameSchema = v.pipe(
  v.string(),
  v.minLength(4, () => t('entities.username.validation.minLength' as any)),
  v.maxLength(32, () => t('entities.username.validation.maxLength' as any)),
  v.regex(/^[a-zA-Z]/, () => t('entities.username.validation.startLetter' as any)),
  v.regex(/^[a-zA-Z0-9_]+$/, () => t('entities.username.validation.invalidChars' as any)),
  v.regex(/^(?!.*__)/, () => t('entities.username.validation.consecutiveUnderscores' as any)),
  v.regex(/[^_]$/, () => t('entities.username.validation.trailingUnderscore' as any))
);

export type Username = v.InferOutput<typeof UsernameSchema>;

export const useUsernameSearch = () => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchError, setSearchError] = createSignal<string | null>(null);

  const validate = (val: string) => {
    // Remove @ if present
    const cleanVal = val.startsWith('@') ? val.substring(1) : val;
    const result = v.safeParse(UsernameSchema, cleanVal);
    if (!result.success) {
      setSearchError(result.issues[0].message);
      return false;
    }
    setSearchError(null);
    return true;
  };

  return {
    searchQuery,
    setSearchQuery,
    searchError,
    setSearchError,
    validate
  };
};
