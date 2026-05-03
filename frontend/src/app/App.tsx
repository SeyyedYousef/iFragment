import { Navigate, Route, HashRouter } from '@solidjs/router';
import { For, Suspense } from 'solid-js';

import { routes } from '@/app/router/routes.js';

export function App() {
  return (
    <HashRouter>
      <Suspense fallback={<div class="min-h-screen bg-[#0f1014] flex items-center justify-center"><div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
        <For each={routes}>
          {(route) => <Route path={route.path} component={route.Component}/>}
        </For>
        <Route path="*" component={() => <Navigate href="/"/>}/>
      </Suspense>
    </HashRouter>
  );
}
