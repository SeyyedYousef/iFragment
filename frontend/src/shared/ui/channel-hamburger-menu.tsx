import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import createFocusTrap from 'solid-focus-trap';
import { Component, createResource, For, Show } from 'solid-js';
import { channelApi } from '@/shared/api/channel-management.js';
import { isRtl, t } from '@/shared/i18n/index.js';

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
	const [settings] = createResource(
		() => props.channelId,
		(id) => channelApi.getSettings(id).catch(() => null),
	);

	let drawerRef: HTMLDivElement | undefined;

	createFocusTrap({
		element: () => drawerRef || null,
		enabled: () => props.isOpen,
	});

	const getFeatureStatus = (id: string): 'on' | 'off' | null => {
		const s = settings();
		if (!s) return null;
		switch (id) {
			case 'auto-responder': {
				let ar = s.auto_responder;
				if (typeof ar === 'string') try { ar = JSON.parse(ar); } catch { return null; }
				return ar?.enabled ? 'on' : 'off';
			}
			case 'dynamic-bio': {
				let db = s.dynamic_bio;
				if (typeof db === 'string') try { db = JSON.parse(db); } catch { return null; }
				return db?.enabled ? 'on' : 'off';
			}

			default:
				return null;
		}
	};

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
							<div class="mb-3 rounded-2xl border border-[#2a2a2a] bg-[#15161a] p-3 flex items-center gap-3">
								<div class="w-10 h-10 rounded-xl bg-[#24262d] border border-[#30323a] flex items-center justify-center shrink-0 text-[#32ade6] font-black">
									<Show
										when={!channel.loading}
										fallback={<span class="w-5 h-5 border-2 border-[#32ade6]/25 border-t-[#32ade6] rounded-full animate-spin" />}
									>
										{channel()?.chat_title?.charAt(0)?.toUpperCase() || 'C'}
									</Show>
								</div>
								<div class="flex flex-col min-w-0">
									<span class="text-[13px] font-black text-white truncate">
										{channel.loading ? 'Loading channel...' : channel()?.chat_title || props.channelId}
									</span>
									<span class="text-[11px] text-[#8e8e93] truncate" dir="ltr">
										{channel()?.chat_id ? `ID ${channel()?.chat_id}` : props.channelId}
										<Show when={channel()?.subscription_status}>
											{' '}· {channel()?.subscription_status}
										</Show>
									</span>
								</div>
							</div>
							<div class="flex flex-col gap-1">
								<For each={menuItems()}>
									{(item) => {
										const status = () => getFeatureStatus(item.id);
										return (
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
												<span class="text-[14px] font-bold flex-1 text-start">{item.label}</span>
												<Show when={status() !== null}>
													<span
														class={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border shrink-0 ${
															status() === 'on'
																? 'bg-[#34c759]/10 border-[#34c759]/25 text-[#34c759]'
																: 'bg-[#8e8e93]/10 border-[#8e8e93]/25 text-[#8e8e93]'
														}`}
													>
														{status() === 'on' ? 'ON' : 'OFF'}
													</span>
												</Show>
											</button>
										);
									}}
								</For>
							</div>
						</div>
					</div>
				</Motion.div>
			</div>
		</Show>
	);
};
