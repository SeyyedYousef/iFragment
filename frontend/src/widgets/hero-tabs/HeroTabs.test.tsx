import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dict as enDict } from '@/shared/i18n/en.js';
import { dict as faDict } from '@/shared/i18n/fa.js';
import { dict as ruDict } from '@/shared/i18n/ru.js';
import { dict as zhDict } from '@/shared/i18n/zh.js';
import { HeroTabs } from './HeroTabs.js';

const mockNavigate = vi.fn();
const [testLocale, setTestLocale] = createSignal<'fa' | 'en' | 'ru' | 'zh'>('fa');

const dicts: Record<'fa' | 'en' | 'ru' | 'zh', any> = {
	fa: faDict,
	en: enDict,
	ru: ruDict,
	zh: zhDict,
};

vi.mock('@solidjs/router', () => ({
	useNavigate: () => mockNavigate,
}));

vi.mock('@/shared/i18n/index.js', () => ({
	locale: () => testLocale(),
	isRtl: () => testLocale() === 'fa',
	t: (key: string) => {
		const parts = key.split('.');
		let cur: any = dicts[testLocale()];
		for (const p of parts) {
			cur = cur?.[p];
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

describe('HeroTabs (Universal Smart Search & 4-Language Support)', () => {
	beforeEach(() => {
		mockNavigate.mockReset();
		setTestLocale('fa');
	});

	afterEach(() => {
		cleanup();
		document.body.innerHTML = '';
	});

	it('renders localized "جستجوی هوشمند" placeholder in Persian without any @skulls text', () => {
		setTestLocale('fa');
		const onTabChange = vi.fn();
		const { container } = render(() => (
			<HeroTabs activeTab={null} onTabChange={onTabChange} />
		));

		const searchInput = screen.getByPlaceholderText('جستجوی هوشمند') as HTMLInputElement;
		expect(searchInput).toBeInTheDocument();
		expect(screen.getByText('جستجو')).toBeInTheDocument();
		expect(container.textContent?.toLowerCase()).not.toContain('skulls');
	});

	it('renders localized Smart Search placeholder across all 4 languages (fa, en, ru, zh)', () => {
		const onTabChange = vi.fn();

		setTestLocale('en');
		const { unmount: unmountEn } = render(() => (
			<HeroTabs activeTab={null} onTabChange={onTabChange} />
		));
		expect(screen.getByPlaceholderText('Smart Search')).toBeInTheDocument();
		expect(screen.getByText('Search')).toBeInTheDocument();
		unmountEn();

		setTestLocale('ru');
		const { unmount: unmountRu } = render(() => (
			<HeroTabs activeTab={null} onTabChange={onTabChange} />
		));
		expect(screen.getByPlaceholderText('Умный поиск')).toBeInTheDocument();
		expect(screen.getByText('Поиск')).toBeInTheDocument();
		unmountRu();

		setTestLocale('zh');
		const { unmount: unmountZh } = render(() => (
			<HeroTabs activeTab={null} onTabChange={onTabChange} />
		));
		expect(screen.getByPlaceholderText('智能搜索')).toBeInTheDocument();
		expect(screen.getByText('搜索')).toBeInTheDocument();
		unmountZh();
	});

	it('auto-detects username, +888 number, and gift queries and navigates to the right vertical', () => {
		setTestLocale('fa');
		const onTabChange = vi.fn();
		render(() => <HeroTabs activeTab={null} onTabChange={onTabChange} />);

		const input = screen.getByPlaceholderText('جستجوی هوشمند') as HTMLInputElement;
		const form = input.closest('form')!;

		// 1. Username detection
		fireEvent.input(input, { target: { value: '@telegram' } });
		expect(screen.getByText('@USER')).toBeInTheDocument();
		fireEvent.submit(form);
		expect(mockNavigate).toHaveBeenCalledWith('/username?u=telegram');

		// 2. +888 Number detection
		fireEvent.input(input, { target: { value: '+888 0888 8888' } });
		expect(screen.getByText('+888')).toBeInTheDocument();
		fireEvent.submit(form);
		expect(mockNavigate).toHaveBeenCalledWith('/numbers/report?n=88808888888');

		// 3. Gift slug detection
		fireEvent.input(input, { target: { value: 'PlushPepe-1' } });
		expect(screen.getByText('GIFT')).toBeInTheDocument();
		fireEvent.submit(form);
		expect(mockNavigate).toHaveBeenCalledWith('/gifts/report?g=PlushPepe-1');
	});
});
