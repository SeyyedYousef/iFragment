/**
 * Stars & Coin Discount Engine
 *
 * Exchange Calibration:
 * - 49 Stars = $0.63 USD (~$0.01286 / Star)
 * - 245 Stars = $3.18 USD (~$0.01298 / Star)
 * - Base rate: 1 USD ≈ 77.5 Telegram Stars ($0.0129 per Star)
 *
 * Coin Valuation:
 * - 1 USD of discount = 80,000 Airdrop Coins
 * - 1 Star of discount = 1,032 Airdrop Coins (~80,000 / 77.5)
 */

export const STARS_PER_USD = 77.5;
export const COINS_PER_USD = 80000;
export const COINS_PER_STAR_DISCOUNT = 1032;

export const usdToStars = (usd: number): number => {
	return Math.max(1, Math.round(usd * STARS_PER_USD));
};

export interface DiscountTier {
	percent: 20 | 35 | 50 | 70;
	label: string;
	coinsMultiplier: number;
}

export const DISCOUNT_TIERS: DiscountTier[] = [
	{ percent: 20, label: '20%', coinsMultiplier: 0.2 },
	{ percent: 35, label: '35%', coinsMultiplier: 0.35 },
	{ percent: 50, label: '50%', coinsMultiplier: 0.5 },
	{ percent: 70, label: '70% (MAX)', coinsMultiplier: 0.7 },
];

export interface DiscountCalculation {
	baseStars: number;
	baseUsd: number;
	discountPercent: number;
	savedStars: number;
	finalStars: number;
	savedUsd: number;
	finalUsd: number;
	requiredCoins: number;
}

export const calculateDiscountForPlan = (
	usdPrice: number,
	discountPercent: number,
	customBaseStars?: number,
): DiscountCalculation => {
	const baseStars = customBaseStars && customBaseStars > 0 ? customBaseStars : usdToStars(usdPrice);
	const clampedPercent = Math.min(70, Math.max(0, discountPercent));

	if (clampedPercent <= 0) {
		return {
			baseStars,
			baseUsd: usdPrice,
			discountPercent: 0,
			savedStars: 0,
			finalStars: baseStars,
			savedUsd: 0,
			finalUsd: usdPrice,
			requiredCoins: 0,
		};
	}

	const savedStars = Math.round((baseStars * clampedPercent) / 100);
	const finalStars = Math.max(1, baseStars - savedStars);
	const requiredCoins = savedStars * COINS_PER_STAR_DISCOUNT;
	const savedUsd = (usdPrice * clampedPercent) / 100;
	const finalUsd = Math.max(0.01, usdPrice - savedUsd);

	return {
		baseStars,
		baseUsd: usdPrice,
		discountPercent: clampedPercent,
		savedStars,
		finalStars,
		savedUsd,
		finalUsd,
		requiredCoins,
	};
};
