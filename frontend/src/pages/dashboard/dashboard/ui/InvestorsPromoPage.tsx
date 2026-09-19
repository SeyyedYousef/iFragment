import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, Show } from 'solid-js';
import { investorsApi } from '@/entities/investors/index.js';
import { buildMediaUrl } from '@/shared/api/config.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { BottomNav } from '@/widgets/bottom-nav/index.js';

export const InvestorsPromoPage: Component = () => {
	useTelegramBackButton(-1);

	const [imageReady, setImageReady] = createSignal(false);
	const [imageFailed, setImageFailed] = createSignal(false);

	const configQuery = createQuery(() => ({
		queryKey: ['public', 'investors-page'],
		queryFn: investorsApi.getPageConfig,
		staleTime: 60_000,
	}));

	const handleRetry = () => {
		setImageFailed(false);
		setImageReady(false);
		configQuery.refetch();
	};

	const imageUrl = () => configQuery.data?.image_url;

	return (
		<div class="relative min-h-[100dvh] w-full overflow-hidden bg-[#08090d] select-none">
			{/* Loading Skeleton */}
			<Show when={configQuery.isLoading}>
				<div
					data-testid="investors-skeleton"
					class="absolute inset-0 flex flex-col items-center justify-center bg-[#08090d] animate-pulse"
				>
					<div class="h-10 w-10 rounded-full bg-white/5 mb-3" />
					<div class="h-4 w-36 rounded-md bg-white/5" />
				</div>
			</Show>

			{/* Error State (API failure or Image Load failure) */}
			<Show when={configQuery.isError || imageFailed()}>
				<div
					data-testid="investors-error-state"
					class="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center space-y-4"
				>
					<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
						<span class="material-symbols-outlined text-3xl">error_outline</span>
					</div>
					<div>
						<h3 class="text-sm font-semibold text-white">Failed to load Investors content</h3>
						<p class="text-xs text-white/50 mt-1">Please check your network and try again.</p>
					</div>
					<button
						type="button"
						onClick={handleRetry}
						class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition border border-white/10 active:scale-95"
					>
						<span class="material-symbols-outlined text-sm">refresh</span>
						<span>Retry</span>
					</button>
				</div>
			</Show>

			{/* Empty State */}
			<Show
				when={
					!configQuery.isLoading &&
					!configQuery.isError &&
					!imageFailed() &&
					(!imageUrl() || imageUrl()!.trim() === '')
				}
			>
				<div
					data-testid="investors-empty-state"
					class="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center space-y-3"
				>
					<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white/40 border border-white/10">
						<span class="material-symbols-outlined text-3xl">image_not_supported</span>
					</div>
					<p class="text-xs text-white/50">Investors image is not configured yet.</p>
				</div>
			</Show>

			{/* Promotional Fullscreen Image */}
			<Show
				when={
					!configQuery.isLoading &&
					!configQuery.isError &&
					!imageFailed() &&
					imageUrl() &&
					imageUrl()!.trim() !== ''
				}
			>
				<div class="absolute inset-0 w-full h-full overflow-hidden">
					{/* Placeholder pulse while image decodes */}
					<Show when={!imageReady()}>
						<div class="absolute inset-0 bg-white/[0.02] animate-pulse" />
					</Show>

					<img
						alt="Investors Promotional Banner"
						ref={(el) => {
							if (el && el.complete && el.naturalWidth > 0) {
								setImageReady(true);
							}
						}}
						src={buildMediaUrl(imageUrl()!)}
						loading="eager"
						decoding="async"
						onLoad={() => setImageReady(true)}
						onError={() => setImageFailed(true)}
						class="absolute inset-0 w-full h-full object-cover object-center pointer-events-none transition-opacity duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
						style={{ opacity: imageReady() ? '1' : '0' }}
					/>
				</div>
			</Show>

			{/* Bottom Navigation on top */}
			<BottomNav />
		</div>
	);
};
