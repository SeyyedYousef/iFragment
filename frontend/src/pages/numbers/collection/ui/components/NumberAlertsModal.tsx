import { type Component, createSignal, Show } from 'solid-js';
import { haptic } from '@/shared/lib/haptic.js';

interface AlertsModalProps {
	isOpen: boolean;
	onClose: () => void;
	currentFloor?: number | null;
}

export const NumberAlertsModal: Component<AlertsModalProps> = (props) => {
	const [floorTarget, setFloorTarget] = createSignal(
		props.currentFloor ? Math.round(props.currentFloor * 0.95).toString() : '2300',
	);
	const [alertOnWhale, setAlertOnWhale] = createSignal(true);
	const [alertOnPattern, setAlertOnPattern] = createSignal(true);
	const [savedSuccess, setSavedSuccess] = createSignal(false);

	const handleSave = () => {
		try {
			haptic.notify('success');
			setSavedSuccess(true);
			setTimeout(() => {
				setSavedSuccess(false);
				props.onClose();
			}, 1500);
		} catch {}
	};

	return (
		<Show when={props.isOpen}>
			<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
				<div class="bg-[#0e121d] border border-white/10 rounded-3xl p-5 max-w-sm w-full shadow-2xl relative">
					<div class="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.08]">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-amber-400 text-xl">
								notifications_active
							</span>
							<h3 class="text-sm font-black text-white">هشدارهای هوشمند شماره‌ها</h3>
						</div>
						<button
							type="button"
							onClick={props.onClose}
							class="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/50 hover:text-white"
						>
							<span class="material-symbols-outlined text-base">close</span>
						</button>
					</div>

					<div class="space-y-4 text-start">
						{/* Floor Alert Trigger */}
						<div>
							<label class="text-[11px] font-bold text-white/70 block mb-1">
								هشدار افت فلور به زیر (TON):
							</label>
							<div class="relative">
								<input
									type="number"
									value={floorTarget()}
									onInput={(e) => setFloorTarget(e.currentTarget.value)}
									class="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#0098EA]"
								/>
								<span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#0098EA]">
									TON
								</span>
							</div>
							<p class="text-[10px] text-white/40 mt-1">
								کف فعلی: {props.currentFloor ? `${props.currentFloor} TON` : '—'}
							</p>
						</div>

						{/* Toggle: Whale Buys */}
						<div class="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
							<div>
								<span class="text-xs font-bold text-white block">خرید و فروش نهنگ‌ها</span>
								<span class="text-[10px] text-white/40 block mt-0.5">
									معاملات بالای ۱۰,۰۰۰ TON
								</span>
							</div>
							<button
								type="button"
								onClick={() => setAlertOnWhale(!alertOnWhale())}
								class={`w-11 h-6 rounded-full transition-all p-0.5 ${
									alertOnWhale() ? 'bg-[#0098EA]' : 'bg-white/10'
								}`}
							>
								<div
									class={`w-5 h-5 rounded-full bg-white transition-all ${
										alertOnWhale() ? 'translate-x-5' : 'translate-x-0'
									}`}
								/>
							</button>
						</div>

						{/* Toggle: Pattern Sniping */}
						<div class="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
							<div>
								<span class="text-xs font-bold text-white block">لیستینگ جدید الگوهای خاص</span>
								<span class="text-[10px] text-white/40 block mt-0.5">
									جنسیس، ۴تایی یکسان، باینری و...
								</span>
							</div>
							<button
								type="button"
								onClick={() => setAlertOnPattern(!alertOnPattern())}
								class={`w-11 h-6 rounded-full transition-all p-0.5 ${
									alertOnPattern() ? 'bg-cyan-500' : 'bg-white/10'
								}`}
							>
								<div
									class={`w-5 h-5 rounded-full bg-white transition-all ${
										alertOnPattern() ? 'translate-x-5' : 'translate-x-0'
									}`}
								/>
							</button>
						</div>

						{/* Save Action */}
						<button
							type="button"
							onClick={handleSave}
							class="w-full py-3 rounded-2xl bg-gradient-to-r from-[#0098EA] to-cyan-500 text-white font-bold text-xs shadow-lg shadow-[#0098EA]/20 active:scale-95 transition-all"
						>
							<Show when={!savedSuccess()} fallback="هشدار با موفقیت فعال شد ✓">
								ذخیره و فعال‌سازی در ربات تلگرام
							</Show>
						</button>
					</div>
				</div>
			</div>
		</Show>
	);
};
