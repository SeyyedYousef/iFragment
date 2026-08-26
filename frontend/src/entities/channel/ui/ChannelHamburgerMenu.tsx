import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import createFocusTrap from 'solid-focus-trap';
import { type Component, createResource, For, Show } from 'solid-js';
import { isRtl, t } from '@/shared/i18n/index.js';
import { channelApi } from '../api/channelApi.js';

interface ChannelHamburgerMenuProps {
	isOpen: boolean;
	onClose: () => void;
	channelId: string;
	activeTab?: string;
}

export const ChannelHamburgerMenu: Component<ChannelHamburgerMenuProps> = (props) => {
	const navigate = useNavigate();
	const [channel] = createResource(
		() => props.channelId,
		(id) => channelApi.getChannel(id),
	);

	let containerRef!: HTMLDivElement;
	createFocusTrap({
		element: () => containerRef,
		enabled: () => props.isOpen,
	});

	const menuItems = () => [
		{
			id: 'dashboard',
			label: t('channel.menu.dashboard' as any) || 'Dashboard',
			path: `/channel/${props.channelId}/dashboard`,
			icon: '📊',
		},
		{
			id: 'health',
			label: t('channel.menu.health' as any) || 'Health & Audit',
			path: `/channel/${props.channelId}/health`,
			icon: '🩺',
		},
		{
			id: 'projects',
			label: t('channel.menu.projects' as any) || 'Projects',
			path: `/channel/${props.channelId}/projects`,
			icon: '⚡',
		},
		{
			id: 'general',
			label: t('channel.menu.generalSettings' as any) || 'General Settings',
			path: `/channel/${props.channelId}/general`,
			icon: '⚙️',
		},
		{
			id: 'posting',
			label: t('channel.menu.posting' as any) || 'AI & Posting',
			path: `/channel/${props.channelId}/posting`,
			icon: '📝',
		},
		{
			id: 'forwarding',
			label: t('channel.menu.forwarding' as any) || 'Auto Forwarding',
			path: `/channel/${props.channelId}/forwarding`,
			icon: '🔄',
		},
		{
			id: 'inline-buttons',
			label: t('channel.menu.inlineButtons' as any) || 'Inline Buttons',
			path: `/channel/${props.channelId}/inline-buttons`,
			icon: '🔘',
		},
		{
			id: 'auto-responder',
			label: t('channel.menu.autoResponder' as any) || 'Auto Responder',
			path: `/channel/${props.channelId}/auto-responder`,
			icon: '🤖',
		},
		{
			id: 'dynamic-bio',
			label: t('channel.menu.dynamicBio' as any) || 'Dynamic Bio',
			path: `/channel/${props.channelId}/dynamic-bio`,
			icon: '✨',
		},
		{
			id: 'members',
			label: t('channel.menu.members' as any) || 'Members Moderation',
			path: `/channel/${props.channelId}/members`,
			icon: '🛡️',
		},
		{
			id: 'admins',
			label: t('channel.menu.admins' as any) || 'Administrators',
			path: `/channel/${props.channelId}/admins`,
			icon: '👥',
		},
		{
			id: 'analytics',
			label: t('channel.menu.analytics' as any) || 'Analytics',
			path: `/channel/${props.channelId}/analytics`,
			icon: '📈',
		},
		{
			id: 'audit-log',
			label: t('channel.menu.auditLog' as any) || 'Audit Log',
			path: `/channel/${props.channelId}/audit-log`,
			icon: '📜',
		},
	];

	return (
		<Show when={props.isOpen}>
			<div class="fixed inset-0 z-50 overflow-hidden">
				<Motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
					class="absolute inset-0 bg-black/60 backdrop-blur-sm"
					onClick={props.onClose}
				/>
				<div class="absolute inset-y-0 right-0 max-w-full flex pl-10">
					<Motion.div
						ref={containerRef}
						initial={{ x: isRtl() ? -300 : 300 }}
						animate={{ x: 0 }}
						exit={{ x: isRtl() ? -300 : 300 }}
						transition={{ duration: 0.25, easing: [0.16, 1, 0.3, 1] }}
						class="w-screen max-w-xs bg-[#16171d] border-l border-white/10 flex flex-col shadow-2xl"
					>
						<div class="p-4 border-b border-white/10 flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div class="w-9 h-9 rounded-xl bg-[#3390ec]/20 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec] font-bold text-sm">
									{channel()?.title?.charAt(0) || 'C'}
								</div>
								<div>
									<h3 class="text-sm font-bold text-white leading-none truncate max-w-[140px]">
										{channel()?.title || t('channel.defaultTitle' as any)}
									</h3>
									<p class="text-[11px] text-white/40 mt-1 truncate max-w-[140px]">
										{channel()?.username ? `@${channel()?.username}` : `ID: ${props.channelId}`}
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={props.onClose}
								class="p-2 -mr-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
							>
								✕
							</button>
						</div>

						<nav class="flex-1 overflow-y-auto p-3 space-y-1">
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
											class={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
												isActive()
													? 'bg-[#3390ec] text-white font-bold shadow-lg shadow-[#3390ec]/20'
													: 'text-white/70 hover:text-white hover:bg-white/5'
											}`}
										>
											<span class="text-base">{item.icon}</span>
											<span>{item.label}</span>
										</button>
									);
								}}
							</For>
						</nav>

						<div class="p-4 border-t border-white/10">
							<button
								type="button"
								onClick={() => {
									props.onClose();
									navigate('/managed-channels');
								}}
								class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/80 transition-colors border border-white/5"
							>
								← {t('channel.backToChannels' as any)}
							</button>
						</div>
					</Motion.div>
				</div>
			</div>
		</Show>
	);
};
