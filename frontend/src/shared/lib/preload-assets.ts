const CRITICAL_FONT_SPECS = [
	'24px "Material Symbols Outlined"',
	'500 24px "Material Symbols Outlined"',
	'400 16px "Vazirmatn"',
	'600 16px "Vazirmatn"',
	'400 16px "Manrope"',
	'600 16px "Manrope"',
] as const;

/**
 * Eagerly downloads and decodes the local icon and primary UI font faces so the
 * first revealed frame after splash has every icon and glyph ready.
 * Strictly bounded by `timeoutMs` and never rejects.
 */
export async function preloadCriticalFonts(timeoutMs = 3500): Promise<void> {
	if (typeof document === 'undefined' || !('fonts' in document)) {
		return;
	}

	const fontSet = document.fonts;
	if (!fontSet || typeof fontSet.load !== 'function') {
		return;
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const loadAll = Promise.allSettled([
			...CRITICAL_FONT_SPECS.map((spec) => fontSet.load(spec)),
			fontSet.ready ?? Promise.resolve(),
		]).then(() => undefined);

		const timeout = new Promise<void>((resolve) => {
			timer = setTimeout(resolve, Math.max(0, timeoutMs));
		});

		await Promise.race([loadAll, timeout]);
	} catch {
		// Non-fatal: fall through without blocking application startup.
	} finally {
		if (timer !== undefined) {
			clearTimeout(timer);
		}
	}
}
