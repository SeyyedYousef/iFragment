import { toPng } from 'html-to-image';
import { type Component, createSignal, For, Show } from 'solid-js';
import { OFFICIAL_GIFTS_120, getGiftCdnImageUrl } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

const BACKDROPS_SAMPLE = [
	{ name: 'Onyx Black', hex: '#0B0D13', edge: '#1C2030', tier: 'mythic', permille: 5 },
	{ name: 'Pure Gold', hex: '#FFD700', edge: '#FFA500', tier: 'legendary', permille: 12 },
	{ name: 'Neon Cyan', hex: '#00F0FF', edge: '#0072FF', tier: 'epic', permille: 35 },
	{ name: 'Amethyst', hex: '#9933FF', edge: '#4A00E0', tier: 'rare', permille: 85 },
	{ name: 'Emerald', hex: '#00E676', edge: '#00B0FF', tier: 'uncommon', permille: 180 },
	{ name: 'Slate Gray', hex: '#455A64', edge: '#263238', tier: 'common', permille: 450 },
];

const MODELS_SAMPLE = [
	{ name: 'Apex Master', rarityPermille: 1.2, tier: 'mythic' },
	{ name: 'Golden Champion', rarityPermille: 8.5, tier: 'legendary' },
	{ name: 'Cyber Hunter', rarityPermille: 24.0, tier: 'epic' },
	{ name: 'Shadow Phantom', rarityPermille: 65.0, tier: 'rare' },
	{ name: 'Standard Edition', rarityPermille: 240.0, tier: 'common' },
];

