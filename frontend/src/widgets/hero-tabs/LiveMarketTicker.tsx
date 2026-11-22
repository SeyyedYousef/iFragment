import { useNavigate } from '@solidjs/router';
import { type Component, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { TonIcon } from '@/shared/ui/fragment/FragmentPrimitives.js';
import { formatEnNumber, formatEnUsd, type HomeMarketPulse } from './homeMarketData.js';

interface LiveMarketTickerProps {
	pulse: HomeMarketPulse | null;
	loading: boolean;
}

export const LiveMarketTicker: Component<LiveMarketTickerProps> = (props) => {
	const navigate = useNavigate();

	const go = (path: string) => {
		try {
			haptic.selection();
		} catch {}
		navigate(path);
	};

	const fngColorClass = () => {
		const score = props.pulse?.giftsFngIndex;
		if (score === null || score === undefined) return 'text-[#8c9aa9]';
		if (score >= 60) return 'text-[#5aec8c]';
		if (score >= 40) return 'text-[#ff9953]';
		return 'text-[#ff5c6c]';
	};

	return (
		<section
			class="w-full bg-[#1d252e] border-b border-white/[0.06]"
			aria-label="Live Market Ticker"
		>
			<div class="w-full max-w-[480px] mx-auto px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
				{/* 1. TON/USD Live Rate */}
				<button
					type="button"
					onClick={() => go('/collection-info')}
					class="shrink-0 h-7 px-2.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] flex items-center gap-1.5 text-[11.5px] transition-colors cursor-pointer"
					dir="ltr"
				>
					<span class="w-1.5 h-1.5 rounded-full bg-[#5aec8c] animate-pulse shrink-0" />
					<TonIcon size={12} color="#4db2ff" />
					<span class="text-[#8c9aa9] font-medium">{t('home.tickerTon')}</span>
					<Show
						when={
							!props.loading &&
							props.pulse?.tonUsdRate !== null &&
							props.pulse?.tonUsdRate !== undefined
						}
						fallback={<span class="text-white/60 font-mono tabular-nums">...</span>}
					>
						<span class="text-white font-semibold tabular-nums">
							${formatEnUsd(props.pulse?.tonUsdRate, 2)}
						</span>
					</Show>
				</button>

				{/* 2. +888 Numbers Floor */}
				<button
					type="button"
					onClick={() => go('/numbers/intel')}
					class="shrink-0 h-7 px-2.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] flex items-center gap-1.5 text-[11.5px] transition-colors cursor-pointer"
				>
					<span class="text-[#8c9aa9] font-medium">{t('home.tickerNumbersFloor')}</span>
					<span
						class="inline-flex items-center gap-1 font-semibold text-white tabular-nums"
						dir="ltr"
					>
						<TonIcon size={11} color="#4db2ff" />
						<Show
							when={
								!props.loading &&
								props.pulse?.numbersFloorTon !== null &&
								props.pulse?.numbersFloorTon !== undefined
							}
							fallback={<span class="text-white/60">—</span>}
						>
							{formatEnNumber(props.pulse?.numbersFloorTon, 0)}
						</Show>
					</span>
				</button>

				{/* 3. Username Floor */}
				<button
					type="button"
					onClick={() => go('/collection-info')}
					class="shrink-0 h-7 px-2.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] flex items-center gap-1.5 text-[11.5px] transition-colors cursor-pointer"
				>
					<span class="text-[#8c9aa9] font-medium">{t('home.tickerUsernamesFloor')}</span>
					<span
						class="inline-flex items-center gap-1 font-semibold text-white tabular-nums"
						dir="ltr"
					>
						<TonIcon size={11} color="#4db2ff" />
						<Show
							when={
								!props.loading &&
								props.pulse?.usernamesFloorTon !== null &&
								props.pulse?.usernamesFloorTon !== undefined
							}
							fallback={<span class="text-white/60">—</span>}
						>
							{formatEnNumber(props.pulse?.usernamesFloorTon, 0)}
						</Show>
					</span>
				</button>

				{/* 4. Gifts Fear & Greed Index */}
				<button
					type="button"
					onClick={() => go('/gifts/intel')}
					class="shrink-0 h-7 px-2.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] flex items-center gap-1.5 text-[11.5px] transition-colors cursor-pointer"
				>
					<span class="text-[#8c9aa9] font-medium">{t('home.tickerGiftsFng')}</span>
					<span class={`font-semibold tabular-nums ${fngColorClass()}`} dir="ltr">
						<Show
							when={
								!props.loading &&
								props.pulse?.giftsFngIndex !== null &&
								props.pulse?.giftsFngIndex !== undefined
							}
							fallback={<span class="text-white/60">—</span>}
						>
							{formatEnNumber(props.pulse?.giftsFngIndex, 0)}/100
						</Show>
					</span>
				</button>
			</div>
		</section>
	);
};
