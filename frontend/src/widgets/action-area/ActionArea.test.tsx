import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@solidjs/testing-library';
import { ActionArea } from './ActionArea.jsx';

// Mock routing and i18n
vi.mock('@solidjs/router', () => ({
	useNavigate: () => vi.fn(),
}));

vi.mock('@/shared/i18n/index.js', () => ({
	t: (key: string) => key,
}));

// Mock the model
vi.mock('@/entities/username/model/index.js', () => ({
	useUsernameSearch: () => ({
		searchQuery: () => '',
		setSearchQuery: vi.fn(),
		searchError: () => null,
		isCollectibleOnly: () => false,
		validate: vi.fn(() => true),
	}),
}));

// Mock the api
vi.mock('@/entities/username/api/index.js', () => ({
	useUsernameQuickAnalysis: () => ({ data: { status: 'available' }, refetch: vi.fn() }),
	useTrendingUsernames: () => ({ data: ['news', 'auto', 'bank', 'crypto'] }),
}));

describe('ActionArea Component', () => {
	it('renders correctly', () => {
		render(() => <ActionArea activeTab="username" />);
		// Check if the search input exists
		expect(screen.getByRole('textbox')).toBeInTheDocument();
	});

	it('displays the correct placeholder text', () => {
		render(() => <ActionArea activeTab="username" />);
		const input = screen.getByRole('textbox');
		expect(input).toHaveAttribute('placeholder', 'action.username.inputPlaceholder');
	});

	it('renders gifts tab with valid link format chips and without durov portfolio', () => {
		render(() => <ActionArea activeTab="gifts" />);
		const input = screen.getByRole('textbox');
		expect(input).toHaveAttribute('placeholder', 't.me/nft/PlushPepe-1');
		
		// Verify @durov is not present
		expect(screen.queryByText('@durov (پورتفولیو)')).not.toBeInTheDocument();
		expect(screen.queryByText(/durov.*پورتفولیو/i)).not.toBeInTheDocument();
		
		// Verify gifts format chips exist
		expect(screen.getByText('t.me/nft/PlushPepe-1')).toBeInTheDocument();
		expect(screen.getByText('DurovsCap-1')).toBeInTheDocument();
		expect(screen.getByText('Signet Ring #7')).toBeInTheDocument();
		expect(screen.getByText('fragment.com/gift/SantaHat-1')).toBeInTheDocument();
	});

	it('renders gifts trending categories', () => {
		render(() => <ActionArea activeTab="gifts" />);
		expect(screen.getByText('بلوچیپ و جنسیس')).toBeInTheDocument();
		expect(screen.getByText('ستارگان و ترند')).toBeInTheDocument();
		expect(screen.getByText('فصلی و جادو')).toBeInTheDocument();
		expect(screen.getByText('لوکس و خاص')).toBeInTheDocument();
	});
});
