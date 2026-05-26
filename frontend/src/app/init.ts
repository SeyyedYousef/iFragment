import {
  setDebug,
  themeParams,
  initData,
  viewport,
  init as initSDK,
  mockTelegramEnv,
  type ThemeParams,
  retrieveLaunchParams,
  emitEvent,
  miniApp,
  backButton,

  isTMA,
  hapticFeedback,
} from '@tma.js/sdk-solid';

import { initStorageSync } from '@/shared/store/airdrop.js';
import { initProfileSync, profileSettings } from '@/shared/store/profile.js';

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
  if (import.meta.env.DEV && !(await isTMA())) {
    // Basic mock for local browser testing
    mockTelegramEnv({
      launchParams: new URLSearchParams([
        ['tgWebAppData', 'query_id=AAHdJuE0AAAAAN0i4TR&user=' + encodeURIComponent(JSON.stringify({
          id: 12345,
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
          language_code: 'en',
          is_premium: true,
        })) + '&auth_date=1716674690&hash=e8248c8b417e2e31ef78f0b72a0834ba7d8cf1f1a511394f71a4f7e2739fa41c'],
        ['tgWebAppThemeParams', JSON.stringify({ bg_color: '#0f1014', text_color: '#ffffff' })],
        ['tgWebAppPlatform', 'tdesktop'],
        ['tgWebAppVersion', '7.0'],
      ]),
    });
    console.warn('TMA Mock Environment active');
  }

  // 2. Now initialize the SDK
  setDebug(options.debug);
  initSDK();

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
    mockTelegramEnv({
      onEvent(event, next) {
        if (event.name === 'web_app_request_theme') {
          let tp: ThemeParams = {};
          if (firstThemeSent) {
            tp = themeParams.state();
          } else {
            firstThemeSent = true;
            tp ||= retrieveLaunchParams().tgWebAppThemeParams;
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

  // Mount all components used in the project.
  // We use try-catch for each component to prevent the entire app from crashing.
  
  try {
    // @ts-ignore - SDK components have different mount structures
    if (backButton.mount && typeof backButton.mount.isAvailable === 'function' && backButton.mount.isAvailable()) {
      backButton.mount();
    } else if (typeof backButton.mount === 'function') {
      backButton.mount();
    }
  } catch (e) {
    console.warn('BackButton mount failed', e);
  }
  
  initData.restore();

  try {
    // @ts-ignore
    if (miniApp.mount && typeof miniApp.mount.isAvailable === 'function' && miniApp.mount.isAvailable()) {
      miniApp.mount();
      themeParams.mount();
      themeParams.bindCssVars();
    }
  } catch (e) {
    console.warn('MiniApp/ThemeParams mount failed', e);
  }

  try {
    // @ts-ignore
    if (viewport.mount && typeof viewport.mount.isAvailable === 'function' && viewport.mount.isAvailable()) {
      viewport.mount().then(() => {
        viewport.bindCssVars();
        viewport.expand();
      }).catch(e => console.warn('Viewport expansion failed', e));
    }
  } catch (e) {
    console.warn('Viewport mount failed', e);
  }

  // Set default theme colors if available
  try {
    if (miniApp.isMounted()) {
      if (typeof miniApp.setHeaderColor === 'function') {
        miniApp.setHeaderColor('#0f1014');
      }
      if (typeof (miniApp as any).setBackgroundColor === 'function') {
        (miniApp as any).setBackgroundColor('#0f1014');
      }
    }
  } catch (e) {
    console.warn('Failed to set initial theme colors', e);
  }

  // Initialize store persistence
  initStorageSync();
  initProfileSync();

  // Wrap hapticFeedback methods to respect user preferences
  try {
    const hf = hapticFeedback as any;
    const originalImpact = hf.impactOccurred;
    const originalNotification = hf.notificationOccurred;
    const originalSelection = hf.selectionChanged;

    hf.impactOccurred = (style: any) => {
      if (profileSettings().hapticEnabled) {
        originalImpact.call(hf, style);
      }
    };

    hf.notificationOccurred = (type: any) => {
      if (profileSettings().hapticEnabled) {
        originalNotification.call(hf, type);
      }
    };

    hf.selectionChanged = () => {
      if (profileSettings().hapticEnabled) {
        originalSelection.call(hf);
      }
    };
  } catch (e) {
    console.warn('Failed to wrap hapticFeedback', e);
  }
}