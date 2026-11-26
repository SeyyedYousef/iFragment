import { useLocation, useNavigate } from '@solidjs/router';
import { createMutation } from '@tanstack/solid-query';
import { type Component, createSignal, For, onMount, Show } from 'solid-js';
import { giftsApi, type PortfolioScanResponse } from '@/entities/gifts/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { TonAmount, TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';

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
					'Portfolio scan failed.',
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
		const rows = [
			['Gift ID', 'Model', 'Serial', 'Est. TON', 'Est. USD', 'Tier'],
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
		const link = document.createElement('a');
		link.setAttribute('href', encodeURI(csvContent));
		link.setAttribute('download', `telegram_gifts_${username() || 'portfolio'}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	const formatGram = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 1 });
	};

	const formatUsdPlain = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	return (
		<div
			class="frag-canvas pb-32 text-white min-h-screen font-frag-sans relative overflow-x-clip"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => navigate('/gifts')}
					class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
				>
					<TonIcon size={20} color="#4db2ff" />
					<span class="text-[15px] font-bold tracking-[0.04em]" dir="ltr">
						FRAGMENT
					</span>
				</button>

				<Show when={scanResult()}>
					<button
						type="button"
						onClick={exportCSV}
						class="h-8 px-2.5 rounded-[6px] bg-[#293440] hover:bg-[#384553] text-[12px] font-semibold flex items-center gap-1 text-white cursor-pointer"
					>
						<span class="material-symbols-outlined text-[15px] text-[#4db2ff]">download</span>
						<span>{t('gifts.exportCsv')}</span>
					</button>
				</Show>
			</header>

			<div class="max-w-[480px] mx-auto px-4 pt-5 relative z-10 space-y-4">
				<div>
					<h1 class="text-[20px] font-bold text-white tracking-[-0.015em]">
						{t('gifts.portfolioTitle')}
					</h1>
					<p class="text-[12.5px] text-[#8794a1] mt-0.5 leading-snug">
						{t('gifts.portfolioSubtitle')}
					</p>
				</div>

				{/* Search Bar */}
				<div class="bg-[#242e38] rounded-[8px] p-1.5 flex items-center gap-2" dir="ltr">
					<span class="text-[#4db2ff] font-mono text-[15px] font-semibold pl-2.5">@</span>
					<input
						type="text"
						placeholder={t('gifts.usernamePlaceholder') || 'durov or UQBx...'}
						value={username()}
						onInput={(e) => setUsername(e.currentTarget.value)}
						onKeyDown={(e) => e.key === 'Enter' && handleScan()}
						class="flex-1 bg-transparent border-0 text-[13.5px] text-white placeholder-[#8a98a6] outline-none font-mono py-1.5"
					/>
					<button
						type="button"
						onClick={handleScan}
						disabled={scanMutation.isPending}
						class="frag-btn-primary h-9 px-4 rounded-[6px] text-[12.5px] font-semibold disabled:opacity-50 shrink-0 cursor-pointer"
					>
						{scanMutation.isPending ? t('gifts.scanning') : t('gifts.scanButton')}
					</button>
				</div>

				<Show when={errorMsg()}>
					<div class="p-3 rounded-[8px] bg-[#ff5863]/10 text-[12.5px] text-[#ff5863] flex items-center gap-2">
						<span class="material-symbols-outlined text-[16px]">error</span>
						<span>{errorMsg()}</span>
					</div>
				</Show>

				<Show when={scanResult()}>
					{(res) => (
						<div class="space-y-4">
							{/* Summary Strip */}
							<div class="frag-table-container grid grid-cols-3 divide-x divide-[#1a2026]">
								<div class="p-3">
									<span class="text-[11.5px] font-semibold text-[#8c9aa9] block">
										{t('gifts.netWorthLabel')}
									</span>
									<div class="mt-1">
										<TonAmount
											value={formatGram(res().total_portfolio_value_gram)}
											usd={formatUsdPlain(res().total_portfolio_value_usd)}
											size="sm"
											tone="positive"
										/>
									</div>
								</div>
								<div class="p-3">
									<span class="text-[11.5px] font-semibold text-[#8c9aa9] block">
										{t('gifts.totalItems')}
									</span>
									<span class="text-[15px] font-semibold text-white tabular-nums mt-1 block">
										{res().total_gifts_count}
									</span>
								</div>
								<div class="p-3">
									<span class="text-[11.5px] font-semibold text-[#8c9aa9] block">
										{t('fragUi.owner')}
									</span>
									<span
										class="text-[13px] font-mono font-semibold text-[#4db2ff] truncate mt-1 block"
										dir="ltr"
									>
										@{res().username}
									</span>
								</div>
							</div>

							{/* Holdings Table */}
							<div class="frag-table-container">
								<div class="frag-table-header grid grid-cols-12 px-3.5 py-2">
									<span class="col-span-6">{t('gifts.topHoldingsHeading')}</span>
									<span class="col-span-3">{t('fragUi.estValue')}</span>
									<span class="col-span-3 text-end">{t('fragUi.tier')}</span>
								</div>
								<For each={res().top_valued_gifts || []}>
									{(gift) => (
										<button
											type="button"
											onClick={() =>
												navigate(`/gifts/report?g=${encodeURIComponent(gift.gift_id)}`)
											}
											class="frag-table-row w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-start cursor-pointer"
										>
											<div class="col-span-6 min-w-0 pr-2">
												<span class="text-[13px] font-semibold text-white block truncate">
													{gift.model_name} #{gift.serial_number}
												</span>
												<span class="text-[11px] text-[#8c9aa9] font-mono truncate block" dir="ltr">
													{gift.gift_id}
												</span>
											</div>
											<div class="col-span-3">
												<TonAmount
													value={formatGram(gift.estimated_val_gram)}
													usd={formatUsdPlain(gift.estimated_val_usd)}
													size="sm"
												/>
											</div>
											<div class="col-span-3 flex justify-end">
												<span class="px-2 py-0.5 rounded-[4px] bg-[#4db2ff]/10 text-[#4db2ff] text-[11px] font-semibold">
													{gift.rarity_tier}
												</span>
											</div>
										</button>
									)}
								</For>
							</div>
						</div>
					)}
				</Show>
			</div>
		</div>
	);
};
