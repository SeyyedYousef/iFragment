import { type Component, createEffect, createSignal, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/api/numbersApi.js';
import { t } from '@/shared/i18n/index.js';
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
	const [saving, setSaving] = createSignal(false);
	const [savedSuccess, setSavedSuccess] = createSignal(false);

	createEffect(() => {
		if (props.isOpen) {
			numbersApi
				.getAlertPreferences()
				.then((prefs) => {
					if (prefs.max_price_ton > 0) {
						setFloorTarget(String(Math.round(prefs.max_price_ton)));
					}
					setAlertOnWhale(Boolean(prefs.alert_on_auction_end));
					setAlertOnPattern(Boolean(prefs.alert_on_listing));
				})
				.catch(() => {});
		}
	});

	const handleSave = async () => {
		if (saving()) return;
		setSaving(true);
		try {
			await numbersApi.saveAlertPreferences({
				pattern_key: alertOnPattern() ? 'rare_patterns' : 'all',
				max_price_ton: Number(floorTarget()) || 2300,
				alert_on_listing: alertOnPattern(),
				alert_on_auction_end: alertOnWhale(),
				alert_on_floor_drop: true,
			});
			haptic.notify('success');
			setSavedSuccess(true);
			setTimeout(() => {
				setSavedSuccess(false);
				props.onClose();
			}, 1200);
		} catch {
			haptic.notify('error');
		} finally {
			setSaving(false);
		}
	};

	return (
		<Show when={props.isOpen}>
			<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
				<div class="frag-sheet rounded-[20px] p-5 max-w-sm w-full relative">
					<div class="flex items-center justify-between mb-4 pb-2.5 border-b border-white/[0.07]">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-[#ffb340] text-[20px]">
								notifications_active
							</span>
							<h3 class="text-[14.5px] font-semibold text-white">{t('numAlerts.title')}</h3>
						</div>
						<button
							type="button"
							onClick={props.onClose}
							class="w-8 h-8 rounded-[9px] frag-btn-secondary flex items-center justify-center text-[#8c9ba5] hover:text-white"
						>
							<span class="material-symbols-outlined text-[17px]">close</span>
						</button>
					</div>

					<div class="space-y-3.5 text-start">
						<div>
							<label class="text-[12px] font-medium text-[#c7d0d9] block mb-1.5">
								{t('numAlerts.floorLabel')}
							</label>
							<div class="relative">
								<input
									type="number"
									value={floorTarget()}
									onInput={(e) => setFloorTarget(e.currentTarget.value)}
									dir="ltr"
									class="w-full frag-inset rounded-[10px] pl-3.5 pr-12 py-2.5 text-[13px] text-white font-mono tabular-nums focus:outline-none focus:border-[#2990ff]"
								/>
								<span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] font-mono font-semibold text-[#2990ff]">
									{t('common.ton')}
								</span>
							</div>
							<p class="text-[11px] text-[#60707c] mt-1 font-mono tabular-nums">
								{t('numAlerts.currentFloor')}{' '}
								{props.currentFloor ? `${props.currentFloor} TON` : '—'}
							</p>
						</div>

						<div class="flex items-center justify-between p-3 rounded-[12px] frag-inset gap-3">
							<div class="min-w-0">
								<span class="text-[12.5px] font-semibold text-white block">
									{t('numAlerts.whaleTitle')}
								</span>
								<span class="text-[11px] text-[#8c9ba5] block mt-0.5">
									{t('numAlerts.whaleDesc')}
								</span>
							</div>
							<button
								type="button"
								dir="ltr"
								role="switch"
								aria-checked={alertOnWhale()}
								onClick={() => setAlertOnWhale(!alertOnWhale())}
								class={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 border ${
									alertOnWhale()
										? 'bg-[#4cd964] border-[#4cd964]/40'
										: 'bg-[#232d3a] border-white/[0.1]'
								}`}
							>
								<div
									class={`w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
										alertOnWhale() ? 'translate-x-5' : 'translate-x-0'
									}`}
								/>
							</button>
						</div>

						<div class="flex items-center justify-between p-3 rounded-[12px] frag-inset gap-3">
							<div class="min-w-0">
								<span class="text-[12.5px] font-semibold text-white block">
									{t('numAlerts.patternTitle')}
								</span>
								<span class="text-[11px] text-[#8c9ba5] block mt-0.5">
									{t('numAlerts.patternDesc')}
								</span>
							</div>
							<button
								type="button"
								dir="ltr"
								role="switch"
								aria-checked={alertOnPattern()}
								onClick={() => setAlertOnPattern(!alertOnPattern())}
								class={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 border ${
									alertOnPattern()
										? 'bg-[#2990ff] border-[#2990ff]/40'
										: 'bg-[#232d3a] border-white/[0.1]'
								}`}
							>
								<div
									class={`w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
										alertOnPattern() ? 'translate-x-5' : 'translate-x-0'
									}`}
								/>
							</button>
						</div>

						<button
							type="button"
							disabled={saving()}
							onClick={handleSave}
							class="w-full h-11 rounded-[11px] frag-btn-primary font-semibold text-[13px] disabled:opacity-55"
						>
							<Show when={!savedSuccess()} fallback={t('numAlerts.savedBtn')}>
								{saving() ? t('numAlerts.savingBtn') : t('numAlerts.saveBtn')}
							</Show>
						</button>
					</div>
				</div>
			</div>
		</Show>
	);
};
