import { type Component, createSignal, Show } from 'solid-js';
import { getGiftCdnImageUrl, getGiftProxyImageUrl } from '../lib/cdn.js';
import { OFFICIAL_GIFTS_120 } from '../model/catalog120.js';

interface Props {
	slug: string;
	name?: string;
	class?: string;
	imgClass?: string;
	size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const GiftThumbnail: Component<Props> = (props) => {
	const [imageLoaded, setImageLoaded] = createSignal(false);
	const [imageError, setImageError] = createSignal(false);
	const [useFallbackProxy, setUseFallbackProxy] = createSignal(false);

	const cleanSlug = () =>
		(props.slug || '').toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');

	const giftItem = () =>
		OFFICIAL_GIFTS_120.find(
			(g) => g.slug === cleanSlug() || g.name.toLowerCase() === (props.name || '').toLowerCase(),
		);

	const emoji = () => giftItem()?.emoji || '🎁';

	const imgSrc = () => {
		if (useFallbackProxy()) {
			return getGiftProxyImageUrl(cleanSlug());
		}
		return getGiftCdnImageUrl(cleanSlug());
	};

	const handleImgError = () => {
		if (!useFallbackProxy()) {
			// Try proxy endpoint first before failing to emoji
			setUseFallbackProxy(true);
		} else {
			setImageError(true);
		}
	};

	const sizeClasses = () => {
		switch (props.size) {
			case 'sm':
				return 'w-6 h-6 rounded-lg text-xs';
			case 'lg':
				return 'w-16 h-16 rounded-2xl text-2xl';
			case 'xl':
				return 'w-24 h-24 rounded-3xl text-4xl';
			case 'md':
			default:
				return 'w-12 h-12 rounded-xl text-lg';
		}
	};

	return (
		<div
			class={`relative flex items-center justify-center overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#151c2c] to-[#0a0e17] border border-white/[0.08] shadow-inner select-none ${sizeClasses()} ${
				props.class || ''
			}`}
		>
			{/* Fallback 3D Emoji Badge (Always visible behind image or on network fail) */}
			<div class="absolute inset-0 flex items-center justify-center pointer-events-none drop-shadow-md">
				<span>{emoji()}</span>
			</div>

			{/* Official High-Res CDN / Proxy Model Image */}
			<Show when={!imageError()}>
				<img
					src={imgSrc()}
					alt={props.name || cleanSlug()}
					loading="lazy"
					onLoad={() => setImageLoaded(true)}
					onError={handleImgError}
					class={`absolute inset-0 w-full h-full object-contain p-1 drop-shadow-md transition-all duration-300 ${
						imageLoaded() ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
					} ${props.imgClass || ''}`}
				/>
			</Show>
		</div>
	);
};
