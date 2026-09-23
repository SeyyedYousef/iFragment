import { type Component, createMemo } from 'solid-js';
import { isRtl } from '@/shared/i18n/index.js';

interface Props {
	expectedTon: number;
	expectedUsd?: number;
	serialNumber?: number;
	modelName?: string;
	isUpgraded?: boolean;
	isCraftable?: boolean;
	confidenceScore?: number;
	verdict?: string;
	summaryFa?: string;
	summaryEn?: string;
}

export type LayaActionType = 'HOLD' | 'SELL_NOW' | 'CRAFT_FORGE' | 'UPGRADE';

export const GiftLayaActionCard: Component<Props> = (props) => {
	const expected = () => props.expectedTon || 0;
	const confidence = () => props.confidenceScore || 88;
	const serial = () => props.serialNumber || 1000;

	// Determine optimal action through LAYA decision matrix
	const action = createMemo<{
		type: LayaActionType;
		badgeFa: string;
		badgeEn: string;
		color: string;
		bgGradient: string;
		borderColor: string;
		icon: string;
		timeframeFa: string;
		timeframeEn: string;
		rationaleFa: string;
		rationaleEn: string;
		expectedNetTon: number;
	}>(() => {
		// Priority 1: If not upgraded and low serial / high model rarity -> UPGRADE
		if (props.isUpgraded === false) {
			return {
				type: 'UPGRADE',
				badgeFa: 'ارتقای فوری به ان‌اف‌تی در تلگرام',
				badgeEn: 'UPGRADE TO ON-CHAIN NFT',
				color: '#0098EA',
				bgGradient: 'from-sky-950/40 via-[#0A121A] to-[#08090D]',
				borderColor: 'border-sky-500/30',
				icon: 'rocket_launch',
				timeframeFa: 'هم‌اکنون در پله جاری حراج استارز',
				timeframeEn: 'Immediate / Current Stars Dutch Step',
				rationaleFa:
					'این هدیه هنوز درون‌برنامه‌ای است. با پرداخت هزینه استارز و تبدیل آن به ان‌اف‌تی روی شبکه TON، ارزش آن حداقل ۳۵٪ به‌دلیل باز شدن دسترسی به مارکت‌پلیس‌های بین‌المللی افزایش می‌یابد.',
				rationaleEn:
					'This gift is in-app. Minting it as an on-chain NFT unlocks secondary liquidity on Fragment and Getgems with an immediate +35% valuation uplift.',
				expectedNetTon: Math.round(expected() * 1.35 * 10) / 10,
			};
		}

		// Priority 2: Very high serial & common model & craftable -> CRAFT_FORGE
		if (props.isCraftable && serial() > 5000 && expected() < 30) {
			return {
				type: 'CRAFT_FORGE',
				badgeFa: 'ورود به کوره ذوب و ساخت (Crafting Forge)',
				badgeEn: 'MERGE & CRAFT FOR HIGH-TIER',
				color: '#f59e0b',
				bgGradient: 'from-amber-950/40 via-[#140F08] to-[#08090D]',
				borderColor: 'border-amber-500/30',
				icon: 'local_fire_department',
				timeframeFa: 'فرصت فصلی کوره تلگرام',
				timeframeEn: 'Seasonal Crafting Window',
				rationaleFa:
					'به‌دلیل سریال بالا و رندوم بودن تریت‌ها، نگهداری خام این آیتم سودآوری کمتری دارد. سوزاندن در ترکیب کرفتینگ و شانس دستیابی به مدل‌های لیمیتد ارزش انتظاری بالاتری تولید می‌کند.',
				rationaleEn:
					'Common high-serial gift. Merging in the crafting forge presents a positive expected value (EV) arbitrage vs current secondary floor.',
				expectedNetTon: Math.round(expected() * 1.25 * 10) / 10,
			};
		}

		// Priority 3: Low serial (< 100) or high expected value -> HOLD
		if (serial() < 100 || expected() > 80) {
			return {
				type: 'HOLD',
				badgeFa: 'هولد استراتژیک و عدم فروش در کف',
				badgeEn: 'STRATEGIC ACCUMULATION (HOLD)',
				color: '#10b981',
				bgGradient: 'from-emerald-950/40 via-[#09150E] to-[#08090D]',
				borderColor: 'border-emerald-500/30',
				icon: 'shield',
				timeframeFa: 'افق ۳ تا ۶ ماهه (رالی اکوسیستم تون)',
				timeframeEn: '3 to 6 Months (TON Rally Window)',
				rationaleFa:
					'آیتم دارای تریت‌های کمیاب و شماره سریال کلکسیونی معتبر است. بازار در فاز جذب کف قیمت قرار دارد و عرضه ثانویه این رده در حال خشک شدن کامل است.',
				rationaleEn:
					'Low mint number and scarce trait profile. Floor absorption indicates shrinking floating supply. Premature liquidation sacrifices long-term premium.',
				expectedNetTon: Math.round(expected() * 1.45 * 10) / 10,
			};
		}

		// Default: SELL_NOW if market liquidity peak
		return {
			type: 'SELL_NOW',
			badgeFa: 'شناسایی سود و نقد کردن در اوج تقاضا',
			badgeEn: 'TAKE PROFIT / LIQUIDATE NOW',
			color: '#ef4444',
			bgGradient: 'from-rose-950/40 via-[#180A0F] to-[#08090D]',
			borderColor: 'border-rose-500/30',
			icon: 'point_of_sale',
			timeframeFa: 'فوری (ظرف ۴۸ تا ۷۲ ساعت آینده)',
			timeframeEn: 'Within 48-72 Hours',
			rationaleFa:
				'نسبت تقاضای خرید به حجم لیستینگ‌ها در بالاترین نقطه ۲۱ روزه قرار دارد. با توجه به افزایش احتمالی عرضه در رویدادهای آتی تلگرام، خروج با قیمت فعلی بهترین ریسک به ریوارد را دارد.',
			rationaleEn:
				'Secondary liquidity is currently peaked. Placing an aggressive ask captures peak liquidity ahead of upcoming supply unlocks.',
			expectedNetTon: Math.round(expected() * 0.95 * 10) / 10,
		};
	});

	const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });

	return (
		<div class="bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 shadow-xl text-start flex flex-col gap-4 relative overflow-hidden">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div
						class="w-9 h-9 rounded-[14px] flex items-center justify-center border"
						style={{
							'background-color': `${action().color}20`,
							'border-color': `${action().color}40`,
							color: action().color,
						}}
					>
						<span class="material-symbols-outlined text-[20px]">{action().icon}</span>
					</div>
					<div class="flex flex-col">
						<h3 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{isRtl() ? 'کارت تصمیم‌گیری استراتژیک سیستم ۱ لایا' : 'LAYA SYSTEM 1 STRATEGIC ACTION CARD'}
						</h3>
						<span class="text-[9px] font-mono text-white/40">
							{isRtl() ? 'سیگنال قطعی اقدام و بهینه‌سازی دارایی' : 'Dynamic algorithmic action verdict & execution horizon'}
						</span>
					</div>
				</div>
				<span
					class="text-[9px] font-mono font-black px-2.5 py-0.5 rounded-md border"
					style={{
						'background-color': `${action().color}15`,
						'border-color': `${action().color}30`,
						color: action().color,
					}}
				>
					{confidence()}% CERTAINTY
				</span>
			</div>

			{/* Main Action Callout */}
			<div
				class={`bg-gradient-to-r ${action().bgGradient} border ${action().borderColor} rounded-[22px] p-4 flex flex-col gap-3`}
			>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span
							class="text-xs font-mono font-black uppercase px-2 py-0.5 rounded-md text-black"
							style={{ 'background-color': action().color }}
						>
							{action().type}
						</span>
						<span class="text-sm font-black text-white">
							{isRtl() ? action().badgeFa : action().badgeEn}
						</span>
					</div>
				</div>

				<p class="text-xs text-white/80 leading-relaxed font-sans">
					{isRtl() ? (props.summaryFa || action().rationaleFa) : (props.summaryEn || action().rationaleEn)}
				</p>

				{/* Two Metrics in Callout */}
				<div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 font-mono text-[10px]">
					<div class="flex flex-col">
						<span class="text-white/40 uppercase">
							{isRtl() ? 'افق زمانی اجرا:' : 'Execution Horizon:'}
						</span>
						<span class="text-white font-bold mt-0.5">
							{isRtl() ? action().timeframeFa : action().timeframeEn}
						</span>
					</div>

					<div class="flex flex-col items-end">
						<span class="text-white/40 uppercase">
							{isRtl() ? 'خالص انتظاری بازدهی:' : 'Target Net Realization:'}
						</span>
						<div class="flex items-baseline gap-1 mt-0.5">
							<span class="text-sm font-black" style={{ color: action().color }}>
								{fmt(action().expectedNetTon)}
							</span>
							<span class="text-[9px] font-bold text-white/60">TON</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
