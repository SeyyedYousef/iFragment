import { hapticFeedback } from '@tma.js/sdk-solid';

const isHapticEnabled = (): boolean => {
	try {
		const s = localStorage.getItem('profile_settings');
		if (s) {
			return JSON.parse(s)?.hapticEnabled !== false;
		}
	} catch {}
	return true;
};

type Impact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type Notif = 'success' | 'warning' | 'error';

/** Setting-aware wrapper. Use this everywhere instead of raw hapticFeedback. */
export const haptic = {
	impact(style: Impact = 'light') {
		if (!isHapticEnabled()) return;
		try {
			if ((window as any).Telegram?.WebApp?.HapticFeedback) {
				(window as any).Telegram.WebApp.HapticFeedback.impactOccurred(style);
			} else {
				hapticFeedback.impactOccurred(style);
			}
		} catch {}
	},
	notify(type: Notif) {
		if (!isHapticEnabled()) return;
		try {
			if ((window as any).Telegram?.WebApp?.HapticFeedback) {
				(window as any).Telegram.WebApp.HapticFeedback.notificationOccurred(type);
			} else {
				hapticFeedback.notificationOccurred(type);
			}
		} catch {}
	},
	selection() {
		if (!isHapticEnabled()) return;
		try {
			if ((window as any).Telegram?.WebApp?.HapticFeedback) {
				(window as any).Telegram.WebApp.HapticFeedback.selectionChanged();
			} else {
				hapticFeedback.selectionChanged();
			}
		} catch {}
	},
};
