import { useNavigate } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { onCleanup, onMount } from 'solid-js';

export function useTelegramBackButton(target?: string | number): void {
	let routerNavigate: ReturnType<typeof useNavigate> | null = null;
	try {
		routerNavigate = useNavigate();
	} catch {
		routerNavigate = null;
	}

	onMount(() => {
		try {
			backButton.show();
			const handler = () => {
				if (typeof target === 'string') {
					if (routerNavigate) routerNavigate(target);
					else window.location.hash = `#${target}`;
				} else if (typeof target === 'number') {
					if (routerNavigate) routerNavigate(target);
					else window.history.go(target);
				} else {
					if (routerNavigate) routerNavigate(-1);
					else window.history.back();
				}
			};
			backButton.onClick(handler);
			onCleanup(() => {
				try {
					if (typeof (backButton as any)?.offClick === 'function') {
						(backButton as any).offClick(handler);
					}
					if (typeof (backButton as any)?.hide === 'function') {
						(backButton as any).hide();
					}
				} catch {}
			});
		} catch (e) {
			console.warn('Telegram backButton is not available', e);
		}
	});
}
