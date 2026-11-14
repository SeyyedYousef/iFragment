import { useLocation, useNavigate } from '@solidjs/router';
import { initData } from '@tma.js/sdk-solid';
import {
	type Component,
	createEffect,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
} from 'solid-js';
import { profilePhotoUrl } from '@/entities/user/index.js';
import { buildAvatarUrl } from '@/shared/api/config.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface NavTab {
	readonly href: string;
	readonly icon: string;
	readonly labelKey: string;
}

const NAV_TABS: readonly NavTab[] = [
	{ href: '/', icon: 'home', labelKey: 'bottomNav.home' },
	{ href: '/investors', icon: 'handshake', labelKey: 'bottomNav.dashboard' },
	{ href: '/leaderboard', icon: 'leaderboard', labelKey: 'bottomNav.leaderboard' },
];

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
		try {
			haptic.selection();
		} catch {}
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
		if (imgError()) {
			if (!fallbackAttempted()) {
				const fallback = directTgPhoto();
				if (fallback && fallback !== primaryAvatarUrl()) return fallback;
			}
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
		let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
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
				(target as unknown) !== document &&
				(target as unknown) !== document.documentElement
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
			} else if (diff > 14) {
				setNavVisible(false);
			} else if (diff < -8) {
				setNavVisible(true);
			}

			lastScrollY = currentScrollY;

			if (scrollTimeout) clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(() => {
				setNavVisible(true);
			}, 1100);
		};

		window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

		onCleanup(() => {
			window.removeEventListener('scroll', handleScroll, { capture: true });
			window.removeEventListener('hashchange', onHashChange);
			if (scrollTimeout) clearTimeout(scrollTimeout);
		});
	});

	const isActive = (path: string) => {
		const p = currentPath();
		if (path === '/') return p === '/';
		if (path === '/investors')
			return (
				p === '/investors' ||
				p === '/dashboard' ||
				p.startsWith('/investors/') ||
				p.startsWith('/dashboard/')
			);
		return p === path || p.startsWith(`${path}/`);
	};

	const activeTabIndex = () => NAV_TABS.findIndex((tab) => isActive(tab.href));

	const userInitial = () => {
		const fn = user()?.firstName || user()?.first_name;
		return fn ? String(fn)[0]?.toUpperCase() : 'U';
	};

	return (
		<nav
			aria-label={t('common.mainNavigation')}
			class={`fixed left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[448px] z-[99] font-frag-sans flex items-center gap-2.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
				navVisible()
					? 'translate-y-0 opacity-100 pointer-events-auto'
					: 'translate-y-24 opacity-0 pointer-events-none'
			}`}
			style={{ bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
			dir="ltr"
		>
			{/* Main 3-Tab Liquid Glass Stadium Island */}
			<div
				class="frag-dock flex-1 min-w-0 h-[62px] rounded-full p-[5px] relative overflow-hidden"
				data-testid="bottom-nav-pill"
			>
				{/* Sliding Frosted Liquid Glass Lens */}
				<div aria-hidden="true" class="pointer-events-none absolute inset-[5px] grid grid-cols-3">
					<Show when={activeTabIndex() >= 0}>
						<div
							class="h-full frag-dock-lens rounded-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
							style={{ transform: `translateX(${activeTabIndex() * 100}%)` }}
						/>
					</Show>
				</div>

				{/* Primary 3 Navigation Tabs */}
				<div class="relative z-10 grid grid-cols-3 h-full">
					<For each={NAV_TABS}>
						{(tab) => {
							const active = () => isActive(tab.href);
							return (
								<button
									type="button"
									onClick={(e) => safeGo(tab.href, e)}
									aria-current={active() ? 'page' : undefined}
									class={`h-full rounded-full flex flex-col items-center justify-center gap-[2px] relative min-w-0 px-2 transition-all duration-200 active:scale-[0.95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2990ff]/70 cursor-pointer ${
										active() ? 'text-white' : 'text-[#8b9aa7] hover:text-[#dce6f0]'
									}`}
								>
									<span
										class={`material-symbols-outlined text-[20px] leading-none transition-all duration-200 ${
											active() ? 'text-[#5aaeff] -translate-y-[0.5px]' : ''
										}`}
										style={{
											'font-variation-settings': active()
												? '"FILL" 1, "wght" 500'
												: '"FILL" 0, "wght" 400',
										}}
									>
										{tab.icon}
									</span>
									<span
										class={`text-[10.5px] leading-none tracking-[-0.015em] truncate max-w-full transition-colors duration-200 ${
											active() ? 'font-semibold text-white' : 'font-medium'
										}`}
									>
										{t(tab.labelKey)}
									</span>
								</button>
							);
						}}
					</For>
				</div>
			</div>

			{/* Detached Profile Avatar Liquid Glass Orb */}
			<button
				type="button"
				onClick={(e) => safeGo('/profile', e)}
				aria-label={t('bottomNav.profile')}
				aria-current={isActive('/profile') ? 'page' : undefined}
				data-testid="bottom-nav-profile"
				class={`w-[62px] h-[62px] shrink-0 rounded-full p-[4px] relative flex items-center justify-center transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2990ff]/75 cursor-pointer ${
					isActive('/profile')
						? 'frag-dock-orb-active scale-[1.03]'
						: 'frag-dock-orb hover:scale-[1.03]'
				}`}
			>
				<div
					class={`w-full h-full rounded-full overflow-hidden flex items-center justify-center relative border transition-colors duration-200 ${
						isActive('/profile')
							? 'border-[#5aaeff]/75 bg-[#141d29]'
							: 'border-white/[0.14] bg-[#141a22]'
					}`}
				>
					<Show
						when={avatarUrl()}
						fallback={
							<span class="w-full h-full rounded-full bg-gradient-to-b from-[#3396ff] via-[#2274d4] to-[#133b6e] flex items-center justify-center text-[17px] font-semibold tracking-tight text-white leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
								{userInitial()}
							</span>
						}
					>
						<img
							alt={t('bottomNav.profile')}
							class="w-full h-full object-cover"
							src={avatarUrl()!}
							loading="lazy"
							referrerPolicy="no-referrer"
							onError={() => {
								if (!imgError()) {
									setImgError(true);
								} else {
									setFallbackAttempted(true);
								}
							}}
						/>
					</Show>
				</div>

				<Show when={isActive('/profile')}>
					<span
						aria-hidden="true"
						class="w-3.5 h-3.5 rounded-full bg-[#11161d] p-[2.5px] absolute -bottom-0.5 right-0.5 shadow-[0_2px_6px_rgba(0,0,0,0.65)]"
					>
						<span class="block w-full h-full rounded-full bg-[#2990ff] shadow-[0_0_8px_rgba(41,144,255,0.85)]" />
					</span>
				</Show>
			</button>
		</nav>
	);
};
