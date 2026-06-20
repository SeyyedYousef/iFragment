import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import createFocusTrap from 'solid-focus-trap';
import { Component, For, Show } from 'solid-js';
import { locale, t } from '@/shared/i18n/index.js';

const isRtl = () => locale() === 'fa';

interface HamburgerMenuProps {
	isOpen: boolean;
	onClose: () => void;
	groupId: string;
	activeTab?: string;
}

export const HamburgerMenu: Component<HamburgerMenuProps> = (props) => {
	const navigate = useNavigate();
	let drawerRef: HTMLDivElement | undefined;

	createFocusTrap({
		element: () => drawerRef || null,
		enabled: () => props.isOpen,
	});

	const menuItems = () => [
		{
			id: 'dashboard',
			icon: 'dashboard',
			label: t('groupDashboard.menuDashboard'),
			path: `/group/${props.groupId}`,
		},
		{
			id: 'general',
			icon: 'settings',
			label: t('groupDashboard.menuGeneral'),
			path: `/group/${props.groupId}/settings`,
		},
		{
			id: 'content',
			icon: 'gpp_bad',
			label: t('groupDashboard.menuContent'),
			path: `/group/${props.groupId}/content`,
		},
		{
			id: 'limits',
			icon: 'speed',
			label: t('groupDashboard.menuLimits'),
			path: `/group/${props.groupId}/limits`,
		},
		{
			id: 'quiet',
			icon: 'do_not_disturb_on',
			label: t('groupDashboard.menuQuiet'),
			path: `/group/${props.groupId}/quiet`,
		},
		{
			id: 'mandatory',
			icon: 'group_add',
			label: t('groupDashboard.menuMandatory'),
			path: `/group/${props.groupId}/mandatory`,
		},
		{
			id: 'custom',
			icon: 'edit_note',
			label: t('groupDashboard.menuCustom'),
			path: `/group/${props.groupId}/settings/custom-texts`,
		},
		{
			id: 'dynamic-bio',
			icon: 'badge',
			label: t('channelDynamicBio.title') || 'بیوگرافی زنده',
			path: `/group/${props.groupId}/dynamic-bio`,
		},
		{
			id: 'analytics',
			icon: 'analytics',
			label: t('groupDashboard.menuAnalytics'),
			path: `/group/${props.groupId}/analytics`,
		},
	];

	return (
		<Show when={props.isOpen}>
			<div
				class="fixed inset-0 z-[100] flex"
				style={{ 'justify-content': isRtl() ? 'flex-start' : 'flex-end' }}
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
					initial={{ x: isRtl() ? '-100%' : '100%' }}
					animate={{ x: 0 }}
					exit={{ x: isRtl() ? '-100%' : '100%' }}
					transition={{ duration: 0.3, easing: [0.25, 1, 0.5, 1] }}
					class={`w-[80%] max-w-[320px] h-full bg-[#1c1c1c] relative z-10 flex flex-col shadow-2xl ${isRtl() ? 'border-r border-[#2a2a2a]' : 'border-l border-[#2a2a2a]'}`}
				>
					<div ref={drawerRef} class="flex flex-col h-full">
						<div class="p-5 border-b border-[#2a2a2a] flex items-center justify-between bg-[#1c1c1c] sticky top-0 z-20">
							<h2 class="text-lg font-black text-white">{t('groupDashboard.menu')}</h2>
							<button
								onClick={props.onClose}
								class="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-on-surface-variant hover:text-white transition-colors"
								aria-label={t('common.close')}
							>
								<span class="material-symbols-outlined text-[20px]">close</span>
							</button>
						</div>

						<div class="flex-1 overflow-y-auto no-scrollbar p-3 pb-8">
							<div class="flex flex-col gap-1">
								<For each={menuItems()}>
									{(item) => (
										<button
											onClick={() => {
												props.onClose();
												navigate(item.path, { replace: props.activeTab !== 'dashboard' });
											}}
											class={`flex items-center gap-3 p-3.5 rounded-2xl transition-colors w-full ${
												props.activeTab === item.id
													? 'bg-[#3390ec]/10 text-[#3390ec]'
													: 'text-white hover:bg-[#2a2a2a]'
											}`}
										>
											<span class="material-symbols-outlined text-[22px] opacity-80">
												{item.icon}
											</span>
											<span class="text-[14px] font-bold">{item.label}</span>
										</button>
									)}
								</For>
							</div>
						</div>
					</div>
				</Motion.div>
			</div>
		</Show>
	);
};
