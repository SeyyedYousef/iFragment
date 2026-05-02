import * as v from 'valibot';
import { createSignal } from 'solid-js';

// Telegram Username Rules:
// 1. Length 5-32 (Premium can be 4, but 5 is standard for public)
// 2. Starts with a letter
// 3. No trailing underscores
// 4. No consecutive underscores
export const UsernameSchema = v.pipe(
  v.string(),
  v.minLength(4, 'Username must be at least 4 characters'),
  v.maxLength(32, 'Username is too long'),
  v.regex(/^[a-zA-Z]/, 'Username must start with a letter'),
  v.regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores allowed'),
  v.regex(/^(?!.*__)/, 'Consecutive underscores are not allowed'),
  v.regex(/[^_]$/, 'Username cannot end with an underscore')
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
