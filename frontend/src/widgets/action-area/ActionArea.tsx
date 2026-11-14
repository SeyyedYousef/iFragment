import { Motion } from '@motionone/solid';
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
	glow: string;
	gradient: string;
	icon: string;
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
			.replace(/^(?:www\.)?getgems\.io\/collection\/[^/]+\//i, '');

		// 3. Strip query params and trailing slashes
		if (str.includes('?')) str = str.split('?')[0];
		str = str.replace(/\/+$/, '').trim();

		return str;
	};

	const giftsValidation = createMemo(() => {
		if (props.activeTab !== 'gifts') {
			return {
				isValid: false,
				isLink: false,
				isWallet: false,
				isUser: false,
				title: '',
				subtitle: '',
				slug: '',
				serial: 1,
				emoji: '🎁',
				tag: '',
				floorTon: 0,
				supply: 0,
			};
		}
		const raw = searchQuery().trim();
		if (!raw) {
			return {
				isValid: false,
				isLink: false,
				isWallet: false,
				isUser: false,
				title: '',
				subtitle: '',
				slug: '',
				serial: 1,
				emoji: '🎁',
				tag: '',
				floorTon: 0,
				supply: 0,
			};
		}

		const clean = normalizeGiftInput(raw);
		if (!clean) {
			return {
				isValid: false,
				isLink: false,
				isWallet: false,
				isUser: false,
				title: '',
				subtitle: '',
				slug: '',
				serial: 1,
				emoji: '🎁',
				tag: '',
				floorTon: 0,
				supply: 0,
			};
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
					(targetAliasSlug &&
						(g.slug === targetAliasSlug || gKey === targetAliasSlug.replace(/[^a-z0-9]/g, '')))
				);
			});

			const displayName = catalogItem ? catalogItem.name : rawModel.replace(/[-_]+/g, ' ').trim();
			const resolvedSlug = catalogItem
				? catalogItem.slug
				: targetAliasSlug || rawModel.toLowerCase().replace(/[\s_]+/g, '-');
			const emoji = catalogItem?.emoji || '🎁';
			const floorTon = catalogItem?.floorTon || 0;
			const supply = catalogItem?.supply || 0;

			// Determine serial tier badge
			let serialTag = 'Verified Gift NFT';
			if (serialNum === 1) {
				serialTag = 'Genesis Mint (#1)';
			} else if (serialNum >= 2 && serialNum <= 9) {
				serialTag = `Single Digit (#${serialNum})`;
			} else if (serialNum >= 10 && serialNum <= 99) {
				serialTag = `Double Digit (#${serialNum})`;
			} else if ([420, 777, 888, 999, 1000].includes(serialNum)) {
				serialTag = `Sacred Serial (#${serialNum})`;
			}

			const subtitle =
				floorTon > 0
					? `${layaT(GIFTS_I18N.floorPricePrefix)}: ${floorTon.toLocaleString()} TON (≈ $${(floorTon * 3.2).toLocaleString(undefined, { maximumFractionDigits: 0 })}) · ${layaT(GIFTS_I18N.supplyLabel)}: ${supply.toLocaleString()} ${layaT(GIFTS_I18N.giftsWord)}`
					: layaT(GIFTS_I18N.readyToValuate);

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
				subtitle: `${layaT(GIFTS_I18N.supplyLabel)}: ${catalogItem.supply.toLocaleString()} ${layaT(GIFTS_I18N.giftsWord)} · ${layaT(GIFTS_I18N.readyToValuate)}`,
				slug: `${catalogItem.slug}-1`,
				serial: 1,
				emoji: catalogItem.emoji || '🎁',
				tag: 'Official Collection (#1)',
				floorTon: 0,
				supply: catalogItem.supply,
			};
		}

		return {
			isValid: false,
			isLink: false,
			isWallet: false,
			isUser: false,
			title: '',
			subtitle: '',
			slug: '',
			serial: 1,
			emoji: '🎁',
			tag: '',
			floorTon: 0,
			supply: 0,
		};
	});

	const numbersValidation = createMemo(() => {
		if (props.activeTab !== 'collectibles') {
			return {
				isValid: false,
				isWallet: false,
				walletAddress: '',
				cleanDigits: '',
				error: null,
				pattern: null as NumberPatternInfo | null,
			};
		}
		const raw = searchQuery().trim();
		if (!raw) {
			return {
				isValid: false,
				isWallet: false,
				walletAddress: '',
				cleanDigits: '',
				error: null,
				pattern: null as NumberPatternInfo | null,
			};
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

		if (/[^\d\s()\-+]/.test(raw)) {
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

		const is4DigitGenesis =
			digits.length === 4 && parseInt(digits, 10) >= 8000 && parseInt(digits, 10) <= 8999;
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
		} else if (
			/^(.)\1+$/.test(digits) ||
			digits.includes('8888') ||
			digits.includes('7777') ||
			digits.includes('0000')
		) {
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
			} else if (digits === '12345678' || digits === '87654321' || digits === '01234567') {
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
						glow: 'rgba(6,182,212,0.2)',
						gradient: 'from-cyan-400/20 to-blue-600/10 border-cyan-400/40 text-cyan-300',
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
				NUMBER_TRENDING_POOLS[0].items = nIntel.hall_of_fame
					.slice(0, 4)
					.map((x) => x.display_number);
			}
		} catch (_e) {}

		// Auto cycle collectibles trending items every 8 seconds when idle
		cycleInterval = setInterval(() => {
			if (!isFocused() && !searchQuery()) {
				if (props.activeTab === 'collectibles') {
					setPoolIndex((prev) => (prev + 1) % NUMBER_TRENDING_POOLS.length);
				}
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
		if (props.activeTab === 'collectibles') {
			return currentTrendingPool().items;
		}
		if (props.activeTab === 'gifts') {
			return GIFT_TRENDING_ITEMS;
		}
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

			// Fallback parsing for arbitrary input
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

			// Auto-open format guide if invalid after 2.5 seconds of non-empty typing
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
					// Trigger live debounced server verification
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
		if (props.activeTab === 'collectibles') {
			const v = numbersValidation();
			return !v.isValid;
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
				return t('action.collectibles.analyzeBtn');
			}
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
			class="action-area w-full relative overflow-visible font-frag-sans pb-16"
			aria-label={t('actionArea.analysisSection')}
		>
			<div class="relative z-10 w-full max-w-[500px] mx-auto pt-4 px-4">
				<div class="flex flex-col w-full">
					{/* ━━━ HEADER ━━━ */}
					<Motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.35, easing: [0.16, 1, 0.3, 1] }}
						class="text-center w-full mb-5 flex flex-col items-center"
					>
						<div class="flex items-center justify-center mb-3.5">
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
								class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1b232d] hover:bg-[#232d3a] border border-white/[0.08] hover:border-[#2990FF]/40 text-[12px] font-medium text-[#c7d0d9] hover:text-white transition-colors"
							>
								<span class="material-symbols-outlined text-[15px] text-[#2990FF]">
									collections_bookmark
								</span>
								<span>
									{props.activeTab === 'gifts'
										? t('home.giftsIntel')
										: props.activeTab === 'collectibles'
											? t('home.numbersIntel')
											: t('home.collectionInfo')}
								</span>
								<span class="material-symbols-outlined text-[14px] text-[#60707c] rtl:rotate-180">
									chevron_right
								</span>
							</button>
						</div>

						<h2 class="text-[24px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.2] mb-2 text-white">
							{t(keys().title)}
						</h2>
						<p class="text-[#8c9ba5] text-[13px] font-normal max-w-[380px] leading-[1.6] mx-auto">
							{t(keys().description)}
						</p>
					</Motion.div>

					{/* ━━━ FORMAT GUIDE (ACCORDION) ━━━ */}
					<Show when={props.activeTab === 'collectibles' && showNumberGuide()}>
						<div class="mb-4 frag-card p-4 border-[#2990FF]/35">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<span class="material-symbols-outlined text-[16px] text-[#2990FF]">info</span>
									<h3 class="text-[13px] font-semibold text-white">
										{t('numbers.formatGuideTitle')}
									</h3>
								</div>
								<button
									type="button"
									onClick={() => setShowNumberGuide(false)}
									class="w-7 h-7 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] text-[#8c9ba5] hover:text-white flex items-center justify-center transition-colors"
								>
									<span class="material-symbols-outlined text-[16px]">close</span>
								</button>
							</div>
							<p class="text-[12px] text-[#8c9ba5] mb-3 leading-relaxed">
								{t('numbers.formatGuideSubtitle')}
							</p>

							<div class="grid grid-cols-1 xs:grid-cols-2 gap-2 text-xs">
								<div class="p-3 rounded-[10px] bg-[#4cd964]/10 border border-[#4cd964]/25">
									<span class="text-[11px] font-semibold text-[#4cd964] flex items-center gap-1 mb-1.5">
										<span class="material-symbols-outlined text-[14px]">check_circle</span>
										{t('numbers.formatValidBadge')}
									</span>
									<div class="space-y-1 font-mono text-[11.5px] text-white/90" dir="ltr">
										<div class="bg-[#141a22] px-2.5 py-1 rounded-[6px] flex items-center justify-between">
											<span>8888 8888</span>
											<span class="text-[10px] text-[#4cd964]">
												{t('numbers.formatValidSample')}
											</span>
										</div>
										<div class="bg-[#141a22] px-2.5 py-1 rounded-[6px] flex items-center justify-between">
											<span>0123 4567</span>
											<span class="text-[10px] text-[#4cd964]">
												{t('numbers.formatValidSample')}
											</span>
										</div>
										<div class="bg-[#141a22] px-2.5 py-1 rounded-[6px] flex items-center justify-between">
											<span>8888</span>
											<span class="text-[10px] text-[#4cd964]">
												{t('numbers.formatGenesisTag')}
											</span>
										</div>
									</div>
								</div>

								<div class="p-3 rounded-[10px] bg-[#ff5c6c]/10 border border-[#ff5c6c]/25">
									<span class="text-[11px] font-semibold text-[#ff5c6c] flex items-center gap-1 mb-1.5">
										<span class="material-symbols-outlined text-[14px]">cancel</span>
										{t('numbers.formatInvalidBadge')}
									</span>
									<div class="space-y-1 font-mono text-[11.5px] text-white/90" dir="ltr">
										<div class="bg-[#141a22] px-2.5 py-1 rounded-[6px] flex items-center justify-between">
											<span>0912…</span>
											<span class="text-[10px] text-[#ff5c6c]">
												{t('numbers.formatRegularSim')}
											</span>
										</div>
										<div class="bg-[#141a22] px-2.5 py-1 rounded-[6px] flex items-center justify-between">
											<span>12</span>
											<span class="text-[10px] text-[#ff5c6c]">{t('numbers.formatTooShort')}</span>
										</div>
										<div class="bg-[#141a22] px-2.5 py-1 rounded-[6px] flex items-center justify-between">
											<span>1234567890</span>
											<span class="text-[10px] text-[#ff5c6c]">{t('numbers.formatTooLong')}</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</Show>

					{/* ━━━ SEARCH COMPONENT ━━━ */}
					<Motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.32, easing: [0.16, 1, 0.3, 1] }}
						class="w-full relative z-20 mb-6"
					>
						<div
							class="frag-card-elevated w-full rounded-[16px] overflow-hidden transition-colors duration-200"
							style={{
								'border-color': isFocused()
									? inputStateColors().borderTop
									: 'rgba(255, 255, 255, 0.09)',
							}}
						>
							<div class="flex flex-col p-2">
								{/* Input Row */}
								<div class="flex items-center px-3 py-2.5 gap-2.5" dir="ltr">
									<Show
										when={props.activeTab === 'collectibles'}
										fallback={
											<Show when={props.activeTab === 'username'}>
												<span
													class="text-[22px] font-semibold transition-colors duration-200 min-w-[20px] select-none"
													style={{
														color: isFocused()
															? searchQuery()
																? inputStateColors().icon
																: '#2990FF'
															: '#2990FF',
													}}
												>
													@
												</span>
											</Show>
										}
									>
										{/* Fixed +888 Prefix Badge */}
										<div class="px-2.5 py-1 rounded-[8px] bg-[#2990FF]/12 border border-[#2990FF]/30 text-[#64b5ff] font-mono font-semibold text-[13px] select-none shrink-0 flex items-center">
											<span>+888</span>
										</div>
									</Show>

									<input
										id="search-input"
										class="flex-1 bg-transparent border-none focus:ring-0 outline-none text-left font-mono text-[16px] sm:text-[18px] font-semibold text-white placeholder:text-[#60707c] tracking-tight min-w-0"
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

									<div class="flex items-center gap-1.5 shrink-0">
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
											class="px-2.5 py-1.5 rounded-[8px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-[#a9b6bf] hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors active:scale-95"
											title={t('common.pasteBtn') || 'Paste'}
										>
											<span class="material-symbols-outlined text-[14px] text-[#2990FF]">
												content_paste
											</span>
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
												class="w-7 h-7 rounded-[8px] bg-white/[0.05] hover:bg-white/[0.1] text-[#8c9ba5] hover:text-white transition-colors flex items-center justify-center active:scale-90"
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
										class="px-3.5 pb-2.5 flex items-center gap-1.5"
									>
										<span class="material-symbols-outlined text-[15px] text-[#ff5c6c]">error</span>
										<span class="text-[12.5px] font-medium text-[#ff5c6c]">{searchError()}</span>
									</Motion.div>
								</Show>

								{/* Reactive Live Recognition Card for Gifts */}
								<Show when={props.activeTab === 'gifts' && giftsValidation().isValid}>
									<div class="mx-1 mb-1.5 frag-inset p-3 border-[#4cd964]/30">
										<div class="flex items-center justify-between gap-2 mb-1.5">
											<div class="flex items-center gap-2.5 min-w-0">
												<div class="w-8 h-8 rounded-[8px] bg-[#1b232d] border border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden p-0.5">
													<GiftThumbnail
														slug={giftsValidation().slug.replace(/-\d+$/, '')}
														name={giftsValidation().title}
														class="w-full h-full object-contain"
													/>
												</div>
												<span class="w-1.5 h-1.5 rounded-full bg-[#4cd964] shrink-0" />
												<span class="text-[13px] font-semibold text-white tracking-tight truncate">
													{giftsValidation().title}
												</span>
											</div>
											<span class="text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-[6px] bg-[#4cd964]/12 border border-[#4cd964]/30 text-[#4cd964] shrink-0">
												{giftsValidation().tag}
											</span>
										</div>
										<div class="flex items-center justify-between text-[11px] text-[#8c9ba5] pt-1.5 border-t border-white/[0.06]">
											<span class="truncate">{giftsValidation().subtitle}</span>
											<span class="text-[#4cd964] font-medium text-[11px] shrink-0 inline-flex items-center gap-1">
												<span class="material-symbols-outlined text-[13px]">verified</span>
												<span>{layaT(GIFTS_I18N.verifiedBadge)}</span>
											</span>
										</div>
									</div>
								</Show>

								{/* Reactive Realtime Validation for Collectible Numbers */}
								<Show when={props.activeTab === 'collectibles' && searchQuery().trim().length > 0}>
									<Show when={numbersValidation().error}>
										<div class="px-3.5 pb-2 pt-1 flex items-center justify-between text-[12px] font-medium text-[#ff5c6c]">
											<span class="flex items-center gap-1.5">
												<span class="material-symbols-outlined text-[15px]">warning</span>
												<span>{numbersValidation().error}</span>
											</span>
											<button
												type="button"
												onClick={() => setShowNumberGuide(true)}
												class="text-[11px] text-[#2990FF] hover:underline"
											>
												{t('numbers.formatGuideBtn')}
											</button>
										</div>
									</Show>

									<Show when={!numbersValidation().error && isVerifying()}>
										<div class="px-3.5 pb-2 pt-1 flex items-center gap-2 text-[12px] font-medium text-[#64b5ff]">
											<span class="w-2 h-2 rounded-full bg-[#2990FF] animate-pulse" />
											<span>{t('numbers.verifyingStatus')}</span>
										</div>
									</Show>

									<Show
										when={!numbersValidation().error && !isVerifying() && serverVerified()?.error}
									>
										<div class="px-3.5 pb-2 pt-1 flex items-center justify-between text-[12px] font-medium text-[#ff5c6c]">
											<span class="flex items-center gap-1.5">
												<span class="material-symbols-outlined text-[15px]">cancel</span>
												<span>{serverVerified()?.error || t('numbers.errorUnmintedServer')}</span>
											</span>
											<button
												type="button"
												onClick={() => setShowNumberGuide(true)}
												class="text-[11px] text-[#2990FF] hover:underline"
											>
												{t('numbers.formatGuideBtn')}
											</button>
										</div>
									</Show>

									<Show
										when={numbersValidation().isValid && !isVerifying() && !serverVerified()?.error}
									>
										<div class="mx-1 mb-1.5 frag-inset p-3">
											<div class="flex items-center justify-between gap-2 mb-1">
												<div class="flex items-center gap-2 min-w-0">
													<span class="w-1.5 h-1.5 rounded-full bg-[#4cd964] shrink-0" />
													<span class="text-[13px] font-semibold text-white truncate">
														{numbersValidation().pattern?.name}
													</span>
												</div>
												<span class="text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-[6px] bg-white/[0.05] border border-white/[0.08] text-[#c7d0d9] shrink-0">
													{numbersValidation().pattern?.tier}
												</span>
											</div>
											<div class="flex items-center justify-between text-[11px] text-[#8c9ba5] pt-1 border-t border-white/[0.05]">
												<span class="truncate">{numbersValidation().pattern?.subtitle}</span>
												<span class="text-[#4cd964] font-medium text-[11px] shrink-0">
													{numbersValidation().pattern?.rarity}
												</span>
											</div>
										</div>
									</Show>
								</Show>
							</div>
						</div>

						{/* Primary CTA Button — Fragment Telegram Blue */}
						<button
							type="button"
							onClick={handleAnalyze}
							disabled={isAnalyzeDisabled()}
							class={`relative w-full h-12 rounded-[12px] font-semibold text-[14px] flex items-center justify-center gap-2 mt-3 transition-all ${
								analyzeState() === 'success'
									? 'bg-[#32d74b] text-white'
									: isAnalyzeDisabled()
										? 'bg-white/[0.05] border border-white/[0.07] text-white/30 cursor-not-allowed'
										: 'frag-btn-primary cursor-pointer'
							}`}
						>
							<Show when={analyzeState() === 'loading'}>
								<div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
							</Show>
							<span class="truncate">{getButtonText()}</span>
							<Show when={analyzeState() === 'idle' && !isAnalyzeDisabled()}>
								<span class="material-symbols-outlined text-[18px] rtl:rotate-180">
									arrow_forward
								</span>
							</Show>
						</button>
					</Motion.div>

					{/* ━━━ TAB-AWARE DYNAMIC TRENDING ━━━ */}
					<Motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.35, delay: 0.1 }}
						class="w-full mb-4 flex flex-col items-center"
					>
						<div class="flex items-center justify-between w-full px-1 mb-2.5">
							<span class="text-[12px] font-medium text-[#8c9ba5] flex items-center gap-1.5">
								<span class="material-symbols-outlined text-[16px] text-[#ffb340]">
									trending_up
								</span>
								<span>{t('action.trending.title')}</span>
							</span>

							<Show when={props.activeTab === 'collectibles'}>
								<button
									type="button"
									onClick={handleCycleTrending}
									class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#1b232d] hover:bg-[#232d3a] border border-white/[0.08] text-[11px] font-medium text-[#c7d0d9] hover:text-white transition-colors active:scale-95 group"
								>
									<span
										class={`material-symbols-outlined text-[14px] text-[#2990FF] transition-transform duration-300 ${isRotating() ? 'rotate-180' : ''}`}
									>
										cached
									</span>
									<span>{t(currentTrendingPool().categoryKey)}</span>
								</button>
							</Show>
						</div>

						<div class="flex flex-wrap justify-center gap-2 w-full" dir="ltr">
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
										class="group px-3 py-1.5 rounded-[10px] bg-[#1b232d] hover:bg-[#232d3a] text-[#d0d7dd] hover:text-white text-[12.5px] font-mono font-medium transition-colors active:scale-95 flex items-center gap-1 border border-white/[0.07] hover:border-[#2990FF]/40"
									>
										<Show when={props.activeTab === 'username'}>
											<span class="text-[#2990FF]">@</span>
										</Show>
										<Show when={props.activeTab === 'collectibles' && !item.startsWith('+')}>
											<span class="text-[#2990FF] font-semibold">+888 </span>
										</Show>
										<span>{item}</span>
										<span class="material-symbols-outlined text-[13px] text-[#60707c] group-hover:text-[#2990FF] transition-colors">
											arrow_outward
										</span>
									</button>
								)}
							</For>
						</div>
					</Motion.div>
				</div>
			</div>

			{/* ━━━ NO CREDITS MODAL ━━━ */}
			<Show when={showNoCreditsModal()}>
				<div class="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/75 backdrop-blur-md">
					<div class="frag-sheet w-full max-w-sm rounded-[20px] p-6 flex flex-col items-center text-center">
						<div class="w-12 h-12 rounded-[12px] bg-[#ffb340]/12 border border-[#ffb340]/25 flex items-center justify-center mb-4">
							<span class="material-symbols-outlined text-[#ffb340] text-[24px]">bolt</span>
						</div>
						<h3 class="text-[17px] font-semibold text-white mb-1.5">{t('noCreditsModal.title')}</h3>
						<p class="text-[12.5px] text-[#8c9ba5] mb-5 leading-relaxed">
							{t('noCreditsModal.description')}
						</p>
						<button
							type="button"
							onClick={() => {
								setShowNoCreditsModal(false);
								navigate('/leaderboard');
							}}
							class="frag-btn-primary w-full h-11 px-5 rounded-[11px] font-semibold text-[13px] mb-2.5"
						>
							{t('noCreditsModal.earnCredits') || 'Earn free credits'}
						</button>
						<button
							type="button"
							onClick={() => {
								setShowNoCreditsModal(false);
								window.open('https://t.me/FragmentInvestors', '_blank');
							}}
							class="frag-btn-secondary w-full h-10 px-5 rounded-[11px] font-medium text-[12.5px]"
						>
							{'@FragmentInvestors'}
						</button>
					</div>
				</div>
			</Show>

			{/* ━━━ NUMBER FORMAT GUIDE MODAL ━━━ */}
			<Show when={showNumberGuide()}>
				<div class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
					<div class="frag-sheet w-full max-w-sm rounded-[20px] p-5 flex flex-col items-center text-center">
						<div class="w-12 h-12 rounded-[12px] bg-[#2990FF]/12 border border-[#2990FF]/25 flex items-center justify-center mb-3 text-[#2990FF]">
							<span class="material-symbols-outlined text-[24px]">dialpad</span>
						</div>
						<h3 class="text-[16px] font-semibold text-white mb-1">
							{t('numbers.formatGuideTitle')}
						</h3>
						<p class="text-[12px] text-[#8c9ba5] mb-4 leading-relaxed">
							{t('numbers.formatGuideSubtitle')}
						</p>

						<div class="w-full space-y-2.5 mb-4 text-start">
							<div class="p-3 rounded-[12px] bg-[#4cd964]/10 border border-[#4cd964]/25">
								<span class="text-[11px] font-semibold text-[#4cd964] flex items-center gap-1 mb-1.5">
									<span class="material-symbols-outlined text-[14px]">check_circle</span>
									{t('numbers.formatValidBadge')}
								</span>
								<div class="space-y-1 text-[12px] font-mono text-white/90" dir="ltr">
									<button
										type="button"
										onClick={() => {
											updateSearchQuery('00000000');
											setShowNumberGuide(false);
										}}
										class="w-full text-left px-2 py-1 rounded-[6px] hover:bg-[#4cd964]/15 flex items-center justify-between transition-colors"
									>
										<span>+888 0000 0000</span>
										<span class="text-[10.5px] font-frag-sans text-[#4cd964]">
											{t('numbers.formatEightDigits')}
										</span>
									</button>
									<button
										type="button"
										onClick={() => {
											updateSearchQuery('8000');
											setShowNumberGuide(false);
										}}
										class="w-full text-left px-2 py-1 rounded-[6px] hover:bg-[#4cd964]/15 flex items-center justify-between transition-colors"
									>
										<span>+888 8000</span>
										<span class="text-[10.5px] font-frag-sans text-[#4cd964]">
											{t('numbers.formatFourDigitsGenesis')}
										</span>
									</button>
								</div>
							</div>

							<div class="p-3 rounded-[12px] bg-[#ff5c6c]/10 border border-[#ff5c6c]/25">
								<span class="text-[11px] font-semibold text-[#ff5c6c] flex items-center gap-1 mb-1.5">
									<span class="material-symbols-outlined text-[14px]">cancel</span>
									{t('numbers.formatInvalidBadge')}
								</span>
								<div class="space-y-1 text-[12px] font-mono text-[#8c9ba5]" dir="ltr">
									<div class="flex items-center justify-between px-2 py-1">
										<span class="line-through">+98 912…</span>
										<span class="text-[10.5px] font-frag-sans text-[#ff5c6c]">Cellular / SIM</span>
									</div>
									<div class="flex items-center justify-between px-2 py-1">
										<span class="line-through">+888 12</span>
										<span class="text-[10.5px] font-frag-sans text-[#ff5c6c]">&lt; 4 digits</span>
									</div>
								</div>
							</div>
						</div>

						<button
							type="button"
							onClick={() => setShowNumberGuide(false)}
							class="frag-btn-primary w-full h-11 px-5 rounded-[11px] font-semibold text-[13px]"
						>
							{t('common.close')}
						</button>
					</div>
				</div>
			</Show>
		</main>
	);
};
