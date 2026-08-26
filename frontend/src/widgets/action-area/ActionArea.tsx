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

	const [trendingUsernames] = createSignal<string[]>(getRandomTrending(4));
	const [trendingNumbers, setTrendingNumbers] = createSignal<string[]>([]);
	const [trendingGifts, setTrendingGifts] = createSignal<string[]>([]);

	const keys = createMemo(() => CONTENT[props.activeTab]);

	onMount(async () => {
		// 1. Fetch user credit balance
		try {
			const creditData = await creditsApi.getCredits();
			setCredits(creditData.balance);
		} catch (_e) {}

		// 2. Fetch live trending numbers and gifts from backend APIs
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
		if (analyzeState() !== 'idle' || !searchQuery() || searchError()) return;
		try {
			haptic.impact('medium');
		} catch {}

		setAnalyzeState('loading');

		if (props.activeTab === 'gifts') {
			let q = searchQuery().trim();
			// Parse t.me/nft link
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
		} else if (props.activeTab === 'collectibles') {
			setAnalyzeState('idle');
			navigate(`/numbers/report?n=${encodeURIComponent(searchQuery())}`);
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

	const getPrefix = () => {
		if (props.activeTab === 'username') return '@';
		if (props.activeTab === 'collectibles') return '+';
		return '';
	};

	const inputStateColors = createMemo(() => {
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
								<div class="flex items-center px-4 py-4 gap-2" dir="ltr">
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
										{getPrefix()}
									</span>
									<input
										id="search-input"
										class="flex-1 bg-transparent border-none focus:ring-0 outline-none text-left font-sans text-[22px] font-semibold text-white placeholder:text-white/20 tracking-wide"
										placeholder={t(keys().inputPlaceholder)}
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
												onClick={() => setSearchQuery('')}
												class="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/10 text-white/40 hover:text-white transition-all flex items-center justify-center"
											>
												<span class="material-symbols-outlined text-[18px]">close</span>
											</button>
										</div>
									</Show>
								</div>

								{/* Error */}
								<Show when={searchError()}>
									<Motion.div
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: 'auto' }}
										class="px-5 pb-3 flex items-center gap-2"
									>
										<span class="material-symbols-outlined text-[15px] text-[#ff453a]">error</span>
										<span class="text-[13px] font-medium text-[#ff453a]">{searchError()}</span>
									</Motion.div>
								</Show>
							</div>
						</div>

						{/* Analyze Button */}
						<button
							type="button"
							onClick={handleAnalyze}
							disabled={analyzeState() === 'loading' || !searchQuery() || !!searchError()}
							class="relative w-full h-[60px] rounded-[22px] font-semibold text-[15px] flex items-center justify-center gap-2 transition-all duration-300 overflow-hidden group mt-4"
							style={{
								background:
									analyzeState() === 'success'
										? 'linear-gradient(135deg, #28a745, #30d158)'
										: !searchQuery() || searchError()
											? 'rgba(255,255,255,0.04)'
											: 'linear-gradient(135deg, #ffffff, #e0e0e0)',
								color:
									analyzeState() === 'success'
										? '#fff'
										: !searchQuery() || searchError()
											? 'rgba(255,255,255,0.25)'
											: '#000',
								cursor: !searchQuery() || searchError() ? 'not-allowed' : 'pointer',
								'box-shadow':
									searchQuery() && !searchError() && analyzeState() === 'idle'
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
							<Show when={analyzeState() === 'idle' && searchQuery() && !searchError()}>
								<span class="material-symbols-outlined text-[18px] rtl:rotate-180 relative z-10 group-hover:translate-x-1 transition-transform">
									arrow_forward
								</span>
							</Show>
						</button>
					</Motion.div>

					{/* ━━━ TAB-AWARE TRENDING ━━━ */}
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
											if (props.activeTab === 'collectibles') {
												navigate(
													`/numbers/report?n=${encodeURIComponent(item.replace(/^\+/, ''))}`,
												);
											} else if (props.activeTab === 'gifts') {
												const slug = item
													.toLowerCase()
													.replace(/[^a-z0-9]+/g, '_')
													.replace(/^_+|_+$/g, '');
												navigate(`/gifts/report?g=${encodeURIComponent(slug)}-1`);
											} else {
												updateSearchQuery(item);
												document.getElementById('search-input')?.focus();
											}
										}}
										class="px-4 py-2.5 rounded-[14px] bg-white/[0.03] hover:bg-white/[0.08] text-white/60 text-[13px] font-medium transition-all duration-300 active:scale-95 flex items-center gap-1 hover:text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] border border-white/[0.02]"
									>
										<Show when={props.activeTab === 'username'}>
											<span class="text-white/20">@</span>
										</Show>
										<Show when={props.activeTab === 'collectibles' && !item.startsWith('+')}>
											<span class="text-white/20">+</span>
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
