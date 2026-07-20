import { A, useLocation } from '@solidjs/router';
import { initData } from '@tma.js/sdk-solid';
import { Component, createEffect, createSignal, Show, onCleanup } from 'solid-js';
import { API_CONFIG } from '@/shared/api/config.js';
import { t } from '@/shared/i18n/index.js';
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
			aria-label="منوی اصلی برنامه‌"
			class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 flex items-center justify-between gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
			dir="ltr"
		>
			<div
				class="flex-1 backdrop-blur-xl rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center justify-around px-3 py-1.5 border h-16 transition-colors bg-[#0F1117]/90 border-white/10"
				dir="ltr"
			>
				<A
					href="/"
					class={`h-12 w-12 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all ${
						isActive('/') ? 'bg-[#3390ec]/20 text-[#3390ec] scale-105' : 'text-white/60 hover:text-white hover:bg-white/5'
					}`}
				>
					<span
						class="material-symbols-outlined text-xl"
						style={{ 'font-variation-settings': isActive('/') ? '"FILL" 1' : '"FILL" 0' }}
					>
						home
					</span>
					<span class="text-[10px] font-black tracking-tight mt-0.5">{t('bottomNav.home') || 'خانه'}</span>
				</A>

				<A
					href="/dashboard"
					class={`h-12 w-12 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all ${
						isActive('/dashboard') ? 'bg-[#3390ec]/20 text-[#3390ec] scale-105' : 'text-white/60 hover:text-white hover:bg-white/5'
					}`}
				>
					<span
						class="material-symbols-outlined text-xl"
						style={{ 'font-variation-settings': isActive('/dashboard') ? '"FILL" 1' : '"FILL" 0' }}
					>
						dashboard
					</span>
					<span class="text-[10px] font-bold tracking-tight mt-0.5">{t('bottomNav.dashboard') || 'مدیریت'}</span>
				</A>

				<A
					href="/airdrop"
					class={`h-12 w-12 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all ${
						isActive('/airdrop') ? 'bg-[#f59e0b]/20 text-[#f59e0b] scale-105' : 'text-white/60 hover:text-white hover:bg-white/5'
					}`}
				>
					<span
						class="material-symbols-outlined text-xl"
						style={{ 'font-variation-settings': isActive('/airdrop') ? '"FILL" 1' : '"FILL" 0' }}
					>
						card_giftcard
					</span>
					<span class="text-[10px] font-bold tracking-tight mt-0.5">{t('bottomNav.airdrop') || 'ایردراپ'}</span>
				</A>
			</div>

			{/* Profile Link with explicit Accessible label */}
			<A
				href="/profile"
				aria-label="پروفایل کاربری"
				class={`flex flex-col items-center cursor-pointer transition-all ${isActive('/profile') ? 'scale-105' : 'hover:scale-102'}`}
			>
				<div
					class={`w-16 h-16 rounded-full backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] border-[2.5px] flex items-center justify-center overflow-hidden transition-all bg-[#0F1117]/90 ${
						isActive('/profile') ? 'border-[#3390ec] shadow-[#3390ec]/20' : 'border-white/10'
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
							alt={user()?.first_name ? `تصویر پروفایل ${user()?.first_name}` : 'تصویر پروفایل کاربر'}
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
