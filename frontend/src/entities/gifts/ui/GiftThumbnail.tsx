import { type Component, createEffect, createMemo, createSignal, Show } from 'solid-js';
import { getGiftCdnImageUrl, getGiftProxyImageUrl } from '../lib/cdn.js';
import { OFFICIAL_GIFTS_120 } from '../model/catalog120.js';

interface Props {
	slug: string;
	name?: string;
	model?: string;
	serialNumber?: number;
	customImageUrl?: string;
	class?: string;
	imgClass?: string;
	size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const GiftThumbnail: Component<Props> = (props) => {
	const [attemptIndex, setAttemptIndex] = createSignal(0);
	const [imageLoaded, setImageLoaded] = createSignal(false);
	const [imageError, setImageError] = createSignal(false);

	const cleanSlug = () =>
		(props.slug || '')
			.toLowerCase()
			.replace(/_/g, '-')
			.replace(/[^a-z0-9-]/g, '');

	const giftItem = () =>
		OFFICIAL_GIFTS_120.find(
			(g) => g.slug === cleanSlug() || g.name.toLowerCase() === (props.name || '').toLowerCase(),
		);

	const emoji = () => giftItem()?.emoji || '🎁';

	// Multi-stage cascading candidates:
	// Prioritizes backend VPS proxy when customImageUrl is from a filtered Telegram CDN (telesco.pe)
	const candidates = createMemo(() => {
		const list: string[] = [];
		const proxyUrl = getGiftProxyImageUrl(cleanSlug(), props.model, props.serialNumber);
		const cdnUrl = getGiftCdnImageUrl(cleanSlug(), props.model || giftItem()?.primaryModel);
		const custom = props.customImageUrl;

		const isTelegramDomain =
			!!custom &&
			(custom.includes('telesco.pe') || custom.includes('t.me') || custom.includes('telegram.org'));

		if (custom && !isTelegramDomain) {
			list.push(custom);
		}
		if (proxyUrl && !list.includes(proxyUrl)) {
			list.push(proxyUrl);
		}
		if (custom && isTelegramDomain && !list.includes(custom)) {
			list.push(custom);
		}
		if (cdnUrl && !list.includes(cdnUrl)) {
			list.push(cdnUrl);
		}
		return list;
	});

	createEffect(() => {
		void cleanSlug();
		void props.model;
		void props.serialNumber;
		void props.customImageUrl;
		setAttemptIndex(0);
		setImageLoaded(false);
		setImageError(false);
	});

	const currentSrc = () => {
		const c = candidates();
		const idx = attemptIndex();
		return idx < c.length ? c[idx] : '';
	};

	const handleImgError = () => {
		const next = attemptIndex() + 1;
		if (next < candidates().length) {
			setAttemptIndex(next);
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
			{/* Fallback 3D Emoji Badge: visible while image is loading or if all sources fail */}
			<Show when={!imageLoaded() || imageError()}>
				<div class="absolute inset-0 flex items-center justify-center pointer-events-none drop-shadow-md">
					<span>{emoji()}</span>
				</div>
			</Show>

			{/* Official High-Res Model Image */}
			<Show when={!imageError() && currentSrc()}>
				<img
					src={currentSrc()}
					alt={props.name || cleanSlug()}
					onLoad={() => setImageLoaded(true)}
					onError={handleImgError}
					class={`absolute inset-0 w-full h-full object-contain p-1 drop-shadow-md transition-all duration-200 ${
						imageLoaded() ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
					} ${props.imgClass || ''}`}
				/>
			</Show>
		</div>
	);
};
