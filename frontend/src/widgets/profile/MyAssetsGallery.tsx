import { Motion } from '@motionone/solid';
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
		if (type === 'number') {
			return `/numbers/report?n=${encodeURIComponent(id)}`;
		}
		if (type === 'gift') {
			return `/gifts/report?g=${encodeURIComponent(id)}`;
		}
		return `/username/report?u=${encodeURIComponent(id.replace(/^@/, ''))}`;
	};

	return (
		<Motion.div
			initial={{ opacity: 0, scale: 0.96, y: 16 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			transition={{ duration: 0.3, easing: [0.22, 1, 0.36, 1] }}
			class="w-full max-w-lg mx-auto flex flex-col gap-4"
		>
			{/* Fragment HUD Shell */}
			<div class="frag-card-elevated p-4 rounded-2xl flex flex-col gap-3.5">
				{/* Header */}
				<div class="flex items-center justify-between px-0.5">
					<div class="flex items-center gap-2.5">
						<div class="w-8 h-8 rounded-xl bg-[#141a22] border border-[#2990ff]/25 flex items-center justify-center text-[#5aaeff]">
							<span class="material-symbols-outlined text-[18px]">inventory_2</span>
						</div>
						<div class="flex flex-col">
							<h3 class="text-[15px] font-bold text-white tracking-tight">
								{t('assets.title' as any) || 'My Assets'}
							</h3>
							<span class="text-[11px] font-medium text-[#8ca0b5]">
								{assets()?.summaryText ||
									t('assets.subtitle' as any) ||
									'Reports, groups & boosters'}
							</span>
						</div>
					</div>
					<Show when={props.onClose}>
						<button
							type="button"
							onClick={props.onClose}
							class="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-[#8ca0b5] active:scale-95"
						>
							<span class="material-symbols-outlined text-[18px]">close</span>
						</button>
					</Show>
				</div>

				{/* Tab Content */}
				<div class="min-h-[150px]">
					<Show
						when={!loading()}
						fallback={
							<div class="flex flex-col gap-2 py-3 animate-pulse">
								<div class="h-12 bg-white/[0.05] rounded-xl" />
								<div class="h-12 bg-white/[0.05] rounded-xl" />
							</div>
						}
					>
						<div class="flex flex-col gap-3">
							{/* Sub-tabs: Vertical Filter Pills */}
							<Show when={totalReports().length > 0}>
								<div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
									<For
										each={
											[
												{ id: 'all', label: 'All', count: totalReports().length, icon: 'apps' },
												{
													id: 'username',
													label: 'Usernames',
													count: usernameReports().length,
													icon: 'alternate_email',
												},
												{
													id: 'number',
													label: 'Numbers +888',
													count: numberReports().length,
													icon: 'dialpad',
												},
												{
													id: 'gift',
													label: 'Gifts',
													count: giftReports().length,
													icon: 'featured_seasonal_and_gifts',
												},
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
												class={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all shrink-0 border ${
													reportFilter() === f.id
														? 'bg-[#2990ff] border-[#2990ff] text-white shadow-[0_4px_12px_rgba(41,144,255,0.28)]'
														: 'bg-[#141a22] border-white/[0.08] text-[#8ca0b5] hover:text-white hover:border-white/15'
												}`}
											>
												<span class="material-symbols-outlined text-[13px]">{f.icon}</span>
												<span>{f.label}</span>
												<span
													class={`text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
														reportFilter() === f.id
															? 'bg-white/20 text-white font-bold'
															: 'bg-white/[0.06] text-[#8ca0b5]'
													}`}
												>
													{f.count}
												</span>
											</button>
										)}
									</For>
								</div>
							</Show>

							{/* Reports List */}
							<Show
								when={filteredReports().length > 0}
								fallback={
									<div class="py-8 text-center flex flex-col items-center gap-2">
										<span class="material-symbols-outlined text-[32px] text-[#738598]">
											{reportFilter() === 'username'
												? 'alternate_email'
												: reportFilter() === 'number'
													? 'dialpad'
													: reportFilter() === 'gift'
														? 'featured_seasonal_and_gifts'
														: 'search'}
										</span>
										<span class="text-[#8ca0b5] text-[12px] font-medium">
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
										<div class="flex items-center gap-2 mt-1 flex-wrap justify-center">
											<Show when={reportFilter() === 'all' || reportFilter() === 'username'}>
												<button
													type="button"
													onClick={() => navigate('/')}
													class="px-3 py-1.5 rounded-xl bg-[#2990ff]/15 border border-[#2990ff]/35 text-[#5aaeff] text-[11px] font-semibold active:scale-95"
												>
													{t('assets.searchUsername' as any) || 'Analyze Username'}
												</button>
											</Show>
											<Show when={reportFilter() === 'all' || reportFilter() === 'number'}>
												<button
													type="button"
													onClick={() => navigate('/numbers')}
													class="px-3 py-1.5 rounded-xl bg-[#ffb340]/15 border border-[#ffb340]/35 text-[#ffb340] text-[11px] font-semibold active:scale-95"
												>
													{t('numbers.title' as any) || 'Valuate Number (+888)'}
												</button>
											</Show>
											<Show when={reportFilter() === 'all' || reportFilter() === 'gift'}>
												<button
													type="button"
													onClick={() => navigate('/gifts')}
													class="px-3 py-1.5 rounded-xl bg-[#4cd964]/15 border border-[#4cd964]/35 text-[#4cd964] text-[11px] font-semibold active:scale-95"
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
												class="frag-inset w-full p-3 hover:border-white/[0.15] rounded-xl flex items-center justify-between gap-3 active:scale-[0.99] transition-all cursor-pointer group text-start"
											>
												<div class="flex items-center gap-3 min-w-0">
													{/* Icon per Vertical */}
													<Show when={type() === 'username'}>
														<div class="w-10 h-10 rounded-xl bg-[#2990ff]/12 border border-[#2990ff]/28 flex items-center justify-center text-[#5aaeff] font-bold text-[13px] shrink-0 font-mono">
															@{r.username.replace(/^@/, '').slice(0, 2).toUpperCase()}
														</div>
													</Show>
													<Show when={type() === 'number'}>
														<div class="w-10 h-10 rounded-xl bg-[#ffb340]/12 border border-[#ffb340]/28 flex items-center justify-center text-[#ffb340] shrink-0">
															<span class="material-symbols-outlined text-[20px]">dialpad</span>
														</div>
													</Show>
													<Show when={type() === 'gift'}>
														<div class="w-10 h-10 rounded-xl bg-[#4cd964]/12 border border-[#4cd964]/28 flex items-center justify-center text-[#4cd964] shrink-0">
															<span class="material-symbols-outlined text-[20px]">
																featured_seasonal_and_gifts
															</span>
														</div>
													</Show>

													<div class="flex flex-col min-w-0">
														<div class="flex items-center gap-1.5 min-w-0">
															<span
																dir="ltr"
																class="text-[13px] font-semibold text-white truncate font-mono"
															>
																{r.title ||
																	(type() === 'username'
																		? `@${r.username.replace(/^@/, '')}`
																		: r.identifier || r.username)}
															</span>
															<span
																class={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
																	type() === 'username'
																		? 'bg-[#2990ff]/12 text-[#5aaeff] border border-[#2990ff]/25'
																		: type() === 'number'
																			? 'bg-[#ffb340]/12 text-[#ffb340] border border-[#ffb340]/25'
																			: 'bg-[#4cd964]/12 text-[#4cd964] border border-[#4cd964]/25'
																}`}
															>
																{type() === 'username'
																	? 'Username'
																	: type() === 'number'
																		? '+888'
																		: 'Gift'}
															</span>
														</div>

														<div class="flex items-center gap-1.5 text-[11px] text-[#8ca0b5] tabular-nums">
															<span class="text-[#4cd964] font-semibold">
																{type() === 'username'
																	? `Score ${r.rarityScore}/100`
																	: `Confidence ${r.rarityScore}%`}
															</span>
															<Show when={r.valueEstimate}>
																<span>·</span>
																<span dir="ltr" class="text-[#5aaeff] font-semibold font-mono">
																	{r.valueEstimate}
																</span>
															</Show>
															<span>·</span>
															<span>{t('profile.certified')}</span>
														</div>
													</div>
												</div>

												<div class="flex items-center gap-2 shrink-0">
													<span class="material-symbols-outlined text-[18px] text-[#738598] group-hover:text-white group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:-scale-x-100 transition-all">
														chevron_right
													</span>
												</div>
											</button>
										);
									}}
								</For>
							</Show>
						</div>
					</Show>
				</div>
			</div>
		</Motion.div>
	);
};
