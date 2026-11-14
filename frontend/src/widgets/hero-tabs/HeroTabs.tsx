import { Motion } from '@motionone/solid';
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
		badge: string;
		activeBorder: string;
		activeBg: string;
		iconColor: string;
		dotColor: string;
	}[] = [
		{
			id: 'username',
			icon: 'alternate_email',
			labelKey: 'action.username.label',
			badge: 'AVM v8.0',
			activeBorder: 'border-[#2990FF]/55',
			activeBg: 'bg-[#2990FF]/[0.11]',
			iconColor: 'text-[#2990FF]',
			dotColor: 'bg-[#2990FF]',
		},
		{
			id: 'collectibles',
			icon: 'tag',
			labelKey: 'action.collectibles.label',
			badge: '+888 No-SIM',
			activeBorder: 'border-[#4cd964]/50',
			activeBg: 'bg-[#4cd964]/[0.09]',
			iconColor: 'text-[#4cd964]',
			dotColor: 'bg-[#4cd964]',
		},
		{
			id: 'gifts',
			icon: 'featured_seasonal_and_gifts',
			labelKey: 'action.gifts.label',
			badge: '4-Floor Live',
			activeBorder: 'border-[#ffb340]/50',
			activeBg: 'bg-[#ffb340]/[0.09]',
			iconColor: 'text-[#ffb340]',
			dotColor: 'bg-[#ffb340]',
		},
	];

	const handleTabClick = (tab: (typeof TABS)[number]) => {
		try {
			haptic.impact('light');
		} catch {}
		props.onTabChange(tab.id);
	};

	return (
		<div
			class={`relative overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col items-center px-4 z-10 font-frag-sans ${
				props.activeTab ? 'pt-4 pb-8' : 'pt-8 pb-16 min-h-[82vh] justify-center'
			}`}
		>
			{/* Hero Heading, Universal Search & Description on Landing Overview */}
			<Show when={!props.activeTab}>
				<Motion.div
					initial={{ opacity: 0, y: 14 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.38, easing: [0.16, 1, 0.3, 1] }}
					class="w-full max-w-[460px] mx-auto text-center mb-6 relative z-20 flex flex-col items-center"
				>
					<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1b232d]/90 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] mb-4">
						<TonIcon size={13} />
						<span class="w-1.5 h-1.5 rounded-full bg-[#4cd964]" aria-hidden="true" />
						<span class="text-[11px] font-medium text-[#c7d0d9]">{t('hero.promoBadge')}</span>
					</div>

					<h1 class="text-[28px] sm:text-[34px] font-semibold tracking-[-0.025em] leading-[1.2] text-white mb-2.5">
						{t('hero.title')}
					</h1>
					<p class="text-[13.5px] sm:text-[14px] text-[#8c9ba5] font-normal leading-[1.65] max-w-[360px] mb-5">
						{t('hero.description')}
					</p>

					{/* Universal Smart Search Bar — Fragment style */}
					<form
						onSubmit={handleUniversalSubmit}
						class="w-full frag-card rounded-[14px] p-1.5 flex items-center gap-1.5 border border-white/[0.09] focus-within:border-[#2990FF]/65 focus-within:ring-2 focus-within:ring-[#2990FF]/15 transition-all"
					>
						<div class="pl-2.5 pr-1 flex items-center text-[#60707c] shrink-0">
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
							class="flex-1 min-w-0 bg-transparent text-white text-[13.5px] font-medium placeholder:text-[#60707c] focus:outline-none py-2 px-1"
							autocomplete="off"
							autocapitalize="off"
							spellcheck={false}
						/>
						<Show when={detectedType()}>
							<span
								class={`text-[10px] font-mono font-semibold px-2 py-1 rounded-[7px] border shrink-0 ${
									detectedType() === 'number'
										? 'bg-[#4cd964]/12 text-[#4cd964] border-[#4cd964]/30'
										: detectedType() === 'gift'
											? 'bg-[#ffb340]/12 text-[#ffb340] border-[#ffb340]/30'
											: 'bg-[#2990FF]/12 text-[#64b5ff] border-[#2990FF]/30'
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
							class="frag-btn-primary px-4 h-9 rounded-[10px] text-[12.5px] font-semibold shrink-0"
						>
							{t('hero.smartSearchBtn')}
						</button>
					</form>
				</Motion.div>
			</Show>

			{/* 3-Pillar Selector Cards */}
			<Motion.nav
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 0.35 }}
				class="w-full max-w-[460px] grid grid-cols-3 gap-2.5 relative z-20"
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
								class={`flex flex-col justify-between gap-2.5 rounded-[14px] border p-3 min-h-[82px] transition-all duration-200 relative overflow-hidden active:scale-[0.97] text-start ${
									isSelected()
										? `${tab.activeBg} ${tab.activeBorder} text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_26px_rgba(0,0,0,0.32)]`
										: 'frag-card text-[#c7d0d9] hover:border-white/[0.16] hover:text-white'
								}`}
							>
								<Show when={isSelected()}>
									<span
										class={`absolute inset-x-3 top-0 h-[2px] rounded-b-full ${tab.dotColor}`}
										aria-hidden="true"
									/>
								</Show>
								<div class="flex items-center justify-between w-full gap-1">
									<span class="text-[9.5px] font-mono font-medium px-1.5 py-0.5 rounded-[6px] bg-[#141a22]/90 border border-white/[0.06] text-[#8c9ba5] truncate">
										{tab.badge}
									</span>
									<span
										class={`material-symbols-outlined shrink-0 text-[19px] transition-colors ${
											isSelected() ? tab.iconColor : 'text-[#8c9ba5]'
										}`}
										style={{
											'font-variation-settings': isSelected() ? '"FILL" 1' : '"FILL" 0',
										}}
										aria-hidden="true"
									>
										{tab.icon}
									</span>
								</div>
								<span class="text-[12.5px] font-semibold leading-snug text-start w-full">
									{t(tab.labelKey)}
								</span>
							</button>
						);
					}}
				</For>
			</Motion.nav>
		</div>
	);
};
