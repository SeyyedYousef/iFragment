import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dict as enDict } from '@/shared/i18n/en.js';
import { BottomNav } from './BottomNav.js';

const mockNavigate = vi.fn();
const [testPath, setTestPath] = createSignal('/');
const [testUser, setTestUser] = createSignal<Record<string, unknown> | undefined>({
	firstName: 'Ali',
});
const [testProfilePhoto, setTestProfilePhoto] = createSignal<string | undefined>(undefined);

vi.mock('@solidjs/router', () => ({
	useLocation: () => ({
		get pathname() {
			return testPath();
		},
	}),
	useNavigate: () => mockNavigate,
}));

vi.mock('@tma.js/sdk-solid', () => ({
	initData: {
		user: () => testUser(),
	},
}));

vi.mock('@/entities/user/index.js', () => ({
	profilePhotoUrl: () => testProfilePhoto(),
}));

vi.mock('@/shared/api/config.js', () => ({
	buildAvatarUrl: (url: string) => url,
}));

vi.mock('@/shared/i18n/index.js', () => ({
	t: (key: string) => {
		const parts = key.split('.');
		let cur: any = enDict;
		for (const part of parts) {
			cur = cur?.[part];
		}
		return typeof cur === 'string' ? cur : key;
	},
}));

vi.mock('@/shared/lib/haptic.js', () => ({
	haptic: {
		impact: vi.fn(),
		selection: vi.fn(),
	},
}));

describe('BottomNav (Detached Twin Liquid Glass Dock)', () => {
	beforeEach(() => {
		mockNavigate.mockReset();
		setTestPath('/');
		setTestUser({ firstName: 'Ali' });
		setTestProfilePhoto(undefined);
	});

	afterEach(() => {
		cleanup();
		document.body.innerHTML = '';
	});

	it('renders the 3-tab dock pill separately from the detached profile orb', () => {
		render(() => <BottomNav />);

		const pill = screen.getByTestId('bottom-nav-pill');
		const profileOrb = screen.getByTestId('bottom-nav-profile');

		expect(pill).toBeInTheDocument();
		expect(profileOrb).toBeInTheDocument();
		expect(pill.contains(profileOrb)).toBe(false);
		expect(pill.querySelectorAll('button')).toHaveLength(3);

		expect(screen.getByRole('button', { name: /Home/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Investors/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Leaderboard/i })).toBeInTheDocument();
		expect(profileOrb).toHaveAttribute('aria-label', 'Profile');
	});

	it('glides the Liquid Glass lens across the 3 main tabs based on route', () => {
		setTestPath('/');
		const { container } = render(() => <BottomNav />);

		let lens = container.querySelector('.frag-dock-lens') as HTMLElement | null;
		expect(lens).not.toBeNull();
		expect(lens?.style.transform).toBe('translateX(0%)');
		expect(screen.getByRole('button', { name: /Home/i })).toHaveAttribute('aria-current', 'page');

		setTestPath('/dashboard');
		lens = container.querySelector('.frag-dock-lens') as HTMLElement | null;
		expect(lens?.style.transform).toBe('translateX(100%)');
		expect(screen.getByRole('button', { name: /Investors/i })).toHaveAttribute(
			'aria-current',
			'page',
		);

		setTestPath('/leaderboard');
		lens = container.querySelector('.frag-dock-lens') as HTMLElement | null;
		expect(lens?.style.transform).toBe('translateX(200%)');
		expect(screen.getByRole('button', { name: /Leaderboard/i })).toHaveAttribute(
			'aria-current',
			'page',
		);
	});

	it('highlights only the detached profile orb and hides the 3-tab lens on /profile routes', () => {
		setTestPath('/profile/settings');
		const { container } = render(() => <BottomNav />);

		const profileOrb = screen.getByTestId('bottom-nav-profile');
		expect(profileOrb).toHaveAttribute('aria-current', 'page');
		expect(profileOrb.className).toContain('frag-dock-orb-active');
		expect(container.querySelector('.frag-dock-lens')).toBeNull();
	});

	it('navigates cleanly and renders avatar image with multi-hop fallback on error', () => {
		setTestUser({ id: 42, firstName: 'Sina' });
		const { unmount } = render(() => <BottomNav />);

		const primaryOnlyImg = screen.getByRole('img', { name: 'Profile' }) as HTMLImageElement;
		expect(primaryOnlyImg.getAttribute('src')).toBe('/api/v1/profile/avatar/42');
		fireEvent.error(primaryOnlyImg);
		expect(screen.getByText('S')).toBeInTheDocument();
		unmount();

		setTestUser({
			id: 43,
			firstName: 'Reza',
			photoUrl: 'https://t.me/i/userpic/320/reza.jpg',
		});
		render(() => <BottomNav />);

		let img = screen.getByRole('img', { name: 'Profile' }) as HTMLImageElement;
		expect(img.getAttribute('src')).toBe('/api/v1/profile/avatar/43');
		fireEvent.error(img);

		img = screen.getByRole('img', { name: 'Profile' }) as HTMLImageElement;
		expect(img.getAttribute('src')).toBe('https://t.me/i/userpic/320/reza.jpg');
		fireEvent.error(img);
		expect(screen.getByText('R')).toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: /Investors/i }));
		expect(mockNavigate).toHaveBeenCalledWith('/investors');

		fireEvent.click(screen.getByTestId('bottom-nav-profile'));
		expect(mockNavigate).toHaveBeenCalledWith('/profile');
	});
});
