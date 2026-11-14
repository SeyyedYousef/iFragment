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
		accent: '#2990FF',
		accentSoft: 'rgba(41, 144, 255, 0.12)',
		accentBorder: 'rgba(41, 144, 255, 0.35)',
		gradient: 'linear-gradient(180deg, #359bff 0%, #2481cc 100%)',
		glow: 'rgba(41, 144, 255, 0.24)',
		glyph: 'alternate_email',
	},
	number: {
		accent: '#32d74b',
		accentSoft: 'rgba(50, 215, 75, 0.12)',
		accentBorder: 'rgba(50, 215, 75, 0.32)',
		gradient: 'linear-gradient(180deg, #359bff 0%, #2481cc 100%)',
		glow: 'rgba(41, 144, 255, 0.24)',
		glyph: 'tag',
	},
	gift: {
		accent: '#ffb340',
		accentSoft: 'rgba(255, 179, 64, 0.12)',
		accentBorder: 'rgba(255, 179, 64, 0.34)',
		gradient: 'linear-gradient(180deg, #359bff 0%, #2481cc 100%)',
		glow: 'rgba(41, 144, 255, 0.24)',
		glyph: 'featured_seasonal_and_gifts',
	},
	general: {
		accent: '#2990FF',
		accentSoft: 'rgba(41, 144, 255, 0.12)',
		accentBorder: 'rgba(41, 144, 255, 0.35)',
		gradient: 'linear-gradient(180deg, #359bff 0%, #2481cc 100%)',
		glow: 'rgba(41, 144, 255, 0.24)',
		glyph: 'diamond',
	},
};
