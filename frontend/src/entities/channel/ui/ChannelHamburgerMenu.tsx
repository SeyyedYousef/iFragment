import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router';
import createFocusTrap from 'solid-focus-trap';
import { type Component, createResource, For, Show } from 'solid-js';
import { isRtl, locale, t } from '@/shared/i18n/index.js';
import { channelApi } from '../api/channelApi.js';

interface ChannelHamburgerMenuProps {
	isOpen: boolean;
	onClose: () => void;
	channelId: string;
	activeTab?: string;
}

export const ChannelHamburgerMenu: Component<ChannelHamburgerMenuProps> = (props) => {
	const navigate = useNavigate();
	const isRtlLang = () => (typeof isRtl === 'function' ? isRtl() : locale() === 'fa');

	const [channel] = createResource(
		() => props.channelId,
		(id) => channelApi.getChannel(id),
	);

	let drawerRef: HTMLDivElement | undefined;
	createFocusTrap({
		element: () => drawerRef || null,
		enabled: () => props.isOpen,
	});

	const channelTitle = () =>
		channel()?.chat_title ||
		(channel() as any)?.title ||
		t('channel.defaultTitle' as any) ||
		'کانال من';

	const channelUsername = () =>
		channel()?.chat_username || (channel() as any)?.username;

	const menuItems = () => [
		{
			id: 'dashboard',
			icon: 'dashboard',
			label: t('channel.menu.dashboard' as any) || 'داشبورد',
			path: `/channel/${props.channelId}/dashboard`,
		},
		{
			id: 'projects',
			icon: 'bolt',
			label: t('channel.menu.projects' as any) || 'پروژه‌ها',
			path: `/channel/${props.channelId}/projects`,
		},
		{
			id: 'general',
			icon: 'settings',
			label: t('channel.menu.generalSettings' as any) || 'تنظیمات عمومی',
			path: `/channel/${props.channelId}/general`,
		},
		{
			id: 'posting',
			icon: 'smart_toy',
			label: t('channel.menu.posting' as any) || 'ارسال هوشمند و AI',
			path: `/channel/${props.channelId}/posting`,
		},
		{
			id: 'forwarding',
			icon: 'sync_alt',
			label: t('channel.menu.forwarding' as any) || 'فوروارد خودکار و وبهوک',
			path: `/channel/${props.channelId}/forwarding`,
		},
		{
			id: 'inline-buttons',
			icon: 'smart_button',
			label: t('channel.menu.inlineButtons' as any) || 'دکمه‌های شیشه‌ای',
			path: `/channel/${props.channelId}/inline-buttons`,
		},
		{
			id: 'auto-responder',
			icon: 'chat',
			label: t('channel.menu.autoResponder' as any) || 'پاسخگوی خودکار',
			path: `/channel/${props.channelId}/auto-responder`,
		},
		{
			id: 'dynamic-bio',
			icon: 'badge',
			label: t('channel.menu.dynamicBio' as any) || 'بیوی پویا',
			path: `/channel/${props.channelId}/dynamic-bio`,
		},
		{
			id: 'members',
			icon: 'shield_person',
			label: t('channel.menu.members' as any) || 'مدیریت اعضا',
			path: `/channel/${props.channelId}/members`,
		},
		{
			id: 'admins',
			icon: 'admin_panel_settings',
			label: t('channel.menu.admins' as any) || 'مدیران',
			path: `/channel/${props.channelId}/admins`,
		},
		{
			id: 'analytics',
			icon: 'analytics',
			label: t('channel.menu.analytics' as any) || 'آمار و تحلیل',
			path: `/channel/${props.channelId}/analytics`,
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
					class={`w-[82%] max-w-[320px] h-full bg-[#1c1c1c] relative z-10 flex flex-col shadow-2xl ${
						isRtlLang() ? 'border-r border-[#2a2a2a]' : 'border-l border-[#2a2a2a]'
					}`}
				>
					<div ref={drawerRef} class="flex flex-col h-full">
						{/* Header */}
						<div class="p-4 border-b border-[#2a2a2a] flex items-center justify-between bg-[#1c1c1c] sticky top-0 z-20">
							<div class="flex items-center gap-3 min-w-0">
								<div class="w-10 h-10 rounded-xl bg-[#3390ec]/20 border border-[#3390ec]/30 flex items-center justify-center text-[#3390ec] font-black text-sm shrink-0">
									{channelTitle().charAt(0).toUpperCase()}
								</div>
								<div class="flex flex-col min-w-0">
									<h2 class="text-[14px] font-black text-white leading-tight truncate">
										{channelTitle()}
									</h2>
									<p class="text-[11px] text-[#8e8e93] mt-0.5 truncate font-mono" dir="ltr">
										{channelUsername() ? `@${channelUsername()}` : `ID: ${props.channelId}`}
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={props.onClose}
								class="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[#8e8e93] hover:text-white transition-colors shrink-0"
								aria-label={t('common.close')}
							>
								<span class="material-symbols-outlined text-[20px]">close</span>
							</button>
						</div>

						{/* Menu items */}
						<div class="flex-1 overflow-y-auto no-scrollbar p-3 space-y-1">
							<For each={menuItems()}>
								{(item) => {
									const isActive = () => props.activeTab === item.id;
									return (
										<button
											type="button"
											onClick={() => {
												props.onClose();
												navigate(item.path, { replace: props.activeTab !== 'dashboard' });
											}}
											class={`flex items-center gap-3 p-3.5 rounded-2xl transition-colors w-full text-right ${
												isActive()
													? 'bg-[#3390ec]/10 text-[#3390ec]'
													: 'text-white hover:bg-[#2a2a2a]'
											}`}
										>
											<span
												class={`material-symbols-outlined text-[22px] ${
													isActive() ? 'text-[#3390ec]' : 'opacity-80'
												}`}
											>
												{item.icon}
											</span>
											<span class="text-[14px] font-bold">{item.label}</span>
										</button>
									);
								}}
							</For>
						</div>

						{/* Footer: Back to Managed Channels */}
						<div class="p-3 border-t border-[#2a2a2a] bg-[#1c1c1c] sticky bottom-0">
							<button
								type="button"
								onClick={() => {
									props.onClose();
									navigate('/managed-channels');
								}}
								class="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#2a2a2a]/60 hover:bg-[#2a2a2a] text-[13px] font-bold text-[#8e8e93] hover:text-white transition-colors"
							>
								<span class="material-symbols-outlined text-[18px] rtl:rotate-180">arrow_back</span>
								<span>{t('channel.backToChannels' as any) || 'بازگشت به کانال‌ها'}</span>
							</button>
						</div>
					</div>
				</Motion.div>
			</div>
		</Show>
	);
};
