import { render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupApi } from '@/entities/group/index.js';
import { GroupDashboardPage } from './GroupDashboardPage.js';

vi.mock('@solidjs/router', () => ({
	useParams: () => ({ id: 'g1' }),
	useNavigate: () => vi.fn(),
}));

vi.mock('@/entities/group/index.js', () => ({
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

	it('renders dashboard status badge', async () => {
		render(() => <GroupDashboardPage />);
		expect(await screen.findByText('groupDashboard.proBadge')).toBeInTheDocument();
	});
});
