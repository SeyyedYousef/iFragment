import { Motion } from '@motionone/solid';
import { Component, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { useQueryClient } from '@tanstack/solid-query';
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
				transition={{ duration: 0.3 }}
				class="fixed top-4 left-4 right-4 z-[9999] flex items-center justify-between p-4 rounded-3xl bg-[#ff3b30]/10 border border-[#ff3b30]/30 backdrop-blur-xl shadow-[0_10px_30px_rgba(255,59,48,0.15)] max-w-md mx-auto"
			>
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-full bg-[#ff3b30]/20 flex items-center justify-center animate-pulse">
						<span class="material-symbols-outlined text-[#ff3b30] text-[18px]">wifi_off</span>
					</div>
					<div class="flex flex-col gap-0.5">
						<span class="text-[13px] font-black text-white">
							{t('connection.interrupted' as any) || 'Connection Interrupted'}
						</span>
						<span class="text-[11px] font-semibold text-[#8e8e93] leading-snug">
							{t('connection.checking' as any) || 'Checking internet connection...'}
						</span>
					</div>
				</div>
				<button
					onClick={() => {
						setIsOnline(navigator.onLine);
						if (navigator.onLine) {
							queryClient.refetchQueries();
						}
					}}
					class="bg-[#ff3b30]/20 hover:bg-[#ff3b30]/30 text-white font-bold text-[11px] px-3.5 py-2 rounded-xl transition-all border border-[#ff3b30]/20 active:scale-95 duration-100"
				>
					{t('connection.retry' as any) || 'Retry'}
				</button>
			</Motion.div>
		</Show>
	);
};
