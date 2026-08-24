import { describe, expect, it } from 'vitest';
import { ECONOMY_CONFIG, calculateReportCoinPrice } from './economy.js';

describe('Economy Config & Formula Engine', () => {
	it('should maintain standard baseline daily mining emission E = 1500', () => {
		expect(ECONOMY_CONFIG.BASE_DAILY_EARNING_E).toBe(1500);
	});

	it('should calculate report price as exactly 10 * E = 15,000 coins for regular reports', () => {
		expect(ECONOMY_CONFIG.REPORT_COIN_PRICE).toBe(15000);
		expect(calculateReportCoinPrice(false, 0)).toBe(15000);
	});

	it('should apply 50% discount (7,500 coins) for first reports', () => {
		expect(ECONOMY_CONFIG.FIRST_REPORT_COIN_PRICE).toBe(7500);
		expect(calculateReportCoinPrice(true, 0)).toBe(7500);
	});

	it('should apply 50% discount for stale reports older than 7 days', () => {
		expect(calculateReportCoinPrice(false, 8)).toBe(7500);
		expect(calculateReportCoinPrice(false, 6)).toBe(15000);
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
		expect(ladder[0].rewardCoins).toBe(2500);

		expect(ladder[1].invites).toBe(3);
		expect(ladder[1].rewardCoins).toBe(7500);
		expect(ladder[1].bonusCredits).toBe(1);

		expect(ladder[2].invites).toBe(10);
		expect(ladder[2].rewardCoins).toBe(30000);
		expect(ladder[2].bonusCredits).toBe(3);
	});
});
