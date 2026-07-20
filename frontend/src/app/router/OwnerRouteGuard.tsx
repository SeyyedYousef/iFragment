import { useNavigate } from '@solidjs/router';
import { Component, createSignal, JSX, onMount, Show } from 'solid-js';
import { OwnerGateModal } from '@/widgets/owner/OwnerGateModal.js';

interface OwnerRouteGuardProps {
	children: JSX.Element;
}

export const OwnerRouteGuard: Component<OwnerRouteGuardProps> = (props) => {
	const navigate = useNavigate();
	const [status, setStatus] = createSignal<'checking' | 'authenticated' | 'unauthorized'>('checking');
	const [showAuthGate, setShowAuthGate] = createSignal(false);

	const verifySession = () => {
		const token = sessionStorage.getItem('owner_token');
		if (!token) {
			setStatus('unauthorized');
			setShowAuthGate(true);
			return;
		}

		try {
			const payload = JSON.parse(atob(token.split('.')[1]));
			const expiresAt = payload.exp * 1000;
			if (Date.now() >= expiresAt) {
				console.warn('[OwnerGuard] Session expired. Clearing token.');
				sessionStorage.removeItem('owner_token');
				sessionStorage.removeItem('owner_telegram_id');
				setStatus('unauthorized');
				setShowAuthGate(true);
				return;
			}
			setStatus('authenticated');
		} catch (_e) {
			// If token is non-JWT string, allow session if token exists
			setStatus('authenticated');
		}
	};

	onMount(() => {
		verifySession();
	});

	const handleGateClose = () => {
		setShowAuthGate(false);
		if (status() !== 'authenticated') {
			navigate('/');
		}
	};

	return (
		<>
			<Show when={status() === 'checking'}>
				<div class="min-h-screen bg-[#090a0f] flex flex-col items-center justify-center text-white p-6">
					<div class="w-12 h-12 border-4 border-[#3390ec] border-t-transparent rounded-full animate-spin mb-4" />
					<p class="text-xs text-white/60 font-bold">در حال بررسی دسترسی مدیریت...</p>
				</div>
			</Show>

			<Show when={status() === 'authenticated'}>
				{props.children}
			</Show>

			<OwnerGateModal isOpen={showAuthGate()} onClose={handleGateClose} />
		</>
	);
};
