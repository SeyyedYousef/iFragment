import { type Component, createSignal, For } from 'solid-js';
import { isRtl } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export interface SemanticCategory {
	id: string;
	titleFa: string;
	titleEn: string;
	icon: string;
	color: string;
	resonanceFa: string;
	resonanceEn: string;
	targetPersonaFa: string;
	targetPersonaEn: string;
	badge: string;
	handles: {
		name: string;
		estTon: string;
		speed: string;
		tag: string;
	}[];
}

const CATEGORIES: SemanticCategory[] = [
	{
		id: 'crypto_web3',
		titleFa: 'کریپتو و وب۳',
		titleEn: 'Crypto & Web3 Native',
		icon: 'currency_bitcoin',
		color: '#0098EA',
		badge: 'DEFI / TON NATIVE',
		resonanceFa: 'نقدینگی بالا، تقاضای ممتد از سمت فاندیشن‌ها و پروتکل‌های دیفای تون.',
		resonanceEn: 'High-velocity liquidity anchored in TON ecosystem protocols & cross-chain DAOs.',
		targetPersonaFa: 'نهنگ‌های اکوسیستم تون و بنیان‌گذاران استارتاپ وب۳',
		targetPersonaEn: 'TON Whales & Protocol Founders',
		handles: [
			{ name: 'crypto', estTon: '350,000', speed: 'فوری (Instant)', tag: 'Ultra Grail' },
			{ name: 'ton', estTon: '500,000', speed: 'فوری (Instant)', tag: 'Ecosystem Core' },
			{ name: 'defi', estTon: '95,000', speed: 'بسیار سریع', tag: 'Protocol' },
			{ name: 'wallet', estTon: '280,000', speed: 'فوری (Instant)', tag: 'Utility Tier 1' },
			{ name: 'dao', estTon: '68,000', speed: 'سریع', tag: 'Governance' },
			{ name: 'swap', estTon: '75,000', speed: 'بسیار سریع', tag: 'DEX Grail' },
			{ name: 'vault', estTon: '42,000', speed: 'فعال', tag: 'Treasury' },
			{ name: 'btc', estTon: '210,000', speed: 'فوری (Instant)', tag: '3-Letter Apex' },
		],
	},
	{
		id: 'fintech_commerce',
		titleFa: 'فین‌تک و تجارت بین‌الملل',
		titleEn: 'FinTech & Global Commerce',
		icon: 'account_balance',
		color: '#10b981',
		badge: 'ENTERPRISE ASSET',
		resonanceFa: 'تمایل تجاری سازمانی بسیار بالا جهت ساخت گیت‌وی‌های مالی و کارت‌های بانکی تلگرام.',
		resonanceEn: 'High commercial intent with enterprise-tier backing for Telegram payment gateways.',
		targetPersonaFa: 'موسسات مالی، نئوبانک‌ها و درگاه‌های پرداخت',
		targetPersonaEn: 'FinTech Conglomerates & Payment Gateways',
		handles: [
			{ name: 'bank', estTon: '450,000', speed: 'فوری (Instant)', tag: 'Banking Grail' },
			{ name: 'pay', estTon: '380,000', speed: 'فوری (Instant)', tag: 'Payments' },
			{ name: 'cash', estTon: '120,000', speed: 'بسیار سریع', tag: 'Currency' },
			{ name: 'fund', estTon: '85,000', speed: 'سریع', tag: 'Capital' },
			{ name: 'card', estTon: '92,000', speed: 'بسیار سریع', tag: 'Cards / Pay' },
			{ name: 'loan', estTon: '48,000', speed: 'فعال', tag: 'Lending' },
			{ name: 'trade', estTon: '110,000', speed: 'سریع', tag: 'Trading Desk' },
			{ name: 'market', estTon: '160,000', speed: 'بسیار سریع', tag: 'Marketplace' },
		],
	},
	{
		id: 'luxury_status',
		titleFa: 'لاکچری و پرستیژ اشرافی',
		titleEn: 'Luxury & VIP Monikers',
		icon: 'diamond',
		color: '#f59e0b',
		badge: 'STATUS SYMBOL',
		resonanceFa: 'سیگنال‌دهی اعتبار و ثروت، ماندگاری ذهنی در پروفایل‌های VIP و کلاب‌های اختصاصی.',
		resonanceEn: 'Peak social capital flex and status signaling for HNWIs and luxury collectors.',
		targetPersonaFa: 'سرمایه‌گذاران رده‌بالا (HNWI) و برندهای شخصی لوکس',
		targetPersonaEn: 'High-Net-Worth Individuals & Prestige Brands',
		handles: [
			{ name: 'vip', estTon: '190,000', speed: 'فوری (Instant)', tag: 'Prestige Grail' },
			{ name: 'rich', estTon: '98,000', speed: 'سریع', tag: 'Status' },
			{ name: 'king', estTon: '140,000', speed: 'بسیار سریع', tag: 'Royalty' },
			{ name: 'gold', estTon: '175,000', speed: 'فوری (Instant)', tag: 'Hard Asset' },
			{ name: 'club', estTon: '115,000', speed: 'سریع', tag: 'Exclusive' },
			{ name: 'boss', estTon: '88,000', speed: 'فعال', tag: 'Alpha Moniker' },
			{ name: 'elite', estTon: '72,000', speed: 'فعال', tag: 'Tier 1 Status' },
			{ name: 'prime', estTon: '105,000', speed: 'بسیار سریع', tag: 'Supreme' },
		],
	},
	{
		id: 'pure_lexicon',
		titleFa: 'کلمات اصیل فرهنگ لغت',
		titleEn: 'Pure English Lexicon',
		icon: 'spellcheck',
		color: '#06b6d4',
		badge: 'DICTIONARY GRAIL',
		resonanceFa: 'واژه‌های اصیل تک‌سیلابی بدون تغییر با روانی تلفظ ۱۰ از ۱۰ و ماندگاری ابدی.',
		resonanceEn: 'Unmodified English dictionary nouns and verbs with 10/10 phonetic clarity.',
		targetPersonaFa: 'کلکسیونرهای حرفه‌ای دامین و نام‌های تجاری یکتا',
		targetPersonaEn: 'Domain Speculators & Brand Architects',
		handles: [
			{ name: 'rare', estTon: '185,000', speed: 'بسیار سریع', tag: 'Dictionary' },
			{ name: 'dark', estTon: '95,000', speed: 'سریع', tag: 'Dictionary' },
			{ name: 'fast', estTon: '110,000', speed: 'سریع', tag: 'Dictionary' },
			{ name: 'blue', estTon: '85,000', speed: 'فعال', tag: 'Color Word' },
			{ name: 'time', estTon: '220,000', speed: 'فوری (Instant)', tag: 'Universal' },
			{ name: 'game', estTon: '310,000', speed: 'فوری (Instant)', tag: 'Gaming Hub' },
			{ name: 'cool', estTon: '78,000', speed: 'فعال', tag: 'Dictionary' },
			{ name: 'fire', estTon: '135,000', speed: 'بسیار سریع', tag: 'Viral Word' },
		],
	},
	{
		id: 'ai_tech',
		titleFa: 'هوش مصنوعی و سیستم‌ها',
		titleEn: 'Artificial Intelligence & Systems',
		icon: 'smart_toy',
		color: '#8b5cf6',
		badge: 'EMERGING TECH',
		resonanceFa: 'روند صعودی و تقاضای سنگین سال‌های ۲۰۲۵ تا ۲۰۲۶ برای عوامل هوش مصنوعی و ربات‌های خودکار تلگرام.',
		resonanceEn: 'High trending momentum for autonomous AI agents, copilot bots, and compute networks.',
		targetPersonaFa: 'توسعه‌دهندگان مینی‌اپ‌ها، بات‌های هوشمند و استارتاپ‌های هوش مصنوعی',
		targetPersonaEn: 'AI Founders & MiniApp Autonomous Developers',
		handles: [
			{ name: 'ai', estTon: '650,000', speed: 'فوری (Instant)', tag: '2-Letter Tech' },
			{ name: 'bot', estTon: '290,000', speed: 'فوری (Instant)', tag: 'Telegram Native' },
			{ name: 'gpt', estTon: '160,000', speed: 'بسیار سریع', tag: 'LLM Brand' },
			{ name: 'neural', estTon: '55,000', speed: 'فعال', tag: 'Deep Learning' },
			{ name: 'agent', estTon: '125,000', speed: 'بسیار سریع', tag: 'AI Agent' },
			{ name: 'cyber', estTon: '82,000', speed: 'سریع', tag: 'Security' },
			{ name: 'cloud', estTon: '140,000', speed: 'سریع', tag: 'Infra' },
			{ name: 'data', estTon: '190,000', speed: 'بسیار سریع', tag: 'Data Core' },
		],
	},
	{
		id: 'media_channels',
		titleFa: 'رسانه، خبر و کانال‌ها',
		titleEn: 'Media & Viral Broadcast',
		icon: 'campaign',
		color: '#ec4899',
		badge: 'BROADCAST POWER',
		resonanceFa: 'اقتدار سازمانی برای شبکه‌های توزیع خبر، کانال‌های سیگنال کریپتو و رسانه‌های جریان‌ساز.',
		resonanceEn: 'Broadcast authority for telegram news networks, content aggregators, and viral channels.',
		targetPersonaFa: 'شبکه‌های رسانه‌ای، کانال‌های پرمخاطب تلگرام و خبرگزاری‌ها',
		targetPersonaEn: 'Media Conglomerates & Telegram Channel Networks',
		handles: [
			{ name: 'news', estTon: '994,000', speed: 'رکورد تاریخی', tag: 'All-Time Record' },
			{ name: 'media', estTon: '180,000', speed: 'بسیار سریع', tag: 'Broadcasting' },
			{ name: 'tv', estTon: '420,000', speed: 'فوری (Instant)', tag: '2-Letter Global' },
			{ name: 'chat', estTon: '260,000', speed: 'فوری (Instant)', tag: 'Messaging' },
			{ name: 'press', estTon: '95,000', speed: 'سریع', tag: 'Publishing' },
			{ name: 'daily', estTon: '78,000', speed: 'فعال', tag: 'Journal' },
			{ name: 'hub', estTon: '130,000', speed: 'بسیار سریع', tag: 'Community' },
			{ name: 'cast', estTon: '62,000', speed: 'فعال', tag: 'Podcast' },
		],
	},
	{
		id: 'liquid_grails',
		titleFa: '۴ حرفی‌های هندسی و نقدشونده',
		titleEn: '4-Letter Geometric Grails',
		icon: 'grid_view',
		color: '#eab308',
		badge: 'ULTRA-LIQUID',
		resonanceFa: 'کف تاریخی قطعی در بازار فرگمنت، ارگونومی تایپ برق‌آسا و محبوبیت بین‌المللی فارغ از زبان.',
		resonanceEn: 'Universal floor price support, maximum typing fluidity, and global language neutrality.',
		targetPersonaFa: 'کلکسیونرهای حرفه‌ای و معامله‌گران نوسان‌گیر (Flippers)',
		targetPersonaEn: 'Grail Flippers & Quantitative Collectors',
		handles: [
			{ name: 'apex', estTon: '115,000', speed: 'فوری (Instant)', tag: 'Peak 4-Letter' },
			{ name: 'flow', estTon: '88,000', speed: 'بسیار سریع', tag: 'Fluidity' },
			{ name: 'meta', estTon: '240,000', speed: 'فوری (Instant)', tag: 'Global Tech' },
			{ name: 'warp', estTon: '65,000', speed: 'سریع', tag: 'Web3 / Speed' },
			{ name: 'byte', estTon: '105,000', speed: 'بسیار سریع', tag: 'Computing' },
			{ name: 'wave', estTon: '78,000', speed: 'سریع', tag: 'Geometric' },
			{ name: 'drop', estTon: '92,000', speed: 'بسیار سریع', tag: 'Airdrop / Hype' },
			{ name: 'echo', estTon: '70,000', speed: 'فعال', tag: 'Phonetic 10/10' },
		],
	},
];

