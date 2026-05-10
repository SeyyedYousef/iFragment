/* @refresh reload */
import { render } from 'solid-js/web';
import { retrieveLaunchParams, isTMA, mockTelegramEnv } from '@tma.js/sdk-solid';

import { Root } from '@/app/Root.js';
import { init } from '@/app/init.js';

import './app/styles/index.css';

async function startApp() {
  const root = document.getElementById('root');
  if (!root) return;

  try {
    // 1. Check environment and mock if necessary BEFORE anything else
    const isTelegram = await isTMA();
    
    if (!isTelegram && import.meta.env.DEV) {
      mockTelegramEnv({
        launchParams: new URLSearchParams([
          ['tgWebAppData', 'dev-user'],
          ['tgWebAppThemeParams', JSON.stringify({ bg_color: '#0f1014', text_color: '#ffffff' })],
          ['tgWebAppPlatform', 'tdesktop'],
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
    render(() => <Root />, root);

  } catch (e) {
    console.error('Startup Error:', e);
    root.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f1014; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
        <h1 style="font-size: 20px;">Failed to initialize</h1>
        <p style="color: #a0a4ad; font-size: 14px;">${e instanceof Error ? e.message : 'Unknown error'}</p>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #0088CC; border: none; border-radius: 20px; color: white; cursor: pointer;">Reload</button>
      </div>
    `;
  }
}

startApp();
