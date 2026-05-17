import type { Component } from 'solid-js';

import { lazy } from 'solid-js';

import { IndexPage } from '@/pages/home/home/index.js';

const AirdropPage = lazy(() => import('@/pages/airdrop/airdrop/index.js').then(m => ({ default: m.AirdropPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard/dashboard/index.js').then(m => ({ default: m.DashboardPage })));
const ProfilePage = lazy(() => import('@/pages/profile/profile/index.js').then(m => ({ default: m.ProfilePage })));
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

const CollectionStatsPage = lazy(() => import('@/pages/username/collection-stats/index.js').then(m => ({ default: m.CollectionStatsPage })));
const PremiumReportPage = lazy(() => import('@/pages/username/premium-report/index.js').then(m => ({ default: m.PremiumReportPage })));

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
  { path: '/marketplace', Component: MarketplacePage },
];
