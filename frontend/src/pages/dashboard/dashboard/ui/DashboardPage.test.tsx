import { render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage.js';

// Mock the router and query hooks
vi.mock('@solidjs/router', () => ({
	useNavigate: () => vi.fn(),
	useLocation: () => ({ pathname: '/dashboard' }),
	A: (props: any) => <a {...props}>{props.children}</a>,
}));

vi.mock('@tma.js/sdk-solid', () => ({
	hapticFeedback: { impactOccurred: vi.fn() },
	initData: {
		user: () => ({ first_name: 'Test', photo_url: '' }),
	},
}));

vi.mock('@tanstack/solid-query', () => ({
	createQuery: () => ({
		data: {
			managed_bots: [{ id: '1', bot_name: 'Test Bot', bot_username: 'test_bot' }],
		},
		isLoading: false,
		isError: false,
	}),
}));

describe('DashboardPage', () => {
	it('renders the dashboard with title', () => {
		render(() => <DashboardPage />);
		expect(screen.getByText('dashboard.title')).toBeInTheDocument();
	});

	it('renders the group management section', () => {
		render(() => <DashboardPage />);
		expect(screen.getByText('dashboard.groupMgmt')).toBeInTheDocument();
	});

	it('contains the bottom navigation dashboard link', () => {
		render(() => <DashboardPage />);
		expect(screen.getByText('bottomNav.dashboard')).toBeInTheDocument();
	});
});
