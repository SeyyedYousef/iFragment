import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ===== 1. i18n Mock =====
vi.mock('@/shared/i18n/index.js', () => ({
	t: (key: string) => key,
	locale: () => 'en',
	isRtl: () => false,
}));

// ===== 2. Telegram Mini App SDK Mock =====
vi.mock('@tma.js/sdk-solid', () => ({
	backButton: {
		show: vi.fn(),
		hide: vi.fn(),
		onClick: vi.fn(() => vi.fn()),
	},
	hapticFeedback: {
		impactOccurred: vi.fn(),
		notificationOccurred: vi.fn(),
		selectionChanged: vi.fn(),
	},
	mainButton: {
		show: vi.fn(),
		hide: vi.fn(),
		setParams: vi.fn(),
		onClick: vi.fn(() => vi.fn()),
	},
	openTelegramLink: vi.fn(),
}));

// ===== 3. Motion Mock (passthrough with props) =====
const M = (props: any) => <div {...props}>{props.children}</div>;
const MB = (props: any) => <button {...props}>{props.children}</button>;
vi.mock('@motionone/solid', () => ({
	Motion: {
		div: M,
		span: (props: any) => <span {...props}>{props.children}</span>,
		h1: (props: any) => <h1 {...props}>{props.children}</h1>,
		h2: (props: any) => <h2 {...props}>{props.children}</h2>,
		h3: (props: any) => <h3 {...props}>{props.children}</h3>,
		p: (props: any) => <p {...props}>{props.children}</p>,
		button: MB,
		section: (props: any) => <section {...props}>{props.children}</section>,
		header: (props: any) => <header {...props}>{props.children}</header>,
		footer: (props: any) => <footer {...props}>{props.children}</footer>,
		nav: (props: any) => <nav {...props}>{props.children}</nav>,
		aside: (props: any) => <aside {...props}>{props.children}</aside>,
		a: (props: any) => <a {...props}>{props.children}</a>,
		li: (props: any) => <li {...props}>{props.children}</li>,
		ul: (props: any) => <ul {...props}>{props.children}</ul>,
		ol: (props: any) => <ol {...props}>{props.children}</ol>,
	},
	Presence: (props: any) => props.children,
}));

// ===== 4. Shared UI Mocks =====
vi.mock('@/shared/ui/hamburger-menu.js', () => ({
	HamburgerMenu: () => null,
}));

vi.mock('@/shared/ui/toast.js', () => ({
	showToast: vi.fn(),
}));

vi.mock('@/shared/ui/settings-controls.js', () => ({
	SettingsSection: (props: any) => <div data-testid="settings-section">{props.title}</div>,
	ToggleSwitch: (props: any) => (
		<button type="button" data-testid="toggle" onClick={() => props.onChange?.(!props.checked)}>
			{props.checked ? 'ON' : 'OFF'}
		</button>
	),
	SelectField: (props: any) => (
		<label>
			<select data-testid="select" aria-label="Select field">
				<option>{props.value}</option>
			</select>
		</label>
	),
	NumberInputField: (props: any) => (
		<div data-testid="number-input">
			<label>
				<span>{props.label}</span>
				<input type="number" value={props.value} aria-label={props.label || 'Number input'} />
			</label>
		</div>
	),
	InlineButtonField: (props: any) => <div data-testid="inline-button">{props.title}</div>,
	StringListField: (props: any) => <div data-testid="string-list">{props.label}</div>,
}));

// ===== 5. solid-focus-trap Mock =====
vi.mock('solid-focus-trap', () => ({
	default: vi.fn(),
}));

// ===== 6. JSDOM Polyfills =====
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}));

// crypto.randomUUID polyfill for JSDOM
if (!global.crypto?.randomUUID) {
	Object.defineProperty(global, 'crypto', {
		value: {
			...global.crypto,
			randomUUID: () => `test-uuid-${Math.random().toString(36).substr(2, 9)}`,
		},
	});
}
