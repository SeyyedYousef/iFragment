/**
 * Safe HTML sanitizer for Telegram Broadcast message preview (RB-SEC-P0-001).
 * Allows only Telegram-compatible tags (b, strong, i, em, u, ins, s, strike, del, a, code, pre, blockquote, tg-spoiler).
 * Strips all script execution, event handlers, and dangerous protocols (javascript:, data:).
 */
export function sanitizeTelegramHtml(input: string): string {
	if (!input) return '';

	if (typeof window === 'undefined' || !window.DOMParser) {
		// Fallback for SSR / non-browser: escape everything
		return input
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(input, 'text/html');

	const ALLOWED_TAGS = new Set([
		'B',
		'STRONG',
		'I',
		'EM',
		'U',
		'INS',
		'S',
		'STRIKE',
		'DEL',
		'A',
		'CODE',
		'PRE',
		'BLOCKQUOTE',
		'TG-SPOILER',
		'SPAN',
		'BR',
		'P',
	]);

	function cleanNode(node: Node): Node | null {
		if (node.nodeType === Node.TEXT_NODE) {
			return document.createTextNode(node.textContent || '');
		}

		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement;
			const tagName = el.tagName.toUpperCase();

			if (!ALLOWED_TAGS.has(tagName)) {
				// Disallowed tag: return its sanitized children as fragment, or plain text if dangerous
				if (
					tagName === 'SCRIPT' ||
					tagName === 'STYLE' ||
					tagName === 'IFRAME' ||
					tagName === 'OBJECT' ||
					tagName === 'EMBED' ||
					tagName === 'SVG'
				) {
					return null;
				}
				const frag = document.createDocumentFragment();
				for (const child of Array.from(el.childNodes)) {
					const cleaned = cleanNode(child);
					if (cleaned) frag.appendChild(cleaned);
				}
				return frag;
			}

			const cleanEl = document.createElement(tagName.toLowerCase());

			// Safe attribute handling
			if (tagName === 'A') {
				const rawHref = el.getAttribute('href') || '';
				const trimmed = rawHref.trim().toLowerCase();
				if (
					trimmed.startsWith('https://') ||
					trimmed.startsWith('http://') ||
					trimmed.startsWith('tg://') ||
					trimmed.startsWith('t.me/')
				) {
					cleanEl.setAttribute('href', rawHref);
					cleanEl.setAttribute('target', '_blank');
					cleanEl.setAttribute('rel', 'noopener noreferrer');
				}
			}

			// Copy class only if safe
			if (tagName === 'CODE' || tagName === 'PRE') {
				const className = el.getAttribute('class');
				if (className && /^language-[a-zA-Z0-9_-]+$/.test(className)) {
					cleanEl.setAttribute('class', className);
				}
			}

			for (const child of Array.from(el.childNodes)) {
				const cleaned = cleanNode(child);
				if (cleaned) cleanEl.appendChild(cleaned);
			}

			return cleanEl;
		}

		return null;
	}

	const container = document.createElement('div');
	for (const child of Array.from(doc.body.childNodes)) {
		const cleaned = cleanNode(child);
		if (cleaned) container.appendChild(cleaned);
	}

	return container.innerHTML;
}
