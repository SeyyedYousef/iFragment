import { useLocation, useNavigate } from '@solidjs/router';
import { createMutation } from '@tanstack/solid-query';
import { type Component, createSignal, For, onMount, Show } from 'solid-js';
import { giftsApi, type PortfolioScanResponse } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';

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
				'خطا در اسکن پرتفوی. لطفاً یوزرنیم را بررسی کنید.',
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
				'Estimated Value (TON)',
				'Estimated Value (USD)',
				'Rarity Tier',
			],
			...scanResult()!.top_valued_gifts.map((g) => [
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
		<div class="pb-36 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient Light */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#34C759]/20 via-[#0098EA]/10 to-transparent blur-[90px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[480px] mx-auto px-4 pt-4">
				{/* Top Bar */}
				<div class="flex items-center justify-between mb-4">
					<button
						type="button"
						onClick={() => navigate('/gifts/intel')}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white/80 transition-all active:scale-95"
					>
						<span class="material-symbols-outlined text-sm rtl:rotate-180">arrow_back</span>
						<span>{t('gifts.backToIntel')}</span>
					</button>

					<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
						<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
						<span>{t('gifts.portfolio')}</span>
					</div>
				</div>

				<div class="text-center mb-5">
					<div class="w-14 h-14 rounded-3xl bg-gradient-to-tr from-[#34C759] to-[#0098EA] p-[1px] mx-auto mb-2.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
						<div class="w-full h-full bg-[#0d111a] rounded-3xl flex items-center justify-center">
							<span class="material-symbols-outlined text-2xl text-emerald-400">inventory_2</span>
						</div>
					</div>
					<h1 class="text-xl font-black text-white">{t('gifts.scanPortfolio')}</h1>
					<p class="text-xs text-white/50 font-medium mt-1">
						{t('gifts.scanPortfolioDesc')}
					</p>
				</div>

				{/* Search Input */}
				<div
					class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-2.5 mb-4 backdrop-blur-xl shadow-xl flex items-center gap-2"
					dir="ltr"
				>
					<span class="text-[#0098EA] font-bold text-lg pl-3">@</span>
					<input
						type="text"
						placeholder={t('gifts.enterUsername')}
						value={username()}
						onInput={(e) => setUsername(e.currentTarget.value.replace(/^@/, ''))}
						onKeyDown={(e) => e.key === 'Enter' && handleScan()}
						class="flex-1 bg-transparent border-none outline-none text-white text-base font-semibold placeholder:text-white/30"
					/>
					<button
						type="button"
						onClick={handleScan}
						disabled={scanMutation.isPending || !username()}
						class="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all hover:brightness-110"
					>
						<span>{scanMutation.isPending ? t('gifts.unlocking') : t('gifts.scanPortfolio')}</span>
						<span class="material-symbols-outlined text-sm">search</span>
					</button>
				</div>

				<Show when={errorMsg()}>
					<div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 font-medium mb-4 text-center">
						{errorMsg()}
					</div>
				</Show>

				{/* Scan Results */}
				<Show when={scanResult()}>
					{(res) => (
						<div class="space-y-4">
							{/* Portfolio Net Worth Banner */}
							<div class="bg-gradient-to-b from-[#161925] to-[#0d1017] border border-white/15 rounded-[32px] p-6 shadow-2xl relative overflow-hidden">
								<div class="flex items-center justify-between mb-2">
									<span class="text-xs uppercase font-black text-emerald-400 tracking-wider">
										@{res().username}'s {t('gifts.portfolio')}
									</span>
									<button
										type="button"
										onClick={exportCSV}
										class="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white/80 flex items-center gap-1 transition-all active:scale-95"
									>
										<span class="material-symbols-outlined text-xs">download</span>
										<span>{t('gifts.exportCsv')}</span>
									</button>
								</div>

								<div class="my-3">
									<span class="text-3xl font-black text-white font-mono">
										{formatGram(res().total_portfolio_value_gram)}{' '}
										<span class="text-sm font-bold text-[#0098EA]">{t('common.ton')}</span>
									</span>
									<span class="text-sm font-bold text-white/40 block mt-0.5 font-mono">
										({formatUsd(res().total_portfolio_value_usd)})
									</span>
								</div>

								<div class="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.08] text-xs">
									<div>
										<span class="text-[9px] uppercase font-bold text-white/40 block">{t('gifts.items')}</span>
										<span class="font-black text-white">
											{res().total_gifts_count} Collectibles
										</span>
									</div>
									<div>
										<span class="text-[9px] uppercase font-bold text-white/40 block">{t('gifts.invested')}</span>
										<span class="font-black text-white font-mono">
											{formatGram(res().historical_invested_gram)} {t('common.ton')}
										</span>
									</div>
									<div>
										<span class="text-[9px] uppercase font-bold text-white/40 block">
											{t('gifts.pnl')}
										</span>
										<span class="font-black text-emerald-400 font-mono">
											+{res().total_pnl_percent}%
										</span>
									</div>
								</div>
							</div>

							{/* Top Most Valuable Gifts */}
							<div class="bg-[#12141C]/80 border border-white/10 rounded-[28px] p-5 shadow-xl">
								<h3 class="text-xs font-black uppercase text-white/60 mb-3 tracking-wider">
									{t('gifts.topGifts')}
								</h3>
								<div class="space-y-2">
									<For each={res().top_valued_gifts}>
										{(gift) => (
											<div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3 flex items-center justify-between">
												<div>
													<h4 class="font-black text-white text-xs">
														{gift.model_name} #{gift.serial_number}
													</h4>
													<span class="text-[10px] text-emerald-400 font-bold">
														{gift.rarity_tier} Tier
													</span>
												</div>
												<div class="text-right">
													<span class="font-black text-white text-xs block font-mono">
														{formatGram(gift.estimated_val_gram)} {t('common.ton')}
													</span>
													<button
														type="button"
														onClick={() => navigate(gift.report_deep_link)}
														class="text-[10px] text-[#0098EA] font-bold hover:underline"
													>
														{t('gifts.viewReport')}
													</button>
												</div>
											</div>
										)}
									</For>
								</div>
							</div>
						</div>
					)}
				</Show>
			</div>
		</div>
	);
};
