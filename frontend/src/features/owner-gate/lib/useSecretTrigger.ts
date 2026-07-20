import { hapticFeedback, retrieveLaunchParams } from '@tma.js/sdk-solid';
import { createSignal, onCleanup } from 'solid-js';

export function useSecretTrigger() {
	const [tapCount, setTapCount] = createSignal(0);
	const [showGate, setShowGate] = createSignal(false);
	let tapTimeout: any = null;

	onCleanup(() => {
		if (tapTimeout) clearTimeout(tapTimeout);
	});

	const onVersionTap = () => {
		const ownerIdsStr = import.meta.env.VITE_OWNER_TELEGRAM_ID || '';
		const ownerIds = ownerIdsStr.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));

		let userId: number | undefined;
		try {
			const lp = retrieveLaunchParams();
			userId = (lp.initData as any)?.user?.id;
		} catch (_e) {
			// ignore
		}

		if (ownerIds.length > 0 && userId && !ownerIds.includes(userId)) {
			return;
		}

		try {
			hapticFeedback.impactOccurred('light');
		} catch {}

		setTapCount((c) => c + 1);

		if (tapTimeout) clearTimeout(tapTimeout);
		tapTimeout = setTimeout(() => {
			setTapCount(0);
		}, 2500);

		if (tapCount() >= 5) {
			try {
				hapticFeedback.notificationOccurred('success');
			} catch {}
			setShowGate(true);
			setTapCount(0);
		}
	};

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
