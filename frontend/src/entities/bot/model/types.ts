export interface ManagedBot {
	id: string;
	owner_user_id: number;
	bot_username: string;
	bot_name: string;
	bot_id: number;
	status: 'active' | 'inactive' | 'revoked';
	managed_groups_count?: number;
	subscription_status?: string;
	created_at: string;
	updated_at: string;
}

export interface SubscriptionPackage {
	id: string;
	name: string;
	duration_months: number;
	price_usd: number;
	price_per_month: number;
	price_stars: number;
	price_coins: number;
	price_credits?: number;
	price_frg: number;
	discount?: string;
	badge?: 'popular' | 'best_value';
}
