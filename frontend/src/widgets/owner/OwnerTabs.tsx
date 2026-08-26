import { useNavigate } from '@solidjs/router';

import { type Component, For, onMount } from 'solid-js';
import { t } from '@/shared/i18n/index.js';
import { haptic } from '@/shared/lib/haptic.js';

export type OwnerTabId =
	| 'dashboard'
	| 'users'
	| 'audit-logs'
	| 'quests'
	| 'combos'
	| 'userbot'
	| 'settings'
	| 'promos'
	| 'broadcast'
	| 'finance'
	| 'health'
	| 'entities'
	| 'ads';

interface TabConfig {
	id: OwnerTabId;
	labelKey: string;
	icon: string;
	path: string;
}

const TABS: TabConfig[] = [
	{
		id: 'dashboard',
		labelKey: 'ownerNav.dashboardLabel',
		icon: 'dashboard',
		path: '/owner/dashboard',
	},
	{
		id: 'users',
		labelKey: 'ownerNav.usersLabel',
		icon: 'group',
		path: '/owner/users',
	},
	{
		id: 'audit-logs',
		labelKey: 'ownerNav.auditLogsLabel',
		icon: 'receipt_long',
		path: '/owner/audit-logs',
	},
	{
		id: 'promos',
		labelKey: 'ownerNav.promosLabel',
		icon: 'redeem',
		path: '/owner/promos',
	},
	{
		id: 'broadcast',
		labelKey: 'ownerNav.broadcastLabel',
		icon: 'campaign',
		path: '/owner/broadcast',
	},
	{
		id: 'quests',
		labelKey: 'ownerNav.questsLabel',
		icon: 'task',
		path: '/owner/quests',
	},
	{
		id: 'combos',
		labelKey: 'ownerNav.combosLabel',
		icon: 'extension',
		path: '/owner/combos',
	},
	{
		id: 'userbot',
		labelKey: 'ownerNav.userbotLabel',
		icon: 'smart_toy',
		path: '/owner/userbot',
	},
	{
		id: 'settings',
		labelKey: 'ownerNav.settingsLabel',
		icon: 'settings',
		path: '/owner/settings',
	},
	{
		id: 'finance',
		labelKey: 'ownerNav.financeLabel',
		icon: 'account_balance',
		path: '/owner/finance',
	},
	{
		id: 'entities',
		labelKey: 'ownerNav.entitiesLabel',
		icon: 'grid_view',
		path: '/owner/entities',
	},
	{
		id: 'health',
		labelKey: 'ownerNav.healthLabel',
		icon: 'monitor_heart',
		path: '/owner/health',
	},
	{
		id: 'ads',
		labelKey: 'ownerNav.adsLabel',
		icon: 'campaign',
		path: '/owner/ads',
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
			aria-label={t('ownerChrome.tabsAriaLabel' as any)}
			class="px-6 py-3 flex gap-2 overflow-x-auto relative z-10 border-b border-white/5 bg-[#0f1016]/80 backdrop-blur-md select-none scrollbar-none"
		>
			<For each={TABS}>
				{(tab) => {
					const isActive = () => props.active === tab.id;
					return (
						<button
							type="button"
							ref={(el) => {
								if (isActive()) activeBtnRef = el;
							}}
							onClick={() => handleNav(tab.path)}
							aria-current={isActive() ? 'page' : undefined}
							class={`h-9 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
								isActive()
									? 'bg-[#3390ec] text-white shadow-lg shadow-[#3390ec]/20'
									: 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
							}`}
						>
							<span class="material-symbols-outlined text-[16px]">{tab.icon}</span>
							<span>{t(tab.labelKey as any)}</span>
						</button>
					);
				}}
			</For>
		</nav>
	);
};
