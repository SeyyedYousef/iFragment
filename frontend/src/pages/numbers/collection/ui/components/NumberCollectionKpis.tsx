import { type Component, Show } from 'solid-js';
import type { NumbersInstitutionalCollectionOverview } from '@/entities/numbers/model/types.js';

interface KpisProps {
	overview?: NumbersInstitutionalCollectionOverview;
}

export const NumberCollectionKpis: Component<KpisProps> = (props) => {
	const fmt = (val?: number | null, decimals = 0) => {
		if (val === undefined || val === null || isNaN(val) || val <= 0) return '—';
		return val.toLocaleString('en-US', { maximumFractionDigits: decimals });
	};

	const fmtUsd = (val?: number | null) => {
		if (val === undefined || val === null || isNaN(val) || val <= 0) return '—';
		if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
		if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
		return `$${val.toFixed(0)}`;
	};

	const fmtPct = (val?: number | null) => {
		if (val === undefined || val === null || isNaN(val)) return '—';
		return `${(val * 100).toFixed(2)}%`;
	};

	const floorNumber = () => props.overview?.floor_number;
	const floorVenue = () => props.overview?.floor_venue || 'fragment';
	const floorLink = () => {
		const num = floorNumber();
		if (!num) return 'https://fragment.com/numbers';
		const clean = num.replace(/\D/g, '');
		return floorVenue() === 'getgems'
			? `https://getgems.io/collection/EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N`
			: `https://fragment.com/number/${clean}`;
	};

	return (
		<div class="space-y-2.5 mb-4">
			{/* Top Hero Cards: Floor Ask + Realized Median */}
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
				{/* Floor Ask Card */}
				<div class="bg-gradient-to-br from-[#101726] to-[#0a0d14] border border-[#0098EA]/30 rounded-2xl p-3.5 shadow-lg relative overflow-hidden group">
					<div class="flex items-start justify-between">
						<div>
							<div class="flex items-center gap-1.5">
								<span class="text-[11px] font-bold text-white/50 block">کف قیمت بازار (Floor Ask)</span>
								<span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-[#0098EA]/20 text-[#0098EA] uppercase">
									{floorVenue()}
								</span>
							</div>
							<div class="flex items-baseline gap-2 mt-1">
								<span class="text-xl font-black text-white font-mono">
									{fmt(props.overview?.floor_ask_ton)}
								</span>
								<span class="text-xs font-bold text-[#0098EA]">TON</span>
								<span class="text-[11px] font-mono text-white/40">
									({fmtUsd(props.overview?.floor_ask_usd)})
								</span>
							</div>
						</div>

						<Show when={floorNumber()}>
							<a
								href={floorLink()}
								target="_blank"
								rel="noopener noreferrer"
								class="px-2.5 py-1.5 rounded-xl bg-[#0098EA]/15 hover:bg-[#0098EA]/25 border border-[#0098EA]/30 text-[#0098EA] text-[10px] font-mono font-bold flex items-center gap-1 transition-all active:scale-95"
							>
								<span>{floorNumber()}</span>
								<span class="material-symbols-outlined text-xs">open_in_new</span>
							</a>
						</Show>
					</div>

					<p class="text-[9px] text-white/40 mt-2 font-mono">
						کمترین لیستینگ فعال و معتبر در مارکت‌پلیس‌های رسمی
					</p>
				</div>

				{/* Realized Median Sale Card */}
				<div class="bg-gradient-to-br from-[#111a1a] to-[#090e0e] border border-emerald-500/30 rounded-2xl p-3.5 shadow-lg relative overflow-hidden">
					<div class="flex items-start justify-between">
						<div>
							<span class="text-[11px] font-bold text-white/50 block">میانه فروش واقعی ۷ روزه (Median Sale)</span>
							<div class="flex items-baseline gap-2 mt-1">
								<span class="text-xl font-black text-emerald-400 font-mono">
									{fmt(props.overview?.median_sale_7d_ton)}
								</span>
								<span class="text-xs font-bold text-emerald-400/70">TON</span>
								<Show when={props.overview?.sales_count_7d}>
									<span class="text-[10px] font-mono text-white/40">
										(بر مبنای {props.overview!.sales_count_7d} فروش تاییدشده)
									</span>
								</Show>
							</div>
						</div>

						<span class="px-2 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold">
							۷D Realized
						</span>
					</div>

					<p class="text-[9px] text-white/40 mt-2 font-mono">
						قیمت متوازن تسویه‌شده آن‌چین بدون نویز واش‌ترید
					</p>
				</div>
			</div>

			{/* Floor Depth Micro-Bar: Vital Market Indicator */}
			<div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3">
				<div class="flex items-center justify-between mb-2">
					<span class="text-[10px] font-bold text-white/60 flex items-center gap-1">
						<span class="material-symbols-outlined text-xs text-[#0098EA]">stacked_bar_chart</span>
						عمق نقدشوندگی کف (Floor Depth)
					</span>
					<span class="text-[9px] text-white/40 font-mono">فاصله از کمترین قیمت</span>
				</div>

				<div class="grid grid-cols-3 gap-2">
					<div class="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2 text-center">
						<span class="text-[9px] font-mono text-cyan-400/80 block">تا ۵٪ بالاتر</span>
						<span class="text-xs font-mono font-black text-white block mt-0.5">
							{props.overview?.floor_depth?.plus_5pct_count ?? '—'}{' '}
							<span class="text-[9px] text-white/40">شماره</span>
						</span>
					</div>

					<div class="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2 text-center">
						<span class="text-[9px] font-mono text-[#0098EA]/80 block">تا ۱۰٪ بالاتر</span>
						<span class="text-xs font-mono font-black text-white block mt-0.5">
							{props.overview?.floor_depth?.plus_10pct_count ?? '—'}{' '}
							<span class="text-[9px] text-white/40">شماره</span>
						</span>
					</div>

					<div class="bg-white/[0.02] border border-white/[0.04] rounded-xl p-2 text-center">
						<span class="text-[9px] font-mono text-indigo-400/80 block">تا ۲۵٪ بالاتر</span>
						<span class="text-xs font-mono font-black text-white block mt-0.5">
							{props.overview?.floor_depth?.plus_25pct_count ?? '—'}{' '}
							<span class="text-[9px] text-white/40">شماره</span>
						</span>
					</div>
				</div>
			</div>

			{/* Core Market KPIs 4-Column Grid */}
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
				{/* 24h Realized Volume */}
				<div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3">
					<span class="text-[10px] font-bold text-white/40 block">حجم واقعی ۲۴ساعته</span>
					<span class="text-sm font-black text-white font-mono block mt-0.5">
						{fmt(props.overview?.volume_24h_ton)}{' '}
						<span class="text-[10px] text-[#0098EA]">TON</span>
					</span>
					<span class="text-[9px] text-white/40 font-mono block mt-1">
						{props.overview?.sales_count_24h ?? 0} معامله نهایی
					</span>
				</div>

				{/* 7d Volume */}
				<div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3">
					<span class="text-[10px] font-bold text-white/40 block">حجم واقعی ۷ روزه</span>
					<span class="text-sm font-black text-emerald-400 font-mono block mt-0.5">
						{fmt(props.overview?.volume_7d_ton)}{' '}
						<span class="text-[10px] text-emerald-400/70">TON</span>
					</span>
					<span class="text-[9px] text-white/40 font-mono block mt-1">
						{props.overview?.sales_count_7d ?? 0} معامله نهایی
					</span>
				</div>

				{/* Active Listings & Listed % */}
				<div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3">
					<span class="text-[10px] font-bold text-white/40 block">آیتم‌های برای فروش</span>
					<span class="text-sm font-black text-amber-400 font-mono block mt-0.5">
						{fmt(props.overview?.active_listings_count)}{' '}
						<span class="text-[10px] text-white/40">شماره</span>
					</span>
					<span class="text-[9px] text-amber-400/70 font-mono block mt-1">
						{fmtPct(props.overview?.listed_share_pct)} از کل عرضه
					</span>
				</div>

				{/* Unique Holders & Whale Concentration */}
				<div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3">
					<span class="text-[10px] font-bold text-white/40 block">مالکان یکتا (Holders)</span>
					<span class="text-sm font-black text-cyan-300 font-mono block mt-0.5">
						{fmt(props.overview?.unique_holders)}{' '}
						<span class="text-[10px] text-white/40">کیف‌پول</span>
					</span>
					<span class="text-[9px] text-cyan-400/70 font-mono block mt-1">
						۱۰ نهنگ: {fmtPct(props.overview?.top10_holder_share_pct)}
					</span>
				</div>
			</div>
		</div>
	);
};
