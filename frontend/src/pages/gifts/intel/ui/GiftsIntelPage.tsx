import { createQuery } from '@tanstack/solid-query';
import { type Component, createMemo, createSignal, Show } from 'solid-js';
import { giftsApi } from '@/entities/gifts/index.js';
import { isRtl, locale } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { useTelegramBackButton } from '@/shared/lib/useTelegramBackButton.js';
import { GiftsChartView, type GiftsMainTab } from './components/GiftsChartView.js';

type Lang = 'fa' | 'en' | 'ru' | 'zh';

const PAGE_COPY: Record<
	Lang,
	{
		terminalBadge: string;
		liveOnChainBadge: string;
		title: string;
		subtitle: string;
		tabOverview: string;
		tabCollections: string;
		tabInspector: string;
		tabTape: string;
		syncingLabel: string;
	}
> = {
	fa: {
		terminalBadge: 'ترمینال بازار گیفت تلگرام',
		liveOnChainBadge: 'زنده روی زنجیره TON',
		title: 'نبض بازار گیفت‌ها',
		subtitle:
			'رصد لحظه‌ای کف قیمت ۱۲۲ مجموعه رسمی در Fragment، کاوشگر کمیابی مدل و پس‌زمینه، و نوار زنده معاملات و حراجی‌ها.',
		tabOverview: 'نمای کلی',
		tabCollections: 'کف ۱۲۲ مجموعه',
		tabInspector: 'کاوشگر مجموعه',
		tabTape: 'نوار زنده بازار',
		syncingLabel: 'در حال همگام‌سازی زنده با Fragment و زنجیره TON...',
	},
	en: {
		terminalBadge: 'Telegram Gifts Market Terminal',
		liveOnChainBadge: 'Live on TON Chain',
		title: 'Telegram Gifts Pulse',
		subtitle:
			'Audited real-time Fragment floors across all 122 official collections, on-demand trait rarity inspector & live sniper tape.',
		tabOverview: 'Overview',
		tabCollections: '122 Floors',
		tabInspector: 'Inspector',
		tabTape: 'Live Tape',
		syncingLabel: 'Syncing live Fragment orderbook & TON on-chain telemetry...',
	},
	ru: {
		terminalBadge: 'Терминал подарков Telegram',
		liveOnChainBadge: 'Ончейн TON Live',
		title: 'Пульс рынка подарков',
		subtitle:
			'Реальные флоры Fragment по всем 122 официальным коллекциям, инспектор редкости моделей и живая лента сделок.',
		tabOverview: 'Обзор',
		tabCollections: '122 Флора',
		tabInspector: 'Инспектор',
		tabTape: 'Живая лента',
		syncingLabel: 'Синхронизация с Fragment и блокчейном TON...',
	},
	zh: {
		terminalBadge: 'Telegram 礼物市场终端',
		liveOnChainBadge: 'TON 链上实时数据',
		title: 'Telegram 礼物市场脉搏',
		subtitle: '覆盖全部 122 个官方系列的 Fragment 实时地板价、按需稀有度探测器与全市场实时成交流。',
		tabOverview: '市场总览',
		tabCollections: '122系列榜',
		tabInspector: '深度探测',
		tabTape: '实时磁带',
		syncingLabel: '正在同步 Fragment 实时订单簿与 TON 链上数据...',
	},
};

