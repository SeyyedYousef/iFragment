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

// ===== 3. Motion Mock (children-passthrough) =====
const M = (props: any) => props.children;
vi.mock('@motionone/solid', () => ({
  Motion: { div: M, span: M, h1: M, h2: M, h3: M, p: M, button: M, section: M, header: M, footer: M, nav: M, aside: M, a: M, li: M, ul: M, ol: M },
  Presence: M,
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
  ToggleSwitch: (props: any) => <button data-testid="toggle" onClick={() => props.onChange?.(!props.checked)}>{props.checked ? 'ON' : 'OFF'}</button>,
  SelectField: (props: any) => <select data-testid="select"><option>{props.value}</option></select>,
  NumberInputField: (props: any) => <div data-testid="number-input"><label><span>{props.label}</span><input type="number" value={props.value} /></label></div>,
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
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    },
  });
}
