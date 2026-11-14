import { useNavigate } from '@solidjs/router';
import { type Component, For, onMount } from 'solid-js';
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
	badge?: string;
	icon: string;
	path: string;
}

const TABS: TabConfig[] = [
	{
		id: 'dashboard',
		labelKey: 'ownerTabsNav.dashboard',
		badge: 'LIVE',
		icon: 'space_dashboard',
		path: '/owner/dashboard',
	},
	{
		id: 'users',
		labelKey: 'ownerTabsNav.users',
		icon: 'group',
		path: '/owner/users',
	},
	{
		id: 'userbot',
		labelKey: 'ownerTabsNav.userbot',
		badge: 'CORE',
		icon: 'hub',
		path: '/owner/userbot',
	},
	{
		id: 'settings',
		labelKey: 'ownerTabsNav.settings',
		icon: 'tune',
		path: '/owner/settings',
	},
	{
		id: 'promos',
		labelKey: 'ownerTabsNav.promos',
		icon: 'confirmation_number',
		path: '/owner/promos',
	},
	{
		id: 'finance',
		labelKey: 'ownerTabsNav.finance',
		icon: 'payments',
		path: '/owner/finance',
	},
	{
		id: 'broadcast',
		labelKey: 'ownerTabsNav.broadcast',
		icon: 'campaign',
		path: '/owner/broadcast',
	},
	{
		id: 'ads',
		labelKey: 'ownerTabsNav.ads',
		icon: 'ads_click',
		path: '/owner/ads',
	},
	{
		id: 'health',
		labelKey: 'ownerTabsNav.health',
		icon: 'monitor_heart',
		path: '/owner/health',
	},
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
			class="px-4 md:px-8 py-2.5 flex gap-2 overflow-x-auto relative z-10 border-b border-white/[0.08] bg-[#11161d]/92 backdrop-blur-xl select-none scrollbar-none"
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
							class={`h-9 px-3.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
								isActive()
									? 'bg-[#2990ff] text-white shadow-[0_6px_16px_rgba(41,144,255,0.28)] border border-white/15'
									: 'bg-[#1b232d] text-[#c2cfde] hover:bg-[#232d3a] hover:text-white border border-white/[0.07]'
							}`}
						>
							<span class="material-symbols-outlined text-[16px]">{tab.icon}</span>
							<span>{t(tab.labelKey)}</span>
							{tab.badge && (
								<span
									class={`px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider ${
										isActive()
											? 'bg-black/25 text-white'
											: 'bg-[#ffb340]/15 text-[#ffb340] border border-[#ffb340]/25'
									}`}
								>
									{tab.badge}
								</span>
							)}
						</button>
					);
				}}
			</For>
		</nav>
	);
};
