import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { MyAssetsGallery } from './MyAssetsGallery.jsx';

// Mock routing, i18n, haptic, and tanstack query
vi.mock('@solidjs/router', () => ({
	useNavigate: () => vi.fn(),
}));

vi.mock('@/shared/i18n/index.js', () => ({
	t: (key: string) => key,
	formatNumber: (n: number) => String(n),
}));

vi.mock('@/shared/lib/haptic.js', () => ({
	haptic: {
		selection: vi.fn(),
		impact: vi.fn(),
	},
}));

const mockAssetsData = {
	reports: [
		{
			type: 'username',
			identifier: 'durov',
			title: '@durov',
			username: 'durov',
			rarityScore: 92,
			status: 'completed',
			generatedAt: '2026-09-11T10:00:00Z',
			certificateUrl: '/username/report?u=durov',
			notificationEnabled: true,
		},
		{
			type: 'number',
			identifier: '+888 0123 4567',
			title: '+888 0123 4567',
			username: '+888 0123 4567',
			rarityScore: 88,
			status: 'completed',
			generatedAt: '2026-09-10T14:00:00Z',
			certificateUrl: '/numbers/report?n=%2B888%200123%204567',
			notificationEnabled: true,
			valueEstimate: '18.5 TON',
		},
		{
			type: 'gift',
			identifier: 'plush_pepe-42',
			title: 'Plush Pepe #42',
			username: 'Plush Pepe #42',
			rarityScore: 95,
			status: 'completed',
			generatedAt: '2026-09-09T09:00:00Z',
			certificateUrl: '/gifts/report?g=plush_pepe-42',
			notificationEnabled: true,
			valueEstimate: '450.0 GRAM',
		},
	],
	properties: [],
	projects: [],
	boosters: {
		multitapLevel: 2,
		energyLimitLevel: 2,
		tapBotLevel: 1,
		tapBotCapHours: 12,
	},
	summaryText: 'My Assets',
};

vi.mock('@tanstack/solid-query', () => ({
	createQuery: () => ({
		data: mockAssetsData,
		isLoading: false,
	}),
}));

describe('MyAssetsGallery Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders all 3 verticals in Reports tab with accurate count badges', () => {
		render(() => <MyAssetsGallery />);

		// Sub-tab pills with counts
		expect(screen.getByText('All')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument(); // total count
		expect(screen.getByText('Usernames')).toBeInTheDocument();
		expect(screen.getByText('Numbers +888')).toBeInTheDocument();
		expect(screen.getByText('Gifts')).toBeInTheDocument();

		// Content of username report
		expect(screen.getByText('@durov')).toBeInTheDocument();
		expect(screen.getByText('Score 92/100')).toBeInTheDocument();

		// Content of number report
		expect(screen.getByText('+888 0123 4567')).toBeInTheDocument();
		expect(screen.getByText('18.5 TON')).toBeInTheDocument();
		expect(screen.getByText('Confidence 88%')).toBeInTheDocument();

		// Content of gift report
		expect(screen.getByText('Plush Pepe #42')).toBeInTheDocument();
		expect(screen.getByText('450.0 GRAM')).toBeInTheDocument();
		expect(screen.getByText('Confidence 95%')).toBeInTheDocument();
	});

	it('filters reports when clicking on sub-tab filter pills', () => {
		render(() => <MyAssetsGallery />);

		// Click "Numbers +888" filter pill
		const numbersFilterBtn = screen.getByText('Numbers +888').closest('button');
		expect(numbersFilterBtn).not.toBeNull();
		fireEvent.click(numbersFilterBtn!);

		// Number report is visible, username and gift reports are filtered out
		expect(screen.getByText('+888 0123 4567')).toBeInTheDocument();
		expect(screen.queryByText('@durov')).not.toBeInTheDocument();
		expect(screen.queryByText('Plush Pepe #42')).not.toBeInTheDocument();

		// Click "Gifts" filter pill
		const giftsFilterBtn = screen.getByText('Gifts').closest('button');
		expect(giftsFilterBtn).not.toBeNull();
		fireEvent.click(giftsFilterBtn!);

		// Gift report is visible, number and username reports are filtered out
		expect(screen.getByText('Plush Pepe #42')).toBeInTheDocument();
		expect(screen.queryByText('+888 0123 4567')).not.toBeInTheDocument();
		expect(screen.queryByText('@durov')).not.toBeInTheDocument();
	});
});
