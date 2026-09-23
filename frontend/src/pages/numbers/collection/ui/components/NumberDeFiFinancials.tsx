import { type Component } from 'solid-js';
import { isRtl } from '@/shared/i18n/index.js';

interface Props {
	medianFloorTon?: number;
	tonUsdRate?: number;
}

export const NumberDeFiFinancials: Component<Props> = (props) => {
	const floorTon = () => props.medianFloorTon || 75;
	const rate = () => props.tonUsdRate || 5.5;

	// Monthly rental yield based on 54% APY
	const monthlyYieldTon = () => Math.round((floorTon() * 0.54) / 12 * 10) / 10;
	const monthlyYieldUsd = () => Math.round(monthlyYieldTon() * rate());

	// Max borrowing LTV (60%)
	const maxLoanTon = () => Math.round(floorTon() * 0.6);
	const maxLoanUsd = () => Math.round(maxLoanTon() * rate());

	return (
		<div class="bg-gradient-to-br from-[#0e1726] via-[#12141C] to-[#08090D] border border-emerald-500/30 rounded-[28px] p-5 shadow-xl text-start flex flex-col gap-4 relative overflow-hidden mb-4">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
						<span class="material-symbols-outlined text-[20px]">account_balance_wallet</span>
					</div>
					<div class="flex flex-col">
						<h4 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{isRtl() ? 'تراز مالی دیفای و استخر اجاره شماره‌ها' : 'DEFI COLLATERAL & RENTAL YIELD'}
						</h4>
						<span class="text-[9px] font-mono text-white/40">
							{isRtl() ? 'وام‌گیری آن‌چین و درآمد غیرفعال ماهانه' : 'On-chain borrowing capacity & passive rental yield'}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
					DEFI METRICS
				</span>
			</div>

			{/* 2 Core Columns: Rental Yield + Collateral Borrowing */}
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				{/* 1. Rental Yield */}
				<div class="bg-[#08090D] border border-white/5 rounded-[20px] p-4 flex flex-col justify-between gap-2 shadow-inner">
					<div class="flex items-center justify-between">
						<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
							{isRtl() ? 'بازده اجاره ماهانه (Rental Yield)' : 'MONTHLY RENTAL'}
						</span>
						<span class="text-[9px] font-mono font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
							~54.0% APY
						</span>
					</div>

					<div class="flex flex-col gap-0.5">
						<div class="flex items-baseline gap-1.5 font-mono">
							<span class="text-[22px] font-black text-white">~{monthlyYieldTon()}</span>
							<span class="text-[12px] font-bold text-emerald-400">TON / month</span>
						</div>
						<span class="text-[10px] font-mono text-white/40">
							≈ ${monthlyYieldUsd()} USD / {isRtl() ? 'ماه' : 'mo'}
						</span>
					</div>

					<p class="text-[9px] text-white/50 leading-relaxed font-mono">
						{isRtl()
							? 'قابلیت اجاره جهت خطوط رسمی پشتیبانی تلگرام و ربات‌ها'
							: 'Passive cashflow via Telegram official desk rentals'}
					</p>
				</div>

				{/* 2. Collateralized Borrowing LTV */}
				<div class="bg-[#08090D] border border-white/5 rounded-[20px] p-4 flex flex-col justify-between gap-2 shadow-inner">
					<div class="flex items-center justify-between">
						<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
							{isRtl() ? 'سقف وثیقه وام (Max Loan-to-Value)' : 'COLLATERAL LTV'}
						</span>
						<span class="text-[9px] font-mono font-black text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">
							60% LTV
						</span>
					</div>

					<div class="flex flex-col gap-0.5">
						<div class="flex items-baseline gap-1.5 font-mono">
							<span class="text-[22px] font-black text-cyan-300">~{maxLoanTon()}</span>
							<span class="text-[12px] font-bold text-cyan-400">TON Max Loan</span>
						</div>
						<span class="text-[10px] font-mono text-white/40">
							≈ ${maxLoanUsd()} USD {isRtl() ? 'اعتبار نقدی فوری' : 'instant borrowing'}
						</span>
					</div>

					<p class="text-[9px] text-white/50 leading-relaxed font-mono">
						{isRtl()
							? 'امکان دریافت وام بدون فروش شماره با توکن‌های TON / USDT'
							: 'Non-custodial borrowing without parting with NFT ownership'}
					</p>
				</div>
			</div>
		</div>
	);
};
