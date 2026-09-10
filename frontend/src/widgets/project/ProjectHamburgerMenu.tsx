import { useNavigate } from '@solidjs/router';
import createFocusTrap from 'solid-focus-trap';
import { type Component, createResource, For, Show } from 'solid-js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { channelApi } from '@/entities/channel/index.js';

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

	const menuItems = () => [
		{
			id: 'dashboard',
			icon: 'dashboard',
			label: t('channelProjects.nav.dashboard'),
			path: `/projects/${props.projectId}`,
		},
		{
			id: 'inbox',
			icon: 'inbox',
			label: t('channelProjects.nav.inbox'),
			path: `/projects/${props.projectId}/inbox`,
		},
		{
			id: 'pipeline',
			icon: 'tune',
			label: t('channelProjects.nav.pipeline'),
			path: `/projects/${props.projectId}/pipeline`,
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
		{
			id: 'all_projects',
			icon: 'hub',
			label: t('channelProjects.nav.allProjects'),
			path: `/projects`,
		},
	];

	return (
		<Show when={props.isOpen}>
			<div
				class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
				onClick={props.onClose}
				aria-hidden="true"
			/>
			<div
				ref={drawerRef}
				class={`fixed top-0 bottom-0 z-50 w-72 bg-[#12141C] border-r border-white/10 p-5 flex flex-col justify-between shadow-2xl transition-transform ${
					isRtl() ? 'right-0 border-l border-r-0' : 'left-0 border-r border-l-0'
				}`}
				tabIndex={-1}
			>
				<div class="flex flex-col gap-6">
					{/* Header */}
					<div class="flex items-center justify-between pb-4 border-b border-white/10">
						<div class="flex items-center gap-2.5 min-w-0">
							<div class="w-9 h-9 rounded-[12px] bg-[#3390ec]/20 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec] shrink-0">
								<span class="material-symbols-outlined text-[20px]">hub</span>
							</div>
							<div class="flex flex-col min-w-0">
								<span class="text-[14px] font-black text-white truncate">
									{project()?.name || t('channelProjects.context.defaultName')}
								</span>
								<span class="text-[10px] text-white/40 font-mono">
									ID: {props.projectId.slice(0, 8)}
								</span>
							</div>
						</div>
						<button
							type="button"
							onClick={props.onClose}
							class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white"
						>
							<span class="material-symbols-outlined text-[18px]">close</span>
						</button>
					</div>

					{/* Navigation links */}
					<nav class="flex flex-col gap-1.5">
						<For each={menuItems()}>
							{(item) => {
								const isActive = () => props.activeTab === item.id;
								return (
									<button
										type="button"
										onClick={() => {
											props.onClose();
											navigate(item.path);
										}}
										class={`w-full h-11 px-3.5 rounded-[14px] text-[13px] font-bold flex items-center gap-3 transition-all ${
											isActive()
												? 'bg-[#3390ec] text-white shadow-md'
												: 'text-white/70 hover:bg-white/5 hover:text-white'
										}`}
									>
										<span class="material-symbols-outlined text-[20px]">{item.icon}</span>
										<span class="truncate">{item.label}</span>
									</button>
								);
							}}
						</For>
					</nav>
				</div>

				<div class="pt-4 border-t border-white/10 flex flex-col gap-2">
					<button
						type="button"
						onClick={() => {
							props.onClose();
							navigate('/dashboard');
						}}
						class="w-full h-10 rounded-[12px] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[12px] font-bold flex items-center justify-center gap-2"
					>
						<span class="material-symbols-outlined text-[18px]">arrow_back</span>
						<span>{t('channelProjects.nav.backToMain')}</span>
					</button>
				</div>
			</div>
		</Show>
	);
};
