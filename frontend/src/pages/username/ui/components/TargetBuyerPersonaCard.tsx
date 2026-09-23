import { type Component, createSignal, For, Show } from 'solid-js';
import { isRtl } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export interface BuyerPersonaItem {
	id: string;
	titleFa: string;
	titleEn: string;
	budgetRange: string;
	icon: string;
	color: string;
	rationaleFa: string;
	rationaleEn: string;
	typicalHoldFa: string;
	typicalHoldEn: string;
	urgencyFa: string;
	urgencyEn: string;
}

const ALL_PERSONAS: BuyerPersonaItem[] = [
	{
		id: 'ton_whale',
		titleFa: 'نهنگ اکوسیستم تون (TON Whale)',
		titleEn: 'TON Whale & Ecosystem Allocator',
		budgetRange: '50,000+ TON',
		icon: 'water_drop',
		color: '#0098EA',
		rationaleFa:
			'سرمایه‌گذاران اولیه بلاکچین TON با نقدینگی نامحدود؛ به دنبال دارایی‌های نمادین، کوتاه‌ترین نام‌ها و نگهداری بلندمدت ضدتورمی بدون وابستگی به نوسانات مقطعی.',
		rationaleEn:
			'Deep-pocketed TON foundation members and seed allocators acquiring generational vanity grails.',
		typicalHoldFa: 'نگهداری دائمی یا وثیقه در پروتکل‌های وام‌دهی',
		typicalHoldEn: 'Permanent HODL or DeFi Collateral',
		urgencyFa: 'خرید قطعی در هر قیمتی در صورت تطابق با پرستیژ شخصی',
		urgencyEn: 'Aggressive bidding if prestige matches portfolio',
	},
	{
		id: 'web3_founder',
		titleFa: 'بنیان‌گذار استارتاپ وب۳ و دیفای',
		titleEn: 'Web3 Startup & Protocol Founder',
		budgetRange: '5,000 – 50,000 TON',
		icon: 'rocket_launch',
		color: '#10b981',
		rationaleFa:
			'تیم‌های سازنده صرافی‌های غیرمتمرکز، کیف‌پول‌ها، بریج‌ها و پروتکل‌های زیرساختی وب۳؛ نیازمند شناسه‌ای مقتدر جهت جلب اعتماد و راه‌اندازی کمپین‌های مارکتینگ.',
		rationaleEn:
			'DeFi, DEX, and wallet creators needing authoritative brand identity on Telegram for institutional trust.',
		typicalHoldFa: 'استقرار دائمی به عنوان آدرس رسمی قرارداد یا کانال پروژه',
		typicalHoldEn: 'Permanent deployment as official handle',
		urgencyFa: 'بالا، پیش از راه‌اندازی توکن یا لانچ‌پد',
		urgencyEn: 'High, pre-TGE or milestone launch',
	},
	{
		id: 'media_network',
		titleFa: 'شبکه رسانه‌ای و کانال‌های پرمخاطب',
		titleEn: 'Media Network & Broadcast Hub',
		budgetRange: '2,500 – 25,000 TON',
		icon: 'campaign',
		color: '#ec4899',
		rationaleFa:
			'کانال‌های خبری، رسانه‌های کریپتو، کانال‌های سیگنال و شبکه‌های سرگرمی با چند میلیون عضو؛ شناسه کوتاه و ماندگار نرخ کلیک ورودی (CTR) را به‌طور چشمگیر بالا می‌برد.',
		rationaleEn:
			'High-volume Telegram news channels and signal groups where short memorable handles maximize search conversion.',
		typicalHoldFa: 'استفاده عملیاتی روزمره جهت جذب مخاطب ارگانیک',
		typicalHoldEn: 'Core operational asset for organic reach',
		urgencyFa: 'وابسته به رقابت با سایر کانال‌های رقیب در سرچ تلگرام',
		urgencyEn: 'Driven by search ranking primacy',
	},
	{
		id: 'domain_speculator',
		titleFa: 'کلکسیونر حرفه‌ای دامین و نام‌های ناب',
		titleEn: 'Domain Speculator & Grail Collector',
		budgetRange: '1,000 – 15,000 TON',
		icon: 'sell',
		color: '#f59e0b',
		rationaleFa:
			'معامله‌گران باتجربه دامنه اینترنتی و بازار فرگمنت؛ خرید نام‌هایی که کمتر از ارزش واقعی قیمت‌گذاری شده‌اند (Undervalued) با هدف فیلیپ یا اجاره به نهادها.',
		rationaleEn:
			'Arbitrageurs and domain investors seeking undervalued gems for secondary flips and yield rentals.',
		typicalHoldFa: 'میان‌مدت (۳ تا ۱۲ ماه) تا رسیدن به تارگت سود',
		typicalHoldEn: 'Medium-term hold (3–12 months)',
		urgencyFa: 'سریع در صورت کشف زیر کف قیمت منصفانه',
		urgencyEn: 'Opportunistic on discounts below fair value',
	},
	{
		id: 'miniapp_operator',
		titleFa: 'سازنده مینی‌اپ و بات‌های تلگرامی',
		titleEn: 'Telegram MiniApp & Bot Operator',
		budgetRange: '500 – 10,000 TON',
		icon: 'smart_toy',
		color: '#8b5cf6',
		rationaleFa:
			'توسعه‌دهندگان بازی‌های تلگرامی، مینی‌اپ‌های وب۳ و ارائه‌دهندگان خدمات اتوماسیون؛ نیاز به آیدی با نام بات هماهنگ با فرایند اشتراک‌گذاری کاربران.',
		rationaleEn:
			'Tap-to-earn game devs and viral bot operators optimizing viral invite links and bot inline queries.',
		typicalHoldFa: 'بلندمدت در طول چرخه حیات محصول',
		typicalHoldEn: 'Lifecycle of the game or bot application',
		urgencyFa: 'فوری پیش از کمپین‌های جذب کاربر (User Acquisition)',
		urgencyEn: 'Immediate before viral onboarding surges',
	},
	{
		id: 'corporate_fintech',
		titleFa: 'شرکت‌های تجاری سنتی و فین‌تک',
		titleEn: 'FinTech & Corporate Brand',
		budgetRange: '10,000 – 100,000 TON',
		icon: 'corporate_fare',
		color: '#06b6d4',
		rationaleFa:
			'شرکت‌های پرداخت، نئوبانک‌ها و برندهای جهانی واردشده به تلگرام برای ساخت کانال و مینی‌اپ پرداخت؛ جلوگیری از فیشینگ و تصاحب دارایی رسمی برند.',
		rationaleEn:
			'Traditional payment firms, neobanks, and consumer brands securing their official brand namespace.',
		typicalHoldFa: 'مالکیت حقوقی دائمی در خزانه‌داری شرکتی',
		typicalHoldEn: 'Corporate treasury permanent custody',
		urgencyFa: 'برنامه‌ریزی‌شده و بر مبنای بودجه سالانه بازاریابی',
		urgencyEn: 'Budget-allocated corporate procurement',
	},
	{
		id: 'vip_creator',
		titleFa: 'چهره‌های سرشناس و برندهای شخصی VIP',
		titleEn: 'HNWI Celebrity & Personal Brand',
		budgetRange: '500 – 5,000 TON',
		icon: 'star',
		color: '#eab308',
		rationaleFa:
			'اینفلوئنسرها، مدیران ارشد، هنرمندان و تحلیل‌گران سرشناس که به دنبال تمایز پروفایل شخصی، برندسازی پایدار و هویت ممتاز در مسنجر تلگرام هستند.',
		rationaleEn:
			'Key Opinion Leaders (KOLs), executives, and celebrities wanting clean signature monikers.',
		typicalHoldFa: 'هویت شخصی دائمی در پروفایل شخصی',
		typicalHoldEn: 'Personal identity and networking asset',
		urgencyFa: 'عاطفی و هویت‌محور',
		urgencyEn: 'Identity-driven personal affinity',
	},
	{
		id: 'retail_power_user',
		titleFa: 'کاربران وفادار و پاور-یوزرهای تلگرام',
		titleEn: 'Retail Power User & Premium Envoy',
		budgetRange: '50 – 1,000 TON',
		icon: 'person',
		color: '#94a3b8',
		rationaleFa:
			'کاربران فعال تلگرام پرمیوم که مایلند به جای شناسه‌های تصادفی یا عددی، یک آیدی خاص، روان و متقارن را برای مکالمات روزمره و گروه‌ها به مالکیت بگیرند.',
		rationaleEn:
			'Passionate Telegram enthusiasts upgrading personal usernames for everyday messaging status.',
		typicalHoldFa: 'استفاده مادام‌العمر شخصی',
		typicalHoldEn: 'Everyday account identifier',
		urgencyFa: 'منوط به قیمت مناسب و سهولت پرداخت با ارز بومی یا استارز',
		urgencyEn: 'Price-sensitive retail acquisition',
	},
];

