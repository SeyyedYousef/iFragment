import { type Component, createSignal, Show } from 'solid-js';
import type { NumbersInstitutionalCollectionOverview } from '@/entities/numbers/model/types.js';
import { haptic } from '@/shared/lib/haptic.js';

interface HeaderProps {
	overview?: NumbersInstitutionalCollectionOverview;
	onOpenExport: () => void;
	onOpenMethodology: () => void;
	onOpenAlerts: () => void;
	onBack: () => void;
	onNavigateMask: () => void;
}

export const NumberCollectionHeader: Component<HeaderProps> = (props) => {
	const [copied, setCopied] = createSignal(false);

	const copyContract = () => {
		const addr = props.overview?.collection_address || 'EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N';
		try {
			navigator.clipboard.writeText(addr);
			setCopied(true);
			haptic.notify('success');
			setTimeout(() => setCopied(false), 2200);
		} catch {}
	};

	const formatTimeAgo = (isoStr?: string) => {
		if (!isoStr) return 'هم‌اکنون';
		const diffMs = Date.now() - new Date(isoStr).getTime();
		const diffMin = Math.floor(diffMs / 60000);
		if (diffMin <= 1) return 'هم‌اکنون';
		if (diffMin < 60) return `${diffMin} دقیقه قبل`;
		const diffHr = Math.floor(diffMin / 60);
		if (diffHr < 24) return `${diffHr} ساعت قبل`;
		return `${Math.floor(diffHr / 24)} روز قبل`;
	};

	return (
		<div class="mb-4">
			{/* Top Bar with Navigation & Quick Actions */}
			<div class="flex items-center justify-between gap-2 mb-3">
				<button
					type="button"
					onClick={props.onBack}
					class="w-10 h-10 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95 shrink-0"
					aria-label="بازگشت"
				>
					<span class="material-symbols-outlined text-xl rtl:rotate-180">arrow_back</span>
				</button>

				<div class="flex-1 min-w-0 px-2 text-start">
					<div class="flex items-center gap-1.5 flex-wrap">
						<h1 class="text-sm font-black text-white truncate font-sans">
							شماره‌های کلکسیونی تلگرام
						</h1>
						<span class="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-[#0098EA]/20 text-[#0098EA] border border-[#0098EA]/30">
							+888
						</span>
					</div>
					<p class="text-[10px] text-white/50 truncate font-mono mt-0.5">
						Telemint NFT · Secondary Market
					</p>
				</div>

				<div class="flex items-center gap-1.5 shrink-0">
					{/* Alerts Modal Trigger */}
					<button
						type="button"
						onClick={props.onOpenAlerts}
						class="w-9 h-9 rounded-2xl bg-white/[0.04] hover:bg-amber-500/10 border border-white/[0.08] hover:border-amber-500/30 flex items-center justify-center text-white/70 hover:text-amber-400 transition-all active:scale-95"
						title="تنظیم هشدارهای قیمت و الگو"
					>
						<span class="material-symbols-outlined text-lg">notifications_active</span>
					</button>

					{/* Export Snapshot */}
					<button
						type="button"
						onClick={props.onOpenExport}
						class="w-9 h-9 rounded-2xl bg-white/[0.04] hover:bg-emerald-500/10 border border-white/[0.08] hover:border-emerald-500/30 flex items-center justify-center text-white/70 hover:text-emerald-400 transition-all active:scale-95"
						title="دانلود خروجی CSV / JSON"
					>
						<span class="material-symbols-outlined text-lg">ios_share</span>
					</button>

					{/* Methodology Drawer Trigger */}
					<button
						type="button"
						onClick={props.onOpenMethodology}
						class="w-9 h-9 rounded-2xl bg-white/[0.04] hover:bg-[#0098EA]/10 border border-white/[0.08] hover:border-[#0098EA]/30 flex items-center justify-center text-white/70 hover:text-[#0098EA] transition-all active:scale-95"
						title="متدولوژی و منابع داده"
					>
						<span class="material-symbols-outlined text-lg">verified_user</span>
					</button>
				</div>
			</div>

			{/* Official Collection Card with Smart Contract Copy */}
			<div class="bg-gradient-to-br from-[#0c121e] via-[#090b11] to-[#050608] border border-white/[0.08] rounded-3xl p-4 shadow-xl relative overflow-hidden">
				<div class="flex items-start justify-between gap-3">
					<div class="space-y-1 min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<span class="text-base font-black text-white font-mono tracking-tight">
								Telegram Anonymous Numbers
							</span>
							<span class="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold flex items-center gap-1">
								<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
								تأییدشده تلمینت
							</span>
						</div>

						{/* Contract Address with Copy */}
						<div class="flex items-center gap-2 pt-0.5">
							<span class="text-[10px] text-white/40 font-mono">قرارداد:</span>
							<button
								type="button"
								onClick={copyContract}
								class="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] font-mono text-[#0098EA] hover:text-white transition-all active:scale-95"
							>
								<span class="truncate max-w-[130px] sm:max-w-[180px]">
									{props.overview?.collection_address
										? `${props.overview.collection_address.slice(0, 4)}...${props.overview.collection_address.slice(-4)}`
										: 'EQAO...si5N'}
								</span>
								<span class="material-symbols-outlined text-xs">
									{copied() ? 'done' : 'content_copy'}
								</span>
								<Show when={copied()}>
									<span class="text-emerald-400 text-[9px] font-bold">کپی شد</span>
								</Show>
							</button>
						</div>
					</div>

					{/* Supply Badge */}
					<div class="text-end shrink-0">
						<span class="text-[10px] text-white/40 block">عرضه کل (منجمد)</span>
						<span class="text-xs font-black text-white font-mono block mt-0.5">
							136,566 <span class="text-[10px] text-white/50">آیتم</span>
						</span>
						<span class="text-[9px] text-cyan-400/80 font-mono block mt-0.5">
							1,000 جنسیس ۴رقمی
						</span>
					</div>
				</div>

				{/* Provenance & Freshness Status Bar */}
				<div class="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-white/50 flex-wrap gap-2">
					<div class="flex items-center gap-2">
						<span
							class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[9px] ${
								props.overview?.is_live
									? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
									: 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
							}`}
						>
							<span
								class={`w-1.5 h-1.5 rounded-full ${
									props.overview?.is_live ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
								}`}
							/>
							{props.overview?.is_live ? 'داده زنده آن‌چین' : 'آخرین اسنپ‌شات معتبر'}
						</span>

						<span class="font-mono text-[9px]">
							{formatTimeAgo(props.overview?.observed_at)}
						</span>
					</div>

					<div class="flex items-center gap-1.5 font-mono text-[9px] text-white/40">
						<span>منابع: Fragment + TON</span>
						<Show when={props.overview?.snapshot_id}>
							<span>· ID: {props.overview!.snapshot_id.slice(-6)}</span>
						</Show>
					</div>
				</div>
			</div>
		</div>
	);
};
