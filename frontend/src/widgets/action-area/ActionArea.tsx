import { useNavigate } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { GiftThumbnail, OFFICIAL_GIFTS_120 } from '@/entities/gifts/index.js';
import { creditsApi } from '@/entities/intel/api/creditsApi.js';
import { numbersApi } from '@/entities/numbers/api/numbersApi.js';
import { formatLiveNumberInput } from '@/entities/numbers/lib/formatNumber.js';
import { useUsernameSearch } from '@/entities/username/model/index.js';
import { getRandomTrending } from '@/entities/username/model/trendingList.js';
import { type DictPaths, t } from '@/shared/i18n/index.js';
import { GIFTS_I18N, layaT } from '@/shared/i18n/laya-i18n.js';
import { haptic } from '@/shared/lib/haptic.js';

interface ActionAreaProps {
	activeTab: 'username' | 'collectibles' | 'gifts';
	onTabChange?: (tab: 'username' | 'collectibles' | 'gifts') => void;
}

const CONTENT: Record<
	ActionAreaProps['activeTab'],
	{
		title: DictPaths;
		description: DictPaths;
		inputPlaceholder: DictPaths;
		analyzeBtn: DictPaths;
	}
> = {
	username: {
		title: 'action.username.title',
		description: 'action.username.description',
		inputPlaceholder: 'action.username.inputPlaceholder',
		analyzeBtn: 'action.username.analyzeBtn',
	},
	collectibles: {
		title: 'action.collectibles.title',
		description: 'action.collectibles.description',
		inputPlaceholder: 'action.collectibles.inputPlaceholder',
		analyzeBtn: 'action.collectibles.analyzeBtn',
	},
	gifts: {
		title: 'action.gifts.title',
		description: 'action.gifts.description',
		inputPlaceholder: 'action.gifts.inputPlaceholder',
		analyzeBtn: 'action.gifts.analyzeBtn',
	},
};

type AnalyzeState = 'idle' | 'loading' | 'success';

interface NumberPatternInfo {
	name: string;
	tier: string;
	subtitle: string;
	rarity: string;
}

interface TrendingPool {
	categoryKey: DictPaths;
	badge: string;
	items: string[];
}

const NUMBER_TRENDING_POOLS: TrendingPool[] = [
	{
		categoryKey: 'numbers.poolRoyal',
		badge: 'ROYAL & GENESIS',
		items: ['+888 8888', '+888 0000 0000', '+888 8000', '+888 0888 8888'],
	},
	{
		categoryKey: 'numbers.poolMirror',
		badge: 'APEX MIRROR',
		items: ['+888 0123 3210', '+888 0990 0990', '+888 0880 0880', '+888 0770 0770'],
	},
	{
		categoryKey: 'numbers.poolLadder',
		badge: 'LADDER RUNS',
		items: ['+888 0123 4567', '+888 0765 4321', '+888 0876 5432', '+888 0987 6543'],
	},
	{
		categoryKey: 'numbers.poolBinary',
		badge: 'BINARY DUAL',
		items: ['+888 0808 0808', '+888 0707 0707', '+888 0202 0202', '+888 0000 2222'],
	},
];

const GIFT_TRENDING_ITEMS = [
	'https://t.me/nft/PlushPepe-1',
	'https://t.me/nft/HeroicHelmet-1',
	'https://t.me/nft/DurovsCap-1',
	'https://t.me/nft/SignetRing-7',
	'https://t.me/nft/SantaHat-1',
];

const GIFT_MODEL_ALIASES: Record<string, string> = {
	durovscap: 'durov-cap',
	durovcap: 'durov-cap',
	durovsblackcap: 'durov-cap',
	goldenstar: 'celestial-star',
	celestialstar: 'celestial-star',
	snoopdogg: 'snoop-dogg',
	snoop: 'snoop-dogg',
	pepe: 'plush-pepe',
	plushpepe: 'plush-pepe',
	swisswatch: 'swiss-watch',
	diamondring: 'diamond-ring',
	santahat: 'santa-hat',
	lunarsnake: 'lunar-snake',
	astralshard: 'astral-shard',
	magicpotion: 'magic-potion',
	scaredcat: 'scared-cat',
	kissedfrog: 'kissed-frog',
	hexpot: 'hex-pot',
	preciouspeach: 'precious-peach',
	minioscar: 'mini-oscar',
	recordplayer: 'record-player',
	signetring: 'signet-ring',
	spicedwine: 'spiced-wine',
};

