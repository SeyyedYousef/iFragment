/**
 * Fragment.com-native UI primitives.
 *
 * Authentic visual DNA from https://fragment.com/css/auction.css?114:
 *  - Flat slate surfaces (#212a33 on #1a2026 canvas), #293440 header/hover, #242e38 inputs
 *  - 8px corner radius (--def-border-radius), 4px status pills, 1px solid #1a2026 row dividers
 *  - Primary CTA #248bda, text/link/icon accent #4db2ff, secondary text #8794a1 / #8c9aa9
 *  - The TON gem glyph sits before every price (".icon-before.icon-ton")
 *  - Sentence-case section titles, 600 weight, zero robotic uppercase shouting
 */
import { type Component, createSignal, type JSX, Show } from 'solid-js';
import { type DictPaths, t } from '@/shared/i18n/index.js';

/* ───────────────────────── Fragment Brand Mark & TON Gem ───────────────────────── */

/** The TON gem glyph (exact shape Fragment renders before prices). */
export const TonIcon: Component<{ size?: number; class?: string; color?: string }> = (props) => (
	<svg
		width={props.size ?? 15}
		height={props.size ?? 15}
		viewBox="0 0 56 56"
		fill="none"
		class={`shrink-0 inline-block align-[-0.12em] ${props.class ?? ''}`}
		aria-hidden="true"
	>
		<path
			d="M37.56 15.63H18.44c-3.52 0-5.74 3.8-4 6.86l11.8 20.45c.77 1.34 2.7 1.34 3.47 0l11.8-20.45c1.77-3.06-.46-6.86-3.95-6.86ZM26.25 36.8l-2.57-4.98-6.2-11.09a1.08 1.08 0 0 1 .95-1.62h7.82v17.7Zm12.27-16.08-6.2 11.1-2.57 4.97V19.1h7.82c.84 0 1.36.9.95 1.62Z"
			fill={props.color ?? '#4db2ff'}
		/>
	</svg>
);

/** "◆ 12,345" — gem + tabular amount (+ optional muted ~ $USD line). */
export const TonAmount: Component<{
	value: string | number;
	size?: 'sm' | 'md' | 'lg' | 'xl';
	usd?: string | null;
	unit?: boolean;
	class?: string;
	tone?: 'default' | 'positive' | 'warning' | 'muted';
}> = (props) => {
	const sizes = {
		sm: { text: 'text-[13px]', icon: 13 },
		md: { text: 'text-[15px]', icon: 15 },
		lg: { text: 'text-[18px]', icon: 17 },
		xl: { text: 'text-[24px] sm:text-[28px]', icon: 22 },
	} as const;
	const s = () => sizes[props.size ?? 'md'];
	const toneClass = () =>
		props.tone === 'positive'
			? 'text-[#5aec8c]'
			: props.tone === 'warning'
				? 'text-[#ff9953]'
				: props.tone === 'muted'
					? 'text-[#8c9aa9]'
					: 'text-white';
	return (
		<span class={`inline-flex flex-col ${props.class ?? ''}`} dir="ltr">
			<span
				class={`inline-flex items-center gap-[0.3em] font-semibold tabular-nums tracking-[-0.015em] leading-none ${s().text} ${toneClass()}`}
			>
				<TonIcon size={s().icon} />
				<span>{props.value}</span>
				<Show when={props.unit}>
					<span class="text-[0.7em] font-medium text-[#8c9aa9] tracking-normal">TON</span>
				</Show>
			</span>
			<Show when={props.usd}>
				<span class="mt-1 text-[11.5px] text-[#8c9aa9] tabular-nums leading-none">
					~ ${props.usd}
				</span>
			</Show>
		</span>
	);
};

/* ───────────────────────── Status Badges (.table-cell-status-thin) ───────────────────────── */

export type FragStatus =
	| 'on_auction'
	| 'on_sale'
	| 'sold'
	| 'available'
	| 'taken'
	| 'unminted'
	| 'unknown';

export const normalizeFragStatus = (raw?: string | null): FragStatus => {
	const s = (raw || '').toLowerCase();
	if (s.includes('auction')) return 'on_auction';
	if (s.includes('sale') && !s.includes('sold')) return 'on_sale';
	if (s.includes('sold')) return 'sold';
	if (s.includes('avail') || s.includes('free')) return 'available';
	if (s.includes('unmint') || s.includes('not_tokenized')) return 'unminted';
	if (s.includes('taken') || s.includes('assigned') || s.includes('owned') || s.includes('active'))
		return 'taken';
	return 'unknown';
};

