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
	/** Executes the vertical-specific unlock-with-credit call */
	onUnlock: () => Promise<void>;
	unlocking: boolean;
	error?: string | null;
	lastOrderPayload?: string;
	paymentPending?: boolean;
	pollingStatus?: string;
	onCheckPaymentStatus?: () => void;
}

/**
 * Unified Fragment-grade paywall gate.
 * Presents clean asset identity, live credit balance, single primary CTA, and trust metadata.
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
		<div class="w-full flex flex-col items-center gap-4 relative z-20">
			{/* 1. Asset Identity Header */}
			<div class="w-full flex flex-col items-center justify-center text-center pt-3 pb-1 px-2">
				<div class="relative mb-3 flex items-center justify-center">
					<div
						class="relative flex h-20 w-20 items-center justify-center rounded-[18px] frag-card-elevated frag-guilloche-pattern overflow-hidden"
						style={{ 'border-color': theme().accentBorder }}
					>
						<Show
							when={props.vertical === 'gift' && (props.targetGiftSlug || props.targetImage)}
							fallback={
								<Show
									when={props.targetImage && !imgErr()}
									fallback={
										<span
											class="material-symbols-outlined text-[34px]"
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
										class={`h-full w-full object-contain p-1.5 transition-all duration-300 ${
											imgLoaded() ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
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

						<span
							class="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#141a22] z-10"
							style={{ background: '#4cd964' }}
							aria-hidden="true"
						/>
					</div>
				</div>

				<Show when={props.targetTitle}>
					<h2
						class="text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] text-white font-mono truncate max-w-[92%] leading-tight tabular-nums"
						dir="ltr"
					>
						{props.targetTitle}
					</h2>
				</Show>

				<Show when={props.targetSubtitle}>
					<p class="mt-1 text-[12px] font-medium text-[#8c9ba5]">{props.targetSubtitle}</p>
				</Show>

				{/* Ready Status Chip */}
				<div
					class="mt-2.5 inline-flex items-center gap-1.5 h-[24px] rounded-[7px] px-2.5 text-[11px] font-medium"
					style={{
						color: theme().accent,
						'background-color': theme().accentSoft,
						border: `1px solid ${theme().accentBorder}`,
					}}
				>
					<span class="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: theme().accent }} />
					<span>{props.targetBadge || t('paywall.ready_for_appraisal')}</span>
				</div>
			</div>

			{/* 2. Action HUD Card */}
			<div class="w-full relative overflow-hidden frag-card-elevated rounded-[16px] p-4 sm:p-5 space-y-3.5">
				<Show when={props.error}>
					<div class="flex items-center justify-between gap-2 rounded-[10px] border border-[#ff5c6c]/30 bg-[#ff5c6c]/10 px-3 py-2.5 text-[12px] font-medium text-[#ff9ca6]">
						<div class="flex items-center gap-2 min-w-0">
							<span class="material-symbols-outlined text-[16px] text-[#ff5c6c] shrink-0">
								error
							</span>
							<span class="truncate">{props.error}</span>
						</div>
						<Show when={props.lastOrderPayload && props.onCheckPaymentStatus}>
							<button
								type="button"
								onClick={props.onCheckPaymentStatus}
								class="px-2.5 py-1 bg-[#ff5c6c]/20 hover:bg-[#ff5c6c]/30 text-white rounded-[6px] text-[11px] font-mono font-semibold shrink-0 transition-colors"
							>
								{t('paywall.retry')}
							</button>
						</Show>
					</div>
				</Show>

				<Show when={props.paymentPending}>
					<div class="px-3.5 py-2.5 bg-[#2990ff]/10 border border-[#2990ff]/30 rounded-[10px] flex items-center justify-between gap-3">
						<div class="flex items-center gap-2.5 min-w-0">
							<div class="w-4 h-4 border-2 border-[#2990ff]/30 border-t-[#2990ff] rounded-full animate-spin shrink-0" />
							<span class="text-[12px] text-white font-medium truncate">
								{props.pollingStatus || t('paywall.working')}
							</span>
						</div>
						<Show when={props.onCheckPaymentStatus}>
							<button
								type="button"
								onClick={props.onCheckPaymentStatus}
								class="px-2.5 py-1 frag-btn-primary text-[11px] font-semibold rounded-[7px] shrink-0"
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
					class="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[12px] px-4 text-[14px] font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-[0.985] disabled:opacity-55 border border-white/[0.16]"
					style={{
						background: theme().gradient,
						'box-shadow': `inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 24px -6px ${theme().glow}`,
					}}
				>
					<span
						class="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-white/20 opacity-0 transition-all duration-500 group-hover:left-[110%] group-hover:opacity-100"
						aria-hidden="true"
					/>
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
					<span>
						{props.unlocking
							? t('paywall.working')
							: props.unlockCtaText ||
								t('paywall.cta_unlock_specific', { target: props.targetTitle || '' }) ||
								t('paywall.cta_unlock')}
					</span>
				</button>

				{/* 3. Trust Strip */}
				<div class="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 pt-2 border-t border-white/[0.06] text-[11px] font-medium text-[#8c9ba5]">
					<span class="flex items-center gap-1">
						<span class="material-symbols-outlined text-[14px] text-[#4cd964]">verified</span>
						<span>{t('paywall.trust_onchain')}</span>
					</span>
					<span class="h-3 w-px bg-white/[0.08]" />
					<span class="flex items-center gap-1">
						<span class="material-symbols-outlined text-[14px] text-[#ffb340]">auto_awesome</span>
						<span>{t('paywall.trust_ai')}</span>
					</span>
					<span class="h-3 w-px bg-white/[0.08]" />
					<span class="flex items-center gap-1">
						<span class="material-symbols-outlined text-[14px] text-[#2990ff]">trending_up</span>
						<span>{t('paywall.trust_market')}</span>
					</span>
				</div>
			</div>

			<CreditStoreSheet
				open={storeOpen()}
				onClose={() => setStoreOpen(false)}
				vertical={props.vertical}
			/>
		</div>
	);
};
