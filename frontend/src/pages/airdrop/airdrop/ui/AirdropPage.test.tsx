import { render, screen } from '@solidjs/testing-library';
import { AirdropPage } from './AirdropPage.js';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@tma.js/sdk-solid', () => ({
  hapticFeedback: { selectionChanged: vi.fn() },
  backButton: { show: vi.fn(), hide: vi.fn(), onClick: () => vi.fn() },
  initData: {
    user: () => ({ first_name: 'Test', photo_url: '' })
  }
}));

vi.mock('@solidjs/router', () => ({
  useLocation: () => ({ pathname: '/airdrop' }),
  A: (props: any) => <a {...props}>{props.children}</a>
}));

vi.mock('@/shared/store/airdrop.js', () => ({
  checkedInToday: () => false,
  currentLeague: () => ({ name: 'Bronze', color: '#cd7f32', icon: 'stars' }),
  userClan: () => null,
  setUserClan: vi.fn(),
  boosters: () => ({
    tapPower: { id: 'tapPower', level: 1, maxLevel: 10, baseCost: 2000 },
    energyCap: { id: 'energyCap', level: 1, maxLevel: 10, baseCost: 1500 }
  }),
  upgradeBooster: vi.fn(),
  getBoosterCost: () => 2000,
  frgBalance: () => 100,
  streakDay: () => 1,
  claimDailyReward: vi.fn(),
  DAILY_REWARDS: [500, 1000, 2500, 5000, 10000, 15000, 25000],
  LEAGUES: [
    { name: 'Bronze',   icon: 'looks_3',       minScore: 0,          color: '#cd7f32' },
    { name: 'Silver',   icon: 'looks_two',      minScore: 50_000,     color: '#c0c0c0' },
    { name: 'Gold',     icon: 'looks_one',      minScore: 200_000,    color: '#ffd700' },
    { name: 'Platinum', icon: 'workspace_premium', minScore: 500_000, color: '#e5e4e2' },
    { name: 'Diamond',  icon: 'diamond',        minScore: 1_000_000,  color: '#3390ec' },
    { name: 'Legendary', icon: 'auto_awesome',  minScore: 5_000_000,  color: '#ff6b35' },
  ],
  balance: () => 1000,
  energy: () => 500,
  maxEnergy: () => 500,
  tapPower: () => 1,
  recordTaps: vi.fn(),
  syncProfileStats: vi.fn()
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
