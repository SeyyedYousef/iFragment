import { render, screen } from '@solidjs/testing-library';
import { AirdropPage } from './AirdropPage.js';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@tma.js/sdk-solid', () => ({
  hapticFeedback: { selectionChanged: vi.fn() },
  backButton: { show: vi.fn(), hide: vi.fn(), onClick: () => vi.fn() }
}));

vi.mock('@/shared/store/airdrop.js', () => ({
  checkedInToday: () => false,
  currentLeague: () => ({ name: 'Bronze', color: '#cd7f32', icon: 'stars' })
}));

describe('AirdropPage', () => {
  it('renders the league name', () => {
    render(() => <AirdropPage />);
    expect(screen.getByText('Bronze')).toBeInTheDocument();
  });

  it('displays the daily check-in button', () => {
    render(() => <AirdropPage />);
    expect(screen.getByRole('button', { name: /airdrop\.daily\.label/i })).toBeInTheDocument();
  });

  it('contains the navigation area', () => {
    render(() => <AirdropPage />);
    expect(screen.getByText(/airdrop\.tasks\.label/i)).toBeInTheDocument();
  });
});
