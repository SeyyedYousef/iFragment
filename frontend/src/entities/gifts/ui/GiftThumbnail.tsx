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
	size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
	centerHex?: string;
	edgeHex?: string;
	patternHex?: string;
	backdropName?: string;
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

	// Authentic Telegram 4-Color Radial Backdrop Gradient
	const backdropStyle = createMemo(() => {
		const rawCenter = props.centerHex;
		const rawEdge = props.edgeHex;
		if (rawCenter && rawEdge) {
			const c = rawCenter.startsWith('#') ? rawCenter : `#${rawCenter}`;
			const e = rawEdge.startsWith('#') ? rawEdge : `#${rawEdge}`;
			return {
				background: `radial-gradient(circle at 50% 38%, ${c} 0%, ${e} 100%)`,
			};
		}
		return undefined;
	});

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
		void props.centerHex;
		void props.edgeHex;
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
			case '2xl':
				return 'w-32 h-32 rounded-[2rem] text-5xl';
			default:
				return 'w-12 h-12 rounded-xl text-lg';
		}
	};

	return (
		<div
			style={backdropStyle()}
			class={`relative flex items-center justify-center overflow-hidden flex-shrink-0 border border-white/[0.12] shadow-lg select-none group ${
				!backdropStyle() ? 'bg-gradient-to-br from-[#151c2c] to-[#0a0e17]' : ''
			} ${sizeClasses()} ${props.class || ''}`}
		>
			{/* Glossy Spherical Highlight Reflection */}
			<div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.16] via-transparent to-black/[0.25] mix-blend-overlay" />

			{/* Fallback 3D Emoji Badge */}
			<Show when={!imageLoaded() || imageError()}>
				<div class="absolute inset-0 flex items-center justify-center pointer-events-none drop-shadow-md">
					<span>{emoji()}</span>
				</div>
			</Show>

			{/* Official High-Res Animated/Vector Model Image */}
			<Show when={!imageError() && currentSrc()}>
				<img
					src={currentSrc()}
					alt={props.name || cleanSlug()}
					onLoad={() => setImageLoaded(true)}
					onError={handleImgError}
					class={`absolute inset-0 w-full h-full object-contain p-1 drop-shadow-xl transition-all duration-300 group-hover:scale-105 ${
						imageLoaded() ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
					} ${props.imgClass || ''}`}
				/>
			</Show>
		</div>
	);
};
