import { Motion } from '@motionone/solid';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createEffect, For, Show } from 'solid-js';
import { adsApi } from '@/entities/ads/api/adsApi.js';
import type { AdCampaign } from '@/entities/owner/model/types.js';
import { buildMediaUrl } from '@/shared/api/config.js';
import { type DictPaths, type Locale, locale, setLocale, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { CreditWalletBar } from '@/widgets/paywall/CreditWalletBar.js';

const isRtl = () => locale() === 'fa';

type TabType = 'username' | 'collectibles' | 'gifts';

interface HeroTabsProps {
	activeTab: TabType | null;
	onTabChange: (tab: TabType) => void;
	onOpenCreditStore?: () => void;
}

const LANG_OPTIONS: { code: Locale; label: string }[] = [
	{ code: 'fa', label: 'FA' },
	{ code: 'en', label: 'EN' },
	{ code: 'ru', label: 'RU' },
	{ code: 'zh', label: 'ZH' },
];

export const HeroTabs: Component<HeroTabsProps> = (props) => {
	const TABS: {
		id: TabType;
		icon: string;
		labelKey: DictPaths;
		engineTag: string;
		activeClasses: string;
		dotClass: string;
	}[] = [
		{
			id: 'username',
			icon: 'person_search',
			labelKey: 'action.username.label',
			engineTag: 'AVM v3.0',
			activeClasses:
				'bg-gradient-to-b from-[#3390ec]/25 via-[#3390ec]/10 to-[#141824] border-[#3390ec]/50 text-white shadow-[0_8px_25px_rgba(51,144,236,0.25)]',
			dotClass: 'bg-[#3390ec]',
		},
		{
			id: 'collectibles',
			icon: 'dialpad',
			labelKey: 'action.collectibles.label',
			engineTag: '+888 NV',
			activeClasses:
				'bg-gradient-to-b from-emerald-500/25 via-emerald-500/10 to-[#141824] border-emerald-400/50 text-white shadow-[0_8px_25px_rgba(16,185,129,0.25)]',
			dotClass: 'bg-emerald-400',
		},
		{
			id: 'gifts',
			icon: 'redeem',
			labelKey: 'action.gifts.label',
			engineTag: 'Web3 GV',
			activeClasses:
				'bg-gradient-to-b from-purple-500/25 via-amber-500/10 to-[#141824] border-purple-400/50 text-white shadow-[0_8px_25px_rgba(168,85,247,0.25)]',
			dotClass: 'bg-purple-400',
		},
	];

	const handleTabClick = (tab: (typeof TABS)[number]) => {
		try {
			haptic.impact('light');
		} catch {}
		props.onTabChange(tab.id);
	};

	const handleLangSwitch = (lang: Locale) => {
		try {
			haptic.selection();
		} catch {}
		setLocale(lang);
	};

	const adsQuery = createQuery<AdCampaign[]>(() => ({
		queryKey: ['ads', 'active', 'dashboard_banner'],
		queryFn: () => adsApi.getActiveAds('dashboard_banner'),
		staleTime: 60 * 1000,
	}));

	const activeAd = () => {
		const list = adsQuery.data;
		if (list && list.length > 0) {
			return list[0];
		}
		return null;
	};

	createEffect(() => {
		const ad = activeAd();
		if (ad) {
			adsApi.trackImpression(ad.id);
		}
	});

	const handleAdClick = (ad: AdCampaign) => {
		try {
			haptic.impact('light');
		} catch {}
		adsApi.trackClick(ad.id);
		if (ad.target_url) {
			window.open(ad.target_url, '_blank', 'noopener,noreferrer');
		}
	};

	return (
		<div
			class={`relative bg-[#080A10] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col items-center px-margin-main z-10 ${
				props.activeTab ? 'pt-3 pb-12' : 'pt-6 pb-16 min-h-[85vh]'
			}`}
		>
			{/* Floating Light Orbs (Emerald & Telegram Blue glow) */}
			<div
				class={`orb w-64 h-64 top-0 ${isRtl() ? '-right-24' : '-left-24'} opacity-40 pointer-events-none`}
				style={{
					background:
						'radial-gradient(circle, rgba(16,185,129,0.25) 0%, rgba(6,182,212,0.15) 50%, transparent 70%)',
					animation: 'orb-float-1 12s ease-in-out infinite',
				}}
			/>
			<div
				class={`orb w-48 h-48 top-24 ${isRtl() ? 'left-[-10%]' : 'right-[-10%]'} opacity-30 pointer-events-none`}
				style={{
					background: 'radial-gradient(circle, rgba(0,136,204,0.3) 0%, transparent 70%)',
					animation: 'orb-float-2 15s ease-in-out infinite',
				}}
			/>

			{/* Top Institutional Status Bar: Brand + 4-Language Pill + Live Credit Wallet Bar */}
			<div class="w-full flex flex-col gap-2.5 mb-3.5 relative z-20">
				<div class="w-full flex items-center justify-between gap-2">
					<div class="flex items-center gap-2 min-w-0">
						<div class="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3390ec] to-emerald-500 flex items-center justify-center shadow-[0_4px_15px_rgba(51,144,236,0.35)] shrink-0">
							<span class="material-symbols-outlined text-white text-[18px]">diamond</span>
						</div>
						<div class="min-w-0">
							<div class="flex items-center gap-1.5">
								<span class="text-[14px] font-black tracking-tight text-white truncate">
									iFragment
								</span>
								<span class="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[9px] font-mono font-black text-emerald-300 uppercase">
									v2.0 LIVE
								</span>
							</div>
							<p class="text-[10px] text-white/50 font-semibold truncate">{t('hero.title')}</p>
						</div>
					</div>

					{/* Instant 4-Language Switcher Pill */}
					<div
						class="flex items-center gap-0.5 rounded-xl bg-white/[0.04] border border-white/10 p-0.5 shrink-0"
						dir="ltr"
					>
						<For each={LANG_OPTIONS}>
							{(item) => (
								<button
									type="button"
									onClick={() => handleLangSwitch(item.code)}
									class={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
										locale() === item.code
											? 'bg-[#3390ec] text-white shadow-sm'
											: 'text-white/50 hover:text-white'
									}`}
								>
									{item.label}
								</button>
							)}
						</For>
					</div>
				</div>

				{/* Live Credit Wallet Bar */}
				<CreditWalletBar onOpenStore={props.onOpenCreditStore} />
			</div>

			{/* Active Ad Campaign Banner (if any active ad exists) */}
			<Show when={activeAd()}>
				{(ad) => (
					<div
						role="button"
						tabIndex={0}
						onClick={() => handleAdClick(ad())}
						class="w-full mb-3.5 relative group cursor-pointer active:scale-[0.98] transition-transform select-none z-20"
					>
						<div class="relative overflow-hidden rounded-2xl border border-white/15 bg-black/50 aspect-[28/8] shadow-[0_12px_30px_rgba(0,0,0,0.6)]">
							<img
								src={buildMediaUrl(ad().image_url)}
								alt={ad().title}
								class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
								onError={(e) => {
									e.currentTarget.style.display = 'none';
								}}
							/>
							<div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
							<div class="absolute top-2 start-2 bg-emerald-500/80 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] text-white font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
								<span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
								<span>{t('home.promotion')}</span>
							</div>
							<div class="absolute bottom-2 inset-x-3 flex items-center justify-between pointer-events-none">
								<div class="text-xs font-bold text-white truncate drop-shadow-md max-w-[85%]">
									{ad().title}
								</div>
								<span class="material-symbols-outlined text-white/80 text-sm">open_in_new</span>
							</div>
						</div>
					</div>
				)}
			</Show>

			{/* 3-Vertical Glassmorphic Engine Selector Tabs */}
			<Motion.nav
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 0.4 }}
				class="w-full grid grid-cols-3 gap-2.5 relative z-20"
				role="tablist"
				aria-label={t('heroTabs.analysisCategories')}
			>
				<For each={TABS}>
					{(tab) => {
						const isSelected = () => props.activeTab === tab.id;
						return (
							<button
								type="button"
								onClick={() => handleTabClick(tab)}
								role="tab"
								aria-selected={isSelected()}
								aria-label={t(tab.labelKey)}
								class={`flex flex-col items-center justify-center gap-1 rounded-2xl text-center border px-2 py-2.5 transition-all duration-300 relative overflow-hidden active:scale-95 ${
									isSelected()
										? tab.activeClasses
										: 'bg-white/[0.03] border-white/[0.08] text-[#8e8e93] hover:bg-white/[0.06] hover:text-white'
								}`}
							>
								<div class="flex items-center gap-1.5">
									<span
										class={`material-symbols-outlined transition-all duration-300 ${
											isSelected() ? 'text-[19px] text-white' : 'text-[17px] text-white/60'
										}`}
										style={{
											'font-variation-settings': isSelected() ? '"FILL" 1' : '"FILL" 0',
										}}
										aria-hidden="true"
									>
										{tab.icon}
									</span>
									<span class="text-[12px] font-black tracking-tight truncate max-w-[88px]">
										{t(tab.labelKey)}
									</span>
								</div>

								<div class="flex items-center gap-1">
									<span
										class={`w-1.5 h-1.5 rounded-full ${
											isSelected() ? `${tab.dotClass} animate-pulse` : 'bg-white/20'
										}`}
									/>
									<span class="text-[9px] font-mono font-bold tracking-wider uppercase opacity-75">
										{tab.engineTag}
									</span>
								</div>
							</button>
						);
					}}
				</For>
			</Motion.nav>
		</div>
	);
};
