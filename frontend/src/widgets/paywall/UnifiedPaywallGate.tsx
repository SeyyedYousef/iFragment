import { type Component, createSignal, Show } from 'solid-js';
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
 * Unified, world-class minimalist luxury paywall gate.
 * Displays clean asset identity, live credit balance, single master CTA, and trust indicators.
 */
export const UnifiedPaywallGate: Component<UnifiedPaywallGateProps> = (props) => {
	const wallet = useWallet();
	const [storeOpen, setStoreOpen] = createSignal(false);
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
			{/* ═══════ 1. MINIMALIST ASSET IDENTITY HEADER ═══════ */}
			<div class="w-full flex flex-col items-center justify-center text-center py-4 px-2">
				{/* Ambient Glow behind asset */}
				<div class="relative mb-3 flex items-center justify-center">
					<div
						class="pointer-events-none absolute h-24 w-24 rounded-full opacity-40 blur-2xl transition-all duration-300"
						style={{ background: theme().glow }}
						aria-hidden="true"
					/>
					<div
						class="relative flex h-20 w-20 items-center justify-center rounded-[28px] border shadow-2xl backdrop-blur-xl overflow-hidden"
						style={{
							background:
								'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
							'border-color': theme().accentBorder,
						}}
					>
						<Show
							when={props.targetImage}
							fallback={
								<span
									class="material-symbols-outlined text-[36px] drop-shadow-md"
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
								class="h-full w-full object-contain p-1.5 drop-shadow-lg transition-transform duration-300 hover:scale-105"
							/>
						</Show>

						{/* Pulsing online status indicator */}
						<div
							class="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#06070B] animate-pulse z-10"
							style={{ background: '#10b981' }}
						/>
					</div>
				</div>

				{/* Target Title (e.g. @chanel or +888 8888 8888) */}
				<Show when={props.targetTitle}>
					<h2
						class="text-[26px] sm:text-[30px] font-black tracking-tight text-white font-mono drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] truncate max-w-[90%] leading-tight"
						dir="ltr"
					>
						{props.targetTitle}
					</h2>
				</Show>

				{/* Subtitle / Pattern if provided */}
				<Show when={props.targetSubtitle}>
					<p class="mt-1 text-[11px] font-medium text-white/50">{props.targetSubtitle}</p>
				</Show>

				{/* Ready Status Badge */}
				<div class="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-[11px] font-bold text-white/70 backdrop-blur-md shadow-sm">
					<span class="h-2 w-2 rounded-full animate-ping" style={{ background: theme().accent }} />
					<span>{props.targetBadge || t('paywall.ready_for_appraisal')}</span>
				</div>
			</div>

			{/* ═══════ 2. MINIMALIST LUXURY ACTION HUD ═══════ */}
			<div class="w-full relative overflow-hidden rounded-[30px] border border-white/10 bg-[#12141C]/90 p-5 shadow-2xl backdrop-blur-2xl space-y-4">
				{/* Soft corner ambient aura */}
				<div
					class="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-35 blur-3xl"
					style={{ background: theme().accentSoft }}
					aria-hidden="true"
				/>

				{/* Error State Banner */}
				<Show when={props.error}>
					<div class="flex items-center justify-between gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-bold text-rose-300">
						<div class="flex items-center gap-2 min-w-0">
							<span class="material-symbols-outlined text-base shrink-0">error</span>
							<span class="truncate">{props.error}</span>
						</div>
						<Show when={props.lastOrderPayload && props.onCheckPaymentStatus}>
							<button
								type="button"
								onClick={props.onCheckPaymentStatus}
								class="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-white rounded-lg text-[10px] uppercase font-mono font-bold shrink-0 transition-colors"
							>
								{t('paywall.retry')}
							</button>
						</Show>
					</div>
				</Show>

				{/* Polling In-Progress Banner */}
				<Show when={props.paymentPending}>
					<div class="p-3.5 bg-[#0098EA]/10 border border-[#0098EA]/30 rounded-2xl flex items-center justify-between gap-3 animate-pulse">
						<div class="flex items-center gap-2.5 min-w-0">
							<div class="w-4 h-4 border-2 border-[#0098EA]/30 border-t-[#0098EA] rounded-full animate-spin shrink-0" />
							<span class="text-xs text-white font-bold truncate">
								{props.pollingStatus || t('paywall.working')}
							</span>
						</div>
						<Show when={props.onCheckPaymentStatus}>
							<button
								type="button"
								onClick={props.onCheckPaymentStatus}
								class="px-3 py-1 bg-[#0098EA] text-black font-black text-[10px] rounded-lg shrink-0"
							>
								{t('paywall.retry')}
							</button>
						</Show>
					</div>
				</Show>

				{/* Live Balance Bar */}
				<CreditWalletBar onOpenStore={() => setStoreOpen(true)} />

				{/* Master Action Button */}
				<button
					type="button"
					disabled={props.unlocking || props.paymentPending}
					onClick={handlePrimary}
					class="group relative flex h-14 w-full items-center justify-center gap-2.5 overflow-hidden rounded-[20px] py-3.5 text-sm font-black text-white shadow-xl transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
					style={{
						background: theme().gradient,
						'box-shadow': `0 10px 30px -6px ${theme().glow}`,
					}}
				>
					{/* Shimmer sweep effect */}
					<span
						class="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-white/25 opacity-0 transition-all duration-500 group-hover:left-[110%] group-hover:opacity-100"
						aria-hidden="true"
					/>
					<Show
						when={!props.unlocking}
						fallback={
							<span class="material-symbols-outlined animate-spin text-[20px]">
								progress_activity
							</span>
						}
					>
						<span class="material-symbols-outlined text-[20px]">lock_open</span>
					</Show>
					<span class="tracking-wide">
						{props.unlocking
							? t('paywall.working')
							: props.unlockCtaText ||
								t('paywall.cta_unlock_specific', { target: props.targetTitle || '' }) ||
								t('paywall.cta_unlock')}
					</span>
				</button>

				{/* ═══════ 3. SUBTLE MICRO-TRUST POINTS ═══════ */}
				<div class="flex items-center justify-center gap-2 sm:gap-3 pt-1 text-[10px] sm:text-[11px] font-bold text-white/50">
					<span class="flex items-center gap-1">
						<span class="material-symbols-outlined text-[13px] text-[#10b981]">verified</span>
						<span>{t('paywall.trust_onchain')}</span>
					</span>
					<span class="h-3 w-px bg-white/10" />
					<span class="flex items-center gap-1">
						<span class="material-symbols-outlined text-[13px] text-amber-400">auto_awesome</span>
						<span>{t('paywall.trust_ai')}</span>
					</span>
					<span class="h-3 w-px bg-white/10" />
					<span class="flex items-center gap-1">
						<span class="material-symbols-outlined text-[13px] text-[#0098EA]">trending_up</span>
						<span>{t('paywall.trust_market')}</span>
					</span>
				</div>
			</div>

			{/* Modal Store Sheet for Telegram Stars & Airdrop Coin Exchange */}
			<CreditStoreSheet
				open={storeOpen()}
				onClose={() => setStoreOpen(false)}
				vertical={props.vertical}
			/>
		</div>
	);
};
