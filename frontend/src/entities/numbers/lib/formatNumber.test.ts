import { describe, expect, it } from 'vitest';
import { formatLiveNumberInput, splitNumberPrefix } from './formatNumber.js';

describe('formatNumber utilities', () => {
	describe('splitNumberPrefix', () => {
		it('formats +888 8888 8888 properly', () => {
			const res = splitNumberPrefix('+888 8888 8888');
			expect(res.prefix).toBe('+888');
			expect(res.body).toBe('8888 8888');
			expect(res.rawDigits).toBe('88888888');
			expect(res.fullDisplay).toBe('+888 8888 8888');
		});

		it('formats 88880000 without stripping 888', () => {
			const res = splitNumberPrefix('88880000');
			expect(res.body).toBe('8888 0000');
			expect(res.rawDigits).toBe('88880000');
			expect(res.fullDisplay).toBe('+888 8888 0000');
		});

		it('formats genesis 8888 properly', () => {
			const res = splitNumberPrefix('8888');
			expect(res.body).toBe('8888');
			expect(res.rawDigits).toBe('8888');
			expect(res.fullDisplay).toBe('+888 8888');
		});

		it('formats Persian digits', () => {
			const res = splitNumberPrefix('+۸۸۸ ۸۸۸۸ ۸۸۸۸');
			expect(res.body).toBe('8888 8888');
			expect(res.rawDigits).toBe('88888888');
		});
	});

	describe('formatLiveNumberInput', () => {
		it('preserves 888 without clearing it', () => {
			const res = formatLiveNumberInput('888');
			expect(res.formatted).toBe('888');
			expect(res.digits).toBe('888');
		});

		it('formats 8888 8888 correctly', () => {
			const res = formatLiveNumberInput('88888888');
			expect(res.formatted).toBe('8888 8888');
			expect(res.digits).toBe('88888888');
		});

		it('strips leading +888 when pasting full number', () => {
			const res = formatLiveNumberInput('+888 1234 5678');
			expect(res.formatted).toBe('1234 5678');
			expect(res.digits).toBe('12345678');
		});

		it('formats Persian inputs', () => {
			const res = formatLiveNumberInput('۸۸۸۸۰۰۰۰');
			expect(res.formatted).toBe('8888 0000');
			expect(res.digits).toBe('88880000');
		});
	});
});
