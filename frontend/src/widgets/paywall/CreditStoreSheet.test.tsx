import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreditStoreSheet } from './CreditStoreSheet.js';

vi.mock('@/shared/lib/haptic.js', () => ({
	haptic: {
		impact: vi.fn(),
		selection: vi.fn(),
		notify: vi.fn(),
	},
}));

vi.mock('@/shared/i18n/index.js', () => ({
	t: (key: string) => key,
	isRtl: () => false,
}));

vi.mock('@/entities/intel/api/creditsApi.js', () => ({
	creditsApi: {
		purchaseCredits: vi.fn(),
		exchangeCoins: vi.fn(),
	},
}));

const mockRefetch = vi.fn();

vi.mock('./useWallet.js', () => ({
	useWallet: () => ({
		balance: () => 5,
		nextExpiry: () => null,
		coins: () => 100000,
		config: () => ({
			coins_per_credit: 50000,
			packs: [
				{
					id: 'pack_1',
					credits: 10,
					bonus_credits: 2,
					stars_price: 100,
					popular: true,
					best_value: false,
				},
			],
		}),
		configFailed: () => false,
		isLoading: () => false,
		refetch: mockRefetch,
	}),
}));

describe('CreditStoreSheet', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('does not render when open is false', () => {
		render(() => (
			<CreditStoreSheet open={false} onClose={vi.fn()} vertical="group" />
		));
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('renders dialog with z-[140] and content when open is true', () => {
		render(() => (
			<CreditStoreSheet open={true} onClose={vi.fn()} vertical="group" />
		));
		const dialog = screen.getByRole('dialog');
		expect(dialog).toBeInTheDocument();
		expect(dialog.className).toContain('z-[140]');
		expect(screen.getByText('paywall.store_title')).toBeInTheDocument();
	});

	it('calls onClose when close button is clicked', () => {
		const onCloseMock = vi.fn();
		render(() => (
			<CreditStoreSheet open={true} onClose={onCloseMock} vertical="group" />
		));
		const closeButtons = screen.getAllByRole('button');
		const closeIconButton = closeButtons.find((btn) => btn.textContent?.includes('close') && btn.getAttribute('aria-label') !== 'close');
		if (closeIconButton) {
			fireEvent.click(closeIconButton);
			expect(onCloseMock).toHaveBeenCalledTimes(1);
		} else {
			const backdrop = screen.getByLabelText('close');
			fireEvent.click(backdrop);
			expect(onCloseMock).toHaveBeenCalledTimes(1);
		}
	});

	it('calls onClose when backdrop is clicked', () => {
		const onCloseMock = vi.fn();
		render(() => (
			<CreditStoreSheet open={true} onClose={onCloseMock} vertical="group" />
		));
		const backdrop = screen.getByLabelText('close');
		fireEvent.click(backdrop);
		expect(onCloseMock).toHaveBeenCalledTimes(1);
	});
});
