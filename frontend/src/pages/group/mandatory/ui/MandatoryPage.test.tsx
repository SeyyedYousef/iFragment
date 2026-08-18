import { render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupApi } from '@/entities/group/index.js';
import { MandatoryPage } from './MandatoryPage.js';

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

describe('MandatoryPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(groupApi.getSettings as any).mockResolvedValue({
			mandatory_membership: {
				forced_add_enabled: true,
				forced_add_count: 3,
				force_join_enabled: true,
				required_channels: ['@channel1'],
				verification_enabled: false,
				exemptions: [],
			},
			version: 1,
		});
	});

	it('renders mandatory title', async () => {
		render(() => <MandatoryPage />);
		expect(await screen.findByText('mandatorySettings.title')).toBeInTheDocument();
	});

	it('renders subtitle', async () => {
		render(() => <MandatoryPage />);
		expect(await screen.findByText('mandatorySettings.subtitle')).toBeInTheDocument();
	});
});
