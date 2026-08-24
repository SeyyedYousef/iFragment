/**
 * iFragment Economic Model & Pricing Configuration
 *
 * Fundamental Law:
 * 1 Intel Credit = 1 Comprehensive Valuation / Intelligence Report across any vertical (Usernames, Numbers, Gifts).
 * Credits never expire.
 *
 * Formula for Coin Report Pricing:
 * P_report = 10 * E
 * Where:
 * E = Average daily coins earned by an active player (Placeholder: 1500 coins/day).
 * Therefore:
 * Base Report Price = 15,000 Coins.
 * First Report Discount = 50% (7,500 Coins) -> Onboarding hook.
 * Stale Report Refresh (>7 days) = 50% (7,500 Coins).
 *
 * Stars Credit Packages:
 * - Starter Pack: 100 Stars = 3 Credits (33.3 Stars/credit)
 * - Pro Value Pack: 250 Stars = 10 Credits (25 Stars/credit, ~25% savings per unit)
 * - Pro Monthly Pass: 90 Credits (3/day) + 2x Coin Earning Multiplier
 *
 * Coin Expiry & Anti-Abuse:
 * - Coin Expiry Period = 30 days
 * - Warning Notification Trigger = Day 25
 * - Max daily farm cap & server-side validation.
 * - Referral ladder: 1 fren = X, 3 frens = Y + 1 Report Credit, 10 frens = Z.
 */

export interface StarsPack {
	id: string;
	stars: number;
	credits: number;
	titleKey: string;
	descKey: string;
	badgeKey?: string;
	isPopular?: boolean;
	unitPriceStars: number;
	earnMultiplier?: number;
}

export interface ReferralLadderStep {
	invites: number;
	rewardCoins: number;
	bonusCredits?: number;
}

export const ECONOMY_CONFIG = {
	// Average daily active earnings parameter E (estimated from mining + tasks)
	BASE_DAILY_EARNING_E: 1500,
	E_DAILY_ACTIVE_EARNINGS: 1500,

	// Coin price for full report purchase
	REPORT_COIN_PRICE: 15000,
	FIRST_REPORT_COIN_PRICE: 7500,
	REFRESH_STALE_COIN_PRICE: 7500,
	STALE_REPORT_DAYS_THRESHOLD: 7,

	// Stars Credit Packs
	STARS_PACKS: {
		STARTER: {
			id: 'pack_starter_3',
			stars: 100,
			credits: 3,
			titleKey: 'economy.pack_starter_title',
			descKey: 'economy.pack_starter_desc',
			unitPriceStars: 33.3,
			badgeKey: 'economy.pack_starter_badge',
			isPopular: false,
		},
		PRO_VALUE: {
			id: 'pack_value_10',
			stars: 250,
			credits: 10,
			titleKey: 'economy.pack_value_title',
			descKey: 'economy.pack_value_desc',
			unitPriceStars: 25,
			badgeKey: 'economy.pack_value_badge',
			isPopular: true,
		},
		PRO_MONTHLY: {
			id: 'pro',
			stars: 249,
			durationDays: 30,
			dailyCredits: 3,
			credits: 90,
			totalCredits: 90,
			earnMultiplier: 2.0,
			coinMultiplier: 2.0,
			titleKey: 'economy.pro_subscription_title',
			descKey: 'economy.pro_subscription_desc',
			unitPriceStars: 2.76,
		},
	},

	// Pro Subscription (Monthly)
	PRO_SUBSCRIPTION: {
		stars: 249,
		durationDays: 30,
		dailyCredits: 3,
		totalCredits: 90,
		coinMultiplier: 2,
		titleKey: 'economy.pro_subscription_title',
		descKey: 'economy.pro_subscription_desc',
	},

	// Coin Expiration
	COIN_EXPIRY_DAYS: 30,
	COIN_EXPIRY_WARNING_DAY: 25,

	// Referral Ladder
	REFERRAL_LADDER: [
		{ invites: 1, rewardCoins: 2500, bonusCredits: 0 },
		{ invites: 3, rewardCoins: 7500, bonusCredits: 1 },
		{ invites: 10, rewardCoins: 30000, bonusCredits: 3 },
	] as ReferralLadderStep[],
};

/**
 * Calculates the required coin amount to unlock or refresh a valuation report.
 */
export const calculateReportCoinPrice = (isFirstReport: boolean = false, reportAgeDays: number = 0): number => {
	if (isFirstReport || reportAgeDays > ECONOMY_CONFIG.STALE_REPORT_DAYS_THRESHOLD) {
		return ECONOMY_CONFIG.FIRST_REPORT_COIN_PRICE;
	}
	return ECONOMY_CONFIG.REPORT_COIN_PRICE;
};
