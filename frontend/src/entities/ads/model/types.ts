export interface AdCampaign {
	id: string;
	slot: string;
	title: string;
	alt_text: string;
	image_url: string;
	target_url: string;
	is_active: boolean;
	priority: number;
	start_date?: string | null;
	end_date?: string | null;
	impressions_count: number;
	clicks_count: number;
	created_at: string;
	updated_at: string;
}
