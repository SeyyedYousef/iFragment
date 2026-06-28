import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const ImpersonationBanner: Component = () => {
	const [impersonatedUser, setImpersonatedUser] = createSignal<string | null>(null);
	const [remainingSeconds, setRemainingSeconds] = createSignal(0);

	// Reactive check: re-evaluates whenever sessionStorage is read (on mount and re-render)
	createEffect(() => {
		const activeSessionUser = sessionStorage.getItem('impersonated_username');
		const token = sessionStorage.getItem('owner_impersonation_token');
		if (activeSessionUser && token) {
			setImpersonatedUser(activeSessionUser);

			// Parse JWT expiry to calculate remaining time
			try {
				const payload = JSON.parse(atob(token.split('.')[1]));
				const expiresAt = payload.exp * 1000; // Convert to ms
				const now = Date.now();
				const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
				setRemainingSeconds(remaining);
			} catch {
				setRemainingSeconds(900); // Fallback: 15 minutes
			}
		} else {
			setImpersonatedUser(null);
		}
	});

	// Countdown timer
	const timer = setInterval(() => {
		if (remainingSeconds() > 0) {
			setRemainingSeconds((prev) => prev - 1);
		}
		if (remainingSeconds() <= 0 && impersonatedUser()) {
			// Token expired — auto-exit
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

		// 1. Remove impersonation variables
		sessionStorage.removeItem('owner_impersonation_token');
		sessionStorage.removeItem('impersonated_user_id');
		sessionStorage.removeItem('impersonated_username');

		// 2. Clear cached profile data to prevent stale display
		localStorage.removeItem('cached_profile_stats');
		localStorage.removeItem('cached_profile_achievements');
		localStorage.removeItem('cached_profile_referral');

		// 3. Clear state
		setImpersonatedUser(null);

		// 4. Redirect back to owner users page with full reload
		// Using direct location change avoids race condition with SPA navigate + reload
		window.location.href = window.location.pathname + '#/owner/users';
		window.location.reload();
	};

	return (
		<Show when={impersonatedUser()}>
			<div
				class={`fixed top-0 inset-x-0 z-[10000] h-11 backdrop-blur-md border-b px-4 flex items-center justify-between text-xs text-white font-bold shadow-lg animate-slide-down select-none ${
					remainingSeconds() <= 120
						? 'bg-orange-600/90 border-orange-500/20'
						: 'bg-red-600/90 border-red-500/20'
				}`}
			>
				<div class="flex items-center gap-2">
					<span class="inline-block w-2.5 h-2.5 rounded-full bg-white animate-ping" />
					<span>
						{t('profile.impersonationBanner').replace('{username}', impersonatedUser() || '')}
					</span>
					<span
						class={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
							remainingSeconds() <= 120
								? 'bg-white/30 text-white'
								: 'bg-white/20 text-white/90'
						}`}
					>
						{formatTime(remainingSeconds())}
					</span>
				</div>
				<button
					onClick={handleExitSimulation}
					class="h-7 px-3 bg-white text-red-600 active:scale-95 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow shadow-black/20"
				>
					{t('profile.exitSimulation')}
				</button>
			</div>
		</Show>
	);
};
