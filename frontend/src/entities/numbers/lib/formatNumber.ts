/**
 * Utility functions for formatting Telegram Anonymous Numbers (+888)
 */
import { locale } from '@/shared/i18n/index.js';

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

	// Extract suffix:
	// 11 digits: +888 XXXXXXXX -> extract 8-digit suffix
	if (cleaned.length === 11 && cleaned.startsWith('888')) {
		cleaned = cleaned.slice(3);
	} else if (cleaned.length === 7 && cleaned.startsWith('888')) {
		// 7 digits: +888 XXXX -> extract 4-digit genesis suffix
		cleaned = cleaned.slice(3);
	} else if (cleaned.length === 14 && cleaned.startsWith('888888')) {
		// Defensive cleanup for redundant double +888 prefix
		cleaned = cleaned.slice(6);
	} else if (cleaned.length === 10 && cleaned.startsWith('888888')) {
		// Defensive cleanup for redundant double +888 prefix (e.g. 888+888+8000)
		cleaned = cleaned.slice(6);
	}

	let body = '';
	if (cleaned.length === 8) {
		// Standard 8-digit Telemint format: 4 digits + 4 digits
		body = `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
	} else if (cleaned.length === 4) {
		// Genesis 4-digit format: e.g. 8000, 8888
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

const VALIDATION_ERRORS: Record<string, { empty: string; genesisRange: string; invalidLength: string }> = {
	fa: {
		empty: 'شماره نمی‌تواند خالی باشد',
		genesisRange: 'شماره جنسیس ۴ رقمی خارج از بازه رسمی تلگرام (۸۰۰۰ تا ۸۹۹۹) است',
		invalidLength: 'طول شماره نامعتبر است (باید ۴ رقمی جنسیس یا ۸ رقمی استاندارد باشد)',
	},
	en: {
		empty: 'Number cannot be empty',
		genesisRange: '4-digit Genesis number is outside the official Telegram range (8000–8999)',
		invalidLength: 'Invalid number length (must be 4-digit Genesis or 8-digit Standard)',
	},
	ru: {
		empty: 'Номер не может быть пустым',
		genesisRange: '4-значный Genesis-номер вне официального диапазона Telegram (8000–8999)',
		invalidLength: 'Неверная длина номера (должно быть 4 или 8 цифр после +888)',
	},
	zh: {
		empty: '号码不能为空',
		genesisRange: '4位创世号码超出 Telegram 官方范围 (8000–8999)',
		invalidLength: '号码长度无效（+888 后必须为 4 位创世号或 8 位标准号）',
	},
};

/**
 * Validate that an anonymous number strictly belongs to the official 136,566 Telegram collection (N-23)
 * - 4-digit Genesis numbers MUST be in range 8000..8999 (+888 8000 to +888 8999)
 * - Standard numbers MUST be exactly 8 digits (+888 0000 0000 to +888 9999 9999)
 */
export function validateAnonymousNumber(raw?: string | null): {
	isValid: boolean;
	normalized: string;
	isGenesis: boolean;
	error?: string;
} {
	const lang = locale() || 'fa';
	const msgs = VALIDATION_ERRORS[lang] || VALIDATION_ERRORS.fa;

	if (!raw) {
		return { isValid: false, normalized: '', isGenesis: false, error: msgs.empty };
	}

	const parts = splitNumberPrefix(raw);
	const suffix = parts.rawDigits;

	if (suffix.length === 4) {
		const n = parseInt(suffix, 10);
		if (isNaN(n) || n < 8000 || n > 8999) {
			return {
				isValid: false,
				normalized: `+888${suffix}`,
				isGenesis: true,
				error: msgs.genesisRange,
			};
		}
		return {
			isValid: true,
			normalized: `+888${suffix}`,
			isGenesis: true,
		};
	}

	if (suffix.length === 8) {
		return {
			isValid: true,
			normalized: `+888${suffix}`,
			isGenesis: false,
		};
	}

	return {
		isValid: false,
		normalized: raw,
		isGenesis: false,
		error: msgs.invalidLength,
	};
}
