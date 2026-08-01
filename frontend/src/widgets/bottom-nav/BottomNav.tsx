import { A, useLocation } from '@solidjs/router';
import { initData } from '@tma.js/sdk-solid';
import { Component, createEffect, createSignal, Show } from 'solid-js';
import { API_CONFIG } from '@/shared/api/config.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { profilePhotoUrl } from '@/shared/store/profile.js';

export const BottomNav: Component = () => {
	const location = useLocation();
	const user = () => initData.user() as any;
	const [imgError, setImgError] = createSignal(false);

	const avatarUrl = () => {
		const statsPhoto = profilePhotoUrl();
		if (statsPhoto) {
			if (statsPhoto.startsWith('http')) return statsPhoto;
			const base = API_CONFIG.BASE_URL.replace(/\/api\/v1\/?$/, '');
			const cleanPath = statsPhoto.startsWith('/') ? statsPhoto : `/${statsPhoto}`;
			return `${base}${cleanPath}`;
		}
		const u = user();
		if (u?.photoUrl || u?.photo_url) return u.photoUrl || u.photo_url;
		return undefined;
	};

	createEffect(() => {
		avatarUrl();
		setImgError(false);
	});

	const isActive = (path: string) => {
		if (path === '/') return location.pathname === '/';
		return location.pathname === path || location.pathname.startsWith(`${path}/`);
	};

	return (
		<nav
			aria-label={t('bottomNav.profile')}
			class="fixed left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-[99] flex items-center justify-between gap-2.5 pointer-events-auto"
			style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
			dir="ltr"
		>
			<div
				class="flex-1 backdrop-blur-2xl rounded-[28px] shadow-[0_16px_50px_rgba(0,0,0,0.85)] flex items-center justify-between px-2 py-1.5 border h-16 transition-all bg-[#0D0F17]/95 border-white/15 hover:border-white/25"
				dir="ltr"
			>
				<A
					href="/"
					onClick={() => haptic.selection()}
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
				</A>

				<A
					href="/dashboard"
					onClick={() => haptic.selection()}
					class={`flex-1 h-13 rounded-[20px] flex flex-col items-center justify-center cursor-pointer transition-all min-w-0 px-1 ${
						isActive('/dashboard')
							? 'bg-[#3390ec]/20 text-[#3390ec] border border-[#3390ec]/35 shadow-sm scale-102'
							: 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
					}`}
				>
					<span
						class="material-symbols-outlined text-[22px]"
						style={{ 'font-variation-settings': isActive('/dashboard') ? '"FILL" 1' : '"FILL" 0' }}
					>
						dashboard
					</span>
					<span class="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full text-center px-0.5 leading-tight">
						{t('bottomNav.dashboard')}
					</span>
				</A>

				<A
					href="/airdrop"
					onClick={() => haptic.selection()}
					class={`flex-1 h-13 rounded-[20px] flex flex-col items-center justify-center cursor-pointer transition-all min-w-0 px-1 ${
						isActive('/airdrop')
							? 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/35 shadow-sm scale-102'
							: 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
					}`}
				>
					<span
						class="material-symbols-outlined text-[22px]"
						style={{ 'font-variation-settings': isActive('/airdrop') ? '"FILL" 1' : '"FILL" 0' }}
					>
						card_giftcard
					</span>
					<span class="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full text-center px-0.5 leading-tight">
						{t('bottomNav.airdrop')}
					</span>
				</A>
			</div>

			{/* Profile Link */}
			<A
				href="/profile"
				onClick={() => haptic.selection()}
				aria-label={t('bottomNav.profile')}
				class={`flex flex-col items-center cursor-pointer transition-all shrink-0 ${isActive('/profile') ? 'scale-105' : 'hover:scale-102'}`}
			>
				<div
					class={`w-16 h-16 rounded-[28px] backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.85)] border-[2.5px] flex items-center justify-center overflow-hidden transition-all bg-[#0D0F17]/95 ${
						isActive('/profile') ? 'border-[#3390ec] shadow-[#3390ec]/40 ring-2 ring-[#3390ec]/20' : 'border-white/15'
					}`}
				>
					<Show
						when={avatarUrl() && !imgError()}
						fallback={
							<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#3390ec] to-[#10b981] text-white font-black text-lg">
								{user()?.first_name ? user()?.first_name?.[0]?.toUpperCase() : 'U'}
							</div>
						}
					>
						<img
							alt="Profile"
							class="w-full h-full object-cover"
							src={avatarUrl()!}
							loading="lazy"
							referrerPolicy="no-referrer"
							onError={() => setImgError(true)}
						/>
					</Show>
				</div>
			</A>
		</nav>
	);
};
