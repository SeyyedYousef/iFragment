/**
 * Telegram WebApp Native API Wrapper
 * Typed, safe wrappers for all TG WebApp methods used in the profile section.
 */

import { haptic } from './haptic.js';

export { haptic };

const getWebApp = () => (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : undefined);

/**
 * Safely execute an asynchronous callback-based Telegram WebApp method
 * with feature detection and a strict timeout guarantee.
 */
function safeTelegramAsync<T>(
	caller: (wa: any, resolve: (val: T) => void) => void,
	fallback: T,
	timeoutMs = 4000,
): Promise<T> {
	return new Promise((resolve) => {
		const wa = getWebApp();
		if (!wa) {
			resolve(fallback);
			return;
		}

		let settled = false;
		const timer = setTimeout(() => {
			if (!settled) {
				settled = true;
				resolve(fallback);
			}
		}, timeoutMs);

		try {
			caller(wa, (val: T) => {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					resolve(val);
				}
			});
		} catch {
			if (!settled) {
				settled = true;
				clearTimeout(timer);
				resolve(fallback);
			}
		}
	});
}

// ─── Clipboard ───
export const copyToClipboard = async (text: string): Promise<boolean> => {
	try {
		await navigator.clipboard.writeText(text);
		haptic.notify('success');
		return true;
	} catch {
		// Fallback for older browsers
		try {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
			haptic.notify('success');
			return true;
		} catch {
			return false;
		}
	}
};

// ─── Sharing ───
export const shareToStory = (
	mediaUrl: string,
	params?: { text?: string; widget_link?: { url: string; name?: string } },
) => {
	try {
		getWebApp()?.shareToStory?.(mediaUrl, params);
	} catch {}
};

export const switchInlineQuery = (query: string, chatTypes?: string[]) => {
	try {
		getWebApp()?.switchInlineQuery?.(query, chatTypes);
	} catch {}
};

export const shareMessage = (msgId: string) => {
	try {
		getWebApp()?.shareMessage?.(msgId);
	} catch {}
};

// ─── Navigation ───
export const openTelegramLink = (url: string) => {
	try {
		getWebApp()?.openTelegramLink?.(url);
	} catch {}
};

export const openLink = (url: string, options?: { try_instant_view?: boolean }) => {
	try {
		getWebApp()?.openLink?.(url, options);
	} catch {}
};

// ─── App Lifecycle ───
export const closeMiniApp = () => {
	try {
		getWebApp()?.close?.();
	} catch {}
};

// ─── Home Screen ───
export const addToHomeScreen = () => {
	try {
		getWebApp()?.addToHomeScreen?.();
	} catch {}
};

export const checkHomeScreenStatus = (): Promise<string> => {
	return safeTelegramAsync<string>((wa, resolve) => {
		if (typeof wa.checkHomeScreenStatus !== 'function') {
			resolve('unsupported');
			return;
		}
		wa.checkHomeScreenStatus((status: string) => resolve(status || 'unsupported'));
	}, 'unsupported');
};

// ─── Emoji Status ───
export const requestEmojiStatusAccess = (): Promise<boolean> => {
	return safeTelegramAsync<boolean>((wa, resolve) => {
		if (typeof wa.requestEmojiStatusAccess !== 'function') {
			resolve(false);
			return;
		}
		wa.requestEmojiStatusAccess((granted: boolean) => resolve(Boolean(granted)));
	}, false);
};

export const setEmojiStatus = (
	customEmojiId: string,
	params?: { duration?: number },
): Promise<boolean> => {
	return safeTelegramAsync<boolean>((wa, resolve) => {
		if (typeof wa.setEmojiStatus !== 'function') {
			resolve(false);
			return;
		}
		wa.setEmojiStatus(customEmojiId, params, (result: boolean) => resolve(Boolean(result)));
	}, false);
};

// ─── Write Access ───
export const requestWriteAccess = (): Promise<boolean> => {
	return safeTelegramAsync<boolean>((wa, resolve) => {
		if (typeof wa.requestWriteAccess !== 'function') {
			resolve(false);
			return;
		}
		wa.requestWriteAccess((granted: boolean) => resolve(Boolean(granted)));
	}, false);
};

// ─── Contact ───
export const requestContact = (): Promise<boolean> => {
	return safeTelegramAsync<boolean>((wa, resolve) => {
		if (typeof wa.requestContact !== 'function') {
			resolve(false);
			return;
		}
		wa.requestContact((sent: boolean) => resolve(Boolean(sent)));
	}, false);
};

// ─── QR Scanner ───
export const showScanQrPopup = (text?: string): Promise<string | null> => {
	return safeTelegramAsync<string | null>((wa, resolve) => {
		if (typeof wa.showScanQrPopup !== 'function') {
			resolve(null);
			return;
		}
		wa.showScanQrPopup({ text: text || 'Scan QR code' }, (data: string) => {
			try {
				wa.closeScanQrPopup?.();
			} catch {}
			resolve(data || null);
			return true;
		});
	}, null, 15000);
};

