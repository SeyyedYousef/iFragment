export const BORDER_CLASSES: Record<string, string> = {
	gold_shimmer: 'border-gold-shimmer',
	cyber_glow: 'border-cyber-glow',
	rainbow_wave: 'border-rainbow-wave',
};

export const SKIN_CLASSES: Record<string, string> = {
	cosmic_void: 'bg-cosmic-void',
	neon_matrix: 'bg-neon-matrix',
};

export const getBorderClass = (id?: string | null): string => {
	return (id && BORDER_CLASSES[id]) || '';
};

export const getSkinClass = (id?: string | null): string => {
	return (id && SKIN_CLASSES[id]) || '';
};
