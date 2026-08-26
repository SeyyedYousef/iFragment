import { useLocation } from '@solidjs/router';
import { createMemo, createSignal } from 'solid-js';

export const DEMO_BOT_ID = 'demo-bot';
export const DEMO_GROUP_ID = 'demo-group';
export const DEMO_CHANNEL_ID = 'demo-channel';

export const DEMO_GROUP_PATH = `/group/${DEMO_GROUP_ID}`;
export const DEMO_CHANNEL_PATH = `/channel/${DEMO_CHANNEL_ID}`;

const DEMO_TOKEN_RE = /(^|[/=?&])(demo-bot|demo-group|demo-channel)(\/|$|[?&#])/;

/** آیا این مسیر/آیدی متعلق به جعبه‌شنی دمو است؟ (خالص و بدون وابستگی به روتر) */
export const isDemoId = (id?: string | null): boolean =>
	id === DEMO_BOT_ID || id === DEMO_GROUP_ID || id === DEMO_CHANNEL_ID;

export const isDemoPath = (path?: string | null): boolean =>
	!!path && DEMO_TOKEN_RE.test(`${path}/`);

/** رویداد آخرین اکشن دمو — بنر پایین صفحه آن را نمایش می‌دهد */
export type DemoAction =
	| { kind: 'saved'; label: string; at: number }
	| { kind: 'locked'; label: string; at: number };

const [lastDemoAction, setLastDemoAction] = createSignal<DemoAction | null>(null);

export { lastDemoAction };
export const notifyDemoAction = (kind: DemoAction['kind'], label: string) =>
	setLastDemoAction({ kind, label, at: Date.now() });

/** هوک واکنشی برای کامپوننت‌ها */
export const useDemoMode = () => {
	const location = useLocation();
	return createMemo(() => {
		const p = location.pathname || '';
		if (!isDemoPath(p)) return { active: false, kind: null as 'group' | 'channel' | null };
		return {
			active: true,
			kind: p.startsWith('/channel') ? ('channel' as const) : ('group' as const),
		};
	});
};
