import * as v from 'valibot';
import { createSignal } from 'solid-js';

export const UsernameSchema = v.pipe(
  v.string(),
  v.minLength(4, 'Username must be at least 4 characters'),
  v.maxLength(32, 'Username is too long'),
  v.regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores allowed')
);

export type Username = v.InferOutput<typeof UsernameSchema>;

export const useUsernameSearch = () => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searchError, setSearchError] = createSignal<string | null>(null);

  const validate = (val: string) => {
    const result = v.safeParse(UsernameSchema, val);
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
