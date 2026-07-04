import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, createMemo, createSignal, For, Show, onMount, onCleanup } from 'solid-js';
import {
	useUsernameQuickAnalysis,
} from '@/entities/username/api/index.js';
import { useUsernameSearch } from '@/entities/username/model/index.js';
import { getRandomTrending } from '@/entities/username/model/trendingList.js';
import { type DictPaths, formatNumber, t } from '@/shared/i18n/index.js';
import { showAlert } from '@/shared/lib/telegram-native.js';
interface ActionAreaProps {
	activeTab: 'username' | 'collectibles' | 'gifts';
	onTabChange?: (tab: 'username' | 'collectibles' | 'gifts') => void;
}

type AnalyzeState = 'idle' | 'loading' | 'success';

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


export const ActionArea: Component<ActionAreaProps> = (props) => {
	const { searchQuery, setSearchQuery, searchError, setSearchError, validate } = useUsernameSearch();
	const navigate = useNavigate();
	const [analyzeState, setAnalyzeState] = createSignal<AnalyzeState>('idle');
	const [isFocused, setIsFocused] = createSignal(false);
	const [showCollectionTooltip, setShowCollectionTooltip] = createSignal(true);

	const quickAnalysis = useUsernameQuickAnalysis(() => searchQuery());

	const [trendingList] = createSignal(getRandomTrending(4));

	const keys = createMemo(() => CONTENT[props.activeTab]);
	const charCount = createMemo(() => searchQuery().length);

	const handleAnalyze = async () => {
		if (analyzeState() !== 'idle' || !searchQuery() || searchError()) return;
		if (validate(searchQuery(), props.activeTab)) {
			try {
				hapticFeedback.impactOccurred('medium');
			} catch {}
			setAnalyzeState('loading');
			try {
				// Call the backend AVM algorithm directly
				const res = await fetch(`/api/v1/usernames/${searchQuery()}/valuate`, {
					method: 'POST',
				});
				const data = await res.json();
				
				setAnalyzeState('success');
				
				// Show the AVM result to the user
				if (data && data.expected_ton) {
					showAlert(`✅ ارزش تخمینی: ${data.expected_ton} TON\nبازه قیمت: ${data.low_ton} تا ${data.high_ton} TON\nمدل: ${data.model_version}`);
				} else {
					showAlert('❌ خطا در ارتباط با موتور ارزش‌گذاری');
				}
				
				setTimeout(() => {
					setAnalyzeState('idle');
				}, 2000);
			} catch (err) {
				setAnalyzeState('idle');
				showAlert('❌ خطا در ارتباط با سرور');
			}
		} else {
			try {
				hapticFeedback.notificationOccurred('error');
			} catch {}
		}
	};

	const updateSearchQuery = (val: string) => {
		const stripped = val.replace(/^[@+]/, '');
		setSearchQuery(stripped);
		if (stripped.length > 0) {
			validate(stripped, props.activeTab);
		} else {
			setSearchError(null);
		}
	};

	const getButtonText = () => {
		if (analyzeState() === 'loading') return t('action.analyzing');
		if (analyzeState() === 'success') return t('home.success');
		if (props.activeTab === 'username') return t('action.username.analyzeMarketBtn');
		return t(keys().analyzeBtn);
	};

	const getPrefix = () => {
		if (props.activeTab === 'username') return '@';
		if (props.activeTab === 'collectibles') return '+';
		return '';
	};

	// Determine the semantic color of the input field based on validation
	const inputStateColors = createMemo(() => {
		const isError = searchError() || (searchQuery() && charCount() < 4);
		const isSuccess = searchQuery() && !isError;

		if (isError) {
			return {
				glow: 'rgba(255,69,58,0.4)',
				glowSoft: 'rgba(255,69,58,0.1)',
				borderTop: 'rgba(255,69,58,0.6)',
				borderBottom: 'rgba(255,69,58,0.15)',
				bg: '#140c0c', // subtle red tint background
				icon: '#ff453a'
			};
		}
		if (isSuccess) {
			return {
				glow: 'rgba(48,209,88,0.4)',
				glowSoft: 'rgba(48,209,88,0.1)',
				borderTop: 'rgba(48,209,88,0.6)',
				borderBottom: 'rgba(48,209,88,0.15)',
				bg: '#0a140d', // subtle green tint background
				icon: '#30d158'
			};
		}
		// Empty / Default state
		return {
			glow: 'rgba(51,144,236,0.5)',
			glowSoft: 'rgba(51,144,236,0.15)',
			borderTop: isFocused() ? 'rgba(51,144,236,0.5)' : 'rgba(255,255,255,0.25)',
			borderBottom: isFocused() ? 'rgba(51,144,236,0.1)' : 'rgba(255,255,255,0.08)',
			bg: '#111214',
			icon: isFocused() ? '#3390ec' : 'rgba(255,255,255,0.4)'
		};
	});

	return (
		<main class="action-area w-full relative overflow-visible font-sans pb-20" aria-label="Analysis section">
			{/* Ambient light */}
			<div
				class="absolute top-[20%] left-1/2 -translate-x-1/2 w-[70%] h-[40%] rounded-full pointer-events-none transition-all duration-1000 z-0"
				style={{
					background: `radial-gradient(ellipse, ${isFocused() ? 'rgba(51,144,236,0.15)' : 'rgba(51,144,236,0.05)'} 0%, transparent 70%)`,
					filter: 'blur(60px)',
				}}
			/>

			<div class="relative z-10 w-full max-w-[520px] mx-auto pt-8 px-5">
				<Show
					when={props.activeTab === 'username'}
					fallback={
						<Motion.div
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5 }}
							class="w-full rounded-[28px] bg-[#111214] border border-white/[0.06] p-8 flex flex-col items-center justify-center text-center relative overflow-hidden"
						>
							<div class="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

							<div class="w-16 h-16 rounded-[20px] bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6 relative">
								<span
									class="material-symbols-outlined text-[28px] text-white/70"
									style={{ 'font-variation-settings': '"wght" 300' }}
								>
									{props.activeTab === 'collectibles' ? 'tag' : 'featured_seasonal_and_gifts'}
								</span>
								<div class="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#111214] border border-white/10 flex items-center justify-center">
									<span class="material-symbols-outlined text-[12px] text-white/40">lock</span>
								</div>
							</div>

							<span class="px-3 py-1 bg-white/[0.04] border border-white/[0.08] rounded-full text-[10px] font-semibold tracking-[0.15em] uppercase text-white/50 mb-5">
								{t('action.comingSoon.badge')}
							</span>

							<h3 class="text-xl font-semibold text-white/90 tracking-tight mb-3">
								{t('action.comingSoon.title')}
							</h3>
							<p class="text-white/35 text-[13px] leading-[1.7] max-w-[90%] mb-8">
								{t('action.comingSoon.description')}
							</p>

							<button
								onClick={() => {
									try {
										hapticFeedback.impactOccurred('medium');
									} catch {}
									props.onTabChange?.('username');
									window.scrollTo({ top: 0, behavior: 'smooth' });
								}}
								class="px-7 py-3 rounded-full bg-white text-black font-semibold text-[13px] flex items-center gap-2 hover:brightness-90 active:scale-[0.97] transition-all"
							>
								<span>{t('action.comingSoon.btn')}</span>
							</button>
						</Motion.div>
					}
				>
					<div class="flex flex-col w-full">
						{/* ━━━ HEADER ━━━ */}
						<Motion.div
							initial={{ opacity: 0, y: 16 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.7, easing: [0.16, 1, 0.3, 1] }}
							class="text-center w-full mb-10 flex flex-col items-center"
						>
							<div class="flex items-center justify-center gap-3 mb-6">
								<button 
									onClick={() => {
										props.onTabChange?.('username');
										setTimeout(() => {
											document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
										}, 100);
									}}
									class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.1)] hover:bg-white/[0.08] transition-colors"
								>
									<div class="w-1.5 h-1.5 rounded-full bg-[#3390ec] shadow-[0_0_8px_#3390ec]" />
									<span class="text-[10px] font-semibold text-white/70 tracking-[0.2em] uppercase">
										{t('home.premiumReport')}
									</span>
								</button>
								<div class="relative">
									<Show when={showCollectionTooltip()}>
										<Motion.div
											initial={{ opacity: 0, scale: 0.9, y: 10 }}
											animate={{ opacity: 1, scale: 1, y: 0 }}
											exit={{ opacity: 0, scale: 0.9 }}
											class="absolute bottom-[130%] left-1/2 -translate-x-1/2 w-max max-w-[200px] bg-[#3390ec] text-white text-[12px] font-bold p-3 rounded-2xl shadow-[0_10px_25px_rgba(51,144,236,0.4)] z-50 flex flex-col gap-2"
										>
											<div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#3390ec] rotate-45 rounded-sm"></div>
											<div class="relative z-10 flex items-start justify-between gap-3">
												<span class="leading-relaxed text-right">{t('home.collectionSubtitle')}</span>
												<button
													onClick={(e) => {
														e.stopPropagation();
														setShowCollectionTooltip(false);
													}}
													class="mt-0.5 opacity-80 hover:opacity-100 p-0.5 shrink-0 active:scale-95 transition-transform"
													aria-label="Close tooltip"
												>
													<span class="material-symbols-outlined text-[14px]">close</span>
												</button>
											</div>
										</Motion.div>
									</Show>
									<button 
										onClick={() => navigate('/collection-info')}
										class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.1)] hover:bg-white/[0.08] transition-colors"
									>
										<span class="material-symbols-outlined text-[14px] text-white/70">collections_bookmark</span>
										<span class="text-[10px] font-semibold text-white/70 tracking-[0.2em] uppercase">
											{t('home.collectionInfo')}
										</span>
									</button>
								</div>
							</div>
							<h2 class="text-[34px] md:text-[44px] font-extrabold tracking-tight leading-[1.2] mb-3 text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40">
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
									background: (isFocused() || searchQuery())
										? `linear-gradient(135deg, ${inputStateColors().glow}, transparent, ${inputStateColors().glowSoft})`
										: 'transparent',
									filter: 'blur(20px)',
									opacity: (isFocused() || searchQuery()) ? 0.4 : 0,
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
											style={{ color: isFocused() ? (searchQuery() ? inputStateColors().icon : '#3390ec') : 'rgba(255,255,255,0.2)' }}
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



									{/* Analyze Button */}
									<button
										onClick={handleAnalyze}
										disabled={analyzeState() === 'loading' || !searchQuery() || !!searchError()}
										class="relative w-full h-[60px] rounded-[22px] font-semibold text-[15px] flex items-center justify-center gap-2 transition-all duration-300 overflow-hidden group mt-1"
										style={{
											background:
												analyzeState() === 'success'
													? 'linear-gradient(135deg, #28a745, #30d158)'
													: !searchQuery() || !!searchError()
														? 'rgba(255,255,255,0.04)'
														: 'linear-gradient(135deg, #ffffff, #e0e0e0)',
											color:
												analyzeState() === 'success'
													? '#fff'
													: !searchQuery() || !!searchError()
														? 'rgba(255,255,255,0.25)'
														: '#000',
											cursor: !searchQuery() || !!searchError() ? 'not-allowed' : 'pointer',
											'box-shadow':
												searchQuery() && !searchError() && analyzeState() === 'idle'
													? '0 8px 24px -6px rgba(255,255,255,0.2)'
													: 'none',
										}}
									>
										<Show when={analyzeState() === 'loading'}>
											<div class="w-5 h-5 rounded-full border-[2.5px] border-black/20 border-t-black animate-spin" />
										</Show>
										<span class="relative z-10 transition-transform group-hover:scale-[1.02]">{getButtonText()}</span>
										<Show when={analyzeState() === 'idle' && searchQuery() && !searchError()}>
											<span class="material-symbols-outlined text-[18px] rtl:rotate-180 relative z-10 group-hover:translate-x-1 transition-transform">
												arrow_forward
											</span>
										</Show>
									</button>
								</div>
							</div>
						</Motion.div>

						{/* ━━━ TRENDING ━━━ */}
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
								<For each={trendingList()}>
									{(item, idx) => (
										<Motion.button
											initial={{ opacity: 0, y: 10 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.4, delay: 0.25 + idx() * 0.05, easing: [0.16, 1, 0.3, 1] }}
											onClick={() => {
												updateSearchQuery(item);
												const el = document.getElementById('search-input');
												el?.focus();
											}}
											class="px-4 py-2.5 rounded-[14px] bg-white/[0.03] hover:bg-white/[0.08] text-white/60 text-[13px] font-medium transition-all duration-300 active:scale-95 flex items-center gap-1.5 hover:text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] border border-white/[0.02]"
										>
											<span class="text-white/20">@</span>
											{item}
										</Motion.button>
									)}
								</For>
							</div>
						</Motion.div>


					</div>
				</Show>
			</div>

			<style>{`
				@keyframes action-pulse {
					0%, 100% { opacity: 1; transform: scale(1); }
					50% { opacity: 0.5; transform: scale(0.85); }
				}
				.animate-action-pulse {
					animation: action-pulse 2s ease-in-out infinite;
				}
				.action-btn:not(:disabled):active {
					transform: scale(0.98);
				}
				@keyframes marquee-scroll {
					0% { transform: translateX(0); }
					100% { transform: translateX(-50%); }
				}
				.animate-marquee-scroll {
					animation: marquee-scroll 30s linear infinite;
				}
			`}</style>
		</main>
	);
};
