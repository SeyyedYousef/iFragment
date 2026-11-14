/**
 * Fragment.com-native UI primitives.
 *
 * Visual DNA distilled from fragment.com / telegram.org collectible pages:
 *  - slate surfaces (#1b232d on #12171e), 1px hairlines, 10–14px radii
 *  - the TON gem glyph sits *before* every price (".icon-before.icon-ton")
 *  - sentence-case section titles, 600 weight, no shouting uppercase
 *  - status communicated by a small colored dot + plain word, not neon badges
 *  - key/value tables with label left, value right, tabular numerals
 */
import { type Component, createSignal, type JSX, Show } from 'solid-js';
import { type DictPaths, t } from '@/shared/i18n/index.js';

/* ───────────────────────── TON gem ───────────────────────── */

/** The TON gem glyph (the same shape Fragment renders before prices). */
export const TonIcon: Component<{ size?: number; class?: string; color?: string }> = (props) => (
	<svg
		width={props.size ?? 14}
		height={props.size ?? 14}
		viewBox="0 0 56 56"
		fill="none"
		class={`shrink-0 inline-block align-[-0.12em] ${props.class ?? ''}`}
		aria-hidden="true"
	>
		<path
			d="M37.56 15.63H18.44c-3.52 0-5.74 3.8-4 6.86l11.8 20.45c.77 1.34 2.7 1.34 3.47 0l11.8-20.45c1.77-3.06-.46-6.86-3.95-6.86ZM26.25 36.8l-2.57-4.98-6.2-11.09a1.08 1.08 0 0 1 .95-1.62h7.82v17.7Zm12.27-16.08-6.2 11.1-2.57 4.97V19.1h7.82c.84 0 1.36.9.95 1.62Z"
			fill={props.color ?? '#2990FF'}
		/>
	</svg>
);

/** "◆ 12,345" — gem + tabular amount (+ optional muted unit / USD line). */
export const TonAmount: Component<{
	value: string | number;
	size?: 'sm' | 'md' | 'lg' | 'xl';
	usd?: string | null;
	unit?: boolean;
	class?: string;
	tone?: 'default' | 'positive' | 'warning' | 'muted';
}> = (props) => {
	const sizes = {
		sm: { text: 'text-[12px]', icon: 11 },
		md: { text: 'text-[14px]', icon: 13 },
		lg: { text: 'text-[20px]', icon: 17 },
		xl: { text: 'text-[30px] sm:text-[34px]', icon: 24 },
	} as const;
	const s = () => sizes[props.size ?? 'md'];
	const toneClass = () =>
		props.tone === 'positive'
			? 'text-[#4cd964]'
			: props.tone === 'warning'
				? 'text-[#ffb340]'
				: props.tone === 'muted'
					? 'text-[#8c9ba5]'
					: 'text-white';
	return (
		<span class={`inline-flex flex-col ${props.class ?? ''}`} dir="ltr">
			<span
				class={`inline-flex items-center gap-[0.32em] font-mono font-semibold tabular-nums tracking-[-0.02em] leading-none ${s().text} ${toneClass()}`}
			>
				<TonIcon size={s().icon} />
				<span>{props.value}</span>
				<Show when={props.unit}>
					<span class="text-[0.62em] font-medium text-[#8c9ba5] tracking-normal">TON</span>
				</Show>
			</span>
			<Show when={props.usd}>
				<span class="mt-1 text-[11px] font-mono text-[#8c9ba5] tabular-nums leading-none">
					≈ ${props.usd}
				</span>
			</Show>
		</span>
	);
};

/* ───────────────────────── Status ───────────────────────── */

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

const STATUS_META: Record<FragStatus, { color: string; key: DictPaths }> = {
	on_auction: { color: '#ffb340', key: 'fragmentStatus.on_auction' },
	on_sale: { color: '#2990ff', key: 'fragmentStatus.on_sale' },
	sold: { color: '#4cd964', key: 'fragmentStatus.sold' },
	available: { color: '#4cd964', key: 'fragmentStatus.available' },
	taken: { color: '#8c9ba5', key: 'fragmentStatus.taken' },
	unminted: { color: '#8c9ba5', key: 'fragmentStatus.unminted' },
	unknown: { color: '#60707c', key: 'fragmentStatus.unknown' },
};

export const fragStatusColor = (s: FragStatus) => STATUS_META[s].color;
export const fragStatusLabel = (s: FragStatus) => t(STATUS_META[s].key);

