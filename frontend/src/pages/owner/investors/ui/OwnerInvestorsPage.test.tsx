import { render } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OwnerInvestorsPage } from './OwnerInvestorsPage.js';

let mockSettings: any = {
	investors_page_image_url: 'https://example.com/investor.webp',
	maintenance_mode: false,
};

const mockUpdateSettings = vi.fn().mockResolvedValue({ success: true });

vi.mock('@/entities/owner/api/ownerApi.js', () => ({
	ownerApi: {
		getSettings: () => Promise.resolve(mockSettings),
		updateSettings: (...args: any[]) => mockUpdateSettings(...args),
	},
}));

vi.mock('@tanstack/solid-query', () => ({
	useQueryClient: () => ({
		invalidateQueries: vi.fn(),
	}),
	createQuery: (_fn: any) => ({
		data: mockSettings,
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
	}),
	createMutation: (fn: any) => {
		const opts = fn();
		return {
			mutate: (args: any) => opts.mutationFn(args).then(opts.onSuccess).catch(opts.onError),
			isPending: false,
		};
	},
}));

vi.mock('@/shared/ui/toast.js', () => ({
	showToast: vi.fn(),
}));

vi.mock('@/shared/i18n/index.js', () => ({
	t: (key: string) => key,
	isRtl: () => false,
}));

vi.mock('@/shared/api/config.js', () => ({
	buildMediaUrl: (url: string) => url,
}));

describe('OwnerInvestorsPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSettings = {
			investors_page_image_url: 'https://example.com/investor.webp',
			maintenance_mode: false,
		};
	});

	it('renders header, notice distinction banner, and uploader', () => {
		const { getByText } = render(() => <OwnerInvestorsPage />);
		expect(getByText('ownerInvestors.title')).toBeInTheDocument();
		expect(getByText('ownerInvestors.noticeTitle')).toBeInTheDocument();
		expect(getByText('ownerInvestors.noticeDesc')).toBeInTheDocument();
		expect(getByText('ownerInvestors.uploadTitle')).toBeInTheDocument();
	});

	it('renders mobile phone preview with current image', () => {
		const { getByAltText, getByText } = render(() => <OwnerInvestorsPage />);
		const img = getByAltText('Preview') as HTMLImageElement;
		expect(img).toBeInTheDocument();
		expect(img.src).toBe('https://example.com/investor.webp');
		expect(getByText('ownerInvestors.currentPreview')).toBeInTheDocument();
	});

	it('shows empty warning placeholder when no image is configured', () => {
		mockSettings = {
			investors_page_image_url: '',
			maintenance_mode: false,
		};
		const { getByText } = render(() => <OwnerInvestorsPage />);
		expect(getByText('ownerInvestors.noImageWarning')).toBeInTheDocument();
	});
});
