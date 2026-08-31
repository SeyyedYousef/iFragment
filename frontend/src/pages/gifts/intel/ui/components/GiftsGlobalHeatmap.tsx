import { toPng } from 'html-to-image';
import { type Component, createSignal, For, Show } from 'solid-js';
import { OFFICIAL_GIFTS_120, getGiftCdnImageUrl } from '@/entities/gifts/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

const BACKDROPS_SAMPLE = [
	{ name: 'Onyx Black', hex: '#0B0D13', edge: '#1C2030', tier: 'mythic' },
	{ name: 'Pure Gold', hex: '#FFD700', edge: '#FFA500', tier: 'legendary' },
	{ name: 'Neon Cyan', hex: '#00F0FF', edge: '#0072FF', tier: 'epic' },
	{ name: 'Amethyst Violet', hex: '#9933FF', edge: '#4A00E0', tier: 'rare' },
	{ name: 'Emerald Green', hex: '#00E676', edge: '#00B0FF', tier: 'uncommon' },
	{ name: 'Slate Gray', hex: '#455A64', edge: '#263238', tier: 'common' },
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
		if (score <= 2) return 'bg-gradient-to-br from-amber-500/80 to-red-600/80 text-white border-amber-400';
		if (score <= 5) return 'bg-gradient-to-br from-purple-600/70 to-pink-600/70 text-white border-purple-400';
		if (score <= 10) return 'bg-gradient-to-br from-blue-600/60 to-cyan-600/60 text-white border-blue-400';
		if (score <= 18) return 'bg-gradient-to-br from-emerald-600/50 to-teal-600/50 text-white border-emerald-400';
		return 'bg-white/[0.04] text-white/50 border-white/10';
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
		<div class="space-y-4">
			{/* Header & Collection Selector & Download Button */}
			<div class="flex items-center justify-between gap-2 flex-wrap">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
						<img
							src={getGiftCdnImageUrl(selectedSlug())}
							alt={selectedGift().name}
							class="w-full h-full object-contain"
						/>
					</div>
					<select
						value={selectedSlug()}
						onChange={(e) => setSelectedSlug(e.currentTarget.value)}
						class="bg-[#12141C] border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-[#0098EA]/50"
					>
						<For each={OFFICIAL_GIFTS_120}>
							{(gift) => <option value={gift.slug}>{gift.name} ({gift.tag})</option>}
						</For>
					</select>
				</div>

				<button
					type="button"
					onClick={handleDownload}
					disabled={downloading()}
					class="px-3.5 py-2 bg-[#0098EA] hover:bg-[#0080ca] active:scale-95 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-lg shadow-[#0098EA]/20 transition-all"
				>
					<span class="material-symbols-outlined text-sm">
						{downloadSuccess() ? 'check_circle' : 'download'}
					</span>
					<span>{downloadSuccess() ? 'Exported!' : t('gifts.exportHeatmap')}</span>
				</button>
			</div>

			{/* Heatmap Printable Canvas */}
			<div
				ref={heatmapRef}
				class="bg-[#12141C]/90 border border-white/[0.08] rounded-3xl p-4 backdrop-blur-2xl shadow-2xl space-y-3"
			>
				<div class="flex items-center justify-between border-b border-white/[0.06] pb-3">
					<div>
						<h3 class="text-sm font-black text-white">{selectedGift().name} · Rarity Heatmap</h3>
						<p class="text-[10px] text-white/40 font-mono mt-0.5">
							Model × Backdrop Permille Matrix (7,576 Model Variants)
						</p>
					</div>
					<div class="text-[10px] font-black text-[#0098EA] bg-[#0098EA]/10 border border-[#0098EA]/20 px-2 py-0.5 rounded-full">
						4-Axis DNA
					</div>
				</div>

				{/* Matrix Grid */}
				<div class="overflow-x-auto pb-2">
					<table class="w-full text-left text-xs border-collapse min-w-[340px]">
						<thead>
							<tr>
								<th class="p-1.5 text-[10px] font-bold text-white/40 uppercase">Model / Backdrop</th>
								<For each={BACKDROPS_SAMPLE}>
									{(b) => (
										<th class="p-1.5 text-center">
											<div class="flex flex-col items-center gap-1">
												<span
													class="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
													style={{ background: `linear-gradient(135deg, ${b.hex}, ${b.edge})` }}
												/>
												<span class="text-[9px] font-mono text-white/50 truncate max-w-[45px]">
													{b.name.split(' ')[0]}
												</span>
											</div>
										</th>
									)}
								</For>
							</tr>
						</thead>
						<tbody>
							<For each={MODELS_SAMPLE}>
								{(model, mIdx) => (
									<tr>
										<td class="p-1.5 font-bold text-white/80 text-[11px] truncate max-w-[100px]">
											<div>{model.name}</div>
											<div class="text-[9px] font-mono text-[#0098EA]">
												{model.rarityPermille}‰
											</div>
										</td>
										<For each={BACKDROPS_SAMPLE}>
											{(_backdrop, bIdx) => {
												const cellPermille = (
													(model.rarityPermille * (bIdx === 0 ? 0.05 : 0.2)) / 10
												).toFixed(2);
												return (
													<td class="p-1 text-center">
														<div
															class={`py-2 px-1 rounded-lg border text-[10px] font-mono font-black shadow-sm transition-transform hover:scale-110 cursor-pointer ${getHeatmapColor(
																mIdx(),
																bIdx(),
															)}`}
															title={`${model.name} + ${_backdrop.name}: ${cellPermille}% Rarity`}
														>
															{cellPermille}%
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
				<div class="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[9px] text-white/50">
					<div class="flex items-center gap-1.5">
						<span class="w-2 h-2 rounded-full bg-red-500" />
						<span>Mythic (&lt;0.05%)</span>
					</div>
					<div class="flex items-center gap-1.5">
						<span class="w-2 h-2 rounded-full bg-purple-500" />
						<span>Legendary (&lt;0.2%)</span>
					</div>
					<div class="flex items-center gap-1.5">
						<span class="w-2 h-2 rounded-full bg-blue-500" />
						<span>Epic (&lt;1%)</span>
					</div>
					<div class="flex items-center gap-1.5">
						<span class="w-2 h-2 rounded-full bg-emerald-500" />
						<span>Uncommon</span>
					</div>
				</div>
			</div>
		</div>
	);
};
