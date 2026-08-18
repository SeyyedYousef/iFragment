import { render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupApi } from '@/entities/group/index.js';
import { LimitsPage } from './LimitsPage.js';

vi.mock('@solidjs/router', () => ({
	useParams: () => ({ id: 'g1' }),
	useNavigate: () => vi.fn(),
}));

vi.mock('@/entities/group/index.js', () => ({
	groupApi: {
		getSettings: vi.fn(),
		updateSettings: vi.fn(),
	},
}));

describe('LimitsPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(groupApi.getSettings as any).mockResolvedValue({
			limits: {
				minMessageLength: 1,
				maxMessageLength: 4096,
				floodMessages: 5,
				floodWindow: 10,
				duplicateCount: 3,
				duplicateWindow: 60,
			},
			version: 1,
		});
	});

	it('renders limits title', async () => {
		render(() => <LimitsPage />);
		expect(await screen.findByText('limitsSettings.title')).toBeInTheDocument();
	});

	it('renders subtitle', async () => {
		render(() => <LimitsPage />);
		expect(await screen.findByText('limitsSettings.subtitle')).toBeInTheDocument();
	});
});
