import { type Component, lazy } from 'solid-js';
import { useI18n } from '@/shared/i18n/index.js';
import { OwnerLayout } from '@/widgets/owner/index.js';
import { OwnerRouteGuard } from './OwnerRouteGuard.js';

// Route-level Code Splitting (Lazy Loading)
const AirdropPage = lazy(() =>
	import('@/pages/airdrop/airdrop/index.js').then((m) => ({ default: m.AirdropPage })),
);
const ChannelAdminsPage = lazy(() =>
	import('@/pages/channel/admins/index.js').then((m) => ({ default: m.ChannelAdminsPage })),
);
const ChannelAnalyticsPage = lazy(() =>
	import('@/pages/channel/analytics/index.js').then((m) => ({ default: m.ChannelAnalyticsPage })),
);
const ChannelAuditLogPage = lazy(() =>
	import('@/pages/channel/audit-log/index.js').then((m) => ({ default: m.ChannelAuditLogPage })),
);
const ChannelAutoResponderPage = lazy(() =>
	import('@/pages/channel/auto-responder/index.js').then((m) => ({
		default: m.ChannelAutoResponderPage,
	})),
);
const ChannelDashboardPage = lazy(() =>
	import('@/pages/channel/dashboard/index.js').then((m) => ({ default: m.ChannelDashboardPage })),
);
const ChannelDynamicBioPage = lazy(() =>
	import('@/pages/channel/dynamic-bio/index.js').then((m) => ({
		default: m.ChannelDynamicBioPage,
	})),
);
const EditProjectPage = lazy(() =>
	import('@/pages/channel/edit-project/ui/EditProjectPage.js').then((m) => ({
		default: m.EditProjectPage,
	})),
);
const ChannelForwardingPage = lazy(() =>
	import('@/pages/channel/forwarding/index.js').then((m) => ({ default: m.ChannelForwardingPage })),
);
const ChannelFunnelPage = lazy(() =>
	import('@/pages/channel/projects/index.js').then((m) => ({ default: m.ProjectsPage })),
);
const ProjectsPage = lazy(() =>
	import('@/pages/channel/projects/index.js').then((m) => ({ default: m.ProjectsPage })),
);
const ChannelHealthPage = lazy(() =>
	import('@/pages/channel/health/index.js').then((m) => ({ default: m.ChannelHealthPage })),
);
const ChannelMembersPage = lazy(() =>
	import('@/pages/channel/members/index.js').then((m) => ({ default: m.ChannelMembersPage })),
);
const ChannelGeneralSettingsPage = lazy(() =>
	import('@/pages/channel/general-settings/index.js').then((m) => ({
		default: m.ChannelGeneralSettingsPage,
	})),
);
const ChannelInlineButtonsPage = lazy(() =>
	import('@/pages/channel/inline-buttons/index.js').then((m) => ({
		default: m.ChannelInlineButtonsPage,
	})),
);
const ManagedChannelsPage = lazy(() =>
	import('@/pages/channel/managed-channels/index.js').then((m) => ({
		default: m.ManagedChannelsPage,
	})),
);
const ChannelPostingPage = lazy(() =>
	import('@/pages/channel/posting/index.js').then((m) => ({ default: m.ChannelPostingPage })),
);
const CollectionInfoPage = lazy(() =>
	import('@/pages/collection-info/index.js').then((m) => ({ default: m.CollectionInfoPage })),
);
const DashboardPage = lazy(() =>
	import('@/pages/dashboard/dashboard/index.js').then((m) => ({ default: m.DashboardPage })),
);
const AnalyticsPage = lazy(() =>
	import('@/pages/group/analytics/index.js').then((m) => ({ default: m.AnalyticsPage })),
);
const BotManagePage = lazy(() =>
	import('@/pages/group/bot-manage/index.js').then((m) => ({ default: m.BotManagePage })),
);
const ContentRestrictionsPage = lazy(() =>
	import('@/pages/group/content-restrictions/index.js').then((m) => ({
		default: m.ContentRestrictionsPage,
	})),
);
const CustomTextsPage = lazy(() =>
	import('@/pages/group/custom-texts/index.js').then((m) => ({ default: m.CustomTextsPage })),
);
const GroupDashboardPage = lazy(() =>
	import('@/pages/group/dashboard/index.js').then((m) => ({ default: m.GroupDashboardPage })),
);
const GroupDynamicBioPage = lazy(() =>
	import('@/pages/group/dynamic-bio/index.js').then((m) => ({ default: m.GroupDynamicBioPage })),
);
const GeneralSettingsPage = lazy(() =>
	import('@/pages/group/general-settings/index.js').then((m) => ({
		default: m.GeneralSettingsPage,
	})),
);
const LimitsPage = lazy(() =>
	import('@/pages/group/limits/index.js').then((m) => ({ default: m.LimitsPage })),
);
const ManagedBotsPage = lazy(() =>
	import('@/pages/group/managed-bots/index.js').then((m) => ({ default: m.ManagedBotsPage })),
);
const MandatoryPage = lazy(() =>
	import('@/pages/group/mandatory/index.js').then((m) => ({ default: m.MandatoryPage })),
);
const MembersPage = lazy(() =>
	import('@/pages/group/members/index.js').then((m) => ({ default: m.MembersPage })),
);
const QuietHoursPage = lazy(() =>
	import('@/pages/group/quiet-hours/index.js').then((m) => ({ default: m.QuietHoursPage })),
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
const OwnerEntitiesPage = lazy(() =>
	import('@/pages/owner/entities/index.js').then((m) => ({ default: m.OwnerEntitiesPage })),
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
				<OwnerLayout activeTab={activeTab} title={titleKey ? (t(titleKey as any) || titleKey) : undefined}>
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
	{ path: '/managed-bots', Component: ManagedBotsPage },
	{ path: '/bot/:botId/manage', Component: BotManagePage },
	{ path: '/group/:id', Component: GroupDashboardPage },
	{ path: '/group/:id/settings', Component: GeneralSettingsPage },
	{ path: '/group/:id/content', Component: ContentRestrictionsPage },
	{ path: '/group/:id/limits', Component: LimitsPage },
	{ path: '/group/:id/quiet', Component: QuietHoursPage },
	{ path: '/group/:id/mandatory', Component: MandatoryPage },
	{ path: '/group/:id/settings/custom-texts', Component: CustomTextsPage },
	{ path: '/group/:id/members', Component: MembersPage },
	{ path: '/group/:id/analytics', Component: AnalyticsPage },
	{ path: '/group/:id/dynamic-bio', Component: GroupDynamicBioPage },
	{ path: '/managed-channels', Component: ManagedChannelsPage },
	{ path: '/channel/connect', Component: ProjectsPage },
	{ path: '/channel/projects', Component: ProjectsPage },
	{ path: '/channel/:id', Component: ChannelDashboardPage },
	{ path: '/channel/:id/dashboard', Component: ChannelDashboardPage },
	{ path: '/channel/:id/projects', Component: ProjectsPage },
	{ path: '/channel/:id/edit-project', Component: EditProjectPage },
	{ path: '/channel/:id/settings', Component: ChannelGeneralSettingsPage },
	{ path: '/channel/:id/general', Component: ChannelGeneralSettingsPage },
	{ path: '/channel/:id/posting', Component: ChannelPostingPage },
	{ path: '/channel/:id/funnel', Component: ChannelFunnelPage },
	{ path: '/channel/:id/forwarding', Component: ChannelForwardingPage },
	{ path: '/channel/:id/health', Component: ChannelHealthPage },
	{ path: '/channel/:id/members', Component: ChannelMembersPage },
	{ path: '/channel/:id/admins', Component: ChannelAdminsPage },
	{ path: '/channel/:id/analytics', Component: ChannelAnalyticsPage },
	{ path: '/channel/:id/inline-buttons', Component: ChannelInlineButtonsPage },
	{ path: '/channel/:id/dynamic-bio', Component: ChannelDynamicBioPage },
	{ path: '/channel/:id/auto-responder', Component: ChannelAutoResponderPage },
	{ path: '/channel/:id/audit-log', Component: ChannelAuditLogPage },
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
	{ path: '/owner/userbot', Component: withOwnerGuard(OwnerUserbot, 'userbot', 'ownerUserbot.title') },
	{
		path: '/owner/settings',
		Component: withOwnerGuard(OwnerSettingsPage, 'settings', 'ownerSettings.title'),
	},
	{ path: '/owner/promos', Component: withOwnerGuard(OwnerPromosPage, 'promos', 'ownerPromos.title') },
	{
		path: '/owner/broadcast',
		Component: withOwnerGuard(OwnerBroadcastPage, 'broadcast', 'ownerBroadcast.title'),
	},
	{ path: '/owner/finance', Component: withOwnerGuard(OwnerFinancePage, 'finance', 'ownerFinance.title') },
	{ path: '/owner/health', Component: withOwnerGuard(OwnerHealthPage, 'health', 'ownerHealth.title') },
	{
		path: '/owner/entities',
		Component: withOwnerGuard(OwnerEntitiesPage, 'entities', 'ownerEntities.title'),
	},
	{ path: '/owner/ads', Component: withOwnerGuard(OwnerAds, 'ads', 'ownerAds.title') },
	{ path: '/collection-info', Component: CollectionInfoPage },
	{ path: '/username/report', Component: UsernamePage },
	{ path: '/numbers', Component: NumbersIntelPage },
	{ path: '/numbers/intel', Component: NumbersIntelPage },
	{ path: '/numbers/report', Component: NumberReportPage },
	{ path: '/numbers/valuation', Component: NumberReportPage },
	{ path: '/numbers/mask', Component: MaskBuilderPage },
	{ path: '/gifts', Component: GiftsIntelPage },
	{ path: '/gifts/intel', Component: GiftsIntelPage },
	{ path: '/gifts/report', Component: GiftReportPage },
	{ path: '/gifts/valuation', Component: GiftReportPage },
	{ path: '/gifts/crafting', Component: CraftingCalculatorPage },
	{ path: '/gifts/portfolio', Component: PortfolioScannerPage },
];
