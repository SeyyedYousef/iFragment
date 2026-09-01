import { API_CONFIG } from '@/shared/api/config.js';
import { OFFICIAL_GIFTS_120 } from '../model/catalog120.js';

/**
 * Real CDN image helpers for Telegram Gifts from api.changes.tg and backend proxy
 */

export function getGiftCdnImageUrl(slugOrName: string, modelName?: string): string {
	if (!slugOrName) return '';
	const cleanSlug = slugOrName.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
	const item = OFFICIAL_GIFTS_120.find(
		(g) =>
			g.slug === cleanSlug ||
			g.slug.replace(/-/g, '') === cleanSlug.replace(/-/g, '') ||
			g.name.toLowerCase() === slugOrName.toLowerCase() ||
			g.name.toLowerCase().replace(/[^a-z0-9]/g, '') === slugOrName.toLowerCase().replace(/[^a-z0-9]/g, ''),
	);
	const model = modelName || item?.primaryModel || '1';
	const realSlug = item?.slug || cleanSlug;
	return `https://api.changes.tg/model/${realSlug}/${encodeURIComponent(model)}.png?size=256`;
}

export function getGiftProxyImageUrl(slugOrName: string): string {
	if (!slugOrName) return '';
	const cleanSlug = slugOrName.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
	return `${API_CONFIG.BASE_URL}/gifts/image/${cleanSlug}`;
}

export function getModelCdnImageUrl(giftSlug: string, modelNameOrId: string): string {
	if (!giftSlug || !modelNameOrId) return '';
	const g = giftSlug.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
	return `https://api.changes.tg/model/${g}/${encodeURIComponent(modelNameOrId)}.png?size=256`;
}

