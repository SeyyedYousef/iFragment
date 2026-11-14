import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, Show } from 'solid-js';
import { investorsApi } from '@/entities/investors/index.js';
import { buildMediaUrl } from '@/shared/api/config.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { openTelegramLink } from '@/shared/lib/telegram-native.js';
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

	const handleRetry = (e: MouseEvent) => {
		e.stopPropagation();
		setImageFailed(false);
		setImageReady(false);
		configQuery.refetch();
	};

	const handleOpenInvestorsGroup = () => {
		try {
			haptic.impact('medium');
		} catch {}
		try {
			openTelegramLink('https://t.me/FragmentInvestors');
		} catch {
			window.open('https://t.me/FragmentInvestors', '_blank');
		}
	};

	const imageUrl = () => configQuery.data?.image_url;

	return (
		<div
			onClick={handleOpenInvestorsGroup}
			class="frag-canvas relative min-h-[100dvh] w-full overflow-hidden select-none cursor-pointer"
		>
			{/* Loading Skeleton */}
			<Show when={configQuery.isLoading}>
				<div
					data-testid="investors-skeleton"
					class="absolute inset-0 flex flex-col items-center justify-center bg-[#11161d] animate-pulse pointer-events-none"
				>
					<div class="h-11 w-11 rounded-2xl bg-[#1b232d] border border-white/[0.08] mb-3" />
					<div class="h-3.5 w-36 rounded-md bg-[#1b232d]" />
				</div>
			</Show>

			{/* Error State (API failure or Image Load failure) */}
			<Show when={configQuery.isError || imageFailed()}>
				<div
					data-testid="investors-error-state"
					class="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center"
				>
					<div class="frag-card-elevated rounded-2xl p-6 max-w-xs w-full flex flex-col items-center space-y-4">
						<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff5c6c]/12 text-[#ff5c6c] border border-[#ff5c6c]/25">
							<span class="material-symbols-outlined text-3xl">error_outline</span>
						</div>
						<div>
							<h3 class="text-sm font-semibold text-white">
								{t('fragmentInvestors.loadFailedTitle')}
							</h3>
							<p class="text-xs text-[#8ca0b5] mt-1">{t('fragmentInvestors.loadFailedDesc')}</p>
						</div>
						<button
							type="button"
							onClick={handleRetry}
							class="frag-btn-secondary flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white active:scale-95 cursor-pointer z-20"
						>
							<span class="material-symbols-outlined text-sm">refresh</span>
							<span>{t('common.retry')}</span>
						</button>
					</div>
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
					class="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center"
				>
					<div class="frag-card-elevated rounded-2xl p-6 max-w-xs w-full flex flex-col items-center space-y-3">
						<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#141a22] text-[#8ca0b5] border border-white/[0.08]">
							<span class="material-symbols-outlined text-3xl">image_not_supported</span>
						</div>
						<p class="text-xs text-[#8ca0b5]">{t('fragmentInvestors.emptyImage')}</p>
					</div>
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
						<div class="absolute inset-0 bg-[#141a22] animate-pulse" />
					</Show>

					<img
						alt={t('fragmentInvestors.bannerAlt')}
						ref={(el) => {
							if (el?.complete && el.naturalWidth > 0) {
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

			{/* Bottom Navigation on top (Stop propagation so clicking navigation does not trigger open group) */}
			<div onClick={(e) => e.stopPropagation()} class="relative z-50 pointer-events-auto">
				<BottomNav />
			</div>
		</div>
	);
};
