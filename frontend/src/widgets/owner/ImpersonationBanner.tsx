import { type Component, createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export const ImpersonationBanner: Component = () => {
	const [impersonatedUser, setImpersonatedUser] = createSignal<string | null>(null);
	const [remainingSeconds, setRemainingSeconds] = createSignal(0);

	const safeParseJwtExpiry = (token: string): number | null => {
		try {
			const parts = token.split('.');
			if (parts.length < 2) return null;
			const base64Url = parts[1];
			let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
			while (base64.length % 4) {
				base64 += '=';
			}
			const jsonPayload = decodeURIComponent(
				atob(base64)
					.split('')
					.map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
					.join(''),
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
			haptic.notify('warning');
		} catch {}

		sessionStorage.removeItem('owner_impersonation_token');
		sessionStorage.removeItem('impersonated_user_id');
		sessionStorage.removeItem('impersonated_username');
		sessionStorage.removeItem('impersonated_first_name');
		sessionStorage.removeItem('impersonated_last_name');

		localStorage.removeItem('cached_profile_stats');
		localStorage.removeItem('cached_profile_achievements');
		localStorage.removeItem('cached_profile_referral');

		setImpersonatedUser(null);

		window.location.href = `${window.location.pathname}#/owner/users`;
		window.location.reload();
	};

	const navigateTo = (path: string) => {
		try {
			haptic.impact('light');
		} catch {}
		window.location.href = `${window.location.pathname}#${path}`;
	};

	return (
		<Show when={impersonatedUser()}>
			<div
				class={`sticky top-0 inset-x-0 z-[10000] backdrop-blur-md border-b px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-white font-bold shadow-lg animate-slide-down select-none ${
					remainingSeconds() <= 120
						? 'bg-orange-600/95 border-orange-500/30'
						: 'bg-red-600/95 border-red-500/30'
				}`}
			>
				<div class="flex items-center gap-2 flex-wrap">
					<span class="inline-block w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
					<span class="truncate max-w-[220px]">
						{(
							t('impersonation.banner' as any, { username: impersonatedUser() || '' }) ||
							t('profile.impersonationBanner') ||
							'Support Session Active: {username}'
						).replace('{username}', impersonatedUser() || '')}
					</span>
					<span
						class={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
							remainingSeconds() <= 120 ? 'bg-white/30 text-white' : 'bg-white/20 text-white/90'
						}`}
					>
						{formatTime(remainingSeconds())}
					</span>
				</div>

				<div class="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => navigateTo('/managed-channels')}
						class="h-7 px-2.5 bg-white/15 hover:bg-white/25 active:scale-95 text-[11px] font-bold rounded-lg transition-all border border-white/20"
					>
						{t('bottomNav.channels') || 'Channels'}
					</button>
					<button
						type="button"
						onClick={() => navigateTo('/managed-bots')}
						class="h-7 px-2.5 bg-white/15 hover:bg-white/25 active:scale-95 text-[11px] font-bold rounded-lg transition-all border border-white/20"
					>
						{t('bottomNav.groups') || 'Groups'}
					</button>
					<button
						type="button"
						onClick={() => navigateTo('/profile')}
						class="h-7 px-2.5 bg-white/15 hover:bg-white/25 active:scale-95 text-[11px] font-bold rounded-lg transition-all border border-white/20"
					>
						{t('bottomNav.profile') || 'Profile'}
					</button>
					<button
						type="button"
						onClick={handleExitSimulation}
						class="h-7 px-3 bg-white text-red-600 active:scale-95 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow shadow-black/20"
					>
						{t('impersonation.exit' as any) || t('profile.exitSimulation') || 'Exit'}
					</button>
				</div>
			</div>
		</Show>
	);
};
