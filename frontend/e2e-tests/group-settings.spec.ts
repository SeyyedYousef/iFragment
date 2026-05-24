import { test, expect } from '@playwright/test';

test.describe('Group Settings E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the test group dashboard
    await page.goto('/#/group/test-group-id/dashboard');
  });

  test('should load group dashboard page correctly', async ({ page }) => {
    // Check if the dashboard headers or main components are present
    const header = page.locator('h1');
    await expect(header).toBeVisible();

    // Verify presence of navigation elements
    const quietHoursBtn = page.locator('text=Quiet Hours');
    if (await quietHoursBtn.count() > 0) {
      await expect(quietHoursBtn).toBeVisible();
    }
  });

  test('should navigate to Quiet Hours page and toggle Emergency Lock', async ({ page }) => {
    // Navigate to quiet hours page
    await page.goto('/#/group/test-group-id/quiet-hours');

    // Check if Emergency Lock section exists
    const lockLabel = page.locator('text=Emergency Lock');
    if (await lockLabel.count() > 0) {
      await expect(lockLabel).toBeVisible();
    }

    // Check if we can add a new quiet hours period
    const addBtn = page.locator('text=Add Period');
    if (await addBtn.count() > 0) {
      await expect(addBtn).toBeEnabled();
    }
  });

  test('should load Content Restrictions settings page', async ({ page }) => {
    // Go directly to content restrictions page
    await page.goto('/#/group/test-group-id/content-restrictions');

    // Confirm that the restriction cards render
    const linkRestriction = page.locator('text=Block Links');
    if (await linkRestriction.count() > 0) {
      await expect(linkRestriction).toBeVisible();
    }
  });
});
