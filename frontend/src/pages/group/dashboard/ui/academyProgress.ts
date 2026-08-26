import type { GroupSettings } from '@/entities/group/index.js';

export interface AcademyLesson {
	key: string;
	titleKey: string;
	descKey: string;
	icon: string;
	path: (groupId: string) => string;
	done: (settings: GroupSettings | null | undefined) => boolean;
}

export const ACADEMY_LESSONS: AcademyLesson[] = [
	{
		key: 'ephemeral',
		titleKey: 'groupDashboard.lessons.ephemeralTitle',
		descKey: 'groupDashboard.lessons.ephemeralDesc',
		icon: 'visibility_off',
		path: (groupId) => `/group/${groupId}/settings`,
		done: (s) => {
			if (!s?.general) return false;
			const g = s.general as any;
			return !!(
				g.ephemeralAll ||
				g.ephemeralWelcome ||
				g.ephemeralWarnings ||
				g.ephemeralCaptcha ||
				g.ephemeralAdminCmd ||
				g.welcome_message
			);
		},
	},
	{
		key: 'antiSpam',
		titleKey: 'groupDashboard.lessons.antiSpamTitle',
		descKey: 'groupDashboard.lessons.antiSpamDesc',
		icon: 'shield',
		path: (groupId) => `/group/${groupId}/content`,
		done: (s) => {
			if (!s) return false;
			const cr = (s.content_restrictions || {}) as any;
			const g = (s.general || {}) as any;
			return !!(
				cr.removeLinks?.enabled ||
				cr.blockDomains?.enabled ||
				cr.blockBots?.enabled ||
				g.casEnabled
			);
		},
	},
	{
		key: 'quietHours',
		titleKey: 'groupDashboard.lessons.quietHoursTitle',
		descKey: 'groupDashboard.lessons.quietHoursDesc',
		icon: 'bedtime',
		path: (groupId) => `/group/${groupId}/quiet`,
		done: (s) => {
			if (!s?.quiet_hours) return false;
			const qh = s.quiet_hours as any;
			return !!(qh.periods && qh.periods.length > 0) || !!qh.emergencyLock;
		},
	},
	{
		key: 'limits',
		titleKey: 'groupDashboard.lessons.limitsTitle',
		descKey: 'groupDashboard.lessons.limitsDesc',
		icon: 'speed',
		path: (groupId) => `/group/${groupId}/limits`,
		done: (s) => {
			if (!s?.limits) return false;
			const l = s.limits as any;
			return (
				(l.floodMessages > 0 && l.floodMessages !== 10) || l.maxMessageLength > 0 || l.slowMode > 0
			);
		},
	},
	{
		key: 'mandatory',
		titleKey: 'groupDashboard.lessons.mandatoryTitle',
		descKey: 'groupDashboard.lessons.mandatoryDesc',
		icon: 'how_to_reg',
		path: (groupId) => `/group/${groupId}/mandatory`,
		done: (s) => {
			if (!s?.mandatory_membership) return false;
			const m = s.mandatory_membership as any;
			return (
				!!(m.required_channels && m.required_channels.length > 0) ||
				!!m.forced_add_enabled ||
				!!m.verification_enabled
			);
		},
	},
	{
		key: 'customTexts',
		titleKey: 'groupDashboard.lessons.customTextsTitle',
		descKey: 'groupDashboard.lessons.customTextsDesc',
		icon: 'edit_note',
		path: (groupId) => `/group/${groupId}/settings/custom-texts`,
		done: (s) => {
			if (!s?.custom_texts) return false;
			const ct = s.custom_texts as any;
			return !!(ct.welcomeText || ct.warningText || ct.rulesText || ct.silenceStartText);
		},
	},
	{
		key: 'dynamicBio',
		titleKey: 'groupDashboard.lessons.dynamicBioTitle',
		descKey: 'groupDashboard.lessons.dynamicBioDesc',
		icon: 'badge',
		path: (groupId) => `/group/${groupId}/dynamic-bio`,
		done: (s) => {
			if (!s) return false;
			const db = (s as any).dynamic_bio;
			return !!db?.enabled;
		},
	},
];

export function calculateAcademyProgress(settings: GroupSettings | null | undefined): {
	completedCount: number;
	totalCount: number;
	percentage: number;
	lessons: Array<{ key: string; done: boolean; path: string }>;
} {
	if (!settings) {
		return {
			completedCount: 0,
			totalCount: ACADEMY_LESSONS.length,
			percentage: 0,
			lessons: ACADEMY_LESSONS.map((l) => ({ key: l.key, done: false, path: l.path('') })),
		};
	}

	const lessons = ACADEMY_LESSONS.map((l) => ({
		key: l.key,
		done: l.done(settings),
		path: l.path(settings.group_id),
	}));

	const completedCount = lessons.filter((l) => l.done).length;
	const percentage = Math.round((completedCount / ACADEMY_LESSONS.length) * 100);

	return {
		completedCount,
		totalCount: ACADEMY_LESSONS.length,
		percentage,
		lessons,
	};
}
