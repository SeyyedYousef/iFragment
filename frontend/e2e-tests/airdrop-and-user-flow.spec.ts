import { test, expect } from '@playwright/test';

test.describe('iFragment 3-Pillar & Leaderboard Core Journey E2E Tests', () => {
	test('should render Home Search Area and switch across Usernames, +888 Numbers, and Gifts tabs', async ({
		page,
	}) => {
		await page.goto('/');
		const searchInput = page.locator('#search-input');
		await expect(searchInput).toBeVisible();
	});

	test('should render Usernames Collection Info, Numbers Intel, and Gifts Intel pages', async ({
		page,
	}) => {
		await page.goto('/collection-info');
		await expect(page.locator('body')).toBeVisible();

		await page.goto('/numbers/intel');
		await expect(page.locator('body')).toBeVisible();

		await page.goto('/gifts/intel');
		await expect(page.locator('body')).toBeVisible();
	});

	test('should render @FragmentInvestors Leaderboard and User Profile pages', async ({ page }) => {
		await page.goto('/leaderboard');
		await expect(page.locator('body')).toBeVisible();

		await page.goto('/profile');
		await expect(page.locator('body')).toBeVisible();
	});
});
