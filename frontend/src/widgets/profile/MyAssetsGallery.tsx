import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { type Component, createSignal, For, Show } from 'solid-js';
import { getMyAssets, type MyAssetsResponse } from '@/entities/user/index.js';
import { formatNumber, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface Props {
	onClose?: () => void;
}

type AssetTab = 'reports' | 'properties' | 'projects' | 'boosters';

export const MyAssetsGallery: Component<Props> = (props) => {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = createSignal<AssetTab>('reports');
	const [reportNotifs, setReportNotifs] = createSignal<Record<string, boolean>>({});

	const assetsQuery = createQuery(() => ({
		queryKey: ['profile', 'assets'],
		queryFn: getMyAssets,
		staleTime: 15_000,
	}));

	const assets = () => assetsQuery.data as MyAssetsResponse | undefined;
	const loading = () => assetsQuery.isLoading;

	const handleTabChange = (tab: AssetTab) => {
		try {
			haptic.selection();
		} catch {}
		setActiveTab(tab);
	};

	const handleToggleReportNotif = (username: string, e: Event) => {
		e.stopPropagation();
		try {
			haptic.impact('light');
		} catch {}
		setReportNotifs((prev) => ({
			...prev,
			[username]: prev[username] === undefined ? false : !prev[username],
		}));
	};

	return (
		<Motion.div
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.1 }}
			class="w-full relative select-none"
		>
			<div class="bg-[#0D1017]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col gap-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
				{/* Section Header */}
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2.5">
						<div class="w-9 h-9 rounded-[12px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
							<span
								class="material-symbols-outlined text-[20px]"
								style={{ 'font-variation-settings': '"FILL" 1' }}
							>
								inventory_2
							</span>
						</div>
						<div class="flex flex-col">
							<span class="text-[14px] font-black text-white tracking-tight">
								{t('assets.title' as any) || 'My Assets Gallery'}
							</span>
							<span class="text-[10px] font-bold text-white/40 uppercase tracking-wider">
								{assets()?.summaryText ||
									t('assets.subtitle' as any) ||
									'Reports, channels, projects & boosters'}
							</span>
						</div>
					</div>
					<Show when={props.onClose}>
						<button
							type="button"
							onClick={props.onClose}
							class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 active:scale-95"
						>
							<span class="material-symbols-outlined text-[18px]">close</span>
						</button>
					</Show>
				</div>

				{/* 4 Tabs */}
				<div class="grid grid-cols-4 gap-1.5 p-1 bg-[#07090E] border border-white/5 rounded-[16px]">
					<For
						each={
							[
								{
									id: 'reports',
									label: t('assets.reports' as any) || 'Reports',
									icon: 'description',
								},
								{
									id: 'properties',
									label: t('assets.properties' as any) || 'Properties',
									icon: 'hub',
								},
								{ id: 'projects', label: t('assets.projects' as any) || 'Projects', icon: 'route' },
								{
									id: 'boosters',
									label: t('assets.boosters' as any) || 'Boosters',
									icon: 'rocket_launch',
								},
							] as const
						}
					>
						{(tab) => (
							<button
								type="button"
								onClick={() => handleTabChange(tab.id as AssetTab)}
								class={`py-2 rounded-[12px] flex flex-col items-center gap-1 transition-all active:scale-95 border ${
									activeTab() === tab.id
										? 'bg-[#0098EA]/20 border-[#0098EA]/40 text-[#0098EA] shadow-sm'
										: 'border-transparent text-white/50 hover:text-white/80'
								}`}
							>
								<span class="material-symbols-outlined text-[16px]">{tab.icon}</span>
								<span class="text-[10px] font-black tracking-tight line-clamp-1">{tab.label}</span>
							</button>
						)}
					</For>
				</div>

				{/* Tab Content */}
				<div class="min-h-[160px]">
					<Show
						when={!loading()}
						fallback={
							<div class="flex flex-col gap-2 py-4 animate-pulse">
								<div class="h-12 bg-white/5 rounded-[16px]" />
								<div class="h-12 bg-white/5 rounded-[16px]" />
							</div>
						}
					>
						{/* ═══════ TAB 1: REPORTS ═══════ */}
						<Show when={activeTab() === 'reports'}>
							<div class="flex flex-col gap-2">
								<Show
									when={(assets()?.reports || []).length > 0}
									fallback={
										<div class="py-8 text-center flex flex-col items-center gap-2">
											<span class="material-symbols-outlined text-[32px] text-white/20">
												search
											</span>
											<span class="text-white/40 text-[11px] font-bold">
												{t('assets.noReports' as any) || 'No valuation reports purchased yet.'}
											</span>
											<button
												type="button"
												onClick={() => navigate('/')}
												class="px-4 py-1.5 rounded-[10px] bg-[#0098EA]/20 border border-[#0098EA]/40 text-[#0098EA] text-[10px] font-black uppercase tracking-wider"
											>
												{t('assets.searchUsername' as any) || 'Analyze Username'}
											</button>
										</div>
									}
								>
									<For each={assets()?.reports || []}>
										{(r) => (
											<div
												role="button"
												tabIndex={0}
												onKeyDown={(e) => {
													if (e.key === 'Enter') navigate(r.certificateUrl);
												}}
												onClick={() => navigate(r.certificateUrl)}
												class="p-3 bg-[#07090E] border border-white/5 hover:border-white/15 rounded-[18px] flex items-center justify-between gap-3 active:scale-[0.99] transition-all cursor-pointer group"
											>
												<div class="flex items-center gap-3 min-w-0">
													<div class="w-10 h-10 rounded-[12px] bg-[#0098EA]/15 border border-[#0098EA]/30 flex items-center justify-center text-[#0098EA] font-black text-[13px] shrink-0 font-mono">
														@{r.username.slice(0, 2).toUpperCase()}
													</div>
													<div class="flex flex-col min-w-0">
														<span class="text-[13px] font-black text-white truncate font-mono">
															@{r.username}
														</span>
														<div class="flex items-center gap-1.5 text-[10px] text-white/40">
															<span class="text-emerald-400 font-bold">
																Score {r.rarityScore}/100
															</span>
															<span>•</span>
															<span>{t('profile.certified')}</span>
														</div>
													</div>
												</div>

												<div class="flex items-center gap-2">
													{/* Notification Toggle (Strictly permitted on purchased reports!) */}
													<button
														type="button"
														onClick={(e) => handleToggleReportNotif(r.username, e)}
														class={`p-2 rounded-[10px] border transition-all ${
															reportNotifs()[r.username] !== false
																? 'bg-amber-400/15 border-amber-400/30 text-amber-400'
																: 'bg-white/5 border-white/10 text-white/40'
														}`}
														title={t('profile.priceAlertNotifications')}
													>
														<span class="material-symbols-outlined text-[16px]">
															{reportNotifs()[r.username] !== false
																? 'notifications_active'
																: 'notifications_off'}
														</span>
													</button>

													<span class="material-symbols-outlined text-[18px] text-white/40 group-hover:text-white group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-all">
														chevron_right
													</span>
												</div>
											</div>
										)}
									</For>
								</Show>
							</div>
						</Show>

						{/* ═══════ TAB 2: CONNECTED PROPERTIES ═══════ */}
						<Show when={activeTab() === 'properties'}>
							<div class="flex flex-col gap-2">
								<Show
									when={(assets()?.properties || []).length > 0}
									fallback={
										<div class="py-8 text-center flex flex-col items-center gap-2">
											<span class="material-symbols-outlined text-[32px] text-white/20">
												campaign
											</span>
											<span class="text-white/40 text-[11px] font-bold">
												{t('assets.noProperties' as any) || 'No connected channels or groups yet.'}
											</span>
											<button
												type="button"
												onClick={() => navigate('/managed-channels')}
												class="px-4 py-1.5 rounded-[10px] bg-[#0098EA]/20 border border-[#0098EA]/40 text-[#0098EA] text-[10px] font-black uppercase tracking-wider"
											>
												{t('assets.connectChannel' as any) || 'Connect Channel'}
											</button>
										</div>
									}
								>
									<For each={assets()?.properties || []}>
										{(p) => (
											<div
												role="button"
												tabIndex={0}
												onKeyDown={(e) => {
													if (e.key === 'Enter') navigate(p.dashboardUrl);
												}}
												onClick={() => navigate(p.dashboardUrl)}
												class="p-3 bg-[#07090E] border border-white/5 hover:border-white/15 rounded-[18px] flex items-center justify-between gap-3 active:scale-[0.99] transition-all cursor-pointer group"
											>
												<div class="flex items-center gap-3 min-w-0">
													<div class="w-10 h-10 rounded-[12px] bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
														<span class="material-symbols-outlined text-[20px]">
															{p.type === 'channel' ? 'campaign' : 'groups'}
														</span>
													</div>
													<div class="flex flex-col min-w-0">
														<span class="text-[13px] font-black text-white truncate">
															{p.title || p.username}
														</span>
														<div class="flex items-center gap-1.5 text-[10px] text-white/40">
															<span class="text-white/60 font-bold capitalize">{p.type}</span>
															<span>•</span>
															<span>{formatNumber(p.memberCount)} members</span>
														</div>
													</div>
												</div>

												<div class="flex items-center gap-2">
													<Show when={p.daysLeft > 0}>
														<span class="text-[9px] px-2 py-0.5 rounded-[8px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-black">
															{p.daysLeft}d Pro
														</span>
													</Show>
													<span class="material-symbols-outlined text-[18px] text-white/40 group-hover:text-white group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-all">
														chevron_right
													</span>
												</div>
											</div>
										)}
									</For>
								</Show>
							</div>
						</Show>

						{/* ═══════ TAB 3: PROJECTS ═══════ */}
						<Show when={activeTab() === 'projects'}>
							<div class="flex flex-col gap-2">
								<Show
									when={(assets()?.projects || []).length > 0}
									fallback={
										<div class="py-8 text-center flex flex-col items-center gap-2">
											<span class="material-symbols-outlined text-[32px] text-white/20">route</span>
											<span class="text-white/40 text-[11px] font-bold">
												{t('assets.noProjects' as any) || 'No automation projects configured.'}
											</span>
											<button
												type="button"
												onClick={() => navigate('/managed-channels')}
												class="px-4 py-1.5 rounded-[10px] bg-[#0098EA]/20 border border-[#0098EA]/40 text-[#0098EA] text-[10px] font-black uppercase tracking-wider"
											>
												{t('assets.createProject' as any) || 'Create Project'}
											</button>
										</div>
									}
								>
									<For each={assets()?.projects || []}>
										{(pj) => (
											<div class="p-3.5 bg-[#07090E] border border-white/5 rounded-[18px] flex flex-col gap-2.5">
												<div class="flex items-center justify-between">
													<span class="text-[13px] font-black text-white tracking-tight">
														{pj.name}
													</span>
													<span
														class={`text-[9px] px-2 py-0.5 rounded-[8px] font-black uppercase ${
															pj.status === 'active'
																? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
																: 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
														}`}
													>
														{pj.status}
													</span>
												</div>

												{/* Visual Route Path */}
												<div class="flex items-center gap-2 text-[11px] bg-white/5 p-2 rounded-[12px] font-mono">
													<span class="text-white/80 truncate max-w-[120px]">
														{pj.sourceChatTitle || 'Source'}
													</span>
													<span class="material-symbols-outlined text-[14px] text-[#0098EA] shrink-0">
														arrow_forward
													</span>
													<span class="text-white/80 truncate max-w-[120px]">
														{pj.targetChatTitle || 'Target'}
													</span>
												</div>

												<div class="flex items-center justify-between text-[10px] text-white/40 pt-0.5">
													<span>
														{pj.daysLeft > 0
															? `${pj.daysLeft} ${t('botManage.daysLeft') || 'days remaining'}`
															: (t('botManage.expired') || 'Subscription Expired')}
													</span>
													<button
														type="button"
														onClick={() => navigate('/managed-channels')}
														class="text-[#0098EA] font-black uppercase tracking-wider hover:underline"
													>
														{t('botManage.manage') || 'Manage'}
													</button>
												</div>
											</div>
										)}
									</For>
								</Show>
							</div>
						</Show>

						{/* ═══════ TAB 4: BOOSTERS ═══════ */}
						<Show when={activeTab() === 'boosters'}>
							<div class="flex flex-col gap-2.5">
								{/* MultiTap */}
								<div class="p-3 bg-[#07090E] border border-white/5 rounded-[18px] flex items-center justify-between gap-3">
									<div class="flex items-center gap-3">
										<div class="w-10 h-10 rounded-[12px] bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
											<span class="material-symbols-outlined text-[20px]">touch_app</span>
										</div>
										<div class="flex flex-col">
											<span class="text-[13px] font-black text-white">Multi-Tap</span>
											<span class="text-[10px] text-white/40">
												Level {assets()?.boosters.multitapLevel || 1} (+
												{assets()?.boosters.multitapLevel || 1} per tap)
											</span>
										</div>
									</div>
									<button
										type="button"
										onClick={() => navigate('/airdrop?tab=boost')}
										class="px-3 py-1.5 rounded-[10px] bg-amber-400/15 border border-amber-400/30 text-amber-400 text-[10px] font-black uppercase tracking-wider active:scale-95"
									>
										{t('profile.upgrade')}
									</button>
								</div>

								{/* Energy Limit */}
								<div class="p-3 bg-[#07090E] border border-white/5 rounded-[18px] flex items-center justify-between gap-3">
									<div class="flex items-center gap-3">
										<div class="w-10 h-10 rounded-[12px] bg-cyan-400/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0">
											<span class="material-symbols-outlined text-[20px]">bolt</span>
										</div>
										<div class="flex flex-col">
											<span class="text-[13px] font-black text-white">{t('profile.energyCapacity')}</span>
											<span class="text-[10px] text-white/40">
												Level {assets()?.boosters.energyLimitLevel || 1} (
												{500 + ((assets()?.boosters.energyLimitLevel || 1) - 1) * 250} max)
											</span>
										</div>
									</div>
									<button
										type="button"
										onClick={() => navigate('/airdrop?tab=boost')}
										class="px-3 py-1.5 rounded-[10px] bg-cyan-400/15 border border-cyan-400/30 text-cyan-400 text-[10px] font-black uppercase tracking-wider active:scale-95"
									>
										{t('profile.upgrade')}
									</button>
								</div>

								{/* Tap-Bot */}
								<div class="p-3 bg-[#07090E] border border-white/5 rounded-[18px] flex items-center justify-between gap-3">
									<div class="flex items-center gap-3">
										<div class="w-10 h-10 rounded-[12px] bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
											<span class="material-symbols-outlined text-[20px]">smart_toy</span>
										</div>
										<div class="flex flex-col">
											<span class="text-[13px] font-black text-white">{t('profile.autoTapBot')}</span>
											<span class="text-[10px] text-white/40">
												{assets()?.boosters.tapBotLevel
													? 'Active (12h Offline Mining)'
													: 'Not Activated'}
											</span>
										</div>
									</div>
									<button
										type="button"
										onClick={() => navigate('/airdrop?tab=boost')}
										class="px-3 py-1.5 rounded-[10px] bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider active:scale-95"
									>
										{assets()?.boosters.tapBotLevel ? 'Active' : 'Unlock'}
									</button>
								</div>
							</div>
						</Show>
					</Show>
				</div>
			</div>
		</Motion.div>
	);
};
