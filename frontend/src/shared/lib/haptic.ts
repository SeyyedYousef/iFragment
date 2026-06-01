import { hapticFeedback } from '@tma.js/sdk-solid';
import { profileSettings } from '@/shared/store/profile.js';

type Impact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type Notif  = 'success' | 'warning' | 'error';

/** Setting-aware wrapper. Use this everywhere instead of raw hapticFeedback. */
export const haptic = {
  impact(style: Impact = 'light') {
    if (!profileSettings().hapticEnabled) return;
    try { hapticFeedback.impactOccurred(style); } catch {}
  },
  notify(type: Notif) {
    if (!profileSettings().hapticEnabled) return;
    try { hapticFeedback.notificationOccurred(type); } catch {}
  },
  selection() {
    if (!profileSettings().hapticEnabled) return;
    try { hapticFeedback.selectionChanged(); } catch {}
  },
};
