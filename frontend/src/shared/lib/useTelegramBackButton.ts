import { useNavigate } from '@solidjs/router';
import { backButton } from '@tma.js/sdk-solid';
import { onCleanup, onMount } from 'solid-js';

export function useTelegramBackButton(target?: string | number): void {
	const navigate = useNavigate();

	onMount(() => {
		try {
			backButton.show();
			const handler = () => {
				if (typeof target === 'string') {
					navigate(target);
				} else if (typeof target === 'number') {
					navigate(target);
				} else {
					navigate(-1);
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
