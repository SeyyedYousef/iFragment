import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvestorsPromoPage } from './InvestorsPromoPage.js';

let mockQueryData: any = {
	data: { image_url: '/uploads/ads/investors-123.webp', updated_at: '2026-09-18T10:00:00Z' },
	isLoading: false,
	isError: false,
	refetch: vi.fn(),
};

vi.mock('@tanstack/solid-query', () => ({
	createQuery: () => mockQueryData,
}));

vi.mock('@solidjs/router', () => ({
	useNavigate: () => vi.fn(),
	useLocation: () => ({ pathname: '/investors' }),
	A: (props: any) => <a {...props}>{props.children}</a>,
}));

vi.mock('@tma.js/sdk-solid', () => ({
	hapticFeedback: { impactOccurred: vi.fn() },
	backButton: {
		isSupported: () => true,
		show: vi.fn(),
		hide: vi.fn(),
		on: vi.fn(() => vi.fn()),
		onClick: vi.fn(() => vi.fn()),
	},
}));

vi.mock('@/widgets/bottom-nav/index.js', () => ({
	BottomNav: () => <nav data-testid="bottom-nav">BottomNav</nav>,
}));

describe('InvestorsPromoPage', () => {
	afterEach(() => {
		cleanup();
		document.body.innerHTML = '';
	});

	beforeEach(() => {
		mockQueryData = {
			data: { image_url: '/uploads/ads/investors-123.webp', updated_at: '2026-09-18T10:00:00Z' },
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		};
	});

	it('renders the promotional image with eager loading and object-cover when config is available', () => {
		const { getByAltText, getByTestId } = render(() => <InvestorsPromoPage />);
		const img = getByAltText('Investors Promotional Banner') as HTMLImageElement;
		expect(img).toBeInTheDocument();
		expect(img.getAttribute('loading')).toBe('eager');
		expect(img.className).toContain('object-cover');
		expect(img.className).toContain('object-center');
		expect(getByTestId('bottom-nav')).toBeInTheDocument();
	});

	it('renders loading skeleton when query is loading', () => {
		mockQueryData = {
			data: undefined,
			isLoading: true,
			isError: false,
			refetch: vi.fn(),
		};
		const { getByTestId } = render(() => <InvestorsPromoPage />);
		expect(getByTestId('investors-skeleton')).toBeInTheDocument();
		expect(getByTestId('bottom-nav')).toBeInTheDocument();
	});

	it('renders empty state when image_url is empty', () => {
		mockQueryData = {
			data: { image_url: '', updated_at: null },
			isLoading: false,
			isError: false,
			refetch: vi.fn(),
		};
		const { getByTestId, getByText } = render(() => <InvestorsPromoPage />);
		expect(getByTestId('investors-empty-state')).toBeInTheDocument();
		expect(getByText('Investors image is not configured yet.')).toBeInTheDocument();
		expect(getByTestId('bottom-nav')).toBeInTheDocument();
	});

	it('renders error state with retry button when query fails', () => {
		const refetchFn = vi.fn();
		mockQueryData = {
			data: undefined,
			isLoading: false,
			isError: true,
			refetch: refetchFn,
		};
		const { getByTestId, getByText } = render(() => <InvestorsPromoPage />);
		expect(getByTestId('investors-error-state')).toBeInTheDocument();
		const retryBtn = getByText('Retry');
		expect(retryBtn).toBeInTheDocument();

		fireEvent.click(retryBtn);
		expect(refetchFn).toHaveBeenCalled();
	});

	it('displays error state when the image fails to load via onError', () => {
		const { getByAltText, getByTestId } = render(() => <InvestorsPromoPage />);
		const img = getByAltText('Investors Promotional Banner');
		fireEvent.error(img);

		expect(getByTestId('investors-error-state')).toBeInTheDocument();
	});
});
