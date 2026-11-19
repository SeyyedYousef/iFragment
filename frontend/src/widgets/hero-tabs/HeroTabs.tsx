import { useNavigate } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { type DictPaths, locale, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';

const isRtl = () => locale() === 'fa';

type TabType = 'username' | 'collectibles' | 'gifts';

interface HeroTabsProps {
	activeTab: TabType | null;
	onTabChange: (tab: TabType) => void;
	onResetTab?: () => void;
	onOpenCreditStore?: () => void;
}

export const HeroTabs: Component<HeroTabsProps> = (props) => {
	const navigate = useNavigate();
	const [quickQuery, setQuickQuery] = createSignal('');

	const detectedType = createMemo<'username' | 'number' | 'gift' | null>(() => {
		const raw = quickQuery().trim();
		if (!raw) return null;
		const digits = raw.replace(/[\s\-+()]/g, '');
		if (raw.startsWith('+888') || (digits.startsWith('888') && /^\d{7,15}$/.test(digits))) {
			return 'number';
		}
		if (
			/t\.me\/nft\//i.test(raw) ||
			/fragment\.com\/gift\//i.test(raw) ||
			/^[a-zA-Z0-9_]+-\d+$/.test(raw) ||
			/#\d+$/.test(raw)
		) {
			return 'gift';
		}
		return 'username';
	});

	const handleUniversalSubmit = (e?: Event) => {
		e?.preventDefault();
		const raw = quickQuery().trim();
		if (!raw) return;
		try {
			haptic.impact('medium');
		} catch {}

		const type = detectedType();
		if (type === 'number') {
			const cleanDigits = raw.replace(/[^\d]/g, '');
			navigate(`/numbers/report?n=${encodeURIComponent(cleanDigits)}`);
			return;
		}
		if (type === 'gift') {
			let slug = raw
				.replace(/^https?:\/\/(www\.)?t\.me\/nft\//i, '')
				.replace(/^https?:\/\/(www\.)?fragment\.com\/gift\//i, '')
				.split('?')[0]
				.trim();
			slug = slug.replace(/\s+#/, '-');
			navigate(`/gifts/report?g=${encodeURIComponent(slug)}`);
			return;
		}
		const cleanUser = raw
			.replace(/^https?:\/\/(www\.)?t\.me\//i, '')
			.replace(/^https?:\/\/(www\.)?fragment\.com\/username\//i, '')
			.replace(/^@/, '')
			.split('/')[0]
			.split('?')[0]
			.trim()
			.toLowerCase();
		if (cleanUser) {
			navigate(`/username?u=${encodeURIComponent(cleanUser)}`);
		}
	};

	const TABS: {
		id: TabType;
		icon: string;
		labelKey: DictPaths;
		sublabel: string;
		marketPath: string;
	}[] = [
		{
			id: 'username',
			icon: 'alternate_email',
			labelKey: 'action.username.label',
			sublabel: '@handle.t.me',
			marketPath: '/collection-info',
		},
		{
			id: 'collectibles',
			icon: 'tag',
			labelKey: 'action.collectibles.label',
			sublabel: '+888 numbers',
			marketPath: '/numbers/intel',
		},
		{
			id: 'gifts',
			icon: 'featured_seasonal_and_gifts',
			labelKey: 'action.gifts.label',
			sublabel: 't.me/nft',
			marketPath: '/gifts/intel',
		},
	];

	const handleTabClick = (tab: (typeof TABS)[number]) => {
		try {
			haptic.impact('light');
		} catch {}
		props.onTabChange(tab.id);
	};

	return (
		<div class="w-full flex flex-col font-frag-sans relative z-10">
			{/* Authentic Fragment.com Top Sticky Bar (.tm-header) */}
			<header class="frag-header sticky top-0 z-40 w-full h-[52px] px-4 flex items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => {
						try {
							haptic.selection();
						} catch {}
						if (props.onResetTab) props.onResetTab();
					}}
					class="flex items-center gap-2 text-white hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
				>
					<TonIcon size={20} color="#4db2ff" />
					<span class="text-[15px] font-bold tracking-[0.04em] text-white" dir="ltr">
						FRAGMENT
					</span>
				</button>

				{/* Horizontal Navigation Tabs (Fragment .tm-header-tabs style) */}
				<div
					class="flex items-center h-full gap-4 overflow-x-auto no-scrollbar"
					role="tablist"
					aria-label={t('heroTabs.analysisCategories')}
				>
					<For each={TABS}>
						{(tab) => {
							const isSelected = () => props.activeTab === tab.id;
							return (
								<button
									type="button"
									role="tab"
									aria-selected={isSelected()}
									aria-label={t(tab.labelKey)}
									onClick={() => handleTabClick(tab)}
									class={`relative h-full px-1 flex items-center text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
										isSelected() ? 'text-white' : 'text-[#cbd7e5]/70 hover:text-white'
									}`}
								>
									<span>{t(tab.labelKey)}</span>
									<Show when={isSelected()}>
										<span
											class="absolute inset-x-0 bottom-0 h-[3px] bg-[#248bda] rounded-t-[3px]"
											aria-hidden="true"
										/>
									</Show>
								</button>
							);
						}}
					</For>
				</div>

				<Show when={props.onOpenCreditStore}>
					<button
						type="button"
						onClick={props.onOpenCreditStore}
						class="h-8 px-2.5 rounded-[8px] bg-[#293440] hover:bg-[#384553] text-white text-[12px] font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
					>
						<span
							class="material-symbols-outlined text-[15px] text-[#ff9953]"
							style={{ 'font-variation-settings': '"FILL" 1' }}
						>
							star
						</span>
						<span class="hidden xs:inline">{t('paywall.credit_unit')}</span>
					</button>
				</Show>
			</header>

			{/* Landing Overview (when no sub-tab is locked open) */}
			<Show when={!props.activeTab}>
				<div class="w-full max-w-[480px] mx-auto px-4 pt-7 pb-10 flex flex-col items-center">
					{/* Centered Fragment Intro (.tm-main-intro) */}
					<div class="w-full text-center mb-5 flex flex-col items-center">
						<h1 class="text-[22px] sm:text-[24px] font-semibold tracking-[-0.015em] leading-[1.25] text-white mb-2">
							{t('hero.title')}
						</h1>
						<p class="text-[13px] text-[#8794a1] font-normal leading-[1.55] max-w-[380px]">
							{t('hero.description')}
						</p>
					</div>

					{/* Universal Smart Search Field — Fragment .tm-search-field (#242e38, 8px radius) */}
					<form
						onSubmit={handleUniversalSubmit}
						class="w-full bg-[#242e38] hover:bg-[#293440] focus-within:bg-[#293440] rounded-[8px] p-1.5 flex items-center gap-1.5 mb-5 transition-colors"
					>
						<div class="pl-2.5 pr-1 flex items-center text-[#8a98a6] shrink-0">
							<span class="material-symbols-outlined text-[19px]" aria-hidden="true">
								search
							</span>
						</div>
						<input
							type="text"
							value={quickQuery()}
							onInput={(e) => setQuickQuery(e.currentTarget.value)}
							placeholder={t('hero.smartSearch')}
							aria-label={t('hero.smartSearch')}
							dir={quickQuery() ? 'ltr' : isRtl() ? 'rtl' : 'ltr'}
							class="flex-1 min-w-0 bg-transparent text-white text-[13.5px] font-semibold placeholder:text-[#8a98a6] placeholder:font-normal focus:outline-none py-1.5 px-1"
							autocomplete="off"
							autocapitalize="off"
							spellcheck={false}
						/>
						<Show when={detectedType()}>
							<span
								class={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-[4px] shrink-0 ${
									detectedType() === 'number'
										? 'bg-[#5aec8c]/10 text-[#5aec8c]'
										: detectedType() === 'gift'
											? 'bg-[#ff9953]/10 text-[#ff9953]'
											: 'bg-[#4db2ff]/10 text-[#4db2ff]'
								}`}
								dir="ltr"
							>
								{detectedType() === 'number'
									? '+888'
									: detectedType() === 'gift'
										? 'GIFT'
										: '@USER'}
							</span>
						</Show>
						<button
							type="submit"
							class="frag-btn-primary px-4 h-9 rounded-[6px] text-[13px] font-semibold shrink-0 cursor-pointer"
						>
							{t('hero.smartSearchBtn')}
						</button>
					</form>

					{/* 3 Minimalist Fragment Vertical Cards (#212a33, 8px radius) */}
					<div class="w-full grid grid-cols-3 gap-2 mb-5">
						<For each={TABS}>
							{(tab) => (
								<button
									type="button"
									onClick={() => handleTabClick(tab)}
									class="frag-card-interactive p-3 flex flex-col items-start justify-between gap-3 min-h-[78px] text-start"
								>
									<div class="w-full flex items-center justify-between">
										<span class="material-symbols-outlined text-[20px] text-[#4db2ff]">
											{tab.icon}
										</span>
										<span class="material-symbols-outlined text-[15px] text-[#8c9aa9] rtl:rotate-180">
											chevron_right
										</span>
									</div>
									<div class="flex flex-col min-w-0 w-full">
										<span class="text-[13px] font-semibold text-white truncate">
											{t(tab.labelKey)}
										</span>
										<span class="text-[11px] text-[#8c9aa9] font-mono truncate" dir="ltr">
											{tab.sublabel}
										</span>
									</div>
								</button>
							)}
						</For>
					</div>

					{/* Fragment Market Directory Table (.tm-table-wrap) */}
					<div class="w-full">
						<div class="flex items-center justify-between px-1 mb-2">
							<h2 class="text-[15px] font-semibold text-white">{t('home.collectionInfo')}</h2>
						</div>
						<div class="frag-table-container divide-y divide-[#1a2026]">
							<button
								type="button"
								onClick={() => navigate('/collection-info')}
								class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
							>
								<div class="flex items-center gap-3 min-w-0">
									<div class="w-8 h-8 rounded-[6px] bg-[#242e38] flex items-center justify-center text-[#4db2ff] font-semibold text-[15px] shrink-0">
										@
									</div>
									<div class="flex flex-col min-w-0">
										<span class="text-[13.5px] font-semibold text-white truncate">
											{t('action.username.label')}
										</span>
										<span class="text-[12px] text-[#8c9aa9] truncate">
											{t('home.collectionInfo')}
										</span>
									</div>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<span class="px-2 py-0.5 rounded-[4px] bg-[#5aec8c]/10 text-[#5aec8c] text-[11px] font-semibold">
										Live
									</span>
									<span class="material-symbols-outlined text-[17px] text-[#8c9aa9] rtl:rotate-180">
										chevron_right
									</span>
								</div>
							</button>

							<button
								type="button"
								onClick={() => navigate('/numbers/intel')}
								class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
							>
								<div class="flex items-center gap-3 min-w-0">
									<div class="w-8 h-8 rounded-[6px] bg-[#242e38] flex items-center justify-center text-[#4db2ff] shrink-0">
										<span class="material-symbols-outlined text-[17px]">tag</span>
									</div>
									<div class="flex flex-col min-w-0">
										<span class="text-[13.5px] font-semibold text-white truncate">
											{t('action.collectibles.label')}
										</span>
										<span class="text-[12px] text-[#8c9aa9] truncate">
											{t('home.numbersIntel')}
										</span>
									</div>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<span class="px-2 py-0.5 rounded-[4px] bg-[#4db2ff]/10 text-[#4db2ff] text-[11px] font-mono font-semibold">
										136,566
									</span>
									<span class="material-symbols-outlined text-[17px] text-[#8c9aa9] rtl:rotate-180">
										chevron_right
									</span>
								</div>
							</button>

							<button
								type="button"
								onClick={() => navigate('/gifts/intel')}
								class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
							>
								<div class="flex items-center gap-3 min-w-0">
									<div class="w-8 h-8 rounded-[6px] bg-[#242e38] flex items-center justify-center text-[#4db2ff] shrink-0">
										<span class="material-symbols-outlined text-[17px]">
											featured_seasonal_and_gifts
										</span>
									</div>
									<div class="flex flex-col min-w-0">
										<span class="text-[13.5px] font-semibold text-white truncate">
											{t('action.gifts.label')}
										</span>
										<span class="text-[12px] text-[#8c9aa9] truncate">{t('home.giftsIntel')}</span>
									</div>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<span class="px-2 py-0.5 rounded-[4px] bg-[#ff9953]/10 text-[#ff9953] text-[11px] font-semibold">
										TEP-62
									</span>
									<span class="material-symbols-outlined text-[17px] text-[#8c9aa9] rtl:rotate-180">
										chevron_right
									</span>
								</div>
							</button>
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
};
