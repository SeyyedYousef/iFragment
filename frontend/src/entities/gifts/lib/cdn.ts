import { OFFICIAL_GIFTS_120 } from '../model/catalog120.js';

/**
 * Real CDN image helpers for Telegram Gifts from api.changes.tg and backend proxy
 */

export function getGiftCdnImageUrl(slugOrName: string, modelName?: string): string {
	if (!slugOrName) return '';
	const cleanSlug = slugOrName.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
	const item = OFFICIAL_GIFTS_120.find((g) => g.slug === cleanSlug || g.name.toLowerCase() === slugOrName.toLowerCase());
	const model = modelName || item?.primaryModel || '1';
	return `https://api.changes.tg/model/${cleanSlug}/${encodeURIComponent(model)}.png?size=256`;
}

export function getGiftProxyImageUrl(slugOrName: string): string {
	if (!slugOrName) return '';
	const cleanSlug = slugOrName.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
	return `/api/v1/gifts/image/${cleanSlug}`;
}

export function getModelCdnImageUrl(giftSlug: string, modelNameOrId: string): string {
	if (!giftSlug || !modelNameOrId) return '';
	const g = giftSlug.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
	return `https://api.changes.tg/model/${g}/${encodeURIComponent(modelNameOrId)}.png?size=256`;
}
