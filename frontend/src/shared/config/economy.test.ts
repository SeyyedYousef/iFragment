import { describe, expect, it } from 'vitest';
import { calculateReportCoinPrice, ECONOMY_CONFIG } from './economy.js';

describe('Economy Config & Formula Engine', () => {
	it('should maintain standard baseline daily mining emission E = 15000', () => {
		expect(ECONOMY_CONFIG.BASE_DAILY_EARNING_E).toBe(15000);
	});

	it('should calculate report price as exactly 10 * E = 150,000 coins for regular reports', () => {
		expect(ECONOMY_CONFIG.REPORT_COIN_PRICE).toBe(150000);
		expect(calculateReportCoinPrice(false, 0)).toBe(150000);
	});

	it('should apply 50% discount (75,000 coins) for first reports', () => {
		expect(ECONOMY_CONFIG.FIRST_REPORT_COIN_PRICE).toBe(75000);
		expect(calculateReportCoinPrice(true, 0)).toBe(75000);
	});

	it('should apply 50% discount for stale reports older than 7 days', () => {
		expect(calculateReportCoinPrice(false, 8)).toBe(75000);
		expect(calculateReportCoinPrice(false, 6)).toBe(150000);
	});

	it('should provide correct Telegram Stars Intel packs with proper credit quantities', () => {
		expect(ECONOMY_CONFIG.STARS_PACKS.STARTER.stars).toBe(100);
		expect(ECONOMY_CONFIG.STARS_PACKS.STARTER.credits).toBe(3);

		expect(ECONOMY_CONFIG.STARS_PACKS.PRO_VALUE.stars).toBe(250);
		expect(ECONOMY_CONFIG.STARS_PACKS.PRO_VALUE.credits).toBe(10);

		expect(ECONOMY_CONFIG.STARS_PACKS.PRO_MONTHLY.stars).toBe(249);
		expect(ECONOMY_CONFIG.STARS_PACKS.PRO_MONTHLY.credits).toBe(90);
		expect(ECONOMY_CONFIG.STARS_PACKS.PRO_MONTHLY.earnMultiplier).toBe(2.0);
	});

	it('should define structured referral ladder milestones with bonus credits', () => {
		const ladder = ECONOMY_CONFIG.REFERRAL_LADDER;
		expect(ladder.length).toBeGreaterThanOrEqual(3);
		expect(ladder[0].invites).toBe(1);
		expect(ladder[0].rewardCoins).toBe(10000);

		expect(ladder[1].invites).toBe(3);
		expect(ladder[1].rewardCoins).toBe(30000);
		expect(ladder[1].bonusCredits).toBe(1);

		expect(ladder[2].invites).toBe(10);
		expect(ladder[2].rewardCoins).toBe(100000);
		expect(ladder[2].bonusCredits).toBe(3);
	});
});
