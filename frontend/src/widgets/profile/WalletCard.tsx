import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { type Component, createMemo, createSignal, Show } from 'solid-js';
import type { ProfileStats } from '@/entities/user/index.js';
import { formatNumber, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { LedgerModal } from './LedgerModal.js';

interface Props {
	stats: ProfileStats | null;
	onBuyStars?: () => void;
}

export const WalletCard: Component<Props> = (props) => {
	const navigate = useNavigate();
	const [showLedger, setShowLedger] = createSignal(false);

	const coins = createMemo(() => props.stats?.airdropCoins || 0);
	const credits = createMemo(() => props.stats?.intelCredits ?? props.stats?.valuationCredits ?? 0);
	const expiryDays = createMemo(() => props.stats?.creditExpiresInDays ?? 30);
	const subscription = createMemo(() => props.stats?.subscription);

	const handleOpenShop = () => {
		try {
			haptic.impact('light');
		} catch {}
		navigate('/airdrop?tab=shop');
	};

	const handleOpenLedger = () => {
		try {
			haptic.impact('light');
		} catch {}
		setShowLedger(true);
	};

	return (
		<>
			<Motion.div
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.08 }}
				class="w-full relative select-none"
			>
				{/* Ambient Glow */}
				<div class="absolute -inset-1 bg-gradient-to-r from-[#0098EA]/20 via-[#06b6d4]/10 to-transparent rounded-[30px] blur-xl -z-10 pointer-events-none" />

				<div class="bg-[#0D1017]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col gap-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
					{/* Header */}
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2.5">
							<div class="w-9 h-9 rounded-[12px] bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center text-[#0098EA] shadow-inner">
								<span
									class="material-symbols-outlined text-[20px]"
									style={{ 'font-variation-settings': '"FILL" 1' }}
								>
									account_balance_wallet
								</span>
							</div>
							<div class="flex flex-col">
								<span class="text-[14px] font-black text-white tracking-tight">
									{t('wallet.title' as any) || 'Ecosystem Wallet'}
								</span>
								<span class="text-[10px] font-bold text-white/40 uppercase tracking-wider">
									{t('wallet.subtitle' as any) || 'Unified Assets & Ledger'}
								</span>
							</div>
						</div>

						{/* Ledger Action */}
						<button
							type="button"
							onClick={handleOpenLedger}
							class="flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-white/80 text-[11px] font-black transition-all"
						>
							<span class="material-symbols-outlined text-[16px] text-[#0098EA]">receipt_long</span>
							<span>{t('wallet.ledger' as any) || 'Ledger'}</span>
						</button>
					</div>

					{/* 3-Asset Grid */}
					<div class="grid grid-cols-3 gap-2.5 pt-1">
						{/* 1. Airdrop Coins */}
						<div class="bg-[#07090E] border border-white/5 rounded-[20px] p-3 flex flex-col justify-between gap-2 relative overflow-hidden group hover:border-[#0098EA]/30 transition-all">
							<div class="flex flex-col gap-0.5">
								<span class="text-[10px] font-bold text-white/40 uppercase tracking-wider">
									{t('wallet.coins' as any) || 'Airdrop Coins'}
								</span>
								<div class="flex items-baseline gap-1">
									<span class="text-[18px] font-black text-amber-400 font-mono tracking-tight tabular-nums drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">
										{formatNumber(coins())}
									</span>
									<span class="text-[11px] text-amber-400/70 font-black">🪙</span>
								</div>
							</div>

							<div class="flex flex-col gap-1">
								<div class="flex items-center gap-1 text-[9px] font-bold text-white/40">
									<span class="material-symbols-outlined text-[12px] text-amber-400/80">timer</span>
									<span>
										{t('wallet.expiresIn' as any, { days: expiryDays() }) ||
											`${expiryDays()}d left`}
									</span>
								</div>
								<button
									type="button"
									onClick={handleOpenShop}
									class="w-full py-1 rounded-[8px] bg-amber-400/15 hover:bg-amber-400/25 active:scale-95 border border-amber-400/30 text-amber-300 text-[9px] font-black tracking-wide uppercase transition-all"
								>
									{t('wallet.shop' as any) || 'Shop'}
								</button>
							</div>
						</div>

						{/* 2. Intel Credits */}
						<div class="bg-[#07090E] border border-white/5 rounded-[20px] p-3 flex flex-col justify-between gap-2 relative overflow-hidden group hover:border-[#0098EA]/30 transition-all">
							<div class="flex flex-col gap-0.5">
								<span class="text-[10px] font-bold text-white/40 uppercase tracking-wider">
									{t('wallet.credits' as any) || 'Intel Credits'}
								</span>
								<div class="flex items-baseline gap-1">
									<span class="text-[18px] font-black text-[#0098EA] font-mono tracking-tight tabular-nums drop-shadow-[0_0_8px_rgba(0,152,234,0.3)]">
										{credits()}
									</span>
									<span class="text-[10px] text-[#0098EA]/70 font-bold">
										{t('wallet.reports' as any) || 'Reports'}
									</span>
								</div>
							</div>

							<div class="flex flex-col gap-1">
								<div class="flex items-center gap-1 text-[9px] font-bold text-emerald-400/80">
									<span class="material-symbols-outlined text-[12px]">all_inclusive</span>
									<span>{t('wallet.noExpiry' as any) || 'No Expiry'}</span>
								</div>
								<button
									type="button"
									onClick={() =>
										props.onBuyStars ? props.onBuyStars() : navigate('/airdrop?tab=shop')
									}
									class="w-full py-1 rounded-[8px] bg-[#0098EA]/15 hover:bg-[#0098EA]/25 active:scale-95 border border-[#0098EA]/30 text-[#0098EA] text-[9px] font-black tracking-wide uppercase transition-all"
								>
									{t('wallet.buyStars' as any) || '+ Stars'}
								</button>
							</div>
						</div>

						{/* 3. Subscription */}
						<div class="bg-[#07090E] border border-white/5 rounded-[20px] p-3 flex flex-col justify-between gap-2 relative overflow-hidden group hover:border-[#0098EA]/30 transition-all">
							<div class="flex flex-col gap-0.5">
								<span class="text-[10px] font-bold text-white/40 uppercase tracking-wider">
									{t('wallet.subscription' as any) || 'Plan'}
								</span>
								<div class="flex items-baseline gap-1">
									<span
										class={`text-[15px] font-black tracking-tight ${subscription()?.isActive ? 'text-cyan-400' : 'text-white/60'}`}
									>
										{subscription()?.packageTitle || 'Free'}
									</span>
								</div>
							</div>

							<div class="flex flex-col gap-1">
								<Show
									when={subscription()?.isActive}
									fallback={
										<button
											type="button"
											onClick={() =>
												props.onBuyStars ? props.onBuyStars() : navigate('/airdrop?tab=shop')
											}
											class="w-full py-1 rounded-[8px] bg-cyan-500/15 hover:bg-cyan-500/25 active:scale-95 border border-cyan-500/30 text-cyan-300 text-[9px] font-black tracking-wide uppercase transition-all"
										>
											{t('wallet.upgrade' as any) || 'Pro'}
										</button>
									}
								>
									<div class="flex items-center gap-1 text-[9px] font-bold text-cyan-300">
										<span class="material-symbols-outlined text-[12px]">verified</span>
										<span>{subscription()?.daysLeft}d left</span>
									</div>
									<span class="text-[8px] text-white/30 font-bold uppercase tracking-wider">
										Auto-Renew
									</span>
								</Show>
							</div>
						</div>
					</div>
				</div>
			</Motion.div>

			<Show when={showLedger()}>
				<LedgerModal onClose={() => setShowLedger(false)} />
			</Show>
		</>
	);
};
