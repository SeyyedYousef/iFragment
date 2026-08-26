import { Motion } from '@motionone/solid';
import { type Component, Show } from 'solid-js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface SettingsGuardProps {
	isDirty: boolean;
	isOpen: boolean;
	isSaving?: boolean;
	onSaveAndExit: () => void;
	onDiscard: () => void;
	onCancel: () => void;
}

export const SettingsGuardModal: Component<SettingsGuardProps> = (props) => {
	return (
		<Show when={props.isOpen}>
			<div
				class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
				dir={isRtl() ? 'rtl' : 'ltr'}
			>
				<Motion.div
					initial={{ scale: 0.95, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					exit={{ scale: 0.95, opacity: 0 }}
					class="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl space-y-4"
				>
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-xl">
							⚠️
						</div>
						<div>
							<h3 class="text-base font-semibold text-white">
								{t('channel.guard.title') || 'Unsaved Changes'}
							</h3>
							<p class="text-xs text-neutral-400">
								{t('channel.guard.desc') || 'You have unsaved changes. What would you like to do?'}
							</p>
						</div>
					</div>

					<div class="space-y-2 pt-2">
						<button
							type="button"
							onClick={() => {
								haptic.impact('medium');
								props.onSaveAndExit();
							}}
							disabled={props.isSaving}
							class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0098EA] to-[#0081C8] text-white font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
						>
							<Show when={props.isSaving}>
								<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
							</Show>
							<span>{t('channel.guard.save_exit') || 'Save & Exit'}</span>
						</button>

						<button
							type="button"
							onClick={() => {
								haptic.notify('warning');
								props.onDiscard();
							}}
							class="w-full py-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium text-sm hover:bg-red-500/20 active:scale-[0.98] transition-all"
						>
							{t('channel.guard.discard') || 'Discard Changes'}
						</button>

						<button
							type="button"
							onClick={() => {
								haptic.selection();
								props.onCancel();
							}}
							class="w-full py-2 px-4 rounded-xl text-neutral-400 font-medium text-sm hover:text-white hover:bg-neutral-800/50 active:scale-[0.98] transition-all"
						>
							{t('channel.guard.stay') || 'Keep Editing'}
						</button>
					</div>
				</Motion.div>
			</div>
		</Show>
	);
};
