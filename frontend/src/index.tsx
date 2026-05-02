/* @refresh reload */
import { render } from 'solid-js/web';
import { retrieveLaunchParams } from '@tma.js/sdk-solid';

import { Root } from '@/app/Root.js';
import { init } from '@/app/init.js';

import './app/styles/index.css';

// Mock the environment in case, we are outside Telegram.
import './app/mockEnv.js';

try {
  const launchParams = retrieveLaunchParams();
  const { tgWebAppPlatform: platform } = launchParams;
  
  // Robust debug mode: check start param, local storage, or dev env
  const debug = (launchParams.tgWebAppStartParam || '').includes('debug')
    || localStorage.getItem('debug') === 'true'
    || import.meta.env.DEV;

  if (debug) {
    import('eruda').then((lib) => lib.default.init());
  }

  // Configure all application dependencies.
  await init({
    debug,
    eruda: debug, // Enable eruda for all platforms in debug mode
    mockForMacOS: platform === 'macos',
  });

  const root = document.getElementById('root');
  if (!(root instanceof HTMLElement)) {
    throw new Error('Root element not found');
  }

  render(() => (<Root />), root);

} catch (e) {
  console.error('Initialization error:', e);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f1014; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h1 style="font-size: 20px; margin-bottom: 10px;">Failed to initialize</h1>
        <p style="color: #8e8e93; font-size: 14px; max-width: 300px;">${e instanceof Error ? e.message : 'Unknown error occurred during startup.'}</p>
        <button onclick="location.reload()" style="margin-top: 24px; padding: 10px 24px; background: #0088CC; border: none; border-radius: 20px; color: white; font-weight: bold; cursor: pointer;">Try Again</button>
      </div>
    `;
  }
}


