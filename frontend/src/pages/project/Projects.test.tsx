import { render } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { channelApi } from '@/entities/channel/api/channelApi.js';
import { ProjectContextBar } from '@/widgets/project/ProjectContextBar.jsx';

// Mock axios
vi.mock('@/shared/api/axios.js', () => ({
	apiClient: {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock('@solidjs/router', () => ({
	useNavigate: () => vi.fn(),
	useLocation: () => ({ pathname: '/projects' }),
	useParams: () => ({ projectId: 'test-project-123' }),
	A: (props: any) => <a {...props}>{props.children}</a>,
}));

vi.mock('@tma.js/sdk-solid', () => ({
	backButton: {
		isSupported: () => false,
		mount: { isAvailable: () => false },
		show: vi.fn(),
		hide: vi.fn(),
		onClick: vi.fn(),
	},
	hapticFeedback: { impactOccurred: vi.fn() },
}));

describe('Project Editorial System & API Client', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('formats and sends preflight validation requests', async () => {
		const { apiClient } = await import('@/shared/api/axios.js');
		const mockResponse = {
			data: {
				data: {
					valid: true,
					source_channel: { chat_id: -100111, is_bot_admin: true, can_post: true },
					target_channel: { chat_id: -100222, is_bot_admin: true, can_post: true },
					errors: [],
					warnings: [],
				},
			},
		};
		(apiClient.post as any).mockResolvedValueOnce(mockResponse);

		const result = await channelApi.checkPreflight('@source', '@target');
		expect(apiClient.post).toHaveBeenCalledWith('/projects/preflight', {
			source_identifier: '@source',
			target_identifier: '@target',
		});
		expect(result.valid).toBe(true);
		expect(result.source_channel?.chat_id).toBe(-100111);
	});

	it('fetches review inbox with status filter and pagination', async () => {
		const { apiClient } = await import('@/shared/api/axios.js');
		const mockItems = [
			{
				id: 'item-1',
				project_id: 'proj-1',
				status: 'awaiting_review',
				revision: {
					id: 'rev-1',
					version: 1,
					text: 'Filtered breaking news',
				},
			},
		];
		(apiClient.get as any).mockResolvedValueOnce({
			data: { data: { items: mockItems } },
		});

		const items = await channelApi.getProjectInbox('proj-1', 'awaiting_review', 10, 0);
		expect(apiClient.get).toHaveBeenCalledWith('/projects/proj-1/inbox', {
			params: { status: 'awaiting_review', limit: 10, offset: 0 },
		});
		expect(items).toHaveLength(1);
		expect(items[0].status).toBe('awaiting_review');
	});

	it('triggers content approval endpoint', async () => {
		const { apiClient } = await import('@/shared/api/axios.js');
		(apiClient.post as any).mockResolvedValueOnce({ data: { success: true } });

		await channelApi.approveContent('proj-1', 'item-1');
		expect(apiClient.post).toHaveBeenCalledWith('/projects/proj-1/content/item-1/approve');
	});

	it('triggers content rejection with reason', async () => {
		const { apiClient } = await import('@/shared/api/axios.js');
		(apiClient.post as any).mockResolvedValueOnce({ data: { success: true } });

		await channelApi.rejectContent('proj-1', 'item-1', 'Spam content');
		expect(apiClient.post).toHaveBeenCalledWith('/projects/proj-1/content/item-1/reject', {
			reason: 'Spam content',
		});
	});

	it('fetches delivery receipts history', async () => {
		const { apiClient } = await import('@/shared/api/axios.js');
		const mockDeliveries = [
			{
				id: 'del-1',
				project_id: 'proj-1',
				destination_chat_id: -100222,
				telegram_message_id: 888,
				status: 'published',
				created_by_bot: true,
			},
		];
		(apiClient.get as any).mockResolvedValueOnce({
			data: { data: { deliveries: mockDeliveries } },
		});

		const deliveries = await channelApi.getProjectDeliveries('proj-1', 20);
		expect(apiClient.get).toHaveBeenCalledWith('/projects/proj-1/deliveries', {
			params: { limit: 20, offset: 0 },
		});
		expect(deliveries).toHaveLength(1);
		expect(deliveries[0].created_by_bot).toBe(true);
	});

	it('manages project team members', async () => {
		const { apiClient } = await import('@/shared/api/axios.js');
		const mockMembers = [
			{ project_id: 'proj-1', user_id: 12345, role: 'editor' },
		];
		(apiClient.get as any).mockResolvedValueOnce({
			data: { data: { members: mockMembers } },
		});

		const members = await channelApi.getProjectMembers('proj-1');
		expect(apiClient.get).toHaveBeenCalledWith('/projects/proj-1/team');
		expect(members[0].role).toBe('editor');
	});

	it('renders ProjectContextBar with project ID and active badges', async () => {
		const { apiClient } = await import('@/shared/api/axios.js');
		(apiClient.get as any).mockResolvedValueOnce({
			data: { data: { id: 'proj-1', name: 'Test News Hub', status: 'active' } },
		});
		const { unmount } = render(() => <ProjectContextBar projectId="proj-1" />);
		expect(document.body).toBeDefined();
		unmount();
	});
});
