export type PaywallVertical = 'username' | 'number' | 'gift' | 'general';

export interface VerticalTheme {
	accent: string;
	accentSoft: string;
	accentBorder: string;
	gradient: string;
	glow: string;
	glyph: string;
}

export const verticalThemes: Record<PaywallVertical, VerticalTheme> = {
	username: {
		accent: '#4db2ff',
		accentSoft: 'rgba(77, 178, 255, 0.1)',
		accentBorder: 'rgba(77, 178, 255, 0.25)',
		gradient: '#248bda',
		glow: 'transparent',
		glyph: 'alternate_email',
	},
	number: {
		accent: '#5aec8c',
		accentSoft: 'rgba(90, 236, 140, 0.1)',
		accentBorder: 'rgba(90, 236, 140, 0.25)',
		gradient: '#248bda',
		glow: 'transparent',
		glyph: 'tag',
	},
	gift: {
		accent: '#ff9953',
		accentSoft: 'rgba(255, 153, 83, 0.1)',
		accentBorder: 'rgba(255, 153, 83, 0.25)',
		gradient: '#248bda',
		glow: 'transparent',
		glyph: 'featured_seasonal_and_gifts',
	},
	general: {
		accent: '#4db2ff',
		accentSoft: 'rgba(77, 178, 255, 0.1)',
		accentBorder: 'rgba(77, 178, 255, 0.25)',
		gradient: '#248bda',
		glow: 'transparent',
		glyph: 'diamond',
	},
};
