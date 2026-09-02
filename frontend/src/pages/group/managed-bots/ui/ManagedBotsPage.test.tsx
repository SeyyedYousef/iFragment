import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { botApi } from '@/entities/bot/index.js';
import { ManagedBotsPage } from './ManagedBotsPage.js';

vi.mock('@solidjs/router', () => ({
	useNavigate: () => vi.fn(),
}));

vi.mock('@/entities/bot/index.js', () => ({
	botApi: {
		listBots: vi.fn(),
		registerBot: vi.fn(),
	},
}));

describe('ManagedBotsPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(botApi.listBots as any).mockResolvedValue([
			{ id: 'b1', bot_username: 'testbot', bot_name: 'Test Bot', status: 'active' },
		]);
	});

	it('renders managed bots title', async () => {
		render(() => <ManagedBotsPage />);
		expect(await screen.findByText('managedBots.title')).toBeInTheDocument();
	});

	it('renders description', async () => {
		render(() => <ManagedBotsPage />);
		expect(await screen.findByText('managedBots.description')).toBeInTheDocument();
	});

	it('renders bot name from API', async () => {
		render(() => <ManagedBotsPage />);
		expect(await screen.findByText('Test Bot')).toBeInTheDocument();
	});

	it('opens create modal and displays BotFather step', async () => {
		render(() => <ManagedBotsPage />);
		const createSpan = await screen.findByText('managedBots.createBtn');
		fireEvent.click(createSpan.closest('button') || createSpan);
		expect(await screen.findByText('managedBots.connectYourBot')).toBeInTheDocument();
		expect(await screen.findByText('managedBots.step1Title')).toBeInTheDocument();
		expect(await screen.findByText('managedBots.createNativeBtn')).toBeInTheDocument();
		expect(await screen.findByText('managedBots.pasteBtn')).toBeInTheDocument();
	});

	it('triggers openBotFather when one-tap button is clicked', async () => {
		const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null as any);
		render(() => <ManagedBotsPage />);
		const createSpan = await screen.findByText('managedBots.createBtn');
		fireEvent.click(createSpan.closest('button') || createSpan);
		const nativeBtn = await screen.findByText('managedBots.createNativeBtn');
		fireEvent.click(nativeBtn.closest('button') || nativeBtn);
		openSpy.mockRestore();
	});
});

