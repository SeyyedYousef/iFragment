import { render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupApi } from '@/entities/group/index.js';
import { CustomTextsPage } from './CustomTextsPage.js';

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

describe('CustomTextsPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(groupApi.getSettings as any).mockResolvedValue({
			custom_texts: {
				welcomeText: 'Hello!',
				warningText: '',
				silenceStartText: '',
				silenceEndText: '',
				rulesText: '',
				forceJoinText: '',
				forceAddText: '',
				inlineButtons: [],
			},
			version: 1,
		});
	});

	it('renders custom texts title', async () => {
		render(() => <CustomTextsPage />);
		expect(await screen.findByText('customTextsSettings.title')).toBeInTheDocument();
	});

	it('renders subtitle', async () => {
		render(() => <CustomTextsPage />);
		expect(await screen.findByText('customTextsSettings.subtitle')).toBeInTheDocument();
	});
});
