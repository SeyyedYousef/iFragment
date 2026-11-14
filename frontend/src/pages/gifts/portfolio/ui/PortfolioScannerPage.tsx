import { useLocation, useNavigate } from '@solidjs/router';
import { createMutation } from '@tanstack/solid-query';
import { type Component, createSignal, For, onMount, Show } from 'solid-js';
import { giftsApi, type PortfolioScanResponse } from '@/entities/gifts/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';

export const PortfolioScannerPage: Component = () => {
	useTelegramBackButton(-1);
	const location = useLocation();
	const navigate = useNavigate();

	const [username, setUsername] = createSignal('');
	const [scanResult, setScanResult] = createSignal<PortfolioScanResponse | null>(null);
	const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

	onMount(() => {
		const params = new URLSearchParams(location.search);
		const u = params.get('u') || params.get('address') || params.get('q');
		if (u) {
			setUsername(u);
			scanMutation.mutate(u);
		}
	});

	const scanMutation = createMutation(() => ({
		mutationFn: (targetUser: string) => giftsApi.scanPortfolio(targetUser),
		onSuccess: (data) => {
			try {
				haptic.notify('success');
			} catch {}
			setErrorMsg(null);
			setScanResult(data);
		},
		onError: (err: any) => {
			try {
				haptic.notify('error');
			} catch {}
			setErrorMsg(
				err?.response?.data?.error ||
					err?.response?.data?.message ||
					err?.message ||
					t('common.error') ||
					'Portfolio scan failed. Please verify the username.',
			);
		},
	}));

	const handleScan = () => {
		const u = username().trim();
		if (!u) return;
		try {
			haptic.impact('medium');
		} catch {}
		scanMutation.mutate(u);
	};

	const exportCSV = () => {
		if (!scanResult()) return;
		try {
			haptic.impact('light');
		} catch {}
		const rows = [
			[
				'Gift ID',
				'Model',
				'Serial Number',
				'Estimated Value (GRAM)',
				'Estimated Value (USD)',
				'Rarity Tier',
			],
			...(scanResult()?.top_valued_gifts || []).map((g) => [
				g.gift_id,
				g.model_name,
				g.serial_number,
				g.estimated_val_gram,
				g.estimated_val_usd,
				g.rarity_tier,
			]),
		];
		const csvContent = `data:text/csv;charset=utf-8,${rows.map((e) => e.join(',')).join('\n')}`;
		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute('download', `telegram_gifts_${username() || 'portfolio'}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const formatGram = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	return (
		<div
			class="frag-canvas pb-36 text-[#f3f5f8] min-h-screen font-sans relative overflow-x-clip"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			<div class="max-w-lg mx-auto px-4 pt-3.5 relative z-10">
				{/* Navigation Header */}
				<div class="flex items-center justify-between gap-2 mb-4">
					<button
						type="button"
						onClick={() => navigate('/gifts')}
						class="w-10 h-10 rounded-xl bg-[#1b232d] border border-white/[0.08] flex items-center justify-center text-[#c2cfde] hover:text-white active:scale-95 transition-all"
					>
						<span class="material-symbols-outlined text-[20px]">
							{isRtl() ? 'arrow_forward' : 'arrow_back'}
						</span>
					</button>
					<Show when={scanResult()}>
						<button
							type="button"
							onClick={exportCSV}
							class="frag-btn-secondary px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 text-[#c2cfde]"
						>
							<span class="material-symbols-outlined text-[15px]">download</span>
							{t('gifts.exportCsv')}
						</button>
					</Show>
				</div>

				{/* Header Title */}
				<div class="frag-card-elevated rounded-2xl p-4 mb-4 flex items-center gap-3.5">
					<div class="w-12 h-12 rounded-2xl bg-[#141a22] border border-[#4cd964]/25 flex items-center justify-center shrink-0">
						<span class="material-symbols-outlined text-[24px] text-[#4cd964]">
							account_balance_wallet
						</span>
					</div>
					<div class="min-w-0">
						<h1 class="text-lg font-bold tracking-tight text-white">{t('gifts.portfolioTitle')}</h1>
						<p class="text-[12px] text-[#8ca0b5] mt-0.5 leading-snug">
							{t('gifts.portfolioSubtitle')}
						</p>
					</div>
				</div>

				{/* Search Bar */}
				<div class="frag-card rounded-2xl p-1.5 mb-5 flex items-center gap-2">
					<span class="text-[#5aaeff] font-mono text-sm font-semibold ps-2.5">@</span>
					<input
						type="text"
						dir="ltr"
						placeholder={t('gifts.usernamePlaceholder') || 'e.g. durov or UQBx...'}
						value={username()}
						onInput={(e) => setUsername(e.currentTarget.value)}
						onKeyDown={(e) => e.key === 'Enter' && handleScan()}
						class="flex-1 bg-transparent border-0 text-sm text-white placeholder-[#738598] outline-none font-mono py-2"
					/>
					<button
						type="button"
						onClick={handleScan}
						disabled={scanMutation.isPending}
						class="frag-btn-primary h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50 shrink-0"
					>
						<Show
							when={scanMutation.isPending}
							fallback={
								<>
									<span class="material-symbols-outlined text-[16px]">radar</span>
									{t('gifts.scanButton')}
								</>
							}
						>
							<span class="material-symbols-outlined text-[16px] animate-spin">sync</span>
							{t('gifts.scanning')}
						</Show>
					</button>
				</div>

				{/* Error Alert */}
				<Show when={errorMsg()}>
					<div class="mb-4 p-3.5 rounded-xl bg-[#ff5c6c]/10 border border-[#ff5c6c]/25 text-xs text-[#ff9aa4] flex items-center gap-2">
						<span class="material-symbols-outlined text-[18px] text-[#ff5c6c]">error</span>
						<span>{errorMsg()}</span>
					</div>
				</Show>

				{/* Portfolio Dashboard Result */}
				<Show when={scanResult()}>
					{(res) => (
						<div class="space-y-4">
							{/* Net Worth Hero Banner */}
							<div class="frag-card-elevated rounded-2xl p-5 border-[#4cd964]/20">
								<div class="flex items-center justify-between mb-3">
									<div class="flex items-center gap-2">
										<span class="w-2 h-2 rounded-full bg-[#4cd964]" />
										<span class="text-[11px] font-semibold text-[#4cd964]">
											{res().total_portfolio_value_gram >= 10000
												? 'Whale Tier'
												: res().total_portfolio_value_gram >= 2500
													? 'Shark Tier'
													: res().total_portfolio_value_gram >= 500
														? 'Alpha Collector'
														: 'Collector Tier'}
										</span>
									</div>
									<span dir="ltr" class="text-[11px] font-mono text-[#738598]">
										@{res().username}
									</span>
								</div>

								<div class="mb-4">
									<span class="text-[11px] text-[#8ca0b5] block mb-1">
										{t('gifts.netWorthLabel')}
									</span>
									<div class="flex items-baseline gap-2.5 flex-wrap">
										<span
											dir="ltr"
											class="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono tabular-nums inline-flex items-center gap-1.5"
										>
											<TonIcon class="w-5 h-5" />
											{formatGram(res().total_portfolio_value_gram)} GRAM
										</span>
										<span
											dir="ltr"
											class="text-sm font-semibold text-[#4cd964] font-mono tabular-nums"
										>
											({formatUsd(res().total_portfolio_value_usd)})
										</span>
									</div>
								</div>

								<div class="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06] text-xs">
									<div>
										<span class="text-[10px] text-[#738598] block">{t('gifts.assets')}</span>
										<span class="font-semibold text-white tabular-nums">
											{res().total_gifts_count} Collectibles
										</span>
									</div>
									<div>
										<span class="text-[10px] text-[#738598] block">{t('gifts.invested')}</span>
										<span dir="ltr" class="font-semibold text-white font-mono tabular-nums">
											{formatGram(res().historical_invested_gram)} GRAM
										</span>
									</div>
									<div>
										<span class="text-[10px] text-[#738598] block">{t('gifts.pnl')}</span>
										<span
											dir="ltr"
											class={`font-semibold font-mono tabular-nums ${
												res().total_pnl_percent >= 0 ? 'text-[#4cd964]' : 'text-[#ff5c6c]'
											}`}
										>
											{res().total_pnl_percent >= 0
												? `+${res().total_pnl_percent}`
												: res().total_pnl_percent}
											%
										</span>
									</div>
								</div>
							</div>

							{/* Top Most Valuable Gifts */}
							<div class="frag-card-elevated rounded-2xl p-4">
								<h3 class="text-xs font-semibold text-[#8ca0b5] mb-3">{t('gifts.topGifts')}</h3>
								<div class="space-y-2">
									<For each={res().top_valued_gifts}>
										{(gift) => (
											<div class="frag-inset rounded-xl p-3 flex items-center justify-between gap-2">
												<div class="min-w-0">
													<h4 class="font-semibold text-white text-xs truncate">
														{gift.model_name} #{gift.serial_number}
													</h4>
													<span class="text-[11px] text-[#4cd964] font-medium">
														{gift.rarity_tier} tier
													</span>
												</div>
												<div class="text-end shrink-0">
													<span
														dir="ltr"
														class="font-semibold text-white text-xs block font-mono tabular-nums"
													>
														{formatGram(gift.estimated_val_gram)} GRAM
													</span>
													<button
														type="button"
														onClick={() => navigate(gift.report_deep_link)}
														class="text-[11px] text-[#5aaeff] font-semibold hover:underline"
													>
														{t('gifts.viewReport')}
													</button>
												</div>
											</div>
										)}
									</For>
								</div>
							</div>

							{/* Financial Disclaimer Banner */}
							<div class="p-3.5 rounded-xl bg-[#141a22] border border-white/[0.06] text-[11px] text-[#738598] leading-relaxed text-center space-y-1">
								<div class="flex items-center justify-center gap-1.5 text-[#ffb340] font-semibold text-[11px]">
									<span class="material-symbols-outlined text-sm">info</span>
									<span>
										{t('gifts.financialDisclaimerTitle') || 'Financial & Investment Disclaimer'}
									</span>
								</div>
								<p>
									{t('gifts.financialDisclaimerDesc') ||
										'All estimated valuations and rarity metrics are derived from public on-chain metadata and quantitative models, and do not constitute financial or investment advice.'}
								</p>
							</div>
						</div>
					)}
				</Show>
			</div>
		</div>
	);
};
