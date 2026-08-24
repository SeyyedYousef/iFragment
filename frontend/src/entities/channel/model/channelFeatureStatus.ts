/**
 * Single source of truth for channel feature status mapping and capability checks
 */

export interface FeatureCapability {
	id: string;
	titleKey: string;
	descKey: string;
	route: string;
	icon: string;
	isCore: boolean;
	minRole: 'owner' | 'admin' | 'viewer';
}

export const CHANNEL_FEATURES: Record<string, FeatureCapability> = {
	general: {
		id: 'general',
		titleKey: 'channel.features.general.title',
		descKey: 'channel.features.general.desc',
		route: 'general',
		icon: '⚙️',
		isCore: true,
		minRole: 'admin',
	},
	posting: {
		id: 'posting',
		titleKey: 'channel.features.posting.title',
		descKey: 'channel.features.posting.desc',
		route: 'posting',
		icon: '✍️',
		isCore: true,
		minRole: 'admin',
	},
	forwarding: {
		id: 'forwarding',
		titleKey: 'channel.features.forwarding.title',
		descKey: 'channel.features.forwarding.desc',
		route: 'forwarding',
		icon: '🔄',
		isCore: true,
		minRole: 'admin',
	},
	buttons: {
		id: 'buttons',
		titleKey: 'channel.features.buttons.title',
		descKey: 'channel.features.buttons.desc',
		route: 'buttons',
		icon: '🔘',
		isCore: true,
		minRole: 'admin',
	},
	autoResponder: {
		id: 'auto_responder',
		titleKey: 'channel.features.autoResponder.title',
		descKey: 'channel.features.autoResponder.desc',
		route: 'auto-responder',
		icon: '💬',
		isCore: false,
		minRole: 'admin',
	},
	dynamicBio: {
		id: 'dynamic_bio',
		titleKey: 'channel.features.dynamicBio.title',
		descKey: 'channel.features.dynamicBio.desc',
		route: 'dynamic-bio',
		icon: '⏳',
		isCore: false,
		minRole: 'admin',
	},
	analytics: {
		id: 'analytics',
		titleKey: 'channel.features.analytics.title',
		descKey: 'channel.features.analytics.desc',
		route: 'analytics',
		icon: '📊',
		isCore: true,
		minRole: 'viewer',
	},
	admins: {
		id: 'admins',
		titleKey: 'channel.features.admins.title',
		descKey: 'channel.features.admins.desc',
		route: 'admins',
		icon: '👥',
		isCore: true,
		minRole: 'owner',
	},
	members: {
		id: 'members',
		titleKey: 'channel.features.members.title',
		descKey: 'channel.features.members.desc',
		route: 'members',
		icon: '🛡️',
		isCore: false,
		minRole: 'admin',
	},
	health: {
		id: 'health',
		titleKey: 'channel.features.health.title',
		descKey: 'channel.features.health.desc',
		route: 'health',
		icon: '🩺',
		isCore: true,
		minRole: 'viewer',
	},
	audit: {
		id: 'audit',
		titleKey: 'channel.features.audit.title',
		descKey: 'channel.features.audit.desc',
		route: 'audit',
		icon: '📜',
		isCore: true,
		minRole: 'viewer',
	},
};

export function canAccessFeature(userRole: string, requiredRole: 'owner' | 'admin' | 'viewer'): boolean {
	const roleHierarchy: Record<string, number> = {
		owner: 3,
		admin: 2,
		viewer: 1,
	};
	const userLevel = roleHierarchy[userRole] || 0;
	const requiredLevel = roleHierarchy[requiredRole] || 1;
	return userLevel >= requiredLevel;
}
