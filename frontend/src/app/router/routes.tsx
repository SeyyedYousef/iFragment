import type { Component } from 'solid-js';

import { lazy } from 'solid-js';

import { IndexPage } from '@/pages/home/home/index.js';

const AirdropPage = lazy(() => import('@/pages/airdrop/airdrop/index.js').then(m => ({ default: m.AirdropPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard/dashboard/index.js').then(m => ({ default: m.DashboardPage })));
const ProfilePage = lazy(() => import('@/pages/profile/profile/index.js').then(m => ({ default: m.ProfilePage })));
const AchievementsPage = lazy(() => import('@/pages/profile/achievements/index.js').then(m => ({ default: m.AchievementsPage })));
const ReferralPage = lazy(() => import('@/pages/profile/referral/index.js').then(m => ({ default: m.ReferralPage })));
const SettingsPage = lazy(() => import('@/pages/profile/settings/index.js').then(m => ({ default: m.SettingsPage })));
const SecurityPage = lazy(() => import('@/pages/profile/security/index.js').then(m => ({ default: m.SecurityPage })));
const LeaderboardPage = lazy(() => import('@/pages/profile/leaderboard/index.js').then(m => ({ default: m.LeaderboardPage })));
const TasksPage = lazy(() => import('@/pages/profile/tasks/index.js').then(m => ({ default: m.TasksPage })));
const BoostsPage = lazy(() => import('@/pages/profile/boosts/index.js').then(m => ({ default: m.BoostsPage })));
const ManagedBotsPage = lazy(() => import('@/pages/group/managed-bots/index.js').then(m => ({ default: m.ManagedBotsPage })));
const BotManagePage = lazy(() => import('@/pages/group/bot-manage/index.js').then(m => ({ default: m.BotManagePage })));
const GroupDashboardPage = lazy(() => import('@/pages/group/dashboard/index.js').then(m => ({ default: m.GroupDashboardPage })));
const GeneralSettingsPage = lazy(() => import('@/pages/group/general-settings/index.js').then(m => ({ default: m.GeneralSettingsPage })));
const ContentRestrictionsPage = lazy(() => import('@/pages/group/content-restrictions/index.js').then(m => ({ default: m.ContentRestrictionsPage })));
const LimitsPage = lazy(() => import('@/pages/group/limits/index.js').then(m => ({ default: m.LimitsPage })));
const QuietHoursPage = lazy(() => import('@/pages/group/quiet-hours/index.js').then(m => ({ default: m.QuietHoursPage })));
const MandatoryPage = lazy(() => import('@/pages/group/mandatory/index.js').then(m => ({ default: m.MandatoryPage })));
const CustomTextsPage = lazy(() => import('@/pages/group/custom-texts/index.js').then(m => ({ default: m.CustomTextsPage })));
const AnalyticsPage = lazy(() => import('@/pages/group/analytics/index.js').then(m => ({ default: m.AnalyticsPage })));
const MarketplacePage = lazy(() => import('@/pages/marketplace/marketplace/index.js').then(m => ({ default: m.MarketplacePage })));

const ChannelDashboardPage = lazy(() => import('@/pages/channel/dashboard/index.js').then(m => ({ default: m.ChannelDashboardPage })));
const ChannelGeneralSettingsPage = lazy(() => import('@/pages/channel/general-settings/index.js').then(m => ({ default: m.ChannelGeneralSettingsPage })));
const ChannelPostingPage = lazy(() => import('@/pages/channel/posting/index.js').then(m => ({ default: m.ChannelPostingPage })));
const ChannelForwardingPage = lazy(() => import('@/pages/channel/forwarding/index.js').then(m => ({ default: m.ChannelForwardingPage })));
const ChannelAdminsPage = lazy(() => import('@/pages/channel/admins/index.js').then(m => ({ default: m.ChannelAdminsPage })));
const ChannelAnalyticsPage = lazy(() => import('@/pages/channel/analytics/index.js').then(m => ({ default: m.ChannelAnalyticsPage })));
const ChannelInlineButtonsPage = lazy(() => import('@/pages/channel/inline-buttons/index.js').then(m => ({ default: m.ChannelInlineButtonsPage })));
const ChannelDynamicBioPage = lazy(() => import('@/pages/channel/dynamic-bio/index.js').then(m => ({ default: m.ChannelDynamicBioPage })));
const ChannelAutoResponderPage = lazy(() => import('@/pages/channel/auto-responder/index.js').then(m => ({ default: m.ChannelAutoResponderPage })));
const ChannelAuditLogPage = lazy(() => import('@/pages/channel/audit-log/index.js').then(m => ({ default: m.ChannelAuditLogPage })));
const ManagedChannelsPage = lazy(() => import('@/pages/channel/managed-channels/index.js').then(m => ({ default: m.ManagedChannelsPage })));
const ConnectChannelPage = lazy(() => import('@/pages/channel/connect-channel/index.js').then(m => ({ default: m.ConnectChannelPage })));

const CollectionStatsPage = lazy(() => import('@/pages/username/collection-stats/index.js').then(m => ({ default: m.CollectionStatsPage })));
const PremiumReportPage = lazy(() => import('@/pages/username/premium-report/index.js').then(m => ({ default: m.PremiumReportPage })));

const OwnerDashboardPage = lazy(() => import('@/pages/owner/dashboard/index.js').then(m => ({ default: m.OwnerDashboardPage })));
const OwnerUsersPage = lazy(() => import('@/pages/owner/users/index.js').then(m => ({ default: m.OwnerUsersPage })));
const OwnerAuditLogPage = lazy(() => import('@/pages/owner/audit-log/index.js').then(m => ({ default: m.OwnerAuditLogPage })));
const OwnerQuestsPage = lazy(() => import('@/pages/owner/quests/index.js').then(m => ({ default: m.OwnerQuests })));

interface Route {
  path: string;
  Component: Component;
  title?: string;
}

export const routes: Route[] = [
  { path: '/', Component: IndexPage },
  { path: '/username/stats', Component: CollectionStatsPage },
  { path: '/username/report', Component: PremiumReportPage },
  { path: '/airdrop', Component: AirdropPage },
  { path: '/dashboard', Component: DashboardPage },
  { path: '/profile', Component: ProfilePage },
  { path: '/profile/achievements', Component: AchievementsPage },
  { path: '/profile/referral', Component: ReferralPage },
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
  { path: '/managed-channels', Component: ManagedChannelsPage },
  { path: '/channel/connect', Component: ConnectChannelPage },
  { path: '/channel/:id', Component: ChannelDashboardPage },
  { path: '/channel/:id/settings', Component: ChannelGeneralSettingsPage },
  { path: '/channel/:id/posting', Component: ChannelPostingPage },
  { path: '/channel/:id/forwarding', Component: ChannelForwardingPage },
  { path: '/channel/:id/admins', Component: ChannelAdminsPage },
  { path: '/channel/:id/analytics', Component: ChannelAnalyticsPage },
  { path: '/channel/:id/inline-buttons', Component: ChannelInlineButtonsPage },
  { path: '/channel/:id/dynamic-bio', Component: ChannelDynamicBioPage },
  { path: '/channel/:id/auto-responder', Component: ChannelAutoResponderPage },
  { path: '/channel/:id/audit-log', Component: ChannelAuditLogPage },
  { path: '/marketplace', Component: MarketplacePage },
  { path: '/owner/dashboard', Component: OwnerDashboardPage },
  { path: '/owner/users', Component: OwnerUsersPage },
  { path: '/owner/audit-logs', Component: OwnerAuditLogPage },
  { path: '/owner/quests', Component: OwnerQuestsPage },
];
