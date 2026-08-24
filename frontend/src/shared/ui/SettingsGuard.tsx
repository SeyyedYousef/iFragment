import { Component, createSignal, JSX, Show } from 'solid-js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { UnsavedChangesSheet } from './UnsavedChangesSheet.js';

interface Props {
	isDirty: boolean;
	onSave: () => Promise<void> | void;
	onDiscard: () => void;
	showSheet?: boolean;
	isSaving?: boolean;
	onCloseSheet?: () => void;
	saveLabel?: string;
	changedCount?: number;
	children?: ((props: { requestLeave: (onConfirmLeave: () => void) => void }) => JSX.Element) | JSX.Element;
}

export const SettingsGuard: Component<Props> = (props) => {
	const [showPrompt, setShowPrompt] = createSignal(false);
	const [pendingAction, setPendingAction] = createSignal<(() => void) | null>(null);
	const [internalSaving, setInternalSaving] = createSignal(false);

	const isSaving = () => props.isSaving ?? internalSaving();

	const requestLeave = (onConfirmLeave: () => void) => {
		if (props.isDirty) {
			setPendingAction(() => onConfirmLeave);
			setShowPrompt(true);
			try {
				haptic.notification('warning');
			} catch {}
		} else {
			onConfirmLeave();
		}
	};

	const handleSaveAndLeave = async () => {
		setInternalSaving(true);
		try {
			await props.onSave();
			try {
				haptic.notification('success');
			} catch {}
			setShowPrompt(false);
			const action = pendingAction();
			if (action) action();
		} catch (e) {
			console.error('Failed to save settings:', e);
		} finally {
			setInternalSaving(false);
		}
	};

	const handleDiscardAndLeave = () => {
		props.onDiscard();
		setShowPrompt(false);
		try {
			haptic.impact('light');
		} catch {}
		const action = pendingAction();
		if (action) action();
	};

	const handleStay = () => {
		setShowPrompt(false);
		setPendingAction(null);
		if (props.onCloseSheet) {
			props.onCloseSheet();
		}
		try {
			haptic.impact('light');
		} catch {}
	};

	const handleSave = async () => {
		if (isSaving()) return;
		haptic.impact('medium');
		await props.onSave();
	};

	const handleDiscard = () => {
		haptic.impact('light');
		props.onDiscard();
	};

	return (
		<>
			{/* If children function provided, call it with requestLeave */}
			{typeof props.children === 'function'
				? (props.children as any)({ requestLeave })
				: props.children}

			{/* Floating Action Bar (shown when dirty and no children wrapper) */}
			<Show when={props.isDirty && typeof props.children !== 'function'}>
				<div class="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#030303] via-[#030303]/90 to-transparent z-50 pointer-events-none">
					<div class="max-w-md mx-auto flex gap-3 pointer-events-auto" dir={isRtl() ? 'rtl' : 'ltr'}>
						<button
							onClick={handleDiscard}
							disabled={isSaving()}
							class="w-16 h-14 bg-[#12141C]/80 backdrop-blur-md text-[#ff4a4a] border border-[#ff4a4a]/20 rounded-[16px] transition-all flex items-center justify-center hover:bg-[#ff4a4a]/10 active:scale-95 shadow-sm min-h-[44px] min-w-[44px]"
							title={t('common.cancel')}
							aria-label={t('common.cancel')}
						>
							<span class="material-symbols-outlined text-[24px]">close</span>
						</button>
						<button
							onClick={handleSave}
							disabled={isSaving()}
							class="flex-1 h-14 bg-gradient-to-r from-[#3390ec] to-[#2b7ec9] hover:from-[#2b7ec9] hover:to-[#3390ec] text-white rounded-[16px] font-black text-[14px] uppercase tracking-widest shadow-[0_10px_30px_rgba(51,144,236,0.35)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:scale-100 active:scale-95 border border-white/10 min-h-[44px]"
						>
							<Show
								when={!isSaving()}
								fallback={<span class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
							>
								{props.saveLabel || t('common.save')} <span class="material-symbols-outlined text-[22px]">save</span>
							</Show>
						</button>
					</div>
				</div>
			</Show>

			{/* Unsaved Changes Confirmation Dialog */}
			<Show when={showPrompt() || props.showSheet}>
				<UnsavedChangesSheet
					isOpen={true}
					saving={isSaving()}
					changedCount={props.changedCount}
					onSave={handleSaveAndLeave}
					onDiscard={handleDiscardAndLeave}
					onClose={handleStay}
				/>
			</Show>
		</>
	);
};

export function isDeepEqual(obj1: any, obj2: any): boolean {
	if (obj1 === obj2) return true;
	if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
		return false;
	}
	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);
	if (keys1.length !== keys2.length) return false;
	for (const key of keys1) {
		if (!keys2.includes(key) || !isDeepEqual(obj1[key], obj2[key])) {
			return false;
		}
	}
	return true;
}
