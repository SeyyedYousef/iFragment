import * as Sentry from '@sentry/browser';
import { HashRouter, Navigate, Route, useLocation, useNavigate } from '@solidjs/router';
import { retrieveLaunchParams } from '@tma.js/sdk-solid';
import { createEffect, ErrorBoundary, For, Show } from 'solid-js';
import { routes } from '@/app/router/routes.js';
import { t } from '@/shared/i18n/index.js';
import { PageTransition } from '@/shared/ui/index.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';
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
			<PageTransition>
				<props.component {...props} />
			</PageTransition>
		</ErrorBoundary>
	);
};

const DeepLinkHandler = () => {
	let navigate: ReturnType<typeof useNavigate> | null = null;
	try {
		navigate = useNavigate();
	} catch {
		navigate = null;
	}
	let deepLinkHandled = false;

	const safeNavigate = (to: string) => {
		if (navigate) {
			navigate(to, { replace: true });
		} else if (typeof window !== 'undefined') {
			window.location.hash = `#${to.startsWith('/') ? to : `/${to}`}`;
		}
	};

	createEffect(() => {
		if (deepLinkHandled) return;
		try {
			let startParam = '';
			try {
				const launchParams = retrieveLaunchParams();
				startParam = launchParams.tgWebAppStartParam || '';
			} catch {}

			if (!startParam && typeof window !== 'undefined') {
				const urlParams = new URLSearchParams(window.location.search);
				startParam = urlParams.get('tgWebAppStartParam') || urlParams.get('startapp') || '';
				if (!startParam && window.location.hash.includes('?')) {
					const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
					startParam = hashParams.get('tgWebAppStartParam') || hashParams.get('startapp') || '';
				}
			}

			if (startParam) {
				deepLinkHandled = true;
				if (startParam === 'collection_usernames') {
					safeNavigate('/collection-info');
				} else if (startParam === 'usernames') {
					safeNavigate('/');
				} else if (startParam === 'collection_numbers') {
					safeNavigate('/numbers/collection');
				} else if (startParam === 'numbers') {
					safeNavigate('/numbers');
				} else if (startParam === 'gifts' || startParam === 'collection_gifts') {
					safeNavigate('/gifts');
				} else if (startParam === 'leaderboard') {
					safeNavigate('/leaderboard');
				} else if (startParam === 'investors') {
					safeNavigate('/investors');
				} else if (startParam.startsWith('gift_')) {
					const giftId = startParam.substring(5);
					if (giftId) safeNavigate(`/gifts/report?g=${encodeURIComponent(giftId)}`);
				} else if (startParam.startsWith('g_')) {
					const giftId = startParam.substring(2);
					if (giftId) safeNavigate(`/gifts/report?g=${encodeURIComponent(giftId)}`);
				} else if (startParam.startsWith('num_')) {
					const num = startParam.substring(4);
					if (num) safeNavigate(`/numbers/report?n=${encodeURIComponent(num)}`);
				} else if (startParam.startsWith('number_')) {
					const num = startParam.substring(7);
					if (num) safeNavigate(`/numbers/report?n=${encodeURIComponent(num)}`);
				} else if (startParam.startsWith('col_')) {
					const col = startParam.substring(4);
					if (col) safeNavigate(`/gifts/collection?c=${encodeURIComponent(col)}`);
				} else if (startParam.startsWith('collection_')) {
					const col = startParam.substring(11);
					if (col) safeNavigate(`/gifts/collection?c=${encodeURIComponent(col)}`);
				} else if (startParam.startsWith('username_')) {
					const username = startParam.substring(9);
					if (username) safeNavigate(`/username/report?u=${encodeURIComponent(username)}`);
				} else if (startParam.startsWith('val_')) {
					const username = startParam.substring(4);
					if (username) safeNavigate(`/username/report?u=${encodeURIComponent(username)}`);
				} else if (startParam.startsWith('clan_')) {
					safeNavigate('/leaderboard');
				} else if (startParam.startsWith('ach_')) {
					safeNavigate('/profile/achievements');
				}
			}
		} catch (e) {
			console.warn('[DeepLink] Failed to parse parameters or redirect:', e);
		}
	});

	return null;
};

const INLINE_BOTTOM_NAV_PATHS = new Set([
	'/',
	'/investors',
	'/dashboard',
	'/leaderboard',
	'/profile/leaderboard',
	'/profile',
	'/collection-info',
]);

const AppLayout = (props: { location?: { pathname: string }; children?: any }) => {
	let hookLocation: ReturnType<typeof useLocation> | null = null;
	if (!props.location) {
		try {
			hookLocation = useLocation();
		} catch {
			hookLocation = null;
		}
	}

	const showGlobalBottomNav = () => {
		const rawPath =
			props.location?.pathname ||
			hookLocation?.pathname ||
			(typeof window !== 'undefined'
				? window.location.hash.replace(/^#/, '').split('?')[0] || '/'
				: '/');
		const path = rawPath.replace(/\/+$/, '') || '/';
		return !INLINE_BOTTOM_NAV_PATHS.has(path);
	};

	return (
		<>
			<DeepLinkHandler />
			{props.children}
			<Show when={showGlobalBottomNav()}>
				<BottomNav />
			</Show>
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
