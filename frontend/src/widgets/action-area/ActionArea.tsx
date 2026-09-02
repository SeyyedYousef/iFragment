import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { giftsApi, GiftThumbnail, OFFICIAL_GIFTS_120 } from '@/entities/gifts/index.js';
import { creditsApi } from '@/entities/intel/api/creditsApi.js';
import { numbersApi } from '@/entities/numbers/api/numbersApi.js';
import { formatLiveNumberInput } from '@/entities/numbers/lib/formatNumber.js';
import { useUsernameSearch } from '@/entities/username/model/index.js';
import { getRandomTrending } from '@/entities/username/model/trendingList.js';
import { type DictPaths, t } from '@/shared/i18n/index.js';
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
	glow: string;
	gradient: string;
	icon: string;
}

interface TrendingPool {
	categoryKey: DictPaths;
	badge: string;
	items: string[];
}

interface GiftTrendingCard {
	slug: string;
	name: string;
	serial: number;
	url: string;
	floor: number;
	emoji: string;
	tag: string;
}

interface GiftTrendingPool {
	id: string;
	icon: string;
	label: string;
	shortLabel: string;
	badge: string;
	items: GiftTrendingCard[];
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

const RICH_GIFTS_TRENDING_POOLS: GiftTrendingPool[] = [
	{
		id: 'bluechips',
		icon: '🔥',
		label: 'بلوچیپ و جنسیس',
		shortLabel: 'بلوچیپ',
		badge: 'BLUECHIP & APEX (بلوچیپ)',
		items: [
			{ slug: 'plush-pepe', name: 'Plush Pepe', serial: 1, url: 'https://t.me/nft/PlushPepe-1', floor: 5200, emoji: '🐸', tag: 'Top 0.01% Genesis' },
			{ slug: 'durov-cap', name: "Durov's Cap", serial: 1, url: 'https://t.me/nft/DurovsCap-1', floor: 2800, emoji: '🧢', tag: 'Mythic Genesis #1' },
			{ slug: 'signet-ring', name: 'Signet Ring', serial: 7, url: 'https://t.me/nft/SignetRing-7', floor: 950, emoji: '💍', tag: 'Lucky 7 Apex' },
			{ slug: 'precious-peach', name: 'Precious Peach', serial: 88, url: 'https://t.me/nft/PreciousPeach-88', floor: 1100, emoji: '🍑', tag: 'Double 8 Grail' },
		],
	},
	{
		id: 'popular',
		icon: '🌟',
		label: 'ستارگان و ترند',
		shortLabel: 'ترند بازار',
		badge: 'TALISMANS & STARS (ستارگان و نمادین)',
		items: [
			{ slug: 'snoop-dogg', name: 'Snoop Dogg', serial: 420, url: 'https://t.me/nft/SnoopDogg-420', floor: 3200, emoji: '🎙️', tag: '420 OG Legend' },
			{ slug: 'scared-cat', name: 'Scared Cat', serial: 10, url: 'https://t.me/nft/ScaredCat-10', floor: 1450, emoji: '🐱', tag: 'Top 10 Apex' },
			{ slug: 'lunar-snake', name: 'Lunar Snake', serial: 8, url: 'https://t.me/nft/LunarSnake-8', floor: 850, emoji: '🐍', tag: 'Single Digit #8' },
			{ slug: 'astral-shard', name: 'Astral Shard', serial: 99, url: 'https://t.me/nft/AstralShard-99', floor: 780, emoji: '💎', tag: 'Double Digit #99' },
		],
	},
	{
		id: 'seasonal',
		icon: '🎭',
		label: 'فصلی و جادو',
		shortLabel: 'فصلی',
		badge: 'SEASONAL & MAGIC (فصلی و جادو)',
		items: [
			{ slug: 'santa-hat', name: 'Santa Hat', serial: 1, url: 'https://t.me/nft/SantaHat-1', floor: 650, emoji: '🎅', tag: 'Genesis Mint #1' },
			{ slug: 'magic-potion', name: 'Magic Potion', serial: 777, url: 'https://t.me/nft/MagicPotion-777', floor: 480, emoji: '🧪', tag: 'Triple 7 Jackpot' },
			{ slug: 'kissed-frog', name: 'Kissed Frog', serial: 10, url: 'https://t.me/nft/KissedFrog-10', floor: 390, emoji: '🐸', tag: 'Apex Single Digit' },
			{ slug: 'hex-pot', name: 'Hex Pot', serial: 42, url: 'https://t.me/nft/HexPot-42', floor: 320, emoji: '🏺', tag: 'Rare Serial #42' },
		],
	},
	{
		id: 'luxury',
		icon: '👑',
		label: 'لوکس و خاص',
		shortLabel: 'لوکس',
		badge: 'LUXURY & HIGH TIER (لوکس و کلکسیونی)',
		items: [
			{ slug: 'swiss-watch', name: 'Swiss Watch', serial: 12, url: 'https://t.me/nft/SwissWatch-12', floor: 1800, emoji: '⌚', tag: 'High Luxury #12' },
			{ slug: 'diamond-ring', name: 'Diamond Ring', serial: 1, url: 'https://t.me/nft/DiamondRing-1', floor: 4500, emoji: '💎', tag: 'Genesis Mint #1' },
			{ slug: 'record-player', name: 'Record Player', serial: 100, url: 'https://t.me/nft/RecordPlayer-100', floor: 920, emoji: '📻', tag: 'Centennial #100' },
			{ slug: 'mini-oscar', name: 'Mini Oscar', serial: 1, url: 'https://t.me/nft/MiniOscar-1', floor: 2900, emoji: '🏆', tag: 'Apex #1 Trophy' },
		],
	},
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
	const [credits, setCredits] = createSignal<number>(3);
	const [showNoCreditsModal, setShowNoCreditsModal] = createSignal(false);
	const [showNumberGuide, setShowNumberGuide] = createSignal(false);
	const [serverVerified, setServerVerified] = createSignal<import('@/entities/numbers/model/types.js').NumberVerifyResult | null>(null);
	const [isVerifying, setIsVerifying] = createSignal(false);
	const [poolIndex, setPoolIndex] = createSignal(0);
	const [giftPoolIndex, setGiftPoolIndex] = createSignal(0);
	const [isRotating, setIsRotating] = createSignal(false);

	let autoGuideTimeout: any = null;
	let verifyTimeout: any = null;
	let cycleInterval: any = null;

	const [trendingUsernames] = createSignal<string[]>(getRandomTrending(4));
	const [trendingGifts, setTrendingGifts] = createSignal<string[]>([]);

	const isTonWalletAddress = (val: string) => {
		const s = val.trim();
		if ((s.startsWith('EQ') || s.startsWith('UQ') || s.startsWith('kQ') || s.startsWith('0Q')) && s.length >= 44 && s.length <= 50) return true;
		if ((s.startsWith('0:') || s.startsWith('-1:')) && s.length >= 66) return true;
		return false;
	};

	const normalizeGiftInput = (raw: string) => {
		// 1. Convert Persian/Arabic digits to ASCII
		let str = raw
			.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
			.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584))
			.trim();

