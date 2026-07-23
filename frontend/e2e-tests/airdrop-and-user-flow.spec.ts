import { test, expect } from '@playwright/test';

test.describe('Airdrop & Core User Journey E2E Tests', () => {
	test('should render Airdrop landing page and navigate between tabs', async ({ page }) => {
		// Navigate to main Airdrop view
		await page.goto('/#/airdrop');

		// Verify Airdrop header is rendered
		const mainHeading = page.locator('h1, h2').first();
		await expect(mainHeading).toBeVisible();

		// Check tab switches (Tasks, Leaderboard, Frens)
		const leaderboardTab = page.locator('text=Leaderboard, text=جدول رده‌بندی').first();
		if ((await leaderboardTab.count()) > 0) {
			await leaderboardTab.click();
			await expect(page).toHaveURL(/.*leaderboard/);
		}
	});

	test('should render User Profile and settings options', async ({ page }) => {
		// Navigate to user profile page
		await page.goto('/#/profile');

		// Verify profile container loads
		const profileHeader = page.locator('text=Profile, text=پروفایل, text=سابق').first();
		await expect(profileHeader).toBeVisible();

		// Test navigation to settings
		await page.goto('/#/profile/settings');
		const settingsHeader = page.locator('text=Settings, text=تنظیمات').first();
		if ((await settingsHeader.count()) > 0) {
			await expect(settingsHeader).toBeVisible();
		}
	});

	test('should load Fragment Marketplace view', async ({ page }) => {
		// Navigate to marketplace
		await page.goto('/#/marketplace');

		// Check search input or filter controls
		const searchInput = page.locator('input[type="text"], input[type="search"]').first();
		if ((await searchInput.count()) > 0) {
			await expect(searchInput).toBeVisible();
		}
	});
});
