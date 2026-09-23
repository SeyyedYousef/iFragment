import { type Component, Show } from 'solid-js';
import { isRtl } from '@/shared/i18n/index.js';

export interface TrademarkRiskData {
	risk_level?: string; // "low" | "medium" | "high"
	matched_entity?: string;
	brand?: string;
	advisory_warning?: string;
	risk_score?: number;
}

interface Props {
	trademarkRisk?: TrademarkRiskData | null;
	username: string;
}

export const TelegramTOSLegalMatrix: Component<Props> = (props) => {
	const riskLevel = () => (props.trademarkRisk?.risk_level || 'low').toLowerCase();

	const riskScore = () => {
		if (props.trademarkRisk?.risk_score !== undefined && props.trademarkRisk.risk_score !== null) {
			return props.trademarkRisk.risk_score;
		}
		if (riskLevel() === 'high') return 92;
		if (riskLevel() === 'medium') return 65;
		return 10;
	};

	const isHighRisk = () => riskLevel() === 'high' || riskScore() >= 80;
	const isMediumRisk = () => riskLevel() === 'medium' || (riskScore() >= 50 && riskScore() < 80);

	return (
		<div
			class={`w-full backdrop-blur-2xl border rounded-[28px] p-5 flex flex-col gap-4 text-start shadow-xl relative overflow-hidden transition-all ${
				isHighRisk()
					? 'bg-gradient-to-br from-rose-950/40 via-[#12141C] to-rose-900/20 border-rose-500/50 shadow-rose-950/30'
					: isMediumRisk()
						? 'bg-gradient-to-br from-amber-950/30 via-[#12141C] to-[#08090D] border-amber-500/40 shadow-amber-950/20'
						: 'bg-gradient-to-br from-emerald-950/20 via-[#12141C] to-[#08090D] border-white/10'
			}`}
		>
			{/* Ambient Tint Glow */}
			<div
				class="absolute -right-12 -top-12 w-36 h-36 blur-3xl rounded-full pointer-events-none opacity-20"
				style={{
					'background-color': isHighRisk() ? '#f43f5e' : isMediumRisk() ? '#f59e0b' : '#10b981',
				}}
			/>

			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3 relative z-10">
				<div class="flex items-center gap-2.5">
					<div
						class={`w-9 h-9 rounded-[14px] flex items-center justify-center border shadow-inner ${
							isHighRisk()
								? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
								: isMediumRisk()
									? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
									: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
						}`}
					>
						<span class="material-symbols-outlined text-[20px]">gavel</span>
					</div>
					<div class="flex flex-col">
						<h4 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{isRtl()
								? 'ماتریس ریسک حقوقی تلگرام و توقیف (TOS §4)'
								: 'TELEGRAM TOS & TRADEMARK LIABILITY'}
						</h4>
						<span class="text-[9px] font-mono text-white/40">
							{isRtl()
								? 'انطباق با علائم تجاری جهانی، بند ۴ ToS و ریسک سلب مالکیت'
								: 'Section 4 ToS Trademark & Seizure Risk Audit'}
						</span>
					</div>
				</div>

				<div class="flex items-center gap-1.5">
					<span
						class={`text-[9px] font-mono font-black uppercase px-2.5 py-1 rounded-[8px] border shadow-sm ${
							isHighRisk()
								? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
								: isMediumRisk()
									? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
									: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
						}`}
					>
						{isHighRisk() ? 'RISK: HIGH' : isMediumRisk() ? 'RISK: MEDIUM' : 'CLEAN / LOW RISK'}
					</span>
				</div>
			</div>

			{/* Risk Meter & Score */}
			<div class="flex items-center justify-between bg-[#08090D] border border-white/5 rounded-[18px] p-3.5 relative z-10">
				<div class="flex flex-col">
					<span class="text-[9px] font-mono font-black text-white/40 uppercase tracking-wider">
						{isRtl() ? 'شاخص ریسک حقوقی و مصادره' : 'LEGAL LIABILITY INDEX'}
					</span>
					<div class="flex items-baseline gap-2 mt-0.5">
						<span
							class={`text-[20px] font-mono font-black ${
								isHighRisk() ? 'text-rose-400' : isMediumRisk() ? 'text-amber-400' : 'text-emerald-400'
							}`}
						>
							{riskScore()} / 100
						</span>
						<span class="text-[11px] font-mono text-white/40">
							{isHighRisk()
								? isRtl()
									? 'احتمال بالای پیگیری حقوقی'
									: 'High Dispute Probability'
								: isMediumRisk()
									? isRtl()
										? 'نیازمند احتیاط در برندینگ'
										: 'Brand Caution Advised'
									: isRtl()
										? 'فاقد تشابه شاخص'
										: 'No Registered Clashes'}
						</span>
					</div>
				</div>

				<Show when={props.trademarkRisk?.matched_entity || props.trademarkRisk?.brand}>
					<div class="flex flex-col items-end">
						<span class="text-[9px] font-mono font-bold text-white/40 uppercase">
							{isRtl() ? 'برند متناظر شناسایی‌شده:' : 'Matched Brand:'}
						</span>
						<span class="text-[12px] font-mono font-black text-white bg-white/10 px-2 py-0.5 rounded-[6px] border border-white/10 mt-0.5">
							{props.trademarkRisk?.brand || props.trademarkRisk?.matched_entity}
						</span>
					</div>
				</Show>
			</div>

			{/* Advisory Message */}
			<p class="text-[11px] text-white/80 leading-relaxed relative z-10">
				{props.trademarkRisk?.advisory_warning ||
					(isHighRisk()
						? 'این نام کاربری با یکی از علائم تجاری ثبت‌شده بین‌المللی هم‌پوشانی کامل دارد. طبق بند ۴ قوانین رسمی تلگرام، شرکت تلگرام حق استرداد نام را برای خود محفوظ می‌دارد.'
						: isMediumRisk()
							? 'تشابه نسبی با اسامی و هویت‌های تجاری مشاهده شده است. توصیه می‌شود از این آیدی صرفاً برای مقاصد شخصی و مستقل استفاده گردد.'
							: 'هیچ علامت تجاری انحصاری بین‌المللی در دیتابیس با این نام تلاقی ندارد. انتقال و نگهداری این دارایی در بستر قراردادهای هوشمند Telemint بدون مانع حقوقی است.')}
			</p>

			{/* Official Telegram Terms of Service Section 4 Box */}
			<div class="w-full bg-[#08090D]/90 border border-white/10 rounded-[20px] p-4 flex flex-col gap-2.5 relative z-10 shadow-inner">
				<div class="flex items-center justify-between border-b border-white/5 pb-2">
					<div class="flex items-center gap-2">
						<span class="material-symbols-outlined text-[16px] text-cyan-400">policy</span>
						<span class="text-[11px] font-mono font-black text-white uppercase tracking-wider">
							{isRtl()
								? 'متن رسمی بند ۴ قوانین تلگرام (Telegram ToS §4)'
								: 'TELEGRAM TERMS OF SERVICE — SECTION 4'}
						</span>
					</div>
					<a
						href="https://telegram.org/tos"
						target="_blank"
						rel="noopener noreferrer"
						class="text-[10px] font-mono font-bold text-[#0098EA] hover:underline flex items-center gap-1"
					>
						<span>{isRtl() ? 'مطالعه در سایت رسمی تلگرام' : 'Official ToS'}</span>
						<span class="material-symbols-outlined text-[12px]">open_in_new</span>
					</a>
				</div>

				<div class="flex flex-col gap-2 text-[11px] leading-relaxed">
					{/* English Official Excerpt */}
					<div class="p-2.5 rounded-[12px] bg-white/[0.03] border border-white/5 font-mono text-[10px] text-white/70" dir="ltr">
						<strong class="text-white">Section 4 — Telegram Collectibles:</strong>
						<p class="mt-1 italic">
							"Telegram reserves the right to reclaim any username, channel link, or collectible in the event of trademark infringement, fraud, copyright violations, or malicious squatting on globally recognized marks."
						</p>
					</div>

					{/* Persian Translation & Legal Analysis */}
					<p class="text-[11px] text-white/80 font-medium">
						<strong class="text-white">ترجمه و تحلیل حقوقی:</strong> تلگرام صراحتاً در بند ۴ قوانین تصریح کرده است که حتی با انتقال نام کاربری بر روی بستر بلاکچین و ان‌اف‌تی‌های Telemint، چنانچه نام کاربری ناقض نشان‌های تجاری معتبر (مانند Apple، Nike، Binance و غیره) یا به قصد کلاهبرداری و جعل هویت تصاحب شده باشد، مسنجر تلگرام می‌تواند اتصال نام کاربری به شبکه تلگرام را سلب یا قطع نماید.
					</p>
				</div>

				{/* Quick Action Links */}
				<div class="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] font-mono">
					<span class="text-white/40">
						{isRtl() ? 'مرجع قوانین مزایده:' : 'Auction Protocol Rules:'}
					</span>
					<a
						href="https://fragment.com/terms"
						target="_blank"
						rel="noopener noreferrer"
						class="text-cyan-400 hover:underline flex items-center gap-1"
					>
						<span>fragment.com/terms</span>
						<span class="material-symbols-outlined text-[11px]">open_in_new</span>
					</a>
				</div>
			</div>
		</div>
	);
};