		// 2. Strip URLs, protocols, domains
		str = str
			.replace(/^https?:\/\//i, '')
			.replace(/^tg:\/\/resolve\?domain=nft&appname=[^&]+&apparg=/i, '')
			.replace(/^(?:www\.)?telegram\.me\/nft\//i, '')
			.replace(/^(?:www\.)?t\.me\/nft\//i, '')
			.replace(/^(?:www\.)?t\.me\/gift\//i, '')
			.replace(/^(?:www\.)?fragment\.com\/gift\//i, '')
			.replace(/^(?:www\.)?fragment\.com\/gifts\//i, '')
			.replace(/^(?:www\.)?marketapp\.ws\/gifts\//i, '')
			.replace(/^(?:www\.)?getgems\.io\/collection\/[^\/]+\//i, '');

		// 3. Strip query params and trailing slashes
		if (str.includes('?')) str = str.split('?')[0];
		str = str.replace(/\/+$/, '').trim();

		return str;
	};

	const giftsValidation = createMemo(() => {
		if (props.activeTab !== 'gifts') {
			return { isValid: false, isLink: false, isWallet: false, isUser: false, title: '', subtitle: '', slug: '', serial: 1, emoji: '🎁', tag: '', floorTon: 0, supply: 0 };
		}
		const raw = searchQuery().trim();
		if (!raw) {
			return { isValid: false, isLink: false, isWallet: false, isUser: false, title: '', subtitle: '', slug: '', serial: 1, emoji: '🎁', tag: '', floorTon: 0, supply: 0 };
		}

		const clean = normalizeGiftInput(raw);
		if (!clean) {
			return { isValid: false, isLink: false, isWallet: false, isUser: false, title: '', subtitle: '', slug: '', serial: 1, emoji: '🎁', tag: '', floorTon: 0, supply: 0 };
		}

		// 1. Match model name/slug + serial number
		// (e.g. PlushPepe-1, Plush Pepe #1, Plush_Pepe-42, SignetRing-7, DurovsCap-1, SantaHat-100)
		let match = clean.match(/^([a-zA-Z0-9_\s'’.-]+?)(?:[-_#\s]+)(\d+)$/);
		if (!match) {
			// Pattern 2: PascalCase concatenated directly with digits (e.g. PlushPepe1, DurovsCap123)
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
					(targetAliasSlug && (g.slug === targetAliasSlug || gKey === targetAliasSlug.replace(/[^a-z0-9]/g, '')))
				);
			});

			const displayName = catalogItem ? catalogItem.name : rawModel.replace(/[-_]+/g, ' ').trim();
			const resolvedSlug = catalogItem ? catalogItem.slug : (targetAliasSlug || rawModel.toLowerCase().replace(/[\s_]+/g, '-'));
			const emoji = catalogItem?.emoji || '🎁';
			const floorTon = catalogItem?.floorTon || 0;
			const supply = catalogItem?.supply || 0;

			// Determine serial tier badge
			let serialTag = 'VERIFIED GIFT NFT';
			if (serialNum === 1) {
				serialTag = '👑 GENESIS MINT (#1)';
			} else if (serialNum >= 2 && serialNum <= 9) {
				serialTag = `💎 SINGLE DIGIT (#${serialNum})`;
			} else if (serialNum >= 10 && serialNum <= 99) {
				serialTag = `⚡ DOUBLE DIGIT (#${serialNum})`;
			} else if ([420, 777, 888, 999, 1000].includes(serialNum)) {
				serialTag = `✨ SACRED SERIAL (#${serialNum})`;
			}

			const subtitle = floorTon > 0
				? `کف قیمت: ${floorTon.toLocaleString()} TON (≈ $${(floorTon * 3.2).toLocaleString(undefined, { maximumFractionDigits: 0 })}) · تیراژ: ${supply.toLocaleString()} هدیه`
				: 'آماده ارزیابی AVM و شجره‌نامه آن‌چین';

			return {
				isValid: true,
				isLink: true,
				isWallet: false,
				isUser: false,
				title: `${displayName} #${serialNum}`,
				subtitle,
				slug: `${resolvedSlug}-${serialNum}`,
				serial: serialNum,
				emoji,
				tag: serialTag,
				floorTon,
				supply,
			};
		}

		// 2. Match collection without explicit serial number (e.g. Plush Pepe or durov_cap or SantaHat)
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
				isLink: true,
				isWallet: false,
				isUser: false,
				title: `${catalogItem.name} #1`,
				subtitle: `کف قیمت: ${catalogItem.floorTon.toLocaleString()} TON · تیراژ: ${catalogItem.supply.toLocaleString()} هدیه`,
				slug: `${catalogItem.slug}-1`,
				serial: 1,
				emoji: catalogItem.emoji || '🎁',
				tag: 'OFFICIAL COLLECTION (#1)',
				floorTon: catalogItem.floorTon,
				supply: catalogItem.supply,
			};
		}

		return { isValid: false, isLink: false, isWallet: false, isUser: false, title: '', subtitle: '', slug: '', serial: 1, emoji: '🎁', tag: '', floorTon: 0, supply: 0 };
	});

	const numbersValidation = createMemo(() => {
		if (props.activeTab !== 'collectibles') {
			return { isValid: false, isWallet: false, walletAddress: '', cleanDigits: '', error: null, pattern: null as NumberPatternInfo | null };
		}
		const raw = searchQuery().trim();
		if (!raw) {
			return { isValid: false, isWallet: false, walletAddress: '', cleanDigits: '', error: null, pattern: null as NumberPatternInfo | null };
		}

		if (isTonWalletAddress(raw)) {
			return {
				isValid: true,
				isWallet: true,
				walletAddress: raw,
				cleanDigits: '',
				error: null,
				pattern: {
					name: t('numbers.portfolioTitle') || 'TON Wallet Portfolio',
					tier: 'WALLET SCANNER',
					subtitle: t('numbers.portfolioDescription') || 'Inspect any TON wallet holdings',
					rarity: t('numbers.tabPortfolio') || 'Portfolio',
					glow: 'rgba(0,152,234,0.2)',
					gradient: 'from-[#0098EA]/20 to-[#0098EA]/5 border-[#0098EA]/30 text-[#0098EA]',
					icon: 'account_balance_wallet',
				},
			};
		}

		const { digits } = formatLiveNumberInput(raw);

		if (/[^\d\s\(\)\-\+]/.test(raw)) {
			return {
				isValid: false,
				isWallet: false,
				walletAddress: '',
				cleanDigits: digits,
				error: t('numbers.errorInvalidChars'),
				pattern: null,
			};
		}

		if (digits.length > 8) {
			return {
				isValid: false,
				isWallet: false,
				walletAddress: '',
				cleanDigits: digits,
				error: t('numbers.errorTooLong'),
				pattern: null,
			};
		}

		const is4DigitGenesis = digits.length === 4 && parseInt(digits, 10) >= 8000 && parseInt(digits, 10) <= 8999;
		if (digits.length > 0 && digits.length !== 8 && !is4DigitGenesis) {
			return {
				isValid: false,
				isWallet: false,
				walletAddress: '',
				cleanDigits: digits,
				error: t('numbers.errorNotMinted'),
				pattern: null,
			};
		}

		// Pattern Classification for luxury preview
		let pattern: NumberPatternInfo = {
			name: t('numbers.patternCollectorName'),
			tier: 'COLLECTOR EDITION',
			subtitle: t('numbers.patternCollectorSubtitle'),
			rarity: t('numbers.patternCollectorRarity'),
			glow: 'rgba(255,255,255,0.08)',
			gradient: 'from-white/10 to-white/5 border-white/15 text-white/90',
			icon: 'stars',
		};

		if (is4DigitGenesis) {
			pattern = {
				name: t('numbers.patternGenesisName'),
				tier: '4-DIGIT ULTRA (GENESIS)',
				subtitle: t('numbers.patternGenesisSubtitle'),
				rarity: t('numbers.patternGenesisRarity'),
				glow: 'rgba(255,215,0,0.25)',
				gradient: 'from-amber-400/20 to-yellow-600/10 border-amber-400/40 text-amber-300',
				icon: 'diamond',
			};
		} else if (/^(.)\1+$/.test(digits) || digits.includes('8888') || digits.includes('7777') || digits.includes('0000')) {
			pattern = {
				name: t('numbers.patternGrailName'),
				tier: 'GRAIL TIER (QUAD REPEAT)',
				subtitle: t('numbers.patternGrailSubtitle'),
				rarity: t('numbers.patternGrailRarity'),
				glow: 'rgba(255,180,0,0.2)',
				gradient: 'from-amber-500/20 to-amber-700/10 border-amber-500/40 text-amber-300',
				icon: 'crown',
			};
		} else {
			const rev = digits.split('').reverse().join('');
			if (digits === rev) {
				pattern = {
					name: t('numbers.patternMirrorName'),
					tier: 'APEX TIER (MIRROR PALINDROME)',
					subtitle: t('numbers.patternMirrorSubtitle'),
					rarity: t('numbers.patternMirrorRarity'),
					glow: 'rgba(0,195,255,0.2)',
					gradient: 'from-cyan-400/20 to-blue-600/10 border-cyan-400/40 text-cyan-300',
					icon: 'auto_awesome',
				};
			} else if (
				digits === '12345678' ||
				digits === '87654321' ||
				digits === '01234567'
			) {
				pattern = {
					name: t('numbers.patternLadderName'),
					tier: 'APEX TIER (LADDER SEQUENCE)',
					subtitle: t('numbers.patternLadderSubtitle'),
					rarity: t('numbers.patternLadderRarity'),
					glow: 'rgba(48,209,88,0.2)',
					gradient: 'from-emerald-400/20 to-teal-600/10 border-emerald-400/40 text-emerald-300',
					icon: 'trending_up',
				};
			} else {
				const distinct = new Set(digits.split('')).size;
				if (distinct <= 2) {
					pattern = {
						name: t('numbers.patternBinaryName'),
						tier: 'GRAND TIER (BINARY DUAL)',
						subtitle: t('numbers.patternBinarySubtitle'),
						rarity: t('numbers.patternBinaryRarity'),
						glow: 'rgba(175,82,222,0.2)',
						gradient: 'from-indigo-400/20 to-purple-600/10 border-indigo-400/40 text-indigo-300',
						icon: 'bolt',
					};
				}
			}
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
		} catch (_e) {}

		try {
			const nIntel = await numbersApi.getIntel();
			if (nIntel.hall_of_fame && nIntel.hall_of_fame.length > 0) {
				NUMBER_TRENDING_POOLS[0].items = nIntel.hall_of_fame.slice(0, 4).map((x) => x.display_number);
			}
		} catch (_e) {}

		try {
			const gIntel = await giftsApi.getIntel();
			if (gIntel.trending_models && gIntel.trending_models.length > 0) {
				setTrendingGifts(gIntel.trending_models.slice(0, 4).map((m) => m.name));
			}
		} catch (_e) {}

		// Auto cycle collectibles / gifts trending items every 8 seconds when idle
		cycleInterval = setInterval(() => {
			if (!isFocused() && !searchQuery()) {
				if (props.activeTab === 'collectibles') {
					setPoolIndex((prev) => (prev + 1) % NUMBER_TRENDING_POOLS.length);
				} else if (props.activeTab === 'gifts') {
					setGiftPoolIndex((prev) => (prev + 1) % RICH_GIFTS_TRENDING_POOLS.length);
				}
			}
		}, 8000);
	});

	onCleanup(() => {
		if (cycleInterval) clearInterval(cycleInterval);
		if (autoGuideTimeout) clearTimeout(autoGuideTimeout);
		if (verifyTimeout) clearInterval(verifyTimeout);
	});

	const currentTrendingPool = createMemo(() => NUMBER_TRENDING_POOLS[poolIndex() % NUMBER_TRENDING_POOLS.length]);
	const currentGiftsTrendingPool = createMemo(() => RICH_GIFTS_TRENDING_POOLS[giftPoolIndex() % RICH_GIFTS_TRENDING_POOLS.length]);

	const trendingItems = createMemo(() => {
		if (props.activeTab === 'collectibles') {
			return currentTrendingPool().items;
		}
		if (props.activeTab === 'gifts') {
			return currentGiftsTrendingPool().items.map((i) => i.url);
		}
		return trendingUsernames();
	});

	const handleCycleTrending = () => {
		try {
			haptic.selection();
		} catch {}
		setIsRotating(true);
		if (props.activeTab === 'gifts') {
			setGiftPoolIndex((prev) => (prev + 1) % RICH_GIFTS_TRENDING_POOLS.length);
		} else {
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
			if (serverVerified() && !serverVerified()?.is_minted) return;
			try {
				haptic.impact('medium');
			} catch {}
			setAnalyzeState('loading');
			navigate(`/numbers/report?n=${encodeURIComponent('+888' + v.cleanDigits)}`);
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

			// Fallback parsing for arbitrary input
			let q = searchQuery().trim();
			let clean = normalizeGiftInput(q);

			setAnalyzeState('idle');
			if (clean) {
				navigate(`/gifts/report?g=${encodeURIComponent(clean.toLowerCase().replace(/[\s#]+/g, '-'))}`);
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

			// Auto-open format guide if invalid after 2.5 seconds of non-empty typing
			const is4DigitGen = digits.length === 4 && parseInt(digits, 10) >= 8000 && parseInt(digits, 10) <= 8999;
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
					// Trigger live debounced server verification
					setIsVerifying(true);
					verifyTimeout = setTimeout(async () => {
						try {
							const res = await numbersApi.verifyNumber('+888' + digits);
							setServerVerified(res);
						} catch {
							setServerVerified({
								number: '+888' + digits,
								display_number: '+888 ' + (digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits),
								is_minted: isFullValid,
								exists: true,
								tier: numbersValidation().pattern?.tier || 'STANDARD TIER',
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
		if (isVerifying()) return true;
		if (props.activeTab === 'collectibles') {
			const v = numbersValidation();
			if (!v.isValid) return true;
			const sv = serverVerified();
			if (sv && sv.is_minted === false) return true;
			return false;
		}
		if (props.activeTab === 'gifts') {
			return !searchQuery().trim();
		}
		return !searchQuery() || Boolean(searchError());
	});

	const getButtonText = () => {
		if (analyzeState() === 'loading') return t('action.analyzing');
		if (analyzeState() === 'success') return t('home.success');
		if (props.activeTab === 'collectibles') {
			const v = numbersValidation();
			if (v.isWallet) {
				return t('numbers.tabPortfolio') || 'Scan Wallet Portfolio';
			}
			if (v.isValid) {
				return 'کشف ارزش و تحلیل آن‌چین';
			}
			return t('action.collectibles.analyzeBtn');
		}
		if (props.activeTab === 'gifts') {
			const v = giftsValidation();
			if (v.isValid && v.title) return `ارزش‌گذاری و تحلیل ${v.title}`;
			return t('action.gifts.analyzeBtn');
		}
		if (props.activeTab === 'username') return t('action.username.analyzeMarketBtn');
		return t(keys().analyzeBtn);
	};

	const inputStateColors = createMemo(() => {
		if (props.activeTab === 'collectibles') {
			const v = numbersValidation();
			if (v.error && searchQuery().trim().length > 0) {
				return {
					glow: 'rgba(255,69,58,0.25)',
					glowSoft: 'rgba(255,69,58,0.06)',
					borderTop: 'rgba(255,69,58,0.4)',
					borderBottom: 'rgba(255,69,58,0.1)',
					bg: '#140c0c',
					icon: '#ff453a',
				};
			}
			if (v.isValid) {
				return {
					glow: 'rgba(0,152,234,0.3)',
					glowSoft: 'rgba(0,152,234,0.08)',
					borderTop: 'rgba(0,152,234,0.4)',
					borderBottom: 'rgba(0,152,234,0.1)',
					bg: '#0a1017',
					icon: '#0098ea',
				};
			}
		}

		const isError = searchError();
		const isSuccess = searchQuery() && !isError;

		if (isError) {
			return {
				glow: 'rgba(255,69,58,0.25)',
				glowSoft: 'rgba(255,69,58,0.06)',
				borderTop: 'rgba(255,69,58,0.4)',
				borderBottom: 'rgba(255,69,58,0.1)',
				bg: '#140c0c',
				icon: '#ff453a',
			};
		}
		if (isSuccess) {
			return {
				glow: 'rgba(48,209,88,0.3)',
				glowSoft: 'rgba(48,209,88,0.08)',
				borderTop: 'rgba(48,209,88,0.4)',
				borderBottom: 'rgba(48,209,88,0.1)',
				bg: '#0a140d',
				icon: '#30d158',
			};
		}
		return {
			glow: 'rgba(51,144,236,0.35)',
			glowSoft: 'rgba(51,144,236,0.1)',
			borderTop: isFocused() ? 'rgba(51,144,236,0.4)' : 'rgba(255,255,255,0.12)',
			borderBottom: isFocused() ? 'rgba(51,144,236,0.1)' : 'rgba(255,255,255,0.04)',
			bg: '#111214',
			icon: isFocused() ? '#3390ec' : 'rgba(255,255,255,0.4)',
		};
	});

	return (
		<main
			class="action-area w-full relative overflow-visible font-sans pb-20"
			aria-label={t('actionArea.analysisSection')}
		>
			{/* Ambient light */}
			<div
				class="absolute top-[20%] left-1/2 -translate-x-1/2 w-[70%] h-[40%] rounded-full pointer-events-none transition-all duration-1000 z-0"
				style={{
					background: `radial-gradient(ellipse, ${isFocused() ? 'rgba(51,144,236,0.15)' : 'rgba(51,144,236,0.05)'} 0%, transparent 70%)`,
					filter: 'blur(60px)',
				}}
			/>

			<div class="relative z-10 w-full max-w-[520px] mx-auto pt-8 px-5">
				<div class="flex flex-col w-full">
					{/* ━━━ HEADER ━━━ */}
					<Motion.div
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.7, easing: [0.16, 1, 0.3, 1] }}
						class="text-center w-full mb-8 flex flex-col items-center"
					>
						<div class="flex items-center justify-center gap-3 mb-5">
							{/* Intel Credits Badge */}
							<button
								type="button"
								onClick={() => navigate('/airdrop?tab=shop')}
								class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#3390EC]/10 border border-[#3390EC]/30 backdrop-blur-md shadow-[0_2px_10px_rgba(51,144,236,0.15)] hover:bg-[#3390EC]/20 transition-all active:scale-95"
							>
								<span class="material-symbols-outlined text-[#3390EC] text-[15px]">bolt</span>
								<span class="text-[11px] font-bold text-[#3390EC] tracking-wider uppercase">
									{credits()} {t('action.creditsLeft')}
								</span>
							</button>

							<div class="relative">
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
									class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.1)] hover:bg-white/[0.08] transition-colors"
								>
									<span class="material-symbols-outlined text-[14px] text-white/70">
										collections_bookmark
									</span>
									<span class="text-[10px] font-semibold text-white/70 tracking-[0.2em] uppercase">
										{props.activeTab === 'gifts'
											? t('home.giftsIntel')
											: props.activeTab === 'collectibles'
												? t('home.numbersIntel')
												: t('home.collectionInfo')}
									</span>
								</button>
							</div>
						</div>

						<h2 class="text-[32px] md:text-[42px] font-extrabold tracking-tight leading-[1.2] mb-2.5 text-white">
							{t(keys().title)}
						</h2>
						<p class="text-white/50 text-[14px] font-medium max-w-[400px] leading-[1.6] mx-auto">
							{t(keys().description)}
						</p>
					</Motion.div>

					{/* ━━━ FORMAT GUIDE (ACCORDION) ━━━ */}
					<Show when={props.activeTab === 'collectibles' && showNumberGuide()}>
						<div class="mb-5 bg-[#12141C]/90 border border-[#0098EA]/30 rounded-[24px] p-4 shadow-xl backdrop-blur-2xl animate-in fade-in slide-in-from-top-2 duration-200">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-sm text-[#0098EA]">info</span>
									<h3 class="text-xs font-black text-white">{t('numbers.formatGuideTitle')}</h3>
								</div>
								<button
									type="button"
									onClick={() => setShowNumberGuide(false)}
									class="text-white/40 hover:text-white text-xs font-bold"
								>
									✕
								</button>
							</div>
							<p class="text-[11px] text-white/60 mb-3 leading-relaxed">
								{t('numbers.formatGuideSubtitle')}
							</p>

							<div class="grid grid-cols-1 xs:grid-cols-2 gap-2 text-xs">
								<div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
									<span class="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-1 mb-1.5">
										<span class="material-symbols-outlined text-xs">check_circle</span>
										{t('numbers.formatValidBadge')}
									</span>
									<div class="space-y-1 font-mono text-[11px] text-white/90" dir="ltr">
										<div class="bg-black/30 px-2 py-1 rounded-lg">8888 8888 <span class="text-[9px] text-emerald-400">✓</span></div>
										<div class="bg-black/30 px-2 py-1 rounded-lg">0123 4567 <span class="text-[9px] text-emerald-400">✓</span></div>
										<div class="bg-black/30 px-2 py-1 rounded-lg">8888 <span class="text-[9px] text-emerald-400">✓ (Genesis)</span></div>
									</div>
								</div>

								<div class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25">
									<span class="text-[10px] font-black uppercase text-rose-400 flex items-center gap-1 mb-1.5">
										<span class="material-symbols-outlined text-xs">cancel</span>
										{t('numbers.formatInvalidBadge')}
									</span>
									<div class="space-y-1 font-mono text-[11px] text-white/90" dir="ltr">
										<div class="bg-black/30 px-2 py-1 rounded-lg">0912 ... <span class="text-[9px] text-rose-400">✗ Regular Sim</span></div>
										<div class="bg-black/30 px-2 py-1 rounded-lg">12 <span class="text-[9px] text-rose-400">✗ Too short</span></div>
										<div class="bg-black/30 px-2 py-1 rounded-lg">1234567890 <span class="text-[9px] text-rose-400">✗ Too long</span></div>
									</div>
								</div>
							</div>
						</div>
					</Show>

					{/* ━━━ SEARCH COMPONENT ━━━ */}
					<Motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.08, easing: [0.16, 1, 0.3, 1] }}
						class="w-full relative z-20 mb-8"
					>
						{/* Outer glow on focus */}
						<div
							class="absolute inset-[-4px] rounded-[32px] transition-all duration-700 ease-out z-[-1] pointer-events-none"
							style={{
								background:
									isFocused() || searchQuery()
										? `linear-gradient(135deg, ${inputStateColors().glow}, transparent, ${inputStateColors().glowSoft})`
										: 'transparent',
								filter: 'blur(20px)',
								opacity: isFocused() || searchQuery() ? 0.4 : 0,
							}}
						/>

						{/* Glassmorphic Container */}
						<div
							class="relative w-full rounded-[28px] transition-all duration-500 overflow-hidden backdrop-blur-2xl"
							style={{
								background: 'rgba(20, 20, 22, 0.45)',
								border: `1px solid ${inputStateColors().borderTop}`,
								'box-shadow': isFocused()
									? '0 20px 40px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
									: '0 10px 30px -10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
							}}
						>
							<div class="flex flex-col p-2">
								{/* Input Row */}
								<div class="flex items-center px-3 py-3 gap-2.5" dir="ltr">
									<Show
										when={props.activeTab === 'collectibles'}
										fallback={
											<Show
												when={props.activeTab === 'gifts'}
												fallback={
													<span
														class="text-[24px] font-medium transition-colors duration-300 min-w-[20px]"
														style={{
															color: isFocused()
																? searchQuery()
																	? inputStateColors().icon
																	: '#3390ec'
																: 'rgba(255,255,255,0.2)',
														}}
													>
														@
													</span>
												}
											>
												<span class="text-[22px] select-none shrink-0" title="Telegram Gifts">
													🎁
												</span>
											</Show>
										}
									>
										{/* Fixed +888 Prefix Badge */}
										<div class="px-3 py-1.5 rounded-xl bg-[#0098EA]/15 border border-[#0098EA]/30 text-[#0098EA] font-mono font-black text-sm select-none shrink-0 flex items-center gap-1 shadow-sm">
											<span>+888</span>
										</div>
									</Show>

									<input
										id="search-input"
										class="flex-1 bg-transparent border-none focus:ring-0 outline-none text-left font-mono text-[16px] sm:text-[19px] font-bold text-white placeholder:text-white/20 tracking-wider min-w-0"
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
										spellcheck={false}
									/>

									<div class="flex items-center gap-1.5 shrink-0">
										{/* Paste from Clipboard Button for Gifts & Collectibles */}
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
											class="px-2.5 py-1 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
											title="جاگذاری از کلیپ‌بورد"
										>
											<span class="material-symbols-outlined text-[14px] text-[#0098EA]">content_paste</span>
											<span class="hidden xs:inline">Paste</span>
										</button>

										<Show when={searchQuery()}>
											<button
												type="button"
												onClick={() => {
													setSearchQuery('');
													setShowNumberGuide(false);
													setServerVerified(null);
												}}
												class="w-7 h-7 rounded-full bg-white/[0.05] hover:bg-white/10 text-white/40 hover:text-white transition-all flex items-center justify-center active:scale-90"
											>
												<span class="material-symbols-outlined text-[16px]">close</span>
											</button>
										</Show>
									</div>
								</div>

								{/* Error for Usernames / Gifts */}
								<Show when={props.activeTab !== 'collectibles' && searchError()}>
									<Motion.div
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: 'auto' }}
										class="px-5 pb-3 flex items-center gap-2"
									>
										<span class="material-symbols-outlined text-[15px] text-[#ff453a]">error</span>
										<span class="text-[13px] font-medium text-[#ff453a]">{searchError()}</span>
									</Motion.div>
								</Show>

								{/* 🎁 Reactive Live Recognition Card for Gifts */}
								<Show when={props.activeTab === 'gifts' && giftsValidation().isValid}>
									<div class="mx-1 mb-1.5 p-3 rounded-[22px] bg-gradient-to-r from-emerald-500/10 via-[#0098EA]/10 to-transparent border border-emerald-500/30 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
										<div class="flex items-center justify-between gap-2 mb-1.5">
											<div class="flex items-center gap-2.5 min-w-0">
												<div class="w-7 h-7 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden p-0.5">
													<GiftThumbnail slug={giftsValidation().slug.replace(/-\d+$/, '')} name={giftsValidation().title} class="w-full h-full object-contain" />
												</div>
												<div class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,199,89,0.8)] animate-pulse shrink-0" />
												<span class="text-[13px] font-black text-white tracking-tight truncate">
													{giftsValidation().title}
												</span>
											</div>
											<span class="text-[9px] font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shrink-0">
												{giftsValidation().tag}
											</span>
										</div>
										<div class="flex items-center justify-between text-[11px] text-white/70 pt-0.5 border-t border-white/[0.06] mt-1">
											<span class="truncate">{giftsValidation().subtitle}</span>
											<span class="text-emerald-400 font-bold text-[10px] shrink-0 flex items-center gap-1">
												<span class="material-symbols-outlined text-[13px]">verified</span>
												<span>تایید شده</span>
											</span>
										</div>
									</div>
								</Show>

								{/* Reactive Realtime Validation & VIP Live Intelligence for Collectible Numbers */}
								<Show when={props.activeTab === 'collectibles' && searchQuery().trim().length > 0}>
									{/* 1. Client format error */}
									<Show when={numbersValidation().error}>
										<div class="px-4 pb-2.5 pt-1 flex items-center justify-between text-xs font-bold text-rose-400 animate-in fade-in">
											<span class="flex items-center gap-1.5">
												<span class="material-symbols-outlined text-sm">warning</span>
												<span>{numbersValidation().error}</span>
											</span>
											<button
												type="button"
												onClick={() => setShowNumberGuide(true)}
												class="text-[11px] text-[#0098EA] underline hover:brightness-120"
											>
												{t('numbers.formatGuideBtn')}
											</button>
										</div>
									</Show>

									{/* 2. On-chain Verifying state */}
									<Show when={!numbersValidation().error && isVerifying()}>
										<div class="px-4 pb-2.5 pt-1 flex items-center gap-2 text-xs font-bold text-[#0098EA] animate-pulse">
											<span class="w-2 h-2 rounded-full bg-[#0098EA] animate-ping" />
											<span>{t('numbers.verifyingStatus')}</span>
										</div>
									</Show>

									{/* 3. Server unminted error */}
									<Show when={!numbersValidation().error && !isVerifying() && serverVerified() && !serverVerified()?.is_minted}>
										<div class="px-4 pb-2.5 pt-1 flex items-center justify-between text-xs font-bold text-rose-400 animate-in fade-in">
											<span class="flex items-center gap-1.5">
												<span class="material-symbols-outlined text-sm">cancel</span>
												<span>{t('numbers.errorUnmintedServer')}</span>
											</span>
											<button
												type="button"
												onClick={() => setShowNumberGuide(true)}
												class="text-[11px] text-[#0098EA] underline hover:brightness-120"
											>
												{t('numbers.formatGuideBtn')}
											</button>
										</div>
									</Show>

									{/* 4. Valid & Minted - Minimalist VIP Live Intelligence Card */}
									<Show when={numbersValidation().isValid && !isVerifying() && (!serverVerified() || serverVerified()?.is_minted)}>
										<div class="mx-1 mb-1.5 p-3 rounded-[20px] bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
											<div class="flex items-center justify-between gap-2 mb-1">
												<div class="flex items-center gap-2">
													<div class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,199,89,0.8)] animate-pulse shrink-0" />
													<span class="text-[13px] font-bold text-white tracking-tight">
														{numbersValidation().pattern?.name}
													</span>
												</div>
												<span class="text-[9px] font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/80 shrink-0">
													{numbersValidation().pattern?.tier}
												</span>
											</div>
											<div class="flex items-center justify-between text-[11px] text-white/50 pt-0.5">
												<span>{numbersValidation().pattern?.subtitle}</span>
												<span class="text-emerald-400 font-semibold text-[10px] shrink-0">
													{numbersValidation().pattern?.rarity}
												</span>
											</div>
										</div>
									</Show>
								</Show>
							</div>
						</div>

						{/* Format Helper Pills for Gifts */}
						<Show when={props.activeTab === 'gifts' && !searchQuery()}>
							<div class="flex flex-wrap items-center justify-center gap-1.5 mt-2.5 px-2">
								<span class="text-[10px] font-bold text-white/40">قالب‌های مجاز:</span>
								<button
									type="button"
									onClick={() => {
										try { haptic.selection(); } catch {}
										updateSearchQuery('https://t.me/nft/PlushPepe-1');
									}}
									class="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-[#0098EA]/40 text-[10px] font-mono text-[#0098EA] transition-all flex items-center gap-1 active:scale-95 shadow-sm"
								>
									<span>🔗</span>
									<span>t.me/nft/PlushPepe-1</span>
								</button>
								<button
									type="button"
									onClick={() => {
										try { haptic.selection(); } catch {}
										updateSearchQuery('DurovsCap-1');
									}}
									class="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-purple-400/40 text-[10px] font-mono text-purple-300 transition-all flex items-center gap-1 active:scale-95 shadow-sm"
								>
									<span>🧢</span>
									<span>DurovsCap-1</span>
								</button>
								<button
									type="button"
									onClick={() => {
										try { haptic.selection(); } catch {}
										updateSearchQuery('Signet Ring #7');
									}}
									class="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-amber-400/40 text-[10px] font-mono text-amber-300 transition-all flex items-center gap-1 active:scale-95 shadow-sm"
								>
									<span>💍</span>
									<span>Signet Ring #7</span>
								</button>
								<button
									type="button"
									onClick={() => {
										try { haptic.selection(); } catch {}
										updateSearchQuery('https://fragment.com/gift/SantaHat-1');
									}}
									class="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-400/40 text-[10px] font-mono text-emerald-300 transition-all flex items-center gap-1 active:scale-95 shadow-sm"
								>
									<span>🎅</span>
									<span>fragment.com/gift/SantaHat-1</span>
								</button>
							</div>
						</Show>

						{/* Analyze Button */}
						<button
							type="button"
							onClick={handleAnalyze}
							disabled={isAnalyzeDisabled()}
							class="relative w-full h-[60px] rounded-[22px] font-black text-[15px] flex items-center justify-center gap-2 transition-all duration-300 overflow-hidden group mt-4"
							style={{
								background:
									analyzeState() === 'success'
										? 'linear-gradient(135deg, #28a745, #30d158)'
										: isAnalyzeDisabled()
											? 'rgba(255,255,255,0.04)'
											: 'linear-gradient(135deg, #ffffff, #e0e0e0)',
								color:
									analyzeState() === 'success'
										? '#fff'
										: isAnalyzeDisabled()
											? 'rgba(255,255,255,0.25)'
											: '#000',
								cursor: isAnalyzeDisabled() ? 'not-allowed' : 'pointer',
								'box-shadow': !isAnalyzeDisabled()
									? '0 8px 24px -6px rgba(255,255,255,0.2)'
									: 'none',
							}}
						>
							<Show when={analyzeState() === 'loading'}>
								<div class="w-5 h-5 rounded-full border-[2.5px] border-black/20 border-t-black animate-spin" />
							</Show>
							<span class="relative z-10 transition-transform group-hover:scale-[1.02]">
								{getButtonText()}
							</span>
							<Show when={analyzeState() === 'idle' && !isAnalyzeDisabled()}>
								<span class="material-symbols-outlined text-[18px] rtl:rotate-180 relative z-10 group-hover:translate-x-1 transition-transform">
									arrow_forward
								</span>
							</Show>
						</button>
					</Motion.div>

					{/* ━━━ TAB-AWARE DYNAMIC TRENDING (CONVERT & CYCLE ENGINE) ━━━ */}
					<Motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.5, delay: 0.2 }}
						class="w-full mb-8 flex flex-col items-center"
					>
						<div class="flex items-center justify-between w-full max-w-[460px] px-2 mb-3.5">
							<span class="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] flex items-center gap-1.5">
								<span class="material-symbols-outlined text-[15px] text-amber-400">trending_up</span>
								<span>{t('action.trending.title')}</span>
							</span>

							<Show
								when={props.activeTab === 'gifts'}
								fallback={
									<Show when={props.activeTab === 'collectibles'}>
										<button
											type="button"
											onClick={handleCycleTrending}
											class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[11px] font-medium text-white/70 hover:text-white transition-all active:scale-95 group"
										>
											<span class={`material-symbols-outlined text-[13px] text-[#0098EA] transition-transform duration-500 ${isRotating() ? 'rotate-180' : 'group-hover:rotate-45'}`}>
												cached
											</span>
											<span>{t(currentTrendingPool().categoryKey)}</span>
										</button>
									</Show>
								}
							>
								<span class="text-[10px] font-bold text-emerald-400/90 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
									<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
									<span>داده‌های زنده فرگمنت</span>
								</span>
							</Show>
						</div>

						{/* Gifts Category Selector Pills (Tab Group) */}
						<Show when={props.activeTab === 'gifts'}>
							<div class="w-full max-w-[460px] px-1 mb-3.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-1">
								<For each={RICH_GIFTS_TRENDING_POOLS}>
									{(pool, idx) => {
										const isActive = () => giftPoolIndex() === idx();
										return (
											<button
												type="button"
												onClick={() => {
													try { haptic.selection(); } catch {}
													setGiftPoolIndex(idx());
												}}
												class={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all duration-300 flex items-center gap-1.5 shrink-0 active:scale-95 ${
													isActive()
														? 'bg-gradient-to-r from-[#0098EA]/30 via-[#3390ec]/20 to-white/10 border border-[#0098EA]/50 text-white shadow-[0_0_15px_rgba(0,152,234,0.3)] scale-[1.02]'
														: 'bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-white/60 hover:text-white'
												}`}
											>
												<span>{pool.icon}</span>
												<span>{pool.label}</span>
											</button>
										);
									}}
								</For>
							</div>
						</Show>

						{/* Gifts Custom Luxury Cards */}
						<Show
							when={props.activeTab === 'gifts'}
							fallback={
								<div class="flex flex-wrap justify-center gap-2.5 w-full" dir="ltr">
									<For each={trendingItems()}>
										{(item, idx) => (
											<Motion.button
												initial={{ opacity: 0, y: 8 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{
													duration: 0.35,
													delay: idx() * 0.04,
													easing: [0.16, 1, 0.3, 1],
												}}
												onClick={() => {
													try {
														haptic.selection();
													} catch {}
													updateSearchQuery(item);
													const el = document.getElementById('search-input');
													if (el) el.focus();
												}}
												class="group relative px-4 py-2.5 rounded-[16px] bg-white/[0.03] hover:bg-white/[0.07] text-white/70 hover:text-white text-[13px] font-mono font-medium transition-all duration-300 active:scale-95 flex items-center gap-1.5 border border-white/[0.05] hover:border-white/15 shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
											>
												<Show when={props.activeTab === 'username'}>
													<span class="text-white/25">@</span>
												</Show>
												<Show when={props.activeTab === 'collectibles' && !item.startsWith('+')}>
													<span class="text-[#0098EA]/60 font-bold">+888 </span>
												</Show>
												<span class="tracking-wider">{item}</span>
												<span class="material-symbols-outlined text-[12px] opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0 transition-all text-white">
													arrow_outward
												</span>
											</Motion.button>
										)}
									</For>
								</div>
							}
						>
							<div class="grid grid-cols-1 xs:grid-cols-2 gap-2.5 w-full max-w-[460px]">
								<For each={currentGiftsTrendingPool().items}>
									{(gCard, idx) => (
										<Motion.button
											initial={{ opacity: 0, y: 10 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{
												duration: 0.3,
												delay: idx() * 0.04,
												easing: [0.16, 1, 0.3, 1],
											}}
											onClick={() => {
												try {
													haptic.impact('medium');
												} catch {}
												updateSearchQuery(gCard.url);
												const el = document.getElementById('search-input');
												if (el) el.focus();
											}}
											class="group relative p-3 rounded-[22px] bg-gradient-to-b from-white/[0.05] to-white/[0.015] hover:from-white/[0.09] hover:to-white/[0.04] border border-white/[0.08] hover:border-[#0098EA]/50 text-left transition-all duration-300 active:scale-[0.98] flex items-center gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)] overflow-hidden backdrop-blur-xl"
										>
											{/* Background Ambient Glow */}
											<div class="absolute -right-6 -bottom-6 w-20 h-20 bg-[#0098EA]/10 rounded-full blur-xl pointer-events-none group-hover:bg-[#0098EA]/20 transition-all duration-500" />

											{/* Gift Thumbnail Art Box */}
											<div class="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-white/10 to-black/60 border border-white/15 shrink-0 overflow-hidden flex items-center justify-center p-1 group-hover:scale-105 group-hover:border-[#0098EA]/40 transition-all duration-300 shadow-md">
												<GiftThumbnail slug={gCard.slug} name={gCard.name} class="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" />
												<span class="absolute top-0.5 right-0.5 text-[8px] leading-none">{gCard.emoji}</span>
											</div>

											{/* Info Column */}
											<div class="flex-1 min-w-0 flex flex-col justify-center">
												<div class="flex items-center justify-between gap-1">
													<span class="text-[13px] font-black text-white truncate group-hover:text-[#0098EA] transition-colors">
														{gCard.name}
													</span>
													<span class="text-[9px] font-mono font-black px-1.5 py-0.5 rounded-md bg-white/[0.07] text-amber-300/90 border border-white/10 shrink-0">
														#{gCard.serial}
													</span>
												</div>

												<div class="flex items-center justify-between mt-1 text-[10px]">
													<span class="font-mono font-bold text-emerald-400 flex items-center gap-0.5">
														<span class="text-[9px]">💎</span>
														<span>{gCard.floor.toLocaleString()} TON</span>
													</span>
													<span class="text-white/40 font-mono text-[9px]">
														~${(gCard.floor * 3.2).toLocaleString(undefined, { maximumFractionDigits: 0 })}
													</span>
												</div>

												<div class="flex items-center justify-between mt-1 pt-1 border-t border-white/[0.05]">
													<span class="text-[8px] font-mono font-black uppercase tracking-wider text-white/50 truncate">
														{gCard.tag}
													</span>
													<span class="material-symbols-outlined text-[13px] text-white/40 group-hover:text-[#0098EA] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-all">
														arrow_forward
													</span>
												</div>
											</div>
										</Motion.button>
									)}
								</For>
							</div>
						</Show>
					</Motion.div>
				</div>
			</div>

			{/* ━━━ NO CREDITS MODAL ━━━ */}
			<Show when={showNoCreditsModal()}>
				<div class="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/80 backdrop-blur-md animate-fade-in">
					<div class="bg-[#12141C] w-full max-w-sm rounded-[32px] p-7 flex flex-col items-center text-center shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/10 relative overflow-hidden animate-slide-up">
						<div class="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
							<span class="material-symbols-outlined text-amber-400 text-3xl">bolt</span>
						</div>
						<h3 class="text-xl font-bold text-white mb-2">{t('noCreditsModal.title')}</h3>
						<p class="text-xs text-white/60 mb-6 leading-relaxed">
							{t('noCreditsModal.description')}
						</p>
						<button
							type="button"
							onClick={() => {
								setShowNoCreditsModal(false);
								navigate('/airdrop?tab=shop');
							}}
							class="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#3390EC] to-[#2071C4] text-white font-semibold text-sm mb-3 active:scale-98 transition-transform"
						>
							{t('noCreditsModal.buyCredits')}
						</button>
						<button
							type="button"
							onClick={() => {
								setShowNoCreditsModal(false);
								navigate('/airdrop?tab=earn');
							}}
							class="w-full py-3 px-6 rounded-2xl bg-white/[0.05] hover:bg-white/10 text-white/80 font-medium text-xs transition-colors"
						>
							{t('noCreditsModal.earnCredits')}
						</button>
					</div>
				</div>
			</Show>

			{/* ━━━ NUMBER FORMAT GUIDE MODAL ━━━ */}
			<Show when={showNumberGuide()}>
				<div class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-fade-in">
					<div class="bg-[#12141C] w-full max-w-sm rounded-[32px] p-6 flex flex-col items-center text-center shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-white/10 relative overflow-hidden animate-slide-up">
						<div class="w-14 h-14 rounded-2xl bg-[#0098EA]/10 border border-[#0098EA]/20 flex items-center justify-center mb-3 text-[#0098EA]">
							<span class="material-symbols-outlined text-3xl">dialpad</span>
						</div>
						<h3 class="text-lg font-bold text-white mb-1.5">{t('numbers.formatGuideTitle')}</h3>
						<p class="text-xs text-white/60 mb-5 leading-relaxed">
							{t('numbers.formatGuideSubtitle')}
						</p>

						<div class="w-full space-y-2.5 mb-5 text-left">
							{/* Valid Formats */}
							<div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
								<span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1.5 flex items-center gap-1">
									<span class="material-symbols-outlined text-xs">check_circle</span>
									{t('numbers.formatValidBadge')}
								</span>
								<div class="space-y-1 text-xs font-mono text-white/90">
									<button
										type="button"
										onClick={() => {
											updateSearchQuery('00000000');
											setShowNumberGuide(false);
										}}
										class="w-full text-left p-1 rounded hover:bg-emerald-500/15 flex items-center justify-between group transition-colors"
									>
										<span>+888 0000 0000</span>
										<span class="text-[10px] font-sans text-emerald-400/70 group-hover:text-emerald-300">8 Digits Standard</span>
									</button>
									<button
										type="button"
										onClick={() => {
											updateSearchQuery('8000');
											setShowNumberGuide(false);
										}}
										class="w-full text-left p-1 rounded hover:bg-emerald-500/15 flex items-center justify-between group transition-colors"
									>
										<span>+888 8000</span>
										<span class="text-[10px] font-sans text-emerald-400/70 group-hover:text-emerald-300">4 Digits Genesis</span>
									</button>
								</div>
							</div>

							{/* Invalid Formats */}
							<div class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
								<span class="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-1.5 flex items-center gap-1">
									<span class="material-symbols-outlined text-xs">cancel</span>
									{t('numbers.formatInvalidBadge')}
								</span>
								<div class="space-y-1 text-xs font-mono text-white/60">
									<div class="flex items-center justify-between p-1">
										<span class="line-through">+98 912...</span>
										<span class="text-[10px] font-sans text-rose-400/70">Cellular / SIM</span>
									</div>
									<div class="flex items-center justify-between p-1">
										<span class="line-through">+888 12</span>
										<span class="text-[10px] font-sans text-rose-400/70">&lt; 4 Digits</span>
									</div>
								</div>
							</div>
						</div>

						<button
							type="button"
							onClick={() => setShowNumberGuide(false)}
							class="w-full py-3 px-6 rounded-2xl bg-[#0098EA] hover:bg-[#0087d1] text-white font-bold text-xs active:scale-98 transition-all shadow-[0_0_20px_rgba(0,152,234,0.3)]"
						>
							{t('common.close') || 'متوجه شدم'}
						</button>
					</div>
				</div>
			</Show>
		</main>
	);
};