interface Props {
	detectedPersona?: string;
	username: string;
}

export const TargetBuyerPersonaCard: Component<Props> = (props) => {
	const [expanded, setExpanded] = createSignal(false);

	// Detect matched persona key
	const matchedId = () => {
		const raw = (props.detectedPersona || '').toLowerCase();
		if (raw.includes('whale') || raw.includes('ton_whale')) return 'ton_whale';
		if (raw.includes('founder') || raw.includes('web3')) return 'web3_founder';
		if (raw.includes('media') || raw.includes('channel') || raw.includes('news')) return 'media_network';
		if (raw.includes('domain') || raw.includes('collector') || raw.includes('speculator')) return 'domain_speculator';
		if (raw.includes('miniapp') || raw.includes('bot')) return 'miniapp_operator';
		if (raw.includes('corporate') || raw.includes('brand') || raw.includes('fintech')) return 'corporate_fintech';
		if (raw.includes('vip') || raw.includes('personal')) return 'vip_creator';
		return 'domain_speculator';
	};

	const matchedPersona = () => ALL_PERSONAS.find((p) => p.id === matchedId()) || ALL_PERSONAS[0];

	return (
		<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col gap-4 shadow-xl text-start relative overflow-hidden">
			{/* Header */}
			<div class="flex items-center justify-between border-b border-white/5 pb-3">
				<div class="flex items-center gap-2.5">
					<div class="w-9 h-9 rounded-[14px] bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
						<span class="material-symbols-outlined text-[20px]">groups</span>
					</div>
					<div class="flex flex-col">
						<h4 class="text-[13px] font-black text-white font-mono uppercase tracking-wider">
							{isRtl() ? 'پرسونای خریدار هدف (Target Buyer Persona)' : 'TARGET BUYER PERSONAS'}
						</h4>
						<span class="text-[9px] font-mono text-white/40">
							{isRtl() ? 'تحلیل رفتارشناسی و ظرفیت نقدینگی خریداران' : 'Liquidity capability & buyer behavior'}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-md">
					8 ARCHETYPES
				</span>
			</div>

			{/* Primary Match Spotlight Banner */}
			<div class="w-full bg-gradient-to-r from-amber-500/15 via-[#08090D] to-[#08090D] border border-amber-500/30 rounded-[22px] p-4 flex flex-col gap-2 relative overflow-hidden">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
						<span class="text-[10px] font-mono font-black text-amber-300 uppercase tracking-wider">
							{isRtl() ? 'تشخیص انطباق لایا برای این شناسه:' : 'LAYA PRIMARY MATCH FOR THIS HANDLE:'}
						</span>
					</div>
					<span class="text-[10px] font-mono font-black text-white bg-white/10 border border-white/10 px-2 py-0.5 rounded-md">
						{matchedPersona().budgetRange}
					</span>
				</div>

				<div class="flex items-center gap-3 pt-1">
					<div
						class="w-10 h-10 rounded-[14px] flex items-center justify-center text-white shrink-0 shadow-md"
						style={{ 'background-color': `${matchedPersona().color}25`, border: `1px solid ${matchedPersona().color}60` }}
					>
						<span class="material-symbols-outlined text-[22px]" style={{ color: matchedPersona().color }}>
							{matchedPersona().icon}
						</span>
					</div>
					<div class="flex flex-col">
						<span class="text-[14px] font-black text-white font-mono">
							{isRtl() ? matchedPersona().titleFa : matchedPersona().titleEn}
						</span>
						<span class="text-[10px] text-white/50 font-mono">
							{isRtl() ? matchedPersona().typicalHoldFa : matchedPersona().typicalHoldEn}
						</span>
					</div>
				</div>

				<p class="text-[11px] text-white/80 leading-relaxed pt-1">
					{isRtl() ? matchedPersona().rationaleFa : matchedPersona().rationaleEn}
				</p>
			</div>

			{/* Expandable All 8 Personas Breakdown */}
			<div class="w-full flex flex-col gap-2 pt-1">
				<button
					type="button"
					onClick={() => {
						try {
							haptic.selection();
						} catch {}
						setExpanded(!expanded());
					}}
					class="w-full h-11 rounded-[16px] bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
				>
					<span>
						{expanded()
							? isRtl()
								? 'بستن لیست کامل پرسوناها'
								: 'Collapse Full Personas'
							: isRtl()
								? 'مشاهده تحلیل جامع ۸ پرسونای خریدار واقعی'
								: 'View All 8 Buyer Personas Matrix'}
					</span>
					<span class={`material-symbols-outlined text-[16px] transition-transform ${expanded() ? 'rotate-180' : ''}`}>
						expand_more
					</span>
				</button>

				<Show when={expanded()}>
					<div class="grid grid-cols-1 gap-2.5 pt-2">
						<For each={ALL_PERSONAS}>
							{(p) => {
								const isCurrent = () => p.id === matchedId();
								return (
									<div
										class={`p-3.5 rounded-[20px] border flex flex-col gap-2 transition-all text-start ${
											isCurrent()
												? 'bg-amber-500/10 border-amber-500/40 shadow-md'
												: 'bg-[#08090D] border-white/5'
										}`}
									>
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<span class="material-symbols-outlined text-[18px]" style={{ color: p.color }}>
													{p.icon}
												</span>
												<span class="text-[12px] font-black text-white font-mono">
													{isRtl() ? p.titleFa : p.titleEn}
												</span>
												<Show when={isCurrent()}>
													<span class="text-[8px] font-mono font-black uppercase text-amber-400 bg-amber-400/20 px-1.5 py-0.5 rounded">
														MATCH
													</span>
												</Show>
											</div>
											<span class="text-[10px] font-mono font-bold text-white/60 bg-white/5 px-2 py-0.5 rounded">
												{p.budgetRange}
											</span>
										</div>

										<p class="text-[10px] text-white/60 leading-relaxed">
											{isRtl() ? p.rationaleFa : p.rationaleEn}
										</p>

										<div class="flex items-center justify-between text-[9px] font-mono text-white/40 pt-1 border-t border-white/5">
											<span>{isRtl() ? 'الگوی نگهداری:' : 'Hold Pattern:'} {isRtl() ? p.typicalHoldFa : p.typicalHoldEn}</span>
											<span class="text-white/60">{isRtl() ? p.urgencyFa : p.urgencyEn}</span>
										</div>
									</div>
								);
							}}
						</For>
					</div>
				</Show>
			</div>
		</div>
	);
};
