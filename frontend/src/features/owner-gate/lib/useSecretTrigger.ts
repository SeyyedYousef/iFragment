import { hapticFeedback, retrieveLaunchParams } from '@tma.js/sdk-solid';
import { createSignal } from 'solid-js';

export function useSecretTrigger() {
	const [tapCount, setTapCount] = createSignal(0);
	const [showGate, setShowGate] = createSignal(false);
	let tapTimeout: any;

	const onVersionTap = () => {
		// Verify Telegram ID securely on the frontend before showing modal
		const ownerIdsStr = import.meta.env.VITE_OWNER_TELEGRAM_ID || '';
		const ownerIds = ownerIdsStr.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
		
		let userId: number | undefined;
		try {
			const lp = retrieveLaunchParams();
			userId = lp.initData?.user?.id;
		} catch (e) {
			console.warn('Failed to get Telegram user ID');
		}

		if (ownerIds.length > 0 && userId && !ownerIds.includes(userId)) {
			// Silently ignore taps if the user is not in the owner list
			return;
		}

		try {
			hapticFeedback.impactOccurred('light');
		} catch {}
		
		setTapCount((c) => c + 1);

		if (tapTimeout) clearTimeout(tapTimeout);
		tapTimeout = setTimeout(() => {
			setTapCount(0);
		}, 2500); // Reset tap count after 2.5s of inactivity

		if (tapCount() === 5) {
			try {
				hapticFeedback.notificationOccurred('success');
			} catch {}
			console.log('🔓 Secret entry unlocked: Opening TOTP Gate.');
			setShowGate(true);
			setTapCount(0); // Reset state
		}
	};

	// Kept for backward compatibility with ProfilePage JSX
	const onLogoPressStart = () => {};
	const onLogoPressEnd = () => {};

	return {
		onVersionTap,
		onLogoPressStart,
		onLogoPressEnd,
		showGate,
		setShowGate,
	};
}

