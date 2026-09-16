import { type Component, lazy } from 'solid-js';
import { useI18n } from '@/shared/i18n/index.js';
import { OwnerLayout } from '@/widgets/owner/index.js';
import { OwnerRouteGuard } from './OwnerRouteGuard.js';

// Route-level Code Splitting (Lazy Loading)
const AirdropPage = lazy(() =>
	import('@/pages/airdrop/airdrop/index.js').then((m) => ({ default: m.AirdropPage })),
);
const CollectionInfoPage = lazy(() =>
	import('@/pages/collection-info/index.js').then((m) => ({ default: m.CollectionInfoPage })),
);
const DashboardPage = lazy(() =>
	import('@/pages/dashboard/dashboard/index.js').then((m) => ({ default: m.DashboardPage })),
);
const InvestorsPromoPage = lazy(() =>
	import('@/pages/dashboard/dashboard/index.js').then((m) => ({ default: m.InvestorsPromoPage })),
);
const IndexPage = lazy(() =>
	import('@/pages/home/home/index.js').then((m) => ({ default: m.IndexPage })),
);
const OwnerAds = lazy(() =>
	import('@/pages/owner/ads/index.js').then((m) => ({ default: m.OwnerAds })),
);
const OwnerAuditLogPage = lazy(() =>
	import('@/pages/owner/audit-log/index.js').then((m) => ({ default: m.OwnerAuditLogPage })),
);
const OwnerBroadcastPage = lazy(() =>
	import('@/pages/owner/broadcast/index.js').then((m) => ({ default: m.OwnerBroadcastPage })),
);
const OwnerCombos = lazy(() =>
	import('@/pages/owner/combos/index.js').then((m) => ({ default: m.OwnerCombos })),
);
const OwnerDashboardPage = lazy(() =>
	import('@/pages/owner/dashboard/index.js').then((m) => ({ default: m.OwnerDashboardPage })),
);
const OwnerFinancePage = lazy(() =>
	import('@/pages/owner/finance/index.js').then((m) => ({ default: m.OwnerFinancePage })),
);
const OwnerHealthPage = lazy(() =>
	import('@/pages/owner/health/index.js').then((m) => ({ default: m.OwnerHealthPage })),
);
const OwnerPromosPage = lazy(() =>
	import('@/pages/owner/promos/index.js').then((m) => ({ default: m.OwnerPromosPage })),
);
const OwnerQuests = lazy(() =>
	import('@/pages/owner/quests/index.js').then((m) => ({ default: m.OwnerQuests })),
);
const OwnerSettingsPage = lazy(() =>
	import('@/pages/owner/settings/index.js').then((m) => ({ default: m.OwnerSettingsPage })),
);
const OwnerUserbot = lazy(() =>
	import('@/pages/owner/userbot/index.js').then((m) => ({ default: m.OwnerUserbot })),
);
const OwnerUsersPage = lazy(() =>
	import('@/pages/owner/users/index.js').then((m) => ({ default: m.OwnerUsersPage })),
);
const AchievementsPage = lazy(() =>
	import('@/pages/profile/achievements/index.js').then((m) => ({ default: m.AchievementsPage })),
);
const LeaderboardPage = lazy(() =>
	import('@/pages/profile/leaderboard/index.js').then((m) => ({ default: m.LeaderboardPage })),
);
const ProfilePage = lazy(() =>
	import('@/pages/profile/profile/index.js').then((m) => ({ default: m.ProfilePage })),
);
const SecurityPage = lazy(() =>
	import('@/pages/profile/security/index.js').then((m) => ({ default: m.SecurityPage })),
);
const SettingsPage = lazy(() =>
	import('@/pages/profile/settings/index.js').then((m) => ({ default: m.SettingsPage })),
);
const UsernamePage = lazy(() =>
	import('@/pages/username/index.js').then((m) => ({ default: m.UsernamePage })),
);
const NumbersIntelPage = lazy(() =>
	import('@/pages/numbers/intel/index.js').then((m) => ({ default: m.NumbersIntelPage })),
);
const NumbersCollectionPage = lazy(() =>
	import('@/pages/numbers/collection/index.js').then((m) => ({ default: m.NumbersCollectionPage })),
);
const NumberReportPage = lazy(() =>
	import('@/pages/numbers/report/index.js').then((m) => ({ default: m.NumberReportPage })),
);
const MaskBuilderPage = lazy(() =>
	import('@/pages/numbers/mask/index.js').then((m) => ({ default: m.MaskBuilderPage })),
);
const GiftsIntelPage = lazy(() =>
	import('@/pages/gifts/intel/index.js').then((m) => ({ default: m.GiftsIntelPage })),
);
const GiftReportPage = lazy(() =>
	import('@/pages/gifts/report/index.js').then((m) => ({ default: m.GiftReportPage })),
);
const GiftCollectionPage = lazy(() =>
	import('@/pages/gifts/collection/index.js').then((m) => ({ default: m.GiftCollectionPage })),
);
const CraftingCalculatorPage = lazy(() =>
	import('@/pages/gifts/crafting/index.js').then((m) => ({ default: m.CraftingCalculatorPage })),
);
const PortfolioScannerPage = lazy(() =>
	import('@/pages/gifts/portfolio/index.js').then((m) => ({ default: m.PortfolioScannerPage })),
);

