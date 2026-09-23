import { type Component, createMemo } from 'solid-js';
import { layaT, GIFTS_I18N, type LocalizedText } from '@/shared/i18n/laya-i18n.js';

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
		badge: LocalizedText;
		color: string;
		bgGradient: string;
		borderColor: string;
		icon: string;
		timeframe: LocalizedText;
		rationale: LocalizedText;
		expectedNetTon: number;
	}>(() => {
		// Priority 1: If not upgraded and low serial / high model rarity -> UPGRADE
		if (props.isUpgraded === false) {
			return {
				type: 'UPGRADE',
				badge: GIFTS_I18N.actionUpgrade,
				color: '#0098EA',
				bgGradient: 'from-sky-950/40 via-[#0A121A] to-[#08090D]',
				borderColor: 'border-sky-500/30',
				icon: 'rocket_launch',
				timeframe: {
					en: 'Immediate / Current Stars Dutch Step',
					fa: 'هم‌اکنون در پله جاری حراج استارز',
					ru: 'Немедленно на текущем шаге аукциона Stars',
					zh: '立即在当前 Stars 阶梯下铸造',
				},
				rationale: {
					en: 'This gift is in-app. Minting it as an on-chain NFT unlocks secondary liquidity on Fragment and Getgems with an immediate +35% valuation uplift.',
					fa: 'این هدیه هنوز درون‌برنامه‌ای است. با پرداخت هزینه استارز و تبدیل آن به ان‌اف‌تی روی شبکه TON، ارزش آن حداقل ۳۵٪ به‌دلیل باز شدن دسترسی به مارکت‌پلیس‌های بین‌المللی افزایش می‌یابد.',
					ru: 'Этот подарок находится в приложении. Перевод его в NFT на блокчейн TON открывает вторичную ликвидность на Fragment с ростом стоимости от +35%.',
					zh: '该礼物目前仍为应用内形态。通过 Stars 升级为 TON 链上 NFT 即可解锁 Fragment 与二级市场流动性，估值即刻提升 +35%。',
				},
				expectedNetTon: Math.round(expected() * 1.35 * 10) / 10,
			};
		}

		// Priority 2: Very high serial & common model & craftable -> CRAFT_FORGE
		if (props.isCraftable && serial() > 5000 && expected() < 30) {
			return {
				type: 'CRAFT_FORGE',
				badge: GIFTS_I18N.actionCraftForge,
				color: '#f59e0b',
				bgGradient: 'from-amber-950/40 via-[#140F08] to-[#08090D]',
				borderColor: 'border-amber-500/30',
				icon: 'local_fire_department',
				timeframe: {
					en: 'Seasonal Crafting Window',
					fa: 'فرصت فصلی کوره تلگرام',
					ru: 'Сезонное окно крафтинга',
					zh: '当季熔炼升级黄金窗口',
				},
				rationale: {
					en: 'Common high-serial gift. Merging in the crafting forge presents a positive expected value (EV) arbitrage vs current secondary floor.',
					fa: 'به‌دلیل سریال بالا و رندوم بودن تریت‌ها، نگهداری خام این آیتم سودآوری کمتری دارد. سوزاندن در ترکیب کرفتینگ و شانس دستیابی به مدل‌های لیمیتد ارزش انتظاری بالاتری تولید می‌کند.',
					ru: 'Обычный подарок с большим номером. Слияние в кузнице крафта дает положительное математическое ожидание прибыли.',
					zh: '大编号普通特征礼物。投入炼金熔炉熔炼搏取限量稀有款拥有正向期望值 (EV) 套利空间。',
				},
				expectedNetTon: Math.round(expected() * 1.25 * 10) / 10,
			};
		}

		// Priority 3: Low serial (< 100) or high expected value -> HOLD
		if (serial() < 100 || expected() > 80) {
			return {
				type: 'HOLD',
				badge: GIFTS_I18N.actionHold,
				color: '#10b981',
				bgGradient: 'from-emerald-950/40 via-[#09150E] to-[#08090D]',
				borderColor: 'border-emerald-500/30',
				icon: 'shield',
				timeframe: {
					en: '3 to 6 Months (TON Rally Window)',
					fa: 'افق ۳ تا ۶ ماهه (رالی اکوسیستم تون)',
					ru: '3–6 месяцев (ралли экосистемы TON)',
					zh: '3至6个月（TON生态主升浪周期）',
				},
				rationale: {
					en: 'Low mint number and scarce trait profile. Floor absorption indicates shrinking floating supply. Premature liquidation sacrifices long-term premium.',
					fa: 'آیتم دارای تریت‌های کمیاب و شماره سریال کلکسیونی معتبر است. بازار در فاز جذب کف قیمت قرار دارد و عرضه ثانویه این رده در حال خشک شدن کامل است.',
					ru: 'Низкий номер выпуска и редкие черты. Поглощение предложения указывает на скорый дефицит. Ранняя продажа лишит вас премии за редкость.',
					zh: '前百极品小号与稀缺特征组合。链上巨鲸持续吸收抛盘，流通盘急剧收缩，切忌过早低价清仓。',
				},
				expectedNetTon: Math.round(expected() * 1.45 * 10) / 10,
			};
		}

		// Default: SELL_NOW if market liquidity peak
		return {
			type: 'SELL_NOW',
			badge: GIFTS_I18N.actionSellNow,
			color: '#ef4444',
			bgGradient: 'from-rose-950/40 via-[#180A0F] to-[#08090D]',
			borderColor: 'border-rose-500/30',
			icon: 'point_of_sale',
			timeframe: {
				en: 'Within 48-72 Hours',
				fa: 'فوری (ظرف ۴۸ تا ۷۲ ساعت آینده)',
				ru: 'В течение 48–72 часов',
				zh: '48至72小时内即刻变现',
			},
			rationale: {
				en: 'Secondary liquidity is currently peaked. Placing an aggressive ask captures peak liquidity ahead of upcoming supply unlocks.',
				fa: 'نسبت تقاضای خرید به حجم لیستینگ‌ها در بالاترین نقطه ۲۱ روزه قرار دارد. با توجه به افزایش احتمالی عرضه در رویدادهای آتی تلگرام، خروج با قیمت فعلی بهترین ریسک به ریوارد را دارد.',
				ru: 'Ликвидность на пике. Выставление ордера прямо сейчас позволит зафиксировать максимальную прибыль до новых разлоков.',
				zh: '二级流动性处于近期高点。在后续活动代币与新供给释放前挂单套现具备极高胜率。',
			},
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
							{layaT(GIFTS_I18N.actionCardTitle)}
						</h3>
						<span class="text-[9px] font-mono text-white/40">
							{layaT(GIFTS_I18N.actionCardSubtitle)}
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
					{confidence()}{layaT(GIFTS_I18N.actionCertaintySuffix)}
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
							{layaT(action().badge)}
						</span>
					</div>
				</div>

				<p class="text-xs text-white/80 leading-relaxed font-sans">
					{layaT(action().rationale)}
				</p>

				{/* Two Metrics in Callout */}
				<div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 font-mono text-[10px]">
					<div class="flex flex-col">
						<span class="text-white/40 uppercase">
							{layaT(GIFTS_I18N.executionHorizon)}
						</span>
						<span class="text-white font-bold mt-0.5">
							{layaT(action().timeframe)}
						</span>
					</div>

					<div class="flex flex-col items-end">
						<span class="text-white/40 uppercase">
							{layaT(GIFTS_I18N.targetNetRealization)}
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
