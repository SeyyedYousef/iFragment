import { describe, expect, it, vi } from 'vitest';
import { numbersApi, parseNumbersFromHTML } from './numbersApi.js';
import { apiClient } from '@/shared/api/axios.js';

describe('numbersApi integrity tests', () => {
	describe('parseNumbersFromHTML', () => {
		it('returns 0 last_sale_usd when exchange rate is not provided', () => {
			const html = `
				<tbody>
					<tr>
						<td><a href="/numbers/88880001/"></a></td>
						<td><span class="ton"><strong>100</strong></span></td>
					</tr>
				</tbody>
			`;
			const res = parseNumbersFromHTML(html);
			expect(res.items.length).toBe(1);
			expect(res.items[0].last_sale_ton).toBe(100);
			expect(res.items[0].last_sale_usd).toBe(0);
		});

		it('calculates last_sale_usd when rate is explicitly provided', () => {
			const html = `
				<tbody>
					<tr>
						<td><a href="/numbers/88880001/"></a></td>
						<td><span class="ton"><strong>100</strong></span></td>
					</tr>
				</tbody>
			`;
			const res = parseNumbersFromHTML(html, 3.5);
			expect(res.items.length).toBe(1);
			expect(res.items[0].last_sale_ton).toBe(100);
			expect(res.items[0].last_sale_usd).toBe(350);
		});
	});

	describe('numbersApi.getNumbersList (Zero Fake Fallback)', () => {
		it('returns empty array and 0 total on backend failure without generating fake items', async () => {
			vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Network error / 502 Bad Gateway'));

			const result = await numbersApi.getNumbersList({ page: 1 });
			expect(result.items).toEqual([]);
			expect(result.total).toBe(0);
			expect(result.totalPages).toBe(1);
		});
	});
});
