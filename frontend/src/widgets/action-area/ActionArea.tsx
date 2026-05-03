import { Component, createSignal, createMemo, Show } from 'solid-js';
import { Motion } from '@motionone/solid';
import { t, type DictPaths } from '@/shared/i18n/index.js';
import { useUsernameSearch } from '@/entities/username/model/index.js';
import { useUsernameAvailability, useRequestPremiumReport } from '@/entities/username/api/index.js';
import { hapticFeedback, invoice } from '@tma.js/sdk-solid';
import { useNavigate } from '@solidjs/router';

interface ActionAreaProps {
  activeTab: 'username' | 'collectibles' | 'gifts';
}

type AnalyzeState = 'idle' | 'loading' | 'success';

// Type-safe content map
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

export const ActionArea: Component<ActionAreaProps> = (props) => {
  const { searchQuery, setSearchQuery, searchError, validate } = useUsernameSearch();
  const [analyzeState, setAnalyzeState] = createSignal<AnalyzeState>('idle');
  const navigate = useNavigate();
  const requestPremium = useRequestPremiumReport();

  const availability = useUsernameAvailability(() => searchQuery());

  const keys = createMemo(() => CONTENT[props.activeTab]);
  const charCount = createMemo(() => searchQuery().length);
  const isValidLength = createMemo(() => charCount() >= 4 && charCount() <= 32);

  const handleAnalyze = async () => {
    if (analyzeState() !== 'idle') return;
    if (validate(searchQuery())) {
      try { hapticFeedback.impactOccurred('medium'); } catch {}
      setAnalyzeState('loading');
      
      try {
        const { invoice_link } = await requestPremium(searchQuery());
        const status = await invoice.open(invoice_link, 'url');
        if (status === 'paid') {
          setAnalyzeState('success');
          try { hapticFeedback.notificationOccurred('success'); } catch {}
          // Navigate to report page
          setTimeout(() => {
            navigate(`/username/report?u=${searchQuery()}`);
            setAnalyzeState('idle');
          }, 1000);
        } else {
          setAnalyzeState('idle');
        }
      } catch (err) {
        console.error('Payment failed', err);
        setAnalyzeState('idle');
        try { hapticFeedback.notificationOccurred('error'); } catch {}
      }
    } else {
      try { hapticFeedback.notificationOccurred('error'); } catch {}
    }
  };

  return (
    <main class="space-y-6 w-full max-w-[420px] mx-auto pb-8" role="main" aria-label="Analysis section">
      
      {/* 1. Header Section */}
      <Motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, easing: [0.23, 1, 0.32, 1] }}
        class="text-center space-y-3 px-2"
      >
        <h2 class="text-[28px] md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/60 tracking-tight leading-tight">
          {t(keys().title)}
        </h2>
        <p class="text-on-surface-variant text-[14px] font-medium leading-[1.7] px-2 max-w-[340px] mx-auto">
          {t(keys().description)}
        </p>
      </Motion.div>

      {/* 2. Search Console (Input) */}
      <div class="relative w-full group mt-6">
        {/* Glow */}
        <div class="absolute -inset-1 bg-gradient-to-r from-[#3390ec]/0 via-[#3390ec]/15 to-[#3390ec]/0 rounded-[32px] blur-xl opacity-0 group-focus-within:opacity-100 transition-all duration-700 pointer-events-none"></div>
        
        <Motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          class={`relative bg-[#0a0b0e] border ${searchError() ? 'border-[#ff3b30]/50' : 'border-white/10 group-focus-within:border-[#3390ec]/50'} rounded-[24px] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all duration-500`}
        >
          {/* Top Info */}
          <div class="flex items-center justify-between mb-3 px-2">
            <span class="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.15em] opacity-80">
              {t('home.targetAsset')}
            </span>
            <Show when={charCount() > 0}>
              <div class="flex items-center gap-2">
                <Show when={availability.data}>
                  <span class={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    availability.data?.status === 'available' ? 'bg-[#34c759]/20 text-[#34c759]' : 'bg-[#ff3b30]/20 text-[#ff3b30]'
                  }`}>
                    {t(`pages.premiumReport.status.${availability.data?.status || 'available'}` as any)}
                  </span>
                </Show>
                <span class={`text-[11px] font-black tracking-widest ${isValidLength() ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                  {charCount()}<span class="text-on-surface-variant opacity-50">/32</span>
                </span>
              </div>
            </Show>
          </div>

          {/* Input Area */}
          <div class="flex items-center gap-2 px-2 pb-2">
            <span class={`text-4xl font-light transition-colors duration-300 ${searchQuery() ? 'text-[#3390ec]' : 'text-on-surface-variant opacity-50'}`}>
              {props.activeTab === 'username' ? '@' : props.activeTab === 'collectibles' ? '+' : ''}
            </span>
            <input
              id="search-input"
              class="w-full bg-transparent border-none focus:ring-0 text-3xl md:text-4xl font-black text-white placeholder:text-white/10 outline-none text-left tracking-tight"
              placeholder={t(keys().inputPlaceholder)}
              type="text"
              autocomplete="off"
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
             
            />
          </div>

          <Show when={searchError()}>
             <p class="text-[#ff3b30] text-[12px] font-bold mt-2 px-2 flex items-center gap-1">
               <span class="material-symbols-outlined text-[14px]">error</span>
               {searchError()}
             </p>
          </Show>
        </Motion.div>
      </div>

      {/* 3. CTA Action */}
      <Motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        class="w-full pt-4"
      >
        <button
          onClick={handleAnalyze}
          disabled={analyzeState() === 'loading' || !searchQuery()}
          class={`relative w-full overflow-hidden rounded-[22px] px-6 py-4 flex items-center justify-between transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
            analyzeState() === 'success'
              ? 'bg-[#34c759] shadow-[0_0_20px_rgba(52,199,89,0.4)] text-white'
              : 'bg-gradient-to-r from-[#3390ec] to-[#2b7bc9] hover:opacity-90 shadow-[0_6px_24px_rgba(51,144,236,0.4)] hover:shadow-[0_10px_30px_rgba(51,144,236,0.6)] active:scale-[0.98] text-white'
          }`}
        >
          {/* Loading Animation */}
          <Show when={analyzeState() === 'loading'}>
            <div class="absolute inset-0 bg-white/20" style={{ animation: 'progress-sweep 1.5s ease-out infinite', 'transform-origin': 'left' }}></div>
          </Show>

          {/* Left Side: Text */}
          <div class="flex flex-col items-start relative z-10 text-left">
            <span class="font-black text-[16px] md:text-[18px] tracking-wide drop-shadow-sm">
              {analyzeState() === 'loading'
                ? t('action.analyzing')
                : analyzeState() === 'success'
                  ? t('home.success')
                  : t(keys().analyzeBtn)}
            </span>
            <span class="text-white/70 text-[11px] font-bold uppercase tracking-widest mt-1">
              {t('home.premiumReport')}
            </span>
          </div>

          {/* Right Side: Cost Badge */}
          <div class="relative z-10 flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <span class="font-black text-[#ffcc00] tracking-wider text-[16px] md:text-[18px] drop-shadow-sm">100</span>
            <span class="material-symbols-outlined text-[#ffcc00] text-[18px] md:text-[20px]" style={{ 'font-variation-settings': '"FILL" 1' }}>star</span>
          </div>
        </button>
      </Motion.div>

      {/* Free Info Link */}
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        class="text-center pt-4"
      >
        <button 
          onClick={() => navigate('/username/stats')}
          class="group inline-flex items-center gap-1.5 text-[13px] font-bold text-on-surface-variant hover:text-[#3390ec] transition-colors border-b border-transparent hover:border-[#3390ec]/30 pb-0.5"
        >
          <span class="material-symbols-outlined text-[16px] group-hover:scale-110 transition-transform">info</span>
          <span>
            {t('action.freeInfoPrefix')} <span class="text-white group-hover:text-[#3390ec]">{t('action.freeInfoHighlight')}</span> {t('action.freeInfoSuffix')}
          </span>
        </button>
      </Motion.div>
    </main>
  );
};
