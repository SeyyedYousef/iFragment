import { Motion } from '@motionone/solid';
import { useQueryClient } from '@tanstack/solid-query';
import { type Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const ConnectionStatusBanner: Component = () => {
	const queryClient = useQueryClient();
	const [isOnline, setIsOnline] = createSignal(navigator.onLine);

	const handleOnline = () => {
		setIsOnline(true);
	};

	const handleOffline = () => {
		setIsOnline(false);
	};

	onMount(() => {
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
	});

	onCleanup(() => {
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
	});

	return (
		<Show when={!isOnline()}>
			<Motion.div
				initial={{ opacity: 0, y: -50 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -50 }}
				transition={{ duration: 0.25 }}
				class="fixed top-4 left-4 right-4 z-[9999] frag-toast rounded-[16px] border border-[#ff5c6c]/30 p-3.5 max-w-md mx-auto flex items-center justify-between gap-3"
			>
				<div class="flex items-center gap-3 min-w-0">
					<div class="w-8 h-8 rounded-[9px] bg-[#ff5c6c]/12 border border-[#ff5c6c]/25 flex items-center justify-center shrink-0">
						<span class="material-symbols-outlined text-[#ff5c6c] text-[18px]">wifi_off</span>
					</div>
					<div class="flex flex-col gap-0.5 min-w-0">
						<span class="text-[13px] font-semibold text-white truncate">
							{t('connection.interrupted' as any) || 'Connection Interrupted'}
						</span>
						<span class="text-[11px] font-medium text-[#8c9ba5] leading-snug truncate">
							{t('connection.checking' as any) || 'Checking internet connection...'}
						</span>
					</div>
				</div>
				<button
					type="button"
					onClick={() => {
						setIsOnline(navigator.onLine);
						if (navigator.onLine) {
							queryClient.refetchQueries();
						}
					}}
					class="bg-[#ff5c6c]/15 hover:bg-[#ff5c6c]/25 text-[#ff8591] font-semibold text-[11.5px] px-3 py-1.5 rounded-[8px] transition-all border border-[#ff5c6c]/25 active:scale-95 shrink-0"
				>
					{t('connection.retry' as any) || 'Retry'}
				</button>
			</Motion.div>
		</Show>
	);
};
