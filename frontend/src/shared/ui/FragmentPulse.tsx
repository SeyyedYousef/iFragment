import { Component, Show } from 'solid-js';

export type PulseState = 'healthy' | 'active' | 'reward' | 'premium' | 'danger';

interface FragmentPulseProps {
	state?: PulseState;
	label?: string;
	compact?: boolean;
}

export const FragmentPulse: Component<FragmentPulseProps> = (props) => {
	const getColor = () => {
		switch (props.state) {
			case 'healthy':
				return '#10b981';
			case 'reward':
				return '#f59e0b';
			case 'premium':
				return '#06b6d4';
			case 'danger':
				return '#ef4444';
			default:
				return '#3390ec';
		}
	};

	return (
		<div class="inline-flex items-center gap-2 select-none">
			<div class="relative flex items-center justify-center">
				<span
					class="w-2.5 h-2.5 rounded-full fragment-pulse-active"
					style={{
						'background-color': getColor(),
						'--pulse-color': getColor(),
					}}
				/>
			</div>

			<Show when={props.label && !props.compact}>
				<span class="text-[11px] font-bold text-white/70 tracking-tight">{props.label}</span>
			</Show>
		</div>
	);
};
