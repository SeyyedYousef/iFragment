import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { giftsApi, type WhaleProfile } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { copyToClipboard } from '@/shared/lib/telegram-native.js';

export const GiftsWhalesTracker: Component = () => {
	const [copiedWallet, setCopiedWallet] = createSignal<string | null>(null);
	const [selectedCategory, setSelectedCategory] = createSignal<string>('all');

	const whalesQuery = createQuery(() => ({
		queryKey: ['giftsWhalesLeaderboard'],
		queryFn: () => giftsApi.getWhaleLeaderboard(),
		staleTime: 60 * 1000,
	}));

	const whalesList = () => whalesQuery.data || [];

	const filteredWhales = () => {
		const list = whalesList();
		const cat = selectedCategory();
		if (cat === 'all') return list;
		return list.filter((w) => (w.classification || '').toLowerCase() === cat.toLowerCase());
	};

	const formatTon = (val?: number) => {
		if (val === undefined || val === null) return '0';
		return val.toLocaleString('en-US', { maximumFractionDigits: 0 });
	};

	const formatUsd = (val?: number) => {
		if (val === undefined || val === null) return '$0';
		return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
	};

	const shortenAddress = (addr?: string) => {
		if (!addr) return 'Unknown';
		if (addr.length <= 12) return addr;
		return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
	};

	const handleCopy = async (addr: string) => {
		try {
			haptic.selection();
			await copyToClipboard(addr);
			setCopiedWallet(addr);
			setTimeout(() => setCopiedWallet(null), 2000);
		} catch {}
	};

	const getBadgeStyle = (classification?: string) => {
		const c = (classification || '').toLowerCase();
		if (c === 'accumulator') {
			return {
				bg: 'bg-emerald-500/10',
				border: 'border-emerald-500/30',
				text: 'text-emerald-400',
				label: 'Accumulator (انباشت‌کننده)',
			};
		}
		if (c === 'institution') {
			return {
				bg: 'bg-amber-500/10',
				border: 'border-amber-500/30',
				text: 'text-amber-300',
				label: 'Institution (صندوق/نهاد)',
			};
		}
		if (c === 'flipper') {
			return {
				bg: 'bg-[#0098EA]/10',
				border: 'border-[#0098EA]/30',
				text: 'text-[#0098EA]',
				label: 'Flipper (نوسان‌گیر)',
			};
		}
		return {
			bg: 'bg-teal-500/10',
			border: 'border-teal-500/30',
			text: 'text-teal-300',
			label: 'Market Maker (بازارساز)',
		};
	};

	return (
		<div class="space-y-3.5">
			{/* Header Banner */}
			<div class="bg-[#0b0e17]/95 border border-white/[0.08] rounded-[24px] p-4 backdrop-blur-2xl shadow-xl space-y-2">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="w-2.5 h-2.5 rounded-full bg-[#0098EA] shadow-[0_0_10px_#0098EA]" />
						<h3 class="text-xs font-black uppercase tracking-wider text-white">
							{t('gifts.whalesHeader') || 'Whale & Smart Money Intelligence'}
						</h3>
					</div>
					<span class="text-[9px] uppercase font-mono text-[#0098EA] bg-[#0098EA]/10 border border-[#0098EA]/20 px-2 py-0.5 rounded-full font-bold">
						On-Chain TEP-62
					</span>
				</div>
				<p class="text-[11px] text-white/50 font-medium leading-relaxed">
					رصد کیف‌پول‌های نهنگ بازار گیفت تلگرام، دسته‌بندی استراتژی سرمایه‌گذاران دانه درشت و ارزیابی
					پورتفوی آن‌چین در شبکه TON.
				</p>

				{/* Filter Chips */}
				<div class="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
					{[
						{ id: 'all', label: 'همه نهنگ‌ها' },
						{ id: 'accumulator', label: 'انباشت‌کننده (Accumulator)' },
						{ id: 'flipper', label: 'نوسان‌گیر (Flipper)' },
						{ id: 'institution', label: 'صندوق سرمایه‌گذاری' },
						{ id: 'market maker', label: 'بازارساز' },
					].map((f) => (
						<button
							type="button"
							onClick={() => {
								try {
									haptic.selection();
								} catch {}
								setSelectedCategory(f.id);
							}}
							class={`px-2.5 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${
								selectedCategory() === f.id
									? 'bg-[#0098EA] text-white shadow-md shadow-[#0098EA]/25'
									: 'bg-white/[0.03] text-white/50 hover:text-white border border-white/[0.05]'
							}`}
						>
							{f.label}
						</button>
					))}
				</div>
			</div>

			{/* Loading State */}
			<Show when={whalesQuery.isLoading}>
				<div class="p-8 text-center bg-[#0b0e17]/80 rounded-2xl border border-white/[0.06] space-y-2">
					<div class="w-7 h-7 border-2 border-[#0098EA] border-t-transparent rounded-full animate-spin mx-auto" />
					<p class="text-xs text-white/40 font-mono">در حال واکشی داده‌های آن‌چین نهنگ‌ها...</p>
				</div>
			</Show>

			{/* Empty State */}
			<Show when={!whalesQuery.isLoading && filteredWhales().length === 0}>
				<div class="p-8 text-center bg-[#0b0e17]/80 rounded-2xl border border-white/[0.06] space-y-1.5">
					<span class="material-symbols-outlined text-3xl text-white/20">shield_person</span>
					<p class="text-xs text-white/40 font-medium">کیف‌پولی در این دسته‌بندی یافت نشد.</p>
				</div>
			</Show>

			{/* Whales Cards Grid */}
			<div class="space-y-2.5">
				<For each={filteredWhales()}>
					{(whale: WhaleProfile) => {
						const badge = getBadgeStyle(whale.classification);
						const isCopied = () => copiedWallet() === whale.owner_address;

						return (
							<div class="bg-[#0b0e17]/90 hover:bg-[#0b0e17] border border-white/[0.07] hover:border-[#0098EA]/30 rounded-2xl p-3.5 backdrop-blur-xl shadow-lg transition-all space-y-2.5">
								{/* Top Row: Rank + Identity + Classification */}
								<div class="flex items-start justify-between">
									<div class="flex items-center gap-2.5">
										{/* Rank Badge */}
										<div
											class={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs font-mono border ${
												whale.rank === 1
													? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
													: whale.rank === 2
														? 'bg-slate-300/20 border-slate-300/40 text-slate-200'
														: whale.rank === 3
															? 'bg-amber-700/20 border-amber-600/40 text-amber-400'
															: 'bg-white/[0.04] border-white/10 text-white/60'
											}`}
										>
											{whale.rank === 1 ? '👑' : `#${whale.rank}`}
										</div>

										<div>
											<div class="flex items-center gap-1.5">
												<h4 class="text-xs font-bold text-white font-mono">
													{whale.display_name || shortenAddress(whale.owner_address)}
												</h4>
												<Show when={whale.telegram_username}>
													<span class="text-[10px] text-[#0098EA] font-mono">
														@{whale.telegram_username}
													</span>
												</Show>
											</div>
											<div class="text-[10px] text-white/40 font-mono mt-0.5 flex items-center gap-1">
												<span>والت: {shortenAddress(whale.owner_address)}</span>
												<button
													type="button"
													onClick={() => handleCopy(whale.owner_address)}
													class="text-white/40 hover:text-white transition-colors"
													title="کپی آدرس"
												>
													<span class="material-symbols-outlined text-[13px]">
														{isCopied() ? 'check' : 'content_copy'}
													</span>
												</button>
											</div>
										</div>
									</div>

									{/* Strategy Badge */}
									<span
										class={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-lg border font-bold ${badge.bg} ${badge.border} ${badge.text}`}
									>
										{badge.label}
									</span>
								</div>

								{/* Metrics Bar */}
								<div class="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.05] text-xs">
									<div class="bg-white/[0.02] border border-white/[0.03] rounded-xl p-2">
										<span class="text-[9px] uppercase text-white/40 block">تعداد گیفت‌ها</span>
										<span class="font-bold text-white font-mono mt-0.5 block">
											🎁 {whale.holdings_count.toLocaleString()}
										</span>
									</div>
									<div class="bg-white/[0.02] border border-white/[0.03] rounded-xl p-2">
										<span class="text-[9px] uppercase text-white/40 block">ارزش پورتفو (TON)</span>
										<span class="font-bold text-[#0098EA] font-mono mt-0.5 block">
											💎 {formatTon(whale.total_value_gram)}
										</span>
									</div>
									<div class="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-xl p-2 text-right rtl:text-left">
										<span class="text-[9px] uppercase text-emerald-400 font-bold block">
											معادل دلاری
										</span>
										<span class="font-black text-emerald-400 font-mono mt-0.5 block">
											{formatUsd(whale.total_value_usd)}
										</span>
									</div>
								</div>

								{/* Bottom Details + Explorer Button */}
								<div class="flex items-center justify-between pt-1 text-[10px] text-white/40 font-mono">
									<div class="flex items-center gap-3">
										<span>
											هولد میانگین:{' '}
											<strong class="text-white/70">{whale.avg_hold_days || 45} روز</strong>
										</span>
										<Show when={whale.change_24h_count !== 0}>
											<span
												class={
													whale.change_24h_count > 0 ? 'text-emerald-400' : 'text-rose-400'
												}
											>
												{whale.change_24h_count > 0 ? '+' : ''}
												{whale.change_24h_count} (۲۴ ساعت)
											</span>
										</Show>
									</div>

									<a
										href={`https://tonviewer.com/${whale.owner_address}`}
										target="_blank"
										rel="noreferrer"
										class="inline-flex items-center gap-1 text-[#0098EA] hover:text-[#0098EA]/80 font-semibold"
									>
										<span>مشاهده در Tonviewer</span>
										<span class="material-symbols-outlined text-[13px] rtl:rotate-180">
											open_in_new
										</span>
									</a>
								</div>
							</div>
						);
					}}
				</For>
			</div>
		</div>
	);
};
