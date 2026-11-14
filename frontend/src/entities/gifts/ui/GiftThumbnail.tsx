import { type Component, createMemo, createSignal, Show } from 'solid-js';

interface Props {
	slug: string;
	name?: string;
	model?: string;
	serialNumber?: number;
	customImageUrl?: string;
	class?: string;
	imgClass?: string;
	size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
	// Optional backdrop gradient colors extracted from API/metadata
	centerHex?: string;
	edgeHex?: string;
	patternHex?: string;
	backdropName?: string;
}

/**
 * Fragment Gift Thumbnail Renderer
 * Uses Telegram CDN Fragment imagery with fallback chain:
 * 1) Direct model + serial render: nft.fragment.com/gift/<slug>-<serial>.medium.jpg
 * 2) Collection model base render: nft.fragment.com/gift/<slug>.medium.jpg
 * 3) Changes.tg CDN PNG fallback
 * 4) Styled cryptographic initial badge (never a broken image!)
 *
 * Preserves authentic Telegram Gift radial backdrop stages while aligning fallback
 * slate & frame chrome with the Fragment Dark Slate design system.
 */
export const GiftThumbnail: Component<Props> = (props) => {
	const [imgErrorTier, setImgErrorTier] = createSignal(0);

	const cleanSlug = createMemo(() => {
		return (props.slug || '')
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]/g, '');
	});

	const sizeClasses = () => {
		switch (props.size) {
			case 'sm':
				return 'w-8 h-8 rounded-[9px] text-[10px]';
			case 'lg':
				return 'w-14 h-14 rounded-[16px] text-sm';
			case 'xl':
				return 'w-20 h-20 rounded-[22px] text-lg';
			case '2xl':
				return 'w-28 h-28 rounded-[26px] text-xl';
			default:
				return 'w-11 h-11 rounded-[12px] text-xs';
		}
	};

	const imageUrl = createMemo(() => {
		const tier = imgErrorTier();
		const s = cleanSlug();
		if (!s) return null;

		if (tier === 0) {
			if (props.customImageUrl?.startsWith('http')) {
				return props.customImageUrl;
			}
			const modelSlug = (props.model || '').toLowerCase().replace(/[^a-z0-9]/g, '');
			if (props.serialNumber) {
				return `https://nft.fragment.com/gift/${s}-${props.serialNumber}.medium.jpg`;
			}
			if (modelSlug) {
				return `https://nft.fragment.com/gift/${s}-${modelSlug}.medium.jpg`;
			}
			return `https://nft.fragment.com/gift/${s}.medium.jpg`;
		}

		if (tier === 1) {
			return `https://nft.fragment.com/gift/${s}.medium.jpg`;
		}

		if (tier === 2) {
			const originalSlug = (props.slug || '')
				.trim()
				.replace(/[^a-zA-Z0-9\s-]/g, '')
				.replace(/\s+/g, '');
			if (originalSlug) {
				return `https://cdn.changes.tg/gifts/originals/${originalSlug}/Original.png`;
			}
			return null;
		}

		return null;
	});

	const backdropStyle = () => {
		if (props.centerHex && props.edgeHex) {
			return {
				background: `radial-gradient(circle at 50% 45%, ${props.centerHex} 0%, ${props.edgeHex} 100%)`,
			};
		}
		return undefined;
	};

	const handleImgError = () => {
		setImgErrorTier((prev) => prev + 1);
	};

	const initialLetters = () => {
		const title = props.name || props.slug || 'TG';
		return title.slice(0, 2).toUpperCase();
	};

	return (
		<div
			style={backdropStyle()}
			class={`relative flex items-center justify-center overflow-hidden flex-shrink-0 border border-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] select-none group ${
				!backdropStyle() ? 'bg-gradient-to-br from-[#1d2733] to-[#11161d]' : ''
			} ${sizeClasses()} ${props.class || ''}`}
		>
			{/* Inner specular shimmer on backdrop */}
			<div class="absolute inset-0 bg-gradient-to-tr from-black/25 via-transparent to-white/[0.10] pointer-events-none" />

			<Show
				when={imageUrl() && imgErrorTier() < 3}
				fallback={
					<div class="flex flex-col items-center justify-center w-full h-full bg-[#17202b]">
						<span class="material-symbols-outlined text-[#5aaeff] text-opacity-85 text-[18px]">
							redeem
						</span>
						<span class="font-mono font-bold text-[#8ca0b5] text-[8px] mt-0.5 leading-none">
							{initialLetters()}
						</span>
					</div>
				}
			>
				<img
					src={imageUrl()!}
					alt={props.name || props.slug}
					loading="lazy"
					decoding="async"
					onError={handleImgError}
					class={`w-full h-full object-contain relative z-10 transition-transform duration-300 group-hover:scale-105 ${props.imgClass || ''}`}
				/>
			</Show>
		</div>
	);
};