export const GiftsGlobalHeatmap: Component = () => {
	let heatmapRef: HTMLDivElement | undefined;
	const [selectedSlug, setSelectedSlug] = createSignal<string>('plush_pepe');
	const [downloading, setDownloading] = createSignal<boolean>(false);
	const [downloadSuccess, setDownloadSuccess] = createSignal<boolean>(false);

	const selectedGift = () => {
		return OFFICIAL_GIFTS_120.find((g) => g.slug === selectedSlug()) || OFFICIAL_GIFTS_120[3];
	};

	const getHeatmapColor = (modelIdx: number, backdropIdx: number) => {
		const score = (modelIdx + 1) * (backdropIdx + 1);
		if (score <= 2) return 'bg-amber-500/80 text-black font-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]';
		if (score <= 5) return 'bg-purple-600/70 text-white font-bold border-purple-400';
		if (score <= 10) return 'bg-blue-600/60 text-white font-bold border-blue-400';
		if (score <= 18) return 'bg-emerald-600/50 text-white border-emerald-400';
		return 'bg-white/[0.03] text-white/40 border-white/[0.05]';
	};

	const handleDownload = async () => {
		if (!heatmapRef || downloading()) return;
		setDownloading(true);
		try {
			haptic.impact('medium');
			const dataUrl = await toPng(heatmapRef, {
				backgroundColor: '#06070B',
				pixelRatio: 2,
			});
			const link = document.createElement('a');
			link.download = `gift_heatmap_${selectedSlug()}.png`;
			link.href = dataUrl;
			link.click();
			setDownloadSuccess(true);
			setTimeout(() => setDownloadSuccess(false), 2500);
		} catch (err) {
			// Fallback: download as JSON
			const exportData = {
				collection: selectedGift().name,
				slug: selectedSlug(),
				generated_at: new Date().toISOString(),
				models: MODELS_SAMPLE,
				backdrops: BACKDROPS_SAMPLE,
			};
			const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.download = `gift_heatmap_${selectedSlug()}.json`;
			link.href = url;
			link.click();
			URL.revokeObjectURL(url);
		} finally {
			setDownloading(false);
		}
	};

	return (
		<div class="space-y-3.5">
			{/* Top Control Bar: Select Collection & Export Button */}
			<div class="flex items-center justify-between gap-2">
				<div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
					<For each={OFFICIAL_GIFTS_120.slice(0, 10)}>
						{(gift) => (
							<button
								type="button"
								onClick={() => {
									setSelectedSlug(gift.slug);
									try { haptic.selection(); } catch {}
								}}
								class={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
									selectedSlug() === gift.slug
										? 'bg-[#0098EA] text-white shadow-md'
										: 'bg-white/[0.03] hover:bg-white/[0.06] text-white/60 border border-white/5'
								}`}
							>
								<div class="w-3.5 h-3.5 rounded-md overflow-hidden bg-white/5 flex-shrink-0">
									<img
										src={getGiftCdnImageUrl(gift.slug)}
										alt={gift.name}
										class="w-full h-full object-contain"
										onError={(e) => {
											e.currentTarget.style.display = 'none';
										}}
									/>
								</div>
								<span>{gift.name}</span>
							</button>
						)}
					</For>
				</div>

				<button
					type="button"
					onClick={handleDownload}
					disabled={downloading()}
					class="flex items-center gap-1 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] active:scale-95 border border-white/10 rounded-xl text-xs font-bold text-white transition-all flex-shrink-0 shadow-md"
				>
					<span class="material-symbols-outlined text-sm">
						{downloadSuccess() ? 'check_circle' : 'download'}
					</span>
					<span>{downloadSuccess() ? 'ذخیره شد' : t('gifts.exportHeatmap')}</span>
				</button>
			</div>

			{/* Heatmap Matrix Canvas (Exportable) */}
			<div
				ref={heatmapRef}
				class="bg-[#0b0e17]/95 border border-white/[0.08] rounded-[24px] p-4 backdrop-blur-2xl shadow-2xl space-y-3"
			>
				{/* Matrix Header */}
				<div class="flex items-center justify-between pb-2 border-b border-white/[0.06]">
					<div class="flex items-center gap-2">
						<div class="w-8 h-8 rounded-xl bg-white/5 border border-white/10 p-1 flex items-center justify-center">
							<img
								src={getGiftCdnImageUrl(selectedGift().slug)}
								alt={selectedGift().name}
								class="w-full h-full object-contain"
								onError={(e) => {
									e.currentTarget.style.display = 'none';
								}}
							/>
						</div>
						<div>
							<h3 class="text-xs font-black text-white">{selectedGift().name} Rarity Matrix</h3>
							<p class="text-[9px] text-white/40 font-mono">Model Permille × Backdrop Colorway Distribution</p>
						</div>
					</div>
					<span class="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
						6 Rarity Tiers
					</span>
				</div>

				{/* Heatmap Grid Matrix */}
				<div class="overflow-x-auto pb-1">
					<table class="w-full text-[10px] font-mono border-collapse">
						<thead>
							<tr>
								<th class="p-1.5 text-left rtl:text-right text-white/30 font-medium">Model \ Backdrop</th>
								<For each={BACKDROPS_SAMPLE}>
									{(b) => (
										<th class="p-1.5 text-center text-white/60">
											<div class="flex flex-col items-center gap-1">
												<span
													class="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
													style={{ background: b.hex }}
												/>
												<span class="truncate max-w-[50px]">{b.name}</span>
											</div>
										</th>
									)}
								</For>
							</tr>
						</thead>
						<tbody>
							<For each={MODELS_SAMPLE}>
								{(m, mIdx) => (
									<tr class="border-t border-white/[0.04]">
										<td class="p-1.5 font-bold text-white whitespace-nowrap">
											<div>{m.name}</div>
											<div class="text-[8px] text-white/30 font-normal">{m.rarityPermille}‰</div>
										</td>
										<For each={BACKDROPS_SAMPLE}>
											{(_, bIdx) => {
												const cellClass = getHeatmapColor(mIdx(), bIdx());
												return (
													<td class="p-1 text-center">
														<div
															class={`w-full py-2 px-1 rounded-lg border text-center transition-all ${cellClass}`}
														>
															{((m.rarityPermille * BACKDROPS_SAMPLE[bIdx()].permille) / 100).toFixed(2)}%
														</div>
													</td>
												);
											}}
										</For>
									</tr>
								)}
							</For>
						</tbody>
					</table>
				</div>

				{/* Legend */}
				<div class="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[9px] font-mono text-white/40">
					<div class="flex items-center gap-3">
						<span class="flex items-center gap-1">
							<span class="w-2 h-2 rounded bg-amber-400" /> Mythic
						</span>
						<span class="flex items-center gap-1">
							<span class="w-2 h-2 rounded bg-purple-500" /> Legendary
						</span>
						<span class="flex items-center gap-1">
							<span class="w-2 h-2 rounded bg-blue-500" /> Rare
						</span>
						<span class="flex items-center gap-1">
							<span class="w-2 h-2 rounded bg-emerald-500" /> Common
						</span>
					</div>
					<span>Normalized Permille Formula</span>
				</div>
			</div>
		</div>
	);
};
