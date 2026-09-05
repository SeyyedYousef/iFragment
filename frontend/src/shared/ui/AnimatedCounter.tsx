import { type Component, createEffect, createSignal, onCleanup } from 'solid-js';

export interface AnimatedCounterProps {
	value: number;
	duration?: number; // Duration in ms, defaults to 1200ms
	class?: string;
	onTick?: () => void;
	onComplete?: () => void;
}

export const AnimatedCounter: Component<AnimatedCounterProps> = (props) => {
	const [displayValue, setDisplayValue] = createSignal<number>(props.value);
	const [isPulsing, setIsPulsing] = createSignal<boolean>(false);
	let animationFrameId: number | null = null;
	let startValue = props.value;
	let startTime: number | null = null;
	let pulseTimer: ReturnType<typeof setTimeout> | null = null;

	createEffect(() => {
		const targetValue = Math.round(props.value);
		const current = Math.round(displayValue());

		if (targetValue === current) return;

		// Cancel any running animation
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}

		startValue = current;
		const diff = targetValue - startValue;

		// If the difference is small (e.g., 1-2 taps), update instantly or with minimal delay
		if (Math.abs(diff) <= 2) {
			setDisplayValue(targetValue);
			return;
		}

		// Trigger glowing pulse for notable coin increases
		if (diff > 0) {
			setIsPulsing(true);
			if (pulseTimer) clearTimeout(pulseTimer);
			pulseTimer = setTimeout(() => setIsPulsing(false), (props.duration || 1200) + 200);
		}

		const animDuration = props.duration || 1200;
		startTime = null;

		const step = (timestamp: number) => {
			if (!startTime) startTime = timestamp;
			const elapsed = timestamp - startTime;
			const progress = Math.min(1, elapsed / animDuration);

			// Ease-out cubic: 1 - (1 - t)^3
			const easeOut = 1 - Math.pow(1 - progress, 3);
			const nextVal = Math.round(startValue + diff * easeOut);
			setDisplayValue(nextVal);

			if (props.onTick) props.onTick();

			if (progress < 1) {
				animationFrameId = requestAnimationFrame(step);
			} else {
				setDisplayValue(targetValue);
				animationFrameId = null;
				if (props.onComplete) props.onComplete();
			}
		};

		animationFrameId = requestAnimationFrame(step);
	});

	onCleanup(() => {
		if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
		if (pulseTimer) clearTimeout(pulseTimer);
	});

	return (
		<span
			class={`tabular-nums transition-transform duration-200 inline-block select-none ${
				isPulsing()
					? 'scale-[1.08] text-amber-300 drop-shadow-[0_0_16px_rgba(252,211,77,0.8)]'
					: ''
			} ${props.class || ''}`}
		>
			{displayValue().toLocaleString('en-US')}
		</span>
	);
};
