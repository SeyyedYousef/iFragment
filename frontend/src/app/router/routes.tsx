import type { Component } from 'solid-js';

import { lazy } from 'solid-js';

import { IndexPage } from '@/pages/IndexPage/IndexPage.js';

const AirdropPage = lazy(() => import('@/pages/AirdropPage/AirdropPage.js').then(m => ({ default: m.AirdropPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage/DashboardPage.js').then(m => ({ default: m.DashboardPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage/ProfilePage.js').then(m => ({ default: m.ProfilePage })));
const ManagedBotsPage = lazy(() => import('@/pages/ManagedBotsPage/index.js').then(m => ({ default: m.ManagedBotsPage })));
const BotManagePage = lazy(() => import('@/pages/BotManagePage/index.js').then(m => ({ default: m.BotManagePage })));
const GroupDashboardPage = lazy(() => import('@/pages/GroupDashboardPage/index.js').then(m => ({ default: m.GroupDashboardPage })));
const GeneralSettingsPage = lazy(() => import('@/pages/GeneralSettingsPage/index.js').then(m => ({ default: m.GeneralSettingsPage })));
const ContentRestrictionsPage = lazy(() => import('@/pages/ContentRestrictionsPage/index.js').then(m => ({ default: m.ContentRestrictionsPage })));
const LimitsPage = lazy(() => import('@/pages/LimitsPage/index.js').then(m => ({ default: m.LimitsPage })));
const QuietHoursPage = lazy(() => import('@/pages/QuietHoursPage/index.js').then(m => ({ default: m.QuietHoursPage })));
const MandatoryPage = lazy(() => import('@/pages/MandatoryPage/index.js').then(m => ({ default: m.MandatoryPage })));
const CustomTextsPage = lazy(() => import('@/pages/CustomTextsPage/index.js').then(m => ({ default: m.CustomTextsPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage/index.js').then(m => ({ default: m.AnalyticsPage })));
const MarketplacePage = lazy(() => import('@/pages/MarketplacePage/index.js').then(m => ({ default: m.MarketplacePage })));

const CollectionStatsPage = lazy(() => import('@/pages/CollectionStatsPage/CollectionStatsPage.js').then(m => ({ default: m.CollectionStatsPage })));
const PremiumReportPage = lazy(() => import('@/pages/PremiumReportPage/PremiumReportPage.js').then(m => ({ default: m.PremiumReportPage })));

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
