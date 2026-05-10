import { Component, createSignal, createMemo, Show, For } from 'solid-js';
import { Motion } from '@motionone/solid';
import { t, type DictPaths } from '@/shared/i18n/index.js';
import { useUsernameSearch } from '@/entities/username/model/index.js';
import { useUsernameQuickAnalysis } from '@/entities/username/api/index.js';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { useNavigate } from '@solidjs/router';

interface ActionAreaProps {
  activeTab: 'username' | 'collectibles' | 'gifts';
}

type AnalyzeState = 'idle' | 'loading' | 'success';

const CONTENT: Record<ActionAreaProps['activeTab'], {
  title: DictPaths; description: DictPaths; inputPlaceholder: DictPaths; analyzeBtn: DictPaths;
}> = {
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

const TRENDING = ['news', 'auto', 'bank', 'crypto'];

export const ActionArea: Component<ActionAreaProps> = (props) => {
  const { searchQuery, setSearchQuery, searchError, validate } = useUsernameSearch();
  const navigate = useNavigate();
  const [analyzeState, setAnalyzeState] = createSignal<AnalyzeState>('idle');
  const [isFocused, setIsFocused] = createSignal(false);

  const quickAnalysis = useUsernameQuickAnalysis(() => searchQuery());

  const keys = createMemo(() => CONTENT[props.activeTab]);
  const charCount = createMemo(() => searchQuery().length);
  const isValidLength = createMemo(() => charCount() >= 4 && charCount() <= 32);

  const handleAnalyze = async () => {
    if (analyzeState() !== 'idle' || !searchQuery()) return;
    if (validate(searchQuery())) {
      try { hapticFeedback.impactOccurred('medium'); } catch { }
      setAnalyzeState('loading');

      // Free access for now
      setTimeout(() => {
        setAnalyzeState('success');
        try { hapticFeedback.notificationOccurred('success'); } catch { }
        setTimeout(() => {
          navigate(`/username/report?u=${searchQuery()}`);
          setAnalyzeState('idle');
        }, 600);
      }, 800);
    } else {
      try { hapticFeedback.notificationOccurred('error'); } catch { }
    }
  };

  const updateSearchQuery = (val: string) => {
    const stripped = val.replace(/^[@+]/, '');
    setSearchQuery(stripped);
  };

  const getButtonText = () => {
    if (analyzeState() === 'loading') return t('action.analyzing');
    if (analyzeState() === 'success') return t('home.success');

    const status = quickAnalysis.data?.status;
    if (status === 'available') {
      return t('action.username.registerBtn' as DictPaths);
    } else if (status) {
      return t('action.username.analyzeMarketBtn' as DictPaths);
    }
    return t(keys().analyzeBtn);
  };

  const [isFeaturesExpanded, setIsFeaturesExpanded] = createSignal(false);

  const getPrefix = () => {
    if (props.activeTab === 'username') return '@';
    if (props.activeTab === 'collectibles') return '+';
    return '';
  };

  return (
    <main class="w-full max-w-[420px] mx-auto pb-8" role="main" aria-label="Analysis section">

      {/* ── HEADER ── */}
      <Motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, easing: [0.23, 1, 0.32, 1] }}
        class="text-center space-y-3 px-6 mb-8"
      >
        <h2 class="text-[28px] md:text-3xl font-black text-white tracking-tight leading-tight">
          {t(keys().title)}
        </h2>
        <p class="text-[#8e8e93] text-[14px] font-medium leading-[1.7] px-2 max-w-[340px] mx-auto">
          {t(keys().description)}
        </p>
      </Motion.div>

      {/* ── SEARCH CARD ── */}
      <Motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, easing: [0.23, 1, 0.32, 1] }}
        class="px-6"
      >
        <div
          class={`bg-[#0f1014] border rounded-[24px] p-5 transition-all duration-400 ${
            searchError()
              ? 'border-red-500/40'
              : isFocused()
                ? 'border-[#3390ec]/30 shadow-[0_0_0_4px_rgba(51,144,236,0.05)]'
                : 'border-[#2a2a2a]'
          }`}
        >
          {/* Top Bar */}
          <div class="flex items-center justify-between mb-4">
            <span class="flex items-center gap-2 text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em]">
              <span class="material-symbols-outlined text-[16px] text-[#3390ec]" style={{ 'font-variation-settings': '"FILL" 1' }}>search</span>
              {t('home.targetAsset')}
            </span>

            <Show when={charCount() > 0}>
              <div class="flex items-center gap-2">
                <Show when={quickAnalysis.data}>
                  <span
                    class={`text-[10px] font-black uppercase px-2.5 py-1 rounded-xl ${
                      quickAnalysis.data?.status === 'available'
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                    aria-live="polite"
                  >
                    {t(`pages.premiumReport.status.${quickAnalysis.data?.status || 'available'}` as DictPaths) || quickAnalysis.data?.status}
                  </span>
                </Show>
                <span
                  class={`text-[11px] font-mono font-bold tabular-nums px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05] ${
                    isValidLength() ? 'text-green-400' : 'text-[#ff6b35]'
                  }`}
                >
                  {charCount()}<span class="text-white/15">/32</span>
                </span>
              </div>
            </Show>
          </div>

          {/* Input */}
          <div
            class={`flex items-center gap-3 bg-[#1c1c1c] rounded-2xl p-4 border transition-all duration-300 ${
              isFocused() ? 'border-[#3390ec]/25' : 'border-[#2a2a2a]'
            }`}
            dir="ltr"
          >
            <span
              class={`text-[22px] font-black select-none transition-colors duration-300 ${
                searchQuery() ? 'text-[#3390ec]' : 'text-white/10'
              }`}
            >
              {getPrefix()}
            </span>
            <input
              id="search-input"
              class="w-full bg-transparent border-none focus:ring-0 outline-none text-left font-sans text-[20px] font-extrabold text-white placeholder:text-white/15 tracking-wide"
              placeholder={t(keys().inputPlaceholder)}
              aria-label={t(keys().inputPlaceholder)}
              type="text"
              autocomplete="off"
              spellcheck={false}
              value={searchQuery()}
              onInput={(e) => updateSearchQuery(e.currentTarget.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            <Show when={searchQuery()}>
              <button
                onClick={() => setSearchQuery('')}
                class="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/10 transition-colors"
                aria-label="Clear"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M8 2L2 8M2 2L8 8" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </button>
            </Show>
          </div>

          {/* Error */}
          <Show when={searchError()}>
            <Motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              class="flex items-center gap-2 mt-3 px-1"
            >
              <span class="material-symbols-outlined text-[14px] text-red-400">error</span>
              <span class="text-[12px] font-bold text-red-400">{searchError()}</span>
            </Motion.div>
          </Show>

          {/* Quick Info Preview */}
          <Show when={quickAnalysis.data}>
            <Motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              class="mt-4 bg-[#141518] rounded-xl border border-[#2a2a2a] p-3 flex items-center justify-between"
            >
              <div class="flex flex-col gap-1">
                <span class="text-[#8e8e93] text-[11px] font-bold uppercase tracking-wider">
                  Rarity Score
                </span>
                <div class="flex items-center gap-1.5">
                  <span class="text-[#3390ec] material-symbols-outlined text-[14px]">diamond</span>
                  <span class="text-white text-[15px] font-black">{quickAnalysis.data?.rarity_score}</span>
                  <span class="text-[#8e8e93] text-[12px] font-medium">/ 10000</span>
                </div>
              </div>
              <Show when={quickAnalysis.data?.sale_status !== 'not_for_sale' && (quickAnalysis.data?.buy_now_price || quickAnalysis.data?.highest_bid)}>
                <div class="flex flex-col gap-1 items-end">
                  <span class="text-[#8e8e93] text-[11px] font-bold uppercase tracking-wider">
                    {quickAnalysis.data?.sale_status === 'on_auction' ? 'Highest Bid' : 'Price'}
                  </span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-white text-[15px] font-black">
                      {quickAnalysis.data?.buy_now_price || quickAnalysis.data?.highest_bid}
                    </span>
                    <span class="text-[#3390ec] font-bold text-[12px]">TON</span>
                  </div>
                </div>
              </Show>
            </Motion.div>
          </Show>

          {/* CTA Button */}
          <button
            onClick={handleAnalyze}
            disabled={analyzeState() === 'loading' || !searchQuery()}
            aria-busy={analyzeState() === 'loading'}
            class={`relative w-full overflow-hidden rounded-2xl mt-4 py-4 px-5 flex items-center justify-between transition-all duration-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
              analyzeState() === 'success'
                ? 'bg-[#34c759] shadow-lg shadow-green-500/15'
                : 'bg-[#3390ec] hover:bg-[#4da3f5] shadow-lg shadow-[#3390ec]/15'
            }`}
          >
            {/* Loading sweep */}
            <Show when={analyzeState() === 'loading'}>
              <div class="absolute inset-0 bg-white/10" style={{ animation: 'progress-sweep 1.5s ease-out infinite', 'transform-origin': 'left' }} />
            </Show>

            {/* Left: text */}
            <div class="flex flex-col items-start relative z-10">
              <span class="font-black text-[15px] text-white tracking-wide flex items-center gap-2">
                <Show when={analyzeState() === 'loading'}>
                  <div class="w-4 h-4 rounded-full border-2 border-white/25 border-t-white" style={{ animation: 'spin 0.7s linear infinite' }} />
                </Show>
                <Show when={analyzeState() === 'success'}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </Show>
                {getButtonText()}
              </span>
              <Show when={analyzeState() === 'idle'}>
                <span class="text-white/50 text-[10px] font-bold uppercase tracking-[0.15em] mt-0.5">
                  {t('home.premiumReport')}
                </span>
              </Show>
            </div>

            {/* Right: arrow */}
            <Show when={analyzeState() === 'idle'}>
              <div class="relative z-10">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="rtl:rotate-180 text-white/60">
                  <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </div>
            </Show>
          </button>
        </div>
      </Motion.div>

      {/* ── VALUE PROPOSITION (FEATURES) ACCORDION ── */}
      <Show when={props.activeTab === 'username'}>
        <Motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, easing: [0.23, 1, 0.32, 1] }}
          class="px-6 pt-4"
        >
          <div class="bg-[#0f1014] border border-[#2a2a2a] rounded-[20px] overflow-hidden transition-all duration-300">
            <button
              onClick={() => setIsFeaturesExpanded(!isFeaturesExpanded())}
              class="w-full flex items-center justify-between p-4 bg-transparent hover:bg-white/[0.02] transition-colors"
            >
              <h3 class="text-[#8e8e93] text-[13px] font-bold flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px] text-[#3390ec]" style={{ 'font-variation-settings': '"FILL" 1' }}>insights</span>
                {t('action.username.features.title' as DictPaths)}
              </h3>
              <span 
                class="material-symbols-outlined text-[18px] text-[#8e8e93] transition-transform duration-300"
                style={{ transform: isFeaturesExpanded() ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                expand_more
              </span>
            </button>
            
            <div 
              class="overflow-hidden transition-all duration-400 ease-in-out"
              style={{ 
                "max-height": isFeaturesExpanded() ? '200px' : '0px',
                opacity: isFeaturesExpanded() ? 1 : 0
              }}
            >
              <ul class="space-y-3 px-5 pb-5 pt-1 border-t border-[#2a2a2a]/50 mx-4">
                <For each={[0, 1, 2]}>
                  {(index) => (
                    <li class="flex items-start gap-2.5">
                      <span class="material-symbols-outlined text-[16px] text-[#34c759] shrink-0 mt-0.5">check_circle</span>
                      <span class="text-white/80 text-[13px] font-medium leading-relaxed">
                        {t(`action.username.features.items.${index}` as DictPaths)}
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </div>
        </Motion.div>
      </Show>

      {/* ── TRENDING ── */}
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        class="px-6 pt-6"
        dir="ltr"
      >
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[14px]" aria-hidden="true">🔥</span>
          <span class="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em]">
            {t('action.trending.title' as DictPaths)}
          </span>
        </div>
        <div class="flex flex-wrap gap-2">
          <For each={TRENDING}>
            {(item) => (
              <button
                onClick={() => updateSearchQuery(item)}
                class="px-3.5 py-2 rounded-xl bg-[#0f1014] border border-[#2a2a2a] hover:border-[#3390ec]/30 hover:bg-[#3390ec]/5 text-[12px] font-bold text-[#8e8e93] hover:text-white transition-all duration-300 active:scale-[0.96]"
              >
                @{item}
              </button>
            )}
          </For>
        </div>
      </Motion.div>

      {/* ── FREE STATS LINK ── */}
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        class="px-6 pt-6"
      >
        <button
          onClick={() => navigate('/username/stats')}
          class="group w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-[#0f1014] border border-[#2a2a2a] hover:border-[#3390ec]/25 hover:bg-[#3390ec]/[0.03] transition-all duration-300 active:scale-[0.98]"
        >
          <span class="material-symbols-outlined text-[16px] text-[#8e8e93] group-hover:text-[#3390ec] transition-colors" style={{ 'font-variation-settings': '"FILL" 0' }}>info</span>
          <span class="text-[13px] font-bold text-[#8e8e93] group-hover:text-white/60 transition-colors">
            {t('action.freeInfoPrefix')}<span class="text-[#3390ec]">{t('action.freeInfoHighlight')}</span>{t('action.freeInfoSuffix')}
          </span>
        </button>
      </Motion.div>
    </main>
  );
};
