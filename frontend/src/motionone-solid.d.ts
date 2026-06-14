declare module '@motionone/solid' {
	import { Component, JSX } from 'solid-js';

	interface MotionComponentProps extends JSX.HTMLAttributes<HTMLDivElement> {
		initial?: Record<string, any>;
		animate?: Record<string, any>;
		exit?: Record<string, any>;
		transition?: Record<string, any>;
		class?: string;
		children?: any;
	}

	type MotionProxy = {
		[K in keyof JSX.IntrinsicElements]: Component<JSX.IntrinsicElements[K] & MotionComponentProps>;
	};

	export const Motion: MotionProxy;
}
