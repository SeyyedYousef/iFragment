import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import createFocusTrap from 'solid-focus-trap';
import { Component, For, Show } from 'solid-js';
import { locale, t } from '@/shared/i18n/index.js';

const isRtl = () => locale() === 'fa';

interface ChannelHamburgerMenuProps {
	isOpen: boolean;
	onClose: () => void;
	channelId: string;
	activeTab?: string;
}

export const ChannelHamburgerMenu: Component<ChannelHamburgerMenuProps> = (props) => {
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
			label: t('channelMenu.dashboard'),
			path: `/channel/${props.channelId}`,
		},
		{
			id: 'general',
			icon: 'settings',
			label: t('channelMenu.generalSettings'),
			path: `/channel/${props.channelId}/settings`,
		},
		{
			id: 'posting',
			icon: 'smart_toy',
			label: t('channelMenu.autoPosting'),
			path: `/channel/${props.channelId}/posting`,
		},
		{
			id: 'funnel',
			icon: 'filter_alt',
			label: 'Funnel Settings',
			path: `/channel/${props.channelId}/funnel`,
		},
		{
			id: 'inline-buttons',
			icon: 'smart_button',
			label: t('channelMenu.inlineButtons'),
			path: `/channel/${props.channelId}/inline-buttons`,
		},
		{
			id: 'forwarding',
			icon: 'call_split',
			label: t('channelMenu.autoForward'),
			path: `/channel/${props.channelId}/forwarding`,
		},
		{
			id: 'dynamic-bio',
			icon: 'history_edu',
			label: t('channelMenu.dynamicBio'),
			path: `/channel/${props.channelId}/dynamic-bio`,
		},
		{
			id: 'auto-responder',
			icon: 'quickreply',
			label: t('channelMenu.autoResponder'),
			path: `/channel/${props.channelId}/auto-responder`,
		},
		{
			id: 'admins',
			icon: 'admin_panel_settings',
			label: t('channelMenu.admins'),
			path: `/channel/${props.channelId}/admins`,
		},
		{
			id: 'analytics',
			icon: 'monitoring',
			label: t('channelMenu.analytics'),
			path: `/channel/${props.channelId}/analytics`,
		},
		{
			id: 'audit-log',
			icon: 'manage_search',
			label: t('channelMenu.auditLog'),
			path: `/channel/${props.channelId}/audit-log`,
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
							<h2 class="text-lg font-black text-white">{t('channelMenu.title')}</h2>
							<button
								onClick={props.onClose}
								class="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-on-surface-variant hover:text-white transition-colors"
								aria-label="Close menu"
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
												navigate(item.path);
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
