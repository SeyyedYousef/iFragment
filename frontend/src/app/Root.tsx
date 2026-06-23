import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { type Component, ErrorBoundary } from 'solid-js';
import { App } from '@/app/App.js';
import { t } from '@/shared/i18n/index.js';
import { ConnectionStatusBanner } from '@/shared/ui/ConnectionStatusBanner.js';
import { ToastContainer } from '@/shared/ui/toast.js';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			suspense: false,
		},
	},
});

import { MetaProvider } from '@solidjs/meta';

export const Root: Component = () => {
	return (
		<QueryClientProvider client={queryClient}>
			<MetaProvider>
				<ErrorBoundary
				fallback={(err, reset) => {
					console.error('Application error:', err);

					return (
						<div class="flex flex-col items-center justify-center min-h-screen bg-[#0f1014] p-6 text-center">
							<div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
								<span class="material-symbols-outlined text-red-500 text-3xl">error</span>
							</div>
							<h2 class="text-lg font-bold text-white mb-2">{t('error.title')}</h2>
							<p class="text-sm text-slate-400 mb-6 max-w-xs">
								{err instanceof Error ? err.message : String(err)}
							</p>
							<button
								onClick={reset}
								class="px-6 py-2.5 bg-[#0088CC] text-white font-semibold text-sm rounded-full shadow-lg hover:brightness-110 active:scale-95 transition-all"
							>
								{t('error.tryAgain')}
							</button>
						</div>
					);
				}}
			>
				<App />
				<ToastContainer />
				<ConnectionStatusBanner />
			</ErrorBoundary>
			</MetaProvider>
		</QueryClientProvider>
	);
};