const STATUS_META: Record<FragStatus, { color: string; bg: string; key: DictPaths }> = {
	on_auction: {
		color: '#5aec8c',
		bg: 'rgba(90, 236, 140, 0.1)',
		key: 'fragmentStatus.on_auction',
	},
	on_sale: {
		color: '#4db2ff',
		bg: 'rgba(77, 178, 255, 0.1)',
		key: 'fragmentStatus.on_sale',
	},
	sold: {
		color: '#a5b8cc',
		bg: 'rgba(165, 184, 204, 0.1)',
		key: 'fragmentStatus.sold',
	},
	available: {
		color: '#5aec8c',
		bg: 'rgba(90, 236, 140, 0.1)',
		key: 'fragmentStatus.available',
	},
	taken: {
		color: '#ff9953',
		bg: 'rgba(255, 153, 83, 0.1)',
		key: 'fragmentStatus.taken',
	},
	unminted: {
		color: '#a5b8cc',
		bg: 'rgba(165, 184, 204, 0.1)',
		key: 'fragmentStatus.unminted',
	},
	unknown: {
		color: '#8c9aa9',
		bg: 'rgba(140, 154, 169, 0.1)',
		key: 'fragmentStatus.unknown',
	},
};

export const fragStatusColor = (s: FragStatus) => STATUS_META[s].color;
export const fragStatusLabel = (s: FragStatus) => t(STATUS_META[s].key);

/** Exact Fragment.com status pill (.table-cell-status-thin / .tm-section-header-status): 4px radius, bold 11.5px. */
export const FragStatusPill: Component<{
	status: FragStatus;
	label?: string;
	pulse?: boolean;
	class?: string;
}> = (props) => {
	const meta = () => STATUS_META[props.status];
	return (
		<span
			class={`inline-flex items-center gap-1.5 h-[21px] px-2 rounded-[4px] text-[11.5px] font-semibold whitespace-nowrap ${props.class ?? ''}`}
			style={{ color: meta().color, 'background-color': meta().bg }}
		>
			<Show when={props.pulse}>
				<span
					class="w-1.5 h-1.5 rounded-full shrink-0"
					style={{ 'background-color': meta().color }}
				/>
			</Show>
			{props.label ?? fragStatusLabel(props.status)}
		</span>
	);
};

/* ───────────────────────── Layout & Key-Value List (.tm-list / .tm-table) ───────────────────────── */

/** Sentence-case section header used above Fragment tables and cards. */
export const FragSectionHeader: Component<{
	title: string;
	subtitle?: string;
	right?: JSX.Element;
	icon?: string;
}> = (props) => (
	<div class="flex items-center justify-between gap-3 pb-2.5 mb-0.5">
		<div class="flex items-center gap-2 min-w-0">
			<Show when={props.icon}>
				<span class="material-symbols-outlined text-[17px] text-[#8c9aa9]">{props.icon}</span>
			</Show>
			<div class="flex flex-col min-w-0">
				<h3 class="text-[15px] font-semibold text-white leading-tight tracking-[-0.01em]">
					{props.title}
				</h3>
				<Show when={props.subtitle}>
					<span class="text-[12px] text-[#8794a1] leading-snug mt-0.5">{props.subtitle}</span>
				</Show>
			</div>
		</div>
		<Show when={props.right}>
			<div class="shrink-0 flex items-center gap-1.5">{props.right}</div>
		</Show>
	</div>
);