export const ActionArea: Component<ActionAreaProps> = (props) => {
	const { searchQuery, setSearchQuery, searchError, setSearchError, validate } =
		useUsernameSearch();
	const navigate = useNavigate();
	const [analyzeState, setAnalyzeState] = createSignal<AnalyzeState>('idle');
	const [isFocused, setIsFocused] = createSignal(false);
	const [_credits, setCredits] = createSignal<number>(3);
	const [showNoCreditsModal, setShowNoCreditsModal] = createSignal(false);
	const [showNumberGuide, setShowNumberGuide] = createSignal(false);
	const [serverVerified, setServerVerified] = createSignal<
		import('@/entities/numbers/model/types.js').NumberVerifyResult | null
	>(null);
	const [isVerifying, setIsVerifying] = createSignal(false);
	const [poolIndex, setPoolIndex] = createSignal(0);
	const [isRotating, setIsRotating] = createSignal(false);

	let autoGuideTimeout: any = null;
	let verifyTimeout: any = null;
	let cycleInterval: any = null;

	const [trendingUsernames] = createSignal<string[]>(getRandomTrending(4));

	const isTonWalletAddress = (val: string) => {
		const s = val.trim();
		if (
			(s.startsWith('EQ') || s.startsWith('UQ') || s.startsWith('kQ') || s.startsWith('0Q')) &&
			s.length >= 44 &&
			s.length <= 50
		)
			return true;
		if ((s.startsWith('0:') || s.startsWith('-1:')) && s.length >= 66) return true;
		return false;
	};

	const normalizeGiftInput = (raw: string) => {
		let str = raw
			.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
			.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584))
			.trim();

		str = str
			.replace(/^https?:\/\//i, '')
			.replace(/^tg:\/\/resolve\?domain=nft&appname=[^&]+&apparg=/i, '')
			.replace(/^(?:www\.)?telegram\.me\/nft\//i, '')
			.replace(/^(?:www\.)?t\.me\/nft\//i, '')
			.replace(/^(?:www\.)?t\.me\/gift\//i, '')
			.replace(/^(?:www\.)?fragment\.com\/gift\//i, '')
			.replace(/^(?:www\.)?fragment\.com\/gifts\//i, '')
			.replace(/^(?:www\.)?marketapp\.ws\/gifts\//i, '')
			.replace(/^(?:www\.)?getgems\.io\/collection\/[^/]+\//i, '');

		if (str.includes('?')) str = str.split('?')[0];
		str = str.replace(/\/+$/, '').trim();
		return str;
	};

	const giftsValidation = createMemo(() => {
		const empty = {
			isValid: false,
			title: '',
			subtitle: '',
			slug: '',
			serial: 1,
			tag: '',
		};
		if (props.activeTab !== 'gifts') return empty;
		const raw = searchQuery().trim();
		if (!raw) return empty;
		const clean = normalizeGiftInput(raw);
		if (!clean) return empty;

		let match = clean.match(/^([a-zA-Z0-9_\s'’.-]+?)(?:[-_#\s]+)(\d+)$/);
		if (!match) {
			match = clean.match(/^([a-zA-Z_\s'’]+?)(\d+)$/);
		}

		if (match) {
			const rawModel = match[1].trim();
			const serialNum = parseInt(match[2], 10) || 1;
			const cleanKey = rawModel.toLowerCase().replace(/[^a-z0-9]/g, '');
			const targetAliasSlug = GIFT_MODEL_ALIASES[cleanKey];

			const catalogItem = OFFICIAL_GIFTS_120.find((g) => {
				const gKey = g.slug.replace(/[^a-z0-9]/g, '');
				const nKey = g.name.toLowerCase().replace(/[^a-z0-9]/g, '');
				return (
					gKey === cleanKey ||
					nKey === cleanKey ||
					(targetAliasSlug &&
						(g.slug === targetAliasSlug || gKey === targetAliasSlug.replace(/[^a-z0-9]/g, '')))
				);
			});

			const displayName = catalogItem ? catalogItem.name : rawModel.replace(/[-_]+/g, ' ').trim();
			const resolvedSlug = catalogItem
				? catalogItem.slug
				: targetAliasSlug || rawModel.toLowerCase().replace(/[\s_]+/g, '-');
			const floorTon = catalogItem?.floorTon || 0;
			const supply = catalogItem?.supply || 0;

			let serialTag = 'Verified Gift';
			if (serialNum === 1) serialTag = 'Genesis #1';
			else if (serialNum <= 9) serialTag = `Single Digit #${serialNum}`;
			else if (serialNum <= 99) serialTag = `Double Digit #${serialNum}`;

			const subtitle =
				floorTon > 0
					? `${layaT(GIFTS_I18N.floorPricePrefix)}: ${floorTon.toLocaleString('en-US')} TON · ${layaT(GIFTS_I18N.supplyLabel)}: ${supply.toLocaleString('en-US')}`
					: layaT(GIFTS_I18N.readyToValuate);

			return {
				isValid: true,
				title: `${displayName} #${serialNum}`,
				subtitle,
				slug: `${resolvedSlug}-${serialNum}`,
				serial: serialNum,
				tag: serialTag,
			};
		}

		const cleanColKey = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
		const targetAlias = GIFT_MODEL_ALIASES[cleanColKey];
		const catalogItem = OFFICIAL_GIFTS_120.find((g) => {
			const gKey = g.slug.replace(/[^a-z0-9]/g, '');
			const nKey = g.name.toLowerCase().replace(/[^a-z0-9]/g, '');
			return (
				gKey === cleanColKey ||
				nKey === cleanColKey ||
				(targetAlias && (g.slug === targetAlias || gKey === targetAlias.replace(/[^a-z0-9]/g, '')))
			);
		});

		if (catalogItem) {
			return {
				isValid: true,
				title: `${catalogItem.name} #1`,
				subtitle: `${layaT(GIFTS_I18N.supplyLabel)}: ${catalogItem.supply.toLocaleString('en-US')} · ${layaT(GIFTS_I18N.readyToValuate)}`,
				slug: `${catalogItem.slug}-1`,
				serial: 1,
				tag: 'Collection #1',
			};
		}

		return empty;
	});

	const numbersValidation = createMemo(() => {
		const empty = {
			isValid: false,
			isWallet: false,
			walletAddress: '',
			cleanDigits: '',
			error: null as string | null,
			pattern: null as NumberPatternInfo | null,
		};
		if (props.activeTab !== 'collectibles') return empty;
		const raw = searchQuery().trim();
		if (!raw) return empty;

		if (isTonWalletAddress(raw)) {
			return {
				isValid: true,
				isWallet: true,
				walletAddress: raw,
				cleanDigits: '',
				error: null,
				pattern: {
					name: t('numbers.portfolioTitle') || 'TON Wallet Portfolio',
					tier: 'WALLET',
					subtitle: t('numbers.portfolioDescription') || 'Inspect TON wallet holdings',
					rarity: t('numbers.tabPortfolio') || 'Portfolio',
				},
			};
		}

		const { digits } = formatLiveNumberInput(raw);

		if (/[^\d\s()\-+]/.test(raw)) {
			return { ...empty, cleanDigits: digits, error: t('numbers.errorInvalidChars') };
		}
		if (digits.length > 8) {
			return { ...empty, cleanDigits: digits, error: t('numbers.errorTooLong') };
		}
		const is4DigitGenesis =
			digits.length === 4 && parseInt(digits, 10) >= 8000 && parseInt(digits, 10) <= 8999;
		if (digits.length > 0 && digits.length !== 8 && !is4DigitGenesis) {
			return { ...empty, cleanDigits: digits, error: t('numbers.errorNotMinted') };
		}

		let pattern: NumberPatternInfo = {
			name: t('numbers.patternCollectorName'),
			tier: 'COLLECTOR',
			subtitle: t('numbers.patternCollectorSubtitle'),
			rarity: t('numbers.patternCollectorRarity'),
		};

		if (is4DigitGenesis) {
			pattern = {
				name: t('numbers.patternGenesisName'),
				tier: 'GENESIS 4-DIGIT',
				subtitle: t('numbers.patternGenesisSubtitle'),
				rarity: t('numbers.patternGenesisRarity'),
			};
		} else if (
			/^(.)\1+$/.test(digits) ||
			digits.includes('8888') ||
			digits.includes('7777') ||
			digits.includes('0000')
		) {
			pattern = {
				name: t('numbers.patternGrailName'),
				tier: 'GRAIL',
				subtitle: t('numbers.patternGrailSubtitle'),
				rarity: t('numbers.patternGrailRarity'),
			};
		}

		return {
			isValid: true,
			isWallet: false,
			walletAddress: '',
			cleanDigits: digits,
			error: null,
			pattern,
		};
	});

	const keys = createMemo(() => CONTENT[props.activeTab]);

	onMount(async () => {
		try {
			const creditData = await creditsApi.getCredits();
			setCredits(creditData.balance);
		} catch {}

		try {
			const nIntel = await numbersApi.getIntel();
			if (nIntel.hall_of_fame && nIntel.hall_of_fame.length > 0) {
				NUMBER_TRENDING_POOLS[0].items = nIntel.hall_of_fame
					.slice(0, 4)
					.map((x) => x.display_number);
			}
		} catch {}

		cycleInterval = setInterval(() => {
			if (!isFocused() && !searchQuery() && props.activeTab === 'collectibles') {
				setPoolIndex((prev) => (prev + 1) % NUMBER_TRENDING_POOLS.length);
			}
		}, 8000);
	});

	onCleanup(() => {
		if (cycleInterval) clearInterval(cycleInterval);
		if (autoGuideTimeout) clearTimeout(autoGuideTimeout);
		if (verifyTimeout) clearInterval(verifyTimeout);
	});

	const currentTrendingPool = createMemo(
		() => NUMBER_TRENDING_POOLS[poolIndex() % NUMBER_TRENDING_POOLS.length],
	);

	const trendingItems = createMemo(() => {
		if (props.activeTab === 'collectibles') return currentTrendingPool().items;
		if (props.activeTab === 'gifts') return GIFT_TRENDING_ITEMS;
		return trendingUsernames();
	});

	const handleCycleTrending = () => {
		try {
			haptic.selection();
		} catch {}
		setIsRotating(true);
		if (props.activeTab === 'collectibles') {
			setPoolIndex((prev) => (prev + 1) % NUMBER_TRENDING_POOLS.length);
		}
		setTimeout(() => setIsRotating(false), 450);
	};

	const handleAnalyze = async () => {
		if (analyzeState() !== 'idle') return;

		if (props.activeTab === 'collectibles') {
			const v = numbersValidation();
			if (v.isWallet && v.walletAddress) {
				try {
					haptic.impact('medium');
				} catch {}
				navigate(`/numbers/intel?tab=portfolio&address=${encodeURIComponent(v.walletAddress)}`);
				return;
			}
			if (!v.isValid || !v.cleanDigits) return;
			try {
				haptic.impact('medium');
			} catch {}
			setAnalyzeState('loading');
			navigate(`/numbers/report?n=${encodeURIComponent(`+888${v.cleanDigits}`)}`);
			setAnalyzeState('idle');
			return;
		}

		if (props.activeTab === 'gifts') {
			const v = giftsValidation();
			try {
				haptic.impact('medium');
			} catch {}
			setAnalyzeState('loading');
			if (v.isValid) {
				setAnalyzeState('idle');
				navigate(`/gifts/report?g=${encodeURIComponent(v.slug)}`);
				return;
			}
			const q = searchQuery().trim();
			const clean = normalizeGiftInput(q);
			setAnalyzeState('idle');
			if (clean) {
				navigate(
					`/gifts/report?g=${encodeURIComponent(clean.toLowerCase().replace(/[\s#]+/g, '-'))}`,
				);
			}
			return;
		}

		if (!searchQuery() || searchError()) return;
		try {
			haptic.impact('medium');
		} catch {}
		setAnalyzeState('loading');
		if (validate(searchQuery(), props.activeTab)) {
			setAnalyzeState('idle');
			navigate(`/username/report?u=${encodeURIComponent(searchQuery())}`);
		} else {
			setAnalyzeState('idle');
			try {
				haptic.notify('error');
			} catch {}
		}
	};

	const updateSearchQuery = (val: string) => {
		if (props.activeTab === 'collectibles') {
			if (isTonWalletAddress(val)) {
				setSearchQuery(val.trim());
				if (autoGuideTimeout) clearTimeout(autoGuideTimeout);
				if (verifyTimeout) clearTimeout(verifyTimeout);
				setShowNumberGuide(false);
				setServerVerified(null);
				setIsVerifying(false);
				return;
			}

			const { formatted, digits } = formatLiveNumberInput(val);
			setSearchQuery(formatted);

			if (autoGuideTimeout) clearTimeout(autoGuideTimeout);
			if (verifyTimeout) clearTimeout(verifyTimeout);

			const is4DigitGen =
				digits.length === 4 && parseInt(digits, 10) >= 8000 && parseInt(digits, 10) <= 8999;
			const isFullValid = digits.length === 8 || is4DigitGen;

			if (digits.length > 0) {
				if (!isFullValid) {
					setServerVerified(null);
					setIsVerifying(false);
					autoGuideTimeout = setTimeout(() => {
						setShowNumberGuide(true);
					}, 2500);
				} else {
					setShowNumberGuide(false);
					setIsVerifying(true);
					verifyTimeout = setTimeout(async () => {
						try {
							const res = await numbersApi.verifyNumber(`+888${digits}`);
							setServerVerified(res);
						} catch {
							setServerVerified({
								number: `+888${digits}`,
								display_number:
									'+888 ' +
									(digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits),
								is_minted: isFullValid,
								exists: true,
								tier: numbersValidation().pattern?.tier || 'STANDARD',
								category_club: 'Standard Collection',
								global_rank: 50000,
								teaser_chips: [],
							});
						} finally {
							setIsVerifying(false);
						}
					}, 200);
				}
			} else {
				setShowNumberGuide(false);
				setServerVerified(null);
				setIsVerifying(false);
			}
			return;
		}

		if (props.activeTab === 'gifts') {
			setSearchQuery(val.trim());
			setSearchError(null);
			return;
		}

		const stripped = val.replace(/^[@+]/, '');
		setSearchQuery(stripped);
		if (props.activeTab === 'username') {
			if (stripped.length > 0) {
				validate(stripped, props.activeTab);
			} else {
				setSearchError(null);
			}
		} else {
			setSearchError(null);
		}
	};

	const isAnalyzeDisabled = createMemo(() => {
		if (analyzeState() === 'loading') return true;
		if (props.activeTab === 'collectibles') return !numbersValidation().isValid;
		if (props.activeTab === 'gifts') return !searchQuery().trim();
		return !searchQuery() || Boolean(searchError());
	});

	const getButtonText = () => {
		if (analyzeState() === 'loading') return t('action.analyzing');
		if (analyzeState() === 'success') return t('home.success');
		if (props.activeTab === 'collectibles') {
			const v = numbersValidation();
			if (v.isWallet) return t('numbers.tabPortfolio') || 'Scan Wallet Portfolio';
			return t('action.collectibles.analyzeBtn');
		}
		if (props.activeTab === 'gifts') {
			const v = giftsValidation();
			if (v.isValid && v.title) return `${t('action.gifts.analyzeBtn')} · ${v.title}`;
			return t('action.gifts.analyzeBtn');
		}
		if (props.activeTab === 'username') return t('action.username.analyzeMarketBtn');
		return t(keys().analyzeBtn);
	};

	return (
		<main
			class="action-area w-full relative font-frag-sans pb-16"
			aria-label={t('actionArea.analysisSection')}
		>
			<div class="w-full max-w-[480px] mx-auto pt-7 px-4 flex flex-col">
				{/* Centered Fragment Section Intro (.tm-main-intro) */}
				<div class="text-center w-full mb-5 flex flex-col items-center">
					<h2 class="text-[22px] font-semibold tracking-[-0.015em] leading-[1.25] mb-1.5 text-white">
						{t(keys().title)}
					</h2>
					<p class="text-[#8794a1] text-[13px] font-normal max-w-[380px] leading-[1.55] mx-auto">
						{t(keys().description)}
					</p>
				</div>

				{/* Search Input Field & CTA — Fragment style */}
				<div class="w-full mb-5">
					<div class="bg-[#242e38] hover:bg-[#293440] focus-within:bg-[#293440] w-full rounded-[8px] transition-colors">
						<div class="flex items-center px-3 py-2.5 gap-2" dir="ltr">
							<Show
								when={props.activeTab === 'collectibles'}
								fallback={
									<Show
										when={props.activeTab === 'username'}
										fallback={
											<span class="material-symbols-outlined text-[19px] text-[#8a98a6] select-none">
												search
											</span>
										}
									>
										<span class="text-[18px] font-semibold text-[#4db2ff] select-none">@</span>
									</Show>
								}
							>
								<span class="px-2 py-0.5 rounded-[4px] bg-[#4db2ff]/10 text-[#4db2ff] font-mono font-semibold text-[13px] select-none shrink-0">
									+888
								</span>
							</Show>

							<input
								id="search-input"
								class="flex-1 bg-transparent border-none focus:ring-0 outline-none text-left font-mono text-[15px] font-semibold text-white placeholder:text-[#8a98a6] placeholder:font-normal min-w-0"
								placeholder={
									props.activeTab === 'collectibles'
										? '8888 8888'
										: props.activeTab === 'gifts'
											? 't.me/nft/PlushPepe-1'
											: t(keys().inputPlaceholder)
								}
								value={searchQuery()}
								onInput={(e) => updateSearchQuery(e.currentTarget.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !isAnalyzeDisabled()) {
										e.preventDefault();
										handleAnalyze();
									}
								}}
								onFocus={() => setIsFocused(true)}
								onBlur={() => setIsFocused(false)}
								autocomplete="off"
								autocapitalize="off"
								spellcheck={false}
							/>

							<div class="flex items-center gap-1 shrink-0">
								<button
									type="button"
									onClick={async () => {
										try {
											const text = await navigator.clipboard.readText();
											if (text) {
												updateSearchQuery(text);
												haptic.impact('medium');
											}
										} catch {}
									}}
									class="px-2 py-1 rounded-[4px] bg-[#212a33] hover:bg-[#1a2026] text-[#8c9aa9] hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
									title={t('common.pasteBtn') || t('fragUi.paste')}
								>
									{t('fragUi.paste')}
								</button>

								<Show when={searchQuery()}>
									<button
										type="button"
										onClick={() => {
											setSearchQuery('');
											setShowNumberGuide(false);
											setServerVerified(null);
										}}
										class="w-6 h-6 rounded-[4px] text-[#8c9aa9] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
									>
										<span class="material-symbols-outlined text-[16px]">close</span>
									</button>
								</Show>
							</div>
						</div>

						{/* Validation / Recognition Feedback */}
						<Show when={props.activeTab !== 'collectibles' && searchError()}>
							<div class="px-3 pb-2.5 flex items-center gap-1.5 text-[12px] font-medium text-[#ff5863]">
								<span class="material-symbols-outlined text-[15px]">error</span>
								<span>{searchError()}</span>
							</div>
						</Show>

						<Show when={props.activeTab === 'gifts' && giftsValidation().isValid}>
							<div class="mx-2 mb-2 p-2.5 rounded-[6px] bg-[#212a33] flex items-center justify-between gap-2">
								<div class="flex items-center gap-2.5 min-w-0">
									<div class="w-7 h-7 rounded-[6px] bg-[#242e38] flex items-center justify-center shrink-0 overflow-hidden p-0.5">
										<GiftThumbnail
											slug={giftsValidation().slug.replace(/-\d+$/, '')}
											name={giftsValidation().title}
											class="w-full h-full object-contain"
										/>
									</div>
									<div class="flex flex-col min-w-0">
										<span class="text-[13px] font-semibold text-white truncate">
											{giftsValidation().title}
										</span>
										<span class="text-[11px] text-[#8c9aa9] truncate">
											{giftsValidation().subtitle}
										</span>
									</div>
								</div>
								<span class="text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#5aec8c]/10 text-[#5aec8c] shrink-0">
									{giftsValidation().tag}
								</span>
							</div>
						</Show>

						<Show when={props.activeTab === 'collectibles' && searchQuery().trim().length > 0}>
							<Show when={numbersValidation().error}>
								<div class="px-3 pb-2.5 flex items-center justify-between text-[12px] font-medium text-[#ff5863]">
									<span>{numbersValidation().error}</span>
									<button
										type="button"
										onClick={() => setShowNumberGuide(true)}
										class="text-[11.5px] text-[#4db2ff] hover:underline"
									>
										{t('numbers.formatGuideBtn')}
									</button>
								</div>
							</Show>

							<Show when={!numbersValidation().error && isVerifying()}>
								<div class="px-3 pb-2.5 flex items-center gap-2 text-[12px] text-[#4db2ff]">
									<span class="w-1.5 h-1.5 rounded-full bg-[#4db2ff] animate-pulse" />
									<span>{t('numbers.verifyingStatus')}</span>
								</div>
							</Show>

							<Show
								when={numbersValidation().isValid && !isVerifying() && !serverVerified()?.error}
							>
								<div class="mx-2 mb-2 p-2.5 rounded-[6px] bg-[#212a33] flex items-center justify-between gap-2">
									<div class="flex flex-col min-w-0">
										<span class="text-[13px] font-semibold text-white truncate">
											{numbersValidation().pattern?.name}
										</span>
										<span class="text-[11px] text-[#8c9aa9] truncate">
											{numbersValidation().pattern?.subtitle}
										</span>
									</div>
									<span class="text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#5aec8c]/10 text-[#5aec8c] shrink-0">
										{numbersValidation().pattern?.tier}
									</span>
								</div>
							</Show>
						</Show>
					</div>

					{/* Primary Fragment Blue CTA (#248bda, 8px radius) */}
					<button
						type="button"
						onClick={handleAnalyze}
						disabled={isAnalyzeDisabled()}
						class={`w-full h-11 rounded-[8px] font-semibold text-[14px] flex items-center justify-center gap-2 mt-2.5 transition-colors ${
							analyzeState() === 'success'
								? 'bg-[#5aec8c] text-[#1a2026]'
								: isAnalyzeDisabled()
									? 'bg-[#242e38] text-[#8c9aa9]/50 cursor-not-allowed'
									: 'frag-btn-primary cursor-pointer'
						}`}
					>
						<Show when={analyzeState() === 'loading'}>
							<div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
						</Show>
						<span class="truncate">{getButtonText()}</span>
					</button>
				</div>

				{/* Trending Examples & Quick Directory Links */}
				<div class="w-full mb-4">
					<div class="flex items-center justify-between w-full px-0.5 mb-2">
						<span class="text-[12px] font-semibold text-[#8c9aa9]">
							{t('action.trending.title')}
						</span>
						<Show when={props.activeTab === 'collectibles'}>
							<button
								type="button"
								onClick={handleCycleTrending}
								class="inline-flex items-center gap-1 text-[12px] font-semibold text-[#4db2ff] hover:underline cursor-pointer"
							>
								<span
									class={`material-symbols-outlined text-[14px] transition-transform duration-300 ${
										isRotating() ? 'rotate-180' : ''
									}`}
								>
									cached
								</span>
								<span>{t(currentTrendingPool().categoryKey)}</span>
							</button>
						</Show>
					</div>

					<div class="flex flex-wrap gap-1.5 w-full" dir="ltr">
						<For each={trendingItems()}>
							{(item) => (
								<button
									type="button"
									onClick={() => {
										try {
											haptic.selection();
										} catch {}
										updateSearchQuery(item);
										const el = document.getElementById('search-input');
										if (el) el.focus();
									}}
									class="px-2.5 py-1.5 rounded-[6px] bg-[#212a33] hover:bg-[#293440] text-white text-[12px] font-mono font-medium transition-colors flex items-center gap-1 cursor-pointer"
								>
									<Show when={props.activeTab === 'username'}>
										<span class="text-[#4db2ff]">@</span>
									</Show>
									<Show when={props.activeTab === 'collectibles' && !item.startsWith('+')}>
										<span class="text-[#4db2ff]">+888 </span>
									</Show>
									<span>{item}</span>
								</button>
							)}
						</For>
					</div>
				</div>

				{/* Fragment Market Table Link Row */}
				<div class="frag-table-container mt-1">
					<button
						type="button"
						onClick={() => {
							if (props.activeTab === 'collectibles') {
								navigate('/numbers/intel');
							} else if (props.activeTab === 'gifts') {
								navigate('/gifts/intel');
							} else {
								navigate('/collection-info');
							}
						}}
						class="frag-table-row w-full px-3.5 py-3 flex items-center justify-between gap-3 text-start cursor-pointer"
					>
						<div class="flex items-center gap-2.5 min-w-0">
							<span class="material-symbols-outlined text-[18px] text-[#4db2ff]">table_chart</span>
							<span class="text-[13px] font-semibold text-white truncate">
								{props.activeTab === 'gifts'
									? t('home.giftsIntel')
									: props.activeTab === 'collectibles'
										? t('home.numbersIntel')
										: t('home.collectionInfo')}
							</span>
						</div>
						<span class="material-symbols-outlined text-[17px] text-[#8c9aa9] rtl:rotate-180">
							chevron_right
						</span>
					</button>
				</div>
			</div>

			{/* Number Format Guide Modal */}
			<Show when={showNumberGuide()}>
				<div class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
					<div class="bg-[#212a33] w-full max-w-sm rounded-[12px] p-5 flex flex-col items-center text-center">
						<h3 class="text-[16px] font-semibold text-white mb-1">
							{t('numbers.formatGuideTitle')}
						</h3>
						<p class="text-[12.5px] text-[#8794a1] mb-4 leading-relaxed">
							{t('numbers.formatGuideSubtitle')}
						</p>
						<div class="w-full space-y-1.5 mb-4 text-start font-mono text-[12.5px]" dir="ltr">
							<button
								type="button"
								onClick={() => {
									updateSearchQuery('00000000');
									setShowNumberGuide(false);
								}}
								class="w-full px-3 py-2 rounded-[6px] bg-[#242e38] hover:bg-[#293440] flex items-center justify-between text-white"
							>
								<span>+888 0000 0000</span>
								<span class="text-[11px] text-[#5aec8c] font-frag-sans">
									{t('numbers.formatEightDigits')}
								</span>
							</button>
							<button
								type="button"
								onClick={() => {
									updateSearchQuery('8000');
									setShowNumberGuide(false);
								}}
								class="w-full px-3 py-2 rounded-[6px] bg-[#242e38] hover:bg-[#293440] flex items-center justify-between text-white"
							>
								<span>+888 8000</span>
								<span class="text-[11px] text-[#5aec8c] font-frag-sans">
									{t('numbers.formatFourDigitsGenesis')}
								</span>
							</button>
						</div>
						<button
							type="button"
							onClick={() => setShowNumberGuide(false)}
							class="frag-btn-primary w-full h-10 rounded-[8px] font-semibold text-[13px]"
						>
							{t('common.close')}
						</button>
					</div>
				</div>
			</Show>

			{/* No Credits Modal */}
			<Show when={showNoCreditsModal()}>
				<div class="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/70 backdrop-blur-sm">
					<div class="bg-[#212a33] w-full max-w-sm rounded-[12px] p-5 flex flex-col items-center text-center">
						<h3 class="text-[16px] font-semibold text-white mb-1.5">{t('noCreditsModal.title')}</h3>
						<p class="text-[12.5px] text-[#8794a1] mb-4 leading-relaxed">
							{t('noCreditsModal.description')}
						</p>
						<button
							type="button"
							onClick={() => {
								setShowNoCreditsModal(false);
								navigate('/leaderboard');
							}}
							class="frag-btn-primary w-full h-10 px-4 rounded-[8px] font-semibold text-[13px] mb-2"
						>
							{t('noCreditsModal.earnCredits') || 'Earn free credits'}
						</button>
						<button
							type="button"
							onClick={() => setShowNoCreditsModal(false)}
							class="frag-btn-secondary w-full h-10 px-4 rounded-[8px] font-semibold text-[13px]"
						>
							{t('common.close')}
						</button>
					</div>
				</div>
			</Show>
		</main>
	);
};
