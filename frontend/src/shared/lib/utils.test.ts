import { describe, it, expect } from 'vitest';

// Example utility test to bootstrap the testing environment
describe('iFragment Core Utils', () => {
  it('should format numbers correctly', () => {
    const val = 1000000;
    expect(val.toLocaleString()).toBe('1,000,000');
  });

  it('should validate balance updates', () => {
    let balance = 100;
    const add = (v: number) => balance += v;
    add(50);
    expect(balance).toBe(150);
  });
});
