import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { CustomTextsPage } from './CustomTextsPage.js';
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

describe('CustomTextsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (groupApi.getSettings as any).mockResolvedValue({
      custom_texts: {
        welcomeText: 'Hello!',
        warningText: '',
        silenceStartText: '',
        silenceEndText: '',
        rulesText: '',
        forceJoinText: '',
        forceAddText: '',
        inlineButtons: [],
      },
      version: 1,
    });
  });

  it('renders custom texts title', async () => {
    render(() => <CustomTextsPage />);
    expect(await screen.findByText('customTextsSettings.title')).toBeInTheDocument();
  });

  it('renders subtitle', async () => {
    render(() => <CustomTextsPage />);
    expect(await screen.findByText('customTextsSettings.subtitle')).toBeInTheDocument();
  });
});
