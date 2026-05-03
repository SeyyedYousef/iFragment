import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [solidPlugin(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
    deps: {
      optimizer: {
        web: {
          include: ['solid-js'],
        },
      },
    },
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
});
