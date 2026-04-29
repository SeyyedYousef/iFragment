import type { Component } from 'solid-js';

import { IndexPage } from '@/pages/IndexPage/IndexPage.js';
import { AirdropPage } from '@/pages/AirdropPage/AirdropPage.js';
import { DashboardPage } from '@/pages/DashboardPage/DashboardPage.js';
import { ProfilePage } from '@/pages/ProfilePage/ProfilePage.js';
import { ManagedBotsPage } from '@/pages/ManagedBotsPage/index.js';
import { BotManagePage } from '@/pages/BotManagePage/index.js';
import { GroupDashboardPage } from '@/pages/GroupDashboardPage/index.js';
import { GeneralSettingsPage } from '@/pages/GeneralSettingsPage/index.js';
import { ContentRestrictionsPage } from '@/pages/ContentRestrictionsPage/index.js';
import { LimitsPage } from '@/pages/LimitsPage/index.js';
import { QuietHoursPage } from '@/pages/QuietHoursPage/index.js';
import { MandatoryPage } from '@/pages/MandatoryPage/index.js';
import { CustomTextsPage } from '@/pages/CustomTextsPage/index.js';
import { AnalyticsPage } from '@/pages/AnalyticsPage/index.js';

interface Route {
  path: string;
  Component: Component;
  title?: string;
}

export const routes: Route[] = [
  { path: '/', Component: IndexPage },
  { path: '/airdrop', Component: AirdropPage },
  { path: '/dashboard', Component: DashboardPage },
  { path: '/profile', Component: ProfilePage },
  { path: '/managed-bots', Component: ManagedBotsPage },
  { path: '/managed-bots/:id', Component: BotManagePage },
  { path: '/group/:id', Component: GroupDashboardPage },
  { path: '/group/:id/settings/general', Component: GeneralSettingsPage },
  { path: '/group/:id/settings/content-restrictions', Component: ContentRestrictionsPage },
  { path: '/group/:id/settings/limits', Component: LimitsPage },
  { path: '/group/:id/settings/quiet-hours', Component: QuietHoursPage },
  { path: '/group/:id/settings/mandatory-membership', Component: MandatoryPage },
  { path: '/group/:id/settings/custom-texts', Component: CustomTextsPage },
  { path: '/group/:id/settings/analytics', Component: AnalyticsPage },
];
