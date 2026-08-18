/**
 * Telegram WebApp Native API Wrapper
 * Typed, safe wrappers for all TG WebApp methods used in the profile section.
 */

import { haptic } from './haptic.js';
export { haptic };

const getWebApp = () => (window as any).Telegram?.WebApp;

// ─── Clipboard ───
export const copyToClipboard = async (text: string): Promise<boolean> => {
	try {
		await navigator.clipboard.writeText(text);
		haptic.notify('success');
		return true;
	} catch {
		// Fallback for older browsers
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
	}
};

// ─── Sharing ───
export const shareToStory = (
	mediaUrl: string,
	params?: { text?: string; widget_link?: { url: string; name?: string } },
) => {
	try {
		getWebApp()?.shareToStory(mediaUrl, params);
	} catch {}
};

export const switchInlineQuery = (query: string, chatTypes?: string[]) => {
	try {
		getWebApp()?.switchInlineQuery(query, chatTypes);
	} catch {}
};

export const shareMessage = (msgId: string) => {
	try {
		getWebApp()?.shareMessage(msgId);
	} catch {}
};

// ─── Navigation ───
export const openTelegramLink = (url: string) => {
	try {
		getWebApp()?.openTelegramLink(url);
	} catch {}
};

export const openLink = (url: string, options?: { try_instant_view?: boolean }) => {
	try {
		getWebApp()?.openLink(url, options);
	} catch {}
};

// ─── Home Screen ───
export const addToHomeScreen = () => {
	try {
		getWebApp()?.addToHomeScreen();
	} catch {}
};

export const checkHomeScreenStatus = (): Promise<string> => {
	return new Promise((resolve) => {
		try {
			getWebApp()?.checkHomeScreenStatus((status: string) => resolve(status));
		} catch {
			resolve('unsupported');
		}
	});
};

// ─── Emoji Status ───
export const requestEmojiStatusAccess = (): Promise<boolean> => {
	return new Promise((resolve) => {
		try {
			getWebApp()?.requestEmojiStatusAccess((granted: boolean) => resolve(granted));
		} catch {
			resolve(false);
		}
	});
};

export const setEmojiStatus = (
	customEmojiId: string,
	params?: { duration?: number },
): Promise<boolean> => {
	return new Promise((resolve) => {
		try {
			getWebApp()?.setEmojiStatus(customEmojiId, params, (result: boolean) => resolve(result));
		} catch {
			resolve(false);
		}
	});
};

// ─── Write Access ───
export const requestWriteAccess = (): Promise<boolean> => {
	return new Promise((resolve) => {
		try {
			getWebApp()?.requestWriteAccess((granted: boolean) => resolve(granted));
		} catch {
			resolve(false);
		}
	});
};

// ─── Contact ───
export const requestContact = (): Promise<boolean> => {
	return new Promise((resolve) => {
		try {
			getWebApp()?.requestContact((sent: boolean) => resolve(sent));
		} catch {
			resolve(false);
		}
	});
};

// ─── QR Scanner ───
export const showScanQrPopup = (text?: string): Promise<string | null> => {
	return new Promise((resolve) => {
		try {
			getWebApp()?.showScanQrPopup({ text: text || 'Scan referral QR code' }, (data: string) => {
				getWebApp()?.closeScanQrPopup();
				resolve(data);
				return true;
			});
		} catch {
			resolve(null);
		}
	});
};

// ─── Popups ───
export const showAlert = (message: string): Promise<void> => {
	return new Promise((resolve) => {
		try {
			getWebApp()?.showAlert(message, () => resolve());
		} catch {
			alert(message);
			resolve();
		}
	});
};

export const showConfirm = (message: string): Promise<boolean> => {
	return new Promise((resolve) => {
		try {
			getWebApp()?.showConfirm(message, (confirmed: boolean) => resolve(confirmed));
		} catch {
			resolve(confirm(message));
		}
	});
};

// ─── Biometric Manager ───
export const biometric = {
	isAvailable: (): boolean => {
		try {
			const bm = getWebApp()?.BiometricManager;
			return bm?.isInited && bm?.isBiometricAvailable;
		} catch {
			return false;
		}
	},
	init: (): Promise<boolean> => {
		return new Promise((resolve) => {
			try {
				getWebApp()?.BiometricManager?.init(() => resolve(true));
			} catch {
				resolve(false);
			}
		});
	},
	requestAccess: (reason: string): Promise<boolean> => {
		return new Promise((resolve) => {
			try {
				getWebApp()?.BiometricManager?.requestAccess({ reason }, (granted: boolean) =>
					resolve(granted),
				);
			} catch {
				resolve(false);
			}
		});
	},
	authenticate: (reason: string): Promise<boolean> => {
		return new Promise((resolve) => {
			try {
				getWebApp()?.BiometricManager?.authenticate({ reason }, (success: boolean) =>
					resolve(success),
				);
			} catch {
				resolve(false);
			}
		});
	},
};

// ─── Download File ───
export const downloadFile = (url: string, fileName: string): Promise<boolean> => {
	return new Promise((resolve) => {
		try {
			getWebApp()?.downloadFile({ url, file_name: fileName }, (accepted: boolean) =>
				resolve(accepted),
			);
		} catch {
			resolve(false);
		}
	});
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
		return getWebApp()?.isVersionAtLeast(version) || false;
	} catch {
		return false;
	}
};

// ─── Closing Confirmation (TMA 2.0) ───
export const enableClosingConfirmation = () => {
	try {
		getWebApp()?.enableClosingConfirmation();
	} catch {}
};

export const disableClosingConfirmation = () => {
	try {
		getWebApp()?.disableClosingConfirmation();
	} catch {}
};

// ─── Fullscreen Mode (TMA 2.0) ───
export const requestFullscreen = () => {
	try {
		getWebApp()?.requestFullscreen();
	} catch {}
};

export const exitFullscreen = () => {
	try {
		getWebApp()?.exitFullscreen();
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
	return new Promise((resolve) => {
		try {
			getWebApp()?.openSubscriptionLink(url, (success: boolean) => resolve(success));
		} catch {
			resolve(false);
		}
	});
};

export const openInvoice = (url: string): Promise<string> => {
	return new Promise((resolve) => {
		try {
			getWebApp()?.openInvoice(url, (status: string) => resolve(status));
		} catch {
			resolve('failed');
		}
	});
};
