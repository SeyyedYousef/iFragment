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
		<section class="w-full mb-5" aria-label={t('fragUi.liveMarketTickerAria')}>
			<div class="grid grid-cols-2 gap-2">
				{/* 1. TON/USD Live Rate */}
				<button
					type="button"
					onClick={() => go('/collection-info')}
					class="frag-card-interactive px-3 py-2.5 flex items-center justify-between gap-2 text-start cursor-pointer"
				>
					<span class="inline-flex items-center gap-1.5 text-[11.5px] text-[#8c9aa9] font-medium truncate">
						<span class="w-1.5 h-1.5 rounded-full bg-[#5aec8c] animate-pulse shrink-0" />
						<span class="truncate">{t('home.tickerTon')}</span>
					</span>
					<span class="text-[13px] font-semibold text-white tabular-nums shrink-0" dir="ltr">
						<Show
							when={
								!props.loading &&
								props.pulse?.tonUsdRate !== null &&
								props.pulse?.tonUsdRate !== undefined
							}
							fallback={<span class="text-white/50">—</span>}
						>
							${formatEnUsd(props.pulse?.tonUsdRate, 2)}
						</Show>
					</span>
				</button>

				{/* 2. +888 Numbers Floor */}
				<button
					type="button"
					onClick={() => go('/numbers/intel')}
					class="frag-card-interactive px-3 py-2.5 flex items-center justify-between gap-2 text-start cursor-pointer"
				>
					<span class="text-[11.5px] text-[#8c9aa9] font-medium truncate">
						{t('home.tickerNumbersFloor')}
					</span>
					<span
						class="inline-flex items-center gap-1 text-[13px] font-semibold text-white tabular-nums shrink-0"
						dir="ltr"
					>
						<TonIcon size={12} color="#4db2ff" />
						<Show
							when={
								!props.loading &&
								props.pulse?.numbersFloorTon !== null &&
								props.pulse?.numbersFloorTon !== undefined
							}
							fallback={<span class="text-white/50">—</span>}
						>
							{formatEnNumber(props.pulse?.numbersFloorTon, 0)}
						</Show>
					</span>
				</button>

				{/* 3. Username Floor */}
				<button
					type="button"
					onClick={() => go('/collection-info')}
					class="frag-card-interactive px-3 py-2.5 flex items-center justify-between gap-2 text-start cursor-pointer"
				>
					<span class="text-[11.5px] text-[#8c9aa9] font-medium truncate">
						{t('home.tickerUsernamesFloor')}
					</span>
					<span
						class="inline-flex items-center gap-1 text-[13px] font-semibold text-white tabular-nums shrink-0"
						dir="ltr"
					>
						<TonIcon size={12} color="#4db2ff" />
						<Show
							when={
								!props.loading &&
								props.pulse?.usernamesFloorTon !== null &&
								props.pulse?.usernamesFloorTon !== undefined
							}
							fallback={<span class="text-white/50">—</span>}
						>
							{formatEnNumber(props.pulse?.usernamesFloorTon, 0)}
						</Show>
					</span>
				</button>

				{/* 4. Gifts Fear & Greed Index */}
				<button
					type="button"
					onClick={() => go('/gifts/intel')}
					class="frag-card-interactive px-3 py-2.5 flex items-center justify-between gap-2 text-start cursor-pointer"
				>
					<span class="text-[11.5px] text-[#8c9aa9] font-medium truncate">
						{t('home.tickerGiftsFng')}
					</span>
					<span
						class={`text-[13px] font-semibold tabular-nums shrink-0 ${fngColorClass()}`}
						dir="ltr"
					>
						<Show
							when={
								!props.loading &&
								props.pulse?.giftsFngIndex !== null &&
								props.pulse?.giftsFngIndex !== undefined
							}
							fallback={<span class="text-white/50">—</span>}
						>
							{formatEnNumber(props.pulse?.giftsFngIndex, 0)}/100
						</Show>
					</span>
				</button>
			</div>
		</section>
	);
};
