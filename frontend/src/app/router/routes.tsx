import { type Component, lazy } from 'solid-js';
import { OwnerLayout } from '@/widgets/owner/index.js';
import { OwnerRouteGuard } from './OwnerRouteGuard.js';

// Route-level Code Splitting (Lazy Loading)
const AirdropPage = lazy(() => import('@/pages/airdrop/airdrop/index.js').then((m) => ({ default: m.AirdropPage })));
const ChannelAdminsPage = lazy(() => import('@/pages/channel/admins/index.js').then((m) => ({ default: m.ChannelAdminsPage })));
const ChannelAnalyticsPage = lazy(() => import('@/pages/channel/analytics/index.js').then((m) => ({ default: m.ChannelAnalyticsPage })));
const ChannelAuditLogPage = lazy(() => import('@/pages/channel/audit-log/index.js').then((m) => ({ default: m.ChannelAuditLogPage })));
const ChannelAutoResponderPage = lazy(() => import('@/pages/channel/auto-responder/index.js').then((m) => ({ default: m.ChannelAutoResponderPage })));
const ConnectChannelPage = lazy(() => import('@/pages/channel/connect-channel/index.js').then((m) => ({ default: m.ConnectChannelPage })));
const ChannelDashboardPage = lazy(() => import('@/pages/channel/dashboard/index.js').then((m) => ({ default: m.ChannelDashboardPage })));
const ChannelDynamicBioPage = lazy(() => import('@/pages/channel/dynamic-bio/index.js').then((m) => ({ default: m.ChannelDynamicBioPage })));
const EditProjectPage = lazy(() => import('@/pages/channel/edit-project/ui/EditProjectPage.js').then((m) => ({ default: m.EditProjectPage })));
const ChannelForwardingPage = lazy(() => import('@/pages/channel/forwarding/index.js').then((m) => ({ default: m.ChannelForwardingPage })));
const ChannelFunnelPage = lazy(() => import('@/pages/channel/funnel/index.js').then((m) => ({ default: m.ChannelFunnelPage })));
const ChannelGeneralSettingsPage = lazy(() => import('@/pages/channel/general-settings/index.js').then((m) => ({ default: m.ChannelGeneralSettingsPage })));
const ChannelInlineButtonsPage = lazy(() => import('@/pages/channel/inline-buttons/index.js').then((m) => ({ default: m.ChannelInlineButtonsPage })));
const ManagedChannelsPage = lazy(() => import('@/pages/channel/managed-channels/index.js').then((m) => ({ default: m.ManagedChannelsPage })));
const ChannelPostingPage = lazy(() => import('@/pages/channel/posting/index.js').then((m) => ({ default: m.ChannelPostingPage })));
const CollectionInfoPage = lazy(() => import('@/pages/collection-info/index.js').then((m) => ({ default: m.CollectionInfoPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard/dashboard/index.js').then((m) => ({ default: m.DashboardPage })));
const AnalyticsPage = lazy(() => import('@/pages/group/analytics/index.js').then((m) => ({ default: m.AnalyticsPage })));
const BotManagePage = lazy(() => import('@/pages/group/bot-manage/index.js').then((m) => ({ default: m.BotManagePage })));
const ContentRestrictionsPage = lazy(() => import('@/pages/group/content-restrictions/index.js').then((m) => ({ default: m.ContentRestrictionsPage })));
const CustomTextsPage = lazy(() => import('@/pages/group/custom-texts/index.js').then((m) => ({ default: m.CustomTextsPage })));
const GroupDashboardPage = lazy(() => import('@/pages/group/dashboard/index.js').then((m) => ({ default: m.GroupDashboardPage })));
const GroupDynamicBioPage = lazy(() => import('@/pages/group/dynamic-bio/index.js').then((m) => ({ default: m.GroupDynamicBioPage })));
const GeneralSettingsPage = lazy(() => import('@/pages/group/general-settings/index.js').then((m) => ({ default: m.GeneralSettingsPage })));
const LimitsPage = lazy(() => import('@/pages/group/limits/index.js').then((m) => ({ default: m.LimitsPage })));
const ManagedBotsPage = lazy(() => import('@/pages/group/managed-bots/index.js').then((m) => ({ default: m.ManagedBotsPage })));
const MandatoryPage = lazy(() => import('@/pages/group/mandatory/index.js').then((m) => ({ default: m.MandatoryPage })));
const QuietHoursPage = lazy(() => import('@/pages/group/quiet-hours/index.js').then((m) => ({ default: m.QuietHoursPage })));
const IndexPage = lazy(() => import('@/pages/home/home/index.js').then((m) => ({ default: m.IndexPage })));
const MarketplacePage = lazy(() => import('@/pages/marketplace/index.js').then((m) => ({ default: m.MarketplacePage })));
const OwnerAds = lazy(() => import('@/pages/owner/ads/index.js').then((m) => ({ default: m.OwnerAds })));
const OwnerAuditLogPage = lazy(() => import('@/pages/owner/audit-log/index.js').then((m) => ({ default: m.OwnerAuditLogPage })));
const OwnerBroadcastPage = lazy(() => import('@/pages/owner/broadcast/index.js').then((m) => ({ default: m.OwnerBroadcastPage })));
const OwnerCombos = lazy(() => import('@/pages/owner/combos/index.js').then((m) => ({ default: m.OwnerCombos })));
const OwnerDashboardPage = lazy(() => import('@/pages/owner/dashboard/index.js').then((m) => ({ default: m.OwnerDashboardPage })));
const OwnerEntitiesPage = lazy(() => import('@/pages/owner/entities/index.js').then((m) => ({ default: m.OwnerEntitiesPage })));
const OwnerFinancePage = lazy(() => import('@/pages/owner/finance/index.js').then((m) => ({ default: m.OwnerFinancePage })));
const OwnerHealthPage = lazy(() => import('@/pages/owner/health/index.js').then((m) => ({ default: m.OwnerHealthPage })));
const OwnerPromosPage = lazy(() => import('@/pages/owner/promos/index.js').then((m) => ({ default: m.OwnerPromosPage })));
const OwnerQuests = lazy(() => import('@/pages/owner/quests/index.js').then((m) => ({ default: m.OwnerQuests })));
const OwnerSettingsPage = lazy(() => import('@/pages/owner/settings/index.js').then((m) => ({ default: m.OwnerSettingsPage })));
const OwnerUserbot = lazy(() => import('@/pages/owner/userbot/index.js').then((m) => ({ default: m.OwnerUserbot })));
const OwnerUsersPage = lazy(() => import('@/pages/owner/users/index.js').then((m) => ({ default: m.OwnerUsersPage })));
const AchievementsPage = lazy(() => import('@/pages/profile/achievements/index.js').then((m) => ({ default: m.AchievementsPage })));
const BoostsPage = lazy(() => import('@/pages/profile/boosts/index.js').then((m) => ({ default: m.BoostsPage })));
const LeaderboardPage = lazy(() => import('@/pages/profile/leaderboard/index.js').then((m) => ({ default: m.LeaderboardPage })));
const ProfilePage = lazy(() => import('@/pages/profile/profile/index.js').then((m) => ({ default: m.ProfilePage })));
const SecurityPage = lazy(() => import('@/pages/profile/security/index.js').then((m) => ({ default: m.SecurityPage })));
const SettingsPage = lazy(() => import('@/pages/profile/settings/index.js').then((m) => ({ default: m.SettingsPage })));
const TasksPage = lazy(() => import('@/pages/profile/tasks/index.js').then((m) => ({ default: m.TasksPage })));
const UsernamePage = lazy(() => import('@/pages/username/index.js').then((m) => ({ default: m.UsernamePage })));

interface Route {
	path: string;
	Component: Component;
	title?: string;
}

const withOwnerGuard = (PageComponent: Component, activeTab: any, title?: string): Component => {
	return () => (
		<OwnerRouteGuard>
			<OwnerLayout activeTab={activeTab} title={title}>
				<PageComponent />
			</OwnerLayout>
		</OwnerRouteGuard>
	);
};

export const routes: Route[] = [
	{ path: '/', Component: IndexPage },

	{ path: '/airdrop', Component: AirdropPage },
	{ path: '/marketplace', Component: MarketplacePage },
	{ path: '/dashboard', Component: DashboardPage },
	{ path: '/profile', Component: ProfilePage },
	{ path: '/profile/achievements', Component: AchievementsPage },
	{ path: '/profile/settings', Component: SettingsPage },
	{ path: '/profile/security', Component: SecurityPage },
	{ path: '/profile/leaderboard', Component: LeaderboardPage },
	{ path: '/profile/tasks', Component: TasksPage },
	{ path: '/profile/boosts', Component: BoostsPage },
	{ path: '/managed-bots', Component: ManagedBotsPage },
	{ path: '/bot/:botId/manage', Component: BotManagePage },
	{ path: '/group/:id', Component: GroupDashboardPage },
	{ path: '/group/:id/settings', Component: GeneralSettingsPage },
	{ path: '/group/:id/content', Component: ContentRestrictionsPage },
	{ path: '/group/:id/limits', Component: LimitsPage },
	{ path: '/group/:id/quiet', Component: QuietHoursPage },
	{ path: '/group/:id/mandatory', Component: MandatoryPage },
	{ path: '/group/:id/settings/custom-texts', Component: CustomTextsPage },
	{ path: '/group/:id/analytics', Component: AnalyticsPage },
	{ path: '/group/:id/dynamic-bio', Component: GroupDynamicBioPage },
	{ path: '/managed-channels', Component: ManagedChannelsPage },
	{ path: '/channel/connect', Component: ConnectChannelPage },
	{ path: '/channel/:id', Component: ChannelDashboardPage },
	{ path: '/channel/:id/edit-project', Component: EditProjectPage },
	{ path: '/channel/:id/settings', Component: ChannelGeneralSettingsPage },
	{ path: '/channel/:id/posting', Component: ChannelPostingPage },
	{ path: '/channel/:id/funnel', Component: ChannelFunnelPage },
	{ path: '/channel/:id/forwarding', Component: ChannelForwardingPage },
	{ path: '/channel/:id/admins', Component: ChannelAdminsPage },
	{ path: '/channel/:id/analytics', Component: ChannelAnalyticsPage },
	{ path: '/channel/:id/inline-buttons', Component: ChannelInlineButtonsPage },
	{ path: '/channel/:id/dynamic-bio', Component: ChannelDynamicBioPage },
	{ path: '/channel/:id/auto-responder', Component: ChannelAutoResponderPage },
	{ path: '/channel/:id/audit-log', Component: ChannelAuditLogPage },
	{
		path: '/owner/dashboard',
		Component: withOwnerGuard(OwnerDashboardPage, 'dashboard', 'داشبورد مدیریتی'),
	},
	{ path: '/owner/users', Component: withOwnerGuard(OwnerUsersPage, 'users', 'مدیریت کاربران') },
	{
		path: '/owner/audit-logs',
		Component: withOwnerGuard(OwnerAuditLogPage, 'audit-logs', 'لاگ‌های سیستم'),
	},
	{ path: '/owner/quests', Component: withOwnerGuard(OwnerQuests, 'quests', 'مدیریت مأموریت‌ها') },
	{ path: '/owner/combos', Component: withOwnerGuard(OwnerCombos, 'combos', 'کامبو روزانه') },
	{ path: '/owner/userbot', Component: withOwnerGuard(OwnerUserbot, 'userbot', 'ربات‌های متصل') },
	{
		path: '/owner/settings',
		Component: withOwnerGuard(OwnerSettingsPage, 'settings', 'تنظیمات سیستم'),
	},
	{ path: '/owner/promos', Component: withOwnerGuard(OwnerPromosPage, 'promos', 'کدهای هدیه') },
	{
		path: '/owner/broadcast',
		Component: withOwnerGuard(OwnerBroadcastPage, 'broadcast', 'ارسال همگانی'),
	},
	{ path: '/owner/finance', Component: withOwnerGuard(OwnerFinancePage, 'finance', 'امور مالی') },
	{ path: '/owner/health', Component: withOwnerGuard(OwnerHealthPage, 'health', 'سلامت سیستم') },
	{
		path: '/owner/entities',
		Component: withOwnerGuard(OwnerEntitiesPage, 'entities', 'مدیریت گروه‌ها و کانال‌ها'),
	},
	{ path: '/owner/ads', Component: withOwnerGuard(OwnerAds, 'ads', 'تنظیمات تبلیغات') },
	{ path: '/collection-info', Component: CollectionInfoPage },
	{ path: '/username/report', Component: UsernamePage },
];

