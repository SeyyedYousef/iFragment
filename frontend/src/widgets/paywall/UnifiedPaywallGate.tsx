import { type Component, createSignal, Show } from 'solid-js';
import { GiftThumbnail } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { CreditStoreSheet } from './CreditStoreSheet.js';
import { CreditWalletBar } from './CreditWalletBar.js';
import { type PaywallVertical, verticalThemes } from './theme.js';
import { useWallet } from './useWallet.js';

interface UnifiedPaywallGateProps {
	vertical: PaywallVertical;
	targetTitle?: string;
	targetSubtitle?: string;
	targetBadge?: string;
	targetIcon?: string;
	targetImage?: string;
	targetGiftSlug?: string;
	targetGiftModel?: string;
	targetGiftSerial?: number;
	unlockCtaText?: string;
	onUnlock: () => Promise<void>;
	unlocking: boolean;
	error?: string | null;
	lastOrderPayload?: string;
	paymentPending?: boolean;
	pollingStatus?: string;
	onCheckPaymentStatus?: () => void;
}

/**
 * Minimalist Fragment.com-native paywall gate.
 * Clean #212a33 surface, 8px radius, #248bda primary CTA, zero visual bloat.
 */
export const UnifiedPaywallGate: Component<UnifiedPaywallGateProps> = (props) => {
	const wallet = useWallet();
	const [storeOpen, setStoreOpen] = createSignal(false);
	const [imgErr, setImgErr] = createSignal(false);
	const [imgLoaded, setImgLoaded] = createSignal(false);
	const theme = () => verticalThemes[props.vertical];

	const canAfford = () => {
		const b = wallet.balance();
		return b === null || b >= 1;
	};

	const handlePrimary = async () => {
		try {
			haptic.impact('medium');
		} catch {}
		if (!canAfford()) {
			setStoreOpen(true);
			return;
		}
		await props.onUnlock();
	};

	return (
		<div class="w-full flex flex-col items-center gap-3.5 relative z-20">
			{/* Compact Asset Header + Action Card (#212a33, 8px radius) */}
			<div class="w-full frag-card p-4 space-y-3.5">
				<div class="flex items-center justify-between gap-3">
					<div class="flex items-center gap-3 min-w-0">
						<div class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] bg-[#242e38] overflow-hidden">
							<Show
								when={props.vertical === 'gift' && (props.targetGiftSlug || props.targetImage)}
								fallback={
									<Show
										when={props.targetImage && !imgErr()}
										fallback={
											<span
												class="material-symbols-outlined text-[24px]"
												style={{ color: theme().accent }}
											>
												{props.targetIcon || theme().glyph}
											</span>
										}
									>
										<img
											src={props.targetImage}
											alt={props.targetTitle || 'Asset'}
											referrerpolicy="no-referrer"
											onLoad={() => setImgLoaded(true)}
											onError={() => setImgErr(true)}
											class={`h-full w-full object-contain p-1 transition-opacity duration-200 ${
												imgLoaded() ? 'opacity-100' : 'opacity-0'
											}`}
										/>
									</Show>
								}
							>
								<GiftThumbnail
									slug={props.targetGiftSlug || ''}
									name={props.targetTitle}
									model={props.targetGiftModel}
									serialNumber={props.targetGiftSerial}
									customImageUrl={props.targetImage}
									class="w-full h-full object-contain p-1 border-0 bg-transparent shadow-none"
								/>
							</Show>
						</div>

						<div class="flex flex-col min-w-0 text-start">
							<Show when={props.targetTitle}>
								<h2
									class="text-[17px] font-semibold tracking-[-0.015em] text-white font-mono truncate leading-tight tabular-nums"
									dir="ltr"
								>
									{props.targetTitle}
								</h2>
							</Show>
							<Show when={props.targetSubtitle}>
								<p class="mt-0.5 text-[12px] text-[#8794a1] truncate">{props.targetSubtitle}</p>
							</Show>
						</div>
					</div>

					<span
						class="inline-flex items-center gap-1.5 h-[22px] rounded-[4px] px-2 text-[11px] font-semibold shrink-0"
						style={{
							color: '#5aec8c',
							'background-color': 'rgba(90, 236, 140, 0.1)',
						}}
					>
						<span>{props.targetBadge || t('paywall.ready_for_appraisal')}</span>
					</span>
				</div>

				<Show when={props.error}>
					<div class="flex items-center justify-between gap-2 rounded-[6px] bg-[#ff5863]/10 px-3 py-2 text-[12px] font-medium text-[#ff5863]">
						<div class="flex items-center gap-2 min-w-0">
							<span class="material-symbols-outlined text-[16px] shrink-0">error</span>
							<span class="truncate">{props.error}</span>
						</div>
						<Show when={props.lastOrderPayload && props.onCheckPaymentStatus}>
							<button
								type="button"
								onClick={props.onCheckPaymentStatus}
								class="px-2.5 py-1 bg-[#ff5863]/20 hover:bg-[#ff5863]/30 text-white rounded-[4px] text-[11px] font-semibold shrink-0 transition-colors"
							>
								{t('paywall.retry')}
							</button>
						</Show>
					</div>
				</Show>

				<Show when={props.paymentPending}>
					<div class="px-3 py-2.5 bg-[#4db2ff]/10 rounded-[6px] flex items-center justify-between gap-3">
						<div class="flex items-center gap-2.5 min-w-0">
							<div class="w-4 h-4 border-2 border-[#4db2ff]/30 border-t-[#4db2ff] rounded-full animate-spin shrink-0" />
							<span class="text-[12px] text-white font-medium truncate">
								{props.pollingStatus || t('paywall.working')}
							</span>
						</div>
						<Show when={props.onCheckPaymentStatus}>
							<button
								type="button"
								onClick={props.onCheckPaymentStatus}
								class="px-2.5 py-1 frag-btn-primary text-[11px] font-semibold rounded-[4px] shrink-0"
							>
								{t('paywall.retry')}
							</button>
						</Show>
					</div>
				</Show>

				<CreditWalletBar onOpenStore={() => setStoreOpen(true)} />

				<button
					type="button"
					disabled={props.unlocking || props.paymentPending}
					onClick={handlePrimary}
					class="frag-btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-[8px] px-4 text-[14px] font-semibold text-white disabled:opacity-50 cursor-pointer"
				>
					<Show
						when={!props.unlocking}
						fallback={
							<span class="material-symbols-outlined animate-spin text-[18px]">
								progress_activity
							</span>
						}
					>
						<span class="material-symbols-outlined text-[18px]">lock_open</span>
					</Show>
					<span class="truncate">
						{props.unlocking
							? t('paywall.working')
							: props.unlockCtaText ||
								t('paywall.cta_unlock_specific', { target: props.targetTitle || '' }) ||
								t('paywall.cta_unlock')}
					</span>
				</button>
			</div>

			<CreditStoreSheet
				open={storeOpen()}
				onClose={() => setStoreOpen(false)}
				vertical={props.vertical}
			/>
		</div>
	);
};