/** One row of a Fragment ".tm-list" key/value card (bold white label left, #4db2ff or white value right). */
export const FragKV: Component<{
	label: string;
	children: JSX.Element;
	hint?: string;
	copyValue?: string;
	href?: string;
	accent?: boolean;
}> = (props) => {
	const [copied, setCopied] = createSignal(false);
	const copy = async () => {
		if (!props.copyValue) return;
		try {
			await navigator.clipboard.writeText(props.copyValue);
			setCopied(true);
			setTimeout(() => setCopied(false), 1200);
		} catch {}
	};
	return (
		<div class="frag-table-row flex items-center justify-between gap-3 px-3.5 py-2.5">
			<div class="flex flex-col min-w-0">
				<span class="text-[13px] font-semibold text-white leading-tight">{props.label}</span>
				<Show when={props.hint}>
					<span class="text-[11px] text-[#8c9aa9] leading-tight mt-0.5">{props.hint}</span>
				</Show>
			</div>
			<div class="flex items-center gap-1.5 min-w-0 justify-end">
				<span
					class={`text-[13px] font-medium truncate text-end ${
						props.accent || props.href ? 'text-[#4db2ff]' : 'text-white'
					}`}
				>
					{props.children}
				</span>
				<Show when={props.copyValue}>
					<button
						type="button"
						onClick={copy}
						class="w-6 h-6 rounded-[4px] text-[#8c9aa9] hover:text-white hover:bg-[#293440] flex items-center justify-center shrink-0 transition-colors"
						aria-label="copy"
					>
						<span class="material-symbols-outlined text-[14px]">
							{copied() ? 'check' : 'content_copy'}
						</span>
					</button>
				</Show>
				<Show when={props.href}>
					<a
						href={props.href}
						target="_blank"
						rel="noreferrer"
						class="w-6 h-6 rounded-[4px] text-[#4db2ff] hover:bg-[#4db2ff]/10 flex items-center justify-center shrink-0 transition-colors"
					>
						<span class="material-symbols-outlined text-[14px]">north_east</span>
					</a>
				</Show>
			</div>
		</div>
	);
};

/** Metric cell in a Fragment summary card (muted #8c9aa9 label on top, bold white value below). */
export const FragStat: Component<{
	label: string;
	children: JSX.Element;
	sub?: JSX.Element;
	class?: string;
}> = (props) => (
	<div
		class={`bg-[#212a33] rounded-[8px] px-3 py-2.5 flex flex-col gap-1 min-w-0 ${props.class ?? ''}`}
	>
		<span class="text-[12px] font-semibold text-[#8c9aa9] leading-tight truncate">
			{props.label}
		</span>
		<div class="text-[15px] font-semibold text-white tabular-nums leading-tight truncate mt-0.5">
			{props.children}
		</div>
		<Show when={props.sub}>
			<div class="text-[11.5px] text-[#8c9aa9] tabular-nums leading-tight truncate">
				{props.sub}
			</div>
		</Show>
	</div>
);

/* ───────────────────────── Handle Typography ───────────────────────── */

/** "@handle" with optional #4db2ff web3 address sub-line (handle.t.me). */
export const FragHandle: Component<{
	handle: string;
	size?: 'sm' | 'md' | 'lg';
	subline?: boolean;
	class?: string;
}> = (props) => {
	const sz = () =>
		props.size === 'lg' ? 'text-[17px]' : props.size === 'sm' ? 'text-[13px]' : 'text-[14px]';
	return (
		<span class={`inline-flex flex-col min-w-0 ${props.class ?? ''}`} dir="ltr">
			<span class={`font-semibold text-white truncate tracking-[-0.01em] ${sz()}`}>
				@{props.handle}
			</span>
			<Show when={props.subline}>
				<span class="text-[12px] text-[#4db2ff] truncate mt-0.5">{props.handle}.t.me</span>
			</Show>
		</span>
	);
};

/**
 * The collectible artwork as Fragment serves it
 * (nft.fragment.com/username/<h>.webp), with a clean typographic fallback tile.
 */
export const FragNftTile: Component<{ handle: string; class?: string; rounded?: string }> = (
	props,
) => {
	const [failed, setFailed] = createSignal(false);
	return (
		<div
			class={`@container relative overflow-hidden bg-[#242e38] ${props.rounded ?? 'rounded-[8px]'} ${props.class ?? ''}`}
		>
			<Show
				when={!failed()}
				fallback={
					<div class="absolute inset-0 flex items-center justify-center p-[8%] bg-[#242e38]">
						<span
							class="font-semibold text-white tracking-[-0.02em] truncate"
							style={{
								'font-size': `clamp(11px, ${Math.max(13, 56 - props.handle.length * 4)}cqw, 48px)`,
							}}
							dir="ltr"
						>
							<span class="text-[#4db2ff]">@</span>
							{props.handle}
						</span>
					</div>
				}
			>
				<img
					src={`https://nft.fragment.com/username/${props.handle}.webp`}
					alt={`@${props.handle}`}
					loading="lazy"
					class="absolute inset-0 w-full h-full object-cover"
					onError={() => setFailed(true)}
				/>
			</Show>
		</div>
	);
};

/** Fragment primary-mint floor per length tier (TeleMint initial min bid schedule). */
export const primaryMintFloorTon = (len: number): number => {
	if (len <= 4) return 504;
	if (len === 5) return 168;
	if (len === 6) return 50;
	if (len === 7) return 25;
	return 10;
};
