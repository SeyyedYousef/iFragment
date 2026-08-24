import { render } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { SparklineChart } from './SparklineChart.js';

describe('SparklineChart Component', () => {
	it('renders without crashing with default fallback points', () => {
		const { container } = render(() => <SparklineChart title="Test Trend" />);
		expect(container.textContent).toContain('Test Trend');
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
	});

	it('calculates positive percentage change badge accurately', () => {
		const mockData = [
			{ label: 'Jan', value: 100 },
			{ label: 'Feb', value: 200 },
		];
		const { container } = render(() => <SparklineChart data={mockData} title="Positive Trend" />);
		expect(container.textContent).toContain('+100%');
	});

	it('calculates negative percentage change badge accurately', () => {
		const mockData = [
			{ label: 'Jan', value: 200 },
			{ label: 'Feb', value: 100 },
		];
		const { container } = render(() => <SparklineChart data={mockData} title="Negative Trend" />);
		expect(container.textContent).toContain('-50%');
	});

	it('renders all path and coordinate elements', () => {
		const mockData = [
			{ label: 'Jan', value: 100 },
			{ label: 'Feb', value: 150 },
			{ label: 'Mar', value: 120 },
		];
		const { container } = render(() => <SparklineChart data={mockData} />);
		const circles = container.querySelectorAll('circle');
		expect(circles.length).toBe(3);
	});
});
