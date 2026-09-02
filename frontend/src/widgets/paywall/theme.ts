export type PaywallVertical = 'username' | 'number' | 'gift' | 'group' | 'channel' | 'general';

export interface VerticalTheme {
    /** Primary accent hex */
    accent: string;
    /** Accent at low alpha for soft fills */
    accentSoft: string;
    /** Border color derived from accent */
    accentBorder: string;
    /** Linear-gradient stops for primary CTA */
    gradient: string;
    /** rgba glow for shadows */
    glow: string;
    /** Material icon glyph identifying the vertical */
    glyph: string;
}

export const verticalThemes: Record<PaywallVertical, VerticalTheme> = {
    username: {
        accent: '#FFB800',
        accentSoft: 'rgba(255, 184, 0, 0.14)',
        accentBorder: 'rgba(255, 184, 0, 0.38)',
        gradient: 'linear-gradient(135deg, #FFB800 0%, #FF8C00 100%)',
        glow: 'rgba(255, 184, 0, 0.28)',
        glyph: 'alternate_email',
    },
    number: {
        accent: '#0098EA',
        accentSoft: 'rgba(0, 152, 234, 0.14)',
        accentBorder: 'rgba(0, 152, 234, 0.38)',
        gradient: 'linear-gradient(135deg, #0098EA 0%, #0070BA 100%)',
        glow: 'rgba(0, 152, 234, 0.30)',
        glyph: 'tag',
    },
    gift: {
        accent: '#AF52DE',
        accentSoft: 'rgba(175, 82, 222, 0.14)',
        accentBorder: 'rgba(175, 82, 222, 0.38)',
        gradient: 'linear-gradient(135deg, #AF52DE 0%, #7A3AB0 100%)',
        glow: 'rgba(175, 82, 222, 0.30)',
        glyph: 'featured_seasonal_and_gifts',
    },
    group: {
        accent: '#3390EC',
        accentSoft: 'rgba(51, 144, 236, 0.14)',
        accentBorder: 'rgba(51, 144, 236, 0.38)',
        gradient: 'linear-gradient(135deg, #3390EC 0%, #2068B2 100%)',
        glow: 'rgba(51, 144, 236, 0.30)',
        glyph: 'groups',
    },
    channel: {
        accent: '#00C6FF',
        accentSoft: 'rgba(0, 198, 255, 0.14)',
        accentBorder: 'rgba(0, 198, 255, 0.38)',
        gradient: 'linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)',
        glow: 'rgba(0, 198, 255, 0.30)',
        glyph: 'campaign',
    },
    general: {
        accent: '#FFB800',
        accentSoft: 'rgba(255, 184, 0, 0.14)',
        accentBorder: 'rgba(255, 184, 0, 0.38)',
        gradient: 'linear-gradient(135deg, #FFB800 0%, #FF8C00 100%)',
        glow: 'rgba(255, 184, 0, 0.28)',
        glyph: 'diamond',
    },
};
