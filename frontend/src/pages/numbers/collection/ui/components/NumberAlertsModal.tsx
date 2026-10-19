import { type Component, createEffect, createSignal, Show } from 'solid-js';
import { numbersApi } from '@/entities/numbers/api/numbersApi.js';
import { useI18n } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface AlertsModalProps {
	isOpen: boolean;
	onClose: () => void;
	currentFloor?: number | null;
}

const ALERTS_COPY: Record<
	string,
	{
		title: string;
		floorLabel: string;
		currentFloor: string;
		whaleTitle: string;
		whaleDesc: string;
		patternTitle: string;
		patternDesc: string;
		saveBtn: string;
		savingBtn: string;
		savedBtn: string;
	}
> = {
	fa: {
		title: 'هشدارهای هوشمند شماره‌ها',
		floorLabel: 'هشدار افت فلور به زیر (TON):',
		currentFloor: 'کف فعلی:',
		whaleTitle: 'خرید و فروش نهنگ‌ها',
		whaleDesc: 'معاملات بالای ۱۰,۰۰۰ TON و پایان مزایده‌ها',
		patternTitle: 'لیستینگ جدید الگوهای خاص',
		patternDesc: 'جنسیس، ۴تایی یکسان، باینری و...',
		saveBtn: 'ذخیره و فعال‌سازی در ربات تلگرام',
		savingBtn: 'در حال ذخیره...',
		savedBtn: 'هشدار با موفقیت فعال شد ✓',
	},
	en: {
		title: 'Smart +888 Number Alerts',
		floorLabel: 'Floor Drop Target Below (TON):',
		currentFloor: 'Current Floor:',
		whaleTitle: 'Whale Trades & Auction Ends',
		whaleDesc: 'Trades above 10,000 TON & closing auctions',
		patternTitle: 'Rare Pattern Listings',
		patternDesc: 'Genesis 4-digit, Quad tail, Binary & more',
		saveBtn: 'Save & Activate in Telegram Bot',
		savingBtn: 'Saving...',
		savedBtn: 'Alert Activated Successfully ✓',
	},
	ru: {
		title: 'Умные уведомления +888',
		floorLabel: 'Уведомить при падении пола ниже (TON):',
		currentFloor: 'Текущий пол:',
		whaleTitle: 'Сделки китов и финалы аукционов',
		whaleDesc: 'Сделки свыше 10,000 TON и завершение торгов',
		patternTitle: 'Новые листинги редких паттернов',
		patternDesc: 'Genesis 4-значные, квад-хвосты, бинарные и др.',
		saveBtn: 'Сохранить и включить в Telegram-боте',
		savingBtn: 'Сохранение...',
		savedBtn: 'Уведомления успешно активированы ✓',
	},
	zh: {
		title: '+888 智能价格雷达提醒',
		floorLabel: '地板价跌破提醒阈值 (TON):',
		currentFloor: '当前地板价:',
		whaleTitle: '巨鲸大额成交与拍卖结标',
		whaleDesc: '超过 10,000 TON 的大额交易与结标提醒',
		patternTitle: '稀有靓号新上架提醒',
		patternDesc: '4位创世号、四连号、二进制号等',
		saveBtn: '保存并在 Telegram 机器人中启用',
		savingBtn: '保存中...',
		savedBtn: '雷达提醒已成功启用 ✓',
	},
};

export const NumberAlertsModal: Component<AlertsModalProps> = (props) => {
	const { locale } = useI18n();
	const copy = () => ALERTS_COPY[locale()] || ALERTS_COPY.fa;

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
			<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
				<div class="bg-[#0e121d] border border-white/10 rounded-3xl p-5 max-w-sm w-full shadow-2xl relative">
					<div class="flex items-center justify-between mb-4 pb-2 border-b border-white/[0.08]">
						<div class="flex items-center gap-2">
							<span class="material-symbols-outlined text-amber-400 text-xl">
								notifications_active
							</span>
							<h3 class="text-sm font-black text-white">{copy().title}</h3>
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
								{copy().floorLabel}
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
								{copy().currentFloor} {props.currentFloor ? `${props.currentFloor} TON` : '—'}
							</p>
						</div>

						{/* Toggle: Whale Buys */}
						<div class="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
							<div>
								<span class="text-xs font-bold text-white block">{copy().whaleTitle}</span>
								<span class="text-[10px] text-white/40 block mt-0.5">{copy().whaleDesc}</span>
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
								<span class="text-xs font-bold text-white block">{copy().patternTitle}</span>
								<span class="text-[10px] text-white/40 block mt-0.5">{copy().patternDesc}</span>
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
							disabled={saving()}
							onClick={handleSave}
							class="w-full py-3 rounded-2xl bg-gradient-to-r from-[#0098EA] to-cyan-500 text-white font-bold text-xs shadow-lg shadow-[#0098EA]/20 active:scale-95 transition-all disabled:opacity-60"
						>
							<Show when={!savedSuccess()} fallback={copy().savedBtn}>
								{saving() ? copy().savingBtn : copy().saveBtn}
							</Show>
						</button>
					</div>
				</div>
			</div>
		</Show>
	);
};
