import { useNavigate } from '@solidjs/router';
import { hapticFeedback } from '@tma.js/sdk-solid';
import { Component, For, onMount } from 'solid-js';

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
	label: string;
	icon: string;
	path: string;
}

const TABS: TabConfig[] = [
	{ id: 'dashboard', label: 'داشبورد', icon: 'dashboard', path: '/owner/dashboard' },
	{ id: 'users', label: 'کاربران', icon: 'group', path: '/owner/users' },
	{ id: 'audit-logs', label: 'لاگ‌های سیستم', icon: 'receipt_long', path: '/owner/audit-logs' },
	{ id: 'promos', label: 'کدهای هدیه', icon: 'redeem', path: '/owner/promos' },
	{ id: 'broadcast', label: 'ارسال همگانی', icon: 'campaign', path: '/owner/broadcast' },
	{ id: 'quests', label: 'مأموریت‌ها', icon: 'task', path: '/owner/quests' },
	{ id: 'combos', label: 'کامبو روزانه', icon: 'extension', path: '/owner/combos' },
	{ id: 'userbot', label: 'ربات‌های متصل', icon: 'smart_toy', path: '/owner/userbot' },
	{ id: 'settings', label: 'تنظیمات سیستم', icon: 'settings', path: '/owner/settings' },
	{ id: 'finance', label: 'امور مالی', icon: 'account_balance', path: '/owner/finance' },
	{ id: 'entities', label: 'گروه‌ها و کانال‌ها', icon: 'grid_view', path: '/owner/entities' },
	{ id: 'health', label: 'سلامت سیستم', icon: 'monitor_heart', path: '/owner/health' },
	{ id: 'ads', label: 'تبلیغات', icon: 'campaign', path: '/owner/ads' },
];

interface OwnerTabsProps {
	active: OwnerTabId;
}

export const OwnerTabs: Component<OwnerTabsProps> = (props) => {
	const navigate = useNavigate();
	let activeBtnRef: HTMLButtonElement | undefined;

	onMount(() => {
		if (activeBtnRef && activeBtnRef.scrollIntoView) {
			activeBtnRef.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
		}
	});

	const handleNav = (path: string) => {
		try {
			hapticFeedback.impactOccurred('light');
		} catch {}
		navigate(path);
	};

	return (
		<nav
			aria-label="بخش‌های اصلی پنل مدیریت"
			class="px-6 py-3 flex gap-2 overflow-x-auto relative z-10 border-b border-white/5 bg-[#0f1016]/80 backdrop-blur-md select-none scrollbar-none"
		>
			<For each={TABS}>
				{(tab) => {
					const isActive = () => props.active === tab.id;
					return (
						<button
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
							<span>{tab.label}</span>
						</button>
					);
				}}
			</For>
		</nav>
	);
};