export const GiftsIntelPage: Component = () => {
	useTelegramBackButton(-1);

	const [activeTab, setActiveTab] = createSignal<GiftsMainTab>('overview');

	const lang = createMemo<Lang>(() => {
		const l = (locale() || 'fa').toLowerCase();
		if (l.startsWith('en')) return 'en';
		if (l.startsWith('ru')) return 'ru';
		if (l.startsWith('zh')) return 'zh';
		return 'fa';
	});
	const copy = () => PAGE_COPY[lang()] || PAGE_COPY.fa;

	const intelQuery = createQuery(() => ({
		queryKey: ['giftsIntel'],
		queryFn: () => giftsApi.getIntel(),
		staleTime: 45 * 1000,
	}));

	const intel = () => intelQuery.data;

	return (
		<div
			class="min-h-screen bg-[#05070C] text-white font-sans selection:bg-[#0098EA]/30 flex flex-col relative pb-36 overflow-x-hidden"
			dir={isRtl() ? 'rtl' : 'ltr'}
		>
			{/* Ambient Dynamic Gradient Glow matching Usernames & Collectible Numbers */}
			<div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[420px] bg-gradient-to-b from-[#0098EA]/20 via-cyan-500/8 to-transparent blur-[110px] pointer-events-none z-0" />

			<div class="w-full max-w-[520px] mx-auto px-4 flex flex-col relative z-10 flex-1">
				{/* ═══════ HEADER (MATCHING USERNAMES & COLLECTIBLE NUMBERS) ═══════ */}
				<div class="flex flex-col items-start pt-5 pb-2 px-0.5">
					<div class="flex items-center justify-between w-full mb-2.5">
						<span class="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#0098EA]">
							<span class="w-1.5 h-1.5 rounded-full bg-[#0098EA] animate-pulse shadow-[0_0_6px_#0098EA]" />
							<span>{copy().terminalBadge}</span>
						</span>

						<div class="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 font-bold">
							<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
							<span>{copy().liveOnChainBadge}</span>
						</div>
					</div>

					<div class="flex items-end justify-between w-full gap-2 mb-1.5">
						<h1 class="text-[24px] sm:text-[26px] font-black tracking-tight text-white leading-tight">
							{copy().title}
						</h1>
						<div class="text-end shrink-0" dir="ltr">
							<div class="text-xs font-black font-mono text-white">
								{intel()?.total_market_cap_usd
									? `~$${(intel()!.total_market_cap_usd / 1e6).toFixed(1)}M Cap`
									: '122 Collections'}
							</div>
							<div class="text-[10px] font-mono text-emerald-400 font-bold">
								{(
									intel()?.total_circulating_gifts ||
									intel()?.total_gifts_minted ||
									1456833
								).toLocaleString()}{' '}
								NFTs
							</div>
						</div>
					</div>

					<p class="text-[12px] text-white/55 leading-relaxed font-medium">{copy().subtitle}</p>

					{/* 4-TAB SEGMENTED NAVIGATION BAR (OVERVIEW | 122 FLOORS | INSPECTOR | LIVE TAPE) */}
					<div class="w-full grid grid-cols-4 gap-1 bg-[#0D111B]/95 border border-white/10 rounded-[18px] p-1.5 mt-4 shadow-xl backdrop-blur-xl">
						{(
							[
								{ id: 'overview', label: copy().tabOverview, icon: 'dashboard' },
								{ id: 'collections', label: copy().tabCollections, icon: 'leaderboard' },
								{ id: 'inspector', label: copy().tabInspector, icon: 'manage_search' },
								{ id: 'tape', label: copy().tabTape, icon: 'bolt' },
							] as const
						).map((tab) => (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.selection();
									} catch {}
									setActiveTab(tab.id);
								}}
								class={`py-2.5 px-1.5 rounded-[13px] text-[10px] sm:text-[11px] font-black transition-all flex items-center justify-center gap-1 ${
									activeTab() === tab.id
										? 'bg-gradient-to-r from-[#0098EA] to-[#0077B8] text-white shadow-lg shadow-[#0098EA]/25'
										: 'text-white/50 hover:text-white/85'
								}`}
							>
								<span class="material-symbols-outlined text-[15px]">{tab.icon}</span>
								<span class="truncate">{tab.label}</span>
							</button>
						))}
					</div>
				</div>

				{/* ═══════ LOADING STATE ═══════ */}
				<Show when={intelQuery.isLoading}>
					<div class="flex flex-col items-center justify-center h-[40vh]">
						<div class="w-11 h-11 border-[3px] border-white/10 border-t-[#0098EA] rounded-full animate-spin mb-4 shadow-[0_0_15px_#0098EA]" />
						<span class="text-[11px] font-mono font-bold tracking-wide text-white/45 animate-pulse">
							{copy().syncingLabel}
						</span>
					</div>
				</Show>

				{/* ═══════ CATEGORIZED TAB VIEWS ═══════ */}
				<Show when={!intelQuery.isLoading}>
					<div class="mt-2">
						<GiftsChartView
							intel={intel()}
							activeTab={activeTab()}
							onTabChange={(tab) => setActiveTab(tab)}
						/>
					</div>
				</Show>
			</div>
		</div>
	);
};
