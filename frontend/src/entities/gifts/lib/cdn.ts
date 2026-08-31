/**
 * CDN image helpers for Telegram Gifts from cdn.changes.tg
 */

export function getGiftCdnImageUrl(slugOrName: string): string {
	if (!slugOrName) return '';
	const s = slugOrName.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
	return `https://cdn.changes.tg/gift/${s}.png`;
}

export function getModelCdnImageUrl(giftSlug: string, modelNameOrId: string): string {
	if (!giftSlug || !modelNameOrId) return '';
	const g = giftSlug.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
	const m = modelNameOrId.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '');
	return `https://cdn.changes.tg/model/${g}/${m}.png`;
}
