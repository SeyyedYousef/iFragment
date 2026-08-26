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
				class="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-sm flex items-end justify-center p-0 md:p-6 animate-fade-in"
			>
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="unsaved-sheet-title"
					class="w-full max-w-lg bg-gradient-to-b from-[#181926] to-[#0f1016] border-t md:border border-white/10 rounded-t-[28px] md:rounded-[28px] p-6 shadow-2xl space-y-5 animate-slide-up"
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
								<span class="material-symbols-outlined">warning</span>
							</div>
							<div>
								<h3 id="unsaved-sheet-title" class="text-sm font-black text-white">
									{t('unsavedSheet.title' as any)}
								</h3>
								<p class="text-[11px] text-white/50 font-bold mt-0.5">
									{props.changedCount
										? t('unsavedSheet.changedCount' as any, { count: props.changedCount })
										: t('unsavedSheet.savePrompt' as any)}
								</p>
							</div>
						</div>
					</div>

					<div class="flex items-center gap-3 pt-2">
						<button
							type="button"
							onClick={handleDiscard}
							class="flex-1 h-12 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold transition-all active:scale-95 min-h-[44px]"
						>
							{t('unsavedSheet.discardChanges' as any)}
						</button>
						<button
							type="button"
							onClick={handleSave}
							disabled={props.saving}
							class="flex-1 h-12 rounded-2xl bg-[#3390ec] hover:bg-[#2b7ec9] text-white text-xs font-black transition-all active:scale-95 min-h-[44px] flex items-center justify-center gap-2 shadow-lg shadow-[#3390ec]/20 disabled:opacity-50"
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
