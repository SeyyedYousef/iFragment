import type { Component } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

export const ErrorFallback: Component<{ err: Error; reset: () => void }> = (props) => {
	return (
		<div class="mx-4 mt-4 p-4 frag-card rounded-[14px] border-[#ff5c6c]/25 bg-[#ff5c6c]/[0.06]">
			<div class="flex items-center gap-2 mb-2">
				<span class="material-symbols-outlined text-[#ff5c6c] text-[18px]">error</span>
				<span class="text-[13.5px] font-semibold text-[#ff8591]">
					{t('error.title') || 'Something went wrong'}
				</span>
			</div>
			<p class="text-[12px] text-[#8c9ba5] mb-3.5 leading-relaxed">
				{t('common.errors.generic') || 'We could not load this section.'}
			</p>
			{import.meta.env.DEV && (
				<pre class="text-[10.5px] text-[#8c9ba5] mb-3.5 overflow-auto max-h-24 p-2.5 frag-inset rounded-[8px] font-mono">
					{props.err.message}
				</pre>
			)}
			<button
				type="button"
				onClick={props.reset}
				class="px-4 py-2 frag-btn-primary text-[12px] font-semibold rounded-[9px]"
			>
				{t('error.tryAgain') || 'Retry'}
			</button>
		</div>
	);
};
