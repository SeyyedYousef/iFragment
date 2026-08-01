import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { isDemoPath, notifyDemoAction } from '@/shared/lib/demo-mode.js';
import { resolveDemoRoute } from './demo-fixtures.js';

const DEMO_LATENCY_MS = 180; // تا اسکلتون‌های لودینگ واقعی دیده شوند

const scan = (value: unknown, depth = 0): boolean => {
	if (depth > 3 || value == null) return false;
	if (typeof value === 'string') return isDemoPath(value) || isDemoPath(`/${value}`);
	if (Array.isArray(value)) return value.some((v) => scan(v, depth + 1));
	if (typeof value === 'object') return Object.values(value as any).some((v) => scan(v, depth + 1));
	return false;
};

export const isDemoRequest = (config: AxiosRequestConfig): boolean => {
	if (isDemoPath(config.url)) return true;
	if (config.params && scan(config.params)) return true;
	let body: any = config.data;
	if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return false; } }
	return scan(body);
};

export const demoAdapter = async (
	config: InternalAxiosRequestConfig,
): Promise<AxiosResponse> => {
	const method = (config.method || 'get').toUpperCase();
	const path = (config.url || '').split('?')[0];
	let body: any = config.data;
	if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }

	await new Promise((r) => setTimeout(r, DEMO_LATENCY_MS));
	const result = await resolveDemoRoute(method, path, body, config);

	if (result.error) {
		notifyDemoAction('locked', path);
		throw result.error;
	}
	if (method !== 'GET') notifyDemoAction('saved', path);

	return {
		data: result.data,
		status: 200,
		statusText: 'OK (demo)',
		headers: {} as any,
		config,
	};
};
