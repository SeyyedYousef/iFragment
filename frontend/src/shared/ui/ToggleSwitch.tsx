import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component } from 'solid-js';

interface Props {
	checked: boolean;
	onChange: (v: boolean) => void;
	disabled?: boolean;
	ariaLabel?: string;
}

export const ToggleSwitch: Component<Props> = (props) => {
	const handleClick = () => {
		if (props.disabled) return;
		try {
			hapticFeedback.impactOccurred('light');
		} catch {}
		props.onChange(!props.checked);
	};

	return (
		<button
			role="switch"
			aria-checked={props.checked}
			aria-label={props.ariaLabel}
			disabled={props.disabled}
			dir="ltr"
			onClick={handleClick}
			class={`w-11 h-6 rounded-full relative transition-colors duration-200 shrink-0 ${
				props.checked ? 'bg-[#3390ec]' : 'bg-white/10'
			} ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
		>
			<div
				class={`w-5 h-5 rounded-full bg-white absolute top-[2px] transition-all duration-200 ${
					props.checked ? 'left-[22px]' : 'left-[2px]'
				}`}
			/>
		</button>
	);
};
