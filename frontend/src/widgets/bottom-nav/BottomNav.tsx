import { useLocation, useNavigate } from '@solidjs/router';
import { initData } from '@tma.js/sdk-solid';
import { type Component, createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { profilePhotoUrl } from '@/entities/user/index.js';
import { buildAvatarUrl } from '@/shared/api/config.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export const BottomNav: Component = () => {
	let routerLocation: ReturnType<typeof useLocation> | null = null;
	let routerNavigate: ReturnType<typeof useNavigate> | null = null;
	try {
		routerLocation = useLocation();
		routerNavigate = useNavigate();
	} catch {
		routerLocation = null;
		routerNavigate = null;
	}
	const [hashPath, setHashPath] = createSignal(
		typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') || '/' : '/',
	);
	const currentPath = () => routerLocation?.pathname || hashPath() || '/';
	const safeGo = (href: string, e: MouseEvent) => {
		e.preventDefault();
		haptic.selection();
		if (routerNavigate) {
			routerNavigate(href);
		} else if (typeof window !== 'undefined') {
			window.location.hash = `#${href}`;
		}
	};
	const user = () => initData.user() as any;
	const [imgError, setImgError] = createSignal(false);
	const [navVisible, setNavVisible] = createSignal(true);

	const [fallbackAttempted, setFallbackAttempted] = createSignal(false);

	const directTgPhoto = () => {
		const u = user();
		return (u?.photoUrl || u?.photo_url) as string | undefined;
	};

	const primaryAvatarUrl = () => {
		const u = user();
		const userId = u?.id;
		if (userId) {
			return buildAvatarUrl(`/api/v1/profile/avatar/${userId}`);
		}
		const statsPhoto = profilePhotoUrl();
		if (statsPhoto) return buildAvatarUrl(statsPhoto);
		const direct = directTgPhoto();
		if (direct) return direct;
		return undefined;
	};

	const avatarUrl = () => {
		if (imgError() && !fallbackAttempted()) {
			// Primary URL failed; try direct Telegram CDN as fallback
			const fallback = directTgPhoto();
			if (fallback) return fallback;
		}
		if (imgError() && fallbackAttempted()) {
			// Both primary and fallback failed
			return undefined;
		}
		return primaryAvatarUrl();
	};

	createEffect(() => {
		currentPath();
		profilePhotoUrl();
		user();
		setImgError(false);
		setFallbackAttempted(false);
		setNavVisible(true);
	});

	onMount(() => {
		let lastScrollY = window.scrollY || 0;
		let scrollTimeout: any = null;
		const onHashChange = () => {
			setHashPath(window.location.hash.replace(/^#/, '') || '/');
		};
		window.addEventListener('hashchange', onHashChange);

		const handleScroll = (e?: Event) => {
			const target = e?.target as HTMLElement | Document;
			let currentScrollY = 0;
			let docHeight = document.documentElement.scrollHeight;
			let windowHeight = window.innerHeight;

			if (
				target &&
				'scrollTop' in target &&
				(target as any) !== document &&
				(target as any) !== document.documentElement
			) {
				currentScrollY = (target as HTMLElement).scrollTop;
				docHeight = (target as HTMLElement).scrollHeight;
				windowHeight = (target as HTMLElement).clientHeight;
			} else {
				currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
			}

			const diff = currentScrollY - lastScrollY;
			const isNearBottom = currentScrollY + windowHeight >= docHeight - 40;
			const isNearTop = currentScrollY < 40;

			if (isNearTop || isNearBottom) {
				setNavVisible(true);
			} else if (diff > 12) {
				// Scrolling down
				setNavVisible(false);
			} else if (diff < -8) {
				// Scrolling up
				setNavVisible(true);
			}

			lastScrollY = currentScrollY;

			if (scrollTimeout) clearTimeout(scrollTimeout);
			// Reveal navigation when scrolling stops for 1.2 seconds
			scrollTimeout = setTimeout(() => {
				setNavVisible(true);
			}, 1200);
		};

		window.addEventListener('scroll', handleScroll, { passive: true });

		onCleanup(() => {
			window.removeEventListener('scroll', handleScroll);
			window.removeEventListener('hashchange', onHashChange);
			if (scrollTimeout) clearTimeout(scrollTimeout);
		});
	});

	const isActive = (path: string) => {
		const p = currentPath();
		if (path === '/') return p === '/';
		return p === path || p.startsWith(`${path}/`);
	};

	return (
		<nav
			aria-label={t('bottomNav.profile')}
			class={`fixed left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-[99] flex items-center justify-between gap-2.5 transition-all duration-300 ease-out ${
				navVisible()
					? 'translate-y-0 opacity-100 pointer-events-auto'
					: 'translate-y-28 opacity-0 pointer-events-none'
			}`}
			style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
			dir="ltr"
		>
			<div
				class="flex-1 backdrop-blur-2xl rounded-[28px] shadow-[0_16px_50px_rgba(0,0,0,0.85)] flex items-center justify-between px-2 py-1.5 border h-16 transition-all bg-[#0D0F17]/95 border-white/15 hover:border-white/25"
				dir="ltr"
			>
				<a
					href="#/"
					onClick={(e) => safeGo('/', e)}
					class={`flex-1 h-13 rounded-[20px] flex flex-col items-center justify-center cursor-pointer transition-all min-w-0 px-1 ${
						isActive('/')
							? 'bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/35 shadow-sm scale-102'
							: 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
					}`}
				>
					<span
						class="material-symbols-outlined text-[22px]"
						style={{ 'font-variation-settings': isActive('/') ? '"FILL" 1' : '"FILL" 0' }}
					>
						home
					</span>
					<span class="text-[10px] font-black tracking-tight mt-0.5 truncate max-w-full text-center px-0.5 leading-tight">
						{t('bottomNav.home')}
					</span>
				</a>

				<a
					href="#/investors"
					onClick={(e) => safeGo('/investors', e)}
					class={`flex-1 h-13 rounded-[20px] flex flex-col items-center justify-center cursor-pointer transition-all min-w-0 px-1 ${
						isActive('/investors') || isActive('/dashboard')
							? 'bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/35 shadow-sm scale-102'
							: 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
					}`}
				>
					<span
						class="material-symbols-outlined text-[22px]"
						style={{
							'font-variation-settings':
								isActive('/investors') || isActive('/dashboard') ? '"FILL" 1' : '"FILL" 0',
						}}
					>
						handshake
					</span>
					<span class="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full text-center px-0.5 leading-tight">
						{t('bottomNav.dashboard')}
					</span>
				</a>

				<a
					href="#/leaderboard"
					onClick={(e) => safeGo('/leaderboard', e)}
					class={`flex-1 h-13 rounded-[20px] flex flex-col items-center justify-center cursor-pointer transition-all min-w-0 px-1 ${
						isActive('/leaderboard')
							? 'bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/35 shadow-sm scale-102'
							: 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
					}`}
				>
					<span
						class="material-symbols-outlined text-[22px]"
						style={{
							'font-variation-settings': isActive('/leaderboard') ? '"FILL" 1' : '"FILL" 0',
						}}
					>
						leaderboard
					</span>
					<span class="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full text-center px-0.5 leading-tight">
						{t('bottomNav.leaderboard')}
					</span>
				</a>
			</div>

			{/* Profile Link */}
			<a
				href="#/profile"
				onClick={(e) => safeGo('/profile', e)}
				aria-label={t('bottomNav.profile')}
				class={`flex flex-col items-center cursor-pointer transition-all shrink-0 ${isActive('/profile') ? 'scale-105' : 'hover:scale-102'}`}
			>
				<div
					class={`w-16 h-16 rounded-[28px] backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.85)] border-[2.5px] flex items-center justify-center overflow-hidden transition-all bg-[#0D0F17]/95 ${
						isActive('/profile')
							? 'border-[#3390ec] shadow-[#3390ec]/40 ring-2 ring-[#3390ec]/20'
							: 'border-white/15'
					}`}
				>
					<Show
						when={avatarUrl()}
						fallback={
							<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#3390ec] to-[#10b981] text-white font-black text-lg">
								{user()?.firstName || user()?.first_name
									? (user()?.firstName || user()?.first_name)?.[0]?.toUpperCase()
									: 'U'}
							</div>
						}
					>
						<img
							alt="Profile"
							class="w-full h-full object-cover"
							src={avatarUrl()!}
							loading="lazy"
							referrerPolicy="no-referrer"
							onError={() => {
								if (!imgError()) {
									// First failure: try fallback to direct Telegram CDN
									setImgError(true);
								} else {
									// Fallback also failed: show initial letter
									setFallbackAttempted(true);
								}
							}}
						/>
					</Show>
				</div>
			</a>
		</nav>
	);
};