/** Fragment-style status: colored dot + plain word, on a quiet chip. */
export const FragStatusPill: Component<{
	status: FragStatus;
	label?: string;
	pulse?: boolean;
	class?: string;
}> = (props) => {
	const c = () => STATUS_META[props.status].color;
	return (
		<span
			class={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[6px] text-[11px] font-medium whitespace-nowrap ${props.class ?? ''}`}
			style={{ color: c(), 'background-color': `${c()}17`, border: `1px solid ${c()}33` }}
		>
			<span class="relative flex w-1.5 h-1.5">
				<Show when={props.pulse}>
					<span
						class="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping"
						style={{ 'background-color': c() }}
					/>
				</Show>
				<span
					class="relative inline-flex w-1.5 h-1.5 rounded-full"
					style={{ 'background-color': c() }}
				/>
			</span>
			{props.label ?? fragStatusLabel(props.status)}
		</span>
	);
};

/* ───────────────────────── Layout ───────────────────────── */

/** Sentence-case section header used at the top of every Fragment card. */
export const FragSectionHeader: Component<{
	title: string;
	subtitle?: string;
	right?: JSX.Element;
	icon?: string;
}> = (props) => (
	<div class="flex items-start justify-between gap-3 pb-3 mb-0.5 border-b border-white/[0.06]">
		<div class="flex items-start gap-2.5 min-w-0">
			<Show when={props.icon}>
				<span class="material-symbols-outlined text-[18px] text-[#8c9ba5] mt-[1px]">
					{props.icon}
				</span>
			</Show>
			<div class="flex flex-col min-w-0">
				<h3 class="text-[14px] font-semibold text-white leading-tight tracking-[-0.01em]">
					{props.title}
				</h3>
				<Show when={props.subtitle}>
					<span class="text-[12px] text-[#8c9ba5] leading-snug mt-0.5">{props.subtitle}</span>
				</Show>
			</div>
		</div>
		<Show when={props.right}>
			<div class="shrink-0 flex items-center gap-1.5">{props.right}</div>
		</Show>
	</div>
);

/** One row of a Fragment ".tm-table" key/value list. */
export const FragKV: Component<{
	label: string;
	children: JSX.Element;
	hint?: string;
	copyValue?: string;
	href?: string;
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
		<div class="frag-table-row flex items-center justify-between gap-3 px-3.5 py-[11px]">
			<div class="flex flex-col min-w-0">
				<span class="text-[13px] text-[#8c9ba5] leading-tight">{props.label}</span>
				<Show when={props.hint}>
					<span class="text-[11px] text-[#60707c] leading-tight mt-0.5">{props.hint}</span>
				</Show>
			</div>
			<div class="flex items-center gap-1.5 min-w-0 justify-end">
				<span class="text-[13px] text-white font-medium truncate text-end">{props.children}</span>
				<Show when={props.copyValue}>
					<button
						type="button"
						onClick={copy}
						class="w-6 h-6 rounded-[6px] text-[#8c9ba5] hover:text-white hover:bg-white/[0.06] flex items-center justify-center shrink-0 transition-colors"
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
						class="w-6 h-6 rounded-[6px] text-[#2990ff] hover:bg-[#2990ff]/10 flex items-center justify-center shrink-0 transition-colors"
					>
						<span class="material-symbols-outlined text-[14px]">north_east</span>
					</a>
				</Show>
			</div>
		</div>
	);
};

/** Small metric cell: muted label on top, value below. */
export const FragStat: Component<{
	label: string;
	children: JSX.Element;
	sub?: JSX.Element;
	class?: string;
}> = (props) => (
	<div class={`frag-inset px-3 py-2.5 flex flex-col gap-1 min-w-0 ${props.class ?? ''}`}>
		<span class="text-[11px] text-[#8c9ba5] leading-tight truncate">{props.label}</span>
		<div class="text-[14px] font-mono font-semibold text-white tabular-nums leading-tight truncate">
			{props.children}
		</div>
		<Show when={props.sub}>
			<div class="text-[11px] font-mono text-[#60707c] tabular-nums leading-tight truncate">
				{props.sub}
			</div>
		</Show>
	</div>
);

/* ───────────────────────── Handle typography ───────────────────────── */

/** "@handle" with the @ in Fragment blue and an optional t.me sub-line. */
export const FragHandle: Component<{
	handle: string;
	size?: 'sm' | 'md' | 'lg';
	subline?: boolean;
	class?: string;
}> = (props) => {
	const t = () =>
		props.size === 'lg' ? 'text-[17px]' : props.size === 'sm' ? 'text-[13px]' : 'text-[15px]';
	return (
		<span class={`inline-flex flex-col min-w-0 ${props.class ?? ''}`} dir="ltr">
			<span class={`font-semibold text-white truncate tracking-[-0.01em] ${t()}`}>
				<span class="text-[#2990ff]">@</span>
				{props.handle}
			</span>
			<Show when={props.subline}>
				<span class="text-[11px] text-[#60707c] font-mono truncate mt-0.5">
					t.me/{props.handle}
				</span>
			</Show>
		</span>
	);
};

/**
 * The collectible artwork exactly as Fragment serves it
 * (nft.fragment.com/username/<h>.webp), with a typographic fallback tile.
 */
export const FragNftTile: Component<{ handle: string; class?: string; rounded?: string }> = (
	props,
) => {
	const [failed, setFailed] = createSignal(false);
	return (
		<div
			class={`@container relative overflow-hidden bg-[#141a22] border border-white/[0.08] ${props.rounded ?? 'rounded-[12px]'} ${props.class ?? ''}`}
		>
			<Show
				when={!failed()}
				fallback={
					<div class="absolute inset-0 frag-guilloche-pattern flex items-center justify-center p-[8%]">
						<span
							class="font-semibold text-white tracking-[-0.03em] truncate"
							style={{
								'font-size': `clamp(12px, ${Math.max(14, 64 - props.handle.length * 4)}cqw, 64px)`,
							}}
							dir="ltr"
						>
							<span class="text-[#2990ff]">@</span>
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
