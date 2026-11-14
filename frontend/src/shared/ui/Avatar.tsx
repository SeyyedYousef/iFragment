import { type Component, createSignal, Show } from 'solid-js';
import { buildAvatarUrl } from '@/shared/api/config.js';

interface AvatarProps {
	src?: string;
	name: string;
	size?: 'sm' | 'md' | 'lg' | 'xl';
	class?: string;
}

const COLORS = [
	'#2990FF',
	'#32D74B',
	'#2481CC',
	'#FFB340',
	'#00CEC9',
	'#30B0C7',
	'#5AC8FA',
	'#4CD964',
];

const getSizeClass = (size?: string) => {
	switch (size) {
		case 'sm':
			return 'w-8 h-8 text-xs';
		case 'lg':
			return 'w-12 h-12 text-lg';
		case 'xl':
			return 'w-16 h-16 text-xl';
		default:
			return 'w-10 h-10 text-sm';
	}
};

const getDeterministicColor = (name: string) => {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	hash = Math.abs(hash);
	return COLORS[hash % COLORS.length];
};

export const Avatar: Component<AvatarProps> = (props) => {
	const [imageError, setImageError] = createSignal(false);
	const [imageLoaded, setImageLoaded] = createSignal(false);

	const initial = () => (props.name ? props.name.charAt(0).toUpperCase() : '?');
	const bgColor = () => getDeterministicColor(props.name || '');

	return (
		<div
			class={`relative flex-shrink-0 rounded-full border border-white/[0.12] flex items-center justify-center font-semibold text-white overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ${getSizeClass(props.size)} ${props.class || ''}`}
			style={{ 'background-color': bgColor() }}
		>
			<Show when={props.src && !imageError()} fallback={<span>{initial()}</span>}>
				<img
					src={buildAvatarUrl(props.src)}
					alt={props.name}
					class={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded() ? 'opacity-100' : 'opacity-0'}`}
					onLoad={() => setImageLoaded(true)}
					onError={() => setImageError(true)}
				/>
			</Show>
		</div>
	);
};
