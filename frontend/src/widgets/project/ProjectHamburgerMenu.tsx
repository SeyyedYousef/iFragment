import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import createFocusTrap from 'solid-focus-trap';
import { type Component, createResource, For, Show } from 'solid-js';
import { channelApi } from '@/entities/channel/index.js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

interface ProjectHamburgerMenuProps {
	isOpen: boolean;
	onClose: () => void;
	projectId: string;
	activeTab?: string;
}

export const ProjectHamburgerMenu: Component<ProjectHamburgerMenuProps> = (props) => {
	const navigate = useNavigate();

	const [project] = createResource(
		() => props.projectId,
		(id) => channelApi.getProject(id),
	);

	let drawerRef: HTMLDivElement | undefined;
	createFocusTrap({
		element: () => drawerRef || null,
		enabled: () => props.isOpen,
	});

	const isRtlLang = () => isRtl();

	const config = () => (project()?.pipeline_config as any) || {};

	const statusDot = (enabled: boolean) =>
		enabled
			? 'w-2 h-2 rounded-full bg-emerald-400 shrink-0'
			: 'w-2 h-2 rounded-full bg-white/20 shrink-0';

	const menuSections = () => [
		{
			title: t('channelProjects.nav.dashboard'),
			items: [
				{
					id: 'dashboard',
					icon: 'dashboard',
					label: t('channelProjects.nav.dashboard'),
					path: `/projects/${props.projectId}`,
				},
			],
		},
		{
			title: t('channelProjects.dashboard.featuresTitle'),
			items: [
				{
					id: 'bio',
					icon: 'badge',
					label: t('channelProjects.dashboard.featureBio'),
					path: `/projects/${props.projectId}/pipeline?tab=bio`,
					enabled: !!config()?.dynamic_bio?.enabled,
				},
				{
					id: 'responder',
					icon: 'quickreply',
					label: t('channelProjects.dashboard.featureResponder'),
					path: `/projects/${props.projectId}/pipeline?tab=responder`,
					enabled: !!config()?.auto_responder?.enabled,
				},
				{
					id: 'buttons',
					icon: 'smart_button',
					label: t('channelProjects.dashboard.featureButtons'),
					path: `/projects/${props.projectId}/pipeline?tab=buttons`,
					enabled: !!config()?.inline_buttons?.enabled,
				},
				{
					id: 'ai',
					icon: 'psychology',
					label: t('channelProjects.dashboard.featureAi'),
					path: `/projects/${props.projectId}/pipeline?tab=ai`,
					enabled: !!config()?.ai_rewrite,
				},
				{
					id: 'pipeline',
					icon: 'tune',
					label: t('channelProjects.dashboard.featurePipeline'),
					path: `/projects/${props.projectId}/pipeline?tab=pipeline`,
					enabled: !!config()?.auto_publish,
				},
				{
					id: 'join',
					icon: 'shield',
					label: t('channelProjects.dashboard.featureJoin'),
					path: `/projects/${props.projectId}/pipeline?tab=join`,
					enabled: !!config()?.join_requests?.enabled,
				},
			],
		},
		{
			title: null,
			items: [
				{
					id: 'inbox',
					icon: 'inbox',
					label: t('channelProjects.nav.inbox'),
					path: `/projects/${props.projectId}/inbox`,
				},
				{
					id: 'deliveries',
					icon: 'local_shipping',
					label: t('channelProjects.nav.deliveries'),
					path: `/projects/${props.projectId}/deliveries`,
				},
				{
					id: 'team',
					icon: 'groups',
					label: t('channelProjects.nav.team'),
					path: `/projects/${props.projectId}/team`,
				},
				{
					id: 'settings',
					icon: 'settings',
					label: t('channelProjects.nav.settings'),
					path: `/projects/${props.projectId}/settings`,
				},
			],
		},
	];

	return (
		<Show when={props.isOpen}>
			<div
				class="fixed inset-0 z-[100] flex"
				style={{ 'justify-content': isRtlLang() ? 'flex-start' : 'flex-end' }}
			>
				{/* Overlay */}
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					class="absolute inset-0 bg-black/60 backdrop-blur-sm"
					onClick={props.onClose}
				/>

				{/* Drawer */}
				<Motion.div
					initial={{ x: isRtlLang() ? '-100%' : '100%' }}
					animate={{ x: 0 }}
					exit={{ x: isRtlLang() ? '-100%' : '100%' }}
					transition={{ duration: 0.3, easing: [0.25, 1, 0.5, 1] }}
					class={`w-[82%] max-w-[320px] h-full bg-[#12141C] relative z-10 flex flex-col shadow-2xl ${
						isRtlLang() ? 'border-r border-white/10' : 'border-l border-white/10'
					}`}
				>
					<div ref={drawerRef} class="flex flex-col h-full">
						{/* ═══════ HEADER ═══════ */}
						<div class="p-4 border-b border-white/10 flex items-center justify-between bg-[#12141C] sticky top-0 z-20">
							<div class="flex items-center gap-3 min-w-0">
								<div class="w-10 h-10 rounded-[14px] bg-[#3390ec]/20 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec] font-black text-sm shrink-0">
									<span class="material-symbols-outlined text-[20px]">hub</span>
								</div>
								<div class="flex flex-col min-w-0">
									<h2 class="text-[14px] font-black text-white leading-tight truncate">
										{project()?.name || t('channelProjects.context.defaultName')}
									</h2>
									<p class="text-[11px] text-white/40 mt-0.5 truncate font-mono" dir="ltr">
										ID: {props.projectId.slice(0, 8)}
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={props.onClose}
								class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition-colors shrink-0"
								aria-label={t('common.close')}
							>
								<span class="material-symbols-outlined text-[20px]">close</span>
							</button>
						</div>

						{/* ═══════ MENU SECTIONS ═══════ */}
						<div class="flex-1 overflow-y-auto no-scrollbar p-3 flex flex-col gap-4">
							<For each={menuSections()}>
								{(section) => (
									<div class="flex flex-col gap-1">
										{/* Section Title */}
										<Show when={section.title}>
											<div class="px-2 pt-2 pb-1">
												<span class="text-[10px] font-black text-white/30 uppercase tracking-widest">
													{section.title}
												</span>
											</div>
										</Show>

										{/* Items */}
										<For each={section.items}>
											{(item) => {
												const isActive = () => props.activeTab === item.id;
												return (
													<button
														type="button"
														onClick={() => {
															haptic.impact('light');
															props.onClose();
															navigate(item.path, { replace: props.activeTab !== 'dashboard' });
														}}
														class={`flex items-center gap-3 px-3.5 py-3 rounded-[16px] transition-all w-full ${
															isActive()
																? 'bg-[#3390ec]/15 text-[#3390ec]'
																: 'text-white/80 hover:bg-white/5 hover:text-white'
														}`}
													>
														<span
															class={`material-symbols-outlined text-[22px] ${
																isActive() ? 'text-[#3390ec]' : 'opacity-70'
															}`}
														>
															{item.icon}
														</span>
														<span class="text-[13px] font-bold flex-1 text-start truncate">
															{item.label}
														</span>
														{/* Feature status dot */}
														<Show when={'enabled' in item}>
															<span class={statusDot((item as any).enabled)} />
														</Show>
													</button>
												);
											}}
										</For>
									</div>
								)}
							</For>
						</div>

						{/* ═══════ FOOTER ═══════ */}
						<div class="p-3 border-t border-white/10 bg-[#12141C] sticky bottom-0 flex flex-col gap-2">
							<button
								type="button"
								onClick={() => {
									haptic.impact('light');
									props.onClose();
									navigate('/projects');
								}}
								class="w-full flex items-center justify-center gap-2 p-3 rounded-[14px] bg-white/5 hover:bg-white/10 text-[12px] font-bold text-white/50 hover:text-white transition-all"
							>
								<span class="material-symbols-outlined text-[18px] rtl:rotate-180">arrow_back</span>
								<span>{t('channelProjects.nav.allProjects')}</span>
							</button>
							<button
								type="button"
								onClick={() => {
									haptic.impact('light');
									props.onClose();
									navigate('/dashboard');
								}}
								class="w-full flex items-center justify-center gap-2 p-3 rounded-[14px] bg-white/5 hover:bg-white/10 text-[12px] font-bold text-white/50 hover:text-white transition-all"
							>
								<span class="material-symbols-outlined text-[18px] rtl:rotate-180">home</span>
								<span>{t('channelProjects.nav.backToMain')}</span>
							</button>
						</div>
					</div>
				</Motion.div>
			</div>
		</Show>
	);
};
