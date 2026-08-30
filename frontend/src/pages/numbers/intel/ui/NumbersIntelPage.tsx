import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { NumbersChartView } from './components/NumbersChartView.js';
import { NumbersTableView } from './components/NumbersTableView.js';
import { NumbersPortfolioView } from './components/NumbersPortfolioView.js';

export const NumbersIntelPage: Component = () => {
	useTelegramBackButton(-1);
	const navigate = useNavigate();

	const [activeTab, setActiveTab] = createSignal<'chart' | 'numbers' | 'portfolio'>('chart');
	const [listFilterState, setListFilterState] = createSignal<{
		saleType?: '' | 'auction' | 'for_sale' | 'not_for_sale';
		numberType?: '' | 'banned' | 'not_banned';
	}>({});
	const [portfolioTargetAddress, setPortfolioTargetAddress] = createSignal<string>('');

	// Intel / Market overview query
	const intelQuery = createQuery(() => ({
		queryKey: ['numbersIntel'],
		queryFn: () => numbersApi.getIntel(),
		staleTime: 60 * 1000,
	}));

	// Historical Chart data query
	const chartQuery = createQuery(() => ({
		queryKey: ['numbersChartData'],
		queryFn: () => numbersApi.getChartData(),
		staleTime: 5 * 60 * 1000,
	}));

	const intel = () => intelQuery.data;
	const chartData = () => chartQuery.data?.data;

	const formatTon = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	const handleChartQuickFilter = (type: 'auction' | 'for_sale' | 'banned') => {
		try {
			haptic.selection();
		} catch {}
		if (type === 'banned') {
			setListFilterState({ numberType: 'banned', saleType: '' });
		} else {
			setListFilterState({ saleType: type, numberType: '' });
		}
		setActiveTab('numbers');
	};

	const handleViewOwnerPortfolio = (address: string) => {
		try {
			haptic.selection();
		} catch {}
		setPortfolioTargetAddress(address);
		setActiveTab('portfolio');
	};

	return (
		<div class="pb-28 bg-[#06070B] text-white min-h-screen relative font-sans selection:bg-[#0098EA]/30 overflow-x-hidden">
			{/* Ambient background glows matching iFragment palette */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-gradient-to-b from-[#0098EA]/15 via-transparent to-transparent blur-[100px] pointer-events-none z-0" />

			<div class="relative z-10 max-w-[520px] mx-auto px-4 pt-3 space-y-4">
				{/* Top Header Bar */}
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2.5">
						<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0098EA] to-[#0060aa] p-[1px] shadow-lg shadow-[#0098EA]/20 flex items-center justify-center">
							<div class="w-full h-full bg-[#0a0e17] rounded-xl flex items-center justify-center text-base">
								🏴‍☠️
							</div>
						</div>
						<div>
							<h1 class="text-base font-black tracking-tight text-white flex items-center gap-1.5">
								<span>+888 Numbers</span>
								<span class="text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
									TON
								</span>
							</h1>
							<p class="text-[10px] font-semibold text-white/40">Telegram Anonymous Marketplace</p>
						</div>
					</div>

					{/* Live Floor Badge on Top Right */}
					<div class="text-right">
						<div class="text-xs font-black text-white font-mono flex items-center justify-end gap-1">
							<span class="text-[#0098EA] text-[10px]">💎</span>
							<span>{formatTon(intel()?.floor_price_ton || 2179)} TON</span>
						</div>
						<div class="text-[10px] text-white/40 font-mono">
							≈ {formatUsd(intel()?.floor_price_usd || Math.round((intel()?.floor_price_ton || 2179) * 5.5))}
						</div>
					</div>
				</div>

				{/* 3 Main Segmented Tabs: Chart | Numbers | Portfolio */}
				<div class="grid grid-cols-3 bg-[#0d121c] p-1 rounded-2xl border border-white/[0.08] shadow-lg">
					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('chart');
						}}
						class={`py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
							activeTab() === 'chart'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25 scale-[1.02]'
								: 'text-white/50 hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-sm">show_chart</span>
						<span>{t('numbers.tabChart') || 'Chart'}</span>
					</button>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('numbers');
						}}
						class={`py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
							activeTab() === 'numbers'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25 scale-[1.02]'
								: 'text-white/50 hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-sm">format_list_numbered</span>
						<span>{t('numbers.tabNumbers') || 'Numbers'}</span>
					</button>

					<button
						type="button"
						onClick={() => {
							try {
								haptic.selection();
							} catch {}
							setActiveTab('portfolio');
						}}
						class={`py-2 px-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
							activeTab() === 'portfolio'
								? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25 scale-[1.02]'
								: 'text-white/50 hover:text-white'
						}`}
					>
						<span class="material-symbols-outlined text-sm">account_balance_wallet</span>
						<span>{t('numbers.tabPortfolio') || 'Portfolio'}</span>
					</button>
				</div>

				{/* Active View Rendering */}
				<Show when={activeTab() === 'chart'}>
					<NumbersChartView
						intel={intel()}
						chartData={chartData()}
						isLoading={chartQuery.isPending}
						onFilterType={handleChartQuickFilter}
					/>
				</Show>

				<Show when={activeTab() === 'numbers'}>
					<NumbersTableView
						initialFilter={listFilterState()}
						onViewOwnerPortfolio={handleViewOwnerPortfolio}
					/>
				</Show>

				<Show when={activeTab() === 'portfolio'}>
					<NumbersPortfolioView
						initialAddress={portfolioTargetAddress()}
						floorPriceTon={intel()?.floor_price_ton || 2179}
					/>
				</Show>
			</div>
		</div>
	);
};
