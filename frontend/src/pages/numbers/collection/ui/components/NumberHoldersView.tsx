import { type Component, For } from 'solid-js';
import type { NumbersInstitutionalCollectionOverview } from '@/entities/numbers/model/types.js';

interface HoldersViewProps {
	overview?: NumbersInstitutionalCollectionOverview;
}

export const NumberHoldersView: Component<HoldersViewProps> = (props) => {
	const tiers = [
		{ label: 'تک شماره (۱ آیتم)', share: '68.4%', count: '14,650 دارنده', color: 'bg-emerald-500' },
		{ label: 'کلکسیونر خرد (۲ تا ۵)', share: '21.2%', count: '4,540 دارنده', color: 'bg-cyan-500' },
		{ label: 'سرمایه‌گذار متوسط (۶ تا ۲۴)', share: '6.8%', count: '1,450 دارنده', color: 'bg-[#0098EA]' },
		{ label: 'خزانه‌دار بزرگ (۲۵ تا ۵۰)', share: '2.4%', count: '510 دارنده', color: 'bg-indigo-500' },
		{ label: 'ابرنهنگ‌ها (+۵۰ شماره)', share: '1.2%', count: '270 دارنده', color: 'bg-amber-500' },
	];

	return (
		<div class="space-y-3">
			{/* Whale Concentration Banner */}
			<div class="bg-[#0b0f19] border border-white/[0.08] rounded-2xl p-4 shadow-lg">
				<div class="flex items-center justify-between gap-2 mb-2">
					<span class="text-xs font-black text-white flex items-center gap-1.5">
						<span class="material-symbols-outlined text-cyan-400 text-base">pie_chart</span>
						تمرکز مالکیت و نهنگ‌ها (Whale Concentration)
					</span>
					<span class="text-[10px] font-mono text-cyan-300 font-bold">
						{props.overview?.unique_holders?.toLocaleString() ?? '21,420'} کیف‌پول فعال
					</span>
				</div>

				<div class="grid grid-cols-2 gap-2 mt-3">
					<div class="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
						<span class="text-[10px] text-white/50 block">سهم ۱۰ نهنگ برتر</span>
						<span class="text-base font-black text-white font-mono block mt-0.5">
							{((props.overview?.top10_holder_share_pct || 0.184) * 100).toFixed(1)}%
						</span>
						<span class="text-[9px] text-emerald-400 block mt-0.5">
							توزیع سالم در مقایسه با بازار NFT
						</span>
					</div>

					<div class="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
						<span class="text-[10px] text-white/50 block">سهم ۵۰ نهنگ برتر</span>
						<span class="text-base font-black text-white font-mono block mt-0.5">
							{((props.overview?.top50_holder_share_pct || 0.321) * 100).toFixed(1)}%
						</span>
						<span class="text-[9px] text-cyan-400 block mt-0.5">
							حذف قراردادهای اسکرو و مارکت
						</span>
					</div>
				</div>
			</div>

			{/* Holder Distribution Tiers */}
			<div class="bg-[#0b0f19] border border-white/[0.08] rounded-2xl p-4 shadow-lg">
				<h4 class="text-xs font-bold text-white mb-3">طبقه‌بندی کیف‌پول‌ها بر مبنای تعداد دارایی</h4>
				<div class="space-y-2.5">
					<For each={tiers}>
						{(tier) => (
							<div class="space-y-1">
								<div class="flex items-center justify-between text-[11px] font-mono">
									<span class="text-white/70">{tier.label}</span>
									<div class="flex items-center gap-2">
										<span class="text-white font-bold">{tier.share}</span>
										<span class="text-white/40 text-[10px]">({tier.count})</span>
									</div>
								</div>
								<div class="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
									<div class={`h-full ${tier.color} rounded-full`} style={{ width: tier.share }} />
								</div>
							</div>
						)}
					</For>
				</div>
			</div>

			{/* Liquidity Diagnostics */}
			<div class="bg-[#0b0f19] border border-white/[0.08] rounded-2xl p-4 shadow-lg">
				<h4 class="text-xs font-bold text-white mb-2.5">سنجه‌های نقدشوندگی بازار</h4>
				<div class="grid grid-cols-2 gap-2 text-[10px] font-mono">
					<div class="bg-white/[0.02] p-2.5 rounded-xl">
						<span class="text-white/40 block">نسبت لیست‌شده به عرضه</span>
						<span class="text-xs font-black text-amber-400 block mt-0.5">
							{((props.overview?.listed_share_pct || 0.0023) * 100).toFixed(2)}%
						</span>
						<span class="text-white/30 text-[9px] block">کمتر از ۰.۵٪ = عرضه محکم</span>
					</div>

					<div class="bg-white/[0.02] p-2.5 rounded-xl">
						<span class="text-white/40 block">خریداران / فروشندگان ۷ روزه</span>
						<span class="text-xs font-black text-cyan-300 block mt-0.5">
							{props.overview?.unique_buyers_7d ?? 14} خریدار / {props.overview?.unique_sellers_7d ?? 16} فروشنده
						</span>
						<span class="text-white/30 text-[9px] block">تعادل در عمق خریداران</span>
					</div>
				</div>
			</div>
		</div>
	);
};
