import { retrieveLaunchParams } from '@tma.js/sdk-solid';
import { createSignal, onCleanup } from 'solid-js';
import { haptic } from '@/shared/lib/haptic.js';

export function useSecretTrigger() {
	const [tapCount, setTapCount] = createSignal(0);
	const [showGate, setShowGate] = createSignal(false);
	let tapTimeout: any = null;

	onCleanup(() => {
		if (tapTimeout) clearTimeout(tapTimeout);
	});

	const onVersionTap = () => {
		try {
			haptic.impact('light');
		} catch {}

		setTapCount((c) => c + 1);

		if (tapTimeout) clearTimeout(tapTimeout);
		tapTimeout = setTimeout(() => {
			setTapCount(0);
		}, 2500);

		if (tapCount() >= 5) {
			try {
				haptic.notify('success');
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
