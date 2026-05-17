import { render, screen } from '@solidjs/testing-library';
import { DashboardPage } from './DashboardPage.js';
import { vi, describe, it, expect } from 'vitest';

// Mock the router and query hooks
vi.mock('@solidjs/router', () => ({
  useNavigate: () => vi.fn(),
  A: (props: any) => <a {...props}>{props.children}</a>
}));

vi.mock('@tanstack/solid-query', () => ({
  createQuery: () => ({
    data: {
      managed_bots: [{ id: '1', bot_name: 'Test Bot', bot_username: 'test_bot' }]
    },
    isLoading: false,
    isError: false
  })
}));

describe('DashboardPage', () => {
  it('renders the dashboard with title', () => {
    render(() => <DashboardPage />);
    expect(screen.getByText(/مدیریت ای‌فرگمنت/i)).toBeInTheDocument();
  });

  it('renders the managed bots section', () => {
    render(() => <DashboardPage />);
    expect(screen.getByText(/ربات‌های شما/i)).toBeInTheDocument();
  });

  it('contains the marketplace link', () => {
    render(() => <DashboardPage />);
    expect(screen.getByText(/فروشگاه/i)).toBeInTheDocument();
  });
});
