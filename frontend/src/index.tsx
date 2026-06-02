/* @refresh reload */
import { render } from 'solid-js/web';
import { retrieveLaunchParams, isTMA, mockTelegramEnv } from '@tma.js/sdk-solid';

import { Root } from '@/app/Root.js';
import { init } from '@/app/init.js';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary.js';
import * as Sentry from '@sentry/browser';

import './app/styles/index.css';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
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
    // 1. Check environment and mock if necessary BEFORE anything else
    const isTelegram = await isTMA();
    
    if (!isTelegram && import.meta.env.DEV) {
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
      console.info('TMA Mock Environment active');
    }

    // 2. Now it's safe to retrieve params
    const launchParams = retrieveLaunchParams();
    const debug = (launchParams.tgWebAppStartParam || '').includes('debug')
      || localStorage.getItem('debug') === 'true'
      || import.meta.env.DEV;

    if (debug) {
      try {
        const eruda = await import('eruda');
        eruda.default.init();
      } catch (e) {
        console.warn('Failed to load Eruda', e);
      }
    }

    // 3. Initialize App logic
    await init({
      debug,
      eruda: false,
      mockForMacOS: launchParams.tgWebAppPlatform === 'macos',
    });

    // 4. Final Render
    render(() => (
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    ), root);

  } catch (e) {
    console.error('Startup Error:', e);
    // P0-F1: Use DOM API instead of innerHTML to prevent XSS from error messages
    const errorContainer = document.createElement('div');
    errorContainer.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0f1014;color:white;font-family:sans-serif;text-align:center;padding:20px;';
    
    const title = document.createElement('h1');
    title.style.fontSize = '20px';
    title.textContent = 'Failed to initialize';
    
    const msg = document.createElement('p');
    msg.style.cssText = 'color:#a0a4ad;font-size:14px;';
    msg.textContent = e instanceof Error ? e.message : 'Unknown error';
    
    const btn = document.createElement('button');
    btn.textContent = 'Reload';
    btn.onclick = () => location.reload();
    btn.style.cssText = 'margin-top:20px;padding:10px 20px;background:#0088CC;border:none;border-radius:20px;color:white;cursor:pointer;';
    
    errorContainer.append(title, msg, btn);
    root.appendChild(errorContainer);
  }
}

startApp();

// Register Service Worker for offline support and immediate refresh updates in production
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
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
    }).catch((err) => {
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

