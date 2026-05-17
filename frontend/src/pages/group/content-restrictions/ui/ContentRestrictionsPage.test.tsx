import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { ContentRestrictionsPage } from './ContentRestrictionsPage.js';
import { groupApi } from '@/shared/api/bot-management.js';

vi.mock('@solidjs/router', () => ({
  useParams: () => ({ id: 'g1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@/shared/api/bot-management.js', () => ({
  groupApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  }
}));

describe('ContentRestrictionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (groupApi.getSettings as any).mockResolvedValue({
      content_restrictions: {},
      version: 1,
    });
  });

  it('renders content restrictions title', async () => {
    render(() => <ContentRestrictionsPage />);
    expect(await screen.findByText('contentRestrictions.title')).toBeInTheDocument();
  });

  it('renders subtitle', async () => {
    render(() => <ContentRestrictionsPage />);
    expect(await screen.findByText('contentRestrictions.subtitle')).toBeInTheDocument();
  });
});
