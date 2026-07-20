import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const ImpersonationBanner: Component = () => {
	const [impersonatedUser, setImpersonatedUser] = createSignal<string | null>(null);
	const [remainingSeconds, setRemainingSeconds] = createSignal(0);

	const safeParseJwtExpiry = (token: string): number | null => {
		try {
			const parts = token.split('.');
			if (parts.length < 2) return null;
			let base64Url = parts[1];
			let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
			while (base64.length % 4) {
				base64 += '=';
			}
			const jsonPayload = decodeURIComponent(
				atob(base64)
					.split('')
					.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
					.join('')
			);
			const parsed = JSON.parse(jsonPayload);
			return parsed.exp ? parsed.exp * 1000 : null;
		} catch (_e) {
			return null;
		}
	};

	createEffect(() => {
		const activeSessionUser = sessionStorage.getItem('impersonated_username');
		const token = sessionStorage.getItem('owner_impersonation_token');
		if (activeSessionUser && token) {
			setImpersonatedUser(activeSessionUser);
			const expiresAt = safeParseJwtExpiry(token);
			if (expiresAt) {
				const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
				setRemainingSeconds(remaining);
			} else {
				setRemainingSeconds(900); // 15 min fallback
			}
		} else {
			setImpersonatedUser(null);
		}
	});

	const timer = setInterval(() => {
		if (remainingSeconds() > 0) {
			setRemainingSeconds((prev) => prev - 1);
		}
		if (remainingSeconds() <= 0 && impersonatedUser()) {
			handleExitSimulation();
		}
	}, 1000);

	onCleanup(() => clearInterval(timer));

	const formatTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	const handleExitSimulation = () => {
		try {
			hapticFeedback.notificationOccurred('warning');
		} catch {}

		sessionStorage.removeItem('owner_impersonation_token');
		sessionStorage.removeItem('impersonated_user_id');
		sessionStorage.removeItem('impersonated_username');

		localStorage.removeItem('cached_profile_stats');
		localStorage.removeItem('cached_profile_achievements');
		localStorage.removeItem('cached_profile_referral');

		setImpersonatedUser(null);

		window.location.href = window.location.pathname + '#/owner/users';
		window.location.reload();
	};

	return (
		<Show when={impersonatedUser()}>
			<div
				class={`sticky top-0 inset-x-0 z-[10000] h-11 backdrop-blur-md border-b px-4 flex items-center justify-between text-xs text-white font-bold shadow-lg animate-slide-down select-none ${
					remainingSeconds() <= 120 ? 'bg-orange-600/90 border-orange-500/20' : 'bg-red-600/90 border-red-500/20'
				}`}
			>
				<div class="flex items-center gap-2">
					<span class="inline-block w-2.5 h-2.5 rounded-full bg-white animate-ping" />
					<span>
						{(t('profile.impersonationBanner') || 'حالت شبیه‌سازی خواندنی: کاربر {username}').replace(
							'{username}',
							impersonatedUser() || ''
						)}
					</span>
					<span
						class={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
							remainingSeconds() <= 120 ? 'bg-white/30 text-white' : 'bg-white/20 text-white/90'
						}`}
					>
						{formatTime(remainingSeconds())}
					</span>
				</div>
				<button
					onClick={handleExitSimulation}
					class="h-7 px-3 bg-white text-red-600 active:scale-95 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow shadow-black/20"
				>
					{t('profile.exitSimulation') || 'خروج از شبیه‌سازی'}
				</button>
			</div>
		</Show>
	);
};
