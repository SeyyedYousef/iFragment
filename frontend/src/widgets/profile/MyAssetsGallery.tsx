import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { getMyAssets, type MyAssetsResponse, type MyReportsAsset } from '@/entities/user/index.js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';
import { getRecentReports } from '@/shared/lib/report-cache.js';

interface Props {
	onClose?: () => void;
}

type ReportFilter = 'all' | 'username' | 'number' | 'gift';

export const MyAssetsGallery: Component<Props> = (props) => {
	const navigate = useNavigate();
	const [reportFilter, setReportFilter] = createSignal<ReportFilter>('all');

	const assetsQuery = createQuery(() => ({
		queryKey: ['profile', 'assets'],
		queryFn: getMyAssets,
		staleTime: 15_000,
	}));

	const assets = () => assetsQuery.data as MyAssetsResponse | undefined;
	const loading = () => assetsQuery.isLoading;

	const totalReports = () => {
		const serverReports = assets()?.reports || [];
		const serverUsernames = new Set(
			serverReports
				.filter((r) => (r.type || 'username') === 'username')
				.map((r) => (r.identifier || r.username || '').toLowerCase().replace(/^@/, '')),
		);

		let localRecents: ReturnType<typeof getRecentReports> = [];
		try {
			localRecents = getRecentReports();
		} catch {}

		const extraUsernames: MyReportsAsset[] = [];
		for (const rec of localRecents) {
			const cleanName = (rec.username || '').toLowerCase().replace(/^@/, '');
			if (!cleanName || serverUsernames.has(cleanName)) continue;
			serverUsernames.add(cleanName);
			extraUsernames.push({
				type: 'username',
				identifier: cleanName,
				title: `@${cleanName}`,
				username: cleanName,
				rarityScore: rec.expectedTon ? 85 : 80,
				status: 'completed',
				generatedAt: new Date(rec.savedAt).toISOString(),
				certificateUrl: `/username/report?u=${encodeURIComponent(cleanName)}`,
				notificationEnabled: true,
				valueEstimate: rec.expectedTon ? `${rec.expectedTon} TON` : undefined,
			});
		}

		if (extraUsernames.length === 0) return serverReports;
		return [...serverReports, ...extraUsernames].sort(
			(a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
		);
	};
	const usernameReports = () => totalReports().filter((r) => (r.type || 'username') === 'username');
	const numberReports = () => totalReports().filter((r) => r.type === 'number');
	const giftReports = () => totalReports().filter((r) => r.type === 'gift');

	const filteredReports = () => {
		switch (reportFilter()) {
			case 'username':
				return usernameReports();
			case 'number':
				return numberReports();
			case 'gift':
				return giftReports();
			default:
				return totalReports();
		}
	};

	const getReportUrl = (r: MyReportsAsset) => {
		if (r.certificateUrl) return r.certificateUrl;
		const type = r.type || 'username';
		const id = r.identifier || r.username;
		if (type === 'number') return `/numbers/report?n=${encodeURIComponent(id)}`;
		if (type === 'gift') return `/gifts/report?g=${encodeURIComponent(id)}`;
		return `/username/report?u=${encodeURIComponent(id.replace(/^@/, ''))}`;
	};

	return (
		<div class="w-full flex flex-col gap-2">
			<div class="flex items-center justify-between px-0.5">
				<h3 class="text-[15px] font-semibold text-white">
					{t('assets.title' as any) || 'My Assets'}
				</h3>
				<Show when={props.onClose}>
					<button
						type="button"
						onClick={props.onClose}
						class="w-7 h-7 rounded-[6px] bg-[#242e38] flex items-center justify-center text-[#8c9aa9] hover:text-white"
					>
						<span class="material-symbols-outlined text-[16px]">close</span>
					</button>
				</Show>
			</div>

			<div class="frag-table-container">
				<Show
					when={!loading()}
					fallback={
						<div class="p-4 space-y-2 animate-pulse">
							<div class="h-11 bg-[#242e38] rounded-[6px]" />
							<div class="h-11 bg-[#242e38] rounded-[6px]" />
						</div>
					}
				>
					{/* Sub-tabs Filter Row */}
					<Show when={totalReports().length > 0}>
						<div class="frag-table-header px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
							<For
								each={
									[
										{ id: 'all', label: 'All', count: totalReports().length },
										{ id: 'username', label: 'Usernames', count: usernameReports().length },
										{ id: 'number', label: 'Numbers +888', count: numberReports().length },
										{ id: 'gift', label: 'Gifts', count: giftReports().length },
									] as const
								}
							>
								{(f) => (
									<button
										type="button"
										onClick={() => {
											try {
												haptic.selection();
											} catch {}
											setReportFilter(f.id as ReportFilter);
										}}
										class={`px-2.5 py-1 rounded-[6px] text-[11.5px] font-semibold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
											reportFilter() === f.id
												? 'bg-[#248bda] text-white'
												: 'bg-[#212a33] text-[#8c9aa9] hover:text-white'
										}`}
									>
										<span>{f.label}</span>
										<span class="font-mono text-[10.5px] opacity-85 tabular-nums">{f.count}</span>
									</button>
								)}
							</For>
						</div>
					</Show>

					{/* Reports Table List */}
					<Show
						when={filteredReports().length > 0}
						fallback={
							<div class="py-7 px-4 text-center flex flex-col items-center gap-2.5">
								<span class="text-[#8794a1] text-[12.5px]">
									{reportFilter() === 'username'
										? t('assets.noUsernameReports' as any) ||
											'No username valuation reports registered yet.'
										: reportFilter() === 'number'
											? t('assets.noNumberReports' as any) ||
												'No collectible number reports registered yet.'
											: reportFilter() === 'gift'
												? t('assets.noGiftReports' as any) ||
													'No Telegram gift valuation reports registered yet.'
												: t('assets.noReports' as any) ||
													'No valuation reports registered yet across any vertical.'}
								</span>
								<div class="flex items-center gap-2 flex-wrap justify-center">
									<Show when={reportFilter() === 'all' || reportFilter() === 'username'}>
										<button
											type="button"
											onClick={() => navigate('/')}
											class="px-3 py-1.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-[#4db2ff] text-[12px] font-semibold cursor-pointer"
										>
											{t('assets.searchUsername' as any) || 'Analyze Username'}
										</button>
									</Show>
									<Show when={reportFilter() === 'all' || reportFilter() === 'number'}>
										<button
											type="button"
											onClick={() => navigate('/numbers')}
											class="px-3 py-1.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-[#4db2ff] text-[12px] font-semibold cursor-pointer"
										>
											{t('numbers.title' as any) || 'Valuate Number (+888)'}
										</button>
									</Show>
									<Show when={reportFilter() === 'all' || reportFilter() === 'gift'}>
										<button
											type="button"
											onClick={() => navigate('/gifts')}
											class="px-3 py-1.5 rounded-[6px] bg-[#242e38] hover:bg-[#293440] text-[#4db2ff] text-[12px] font-semibold cursor-pointer"
										>
											{t('gifts.intel' as any) || 'Inspect Gifts'}
										</button>
									</Show>
								</div>
							</div>
						}
					>
						<For each={filteredReports()}>
							{(r) => {
								const type = () => r.type || 'username';
								const targetUrl = () => getReportUrl(r);
								return (
									<button
										type="button"
										onClick={() => navigate(targetUrl())}
										class="frag-table-row w-full px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer text-start"
									>
										<div class="flex flex-col min-w-0">
											<div class="flex items-center gap-2 min-w-0">
												<span
													dir="ltr"
													class="text-[13.5px] font-semibold text-white truncate font-mono"
												>
													{r.title ||
														(type() === 'username'
															? `@${r.username.replace(/^@/, '')}`
															: r.identifier || r.username)}
												</span>
												<span
													class={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-[4px] shrink-0 ${
														type() === 'username'
															? 'bg-[#4db2ff]/10 text-[#4db2ff]'
															: type() === 'number'
																? 'bg-[#ff9953]/10 text-[#ff9953]'
																: 'bg-[#5aec8c]/10 text-[#5aec8c]'
													}`}
												>
													{type() === 'username'
														? 'Username'
														: type() === 'number'
															? '+888'
															: 'Gift'}
												</span>
											</div>

											<div class="flex items-center gap-1.5 text-[11.5px] text-[#8c9aa9] tabular-nums mt-0.5">
												<span class="text-[#5aec8c] font-semibold">
													{type() === 'username'
														? `Score ${r.rarityScore}/100`
														: `Confidence ${r.rarityScore}%`}
												</span>
												<Show when={r.valueEstimate}>
													<span>·</span>
													<span dir="ltr" class="text-[#4db2ff] font-semibold font-mono">
														{r.valueEstimate}
													</span>
												</Show>
											</div>
										</div>

										<span class="material-symbols-outlined text-[17px] text-[#8c9aa9] rtl:rotate-180 shrink-0">
											chevron_right
										</span>
									</button>
								);
							}}
						</For>
					</Show>
				</Show>
			</div>
		</div>
	);
};
