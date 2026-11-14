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
							<div class="frag-canvas flex flex-col items-center justify-center min-h-screen p-6 text-center">
								<div class="w-14 h-14 rounded-[14px] bg-[#ff5c6c]/12 border border-[#ff5c6c]/25 flex items-center justify-center mb-4">
									<span class="material-symbols-outlined text-[#ff5c6c] text-[28px]">error</span>
								</div>
								<h2 class="text-[17px] font-semibold text-white mb-1.5">{t('error.title')}</h2>
								<p class="text-[13px] text-[#8c9ba5] mb-6 max-w-xs leading-relaxed">
									{err instanceof Error ? err.message : String(err)}
								</p>
								<button
									type="button"
									onClick={reset}
									class="px-5 py-2.5 frag-btn-primary font-semibold text-[13px] rounded-[10px]"
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
