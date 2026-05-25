import { Component } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const ErrorFallback: Component<{ err: Error; reset: () => void }> = (props) => {
  return (
    <div class="mx-6 mt-6 p-5 bg-red-500/10 border border-red-500/20 rounded-3xl">
      <div class="flex items-center gap-2 mb-3">
        <span class="material-symbols-outlined text-red-500">error</span>
        <span class="text-sm font-black text-red-500">{t('error.title') || 'Something went wrong'}</span>
      </div>
      <p class="text-xs text-[#a0a4ad] mb-4">{t('common.errors.generic') || 'We could not load this section.'}</p>
      {import.meta.env.DEV && (
        <pre class="text-[10px] text-[#a0a4ad]/70 mb-4 overflow-auto max-h-24 p-2 bg-black/30 rounded-xl font-mono">{props.err.message}</pre>
      )}
      <button
        onClick={props.reset}
        class="px-4 py-2 bg-[#3390ec] hover:bg-[#2b7ec9] text-white text-xs font-black rounded-xl active:scale-95 transition-all"
      >
        {t('error.tryAgain') || 'Retry'}
      </button>
    </div>
  );
};
