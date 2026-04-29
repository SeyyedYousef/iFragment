/**
 * Telegram WebApp Haptic Feedback utility.
 * Wraps the native TMA HapticFeedback API with graceful fallbacks for dev mode.
 */
export const haptic = {
  light: () => {
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); } catch {}
  },
  medium: () => {
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium'); } catch {}
  },
  heavy: () => {
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy'); } catch {}
  },
  success: () => {
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'); } catch {}
  },
  error: () => {
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error'); } catch {}
  },
  warning: () => {
    try { (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning'); } catch {}
  },
};
