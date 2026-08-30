/**
 * Utility functions for formatting Telegram Anonymous Numbers (+888)
 */

export interface FormattedNumberParts {
	prefix: string; // e.g. "+888"
	body: string; // e.g. "8888 0000" or "8888"
	rawDigits: string; // e.g. "88880000"
	fullDisplay: string; // e.g. "+888 8888 0000"
}

export function splitNumberPrefix(raw?: string | null): FormattedNumberParts {
	if (!raw) {
		return { prefix: '+888', body: '', rawDigits: '', fullDisplay: '+888' };
	}

	// 1. Normalize and extract digits (including Persian/Arabic support)
	let cleaned = raw
		.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
		.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
		.replace(/[^\d]/g, '');

	// 11 digits: +888 XXXXXXXX -> extract 8-digit suffix
	if (cleaned.length === 11 && cleaned.startsWith('888')) {
		cleaned = cleaned.slice(3);
	} else if (cleaned.length === 7 && cleaned.startsWith('888')) {
		// 7 digits: +888 8888 -> extract 4-digit genesis suffix
		cleaned = cleaned.slice(3);
	}

	let body = '';
	if (cleaned.length === 8) {
		// Standard 8-digit Telemint format: 4 digits + 4 digits
		body = `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
	} else if (cleaned.length === 4) {
		// Genesis 4-digit format: e.g. 8888
		body = cleaned;
	} else if (cleaned.length > 4 && cleaned.length < 8) {
		body = `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
	} else {
		body = cleaned;
	}

	return {
		prefix: '+888',
		body,
		rawDigits: cleaned,
		fullDisplay: body ? `+888 ${body}` : '+888',
	};
}

/**
 * Format input string live as user types (up to 8 digits with space after 4th digit)
 */
export function formatLiveNumberInput(val: string): { formatted: string; digits: string } {
	const ascii = val
		.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
		.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));

	let digits = ascii.replace(/[^\d]/g, '');

	// If pasted full +888 number (11 digits or 7 digits starting with 888)
	if (digits.length === 11 && digits.startsWith('888')) {
		digits = digits.slice(3);
	} else if (digits.length === 7 && digits.startsWith('888')) {
		digits = digits.slice(3);
	}

	// Limit to max 8 digits
	if (digits.length > 8) {
		digits = digits.slice(0, 8);
	}

	let formatted = digits;
	if (digits.length > 4) {
		formatted = `${digits.slice(0, 4)} ${digits.slice(4)}`;
	}

	return { formatted, digits };
}
