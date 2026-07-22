import { render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupApi } from '@/shared/api/bot-management.js';
import { GroupDashboardPage } from './GroupDashboardPage.js';

vi.mock('@solidjs/router', () => ({
	useParams: () => ({ id: 'g1' }),
	useNavigate: () => vi.fn(),
}));

vi.mock('@/shared/api/bot-management.js', () => ({
	groupApi: {
		getGroup: vi.fn(),
		getAnalytics: vi.fn(),
		getSettings: vi.fn(),
		getAuditLogs: vi.fn(),
		updateSettings: vi.fn(),
	},
}));

describe('GroupDashboardPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(groupApi.getGroup as any).mockResolvedValue({
			id: 'g1',
			chat_title: 'Test Group',
			members_count: 500,
			subscription_status: 'paid',
		});
		(groupApi.getAnalytics as any).mockResolvedValue({
			summary: { spam_blocked: 5, total_messages: 100, new_members: 10, top_users: [] },
		});
		(groupApi.getSettings as any).mockResolvedValue({
			quiet_hours: { emergencyLock: false },
			version: 1,
		});
		(groupApi.getAuditLogs as any).mockResolvedValue([]);
	});

	it('renders group title', async () => {
		render(() => <GroupDashboardPage />);
		expect(await screen.findByText('Test Group')).toBeInTheDocument();
	});

	it('renders dashboard health label', async () => {
		render(() => <GroupDashboardPage />);
		expect(await screen.findByText((c) => c.includes('ایمن') || c.includes('VerySafe') || c.includes('health'))).toBeInTheDocument();
	});
});
