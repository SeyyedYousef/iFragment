import { render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupApi } from '@/shared/api/bot-management.js';
import { GeneralSettingsPage } from './GeneralSettingsPage.js';

vi.mock('@solidjs/router', () => ({
	useParams: () => ({ id: 'g1' }),
	useNavigate: () => vi.fn(),
}));

vi.mock('@/shared/api/bot-management.js', () => ({
	groupApi: {
		getSettings: vi.fn(),
		updateSettings: vi.fn(),
	},
}));

describe('GeneralSettingsPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(groupApi.getSettings as any).mockResolvedValue({
			general: { language: 'en', timezone: 'UTC', welcomeMessage: true },
			version: 1,
		});
	});

	it('renders settings title', async () => {
		render(() => <GeneralSettingsPage />);
		expect(await screen.findByText('generalSettings.title')).toBeInTheDocument();
	});

	it('renders subtitle', async () => {
		render(() => <GeneralSettingsPage />);
		expect(await screen.findByText('generalSettings.description')).toBeInTheDocument();
	});
});
