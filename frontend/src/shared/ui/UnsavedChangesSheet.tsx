import { hapticFeedback } from '@tma.js/sdk-solid';
import { type Component, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';

interface UnsavedChangesSheetProps {
	isOpen: boolean;
	changedCount?: number;
	onSave: () => void;
	onDiscard: () => void;
	onClose: () => void;
	saving?: boolean;
}

export const UnsavedChangesSheet: Component<UnsavedChangesSheetProps> = (props) => {
	const handleSave = () => {
		try {
			hapticFeedback.impactOccurred('medium');
		} catch {}
		props.onSave();
	};

	const handleDiscard = () => {
		try {
			hapticFeedback.notificationOccurred('warning');
		} catch {}
		props.onDiscard();
	};

	return (
		<Show when={props.isOpen}>
			<div
				onClick={(e) => {
					if (e.target === e.currentTarget) props.onClose();
				}}
				class="fixed inset-0 z-[9990] bg-black/75 backdrop-blur-sm flex items-end justify-center p-0 md:p-6 animate-fade-in"
			>
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="unsaved-sheet-title"
					class="w-full max-w-lg frag-sheet rounded-t-[24px] md:rounded-[20px] p-5 pb-7 space-y-4 animate-slide-up"
				>
					<div class="mx-auto w-9 h-1 rounded-full bg-white/20 md:hidden" />
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-[11px] bg-[#ffb340]/12 border border-[#ffb340]/25 text-[#ffb340] flex items-center justify-center shrink-0">
							<span class="material-symbols-outlined text-[20px]">warning</span>
						</div>
						<div class="min-w-0">
							<h3 id="unsaved-sheet-title" class="text-[15px] font-semibold text-white">
								{t('unsavedSheet.title' as any)}
							</h3>
							<p class="text-[12px] text-[#8c9ba5] mt-0.5">
								{props.changedCount
									? t('unsavedSheet.changedCount' as any, { count: props.changedCount })
									: t('unsavedSheet.savePrompt' as any)}
							</p>
						</div>
					</div>

					<div class="flex items-center gap-2.5 pt-1">
						<button
							type="button"
							onClick={handleDiscard}
							class="flex-1 h-11 rounded-[10px] bg-[#ff5c6c]/12 hover:bg-[#ff5c6c]/20 border border-[#ff5c6c]/25 text-[#ff8591] text-[13px] font-semibold transition-all active:scale-95 min-h-[44px]"
						>
							{t('unsavedSheet.discardChanges' as any)}
						</button>
						<button
							type="button"
							onClick={handleSave}
							disabled={props.saving}
							class="flex-1 h-11 rounded-[10px] frag-btn-primary text-[13px] font-semibold min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-50"
						>
							<Show when={props.saving} fallback={t('unsavedSheet.saveChanges' as any)}>
								<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
							</Show>
						</button>
					</div>
				</div>
			</div>
		</Show>
	);
};
