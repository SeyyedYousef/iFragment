import { useNavigate } from '@solidjs/router';
import { type Component, createMemo, createSignal, For, Show } from 'solid-js';
import { OFFICIAL_GIFTS_120, type OfficialGiftItem, getGiftCdnImageUrl, GiftThumbnail } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	onSelectCollection?: (slug: string) => void;
}

export const GiftsCollectionsExplorer: Component<Props> = (props) => {
	const navigate = useNavigate();
	const [searchQuery, setSearchQuery] = createSignal('');
	const [selectedTag, setSelectedTag] = createSignal<string>('all');
	const [showAllChips, setShowAllChips] = createSignal(false);

	const tags = () => [
		{ id: 'all', label: t('gifts.quickSelectAll') || 'همه ۱۲۰ گیفت' },
		{ id: 'Bluechip', label: 'Apex (بلوچیپ)' },
		{ id: 'Luxury', label: 'Luxury (لوکس)' },
		{ id: 'Seasonal', label: 'Seasonal (فصلی)' },
		{ id: 'Talisman', label: 'Talisman (طلسم)' },
		{ id: 'Classic', label: 'Classic (کلاسیک)' },
		{ id: 'Special', label: 'Special (ویژه)' },
		{ id: 'Tech', label: 'Tech (فناوری)' },
	];

	const filteredGifts = createMemo(() => {
		const q = searchQuery().toLowerCase().trim();
		const tag = selectedTag();

		return OFFICIAL_GIFTS_120.filter((g) => {
			const matchesTag = tag === 'all' || g.tag.toLowerCase() === tag.toLowerCase();
			const matchesQuery =
				!q ||
				g.name.toLowerCase().includes(q) ||
				g.slug.toLowerCase().includes(q) ||
				g.tag.toLowerCase().includes(q);
			return matchesTag && matchesQuery;
		});
	});

	const handleCardClick = (gift: OfficialGiftItem) => {
		try {
			haptic.selection();
		} catch {}
		if (props.onSelectCollection) {
			props.onSelectCollection(gift.slug);
		} else {
			navigate(`/gifts/collection?c=${encodeURIComponent(gift.slug)}`);
		}
	};

	const handleChipClick = (gift: OfficialGiftItem) => {
		try {
			haptic.selection();
		} catch {}
		setSearchQuery(gift.name);
		handleCardClick(gift);
	};

	return (
		<div class="space-y-3.5">
			{/* Search Input Bar */}
			<div class="relative">
				<span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-lg">
					search
				</span>
				<input
					type="text"
					value={searchQuery()}
					onInput={(e) => setSearchQuery(e.currentTarget.value)}
					placeholder={t('gifts.searchCollection') || 'Search among 120 official gifts...'}
					class="w-full pl-10 pr-10 py-3 bg-[#0b0e17]/90 border border-white/[0.08] rounded-2xl text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#0098EA]/50 focus:ring-1 focus:ring-[#0098EA]/30 transition-all shadow-lg"
				/>
				<Show when={searchQuery().length > 0}>
					<button
						type="button"
						onClick={() => setSearchQuery('')}
						class="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
					>
						<span class="material-symbols-outlined text-base">close</span>
					</button>
				</Show>
			</div>

			{/* Category Filter Chips */}
			<div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
				<For each={tags()}>
					{(tag) => (
						<button
							type="button"
							onClick={() => {
								setSelectedTag(tag.id);
								try { haptic.selection(); } catch {}
							}}
							class={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
								selectedTag() === tag.id
									? 'bg-[#0098EA] text-white shadow-md'
									: 'bg-white/[0.03] hover:bg-white/[0.06] text-white/50 hover:text-white border border-white/5'
							}`}
						>
							{tag.label}
						</button>
					)}
				</For>
			</div>

			{/* 120 Interactive Chip Cloud */}
			<div class="bg-[#0b0e17]/90 border border-white/[0.07] rounded-[22px] p-3.5 backdrop-blur-xl shadow-lg">
				<div class="flex items-center justify-between mb-2 px-1">
					<span class="text-[11px] font-bold text-white/70 flex items-center gap-1.5">
						<span class="material-symbols-outlined text-[#0098EA] text-sm">touch_app</span>
						<span>{t('gifts.quickSelectAll')}</span>
					</span>
					<button
						type="button"
						onClick={() => setShowAllChips(!showAllChips())}
						class="text-[10px] font-bold text-[#0098EA] hover:underline"
					>
						{showAllChips() ? 'نمایش کمتر' : 'نمایش همه ۱۲۰ گیفت'}
					</button>
				</div>

				<div
					class={`flex flex-wrap gap-1.5 transition-all overflow-hidden ${
						showAllChips() ? 'max-h-[800px] overflow-y-auto' : 'max-h-[110px]'
					}`}
				>
					<For each={OFFICIAL_GIFTS_120}>
						{(gift) => (
							<button
								type="button"
								onClick={() => handleChipClick(gift)}
								class="flex items-center gap-1.5 px-2 py-1 bg-white/[0.02] hover:bg-[#0098EA]/20 border border-white/[0.05] hover:border-[#0098EA]/40 rounded-xl text-[11px] font-semibold text-white/80 hover:text-white transition-all active:scale-95 flex-shrink-0"
							>
								<GiftThumbnail slug={gift.slug} name={gift.name} size="sm" class="w-4 h-4 rounded-md border-0 bg-transparent" />
								<span>{gift.name}</span>
							</button>
						)}
					</For>
				</div>
			</div>

			{/* Matching Collection Cards */}
			<div class="space-y-2">
				<div class="flex items-center justify-between px-1 text-xs text-white/40 font-bold">
					<span>کالکشن‌های یافت‌شده ({filteredGifts().length})</span>
					<span>کف قیمت (TON)</span>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
					<For each={filteredGifts()}>
						{(gift) => (
							<button
								type="button"
								onClick={() => handleCardClick(gift)}
								class="flex items-center gap-3 p-3 bg-[#0b0e17]/80 hover:bg-[#0b0e17] border border-white/[0.06] hover:border-[#0098EA]/40 rounded-2xl transition-all active:scale-[0.98] group text-left rtl:text-right shadow-lg"
							>
								{/* Official Artwork / 3D Emoji Avatar */}
								<GiftThumbnail
									slug={gift.slug}
									name={gift.name}
									size="md"
									class="w-12 h-12 rounded-xl group-hover:border-[#0098EA]/50 group-hover:scale-105 transition-all"
								/>

								{/* Info */}
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-1.5">
										<h4 class="text-sm font-bold text-white truncate group-hover:text-[#0098EA] transition-colors">
											{gift.name}
										</h4>
										<span class="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-white/[0.04] text-white/40 border border-white/5 flex-shrink-0">
											{gift.tag}
										</span>
									</div>
									<div class="text-[10px] text-white/40 font-mono mt-0.5 truncate">
										{gift.supply ? `${gift.supply.toLocaleString()} Items` : '100% On-Chain'}
									</div>
								</div>

								{/* Floor */}
								<div class="text-right rtl:text-left flex-shrink-0">
									<div class="text-sm font-black text-white font-mono flex items-center justify-end rtl:justify-start gap-1">
										<span class="text-[#0098EA] text-xs">💎</span>
										<span>{gift.floorTon} TON</span>
									</div>
									<div class="text-[10px] text-white/40 font-mono">
										≈ ${(gift.floorTon * 4.0).toFixed(0)}
									</div>
								</div>
							</button>
						)}
					</For>
				</div>
			</div>
		</div>
	);
};
