import { type Component, createMemo, For, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import type { PaywallVertical } from './theme.js';

/**
 * Deterministic, locally-computed mystery hints shown while the user types.
 * These chips NEVER leak prices, percentiles or paid data — they only reflect
 * structural facts of the raw query itself.
 */

interface TeaserChip {
	id: string;
	key: string;
}

function toAsciiDigits(str: string): string {
	return str
		.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
		.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
}

function analyzeNumber(raw: string): TeaserChip[] {
	const ascii = toAsciiDigits(raw || '');
	const digits = ascii.replace(/\D/g, '').replace(/^888/, '');
	if (digits.length < 3) return [];
	const chips: TeaserChip[] = [];

	// Check quad/grail repeat
	if (
		digits.includes('8888') ||
		digits.includes('7777') ||
		digits.includes('0000') ||
		digits.includes('9999') ||
		digits.includes('1111')
	) {
		chips.push({ id: 'grail', key: 'paywall.teaser.grail_tier' });
	}

	let maxRun = 1;
	let run = 1;
	for (let i = 1; i < digits.length; i++) {
		run = digits[i] === digits[i - 1] ? run + 1 : 1;
		if (run > maxRun) maxRun = run;
	}
	const distinct = new Set(digits).size;
	const mirrored = digits.length >= 4 && digits === [...digits].reverse().join('');

	// Check sequential
	const isAscending = /012|123|234|345|456|567|678|789/.test(digits);
	const isDescending = /987|876|765|654|543|432|321|210/.test(digits);
	if (isAscending || isDescending) {
		chips.push({ id: 'seq', key: 'paywall.teaser.sequential' });
	}

	if (maxRun >= 3 && !chips.some((c) => c.id === 'grail'))
		chips.push({ id: 'run', key: 'paywall.teaser.pattern_run' });
	else if (maxRun === 2 && digits.length >= 6)
		chips.push({ id: 'pairs', key: 'paywall.teaser.pattern_pairs' });
	if (mirrored) chips.push({ id: 'mirror', key: 'paywall.teaser.mirror' });
	if (distinct <= 3) chips.push({ id: 'rare', key: 'paywall.teaser.rare_mix' });
	if (/(\d)\1{2,}$/.test(digits)) chips.push({ id: 'tail', key: 'paywall.teaser.signature_tail' });

	// Always ensure at least signals_27 or supply_check when valid
	if (chips.length === 0) {
		chips.push({ id: 'signals', key: 'paywall.teaser.signals_27' });
	}
	if (chips.length === 1 && digits.length >= 4) {
		chips.push({ id: 'supply', key: 'paywall.teaser.supply_check' });
	}

	return chips.slice(0, 3);
}

function analyzeUsername(raw: string): TeaserChip[] {
	const clean = raw.trim().replace(/^@/, '');
	if (clean.length < 2) return [];
	const chips: TeaserChip[] = [];
	const hasDigit = /\d/.test(clean);
	const hasUnderscore = /_/.test(clean);

	if (clean.length <= 5) chips.push({ id: 'short', key: 'paywall.teaser.short_handle' });
	else if (clean.length >= 16) chips.push({ id: 'long', key: 'paywall.teaser.long_handle' });
	if (!hasDigit && !hasUnderscore && clean.length <= 10)
		chips.push({ id: 'clean', key: 'paywall.teaser.clean_letters' });
	if (hasDigit && hasUnderscore) chips.push({ id: 'mixed', key: 'paywall.teaser.mixed_shape' });

	return chips.slice(0, 2);
}

const GIFT_MODEL_HINTS: Array<[RegExp, string]> = [
	[/pepe/i, 'Plush Pepe'],
	[/(cap|durov)/i, "Durov's Cap"],
	[/(snoop|dogg)/i, 'Snoop Dogg'],
	[/(star|astral)/i, 'Celestial Star'],
	[/(heart|cyber)/i, 'Cyber Heart'],
	[/(phoenix|feather)/i, 'Phoenix Feather'],
];

function analyzeGift(raw: string): TeaserChip[] {
	const clean = raw.trim();
	if (clean.length < 3) return [];
	const chips: TeaserChip[] = [];

	for (const [re, name] of GIFT_MODEL_HINTS) {
		if (re.test(clean)) {
			chips.push({ id: `model-${name}`, key: 'paywall.teaser.known_model' });
			break;
		}
	}
	const serialMatch = clean.match(/(\d{1,6})\s*$/);
	if (serialMatch) {
		const serial = parseInt(serialMatch[1], 10);
		if (serial <= 9) chips.push({ id: 'serial', key: 'paywall.teaser.low_serial' });
		else if ([77, 88, 99, 777, 888, 999].includes(serial))
			chips.push({ id: 'sacred', key: 'paywall.teaser.sacred_serial' });
	}

	return chips.slice(0, 2);
}

export const SearchTeaser: Component<{ vertical: PaywallVertical; value: string }> = (props) => {
	const chips = createMemo(() => {
		switch (props.vertical) {
			case 'number':
				return analyzeNumber(props.value);
			case 'username':
				return analyzeUsername(props.value);
			case 'gift':
				return analyzeGift(props.value);
			default:
				return [];
		}
	});

	return (
		<Show when={(chips()?.length ?? 0) > 0}>
			<div class="mt-2 flex flex-wrap gap-1.5" role="status">
				<For each={chips()}>
					{(chip, idx) => (
						<span
							class="teaser-chip inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-white/70"
							style={{
								animation: `teaser-in 240ms cubic-bezier(0.16, 1, 0.3, 1) ${idx() * 60}ms both`,
							}}
						>
							<span class="material-symbols-outlined text-[11px] text-white/50">lock</span>
							{t(chip.key as Parameters<typeof t>[0])}
						</span>
					)}
				</For>
			</div>
		</Show>
	);
};
