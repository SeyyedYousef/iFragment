import * as Sentry from '@sentry/browser';
import { HashRouter, Navigate, Route, useNavigate } from '@solidjs/router';
import { retrieveLaunchParams } from '@tma.js/sdk-solid';
import { createEffect, ErrorBoundary, For } from 'solid-js';
import { routes } from '@/app/router/routes.js';
import { t } from '@/shared/i18n/index.js';
import { PageTransition } from '@/shared/ui/index.js';
import { DemoBanner } from '@/widgets/demo-banner/index.js';
import { ImpersonationBanner } from '@/widgets/owner/index.js';

const PageErrorFallback = (err: any, reset: () => void) => {
	Sentry.captureException(err);
	const isChunkError =
		err?.message?.includes('dynamically imported module') ||
		err?.message?.includes('Failed to fetch') ||
		err?.message?.includes('Loading chunk');

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
				type="button"
				onClick={() => {
					if (isChunkError) {
						window.location.reload();
					} else {
						reset();
					}
				}}
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
			<ImpersonationBanner />
			<DemoBanner />
			<PageTransition>
				<props.component {...props} />
			</PageTransition>
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
				} else if (startParam.startsWith('val_')) {
					const username = startParam.substring(4);
					if (username) {
						navigate(`/username/report?u=${username}`, { replace: true });
					}
				} else if (startParam.startsWith('clan_')) {
					const clanName = startParam.substring(5);
					if (clanName) {
						sessionStorage.setItem('pending_clan_join', clanName);
						navigate('/airdrop', { replace: true });
					}
				} else if (startParam.startsWith('ach_')) {
					navigate('/profile/achievements', { replace: true });
				}
			}
		} catch (e) {
			console.warn('[DeepLink] Failed to parse parameters or redirect:', e);
		}
	});

	return null;
};

const AppLayout = (props: { children?: any }) => {
	return (
		<>
			<DeepLinkHandler />
			{props.children}
		</>
	);
};

export function App() {
	return (
		<HashRouter root={AppLayout}>
			<For each={routes}>
				{(route) => (
					<Route
						path={route.path}
						component={(props) => <RouteWrapper component={route.Component} {...props} />}
					/>
				)}
			</For>
			<Route path="*" component={() => <Navigate href="/" />} />
		</HashRouter>
	);
}