interface Props {
	onSelectHandle: (handle: string) => void;
}

export const LayaCategoriesExplorer: Component<Props> = (props) => {
	const [activeCategory, setActiveCategory] = createSignal<string>('crypto_web3');

	const currentCat = () => CATEGORIES.find((c) => c.id === activeCategory()) || CATEGORIES[0];

	const handleCategoryClick = (id: string) => {
		try {
			haptic.selection();
		} catch {}
		setActiveCategory(id);
	};

	return (
		<div class="w-full flex flex-col gap-3.5 text-start">
			{/* Header */}
			<div class="flex items-center justify-between px-1">
				<div class="flex items-center gap-2">
					<div class="w-7 h-7 rounded-lg bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center text-[#0098EA]">
						<span class="material-symbols-outlined text-[17px]">psychology</span>
					</div>
					<div class="flex flex-col">
						<span class="text-[12px] font-mono font-black text-white uppercase tracking-wider">
							{isRtl() ? 'دسته‌بندی‌های شناختی لایا (LAYA Cognitive)' : 'LAYA COGNITIVE CATEGORIES'}
						</span>
						<span class="text-[9px] font-mono text-white/40">
							{isRtl() ? 'تحلیل معنایی، تمایل تجاری و سرعت نقدشوندگی' : 'Semantic analysis & buyer intent'}
						</span>
					</div>
				</div>
				<span class="text-[9px] font-mono font-black text-[#0098EA] bg-[#0098EA]/10 border border-[#0098EA]/30 px-2 py-0.5 rounded-md">
					SYSTEM 1
				</span>
			</div>

			{/* Horizontal Scrolling Pill Tabs */}
			<div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
				<For each={CATEGORIES}>
					{(cat) => {
						const isSelected = () => cat.id === activeCategory();
						return (
							<button
								type="button"
								onClick={() => handleCategoryClick(cat.id)}
								class={`px-3 py-1.5 rounded-[14px] text-[11px] font-mono font-bold whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 active:scale-95 border ${
									isSelected()
										? 'bg-[#0098EA]/20 border-[#0098EA]/60 text-white shadow-[0_0_15px_rgba(0,152,234,0.3)]'
										: 'bg-[#12141C]/80 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5'
								}`}
							>
								<span
									class="material-symbols-outlined text-[15px]"
									style={{ color: isSelected() ? cat.color : undefined }}
								>
									{cat.icon}
								</span>
								<span>{isRtl() ? cat.titleFa : cat.titleEn}</span>
							</button>
						);
					}}
				</For>
			</div>

			{/* Active Category Detail Card */}
			<div class="w-full bg-[#12141C]/90 backdrop-blur-2xl border border-white/10 rounded-[24px] p-4 flex flex-col gap-3 shadow-xl relative overflow-hidden">
				<div
					class="absolute -right-12 -top-12 w-32 h-32 blur-3xl rounded-full pointer-events-none opacity-20"
					style={{ background: currentCat().color }}
				/>

				{/* Category Overview */}
				<div class="flex items-start justify-between gap-2 border-b border-white/5 pb-2.5">
					<div class="flex flex-col">
						<div class="flex items-center gap-2">
							<span class="text-[13px] font-black text-white font-mono">
								{isRtl() ? currentCat().titleFa : currentCat().titleEn}
							</span>
							<span
								class="text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded-[6px] border"
								style={{
									'background-color': `${currentCat().color}15`,
									'border-color': `${currentCat().color}40`,
									color: currentCat().color,
								}}
							>
								{currentCat().badge}
							</span>
						</div>
						<p class="text-[10px] text-white/60 mt-1 leading-relaxed">
							{isRtl() ? currentCat().resonanceFa : currentCat().resonanceEn}
						</p>
					</div>
				</div>

				{/* Persona Fit Pill */}
				<div class="flex items-center justify-between text-[10px] font-mono bg-[#08090D] border border-white/5 rounded-[12px] px-3 py-2">
					<span class="text-white/40">
						{isRtl() ? 'پرسونای اصلی خریدار:' : 'Target Buyer Persona:'}
					</span>
					<span class="text-amber-400 font-bold truncate max-w-[60%]">
						{isRtl() ? currentCat().targetPersonaFa : currentCat().targetPersonaEn}
					</span>
				</div>

				{/* Handles Grid */}
				<div class="grid grid-cols-2 gap-2 pt-1">
					<For each={currentCat().handles}>
						{(item) => (
							<button
								type="button"
								onClick={() => {
									try {
										haptic.impact('light');
									} catch {}
									props.onSelectHandle(item.name);
								}}
								class="p-2.5 rounded-[16px] bg-[#08090D] hover:bg-[#0098EA]/10 border border-white/5 hover:border-[#0098EA]/40 text-start flex flex-col gap-1 transition-all active:scale-[0.97] group cursor-pointer"
							>
								<div class="flex items-center justify-between w-full">
									<span class="text-white font-mono font-black text-[13px] group-hover:text-[#0098EA] transition-colors" dir="ltr">
										@{item.name}
									</span>
									<span class="text-[8px] font-mono text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
										{item.tag}
									</span>
								</div>
								<div class="flex items-center justify-between w-full text-[10px] font-mono">
									<span class="text-emerald-400 font-bold">~{item.estTon} TON</span>
									<span class="text-white/30 text-[9px] group-hover:text-[#0098EA] transition-colors">
										{isRtl() ? 'ارزیابی ↗' : 'Valuate ↗'}
									</span>
								</div>
							</button>
						)}
					</For>
				</div>
			</div>
		</div>
	);
};
