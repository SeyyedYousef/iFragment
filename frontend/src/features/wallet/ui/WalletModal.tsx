import { Component, createSignal, For, Show } from 'solid-js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export interface WalletTransaction {
	id: string;
	title: string;
	amountStr: string;
	type: 'credit_in' | 'credit_out' | 'coin_in' | 'coin_out';
	timestamp: string;
	targetUsername?: string;
}

interface WalletModalProps {
	isOpen: boolean;
	onClose: () => void;
	creditsBalance: number;
	coinsBalance: number;
	onTopUpCredits?: () => void;
}

export const WalletModal: Component<WalletModalProps> = (props) => {
	const [activeTab, setActiveTab] = createSignal<'overview' | 'history'>('overview');

	// Local or cached receipts
	const mockTransactions: WalletTransaction[] = [
		{
			id: 'TX-7841',
			title: 'Airdrop Daily Mining',
			amountStr: '+1,500 Coins',
			type: 'coin_in',
			timestamp: 'Today, 10:30 AM',
		},
		{
			id: 'TX-7629',
			title: 'Intel Report Unlock',
			amountStr: '-15,000 Coins',
			type: 'coin_out',
			timestamp: 'Yesterday',
			targetUsername: '@crypto',
		},
		{
			id: 'TX-7104',
			title: 'Telegram Stars Intel Pack',
			amountStr: '+10 Credits',
			type: 'credit_in',
			timestamp: '3 days ago',
		},
	];

	return (
		<Show when={props.isOpen}>
			<div
				class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md transition-all duration-300 animate-fadeIn"
				dir={isRtl() ? 'rtl' : 'ltr'}
			>
				{/* Backdrop click */}
				<div class="absolute inset-0" onClick={props.onClose} />

				{/* Modal Container */}
				<div class="relative w-full max-w-[440px] max-h-[85vh] bg-[#0c0e14] border border-white/10 rounded-t-[28px] sm:rounded-[28px] overflow-hidden flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-10">
					{/* Header */}
					<div class="flex items-center justify-between p-5 border-b border-white/5 bg-[#12141c]/60 backdrop-blur-xl">
						<div class="flex items-center gap-2.5">
							<div class="w-8 h-8 rounded-full bg-[#0098EA]/20 border border-[#0098EA]/40 flex items-center justify-center text-[#0098EA]">
								<span class="material-symbols-outlined text-[18px]">account_balance_wallet</span>
							</div>
							<div>
								<h3 class="text-[15px] font-black text-white leading-tight">
									{t('wallet.title' as any) || 'Intelligence Vault'}
								</h3>
								<span class="text-[10px] font-mono text-white/40 uppercase tracking-wider">
									iFragment Asset Ledger
								</span>
							</div>
						</div>

						<button
							onClick={props.onClose}
							class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
						>
							<span class="material-symbols-outlined text-[18px]">close</span>
						</button>
					</div>

					{/* Balances Area */}
					<div class="p-5 flex flex-col gap-4 overflow-y-auto">
						<div class="grid grid-cols-2 gap-3">
							{/* Intel Credits Card */}
							<div class="bg-gradient-to-br from-[#0098EA]/20 via-[#12141c] to-[#08090d] border border-[#0098EA]/30 rounded-[20px] p-4 flex flex-col justify-between relative overflow-hidden shadow-inner">
								<div class="flex items-center justify-between mb-2">
									<span class="text-[9px] font-black uppercase tracking-widest text-[#0098EA]">
										INTEL CREDITS
									</span>
									<span class="material-symbols-outlined text-[#0098EA] text-[16px]">token</span>
								</div>
								<div class="text-[26px] font-black font-mono text-white leading-none mb-1">
									{props.creditsBalance}
								</div>
								<span class="text-[10px] text-white/40 font-medium">Never expires (All verticals)</span>
							</div>

							{/* Airdrop Coins Card */}
							<div class="bg-gradient-to-br from-amber-500/15 via-[#12141c] to-[#08090d] border border-amber-500/25 rounded-[20px] p-4 flex flex-col justify-between relative overflow-hidden shadow-inner">
								<div class="flex items-center justify-between mb-2">
									<span class="text-[9px] font-black uppercase tracking-widest text-amber-400">
										AIRDROP COINS
									</span>
									<span class="material-symbols-outlined text-amber-400 text-[16px]">monetization_on</span>
								</div>
								<div class="text-[24px] font-black font-mono text-white leading-none mb-1">
									{props.coinsBalance.toLocaleString()}
								</div>
								<span class="text-[10px] text-amber-400/80 font-medium">30-day dynamic validity</span>
							</div>
						</div>

						{/* Quick Top-up Action */}
						<Show when={props.onTopUpCredits}>
							<button
								onClick={() => {
									haptic.impact('medium');
									props.onClose();
									props.onTopUpCredits?.();
								}}
								class="w-full py-3 bg-[#0098EA] hover:bg-[#0087d0] text-white font-black text-[12px] uppercase tracking-wider rounded-[16px] flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(0,152,234,0.35)] transition-all active:scale-[0.99]"
							>
								<span class="material-symbols-outlined text-[16px]">stars</span>
								<span>Top Up Intel Credits via Stars</span>
							</button>
						</Show>

						{/* Transaction Activity Feed */}
						<div class="flex flex-col gap-2.5 mt-2">
							<div class="flex items-center justify-between px-1">
								<span class="text-[11px] font-black text-white/60 uppercase tracking-widest">
									RECENT ACTIVITY
								</span>
								<span class="text-[10px] font-mono text-white/30">LATEST 3 TRANSACTIONS</span>
							</div>

							<div class="bg-[#12141c]/80 border border-white/5 rounded-[20px] divide-y divide-white/5 overflow-hidden">
								<For each={mockTransactions}>
									{(tx) => (
										<div class="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
											<div class="flex items-center gap-3">
												<div
													class={`w-8 h-8 rounded-full flex items-center justify-center ${
														tx.type.includes('in')
															? 'bg-emerald-500/15 text-emerald-400'
															: 'bg-white/5 text-white/60'
													}`}
												>
													<span class="material-symbols-outlined text-[16px]">
														{tx.type.includes('in') ? 'arrow_downward' : 'receipt_long'}
													</span>
												</div>
												<div class="flex flex-col text-start">
													<span class="text-[12px] font-bold text-white leading-tight">
														{tx.title}
													</span>
													<span class="text-[10px] font-mono text-white/40">{tx.timestamp}</span>
												</div>
											</div>

											<div class="flex flex-col items-end">
												<span
													class={`text-[12px] font-mono font-black ${
														tx.type.includes('in') ? 'text-emerald-400' : 'text-white/80'
													}`}
												>
													{tx.amountStr}
												</span>
												<span class="text-[9px] font-mono text-white/30">{tx.id}</span>
											</div>
										</div>
									)}
								</For>
							</div>
						</div>
					</div>
				</div>
			</div>
		</Show>
	);
};
