import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { type DictPaths, locale, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

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
		activeClasses: string;
	}[] = [
		{
			id: 'username',
			icon: 'person_search',
			labelKey: 'action.username.label',
			badge: 'AVM v7.0',
			activeClasses:
				'bg-gradient-to-b from-[#3390ec]/25 via-[#3390ec]/10 to-[#141824] border-[#3390ec]/50 text-white shadow-[0_8px_25px_rgba(51,144,236,0.25)]',
		},
		{
			id: 'collectibles',
			icon: 'tag',
			labelKey: 'action.collectibles.label',
			badge: '+888 No-SIM',
			activeClasses:
				'bg-gradient-to-b from-emerald-500/25 via-emerald-500/10 to-[#141824] border-emerald-400/50 text-white shadow-[0_8px_25px_rgba(16,185,129,0.25)]',
		},
		{
			id: 'gifts',
			icon: 'redeem',
			labelKey: 'action.gifts.label',
			badge: '4-Floor Live',
			activeClasses:
				'bg-gradient-to-b from-purple-500/25 via-amber-500/10 to-[#141824] border-purple-400/50 text-white shadow-[0_8px_25px_rgba(168,85,247,0.25)]',
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
			class={`relative bg-[#080A10] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col items-center px-margin-main z-10 ${
				props.activeTab ? 'pt-5 pb-12' : 'pt-10 pb-20 min-h-[85vh] justify-center'
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

			{/* Hero Heading, Universal Search & Description when on Landing Overview */}
			<Show when={!props.activeTab}>
				<Motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.45, easing: [0.16, 1, 0.3, 1] }}
					class="w-full max-w-[420px] mx-auto text-center mb-7 relative z-20 flex flex-col items-center"
				>
					<div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/10 mb-3.5">
						<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
						<span class="text-[10px] font-black uppercase tracking-[0.22em] text-white/75">
							{t('hero.promoBadge')}
						</span>
					</div>
					<h1 class="text-[28px] sm:text-[34px] font-black tracking-tight leading-[1.3] text-white mb-3">
						{t('hero.title')}
					</h1>
					<p class="text-[13px] sm:text-[14px] text-white/55 font-medium leading-[1.8] max-w-[340px] mb-5">
						{t('hero.description')}
					</p>

					{/* Universal Smart Search Bar */}
					<form
						onSubmit={handleUniversalSubmit}
						class="w-full relative flex items-center bg-[#121622]/95 border border-white/12 focus-within:border-[#0098EA]/60 rounded-[20px] p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.55)] transition-all"
					>
						<div class="px-2.5 flex items-center text-white/40">
							<span class="material-symbols-outlined text-[20px]" aria-hidden="true">
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
							class="flex-1 bg-transparent text-white text-[13px] font-bold placeholder:text-white/35 focus:outline-none px-1 py-2"
						/>
						<Show when={detectedType()}>
							<span
								class={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-[10px] mx-1.5 shrink-0 ${
									detectedType() === 'number'
										? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
										: detectedType() === 'gift'
											? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
											: 'bg-[#0098EA]/20 text-[#38bdf8] border border-[#0098EA]/30'
								}`}
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
							class="px-4 py-2 rounded-[14px] bg-[#0098EA] hover:bg-[#0098EA]/90 text-white text-[12px] font-black tracking-wide active:scale-95 transition-all shrink-0 shadow-[0_4px_14px_rgba(0,152,234,0.4)]"
						>
							{t('hero.smartSearchBtn')}
						</button>
					</form>
				</Motion.div>
			</Show>

			{/* 3-Vertical Category Selector Cards */}
			<Motion.nav
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 0.4 }}
				class="w-full max-w-[420px] grid grid-cols-3 gap-2.5 relative z-20"
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
								class={`flex flex-col justify-between gap-2 rounded-[20px] border p-3.5 min-h-[82px] transition-all duration-300 relative overflow-hidden active:scale-95 ${
									isSelected()
										? tab.activeClasses
										: 'bg-[#141720]/90 border-white/[0.07] text-white/85 hover:bg-white/[0.07] hover:text-white'
								}`}
							>
								<div class="flex items-center justify-between w-full">
									<span class="text-[8px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60">
										{tab.badge}
									</span>
									<span
										class={`material-symbols-outlined shrink-0 transition-all duration-300 ${
											isSelected() ? 'text-[20px] text-white' : 'text-[20px] text-white/65'
										}`}
										style={{
											'font-variation-settings': isSelected() ? '"FILL" 1' : '"FILL" 0',
										}}
										aria-hidden="true"
									>
										{tab.icon}
									</span>
								</div>
								<span class="text-[12px] font-black leading-snug text-start w-full">
									{t(tab.labelKey)}
								</span>
							</button>
						);
					}}
				</For>
			</Motion.nav>

			{/* Helper Prompt Below Category Cards */}
			<Show when={!props.activeTab}>
				<Motion.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.4, delay: 0.1 }}
					class="mt-6 text-[12px] sm:text-[13px] font-semibold text-white/45 text-center relative z-20"
				>
					{t('hero.selectToStart')}
				</Motion.p>
			</Show>
		</div>
	);
};

