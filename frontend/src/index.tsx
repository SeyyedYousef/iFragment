/* @refresh reload */

import * as Sentry from '@sentry/browser';
import { isTMA, mockTelegramEnv, retrieveLaunchParams } from '@tma.js/sdk-solid';
import { render } from 'solid-js/web';
import { init } from '@/app/init.js';
import { Root } from '@/app/Root.js';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary.js';

import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/vazirmatn/800.css';
import '@fontsource/vazirmatn/900.css';
import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-sans-sc/700.css';
import '@fontsource/noto-sans-sc/900.css';
import 'material-symbols';
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

async function startApp() {
	const root = document.getElementById('root');
	if (!root) return;

	// Prevent iOS Safari native pinch-to-zoom gesture
	document.addEventListener('gesturestart', (e) => {
		e.preventDefault();
	});

	try {
		// 1. Check if we already have real launch params (e.g. from URL or Session Storage)
		let realParams;
		try {
			realParams = retrieveLaunchParams();
		} catch (_e) {
			// ignore
		}

		// 2. Check environment and mock if necessary BEFORE anything else
		const isTelegram = await isTMA();

		if (!isTelegram && !realParams) {
			if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
				mockTelegramEnv({
					launchParams: {
						themeParams: {
							accentTextColor: '#6ab2f2',
							bgColor: '#17212b',
							buttonColor: '#5288c1',
							buttonTextColor: '#ffffff',
							destructiveTextColor: '#ec3942',
							headerBgColor: '#17212b',
							hintColor: '#708499',
							linkColor: '#6ab3f3',
							secondaryBgColor: '#232e3c',
							sectionBgColor: '#17212b',
							sectionHeaderTextColor: '#6ab3f3',
							subtitleTextColor: '#708499',
							textColor: '#f5f5f5',
						},
						initData: {
							user: {
								id: 99281932,
								firstName: 'Andrew',
								lastName: 'Rogue',
								username: 'rogue',
								languageCode: 'en',
								isPremium: true,
								allowsWriteToPm: true,
							},
							hash: '89d6079ad6762351f38c6dbbc41bb53048019256a9443988af7a48bcad16ba31',
							signature: '5O_G2H_wXgI32v2G-w0y-W_O3G_4G',
							authDate: new Date(1716922846000),
							canSendAfter: 10000,
							queryId: 'AAHdF60pAAAAANYXrSkW1',
						},
						initDataRaw: new URLSearchParams([
							[
								'user',
								JSON.stringify({
									id: 99281932,
									first_name: 'Andrew',
									last_name: 'Rogue',
									username: 'rogue',
									language_code: 'en',
									is_premium: true,
									allows_write_to_pm: true,
								}),
							],
							['hash', '89d6079ad6762351f38c6dbbc41bb53048019256a9443988af7a48bcad16ba31'],
							['signature', '5O_G2H_wXgI32v2G-w0y-W_O3G_4G'],
							['auth_date', '1716922846'],
							['query_id', 'AAHdF60pAAAAANYXrSkW1'],
						]).toString(),
						version: '7.2',
						platform: 'tdesktop',
					} as any,
				});
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
			(launchParams.tgWebAppStartParam || '').includes('debug') ||
			localStorage.getItem('debug') === 'true' ||
			import.meta.env.DEV;

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

		// 4.5. Proactively obtain JWT before any API calls to avoid 401→refresh loops
		const { bootstrapAuth } = await import('@/shared/api/axios.js');
		await bootstrapAuth();

		// 5. Final Render
		render(
			() => (
				<ErrorBoundary>
					<Root />
				</ErrorBoundary>
			),
			root,
		);
	} catch (e) {
		console.error('Startup Error:', e);
		// P0-F1: Use DOM API instead of innerHTML to prevent XSS from error messages
		const errorContainer = document.createElement('div');
		errorContainer.style.cssText =
			'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0f1014;color:white;font-family:sans-serif;text-align:center;padding:20px;';

		const title = document.createElement('h1');
		title.style.fontSize = '20px';
		title.textContent = 'Failed to initialize';

		const msg = document.createElement('p');
		msg.style.cssText = 'color:#a0a4ad;font-size:14px;';
		msg.textContent = e instanceof Error ? e.message : 'Unknown error';

		const btn = document.createElement('button');
		btn.textContent = 'Reload';
		btn.onclick = () => location.reload();
		btn.style.cssText =
			'margin-top:20px;padding:10px 20px;background:#0088CC;border:none;border-radius:20px;color:white;cursor:pointer;';

		errorContainer.append(title, msg, btn);
		root.replaceChildren(errorContainer);
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
