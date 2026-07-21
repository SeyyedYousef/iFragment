import { Component, createSignal, For, Show } from 'solid-js';

export interface DangerActionDetail {
	label: string;
	value?: string | number;
	before?: string | number;
	after?: string | number;
}

interface DangerActionDialogProps {
	isOpen: boolean;
	title: string;
	description: string;
	actionLabel: string;
	confirmWord?: string;
	riskLevel?: 'medium' | 'high' | 'critical';
	details?: DangerActionDetail[];
	requireReason?: boolean;
	loading?: boolean;
	onConfirm: (reason: string) => void;
	onClose: () => void;
}

export const DangerActionDialog: Component<DangerActionDialogProps> = (props) => {
	const [reason, setReason] = createSignal('');
	const [typedWord, setTypedWord] = createSignal('');

	const isCritical = () => props.riskLevel === 'critical' || props.riskLevel === 'high';
	const canSubmit = () => {
		if (props.loading) return false;
		if (props.requireReason !== false && !reason().trim()) return false;
		if (
			props.confirmWord &&
			typedWord().trim().toUpperCase() !== props.confirmWord.trim().toUpperCase()
		)
			return false;
		return true;
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		if (canSubmit()) {
			props.onConfirm(reason().trim());
		}
	};

	return (
		<Show when={props.isOpen}>
			<div class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
				<div
					role="dialog"
					aria-modal="true"
					class="w-full max-w-md bg-gradient-to-b from-[#1a1b22] to-[#111216] border border-white/10 rounded-[28px] p-6 shadow-2xl relative overflow-hidden"
				>
					{/* Header Glow */}
					<div
						class={`absolute top-0 inset-x-0 h-2 bg-gradient-to-r ${
							isCritical()
								? 'from-red-500 via-rose-500 to-orange-500'
								: 'from-amber-500 to-yellow-400'
						}`}
					/>

					{/* Close Button */}
					<button
						onClick={props.onClose}
						aria-label="بستن پنجره"
						class="absolute top-5 end-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition-all active:scale-95 text-white/70 hover:text-white"
					>
						<span class="material-symbols-outlined text-[18px]">close</span>
					</button>

					{/* Icon & Title */}
					<div class="flex items-start gap-4 mb-4 mt-2">
						<div
							class={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border ${
								isCritical()
									? 'bg-red-500/10 border-red-500/30 text-red-400'
									: 'bg-amber-500/10 border-amber-500/30 text-amber-400'
							}`}
						>
							<span class="material-symbols-outlined text-2xl">
								{isCritical() ? 'warning' : 'shield_with_heart'}
							</span>
						</div>
						<div>
							<h3 class="text-base font-black text-white">{props.title}</h3>
							<p class="text-xs text-white/60 font-medium mt-1 leading-relaxed">
								{props.description}
							</p>
						</div>
					</div>

					{/* Operation Details / Diff */}
					<Show when={props.details && props.details.length > 0}>
						<div class="my-4 bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2.5">
							<For each={props.details}>
								{(item) => (
									<div class="flex justify-between items-center text-xs">
										<span class="text-white/50 font-bold">{item.label}:</span>
										<Show
											when={item.before !== undefined || item.after !== undefined}
											fallback={<span class="text-white font-mono font-bold">{item.value}</span>}
										>
											<div class="flex items-center gap-2 font-mono text-xs font-bold">
												<span class="text-white/40 line-through">{item.before}</span>
												<span class="material-symbols-outlined text-[12px] text-white/30">
													east
												</span>
												<span class="text-emerald-400">{item.after}</span>
											</div>
										</Show>
									</div>
								)}
							</For>
						</div>
					</Show>

					{/* Form */}
					<form onSubmit={handleSubmit} class="space-y-4 mt-4">
						<Show when={props.requireReason !== false}>
							<div>
								<label class="block text-[10px] text-white/60 font-black uppercase tracking-wider mb-1.5">
									دلیل اجرای عملیات (الزامی جهت ثبت در لاگ امنیتی)
								</label>
								<textarea
									value={reason()}
									onInput={(e) => setReason(e.currentTarget.value)}
									placeholder="مثال: دستور پشتیبانی / اصلاح خطا در خرید..."
									rows={2}
									class="w-full bg-black/50 border border-white/10 focus:border-[#3390ec] rounded-xl p-3 text-xs text-white placeholder:text-white/20 focus:outline-none transition-all resize-none font-sans"
									required
								/>
							</div>
						</Show>

						<Show when={props.confirmWord}>
							<div>
								<label class="block text-[10px] text-red-400 font-black uppercase tracking-wider mb-1.5">
									جهت تایید، عبارت{' '}
									<code class="bg-red-500/20 px-1 py-0.5 rounded text-red-300 font-mono">
										{props.confirmWord}
									</code>{' '}
									را وارد کنید:
								</label>
								<input
									type="text"
									value={typedWord()}
									onInput={(e) => setTypedWord(e.currentTarget.value)}
									placeholder={props.confirmWord}
									class="w-full bg-black/50 border border-red-500/30 focus:border-red-500 rounded-xl px-4 py-2.5 text-xs text-white font-mono uppercase tracking-widest focus:outline-none transition-all"
								/>
							</div>
						</Show>

						{/* Actions */}
						<div class="flex gap-3 pt-2">
							<button
								type="button"
								onClick={props.onClose}
								class="flex-1 h-11 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs font-bold rounded-xl transition-all active:scale-95"
							>
								انصراف
							</button>

							<button
								type="submit"
								disabled={!canSubmit()}
								class={`flex-1 h-11 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg ${
									isCritical()
										? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20'
										: 'bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/20'
								}`}
							>
								<Show when={props.loading} fallback={props.actionLabel}>
									<span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
									در حال پردازش...
								</Show>
							</button>
						</div>
					</form>
				</div>
			</div>
		</Show>
	);
};
