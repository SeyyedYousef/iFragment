/* @refresh reload */

import * as Sentry from '@sentry/browser';
import { emitEvent, isTMA, mockTelegramEnv, retrieveLaunchParams } from '@tma.js/sdk-solid';
import { render } from 'solid-js/web';
import { init } from '@/app/init.js';
import { Root } from '@/app/Root.js';
import { bootstrapAuth } from '@/shared/api/axios.js';
import { hideSplash } from '@/shared/lib/splash.js';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary.js';

import './app/styles/index.css';

if (import.meta.env.VITE_SENTRY_DSN) {
	Sentry.init({
		dsn: import.meta.env.VITE_SENTRY_DSN,
		integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
		tracesSampleRate: 0.1,
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 1.0,
	});
}

const MOCK_HASH = '89d6079ad6762351f38c6dbbc41bb53048019256a9443988af7a48bcad16ba31';

const MOCK_THEME_PARAMS = {
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

function applyPreviewMockEnv() {
	mockTelegramEnv({
		launchParams: {
			tgWebAppThemeParams: MOCK_THEME_PARAMS,
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
				['hash', MOCK_HASH],
				['signature', '5O_G2H_wXgI32v2G-w0y-W_O3G_4G'],
				['auth_date', '1716922846'],
				['query_id', 'AAHdF60pAAAAANYXrSkW1'],
			]).toString(),
			tgWebAppVersion: '8.0',
			tgWebAppPlatform: 'tdesktop',
		},
		onEvent(event) {
			if (event.name === 'web_app_request_theme') {
				emitEvent('theme_changed', { theme_params: MOCK_THEME_PARAMS });
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

async function startApp() {
	const root = document.getElementById('root');
	if (!root) return;

	// Prevent iOS Safari native pinch-to-zoom gesture
	document.addEventListener('gesturestart', (e) => {
		e.preventDefault();
	});

	try {
		// 1. Check if we already have real launch params (e.g. from URL or Session Storage)
		let realParams: ReturnType<typeof retrieveLaunchParams> | undefined;
		try {
			realParams = retrieveLaunchParams();
		} catch (_e) {
			// Clear any stale or legacy v2 launchParams cached in sessionStorage
			try {
				sessionStorage.removeItem('tapps/launchParams');
				sessionStorage.removeItem('telegram-apps/launch-params');
			} catch {}
		}

		const hasRealTelegramInitData =
			typeof window !== 'undefined' &&
			Boolean((window as any).Telegram?.WebApp?.initData) &&
			!String((window as any).Telegram?.WebApp?.initData).includes(MOCK_HASH);

		const isStoredMockSession =
			!realParams ||
			realParams.tgWebAppData?.hash === MOCK_HASH ||
			(!hasRealTelegramInitData && !(await isTMA()));

		const isPreviewHost =
			typeof window !== 'undefined' &&
			(window.location.hostname === 'localhost' ||
				window.location.hostname === '127.0.0.1' ||
				window.location.hostname.endsWith('.run.app'));

		// 2. Always attach the mock bridge + onEvent responder when running outside real Telegram
		//    (especially inside iframe preview environments like Google AI Studio where sessionStorage
		//    persists across reloads while the in-memory postMessage interceptor does not).
		if (isStoredMockSession && !hasRealTelegramInitData) {
			if (
				(import.meta.env.DEV || isPreviewHost || import.meta.env.VITE_FORCE_MOCKS === 'true') &&
				import.meta.env.VITE_USE_MOCKS !== 'false'
			) {
				applyPreviewMockEnv();
			} else {
				console.warn(
					'Running outside Telegram without launch params. Mock environment disabled as per user request.',
				);
				throw new Error('Please open this application inside Telegram.');
			}
		}

		// 3. Now it's safe to retrieve params
		const launchParams = retrieveLaunchParams();
		const debug =
			import.meta.env.DEV &&
			((launchParams.tgWebAppStartParam || '').includes('debug') ||
				localStorage.getItem('debug') === 'true');

		if (debug) {
			try {
				const eruda = await import('eruda');
				eruda.default.init();
			} catch (e) {
				console.warn('Failed to load Eruda', e);
			}
		}

		// 4. Initialize App logic
		await init({
			debug,
			eruda: false,
			mockForMacOS: launchParams.tgWebAppPlatform === 'macos',
		});

		// 4.5. Proactively obtain JWT before any API calls (bounded by 2.5s timeout so UI never hangs)
		await Promise.race([
			bootstrapAuth(),
			new Promise<void>((resolve) => setTimeout(resolve, 2500)),
		]);

		// 5. Final Render
		render(
			() => (
				<ErrorBoundary>
					<Root />
				</ErrorBoundary>
			),
			root,
		);

		// 6. Hide splash — دو rAF پشت سر هم تضمین می‌کند اولین فریم واقعی
		//    اپ روی صفحه نقاشی شده باشد و کاربر بین splash و UI، فلش سیاه نبیند.
		requestAnimationFrame(() => {
			requestAnimationFrame(() => hideSplash());
		});
	} catch (e) {
		console.error('Startup Error:', e);
		// P0-F1: Use DOM API instead of innerHTML to prevent XSS from error messages
		const errorContainer = document.createElement('div');
		errorContainer.style.cssText =
			'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0f1014;color:white;font-family:sans-serif;text-align:center;padding:20px;';

		// Localized boot-error copy, loaded straight from the dictionary files
		// (the full i18n chain / Telegram SDK is not available in this crash path).
		let be = { title: 'Failed to initialize', unknownError: 'Unknown error', reload: 'Reload' };
		try {
			const loc = (navigator.language || 'en').slice(0, 2).toLowerCase();
			const pick = ['fa', 'ru', 'zh'].includes(loc) ? loc : 'en';
			const mod = await import(`./shared/i18n/${pick}.js`);
			if (mod?.dict?.bootError) be = mod.dict.bootError;
		} catch (_e) {}

		const title = document.createElement('h1');
		title.style.fontSize = '20px';
		title.textContent = be.title;

		const msg = document.createElement('p');
		msg.style.cssText = 'color:#a0a4ad;font-size:14px;';
		msg.textContent = e instanceof Error ? e.message : be.unknownError;

		const btn = document.createElement('button');
		btn.textContent = be.reload;
		btn.onclick = () => location.reload();
		btn.style.cssText =
			'margin-top:20px;padding:10px 20px;background:#0088CC;border:none;border-radius:20px;color:white;cursor:pointer;';

		errorContainer.append(title, msg, btn);
		root.replaceChildren(errorContainer);
		hideSplash(true); // فوری، چون کاربر باید پیام خطا و دکمه Reload را ببیند
	}
}

startApp();

// Register Service Worker for offline support and immediate refresh updates in production
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
	window.addEventListener('load', () => {
		navigator.serviceWorker
			.register('/sw.js')
			.then((registration) => {
				console.info('[SW] ServiceWorker registered with scope:', registration.scope);

				// Listen for updates
				registration.addEventListener('updatefound', () => {
					const newWorker = registration.installing;
					if (newWorker) {
						newWorker.addEventListener('statechange', () => {
							if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
								console.info('[SW] New version detected, notifying worker to skip waiting...');
								newWorker.postMessage({ type: 'SKIP_WAITING' });
							}
						});
					}
				});
			})
			.catch((err) => {
				console.error('[SW] Registration failed:', err);
			});
	});

	let refreshing = false;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (!refreshing) {
			refreshing = true;
			window.location.reload();
		}
	});
}
