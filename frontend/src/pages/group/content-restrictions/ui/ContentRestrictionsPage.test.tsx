import { render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupApi } from '@/entities/group/index.js';
import { ContentRestrictionsPage } from './ContentRestrictionsPage.js';

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

describe('ContentRestrictionsPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(groupApi.getSettings as any).mockResolvedValue({
			content_restrictions: {},
			version: 1,
		});
	});

	it('renders content restrictions title', async () => {
		render(() => <ContentRestrictionsPage />);
		expect(await screen.findByText('contentRestrictions.title')).toBeInTheDocument();
	});

	it('renders subtitle', async () => {
		render(() => <ContentRestrictionsPage />);
		expect(await screen.findByText('contentRestrictions.subtitle')).toBeInTheDocument();
	});
});
