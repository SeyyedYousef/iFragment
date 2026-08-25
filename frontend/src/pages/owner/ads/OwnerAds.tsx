import { createSignal, Show, For, type Component } from 'solid-js';
import { createQuery, createMutation, useQueryClient } from '@tanstack/solid-query';
import { ownerApi } from '@/entities/owner/api/ownerApi.js';
import type { AdCampaign } from '@/entities/owner/model/types.js';
import { ImageCropUploader } from '@/features/owner/ads/ImageCropUploader.jsx';
import { DangerActionDialog } from '@/widgets/owner/DangerActionDialog.jsx';

export const OwnerAds: Component = () => {
	const queryClient = useQueryClient();
	const [activeSlot, setActiveSlot] = createSignal('dashboard_banner');

	// Form state
	const [isCreating, setIsCreating] = createSignal(false);
	const [editingAd, setEditingAd] = createSignal<AdCampaign | null>(null);
	const [formTitle, setFormTitle] = createSignal('');
	const [formTargetUrl, setFormTargetUrl] = createSignal('');
	const [formImageUrl, setFormImageUrl] = createSignal('');
	const [formPriority, setFormPriority] = createSignal(0);
	const [formIsActive, setFormIsActive] = createSignal(true);

	// Deletion state
	const [adToDelete, setAdToDelete] = createSignal<AdCampaign | null>(null);

	const adsQuery = createQuery<AdCampaign[]>(() => ({
		queryKey: ['owner', 'ads', activeSlot()],
		queryFn: () => ownerApi.listAdCampaigns(activeSlot()),
	}));

	const createAdMutation = createMutation(() => ({
		mutationFn: (ad: Partial<AdCampaign>) => ownerApi.createAdCampaign(ad),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'ads'] });
			resetForm();
		},
	}));

	const updateMutation = createMutation(() => ({
		mutationFn: ({ id, ad }: { id: string; ad: Partial<AdCampaign> }) =>
			ownerApi.updateAdCampaign(id, ad),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'ads'] });
			resetForm();
		},
	}));

	const deleteMutation = createMutation(() => ({
		mutationFn: (id: string) => ownerApi.deleteAdCampaign(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['owner', 'ads'] });
			setAdToDelete(null);
		},
	}));

	const resetForm = () => {
		setIsCreating(false);
		setEditingAd(null);
		setFormTitle('');
		setFormTargetUrl('');
		setFormImageUrl('');
		setFormPriority(0);
		setFormIsActive(true);
	};

	const handleEdit = (ad: AdCampaign) => {
		setEditingAd(ad);
		setFormTitle(ad.title);
		setFormTargetUrl(ad.target_url);
		setFormImageUrl(ad.image_url);
		setFormPriority(ad.priority);
		setFormIsActive(ad.is_active);
		setIsCreating(true);
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		const payload: Partial<AdCampaign> = {
			slot: activeSlot(),
			title: formTitle().trim(),
			target_url: formTargetUrl().trim(),
			image_url: formImageUrl().trim(),
			priority: formPriority(),
			is_active: formIsActive(),
		};

		if (editingAd()) {
			updateMutation.mutate({ id: editingAd()!.id, ad: payload });
		} else {
			createAdMutation.mutate(payload);
		}
	};

	return (
		<div class="space-y-6">
			{/* Header & Add Button */}
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div>
					<h2 class="text-lg font-bold text-white">Ad Campaigns & Media Storage</h2>
					<p class="text-xs text-white/50">Manage dashboard banners, aspect ratios, and campaign analytics</p>
				</div>
				<button
					onClick={() => {
						resetForm();
						setIsCreating(true);
					}}
					class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20"
				>
					<span class="material-symbols-rounded text-base">add_photo_alternate</span>
					<span>Create Campaign</span>
				</button>
			</div>

			{/* Slot Selector */}
			<div class="flex gap-2 border-b border-white/10 pb-3">
				<button
					onClick={() => setActiveSlot('dashboard_banner')}
					class={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
						activeSlot() === 'dashboard_banner'
							? 'bg-white/10 text-white border border-white/20'
							: 'text-white/50 hover:text-white'
					}`}
				>
					Dashboard Banner (1080x384 / 25:9)
				</button>
				<button
					onClick={() => setActiveSlot('interstitial')}
					class={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
						activeSlot() === 'interstitial'
							? 'bg-white/10 text-white border border-white/20'
							: 'text-white/50 hover:text-white'
					}`}
				>
					Interstitial Stories
				</button>
			</div>

			{/* Create / Edit Form Modal or Card */}
			<Show when={isCreating()}>
				<div class="rounded-3xl border border-amber-500/30 bg-black/60 p-6 space-y-5 backdrop-blur-xl">
					<div class="flex items-center justify-between border-b border-white/10 pb-3">
						<h3 class="text-sm font-bold text-white">
							{editingAd() ? 'Edit Campaign' : 'Create New Ad Campaign'}
						</h3>
						<button onClick={resetForm} class="text-xs text-white/50 hover:text-white">
							Cancel
						</button>
					</div>

					<form onSubmit={handleSubmit} class="space-y-4">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label class="block text-[11px] text-white/60 font-semibold mb-1">Campaign Title</label>
								<input
									type="text"
									placeholder="e.g., Summer TON Tournament"
									value={formTitle()}
									onInput={(e) => setFormTitle(e.currentTarget.value)}
									class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:border-amber-400 focus:outline-none"
									required
								/>
							</div>

							<div>
								<label class="block text-[11px] text-white/60 font-semibold mb-1">Target URL / Telegram Link</label>
								<input
									type="text"
									placeholder="https://t.me/channel or https://example.com"
									value={formTargetUrl()}
									onInput={(e) => setFormTargetUrl(e.currentTarget.value)}
									class="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-xs focus:border-amber-400 focus:outline-none"
									required
								/>
							</div>
						</div>

						{/* Image Uploader Component */}
						<div>
							<label class="block text-[11px] text-white/60 font-semibold mb-1.5">
								Banner Image (Drag & Drop or Interactive Crop)
							</label>
							<ImageCropUploader
								slot={activeSlot()}
								currentImageUrl={formImageUrl()}
								onUploaded={(url: string) => setFormImageUrl(url)}
							/>
						</div>

						<div class="flex items-center justify-between pt-2 border-t border-white/10">
							<label class="flex items-center gap-2 text-xs text-white cursor-pointer select-none">
								<input
									type="checkbox"
									checked={formIsActive()}
									onChange={(e) => setFormIsActive(e.currentTarget.checked)}
									class="rounded accent-amber-500 h-4 w-4"
								/>
								<span>Active & Displaying</span>
							</label>

							<div class="flex items-center gap-3">
								<button
									type="button"
									onClick={resetForm}
									class="px-4 py-2.5 rounded-xl text-xs text-white/70 hover:bg-white/5"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={createAdMutation.isPending || updateMutation.isPending || !formImageUrl()}
									class="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
								>
									<Show
										when={createAdMutation.isPending || updateMutation.isPending}
										fallback={<span>{editingAd() ? 'Save Changes' : 'Publish Campaign'}</span>}
									>
										Saving...
									</Show>
								</button>
							</div>
						</div>
					</form>
				</div>
			</Show>

			{/* Campaigns Table & Live Preview */}
			<div class="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="material-symbols-rounded text-amber-400">campaign</span>
						<span class="text-sm font-bold text-white">Active Campaigns</span>
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-left text-xs">
						<thead>
							<tr class="border-b border-white/10 text-white/40">
								<th class="pb-3 font-medium">Banner Preview</th>
								<th class="pb-3 font-medium">Title & Target</th>
								<th class="pb-3 font-medium">Status</th>
								<th class="pb-3 font-medium">Impressions</th>
								<th class="pb-3 font-medium">Clicks</th>
								<th class="pb-3 font-medium">CTR</th>
								<th class="pb-3 font-medium text-right">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-white/5">
							<Show
								when={!adsQuery.isLoading && adsQuery.data?.length}
								fallback={
									<tr>
										<td colspan="7" class="py-8 text-center text-white/40">
											{adsQuery.isLoading ? 'Loading campaigns...' : 'No ad campaigns in this slot'}
										</td>
									</tr>
								}
							>
								<For each={adsQuery.data}>
									{(ad) => {
										const ctr = () =>
											ad.impressions_count > 0
												? ((ad.clicks_count / ad.impressions_count) * 100).toFixed(1)
												: '0.0';
										return (
											<tr class="hover:bg-white/[0.02] transition">
												<td class="py-3">
													<div class="h-10 w-28 rounded-lg overflow-hidden border border-white/10 bg-black/40">
														<img src={ad.image_url} alt={ad.title} class="h-full w-full object-cover" />
													</div>
												</td>
												<td class="py-3">
													<div class="font-bold text-white">{ad.title}</div>
													<a
														href={ad.target_url}
														target="_blank"
														rel="noreferrer"
														class="text-[11px] text-amber-400 hover:underline truncate max-w-[200px] block"
													>
														{ad.target_url}
													</a>
												</td>
												<td class="py-3">
													<span
														class={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
															ad.is_active
																? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
																: 'bg-white/5 text-white/40'
														}`}
													>
														{ad.is_active ? 'Active' : 'Paused'}
													</span>
												</td>
												<td class="py-3 font-mono text-white/80">{ad.impressions_count.toLocaleString()}</td>
												<td class="py-3 font-mono text-white/80">{ad.clicks_count.toLocaleString()}</td>
												<td class="py-3 font-mono text-emerald-400 font-semibold">{ctr()}%</td>
												<td class="py-3 text-right">
													<div class="flex items-center justify-end gap-1.5">
														<button
															onClick={() => handleEdit(ad)}
															class="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
															title="Edit"
														>
															<span class="material-symbols-rounded text-base">edit</span>
														</button>
														<button
															onClick={() => setAdToDelete(ad)}
															class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
															title="Delete"
														>
															<span class="material-symbols-rounded text-base">delete</span>
														</button>
													</div>
												</td>
											</tr>
										);
									}}
								</For>
							</Show>
						</tbody>
					</table>
				</div>
			</div>

			{/* Danger Action Dialog for Deletion */}
			<Show when={adToDelete()}>
				<DangerActionDialog
					isOpen={true}
					title="Delete Ad Campaign"
					description={`Are you sure you want to permanently delete campaign "${adToDelete()?.title}"? This cannot be undone.`}
					actionLabel="Delete Campaign"
					confirmWord="DELETE"
					riskLevel="high"
					requireReason={false}
					loading={deleteMutation.isPending}
					onConfirm={() => {
						if (adToDelete()) {
							deleteMutation.mutate(adToDelete()!.id);
						}
					}}
					onClose={() => setAdToDelete(null)}
				/>
			</Show>
		</div>
	);
};
