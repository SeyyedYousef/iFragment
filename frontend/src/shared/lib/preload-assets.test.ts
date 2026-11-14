import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadCriticalFonts } from './preload-assets.js';

describe('preloadCriticalFonts', () => {
	const originalFontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');

	afterEach(() => {
		vi.useRealTimers();
		if (originalFontsDescriptor) {
			Object.defineProperty(document, 'fonts', originalFontsDescriptor);
		} else {
			Reflect.deleteProperty(document, 'fonts');
		}
	});

	it('requests Material Symbols Outlined and primary UI fonts cleanly', async () => {
		const loadMock = vi.fn().mockResolvedValue([]);
		Object.defineProperty(document, 'fonts', {
			configurable: true,
			value: {
				load: loadMock,
				ready: Promise.resolve(),
			},
		});

		await preloadCriticalFonts(1000);

		const requestedSpecs = loadMock.mock.calls.map((call) => call[0]);
		expect(requestedSpecs).toContain('24px "Material Symbols Outlined"');
		expect(requestedSpecs).toContain('500 24px "Material Symbols Outlined"');
		expect(requestedSpecs).toContain('400 16px "Vazirmatn"');
		expect(requestedSpecs).toContain('400 16px "Manrope"');
	});

	it('resolves cleanly within timeout even if a font request stalls', async () => {
		vi.useFakeTimers();
		const pending = new Promise(() => {});
		Object.defineProperty(document, 'fonts', {
			configurable: true,
			value: {
				load: vi.fn().mockReturnValue(pending),
				ready: pending,
			},
		});

		const promise = preloadCriticalFonts(500);
		await vi.advanceTimersByTimeAsync(500);
		await expect(promise).resolves.toBeUndefined();
	});

	it('never throws when Font Loading API is unavailable', async () => {
		Object.defineProperty(document, 'fonts', {
			configurable: true,
			value: undefined,
		});

		await expect(preloadCriticalFonts(500)).resolves.toBeUndefined();
	});
});
