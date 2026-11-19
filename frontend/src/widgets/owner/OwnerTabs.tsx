import { useNavigate } from '@solidjs/router';
import { type Component, For, onMount, Show } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export type OwnerTabId =
	| 'dashboard'
	| 'users'
	| 'userbot'
	| 'settings'
	| 'promos'
	| 'finance'
	| 'broadcast'
	| 'ads'
	| 'health'
	| 'audit-logs'
	| 'investors';

interface TabConfig {
	id: OwnerTabId;
	labelKey: string;
	icon: string;
	path: string;
}

const TABS: TabConfig[] = [
	{
		id: 'dashboard',
		labelKey: 'ownerTabsNav.dashboard',
		icon: 'space_dashboard',
		path: '/owner/dashboard',
	},
	{ id: 'users', labelKey: 'ownerTabsNav.users', icon: 'group', path: '/owner/users' },
	{ id: 'userbot', labelKey: 'ownerTabsNav.userbot', icon: 'hub', path: '/owner/userbot' },
	{ id: 'settings', labelKey: 'ownerTabsNav.settings', icon: 'tune', path: '/owner/settings' },
	{
		id: 'promos',
		labelKey: 'ownerTabsNav.promos',
		icon: 'confirmation_number',
		path: '/owner/promos',
	},
	{ id: 'finance', labelKey: 'ownerTabsNav.finance', icon: 'payments', path: '/owner/finance' },
	{
		id: 'broadcast',
		labelKey: 'ownerTabsNav.broadcast',
		icon: 'campaign',
		path: '/owner/broadcast',
	},
	{ id: 'ads', labelKey: 'ownerTabsNav.ads', icon: 'ads_click', path: '/owner/ads' },
	{ id: 'health', labelKey: 'ownerTabsNav.health', icon: 'monitor_heart', path: '/owner/health' },
	{
		id: 'audit-logs',
		labelKey: 'ownerTabsNav.auditLogs',
		icon: 'shield_lock',
		path: '/owner/audit-logs',
	},
];

interface OwnerTabsProps {
	active: OwnerTabId;
}

export const OwnerTabs: Component<OwnerTabsProps> = (props) => {
	const navigate = useNavigate();
	let activeBtnRef: HTMLButtonElement | undefined;

	onMount(() => {
		if (activeBtnRef?.scrollIntoView) {
			activeBtnRef.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
		}
	});

	const handleNav = (path: string) => {
		try {
			haptic.impact('light');
		} catch {}
		navigate(path);
	};

	return (
		<nav
			aria-label={t('ownerTabsNav.ariaLabel')}
			class="px-4 md:px-6 flex gap-4 overflow-x-auto relative z-10 border-b border-[#293440] bg-[#212a33] select-none no-scrollbar"
		>
			<For each={TABS}>
				{(tab) => {
					const isActive = () =>
						props.active === tab.id || (props.active === 'investors' && tab.id === 'ads');
					return (
						<button
							type="button"
							ref={(el) => {
								if (isActive()) activeBtnRef = el;
							}}
							onClick={() => handleNav(tab.path)}
							aria-current={isActive() ? 'page' : undefined}
							class={`relative h-10 px-1 text-[13px] font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
								isActive() ? 'text-white' : 'text-[#8c9aa9] hover:text-white'
							}`}
						>
							<span class="material-symbols-outlined text-[15px]">{tab.icon}</span>
							<span>{t(tab.labelKey)}</span>
							<Show when={isActive()}>
								<span class="absolute inset-x-0 bottom-0 h-[3px] bg-[#248bda] rounded-t-[3px]" />
							</Show>
						</button>
					);
				}}
			</For>
		</nav>
	);
};
