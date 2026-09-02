import { render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { botApi, subscriptionApi } from '@/entities/bot/index.js';
import { BotManagePage } from './BotManagePage.js';

vi.mock('@solidjs/router', () => ({
	useParams: () => ({ botId: 'b1' }),
	useNavigate: () => vi.fn(),
}));

vi.mock('@/widgets/paywall/index.js', () => ({
	useWallet: () => ({
		balance: () => 10,
		nextExpiry: () => null,
		coins: () => 50000,
		config: () => ({ coins_per_credit: 50000, packs: [] }),
		configFailed: () => false,
		isLoading: () => false,
		refetch: vi.fn(),
	}),
	CreditStoreSheet: () => null,
	UnifiedPaywallGate: () => null,
}));

vi.mock('@/entities/bot/index.js', () => ({
	botApi: {
		getBot: vi.fn(),
		listGroups: vi.fn(),
	},
	subscriptionApi: {
		getPackages: vi.fn(),
		purchase: vi.fn(),
	},
}));

describe('BotManagePage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(botApi.getBot as any).mockResolvedValue({
			id: 'b1',
			bot_username: 'testbot',
			bot_name: 'Test Bot',
			managed_groups_count: 2,
			subscription_status: 'pro',
		});
		(botApi.listGroups as any).mockResolvedValue([
			{ id: 'g1', chat_title: 'My Group', members_count: 100, subscription_status: 'paid' },
		]);
		(subscriptionApi.getPackages as any).mockResolvedValue([]);
	});

	it('renders bot manage title', async () => {
		render(() => <BotManagePage />);
		expect(await screen.findByText('botManage.title')).toBeInTheDocument();
	});

	it('renders bot username', async () => {
		render(() => <BotManagePage />);
		expect(await screen.findByText('@testbot')).toBeInTheDocument();
	});

	it('renders connected group', async () => {
		render(() => <BotManagePage />);
		expect(await screen.findByText('My Group')).toBeInTheDocument();
	});
});
