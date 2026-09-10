import { render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { SettingsPage } from './SettingsPage.jsx';

// Mock routing, TMA SDK, and i18n
vi.mock('@solidjs/router', () => ({
	useNavigate: () => vi.fn(),
}));

vi.mock('@tma.js/sdk-solid', () => ({
	backButton: {
		show: vi.fn(),
		hide: vi.fn(),
		onClick: vi.fn(),
		offClick: vi.fn(),
	},
}));

vi.mock('@/shared/i18n/index.js', () => ({
	t: (key: string) => key,
	locale: () => 'en',
	setLocale: vi.fn(),
	isRtl: () => false,
}));

vi.mock('@/shared/lib/telegram-native.js', () => ({
	requestWriteAccess: vi.fn().mockResolvedValue(true),
	showAlert: vi.fn().mockResolvedValue(undefined),
	enableClosingConfirmation: vi.fn(),
	disableClosingConfirmation: vi.fn(),
}));

describe('SettingsPage Component', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('renders settings headers and categories', () => {
		render(() => <SettingsPage />);
		expect(screen.getByText('settings.title')).toBeInTheDocument();
		expect(screen.getByText('settings.general')).toBeInTheDocument();
		expect(screen.getByText('settings.hapticFeedback')).toBeInTheDocument();
		expect(screen.getByText('settings.soundEffects')).toBeInTheDocument();
		expect(screen.getByText('settings.animations')).toBeInTheDocument();
		expect(screen.getByText('settings.notifications')).toBeInTheDocument();
	});
});
