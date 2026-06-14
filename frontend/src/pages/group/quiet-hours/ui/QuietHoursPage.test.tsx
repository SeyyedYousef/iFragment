import { render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupApi } from '@/shared/api/bot-management.js';
import { QuietHoursPage } from './QuietHoursPage.js';

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

describe('QuietHoursPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(groupApi.getSettings as any).mockResolvedValue({
			quiet_hours: {
				emergencyLock: false,
				adminOverride: true,
				sendNotifications: true,
				periods: [{ id: 'p1', start: '22:00', end: '08:00' }],
			},
			version: 1,
		});
	});

	it('renders quiet hours title', async () => {
		render(() => <QuietHoursPage />);
		expect(await screen.findByText('quietHoursSettings.title')).toBeInTheDocument();
	});

	it('renders subtitle', async () => {
		render(() => <QuietHoursPage />);
		expect(await screen.findByText('quietHoursSettings.subtitle')).toBeInTheDocument();
	});
});
