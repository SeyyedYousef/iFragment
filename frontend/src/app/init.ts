import {
	backButton,
	emitEvent,
	hapticFeedback,
	initData,
	init as initSDK,
	isTMA,
	miniApp,
	mockTelegramEnv,
	retrieveLaunchParams,
	setDebug,
	themeParams,
	viewport,
} from '@tma.js/sdk-solid';

import { initProfileSync, profileSettings } from '@/entities/user/index.js';
import { checkMiniAppOrigin } from '@/shared/lib/mini-app-origin.js';

const withMountTimeout = async (promiseOrVal: unknown, ms = 1200): Promise<void> => {
	if (promiseOrVal && typeof (promiseOrVal as Promise<unknown>).then === 'function') {
		await Promise.race([
			promiseOrVal as Promise<unknown>,
			new Promise<void>((resolve) => setTimeout(resolve, ms)),
		]);
	}
};

/**
 * Initializes the application and configures its dependencies.
 */
export async function init(options: {
	debug: boolean;
	eruda: boolean;
	mockForMacOS: boolean;
}): Promise<void> {
	// 1. First, handle environment mocking if we're not in Telegram
	// This must happen BEFORE initSDK to prevent hanging
	let realParams: ReturnType<typeof retrieveLaunchParams> | undefined;
	try {
		realParams = retrieveLaunchParams();
	} catch (_e) {
		try {
			sessionStorage.removeItem('tapps/launchParams');
			sessionStorage.removeItem('telegram-apps/launch-params');
		} catch {}
	}

	if (import.meta.env.DEV && !(await isTMA()) && !realParams) {
		const mockThemeParams = {
			accent_text_color: '#6ab2f2',
			bg_color: '#06070b',
			button_color: '#3390ec',
			button_text_color: '#ffffff',
			bottom_bar_bg_color: '#06070b',
			destructive_text_color: '#ec3942',
			header_bg_color: '#06070b',
			hint_color: '#708499',
			link_color: '#6ab3f3',
			secondary_bg_color: '#10131c',
			section_bg_color: '#10131c',
			section_header_text_color: '#6ab3f3',
			section_separator_color: '#1e2433',
			subtitle_text_color: '#708499',
			text_color: '#f5f5f5',
		} as const;

		mockTelegramEnv({
			launchParams: {
				tgWebAppThemeParams: mockThemeParams,
				tgWebAppData: new URLSearchParams([
					[
						'user',
						JSON.stringify({
							id: 5076130392,
							first_name: 'iFragment',
							last_name: 'Preview',
							username: 'ifragment',
							language_code: 'fa',
							is_premium: true,
							allows_write_to_pm: true,
						}),
					],
					['hash', '89d6079ad6762351f38c6dbbc41bb53048019256a9443988af7a48bcad16ba31'],
					['signature', '5O_G2H_wXgI32v2G-w0y-W_O3G_4G'],
					['auth_date', '1716922846'],
					['chat_type', 'sender'],
					['chat_instance', '8428209589180549439'],
				]).toString(),
				tgWebAppVersion: '8.0',
				tgWebAppPlatform: 'tdesktop',
			},
			onEvent(event) {
				if (event.name === 'web_app_request_theme') {
					emitEvent('theme_changed', { theme_params: mockThemeParams });
				}
				if (event.name === 'web_app_request_viewport' || event.name === 'web_app_expand') {
					emitEvent('viewport_changed', {
						height: window.innerHeight || 844,
						width: window.innerWidth || 390,
						is_expanded: true,
						is_state_stable: true,
					});
				}
				if (event.name === 'web_app_request_safe_area') {
					emitEvent('safe_area_changed', { left: 0, top: 0, right: 0, bottom: 0 });
				}
				if (event.name === 'web_app_request_content_safe_area') {
					emitEvent('content_safe_area_changed', { left: 0, top: 0, right: 0, bottom: 0 });
				}
			},
		});
	}

	// 2. Now initialize the SDK
	setDebug(options.debug);
	initSDK();

	// 2.1 Bot API 10.2 origin guard — warn on domain mismatch with BotFather
	// allow-list (native methods are blocked by Telegram since 2026-07-20).
	checkMiniAppOrigin();

	// Add Eruda if needed.
	if (import.meta.env.DEV && options.eruda) {
		void import('eruda').then(({ default: eruda }) => {
			eruda.init();
			eruda.position({ x: window.innerWidth - 50, y: 0 });
		});
	}

	// Telegram for macOS has a ton of bugs, including cases, when the client doesn't
	// even response to the "web_app_request_theme" method. It also generates an incorrect
	// event for the "web_app_request_safe_area" method.
	if (options.mockForMacOS) {
		let firstThemeSent = false;

		// Only intercept events without overwriting existing launchParams in storage
		mockTelegramEnv({
			onEvent(event, next) {
				if (event.name === 'web_app_request_theme') {
					let tp: Record<string, `#${string}` | undefined> = {};
					if (firstThemeSent) {
						try {
							tp = themeParams.state() as Record<string, `#${string}` | undefined>;
						} catch (_e) {}
					} else {
						firstThemeSent = true;
						try {
							tp = (retrieveLaunchParams().tgWebAppThemeParams || {}) as Record<
								string,
								`#${string}` | undefined
							>;
						} catch (_e) {}
					}
					return emitEvent('theme_changed', { theme_params: tp });
				}

				if (event.name === 'web_app_request_safe_area') {
					return emitEvent('safe_area_changed', { left: 0, top: 0, right: 0, bottom: 0 });
				}

				next();
			},
		});
	}

	// Mount all components used in the project with bounded timeouts so iframe environments never hang.
	try {
		if (backButton && typeof backButton.mount === 'function') {
			await withMountTimeout(backButton.mount());
		}
	} catch (e) {
		console.warn('BackButton mount failed', e);
	}

	try {
		if (initData && typeof initData.restore === 'function') {
			initData.restore();
		}
	} catch (e) {
		console.warn('initData restore failed', e);
	}

	try {
		if (miniApp && typeof miniApp.mount === 'function') {
			await withMountTimeout(miniApp.mount());
		}
		if (themeParams && typeof themeParams.mount === 'function') {
			await withMountTimeout(themeParams.mount());
		}
		if (themeParams && typeof themeParams.bindCssVars === 'function') {
			themeParams.bindCssVars();
		}
	} catch (e) {
		console.warn('MiniApp/ThemeParams mount failed', e);
	}

	try {
		if (viewport && typeof viewport.mount === 'function') {
			await withMountTimeout(viewport.mount());
			if (typeof viewport.bindCssVars === 'function') viewport.bindCssVars();
			if (typeof viewport.expand === 'function') viewport.expand();
		}
	} catch (e) {
		console.warn('Viewport mount or expansion failed', e);
	}

	// Set default theme colors and disable vertical swipes if available
	try {
		if (miniApp && typeof miniApp.isMounted === 'function' && miniApp.isMounted()) {
			if (typeof miniApp.setHeaderColor === 'function') {
				miniApp.setHeaderColor('#000000');
			}
			if (typeof (miniApp as any).setBackgroundColor === 'function') {
				(miniApp as any).setBackgroundColor('#000000');
			}
		}
		// Do NOT disable vertical swipes as it locks vertical touch scrolling in Telegram Android/iOS client
		// if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) { ... }
	} catch (e) {
		console.warn('Failed to set initial theme colors or disable vertical swipes', e);
	}

	// Initialize store persistence
	initProfileSync();

	// Wrap hapticFeedback methods to respect user preferences
	try {
		const hf = hapticFeedback as any;
		if (hf && typeof hf.impactOccurred === 'function') {
			const originalImpact = hf.impactOccurred;
			const originalNotification = hf.notificationOccurred;
			const originalSelection = hf.selectionChanged;

			hf.impactOccurred = (style: any) => {
				if (profileSettings()?.hapticEnabled !== false) {
					originalImpact.call(hf, style);
				}
			};

			hf.notificationOccurred = (type: any) => {
				if (profileSettings()?.hapticEnabled !== false) {
					originalNotification.call(hf, type);
				}
			};

			hf.selectionChanged = () => {
				if (profileSettings()?.hapticEnabled !== false) {
					originalSelection.call(hf);
				}
			};
		}
	} catch (e) {
		console.warn('Failed to wrap hapticFeedback', e);
	}
}
