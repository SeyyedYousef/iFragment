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

const getHapticFeedback = () => {
	const wa = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : undefined;
	if (!wa?.HapticFeedback) return null;
	if (typeof wa.isVersionAtLeast === 'function' && !wa.isVersionAtLeast('6.1')) {
		return null;
	}
	return wa.HapticFeedback;
};

/** Setting-aware wrapper. Use this everywhere instead of raw hapticFeedback. */
export const haptic = {
	impact(style: Impact = 'light') {
		if (!isHapticEnabled()) return;
		try {
			const hf = getHapticFeedback();
			if (hf) {
				hf.impactOccurred(style);
			} else if (hapticFeedback.impactOccurred.isAvailable?.()) {
				hapticFeedback.impactOccurred(style);
			}
		} catch {}
	},
	notify(type: Notif) {
		if (!isHapticEnabled()) return;
		try {
			const hf = getHapticFeedback();
			if (hf) {
				hf.notificationOccurred(type);
			} else if (hapticFeedback.notificationOccurred.isAvailable?.()) {
				hapticFeedback.notificationOccurred(type);
			}
		} catch {}
	},
	selection() {
		if (!isHapticEnabled()) return;
		try {
			const hf = getHapticFeedback();
			if (hf) {
				hf.selectionChanged();
			} else if (hapticFeedback.selectionChanged.isAvailable?.()) {
				hapticFeedback.selectionChanged();
			}
		} catch {}
	},
};
