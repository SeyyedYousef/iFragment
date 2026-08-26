import * as Sentry from '@sentry/browser';
import { type Component, type JSX, ErrorBoundary as SolidErrorBoundary } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

interface Props {
	children: JSX.Element;
}

export const ErrorBoundary: Component<Props> = (props) => {
	return (
		<SolidErrorBoundary
			fallback={(err, reset) => {
				// Send error to Sentry
				Sentry.captureException(err);

				return (
					<div class="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
						<h1 class="text-2xl font-bold mb-4">{t('error.title')}</h1>
						<p class="text-red-400 mb-6">{err.toString()}</p>
						<button
							type="button"
							onClick={reset}
							class="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
						>
							{t('error.tryAgain')}
						</button>
					</div>
				);
			}}
		>
			{props.children}
		</SolidErrorBoundary>
	);
};