// ─── Popups ───
export const showAlert = (message: string): Promise<void> => {
	const wa = getWebApp();
	if (!wa || typeof wa.showAlert !== 'function') {
		try {
			if (typeof window !== 'undefined' && typeof window.alert === 'function') {
				window.alert(message);
			}
		} catch {}
		return Promise.resolve();
	}
	return safeTelegramAsync<void>(
		(activeWa, resolve) => {
			activeWa.showAlert(message, () => resolve());
		},
		undefined,
		10000,
	);
};

export const showConfirm = (message: string): Promise<boolean> => {
	const wa = getWebApp();
	if (!wa || typeof wa.showConfirm !== 'function') {
		try {
			if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
				return Promise.resolve(Boolean(window.confirm(message)));
			}
		} catch {}
		return Promise.resolve(false);
	}
	return safeTelegramAsync<boolean>(
		(activeWa, resolve) => {
			activeWa.showConfirm(message, (confirmed: boolean) => resolve(Boolean(confirmed)));
		},
		false,
		15000,
	);
};

// ─── Biometric Manager ───
export const biometric = {
	isAvailable: (): boolean => {
		try {
			const bm = getWebApp()?.BiometricManager;
			return Boolean(bm?.isInited && bm?.isBiometricAvailable);
		} catch {
			return false;
		}
	},
	isAccessGranted: (): boolean => {
		try {
			const bm = getWebApp()?.BiometricManager;
			return Boolean(bm?.isAccessGranted);
		} catch {
			return false;
		}
	},
	getBiometricType: (): 'finger' | 'face' | 'unknown' => {
		try {
			const bm = getWebApp()?.BiometricManager;
			return bm?.biometricType || 'unknown';
		} catch {
			return 'unknown';
		}
	},
	init: (): Promise<boolean> => {
		return safeTelegramAsync<boolean>((wa, resolve) => {
			const bm = wa.BiometricManager;
			if (!bm || typeof bm.init !== 'function') {
				resolve(false);
				return;
			}
			bm.init(() => resolve(Boolean(bm.isInited && bm.isBiometricAvailable)));
		}, false);
	},
	requestAccess: (reason: string): Promise<boolean> => {
		return safeTelegramAsync<boolean>((wa, resolve) => {
			const bm = wa.BiometricManager;
			if (!bm || typeof bm.requestAccess !== 'function') {
				resolve(false);
				return;
			}
			bm.requestAccess({ reason }, (granted: boolean) => resolve(Boolean(granted)));
		}, false);
	},
	authenticate: (reason: string): Promise<boolean> => {
		return safeTelegramAsync<boolean>((wa, resolve) => {
			const bm = wa.BiometricManager;
			if (!bm || typeof bm.authenticate !== 'function') {
				resolve(false);
				return;
			}
			bm.authenticate({ reason }, (success: boolean) => resolve(Boolean(success)));
		}, false, 15000);
	},
	openSettings: () => {
		try {
			getWebApp()?.BiometricManager?.openSettings?.();
		} catch {}
	},
};

// ─── Download File ───
export const downloadFile = (url: string, fileName: string): Promise<boolean> => {
	return safeTelegramAsync<boolean>((wa, resolve) => {
		if (typeof wa.downloadFile !== 'function') {
			resolve(false);
			return;
		}
		wa.downloadFile({ url, file_name: fileName }, (accepted: boolean) =>
			resolve(Boolean(accepted)),
		);
	}, false);
};

// ─── Platform Info ───
export const getPlatform = (): string => {
	try {
		return getWebApp()?.platform || 'unknown';
	} catch {
		return 'unknown';
	}
};

export const getVersion = (): string => {
	try {
		return getWebApp()?.version || '0.0';
	} catch {
		return '0.0';
	}
};

export const isVersionAtLeast = (version: string): boolean => {
	try {
		return getWebApp()?.isVersionAtLeast?.(version) || false;
	} catch {
		return false;
	}
};

// ─── Closing Confirmation (TMA 2.0) ───
export const enableClosingConfirmation = () => {
	try {
		getWebApp()?.enableClosingConfirmation?.();
	} catch {}
};

export const disableClosingConfirmation = () => {
	try {
		getWebApp()?.disableClosingConfirmation?.();
	} catch {}
};

// ─── Fullscreen Mode (TMA 2.0) ───
export const requestFullscreen = () => {
	try {
		getWebApp()?.requestFullscreen?.();
	} catch {}
};

export const exitFullscreen = () => {
	try {
		getWebApp()?.exitFullscreen?.();
	} catch {}
};

export const isFullscreen = (): boolean => {
	try {
		return getWebApp()?.isFullscreen || false;
	} catch {
		return false;
	}
};

// ─── Subscriptions & Invoices (TMA 2.0) ───
export const openSubscriptionLink = (url: string): Promise<boolean> => {
	return safeTelegramAsync<boolean>((wa, resolve) => {
		if (typeof wa.openSubscriptionLink !== 'function') {
			resolve(false);
			return;
		}
		wa.openSubscriptionLink(url, (success: boolean) => resolve(Boolean(success)));
	}, false);
};

export const openInvoice = (url: string): Promise<string> => {
	return safeTelegramAsync<string>((wa, resolve) => {
		if (typeof wa.openInvoice !== 'function') {
			resolve('failed');
			return;
		}
		wa.openInvoice(url, (status: string) => resolve(status || 'failed'));
	}, 'failed', 20000);
};
