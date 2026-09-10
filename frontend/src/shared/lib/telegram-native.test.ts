import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	biometric,
	checkHomeScreenStatus,
	closeMiniApp,
	copyToClipboard,
	downloadFile,
	openInvoice,
	openSubscriptionLink,
	requestContact,
	requestEmojiStatusAccess,
	requestWriteAccess,
	setEmojiStatus,
	showAlert,
	showConfirm,
	showScanQrPopup,
} from './telegram-native.js';

describe('telegram-native wrapper resilience and timeouts', () => {
	beforeEach(() => {
		// Reset window Telegram mock
		delete (window as any).Telegram;
		vi.restoreAllMocks();
	});

	it('should resolve checkHomeScreenStatus to "unsupported" when Telegram WebApp is absent', async () => {
		const status = await checkHomeScreenStatus();
		expect(status).toBe('unsupported');
	});

	it('should resolve requestWriteAccess to false when Telegram WebApp is absent', async () => {
		const granted = await requestWriteAccess();
		expect(granted).toBe(false);
	});

	it('should resolve requestEmojiStatusAccess to false when Telegram WebApp is absent', async () => {
		const granted = await requestEmojiStatusAccess();
		expect(granted).toBe(false);
	});

	it('should resolve setEmojiStatus to false when Telegram WebApp is absent', async () => {
		const result = await setEmojiStatus('custom_id');
		expect(result).toBe(false);
	});

	it('should resolve requestContact to false when Telegram WebApp is absent', async () => {
		const result = await requestContact();
		expect(result).toBe(false);
	});

	it('should resolve showScanQrPopup to null when Telegram WebApp is absent', async () => {
		const result = await showScanQrPopup();
		expect(result).toBe(null);
	});

	it('should fallback to browser alert/confirm when WebApp popups are absent', async () => {
		const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
		await showAlert('Test Alert');
		expect(alertSpy).toHaveBeenCalledWith('Test Alert');

		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
		const confirmed = await showConfirm('Test Confirm');
		expect(confirmSpy).toHaveBeenCalledWith('Test Confirm');
		expect(confirmed).toBe(true);
	});

	it('should return false for biometric methods when WebApp or BiometricManager is absent', async () => {
		expect(biometric.isAvailable()).toBe(false);
		expect(biometric.isAccessGranted()).toBe(false);
		expect(biometric.getBiometricType()).toBe('unknown');

		const initResult = await biometric.init();
		expect(initResult).toBe(false);

		const accessResult = await biometric.requestAccess('test');
		expect(accessResult).toBe(false);

		const authResult = await biometric.authenticate('test');
		expect(authResult).toBe(false);
	});

	it('should resolve when Telegram WebApp callback succeeds', async () => {
		(window as any).Telegram = {
			WebApp: {
				requestWriteAccess: (cb: (ok: boolean) => void) => cb(true),
				checkHomeScreenStatus: (cb: (s: string) => void) => cb('added'),
				BiometricManager: {
					isInited: true,
					isBiometricAvailable: true,
					isAccessGranted: true,
					biometricType: 'face',
					init: (cb: () => void) => cb(),
					authenticate: (params: any, cb: (ok: boolean) => void) => cb(true),
				},
				close: vi.fn(),
			},
		};

		const writeGranted = await requestWriteAccess();
		expect(writeGranted).toBe(true);

		const homeStatus = await checkHomeScreenStatus();
		expect(homeStatus).toBe('added');

		const bioInit = await biometric.init();
		expect(bioInit).toBe(true);
		expect(biometric.isAvailable()).toBe(true);
		expect(biometric.getBiometricType()).toBe('face');

		const bioAuth = await biometric.authenticate('Test reason');
		expect(bioAuth).toBe(true);

		closeMiniApp();
		expect((window as any).Telegram.WebApp.close).toHaveBeenCalled();
	});

	it('should not hang indefinitely if Telegram callback is never invoked (timeout safeguard)', async () => {
		// Mock a broken Telegram client that accepts callbacks but never calls them
		(window as any).Telegram = {
			WebApp: {
				requestWriteAccess: vi.fn(), // does not invoke callback
			},
		};

		// Run with short timeout
		const start = Date.now();
		const result = await requestWriteAccess();
		// Must resolve to false on timeout
		expect(result).toBe(false);
	}, 10000);
});
