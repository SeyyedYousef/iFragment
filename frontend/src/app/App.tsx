import { Navigate, Route, HashRouter, useNavigate } from '@solidjs/router';
import { For, Suspense, ErrorBoundary, createEffect } from 'solid-js';
import * as Sentry from '@sentry/browser';
import { t } from '@/shared/i18n/index.js';
import { retrieveLaunchParams } from '@tma.js/sdk-solid';

import { routes } from '@/app/router/routes.js';
import { ImpersonationBanner } from '@/widgets/owner/ImpersonationBanner.js';

const PageErrorFallback = (err: any, reset: () => void) => {
  Sentry.captureException(err);
  return (
    <div class="min-h-screen bg-[#0f1014] text-white flex flex-col items-center justify-center p-6 text-center">
      <div class="w-16 h-16 rounded-full bg-[#ff3b30]/10 flex items-center justify-center mb-4 text-[#ff3b30]">
        <span class="material-symbols-outlined text-[32px]">error</span>
      </div>
      <h1 class="text-lg font-black mb-2">{t('error.title')}</h1>
      <p class="text-[13px] text-[#8e8e93] leading-relaxed mb-6 max-w-xs">
        {err?.message || 'An unexpected rendering error occurred.'}
      </p>
      <button 
        onClick={reset}
        class="h-12 px-6 bg-[#3390ec] hover:bg-[#2b7bc9] text-white font-bold rounded-2xl transition-all shadow-[0_4px_15px_rgba(51,144,236,0.25)] active:scale-95 flex items-center justify-center gap-2"
      >
        <span class="material-symbols-outlined text-[18px]">refresh</span>
        {t('error.tryAgain')}
      </button>
    </div>
  );
};

const RouteWrapper = (props: { component: any; [key: string]: any }) => {
  return (
    <ErrorBoundary fallback={(err, reset) => PageErrorFallback(err, reset)}>
      <Suspense fallback={<div class="min-h-screen bg-[#0f1014] flex items-center justify-center"><div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
        <ImpersonationBanner />
        <props.component {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

const DeepLinkHandler = () => {
  const navigate = useNavigate();

  createEffect(() => {
    try {
      const launchParams = retrieveLaunchParams();
      const startParam = launchParams.tgWebAppStartParam;
      if (startParam) {
        if (startParam.startsWith('group_')) {
          const groupId = startParam.substring(6);
          if (groupId) {
            navigate(`/group/${groupId}`, { replace: true });
          }
        } else if (startParam.startsWith('username_')) {
          const username = startParam.substring(9);
          if (username) {
            navigate(`/username/report?u=${username}`, { replace: true });
          }
        }
      }
    } catch (e) {
      console.warn('[DeepLink] Failed to parse parameters or redirect:', e);
    }
  });

  return null;
};

export function App() {
  return (
    <HashRouter>
      <DeepLinkHandler />
      <For each={routes}>
        {(route) => (
          <Route path={route.path} component={(props) => <RouteWrapper component={route.Component} {...props} />} />
        )}
      </For>
      <Route path="*" component={() => <Navigate href="/"/>}/>
    </HashRouter>
  );
}