interface Route {
	path: string;
	Component: Component;
	title?: string;
}

const withOwnerGuard = (PageComponent: Component, activeTab: any, titleKey?: string): Component => {
	return () => {
		const { t } = useI18n();
		return (
			<OwnerRouteGuard>
				<OwnerLayout
					activeTab={activeTab}
					title={titleKey ? t(titleKey as any) || titleKey : undefined}
				>
					<PageComponent />
				</OwnerLayout>
			</OwnerRouteGuard>
		);
	};
};

import { useNavigate } from '@solidjs/router';
import { onMount } from 'solid-js';

const TasksRedirect: Component = () => {
	const nav = useNavigate();
	onMount(() => nav('/airdrop?tab=earn', { replace: true }));
	return null;
};

const BoostsRedirect: Component = () => {
	const nav = useNavigate();
	onMount(() => nav('/airdrop?tab=boost', { replace: true }));
	return null;
};

const ShopRedirect: Component = () => {
	const nav = useNavigate();
	onMount(() => nav('/airdrop?tab=shop', { replace: true }));
	return null;
};

export const routes: Route[] = [
	{ path: '/', Component: IndexPage },

	{ path: '/airdrop', Component: AirdropPage },
	{ path: '/boost', Component: BoostsRedirect },
	{ path: '/boosts', Component: BoostsRedirect },
	{ path: '/investors', Component: InvestorsPromoPage },
	{ path: '/shop', Component: ShopRedirect },
	{ path: '/store', Component: ShopRedirect },
	{ path: '/marketplace', Component: ShopRedirect },
	{ path: '/dashboard', Component: DashboardPage },
	{ path: '/profile', Component: ProfilePage },
	{ path: '/profile/achievements', Component: AchievementsPage },
	{ path: '/profile/settings', Component: SettingsPage },
	{ path: '/profile/security', Component: SecurityPage },
	{ path: '/profile/leaderboard', Component: LeaderboardPage },
	{ path: '/profile/tasks', Component: TasksRedirect },
	{ path: '/profile/boosts', Component: BoostsRedirect },
	{ path: '/profile/shop', Component: ShopRedirect },
	{
		path: '/owner/dashboard',
		Component: withOwnerGuard(OwnerDashboardPage, 'dashboard', 'ownerDashboard.title'),
	},
	{ path: '/owner/users', Component: withOwnerGuard(OwnerUsersPage, 'users', 'ownerUsers.title') },
	{
		path: '/owner/audit-logs',
		Component: withOwnerGuard(OwnerAuditLogPage, 'audit-logs', 'ownerAuditLogs.title'),
	},
	{ path: '/owner/quests', Component: withOwnerGuard(OwnerQuests, 'quests', 'ownerQuests.title') },
	{ path: '/owner/combos', Component: withOwnerGuard(OwnerCombos, 'combos', 'ownerCombos.title') },
	{
		path: '/owner/userbot',
		Component: withOwnerGuard(OwnerUserbot, 'userbot', 'ownerUserbot.title'),
	},
	{
		path: '/owner/settings',
		Component: withOwnerGuard(OwnerSettingsPage, 'settings', 'ownerSettings.title'),
	},
	{
		path: '/owner/promos',
		Component: withOwnerGuard(OwnerPromosPage, 'promos', 'ownerPromos.title'),
	},
	{
		path: '/owner/broadcast',
		Component: withOwnerGuard(OwnerBroadcastPage, 'broadcast', 'ownerBroadcast.title'),
	},
	{
		path: '/owner/finance',
		Component: withOwnerGuard(OwnerFinancePage, 'finance', 'ownerFinance.title'),
	},
	{
		path: '/owner/health',
		Component: withOwnerGuard(OwnerHealthPage, 'health', 'ownerHealth.title'),
	},
	{
		path: '/owner/entities',
		Component: () => {
			const nav = useNavigate();
			onMount(() => nav('/owner/dashboard', { replace: true }));
			return null;
		},
	},
	{ path: '/owner/ads', Component: withOwnerGuard(OwnerAds, 'ads', 'ownerAds.title') },
	{ path: '/collection-info', Component: CollectionInfoPage },
	{ path: '/username', Component: UsernamePage },
	{ path: '/usernames', Component: UsernamePage },
	{ path: '/username/report', Component: UsernamePage },
	{ path: '/username/valuation', Component: UsernamePage },
	{ path: '/username/intel', Component: UsernamePage },
	{ path: '/numbers', Component: NumbersIntelPage },
	{ path: '/numbers/intel', Component: NumbersIntelPage },
	{ path: '/numbers/collection', Component: NumbersCollectionPage },
	{ path: '/numbers/report', Component: NumberReportPage },
	{ path: '/numbers/valuation', Component: NumberReportPage },
	{ path: '/numbers/mask', Component: MaskBuilderPage },
	{ path: '/gifts', Component: GiftsIntelPage },
	{ path: '/gifts/intel', Component: GiftsIntelPage },
	{ path: '/gifts/collection', Component: GiftCollectionPage },
	{ path: '/gifts/report', Component: GiftReportPage },
	{ path: '/gifts/valuation', Component: GiftReportPage },
	{ path: '/gifts/crafting', Component: CraftingCalculatorPage },
	{ path: '/gifts/portfolio', Component: PortfolioScannerPage },
];
