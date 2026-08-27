import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, onMount, Show } from 'solid-js';
import { giftsApi } from '@/entities/gifts/api/giftsApi.js';
import { creditsApi } from '@/entities/intel/api/creditsApi.js';
import { numbersApi } from '@/entities/numbers/api/numbersApi.js';
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

export const ActionArea: Component<ActionAreaProps> = (props) => {
	const { searchQuery, setSearchQuery, searchError, setSearchError, validate } =
		useUsernameSearch();
	const navigate = useNavigate();
	const [analyzeState, setAnalyzeState] = createSignal<AnalyzeState>('idle');
	const [isFocused, setIsFocused] = createSignal(false);
	const [credits, setCredits] = createSignal<number>(3);
	const [showNoCreditsModal, setShowNoCreditsModal] = createSignal(false);
	const [showNumberGuide, setShowNumberGuide] = createSignal(false);
	let autoGuideTimeout: any = null;

	const [trendingUsernames] = createSignal<string[]>(getRandomTrending(4));
	const [trendingNumbers, setTrendingNumbers] = createSignal<string[]>([]);
	const [trendingGifts, setTrendingGifts] = createSignal<string[]>([]);

	const toAsciiDigits = (str: string): string => {
		return str
			.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
			.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
	};

	const numbersValidation = createMemo(() => {
		if (props.activeTab !== 'collectibles') {
			return { isValid: false, cleanDigits: '', error: null, tier: '', chips: [] };
		}
		const raw = toAsciiDigits(searchQuery().trim());
		if (!raw) {
			return { isValid: false, cleanDigits: '', error: null, tier: '', chips: [] };
		}

		// Strip +888 or 888 if present
		let digitsOnly = raw.replace(/[^\d]/g, '');
		if (digitsOnly.startsWith('888') && digitsOnly.length > 3) {
			digitsOnly = digitsOnly.substring(3);
		}

		if (/[^\d\s\(\)\-]/.test(raw)) {
			return {
				isValid: false,
				cleanDigits: digitsOnly,
				error: 'فقط ارقام مجاز است (Invalid characters)',
				tier: '',
				chips: [],
			};
		}

		if (digitsOnly.length > 8) {
			return {
				isValid: false,
				cleanDigits: digitsOnly,
				error: 'Too long / حداکثر ۸ رقم مجاز است',
				tier: '',
				chips: [],
			};
		}

		if (digitsOnly.length > 0 && digitsOnly.length < 4) {
			return {
				isValid: false,
				cleanDigits: digitsOnly,
				error: 'خیلی کوتاه است (حداقل ۴ رقم نیاز است)',
				tier: '',
				chips: [],
			};
		}

		// Determine Pattern Tier & Teaser Chips
		let tier = 'STANDARD TIER';
		const chips: string[] = ['سنجش در ۱۳۶,۵۶۶ شماره کلکسیونی', '۲۷ سیگنال ریاضی آماده تحلیل'];

		if (digitsOnly.length === 4) {
			tier = '4-DIGIT ULTRA (GENESIS)';
			chips.unshift('💎 شماره فوق نایاب ۴ رقمی جنسیس');
		} else if (/^(.)\1+$/.test(digitsOnly) || digitsOnly.includes('8888') || digitsOnly.includes('7777') || digitsOnly.includes('0000')) {
			tier = 'GRAIL TIER (QUAD REPEAT)';
			chips.unshift('👑 الگوی فوق‌کمیاب رده افسانه‌ای (Grail)');
		} else {
			// Palindrome check
			const rev = digitsOnly.split('').reverse().join('');
			if (digitsOnly === rev) {
				tier = 'APEX TIER (MIRROR PALINDROME)';
				chips.unshift('🪞 تقارن آینه‌ای کامل ارقام');
			} else if (
				digitsOnly === '12345678' ||
				digitsOnly === '87654321' ||
				digitsOnly === '01234567' ||
				digitsOnly === '1234'
			) {
				tier = 'APEX TIER (LADDER SEQUENCE)';
				chips.unshift('📈 توالی پیوسته پله‌ای ارقام');
			} else {
				const distinct = new Set(digitsOnly.split('')).size;
				if (distinct <= 2) {
					tier = 'GRAND TIER (BINARY DUAL)';
					chips.unshift('⚡ ترکیب نادر دو رقمی (Binary)');
				}
			}
		}

		return {
			isValid: true,
			cleanDigits: digitsOnly,
			error: null,
			tier,
			chips,
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
			if (nIntel.trending_tail && nIntel.trending_tail.length > 0) {
				setTrendingNumbers(nIntel.trending_tail.slice(0, 4).map((x) => x.label));
			} else if (nIntel.hall_of_fame && nIntel.hall_of_fame.length > 0) {
				setTrendingNumbers(nIntel.hall_of_fame.slice(0, 4).map((x) => x.display_number));
			}
		} catch (_e) {}

		try {
			const gIntel = await giftsApi.getIntel();
			if (gIntel.trending_models && gIntel.trending_models.length > 0) {
				setTrendingGifts(gIntel.trending_models.slice(0, 4).map((m) => m.name));
			}
		} catch (_e) {}
	});

	const trendingItems = createMemo(() => {
		if (props.activeTab === 'collectibles') {
			return trendingNumbers().length > 0
				? trendingNumbers()
				: ['+888 8888 8888', '+888 0000 0000', '+888 7777 7777', '+888 1234 5678'];
		}
		if (props.activeTab === 'gifts') {
			return trendingGifts().length > 0
				? trendingGifts()
				: ['Plush Pepe', "Durov's Black Cap", 'Phoenix Feather', 'Celestial Star'];
		}
		return trendingUsernames();
	});

	const handleAnalyze = async () => {
		if (analyzeState() !== 'idle') return;

		if (props.activeTab === 'collectibles') {
			const v = numbersValidation();
			if (!v.isValid || !v.cleanDigits) return;
			try {
				haptic.impact('medium');
			} catch {}
			setAnalyzeState('loading');
			navigate(`/numbers/report?n=${encodeURIComponent('+888' + v.cleanDigits)}`);
			setAnalyzeState('idle');
			return;
		}

		if (!searchQuery() || searchError()) return;
		try {
			haptic.impact('medium');
		} catch {}

		setAnalyzeState('loading');

		if (props.activeTab === 'gifts') {
			let q = searchQuery().trim();
			const m = q.match(/t\.me\/nft\/([A-Za-z0-9_]+)-?(\d*)/i);
			if (m) {
				q = `${m[1].toLowerCase()}-${m[2] || '1'}`;
			}

			if (q.startsWith('@') || (!q.includes('-') && !q.includes('_') && !/\d/.test(q))) {
				setAnalyzeState('idle');
				navigate(`/gifts/portfolio?u=${encodeURIComponent(q.replace(/^@/, ''))}`);
			} else {
				setAnalyzeState('idle');
				navigate(`/gifts/report?g=${encodeURIComponent(q)}`);
			}
		} else {
			if (validate(searchQuery(), props.activeTab)) {
				setAnalyzeState('idle');
				navigate(`/username/report?u=${encodeURIComponent(searchQuery())}`);
			} else {
				setAnalyzeState('idle');
				try {
					haptic.notify('error');
				} catch {}
			}
		}
	};

	const updateSearchQuery = (val: string) => {
		if (props.activeTab === 'collectibles') {
			const ascii = toAsciiDigits(val);
			let cleaned = ascii.replace(/^\+?888\s*/, '').replace(/[^\d\s]/g, '');
			setSearchQuery(cleaned);

			if (autoGuideTimeout) clearTimeout(autoGuideTimeout);

			// Auto-open format guide if invalid after 2.5 seconds
			if (cleaned.trim().length > 0) {
				const digits = cleaned.replace(/[^\d]/g, '');
				if (digits.length < 4 || digits.length > 8) {
					autoGuideTimeout = setTimeout(() => {
						setShowNumberGuide(true);
					}, 2500);
				} else {
					setShowNumberGuide(false);
				}
			} else {
				setShowNumberGuide(false);
			}
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

	const getButtonText = () => {
		if (analyzeState() === 'loading') return t('action.analyzing');
		if (analyzeState() === 'success') return t('home.success');
		if (props.activeTab === 'username') return t('action.username.analyzeMarketBtn');
		if (props.activeTab === 'gifts') return t('action.gifts.analyzeBtn');
		return t(keys().analyzeBtn);
	};

	const inputStateColors = createMemo(() => {
		if (props.activeTab === 'collectibles') {
			const v = numbersValidation();
			if (v.error && searchQuery().trim().length > 0) {
				return {
					glow: 'rgba(255,69,58,0.4)',
					glowSoft: 'rgba(255,69,58,0.1)',
					borderTop: 'rgba(255,69,58,0.6)',
					borderBottom: 'rgba(255,69,58,0.15)',
					bg: '#140c0c',
					icon: '#ff453a',
				};
			}
			if (v.isValid) {
				return {
					glow: 'rgba(48,209,88,0.4)',
					glowSoft: 'rgba(48,209,88,0.1)',
					borderTop: 'rgba(48,209,88,0.6)',
					borderBottom: 'rgba(48,209,88,0.15)',
					bg: '#0a140d',
					icon: '#30d158',
				};
			}
		}

		const isError = searchError();
		const isSuccess = searchQuery() && !isError;

		if (isError) {
			return {
				glow: 'rgba(255,69,58,0.4)',
				glowSoft: 'rgba(255,69,58,0.1)',
				borderTop: 'rgba(255,69,58,0.6)',
				borderBottom: 'rgba(255,69,58,0.15)',
				bg: '#140c0c',
				icon: '#ff453a',
			};
		}
		if (isSuccess) {
			return {
				glow: 'rgba(48,209,88,0.4)',
				glowSoft: 'rgba(48,209,88,0.1)',
				borderTop: 'rgba(48,209,88,0.6)',
				borderBottom: 'rgba(48,209,88,0.15)',
				bg: '#0a140d',
				icon: '#30d158',
			};
		}
		return {
			glow: 'rgba(51,144,236,0.5)',
			glowSoft: 'rgba(51,144,236,0.15)',
			borderTop: isFocused() ? 'rgba(51,144,236,0.5)' : 'rgba(255,255,255,0.25)',
			borderBottom: isFocused() ? 'rgba(51,144,236,0.1)' : 'rgba(255,255,255,0.08)',
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
						class="text-center w-full mb-10 flex flex-col items-center"
					>
						<div class="flex items-center justify-center gap-3 mb-6">
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

						<h2 class="text-[34px] md:text-[44px] font-extrabold tracking-tight leading-[1.2] mb-3 text-white">
							{t(keys().title)}
						</h2>
						<p class="text-white/50 text-[15px] font-medium max-w-[400px] leading-[1.6] mx-auto">
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
										<div class="bg-black/30 px-2 py-1 rounded-lg">8888 <span class="text-[9px] text-emerald-400">✓ (4 Digits)</span></div>
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
								background: 'rgba(20, 20, 22, 0.4)',
								border: `1px solid ${inputStateColors().borderTop}`,
								'box-shadow': isFocused()
									? '0 20px 40px -10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
									: '0 10px 30px -10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02)',
							}}
						>
							<div class="flex flex-col p-2">
								{/* Input Row */}
								<div class="flex items-center px-3 py-3 gap-2.5" dir="ltr">
									<Show
										when={props.activeTab === 'collectibles'}
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
												{props.activeTab === 'username' ? '@' : ''}
											</span>
										}
									>
										{/* Fixed +888 Prefix Badge */}
										<div class="px-3 py-1.5 rounded-xl bg-[#0098EA]/15 border border-[#0098EA]/30 text-[#0098EA] font-mono font-black text-sm select-none shrink-0 flex items-center gap-1 shadow-sm">
											<span>+888</span>
										</div>
									</Show>

									<input
										id="search-input"
										class="flex-1 bg-transparent border-none focus:ring-0 outline-none text-left font-mono text-[20px] font-bold text-white placeholder:text-white/20 tracking-wider"
										placeholder={
											props.activeTab === 'collectibles'
												? '8888 8888'
												: t(keys().inputPlaceholder)
										}
										value={searchQuery()}
										onInput={(e) => updateSearchQuery(e.currentTarget.value)}
										onFocus={() => setIsFocused(true)}
										onBlur={() => setIsFocused(false)}
										autocomplete="off"
										spellcheck={false}
									/>
									<Show when={searchQuery()}>
										<div class="flex items-center shrink-0">
											<button
												type="button"
												onClick={() => {
													setSearchQuery('');
													setShowNumberGuide(false);
												}}
												class="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/10 text-white/40 hover:text-white transition-all flex items-center justify-center"
											>
												<span class="material-symbols-outlined text-[18px]">close</span>
											</button>
										</div>
									</Show>
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

								{/* Reactive Realtime Validation & Teasers for Collectible Numbers */}
								<Show when={props.activeTab === 'collectibles' && searchQuery().trim().length > 0}>
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
												راهنمای فرمت
											</button>
										</div>
									</Show>

									<Show when={numbersValidation().isValid}>
										<div class="px-3 pb-3 pt-1 border-t border-white/5 space-y-2 animate-in fade-in">
											<div class="flex items-center justify-between">
												<span class="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
													<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
													{t('numbers.validNumberReady')}
												</span>
												<span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
													{numbersValidation().tier}
												</span>
											</div>

											{/* Pattern Teaser Chips */}
											<div class="flex flex-wrap gap-1.5">
												<For each={numbersValidation().chips}>
													{(chip) => (
														<span class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/80">
															{chip}
														</span>
													)}
												</For>
											</div>
										</div>
									</Show>
								</Show>
							</div>
						</div>

						{/* Analyze Button */}
						<button
							type="button"
							onClick={handleAnalyze}
							disabled={
								analyzeState() === 'loading' ||
								(props.activeTab === 'collectibles'
									? !numbersValidation().isValid
									: !searchQuery() || !!searchError())
							}
							class="relative w-full h-[60px] rounded-[22px] font-black text-[15px] flex items-center justify-center gap-2 transition-all duration-300 overflow-hidden group mt-4"
							style={{
								background:
									analyzeState() === 'success'
										? 'linear-gradient(135deg, #28a745, #30d158)'
										: (props.activeTab === 'collectibles' && !numbersValidation().isValid) ||
											  (props.activeTab !== 'collectibles' && (!searchQuery() || !!searchError()))
											? 'rgba(255,255,255,0.04)'
											: 'linear-gradient(135deg, #ffffff, #e0e0e0)',
								color:
									analyzeState() === 'success'
										? '#fff'
										: (props.activeTab === 'collectibles' && !numbersValidation().isValid) ||
											  (props.activeTab !== 'collectibles' && (!searchQuery() || !!searchError()))
											? 'rgba(255,255,255,0.25)'
											: '#000',
								cursor:
									(props.activeTab === 'collectibles' && !numbersValidation().isValid) ||
									(props.activeTab !== 'collectibles' && (!searchQuery() || !!searchError()))
										? 'not-allowed'
										: 'pointer',
								'box-shadow':
									(props.activeTab === 'collectibles' && numbersValidation().isValid) ||
									(props.activeTab !== 'collectibles' && searchQuery() && !searchError())
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
							<Show
								when={
									analyzeState() === 'idle' &&
									((props.activeTab === 'collectibles' && numbersValidation().isValid) ||
										(props.activeTab !== 'collectibles' && searchQuery() && !searchError()))
								}
							>
								<span class="material-symbols-outlined text-[18px] rtl:rotate-180 relative z-10 group-hover:translate-x-1 transition-transform">
									arrow_forward
								</span>
							</Show>
						</button>
					</Motion.div>

					{/* ━━━ TAB-AWARE TRENDING (FILLING INPUT WITHOUT NAVIGATING) ━━━ */}
					<Motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.5, delay: 0.2 }}
						class="w-full mb-8 flex flex-col items-center"
						dir="ltr"
					>
						<span class="text-[11px] font-semibold text-white/30 uppercase tracking-[0.25em] mb-4">
							{t('action.trending.title')}
						</span>
						<div class="flex flex-wrap justify-center gap-2.5">
							<For each={trendingItems()}>
								{(item, idx) => (
									<Motion.button
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{
											duration: 0.4,
											delay: 0.25 + idx() * 0.05,
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
										class="px-4 py-2.5 rounded-[14px] bg-white/[0.03] hover:bg-white/[0.08] text-white/60 text-[13px] font-medium transition-all duration-300 active:scale-95 flex items-center gap-1 hover:text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] border border-white/[0.02]"
									>
										<Show when={props.activeTab === 'username'}>
											<span class="text-white/20">@</span>
										</Show>
										<Show when={props.activeTab === 'collectibles' && !item.startsWith('+')}>
											<span class="text-white/20">+888 </span>
										</Show>
										<span>{item}</span>
									</Motion.button>
								)}
							</For>
						</div>
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
		</main>
	);
};
