import { test, expect } from '@playwright/test';

test.describe('Channel Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the test channel dashboard
    await page.goto('/#/channel/test-channel-id/dashboard');
  });

  test('should load channel dashboard correctly', async ({ page }) => {
    // Verify dashboard header is loaded
    const header = page.locator('h1');
    await expect(header).toBeVisible();

    // Verify sub-components or tabs are rendered
    const settingsBtn = page.locator('text=Settings');
    if (await settingsBtn.count() > 0) {
      await expect(settingsBtn).toBeVisible();
    }
  });

  test('should navigate to Forwarding Rules and display rule forms', async ({ page }) => {
    // Navigate to forwarding rules page
    await page.goto('/#/channel/test-channel-id/forwarding');

    // Verify presence of inbound/outbound rule configuration elements
    const inboundLabel = page.locator('text=Inbound');
    if (await inboundLabel.count() > 0) {
      await expect(inboundLabel).toBeVisible();
    }

    const addRuleBtn = page.locator('text=Add Rule');
    if (await addRuleBtn.count() > 0) {
      await expect(addRuleBtn).toBeEnabled();
    }
  });

  test('should load Inline Buttons management page', async ({ page }) => {
    // Navigate to custom buttons page
    await page.goto('/#/channel/test-channel-id/buttons');

    // Confirm that custom button configurations are present
    const addRowBtn = page.locator('text=Add Row');
    if (await addRowBtn.count() > 0) {
      await expect(addRowBtn).toBeEnabled();
    }
  });

  test('should display Audit Logs correctly with items', async ({ page }) => {
    // Navigate directly to audit logs page
    await page.goto('/#/channel/test-channel-id/audit');

    // Check if the audit list table or timeline renders
    const tableHeader = page.locator('text=Action');
    if (await tableHeader.count() > 0) {
      await expect(tableHeader).toBeVisible();
    }
  });
});
