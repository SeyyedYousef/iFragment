import { Motion } from '@motionone/solid';
import { Component, Show } from 'solid-js';

interface EmptyStateProps {
	icon?: string;
	title: string;
	description?: string;
	actionLabel?: string;
	onAction?: () => void;
}

export const EmptyState: Component<EmptyStateProps> = (props) => {
	return (
		<Motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4 }}
			class="flex flex-col items-center justify-center p-8 text-center w-full h-full"
		>
			<span class="material-symbols-outlined text-[48px] text-gray-500 mb-4">
				{props.icon || 'inbox'}
			</span>
			<h3 class="text-[16px] font-bold text-white mb-2">
				{props.title}
			</h3>
			<Show when={props.description}>
				<p class="text-[14px] text-gray-400 mb-6 max-w-xs">
					{props.description}
				</p>
			</Show>
			<Show when={props.actionLabel && props.onAction}>
				<button
					onClick={props.onAction}
					class="bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-95 transition-all text-white font-semibold text-[14px] px-6 py-2.5 rounded-xl"
				>
					{props.actionLabel}
				</button>
			</Show>
		</Motion.div>
	);
};
