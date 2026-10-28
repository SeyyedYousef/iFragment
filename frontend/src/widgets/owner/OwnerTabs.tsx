import { useNavigate } from '@solidjs/router';
import { type Component, For, onMount } from 'solid-js';
import { locale } from '@/shared/i18n/index.js';
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
	labelFa: string;
	labelEn: string;
	badge?: string;
	icon: string;
	path: string;
}

const TABS: TabConfig[] = [
	{
		id: 'dashboard',
		labelFa: 'اتاق فرمان و تلمتری',
		labelEn: 'Command Center',
		badge: 'LIVE',
		icon: 'space_dashboard',
		path: '/owner/dashboard',
	},
	{
		id: 'users',
		labelFa: 'کاربران و کریدیت ⚡',
		labelEn: 'Users & Credits ⚡',
		icon: 'group',
		path: '/owner/users',
	},
	{
		id: 'userbot',
		labelFa: 'نشست‌های MTProto',
		labelEn: 'MTProto Sessions',
		badge: 'CORE',
		icon: 'hub',
		path: '/owner/userbot',
	},
	{
		id: 'settings',
		labelFa: 'تعرفه و موتور ارزش‌گذاری',
		labelEn: 'Pricing & Engine',
		icon: 'tune',
		path: '/owner/settings',
	},
	{
		id: 'promos',
		labelFa: 'کدهای هدیه کریدیت',
		labelEn: 'Credit Promos',
		icon: 'confirmation_number',
		path: '/owner/promos',
	},
	{
		id: 'finance',
		labelFa: 'درآمد و Stars ⭐',
		labelEn: 'Stars & Revenue',
		icon: 'payments',
		path: '/owner/finance',
	},
	{
		id: 'broadcast',
		labelFa: 'پیام همگانی',
		labelEn: 'Broadcast',
		icon: 'campaign',
		path: '/owner/broadcast',
	},
	{
		id: 'ads',
		labelFa: 'بنرها و سرمایه‌گذاران',
		labelEn: 'Banners & Media',
		icon: 'ads_click',
		path: '/owner/ads',
	},
	{
		id: 'health',
		labelFa: 'سلامت اوراکل‌ها و کش',
		labelEn: 'Oracle Health',
		icon: 'monitor_heart',
		path: '/owner/health',
	},
	{
		id: 'audit-logs',
		labelFa: 'لاگ امنیتی',
		labelEn: 'Audit Ledger',
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
	const isFa = () => locale() === 'fa';

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
			aria-label="Owner Command Navigation"
			class="px-4 md:px-8 py-2.5 flex gap-2 overflow-x-auto relative z-10 border-b border-white/10 bg-[#0b0d14]/90 backdrop-blur-xl select-none scrollbar-none"
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
							class={`h-9 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shrink-0 ${
								isActive()
									? 'bg-gradient-to-r from-[#3390ec] to-cyan-500 text-white shadow-lg shadow-[#3390ec]/25 border border-white/20'
									: 'bg-white/[0.04] text-white/65 hover:bg-white/10 hover:text-white border border-white/5'
							}`}
						>
							<span class="material-symbols-outlined text-[16px]">{tab.icon}</span>
							<span>{isFa() ? tab.labelFa : tab.labelEn}</span>
							{tab.badge && (
								<span
									class={`px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider ${
										isActive()
											? 'bg-black/30 text-white'
											: 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
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
